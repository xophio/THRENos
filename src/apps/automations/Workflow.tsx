import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import type { ActionGroup, ActionNode, Condition, IfNode, Node } from '../../automation/types'
import { ACTIONS, CONDITIONS, MAX_DEPTH, getAction, getConditionDef, newAction, newCondition, newIf } from '../../automation/model'
import { FieldEditor } from './FieldEditor'

const GROUP_ORDER: ActionGroup[] = ['Applications', 'Workspaces', 'Files', 'Notifications', 'Productivity', 'Desktop', 'Flow']
const RISK_LABEL = { modifies: 'Changes files', closes: 'Closes windows' } as const

function Tick() {
  return <span aria-hidden className="absolute -left-6 top-[22px] w-6 border-t border-ink" />
}

function Move({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center">
      <button aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)} className="ibtn grid size-7 place-items-center"><ArrowUp size={14} /></button>
      <button aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)} className="ibtn grid size-7 place-items-center"><ArrowDown size={14} /></button>
      <button aria-label={`Remove ${label}`} onClick={onRemove} className="ibtn grid size-7 place-items-center hover:!bg-signal"><Trash2 size={14} /></button>
    </div>
  )
}

function ActionCard({
  node, index, count, defaultOpen, onChange, onMove, onRemove,
}: { node: ActionNode; index: number; count: number; defaultOpen: boolean; onChange: (n: ActionNode) => void; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(defaultOpen)
  const def = getAction(node.type)
  const problem = def ? def.check?.(node.config) : `Unknown action “${node.type}”`
  const Icon = def?.icon
  return (
    <div data-step="action" data-step-type={node.type} className="relative">
      <Tick />
      <div className="border border-ink bg-surface">
        <div className="flex items-center gap-1 pr-1">
          <button aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
            {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            {Icon && <Icon size={16} className="shrink-0" />}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{def?.label ?? node.type}</span>
              <span className={`block truncate text-[12px] ${problem ? 'text-signal' : 'text-white/60'}`}>{problem ?? def?.summary(node.config)}</span>
            </span>
          </button>
          {def?.risk && <span className="kicker shrink-0 border border-signal px-1.5 py-1 !text-signal">{RISK_LABEL[def.risk]}</span>}
          <Move index={index} count={count} onMove={onMove} onRemove={onRemove} label={def?.label ?? 'step'} />
        </div>
        {open && def && (
          <div className="grid gap-3 border-t border-rule-soft px-4 py-3">
            <FieldEditor fields={def.fields} config={node.config} onChange={(config) => onChange({ ...node, config })} />
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={node.continueOnError} onChange={(e) => onChange({ ...node, continueOnError: e.target.checked })} />
              Keep going if this step fails
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

function ConditionRow({ cond, onChange, onRemove }: { cond: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  const def = getConditionDef(cond.type)
  const problem = def ? def.check?.(cond.config) : `Unknown condition “${cond.type}”`
  return (
    <div data-condition={cond.type} className="grid gap-3 border border-rule-soft p-3">
      <div className="flex items-center gap-2">
        <select
          aria-label="Condition type" value={cond.type} className="field min-w-0 flex-1 px-2.5 py-1.5 text-[13px]"
          onChange={(e) => onChange({ ...cond, type: e.target.value, config: structuredClone(getConditionDef(e.target.value)?.defaults ?? {}) })}
        >
          {CONDITIONS.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
          {!def && <option value={cond.type}>{cond.type}</option>}
        </select>
        <button
          aria-pressed={cond.negate} onClick={() => onChange({ ...cond, negate: !cond.negate })}
          className={`border border-ink px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${cond.negate ? 'bg-ink text-paper' : 'hover:bg-white/10'}`}
          title="Invert this check"
        >
          Not
        </button>
        <button aria-label="Remove condition" onClick={onRemove} className="ibtn grid size-7 place-items-center"><X size={14} /></button>
      </div>
      {def && <FieldEditor fields={def.fields} config={cond.config} onChange={(config) => onChange({ ...cond, config })} />}
      {problem && <p className="text-[12px] text-signal">{problem}</p>}
    </div>
  )
}

function IfCard({
  node, index, count, depth, onChange, onMove, onRemove,
}: { node: IfNode; index: number; count: number; depth: number; onChange: (n: IfNode) => void; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(true)
  const setCond = (i: number, c: Condition) => onChange({ ...node, conditions: node.conditions.map((x, j) => (j === i ? c : x)) })
  return (
    <div data-step="if" className="relative">
      <Tick />
      <div className="border border-ink bg-surface">
        <div className="flex items-center gap-1 pr-1">
          <button aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
            {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            <span className="accent-bg px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.12em]">IF</span>
            <span className="truncate text-[13px] font-semibold">
              {node.mode === 'all' ? 'All' : 'Any'} of {node.conditions.length} check{node.conditions.length === 1 ? '' : 's'}
            </span>
          </button>
          <Move index={index} count={count} onMove={onMove} onRemove={onRemove} label="condition" />
        </div>
        {open && (
          <div className="grid gap-3 border-t border-rule-soft px-4 py-3">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="kicker">Pass when</span>
              <div role="radiogroup" aria-label="Condition logic" className="inline-flex border border-ink">
                {(['all', 'any'] as const).map((m, i) => (
                  <button
                    key={m} role="radio" aria-checked={node.mode === m} onClick={() => onChange({ ...node, mode: m })}
                    className={`px-3 py-1 text-[12px] font-medium ${i > 0 ? 'border-l border-ink' : ''} ${node.mode === m ? 'bg-ink text-paper' : 'hover:bg-white/10'}`}
                  >
                    {m === 'all' ? 'All (AND)' : 'Any (OR)'}
                  </button>
                ))}
              </div>
            </div>
            {node.conditions.map((c, i) => (
              <ConditionRow key={c.id} cond={c} onChange={(next) => setCond(i, next)} onRemove={() => onChange({ ...node, conditions: node.conditions.filter((_, j) => j !== i) })} />
            ))}
            <button onClick={() => onChange({ ...node, conditions: [...node.conditions, newCondition(CONDITIONS[0].type)] })} className="flex w-fit items-center gap-1.5 text-[12px] font-medium accent-text">
              <Plus size={13} /> Add check
            </button>
            {(['then', 'else'] as const).map((branch) => (
              <div key={branch} data-branch={branch}>
                <div className="kicker mb-2 border-t border-rule-soft pt-3">{branch === 'then' ? 'Then' : 'Otherwise (optional)'}</div>
                <NodeList nodes={node[branch]} depth={depth + 1} onChange={(nodes) => onChange({ ...node, [branch]: nodes })} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AddStep({ depth, onAdd }: { depth: number; onAdd: (n: Node) => void }) {
  const [open, setOpen] = useState(false)
  const add = (n: Node) => { onAdd(n); setOpen(false) }
  return (
    <div className="relative">
      <Tick />
      <button
        aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 border border-dashed border-ink px-3 py-1.5 text-[12px] font-medium hover:bg-white/10"
      >
        <Plus size={13} /> Add step
      </button>
      {open && (
        <div className="mt-2 grid gap-3 border border-ink bg-surface p-3" data-add-menu>
          {depth < MAX_DEPTH && (
            <div>
              <div className="kicker mb-1.5">Logic</div>
              <button onClick={() => add(newIf())} className="border border-ink px-2.5 py-1 text-[12px] font-medium hover:bg-white/10">If / else condition</button>
            </div>
          )}
          {GROUP_ORDER.map((g) => (
            <div key={g}>
              <div className="kicker mb-1.5">{g}</div>
              <div className="flex flex-wrap gap-1.5">
                {ACTIONS.filter((a) => a.group === g).map((a) => (
                  <button key={a.type} data-add-action={a.type} onClick={() => add(newAction(a.type))} className="flex items-center gap-1.5 border border-ink px-2.5 py-1 text-[12px] font-medium hover:bg-white/10">
                    <a.icon size={13} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** An ordered lane of steps along a vertical line. Used for the main flow and for each branch of a condition. */
export function NodeList({ nodes, depth, onChange }: { nodes: Node[]; depth: number; onChange: (nodes: Node[]) => void }) {
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const replace = (i: number, n: Node) => onChange(nodes.map((x, j) => (j === i ? n : x)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...nodes]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  const remove = (i: number) => onChange(nodes.filter((_, j) => j !== i))

  return (
    <div className="relative ml-3 grid gap-3 border-l border-ink pl-6 pb-0.5">
      {nodes.map((n, i) =>
        n.kind === 'action' ? (
          <ActionCard key={n.id} node={n} index={i} count={nodes.length} defaultOpen={n.id === justAdded} onChange={(x) => replace(i, x)} onMove={(d) => move(i, d)} onRemove={() => remove(i)} />
        ) : (
          <IfCard key={n.id} node={n} index={i} count={nodes.length} depth={depth} onChange={(x) => replace(i, x)} onMove={(d) => move(i, d)} onRemove={() => remove(i)} />
        ),
      )}
      <AddStep depth={depth} onAdd={(n) => { setJustAdded(n.id); onChange([...nodes, n]) }} />
    </div>
  )
}
