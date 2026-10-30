import type { WindowState } from '../types'

/**
 * The browser-tab session. Kept in sessionStorage on purpose: a refresh keeps you signed in (and keeps a
 * locked screen locked), but a new tab or a restart of the browser starts at the login screen.
 */
const KEY = 'threnos-session'

export interface Session { profileId: string; locked: boolean }

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v.profileId === 'string' && typeof v.locked === 'boolean' ? { profileId: v.profileId, locked: v.locked } : null
  } catch {
    return null
  }
}

export function writeSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Session storage unavailable: the login screen simply shows after a refresh.
  }
}

/**
 * Windows of users who switched away without logging out, held in memory so switching back restores
 * their layout. Lost on refresh, like any other session in memory.
 */
export const suspendedWindows = new Map<string, WindowState[]>()
