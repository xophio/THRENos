import { AnimatePresence, motion } from 'motion/react'
import { Trash2, Volume2, VolumeX } from 'lucide-react'
import { useUi } from '../../store/uiStore'
import { useSettings } from '../../store/settingsStore'
import { useNotifications } from '../../store/notificationStore'
import { popupStyle, slideOffset } from '../../utils/screen'
import { playSound } from '../../utils/sound'

const panelCls = 'panel fixed z-[9400]'

function usePanelMotion() {
  const position = useSettings((s) => s.taskbarPosition)
  const offset = slideOffset(position, 10)
  return {
    initial: { opacity: 0, x: 0, y: 0, ...offset },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 0, y: 0, ...offset },
    transition: { duration: 0.12 },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    style: popupStyle(position, 'end'),
  }
}

function VolumePanel() {
  const { volume, muted, set } = useSettings()
  const motionProps = usePanelMotion()
  return (
    <motion.div {...motionProps} data-tray="volume" className={`${panelCls} w-64`}>
      <div className="border-b border-ink px-4 py-2"><span className="kicker !text-ink">Volume</span></div>
      <div className="flex items-center gap-3 px-4 py-4">
        <button onClick={() => set({ muted: !muted })} aria-label="Mute" className="ibtn grid size-7 place-items-center">
          {muted || volume === 0 ? <VolumeX size={16} strokeWidth={1.5} /> : <Volume2 size={16} strokeWidth={1.5} />}
        </button>
        <input
          type="range" min={0} max={100}
          value={muted ? 0 : volume}
          onChange={(e) => set({ volume: +e.target.value, muted: false })}
          onPointerUp={() => playSound('click')}
          className="flex-1"
        />
        <span className="w-8 text-right font-mono text-[12px] tabular-nums text-white/70">{muted ? 0 : volume}</span>
      </div>
    </motion.div>
  )
}

function NotificationPanel() {
  const { history, clear } = useNotifications()
  const motionProps = usePanelMotion()
  return (
    <motion.div {...motionProps} data-tray="notifications" className={`${panelCls} w-80 max-w-[calc(100%-16px)]`}>
      <div className="flex items-center justify-between border-b border-ink px-4 py-2">
        <span className="kicker !text-ink">Notifications</span>
        {history.length > 0 && (
          <button onClick={clear} className="flex items-center gap-1 text-[11px] font-medium text-white/70 underline-offset-2 hover:text-[var(--accent)] hover:underline">
            <Trash2 size={11} strokeWidth={1.5} /> Clear
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-auto">
        {history.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-white/55">You’re all caught up</div>}
        {history.map((n) => (
          <div key={n.id} className="border-b border-rule-soft px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold">{n.title}</span>
              <span className="font-mono text-[10px] text-white/60">{new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {n.body && <div className="mt-0.5 text-[12px] text-white/65">{n.body}</div>}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function TrayPanels() {
  const tray = useUi((s) => s.tray)
  return (
    <AnimatePresence mode="wait">
      {tray === 'volume' && <VolumePanel key="v" />}
      {tray === 'notifications' && <NotificationPanel key="n" />}
    </AnimatePresence>
  )
}
