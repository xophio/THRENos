import { useCallback } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AppBucket = Record<string, unknown>

interface AppDataState {
  /** One bucket per app id. Apps are only handed their own bucket. */
  buckets: Record<string, AppBucket>
  set: (appId: string, key: string, value: unknown) => void
  remove: (appId: string, key: string) => void
  clear: (appId: string) => void
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const useAppDataStore = create<AppDataState>()(
  persist(
    (set) => ({
      buckets: {},
      set: (appId, key, value) =>
        set((s) => ({ buckets: { ...s.buckets, [appId]: { ...s.buckets[appId], [key]: value } } })),
      remove: (appId, key) =>
        set((s) => {
          const { [key]: _gone, ...rest } = s.buckets[appId] ?? {}
          return { buckets: { ...s.buckets, [appId]: rest } }
        }),
      clear: (appId) =>
        set((s) => {
          const { [appId]: _gone, ...buckets } = s.buckets
          return { buckets }
        }),
    }),
    {
      name: 'threnos-appdata',
      version: 1,
      partialize: (s) => ({ buckets: s.buckets }),
      merge: (persisted, current) => {
        const raw = isObject(persisted) && isObject(persisted.buckets) ? persisted.buckets : {}
        const buckets: Record<string, AppBucket> = {}
        for (const [id, b] of Object.entries(raw)) if (isObject(b)) buckets[id] = b
        return { ...current, buckets }
      },
    },
  ),
)

const encoder = new TextEncoder()

/** Bytes of stored data for one app. */
export function measureAppData(appId: string): number {
  const bucket = useAppDataStore.getState().buckets[appId]
  return bucket ? encoder.encode(JSON.stringify(bucket)).length : 0
}

export const clearAppData = (appId: string) => useAppDataStore.getState().clear(appId)

/**
 * Persistent state scoped to one app: `useAppState(appId, 'events', [])`.
 * The key space is private to `appId`; one app cannot read or write another's data through this API.
 */
export function useAppState<T>(appId: string, key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const stored = useAppDataStore((s) => s.buckets[appId]?.[key])
  const value = (stored === undefined ? initial : stored) as T

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const store = useAppDataStore.getState()
      const current = (store.buckets[appId]?.[key] ?? initial) as T
      store.set(appId, key, typeof next === 'function' ? (next as (p: T) => T)(current) : next)
    },
    // `initial` is only a default; changing it must not recreate the setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appId, key],
  )

  return [value, setValue]
}
