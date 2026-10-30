import { joinPath } from './path'

export const formatSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

export const formatDate = (t: number) =>
  new Date(t).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function kindOf(name: string, type: 'file' | 'folder'): string {
  if (type === 'folder') return 'Folder'
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return ext ? `${ext.toUpperCase()} file` : 'File'
}

/** "report.txt" -> "report copy.txt" -> "report copy 2.txt" when the name is taken. */
export function uniqueName(exists: (path: string) => boolean, dir: string, name: string, suffix = ' copy'): string {
  if (!exists(joinPath(dir, name))) return name
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  let candidate = `${stem}${suffix}${ext}`
  for (let i = 2; exists(joinPath(dir, candidate)); i++) candidate = `${stem}${suffix} ${i}${ext}`
  return candidate
}
