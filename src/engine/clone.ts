/**
 * Fast structural clone of a GameState. History entries are immutable once recorded,
 * so they are shared by reference (only the array is copied).
 */
import type { GameState, HistoryEntry, Pending, SurpriseOfferDraft } from './types'

/** Internal extension of Pending (kept as an extra field; survives JSON/structuredClone). */
export interface PendingX extends Pending {
  surpriseOffer?: SurpriseOfferDraft
}

export function clonePending(p: Pending | undefined): Pending | undefined {
  if (!p) return undefined
  const px = p as PendingX
  const out: PendingX = { ...px }
  if (px.dynamicChoices) out.dynamicChoices = px.dynamicChoices.map((c) => ({ ...c }))
  if (px.aiDraft) out.aiDraft = { ...px.aiDraft, choices: px.aiDraft.choices.map((c) => ({ ...c })) }
  if (px.surpriseOffer) out.surpriseOffer = { ...px.surpriseOffer }
  return out
}

export function cloneCore(s: Omit<GameState, 'history'>): Omit<GameState, 'history'> {
  return {
    ...s,
    player: { ...s.player, profile: { ...s.player.profile } },
    stats: { ...s.stats },
    flags: s.flags.slice(),
    path: s.path ? { ...s.path } : undefined,
    pathHistory: s.pathHistory.map((p) => ({ ...p })),
    bannedFields: s.bannedFields.slice(),
    footprint: {
      ...s.footprint,
      modifiers: s.footprint.modifiers.map((m) => ({ ...m })),
      oneOffs: s.footprint.oneOffs.map((o) => ({ ...o })),
    },
    done: s.done.slice(),
    skipped: s.skipped.slice(),
    fired: s.fired.map((f) => ({ ...f })),
    aiSlotsUsed: s.aiSlotsUsed.slice(),
    exchange: s.exchange ? { ...s.exchange } : undefined,
    startup: s.startup ? { ...s.startup } : undefined,
    badges: s.badges.slice(),
    pending: clonePending(s.pending),
  }
}

export function cloneState(s: GameState): GameState {
  return { ...cloneCore(s), history: s.history.slice() } as GameState
}

/** Snapshot without history (for HistoryEntry.before). */
export function snapshot(s: GameState): Omit<GameState, 'history'> {
  const { history: _history, ...core } = s
  return cloneCore(core)
}

export function restore(before: Omit<GameState, 'history'>, history: HistoryEntry[]): GameState {
  return { ...cloneCore(before), history: history.slice() } as GameState
}
