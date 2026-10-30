import { AnimatePresence, motion } from 'motion/react'
import { useRegistry } from '../../os/registry'
import { useUi } from '../../store/uiStore'
import { useWindows } from '../../store/windowStore'

/** The Alt+Tab switcher: shown while Alt is held, confirmed when Alt is released. */
export function AppSwitcher() {
  const switcher = useUi((s) => s.switcher)
  const windows = useWindows((s) => s.windows)
  const apps = useRegistry((s) => s.apps)

  const items = switcher ? switcher.ids.map((id) => windows.find((w) => w.id === id)).filter((w) => !!w) : []

  return (
    <AnimatePresence>
      {switcher && items.length > 0 && (
        <motion.div
          key="switcher"
          data-switcher
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.08 }}
          className="pointer-events-none absolute inset-0 z-[9700] grid place-items-center"
        >
          <div className="panel pointer-events-auto max-w-[92%] p-0">
            <div className="flex overflow-x-auto">
              {switcher.ids.map((id, i) => {
                const win = windows.find((w) => w.id === id)
                const app = win && apps[win.appId]
                if (!win || !app) return null
                const selected = i === switcher.index
                return (
                  <button
                    key={id}
                    data-switcher-item={id}
                    data-selected={selected}
                    data-minimized={win.minimized}
                    onClick={() => { useUi.getState().setSwitcher(null); useWindows.getState().focus(id) }}
                    className={`flex w-32 shrink-0 flex-col items-center gap-2 border-r border-rule-soft px-3 pb-3 pt-4 transition-colors last:border-r-0 ${
                      selected ? 'bg-ink text-paper shadow-[inset_0_-3px_0_var(--accent)]' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className={`grid size-14 place-items-center border ${win.minimized ? 'border-dashed' : ''} ${selected ? 'border-paper/60' : 'border-ink'}`}>
                      <app.icon size={26} strokeWidth={1.3} />
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-semibold uppercase tracking-[0.08em]">{app.name}</span>
                    <span className={`w-full truncate text-center text-[10.5px] ${selected ? 'text-paper/70' : 'text-white/60'}`}>
                      {win.minimized ? 'Minimized' : win.title}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between border-t border-ink px-4 py-1.5 font-mono text-[10px] text-white/65">
              <span>{String(switcher.index + 1).padStart(2, '0')} / {String(switcher.ids.length).padStart(2, '0')}</span>
              <span>Release Alt to switch · Esc to cancel</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
