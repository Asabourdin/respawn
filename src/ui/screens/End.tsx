import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Epitaph } from '../../ai/types'
import type { Fact } from '../../content/schema'
import type { EndSummary, ReceiptLine } from '../../engine/types'
import type { RespawnResult } from '../../store/game'
import { CATEGORY_ICON, CATEGORY_LABEL, iconUrl, sproutUrl, type IconName } from '../assets'
import { BG_H, BG_W } from '../art/bg'
import { city2100, thermometer, THERMO_MAX, THERMO_MIN } from '../art/end'
import { renderEarth, type EarthImages } from '../art/earthMix'
import type { Frame } from '../art/gfx'
import { PixelCanvas } from '../components/PixelCanvas'
import { PixelImg } from '../components/PixelImg'
import { Radar, YOU_LABELS, YOU_POLES } from '../components/Radar'
import { SceneArt, useAsset } from '../components/SceneArt'
import { PixelWord } from '../components/Sprite'
import { PixelSpinner } from '../components/Text'
import { fmtNum, fmtT, pixelSafe } from '../format'
import { useCountUp, useKeys, useMediaQuery, useReducedMotion } from '../hooks'
import { downloadShareCard, renderShareCard } from '../share'
import { sfx } from '../sfx'

export interface EndViewProps {
  summary: EndSummary
  epitaph: { status: 'idle' | 'loading' | 'ready' | 'failed'; data?: Epitaph }
  facts: Record<string, Fact>
  respawn: RespawnResult | null
  onSimulate: (historyIndex: number, altId: string, altLabel: string) => void
  onClearRespawn: () => void
  onReplay: (historyIndex: number) => void
  onNewLife: () => void
  /** Emblem of the last employer (assets/sprites/emp_*.png). */
  careerEmblem?: string
  initialStep?: number
  /** Defaults to the viewport. Desktop merges YOU + EARTH + RECEIPT into one wide page. */
  layout?: 'phone' | 'desktop'
}

type StepId = 'death' | 'epitaph' | 'you' | 'earth' | 'receipt' | 'results' | 'title' | 'respawn' | 'share'
const PHONE_STEPS: StepId[] = ['death', 'epitaph', 'you', 'earth', 'receipt', 'title', 'respawn', 'share']
const DESKTOP_STEPS: StepId[] = ['death', 'epitaph', 'results', 'title', 'respawn', 'share']
const NEXT_LABEL: Record<StepId, string> = {
  death: 'Read your epitaph',
  epitaph: 'See your life',
  you: 'See the Earth in 2100',
  earth: 'Print my receipt',
  receipt: 'Who was I?',
  results: 'Who was I?',
  title: 'Continue?',
  respawn: 'Make my card',
  share: 'New life',
}

