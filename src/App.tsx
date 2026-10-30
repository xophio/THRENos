import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import { Desktop } from './components/desktop/Desktop'
import { WindowManager } from './components/window/WindowManager'
import { Taskbar } from './components/taskbar/Taskbar'
import { StartMenu } from './components/taskbar/StartMenu'
import { TrayPanels } from './components/taskbar/TrayPanels'
import { Toasts } from './components/taskbar/Toasts'
import { TaskOverview } from './components/overview/TaskOverview'
import { AppSwitcher } from './components/overview/AppSwitcher'
import { BootScreen } from './system/screens/BootScreen'
import { LockScreen } from './system/screens/LockScreen'
import { SetupScreen } from './system/screens/SetupScreen'
import { ShutdownScreen } from './system/screens/ShutdownScreen'
import { useSystem } from './system/systemStore'
import { useAutoLock } from './system/useAutoLock'
import { useShortcuts } from './hooks/useShortcuts'
import { useAppearance } from './hooks/useAppearance'
import { useSettings } from './store/settingsStore'
import { notify } from './store/notificationStore'
import { useScreen } from './utils/screen'

export default function App() {
  useShortcuts()
  useAppearance()
  useAutoLock()
  const screen = useScreen()
  const brightness = useSettings((s) => s.brightness)
  const phase = useSystem((s) => s.phase)
  const inSession = phase === 'desktop' || phase === 'locked'
  const locked = phase === 'locked'
  const welcomed = useRef(false)

  // Greet once per page load, the first time the desktop appears.
  useEffect(() => {
    if (phase !== 'desktop' || welcomed.current) return
    welcomed.current = true
    const t = setTimeout(() => notify('Welcome to THRENos', 'Press Ctrl+Space to search apps.'), 600)
    return () => clearTimeout(t)
  }, [phase])

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
        {/*
          While locked the desktop stays mounted (so every window, workspace and app keeps its state) but is
          hidden and inert: it cannot be seen, focused or clicked until the session is unlocked.
        */}
        {inSession && (
          <div data-shell data-locked={locked} inert={locked} aria-hidden={locked} className="absolute inset-0" style={{ visibility: locked ? 'hidden' : 'visible' }}>
            <Desktop />
            <WindowManager />
            <TaskOverview />
            <StartMenu />
            <TrayPanels />
            <Taskbar />
            <Toasts />
            <AppSwitcher />
          </div>
        )}
        <AnimatePresence>
          {phase === 'booting' && <BootScreen key="boot" />}
          {phase === 'setup' && <SetupScreen key="setup" />}
          {phase === 'locked' && <LockScreen key="lock" mode="lock" />}
          {phase === 'login' && <LockScreen key="login" mode="login" />}
          {phase === 'shutdown' && <ShutdownScreen key="shutdown" />}
        </AnimatePresence>
      </div>
      <div
        data-brightness-overlay
        className="pointer-events-none fixed inset-0 z-[99999] bg-black"
        style={{ opacity: ((100 - brightness) / 100) * 0.85 }}
      />
    </div>
  )
}
