import { useRef, useState } from 'react'
import { LOCK, SPARKLE } from '../art/sprites'
import { pixelSafe } from '../format'
import { sfx } from '../sfx'
import { PixelImg } from './PixelImg'
import { Sprite } from './Sprite'

export interface ChoiceItem {
  id: string
  label: string
  hint?: string
  locked: boolean
  lockedReason?: string
  /** Appeared late (AI surprise offer): small reveal + tag. */
  surprise?: boolean
  /** 32 px emblem (employer offers). */
  icon?: string
}

interface Props {
  choices: ChoiceItem[]
  onChoose: (id: string) => void
  compact?: boolean
  disabled?: boolean
  /** Id currently being confirmed (press animation). */
  pressedId?: string | null
}

/** Number shortcuts go to unlocked choices only (1..n). */
export function shortcutMap(choices: ChoiceItem[]): Map<string, string> {
  const m = new Map<string, string>()
  let k = 1
  for (const c of choices) if (!c.locked) m.set(String(k++), c.id)
  return m
}

export function ChoiceList({ choices, onChoose, compact, disabled, pressedId }: Props) {
  const [shaking, setShaking] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const numbers = new Map<string, number>()
  choices.filter((c) => !c.locked).forEach((c, i) => numbers.set(c.id, i + 1))
  const twoUp = compact && choices.length === 2 && choices.every((c) => c.label.length < 30 && !c.hint && !c.icon)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const btns = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-choice]') ?? [])
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
    const next = btns[(i + dir + btns.length) % btns.length]
    if (next) {
      e.preventDefault()
      next.focus()
      sfx.cursor()
    }
  }

  return (
    <div
      ref={listRef}
      onKeyDown={onKeyDown}
      className={twoUp ? 'grid grid-cols-2 gap-[12px]' : 'flex flex-col gap-[12px]'}
      role="group"
      aria-label="Choices"
    >
      {choices.map((c) => {
        const num = numbers.get(c.id)
        const isShaking = shaking === c.id
        return (
          <button
            key={c.id}
            type="button"
            data-choice={c.id}
            aria-disabled={c.locked || disabled ? 'true' : undefined}
            aria-keyshortcuts={num ? String(num) : undefined}
            data-pressed={pressedId === c.id ? 'true' : undefined}
            onClick={() => {
              if (disabled) return
              if (c.locked) {
                sfx.locked()
                setShaking(c.id)
                window.setTimeout(() => setShaking(null), 300)
                return
              }
              onChoose(c.id)
            }}
            className={
              'pkey flex w-full items-start gap-[12px] text-left ' +
              (compact ? 'min-h-[50px] px-[12px] py-[9px] ' : 'min-h-[52px] px-[12px] py-[10px] ') +
              (isShaking ? 'anim-shake ' : '') +
              (c.surprise ? 'surprise-in ' : '')
            }
          >
            <span
              className={'grid h-[30px] w-[30px] shrink-0 place-items-center font-mono text-[26px] leading-none ' + (c.locked ? 'bg-night' : 'bg-forest text-lime')}
              aria-hidden
            >
              {c.locked ? <Sprite rows={LOCK} scale={3} /> : num}
            </span>
            {c.icon && <PixelImg path={c.icon} size={32} />}
            <span className="flex min-w-0 flex-1 flex-col gap-[3px] pt-[2px]">
              <span className={'t-choice ' + (c.locked ? 'text-stone' : '')}>
                {c.surprise && (
                  <span className="mr-[6px] inline-flex translate-y-[2px] items-center gap-[3px] bg-night px-[5px] py-[2px] font-tag text-[14px] leading-[15px] text-lime">
                    <Sprite rows={SPARKLE} scale={2} /> NEW
                  </span>
                )}
                {pixelSafe(c.label)}
              </span>
              {c.locked ? (
                <span className="font-mono text-[20px] leading-[1] text-stone">{pixelSafe(c.lockedReason) || 'Locked'}</span>
              ) : (
                c.hint && <span className="choice-hint t-meta">{pixelSafe(c.hint)}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
