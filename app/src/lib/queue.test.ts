import { describe, expect, it } from 'vitest'
import { State } from 'ts-fsrs'
import { buildQueue, nextDueAt, shouldRequeue } from './queue'
import type { QueueCardRef, QueueSettings } from './queue'
import type { CardStateRecord } from './scheduler'

const NOW = new Date(2026, 0, 15, 9, 0, 0, 0).getTime()
const MINUTE = 60_000

const SETTINGS: QueueSettings = { newPerDay: 20, reviewPerDay: 200, learnAheadMinutes: 20 }

function reviewState(uid: string, deckId: string, due: number, overrides: Partial<CardStateRecord> = {}): CardStateRecord {
  return {
    cardId: uid,
    deckId,
    due,
    stability: 8,
    difficulty: 5,
    elapsed_days: 3,
    scheduled_days: 3,
    learning_steps: 0,
    reps: 3,
    lapses: 0,
    state: State.Review,
    last_review: due - 3 * 86_400_000,
    ...overrides,
  }
}

function learningState(uid: string, deckId: string, due: number): CardStateRecord {
  return reviewState(uid, deckId, due, { state: State.Learning, reps: 1, learning_steps: 1, scheduled_days: 0 })
}

function cards(...refs: Array<[string, string]>): QueueCardRef[] {
  return refs.map(([uid, deckId]) => ({ uid, deckId }))
}

