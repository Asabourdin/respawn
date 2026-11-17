/**
 * End formulas (GAME_DESIGN §5) with constants.planet / constants.lifespan.
 * Curves: piecewise-linear interpolation, linear extrapolation beyond the ends.
 * Scores are clamped to 0–100.
 */
import type { Content } from '../content/schema'
import type { EndMetrics, EvalEnv } from './conditions'
import { activeAnnualT, digitalTPerYear } from './footprint'
import type { EarthPole, GameState, Gender, Stats } from './types'

/** F at which the footprint score hits 0 (2 t/yr = 100, 16 t/yr = 0). */
export const FOOTPRINT_ZERO_T = 16
/** Temperature (°C) that maps to planet pace 1 during play. */
export const PACE_MAX_C = 4
export const START_AGE = 18

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function interpolate(curve: readonly (readonly [number, number])[], x: number): number {
  if (curve.length === 0) return 0
  const pts = curve.slice().sort((a, b) => a[0] - b[0])
  if (pts.length === 1) return pts[0][1]
  const seg = (i: number) => {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const slope = x1 === x0 ? 0 : (y1 - y0) / (x1 - x0)
    return y0 + (x - x0) * slope
  }
  if (x <= pts[0][0]) return seg(0)
  const n = pts.length
  if (x >= pts[n - 1][0]) return seg(n - 2)
  for (let i = 0; i < n - 1; i++) if (x <= pts[i + 1][0]) return seg(i)
  return pts[n - 1][1]
}

/** 100 at `best`, 0 at `worst`, linear, clamped. */
export function scoreLinear(v: number, best: number, worst: number): number {
  if (best === worst) return v <= best ? 100 : 0
  return clamp(100 * (1 - (v - best) / (worst - best)), 0, 100)
}

export function footprintScore(content: Content, F: number): number {
  return scoreLinear(F, content.constants.footprint.targetT, FOOTPRINT_ZERO_T)
}

/** T = today + (currentPolicies − today) × (F / frenchAverage) × (1 + aiLever). */
export function temperatureFor(content: Content, F: number, aiLever: number): number {
  const p = content.constants.planet
  const avg = content.constants.footprint.frenchAverageT
  return p.todayC + (p.currentPoliciesC - p.todayC) * (F / avg) * (1 + aiLever)
}

/** Lifespan base: constants.lifespan.baseByGender for woman/man when provided, else base. */
export function lifespanBase(content: Content, gender?: Gender): number {
  const l = content.constants.lifespan
  if ((gender === 'woman' || gender === 'man') && l.baseByGender) return l.baseByGender[gender]
  return l.base
}

export function lifespanFor(
  content: Content,
  stats: Pick<Stats, 'social' | 'addiction'>,
  grindYears: number,
  gender?: Gender,
): number {
  const l = content.constants.lifespan
  const raw =
    lifespanBase(content, gender) +
    (l.socialSwing * (stats.social - 50)) / 50 -
    l.grindPenaltyPerYear * grindYears -
    (l.addictionPenalty * stats.addiction) / 100
  return clamp(raw, l.min, l.max)
}

export interface EarthResult {
  scores: Record<EarthPole, number>
  temperatureC: number
  oceanM: number
  insectsPct: number
  heatBillions: number
  techIndex: number
  aiIndex: number
}

export function computeEarth(
  content: Content,
  input: { F: number; aiLever: number; materialsKg: number; tech: number; ai: number },
): EarthResult {
  const p = content.constants.planet
  const [tBest, tWorst] = p.tempScoreRange
  const T = temperatureFor(content, input.F, input.aiLever)
  const temperature = scoreLinear(T, tBest, tWorst)

  const ocean = interpolate(p.oceanCurve, T)
  const oceanPts = p.oceanCurve.slice().sort((a, b) => a[0] - b[0])
  const oceanBest = oceanPts.length ? oceanPts[0][1] : 0
  const oceanWorst = oceanPts.length ? oceanPts[oceanPts.length - 1][1] : 1
  const oceanScore = scoreLinear(ocean, oceanBest, oceanWorst)

  const insects = interpolate(p.insectsCurve, T)
  const insectsScore = scoreLinear(insects, interpolate(p.insectsCurve, tBest), interpolate(p.insectsCurve, tWorst))
  const materialsT = input.materialsKg / 1000
  const materialsScore = clamp(100 - p.materialsPenaltyPerTonne * materialsT, 0, 100)
  const biodiversity = clamp((1 - p.materialsWeight) * insectsScore + p.materialsWeight * materialsScore, 0, 100)

  const heat = Math.max(0, p.heatBase + p.heatSlope * (T - tBest))
  const livability = scoreLinear(heat, p.heatScoreRange[0], p.heatScoreRange[1])

  const techIndex = clamp(input.tech, 0, 100)
  const aiIndex = clamp(input.ai, 0, 100)
  return {
    scores: { temperature, ocean: oceanScore, biodiversity, livability, tech: techIndex, ai: aiIndex },
    temperatureC: T,
    oceanM: ocean,
    insectsPct: Math.max(0, insects),
    heatBillions: heat,
    techIndex,
    aiIndex,
  }
}

/** Current annual footprint rate (t/yr) from the state (baseline + modifiers + digital + rich lifestyle). */
export function currentAnnualRate(content: Content, state: GameState): number {
  const fp = content.constants.footprint
  const rich = state.stats.money >= fp.richThreshold && !state.flags.includes('low_carbon_comfort')
  const hasRichMod = state.footprint.modifiers.some(
    (m) => m.id === 'auto:rich' && m.fromAge <= state.age && (m.toAge === undefined || state.age < m.toAge),
  )
  return (
    fp.baselineTPerYear +
    activeAnnualT(state, state.age).total +
    digitalTPerYear(content, state) +
    (rich && !hasRichMod ? fp.richLifestyleTPerYear : 0)
  )
}

/** F so far: lifetime life tonnes / years lived since 18 (current annual rate before the first year). */
export function currentF(content: Content, state: GameState): number {
  const years = state.age - START_AGE
  if (years >= 1) return state.footprint.lifeT / years
  return currentAnnualRate(content, state)
}

export function projectedMetrics(content: Content, state: GameState): EndMetrics {
  const F = currentF(content, state)
  return {
    F,
    footprintScore: footprintScore(content, F),
    temperature: temperatureFor(content, F, state.stats.aiLever),
    lifespan: state.deathAge ?? lifespanFor(content, state.stats, state.grindYears, state.player.gender),
  }
}

/** Condition environment with lazily projected end metrics. */
export function makeEnv(
  content: Content,
  state: GameState,
  extra?: Pick<EvalEnv, 'metrics' | 'current'>,
): EvalEnv {
  return { content, state, ...extra, project: () => projectedMetrics(content, state) }
}

/** 0 = 1.4 °C pace, 1 = ≥ 4 °C pace. */
export function planetPace(content: Content, state: GameState): number {
  const F = currentF(content, state)
  const T = temperatureFor(content, F, state.stats.aiLever)
  const today = content.constants.planet.todayC
  return clamp((T - today) / (PACE_MAX_C - today), 0, 1)
}
