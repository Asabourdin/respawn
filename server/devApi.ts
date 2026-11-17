/**
 * Dev-only Vite plugin: serves /api/* from the same handlers Vercel uses, so `npm run dev`
 * works end to end without the Vercel CLI. (Stub — replaced by the AI layer.)
 */
import type { Plugin } from 'vite'

export function devApi(): Plugin {
  return {
    name: 'respawn-dev-api',
    configureServer(server) {
      server.middlewares.use('/api', (_req, res) => {
        res.statusCode = 503
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'AI layer not wired yet' }))
      })
    },
  }
}
