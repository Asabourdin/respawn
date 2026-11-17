/** Procedural art for the title and the end sequence (globe, graveyard, 2100 city, radar). */
import { P } from '../theme/palette'
import { checker, disc, dither, hash, line, paceLevel, person, px, rect, sky, type Col, type Frame } from './gfx'
import { stamp, TOMBSTONE } from './sprites'

// ---------------------------------------------------------------------------
// Title globe: value-noise continents scrolling, terminator dither, the sky warms with pace.
// ---------------------------------------------------------------------------

function noise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const h = (i: number, j: number) => hash(((i % 64) + 64) * 7919 + j * 104729)
  const s = (t: number) => t * t * (3 - 2 * t)
  const a = h(xi, yi)
  const b = h(xi + 1, yi)
  const c = h(xi, yi + 1)
  const d = h(xi + 1, yi + 1)
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf)
}

export function globe(f: Frame) {
  const { ctx, w, h, t } = f
  rect(ctx, 0, 0, w, h, 'forest')
  for (let i = 0; i < 30; i++) {
    const tw = Math.floor(t * 2 + i) % 9 === 0
    px(ctx, Math.floor(hash(i * 7 + 1) * w), Math.floor(hash(i * 13 + 5) * h), tw ? 'mint' : i % 3 ? 'slate' : 'stone')
  }
  const R = Math.min(Math.floor(h / 2) - 4, Math.floor(w / 2) - 6)
  const cx = Math.floor(w / 2)
  const cy = Math.floor(h / 2) + 2
  const spin = t * 0.08
  const lvl = paceLevel(f.pace)
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d2 = x * x + y * y
      if (d2 > R * R) continue
      const z = Math.sqrt(R * R - d2)
      const lon = Math.atan2(x, z) / Math.PI + spin
      const lat = y / R
      const n = noise(lon * 8, lat * 4 + 10) * 0.65 + noise(lon * 20, lat * 10) * 0.35
      let c: Col
      const ice = Math.abs(lat) > 0.86 + lvl * 0.02 - noise(lon * 12, lat * 3) * 0.12
      if (ice) c = 'white'
      else if (n > 0.6) c = lvl >= 4 ? 'tan' : n > 0.72 ? 'moss' : 'leaf'
      else if (n > 0.56) c = lvl >= 3 ? 'sand' : 'leaf'
      else c = n > 0.45 ? 'sky' : 'navy'
      const shade = x + y * 0.4 > R * 0.45
      if (shade && (x + y + cx + cy) % 2 === 0) c = c === 'white' ? 'mist' : c === 'navy' || c === 'sky' ? 'ink' : 'pine'
      px(ctx, cx + x, cy + y, c)
    }
  }
  // atmosphere rim
  for (let a = 0; a < 360; a += 2) {
    const r = (a * Math.PI) / 180
    px(ctx, cx + Math.round(Math.cos(r) * (R + 1)), cy + Math.round(Math.sin(r) * (R + 1)), lvl >= 3 ? 'orange' : 'cyan')
  }
  // a little satellite
  const sa = t * 0.9
  const sx = cx + Math.round(Math.cos(sa) * (R + 7))
  const sy = cy + Math.round(Math.sin(sa) * (R * 0.35))
  if (Math.sin(sa) < 0 || Math.abs(Math.cos(sa) * (R + 7)) > R) {
    rect(ctx, sx - 1, sy, 3, 1, 'mist')
    px(ctx, sx, sy - 1, 'lemon')
  }
}

// ---------------------------------------------------------------------------
// Death: graveyard at night with your tombstone.
// ---------------------------------------------------------------------------

