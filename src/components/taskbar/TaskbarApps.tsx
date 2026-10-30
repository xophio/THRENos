import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import type { WindowState } from '../../types'
import { useRegistry } from '../../os/registry'
import { useSettings } from '../../store/settingsStore'
import { useWindows } from '../../store/windowStore'
import { useWorkspaces } from '../../store/workspaceStore'
import { ContextMenu } from '../shared/ContextMenu'
import type { MenuItem } from '../shared/ContextMenu'

interface Group { key: string; appId: string; windows: WindowState[] }

/** The running-app buttons: one per window, or one per app (with a count) when grouping is on. */
export function TaskbarApps({ vertical }: { vertical: boolean }) {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows((s) => s.focusedId)
  const { focus, minimize, close } = useWindows()
  const apps = useRegistry((s) => s.apps)
  const workspaces = useWorkspaces((s) => s.workspaces)
  const activeWorkspace = useWorkspaces((s) => s.activeId)
  const grouping = useSettings((s) => s.taskbarGrouping)
  const allWorkspaces = useSettings((s) => s.taskbarAllWorkspaces)
  const labels = useSettings((s) => s.taskbarLabels)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  const groups = useMemo<Group[]>(() => {
    const shown = windows.filter((w) => apps[w.appId] && (allWorkspaces || w.workspaceId === activeWorkspace))
    if (!grouping) return shown.map((w) => ({ key: w.id, appId: w.appId, windows: [w] }))
    const byApp = new Map<string, Group>()
    for (const w of shown) {
      const g = byApp.get(w.appId)
      if (g) g.windows.push(w)
      else byApp.set(w.appId, { key: w.appId, appId: w.appId, windows: [w] })
    }
    return [...byApp.values()]
  }, [windows, apps, allWorkspaces, activeWorkspace, grouping])

  const workspaceName = (id: string) => workspaces.find((w) => w.id === id)?.name ?? ''
  const isVisible = (w: WindowState) => !w.minimized && w.workspaceId === activeWorkspace

  // One window toggles: focus it, or minimize it when it is already the active one.
  const toggle = (w: WindowState) => {
    if (!isVisible(w) || w.id !== focusedId) focus(w.id)
    else minimize(w.id)
  }

  const onClick = (g: Group, e: MouseEvent<HTMLButtonElement>) => {
    if (g.windows.length === 1) return toggle(g.windows[0])
    // Several windows: let the user pick one.
    const r = e.currentTarget.getBoundingClientRect()
    const items: MenuItem[] = [
      ...g.windows.map((w): MenuItem => ({
        label: `${w.title}${w.minimized ? ' (minimized)' : ''}${w.workspaceId !== activeWorkspace ? ` · ${workspaceName(w.workspaceId)}` : ''}`,
        onClick: () => focus(w.id),
      })),
      { label: '', separator: true },
      { label: `Close all ${apps[g.appId].name}`, onClick: () => g.windows.forEach((w) => close(w.id)) },
    ]
    const height = items.length * 34 + 12
    setMenu({ x: r.left, y: vertical ? r.top : r.top - height - 6, items })
  }

  return (
    <>
      {groups.map((g) => {
        const app = apps[g.appId]
        const focusedInGroup = g.windows.some((w) => w.id === focusedId && isVisible(w))
        const allMinimized = g.windows.every((w) => w.minimized)
        const elsewhere = g.windows.every((w) => w.workspaceId !== activeWorkspace)
        const label = g.windows.length === 1 ? g.windows[0].title : app.name
        return (
          <button
            key={g.key}
            title={g.windows.length > 1 ? `${app.name} · ${g.windows.length} windows` : label}
            data-taskbar-app={g.appId}
            data-count={g.windows.length}
            data-active={focusedInGroup}
            onClick={(e) => onClick(g, e)}
            className={`relative flex h-10 shrink-0 items-center gap-2 rounded-md border transition-colors ${vertical ? 'w-10 justify-center' : 'px-3'} ${
              focusedInGroup ? 'border-ink bg-ink text-paper' : `border-transparent hover:border-rule ${allMinimized || elsewhere ? 'text-white/60' : ''}`
            }`}
          >
            <app.icon size={16} strokeWidth={1.5} className="shrink-0" />
            {labels && !vertical && (
              <span className="hidden max-w-28 truncate text-[11px] font-semibold uppercase tracking-[0.08em] md:block">{label}</span>
            )}
            {g.windows.length > 1 && (
              <span
                data-group-badge
                className={`font-mono text-[10px] leading-none ${vertical ? 'absolute right-0.5 top-0.5 bg-[var(--accent)] px-1 py-0.5 text-on-accent' : focusedInGroup ? 'text-paper/80' : 'text-white/70'}`}
              >
                {g.windows.length}
              </span>
            )}
            {/* Running indicator: bar under the icon, solid when active, short when in the background. */}
            <span className={`pointer-events-none absolute ${vertical ? 'left-0 top-2 bottom-2 w-[3px]' : 'bottom-0 left-2 right-2 h-[3px]'} ${focusedInGroup ? 'bg-[var(--accent)]' : allMinimized ? 'bg-transparent' : 'bg-white/30'}`} />
          </button>
        )
      })}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </>
  )
}
