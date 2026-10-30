import { motion } from 'motion/react'
import { completeSetup } from '../systemStore'
import { BrandMark } from '../ui/BrandMark'
import { ProfileForm } from '../ui/ProfileForm'

/** First run: create the first profile. */
export function SetupScreen() {
  return (
    <motion.div
      data-setup-screen
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-[99000] grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] overflow-auto bg-paper max-md:grid-cols-1"
    >
      <div className="flex flex-col justify-between border-r border-ink px-14 py-12 max-md:border-b max-md:border-r-0 max-md:px-6 max-md:py-8">
        <BrandMark size={30} />
        <div className="py-10">
          <div className="kicker mb-4">Welcome</div>
          <h1 className="text-[76px] font-bold leading-[0.85] tracking-[-0.065em] max-md:text-[48px]">
            Let’s set up<br />your profile<span className="text-[var(--accent)]">.</span>
          </h1>
          <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-white/70">
            A profile keeps your files, notes, wallpaper and settings together. Everything stays in this browser.
          </p>
        </div>
        <div className="font-mono text-[11px] text-white/55">THRENos 1.0</div>
      </div>
      <div className="flex items-center px-14 py-12 max-md:px-6 max-md:py-8">
        <div className="w-full max-w-lg">
          <ProfileForm
            submitLabel="Create profile and continue"
            autoFocus
            onSubmit={async (profile) => {
              const result = await completeSetup(profile)
              return result.ok ? null : result.error
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
