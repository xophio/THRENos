import { Lock, LogOut, Power, RotateCcw, Users } from 'lucide-react'
import { Button, Section, SettingRow, Select, Switch } from '../../components/shared/controls'
import { useSettings } from '../../store/settingsStore'
import { useStartup } from '../../store/startupStore'
import { WALLPAPERS } from '../../theme/wallpapers'
import { lock, logout, restart, shutdown, switchUser } from '../../system/systemStore'

const AUTO_LOCK = [
  { value: '0', label: 'Never' },
  { value: '1', label: 'After 1 minute' },
  { value: '5', label: 'After 5 minutes' },
  { value: '15', label: 'After 15 minutes' },
  { value: '30', label: 'After 30 minutes' },
]

/** Lock screen, startup and power. Lock options belong to the profile; startup options belong to the device. */
export function StartupPage() {
  const s = useSettings()
  const startup = useStartup()
  const autoLock = String(s.autoLockMinutes)

  return (
    <>
      <Section title="Lock screen">
        <SettingRow label="Wallpaper" hint="What shows behind the lock and login screens.">
          <Select
            label="Lock screen wallpaper"
            value={s.lockWallpaper}
            options={[{ value: 'desktop', label: 'Same as desktop' }, ...WALLPAPERS.map((w) => ({ value: w.id, label: w.name }))]}
            onChange={(lockWallpaper) => s.set({ lockWallpaper })}
          />
        </SettingRow>
        <SettingRow label="Show status information" hint="Open windows, workspaces and notifications on the lock screen.">
          <Switch label="Show status information" checked={s.lockStatus} onChange={(lockStatus) => s.set({ lockStatus })} />
        </SettingRow>
        <SettingRow label="Lock automatically" hint="When there has been no mouse or keyboard activity.">
          <Select
            label="Lock automatically"
            value={AUTO_LOCK.some((o) => o.value === autoLock) ? autoLock : '0'}
            options={AUTO_LOCK}
            onChange={(v) => s.set({ autoLockMinutes: Number(v) })}
          />
        </SettingRow>
        <div className="pt-3"><Button icon={Lock} onClick={lock}>Lock now</Button></div>
        <p className="mt-3 text-[12px] text-white/60">Alt+L also locks. Windows, workspaces and apps stay exactly as you left them.</p>
      </Section>

      <Section title="Startup">
        <SettingRow label="Startup animation" hint="The animated THRENos start screen. Off shows a brief static screen instead.">
          <Switch label="Startup animation" checked={startup.animation} onChange={(animation) => startup.set({ animation })} />
        </SettingRow>
        <SettingRow label="Startup messages" hint="List what THRENos is doing while it starts.">
          <Switch label="Startup messages" checked={startup.messages} onChange={(messages) => startup.set({ messages })} />
        </SettingRow>
        <SettingRow label="Restore windows on startup" hint="Reopen your windows and workspaces after signing in. App contents start fresh.">
          <Switch label="Restore windows on startup" checked={s.restoreWindows} onChange={(restoreWindows) => s.set({ restoreWindows })} />
        </SettingRow>
        <p className="mt-3 text-[12px] text-white/60">Startup options apply the next time THRENos starts. They are shared by everyone on this device.</p>
      </Section>

      <Section title="Power">
        <div className="flex flex-wrap gap-2 pt-3">
          <Button icon={Lock} onClick={lock}>Lock</Button>
          <Button icon={Users} onClick={switchUser}>Switch user</Button>
          <Button icon={LogOut} onClick={logout}>Log out</Button>
          <Button icon={RotateCcw} onClick={restart}>Restart THRENos</Button>
          <Button icon={Power} tone="danger" onClick={shutdown}>Shut down THRENos</Button>
        </div>
        <p data-power-note className="mt-3 max-w-lg text-[12px] leading-relaxed text-white/60">
          These actions apply to THRENos in this browser tab only. They never lock, restart or shut down your computer, and
          signing out here does not sign you out of anything else.
        </p>
      </Section>
    </>
  )
}
