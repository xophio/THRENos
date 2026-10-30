import {
  AppWindow, BellRing, Clock3, Copy, FilePlus, FolderInput, FolderPlus, FolderTree, Frame, Image, LayoutGrid,
  Layers, Maximize2, Minimize2, Moon, PenLine, Pencil, Plus, StickyNote, Target, X,
} from 'lucide-react'
import type { ActionDef, Config, RunContext } from './types'
import { interpolate, isInHome, num, resolvePath, str, strList, VARIABLE_HINT } from './config'
import { getApp } from '../os/registry'
import { launchApp, appWindows, closeAppWindows } from '../os/lifecycle'
import { useWindows } from '../store/windowStore'
import { useWorkspaces } from '../store/workspaceStore'
import { createWorkspace, renameWorkspace, switchWorkspace } from '../store/workspaceActions'
import { useSettings } from '../store/settingsStore'
import { useNotes } from '../store/notesStore'
import { useFs } from '../store/fsStore'
import { useFocus } from '../store/focusStore'
import { useCustomWallpapers, customWallpaperId } from '../store/wallpaperStore'
import { WALLPAPERS } from '../theme/wallpapers'
import { baseName, joinPath, parentOf } from '../utils/path'

// ---- helpers ----

export function findWorkspace(nameOrId: string) {
  const key = nameOrId.trim().toLowerCase()
  if (!key) return undefined
  return useWorkspaces.getState().workspaces.find((w) => w.id === nameOrId || w.name.toLowerCase() === key)
}

export function appName(id: string): string {
  return getApp(id)?.name ?? id
}

const needApp = (c: Config, key = 'appId') => {
  const id = str(c, key)
  if (!id) return 'Choose an application'
  return getApp(id) ? null : `${id} is not installed`
}

const needPath = (path: string, label: string): string | null => {
  if (!path.trim()) return `${label} is required`
  return isInHome(resolvePath(path)) ? null : `${label} must be inside your home folder`
}

/** Opens an app in the active workspace, reusing a window that is already open when asked to. */
function bringApp(appId: string, reuse: boolean) {
  const app = getApp(appId)
  if (!app) throw new Error(`${appId} is not installed`)
  const store = useWindows.getState()
  const active = useWorkspaces.getState().activeId
  const existing = appWindows(appId)
  if (reuse && existing.length) {
    const target = existing.find((w) => w.workspaceId === active) ?? existing[0]
    if (target.workspaceId !== active) store.moveToWorkspace(target.id, active)
    store.focus(target.id)
    return
  }
  if (app.launch.singleton && existing.length) {
    const target = existing[0]
    if (target.workspaceId !== active) store.moveToWorkspace(target.id, active)
    store.focus(target.id)
    return
  }
  launchApp(appId)
}

function ensureFolder(ctx: RunContext, path: string) {
  if (ctx.caps.fs.exists(path)) {
    if (!useFs.getState().isDir(path)) throw new Error(`${path} exists and is not a folder`)
    return
  }
  const parent = parentOf(path)
  if (!isInHome(parent)) throw new Error('Outside your home folder')
  if (!ctx.caps.fs.exists(parent)) ensureFolder(ctx, parent)
  const err = ctx.caps.fs.mkdir(path)
  if (err) throw new Error(`Could not create ${path}: ${err}`)
}

const fsError = (err: string | null, what: string) => {
  if (err) throw new Error(`${what}: ${err}`)
}

// ---- file organizer rules ----

export interface OrganizeRule { match: (name: string) => boolean; destination: string; text: string }

/** One rule per line: `txt, md -> ~/Documents/Text` or `contains:invoice -> ~/Documents/Invoices`. */
export function parseRules(source: string): { rules: OrganizeRule[]; error: string | null } {
  const rules: OrganizeRule[] = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split('->')
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return { rules: [], error: `Line ${i + 1}: write rules as "txt, md -> ~/Folder"` }
    const destination = resolvePath(parts[1])
    if (!isInHome(destination)) return { rules: [], error: `Line ${i + 1}: destination must be inside your home folder` }
    const left = parts[0].trim().toLowerCase()
    if (left.startsWith('contains:')) {
      const word = left.slice(9).trim()
      if (!word) return { rules: [], error: `Line ${i + 1}: contains: needs a word` }
      rules.push({ match: (n) => n.toLowerCase().includes(word), destination, text: line })
    } else {
      const exts = left.split(',').map((e) => e.trim().replace(/^\./, '')).filter(Boolean)
      if (!exts.length) return { rules: [], error: `Line ${i + 1}: no file extensions given` }
      rules.push({ match: (n) => exts.includes(n.includes('.') ? n.split('.').pop()!.toLowerCase() : ''), destination, text: line })
    }
  }
  return { rules, error: rules.length ? null : 'Add at least one rule' }
}

