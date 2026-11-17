/**
 * Choice lists: static choices (visibleIf / locked) and dynamic ones
 * (assoDraw, exchange, jobOffers, startupSectors), frozen in pending.dynamicChoices.
 */
import { ASSO_CATEGORIES, EXCHANGE_TIERS } from '../content/schema'
import type { Choice, Content, Destination, Employer, Scene, StartupSector } from '../content/schema'
import type { PendingX } from './clone'
import { gradeTier, evaluate } from './conditions'
import { getScene, indexContent } from './contentIndex'
import { makeEnv } from './planet'
import { drawWithoutReplacement } from './rng'
import type { ChoiceView, GameState, SurpriseOfferDraft } from './types'

export const SURPRISE_CHOICE_ID = 'ai_surprise'
export const DEFAULT_LOCKED_REASON = 'Not available'
export const TIER_ABOVE_REASON = 'Requires stronger grades'

function choiceView(content: Content, state: GameState, c: Choice, hintFallback?: string): ChoiceView {
  const locked = !evaluate(c.conditions, makeEnv(content, state))
  const hint = c.hint ?? hintFallback
  return {
    id: c.id,
    label: c.label,
    ...(hint !== undefined ? { hint } : {}),
    locked,
    ...(locked ? { lockedReason: c.lockedReason ?? DEFAULT_LOCKED_REASON } : {}),
  }
}

function visible(content: Content, state: GameState, c: Choice): boolean {
  return evaluate(c.visibleIf, makeEnv(content, state))
}

export function staticChoiceViews(content: Content, state: GameState, scene: Scene): ChoiceView[] {
  return scene.choices.filter((c) => visible(content, state, c)).map((c) => choiceView(content, state, c))
}

function assoDraw(content: Content, state: GameState): ChoiceView[] {
  const out: ChoiceView[] = []
  for (const category of ASSO_CATEGORIES) {
    const pool = content.assos.filter((a) => a.category === category && visible(content, state, a))
    const [pick] = drawWithoutReplacement(state, pool, 1)
    if (pick) out.push(choiceView(content, state, pick, pick.blurb))
  }
  return out
}

function destinationHint(d: Destination): string {
  return `${d.university} · ${d.city}, ${d.country}`
}

function exchangeOffers(content: Content, state: GameState, count: number, lockedAbove: number): ChoiceView[] {
  const tier = gradeTier(content, state.stats.grades)
  const tierIdx = EXCHANGE_TIERS.indexOf(tier)
  const above = tierIdx < EXCHANGE_TIERS.length - 1 ? EXCHANGE_TIERS[tierIdx + 1] : undefined
  const pool = content.destinations.filter((d) => d.tier === tier && visible(content, state, d))
  const offered = drawWithoutReplacement(state, pool, count).map((d) =>
    choiceView(content, state, d, destinationHint(d)),
  )
  if (above && lockedAbove > 0) {
    const abovePool = content.destinations.filter((d) => d.tier === above && visible(content, state, d))
    for (const d of drawWithoutReplacement(state, abovePool, lockedAbove)) {
      offered.push({
        id: d.id,
        label: d.label,
        hint: d.hint ?? destinationHint(d),
        locked: true,
        lockedReason: d.lockedReason ?? TIER_ABOVE_REASON,
      })
    }
  }
  return offered
}

export function bannedReason(field: string): string {
  return `No one in ${field} hires after the AI shock`
}

function jobOffers(
  content: Content,
  state: GameState,
  count: number,
  lockedCount: number,
  paths: string[] | undefined,
): ChoiceView[] {
  const ix = indexContent(content)
  const allowed = (e: Employer) => (paths ? paths.includes(e.pathId) : true) && ix.paths.has(e.pathId)
  const candidates = content.employers.filter(
    (e) => allowed(e) && e.id !== state.path?.employerId && visible(content, state, e),
  )
  const isBanned = (e: Employer) => state.bannedFields.includes(ix.paths.get(e.pathId)!.field)
  const eligible: Employer[] = []
  const ineligible: Employer[] = []
  for (const e of candidates) {
    if (!isBanned(e) && evaluate(e.conditions, makeEnv(content, state))) eligible.push(e)
    else ineligible.push(e)
  }
  const weight = (e: Employer) => 1 + (2 * Math.max(0, e.prestige ?? 0)) / ix.maxPrestige
  const offered: ChoiceView[] = drawWithoutReplacement(state, eligible, count, weight).map((e) => ({
    id: e.id,
    label: e.label,
    hint: e.hint ?? e.tagline,
    locked: false,
  }))
  const showcase = ineligible
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.prestige ?? 0) - (a.e.prestige ?? 0) || a.i - b.i)
    .slice(0, lockedCount)
  for (const { e } of showcase) {
    const field = ix.paths.get(e.pathId)!.field
    offered.push({
      id: e.id,
      label: e.label,
      hint: e.hint ?? e.tagline,
      locked: true,
      lockedReason: isBanned(e) ? bannedReason(field) : (e.lockedReason ?? DEFAULT_LOCKED_REASON),
    })
  }
  return offered
}