export function EndView(p: EndViewProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const desktop = (p.layout ?? (isDesktop ? 'desktop' : 'phone')) === 'desktop'
  const steps = desktop ? DESKTOP_STEPS : PHONE_STEPS
  const [i, setI] = useState(() => Math.min(p.initialStep ?? 0, steps.length - 1))
  const idx = Math.min(i, steps.length - 1)
  const step = steps[idx]
  const scroller = useRef<HTMLDivElement>(null)
  const go = (n: number) => {
    const k = Math.max(0, Math.min(steps.length - 1, n))
    sfx.cursor()
    setI(k)
    scroller.current?.scrollTo({ top: 0 })
  }
  const next = () => (idx >= steps.length - 1 ? p.onNewLife() : go(idx + 1))
  useKeys((e) => {
    if (step === 'respawn') return // the respawn panel has its own keys
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement?.tagName === 'BUTTON' && e.key !== 'ArrowRight') return
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(idx - 1)
    }
  })

  return (
    <div className="flex h-full flex-col bg-forest">
      <div ref={scroller} key={step} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {step === 'death' && <Death summary={p.summary} desktop={desktop} />}
        {step === 'epitaph' && <EpitaphStep summary={p.summary} epitaph={p.epitaph} emblem={p.careerEmblem} desktop={desktop} />}
        {step === 'you' && <YouStep summary={p.summary} />}
        {step === 'earth' && <EarthStep summary={p.summary} />}
        {step === 'receipt' && <ReceiptStep summary={p.summary} facts={p.facts} />}
        {step === 'results' && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] gap-[24px] px-[24px] py-[24px] xl:gap-[36px] xl:px-[48px]">
            <div className="pwin-dark">
              <YouStep summary={p.summary} />
            </div>
            <div className="pwin-dark">
              <EarthStep summary={p.summary} />
            </div>
            <div className="pwin-dark">
              <ReceiptStep summary={p.summary} facts={p.facts} />
            </div>
          </div>
        )}
        {step === 'title' && <TitleStep summary={p.summary} emblem={p.careerEmblem} desktop={desktop} />}
        {step === 'respawn' && (
          <RespawnStep
            summary={p.summary}
            respawn={p.respawn}
            onSimulate={p.onSimulate}
            onClear={p.onClearRespawn}
            onReplay={p.onReplay}
            onSkip={() => go(idx + 1)}
            desktop={desktop}
          />
        )}
        {step === 'share' && <ShareStep summary={p.summary} desktop={desktop} />}
      </div>
      <nav
        className="flex items-center gap-[12px] border-t-[3px] border-night bg-night px-[15px] pt-[12px] pb-[max(12px,env(safe-area-inset-bottom))] lg:justify-center lg:gap-[18px]"
        aria-label="End sequence"
      >
        <button
          type="button"
          className="pkey is-dark grid h-[54px] w-[54px] shrink-0 place-items-center font-mono text-[30px]"
          onClick={() => go(idx - 1)}
          aria-label="Previous"
          aria-keyshortcuts="ArrowLeft"
          aria-disabled={idx === 0 || undefined}
        >
          {'<'}
        </button>
        <button type="button" className="pkey is-primary min-h-[54px] flex-1 px-[12px] text-[20px] font-bold lg:max-w-[420px] lg:flex-none lg:px-[48px]" onClick={next} aria-keyshortcuts="ArrowRight">
          {NEXT_LABEL[step]}
        </button>
        <span className="w-[48px] shrink-0 text-right font-mono text-[22px] text-stone" aria-label={`Step ${idx + 1} of ${steps.length}`}>
          {idx + 1}/{steps.length}
        </span>
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Section({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <section
      className={
        'mx-auto flex w-full flex-col gap-[15px] px-[15px] pt-[max(18px,env(safe-area-inset-top))] pb-[24px] lg:gap-[18px] lg:px-[24px] lg:pt-[24px] ' +
        (wide ? 'lg:max-w-[1100px] ' : 'lg:max-w-[760px] ') +
        (className ?? '')
      }
    >
      {children}
    </section>
  )
}

