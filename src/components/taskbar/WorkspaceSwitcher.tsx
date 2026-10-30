import { LayoutGrid } from 'lucide-react'
import { useUi } from '../../store/uiStore'
import { useWindows } from '../../store/windowStore'
import { useWorkspaces } from '../../store/workspaceStore'
import { switchWorkspace } from '../../store/workspaceActions'

/** Numbered workspace buttons and the task-overview button. */
export function WorkspaceSwitcher({ vertical }: { vertical: boolean }) {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const activeId = useWorkspaces((s) => s.activeId)
  const windows = useWindows((s) => s.windows)
  const overview = useUi((s) => s.overview)

  return (
    <div className={`flex shrink-0 items-center gap-0.5 ${vertical ? 'flex-col' : ''}`}>
      {workspaces.length > 1 && (
        <div className={`flex gap-0.5 ${vertical ? 'flex-col' : ''}`} role="group" aria-label="Workspaces">
          {workspaces.map((w, i) => {
            const active = w.id === activeId
            const count = windows.filter((x) => x.workspaceId === w.id).length
            return (
              <button
                key={w.id}
                data-workspace-button={w.id}
                data-active={active}
                aria-pressed={active}
                title={`${w.name} · ${count} ${count === 1 ? 'window' : 'windows'}`}
                onClick={() => switchWorkspace(w.id)}
                className={`relative grid h-7 min-w-7 place-items-center rounded-sm border px-1 font-mono text-[11px] transition-colors ${
                  active ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
                {!active && count > 0 && <span className="absolute -right-px -top-px size-1.5 bg-[var(--accent)]" />}
              </button>
            )
          })}
        </div>
      )}
      <button
        aria-label="Task overview"
        data-action="overview"
        aria-pressed={overview}
        title="Task overview (Alt+O)"
        onClick={() => useUi.getState().setOverview()}
        className={`ibtn relative grid size-9 shrink-0 place-items-center ${overview ? '!bg-ink !text-paper' : ''}`}
      >
        <LayoutGrid size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
