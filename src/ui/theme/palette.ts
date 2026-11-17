/**
 * RESPAWN brand palette (docs/BRAND.md). The ONLY colours the UI and the procedural art use.
 * Forest + paper carry the UI, lime is the single accent (life, chosen option, positive),
 * ember/heat only for warming and danger, gold for money and fame.
 * Mirrored as CSS variables (--color-*) in src/index.css for Tailwind utilities.
 */
export const BRAND = {
  night: '#0B1F15',
  forest: '#113020',
  pine: '#1E4A30',
  moss: '#2F6B3F',
  lime: '#8FE060',
  mint: '#C9F2A8',
  paper: '#F2F4EF',
  stone: '#B8C2B4',
  slate: '#5E6E64',
  charcoal: '#2A3B33',
  sky: '#6FB7D9',
  sea: '#2D6A8C',
  gold: '#F2C14E',
  ember: '#E8833A',
  heat: '#D9473B',
  wine: '#7A3B4E',
  skin1: '#F0C29A',
  skin2: '#B9785A',
  skin3: '#6E4632',
} as const

/**
 * Descriptive aliases used by the procedural art (roles, not new colours):
 * every alias resolves to one of the brand colours above.
 */
const ART_ALIASES = {
  ink: BRAND.night,
  deep: BRAND.forest,
  steel: BRAND.slate,
  fog: BRAND.stone,
  mist: BRAND.stone,
  white: BRAND.paper,
  red: BRAND.wine,
  blood: BRAND.wine,
  rose: BRAND.wine,
  plum: BRAND.wine,
  cocoa: BRAND.charcoal,
  umber: BRAND.skin3,
  clay: BRAND.skin2,
  tan: BRAND.skin2,
  sand: BRAND.skin1,
  peach: BRAND.skin1,
  pink: BRAND.skin1,
  orange: BRAND.ember,
  rust: BRAND.ember,
  hot: BRAND.heat,
  amber: BRAND.gold,
  lemon: BRAND.gold,
  leaf: BRAND.lime,
  navy: BRAND.sea,
  cyan: BRAND.mint,
} as const

export const P = { ...BRAND, ...ART_ALIASES } as const

export type BrandKey = keyof typeof BRAND
export type PaletteKey = keyof typeof P
