import { useId } from 'react'
import type { Config, Field } from '../../automation/types'
import { WEEKDAY_LABELS, numList, str, strList } from '../../automation/config'
import { useRegisteredApps } from '../../os/registry'
import { useWorkspaces } from '../../store/workspaceStore'
import { useCustomWallpapers, customWallpaperId } from '../../store/wallpaperStore'
import { WALLPAPERS } from '../../theme/wallpapers'

const INPUT = 'field w-full px-2.5 py-1.5 text-[13px]'
// Monday first, matching the Calendar.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function Control({ field, config, onChange }: { field: Field; config: Config; onChange: (key: string, value: unknown) => void }) {
  const listId = useId()
  const apps = useRegisteredApps()
  const workspaces = useWorkspaces((s) => s.workspaces)
  const customs = useCustomWallpapers((s) => s.images)
  const set = (v: unknown) => onChange(field.key, v)
  const label = field.label

  switch (field.type) {
    case 'text':
    case 'path':
      return (
        <input
          aria-label={label} value={str(config, field.key)} placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
          className={`${INPUT} ${field.type === 'path' ? 'font-mono text-[12px]' : ''}`}
        />
      )
    case 'textarea':
      return (
        <textarea
          aria-label={label} value={str(config, field.key)} placeholder={field.placeholder} rows={4}
          onChange={(e) => set(e.target.value)}
          className={`${INPUT} resize-y font-mono text-[12px] leading-relaxed`}
        />
      )
    case 'number':
      return (
        <input
          aria-label={label} type="number" min={field.min} max={field.max}
          value={typeof config[field.key] === 'number' ? (config[field.key] as number) : ''}
          onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
          className={`${INPUT} w-28`}
        />
      )
    case 'time':
      return <input aria-label={label} type="time" value={str(config, field.key)} onChange={(e) => set(e.target.value)} className={`${INPUT} w-32`} />
    case 'select':
      return (
        <select aria-label={label} value={str(config, field.key)} onChange={(e) => set(e.target.value)} className={INPUT}>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    case 'app': {
      const current = str(config, field.key)
      const known = !current || apps.some((a) => a.id === current)
      return (
        <select aria-label={label} value={current} onChange={(e) => set(e.target.value)} className={INPUT}>
          {field.any ? <option value="">Any application</option> : <option value="" disabled>Choose…</option>}
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          {!known && <option value={current}>{current} (not installed)</option>}
        </select>
      )
    }
    case 'apps': {
      const chosen = strList(config, field.key)
      const toggle = (id: string) => set(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])
      return (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
          {apps.map((a) => (
            <button
              key={a.id} type="button" aria-pressed={chosen.includes(a.id)} onClick={() => toggle(a.id)}
              className={`border border-ink px-2.5 py-1 text-[12px] font-medium ${chosen.includes(a.id) ? 'bg-ink text-paper' : 'hover:bg-white/10'}`}
            >
              {a.name}
            </button>
          ))}
          {chosen.filter((id) => !apps.some((a) => a.id === id)).map((id) => (
            <button key={id} type="button" aria-pressed onClick={() => toggle(id)} className="border border-signal bg-signal px-2.5 py-1 text-[12px] font-medium text-[#fff]">
              {id} (not installed)
            </button>
          ))}
        </div>
      )
    }
    case 'workspace':
      return (
        <>
          <input
            aria-label={label} list={listId} value={str(config, field.key)}
            placeholder={field.any ? 'Any workspace' : field.placeholder ?? 'Workspace name'}
            onChange={(e) => set(e.target.value)} className={INPUT}
          />
          <datalist id={listId}>{workspaces.map((w) => <option key={w.id} value={w.name} />)}</datalist>
        </>
      )
    case 'wallpaper': {
      const current = str(config, field.key)
      const known = WALLPAPERS.some((w) => w.id === current) || customs.some((i) => customWallpaperId(i.id) === current)
      return (
        <select aria-label={label} value={current} onChange={(e) => set(e.target.value)} className={INPUT}>
          {WALLPAPERS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          {customs.map((i) => <option key={i.id} value={customWallpaperId(i.id)}>{i.name} (imported)</option>)}
          {!known && <option value={current}>Missing wallpaper</option>}
        </select>
      )
    }
    case 'days': {
      const chosen = numList(config, field.key)
      const toggle = (d: number) => set(chosen.includes(d) ? chosen.filter((x) => x !== d) : [...chosen, d])
      return (
        <div className="inline-flex border border-ink" role="group" aria-label={label}>
          {DAY_ORDER.map((d, i) => (
            <button
              key={d} type="button" aria-pressed={chosen.includes(d)} onClick={() => toggle(d)}
              className={`px-2.5 py-1 text-[12px] font-medium ${i > 0 ? 'border-l border-ink' : ''} ${chosen.includes(d) ? 'bg-ink text-paper' : 'hover:bg-white/10'}`}
            >
              {WEEKDAY_LABELS[d]}
            </button>
          ))}
        </div>
      )
    }
  }
}

/** Renders the parameter form for any trigger, condition or action from its field list. */
export function FieldEditor({ fields, config, onChange }: { fields: Field[]; config: Config; onChange: (config: Config) => void }) {
  if (!fields.length) return null
  const update = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  return (
    <div className="grid gap-3">
      {fields.map((f) => (
        <div key={f.key} className="grid gap-1">
          <span className="kicker">{f.label}</span>
          <Control field={f} config={config} onChange={update} />
          {f.hint && <span className="text-[11.5px] leading-snug text-white/55">{f.hint}</span>}
        </div>
      ))}
    </div>
  )
}
