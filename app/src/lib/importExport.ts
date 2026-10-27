/**
 * Export / import of the local-first database.
 *
 * The payload is versioned and validated structurally before anything touches
 * IndexedDB. Import merges by `cardId` and never silently regresses progress:
 * when both sides have a row, the one reviewed more recently wins.
 */
import { clampSettings, DEFAULT_SETTINGS } from './settings'
import type { Settings } from './settings'
import type { CardStateRecord, ReviewLogRecord } from './scheduler'
import { State } from './scheduler'

export const EXPORT_KIND = 'agent-flashcards'
export const EXPORT_VERSION = 1

export interface ExportPayload {
  app: typeof EXPORT_KIND
  version: number
  exportedAt: number
  settings: Settings
  cardStates: CardStateRecord[]
  reviewLogs: ReviewLogRecord[]
}

export function buildExport(
  cardStates: readonly CardStateRecord[],
  settings: Settings,
  reviewLogs: readonly ReviewLogRecord[],
  now: number = Date.now(),
): ExportPayload {
  return {
    app: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: now,
    settings,
    cardStates: [...cardStates],
    reviewLogs: [...reviewLogs],
  }
}

export interface NormalizedImport {
  settings: Settings | null
  cardStates: CardStateRecord[]
  reviewLogs: ReviewLogRecord[]
  skipped: number
}

export type ValidationResult = { ok: true; data: NormalizedImport } | { ok: false; error: string }

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

/** Timestamps are accepted as epoch ms, numeric strings or ISO strings. */
function asTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = asNumber(value)
  if (numeric !== null) return numeric
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asState(value: unknown): number | null {
  if (typeof value === 'string' && value in State) {
    return State[value as keyof typeof State] as unknown as number
  }
  const numeric = asNumber(value)
  if (numeric === null) return null
  return numeric >= 0 && numeric <= 3 ? Math.round(numeric) : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function normalizeStateRow(raw: unknown): CardStateRecord | null {
  const record = asRecord(raw)
  if (!record) return null
  const cardId = typeof record.cardId === 'string' ? record.cardId.trim() : ''
  const deckId = typeof record.deckId === 'string' ? record.deckId.trim() : ''
  const due = asTimestamp(record.due)
  const state = asState(record.state)
  if (!cardId || !deckId || due === null || state === null) return null
  return {
    cardId,
    deckId,
    due,
    stability: Math.max(0, asNumber(record.stability) ?? 0),
    difficulty: Math.max(0, asNumber(record.difficulty) ?? 0),
    elapsed_days: Math.max(0, asNumber(record.elapsed_days) ?? 0),
    scheduled_days: Math.max(0, asNumber(record.scheduled_days) ?? 0),
    learning_steps: Math.max(0, asNumber(record.learning_steps) ?? 0),
    reps: Math.max(0, asNumber(record.reps) ?? 0),
    lapses: Math.max(0, asNumber(record.lapses) ?? 0),
    state,
    last_review: asTimestamp(record.last_review),
  }
}

export function normalizeLogRow(raw: unknown): ReviewLogRecord | null {
  const record = asRecord(raw)
  if (!record) return null
  const cardId = typeof record.cardId === 'string' ? record.cardId.trim() : ''
  const review = asTimestamp(record.review)
  const rating = asNumber(record.rating)
  if (!cardId || review === null || rating === null) return null
  return {
    cardId,
    deckId: typeof record.deckId === 'string' ? record.deckId : '',
    cardType: typeof record.cardType === 'string' ? record.cardType : 'qa',
    rating: Math.round(rating),
    prevState: asState(record.prevState) ?? 0,
    prevDue: asTimestamp(record.prevDue) ?? review,
    due: asTimestamp(record.due) ?? review,
    stability: Math.max(0, asNumber(record.stability) ?? 0),
    difficulty: Math.max(0, asNumber(record.difficulty) ?? 0),
    elapsed_days: Math.max(0, asNumber(record.elapsed_days) ?? 0),
    scheduled_days: Math.max(0, asNumber(record.scheduled_days) ?? 0),
    learning_steps: Math.max(0, asNumber(record.learning_steps) ?? 0),
    review,
    day: typeof record.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.day) ? record.day : dayKeyOf(review),
    correct: typeof record.correct === 'boolean' ? record.correct : Math.round(rating) > 1,
    mode: typeof record.mode === 'string' ? record.mode : 'qa',
  }
}

