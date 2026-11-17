/**
 * ?gallery — every screen and component in its states, driven by mocks (no engine, no AI).
 * Each frame is an iframe at a real device size (phone 375×812, desktop 1280×800) so media
 * queries behave exactly as on the device. `?gallery&frame=<id>` renders one frame alone.
 */
import type { ReactNode } from 'react'
import { ASSET_KEYS, SCENE_KEYS, SCENES } from '../art/scenes'
import * as S from '../art/sprites'
import { PixelCanvas } from '../components/PixelCanvas'
import { SceneArt } from '../components/SceneArt'
import { Sprite } from '../components/Sprite'
import { Wordmark } from '../components/Wordmark'
import { EndView, type EndViewProps } from '../screens/End'
import { NewLifeView } from '../screens/NewLife'
import { PauseMenu } from '../screens/PauseMenu'
import { PlayView, type PlayViewProps } from '../screens/Play'
import { TitleView } from '../screens/Title'
import {
  beatFull,
  beatMini,
  beatSimple,
  mockEpitaph,
  mockFacts,
  mockPools,
  mockRespawn,
  mockSheet,
  mockStats,
  mockSummary,
  sceneAi,
  sceneGlobal,
  sceneJobs,
  sceneLong,
  sceneMajor,
  sceneMini,
  startupLoading,
  startupReady,
} from './mocks'

const noop = () => {}
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const FRAME = params.get('frame')

const stats = {
  money: mockStats.money,
  happiness: mockStats.happiness,
  social: mockStats.social,
  fame: mockStats.fame,
  contribution: mockStats.contribution,
}

function play(over: Partial<PlayViewProps>): PlayViewProps {
  return {
    scene: sceneMajor,
    stepKey: 'k',
    stats,
    age: 18,
    phase: 'aidams12',
    majorsDone: 3,
    majorCount: 20,
    pace: 0.3,
    beat: null,
    onChoose: noop,
    onDismissBeat: noop,
    onMenu: noop,
    sheet: mockSheet,
    forceMode: 'base',
    ...over,
  }
}

function end(step: number, over: Partial<EndViewProps> = {}): EndViewProps {
  return {
    summary: mockSummary,
    epitaph: { status: 'ready', data: mockEpitaph },
    facts: mockFacts,
    respawn: null,
    onSimulate: noop,
    onClearRespawn: noop,
    onReplay: noop,
    onNewLife: noop,
    careerEmblem: 'assets/sprites/emp_consulting.png',
    initialStep: step,
    ...over,
  }
}

const pm = { name: 'PM', bust: 'assets/sprites/char_pm.png' }
const jobEmblems = {
  emp_tramontane: 'assets/sprites/emp_ai_startup.png',
  emp_verdant: 'assets/sprites/emp_ngo.png',
  emp_sterling: 'assets/sprites/emp_consulting.png',
  emp_goldbridge: 'assets/sprites/emp_bank.png',
}

type Size = 'phone' | 'desktop'
interface FrameDef {
  id: string
  label: string
  section: string
  size: Size
  render: () => ReactNode
}

