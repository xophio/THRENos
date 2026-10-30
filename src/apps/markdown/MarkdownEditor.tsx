import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Bold, Code, FileDown, FolderOpen, Heading, Italic, Link2, List, Plus, Trash2 } from 'lucide-react'
import type { AppProps } from '../../types'
import { useAppState } from '../../os/appData'
import { useAppCapabilities, useGranted } from '../../os/permissions'
import { Dialog } from '../../components/shared/Dialog'
import { Button, Segmented } from '../../components/shared/controls'
import { notify } from '../../store/notificationStore'
import { uid } from '../../utils'
import { HOME, baseName } from '../../utils/path'
import { renderMarkdown, wordCount } from './markdown'

interface Doc { id: string; title: string; body: string; updated: number; path?: string }
type View = 'edit' | 'split' | 'preview'

const WELCOME: Doc = {
  id: 'welcome',
  title: 'Welcome',
  updated: 0,
  body: '# Markdown\n\nWrite on the left, read on the right.\n\n- **Bold**, *italic* and `code`\n- Lists, quotes and [links](https://example.com)\n\n> Documents are saved inside this app. Use *Save to Files* to write a `.md` file to your home folder.\n\n```\nfunction hello() {\n  return "world"\n}\n```\n',
}

const MD_FILE = /\.(md|markdown|txt)$/i

