import { useCallback, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { AppWindow, Image, LayoutGrid, Layers, Maximize2, Minimize2, RefreshCcw, Rows3, StickyNote, SquareTerminal } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { WALLPAPERS } from '../../theme/wallpapers'
import { useWindows } from '../../store/windowStore'
import { useUi } from '../../store/uiStore'
import { notify } from '../../store/notificationStore'
import { useWallpaperStyle } from '../../hooks/useWallpaper'
import { useWorkArea } from '../../utils/screen'
import { ContextMenu } from '../shared/ContextMenu'
import type { MenuItem } from '../shared/ContextMenu'
import { DesktopClock } from './DesktopClock'
import { DesktopIcons, CELL_H, CELL_W, GRID_PAD } from './DesktopIcons'

/** Hairline layout grid aligned with the icon cells. */
function GridOverlay() {
  const a = useWorkArea()
  const line = 'color-mix(in srgb, var(--ink) 9%, transparent)'
  return (
    <div
      data-desktop-grid
      className="pointer-events-none absolute"
      style={{
        left: a.x, top: a.y, width: a.w, height: a.h,
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: `${CELL_W}px ${CELL_H}px`,
        backgroundPosition: `${GRID_PAD - 4}px ${GRID_PAD - 4}px`,
      }}
    />
  )
}

export function Desktop() {
  const wallpaperStyle = useWallpaperStyle()
  const showGrid = useSettings((s) => s.desktopGrid)
  const showClock = useSettings((s) => s.desktopClock)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const items = (): MenuItem[] => {
    const wm = useWindows.getState()
    const s = useSettings.getState()
    return [
      { label: 'Open Terminal', icon: SquareTerminal, onClick: () => wm.open('terminal') },
      { label: 'New Note', icon: StickyNote, onClick: () => wm.open('notes') },
      { label: 'Settings', icon: AppWindow, onClick: () => wm.open('settings') },
      { label: '', separator: true },
      { label: 'Next wallpaper', icon: Image, onClick: () => {
        const i = WALLPAPERS.findIndex((w) => w.id === s.wallpaper)
        s.set({ wallpaper: WALLPAPERS[(i + 1) % WALLPAPERS.length].id })
      } },
      { label: 'Reset icon layout', icon: LayoutGrid, onClick: () => s.resetIcons() },
      { label: '', separator: true },
      { label: 'Cascade windows', icon: Layers, onClick: () => wm.cascade() },
      { label: 'Tile windows', icon: LayoutGrid, onClick: () => wm.tile() },
      { label: 'Show desktop', icon: Minimize2, onClick: () => wm.minimizeAll(), hint: 'Alt+D' },
      { label: 'Restore windows', icon: Maximize2, onClick: () => wm.restoreAll(), hint: '⇧Alt+D' },
      { label: 'Task overview', icon: Rows3, onClick: () => useUi.getState().setOverview(true), hint: 'Alt+O' },
      { label: 'Refresh', icon: RefreshCcw, onClick: () => notify('Desktop refreshed') },
    ]
  }

  return (
    <div
      data-desktop
      className="absolute inset-0"
      style={wallpaperStyle}
      onPointerDown={() => useUi.getState().closeAll()}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {showGrid && <GridOverlay />}
      {showClock && <DesktopClock />}
      <DesktopIcons />
      <AnimatePresence>{menu && <ContextMenu {...menu} items={items()} onClose={closeMenu} />}</AnimatePresence>
    </div>
  )
}
