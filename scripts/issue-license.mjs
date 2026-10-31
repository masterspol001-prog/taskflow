// Issue a signed license key after a real sale. Run this locally; never in the browser.
//
//   node scripts/issue-license.mjs --plan monthly --email buyer@example.com
//   node scripts/issue-license.mjs --plan annual  --email buyer@example.com --days 366
//   node scripts/issue-license.mjs --plan lifetime --email buyer@example.com
//   node scripts/issue-license.mjs --plan monthly --email buyer@example.com --payment pi_123 --amount 10
//
// Prints the key and appends scripts/keys/sales-log.csv (git-ignored). Email the key yourself.

import { createPrivateKey, createPublicKey } from 'node:crypto'
import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLicenseKey, buildPayload, verifyLicenseKey } from './license-core.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const keysDir = resolve(here, 'keys')
const privatePath = resolve(keysDir, 'private.jwk.json')
const logPath = resolve(keysDir, 'sales-log.csv')

if (!existsSync(privatePath)) {
  console.error('No signing key found. Run: node scripts/generate-keys.mjs')
  process.exit(1)
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const plan = arg('plan')
const email = arg('email') || arg('sub')
const daysArg = arg('days')
const payment = arg('payment') || ''
const amount = arg('amount') || ''

if (!plan || !email) {
  console.error('Usage: node scripts/issue-license.mjs --plan <monthly|annual|lifetime> --email <buyer@example.com> [--days N] [--payment id] [--amount 10]')
  process.exit(1)
}

const DEFAULT_DAYS = { monthly: 32, annual: 366, lifetime: null }
const days = daysArg != null ? Number(daysArg) : DEFAULT_DAYS[plan]
if (plan !== 'lifetime' && (!Number.isFinite(days) || days <= 0)) {
  console.error('--days must be a positive number for term licenses.')
  process.exit(1)
}

const privateKey = createPrivateKey({ key: JSON.parse(readFileSync(privatePath, 'utf8')), format: 'jwk' })

const payload = buildPayload({ plan, sub: email, days: plan === 'lifetime' ? null : days })
const key = buildLicenseKey(payload, privateKey)

const pub = createPublicKey(privateKey)
const check = verifyLicenseKey(key, pub)
if (!check.ok) {
  console.error('Internal error: issued key failed self-verification:', check.error)
  process.exit(1)
}

mkdirSync(keysDir, { recursive: true })
if (!existsSync(logPath)) {
  writeFileSync(logPath, 'issuedAt,plan,email,keyId,exp,paymentId,amountUsd,status\n', { mode: 0o600 })
}
const csvRow = [
  new Date(payload.iat).toISOString(),
  payload.plan,
  payload.sub.replaceAll(',', ' '),
  payload.id,
  payload.exp ? new Date(payload.exp).toISOString() : 'lifetime',
  payment.replaceAll(',', ' '),
  amount.replaceAll(',', ' '),
  'issued',
].join(',')
appendFileSync(logPath, csvRow + '\n')

console.log('License key:')
console.log(key)
console.log('')
console.log('  plan      :', payload.plan)
console.log('  buyer     :', payload.sub)
console.log('  issued    :', new Date(payload.iat).toISOString())
console.log('  expires   :', payload.exp ? new Date(payload.exp).toISOString() : 'never (lifetime)')
console.log('  key id    :', payload.id)
console.log('  ledger    : scripts/keys/sales-log.csv')
console.log('')
console.log('Email this key to the buyer. There is no automatic email.')
