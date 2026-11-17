/** Respawn: restore a past decision point and replay deterministically. */
import type { Content } from '../content/schema'
import { cloneState, restore } from './clone'
import { chooseMut } from './choose'
import { indexContent } from './contentIndex'
import { currentChoices } from './dynamic'
import { injectAiEventMut, injectSurpriseOffer } from './ai'
import { resolveNextMut } from './scheduler'
import { summarize } from './summary'
import type { AiEventDraft, ChoiceView, EndSummary, GameState, SurpriseOfferDraft } from './types'

const MAX_STEPS = 1000

export function respawnFrom(content: Content, state: GameState, historyIndex: number): GameState {
  void content
  const h = state.history[historyIndex]
  if (!h) throw new Error(`[engine] respawnFrom: no history entry at index ${historyIndex}`)
  return restore(h.before, state.history.slice(0, historyIndex))
}

export type Picker = (state: GameState, choices: ChoiceView[]) => string

/**
 * Plays a draft to the end (mutating). AI slots use the content fallback; no surprise offer.
 * `pick` receives the unlocked-and-locked choice list and returns a choice id.
 */
export interface Replay {
  /** AI event drafts by slot id, so the alternate life meets the same AI events. */
  drafts?: Map<string, AiEventDraft>
  /** Surprise offers by job-offers scene id. */
  surprises?: Map<string, SurpriseOfferDraft>
}

export function autoPlayMut(content: Content, state: GameState, pick: Picker, replay: Replay = {}): void {
  const ix = indexContent(content)
  for (let step = 0; step < MAX_STEPS; step++) {
    resolveNextMut(content, state)
    if (state.ended) return
    const p = state.pending!
    if (p.aiSlotId && !p.aiDraft && !ix.scenes.has(p.sceneId)) {
      injectAiEventMut(content, state, p.aiSlotId, replay.drafts?.get(p.aiSlotId) ?? null)
      continue
    }
    const offer = replay.surprises?.get(p.sceneId)
    if (offer && !p.surpriseOffer) Object.assign(state, injectSurpriseOffer(content, state, offer))
    const choices = currentChoices(content, state)
    if (!choices.some((c) => !c.locked))
      throw new Error(`[engine] Scene "${p.sceneId}" has no unlocked choice at age ${state.age}`)
    chooseMut(content, state, pick(state, choices))
  }
  throw new Error('[engine] autoPlay did not reach the end (step guard)')
}

export function firstUnlocked(choices: ChoiceView[]): string {
  const c = choices.find((x) => !x.locked)
  if (!c) throw new Error('[engine] No unlocked choice')
  return c.id
}

export function respawnSimulate(
  content: Content,
  state: GameState,
  historyIndex: number,
  altChoiceId: string,
): { state: GameState; summary: EndSummary } {
  const draft = cloneState(respawnFrom(content, state, historyIndex))
  chooseMut(content, draft, altChoiceId)
  const recorded = new Map<string, string[]>()
  const replay: Required<Replay> = { drafts: new Map(), surprises: new Map() }
  for (const h of state.history) {
    const bp = h.before.pending
    if (bp?.aiSlotId && bp.aiDraft) replay.drafts.set(bp.aiSlotId, bp.aiDraft)
    if (bp?.surpriseOffer) replay.surprises.set(bp.sceneId, bp.surpriseOffer)
  }
  for (const h of state.history.slice(historyIndex + 1)) {
    const q = recorded.get(h.sceneId)
    if (q) q.push(h.choiceId)
    else recorded.set(h.sceneId, [h.choiceId])
  }
  autoPlayMut(content, draft, (s, choices) => {
    const want = recorded.get(s.pending!.sceneId)?.shift()
    if (want !== undefined && choices.some((c) => c.id === want && !c.locked)) return want
    return firstUnlocked(choices)
  }, replay)
  return { state: draft, summary: summarize(content, draft) }
}
