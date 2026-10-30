import { useFs } from '../../store/fsStore'
import type { FsEntry } from '../../store/fsStore'
import { useWindows } from '../../store/windowStore'
import { useSettings } from '../../store/settingsStore'
import { WALLPAPERS } from '../../theme/wallpapers'
import { useTerminalHistory } from '../../store/terminalStore'
import { notify } from '../../store/notificationStore'
import { APPS } from '../registry'
import type { AppId } from '../../types'
import { HOME, baseName, displayPath, joinPath, normalize } from '../../utils/path'
import { formatDate } from '../../utils/files'
import { parse, tokenize } from './parser'
import type { Token } from './parser'

export interface Line { kind: 'out' | 'err'; text: string }

export interface RunResult {
  lines: Line[]
  cwd: string
  clear: boolean
  exit: boolean
  code: number
}

interface Ctx { args: string[]; stdin: string | null; cwd: string }

interface Out {
  out?: string
  err?: string
  code?: number
  cwd?: string
  clear?: boolean
  exit?: boolean
  /** Do not append a trailing newline when redirecting or piping. */
  raw?: boolean
}

type Command = (ctx: Ctx) => Out | void

const bootTime = Date.now()
const fs = () => useFs.getState()

const resolvePath = (p: string, cwd: string) => normalize(p === '~' ? HOME : p.replace(/^~\//, HOME + '/'), cwd)

const entryAt = (path: string): FsEntry | null => {
  const node = fs().tree[path]
  return node ? { ...node, path, name: baseName(path) } : null
}

/** Splits `-abc` style flags from operands. Returns an error for unknown flags. */
function parseFlags(args: string[], allowed: string, cmd: string) {
  const flags = new Set<string>()
  const rest: string[] = []
  let done = false
  for (const a of args) {
    if (!done && a === '--') { done = true; continue }
    if (!done && /^-[A-Za-z]+$/.test(a)) {
      for (const ch of a.slice(1)) {
        if (!allowed.includes(ch)) return { error: `${cmd}: invalid option -- '${ch}'`, flags, rest }
        flags.add(ch)
      }
    } else rest.push(a)
  }
  return { flags, rest, error: undefined as string | undefined }
}

/** The store speaks in short messages; the shell reports them bash-style. */
const fsMsg = (err: string) => (err === 'No such directory' ? 'No such file or directory' : err)

const lines = (text: string) => {
  const l = text.split('\n')
  if (l[l.length - 1] === '') l.pop()
  return l
}

const textOf = (o: Out) => (o.out === undefined ? '' : o.raw ? o.out : o.out + '\n')

/** Reads operands, or stdin when none are given. Collects per-file errors in bash style. */
function readInputs(cmd: string, files: string[], ctx: Ctx): { chunks: string[]; errors: string[] } {
  if (!files.length) return { chunks: [ctx.stdin ?? ''], errors: [] }
  const chunks: string[] = []
  const errors: string[] = []
  for (const f of files) {
    const p = resolvePath(f, ctx.cwd)
    const node = fs().tree[p]
    if (!node) errors.push(`${cmd}: ${f}: No such file or directory`)
    else if (node.type === 'folder') errors.push(`${cmd}: ${f}: Is a directory`)
    else chunks.push(node.content ?? '')
  }
  return { chunks, errors }
}

function mkdirp(path: string): string | null {
  const parts = path.split('/').filter(Boolean)
  let cur = ''
  for (const part of parts) {
    cur += '/' + part
    if (fs().exists(cur)) {
      if (!fs().isDir(cur)) return 'Not a directory'
    } else {
      const err = fs().mkdir(cur)
      if (err) return err
    }
  }
  return null
}

/** Shared destination logic for cp and mv: a folder target receives the sources inside it. */
function resolveDest(cmd: string, sources: string[], destArg: string, ctx: Ctx): { dests: string[]; error?: string } {
  const dest = resolvePath(destArg, ctx.cwd)
  if (fs().isDir(dest)) return { dests: sources.map((s) => joinPath(dest, baseName(resolvePath(s, ctx.cwd)))) }
  if (sources.length > 1) return { dests: [], error: `${cmd}: target '${destArg}' is not a directory` }
  return { dests: [dest] }
}

const COMMANDS: Record<string, Command> = {
  help: () => ({
    out: [
      'ORBIT shell — available commands',
      '',
      'Files       ls [-a -l]   cd [dir]     pwd        mkdir [-p]   touch',
      '            cat          rm [-r -f]   mv         cp [-r]      echo [-n]',
      'Text        grep [-i -n -v] pat [file]   head/tail [-n N]   wc [-l -w -c]',
      'System      clear   history [-c]   open <app>   apps   theme <name>',
      '            notify <text>   whoami   hostname   date   uname   uptime   neofetch   exit',
      '',
      'Chaining    a ; b      run both',
      '            a && b     run b if a succeeds        a || b    run b if a fails',
      '            a | b      pipe output       cmd > file   overwrite     cmd >> file   append',
      'Keys        Tab complete · ↑/↓ history · Ctrl+L clear · Ctrl+C cancel · Ctrl+U clear line',
    ].join('\n'),
  }),

  clear: () => ({ clear: true }),
  exit: () => ({ exit: true }),

  ls: (ctx) => {
    const { flags, rest, error } = parseFlags(ctx.args, 'alAh', 'ls')
    if (error) return { err: error, code: 2 }
    const showHidden = flags.has('a') || flags.has('A')
    const targets = rest.length ? rest : ['.']
    const errors: string[] = []
    const files: FsEntry[] = []
    const dirs: { arg: string; entries: FsEntry[] }[] = []

    for (const t of targets) {
      const p = resolvePath(t, ctx.cwd)
      const node = entryAt(p)
      if (!node) errors.push(`ls: cannot access '${t}': No such file or directory`)
      else if (node.type === 'folder') dirs.push({ arg: t, entries: fs().list(p) })
      else files.push({ ...node, name: t })
    }

    const fmt = (list: FsEntry[]) => {
      const visible = list.filter((e) => showHidden || !e.name.startsWith('.'))
      if (flags.has('l')) {
        return visible
          .map((e) => {
            const size = e.type === 'folder' ? fs().stats(e.path).files : (e.content ?? '').length
            return `${e.type === 'folder' ? 'd' : '-'} ${String(size).padStart(6)}  ${formatDate(e.mtime)}  ${e.name}${e.type === 'folder' ? '/' : ''}`
          })
          .join('\n')
      }
      return visible.map((e) => e.name + (e.type === 'folder' ? '/' : '')).join('  ')
    }

    const blocks: string[] = []
    if (files.length) blocks.push(fmt(files))
    for (const d of dirs) {
      const body = fmt(d.entries)
      blocks.push(targets.length > 1 ? `${d.arg}:${body ? '\n' + body : ''}` : body)
    }
    const out = blocks.filter((b) => b !== '').join('\n\n')
    return { out: out || undefined, err: errors.join('\n') || undefined, code: errors.length ? 2 : 0 }
  },

  cd: ({ args, cwd }) => {
    if (args.length > 1) return { err: 'cd: too many arguments', code: 1 }
    const target = args[0] ?? '~'
    const p = resolvePath(target, cwd)
    if (!fs().exists(p)) return { err: `cd: ${target}: No such file or directory`, code: 1 }
    if (!fs().isDir(p)) return { err: `cd: ${target}: Not a directory`, code: 1 }
    return { cwd: p }
  },

  pwd: ({ cwd }) => ({ out: cwd }),

  mkdir: (ctx) => {
    const { flags, rest, error } = parseFlags(ctx.args, 'p', 'mkdir')
    if (error) return { err: error, code: 1 }
    if (!rest.length) return { err: 'mkdir: missing operand', code: 1 }
    const errors: string[] = []
    for (const d of rest) {
      const p = resolvePath(d, ctx.cwd)
      if (flags.has('p')) {
        const err = mkdirp(p)
        if (err) errors.push(`mkdir: cannot create directory '${d}': ${fsMsg(err)}`)
      } else if (fs().exists(p)) errors.push(`mkdir: cannot create directory '${d}': File exists`)
      else {
        const err = fs().mkdir(p)
        if (err) errors.push(`mkdir: cannot create directory '${d}': ${fsMsg(err)}`)
      }
    }
    return { err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
  },

  touch: (ctx) => {
    if (!ctx.args.length) return { err: 'touch: missing file operand', code: 1 }
    const errors: string[] = []
    for (const f of ctx.args) {
      const p = resolvePath(f, ctx.cwd)
      if (fs().isDir(p)) continue
      const err = fs().write(p, fs().read(p) ?? '')
      if (err) errors.push(`touch: cannot touch '${f}': ${fsMsg(err)}`)
    }
    return { err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
  },

  cat: (ctx) => {
    const { chunks, errors } = readInputs('cat', ctx.args, ctx)
    const out = chunks.join('')
    return { out: out || undefined, raw: true, err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
  },

  echo: ({ args }) => {
    const noNewline = args[0] === '-n'
    return { out: (noNewline ? args.slice(1) : args).join(' '), raw: noNewline }
  },

  rm: (ctx) => {
    const { flags, rest, error } = parseFlags(ctx.args, 'rfRd', 'rm')
    if (error) return { err: error, code: 1 }
    if (!rest.length) return flags.has('f') ? {} : { err: 'rm: missing operand', code: 1 }
    const recursive = flags.has('r') || flags.has('R')
    const errors: string[] = []
    for (const t of rest) {
      const p = resolvePath(t, ctx.cwd)
      if (p === '/') { errors.push("rm: it is dangerous to operate recursively on '/'"); continue }
      const node = fs().tree[p]
      if (!node) { if (!flags.has('f')) errors.push(`rm: cannot remove '${t}': No such file or directory`); continue }
      if (node.type === 'folder' && !recursive) { errors.push(`rm: cannot remove '${t}': Is a directory`); continue }
      fs().remove(p)
    }
    return { err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
  },

  mv: (ctx) => {
    if (!ctx.args.length) return { err: 'mv: missing file operand', code: 1 }
    if (ctx.args.length === 1) return { err: `mv: missing destination file operand after '${ctx.args[0]}'`, code: 1 }
    const sources = ctx.args.slice(0, -1)
    const { dests, error } = resolveDest('mv', sources, ctx.args[ctx.args.length - 1], ctx)
    if (error) return { err: error, code: 1 }
    const errors: string[] = []
    sources.forEach((s, i) => {
      const src = resolvePath(s, ctx.cwd)
      const dest = dests[i]
      if (!fs().exists(src)) return errors.push(`mv: cannot stat '${s}': No such file or directory`)
      if (src === dest) return errors.push(`mv: '${s}' and '${displayPath(dest)}' are the same file`)
      if (dest.startsWith(src + '/')) return errors.push(`mv: cannot move '${s}' to a subdirectory of itself`)
      const existing = fs().tree[dest]
      if (existing) {
        if (existing.type === 'folder' || fs().isDir(src)) return errors.push(`mv: cannot overwrite '${displayPath(dest)}': Destination exists`)
        fs().remove(dest)
      }
      const err = fs().rename(src, dest)
      if (err) errors.push(`mv: cannot move '${s}': ${fsMsg(err)}`)
    })
    return { err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
  },

  cp: (ctx) => {
    const { flags, rest, error } = parseFlags(ctx.args, 'rR', 'cp')
    if (error) return { err: error, code: 1 }
    if (!rest.length) return { err: 'cp: missing file operand', code: 1 }
    if (rest.length === 1) return { err: `cp: missing destination file operand after '${rest[0]}'`, code: 1 }
    const recursive = flags.has('r') || flags.has('R')
    const sources = rest.slice(0, -1)
    const { dests, error: destError } = resolveDest('cp', sources, rest[rest.length - 1], ctx)
    if (destError) return { err: destError, code: 1 }
    const errors: string[] = []
    sources.forEach((s, i) => {
      const src = resolvePath(s, ctx.cwd)
      const dest = dests[i]
      const node = fs().tree[src]
      if (!node) return errors.push(`cp: cannot stat '${s}': No such file or directory`)
      if (src === dest) return errors.push(`cp: '${s}' and '${displayPath(dest)}' are the same file`)
      if (node.type === 'folder') {
        if (!recursive) return errors.push(`cp: -r not specified; omitting directory '${s}'`)
        if (fs().exists(dest)) return errors.push(`cp: cannot overwrite '${displayPath(dest)}': Destination exists`)
        const err = fs().copy(src, dest)
        if (err) errors.push(`cp: cannot copy '${s}': ${fsMsg(err)}`)
        return
      }
      if (fs().isDir(dest)) return errors.push(`cp: cannot overwrite directory '${displayPath(dest)}' with non-directory`)
      const err = fs().write(dest, node.content ?? '')
      if (err) errors.push(`cp: cannot create '${displayPath(dest)}': ${fsMsg(err)}`)
    })
    return { err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
  },

  grep: (ctx) => {
    const { flags, rest, error } = parseFlags(ctx.args, 'inv', 'grep')
    if (error) return { err: error, code: 2 }
    if (!rest.length) return { err: 'grep: missing pattern', code: 2 }
    const [pattern, ...files] = rest
    let re: RegExp
    try { re = new RegExp(pattern, flags.has('i') ? 'i' : '') } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags.has('i') ? 'i' : '') }
    const { chunks, errors } = readInputs('grep', files, ctx)
    const out: string[] = []
    chunks.forEach((chunk, ci) => {
      lines(chunk).forEach((l, n) => {
        if (re.test(l) === flags.has('v')) return
        const prefix = (files.length > 1 ? files[ci] + ':' : '') + (flags.has('n') ? `${n + 1}:` : '')
        out.push(prefix + l)
      })
    })
    return { out: out.join('\n') || undefined, err: errors.join('\n') || undefined, code: errors.length ? 2 : out.length ? 0 : 1 }
  },

  head: (ctx) => headTail(ctx, 'head'),
  tail: (ctx) => headTail(ctx, 'tail'),

  wc: (ctx) => {
    const { flags, rest, error } = parseFlags(ctx.args, 'lwc', 'wc')
    if (error) return { err: error, code: 1 }
    const { chunks, errors } = readInputs('wc', rest, ctx)
    const all = !flags.size
    const rows = chunks.map((c, i) => {
      const counts = [
        (all || flags.has('l')) && String(c.split('\n').length - 1),
        (all || flags.has('w')) && String(c.split(/\s+/).filter(Boolean).length),
        (all || flags.has('c')) && String(c.length),
      ].filter((x): x is string => x !== false)
      return counts.join(' ') + (rest.length ? ' ' + rest[i] : '')
    })
    return { out: rows.join('\n') || undefined, err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
  },

  open: ({ args }) => {
    const id = args[0]?.toLowerCase() as AppId | undefined
    if (!id) return { err: `open: missing app name. Try: ${Object.keys(APPS).join(', ')}`, code: 1 }
    if (!(id in APPS)) return { err: `open: unknown app '${args[0]}'. Try: ${Object.keys(APPS).join(', ')}`, code: 1 }
    useWindows.getState().open(id)
  },
  apps: () => ({ out: Object.values(APPS).map((x) => `${x.id.padEnd(11)} ${x.description}`).join('\n') }),
  theme: ({ args }) => {
    const w = WALLPAPERS.find((x) => x.id === args[0])
    if (!w) return { err: `theme: choose one of ${WALLPAPERS.map((x) => x.id).join(', ')}`, code: 1 }
    useSettings.getState().set({ wallpaper: w.id })
  },
  notify: ({ args }) => { notify('Terminal', args.join(' ') || 'Hello from the terminal') },
  whoami: () => ({ out: useSettings.getState().username }),
  hostname: () => ({ out: 'orbit' }),
  date: () => ({ out: new Date().toString() }),
  uname: () => ({ out: 'ORBIT OS 1.0 (browser)' }),
  uptime: () => ({ out: `up ${Math.floor((Date.now() - bootTime) / 1000)}s` }),
  history: ({ args }) => {
    const store = useTerminalHistory.getState()
    if (args[0] === '-c') { store.clear(); return }
    return { out: store.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n') || undefined }
  },
  neofetch: ({ cwd }) => ({
    out: [
      `   ◯──◯    ${useSettings.getState().username}@orbit`,
      '  ╱    ╲   -------------',
      ' ◯  ORBIT ◯  OS: ORBIT OS 1.0',
      '  ╲    ╱   Shell: orbsh',
      `   ◯──◯    Dir: ${displayPath(cwd)}`,
    ].join('\n'),
  }),
}

function headTail(ctx: Ctx, cmd: 'head' | 'tail'): Out {
  const args = [...ctx.args]
  let count = 10
  const i = args.indexOf('-n')
  if (i >= 0) {
    count = Number(args[i + 1])
    if (!Number.isInteger(count) || count < 0) return { err: `${cmd}: invalid number of lines: '${args[i + 1] ?? ''}'`, code: 1 }
    args.splice(i, 2)
  }
  const { chunks, errors } = readInputs(cmd, args, ctx)
  const out: string[] = []
  chunks.forEach((c) => {
    const l = lines(c)
    out.push(...(cmd === 'head' ? l.slice(0, count) : count === 0 ? [] : l.slice(-count)))
  })
  return { out: out.join('\n') || undefined, err: errors.join('\n') || undefined, code: errors.length ? 1 : 0 }
}

export const COMMAND_NAMES = Object.keys(COMMANDS)
export const isCommand = (name: string) => name in COMMANDS

function expand(t: Token, cwd: string, code: number): string {
  let v = t.value
  if (!t.quoted && (v === '~' || v.startsWith('~/'))) v = HOME + v.slice(1)
  if (!t.literal) {
    const env: Record<string, string> = {
      HOME, PWD: cwd, USER: useSettings.getState().username, '?': String(code),
    }
    v = v.replace(/\$(\?|[A-Za-z_]\w*)/g, (_, k: string) => env[k] ?? '')
  }
  return v
}

export function run(input: string, startCwd: string, lastCode = 0): RunResult {
  const result: RunResult = { lines: [], cwd: startCwd, clear: false, exit: false, code: lastCode }
  const err = (text: string) => result.lines.push(...lines(text).map((t) => ({ kind: 'err' as const, text: t })))
  const out = (text: string) => result.lines.push(...(text === '' ? [''] : lines(text)).map((t) => ({ kind: 'out' as const, text: t })))

  const { tokens, error: tokError } = tokenize(input)
  if (tokError) { err(`orbsh: syntax error: ${tokError}`); result.code = 2; return result }
  const { chain, error } = parse(tokens)
  if (error) { err(`orbsh: ${error}`); result.code = 2; return result }

  let code = lastCode
  for (const item of chain) {
    if (item.conn === '&&' && code !== 0) continue
    if (item.conn === '||' && code === 0) continue

    let stdin: string | null = null
    item.pipeline.forEach((cmd, idx) => {
      const [nameTok, ...argToks] = cmd.args
      const name = expand(nameTok, result.cwd, code)
      const handler = COMMANDS[name]
      if (!handler) { err(`orbsh: command not found: ${name}`); code = 127; stdin = null; return }

      const res = handler({ args: argToks.map((a) => expand(a, result.cwd, code)), stdin, cwd: result.cwd }) ?? {}
      code = res.code ?? 0
      if (res.err) err(res.err)
      if (res.cwd && item.pipeline.length === 1) result.cwd = res.cwd
      if (res.clear) { result.clear = true; result.lines = [] }
      if (res.exit) result.exit = true

      const text = textOf(res)
      if (cmd.redirect) {
        const target = expand(cmd.redirect.target, result.cwd, code)
        const path = resolvePath(target, result.cwd)
        const prev = cmd.redirect.append ? (fs().read(path) ?? '') : ''
        const werr = fs().write(path, prev + text)
        if (werr) { err(`orbsh: ${target}: ${werr === 'Is a directory' ? werr : 'No such file or directory'}`); code = 1 }
        stdin = null
      } else if (idx < item.pipeline.length - 1) {
        stdin = text
      } else if (res.out !== undefined) {
        out(res.out)
      }
    })
  }
  result.code = code
  return result
}

