import { RotateCcw } from 'lucide-react'
import { RESOLUTIONS, SCALES, DEFAULTS, useSettings } from '../../store/settingsStore'
import { useScreen } from '../../utils/screen'
import { Button, Section, Segmented, SettingRow, Select, Slider } from '../../components/shared/controls'

export function DisplayPage() {
  const s = useSettings()
  const screen = useScreen()

  return (
    <>
      <Section title="Screen">
        <SettingRow label="Resolution" hint="Simulates a monitor. Larger resolutions fit more on screen.">
          <Select
            label="Resolution"
            value={s.resolution}
            options={RESOLUTIONS.map((r) => ({ value: r.id, label: r.label }))}
            onChange={(resolution) => s.set({ resolution })}
          />
        </SettingRow>
        <SettingRow label="Scale" hint="Makes text and apps larger or smaller.">
          <Segmented
            label="Display scale"
            value={s.scale}
            options={SCALES.map((v) => ({ value: v, label: `${v}%` }))}
            onChange={(scale) => s.set({ scale })}
          />
        </SettingRow>
        <SettingRow label="Brightness" hint="Dims the whole display.">
          <Slider
            label="Brightness"
            min={20}
            max={100}
            value={s.brightness}
            onChange={(brightness) => s.set({ brightness })}
            format={(v) => `${v}%`}
          />
        </SettingRow>
      </Section>

      <Section title="Current display">
        <div className="border border-rule bg-field p-4 text-[12px] leading-relaxed text-white/65">
          <div data-testid="display-info">
            Working area <b className="font-mono font-medium text-ink">{Math.round(screen.w)} × {Math.round(screen.h)}</b> px at{' '}
            <b className="font-mono font-medium text-ink">{Math.round(screen.k * 100)}%</b> zoom
          </div>
          <div className="mt-1">Browser window {window.innerWidth} × {window.innerHeight} px</div>
        </div>
        <div className="mt-3">
          <Button
            icon={RotateCcw}
            onClick={() => s.set({ resolution: DEFAULTS.resolution, scale: DEFAULTS.scale, brightness: DEFAULTS.brightness })}
          >
            Reset display
          </Button>
        </div>
      </Section>
    </>
  )
}
