/* AlQuran service worker — build 20261111.190918
   App shell is cached on install and served cache-first, so the app opens with no internet indefinitely.
   A new build is detected when this file changes; the page then offers "Update". */
const BUILD = '20261111.190918';
const CACHE = 'alquran-' + BUILD;
const RUNTIME = 'alquran-runtime';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('alquran-') && k !== CACHE && k !== RUNTIME) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const hit = await caches.match('./index.html', { ignoreSearch: true });
      if (hit) return hit;
      try { return await fetch(req); } catch (err) { return new Response('<h1>AlQuran is offline</h1><p>Open it once with internet to finish installing.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(RUNTIME); c.put(req, res.clone()); }
      return res;
    })());
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME), hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit || new Response('', { status: 504 }));
      return hit || net;
    })());
  }
  /* recitation audio streams from the network; downloaded surahs are played from IndexedDB by the page */
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { c.postMessage({ type: 'open', link }); return c.focus(); }
    return self.clients.openWindow('./#' + (link.split(':')[0] || 'home'));
  })());
});
