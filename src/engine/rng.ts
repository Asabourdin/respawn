/**
 * Seeded randomness. The RNG state is a 32-bit unsigned integer stored in GameState.rng,
 * advanced with mulberry32. Never use Math.random in the engine.
 */

/** One mulberry32 step: returns a float in [0, 1) and the next state. */
export function mulberry32(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next }
}

/** FNV-1a 32-bit hash (stable seeds from strings). */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Draws a float in [0, 1) from a mutable holder of the RNG state (a draft GameState). */
export function rand(holder: { rng: number }): number {
  const r = mulberry32(holder.rng)
  holder.rng = r.state
  return r.value
}

/** Index of a weighted pick (weights <= 0 are never picked unless all are <= 0). */
export function pickWeightedIndex(holder: { rng: number }, weights: number[]): number {
  if (weights.length === 0) return -1
  const total = weights.reduce((a, w) => a + (w > 0 ? w : 0), 0)
  const r = rand(holder)
  if (total <= 0) return Math.min(weights.length - 1, Math.floor(r * weights.length))
  let acc = 0
  const target = r * total
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]
    if (w <= 0) continue
    acc += w
    if (target < acc) return i
  }
  // floating point edge: last positive weight
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i
  return weights.length - 1
}

/** Seeded draw of up to n items without replacement, optionally weighted. Keeps draw order. */
export function drawWithoutReplacement<T>(
  holder: { rng: number },
  items: readonly T[],
  n: number,
  weight?: (item: T) => number,
): T[] {
  const pool = items.slice()
  const out: T[] = []
  while (out.length < n && pool.length > 0) {
    const weights = pool.map((it) => (weight ? weight(it) : 1))
    const i = pickWeightedIndex(holder, weights)
    out.push(pool[i])
    pool.splice(i, 1)
  }
  return out
}
