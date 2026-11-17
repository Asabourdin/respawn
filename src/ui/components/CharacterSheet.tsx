import type { Phase } from '../../content/schema'
import { statLabels } from '../../store/modules'
import { SPROUT } from '../art/sprites'
import { PHASE_LABEL, STAT_META, VISIBLE, clamp, pixelSafe } from '../format'
import { useKeys } from '../hooks'
import { Sprite } from './Sprite'

export interface SheetData {
  name: string
  age: number
  phase: Phase
  stats: Record<string, number>
  profile?: { origin: string; budget: string; trait: string }
  career?: string
}

export const SKILLS = ['intellect', 'skillAi', 'skillBusiness', 'skillSoft'] as const
const STUDENT: Phase[] = ['arrival', 'aidams12', 'aidams34']

/** Stats that get a chip in the consequence beat, and whether "up" is good. */
export const CHIP_STATS: { key: string; upIsGood: boolean; studentOnly?: boolean }[] = [
  { key: 'intellect', upIsGood: true },
  { key: 'skillAi', upIsGood: true },
  { key: 'skillBusiness', upIsGood: true },
  { key: 'skillSoft', upIsGood: true },
  { key: 'energy', upIsGood: true },
  { key: 'network', upIsGood: true },
  { key: 'grades', upIsGood: true, studentOnly: true },
  { key: 'ethics', upIsGood: true },
  { key: 'addiction', upIsGood: false },
]

const FALLBACK_LABELS: Record<string, string> = { money: 'Wealth', energy: 'Health', ethics: 'Integrity', addiction: 'Vices' }

export function statLabel(key: string) {
  return statLabels[key] ?? FALLBACK_LABELS[key] ?? key
}

function level(v: number) {
  return clamp(1 + Math.floor(v / 20), 1, 5)
}

function Bar({ value, color, segments = 10 }: { value: number; color: string; segments?: number }) {
  const filled = Math.round((clamp(value, 0, 100) / 100) * segments)
  return (
    <span className="flex flex-1 gap-[2px]" aria-hidden>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="h-[9px] flex-1" style={{ background: i < filled ? `var(--color-${color})` : 'var(--color-charcoal)' }} />
      ))}
    </span>
  )
}

function Row({ label, value, color, right }: { label: string; value: number; color: string; right?: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[9px]" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span className="w-[118px] shrink-0 t-meta leading-none text-paper">{label}</span>
      <Bar value={value} color={color} />
      {right && <span className="w-[40px] shrink-0 text-right font-mono text-[20px] leading-none text-stone">{right}</span>}
    </div>
  )
}

/** The RPG character sheet: gauges, skills and condition as bars and levels, never raw numbers. */
export function SheetBody({ data, compact }: { data: SheetData; compact?: boolean }) {
  const s = data.stats
  const student = STUDENT.includes(data.phase)
  const integrity = clamp(((s.ethics ?? 0) + 50), 0, 100)
  return (
    <div className="flex flex-col gap-[15px]">
      {!compact && (
        <div className="flex items-center gap-[12px]">
          <span className="grid h-[48px] w-[48px] shrink-0 place-items-center bg-pine">
            <Sprite rows={SPROUT} scale={3} />
          </span>
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="truncate text-[21px] leading-none font-bold text-paper">{pixelSafe(data.name)}</span>
            <span className="font-mono text-[19px] leading-none text-stone">
              Age {Math.floor(data.age)}, {PHASE_LABEL[data.phase]}
            </span>
          </div>
        </div>
      )}
      {!compact && (data.profile || data.career) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[3px] font-mono text-[20px] leading-tight">
          {data.profile && (
            <>
              <dt className="text-stone">Origin</dt>
              <dd className="text-paper">{pixelSafe(data.profile.origin)}</dd>
              <dt className="text-stone">Budget</dt>
              <dd className="text-paper">{pixelSafe(data.profile.budget)}</dd>
              <dt className="text-stone">Trait</dt>
              <dd className="text-paper">{pixelSafe(data.profile.trait)}</dd>
            </>
          )}
          {data.career && (
            <>
              <dt className="text-stone">Career</dt>
              <dd className="text-paper">{pixelSafe(data.career)}</dd>
            </>
          )}
        </dl>
      )}

      {!compact && (
        <section className="flex flex-col gap-[9px]" aria-label="Life">
          <h3 className="font-tag text-[14px] text-lime">LIFE</h3>
          {VISIBLE.map((k) => (
            <div key={k} className="flex items-center gap-[9px]">
              <Sprite rows={STAT_META[k].icon} scale={2} />
              <Row label={statLabel(k)} value={s[k] ?? 0} color={STAT_META[k].color} />
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-[9px]" aria-label="Skills">
        <h3 className="font-tag text-[14px] text-lime">SKILLS</h3>
        {SKILLS.map((k) => (
          <Row key={k} label={statLabel(k)} value={s[k] ?? 0} color="lime" right={`Lv${level(s[k] ?? 0)}`} />
        ))}
      </section>

      <section className="flex flex-col gap-[9px]" aria-label="Condition">
        <h3 className="font-tag text-[14px] text-lime">CONDITION</h3>
        <Row label={statLabel('energy')} value={s.energy ?? 0} color={(s.energy ?? 0) < 25 ? 'heat' : 'mint'} />
        <Row label={statLabel('network')} value={s.network ?? 0} color="sky" />
        {student && <Row label={statLabel('grades')} value={s.grades ?? 0} color="paper" />}
        <Row label={statLabel('ethics')} value={integrity} color={integrity < 25 ? 'heat' : 'stone'} />
        <Row label={statLabel('addiction')} value={s.addiction ?? 0} color={(s.addiction ?? 0) > 50 ? 'heat' : 'ember'} />
      </section>
    </div>
  )
}

export function CharacterSheet({ data, onClose }: { data: SheetData; onClose: () => void }) {
  useKeys((e) => {
    if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
      e.preventDefault()
      onClose()
    }
  })
  return (
    <div className="beat-dim absolute inset-0 z-50 flex items-center justify-center px-[12px] py-[18px]" role="dialog" aria-modal="true" aria-label="Character sheet" onClick={onClose}>
      <div className="beat-pop pwin-dark flex max-h-full w-full max-w-[370px] flex-col gap-[12px] overflow-y-auto px-[15px] py-[15px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[28px] leading-none text-lime">CHARACTER</h2>
          <span className="font-mono text-[20px] text-stone">C to close</span>
        </div>
        <SheetBody data={data} />
        <button type="button" className="pkey is-primary min-h-[50px] text-[18px] font-bold" onClick={onClose} autoFocus>
          Back to life
        </button>
      </div>
    </div>
  )
}