export function MarkdownEditor({ appId, props }: AppProps) {
  const caps = useAppCapabilities(appId)
  const filesAllowed = useGranted(appId, 'filesystem')
  const [docs, setDocs] = useAppState<Doc[]>(appId, 'docs', [WELCOME])
  const [activeId, setActiveId] = useAppState<string>(appId, 'active', 'welcome')
  const [view, setView] = useAppState<View>(appId, 'view', 'split')
  const [picker, setPicker] = useState<{ path: string; name: string }[] | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  const doc = docs.find((d) => d.id === activeId) ?? docs[0]
  const html = useMemo(() => renderMarkdown(doc?.body ?? ''), [doc?.body])

  const patch = (changes: Partial<Doc>) => doc && setDocs((all) => all.map((d) => (d.id === doc.id ? { ...d, ...changes, updated: Date.now() } : d)))

  const create = (init: Partial<Doc> = {}) => {
    const next: Doc = { id: uid(), title: 'Untitled', body: '', updated: Date.now(), ...init }
    setDocs((all) => [next, ...all])
    setActiveId(next.id)
    return next
  }

  const remove = (id: string) => {
    const rest = docs.filter((d) => d.id !== id)
    setDocs(rest.length ? rest : [{ ...WELCOME, id: uid(), updated: Date.now() }])
    if (id === activeId) setActiveId(rest[0]?.id ?? '')
  }

  const openPath = (path: string) => {
    const existing = docs.find((d) => d.path === path)
    const body = caps.fs.read(path)
    if (body === null) return notify('Cannot open file', filesAllowed ? 'File not found.' : 'Markdown Editor needs the Files permission.')
    if (existing) {
      setDocs((all) => all.map((d) => (d.id === existing.id ? { ...d, body, updated: Date.now() } : d)))
      setActiveId(existing.id)
    } else {
      create({ title: baseName(path).replace(/\.[^.]+$/, ''), body, path })
    }
  }

  // A file opened from the file manager arrives as a path.
  const requested = props?.path as string | undefined
  useEffect(() => { if (requested) openPath(requested) }, [requested]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveToFiles = () => {
    if (!doc) return
    const name = doc.title.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'Untitled'
    const path = doc.path ?? `${HOME}/Documents/${name}.md`
    const err = caps.fs.write(path, doc.body)
    if (err) return notify('Could not save', err === 'Permission denied' ? 'Allow Files access in Settings → Apps.' : err)
    patch({ path })
    caps.notify('Saved', baseName(path)) || notify('Saved', baseName(path))
  }

  const showPicker = () => {
    const found = [HOME, `${HOME}/Documents`, `${HOME}/Downloads`].flatMap((dir) =>
      caps.fs.list(dir).filter((e) => e.type === 'file' && MD_FILE.test(e.name)).map((e) => ({ path: e.path, name: e.name })),
    )
    setPicker(found)
  }

  /** Wraps the selection, or inserts the placeholder, then restores focus and selection. */
  const wrap = (before: string, after: string, placeholder: string) => {
    const el = area.current
    if (!el || !doc) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const chosen = value.slice(a, b) || placeholder
    patch({ body: value.slice(0, a) + before + chosen + after + value.slice(b) })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + chosen.length) })
  }

  const prefixLine = (prefix: string) => {
    const el = area.current
    if (!el || !doc) return
    const start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1
    patch({ body: el.value.slice(0, start) + prefix + el.value.slice(start) })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(el.selectionStart + prefix.length, el.selectionStart + prefix.length) })
  }

  const tool = 'ibtn grid size-8 place-items-center'

  return (
    <div className="relative flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-ink bg-sidebar max-md:hidden">
        <div className="flex items-center justify-between border-b border-ink px-4 py-2.5">
          <span className="kicker !text-ink">Documents</span>
          <button aria-label="New document" data-action="new-doc" onClick={() => create()} className="ibtn grid size-6 place-items-center"><Plus size={14} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {docs.map((d, i) => {
            const on = d.id === doc?.id
            return (
              <div
                key={d.id}
                data-doc={d.id}
                onClick={() => setActiveId(d.id)}
                className={`group flex cursor-pointer items-start gap-2.5 border-b border-rule-soft px-4 py-2.5 ${on ? 'bg-ink text-paper' : 'hover:bg-white/[0.07]'}`}
              >
                <span className={`pt-0.5 font-mono text-[10px] ${on ? 'text-paper/70' : 'text-white/50'}`}>{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{d.title || 'Untitled'}</div>
                  <div className={`truncate text-[11px] ${on ? 'text-paper/70' : 'text-white/55'}`}>{d.path ? baseName(d.path) : 'App only'}</div>
                </div>
                <button aria-label={`Delete ${d.title}`} onClick={(e) => { e.stopPropagation(); remove(d.id) }} className={`hidden group-hover:block ${on ? 'text-paper/80 hover:text-paper' : 'text-white/55 hover:text-signal'}`}><Trash2 size={12} /></button>
              </div>
            )
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1 border-b border-ink px-3 py-1.5">
          <button aria-label="Bold" onClick={() => wrap('**', '**', 'bold')} className={tool}><Bold size={14} /></button>
          <button aria-label="Italic" onClick={() => wrap('*', '*', 'italic')} className={tool}><Italic size={14} /></button>
          <button aria-label="Heading" onClick={() => prefixLine('## ')} className={tool}><Heading size={14} /></button>
          <button aria-label="List" onClick={() => prefixLine('- ')} className={tool}><List size={14} /></button>
          <button aria-label="Code" onClick={() => wrap('`', '`', 'code')} className={tool}><Code size={14} /></button>
          <button aria-label="Link" onClick={() => wrap('[', '](https://)', 'link')} className={tool}><Link2 size={14} /></button>
          <div className="flex-1" />
          <Segmented
            label="View"
            value={view}
            options={[{ value: 'edit', label: 'Edit' }, { value: 'split', label: 'Split' }, { value: 'preview', label: 'Preview' }]}
            onChange={setView}
          />
          <button onClick={showPicker} disabled={!filesAllowed} className="ibtn ml-1 flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-medium"><FolderOpen size={14} /> Open</button>
          <button onClick={saveToFiles} disabled={!filesAllowed} data-action="save-file" className="ibtn flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-medium"><FileDown size={14} /> Save to Files</button>
        </div>
        {!filesAllowed && (
          <div data-files-blocked className="border-b border-signal px-4 py-2 text-[12px] text-signal">
            Files access is blocked, so documents stay inside this app. Allow it in Settings → Apps.
          </div>
        )}
        {doc ? (
          <>
            <input
              aria-label="Document title"
              value={doc.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Title"
              className="border-b border-rule-soft bg-transparent px-5 py-2.5 text-[18px] font-bold tracking-[-0.03em] outline-none placeholder:text-white/35"
            />
            <div className="flex min-h-0 flex-1">
              {view !== 'preview' && (
                <textarea
                  ref={area}
                  aria-label="Markdown source"
                  value={doc.body}
                  onChange={(e) => patch({ body: e.target.value })}
                  spellCheck={false}
                  className={`selectable min-w-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-[1.65] outline-none ${view === 'split' ? 'border-r border-rule-soft' : ''}`}
                />
              )}
              {view !== 'edit' && (
                <div
                  data-md-preview
                  onClick={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault() }}
                  className="md selectable min-w-0 flex-1 overflow-auto p-5"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
            </div>
            <div className="flex justify-between border-t border-ink px-5 py-1.5 font-mono text-[10.5px] text-white/65">
              <span>{wordCount(doc.body)} words · {doc.body.length} chars</span>
              <span>{doc.path ?? 'Not saved to Files'}</span>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-[13px] text-white/60">No document</div>
        )}
      </div>

      <AnimatePresence>
        {picker && (
          <Dialog title="Open a Markdown file" onClose={() => setPicker(null)} actions={<Button onClick={() => setPicker(null)}>Cancel</Button>}>
            {picker.length === 0 && <p className="text-white/65">No .md or .txt files found in your home, Documents or Downloads folders.</p>}
            <div className="-mx-4 max-h-56 overflow-auto">
              {picker.map((f) => (
                <button key={f.path} data-pick={f.path} onClick={() => { openPath(f.path); setPicker(null) }} className="hover-invert block w-full border-b border-rule-soft px-4 py-2 text-left">
                  <span className="block text-[13px] font-medium">{f.name}</span>
                  <span className="block font-mono text-[10.5px] text-white/55">{f.path}</span>
                </button>
              ))}
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}
