import type { ActionNode, Automation, IfNode, Node, RunContext, RunRecord, RunStatus, TriggerEvent } from './types'
import { MAX_DEPTH, MAX_STEPS_PER_RUN, getAction, getConditionDef } from './model'
import { useAutomations, newRunId } from './store'
import { withoutEvents } from './guard'
import { createCapabilities } from '../os/permissions'
import { notify } from '../store/notificationStore'
import { useSettings } from '../store/settingsStore'
import { pad2 } from './config'

/** The Automations app is the identity automations run under: its manifest permissions and the user's grants apply. */
export const ENGINE_APP_ID = 'automations'

class Cancelled extends Error {}

interface Controller { cancelled: boolean; wake: (() => void) | null }
const controllers = new Map<string, Controller>()

// Loop guard: no automation may start more than RATE_LIMIT times within RATE_WINDOW.
const RATE_LIMIT = 5
const RATE_WINDOW = 10_000
const recentStarts = new Map<string, number[]>()

function variables(event: TriggerEvent | null): Record<string, string> {
  const now = new Date()
  const hour = now.getHours()
  return {
    greeting: hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening',
    user: useSettings.getState().username,
    date: now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    weekday: now.toLocaleDateString([], { weekday: 'long' }),
    time: `${pad2(hour)}:${pad2(now.getMinutes())}`,
    app: event?.data.appName ?? '',
    workspace: event?.data.workspaceName ?? '',
  }
}

export const isRunning = (automationId: string) => automationId in useAutomations.getState().running

export function cancelRun(automationId: string) {
  const c = controllers.get(automationId)
  if (!c) return
  c.cancelled = true
  c.wake?.()
}

function recordSkipped(a: Automation, trigger: string, reason: string) {
  const s = useAutomations.getState()
  const id = newRunId()
  const now = Date.now()
  // A skipped run is logged directly: it must not mark the automation as running.
  useAutomations.setState({
    history: [{ id, automationId: a.id, name: a.name, trigger, dryRun: false, status: 'skipped', startedAt: now, finishedAt: now, error: reason, steps: [] } satisfies RunRecord, ...s.history].slice(0, 100),
  })
}

export interface RunOptions {
  trigger: string
  event?: TriggerEvent | null
  /** Check and report what would happen without changing anything. */
  dryRun?: boolean
}

/**
 * Runs an automation. Resolves when it has finished, or immediately with null when it was refused
 * (already running, or too many starts in a short time).
 */
export async function runAutomation(a: Automation, opts: RunOptions): Promise<RunRecord | null> {
  const store = useAutomations
  const dryRun = opts.dryRun === true

  if (isRunning(a.id)) {
    if (!dryRun) recordSkipped(a, opts.trigger, 'Already running')
    return null
  }
  const now = Date.now()
  const starts = (recentStarts.get(a.id) ?? []).filter((t) => now - t < RATE_WINDOW)
  if (!dryRun && starts.length >= RATE_LIMIT) {
    recordSkipped(a, opts.trigger, 'Started too often in a short time; skipped to prevent a loop')
    return null
  }
  if (!dryRun) recentStarts.set(a.id, [...starts, now])

  const control: Controller = { cancelled: false, wake: null }
  controllers.set(a.id, control)
  const runId = newRunId()
  store.getState().startRun({
    id: runId, automationId: a.id, name: a.name, trigger: opts.trigger, dryRun,
    status: 'running', startedAt: now, finishedAt: null, error: null, steps: [],
  })

  const log = (label: string, status: 'ok' | 'failed' | 'info', message: string) =>
    store.getState().logStep(runId, { label, status, message, at: Date.now() })

  const ctx: RunContext = {
    caps: createCapabilities(ENGINE_APP_ID),
    vars: variables(opts.event ?? null),
    event: opts.event ?? null,
    dryRun,
    cancelled: () => control.cancelled,
    sleep: (ms) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(done, ms)
        function done() { window.clearTimeout(t); control.wake = null; resolve() }
        control.wake = done
      }),
  }

  let executed = 0
  let failures = 0

  const runAction = async (node: ActionNode) => {
    const def = getAction(node.type)
    const label = def?.label ?? node.type
    try {
      if (!def) throw new Error(`Unknown action “${node.type}”`)
      const problem = def.check?.(node.config)
      if (problem) throw new Error(problem)
      if (dryRun) {
        log(label, 'ok', `Would: ${def.summary(node.config)}`)
        return
      }
      // Event suppression covers the synchronous part of the action, which is where windows,
      // workspaces and settings change; the awaited remainder (waits) causes no events.
      let pending: ReturnType<typeof def.run> = undefined
      withoutEvents(() => { pending = def.run(node.config, ctx) })
      const message = await pending
      log(label, 'ok', typeof message === 'string' ? message : def.summary(node.config))
    } catch (e) {
      if (control.cancelled) throw new Cancelled()
      failures++
      log(label, 'failed', e instanceof Error ? e.message : 'Unknown error')
      if (!node.continueOnError) throw new StepFailure()
    }
  }

  const runIf = async (node: IfNode, depth: number) => {
    const results: boolean[] = []
    for (const c of node.conditions) {
      const def = getConditionDef(c.type)
      try {
        if (!def) throw new Error(`Unknown condition “${c.type}”`)
        const problem = def.check?.(c.config)
        if (problem) throw new Error(problem)
        results.push(def.test(c.config, ctx) !== c.negate)
      } catch (e) {
        failures++
        log(def?.label ?? 'Condition', 'failed', e instanceof Error ? e.message : 'Unknown error')
        throw new StepFailure()
      }
    }
    const pass = node.mode === 'all' ? results.every(Boolean) : results.some(Boolean)
    const text = node.conditions.map((c, i) => `${c.negate ? 'not ' : ''}${getConditionDef(c.type)?.summary(c.config) ?? c.type} → ${results[i]}`).join(node.mode === 'all' ? ' AND ' : ' OR ')
    log('If', 'info', `${text} · taking ${pass ? 'Then' : 'Else'}`)
    await runNodes(pass ? node.then : node.else, depth + 1)
  }

  const runNodes = async (nodes: Node[], depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) throw new Error('Conditions are nested too deeply')
    for (const node of nodes) {
      if (control.cancelled) throw new Cancelled()
      if (++executed > MAX_STEPS_PER_RUN) throw new Error(`Stopped after ${MAX_STEPS_PER_RUN} steps`)
      if (node.kind === 'action') await runAction(node)
      else await runIf(node, depth)
    }
  }

  let status: RunStatus = 'success'
  let error: string | null = null
  try {
    await runNodes(a.steps, 0)
    if (failures) { status = 'failed'; error = `${failures} step(s) failed` }
  } catch (e) {
    if (e instanceof Cancelled) { status = 'cancelled'; error = 'Cancelled'; log('Run', 'info', 'Cancelled') }
    else if (e instanceof StepFailure) { status = 'failed'; error = 'A step failed; remaining steps were not run' }
    else { status = 'failed'; error = e instanceof Error ? e.message : 'Unknown error'; log('Run', 'failed', error) }
  } finally {
    controllers.delete(a.id)
  }

  store.getState().finishRun(runId, status, error)
  const record = store.getState().history.find((r) => r.id === runId) ?? null
  if (status === 'failed' && !dryRun) notify(`Automation failed: ${a.name}`, error ?? undefined)
  return record
}

class StepFailure extends Error {}
