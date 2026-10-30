import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, KeyRound, Plus, Users } from 'lucide-react'
import { Dialog } from '../../components/shared/Dialog'
import { Button } from '../../components/shared/controls'
import { useClock } from '../../hooks/useClock'
import { useLockWallpaperStyle } from '../../hooks/useWallpaper'
import { useNotifications } from '../../store/notificationStore'
import { useSettings } from '../../store/settingsStore'
import { useWindows } from '../../store/windowStore'
import { useWorkspaces } from '../../store/workspaceStore'
import { checkSecret, createProfile, lockoutSeconds } from '../auth'
import { MAX_PROFILES, useAuth } from '../authStore'
import type { Profile } from '../authStore'
import { eraseProfileAndLeave, signIn, switchUser, unlock, useSystem } from '../systemStore'
import { Avatar } from '../ui/Avatar'
import { BrandMark } from '../ui/BrandMark'
import { PowerMenu } from '../ui/PowerMenu'
import { LockNotice, ProfileForm } from '../ui/ProfileForm'
import { SecretField } from '../ui/SecretField'

type Mode = 'lock' | 'login'
type View = 'pick' | 'auth' | 'new'

const credentialLabel = (p: Profile) => (p.credential ? (p.credential.kind === 'pin' ? 'PIN' : 'Password') : 'No sign-in')

