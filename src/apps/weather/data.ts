export type Condition = 'Clear' | 'Partly cloudy' | 'Cloudy' | 'Rain' | 'Thunderstorm' | 'Snow'

export interface City { id: string; name: string; country: string; mean: number; swing: number; south?: boolean }

// Climate normals (rough annual mean and seasonal swing, °C). Forecasts are generated, not real.
export const CITIES: City[] = [
  { id: 'zurich', name: 'Zurich', country: 'Switzerland', mean: 9.5, swing: 10 },
  { id: 'basel', name: 'Basel', country: 'Switzerland', mean: 11, swing: 10 },
  { id: 'reykjavik', name: 'Reykjavik', country: 'Iceland', mean: 4.5, swing: 6 },
  { id: 'newyork', name: 'New York', country: 'United States', mean: 13, swing: 13 },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', mean: 27, swing: 2 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', mean: 27.5, swing: 1 },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', mean: 16, swing: 10 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', mean: 18, swing: 6, south: true },
]

/** Where the "Use my location" button points: a fixed, fictional device location. */
export const HOME_CITY = 'zurich'

export interface Day {
  date: Date
  condition: Condition
  high: number
  low: number
}

export interface Hour { hour: number; temp: number }

export interface Report {
  temp: number
  feelsLike: number
  condition: Condition
  humidity: number
  wind: number
  hours: Hour[]
  days: Day[]
}

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Small deterministic PRNG so the same city and day always produce the same report. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function seasonal(city: City, date: Date) {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  const phase = Math.cos(((dayOfYear - 200) / 365) * Math.PI * 2) // warmest around late July
  return city.mean + (city.south ? -phase : phase) * city.swing
}

function dayWeather(city: City, date: Date): Day {
  const r = rng(hash(city.id + dayKey(date)))
  const base = seasonal(city, date) + (r() - 0.5) * 5
  const roll = r()
  const tropical = city.mean > 24
  let condition: Condition
  if (roll < 0.28) condition = 'Clear'
  else if (roll < 0.52) condition = 'Partly cloudy'
  else if (roll < 0.72) condition = 'Cloudy'
  else if (roll < (tropical ? 0.95 : 0.92)) condition = base < 1 ? 'Snow' : 'Rain'
  else condition = tropical ? 'Thunderstorm' : base < 1 ? 'Snow' : 'Thunderstorm'
  const spread = 3 + r() * 4
  return { date, condition, high: Math.round(base + spread / 2), low: Math.round(base - spread / 2) }
}

export function report(city: City, now = new Date()): Report {
  const today = dayWeather(city, now)
  const r = rng(hash(city.id + dayKey(now) + 'now'))
  const hours: Hour[] = Array.from({ length: 24 }, (_, hour) => {
    // Coolest near 05:00, warmest near 15:00.
    const diurnal = Math.cos(((hour - 15) / 24) * Math.PI * 2)
    const mid = (today.high + today.low) / 2
    return { hour, temp: Math.round(mid + (diurnal * (today.high - today.low)) / 2) }
  })
  const temp = hours[now.getHours()].temp
  return {
    temp,
    feelsLike: temp - Math.round(r() * 2),
    condition: today.condition,
    humidity: Math.round(45 + r() * 45),
    wind: Math.round(3 + r() * 22),
    hours,
    days: Array.from({ length: 5 }, (_, i) => dayWeather(city, new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))),
  }
}

export const toUnit = (celsius: number, unit: 'C' | 'F') => Math.round(unit === 'C' ? celsius : (celsius * 9) / 5 + 32)
