import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { AppProps } from '../types'
import { run } from './terminal/commands'
import { commonPrefix, complete } from './terminal/complete'
import { Highlight } from './terminal/Highlight'
import { useSettings } from '../store/settingsStore'
import { useTerminalHistory } from '../store/terminalStore'
import { useWindows } from '../store/windowStore'
import { HOME, displayPath } from '../utils/path'

type Entry =
  | { type: 'cmd'; prompt: string; text: string }
  | { type: 'out' | 'err'; text: string }

// Show just the last path segment, like a shell completion list.
const listLabel = (c: string) => c.replace(/\\(.)/g, '$1').match(/[^/]*\/?$/)?.[0] ?? c

const WELCOME: Entry = { type: 'out', text: 'THRENos terminal — type "help" for commands.' }

export function Terminal({ windowId }: AppProps) {
  const username = useSettings((s) => s.username)
  const history = useTerminalHistory((s) => s.history)
  const pushHistory = useTerminalHistory((s) => s.push)
  const [entries, setEntries] = useState<Entry[]>([WELCOME])
  const [cwd, setCwd] = useState(HOME)
  const [input, setInput] = useState('')
  const [cursor, setCursor] = useState(-1)
  const draft = useRef('')
  const lastCode = useRef(0)
  const lastTab = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView() }, [entries, input])

  const promptStr = `${username}@threnos:${displayPath(cwd)}$`

  const edit = (value: string) => {
    setInput(value)
    lastTab.current = null
  }

  const submit = () => {
    const line = input
    const cmdEntry: Entry = { type: 'cmd', prompt: promptStr, text: line }
    setCursor(-1)
    draft.current = ''
    edit('')
    if (!line.trim()) { setEntries((e) => [...e, cmdEntry]); return }

    pushHistory(line)
    const res = run(line, cwd, lastCode.current)
    lastCode.current = res.code
    setCwd(res.cwd)
    setEntries((e) => [
      ...(res.clear ? [] : [...e, cmdEntry]),
      ...res.lines.map((l): Entry => ({ type: l.kind, text: l.text })),
    ])
    if (res.exit) useWindows.getState().close(windowId)
  }

  const navigateHistory = (dir: -1 | 1) => {
    if (!history.length) return
    if (cursor < 0) {
      if (dir === 1) return
      draft.current = input
    }
    const next = cursor < 0 ? history.length - 1 : cursor + dir
    if (next < 0) return
    if (next >= history.length) { setCursor(-1); edit(draft.current); return }
    setCursor(next)
    edit(history[next])
  }

  const tab = () => {
    const { from, candidates } = complete(input, cwd)
    if (!candidates.length) return
    const current = input.slice(from)
    const prefix = commonPrefix(candidates)
    if (candidates.length === 1) {
      const only = candidates[0]
      edit(input.slice(0, from) + only + (only.endsWith('/') ? '' : ' '))
    } else if (prefix.length > current.length) {
      edit(input.slice(0, from) + prefix)
    } else if (lastTab.current === input) {
      setEntries((e) => [
        ...e,
        { type: 'cmd', prompt: promptStr, text: input },
        { type: 'out', text: candidates.map(listLabel).join('  ') },
      ])
    } else {
      lastTab.current = input
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit()
    else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory(1) }
    else if (e.key === 'Tab') { e.preventDefault(); tab() }
    else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setEntries([]) }
    else if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); edit('') }
    else if (e.ctrlKey && e.key.toLowerCase() === 'c' && inputRef.current?.selectionStart === inputRef.current?.selectionEnd) {
      e.preventDefault()
      setEntries((en) => [...en, { type: 'cmd', prompt: promptStr, text: input + '^C' }])
      setCursor(-1)
      edit('')
    }
  }

  const syncScroll = () => {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft
  }

  return (
    <div
      className="selectable dark-scope h-full overflow-auto p-4 font-mono text-[13px] leading-relaxed"
      onClick={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus() }}
    >
      {entries.map((l, i) =>
        l.type === 'cmd' ? (
          <div key={i} className="whitespace-pre-wrap break-words">
            <span className="font-semibold text-signal">{l.prompt} </span>
            <Highlight text={l.text} />
          </div>
        ) : (
          <div key={i} className={`min-h-[1.4em] whitespace-pre-wrap break-words ${l.type === 'err' ? 'text-signal' : 'text-white/90'}`}>{l.text}</div>
        ),
      )}
      <div className="flex">
        <span className="mr-2 shrink-0 font-semibold text-signal">{promptStr}</span>
        <div className="relative min-w-0 flex-1">
          <div ref={mirrorRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre">
            <Highlight text={input} />
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setCursor(-1); edit(e.target.value) }}
            onKeyDown={onKey}
            onScroll={syncScroll}
            onKeyUp={syncScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            className="relative w-full bg-transparent text-transparent caret-[var(--accent)] outline-none selection:bg-white/20"
          />
        </div>
      </div>
      <div ref={endRef} />
    </div>
  )
}
