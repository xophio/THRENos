export type TokenKind = 'word' | 'op' | 'space'

export interface Token {
  kind: TokenKind
  /** Source text, used for syntax highlighting. */
  raw: string
  /** Text with quotes and escapes resolved. */
  value: string
  /** Contains single quotes: no variable expansion. */
  literal: boolean
  /** Word started with a quote or escape: no tilde expansion. */
  quoted: boolean
}

export const CONNECTORS = [';', '&&', '||'] as const
export type Connector = (typeof CONNECTORS)[number]

const OPERATORS = ['&&', '||', '>>', ';', '|', '>']

/** Tolerant tokenizer: unterminated quotes are reported but never throw, so it can drive highlighting. */
export function tokenize(line: string): { tokens: Token[]; error?: string } {
  const tokens: Token[] = []
  let error: string | undefined
  let i = 0
  const n = line.length
  const opAt = (k: number) => OPERATORS.find((o) => line.startsWith(o, k))

  while (i < n) {
    const c = line[i]
    if (/\s/.test(c)) {
      let j = i
      while (j < n && /\s/.test(line[j])) j++
      tokens.push({ kind: 'space', raw: line.slice(i, j), value: ' ', literal: false, quoted: false })
      i = j
      continue
    }
    const op = opAt(i)
    if (op) {
      tokens.push({ kind: 'op', raw: op, value: op, literal: false, quoted: false })
      i += op.length
      continue
    }

    let raw = ''
    let value = ''
    let literal = false
    const quoted = c === '"' || c === "'" || c === '\\'
    while (i < n && !/\s/.test(line[i]) && !opAt(i)) {
      const ch = line[i]
      if (ch === '\\' && i + 1 < n) {
        raw += ch + line[i + 1]
        value += line[i + 1]
        i += 2
      } else if (ch === '"' || ch === "'") {
        const close = line.indexOf(ch, i + 1)
        if (close < 0) {
          error = 'unterminated quote'
          raw += line.slice(i)
          value += line.slice(i + 1)
          i = n
        } else {
          raw += line.slice(i, close + 1)
          value += line.slice(i + 1, close)
          if (ch === "'") literal = true
          i = close + 1
        }
      } else {
        raw += ch
        value += ch
        i++
      }
    }
    tokens.push({ kind: 'word', raw, value, literal, quoted })
  }
  return { tokens, error }
}

export interface SimpleCommand {
  args: Token[]
  redirect?: { append: boolean; target: Token }
}

export interface ChainItem {
  /** How this pipeline is linked to the previous one. */
  conn: Connector
  pipeline: SimpleCommand[]
}

export function parse(tokens: Token[]): { chain: ChainItem[]; error?: string } {
  const items = tokens.filter((t) => t.kind !== 'space')
  const chain: ChainItem[] = []
  let pipeline: SimpleCommand[] = []
  let cur: SimpleCommand = { args: [] }
  let conn: Connector = ';'
  let danglingOp: string | null = null
  const unexpected = (t: string) => ({ chain: [], error: `syntax error near unexpected token '${t}'` })

  for (let i = 0; i < items.length; i++) {
    const t = items[i]
    if (t.kind === 'word') {
      cur.args.push(t)
      danglingOp = null
      continue
    }
    if (t.value === '>' || t.value === '>>') {
      const target = items[i + 1]
      if (!target || target.kind !== 'word') return unexpected(target?.value ?? 'newline')
      cur.redirect = { append: t.value === '>>', target }
      i++
      continue
    }
    if (cur.args.length === 0) return unexpected(t.value)
    pipeline.push(cur)
    cur = { args: [] }
    if (t.value === '|') {
      danglingOp = '|'
      continue
    }
    chain.push({ conn, pipeline })
    pipeline = []
    conn = t.value as Connector
    danglingOp = t.value === ';' ? null : t.value
  }

  if (cur.args.length) {
    pipeline.push(cur)
    chain.push({ conn, pipeline })
  } else if (cur.redirect) {
    return unexpected('>')
  }
  if (danglingOp) return { chain: [], error: 'syntax error: unexpected end of input' }
  return { chain }
}
