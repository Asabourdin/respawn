import { useEffect, useMemo, useRef, useState } from 'react'
import type { VisibleStat } from '../../content/schema'
import type { SceneView } from '../../engine/types'
import type { Beat as BeatData, NarrationEntry, StartupCard as StartupData } from '../../store/game'
import { SIREN, SPARKLE } from '../art/sprites'
import { CharacterSheet, SheetBody, type SheetData } from '../components/CharacterSheet'
import { ChoiceList, shortcutMap, type ChoiceItem } from '../components/Choices'
import { Hud } from '../components/Hud'
import { Bust } from '../components/PixelImg'
import { SceneArt } from '../components/SceneArt'
import { Sprite } from '../components/Sprite'
import { PixelSpinner, Typewriter, TypingDots } from '../components/Text'
import { pixelSafe } from '../format'
import { useCountUp, useKeys, useMediaQuery } from '../hooks'
import { isMuted, setMuted, sfx } from '../sfx'
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
  /** Who speaks in this scene (display name + 48 px bust). */
  speaker?: { name: string; bust?: string }
  /** 32 px emblems keyed by choice id (job offers). */
  emblems?: Record<string, string>
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
  /** 'desktop' = scene left, story right, sheet as a side panel. Defaults to the viewport. */
  layout?: 'phone' | 'desktop'
}

/** Haiku via the edge function answers in ~2–3 s; prefetched scenes are usually ready instantly. */
const NARRATION_WAIT_MS = 3400
const WAIT_LINES = ['The narrator is writing your life', 'PM is already at the board', 'Rolling the dice of fate', 'Asking your future self']
const SHEET_KEY = 'respawn.sheetOpen'

function readSheetPref() {
  try {
    return localStorage.getItem(SHEET_KEY) === '1'
  } catch {
    return false
  }
}