/** Width of an element (for integer-scaled pictures). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((e) => setW(Math.floor(e[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function Death({ summary, desktop }: { summary: EndSummary; desktop: boolean }) {
  useEffect(() => {
    sfx.death()
  }, [])
  const full = [summary.player?.name ?? summary.name, summary.player?.lastName].filter(Boolean).join(' ')
  const burnt = summary.earth.temperatureC >= 3.2
  return (
    <Section className="min-h-full items-center justify-center text-center" wide>
      <PixelWord text="GAME OVER" scale={desktop ? 7 : 5} color="paper" extrude={['slate']} className="mt-[6px]" />
      <div className="w-full border-[3px] border-night">
        <SceneArt art="graveyard" pace={0.2} fit className={desktop ? 'h-[360px]' : 'h-[180px]'} />
      </div>
      <div className="flex items-end gap-[18px]">
        <PixelImg path={sproutUrl(burnt ? 'burnt' : 'wilted')} size={40} scale={2} alt={burnt ? 'A burnt sprout' : 'A wilted sprout'} />
        <div className="flex flex-col items-start gap-[6px] text-left">
          <h1 className="text-[34px] leading-[1.05] font-bold text-paper lg:text-[44px]">You died at {summary.deathAge}.</h1>
          <p className="font-mono text-[26px] leading-none text-stone">
            {pixelSafe(full)}, 18 to {summary.deathAge}
          </p>
        </div>
      </div>
      <p className="t-body max-w-[460px] text-stone">
        {burnt
          ? 'Cause of death: a full life, on a planet running hot. Your sprout is done growing. Let us see what it left behind.'
          : 'Cause of death: a full life. Your sprout is done growing. Let us see what it left behind.'}
      </p>
    </Section>
  )
}

function fallbackEpitaph(s: EndSummary): Epitaph {
  const job = s.path?.employerName ?? s.path?.pathName
  return {
    obituary: `${s.name} died at ${s.deathAge}. Friends will remember them as ${s.title.title}: ${s.title.description}`,
    linkedinPost: `After ${s.deathAge - 18} years of choices${job ? ` (and a long chapter at ${job})` : ''}, I am thrilled to announce I am no longer open to opportunities. Grateful for every PM class I attended, and the ones I did not. #Respawn`,
    tips: [
      { text: 'Keep your phone two more years: most of its footprint comes from making it.', source: 'ADEME-Arcep, 2022' },
      { text: 'Swap one long-haul flight for a train holiday: a Paris-New York return is about 1.8 t CO2e.', source: 'Base Carbone / DGAC' },
    ],
  }
}

function EpitaphStep({ summary, epitaph, emblem, desktop }: { summary: EndSummary; epitaph: EndViewProps['epitaph']; emblem?: string; desktop: boolean }) {
  if (epitaph.status === 'loading' || epitaph.status === 'idle') {
    return (
      <Section className="min-h-full items-center justify-center text-center">
        <PixelImg path={sproutUrl('wilted')} size={40} scale={2} className="anim-bob" />
        <PixelSpinner label="Writing your obituary" />
        <p className="font-mono text-[28px] text-lime">Consulting PM about your legacy...</p>
        <p className="t-body text-stone">The AI is writing your obituary. A few seconds.</p>
      </Section>
    )
  }
  const e = epitaph.status === 'ready' && epitaph.data ? epitaph.data : fallbackEpitaph(summary)
  const job = summary.path?.employerName ?? summary.path?.pathName
  return (
    <Section wide>
      <h1 className="text-[26px] leading-tight font-bold text-paper lg:text-[34px]">In memory of {pixelSafe(summary.name)}</h1>
      <div className={desktop ? 'grid grid-cols-2 items-start gap-[24px]' : 'flex flex-col gap-[15px]'}>
        <div className="flex flex-col gap-[15px]">
          <article className="pwin px-[18px] py-[15px]">
            <p className="mb-[6px] font-mono text-[22px] text-slate">OBITUARY</p>
            <p className="t-body whitespace-pre-line">{pixelSafe(e.obituary)}</p>
          </article>
          <article className="pwin-dark flex flex-col gap-[9px] px-[15px] py-[15px]" aria-label="The LinkedOut post of your life">
            <div className="flex items-center gap-[12px]">
              <span className="grid h-[44px] w-[44px] shrink-0 place-items-center bg-pine">
                {emblem ? <PixelImg path={emblem} size={32} /> : <PixelImg path={sproutUrl('tree')} size={40} />}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="t-choice font-bold text-paper">{pixelSafe(summary.name)}</span>
                <span className="t-meta text-stone">{job ? `Formerly at ${pixelSafe(job)}` : 'Open to eternity'}</span>
              </div>
            </div>
            <p className="font-mono text-[20px] text-stone">The LinkedOut post of your life</p>
            <p className="t-body whitespace-pre-line text-paper">{pixelSafe(e.linkedinPost)}</p>
          </article>
        </div>
        <div className="flex flex-col gap-[12px]">
          <h2 className="t-title font-bold text-lime">Two things you can do for real</h2>
          {e.tips.slice(0, 2).map((t, k) => (
            <div key={k} className="flex gap-[12px] bg-night px-[12px] py-[12px]">
              <span className="font-mono text-[30px] leading-none text-lime">{k + 1}</span>
              <div className="flex flex-col gap-[6px]">
                <p className="t-body text-paper">{pixelSafe(t.text)}</p>
                <p className="font-mono text-[20px] leading-none text-stone">Source: {pixelSafe(t.source)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

function YouStep({ summary }: { summary: EndSummary }) {
  const series = useMemo(() => [{ values: YOU_POLES.map((k) => summary.you[k]), stroke: 'lime' as const, fill: 'moss' as const, density: 0.5 }], [summary])
  const sorted = [...YOU_POLES].sort((a, b) => summary.you[b] - summary.you[a])
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  return (
    <Section>
      <h1 className="text-[30px] leading-none font-bold text-paper">YOU</h1>
      <p className="t-meta text-stone">Your life on six poles, each out of 100. Planet = how light your footprint was.</p>
      <Radar series={series} labels={YOU_POLES.map((k) => YOU_LABELS[k])} ariaLabel="Your life radar" />
      <p className="t-body bg-night px-[12px] py-[10px] text-paper">
        Strongest: <span className="font-bold text-lime">{YOU_LABELS[best]}</span>. Weakest: <span className="font-bold text-ember">{YOU_LABELS[worst]}</span>.
      </p>
      <div className="grid grid-cols-3 gap-[9px]">
        <Tile big={String(summary.deathAge)} label="years lived" icon="hourglass" />
        <Tile big={`${Math.round(summary.digitalShare * (summary.digitalShare <= 1 ? 100 : 1))}%`} label="digital share (FR 4.4%)" icon="phone" />
        <Tile big={summary.screenYears.toFixed(1)} label="years on screens" icon="laptop" />
      </div>
    </Section>
  )
}

function Tile({ big, label, tone = 'paper', icon }: { big: string; label: string; tone?: 'paper' | 'heat' | 'ember' | 'lime'; icon?: IconName }) {
  return (
    <div className="flex min-w-0 flex-col gap-[6px] bg-night px-[10px] py-[10px]">
      {icon && <PixelImg path={iconUrl(icon)} size={32} />}
      <span className={'font-mono text-[36px] leading-none tabular-nums lg:text-[40px] ' + { paper: 'text-paper', heat: 'text-heat', ember: 'text-ember', lime: 'text-lime' }[tone]}>
        {big}
      </span>
      <span className="t-meta text-stone">{label}</span>
    </div>
  )
}

function useEarthImages(): EarthImages | null {
  const good = useAsset('assets/earth/earth_good.png')
  const mid = useAsset('assets/earth/earth_mid.png')
  const bad = useAsset('assets/earth/earth_bad.png')
  return good && mid && bad ? { good, mid, bad } : null
}

/** 2100 panorama: the three images dithered together by temperature, integer-scaled. */
function EarthPanorama({ temp, progress, ocean }: { temp: number; progress: number; ocean: number }) {
  const imgs = useEarthImages()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [wrap, width] = useWidth<HTMLDivElement>()
  const shown = 1.4 + (temp - 1.4) * progress
  useEffect(() => {
    if (imgs && canvas.current) renderEarth(canvas.current, imgs, shown)
  }, [imgs, shown])
  const s = Math.max(1, Math.floor(width / BG_W))
  return (
    <div ref={wrap} className="flex w-full justify-center bg-night">
      {imgs ? (
        <canvas
          ref={canvas}
          role="img"
          aria-label={`The Earth in 2100 at ${temp.toFixed(1)} degrees`}
          style={{ width: BG_W * s, height: BG_H * s, imageRendering: 'pixelated' }}
          className="block border-[3px] border-night"
        />
      ) : (
        <PixelCanvas draw={city2100} h={72} data={{ temp, sea: progress, ocean }} animate fps={8} label="A coastal city in 2100" className="w-full" />
      )}
    </div>
  )
}

