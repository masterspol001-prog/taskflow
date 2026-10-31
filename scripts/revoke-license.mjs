// Revoke a sold key id so the next production build refuses it.
//
//   node scripts/revoke-license.mjs --id ABCD2345EFGH
//
// Appends src/lib/licenseRevoked.ts and marks the sales ledger. Rebuild and deploy.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const listPath = resolve(root, 'src/lib/licenseRevoked.ts')
const logPath = resolve(here, 'keys/sales-log.csv')

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const id = (arg('id') || '').trim().toUpperCase()
if (!id) {
  console.error('Usage: node scripts/revoke-license.mjs --id ABCD2345EFGH')
  process.exit(1)
}

let source = existsSync(listPath)
  ? readFileSync(listPath, 'utf8')
  : `export const REVOKED_LICENSE_IDS: readonly string[] = []\n`

const match = source.match(/REVOKED_LICENSE_IDS: readonly string\[\] = \[([^\]]*)\]/)
const existing = match
  ? match[1]
      .split(',')
      .map((s) => s.replace(/['"\s]/g, ''))
      .filter(Boolean)
  : []
if (existing.includes(id)) {
  console.log('Already revoked:', id)
  process.exit(0)
}
existing.push(id)
const body = existing.map((entry) => `  '${entry}',`).join('\n')
writeFileSync(
  listPath,
  `/**
 * Key IDs (\`payload.id\`) that must not unlock Pro.
 * Append via \`node scripts/revoke-license.mjs --id ABCD2345EFGH\`.
 * Rebuild after editing — this list ships in the client bundle.
 */
export const REVOKED_LICENSE_IDS: readonly string[] = [
${body}
]
`
)
if (existsSync(logPath)) {
  appendFileSync(logPath, `${new Date().toISOString()},revoked,,${id},, , ,revoked\n`)
}
console.log('Revoked', id)
console.log('Rebuild and deploy so clients pick up the denylist.')
