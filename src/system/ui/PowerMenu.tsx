import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { LogOut, Lock, Power, RotateCcw, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUi } from '../../store/uiStore'
import { lock, logout, restart, shutdown, switchUser } from '../systemStore'

interface Item { id: string; label: string; icon: LucideIcon; hint?: string; run: () => void; tone?: 'danger' }

/** `session` is the full menu for a signed-in user; `screen` is what the lock and login screens offer. */
function itemsFor(mode: 'session' | 'screen'): Item[] {
  const power: Item[] = [
    { id: 'restart', label: 'Restart THRENos', icon: RotateCcw, run: restart },
    { id: 'shutdown', label: 'Shut down THRENos', icon: Power, run: shutdown, tone: 'danger' },
  ]
  if (mode === 'screen') return power
  return [
    { id: 'lock', label: 'Lock', icon: Lock, hint: 'Alt+L', run: lock },
    { id: 'switch', label: 'Switch user', icon: Users, run: switchUser },
    { id: 'logout', label: 'Log out', icon: LogOut, run: logout },
    ...power,
  ]
}

/**
 * Lock, switch user, log out, restart and shut down. These act on THRENos in this browser tab only;
 * they never lock, restart or shut down the computer.
 */
export function PowerMenu({ mode, className = '' }: { mode: 'session' | 'screen'; className?: string }) {
  const open = useUi((s) => s.powerMenu)
  const setOpen = useUi((s) => s.setPowerMenu)
  const items = itemsFor(mode)
  const list = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (open) list.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [open])

  const close = () => { setOpen(false); trigger.current?.focus() }

  const onKey = (e: KeyboardEvent) => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); buttons[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); buttons[buttons.length - 1]?.focus() }
    else if (e.key === 'Tab') { e.preventDefault(); buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus() }
  }

  return (
    <div className={`relative ${className}`} onPointerDown={(e) => e.stopPropagation()}>
      <button
        ref={trigger}
        aria-label="Power menu"
        aria-haspopup="menu"
        aria-expanded={open}
        data-power-button
        title="Power"
        onClick={() => setOpen()}
        className={`ibtn grid size-9 place-items-center border border-ink ${open ? '!bg-ink !text-paper' : ''}`}
      >
        <Power size={15} strokeWidth={1.6} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[99500]" onPointerDown={() => setOpen(false)} />
          <div
            ref={list}
            role="menu"
            data-power-menu
            onKeyDown={onKey}
            className="panel absolute bottom-full right-0 z-[99600] mb-2 w-60 py-1"
          >
            {items.map((it) => (
              <button
                key={it.id}
                role="menuitem"
                data-power-item={it.id}
                onClick={() => { setOpen(false); it.run() }}
                className={`hover-invert flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] ${it.tone === 'danger' ? 'text-signal' : ''}`}
              >
                <it.icon size={14} strokeWidth={1.6} />
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="font-mono text-[10.5px] text-white/50">{it.hint}</span>}
              </button>
            ))}
            <div className="border-t border-rule-soft px-3.5 py-2 text-[10.5px] leading-snug text-white/55">
              Affects THRENos in this tab only, never your computer.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