function EarthStep({ summary }: { summary: EndSummary }) {
  const e = summary.earth
  const reduced = useReducedMotion()
  const progress = useCountUp(1, reduced ? 0 : 2600, 0, 2)
  const temp = useCountUp(e.temperatureC, 2600, 1.4, 1)
  const sea = useCountUp(e.oceanM, 2600, 0.38, 2)
  const insects = useCountUp(e.insectsPct, 2600, 0, 0)
  const heat = useCountUp(e.heatBillions, 2600, 0, 1)
  useEffect(() => {
    sfx.reveal()
  }, [])
  const thermoDraw = useCallback((f: Frame) => thermometer(f), [])
  const tTone = e.temperatureC >= 3 ? 'text-heat' : e.temperatureC >= 2 ? 'text-ember' : 'text-lime'
  return (
    <Section>
      <h1 className="text-[25px] leading-[1.15] font-bold text-paper lg:text-[30px]">The Earth in 2100 if 8 billion people lived like you</h1>
      <EarthPanorama temp={e.temperatureC} progress={progress} ocean={e.oceanM} />
      <div className="flex items-stretch gap-[12px]">
        <div className="relative shrink-0">
          <PixelCanvas draw={thermoDraw} w={24} h={64} scale={3} data={{ temp: e.temperatureC, fill: progress }} animate={false} label="Thermometer" />
          {[THERMO_MIN, 2, 3, 4, THERMO_MAX].map((c) => (
            <span
              key={c}
              className="absolute right-[-30px] font-mono text-[18px] leading-none text-stone"
              style={{ top: `${3 * (64 - 12 - ((c - THERMO_MIN) / (THERMO_MAX - THERMO_MIN)) * (64 - 12 - 3 - 2)) - 9}px` }}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="ml-[30px] flex min-w-0 flex-1 flex-col justify-center gap-[6px]">
          <span className={'font-mono text-[76px] leading-[0.8] tabular-nums ' + tTone}>
            +{temp.toFixed(1)}
            <span className="text-[42px]">°C</span>
          </span>
          <span className="t-meta text-stone">warming vs pre-industrial. Paris goal: 1.5°C. Today's policies: 2.7°C.</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-[9px]">
        <Tile big={`+${sea.toFixed(2)} m`} label="sea level rise" tone={e.oceanM > 0.6 ? 'heat' : 'paper'} icon="wave" />
        <Tile big={`${insects}%`} label="of insects lose half their range" tone={e.insectsPct > 30 ? 'ember' : 'paper'} icon="bee" />
        <Tile big={`${heat.toFixed(1)} bn`} label="people in unprecedented heat" tone={e.heatBillions > 2 ? 'heat' : 'paper'} icon="sun" />
        <div className="flex flex-col gap-[6px] bg-night px-[10px] py-[10px]">
          <PixelImg path={iconUrl('chip')} size={32} />
          <Bar label="Tech" value={e.techIndex} />
          <Bar label="AI" value={e.aiIndex} />
        </div>
      </div>
      {e.temperatureC > 2 && (
        <p className="t-meta bg-pine px-[12px] py-[10px] text-paper">
          Even a very frugal life lands above 2°C: most of a French footprint is the system (energy, food, housing). The jobs you take and the rules you push
          for move it most.
        </p>
      )}
      <p className="font-mono text-[19px] leading-[1.15] text-stone">
        Sources: IPCC AR6 (2021), Warren et al. Science (2018), Lenton et al. Nature Sustainability (2023), IEA Energy and AI (2025). Simplified model.
      </p>
    </Section>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  const n = Math.round(Math.max(0, Math.min(100, value)) / 10)
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="flex justify-between font-mono text-[20px] leading-none text-stone">
        <span>{label}</span>
        <span className="text-paper">{Math.round(value)}</span>
      </span>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: 10 }, (_, k) => (
          <span key={k} className={'h-[6px] flex-1 ' + (k < n ? 'bg-sky' : 'bg-charcoal')} />
        ))}
      </span>
    </div>
  )
}

