import { useMemo, useState } from 'react'
import type { Fact, VisibleStat } from '../content/schema'
import { content, engine, useGame } from '../store/game'
import { loadSave } from '../store/persist'
import type { SheetData } from './components/CharacterSheet'
import { Console } from './components/Console'
import { EndView } from './screens/End'
import { NewLifeView, type ProfileOpt } from './screens/NewLife'
import { PauseMenu } from './screens/PauseMenu'
import { PlayView } from './screens/Play'
import { TitleView } from './screens/Title'
import { VISIBLE } from './format'

function profileOf(id: string, pool: ProfileOpt[] | undefined): ProfileOpt {
  return pool?.find((o) => o.id === id) ?? { id, label: id, blurb: '' }
}

function TitleScreen() {
  const ready = useGame((s) => s.ready)
  const error = useGame((s) => s.error)
  const hasSave = useGame((s) => s.hasSave)
  const openNewLife = useGame((s) => s.openNewLife)
  const resume = useGame((s) => s.resume)
  const saveAge = useMemo(() => (hasSave ? loadSave()?.game.age : undefined), [hasSave])
  return <TitleView ready={ready} error={error} hasSave={hasSave} saveAge={saveAge} onStart={openNewLife} onContinue={resume} />
}

function NewLifeScreen() {
  const game = useGame((s) => s.game)
  const newLife = useGame((s) => s.newLife)
  const beginLife = useGame((s) => s.beginLife)
  const goTitle = useGame((s) => s.goTitle)
  const profiles = content?.profiles
  const pools = {
    origins: profiles?.origins ?? [],
    budgets: profiles?.budgets ?? [],
    traits: profiles?.traits ?? [],
  }
  const rolled = game
    ? {
        name: game.player.name,
        origin: profileOf(game.player.profile.originId, profiles?.origins),
        budget: profileOf(game.player.profile.budgetId, profiles?.budgets),
        trait: profileOf(game.player.profile.traitId, profiles?.traits),
        sheet: sheetFor(game),
      }
    : null
  return <NewLifeView rolled={rolled} pools={pools} onRoll={newLife} onBegin={beginLife} onBack={goTitle} />
}

function sheetFor(game: NonNullable<ReturnType<typeof useGame.getState>['game']>): SheetData {
  const p = content?.profiles
  const path = game.path ? content?.paths.find((x) => x.id === game.path?.pathId) : undefined
  return {
    name: [game.player.name, game.player.lastName].filter(Boolean).join(' '),
    age: game.age,
    phase: game.phase,
    stats: game.stats as unknown as Record<string, number>,
    profile: {
      origin: profileOf(game.player.profile.originId, p?.origins).label,
      budget: profileOf(game.player.profile.budgetId, p?.budgets).label,
      trait: profileOf(game.player.profile.traitId, p?.traits).label,
    },
    career: game.path ? [game.path.employerName, path?.name].filter(Boolean).join(', ') || undefined : game.startup?.name,
  }
}

function PlayScreen() {
  const s = useGame()
  const [paused, setPaused] = useState(false)
  const game = s.game
  if (!game || !engine || !content) return null
  const step = s.step
  const scene = step?.type === 'scene' ? step.scene : null
  const def = scene ? content.scenes.find((x) => x.id === scene.id) : undefined
  const stats = Object.fromEntries(VISIBLE.map((k) => [k, game.stats[k]])) as Record<VisibleStat, number>
  const majorsDone = game.history.filter((h) => h.kind === 'major').length
  let pace = 0
  try {
    pace = engine.planetPace(content, game)
  } catch {
    pace = 0
  }
  return (
    <>
      <PlayView
        scene={scene}
        stepKey={s.stepKey}
        family={def?.family}
        stats={stats}
        age={game.age}
        phase={scene?.phase ?? game.phase}
        majorsDone={scene?.majorIndex ?? majorsDone}
        majorCount={scene?.majorCount ?? 20}
        pace={pace}
        narration={s.narrations[s.stepKey]}
        surpriseIds={s.surprise?.status === 'done' ? ['ai_surprise'] : undefined}
        beat={s.beat}
        startup={s.startup}
        onChoose={s.choose}
        onDismissBeat={s.dismissBeat}
        onDismissStartup={s.dismissStartup}
        onMenu={() => setPaused(true)}
        sheet={sheetFor(game)}
        paused={paused}
      />
      {paused && (
        <PauseMenu
          onResume={() => setPaused(false)}
          onAbandon={() => {
            setPaused(false)
            s.abandon()
          }}
        />
      )}
      {s.error && <ErrorToast message={s.error} />}
    </>
  )
}

function EndScreen() {
  const s = useGame()
  const facts = useMemo(() => Object.fromEntries((content?.facts ?? []).map((f) => [f.id, f])) as Record<string, Fact>, [])
  if (!s.summary) return null
  return (
    <EndView
      summary={s.summary}
      epitaph={s.epitaph}
      facts={facts}
      respawn={s.respawn}
      onSimulate={s.simulateRespawn}
      onClearRespawn={s.clearRespawn}
      onReplay={s.replayFrom}
      onNewLife={s.openNewLife}
    />
  )
}

function ErrorToast({ message }: { message: string }) {
  const goTitle = useGame((s) => s.goTitle)
  return (
    <div className="absolute inset-x-[12px] bottom-[12px] z-[60] flex items-center gap-[12px] bg-heat px-[12px] py-[9px] text-paper" role="alert">
      <span className="flex-1 text-[16px] leading-tight">Something broke: {message}</span>
      <button type="button" className="pkey is-dark min-h-[44px] px-[12px] text-[16px]" onClick={goTitle}>
        Title
      </button>
    </div>
  )
}

export function Game() {
  const screen = useGame((s) => s.screen)
  return (
    <Console>
      {screen === 'title' && <TitleScreen />}
      {screen === 'newlife' && <NewLifeScreen />}
      {screen === 'play' && <PlayScreen />}
      {screen === 'end' && <EndScreen />}
    </Console>
  )
}
