import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { decodeLicensePayload, isLicenseKey, isRevokedLicenseId, setLicensePublicKey, verifyLicenseToken, type LicensePayload } from '../license'
import { REVOKED_LICENSE_IDS } from '../licenseRevoked'
import { LICENSE_PUBLIC_KEY_JWK } from '../licensePublicKey'

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function makeKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
}

async function exportPublicJwk(pair: CryptoKeyPair): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', pair.publicKey)
}

async function signToken(privateKey: CryptoKey, payload: LicensePayload): Promise<string> {
  const payloadB64 = b64url(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(payloadB64))
  return `TF1.${payloadB64}.${b64url(new Uint8Array(signature))}`
}

function payload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  return {
    v: 1,
    plan: 'monthly',
    sub: 'buyer@example.com',
    iat: Date.now(),
    exp: Date.now() + 86_400_000,
    id: 'ABCD2345EFGH',
    ...overrides,
  }
}

describe('license keys', () => {
  let pair: CryptoKeyPair
  let publicJwk: JsonWebKey

  beforeAll(async () => {
    pair = await makeKeyPair()
    publicJwk = await exportPublicJwk(pair)
    setLicensePublicKey(publicJwk)
  })

  afterAll(() => setLicensePublicKey(null))

  it('verifies a properly signed key and reads its claims', async () => {
    const token = await signToken(pair.privateKey, payload({ plan: 'annual' }))
    const res = await verifyLicenseToken(token)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.payload.plan).toBe('annual')
      expect(res.payload.sub).toBe('buyer@example.com')
      expect(res.payload.id).toBe('ABCD2345EFGH')
    }
    expect(decodeLicensePayload(token)?.plan).toBe('annual')
    expect(isLicenseKey(token)).toBe(true)
  })

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const token = await signToken(pair.privateKey, payload())
    const [prefix, , sig] = token.split('.')
    const forgedPayload = b64url(encoder.encode(JSON.stringify(payload({ plan: 'lifetime' }))))
    const res = await verifyLicenseToken(`${prefix}.${forgedPayload}.${sig}`)
    expect(res.ok).toBe(false)
  })

  it('rejects keys signed by a different key', async () => {
    const other = await makeKeyPair()
    const token = await signToken(other.privateKey, payload())
    const res = await verifyLicenseToken(token)
    expect(res.ok).toBe(false)
  })

  it('rejects malformed and empty keys', async () => {
    expect((await verifyLicenseToken('')).ok).toBe(false)
    expect((await verifyLicenseToken('TF-MO-ABCDEFGH-0000')).ok).toBe(false)
    expect((await verifyLicenseToken('not-a-key')).ok).toBe(false)
    expect(isLicenseKey('TF-MO-ABCDEFGH-0000')).toBe(false)
    expect(decodeLicensePayload('nope')).toBeNull()
  })

  it('rejects an expired but otherwise valid key', async () => {
    const token = await signToken(pair.privateKey, payload({ exp: Date.now() - 1000 }))
    const res = await verifyLicenseToken(token)
    expect(res.ok).toBe(false)
  })

  it('accepts lifetime keys with a null expiry', async () => {
    const token = await signToken(pair.privateKey, payload({ plan: 'lifetime', exp: null }))
    const res = await verifyLicenseToken(token)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.payload.exp).toBeNull()
  })

  it('does not trust the shipped key for keys minted elsewhere', async () => {
    const other = await makeKeyPair()
    const token = await signToken(other.privateKey, payload())
    const res = await verifyLicenseToken(token, LICENSE_PUBLIC_KEY_JWK)
    expect(res.ok).toBe(false)
  })

  it('rejects a revoked license id even when the signature is valid', async () => {
    expect(isRevokedLicenseId('')).toBe(false)
    expect(isRevokedLicenseId('UNKNOWNID0001')).toBe(false)
    const list = REVOKED_LICENSE_IDS as unknown as string[]
    list.push('ABCD2345EFGH')
    try {
      expect(isRevokedLicenseId('abcd2345efgh')).toBe(true)
      const token = await signToken(pair.privateKey, payload({ id: 'ABCD2345EFGH' }))
      const res = await verifyLicenseToken(token)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/revoked/i)
    } finally {
      list.length = 0
    }
  })
})
