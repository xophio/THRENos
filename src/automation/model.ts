import type { Automation, AutomationCategory, Condition, Config, Node, ActionNode, IfNode } from './types'
import { AUTOMATION_CATEGORIES } from './types'
import { uid } from '../utils'
import { ACTIONS } from './actions'
import { CONDITIONS } from './conditions'
import { TRIGGERS } from './triggers'

export const MAX_DEPTH = 3
export const MAX_STEPS_PER_RUN = 200

const actionByType = new Map(ACTIONS.map((a) => [a.type, a]))
const conditionByType = new Map(CONDITIONS.map((c) => [c.type, c]))
const triggerByType = new Map(TRIGGERS.map((t) => [t.type, t]))
export const getAction = (type: string) => actionByType.get(type)
export const getConditionDef = (type: string) => conditionByType.get(type)
export const getTriggerDef = (type: string) => triggerByType.get(type)

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---- constructors ----

export const newAction = (type: string): ActionNode => ({
  id: uid(), kind: 'action', type, config: structuredClone(getAction(type)?.defaults ?? {}), continueOnError: false,
})

export const newCondition = (type: string): Condition => ({
  id: uid(), type, config: structuredClone(getConditionDef(type)?.defaults ?? {}), negate: false,
})

export const newIf = (): IfNode => ({ id: uid(), kind: 'if', mode: 'all', conditions: [newCondition(CONDITIONS[0].type)], then: [], else: [] })

export function newAutomation(partial: Partial<Automation> = {}): Automation {
  const now = Date.now()
  return {
    id: uid(), name: 'Untitled automation', description: '', category: 'General', enabled: false,
    trigger: { type: 'manual', config: {} }, steps: [], createdAt: now, updatedAt: now,
    lastRunAt: null, lastStatus: null, approvedSig: '', ...partial,
  }
}

/** Deep copy with fresh ids, so a duplicate never shares identity with its source. */
export function cloneNodes(nodes: Node[]): Node[] {
  return nodes.map((n): Node =>
    n.kind === 'action'
      ? { ...n, id: uid(), config: structuredClone(n.config) }
      : {
          ...n, id: uid(),
          conditions: n.conditions.map((c) => ({ ...c, id: uid(), config: structuredClone(c.config) })),
          then: cloneNodes(n.then), else: cloneNodes(n.else),
        },
  )
}

// ---- inspection ----

export function walk(nodes: Node[], visit: (node: Node) => void) {
  for (const n of nodes) {
    visit(n)
    if (n.kind === 'if') { walk(n.then, visit); walk(n.else, visit) }
  }
}

export function countSteps(nodes: Node[]): number {
  let count = 0
  walk(nodes, () => count++)
  return count
}

/** Steps that change or discard existing data. */
export function sensitiveSteps(nodes: Node[]): ActionNode[] {
  const out: ActionNode[] = []
  walk(nodes, (n) => { if (n.kind === 'action' && getAction(n.type)?.risk) out.push(n) })
  return out
}

/** Fingerprint of the sensitive steps and their settings; confirming it once approves exactly those steps. */
export function sensitiveSignature(nodes: Node[]): string {
  return JSON.stringify(sensitiveSteps(nodes).map((n) => [n.type, n.config]))
}

/** Every configuration problem in the workflow, as "Step name: message". Empty when it can run. */
export function validateAutomation(a: Pick<Automation, 'trigger' | 'steps'>): string[] {
  const problems: string[] = []
  const trigger = getTriggerDef(a.trigger.type)
  if (!trigger) problems.push(`Trigger: unknown type “${a.trigger.type}”`)
  else {
    const err = trigger.check?.(a.trigger.config)
    if (err) problems.push(`Trigger: ${err}`)
  }
  const visit = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.kind === 'action') {
        const def = getAction(n.type)
        const err = def ? def.check?.(n.config) : `unknown action “${n.type}”`
        if (err) problems.push(`${def?.label ?? n.type}: ${err}`)
      } else {
        if (!n.conditions.length) problems.push('Condition: add at least one check')
        for (const c of n.conditions) {
          const def = getConditionDef(c.type)
          const err = def ? def.check?.(c.config) : `unknown condition “${c.type}”`
          if (err) problems.push(`${def?.label ?? c.type}: ${err}`)
        }
        visit(n.then)
        visit(n.else)
      }
    }
  }
  visit(a.steps)
  return problems
}

// ---- loading saved data ----

const str = (v: unknown, fallback: string, max = 500) => (typeof v === 'string' ? v.slice(0, max) : fallback)
const time = (v: unknown, fallback: number | null) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const config = (v: unknown): Config => (isObject(v) ? { ...v } : {})

function sanitizeCondition(raw: unknown): Condition | null {
  if (!isObject(raw) || typeof raw.type !== 'string') return null
  return { id: str(raw.id, uid(), 40), type: raw.type, config: config(raw.config), negate: raw.negate === true }
}

export function sanitizeNodes(raw: unknown, depth = 0): Node[] {
  if (!Array.isArray(raw)) return []
  const out: Node[] = []
  for (const n of raw.slice(0, 100)) {
    if (!isObject(n)) continue
    if (n.kind === 'action' && typeof n.type === 'string') {
      out.push({ id: str(n.id, uid(), 40), kind: 'action', type: n.type, config: config(n.config), continueOnError: n.continueOnError === true })
    } else if (n.kind === 'if' && depth < MAX_DEPTH) {
      out.push({
        id: str(n.id, uid(), 40), kind: 'if', mode: n.mode === 'any' ? 'any' : 'all',
        conditions: (Array.isArray(n.conditions) ? n.conditions : []).map(sanitizeCondition).filter((c): c is Condition => c !== null),
        then: sanitizeNodes(n.then, depth + 1), else: sanitizeNodes(n.else, depth + 1),
      })
    }
  }
  return out
}

/** Accepts a saved automation or returns null. Unknown trigger types fall back to manual and the automation is disabled. */
export function sanitizeAutomation(raw: unknown): Automation | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id) return null
  const trigger = isObject(raw.trigger) && typeof raw.trigger.type === 'string' ? raw.trigger : null
  const known = trigger ? triggerByType.has(trigger.type as string) : false
  const steps = sanitizeNodes(raw.steps)
  const status = ['success', 'failed', 'cancelled', 'skipped'].includes(raw.lastStatus as string) ? (raw.lastStatus as Automation['lastStatus']) : null
  return {
    id: raw.id.slice(0, 40),
    name: str(raw.name, 'Untitled automation', 80).trim() || 'Untitled automation',
    description: str(raw.description, '', 300),
    category: AUTOMATION_CATEGORIES.includes(raw.category as AutomationCategory) ? (raw.category as AutomationCategory) : 'General',
    enabled: raw.enabled === true && known,
    trigger: known && trigger ? { type: trigger.type as string, config: config(trigger.config) } : { type: 'manual', config: {} },
    steps,
    createdAt: time(raw.createdAt, Date.now())!,
    updatedAt: time(raw.updatedAt, Date.now())!,
    lastRunAt: time(raw.lastRunAt, null),
    lastStatus: status,
    approvedSig: str(raw.approvedSig, '', 20000),
  }
}

export { ACTIONS, CONDITIONS, TRIGGERS }
