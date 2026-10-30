import { useEffect } from 'react'
import { useSettings } from '../store/settingsStore'
import { lock, useSystem } from './systemStore'

const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/** Locks the session after the chosen number of idle minutes (Settings → Lock & startup). 0 turns it off. */
export function useAutoLock() {
  const phase = useSystem((s) => s.phase)
  const minutes = useSettings((s) => s.autoLockMinutes)

  useEffect(() => {
    if (phase !== 'desktop' || !(minutes > 0)) return
    const delay = minutes * 60_000
    let timer = window.setTimeout(lock, delay)
    let last = Date.now()
    const reset = () => {
      // Pointer movement fires constantly; resetting at most twice a second is plenty.
      if (Date.now() - last < 500) return
      last = Date.now()
      window.clearTimeout(timer)
      timer = window.setTimeout(lock, delay)
    }
    for (const type of ACTIVITY) window.addEventListener(type, reset, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const type of ACTIVITY) window.removeEventListener(type, reset)
    }
  }, [phase, minutes])
}
