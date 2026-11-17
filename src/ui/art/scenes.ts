/**
 * Procedural pixel scenes. Every scene draws on a W×H logical canvas (H ≈ 72, W adapts to
 * the screen) using ENDESGA 32 only. The planet is hidden but ambient: the sky bands warm up
 * and the water line rises with `pace` (engine.planetPace).
 */
import type { Phase } from '../../content/schema'
import {
  building,
  checker,
  cloud,
  disc,
  dither,
  ground,
  hash,
  line,
  paceLevel,
  person,
  px,
  randomLook,
  rect,
  seated,
  sky,
  sun,
  tree,
  water,
  windowView,
  type Frame,
} from './gfx'

export const SCENE_KEYS = [
  'campus',
  'lecture',
  'party',
  'library',
  'airport',
  'exchange',
  'office',
  'lab',
  'home',
  'garage',
  'hospital',
  'beach',
  'porch',
  'generic',
] as const
export type SceneKey = (typeof SCENE_KEYS)[number]

/** Generated backgrounds available in public/assets/bg (docs/BRAND.md). */
export const ASSET_KEYS = [
  'campus',
  'lecture',
  'party',
  'library',
  'dorm',
  'airport',
  'research',
  'exchange_asia',
  'exchange_west',
  'finance',
  'bigtech',
  'lab',
  'ngo',
  'garage',
  'home',
  'burnout',
  'beach',
  'retirement',
  'graveyard',
  'stage',
  'pandemic',
] as const

const PHASE_ASSET: Record<Phase, string> = {
  arrival: 'campus',
  aidams12: 'campus',
  aidams34: 'exchange_west',
  launch: 'bigtech',
  career: 'bigtech',
  maturity: 'home',
  oldage: 'retirement',
}

/** The background asset key to try for a scene (content art key, else a phase default). */
export function assetKeyFor(art: string | undefined, phase: Phase | undefined): string {
  const k = art?.toLowerCase().trim()
  if (k) return k.replace(/^bg_/, '')
  return phase ? PHASE_ASSET[phase] : 'campus'
}

const ALIASES: [RegExp, SceneKey][] = [
  [/dorm|pandemic/, 'home'],
  [/research/, 'library'],
  [/finance|bigtech/, 'office'],
  [/ngo/, 'garage'],
  [/burnout/, 'hospital'],
  [/retirement|graveyard/, 'porch'],
  [/stage/, 'party'],
  [/lecture|amphi|class|pm|exam|grade|school/, 'lecture'],
  [/party|sete|sète|club|night|bar|3am/, 'party'],
  [/librar|study|paper|thesis|research_paper/, 'library'],
  [/airport|flight|plane|travel/, 'airport'],
  [/exchange|city|abroad|erasmus|singapore|london|newyork|skyline/, 'exchange'],
  [/office|tower|bank|consult|corporate|job|work|career|desk/, 'office'],
  [/lab|research|science|server|data|ai/, 'lab'],
  [/home|family|kid|partner|house|living/, 'home'],
  [/garage|startup|found/, 'garage'],
  [/hospital|burnout|sick|health|injur/, 'hospital'],
  [/beach|holiday|vacation|sea|island/, 'beach'],
  [/porch|retire|old|legacy|garden/, 'porch'],
  [/campus|saclay|plateau|cergy|arrival|residence/, 'campus'],
]

const PHASE_DEFAULT: Record<Phase, SceneKey> = {
  arrival: 'campus',
  aidams12: 'campus',
  aidams34: 'exchange',
  launch: 'office',
  career: 'office',
  maturity: 'home',
  oldage: 'porch',
}

export function resolveArt(art: string | undefined, phase: Phase | undefined): SceneKey {
  if (art) {
    const k = art.toLowerCase().trim()
    if ((SCENE_KEYS as readonly string[]).includes(k)) return k as SceneKey
    for (const [re, key] of ALIASES) if (re.test(k)) return key
  }
  return phase ? PHASE_DEFAULT[phase] : 'generic'
}