export function graveyard(f: Frame) {
  const { ctx, w, h, t } = f
  const g = h - 12
  sky(f, g, 'night')
  disc(ctx, w - 18, 14, 6, 'mist')
  disc(ctx, w - 16, 13, 5, 'ink')
  for (let x = 0; x < w; x++) rect(ctx, x, g - 4 - Math.round(Math.sin(x / 9) * 2), 1, 6, 'pine')
  rect(ctx, 0, g, w, h - g, 'deep')
  rect(ctx, 0, g, w, 1, 'pine')
  // other graves
  for (let i = 0; i < 4; i++) {
    const x = Math.round(w * (0.1 + i * 0.25))
    if (Math.abs(x - w / 2) < 14) continue
    rect(ctx, x, g - 7, 5, 7, 'steel')
    rect(ctx, x + 1, g - 8, 3, 1, 'steel')
    px(ctx, x + 2, g - 6, 'slate')
  }
  const tw = 18
  stamp(ctx, TOMBSTONE, Math.round(w / 2 - tw / 2), g - TOMBSTONE.length + 2)
  // flowers
  px(ctx, w / 2 - 6, g, 'pink')
  px(ctx, w / 2 - 5, g + 1, 'red')
  px(ctx, w / 2 + 6, g, 'lemon')
  // fireflies
  for (let i = 0; i < 5; i++) {
    const on = Math.floor(t * 2 + i * 3) % 4 !== 0
    if (on) px(ctx, (hash(i) * w + t * 2 * (i % 2 ? 1 : -1) + w) % w, g - 6 - hash(i + 9) * 20, 'lemon')
  }
}

// ---------------------------------------------------------------------------
// THE EARTH IN 2100: a coastal city, the sea rising to the projected level, heat haze.
// data.sea = 0..1 progress of the reveal, data.temp = projected °C.
// ---------------------------------------------------------------------------

export function city2100(f: Frame) {
  const { ctx, w, h, t } = f
  const temp = f.data?.temp ?? 2.7
  const prog = f.data?.sea ?? 1
  const ocean = f.data?.ocean ?? 0.56
  // the reveal reads the temperature directly: 2.7 °C must already look hot
  const shownT = 1.4 + (temp - 1.4) * prog
  const lvl0 = shownT < 1.8 ? 0 : shownT < 2.2 ? 1 : shownT < 2.6 ? 2 : shownT < 3 ? 3 : shownT < 3.5 ? 4 : 5
  const ff: Frame = { ...f, pace: [0.1, 0.4, 0.5, 0.65, 0.8, 0.95][lvl0] }
  const g = h - 10
  sky(ff, g, 'day')
  // sun
  const lvl = paceLevel(ff.pace)
  disc(ctx, w - 14, 11, 4 + Math.floor(lvl / 2), lvl >= 4 ? 'orange' : 'lemon')
  // skyline
  let x = 2
  let i = 0
  while (x < w - 2) {
    const bw = 5 + Math.floor(hash(i * 11) * 7)
    const bh = 10 + Math.floor(hash(i * 7 + 3) * 26)
    const body: Col = (['steel', 'slate', 'fog', 'night'] as const)[i % 4]
    rect(ctx, x, g - bh, bw, bh, body)
    for (let wy = g - bh + 2; wy < g - 1; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) px(ctx, wx, wy, 'mist')
    x += bw + 1
    i++
  }
  rect(ctx, 0, g, w, h - g, 'clay')
  // sea: 0.38 m → 2 px, 0.77 m → ~26 px (exaggerated so it reads on a phone)
  const level = 2 + ((ocean - 0.3) / 0.5) * 24 * prog
  const top = Math.round(h - level)
  rect(ctx, 0, top, w, h - top, ocean > 0.6 ? 'navy' : 'sky')
  rect(ctx, 0, top, w, 1, 'cyan')
  for (let k = 0; k < w; k += 5) px(ctx, (k + Math.floor(t * 6)) % w, top + 2 + (k % 3), 'cyan')
  // heat shimmer above the roofs
  if (temp >= 2.5 && prog > 0.5) {
    for (let k = 0; k < w; k += 3) {
      const yy = g - 38 + Math.round(Math.sin(k / 4 + t * 3) * 2)
      px(ctx, k, yy, temp >= 3.2 ? 'orange' : 'amber')
    }
  }
  // a person on a roof, waiting
  person(ctx, Math.round(w * 0.3), Math.min(top, g - 14), { shirt: 'red' })
}

// ---------------------------------------------------------------------------
// Thermometer (vertical): data.temp °C, data.fill 0..1 reveal progress.
// ---------------------------------------------------------------------------

