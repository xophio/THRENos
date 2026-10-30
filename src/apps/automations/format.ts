import type { RunStatus } from '../../automation/types'

export function ago(ts: number | null): string {
  if (!ts) return 'Never'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 10) return 'Just now'
  if (s < 60) return `${s} s ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

export const STATUS_LABEL: Record<RunStatus, string> = {
  running: 'Running', success: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped',
}

export const statusTone = (s: RunStatus) => (s === 'failed' ? 'text-signal' : s === 'running' ? 'accent-text' : 'text-white/60')

export function duration(start: number, end: number | null): string {
  if (end === null) return '…'
  const ms = end - start
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}
