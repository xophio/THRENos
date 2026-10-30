import type { SettingsValues } from '../store/settingsStore'
import { PRIMARY_PROFILE } from './activeProfile'
import { MAX_PROFILES, MAX_PROFILE_NAME, getProfile, useAuth } from './authStore'
import type { AvatarId, Profile } from './authStore'
import { createCredential, validateSecret, verifyCredential } from './credentials'
import type { CredentialKind } from './credentials'
import { eraseProfileData, seedProfileSettings } from './profileData'
import { uid } from '../utils'

export type Outcome = { ok: true } | { ok: false; error: string }
export type SignInOutcome = Outcome & { retryAfter?: number }

const FREE_ATTEMPTS = 5
const BASE_DELAY_MS = 30_000
const MAX_DELAY_MS = 15 * 60_000

/** Seconds left on a profile's sign-in throttle, or 0. */
export function lockoutSeconds(id: string, now = Date.now()): number {
  const f = useAuth.getState().failures[id]
  return f && f.until > now ? Math.ceil((f.until - now) / 1000) : 0
}

const tooMany = (seconds: number) => `Too many attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`

/**
 * Checks a PIN or password for a profile. After five wrong attempts further tries are delayed, and the delay
 * doubles each time (up to 15 minutes). The counter is saved, so refreshing the page does not reset it.
 * A profile with no credential always succeeds.
 */
export async function checkSecret(id: string, secret: string): Promise<SignInOutcome> {
  const profile = getProfile(id)
  if (!profile) return { ok: false, error: 'That profile no longer exists.' }
  if (!profile.credential) return { ok: true }

  const wait = lockoutSeconds(id)
  if (wait > 0) return { ok: false, error: tooMany(wait), retryAfter: wait }
  if (!secret) return { ok: false, error: profile.credential.kind === 'pin' ? 'Enter your PIN.' : 'Enter your password.' }

  if (await verifyCredential(secret, profile.credential)) {
    useAuth.getState().setFailures(id, null)
    return { ok: true }
  }

  const count = (useAuth.getState().failures[id]?.count ?? 0) + 1
  const delay = count >= FREE_ATTEMPTS ? Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (count - FREE_ATTEMPTS)) : 0
  useAuth.getState().setFailures(id, { count, until: delay ? Date.now() + delay : 0 })
  const noun = profile.credential.kind === 'pin' ? 'PIN' : 'password'
  if (delay) return { ok: false, error: `Incorrect ${noun}. ${tooMany(Math.ceil(delay / 1000))}`, retryAfter: Math.ceil(delay / 1000) }
  const left = FREE_ATTEMPTS - count
  return { ok: false, error: `Incorrect ${noun}. ${left} attempt${left === 1 ? '' : 's'} left before a delay.` }
}

/** Returns an error message for an unusable profile name, or null. */
export function validateName(name: string, ignoreId?: string): string | null {
  const clean = name.trim()
  if (!clean) return 'Enter a name.'
  if (clean.length > MAX_PROFILE_NAME) return `Names can be at most ${MAX_PROFILE_NAME} characters.`
  const taken = useAuth.getState().profiles.some((p) => p.id !== ignoreId && p.name.toLowerCase() === clean.toLowerCase())
  return taken ? 'Another profile already uses that name.' : null
}

export interface NewProfile {
  name: string
  avatar: AvatarId
  protection: CredentialKind | 'none'
  secret?: string
  /** Optional starting preferences, such as the wallpaper or theme. */
  preferences?: Partial<SettingsValues>
}

/** Creates a profile. The first one ever created is the primary profile and owns the original storage keys. */
export async function createProfile(input: NewProfile): Promise<Outcome & { id?: string }> {
  const { profiles } = useAuth.getState()
  if (profiles.length >= MAX_PROFILES) return { ok: false, error: `You can have up to ${MAX_PROFILES} profiles.` }
  const nameError = validateName(input.name)
  if (nameError) return { ok: false, error: nameError }

  let credential: Profile['credential'] = null
  if (input.protection !== 'none') {
    const secretError = validateSecret(input.protection, input.secret ?? '')
    if (secretError) return { ok: false, error: secretError }
    try {
      credential = await createCredential(input.protection, input.secret ?? '')
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Could not secure this profile.' }
    }
  }

  const id = profiles.length === 0 ? PRIMARY_PROFILE : `u-${uid()}`
  const name = input.name.trim()
  seedProfileSettings(id, { ...input.preferences, username: name })
  useAuth.getState().addProfile({ id, name, avatar: input.avatar, credential, createdAt: Date.now() })
  return { ok: true, id }
}

export function renameProfile(id: string, name: string): Outcome {
  const error = validateName(name, id)
  if (error) return { ok: false, error }
  const clean = name.trim()
  useAuth.getState().updateProfile(id, { name: clean })
  return { ok: true }
}

export function setAvatar(id: string, avatar: AvatarId) {
  useAuth.getState().updateProfile(id, { avatar })
}

/** Sets or changes a PIN/password. If one exists, the current secret must be correct. */
export async function changeSecret(id: string, kind: CredentialKind, next: string, current?: string): Promise<Outcome> {
  const profile = getProfile(id)
  if (!profile) return { ok: false, error: 'That profile no longer exists.' }
  if (profile.credential) {
    const check = await checkSecret(id, current ?? '')
    if (!check.ok) return check
  }
  const invalid = validateSecret(kind, next)
  if (invalid) return { ok: false, error: invalid }
  try {
    useAuth.getState().updateProfile(id, { credential: await createCredential(kind, next) })
    useAuth.getState().setFailures(id, null)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not secure this profile.' }
  }
}

/** Turns protection off. The current secret must be correct. */
export async function removeSecret(id: string, current: string): Promise<Outcome> {
  const check = await checkSecret(id, current)
  if (!check.ok) return check
  useAuth.getState().updateProfile(id, { credential: null })
  return { ok: true }
}

/**
 * Forgotten credentials cannot be recovered: nothing readable is stored and there is no server to ask.
 * The only way back in is to erase the profile and everything it saved. Callers must confirm first.
 */
export function eraseProfile(id: string) {
  eraseProfileData(id)
  useAuth.getState().removeProfile(id)
}
