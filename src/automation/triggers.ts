import { AppWindow, CalendarClock, Frame, Hourglass, Lock, LogIn, Play, Power, Repeat, Unlock, X } from 'lucide-react'
import type { Config, TriggerDef } from './types'
import { UNIT_OPTIONS, durationLabel, durationMs, formatDays, minutesOf, num, numList, str } from './config'
import { appName } from './actions'

/** Today's scheduled moment for "HH:MM", or null when the time is malformed. */
function scheduledToday(time: string, now: Date): number | null {
  const m = minutesOf(time)
  if (m === null) return null
  const d = new Date(now)
  d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return d.getTime()
}

/**
 * Fires once the scheduled moment has passed, for up to two minutes afterwards, so a briefly throttled
 * background tab still runs it. Moments missed while THRENos was closed are skipped, never replayed.
 */
function dailyDue(time: string, now: Date, lastFired: number | null): boolean {
  const at = scheduledToday(time, now)
  if (at === null) return false
  const t = now.getTime()
  return t >= at && t - at < 120_000 && (lastFired === null || lastFired < at)
}

const timeCheck = (c: Config) => (minutesOf(str(c, 'time')) === null ? 'Enter a time as HH:MM' : null)

/** Add a trigger by appending one definition here. Event triggers are delivered by `events.ts`. */
export const TRIGGERS: TriggerDef[] = [
  {
    type: 'manual', label: 'Manual', group: 'Manual', icon: Play,
    fields: [], defaults: {}, summary: () => 'Run manually',
  },
  {
    type: 'time.daily', label: 'Every day at', group: 'Time', icon: CalendarClock,
    fields: [{ key: 'time', label: 'Time', type: 'time' }],
    defaults: { time: '08:00' },
    summary: (c) => `Daily at ${str(c, 'time')}`,
    check: timeCheck,
    due: (c, s) => dailyDue(str(c, 'time'), s.now, s.lastFired),
  },
  {
    type: 'time.weekly', label: 'Weekly on', group: 'Time', icon: CalendarClock,
    fields: [{ key: 'days', label: 'Days', type: 'days' }, { key: 'time', label: 'Time', type: 'time' }],
    defaults: { days: [1, 2, 3, 4, 5], time: '09:00' },
    summary: (c) => `${formatDays(numList(c, 'days'))} at ${str(c, 'time')}`,
    check: (c) => (numList(c, 'days').length ? timeCheck(c) : 'Choose at least one day'),
    due: (c, s) => numList(c, 'days').includes(s.now.getDay()) && dailyDue(str(c, 'time'), s.now, s.lastFired),
  },
  {
    type: 'time.interval', label: 'Repeat every', group: 'Time', icon: Repeat,
    fields: [
      { key: 'every', label: 'Every', type: 'number', min: 1, max: 999 },
      { key: 'unit', label: 'Unit', type: 'select', options: UNIT_OPTIONS },
    ],
    defaults: { every: 30, unit: 'minutes' },
    summary: (c) => `Every ${durationLabel(num(c, 'every', 1), str(c, 'unit'))}`,
    check: (c) => (durationMs(num(c, 'every'), str(c, 'unit')) >= 10_000 ? null : 'The shortest interval is 10 seconds'),
    due: (c, s) => s.now.getTime() - (s.lastFired ?? s.base) >= durationMs(num(c, 'every'), str(c, 'unit')),
  },
  {
    type: 'time.delay', label: 'After a delay', group: 'Time', icon: Hourglass,
    fields: [
      { key: 'after', label: 'After', type: 'number', min: 1, max: 999 },
      { key: 'unit', label: 'Unit', type: 'select', options: UNIT_OPTIONS },
    ],
    defaults: { after: 5, unit: 'minutes' },
    summary: (c) => `${durationLabel(num(c, 'after', 1), str(c, 'unit'))} after you sign in or turn it on`,
    check: (c) => (durationMs(num(c, 'after'), str(c, 'unit')) >= 1000 ? null : 'Enter a delay'),
    due: (c, s) => s.lastFired === null && s.now.getTime() - s.base >= durationMs(num(c, 'after'), str(c, 'unit')),
  },
  {
    type: 'system.startup', label: 'THRENos starts', group: 'Applications', icon: Power,
    fields: [], defaults: {}, summary: () => 'When THRENos starts',
  },
  {
    type: 'app.launched', label: 'An application opens', group: 'Applications', icon: AppWindow,
    fields: [{ key: 'appId', label: 'Application', type: 'app', any: true }],
    defaults: { appId: '' },
    summary: (c) => `When ${str(c, 'appId') ? appName(str(c, 'appId')) : 'any application'} opens`,
    matches: (c, d) => !str(c, 'appId') || str(c, 'appId') === d.appId,
  },
  {
    type: 'app.closed', label: 'An application closes', group: 'Applications', icon: X,
    fields: [{ key: 'appId', label: 'Application', type: 'app', any: true }],
    defaults: { appId: '' },
    summary: (c) => `When ${str(c, 'appId') ? appName(str(c, 'appId')) : 'any application'} closes`,
    matches: (c, d) => !str(c, 'appId') || str(c, 'appId') === d.appId,
  },
  {
    type: 'workspace.activated', label: 'A workspace is activated', group: 'Applications', icon: Frame,
    fields: [{ key: 'workspace', label: 'Workspace', type: 'workspace', any: true }],
    defaults: { workspace: '' },
    summary: (c) => `When ${str(c, 'workspace') ? `“${str(c, 'workspace')}”` : 'any workspace'} is activated`,
    matches: (c, d) => {
      const want = str(c, 'workspace').trim().toLowerCase()
      return !want || want === d.workspaceName.toLowerCase() || str(c, 'workspace') === d.workspaceId
    },
  },
  {
    type: 'user.login', label: 'You sign in', group: 'User', icon: LogIn,
    fields: [], defaults: {}, summary: () => 'When you sign in',
  },
  {
    type: 'user.lock', label: 'You lock THRENos', group: 'User', icon: Lock,
    fields: [], defaults: {}, summary: () => 'When you lock THRENos',
  },
  {
    type: 'user.unlock', label: 'You unlock THRENos', group: 'User', icon: Unlock,
    fields: [], defaults: {}, summary: () => 'When you unlock THRENos',
  },
]

const byType = new Map(TRIGGERS.map((t) => [t.type, t]))
export const getTrigger = (type: string) => byType.get(type)
export const TRIGGER_GROUPS = ['Manual', 'Time', 'Applications', 'User'] as const
