import type { CSSProperties } from 'react'
import { useSettings } from '../store/settingsStore'
import { useCustomWallpapers } from '../store/wallpaperStore'
import { WALLPAPERS, wallpaperStyle } from '../theme/wallpapers'
import { useResolvedTheme } from './useAppearance'

const FIT_SIZE = { cover: 'cover', contain: 'contain', stretch: '100% 100%' } as const

/** CSS for the active wallpaper: a built-in composition or an uploaded image. */
export function useWallpaperStyle(): CSSProperties {
  const id = useSettings((s) => s.wallpaper)
  const fit = useSettings((s) => s.wallpaperFit)
  const theme = useResolvedTheme()
  const images = useCustomWallpapers((s) => s.images)

  if (id.startsWith('custom:')) {
    const img = images.find((i) => `custom:${i.id}` === id)
    if (img) {
      return {
        backgroundColor: theme === 'dark' ? '#202020' : '#f2f0e9',
        backgroundImage: `url(${img.dataUrl})`,
        backgroundSize: FIT_SIZE[fit],
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }
  }
  return wallpaperStyle(WALLPAPERS.find((x) => x.id === id) ?? WALLPAPERS[0], theme)
}

/** Wallpaper behind the lock and login screens: the desktop's own, or a built-in one chosen in Settings. */
export function useLockWallpaperStyle(): CSSProperties {
  const desktop = useWallpaperStyle()
  const choice = useSettings((st) => st.lockWallpaper)
  const theme = useResolvedTheme()
  const builtIn = WALLPAPERS.find((w) => w.id === choice)
  return choice === 'desktop' || !builtIn ? desktop : wallpaperStyle(builtIn, theme)
}
