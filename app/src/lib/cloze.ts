/**
 * Cloze text parsing: `{{c1::answer}}` / `{{c1::answer::hint}}`.
 * Pure and DOM-free so both the UI and the tests can use it.
 */

export interface ClozeTextPart {
  type: 'text'
  text: string
}

export interface ClozeBlankPart {
  type: 'blank'
  /** the hidden answer */
  text: string
  hint?: string
  /** blank ordinal across the card (1-based) */
  index: number
}

export type ClozePart = ClozeTextPart | ClozeBlankPart

const CLOZE_TOKEN = /\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/g

export function parseCloze(source: string): ClozePart[] {
  const parts: ClozePart[] = []
  let cursor = 0
  let ordinal = 0
  CLOZE_TOKEN.lastIndex = 0

  for (const match of source.matchAll(CLOZE_TOKEN)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push({ type: 'text', text: source.slice(cursor, start) })
    ordinal += 1
    const hint = match[3]?.trim()
    parts.push({ type: 'blank', text: match[2] ?? '', hint: hint || undefined, index: ordinal })
    cursor = start + match[0].length
  }

  if (cursor < source.length) parts.push({ type: 'text', text: source.slice(cursor) })
  return parts
}

/** Number of blanks, for `已揭示 1/2` counters. */
export function countBlanks(parts: readonly ClozePart[]): number {
  return parts.filter((part) => part.type === 'blank').length
}

/** Plain text with the answers filled in (used for import/export previews). */
export function revealAll(source: string): string {
  return source.replace(CLOZE_TOKEN, (_all, _c: string, answer: string) => answer)
}
