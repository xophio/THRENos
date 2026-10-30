import { create } from 'zustand'
import type { Notification } from '../types'
import { uid } from '../utils'
import { playSound } from '../utils/sound'

interface NotificationState {
  toasts: Notification[]
  history: Notification[]
  panelOpen: boolean
  notify: (title: string, body?: string) => void
  dismiss: (id: string) => void
  clear: () => void
  togglePanel: (open?: boolean) => void
}

export const useNotifications = create<NotificationState>((set, get) => ({
  toasts: [],
  history: [],
  panelOpen: false,
  notify: (title, body) => {
    const n: Notification = { id: uid(), title, body, time: Date.now() }
    set((s) => ({ toasts: [...s.toasts, n], history: [n, ...s.history].slice(0, 50) }))
    playSound('notify')
    setTimeout(() => get().dismiss(n.id), 4500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ history: [] }),
  togglePanel: (open) => set((s) => ({ panelOpen: open ?? !s.panelOpen })),
}))

export const notify = (title: string, body?: string) => useNotifications.getState().notify(title, body)
