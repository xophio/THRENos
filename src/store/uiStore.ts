import { create } from 'zustand'

export type TrayPanel = 'volume' | 'notifications' | null

interface UiState {
  startOpen: boolean
  tray: TrayPanel
  setStart: (open?: boolean) => void
  setTray: (panel: TrayPanel) => void
  closeAll: () => void
}

export const useUi = create<UiState>((set) => ({
  startOpen: false,
  tray: null,
  setStart: (open) => set((s) => ({ startOpen: open ?? !s.startOpen, tray: null })),
  setTray: (tray) => set((s) => ({ tray: s.tray === tray ? null : tray, startOpen: false })),
  closeAll: () => set({ startOpen: false, tray: null }),
}))
