import { File, Folder } from 'lucide-react'
import { Dialog } from '../../components/shared/Dialog'
import { useFs } from '../../store/fsStore'
import { baseName, displayPath, parentOf } from '../../utils/path'
import { formatDate, formatSize, kindOf } from '../../utils/files'

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 border-b border-rule-soft py-1.5 text-[12px]">
    <span className="text-white/60">{label}</span>
    <span className="selectable min-w-0 break-all text-right">{value}</span>
  </div>
)

export function PropertiesDialog({ paths, onClose }: { paths: string[]; onClose: () => void }) {
  const tree = useFs((s) => s.tree)
  const stats = useFs.getState().stats
  const nodes = paths.filter((p) => p in tree)
  const close = (
    <button onClick={onClose} className="accent-bg px-4 py-1.5 text-[12px] font-medium">OK</button>
  )

  if (nodes.length === 0) return <Dialog title="Properties" onClose={onClose} actions={close}>Item no longer exists.</Dialog>

  if (nodes.length > 1) {
    const total = nodes.reduce(
      (a, p) => {
        const s = stats(p)
        return { size: a.size + s.size, files: a.files + s.files, folders: a.folders + s.folders + (tree[p].type === 'folder' ? 1 : 0) }
      },
      { size: 0, files: 0, folders: 0 },
    )
    return (
      <Dialog title="Properties" onClose={onClose} actions={close}>
        <Row label="Selection" value={`${nodes.length} items`} />
        <Row label="Contains" value={`${total.files} files, ${total.folders} folders`} />
        <Row label="Total size" value={formatSize(total.size)} />
      </Dialog>
    )
  }

  const path = nodes[0]
  const node = tree[path]
  const s = stats(path)
  const name = baseName(path)

  return (
    <Dialog title="Properties" onClose={onClose} actions={close}>
      <div className="mb-3 flex items-center gap-3">
        {node.type === 'folder'
          ? <Folder size={34} strokeWidth={1.25} fill="currentColor" fillOpacity={0.12} />
          : <File size={34} strokeWidth={1.25} />}
        <div className="selectable min-w-0 break-all text-base font-medium">{path === '/' ? '/' : name}</div>
      </div>
      <Row label="Type" value={kindOf(name, node.type)} />
      <Row label="Location" value={displayPath(path === '/' ? '/' : parentOf(path))} />
      <Row label="Size" value={node.type === 'folder' ? formatSize(s.size) : formatSize((node.content ?? '').length)} />
      {node.type === 'folder' && <Row label="Contains" value={`${s.files} files, ${s.folders} folders`} />}
      <Row label="Modified" value={formatDate(node.mtime)} />
    </Dialog>
  )
}
