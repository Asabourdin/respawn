/**
 * Stat arithmetic: diminishing returns on 0–100 stats, linear for the others,
 * clamped to constants.statBounds (with safe defaults).
 */
import { DR_HIDDEN_STATS, NUMERIC_STATS, VISIBLE_STATS } from '../content/schema'
import type { Content, NumericStat, StatDelta } from '../content/schema'
import type { Arrow, Stats } from './types'

const DR_SET = new Set<NumericStat>([...VISIBLE_STATS, ...DR_HIDDEN_STATS])

const DEFAULT_BOUNDS: Record<NumericStat, [number, number]> = {
  money: [0, 100],
  happiness: [0, 100],
  social: [0, 100],
  fame: [0, 100],
  contribution: [0, 100],
  intellect: [0, 100],
  skillAi: [0, 100],
  skillBusiness: [0, 100],
  skillSoft: [0, 100],
  energy: [0, 100],
  network: [0, 100],
  grades: [0, 100],
  ethics: [-50, 50],
  addiction: [0, 100],
  tech: [0, 100],
  ai: [0, 100],
  aiLever: [-0.1, 0.05],
  screenHours: [0, 24],
  workHours: [0, 100],
}

export function isDiminishing(key: NumericStat): boolean {
  return DR_SET.has(key)
}

export function statBounds(content: Content, key: NumericStat): [number, number] {
  return content.constants.statBounds[key] ?? DEFAULT_BOUNDS[key]
}

export function clampStat(content: Content, key: NumericStat, v: number): number {
  const [lo, hi] = statBounds(content, key)
  return Math.min(hi, Math.max(lo, v))
}

/** Diminishing returns: v + d·(1 − v/100) if d > 0, v + d·(v/100) if d < 0. */
export function diminish(v: number, d: number): number {
  if (d > 0) return v + d * (1 - v / 100)
  if (d < 0) return v + d * (v / 100)
  return v
}

export function applyStatDelta(content: Content, stats: Stats, key: NumericStat, d: number): void {
  if (!Number.isFinite(d) || d === 0) return
  const v = stats[key]
  const next = isDiminishing(key) ? diminish(v, d) : v + d
  stats[key] = clampStat(content, key, next)
}

export function applyStatDeltas(content: Content, stats: Stats, delta: StatDelta | undefined, scale = 1): void {
  if (!delta) return
  for (const key of Object.keys(delta) as NumericStat[]) {
    const d = delta[key]
    if (d !== undefined) applyStatDelta(content, stats, key, d * scale)
  }
}

export function setStats(content: Content, stats: Stats, values: StatDelta | undefined): void {
  if (!values) return
  for (const key of Object.keys(values) as NumericStat[]) {
    const v = values[key]
    if (v !== undefined && Number.isFinite(v)) stats[key] = clampStat(content, key, v)
  }
}

export function startStats(content: Content): Stats {
  const out = {} as Stats
  for (const key of NUMERIC_STATS) {
    const v = content.constants.startStats[key]
    out[key] = clampStat(content, key, Number.isFinite(v) ? v : 0)
  }
  return out
}

export function statDiff(before: Stats, after: Stats): Partial<Stats> {
  const out: Partial<Stats> = {}
  for (const key of NUMERIC_STATS) {
    const d = after[key] - before[key]
    if (Math.abs(d) > 1e-9) out[key] = d
  }
  return out
}

/** Feedback arrows: |Δ| < 0.5 → 0, < 3 → ±1, < 7 → ±2, ≥ 7 → ±3. */
export function arrowFor(delta: number): Arrow {
  const a = Math.abs(delta)
  if (!(a >= 0.5)) return 0
  const mag = a < 3 ? 1 : a < 7 ? 2 : 3
  return (delta > 0 ? mag : -mag) as Arrow
}
