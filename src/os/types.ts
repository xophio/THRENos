import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { AppProps } from '../types'

export type AppCategory = 'System' | 'Productivity' | 'Utilities' | 'Media' | 'Lifestyle'

/** Categories shown as store filters, in display order. */
export const CATEGORIES: AppCategory[] = ['System', 'Productivity', 'Utilities', 'Media', 'Lifestyle']

/** Capabilities an app may request. Users can revoke them in Settings. */
export type Permission = 'filesystem' | 'notifications' | 'audio' | 'location'

/**
 * - system:  part of the OS. Always installed, cannot be removed.
 * - bundled: preinstalled on first run, but can be uninstalled and reinstalled.
 * - store:   optional. Installed from the App Store.
 */
export type AppKind = 'system' | 'bundled' | 'store'

/**
 * Everything the OS needs to know about an app. To add an app, write its component,
 * then add one manifest to `os/catalog.ts` — the desktop, Start menu, window manager,
 * App Store and Settings all read from the registry and need no changes.
 */
export interface AppManifest {
  id: string
  name: string
  /** One line, shown in lists. */
  description: string
  /** Longer text for the detail page. */
  about: string
  icon: LucideIcon
  category: AppCategory
  version: string
  developer: string
  kind: AppKind
  /** Simulated download size. */
  sizeKB: number
  permissions: Permission[]
  launch: {
    defaultSize: { w: number; h: number }
    singleton?: boolean
  }
  /** Lazy loader so an app's code is only fetched when it is installed or launched. */
  load: () => Promise<{ default: ComponentType<AppProps> }>
  /** File extensions (lowercase, no dot) this app can open from the file manager. */
  opens?: string[]
  whatsNew?: string
  /** Overrides for apps that keep data outside the shared app-data store. */
  data?: { measure: () => number; clear: () => void }
}

export type InstallPhase = 'downloading' | 'installing' | 'registering' | 'failed'

export interface InstallJob {
  progress: number
  phase: InstallPhase
  error?: string
}

export interface Result { ok: boolean; error?: string }

export const PERMISSION_LABELS: Record<Permission, { label: string; hint: string }> = {
  filesystem: { label: 'Files', hint: 'Read and write files in your home folder.' },
  notifications: { label: 'Notifications', hint: 'Show notifications.' },
  audio: { label: 'Audio', hint: 'Play sound.' },
  location: { label: 'Location', hint: 'Use your approximate location.' },
}
