/**
 * Thin adapter over ts-fsrs@5.4.2 (FSRS-6).
 *
 * Everything the app knows about spaced repetition lives here: the rest of the
 * codebase only sees `CardStateRecord` / `ReviewLogRecord` plain objects with
 * numeric timestamps, so IndexedDB round-trips never have to deal with `Date`
 * instances, and the scheduler can be swapped or unit-tested in isolation.
 *
 * Verified behaviour of the installed version (see README):
 *   new card -> Again 1min | Hard 6min | Good 10min | Easy 8 days
 *   review card -> Again relearn 10min | Hard < Good < Easy (days)
 *
 * `enable_short_term` stays ON (ts-fsrs default learning steps `1m`/`10m`),
 * which is why the study queue implements an Anki-style "learn ahead" window.
 */
import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs'
import type { Card, Grade } from 'ts-fsrs'

export { Rating, State }

/** Persisted FSRS card state (keyed by `cardId` in IndexedDB). */
export interface CardStateRecord {
  cardId: string
  deckId: string
  /** epoch ms (ts-fsrs Date) */
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  /** ts-fsrs State: 0 New | 1 Learning | 2 Review | 3 Relearning */
  state: number
  /** epoch ms, null for a never-reviewed card */
  last_review: number | null
}

/** One immutable review event, used for stats and streaks. */
export interface ReviewLogRecord {
  id?: number
  cardId: string
  deckId: string
  cardType: string
  rating: number
  /** state *before* this review */
  prevState: number
  prevDue: number
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  /** epoch ms of the review itself */
  review: number
  /** local `YYYY-MM-DD` bucket */
  day: string
  /** whether the user actually recalled / answered correctly */
  correct: boolean
  /** qa | mcq | cloze */
  mode: string
}

export const DESIRED_RETENTION = 0.9
export const MAX_INTERVAL_DAYS = 36_500

export const RATING_ORDER: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

export const RATING_LABELS: Record<number, string> = {
  [Rating.Again]: '忘了',
  [Rating.Hard]: '困难',
  [Rating.Good]: '记得',
  [Rating.Easy]: '太简单',
}

export const RATING_HINTS: Record<number, string> = {
  [Rating.Again]: '完全想不起来',
  [Rating.Hard]: '想起来了，但很费劲',
  [Rating.Good]: '正常回忆出来',
  [Rating.Easy]: '毫不费力',
}

const engine = fsrs({
  enable_fuzz: false, // deterministic schedules: reproducible + testable
  request_retention: DESIRED_RETENTION,
  maximum_interval: MAX_INTERVAL_DAYS,
  enable_short_term: true,
})

/** A brand new, never-reviewed card. */
export function newCardState(cardId: string, deckId: string, now: number = Date.now()): CardStateRecord {
  return fromFsrsCard(createEmptyCard(new Date(now)), cardId, deckId)
}

/** Stored record -> ts-fsrs `Card`. */
export function toFsrsCard(record: CardStateRecord): Card {
  const card: Card = {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsed_days,
    scheduled_days: record.scheduled_days,
    learning_steps: record.learning_steps,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state as State,
  }
  if (record.last_review !== null) card.last_review = new Date(record.last_review)
  return card
}

/** ts-fsrs `Card` -> stored record. */
export function fromFsrsCard(card: Card, cardId: string, deckId: string): CardStateRecord {
  return {
    cardId,
    deckId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  }
}

export interface ScheduleResult {
  card: CardStateRecord
  log: ReviewLogRecord
}

/**
 * Apply a rating and return the next card state plus a review log.
 * `state` may be `null` for a card that has never been reviewed.
 */
export function schedule(
  state: CardStateRecord | null,
  rating: Grade,
  now: number = Date.now(),
  meta: { cardId: string; deckId: string; cardType?: string; correct?: boolean } = {
    cardId: state?.cardId ?? '',
    deckId: state?.deckId ?? '',
  },
): ScheduleResult {
  const cardId = meta.cardId || state?.cardId || ''
  const deckId = meta.deckId || state?.deckId || ''
  const current = state ? toFsrsCard(state) : createEmptyCard(new Date(now))
  const { card } = engine.next(current, new Date(now), rating)
  const next = fromFsrsCard(card, cardId, deckId)
  const prevState = state ? state.state : State.New
  const prevDue = state ? state.due : now
  return {
    card: next,
    log: {
      cardId,
      deckId,
      cardType: meta.cardType ?? 'qa',
      rating,
      prevState,
      prevDue,
      due: next.due,
      stability: next.stability,
      difficulty: next.difficulty,
      elapsed_days: next.elapsed_days,
      scheduled_days: next.scheduled_days,
      learning_steps: next.learning_steps,
      review: now,
      day: dayKeyOf(now),
      correct: meta.correct ?? rating !== Rating.Again,
      mode: meta.cardType ?? 'qa',
    },
  }
}

/** Kept local to avoid importing dates.ts into the scheduler's hot path. */
function dayKeyOf(timestamp: number): string {
  const date = new Date(timestamp)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export interface RatingPreview {
  rating: Grade
  /** epoch ms the card would be due */
  due: number
  /** minutes until due */
  minutes: number
  card: CardStateRecord
}

/** The four outcomes of the current card, cheaply previewed for the rating bar. */
export function previewSchedule(state: CardStateRecord | null, now: number = Date.now()): RatingPreview[] {
  const current = state ? toFsrsCard(state) : createEmptyCard(new Date(now))
  const preview = engine.repeat(current, new Date(now))
  return RATING_ORDER.map((rating) => {
    const next = preview[rating].card
    return {
      rating,
      due: next.due.getTime(),
      minutes: Math.max(0, (next.due.getTime() - now) / 60_000),
      card: fromFsrsCard(next, state?.cardId ?? '', state?.deckId ?? ''),
    }
  })
}

export function isNewState(state: number | undefined | null): boolean {
  return state == null || state === State.New
}

export function isLearningState(state: number | undefined | null): boolean {
  return state === State.Learning || state === State.Relearning
}

export function isDue(state: CardStateRecord | undefined | null, now: number = Date.now()): boolean {
  return !!state && state.due <= now
}

/** "Mastered" = graduated to Review and either reviewed 3+ times or very stable. */
export function isMastered(state: CardStateRecord | undefined | null): boolean {
  if (!state) return false
  return state.state === State.Review && (state.reps >= 3 || state.stability >= 21)
}
