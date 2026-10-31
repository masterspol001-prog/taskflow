import { LICENSE_PUBLIC_KEY_JWK } from '@/lib/licensePublicKey'
import { REVOKED_LICENSE_IDS } from '@/lib/licenseRevoked'
import { supportLabel } from '@/lib/site'

export type BillingInterval = 'monthly' | 'annual' | 'lifetime'

export const TOKEN_PREFIX = 'TF1'

/** Decoded, human-meaningful part of a license key. */
export interface LicensePayload {
  /** Format version. */
  v: number
  /** Which plan the buyer paid for. */
  plan: BillingInterval
  /** Buyer identity (email/handle), set at issue time. */
  sub: string
  /** Issued-at, epoch ms. */
  iat: number
  /** Expiry, epoch ms, or null for lifetime. */
  exp: number | null
  /** Short key id for support. */
  id: string
}

export type LicenseVerification =
  | { ok: true; payload: LicensePayload }
  | { ok: false; error: string }

function fromB64url(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/') + pad
  const binary = atob(normalized)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isBillingInterval(v: unknown): v is BillingInterval {
  return v === 'monthly' || v === 'annual' || v === 'lifetime'
}

function isPayloadObject(v: unknown): v is LicensePayload {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return (
    typeof p.v === 'number' &&
    isBillingInterval(p.plan) &&
    typeof p.sub === 'string' &&
    typeof p.iat === 'number' &&
    (p.exp === null || typeof p.exp === 'number') &&
    typeof p.id === 'string'
  )
}

/**
 * Cheap, synchronous structural decode. This reads the claims but does NOT prove
 * the key was issued by us. Use {@link verifyLicenseToken} before trusting it.
 */
export function decodeLicensePayload(raw: string | null | undefined): LicensePayload | null {
  const token = String(raw ?? '').trim()
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null
  try {
    const json = new TextDecoder().decode(fromB64url(parts[1]))
    const parsed = JSON.parse(json)
    return isPayloadObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** True when the string is at least shaped like a TaskFlow license key. */
export function isLicenseKey(raw: string | null | undefined): boolean {
  return decodeLicensePayload(raw) !== null
}

function subtle(): SubtleCrypto | null {
  const c = (globalThis as { crypto?: Crypto }).crypto
  return c && c.subtle ? c.subtle : null
}

let activePublicKey: JsonWebKey = LICENSE_PUBLIC_KEY_JWK

/**
 * Swap the trusted public key at runtime (tests only). Pass null to restore
 * the key embedded at build time. Not a customer API.
 */
export function setLicensePublicKey(jwk: JsonWebKey | null): void {
  activePublicKey = jwk ?? LICENSE_PUBLIC_KEY_JWK
}

export function isRevokedLicenseId(id: string | null | undefined): boolean {
  if (!id) return false
  const needle = id.toUpperCase()
  return REVOKED_LICENSE_IDS.some((entry) => entry.toUpperCase() === needle)
}

/**
 * Verify a license key's signature against the trusted public key.
 * Offline and async (Web Crypto). Returns the decoded payload on success.
 */
export async function verifyLicenseToken(
  raw: string | null | undefined,
  publicKeyJwk: JsonWebKey = activePublicKey
): Promise<LicenseVerification> {
  const token = String(raw ?? '').trim()
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return { ok: false, error: 'That does not look like a TaskFlow license key.' }
  }
  const payload = decodeLicensePayload(token)
  if (!payload) return { ok: false, error: 'The license key is malformed.' }
  if (isRevokedLicenseId(payload.id)) {
    return { ok: false, error: `That license was revoked. Contact ${supportLabel()} if this is a mistake.` }
  }
  const cryptoImpl = subtle()
  if (!cryptoImpl) return { ok: false, error: 'This browser cannot verify licenses (no Web Crypto).' }
  try {
    const key = await cryptoImpl.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )
    const data = new TextEncoder().encode(parts[1])
    const signature = fromB64url(parts[2])
    const valid = await cryptoImpl.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, data)
    if (!valid) {
      return { ok: false, error: `That license key isn't valid. Double-check it or email ${supportLabel()}.` }
    }
  } catch {
    return { ok: false, error: 'We could not verify that license key.' }
  }
  if (payload.exp != null && Date.now() >= payload.exp) {
    return { ok: false, error: 'That license has expired. Buy a new term and paste the new key to keep Pro.' }
  }
  return { ok: true, payload }
}