const walkX = (t: number, speed: number, offset: number, w: number) => (((t * speed + offset) % (w + 12)) + w + 12) % (w + 12) - 6

// ---------------------------------------------------------------------------

function campus(f: Frame) {
  const { ctx, w, h, t } = f
  const g = h - 16
  sky(f, g)
  sun(f, Math.round(w * 0.82), 10)
  cloud(ctx, Math.round(walkX(t, 1.2, 10, w)), 8)
  cloud(ctx, Math.round(walkX(t, 0.8, 70, w)), 15, 'white', 'mist')
  // far plateau fields
  rect(ctx, 0, g - 3, w, 3, paceLevel(f.pace) >= 4 ? 'tan' : 'moss')
  // campus blocks
  const bx = Math.round(w * 0.08)
  building(f, bx, g, Math.round(w * 0.34), 14, 'mist', 'sky', { roof: 'white', seed: 3 })
  building(f, Math.round(w * 0.46), g, 12, 26, 'steel', 'cyan', { roof: 'fog', lit: 'lemon', seed: 5 })
  building(f, Math.round(w * 0.46) + 13, g, 9, 18, 'fog', 'sky', { roof: 'mist', seed: 9 })
  // crane: Saclay is always under construction
  const cx = Math.round(w * 0.72)
  rect(ctx, cx, g - 34, 1, 34, 'amber')
  rect(ctx, cx - 6, g - 34, 22, 1, 'amber')
  line(ctx, cx, g - 38, cx + 15, g - 34, 'orange')
  line(ctx, cx, g - 38, cx - 6, g - 34, 'orange')
  const hook = 10 + Math.round(Math.sin(t * 0.7) * 3)
  rect(ctx, cx + 12, g - 33, 1, hook, 'ink')
  rect(ctx, cx + 11, g - 33 + hook, 3, 2, 'night')
  ground(f, g, 'leaf', 'moss')
  rect(ctx, 0, g + 3, w, 3, 'sand')
  rect(ctx, 0, g + 3, w, 1, 'peach')
  tree(ctx, Math.round(w * 0.04) + 2, g, 1, f.pace)
  tree(ctx, Math.round(w * 0.92), g, 2, f.pace)
  // bus 91-06 style, fictional
  const busX = Math.round(walkX(t, 10, 0, w + 30)) - 20
  rect(ctx, busX, g - 6, 18, 6, 'red')
  rect(ctx, busX, g - 6, 18, 1, 'pink')
  for (let i = 2; i < 16; i += 4) rect(ctx, busX + i, g - 5, 3, 2, 'cyan')
  rect(ctx, busX + 3, g, 2, 1, 'ink')
  rect(ctx, busX + 13, g, 2, 1, 'ink')
  for (let i = 0; i < 4; i++) {
    const x = Math.round(walkX(t, 3 + i, i * 37, w))
    person(ctx, x, g + 5, randomLook(i * 11 + 1), Math.floor(t * 4 + i) % 2)
  }
  water(f, { base: 1, gain: 7 })
}

function lecture(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'night')
  rect(ctx, 0, 0, w, 2, 'slate')
  windowView(f, 4, 6, 16, 20)
  // board
  const bx = 26
  const bw = w - 34
  rect(ctx, bx - 1, 5, bw + 2, 26, 'umber')
  rect(ctx, bx, 6, bw, 24, 'deep')
  // chalk being written: rows of strokes, progressive
  const prog = (t * 9) % (bw * 4)
  for (let row = 0; row < 4; row++) {
    const len = Math.max(0, Math.min(bw - 6, prog - row * bw))
    for (let x = 0; x < len; x++) {
      const v = hash(row * 997 + x)
      if (v > 0.35) px(ctx, bx + 3 + x, 9 + row * 5 + (v > 0.8 ? 1 : 0), 'mist')
    }
  }
  // PM at the board
  const pmX = bx + 4 + Math.min(bw - 10, Math.floor(prog % bw))
  person(ctx, pmX, 41, { skin: 'peach', hair: 'mist', shirt: 'umber', pants: 'night' })
  px(ctx, pmX + 3, 34 - (Math.floor(t * 4) % 2), 'peach')
  // clock 8:00
  disc(ctx, 12, 33, 3, 'mist')
  rect(ctx, 12, 30, 1, 3, 'ink')
  rect(ctx, 12, 33, 2, 1, 'ink')
  // tiered desks
  for (let r = 0; r < 3; r++) {
    const y = 47 + r * 9
    rect(ctx, 0, y, w, 2, 'clay')
    rect(ctx, 0, y + 2, w, 7, r % 2 ? 'cocoa' : 'umber')
    for (let i = 0; i < w; i += 9) {
      if (hash(i + r * 100) < 0.35) continue
      const sleepy = hash(i * 3 + r) > 0.8 && Math.floor(t + i) % 3 === 0
      seated(ctx, i + 2 + (r % 2) * 4, y + (sleepy ? 1 : 0), randomLook(i + r * 50))
    }
  }
}

