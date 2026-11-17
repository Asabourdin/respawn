/**
 * Bundle entry for the Supabase Edge Function (Deno). scripts/build-edge.mjs bundles this file and
 * every npm dependency into supabase/functions/respawn-ai/bundle.js.
 */
export { handleAiRequest } from './router.js'
