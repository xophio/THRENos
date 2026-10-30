import { create } from 'zustand'
import { notify } from '../store/notificationStore'
import { useSettings } from '../store/settingsStore'
import { clamp } from '../utils'
import { clearAppData } from './appData'
import { getManifest } from './catalog'
import { useInstallStore } from './installStore'
import { closeAppWindows } from './lifecycle'
import { getApp, isRegistered, useRegistry } from './registry'
import type { InstallJob, InstallPhase, Result } from './types'

interface JobsState {
  jobs: Record<string, InstallJob>
  set: (id: string, job: InstallJob) => void
  clear: (id: string) => void
}

/** In-flight installs. Transient: a refresh mid-install simply leaves the app uninstalled. */
export const useInstallJobs = create<JobsState>((set) => ({
  jobs: {},
  set: (id, job) => set((s) => ({ jobs: { ...s.jobs, [id]: job } })),
  clear: (id) =>
    set((s) => {
      const { [id]: _gone, ...jobs } = s.jobs
      return { jobs }
    }),
}))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const phaseFor = (progress: number): InstallPhase =>
  progress < 55 ? 'downloading' : progress < 90 ? 'installing' : 'registering'

/** Installs a catalog app: download (simulated) → fetch its code → register → create shortcuts. */
export async function installApp(id: string): Promise<Result> {
  const manifest = getManifest(id)
  if (!manifest) return { ok: false, error: 'Unknown app' }
  if (isRegistered(id)) return { ok: false, error: 'Already installed' }
  const existing = useInstallJobs.getState().jobs[id]
  if (existing && existing.phase !== 'failed') return { ok: false, error: 'Installation already in progress' }

  const jobs = useInstallJobs.getState()
  jobs.set(id, { progress: 0, phase: 'downloading' })

  const duration = clamp(600 + manifest.sizeKB * 0.8, 800, 1800)
  const started = performance.now()
  // Fetching the component is real work: if it fails, the install fails.
  let loadError: unknown = null
  const loading = manifest.load().catch((e) => { loadError = e })

  while (true) {
    const progress = Math.min(99, Math.floor(((performance.now() - started) / duration) * 100))
    jobs.set(id, { progress, phase: phaseFor(progress) })
    if (progress >= 99) break
    await sleep(50)
  }
  await loading

  if (loadError) {
    const error = loadError instanceof Error ? loadError.message : 'Could not load the app'
    jobs.set(id, { progress: 0, phase: 'failed', error })
    return { ok: false, error }
  }

  jobs.set(id, { progress: 100, phase: 'registering' })
  useRegistry.getState().register(manifest)
  useInstallStore.getState().add(id, manifest.version)
  jobs.clear(id)
  notify(`${manifest.name} installed`, 'Find it on the desktop and in the Start menu.')
  return { ok: true }
}

export function dismissFailedInstall(id: string) {
  if (useInstallJobs.getState().jobs[id]?.phase === 'failed') useInstallJobs.getState().clear(id)
}

/**
 * Removes an app: closes its windows, unregisters it and deletes its shortcuts and permission settings.
 * User files are never touched. App data is kept (so a reinstall restores it) unless `removeData` is set.
 */
export function uninstallApp(id: string, options: { removeData?: boolean } = {}): Result {
  const app = getApp(id)
  if (!app) return { ok: false, error: 'Not installed' }
  if (app.kind === 'system') return { ok: false, error: 'System apps cannot be removed' }

  closeAppWindows(id)
  useRegistry.getState().unregister(id)
  useInstallStore.getState().remove(id)
  const settings = useSettings.getState()
  settings.clearIconPosition(id)

  if (options.removeData) {
    app.data?.clear()
    clearAppData(id)
  }
  notify(`${app.name} uninstalled`, options.removeData ? 'App data was removed.' : 'App data was kept.')
  return { ok: true }
}
