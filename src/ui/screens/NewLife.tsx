import { useEffect, useRef, useState } from 'react'
import type { Gender, PlayerInfo } from '../../engine/types'
import { COIN_SLOT, SPROUT, SPROUT_SEED } from '../art/sprites'
import { SheetBody, type SheetData } from '../components/CharacterSheet'
import { Sprite } from '../components/Sprite'
import { pixelSafe } from '../format'
import { useKeys, useReducedMotion } from '../hooks'
import { primeAudio, sfx } from '../sfx'

export interface ProfileOpt {
  id: string
  label: string
  blurb: string
}

export interface NewLifeProps {
  /** null until the life is rolled. */
  rolled: { name: string; origin: ProfileOpt; budget: ProfileOpt; trait: ProfileOpt; sheet?: SheetData } | null
  pools: { origins: ProfileOpt[]; budgets: ProfileOpt[]; traits: ProfileOpt[] }
  onRoll: (info: Partial<PlayerInfo>) => void
  onBegin: () => void
  onBack: () => void
  /** Gallery: open a given onboarding step. */
  initialStep?: number
}

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'nonbinary', label: 'Non-binary' },
  { id: 'unspecified', label: 'Prefer not to say' },
]
const STEPS = 3

export function NewLifeView(p: NewLifeProps) {
  return p.rolled ? <Reveal {...p} rolled={p.rolled} /> : <Onboarding {...p} />
}

/** A sprout that grows one stage per answered question. */
export function GrowingSprout({ stage, of = STEPS }: { stage: number; of?: number }) {
  const scale = [0, 4, 6, 8][Math.min(stage, 3)]
  return (
    <div className="flex flex-col items-center" aria-label={`Step ${Math.min(stage + 1, of)} of ${of}`} role="img">
      <div className="flex h-[118px] items-end justify-center">
        {stage === 0 ? (
          <Sprite key="seed" rows={SPROUT_SEED} scale={8} className="beat-pop" />
        ) : (
          <Sprite key={scale} rows={SPROUT} scale={scale} className="beat-pop" />
        )}
      </div>
      <div className="h-[6px] w-[132px] bg-skin3" />
      <div className="mt-[9px] flex gap-[6px]" aria-hidden>
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={'h-[6px] w-[30px] ' + (i < stage ? 'bg-lime' : i === stage ? 'bg-mint' : 'bg-charcoal')} />
        ))}
      </div>
    </div>
  )
}

function Onboarding({ onRoll, onBack, initialStep = 0 }: NewLifeProps) {
  const [step, setStep] = useState(initialStep)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [rolling, setRolling] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [step])

  const roll = (g?: Gender) => {
    setRolling(true)
    sfx.respawn()
    window.setTimeout(
      () => onRoll({ name: first.trim() || 'Alex', lastName: last.trim() || undefined, gender: g ?? gender ?? 'unspecified' }),
      700,
    )
  }
  const next = () => {
    if (step === 0 && !first.trim()) {
      sfx.locked()
      inputRef.current?.focus()
      return
    }
    primeAudio()
    sfx.confirm()
    if (step >= STEPS - 1) roll()
    else setStep(step + 1)
  }
  const back = () => (step === 0 ? onBack() : setStep(step - 1))

  useKeys((e) => {
    if (rolling) return
    if (e.key === 'Escape') {
      e.preventDefault()
      back()
    }
    if (step === 2 && /^[1-4]$/.test(e.key)) {
      const o = GENDERS[Number(e.key) - 1]
      e.preventDefault()
      setGender(o.id)
      roll(o.id)
    }
  })

  const q = [
    { title: "What's your first name?", sub: 'The narrator will use it all life long.' },
    { title: 'And your last name?', sub: 'For the obituary. Optional, like most things in life.' },
    { title: 'You are...', sub: 'Used for pronouns and life expectancy (INSEE 2025).' },
  ][step]

  if (rolling) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[24px] bg-forest px-[18px]">
        <Sprite rows={SPROUT} scale={6} className="anim-bob" />
        <p className="font-mono text-[30px] text-lime" role="status">
          Rolling your destiny<span className="anim-blink">...</span>
        </p>
      </div>
    )
  }

  return (
    <form
      className="flex h-full flex-col overflow-y-auto bg-forest px-[18px] pt-[max(18px,env(safe-area-inset-top))] pb-[max(18px,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        next()
      }}
    >
      <div className="flex items-center justify-between">
        <button type="button" className="min-h-[44px] pr-[12px] text-[18px] text-stone hover:text-paper" onClick={back}>
          {'<'} Back
        </button>
        <span className="font-mono text-[22px] text-slate">CREATE YOUR CHARACTER</span>
      </div>

      <div className="mt-[18px]">
        <GrowingSprout stage={step} />
      </div>

      <div key={step} className="rise-in mt-[24px] flex flex-col gap-[9px]">
        <h1 className="text-[28px] leading-[1.1] font-bold text-paper">{q.title}</h1>
        <p className="text-[17px] leading-[1.3] text-stone">{q.sub}</p>

        {step === 0 && (
          <TextField inputRef={inputRef} value={first} onChange={setFirst} label="First name" autoComplete="given-name" placeholder="Your first name" />
        )}
        {step === 1 && (
          <TextField inputRef={inputRef} value={last} onChange={setLast} label="Last name" autoComplete="family-name" placeholder="Optional" />
        )}
        {step === 2 && (
          <div className="mt-[9px] grid grid-cols-1 gap-[15px]" role="radiogroup" aria-label="Gender">
            {GENDERS.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={gender === o.id}
                data-pressed={gender === o.id ? 'true' : undefined}
                onClick={() => {
                  setGender(o.id)
                  roll(o.id)
                }}
                className="pkey flex min-h-[54px] items-center gap-[12px] px-[12px] text-left text-[19px] font-semibold"
              >
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center bg-forest font-mono text-[24px] text-lime" aria-hidden>
                  {i + 1}
                </span>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-[12px] pt-[24px]">
        {step < 2 && (
          <button type="submit" className="pkey is-primary min-h-[60px] text-[22px] font-bold" aria-disabled={step === 0 && !first.trim() ? 'true' : undefined}>
            {step === 0 ? "That's me" : last.trim() ? 'Next' : 'Skip'}
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            className="min-h-[44px] text-[17px] text-stone underline decoration-[2px] underline-offset-[5px] hover:text-paper"
            onClick={() => roll('unspecified')}
          >
            Skip
          </button>
        )}
      </div>
    </form>
  )
}

function TextField({
  inputRef,
  value,
  onChange,
  label,
  autoComplete,
  placeholder,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (v: string) => void
  label: string
  autoComplete: string
  placeholder: string
}) {
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={24}
      aria-label={label}
      autoComplete={autoComplete}
      autoCapitalize="words"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="next"
      placeholder={placeholder}
      className="pbox mt-[9px] min-h-[60px] px-[15px] font-pixel text-[24px] text-paper placeholder:text-slate focus:outline-none"
    />
  )
}

