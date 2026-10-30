import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import {
  ArrowLeft, ClipboardPaste, Copy, ExternalLink, FilePlus, Folder, FolderPlus, HardDrive, Home, Info,
  MousePointer2, Pencil, Save, Scissors, Trash2,
} from 'lucide-react'
import type { AppProps } from '../types'
import { useFs } from '../store/fsStore'
import { useExplorerPrefs } from '../store/explorerStore'
import { ContextMenu } from '../components/shared/ContextMenu'
import type { MenuItem } from '../components/shared/ContextMenu'
import { Dialog } from '../components/shared/Dialog'
import { Button } from '../components/shared/controls'
import { HOME, baseName, displayPath, parentOf } from '../utils/path'
import { FileItem } from './files/FileItem'
import { PropertiesDialog } from './files/PropertiesDialog'
import { SORT_LABELS, Toolbar, sortMenuItems } from './files/Toolbar'
import { useExplorer } from './files/useExplorer'

const PLACES = [
  { name: 'Home', path: HOME, icon: Home },
  ...['Documents', 'Downloads', 'Pictures', 'Music'].map((n) => ({ name: n, path: `${HOME}/${n}`, icon: Folder })),
  { name: 'Computer', path: '/', icon: HardDrive },
]

export function FileExplorer({ props }: AppProps) {
  const ex = useExplorer((props?.path as string | undefined) ?? HOME)
  const tree = useFs((s) => s.tree)
  const { view, sortKey, sortDir, setView } = useExplorerPrefs()
  const rootRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => rootRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  // Return focus to the list after leaving the editor or closing a dialog.
  useEffect(() => {
    if (!ex.editing && !ex.dialog) rootRef.current?.focus()
  }, [ex.editing, ex.dialog])

  const childCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const k of Object.keys(tree)) if (k !== '/') counts[parentOf(k)] = (counts[parentOf(k)] ?? 0) + 1
    return counts
  }, [tree])

  const cutSet = ex.clipboard.mode === 'cut' ? ex.clipboard.paths : []
  const searching = ex.query.trim().length > 0

  const itemMenu = (path: string): MenuItem[] => {
    const entry = ex.entries.find((e) => e.path === path)
    // Menu actions are built before the right-click selection lands in state, so target paths explicitly.
    const targets = ex.selected.includes(path) ? ex.selected : [path]
    const multi = targets.length > 1
    return [
      { label: 'Open', icon: ExternalLink, disabled: multi || !entry, hint: 'Enter', onClick: () => entry && ex.open(entry) },
      { label: '', separator: true },
      { label: 'Cut', icon: Scissors, hint: 'Ctrl+X', onClick: () => ex.cut(targets) },
      { label: 'Copy', icon: Copy, hint: 'Ctrl+C', onClick: () => ex.copy(targets) },
      { label: 'Rename', icon: Pencil, disabled: multi, hint: 'F2', onClick: () => ex.startRename(path) },
      { label: 'Delete', icon: Trash2, hint: 'Del', onClick: () => ex.requestDelete(targets) },
      { label: '', separator: true },
      { label: 'Properties', icon: Info, onClick: () => ex.showProperties(targets) },
    ]
  }

  const emptyMenu = (): MenuItem[] => [
    { label: 'New folder', icon: FolderPlus, hint: 'Ctrl+⇧+N', onClick: () => ex.create('folder') },
    { label: 'New file', icon: FilePlus, hint: 'Ctrl+N', onClick: () => ex.create('file') },
    { label: '', separator: true },
    { label: 'Paste', icon: ClipboardPaste, disabled: !ex.clipboard.mode, hint: 'Ctrl+V', onClick: ex.paste },
    { label: 'Select all', icon: MousePointer2, hint: 'Ctrl+A', onClick: ex.selectAll },
    { label: '', separator: true },
    ...sortMenuItems().map((m) => ({ ...m, label: `Sort: ${m.label}` })),
    { label: view === 'grid' ? 'List view' : 'Grid view', onClick: () => setView(view === 'grid' ? 'list' : 'grid') },
    { label: '', separator: true },
    { label: 'Properties', icon: Info, onClick: () => ex.showProperties([]) },
  ]

  const openMenu = (e: MouseEvent, path: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    if (path && !ex.selected.includes(path)) ex.select(path)
    if (!path) ex.clearSelection()
    setMenu({ x: e.clientX, y: e.clientY, items: path ? itemMenu(path) : emptyMenu() })
  }

  const dirty = ex.editing ? ex.editing.text !== ex.editing.saved : false

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={ex.onKeyDown}
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('input,textarea')) rootRef.current?.focus() }}
      className="relative flex h-full flex-col outline-none"
    >
      <Toolbar ex={ex} />
      <div className="flex min-h-0 flex-1">
        <aside className="w-44 shrink-0 border-r border-ink bg-sidebar max-sm:hidden">
          <div className="kicker border-b border-rule-soft px-4 py-2.5">Places</div>
          {PLACES.map((p) => (
            <button
              key={p.path}
              onClick={() => ex.go(p.path)}
              className={`flex w-full items-center gap-2.5 border-b border-rule-soft px-4 py-2 text-[12.5px] font-medium ${ex.cwd === p.path ? 'bg-ink text-paper' : 'hover:bg-white/[0.07]'}`}
            >
              <p.icon size={14} /> {p.name}
            </button>
          ))}
        </aside>

        {ex.editing ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-rule px-3 py-1.5 text-[12px] text-white/70">
              <button onClick={() => ex.setEditing(null)} aria-label="Close file" className="ibtn grid size-6 place-items-center"><ArrowLeft size={14} /></button>
              <span className="flex-1 truncate">{displayPath(ex.editing.path)}{dirty && <span className="ml-1.5 text-[var(--accent)]">●</span>}</span>
              <button onClick={ex.saveEditing} className="accent-bg flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium"><Save size={12} /> Save</button>
            </div>
            <textarea
              autoFocus
              value={ex.editing.text}
              onChange={(e) => ex.editing && ex.setEditing({ ...ex.editing, text: e.target.value })}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); ex.saveEditing() } }}
              className="selectable flex-1 resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none"
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            {view === 'list' && (
              <div className="grid grid-cols-[minmax(0,1fr)_150px_90px_80px] gap-3 border-b border-ink px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 max-sm:grid-cols-[minmax(0,1fr)_70px]">
                {(['name', 'modified', 'type', 'size'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => useExplorerPrefs.getState().setSort(k)}
                    className={`text-left hover:text-[var(--accent)] max-sm:[&:nth-child(2)]:hidden max-sm:[&:nth-child(3)]:hidden ${k === 'size' ? 'text-right' : ''} ${sortKey === k ? '!text-ink' : ''}`}
                  >
                    {SORT_LABELS[k]} {sortKey === k && (sortDir === 'asc' ? '▲' : '▼')}
                  </button>
                ))}
              </div>
            )}
            <div
              className="min-h-0 flex-1 overflow-auto p-3"
              onClick={() => ex.clearSelection()}
              onContextMenu={(e) => openMenu(e, null)}
            >
              {ex.entries.length === 0 && (
                <div className="grid h-full place-items-center text-[13px] text-white/60">
                  {searching ? `No results for “${ex.query}”` : 'This folder is empty'}
                </div>
              )}
              <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1' : 'flex flex-col gap-0.5'}>
                {ex.entries.map((e) => (
                  <FileItem
                    key={e.path}
                    entry={e}
                    view={view}
                    selected={ex.selected.includes(e.path)}
                    cut={cutSet.includes(e.path)}
                    renaming={ex.renaming === e.path}
                    showLocation={searching}
                    childCount={childCounts[e.path] ?? 0}
                    onSelect={(ev) => { ev.stopPropagation(); ex.select(e.path, ev) }}
                    onOpen={() => ex.open(e)}
                    onContext={(ev) => openMenu(ev, e.path)}
                    onRename={(name) => ex.commitRename(e.path, name)}
                    onCancelRename={() => ex.setRenaming(null)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 border-t border-ink px-3 py-1.5 font-mono text-[10.5px] text-white/65">
              <span>{ex.entries.length} item{ex.entries.length === 1 ? '' : 's'}{searching && ' found'}</span>
              {ex.selected.length > 0 && <span>{ex.selected.length} selected</span>}
              {ex.clipboard.mode && <span className="ml-auto">{ex.clipboard.paths.length} {ex.clipboard.mode === 'cut' ? 'cut' : 'copied'}</span>}
            </div>
          </div>
        )}
      </div>

      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}

      <AnimatePresence>
        {ex.dialog?.type === 'delete' && (
          <Dialog
            key="delete"
            title="Delete"
            onClose={() => ex.setDialog(null)}
            actions={
              <>
                <Button onClick={() => ex.setDialog(null)}>Cancel</Button>
                <button autoFocus onClick={ex.confirmDelete} className="border border-signal bg-signal px-3 py-1.5 text-[12px] font-medium text-[#fff] hover:opacity-90">Delete</button>
              </>
            }
          >
            {ex.dialog.paths.length === 1
              ? <>Permanently delete <b className="break-all">{baseName(ex.dialog.paths[0])}</b>?</>
              : <>Permanently delete <b>{ex.dialog.paths.length} items</b>?</>}
          </Dialog>
        )}
        {ex.dialog?.type === 'properties' && <PropertiesDialog key="props" paths={ex.dialog.paths} onClose={() => ex.setDialog(null)} />}
      </AnimatePresence>
    </div>
  )
}
