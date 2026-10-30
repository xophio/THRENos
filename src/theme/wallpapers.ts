import type { CSSProperties } from 'react'

export type ThemeName = 'dark' | 'light'

interface Palette { paper: string; ink: string; red: string; grey: string }

const PALETTES: Record<ThemeName, Palette> = {
  light: { paper: '#f2f0e9', ink: '#202020', red: '#d62929', grey: '#cfccc2' },
  dark: { paper: '#202020', ink: '#f2f0e9', red: '#d62929', grey: '#3a3a38' },
}

export interface Wallpaper {
  id: string
  name: string
  /** Returns the inner SVG markup for a 1600×900 artboard. */
  draw: (c: Palette) => string
}

// Compositions sit on the right half so the icon column on the left stays on flat paper.
export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'signal',
    name: 'Signal',
    draw: (c) => `
      <circle cx="1190" cy="350" r="210" fill="${c.red}"/>
      <rect x="0" y="640" width="1600" height="2" fill="${c.ink}"/>
      <rect x="1166" y="640" width="48" height="48" fill="${c.ink}"/>`,
  },
  {
    id: 'bars',
    name: 'Bars',
    draw: (c) => `
      <rect x="1000" width="10" height="900" fill="${c.ink}"/>
      <rect x="1030" width="3" height="900" fill="${c.ink}"/>
      <rect x="1054" width="24" height="900" fill="${c.ink}"/>
      <rect x="1110" width="84" height="900" fill="${c.red}"/>
      <rect x="1226" width="6" height="900" fill="${c.ink}"/>
      <rect x="1256" width="34" height="900" fill="${c.grey}"/>
      <rect x="1322" width="3" height="900" fill="${c.ink}"/>
      <rect x="1348" width="14" height="900" fill="${c.ink}"/>`,
  },
  {
    id: 'quarter',
    name: 'Quarter',
    draw: (c) => `
      <path d="M1600 900 L1600 260 A640 640 0 0 0 960 900 Z" fill="${c.ink}"/>
      <rect x="1100" y="130" width="140" height="140" fill="${c.red}"/>
      <rect x="1100" y="290" width="140" height="2" fill="${c.ink}"/>`,
  },
  {
    id: 'plain',
    name: 'Plain',
    draw: () => '',
  },
]

export const wallpaperUrl = (w: Wallpaper, theme: ThemeName) => {
  const c = PALETTES[theme]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice"><rect width="1600" height="900" fill="${c.paper}"/>${w.draw(c)}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Style for a built-in wallpaper, used by the desktop and the Settings thumbnails. */
export function wallpaperStyle(w: Wallpaper, theme: ThemeName): CSSProperties {
  return {
    backgroundColor: PALETTES[theme].paper,
    backgroundImage: wallpaperUrl(w, theme),
    backgroundSize: 'cover',
    backgroundPosition: 'right center',
    backgroundRepeat: 'no-repeat',
  }
}
