import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  ArrowDownUp, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, ClipboardPaste, Copy, FilePlus, FolderPlus,
  Info, LayoutGrid, List, Pencil, Scissors, Search, Trash2, X,
} from 'lucide-react'
import { ContextMenu } from '../../components/shared/ContextMenu'
import type { MenuItem } from '../../components/shared/ContextMenu'
import { useExplorerPrefs } from '../../store/explorerStore'
import type { SortKey } from '../../store/explorerStore'
import { HOME } from '../../utils/path'
import type { Explorer } from './useExplorer'

export const SORT_LABELS: Record<SortKey, string> = { name: 'Name', modified: 'Date modified', size: 'Size', type: 'Type' }

export function sortMenuItems(): MenuItem[] {
  const { sortKey, sortDir, setSort } = useExplorerPrefs.getState()
  return (Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
    label: SORT_LABELS[k],
    hint: sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : undefined,
    onClick: () => setSort(k),
  }))
}

const btn = 'ibtn grid size-8 shrink-0 place-items-center disabled:pointer-events-none'

function Breadcrumbs({ ex }: { ex: Explorer }) {
  const parts = ex.cwd.split('/').filter(Boolean)
  const crumbs = [{ name: '/', path: '/' }, ...parts.map((p, i) => ({ name: p, path: '/' + parts.slice(0, i + 1).join('/') }))]
  return (
    <div className="field flex min-w-0 flex-1 items-center overflow-x-auto px-1.5 py-1 text-[12px]">
      {crumbs.map((c, i) => (
        <span key={c.path} className="flex shrink-0 items-center">
          {i > 0 && <ChevronRight size={12} className="text-white/55" />}
          <button
            onClick={() => ex.go(c.path)}
            className={`px-1.5 py-0.5 hover:bg-ink hover:text-paper ${c.path === ex.cwd ? 'font-semibold' : 'text-white/60'}`}
          >
            {c.path === HOME ? '~' : c.name}
          </button>
        </span>
      ))}
    </div>
  )
}

export function Toolbar({ ex }: { ex: Explorer }) {
  const { view, setView } = useExplorerPrefs()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const hasSel = ex.selected.length > 0

  const openSort = (e: MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.left, y: r.bottom + 4 })
  }

  return (
    <div onPointerDown={(e) => e.stopPropagation()} className="border-b border-ink">
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <button className={btn} disabled={!ex.canBack} onClick={ex.back} aria-label="Back"><ArrowLeft size={16} /></button>
        <button className={btn} disabled={!ex.canForward} onClick={ex.forward} aria-label="Forward"><ArrowRight size={16} /></button>
        <button className={btn} disabled={ex.cwd === '/'} onClick={ex.up} aria-label="Up"><ArrowUp size={16} /></button>
        <Breadcrumbs ex={ex} />
        <div className="relative w-40 shrink-0 max-sm:w-28">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/55" />
          <input
            id="explorer-search"
            value={ex.query}
            onChange={(e) => ex.setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { ex.setQuery(''); e.currentTarget.blur() } }}
            placeholder="Search"
            className="field w-full py-1.5 pl-8 pr-7 text-[12px]"
          />
          {ex.query && (
            <button aria-label="Clear search" onClick={() => ex.setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-[var(--accent)]">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1">
        <button className={btn} onClick={() => ex.create('file')} aria-label="New file" title="New file (Ctrl+N)"><FilePlus size={16} /></button>
        <button className={btn} onClick={() => ex.create('folder')} aria-label="New folder" title="New folder (Ctrl+Shift+N)"><FolderPlus size={16} /></button>
        <div className="mx-1 h-5 w-px bg-rule" />
        <button className={btn} disabled={!hasSel} onClick={() => ex.cut()} aria-label="Cut" title="Cut (Ctrl+X)"><Scissors size={15} /></button>
        <button className={btn} disabled={!hasSel} onClick={() => ex.copy()} aria-label="Copy" title="Copy (Ctrl+C)"><Copy size={15} /></button>
        <button className={btn} disabled={!ex.clipboard.mode} onClick={ex.paste} aria-label="Paste" title="Paste (Ctrl+V)"><ClipboardPaste size={15} /></button>
        <button className={btn} disabled={ex.selected.length !== 1} onClick={() => ex.startRename()} aria-label="Rename" title="Rename (F2)"><Pencil size={15} /></button>
        <button className={btn} disabled={!hasSel} onClick={() => ex.requestDelete()} aria-label="Delete" title="Delete (Del)"><Trash2 size={15} /></button>
        <button className={btn} onClick={() => ex.showProperties()} aria-label="Properties" title="Properties"><Info size={15} /></button>
        <div className="flex-1" />
        <button className={btn} onClick={openSort} aria-label="Sort" title="Sort"><ArrowDownUp size={15} /></button>
        <button
          className={btn}
          onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
          aria-label={view === 'grid' ? 'List view' : 'Grid view'}
          title={view === 'grid' ? 'List view' : 'Grid view'}
        >
          {view === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
        </button>
      </div>
      {menu && <ContextMenu {...menu} items={sortMenuItems()} onClose={() => setMenu(null)} />}
    </div>
  )
}
