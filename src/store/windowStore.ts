import { create } from 'zustand'
import type { AppId, Rect, SnapRegion, WindowState } from '../types'
import { clamp, uid } from '../utils'
import { workArea } from '../utils/screen'
import { regionRect } from '../utils/snap'
import { playSound } from '../utils/sound'
import { getApp } from '../os/registry'
import { useWorkspaces } from './workspaceStore'

interface WindowStore {
  windows: WindowState[]
  focusedId: string | null
  topZ: number
  open: (appId: AppId, props?: Record<string, unknown>) => string
  close: (id: string) => void
  focus: (id: string) => void
  minimize: (id: string) => void
  toggleMaximize: (id: string) => void
  /** Moves or resizes a window. The result is always kept inside the work area. */
  setRect: (id: string, rect: Partial<Rect>) => void
  /** Tiles a window into a region. Snapping to the region it already occupies restores it. */
  snap: (id: string, region: SnapRegion) => void
  setTitle: (id: string, title: string) => void
  moveToWorkspace: (id: string, workspaceId: string) => void
  cascade: () => void
  tile: () => void
  minimizeAll: () => void
  restoreAll: () => void
  refit: () => void
  /** Replaces all windows (used when restoring a saved session). */
  hydrate: (windows: WindowState[]) => void
}

const Z_LIMIT = 5000

const rectOf = (w: WindowState): Rect => ({ x: w.x, y: w.y, w: w.w, h: w.h })

const patch = (list: WindowState[], id: string, p: Partial<WindowState>) =>
  list.map((w) => (w.id === id ? { ...w, ...p } : w))

const activeWorkspace = () => useWorkspaces.getState().activeId

/** The highest visible window on a workspace — the one that should receive focus next. */
export const topVisible = (list: WindowState[], workspaceId: string) =>
  [...list].filter((w) => w.workspaceId === workspaceId && !w.minimized).sort((a, b) => b.z - a.z)[0]

/** Windows on a workspace, in stacking order from back to front. */
export const windowsIn = (list: WindowState[], workspaceId: string) =>
  list.filter((w) => w.workspaceId === workspaceId).sort((a, b) => a.z - b.z)

/** Keeps a rectangle inside the work area, shrinking it if it is larger than the area. */
function fit(r: Rect, a: Rect): Rect {
  const w = Math.min(r.w, a.w)
  const h = Math.min(r.h, a.h)
  return { x: clamp(r.x, a.x, a.x + a.w - w), y: clamp(r.y, a.y, a.y + a.h - h), w, h }
}

