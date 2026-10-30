import type { TriggerEvent, TriggerState } from './types'
import { getTriggerDef } from './model'
import { runAutomation } from './engine'
import { useAutomations } from './store'
import { eventsSuppressed } from './guard'
import { useSystem } from '../system/systemStore'
import { useWindows } from '../store/windowStore'
import { useWorkspaces } from '../store/workspaceStore'
import { getApp } from '../os/registry'

/** Automations only react while someone is signed in (desktop or lock screen). */
const sessionActive = () => {
  const phase = useSystem.getState().phase
  return phase === 'desktop' || phase === 'locked'
}

/** Delivers an event to every enabled automation whose trigger matches it. */
export function dispatch(event: TriggerEvent) {
  if (eventsSuppressed() || !sessionActive()) return
  for (const a of useAutomations.getState().automations) {
    if (!a.enabled || a.trigger.type !== event.type) continue
    if (getTriggerDef(a.trigger.type)?.matches?.(a.trigger.config, event.data) === false) continue
    void runAutomation(a, { trigger: getTriggerDef(a.trigger.type)?.label ?? event.type, event })
  }
}

// ---- Scheduler ----

interface Watch { updatedAt: number; base: number; lastFired: number | null }
const watches = new Map<string, Watch>()

function tick() {
  if (!sessionActive()) return
  const now = new Date()
  for (const a of useAutomations.getState().automations) {
    const def = getTriggerDef(a.trigger.type)
    if (!a.enabled || !def?.due) { watches.delete(a.id); continue }
    let w = watches.get(a.id)
    // Timers start when an automation is first watched, and restart whenever it is edited or toggled.
    if (!w || w.updatedAt !== a.updatedAt) {
      w = { updatedAt: a.updatedAt, base: now.getTime(), lastFired: null }
      watches.set(a.id, w)
    }
    const state: TriggerState = { now, lastFired: w.lastFired, base: w.base }
    if (def.check?.(a.trigger.config) || !def.due(a.trigger.config, state)) continue
    w.lastFired = now.getTime()
    void runAutomation(a, { trigger: def.label, event: { type: a.trigger.type, data: {} } })
  }
}

// ---- Wiring to the rest of the OS ----

let started = false
let startupFired = false

/** Subscribes to window, workspace and session changes and starts the scheduler. Call once at boot. */
export function startAutomationEngine() {
  if (started) return
  started = true

  useSystem.subscribe((state, prev) => {
    if (state.phase === prev.phase) return
    const inSession = state.phase === 'desktop' || state.phase === 'locked'
    const wasInSession = prev.phase === 'desktop' || prev.phase === 'locked'
    if (inSession && !wasInSession) {
      watches.clear()
      if (!startupFired) { startupFired = true; dispatch({ type: 'system.startup', data: {} }) }
      dispatch({ type: 'user.login', data: {} })
    } else if (state.phase === 'locked' && prev.phase === 'desktop') {
      dispatch({ type: 'user.lock', data: {} })
    } else if (state.phase === 'desktop' && prev.phase === 'locked') {
      dispatch({ type: 'user.unlock', data: {} })
    }
  })

  useWindows.subscribe((state, prev) => {
    if (state.windows === prev.windows) return
    const before = new Map(prev.windows.map((w) => [w.id, w]))
    const after = new Map(state.windows.map((w) => [w.id, w]))
    const opened = state.windows.filter((w) => !before.has(w.id))
    const closed = prev.windows.filter((w) => !after.has(w.id))
    // Restoring or clearing a whole session replaces many windows at once; that is not the user opening or closing apps.
    if (opened.length + closed.length !== 1) return
    const win = opened[0] ?? closed[0]
    const appName = getApp(win.appId)?.name ?? win.appId
    dispatch({ type: opened.length ? 'app.launched' : 'app.closed', data: { appId: win.appId, appName } })
  })

  useWorkspaces.subscribe((state, prev) => {
    if (state.activeId === prev.activeId) return
    const ws = state.workspaces.find((w) => w.id === state.activeId)
    if (ws) dispatch({ type: 'workspace.activated', data: { workspaceId: ws.id, workspaceName: ws.name } })
  })

  window.setInterval(tick, 1000)
}