export function PlayView(p: PlayViewProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const desktop = (p.layout ?? (isDesktop ? 'desktop' : 'phone')) === 'desktop'
  const short = useMediaQuery('(max-height: 700px)')
  const [sheetOpen, setSheetOpenRaw] = useState(() => !!p.sheetOpen || (desktop && readSheetPref()))
  const setSheetOpen = (v: boolean) => {
    setSheetOpenRaw(v)
    if (desktop) {
      try {
        localStorage.setItem(SHEET_KEY, v ? '1' : '0')
      } catch {
        /* ignore */
      }
    }
  }
  const toggleSheet = () => {
    sfx.cursor()
    setSheetOpen(!sheetOpen)
  }
  // On desktop the sheet is a side panel, so it never blocks the keyboard.
  const sheetModal = sheetOpen && !desktop
  useKeys(
    (e) => {
      if ((e.key === 'c' || e.key === 'C') && p.sheet) {
        e.preventDefault()
        toggleSheet()
      } else if (e.key === 'm' || e.key === 'M') {
        setMuted(!isMuted())
      } else if (e.key === 'Escape' && p.onMenu) {
        e.preventDefault()
        p.onMenu()
      }
    },
    !sheetModal && !p.beat && !p.paused,
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
  // Every new scene starts at the top, even if you scrolled to reach a choice.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [p.stepKey])
  const scene = p.scene

  const hud = (
    <Hud
      age={p.age}
      displayAge={displayAge}
      phase={p.phase}
      majorCount={p.majorCount}
      majorsDone={p.majorsDone}
      stats={p.stats}
      arrows={p.beat?.outcome.arrows}
      onMenu={p.onMenu}
      onSheet={p.sheet ? toggleSheet : undefined}
      sheetOpen={sheetOpen}
      wide={desktop}
    />
  )
  const body = scene ? (
    <SceneBody
      key={p.stepKey}
      {...p}
      scene={scene}
      desktop={desktop}
      scroller={scroller}
      held={!!p.beat || !!showStartup}
      disabled={!!p.beat || !!showStartup || sheetModal || !!p.paused}
    />
  ) : (
    <EventLoading />
  )
  const overlays = (
    <>
      {p.beat && <Beat beat={p.beat} displayAge={displayAge} onDone={p.onDismissBeat} />}
      {showStartup && p.startup && <StartupCard card={p.startup} onDone={() => p.onDismissStartup?.()} />}
      {sheetModal && p.sheet && <CharacterSheet data={{ ...p.sheet, age: displayAge }} onClose={() => setSheetOpen(false)} />}
    </>
  )

  if (desktop) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-forest">
        {hud}
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1 bg-night">
            <SceneArt art={scene?.art} phase={p.phase} pace={p.pace} fit className="absolute inset-0" />
            {scene && <SceneTags scene={scene} family={p.family} />}
          </div>
          <div
            ref={scroller}
            className="flex w-[460px] shrink-0 flex-col gap-[18px] overflow-y-auto border-l-[3px] border-night px-[24px] py-[24px] xl:w-[540px]"
          >
            {body}
          </div>
          {sheetOpen && p.sheet && (
            <aside className="w-[340px] shrink-0 overflow-y-auto border-l-[3px] border-night bg-forest px-[18px] py-[18px]" aria-label="Character sheet">
              <div className="mb-[12px] flex items-center justify-between">
                <h2 className="font-mono text-[28px] leading-none text-lime">CHARACTER</h2>
                <button type="button" className="min-h-[44px] px-[6px] font-mono text-[20px] text-stone hover:text-paper" onClick={toggleSheet}>
                  C to hide
                </button>
              </div>
              <SheetBody data={{ ...p.sheet, age: displayAge }} />
            </aside>
          )}
        </div>
        {overlays}
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-forest">
      {hud}
      <div className="relative shrink-[1000] basis-[188px] overflow-hidden border-y-[3px] border-night" style={{ minHeight: short ? 80 : 104 }}>
        <SceneArt art={scene?.art} phase={p.phase} pace={p.pace} className="absolute inset-0" />
        {scene && <SceneTags scene={scene} family={p.family} />}
      </div>
      <div ref={scroller} className="no-scrollbar flex min-h-0 shrink flex-col gap-[12px] overflow-y-auto px-[15px] pt-[12px] pb-[max(15px,env(safe-area-inset-bottom))]">
        {body}
      </div>
      {overlays}
    </div>
  )
}

const LOADING_LINES = ['Something is happening...', 'Life has other plans...', 'Consulting PM...', 'Rolling the dice of fate...', 'Checking your horoscope, ironically...']

/** While an AI event is being written: a spinner and rotating, slightly absurd copy. */
function EventLoading() {
  const [k, setK] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setK((x) => (x + 1) % LOADING_LINES.length), 1100)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="pwin-dark flex items-center gap-[15px] px-[18px] py-[18px]" role="status">
      <PixelSpinner label="Something is happening" />
      <p key={k} className="rise-in t-body text-stone">
        {LOADING_LINES[k]}
      </p>
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
        <div className="flex items-center gap-[6px] bg-gold px-[9px] py-[4px]">
          <Sprite rows={SIREN} scale={3} className="anim-blink" />
          <span className="font-tag text-[15px] leading-none text-night">BREAKING</span>
        </div>
        <div className="hazard flex-1" />
      </div>
    )
  }
  if (scene.kind === 'event') {
    return (
      <div className="absolute top-[6px] left-[6px] flex items-center gap-[6px] bg-night px-[8px] py-[4px]">
        <Sprite rows={SIREN} scale={2} />
        <span className="font-tag text-[14px] leading-none text-gold">{family === 'student' ? 'CAMPUS NEWS' : 'LIFE EVENT'}</span>
      </div>
    )
  }
  if (scene.kind === 'mini') {
    return (
      <div className="absolute top-[6px] left-[6px] bg-night px-[8px] py-[4px]">
        <span className="font-tag text-[14px] leading-none text-mint">QUICK ONE</span>
      </div>
    )
  }
  return null
}

