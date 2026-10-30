import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { ArrowLeft, Play, Trash2 } from 'lucide-react'
import { Button, Section, SettingRow, Switch } from '../../components/shared/controls'
import { Dialog } from '../../components/shared/Dialog'
import { clearAppData, measureAppData, useAppDataStore } from '../../os/appData'
import { useInstallStore } from '../../os/installStore'
import { launchApp } from '../../os/lifecycle'
import { useRegisteredApps } from '../../os/registry'
import type { AppManifest } from '../../os/types'
import { PermissionList } from '../../os/ui/PermissionList'
import { UninstallDialog } from '../../os/ui/UninstallDialog'
import { notify } from '../../store/notificationStore'
import { formatSize } from '../../utils/files'

const KIND_LABEL = { system: 'System', bundled: 'Bundled', store: 'App Store' } as const

/** Bytes of saved data: the app's own store if it keeps one, plus its private app-data bucket. */
const dataBytes = (app: AppManifest) => (app.data?.measure() ?? 0) + measureAppData(app.id)

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-rule-soft py-2 text-[13px]">
      <span className="text-white/60">{label}</span>
      <span className="selectable min-w-0 truncate text-right">{value}</span>
    </div>
  )
}

function AppDetail({ app, onBack }: { app: AppManifest; onBack: () => void }) {
  const record = useInstallStore((s) => s.installed[app.id])
  const desktop = useInstallStore((s) => s.shortcuts[app.id]?.desktop !== false)
  const setDesktop = useInstallStore((s) => s.setDesktopShortcut)
  const [confirm, setConfirm] = useState<'uninstall' | 'clear' | null>(null)
  // Re-measure when the app's private bucket changes or after clearing.
  const [, setTick] = useState(0)
  useAppDataStore((s) => s.buckets[app.id])

  const used = dataBytes(app)
  const removable = app.kind !== 'system'

  return (
    <div data-apps-detail={app.id}>
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-[12px] font-medium text-white/70 hover:text-[var(--accent)]">
        <ArrowLeft size={13} /> All apps
      </button>
      <div className="mb-5 flex items-center gap-4 border-b border-ink pb-4">
        <div className="grid size-14 place-items-center border border-ink bg-paper"><app.icon size={26} strokeWidth={1.3} /></div>
        <div>
          <div className="text-[24px] font-bold leading-none tracking-[-0.04em]">{app.name}</div>
          <div className="mt-1.5 text-[12.5px] text-white/65">{app.developer} · v{app.version}</div>
        </div>
        <div className="ml-auto"><Button icon={Play} onClick={() => launchApp(app.id)}>Open</Button></div>
      </div>

      <Section title="Details">
        <Info label="Category" value={app.category} />
        <Info label="Source" value={KIND_LABEL[app.kind]} />
        <Info label="Installed" value={record && record.installedAt > 1e9 ? new Date(record.installedAt).toLocaleString() : 'With THRENos'} />
        <Info label="Install size" value={formatSize(app.sizeKB * 1024)} />
        <Info label="Saved data" value={formatSize(used)} />
      </Section>

      <Section title="Permissions">
        <PermissionList app={app} editable />
      </Section>

      <Section title="Shortcuts">
        <SettingRow label="Show on desktop" hint={app.kind === 'system' ? 'System apps always have a desktop shortcut.' : 'The Start menu entry is always kept while installed.'}>
          <Switch label="Show on desktop" checked={desktop || app.kind === 'system'} onChange={(v) => app.kind !== 'system' && setDesktop(app.id, v)} />
        </SettingRow>
      </Section>

      <Section title="Manage">
        <div className="flex flex-wrap gap-2 pt-2">
          <Button icon={Trash2} disabled={used === 0} onClick={() => setConfirm('clear')}>Clear saved data</Button>
          <Button tone="danger" icon={Trash2} disabled={!removable} onClick={() => setConfirm('uninstall')}>Uninstall</Button>
        </div>
        {!removable && <p className="mt-3 text-[12px] text-white/60">{app.name} is part of the system and cannot be uninstalled.</p>}
      </Section>

      <AnimatePresence>
        {confirm === 'uninstall' && <UninstallDialog key="u" app={app} onClose={() => { setConfirm(null); setTick((t) => t + 1) }} />}
        {confirm === 'clear' && (
          <Dialog
            key="c"
            title="Clear saved data"
            onClose={() => setConfirm(null)}
            actions={
              <>
                <Button onClick={() => setConfirm(null)}>Cancel</Button>
                <Button
                  tone="danger"
                  onClick={() => { app.data?.clear(); clearAppData(app.id); setConfirm(null); setTick((t) => t + 1); notify('Data cleared', app.name) }}
                >
                  Clear data
                </Button>
              </>
            }
          >
            Everything {app.name} has saved ({formatSize(used)}) will be deleted. The app stays installed and your files are not affected.
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AppsPage() {
  const apps = useRegisteredApps()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useAppDataStore((s) => s.buckets)
  const selected = apps.find((a) => a.id === selectedId)

  if (selected) return <AppDetail app={selected} onBack={() => setSelectedId(null)} />

  const total = apps.reduce((n, a) => n + dataBytes(a), 0)

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between text-[12.5px] text-white/65">
        <span data-testid="apps-count">{apps.length} installed apps</span>
        <span className="font-mono">{formatSize(total)} saved data</span>
      </div>
      <div className="border-t border-ink">
        {apps.map((a, i) => (
          <button
            key={a.id}
            data-apps-row={a.id}
            onClick={() => setSelectedId(a.id)}
            className="grid w-full grid-cols-[24px_32px_minmax(0,1fr)_90px_80px] items-center gap-3 border-b border-rule-soft px-1 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
          >
            <span className="font-mono text-[10px] text-white/50">{String(i + 1).padStart(2, '0')}</span>
            <a.icon size={17} strokeWidth={1.4} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{a.name}</span>
              <span className="block truncate text-[11.5px] text-white/60">{a.developer} · v{a.version}</span>
            </span>
            <span className="kicker">{KIND_LABEL[a.kind]}</span>
            <span className="text-right font-mono text-[11px] text-white/70">{formatSize(dataBytes(a))}</span>
          </button>
        ))}
      </div>
    </>
  )
}
