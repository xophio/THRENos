import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Copy, Pencil, Play, Plus, Search, Square, Trash2 } from 'lucide-react'
import type { AppProps } from '../../types'
import type { Automation, AutomationCategory } from '../../automation/types'
import { AUTOMATION_CATEGORIES } from '../../automation/types'
import { getTriggerDef, sensitiveSteps } from '../../automation/model'
import { cancelRun, runAutomation } from '../../automation/engine'
import { useAutomations } from '../../automation/store'
import { TEMPLATES, fromTemplate } from '../../automation/templates'
import { useFocus } from '../../store/focusStore'
import { notify } from '../../store/notificationStore'
import { Switch } from '../../components/shared/controls'
import { Editor } from './Editor'
import { History } from './History'
import { ConfirmDialog, ReviewDialog } from './ReviewDialog'
import type { ReviewPurpose } from './ReviewDialog'
import { STATUS_LABEL, ago, statusTone } from './format'

type Filter = 'all' | 'active' | 'disabled' | 'recent' | 'failed'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'disabled', label: 'Disabled' },
  { id: 'recent', label: 'Recently run' }, { id: 'failed', label: 'Failed' },
]
const DAY = 86_400_000

const matchesFilter = (a: Automation, f: Filter) =>
  f === 'all' ? true
  : f === 'active' ? a.enabled
  : f === 'disabled' ? !a.enabled
  : f === 'recent' ? a.lastRunAt !== null && Date.now() - a.lastRunAt < 7 * DAY
  : a.lastStatus === 'failed'

