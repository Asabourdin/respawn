/**
 * Smoke-test a DEPLOYED AI backend (Supabase edge function or Vercel) with the sample payloads.
 *   npx tsx tools/ai-remote-smoke.ts https://<ref>.supabase.co/functions/v1/respawn-ai [tasks...]
 */
import { narrateMajorSample, samples } from '../server/ai/samples.js'

const [base, ...tasks] = process.argv.slice(2)
if (!base) {
  console.log('Usage: npx tsx tools/ai-remote-smoke.ts <base-url> [narrate event surprise startup epitaph]')
  process.exit(1)
}
const life = `smoke-${Math.random().toString(36).slice(2, 10)}`
const list = tasks.length ? tasks : ['narrate', 'narrate-major', 'event', 'surprise', 'startup', 'epitaph']
for (const t of list) {
  const task = t === 'narrate-major' ? 'narrate' : t
  const body = t === 'narrate-major' ? narrateMajorSample : (samples as Record<string, unknown>)[task]
  const t0 = Date.now()
  const res = await fetch(`${base.replace(/\/$/, '')}/${task}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-respawn-life': life, origin: 'http://localhost:5173' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`=== ${t}: HTTP ${res.status} in ${Date.now() - t0} ms`)
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log(text.slice(0, 500))
  }
  console.log()
}
