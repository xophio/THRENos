/**
 * Events caused by an automation's own actions (it opens an app, switches a workspace …) must not trigger
 * other automations, otherwise two automations can start each other forever. Actions run inside
 * `withoutEvents`, and the event listeners ignore anything that happens while it is active.
 */
let depth = 0

export function withoutEvents<T>(fn: () => T): T {
  depth++
  try {
    return fn()
  } finally {
    depth--
  }
}

export const eventsSuppressed = () => depth > 0
