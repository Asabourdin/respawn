/** Placeholder filling for titles, texts, labels, hints. */
import type { Content } from '../content/schema'
import { indexContent } from './contentIndex'
import type { GameState } from './types'

const PLACEHOLDER_RE = /\{(name|employer|path|university|city|country|startup|age)\}/g

export function placeholderValues(content: Content, state: GameState): Record<string, string> {
  const ix = indexContent(content)
  const job = state.path ?? state.pathHistory[state.pathHistory.length - 1]
  const employer =
    job?.employerName ?? (job?.employerId ? ix.employers.get(job.employerId)?.name : undefined) ?? 'your employer'
  const pathName = (job ? ix.paths.get(job.pathId)?.name : undefined) ?? 'your career'
  const dest = state.exchange ? ix.destinations.get(state.exchange.destinationId) : undefined
  return {
    name: state.player.name,
    employer,
    path: pathName,
    university: dest?.university ?? 'your host university',
    city: dest?.city ?? 'your exchange city',
    country: dest?.country ?? 'abroad',
    startup: state.startup?.name ?? 'your startup',
    age: String(Math.floor(state.age)),
  }
}

export function fillText(content: Content, state: GameState, text: string): string
export function fillText(content: Content, state: GameState, text: string | undefined): string | undefined
export function fillText(content: Content, state: GameState, text: string | undefined): string | undefined {
  if (text === undefined || !text.includes('{')) return text
  const values = placeholderValues(content, state)
  return text.replace(PLACEHOLDER_RE, (_m, key: string) => values[key] ?? `{${key}}`)
}
