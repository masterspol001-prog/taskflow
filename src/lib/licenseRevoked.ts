/**
 * Key IDs (`payload.id`) that must not unlock Pro.
 * Append via `node scripts/revoke-license.mjs --id ABCD2345EFGH`.
 * Rebuild after editing — this list ships in the client bundle.
 */
export const REVOKED_LICENSE_IDS: readonly string[] = []
