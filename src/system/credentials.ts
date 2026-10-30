/**
 * PIN and password hashing.
 *
 * Secrets are never stored. Each credential keeps a random salt and a PBKDF2-HMAC-SHA-256 hash.
 *
 * This is an app-level lock for a browser OS, not account security: the data it guards lives in this
 * browser's own storage, so anyone who can open the browser's developer tools can read or erase it
 * regardless of any PIN. Hashing prevents the PIN itself from being read back, and the throttling in
 * `auth.ts` slows guessing through the interface, but neither is a substitute for operating-system security.
 */

export type CredentialKind = 'pin' | 'password'

export interface Credential {
  kind: CredentialKind
  /** Base64 random salt, unique per credential. */
  salt: string
  /** Base64 derived key. */
  hash: string
  iterations: number
}

const ITERATIONS = 210_000
const SALT_BYTES = 16
const HASH_BITS = 256

export const PIN_PATTERN = /^\d{4,8}$/
export const MIN_PASSWORD = 6
export const MAX_PASSWORD = 128

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** True where the browser offers WebCrypto (secure contexts such as https or localhost). */
export const hashingAvailable = () => typeof crypto !== 'undefined' && !!crypto.subtle

async function derive(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, HASH_BITS)
  return new Uint8Array(bits)
}

/** Returns an error message for an unacceptable secret, or null. */
export function validateSecret(kind: CredentialKind, secret: string): string | null {
  if (kind === 'pin') return PIN_PATTERN.test(secret) ? null : 'A PIN must be 4 to 8 digits.'
  if (secret.length < MIN_PASSWORD) return `A password needs at least ${MIN_PASSWORD} characters.`
  if (secret.length > MAX_PASSWORD) return `A password can be at most ${MAX_PASSWORD} characters.`
  return null
}

export async function createCredential(kind: CredentialKind, secret: string): Promise<Credential> {
  if (!hashingAvailable()) throw new Error('Secure hashing is not available in this browser context, so a PIN or password cannot be set.')
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(SALT_BYTES)))
  const hash = await derive(secret, salt, ITERATIONS)
  return { kind, salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS }
}

/** Compares in constant time so timing does not reveal how much of a guess was right. */
export async function verifyCredential(secret: string, credential: Credential): Promise<boolean> {
  if (!hashingAvailable()) return false
  try {
    const expected = fromBase64(credential.hash)
    const actual = await derive(secret, fromBase64(credential.salt), credential.iterations)
    if (expected.length !== actual.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i]
    return diff === 0
  } catch {
    return false
  }
}

/** Structural check used when reading saved profiles. */
export function isCredential(v: unknown): v is Credential {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (c.kind === 'pin' || c.kind === 'password')
    && typeof c.salt === 'string' && typeof c.hash === 'string'
    && typeof c.iterations === 'number' && c.iterations >= 1000 && c.iterations <= 10_000_000
}
