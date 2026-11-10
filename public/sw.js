// Service worker: a returning visitor's studio comes from the browser's own cache — near-instant, and offline too.
//   the page (index.html)  network first, so an update shows at once; the cached copy when offline
//   static/ (built files)  cache first: their names change whenever their content does, so a cached copy is never stale
//   assets/ (photos, …)    the cached copy at once, refreshed in the background for the next visit (names don't change)
//   music                  left to the network: audio streams in ranges, which a cache can't answer
// Registered from main.js in production builds only. To retire it, replace this file with one that unregisters itself.
const CACHE = 'studio-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const put = async (req, res) => {
  if (res.ok && res.status === 200 && res.type === 'basic') (await caches.open(CACHE)).put(req, res.clone());
  return res;
};

// On the first visit everything has loaded before this worker exists: the page sends the list, and it is cached
// now (mostly straight from the browser's HTTP cache), so even the second visit is quick.
self.addEventListener('message', e => {
  if (!Array.isArray(e.data?.cache)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const u of e.data.cache) {
      const url = new URL(u, self.registration.scope);
      if (url.origin !== location.origin || url.pathname.includes('/assets/music/') || await cache.match(url)) continue;
      try { await put(new Request(url), await fetch(url)); } catch { /* offline or gone: skip */ }
    }
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || req.headers.has('range') || url.search.includes('nosw')) return;
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => put(req, res)).catch(async () => (await caches.match(req, { ignoreSearch: true })) || Response.error()));
  } else if (path.startsWith('static/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
  } else if (path.startsWith('assets/') && !path.startsWith('assets/music/')) {
    e.respondWith(caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => put(req, res));
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    }));
  }
});
