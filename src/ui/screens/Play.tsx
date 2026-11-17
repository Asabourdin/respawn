import { useEffect, useMemo, useRef, useState } from 'react'
import type { VisibleStat } from '../../content/schema'
import type { SceneView } from '../../engine/types'
import type { Beat as BeatData, NarrationEntry, StartupCard as StartupData } from '../../store/game'
import { SIREN, SPARKLE } from '../art/sprites'
import { CharacterSheet, type SheetData } from '../components/CharacterSheet'
import { ChoiceList, shortcutMap, type ChoiceItem } from '../components/Choices'
import { Hud } from '../components/Hud'
import { SceneArt } from '../components/SceneArt'
import { Sprite } from '../components/Sprite'
import { PixelSpinner, Typewriter, TypingDots } from '../components/Text'
import { pixelSafe } from '../format'
import { useCountUp, useKeys, useMediaQuery } from '../hooks'
import { sfx } from '../sfx'
import { Beat } from './Beat'
import { StartupCard } from './StartupCard'

export interface PlayViewProps {
  /** null while an AI event is being written. */
  scene: SceneView | null
  stepKey: string
  family?: string
  stats: Record<VisibleStat, number>
  age: number
  phase: SceneView['phase']
  majorsDone: number
  majorCount: number
  pace: number
  narration?: NarrationEntry
  /** Choice ids that appeared late (AI surprise offer). */
  surpriseIds?: string[]
  beat: BeatData | null
  startup?: StartupData | null
  onChoose: (id: string, label: string) => void
  onDismissBeat: () => void
  onDismissStartup?: () => void
  onMenu?: () => void
  /** Character sheet data (opened from the HUD or with C). */
  sheet?: SheetData
  /** Gallery: open the sheet immediately. */
  sheetOpen?: boolean
  /** A modal from the container (pause menu) is open: freeze input. */
  paused?: boolean
  /** Gallery: freeze the narration decision. */
  forceMode?: 'wait' | 'base' | 'ai'
}

const NARRATION_WAIT_MS = 1200

export function PlayView(p: PlayViewProps) {
  const short = useMediaQuery('(max-height: 700px)')
  const [sheetOpen, setSheetOpen] = useState(!!p.sheetOpen)
  const openSheet = () => {
    sfx.cursor()
    setSheetOpen(true)
  }
  useKeys(
    (e) => {
      if ((e.key === 'c' || e.key === 'C') && p.sheet) {
        e.preventDefault()
        openSheet()
      } else if (e.key === 'Escape' && p.onMenu) {
        e.preventDefault()
        p.onMenu()
      }
    },
    !sheetOpen && !p.beat && !p.paused,
  )
  const beatAge = useCountUp(p.beat ? p.beat.ageTo : p.age, p.beat ? Math.min(1100, Math.max(0, (p.beat.ageTo - p.beat.ageFrom) * 120)) : 0, p.beat ? p.beat.ageFrom : p.age)
  const displayAge = p.beat ? beatAge : p.age

  // Tick sound while years pass.
  const ageFloor = Math.floor(beatAge)
  const beatFrom = p.beat ? Math.floor(p.beat.ageFrom) : -1
  useEffect(() => {
    if (beatFrom >= 0 && ageFloor !== beatFrom) sfx.tick()
  }, [ageFloor, beatFrom])

  const showStartup = !p.beat && p.startup && !p.startup.seen
  // Every new scene starts at the top of the page, even if you scrolled to reach a choice.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [p.stepKey])
  const scene = p.scene

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-forest">
      <Hud
        age={p.age}
        displayAge={displayAge}
        phase={p.phase}
        majorCount={p.majorCount}
        majorsDone={p.majorsDone}
        stats={p.stats}
        arrows={p.beat?.outcome.arrows}
        onMenu={p.onMenu}
        onSheet={p.sheet ? openSheet : undefined}
      />
      <div className="relative shrink-[1000] basis-[216px] overflow-hidden border-y-[3px] border-night" style={{ minHeight: short ? 96 : 132 }}>
        <SceneArt art={scene?.art} phase={p.phase} pace={p.pace} className="absolute inset-0" />
        {scene && <SceneTags scene={scene} family={p.family} />}
      </div>
      <div ref={scroller} className="no-scrollbar flex min-h-0 shrink flex-col gap-[18px] overflow-y-auto px-[15px] pt-[15px] pb-[max(18px,env(safe-area-inset-bottom))]">
        {scene ? (
          <SceneBody key={p.stepKey} {...p} scene={scene} held={!!p.beat || !!showStartup} disabled={!!p.beat || !!showStartup || sheetOpen || !!p.paused} />
        ) : (
          <div className="pwin-dark flex items-center gap-[15px] px-[18px] py-[18px]">
            <PixelSpinner label="Something is happening" />
            <p className="text-[18px] text-stone">Something is happening...</p>
          </div>
        )}
      </div>
      {p.beat && <Beat beat={p.beat} displayAge={displayAge} onDone={p.onDismissBeat} />}
      {showStartup && p.startup && <StartupCard card={p.startup} onDone={() => p.onDismissStartup?.()} />}
      {sheetOpen && p.sheet && <CharacterSheet data={{ ...p.sheet, age: displayAge }} onClose={() => setSheetOpen(false)} />}
    </div>
  )
}

