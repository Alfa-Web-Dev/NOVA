/* Nova service worker — offline-first app shell.
 * `scripts/postbuild.mjs` replaces the placeholders below with the real build manifest. */
const VERSION = '__BUILD_VERSION__';
const PRECACHE = /*__PRECACHE__*/['./'];
const CACHE = `nova-shell-${VERSION}`;
const RUNTIME = 'nova-runtime-v1';
const scope = self.registration.scope;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new URL(u, scope).href))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('nova-shell-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then((v) => { clearTimeout(t); res(v); }, (x) => { clearTimeout(t); rej(x); }); });

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range')) return;

  // Page loads: network first (fresh), fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await timeout(fetch(req), 4000); }
      catch { return (await caches.match(new URL('index.html', scope).href)) || (await caches.match(scope)) || Response.error(); }
    })());
    return;
  }
  // Hashed build assets are immutable: cache first.
  if (url.pathname.includes('/assets/')) {
    e.respondWith((async () => {
      const hit = await caches.match(req); if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }
  // Everything else (icons, manifest): stale-while-revalidate.
  e.respondWith((async () => {
    const cache = await caches.open(RUNTIME);
    const hit = await cache.match(req);
    const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
