import type { ComponentType } from 'react'
import type { AppId, AppProps } from '../types'
import { FileExplorer } from './FileExplorer'
import { Terminal } from './Terminal'
import { SettingsApp } from './Settings'
import { Notes } from './Notes'
import { Calculator } from './Calculator'
import { Browser } from './Browser'

export const APP_COMPONENTS: Record<AppId, ComponentType<AppProps>> = {
  files: FileExplorer,
  terminal: Terminal,
  settings: SettingsApp,
  notes: Notes,
  calculator: Calculator,
  browser: Browser,
}
