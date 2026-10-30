import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Power, Search } from 'lucide-react'
import { popupStyle, slideOffset, useScreen } from '../../utils/screen'
import { useRegisteredApps } from '../../os/registry'
import { launchApp } from '../../os/lifecycle'
import { useUi } from '../../store/uiStore'
import { useSettings } from '../../store/settingsStore'

function Panel() {
  const appList = useRegisteredApps()
  const setStart = useUi((s) => s.setStart)
  const username = useSettings((s) => s.username)
  const position = useSettings((s) => s.taskbarPosition)
  const screen = useScreen()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? appList.filter((a) => (a.name + ' ' + a.description + ' ' + a.category).toLowerCase().includes(t)) : appList
  }, [q, appList])

  const launch = (i: number) => {
    const app = results[i]
    if (!app) return
    launchApp(app.id)
    setStart(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 0, y: 0, ...slideOffset(position, 10) }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 0, y: 0, ...slideOffset(position, 10) }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      data-start-menu
      className="panel fixed z-[9400] flex flex-col"
      style={{
        ...popupStyle(position, 'start'),
        width: Math.min(360, screen.w - 16),
        maxHeight: Math.min(560, screen.h - 80),
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-baseline justify-between border-b border-ink px-4 pb-2 pt-3">
        <span className="text-[22px] font-bold leading-none tracking-[-0.04em]">Orbit<span className="text-[var(--accent)]">.</span></span>
        <span className="kicker">{q ? `${results.length} found` : 'Applications'}</span>
      </div>
      <div className="flex items-center gap-2.5 border-b border-rule px-4 py-2.5">
        <Search size={14} strokeWidth={1.5} className="text-white/60" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') launch(sel)
            else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
          }}
          placeholder="Search apps"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/60"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {results.map((a, i) => (
          <button
            key={a.id}
            onClick={() => launch(i)}
            onMouseEnter={() => setSel(i)}
            className={`flex w-full items-center gap-3 border-b border-rule-soft px-4 py-2.5 text-left transition-colors ${
              i === sel ? 'bg-ink text-paper' : ''
            }`}
          >
            <span className={`w-5 font-mono text-[10px] ${i === sel ? 'text-paper/70' : 'text-white/60'}`}>{String(i + 1).padStart(2, '0')}</span>
            <a.icon size={16} strokeWidth={1.5} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold uppercase tracking-[0.06em]">{a.name}</div>
              <div className={`truncate text-[11.5px] ${i === sel ? 'text-paper/70' : 'text-white/60'}`}>{a.description}</div>
            </div>
          </button>
        ))}
        {results.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-white/55">No apps match “{q}”</div>}
      </div>
      <div className="flex items-center justify-between border-t border-ink px-4 py-2.5">
        <div className="flex items-center gap-2.5 text-[12px] font-medium">
          <span className="grid size-6 place-items-center bg-[var(--accent)] text-[11px] font-bold text-on-accent">
            {username.slice(0, 1).toUpperCase() || '?'}
          </span>
          {username}
        </div>
        <button aria-label="Reload ORBIT" title="Restart" onClick={() => location.reload()} className="ibtn grid size-7 place-items-center">
          <Power size={14} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  )
}

export function StartMenu() {
  const open = useUi((s) => s.startOpen)
  return <AnimatePresence>{open && <Panel />}</AnimatePresence>
}
