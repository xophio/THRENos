import { create } from 'zustand'
import type { AppId, Rect, SnapSide, WindowState } from '../types'
import { clamp, uid } from '../utils'
import { workArea } from '../utils/screen'
import { playSound } from '../utils/sound'
import { APPS } from '../apps/registry'

interface WindowStore {
  windows: WindowState[]
  focusedId: string | null
  topZ: number
  open: (appId: AppId, props?: Record<string, unknown>) => string
  close: (id: string) => void
  focus: (id: string) => void
  minimize: (id: string) => void
  toggleMaximize: (id: string) => void
  setRect: (id: string, rect: Partial<Rect>) => void
  snap: (id: string, side: SnapSide) => void
  setTitle: (id: string, title: string) => void
  cascade: () => void
  tile: () => void
  minimizeAll: () => void
  refit: () => void
}

const snapRect = (side: 'left' | 'right'): Rect => {
  const a = workArea()
  const half = a.w / 2
  return { x: side === 'left' ? a.x : a.x + half, y: a.y, w: half, h: a.h }
}

const rectOf = (w: WindowState): Rect => ({ x: w.x, y: w.y, w: w.w, h: w.h })

const patch = (list: WindowState[], id: string, p: Partial<WindowState>) =>
  list.map((w) => (w.id === id ? { ...w, ...p } : w))

const topVisible = (list: WindowState[]) =>
  [...list].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]

export const useWindows = create<WindowStore>((set, get) => ({
  windows: [],
  focusedId: null,
  topZ: 1,

  open: (appId, props) => {
    const app = APPS[appId]
    const existing = get().windows.find((w) => w.appId === appId)
    if (app.singleton && existing) {
      get().focus(existing.id)
      return existing.id
    }
    const d = workArea()
    const w = Math.min(app.defaultSize.w, d.w)
    const h = Math.min(app.defaultSize.h, d.h)
    const n = get().windows.length % 8
    const id = uid()
    const win: WindowState = {
      id, appId, title: app.name,
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
      const windows = s.windows.filter((w) => w.id !== id)
      return { windows, focusedId: s.focusedId === id ? (topVisible(windows)?.id ?? null) : s.focusedId }
    })
  },

  focus: (id) =>
    set((s) => ({
      windows: patch(s.windows, id, { z: s.topZ + 1, minimized: false }),
      focusedId: id,
      topZ: s.topZ + 1,
    })),

  minimize: (id) => {
    playSound('minimize')
    set((s) => {
      const windows = patch(s.windows, id, { minimized: true })
      return { windows, focusedId: s.focusedId === id ? (topVisible(windows)?.id ?? null) : s.focusedId }
    })
  },

  toggleMaximize: (id) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id)
      if (!w) return s
      if (w.maximized || w.snap) {
        const r = w.restore ?? rectOf(w)
        return { windows: patch(s.windows, id, { ...r, maximized: false, snap: null, restore: null }) }
      }
      return { windows: patch(s.windows, id, { maximized: true, restore: rectOf(w) }) }
    }),

  // Manual move/resize detaches the window from any snapped/maximized state.
  setRect: (id, rect) =>
    set((s) => ({ windows: patch(s.windows, id, { ...rect, maximized: false, snap: null, restore: null }) })),

  snap: (id, side) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id)
      if (!w || !side) return s
      const restore = w.restore ?? rectOf(w)
      if (side === 'top') return { windows: patch(s.windows, id, { maximized: true, snap: null, restore }) }
      return { windows: patch(s.windows, id, { ...snapRect(side), snap: side, maximized: false, restore }) }
    }),

  setTitle: (id, title) => set((s) => ({ windows: patch(s.windows, id, { title }) })),

  cascade: () =>
    set((s) => {
      const d = workArea()
      return {
        windows: s.windows.map((w, i) => ({
          ...w, x: d.x + 40 + (i % 8) * 32, y: d.y + 30 + (i % 8) * 32,
          maximized: false, snap: null, restore: null, minimized: false,
        })),
      }
    }),

  tile: () =>
    set((s) => {
      const vis = s.windows.filter((w) => !w.minimized)
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

  // Keep windows reachable after the screen or taskbar changes.
  refit: () =>
    set((s) => {
      const d = workArea()
      return {
        windows: s.windows.map((w) => {
          if (w.snap === 'left' || w.snap === 'right') return { ...w, ...snapRect(w.snap) }
          if (w.maximized) return w
          const width = Math.min(w.w, d.w)
          const height = Math.min(w.h, d.h)
          return {
            ...w, w: width, h: height,
            x: clamp(w.x, d.x, d.x + d.w - width),
            y: clamp(w.y, d.y, d.y + d.h - height),
          }
        }),
      }
    }),

  minimizeAll: () =>
    set((s) => ({ windows: s.windows.map((w) => ({ ...w, minimized: true })), focusedId: null })),
}))
