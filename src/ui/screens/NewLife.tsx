import { useEffect, useRef, useState } from 'react'
import type { Gender, PlayerInfo } from '../../engine/types'
import { COIN_SLOT } from '../art/sprites'
import { sproutUrl, type SproutStage } from '../assets'
import { PixelImg } from '../components/PixelImg'
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
  const art: SproutStage = (['seed', 'tiny', 'sprout', 'sapling'] as const)[Math.min(stage, 3)]
  return (
    <div className="flex flex-col items-center" aria-label={`Step ${Math.min(stage + 1, of)} of ${of}`} role="img">
      <div className="flex h-[80px] items-end justify-center">
        <PixelImg key={art} path={sproutUrl(art)} size={40} scale={2} className="beat-pop" />
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

/** Height hidden by the on-screen keyboard (0 when closed). Uses the visual viewport, which iOS shrinks. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

function Onboarding({ onRoll, onBack, initialStep = 0 }: NewLifeProps) {
  const [step, setStep] = useState(initialStep)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [rolling, setRolling] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const kb = useKeyboardInset()
  const keyboardOpen = kb > 120

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [step])
  // Once the keyboard has settled, keep the field (and the button under it) in view.
  useEffect(() => {
    if (!keyboardOpen) return
    const id = window.setTimeout(() => inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120)
    return () => window.clearTimeout(id)
  }, [keyboardOpen, step])

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
        <PixelImg path={sproutUrl('sprout')} size={40} scale={3} className="anim-bob" />
        <p className="font-mono text-[30px] text-lime" role="status">
          Rolling your destiny<span className="anim-blink">...</span>
        </p>
      </div>
    )
  }

  return (
    <form
      className="flex h-full flex-col overflow-y-auto bg-forest px-[18px] pt-[max(18px,env(safe-area-inset-top))] lg:px-[max(48px,calc(50%-300px))] lg:py-[32px]"
      style={{ paddingBottom: kb > 0 ? kb + 18 : 'max(18px, env(safe-area-inset-bottom))' }}
      onSubmit={(e) => {
        e.preventDefault()
        next()
      }}
    >
      <div className="flex items-center justify-between">
        <button type="button" className="min-h-[44px] pr-[12px] text-[18px] text-stone hover:text-paper" onClick={back}>
          {'<'} Back
        </button>
        <span className="font-mono text-[22px] text-stone">CREATE YOUR CHARACTER</span>
      </div>

      {!keyboardOpen && (
        <div className="mt-[18px]">
          <GrowingSprout stage={step} />
        </div>
      )}

      {/* No entrance animation on text steps: it would fight the keyboard opening. */}
      <div key={step} className={(step === 2 ? 'rise-in ' : '') + (keyboardOpen ? 'mt-[12px]' : 'mt-[24px]') + ' flex flex-col gap-[9px]'}>
        <h1 className="text-[28px] leading-[1.1] font-bold text-paper">{q.title}</h1>
        <p className="t-body text-stone">{q.sub}</p>

        {step === 0 && (
          <TextField inputRef={inputRef} value={first} onChange={setFirst} label="First name" autoComplete="given-name" placeholder="Your first name" enterKeyHint="next" />
        )}
        {step === 1 && (
          <TextField inputRef={inputRef} value={last} onChange={setLast} label="Last name" autoComplete="family-name" placeholder="Optional" enterKeyHint="done" />
        )}
        {step < 2 && (
          <button
            type="submit"
            className="pkey is-primary mt-[12px] min-h-[60px] text-[22px] font-bold"
            aria-disabled={step === 0 && !first.trim() ? 'true' : undefined}
          >
            {step === 0 ? "That's me" : last.trim() ? 'Next' : 'Skip'}
          </button>
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
        {step === 2 && (
          <button
            type="button"
            className="min-h-[44px] t-body text-stone underline decoration-[2px] underline-offset-[5px] hover:text-paper"
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
  enterKeyHint,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (v: string) => void
  label: string
  autoComplete: string
  placeholder: string
  enterKeyHint: 'next' | 'done'
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
      enterKeyHint={enterKeyHint}
      inputMode="text"
      type="text"
      name={autoComplete}
      placeholder={placeholder}
      className="pbox mt-[9px] min-h-[60px] w-full px-[15px] font-pixel text-[24px] text-paper caret-lime placeholder:text-slate focus:outline-[3px] focus:outline-offset-[3px] focus:outline-lime"
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
    <div className="flex h-full flex-col overflow-y-auto bg-forest px-[18px] pt-[max(24px,env(safe-area-inset-top))] pb-[max(18px,env(safe-area-inset-bottom))] lg:px-[max(48px,calc(50%-300px))] lg:py-[32px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[22px] text-stone">AGE 18</span>
        <PixelImg path={sproutUrl('seed')} size={40} />
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
        <span className="t-meta text-stone">{title}</span>
        {stopped && <Sprite rows={COIN_SLOT} scale={3} />}
      </div>
      <span className={'text-[21px] leading-[1.15] font-bold ' + (stopped ? 'text-lime' : 'text-stone')}>{pixelSafe(shown.label)}</span>
      <span className={'t-meta ' + (stopped ? 'text-stone' : 'invisible')}>{pixelSafe(result.blurb)}</span>
    </div>
  )
}
