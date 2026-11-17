import type { ReactNode } from 'react'
import { useMediaQuery } from '../hooks'
import { SPROUT } from '../art/sprites'
import { Sprite } from './Sprite'

/**
 * Desktop: a handheld console around a phone-shaped screen. Phone: the game is the screen.
 * The screen itself is always 390 px wide max so layouts are tested once.
 */
export function Console({ children }: { children: ReactNode }) {
  const desktop = useMediaQuery('(min-width: 720px) and (min-height: 760px)')
  if (!desktop) {
    return <div className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-forest">{children}</div>
  }
  return (
    <div className="flex min-h-[100dvh] items-center justify-center py-[24px]" style={{ backgroundImage: 'var(--pattern)' }}>
      <div className="pbox relative flex flex-col items-center px-[27px] pt-[24px] pb-[30px] [--face:var(--color-pine)] [--hi:var(--color-moss)] [--lo:var(--color-forest)]">
        <div className="mb-[12px] flex w-full items-center justify-between px-[3px]" aria-hidden>
          <span className="flex items-center gap-[9px]">
            <span className="h-[9px] w-[9px] bg-lime" />
            <span className="font-mono text-[18px] leading-none text-mint">POWER</span>
          </span>
          <span className="flex items-end gap-[6px]">
            <Sprite rows={SPROUT} scale={1} />
            <span className="font-tag text-[13px] leading-none text-mint">respawn</span>
          </span>
        </div>
        <div className="bg-night p-[9px]">
          <div className="relative w-[390px] overflow-hidden bg-forest" style={{ height: 'min(844px, calc(100dvh - 190px))' }}>
            {children}
          </div>
        </div>
        <div className="mt-[18px] flex w-full items-center justify-between px-[12px]" aria-hidden>
          <div className="relative h-[54px] w-[54px]">
            <span className="absolute top-[18px] left-0 h-[18px] w-[54px] bg-charcoal" />
            <span className="absolute top-0 left-[18px] h-[54px] w-[18px] bg-charcoal" />
          </div>
          <div className="flex flex-col items-center gap-[3px]">
            <div className="flex gap-[6px]">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="h-[24px] w-[3px] bg-forest" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-[12px]">
            <span className="mt-[18px] h-[27px] w-[27px] bg-moss" />
            <span className="h-[27px] w-[27px] bg-lime" />
          </div>
        </div>
      </div>
    </div>
  )
}
