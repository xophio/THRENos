# ORBIT OS

A desktop operating system that runs entirely in the browser, designed in the Swiss / International Typographic Style.

Everything is simulated and saved in your browser's localStorage: files, notes, settings and terminal history.

## Features

- **Desktop:** draggable icons on a layout grid, editorial clock block, right-click menu, wallpapers (built-in or your own upload).
- **Window management:** drag, resize, minimize, maximize, snap to edges, focus and stacking, cascade and tile.
- **Taskbar:** Start menu with app search, running apps, notifications, volume, clock. Bottom, top, left or right, with auto-hide.
- **Apps**
  - **Files:** folders and files, copy / cut / paste, rename, delete, search, sorting, grid and list views, properties, keyboard shortcuts.
  - **Terminal:** `ls cd pwd mkdir touch cat echo rm mv cp` and more, with `;` `&&` `||` pipes and redirects, tab completion, persistent history and syntax highlighting. It only touches the simulated filesystem.
  - **Settings:** theme (Paper / Charcoal), accent, wallpaper, display resolution, scale and brightness, taskbar, sound, storage and device info.
  - **Notes, Calculator, Browser.**

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+Space | Start menu / search |
| Alt+T / Alt+E | Open Terminal / Files |
| Alt+W / Alt+M / Alt+F | Close / minimize / maximize window |
| Alt+← / → / ↑ | Snap window left / right / maximize |
| Alt+D | Show desktop |

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
  apps/          Files, Terminal, Settings, Notes, Calculator, Browser
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
