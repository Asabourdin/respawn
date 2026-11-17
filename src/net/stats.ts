/**
 * Promo live mode client ("62% of players chose this", the /#/live screen).
 * Talks to <AI_BASE_URL>/stats (same router as the AI tasks). Never throws: every function
 * resolves to null/void on failure. After a 501 (storage not configured) or repeated failures
 * it stops calling for the rest of the session.
 */
import { AI_BASE_URL } from '../ai/client'

export interface ChoiceShares {
  total: number
  /** choiceId → fraction 0..1 */
  shares: Record<string, number>
}

export interface LiveStats {
  lives: number
  avgTemperature: number | null
  titles: { title: string; n: number }[]
}

export interface StatsClientOptions {
  url?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export function createStatsClient(opts: StatsClientOptions = {}) {
  const url = opts.url ?? `${AI_BASE_URL}/stats`
  const doFetch = opts.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const timeoutMs = opts.timeoutMs ?? 2500
  let disabled = false
  let failures = 0

  async function send(init: RequestInit, query = ''): Promise<unknown> {
    if (disabled) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await doFetch(`${url}${query}`, { ...init, signal: controller.signal })
      if (res.status === 501) {
        disabled = true
        return null
      }
      if (!res.ok) throw new Error(String(res.status))
      failures = 0
      const body: unknown = await res.json()
      return body && typeof body === 'object' ? (body as { data?: unknown }).data ?? null : null
    } catch {
      failures += 1
      if (failures >= 3) disabled = true
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  const post = (body: unknown) =>
    send({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  return {
    get enabled() {
      return !disabled
    },
    async recordChoice(sceneId: string, choiceId: string): Promise<void> {
      await post({ type: 'choice', sceneId, choiceId })
    },
    async recordEnd(end: { temperature: number; title: string }): Promise<void> {
      await post({ type: 'end', temperature: end.temperature, title: end.title.slice(0, 80) })
    },
    async getChoiceShares(sceneId: string): Promise<ChoiceShares | null> {
      const data = await send({ method: 'GET' }, `?sceneId=${encodeURIComponent(sceneId)}`)
      if (!data || typeof data !== 'object') return null
      const d = data as Partial<ChoiceShares>
      return typeof d.total === 'number' && d.shares && typeof d.shares === 'object'
        ? { total: d.total, shares: d.shares }
        : null
    },
    async getLive(): Promise<LiveStats | null> {
      const data = await send({ method: 'GET' }, '?live=1')
      if (!data || typeof data !== 'object') return null
      const d = data as Partial<LiveStats>
      return typeof d.lives === 'number' && Array.isArray(d.titles)
        ? { lives: d.lives, avgTemperature: d.avgTemperature ?? null, titles: d.titles }
        : null
    },
  }
}

const client = createStatsClient()

export const recordChoice = (sceneId: string, choiceId: string) => client.recordChoice(sceneId, choiceId)
export const recordEnd = (end: { temperature: number; title: string }) => client.recordEnd(end)
export const getChoiceShares = (sceneId: string) => client.getChoiceShares(sceneId)
export const getLive = () => client.getLive()
