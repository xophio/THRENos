import { useSettings } from '../../store/settingsStore'
import { useClock } from '../../hooks/useClock'
import { useScreen, useWorkArea } from '../../utils/screen'

const MARGIN = 24

/** ISO-8601 week number. */
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Editorial time-and-date block anchored to the top-right of the work area. */
export function DesktopClock() {
  const now = useClock()
  const h24 = useSettings((s) => s.clock24h)
  const area = useWorkArea()
  const screenW = useScreen((s) => s.w)

  const parts = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', hour12: !h24 })
    .formatToParts(now)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? ''
  const minute = parts.find((p) => p.type === 'minute')?.value ?? ''
  const period = parts.find((p) => p.type === 'dayPeriod')?.value

  return (
    <div
      data-desktop-clock
      className="tile pointer-events-none absolute w-[300px] max-w-[calc(100%-48px)] select-none"
      style={{ right: screenW - (area.x + area.w) + MARGIN, top: area.y + MARGIN }}
    >
      <div className="flex items-center justify-between border-b border-ink px-4 py-2">
        <span className="kicker !text-ink">THRENos</span>
        <span className="kicker">Week {isoWeek(now)}</span>
      </div>
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[84px] font-bold leading-[0.85] tracking-[-0.06em] tabular-nums">
            {hour}<span className="text-[var(--accent)]">:</span>{minute}
          </div>
          {period && <span className="kicker !text-ink">{period}</span>}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-rule-soft pt-2">
          <span className="text-[15px] font-semibold tracking-tight">
            {now.toLocaleDateString([], { weekday: 'long' })}
          </span>
          <span className="text-[12px] text-white/70">
            {now.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  )
}
