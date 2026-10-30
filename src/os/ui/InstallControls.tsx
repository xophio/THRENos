import { Check, Download, RotateCcw } from 'lucide-react'
import { useInstallJobs, installApp, dismissFailedInstall } from '../installer'
import { launchApp } from '../lifecycle'
import { useRegistry } from '../registry'
import type { AppManifest, InstallJob } from '../types'

export type AppStatus = 'installed' | 'installing' | 'failed' | 'available'

export function useAppStatus(id: string): { status: AppStatus; job?: InstallJob } {
  const installed = useRegistry((s) => id in s.apps)
  const job = useInstallJobs((s) => s.jobs[id])
  if (installed) return { status: 'installed' }
  if (job) return { status: job.phase === 'failed' ? 'failed' : 'installing', job }
  return { status: 'available' }
}

const PHASE_LABEL = { downloading: 'Downloading', installing: 'Installing', registering: 'Registering', failed: 'Failed' } as const

export function ProgressBar({ job }: { job: InstallJob }) {
  return (
    <div className="w-40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress}>
      <div className="mb-1 flex justify-between font-mono text-[10.5px] text-white/70">
        <span>{PHASE_LABEL[job.phase]}</span>
        <span>{job.progress}%</span>
      </div>
      <div className="h-[3px] bg-rule-soft">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-100" style={{ width: `${job.progress}%` }} />
      </div>
    </div>
  )
}

const btn = 'flex items-center justify-center gap-1.5 border px-3.5 py-1.5 text-[12px] font-semibold transition-colors'

/** Install / progress / open, driven entirely by the installer and registry state. */
export function PrimaryAction({ app, onOpen }: { app: AppManifest; onOpen?: () => void }) {
  const { status, job } = useAppStatus(app.id)

  if (status === 'installing' && job) return <ProgressBar job={job} />

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-40 truncate text-[11px] text-signal" title={job?.error}>{job?.error ?? 'Install failed'}</span>
        <button className={`${btn} border-signal text-signal hover:bg-signal hover:text-[#fff]`} onClick={() => { dismissFailedInstall(app.id); void installApp(app.id) }}>
          <RotateCcw size={12} /> Retry
        </button>
      </div>
    )
  }

  if (status === 'installed') {
    return (
      <button
        data-action="open"
        className={`${btn} border-ink hover-invert`}
        onClick={() => { launchApp(app.id); onOpen?.() }}
      >
        <Check size={12} /> Open
      </button>
    )
  }

  return (
    <button data-action="install" className={`${btn} accent-bg border-[var(--accent)] hover:opacity-90`} onClick={() => void installApp(app.id)}>
      <Download size={12} /> Install
    </button>
  )
}
