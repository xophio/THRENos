import { AppWindow, CalendarDays, FileSearch, Frame, Timer } from 'lucide-react'
import type { ConditionDef } from './types'
import { formatDays, isInHome, minutesOf, numList, resolvePath, str } from './config'
import { appWindows } from '../os/lifecycle'
import { getApp } from '../os/registry'
import { useWorkspaces } from '../store/workspaceStore'
import { appName, findWorkspace } from './actions'

/** Add a condition by appending one definition here; the editor and engine pick it up automatically. */
export const CONDITIONS: ConditionDef[] = [
  {
    type: 'app.isOpen', label: 'Application is open', icon: AppWindow,
    fields: [{ key: 'appId', label: 'Application', type: 'app' }],
    defaults: { appId: '' },
    summary: (c) => `${appName(str(c, 'appId'))} is open`,
    check: (c) => (getApp(str(c, 'appId')) ? null : 'Choose an installed application'),
    test: (c) => appWindows(str(c, 'appId')).length > 0,
  },
  {
    type: 'workspace.isActive', label: 'Workspace is active', icon: Frame,
    fields: [{ key: 'workspace', label: 'Workspace', type: 'workspace' }],
    defaults: { workspace: '' },
    summary: (c) => `workspace “${str(c, 'workspace')}” is active`,
    check: (c) => (str(c, 'workspace').trim() ? null : 'Enter a workspace name'),
    test: (c) => findWorkspace(str(c, 'workspace'))?.id === useWorkspaces.getState().activeId,
  },
  {
    type: 'file.exists', label: 'File exists', icon: FileSearch,
    fields: [{ key: 'path', label: 'Path', type: 'path', placeholder: '~/Documents/todo.md' }],
    defaults: { path: '' },
    summary: (c) => `${str(c, 'path')} exists`,
    check: (c) => {
      if (!str(c, 'path').trim()) return 'Enter a path'
      return isInHome(resolvePath(str(c, 'path'))) ? null : 'Path must be inside your home folder'
    },
    test: (c, ctx) => ctx.caps.fs.exists(resolvePath(str(c, 'path'))),
  },
  {
    type: 'time.range', label: 'Time is between', icon: Timer,
    fields: [{ key: 'from', label: 'From', type: 'time' }, { key: 'to', label: 'To', type: 'time' }],
    defaults: { from: '09:00', to: '17:00' },
    summary: (c) => `time is between ${str(c, 'from')} and ${str(c, 'to')}`,
    check: (c) => (minutesOf(str(c, 'from')) === null || minutesOf(str(c, 'to')) === null ? 'Enter both times as HH:MM' : null),
    test: (c) => {
      const from = minutesOf(str(c, 'from'))
      const to = minutesOf(str(c, 'to'))
      if (from === null || to === null) throw new Error('Time range is not valid')
      const now = new Date()
      const m = now.getHours() * 60 + now.getMinutes()
      // A range that ends before it starts crosses midnight (e.g. 22:00 – 06:00).
      return from <= to ? m >= from && m < to : m >= from || m < to
    },
  },
  {
    type: 'time.weekday', label: 'Day of the week is', icon: CalendarDays,
    fields: [{ key: 'days', label: 'Days', type: 'days' }],
    defaults: { days: [1, 2, 3, 4, 5] },
    summary: (c) => `today is ${formatDays(numList(c, 'days'))}`,
    check: (c) => (numList(c, 'days').length ? null : 'Choose at least one day'),
    test: (c) => numList(c, 'days').includes(new Date().getDay()),
  },
]

const byType = new Map(CONDITIONS.map((c) => [c.type, c]))
export const getCondition = (type: string) => byType.get(type)
