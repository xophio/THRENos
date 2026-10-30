import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { bootOS } from './os/boot'
import { startWindowSession } from './store/windowSession'

bootOS()
startWindowSession()

// Development-only handle for inspecting the app ecosystem from the browser console and tests.
if (import.meta.env.DEV) {
  void Promise.all([
    import('./os/installer'), import('./os/permissions'), import('./os/registry'), import('./os/appData'),
    import('./store/workspaceStore'), import('./store/windowStore'),
  ]).then(([installer, permissions, registry, appData, workspaces, windows]) => {
    Object.assign(window, { __orbit: { ...installer, ...permissions, ...registry, ...appData, ...workspaces, ...windows } })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
