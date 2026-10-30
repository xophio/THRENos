import { useEffect } from 'react'
import { useWindows } from '../store/windowStore'
import { useUi } from '../store/uiStore'

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
        if (ui.startOpen || ui.tray) ui.closeAll()
        return
      }
      if (!e.altKey) return
      const id = wm.focusedId
      const k = e.key.toLowerCase()

      if (k === 't') { e.preventDefault(); wm.open('terminal') }
      else if (k === 'e') { e.preventDefault(); wm.open('files') }
      else if (k === 'd') { e.preventDefault(); wm.minimizeAll() }
      else if (k === 'tab') {
        e.preventDefault()
        const order = [...wm.windows].sort((a, b) => a.z - b.z)
        if (order.length > 1) wm.focus(order[0].id)
      } else if (id) {
        if (k === 'w') { e.preventDefault(); wm.close(id) }
        else if (k === 'm') { e.preventDefault(); wm.minimize(id) }
        else if (k === 'f') { e.preventDefault(); wm.toggleMaximize(id) }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); wm.snap(id, 'left') }
        else if (e.key === 'ArrowRight') { e.preventDefault(); wm.snap(id, 'right') }
        else if (e.key === 'ArrowUp') { e.preventDefault(); wm.snap(id, 'top') }
        else if (e.key === 'ArrowDown') { e.preventDefault(); wm.minimize(id) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
