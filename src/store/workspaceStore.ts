import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../utils'

export interface Workspace { id: string; name: string }

export const MAX_WORKSPACES = 8
export const MAX_NAME = 24

interface WorkspaceState {
  workspaces: Workspace[]
  activeId: string
  create: (name?: string) => string | null
  rename: (id: string, name: string) => void
  /** Removes the workspace record only. Use `deleteWorkspace` (workspaceActions) to also rehome its windows. */
  remove: (id: string) => void
  setActive: (id: string) => void
}

const DEFAULT: Workspace[] = [{ id: 'ws-1', name: 'Workspace 1' }]

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Accepts only well-formed workspaces; always returns at least one with a valid active id. */
function sanitize(raw: unknown): Pick<WorkspaceState, 'workspaces' | 'activeId'> {
  const seen = new Set<string>()
  const workspaces: Workspace[] = []
  if (isObject(raw) && Array.isArray(raw.workspaces)) {
    for (const w of raw.workspaces) {
      if (!isObject(w) || typeof w.id !== 'string' || typeof w.name !== 'string' || !w.id || seen.has(w.id)) continue
      seen.add(w.id)
      workspaces.push({ id: w.id, name: w.name.trim().slice(0, MAX_NAME) || 'Workspace' })
      if (workspaces.length >= MAX_WORKSPACES) break
    }
  }
  if (!workspaces.length) return { workspaces: DEFAULT, activeId: DEFAULT[0].id }
  const activeId = isObject(raw) && typeof raw.activeId === 'string' && seen.has(raw.activeId) ? raw.activeId : workspaces[0].id
  return { workspaces, activeId }
}

const nextName = (list: Workspace[]) => {
  for (let n = list.length + 1; ; n++) {
    const name = `Workspace ${n}`
    if (!list.some((w) => w.name === name)) return name
  }
}

export const useWorkspaces = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: DEFAULT,
      activeId: DEFAULT[0].id,
      create: (name) => {
        const { workspaces } = get()
        if (workspaces.length >= MAX_WORKSPACES) return null
        const id = `ws-${uid()}`
        const label = name?.trim().slice(0, MAX_NAME) || nextName(workspaces)
        set({ workspaces: [...workspaces, { id, name: label }] })
        return id
      },
      rename: (id, name) => {
        const clean = name.trim().slice(0, MAX_NAME)
        if (!clean) return
        set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: clean } : w)) }))
      },
      remove: (id) =>
        set((s) => {
          if (s.workspaces.length <= 1) return s
          const workspaces = s.workspaces.filter((w) => w.id !== id)
          return { workspaces, activeId: s.activeId === id ? workspaces[0].id : s.activeId }
        }),
      setActive: (id) => set((s) => (s.workspaces.some((w) => w.id === id) ? { activeId: id } : s)),
    }),
    {
      name: 'threnos-workspaces',
      version: 1,
      partialize: (s) => ({ workspaces: s.workspaces, activeId: s.activeId }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)

export const workspaceIndex = (id: string) => useWorkspaces.getState().workspaces.findIndex((w) => w.id === id)
