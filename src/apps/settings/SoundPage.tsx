import { Play, Volume2, VolumeX } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { playSound } from '../../utils/sound'
import type { SoundName } from '../../utils/sound'
import { Button, Section, SettingRow, Slider, Switch } from '../../components/shared/controls'

const SAMPLES: { name: SoundName; label: string }[] = [
  { name: 'open', label: 'Open' },
  { name: 'close', label: 'Close' },
  { name: 'minimize', label: 'Minimize' },
  { name: 'notify', label: 'Notification' },
  { name: 'error', label: 'Error' },
]

export function SoundPage() {
  const s = useSettings()
  const silent = s.muted || s.volume === 0

  return (
    <>
      <Section title="Output">
        <SettingRow label="Master volume">
          <div className="flex items-center gap-2">
            <button aria-label={s.muted ? 'Unmute' : 'Mute'} onClick={() => s.set({ muted: !s.muted })} className="ibtn grid size-7 place-items-center">
              {silent ? <VolumeX size={16} strokeWidth={1.5} /> : <Volume2 size={16} strokeWidth={1.5} />}
            </button>
            <Slider
              label="Volume"
              min={0}
              max={100}
              value={s.muted ? 0 : s.volume}
              onChange={(volume) => s.set({ volume, muted: false })}
              onCommit={() => playSound('click', true)}
              format={(v) => `${v}%`}
            />
          </div>
        </SettingRow>
        <SettingRow label="Mute">
          <Switch label="Mute" checked={s.muted} onChange={(muted) => s.set({ muted })} />
        </SettingRow>
      </Section>

      <Section title="System sounds">
        <SettingRow label="Sound effects" hint="Play sounds when windows open, close and notifications arrive.">
          <Switch label="Sound effects" checked={s.soundEffects} onChange={(soundEffects) => s.set({ soundEffects })} />
        </SettingRow>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLES.map((x) => (
            <Button key={x.name} icon={Play} onClick={() => playSound(x.name, true)}>{x.label}</Button>
          ))}
        </div>
        {silent && <p className="mt-3 text-[12px] text-white/60">Sound is muted, so samples will not play.</p>}
      </Section>
    </>
  )
}
