import { useMemo } from 'react'
import { useFs } from '../store/fsStore'
import type { FsEntry } from '../store/fsStore'
import { notify } from '../store/notificationStore'
import { HOME, normalize } from '../utils/path'
import { getApp, useRegistry } from './registry'
import { useInstallStore } from './installStore'
import type { Permission } from './types'

/** An app has a permission only if its manifest requests it and the user has not revoked it. */
export function isGranted(appId: string, permission: Permission): boolean {
  const app = getApp(appId)
  if (!app?.permissions.includes(permission)) return false
  return useInstallStore.getState().grants[appId]?.[permission] !== false
}

export function useGranted(appId: string, permission: Permission): boolean {
  const requested = useRegistry((s) => s.apps[appId]?.permissions.includes(permission) ?? false)
  const revoked = useInstallStore((s) => s.grants[appId]?.[permission] === false)
  return requested && !revoked
}

const inHome = (path: string) => {
  const p = normalize(path)
  return p === HOME || p.startsWith(HOME + '/')
}

/** Filesystem facade handed to apps: permission-checked and confined to the user's home folder. */
export interface AppFs {
  list: (dir: string) => FsEntry[]
  read: (path: string) => string | null
  write: (path: string, content: string) => string | null
  mkdir: (path: string) => string | null
  rename: (from: string, to: string) => string | null
  copy: (from: string, to: string) => string | null
  exists: (path: string) => boolean
}

const DENIED = 'Permission denied'
const OUTSIDE = 'Outside your home folder'

function createFs(appId: string): AppFs {
  const guard = (path: string): string | null => {
    if (!isGranted(appId, 'filesystem')) return DENIED
    return inHome(path) ? null : OUTSIDE
  }
  return {
    list: (dir) => (guard(dir) ? [] : useFs.getState().list(dir)),
    read: (path) => (guard(path) ? null : useFs.getState().read(path)),
    write: (path, content) => guard(path) ?? useFs.getState().write(path, content),
    mkdir: (path) => guard(path) ?? useFs.getState().mkdir(path),
    rename: (from, to) => guard(from) ?? guard(to) ?? useFs.getState().rename(from, to),
    copy: (from, to) => guard(from) ?? guard(to) ?? useFs.getState().copy(from, to),
    exists: (path) => !guard(path) && useFs.getState().exists(path),
  }
}

export interface AppCapabilities {
  can: (permission: Permission) => boolean
  /** Shows a notification if the app holds the notifications permission. Returns whether it was shown. */
  notify: (title: string, body?: string) => boolean
  fs: AppFs
}

/** The only door apps use to reach OS services. Everything here is gated by the user's grants. */
export function createCapabilities(appId: string): AppCapabilities {
  return {
    can: (permission) => isGranted(appId, permission),
    notify: (title, body) => {
      if (!isGranted(appId, 'notifications')) return false
      notify(title, body)
      return true
    },
    fs: createFs(appId),
  }
}

export function useAppCapabilities(appId: string): AppCapabilities {
  return useMemo(() => createCapabilities(appId), [appId])
}
