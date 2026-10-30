import { create } from 'zustand'

interface ClipboardState {
  paths: string[]
  mode: 'copy' | 'cut' | null
  set: (paths: string[], mode: 'copy' | 'cut') => void
  clear: () => void
}

// Shared across all Explorer windows.
export const useFileClipboard = create<ClipboardState>((set) => ({
  paths: [],
  mode: null,
  set: (paths, mode) => set({ paths, mode }),
  clear: () => set({ paths: [], mode: null }),
}))
