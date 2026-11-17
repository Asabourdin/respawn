/**
 * Hand-made sprite matrices. One character = one pixel; '.' = transparent.
 * Letters map to brand palette keys through LEGEND.
 */
import { P, type PaletteKey } from '../theme/palette'

export const LEGEND: Record<string, PaletteKey> = {
  k: 'night',
  f: 'forest',
  e: 'pine',
  v: 'moss',
  g: 'lime',
  i: 'mint',
  w: 'paper',
  s: 'stone',
  t: 'slate',
  c: 'charcoal',
  y: 'sky',
  z: 'sea',
  a: 'gold',
  o: 'ember',
  h: 'heat',
  r: 'wine',
  '1': 'skin1',
  '2': 'skin2',
  '3': 'skin3',
  x: 'paper',
}

export type SpriteRows = readonly string[]

export function spriteSize(rows: SpriteRows) {
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length }
}

export function colorOf(ch: string): string | null {
  if (ch === '.' || ch === ' ') return null
  const key = LEGEND[ch]
  return key ? P[key] : null
}

/** Draw a sprite into a 2D context at logical (x, y). Optional single-colour override. */
export function stamp(
  ctx: CanvasRenderingContext2D,
  rows: SpriteRows,
  x: number,
  y: number,
  opts: { color?: string; flipX?: boolean } = {},
) {
  const { w } = spriteSize(rows)
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    for (let i = 0; i < row.length; i++) {
      const c = colorOf(row[i])
      if (!c) continue
      ctx.fillStyle = opts.color ?? c
      const xi = opts.flipX ? w - 1 - i : i
      ctx.fillRect(Math.round(x) + xi, Math.round(y) + j, 1, 1)
    }
  }
}

// ---------------------------------------------------------------------------
// Brand sprout (public/brand/sprout-grid.txt, 13×14) and its life stages
// ---------------------------------------------------------------------------

export const SPROUT: SpriteRows = [
  '........ggggg',
  '.......gggggg',
  'gggg..ggggggg',
  'ggggg.gggggg.',
  'ggggggggggg..',
  '.gggggg......',
  '...g.gg......',
  '.....gg......',
  '.....gg......',
  '.....gg......',
  '.....gg......',
  '.....gg......',
  '.....gg......',
  '.....gg......',
]

/** Seedling: the first week at 18. */
export const SPROUT_SEED: SpriteRows = ['...gg', 'g.gg.', 'ggg..', '.g...', '.g...', 'sss..']

/** Wilted sprout for the death screen. */
export const SPROUT_WILT: SpriteRows = [
  '.............',
  '.............',
  '.....tt......',
  '....tsst.....',
  '...tss.tt....',
  '..tss...t....',
  '..ts....t....',
  '.....s.......',
  '.....ss......',
  '.ss..ss......',
  'ssss.ss......',
  '.ss..ss......',
  '.....ss......',
  '.....ss......',
]

// ---------------------------------------------------------------------------
// Gauge icons (7 px tall)
// ---------------------------------------------------------------------------

export const ICON = {
  money: ['..aaa..', '.aaaaa.', 'aa2a2aa', 'aa2a2aa', 'aa2a2aa', '.aaaaa.', '..aaa..'],
  happiness: ['.ii.ii.', 'iwiiiii', 'iiiiiii', 'iiiiiii', '.iiiii.', '..iii..', '...i...'],
  social: ['.yy..yy.', '.yy..yy.', '........', 'yyyy.yyyy', 'yyyy.yyyy', 'yyyy.yyyy', 'yyyy.yyyy'],
  fame: ['...a...', '..aaa..', 'aaaaaaa', '.aaaaa.', '..aaa..', '.aa.aa.', '.a...a.'],
  contribution: ['....ggg', 'g..gggg', 'gg.ggg.', 'ggggg..', '..gg...', '..gg...', '..gg...'],
  footprint: ['..ss...', '.ssss..', '.sssss.', '..ssss.', '...sss.', '.s.....', 's.s....'],
} as const

