/** End summary: YOU radar, Earth 2100, receipt, top choices, ending, badges. */
import { VISIBLE_STATS } from '../content/schema'
import type { Content, Ending } from '../content/schema'
import { restore } from './clone'
import type { EndMetrics } from './conditions'
import { evaluate } from './conditions'
import { indexContent } from './contentIndex'
import { currentChoices } from './dynamic'
import { DIGITAL_LINE_LABEL } from './footprint'
import { START_AGE, computeEarth, footprintScore, lifespanFor, makeEnv, temperatureFor } from './planet'
import { fillText } from './text'
import type { EndSummary, GameState, HistoryEntry, PathState, ReceiptLine, TopChoice, YouPole } from './types'

export const PATH_CHANGE_IMPACT = 15
export const TONNE_IMPACT = 10
const FALLBACK_ENDING: Ending = {
  id: 'ordinary_legend',
  title: 'Ordinary Legend',
  description: 'A life like many others, and that is already something.',
  conditions: 'true',
  priority: 0,
}

export interface EndFigures {
  metrics: EndMetrics
  deathAge: number
  yearsLived: number
}

export function endFigures(content: Content, state: GameState): EndFigures {
  const yearsLived = Math.max(1, state.age - START_AGE)
  const F = state.footprint.lifeT / yearsLived
  const deathAge = state.deathAge ?? Math.max(state.age, Math.round(lifespanFor(content, state.stats, state.grindYears, state.player.gender)))
  return {
    metrics: {
      F,
      footprintScore: footprintScore(content, F),
      temperature: temperatureFor(content, F, state.stats.aiLever),
      lifespan: deathAge,
    },
    deathAge,
    yearsLived,
  }
}

export function pickEnding(content: Content, state: GameState, metrics: EndMetrics): Ending {
  const ix = indexContent(content)
  const env = makeEnv(content, state, { metrics })
  for (const e of ix.endings) if (evaluate(e.conditions, env)) return e
  return ix.endings[ix.endings.length - 1] ?? FALLBACK_ENDING
}

function overlap(from: number, to: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(to, hi) - Math.max(from, lo))
}

export function buildReceipt(content: Content, state: GameState, yearsLived: number): ReceiptLine[] {
  const fp = state.footprint
  const endAge = START_AGE + yearsLived
  const lines = new Map<string, ReceiptLine>()
  let digitalCovered = 0
  const add = (line: ReceiptLine) => {
    const prev = lines.get(line.label)
    if (prev) prev.t += line.t
    else lines.set(line.label, { ...line })
  }
  for (const o of fp.oneOffs) {
    add({
      label: o.label,
      category: o.category,
      t: o.t,
      ...(o.sourceSceneId !== undefined ? { sceneId: o.sourceSceneId } : {}),
      ...(o.factId !== undefined ? { factId: o.factId } : {}),
    })
    if (o.category === 'digital') digitalCovered += o.t
  }
  for (const m of fp.modifiers) {
    const t = m.tPerYear * overlap(m.fromAge, m.toAge ?? endAge, START_AGE, endAge)
    add({ label: m.label, category: m.category, t, ...(m.sourceSceneId !== undefined ? { sceneId: m.sourceSceneId } : {}) })
    if (m.category === 'digital') digitalCovered += t
  }
  add({ label: DIGITAL_LINE_LABEL, category: 'digital', t: fp.digitalT - digitalCovered })
  const sorted = [...lines.values()].filter((l) => Math.abs(l.t) > 1e-9).sort((a, b) => b.t - a.t)
  const base = content.constants.footprint.baselineTPerYear
  const years = Math.round(yearsLived * 10) / 10
  sorted.push({ label: `Just living in France (${base} t/yr × ${years} years)`, category: 'housing', t: base * yearsLived })
  return sorted
}

function sameJob(a: PathState | undefined, b: PathState | undefined): boolean {
  if (!a || !b) return a === b
  return a.pathId === b.pathId && a.employerId === b.employerId && a.employerName === b.employerName && a.sinceAge === b.sinceAge
}

/**
 * Tonnes actually caused by a recorded choice by the end of the life (one-offs dated at the choice
 * + annual modifiers it started, over the years they were really active). Falls back to the
 * planned figure recorded at choice time while the life is still running.
 */
