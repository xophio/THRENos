import { useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import { Plus, Users } from 'lucide-react'
import { Button, Section, Segmented, SettingRow } from '../../components/shared/controls'
import { Dialog } from '../../components/shared/Dialog'
import { notify } from '../../store/notificationStore'
import { changeSecret, checkSecret, createProfile, removeSecret, renameProfile, setAvatar } from '../../system/auth'
import { MAX_PROFILES, MAX_PROFILE_NAME, useAuth } from '../../system/authStore'
import type { Profile } from '../../system/authStore'
import type { CredentialKind } from '../../system/credentials'
import { eraseProfileAndLeave, switchUser, useSystem } from '../../system/systemStore'
import { Avatar, AvatarPicker } from '../../system/ui/Avatar'
import { LockNotice, ProfileForm } from '../../system/ui/ProfileForm'
import { SecretField } from '../../system/ui/SecretField'

const kindName = (k: CredentialKind) => (k === 'pin' ? 'PIN' : 'password')

function NameField({ profile }: { profile: Profile }) {
  const [error, setError] = useState<string | null>(null)
  const commit = (value: string) => {
    if (value.trim() === profile.name) return setError(null)
    const result = renameProfile(profile.id, value)
    setError(result.ok ? null : result.error)
  }
  return (
    <div>
      <input
        aria-label="Profile name"
        key={profile.name}
        defaultValue={profile.name}
        maxLength={MAX_PROFILE_NAME}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="field w-56 px-3 py-1.5 text-[13px]"
      />
      {error && <div role="alert" data-name-error className="mt-1 text-[11.5px] text-signal">{error}</div>}
    </div>
  )
}

/** Set, change or remove the PIN or password. Changing or removing needs the current one. */
function SignInSection({ profile }: { profile: Profile }) {
  const has = !!profile.credential
  const [kind, setKind] = useState<CredentialKind>(profile.credential?.kind ?? 'pin')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => { setCurrent(''); setNext(''); setRepeat('') }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (next !== repeat) return setMessage({ ok: false, text: `The two ${kindName(kind)}s do not match.` })
    setBusy(true)
    const result = await changeSecret(profile.id, kind, next, current)
    setBusy(false)
    if (result.ok) { reset(); setMessage({ ok: true, text: has ? `${kindName(kind)} changed.` : `${kindName(kind)} set.` }) }
    else setMessage({ ok: false, text: result.error })
  }

  const turnOff = async () => {
    if (busy) return
    setBusy(true)
    const result = await removeSecret(profile.id, current)
    setBusy(false)
    if (result.ok) { reset(); setMessage({ ok: true, text: 'Sign-in protection turned off.' }) }
    else setMessage({ ok: false, text: result.error })
  }

  return (
    <Section title="Sign-in">
      <SettingRow label="Protection" hint={has ? `Locked with a ${kindName(profile.credential!.kind)}.` : 'Anyone can unlock this profile.'}>
        <span data-signin-state className="kicker !text-ink">{has ? kindName(profile.credential!.kind) : 'Off'}</span>
      </SettingRow>
      <form onSubmit={save} className="space-y-3 py-4" noValidate data-signin-form>
        <Segmented
          label="Credential type"
          value={kind}
          options={[{ value: 'pin', label: 'PIN' }, { value: 'password', label: 'Password' }]}
          onChange={(k) => { setKind(k); reset(); setMessage(null) }}
        />
        {has && <SecretField label={`Current ${kindName(profile.credential!.kind)}`} kind={profile.credential!.kind} value={current} onChange={setCurrent} name="current-secret" />}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <SecretField label={`${has ? 'New' : ''} ${kind === 'pin' ? 'PIN (4–8 digits)' : 'password'}`.trim()} kind={kind} value={next} onChange={setNext} name="next-secret" />
          <SecretField label="Repeat" kind={kind} value={repeat} onChange={setRepeat} name="repeat-secret" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} data-action="save-secret" className="accent-bg px-4 py-2 text-[12px] font-semibold disabled:opacity-50">
            {has ? `Change ${kindName(kind)}` : `Set ${kindName(kind)}`}
          </button>
          {has && (
            <button type="button" disabled={busy} data-action="remove-secret" onClick={turnOff} className="border border-signal px-4 py-2 text-[12px] font-semibold text-signal hover:bg-signal hover:text-[#fff] disabled:opacity-50">
              Turn off sign-in
            </button>
          )}
          {message && <span role="status" data-signin-message data-ok={message.ok} className={`text-[12.5px] font-medium ${message.ok ? '' : 'text-signal'}`}>{message.text}</span>}
        </div>
      </form>
      <LockNotice className="mt-2" />
    </Section>
  )
}