export const LOCK: SpriteRows = ['..sss..', '.s...s.', '.s...s.', 'sssssss', 'sssksss', 'sssksss', 'ttttttt']

export const ARROW_UP: SpriteRows = ['..w..', '.www.', 'wwwww', '.www.', '.www.']
export const ARROW_DOWN: SpriteRows = [...ARROW_UP].reverse()

export const SPARKLE: SpriteRows = ['..g..', '..g..', 'gg.gg', '..g..', '..g..']

export const SKULL: SpriteRows = ['.wwwww.', 'wwwwwww', 'wkkwkkw', 'wkkwkkw', 'wwwkwww', '.wwwww.', '.w.w.w.']

export const HOURGLASS: SpriteRows = ['aaaaaaa', '.wwwww.', '..www..', '...w...', '..w.w..', '.w.w.w.', 'aaaaaaa']

export const SPEAKER_ON: SpriteRows = ['...w....', '..ww..w.', 'wwww.w.w', 'wwww.w.w', 'wwww.w.w', '..ww..w.', '...w....']
export const SPEAKER_OFF: SpriteRows = ['...w....', '..ww....', 'wwww.s.s', 'wwww..s.', 'wwww.s.s', '..ww....', '...w....']

export const PAUSE: SpriteRows = ['ww.ww', 'ww.ww', 'ww.ww', 'ww.ww', 'ww.ww']

export const SIREN: SpriteRows = ['..h..', '.hoh.', '.hoh.', 'hhhhh', 'ttttt']

export const MEDAL: SpriteRows = ['r...z', 'rr.zz', '.r.z.', '.aaa.', 'awaaa', 'aaaaa', '.aaa.']

export const CHECK: SpriteRows = ['.....g', '....gg', 'g..gg.', 'gggg..', '.gg...']

export const COIN_SLOT: SpriteRows = ['.aaa.', 'aaaaa', 'awaaa', 'aaaaa', '.aaa.']

function buildTombstone(): string[] {
  const W = 18
  const H = 21
  const inset = [5, 3, 2, 1, 1]
  const rows: string[] = []
  for (let y = 0; y < H; y++) {
    const a = y < inset.length ? inset[y] : 0
    const b = W - 1 - a
    let r = ''
    for (let x = 0; x < W; x++) {
      if (x < a || x > b) r += '.'
      else if (y === H - 1 || y === 0 || x === a || x === b) r += 'k'
      else if (y === H - 2) r += 'c'
      else if ((x === 8 || x === 9) && y >= 4 && y <= 11) r += 'k'
      else if ((y === 6 || y === 7) && x >= 6 && x <= 11) r += 'k'
      else if (x === b - 1 || (y === H - 3 && x > a)) r += 't'
      else r += 's'
    }
    rows.push(r)
  }
  return rows
}

export const TOMBSTONE: SpriteRows = buildTombstone()

export const CROSS: SpriteRows = ['w...w', '.w.w.', '..w..', '.w.w.', 'w...w']

/** d6 faces for skill checks. */
export const DICE: SpriteRows[] = [
  ['wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwkwww', 'wwwwwww', 'wwwwwww', 'wwwwwww'],
  ['wwwwwww', 'wkwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwkw', 'wwwwwww'],
  ['wwwwwww', 'wkwwwww', 'wwwwwww', 'wwwkwww', 'wwwwwww', 'wwwwwkw', 'wwwwwww'],
  ['wwwwwww', 'wkwwwkw', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wkwwwkw', 'wwwwwww'],
  ['wwwwwww', 'wkwwwkw', 'wwwwwww', 'wwwkwww', 'wwwwwww', 'wkwwwkw', 'wwwwwww'],
  ['wwwwwww', 'wkwwwkw', 'wwwwwww', 'wkwwwkw', 'wwwwwww', 'wkwwwkw', 'wwwwwww'],
]

export const SHEET: SpriteRows = ['wwwwwww', 'w.....w', 'w.ggg.w', 'w.....w', 'w.www.w', 'w.ww..w', 'wwwwwww']