function party(f: Frame) {
  const { ctx, w, h, t } = f
  const g = h - 14
  sky(f, g, 'night')
  // distant skyline
  for (let x = 0; x < w; x += 7) {
    const bh = 6 + Math.floor(hash(x) * 14)
    building(f, x, g - 6, 6, bh, 'ink', 'night', { lit: 'amber', seed: x })
  }
  // terrace
  rect(ctx, 0, g - 6, w, 6, 'cocoa')
  rect(ctx, 0, g - 6, w, 1, 'umber')
  // string lights
  for (let x = 0; x < w; x += 2) {
    const y = 10 + Math.round(Math.sin(x / 12) * 3)
    px(ctx, x, y, 'night')
    if (x % 6 === 0) px(ctx, x, y + 1, ['lemon', 'pink', 'cyan', 'leaf'][(x / 6 + Math.floor(t * 3)) % 4] as never)
  }
  // light beams
  const beam = Math.floor(t * 2) % 3
  const cols = ['rose', 'cyan', 'lemon'] as const
  for (let i = 0; i < 3; i++) {
    const x0 = Math.round(w * (0.2 + i * 0.3))
    const x1 = x0 + (i - 1 + (beam - 1)) * 12
    for (let k = 0; k < 18; k += 2) px(ctx, x0 + ((x1 - x0) * k) / 18, 12 + k * 2, cols[(i + beam) % 3])
  }
  ground(f, g, 'plum', 'ink')
  for (let i = 0; i < Math.floor(w / 9); i++) {
    const x = 3 + i * 9 + Math.round(hash(i) * 3)
    const look = randomLook(i * 5 + 2)
    person(ctx, x, g + 6 + (i % 2) * 3, look, Math.floor(t * 4 + i * 1.7) % 2)
  }
  // speaker stack
  rect(ctx, w - 10, g - 4, 8, 14, 'night')
  disc(ctx, w - 6, g + 1, 2, Math.floor(t * 6) % 2 ? 'steel' : 'slate')
  disc(ctx, w - 6, g + 7, 1, 'steel')
}

function library(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'cocoa')
  windowView(f, Math.round(w / 2) - 10, 5, 20, 22)
  const bookCols = ['red', 'navy', 'leaf', 'amber', 'plum', 'sky', 'rust', 'pine', 'paper'] as const
  const shelf = (x0: number, x1: number) => {
    for (let s = 0; s < 4; s++) {
      const y = 6 + s * 11
      rect(ctx, x0, y + 9, x1 - x0, 2, 'umber')
      let x = x0 + 1
      while (x < x1 - 2) {
        const bw = 1 + Math.floor(hash(x * 7 + s) * 2)
        const bh = 6 + Math.floor(hash(x + s * 31) * 3)
        rect(ctx, x, y + 9 - bh, bw, bh, bookCols[Math.floor(hash(x * 13 + s) * bookCols.length)])
        x += bw + (hash(x + 99) > 0.85 ? 2 : 0)
      }
    }
  }
  shelf(1, Math.round(w / 2) - 13)
  shelf(Math.round(w / 2) + 13, w - 1)
  // desk + lamp + reader
  const dy = h - 16
  rect(ctx, 0, dy, w, h - dy, 'umber')
  rect(ctx, 0, dy, w, 1, 'clay')
  const cx = Math.round(w / 2)
  seated(ctx, cx - 1, dy, { shirt: 'sky', hair: 'ink', skin: 'tan' })
  rect(ctx, cx - 6, dy - 2, 4, 2, 'paper')
  rect(ctx, cx + 6, dy - 8, 1, 8, 'night')
  rect(ctx, cx + 4, dy - 9, 5, 2, 'pine')
  checker(ctx, cx + 2, dy - 7, 9, 7, 'lemon')
  // dust motes
  for (let i = 0; i < 6; i++) {
    const y = (Math.floor(t * 3 + i * 9) % 30) + 6
    px(ctx, cx - 8 + ((i * 5 + Math.floor(t)) % 18), y, 'paper')
  }
}

