/**
 * Gemini provider (testing / backup). SDK usage follows the gemini-api-dev skill and the
 * installed @google/genai types: Interactions API (`client.interactions.create`), JSON output via
 * `response_format: { type: 'text', mime_type: 'application/json', schema }`, read
 * `output_text`, `store: false` (nothing kept server-side), no automatic continuation, no SDK
 * retries. minLength/maxLength are ignored by Gemini's constrained decoding: Zod re-validates.
 */
import { GoogleGenAI } from '@google/genai'
import { getEnv, type EnvReader } from '../../env.js'
import { estimateCostUsd, geminiSettings, type GeminiThinking, type Usage } from '../models.js'
import type { JsonSchema } from '../jsonSchema.js'
import { ProviderError, type AiProvider, type GenerateJsonParams, type GenerateJsonResult } from './types.js'

export interface GeminiParams {
  model: string
  input: string
  system_instruction: string
  response_format: { type: 'text'; mime_type: 'application/json'; schema: JsonSchema }
  generation_config: { max_output_tokens: number; thinking_level: GeminiThinking }
  store: false
  automatic_continuation: false
}

export interface GeminiOptions {
  timeout_ms: number
  retries: { strategy: 'none' }
  signal?: AbortSignal
}

/** The fields of an Interaction this provider reads (keeps tests simple). */
export interface GeminiInteractionLike {
  model?: string
  status?: string
  output_text?: string
  usage?: {
    total_input_tokens?: number
    total_output_tokens?: number
    total_thought_tokens?: number
    total_cached_tokens?: number
  }
}

export type GeminiCreate = (params: GeminiParams, options: GeminiOptions) => Promise<GeminiInteractionLike>

const clients = new Map<string, GoogleGenAI>()

export function geminiCreateFor(apiKey: string): GeminiCreate {
  let client = clients.get(apiKey)
  if (!client) {
    client = new GoogleGenAI({ apiKey })
    clients.set(apiKey, client)
  }
  const c = client
  return (params, options) => c.interactions.create({ ...params, stream: false }, options)
}

export function buildGeminiParams(p: GenerateJsonParams, env: EnvReader = getEnv): {
  params: GeminiParams
  options: Omit<GeminiOptions, 'signal'>
} {
  const s = geminiSettings(p.task, env)
  return {
    params: {
      model: s.model,
      input: p.user,
      system_instruction: `${p.system.bible}\n\n${p.system.task}`,
      response_format: { type: 'text', mime_type: 'application/json', schema: p.schema },
      generation_config: { max_output_tokens: s.maxOutputTokens, thinking_level: s.thinkingLevel },
      store: false,
      automatic_continuation: false,
    },
    options: { timeout_ms: s.timeoutMs, retries: { strategy: 'none' } },
  }
}

export function geminiUsage(i: GeminiInteractionLike): Usage {
  const u = i.usage ?? {}
  const cached = u.total_cached_tokens ?? 0
  return {
    inputTokens: Math.max(0, (u.total_input_tokens ?? 0) - cached),
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
    // Thinking tokens are billed as output.
    outputTokens: (u.total_output_tokens ?? 0) + (u.total_thought_tokens ?? 0),
  }
}

export function mapGeminiError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err
  const e = (err ?? {}) as { name?: string; status?: unknown; statusCode?: unknown; message?: string }
  const name = e.name ?? ''
  if (/Timeout/i.test(name)) return new ProviderError(504, 'upstream_timeout', 'Gemini timed out')
  if (/Abort/i.test(name)) return new ProviderError(499, 'aborted', 'request aborted')
  const status = typeof e.status === 'number' ? e.status : typeof e.statusCode === 'number' ? e.statusCode : 0
  if (!status && /Connection/i.test(name)) return new ProviderError(502, 'upstream_unreachable', 'cannot reach Gemini')
  if (status === 401 || status === 403) return new ProviderError(500, 'ai_misconfigured', 'Gemini rejected the API key')
  if (status === 429) return new ProviderError(503, 'upstream_rate_limited', 'Gemini rate limit')
  if (status === 400 || status === 404) {
    return new ProviderError(500, 'upstream_bad_request', `Gemini rejected the request: ${e.message ?? ''}`.trim())
  }
  if (status >= 500) return new ProviderError(503, 'upstream_unavailable', 'Gemini is unavailable')
  if (status) return new ProviderError(502, 'upstream_error', `Gemini error ${status}`)
  return new ProviderError(500, 'internal_error', e.message ?? 'unknown error')
}

export function createGeminiProvider(create: GeminiCreate, env: EnvReader = getEnv): AiProvider {
  return {
    name: 'gemini',
    async generateJson(p: GenerateJsonParams): Promise<GenerateJsonResult> {
      const { params, options } = buildGeminiParams(p, env)
      const started = Date.now()
      let res: GeminiInteractionLike
      try {
        res = await create(params, { ...options, signal: p.signal })
      } catch (err) {
        throw mapGeminiError(err)
      }
      const model = res.model || params.model
      const usage = geminiUsage(res)
      const meta = {
        provider: 'gemini' as const,
        model,
        usage,
        costUsd: estimateCostUsd(model, usage),
        ms: Date.now() - started,
        stop: res.status ?? 'unknown',
      }
      if (res.status === 'incomplete') return { ok: false, reason: 'max_tokens', ...meta }
      if (res.status && res.status !== 'completed') return { ok: false, reason: 'blocked', ...meta }
      const text = (res.output_text ?? '').trim()
      if (!text) return { ok: false, reason: 'empty', ...meta }
      return { ok: true, text, ...meta }
    },
  }
}
