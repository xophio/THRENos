import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AppId } from '../types'
import { PRIMARY_PROFILE, getActiveProfileId, scopedKey, setActiveProfileId } from '../system/activeProfile'

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
  taskbarGrouping: boolean
  taskbarAllWorkspaces: boolean
  restoreWindows: boolean
  snapPreview: boolean
  clock24h: boolean
  clockSeconds: boolean
  clockDate: boolean

  volume: number
  muted: boolean
  soundEffects: boolean

  /** Mirrors the signed-in profile's name. */
  username: string
  deviceName: string
  iconPositions: Partial<Record<AppId, Pos>>

  /** 'desktop' reuses the desktop wallpaper; otherwise the id of a built-in wallpaper. */
  lockWallpaper: string
  lockStatus: boolean
  /** Minutes of inactivity before locking; 0 turns it off. */
  autoLockMinutes: number
}

interface SettingsState extends SettingsValues {
  set: (patch: Partial<SettingsValues>) => void
  setIconPosition: (id: AppId, pos: Pos) => void
  clearIconPosition: (id: AppId) => void
  resetIcons: () => void
  reset: () => void
}

export const DEFAULTS: SettingsValues = {
  accent: ACCENTS[0].value, theme: 'light', wallpaper: 'signal', wallpaperFit: 'cover',
  animations: true, roundedCorners: false, desktopGrid: true, desktopClock: true,
  resolution: 'auto', scale: 100, brightness: 100,
  taskbarPosition: 'bottom', taskbarAutoHide: false, taskbarLabels: true,
  taskbarGrouping: true, taskbarAllWorkspaces: false, restoreWindows: false, snapPreview: true,
  clock24h: true, clockSeconds: false, clockDate: true,
  volume: 70, muted: false, soundEffects: true,
  username: 'threnos', deviceName: 'THRENOS-PC', iconPositions: {},
  lockWallpaper: 'desktop', lockStatus: true, autoLockMinutes: 0,
}

/**
 * Settings are split by owner. Device settings (display, sound, taskbar placement, device name) are shared
 * and live under `threnos-device`. Everything else belongs to the signed-in profile and lives in that
 * profile's own record, so switching users never copies or overwrites another user's preferences.
 */
export const DEVICE_KEYS: readonly string[] = [
  'resolution', 'scale', 'brightness', 'taskbarPosition', 'taskbarAutoHide', 'volume', 'muted', 'soundEffects', 'deviceName',
]
const DEVICE_STORE = 'threnos-device'
const PROFILE_STORE = 'threnos-settings'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readState(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return isObject(parsed) && isObject(parsed.state) ? parsed.state : null
  } catch {
    return null
  }
}

const profileRecord = (id: string | null) => scopedKey(PROFILE_STORE, id ?? PRIMARY_PROFILE)

/** Keeps only values whose type matches the default, so damaged data falls back to defaults. */
function accept(source: Record<string, unknown> | null, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!source) return out
  for (const k of keys) {
    const fallback = (DEFAULTS as unknown as Record<string, unknown>)[k]
    if (k in source && typeof source[k] === typeof fallback && (typeof fallback !== 'object' || isObject(source[k]))) out[k] = source[k]
  }
  return out
}

const ALL_KEYS = Object.keys(DEFAULTS)
const PROFILE_KEYS = ALL_KEYS.filter((k) => !DEVICE_KEYS.includes(k))

const settingsStorage = createJSONStorage<SettingsState>(() => ({
  getItem: () => {
    const device = readState(DEVICE_STORE)
    const profile = readState(profileRecord(getActiveProfileId()))
    if (!device && !profile) return null
    // Data saved before profiles existed kept every key in the profile record; the device record wins when present.
    return JSON.stringify({ state: { ...(profile ?? {}), ...(device ?? {}) }, version: 0 })
  },
  setItem: (_name, value) => {
    const state = JSON.parse(value).state as Record<string, unknown>
    const device: Record<string, unknown> = {}
    const profile: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(state)) (DEVICE_KEYS.includes(k) ? device : profile)[k] = v
    localStorage.setItem(DEVICE_STORE, JSON.stringify({ state: device, version: 0 }))
    localStorage.setItem(profileRecord(getActiveProfileId()), JSON.stringify({ state: profile, version: 0 }))
  },
  removeItem: () => {
    localStorage.removeItem(DEVICE_STORE)
    localStorage.removeItem(profileRecord(getActiveProfileId()))
  },
}))

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      setIconPosition: (id, pos) =>
        set((s) => ({ iconPositions: { ...s.iconPositions, [id]: pos } })),
      clearIconPosition: (id) =>
        set((s) => {
          const { [id]: _gone, ...iconPositions } = s.iconPositions
          return { iconPositions }
        }),
      resetIcons: () => set({ iconPositions: {} }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: PROFILE_STORE,
      storage: settingsStorage,
      merge: (persisted, current) => ({
        ...current,
        ...accept(isObject(persisted) ? persisted : null, ALL_KEYS),
      }),
    },
  ),
)

/** Points the settings at a profile: its saved preferences over fresh defaults, plus device settings untouched. */
export function loadProfileSettings(id: string, seed: Partial<SettingsValues> = {}) {
  const stored = accept(readState(profileRecord(id)), PROFILE_KEYS)
  const defaults = Object.fromEntries(PROFILE_KEYS.map((k) => [k, (DEFAULTS as unknown as Record<string, unknown>)[k]]))
  setActiveProfileId(id)
  useSettings.setState({ ...defaults, ...stored, ...seed } as Partial<SettingsState>)
}

/** Removes a profile's saved preferences. */
export function eraseProfileSettings(id: string) {
  localStorage.removeItem(profileRecord(id))
}
