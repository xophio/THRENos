import type { RunRecord } from '../../automation/types'
import { STATUS_LABEL, clock, duration, statusTone } from './format'

const MARK = { ok: '✓', failed: '✕', info: '·' } as const

/** The step-by-step result of one run. */
export function RunLog({ run }: { run: RunRecord }) {
  return (
    <div data-run-log={run.id} className="border border-rule-soft">
      <div className="flex items-baseline gap-3 border-b border-rule-soft px-3 py-2">
        <span className={`kicker !text-[10.5px] ${statusTone(run.status)}`} data-run-status={run.status}>{STATUS_LABEL[run.status]}</span>
        {run.dryRun && <span className="kicker border border-rule px-1 py-0.5">Test</span>}
        <span className="font-mono text-[11px] text-white/55">{duration(run.startedAt, run.finishedAt)}</span>
        {run.error && <span className="truncate text-[12px] text-signal">{run.error}</span>}
      </div>
      {run.steps.length ? (
        <ol>
          {run.steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[18px_58px_150px_1fr] gap-2 border-b border-rule-soft px-3 py-1.5 text-[12px] last:border-b-0">
              <span className={s.status === 'failed' ? 'text-signal' : 'text-white/55'}>{MARK[s.status]}</span>
              <span className="font-mono text-white/50">{clock(s.at)}</span>
              <span className="truncate font-medium">{s.label}</span>
              <span className={`selectable break-words ${s.status === 'failed' ? 'text-signal' : 'text-white/75'}`}>{s.message}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-3 py-2 text-[12px] text-white/55">{run.status === 'running' ? 'Starting…' : 'No steps were executed.'}</div>
      )}
    </div>
  )
}
