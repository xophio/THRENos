export type AppId = 'files' | 'terminal' | 'settings' | 'notes' | 'calculator' | 'browser'

export interface Rect { x: number; y: number; w: number; h: number }

export type SnapSide = 'left' | 'right' | 'top' | null

export interface WindowState extends Rect {
  id: string
  appId: AppId
  title: string
  z: number
  minimized: boolean
  maximized: boolean
  snap: SnapSide
  restore: Rect | null
  props?: Record<string, unknown>
}

export interface FsNode {
  type: 'file' | 'folder'
  content?: string
  mtime: number
}

export interface Notification {
  id: string
  title: string
  body?: string
  time: number
}

export interface Note {
  id: string
  title: string
  body: string
  updated: number
}

export interface AppProps {
  windowId: string
  props?: Record<string, unknown>
}
