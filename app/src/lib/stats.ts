/**
 * Pure aggregation helpers for the home screen and the stats page.
 * No Dexie import here: these are unit-tested against plain arrays.
 */
import { computeStreak, dayKey, dayKeyDiff, lastNDays } from './dates'
import { State, isMastered } from './scheduler'
import type { CardStateRecord, ReviewLogRecord } from './scheduler'
import type { Deck } from './content'

export interface DeckStats {
  deckId: string
  title: string
  total: number
  /** never reviewed */
  fresh: number
  /** Learning / Relearning */
  learning: number
  /** due now */
  due: number
  /** Review state */
  reviewing: number
  mastered: number
  /** 0..1 share of cards that have graduated to Review */
  progress: number
}

export function deckStats(deck: Deck, states: Readonly<Record<string, CardStateRecord | undefined>>, now: number): DeckStats {
  let fresh = 0
  let learning = 0
  let due = 0
  let reviewing = 0
  let mastered = 0

  for (const card of deck.cards) {
    const state = states[card.uid]
    if (!state || state.state === State.New) {
      fresh += 1
      continue
    }
    if (state.due <= now) due += 1
    if (state.state === State.Learning || state.state === State.Relearning) learning += 1
    if (state.state === State.Review) reviewing += 1
    if (isMastered(state)) mastered += 1
  }

  const total = deck.cards.length
  return {
    deckId: deck.id,
    title: deck.title,
    total,
    fresh,
    learning,
    due,
    reviewing,
    mastered,
    progress: total === 0 ? 0 : (reviewing + learning) / total,
  }
}

export interface TodayStats {
  /** total reviews logged today */
  reviewed: number
  /** new cards introduced today */
  newLearned: number
  /** reviews of already-seen cards today */
  reviewedExisting: number
  correct: number
  accuracy: number | null
}

export function todayStats(logs: readonly ReviewLogRecord[], today: string = dayKey()): TodayStats {
  let reviewed = 0
  let newLearned = 0
  let reviewedExisting = 0
  let correct = 0

  for (const log of logs) {
    if (log.day !== today) continue
    reviewed += 1
    if (log.prevState === State.New) newLearned += 1
    else reviewedExisting += 1
    if (log.correct) correct += 1
  }

  return {
    reviewed,
    newLearned,
    reviewedExisting,
    correct,
    accuracy: reviewed === 0 ? null : correct / reviewed,
  }
}

export interface DayBucket {
  day: string
  count: number
  /** short axis label, e.g. `10/21` */
  label: string
}

export function dailyActivity(logs: readonly ReviewLogRecord[], today: string = dayKey(), days = 7): DayBucket[] {
  const counts = new Map<string, number>()
  for (const log of logs) counts.set(log.day, (counts.get(log.day) ?? 0) + 1)
  return lastNDays(today, days).map((day) => ({
    day,
    count: counts.get(day) ?? 0,
    label: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
  }))
}

/** Consecutive active days, tolerating an inactive "today" (streak counted from yesterday). */
export function streakFromLogs(logs: readonly ReviewLogRecord[], today: string = dayKey()): number {
  return computeStreak(logs.map((log) => log.day), today)
}

export interface OverviewStats {
  totalCards: number
  mastered: number
  dueNow: number
  newCards: number
  learning: number
  reviewedToday: number
  newToday: number
  accuracyToday: number | null
  streak: number
  /** 0..1 */
  mastery: number
}

export function overview(
  decks: readonly Deck[],
  states: Readonly<Record<string, CardStateRecord | undefined>>,
  logs: readonly ReviewLogRecord[],
  now: number,
  today: string = dayKey(),
): OverviewStats {
  const todayStatsValue = todayStats(logs, today)
  let totalCards = 0
  let mastered = 0
  let dueNow = 0
  let newCards = 0
  let learning = 0

  for (const deck of decks) {
    for (const card of deck.cards) {
      totalCards += 1
      const state = states[card.uid]
      if (!state || state.state === State.New) {
        newCards += 1
        continue
      }
      if (state.due <= now) dueNow += 1
      if (state.state === State.Learning || state.state === State.Relearning) learning += 1
      if (isMastered(state)) mastered += 1
    }
  }

  return {
    totalCards,
    mastered,
    dueNow,
    newCards,
    learning,
    reviewedToday: todayStatsValue.reviewed,
    newToday: todayStatsValue.newLearned,
    accuracyToday: todayStatsValue.accuracy,
    streak: streakFromLogs(logs, today),
    mastery: totalCards === 0 ? 0 : mastered / totalCards,
  }
}

/** Logs grouped by day for the last `days` days, oldest first (chart input). */
export function activityTotals(buckets: readonly DayBucket[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.count, 0)
}

export function daysSinceFirstLog(logs: readonly ReviewLogRecord[], today: string = dayKey()): number | null {
  if (logs.length === 0) return null
  const earliest = logs.reduce((min, log) => (log.day < min ? log.day : min), logs[0].day)
  return dayKeyDiff(today, earliest)
}
