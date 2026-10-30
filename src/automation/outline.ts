import type { Node, Risk } from './types'
import { getAction, getConditionDef } from './model'

export interface OutlineLine {
  depth: number
  text: string
  risk?: Risk
  /** Branch headings ("Then", "Otherwise") are rendered quieter than steps. */
  heading?: boolean
}

/** A readable, ordered description of what a workflow will do. */
export function outline(nodes: Node[], depth = 0): OutlineLine[] {
  const lines: OutlineLine[] = []
  for (const n of nodes) {
    if (n.kind === 'action') {
      const def = getAction(n.type)
      lines.push({ depth, text: def ? def.summary(n.config) : `Unknown action “${n.type}”`, risk: def?.risk })
      continue
    }
    const checks = n.conditions.map((c) => `${c.negate ? 'not ' : ''}${getConditionDef(c.type)?.summary(c.config) ?? c.type}`)
    lines.push({ depth, text: `If ${n.mode === 'all' ? 'all' : 'any'} of: ${checks.join('; ') || 'no checks'}`, heading: true })
    lines.push({ depth: depth + 1, text: 'Then', heading: true }, ...outline(n.then, depth + 2))
    if (n.else.length) lines.push({ depth: depth + 1, text: 'Otherwise', heading: true }, ...outline(n.else, depth + 2))
  }
  return lines
}
