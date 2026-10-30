import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Permission } from './types'

const PERMISSIONS: Permission[] = ['filesystem', 'notifications', 'audio', 'location']

export interface InstallRecord { version: string; installedAt: number }

interface InstallState {
  /** False until first-run defaults have been applied. */
  initialized: boolean
  /** Bundled and store apps that are installed. System apps are always present and not listed. */
  installed: Record<string, InstallRecord>
  /** User overrides for requested permissions. A missing entry means "granted". */
  grants: Record<string, Partial<Record<Permission, boolean>>>
  shortcuts: Record<string, { desktop: boolean }>
  markInitialized: () => void
  add: (id: string, version: string, at?: number) => void
  remove: (id: string) => void
  setGrant: (id: string, permission: Permission, granted: boolean) => void
  setDesktopShortcut: (id: string, desktop: boolean) => void
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Keeps only well-formed entries so a damaged save can never break boot. */
function sanitize(raw: unknown): Pick<InstallState, 'initialized' | 'installed' | 'grants' | 'shortcuts'> {
  const out = { initialized: false, installed: {} as InstallState['installed'], grants: {} as InstallState['grants'], shortcuts: {} as InstallState['shortcuts'] }
  if (!isObject(raw)) return out
  out.initialized = raw.initialized === true
  if (isObject(raw.installed)) {
    for (const [id, rec] of Object.entries(raw.installed)) {
      if (isObject(rec) && typeof rec.version === 'string' && typeof rec.installedAt === 'number') {
        out.installed[id] = { version: rec.version, installedAt: rec.installedAt }
      }
    }
  }
  if (isObject(raw.grants)) {
    for (const [id, g] of Object.entries(raw.grants)) {
      if (!isObject(g)) continue
      const clean: Partial<Record<Permission, boolean>> = {}
      for (const p of PERMISSIONS) if (typeof g[p] === 'boolean') clean[p] = g[p] as boolean
      out.grants[id] = clean
    }
  }
  if (isObject(raw.shortcuts)) {
    for (const [id, s] of Object.entries(raw.shortcuts)) {
      if (isObject(s) && typeof s.desktop === 'boolean') out.shortcuts[id] = { desktop: s.desktop }
    }
  }
  return out
}

export const useInstallStore = create<InstallState>()(
  persist(
    (set) => ({
      initialized: false,
      installed: {},
      grants: {},
      shortcuts: {},
      markInitialized: () => set({ initialized: true }),
      add: (id, version, at = Date.now()) =>
        set((s) => ({
          installed: { ...s.installed, [id]: { version, installedAt: at } },
          shortcuts: s.shortcuts[id] ? s.shortcuts : { ...s.shortcuts, [id]: { desktop: true } },
        })),
      remove: (id) =>
        set((s) => {
          const { [id]: _a, ...installed } = s.installed
          const { [id]: _b, ...grants } = s.grants
          const { [id]: _c, ...shortcuts } = s.shortcuts
          return { installed, grants, shortcuts }
        }),
      setGrant: (id, permission, granted) =>
        set((s) => ({ grants: { ...s.grants, [id]: { ...s.grants[id], [permission]: granted } } })),
      setDesktopShortcut: (id, desktop) => set((s) => ({ shortcuts: { ...s.shortcuts, [id]: { desktop } } })),
    }),
    {
      name: 'orbit-apps',
      version: 1,
      partialize: (s) => ({ initialized: s.initialized, installed: s.installed, grants: s.grants, shortcuts: s.shortcuts }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)