function airport(f: Frame) {
  const { ctx, w, h, t } = f
  const g = h - 14
  sky(f, g)
  sun(f, 12, 9)
  cloud(ctx, Math.round(walkX(t, 1, 40, w)), 6)
  // terminal + tower
  building(f, 4, g, Math.round(w * 0.4), 9, 'mist', 'navy', { roof: 'white', seed: 77 })
  const tx = Math.round(w * 0.5)
  rect(ctx, tx, g - 22, 3, 22, 'fog')
  rect(ctx, tx - 3, g - 27, 9, 5, 'steel')
  rect(ctx, tx - 2, g - 26, 7, 2, 'cyan')
  px(ctx, tx + 1, g - 28, Math.floor(t * 2) % 2 ? 'red' : 'blood')
  ground(f, g, 'fog', 'steel')
  rect(ctx, 0, g + 4, w, 1, 'white')
  for (let x = 0; x < w; x += 8) rect(ctx, x, g + 7, 4, 1, 'lemon')
  // plane loop: taxi → climb
  const cycle = (t * 14) % (w * 2.2)
  const x = Math.round(cycle - 20)
  const climb = Math.max(0, x - w * 0.35)
  const y = Math.round(g + 2 - climb * 0.45)
  if (climb > 2) line(ctx, x - 22, y + 10, x, y + 1, 'white')
  rect(ctx, x, y - 2, 14, 3, 'white')
  rect(ctx, x + 12, y - 1, 3, 2, 'mist')
  rect(ctx, x + 1, y - 5, 3, 3, 'red')
  rect(ctx, x + 5, y, 6, 1, 'fog')
  for (let i = 3; i < 12; i += 2) px(ctx, x + i, y - 1, 'navy')
  water(f, { base: 1, gain: 5 })
}

function exchange(f: Frame) {
  const { ctx, w, h, t } = f
  const g = h - 18
  sky(f, g, 'dusk')
  sun(f, Math.round(w * 0.25), g - 12)
  let x = 0
  let i = 0
  while (x < w) {
    const bw = 6 + Math.floor(hash(i * 3) * 8)
    const bh = 12 + Math.floor(hash(i * 5 + 1) * 30)
    const body = (['night', 'slate', 'navy', 'plum'] as const)[i % 4]
    building(f, x, g, bw, bh, body, 'ink', { lit: 'lemon', seed: i * 19 })
    if (bh > 34) rect(ctx, x + Math.floor(bw / 2), g - bh - 5, 1, 5, 'fog')
    x += bw + 1
    i++
  }
  // ferris wheel landmark
  const cx = Math.round(w * 0.78)
  const cy = g - 18
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2 + t * 0.3
    px(ctx, cx + Math.round(Math.cos(ang) * 12), cy + Math.round(Math.sin(ang) * 12), a % 4 === 0 ? 'pink' : 'mist')
  }
  line(ctx, cx, cy, cx - 6, g, 'mist')
  line(ctx, cx, cy, cx + 6, g, 'mist')
  // quay
  rect(ctx, 0, g, w, 6, 'steel')
  rect(ctx, 0, g, w, 1, 'fog')
  for (let k = 0; k < 3; k++) {
    const px0 = Math.round(walkX(t, 4 + k, k * 41, w))
    person(ctx, px0, g + 5, randomLook(k * 9 + 4), Math.floor(t * 4 + k) % 2)
  }
  water(f, { base: 5, gain: 9 })
}

