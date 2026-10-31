export const APP_VERSION = '1.0.0'

export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL ?? '').trim()

export const SITE_ORIGIN = (import.meta.env.VITE_SITE_ORIGIN ?? '').trim()

export const LEGAL = {
  privacy: '/privacy.html',
  terms: '/terms.html',
  refund: '/refund.html',
  help: '/help.html',
} as const

export function supportMailto(): string | null {
  if (!SUPPORT_EMAIL) return null
  return `mailto:${SUPPORT_EMAIL}`
}

export function supportLabel(): string {
  return SUPPORT_EMAIL || 'the seller on your payment receipt'
}