function dayKeyOf(timestamp: number): string {
  const date = new Date(timestamp)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Validate an arbitrary parsed JSON value as an import payload. */
export function validateImport(raw: unknown): ValidationResult {
  if (typeof raw === 'string') {
    // allow passing the raw file text directly
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      return { ok: false, error: '不是合法的 JSON 文件' }
    }
  }
  const record = asRecord(raw)
  if (!record) return { ok: false, error: '文件结构不正确：顶层必须是对象' }

  const app = record.app
  if (app !== undefined && app !== EXPORT_KIND) {
    return { ok: false, error: `不是本应用导出的备份文件（app=${String(app)}）` }
  }

  const version = asNumber(record.version)
  if (version === null) return { ok: false, error: '缺少 version 字段' }
  if (!Number.isInteger(version) || version < 1) return { ok: false, error: `version 不合法：${String(version)}` }
  if (version > EXPORT_VERSION) {
    return { ok: false, error: `备份版本 ${version} 高于当前支持的 ${EXPORT_VERSION}，请升级应用后再导入` }
  }

  const rawStates = record.cardStates
  if (!Array.isArray(rawStates)) return { ok: false, error: '缺少 cardStates 数组' }

  const cardStates: CardStateRecord[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const item of rawStates) {
    const row = normalizeStateRow(item)
    if (!row || seen.has(row.cardId)) {
      skipped += 1
      continue
    }
    seen.add(row.cardId)
    cardStates.push(row)
  }
  if (rawStates.length > 0 && cardStates.length === 0) {
    return { ok: false, error: 'cardStates 里没有可用的记录（检查 cardId / due / state 字段）' }
  }

  const reviewLogs: ReviewLogRecord[] = []
  if (Array.isArray(record.reviewLogs)) {
    for (const item of record.reviewLogs) {
      const row = normalizeLogRow(item)
      if (row) reviewLogs.push(row)
      else skipped += 1
    }
  }

  const settings = record.settings === undefined ? null : clampSettings(record.settings)

  return { ok: true, data: { settings, cardStates, reviewLogs, skipped } }
}

export interface MergeResult {
  rows: CardStateRecord[]
  added: number
  updated: number
  /** duplicates kept as-is because the stored copy is newer */
  kept: number
}

/** Merge imported states into existing ones, keyed by `cardId`. */
export function mergeStates(
  existing: readonly CardStateRecord[],
  incoming: readonly CardStateRecord[],
): MergeResult {
  const byId = new Map<string, CardStateRecord>()
  for (const row of existing) byId.set(row.cardId, row)
  let added = 0
  let updated = 0
  let kept = 0

  for (const row of incoming) {
    const current = byId.get(row.cardId)
    if (!current) {
      byId.set(row.cardId, row)
      added += 1
      continue
    }
    const currentReviewed = current.last_review ?? 0
    const incomingReviewed = row.last_review ?? 0
    if (incomingReviewed >= currentReviewed) {
      byId.set(row.cardId, row)
      updated += 1
    } else {
      kept += 1
    }
  }

  return { rows: [...byId.values()], added, updated, kept }
}

/** De-duplicate review logs imported twice (same card, same instant, same rating). */
export function dedupeLogs(logs: readonly ReviewLogRecord[]): ReviewLogRecord[] {
  const seen = new Set<string>()
  const out: ReviewLogRecord[] = []
  for (const log of logs) {
    const key = `${log.cardId}|${log.review}|${log.rating}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(log)
  }
  return out
}

/** Merge settings, keeping stored values for anything absent in the import. */
export function mergeSettings(current: Settings, imported: Settings | null): Settings {
  return imported ? clampSettings({ ...DEFAULT_SETTINGS, ...current, ...imported }) : current
}
