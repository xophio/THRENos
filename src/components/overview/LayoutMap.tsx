import type { WindowState } from '../../types'
import { useScreen } from '../../utils/screen'

/** A miniature of a workspace: one rectangle per window at its real position on the screen. */
export function LayoutMap({ windows, focusedId, width = 112 }: { windows: WindowState[]; focusedId: string | null; width?: number }) {
  const { w, h } = useScreen()
  const sorted = [...windows].sort((a, b) => a.z - b.z)
  return (
    <div
      data-layout-map
      className="relative shrink-0 overflow-hidden border border-ink bg-field"
      style={{ width, height: (width * h) / w }}
      aria-hidden
    >
      {sorted.map((win) => {
        const full = win.maximized
        return (
          <span
            key={win.id}
            className={`absolute border ${
              win.minimized ? 'border-dashed border-rule bg-transparent' : win.id === focusedId ? 'border-ink bg-[color-mix(in_srgb,var(--accent)_35%,var(--paper))]' : 'border-ink bg-paper'
            }`}
            style={{
              left: `${full ? 0 : (win.x / w) * 100}%`,
              top: `${full ? 0 : (win.y / h) * 100}%`,
              width: `${full ? 100 : (win.w / w) * 100}%`,
              height: `${full ? 100 : (win.h / h) * 100}%`,
            }}
          />
        )
      })}
    </div>
  )
}