function startupChoices(content: Content, state: GameState): ChoiceView[] {
  return content.startupSectors.filter((s) => visible(content, state, s)).map((s) => choiceView(content, state, s))
}

/** Builds the frozen choice list of a dynamic scene (consumes RNG). Static choices are appended. */
export function buildDynamicChoices(content: Content, state: GameState, scene: Scene): ChoiceView[] {
  const d = scene.dynamic
  if (!d) return staticChoiceViews(content, state, scene)
  let dyn: ChoiceView[]
  switch (d.type) {
    case 'assoDraw':
      dyn = assoDraw(content, state)
      break
    case 'exchange':
      dyn = exchangeOffers(content, state, d.count, d.lockedFromTierAbove)
      break
    case 'jobOffers':
      dyn = jobOffers(content, state, d.count, d.lockedCount, d.paths)
      break
    case 'startupSectors':
      dyn = startupChoices(content, state)
      break
  }
  const seen = new Set(dyn.map((c) => c.id))
  const statics = staticChoiceViews(content, state, scene).filter((c) => !seen.has(c.id))
  return [...dyn, ...statics]
}

/** The raw (placeholders not filled) choice list of the pending step. */
export function currentChoices(content: Content, state: GameState): ChoiceView[] {
  const p = state.pending
  if (!p) return []
  if (p.dynamicChoices) return p.dynamicChoices
  if (p.aiSlotId && !p.aiDraft && !indexContent(content).scenes.has(p.sceneId)) return []
  return staticChoiceViews(content, state, getScene(content, p.sceneId))
}

export type ChoiceSource =
  | { kind: 'static'; choice: Choice }
  | { kind: 'asso'; choice: Choice }
  | { kind: 'destination'; choice: Destination }
  | { kind: 'employer'; choice: Employer }
  | { kind: 'sector'; choice: StartupSector }
  | { kind: 'surprise'; offer: SurpriseOfferDraft }
  | { kind: 'ai'; templateId: string; label: string }

/** Finds what a choice id refers to in the pending step. */
export function resolveChoiceSource(content: Content, state: GameState, choiceId: string): ChoiceSource {
  const p = state.pending as PendingX | undefined
  if (!p) throw new Error('[engine] No pending step')
  if (p.aiDraft) {
    const m = /^ai_(\d+)$/.exec(choiceId)
    const c = m ? p.aiDraft.choices[Number(m[1])] : undefined
    if (!c) throw new Error(`[engine] Unknown AI event choice "${choiceId}"`)
    return { kind: 'ai', templateId: c.templateId, label: c.label }
  }
  if (choiceId === SURPRISE_CHOICE_ID && p.surpriseOffer) return { kind: 'surprise', offer: p.surpriseOffer }
  const ix = indexContent(content)
  const scene = getScene(content, p.sceneId)
  const d = scene.dynamic
  if (d) {
    if (d.type === 'assoDraw') {
      const a = ix.assos.get(choiceId)
      if (a) return { kind: 'asso', choice: a }
    } else if (d.type === 'exchange') {
      const dest = ix.destinations.get(choiceId)
      if (dest) return { kind: 'destination', choice: dest }
    } else if (d.type === 'jobOffers') {
      const e = ix.employers.get(choiceId)
      if (e) return { kind: 'employer', choice: e }
    } else if (d.type === 'startupSectors') {
      const s = ix.sectors.get(choiceId)
      if (s) return { kind: 'sector', choice: s }
    }
  }
  const c = scene.choices.find((x) => x.id === choiceId)
  if (!c) throw new Error(`[engine] Unknown choice "${choiceId}" in scene "${scene.id}"`)
  return { kind: 'static', choice: c }
}
