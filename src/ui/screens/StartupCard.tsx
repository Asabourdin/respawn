import type { StartupCard as StartupData } from '../../store/game'
import { PixelSpinner } from '../components/Text'
import { pixelSafe } from '../format'
import { useKeys } from '../hooks'

/** The startup the AI just named (or a plain fallback when the AI is offline). */
export function StartupCard({ card, onDone }: { card: StartupData; onDone: () => void }) {
  const loading = card.status === 'loading'
  useKeys((e) => {
    if (loading) return
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault()
      onDone()
    }
  })
  const m = card.meta
  const ok = card.outcome === 'success'
  return (
    <div className="beat-dim absolute inset-0 z-40 flex items-center justify-center px-[15px]" role="dialog" aria-modal="true" aria-label="Your startup">
      <div className="beat-pop pwin-dark flex w-full max-w-[360px] flex-col gap-[12px] px-[18px] py-[18px]">
        {loading ? (
          <div className="flex items-center gap-[15px] py-[18px]">
            <PixelSpinner label="Naming your startup" />
            <p className="text-[18px] text-stone">Registering the company...</p>
          </div>
        ) : (
          <>
            <p className="font-tag text-[12px] text-mint">YOUR STARTUP / {pixelSafe(card.sectorLabel).toUpperCase()}</p>
            <h2 className="text-[30px] leading-none font-bold text-paper">{m ? pixelSafe(m.name) : 'Your startup'}</h2>
            {m && <p className="text-[18px] leading-[1.3] text-stone">{pixelSafe(m.product)}</p>}
            {m && <p className="bg-night px-[12px] py-[9px] text-[17px] leading-[1.35] text-lime">"{pixelSafe(m.pitch)}"</p>}
            {m && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[3px] font-mono text-[20px] leading-tight">
                <dt className="text-stone">Investor</dt>
                <dd className="text-paper">{pixelSafe(m.investor)}</dd>
                <dt className="text-stone">Rival</dt>
                <dd className="text-paper">{pixelSafe(m.rival)}</dd>
              </dl>
            )}
            {card.outcome && (
              <p className={'self-start px-[9px] py-[3px] font-tag text-[14px] ' + (ok ? 'bg-lime text-night' : 'bg-heat text-paper')}>
                {ok ? 'IT TOOK OFF' : 'IT FOLDED'}
              </p>
            )}
            <button type="button" className="pkey is-primary mt-[6px] min-h-[48px] px-[15px] text-[18px] font-bold" onClick={onDone} autoFocus>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  )
}
