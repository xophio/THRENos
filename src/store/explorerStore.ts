import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'grid' | 'list'
export type SortKey = 'name' | 'modified' | 'size' | 'type'

interface ExplorerPrefs {
  view: ViewMode
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  setView: (v: ViewMode) => void
  setSort: (key: SortKey) => void
}

export const useExplorerPrefs = create<ExplorerPrefs>()(
  persist(
    (set) => ({
      view: 'grid',
      sortKey: 'name',
      sortDir: 'asc',
      setView: (view) => set({ view }),
      // Choosing the active key again flips direction.
      setSort: (key) =>
        set((s) => (s.sortKey === key ? { sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' } : { sortKey: key, sortDir: 'asc' })),
    }),
    { name: 'threnos-explorer' },
  ),
)