export const THERMO_MIN = 1
export const THERMO_MAX = 5

export function thermometer(f: Frame) {
  const { ctx, w, h } = f
  const temp = f.data?.temp ?? 2.7
  const fill = f.data?.fill ?? 1
  const cx = Math.floor(w / 2)
  const top = 3
  const bulbR = 5
  const bottom = h - bulbR * 2 - 2
  // glass
  rect(ctx, cx - 3, top, 7, bottom - top + 2, 'ink')
  rect(ctx, cx - 2, top + 1, 5, bottom - top, 'mist')
  disc(ctx, cx, h - bulbR - 2, bulbR + 1, 'ink')
  disc(ctx, cx, h - bulbR - 2, bulbR, 'heat')
  // ticks every 0.5 °C, labels via DOM
  const yOf = (c: number) => Math.round(bottom - ((c - THERMO_MIN) / (THERMO_MAX - THERMO_MIN)) * (bottom - top - 2))
  for (let c = THERMO_MIN; c <= THERMO_MAX + 0.01; c += 0.5) {
    const y = yOf(c)
    rect(ctx, cx + 4, y, Number.isInteger(c) ? 4 : 2, 1, 'fog')
  }
  // targets
  rect(ctx, cx - 7, yOf(1.5), 4, 1, 'leaf')
  rect(ctx, cx - 7, yOf(2), 4, 1, 'amber')
  const cur = THERMO_MIN + (temp - THERMO_MIN) * fill
  const y = yOf(cur)
  rect(ctx, cx - 1, y, 3, bottom - y + 2, cur >= 2.5 ? 'heat' : 'ember')
  px(ctx, cx - 1, y, 'skin1')
}

// ---------------------------------------------------------------------------
// Radar: pixel polygon, Bresenham edges, dithered fill. Values 0..100 per pole.
// ---------------------------------------------------------------------------

export interface RadarSeries {
  values: number[]
  stroke: Col
  fill: Col
  /** Dither density of the fill. */
  density?: number
}

export function radar(ctx: CanvasRenderingContext2D, size: number, poles: number, series: RadarSeries[], grow = 1) {
  const c = Math.floor(size / 2)
  const R = c - 3
  const angle = (i: number) => -Math.PI / 2 + (i / poles) * Math.PI * 2
  const pt = (i: number, v: number) => {
    const r = (R * Math.max(0, Math.min(100, v)) * grow) / 100
    return [c + Math.round(Math.cos(angle(i)) * r), c + Math.round(Math.sin(angle(i)) * r)] as const
  }
  // grid rings
  for (const ring of [25, 50, 75, 100]) {
    for (let i = 0; i < poles; i++) {
      const a = pt(i, ring)
      const b = pt((i + 1) % poles, ring)
      line(ctx, a[0], a[1], b[0], b[1], ring === 100 ? 'slate' : 'charcoal')
    }
  }
  for (let i = 0; i < poles; i++) {
    const a = pt(i, 100)
    line(ctx, c, c, a[0], a[1], 'charcoal')
  }
  for (const s of series) {
    const pts = s.values.map((v, i) => pt(i, v))
    // scanline fill (even-odd) with checker dither
    ctx.fillStyle = P[s.fill]
    const ys = pts.map((p) => p[1])
    const y0 = Math.min(...ys)
    const y1 = Math.max(...ys)
    for (let y = y0; y <= y1; y++) {
      const xs: number[] = []
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]
        const [bx, by] = pts[(i + 1) % pts.length]
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
          const dens = s.density ?? 0.5
          const on = dens >= 1 || (dens >= 0.5 ? (x + y) % 2 === 0 : (x + y) % 2 === 0 && y % 2 === 0)
          if (on) ctx.fillRect(x, y, 1, 1)
        }
      }
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      line(ctx, a[0], a[1], b[0], b[1], s.stroke)
    }
    for (const p of pts) {
      rect(ctx, p[0] - 1, p[1] - 1, 3, 3, s.stroke)
    }
  }
}

export function checkerBg(f: Frame, a: Col, b: Col) {
  dither(f.ctx, 0, 0, f.w, f.h, a, b)
}

export { checker }