function ReceiptStep({ summary, facts }: { summary: EndSummary; facts: Record<string, Fact> }) {
  // Group by category (icon header + subtotal), biggest group first, biggest line first.
  const groups = useMemo(() => {
    const m = new Map<string, ReceiptLine[]>()
    for (const l of summary.receipt) m.set(l.category, [...(m.get(l.category) ?? []), l])
    return [...m.entries()]
      .map(([cat, lines]) => ({ cat, lines: lines.sort((a, b) => b.t - a.t), total: lines.reduce((a, l) => a + l.t, 0) }))
      .sort((a, b) => b.total - a.total)
  }, [summary])
  const notes: { n: number; source: string }[] = []
  const noteOf = (factId?: string) => {
    if (!factId || !facts[factId]) return null
    const src = facts[factId].source
    let found = notes.find((x) => x.source === src)
    if (!found) {
      found = { n: notes.length + 1, source: src }
      notes.push(found)
    }
    return found.n
  }
  const total = summary.lifetimeT
  const avg = summary.frenchAverageLifetimeT
  const diff = total - avg
  const years = summary.deathAge - 18
  return (
    <Section className="items-center">
      <h1 className="self-start text-[26px] leading-tight font-bold text-paper lg:text-[30px]">Your carbon receipt</h1>
      <div className="receipt my-[6px] w-full max-w-[380px] px-[14px] py-[18px] font-mono text-[20px] leading-[1.15]" role="table" aria-label="Carbon receipt">
        <div className="text-center">
          <p className="text-[30px] leading-none">RESPAWN LIFE MART</p>
          <p>Store #2100, Plateau de Saclay</p>
          <p>
            Customer: {pixelSafe(summary.name).toUpperCase()} / AGE 18-{summary.deathAge}
          </p>
        </div>
        <Dashes />
        {groups.map((g) => (
          <div key={g.cat} className="mb-[6px]" role="rowgroup">
            <div className="flex items-center gap-[9px] border-b-[2px] border-dashed border-stone pb-[3px]" role="row">
              <PixelImg path={iconUrl(CATEGORY_ICON[g.cat] ?? 'co2')} size={32} />
              <span className="flex-1 text-[22px] uppercase" role="rowheader">
                {CATEGORY_LABEL[g.cat] ?? g.cat}
              </span>
              <span className="tabular-nums text-[22px]" role="cell">
                {fmtT(g.total)}
              </span>
            </div>
            {g.lines.map((l, k) => {
              const note = noteOf(l.factId)
              return (
                <div key={k} className="flex items-baseline gap-[12px] pl-[6px]" role="row">
                  <span className="min-w-0 flex-1" role="cell">
                    {pixelSafe(l.label)}
                    {note ? <sup className="text-[16px]"> [{note}]</sup> : null}
                  </span>
                  <span className="shrink-0 tabular-nums" role="cell">
                    {fmtT(l.t)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
        <Dashes />
        <div className="flex justify-between text-[26px]">
          <span>TOTAL</span>
          <span className="tabular-nums">{fmtNum(total)} t CO2e</span>
        </div>
        <div className="flex justify-between">
          <span>French average life</span>
          <span className="tabular-nums">{fmtNum(avg)} t</span>
        </div>
        <div className="flex justify-between">
          <span>Difference</span>
          <span className="tabular-nums">
            {diff >= 0 ? '+' : '-'}
            {fmtNum(Math.abs(diff))} t
          </span>
        </div>
        <div className="flex justify-between">
          <span>Per year ({years} yrs)</span>
          <span className="tabular-nums">{summary.F.toFixed(1)} t/yr</span>
        </div>
        <Dashes />
        <Barcode seed={Math.round(total * 7)} />
        <p className="mt-[6px] text-center">THANK YOU FOR LIVING. NO REFUNDS.</p>
        {notes.length > 0 && (
          <div className="mt-[9px] flex flex-col gap-[3px] text-[18px] leading-[1.1]">
            {notes.map((n) => (
              <p key={n.n}>
                [{n.n}] {pixelSafe(n.source)}
              </p>
            ))}
          </div>
        )}
      </div>
      <p className="t-meta self-start text-stone">
        Work footprint (what your job ran): {fmtNum(summary.workT)} t. Audience footprint: {fmtNum(summary.influenceT)} t. Not on your personal bill.
      </p>
    </Section>
  )
}

function Dashes() {
  return (
    <p aria-hidden className="my-[6px] overflow-hidden whitespace-nowrap">
      {'- '.repeat(40)}
    </p>
  )
}

function Barcode({ seed }: { seed: number }) {
  const bars = useMemo(() => Array.from({ length: 46 }, (_, k) => ((seed * 31 + k * 17) ^ (k * 7)) % 3), [seed])
  return (
    <div className="flex h-[36px] justify-center gap-[2px]" aria-hidden>
      {bars.map((b, k) => (
        <span key={k} className={b === 0 ? 'w-[3px] bg-night' : b === 1 ? 'w-[1px] bg-night' : 'w-[2px] bg-night'} />
      ))}
    </div>
  )
}

function TitleStep({ summary, emblem, desktop }: { summary: EndSummary; emblem?: string; desktop: boolean }) {
  useEffect(() => {
    sfx.promotion()
  }, [])
  const career = summary.path ? [summary.path.employerName, summary.path.pathName].filter(Boolean).join(', ') : summary.startup?.name
  return (
    <Section wide={desktop}>
      <p className="font-mono text-[26px] text-stone">You were...</p>
      <div className="pwin beat-pop flex flex-col gap-[9px] px-[18px] py-[18px] lg:px-[28px] lg:py-[24px]">
        <h1 className="text-[34px] leading-[1.05] font-bold text-forest lg:text-[48px]">{pixelSafe(summary.title.title)}</h1>
        <p className="t-body">{pixelSafe(summary.title.description)}</p>
      </div>
      {career && (
        <div className="flex items-center gap-[12px] bg-night px-[12px] py-[10px]">
          {emblem ? <PixelImg path={emblem} size={32} /> : <PixelImg path={iconUrl('briefcase')} size={32} />}
          <span className="t-body text-paper">
            <span className="text-stone">Career: </span>
            {pixelSafe(career)}
          </span>
        </div>
      )}
      {summary.badges.length > 0 && (
        <>
          <h2 className="t-title mt-[6px] font-bold text-lime">Badges</h2>
          <ul className={desktop ? 'grid grid-cols-2 gap-[12px]' : 'flex flex-col gap-[9px]'}>
            {summary.badges.map((b) => (
              <li key={b.id} className="flex items-start gap-[12px] bg-night px-[12px] py-[10px]">
                <PixelImg path={iconUrl('trophy')} size={32} />
                <div className="flex flex-col gap-[3px]">
                  <span className="t-choice font-bold text-paper">{pixelSafe(b.label)}</span>
                  <span className="t-meta text-stone">{pixelSafe(b.description)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// RESPAWN: arcade continue screen, then the three choices that weighed most.
// ---------------------------------------------------------------------------

/** A seed pops into a sprout: the respawn motif. */
function SeedToSprout({ scale = 2 }: { scale?: number }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setGrown(true), 450)
    return () => window.clearTimeout(id)
  }, [])
  return <PixelImg key={String(grown)} path={sproutUrl(grown ? 'sprout' : 'seed')} size={40} scale={scale} className="beat-pop" />
}

function RespawnStep({
  summary,
  respawn,
  onSimulate,
  onClear,
  onReplay,
  onSkip,
  desktop,
}: {
  summary: EndSummary
  respawn: RespawnResult | null
  onSimulate: EndViewProps['onSimulate']
  onClear: () => void
  onReplay: (i: number) => void
  onSkip: () => void
  desktop: boolean
}) {
  const [phase, setPhase] = useState<'countdown' | 'pick' | 'over'>(respawn ? 'pick' : 'countdown')
  const [n, setN] = useState(9)
  useEffect(() => {
    if (phase !== 'countdown') return
    sfx.countdown(n)
    if (n <= 0) {
      setPhase('over')
      return
    }
    const id = window.setTimeout(() => setN((k) => k - 1), 1000)
    return () => window.clearTimeout(id)
  }, [n, phase])

  const insert = () => {
    sfx.respawn()
    setPhase('pick')
  }
  useKeys((e) => {
    if (phase !== 'pick' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      insert()
    }
  })

  if (phase === 'countdown' || phase === 'over') {
    return (
      <Section className="min-h-full items-center justify-center text-center">
        {phase === 'countdown' ? (
          <>
            <PixelImg path={sproutUrl('seed')} size={40} scale={2} className="anim-bob" />
            <PixelWord text="RESPAWN?" scale={desktop ? 8 : 6} color="lime" extrude={['moss', 'pine']} />
            <PixelWord key={n} text={String(n)} scale={desktop ? 20 : 16} color="paper" extrude={['slate', 'charcoal']} className="beat-pop" />
            <p className="t-body max-w-[340px] text-stone">Go back to one of the three choices that weighed most and live the other life.</p>
          </>
        ) : (
          <>
            <PixelWord text="GAME OVER" scale={6} color="paper" extrude={['slate']} />
            <p className="t-body text-stone">Too slow. Lucky for you, this machine takes free coins.</p>
          </>
        )}
        <button type="button" className="pkey is-primary min-h-[62px] w-full max-w-[340px] text-[22px] font-bold" onClick={insert} autoFocus>
          Insert coin
        </button>
        {phase === 'over' && (
          <button type="button" className="t-meta min-h-[44px] text-stone underline decoration-[2px] underline-offset-[5px]" onClick={onSkip}>
            Skip to my card
          </button>
        )}
      </Section>
    )
  }

  if (respawn) return <RespawnResultView summary={summary} respawn={respawn} onClear={onClear} onReplay={onReplay} desktop={desktop} />

  return (
    <Section wide={desktop}>
      <div className="flex items-center gap-[12px]">
        <SeedToSprout />
        <h1 className="text-[26px] leading-tight font-bold text-paper lg:text-[34px]">Pick a moment to respawn</h1>
      </div>
      <p className="t-body text-stone">These three choices shaped your life the most. Change one; the rest of your life replays with the same luck.</p>
      {summary.topChoices.length === 0 && <p className="t-body text-stone">No big choices to replay in this life.</p>}
      <div className={desktop ? 'grid grid-cols-3 items-start gap-[18px]' : 'flex flex-col gap-[15px]'}>
        {summary.topChoices.map((c) => (
          <div key={c.historyIndex} className="pwin-dark flex flex-col gap-[9px] px-[15px] py-[15px]">
            <span className="font-mono text-[24px] leading-none text-lime">At {c.age}</span>
            <span className="t-choice font-bold text-paper">{pixelSafe(c.title)}</span>
            <span className="t-meta text-stone">You chose: {pixelSafe(c.chosenLabel)}</span>
            <div className="mt-[3px] flex flex-col gap-[12px]">
              {c.alternatives.slice(0, 4).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="pkey t-choice min-h-[48px] px-[12px] py-[9px] text-left"
                  onClick={() => {
                    sfx.confirm()
                    onSimulate(c.historyIndex, a.id, a.label)
                  }}
                >
                  Try: {pixelSafe(a.label)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function RespawnResultView({
  summary,
  respawn,
  onClear,
  onReplay,
  desktop,
}: {
  summary: EndSummary
  respawn: RespawnResult
  onClear: () => void
  onReplay: (i: number) => void
  desktop: boolean
}) {
  const alt = respawn.summary
  const dT = alt.earth.temperatureC - summary.earth.temperatureC
  const dLife = alt.deathAge - summary.deathAge
  const series = useMemo(
    () => [
      { values: YOU_POLES.map((k) => summary.you[k]), stroke: 'lime' as const, fill: 'moss' as const, density: 0.5 },
      { values: YOU_POLES.map((k) => alt.you[k]), stroke: 'gold' as const, fill: 'gold' as const, density: 0.25 },
    ],
    [summary, alt],
  )
  const entry = summary.topChoices.find((c) => c.historyIndex === respawn.historyIndex)
  useEffect(() => {
    sfx.respawn()
  }, [respawn])
  const radar = (
    <div className="flex flex-col gap-[9px]">
      <Radar series={series} labels={YOU_POLES.map((k) => YOU_LABELS[k])} ariaLabel="Your radar and the other life's radar" />
      <div className="flex justify-center gap-[18px] font-mono text-[22px]">
        <span className="flex items-center gap-[6px] text-lime">
          <span className="h-[12px] w-[12px] bg-lime" /> This life
        </span>
        <span className="flex items-center gap-[6px] text-gold">
          <span className="h-[12px] w-[12px] bg-gold" /> The other life
        </span>
      </div>
    </div>
  )
  const details = (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-2 gap-[9px]">
        <Tile big={`${dT >= 0 ? '+' : ''}${dT.toFixed(1)}°C`} label="Earth in 2100 vs this life" tone={dT > 0.05 ? 'heat' : dT < -0.05 ? 'lime' : 'paper'} icon="thermometer" />
        <Tile big={`${dLife >= 0 ? '+' : ''}${dLife} yrs`} label={`lived to ${alt.deathAge}`} icon="hourglass" />
      </div>
      <p className="t-body bg-night px-[12px] py-[10px] text-paper">
        That life ended as <span className="font-bold text-gold">{pixelSafe(alt.title.title)}</span>.
      </p>
      <button type="button" className="pkey is-primary min-h-[56px] text-[20px] font-bold" onClick={() => onReplay(respawn.historyIndex)}>
        Replay live from age {entry?.age ?? ''}
      </button>
      <button type="button" className="pkey min-h-[52px] text-[19px] font-semibold" onClick={onClear}>
        Try another choice
      </button>
    </div>
  )
  return (
    <Section wide={desktop}>
      <div className="flex items-center gap-[12px]">
        <SeedToSprout />
        <h1 className="text-[26px] leading-tight font-bold text-paper lg:text-[34px]">The other life</h1>
      </div>
      <p className="t-body text-stone">
        At {entry?.age ?? '?'}, instead of "{pixelSafe(entry?.chosenLabel)}", you picked "{pixelSafe(respawn.altLabel)}".
      </p>
      {desktop ? (
        <div className="grid grid-cols-2 items-center gap-[36px]">
          {radar}
          {details}
        </div>
      ) : (
        <>
          {radar}
          {details}
        </>
      )}
    </Section>
  )
}

function ShareStep({ summary, desktop }: { summary: EndSummary; desktop: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    void renderShareCard(summary).then((c) => {
      if (alive) setUrl(c.toDataURL('image/png'))
    })
    return () => {
      alive = false
    }
  }, [summary])
  const save = async () => {
    if (busy) return
    setBusy(true)
    sfx.coin()
    try {
      await downloadShareCard(summary)
    } finally {
      setBusy(false)
    }
  }
  const preview = (
    <div className={'w-full border-[3px] border-night bg-night ' + (desktop ? 'max-w-[400px]' : 'max-w-[300px]')} style={{ aspectRatio: '1080 / 1350' }}>
      {url ? (
        <img src={url} alt={`Share card: ${summary.name}, ${summary.title.title}, ${summary.earth.temperatureC.toFixed(1)} degrees`} className="block h-full w-full" />
      ) : (
        <div className="grid h-full place-items-center">
          <PixelSpinner label="Printing your card" />
        </div>
      )}
    </div>
  )
  const actions = (
    <div className="flex w-full max-w-[340px] flex-col gap-[12px]">
      <h1 className="text-[26px] leading-tight font-bold text-paper lg:text-[34px]">Your card</h1>
      <p className="t-body text-stone">Post it, compare it with your friends, then try to do better.</p>
      <button type="button" className="pkey is-primary min-h-[56px] text-[20px] font-bold" aria-disabled={busy || undefined} onClick={save}>
        {busy ? 'Printing...' : 'Save my card'}
      </button>
    </div>
  )
  return (
    <Section className="items-center" wide={desktop}>
      {desktop ? (
        <div className="flex items-center justify-center gap-[48px]">
          {preview}
          {actions}
        </div>
      ) : (
        <>
          {actions}
          {preview}
        </>
      )}
    </Section>
  )
}
