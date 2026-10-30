import { useState } from 'react'
import { Dialog } from '../../components/shared/Dialog'
import { Button, Switch } from '../../components/shared/controls'
import { uninstallApp } from '../installer'
import type { AppManifest } from '../types'

/** Confirmation for removing an app. Data is kept unless the user opts in to deleting it. */
export function UninstallDialog({ app, onClose }: { app: AppManifest; onClose: () => void }) {
  const [removeData, setRemoveData] = useState(false)

  return (
    <Dialog
      title={`Uninstall ${app.name}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            tone="danger"
            onClick={() => { uninstallApp(app.id, { removeData }); onClose() }}
          >
            Uninstall
          </Button>
        </>
      }
    >
      <p>
        {app.name} will be removed from the desktop and Start menu and its windows will close.
        Your files are not affected.
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-rule-soft pt-3">
        <span className="text-[12.5px]">Also delete this app’s saved data</span>
        <Switch label="Delete app data" checked={removeData} onChange={setRemoveData} />
      </div>
    </Dialog>
  )
}