export const useWindows = create<WindowStore>((set, get) => ({
  windows: [],
  focusedId: null,
  topZ: 1,

  open: (appId, props) => {
    const app = getApp(appId)
    if (!app) return ''
    const existing = get().windows.find((w) => w.appId === appId)
    if (app.launch.singleton && existing) {
      get().focus(existing.id)
      return existing.id
    }
    const d = workArea()
    const w = Math.min(app.launch.defaultSize.w, d.w)
    const h = Math.min(app.launch.defaultSize.h, d.h)
    const n = get().windows.filter((x) => x.workspaceId === activeWorkspace()).length % 8
    const id = uid()
    const win: WindowState = {
      id, appId, title: app.name, workspaceId: activeWorkspace(),
      x: clamp(d.x + 140 + n * 32, d.x, d.x + Math.max(0, d.w - w)),
      y: clamp(d.y + 40 + n * 32, d.y, d.y + Math.max(0, d.h - h)),
      w, h, z: get().topZ + 1, minimized: false,
      maximized: d.w < 700, snap: null, restore: null, props,
    }
    set((s) => ({ windows: [...s.windows, win], focusedId: id, topZ: s.topZ + 1 }))
    playSound('open')
    return id
  },

  close: (id) => {
    playSound('close')
    set((s) => {
      const closing = s.windows.find((w) => w.id === id)
      const windows = s.windows.filter((w) => w.id !== id)
      if (!closing || s.focusedId !== id) return { windows }
      return { windows, focusedId: topVisible(windows, closing.workspaceId)?.id ?? null }
    })
  },

  focus: (id) => {
    const win = get().windows.find((w) => w.id === id)
    if (!win) return
    // Focusing a window on another workspace takes you there.
    if (win.workspaceId !== activeWorkspace()) useWorkspaces.getState().setActive(win.workspaceId)
    set((s) => {
      const windows = patch(s.windows, id, { z: s.topZ + 1, minimized: false })
      if (s.topZ + 1 < Z_LIMIT) return { windows, focusedId: id, topZ: s.topZ + 1 }
      // Renumber from 1 in stacking order so z-indexes stay far below the taskbar and menus.
      const ordered = [...windows].sort((a, b) => a.z - b.z).map((w, i) => [w.id, i + 1] as const)
      const z = new Map(ordered)
      return { windows: windows.map((w) => ({ ...w, z: z.get(w.id)! })), focusedId: id, topZ: windows.length }
    })
  },

  minimize: (id) => {
    playSound('minimize')
    set((s) => {
      const win = s.windows.find((w) => w.id === id)
      if (!win) return s
      const windows = patch(s.windows, id, { minimized: true })
      return { windows, focusedId: s.focusedId === id ? (topVisible(windows, win.workspaceId)?.id ?? null) : s.focusedId }
    })
  },

  toggleMaximize: (id) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id)
      if (!w) return s
      if (w.maximized || w.snap) {
        const r = fit(w.restore ?? rectOf(w), workArea())
        return { windows: patch(s.windows, id, { ...r, maximized: false, snap: null, restore: null }) }
      }
      return { windows: patch(s.windows, id, { maximized: true, restore: rectOf(w) }) }
    }),

  // Manual move/resize detaches the window from any snapped/maximized state.
  setRect: (id, rect) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id)
      if (!w) return s
      const next = fit({ ...rectOf(w), ...rect }, workArea())
      return { windows: patch(s.windows, id, { ...next, maximized: false, snap: null, restore: null }) }
    }),

  snap: (id, region) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id)
      if (!w) return s
      const tiled = w.maximized || w.snap
      const same = region === 'maximize' ? w.maximized : w.snap === region
      if (same) {
        const r = fit(w.restore ?? rectOf(w), workArea())
        return { windows: patch(s.windows, id, { ...r, maximized: false, snap: null, restore: null }) }
      }
      const restore = tiled ? w.restore : rectOf(w)
      if (region === 'maximize') return { windows: patch(s.windows, id, { maximized: true, snap: null, restore }) }
      return {
        windows: patch(s.windows, id, { ...regionRect(region, workArea()), snap: region, maximized: false, restore }),
      }
    }),

  setTitle: (id, title) => set((s) => ({ windows: patch(s.windows, id, { title }) })),

  moveToWorkspace: (id, workspaceId) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id)
      if (!w || w.workspaceId === workspaceId || !useWorkspaces.getState().workspaces.some((x) => x.id === workspaceId)) return s
      const windows = patch(s.windows, id, { workspaceId })
      // Moving the focused window off the current workspace hands focus to what is left behind.
      const focusedId = s.focusedId === id && workspaceId !== activeWorkspace()
        ? (topVisible(windows, activeWorkspace())?.id ?? null)
        : s.focusedId
      return { windows, focusedId }
    }),

  cascade: () =>
    set((s) => {
      const d = workArea()
      let i = 0
      return {
        windows: s.windows.map((w) => {
          if (w.workspaceId !== activeWorkspace()) return w
          const n = i++ % 8
          return {
            ...w, ...fit({ x: d.x + 40 + n * 32, y: d.y + 30 + n * 32, w: w.restore?.w ?? w.w, h: w.restore?.h ?? w.h }, d),
            maximized: false, snap: null, restore: null, minimized: false,
          }
        }),
      }
    }),

  tile: () =>
    set((s) => {
      const vis = s.windows.filter((w) => w.workspaceId === activeWorkspace() && !w.minimized)
      if (!vis.length) return s
      const d = workArea()
      const cols = Math.ceil(Math.sqrt(vis.length))
      const rows = Math.ceil(vis.length / cols)
      const cw = d.w / cols
      const ch = d.h / rows
      return {
        windows: s.windows.map((w) => {
          const i = vis.findIndex((v) => v.id === w.id)
          if (i < 0) return w
          return {
            ...w, x: d.x + (i % cols) * cw, y: d.y + Math.floor(i / cols) * ch, w: cw, h: ch,
            maximized: false, snap: null, restore: null,
          }
        }),
      }
    }),

  minimizeAll: () =>
    set((s) => {
      const ws = activeWorkspace()
      return {
        windows: s.windows.map((w) => (w.workspaceId === ws ? { ...w, minimized: true } : w)),
        focusedId: null,
      }
    }),

  restoreAll: () =>
    set((s) => {
      const ws = activeWorkspace()
      const windows = s.windows.map((w) => (w.workspaceId === ws ? { ...w, minimized: false } : w))
      return { windows, focusedId: s.focusedId ?? topVisible(windows, ws)?.id ?? null }
    }),

  // Keep windows reachable after the screen or taskbar changes.
  refit: () =>
    set((s) => {
      const d = workArea()
      return {
        windows: s.windows.map((w) => {
          if (w.snap) return { ...w, ...regionRect(w.snap, d) }
          if (w.maximized) return w
          return { ...w, ...fit(rectOf(w), d) }
        }),
      }
    }),

  hydrate: (windows) =>
    set({
      windows,
      topZ: windows.reduce((m, w) => Math.max(m, w.z), 1),
      focusedId: topVisible(windows, activeWorkspace())?.id ?? null,
    }),
}))

// Switching workspaces hands focus to the top window of the workspace being shown.
useWorkspaces.subscribe((state, prev) => {
  if (state.activeId === prev.activeId) return
  const { windows } = useWindows.getState()
  useWindows.setState({ focusedId: topVisible(windows, state.activeId)?.id ?? null })
})
