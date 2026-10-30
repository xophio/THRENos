import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Automation, RunRecord, RunStatus, StepLog } from './types'
import { cloneNodes, newAutomation, sanitizeAutomation, sensitiveSignature } from './model'
import { uid } from '../utils'

export const MAX_HISTORY = 100
export const MAX_AUTOMATIONS = 100
const MAX_STEP_LOGS = 200

interface AutomationState {
  automations: Automation[]
  history: RunRecord[]
  /** automation id → run id, for runs in progress. Not persisted. */
  running: Record<string, string>

  add: (partial?: Partial<Automation>) => string | null
  /** Replaces an automation's definition. An enabled one is switched off if its sensitive steps changed. */
  save: (a: Automation) => void
  remove: (id: string) => void
  duplicate: (id: string) => string | null
  /** Turning on records which sensitive steps the user confirmed. */
  setEnabled: (id: string, enabled: boolean) => void

  startRun: (record: RunRecord) => void
  logStep: (runId: string, step: StepLog) => void
  finishRun: (runId: string, status: RunStatus, error: string | null) => void
  clearHistory: (automationId?: string) => void
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function sanitizeRun(raw: unknown): RunRecord | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.automationId !== 'string') return null
  const steps: StepLog[] = []
  for (const s of Array.isArray(raw.steps) ? raw.steps.slice(0, MAX_STEP_LOGS) : []) {
    if (isObject(s) && typeof s.label === 'string' && typeof s.message === 'string' && typeof s.at === 'number') {
      steps.push({ label: s.label, message: s.message, at: s.at, status: s.status === 'failed' ? 'failed' : s.status === 'info' ? 'info' : 'ok' })
    }
  }
  const started = typeof raw.startedAt === 'number' ? raw.startedAt : Date.now()
  const status: RunStatus = ['success', 'failed', 'cancelled', 'skipped', 'running'].includes(raw.status as string) ? (raw.status as RunStatus) : 'failed'
  // A run that was still going when the page closed never finished.
  const interrupted = status === 'running'
  return {
    id: raw.id,
    automationId: raw.automationId,
    name: typeof raw.name === 'string' ? raw.name : 'Automation',
    trigger: typeof raw.trigger === 'string' ? raw.trigger : '',
    dryRun: raw.dryRun === true,
    status: interrupted ? 'cancelled' : status,
    startedAt: started,
    finishedAt: typeof raw.finishedAt === 'number' ? raw.finishedAt : interrupted ? started : null,
    error: interrupted ? 'Interrupted: THRENos closed while this was running' : typeof raw.error === 'string' ? raw.error : null,
    steps,
  }
}

export const useAutomations = create<AutomationState>()(
  persist(
    (set, get) => ({
      automations: [],
      history: [],
      running: {},

      add: (partial) => {
        if (get().automations.length >= MAX_AUTOMATIONS) return null
        const a = newAutomation(partial)
        set((s) => ({ automations: [...s.automations, a] }))
        return a.id
      },
      save: (a) =>
        set((s) => ({
          automations: s.automations.map((old) => {
            if (old.id !== a.id) return old
            const changed = sensitiveSignature(a.steps) !== old.approvedSig
            const needsApproval = sensitiveSignature(a.steps) !== '[]'
            const enabled = a.enabled && !(needsApproval && changed)
            return { ...a, enabled, approvedSig: old.approvedSig, updatedAt: Date.now() }
          }),
        })),
      remove: (id) => set((s) => ({ automations: s.automations.filter((a) => a.id !== id), history: s.history.filter((r) => r.automationId !== id) })),
      duplicate: (id) => {
        const src = get().automations.find((a) => a.id === id)
        if (!src || get().automations.length >= MAX_AUTOMATIONS) return null
        const copy = newAutomation({
          name: `${src.name} copy`.slice(0, 80), description: src.description, category: src.category,
          trigger: { type: src.trigger.type, config: structuredClone(src.trigger.config) }, steps: cloneNodes(src.steps),
        })
        set((s) => ({ automations: [...s.automations, copy] }))
        return copy.id
      },
      setEnabled: (id, enabled) =>
        set((s) => ({
          automations: s.automations.map((a) =>
            a.id === id ? { ...a, enabled, approvedSig: enabled ? sensitiveSignature(a.steps) : a.approvedSig, updatedAt: Date.now() } : a),
        })),

      startRun: (record) =>
        set((s) => ({
          history: [record, ...s.history].slice(0, MAX_HISTORY),
          running: { ...s.running, [record.automationId]: record.id },
        })),
      logStep: (runId, step) =>
        set((s) => ({
          history: s.history.map((r) => (r.id === runId && r.steps.length < MAX_STEP_LOGS ? { ...r, steps: [...r.steps, step] } : r)),
        })),
      finishRun: (runId, status, error) =>
        set((s) => {
          const run = s.history.find((r) => r.id === runId)
          const { [run?.automationId ?? '']: _done, ...running } = s.running
          const finishedAt = Date.now()
          return {
            running,
            history: s.history.map((r) => (r.id === runId ? { ...r, status, error, finishedAt } : r)),
            automations: run && !run.dryRun && status !== 'skipped'
              ? s.automations.map((a) => (a.id === run.automationId ? { ...a, lastRunAt: finishedAt, lastStatus: status } : a))
              : s.automations,
          }
        }),
      clearHistory: (automationId) =>
        set((s) => ({ history: automationId ? s.history.filter((r) => r.automationId !== automationId) : [] })),
    }),
    {
      name: 'threnos-automations',
      version: 1,
      partialize: (s) => ({ automations: s.automations, history: s.history }),
      merge: (persisted, current) => {
        const p = isObject(persisted) ? persisted : {}
        const seen = new Set<string>()
        const automations = (Array.isArray(p.automations) ? p.automations : [])
          .map(sanitizeAutomation)
          .filter((a): a is Automation => a !== null && !seen.has(a.id) && !!seen.add(a.id))
          .slice(0, MAX_AUTOMATIONS)
        const history = (Array.isArray(p.history) ? p.history : []).map(sanitizeRun).filter((r): r is RunRecord => r !== null).slice(0, MAX_HISTORY)
        return { ...current, automations, history, running: {} }
      },
    },
  ),
)

export const newRunId = uid
