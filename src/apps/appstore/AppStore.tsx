import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { ArrowLeft, Search } from 'lucide-react'
import type { AppProps } from '../../types'
import { CATALOG } from '../../os/catalog'
import { useRegistry } from '../../os/registry'
import { CATEGORIES } from '../../os/types'
import type { AppCategory, AppManifest } from '../../os/types'
import { useInstallJobs } from '../../os/installer'
import { PrimaryAction, useAppStatus } from '../../os/ui/InstallControls'
import { UninstallDialog } from '../../os/ui/UninstallDialog'
import { PermissionList } from '../../os/ui/PermissionList'
import { useInstallStore } from '../../os/installStore'
import { formatSize } from '../../utils/files'

type View = 'discover' | 'installed' | AppCategory

const sizeLabel = (kb: number) => formatSize(kb * 1024)

function RowAction({ app, onUninstall }: { app: AppManifest; onUninstall: () => void }) {
  const { status } = useAppStatus(app.id)
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <PrimaryAction app={app} />
      {status === 'installed' && app.kind !== 'system' && (
        <button
          data-action="uninstall"
          onClick={onUninstall}
          className="border border-transparent px-2.5 py-1.5 text-[12px] font-medium text-white/65 transition-colors hover:border-signal hover:text-signal"
        >
          Uninstall
        </button>
      )}
      {status === 'installed' && app.kind === 'system' && <span className="kicker">Required</span>}
    </div>
  )
}

function AppRow({ app, index, onSelect, onUninstall }: { app: AppManifest; index: number; onSelect: () => void; onUninstall: () => void }) {
  const { status } = useAppStatus(app.id)
  return (
    <div
      data-app-row={app.id}
      data-status={status}
      onClick={onSelect}
      className="grid cursor-default grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-4 border-b border-rule-soft px-6 py-3.5 transition-colors hover:bg-white/[0.04] max-md:grid-cols-[44px_minmax(0,1fr)_auto]"
    >
      <span className="font-mono text-[10.5px] text-white/50 max-md:hidden">{String(index + 1).padStart(2, '0')}</span>
      <div className="grid size-11 place-items-center border border-ink bg-paper">
        <app.icon size={20} strokeWidth={1.4} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-bold tracking-[-0.02em]">{app.name}</span>
          <span className="font-mono text-[10.5px] text-white/55">{app.version}</span>
        </div>
        <div className="truncate text-[12.5px] text-white/70">{app.description}</div>
        <div className="mt-1 flex gap-3 text-[10.5px] uppercase tracking-[0.1em] text-white/50">
          <span>{app.category}</span>
          <span>{app.developer}</span>
          <span className="font-mono normal-case tracking-normal">{sizeLabel(app.sizeKB)}</span>
        </div>
      </div>
      <RowAction app={app} onUninstall={onUninstall} />
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] border-b border-rule-soft py-2.5 text-[13px]">
      <span className="kicker self-center">{label}</span>
      <span>{children}</span>
    </div>
  )
}

