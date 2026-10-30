import { useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { useRegisteredApps } from '../../os/registry'
import { useInstallStore } from '../../os/installStore'
import { launchApp } from '../../os/lifecycle'
import type { AppId } from '../../types'
import { useSettings } from '../../store/settingsStore'
import { clamp } from '../../utils'
import { useScreen, useWorkArea, workArea } from '../../utils/screen'

export const CELL_W = 96
export const CELL_H = 100
export const GRID_PAD = 16
const PAD = GRID_PAD

export function DesktopIcons() {
  const positions = useSettings((s) => s.iconPositions)
  const setIconPosition = useSettings((s) => s.setIconPosition)
  const registered = useRegisteredApps()
  const shortcuts = useInstallStore((s) => s.shortcuts)
  // System apps always have a shortcut; others follow the per-app setting (default on).
  const appList = registered.filter((a) => a.kind === 'system' || shortcuts[a.id]?.desktop !== false)
  const area = useWorkArea()
  const k = useScreen((s) => s.k)
  const [selected, setSelected] = useState<AppId | null>(null)
  const [dragPos, setDragPos] = useState<{ id: AppId; x: number; y: number } | null>(null)

  const defaultPos = (i: number) => {
    const rows = Math.max(1, Math.floor((area.h - PAD) / CELL_H))
    return { x: area.x + PAD + Math.floor(i / rows) * CELL_W, y: area.y + PAD + (i % rows) * CELL_H }
  }

  // Saved positions can fall outside the work area after the screen or taskbar changes.
  const fit = (p: { x: number; y: number }) => ({
    x: clamp(p.x, area.x, Math.max(area.x, area.x + area.w - CELL_W)),
    y: clamp(p.y, area.y, Math.max(area.y, area.y + area.h - CELL_H)),
  })

  const onDown = (e: RPointerEvent, id: AppId, base: { x: number; y: number }) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelected(id)
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    let cur = base

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / k
      const dy = (ev.clientY - sy) / k
      if (!moved && Math.hypot(dx, dy) < 4) return
      moved = true
      const a = workArea()
      cur = {
        x: clamp(base.x + dx, a.x, a.x + a.w - CELL_W),
        y: clamp(base.y + dy, a.y, a.y + a.h - CELL_H),
      }
      setDragPos({ id, ...cur })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragPos(null)
      if (moved) {
        // Snap to the grid.
        const a = workArea()
        setIconPosition(id, {
          x: Math.round((cur.x - a.x - PAD) / CELL_W) * CELL_W + a.x + PAD,
          y: Math.round((cur.y - a.y - PAD) / CELL_H) * CELL_H + a.y + PAD,
        })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="absolute inset-0" onPointerDown={() => setSelected(null)}>
      {appList.map((app, i) => {
        const base = fit(positions[app.id] ?? defaultPos(i))
        const dragging = dragPos?.id === app.id
        const pos = dragging ? dragPos : base
        const isSelected = selected === app.id
        return (
          <div
            key={app.id}
            data-icon={app.id}
            onPointerDown={(e) => onDown(e, app.id, base)}
            onDoubleClick={() => launchApp(app.id)}
            onContextMenu={(e) => e.stopPropagation()}
            className={`absolute flex cursor-default flex-col items-center gap-2 py-1.5 ${
              dragging ? 'z-10 cursor-grabbing opacity-80' : 'transition-[left,top] duration-150'
            }`}
            style={{ left: pos.x, top: pos.y, width: CELL_W - 8 }}
          >
            <div
              className={`grid size-12 place-items-center rounded-md border transition-colors ${
                isSelected ? 'border-ink bg-ink text-paper' : 'border-ink bg-paper hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              <app.icon size={22} strokeWidth={1.4} />
            </div>
            <span
              className={`flex items-center gap-1.5 border-b-2 pb-px text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
                isSelected ? 'border-[var(--accent)]' : 'border-transparent'
              }`}
            >
              <span className="font-mono text-[9px] font-normal text-white/55">{String(i + 1).padStart(2, '0')}</span>
              {app.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
