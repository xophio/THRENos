import { useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { useWindows } from '../../store/windowStore'
import { useWorkArea } from '../../utils/screen'
import { Window } from './Window'

export function WindowManager() {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows((s) => s.focusedId)
  const refit = useWindows((s) => s.refit)
  const area = useWorkArea()

  // Screen size, scaling and taskbar placement all change the work area.
  useEffect(() => { refit() }, [refit, area.x, area.y, area.w, area.h])

  return (
    <AnimatePresence>
      {windows.map((w) => (
        <Window key={w.id} win={w} focused={w.id === focusedId} />
      ))}
    </AnimatePresence>
  )
}
