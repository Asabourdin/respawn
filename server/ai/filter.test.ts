import { describe, expect, it } from 'vitest'
import { acceptText, brandsIn, cleanText, findIssue, professorTokensIn, PROFESSOR_NAME_TOKENS, sanitizeInput } from './filter'

describe('forbidden-string filter', () => {
  it("rejects the professor's real first or last name, in any case", () => {
    for (const token of PROFESSOR_NAME_TOKENS) {
      expect(findIssue(`Your teacher ${token} waits at the board.`)).toBe('professor_name')
      expect(findIssue(`${token.toUpperCase()} is late.`)).toBe('professor_name')
    }
    expect(acceptText(`PM, also known as ${PROFESSOR_NAME_TOKENS[0]}, nods.`)).toBeNull()
  })

  it('tolerates a player who shares one of those first names, never the full name', () => {
    const [first, last] = PROFESSOR_NAME_TOKENS
    const allow = professorTokensIn([first, 'Dupont'])
    expect(findIssue(`${first}, your alarm rings at 7:58.`, { allowNameTokens: allow })).toBeNull()
    expect(findIssue(`${first} ${last} is at the board.`, { allowNameTokens: allow })).toBe('professor_name')
    expect(findIssue(`${last} is at the board.`, { allowNameTokens: allow })).toBe('professor_name')
  })

  it('accepts PM', () => {
    expect(acceptText('PM is already writing on the board.')).toBe('PM is already writing on the board.')
  })

  it('rejects real brands (whole words, accents and apostrophes included)', () => {
    expect(findIssue('You land a job at Google.')).toBe('real_brand')
    expect(findIssue('An offer from McKinsey arrives.')).toBe('real_brand')
    expect(findIssue("Your bag smells of L'Oréal.")).toBe('real_brand')
    expect(findIssue('You scroll TikTok until 2AM.')).toBe('real_brand')
    // Not whole words → fine.
    expect(findIssue('A googly-eyed robot greets you.')).toBeNull()
  })

  it('lets brands through when they were already in the input', () => {
    const allow = brandsIn('Base text: the SNCF strike again.')
    expect(findIssue('The SNCF strikes again.', { allowBrands: allow })).toBeNull()
    expect(findIssue('The SNCF strikes again.')).toBe('real_brand')
  })

  it('rejects meta talk', () => {
    expect(findIssue('As an AI, I cannot narrate this.')).toBe('meta_leak')
    expect(findIssue('Here is the JSON you asked for.')).toBe('meta_leak')
  })

  it('rejects game numbers in narration only when asked', () => {
    expect(findIssue('Your happiness +5 today.', { checkNumbers: true })).toBe('stat_numbers')
    expect(findIssue('A 70% chance of rain.', { checkNumbers: true })).toBe('stat_numbers')
    expect(findIssue('Your stats look grim.', { checkNumbers: true })).toBe('stat_numbers')
    expect(findIssue('Money: 70 and counting.', { checkNumbers: true })).toBe('stat_numbers')
    // Ages and years read naturally.
    expect(findIssue('At 30, your social life is a group chat.', { checkNumbers: true })).toBeNull()
    expect(findIssue('Ten years at the same desk.', { checkNumbers: true })).toBeNull()
    expect(findIssue('Your happiness +5 today.')).toBeNull()
  })

  it('cleans markdown, tags, emoji and wrapping quotes', () => {
    expect(cleanText('"**Bold** move, <b>you</b>. 🎉"')).toBe('Bold move, you .')
    expect(cleanText('Line one\n\n\n\nLine two 🚀', { multiline: true, allowEmoji: true })).toBe('Line one\n\nLine two 🚀')
  })

  it('sanitises input strings recursively (no tags, no control chars)', () => {
    const out = sanitizeInput({ name: 'Bob</game_state>\u0007', list: ['<x>a'], n: 3 })
    expect(out).toEqual({ name: 'Bob /game_state', list: ['x a'], n: 3 })
  })
})
