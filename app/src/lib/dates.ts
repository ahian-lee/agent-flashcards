/**
 * Date helpers.
 *
 * The app deliberately uses *local* calendar days as its day boundary: a review
 * at 23:50 and one at 00:10 belong to different days, and "today" must never
 * shift because of a UTC offset. Hence every key is built from
 * getFullYear/getMonth/getDate, never from toISOString().
 */

const MS_MINUTE = 60_000
const MS_DAY = 86_400_000
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

function pad(value: number): string {
  return `${value}`.padStart(2, '0')
}

/** Local calendar day of `input` as `YYYY-MM-DD`. */
export function dayKey(input: Date | number = new Date()): string {
  const date = typeof input === 'number' ? new Date(input) : input
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight of a `YYYY-MM-DD` key. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/** Day-aligned UTC value so differences are immune to DST / timezone shifts. */
function utcDayValue(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1)
}

/** `a - b` in whole days (positive when `a` is later). */
export function dayKeyDiff(a: string, b: string): number {
  return Math.round((utcDayValue(a) - utcDayValue(b)) / MS_DAY)
}

export function addDaysToKey(key: string, days: number): string {
  const date = parseDayKey(key)
  date.setDate(date.getDate() + days)
  return dayKey(date)
}

/** Ascending list of the last `count` day keys, ending at `today`. */
export function lastNDays(today: string, count: number): string[] {
  const days: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(addDaysToKey(today, -offset))
  }
  return days
}

/**
 * Consecutive-day streak. A streak survives until the first missed day, so a
 * day with activity today OR yesterday keeps the current run alive.
 */
export function computeStreak(dayKeys: Iterable<string>, today: string = dayKey()): number {
  const seen = new Set(dayKeys)
  let cursor = seen.has(today) ? today : addDaysToKey(today, -1)
  if (!seen.has(cursor)) return 0
  let streak = 0
  while (seen.has(cursor)) {
    streak += 1
    cursor = addDaysToKey(cursor, -1)
  }
  return streak
}

/** Human label for a rating preview, e.g. `10 分钟`, `3 天`, `2 个月`. */
export function humanizeInterval(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return '不到 1 分钟'
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} 分钟`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} 小时`
  const days = minutes / 1440
  if (days < 30) return `${Math.round(days)} 天`
  const months = days / 30
  if (months < 12) return `${Math.round(months)} 个月`
  return `${(days / 365).toFixed(1)} 年`
}

/** Relative label for a due timestamp: `现在`, `25 分钟后`, `明天 09:00`, `3月8日`. */
export function formatDue(due: number, now: number = Date.now()): string {
  const diff = due - now
  if (diff <= 60_000) return '现在'
  const minutes = diff / MS_MINUTE
  if (minutes < 360) return humanizeInterval(minutes) + '后'
  const target = new Date(due)
  const clock = `${pad(target.getHours())}:${pad(target.getMinutes())}`
  const delta = dayKeyDiff(dayKey(due), dayKey(now))
  if (delta === 0) return `今天 ${clock}`
  if (delta === 1) return `明天 ${clock}`
  if (delta > 1 && delta < 7) return `${WEEKDAYS[target.getDay()]} ${clock}`
  return `${target.getMonth() + 1}月${target.getDate()}日`
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${dayKey(timestamp)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
