/**
 * AI smoke test: one real call per task with sample payloads, printing the output, latency,
 * token usage and estimated cost, plus a per-life estimate.
 *
 *   npx tsx tools/ai-smoke.ts                       # all tasks, provider from env (auto)
 *   npx tsx tools/ai-smoke.ts narrate epitaph       # some tasks
 *   npx tsx tools/ai-smoke.ts --provider gemini     # force a provider
 *
 * Reads .env.local (keys already set in the shell win). Never prints key values.
 */
import { readFileSync } from 'node:fs'
import { TASK_DEFS, runTask, type TaskOutcome } from '../server/ai/handlers.js'
import { chooseProvider, formatUsd, isTask, TASKS, type Task } from '../server/ai/models.js'
import { resolveProvider } from '../server/ai/providers/index.js'
import { narrateMajorSample, samples } from '../server/ai/samples.js'

function loadEnvFile(file: string) {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return
  }
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    const value = m[2].replace(/^["']|["']$/g, '')
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}

loadEnvFile('.env.local')

const args = process.argv.slice(2)
const pIndex = args.indexOf('--provider')
if (pIndex >= 0 && args[pIndex + 1]) {
  process.env.RESPAWN_AI_PROVIDER = args[pIndex + 1]
  args.splice(pIndex, 2)
}
const wanted = args.filter(isTask)
const tasks: Task[] = wanted.length ? wanted : [...TASKS]

const choice = chooseProvider()
if (!choice.ok) {
  console.log(`No AI provider configured (${choice.error}).

Set one of these in .env.local (never commit it):
  ANTHROPIC_API_KEY=sk-ant-...     # Claude, the production default
  GEMINI_API_KEY=...               # Gemini, for testing
Optional: RESPAWN_AI_PROVIDER=anthropic|gemini|auto

Then run: npx tsx tools/ai-smoke.ts`)
  process.exit(0)
}

const resolved = resolveProvider()
if (!resolved.ok) throw new Error(resolved.error)
const provider = resolved.provider
console.log(`Provider: ${provider.name}\n`)

const results: Partial<Record<Task, TaskOutcome>> = {}

async function one(label: string, task: Task, sample: unknown) {
  const input = TASK_DEFS[task].input.parse(sample)
  try {
    const o = await runTask(task, input, provider)
    results[task] ??= o
    const u = o.usage
    console.log(`=== ${label} (${o.model}) ${o.ok ? 'OK' : `REJECTED: ${o.reason}`} in ${o.ms} ms`)
    console.log(
      `    tokens in=${u.inputTokens} cache_read=${u.cacheReadTokens} cache_write=${u.cacheWriteTokens} out=${u.outputTokens}  ~${formatUsd(o.costUsd)}  stop=${o.stop}`,
    )
    if (o.ok) console.log(JSON.stringify(o.data, null, 2))
    console.log()
  } catch (err) {
    console.log(`=== ${label} ERROR: ${err instanceof Error ? err.message : String(err)}\n`)
  }
}

for (const task of tasks) {
  await one(task, task, samples[task])
  if (task === 'narrate') await one('narrate (major scene)', 'narrate', narrateMajorSample)
}

// Per-life estimate: ~30 narrations, 3 AI events, 1 surprise offer, a startup 1 life in 3, 1 epitaph.
const mix: Record<Task, number> = { narrate: 30, event: 3, surprise: 1, startup: 0.33, epitaph: 1 }
if (tasks.length === TASKS.length && TASKS.every((t) => results[t])) {
  const perLife = TASKS.reduce((s, t) => s + (results[t]?.costUsd ?? 0) * mix[t], 0)
  console.log(`Estimated cost per life (measured prices, this run): ${formatUsd(perLife)}`)
  console.log(`Lives per $100: ~${Math.floor(100 / Math.max(perLife, 1e-9))}`)
}
