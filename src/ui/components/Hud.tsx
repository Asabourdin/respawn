import type { Phase, VisibleStat } from '../../content/schema'
import type { Arrow } from '../../engine/types'
import { ARROW_DOWN, ARROW_UP, PAUSE, SHEET, SPROUT, SPROUT_SEED } from '../art/sprites'
import { PHASE_LABEL, PHASE_START, STAT_META, VISIBLE, clamp } from '../format'
import { Sprite } from './Sprite'

const SEGMENTS = 10

export function Gauge({ stat, value, arrow }: { stat: VisibleStat; value: number; arrow?: Arrow }) {
  const meta = STAT_META[stat]
  const filled = Math.round(clamp(value, 0, 100) / (100 / SEGMENTS))
  const changed = arrow !== undefined && arrow !== 0
  return (
    <div className="flex min-w-0 flex-col items-center gap-[3px]" role="meter" aria-label={meta.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <div className="flex h-[21px] items-center gap-[3px]">
        <Sprite rows={meta.icon} scale={3} />
        {changed && <ArrowMark value={arrow} small />}
      </div>
      <div className={'flex w-full gap-[2px] ' + (changed ? 'anim-flash' : '')}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className="h-[9px] flex-1"
            style={{
              background: i < filled ? `var(--color-${meta.color})` : `var(--color-${meta.dim})`,
            }}
          />
        ))}
      </div>
      <span className="sr-only">{meta.label}</span>
    </div>
  )
}

export function Gauges({ stats, arrows }: { stats: Record<VisibleStat, number>; arrows?: Partial<Record<VisibleStat, Arrow>> }) {
  return (
    <div className="grid grid-cols-5 gap-[9px]">
      {VISIBLE.map((s) => (
        <Gauge key={s} stat={s} value={stats[s]} arrow={arrows?.[s]} />
      ))}
    </div>
  )
}

/** Your life as a sprout: a seed in the first years, a full sprout by your career. */
export function LifeSprout({ phase }: { phase: Phase }) {
  const stage = phase === 'arrival' || phase === 'aidams12' ? 0 : phase === 'aidams34' || phase === 'launch' ? 1 : 2
  return (
    <span className="flex h-[30px] w-[28px] items-end justify-center" aria-hidden>
      {stage === 0 ? <Sprite rows={SPROUT_SEED} scale={2} /> : <Sprite rows={SPROUT} scale={stage === 1 ? 1 : 2} />}
    </span>
  )
}

/** ↑ / ↑↑ / ↑↑↑ as sprites, green up, red down. */
export function ArrowMark({ value, small }: { value: Arrow; small?: boolean }) {
  if (!value) return <span className="font-mono text-[20px] leading-none text-stone">=</span>
  const n = Math.abs(value)
  const up = value > 0
  return (
    <span className="inline-flex items-center gap-[2px]" aria-label={`${up ? 'up' : 'down'} ${n}`}>
      {Array.from({ length: n }, (_, i) => (
        <Sprite key={i} rows={up ? ARROW_UP : ARROW_DOWN} scale={small ? 2 : 3} color={up ? 'lime' : 'heat'} />
      ))}
    </span>
  )
}

export function Timeline({ age, phase, deathAge }: { age: number; phase: Phase; deathAge?: number }) {
  const MIN = 18
  const MAX = deathAge ?? 90
  const pos = (a: number) => `${clamp(((a - MIN) / (MAX - MIN)) * 100, 0, 100)}%`
  const currentIdx = PHASE_START.findIndex(([p]) => p === phase)
  return (
    <div className="relative h-[15px]" aria-hidden>
      <div className="absolute inset-x-0 top-[6px] h-[3px] bg-charcoal" />
      <div className="absolute left-0 top-[6px] h-[3px] bg-lime" style={{ width: pos(age) }} />
      {PHASE_START.slice(1).map(([p, a], i) => (
        <span
          key={p}
          className={'absolute top-[3px] h-[9px] w-[3px] ' + (i + 1 <= currentIdx ? 'bg-lime' : 'bg-slate')}
          style={{ left: pos(a) }}
        />
      ))}
      <span className="absolute top-0 h-[15px] w-[6px] -translate-x-[3px] bg-paper" style={{ left: pos(age) }} />
      <span className="absolute -top-[3px] right-0 font-mono text-[18px] leading-none text-stone">{deathAge ?? '?'}</span>
    </div>
  )
}

interface HudProps {
  age: number
  phase: Phase
  majorIndex?: number
  majorCount: number
  majorsDone: number
  stats: Record<VisibleStat, number>
  arrows?: Partial<Record<VisibleStat, Arrow>>
  onMenu?: () => void
  onSheet?: () => void
  /** Age shown in the header (the beat ticks it). */
  displayAge?: number
}

export function Hud({ age, phase, majorCount, majorsDone, stats, arrows, onMenu, onSheet, displayAge }: HudProps) {
  const shownAge = displayAge ?? age
  return (
    <header className="flex flex-col gap-[9px] bg-night px-[15px] pt-[9px] pb-[12px]">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-[9px]">
          <LifeSprout phase={phase} />
          <span className="font-mono text-[20px] leading-[0.9] text-stone">AGE</span>
          <span className="font-mono text-[40px] leading-[0.75] text-paper tabular-nums" aria-label={`Age ${Math.floor(shownAge)}`}>
            {Math.floor(shownAge)}
          </span>
          <span className="pb-[1px] text-[16px] leading-none text-stone">{PHASE_LABEL[phase]}</span>
        </div>
        <div className="flex items-center gap-[9px]">
          <span className="font-mono text-[22px] leading-none text-stone" aria-label={`Major choice ${majorsDone} of ${majorCount}`}>
            <span className="text-lime">{String(majorsDone).padStart(2, '0')}</span>/{majorCount}
          </span>
          {onSheet && (
            <button
              type="button"
              onClick={onSheet}
              className="pkey is-dark grid h-[42px] w-[42px] place-items-center"
              aria-label="Character sheet"
              aria-keyshortcuts="C"
            >
              <Sprite rows={SHEET} scale={3} />
            </button>
          )}
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              className="pkey is-dark grid h-[42px] w-[42px] place-items-center"
              aria-label="Pause menu"
            >
              <Sprite rows={PAUSE} scale={3} />
            </button>
          )}
        </div>
      </div>
      <Timeline age={shownAge} phase={phase} />
      <Gauges stats={stats} arrows={arrows} />
    </header>
  )
}