describe('buildQueue', () => {
  it('puts due reviews before new cards', () => {
    const cardRefs = cards(['d1::new', 'd1'], ['d1::due', 'd1'])
    const result = buildQueue({
      cards: cardRefs,
      states: { 'd1::due': reviewState('d1::due', 'd1', NOW - MINUTE) },
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: SETTINGS,
      now: NOW,
    })
    expect(result.items.map((item) => item.kind)).toEqual(['review', 'new'])
    expect(result.items[0].uid).toBe('d1::due')
  })

  it('orders due reviews by due date, oldest first', () => {
    const cardRefs = cards(['d1::late', 'd1'], ['d1::early', 'd1'])
    const result = buildQueue({
      cards: cardRefs,
      states: {
        'd1::late': reviewState('d1::late', 'd1', NOW - MINUTE),
        'd1::early': reviewState('d1::early', 'd1', NOW - 90 * MINUTE),
      },
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: SETTINGS,
      now: NOW,
    })
    expect(result.items.map((item) => item.uid)).toEqual(['d1::early', 'd1::late'])
  })

  it('respects the daily new-card cap', () => {
    const cardRefs = cards(['d1::1', 'd1'], ['d1::2', 'd1'], ['d1::3', 'd1'], ['d1::4', 'd1'], ['d1::5', 'd1'])
    const result = buildQueue({
      cards: cardRefs,
      states: {},
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: { ...SETTINGS, newPerDay: 2 },
      now: NOW,
    })
    expect(result.items).toHaveLength(2)
    expect(result.limitedBy).toContain('new')
    expect(result.counts.new).toBe(5)
    expect(result.counts.newAvailable).toBe(2)
  })

  it('subtracts new cards already learned today from the cap', () => {
    const cardRefs = cards(['d1::1', 'd1'], ['d1::2', 'd1'], ['d1::3', 'd1'])
    const result = buildQueue({
      cards: cardRefs,
      states: {},
      newDoneToday: 2,
      reviewDoneToday: 0,
      settings: { ...SETTINGS, newPerDay: 2 },
      now: NOW,
    })
    expect(result.items).toHaveLength(0)
    expect(result.limitedBy).toContain('new')
  })

  it('respects the daily review cap and reports why', () => {
    const cardRefs = cards(['d1::1', 'd1'], ['d1::2', 'd1'], ['d1::3', 'd1'])
    const states = {
      'd1::1': reviewState('d1::1', 'd1', NOW - 3 * MINUTE),
      'd1::2': reviewState('d1::2', 'd1', NOW - 2 * MINUTE),
      'd1::3': reviewState('d1::3', 'd1', NOW - MINUTE),
    }
    const result = buildQueue({
      cards: cardRefs,
      states,
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: { ...SETTINGS, reviewPerDay: 2 },
      now: NOW,
    })
    expect(result.items.filter((item) => item.kind === 'review')).toHaveLength(2)
    expect(result.counts.due).toBe(3)
    expect(result.limitedBy).toContain('review')
  })

  it('filters by deck while leaving the mixed queue complete', () => {
    const cardRefs = cards(['d1::a', 'd1'], ['d2::b', 'd2'])
    const states = {
      'd1::a': reviewState('d1::a', 'd1', NOW - MINUTE),
      'd2::b': reviewState('d2::b', 'd2', NOW - MINUTE),
    }
    const scoped = buildQueue({
      cards: cardRefs,
      states,
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: SETTINGS,
      now: NOW,
      deckId: 'd1',
    })
    expect(scoped.items.map((item) => item.uid)).toEqual(['d1::a'])

    const mixed = buildQueue({
      cards: cardRefs,
      states,
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: SETTINGS,
      now: NOW,
    })
    expect(mixed.items.map((item) => item.uid)).toEqual(['d1::a', 'd2::b'])
  })

  it('appends short-term learning cards inside the learn-ahead window', () => {
    const cardRefs = cards(['d1::soon', 'd1'], ['d1::later', 'd1'])
    const states = {
      'd1::soon': learningState('d1::soon', 'd1', NOW + 10 * MINUTE),
      'd1::later': learningState('d1::later', 'd1', NOW + 120 * MINUTE),
    }
    const within = buildQueue({
      cards: cardRefs,
      states,
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: SETTINGS,
      now: NOW,
    })
    expect(within.items.map((item) => item.uid)).toEqual(['d1::soon'])
    expect(within.items[0].kind).toBe('learn-ahead')
    expect(within.counts.learningSoon).toBe(1)

    const windowOff = buildQueue({
      cards: cardRefs,
      states,
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: { ...SETTINGS, learnAheadMinutes: 0 },
      now: NOW,
    })
    expect(windowOff.items).toHaveLength(0)
  })

  it('returns an empty queue when a settings cap is zero', () => {
    const result = buildQueue({
      cards: cards(['d1::1', 'd1']),
      states: {},
      newDoneToday: 0,
      reviewDoneToday: 0,
      settings: { ...SETTINGS, newPerDay: 0 },
      now: NOW,
    })
    expect(result.items).toHaveLength(0)
    expect(result.limitedBy).toEqual(['new'])
  })
})

describe('shouldRequeue', () => {
  it('re-queues learning cards that become due within the window', () => {
    expect(shouldRequeue(learningState('d1::1', 'd1', NOW + 10 * MINUTE), NOW, 20)).toBe(true)
    expect(shouldRequeue(learningState('d1::1', 'd1', NOW + 30 * MINUTE), NOW, 20)).toBe(false)
  })

  it('never re-queues a graduated Review card', () => {
    expect(shouldRequeue(reviewState('d1::1', 'd1', NOW + 10 * MINUTE), NOW, 20)).toBe(false)
  })
})

describe('nextDueAt', () => {
  it('returns the earliest future due date and honours the deck filter', () => {
    const cardRefs = cards(['d1::a', 'd1'], ['d2::b', 'd2'])
    const states = {
      'd1::a': reviewState('d1::a', 'd1', NOW + 2 * 86_400_000),
      'd2::b': reviewState('d2::b', 'd2', NOW + 86_400_000),
    }
    expect(nextDueAt(cardRefs, states, NOW)).toBe(NOW + 86_400_000)
    expect(nextDueAt(cardRefs, states, NOW, 'd1')).toBe(NOW + 2 * 86_400_000)
  })

  it('ignores never-reviewed cards', () => {
    expect(nextDueAt(cards(['d1::a', 'd1']), {}, NOW)).toBeNull()
  })
})
