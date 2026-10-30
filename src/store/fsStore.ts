import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FsNode } from '../types'
import { HOME, baseName, normalize, parentOf } from '../utils/path'

type Tree = Record<string, FsNode>
export type FsEntry = FsNode & { name: string; path: string }

const folder = (): FsNode => ({ type: 'folder', mtime: Date.now() })
const file = (content: string): FsNode => ({ type: 'file', content, mtime: Date.now() })

const initialTree = (): Tree => ({
  '/': folder(),
  '/home': folder(),
  [HOME]: folder(),
  [`${HOME}/Documents`]: folder(),
  [`${HOME}/Downloads`]: folder(),
  [`${HOME}/Pictures`]: folder(),
  [`${HOME}/Music`]: folder(),
  [`${HOME}/Documents/README.txt`]: file('Welcome to THRENos.\n\nEverything here is simulated and saved in your browser.'),
  [`${HOME}/Documents/todo.md`]: file('# Todo\n- [x] Boot THRENos\n- [ ] Explore the terminal'),
  [`${HOME}/Pictures/readme.txt`]: file('Drop images here. (Imaginary ones.)'),
  '/etc': folder(),
  '/etc/hostname': file('threnos'),
  '/etc/os-release': file('NAME="THRENos"\nVERSION="1.0"'),
})

interface FsState {
  tree: Tree
  exists: (p: string) => boolean
  isDir: (p: string) => boolean
  list: (p: string) => FsEntry[]
  read: (p: string) => string | null
  write: (p: string, content: string) => string | null
  mkdir: (p: string) => string | null
  remove: (p: string) => string | null
  rename: (from: string, to: string) => string | null
  copy: (from: string, to: string) => string | null
  descendants: (p: string) => FsEntry[]
  stats: (p: string) => { size: number; files: number; folders: number }
  reset: () => void
}

export const useFs = create<FsState>()(
  persist(
    (set, get) => ({
      tree: initialTree(),
      exists: (p) => normalize(p) in get().tree,
      isDir: (p) => get().tree[normalize(p)]?.type === 'folder',
      list: (p) => {
        const dir = normalize(p)
        const prefix = dir === '/' ? '/' : dir + '/'
        return Object.entries(get().tree)
          .filter(([path]) => path !== dir && path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
          .map(([path, node]) => ({ ...node, path, name: baseName(path) }))
          .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
      },
      read: (p) => {
        const n = get().tree[normalize(p)]
        return n?.type === 'file' ? (n.content ?? '') : null
      },
      write: (p, content) => {
        const path = normalize(p)
        if (get().tree[parentOf(path)]?.type !== 'folder') return 'No such directory'
        if (get().tree[path]?.type === 'folder') return 'Is a directory'
        set((s) => ({ tree: { ...s.tree, [path]: { type: 'file', content, mtime: Date.now() } } }))
        return null
      },
      mkdir: (p) => {
        const path = normalize(p)
        if (path in get().tree) return 'Already exists'
        if (get().tree[parentOf(path)]?.type !== 'folder') return 'No such directory'
        set((s) => ({ tree: { ...s.tree, [path]: { type: 'folder', mtime: Date.now() } } }))
        return null
      },
      remove: (p) => {
        const path = normalize(p)
        if (path === '/' || !(path in get().tree)) return 'No such file or directory'
        set((s) => ({
          tree: Object.fromEntries(
            Object.entries(s.tree).filter(([k]) => k !== path && !k.startsWith(path + '/')),
          ),
        }))
        return null
      },
      rename: (from, to) => {
        const a = normalize(from)
        const b = normalize(to)
        const { tree } = get()
        if (!(a in tree) || a === '/') return 'No such file or directory'
        if (b in tree) return 'Destination exists'
        if (tree[parentOf(b)]?.type !== 'folder') return 'No such directory'
        if (b.startsWith(a + '/')) return 'Cannot move into itself'
        set((s) => ({
          tree: Object.fromEntries(
            Object.entries(s.tree).map(([k, v]) =>
              k === a ? [b, v] : k.startsWith(a + '/') ? [b + k.slice(a.length), v] : [k, v],
            ),
          ),
        }))
        return null
      },
      copy: (from, to) => {
        const a = normalize(from)
        const b = normalize(to)
        const { tree } = get()
        if (!(a in tree)) return 'No such file or directory'
        if (b in tree) return 'Destination exists'
        if (tree[parentOf(b)]?.type !== 'folder') return 'No such directory'
        if (b === a || b.startsWith(a + '/')) return 'Cannot copy into itself'
        const now = Date.now()
        const copies = Object.entries(tree)
          .filter(([k]) => k === a || k.startsWith(a + '/'))
          .map(([k, v]) => [b + k.slice(a.length), { ...v, mtime: now }] as const)
        set((s) => ({ tree: { ...s.tree, ...Object.fromEntries(copies) } }))
        return null
      },
      descendants: (p) => {
        const dir = normalize(p)
        const prefix = dir === '/' ? '/' : dir + '/'
        return Object.entries(get().tree)
          .filter(([path]) => path !== dir && path.startsWith(prefix))
          .map(([path, node]) => ({ ...node, path, name: baseName(path) }))
      },
      stats: (p) => {
        const path = normalize(p)
        const prefix = path + '/'
        let size = 0, files = 0, folders = 0
        for (const [k, v] of Object.entries(get().tree)) {
          if (k !== path && !k.startsWith(prefix)) continue
          if (k === path && v.type === 'folder') continue
          if (v.type === 'folder') folders++
          else { files++; size += (v.content ?? '').length }
        }
        return { size, files, folders }
      },
      reset: () => set({ tree: initialTree() }),
    }),
    { name: 'threnos-fs', partialize: (s) => ({ tree: s.tree }) },
  ),
)
