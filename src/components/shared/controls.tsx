import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** A titled block of settings: ink rule on top, small uppercase heading. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-9">
      {title && (
        <div className="flex items-center border-t border-ink pb-1 pt-2">
          <h3 className="kicker">{title}</h3>
        </div>
      )}
      {children}
    </section>
  )
}

export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-rule-soft py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-snug text-white/60">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Square on/off switch. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 rounded-sm border border-ink transition-colors ${checked ? 'bg-ink' : 'bg-transparent'}`}
    >
      <span
        className={`absolute top-[2px] size-3 transition-all ${checked ? 'left-[22px] bg-paper' : 'left-[2px] bg-ink'}`}
      />
    </button>
  )
}

export interface SegmentOption<T extends string | number> { value: T; label: string; icon?: LucideIcon }

/** Joined buttons sharing hairlines; the selected one is inverted. */
export function Segmented<T extends string | number>({
  value, options, onChange, label,
}: { value: T; options: SegmentOption<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-ink">
      {options.map((o, i) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors ${i > 0 ? 'border-l border-ink' : ''} ${
            value === o.value ? 'bg-ink text-paper' : 'hover:bg-white/10'
          }`}
        >
          {o.icon && <o.icon size={13} strokeWidth={1.5} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  value, min, max, onChange, label, format = (v) => String(v), onCommit,
}: {
  value: number; min: number; max: number; label: string
  onChange: (v: number) => void
  format?: (v: number) => string
  onCommit?: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={min} max={max} value={value} aria-label={label}
        onChange={(e) => onChange(+e.target.value)}
        onPointerUp={onCommit}
        className="w-44"
      />
      <span className="w-12 text-right font-mono text-[12px] tabular-nums text-white/70">{format(value)}</span>
    </div>
  )
}

export function Select<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="field px-3 py-1.5 text-[13px]"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function Button({
  children, onClick, tone = 'default', disabled, icon: Icon,
}: { children: ReactNode; onClick: () => void; tone?: 'default' | 'danger' | 'accent'; disabled?: boolean; icon?: LucideIcon }) {
  const cls =
    tone === 'danger' ? 'border-signal text-signal hover:bg-signal hover:text-[#fff]'
    : tone === 'accent' ? 'accent-bg border-[var(--accent)] hover:opacity-90'
    : 'border-ink hover-invert'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${cls}`}
    >
      {Icon && <Icon size={13} strokeWidth={1.5} />}
      {children}
    </button>
  )
}
