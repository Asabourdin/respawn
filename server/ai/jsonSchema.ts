/**
 * Zod → JSON schema for structured outputs, shared by both providers.
 *
 * Uses the Anthropic SDK's documented helper (`betaZodOutputFormat`), which already makes the
 * schema strict (additionalProperties: false, required) and moves unsupported constraints
 * (maxLength, minItems > 1, ...) into descriptions as hints. Then it inlines `$defs` and gives
 * enums an explicit `type`, which keeps the schema inside the subset Gemini accepts too.
 * Length and count limits are enforced afterwards by re-validating with the same Zod schema.
 */
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'

export type JsonSchema = Record<string, unknown>

function inline(node: unknown, defs: Record<string, unknown>, depth = 0): unknown {
  if (depth > 32) throw new Error('schema too deep (recursive schemas are not supported)')
  if (Array.isArray(node)) return node.map((n) => inline(n, defs, depth + 1))
  if (!node || typeof node !== 'object') return node
  const obj = node as Record<string, unknown>
  if (typeof obj.$ref === 'string') {
    const name = obj.$ref.replace(/^#\/\$defs\//, '')
    const target = defs[name]
    if (!target) throw new Error(`unresolved $ref ${obj.$ref}`)
    return inline(target, defs, depth + 1)
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === '$defs') continue
    out[k] = inline(v, defs, depth + 1)
  }
  if (Array.isArray(out.enum) && out.type === undefined && out.enum.every((v) => typeof v === 'string')) {
    out.type = 'string'
  }
  return out
}

export function toJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = betaZodOutputFormat(schema).schema as JsonSchema
  const defs = (raw.$defs as Record<string, unknown> | undefined) ?? {}
  return inline(raw, defs) as JsonSchema
}
