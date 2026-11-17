/**
 * Runtime-agnostic environment access. Works on Node (Vite dev server, Vercel, vitest, tsx)
 * and on Deno (Supabase Edge Functions). Server code reads env ONLY through this helper.
 */

export type EnvReader = (name: string) => string | undefined

interface DenoLike {
  env: { get(name: string): string | undefined }
}
interface ProcessLike {
  env: Record<string, string | undefined>
}

export const getEnv: EnvReader = (name) => {
  const g = globalThis as { Deno?: DenoLike; process?: ProcessLike }
  let value: string | undefined
  try {
    value = g.Deno ? g.Deno.env.get(name) : g.process?.env[name]
  } catch {
    // Deno without --allow-env throws; treat as unset.
    value = undefined
  }
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Build a reader from a plain object (tests, smoke tool overrides). */
export function envFrom(values: Record<string, string | undefined>, fallback?: EnvReader): EnvReader {
  return (name) => {
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      const v = values[name]?.trim()
      return v ? v : undefined
    }
    return fallback?.(name)
  }
}
