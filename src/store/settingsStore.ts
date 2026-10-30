import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppId } from '../types'

export const ACCENTS = [
  { value: '#d62929', name: 'Signal red' },
  { value: '#202020', name: 'Charcoal' },
  { value: '#1f4fd8', name: 'Cobalt' },
  { value: '#e0a100', name: 'Ochre' },
  { value: '#1f7a4d', name: 'Green' },
  { value: '#8c8a83', name: 'Grey' },
] as const

export const RESOLUTIONS = [
  { id: 'auto', label: 'Fit window', w: 0, h: 0 },
  { id: '1280x720', label: '1280 × 720', w: 1280, h: 720 },
  { id: '1366x768', label: '1366 × 768', w: 1366, h: 768 },
  { id: '1600x900', label: '1600 × 900', w: 1600, h: 900 },
  { id: '1920x1080', label: '1920 × 1080', w: 1920, h: 1080 },
  { id: '2560x1440', label: '2560 × 1440', w: 2560, h: 1440 },
] as const

export const SCALES = [75, 100, 125, 150, 175] as const

export type ThemeMode = 'dark' | 'light' | 'system'
export type TaskbarPosition = 'bottom' | 'top' | 'left' | 'right'
export type WallpaperFit = 'cover' | 'contain' | 'stretch'

type Pos = { x: number; y: number }

/** Persisted preferences. Keep this flat so a single `set` patch can change any of them. */
export interface SettingsValues {
  accent: string
  theme: ThemeMode
  wallpaper: string
  wallpaperFit: WallpaperFit
  animations: boolean
  roundedCorners: boolean
  desktopGrid: boolean
  desktopClock: boolean

  resolution: string
  scale: number
  brightness: number

  taskbarPosition: TaskbarPosition
  taskbarAutoHide: boolean
  taskbarLabels: boolean
  clock24h: boolean
  clockSeconds: boolean
  clockDate: boolean

  volume: number
  muted: boolean
  soundEffects: boolean

  username: string
  deviceName: string
  iconPositions: Partial<Record<AppId, Pos>>
}

interface SettingsState extends SettingsValues {
  set: (patch: Partial<SettingsValues>) => void
  setIconPosition: (id: AppId, pos: Pos) => void
  resetIcons: () => void
  reset: () => void
}

export const DEFAULTS: SettingsValues = {
  accent: ACCENTS[0].value, theme: 'light', wallpaper: 'signal', wallpaperFit: 'cover',
  animations: true, roundedCorners: false, desktopGrid: true, desktopClock: true,
  resolution: 'auto', scale: 100, brightness: 100,
  taskbarPosition: 'bottom', taskbarAutoHide: false, taskbarLabels: true,
  clock24h: true, clockSeconds: false, clockDate: true,
  volume: 70, muted: false, soundEffects: true,
  username: 'orbit', deviceName: 'ORBIT-PC', iconPositions: {},
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      setIconPosition: (id, pos) =>
        set((s) => ({ iconPositions: { ...s.iconPositions, [id]: pos } })),
      resetIcons: () => set({ iconPositions: {} }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'orbit-settings' },
  ),
)
