/** The THRENos mark: a signal-red circle and a charcoal square. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="shrink-0">
      <circle cx="18" cy="18" r="16" fill="#d62929" />
      <rect x="26" y="26" width="12" height="12" fill="var(--ink)" />
    </svg>
  )
}

/** Logo and wordmark, sized by the logo. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-bold leading-none tracking-[-0.055em]" style={{ fontSize: size * 0.82 }}>
        THRENos
      </span>
    </span>
  )
}