function office(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'slate')
  // floor-to-ceiling glass
  const gw = w - 8
  ctx.save()
  ctx.beginPath()
  ctx.rect(4, 3, gw, 34)
  ctx.clip()
  ctx.translate(4, 3)
  const inner: Frame = { ...f, w: gw, h: 34 }
  sky(inner, 34)
  sun(inner, gw - 10, 7)
  for (let x = 0, i = 0; x < gw; i++) {
    const bw = 5 + Math.floor(hash(i + 40) * 6)
    const bh = 8 + Math.floor(hash(i + 90) * 16)
    building(inner, x, 34, bw, bh, 'steel', 'mist', { seed: i })
    x += bw + 2
  }
  const sh = 1 + Math.round(f.pace * 5)
  rect(ctx, 0, 34 - sh, gw, sh, 'navy')
  rect(ctx, 0, 34 - sh, gw, 1, 'cyan')
  ctx.restore()
  for (let x = 4; x < w - 4; x += 20) rect(ctx, x, 3, 1, 34, 'night')
  rect(ctx, 0, 37, w, 1, 'ink')
  // desks
  const fy = h - 12
  rect(ctx, 0, 38, w, h - 38, 'night')
  rect(ctx, 0, fy, w, h - fy, 'ink')
  for (let x = 4; x < w - 10; x += 22) {
    rect(ctx, x, fy - 2, 18, 2, 'fog')
    rect(ctx, x + 3, fy - 9, 8, 6, 'ink')
    rect(ctx, x + 4, fy - 8, 6, 4, Math.floor(t * 2 + x) % 5 === 0 ? 'lemon' : 'cyan')
    rect(ctx, x + 6, fy - 3, 2, 1, 'steel')
    seated(ctx, x + 12, fy - 2, randomLook(x))
    rect(ctx, x + 1, fy - 4, 2, 2, 'mist')
  }
  // plant
  rect(ctx, w - 8, fy - 4, 4, 4, 'clay')
  disc(ctx, w - 6, fy - 7, 3, paceLevel(f.pace) >= 4 ? 'tan' : 'leaf')
}

function lab(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'deep')
  windowView(f, w - 22, 6, 16, 14)
  // racks
  for (let r = 0; r < 3; r++) {
    const x = 4 + r * 12
    rect(ctx, x, 6, 10, h - 20, 'ink')
    for (let y = 8; y < h - 16; y += 3) {
      rect(ctx, x + 1, y, 8, 2, 'night')
      const on = hash(x * 7 + y + Math.floor(t * 5)) > 0.5
      px(ctx, x + 2, y + 1, on ? 'leaf' : 'pine')
      px(ctx, x + 4, y + 1, hash(y + Math.floor(t * 3)) > 0.85 ? 'red' : 'night')
    }
  }
  // bench with chart screen
  const by = h - 18
  const sx = 44
  rect(ctx, sx, by - 18, Math.max(24, w - sx - 28), 14, 'ink')
  const sw = Math.max(22, w - sx - 30)
  rect(ctx, sx + 1, by - 17, sw, 12, 'night')
  let prev = 0
  for (let i = 0; i < sw - 2; i++) {
    const v = Math.round(5 + Math.sin(i / 3 + t * 2) * 3 + hash(i) * 2)
    if (i) line(ctx, sx + 1 + i - 1, by - 7 - prev, sx + 1 + i, by - 7 - v, 'cyan')
    prev = v
  }
  rect(ctx, 0, by, w, 2, 'mist')
  rect(ctx, 0, by + 2, w, h - by - 2, 'night')
  person(ctx, sx + 6, by, { shirt: 'white', hair: 'cocoa', skin: 'clay', pants: 'navy' }, Math.floor(t * 2) % 2)
  // flask
  rect(ctx, sx + 16, by - 4, 3, 4, 'leaf')
  rect(ctx, sx + 17, by - 6, 1, 2, 'mist')
}

