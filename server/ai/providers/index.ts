/** Provider selection: RESPAWN_AI_PROVIDER = anthropic | gemini | auto (see models.chooseProvider). */
import { getEnv, type EnvReader } from '../../env.js'
import { chooseProvider } from '../models.js'
import { anthropicCreateFor, createAnthropicProvider } from './anthropic.js'
import { createGeminiProvider, geminiCreateFor } from './gemini.js'
import type { AiProvider } from './types.js'

export type ProviderResolution = { ok: true; provider: AiProvider } | { ok: false; error: string }

export function resolveProvider(env: EnvReader = getEnv): ProviderResolution {
  const choice = chooseProvider(env)
  if (!choice.ok) return choice
  const provider =
    choice.provider === 'anthropic'
      ? createAnthropicProvider(anthropicCreateFor(choice.apiKey), env)
      : createGeminiProvider(geminiCreateFor(choice.apiKey), env)
  return { ok: true, provider }
}

export type { AiProvider } from './types.js'
