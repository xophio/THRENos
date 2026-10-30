import { Switch } from '../../components/shared/controls'
import { useInstallStore } from '../installStore'
import { PERMISSION_LABELS } from '../types'
import type { AppManifest } from '../types'

/** Lists what an app asks for. With `editable`, each permission can be revoked and granted again. */
export function PermissionList({ app, editable }: { app: AppManifest; editable?: boolean }) {
  const grants = useInstallStore((s) => s.grants[app.id])
  const setGrant = useInstallStore((s) => s.setGrant)

  if (app.permissions.length === 0) return <p className="text-[12.5px] text-white/60">This app requests no permissions.</p>

  return (
    <div>
      {app.permissions.map((p) => {
        const granted = grants?.[p] !== false
        const { label, hint } = PERMISSION_LABELS[p]
        return (
          <div key={p} data-permission={p} className="flex items-center justify-between gap-4 border-b border-rule-soft py-2.5">
            <div>
              <div className="text-[13px] font-medium">{label}</div>
              <div className="text-[12px] text-white/60">{hint}</div>
            </div>
            {editable
              ? <Switch label={`${label} permission`} checked={granted} onChange={(v) => setGrant(app.id, p, v)} />
              : <span className="kicker">{granted ? 'Allowed' : 'Blocked'}</span>}
          </div>
        )
      })}
    </div>
  )
}
