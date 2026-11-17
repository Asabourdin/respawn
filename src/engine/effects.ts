/**
 * Applying Effects to a draft state, in the ENGINE_SEMANTICS order:
 * set → stats → flags/unflags → footprint → leavePath/path → promotionChance → skipScenes → badges.
 * (`years` is collected in the context; the caller performs the time jump last.)
 */
import type { Chance, Content, Effects } from '../content/schema'
import { getEmployer, getPath, indexContent } from './contentIndex'
import { addAnnual, applyFootprintEntry, endAnnual } from './footprint'
import { lifespanFor } from './planet'
import { rand } from './rng'
import { applyStatDeltas, setStats } from './stats'
import type { GameState } from './types'

/** Typical retirement age, only used to estimate tonnes caused by a career path. */
export const PLANNED_RETIREMENT_AGE = 65

export interface ApplyCtx {
  sourceSceneId?: string
  tonnes: number
  years: number
  /** Consequence lines collected (base, variants, chance). */
  texts: { text: string; priority: number }[]
  factIds: { id: string; priority: number }[]
  promoOverride?: number
  pathSet: boolean
}

export function newCtx(sourceSceneId?: string): ApplyCtx {
  return { sourceSceneId, tonnes: 0, years: 0, texts: [], factIds: [], pathSet: false }
}

export function addUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value)
}

export function leavePath(content: Content, state: GameState, aiLoss: boolean): void {
  const current = state.path
  if (!current) return
  const path = indexContent(content).paths.get(current.pathId)
  state.pathHistory.push({ ...current })
  endAnnual(state, `path:${current.pathId}`, state.age)
  if (aiLoss && path) addUnique(state.bannedFields, path.field)
  state.path = undefined
}

export function setPath(
  content: Content,
  state: GameState,
  pathId: string,
  employerId?: string,
  employerName?: string,
): void {
  const path = getPath(content, pathId)
  const employer = employerId ? getEmployer(content, employerId) : undefined
  if (state.path) leavePath(content, state, false)
  const name = employerName ?? employer?.name
  state.path = {
    pathId,
    ...(employerId !== undefined ? { employerId } : {}),
    ...(name !== undefined ? { employerName: name } : {}),
    sinceAge: state.age,
  }
  if (path.annual) {
    addAnnual(state, {
      id: `path:${pathId}`,
      label: path.annual.label,
      category: path.annual.category,
      tPerYear: path.annual.tPerYear,
      fromAge: state.age,
      sourceSceneId: undefined,
    })
  }
  state.promotionChance = path.defaultPromotionChance
}

function plannedDeathAge(content: Content, state: GameState): number {
  return lifespanFor(content, state.stats, state.grindYears, state.player.gender)
}

/**
 * Applies an Effects block. `priority` orders consequence texts / facts
 * (higher wins: chance outcome 3 > base 2 > variant 1).
 */
export function applyEffects(
  content: Content,
  state: GameState,
  effects: Effects | undefined,
  ctx: ApplyCtx,
  priority = 2,
): void {
  if (!effects) return
  const ix = indexContent(content)
  setStats(content, state.stats, effects.set)
  applyStatDeltas(content, state.stats, effects.stats)
  if (effects.flags) for (const f of effects.flags) addUnique(state.flags, f)
  if (effects.unflags) state.flags = state.flags.filter((f) => !effects.unflags!.includes(f))
  if (effects.footprint) {
    const death = plannedDeathAge(content, state)
    for (const entry of effects.footprint) {
      const r = applyFootprintEntry(state, entry, ctx.sourceSceneId, death)
      ctx.tonnes += r.tonnes
      if (entry.factId) ctx.factIds.push({ id: entry.factId, priority: priority - 0.5 })
    }
  }
  if (effects.leavePath) {
    const aiLoss = (effects.flags ?? []).some((f) => f.startsWith('ai_job_loss'))
    leavePath(content, state, aiLoss)
  }
  if (effects.path) hireOnPath(content, state, ctx, effects.path.pathId, effects.path.employerId)
  if (effects.promotionChance !== undefined) {
    state.promotionChance = effects.promotionChance
    ctx.promoOverride = effects.promotionChance
  }
  if (effects.skipScenes) {
    for (const id of effects.skipScenes) {
      if (!ix.scenes.has(id)) throw new Error(`[engine] skipScenes: unknown scene id "${id}"`)
      if (!state.done.includes(id)) addUnique(state.skipped, id)
    }
  }
  if (effects.badges) for (const b of effects.badges) addUnique(state.badges, b)
  if (effects.years) ctx.years += effects.years
  if (effects.text) ctx.texts.push({ text: effects.text, priority })
  if (effects.factId) ctx.factIds.push({ id: effects.factId, priority })
}

/** Records the tonnes of a path set outside applyEffects (employer hire, surprise offer). */
export function hireOnPath(
  content: Content,
  state: GameState,
  ctx: ApplyCtx,
  pathId: string,
  employerId?: string,
  employerName?: string,
): void {
  const before = state.path?.pathId
  setPath(content, state, pathId, employerId, employerName)
  ctx.pathSet = true
  const path = getPath(content, pathId)
  if (path.annual && before !== pathId) {
    const end = Math.min(Math.max(PLANNED_RETIREMENT_AGE, state.age), plannedDeathAge(content, state))
    ctx.tonnes += path.annual.tPerYear * Math.max(0, end - state.age)
  }
  const mod = state.footprint.modifiers.find((m) => m.id === `path:${pathId}` && m.fromAge === state.age)
  if (mod && ctx.sourceSceneId) mod.sourceSceneId = ctx.sourceSceneId
}

/** p += per × (stat − 50) / 50 for each modifier, clamped to [0.02, 0.98]. */
export function chanceP(
  state: GameState,
  p: number,
  modifiers: Chance['modifiers'] | undefined,
): number {
  let q = p
  for (const m of modifiers ?? []) q += (m.per * (state.stats[m.stat] - 50)) / 50
  return Math.min(0.98, Math.max(0.02, q))
}

/** Rolls a chance block and applies success/failure effects. */
export function rollChance(
  content: Content,
  state: GameState,
  chance: Chance,
  ctx: ApplyCtx,
): 'success' | 'failure' {
  const p = chanceP(state, chance.p, chance.modifiers)
  const ok = rand(state) < p
  applyEffects(content, state, ok ? chance.success : chance.failure, ctx, 3)
  return ok ? 'success' : 'failure'
}

/**
 * Rolls an AI template: cumulative p over the outcomes (normalised when Σp > 1;
 * when Σp < 1 the remainder means "nothing happens"). Returns the outcome index or -1.
 */
export function rollTemplate(
  content: Content,
  state: GameState,
  outcomes: { p: number; effects: Effects }[],
  ctx: ApplyCtx,
): number {
  const total = outcomes.reduce((a, o) => a + o.p, 0)
  const r = rand(state) * Math.max(1, total)
  let acc = 0
  for (let i = 0; i < outcomes.length; i++) {
    acc += outcomes[i].p
    if (r < acc) {
      applyEffects(content, state, outcomes[i].effects, ctx, 3)
      return i
    }
  }
  return -1
}
