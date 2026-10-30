import { create } from 'zustand'
import type { CSSProperties } from 'react'
import { RESOLUTIONS, useSettings } from '../store/settingsStore'
import type { TaskbarPosition } from '../store/settingsStore'
import type { Rect } from '../types'

export const TASKBAR_SIZE = 52

/**
 * The OS renders on a virtual screen of `w`×`h` logical pixels, shown at CSS scale `k`
 * and positioned at (`left`, `top`) inside the browser window. All window, icon and popup
 * coordinates live in logical pixels.
 */
export interface ScreenMetrics { w: number; h: number; k: number; left: number; top: number }

export function computeScreen(): ScreenMetrics {
  const { resolution, scale } = useSettings.getState()
  const iw = window.innerWidth
  const ih = window.innerHeight
  const s = scale / 100
  const res = RESOLUTIONS.find((r) => r.id === resolution)
  if (!res || res.id === 'auto') return { w: iw / s, h: ih / s, k: s, left: 0, top: 0 }
  const fit = Math.min(iw / res.w, ih / res.h)
  return {
    w: res.w / s,
    h: res.h / s,
    k: s * fit,
    left: (iw - res.w * fit) / 2,
    top: (ih - res.h * fit) / 2,
  }
}

export const useScreen = create<ScreenMetrics>(() => computeScreen())

export const refreshScreen = () => useScreen.setState(computeScreen())

export function toScreen(clientX: number, clientY: number) {
  const { left, top, k } = useScreen.getState()
  return { x: (clientX - left) / k, y: (clientY - top) / k }
}

/** Area available to windows: the screen minus the taskbar (unless it auto-hides). */
export function workAreaFor(
  screen: Pick<ScreenMetrics, 'w' | 'h'>,
  position: TaskbarPosition,
  autoHide: boolean,
): Rect {
  const t = autoHide ? 0 : TASKBAR_SIZE
  const { w, h } = screen
  switch (position) {
    case 'top': return { x: 0, y: t, w, h: h - t }
    case 'left': return { x: t, y: 0, w: w - t, h }
    case 'right': return { x: 0, y: 0, w: w - t, h }
    default: return { x: 0, y: 0, w, h: h - t }
  }
}

export function workArea(): Rect {
  const { taskbarPosition, taskbarAutoHide } = useSettings.getState()
  return workAreaFor(useScreen.getState(), taskbarPosition, taskbarAutoHide)
}

export function useWorkArea(): Rect {
  const w = useScreen((s) => s.w)
  const h = useScreen((s) => s.h)
  const position = useSettings((s) => s.taskbarPosition)
  const autoHide = useSettings((s) => s.taskbarAutoHide)
  return workAreaFor({ w, h }, position, autoHide)
}

/** Where a popup (start menu, tray panel, toast stack) sits relative to the taskbar. */
export function popupStyle(position: TaskbarPosition, align: 'start' | 'end', gap = 8): CSSProperties {
  const off = TASKBAR_SIZE + gap
  if (position === 'bottom') return { bottom: off, ...(align === 'start' ? { left: gap } : { right: gap }) }
  if (position === 'top') return { top: off, ...(align === 'start' ? { left: gap } : { right: gap }) }
  const side = position === 'left' ? { left: off } : { right: off }
  return { ...side, ...(align === 'start' ? { top: gap } : { bottom: gap }) }
}

export function slideOffset(position: TaskbarPosition, distance = 24) {
  if (position === 'bottom') return { y: distance }
  if (position === 'top') return { y: -distance }
  return { x: position === 'left' ? -distance : distance }
}
