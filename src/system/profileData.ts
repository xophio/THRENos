import { useFs } from '../store/fsStore'
import { useNotes } from '../store/notesStore'
import { useTerminalHistory } from '../store/terminalStore'
import { useExplorerPrefs } from '../store/explorerStore'
import { useCustomWallpapers } from '../store/wallpaperStore'
import { useWorkspaces } from '../store/workspaceStore'
import { eraseProfileSettings, loadProfileSettings } from '../store/settingsStore'
import type { SettingsValues } from '../store/settingsStore'
import { useAppDataStore } from '../os/appData'
import { useAutomations } from '../automation/store'
import { scopedKey } from './activeProfile'

/**
 * Each profile keeps its own files, notes, terminal history, app data, wallpapers, workspaces and
 * preferences. The stores are shared objects, so "switching profile" means pointing every one of them at
 * the new profile's storage key and reloading it — nothing is copied between users.
 */
interface Scoped {
  base: string
  store: {
    persist: { setOptions: (o: { name: string }) => void; rehydrate: () => void | Promise<void> }
    setState: (state: never, replace?: boolean) => void
    getInitialState: () => never
  }
}

const scoped = (base: string, store: unknown): Scoped => ({ base, store: store as Scoped['store'] })

const SCOPED: Scoped[] = [
  scoped('threnos-fs', useFs),
  scoped('threnos-notes', useNotes),
  scoped('threnos-terminal', useTerminalHistory),
  scoped('threnos-explorer', useExplorerPrefs),
  scoped('threnos-wallpapers', useCustomWallpapers),
  scoped('threnos-appdata', useAppDataStore),
  scoped('threnos-workspaces', useWorkspaces),
  scoped('threnos-automations', useAutomations),
]

/** The per-profile records besides the stores above (window layout is handled by windowSession). */
const EXTRA_BASES = ['threnos-windows']

let loadedProfileId: string | null = null
export const getLoadedProfileId = () => loadedProfileId

/**
 * Loads a profile's data into every scoped store. Anything the profile has not saved yet starts from
 * defaults, so nothing from the previously loaded profile can leak through.
 */
export async function loadProfileData(id: string, seed: Partial<SettingsValues> = {}) {
  for (const { base, store } of SCOPED) {
    const key = scopedKey(base, id)
    const saved = localStorage.getItem(key)
    store.persist.setOptions({ name: key })
    // Resetting writes the defaults under the new key, so put the saved record back before rehydrating.
    store.setState(store.getInitialState(), true)
    if (saved !== null) {
      localStorage.setItem(key, saved)
      await store.persist.rehydrate()
    }
  }
  loadProfileSettings(id, seed)
  loadedProfileId = id
}

/** Deletes everything a profile saved. The profile must not be the one currently loaded. */
export function eraseProfileData(id: string) {
  for (const base of [...SCOPED.map((s) => s.base), ...EXTRA_BASES]) localStorage.removeItem(scopedKey(base, id))
  eraseProfileSettings(id)
}

/** Writes preferences for a profile that has never been loaded (used when creating one). */
export function seedProfileSettings(id: string, seed: Partial<SettingsValues>) {
  const key = scopedKey('threnos-settings', id)
  localStorage.setItem(key, JSON.stringify({ state: seed, version: 0 }))
}
