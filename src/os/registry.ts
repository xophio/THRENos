import { lazy, useMemo } from 'react'
import type { ComponentType } from 'react'
import { create } from 'zustand'
import type { AppProps } from '../types'
import type { AppManifest } from './types'

/**
 * The registry holds every app that is currently available to the OS. The desktop, Start menu,
 * taskbar and window manager only ever read from here, so registering or unregistering an app
 * updates all of them without touching their code.
 */
interface RegistryState {
  apps: Record<string, AppManifest>
  /** Registration order — used for stable numbering in the Start menu and on the desktop. */
  order: string[]
  register: (app: AppManifest) => void
  unregister: (id: string) => void
}

export const useRegistry = create<RegistryState>((set) => ({
  apps: {},
  order: [],
  register: (app) =>
    set((s) => ({
      apps: { ...s.apps, [app.id]: app },
      order: s.order.includes(app.id) ? s.order : [...s.order, app.id],
    })),
  unregister: (id) =>
    set((s) => {
      const { [id]: _removed, ...apps } = s.apps
      return { apps, order: s.order.filter((x) => x !== id) }
    }),
}))

export const getApp = (id: string): AppManifest | undefined => useRegistry.getState().apps[id]
export const isRegistered = (id: string) => id in useRegistry.getState().apps
export const listApps = (): AppManifest[] => {
  const { apps, order } = useRegistry.getState()
  return order.map((id) => apps[id]).filter(Boolean)
}

export const useApp = (id: string) => useRegistry((s) => s.apps[id])

/** All registered apps, in registration order. */
export function useRegisteredApps(): AppManifest[] {
  const apps = useRegistry((s) => s.apps)
  const order = useRegistry((s) => s.order)
  return useMemo(() => order.map((id) => apps[id]).filter(Boolean), [apps, order])
}

const components = new Map<string, ComponentType<AppProps>>()

/** One lazy component per app version, so remounting a window never re-suspends. */
export function getAppComponent(app: AppManifest): ComponentType<AppProps> {
  const key = `${app.id}@${app.version}`
  let c = components.get(key)
  if (!c) {
    c = lazy(app.load)
    components.set(key, c)
  }
  return c
}
