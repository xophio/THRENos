import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { listApps } from '../../os/registry'
import { useStartup } from '../../store/startupStore'
import { useAuth } from '../authStore'
import { finishBoot, useSystem } from '../systemStore'
import { LogoMark } from '../ui/BrandMark'

interface Step { label: string; detail: () => string }

// Every line reports something that really happens when THRENos starts: it reads no hardware and runs no system commands.
const STEPS: Step[] = [
  { label: 'Starting THRENos', detail: () => 'version 1.0' },
  { label: 'Loading settings', detail: () => 'done' },
  { label: 'Reading profiles', detail: () => { const n = useAuth.getState().profiles.length; return n ? `${n} ${n === 1 ? 'profile' : 'profiles'}` : 'none yet' } },
  { label: 'Registering apps', detail: () => `${listApps().length} apps` },
  { label: 'Preparing the desktop', detail: () => 'ready' },
]

const STEP_MS = 360
const SETTLE_MS = 380
const QUICK_MS = 280

/** The startup screen. With the animation off it is a brief static screen instead of a timed sequence. */
export function BootScreen() {
  const animated = useStartup((s) => s.animation)
  const showMessages = useStartup((s) => s.messages)
  const reason = useSystem((s) => s.bootReason)
  const [done, setDone] = useState(animated ? 0 : STEPS.length)
  const finished = useRef(false)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    void finishBoot()
  }

  useEffect(() => {
    if (!animated) {
      const t = setTimeout(finish, QUICK_MS)
      return () => clearTimeout(t)
    }
    if (done < STEPS.length) {
      const t = setTimeout(() => setDone((n) => n + 1), STEP_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(finish, SETTLE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, done])

  // Any key or click skips the wait once the sequence is running.
  useEffect(() => {
    if (!animated) return
    const skip = () => { setDone(STEPS.length); finish() }
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated])

  const progress = done / STEPS.length

  return (
    <motion.div
      data-boot-screen
      data-animated={animated}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={() => { if (animated) { setDone(STEPS.length); finish() } }}
      className="absolute inset-0 z-[99000] flex flex-col bg-paper px-16 py-12 max-sm:px-6 max-sm:py-8"
    >
      <div className="flex items-baseline justify-between">
        <span className="kicker !text-ink">THRENos</span>
        <span className="kicker">{reason === 'restart' ? 'Restarting' : 'Starting up'}</span>
      </div>

      <div className="flex flex-1 items-center">
        <div className="flex items-end gap-8 max-sm:flex-col max-sm:items-start max-sm:gap-4">
          <motion.div
            initial={animated ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="origin-bottom-left"
          >
            <LogoMark size={132} />
          </motion.div>
          <motion.h1
            initial={animated ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: animated ? 0.15 : 0, ease: 'easeOut' }}
            className="text-[104px] font-bold leading-[0.8] tracking-[-0.07em] max-sm:text-[64px]"
          >
            THRENos<span className="text-[var(--accent)]">.</span>
          </motion.h1>
        </div>
      </div>

      <div>
        {showMessages && (
          <ul data-boot-messages className="mb-5 space-y-1 font-mono text-[12px]">
            {STEPS.map((step, i) => (
              <li
                key={step.label}
                data-step-done={i < done}
                className={`flex items-center gap-3 transition-opacity duration-200 ${i < done ? 'opacity-100' : i === done && animated ? 'opacity-90' : 'opacity-0'}`}
              >
                <span className={`size-1.5 ${i < done ? 'bg-[var(--accent)]' : 'bg-white/30'}`} />
                <span className="w-56">{step.label}</span>
                <span className="text-white/60">{i < done ? step.detail() : animated && i === done ? '…' : ''}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-4">
          <div
            className="relative h-[3px] flex-1 bg-rule-soft"
            role="progressbar"
            aria-label="Starting THRENos"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] duration-300 ease-out" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="w-10 text-right font-mono text-[11px] tabular-nums text-white/65">{Math.round(progress * 100)}%</span>
        </div>
        {animated && <div className="mt-4 text-right text-[10.5px] uppercase tracking-[0.14em] text-white/45">Press any key to skip</div>}
      </div>
    </motion.div>
  )
}
