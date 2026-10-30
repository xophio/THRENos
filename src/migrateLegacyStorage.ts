/**
 * One-time upgrade from the ORBIT OS storage layout.
 *
 * THRENos was previously called ORBIT OS and saved its data under `orbit-*` keys with a
 * `/home/orbit` home folder. This copies that data to the new keys (renaming paths and the
 * default names it seeded) and removes the old ones. It must run before any store is created,
 * so `main.tsx` imports it first.
 */

const OLD = 'orbit-'
const NEW = 'threnos-'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Text the old version wrote into fresh installs. User-edited versions are left alone. */
const SEEDED_FILES: Record<string, [from: string, to: string]> = {
  '/etc/hostname': ['orbit', 'threnos'],
  '/etc/os-release': ['NAME="ORBIT OS"\nVERSION="1.0"', 'NAME="THRENos"\nVERSION="1.0"'],
  '/home/threnos/Documents/README.txt': [
    'Welcome to ORBIT OS.\n\nEverything here is simulated and saved in your browser.',
    'Welcome to THRENos.\n\nEverything here is simulated and saved in your browser.',
  ],
  '/home/threnos/Documents/todo.md': ['# Todo\n- [x] Boot ORBIT OS\n- [ ] Explore the terminal', '# Todo\n- [x] Boot THRENos\n- [ ] Explore the terminal'],
}

function migrateFs(raw: string): string {
  const data = JSON.parse(raw)
  const tree = data?.state?.tree
  if (!isObject(tree)) return raw
  const next: Record<string, unknown> = {}
  for (const [path, node] of Object.entries(tree)) {
    const renamed = path.replace(/^\/home\/orbit(?=\/|$)/, '/home/threnos')
    const seeded = SEEDED_FILES[renamed]
    if (seeded && isObject(node) && node.content === seeded[0]) next[renamed] = { ...node, content: seeded[1] }
    else next[renamed] = node
  }
  data.state.tree = next
  return JSON.stringify(data)
}

function migrateSettings(raw: string): string {
  const data = JSON.parse(raw)
  const state = data?.state
  if (!isObject(state)) return raw
  if (state.username === 'orbit') state.username = 'threnos'
  if (state.deviceName === 'ORBIT-PC') state.deviceName = 'THRENOS-PC'
  return JSON.stringify(data)
}

function migrateNotes(raw: string): string {
  const data = JSON.parse(raw)
  const notes = data?.state?.notes
  if (!Array.isArray(notes)) return raw
  for (const n of notes) if (isObject(n) && n.title === 'Welcome to ORBIT') n.title = 'Welcome to THRENos'
  return JSON.stringify(data)
}

function transform(key: string, raw: string): string {
  try {
    if (key === 'fs') return migrateFs(raw)
    if (key === 'settings') return migrateSettings(raw)
    if (key === 'notes') return migrateNotes(raw)
  } catch {
    // Damaged data is carried over untouched; the stores already tolerate it.
  }
  // Everything else (window layouts, terminal history) may mention the old home folder.
  return raw.split('/home/orbit').join('/home/threnos')
}

try {
  const oldKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(OLD)) oldKeys.push(key)
  }
  for (const key of oldKeys) {
    const suffix = key.slice(OLD.length)
    const target = NEW + suffix
    const value = localStorage.getItem(key)
    if (value !== null && localStorage.getItem(target) === null) localStorage.setItem(target, transform(suffix, value))
    localStorage.removeItem(key)
  }
} catch {
  // Storage unavailable (private mode, quota): nothing to migrate.
}

export {}
