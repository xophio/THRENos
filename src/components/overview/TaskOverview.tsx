import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, X } from 'lucide-react'
import type { WindowState } from '../../types'
import { useRegistry } from '../../os/registry'
import { useUi } from '../../store/uiStore'
import { useWindows, windowsIn } from '../../store/windowStore'
import { MAX_NAME, MAX_WORKSPACES, useWorkspaces } from '../../store/workspaceStore'
import { createWorkspace, deleteWorkspace, renameWorkspace, switchWorkspace } from '../../store/workspaceActions'
import { SNAP_LABELS } from '../../utils/snap'
import { LayoutMap } from './LayoutMap'

const DRAG_TYPE = 'application/x-orbit-window'

function stateLabel(w: WindowState): string {
  if (w.minimized) return 'Minimized'
  if (w.maximized) return 'Maximized'
  if (w.snap) return SNAP_LABELS[w.snap]
  return `${Math.round(w.w)} × ${Math.round(w.h)}`
}

function WindowCard({ win, focused }: { win: WindowState; focused: boolean }) {
  const app = useRegistry((s) => s.apps[win.appId])
  const { focus, close } = useWindows()
  if (!app) return null

  const activate = () => { useUi.getState().setOverview(false); focus(win.id) }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-overview-window={win.id}
      data-minimized={win.minimized}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, win.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={activate}
      onKeyDown={(e) => { if (e.key === 'Enter') activate() }}
      className={`group flex cursor-default flex-col border bg-surface text-left transition-colors hover:border-[var(--accent)] ${
        win.minimized ? 'border-dashed border-rule' : 'border-ink'
      } ${focused ? 'shadow-[inset_0_3px_0_var(--accent)]' : ''}`}
    >
      <div className="flex items-center gap-2 border-b border-rule-soft px-3 py-2">
        <app.icon size={14} strokeWidth={1.5} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold uppercase tracking-[0.08em]">{win.title}</span>
        <button
          aria-label={`Close ${win.title}`}
          data-overview-close={win.id}
          onClick={(e) => { e.stopPropagation(); close(win.id) }}
          className="ibtn grid size-6 place-items-center opacity-60 group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      </div>
      <div className={`relative grid aspect-[16/10] place-items-center ${win.minimized ? 'opacity-55' : ''}`}>
        {/* A wireframe of the window: title bar, content area and the app's icon. */}
        <div className="absolute inset-3 border border-rule bg-paper">
          <div className="h-3 border-b border-rule bg-sidebar" />
          <div className="grid h-[calc(100%-0.75rem)] place-items-center">
            <app.icon size={34} strokeWidth={1.1} className="text-white/70" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-rule-soft px-3 py-1.5">
        <span className="kicker">{app.name}</span>
        <span className={`font-mono text-[10px] ${win.minimized ? 'text-[var(--accent)]' : 'text-white/60'}`}>{stateLabel(win)}</span>
      </div>
    </div>
  )
}

function WorkspaceName({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) ref.current?.select() }, [editing])

  if (!editing) {
    return (
      <button
        data-workspace-name={id}
        title="Double-click to rename"
        onDoubleClick={() => setEditing(true)}
        className="truncate text-left text-[22px] font-bold leading-none tracking-[-0.04em]"
      >
        {name}
      </button>
    )
  }
  const commit = (value: string) => { renameWorkspace(id, value); setEditing(false) }
  return (
    <input
      ref={ref}
      autoFocus
      aria-label="Workspace name"
      data-workspace-input={id}
      defaultValue={name}
      maxLength={MAX_NAME}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') commit(e.currentTarget.value)
        if (e.key === 'Escape') setEditing(false)
      }}
      className="field w-56 px-2 py-1 text-[18px] font-bold tracking-[-0.03em]"
    />
  )
}

function Section({ index, id, name }: { index: number; id: string; name: string }) {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows((s) => s.focusedId)
  const moveToWorkspace = useWindows((s) => s.moveToWorkspace)
  const activeId = useWorkspaces((s) => s.activeId)
  const count = useWorkspaces((s) => s.workspaces.length)
  const [over, setOver] = useState(false)

  const mine = windowsIn(windows, id).reverse()
  const active = id === activeId

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const windowId = e.dataTransfer.getData(DRAG_TYPE)
    if (windowId) moveToWorkspace(windowId, id)
  }

  return (
    <section
      data-overview-workspace={id}
      data-active={active}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`mb-8 border-t pt-4 transition-colors ${over ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]' : active ? 'border-ink' : 'border-rule'}`}
    >
      <div className="mb-4 flex items-center gap-4">
        <span className={`grid size-9 shrink-0 place-items-center border border-ink font-mono text-[12px] ${active ? 'bg-ink text-paper' : ''}`}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <WorkspaceName id={id} name={name} />
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/65">
            <span>{mine.length} {mine.length === 1 ? 'window' : 'windows'}</span>
            {active && <span className="kicker !text-[var(--accent)]" data-current-workspace>Current</span>}
          </div>
        </div>
        <LayoutMap windows={mine} focusedId={active ? focusedId : null} />
        {!active && (
          <button data-overview-switch={id} onClick={() => switchWorkspace(id)} className="border border-ink px-3 py-1.5 text-[12px] font-semibold hover-invert">Switch</button>
        )}
        {count > 1 && (
          <button
            aria-label={`Delete ${name}`}
            data-overview-delete={id}
            onClick={() => deleteWorkspace(id)}
            title="Delete workspace (its windows move to the neighbouring workspace)"
            className="ibtn grid size-8 place-items-center border border-transparent hover:!border-signal hover:!bg-signal hover:!text-[#fff]"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {mine.length === 0 ? (
        <div className="border border-dashed border-rule px-4 py-8 text-center text-[12.5px] text-white/60">
          No windows. Drag one here to move it to this workspace.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {mine.map((w) => <WindowCard key={w.id} win={w} focused={active && w.id === focusedId} />)}
        </div>
      )}
    </section>
  )
}

/** Full-screen overview of every window, grouped by workspace. */
export function TaskOverview() {
  const open = useUi((s) => s.overview)
  const workspaces = useWorkspaces((s) => s.workspaces)
  const windowCount = useWindows((s) => s.windows.length)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overview"
          data-overview
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute inset-0 z-[9300] flex flex-col overflow-hidden bg-paper"
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex items-end justify-between border-b-2 border-ink px-10 pb-4 pt-8">
            <div>
              <div className="kicker">{windowCount} {windowCount === 1 ? 'window' : 'windows'} · {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}</div>
              <h2 className="mt-2 text-[44px] font-bold leading-none tracking-[-0.055em]">Overview</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                data-overview-new
                onClick={() => createWorkspace()}
                disabled={workspaces.length >= MAX_WORKSPACES}
                className="accent-bg flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold disabled:opacity-40"
              >
                <Plus size={13} /> New workspace
              </button>
              <button aria-label="Close overview" onClick={() => useUi.getState().setOverview(false)} className="ibtn grid size-9 place-items-center border border-ink">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-10 pb-24 pt-6" onClick={(e) => { if (e.target === e.currentTarget) useUi.getState().setOverview(false) }}>
            {workspaces.map((w, i) => <Section key={w.id} index={i} id={w.id} name={w.name} />)}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
