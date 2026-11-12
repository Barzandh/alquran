/* AlQuran service worker — build 20261112.234000
   Saves the whole app (page, Quran data, icons) on install, with retries, and serves it cache-first,
   so AlQuran opens with no internet indefinitely. Every online launch the page asks it to check and
   repair the offline copy. A new build is detected when this file changes. */
const BUILD = '20261112.234000';
const CACHE = 'alquran-' + BUILD;
const RUNTIME = 'alquran-runtime';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './data/ara-quranuthmanihaf.bin', './data/eng-muftitaqiusmani.bin', './data/eng-ummmuhammad.bin', './data/eng-abdullahyusufal.bin', './data/eng-mohammedmarmadu.bin', './data/fra-muhammadhamidul.bin', './data/deu-asfbubenheimand.bin', './data/kur-burhanmuhammada.bin', './data/kur-muhammadsalehba.bin', './data/ara-quran-la.bin', './data/ara-kingfahadquranc.bin', './data/ara-quransimple.bin', './data/ara-saddi.bin', './data/lat-hafs.bin', './data/tabari/001.bin', './data/tabari/002.bin', './data/tabari/003.bin', './data/tabari/004.bin', './data/tabari/005.bin', './data/tabari/006.bin', './data/tabari/007.bin', './data/tabari/008.bin', './data/tabari/009.bin', './data/tabari/010.bin', './data/tabari/011.bin', './data/tabari/012.bin', './data/tabari/013.bin', './data/tabari/014.bin', './data/tabari/015.bin', './data/tabari/016.bin', './data/tabari/017.bin', './data/tabari/018.bin', './data/tabari/019.bin', './data/tabari/020.bin', './data/tabari/021.bin', './data/tabari/022.bin', './data/tabari/023.bin', './data/tabari/024.bin', './data/tabari/025.bin', './data/tabari/026.bin', './data/tabari/027.bin', './data/tabari/028.bin', './data/tabari/029.bin', './data/tabari/030.bin', './data/tabari/031.bin', './data/tabari/032.bin', './data/tabari/033.bin', './data/tabari/034.bin', './data/tabari/035.bin', './data/tabari/036.bin', './data/tabari/037.bin', './data/tabari/038.bin', './data/tabari/039.bin', './data/tabari/040.bin', './data/tabari/041.bin', './data/tabari/042.bin', './data/tabari/043.bin', './data/tabari/044.bin', './data/tabari/045.bin', './data/tabari/046.bin', './data/tabari/047.bin', './data/tabari/048.bin', './data/tabari/049.bin', './data/tabari/050.bin', './data/tabari/051.bin', './data/tabari/052.bin', './data/tabari/053.bin', './data/tabari/054.bin', './data/tabari/055.bin', './data/tabari/056.bin', './data/tabari/057.bin', './data/tabari/058.bin', './data/tabari/059.bin', './data/tabari/060.bin', './data/tabari/061.bin', './data/tabari/062.bin', './data/tabari/063.bin', './data/tabari/064.bin', './data/tabari/065.bin', './data/tabari/066.bin', './data/tabari/067.bin', './data/tabari/068.bin', './data/tabari/069.bin', './data/tabari/070.bin', './data/tabari/071.bin', './data/tabari/072.bin', './data/tabari/073.bin', './data/tabari/074.bin', './data/tabari/075.bin', './data/tabari/076.bin', './data/tabari/077.bin', './data/tabari/078.bin', './data/tabari/079.bin', './data/tabari/080.bin', './data/tabari/081.bin', './data/tabari/082.bin', './data/tabari/083.bin', './data/tabari/084.bin', './data/tabari/085.bin', './data/tabari/086.bin', './data/tabari/087.bin', './data/tabari/088.bin', './data/tabari/089.bin', './data/tabari/090.bin', './data/tabari/091.bin', './data/tabari/092.bin', './data/tabari/093.bin', './data/tabari/094.bin', './data/tabari/095.bin', './data/tabari/096.bin', './data/tabari/097.bin', './data/tabari/098.bin', './data/tabari/099.bin', './data/tabari/100.bin', './data/tabari/101.bin', './data/tabari/102.bin', './data/tabari/103.bin', './data/tabari/104.bin', './data/tabari/105.bin', './data/tabari/106.bin', './data/tabari/107.bin', './data/tabari/108.bin', './data/tabari/109.bin', './data/tabari/110.bin', './data/tabari/111.bin', './data/tabari/112.bin', './data/tabari/113.bin', './data/tabari/114.bin'];
const abs = u => new URL(u, self.registration.scope).href;
const INDEX = () => abs('./index.html');

async function tell(msg) { for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage(msg); }
let saving = null;
function precache() {
  if (saving) return saving;
  saving = (async () => {
    const c = await caches.open(CACHE); let done = 0;
    for (const u of SHELL) {
      const url = abs(u);
      if (await c.match(url)) { done++; continue; }
      let ok = false, err = '';
      for (let i = 0; i < 4 && !ok; i++) {
        try { const r = await fetch(new Request(url, { cache: 'reload' })); if (r.ok && !r.redirected) { await c.put(url, r); ok = true; } else err = 'HTTP ' + r.status; }
        catch (e) { err = e.message; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
      }
      if (!ok) { await tell({ type: 'offline-progress', done, total: SHELL.length, error: u + ': ' + err }); throw new Error('Could not save ' + u); }
      done++; await tell({ type: 'offline-progress', done, total: SHELL.length });
    }
    await tell({ type: 'offline-ready', build: BUILD, total: SHELL.length });
    return done;
  })().finally(() => { saving = null; });
  return saving;
}
async function status() {
  const c = await caches.open(CACHE); let n = 0;
  for (const u of SHELL) if (await c.match(abs(u))) n++;
  return { type: 'offline-status', build: BUILD, cached: n, total: SHELL.length };
}

self.addEventListener('install', e => { e.waitUntil(precache()); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const st = await status();
    if (st.cached === st.total) for (const k of await caches.keys()) if (k.startsWith('alquran-') && k !== CACHE && k !== RUNTIME) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => {
  const d = e.data;
  if (d === 'skipWaiting') self.skipWaiting();
  if (d === 'ensure') e.waitUntil(precache().catch(() => {}));
  if (d === 'status') e.waitUntil(status().then(s => e.source && e.source.postMessage(s)));
});

async function cachedPage() {
  const own = await caches.open(CACHE);
  return (await own.match(INDEX())) || (await own.match(abs('./'))) || (await caches.match(INDEX(), { ignoreSearch: true })) || (await caches.match(abs('./'), { ignoreSearch: true }));
}
const OFFLINE_HTML = `<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AlQuran</title>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0b3527;color:#f3ead0;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><div style="font-size:42px">📖</div><h2 style="margin:8px 0">AlQuran isn't saved on this phone yet</h2>
<p style="opacity:.85;line-height:1.5">Connect to the internet once and open AlQuran.<br>Keep it open until you see <b>“Works offline ✓”</b>.<br>After that it works without internet.</p>
<button onclick="location.reload()" style="margin-top:12px;padding:12px 20px;border-radius:12px;border:0;background:#d8b56a;color:#0b3527;font-weight:700;font-size:16px">Try again</button></div></body>`;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const hit = await cachedPage();
      if (hit) return hit;
      try { const r = await fetch(req); return r; }
      catch (err) { return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    e.respondWith((async () => {
      const hit = (await caches.match(req, { ignoreSearch: true })) || (await caches.match(url.origin + url.pathname, { ignoreSearch: true }));
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); c.put(url.origin + url.pathname, res.clone()); }
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