function SceneTags({ scene, family }: { scene: SceneView; family?: string }) {
  const breaking = scene.kind === 'event' && family === 'global'
  useEffect(() => {
    if (breaking) sfx.alarm()
  }, [breaking, scene.id])
  if (breaking) {
    return (
      <div className="absolute inset-x-0 top-0 flex items-stretch" role="status">
        <div className="hazard w-[24px]" />
        <div className="flex items-center gap-[6px] bg-heat px-[9px] py-[3px]">
          <Sprite rows={SIREN} scale={3} className="anim-blink" />
          <span className="font-tag text-[14px] leading-none text-paper">BREAKING</span>
        </div>
        <div className="hazard flex-1" />
      </div>
    )
  }
  if (scene.kind === 'event') {
    return (
      <div className="absolute top-[6px] left-[6px] flex items-center gap-[6px] bg-night px-[6px] py-[3px]">
        <Sprite rows={SIREN} scale={2} />
        <span className="font-tag text-[11px] leading-none text-gold">{family === 'student' ? 'CAMPUS NEWS' : 'LIFE EVENT'}</span>
      </div>
    )
  }
  if (scene.kind === 'mini') {
    return (
      <div className="absolute top-[6px] left-[6px] bg-night px-[6px] py-[3px]">
        <span className="font-tag text-[11px] leading-none text-mint">QUICK ONE</span>
      </div>
    )
  }
  return null
}

function SceneBody(p: PlayViewProps & { scene: SceneView; disabled: boolean; held: boolean }) {
  const { scene, narration } = p
  const canNarrate = scene.narrate && !scene.isAiEvent
  const initial: 'wait' | 'base' | 'ai' =
    p.forceMode ?? (!canNarrate ? 'base' : narration?.status === 'ready' ? 'ai' : narration?.status === 'failed' ? 'base' : 'wait')
  const [mode, setMode] = useState(initial)
  const [typed, setTyped] = useState(false)
  const [skip, setSkip] = useState(false)
  const [pressed, setPressed] = useState<string | null>(null)

  // Decide once: narration that lands within the window wins; later ones never swap mid-read.
  useEffect(() => {
    if (p.forceMode || mode !== 'wait') return
    if (narration?.status === 'ready') setMode('ai')
    else if (narration?.status === 'failed') setMode('base')
  }, [narration?.status, mode, p.forceMode])
  useEffect(() => {
    if (p.forceMode || mode !== 'wait' || p.held) return
    const id = window.setTimeout(() => setMode((m) => (m === 'wait' ? 'base' : m)), NARRATION_WAIT_MS)
    return () => window.clearTimeout(id)
  }, [mode, p.forceMode, p.held])

  const text = pixelSafe(mode === 'ai' && narration?.narration ? narration.narration.text : scene.text)
  const labels = mode === 'ai' ? narration?.narration?.choiceLabels : undefined
  const choices: ChoiceItem[] = useMemo(
    () =>
      scene.choices.map((c) => ({
        id: c.id,
        label: (!c.locked && labels?.[c.id]) || c.label,
        hint: c.hint,
        locked: c.locked,
        lockedReason: c.lockedReason,
        surprise: p.surpriseIds?.includes(c.id),
      })),
    [scene.choices, labels, p.surpriseIds],
  )
  const keys = useMemo(() => shortcutMap(choices), [choices])

  const choose = (id: string) => {
    if (p.disabled || mode === 'wait') return
    const c = choices.find((x) => x.id === id)
    if (!c || c.locked) return
    sfx.confirm()
    setPressed(id)
    window.setTimeout(() => p.onChoose(id, c.label), 90)
  }

  useKeys(
    (e) => {
      if (mode === 'wait') return
      if ((e.key === ' ' || e.key === 'Enter') && !typed) {
        e.preventDefault()
        setSkip(true)
        return
      }
      const id = keys.get(e.key)
      if (id) {
        e.preventDefault()
        choose(id)
      } else if (/^[1-9]$/.test(e.key)) {
        const lockedExists = choices.some((c) => c.locked)
        if (lockedExists) sfx.locked()
      }
    },
    !p.disabled,
  )

  const mini = scene.kind === 'mini'
  const speaker = scene.speaker
  return (
    <>
      <section
        className={'pwin relative flex flex-col gap-[9px] ' + (mini ? 'px-[15px] py-[12px]' : 'px-[18px] py-[15px]')}
        onClick={() => setSkip(true)}
        aria-label={scene.title}
      >
        <div className="flex items-start justify-between gap-[9px]">
          <h2 className={(mini ? 'text-[18px]' : 'text-[21px]') + ' leading-[1.15] font-bold text-forest'}>{pixelSafe(scene.title)}</h2>
          {scene.isAiEvent && (
            <span className="mt-[3px] flex shrink-0 items-center gap-[3px] text-slate" title="Event written by AI for this life">
              <Sprite rows={SPARKLE} scale={2} color="slate" />
              <span className="font-tag text-[10px] leading-none">AI</span>
            </span>
          )}
        </div>
        {speaker && <span className="-mt-[6px] font-mono text-[21px] leading-none text-moss">{pixelSafe(speaker)}</span>}
        <div className="relative">
          {p.held ? (
            <p className="invisible text-[18px] leading-[1.4]" aria-hidden>
              {text}
            </p>
          ) : mode === 'wait' ? (
            <>
              <p className="invisible text-[18px] leading-[1.4]" aria-hidden>
                {pixelSafe(scene.text)}
              </p>
              <div className="absolute inset-0 flex items-start pt-[6px]">
                <TypingDots />
              </div>
            </>
          ) : (
            <Typewriter text={text} skip={skip} onDone={() => setTyped(true)} className="text-[18px] leading-[1.4] text-forest" />
          )}
        </div>
      </section>
      {mode !== 'wait' && !p.held && (
        <div className="rise-in">
          <ChoiceList choices={choices} compact={mini} onChoose={choose} disabled={p.disabled} pressedId={pressed} />
        </div>
      )}
    </>
  )
}
