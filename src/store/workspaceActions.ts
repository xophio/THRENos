import { notify } from './notificationStore'
import { MAX_WORKSPACES, useWorkspaces } from './workspaceStore'
import { useWindows } from './windowStore'

/**
 * Operations that span workspaces and windows. Kept apart from both stores so neither
 * has to import the other's internals.
 */

export function createWorkspace(name?: string): string | null {
  const id = useWorkspaces.getState().create(name)
  if (!id) notify('Workspace limit reached', `You can have up to ${MAX_WORKSPACES} workspaces.`)
  return id
}

export const switchWorkspace = (id: string) => useWorkspaces.getState().setActive(id)

/** Switches to the next (+1) or previous (-1) workspace, wrapping around. */
export function cycleWorkspace(delta: 1 | -1) {
  const { workspaces, activeId, setActive } = useWorkspaces.getState()
  const i = workspaces.findIndex((w) => w.id === activeId)
  setActive(workspaces[(i + delta + workspaces.length) % workspaces.length].id)
}

export const renameWorkspace = (id: string, name: string) => useWorkspaces.getState().rename(id, name)

/**
 * Deletes a workspace. Its windows are not closed: they move to the neighbouring workspace
 * so no app state is lost. The last remaining workspace cannot be deleted.
 */
export function deleteWorkspace(id: string): boolean {
  const { workspaces, activeId } = useWorkspaces.getState()
  const index = workspaces.findIndex((w) => w.id === id)
  if (index < 0 || workspaces.length <= 1) return false
  const neighbour = workspaces[index > 0 ? index - 1 : 1].id

  useWindows.setState((s) => ({
    windows: s.windows.map((w) => (w.workspaceId === id ? { ...w, workspaceId: neighbour } : w)),
  }))
  if (activeId === id) useWorkspaces.getState().setActive(neighbour)
  useWorkspaces.getState().remove(id)
  return true
}

/** Sends the focused window to the next or previous workspace and follows it. */
export function moveFocusedWindow(delta: 1 | -1) {
  const { focusedId, moveToWorkspace, focus } = useWindows.getState()
  if (!focusedId) return
  const { workspaces, activeId } = useWorkspaces.getState()
  const i = workspaces.findIndex((w) => w.id === activeId)
  const target = workspaces[(i + delta + workspaces.length) % workspaces.length].id
  if (target === activeId) return
  moveToWorkspace(focusedId, target)
  focus(focusedId)
}
