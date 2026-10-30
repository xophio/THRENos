import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Home, RotateCw, Search } from 'lucide-react'
import type { AppProps } from '../types'

interface Site { title: string; body: string[] }

// Simulated web: addresses map to built-in pages.
const SITES: Record<string, Site> = {
  'threnos://home': {
    title: 'New Tab',
    body: ['Welcome to THRENos Browser.', 'Try: threnos://about, threnos://news, threnos://docs — or search anything.'],
  },
  'threnos://about': { title: 'About THRENos', body: ['THRENos is a desktop operating system simulated entirely in your browser.', 'Windows, files, notes and settings persist locally.'] },
  'threnos://news': { title: 'THRENos News', body: ['• Window snapping now supports all screen edges.', '• Terminal gained redirects: echo hi > file.txt', '• New accent colors in Settings.'] },
  'threnos://docs': { title: 'Docs', body: ['Shortcuts', 'Ctrl+Space — search', 'Alt+W — close window', 'Alt+M — minimize', 'Alt+←/→/↑ — snap window', 'Alt+T — open terminal'] },
}

const HOME_URL = 'threnos://home'

const resolveInput = (raw: string): string => {
  const v = raw.trim().toLowerCase()
  if (!v) return HOME_URL
  if (SITES[v]) return v
  if (v.startsWith('threnos://')) return v
  return `threnos://search?q=${encodeURIComponent(raw.trim())}`
}

export function Browser(_: AppProps) {
  const [history, setHistory] = useState([HOME_URL])
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState(HOME_URL)
  const [loading, setLoading] = useState(false)
  const url = history[idx]

  const load = (target: string, push: boolean, nextIdx = idx) => {
    setLoading(true)
    setTimeout(() => setLoading(false), 350)
    if (push) {
      setHistory([...history.slice(0, idx + 1), target])
      setIdx(idx + 1)
    } else setIdx(nextIdx)
    setInput(target.startsWith('threnos://search') ? decodeURIComponent(target.split('q=')[1]) : target)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    load(resolveInput(input), true)
  }

  const step = (d: number) => {
    const n = idx + d
    if (n >= 0 && n < history.length) load(history[n], false, n)
  }

  const isSearch = url.startsWith('threnos://search')
  const query = isSearch ? decodeURIComponent(url.split('q=')[1] ?? '') : ''
  const page = SITES[url]
  const btn = 'ibtn grid size-8 place-items-center'

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={submit} className="flex items-center gap-1 border-b border-ink px-2 py-1.5">
        <button type="button" className={btn} disabled={idx === 0} onClick={() => step(-1)} aria-label="Back"><ArrowLeft size={16} /></button>
        <button type="button" className={btn} disabled={idx >= history.length - 1} onClick={() => step(1)} aria-label="Forward"><ArrowRight size={16} /></button>
        <button type="button" className={btn} onClick={() => load(url, false)} aria-label="Reload"><RotateCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        <button type="button" className={btn} onClick={() => load(HOME_URL, true)} aria-label="Home"><Home size={15} /></button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          placeholder="Search or enter address"
          className="field mx-2 flex-1 px-3 py-1.5 font-mono text-[12.5px]"
        />
      </form>
      <div className="relative flex-1 overflow-auto bg-surface">
        {loading && <div className="absolute inset-x-0 top-0 h-[3px] animate-pulse accent-bg" />}
        {!loading && (
          <div className="mx-auto max-w-2xl px-8 py-10">
            {url === HOME_URL && (
              <div className="mb-8 flex flex-col items-center gap-4">
                <h1 className="text-[64px] font-bold leading-none tracking-[-0.065em]">THRENos<span className="text-[var(--accent)]">.</span></h1>
                <span className="kicker">Browser</span>
              </div>
            )}
            {page && (
              <>
                {url !== HOME_URL && <h1 className="mb-5 border-b-2 border-ink pb-3 text-[34px] font-bold leading-none tracking-[-0.05em]">{page.title}</h1>}
                <div className="selectable space-y-2 text-[14px] leading-[1.65] text-white/80">
                  {page.body.map((p, i) => <p key={i}>{p}</p>)}
                </div>
                {url === HOME_URL && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {['about', 'news', 'docs'].map((s) => (
                      <button key={s} onClick={() => load(`threnos://${s}`, true)} className="border border-ink px-3 py-1.5 font-mono text-[12px] hover:bg-ink hover:text-paper">
                        threnos://{s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {isSearch && (
              <>
                <h1 className="mb-1 flex items-center gap-2 text-[22px] font-bold tracking-[-0.03em]"><Search size={18} /> Results for “{query}”</h1>
                <p className="mb-5 text-xs text-white/55">Simulated results — no network access.</p>
                <div className="space-y-4">
                  {['Overview', 'Guide', 'Community'].map((t) => (
                    <div key={t}>
                      <div className="text-xs text-white/55">threnos://{query.toLowerCase().replace(/\s+/g, '-')}/{t.toLowerCase()}</div>
                      <div className="accent-text text-base">{query} — {t}</div>
                      <div className="text-sm text-white/55">A simulated page about {query}. Nothing here is real, but it feels like it.</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!page && !isSearch && (
              <div className="py-16 text-center text-white/60">
                <div className="mb-1 text-[22px] font-bold tracking-[-0.03em] text-ink">This page can’t be reached</div>
                <div className="text-sm">{url} is not a known address.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
