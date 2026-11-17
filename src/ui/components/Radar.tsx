import { useCallback } from 'react'
import { radar, type RadarSeries } from '../art/end'
import type { Frame } from '../art/gfx'
import { useCountUp } from '../hooks'
import { PixelCanvas } from './PixelCanvas'

export const YOU_POLES = ['money', 'happiness', 'social', 'fame', 'contribution', 'footprint'] as const
export const YOU_LABELS: Record<(typeof YOU_POLES)[number], string> = {
  money: 'Money',
  happiness: 'Happiness',
  social: 'Social',
  fame: 'Fame',
  contribution: 'Impact',
  footprint: 'Planet',
}

interface Props {
  series: RadarSeries[]
  labels: string[]
  /** Logical size (square). */
  size?: number
  scale?: number
  animate?: boolean
  ariaLabel: string
}

/** Pixel radar with DOM labels around it. */
export function Radar({ series, labels, size = 72, scale = 3, animate = true, ariaLabel }: Props) {
  const SIDE = 72
  const TOP = 24
  const grow = useCountUp(1, animate ? 900 : 0, 0, 2)
  const key = JSON.stringify(series)
  const draw = useCallback(
    (f: Frame) => {
      radar(f.ctx, size, labels.length, JSON.parse(key) as RadarSeries[], f.data?.grow ?? 1)
    },
    [key, size, labels.length],
  )
  const px = size * scale
  const n = labels.length
  return (
    <figure className="relative mx-auto" style={{ width: px + SIDE * 2, height: px + TOP * 2, maxWidth: '100%' }} aria-label={ariaLabel}>
      <div className="absolute" style={{ left: SIDE, top: TOP }}>
        <PixelCanvas draw={draw} w={size} h={size} scale={scale} data={{ grow }} animate={false} label={ariaLabel} />
      </div>
      {labels.map((l, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2
        const r = px / 2 + 12
        const x = SIDE + px / 2 + Math.cos(a) * r
        const y = TOP + px / 2 + Math.sin(a) * r
        const align = Math.abs(Math.cos(a)) < 0.2 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right'
        return (
          <span
            key={l}
            className="absolute font-mono text-[20px] leading-none whitespace-nowrap text-stone"
            style={{
              left: x,
              top: y,
              transform: `translate(${align === 'center' ? '-50%' : align === 'left' ? '-6px' : 'calc(-100% + 6px)'}, -50%)`,
            }}
          >
            {l}
          </span>
        )
      })}
    </figure>
  )
}
