import { useEffect, useRef, useState } from 'react'
import { Bell, Volume2, VolumeX } from 'lucide-react'
import { TaskbarApps } from './TaskbarApps'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useUi } from '../../store/uiStore'
import { useSettings } from '../../store/settingsStore'
import type { TaskbarPosition } from '../../store/settingsStore'
import { useNotifications } from '../../store/notificationStore'
import { useClock } from '../../hooks/useClock'
import { TASKBAR_SIZE } from '../../utils/screen'

const BAR: Record<TaskbarPosition, string> = {
  bottom: 'inset-x-0 bottom-0 h-[52px] flex-row border-t',
  top: 'inset-x-0 top-0 h-[52px] flex-row border-b',
  left: 'inset-y-0 left-0 w-[52px] flex-col border-r',
  right: 'inset-y-0 right-0 w-[52px] flex-col border-l',
}

const HIDDEN_OFFSET = TASKBAR_SIZE - 3
const HIDE: Record<TaskbarPosition, string> = {
  bottom: `translateY(${HIDDEN_OFFSET}px)`,
  top: `translateY(-${HIDDEN_OFFSET}px)`,
  left: `translateX(-${HIDDEN_OFFSET}px)`,
  right: `translateX(${HIDDEN_OFFSET}px)`,
}

const HOT_ZONE: Record<TaskbarPosition, string> = {
  bottom: 'inset-x-0 bottom-0 h-1.5',
  top: 'inset-x-0 top-0 h-1.5',
  left: 'inset-y-0 left-0 w-1.5',
  right: 'inset-y-0 right-0 w-1.5',
}

function Clock({ vertical }: { vertical: boolean }) {
  const now = useClock()
  const { clock24h, clockSeconds, clockDate } = useSettings()
  const time = now.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: clockSeconds && !vertical ? '2-digit' : undefined, hour12: !clock24h,
  })
  const date = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div
      className={`flex flex-col leading-tight ${vertical ? 'items-center px-0 py-1 text-center' : 'items-end px-3 text-right'}`}
      title={now.toLocaleString()}
    >
      <span className={`font-semibold tabular-nums tracking-tight ${vertical ? 'text-[11px]' : 'text-[14px]'}`}>
        {vertical ? time.replace(/\s?[AP]M$/i, '') : time}
      </span>
      {vertical && !clock24h && <span className="text-[9px] text-white/60">{/[AP]M$/i.exec(time)?.[0]}</span>}
      {clockDate && !vertical && <span className="text-[10.5px] uppercase tracking-[0.08em] text-white/60">{date}</span>}
    </div>
  )
}

export function Taskbar() {
  const startOpen = useUi((s) => s.startOpen)
  const trayOpen = useUi((s) => s.tray !== null)
  const setStart = useUi((s) => s.setStart)
  const setTray = useUi((s) => s.setTray)
  const muted = useSettings((s) => s.muted || s.volume === 0)
  const position = useSettings((s) => s.taskbarPosition)
  const autoHide = useSettings((s) => s.taskbarAutoHide)
  const unread = useNotifications((s) => s.history.length)
  const vertical = position === 'left' || position === 'right'

  const [hover, setHover] = useState(false)
  const timer = useRef<number>(0)
  const reveal = () => { window.clearTimeout(timer.current); setHover(true) }
  const conceal = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setHover(false), 350) }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const shown = !autoHide || hover || startOpen || trayOpen

  const tray = 'ibtn relative grid size-9 shrink-0 place-items-center'
  const divider = vertical ? 'my-1 h-px w-7 shrink-0 bg-rule' : 'mx-1 h-6 w-px shrink-0 bg-rule'

  return (
    <>
      {autoHide && <div data-taskbar-hotzone className={`fixed z-[9499] ${HOT_ZONE[position]}`} onPointerEnter={reveal} />}
      <div
        data-taskbar={position}
        data-shown={shown}
        className={`absolute z-[9500] flex items-center gap-1 border-ink bg-paper p-1.5 transition-transform duration-150 ${BAR[position]}`}
        style={{ transform: shown ? 'none' : HIDE[position] }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerEnter={reveal}
        onPointerLeave={conceal}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          aria-label="Start"
          onClick={() => setStart()}
          className={`group grid size-10 shrink-0 place-items-center rounded-md border border-ink transition-colors ${startOpen ? 'bg-ink' : 'hover:bg-white/10'}`}
        >
          <span className="size-3.5 rounded-full bg-[var(--accent)]" />
        </button>

        <div className={divider} />

        <div className={`flex min-h-0 min-w-0 flex-1 items-center gap-1 ${vertical ? 'flex-col overflow-y-auto' : 'overflow-x-auto'}`}>
          <TaskbarApps vertical={vertical} />
        </div>

        <div className={divider} />

        <WorkspaceSwitcher vertical={vertical} />

        <div className={divider} />

        <div className={`flex shrink-0 items-center gap-0.5 ${vertical ? 'flex-col' : ''}`}>
          <button className={tray} aria-label="Volume" onClick={() => setTray('volume')}>
            {muted ? <VolumeX size={16} strokeWidth={1.5} /> : <Volume2 size={16} strokeWidth={1.5} />}
          </button>
          <button className={tray} aria-label="Notifications" onClick={() => setTray('notifications')}>
            <Bell size={16} strokeWidth={1.5} />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 bg-[var(--accent)]" />}
          </button>
          <Clock vertical={vertical} />
        </div>
      </div>
    </>
  )
}
