import { Calculator, FolderOpen, Globe, Settings, SquareTerminal, StickyNote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppId } from '../types'

export interface AppMeta {
  id: AppId
  name: string
  description: string
  icon: LucideIcon
  color: string
  defaultSize: { w: number; h: number }
  singleton?: boolean
}

export const APPS: Record<AppId, AppMeta> = {
  files: { id: 'files', name: 'Files', description: 'Browse folders and files', icon: FolderOpen, color: '#fbbf24', defaultSize: { w: 760, h: 480 } },
  terminal: { id: 'terminal', name: 'Terminal', description: 'Command line', icon: SquareTerminal, color: '#34d399', defaultSize: { w: 680, h: 420 } },
  settings: { id: 'settings', name: 'Settings', description: 'Personalize ORBIT', icon: Settings, color: '#94a3b8', defaultSize: { w: 820, h: 580 }, singleton: true },
  notes: { id: 'notes', name: 'Notes', description: 'Write and save notes', icon: StickyNote, color: '#f472b6', defaultSize: { w: 720, h: 460 }, singleton: true },
  calculator: { id: 'calculator', name: 'Calculator', description: 'Basic calculator', icon: Calculator, color: '#7c8cff', defaultSize: { w: 320, h: 470 }, singleton: true },
  browser: { id: 'browser', name: 'Browser', description: 'Simulated web browser', icon: Globe, color: '#22d3ee', defaultSize: { w: 860, h: 540 } },
}

export const APP_LIST = Object.values(APPS)
