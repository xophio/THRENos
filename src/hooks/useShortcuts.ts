import { useEffect } from 'react'
import { useWindows, windowsIn } from '../store/windowStore'
import { useWorkspaces } from '../store/workspaceStore'
import { cycleWorkspace, moveFocusedWindow, switchWorkspace } from '../store/workspaceActions'
import { useUi } from '../store/uiStore'
import { launchApp } from '../os/lifecycle'
import type { SnapRegion } from '../types'

const SNAP_KEYS: Record<string, SnapRegion> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom',
  u: 'top-left', i: 'top-right', j: 'bottom-left', k: 'bottom-right',
}

/** Opens the Alt+Tab switcher, or moves its selection. Windows are listed most-recently-used first. */
function stepSwitcher(direction: 1 | -1) {
  const ui = useUi.getState()
  if (ui.switcher) {
    const { ids, index } = ui.switcher
    ui.setSwitcher({ ids, index: (index + direction + ids.length) % ids.length })
    return
  }
  const { windows } = useWindows.getState()
  const ids = windowsIn(windows, useWorkspaces.getState().activeId).reverse().map((w) => w.id)
  if (!ids.length) return
  ui.setSwitcher({ ids, index: ids.length > 1 ? (direction === 1 ? 1 : ids.length - 1) : 0 })
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState()
      const wm = useWindows.getState()

      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault()
        ui.setStart()
        return
      }
      if (e.key === 'Escape') {
        if (ui.switcher) ui.setSwitcher(null)
        else if (ui.overview) ui.setOverview(false)
        else if (ui.startOpen || ui.tray) ui.closeAll()
        return
      }
      if (!e.altKey) return

      // Alt+Tab (and Alt+` where the OS keeps Alt+Tab for itself) cycles windows; releasing Alt activates.
      if (e.key === 'Tab' || e.code === 'Backquote') {
        e.preventDefault()
        stepSwitcher(e.shiftKey ? -1 : 1)
        return
      }

      // Workspaces: Alt+Shift+←/→ switch, +Ctrl moves the focused window along, Alt+Shift+1…9 jump.
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const delta = e.key === 'ArrowRight' ? 1 : -1
        if (e.ctrlKey) moveFocusedWindow(delta)
        else cycleWorkspace(delta)
        return
      }
      const digit = /^Digit([1-9])$/.exec(e.code)
      if (e.shiftKey && digit) {
        e.preventDefault()
        const target = useWorkspaces.getState().workspaces[Number(digit[1]) - 1]
        if (target) switchWorkspace(target.id)
        return
      }

      const k = e.key.toLowerCase()
      const id = wm.focusedId

      if (k === 't') { e.preventDefault(); launchApp('terminal') }
      else if (k === 'e') { e.preventDefault(); launchApp('files') }
      else if (k === 'o') { e.preventDefault(); ui.setOverview() }
      else if (k === 'd') { e.preventDefault(); if (e.shiftKey) wm.restoreAll(); else wm.minimizeAll() }
      else if (id) {
        const region = e.shiftKey ? undefined : SNAP_KEYS[e.key] ?? SNAP_KEYS[k]
        if (k === 'w') { e.preventDefault(); wm.close(id) }
        else if (k === 'm') { e.preventDefault(); wm.minimize(id) }
        else if (k === 'f') { e.preventDefault(); wm.snap(id, 'maximize') }
        else if (region) { e.preventDefault(); wm.snap(id, region) }
      }
    }

    // Releasing Alt confirms the Alt+Tab selection.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return
      const { switcher, setSwitcher } = useUi.getState()
      if (!switcher) return
      e.preventDefault() // stops the browser from moving focus to its menu bar
      setSwitcher(null)
      const id = switcher.ids[switcher.index]
      if (id) useWindows.getState().focus(id)
    }

    const onBlur = () => useUi.getState().setSwitcher(null)

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