const F: FrameDef[] = [
  // Title and character creation
  { id: 'title', label: 'Title', section: 'Title and character creation', size: 'phone', render: () => <TitleView ready hasSave={false} onStart={noop} onContinue={noop} /> },
  { id: 'title-save', label: 'Title, saved life', section: 'Title and character creation', size: 'phone', render: () => <TitleView ready hasSave saveAge={34} onStart={noop} onContinue={noop} /> },
  { id: 'title-desktop', label: 'Title (desktop)', section: 'Title and character creation', size: 'desktop', render: () => <TitleView ready hasSave saveAge={34} onStart={noop} onContinue={noop} /> },
  { id: 'create-first', label: 'Create: first name', section: 'Title and character creation', size: 'phone', render: () => <NewLifeView rolled={null} pools={mockPools} onRoll={noop} onBegin={noop} onBack={noop} /> },
  { id: 'create-gender', label: 'Create: gender', section: 'Title and character creation', size: 'phone', render: () => <NewLifeView rolled={null} pools={mockPools} onRoll={noop} onBegin={noop} onBack={noop} initialStep={2} /> },
  {
    id: 'roll',
    label: 'Profile roll + starting stats',
    section: 'Title and character creation',
    size: 'phone',
    render: () => (
      <NewLifeView
        rolled={{ name: 'Lina', origin: mockPools.origins[0], budget: mockPools.budgets[0], trait: mockPools.traits[0], sheet: mockSheet }}
        pools={mockPools}
        onRoll={noop}
        onBegin={noop}
        onBack={noop}
      />
    ),
  },

  // Play (phone)
  { id: 'play-major', label: 'Major', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({})} /> },
  { id: 'play-long', label: 'Long narration (45 words, 4 choices)', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ scene: sceneLong, phase: 'aidams34', age: 21, pace: 0.5 })} /> },
  { id: 'play-wait', label: 'Narrator writing', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ forceMode: 'wait' })} /> },
  { id: 'play-pm', label: "Mini with PM's portrait", section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ scene: sceneMini, speaker: pm })} /> },
  { id: 'play-breaking', label: 'Global event: BREAKING', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ scene: sceneGlobal, family: 'global', age: 26, phase: 'launch', pace: 0.55 })} /> },
  { id: 'play-ai', label: 'AI event', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ scene: sceneAi, age: 34, phase: 'career', pace: 0.6 })} /> },
  {
    id: 'play-jobs',
    label: 'Job offers: emblems + AI surprise',
    section: 'Play (phone 375×812)',
    size: 'phone',
    render: () => <PlayView {...play({ scene: sceneJobs, surpriseIds: ['ai_surprise'], emblems: jobEmblems, age: 23, phase: 'launch', majorsDone: 11 })} />,
  },
  { id: 'play-slot', label: 'AI event loading', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ scene: null, phase: 'career', age: 38 })} /> },
  { id: 'beat', label: 'Consequence beat', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ beat: beatSimple })} /> },
  { id: 'beat-mini', label: 'Mini beat (1.1 s)', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ scene: sceneMini, beat: beatMini })} /> },
  { id: 'beat-full', label: 'Beat: years, promotion, check, fact', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ beat: beatFull, age: 35, phase: 'career', pace: 0.5 })} /> },
  { id: 'startup', label: 'Startup card', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ startup: startupReady, phase: 'career', age: 40 })} /> },
  { id: 'startup-loading', label: 'Startup naming', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ startup: startupLoading, phase: 'career', age: 40 })} /> },
  { id: 'sheet', label: 'Character sheet (C)', section: 'Play (phone 375×812)', size: 'phone', render: () => <PlayView {...play({ sheetOpen: true })} /> },
  {
    id: 'hot',
    label: 'Planet at 4°C pace',
    section: 'Play (phone 375×812)',
    size: 'phone',
    render: () => <PlayView {...play({ pace: 1, phase: 'oldage', age: 71, scene: { ...sceneMini, art: 'beach', title: 'A heatwave summer' } })} />,
  },
  {
    id: 'pause',
    label: 'Pause menu',
    section: 'Play (phone 375×812)',
    size: 'phone',
    render: () => (
      <>
        <PlayView {...play({ paused: true })} />
        <PauseMenu onResume={noop} onAbandon={noop} />
      </>
    ),
  },

  // Play (desktop)
  { id: 'd-play', label: 'Play', section: 'Play (desktop 1280×800)', size: 'desktop', render: () => <PlayView {...play({ scene: sceneMini, speaker: pm })} /> },
  {
    id: 'd-play-sheet',
    label: 'Play + character sheet panel',
    section: 'Play (desktop 1280×800)',
    size: 'desktop',
    render: () => <PlayView {...play({ scene: sceneJobs, emblems: jobEmblems, surpriseIds: ['ai_surprise'], sheetOpen: true, phase: 'launch', age: 23, pace: 0.55 })} />,
  },
  { id: 'd-beat', label: 'Beat', section: 'Play (desktop 1280×800)', size: 'desktop', render: () => <PlayView {...play({ beat: beatFull, age: 35, phase: 'career' })} /> },

  // End (phone)
  { id: 'e-death', label: '1 Death', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(0)} /> },
  { id: 'e-epitaph-loading', label: '2 Epitaph loading', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(1, { epitaph: { status: 'loading' } })} /> },
  { id: 'e-epitaph', label: '2 Epitaph', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(1)} /> },
  { id: 'e-epitaph-fallback', label: '2 Epitaph (AI offline)', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(1, { epitaph: { status: 'failed' } })} /> },
  { id: 'e-you', label: '3 You', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(2)} /> },
  { id: 'e-earth', label: '4 Earth 2100', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(3)} /> },
  { id: 'e-receipt', label: '5 Receipt', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(4)} /> },
  { id: 'e-title', label: '6 Title + badges', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(5)} /> },
  { id: 'e-respawn', label: '7 Respawn countdown', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(6)} /> },
  { id: 'e-respawn-result', label: '7 Respawn result', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(6, { respawn: mockRespawn })} /> },
  { id: 'e-share', label: '8 Share card', section: 'End sequence (phone)', size: 'phone', render: () => <EndView {...end(7)} /> },

  // End (desktop)
  { id: 'd-death', label: '1 Death', section: 'End sequence (desktop 1280×800)', size: 'desktop', render: () => <EndView {...end(0)} /> },
  { id: 'd-epitaph', label: '2 Epitaph', section: 'End sequence (desktop 1280×800)', size: 'desktop', render: () => <EndView {...end(1)} /> },
  { id: 'd-results', label: '3 You + Earth 2100 + Receipt', section: 'End sequence (desktop 1280×800)', size: 'desktop', render: () => <EndView {...end(2)} /> },
  { id: 'd-title', label: '4 Title + badges', section: 'End sequence (desktop 1280×800)', size: 'desktop', render: () => <EndView {...end(3)} /> },
  { id: 'd-respawn', label: '5 Respawn result', section: 'End sequence (desktop 1280×800)', size: 'desktop', render: () => <EndView {...end(4, { respawn: mockRespawn })} /> },
  { id: 'd-share', label: '6 Share card', section: 'End sequence (desktop 1280×800)', size: 'desktop', render: () => <EndView {...end(5)} /> },
]

