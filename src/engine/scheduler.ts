/**
 * resolveNext (ENGINE_SEMANTICS "Life flow" step 2):
 *   1. follow-up (already made pending by choose)
 *   2. consequence events whose conditions hold (roll p)
 *   3. earliest timed item: next major, minis, pre-rolled windowed events, AI slots
 *      (ties at the same age: events, minis, AI slots, then the major)
 *   4. no major left → advance to death, end.
 */
import type { Content, Scene } from '../content/schema'
import { evaluate } from './conditions'
import { getScene, indexContent } from './contentIndex'
import type { PreRoll } from './contentIndex'
import { buildDynamicChoices } from './dynamic'
import { lifespanFor, makeEnv } from './planet'
import { hashString, mulberry32, rand } from './rng'
import { advanceTo } from './time'
import type { GameState, Pending } from './types'

const EPS = 1e-9
const MAX_ITERATIONS = 2000
export const AI_SLOT_PREFIX = 'ai_slot:'
export const AI_EVENT_PREFIX = 'ai:'
const DEFAULT_COOLDOWN = 5

/** Window pre-roll for an event, derived from the life seed (stable, no stored state). */
export function preRoll(content: Content, seed: number, scene: Scene): PreRoll {
  const ix = indexContent(content)
  let perSeed = ix.preRolls.get(seed)
  if (!perSeed) {
    if (ix.preRolls.size > 2048) ix.preRolls.clear()
    perSeed = new Map()
    ix.preRolls.set(seed, perSeed)
  }
  const hit = perSeed.get(scene.id)
  if (hit) return hit
  const [w0, w1] = scene.window ?? [scene.age ?? 0, scene.age ?? 0]
  const a = mulberry32(hashString(`${seed >>> 0}:${scene.id}`))
  const b = mulberry32(a.state)
  const fires = a.value < (scene.p ?? 1)
  const lo = Math.min(w0, w1)
  const hi = Math.max(w0, w1)
  const integer = Number.isInteger(lo) && Number.isInteger(hi)
  const fireAge = integer ? Math.min(hi, lo + Math.floor(b.value * (hi - lo + 1))) : lo + b.value * (hi - lo)
  const roll = { fires, fireAge }
  perSeed.set(scene.id, roll)
  return roll
}

/** Makes a scene the pending step (builds and freezes dynamic choices). Majors set the phase. */
export function makePending(content: Content, state: GameState, sceneId: string, extra?: Partial<Pending>): void {
  const scene = getScene(content, sceneId)
  const pending: Pending = { sceneId, ...extra }
  if (scene.dynamic) pending.dynamicChoices = buildDynamicChoices(content, state, scene)
  if (scene.kind === 'major') state.phase = scene.phase
  state.pending = pending
}

function lastFiredAge(state: GameState, id: string): number | undefined {
  let age: number | undefined
  for (const f of state.fired) if (f.id === id) age = f.age
  return age
}

function pickConsequence(content: Content, state: GameState): Scene | undefined {
  const ix = indexContent(content)
  for (const ev of ix.consequenceEvents) {
    if (ev.window && (state.age < ev.window[0] - EPS || state.age > ev.window[1] + EPS)) continue
    if (state.skipped.includes(ev.id)) continue
    const last = lastFiredAge(state, ev.id)
    if (last !== undefined || state.done.includes(ev.id)) {
      if (!ev.repeatable) continue
      const cooldown = Math.max(1, ev.cooldownYears ?? DEFAULT_COOLDOWN)
      if (last !== undefined && state.age - last < cooldown - EPS) continue
    }
    if (!evaluate(ev.conditions, makeEnv(content, state))) continue
    const p = ev.p ?? 1
    if (p >= 1 || rand(state) < p) return ev
  }
  return undefined
}

type Timed =
  | { kind: 'event' | 'mini' | 'major'; age: number; rank: number; order: number; idx: number; scene: Scene }
  | { kind: 'ai'; age: number; rank: number; order: number; idx: number; slotId: string }

const RANK = { event: 0, mini: 1, ai: 2, major: 3 } as const

export function nextMajor(content: Content, state: GameState): Scene | undefined {
  return indexContent(content).majors.find((m) => !state.done.includes(m.id) && !state.skipped.includes(m.id))
}

