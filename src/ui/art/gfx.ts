/** Tiny pixel drawing kit for the procedural scenes (logical pixels, palette colours only). */
import { P, type PaletteKey } from '../theme/palette'

export type Ctx = CanvasRenderingContext2D
export type Col = PaletteKey

export interface Frame {
  ctx: Ctx
  w: number
  h: number
  /** Seconds since mount (0 when reduced motion). */
  t: number
  /** 0 = 1.4 °C pace, 1 = ≥ 4 °C pace. */
  pace: number
  /** Stable per-scene seed so props don't jump around between renders. */
  seed: number
  /** Optional extra state from the caller (e.g. thermometer fill). */
  data?: Record<string, number>
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: Col) {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = P[c]
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export function px(ctx: Ctx, x: number, y: number, c: Col) {
  ctx.fillStyle = P[c]
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** Checkerboard dither between two palette colours (no blending, ever). */
export function dither(ctx: Ctx, x: number, y: number, w: number, h: number, a: Col, b: Col, density = 0.5) {
  x = Math.round(x)
  y = Math.round(y)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const X = x + i
      const Y = y + j
      let useB: boolean
      if (density >= 0.5) useB = (X + Y) % 2 === 0 || (density > 0.75 && X % 2 === 0)
      else useB = (X + Y) % 2 === 0 && (density > 0.25 || (X % 2 === 0 && Y % 2 === 0))
      ctx.fillStyle = P[useB ? b : a]
      ctx.fillRect(X, Y, 1, 1)
    }
  }
}

/** Only the even checker pixels of one colour (transparent dither). */
export function checker(ctx: Ctx, x: number, y: number, w: number, h: number, c: Col) {
  ctx.fillStyle = P[c]
  x = Math.round(x)
  y = Math.round(y)
  for (let j = 0; j < h; j++) for (let i = (((x + y + j) % 2) + 2) % 2; i < w; i += 2) ctx.fillRect(x + i, y + j, 1, 1)
}

/** Bresenham line. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: Col) {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  ctx.fillStyle = P[c]
  for (let guard = 0; guard < 2000; guard++) {
    ctx.fillRect(x0, y0, 1, 1)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

export function disc(ctx: Ctx, cx: number, cy: number, r: number, c: Col) {
  ctx.fillStyle = P[c]
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.8))
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1)
  }
}

/** Deterministic hash → [0, 1). */
export function hash(n: number) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

// ---------------------------------------------------------------------------
// Planet cues
// ---------------------------------------------------------------------------

const DAY_SKIES: Col[][] = [
  ['sea', 'sky', 'sky', 'mint'],
  ['sea', 'sky', 'mint', 'paper'],
  ['sky', 'sky', 'stone', 'skin1'],
  ['slate', 'stone', 'skin1', 'gold'],
  ['wine', 'skin2', 'ember', 'gold'],
  ['wine', 'heat', 'ember', 'gold'],
]
const NIGHT_SKIES: Col[][] = [
  ['night', 'night', 'forest', 'pine'],
  ['night', 'forest', 'forest', 'pine'],
  ['night', 'forest', 'pine', 'charcoal'],
  ['night', 'forest', 'charcoal', 'wine'],
  ['night', 'charcoal', 'wine', 'skin3'],
  ['night', 'wine', 'heat', 'ember'],
]
const DUSK_SKIES: Col[][] = [
  ['sea', 'sky', 'mint', 'skin1'],
  ['sea', 'slate', 'skin1', 'gold'],
  ['slate', 'wine', 'skin1', 'gold'],
  ['charcoal', 'wine', 'ember', 'gold'],
  ['night', 'wine', 'heat', 'ember'],
  ['night', 'wine', 'heat', 'gold'],
]

/** 0 clear … 5 scorched. An average French life (pace ~0.5) reads as a light haze. */
export function paceLevel(pace: number) {
  if (pace < 0.3) return 0
  if (pace < 0.45) return 1
  if (pace < 0.66) return 2
  if (pace < 0.78) return 3
  if (pace < 0.9) return 4
  return 5
}

