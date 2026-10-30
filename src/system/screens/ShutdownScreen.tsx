import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useStartup } from '../../store/startupStore'
import { powerOn } from '../systemStore'
import { LogoMark } from '../ui/BrandMark'

const STEPS = ['Closing windows', 'Saving preferences', 'Ending sessions']
const STEP_MS = 320

/** The shut-down screen. THRENos has stopped in this tab; the computer itself is untouched. */
export function ShutdownScreen() {
  const animated = useStartup((s) => s.animation)
  const [done, setDone] = useState(animated ? 0 : STEPS.length)
  const button = useRef<HTMLButtonElement>(null)
  const off = done >= STEPS.length

  useEffect(() => {
    if (off) return
    const t = setTimeout(() => setDone((n) => n + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [done, off])

  useEffect(() => { if (off) button.current?.focus() }, [off])

  return (
    <motion.div
      data-shutdown-screen
      data-off={off}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="dark-scope absolute inset-0 z-[99000] flex flex-col px-16 py-12 max-sm:px-6 max-sm:py-8"
    >
      <div className="flex items-baseline justify-between">
        <span className="kicker !text-ink">THRENos</span>
        <span className="kicker">{off ? 'Shut down' : 'Shutting down'}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        {!off ? (
          <ul data-shutdown-steps className="space-y-1.5 font-mono text-[13px]">
            {STEPS.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 ${i <= done ? 'opacity-100' : 'opacity-0'}`}>
                <span className={`size-1.5 ${i < done ? 'bg-[var(--accent)]' : 'bg-white/30'}`} />
                {s}{i < done ? '' : '…'}
              </li>
            ))}
          </ul>
        ) : (
          <div className="max-w-xl">
            <LogoMark size={56} />
            <h1 className="mt-8 text-[88px] font-bold leading-[0.85] tracking-[-0.065em] max-sm:text-[56px]">Shut down.</h1>
            <p className="mt-6 max-w-md text-[14px] leading-relaxed text-white/70">
              THRENos has stopped in this browser tab. Your computer is still on and nothing outside this tab was changed.
              You can close the tab, or start THRENos again.
            </p>
            <button
              ref={button}
              data-action="power-on"
              onClick={powerOn}
              className="accent-bg mt-8 px-6 py-3 text-[13px] font-semibold"
            >
              Start THRENos
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
