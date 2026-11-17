import { useEffect, useRef, useState } from 'react'
import type { VisibleStat } from '../../content/schema'
import type { Beat as BeatData } from '../../store/game'
import { CHECK, CROSS, DICE, HOURGLASS, MEDAL } from '../art/sprites'
import { CHIP_STATS, statLabel } from '../components/CharacterSheet'
import { ArrowMark } from '../components/Hud'
import { Sprite } from '../components/Sprite'
import { STAT_META, VISIBLE, pixelSafe } from '../format'
import { useKeys } from '../hooks'
import { sfx } from '../sfx'

interface Props {
  beat: BeatData
  /** Age as it ticks (driven by the parent so the HUD ticks too). */
  displayAge: number
  onDone: () => void
}

/** Consequence beat: what happened, arrows, maybe a fact, maybe years passing. Tap to skip. */
export function Beat({ beat, displayAge, onDone }: Props) {
  const { outcome } = beat
  const years = Math.max(0, Math.round(beat.ageTo - beat.ageFrom))
  const fact = outcome.fact
  const moved = VISIBLE.filter((s) => (outcome.arrows[s] ?? 0) !== 0)
  const chips = CHIP_STATS.filter((c) => (!c.studentOnly || beat.student) && Math.abs(outcome.deltas[c.key as keyof typeof outcome.deltas] ?? 0) >= 0.5).map(
    (c) => {
      const up = (outcome.deltas[c.key as keyof typeof outcome.deltas] ?? 0) > 0
      return { key: c.key, up, good: up === c.upIsGood }
    },
  )
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const ups = moved.reduce((a, s) => a + (outcome.arrows[s] ?? 0), 0)
    if (beat.promotions > 0) sfx.promotion()
    else if (ups > 0) sfx.up()
    else if (ups < 0) sfx.down()
    else sfx.confirm()
    if (fact) return // a fact waits for the player
    // Quick beats stay quick: a mini's consequence is gone in about a second.
    const ms = beat.sceneKind === 'mini' && !beat.promotions ? 1100 : 1700 + Math.min(1000, years * 110) + (beat.promotions > 0 ? 600 : 0)
    const id = window.setTimeout(() => doneRef.current(), ms)
    return () => window.clearTimeout(id)
  }, [beat.id])

  useKeys((e) => {
    if (e.key === ' ' || e.key === 'Enter' || /^[1-9]$/.test(e.key) || e.key === 'Escape') {
      e.preventDefault()
      onDone()
    }
  })

  return (
    <div
      className="beat-dim absolute inset-0 z-30 flex items-center justify-center px-[15px] py-[24px]"
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-label="What happened"
    >
      <div className={'beat-pop pwin flex w-full flex-col gap-[12px] px-[18px] ' + (beat.sceneKind === 'mini' ? 'max-w-[340px] py-[14px]' : 'max-w-[400px] py-[18px] lg:max-w-[480px]')}>
        {beat.sceneKind !== 'mini' && <p className="t-meta text-slate">{pixelSafe(beat.sceneTitle)}</p>}
        <p className="flex items-start gap-[9px] t-choice font-bold text-forest">
          <span className="mt-[6px] h-[9px] w-[9px] shrink-0 bg-lime shadow-[0_0_0_3px_var(--color-forest)]" aria-hidden />
          {pixelSafe(beat.choiceLabel)}
        </p>
        {outcome.text && <p className="t-body text-forest">{pixelSafe(outcome.text)}</p>}
        {outcome.chance && <DiceCheck result={outcome.chance} stat={beat.checkStat} />}

        {(moved.length > 0 || chips.length > 0) && (
          <div className="flex flex-col gap-[9px] bg-forest px-[12px] py-[9px]">
            {moved.length > 0 && (
              <ul className="flex flex-wrap gap-x-[15px] gap-y-[9px]" aria-label="Life changes">
                {moved.map((s: VisibleStat) => (
                  <li key={s} className="flex items-center gap-[6px]">
                    <Sprite rows={STAT_META[s].icon} scale={3} title={STAT_META[s].label} />
                    <ArrowMark value={outcome.arrows[s] ?? 0} />
                  </li>
                ))}
              </ul>
            )}
            {chips.length > 0 && (
              <ul className="flex flex-wrap gap-[6px]" aria-label="Skill changes">
                {chips.map((c) => (
                  <li
                    key={c.key}
                    className={'px-[6px] py-[3px] font-tag text-[13px] leading-[15px] ' + (c.good ? 'bg-lime text-night' : 'bg-charcoal text-stone')}
                  >
                    {c.up ? '+' : '-'} {statLabel(c.key).toUpperCase()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {years > 0 && (
          <div className="flex items-center gap-[9px] bg-night px-[9px] py-[6px]">
            <Sprite rows={HOURGLASS} scale={3} className="anim-bob" />
            <span className="font-mono text-[24px] leading-none text-stone">
              {years === 1 ? 'A year passes' : `${years} years pass`}
            </span>
            <span className="ml-auto font-mono text-[30px] leading-none text-paper tabular-nums">{Math.floor(displayAge)}</span>
          </div>
        )}

        {beat.promotions > 0 && (
          <div className="flex items-center gap-[9px] bg-gold px-[9px] py-[6px] text-night">
            <Sprite rows={MEDAL} scale={3} />
            <span className="font-tag text-[14px]">{beat.promotions > 1 ? `Promoted x${beat.promotions}` : 'Promoted'}</span>
          </div>
        )}

        {fact && (
          <aside className="flex flex-col gap-[6px] bg-forest px-[12px] py-[10px] text-paper" aria-label="Did you know?">
            <span className="t-meta font-bold text-lime">Did you know?</span>
            <p className="t-body">{pixelSafe(fact.text)}</p>
            <p className="font-mono text-[19px] leading-none text-stone">Source: {pixelSafe(fact.source)}</p>
          </aside>
        )}

        <p className="anim-blink self-end font-mono text-[20px] leading-none text-slate">{fact ? 'Tap to continue' : 'Tap to skip'}</p>
      </div>
    </div>
  )
}

/** A die tumbles for half a second, then the check result lands. */
function DiceCheck({ result, stat }: { result: 'success' | 'failure'; stat?: string }) {
  const [face, setFace] = useState(0)
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    let k = 0
    const id = window.setInterval(() => {
      k++
      setFace(k % DICE.length)
      sfx.tick()
      if (k >= 6) {
        window.clearInterval(id)
        setLanded(true)
        if (result === 'success') sfx.coin()
        else sfx.locked()
      }
    }, 80)
    return () => window.clearInterval(id)
  }, [result])
  const ok = result === 'success'
  return (
    <div className={'flex items-center gap-[9px] self-start px-[9px] py-[6px] ' + (landed ? (ok ? 'bg-lime text-night' : 'bg-wine text-paper') : 'bg-forest text-paper')}>
      <Sprite rows={landed ? (ok ? CHECK : CROSS) : DICE[face]} scale={3} className={landed ? 'beat-pop' : 'anim-shake'} />
      <span className="font-tag text-[13px] leading-none">
        {(stat ? statLabel(stat) : 'Luck').toUpperCase()} CHECK{landed ? (ok ? ' PASSED' : ' FAILED') : '...'}
      </span>
    </div>
  )
}
