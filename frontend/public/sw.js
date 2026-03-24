const CACHE = 'tj-v2'
const PRECACHE = ['/', '/index.html']

// Install: pre-cache shell
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

// Activate: purge ALL old caches, take control immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch strategy
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Network-only for API calls and Supabase (never cache)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return e.respondWith(fetch(e.request))
  }

  // Cache-first ONLY for Vite-hashed assets (filenames contain a hash)
  // e.g. /assets/TradeDetail-Ab3Cd9.js → safe to cache forever
  if (url.pathname.startsWith('/assets/')) {
    return e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
      })
    )
  }

  // Network-first for everything else (HTML, manifest, icons...)
  // Falls back to cache only if offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('/')))
  )
})
