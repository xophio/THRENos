import type { FsNode, Note } from '../types'
import { HOME } from './path'

export const DISK_CAPACITY = 32 * 1024 * 1024
/** Simulated footprint of the operating system itself. */
export const SYSTEM_BYTES = 3.2 * 1024 * 1024

const encoder = new TextEncoder()
const byteLength = (s: string) => encoder.encode(s).length

export interface StorageBreakdown {
  system: number
  documents: number
  pictures: number
  music: number
  downloads: number
  other: number
  notes: number
  /** Everything counted above. */
  used: number
}

/** Measures simulated disk usage from the real filesystem tree and saved notes. */
export function measureStorage(tree: Record<string, FsNode>, notes: Note[]): StorageBreakdown {
  const sizes = { documents: 0, pictures: 0, music: 0, downloads: 0, other: 0 }
  for (const [path, node] of Object.entries(tree)) {
    if (node.type !== 'file') continue
    const size = byteLength(node.content ?? '')
    const bucket = (['Documents', 'Pictures', 'Music', 'Downloads'] as const).find((d) => path.startsWith(`${HOME}/${d}/`))
    if (bucket) sizes[bucket.toLowerCase() as 'documents' | 'pictures' | 'music' | 'downloads'] += size
    else sizes.other += size
  }
  const notesBytes = notes.reduce((sum, n) => sum + byteLength(n.title) + byteLength(n.body), 0)
  const used = SYSTEM_BYTES + notesBytes + Object.values(sizes).reduce((a, b) => a + b, 0)
  return { system: SYSTEM_BYTES, ...sizes, notes: notesBytes, used }
}

/** Approximate bytes this origin keeps in localStorage (UTF-16, as browsers count it). */
export function localStorageBytes(): number {
  try {
    let chars = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!
      chars += key.length + (localStorage.getItem(key)?.length ?? 0)
    }
    return chars * 2
  } catch {
    return 0
  }
}
