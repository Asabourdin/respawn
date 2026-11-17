/** Test helpers to drive lives through the public API. */
import type { Content } from '../../content/schema'
import { engine } from '../index'
import type { GameState, SceneView, Step } from '../types'

export type Plan = Record<string, string | undefined>

/** Resolves and returns the current scene (fails if the step is not a scene). */
export function sceneOf(content: Content, state: GameState): SceneView {
  const step = engine.getStep(content, state)
  if (step.type !== 'scene') throw new Error(`expected a scene, got ${step.type}`)
  return step.scene
}

/**
 * Plays from `state` (resolving first) until `stop(step, state)` is true or the life ends.
 * Picks plan[sceneId] when given (and unlocked), else the first unlocked choice. AI slots → null.
 */
export function playUntil(
  content: Content,
  state: GameState,
  plan: Plan = {},
  stop: (step: Step, state: GameState) => boolean = () => false,
  maxSteps = 500,
): GameState {
  let s = engine.resolveNext(content, state)
  for (let i = 0; i < maxSteps; i++) {
    const step = engine.getStep(content, s)
    if (stop(step, s) || step.type === 'end') return s
    if (step.type === 'ai_slot') {
      s = engine.resolveNext(content, engine.injectAiEvent(content, s, step.slotId, null))
      continue
    }
    const wanted = plan[step.scene.id]
    const choice =
      step.scene.choices.find((c) => c.id === wanted && !c.locked) ?? step.scene.choices.find((c) => !c.locked)
    if (!choice) throw new Error(`no unlocked choice in ${step.scene.id}`)
    s = engine.resolveNext(content, engine.choose(content, s, choice.id).state)
  }
  throw new Error('playUntil: too many steps')
}

/** Plays until the given scene id is pending. */
export function playToScene(content: Content, state: GameState, sceneId: string, plan: Plan = {}): GameState {
  const s = playUntil(content, state, plan, (step) => step.type === 'scene' && step.scene.id === sceneId)
  const step = engine.getStep(content, s)
  if (step.type !== 'scene' || step.scene.id !== sceneId) throw new Error(`scene ${sceneId} never became pending`)
  return s
}

/** Sequence of step ids seen while playing a whole life. */
export function stepTrace(content: Content, state: GameState, plan: Plan = {}): string[] {
  const trace: string[] = []
  playUntil(content, state, plan, (step) => {
    trace.push(step.type === 'scene' ? step.scene.id : step.type === 'ai_slot' ? `ai_slot:${step.slotId}` : 'end')
    return false
  })
  return trace
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v)
  }
  return o
}

export function variantContent(content: Content, edit: (c: Content) => void): Content {
  const c = structuredClone(content)
  edit(c)
  return c
}