function AppDetail({ app, onBack, onUninstall }: { app: AppManifest; onBack: () => void; onUninstall: () => void }) {
  const { status } = useAppStatus(app.id)
  const record = useInstallStore((s) => s.installed[app.id])
  const kindLabel = app.kind === 'system' ? 'System app' : app.kind === 'bundled' ? 'Bundled app' : 'Store app'

  return (
    <div data-app-detail={app.id} className="min-h-0 flex-1 overflow-auto">
      <button onClick={onBack} className="flex items-center gap-2 border-b border-rule-soft px-6 py-2.5 text-[12px] font-medium text-white/70 hover:text-[var(--accent)]">
        <ArrowLeft size={13} /> All apps
      </button>
      <div className="px-8 pb-10 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div className="flex items-start gap-5">
            <div className="grid size-20 place-items-center border border-ink bg-paper">
              <app.icon size={36} strokeWidth={1.25} />
            </div>
            <div>
              <div className="kicker">{app.category} · {kindLabel}</div>
              <h2 className="mt-2 text-[40px] font-bold leading-none tracking-[-0.05em]">{app.name}</h2>
              <div className="mt-2 text-[13px] text-white/70">{app.developer} · v{app.version}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <PrimaryAction app={app} />
            {status === 'installed' && app.kind !== 'system' && (
              <button data-action="uninstall" onClick={onUninstall} className="border border-signal px-3.5 py-1.5 text-[12px] font-semibold text-signal transition-colors hover:bg-signal hover:text-[#fff]">
                Uninstall
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-10 md:grid-cols-[1fr_320px]">
          <div>
            <h3 className="kicker mb-2">About</h3>
            <p className="max-w-prose text-[14px] leading-[1.65]">{app.about}</p>
            {app.whatsNew && (
              <>
                <h3 className="kicker mb-2 mt-7">What’s new</h3>
                <p className="text-[13px] text-white/75">v{app.version} — {app.whatsNew}</p>
              </>
            )}
            <h3 className="kicker mb-1 mt-7">Permissions</h3>
            <PermissionList app={app} />
          </div>
          <div>
            <h3 className="kicker mb-1 border-t border-ink pt-2">Information</h3>
            <Meta label="Version">{app.version}</Meta>
            <Meta label="Developer">{app.developer}</Meta>
            <Meta label="Category">{app.category}</Meta>
            <Meta label="Size">{sizeLabel(app.sizeKB)}</Meta>
            <Meta label="Status">{status === 'installed' ? 'Installed' : status === 'installing' ? 'Installing' : status === 'failed' ? 'Failed' : 'Not installed'}</Meta>
            {record && app.kind !== 'system' && <Meta label="Installed">{record.installedAt > 1e9 ? new Date(record.installedAt).toLocaleDateString() : 'Preinstalled'}</Meta>}
            {app.opens && <Meta label="Opens"><span className="font-mono text-[12px]">.{app.opens.join(' .')}</span></Meta>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppStore(_: AppProps) {
  const [view, setView] = useState<View>('discover')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uninstallId, setUninstallId] = useState<string | null>(null)
  const registered = useRegistry((s) => s.apps)
  const jobs = useInstallJobs((s) => s.jobs)

  const installedCount = Object.keys(registered).length
  const apps = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CATALOG.filter((a) => {
      if (view === 'installed' && !registered[a.id]) return false
      if (view !== 'discover' && view !== 'installed' && a.category !== view) return false
      return !q || `${a.name} ${a.description} ${a.developer} ${a.category}`.toLowerCase().includes(q)
    })
  }, [view, query, registered])

  const selected = selectedId ? CATALOG.find((a) => a.id === selectedId) : undefined
  const uninstalling = uninstallId ? CATALOG.find((a) => a.id === uninstallId) : undefined
  const busy = Object.values(jobs).filter((j) => j.phase !== 'failed').length

  const nav = (id: View, label: string, count?: number) => (
    <button
      key={id}
      data-store-nav={id}
      onClick={() => { setView(id); setSelectedId(null) }}
      className={`flex w-full items-center justify-between border-b border-rule-soft px-4 py-2.5 text-left text-[12.5px] font-medium transition-colors ${
        view === id ? 'bg-ink text-paper' : 'hover:bg-white/[0.07]'
      }`}
    >
      {label}
      {count !== undefined && <span className={`font-mono text-[10.5px] ${view === id ? 'text-paper/70' : 'text-white/55'}`}>{String(count).padStart(2, '0')}</span>}
    </button>
  )

  const title = view === 'discover' ? 'Discover' : view === 'installed' ? 'Installed' : view

  return (
    <div className="relative flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-ink bg-sidebar max-sm:hidden">
        <div className="flex items-baseline justify-between border-b border-ink px-4 py-3">
          <span className="kicker !text-ink">App Store</span>
          {busy > 0 && <span className="font-mono text-[10px] text-[var(--accent)]">{busy} installing</span>}
        </div>
        {nav('discover', 'Discover', CATALOG.length)}
        {nav('installed', 'Installed', installedCount)}
        <div className="kicker border-b border-rule-soft px-4 pb-2 pt-4">Categories</div>
        {CATEGORIES.map((c) => nav(c, c, CATALOG.filter((a) => a.category === c).length))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <AppDetail app={selected} onBack={() => setSelectedId(null)} onUninstall={() => setUninstallId(selected.id)} />
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 border-b-2 border-ink px-6 pb-3 pt-5">
              <div>
                <h2 data-store-title className="text-[34px] font-bold leading-none tracking-[-0.045em]">{title}</h2>
                <div className="mt-2 font-mono text-[11px] text-white/55">{String(apps.length).padStart(2, '0')} apps</div>
              </div>
              <div className="relative w-56 max-sm:w-40">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/55" />
                <input
                  data-store-search
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search apps"
                  className="field w-full py-1.5 pl-8 pr-2 text-[12.5px]"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {apps.map((a, i) => (
                <AppRow key={a.id} app={a} index={i} onSelect={() => setSelectedId(a.id)} onUninstall={() => setUninstallId(a.id)} />
              ))}
              {apps.length === 0 && (
                <div className="grid h-full min-h-48 place-items-center text-[13px] text-white/60">
                  {query ? `No apps match “${query}”` : view === 'installed' ? 'No apps installed' : 'No apps in this category'}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {uninstalling && <UninstallDialog key={uninstalling.id} app={uninstalling} onClose={() => setUninstallId(null)} />}
      </AnimatePresence>
    </div>
  )
}
