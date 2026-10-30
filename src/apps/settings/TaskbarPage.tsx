import { useSettings } from '../../store/settingsStore'
import type { TaskbarPosition } from '../../store/settingsStore'
import { useClock } from '../../hooks/useClock'
import { Section, Segmented, SettingRow, Switch } from '../../components/shared/controls'

const POSITIONS: { value: TaskbarPosition; label: string }[] = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]

function ClockPreview() {
  const now = useClock()
  const { clock24h, clockSeconds, clockDate } = useSettings()
  const time = now.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: clockSeconds ? '2-digit' : undefined, hour12: !clock24h,
  })
  return (
    <div data-testid="clock-preview" className="border border-ink bg-field px-4 py-3 text-right">
      <div className="text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums">{time}</div>
      {clockDate && <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-white/60">{now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
    </div>
  )
}

export function TaskbarPage() {
  const s = useSettings()
  return (
    <>
      <Section title="Behavior">
        <SettingRow label="Position" hint="Where the taskbar sits on the screen.">
          <Segmented label="Taskbar position" value={s.taskbarPosition} options={POSITIONS} onChange={(taskbarPosition) => s.set({ taskbarPosition })} />
        </SettingRow>
        <SettingRow label="Automatically hide" hint="Move the pointer to the screen edge to bring it back.">
          <Switch label="Automatically hide taskbar" checked={s.taskbarAutoHide} onChange={(taskbarAutoHide) => s.set({ taskbarAutoHide })} />
        </SettingRow>
        <SettingRow label="Show app labels" hint="Horizontal taskbars only.">
          <Switch label="Show app labels" checked={s.taskbarLabels} onChange={(taskbarLabels) => s.set({ taskbarLabels })} />
        </SettingRow>
      </Section>

      <Section title="Clock">
        <SettingRow label="Time format">
          <Segmented
            label="Time format"
            value={s.clock24h ? '24' : '12'}
            options={[{ value: '12', label: '12-hour' }, { value: '24', label: '24-hour' }]}
            onChange={(v) => s.set({ clock24h: v === '24' })}
          />
        </SettingRow>
        <SettingRow label="Show seconds" hint="Horizontal taskbars only.">
          <Switch label="Show seconds" checked={s.clockSeconds} onChange={(clockSeconds) => s.set({ clockSeconds })} />
        </SettingRow>
        <SettingRow label="Show date" hint="Horizontal taskbars only.">
          <Switch label="Show date" checked={s.clockDate} onChange={(clockDate) => s.set({ clockDate })} />
        </SettingRow>
        <div className="mt-3 flex justify-end"><ClockPreview /></div>
      </Section>
    </>
  )
}
