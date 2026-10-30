export type AppId = string

export interface Rect { x: number; y: number; w: number; h: number }

/** Screen regions a window can snap to. "maximize" fills the work area but is tracked as `maximized`. */
export type SnapRegion =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'maximize'

/** The region a window is currently tiled into, or null when it is free-floating or maximized. */
export type SnapSide = Exclude<SnapRegion, 'maximize'> | null

export interface WindowState extends Rect {
  id: string
  appId: AppId
  /** The virtual desktop this window lives on. */
  workspaceId: string
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
  /** Registered id of the app this window belongs to. */
  appId: AppId
  props?: Record<string, unknown>
}
