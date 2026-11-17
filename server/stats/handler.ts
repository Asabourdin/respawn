/**
 * /api/stats (promo live mode, stretch).
 *   POST { type: 'choice', sceneId, choiceId }      record a choice
 *   POST { type: 'end', temperature, title }         record an end result
 *   GET  ?sceneId=c11_first_job                      { data: { total, shares } }
 *   GET  ?live=1                                     { data: { lives, avgTemperature, titles } }
 * 501 when no storage is configured. Never stores anything about the player beyond these fields.
 */
import { z } from 'zod'
import { getEnv, type EnvReader } from '../env.js'
import { errorJson, json, readTextCapped } from '../http.js'
import { clientIp, RateLimiter, zodMessage } from '../ai/guard.js'
import { StatsError, statsStoreFromEnv, type ChoiceShares, type StatsStore } from './store.js'

const id = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/)

export const StatsBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choice'), sceneId: id, choiceId: id }).strict(),
  z.object({ type: z.literal('end'), temperature: z.number().min(0).max(10), title: z.string().min(1).max(80) }).strict(),
])

export interface StatsDeps {
  env: EnvReader
  store: (env: EnvReader) => StatsStore | null
  now: () => number
}

export function createStatsHandler(deps: Partial<StatsDeps> = {}) {
  const env = deps.env ?? getEnv
  const getStore = deps.store ?? statsStoreFromEnv
  const now = deps.now ?? Date.now
  const limiter = new RateLimiter(600, 120, now)
  const sharesCache = new Map<string, { at: number; value: ChoiceShares }>()

  return async function stats(req: Request): Promise<Response> {
    const store = getStore(env)
    if (!store) return errorJson(501, 'stats not configured')
    if (!limiter.take(clientIp(req)).ok) return errorJson(429, 'rate limited', {}, { 'retry-after': '5' })

    try {
      if (req.method === 'GET') {
        const url = new URL(req.url)
        if (url.searchParams.get('live')) return json({ data: await store.getLive() })
        const sceneId = url.searchParams.get('sceneId') ?? ''
        if (!id.safeParse(sceneId).success) return errorJson(400, 'invalid sceneId')
        const cached = sharesCache.get(sceneId)
        if (cached && now() - cached.at < 20_000) return json({ data: cached.value })
        const value = await store.getChoiceShares(sceneId)
        sharesCache.set(sceneId, { at: now(), value })
        if (sharesCache.size > 500) sharesCache.clear()
        return json({ data: value })
      }
      if (req.method !== 'POST') return errorJson(405, 'use GET or POST')
      const body = await readTextCapped(req, 2_000)
      if (!body.ok) return errorJson(body.status, body.error)
      let raw: unknown
      try {
        raw = JSON.parse(body.text)
      } catch {
        return errorJson(400, 'body is not valid JSON')
      }
      const parsed = StatsBody.safeParse(raw)
      if (!parsed.success) return errorJson(400, `invalid input: ${zodMessage(parsed.error)}`)
      const b = parsed.data
      if (b.type === 'choice') await store.recordChoice(b.sceneId, b.choiceId)
      else await store.recordEnd({ temperature: Math.round(b.temperature * 100) / 100, title: b.title })
      return json({ ok: true })
    } catch (err) {
      const status = err instanceof StatsError ? err.status : 500
      return errorJson(status, 'stats storage error')
    }
  }
}
