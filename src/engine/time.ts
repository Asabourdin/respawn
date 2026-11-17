/**
 * Time: yearly accrual, promotions, and skipping scenes passed during a time jump.
 */
import type { Content } from '../content/schema'
import { indexContent } from './contentIndex'
import { applyEffects, newCtx } from './effects'
import { accrueFootprint } from './footprint'
import { rand } from './rng'
import { applyStatDelta, applyStatDeltas, clampStat } from './stats'
import type { GameState } from './types'

const EPS = 1e-9
const MAX_STEPS = 400

function isGrinding(content: Content, state: GameState): boolean {
  return state.path !== undefined && state.stats.workHours >= content.constants.yearly.grindHours
}

/** Accrual for one year (or a fraction dt) starting at state.age. */
export function accrueYear(content: Content, state: GameState, dt: number): void {
  const ix = indexContent(content)
  const y = content.constants.yearly
  const s = state.stats

  // Footprint uses the state at the start of the year.
  accrueFootprint(content, state, dt)
  state.screenHoursTotal += s.screenHours * 365 * dt

  // Career path (+ employer) per-decade effects.
  if (state.path) {
    const path = ix.paths.get(state.path.pathId)
    if (path) applyStatDeltas(content, s, path.perDecade, dt / 10)
    const employer = state.path.employerId ? ix.employers.get(state.path.employerId) : undefined
    if (employer?.perDecade) applyStatDeltas(content, s, employer.perDecade, dt / 10)
  }

  // Screens (rule 1).
  if (s.screenHours > y.highScreenHours) applyStatDelta(content, s, 'happiness', y.highScreenHappiness * dt)
  else if (s.screenHours <= y.lowScreenHours) {
    applyStatDelta(content, s, 'happiness', y.lowScreenHappiness * dt)
    applyStatDelta(content, s, 'social', y.lowScreenSocial * dt)
  }

  // Grind.
  const grinding = isGrinding(content, state)
  if (grinding) {
    applyStatDelta(content, s, 'happiness', y.grindHappiness * dt)
    applyStatDelta(content, s, 'social', y.grindSocial * dt)
    state.grindYears += dt
  }

  // Social → happiness (rule 3).
  applyStatDelta(content, s, 'happiness', y.socialToHappiness * (s.social - 50) * dt)

  // Fame with heavy screens.
  if (s.fame > 80 && s.screenHours > y.highScreenHours) applyStatDelta(content, s, 'happiness', y.fameScreenPenalty * dt)

  // Energy recovers toward 70 unless grinding.
  if (!grinding && s.energy < 70) s.energy = clampStat(content, 'energy', Math.min(70, s.energy + y.energyRecovery * dt))
}

/** Promotion roll when the years in the current path cross a multiple of 10. Returns 1 if promoted. */
function maybePromote(content: Content, state: GameState, prevAge: number): number {
  if (!state.path) return 0
  const since = state.path.sinceAge
  const before = Math.floor((prevAge - since + EPS) / 10)
  const after = Math.floor((state.age - since + EPS) / 10)
  if (after <= before || after < 1) return 0
  let promoted = 0
  for (let k = before + 1; k <= after; k++) {
    if (rand(state) < state.promotionChance) {
      state.promotions += 1
      promoted += 1
      applyEffects(content, state, content.constants.promotion.effects, newCtx('promotion'))
    }
  }
  return promoted
}

/**
 * Advances time to `targetAge`, applying yearly accrual. With `jump`, majors and minis whose
 * age is passed (age < targetAge, not done/skipped, not mandatory) are skipped.
 * Returns the number of promotions that happened.
 */
export function advanceTo(content: Content, state: GameState, targetAge: number, jump = false): number {
  let promotions = 0
  let steps = 0
  while (state.age < targetAge - EPS) {
    if (++steps > MAX_STEPS) throw new Error(`[engine] advanceTo(${targetAge}) did not terminate`)
    const remaining = targetAge - state.age
    const dt = Math.min(1, remaining)
    accrueYear(content, state, dt)
    const prev = state.age
    // The last step snaps exactly to the target (ages can be fractional).
    state.age = remaining <= 1 ? targetAge : state.age + 1
    promotions += maybePromote(content, state, prev)
  }
  if (jump) skipPassed(content, state, targetAge)
  return promotions
}

export function skipPassed(content: Content, state: GameState, targetAge: number): void {
  const ix = indexContent(content)
  for (const list of [ix.majors, ix.minis]) {
    for (const scene of list) {
      if (scene.mandatory || scene.age === undefined) continue
      if (scene.age >= targetAge - EPS) continue
      if (state.done.includes(scene.id) || state.skipped.includes(scene.id)) continue
      state.skipped.push(scene.id)
    }
  }
}