export function realizedTonnes(state: GameState, index: number): number {
  const h = state.history[index]
  if (!state.ended) return h.tonnes
  const endAge = state.age
  let t = 0
  for (const o of state.footprint.oneOffs) if (o.sourceSceneId === h.sceneId && o.age === h.age) t += o.t
  for (const m of state.footprint.modifiers) {
    if (m.sourceSceneId !== h.sceneId || m.fromAge !== h.age) continue
    t += m.tPerYear * overlap(m.fromAge, m.toAge ?? endAge, START_AGE, endAge)
  }
  return t
}

export function impactOf(state: GameState, index: number): number {
  const h = state.history[index]
  let impact = 0
  for (const k of VISIBLE_STATS) impact += Math.abs(h.deltas[k] ?? 0)
  impact += TONNE_IMPACT * Math.abs(realizedTonnes(state, index))
  const after = state.history[index + 1]?.before.path ?? state.path
  if (!sameJob(h.before.path, after)) impact += PATH_CHANGE_IMPACT
  return impact
}

export function alternativesOf(content: Content, state: GameState, index: number): { id: string; label: string }[] {
  const h: HistoryEntry = state.history[index]
  const before = restore(h.before, state.history.slice(0, index))
  const views = currentChoices(content, before)
  const out: { id: string; label: string }[] = []
  for (const id of h.alternatives) {
    if (id === h.choiceId) continue
    const v = views.find((c) => c.id === id)
    if (v && !v.locked) out.push({ id, label: fillText(content, before, v.label) })
  }
  return out
}

export function topChoices(content: Content, state: GameState, n = 3): TopChoice[] {
  const ix = indexContent(content)
  const candidates: TopChoice[] = []
  state.history.forEach((h, i) => {
    if (h.kind !== 'major') return
    const scene = ix.scenes.get(h.sceneId)
    if (scene?.followUpOnly) return
    const alternatives = alternativesOf(content, state, i)
    if (alternatives.length === 0) return
    candidates.push({
      historyIndex: i,
      sceneId: h.sceneId,
      title: h.title,
      chosenLabel: h.label,
      age: Math.floor(h.age + 1e-9),
      impact: impactOf(state, i),
      alternatives,
    })
  })
  return candidates.sort((a, b) => b.impact - a.impact || a.historyIndex - b.historyIndex).slice(0, n)
}

export function summarize(content: Content, state: GameState): EndSummary {
  const ix = indexContent(content)
  const { metrics, deathAge, yearsLived } = endFigures(content, state)
  const fp = state.footprint
  const s = state.stats
  const earth = computeEarth(content, {
    F: metrics.F,
    aiLever: s.aiLever,
    materialsKg: fp.materialsKg,
    tech: s.tech,
    ai: s.ai,
  })
  const you = {} as Record<YouPole, number>
  for (const k of VISIBLE_STATS) you[k] = s[k]
  you.footprint = metrics.footprintScore
  const job = state.path ?? state.pathHistory[state.pathHistory.length - 1]
  const { profile: _profile, ...player } = state.player
  const summary: EndSummary = {
    name: state.player.name,
    player: { ...player },
    deathAge,
    title: pickEnding(content, state, metrics),
    you,
    earth,
    F: metrics.F,
    lifetimeT: fp.lifeT,
    frenchAverageLifetimeT: content.constants.footprint.frenchAverageT * yearsLived,
    digitalShare: fp.lifeT > 0 ? fp.digitalT / fp.lifeT : 0,
    screenYears: state.screenHoursTotal / (24 * 365),
    workT: fp.workT,
    influenceT: fp.influenceT,
    materialsT: fp.materialsKg / 1000,
    receipt: buildReceipt(content, state, yearsLived),
    topChoices: topChoices(content, state),
    badges: state.badges.flatMap((id) => {
      const b = ix.badges.get(id)
      return b ? [{ id: b.id, label: b.label, description: b.description }] : []
    }),
    stats: { ...s },
    flags: state.flags.slice(),
  }
  if (job) {
    const pathName = ix.paths.get(job.pathId)?.name ?? job.pathId
    const employerName = job.employerName ?? (job.employerId ? ix.employers.get(job.employerId)?.name : undefined)
    summary.path = employerName !== undefined ? { pathName, employerName } : { pathName }
  }
  if (state.startup) summary.startup = { ...state.startup }
  return summary
}
