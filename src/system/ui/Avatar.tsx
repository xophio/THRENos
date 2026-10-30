import type { ReactNode } from 'react'
import { AVATARS } from '../authStore'
import type { AvatarId } from '../authStore'

// Avatars use the fixed brand palette so a profile looks the same in both themes.
const PAPER = '#f2f0e9'
const INK = '#202020'
const RED = '#d62929'
const GREY = '#8c8a83'

const ART: Record<AvatarId, ReactNode> = {
  signal: (
    <>
      <rect width="64" height="64" fill={PAPER} />
      <circle cx="32" cy="32" r="19" fill={RED} />
    </>
  ),
  bars: (
    <>
      <rect width="64" height="64" fill={INK} />
      <rect x="10" width="4" height="64" fill={PAPER} />
      <rect x="20" width="10" height="64" fill={PAPER} />
      <rect x="36" width="14" height="64" fill={RED} />
      <rect x="55" width="3" height="64" fill={PAPER} />
    </>
  ),
  quarter: (
    <>
      <rect width="64" height="64" fill={PAPER} />
      <path d="M0 64 L0 14 A50 50 0 0 1 50 64 Z" fill={INK} />
      <rect x="40" y="8" width="16" height="16" fill={RED} />
    </>
  ),
  grid: (
    <>
      <rect width="64" height="64" fill={PAPER} />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const fill = (r + c) % 4 === 0 ? RED : (r * 3 + c) % 2 === 0 ? INK : 'none'
          return <rect key={`${r}${c}`} x={8 + c * 18} y={8 + r * 18} width="14" height="14" fill={fill} stroke={INK} strokeWidth="1.5" />
        }),
      )}
    </>
  ),
  half: (
    <>
      <rect width="64" height="64" fill={INK} />
      <path d="M8 42 A24 24 0 0 1 56 42 Z" fill={PAPER} />
      <circle cx="32" cy="52" r="6" fill={RED} />
    </>
  ),
  ring: (
    <>
      <rect width="64" height="64" fill={PAPER} />
      <circle cx="32" cy="32" r="19" fill="none" stroke={INK} strokeWidth="7" />
      <circle cx="32" cy="32" r="6" fill={RED} />
    </>
  ),
  cross: (
    <>
      <rect width="64" height="64" fill={RED} />
      <rect x="28" y="12" width="8" height="40" fill={PAPER} />
      <rect x="12" y="28" width="40" height="8" fill={PAPER} />
    </>
  ),
  stripe: (
    <>
      <rect width="64" height="64" fill={PAPER} />
      <rect y="10" width="64" height="7" fill={INK} />
      <rect y="24" width="64" height="7" fill={GREY} />
      <rect y="38" width="64" height="7" fill={RED} />
      <rect y="52" width="64" height="4" fill={INK} />
    </>
  ),
}

/** A flat geometric profile picture. */
export function Avatar({ id, size = 48, className = '' }: { id: AvatarId; size?: number; className?: string }) {
  return (
    <svg
      data-avatar-art={id}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Profile picture"
      className={`block shrink-0 border border-ink ${className}`}
    >
      {ART[id] ?? ART.signal}
    </svg>
  )
}

export function AvatarPicker({ value, onChange }: { value: AvatarId; onChange: (id: AvatarId) => void }) {
  return (
    <div role="radiogroup" aria-label="Profile picture" className="grid grid-cols-8 gap-2 max-sm:grid-cols-4">
      {AVATARS.map((a) => (
        <button
          type="button"
          key={a}
          role="radio"
          aria-checked={value === a}
          aria-label={`Picture ${a}`}
          data-avatar-option={a}
          onClick={() => onChange(a)}
          className={`p-0.5 transition-colors ${value === a ? 'outline outline-2 outline-offset-1 outline-[var(--accent)]' : 'hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-ink'}`}
        >
          <Avatar id={a} size={44} className="w-full" />
        </button>
      ))}
    </div>
  )
}
