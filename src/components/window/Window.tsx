import { useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { motion } from 'motion/react'
import { Minus, Square, Copy, X } from 'lucide-react'
import type { Rect, SnapSide, WindowState } from '../../types'
import { APPS } from '../../apps/registry'
import { APP_COMPONENTS } from '../../apps/components'
import { useWindows } from '../../store/windowStore'
import { useUi } from '../../store/uiStore'
import { clamp } from '../../utils'
import { toScreen, useScreen, useWorkArea, workArea } from '../../utils/screen'

const MIN_W = 280
const MIN_H = 200
const EDGE = 12

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

// All coordinates below are logical screen pixels (see utils/screen.ts), not raw client pixels.
const snapZone = (px: number, py: number): SnapSide => {
  const a = workArea()
  const { w } = useScreen.getState()
  if (py <= a.y + 4) return 'top'
  if (px <= a.x + EDGE) return 'left'
  if (px >= Math.min(a.x + a.w, w) - EDGE) return 'right'
  return null
}

const previewStyle = (side: Exclude<SnapSide, null>, a: Rect) =>
  side === 'top'
    ? { left: a.x, top: a.y, width: a.w, height: a.h }
    : { left: side === 'left' ? a.x : a.x + a.w / 2, top: a.y, width: a.w / 2, height: a.h }

export function Window({ win, focused }: { win: WindowState; focused: boolean }) {
  const { focus, close, minimize, toggleMaximize, setRect, snap } = useWindows()
  const app = APPS[win.appId]
  const Content = APP_COMPONENTS[win.appId]
  const area = useWorkArea()
  const k = useScreen((s) => s.k)
  const [preview, setPreview] = useState<SnapSide>(null)
  const full = win.maximized

  const startDrag = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    focus(win.id)
    const start = toScreen(e.clientX, e.clientY)
    let offX = start.x - win.x
    let offY = start.y - win.y
    let detached = !(win.maximized || win.snap)
    let zone: SnapSide = null

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
      const a = workArea()
      setRect(win.id, { x: p.x - offX, y: clamp(p.y - offY, a.y, a.y + a.h - 40) })
      zone = snapZone(p.x, p.y)
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
      const dx = (ev.clientX - sx) / k
      const dy = (ev.clientY - sy) / k
      let { x, y, w, h } = o
      if (dir.includes('e')) w = Math.max(MIN_W, o.w + dx)
      if (dir.includes('s')) h = Math.max(MIN_H, o.h + dy)
      if (dir.includes('w')) { w = Math.max(MIN_W, o.w - dx); x = o.x + o.w - w }
      if (dir.includes('n')) { h = Math.max(MIN_H, o.h - dy); y = Math.max(workArea().y, o.y + o.h - h) }
      setRect(win.id, { x, y, w, h })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const geometry = full
    ? { left: area.x, top: area.y, width: area.w, height: area.h }
    : { left: win.x, top: win.y, width: win.w, height: win.h }

  return (
    <>
      {preview && (
        <div
          className="pointer-events-none fixed z-[9000] border border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
          style={previewStyle(preview, area)}
        />
      )}
      <motion.div
        data-window={win.id}
        className={`panel absolute flex flex-col overflow-hidden ${focused ? '' : '!border-rule'}`}
        style={{ ...geometry, zIndex: win.z, pointerEvents: win.minimized ? 'none' : 'auto' }}
        initial={{ opacity: 0, y: 8 }}
        animate={win.minimized ? { opacity: 0, y: 24 } : { opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        onPointerDown={() => { useUi.getState().closeAll(); if (!focused) focus(win.id) }}
      >
        <div
          className={`flex h-9 shrink-0 items-stretch border-b ${focused ? 'border-ink' : 'border-rule'}`}
          onPointerDown={startDrag}
          onDoubleClick={() => toggleMaximize(win.id)}
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
            {win.maximized || win.snap ? <Copy size={11} strokeWidth={1.5} /> : <Square size={11} strokeWidth={1.5} />}
          </button>
          <button aria-label="Close" onClick={() => close(win.id)} className="grid w-10 place-items-center border-l border-rule-soft text-white/80 transition-colors hover:bg-signal hover:text-[#fff]">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          <Content windowId={win.id} props={win.props} />
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
    </>
  )
}
