import { Plus, X } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { useWindows } from '../../store/windowStore'
import { MAX_NAME, MAX_WORKSPACES, useWorkspaces } from '../../store/workspaceStore'
import { createWorkspace, deleteWorkspace, renameWorkspace } from '../../store/workspaceActions'
import type { TaskbarPosition } from '../../store/settingsStore'
import { useClock } from '../../hooks/useClock'
import { Button, Section, Segmented, SettingRow, Switch } from '../../components/shared/controls'

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

/** Rename on Enter or blur, delete (windows move to the neighbouring workspace), and add. */
function WorkspaceList() {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const activeId = useWorkspaces((s) => s.activeId)
  const windows = useWindows((s) => s.windows)

  return (
    <div>
      {workspaces.map((w, i) => (
        <div key={w.id} data-settings-workspace={w.id} className="flex items-center gap-3 border-b border-rule-soft py-2.5">
          <span className="w-6 font-mono text-[10.5px] text-white/55">{String(i + 1).padStart(2, '0')}</span>
          <input
            aria-label={`Name of workspace ${i + 1}`}
            defaultValue={w.name}
            key={w.name}
            maxLength={MAX_NAME}
            onBlur={(e) => { if (e.target.value.trim()) renameWorkspace(w.id, e.target.value); else e.target.value = w.name }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="field min-w-0 flex-1 px-2.5 py-1.5 text-[13px]"
          />
          <span className="w-24 text-right font-mono text-[11px] text-white/60">
            {windows.filter((x) => x.workspaceId === w.id).length} windows
          </span>
          <span className="w-16 text-right">{w.id === activeId && <span className="kicker !text-[var(--accent)]">Current</span>}</span>
          <button
            aria-label={`Delete ${w.name}`}
            disabled={workspaces.length <= 1}
            onClick={() => deleteWorkspace(w.id)}
            className="ibtn grid size-7 place-items-center disabled:opacity-30"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="mt-3">
        <Button icon={Plus} disabled={workspaces.length >= MAX_WORKSPACES} onClick={() => createWorkspace()}>Add workspace</Button>
      </div>
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

      <Section title="Windows">
        <SettingRow label="Group windows by app" hint="One taskbar button per app, with a count when it has several windows.">
          <Switch label="Group windows by app" checked={s.taskbarGrouping} onChange={(taskbarGrouping) => s.set({ taskbarGrouping })} />
        </SettingRow>
        <SettingRow label="Show all workspaces on the taskbar" hint="Otherwise only the current workspace's windows are listed.">
          <Switch label="Show all workspaces on the taskbar" checked={s.taskbarAllWorkspaces} onChange={(taskbarAllWorkspaces) => s.set({ taskbarAllWorkspaces })} />
        </SettingRow>
        <SettingRow label="Show snap preview" hint="Outline the target area while dragging a window to an edge or corner.">
          <Switch label="Show snap preview" checked={s.snapPreview} onChange={(snapPreview) => s.set({ snapPreview })} />
        </SettingRow>
        <SettingRow label="Restore windows on startup" hint="Reopen windows, workspaces and layout after a refresh. App contents start fresh.">
          <Switch label="Restore windows on startup" checked={s.restoreWindows} onChange={(restoreWindows) => s.set({ restoreWindows })} />
        </SettingRow>
      </Section>

      <Section title="Workspaces">
        <WorkspaceList />
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
