/**
 * ?gallery — every screen and component in its states, driven by mocks (no engine, no AI).
 * Each frame is a 390×780 phone so layouts are reviewed at the real target size.
 */
import type { ReactNode } from 'react'
import { ASSET_KEYS, SCENE_KEYS, SCENES } from '../art/scenes'
import * as S from '../art/sprites'
import { PixelCanvas } from '../components/PixelCanvas'
import { SceneArt } from '../components/SceneArt'
import { Sprite } from '../components/Sprite'
import { EndView, type EndViewProps } from '../screens/End'
import { NewLifeView } from '../screens/NewLife'
import { PauseMenu } from '../screens/PauseMenu'
import { PlayView, type PlayViewProps } from '../screens/Play'
import { TitleView } from '../screens/Title'
import { Wordmark } from '../components/Wordmark'
import {
  beatFull,
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
  sceneMajor,
  sceneMini,
  startupLoading,
  startupReady,
} from './mocks'

const noop = () => {}
/** `?gallery&only=Beat` shows only the frames whose label contains the text (review one screen at a time). */
const ONLY = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('only')?.toLowerCase() : undefined

function Phone({ label, children, h = 780 }: { label: string; children: ReactNode; h?: number }) {
  if (ONLY && !label.toLowerCase().includes(ONLY)) return null
  return (
    <figure className="flex flex-col gap-[9px]">
      {!ONLY && <figcaption className="font-mono text-[20px] text-mint">{label}</figcaption>}
      <div className="relative w-[390px] overflow-hidden border-[3px] border-pine bg-forest" style={{ height: h }}>
        {children}
      </div>
    </figure>
  )
}

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
    initialStep: step,
    ...over,
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  if (ONLY && !title.toLowerCase().includes(ONLY) && !['play', 'title', 'end'].some((k) => title.toLowerCase().includes(k))) return null
  return (
    <section className="flex flex-col gap-[18px]">
      {!ONLY && <h2 className="border-b-[3px] border-pine pb-[6px] text-[28px] font-bold text-paper">{title}</h2>}
      <div className="flex flex-wrap gap-[30px]">{children}</div>
    </section>
  )
}

