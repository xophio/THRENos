import { useEffect, useMemo, useRef, useState } from 'react'
import { Flag, Pause, Play, RotateCcw, X } from 'lucide-react'
import type { AppProps } from '../../types'
import { useAppState } from '../../os/appData'
import { useAppCapabilities } from '../../os/permissions'
import { useClock } from '../../hooks/useClock'
import { playSound } from '../../utils/sound'
import { Segmented } from '../../components/shared/controls'

type Tab = 'world' | 'stopwatch' | 'timer'

const ZONES = [
  ['Europe/Zurich', 'Zurich'], ['Europe/London', 'London'], ['Europe/Reykjavik', 'Reykjavik'], ['America/New_York', 'New York'],
  ['America/Los_Angeles', 'Los Angeles'], ['America/Sao_Paulo', 'São Paulo'], ['Africa/Lagos', 'Lagos'], ['Asia/Dubai', 'Dubai'],
  ['Asia/Singapore', 'Singapore'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney'], ['Pacific/Auckland', 'Auckland'],
] as const

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Wall-clock parts of `date` in an IANA time zone. */
function zoneParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { h: get('hour'), m: get('minute'), s: get('second'), y: get('year'), mo: get('month'), d: get('day') }
}

/** Offset between a zone's wall clock and the local wall clock, in hours, plus the day difference. */
function relative(date: Date, timeZone: string) {
  const a = zoneParts(date, timeZone)
  const b = zoneParts(date)
  const wall = (p: typeof a) => Date.UTC(p.y, p.mo - 1, p.d, p.h, p.m, p.s)
  const diff = (wall(a) - wall(b)) / 3600000
  const dayDiff = Math.round((Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 86400000)
  return { diff, dayDiff }
}

/** Swiss railway-style analog clock: plain ticks, bold hands, red second hand. */
function AnalogClock({ date, timeZone, size = 220 }: { date: Date; timeZone?: string; size?: number }) {
  const { h, m, s } = zoneParts(date, timeZone)
  const ms = date.getMilliseconds()
  const sec = s + ms / 1000
  const min = m + sec / 60
  const hour = (h % 12) + min / 60
  const hand = (angle: number, len: number, w: number, tail = 0) => (
    <line x1={50 - Math.sin((angle * Math.PI) / 180) * tail} y1={50 + Math.cos((angle * Math.PI) / 180) * tail}
      x2={50 + Math.sin((angle * Math.PI) / 180) * len} y2={50 - Math.cos((angle * Math.PI) / 180) * len}
      stroke="currentColor" strokeWidth={w} strokeLinecap="butt" />
  )
  return (
    <svg data-analog viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
      <circle cx="50" cy="50" r="48" fill="var(--paper)" stroke="currentColor" strokeWidth="1.2" />
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0
        const a = (i * 6 * Math.PI) / 180
        const r1 = major ? 38 : 43
        return <line key={i} x1={50 + Math.sin(a) * r1} y1={50 - Math.cos(a) * r1} x2={50 + Math.sin(a) * 46} y2={50 - Math.cos(a) * 46} stroke="currentColor" strokeWidth={major ? 1.8 : 0.5} />
      })}
      {hand(hour * 30, 25, 3.2)}
      {hand(min * 6, 38, 2.2)}
      <g style={{ color: 'var(--accent)' }}>
        {hand(sec * 6, 40, 0.9, 10)}
        <circle cx={50 + Math.sin((sec * 6 * Math.PI) / 180) * 28} cy={50 - Math.cos((sec * 6 * Math.PI) / 180) * 28} r="3.2" fill="currentColor" />
      </g>
      <circle cx="50" cy="50" r="1.6" fill="currentColor" />
    </svg>
  )
}

