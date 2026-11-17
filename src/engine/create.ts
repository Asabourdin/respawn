/** createGame: start stats, seeded random profile, name. */
import type { Content } from '../content/schema'
import { applyEffects, newCtx } from './effects'
import { START_AGE } from './planet'
import { hashString, pickWeightedIndex, rand } from './rng'
import { startStats } from './stats'
import type { GameState, Gender, PlayerInfo } from './types'

export const DEFAULT_SEED_SALT = 'respawn'
const MAX_NAME = 32

const GENDERS: readonly Gender[] = ['woman', 'man', 'nonbinary', 'unspecified']

function cleanName(v: unknown): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) : ''
}

export function createGame(content: Content, opts: { seed?: number } & Partial<PlayerInfo> = {}): GameState {
  const seed =
    opts.seed !== undefined && Number.isFinite(opts.seed)
      ? Math.floor(opts.seed) >>> 0
      : hashString(`${DEFAULT_SEED_SALT}:${opts.name ?? ''}`)
  const holder = { rng: seed }
  const pr = content.profiles
  const pick = <T extends { weight?: number }>(list: T[]): T => list[pickWeightedIndex(holder, list.map((o) => o.weight ?? 1))]
  const origin = pick(pr.origins)
  const budget = pick(pr.budgets)
  const trait = pick(pr.traits)
  const given = cleanName(opts.name)
  const name = given || pr.names[Math.floor(rand(holder) * pr.names.length)] || 'Alex'
  const lastName = cleanName(opts.lastName)
  const gender = GENDERS.includes(opts.gender as Gender) ? (opts.gender as Gender) : undefined

  const state: GameState = {
    version: 1,
    seed,
    rng: holder.rng,
    player: {
      name,
      ...(lastName ? { lastName } : {}),
      ...(gender ? { gender } : {}),
      profile: { originId: origin.id, budgetId: budget.id, traitId: trait.id },
    },
    age: START_AGE,
    phase: 'arrival',
    stats: startStats(content),
    flags: [],
    pathHistory: [],
    promotionChance: 0,
    promotions: 0,
    bannedFields: [],
    footprint: {
      modifiers: [],
      oneOffs: [],
      lifeT: 0,
      digitalT: 0,
      workT: 0,
      influenceTPerYear: 0,
      influenceT: 0,
      materialsKg: 0,
      deviceMultiplier: 1,
      genAiTPerYear: 0,
    },
    done: [],
    skipped: [],
    fired: [],
    aiSlotsUsed: [],
    grindYears: 0,
    screenHoursTotal: 0,
    badges: [],
    history: [],
    ended: false,
  }
  for (const option of [origin, budget, trait]) {
    if (option.effects) applyEffects(content, state, { ...option.effects, years: undefined }, newCtx('profile'))
  }
  return state
}
