import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isCredential } from './credentials'
import type { Credential } from './credentials'

export const AVATARS = ['signal', 'bars', 'quarter', 'grid', 'half', 'ring', 'cross', 'stripe'] as const
export type AvatarId = (typeof AVATARS)[number]

export const MAX_PROFILES = 8
export const MAX_PROFILE_NAME = 24

export interface Profile {
  id: string
  name: string
  avatar: AvatarId
  /** Null when the profile has no PIN or password. */
  credential: Credential | null
  createdAt: number
}

export interface Failures { count: number; until: number }

interface AuthState {
  profiles: Profile[]
  /** The profile shown first on the lock and login screens. */
  lastProfileId: string | null
  /** Consecutive failed attempts per profile, kept so a refresh does not reset the throttle. */
  failures: Record<string, Failures>
  addProfile: (profile: Profile) => void
  updateProfile: (id: string, patch: Partial<Pick<Profile, 'name' | 'avatar' | 'credential'>>) => void
  removeProfile: (id: string) => void
  setLast: (id: string | null) => void
  setFailures: (id: string, f: Failures | null) => void
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Keeps only well-formed profiles; damaged entries are dropped rather than breaking sign-in. */
function sanitize(raw: unknown): Pick<AuthState, 'profiles' | 'lastProfileId' | 'failures'> {
  const profiles: Profile[] = []
  const seen = new Set<string>()
  if (isObject(raw) && Array.isArray(raw.profiles)) {
    for (const p of raw.profiles) {
      if (!isObject(p) || typeof p.id !== 'string' || !p.id || seen.has(p.id) || typeof p.name !== 'string') continue
      const name = p.name.trim().slice(0, MAX_PROFILE_NAME)
      if (!name) continue
      seen.add(p.id)
      profiles.push({
        id: p.id,
        name,
        avatar: AVATARS.includes(p.avatar as AvatarId) ? (p.avatar as AvatarId) : 'signal',
        credential: isCredential(p.credential) ? p.credential : null,
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
      })
      if (profiles.length >= MAX_PROFILES) break
    }
  }
  const failures: Record<string, Failures> = {}
  if (isObject(raw) && isObject(raw.failures)) {
    for (const [id, f] of Object.entries(raw.failures)) {
      if (seen.has(id) && isObject(f) && typeof f.count === 'number' && typeof f.until === 'number') failures[id] = { count: f.count, until: f.until }
    }
  }
  const last = isObject(raw) && typeof raw.lastProfileId === 'string' && seen.has(raw.lastProfileId) ? raw.lastProfileId : null
  return { profiles, lastProfileId: last, failures }
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      profiles: [],
      lastProfileId: null,
      failures: {},
      addProfile: (profile) => set((s) => ({ profiles: [...s.profiles, profile] })),
      updateProfile: (id, patch) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removeProfile: (id) =>
        set((s) => {
          const { [id]: _gone, ...failures } = s.failures
          return {
            profiles: s.profiles.filter((p) => p.id !== id),
            failures,
            lastProfileId: s.lastProfileId === id ? null : s.lastProfileId,
          }
        }),
      setLast: (lastProfileId) => set({ lastProfileId }),
      setFailures: (id, f) =>
        set((s) => {
          const { [id]: _gone, ...rest } = s.failures
          return { failures: f ? { ...rest, [id]: f } : rest }
        }),
    }),
    {
      name: 'threnos-auth',
      version: 1,
      partialize: (s) => ({ profiles: s.profiles, lastProfileId: s.lastProfileId, failures: s.failures }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)

export const getProfile = (id: string | null) => (id ? useAuth.getState().profiles.find((p) => p.id === id) : undefined)
