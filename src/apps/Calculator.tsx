import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete } from 'lucide-react'
import type { AppProps } from '../types'

type Op = '+' | '−' | '×' | '÷'

const compute = (a: number, b: number, op: Op) =>
  op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b

const fmt = (v: string) => {
  if (v === 'Error') return v
  const [int, dec] = v.split('.')
  const neg = int.startsWith('-')
  const grouped = (neg ? int.slice(1) : int).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '-' : '') + grouped + (dec !== undefined ? '.' + dec : '')
}

const KEYS: { label: string; kind: 'num' | 'op' | 'fn' | 'eq' }[] = [
  { label: 'C', kind: 'fn' }, { label: '±', kind: 'fn' }, { label: '%', kind: 'fn' }, { label: '÷', kind: 'op' },
  { label: '7', kind: 'num' }, { label: '8', kind: 'num' }, { label: '9', kind: 'num' }, { label: '×', kind: 'op' },
  { label: '4', kind: 'num' }, { label: '5', kind: 'num' }, { label: '6', kind: 'num' }, { label: '−', kind: 'op' },
  { label: '1', kind: 'num' }, { label: '2', kind: 'num' }, { label: '3', kind: 'num' }, { label: '+', kind: 'op' },
  { label: '0', kind: 'num' }, { label: '.', kind: 'num' }, { label: '⌫', kind: 'fn' }, { label: '=', kind: 'eq' },
]

export function Calculator(_: AppProps) {
  const [display, setDisplay] = useState('0')
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [fresh, setFresh] = useState(true)
  const root = useRef<HTMLDivElement>(null)

  const press = useCallback(
    (k: string) => {
      const err = display === 'Error'
      if (/^\d$/.test(k)) {
        setDisplay(fresh || err || display === '0' ? k : display.length < 14 ? display + k : display)
        setFresh(false)
      } else if (k === '.') {
        if (fresh || err) { setDisplay('0.'); setFresh(false) }
        else if (!display.includes('.')) setDisplay(display + '.')
      } else if (k === 'C') {
        setDisplay('0'); setAcc(null); setOp(null); setFresh(true)
      } else if (k === '⌫') {
        if (!fresh && !err) setDisplay(display.length > 1 && display !== '-0' ? display.slice(0, -1) : '0')
      } else if (k === '±') {
        if (!err && display !== '0') setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display)
      } else if (k === '%') {
        if (!err) setDisplay(String(parseFloat(display) / 100))
      } else if (k === '=' || ['+', '−', '×', '÷'].includes(k)) {
        if (err) return
        const cur = parseFloat(display)
        let next = cur
        if (acc !== null && op && !fresh) {
          next = compute(acc, cur, op)
          if (!Number.isFinite(next)) {
            setDisplay('Error'); setAcc(null); setOp(null); setFresh(true)
            return
          }
          next = parseFloat(next.toPrecision(12))
          setDisplay(String(next))
        }
        if (k === '=') { setAcc(null); setOp(null) }
        else { setAcc(next); setOp(k as Op) }
        setFresh(true)
      }
    },
    [display, acc, op, fresh],
  )

  useEffect(() => {
    const id = requestAnimationFrame(() => root.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = { '*': '×', '/': '÷', '-': '−', Enter: '=', Backspace: '⌫', Escape: 'C' }
      const k = map[e.key] ?? e.key
      if (/^[\d.+=%]$/.test(k) || ['×', '÷', '−', '⌫', 'C'].includes(k)) {
        e.preventDefault()
        press(k)
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [press])

  return (
    <div ref={root} tabIndex={0} onPointerDown={() => root.current?.focus()} className="flex h-full flex-col outline-none">
      <div className="flex min-h-[104px] flex-col items-end justify-end border-b border-ink px-5 pb-3 pt-4">
        <div className="h-4 font-mono text-[11px] text-white/60">{acc !== null && op ? `${fmt(String(acc))} ${op}` : ''}</div>
        <div data-calc-display className="max-w-full truncate text-[44px] font-bold leading-none tracking-[-0.05em] tabular-nums">{fmt(display)}</div>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-px bg-ink">
        {KEYS.map((k) => (
          <button
            key={k.label}
            onClick={() => press(k.label)}
            className={`grid place-items-center text-[18px] font-medium transition-colors ${
              k.kind === 'eq'
                ? 'accent-bg hover:opacity-90'
                : k.kind === 'op'
                  ? `bg-paper hover:bg-ink hover:text-paper ${op === k.label && fresh ? '!bg-ink !text-paper' : ''}`
                  : k.kind === 'fn'
                    ? 'bg-sidebar text-white/75 hover:bg-ink hover:text-paper'
                    : 'bg-surface hover:bg-ink hover:text-paper'
            }`}
          >
            {k.label === '⌫' ? <Delete size={18} /> : k.label}
          </button>
        ))}
      </div>
    </div>
  )
}
