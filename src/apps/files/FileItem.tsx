import type { MouseEvent } from 'react'
import { File, Folder } from 'lucide-react'
import type { FsEntry } from '../../store/fsStore'
import type { ViewMode } from '../../store/explorerStore'
import { displayPath, parentOf } from '../../utils/path'
import { formatDate, formatSize, kindOf } from '../../utils/files'

interface Props {
  entry: FsEntry
  view: ViewMode
  selected: boolean
  cut: boolean
  renaming: boolean
  showLocation: boolean
  childCount: number
  onSelect: (e: MouseEvent) => void
  onOpen: () => void
  onContext: (e: MouseEvent) => void
  onRename: (name: string) => void
  onCancelRename: () => void
}

function Icon({ entry, size }: { entry: FsEntry; size: number }) {
  return entry.type === 'folder'
    ? <Folder size={size} strokeWidth={1.25} className="shrink-0" fill="currentColor" fillOpacity={0.12} />
    : <File size={size} strokeWidth={1.25} className="shrink-0" />
}

function Name({ entry, renaming, onRename, onCancel, center }: { entry: FsEntry; renaming: boolean; onRename: (n: string) => void; onCancel: () => void; center?: boolean }) {
  if (!renaming) return <span className={`min-w-0 break-words leading-tight ${center ? 'w-full text-center' : 'truncate'}`}>{entry.name}</span>
  return (
    <input
      autoFocus
      defaultValue={entry.name}
      onFocus={(e) => {
        const dot = entry.type === 'file' ? entry.name.lastIndexOf('.') : -1
        e.currentTarget.setSelectionRange(0, dot > 0 ? dot : entry.name.length)
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={(e) => onRename(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { e.currentTarget.value = entry.name; onCancel() }
      }}
      className={`field min-w-0 px-1 text-[12px] ${center ? 'w-full text-center' : 'flex-1'}`}
    />
  )
}

export function FileItem(p: Props) {
  const { entry } = p
  const state = p.selected ? 'bg-ink text-paper' : 'hover:bg-white/[0.07]'
  const muted = p.selected ? 'text-paper/70' : 'text-white/60'
  const dim = p.cut ? 'opacity-45' : ''
  const handlers = { onClick: p.onSelect, onDoubleClick: p.onOpen, onContextMenu: p.onContext }

  if (p.view === 'grid') {
    return (
      <div {...handlers} data-path={entry.path} className={`flex cursor-default flex-col items-center gap-1.5 px-1 pb-2 pt-3 text-[12px] ${state} ${dim}`}>
        <Icon entry={entry} size={36} />
        <Name entry={entry} renaming={p.renaming} onRename={p.onRename} onCancel={p.onCancelRename} center />
        {p.showLocation && <span className={`w-full truncate text-center text-[10px] ${muted}`}>{displayPath(parentOf(entry.path))}</span>}
      </div>
    )
  }

  return (
    <div {...handlers} data-path={entry.path} className={`grid cursor-default grid-cols-[minmax(0,1fr)_150px_90px_80px] items-center gap-3 border-b border-rule-soft px-3 py-1.5 text-[12px] max-sm:grid-cols-[minmax(0,1fr)_70px] ${state} ${dim}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon entry={entry} size={15} />
        <Name entry={entry} renaming={p.renaming} onRename={p.onRename} onCancel={p.onCancelRename} />
        {p.showLocation && <span className={`truncate text-[10px] ${muted}`}>{displayPath(parentOf(entry.path))}</span>}
      </div>
      <span className={`${muted} max-sm:hidden`}>{formatDate(entry.mtime)}</span>
      <span className={`${muted} max-sm:hidden`}>{kindOf(entry.name, entry.type)}</span>
      <span className={`text-right font-mono text-[11px] ${muted}`}>
        {entry.type === 'folder' ? `${p.childCount} item${p.childCount === 1 ? '' : 's'}` : formatSize((entry.content ?? '').length)}
      </span>
    </div>
  )
}
