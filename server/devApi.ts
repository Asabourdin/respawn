/**
 * Dev-only Vite plugin: serves /api/* from the same Web-standard router that Vercel and the
 * Supabase Edge Function use, so `npm run dev` works end to end without any CLI.
 *
 * - Loads .env.local (and friends) into process.env with Vite's loadEnv(mode, cwd, '').
 *   Variables already set in the shell win.
 * - Converts the Node request into a Web Request, routes /api/ai/:task, /api/stats, /api/health,
 *   and streams the Web Response back.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import { handleAiRequest } from './router.js'

const MAX_DEV_BODY = 64_000

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer)
    total += buf.byteLength
    if (total > MAX_DEV_BODY) return null
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

export async function toWebRequest(req: IncomingMessage, signal?: AbortSignal): Promise<Request | null> {
  const host = req.headers.host ?? 'localhost:5173'
  const url = new URL((req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/', `http://${host}`)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  if (!headers.has('x-forwarded-for') && req.socket.remoteAddress) {
    headers.set('x-forwarded-for', req.socket.remoteAddress)
  }
  const method = (req.method ?? 'GET').toUpperCase()
  let body: Buffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const read = await readBody(req)
    if (read === null) return null
    body = read
  }
  return new Request(url, { method, headers, body: body ? new Uint8Array(body) : undefined, signal })
}

export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  if (!response.body) {
    res.end()
    return
  }
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(value)
  }
  res.end()
}

export function devApi(): Plugin {
  return {
    name: 'respawn-dev-api',
    configureServer(server) {
      const loaded = loadEnv(server.config.mode, process.cwd(), '')
      for (const [key, value] of Object.entries(loaded)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const path = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
        if (!path.startsWith('/api/')) return next()
        const abort = new AbortController()
        res.on('close', () => {
          if (!res.writableEnded) abort.abort()
        })
        try {
          const request = await toWebRequest(req, abort.signal)
          if (!request) {
            res.statusCode = 413
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'body too large' }))
            return
          }
          await sendWebResponse(res, await handleAiRequest(request))
        } catch (err) {
          server.config.logger.error(`[api] ${err instanceof Error ? err.message : String(err)}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
          }
          res.end(JSON.stringify({ error: 'internal_error' }))
        }
      })
    },
  }
}
