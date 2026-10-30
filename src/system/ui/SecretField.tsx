import { useId } from 'react'
import type { CredentialKind } from '../credentials'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  kind: CredentialKind
  autoFocus?: boolean
  disabled?: boolean
  invalid?: boolean
  name?: string
  placeholder?: string
}

/** A PIN (digits only) or password field. Values live only in component state and are never stored. */
export function SecretField({ label, value, onChange, kind, autoFocus, disabled, invalid, name, placeholder }: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="kicker mb-1.5 block">{label}</label>
      <input
        id={id}
        name={name}
        type="password"
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        inputMode={kind === 'pin' ? 'numeric' : 'text'}
        maxLength={kind === 'pin' ? 8 : 128}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(kind === 'pin' ? e.target.value.replace(/\D/g, '') : e.target.value)}
        className={`field w-full px-3 py-2.5 text-[15px] tracking-[0.18em] ${invalid ? '!border-signal' : ''}`}
      />
    </div>
  )
}
