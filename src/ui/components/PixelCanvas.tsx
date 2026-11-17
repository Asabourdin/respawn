import { useEffect, useRef, useState } from 'react'
import type { Frame } from '../art/gfx'
import { useReducedMotion } from '../hooks'

interface Props {
  draw: (f: Frame) => void
  /** Logical height in pixels. */
  h: number
  /** Logical width. Omit to fill the container width (W = ceil(containerW / scale)). */
  w?: number
  /** Integer scale (CSS px per logical px). */
  scale?: number
  pace?: number
  seed?: number
  data?: Record<string, number>
  fps?: number
  animate?: boolean
  label?: string
  className?: string
  /** Hand the canvas to the caller (share card export, etc.). */
  onCanvas?: (c: HTMLCanvasElement | null) => void
}

/** Integer-scaled pixel canvas with a low-fps animation loop (static with reduced motion). */
export function PixelCanvas({
  draw,
  h,
  w,
  scale = 3,
  pace = 0,
  seed = 1,
  data,
  fps = 10,
  animate = true,
  label,
  className,
  onCanvas,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [cw, setCw] = useState<number>(w ? w * scale : 0)
  const reduced = useReducedMotion()
  const drawRef = useRef(draw)
  drawRef.current = draw
  const paramsRef = useRef({ pace, seed, data })
  paramsRef.current = { pace, seed, data }

  useEffect(() => {
    if (w) return
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0].contentRect.width)
      if (width > 0) setCw(width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [w])

  const lw = w ?? Math.max(1, Math.ceil(cw / scale))
  const dataKey = data ? JSON.stringify(data) : ''

  useEffect(() => {
    onCanvas?.(canvas.current)
    return () => onCanvas?.(null)
  }, [onCanvas])

  useEffect(() => {
    const c = canvas.current
    if (!c || lw <= 1) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    let raf = 0
    let last = -1
    const t0 = performance.now()
    const render = (now: number) => {
      const t = (now - t0) / 1000
      const fr = Math.floor(t * fps)
      if (fr === last) return
      last = fr
      ctx.clearRect(0, 0, lw, h)
      const p = paramsRef.current
      drawRef.current({ ctx, w: lw, h, t: reduced ? 0 : fr / fps, pace: p.pace, seed: p.seed, data: p.data })
    }
    const loop = (now: number) => {
      render(now)
      raf = requestAnimationFrame(loop)
    }
    render(performance.now()) // first frame now: no blank flash, works in background tabs
    if (animate && !reduced) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [lw, h, fps, animate, reduced, pace, seed, dataKey, draw])

  return (
    <div ref={wrap} className={'relative overflow-hidden ' + (className ?? '')} style={w ? { width: w * scale } : undefined}>
      <canvas
        ref={canvas}
        width={lw}
        height={h}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{ width: lw * scale, height: h * scale, display: 'block' }}
      />
    </div>
  )
}
