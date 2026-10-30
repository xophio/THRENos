import { Suspense, useEffect, useState } from 'react'
import type { MouseEvent as RMouseEvent, PointerEvent as RPointerEvent } from 'react'
import { motion } from 'motion/react'
import { Minus, Square, Copy, X } from 'lucide-react'
import type { SnapRegion, WindowState } from '../../types'
import { getAppComponent, useApp } from '../../os/registry'
import { useWindows } from '../../store/windowStore'
import { useUi } from '../../store/uiStore'
import { useSettings } from '../../store/settingsStore'
import { useWorkspaces } from '../../store/workspaceStore'
import { toScreen, useScreen, useWorkArea, workArea } from '../../utils/screen'
import { SNAP_LABELS, regionRect, zoneAt } from '../../utils/snap'
import { ContextMenu } from '../shared/ContextMenu'
import type { MenuItem } from '../shared/ContextMenu'

const MIN_W = 280
const MIN_H = 200

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: { dir: Dir; cls: string; cursor: string }[] = [
  { dir: 'n', cls: 'top-0 left-2 right-2 h-1.5', cursor: 'ns-resize' },
  { dir: 's', cls: 'bottom-0 left-2 right-2 h-1.5', cursor: 'ns-resize' },
  { dir: 'e', cls: 'right-0 top-2 bottom-2 w-1.5', cursor: 'ew-resize' },
  { dir: 'w', cls: 'left-0 top-2 bottom-2 w-1.5', cursor: 'ew-resize' },
  { dir: 'ne', cls: 'top-0 right-0 size-4', cursor: 'nesw-resize' },
  { dir: 'nw', cls: 'top-0 left-0 size-4', cursor: 'nwse-resize' },
  { dir: 'se', cls: 'bottom-0 right-0 size-4', cursor: 'nwse-resize' },
  { dir: 'sw', cls: 'bottom-0 left-0 size-4', cursor: 'nesw-resize' },
]

const MENU_SNAPS: SnapRegion[] = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

