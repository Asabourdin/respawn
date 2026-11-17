/**
 * Providers, model choice, per-task settings and the cost model.
 *
 * Budget (docs/GAME_DESIGN.md §10): about €95 for the first players. The narrator runs on every
 * scene, so it gets a cheap, fast model; the 2-3 "finale" calls per life (surprise offer, startup,
 * epitaph) get a stronger model. Everything is overridable with env vars (docs/AI.md).
 *
 * Provider: RESPAWN_AI_PROVIDER = anthropic | gemini | auto (default auto: Anthropic when
 * ANTHROPIC_API_KEY is set, else Gemini when GEMINI_API_KEY is set). Claude is the production path.
 */
import { getEnv, type EnvReader } from '../env.js'

export const TASKS = ['narrate', 'event', 'surprise', 'startup', 'epitaph'] as const
export type Task = (typeof TASKS)[number]

export function isTask(value: string): value is Task {
  return (TASKS as readonly string[]).includes(value)
}

export type Tier = 'narrator' | 'finale'
export function tierOf(task: Task): Tier {
  return task === 'narrate' || task === 'event' ? 'narrator' : 'finale'
}

export type ProviderName = 'anthropic' | 'gemini'

export type ProviderChoice =
  | { ok: true; provider: ProviderName; apiKey: string }
  | { ok: false; error: string }

export function chooseProvider(env: EnvReader = getEnv): ProviderChoice {
  const wanted = (env('RESPAWN_AI_PROVIDER') ?? 'auto').toLowerCase()
  const anthropicKey = env('ANTHROPIC_API_KEY')
  const geminiKey = env('GEMINI_API_KEY')
  if (wanted === 'anthropic') {
    return anthropicKey
      ? { ok: true, provider: 'anthropic', apiKey: anthropicKey }
      : { ok: false, error: 'missing ANTHROPIC_API_KEY' }
  }
  if (wanted === 'gemini') {
    return geminiKey
      ? { ok: true, provider: 'gemini', apiKey: geminiKey }
      : { ok: false, error: 'missing GEMINI_API_KEY' }
  }
  if (anthropicKey) return { ok: true, provider: 'anthropic', apiKey: anthropicKey }
  if (geminiKey) return { ok: true, provider: 'gemini', apiKey: geminiKey }
  return { ok: false, error: 'missing ANTHROPIC_API_KEY (or GEMINI_API_KEY)' }
}

/** Browser-side timeouts (src/ai/client.ts mirrors these). */
export const CLIENT_TIMEOUT_MS: Record<Task, number> = {
  narrate: 3500,
  event: 6000,
  surprise: 6000,
  startup: 12000,
  epitaph: 25000,
}
const SERVER_MARGIN_MS = 400

export function upstreamTimeoutMs(task: Task): number {
  return CLIENT_TIMEOUT_MS[task] - SERVER_MARGIN_MS
}

/** Visible output budget per task (JSON included). Thinking, when on, gets extra room. */
const OUTPUT_TOKENS: Record<Task, number> = {
  narrate: 450,
  event: 500,
  surprise: 450,
  startup: 450,
  epitaph: 1100,
}

// ---------------------------------------------------------------------------
// Anthropic (claude-api skill: thinking / effort / fallback tables)
// ---------------------------------------------------------------------------

export type Effort = 'low' | 'medium' | 'high'
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high']

export const DEFAULT_NARRATOR_MODEL = 'claude-haiku-5-5'
export const DEFAULT_FINALE_MODEL = 'claude-opus-5-5'

/** Models that accept `thinking: {type: "disabled"}` at effort high or below. */
const DISABLED_THINKING_OK = new Set([
  'claude-haiku-5-5',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
])
/** Models without the `effort` parameter (it errors there). */
const NO_EFFORT = new Set(['claude-haiku-4-5', 'claude-sonnet-4-5'])
/** Models that support the server-side refusal fallback (`fallbacks: "default"`). Not Haiku 5.5. */
const SERVER_FALLBACK_OK = new Set([
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
  'claude-fable-5-2',
  'claude-fable-5-1',
])

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export function supportsDisabledThinking(model: string): boolean {
  return DISABLED_THINKING_OK.has(model)
}
export function supportsEffort(model: string): boolean {
  return !NO_EFFORT.has(model)
}
export function supportsServerFallback(model: string): boolean {
  return SERVER_FALLBACK_OK.has(model)
}

export interface AnthropicSettings {
  task: Task
  model: string
  effort: Effort
  /** 'disabled' only when the model accepts it; otherwise the thinking field is omitted (adaptive). */
  thinking: 'disabled' | 'adaptive'
  maxTokens: number
  timeoutMs: number
  /** Opt into the server-side refusal fallback (Opus 5.5 and friends only). */
  fallbacks: boolean
}

const THINKING_ROOM = 2500

function parseEffort(value: string | undefined, fallback: Effort): Effort {
  return value && (EFFORTS as readonly string[]).includes(value) ? (value as Effort) : fallback
}