function Reveal({ rolled, pools, onBegin, onBack }: NewLifeProps & { rolled: NonNullable<NewLifeProps['rolled']> }) {
  const reduced = useReducedMotion()
  const [stopped, setStopped] = useState(reduced ? 3 : 0)

  useEffect(() => {
    if (reduced) return
    const timers = [700, 1150, 1600].map((ms, i) =>
      window.setTimeout(() => {
        setStopped((s) => Math.max(s, i + 1))
        sfx.coin()
      }, ms),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [reduced])

  const done = stopped >= 3
  useKeys((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (done) onBegin()
      else setStopped(3)
    }
    if (e.key === 'Escape') onBack()
  })

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-forest px-[18px] pt-[max(24px,env(safe-area-inset-top))] pb-[max(18px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[22px] text-slate">AGE 18</span>
        <Sprite rows={SPROUT_SEED} scale={4} />
      </div>
      <div className="mt-[12px] flex flex-1 flex-col gap-[15px]">
        <h1 className="text-[28px] leading-[1.1] font-bold text-paper">Welcome to AIDAMS, {pixelSafe(rolled.name)}.</h1>
        <p className="text-[18px] text-stone">Here is the hand life dealt you.</p>
        <div className="flex flex-col gap-[12px]">
          <Reel title="Origin" pool={pools.origins} result={rolled.origin} stopped={stopped >= 1} />
          <Reel title="Family budget" pool={pools.budgets} result={rolled.budget} stopped={stopped >= 2} />
          <Reel title="Trait" pool={pools.traits} result={rolled.trait} stopped={stopped >= 3} />
        </div>
        {done && rolled.sheet && (
          <div className="rise-in pwin-dark px-[15px] py-[12px]">
            <p className="mb-[9px] font-mono text-[22px] leading-none text-lime">STARTING STATS</p>
            <SheetBody data={rolled.sheet} compact />
          </div>
        )}
        <div className="sticky bottom-0 mt-auto -mx-[18px] bg-forest px-[18px] pt-[12px] pb-[6px]">
          <button type="button" className="pkey is-primary min-h-[60px] w-full text-[22px] font-bold" onClick={() => (done ? onBegin() : setStopped(3))} autoFocus>
            {done ? 'Begin at 18' : 'Shuffling fate...'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Reel({ title, pool, result, stopped }: { title: string; pool: ProfileOpt[]; result: ProfileOpt; stopped: boolean }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (stopped) return
    const id = window.setInterval(() => setI((k) => (k + 1) % Math.max(1, pool.length)), 70)
    return () => window.clearInterval(id)
  }, [stopped, pool.length])
  const shown = stopped ? result : (pool[i] ?? result)
  return (
    <div className={'pwin-dark flex flex-col gap-[6px] px-[15px] py-[12px] ' + (stopped ? 'beat-pop' : '')}>
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-stone">{title}</span>
        {stopped && <Sprite rows={COIN_SLOT} scale={3} />}
      </div>
      <span className={'text-[21px] leading-[1.15] font-bold ' + (stopped ? 'text-lime' : 'text-slate')}>{pixelSafe(shown.label)}</span>
      <span className={'text-[16px] leading-[1.3] ' + (stopped ? 'text-stone' : 'invisible')}>{pixelSafe(result.blurb)}</span>
    </div>
  )
}
