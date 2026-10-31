/**
 * Last-resort safety net for the very small window before React mounts.
 *
 * Without this, a synchronous module error (blocked storage, unsupported API,
 * a bad cached chunk) leaves `#root` empty: a blank canvas with no explanation.
 * We render a plain-DOM message that also offers to clear caches and reload.
 */

const SHOWN_ATTR = 'data-tf-fatal'

function rootIsEmpty(): boolean {
  if (typeof document === 'undefined') return false
  const root = document.getElementById('root')
  return !!root && root.childElementCount === 0
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}

export function showFatalError(message: string): void {
  if (typeof document === 'undefined') return
  if (document.documentElement.getAttribute(SHOWN_ATTR) === 'true') return
  const root = document.getElementById('root')
  if (!root) return
  document.documentElement.setAttribute(SHOWN_ATTR, 'true')

  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const bg = dark ? '#0e0d0b' : '#efe8dc'
  const fg = dark ? '#f4efe6' : '#16120e'
  const muted = dark ? '#93897c' : '#7d7468'

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:${bg};color:${fg};font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
      <div style="max-width:32rem;text-align:center">
        <div style="font-size:15px;font-weight:700;letter-spacing:-0.01em">TaskFlow couldn't start</div>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${muted}">
          Your data is safe. This usually clears with a reload; if not, clear this site's cache.
        </p>
        <pre style="margin:16px 0 0;padding:12px;border-radius:12px;background:rgba(127,127,127,0.12);font-size:12px;line-height:1.5;text-align:left;white-space:pre-wrap;word-break:break-word;color:${muted}">${escapeHtml(
          message
        )}</pre>
        <div style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button id="tf-reload" style="cursor:pointer;border:0;border-radius:12px;padding:10px 16px;font-weight:600;font-size:14px;background:#6c5ce7;color:#fff">Reload</button>
          <button id="tf-reset" style="cursor:pointer;border-radius:12px;padding:10px 16px;font-weight:600;font-size:14px;background:transparent;color:${fg};border:1px solid rgba(127,127,127,0.35)">Clear cache &amp; reload</button>
        </div>
      </div>
    </div>`

  document.getElementById('tf-reload')?.addEventListener('click', () => window.location.reload())
  document.getElementById('tf-reset')?.addEventListener('click', async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {
      // best effort
    }
    window.location.reload()
  })
}

export function installBootGuard(): void {
  if (typeof window === 'undefined') return

  const onError = (event: ErrorEvent) => {
    if (!rootIsEmpty()) return
    const detail = event.error instanceof Error ? `${event.error.name}: ${event.error.message}` : event.message
    showFatalError(detail || 'Unknown startup error')
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    if (!rootIsEmpty()) return
    const reason = event.reason
    showFatalError(reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason))
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
}
