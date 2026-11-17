/**
 * Vercel function (secondary deployment target): POST /api/ai/:task
 * (narrate | event | surprise | startup | epitaph). Thin wrapper over the shared router.
 * Web-standard `fetch` export on the Node.js runtime (Vercel Functions API reference).
 */
import { handleAiRequest } from '../../server/router.js'

export const config = { runtime: 'nodejs', maxDuration: 30 }

export default {
  fetch(request: Request): Promise<Response> {
    return handleAiRequest(request)
  },
}
