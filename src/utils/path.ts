export const HOME = '/home/threnos'

export function normalize(path: string, cwd = '/'): string {
  const raw = path.startsWith('/') ? path : `${cwd}/${path}`
  const parts: string[] = []
  for (const seg of raw.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

export const parentOf = (path: string) => normalize(path + '/..')
export const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? '/'
export const joinPath = (dir: string, name: string) => normalize(name, dir)

export function displayPath(path: string): string {
  return path === HOME ? '~' : path.startsWith(HOME + '/') ? '~' + path.slice(HOME.length) : path
}
