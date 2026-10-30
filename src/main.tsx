import './migrateLegacyStorage' // must run before any store reads localStorage
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { bootOS } from './os/boot'
import './store/windowSession' // starts saving the window layout while a session is running

bootOS()

// Development-only handle for inspecting the app ecosystem from the browser console and tests.
if (import.meta.env.DEV) {
  void Promise.all([
    import('./os/installer'), import('./os/permissions'), import('./os/registry'), import('./os/appData'),
    import('./store/workspaceStore'), import('./store/windowStore'), import('./system/systemStore'), import('./system/auth'), import('./system/authStore'),
  ]).then(([installer, permissions, registry, appData, workspaces, windows, system, auth, authStore]) => {
    Object.assign(window, { __threnos: { ...installer, ...permissions, ...registry, ...appData, ...workspaces, ...windows, ...system, ...auth, ...authStore } })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
