/**
 * Request guards for /api/ai/*: per-IP token bucket, per-life call cap (x-respawn-life header),
 * body size cap, JSON parsing and strict Zod validation.
 *
 * State lives in memory, so on serverless (Vercel, Supabase Edge) each instance has its own
 * counters: this is best-effort abuse protection. The hard cap is the spend limit on the API key.
 *
 * School-event note: many players can share one public IP (campus wifi), so the per-IP bucket is
 * generous by default (240 calls/min, burst 80). Tune with RESPAWN_RATE_PER_MIN / RESPAWN_RATE_BURST.
 */
import type { z } from 'zod'
import { getEnv, type EnvReader } from '../env.js'
import { readTextCapped } from '../http.js'
import { sanitizeInput } from './filter.js'

export interface GuardOptions {
  now?: () => number
  env?: EnvReader
}

export type GuardFailure = { ok: false; status: number; error: string; headers?: Record<string, string> }

function intEnv(env: EnvReader, name: string, fallback: number): number {
  const n = Number(env(name))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// ---------------------------------------------------------------------------
// Token bucket
// ---------------------------------------------------------------------------

export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>()
  private readonly perMinute: number
  private readonly burst: number
  private readonly now: () => number
  constructor(perMinute: number, burst: number, now: () => number = Date.now) {
    this.perMinute = perMinute
    this.burst = burst
    this.now = now
  }

  take(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    const t = this.now()
    const refillPerMs = this.perMinute / 60_000
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: t }
    b.tokens = Math.min(this.burst, b.tokens + (t - b.at) * refillPerMs)
    b.at = t
    if (b.tokens < 1) {
      this.buckets.set(key, b)
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((1 - b.tokens) / refillPerMs / 1000)) }
    }
    b.tokens -= 1
    this.buckets.set(key, b)
    if (this.buckets.size > 20_000) this.prune(t)
    return { ok: true }
  }

  private prune(t: number) {
    const fullAfterMs = (this.burst / this.perMinute) * 60_000
    for (const [k, b] of this.buckets) if (t - b.at > fullAfterMs) this.buckets.delete(k)
  }
}

// ---------------------------------------------------------------------------
// Per-life cap
// ---------------------------------------------------------------------------

const LIFE_TTL_MS = 3 * 60 * 60 * 1000

export class LifeCounter {
  private lives = new Map<string, { count: number; at: number }>()
  private readonly cap: number
  private readonly now: () => number
  constructor(cap: number, now: () => number = Date.now) {
    this.cap = cap
    this.now = now
  }

  /** Counts one call; false when the life already used its cap. */
  hit(lifeId: string): boolean {
    const t = this.now()
    const entry = this.lives.get(lifeId)
    if (entry && t - entry.at < LIFE_TTL_MS) {
      if (entry.count >= this.cap) return false
      entry.count += 1
      entry.at = t
      return true
    }
    this.lives.set(lifeId, { count: 1, at: t })
    if (this.lives.size > 20_000) {
      for (const [k, e] of this.lives) if (t - e.at > LIFE_TTL_MS) this.lives.delete(k)
    }
    return true
  }

  used(lifeId: string): number {
    return this.lives.get(lifeId)?.count ?? 0
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

const LIFE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

export function readLifeId(req: Request): string | null {
  const id = req.headers.get('x-respawn-life')?.trim() ?? ''
  return LIFE_ID_RE.test(id) ? id : null
}

/** Best-effort client IP (Vercel, Supabase/Cloudflare, generic proxies, dev server). */
export function clientIp(req: Request): string {
  const h = req.headers
  const direct =
    h.get('x-vercel-forwarded-for') ?? h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')
  const first = direct?.split(',')[0]?.trim()
  return first && first.length <= 64 ? first : 'unknown'
}

export function zodMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

export interface Guard {
  /** Body read + rate limit + life cap + JSON + Zod. Returns the sanitised, typed input. */
  check<S extends z.ZodType>(req: Request, schema: S): Promise<{ ok: true; data: z.infer<S>; lifeId: string } | GuardFailure>
  readonly limiter: RateLimiter
  readonly lives: LifeCounter
}

export function createGuard(opts: GuardOptions = {}): Guard {
  const env = opts.env ?? getEnv
  const now = opts.now ?? Date.now
  const limiter = new RateLimiter(intEnv(env, 'RESPAWN_RATE_PER_MIN', 240), intEnv(env, 'RESPAWN_RATE_BURST', 80), now)
  const lives = new LifeCounter(intEnv(env, 'RESPAWN_LIFE_CAP', 50), now)
  const maxBody = intEnv(env, 'RESPAWN_MAX_BODY_BYTES', 24_000)

  return {
    limiter,
    lives,
    async check(req, schema) {
      if (req.method !== 'POST') return { ok: false, status: 405, error: 'use POST' }
      const rate = limiter.take(clientIp(req))
      if (!rate.ok) {
        return { ok: false, status: 429, error: 'rate limited', headers: { 'retry-after': String(rate.retryAfterSec) } }
      }
      const lifeId = readLifeId(req)
      if (!lifeId) return { ok: false, status: 400, error: 'missing or invalid x-respawn-life header' }

      const body = await readTextCapped(req, maxBody)
      if (!body.ok) return { ok: false, status: body.status, error: body.error }
      let raw: unknown
      try {
        raw = JSON.parse(body.text)
      } catch {
        return { ok: false, status: 400, error: 'body is not valid JSON' }
      }
      const parsed = schema.safeParse(raw)
      if (!parsed.success) return { ok: false, status: 400, error: `invalid input: ${zodMessage(parsed.error)}` }

      // Count only well-formed requests against the life cap.
      if (!lives.hit(lifeId)) return { ok: false, status: 429, error: 'life call cap reached' }
      return { ok: true, data: sanitizeInput(parsed.data), lifeId }
    },
  }
}
