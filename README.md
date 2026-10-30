# THRENos

A desktop operating system that runs entirely in the browser, designed in the Swiss / International Typographic Style.

Everything is simulated and saved in your browser's localStorage: files, notes, settings and terminal history.

## Features

- **Desktop:** draggable icons on a layout grid, editorial clock block, right-click menu, wallpapers (built-in or your own upload).
- **Window management:** drag, resize, minimize, maximize, snap to halves and quadrants (by dragging or keyboard), focus and stacking, cascade and tile. Windows stay inside the usable desktop area.
- **Workspaces:** create, rename, switch and delete virtual desktops, and move windows between them. Windows stay mounted, so app state is never duplicated or lost.
- **Task overview and Alt+Tab:** a full-screen overview of every window grouped by workspace, and an app switcher that activates on Alt release.
- **Taskbar:** Start menu with app search, running apps, notifications, volume, clock. Bottom, top, left or right, with auto-hide.
- **Apps**
  - **Files:** folders and files, copy / cut / paste, rename, delete, search, sorting, grid and list views, properties, keyboard shortcuts.
  - **Terminal:** `ls cd pwd mkdir touch cat echo rm mv cp` and more, with `;` `&&` `||` pipes and redirects, tab completion, persistent history and syntax highlighting. It only touches the simulated filesystem.
  - **Settings:** theme (Paper / Charcoal), accent, wallpaper, display resolution, scale and brightness, taskbar, sound, storage and device info.
  - **Notes, Calculator, Browser.**
  - **App Store:** discover, search, filter, install and uninstall apps, with progress, details, permissions and duplicate protection.
  - **Store apps:** Calendar, Markdown Editor, Weather (mock data), Music Player (synthesized original tracks), Image Viewer, Clock (world clock, stopwatch, timer).

## App ecosystem

Apps are described by a manifest and registered at runtime. The desktop, Start menu, taskbar and window manager only read the registry, so none of them change when an app is added or removed.

```
src/os/
  types.ts        manifest, permissions, categories
  registry.ts     register / unregister, hooks for the UI
  catalog.ts      every app the OS can run (add yours here)
  installStore.ts persisted install state, permission grants, shortcuts
  installer.ts    install (with progress) and uninstall
  lifecycle.ts    launch, file associations, closing an app's windows
  appData.ts      per-app persistent state (private to each app id)
  permissions.ts  permission checks and the capability API apps use
  boot.ts         builds the registry from saved state, tolerating damaged data
```

To add an app: write a component, then add one manifest to `src/os/catalog.ts`.

- **Data isolation:** apps keep data with `useAppState(appId, key, initial)`, which only reaches that app's own bucket.
- **Permissions:** apps reach files and notifications through `useAppCapabilities(appId)`. Users can revoke permissions in Settings → Apps, and file access is confined to the home folder.
- **Uninstalling:** this removes the registration, shortcuts and permission settings. It never touches your files, and app data is kept unless you choose to delete it.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+Space | Start menu / search |
| Alt+T / Alt+E | Open Terminal / Files |
| Alt+Tab (or Alt+`) | Switch windows; release Alt to activate, Shift reverses, Esc cancels |
| Alt+O | Task overview |
| Alt+W / Alt+M / Alt+F | Close / minimize / maximize or restore |
| Alt+← → ↑ ↓ | Snap to left / right / top / bottom half |
| Alt+U / I / J / K | Snap to top-left / top-right / bottom-left / bottom-right |
| Alt+D / Alt+Shift+D | Minimize all / restore minimized windows |
| Alt+Shift+← → | Previous / next workspace |
| Alt+Shift+1…9 | Go to workspace |
| Alt+Ctrl+Shift+← → | Move the focused window to the previous / next workspace |

Pressing a snap shortcut again restores the window. Dragging to an edge snaps to a half, to a corner snaps to a quarter, and the top edge maximizes. Right-click a title bar for snap and move-to-workspace options.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
```

## Tech

React, TypeScript, Vite, Tailwind CSS v4, Motion, Zustand, Lucide.

## Structure

```
src/
  os/            app registry, installer, lifecycle, permissions, app data
  apps/          Files, Terminal, Settings, Notes, Calculator, Browser, App Store and store apps
  components/    desktop, taskbar, window and shared UI
  store/         Zustand stores (windows, filesystem, settings, ...)
  hooks/         appearance, wallpaper, shortcuts, clock
  theme/         wallpaper compositions
  styles/        design tokens and base styles
  utils/         screen metrics, paths, sound, storage helpers
```

The design system lives in `src/styles/index.css`: warm paper, charcoal ink, neutral greys and a single signal-red accent, with flat 1px rules and square corners.

## License

MIT
