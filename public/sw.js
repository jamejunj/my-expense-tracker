const CACHE = 'expense-tracker-v1'
const BASE  = '/my-expense-tracker'

const PRECACHE = [
  BASE + '/',
  BASE + '/login/',
  BASE + '/daily/',
  BASE + '/budget/',
]

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // Only handle GET requests within our scope
  if (e.request.method !== 'GET') return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
