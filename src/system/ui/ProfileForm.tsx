import { useState } from 'react'
import type { FormEvent } from 'react'
import { WALLPAPERS, wallpaperStyle } from '../../theme/wallpapers'
import { Segmented } from '../../components/shared/controls'
import { MAX_PROFILE_NAME } from '../authStore'
import type { AvatarId } from '../authStore'
import { validateName } from '../auth'
import type { NewProfile } from '../auth'
import { validateSecret } from '../credentials'
import type { CredentialKind } from '../credentials'
import { AvatarPicker } from './Avatar'
import { SecretField } from './SecretField'

/** What the lock actually is, stated wherever a PIN or password can be set. */
export function LockNotice({ className = '' }: { className?: string }) {
  return (
    <p data-lock-notice className={`border-l-2 border-ink pl-3 text-[11.5px] leading-relaxed text-white/70 ${className}`}>
      This is a local lock for your THRENos session. It is not account security and does not protect your computer:
      anyone with access to this browser can read or erase its data. PINs and passwords are stored only as salted hashes,
      so they cannot be recovered. If you forget one, the only way back in is to erase the profile.
    </p>
  )
}

interface Props {
  submitLabel: string
  onSubmit: (profile: NewProfile) => Promise<string | null>
  onCancel?: () => void
  autoFocus?: boolean
}

/** Name, picture, optional PIN/password and a starting wallpaper. `onSubmit` returns an error message or null. */
export function ProfileForm({ submitLabel, onSubmit, onCancel, autoFocus }: Props) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<AvatarId>('signal')
  const [protection, setProtection] = useState<CredentialKind | 'none'>('none')
  const [secret, setSecret] = useState('')
  const [confirm, setConfirm] = useState('')
  const [wallpaper, setWallpaper] = useState(WALLPAPERS[0].id)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const nameError = validateName(name)
    if (nameError) return setError(nameError)
    if (protection !== 'none') {
      const secretError = validateSecret(protection, secret)
      if (secretError) return setError(secretError)
      if (secret !== confirm) return setError(protection === 'pin' ? 'The two PINs do not match.' : 'The two passwords do not match.')
    }
    setBusy(true)
    setError(null)
    const failure = await onSubmit({ name, avatar, protection, secret, preferences: { wallpaper } })
    setBusy(false)
    if (failure) setError(failure)
  }

  return (
    <form onSubmit={submit} data-profile-form className="space-y-5" noValidate>
      <div>
        <label htmlFor="profile-name" className="kicker mb-1.5 block">Name</label>
        <input
          id="profile-name"
          name="profile-name"
          value={name}
          autoFocus={autoFocus}
          maxLength={MAX_PROFILE_NAME}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          className="field w-full px-3 py-2.5 text-[15px] font-medium"
          placeholder="Your name"
        />
      </div>

      <div>
        <div className="kicker mb-2">Picture</div>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </div>

      <div>
        <div className="kicker mb-2">Wallpaper</div>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Starting wallpaper">
          {WALLPAPERS.map((w) => (
            <button
              type="button"
              key={w.id}
              role="radio"
              aria-checked={wallpaper === w.id}
              aria-label={`Wallpaper ${w.name}`}
              onClick={() => setWallpaper(w.id)}
              className={`h-12 border ${wallpaper === w.id ? 'border-[var(--accent)] outline outline-2 -outline-offset-2 outline-[var(--accent)]' : 'border-ink'}`}
              style={wallpaperStyle(w, 'light')}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="kicker mb-2">Sign-in</div>
        <Segmented
          label="Sign-in protection"
          value={protection}
          options={[{ value: 'none', label: 'None' }, { value: 'pin', label: 'PIN' }, { value: 'password', label: 'Password' }]}
          onChange={(v) => { setProtection(v); setSecret(''); setConfirm(''); setError(null) }}
        />
        {protection !== 'none' && (
          <div className="mt-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <SecretField label={protection === 'pin' ? 'PIN (4–8 digits)' : 'Password'} kind={protection} value={secret} onChange={setSecret} name="new-secret" />
            <SecretField label="Repeat" kind={protection} value={confirm} onChange={setConfirm} name="confirm-secret" />
          </div>
        )}
      </div>

      <LockNotice />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} data-action="create-profile" className="accent-bg px-5 py-2.5 text-[13px] font-semibold disabled:opacity-50">
          {busy ? 'Working…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="border border-ink px-4 py-2.5 text-[13px] font-semibold hover-invert">Cancel</button>
        )}
        {error && <span role="alert" data-form-error className="text-[12.5px] font-medium text-signal">{error}</span>}
      </div>
    </form>
  )
}
