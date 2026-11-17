/** localStorage save of the current life. Every access is wrapped: storage may be blocked. */
import type { Epitaph } from '../ai/types'
import type { GameState } from '../engine/types'

const KEY = 'respawn.life.v1'

export interface SaveFile {
  v: 1
  savedAt: number
  game: GameState
  epitaph?: Epitaph | null
}

export function loadSave(): SaveFile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SaveFile
    if (!parsed || parsed.v !== 1 || !parsed.game || parsed.game.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function writeSave(game: GameState, epitaph?: Epitaph | null) {
  try {
    const file: SaveFile = { v: 1, savedAt: Date.now(), game, epitaph }
    localStorage.setItem(KEY, JSON.stringify(file))
  } catch {
    /* quota or blocked: the life just won't resume */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