function home(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'umber')
  for (let x = 0; x < w; x += 6) rect(ctx, x, 0, 3, h - 16, 'cocoa')
  windowView(f, 8, 8, 22, 18)
  // frames
  rect(ctx, w - 30, 10, 8, 7, 'amber')
  rect(ctx, w - 29, 11, 6, 5, 'sky')
  rect(ctx, w - 18, 12, 6, 6, 'amber')
  rect(ctx, w - 17, 13, 4, 4, 'pink')
  // lamp
  const lx = 38
  rect(ctx, lx, h - 34, 1, 18, 'ink')
  rect(ctx, lx - 3, h - 37, 7, 3, 'lemon')
  checker(ctx, lx - 6, h - 34, 13, 8, 'amber')
  // floor + sofa
  const fy = h - 16
  rect(ctx, 0, fy, w, h - fy, 'clay')
  rect(ctx, 0, fy, w, 1, 'tan')
  const sx = Math.round(w / 2) - 14
  rect(ctx, sx, fy - 10, 34, 6, 'rose')
  rect(ctx, sx - 2, fy - 7, 38, 7, 'plum')
  rect(ctx, sx, fy - 11, 34, 1, 'pink')
  seated(ctx, sx + 6, fy - 6, randomLook(31))
  seated(ctx, sx + 13, fy - 6, randomLook(47))
  // kid on the floor with a glowing tablet
  const kx = sx + 26
  rect(ctx, kx, fy + 3, 3, 3, 'leaf')
  rect(ctx, kx, fy + 2, 3, 1, 'peach')
  rect(ctx, kx, fy + 1, 3, 1, 'amber')
  rect(ctx, kx - 3, fy + 4, 2, 2, Math.floor(t * 3) % 2 ? 'cyan' : 'sky')
  // cat
  rect(ctx, 6, fy + 6, 5, 3, 'ink')
  px(ctx, 6, fy + 5, 'ink')
  px(ctx, 9, fy + 5, 'ink')
  rect(ctx, 11, fy + 5 + (Math.floor(t * 2) % 2), 1, 3, 'ink')
}

function garage(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'night')
  // half-open door showing outside
  const dw = Math.round(w * 0.42)
  ctx.save()
  ctx.beginPath()
  ctx.rect(4, 14, dw, 34)
  ctx.clip()
  ctx.translate(4, 14)
  const inner: Frame = { ...f, w: dw, h: 34 }
  sky(inner, 26)
  sun(inner, dw - 7, 5)
  rect(ctx, 0, 26, dw, 8, 'moss')
  tree(ctx, 8, 26, 1, f.pace)
  ctx.restore()
  for (let y = 2; y < 14; y += 3) rect(ctx, 4, y, dw, 2, 'steel')
  rect(ctx, 4, 14, dw, 1, 'fog')
  // whiteboard with sticky notes
  const wx = dw + 10
  const ww = w - wx - 4
  rect(ctx, wx, 6, ww, 22, 'white')
  rect(ctx, wx, 28, ww, 1, 'fog')
  const notes = ['lemon', 'pink', 'cyan', 'leaf', 'amber'] as const
  for (let i = 0; i < Math.floor(ww / 6) * 2; i++) {
    const nx = wx + 2 + (i % Math.floor(ww / 6)) * 6
    const ny = 8 + Math.floor(i / Math.floor(ww / 6)) * 9
    rect(ctx, nx, ny, 4, 4, notes[i % notes.length])
  }
  line(ctx, wx + 2, 25, wx + ww - 3, 18, 'red')
  // table with laptops
  const fy = h - 14
  rect(ctx, 0, fy, w, h - fy, 'slate')
  rect(ctx, 6, fy - 8, w - 12, 2, 'clay')
  for (let x = 10; x < w - 14; x += 16) {
    rect(ctx, x, fy - 12, 7, 4, 'steel')
    rect(ctx, x + 1, fy - 11, 5, 2, Math.floor(t * 3 + x) % 4 === 0 ? 'lemon' : 'cyan')
    person(ctx, x + 9, fy, randomLook(x + 3), Math.floor(t * 3 + x) % 2)
  }
  // boxes
  rect(ctx, w - 12, fy - 6, 8, 6, 'clay')
  rect(ctx, w - 10, fy - 11, 6, 5, 'tan')
  rect(ctx, w - 12, fy - 4, 8, 1, 'umber')
}

