/**
 * Local-first persistence: IndexedDB via Dexie.
 *
 * Three versioned tables:
 *   cardStates  — one FSRS card state per `cardId` (`deckId::cardId`)
 *   reviewLogs  — append-only review events (stats, streak, daily caps)
 *   settings    — a single `key: 'app'` row
 */
import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { CardStateRecord, ReviewLogRecord } from './scheduler'
import { DEFAULT_SETTINGS, clampSettings } from './settings'
import type { Settings } from './settings'
import { dedupeLogs, mergeSettings, mergeStates } from './importExport'
import type { NormalizedImport } from './importExport'
import { dayKey } from './dates'

export interface SettingsRow extends Settings {
  key: string
}

export const DB_NAME = 'agent-flashcards'
export const SETTINGS_KEY = 'app'

class AppDatabase extends Dexie {
  cardStates!: Table<CardStateRecord, string>
  settings!: Table<SettingsRow, string>
  reviewLogs!: Table<ReviewLogRecord, number>

  constructor() {
    super(DB_NAME)
    // Versioned schema: bump version() + add a .upgrade() when the shape changes.
    this.version(1).stores({
      cardStates: 'cardId, deckId, due, state, last_review',
      settings: 'key',
      reviewLogs: '++id, cardId, deckId, day, review',
    })
  }
}

export const db = new AppDatabase()

export async function loadSettings(): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_KEY)
  if (!row) return { ...DEFAULT_SETTINGS }
  const { key: _key, ...rest } = row
  return clampSettings(rest)
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings()
  const next = clampSettings({ ...current, ...patch })
  await db.settings.put({ key: SETTINGS_KEY, ...next })
  return next
}

export async function loadStates(): Promise<CardStateRecord[]> {
  return db.cardStates.toArray()
}

export async function loadStateMap(): Promise<Record<string, CardStateRecord>> {
  const rows = await db.cardStates.toArray()
  const map: Record<string, CardStateRecord> = {}
  for (const row of rows) map[row.cardId] = row
  return map
}

export async function loadLogs(): Promise<ReviewLogRecord[]> {
  return db.reviewLogs.toArray()
}

/** Daily-cap counters: new cards introduced today vs. reviews of seen cards. */
export async function loadTodayCounts(today: string = dayKey()): Promise<{ newDone: number; reviewDone: number }> {
  const logs = await db.reviewLogs.where('day').equals(today).toArray()
  let newDone = 0
  let reviewDone = 0
  for (const log of logs) {
    if (log.prevState === 0) newDone += 1
    else reviewDone += 1
  }
  return { newDone, reviewDone }
}

/** Persist a review atomically: card state + its log. */
export async function recordReview(card: CardStateRecord, log: ReviewLogRecord): Promise<void> {
  await db.transaction('rw', db.cardStates, db.reviewLogs, async () => {
    await db.cardStates.put(card)
    const { id: _ignored, ...logRow } = log
    await db.reviewLogs.add(logRow)
  })
}

export async function getState(cardId: string): Promise<CardStateRecord | undefined> {
  return db.cardStates.get(cardId)
}

export interface ExportSnapshot {
  cardStates: CardStateRecord[]
  settings: Settings
  reviewLogs: ReviewLogRecord[]
}

export async function loadSnapshot(): Promise<ExportSnapshot> {
  const [cardStates, settings, reviewLogs] = await Promise.all([loadStates(), loadSettings(), loadLogs()])
  return { cardStates, settings, reviewLogs }
}

export async function clearProgress(): Promise<void> {
  await db.transaction('rw', db.cardStates, db.reviewLogs, db.settings, async () => {
    await db.cardStates.clear()
    await db.reviewLogs.clear()
    await db.settings.clear()
  })
}

export interface ImportSummary {
  added: number
  updated: number
  kept: number
  logsAdded: number
  settingsImported: boolean
}

export async function importSnapshot(data: NormalizedImport): Promise<ImportSummary> {
  const [existingStates, existingLogs, currentSettings] = await Promise.all([
    loadStates(),
    loadLogs(),
    loadSettings(),
  ])
  const merged = mergeStates(existingStates, data.cardStates)
  const logs = dedupeLogs([...existingLogs, ...data.reviewLogs])
  const settings = mergeSettings(currentSettings, data.settings)

  await db.transaction('rw', db.cardStates, db.reviewLogs, db.settings, async () => {
    if (merged.rows.length > 0) await db.cardStates.bulkPut(merged.rows)
    if (logs.length > 0) {
      await db.reviewLogs.clear()
      await db.reviewLogs.bulkPut(logs.map(({ id: _ignored, ...row }) => row))
    }
    await db.settings.put({ key: SETTINGS_KEY, ...settings })
  })

  return {
    added: merged.added,
    updated: merged.updated,
    kept: merged.kept,
    logsAdded: logs.length - existingLogs.length,
    settingsImported: data.settings !== null,
  }
}

/** Human-readable IndexedDB failure, e.g. Safari private mode / blocked upgrade. */
export function describeDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/quota/i.test(message)) return '浏览器存储空间不足，请清理后重试。'
  if (/blocked/i.test(message)) return '数据库被其他标签页占用，请关闭其他标签页后重试。'
  if (/security|denied|not allowed/i.test(message)) return '当前浏览器禁止访问本地数据库（无痕模式？），进度无法保存。'
  return `本地数据库操作失败：${message}`
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}
