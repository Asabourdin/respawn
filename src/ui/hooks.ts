import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const RM_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeRM(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(RM_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeRM,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(RM_QUERY).matches : false),
    () => false,
  )
}

/** Global key handler (ignored while typing in an input). */
export function useKeys(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!enabled) return
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      ref.current(e)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [enabled])
}

/** Counts from `from` to `to` over `ms` in integer steps (instant with reduced motion). */
export function useCountUp(to: number, ms = 1200, from = 0, decimals = 0, start = true): number {
  const reduced = useReducedMotion()
  const [v, setV] = useState(reduced || !start ? (start ? to : from) : from)
  useEffect(() => {
    if (!start) {
      setV(from)
      return
    }
    if (reduced || ms <= 0) {
      setV(to)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      const eased = 1 - Math.pow(1 - k, 3)
      const f = Math.pow(10, decimals)
      setV(Math.round((from + (to - from) * eased) * f) / f)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, from, decimals, start, reduced])
  return v
}

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(q)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false),
    () => false,
  )
}
