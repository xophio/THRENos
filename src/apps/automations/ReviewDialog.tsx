import { AlertTriangle } from 'lucide-react'
import type { Automation } from '../../automation/types'
import { getTriggerDef, sensitiveSteps, validateAutomation } from '../../automation/model'
import { outline } from '../../automation/outline'
import { Dialog } from '../../components/shared/Dialog'
import { Button } from '../../components/shared/controls'

export type ReviewPurpose = 'enable' | 'run'

/** Shows exactly what an automation will do, and asks for confirmation when it changes or closes things. */
export function ReviewDialog({
  automation, purpose, onConfirm, onClose,
}: { automation: Automation; purpose: ReviewPurpose; onConfirm: () => void; onClose: () => void }) {
  const problems = validateAutomation(automation)
  const lines = outline(automation.steps)
  const risky = sensitiveSteps(automation.steps)
  const trigger = getTriggerDef(automation.trigger.type)
  const verb = purpose === 'enable' ? 'Turn on' : 'Run'

  return (
    <Dialog
      title={`${verb} “${automation.name}”?`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="accent" disabled={problems.length > 0} onClick={onConfirm}>{verb}</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <div className="kicker mb-1">{purpose === 'enable' ? 'Runs automatically' : 'Trigger'}</div>
          <div>{trigger ? trigger.summary(automation.trigger.config) : 'Unknown trigger'}</div>
        </div>
        <div>
          <div className="kicker mb-1">It will</div>
          {lines.length ? (
            <ol className="max-h-48 overflow-auto border border-rule-soft">
              {lines.map((l, i) => (
                <li
                  key={i} style={{ paddingLeft: 8 + l.depth * 14 }}
                  className={`border-b border-rule-soft py-1 pr-2 text-[12.5px] last:border-b-0 ${l.heading ? 'text-white/55' : ''} ${l.risk ? 'font-medium text-signal' : ''}`}
                >
                  {l.text}
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-white/55">No steps yet.</div>
          )}
        </div>
        {risky.length > 0 && (
          <div className="flex gap-2 border border-signal p-2.5 text-[12.5px] text-signal">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              {risky.length === 1 ? 'One step changes or closes things' : `${risky.length} steps change or close things`} (shown in red).
              {purpose === 'enable' ? ' Turning this on lets it do that without asking again; editing those steps turns it off.' : ' Moved or renamed files keep their content but change location.'}
            </span>
          </div>
        )}
        {problems.length > 0 && (
          <ul className="border border-signal p-2.5 text-[12.5px] text-signal">
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}
      </div>
    </Dialog>
  )
}

export function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onClose,
}: { title: string; message: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      title={title} onClose={onClose}
      actions={<><Button onClick={onClose}>Cancel</Button><Button tone="danger" onClick={onConfirm}>{confirmLabel}</Button></>}
    >
      {message}
    </Dialog>
  )
}
