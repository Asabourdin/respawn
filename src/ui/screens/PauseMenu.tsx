import { useState } from 'react'
import { useKeys } from '../hooks'
import { setMuted } from '../sfx'
import { AboutData, useMuted } from './Title'

export function PauseMenu({ onResume, onAbandon }: { onResume: () => void; onAbandon: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [about, setAbout] = useState(false)
  const muted = useMuted()
  useKeys((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (about) setAbout(false)
      else if (confirm) setConfirm(false)
      else onResume()
    }
  })
  return (
    <div className="beat-dim absolute inset-0 z-50 flex items-center justify-center px-[15px]" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="beat-pop pwin-dark flex w-full max-w-[340px] flex-col gap-[15px] px-[18px] py-[18px]">
        {!confirm ? (
          <>
            <h2 className="text-center font-mono text-[34px] leading-none text-lime">PAUSED</h2>
            <button type="button" className="pkey is-primary min-h-[52px] text-[19px] font-bold" onClick={onResume} autoFocus>
              Resume
            </button>
            <button type="button" className="pkey min-h-[52px] text-[18px] font-semibold" onClick={() => setMuted(!muted)} aria-pressed={!muted}>
              Sound: {muted ? 'off' : 'on'}
            </button>
            <button type="button" className="pkey min-h-[52px] text-[18px] font-semibold" onClick={() => setAbout(true)}>
              About the data
            </button>
            <button type="button" className="pkey is-dark min-h-[52px] text-[18px] font-semibold" onClick={() => setConfirm(true)}>
              Abandon this life
            </button>
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-bold text-paper">Abandon this life?</h2>
            <p className="text-[17px] leading-[1.35] text-stone">You go back to the title screen and this life is gone for good.</p>
            <button type="button" className="pkey is-primary min-h-[52px] text-[19px] font-bold" onClick={onAbandon}>
              Abandon
            </button>
            <button type="button" className="pkey min-h-[52px] text-[18px] font-semibold" onClick={() => setConfirm(false)} autoFocus>
              Keep living
            </button>
          </>
        )}
      </div>
      {about && <AboutData onClose={() => setAbout(false)} />}
    </div>
  )
}
