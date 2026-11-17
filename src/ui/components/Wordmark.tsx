import { useReducedMotion } from '../hooks'

const BASE = import.meta.env.BASE_URL
/** Content box of public/brand/wordmark-*.png (1080×390) with a little air around it. */
const CROP = { x: 96, y: 92, w: 768, h: 206, W: 1080, H: 390 }

/**
 * Official RESPAWN wordmark (sprout + "respawn"), cropped out of its rounded card so it sits
 * on any forest or paper surface. Blinks in like a character respawning (i-frames).
 */
export function Wordmark({ variant = 'dark', className, iframes = true }: { variant?: 'dark' | 'light'; className?: string; iframes?: boolean }) {
  const reduced = useReducedMotion()
  return (
    <div
      className={'relative mx-auto w-full overflow-hidden ' + (iframes && !reduced ? 'anim-iframes ' : '') + (className ?? '')}
      style={{ aspectRatio: `${CROP.w} / ${CROP.h}` }}
      role="img"
      aria-label="respawn"
    >
      <img
        src={`${BASE}brand/wordmark-${variant}.png`}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: `${(CROP.W / CROP.w) * 100}%`,
          left: `${(-CROP.x / CROP.w) * 100}%`,
          top: `${(-CROP.y / CROP.h) * 100}%`,
        }}
      />
    </div>
  )
}
