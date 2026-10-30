import type { Rect, SnapSide, WindowState } from '../types'
import { SNAP_REGIONS } from '../utils/snap'
import { getApp } from '../os/registry'
import { PRIMARY_PROFILE, getActiveProfileId, scopedKey } from '../system/activeProfile'
import { useWindows } from './windowStore'
import { useWorkspaces } from './workspaceStore'

const BASE = 'threnos-windows'
const VERSION = 1

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const key = () => scopedKey(BASE, getActiveProfileId() ?? PRIMARY_PROFILE)

const rectOrNull = (v: unknown): Rect | null =>
  isObject(v) && num(v.x) && num(v.y) && num(v.w) && num(v.h) && v.w > 0 && v.h > 0 ? { x: v.x, y: v.y, w: v.w, h: v.h } : null

/**
 * Turns saved data back into windows. Anything malformed is dropped, windows of apps that are
 * no longer installed are skipped, and windows pointing at a missing workspace move to the active one.
 */
export function parseSession(raw: unknown): WindowState[] {
  if (!isObject(raw) || raw.version !== VERSION || !Array.isArray(raw.windows)) return []
  const { workspaces, activeId } = useWorkspaces.getState()
  const ids = new Set<string>()
  const out: WindowState[] = []

  for (const w of raw.windows) {
    if (!isObject(w) || typeof w.id !== 'string' || typeof w.appId !== 'string' || ids.has(w.id)) continue
    const app = getApp(w.appId)
    const rect = rectOrNull(w)
    if (!app || !rect || !num(w.z)) continue
    ids.add(w.id)
    const snap = SNAP_REGIONS.includes(w.snap as never) && w.snap !== 'maximize' ? (w.snap as SnapSide) : null
    out.push({
      id: w.id,
      appId: w.appId,
      workspaceId: typeof w.workspaceId === 'string' && workspaces.some((x) => x.id === w.workspaceId) ? w.workspaceId : activeId,
      title: typeof w.title === 'string' ? w.title.slice(0, 80) : app.name,
      ...rect,
      z: w.z,
      minimized: w.minimized === true,
      maximized: w.maximized === true,
      snap,
      restore: rectOrNull(w.restore),
      props: isObject(w.props) ? w.props : undefined,
    })
  }
  return out
}

// Saving only happens while a profile's desktop is in use, so logging out or restarting
// (which clear the windows) never overwrites the layout that was just saved.
let tracking = false

export function saveWindowSession() {
  if (!tracking) return
  try {
    localStorage.setItem(key(), JSON.stringify({ version: VERSION, windows: useWindows.getState().windows }))
  } catch {
    // Storage may be full or unavailable; losing the layout is harmless.
  }
}

/** Starts or stops writing the layout. Turning it off first flushes the current layout. */
export function setWindowTracking(on: boolean) {
  if (!on) saveWindowSession()
  tracking = on
}

/** Loads the active profile's saved layout into the window manager. Returns how many windows came back. */
export function restoreWindowSession(): number {
  try {
    const raw = localStorage.getItem(key())
    const windows = raw ? parseSession(JSON.parse(raw)) : []
    useWindows.getState().hydrate(windows)
    return windows.length
  } catch {
    useWindows.getState().hydrate([])
    return 0
  }
}

let timer = 0
useWindows.subscribe(() => {
  if (!tracking) return
  window.clearTimeout(timer)
  timer = window.setTimeout(saveWindowSession, 250)
})
window.addEventListener('pagehide', saveWindowSession)
