import { useEffect, useRef, useState } from 'react'
import { SPROUT } from '../art/sprites'
import { Sprite } from './Sprite'
import { useReducedMotion } from '../hooks'
import { sfx } from '../sfx'

interface TypewriterProps {
  text: string
  /** Characters per second. */
  cps?: number
  /** Reveal everything now. */
  skip?: boolean
  onDone?: () => void
  className?: string
  sound?: boolean
  /** Keep the typing position visible inside the nearest scrolling box (clipped story card). */
  follow?: boolean
}

/**
 * Types text in place. The untyped remainder is rendered invisible so the box never
 * changes height while typing (no layout jumps).
 */
export function Typewriter({ text, cps = 75, skip, onDone, className, sound = true, follow = true }: TypewriterProps) {
  const reduced = useReducedMotion()
  const [n, setN] = useState(reduced ? text.length : 0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (reduced || skip) {
      setN(text.length)
      return
    }
    setN(0)
    let i = 0
    const step = Math.max(1, Math.round(cps / 60))
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + step)
      setN(i)
      if (sound && i % 6 === 0 && text[i] !== ' ') sfx.type()
      if (i >= text.length) window.clearInterval(id)
    }, 1000 / Math.min(cps, 60))
    return () => window.clearInterval(id)
  }, [text, cps, reduced, skip, sound])

  const done = n >= text.length
  useEffect(() => {
    if (done) doneRef.current?.()
  }, [done, text])

  const caret = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!follow || !caret.current || n === 0) return
    let box = caret.current.parentElement
    while (box && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement
    if (!box) return
    const c = caret.current.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    if (c.bottom > b.bottom - 6) box.scrollTop += c.bottom - b.bottom + 6
  }, [n, follow])

  return (
    <p className={className} aria-live="polite">
      <span>{text.slice(0, n)}</span>
      <span ref={caret} aria-hidden />
      <span className="invisible" aria-hidden>
        {text.slice(n)}
      </span>
      {!done && <span className="sr-only">{text}</span>}
    </p>
  )
}

/** Three stepping squares: "the narrator is writing". */
export function TypingDots({ label = 'Writing your story' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-[6px]" role="status" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="anim-blink h-[9px] w-[9px] bg-moss" style={{ animationDelay: `${i * 0.18}s`, animationDuration: '0.9s' }} />
      ))}
    </span>
  )
}

/** Eight-block pixel spinner. */
export function PixelSpinner({ label = 'Loading', size = 3 }: { label?: string; size?: number }) {
  const pos = [
    [2, 0],
    [4, 0],
    [6, 2],
    [6, 4],
    [4, 6],
    [2, 6],
    [0, 4],
    [0, 2],
  ]
  return (
    <span role="status" aria-label={label} className="relative inline-block" style={{ width: 8 * size * 2, height: 8 * size * 2 }}>
      {pos.map(([x, y], i) => (
        <span
          key={i}
          className="anim-blink absolute bg-lime"
          style={{
            left: x * size * 2,
            top: y * size * 2,
            width: size * 4,
            height: size * 4,
            animationDuration: '0.8s',
            animationDelay: `${-0.8 + i * 0.1}s`,
          }}
        />
      ))}
      <span className="absolute inset-0 grid place-items-center">
        <Sprite rows={SPROUT} scale={Math.max(1, size - 2)} />
      </span>
    </span>
  )
}
