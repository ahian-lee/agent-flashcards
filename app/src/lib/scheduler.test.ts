import { describe, expect, it } from 'vitest'
import { Rating, State } from 'ts-fsrs'
import {
  isMastered,
  isNewState,
  newCardState,
  previewSchedule,
  schedule,
} from './scheduler'

/** Fixed local "now": 2026-01-15 09:00 local time. */
const NOW = new Date(2026, 0, 15, 9, 0, 0, 0).getTime()
const MINUTE = 60_000
const DAY = 86_400_000

describe('scheduler adapter (ts-fsrs 5.4.2)', () => {
  it('creates a New card with zeroed counters and due = now', () => {
    const card = newCardState('deck::card', 'deck', NOW)
    expect(card.state).toBe(State.New)
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(0)
    expect(card.stability).toBe(0)
    expect(card.due).toBe(NOW)
    expect(card.last_review).toBeNull()
  })

  it('stores timestamps as numbers (persistable) and dates remain valid', () => {
    const { card } = schedule(null, Rating.Good, NOW, { cardId: 'deck::1', deckId: 'deck' })
    expect(typeof card.due).toBe('number')
    expect(typeof card.last_review).toBe('number')
    expect(Number.isFinite(card.due)).toBe(true)
    expect(new Date(card.due).getTime()).toBe(card.due)
    expect(card.last_review).toBe(NOW)
  })

  it('Good on a new card schedules it in the future (learning step)', () => {
    const { card } = schedule(null, Rating.Good, NOW, { cardId: 'deck::1', deckId: 'deck' })
    expect(card.due).toBeGreaterThan(NOW)
    expect(card.due).toBeLessThanOrEqual(NOW + 60 * MINUTE)
    expect(card.reps).toBe(1)
    expect(card.state).toBe(State.Learning)
  })

  it('Again on a new card comes back almost immediately', () => {
    const { card } = schedule(null, Rating.Again, NOW, { cardId: 'deck::1', deckId: 'deck' })
    expect(card.due).toBeGreaterThanOrEqual(NOW)
    expect(card.due).toBeLessThanOrEqual(NOW + 5 * MINUTE)
    expect(card.lapses).toBe(0) // a brand new card is not a lapse
  })

  it('four ratings produce monotonically increasing intervals for a new card', () => {
    const previews = previewSchedule(null, NOW)
    expect(previews.map((preview) => preview.rating)).toEqual([
      Rating.Again,
      Rating.Hard,
      Rating.Good,
      Rating.Easy,
    ])
    for (let index = 1; index < previews.length; index += 1) {
      expect(previews[index].due).toBeGreaterThan(previews[index - 1].due)
    }
    expect(previews[3].due - NOW).toBeGreaterThanOrEqual(6 * DAY) // Easy graduates to Review
  })

  it('four ratings stay monotonic for a mature Review card', () => {
    const easy = schedule(null, Rating.Easy, NOW, { cardId: 'deck::1', deckId: 'deck' })
    expect(easy.card.state).toBe(State.Review)
    // preview from the moment the card is due again
    const previews = previewSchedule(easy.card, easy.card.due)
    expect(previews.map((preview) => preview.rating)).toEqual([
      Rating.Again,
      Rating.Hard,
      Rating.Good,
      Rating.Easy,
    ])
    for (let index = 1; index < previews.length; index += 1) {
      expect(previews[index].due).toBeGreaterThan(previews[index - 1].due)
    }
    // Again drops into Relearning, far sooner than Hard
    expect(previews[0].minutes).toBeLessThanOrEqual(20)
  })

  it('keeps learning_steps so graded steps are reproducible after a reload', () => {
    const good = schedule(null, Rating.Good, NOW, { cardId: 'deck::1', deckId: 'deck' })
    expect(good.card.learning_steps).toBeGreaterThan(0)
    const roundTripped = JSON.parse(JSON.stringify(good.card))
    const second = schedule(roundTripped, Rating.Good, good.card.due, {
      cardId: 'deck::1',
      deckId: 'deck',
    })
    expect(second.card.state).toBe(State.Review)
    expect(second.log.prevState).toBe(State.Learning)
    expect(second.card.reps).toBe(2)
  })

  it('logs what it did (rating, day bucket, correctness, prior state)', () => {
    const { log } = schedule(null, Rating.Again, NOW, {
      cardId: 'deck::1',
      deckId: 'deck',
      cardType: 'mcq',
      correct: false,
    })
    expect(log.rating).toBe(Rating.Again)
    expect(log.prevState).toBe(State.New)
    expect(log.day).toBe('2026-01-15')
    expect(log.review).toBe(NOW)
    expect(log.correct).toBe(false)
    expect(log.mode).toBe('mcq')
    expect(log.due).toBeGreaterThanOrEqual(NOW)
  })

  it('marks only graduated, well-rehearsed cards as mastered', () => {
    expect(isMastered(null)).toBe(false)
    const learning = schedule(null, Rating.Good, NOW, { cardId: 'deck::1', deckId: 'deck' })
    expect(isMastered(learning.card)).toBe(false)
    const review = schedule(null, Rating.Easy, NOW, { cardId: 'deck::1', deckId: 'deck' })
    expect(review.card.state).toBe(State.Review)
    // graduated once, but not yet "mastered"
    expect(isMastered(review.card)).toBe(false)
    expect(isMastered({ ...review.card, reps: 4 })).toBe(true)
    expect(isMastered({ ...review.card, stability: 30 })).toBe(true)
    expect(isNewState(learning.card.state)).toBe(false)
    expect(isNewState(undefined)).toBe(true)
  })
})
