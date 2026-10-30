export interface TrackSpec {
  id: string
  title: string
  subtitle: string
  seconds: number
  /** [startBeat, midiNote, beats, gain] */
  notes: [number, number, number, number][]
  bpm: number
}

// Frequencies come from a MIDI note number; everything below is original material.
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** Tiny deterministic generator so "random" tracks are the same every time. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function arpeggio(root: number, scale: number[], bars: number, pattern: number[]): TrackSpec['notes'] {
  const notes: TrackSpec['notes'] = []
  for (let bar = 0; bar < bars; bar++) {
    pattern.forEach((degree, i) => {
      const octave = Math.floor(degree / scale.length)
      notes.push([bar * pattern.length * 0.5 + i * 0.5, root + scale[degree % scale.length] + octave * 12, 0.9, 0.5])
    })
    notes.push([bar * pattern.length * 0.5, root - 12 + scale[(bar * 2) % scale.length], 3.5, 0.35])
  }
  return notes
}

function sparse(root: number, scale: number[], count: number, seed: number): TrackSpec['notes'] {
  const r = rng(seed)
  const notes: TrackSpec['notes'] = []
  let beat = 0
  for (let i = 0; i < count; i++) {
    beat += 0.5 + Math.floor(r() * 4) * 0.5
    notes.push([beat, root + scale[Math.floor(r() * scale.length)] + (r() > 0.6 ? 12 : 0), 1.5 + r() * 2, 0.45])
  }
  return notes
}

const PENTATONIC = [0, 2, 4, 7, 9]
const MINOR_PENTATONIC = [0, 3, 5, 7, 10]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]

export const TRACKS: TrackSpec[] = [
  { id: 'grid-study', title: 'Grid Study', subtitle: 'Orbit Labs · generated', bpm: 104, seconds: 30, notes: arpeggio(60, PENTATONIC, 12, [0, 2, 4, 3, 5, 3, 4, 2]) },
  { id: 'signal', title: 'Signal', subtitle: 'Orbit Labs · generated', bpm: 72, seconds: 34, notes: arpeggio(57, MINOR_PENTATONIC, 8, [0, 1, 2, 4, 2, 1]) },
  { id: 'quarter-rest', title: 'Quarter Rest', subtitle: 'Orbit Labs · generated', bpm: 96, seconds: 30, notes: arpeggio(62, DORIAN, 10, [0, 4, 2, 6, 4, 2, 5, 1]) },
  { id: 'paper-rain', title: 'Paper Rain', subtitle: 'Orbit Labs · generated', bpm: 80, seconds: 36, notes: sparse(65, PENTATONIC, 44, 7) },
]

const SAMPLE_RATE = 22050

/** Renders a track to a mono 16-bit WAV so a plain <audio> element can play, seek and pause it. */
function renderWav(spec: TrackSpec): Blob {
  const total = Math.floor(spec.seconds * SAMPLE_RATE)
  const out = new Float32Array(total)
  const secPerBeat = 60 / spec.bpm

  for (const [beat, midi, beats, gain] of spec.notes) {
    const start = Math.floor(beat * secPerBeat * SAMPLE_RATE)
    const length = Math.min(Math.floor(beats * secPerBeat * SAMPLE_RATE), total - start)
    if (length <= 0) continue
    const f = hz(midi)
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE
      const attack = Math.min(1, t / 0.012)
      const release = Math.min(1, (length - i) / (0.05 * SAMPLE_RATE))
      const decay = Math.exp(-t * 3.2)
      const tone = Math.sin(2 * Math.PI * f * t) + 0.28 * Math.sin(4 * Math.PI * f * t) + 0.1 * Math.sin(6 * Math.PI * f * t)
      out[start + i] += tone * gain * attack * release * decay
    }
  }

  // Fade in/out and normalize so tracks sit at a similar level.
  let peak = 0
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(out[i]))
  const scale = peak > 0 ? 0.8 / peak : 1
  const fade = Math.floor(SAMPLE_RATE * 0.8)

  const buffer = new ArrayBuffer(44 + total * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }
  write(0, 'RIFF'); view.setUint32(4, 36 + total * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, total * 2, true)
  for (let i = 0; i < total; i++) {
    const edge = Math.min(1, i / fade, (total - i) / fade)
    const v = Math.max(-1, Math.min(1, out[i] * scale * edge))
    view.setInt16(44 + i * 2, v * 32767, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

const urls = new Map<string, string>()

/** Object URL for a generated track, rendered on first use and then cached. */
export function trackUrl(spec: TrackSpec): string {
  let url = urls.get(spec.id)
  if (!url) {
    url = URL.createObjectURL(renderWav(spec))
    urls.set(spec.id, url)
  }
  return url
}
