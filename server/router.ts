/**
 * Single Web-standard entry point for every runtime:
 *   - Vite dev server (server/devApi.ts)   /api/ai/<task>, /api/stats, /api/health
 *   - Vercel functions (api/**)            same paths
 *   - Supabase Edge Function respawn-ai    /functions/v1/respawn-ai/<task|stats|health>
 * Dispatches on the LAST path segment and handles CORS.
 */
import { createAiHandlers, type Handler } from './ai/handlers.js'
import { anthropicSettings, chooseProvider, geminiSettings, isTask } from './ai/models.js'
import { getEnv, type EnvReader } from './env.js'
import { errorJson, json } from './http.js'
import { createStatsHandler } from './stats/handler.js'
import { statsStoreFromEnv } from './stats/store.js'

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://lucasgerhardt06-create.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

export function allowedOrigins(env: EnvReader = getEnv): string[] {
  const extra = (env('RESPAWN_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra]
}

/** Allowed when listed, or same-origin (e.g. a Vercel deployment calling its own /api). */
export function originAllowed(origin: string, reqUrl: string, env: EnvReader = getEnv): boolean {
  if (allowedOrigins(env).includes(origin)) return true
  try {
    return new URL(reqUrl).origin === origin
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-respawn-life, authorization, apikey, x-client-info',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

function withHeaders(res: Response, headers: Record<string, string>): Response {
  if (!Object.keys(headers).length) return res
  const merged = new Headers(res.headers)
  for (const [k, v] of Object.entries(headers)) merged.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: merged })
}

export function healthResponse(env: EnvReader = getEnv): Response {
  const choice = chooseProvider(env)
  const provider = choice.ok ? choice.provider : null
  const models =
    provider === 'anthropic'
      ? { narrator: anthropicSettings('narrate', env).model, finale: anthropicSettings('epitaph', env).model }
      : provider === 'gemini'
        ? { narrator: geminiSettings('narrate', env).model, finale: geminiSettings('epitaph', env).model }
        : null
  return json({
    ok: true,
    ai: provider ? { provider, models } : { provider: null, error: choice.ok ? undefined : choice.error },
    stats: statsStoreFromEnv(env) ? 'configured' : 'not configured',
  })
}

export interface Router {
  (req: Request): Promise<Response>
}

export function createRouter(env: EnvReader = getEnv, ai: Record<string, Handler> = createAiHandlers({ env })): Router {
  const stats = createStatsHandler({ env })
  return async (req) => {
    const origin = req.headers.get('origin')
    const allowed = origin && originAllowed(origin, req.url, env) ? origin : null
    if (origin && !allowed) return errorJson(403, 'origin not allowed')
    const cors = corsHeaders(allowed)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const segments = new URL(req.url).pathname.split('/').filter(Boolean)
    const last = segments.at(-1) ?? ''
    // Browsers always send Origin on POST: a call without an allowed Origin is a script, not the game.
    if (req.method === 'POST' && !allowed) return errorJson(403, 'origin required')
    // Emergency kill switch (e.g. `supabase secrets set RESPAWN_AI_DISABLED=1`): the game keeps its base texts.
    if (isTask(last) && env('RESPAWN_AI_DISABLED') === '1') return withHeaders(errorJson(503, 'ai_disabled'), cors)
    let res: Response
    try {
      if (last === 'health') res = healthResponse(env)
      else if (last === 'stats') res = await stats(req)
      else if (isTask(last)) res = await ai[last](req)
      else res = errorJson(404, 'unknown endpoint')
    } catch (err) {
      console.error('[api] unhandled', err instanceof Error ? err.message : err)
      res = errorJson(500, 'internal_error')
    }
    return withHeaders(res, cors)
  }
}

let defaultRouter: Router | null = null

/** The shared entry point (lazy so env loaded by the dev server is picked up). */
export function handleAiRequest(req: Request): Promise<Response> {
  defaultRouter ??= createRouter()
  return defaultRouter(req)
}
