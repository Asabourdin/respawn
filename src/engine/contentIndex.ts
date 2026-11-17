/**
 * Lookup tables built once per Content object (cached in a WeakMap).
 * Unknown ids throw descriptive errors.
 */
import type {
  AiTemplate,
  Asso,
  Character,
  Content,
  Destination,
  Employer,
  Ending,
  Fact,
  Path,
  Scene,
  StartupSector,
} from '../content/schema'

export type AiSlot = Content['constants']['aiEventSlots'][number]
export type Badge = Content['constants']['badges'][number]

export interface ContentIndex {
  scenes: Map<string, Scene>
  sceneOrder: Map<string, number>
  /** Majors that count toward the life (not followUpOnly), sorted by order. */
  majors: Scene[]
  minis: Scene[]
  /** Non-consequence events with a window (or an age): pre-rolled. */
  timedEvents: Scene[]
  /** Consequence events (condition-driven), sorted by order then content order. */
  consequenceEvents: Scene[]
  staticChoiceIds: Map<string, Set<string>>
  assos: Map<string, Asso>
  destinations: Map<string, Destination>
  paths: Map<string, Path>
  employers: Map<string, Employer>
  sectors: Map<string, StartupSector>
  templates: Map<string, AiTemplate>
  facts: Map<string, Fact>
  characters: Map<string, Character>
  /** Endings sorted by priority desc (stable). */
  endings: Ending[]
  slots: Map<string, AiSlot>
  badges: Map<string, Badge>
  maxPrestige: number
  /** Pre-rolled windowed events per seed (bounded cache). */
  preRolls: Map<number, Map<string, PreRoll>>
}

export interface PreRoll {
  fires: boolean
  fireAge: number
}

const cache = new WeakMap<Content, ContentIndex>()

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const it of items) if (!m.has(it.id)) m.set(it.id, it)
  return m
}

function sortByOrder(scenes: Scene[], order: Map<string, number>): Scene[] {
  return scenes.slice().sort((a, b) => {
    const oa = a.order ?? 0
    const ob = b.order ?? 0
    if (oa !== ob) return oa - ob
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  })
}

export function indexContent(content: Content): ContentIndex {
  const hit = cache.get(content)
  if (hit) return hit
  const scenes = byId(content.scenes)
  const sceneOrder = new Map<string, number>()
  content.scenes.forEach((s, i) => {
    if (!sceneOrder.has(s.id)) sceneOrder.set(s.id, i)
  })
  const staticChoiceIds = new Map<string, Set<string>>()
  for (const s of content.scenes) staticChoiceIds.set(s.id, new Set(s.choices.map((c) => c.id)))

  const majors = sortByOrder(
    content.scenes.filter((s) => s.kind === 'major' && !s.followUpOnly),
    sceneOrder,
  )
  const minis = sortByOrder(
    content.scenes.filter((s) => s.kind === 'mini' && !s.followUpOnly && s.age !== undefined),
    sceneOrder,
  )
  const timedEvents = sortByOrder(
    content.scenes.filter(
      (s) =>
        s.kind === 'event' &&
        !s.followUpOnly &&
        s.family !== 'consequence' &&
        (s.window !== undefined || s.age !== undefined),
    ),
    sceneOrder,
  )
  const consequenceEvents = sortByOrder(
    content.scenes.filter((s) => s.kind === 'event' && !s.followUpOnly && s.family === 'consequence'),
    sceneOrder,
  )
  const endings = content.endings
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.priority - a.e.priority || a.i - b.i)
    .map((x) => x.e)
  const maxPrestige = Math.max(1, ...content.employers.map((e) => e.prestige ?? 0))

  const ix: ContentIndex = {
    scenes,
    sceneOrder,
    majors,
    minis,
    timedEvents,
    consequenceEvents,
    staticChoiceIds,
    assos: byId(content.assos),
    destinations: byId(content.destinations),
    paths: byId(content.paths),
    employers: byId(content.employers),
    sectors: byId(content.startupSectors),
    templates: byId(content.aiTemplates),
    facts: byId(content.facts),
    characters: byId(content.characters),
    endings,
    slots: byId(content.constants.aiEventSlots),
    badges: byId(content.constants.badges),
    maxPrestige,
    preRolls: new Map(),
  }
  cache.set(content, ix)
  return ix
}

export function getScene(content: Content, id: string): Scene {
  const s = indexContent(content).scenes.get(id)
  if (!s) throw new Error(`[engine] Unknown scene id "${id}"`)
  return s
}

export function getPath(content: Content, id: string): Path {
  const p = indexContent(content).paths.get(id)
  if (!p) throw new Error(`[engine] Unknown path id "${id}"`)
  return p
}

export function getEmployer(content: Content, id: string): Employer {
  const e = indexContent(content).employers.get(id)
  if (!e) throw new Error(`[engine] Unknown employer id "${id}"`)
  return e
}

export function getTemplate(content: Content, id: string): AiTemplate {
  const t = indexContent(content).templates.get(id)
  if (!t) throw new Error(`[engine] Unknown AI template id "${id}"`)
  return t
}

export function getSlot(content: Content, id: string): AiSlot {
  const s = indexContent(content).slots.get(id)
  if (!s) throw new Error(`[engine] Unknown AI event slot id "${id}"`)
  return s
}