/** Stepped sky bands with a dithered seam between each band. */
export function sky(f: Frame, bottom: number, mode: 'day' | 'night' | 'dusk' = 'day') {
  const { ctx, w } = f
  const set = mode === 'night' ? NIGHT_SKIES : mode === 'dusk' ? DUSK_SKIES : DAY_SKIES
  const bands = set[paceLevel(f.pace)]
  const bh = bottom / bands.length
  for (let i = 0; i < bands.length; i++) {
    const y0 = Math.round(i * bh)
    const y1 = Math.round((i + 1) * bh)
    rect(ctx, 0, y0, w, y1 - y0, bands[i])
    if (i > 0) dither(ctx, 0, y0 - 1, w, 2, bands[i - 1], bands[i])
  }
  if (mode === 'night') {
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(hash(f.seed + i * 7) * w)
      const y = Math.floor(hash(f.seed + i * 13) * bottom * 0.6)
      const tw = Math.floor(f.t * 2 + i) % 7 === 0
      px(ctx, x, y, tw ? 'mint' : 'stone')
    }
  }
}

/** Sun grows and reddens with the pace. */
export function sun(f: Frame, x: number, y: number) {
  const lvl = paceLevel(f.pace)
  const r = 3 + Math.floor(lvl / 2)
  const halo: Col = lvl >= 4 ? 'heat' : lvl >= 2 ? 'ember' : 'gold'
  if (lvl >= 3) checker(f.ctx, x - r - 3, y - r - 3, r * 2 + 7, r * 2 + 7, halo)
  disc(f.ctx, x, y, r + (lvl >= 3 ? 1 : 0), halo)
  disc(f.ctx, x, y, r, lvl >= 4 ? 'ember' : lvl >= 2 ? 'gold' : 'paper')
}

/** Height of the water strip in logical px (sea-level cue). */
export function seaHeight(pace: number, base = 2, gain = 8) {
  return base + Math.round(pace * gain)
}

