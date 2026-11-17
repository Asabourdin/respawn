/**
 * Loads the content bundle for the tools.
 * - Always reads src/content/data/**\/*.json directly (per-file Zod validation → precise file/path issues).
 * - If src/content/index.ts exists and loads under tsx, its exported bundle is used (it defines assembly);
 *   otherwise the JSON files are assembled by file name (snake_case → camelCase key, scenes/*.json → scenes).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { Content, Scene } from '../../src/content/schema.ts'
import type { Content as ContentT } from '../../src/content/schema.ts'

export type Level = 'error' | 'warn' | 'info'
export interface Issue {
  level: Level
  where: string
  message: string
}

export const ROOT = join(import.meta.dirname, '..', '..')
export const DATA_DIR = join(ROOT, 'src', 'content', 'data')
export const INDEX_FILE = join(ROOT, 'src', 'content', 'index.ts')

const KEY_ALIASES: Record<string, keyof ContentT> = {
  constants: 'constants',
  profiles: 'profiles',
  scenes: 'scenes',
  majors: 'scenes',
  minis: 'scenes',
  events: 'scenes',
  assos: 'assos',
  associations: 'assos',
  destinations: 'destinations',
  paths: 'paths',
  employers: 'employers',
  startup_sectors: 'startupSectors',
  startupsectors: 'startupSectors',
  sectors: 'startupSectors',
  ai_templates: 'aiTemplates',
  aitemplates: 'aiTemplates',
  templates: 'aiTemplates',
  facts: 'facts',
  endings: 'endings',
  characters: 'characters',
}

export interface LoadResult {
  content?: ContentT
  raw: Record<string, unknown>
  issues: Issue[]
  source: 'index' | 'json' | 'none'
  /** Relative file path for each scene id (for messages). */
  sceneFiles: Map<string, string>
  files: string[]
  /** Parsed JSON per file (for string scans with precise locations). */
  jsonFiles: { rel: string; data: unknown }[]
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listJson(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

/** "scenes[3].choices[1].label" style path. */
export function fmtPath(path: readonly PropertyKey[]): string {
  let s = ''
  for (const p of path) s += typeof p === 'number' ? `[${p}]` : s ? `.${String(p)}` : String(p)
  return s
}

export function zodIssues(err: z.ZodError, where: string, describe?: (path: PropertyKey[]) => string): Issue[] {
  return err.issues.map((i) => ({
    level: 'error' as const,
    where: `${where}${i.path.length ? ` → ${describe ? describe(i.path) : fmtPath(i.path)}` : ''}`,
    message: i.message,
  }))
}

function keyForFile(file: string): keyof ContentT | undefined {
  const rel = relative(DATA_DIR, file)
  if (rel.split(/[\\/]/)[0] === 'scenes') return 'scenes'
  const base = basename(file, '.json').toLowerCase()
  if (KEY_ALIASES[base]) return KEY_ALIASES[base]
  if (base.startsWith('scenes') || base.startsWith('events') || base.startsWith('majors') || base.startsWith('minis'))
    return 'scenes'
  return undefined
}

function describeArrayPath(data: unknown, path: PropertyKey[]): string {
  // Prefix array indices with the item id when available: [12 c05_internship].choices[2]
  let cur: unknown = data
  let s = ''
  for (const p of path) {
    if (typeof p === 'number') {
      const item = Array.isArray(cur) ? cur[p] : undefined
      const id = item && typeof item === 'object' && 'id' in item ? (item as { id: unknown }).id : undefined
      s += typeof id === 'string' ? `[${p} ${id}]` : `[${p}]`
    } else s += s ? `.${String(p)}` : String(p)
    cur = cur && typeof cur === 'object' ? (cur as Record<PropertyKey, unknown>)[p] : undefined
  }
  return s
}

/** `--content=<module.ts>` loads a Content export from another module (e.g. the engine test fixture). */
async function loadOverride(spec: string): Promise<LoadResult> {
  const file = isAbsolute(spec) ? spec : join(process.cwd(), spec)
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>
  const found = Object.values(mod).find((v) => v && typeof v === 'object' && 'scenes' in v && 'constants' in v)
  const issues: Issue[] = []
  let content: ContentT | undefined
  const r = Content.safeParse(found)
  if (r.success) content = r.data
  else issues.push(...zodIssues(r.error, relative(ROOT, file)))
  const data = found ?? {}
  return {
    content,
    raw: data as Record<string, unknown>,
    issues,
    source: content ? 'index' : 'none',
    sceneFiles: new Map(),
    files: [file],
    jsonFiles: [{ rel: relative(ROOT, file), data }],
  }
}

export async function loadContent(): Promise<LoadResult> {
  const override = process.argv.find((a) => a.startsWith('--content='))?.slice('--content='.length)
  if (override) return loadOverride(override)
  const issues: Issue[] = []
  const raw: Record<string, unknown> = {}
  const sceneFiles = new Map<string, string>()
  const files = listJson(DATA_DIR)
  const jsonFiles: { rel: string; data: unknown }[] = []
  const shape = Content.shape

  for (const file of files) {
    const rel = relative(ROOT, file)
    let data: unknown
    try {
      data = JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      issues.push({ level: 'error', where: rel, message: `invalid JSON: ${(e as Error).message}` })
      continue
    }
    jsonFiles.push({ rel, data })
    const key = keyForFile(file)
    if (!key) {
      issues.push({ level: 'warn', where: rel, message: 'file name does not map to a Content key (ignored by the JSON loader)' })
      continue
    }
    if (key === 'scenes') {
      const list = Array.isArray(data) ? data : (data as { scenes?: unknown })?.scenes
      const r = z.array(Scene).safeParse(list)
      if (!r.success) issues.push(...zodIssues(r.error, rel, (p) => describeArrayPath(list, p)))
      if (Array.isArray(list)) {
        for (const s of list) if (s && typeof s.id === 'string') sceneFiles.set(s.id, rel)
        raw.scenes = [...((raw.scenes as unknown[]) ?? []), ...list]
      }
      continue
    }
    const schema = shape[key]
    const r = schema.safeParse(data)
    if (!r.success) issues.push(...zodIssues(r.error, rel, (p) => describeArrayPath(data, p)))
    if (Array.isArray(data) && Array.isArray(raw[key])) raw[key] = [...(raw[key] as unknown[]), ...data]
    else raw[key] = data
  }

  let content: ContentT | undefined
  let source: LoadResult['source'] = 'none'

  if (existsSync(INDEX_FILE)) {
    try {
      const mod = (await import(pathToFileURL(INDEX_FILE).href)) as Record<string, unknown>
      const candidates = [mod.content, mod.default, mod.CONTENT, ...Object.values(mod)]
      for (const c of candidates) {
        if (!c || typeof c !== 'object' || !('scenes' in c) || !('constants' in c)) continue
        const r = Content.safeParse(c)
        if (r.success) {
          content = r.data
          source = 'index'
          break
        }
        issues.push(...zodIssues(r.error, 'src/content/index.ts export'))
        break
      }
      if (!content && !issues.some((i) => i.where.startsWith('src/content/index.ts')))
        issues.push({ level: 'warn', where: 'src/content/index.ts', message: 'no Content export found; using the JSON files' })
    } catch (e) {
      const err = e as Error
      if (err instanceof z.ZodError) issues.push(...zodIssues(err, 'src/content/index.ts'))
      else
        issues.push({
          level: 'warn',
          where: 'src/content/index.ts',
          message: `could not be loaded under tsx (${err.message.split('\n')[0]}); using the JSON files`,
        })
    }
  }

  if (!content && files.length > 0) {
    const missing = (Object.keys(shape) as (keyof ContentT)[]).filter((k) => raw[k] === undefined)
    for (const k of missing) issues.push({ level: 'error', where: 'src/content/data', message: `missing content for "${k}"` })
    if (missing.length === 0) {
      const r = Content.safeParse(raw)
      if (r.success) {
        content = r.data
        source = 'json'
      } else if (!issues.some((i) => i.level === 'error')) {
        issues.push(...zodIssues(r.error, 'assembled bundle', (p) => describeArrayPath(raw, p)))
      }
    }
  }
  if (files.length === 0 && !content)
    issues.push({ level: 'error', where: 'src/content/data', message: 'no content JSON files found' })

  return { content, raw: content ? (content as unknown as Record<string, unknown>) : raw, issues, source, sceneFiles, files, jsonFiles }
}