function WaitLine() {
  const [i, setI] = useState(() => Math.floor(Math.random() * WAIT_LINES.length))
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % WAIT_LINES.length), 1300)
    return () => window.clearInterval(id)
  }, [])
  return <span className="font-mono text-[20px] leading-none text-slate">{WAIT_LINES[i]}…</span>
}

function SceneBody(
  p: PlayViewProps & { scene: SceneView; disabled: boolean; held: boolean; desktop: boolean; scroller: React.RefObject<HTMLDivElement | null> },
) {
  const { scene, narration } = p
  const mini = scene.kind === 'mini'
  const canNarrate = scene.narrate && !scene.isAiEvent && !mini
  const initial: 'wait' | 'base' | 'ai' =
    p.forceMode ?? (!canNarrate ? 'base' : narration?.status === 'ready' ? 'ai' : narration?.status === 'failed' ? 'base' : 'wait')
  const [mode, setMode] = useState(initial)
  const [typed, setTyped] = useState(false)
  // Minis are quick beats: their text appears at once.
  const [skip, setSkip] = useState(mini)
  const [pressed, setPressed] = useState<string | null>(null)
  const choicesRef = useRef<HTMLDivElement>(null)

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

  // If the choices still don't fit, bring them into view once the text is in.
  useEffect(() => {
    if (!typed) return
    const sc = p.scroller.current
    const list = choicesRef.current
    if (!sc || !list) return
    if (sc.scrollHeight > sc.clientHeight + 2) list.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [typed, p.scroller])

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
        icon: p.emblems?.[c.id],
      })),
    [scene.choices, labels, p.surpriseIds, p.emblems],
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
        if (choices.some((c) => c.locked)) sfx.locked()
      }
    },
    !p.disabled,
  )

  const speaker = p.speaker ?? (scene.speaker ? { name: scene.speaker } : undefined)
  return (
    <>
      <section
        className={
          'pwin relative flex min-h-[96px] flex-col gap-[9px] ' +
          (p.desktop ? 'shrink-0 px-[24px] py-[20px]' : 'no-scrollbar shrink overflow-y-auto ' + (mini ? 'px-[15px] py-[10px]' : 'px-[16px] py-[12px]'))
        }
        onClick={() => setSkip(true)}
        aria-label={scene.title}
      >
        <div className="flex items-start gap-[12px]">
          {speaker?.bust && <Bust path={speaker.bust} name={speaker.name} scale={p.desktop ? 2 : 1} />}
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="flex items-start justify-between gap-[9px]">
              <h2 className={(mini ? 'text-[19px]' : 't-title') + ' font-bold text-forest'}>{pixelSafe(scene.title)}</h2>
              {scene.isAiEvent && (
                <span className="mt-[3px] flex shrink-0 items-center gap-[3px] text-slate" title="Event written by AI for this life">
                  <Sprite rows={SPARKLE} scale={2} color="slate" />
                  <span className="font-tag text-[14px] leading-none">AI</span>
                </span>
              )}
            </div>
            {speaker && <span className="font-mono text-[22px] leading-none text-moss">{pixelSafe(speaker.name)}</span>}
          </div>
        </div>
        <div className="relative">
          {p.held ? (
            <p className="invisible t-body" aria-hidden>
              {text}
            </p>
          ) : mode === 'wait' ? (
            <>
              <p className="invisible t-body" aria-hidden>
                {pixelSafe(scene.text)}
              </p>
              <div className="absolute inset-0 flex items-start pt-[6px]">
                <span className="flex items-center gap-[9px]">
                  <TypingDots />
                  <WaitLine />
                </span>
              </div>
            </>
          ) : (
            <Typewriter text={text} skip={skip} cps={mini ? 400 : 75} sound={!mini} onDone={() => setTyped(true)} className="t-body text-forest" />
          )}
        </div>
      </section>
      {mode !== 'wait' && !p.held && (
        <div ref={choicesRef} className="rise-in shrink-0">
          <ChoiceList choices={choices} compact={mini} onChoose={choose} disabled={p.disabled} pressedId={pressed} />
        </div>
      )}
    </>
  )
}
