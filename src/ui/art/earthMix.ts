/**
 * THE EARTH IN 2100 panoramas (public/assets/earth/earth_{good,mid,bad}.png) mixed by
 * temperature with an ordered (Bayer) dither: a pixel dissolve, never an alpha blend.
 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

export interface EarthImages {
  good: HTMLImageElement
  mid: HTMLImageElement
  bad: HTMLImageElement
}

const dataCache = new WeakMap<HTMLImageElement, ImageData>()

function pixels(img: HTMLImageElement, w: number, h: number): ImageData | null {
  const hit = dataCache.get(img)
  if (hit && hit.width === w && hit.height === h) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  try {
    const d = ctx.getImageData(0, 0, w, h)
    dataCache.set(img, d)
    return d
  } catch {
    return null
  }
}

/** Which two panoramas and how far between them, for a temperature in °C. */
export function earthStops(temp: number): { a: keyof EarthImages; b: keyof EarthImages; t: number } {
  if (temp <= 1.5) return { a: 'good', b: 'good', t: 0 }
  if (temp <= 2.7) return { a: 'good', b: 'mid', t: (temp - 1.5) / 1.2 }
  if (temp <= 4) return { a: 'mid', b: 'bad', t: (temp - 2.7) / 1.3 }
  return { a: 'bad', b: 'bad', t: 0 }
}

/** Renders the mixed panorama at its native size into `out` (resized as needed). */
export function renderEarth(out: HTMLCanvasElement, imgs: EarthImages, temp: number) {
  const w = imgs.mid.naturalWidth
  const h = imgs.mid.naturalHeight
  if (out.width !== w) out.width = w
  if (out.height !== h) out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return
  const { a, b, t } = earthStops(temp)
  const A = pixels(imgs[a], w, h)
  const B = pixels(imgs[b], w, h)
  if (!A || !B) {
    ctx.drawImage(imgs[t < 0.5 ? a : b], 0, 0, w, h)
    return
  }
  const res = ctx.createImageData(w, h)
  const r = res.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const src = BAYER[(y & 3) * 4 + (x & 3)] < t ? B.data : A.data
      r[i] = src[i]
      r[i + 1] = src[i + 1]
      r[i + 2] = src[i + 2]
      r[i + 3] = 255
    }
  }
  ctx.putImageData(res, 0, 0)
}
