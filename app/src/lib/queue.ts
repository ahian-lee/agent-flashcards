/**
 * Study-queue construction. Pure function: everything it needs is passed in,
 * which keeps the Anki-ish rules (due first, then new cards, then learn-ahead)
 * unit-testable without a browser or IndexedDB.
 */
import type { CardStateRecord } from './scheduler'
import { State } from './scheduler'

export interface QueueSettings {
  /** max new cards introduced per day */
  newPerDay: number
  /** max review cards shown per day */
  reviewPerDay: number
  /** window (minutes) for re-showing short-term Learning/Relearning cards */
  learnAheadMinutes: number
}

export interface QueueCardRef {
  uid: string
  deckId: string
}

export interface QueueInput {
  /** every content card, in content order */
  cards: readonly QueueCardRef[]
  /** persisted states, keyed by card uid */
  states: Readonly<Record<string, CardStateRecord | undefined>>
  /** new cards already introduced today (logs where prevState === New) */
  newDoneToday: number
  /** non-new reviews already done today */
  reviewDoneToday: number
  settings: QueueSettings
  now: number
  deckId?: string
}

export type QueueKind = 'review' | 'new' | 'learn-ahead'

export interface QueueItem {
  uid: string
  deckId: string
  kind: QueueKind
}

export interface QueueCounts {
  /** due now, uncapped, deck-filtered */
  due: number
  /** never seen (or reset) cards, uncapped */
  new: number
  /** short-term learning cards due within the learn-ahead window */
  learningSoon: number
  /** due now and not blocked by the review cap */
  dueAvailable: number
  /** new and not blocked by the new-card cap */
  newAvailable: number
}

export interface QueueResult {
  items: QueueItem[]
  counts: QueueCounts
  /** caps that ran out, for UI hints */
  limitedBy: Array<'new' | 'review'>
}

function remaining(cap: number, done: number): number {
  if (!Number.isFinite(cap)) return Number.POSITIVE_INFINITY
  return Math.max(0, cap - done)
}

/** Build the ordered study queue for one deck (or the mixed queue). */
export function buildQueue(input: QueueInput): QueueResult {
  const { cards, states, settings, now, deckId } = input
  const scoped = deckId ? cards.filter((card) => card.deckId === deckId) : cards

  const dueItems: Array<{ uid: string; deckId: string; due: number }> = []
  const newItems: Array<{ uid: string; deckId: string }> = []
  const learningItems: Array<{ uid: string; deckId: string; due: number }> = []
  const learnAheadLimit = now + Math.max(0, settings.learnAheadMinutes) * 60_000

  for (const card of scoped) {
    const state = states[card.uid]
    if (!state || state.state === State.New) {
      newItems.push({ uid: card.uid, deckId: card.deckId })
      continue
    }
    if (state.due <= now) {
      dueItems.push({ uid: card.uid, deckId: card.deckId, due: state.due })
      continue
    }
    const isShortTerm = state.state === State.Learning || state.state === State.Relearning
    if (isShortTerm && state.due <= learnAheadLimit) {
      learningItems.push({ uid: card.uid, deckId: card.deckId, due: state.due })
    }
  }

  dueItems.sort((a, b) => a.due - b.due)
  learningItems.sort((a, b) => a.due - b.due)

  const reviewSlots = remaining(settings.reviewPerDay, input.reviewDoneToday)
  const newSlots = remaining(settings.newPerDay, input.newDoneToday)

  const dueAvailable = Math.min(dueItems.length, reviewSlots === Infinity ? dueItems.length : reviewSlots)
  const newAvailable = Math.min(newItems.length, newSlots === Infinity ? newItems.length : newSlots)

  const items: QueueItem[] = []
  const queued = new Set<string>()

  for (const item of dueItems.slice(0, dueAvailable)) {
    items.push({ uid: item.uid, deckId: item.deckId, kind: 'review' })
    queued.add(item.uid)
  }
  for (const item of newItems.slice(0, newAvailable)) {
    items.push({ uid: item.uid, deckId: item.deckId, kind: 'new' })
    queued.add(item.uid)
  }
  // Anki-style "learn ahead": short-term cards that are already technically
  // scheduled just after now still belong in this session, otherwise rating a
  // new card Good (10 min) would look like it did nothing.
  for (const item of learningItems) {
    if (queued.has(item.uid)) continue
    queued.add(item.uid)
    items.push({ uid: item.uid, deckId: item.deckId, kind: 'learn-ahead' })
  }

  const limitedBy: Array<'new' | 'review'> = []
  if (newItems.length > newAvailable) limitedBy.push('new')
  if (dueItems.length > dueAvailable) limitedBy.push('review')

  return {
    items,
    counts: {
      due: dueItems.length,
      new: newItems.length,
      learningSoon: learningItems.length,
      dueAvailable,
      newAvailable,
    },
    limitedBy,
  }
}

/**
 * After a review, a card may become short-term due again (learning steps).
 * If so it is appended to the end of the live session queue.
 */
export function shouldRequeue(next: CardStateRecord, now: number, learnAheadMinutes: number): boolean {
  if (next.state !== State.Learning && next.state !== State.Relearning) return false
  return next.due > now && next.due <= now + Math.max(0, learnAheadMinutes) * 60_000
}

/** Next moment the user has something to do, for empty-state copy. */
export function nextDueAt(
  cards: readonly QueueCardRef[],
  states: Readonly<Record<string, CardStateRecord | undefined>>,
  now: number,
  deckId?: string,
): number | null {
  let earliest: number | null = null
  for (const card of cards) {
    if (deckId && card.deckId !== deckId) continue
    const state = states[card.uid]
    if (!state || state.state === State.New) continue
    if (state.due <= now) return now
    if (earliest === null || state.due < earliest) earliest = state.due
  }
  return earliest
}
