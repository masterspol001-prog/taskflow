const CACHE = 'taskflow-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(req))
    )
    return
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)))
})
