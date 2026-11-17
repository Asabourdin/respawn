// Supabase Edge Function "respawn-ai" (Deno). Production AI backend for the GitHub Pages build.
//
// bundle.js is generated from server/edge-entry.ts by scripts/build-edge.mjs (all npm deps
// inlined, no Node built-ins). Rebuild it before every deploy:
//   node scripts/build-edge.mjs
//   supabase functions deploy respawn-ai --no-verify-jwt --project-ref <ref>
//
// Secrets (already set in the project): ANTHROPIC_API_KEY (Claude, used first), GEMINI_API_KEY.
// Optional: RESPAWN_AI_PROVIDER, RESPAWN_NARRATOR_MODEL, RESPAWN_FINALE_MODEL, RESPAWN_ALLOWED_ORIGINS.
// URL: https://<ref>.supabase.co/functions/v1/respawn-ai/<narrate|event|surprise|startup|epitaph|stats|health>
import { handleAiRequest } from './bundle.js'

Deno.serve((req: Request) => handleAiRequest(req))
