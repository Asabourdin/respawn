/**
 * The three real modules the store glues together: engine, content bundle, AI client.
 * They are loaded in a separate chunk right after first paint so the title screen (reached
 * by QR code on a phone) shows instantly; ESM live bindings update the exports once loaded.
 */
import type { AIClient } from '../ai/types'
import type { Content } from '../content/schema'
import type { EngineAPI } from '../engine/types'

/** Offline AI: every call resolves null, the game keeps base texts and content fallbacks. */
const nullAi: AIClient = {
  narrateScene: async () => null,
  generateEvent: async () => null,
  generateSurpriseOffer: async () => null,
  generateStartup: async () => null,
  generateEpitaph: async () => null,
  get callsUsed() {
    return 0
  },
  resetLife() {},
}

export let engine: EngineAPI | null = null
export let content: Content | null = null
export let ai: AIClient = nullAi
/** Display names for every stat (src/content/schema.ts STAT_LABELS), loaded with the chunk. */
export let statLabels: Record<string, string> = {}

export const modulesReady: Promise<void> = Promise.all([
  import('../engine/index.ts'),
  import('../content/index.ts'),
  import('../ai/client.ts').catch(() => null),
  import('../content/schema.ts'),
]).then(([e, c, a, sc]) => {
  engine = e.engine
  content = c.content
  if (a?.ai) ai = a.ai
  statLabels = sc.STAT_LABELS
})