export function anthropicSettings(task: Task, env: EnvReader = getEnv): AnthropicSettings {
  const narrator = tierOf(task) === 'narrator'
  const model = narrator
    ? env('RESPAWN_NARRATOR_MODEL') ?? DEFAULT_NARRATOR_MODEL
    : env('RESPAWN_FINALE_MODEL') ?? DEFAULT_FINALE_MODEL
  const effort = narrator
    ? parseEffort(env('RESPAWN_NARRATOR_EFFORT'), 'low')
    : parseEffort(env('RESPAWN_FINALE_EFFORT'), 'low')
  // Thinking off is the latency win for the narrator. Opus 5.5 can't disable thinking (400), so
  // finale calls run adaptive at low effort, which keeps the thinking short.
  const thinking = narrator && supportsDisabledThinking(model) ? 'disabled' : 'adaptive'
  return {
    task,
    model,
    effort,
    thinking,
    maxTokens: OUTPUT_TOKENS[task] + (thinking === 'adaptive' ? THINKING_ROOM : 0),
    timeoutMs: upstreamTimeoutMs(task),
    fallbacks: supportsServerFallback(model),
  }
}

// ---------------------------------------------------------------------------
// Gemini (gemini-api-dev skill + ai.google.dev "latest models" page)
// ---------------------------------------------------------------------------

export const DEFAULT_GEMINI_NARRATOR_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_GEMINI_FINALE_MODEL = 'gemini-4-hydrogen'

export type GeminiThinking = 'minimal' | 'low' | 'medium' | 'high'
const GEMINI_THINKING: readonly GeminiThinking[] = ['minimal', 'low', 'medium', 'high']

export interface GeminiSettings {
  task: Task
  model: string
  thinkingLevel: GeminiThinking
  maxOutputTokens: number
  timeoutMs: number
}

export function geminiSettings(task: Task, env: EnvReader = getEnv): GeminiSettings {
  const narrator = tierOf(task) === 'narrator'
  const model = narrator
    ? env('RESPAWN_GEMINI_NARRATOR_MODEL') ?? DEFAULT_GEMINI_NARRATOR_MODEL
    : env('RESPAWN_GEMINI_FINALE_MODEL') ?? DEFAULT_GEMINI_FINALE_MODEL
  const raw = env(narrator ? 'RESPAWN_GEMINI_NARRATOR_THINKING' : 'RESPAWN_GEMINI_FINALE_THINKING')
  const fallback: GeminiThinking = model.includes('flash-lite') ? 'minimal' : 'low'
  const thinkingLevel =
    raw && (GEMINI_THINKING as readonly string[]).includes(raw) ? (raw as GeminiThinking) : fallback
  return {
    task,
    model,
    thinkingLevel,
    maxOutputTokens: OUTPUT_TOKENS[task] + (thinkingLevel === 'minimal' ? 300 : THINKING_ROOM),
    timeoutMs: upstreamTimeoutMs(task),
  }
}

// ---------------------------------------------------------------------------
// Pricing (USD per million tokens). Anthropic: claude-api skill (cached 2026-11-03).
// Gemini: ai.google.dev latest-model page (Nov 2026); cached input priced at the full rate
// (no discount assumed) so the estimate errs high.
// ---------------------------------------------------------------------------

export interface Price {
  input: number
  output: number
  /** 5-minute cache write. */
  cacheWrite: number
  cacheRead: number
  /** Haiku 5.5 has a second rate card for prompts over 100K tokens. */
  longContext?: { thresholdTokens: number; input: number; output: number }
}

function price(input: number, output: number, cacheReadMultiplier = 0.1): Price {
  return { input, output, cacheWrite: input * 1.25, cacheRead: input * cacheReadMultiplier }
}

export const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': {
    ...price(0.1, 0.5),
    longContext: { thresholdTokens: 100_000, input: 0.5, output: 2.5 },
  },
  'claude-haiku-4-5': price(1, 5),
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  'claude-sonnet-5': price(2, 10),
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-opus-5': price(5, 25),
  'claude-opus-4-8': price(5, 25),
  'claude-fable-5-2': { input: 8, output: 40, cacheWrite: 10, cacheRead: 0.2 },
  'gemini-3.5-flash-lite': price(0.3, 2.5, 1),
  'gemini-4-hydrogen': price(1.5, 7.5, 1),
  'gemini-4-argon': price(2, 10, 1),
  'gemini-4-carbon': price(2, 10, 1),
}

/** Unknown model ids are priced like Opus 5 so the estimate errs on the expensive side. */
const UNKNOWN_PRICE = price(5, 25)

/** Normalised usage. `inputTokens` excludes cached tokens (Anthropic semantics). */
export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
}

export function priceFor(model: string): Price {
  if (PRICES[model]) return PRICES[model]
  // Tolerate prefixed ids ("anthropic.claude-haiku-5-5", "models/gemini-...").
  const key = Object.keys(PRICES).find((k) => model.endsWith(k))
  return key ? PRICES[key] : UNKNOWN_PRICE
}

export function estimateCostUsd(model: string, usage: Usage): number {
  const p = priceFor(model)
  const promptTokens = usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens
  const long = p.longContext && promptTokens > p.longContext.thresholdTokens ? p.longContext : undefined
  const inRate = long ? long.input : p.input
  const outRate = long ? long.output : p.output
  const writeRate = long ? long.input * 1.25 : p.cacheWrite
  const readRate = long ? long.input * 0.1 : p.cacheRead
  const usd =
    usage.inputTokens * inRate +
    usage.cacheWriteTokens * writeRate +
    usage.cacheReadTokens * readRate +
    usage.outputTokens * outRate
  return usd / 1_000_000
}

export function formatUsd(usd: number): string {
  return `$${usd < 0.01 ? usd.toFixed(5) : usd.toFixed(4)}`
}
