/**
 * User settings: defaults, clamping and tolerant parsing.
 * Kept free of IndexedDB so it can be imported by tests and by the importer.
 */

export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Settings {
  /** new cards introduced per day */
  newPerDay: number
  /** reviews shown per day */
  reviewPerDay: number
  /** short-term "learn ahead" window in minutes */
  learnAheadMinutes: number
  theme: ThemeMode
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 20,
  reviewPerDay: 200,
  learnAheadMinutes: 20,
  theme: 'auto',
}

export const SETTING_LIMITS = {
  newPerDay: { min: 0, max: 500, step: 5 },
  reviewPerDay: { min: 0, max: 2000, step: 10 },
  learnAheadMinutes: { min: 0, max: 180, step: 5 },
} as const

export const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark']

export const THEME_LABELS: Record<ThemeMode, string> = {
  auto: '跟随系统',
  light: '浅色',
  dark: '深色',
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

/** Never throws: unknown / partial / out-of-range input collapses to defaults. */
export function clampSettings(raw: unknown): Settings {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    newPerDay: clampNumber(
      record.newPerDay,
      SETTING_LIMITS.newPerDay.min,
      SETTING_LIMITS.newPerDay.max,
      DEFAULT_SETTINGS.newPerDay,
    ),
    reviewPerDay: clampNumber(
      record.reviewPerDay,
      SETTING_LIMITS.reviewPerDay.min,
      SETTING_LIMITS.reviewPerDay.max,
      DEFAULT_SETTINGS.reviewPerDay,
    ),
    learnAheadMinutes: clampNumber(
      record.learnAheadMinutes,
      SETTING_LIMITS.learnAheadMinutes.min,
      SETTING_LIMITS.learnAheadMinutes.max,
      DEFAULT_SETTINGS.learnAheadMinutes,
    ),
    theme: isThemeMode(record.theme) ? record.theme : DEFAULT_SETTINGS.theme,
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const prefersDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1220' : '#4f46e5')
}