function FocusBanner() {
  const endsAt = useFocus((s) => s.endsAt)
  const label = useFocus((s) => s.label)
  const [, tick] = useState(0)
  useEffect(() => {
    if (endsAt === null) return
    const t = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [endsAt])
  if (endsAt === null) return null
  const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
  return (
    <div data-focus-banner className="flex items-center gap-3 border-b border-ink bg-ink px-6 py-2 text-paper">
      <span className="kicker !text-paper/70">Focus session</span>
      <span className="text-[13px] font-medium">{label}</span>
      <span className="font-mono text-[13px] tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
      <button onClick={() => useFocus.getState().stop()} className="ml-auto border border-paper/60 px-2 py-0.5 text-[11px] font-medium hover:bg-paper hover:text-ink">End</button>
    </div>
  )
}

function statusOf(a: Automation, running: boolean): { label: string; tone: string } {
  if (running) return { label: 'Running', tone: 'accent-text' }
  if (a.lastStatus === 'failed') return { label: 'Failed', tone: 'text-signal' }
  if (!a.enabled) return { label: 'Disabled', tone: 'text-white/55' }
  return { label: a.lastStatus ? STATUS_LABEL[a.lastStatus] : 'Active', tone: a.lastStatus ? statusTone(a.lastStatus) : '' }
}

function Row({
  a, running, onOpen, onToggle, onRun, onDuplicate, onDelete,
}: { a: Automation; running: boolean; onOpen: () => void; onToggle: (on: boolean) => void; onRun: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const trigger = getTriggerDef(a.trigger.type)
  const status = statusOf(a, running)
  return (
    <div
      data-automation={a.id} data-enabled={a.enabled} onClick={onOpen}
      className="grid cursor-default grid-cols-[minmax(0,1fr)_190px_100px_90px_52px_132px] items-center gap-4 border-b border-rule-soft px-6 py-3 hover:bg-white/[0.04]"
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-bold tracking-[-0.02em]">{a.name}</div>
        <div className="truncate text-[12px] text-white/65">{a.description || 'No description'}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12.5px]">{trigger ? trigger.summary(a.trigger.config) : 'Unknown trigger'}</div>
        <div className="kicker mt-1">{a.category}</div>
      </div>
      <div className="text-[12.5px] text-white/70">{ago(a.lastRunAt)}</div>
      <div data-status className={`text-[12.5px] font-medium ${status.tone}`}>{status.label}</div>
      <div onClick={(e) => e.stopPropagation()}><Switch checked={a.enabled} onChange={onToggle} label={`Enable ${a.name}`} /></div>
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        {running
          ? <button aria-label={`Stop ${a.name}`} onClick={() => cancelRun(a.id)} className="ibtn grid size-7 place-items-center"><Square size={14} /></button>
          : <button aria-label={`Run ${a.name}`} onClick={onRun} className="ibtn grid size-7 place-items-center"><Play size={14} /></button>}
        <button aria-label={`Edit ${a.name}`} onClick={onOpen} className="ibtn grid size-7 place-items-center"><Pencil size={14} /></button>
        <button aria-label={`Duplicate ${a.name}`} onClick={onDuplicate} className="ibtn grid size-7 place-items-center"><Copy size={14} /></button>
        <button aria-label={`Delete ${a.name}`} onClick={onDelete} className="ibtn grid size-7 place-items-center hover:!bg-signal"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

export function Automations(_props: AppProps) {
  const automations = useAutomations((s) => s.automations)
  const running = useAutomations((s) => s.running)
  const [tab, setTab] = useState<'automations' | 'history'>('automations')
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState<AutomationCategory | null>(null)
  const [query, setQuery] = useState('')
  const [review, setReview] = useState<{ id: string; purpose: ReviewPurpose } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const store = useAutomations.getState
  const find = (id: string) => automations.find((a) => a.id === id)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = automations.filter((a) =>
      matchesFilter(a, filter) && (!category || a.category === category) &&
      (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)))
    return filter === 'recent' ? [...list].sort((a, b) => (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0)) : list
  }, [automations, filter, category, query])

  const start = (a: Automation) => void runAutomation(a, { trigger: 'Manual' }).then((r) => { if (!r) notify('Already running', a.name) })
  const requestRun = (a: Automation) => (sensitiveSteps(a.steps).length ? setReview({ id: a.id, purpose: 'run' }) : start(a))
  const requestToggle = (a: Automation, on: boolean) => (on ? setReview({ id: a.id, purpose: 'enable' }) : store().setEnabled(a.id, false))

  const create = (a?: Partial<Automation>) => {
    const id = store().add(a)
    if (id) { setEditing(id); setTemplatesOpen(false) }
    else notify('Automation limit reached', 'Delete one to create another.')
  }
  const duplicate = (id: string) => { if (!store().duplicate(id)) notify('Automation limit reached', 'Delete one to create another.') }

  const reviewing = review ? find(review.id) : undefined

  const confirmReview = () => {
    if (!review || !reviewing) return
    if (review.purpose === 'enable') store().setEnabled(review.id, true)
    else start(reviewing)
    setReview(null)
  }

  const count = (f: Filter) => automations.filter((a) => matchesFilter(a, f)).length

  return (
    <div className="relative flex h-full flex-col bg-paper text-ink" data-app="automations">
      <FocusBanner />
      {editing ? (
        <Editor id={editing} onBack={() => setEditing(null)} onOpen={setEditing} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-6 overflow-auto border-r border-ink bg-sidebar px-4 py-5">
            <div>
              <div className="kicker mb-2">View</div>
              {FILTERS.map((f) => (
                <button
                  key={f.id} data-filter={f.id} aria-pressed={tab === 'automations' && filter === f.id}
                  onClick={() => { setTab('automations'); setFilter(f.id) }}
                  className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-[13px] ${tab === 'automations' && filter === f.id ? 'bg-ink font-medium text-paper' : 'hover:bg-white/10'}`}
                >
                  {f.label}<span className="font-mono text-[11px] opacity-70">{count(f.id)}</span>
                </button>
              ))}
              <button
                data-tab="history" aria-pressed={tab === 'history'} onClick={() => setTab('history')}
                className={`mt-2 flex w-full items-center justify-between border-t border-rule-soft px-2 py-1.5 pt-2.5 text-left text-[13px] ${tab === 'history' ? 'bg-ink font-medium text-paper' : 'hover:bg-white/10'}`}
              >
                Run history
              </button>
            </div>
            <div>
              <div className="kicker mb-2">Category</div>
              {AUTOMATION_CATEGORIES.map((c) => (
                <button
                  key={c} data-category={c} aria-pressed={category === c} onClick={() => { setTab('automations'); setCategory(category === c ? null : c) }}
                  className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-[13px] ${category === c ? 'border-l-2 border-[var(--accent)] bg-white/10 font-medium' : 'hover:bg-white/10'}`}
                >
                  {c}<span className="font-mono text-[11px] opacity-70">{automations.filter((a) => a.category === c).length}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col">
            {tab === 'history' ? (
              <History />
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-ink px-6 py-3">
                  <h1 className="text-[20px] font-bold tracking-[-0.035em]">Automations</h1>
                  <div className="relative ml-auto">
                    <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 opacity-60" />
                    <input aria-label="Search automations" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className="field w-52 py-1.5 pl-8 pr-2.5 text-[13px]" />
                  </div>
                  <button data-action="templates" onClick={() => setTemplatesOpen(!templatesOpen)} className="border border-ink px-3 py-1.5 text-[12px] font-medium hover-invert">From template</button>
                  <button data-action="create" onClick={() => create()} className="accent-bg flex items-center gap-1.5 border border-[var(--accent)] px-3 py-1.5 text-[12px] font-medium hover:opacity-90">
                    <Plus size={13} /> Create automation
                  </button>
                </div>

                {templatesOpen && (
                  <div data-templates className="grid grid-cols-2 gap-px border-b border-ink bg-[var(--rule)] max-md:grid-cols-1">
                    {TEMPLATES.map((t) => (
                      <button key={t.id} data-template={t.id} onClick={() => create(fromTemplate(t))} className="bg-paper px-6 py-3 text-left hover:bg-white/10">
                        <div className="text-[13px] font-bold">{t.name}</div>
                        <div className="text-[12px] text-white/65">{t.description}</div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_190px_100px_90px_52px_132px] gap-4 border-b border-ink px-6 py-2">
                  {['Name', 'Trigger', 'Last run', 'Status', 'On', ''].map((h, i) => <span key={i} className="kicker">{h}</span>)}
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {visible.map((a) => (
                    <Row
                      key={a.id} a={a} running={a.id in running}
                      onOpen={() => setEditing(a.id)} onToggle={(on) => requestToggle(a, on)} onRun={() => requestRun(a)}
                      onDuplicate={() => duplicate(a.id)} onDelete={() => setDeleting(a.id)}
                    />
                  ))}
                  {!visible.length && (
                    <div className="px-6 py-10 text-[13px] text-white/60" data-empty>
                      {automations.length ? 'Nothing matches these filters.' : (
                        <>
                          <p className="mb-3 text-[15px] font-bold text-ink">No automations yet</p>
                          <p>Create one from scratch, or start from a template: <button className="accent-text underline underline-offset-2" onClick={() => setTemplatesOpen(true)}>show templates</button>.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      )}

      <AnimatePresence>
        {reviewing && review && <ReviewDialog key="review" automation={reviewing} purpose={review.purpose} onConfirm={confirmReview} onClose={() => setReview(null)} />}
        {deleting && find(deleting) && (
          <ConfirmDialog
            key="delete" title="Delete automation" confirmLabel="Delete" onClose={() => setDeleting(null)}
            message={`Delete “${find(deleting)!.name}” and its run history? This cannot be undone.`}
            onConfirm={() => { store().remove(deleting); setDeleting(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
