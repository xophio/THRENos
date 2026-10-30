import type { ComponentType } from 'react'
import {
  Calculator, CalendarDays, Clock, FolderOpen, Globe, Image, Music, Package, Settings,
  SquareTerminal, StickyNote, CloudSun, FileText,
} from 'lucide-react'
import type { AppProps } from '../types'
import { useNotes } from '../store/notesStore'
import { useTerminalHistory } from '../store/terminalStore'
import type { AppManifest } from './types'

type Loader = Promise<Record<string, ComponentType<AppProps>>>
const named = (module: Loader, key: string) => module.then((m) => ({ default: m[key] }))
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length

/**
 * Every app the OS can run. Adding an app is one entry here plus its component:
 * the registry, desktop, Start menu, App Store and Settings pick it up automatically.
 */
export const CATALOG: AppManifest[] = [
  // ---- System: always installed ----
  {
    id: 'files', name: 'Files', kind: 'system', category: 'System', version: '1.0.0', developer: 'Orbit',
    description: 'Browse folders and files',
    about: 'The file manager. Browse the simulated filesystem, copy, move and rename items, search and inspect properties.',
    icon: FolderOpen, sizeKB: 540, permissions: [],
    launch: { defaultSize: { w: 760, h: 480 } },
    load: () => named(import('../apps/FileExplorer'), 'FileExplorer'),
  },
  {
    id: 'terminal', name: 'Terminal', kind: 'system', category: 'System', version: '1.0.0', developer: 'Orbit',
    description: 'Command line',
    about: 'A command-line shell for the simulated filesystem, with chaining, pipes, completion and history.',
    icon: SquareTerminal, sizeKB: 460, permissions: [],
    launch: { defaultSize: { w: 680, h: 420 } },
    load: () => named(import('../apps/Terminal'), 'Terminal'),
    data: {
      measure: () => bytes(useTerminalHistory.getState().history),
      clear: () => useTerminalHistory.getState().clear(),
    },
  },
  {
    id: 'settings', name: 'Settings', kind: 'system', category: 'System', version: '1.0.0', developer: 'Orbit',
    description: 'Personalize ORBIT',
    about: 'Appearance, display, taskbar, sound, installed apps and device information.',
    icon: Settings, sizeKB: 380, permissions: [],
    launch: { defaultSize: { w: 860, h: 600 }, singleton: true },
    load: () => named(import('../apps/Settings'), 'SettingsApp'),
  },
  {
    id: 'appstore', name: 'App Store', kind: 'system', category: 'System', version: '1.0.0', developer: 'Orbit',
    description: 'Discover and install apps',
    about: 'Browse, install and remove applications. Installed apps appear on the desktop and in the Start menu.',
    icon: Package, sizeKB: 300, permissions: [],
    launch: { defaultSize: { w: 900, h: 600 }, singleton: true },
    load: () => named(import('../apps/appstore/AppStore'), 'AppStore'),
  },

  // ---- Bundled: preinstalled, removable ----
  {
    id: 'notes', name: 'Notes', kind: 'bundled', category: 'Productivity', version: '1.0.0', developer: 'Orbit',
    description: 'Write and save notes',
    about: 'Quick notes that save automatically as you type.',
    icon: StickyNote, sizeKB: 180, permissions: [],
    launch: { defaultSize: { w: 720, h: 460 }, singleton: true },
    load: () => named(import('../apps/Notes'), 'Notes'),
    data: {
      measure: () => bytes(useNotes.getState().notes),
      clear: () => useNotes.setState({ notes: [] }),
    },
  },
  {
    id: 'calculator', name: 'Calculator', kind: 'bundled', category: 'Utilities', version: '1.0.0', developer: 'Orbit',
    description: 'Basic calculator',
    about: 'A four-function calculator with keyboard input.',
    icon: Calculator, sizeKB: 90, permissions: [],
    launch: { defaultSize: { w: 320, h: 470 }, singleton: true },
    load: () => named(import('../apps/Calculator'), 'Calculator'),
  },
  {
    id: 'browser', name: 'Browser', kind: 'bundled', category: 'Utilities', version: '1.0.0', developer: 'Orbit',
    description: 'Simulated web browser',
    about: 'A simulated browser with built-in pages and search. It never touches the network.',
    icon: Globe, sizeKB: 720, permissions: [],
    launch: { defaultSize: { w: 860, h: 540 } },
    load: () => named(import('../apps/Browser'), 'Browser'),
  },

  // ---- Store: optional ----
  {
    id: 'calendar', name: 'Calendar', kind: 'store', category: 'Productivity', version: '1.2.0', developer: 'Orbit Labs',
    description: 'Plan your month and keep events',
    about: 'A month calendar with a Monday start. Add, review and remove events; they are stored with the app and survive restarts.',
    icon: CalendarDays, sizeKB: 420, permissions: ['notifications'],
    launch: { defaultSize: { w: 860, h: 560 }, singleton: true },
    load: () => named(import('../apps/calendar/Calendar'), 'Calendar'),
    whatsNew: 'Month navigation with keyboard arrows.',
  },
  {
    id: 'markdown', name: 'Markdown Editor', kind: 'store', category: 'Productivity', version: '1.0.3', developer: 'Orbit Labs',
    description: 'Write with a live preview',
    about: 'Edit Markdown with a live preview, keep documents inside the app, and open or save .md files in your home folder.',
    icon: FileText, sizeKB: 610, permissions: ['filesystem', 'notifications'],
    launch: { defaultSize: { w: 940, h: 580 } },
    load: () => named(import('../apps/markdown/MarkdownEditor'), 'MarkdownEditor'),
    opens: ['md', 'markdown'],
    whatsNew: 'Opens .md files straight from Files.',
  },
  {
    id: 'weather', name: 'Weather', kind: 'store', category: 'Lifestyle', version: '1.1.0', developer: 'Meridian Studio',
    description: 'Forecasts for cities around the world',
    about: 'Current conditions, an hourly outlook and a five-day forecast. All data is generated locally; no network or API key is used.',
    icon: CloudSun, sizeKB: 560, permissions: ['location'],
    launch: { defaultSize: { w: 820, h: 560 }, singleton: true },
    load: () => named(import('../apps/weather/Weather'), 'Weather'),
    whatsNew: 'Celsius / Fahrenheit switch.',
  },
  {
    id: 'music', name: 'Music Player', kind: 'store', category: 'Media', version: '1.0.0', developer: 'Meridian Studio',
    description: 'Play original sample tracks',
    about: 'A music player with original tracks synthesized in your browser (no copyrighted audio), plus support for audio files from your computer.',
    icon: Music, sizeKB: 1280, permissions: ['audio'],
    launch: { defaultSize: { w: 760, h: 520 }, singleton: true },
    load: () => named(import('../apps/music/MusicPlayer'), 'MusicPlayer'),
    opens: ['mp3', 'wav', 'ogg'],
    whatsNew: 'First release.',
  },
  {
    id: 'imageviewer', name: 'Image Viewer', kind: 'store', category: 'Media', version: '1.3.1', developer: 'Orbit Labs',
    description: 'View, zoom and import pictures',
    about: 'Browse a built-in gallery, open pictures from your home folder, import images from your computer and set one as the wallpaper.',
    icon: Image, sizeKB: 740, permissions: ['filesystem'],
    launch: { defaultSize: { w: 900, h: 600 } },
    load: () => named(import('../apps/imageviewer/ImageViewer'), 'ImageViewer'),
    opens: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    whatsNew: 'Rotate and zoom controls.',
  },
  {
    id: 'clock', name: 'Clock', kind: 'store', category: 'Utilities', version: '1.0.1', developer: 'Meridian Studio',
    description: 'World clock, stopwatch and timer',
    about: 'An analog clock, a world clock with the cities you choose, a stopwatch with laps and a countdown timer.',
    icon: Clock, sizeKB: 380, permissions: ['notifications', 'audio'],
    launch: { defaultSize: { w: 760, h: 540 }, singleton: true },
    load: () => named(import('../apps/clock/ClockApp'), 'ClockApp'),
    whatsNew: 'Timer alerts with sound.',
  },
]

const byId = new Map(CATALOG.map((m) => [m.id, m]))

export const getManifest = (id: string) => byId.get(id)
export const SYSTEM_APPS = CATALOG.filter((m) => m.kind === 'system')
export const BUNDLED_APPS = CATALOG.filter((m) => m.kind === 'bundled')
