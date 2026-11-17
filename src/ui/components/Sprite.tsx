import { useMemo } from 'react'
import { colorOf, spriteSize, type SpriteRows } from '../art/sprites'
import { textRuns } from '../art/font'
import { P, type PaletteKey } from '../theme/palette'

interface SpriteProps {
  rows: SpriteRows
  scale?: number
  /** Single-colour override (palette key). */
  color?: PaletteKey
  title?: string
  className?: string
}

/** Crisp SVG sprite; horizontal runs are merged into one rect each. */
export function Sprite({ rows, scale = 3, color, title, className }: SpriteProps) {
  const { w, h } = spriteSize(rows)
  const rects = useMemo(() => {
    const out: { x: number; y: number; w: number; fill: string }[] = []
    rows.forEach((row, y) => {
      let i = 0
      while (i < row.length) {
        const c = colorOf(row[i])
        if (!c) {
          i++
          continue
        }
        let j = i + 1
        while (j < row.length && row[j] === row[i]) j++
        out.push({ x: i, y, w: j - i, fill: c })
        i = j
      }
    })
    return out
  }, [rows])
  return (
    <svg
      className={'pixel inline-block shrink-0 ' + (className ?? '')}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {rects.map((r, k) => (
        <rect key={k} x={r.x} y={r.y} width={r.w} height={1} fill={color ? P[color] : r.fill} />
      ))}
    </svg>
  )
}

interface PixelWordProps {
  text: string
  scale?: number
  color?: PaletteKey
  /** Extruded depth layers, nearest first (darkest last), each offset by 1 logical px down-right. */
  extrude?: PaletteKey[]
  outline?: PaletteKey
  className?: string
  /** Per-letter visibility mask (respawn flicker). */
  visible?: (index: number) => boolean
  label?: string
}

/** Arcade headline in the 5×7 bitmap font, optional 3D extrude and outline. */
export function PixelWord({ text, scale = 4, color = 'white', extrude = [], outline, className, visible, label }: PixelWordProps) {
  const { runs, w, h } = useMemo(() => textRuns(text), [text])
  const pad = outline ? 1 : 0
  const depth = extrude.length
  const W = w + depth + pad * 2
  const H = h + depth + pad * 2
  const letterOf = useMemo(() => {
    // map x → letter index for the flicker mask
    const starts: number[] = []
    let x = 0
    for (const ch of text) {
      starts.push(x)
      x += (ch === ' ' ? 3 : 5) + 1
    }
    return (rx: number) => {
      let idx = 0
      for (let i = 0; i < starts.length; i++) if (rx >= starts[i]) idx = i
      return idx
    }
  }, [text])
  const shown = visible ? runs.filter((r) => visible(letterOf(r[0]))) : runs
  return (
    <svg
      className={'pixel inline-block ' + (className ?? '')}
      width={W * scale}
      height={H * scale}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? text}
    >
      {outline &&
        shown.map(([x, y, rw], k) => (
          <rect key={'o' + k} x={x} y={y} width={rw + 2 + depth} height={3 + depth} fill={P[outline]} />
        ))}
      {extrude
        .map((c, i) => ({ c, d: i + 1 }))
        .reverse()
        .map(({ c, d }) =>
          shown.map(([x, y, rw], k) => (
            <rect key={`e${d}-${k}`} x={x + pad + d} y={y + pad + d} width={rw} height={1} fill={P[c]} />
          )),
        )}
      {shown.map(([x, y, rw], k) => (
        <rect key={k} x={x + pad} y={y + pad} width={rw} height={1} fill={P[color]} />
      ))}
    </svg>
  )
}
