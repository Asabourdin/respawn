/**
 * Share card: 1080×1350 PNG. Pixel art is drawn at 216×270 logical px and scaled ×5 with no
 * smoothing; text is set on top in the pixel fonts at native size.
 */
import type { EndSummary } from '../engine/types'
import { globe, radar } from './art/end'
import { dither, rect } from './art/gfx'
import { loadAsset } from './art/bg'
import { textRuns } from './art/font'
import { pixelSafe } from './format'
import { YOU_POLES } from './components/Radar'
import { P } from './theme/palette'

const W = 216
const H = 270
const S = 5

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('700 60px "Pixelify Sans"'),
      document.fonts.load('400 40px "Pixelify Sans"'),
      document.fonts.load('400 40px "VT323"'),
    ])
  } catch {
    /* fall back to whatever is loaded */
  }
}

function word(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, shadow?: string) {
  const { runs } = textRuns(text)
  if (shadow) {
    ctx.fillStyle = shadow
    for (const [rx, ry, rw] of runs) ctx.fillRect(x + rx + 1, y + ry + 1, rw, 1)
  }
  ctx.fillStyle = color
  for (const [rx, ry, rw] of runs) ctx.fillRect(x + rx, y + ry, rw, 1)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else cur = test
  }
  if (cur) lines.push(cur)
  return lines
}

export async function renderShareCard(summary: EndSummary): Promise<HTMLCanvasElement> {
  await fontsReady()
  const wordmark = await loadAsset('brand/wordmark-dark.png')
  const small = document.createElement('canvas')
  small.width = W
  small.height = H
  const sc = small.getContext('2d')!
  sc.imageSmoothingEnabled = false

  // background, frame and a dithered sky band that warms with the result
  const pace = Math.max(0, Math.min(1, (summary.earth.temperatureC - 1.4) / 2.6))
  rect(sc, 0, 0, W, H, 'forest')
  dither(sc, 0, H - 6, W, 6, 'forest', 'night')
  rect(sc, 6, 6, W - 12, 1, 'moss')
  rect(sc, 6, H - 7, W - 12, 1, 'moss')
  rect(sc, 6, 6, 1, H - 12, 'moss')
  rect(sc, W - 7, 6, 1, H - 12, 'moss')

  // radar (left) and globe (right)
  const rs = 84
  const rad = document.createElement('canvas')
  rad.width = rs
  rad.height = rs
  const rc = rad.getContext('2d')!
  radar(rc, rs, 6, [{ values: YOU_POLES.map((k) => summary.you[k]), stroke: 'lime', fill: 'moss', density: 0.5 }])
  sc.drawImage(rad, 16, 128)
  const gl = document.createElement('canvas')
  gl.width = 84
  gl.height = 84
  const gc = gl.getContext('2d')!
  globe({ ctx: gc, w: 84, h: 84, t: 0.8, pace, seed: 3 })
  sc.drawImage(gl, W - 100, 128)

  // temperature panel
  rect(sc, 14, 220, W - 28, 36, 'night')
  rect(sc, 14, 220, 3, 36, pace > 0.5 ? 'heat' : pace > 0.3 ? 'ember' : 'lime')

  // big export
  const out = document.createElement('canvas')
  out.width = W * S
  out.height = H * S
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small, 0, 0, W * S, H * S)

  const cx = (W * S) / 2
  if (wordmark) {
    // crop the rounded card: content box 96..864 × 92..298 of 1080×390
    const dw = 560
    const dh = (dw * 206) / 768
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(wordmark, 96, 92, 768, 206, cx - dw / 2, 56, dw, dh)
    ctx.imageSmoothingEnabled = false
  } else {
    ctx.save()
    ctx.translate(cx - 205, 80)
    ctx.scale(10, 10)
    word(ctx, 'RESPAWN', 0, 0, P.lime, P.moss)
    ctx.restore()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = P.stone
  ctx.font = '400 40px "Pixelify Sans"'
  ctx.fillText('One life. Twenty choices. Eight billion consequences.', cx, 230)

  const full = [summary.player?.name ?? summary.name, summary.player?.lastName].filter(Boolean).join(' ')
  ctx.fillStyle = P.paper
  ctx.font = '700 56px "Pixelify Sans"'
  ctx.fillText(`${pixelSafe(full)}, 18 to ${summary.deathAge}`, cx, 320)

  ctx.fillStyle = P.lime
  ctx.font = '700 82px "Pixelify Sans"'
  const titleLines = wrap(ctx, pixelSafe(summary.title.title), W * S - 140)
  const tl = titleLines.slice(0, 2)
  tl.forEach((l, i) => ctx.fillText(l, cx, 400 + i * 88 + (tl.length === 1 ? 40 : 0)))

  // labels under radar / globe
  ctx.font = '400 38px "VT323"'
  ctx.fillStyle = P.stone
  ctx.fillText('My life', 16 * S + (rs * S) / 2, 1080)
  ctx.fillText('My planet', (W - 100) * S + (84 * S) / 2, 1080)

  // temperature
  const temp = summary.earth.temperatureC
  ctx.textAlign = 'left'
  ctx.fillStyle = temp >= 2.5 ? P.heat : temp >= 2 ? P.ember : P.lime
  ctx.font = '400 170px "VT323"'
  ctx.fillText(`+${temp.toFixed(1)}°C`, 120, 1098)
  ctx.fillStyle = P.paper
  ctx.font = '400 40px "Pixelify Sans"'
  wrap(ctx, 'The Earth in 2100 if 8 billion people lived like me', 440).forEach((l, i) => ctx.fillText(l, 580, 1124 + i * 48))

  ctx.textAlign = 'center'
  ctx.fillStyle = P.stone
  ctx.font = '400 38px "VT323"'
  ctx.fillText(`My carbon: ${summary.F.toFixed(1)} t a year. French average: 9.2 t. AIDAMS Cohesion Day`, cx, 1290)
  return out
}

export async function downloadShareCard(summary: EndSummary): Promise<void> {
  const canvas = await renderShareCard(summary)
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return
  const file = `respawn-${summary.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'life'}.png`
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    const f = new File([blob], file, { type: 'image/png' })
    if (nav.canShare?.({ files: [f] }) && nav.share) {
      await nav.share({ files: [f], title: 'My RESPAWN life' })
      return
    }
  } catch {
    /* user cancelled or unsupported: fall back to download */
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
