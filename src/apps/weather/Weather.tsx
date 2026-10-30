import { useMemo, useState } from 'react'
import { Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, MapPin, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppProps } from '../../types'
import { useAppState } from '../../os/appData'
import { useAppCapabilities } from '../../os/permissions'
import { CITIES, HOME_CITY, report, toUnit } from './data'
import type { Condition } from './data'
import { Segmented } from '../../components/shared/controls'

const ICONS: Record<Condition, LucideIcon> = {
  Clear: Sun,
  'Partly cloudy': CloudSun,
  Cloudy: Cloud,
  Rain: CloudRain,
  Thunderstorm: CloudLightning,
  Snow: CloudSnow,
}

export function Weather({ appId }: AppProps) {
  const caps = useAppCapabilities(appId)
  const [cityId, setCityId] = useAppState(appId, 'city', HOME_CITY)
  const [unit, setUnit] = useAppState<'C' | 'F'>(appId, 'unit', 'C')
  const [notice, setNotice] = useState('')

  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0]
  const now = new Date()
  const data = useMemo(() => report(city, now), [city.id, now.getDate()]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = (c: number) => toUnit(c, unit)
  const Icon = ICONS[data.condition]
  const maxHour = Math.max(...data.hours.map((h) => h.temp))
  const minHour = Math.min(...data.hours.map((h) => h.temp))

  const locate = () => {
    if (!caps.can('location')) {
      setNotice('Location access is blocked. Allow it for Weather in Settings → Apps.')
      return
    }
    setCityId(HOME_CITY)
    setNotice('')
  }

  return (
    <div className="flex h-full max-md:flex-col">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink bg-sidebar max-md:w-full max-md:border-b max-md:border-r-0">
        <div className="flex items-center justify-between border-b border-ink px-4 py-2.5">
          <span className="kicker !text-ink">Cities</span>
          <button data-action="locate" onClick={locate} className="flex items-center gap-1 text-[11px] font-medium text-white/70 hover:text-[var(--accent)]">
            <MapPin size={12} /> My location
          </button>
        </div>
        {notice && <div data-weather-notice className="border-b border-rule-soft px-4 py-2 text-[11.5px] leading-snug text-signal">{notice}</div>}
        <div className="min-h-0 flex-1 overflow-auto max-md:flex max-md:overflow-x-auto">
          {CITIES.map((c) => {
            const r = report(c, now)
            const on = c.id === city.id
            const CIcon = ICONS[r.condition]
            return (
              <button
                key={c.id}
                data-city={c.id}
                onClick={() => setCityId(c.id)}
                className={`flex w-full items-center gap-3 border-b border-rule-soft px-4 py-3 text-left transition-colors max-md:w-44 max-md:shrink-0 ${on ? 'bg-ink text-paper' : 'hover:bg-white/[0.07]'}`}
              >
                <CIcon size={16} strokeWidth={1.4} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{c.name}</span>
                  <span className={`block truncate text-[11px] ${on ? 'text-paper/70' : 'text-white/55'}`}>{c.country}</span>
                </span>
                <span className="font-mono text-[13px] tabular-nums">{t(r.temp)}°</span>
              </button>
            )
          })}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto">
        <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-8 pb-5 pt-6">
          <div>
            <div className="kicker">{city.country} · {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <h2 className="mt-2 text-[34px] font-bold leading-none tracking-[-0.045em]">{city.name}</h2>
            <div className="mt-5 flex items-end gap-4">
              <span data-weather-temp className="text-[96px] font-bold leading-[0.8] tracking-[-0.07em] tabular-nums">{t(data.temp)}°</span>
              <span className="pb-1 text-[22px] font-light text-white/60">{unit}</span>
              <Icon size={44} strokeWidth={1.1} className="mb-1 ml-3" />
            </div>
            <div className="mt-4 text-[15px] font-semibold">{data.condition}</div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Segmented
              label="Temperature unit"
              value={unit}
              options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]}
              onChange={setUnit}
            />
            <span className="kicker">Mock data</span>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-ink">
          {[
            ['Feels like', `${t(data.feelsLike)}°`],
            ['Humidity', `${data.humidity}%`],
            ['Wind', `${data.wind} km/h`],
          ].map(([label, value], i) => (
            <div key={label} className={`px-8 py-4 ${i > 0 ? 'border-l border-rule-soft' : ''}`}>
              <div className="kicker">{label}</div>
              <div className="mt-2 font-mono text-[18px] font-medium tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        <div className="border-b border-ink px-8 py-5">
          <div className="kicker mb-3">Next 24 hours</div>
          <div className="flex h-32 gap-[3px]">
            {data.hours.map((h) => {
              const height = 14 + ((h.temp - minHour) / Math.max(1, maxHour - minHour)) * 86
              const current = h.hour === now.getHours()
              return (
                <div key={h.hour} className="flex h-full flex-1 flex-col items-center gap-1" title={`${String(h.hour).padStart(2, '0')}:00 · ${t(h.temp)}°`}>
                  <span className="h-3 font-mono text-[9px] tabular-nums text-white/60">{h.hour % 3 === 0 ? t(h.temp) : ''}</span>
                  <div className="flex w-full min-h-0 flex-1 items-end">
                    <div data-hour-bar className={`w-full ${current ? 'bg-[var(--accent)]' : 'bg-ink'}`} style={{ height: `${height}%` }} />
                  </div>
                  <span className="h-3 font-mono text-[9px] text-white/50">{h.hour % 6 === 0 ? String(h.hour).padStart(2, '0') : ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-8 py-5">
          <div className="kicker mb-2">5-day forecast</div>
          {data.days.map((d, i) => {
            const DIcon = ICONS[d.condition]
            return (
              <div key={i} data-forecast-day className="grid grid-cols-[110px_28px_1fr_90px] items-center gap-3 border-b border-rule-soft py-2.5 text-[13px]">
                <span className="font-semibold">{i === 0 ? 'Today' : d.date.toLocaleDateString([], { weekday: 'long' })}</span>
                <DIcon size={16} strokeWidth={1.4} />
                <span className="text-white/65">{d.condition}</span>
                <span className="text-right font-mono tabular-nums">{t(d.high)}° <span className="text-white/50">{t(d.low)}°</span></span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
