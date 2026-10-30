import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAutomations } from '../../automation/store'
import { Button } from '../../components/shared/controls'
import { RunLog } from './RunLog'
import { STATUS_LABEL, ago, duration, statusTone } from './format'

/** Every recorded run across all automations, newest first. */
export function History() {
  const history = useAutomations((s) => s.history)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      <div className="flex items-center gap-3 border-b border-ink px-6 py-3">
        <h1 className="text-[20px] font-bold tracking-[-0.035em]">Run history</h1>
        <span className="font-mono text-[11px] text-white/55">{history.length} runs</span>
        <div className="ml-auto"><Button disabled={!history.length} onClick={() => useAutomations.getState().clearHistory()}>Clear history</Button></div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" data-history>
        {history.map((r) => (
          <div key={r.id} data-run={r.id} className="border-b border-rule-soft">
            <button
              aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}
              className="grid w-full grid-cols-[16px_minmax(0,1fr)_150px_90px_70px] items-center gap-4 px-6 py-2.5 text-left hover:bg-white/[0.04]"
            >
              {open === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="truncate text-[13px] font-medium">{r.name}{r.dryRun && <span className="kicker ml-2 border border-rule px-1 py-0.5">Test</span>}</span>
              <span className="truncate text-[12px] text-white/65">{r.trigger}</span>
              <span className={`text-[12.5px] font-medium ${statusTone(r.status)}`}>{STATUS_LABEL[r.status]}</span>
              <span className="text-right text-[12px] text-white/60" title={duration(r.startedAt, r.finishedAt)}>{ago(r.startedAt)}</span>
            </button>
            {open === r.id && <div className="px-6 pb-3 pl-[56px]"><RunLog run={r} /></div>}
          </div>
        ))}
        {!history.length && <div className="px-6 py-10 text-[13px] text-white/60">No runs yet. Run or test an automation and it shows up here.</div>}
      </div>
    </>
  )
}
