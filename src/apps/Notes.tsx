import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { AppProps } from '../types'
import { useNotes } from '../store/notesStore'

export function Notes(_: AppProps) {
  const { notes, create, update, remove } = useNotes()
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id ?? null)
  const active = notes.find((n) => n.id === activeId) ?? notes[0]

  const add = () => setActiveId(create())
  const del = (id: string) => {
    remove(id)
    if (id === activeId) setActiveId(null)
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink bg-sidebar">
        <div className="flex items-center justify-between border-b border-ink px-4 py-2.5">
          <span className="kicker !text-ink">Notes</span>
          <span className="font-mono text-[10.5px] text-white/60">{String(notes.length).padStart(2, '0')}</span>
        </div>
        <button onClick={add} className="accent-bg flex items-center justify-center gap-2 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] hover:opacity-90">
          <Plus size={14} /> New note
        </button>
        <div className="flex-1 overflow-auto">
          {notes.map((n, i) => {
            const on = n.id === active?.id
            return (
              <div
                key={n.id}
                onClick={() => setActiveId(n.id)}
                className={`group flex cursor-pointer items-start gap-3 border-b border-rule-soft px-4 py-3 ${on ? 'bg-ink text-paper' : 'hover:bg-white/[0.07]'}`}
              >
                <span className={`pt-0.5 font-mono text-[10px] ${on ? 'text-paper/70' : 'text-white/55'}`}>{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{n.title || 'Untitled'}</div>
                  <div className={`truncate text-[11.5px] ${on ? 'text-paper/70' : 'text-white/60'}`}>{n.body.split('\n')[0] || 'Empty'}</div>
                </div>
                <button
                  aria-label="Delete note"
                  onClick={(e) => { e.stopPropagation(); del(n.id) }}
                  className={`hidden group-hover:block ${on ? 'text-paper/80 hover:text-paper' : 'text-white/60 hover:text-signal'}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </aside>
      {active ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            value={active.title}
            onChange={(e) => update(active.id, { title: e.target.value })}
            placeholder="Title"
            className="border-b border-ink bg-transparent px-6 pb-3 pt-5 text-[30px] font-bold leading-none tracking-[-0.045em] outline-none placeholder:text-white/35"
          />
          <textarea
            value={active.body}
            onChange={(e) => update(active.id, { body: e.target.value })}
            placeholder="Start writing…"
            className="flex-1 resize-none bg-transparent px-6 py-4 text-[14px] leading-[1.65] outline-none placeholder:text-white/40"
          />
          <div className="flex justify-between border-t border-ink px-6 py-1.5 font-mono text-[10.5px] text-white/65">
            <span>Saved {new Date(active.updated).toLocaleTimeString()}</span>
            <span>{active.body.length} chars</span>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center text-[13px] text-white/60">No note selected</div>
      )}
    </div>
  )
}
