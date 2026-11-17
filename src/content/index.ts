/**
 * The parsed content bundle. Every JSON file in ./data is imported statically
 * (works in Vite, vitest and tsx), scene files are merged, and the whole bundle
 * is validated with the Zod contract in ./schema.ts.
 *
 * Authoring rules: docs/CONTENT_GUIDE.md. Linter: `npm run check-data`.
 */
import { Content } from './schema'
import type { Content as ContentT } from './schema'

import constants from './data/constants.json'
import profiles from './data/profiles.json'
import assos from './data/assos.json'
import destinations from './data/destinations.json'
import paths from './data/paths.json'
import employers from './data/employers.json'
import startupSectors from './data/startup_sectors.json'
import aiTemplates from './data/ai_templates.json'
import facts from './data/facts.json'
import endings from './data/endings.json'
import characters from './data/characters.json'

import arrival from './data/scenes/arrival.json'
import aidams12 from './data/scenes/aidams12.json'
import aidams34 from './data/scenes/aidams34.json'
import launch from './data/scenes/launch.json'
import career from './data/scenes/career.json'
import maturity from './data/scenes/maturity.json'
import oldage from './data/scenes/oldage.json'
import minis from './data/scenes/minis.json'
import events from './data/scenes/events.json'

/** Scene files in reading order (majors by phase, then minis, then events). */
export const sceneFiles: Record<string, unknown[]> = {
  arrival,
  aidams12,
  aidams34,
  launch,
  career,
  maturity,
  oldage,
  minis,
  events,
}

/** The raw, unvalidated bundle (same shape as Content), e.g. for tools/check-data.ts. */
export const rawContent = {
  constants,
  profiles,
  scenes: Object.values(sceneFiles).flat(),
  assos,
  destinations,
  paths,
  employers,
  startupSectors,
  aiTemplates,
  facts,
  endings,
  characters,
}

/** Formats the first Zod issues as "path.to.field: message" lines. */
export function formatIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[], max = 12): string {
  const lines = issues.slice(0, max).map((i) => {
    const where = i.path.map((p) => (typeof p === 'number' ? `[${p}]` : String(p))).join('.').replace(/\.\[/g, '[')
    return `  - ${where || '(root)'}: ${i.message}`
  })
  if (issues.length > max) lines.push(`  … and ${issues.length - max} more`)
  return lines.join('\n')
}

/** Validates a raw bundle. Throws an Error listing the first issues (with paths) on failure. */
export function parseContent(raw: unknown): ContentT {
  const result = Content.safeParse(raw)
  if (!result.success) {
    throw new Error(`[content] Invalid content bundle (src/content/data):\n${formatIssues(result.error.issues)}`)
  }
  return result.data
}

/** The validated content bundle used by the engine, the UI and the tools. */
export const content: ContentT = parseContent(rawContent)

export default content
