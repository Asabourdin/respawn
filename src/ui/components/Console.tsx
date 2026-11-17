import type { ReactNode } from 'react'

/**
 * Responsive shell.
 * - phone (< 768 px): the game is the screen, safe-area aware.
 * - tablet (768–1023 px): one centred column, 640 px max, pixel pattern on the sides.
 * - desktop (≥ 1024 px): full width; each screen switches to its own wide layout.
 */
export function Console({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-night md:[background-image:var(--pattern)]">
      <div className="relative mx-auto h-full w-full overflow-hidden bg-forest md:max-w-[640px] md:border-x-[3px] md:border-pine lg:max-w-none lg:border-x-0">
        {children}
      </div>
    </div>
  )
}
