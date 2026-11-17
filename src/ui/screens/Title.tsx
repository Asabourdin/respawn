import { useState, useSyncExternalStore } from 'react'
import { globe } from '../art/end'
import { SPEAKER_OFF, SPEAKER_ON } from '../art/sprites'
import { sproutUrl } from '../assets'
import { PixelImg } from '../components/PixelImg'
import { PixelCanvas } from '../components/PixelCanvas'
import { Sprite } from '../components/Sprite'
import { Wordmark } from '../components/Wordmark'
import { useKeys, useMediaQuery } from '../hooks'
import { isMuted, primeAudio, setMuted, sfx, subscribeMuted } from '../sfx'

export function useMuted() {
  return useSyncExternalStore(subscribeMuted, isMuted, isMuted)
}

export function MuteButton({ className }: { className?: string }) {
  const muted = useMuted()
  return (
    <button
      type="button"
      className={'pkey is-dark grid h-[48px] w-[48px] place-items-center ' + (className ?? '')}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      onClick={() => {
        setMuted(!muted)
        if (muted) {
          primeAudio()
          sfx.coin()
        }
      }}
    >
      <Sprite rows={muted ? SPEAKER_OFF : SPEAKER_ON} scale={3} />
    </button>
  )
}

interface TitleProps {
  ready: boolean
  error?: string | null
  hasSave: boolean
  saveAge?: number
  onStart: () => void
  onContinue: () => void
}

export function TitleView({ ready, error, hasSave, saveAge, onStart, onContinue }: TitleProps) {
  const [about, setAbout] = useState(false)
  const start = () => {
    if (!ready) return
    primeAudio()
    sfx.coin()
    onStart()
  }
  useKeys((e) => {
    if (about) {
      if (e.key === 'Escape') setAbout(false)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement?.tagName === 'BUTTON') return
      e.preventDefault()
      start()
    }
  })

  const desktop = useMediaQuery('(min-width: 1024px)')
  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-forest px-[18px] pt-[max(18px,env(safe-area-inset-top))] pb-[max(18px,env(safe-area-inset-bottom))] lg:px-[48px] lg:py-[32px]">
      <div className="flex w-full items-center justify-between">
        <span className="flex items-end gap-[6px]" aria-label="One life">
          <PixelImg path={sproutUrl('sprout')} size={40} />
          <span className="font-mono text-[26px] leading-[0.8] text-paper">x1</span>
        </span>
        <MuteButton />
      </div>

      <div className="flex flex-1 flex-col items-center lg:flex-row lg:items-center lg:justify-center lg:gap-[72px]">
        {desktop && (
          <div className="order-2 shrink-0">
            <PixelCanvas draw={globe} h={84} w={100} scale={5} pace={0.3} seed={7} fps={8} label="The Earth, slowly turning" />
          </div>
        )}

        <div className="flex w-full max-w-[330px] flex-col items-center gap-[12px] lg:order-1 lg:max-w-[520px] lg:items-start">
          <h1 className="w-full lg:max-w-[460px]">
            <Wordmark />
          </h1>
          <p className="text-center text-[21px] leading-[1.25] font-semibold text-paper lg:text-left lg:text-[30px]">
            One life. Twenty choices.
            <br />
            Eight billion consequences.
          </p>
          {!desktop && (
            <PixelCanvas draw={globe} h={80} scale={3} pace={0.3} seed={7} fps={8} label="The Earth, slowly turning" className="my-[3px] w-full shrink-0" />
          )}
          <p className="t-body mt-[6px] text-center text-stone lg:text-left">
            Live a whole life from your first week at AIDAMS. Then see the Earth in 2100 if 8 billion people lived like you.
          </p>

          <div className="mt-[18px] flex w-full flex-col gap-[18px] lg:max-w-[420px]">
            <button type="button" className="pkey is-primary min-h-[62px] text-[24px] font-bold" onClick={start} aria-disabled={!ready || undefined}>
              {ready ? <span className="anim-blink [animation-duration:1.4s]">Press start</span> : 'Loading the world...'}
            </button>
            {error && !ready && (
              <p className="bg-wine px-[12px] py-[9px] t-meta text-paper" role="alert">
                {error}
              </p>
            )}
            {hasSave && ready && (
              <button type="button" className="pkey min-h-[52px] text-[19px] font-semibold" onClick={onContinue}>
                Continue your life{saveAge ? ` (age ${Math.floor(saveAge)})` : ''}
              </button>
            )}
            <div className="flex items-center justify-between gap-[12px]">
              <button type="button" className="min-h-[44px] t-meta text-stone underline decoration-[2px] underline-offset-[5px] hover:text-paper" onClick={() => setAbout(true)}>
                About the data
              </button>
              <span className="font-mono text-[20px] leading-none text-stone">About 12 minutes{desktop ? ', keys 1-5' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {about && <AboutData onClose={() => setAbout(false)} />}
    </div>
  )
}

export function AboutData({ onClose }: { onClose: () => void }) {
  return (
    <div className="beat-dim fixed inset-0 z-50 flex items-center justify-center px-[15px]" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={onClose}>
      <div className="pwin-dark flex max-h-[86%] w-full max-w-[360px] flex-col gap-[12px] overflow-y-auto px-[18px] py-[18px]" onClick={(e) => e.stopPropagation()}>
        <h2 id="about-title" className="text-[22px] font-bold text-lime">About the data</h2>
        <p className="t-body">
          The story is written by AI for your life. Every number is set by the game engine from published sources, never by the AI.
        </p>
        <p className="t-body">
          Your footprint follows the French average (9.2 t CO2e a year), flights and devices from ADEME and Base Carbone. The Earth in 2100
          scales your footprint to 8 billion people with IPCC AR6 climate ranges.
        </p>
        <ul className="flex flex-col gap-[3px] font-mono text-[19px] leading-tight text-stone">
          <li>IPCC AR6 (2021): warming, sea level</li>
          <li>ADEME / Arcep (2022, 2025): digital footprint</li>
          <li>IEA, Energy and AI (2025)</li>
          <li>Warren et al., Science (2018): insects</li>
          <li>Lenton et al., Nat. Sustainability (2023): heat</li>
          <li>INSEE (2025): life expectancy</li>
        </ul>
        <p className="t-meta text-stone">It is a game: a simplified model to start a conversation, not a forecast.</p>
        <button type="button" className="pkey min-h-[48px] text-[18px] font-semibold" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </div>
  )
}
