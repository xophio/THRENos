import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useNotifications } from '../../store/notificationStore'
import { useSettings } from '../../store/settingsStore'
import { popupStyle } from '../../utils/screen'

export function Toasts() {
  const toasts = useNotifications((s) => s.toasts)
  const dismiss = useNotifications((s) => s.dismiss)
  const position = useSettings((s) => s.taskbarPosition)
  const fromTop = position === 'top'
  return (
    <div
      className={`pointer-events-none fixed z-[9800] flex w-80 max-w-[calc(100%-24px)] gap-2 ${fromTop ? 'flex-col' : 'flex-col-reverse'}`}
      style={popupStyle(position, 'end', 12)}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            data-toast
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="panel pointer-events-auto flex items-stretch"
          >
            <span className="w-1 shrink-0 bg-[var(--accent)]" />
            <div className="min-w-0 flex-1 px-3.5 py-2.5">
              <div className="kicker !text-ink">{t.title}</div>
              {t.body && <div className="mt-1.5 truncate text-[12.5px] text-white/70">{t.body}</div>}
            </div>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="ibtn grid w-9 place-items-center border-l border-rule-soft">
              <X size={13} strokeWidth={1.5} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
