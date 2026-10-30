import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { ArrowLeft, Copy, FlaskConical, Play, Save, Square, Trash2 } from 'lucide-react'
import type { Automation } from '../../automation/types'
import { AUTOMATION_CATEGORIES } from '../../automation/types'
import { TRIGGERS, getTriggerDef, sensitiveSteps, validateAutomation } from '../../automation/model'
import { TRIGGER_GROUPS } from '../../automation/triggers'
import { cancelRun, runAutomation } from '../../automation/engine'
import { useAutomations } from '../../automation/store'
import { notify } from '../../store/notificationStore'
import { Button, Switch } from '../../components/shared/controls'
import { FieldEditor } from './FieldEditor'
import { NodeList } from './Workflow'
import { ConfirmDialog, ReviewDialog } from './ReviewDialog'
import type { ReviewPurpose } from './ReviewDialog'
import { RunLog } from './RunLog'

/** The parts of an automation the user edits; used to tell whether there is anything to save. */
const editable = (a: Automation) => JSON.stringify([a.name, a.description, a.category, a.trigger, a.steps])

export function Editor({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const stored = useAutomations((s) => s.automations.find((a) => a.id === id))
  const running = useAutomations((s) => id in s.running)
  const lastRun = useAutomations((s) => s.history.find((r) => r.automationId === id))
  const [draft, setDraft] = useState<Automation | undefined>(stored)
  const [review, setReview] = useState<ReviewPurpose | null>(null)
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null)

  useEffect(() => { if (!stored) onBack() }, [stored, onBack])
  if (!stored || !draft) return null

  const dirty = editable(draft) !== editable(stored)
  const problems = validateAutomation(draft)
  const trigger = getTriggerDef(draft.trigger.type)
  const patch = (p: Partial<Automation>) => setDraft({ ...draft, ...p })

  const save = (): Automation => {
    useAutomations.getState().save({ ...draft, enabled: stored.enabled })
    return useAutomations.getState().automations.find((a) => a.id === id) ?? stored
  }

  const toggle = (on: boolean) => {
    if (!on) { useAutomations.getState().setEnabled(id, false); return }
    if (dirty) save()
    setReview('enable')
  }

  const startRun = () => {
    const saved = dirty ? save() : stored
    void runAutomation(saved, { trigger: 'Manual' }).then((r) => { if (!r) notify('Already running', saved.name) })
  }

  const confirmReview = () => {
    const purpose = review
    setReview(null)
    if (purpose === 'enable') useAutomations.getState().setEnabled(id, true)
    else startRun()
  }

  const run = () => (sensitiveSteps(draft.steps).length ? setReview('run') : startRun())
  const test = () => { void runAutomation(draft, { trigger: 'Test', dryRun: true }) }
  const duplicate = () => {
    const copy = useAutomations.getState().duplicate(id)
    if (copy) { notify('Duplicated', draft.name); onOpen(copy) }
    else notify('Could not duplicate', 'You have reached the automation limit.')
  }

  return (
    <div className="relative flex h-full flex-col" data-editor={id}>
      <div className="grid gap-3 border-b border-ink px-5 py-3">
        <div className="flex items-center gap-2">
          <button aria-label="Back to automations" onClick={() => (dirty ? setConfirm('leave') : onBack())} className="ibtn grid size-8 place-items-center"><ArrowLeft size={16} /></button>
          <input
            aria-label="Automation name" value={draft.name} maxLength={80} onChange={(e) => patch({ name: e.target.value })}
            className="field min-w-0 flex-1 px-2.5 py-1.5 text-[16px] font-bold tracking-[-0.02em]"
          />
          <div className="flex items-center gap-2 pl-2">
            <span className="kicker">{stored.enabled ? 'On' : 'Off'}</span>
            <Switch checked={stored.enabled} onChange={toggle} label="Enabled" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label="Description" value={draft.description} maxLength={300} placeholder="What does this automation do?"
            onChange={(e) => patch({ description: e.target.value })} className="field min-w-0 flex-1 px-2.5 py-1.5 text-[13px]"
          />
          <select aria-label="Category" value={draft.category} onChange={(e) => patch({ category: e.target.value as Automation['category'] })} className="field px-2.5 py-1.5 text-[13px]">
            {AUTOMATION_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button tone="accent" icon={Save} disabled={!dirty} onClick={save}>{dirty ? 'Save' : 'Saved'}</Button>
          <Button icon={FlaskConical} onClick={test} disabled={running}>Test</Button>
          {running ? <Button tone="danger" icon={Square} onClick={() => cancelRun(id)}>Stop</Button> : <Button icon={Play} disabled={problems.length > 0} onClick={run}>Run</Button>}
          <Button icon={Copy} onClick={duplicate}>Duplicate</Button>
          <Button tone="danger" icon={Trash2} onClick={() => setConfirm('delete')}>Delete</Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        {problems.length > 0 && (
          <ul data-problems className="mb-4 border border-signal p-3 text-[12.5px] text-signal">
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}

        <div className="kicker mb-2">Trigger</div>
        <div className="relative ml-3 border-l border-ink pl-6 pb-3" data-trigger-card>
          <span aria-hidden className="absolute -left-6 top-[22px] w-6 border-t border-ink" />
          <span aria-hidden className="accent-bg absolute -left-[5px] -top-0 size-[9px]" />
          <div className="border border-ink bg-surface">
            <div className="grid gap-3 px-4 py-3">
              <select
                aria-label="Trigger type" value={draft.trigger.type} className="field w-full px-2.5 py-1.5 text-[13px] font-semibold"
                onChange={(e) => patch({ trigger: { type: e.target.value, config: structuredClone(getTriggerDef(e.target.value)?.defaults ?? {}) } })}
              >
                {TRIGGER_GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {TRIGGERS.filter((t) => t.group === g).map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                  </optgroup>
                ))}
                {!trigger && <option value={draft.trigger.type}>{draft.trigger.type}</option>}
              </select>
              {trigger && <FieldEditor fields={trigger.fields} config={draft.trigger.config} onChange={(config) => patch({ trigger: { ...draft.trigger, config } })} />}
              <p className="text-[12px] text-white/60">{trigger?.summary(draft.trigger.config)}</p>
            </div>
          </div>
        </div>

        <div className="kicker mb-2 mt-1">Steps</div>
        <NodeList nodes={draft.steps} depth={0} onChange={(steps) => patch({ steps })} />

        <div className="mt-8" data-last-run>
          <div className="kicker mb-2 border-t border-ink pt-2">Latest result</div>
          {lastRun ? <RunLog run={lastRun} /> : <p className="text-[12.5px] text-white/55">Use Test to check this workflow without changing anything, or Run to execute it.</p>}
        </div>
      </div>

      <AnimatePresence>
        {review && <ReviewDialog key="review" automation={draft} purpose={review} onConfirm={confirmReview} onClose={() => setReview(null)} />}
        {confirm === 'delete' && (
          <ConfirmDialog
            key="delete" title="Delete automation" confirmLabel="Delete" onClose={() => setConfirm(null)}
            message={`Delete “${stored.name}” and its run history? This cannot be undone.`}
            onConfirm={() => { useAutomations.getState().remove(id); onBack() }}
          />
        )}
        {confirm === 'leave' && (
          <ConfirmDialog key="leave" title="Unsaved changes" confirmLabel="Discard" onClose={() => setConfirm(null)} message="Leave without saving your changes?" onConfirm={onBack} />
        )}
      </AnimatePresence>
    </div>
  )
}