// ---- definitions ----

const appField = { key: 'appId', label: 'Application', type: 'app' as const }
const wsField = { key: 'workspace', label: 'Workspace', type: 'workspace' as const, hint: 'Name of a workspace' }

export const ACTIONS: ActionDef[] = [
  // Applications
  {
    type: 'app.open', label: 'Open application', group: 'Applications', icon: AppWindow,
    fields: [appField, { key: 'reuse', label: 'If already open', type: 'select', options: [{ value: 'focus', label: 'Bring it forward' }, { value: 'new', label: 'Open another window' }] }],
    defaults: { appId: '', reuse: 'focus' },
    summary: (c) => `Open ${appName(str(c, 'appId'))}`,
    check: (c) => needApp(c),
    run: (c) => { bringApp(str(c, 'appId'), str(c, 'reuse') !== 'new') },
  },
  {
    type: 'apps.openMany', label: 'Open several applications', group: 'Applications', icon: Layers,
    fields: [{ key: 'appIds', label: 'Applications', type: 'apps' }],
    defaults: { appIds: [] },
    summary: (c) => `Open ${strList(c, 'appIds').map(appName).join(', ') || 'applications'}`,
    check: (c) => {
      const ids = strList(c, 'appIds')
      if (!ids.length) return 'Choose at least one application'
      const missing = ids.filter((id) => !getApp(id))
      return missing.length ? `Not installed: ${missing.join(', ')}` : null
    },
    run: (c) => { for (const id of strList(c, 'appIds')) bringApp(id, true) },
  },
  {
    type: 'app.close', label: 'Close application', group: 'Applications', icon: X, risk: 'closes',
    fields: [appField], defaults: { appId: '' },
    summary: (c) => `Close ${appName(str(c, 'appId'))} (unsaved work in it is lost)`,
    check: (c) => needApp(c),
    run: (c) => {
      const id = str(c, 'appId')
      if (!appWindows(id).length) return `${appName(id)} is not open`
      closeAppWindows(id)
    },
  },
  {
    type: 'app.minimize', label: 'Minimize application', group: 'Applications', icon: Minimize2,
    fields: [appField], defaults: { appId: '' },
    summary: (c) => `Minimize ${appName(str(c, 'appId'))}`,
    check: (c) => needApp(c),
    run: (c) => {
      const id = str(c, 'appId')
      const wins = appWindows(id)
      if (!wins.length) throw new Error(`${appName(id)} is not open`)
      for (const w of wins) useWindows.getState().minimize(w.id)
    },
  },
  {
    type: 'app.maximize', label: 'Maximize application', group: 'Applications', icon: Maximize2,
    fields: [appField], defaults: { appId: '' },
    summary: (c) => `Maximize ${appName(str(c, 'appId'))}`,
    check: (c) => needApp(c),
    run: (c) => {
      const id = str(c, 'appId')
      const win = appWindows(id)[0]
      if (!win) throw new Error(`${appName(id)} is not open`)
      const store = useWindows.getState()
      store.focus(win.id)
      if (!win.maximized) store.toggleMaximize(win.id)
    },
  },

  // Workspaces
  {
    type: 'workspace.switch', label: 'Switch workspace', group: 'Workspaces', icon: Frame,
    fields: [wsField, { key: 'create', label: 'If it does not exist', type: 'select', options: [{ value: 'fail', label: 'Fail' }, { value: 'create', label: 'Create it' }] }],
    defaults: { workspace: '', create: 'create' },
    summary: (c) => `Switch to workspace “${str(c, 'workspace')}”`,
    check: (c) => (str(c, 'workspace').trim() ? null : 'Enter a workspace name'),
    run: (c) => {
      let ws = findWorkspace(str(c, 'workspace'))
      if (!ws && str(c, 'create') === 'create') {
        const id = createWorkspace(str(c, 'workspace'))
        if (!id) throw new Error('Workspace limit reached')
        ws = findWorkspace(id)
      }
      if (!ws) throw new Error(`No workspace named “${str(c, 'workspace')}”`)
      switchWorkspace(ws.id)
    },
  },
  {
    type: 'workspace.create', label: 'Create workspace', group: 'Workspaces', icon: Plus,
    fields: [{ key: 'name', label: 'Name', type: 'text', placeholder: 'Focus' }],
    defaults: { name: '' },
    summary: (c) => `Create workspace “${str(c, 'name')}”`,
    check: (c) => (str(c, 'name').trim() ? null : 'Enter a workspace name'),
    run: (c) => {
      if (findWorkspace(str(c, 'name'))) return 'Already exists'
      if (!createWorkspace(str(c, 'name'))) throw new Error('Workspace limit reached')
    },
  },
  {
    type: 'workspace.rename', label: 'Rename workspace', group: 'Workspaces', icon: PenLine,
    fields: [wsField, { key: 'newName', label: 'New name', type: 'text' }],
    defaults: { workspace: '', newName: '' },
    summary: (c) => `Rename workspace “${str(c, 'workspace')}” to “${str(c, 'newName')}”`,
    check: (c) => (!str(c, 'workspace').trim() || !str(c, 'newName').trim() ? 'Enter the current and new names' : null),
    run: (c) => {
      const ws = findWorkspace(str(c, 'workspace'))
      if (!ws) throw new Error(`No workspace named “${str(c, 'workspace')}”`)
      renameWorkspace(ws.id, str(c, 'newName'))
    },
  },

  // Files
  {
    type: 'fs.mkdir', label: 'Create folder', group: 'Files', icon: FolderPlus,
    fields: [{ key: 'path', label: 'Folder', type: 'path', placeholder: '~/Documents/Projects' }],
    defaults: { path: '' },
    summary: (c) => `Create folder ${str(c, 'path')}`,
    check: (c) => needPath(str(c, 'path'), 'Folder'),
    run: (c, ctx) => {
      const path = resolvePath(str(c, 'path'))
      if (ctx.caps.fs.exists(path)) return 'Already exists'
      fsError(ctx.caps.fs.mkdir(path), `Could not create ${path}`)
    },
  },
  {
    type: 'fs.createFile', label: 'Create file', group: 'Files', icon: FilePlus,
    fields: [
      { key: 'path', label: 'File', type: 'path', placeholder: '~/Documents/log.txt' },
      { key: 'content', label: 'Content', type: 'textarea', hint: VARIABLE_HINT },
    ],
    defaults: { path: '', content: '' },
    summary: (c) => `Create file ${str(c, 'path')}`,
    check: (c) => needPath(str(c, 'path'), 'File'),
    run: (c, ctx) => {
      const path = resolvePath(str(c, 'path'))
      if (ctx.caps.fs.exists(path)) throw new Error(`${path} already exists; it is never overwritten`)
      fsError(ctx.caps.fs.write(path, interpolate(str(c, 'content'), ctx.vars)), `Could not create ${path}`)
    },
  },
  {
    type: 'fs.move', label: 'Move file', group: 'Files', icon: FolderInput, risk: 'modifies',
    fields: [
      { key: 'from', label: 'File or folder', type: 'path', placeholder: '~/Downloads/report.pdf' },
      { key: 'to', label: 'Into folder', type: 'path', placeholder: '~/Documents' },
    ],
    defaults: { from: '', to: '' },
    summary: (c) => `Move ${str(c, 'from')} into ${str(c, 'to')}`,
    check: (c) => needPath(str(c, 'from'), 'File') ?? needPath(str(c, 'to'), 'Destination folder'),
    run: (c, ctx) => {
      const from = resolvePath(str(c, 'from'))
      const dir = resolvePath(str(c, 'to'))
      if (!ctx.caps.fs.exists(from)) throw new Error(`${from} does not exist`)
      if (!useFs.getState().isDir(dir)) throw new Error(`${dir} is not an existing folder`)
      fsError(ctx.caps.fs.rename(from, joinPath(dir, baseName(from))), `Could not move ${baseName(from)}`)
    },
  },
  {
    type: 'fs.copy', label: 'Copy file', group: 'Files', icon: Copy,
    fields: [
      { key: 'from', label: 'File or folder', type: 'path' },
      { key: 'to', label: 'Into folder', type: 'path' },
    ],
    defaults: { from: '', to: '' },
    summary: (c) => `Copy ${str(c, 'from')} into ${str(c, 'to')}`,
    check: (c) => needPath(str(c, 'from'), 'File') ?? needPath(str(c, 'to'), 'Destination folder'),
    run: (c, ctx) => {
      const from = resolvePath(str(c, 'from'))
      const dir = resolvePath(str(c, 'to'))
      if (!ctx.caps.fs.exists(from)) throw new Error(`${from} does not exist`)
      if (!useFs.getState().isDir(dir)) throw new Error(`${dir} is not an existing folder`)
      fsError(ctx.caps.fs.copy(from, joinPath(dir, baseName(from))), `Could not copy ${baseName(from)}`)
    },
  },
  {
    type: 'fs.rename', label: 'Rename file', group: 'Files', icon: Pencil, risk: 'modifies',
    fields: [
      { key: 'path', label: 'File or folder', type: 'path' },
      { key: 'newName', label: 'New name', type: 'text' },
    ],
    defaults: { path: '', newName: '' },
    summary: (c) => `Rename ${str(c, 'path')} to ${str(c, 'newName')}`,
    check: (c) => {
      const name = str(c, 'newName').trim()
      if (!name || name.includes('/')) return 'Enter a new name without slashes'
      return needPath(str(c, 'path'), 'File')
    },
    run: (c, ctx) => {
      const from = resolvePath(str(c, 'path'))
      if (!ctx.caps.fs.exists(from)) throw new Error(`${from} does not exist`)
      fsError(ctx.caps.fs.rename(from, joinPath(parentOf(from), str(c, 'newName').trim())), `Could not rename ${baseName(from)}`)
    },
  },
  {
    type: 'fs.organize', label: 'Organize folder by rules', group: 'Files', icon: FolderTree, risk: 'modifies',
    fields: [
      { key: 'source', label: 'Folder to organize', type: 'path', placeholder: '~/Downloads' },
      {
        key: 'rules', label: 'Rules', type: 'textarea', placeholder: 'txt, md -> ~/Documents/Text',
        hint: 'One per line: “ext, ext -> folder” or “contains:word -> folder”. Files matching no rule are left alone.',
      },
    ],
    defaults: { source: '', rules: '' },
    summary: (c) => `Move files in ${str(c, 'source')} into folders by ${str(c, 'rules').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length} rule(s)`,
    check: (c) => needPath(str(c, 'source'), 'Folder') ?? parseRules(str(c, 'rules')).error,
    run: (c, ctx) => {
      const source = resolvePath(str(c, 'source'))
      if (!useFs.getState().isDir(source)) throw new Error(`${source} is not an existing folder`)
      const { rules, error } = parseRules(str(c, 'rules'))
      if (error) throw new Error(error)
      let moved = 0
      const failed: string[] = []
      for (const entry of useFs.getState().list(source)) {
        if (entry.type !== 'file') continue
        const rule = rules.find((r) => r.match(entry.name))
        if (!rule) continue
        try {
          ensureFolder(ctx, rule.destination)
          const err = ctx.caps.fs.rename(entry.path, joinPath(rule.destination, entry.name))
          if (err) failed.push(`${entry.name} (${err})`)
          else moved++
        } catch (e) {
          failed.push(`${entry.name} (${e instanceof Error ? e.message : 'error'})`)
        }
      }
      if (failed.length) throw new Error(`Moved ${moved}; could not move ${failed.join(', ')}`)
      return moved ? `Moved ${moved} file(s)` : 'Nothing matched the rules'
    },
  },

  // Notifications
  {
    type: 'notify', label: 'Show notification', group: 'Notifications', icon: BellRing,
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: '{greeting}, {user}', hint: VARIABLE_HINT },
      { key: 'body', label: 'Message', type: 'textarea', placeholder: 'Today is {date}.' },
    ],
    defaults: { title: '', body: '' },
    summary: (c) => `Notify “${str(c, 'title')}”`,
    check: (c) => (str(c, 'title').trim() ? null : 'Enter a title'),
    run: (c, ctx) => {
      const shown = ctx.caps.notify(interpolate(str(c, 'title'), ctx.vars), interpolate(str(c, 'body'), ctx.vars) || undefined)
      if (!shown) throw new Error('The Notifications permission is off for Automations (Settings → Apps)')
    },
  },

  // Productivity
  {
    type: 'note.create', label: 'Create note', group: 'Productivity', icon: StickyNote,
    fields: [
      { key: 'title', label: 'Title', type: 'text', hint: VARIABLE_HINT },
      { key: 'body', label: 'Text', type: 'textarea' },
    ],
    defaults: { title: 'Untitled', body: '' },
    summary: (c) => `Create note “${str(c, 'title')}”`,
    check: (c) => (str(c, 'title').trim() ? null : 'Enter a title'),
    run: (c, ctx) => {
      if (!getApp('notes')) throw new Error('Notes is not installed')
      const id = useNotes.getState().create()
      useNotes.getState().update(id, { title: interpolate(str(c, 'title'), ctx.vars), body: interpolate(str(c, 'body'), ctx.vars) })
    },
  },
  {
    type: 'focus.start', label: 'Start focus session', group: 'Productivity', icon: Target,
    fields: [
      { key: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 240 },
      { key: 'label', label: 'Label', type: 'text', placeholder: 'Deep work' },
    ],
    defaults: { minutes: 25, label: 'Focus' },
    summary: (c) => `Start a ${num(c, 'minutes', 25)}-minute focus session`,
    check: (c) => (num(c, 'minutes') >= 1 && num(c, 'minutes') <= 240 ? null : 'Minutes must be between 1 and 240'),
    run: (c) => { useFocus.getState().start(num(c, 'minutes', 25), str(c, 'label') || 'Focus') },
  },

  // Desktop
  {
    type: 'desktop.wallpaper', label: 'Change wallpaper', group: 'Desktop', icon: Image,
    fields: [{ key: 'wallpaper', label: 'Wallpaper', type: 'wallpaper' }],
    defaults: { wallpaper: 'signal' },
    summary: (c) => `Set wallpaper to ${wallpaperLabel(str(c, 'wallpaper'))}`,
    check: (c) => (wallpaperExists(str(c, 'wallpaper')) ? null : 'That wallpaper no longer exists'),
    run: (c) => { useSettings.getState().set({ wallpaper: str(c, 'wallpaper') }) },
  },
  {
    type: 'desktop.theme', label: 'Change theme', group: 'Desktop', icon: Moon,
    fields: [{ key: 'theme', label: 'Theme', type: 'select', options: [{ value: 'light', label: 'Paper (light)' }, { value: 'dark', label: 'Charcoal (dark)' }, { value: 'system', label: 'Follow system' }] }],
    defaults: { theme: 'dark' },
    summary: (c) => `Switch theme to ${str(c, 'theme')}`,
    run: (c) => {
      const theme = str(c, 'theme')
      if (theme !== 'light' && theme !== 'dark' && theme !== 'system') throw new Error('Unknown theme')
      useSettings.getState().set({ theme })
    },
  },
  {
    type: 'desktop.layout', label: 'Activate desktop layout', group: 'Desktop', icon: LayoutGrid,
    fields: [{
      key: 'layout', label: 'Layout', type: 'select',
      options: [
        { value: 'tile', label: 'Tile windows' }, { value: 'cascade', label: 'Cascade windows' },
        { value: 'minimizeAll', label: 'Minimize all' }, { value: 'restoreAll', label: 'Restore all' },
      ],
    }],
    defaults: { layout: 'tile' },
    summary: (c) => `Layout: ${str(c, 'layout')}`,
    run: (c) => {
      const w = useWindows.getState()
      const layout = str(c, 'layout')
      if (layout === 'tile') w.tile()
      else if (layout === 'cascade') w.cascade()
      else if (layout === 'minimizeAll') w.minimizeAll()
      else if (layout === 'restoreAll') w.restoreAll()
      else throw new Error('Unknown layout')
    },
  },

  // Flow
  {
    type: 'flow.wait', label: 'Wait', group: 'Flow', icon: Clock3,
    fields: [{ key: 'seconds', label: 'Seconds', type: 'number', min: 1, max: 60 }],
    defaults: { seconds: 3 },
    summary: (c) => `Wait ${num(c, 'seconds', 1)} s`,
    check: (c) => (num(c, 'seconds') >= 1 && num(c, 'seconds') <= 60 ? null : 'Seconds must be between 1 and 60'),
    run: (c, ctx) => ctx.sleep(num(c, 'seconds', 1) * 1000),
  },
]

export function wallpaperExists(id: string): boolean {
  if (WALLPAPERS.some((w) => w.id === id)) return true
  return useCustomWallpapers.getState().images.some((i) => customWallpaperId(i.id) === id)
}

export function wallpaperLabel(id: string): string {
  const builtin = WALLPAPERS.find((w) => w.id === id)
  if (builtin) return builtin.name
  return useCustomWallpapers.getState().images.find((i) => customWallpaperId(i.id) === id)?.name ?? id
}