function earliestTimed(content: Content, state: GameState, major: Scene): Timed {
  const ix = indexContent(content)
  const now = state.age
  const eff = (age: number | undefined) => Math.max(age ?? now, now)
  const order = (s: Scene) => ix.sceneOrder.get(s.id) ?? 0
  let best: Timed = {
    kind: 'major',
    age: eff(major.age),
    rank: RANK.major,
    order: major.order ?? 0,
    idx: order(major),
    scene: major,
  }
  const better = (c: Timed) =>
    c.age < best.age - EPS ||
    (Math.abs(c.age - best.age) <= EPS &&
      (c.rank < best.rank || (c.rank === best.rank && (c.order < best.order || (c.order === best.order && c.idx < best.idx)))))
  const consider = (c: Timed) => {
    if (better(c)) best = c
  }
  for (const m of ix.minis) {
    if (state.done.includes(m.id) || state.skipped.includes(m.id)) continue
    consider({ kind: 'mini', age: eff(m.age), rank: RANK.mini, order: m.order ?? 0, idx: order(m), scene: m })
  }
  for (const ev of ix.timedEvents) {
    if (state.done.includes(ev.id) || state.skipped.includes(ev.id)) continue
    if (state.fired.some((f) => f.id === ev.id)) continue
    const roll = preRoll(content, state.seed, ev)
    if (!roll.fires) continue
    consider({ kind: 'event', age: eff(roll.fireAge), rank: RANK.event, order: ev.order ?? 0, idx: order(ev), scene: ev })
  }
  content.constants.aiEventSlots.forEach((slot, i) => {
    if (state.aiSlotsUsed.includes(slot.id)) return
    consider({ kind: 'ai', age: eff(slot.age), rank: RANK.ai, order: 0, idx: i, slotId: slot.id })
  })
  return best
}

/** A pseudo-major at the projected death age, so timed items before death still get scheduled. */
function deathBoundary(content: Content, state: GameState): Scene {
  const lifespan = lifespanFor(content, state.stats, state.grindYears, state.player.gender)
  const age = Math.max(Math.round(lifespan), Math.ceil(state.age - EPS))
  return { id: '__death__', kind: 'major', phase: state.phase, age, order: 9999, title: '', text: '', choices: [] } as Scene
}

/** Advances to the death age and ends the life. */
export function endLife(content: Content, state: GameState): void {
  const lifespan = lifespanFor(content, state.stats, state.grindYears, state.player.gender)
  const deathAge = Math.max(Math.round(lifespan), Math.ceil(state.age - EPS))
  advanceTo(content, state, deathAge)
  state.deathAge = deathAge
  state.ended = true
  state.pending = undefined
}

/** Mutating resolveNext on a draft. */
export function resolveNextMut(content: Content, state: GameState): void {
  if (state.ended || state.pending) return
  for (let guard = 0; guard < MAX_ITERATIONS; guard++) {
    const consequence = pickConsequence(content, state)
    if (consequence) {
      makePending(content, state, consequence.id)
      return
    }
    const major = nextMajor(content, state)
    // After the last major, late events (e.g. old-age heatwaves) can still happen before death.
    const boundary = major ?? deathBoundary(content, state)
    const item = earliestTimed(content, state, boundary)
    if (!major && item.kind === 'major') {
      endLife(content, state)
      return
    }
    if (item.age > state.age + EPS) {
      advanceTo(content, state, item.age)
      continue // re-check consequence events at the new age
    }
    if (item.kind === 'ai') {
      state.pending = { sceneId: AI_SLOT_PREFIX + item.slotId, aiSlotId: item.slotId }
      return
    }
    const scene = item.scene
    const ok = evaluate(scene.conditions, makeEnv(content, state))
    if (!ok) {
      state.skipped.push(scene.id)
      continue
    }
    if (item.kind === 'mini') {
      const p = scene.p ?? 1
      if (p < 1 && rand(state) >= p) {
        state.skipped.push(scene.id)
        continue
      }
    }
    makePending(content, state, scene.id)
    return
  }
  throw new Error('[engine] resolveNext did not find a step (iteration guard)')
}
