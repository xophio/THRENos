import { useFs } from '../../store/fsStore'
import { HOME, normalize } from '../../utils/path'
import { COMMAND_NAMES } from './commands'
import { tokenize } from './parser'

export interface Completion {
  /** Index in the input where the word being completed starts. */
  from: number
  /** Replacement texts (already escaped for the shell). */
  candidates: string[]
}

const escapeWord = (s: string) => s.replace(/([ "'\\;&|<>$])/g, '\\$1')

const COMMAND_BREAKERS = new Set([';', '&&', '||', '|'])
const DIR_ONLY = new Set(['cd'])

export function complete(input: string, cwd: string): Completion {
  const { tokens } = tokenize(input)
  const endsWithSpace = /\s$/.test(input)
  const last = tokens[tokens.length - 1]
  const editing = !endsWithSpace && last?.kind === 'word' ? last : null

  const before = editing ? tokens.slice(0, -1) : tokens
  const prev = [...before].reverse().find((t) => t.kind !== 'space')
  const from = editing ? input.length - editing.raw.length : input.length
  const partial = editing?.value ?? ''

  // The first word of each command is completed against command names.
  if (!prev || (prev.kind === 'op' && COMMAND_BREAKERS.has(prev.value))) {
    return { from, candidates: COMMAND_NAMES.filter((c) => c.startsWith(partial)).map((c) => c).sort() }
  }

  let cmdName = ''
  for (let i = before.length - 1; i >= 0; i--) {
    const t = before[i]
    if (t.kind === 'op' && COMMAND_BREAKERS.has(t.value)) break
    if (t.kind === 'word') cmdName = t.value
  }
  const dirsOnly = DIR_ONLY.has(cmdName)

  const slash = partial.lastIndexOf('/')
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : ''
  const base = partial.slice(slash + 1)
  const dirAbs = normalize(dirPart === '~/' || dirPart === '~' ? HOME + '/' : dirPart.replace(/^~\//, HOME + '/'), cwd)

  const store = useFs.getState()
  if (!store.isDir(dirAbs)) return { from, candidates: [] }

  const candidates = store
    .list(dirAbs)
    .filter((e) => e.name.startsWith(base) && (base.startsWith('.') || !e.name.startsWith('.')))
    .filter((e) => !dirsOnly || e.type === 'folder')
    .map((e) => escapeWord(dirPart + e.name) + (e.type === 'folder' ? '/' : ''))
  return { from, candidates }
}

export function commonPrefix(items: string[]): string {
  if (!items.length) return ''
  let p = items[0]
  for (const s of items.slice(1)) while (!s.startsWith(p)) p = p.slice(0, -1)
  return p
}
