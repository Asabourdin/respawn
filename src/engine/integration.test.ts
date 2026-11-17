/**
 * Plays 300 seeded lives through the REAL content (src/content/index.ts) with random unlocked
 * choices. AI slots get injectAiEvent(null) → content fallback.
 */
import { describe, expect, it } from 'vitest'
import type { Content } from '../content/schema'
import { engine } from './index'
import { mulberry32 } from './rng'
import type { GameState } from './types'

const loaders = import.meta.glob('../content/index.ts')
const load = loaders['../content/index.ts']

async function realContent(): Promise<Content> {
  const mod = (await load!()) as Record<string, unknown>
  const c = (mod.content ?? mod.default) as Content | undefined
  if (!c) throw new Error('src/content/index.ts must export `content` (or a default export)')
  return c
}

function nonFinite(value: unknown, path = '', out: string[] = []): string[] {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(path)
  } else if (Array.isArray(value)) value.forEach((v, i) => nonFinite(v, `${path}[${i}]`, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) nonFinite(v, `${path}.${k}`, out)
  return out
}

function playRandom(content: Content, seed: number): GameState {
  let s = engine.createGame(content, { seed })
  let r = (seed * 2654435761) >>> 0
  for (let i = 0; i < 600; i++) {
    s = engine.resolveNext(content, s)
    const step = engine.getStep(content, s)
    if (step.type === 'end') return s
    if (step.type === 'ai_slot') {
      s = engine.injectAiEvent(content, s, step.slotId, null)
      continue
    }
    const open = step.scene.choices.filter((c) => !c.locked)
    expect(open.length, `scene ${step.scene.id} has no unlocked choice (seed ${seed})`).toBeGreaterThan(0)
    expect(step.scene.text.length).toBeGreaterThan(0)
    const m = mulberry32(r)
    r = m.state
    s = engine.choose(content, s, open[Math.floor(m.value * open.length)].id).state
  }
  throw new Error(`life ${seed} did not end`)
}

describe.skipIf(!load)('integration: real content', () => {
  it('300 random lives end, with ≤ 20 majors, death in [76, 98] and no NaN', async () => {
    const content = await realContent()
    const majors = new Set(content.scenes.filter((s) => s.kind === 'major' && !s.followUpOnly).map((s) => s.id))
    const t0 = performance.now()
    for (let seed = 0; seed < 300; seed++) {
      const s = playRandom(content, seed)
      expect(s.ended).toBe(true)
      const majorCount = s.history.filter((h) => majors.has(h.sceneId)).length
      expect(majorCount).toBeLessThanOrEqual(20)
      const sum = engine.summarize(content, s)
      expect(sum.deathAge).toBeGreaterThanOrEqual(76)
      expect(sum.deathAge).toBeLessThanOrEqual(98)
      expect(nonFinite(sum), `non-finite values in summary (seed ${seed})`).toEqual([])
      expect(sum.receipt.length).toBeGreaterThan(0)
      expect(sum.receipt.reduce((a, l) => a + l.t, 0)).toBeCloseTo(sum.lifetimeT, 4)
      if (seed < 20 && sum.topChoices.length > 0) {
        const top = sum.topChoices[0]
        const alt = engine.respawnSimulate(content, s, top.historyIndex, top.alternatives[0].id)
        expect(alt.state.ended).toBe(true)
        expect(nonFinite(alt.summary)).toEqual([])
      }
    }
    expect((performance.now() - t0) / 300).toBeLessThan(50)
  })
})
