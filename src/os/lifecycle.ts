import { useWindows } from '../store/windowStore'
import { notify } from '../store/notificationStore'
import { baseName } from '../utils/path'
import { getApp, listApps } from './registry'

/** Launches an installed app through the window manager. Returns the window id, or null if not installed. */
export function launchApp(id: string, props?: Record<string, unknown>): string | null {
  const app = getApp(id)
  if (!app) {
    notify('App not installed', `${id} is not installed. Find it in the App Store.`)
    return null
  }
  return useWindows.getState().open(id, props)
}

export function appWindows(id: string) {
  return useWindows.getState().windows.filter((w) => w.appId === id)
}

/** Closes every open window of an app. Used before uninstalling so no window is left without its app. */
export function closeAppWindows(id: string) {
  const { close } = useWindows.getState()
  for (const w of appWindows(id)) close(w.id)
}

const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '')

/** The installed app that handles a file, based on the extensions apps declare in their manifest. */
export function findAppForFile(path: string) {
  const ext = extensionOf(baseName(path))
  return ext ? listApps().find((a) => a.opens?.includes(ext)) : undefined
}

/** Opens a file in its associated app. Returns false when no installed app handles it. */
export function openFileWithApp(path: string): boolean {
  const app = findAppForFile(path)
  if (!app) return false
  launchApp(app.id, { path })
  return true
}
