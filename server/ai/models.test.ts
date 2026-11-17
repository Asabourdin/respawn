import { describe, expect, it } from 'vitest'
import { envFrom } from '../env'
import { anthropicSettings, chooseProvider, estimateCostUsd, geminiSettings } from './models'

describe('cost estimate', () => {
  it('prices Haiku 5.5 with cache reads and writes', () => {
    // 800 uncached in × $0.10 + 2,600 cache read × $0.01 + 0 write + 150 out × $0.50 (per MTok)
    const usd = estimateCostUsd('claude-haiku-5-5', { inputTokens: 800, cacheReadTokens: 2600, cacheWriteTokens: 0, outputTokens: 150 })
    expect(usd).toBeCloseTo((800 * 0.1 + 2600 * 0.01 + 150 * 0.5) / 1e6, 12)
  })

  it('prices Opus 5.5 cache writes at $5 and reads at $0.20 per MTok', () => {
    const usd = estimateCostUsd('claude-opus-5-5', { inputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 3000, outputTokens: 900 })
    expect(usd).toBeCloseTo((1000 * 4 + 3000 * 5 + 900 * 20) / 1e6, 12)
    expect(usd).toBeCloseTo(0.037, 6)
  })

  it('switches Haiku 5.5 to the long-context card above 100K prompt tokens', () => {
    const usd = estimateCostUsd('claude-haiku-5-5', { inputTokens: 120_000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 1000 })
    expect(usd).toBeCloseTo((120_000 * 0.5 + 1000 * 2.5) / 1e6, 12)
  })

  it('prices Gemini and errs high on unknown models', () => {
    expect(estimateCostUsd('gemini-3.5-flash-lite', { inputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 1e6 })).toBeCloseTo(2.8, 9)
    expect(estimateCostUsd('some-future-model', { inputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 })).toBe(5)
  })
})

describe('provider choice', () => {
  it('auto prefers Anthropic when its key is set', () => {
    expect(chooseProvider(envFrom({ ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g' }))).toMatchObject({ ok: true, provider: 'anthropic' })
    expect(chooseProvider(envFrom({ GEMINI_API_KEY: 'g' }))).toMatchObject({ ok: true, provider: 'gemini' })
    expect(chooseProvider(envFrom({}))).toMatchObject({ ok: false })
  })

  it('explicit provider without its key is a clean error', () => {
    expect(chooseProvider(envFrom({ RESPAWN_AI_PROVIDER: 'anthropic', GEMINI_API_KEY: 'g' }))).toEqual({ ok: false, error: 'missing ANTHROPIC_API_KEY' })
    expect(chooseProvider(envFrom({ RESPAWN_AI_PROVIDER: 'gemini', ANTHROPIC_API_KEY: 'a' }))).toEqual({ ok: false, error: 'missing GEMINI_API_KEY' })
  })
})

describe('model settings', () => {
  it('narrator: Haiku 5.5, thinking off, low effort, no fallbacks', () => {
    const s = anthropicSettings('narrate', envFrom({}))
    expect(s).toMatchObject({ model: 'claude-haiku-5-5', thinking: 'disabled', effort: 'low', fallbacks: false })
    expect(s.timeoutMs).toBeLessThan(3500)
  })

  it('finale: Opus 5.5, adaptive thinking (cannot be disabled), fallbacks on', () => {
    const s = anthropicSettings('epitaph', envFrom({}))
    expect(s).toMatchObject({ model: 'claude-opus-5-5', thinking: 'adaptive', effort: 'low', fallbacks: true })
    expect(s.maxTokens).toBeGreaterThan(2500)
  })

  it('all-Opus config keeps thinking adaptive for the narrator', () => {
    const s = anthropicSettings('narrate', envFrom({ RESPAWN_NARRATOR_MODEL: 'claude-opus-5-5' }))
    expect(s.thinking).toBe('adaptive')
  })

  it('Gemini defaults and overrides', () => {
    expect(geminiSettings('narrate', envFrom({}))).toMatchObject({ model: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal' })
    expect(geminiSettings('epitaph', envFrom({}))).toMatchObject({ model: 'gemini-4-hydrogen', thinkingLevel: 'low' })
    expect(geminiSettings('narrate', envFrom({ RESPAWN_GEMINI_NARRATOR_MODEL: 'gemini-4-hydrogen' })).model).toBe('gemini-4-hydrogen')
  })
})
