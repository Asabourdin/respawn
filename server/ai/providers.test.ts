import {
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  OverloadedError,
  RateLimitError,
} from '@anthropic-ai/sdk'
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { describe, expect, it } from 'vitest'
import { envFrom } from '../env'
import { schemaFor } from './handlers'
import { systemFor } from './prompts'
import { buildAnthropicParams, createAnthropicProvider, mapAnthropicError, type AnthropicCreate } from './providers/anthropic'
import { buildGeminiParams, createGeminiProvider, geminiUsage, mapGeminiError, type GeminiCreate } from './providers/gemini'
import type { GenerateJsonParams } from './providers/types'

const env = envFrom({})

function params(task: GenerateJsonParams['task'] = 'narrate'): GenerateJsonParams {
  return { task, tier: task === 'narrate' || task === 'event' ? 'narrator' : 'finale', system: systemFor(task), user: 'hi', schema: schemaFor(task) }
}

function message(partial: Partial<BetaMessage>): BetaMessage {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 900, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 2500 },
    ...partial,
  } as unknown as BetaMessage
}

describe('Anthropic provider', () => {
  it('narrator request: Haiku, thinking disabled, low effort, cached system blocks, json_schema, no fallbacks', () => {
    const { params: p, timeoutMs } = buildAnthropicParams(params('narrate'), env)
    expect(p.model).toBe('claude-haiku-5-5')
    expect(p.thinking).toEqual({ type: 'disabled' })
    expect(p.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } })
    expect(Array.isArray(p.system) && p.system.every((b) => b.cache_control?.type === 'ephemeral')).toBe(true)
    expect(p.fallbacks).toBeUndefined()
    expect(p.betas).toBeUndefined()
    expect(timeoutMs).toBe(3100)
  })

  it('finale request: Opus 5.5, no thinking field (adaptive), server-side fallback opted in', () => {
    const { params: p } = buildAnthropicParams(params('epitaph'), env)
    expect(p.model).toBe('claude-opus-5-5')
    expect(p.thinking).toBeUndefined()
    expect(p.fallbacks).toBe('default')
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01'])
  })

  it('reads text blocks by type (skips thinking), reports usage and cost', async () => {
    const create: AnthropicCreate = async () =>
      message({ content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: '{"a":1}', citations: null }] as BetaMessage['content'] })
    const r = await createAnthropicProvider(create, env).generateJson(params())
    expect(r).toMatchObject({ ok: true, text: '{"a":1}', usage: { inputTokens: 900, cacheReadTokens: 2500 } })
    expect(r.costUsd).toBeCloseTo((900 * 0.1 + 2500 * 0.01 + 100 * 0.5) / 1e6, 12)
  })

  it('refusal and max_tokens are failures, never parsed', async () => {
    const refusal: AnthropicCreate = async () => message({ stop_reason: 'refusal', content: [{ type: 'text', text: '{}', citations: null }] as BetaMessage['content'] })
    expect(await createAnthropicProvider(refusal, env).generateJson(params())).toMatchObject({ ok: false, reason: 'refusal' })
    const cut: AnthropicCreate = async () => message({ stop_reason: 'max_tokens' })
    expect(await createAnthropicProvider(cut, env).generateJson(params())).toMatchObject({ ok: false, reason: 'max_tokens' })
  })

  it('maps typed SDK errors to HTTP statuses', async () => {
    expect(mapAnthropicError(new APIConnectionTimeoutError()).status).toBe(504)
    expect(mapAnthropicError(new APIUserAbortError()).status).toBe(499)
    expect(mapAnthropicError(new AuthenticationError(401, {}, 'bad key', new Headers())).code).toBe('ai_misconfigured')
    const rl = mapAnthropicError(new RateLimitError(429, {}, 'slow down', new Headers({ 'retry-after': '3' })))
    expect(rl).toMatchObject({ status: 503, code: 'upstream_rate_limited', retryAfter: '3' })
    expect(mapAnthropicError(new OverloadedError(529, {}, 'overloaded', new Headers())).status).toBe(503)
    expect(mapAnthropicError(new BadRequestError(400, {}, 'bad', new Headers())).status).toBe(500)
    const failing: AnthropicCreate = async () => {
      throw new APIConnectionTimeoutError()
    }
    await expect(createAnthropicProvider(failing, env).generateJson(params())).rejects.toMatchObject({ status: 504 })
  })
})

describe('Gemini provider', () => {
  it('builds an Interactions request with JSON response_format, store false, no retries', () => {
    const { params: p, options } = buildGeminiParams(params('narrate'), env)
    expect(p).toMatchObject({
      model: 'gemini-3.5-flash-lite',
      response_format: { type: 'text', mime_type: 'application/json' },
      generation_config: { thinking_level: 'minimal' },
      store: false,
      automatic_continuation: false,
    })
    expect(p.system_instruction).toContain('only ever called "PM"')
    expect(options).toEqual({ timeout_ms: 3100, retries: { strategy: 'none' } })
  })

  it('maps usage (thought tokens billed as output, cached split out)', () => {
    expect(geminiUsage({ usage: { total_input_tokens: 3000, total_cached_tokens: 1000, total_output_tokens: 100, total_thought_tokens: 50 } })).toEqual({
      inputTokens: 2000,
      cacheReadTokens: 1000,
      cacheWriteTokens: 0,
      outputTokens: 150,
    })
  })

  it('completed → text; incomplete → max_tokens; failed → blocked; empty → empty', async () => {
    const make = (r: Awaited<ReturnType<GeminiCreate>>) => createGeminiProvider(async () => r, env).generateJson(params())
    expect(await make({ status: 'completed', output_text: '{"x":1}' })).toMatchObject({ ok: true, text: '{"x":1}' })
    expect(await make({ status: 'incomplete', output_text: '{"x"' })).toMatchObject({ ok: false, reason: 'max_tokens' })
    expect(await make({ status: 'failed' })).toMatchObject({ ok: false, reason: 'blocked' })
    expect(await make({ status: 'completed', output_text: '  ' })).toMatchObject({ ok: false, reason: 'empty' })
  })

  it('maps SDK errors by status / name', () => {
    expect(mapGeminiError(Object.assign(new Error('x'), { name: 'AuthenticationError', status: 401 })).code).toBe('ai_misconfigured')
    expect(mapGeminiError(Object.assign(new Error('x'), { name: 'RequestTimeoutError' })).status).toBe(504)
    expect(mapGeminiError(Object.assign(new Error('x'), { name: 'CreateInteractionServerError', statusCode: 429 })).status).toBe(503)
    expect(mapGeminiError(Object.assign(new Error('x'), { name: 'ConnectionError' })).status).toBe(502)
  })
})
