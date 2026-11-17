import { describe, expect, it } from 'vitest'
import { envFrom } from './env'
import { createRouter } from './router'

const env = envFrom({})
const echo = async (req: Request) => new Response(JSON.stringify({ task: new URL(req.url).pathname }), { status: 200 })
const ai = { narrate: echo, event: echo, surprise: echo, startup: echo, epitaph: echo }

describe('router', () => {
  const route = createRouter(env, ai)

  it('dispatches on the last path segment (dev, Vercel and Supabase paths)', async () => {
    for (const url of ['http://localhost:5173/api/ai/narrate', 'https://x.supabase.co/respawn-ai/narrate', 'https://x.supabase.co/functions/v1/respawn-ai/narrate']) {
      const res = await route(new Request(url, { method: 'POST', headers: { origin: 'http://localhost:5173' } }))
      expect(res.status).toBe(200)
    }
    expect((await route(new Request('http://localhost/api/ai/nope'))).status).toBe(404)
  })

  it('rejects scripted POSTs without an allowed Origin', async () => {
    const res = await route(new Request('https://x.supabase.co/functions/v1/respawn-ai/narrate', { method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('kill switch disables AI tasks', async () => {
    const off = createRouter((k) => (k === 'RESPAWN_AI_DISABLED' ? '1' : env(k)), ai)
    const res = await off(new Request('http://localhost:5173/api/ai/narrate', { method: 'POST', headers: { origin: 'http://localhost:5173' } }))
    expect(res.status).toBe(503)
  })

  it('health never leaks keys', async () => {
    const r = createRouter(envFrom({ GEMINI_API_KEY: 'secret-value' }), ai)
    const res = await r(new Request('http://localhost/api/health'))
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).not.toContain('secret-value')
    expect(JSON.parse(text)).toMatchObject({ ai: { provider: 'gemini' } })
  })

  it('answers CORS preflight for the Pages origin with x-respawn-life allowed', async () => {
    const res = await route(
      new Request('https://x.supabase.co/functions/v1/respawn-ai/narrate', {
        method: 'OPTIONS',
        headers: { origin: 'https://lucasgerhardt06-create.github.io', 'access-control-request-method': 'POST' },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://lucasgerhardt06-create.github.io')
    expect(res.headers.get('access-control-allow-headers')).toContain('x-respawn-life')
  })

  it('adds CORS headers for allowed origins, allows same-origin, blocks others', async () => {
    const ok = await route(new Request('https://x.supabase.co/respawn-ai/narrate', { method: 'POST', headers: { origin: 'http://localhost:5173' } }))
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    const same = await route(new Request('https://respawn.vercel.app/api/ai/narrate', { method: 'POST', headers: { origin: 'https://respawn.vercel.app' } }))
    expect(same.status).toBe(200)
    const evil = await route(new Request('https://x.supabase.co/respawn-ai/narrate', { method: 'POST', headers: { origin: 'https://evil.example' } }))
    expect(evil.status).toBe(403)
  })

  it('stats is 501 when no storage is configured', async () => {
    const res = await route(new Request('http://localhost/api/stats?sceneId=c01_arrival'))
    expect(res.status).toBe(501)
  })
})
