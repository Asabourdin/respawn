import { describe, expect, it, vi } from 'vitest'
import { envFrom } from '../env'
import { createStatsHandler } from './handler'
import { supabaseStore, type StatsStore } from './store'

function memoryStore(): StatsStore & { rows: unknown[] } {
  const rows: { kind: string; sceneId?: string; choiceId?: string }[] = []
  return {
    rows,
    async recordChoice(sceneId, choiceId) {
      rows.push({ kind: 'choice', sceneId, choiceId })
    },
    async recordEnd() {
      rows.push({ kind: 'end' })
    },
    async getChoiceShares(sceneId) {
      const mine = rows.filter((r) => r.kind === 'choice' && r.sceneId === sceneId)
      const shares: Record<string, number> = {}
      for (const r of mine) shares[r.choiceId!] = (shares[r.choiceId!] ?? 0) + 1 / mine.length
      return { total: mine.length, shares }
    },
    async getLive() {
      return { lives: rows.filter((r) => r.kind === 'end').length, avgTemperature: 2.7, titles: [] }
    },
  }
}

const post = (body: unknown) => new Request('http://localhost/api/stats', { method: 'POST', body: JSON.stringify(body) })

describe('stats handler', () => {
  it('501 when not configured', async () => {
    const h = createStatsHandler({ env: envFrom({}) })
    expect((await h(post({ type: 'choice', sceneId: 'a', choiceId: 'b' }))).status).toBe(501)
  })

  it('records choices and returns shares; validates input', async () => {
    const store = memoryStore()
    const h = createStatsHandler({ env: envFrom({}), store: () => store })
    expect((await h(post({ type: 'choice', sceneId: 'c11', choiceId: 'goldbridge' }))).status).toBe(200)
    expect((await h(post({ type: 'choice', sceneId: 'c11', choiceId: 'verdant' }))).status).toBe(200)
    expect((await h(post({ type: 'choice', sceneId: 'c11 drop table', choiceId: 'x' }))).status).toBe(400)
    expect((await h(post({ type: 'end', temperature: 2.71, title: 'Quiet Hero' }))).status).toBe(200)
    const res = await h(new Request('http://localhost/api/stats?sceneId=c11'))
    expect((await res.json()).data).toEqual({ total: 2, shares: { goldbridge: 0.5, verdant: 0.5 } })
    const live = await h(new Request('http://localhost/api/stats?live=1'))
    expect((await live.json()).data.lives).toBe(1)
  })

  it('supabase adapter talks PostgREST with the service key', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init
      if (url.includes('respawn_choice_shares')) return new Response(JSON.stringify([{ choice_id: 'a', n: 3 }, { choice_id: 'b', n: 1 }]))
      return new Response(null, { status: 201 })
    })
    const store = supabaseStore('https://ref.supabase.co/', 'eyJ.service.key', fetchMock)
    await store.recordChoice('c01', 'campus')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ref.supabase.co/rest/v1/respawn_events')
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer eyJ.service.key')
    expect(JSON.parse(String(init!.body))).toEqual({ kind: 'choice', scene_id: 'c01', choice_id: 'campus' })
    expect(await store.getChoiceShares('c01')).toEqual({ total: 4, shares: { a: 0.75, b: 0.25 } })
  })
})
