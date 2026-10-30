import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import type { AppProps } from '../../types'
import { useAppState } from '../../os/appData'
import { useAppCapabilities } from '../../os/permissions'
import { uid } from '../../utils'

interface CalEvent { id: string; date: string; title: string; time: string }

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Six Monday-first weeks covering the month, including the neighbouring days that fill the grid. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i))
}

export function Calendar({ appId }: AppProps) {
  const caps = useAppCapabilities(appId)
  const [events, setEvents] = useAppState<CalEvent[]>(appId, 'events', [])
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(keyOf(today))
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const root = useRef<HTMLDivElement>(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const days = useMemo(() => monthGrid(year, month), [year, month])
  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [events])

  const shift = (delta: number) => setCursor(new Date(year, month + delta, 1))
  const goToday = () => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(keyOf(today)) }

  const selectedDate = parseKey(selected)
  const dayEvents = (byDate.get(selected) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time))

  const add = () => {
    const t = title.trim()
    if (!t) return
    setEvents((prev) => [...prev, { id: uid(), date: selected, title: t, time }])
    setTitle('')
    setTime('')
    caps.notify('Event added', `${t} · ${selectedDate.toLocaleDateString([], { day: 'numeric', month: 'short' })}`)
  }

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    if (e.key === 'ArrowLeft') { e.preventDefault(); shift(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); shift(1) }
  }

  return (
    <div ref={root} tabIndex={-1} onKeyDown={onKey} className="flex h-full outline-none max-md:flex-col">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-end justify-between border-b-2 border-ink px-6 pb-3 pt-5">
          <div>
            <div className="kicker">{year}</div>
            <h2 data-cal-title className="mt-2 text-[34px] font-bold leading-none tracking-[-0.045em]">
              {cursor.toLocaleDateString([], { month: 'long' })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label="Previous month" onClick={() => shift(-1)} className="ibtn grid size-8 place-items-center border border-ink"><ChevronLeft size={15} /></button>
            <button onClick={goToday} className="ibtn h-8 border border-ink px-3 text-[12px] font-semibold">Today</button>
            <button aria-label="Next month" onClick={() => shift(1)} className="ibtn grid size-8 place-items-center border border-ink"><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-ink">
          {WEEKDAYS.map((d) => <div key={d} className="kicker px-2 py-2">{d}</div>)}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px bg-rule-soft">
          {days.map((d) => {
            const k = keyOf(d)
            const inMonth = d.getMonth() === month
            const isSel = k === selected
            const isToday = k === keyOf(today)
            const list = byDate.get(k) ?? []
            return (
              <button
                key={k}
                data-day={k}
                data-in-month={inMonth}
                onClick={() => setSelected(k)}
                onDoubleClick={() => { if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}
                className={`flex min-h-0 flex-col items-start overflow-hidden p-1.5 text-left transition-colors ${
                  isSel ? 'bg-ink text-paper' : 'bg-surface hover:bg-sidebar'
                } ${inMonth ? '' : 'opacity-40'}`}
              >
                <span
                  className={`grid h-5 min-w-5 place-items-center px-1 text-[12px] font-semibold tabular-nums ${
                    isToday ? 'bg-[var(--accent)] text-on-accent' : ''
                  }`}
                >
                  {d.getDate()}
                </span>
                {list.slice(0, 2).map((e) => (
                  <span key={e.id} className={`mt-0.5 w-full truncate text-[10px] ${isSel ? 'text-paper/80' : 'text-white/70'}`}>{e.title}</span>
                ))}
                {list.length > 2 && <span className={`text-[10px] ${isSel ? 'text-paper/70' : 'text-white/55'}`}>+{list.length - 2}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <aside className="flex w-72 shrink-0 flex-col border-l border-ink bg-sidebar max-md:w-full max-md:border-l-0 max-md:border-t">
        <div className="border-b border-ink px-5 pb-3 pt-5">
          <div className="kicker">{selectedDate.toLocaleDateString([], { weekday: 'long' })}</div>
          <div data-cal-selected className="mt-2 text-[56px] font-bold leading-[0.85] tracking-[-0.06em] tabular-nums">{selectedDate.getDate()}</div>
          <div className="mt-2 text-[12.5px] text-white/65">{selectedDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {dayEvents.length === 0 && <div className="px-5 py-6 text-[12.5px] text-white/60">No events on this day.</div>}
          {dayEvents.map((e) => (
            <div key={e.id} data-event={e.id} className="group flex items-start gap-3 border-b border-rule-soft px-5 py-2.5">
              <span className="w-11 shrink-0 pt-0.5 font-mono text-[11px] text-white/60">{e.time || 'All day'}</span>
              <span className="min-w-0 flex-1 break-words text-[13px] font-medium">{e.title}</span>
              <button aria-label={`Delete ${e.title}`} onClick={() => setEvents((prev) => prev.filter((x) => x.id !== e.id))} className="ibtn grid size-6 shrink-0 place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); add() }} className="border-t border-ink p-4">
          <div className="kicker mb-2">New event</div>
          <input
            aria-label="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="field mb-2 w-full px-2.5 py-1.5 text-[13px]"
          />
          <div className="flex gap-2">
            <input aria-label="Event time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field w-28 px-2 py-1.5 text-[12.5px]" />
            <button type="submit" disabled={!title.trim()} className="accent-bg flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold disabled:opacity-40">
              <Plus size={13} /> Add
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
