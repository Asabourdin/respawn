/**
 * Personal footprint bookkeeping (t CO2e).
 * Annual modifiers are never deleted when they end: their toAge is set, so the receipt
 * can still account for the years they were active.
 */
import type { Content, Footprint } from '../content/schema'
import type { AnnualModifier, FootprintCategory, GameState } from './types'

export const RICH_MODIFIER_ID = 'auto:rich'
export const RICH_MODIFIER_LABEL = 'Comfortable lifestyle (wealth)'
export const DIGITAL_LINE_LABEL = 'Digital life (devices, networks, video, GenAI)'
const EPS = 1e-9

export function isActive(m: AnnualModifier, age: number): boolean {
  return m.fromAge <= age + EPS && (m.toAge === undefined || age < m.toAge - EPS)
}

export function activeAnnualT(state: GameState, age: number): { total: number; digital: number } {
  let total = 0
  let digital = 0
  for (const m of state.footprint.modifiers) {
    if (!isActive(m, age)) continue
    total += m.tPerYear
    if (m.category === 'digital') digital += m.tPerYear
  }
  return { total, digital }
}

/** Devices × multiplier + networks + video delta vs the average + GenAI (t/yr). */
export function digitalTPerYear(content: Content, state: GameState): number {
  const fp = content.constants.footprint
  const video = ((state.stats.screenHours - fp.averageScreenHours) * 365 * fp.videoKgPerHour) / 1000
  return (
    fp.devicesTPerYear * state.footprint.deviceMultiplier + fp.networksTPerYear + video + state.footprint.genAiTPerYear
  )
}

/** Ends every active modifier with this id at `age` (zero-length ones are dropped). */
export function endAnnual(state: GameState, id: string, age: number): void {
  const mods = state.footprint.modifiers
  for (let i = mods.length - 1; i >= 0; i--) {
    const m = mods[i]
    if (m.id !== id) continue
    if (m.toAge !== undefined && m.toAge <= age + EPS) continue
    if (m.fromAge >= age - EPS) mods.splice(i, 1)
    else m.toAge = age
  }
}

export function addAnnual(state: GameState, mod: AnnualModifier): void {
  endAnnual(state, mod.id, mod.fromAge)
  if (mod.toAge !== undefined && mod.toAge <= mod.fromAge + EPS) return
  state.footprint.modifiers.push(mod)
}

export interface FootprintApplyResult {
  /** One-off tonnes + annual t/yr × planned years (for Respawn impact). */
  tonnes: number
}

/**
 * Applies one footprint entry. `plannedEndAge` estimates how long open-ended modifiers last
 * (only used for the "tonnes caused" figure, never for the actual accounting).
 */
export function applyFootprintEntry(
  state: GameState,
  entry: Footprint,
  sourceSceneId: string | undefined,
  plannedEndAge: number,
): FootprintApplyResult {
  const fp = state.footprint
  const age = state.age
  let tonnes = 0
  if (entry.removeAnnual) for (const id of entry.removeAnnual) endAnnual(state, id, age)
  if (entry.oneOffT !== undefined && entry.oneOffT !== 0) {
    fp.oneOffs.push({
      label: entry.label,
      category: entry.category,
      t: entry.oneOffT,
      age,
      ...(sourceSceneId !== undefined ? { sourceSceneId } : {}),
      ...(entry.factId !== undefined ? { factId: entry.factId } : {}),
    })
    fp.lifeT += entry.oneOffT
    if (entry.category === 'digital') fp.digitalT += entry.oneOffT
    tonnes += entry.oneOffT
  }
  if (entry.annual) {
    const a = entry.annual
    const toAge = a.years !== undefined ? age + a.years : a.untilAge
    addAnnual(state, {
      id: a.id,
      label: entry.label,
      category: entry.category,
      tPerYear: a.tPerYear,
      fromAge: age,
      ...(toAge !== undefined ? { toAge } : {}),
      ...(sourceSceneId !== undefined ? { sourceSceneId } : {}),
    })
    const end = toAge ?? Math.max(plannedEndAge, age)
    tonnes += a.tPerYear * Math.max(0, end - age)
  }
  if (entry.workT !== undefined) fp.workT += entry.workT
  if (entry.influenceTPerYear !== undefined) fp.influenceTPerYear = entry.influenceTPerYear
  if (entry.materialsKg !== undefined) fp.materialsKg += entry.materialsKg
  if (entry.deviceMultiplier !== undefined) fp.deviceMultiplier = entry.deviceMultiplier
  if (entry.genAiTPerYear !== undefined) fp.genAiTPerYear = entry.genAiTPerYear
  return { tonnes }
}

/** Accounts one year (or a fraction `dt`) starting at state.age. */
export function accrueFootprint(content: Content, state: GameState, dt: number): void {
  const fpc = content.constants.footprint
  const fp = state.footprint
  const age = state.age
  const rich = state.stats.money >= fpc.richThreshold && !state.flags.includes('low_carbon_comfort')
  if (rich) {
    const last = fp.modifiers.find((m) => m.id === RICH_MODIFIER_ID && m.toAge !== undefined && Math.abs(m.toAge - age) < EPS)
    if (last) last.toAge = age + dt
    else
      fp.modifiers.push({
        id: RICH_MODIFIER_ID,
        label: RICH_MODIFIER_LABEL,
        category: 'lifestyle' as FootprintCategory,
        tPerYear: fpc.richLifestyleTPerYear,
        fromAge: age,
        toAge: age + dt,
      })
  }
  // Each modifier counts for its exact overlap with [age, age + dt) (it may start or end mid-step).
  let modsT = 0
  let digitalModsT = 0
  for (const m of fp.modifiers) {
    const o = Math.min(m.toAge ?? Infinity, age + dt) - Math.max(m.fromAge, age)
    if (o <= EPS) continue
    modsT += m.tPerYear * o
    if (m.category === 'digital') digitalModsT += m.tPerYear * o
  }
  const digital = digitalTPerYear(content, state)
  fp.lifeT += (fpc.baselineTPerYear + digital) * dt + modsT
  fp.digitalT += digital * dt + digitalModsT
  fp.influenceT += fp.influenceTPerYear * dt
}
