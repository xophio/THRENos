import { create } from 'zustand'
import { useSettings } from '../store/settingsStore'
import { useWindows } from '../store/windowStore'
import { useUi } from '../store/uiStore'
import { useNotifications } from '../store/notificationStore'
import { useFileClipboard } from '../store/clipboardStore'
import { restoreWindowSession, saveWindowSession, setWindowTracking } from '../store/windowSession'
import { getProfile, useAuth } from './authStore'
import { getLoadedProfileId, loadProfileData } from './profileData'
import { readSession, suspendedWindows, writeSession } from './session'
import { createProfile, eraseProfile } from './auth'
import type { NewProfile } from './auth'

/**
 * What the machine is doing.
 *
 *  booting   the startup screen
 *  setup     first run: create the first profile
 *  login     choose a profile and sign in
 *  locked    a signed-in session behind the lock screen (windows and workspaces stay intact underneath)
 *  desktop   the desktop in use
 *  shutdown  the shut-down screen
 *
 * Restart, shut down and lock only affect THRENos inside this browser tab. They never touch the computer.
 */
export type Phase = 'booting' | 'setup' | 'login' | 'locked' | 'desktop' | 'shutdown'

interface SystemState {
  phase: Phase
  /** Whether the startup screen is a first start or a restart. */
  bootReason: 'start' | 'restart'
  /** The profile whose session is running (desktop or locked). */
  profileId: string | null
  /** The profile highlighted on the login screen. */
  selectedId: string | null
  select: (id: string | null) => void
}

export const useSystem = create<SystemState>((set) => ({
  phase: 'booting',
  bootReason: 'start',
  profileId: null,
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
}))

const set = useSystem.setState
const get = useSystem.getState

/** True when old, pre-profile data exists, which means this is an upgrade rather than a first run. */
function hasLegacyData() {
  try {
    return localStorage.getItem('threnos-settings') !== null || localStorage.getItem('threnos-fs') !== null
  } catch {
    return false
  }
}

function readLegacyName(): string {
  try {
    const raw = localStorage.getItem('threnos-settings')
    const name = raw ? JSON.parse(raw)?.state?.username : null
    return typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : 'threnos'
  } catch {
    return 'threnos'
  }
}

/** Clears everything that belongs to a running session so the next user starts clean. */
function clearSessionState() {
  useWindows.getState().hydrate([])
  useUi.setState({ startOpen: false, tray: null, overview: false, switcher: null, powerMenu: false })
  useNotifications.setState({ toasts: [], history: [], panelOpen: false })
  useFileClipboard.getState().clear()
}

/** Makes a profile's session live: loads its data, restores or resumes its windows, then shows desktop or lock screen. */
async function enterSession(id: string, locked: boolean) {
  const profile = getProfile(id)
  if (!profile) return
  if (getLoadedProfileId() !== id) await loadProfileData(id)
  useSettings.setState({ username: profile.name })

  const suspended = suspendedWindows.get(id)
  if (suspended) {
    useWindows.getState().hydrate(suspended)
    suspendedWindows.delete(id)
  } else if (useSettings.getState().restoreWindows) {
    restoreWindowSession()
  } else {
    useWindows.getState().hydrate([])
  }

  setWindowTracking(true)
  useAuth.getState().setLast(id)
  writeSession({ profileId: id, locked })
  set({ profileId: id, selectedId: id, phase: locked ? 'locked' : 'desktop' })
}

/**
 * Called when the startup screen finishes. Decides where to go:
 * no profiles → setup; an existing session in this tab → straight back to it (still locked if it was locked);
 * a single unprotected profile → its desktop; otherwise → login.
 */
export async function finishBoot() {
  let { profiles } = useAuth.getState()

  if (profiles.length === 0) {
    if (!hasLegacyData()) {
      set({ phase: 'setup' })
      return
    }
    // Upgrading from before profiles: the existing data becomes the primary profile, with no PIN.
    await createProfile({ name: readLegacyName(), avatar: 'signal', protection: 'none' })
    profiles = useAuth.getState().profiles
  }

  const session = readSession()
  const last = useAuth.getState().lastProfileId
  const target = (session && getProfile(session.profileId) && session.profileId) || (last && getProfile(last) ? last : profiles[0].id)

  if (session && getProfile(session.profileId)) {
    await enterSession(session.profileId, session.locked)
    return
  }
  if (profiles.length === 1 && !profiles[0].credential) {
    await enterSession(profiles[0].id, false)
    return
  }
  // Show the lock/login screens in the colours and wallpaper of the profile being signed in to.
  if (getLoadedProfileId() !== target) await loadProfileData(target)
  set({ phase: 'login', selectedId: target })
}

/** Creates the first (or another) profile from the setup screen and signs in to it. */
export async function completeSetup(input: NewProfile) {
  const result = await createProfile(input)
  if (!result.ok) return result
  await enterSession(result.id!, false)
  return result
}

/** Signs in after the screen has verified credentials. */
export async function signIn(id: string) {
  await enterSession(id, false)
}

export function lock() {
  if (get().phase !== 'desktop') return
  useUi.setState({ startOpen: false, tray: null, overview: false, switcher: null, powerMenu: false })
  writeSession({ profileId: get().profileId!, locked: true })
  set({ phase: 'locked' })
}

export function unlock() {
  if (get().phase !== 'locked') return
  writeSession({ profileId: get().profileId!, locked: false })
  set({ phase: 'desktop' })
}

/** Ends the current session. The layout is saved first so "restore windows on startup" can bring it back. */
export function logout() {
  const id = get().profileId
  setWindowTracking(false)
  clearSessionState()
  writeSession(null)
  if (id) suspendedWindows.delete(id)
  set({ phase: 'login', profileId: null, selectedId: id ?? get().selectedId })
}

/** Leaves the session running in memory and goes to the login screen to let someone else sign in. */
export function switchUser() {
  const id = get().profileId
  if (id) suspendedWindows.set(id, useWindows.getState().windows)
  saveWindowSession()
  setWindowTracking(false)
  clearSessionState()
  writeSession(null)
  set({ phase: 'login', profileId: null, selectedId: id ?? get().selectedId })
}

/** Back to the startup screen, as if THRENos had just started. Everyone is signed out. */
export function restart() {
  setWindowTracking(false)
  clearSessionState()
  suspendedWindows.clear()
  writeSession(null)
  set({ phase: 'booting', bootReason: 'restart', profileId: null })
}

export function shutdown() {
  setWindowTracking(false)
  clearSessionState()
  suspendedWindows.clear()
  writeSession(null)
  set({ phase: 'shutdown', profileId: null })
}

/** Starts again from the shut-down screen. */
export function powerOn() {
  set({ phase: 'booting', bootReason: 'start' })
}

// The signed-in profile's name is the user name everywhere (prompt, Start menu, whoami).
useAuth.subscribe(() => {
  const p = getProfile(useSystem.getState().profileId)
  if (p && useSettings.getState().username !== p.name) useSettings.setState({ username: p.name })
})

/**
 * Erases a profile (the "forgot PIN" path) and returns to the login screen, or to setup when it was the last one.
 * If it was the running session, that session ends first.
 */
export function eraseProfileAndLeave(id: string) {
  const wasActive = get().profileId === id
  if (wasActive) {
    setWindowTracking(false)
    clearSessionState()
    writeSession(null)
  }
  suspendedWindows.delete(id)
  eraseProfile(id)
  const remaining = useAuth.getState().profiles
  set({
    profileId: wasActive ? null : get().profileId,
    selectedId: remaining[0]?.id ?? null,
    phase: remaining.length ? 'login' : 'setup',
  })
}
