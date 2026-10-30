import { useRef } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { ACCENTS, useSettings } from '../../store/settingsStore'
import type { ThemeMode, WallpaperFit } from '../../store/settingsStore'
import { MAX_CUSTOM_WALLPAPERS, customWallpaperId, useCustomWallpapers } from '../../store/wallpaperStore'
import { notify } from '../../store/notificationStore'
import { useResolvedTheme } from '../../hooks/useAppearance'
import { WALLPAPERS, wallpaperStyle } from '../../theme/wallpapers'
import { imageToWallpaper } from '../../utils/image'
import { Section, SettingRow, Segmented, Switch } from '../../components/shared/controls'

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Paper' },
  { value: 'dark', label: 'Charcoal' },
  { value: 'system', label: 'System' },
]

const FITS: { value: WallpaperFit; label: string }[] = [
  { value: 'cover', label: 'Fill' },
  { value: 'contain', label: 'Fit' },
  { value: 'stretch', label: 'Stretch' },
]

function Thumb({ active, onClick, style, label }: {
  active: boolean; onClick: () => void; style: React.CSSProperties; label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Wallpaper: ${label}`}
      aria-pressed={active}
      className={`relative h-24 w-full overflow-hidden rounded-md border text-left transition-colors ${active ? 'border-[var(--accent)] outline outline-2 -outline-offset-2 outline-[var(--accent)]' : 'border-ink'}`}
      style={style}
    >
      <span className="absolute bottom-0 left-0 bg-ink px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper">{label}</span>
    </button>
  )
}

export function PersonalizationPage() {
  const s = useSettings()
  const theme = useResolvedTheme()
  const images = useCustomWallpapers((st) => st.images)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await imageToWallpaper(file)
      const err = useCustomWallpapers.getState().add(file.name.replace(/\.[^.]+$/, ''), dataUrl)
      if (err) return notify('Upload failed', err)
      const added = useCustomWallpapers.getState().images.at(-1)
      if (added) s.set({ wallpaper: customWallpaperId(added.id) })
      notify('Wallpaper added', file.name)
    } catch (e) {
      notify('Upload failed', e instanceof Error ? e.message : 'Unknown error')
    }
  }

  const removeImage = (id: string) => {
    useCustomWallpapers.getState().remove(id)
    if (s.wallpaper === customWallpaperId(id)) s.set({ wallpaper: WALLPAPERS[0].id })
  }

  return (
    <>
      <Section title="Theme">
        <SettingRow label="Color mode" hint="Paper is light, Charcoal is dark. System follows your browser or OS.">
          <Segmented label="Color mode" value={s.theme} options={THEMES} onChange={(theme) => s.set({ theme })} />
        </SettingRow>
        <SettingRow label="Accent color" hint="Used sparingly: markers, focus and primary actions.">
          <div className="flex items-center gap-1.5">
            {ACCENTS.map((c) => (
              <button
                key={c.value}
                aria-label={`Accent ${c.value}`}
                title={c.name}
                aria-pressed={s.accent === c.value}
                onClick={() => s.set({ accent: c.value })}
                className={`size-7 rounded-sm border border-ink transition-transform ${s.accent === c.value ? 'outline outline-2 outline-offset-2 outline-ink' : 'hover:scale-105'}`}
                style={{ background: c.value }}
              />
            ))}
            <label className="relative ml-1 grid size-7 cursor-pointer place-items-center border border-dashed border-ink text-[13px] leading-none" title="Custom color">
              +
              <input
                type="color"
                aria-label="Custom accent color"
                value={/^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : '#d62929'}
                onChange={(e) => s.set({ accent: e.target.value })}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </SettingRow>
      </Section>

      <Section title="Wallpaper">
        <div className="mb-3 mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WALLPAPERS.map((w) => (
            <Thumb key={w.id} label={w.name} active={s.wallpaper === w.id} onClick={() => s.set({ wallpaper: w.id })} style={wallpaperStyle(w, theme)} />
          ))}
          {images.map((img) => {
            const id = customWallpaperId(img.id)
            return (
              <div key={img.id} className="relative">
                <Thumb
                  label={img.name}
                  active={s.wallpaper === id}
                  onClick={() => s.set({ wallpaper: id })}
                  style={{ background: `center / cover no-repeat url(${img.dataUrl})` }}
                />
                <button
                  aria-label={`Remove ${img.name}`}
                  onClick={() => removeImage(img.id)}
                  className="absolute right-0 top-0 grid size-7 place-items-center border-b border-l border-ink bg-paper hover:bg-signal hover:text-[#fff]"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
            )
          })}
          {images.length < MAX_CUSTOM_WALLPAPERS && (
            <button
              onClick={() => fileRef.current?.click()}
              className="grid h-24 place-items-center border border-dashed border-ink text-[12px] font-medium transition-colors hover:bg-white/10"
            >
              <span className="flex flex-col items-center gap-1.5"><Upload size={16} strokeWidth={1.5} /> Upload image</span>
            </button>
          )}
          <input
            ref={fileRef}
            data-testid="wallpaper-upload"
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }}
          />
        </div>
        <SettingRow label="Picture fit" hint="How uploaded images fill the screen.">
          <Segmented label="Picture fit" value={s.wallpaperFit} options={FITS} onChange={(wallpaperFit) => s.set({ wallpaperFit })} />
        </SettingRow>
      </Section>

      <Section title="Desktop">
        <SettingRow label="Layout grid" hint="Hairlines that mark the icon cells.">
          <Switch label="Layout grid" checked={s.desktopGrid} onChange={(desktopGrid) => s.set({ desktopGrid })} />
        </SettingRow>
        <SettingRow label="Clock block" hint="Large time and date on the desktop.">
          <Switch label="Clock block" checked={s.desktopClock} onChange={(desktopClock) => s.set({ desktopClock })} />
        </SettingRow>
      </Section>

      <Section title="Appearance">
        <SettingRow label="Animations" hint="Window, menu and hover motion.">
          <Switch label="Animations" checked={s.animations} onChange={(animations) => s.set({ animations })} />
        </SettingRow>
        <SettingRow label="Rounded corners" hint="Soften the otherwise square corners.">
          <Switch label="Rounded corners" checked={s.roundedCorners} onChange={(roundedCorners) => s.set({ roundedCorners })} />
        </SettingRow>
      </Section>
    </>
  )
}
