import type { Config } from './types'
import { HOME, normalize } from '../utils/path'

export const str = (c: Config, key: string): string => (typeof c[key] === 'string' ? (c[key] as string) : '')
export const num = (c: Config, key: string, fallback = 0): number =>
  typeof c[key] === 'number' && Number.isFinite(c[key]) ? (c[key] as number) : fallback
export const strList = (c: Config, key: string): string[] =>
  Array.isArray(c[key]) ? (c[key] as unknown[]).filter((v): v is string => typeof v === 'string') : []
export const numList = (c: Config, key: string): number[] =>
  Array.isArray(c[key]) ? (c[key] as unknown[]).filter((v): v is number => typeof v === 'number') : []

/** `~`, `~/x` and relative paths all resolve inside the user's home folder. */
export function resolvePath(input: string): string {
  const p = input.trim()
  if (p === '~') return HOME
  if (p.startsWith('~/')) return normalize(p.slice(2), HOME)
  return normalize(p, HOME)
}

export const isInHome = (path: string) => path === HOME || path.startsWith(HOME + '/')

export const pad2 = (n: number) => String(n).padStart(2, '0')

/** Minutes since midnight for an "HH:MM" string, or null if malformed. */
export function minutesOf(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return null
  const h = +m[1], min = +m[2]
  return h < 24 && min < 60 ? h * 60 + min : null
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatDays(days: number[]): string {
  if (!days.length) return 'no days'
  if (days.length === 7) return 'every day'
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(', ')
}

const UNIT_MS = { seconds: 1000, minutes: 60_000, hours: 3_600_000 } as const
export type DurationUnit = keyof typeof UNIT_MS
export const UNIT_OPTIONS = [
  { value: 'seconds', label: 'seconds' }, { value: 'minutes', label: 'minutes' }, { value: 'hours', label: 'hours' },
]
export const durationMs = (amount: number, unit: string) => amount * (UNIT_MS[unit as DurationUnit] ?? 60_000)
export const durationLabel = (amount: number, unit: string) => `${amount} ${amount === 1 ? unit.replace(/s$/, '') : unit}`

/** Replaces `{date}`, `{time}`, `{user}` … in user-written text. Unknown placeholders are left as typed. */
export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole)
}

export const VARIABLE_HINT = 'Placeholders: {greeting} {user} {date} {time} {weekday}'
