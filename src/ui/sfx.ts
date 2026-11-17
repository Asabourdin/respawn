/**
 * Tiny WebAudio chiptune blips. No samples, no assets: square/triangle oscillators.
 * Mute is persisted in localStorage (every access wrapped).
 */
const KEY = 'respawn.muted'

let ac: AudioContext | null = null
let master: GainNode | null = null
let muted = readMuted()
const listeners = new Set<() => void>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function audio(): AudioContext | null {
  if (muted) return null
  try {
    if (!ac) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ac = new Ctor()
      master = ac.createGain()
      master.gain.value = 0.5
      master.connect(ac.destination)
    }
    if (ac.state === 'suspended') void ac.resume()
    return ac
  } catch {
    return null
  }
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; at?: number; slideTo?: number } = {},
) {
  const a = audio()
  if (!a || !master) return
  const { type = 'square', vol = 0.08, at = 0, slideTo } = opts
  const t0 = a.currentTime + at
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(vol, t0)
  g.gain.setValueAtTime(vol, t0 + dur * 0.7)
  g.gain.linearRampToValueAtTime(0, t0 + dur)
  o.connect(g)
  g.connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568, C4: 262, G4: 392, E4: 330, A4: 440 }

export const sfx = {
  cursor() {
    tone(N.A5, 0.025, { vol: 0.04 })
  },
  type() {
    tone(N.C6 + Math.random() * 200, 0.012, { vol: 0.015 })
  },
  confirm() {
    tone(N.E5, 0.05)
    tone(N.B5, 0.09, { at: 0.05 })
  },
  locked() {
    tone(150, 0.09, { vol: 0.09 })
    tone(110, 0.14, { vol: 0.09, at: 0.09 })
  },
  alarm() {
    for (let i = 0; i < 3; i++) {
      tone(N.A5, 0.12, { at: i * 0.26, vol: 0.06 })
      tone(N.E5, 0.12, { at: i * 0.26 + 0.13, vol: 0.06 })
    }
  },
  promotion() {
    ;[N.C5, N.E5, N.G5, N.C6, N.G5, N.C6].forEach((f, i) => tone(f, 0.08, { at: i * 0.07, vol: 0.06 }))
  },
  coin() {
    tone(N.B5, 0.06, { vol: 0.06 })
    tone(N.E6, 0.18, { at: 0.06, vol: 0.06 })
  },
  tick() {
    tone(N.G5, 0.02, { vol: 0.03, type: 'triangle' })
  },
  up() {
    tone(N.C5, 0.05, { vol: 0.05 })
    tone(N.G5, 0.07, { at: 0.05, vol: 0.05 })
  },
  down() {
    tone(N.G4, 0.05, { vol: 0.05 })
    tone(N.C4, 0.09, { at: 0.05, vol: 0.05 })
  },
  death() {
    ;[N.B5, N.F5, N.F5, N.F5, N.E5, N.D5, N.C5].forEach((f, i) =>
      tone(f, 0.14, { at: i * 0.15, vol: 0.06, type: i > 3 ? 'triangle' : 'square' }),
    )
    tone(N.C4, 0.6, { at: 1.1, vol: 0.07, type: 'triangle', slideTo: 80 })
  },
  countdown(n: number) {
    tone(n === 0 ? N.C4 : N.A4, n === 0 ? 0.4 : 0.08, { vol: 0.06 })
  },
  respawn() {
    ;[N.C5, N.G5, N.E5, N.C6, N.E6, N.G6].forEach((f, i) => tone(f, 0.06, { at: i * 0.05, vol: 0.05 }))
  },
  reveal() {
    tone(N.C4, 0.9, { vol: 0.06, type: 'triangle', slideTo: N.C6 })
  },
}

export function isMuted() {
  return muted
}

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? '1' : '0')
  } catch {
    /* storage blocked: keep in memory */
  }
  if (m && ac) void ac.suspend().catch(() => {})
  listeners.forEach((l) => l())
}

export function subscribeMuted(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Unlock audio on the first user gesture (iOS). */
export function primeAudio() {
  audio()
}
