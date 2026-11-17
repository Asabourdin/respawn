/**
 * Generated pixel backgrounds (public/assets/bg/<key>.png, 320×180, brand palette).
 * The planet stays ambient on top of them: sky pixels are palette-swapped to warmer bands as
 * the pace rises (classic palette swap, no blending) and a water line creeps up from the bottom.
 */
import { BRAND } from '../theme/palette'
import { paceLevel, rect, type Col, type Frame } from './gfx'

const BASE = import.meta.env.BASE_URL
export const BG_W = 320
export const BG_H = 180

type Entry = HTMLImageElement | 'missing' | Promise<HTMLImageElement | null>
const cache = new Map<string, Entry>()

function tryLoad(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img.naturalWidth > 1 ? img : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Resolves the image for a key, trying `<key>.png` then `bg_<key>.png`. Cached (also misses). */
export function loadAsset(path: string, alt?: string): Promise<HTMLImageElement | null> {
  const hit = cache.get(path)
  if (hit === 'missing') return Promise.resolve(null)
  if (hit instanceof HTMLImageElement) return Promise.resolve(hit)
  if (hit) return hit
  const p = tryLoad(BASE + path)
    .then((img) => img ?? (alt ? tryLoad(BASE + alt) : null))
    .then((img) => {
      cache.set(path, img ?? 'missing')
      return img
    })
  cache.set(path, p)
  return p
}

export function peekAsset(path: string): HTMLImageElement | null {
  const hit = cache.get(path)
  return hit instanceof HTMLImageElement ? hit : null
}

export function bgPath(key: string) {
  return { path: `assets/bg/${key}.png`, alt: `assets/bg/bg_${key}.png` }
}

// ---------------------------------------------------------------------------
// Sky palette swap
// ---------------------------------------------------------------------------

const SKY_SWAP: Col[][] = [
  [],
  [],
  ['sky', 'stone', 'stone', 'paper'],
  ['stone', 'skin1', 'gold', 'gold'],
  ['skin2', 'ember', 'ember', 'gold'],
  ['wine', 'heat', 'ember', 'gold'],
]

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const SKY_RGB = hex(BRAND.sky)
const MINT_RGB = hex(BRAND.mint)

const swapped = new Map<string, HTMLCanvasElement>()

/** The background with its sky recoloured for a pace level (cached per image × level). */
export function skySwapped(img: HTMLImageElement, level: number): CanvasImageSource {
  if (level < 2) return img
  const key = img.src + '#' + level
  const hit = swapped.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return img
  ctx.drawImage(img, 0, 0)
  try {
    const data = ctx.getImageData(0, 0, c.width, c.height)
    const d = data.data
    const skyLimit = Math.floor(c.height * 0.62)
    const bands = SKY_SWAP[level].map((k) => hex(BRAND[k as keyof typeof BRAND] ?? BRAND.sky))
    for (let y = 0; y < skyLimit; y++) {
      const band = bands[Math.min(bands.length - 1, Math.floor((y / skyLimit) * bands.length))]
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]
        const isSky = Math.abs(r - SKY_RGB[0]) + Math.abs(g - SKY_RGB[1]) + Math.abs(b - SKY_RGB[2]) < 40
        const isHaze = level >= 4 && Math.abs(r - MINT_RGB[0]) + Math.abs(g - MINT_RGB[1]) + Math.abs(b - MINT_RGB[2]) < 30
        if (isSky || isHaze) {
          // ordered dither between this band and the next one down for a stepped seam
          d[i] = band[0]
          d[i + 1] = band[1]
          d[i + 2] = band[2]
        }
      }
    }
    ctx.putImageData(data, 0, 0)
  } catch {
    return img
  }
  swapped.set(key, c)
  return c
}

/** Draws a background at logical scale (canvas is W×H logical px), plus the rising water line. */
export function drawBg(f: Frame, img: HTMLImageElement) {
  const { ctx, w, h, t } = f
  const src = skySwapped(img, paceLevel(f.pace))
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const x = Math.round((w - iw) / 2)
  const y = Math.round((h - ih) * 0.55)
  ctx.drawImage(src, x, y)
  // sea-level cue: nothing at a 1.5 °C pace, a creeping flood at 4 °C
  const sh = Math.round(Math.max(0, f.pace - 0.15) * 16)
  if (sh > 0) {
    const top = h - sh
    rect(ctx, 0, top, w, sh, 'sea')
    rect(ctx, 0, top, w, 1, 'sky')
    const off = Math.floor(t * 6)
    for (let i = 0; i < w; i += 9) rect(ctx, (i + off) % (w + 4), top + 2 + (i % 3), 3, 1, 'sky')
  }
}
