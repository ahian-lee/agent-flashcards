import { describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  computeStreak,
  dayKey,
  dayKeyDiff,
  formatDue,
  humanizeInterval,
  lastNDays,
  parseDayKey,
} from './dates'

describe('dayKey — local calendar day', () => {
  it('uses local date parts, not UTC', () => {
    const midnightish = new Date(2026, 0, 1, 0, 30)
    expect(dayKey(midnightish)).toBe('2026-01-01')

    // outside UTC±0 the UTC date differs from the local date; dayKey must follow local
    if (midnightish.getTimezoneOffset() !== 0) {
      expect(midnightish.toISOString().slice(0, 10)).not.toBe(dayKey(midnightish))
    }
  })

  it('handles the last minute of a year correctly', () => {
    expect(dayKey(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31')
    expect(dayKey(new Date(2027, 0, 1, 0, 0, 1))).toBe('2027-01-01')
  })

  it('accepts epoch milliseconds', () => {
    const stamp = new Date(2026, 6, 4, 12, 0).getTime()
    expect(dayKey(stamp)).toBe('2026-07-04')
  })

  it('round-trips through parseDayKey', () => {
    const parsed = parseDayKey('2026-03-08')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(2)
    expect(parsed.getDate()).toBe(8)
    expect(dayKey(parsed)).toBe('2026-03-08')
  })
})

describe('day arithmetic', () => {
  it('computes day differences across month, year and leap boundaries', () => {
    expect(dayKeyDiff('2026-03-01', '2026-02-28')).toBe(1)
    expect(dayKeyDiff('2027-01-01', '2026-12-31')).toBe(1)
    expect(dayKeyDiff('2028-03-01', '2028-02-28')).toBe(2) // leap year
    expect(dayKeyDiff('2026-01-01', '2026-01-01')).toBe(0)
    expect(dayKeyDiff('2026-01-01', '2026-01-08')).toBe(-7)
  })

  it('adds and subtracts days across boundaries', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('builds an ascending window ending today', () => {
    const days = lastNDays('2026-01-07', 7)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-01-01')
    expect(days[6]).toBe('2026-01-07')
  })
})

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-01-05', '2026-01-06', '2026-01-07'], '2026-01-07')).toBe(3)
  })

  it('keeps the streak alive when today has no review yet', () => {
    expect(computeStreak(['2026-01-05', '2026-01-06'], '2026-01-07')).toBe(2)
  })

  it('resets after a missed day', () => {
    expect(computeStreak(['2026-01-01', '2026-01-02', '2026-01-05'], '2026-01-07')).toBe(0)
    expect(computeStreak([], '2026-01-07')).toBe(0)
  })

  it('starts from today when today is active', () => {
    expect(computeStreak(['2026-01-07'], '2026-01-07')).toBe(1)
  })
})

describe('humanizeInterval', () => {
  it('picks a sensible unit', () => {
    expect(humanizeInterval(0.4)).toBe('不到 1 分钟')
    expect(humanizeInterval(10)).toBe('10 分钟')
    expect(humanizeInterval(90)).toBe('2 小时')
    expect(humanizeInterval(1440)).toBe('1 天')
    expect(humanizeInterval(1440 * 45)).toBe('2 个月')
  })
})

describe('formatDue', () => {
  const now = new Date(2026, 0, 15, 9, 0).getTime()

  it('describes imminent reviews', () => {
    expect(formatDue(now - 60_000, now)).toBe('现在')
    expect(formatDue(now + 25 * 60_000, now)).toBe('25 分钟后')
  })

  it('describes later reviews by day', () => {
    expect(formatDue(new Date(2026, 0, 16, 9, 0).getTime(), now)).toBe('明天 09:00')
    expect(formatDue(new Date(2026, 1, 8, 9, 0).getTime(), now)).toBe('2月8日')
  })
})
