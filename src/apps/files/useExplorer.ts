import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useFs } from '../../store/fsStore'
import type { FsEntry } from '../../store/fsStore'
import { useFileClipboard } from '../../store/clipboardStore'
import { useExplorerPrefs } from '../../store/explorerStore'
import { notify } from '../../store/notificationStore'
import { HOME, baseName, displayPath, joinPath, parentOf } from '../../utils/path'
import { kindOf, uniqueName } from '../../utils/files'
import { openFileWithApp } from '../../os/lifecycle'

export type Dialog = { type: 'properties' | 'delete'; paths: string[] } | null
export interface Editing { path: string; text: string; saved: string }

const sizeOf = (e: FsEntry) => (e.type === 'file' ? (e.content ?? '').length : 0)

export function useExplorer(initialPath: string = HOME) {
  const tree = useFs((s) => s.tree)
  const { sortKey, sortDir } = useExplorerPrefs()
  const clipboard = useFileClipboard()

  const [history, setHistory] = useState([initialPath])
  const [idx, setIdx] = useState(0)
  const [selection, setSelection] = useState<string[]>([])
  const [anchor, setAnchor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)

  const cwd = history[idx]
  const fs = useFs.getState

  // A folder deleted elsewhere (terminal, another window) should not strand this window.
  const safeCwd = tree[cwd]?.type === 'folder' ? cwd : HOME

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const raw = q
      ? fs().descendants(safeCwd).filter((e) => e.name.toLowerCase().includes(q))
      : fs().list(safeCwd)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...raw].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      let c = 0
      if (sortKey === 'name') c = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      else if (sortKey === 'modified') c = a.mtime - b.mtime
      else if (sortKey === 'size') c = sizeOf(a) - sizeOf(b)
      else c = kindOf(a.name, a.type).localeCompare(kindOf(b.name, b.type))
      return (c || a.name.localeCompare(b.name)) * dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, safeCwd, query, sortKey, sortDir])

  const selected = selection.filter((p) => p in tree)
  const selectedEntries = entries.filter((e) => selected.includes(e.path))

  const go = useCallback((path: string, opts?: { keepQuery?: boolean }) => {
    if (path === safeCwd) return
    setHistory((h) => [...h.slice(0, idx + 1), path])
    setIdx((i) => i + 1)
    setSelection([])
    setRenaming(null)
    setEditing(null)
    if (!opts?.keepQuery) setQuery('')
  }, [idx, safeCwd])

  const back = () => { if (idx > 0) { setIdx(idx - 1); setSelection([]); setEditing(null) } }
  const forward = () => { if (idx < history.length - 1) { setIdx(idx + 1); setSelection([]); setEditing(null) } }
  const up = () => { if (safeCwd !== '/') go(parentOf(safeCwd)) }

  const open = (e: FsEntry) => {
    if (e.type === 'folder') go(e.path)
    // An installed app that declares this file type opens it; otherwise use the built-in text editor.
    else if (openFileWithApp(e.path)) return
    else setEditing({ path: e.path, text: e.content ?? '', saved: e.content ?? '' })
  }

  const select = (path: string, ev?: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>) => {
    if (ev?.shiftKey && anchor) {
      const a = entries.findIndex((e) => e.path === anchor)
      const b = entries.findIndex((e) => e.path === path)
      if (a >= 0 && b >= 0) {
        setSelection(entries.slice(Math.min(a, b), Math.max(a, b) + 1).map((e) => e.path))
        return
      }
    }
    if (ev?.ctrlKey || ev?.metaKey) {
      setSelection((s) => (s.includes(path) ? s.filter((p) => p !== path) : [...s, path]))
    } else {
      setSelection([path])
    }
    setAnchor(path)
  }

  const selectAll = () => setSelection(entries.map((e) => e.path))
  const clearSelection = () => setSelection([])

  const create = (type: 'file' | 'folder') => {
    setQuery('')
    const base = type === 'file' ? 'untitled.txt' : 'New folder'
    const name = uniqueName(fs().exists, safeCwd, base, '')
    const path = joinPath(safeCwd, name)
    const err = type === 'file' ? fs().write(path, '') : fs().mkdir(path)
    if (err) return notify('Could not create', err)
    setSelection([path])
    setAnchor(path)
    setRenaming(path)
  }

  const startRename = (path = selected[0]) => { if (path) setRenaming(path) }

  const commitRename = (path: string, raw: string) => {
    setRenaming(null)
    const name = raw.trim()
    if (!name || name === baseName(path)) return
    if (name.includes('/')) return notify('Invalid name', 'Names cannot contain "/".')
    const target = joinPath(parentOf(path), name)
    const err = fs().rename(path, target)
    if (err) return notify('Rename failed', err === 'Destination exists' ? `"${name}" already exists here.` : err)
    setSelection([target])
    setAnchor(target)
  }

  const copy = (paths = selected) => { if (paths.length) { clipboard.set(paths, 'copy'); notify('Copied', `${paths.length} item(s)`) } }
  const cut = (paths = selected) => { if (paths.length) clipboard.set(paths, 'cut') }

  const paste = () => {
    const { paths, mode } = clipboard
    if (!mode || !paths.length) return
    const pasted: string[] = []
    for (const src of paths) {
      if (!fs().exists(src)) continue
      const name = baseName(src)
      if (mode === 'cut' && parentOf(src) === safeCwd) { pasted.push(src); continue }
      if (fs().isDir(src) && (safeCwd === src || safeCwd.startsWith(src + '/'))) {
        notify('Cannot paste', `"${name}" cannot be placed inside itself.`)
        continue
      }
      const dest = joinPath(safeCwd, uniqueName(fs().exists, safeCwd, name))
      const err = mode === 'copy' ? fs().copy(src, dest) : fs().rename(src, dest)
      if (err) notify('Paste failed', err)
      else pasted.push(dest)
    }
    if (mode === 'cut') clipboard.clear()
    if (pasted.length) { setQuery(''); setSelection(pasted) }
  }

  const requestDelete = (paths = selected) => { if (paths.length) setDialog({ type: 'delete', paths }) }

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return
    for (const p of dialog.paths) {
      const err = fs().remove(p)
      if (err) notify('Delete failed', err)
    }
    setSelection([])
    setDialog(null)
  }

  const showProperties = (paths = selected) => {
    setDialog({ type: 'properties', paths: paths.length ? paths : [safeCwd] })
  }

  const saveEditing = () => {
    if (!editing) return
    const err = fs().write(editing.path, editing.text)
    if (err) return notify('Save failed', err)
    setEditing({ ...editing, saved: editing.text })
    notify('File saved', baseName(editing.path))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (dialog) return
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()

    if (editing) {
      if (e.key === 'Escape') setEditing(null)
      return
    }
    if (mod && key === 'a') selectAll()
    else if (mod && key === 'c') copy()
    else if (mod && key === 'x') cut()
    else if (mod && key === 'v') paste()
    else if (mod && e.shiftKey && key === 'n') create('folder')
    else if (mod && key === 'n') create('file')
    else if (mod && key === 'f') { document.getElementById('explorer-search')?.focus() }
    else if (e.key === 'Delete') requestDelete()
    else if (e.key === 'F2') startRename()
    else if (e.key === 'Enter') { if (selectedEntries.length === 1) open(selectedEntries[0]) }
    else if (e.key === 'Backspace') up()
    else if (e.key === 'Escape') { if (query) setQuery(''); else clearSelection() }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !e.altKey) {
      if (!entries.length) return
      const last = entries.findIndex((x) => x.path === selected[selected.length - 1])
      const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1
      const next = Math.max(0, Math.min(entries.length - 1, last < 0 ? 0 : last + step))
      select(entries[next].path, { ctrlKey: false, metaKey: false, shiftKey: e.shiftKey })
    } else return
    e.preventDefault()
  }

  return {
    cwd: safeCwd, path: displayPath(safeCwd), canBack: idx > 0, canForward: idx < history.length - 1,
    entries, selected, selectedEntries, renaming, query, editing, dialog, clipboard,
    setQuery, setEditing, setDialog, setRenaming,
    go, back, forward, up, open, select, selectAll, clearSelection,
    create, startRename, commitRename, copy, cut, paste,
    requestDelete, confirmDelete, showProperties, saveEditing, onKeyDown,
  }
}

export type Explorer = ReturnType<typeof useExplorer>
