/** Step / SceneView construction for the UI (pure). */
import type { Content } from '../content/schema'
import { cloneState } from './clone'
import { evaluate } from './conditions'
import { getScene, getSlot, indexContent } from './contentIndex'
import { currentChoices } from './dynamic'
import { makeEnv } from './planet'
import { AI_EVENT_PREFIX, resolveNextMut } from './scheduler'
import { fillText } from './text'
import type { ChoiceView, GameState, SceneView, Step } from './types'

export function aiEventTemplates(content: Content) {
  const surprise = new Set(content.constants.surpriseOfferTemplateIds)
  const events = content.aiTemplates.filter((t) => !surprise.has(t.id))
  return events.length > 0 ? events : content.aiTemplates
}

function fillChoices(content: Content, state: GameState, choices: ChoiceView[]): ChoiceView[] {
  return choices.map((c) => ({
    ...c,
    label: fillText(content, state, c.label),
    ...(c.hint !== undefined ? { hint: fillText(content, state, c.hint) } : {}),
    ...(c.lockedReason !== undefined ? { lockedReason: fillText(content, state, c.lockedReason) } : {}),
  }))
}

/** Ages can be fractional (content orders scenes with 20.4, 22.1…); views show whole years. */
export function displayAge(age: number): number {
  return Math.floor(age + 1e-9)
}

export function majorCount(content: Content): number {
  return indexContent(content).majors.length
}

/** SceneView of the pending scene (throws if the pending step is an unresolved AI slot). */
export function buildSceneView(content: Content, state: GameState): SceneView {
  const p = state.pending
  if (!p) throw new Error('[engine] No pending scene (call resolveNext first)')
  const count = majorCount(content)
  if (p.aiDraft && p.aiSlotId) {
    const slot = getSlot(content, p.aiSlotId)
    return {
      id: p.sceneId,
      kind: 'event',
      phase: slot.phase,
      age: displayAge(state.age),
      majorCount: count,
      title: p.aiDraft.title,
      text: p.aiDraft.text,
      narrate: false,
      choices: fillChoices(content, state, currentChoices(content, state)),
      isFollowUp: false,
      isAiEvent: true,
    }
  }
  if (p.sceneId.startsWith(AI_EVENT_PREFIX) || !indexContent(content).scenes.has(p.sceneId)) {
    throw new Error(`[engine] Pending step "${p.sceneId}" is not a scene`)
  }
  const scene = getScene(content, p.sceneId)
  const env = makeEnv(content, state)
  const variant = scene.variants?.find((v) => v.text !== undefined && evaluate(v.conditions, env))
  const view: SceneView = {
    id: scene.id,
    kind: scene.kind,
    phase: scene.phase,
    age: displayAge(state.age),
    majorCount: count,
    title: fillText(content, state, scene.title),
    text: fillText(content, state, variant?.text ?? scene.text),
    narrate: scene.ai?.narrate ?? true,
    choices: fillChoices(content, state, currentChoices(content, state)),
    isFollowUp: scene.followUpOnly === true && p.aiSlotId === undefined,
    isAiEvent: false,
  }
  if (scene.kind === 'major' && scene.order !== undefined && !scene.followUpOnly) view.majorIndex = scene.order
  if (scene.speaker !== undefined) view.speaker = scene.speaker
  if (scene.art !== undefined) view.art = scene.art
  if (scene.ai?.tone !== undefined) view.tone = scene.ai.tone
  if (scene.ai?.hints !== undefined) view.hints = scene.ai.hints.map((h) => fillText(content, state, h))
  return view
}

export function stepOf(content: Content, state: GameState): Step {
  if (state.ended) return { type: 'end' }
  const p = state.pending
  if (!p) return { type: 'end' }
  if (p.aiSlotId && !p.aiDraft && !indexContent(content).scenes.has(p.sceneId)) {
    return { type: 'ai_slot', slotId: p.aiSlotId, age: displayAge(state.age), templates: aiEventTemplates(content) }
  }
  return { type: 'scene', scene: buildSceneView(content, state) }
}

/** Pure: the pending step, or the step resolveNext would produce. */
export function getStep(content: Content, state: GameState): Step {
  if (state.ended) return { type: 'end' }
  if (state.pending) return stepOf(content, state)
  const draft = cloneState(state)
  resolveNextMut(content, draft)
  return stepOf(content, draft)
}
