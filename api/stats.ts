/** Vercel function: GET/POST /api/stats (promo live mode). Thin wrapper over the shared router. */
import { handleAiRequest } from '../server/router.js'

export const config = { runtime: 'nodejs', maxDuration: 10 }

export default {
  fetch(request: Request): Promise<Response> {
    return handleAiRequest(request)
  },
}