function hospital(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'fog')
  rect(ctx, 0, h - 18, w, 18, 'steel')
  windowView(f, w - 26, 8, 18, 16)
  // bed
  const by = h - 22
  rect(ctx, 10, by, 46, 4, 'white')
  rect(ctx, 10, by + 4, 46, 2, 'mist')
  rect(ctx, 8, by - 6, 3, 14, 'steel')
  rect(ctx, 12, by - 3, 7, 3, 'white')
  rect(ctx, 14, by - 4, 4, 3, 'peach')
  rect(ctx, 18, by - 2, 34, 2, 'sky')
  // IV stand
  rect(ctx, 62, by - 24, 1, 30, 'night')
  rect(ctx, 60, by - 24, 5, 6, 'cyan')
  // heart monitor
  const mx = 66
  const mw = Math.max(20, w - mx - 30)
  rect(ctx, mx, by - 30, mw, 14, 'ink')
  const head = Math.floor(t * 18) % mw
  for (let i = 0; i < mw - 2; i++) {
    const phase = (i + 200 - head) % 20
    const v = phase === 3 ? -5 : phase === 4 ? 4 : phase === 5 ? -2 : 0
    const c = Math.abs(i - head) < 3 ? 'lemon' : 'leaf'
    px(ctx, mx + 1 + i, by - 23 + v, c)
  }
}

function beach(f: Frame) {
  const { ctx, w, h, t } = f
  const horizon = Math.round(h * 0.45)
  sky(f, horizon)
  sun(f, Math.round(w * 0.7), 12)
  cloud(ctx, Math.round(walkX(t, 1, 0, w)), 8)
  // sea grows over the sand as the pace rises
  const sandTop = horizon + 8 + Math.round(f.pace * 14)
  rect(ctx, 0, horizon, w, sandTop - horizon, f.pace > 0.6 ? 'navy' : 'sky')
  rect(ctx, 0, horizon, w, 1, 'cyan')
  for (let i = 0; i < w; i += 6) px(ctx, (i + Math.floor(t * 5)) % w, horizon + 3 + (i % 4), 'cyan')
  rect(ctx, 0, sandTop, w, h - sandTop, 'sand')
  dither(ctx, 0, sandTop, w, 2, 'cyan', 'sand')
  const surf = Math.round(Math.sin(t * 1.5) * 1.5)
  rect(ctx, 0, sandTop - 1 + surf, w, 1, 'white')
  // palm
  const px0 = 10
  for (let k = 0; k < 22; k++) px(ctx, px0 + Math.round(Math.sin(k / 7) * 2), h - 4 - k, 'umber')
  for (let a = -2; a <= 2; a++) line(ctx, px0 + 1, h - 26, px0 + 1 + a * 5, h - 22 + Math.abs(a) * 2, 'leaf')
  // umbrella + towel + person
  const ux = Math.round(w * 0.6)
  const uy = Math.max(sandTop + 4, h - 22)
  rect(ctx, ux, uy, 1, h - 4 - uy, 'ink')
  for (let i = -7; i <= 7; i++) px(ctx, ux + i, uy - 4 + Math.round((i * i) / 14), Math.abs(i) % 4 < 2 ? 'red' : 'white')
  rect(ctx, ux - 6, uy - 3, 13, 1, 'red')
  rect(ctx, ux - 12, h - 6, 10, 3, 'cyan')
  rect(ctx, ux - 11, h - 7, 8, 1, 'peach')
}

