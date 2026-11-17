/** AI injection points: generated events, the C11 surprise offer, startup metadata. All validated. */
import type { Content } from '../content/schema'
import type { PendingX } from './clone'
import { cloneState } from './clone'
import { getScene, getSlot, indexContent } from './contentIndex'
import { SURPRISE_CHOICE_ID } from './dynamic'
import { addUnique } from './effects'
import { evaluate } from './conditions'
import { makeEnv } from './planet'
import { AI_EVENT_PREFIX, makePending } from './scheduler'
import type { AiEventDraft, GameState, StartupState, SurpriseOfferDraft } from './types'
import { aiEventTemplates } from './views'

const MAX_TITLE = 120
const MAX_TEXT = 1200
const MAX_LABEL = 80

function cleanString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (s.length === 0 || s.length > max) return undefined
  return s
}

/** Returns a sanitised copy of the draft, or null when invalid. */
export function validateAiDraft(content: Content, draft: AiEventDraft | null | undefined): AiEventDraft | null {
  if (!draft || typeof draft !== 'object') return null
  const title = cleanString(draft.title, MAX_TITLE)
  const text = cleanString(draft.text, MAX_TEXT)
  if (!title || !text || !Array.isArray(draft.choices)) return null
  if (draft.choices.length < 2 || draft.choices.length > 3) return null
  const allowed = new Set(aiEventTemplates(content).map((t) => t.id))
  const choices: AiEventDraft['choices'] = []
  for (const c of draft.choices) {
    if (!c || typeof c !== 'object') return null
    const label = cleanString(c.label, MAX_LABEL)
    if (!label || typeof c.templateId !== 'string' || !allowed.has(c.templateId)) return null
    choices.push({ label, templateId: c.templateId })
  }
  return { title, text, choices }
}

export function injectAiEventMut(
  content: Content,
  state: GameState,
  slotId: string,
  draft: AiEventDraft | null,
): void {
  const p = state.pending
  const ix = indexContent(content)
  if (!p || p.aiSlotId !== slotId || p.aiDraft || ix.scenes.has(p.sceneId))
    throw new Error(`[engine] injectAiEvent: AI slot "${slotId}" is not the pending step`)
  const slot = getSlot(content, slotId)
  addUnique(state.aiSlotsUsed, slotId)
  const valid = validateAiDraft(content, draft)
  if (valid) {
    state.pending = {
      sceneId: AI_EVENT_PREFIX + slotId,
      aiSlotId: slotId,
      aiDraft: valid,
      dynamicChoices: valid.choices.map((c, i) => ({ id: `ai_${i}`, label: c.label, locked: false })),
    }
  } else {
    makePending(content, state, slot.fallbackSceneId, { aiSlotId: slotId })
  }
}

export function injectAiEvent(
  content: Content,
  state: GameState,
  slotId: string,
  draft: AiEventDraft | null,
): GameState {
  const next = cloneState(state)
  injectAiEventMut(content, next, slotId, draft)
  return next
}

/** Validates the offer for the pending job-offers scene. Returns the sanitised draft or null. */
export function validateSurpriseOffer(
  content: Content,
  state: GameState,
  offer: SurpriseOfferDraft | null | undefined,
): SurpriseOfferDraft | null {
  const p = state.pending as PendingX | undefined
  if (!p || p.aiDraft || !offer || typeof offer !== 'object') return null
  const ix = indexContent(content)
  if (!ix.scenes.has(p.sceneId)) return null
  const scene = getScene(content, p.sceneId)
  if (scene.dynamic?.type !== 'jobOffers' || !scene.dynamic.aiSurprise) return null
  if (p.surpriseOffer || p.dynamicChoices?.some((c) => c.id === SURPRISE_CHOICE_ID)) return null
  const employerName = cleanString(offer.employerName, 60)
  const tagline = cleanString(offer.tagline, 160) ?? ''
  const pitch = cleanString(offer.pitch, 600) ?? ''
  if (!employerName) return null
  const path = typeof offer.pathId === 'string' ? ix.paths.get(offer.pathId) : undefined
  if (!path || state.bannedFields.includes(path.field)) return null
  // The AI can't open a career the player isn't qualified for: at least one employer of that path must be reachable.
  const env = makeEnv(content, state)
  const employers = content.employers.filter((e) => e.pathId === path.id)
  if (employers.length > 0 && !employers.some((e) => evaluate(e.conditions, env))) return null
  if (!content.constants.surpriseOfferTemplateIds.includes(offer.templateId) || !ix.templates.has(offer.templateId))
    return null
  return { employerName, tagline, pathId: path.id, templateId: offer.templateId, pitch }
}

export function injectSurpriseOffer(
  content: Content,
  state: GameState,
  offer: SurpriseOfferDraft | null,
): GameState {
  const next = cloneState(state)
  const valid = validateSurpriseOffer(content, next, offer)
  if (!valid) return next
  const p = next.pending as PendingX
  const scene = getScene(content, p.sceneId)
  const statics = new Set(scene.choices.map((c) => c.id))
  const list = (p.dynamicChoices ?? []).slice()
  const at = list.findIndex((c) => statics.has(c.id))
  const view = {
    id: SURPRISE_CHOICE_ID,
    label: valid.employerName,
    ...(valid.tagline ? { hint: valid.tagline } : {}),
    locked: false,
  }
  if (at === -1) list.push(view)
  else list.splice(at, 0, view)
  p.dynamicChoices = list
  p.surpriseOffer = valid
  return next
}

const META_KEYS = ['name', 'product', 'pitch', 'investor', 'rival'] as const

export function setStartupMeta(state: GameState, meta: Partial<StartupState>): GameState {
  const next = cloneState(state)
  if (!meta || typeof meta !== 'object') return next
  const base: StartupState | undefined =
    next.startup ?? (typeof meta.sectorId === 'string' ? { sectorId: meta.sectorId } : undefined)
  if (!base) return next
  const merged: StartupState = { ...base }
  for (const k of META_KEYS) {
    const v = cleanString(meta[k], 600)
    if (v !== undefined) merged[k] = v
  }
  next.startup = merged
  return next
}
