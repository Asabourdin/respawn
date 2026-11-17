/**
 * One interface for every model provider, so prompts, guards, validation and the
 * forbidden-string filter are shared. A provider turns (system, user, JSON schema) into raw JSON
 * text, plus usage and a cost estimate. It never parses or validates: that happens in handlers.ts.
 */
import type { JsonSchema } from '../jsonSchema.js'
import type { ProviderName, Task, Tier, Usage } from '../models.js'
import type { SystemPrompt } from '../prompts.js'

export interface GenerateJsonParams {
  task: Task
  tier: Tier
  system: SystemPrompt
  user: string
  schema: JsonSchema
  /** Aborts the upstream call when the browser goes away. */
  signal?: AbortSignal
}

export type FailureReason =
  | 'refusal'
  | 'max_tokens'
  | 'empty'
  | 'blocked'
  | 'incomplete'
  | 'invalid_json'
  | 'invalid_output'
  | 'filtered'

export interface GenerateMeta {
  provider: ProviderName
  model: string
  usage: Usage
  costUsd: number
  ms: number
  stop: string
}

export type GenerateJsonResult =
  | ({ ok: true; text: string } & GenerateMeta)
  | ({ ok: false; reason: FailureReason } & GenerateMeta)

export interface AiProvider {
  readonly name: ProviderName
  generateJson(params: GenerateJsonParams): Promise<GenerateJsonResult>
}

/** Transport / API failure, already mapped to the HTTP status this server should return. */
export class ProviderError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: string
  constructor(status: number, code: string, message: string, retryAfter?: string) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
