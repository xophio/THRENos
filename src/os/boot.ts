import { BUNDLED_APPS, SYSTEM_APPS, getManifest } from './catalog'
import { useInstallStore } from './installStore'
import { useRegistry } from './registry'

/**
 * Builds the registry from persisted install state. Safe against missing or damaged data:
 * unknown or malformed entries are discarded and first-run defaults are applied once.
 */
export function bootOS() {
  const registry = useRegistry.getState()
  const install = useInstallStore.getState()

  for (const app of SYSTEM_APPS) registry.register(app)

  if (!install.initialized) {
    // Bundled apps get small timestamps so they sort before anything installed later.
    BUNDLED_APPS.forEach((app, i) => install.add(app.id, app.version, i))
    install.markInitialized()
  }

  const records = Object.entries(useInstallStore.getState().installed).sort((a, b) => a[1].installedAt - b[1].installedAt)
  for (const [id, record] of records) {
    const manifest = getManifest(id)
    if (!manifest || manifest.kind === 'system') {
      install.remove(id)
      continue
    }
    // Installed apps follow the catalog version (an automatic update).
    if (record.version !== manifest.version) install.add(id, manifest.version, record.installedAt)
    registry.register(manifest)
  }

  // Warm the code for core apps so their first window opens instantly.
  for (const app of SYSTEM_APPS) void app.load()
}
