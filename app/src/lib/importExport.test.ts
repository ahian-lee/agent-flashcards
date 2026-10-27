import { describe, expect, it } from 'vitest'
import { State } from 'ts-fsrs'
import {
  EXPORT_KIND,
  EXPORT_VERSION,
  buildExport,
  dedupeLogs,
  mergeSettings,
  mergeStates,
  validateImport,
} from './importExport'
import type { CardStateRecord, ReviewLogRecord } from './scheduler'
import { DEFAULT_SETTINGS } from './settings'

function state(overrides: Partial<CardStateRecord> = {}): CardStateRecord {
  return {
    cardId: 'deck::1',
    deckId: 'deck',
    due: 1_767_000_000_000,
    stability: 5,
    difficulty: 5,
    elapsed_days: 2,
    scheduled_days: 3,
    learning_steps: 0,
    reps: 2,
    lapses: 0,
    state: State.Review,
    last_review: 1_767_000_000_000,
    ...overrides,
  }
}

function log(overrides: Partial<ReviewLogRecord> = {}): ReviewLogRecord {
  return {
    cardId: 'deck::1',
    deckId: 'deck',
    cardType: 'qa',
    rating: 3,
    prevState: State.New,
    prevDue: 1_766_900_000_000,
    due: 1_767_000_000_000,
    stability: 5,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 3,
    learning_steps: 0,
    review: 1_766_900_000_000,
    day: '2026-01-15',
    correct: true,
    mode: 'qa',
    ...overrides,
  }
}

function payload(states: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { app: EXPORT_KIND, version: EXPORT_VERSION, cardStates: states, ...extra }
}

describe('buildExport', () => {
  it('stamps kind and version so imports can be checked', () => {
    const exported = buildExport([state()], { ...DEFAULT_SETTINGS }, [log()], 1_767_000_000_000)
    expect(exported.app).toBe(EXPORT_KIND)
    expect(exported.version).toBe(EXPORT_VERSION)
    expect(exported.exportedAt).toBe(1_767_000_000_000)
    expect(exported.cardStates).toHaveLength(1)
    expect(exported.reviewLogs).toHaveLength(1)
  })
})

describe('validateImport — rejects bad payloads', () => {
  it('rejects invalid JSON text', () => {
    const result = validateImport('{ not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('JSON')
  })

  it('rejects non-object roots', () => {
    for (const bad of [42, null, '[]', [1, 2, 3], true]) {
      expect(validateImport(bad).ok).toBe(false)
    }
  })

  it('rejects a missing / non-numeric version', () => {
    expect(validateImport({ cardStates: [] }).ok).toBe(false)
    expect(validateImport({ version: 'one', cardStates: [] }).ok).toBe(false)
    expect(validateImport({ version: 0, cardStates: [] }).ok).toBe(false)
  })

  it('rejects a version from the future', () => {
    const result = validateImport({ version: EXPORT_VERSION + 1, cardStates: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('版本')
  })

  it('rejects backups from another app', () => {
    const result = validateImport({ app: 'other-app', version: 1, cardStates: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('app=')
  })

  it('rejects a payload without a cardStates array', () => {
    expect(validateImport({ version: 1 }).ok).toBe(false)
    expect(validateImport({ version: 1, cardStates: {} }).ok).toBe(false)
  })

  it('rejects states that carry no usable row at all', () => {
    expect(validateImport(payload([{ foo: 'bar' }, null, 3])).ok).toBe(false)
  })

  it('rejects rows missing the fields progress depends on', () => {
    const broken = [
      { cardId: 'a', deckId: 'd', due: 1, state: 2 }, // fine
      { deckId: 'd', due: 1, state: 2 }, // no cardId
      { cardId: 'b', deckId: 'd', state: 2 }, // no due
      { cardId: 'c', deckId: 'd', due: 1, state: 9 }, // state out of range
    ]
    const result = validateImport(payload(broken))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.cardStates).toHaveLength(1)
      expect(result.data.cardStates[0].cardId).toBe('a')
      expect(result.data.skipped).toBe(3)
    }
  })
})

describe('validateImport — accepts and normalises good payloads', () => {
  it('normalises ISO timestamps into epoch milliseconds', () => {
    const result = validateImport(
      payload([
        {
          cardId: 'deck::1',
          deckId: 'deck',
          due: '2026-02-01T08:00:00.000Z',
          state: 'Review',
          stability: '12.5',
          difficulty: 4,
          reps: 3,
          lapses: 1,
          last_review: '2026-01-20T08:00:00.000Z',
        },
      ]),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = result.data.cardStates[0]
    expect(row.due).toBe(Date.parse('2026-02-01T08:00:00.000Z'))
    expect(row.last_review).toBe(Date.parse('2026-01-20T08:00:00.000Z'))
    expect(row.state).toBe(State.Review)
    expect(row.stability).toBe(12.5)
    expect(row.reps).toBe(3)
    expect(row.learning_steps).toBe(0) // absent fields default to 0, never NaN
  })

  it('accepts the raw file text directly', () => {
    const text = JSON.stringify(payload([state()]))
    const result = validateImport(text)
    expect(result.ok).toBe(true)
  })

  it('deduplicates repeated cardIds inside one file', () => {
    const result = validateImport(payload([state(), state({ stability: 99 })]))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.cardStates).toHaveLength(1)
  })

  it('clamps imported settings and keeps unknown values out', () => {
    const result = validateImport(payload([state()], { settings: { newPerDay: 9999, theme: 'neon' } }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.settings?.newPerDay).toBe(500)
    expect(result.data.settings?.theme).toBe('auto')
  })
})

describe('mergeStates', () => {
  const existing = [state({ cardId: 'keep', last_review: 2_000 }), state({ cardId: 'update', last_review: 1_000 })]

  it('adds unknown cards, updates newer imports and keeps newer local rows', () => {
    const incoming = [
      state({ cardId: 'keep', last_review: 500 }), // older than local -> kept
      state({ cardId: 'update', last_review: 5_000 }), // newer -> imported
      state({ cardId: 'fresh', last_review: 1 }), // new
    ]
    const merged = mergeStates(existing, incoming)
    expect(merged.added).toBe(1)
    expect(merged.updated).toBe(1)
    expect(merged.kept).toBe(1)
    expect(merged.rows).toHaveLength(3)
    expect(merged.rows.find((row) => row.cardId === 'keep')?.last_review).toBe(2_000)
    expect(merged.rows.find((row) => row.cardId === 'update')?.last_review).toBe(5_000)
  })

  it('is idempotent when importing the same file twice', () => {
    const incoming = [state({ cardId: 'keep' }), state({ cardId: 'update', last_review: 5_000 })]
    const once = mergeStates(existing, incoming)
    const twice = mergeStates(once.rows, incoming)
    expect(twice.rows).toHaveLength(once.rows.length)
    expect(twice.added).toBe(0)
  })
})

describe('dedupeLogs', () => {
  it('collapses the same review event imported twice', () => {
    const logs = [log(), log(), log({ review: 1_766_900_000_001 })]
    expect(dedupeLogs(logs)).toHaveLength(2)
  })
})

describe('mergeSettings', () => {
  it('keeps current values when the backup has no settings', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS)
  })

  it('overlays imported values', () => {
    const merged = mergeSettings({ ...DEFAULT_SETTINGS, newPerDay: 5 }, { ...DEFAULT_SETTINGS, newPerDay: 30 })
    expect(merged.newPerDay).toBe(30)
  })
})
