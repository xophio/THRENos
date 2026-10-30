import { useEffect } from 'react'
import { Desktop } from './components/desktop/Desktop'
import { WindowManager } from './components/window/WindowManager'
import { Taskbar } from './components/taskbar/Taskbar'
import { StartMenu } from './components/taskbar/StartMenu'
import { TrayPanels } from './components/taskbar/TrayPanels'
import { Toasts } from './components/taskbar/Toasts'
import { TaskOverview } from './components/overview/TaskOverview'
import { AppSwitcher } from './components/overview/AppSwitcher'
import { useShortcuts } from './hooks/useShortcuts'
import { useAppearance } from './hooks/useAppearance'
import { useSettings } from './store/settingsStore'
import { notify } from './store/notificationStore'
import { useScreen } from './utils/screen'

export default function App() {
  useShortcuts()
  useAppearance()
  const screen = useScreen()
  const brightness = useSettings((s) => s.brightness)

  useEffect(() => {
    const t = setTimeout(() => notify('Welcome to ORBIT OS', 'Press Ctrl+Space to search apps.'), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div
        id="os-screen"
        className="absolute overflow-hidden"
        style={{
          left: screen.left, top: screen.top, width: screen.w, height: screen.h,
          transform: `scale(${screen.k})`, transformOrigin: '0 0',
        }}
      >
        <Desktop />
        <WindowManager />
        <TaskOverview />
        <StartMenu />
        <TrayPanels />
        <Taskbar />
        <Toasts />
        <AppSwitcher />
      </div>
      <div
        data-brightness-overlay
        className="pointer-events-none fixed inset-0 z-[99999] bg-black"
        style={{ opacity: ((100 - brightness) / 100) * 0.85 }}
      />
    </div>
  )
}