/** Large time and date. */
function Clock() {
  const now = useClock()
  const h24 = useSettings((s) => s.clock24h)
  const parts = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', hour12: !h24 }).formatToParts(now)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? ''
  const minute = parts.find((p) => p.type === 'minute')?.value ?? ''
  const period = parts.find((p) => p.type === 'dayPeriod')?.value
  return (
    <div data-lock-clock>
      <div className="flex items-start gap-3">
        <div className="text-[148px] font-bold leading-[0.8] tracking-[-0.08em] tabular-nums max-sm:text-[96px]">
          {hour}<span className="text-[var(--accent)]">:</span>{minute}
        </div>
        {period && <span className="kicker !text-ink mt-3">{period}</span>}
      </div>
      <div className="mt-6 text-[22px] font-semibold tracking-[-0.025em]">{now.toLocaleDateString([], { weekday: 'long' })}</div>
      <div className="text-[14px] text-white/65">{now.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  )
}

/** Real information about the locked session: what is open and what arrived while away. */
function Status({ since }: { since: Date }) {
  const windows = useWindows((s) => s.windows.length)
  const workspaces = useWorkspaces((s) => s.workspaces.length)
  const notifications = useNotifications((s) => s.history.length)
  const rows: [string, string][] = [
    ['Open windows', String(windows)],
    ['Workspaces', String(workspaces)],
    ['Notifications', String(notifications)],
    ['Locked at', since.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })],
  ]
  return (
    <dl data-lock-status className="grid grid-cols-2 gap-x-6 text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-t border-rule-soft py-1.5">
          <dt className="text-white/60">{k}</dt>
          <dd className="font-mono">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Credentials entry for one profile. */
function AuthPanel({ profile, mode, onBack }: { profile: Profile; mode: Mode; onBack?: () => void }) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(() => lockoutSeconds(profile.id))
  const [forgot, setForgot] = useState(false)
  const [typed, setTyped] = useState('')
  const profileCount = useAuth((s) => s.profiles.length)
  const protectedProfile = !!profile.credential
  const kind = profile.credential?.kind ?? 'pin'

  // Count down a throttle that survived a refresh or was just triggered.
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(lockoutSeconds(profile.id)), 1000)
    return () => clearTimeout(t)
  }, [wait, profile.id])

  const proceed = async () => {
    if (mode === 'lock') unlock()
    else await signIn(profile.id)
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy || wait > 0) return
    setBusy(true)
    const result = await checkSecret(profile.id, secret)
    setBusy(false)
    if (result.ok) return proceed()
    setError(result.error)
    setSecret('')
    setWait(lockoutSeconds(profile.id))
  }

  return (
    <div data-auth-panel={profile.id}>
      <div className="flex items-center gap-4">
        <Avatar id={profile.avatar} size={72} />
        <div className="min-w-0">
          <div data-lock-user className="truncate text-[28px] font-bold leading-none tracking-[-0.04em]">{profile.name}</div>
          <div className="kicker mt-2">{mode === 'lock' ? 'Locked' : 'Signed out'} · {credentialLabel(profile)}</div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6" noValidate>
        {protectedProfile ? (
          <>
            <SecretField
              label={kind === 'pin' ? 'PIN' : 'Password'}
              kind={kind}
              value={secret}
              onChange={(v) => { setSecret(v); setError(null) }}
              autoFocus
              disabled={wait > 0}
              invalid={!!error}
              name="unlock-secret"
            />
            <div className="mt-3 flex items-center gap-3">
              <button type="submit" disabled={busy || wait > 0} data-action="unlock" className="accent-bg px-5 py-2.5 text-[13px] font-semibold disabled:opacity-50">
                {mode === 'lock' ? 'Unlock' : 'Sign in'}
              </button>
              <button type="button" data-action="forgot" onClick={() => setForgot(true)} className="flex items-center gap-1.5 text-[12px] font-medium text-white/70 underline-offset-2 hover:text-[var(--accent)] hover:underline">
                <KeyRound size={12} /> Forgot {kind === 'pin' ? 'PIN' : 'password'}?
              </button>
            </div>
            <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-[12.5px] font-medium text-signal" data-auth-error>
              {wait > 0 && !error?.includes('Try again') ? `Too many attempts. Try again in ${wait} second${wait === 1 ? '' : 's'}.` : error}
            </div>
          </>
        ) : (
          <button type="submit" autoFocus data-action="unlock" className="accent-bg px-6 py-3 text-[13px] font-semibold">
            {mode === 'lock' ? 'Unlock' : 'Sign in'}
          </button>
        )}
      </form>

      <div className="mt-6 flex gap-5 text-[12px] font-medium">
        {mode === 'lock' && (
          <button data-action="switch-user" onClick={switchUser} className="flex items-center gap-1.5 text-white/70 hover:text-[var(--accent)]">
            <Users size={13} /> Switch user
          </button>
        )}
        {onBack && profileCount > 1 && (
          <button data-action="back" onClick={onBack} className="text-white/70 hover:text-[var(--accent)]">← All profiles</button>
        )}
      </div>

      <AnimatePresence>
        {forgot && (
          <Dialog
            key="forgot"
            title={`Forgot ${kind === 'pin' ? 'PIN' : 'password'}`}
            onClose={() => { setForgot(false); setTyped('') }}
            actions={
              <>
                <Button onClick={() => { setForgot(false); setTyped('') }}>Cancel</Button>
                <Button
                  tone="danger"
                  disabled={typed.trim() !== profile.name}
                  onClick={() => eraseProfileAndLeave(profile.id)}
                >
                  Erase profile
                </Button>
              </>
            }
          >
            <p>
              THRENos does not keep a readable copy of your {kind === 'pin' ? 'PIN' : 'password'} and has no server to reset it, so it cannot be recovered.
            </p>
            <p className="mt-2">
              The only way back in is to <b>erase “{profile.name}”</b>: its files, notes, settings and app data are deleted for good.
              Other profiles are not affected.
            </p>
            <label className="kicker mb-1.5 mt-4 block" htmlFor="erase-confirm">Type the profile name to confirm</label>
            <input
              id="erase-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="field w-full px-3 py-2 text-[14px]"
            />
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Choose who to sign in as. */
function ProfilePicker({ onPick, onNew }: { onPick: (p: Profile) => void; onNew: () => void }) {
  const profiles = useAuth((s) => s.profiles)
  return (
    <div data-profile-picker>
      <div className="kicker mb-3">Who’s using THRENos?</div>
      <div className="border-t border-ink">
        {profiles.map((p, i) => (
          <button
            key={p.id}
            data-profile={p.id}
            onClick={() => onPick(p)}
            className="group flex w-full items-center gap-4 border-b border-rule-soft px-1 py-3 text-left transition-colors hover:bg-white/[0.05]"
          >
            <span className="w-5 font-mono text-[10px] text-white/50">{String(i + 1).padStart(2, '0')}</span>
            <Avatar id={p.avatar} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-bold tracking-[-0.025em]">{p.name}</span>
              <span className="block text-[11.5px] text-white/60">{credentialLabel(p)}</span>
            </span>
            <ChevronRight size={16} className="text-white/50 group-hover:text-[var(--accent)]" />
          </button>
        ))}
      </div>
      {profiles.length < MAX_PROFILES && (
        <button data-action="new-profile" onClick={onNew} className="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/75 hover:text-[var(--accent)]">
          <Plus size={13} /> New profile
        </button>
      )}
    </div>
  )
}

/** The lock screen (one signed-in user) and the login screen (everyone). They share one layout. */
export function LockScreen({ mode }: { mode: Mode }) {
  const profiles = useAuth((s) => s.profiles)
  const activeId = useSystem((s) => s.profileId)
  const selectedId = useSystem((s) => s.selectedId)
  const select = useSystem((s) => s.select)
  const showStatus = useSettings((s) => s.lockStatus)
  const wallpaper = useLockWallpaperStyle()
  const since = useRef(new Date())

  const targetId = mode === 'lock' ? activeId : selectedId
  const profile = profiles.find((p) => p.id === targetId) ?? profiles[0]
  const [view, setView] = useState<View>(mode === 'lock' || profiles.length <= 1 ? 'auth' : 'pick')

  // Typing anywhere starts entering the PIN or password.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'new' || (view === 'auth' && mode === 'login' && profiles.length > 1)) setView('pick')
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || view !== 'auth') return
      const input = document.querySelector<HTMLInputElement>('[data-lock-screen] input[name="unlock-secret"]')
      if (input && document.activeElement !== input) input.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, mode, profiles.length])

  if (!profile && view !== 'new') return null

  const pick = async (p: Profile) => {
    select(p.id)
    if (p.credential) setView('auth')
    else await signIn(p.id)
  }

  return (
    <motion.div
      data-lock-screen
      data-mode={mode}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-[99000] flex"
      style={wallpaper}
    >
      <section className="flex w-[540px] shrink-0 flex-col justify-between overflow-auto border-r border-ink bg-paper px-12 py-10 max-md:w-full max-md:border-r-0 max-md:px-6 max-md:py-6">
        <div className="flex items-center justify-between">
          <BrandMark size={26} />
          <span className="kicker">{mode === 'lock' ? 'Locked' : 'Sign in'}</span>
        </div>

        <div className="my-8 space-y-10">
          <Clock />
          {view === 'pick' && <ProfilePicker onPick={pick} onNew={() => setView('new')} />}
          {view === 'auth' && profile && (
            <AuthPanel key={profile.id} profile={profile} mode={mode} onBack={mode === 'login' ? () => setView('pick') : undefined} />
          )}
          {view === 'new' && (
            <div>
              <div className="kicker mb-3">New profile</div>
              <ProfileForm
                submitLabel="Create and sign in"
                autoFocus
                onCancel={() => setView(profiles.length ? 'pick' : 'auth')}
                onSubmit={async (input) => {
                  const result = await createProfile(input)
                  if (!result.ok) return result.error
                  await signIn(result.id!)
                  return null
                }}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {mode === 'lock' && showStatus && <Status since={since.current} />}
          {view !== 'new' && mode === 'login' && <LockNotice />}
          <div className="flex items-end justify-between">
            <span className="font-mono text-[10.5px] text-white/50">THRENos 1.0 · Alt+L locks</span>
            <PowerMenu mode="screen" />
          </div>
        </div>
      </section>
      <div className="flex-1 max-md:hidden" />
    </motion.div>
  )
}
