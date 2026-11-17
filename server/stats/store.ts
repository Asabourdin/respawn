/**
 * Storage adapter for the promo live mode. Supabase REST (PostgREST) via fetch when
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set; otherwise "not configured" (HTTP 501).
 * Table and views: see docs/AI.md (respawn_events, respawn_choice_shares, respawn_live, respawn_titles).
 */
import { getEnv, type EnvReader } from '../env.js'

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

export interface StatsStore {
  recordChoice(sceneId: string, choiceId: string): Promise<void>
  recordEnd(end: { temperature: number; title: string }): Promise<void>
  getChoiceShares(sceneId: string): Promise<ChoiceShares>
  getLive(): Promise<LiveStats>
}

export class StatsError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'StatsError'
    this.status = status
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export function supabaseStore(url: string, key: string, fetchImpl: FetchLike = fetch): StatsStore {
  const base = `${url.replace(/\/+$/, '')}/rest/v1`
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' }
  // Legacy service-role keys are JWTs and also go in Authorization; new sb_secret_ keys go in apikey only.
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) throw new StatsError(502, `supabase ${res.status}`)
    return res
  }

  async function insert(row: Record<string, unknown>) {
    await call('/respawn_events', { method: 'POST', body: JSON.stringify(row), headers: { prefer: 'return=minimal' } })
  }

  return {
    recordChoice: (sceneId, choiceId) => insert({ kind: 'choice', scene_id: sceneId, choice_id: choiceId }),
    recordEnd: ({ temperature, title }) => insert({ kind: 'end', temperature, title }),
    async getChoiceShares(sceneId) {
      const res = await call(`/respawn_choice_shares?select=choice_id,n&scene_id=eq.${encodeURIComponent(sceneId)}`)
      const rows = (await res.json()) as { choice_id: string; n: number }[]
      const total = rows.reduce((s, r) => s + Number(r.n || 0), 0)
      const shares: Record<string, number> = {}
      for (const r of rows) shares[r.choice_id] = total ? Number(r.n) / total : 0
      return { total, shares }
    },
    async getLive() {
      const [liveRes, titlesRes] = await Promise.all([
        call('/respawn_live?select=lives,avg_temperature'),
        call('/respawn_titles?select=title,n&order=n.desc&limit=12'),
      ])
      const live = ((await liveRes.json()) as { lives: number; avg_temperature: number | null }[])[0]
      const titles = (await titlesRes.json()) as { title: string; n: number }[]
      return {
        lives: Number(live?.lives ?? 0),
        avgTemperature: live?.avg_temperature == null ? null : Number(live.avg_temperature),
        titles: titles.map((t) => ({ title: t.title, n: Number(t.n) })),
      }
    },
  }
}

export function statsStoreFromEnv(env: EnvReader = getEnv): StatsStore | null {
  // Opt-in only: never touch the host project's database unless explicitly enabled.
  if (env('RESPAWN_STATS') !== 'on') return null
  const url = env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  return url && key ? supabaseStore(url, key) : null
}
