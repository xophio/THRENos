import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Maximize, MonitorUp, RotateCw, Save, ZoomIn, ZoomOut } from 'lucide-react'
import type { AppProps } from '../../types'
import { useAppCapabilities, useGranted } from '../../os/permissions'
import { useFs } from '../../store/fsStore'
import { useSettings } from '../../store/settingsStore'
import { customWallpaperId, useCustomWallpapers } from '../../store/wallpaperStore'
import { notify } from '../../store/notificationStore'
import { imageToWallpaper } from '../../utils/image'
import { HOME, baseName, joinPath } from '../../utils/path'
import { GALLERY, contentToSrc, isImageName, svgDataUrl } from './gallery'

interface Item { id: string; name: string; src: string; path?: string }

const PICTURES = `${HOME}/Pictures`
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function ImageViewer({ appId, props }: AppProps) {
  const caps = useAppCapabilities(appId)
  const allowed = useGranted(appId, 'filesystem')
  const tree = useFs((s) => s.tree)
  const [opened, setOpened] = useState<Item | null>(null)
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState(true)
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState<[number, number] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Pictures from the user's home folder (needs the Files permission) after the built-in gallery.
  const fileItems = useMemo<Item[]>(() => {
    if (!allowed) return []
    return caps.fs.list(PICTURES)
      .filter((e) => e.type === 'file' && isImageName(e.name))
      .flatMap((e) => {
        const src = contentToSrc(e.content ?? '')
        return src ? [{ id: e.path, name: e.name, src, path: e.path }] : []
      })
    // `tree` changes whenever the filesystem does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, allowed])

  const items = useMemo<Item[]>(() => {
    const builtIn = GALLERY.map((g) => ({ id: g.id, name: g.name, src: svgDataUrl(g.svg) }))
    const extra = opened && !fileItems.some((f) => f.path === opened.path) ? [opened] : []
    return [...builtIn, ...fileItems, ...extra]
  }, [fileItems, opened])

  // A file opened from the file manager is selected as soon as it is available.
  const requestedPath = props?.path as string | undefined
  useEffect(() => {
    if (!requestedPath) return
    const content = caps.fs.read(requestedPath)
    const src = content === null ? null : contentToSrc(content)
    if (!src) {
      notify('Cannot open image', allowed ? `${baseName(requestedPath)} is not a supported image.` : 'Image Viewer needs the Files permission.')
      return
    }
    setOpened({ id: requestedPath, name: baseName(requestedPath), src, path: requestedPath })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPath])

  useEffect(() => {
    if (!opened) return
    const i = items.findIndex((it) => it.id === opened.id)
    if (i >= 0) setIndex(i)
  }, [opened, items])

  const safeIndex = clamp(index, 0, items.length - 1)
  const current = items[safeIndex]

  const go = (delta: number) => { setIndex((safeIndex + delta + items.length) % items.length); reset() }
  const reset = () => { setZoom(1); setFit(true); setRotation(0); setSize(null) }
  const zoomBy = (f: number) => { setFit(false); setZoom((z) => clamp(+(z * f).toFixed(2), 0.1, 6)) }

  const saveToPictures = () => {
    if (!current || current.path) return
    const svg = GALLERY.find((g) => g.id === current.id)?.svg
    if (!svg) return
    caps.fs.mkdir(PICTURES)
    let name = `${current.name}.svg`
    for (let i = 2; caps.fs.exists(joinPath(PICTURES, name)); i++) name = `${current.name} ${i}.svg`
    const err = caps.fs.write(joinPath(PICTURES, name), svg)
    notify(err ? 'Could not save' : 'Saved to Pictures', err ?? name)
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = await imageToWallpaper(file)
      let name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
      caps.fs.mkdir(PICTURES)
      for (let i = 2; caps.fs.exists(joinPath(PICTURES, name)); i++) name = `${file.name.replace(/\.[^.]+$/, '')} ${i}.jpg`
      const err = caps.fs.write(joinPath(PICTURES, name), data)
      notify(err ? 'Import failed' : 'Imported', err ?? name)
    } catch (e) {
      notify('Import failed', e instanceof Error ? e.message : 'Unknown error')
    }
  }

  const setWallpaper = () => {
    if (!current) return
    const store = useCustomWallpapers.getState()
    const err = store.add(current.name, current.src)
    if (err) return notify('Could not set wallpaper', err)
    const added = useCustomWallpapers.getState().images.at(-1)
    if (added) useSettings.getState().set({ wallpaper: customWallpaperId(added.id) })
    notify('Wallpaper set', current.name)
  }

  const tool = 'ibtn grid size-8 place-items-center'

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-ink px-3 py-1.5">
        <button aria-label="Previous image" onClick={() => go(-1)} className={tool}><ChevronLeft size={16} /></button>
        <button aria-label="Next image" onClick={() => go(1)} className={tool}><ChevronRight size={16} /></button>
        <div className="mx-1 h-5 w-px bg-rule" />
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)} className={tool}><ZoomOut size={15} /></button>
        <span data-zoom className="w-12 text-center font-mono text-[11px] text-white/70">{fit ? 'Fit' : `${Math.round(zoom * 100)}%`}</span>
        <button aria-label="Zoom in" onClick={() => zoomBy(1.25)} className={tool}><ZoomIn size={15} /></button>
        <button aria-label="Fit to window" onClick={() => { setFit(true); setZoom(1) }} className={tool}><Maximize size={15} /></button>
        <button aria-label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)} className={tool}><RotateCw size={15} /></button>
        <div className="flex-1" />
        <button onClick={setWallpaper} className="ibtn flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-medium"><MonitorUp size={14} /> Set as wallpaper</button>
        {current && !current.path && (
          <button onClick={saveToPictures} disabled={!allowed} data-action="save-to-pictures" className="ibtn flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-medium"><Save size={14} /> Save to Pictures</button>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={!allowed} className="ibtn flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-medium"><ImagePlus size={14} /> Import</button>
        <input ref={fileRef} data-testid="viewer-import" type="file" accept="image/*" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {!allowed && (
        <div data-files-blocked className="border-b border-signal px-4 py-2 text-[12px] text-signal">
          Files access is blocked for Image Viewer, so only the built-in gallery is shown. Allow it in Settings → Apps.
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-auto bg-sidebar">
        <div className={fit ? 'flex h-full w-full items-center justify-center p-6' : 'grid min-h-full min-w-full place-items-center p-6'}>
          {current && (
            <img
              data-viewer-image
              src={current.src}
              alt={current.name}
              draggable={false}
              onLoad={(e) => setSize([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])}
              className={`border border-ink bg-paper ${fit ? 'max-h-full max-w-full object-contain' : ''}`}
              style={{
                transform: `rotate(${rotation}deg)`,
                ...(fit ? {} : { width: size ? size[0] * zoom : undefined, maxWidth: 'none' }),
              }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-ink px-4 py-1.5 font-mono text-[10.5px] text-white/65">
        <span data-viewer-name>{current?.name}{size ? ` · ${size[0]}×${size[1]}` : ''}</span>
        <span>{safeIndex + 1} / {items.length}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-rule-soft p-2">
        {items.map((it, i) => (
          <button
            key={it.id}
            data-thumb={it.id}
            title={it.name}
            onClick={() => { setIndex(i); reset() }}
            className={`size-14 shrink-0 border bg-paper p-0.5 ${i === safeIndex ? 'border-[var(--accent)] outline outline-2 -outline-offset-2 outline-[var(--accent)]' : 'border-ink'}`}
          >
            <img src={it.src} alt="" className="size-full object-cover" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  )
}