function DeleteSection({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = () => { setOpen(false); setTyped(''); setSecret(''); setError(null) }

  const confirm = async () => {
    setBusy(true)
    if (profile.credential) {
      const result = await checkSecret(profile.id, secret)
      if (!result.ok) { setBusy(false); return setError(result.error) }
    }
    setBusy(false)
    notify('Profile erased', profile.name)
    eraseProfileAndLeave(profile.id)
  }

  return (
    <Section title="Delete">
      <SettingRow label="Delete this profile" hint="Erases its files, notes, settings and app data. This cannot be undone.">
        <Button tone="danger" onClick={() => setOpen(true)}>Delete profile</Button>
      </SettingRow>
      <AnimatePresence>
        {open && (
          <Dialog
            title={`Delete ${profile.name}`}
            onClose={close}
            actions={
              <>
                <Button onClick={close}>Cancel</Button>
                <Button tone="danger" disabled={busy || typed.trim() !== profile.name || (!!profile.credential && !secret)} onClick={confirm}>Erase profile</Button>
              </>
            }
          >
            <p>You will be signed out and everything saved in this profile will be erased. Other profiles are not affected.</p>
            {profile.credential && (
              <div className="mt-3">
                <SecretField label={`Current ${kindName(profile.credential.kind)}`} kind={profile.credential.kind} value={secret} onChange={(v) => { setSecret(v); setError(null) }} invalid={!!error} name="delete-secret" />
              </div>
            )}
            <label className="kicker mb-1.5 mt-3 block" htmlFor="delete-confirm">Type “{profile.name}” to confirm</label>
            <input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="field w-full px-3 py-2 text-[14px]" />
            {error && <div role="alert" className="mt-2 text-[12px] text-signal">{error}</div>}
          </Dialog>
        )}
      </AnimatePresence>
    </Section>
  )
}

export function AccountsPage() {
  const profileId = useSystem((s) => s.profileId)
  const profiles = useAuth((s) => s.profiles)
  const profile = profiles.find((p) => p.id === profileId)
  const [adding, setAdding] = useState(false)

  if (!profile) return <p className="text-[13px] text-white/65">Sign in to manage your profile.</p>

  return (
    <>
      <Section title="Your profile">
        <div className="flex items-center gap-5 border-b border-rule-soft py-4">
          <Avatar id={profile.avatar} size={72} />
          <div>
            <div data-current-profile className="text-[24px] font-bold leading-none tracking-[-0.04em]">{profile.name}</div>
            <div className="kicker mt-2">Signed in</div>
          </div>
        </div>
        <SettingRow label="Name"><NameField profile={profile} /></SettingRow>
        <div className="py-3">
          <div className="mb-2 text-[13px] font-medium">Picture</div>
          <AvatarPicker value={profile.avatar} onChange={(a) => setAvatar(profile.id, a)} />
        </div>
      </Section>

      <SignInSection key={profile.credential?.kind ?? 'none'} profile={profile} />

      <Section title="Profiles on this device">
        {profiles.map((p) => (
          <div key={p.id} data-settings-profile={p.id} className="flex items-center gap-4 border-b border-rule-soft py-3">
            <Avatar id={p.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold">{p.name}</div>
              <div className="text-[11.5px] text-white/60">{p.credential ? (p.credential.kind === 'pin' ? 'PIN' : 'Password') : 'No sign-in'}</div>
            </div>
            {p.id === profile.id && <span className="kicker !text-[var(--accent)]">Current</span>}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-3">
          <Button icon={Users} onClick={switchUser}>Switch user</Button>
          <Button icon={Plus} disabled={profiles.length >= MAX_PROFILES} onClick={() => setAdding(true)}>Add profile</Button>
        </div>
      </Section>

      <DeleteSection profile={profile} />

      <AnimatePresence>
        {adding && (
          <Dialog title="New profile" onClose={() => setAdding(false)}>
            <div className="-mx-1 max-h-[60vh] overflow-auto px-1">
              <ProfileForm
                submitLabel="Create profile"
                autoFocus
                onCancel={() => setAdding(false)}
                onSubmit={async (input) => {
                  const result = await createProfile(input)
                  if (!result.ok) return result.error
                  setAdding(false)
                  notify('Profile created', input.name.trim())
                  return null
                }}
              />
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  )
}
