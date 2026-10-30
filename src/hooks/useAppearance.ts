import { useEffect, useState } from 'react'
import { MotionGlobalConfig } from 'motion/react'
import { useSettings } from '../store/settingsStore'
import { refreshScreen } from '../utils/screen'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Resolves the `system` theme option to the concrete theme currently in effect. */
export function useResolvedTheme(): 'dark' | 'light' {
  const theme = useSettings((s) => s.theme)
  const [systemDark, setSystemDark] = useState(() => query().matches)

  useEffect(() => {
    const mq = query()
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

/** Text color that stays legible on top of the accent. */
export function onAccent(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return lum > 0.6 ? '#202020' : '#ffffff'
}

/** Applies persisted appearance and display settings to the document. Mount once at the app root. */
export function useAppearance() {
  const s = useSettings()
  const theme = useResolvedTheme()

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.animations = s.animations ? 'on' : 'off'
    root.dataset.corners = s.roundedCorners ? 'round' : 'square'
    root.style.setProperty('--accent', s.accent)
    root.style.setProperty('--on-accent', onAccent(s.accent))
    MotionGlobalConfig.skipAnimations = !s.animations
  }, [theme, s.animations, s.roundedCorners, s.accent])

  // Resolution and scaling change the virtual screen; the browser window can too.
  useEffect(() => { refreshScreen() }, [s.resolution, s.scale])
  useEffect(() => {
    window.addEventListener('resize', refreshScreen)
    return () => window.removeEventListener('resize', refreshScreen)
  }, [])
}