const SIZES: Record<Size, { w: number; h: number; scale: number }> = {
  phone: { w: 375, h: 812, scale: 1 },
  desktop: { w: 1280, h: 800, scale: 0.6 },
}

function FrameOnly({ def }: { def: FrameDef }) {
  return <div className="relative h-[100dvh] w-full overflow-hidden bg-forest">{def.render()}</div>
}

function FrameCard({ def }: { def: FrameDef }) {
  const s = SIZES[def.size]
  const src = `${window.location.pathname}?gallery&frame=${def.id}`
  return (
    <figure className="flex flex-col gap-[9px]">
      <figcaption className="flex items-baseline gap-[12px] font-mono text-[20px] text-mint">
        {def.label}
        <a href={src} target="_blank" rel="noreferrer" className="text-[18px] text-stone underline">
          open
        </a>
      </figcaption>
      <div className="overflow-hidden border-[3px] border-pine bg-forest" style={{ width: s.w * s.scale, height: s.h * s.scale }}>
        <iframe
          title={def.label}
          src={src}
          loading="lazy"
          width={s.w}
          height={s.h}
          style={{ border: 0, transform: `scale(${s.scale})`, transformOrigin: '0 0', width: s.w, height: s.h }}
        />
      </div>
    </figure>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[18px]">
      <h2 className="border-b-[3px] border-pine pb-[6px] text-[28px] font-bold text-paper">{title}</h2>
      <div className="flex flex-wrap gap-[30px]">{children}</div>
    </section>
  )
}

export default function Gallery() {
  if (FRAME) {
    const def = F.find((f) => f.id === FRAME)
    return def ? <FrameOnly def={def} /> : <p className="p-[24px] text-paper">Unknown frame "{FRAME}".</p>
  }
  const sections = [...new Set(F.map((f) => f.section))]
  return (
    <div className="min-h-screen bg-night px-[24px] py-[24px] text-paper">
      <div className="mb-[24px] flex items-center gap-[18px]">
        <div className="w-[260px]">
          <Wordmark iframes={false} />
        </div>
        <p className="t-body max-w-[640px] text-stone">
          Gallery: every screen and state with mock data, each in its own iframe at a real device size. Remove <code className="font-mono text-mint">?gallery</code>{' '}
          from the URL to play.
        </p>
      </div>

      <div className="flex flex-col gap-[48px]">
        {sections.map((sec) => (
          <Section key={sec} title={sec}>
            {F.filter((f) => f.section === sec).map((f) => (
              <FrameCard key={f.id} def={f} />
            ))}
          </Section>
        ))}

        <Section title="Background assets (pace 0.2, then 0.9)">
          {ASSET_KEYS.map((k) => (
            <figure key={k} className="flex w-[390px] flex-col gap-[6px]">
              <figcaption className="font-mono text-[20px] text-mint">{k}</figcaption>
              <SceneArt art={k} pace={0.2} className="relative h-[216px]" />
              <SceneArt art={k} pace={0.9} className="relative h-[216px]" />
            </figure>
          ))}
        </Section>

        <Section title="Procedural fallback scenes (pace 0, then 1)">
          {SCENE_KEYS.map((k) => (
            <figure key={k} className="flex w-[390px] flex-col gap-[6px]">
              <figcaption className="font-mono text-[20px] text-mint">{k}</figcaption>
              <PixelCanvas draw={SCENES[k]} h={72} pace={0} seed={3} />
              <PixelCanvas draw={SCENES[k]} h={72} pace={1} seed={3} />
            </figure>
          ))}
        </Section>

        <Section title="Hand-made sprites">
          <div className="flex flex-wrap items-end gap-[24px] bg-forest p-[18px]">
            {(
              [
                ['sprout', S.SPROUT, 6],
                ['money', S.ICON.money, 6],
                ['happiness', S.ICON.happiness, 6],
                ['social', S.ICON.social, 6],
                ['fame', S.ICON.fame, 6],
                ['impact', S.ICON.contribution, 6],
                ['lock', S.LOCK, 6],
                ['siren', S.SIREN, 6],
                ['hourglass', S.HOURGLASS, 6],
                ['sheet', S.SHEET, 6],
                ['dice', S.DICE[4], 6],
              ] as const
            ).map(([name, rows, sc]) => (
              <figure key={name} className="flex flex-col items-center gap-[6px]">
                <Sprite rows={rows} scale={sc} />
                <figcaption className="font-mono text-[18px] text-stone">{name}</figcaption>
              </figure>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
