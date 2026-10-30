import { useSettings } from '../store/settingsStore'

export type SoundName = 'open' | 'close' | 'minimize' | 'notify' | 'click' | 'error'

// [frequency Hz, duration s, delay s] per note.
const NOTES: Record<SoundName, [number, number, number][]> = {
  open: [[520, 0.07, 0], [780, 0.09, 0.06]],
  close: [[620, 0.07, 0], [400, 0.09, 0.06]],
  minimize: [[480, 0.08, 0]],
  notify: [[880, 0.09, 0], [1175, 0.14, 0.1]],
  click: [[700, 0.04, 0]],
  error: [[220, 0.14, 0], [180, 0.18, 0.12]],
}

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    return ctx
  } catch {
    return null
  }
}

// Browsers keep audio suspended until a user gesture.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => { void context()?.resume() }, { passive: true })
  window.addEventListener('keydown', () => { void context()?.resume() }, { passive: true })
}

export function effectiveVolume() {
  const { volume, muted } = useSettings.getState()
  return muted ? 0 : volume / 100
}

/** `force` plays even when system sounds are off (the Settings test button). */
export function playSound(name: SoundName, force = false) {
  const { soundEffects } = useSettings.getState()
  const vol = effectiveVolume()
  if ((!soundEffects && !force) || vol === 0) return
  const ac = context()
  if (!ac || ac.state !== 'running') return

  const now = ac.currentTime
  for (const [freq, dur, delay] of NOTES[name]) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const peak = 0.18 * vol
    gain.gain.setValueAtTime(0.0001, now + delay)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + delay + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(now + delay)
    osc.stop(now + delay + dur + 0.02)
  }
}
