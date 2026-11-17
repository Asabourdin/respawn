import type { Phase, VisibleStat } from '../content/schema'
import type { BrandKey } from './theme/palette'
import { ICON } from './art/sprites'

/** Replace glyphs the pixel fonts don't carry with readable equivalents. */
export function pixelSafe(text: string | undefined | null): string {
  if (!text) return ''
  return text
    .replace(/≥\s*(\d+(?:[.,]\d+)?)/g, '$1+')
    .replace(/≤\s*(\d+(?:[.,]\d+)?)/g, '$1 or less')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '>')
    .replace(/←/g, '<')
    .replace(/CO₂/g, 'CO2')
    .replace(/₂/g, '2')
    .replace(/≈/g, '~')
    .replace(/✓/g, '')
}

export const PHASE_LABEL: Record<Phase, string> = {
  arrival: 'Arrival',
  aidams12: 'AIDAMS Year 1-2',
  aidams34: 'AIDAMS Year 3-4',
  launch: 'Launch',
  career: 'Career',
  maturity: 'Maturity',
  oldage: 'Old age',
}

/** Age where each phase starts (timeline ticks). */
export const PHASE_START: [Phase, number][] = [
  ['arrival', 18],
  ['aidams12', 18.5],
  ['aidams34', 20],
  ['launch', 22],
  ['career', 25],
  ['maturity', 45],
  ['oldage', 65],
]

export const STAT_META: Record<VisibleStat, { label: string; icon: readonly string[]; color: BrandKey; dim: BrandKey }> = {
  money: { label: 'Wealth', icon: ICON.money, color: 'gold', dim: 'charcoal' },
  happiness: { label: 'Happiness', icon: ICON.happiness, color: 'mint', dim: 'charcoal' },
  social: { label: 'Social', icon: ICON.social, color: 'sky', dim: 'charcoal' },
  fame: { label: 'Fame', icon: ICON.fame, color: 'gold', dim: 'charcoal' },
  contribution: { label: 'Impact', icon: ICON.contribution, color: 'lime', dim: 'charcoal' },
}

export const VISIBLE: VisibleStat[] = ['money', 'happiness', 'social', 'fame', 'contribution']

export function fmtT(t: number): string {
  if (Math.abs(t) >= 100) return `${Math.round(t)} t`
  if (Math.abs(t) >= 10) return `${t.toFixed(1)} t`
  if (Math.abs(t) >= 0.1) return `${t.toFixed(2)} t`
  return `${t.toFixed(3)} t`
}

export function fmtNum(n: number, d = 0): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function signed(n: number, d = 1): string {
  const s = n.toFixed(d)
  return n > 0 ? `+${s}` : n < 0 ? s.replace('-', '-') : s
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}