export default function Gallery() {
  return (
    <div className={'min-h-screen bg-night text-paper ' + (ONLY ? 'p-[6px]' : 'px-[24px] py-[24px]')}>
      <div className={'mb-[24px] flex items-center gap-[18px] ' + (ONLY ? 'hidden' : '')}>
        <div className="w-[260px]">
          <Wordmark iframes={false} />
        </div>
        <p className="max-w-[520px] text-[18px] text-stone">
          Gallery: every screen and state with mock data. Remove <code className="font-mono text-mint">?gallery</code> from the URL to play.
        </p>
      </div>

      <div className={'flex flex-col ' + (ONLY ? 'gap-0' : 'gap-[48px]')}>
        <Section title="Title and character creation">
          <Phone label="Title">
            <TitleView ready hasSave={false} onStart={noop} onContinue={noop} />
          </Phone>
          <Phone label="Title, saved life">
            <TitleView ready hasSave saveAge={34} onStart={noop} onContinue={noop} />
          </Phone>
          <Phone label="Create: first name">
            <NewLifeView rolled={null} pools={mockPools} onRoll={noop} onBegin={noop} onBack={noop} />
          </Phone>
          <Phone label="Create: last name">
            <NewLifeView rolled={null} pools={mockPools} onRoll={noop} onBegin={noop} onBack={noop} initialStep={1} />
          </Phone>
          <Phone label="Create: gender">
            <NewLifeView rolled={null} pools={mockPools} onRoll={noop} onBegin={noop} onBack={noop} initialStep={2} />
          </Phone>
          <Phone label="Profile roll + starting stats">
            <NewLifeView
              rolled={{ name: 'Lina', origin: mockPools.origins[0], budget: mockPools.budgets[0], trait: mockPools.traits[0], sheet: mockSheet }}
              pools={mockPools}
              onRoll={noop}
              onBegin={noop}
              onBack={noop}
            />
          </Phone>
        </Section>

        <Section title="Play">
          <Phone label="Major, base text">
            <PlayView {...play({})} />
          </Phone>
          <Phone label="Major, narrator writing">
            <PlayView {...play({ forceMode: 'wait' })} />
          </Phone>
          <Phone label="Mini (quick one)">
            <PlayView {...play({ scene: sceneMini })} />
          </Phone>
          <Phone label="Global event: BREAKING">
            <PlayView {...play({ scene: sceneGlobal, family: 'global', age: 26, phase: 'launch', pace: 0.55 })} />
          </Phone>
          <Phone label="AI event">
            <PlayView {...play({ scene: sceneAi, age: 34, phase: 'career', pace: 0.6 })} />
          </Phone>
          <Phone label="Job offers + AI surprise">
            <PlayView {...play({ scene: sceneJobs, surpriseIds: ['ai_surprise'], age: 23, phase: 'launch', majorsDone: 11 })} />
          </Phone>
          <Phone label="AI slot loading">
            <PlayView {...play({ scene: null, phase: 'career', age: 38 })} />
          </Phone>
          <Phone label="Consequence beat">
            <PlayView {...play({ beat: beatSimple })} />
          </Phone>
          <Phone label="Beat: years, promotion, check, fact">
            <PlayView {...play({ beat: beatFull, age: 35, phase: 'career', pace: 0.5 })} />
          </Phone>
          <Phone label="Startup naming">
            <PlayView {...play({ startup: startupLoading, phase: 'career', age: 40 })} />
          </Phone>
          <Phone label="Startup card">
            <PlayView {...play({ startup: startupReady, phase: 'career', age: 40 })} />
          </Phone>
          <Phone label="Character sheet (C)">
            <PlayView {...play({ sheetOpen: true })} />
          </Phone>
          <Phone label="Planet at 4°C pace">
            <PlayView {...play({ pace: 1, phase: 'oldage', age: 71, scene: { ...sceneMini, art: 'beach', title: 'A heatwave summer' } })} />
          </Phone>
          <Phone label="Pause menu">
            <PlayView {...play({ paused: true })} />
            <PauseMenu onResume={noop} onAbandon={noop} />
          </Phone>
        </Section>

        <Section title="End sequence">
          <Phone label="1 Death">
            <EndView {...end(0)} />
          </Phone>
          <Phone label="2 Epitaph loading">
            <EndView {...end(1, { epitaph: { status: 'loading' } })} />
          </Phone>
          <Phone label="2 Epitaph">
            <EndView {...end(1)} />
          </Phone>
          <Phone label="2 Epitaph (AI offline fallback)">
            <EndView {...end(1, { epitaph: { status: 'failed' } })} />
          </Phone>
          <Phone label="3 You">
            <EndView {...end(2)} />
          </Phone>
          <Phone label="4 Earth 2100">
            <EndView {...end(3)} />
          </Phone>
          <Phone label="5 Receipt">
            <EndView {...end(4)} />
          </Phone>
          <Phone label="6 Title + badges">
            <EndView {...end(5)} />
          </Phone>
          <Phone label="7 Respawn countdown">
            <EndView {...end(6)} />
          </Phone>
          <Phone label="7 Respawn result">
            <EndView {...end(6, { respawn: mockRespawn })} />
          </Phone>
          <Phone label="8 Share card">
            <EndView {...end(7)} />
          </Phone>
        </Section>

        <Section title="Procedural scenes (pace 0, then 1)">
          {SCENE_KEYS.map((k) => (
            <figure key={k} className="flex w-[390px] flex-col gap-[6px]">
              <figcaption className="font-mono text-[20px] text-mint">{k}</figcaption>
              <PixelCanvas draw={SCENES[k]} h={72} pace={0} seed={3} />
              <PixelCanvas draw={SCENES[k]} h={72} pace={1} seed={3} />
            </figure>
          ))}
        </Section>

        <Section title="Background assets (pace 0.2, then 0.9; procedural if missing)">
          {ASSET_KEYS.map((k) => (
            <figure key={k} className="flex w-[390px] flex-col gap-[6px]">
              <figcaption className="font-mono text-[20px] text-mint">{k}</figcaption>
              <SceneArt art={k} pace={0.2} className="h-[216px]" />
              <SceneArt art={k} pace={0.9} className="h-[216px]" />
            </figure>
          ))}
        </Section>

        <Section title="Sprites">
          <div className="flex flex-wrap items-end gap-[24px] bg-forest p-[18px]">
            {(
              [
                ['sprout', S.SPROUT, 6],
                ['seed', S.SPROUT_SEED, 6],
                ['wilted', S.SPROUT_WILT, 6],
                ['money', S.ICON.money, 6],
                ['happiness', S.ICON.happiness, 6],
                ['social', S.ICON.social, 6],
                ['fame', S.ICON.fame, 6],
                ['impact', S.ICON.contribution, 6],
                ['lock', S.LOCK, 6],
                ['siren', S.SIREN, 6],
                ['medal', S.MEDAL, 6],
                ['hourglass', S.HOURGLASS, 6],
                ['sheet', S.SHEET, 6],
                ['dice', S.DICE[4], 6],
                ['tombstone', S.TOMBSTONE, 4],
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
