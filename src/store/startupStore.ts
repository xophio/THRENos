import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Device-level startup preferences (shared by every profile). */
interface StartupState {
  /** The animated boot sequence. When off, startup is a brief static screen. */
  animation: boolean
  /** Status lines under the progress bar. */
  messages: boolean
  set: (patch: Partial<Pick<StartupState, 'animation' | 'messages'>>) => void
}

export const useStartup = create<StartupState>()(
  persist(
    (set) => ({
      animation: true,
      messages: true,
      set: (patch) => set(patch),
    }),
    {
      name: 'threnos-startup',
      version: 1,
      partialize: (s) => ({ animation: s.animation, messages: s.messages }),
      merge: (persisted, current) => {
        const p = typeof persisted === 'object' && persisted !== null ? (persisted as Record<string, unknown>) : {}
        return {
          ...current,
          animation: typeof p.animation === 'boolean' ? p.animation : current.animation,
          messages: typeof p.messages === 'boolean' ? p.messages : current.messages,
        }
      },
    },
  ),
)