function porch(f: Frame) {
  const { ctx, w, h, t } = f
  const g = h - 22
  sky(f, g, 'dusk')
  sun(f, Math.round(w * 0.55), g - 6)
  // hills and water
  for (let x = 0; x < w; x++) rect(ctx, x, g - 5 - Math.round(Math.sin(x / 14) * 3), 1, 8, 'plum')
  water(f, { top: g + 3, base: 1, gain: 4 })
  rect(ctx, 0, g + 3, w, h - g - 3, 'moss')
  // porch
  const py = h - 12
  rect(ctx, 0, py, w, h - py, 'clay')
  rect(ctx, 0, py, w, 1, 'sand')
  for (let x = 0; x < w; x += 4) rect(ctx, x, py - 8, 1, 8, 'umber')
  rect(ctx, 0, py - 9, w, 1, 'umber')
  // flowers
  const fl = ['pink', 'lemon', 'red', 'white'] as const
  for (let x = 2; x < w; x += 5) px(ctx, x, py - 10 - (x % 3), fl[x % 4])
  // rocking chair
  const rx = Math.round(w * 0.3)
  const rock = Math.round(Math.sin(t * 2) * 1)
  line(ctx, rx - 5, py + 5 + rock, rx + 6, py + 5 - rock, 'cocoa')
  rect(ctx, rx - 3, py - 1, 8, 2, 'umber')
  rect(ctx, rx + 4, py - 10 + rock, 2, 10, 'umber')
  seated(ctx, rx, py - 1 + rock, { hair: 'mist', shirt: 'navy', skin: 'peach' })
  // tea
  rect(ctx, rx + 10, py - 2, 3, 2, 'white')
  if (Math.floor(t * 2) % 2) px(ctx, rx + 11, py - 4, 'mist')
}

function generic(f: Frame) {
  const { ctx, w, h, t } = f
  const g = h - 14
  sky(f, g)
  sun(f, Math.round(w * 0.2), 10)
  cloud(ctx, Math.round(walkX(t, 1.4, 50, w)), 10)
  for (let x = 0; x < w; x++) {
    rect(ctx, x, g - 8 - Math.round(Math.sin(x / 10) * 4 + Math.sin(x / 4) * 1), 1, 12, 'moss')
  }
  for (let x = 0; x < w; x++) rect(ctx, x, g - 3 - Math.round(Math.sin(x / 7 + 2) * 2), 1, 6, 'leaf')
  ground(f, g, 'leaf', 'moss')
  for (let x = 0; x < w; x++) px(ctx, x, g + 3 + Math.round(Math.sin(x / 9) * 1), 'sand')
  tree(ctx, Math.round(w * 0.75), g, 2, f.pace)
  person(ctx, Math.round(walkX(t, 4, 0, w)), g + 4, { shirt: 'red' }, Math.floor(t * 4) % 2)
  water(f, { base: 1, gain: 6 })
}

export const SCENES: Record<SceneKey, (f: Frame) => void> = {
  campus,
  lecture,
  party,
  library,
  airport,
  exchange,
  office,
  lab,
  home,
  garage,
  hospital,
  beach,
  porch,
  generic,
}

/** Short alt text for screen readers. */
export const SCENE_ALT: Record<SceneKey, string> = {
  campus: 'The Saclay plateau campus under a wide sky, cranes and all.',
  lecture: "PM's lecture hall, chalk already on the board.",
  party: 'A rooftop party at night, string lights and a crowd.',
  library: 'A quiet library, shelves of books and a desk lamp.',
  airport: 'An airport runway, a plane taking off.',
  exchange: 'A foreign city skyline on the waterfront at dusk.',
  office: 'An open-space office high up a tower.',
  lab: 'A research lab with server racks and charts.',
  home: 'A living room with family on the sofa.',
  garage: 'A startup garage, sticky notes and laptops.',
  hospital: 'A hospital room, a heart monitor beeping.',
  beach: 'A beach with an umbrella and the sea.',
  porch: 'A porch at sunset with a rocking chair.',
  generic: 'Rolling hills and a path.',
}
