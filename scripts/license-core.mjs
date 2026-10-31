// Shared license primitives for the Node-side issuer tooling.
// The browser uses the same token format (see src/lib/license.ts).
//
// Token format:  TF1.<base64url(payload json)>.<base64url(signature)>
// Signature:     ECDSA P-256 / SHA-256 over the ASCII bytes of the payload segment,
//                encoded as IEEE P1363 (raw r||s, 64 bytes) so Web Crypto can verify it.
//
// KEEP THIS FILE AND THE PRIVATE KEY OFF THE PUBLIC WEB APP.

import { createSign, createVerify } from 'node:crypto'

export const TOKEN_PREFIX = 'TF1'
export const CURVE = 'P-256'

export function toB64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function buildPayload({ plan, sub, days = null, id = null, now = Date.now() }) {
  if (!['monthly', 'annual', 'lifetime'].includes(plan)) {
    throw new Error(`Unknown plan "${plan}". Use monthly | annual | lifetime.`)
  }
  const exp = plan === 'lifetime' ? null : now + days * 86_400_000
  return {
    v: 1,
    plan,
    sub: String(sub || '').trim() || 'customer',
    iat: now,
    exp,
    id: (id || randomId()).toUpperCase(),
  }
}

export function randomId() {
  // 12 chars, no ambiguous characters.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function signPayload(payloadB64, privateKey) {
  const signer = createSign('SHA256')
  signer.update(payloadB64)
  signer.end()
  return signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
}

export function buildLicenseKey(payload, privateKey) {
  const payloadB64 = toB64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = signPayload(payloadB64, privateKey)
  return `${TOKEN_PREFIX}.${payloadB64}.${toB64url(sig)}`
}

export function parsePayload(token) {
  const parts = String(token || '').trim().split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null
  try {
    return JSON.parse(fromB64url(parts[1]).toString('utf8'))
  } catch {
    return null
  }
}

export function verifyLicenseKey(token, publicKey) {
  const parts = String(token || '').trim().split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return { ok: false, error: 'Malformed key.' }
  const payload = parsePayload(token)
  if (!payload) return { ok: false, error: 'Malformed payload.' }
  const verifier = createVerify('SHA256')
  verifier.update(parts[1])
  verifier.end()
  const ok = verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, fromB64url(parts[2]))
  if (!ok) return { ok: false, error: 'Bad signature.' }
  if (payload.exp != null && Date.now() >= payload.exp) return { ok: false, error: 'Expired.' }
  return { ok: true, payload }
}