function WorldClock({ appId }: { appId: string }) {
  const now = useClock()
  const [cities, setCities] = useAppState<string[]>(appId, 'cities', ['Europe/Zurich', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney'])
  const available = ZONES.filter(([id]) => !cities.includes(id))
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="flex h-full max-md:flex-col">
      <div className="flex w-[300px] shrink-0 flex-col items-center justify-center gap-5 border-r border-ink p-6 max-md:w-full max-md:border-b max-md:border-r-0">
        <AnalogClock date={now} />
        <div className="text-center">
          <div data-clock-digital className="text-[44px] font-bold leading-none tracking-[-0.05em] tabular-nums">
            {pad(now.getHours())}:{pad(now.getMinutes())}<span className="text-[24px] font-medium text-white/55">:{pad(now.getSeconds())}</span>
          </div>
          <div className="mt-2 text-[12px] text-white/65">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="kicker mt-2">{local}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-ink px-6 py-3">
          <span className="kicker !text-ink">World clock</span>
          <select
            aria-label="Add city"
            value=""
            disabled={available.length === 0}
            onChange={(e) => { if (e.target.value) setCities([...cities, e.target.value]) }}
            className="field px-2 py-1 text-[12px]"
          >
            <option value="">Add city…</option>
            {available.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {cities.length === 0 && <div className="px-6 py-8 text-[13px] text-white/60">No cities. Add one to compare times.</div>}
          {cities.map((id) => {
            const name = ZONES.find(([z]) => z === id)?.[1] ?? id
            const p = zoneParts(now, id)
            const { diff, dayDiff } = relative(now, id)
            const night = p.h < 6 || p.h >= 19
            return (
              <div key={id} data-world-city={id} className="group grid grid-cols-[1fr_auto_32px] items-center gap-4 border-b border-rule-soft px-6 py-3.5">
                <div>
                  <div className="text-[15px] font-bold tracking-[-0.02em]">{name}</div>
                  <div className="mt-0.5 text-[11.5px] text-white/60">
                    {dayDiff === 0 ? 'Today' : dayDiff > 0 ? 'Tomorrow' : 'Yesterday'}
                    {' · '}{diff === 0 ? 'Same time' : `${diff > 0 ? '+' : ''}${diff % 1 ? diff.toFixed(1) : diff} h`}
                    {' · '}{night ? 'Night' : 'Day'}
                  </div>
                </div>
                <div className="font-mono text-[24px] font-medium tabular-nums tracking-tight">{pad(p.h)}:{pad(p.m)}</div>
                <button aria-label={`Remove ${name}`} onClick={() => setCities(cities.filter((c) => c !== id))} className="ibtn grid size-7 place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100"><X size={14} /></button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const fmtStopwatch = (ms: number) => {
  const cs = Math.floor(ms / 10) % 100
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000)
  return `${pad(m)}:${pad(s)}.${pad(cs)}`
}

function Stopwatch() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [laps, setLaps] = useState<number[]>([])
  const base = useRef(0)

  useEffect(() => {
    if (!running) return
    const start = performance.now() - base.current
    const id = setInterval(() => { base.current = performance.now() - start; setElapsed(base.current) }, 30)
    return () => clearInterval(id)
  }, [running])

  const reset = () => { setRunning(false); base.current = 0; setElapsed(0); setLaps([]) }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b-2 border-ink px-8 py-8">
        <div className="kicker">Stopwatch</div>
        <div data-stopwatch className="mt-3 text-[84px] font-bold leading-[0.85] tracking-[-0.06em] tabular-nums">{fmtStopwatch(elapsed)}</div>
        <div className="mt-6 flex gap-2">
          <button data-action="sw-toggle" onClick={() => setRunning(!running)} className="accent-bg flex w-28 items-center justify-center gap-2 py-2 text-[12.5px] font-semibold">
            {running ? <><Pause size={14} /> Stop</> : <><Play size={14} /> Start</>}
          </button>
          <button data-action="sw-lap" disabled={!running} onClick={() => setLaps((l) => [elapsed, ...l])} className="flex w-24 items-center justify-center gap-2 border border-ink py-2 text-[12.5px] font-semibold hover-invert disabled:opacity-35">
            <Flag size={13} /> Lap
          </button>
          <button data-action="sw-reset" onClick={reset} className="flex w-24 items-center justify-center gap-2 border border-ink py-2 text-[12.5px] font-semibold hover-invert">
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {laps.length === 0 && <div className="px-8 py-5 text-[12.5px] text-white/60">Laps appear here.</div>}
        {laps.map((t, i) => (
          <div key={i} data-lap className="grid grid-cols-[48px_1fr_1fr] gap-3 border-b border-rule-soft px-8 py-2 font-mono text-[12.5px] tabular-nums">
            <span className="text-white/50">{pad(laps.length - i)}</span>
            <span>{fmtStopwatch(t - (laps[i + 1] ?? 0))}</span>
            <span className="text-right text-white/65">{fmtStopwatch(t)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Timer({ appId }: { appId: string }) {
  const caps = useAppCapabilities(appId)
  const [seconds, setSeconds] = useAppState(appId, 'timerSeconds', 300)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const endsAt = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - performance.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        setRunning(false)
        if (caps.can('audio')) playSound('notify', true)
        caps.notify('Timer finished', `${fmtTimer(seconds)} elapsed`)
      }
    }, 200)
    return () => clearInterval(id)
  }, [running, caps, seconds])

  const shown = remaining ?? seconds
  const start = () => {
    const from = remaining && remaining > 0 ? remaining : seconds
    endsAt.current = performance.now() + from * 1000
    setRemaining(from)
    setRunning(true)
  }
  const reset = () => { setRunning(false); setRemaining(null) }
  const preset = (s: number) => { setSeconds(s); reset() }
  const done = remaining === 0
  const progress = remaining === null ? 0 : 1 - remaining / Math.max(1, seconds)

  return (
    <div className="flex h-full flex-col px-8 py-8">
      <div className="kicker">Timer</div>
      <div data-timer className={`mt-3 text-[84px] font-bold leading-[0.85] tracking-[-0.06em] tabular-nums ${done ? 'text-signal' : ''}`}>{fmtTimer(shown)}</div>
      <div className="mt-5 h-[3px] w-full max-w-xl bg-rule-soft"><div className="h-full bg-[var(--accent)]" style={{ width: `${progress * 100}%` }} /></div>
      <div className="mt-6 flex gap-2">
        {running ? (
          <button data-action="timer-pause" onClick={() => setRunning(false)} className="accent-bg flex w-28 items-center justify-center gap-2 py-2 text-[12.5px] font-semibold"><Pause size={14} /> Pause</button>
        ) : (
          <button data-action="timer-start" onClick={start} disabled={seconds === 0} className="accent-bg flex w-28 items-center justify-center gap-2 py-2 text-[12.5px] font-semibold disabled:opacity-40"><Play size={14} /> {remaining && remaining > 0 ? 'Resume' : 'Start'}</button>
        )}
        <button data-action="timer-reset" onClick={reset} className="flex w-24 items-center justify-center gap-2 border border-ink py-2 text-[12.5px] font-semibold hover-invert"><RotateCcw size={13} /> Reset</button>
      </div>
      <div className="mt-8 border-t border-ink pt-3">
        <div className="kicker mb-3">Duration</div>
        <div className="flex flex-wrap items-center gap-2">
          {[[60, '1 min'], [300, '5 min'], [600, '10 min'], [1500, '25 min']].map(([s, label]) => (
            <button key={s} onClick={() => preset(s as number)} className={`border border-ink px-3 py-1.5 text-[12px] font-semibold ${seconds === s ? 'bg-ink text-paper' : 'hover-invert'}`}>{label}</button>
          ))}
          <label className="ml-2 flex items-center gap-2 text-[12px] text-white/70">
            Minutes
            <input
              aria-label="Timer minutes"
              type="number" min={0} max={999}
              value={Math.floor(seconds / 60)}
              onChange={(e) => preset(Math.max(0, Math.min(999, Math.floor(+e.target.value || 0))) * 60)}
              className="field w-16 px-2 py-1 font-mono text-[12.5px]"
            />
          </label>
        </div>
      </div>
    </div>
  )
}

const fmtTimer = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`

export function ClockApp({ appId }: AppProps) {
  const [tab, setTab] = useAppState<Tab>(appId, 'tab', 'world')
  const options = useMemo(() => [
    { value: 'world' as const, label: 'World clock' },
    { value: 'stopwatch' as const, label: 'Stopwatch' },
    { value: 'timer' as const, label: 'Timer' },
  ], [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink px-5 py-2.5">
        <Segmented label="Clock view" value={tab} options={options} onChange={setTab} />
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'world' && <WorldClock appId={appId} />}
        {tab === 'stopwatch' && <Stopwatch />}
        {tab === 'timer' && <Timer appId={appId} />}
      </div>
    </div>
  )
}
