import type { LucideIcon } from 'lucide-react'
import type { AppCapabilities } from '../os/permissions'

/** Free-form parameter bag. Each definition reads its own keys through the helpers in `config.ts`. */
export type Config = Record<string, unknown>

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'select' | 'app' | 'apps' | 'workspace' | 'path'
  | 'wallpaper' | 'time' | 'days'

export interface Field {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  hint?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  /** For `app`/`workspace`: also offer an "Any" choice that stores an empty string. */
  any?: boolean
}

export interface TriggerEvent {
  type: string
  data: Record<string, string>
}

/** Everything the engine hands to an action or condition while a run is in progress. */
export interface RunContext {
  caps: AppCapabilities
  vars: Record<string, string>
  event: TriggerEvent | null
  dryRun: boolean
  cancelled: () => boolean
  /** Waits, but wakes up early when the run is cancelled. */
  sleep: (ms: number) => Promise<void>
}

export type ActionGroup = 'Applications' | 'Workspaces' | 'Files' | 'Notifications' | 'Productivity' | 'Desktop' | 'Flow'
export type Risk = 'modifies' | 'closes'

export interface ActionDef {
  type: string
  label: string
  group: ActionGroup
  icon: LucideIcon
  fields: Field[]
  defaults: Config
  /** Marks actions that change or discard existing user data; they need confirmation before running. */
  risk?: Risk
  summary: (c: Config) => string
  /** Returns an error message when the configuration cannot work. Also used by test runs. */
  check?: (c: Config) => string | null
  run: (c: Config, ctx: RunContext) => void | string | Promise<void | string>
}

export interface ConditionDef {
  type: string
  label: string
  icon: LucideIcon
  fields: Field[]
  defaults: Config
  summary: (c: Config) => string
  check?: (c: Config) => string | null
  test: (c: Config, ctx: RunContext) => boolean
}

export type TriggerGroup = 'Manual' | 'Time' | 'Applications' | 'User'

export interface TriggerState {
  now: Date
  /** When this automation last fired in this session, or null. */
  lastFired: number | null
  /** The moment the automation started being watched (session start, or last edit). */
  base: number
}

export interface TriggerDef {
  type: string
  label: string
  group: TriggerGroup
  icon: LucideIcon
  fields: Field[]
  defaults: Config
  summary: (c: Config) => string
  check?: (c: Config) => string | null
  /** Event triggers: does this event concern this trigger's configuration? Omitted = always. */
  matches?: (c: Config, data: Record<string, string>) => boolean
  /** Time triggers: is the automation due now? Polled once a second by the scheduler. */
  due?: (c: Config, s: TriggerState) => boolean
}

// ---- Persisted data ----

export interface Condition {
  id: string
  type: string
  config: Config
  negate: boolean
}

export interface ActionNode {
  id: string
  kind: 'action'
  type: string
  config: Config
  /** Keep going after this step fails (the run is still reported as failed). */
  continueOnError: boolean
}

export interface IfNode {
  id: string
  kind: 'if'
  mode: 'all' | 'any'
  conditions: Condition[]
  then: Node[]
  else: Node[]
}

export type Node = ActionNode | IfNode

export const AUTOMATION_CATEGORIES = ['Productivity', 'Workspace', 'Files', 'Desktop', 'General'] as const
export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[number]

export type RunStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'skipped'
export type StepStatus = 'ok' | 'failed' | 'info'

export interface Automation {
  id: string
  name: string
  description: string
  category: AutomationCategory
  enabled: boolean
  trigger: { type: string; config: Config }
  steps: Node[]
  createdAt: number
  updatedAt: number
  lastRunAt: number | null
  lastStatus: RunStatus | null
  /** Fingerprint of the sensitive steps the user confirmed when enabling. A change turns the automation off. */
  approvedSig: string
}

export interface StepLog {
  label: string
  status: StepStatus
  message: string
  at: number
}

export interface RunRecord {
  id: string
  automationId: string
  name: string
  trigger: string
  dryRun: boolean
  status: RunStatus
  startedAt: number
  finishedAt: number | null
  error: string | null
  steps: StepLog[]
}
