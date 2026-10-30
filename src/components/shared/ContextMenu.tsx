import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { toScreen, useScreen } from '../../utils/screen'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  separator?: boolean
  disabled?: boolean
  hint?: string
}

interface Props { x: number; y: number; items: MenuItem[]; onClose: () => void }

export function ContextMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
    }
  }, [onClose])

  // Callers pass client coordinates; the menu lives in logical screen space.
  const screen = useScreen.getState()
  const p = toScreen(x, y)
  const left = Math.max(0, Math.min(p.x, screen.w - 232))
  const top = Math.max(0, Math.min(p.y, screen.h - items.length * 34 - 20))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08 }}
      data-context-menu
      className="panel fixed z-[10000] w-56 py-1"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="my-1 h-px bg-rule-soft" />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => { it.onClick?.(); onClose() }}
            className="hover-invert flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] disabled:pointer-events-none disabled:opacity-35"
          >
            {it.icon && <it.icon size={14} strokeWidth={1.5} className="text-white/60" />}
            <span className="flex-1">{it.label}</span>
            {it.hint && <span className="font-mono text-[10.5px] text-white/60">{it.hint}</span>}
          </button>
        ),
      )}
    </motion.div>
  )
}
