import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { HardDrive, RotateCcw, Trash2 } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { useFs } from '../../store/fsStore'
import { useNotes } from '../../store/notesStore'
import { useTerminalHistory } from '../../store/terminalStore'
import { notify } from '../../store/notificationStore'
import { Dialog } from '../../components/shared/Dialog'
import { Button, Section, SettingRow } from '../../components/shared/controls'
import { DISK_CAPACITY, localStorageBytes, measureStorage } from '../../utils/storage'
import type { StorageBreakdown } from '../../utils/storage'
import { formatSize } from '../../utils/files'

const OS_VERSION = '1.0'
const OS_BUILD = '2610.1'

function browserName(): string {
  const ua = navigator.userAgent
  const match = /(Edg|Firefox|Chrome|Safari)\/([\d.]+)/.exec(ua)
  if (!match) return 'Unknown browser'
  const name = match[1] === 'Edg' ? 'Edge' : match[1]
  return `${name} ${match[2].split('.')[0]}`
}

const CATEGORIES: { key: keyof Omit<StorageBreakdown, 'used'>; label: string; color: string }[] = [
  { key: 'system', label: 'System', color: '#202020' },
  { key: 'documents', label: 'Documents', color: '#d62929' },
  { key: 'pictures', label: 'Pictures', color: '#55534e' },
  { key: 'music', label: 'Music', color: '#8c8a83' },
  { key: 'downloads', label: 'Downloads', color: '#b4b1a7' },
  { key: 'notes', label: 'Notes', color: '#d3d0c6' },
  { key: 'other', label: 'Other', color: '#e6e3da' },
]

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-rule-soft py-2 text-[13px]">
      <span className="text-white/60">{label}</span>
      <span className="selectable min-w-0 truncate text-right">{value}</span>
    </div>
  )
}

function useUptime() {
  const [secs, setSecs] = useState(() => Math.floor(performance.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setSecs(Math.floor(performance.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m ${secs % 60}s`
}

type Confirm = 'settings' | 'filesystem' | 'history' | 'everything' | null

const CONFIRM_COPY: Record<Exclude<Confirm, null>, { title: string; body: string }> = {
  settings: { title: 'Reset settings', body: 'Appearance, display, taskbar and sound return to their defaults. Your files and notes are kept.' },
  filesystem: { title: 'Reset filesystem', body: 'All files and folders return to the factory layout. Notes are kept.' },
  history: { title: 'Clear terminal history', body: 'Saved commands are removed from every Terminal window.' },
  everything: { title: 'Erase all data', body: 'Every profile, with its files, notes, settings, wallpapers and history, is erased and THRENos restarts at first-time setup.' },
}

/** Resetting preferences must not rename the signed-in user, who is named by their profile. */
function resetSettingsKeepingProfile() {
  const name = useSettings.getState().username
  useSettings.getState().reset()
  useSettings.setState({ username: name })
}

/** Removes everything THRENos saved in this browser, then starts over. */
function eraseEverything() {
  for (const key of Object.keys(localStorage)) if (key.startsWith('threnos-')) localStorage.removeItem(key)
  try { sessionStorage.removeItem('threnos-session') } catch { /* nothing to clear */ }
  location.reload()
}

export function SystemPage() {
  const { deviceName, set } = useSettings()
  const tree = useFs((s) => s.tree)
  const notes = useNotes((s) => s.notes)
  const uptime = useUptime()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [browserBytes, setBrowserBytes] = useState(0)

  const usage = useMemo(() => measureStorage(tree, notes), [tree, notes])
  useEffect(() => { setBrowserBytes(localStorageBytes()) }, [tree, notes, confirm])

  const apply = () => {
    switch (confirm) {
      case 'settings': resetSettingsKeepingProfile(); notify('Settings reset'); break
      case 'filesystem': useFs.getState().reset(); notify('Filesystem reset'); break
      case 'history': useTerminalHistory.getState().clear(); notify('Terminal history cleared'); break
      case 'everything':
        eraseEverything()
        break
    }
    setConfirm(null)
  }

  const nav = navigator as Navigator & { deviceMemory?: number }
  const free = Math.max(0, DISK_CAPACITY - usage.used)

  return (
    <>
      <Section title="Device">
        <SettingRow label="Device name">
          <input
            aria-label="Device name"
            value={deviceName}
            maxLength={24}
            onChange={(e) => set({ deviceName: e.target.value })}
            className="field w-44 px-3 py-1.5 text-[13px]"
          />
        </SettingRow>
        <Info label="Operating system" value={`THRENos ${OS_VERSION}`} />
        <Info label="Build" value={OS_BUILD} />
        <Info label="Runs on" value={browserName()} />
        <Info label="Platform" value={nav.platform || 'Unknown'} />
        <Info label="Processor threads" value={String(nav.hardwareConcurrency ?? 'Unknown')} />
        <Info label="Memory" value={nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Unknown'} />
        <Info label="Physical display" value={`${screen.width} × ${screen.height} @ ${window.devicePixelRatio}x`} />
        <Info label="Language" value={nav.language} />
        <Info label="Session uptime" value={uptime} />
      </Section>

      <Section title="Storage">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="flex items-center gap-2 font-semibold"><HardDrive size={15} strokeWidth={1.5} /> THRENos disk</span>
          <span data-testid="storage-summary" className="font-mono text-[12px] text-white/65">{formatSize(usage.used)} used of {formatSize(DISK_CAPACITY)}</span>
        </div>
        <div
          role="img"
          aria-label={`${formatSize(usage.used)} used, ${formatSize(free)} free`}
          className="flex h-3 overflow-hidden border border-ink bg-field"
        >
          {CATEGORIES.map((c) => {
            const bytes = usage[c.key]
            return bytes > 0 && (
              <div
                key={c.key}
                title={`${c.label}: ${formatSize(bytes)}`}
                className="h-full"
                style={{ width: `${Math.max(0.8, (bytes / DISK_CAPACITY) * 100)}%`, background: c.color }}
              />
            )
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div key={c.key} data-storage={c.key} className="flex items-center gap-2">
              <span className="size-2.5 border border-ink" style={{ background: c.color }} />
              <span className="text-white/65">{c.label}</span>
              <span className="ml-auto font-mono tabular-nums">{formatSize(usage[c.key])}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-rule-soft pt-2 text-[12px] text-white/60">
          Browser storage in use: {formatSize(browserBytes)} of roughly 5 MB
        </div>
      </Section>

      <Section title="Reset">
        <div className="flex flex-wrap gap-2">
          <Button icon={RotateCcw} onClick={() => setConfirm('settings')}>Reset settings</Button>
          <Button icon={RotateCcw} onClick={() => setConfirm('filesystem')}>Reset filesystem</Button>
          <Button icon={Trash2} onClick={() => setConfirm('history')}>Clear terminal history</Button>
          <Button icon={Trash2} tone="danger" onClick={() => setConfirm('everything')}>Erase all data</Button>
        </div>
      </Section>

      <AnimatePresence>
        {confirm && (
          <Dialog
            title={CONFIRM_COPY[confirm].title}
            onClose={() => setConfirm(null)}
            actions={
              <>
                <Button onClick={() => setConfirm(null)}>Cancel</Button>
                <Button tone={confirm === 'everything' ? 'danger' : 'accent'} onClick={apply}>Confirm</Button>
              </>
            }
          >
            {CONFIRM_COPY[confirm].body}
          </Dialog>
        )}
      </AnimatePresence>
    </>
  )
}
