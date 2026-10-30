import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
}

/** Modal scoped to its nearest positioned ancestor (e.g. an app window). */
export function Dialog({ title, onClose, children, actions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="absolute inset-0 z-20 grid place-items-center bg-paper/80 p-4"
      onClick={(e) => { e.stopPropagation(); onClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      <div
        className="panel w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink px-4 py-2.5">
          <h3 className="kicker !text-ink">{title}</h3>
          <button aria-label="Close dialog" onClick={onClose} className="ibtn grid size-6 place-items-center"><X size={14} strokeWidth={1.5} /></button>
        </div>
        <div className="px-4 py-4 text-[13px] leading-relaxed">{children}</div>
        {actions && <div className="flex justify-end gap-2 border-t border-rule px-4 py-3">{actions}</div>}
      </div>
    </motion.div>
  )
}