export function Window({ win, focused }: { win: WindowState; focused: boolean }) {
  const { focus, close, minimize, toggleMaximize, setRect, snap, moveToWorkspace } = useWindows()
  const app = useApp(win.appId)
  const area = useWorkArea()
  const activeWorkspace = useWorkspaces((s) => s.activeId)
  const k = useScreen((s) => s.k)
  const [preview, setPreview] = useState<SnapRegion | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const full = win.maximized
  // Windows on other workspaces stay mounted (their app state is kept) but are not shown.
  const visible = win.workspaceId === activeWorkspace

  // A window whose app has been unregistered has nothing left to show.
  useEffect(() => { if (!app) close(win.id) }, [app, close, win.id])

  const startDrag = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || e.button !== 0) return
    e.preventDefault()
    focus(win.id)
    const start = toScreen(e.clientX, e.clientY)
    let offX = start.x - win.x
    let offY = start.y - win.y
    let detached = !(win.maximized || win.snap)
    let zone: SnapRegion | null = null

    const onMove = (ev: PointerEvent) => {
      const p = toScreen(ev.clientX, ev.clientY)
      if (!detached) {
        if (Math.hypot(p.x - start.x, p.y - start.y) < 4) return
        // Pull out of maximized/snapped state, keeping the cursor proportionally on the title bar.
        const r = win.restore ?? { x: win.x, y: win.y, w: win.w, h: win.h }
        offX = r.w * ((start.x - win.x) / Math.max(win.w, 1))
        offY = 18
        setRect(win.id, r)
        detached = true
      }
      // The store keeps the window inside the work area, so the pointer may go further than the window.
      setRect(win.id, { x: p.x - offX, y: p.y - offY })
      zone = zoneAt(p.x, p.y, workArea())
      setPreview(zone)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setPreview(null)
      if (zone) snap(win.id, zone)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (e: RPointerEvent, dir: Dir) => {
    e.preventDefault()
    e.stopPropagation()
    focus(win.id)
    const sx = e.clientX
    const sy = e.clientY
    const o = { x: win.x, y: win.y, w: win.w, h: win.h }
    const onMove = (ev: PointerEvent) => {
      const a = workArea()
      const dx = (ev.clientX - sx) / k
      const dy = (ev.clientY - sy) / k
      let { x, y, w, h } = o
      // Resizing stops at the edges of the work area instead of pushing the window around.
      if (dir.includes('e')) w = Math.min(Math.max(MIN_W, o.w + dx), a.x + a.w - o.x)
      if (dir.includes('s')) h = Math.min(Math.max(MIN_H, o.h + dy), a.y + a.h - o.y)
      if (dir.includes('w')) { x = Math.max(a.x, Math.min(o.x + dx, o.x + o.w - MIN_W)); w = o.x + o.w - x }
      if (dir.includes('n')) { y = Math.max(a.y, Math.min(o.y + dy, o.y + o.h - MIN_H)); h = o.y + o.h - y }
      setRect(win.id, { x, y, w, h })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (!app) return null
  const Content = getAppComponent(app)

  const tiled = win.maximized || !!win.snap
  const openMenu = (e: RMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    focus(win.id)
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const menuItems = (): MenuItem[] => {
    const { workspaces } = useWorkspaces.getState()
    return [
      { label: 'Minimize', onClick: () => minimize(win.id), hint: 'Alt+M' },
      { label: win.maximized ? 'Restore' : 'Maximize', onClick: () => (tiled ? toggleMaximize(win.id) : snap(win.id, 'maximize')), hint: 'Alt+F' },
      { label: '', separator: true },
      ...MENU_SNAPS.map((r): MenuItem => ({ label: `Snap ${SNAP_LABELS[r].toLowerCase()}`, onClick: () => snap(win.id, r) })),
      ...(workspaces.length > 1 ? [{ label: '', separator: true } as MenuItem] : []),
      ...workspaces
        .filter((w) => w.id !== win.workspaceId)
        .map((w): MenuItem => ({ label: `Move to ${w.name}`, onClick: () => moveToWorkspace(win.id, w.id) })),
      { label: '', separator: true },
      { label: 'Close', onClick: () => close(win.id), hint: 'Alt+W' },
    ]
  }

  const geometry = full
    ? { left: area.x, top: area.y, width: area.w, height: area.h }
    : { left: win.x, top: win.y, width: win.w, height: win.h }
  const previewing = preview && useSettings.getState().snapPreview

  return (
    <>
      {previewing && visible && (
        <div
          data-snap-preview={preview}
          className="pointer-events-none fixed z-[9000] border border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] transition-[left,top,width,height] duration-100"
          style={(() => { const r = regionRect(preview, area); return { left: r.x, top: r.y, width: r.w, height: r.h } })()}
        />
      )}
      <motion.div
        data-window={win.id}
        data-app={win.appId}
        data-workspace={win.workspaceId}
        data-minimized={win.minimized}
        data-snap={win.maximized ? 'maximize' : win.snap ?? ''}
        data-focused={focused}
        className={`panel absolute flex flex-col overflow-hidden ${focused ? '' : '!border-rule'}`}
        style={{
          ...geometry,
          zIndex: win.z,
          display: visible ? 'flex' : 'none',
          pointerEvents: win.minimized || !visible ? 'none' : 'auto',
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={win.minimized || !visible ? { opacity: 0, y: 24 } : { opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        onPointerDown={() => { useUi.getState().closeAll(); if (!focused) focus(win.id) }}
      >
        <div
          className={`flex h-9 shrink-0 items-stretch border-b ${focused ? 'border-ink' : 'border-rule'}`}
          onPointerDown={startDrag}
          onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) toggleMaximize(win.id) }}
          onContextMenu={openMenu}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-3">
            <span className={`size-2 shrink-0 ${focused ? 'bg-[var(--accent)]' : 'bg-white/25'}`} />
            <app.icon size={14} strokeWidth={1.5} className="shrink-0 text-white/70" />
            <span className={`truncate text-[11.5px] font-semibold uppercase tracking-[0.1em] ${focused ? '' : 'text-white/55'}`}>
              {win.title}
            </span>
          </div>
          <button aria-label="Minimize" onClick={() => minimize(win.id)} className="ibtn grid w-10 place-items-center border-l border-rule-soft">
            <Minus size={13} strokeWidth={1.5} />
          </button>
          <button aria-label="Maximize" onClick={() => toggleMaximize(win.id)} className="ibtn grid w-10 place-items-center border-l border-rule-soft">
            {tiled ? <Copy size={11} strokeWidth={1.5} /> : <Square size={11} strokeWidth={1.5} />}
          </button>
          <button aria-label="Close" onClick={() => close(win.id)} className="grid w-10 place-items-center border-l border-rule-soft text-white/80 transition-colors hover:bg-signal hover:text-[#fff]">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          <Suspense fallback={<div className="grid h-full place-items-center"><span className="kicker">Loading</span></div>}>
            <Content windowId={win.id} appId={win.appId} props={win.props} />
          </Suspense>
        </div>
        {!full &&
          HANDLES.map((h) => (
            <div
              key={h.dir}
              className={`absolute ${h.cls}`}
              style={{ cursor: h.cursor }}
              onPointerDown={(e) => startResize(e, h.dir)}
            />
          ))}
      </motion.div>
      {menu && <ContextMenu {...menu} items={menuItems()} onClose={() => setMenu(null)} />}
    </>
  )
}
