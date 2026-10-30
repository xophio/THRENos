import { create } from 'zustand'

export type TrayPanel = 'volume' | 'notifications' | null

interface UiState {
  startOpen: boolean
  tray: TrayPanel
  overview: boolean
  /** Alt+Tab switcher while Alt is held; null when closed. */
  switcher: { ids: string[]; index: number } | null
  setOverview: (open?: boolean) => void
  setSwitcher: (s: { ids: string[]; index: number } | null) => void
  setStart: (open?: boolean) => void
  setTray: (panel: TrayPanel) => void
  closeAll: () => void
}

export const useUi = create<UiState>((set) => ({
  startOpen: false,
  tray: null,
  overview: false,
  switcher: null,
  setOverview: (open) => set((s) => ({ overview: open ?? !s.overview, startOpen: false, tray: null, switcher: null })),
  setSwitcher: (switcher) => set({ switcher }),
  setStart: (open) => set((s) => ({ startOpen: open ?? !s.startOpen, tray: null })),
  setTray: (tray) => set((s) => ({ tray: s.tray === tray ? null : tray, startOpen: false })),
  closeAll: () => set({ startOpen: false, tray: null }),
}))
