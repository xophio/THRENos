import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileAudio, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import type { AppProps } from '../../types'
import { useAppState } from '../../os/appData'
import { useGranted } from '../../os/permissions'
import { useSettings } from '../../store/settingsStore'
import { TRACKS, trackUrl } from './synth'

interface Track { id: string; title: string; subtitle: string; url: () => string; local?: boolean }

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

const BUILT_IN: Track[] = TRACKS.map((t) => ({ id: t.id, title: t.title, subtitle: t.subtitle, url: () => trackUrl(t) }))

export function MusicPlayer({ appId }: AppProps) {
  const allowed = useGranted(appId, 'audio')
  const [volume, setVolume] = useAppState(appId, 'volume', 80)
  const [shuffle, setShuffle] = useAppState(appId, 'shuffle', false)
  const [repeat, setRepeat] = useAppState(appId, 'repeat', true)
  const systemVolume = useSettings((s) => (s.muted ? 0 : s.volume))

  const [locals, setLocals] = useState<Track[]>([])
  const playlist = useMemo(() => [...BUILT_IN, ...locals], [locals])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const autoplay = useRef(false)
  const indexRef = useRef(0)
  indexRef.current = index

  const current = playlist[index] ?? playlist[0]

  const load = useCallback((i: number, play: boolean) => {
    const track = playlist[i]
    const audio = audioRef.current
    if (!track || !audio) return
    setIndex(i)
    setTime(0)
    autoplay.current = play
    audio.src = track.url()
    if (play) void audio.play().catch(() => setPlaying(false))
  }, [playlist])

  // One <audio> element for the life of the window; stop sound when the window closes.
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.src = BUILT_IN[0].url()
    audio.onloadedmetadata = () => setDuration(audio.duration)
    audio.ontimeupdate = () => setTime(audio.currentTime)
    audio.onplay = () => setPlaying(true)
    audio.onpause = () => setPlaying(false)
    return () => { audio.pause(); audio.removeAttribute('src'); audio.load(); audioRef.current = null }
  }, [])

  // Output level = app volume × system volume (which includes mute).
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(1, (volume / 100) * (systemVolume / 100))
  }, [volume, systemVolume])

  // Revoking the audio permission stops playback immediately.
  useEffect(() => { if (!allowed) audioRef.current?.pause() }, [allowed])

  const next = useCallback((dir: 1 | -1 = 1) => {
    const n = playlist.length
    let i = (indexRef.current + dir + n) % n
    if (shuffle && n > 1 && dir === 1) do { i = Math.floor(Math.random() * n) } while (i === indexRef.current)
    load(i, true)
  }, [playlist.length, shuffle, load])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.onended = () => {
      if (!repeat && indexRef.current === playlist.length - 1 && !shuffle) { setPlaying(false); setTime(0); return }
      next(1)
    }
  }, [repeat, shuffle, next, playlist.length])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || !allowed) return
    if (audio.paused) void audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const added = Array.from(files)
      .filter((f) => f.type.startsWith('audio/'))
      .map((f, i) => {
        const url = URL.createObjectURL(f)
        return { id: `local-${Date.now()}-${i}`, title: f.name.replace(/\.[^.]+$/, ''), subtitle: 'Local file · this session', url: () => url, local: true }
      })
    if (added.length) setLocals((l) => [...l, ...added])
  }

  return (
    <div className="flex h-full max-md:flex-col">
      <div className="flex w-[330px] shrink-0 flex-col border-r border-ink max-md:w-full max-md:border-b max-md:border-r-0">
        <div className="border-b border-ink px-6 py-3"><span className="kicker !text-ink">Now playing</span></div>
        <div className="flex flex-1 flex-col justify-between px-6 py-6">
          <div>
            <div className="mb-6 grid aspect-square w-full max-w-[220px] place-items-center border border-ink bg-paper">
              <div className="relative size-24">
                <div className={`absolute inset-0 rounded-full bg-[var(--accent)] ${playing ? 'animate-pulse' : ''}`} />
                <div className="absolute bottom-0 right-0 size-8 bg-ink" />
              </div>
            </div>
            <div data-track-title className="text-[24px] font-bold leading-tight tracking-[-0.035em]">{current?.title}</div>
            <div className="mt-1 text-[12.5px] text-white/65">{current?.subtitle}</div>
          </div>

          <div>
            <input
              aria-label="Seek"
              type="range" min={0} max={Math.max(1, Math.floor(duration))} value={Math.floor(time)}
              onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = +e.target.value }}
              className="w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-white/65">
              <span data-track-time>{fmt(time)}</span><span>{fmt(duration)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button aria-label="Shuffle" aria-pressed={shuffle} onClick={() => setShuffle(!shuffle)} className={`ibtn grid size-9 place-items-center ${shuffle ? '!text-[var(--accent)]' : ''}`}><Shuffle size={16} /></button>
              <button aria-label="Previous" onClick={() => next(-1)} disabled={!allowed} className="ibtn grid size-9 place-items-center"><SkipBack size={17} /></button>
              <button
                aria-label={playing ? 'Pause' : 'Play'}
                data-action="play"
                onClick={toggle}
                disabled={!allowed}
                className="accent-bg grid size-12 place-items-center disabled:opacity-40"
              >
                {playing ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button aria-label="Next" onClick={() => next(1)} disabled={!allowed} className="ibtn grid size-9 place-items-center"><SkipForward size={17} /></button>
              <button aria-label="Repeat" aria-pressed={repeat} onClick={() => setRepeat(!repeat)} className={`ibtn grid size-9 place-items-center ${repeat ? '!text-[var(--accent)]' : ''}`}><Repeat size={16} /></button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Volume2 size={15} className="text-white/60" />
              <input aria-label="Player volume" type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(+e.target.value)} className="flex-1" />
              <span className="w-8 text-right font-mono text-[11px] text-white/65">{volume}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-ink px-6 py-3">
          <span className="kicker !text-ink">Playlist</span>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 border border-ink px-2.5 py-1 text-[11.5px] font-semibold hover-invert">
            <FileAudio size={12} /> Add audio files
          </button>
          <input ref={fileRef} data-testid="music-upload" type="file" accept="audio/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>
        {!allowed && (
          <div data-audio-blocked className="border-b border-signal bg-field px-6 py-2.5 text-[12.5px] text-signal">
            Audio is blocked for Music Player. Allow it in Settings → Apps to play sound.
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {playlist.map((t, i) => {
            const on = i === index
            return (
              <button
                key={t.id}
                data-track={t.id}
                onClick={() => allowed && load(i, true)}
                className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-rule-soft px-6 py-3 text-left transition-colors ${on ? 'bg-ink text-paper' : 'hover:bg-white/[0.05]'}`}
              >
                <span className={`font-mono text-[10.5px] ${on ? 'text-paper/70' : 'text-white/50'}`}>{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">{t.title}</span>
                  <span className={`block truncate text-[11.5px] ${on ? 'text-paper/70' : 'text-white/60'}`}>{t.subtitle}</span>
                </span>
                <span className="font-mono text-[10.5px]">{on && playing ? 'Playing' : ''}</span>
              </button>
            )
          })}
          {locals.length === 0 && (
            <div className="px-6 py-5 text-[12.5px] leading-relaxed text-white/60">
              Tracks above are synthesized by the app, so no audio files are bundled. Add your own audio files to play them here for this session.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
