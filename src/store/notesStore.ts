import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Note } from '../types'
import { uid } from '../utils'

interface NotesState {
  notes: Note[]
  create: () => string
  update: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void
  remove: (id: string) => void
}

export const useNotes = create<NotesState>()(
  persist(
    (set) => ({
      notes: [
        { id: 'welcome', title: 'Welcome to THRENos', body: 'Notes save automatically.\n\nTry Ctrl+Space for search, Alt+Arrows to snap windows.', updated: Date.now() },
      ],
      create: () => {
        const id = uid()
        set((s) => ({ notes: [{ id, title: 'Untitled', body: '', updated: Date.now() }, ...s.notes] }))
        return id
      },
      update: (id, patch) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updated: Date.now() } : n)) })),
      remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    { name: 'threnos-notes' },
  ),
)