/** Water strip at the bottom with a moving shimmer. Returns the water top y. */
export function water(f: Frame, opts: { base?: number; gain?: number; top?: number } = {}) {
  const { ctx, w, h, t } = f
  const sh = seaHeight(f.pace, opts.base, opts.gain)
  const y = (opts.top ?? h) - sh
  rect(ctx, 0, y, w, sh, f.pace > 0.6 ? 'navy' : 'sky')
  rect(ctx, 0, y, w, 1, 'cyan')
  const off = Math.floor(t * 6)
  for (let i = 0; i < w; i += 7) {
    const x = (i + off + Math.floor(hash(i) * 5)) % (w + 4)
    rect(ctx, x, y + 2 + (i % 3), 3, 1, 'cyan')
  }
  return y
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PersonLook {
  skin?: Col
  hair?: Col
  shirt?: Col
  pants?: Col
}

const SKINS: Col[] = ['skin1', 'skin2', 'skin3', 'skin1', 'skin2']
const SHIRTS: Col[] = ['wine', 'sky', 'lime', 'gold', 'sea', 'mint', 'paper', 'stone', 'moss']
const HAIRS: Col[] = ['night', 'charcoal', 'skin3', 'gold', 'night', 'skin3']

export function randomLook(n: number): PersonLook {
  return {
    skin: SKINS[Math.floor(hash(n) * SKINS.length)],
    shirt: SHIRTS[Math.floor(hash(n + 1) * SHIRTS.length)],
    hair: HAIRS[Math.floor(hash(n + 2) * HAIRS.length)],
    pants: hash(n + 3) > 0.5 ? 'navy' : 'night',
  }
}

/** 3×7 person standing at (x, y) = feet position. */
export function person(ctx: Ctx, x: number, y: number, look: PersonLook = {}, bob = 0) {
  const { skin = 'peach', hair = 'cocoa', shirt = 'red', pants = 'navy' } = look
  const top = y - 7 - bob
  rect(ctx, x, top, 3, 1, hair)
  rect(ctx, x, top + 1, 3, 1, skin)
  px(ctx, x, top + 1, hair)
  rect(ctx, x, top + 2, 3, 3, shirt)
  rect(ctx, x, top + 5, 1, 2 + bob, pants)
  rect(ctx, x + 2, top + 5, 1, 2 + bob, pants)
}

/** Seated person (desk, sofa): 3×5. */
export function seated(ctx: Ctx, x: number, y: number, look: PersonLook = {}) {
  const { skin = 'peach', hair = 'cocoa', shirt = 'red' } = look
  rect(ctx, x, y - 5, 3, 1, hair)
  rect(ctx, x, y - 4, 3, 1, skin)
  px(ctx, x, y - 4, hair)
  rect(ctx, x, y - 3, 3, 3, shirt)
}

export function tree(ctx: Ctx, x: number, ground: number, size = 1, pace = 0) {
  const lvl = paceLevel(pace)
  const leaf: Col = lvl >= 4 ? 'tan' : lvl >= 3 ? 'moss' : 'leaf'
  const dark: Col = lvl >= 4 ? 'umber' : 'moss'
  const r = 3 + size
  rect(ctx, x, ground - 4 - size, 1, 4 + size, 'umber')
  disc(ctx, x, ground - 6 - size * 2, r, dark)
  disc(ctx, x - 1, ground - 7 - size * 2, r - 1, leaf)
}

export function cloud(ctx: Ctx, x: number, y: number, c: Col = 'white', shade: Col = 'mist') {
  rect(ctx, x + 2, y, 6, 1, c)
  rect(ctx, x, y + 1, 11, 2, c)
  rect(ctx, x + 1, y + 3, 10, 1, shade)
}

/** Building with a window grid; lit windows flicker slowly. */
export function building(
  f: Frame,
  x: number,
  ground: number,
  bw: number,
  bh: number,
  body: Col,
  win: Col,
  opts: { lit?: Col; roof?: Col; seed?: number } = {},
) {
  const { ctx, t } = f
  rect(ctx, x, ground - bh, bw, bh, body)
  if (opts.roof) rect(ctx, x, ground - bh, bw, 1, opts.roof)
  const s = opts.seed ?? x
  for (let wy = ground - bh + 2; wy < ground - 2; wy += 3) {
    for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
      const on = opts.lit && hash(s + wx * 31 + wy * 17 + Math.floor(t / 3)) > 0.6
      px(ctx, wx, wy, on ? opts.lit! : win)
    }
  }
}

export function ground(f: Frame, y: number, top: Col, body: Col) {
  rect(f.ctx, 0, y, f.w, f.h - y, body)
  rect(f.ctx, 0, y, f.w, 1, top)
}

/** Windows inside rooms show the planet: sky bands + sea line + sun. */
export function windowView(f: Frame, x: number, y: number, ww: number, wh: number, mode: 'day' | 'night' | 'dusk' = 'day') {
  const { ctx } = f
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, ww, wh)
  ctx.clip()
  ctx.translate(x, y)
  const inner: Frame = { ...f, w: ww, h: wh }
  sky(inner, wh, mode)
  if (mode !== 'night') sun(inner, ww - 5, 4)
  const sh = Math.max(1, Math.round(seaHeight(f.pace, 1, 5)))
  rect(ctx, 0, wh - sh, ww, sh, 'navy')
  rect(ctx, 0, wh - sh, ww, 1, 'cyan')
  ctx.restore()
  // frame
  rect(ctx, x - 1, y - 1, ww + 2, 1, 'ink')
  rect(ctx, x - 1, y + wh, ww + 2, 1, 'ink')
  rect(ctx, x - 1, y, 1, wh, 'ink')
  rect(ctx, x + ww, y, 1, wh, 'ink')
  rect(ctx, x + Math.floor(ww / 2), y, 1, wh, 'ink')
}
