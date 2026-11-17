/** Vercel function: GET /api/health (which provider and models are configured; never the keys). */
import { handleAiRequest } from '../server/router.js'

export const config = { runtime: 'nodejs', maxDuration: 5 }

export default {
  fetch(request: Request): Promise<Response> {
    return handleAiRequest(request)
  },
}
