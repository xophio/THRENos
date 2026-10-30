import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_HISTORY = 200

interface TerminalState {
  history: string[]
  push: (line: string) => void
  clear: () => void
}

// Command history is shared by every Terminal window and survives reloads.
export const useTerminalHistory = create<TerminalState>()(
  persist(
    (set) => ({
      history: [],
      push: (line) =>
        set((s) =>
          s.history[s.history.length - 1] === line ? s : { history: [...s.history, line].slice(-MAX_HISTORY) },
        ),
      clear: () => set({ history: [] }),
    }),
    { name: 'orbit-terminal' },
  ),
)
