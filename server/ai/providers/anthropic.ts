/**
 * Claude provider (production default). SDK usage follows the claude-api skill:
 * - structured outputs via `output_config.format` (json_schema), re-validated with Zod after;
 * - the world bible and the task block are cached with `cache_control` (512-token minimum on
 *   Haiku 5.5 / Opus 5.5; the bible alone is ~2.5K tokens);
 * - narrator: Haiku 5.5, `thinking: disabled` + effort low (allowed at effort <= high);
 * - finale: Opus 5.5, thinking can't be disabled there, so adaptive at effort low, plus the
 *   server-side refusal fallback (`fallbacks: "default"`, beta server-side-fallback-2026-07-01).
 *   Haiku 5.5 has no server-side fallback, so it never gets the parameter;
 * - `stop_reason` is checked before reading content (refusal / max_tokens => fail);
 * - typed SDK errors are mapped to HTTP statuses; no SDK retries (the game has fallbacks).
 */
import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk'
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { getEnv, type EnvReader } from '../../env.js'
import {
  anthropicSettings,
  estimateCostUsd,
  FALLBACK_BETA,
  supportsEffort,
  type Usage,
} from '../models.js'
import { ProviderError, type AiProvider, type GenerateJsonParams, type GenerateJsonResult } from './types.js'

export type AnthropicRequestOptions = NonNullable<Parameters<Anthropic['beta']['messages']['create']>[1]>
export type AnthropicCreate = (
  params: MessageCreateParamsNonStreaming,
  options: AnthropicRequestOptions,
) => Promise<BetaMessage>

const clients = new Map<string, Anthropic>()

/** Client factory (one per key). maxRetries 0: latency matters more than a retry here. */
export function anthropicCreateFor(apiKey: string): AnthropicCreate {
  let client = clients.get(apiKey)
  if (!client) {
    client = new Anthropic({ apiKey, maxRetries: 0 })
    clients.set(apiKey, client)
  }
  const c = client
  return (params, options) => c.beta.messages.create(params, options)
}

export function buildAnthropicParams(p: GenerateJsonParams, env: EnvReader = getEnv): {
  params: MessageCreateParamsNonStreaming
  timeoutMs: number
} {
  const s = anthropicSettings(p.task, env)
  const params: MessageCreateParamsNonStreaming = {
    model: s.model,
    max_tokens: s.maxTokens,
    system: [
      { type: 'text', text: p.system.bible, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: p.system.task, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: p.user }],
    output_config: {
      ...(supportsEffort(s.model) ? { effort: s.effort } : {}),
      format: { type: 'json_schema', schema: p.schema },
    },
    ...(s.thinking === 'disabled' ? { thinking: { type: 'disabled' as const } } : {}),
    ...(s.fallbacks ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
  }
  return { params, timeoutMs: s.timeoutMs }
}

export function anthropicUsage(msg: BetaMessage): Usage {
  const u = msg.usage
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
  }
}

/** Typed SDK errors → HTTP status for our clients. Most specific first. */
export function mapAnthropicError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err
  if (err instanceof APIConnectionTimeoutError) return new ProviderError(504, 'upstream_timeout', 'Claude timed out')
  if (err instanceof APIUserAbortError) return new ProviderError(499, 'aborted', 'request aborted')
  if (err instanceof APIConnectionError) return new ProviderError(502, 'upstream_unreachable', 'cannot reach Claude')
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new ProviderError(500, 'ai_misconfigured', 'Claude rejected the API key')
  }
  if (err instanceof RateLimitError) {
    return new ProviderError(503, 'upstream_rate_limited', 'Claude rate limit', err.headers?.get('retry-after') ?? undefined)
  }
  if (err instanceof NotFoundError || err instanceof BadRequestError) {
    return new ProviderError(500, 'upstream_bad_request', `Claude rejected the request: ${err.message}`)
  }
  if (err instanceof InternalServerError) {
    // Includes 529 overloaded.
    return new ProviderError(503, 'upstream_unavailable', 'Claude is overloaded or unavailable')
  }
  if (err instanceof APIError) return new ProviderError(502, 'upstream_error', `Claude error ${String(err.status)}`)
  return new ProviderError(500, 'internal_error', err instanceof Error ? err.message : 'unknown error')
}

export function createAnthropicProvider(create: AnthropicCreate, env: EnvReader = getEnv): AiProvider {
  return {
    name: 'anthropic',
    async generateJson(p: GenerateJsonParams): Promise<GenerateJsonResult> {
      const { params, timeoutMs } = buildAnthropicParams(p, env)
      const started = Date.now()
      let msg: BetaMessage
      try {
        msg = await create(params, { timeout: timeoutMs, maxRetries: 0, signal: p.signal })
      } catch (err) {
        throw mapAnthropicError(err)
      }
      const model = msg.model || params.model
      const usage = anthropicUsage(msg)
      const meta = {
        provider: 'anthropic' as const,
        model,
        usage,
        costUsd: estimateCostUsd(model, usage),
        ms: Date.now() - started,
        stop: msg.stop_reason ?? 'unknown',
      }
      // Always check stop_reason before reading content.
      if (msg.stop_reason === 'refusal') return { ok: false, reason: 'refusal', ...meta }
      if (msg.stop_reason === 'max_tokens' || msg.stop_reason === 'model_context_window_exceeded') {
        return { ok: false, reason: 'max_tokens', ...meta }
      }
      // A response can start with thinking blocks: read by type, not position.
      const text = msg.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
      if (!text) return { ok: false, reason: 'empty', ...meta }
      return { ok: true, text, ...meta }
    },
  }
}
