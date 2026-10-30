import { create } from 'zustand'
import { notify } from './notificationStore'

interface FocusState {
  /** Epoch ms when the running session ends, or null. */
  endsAt: number | null
  label: string
  start: (minutes: number, label?: string) => void
  stop: () => void
}

let timer = 0

/** A countdown focus session. Lives in memory only: a refresh ends it. */
export const useFocus = create<FocusState>((set, get) => ({
  endsAt: null,
  label: '',
  start: (minutes, label = 'Focus') => {
    window.clearTimeout(timer)
    set({ endsAt: Date.now() + minutes * 60_000, label })
    notify('Focus session started', `${label} · ${minutes} min`)
    timer = window.setTimeout(() => {
      if (get().endsAt === null) return
      set({ endsAt: null })
      notify('Focus session complete', label)
    }, minutes * 60_000)
  },
  stop: () => {
    window.clearTimeout(timer)
    if (get().endsAt !== null) set({ endsAt: null })
  },
}))
