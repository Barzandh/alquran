/* The Worker running locally on Node, for end-to-end tests of the real app in a browser.
     node --experimental-sqlite push/test/devserver.js 8788
   Same code as on Cloudflare (src/index.js) with the SQLite stand-in for D1. Extra test-only routes:
     POST /__admin/cron  {now?}  → runs the minute job; pushes go to a fake push service that decrypts
                                    them with the keys in /__admin/phone, and are listed in /__admin/sent
     POST /__admin/phone {endpoint, d, p256dh, auth}  → private key of the fake browser subscription
     POST /__admin/sql   {sql, args}  → read the database                                              */
import http from 'node:http';
import { makeD1 } from './d1mock.js';
import { handle, runCron } from '../src/index.js';
import { b64u } from '../src/webpush.js';

const env = { DB: makeD1(), SUBJECT: 'https://barzandh.github.io/alquran/' };
const phones = new Map(), sent = [];
const te = new TextEncoder();
async function hm(k, d) { const key = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', key, d)); }
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const kdf = async (salt, ikm, info, n) => (await hm(await hm(salt, ikm), cat(info, new Uint8Array([1])))).slice(0, n);
async function decrypt(body, ph) {
  const salt = body.slice(0, 16), asPub = body.slice(21, 86), ct = body.slice(86), ua = b64u.dec(ph.p256dh);
  const priv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: ph.d, x: b64u.enc(ua.slice(1, 33)), y: b64u.enc(ua.slice(33)) }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const sh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, priv, 256));
  const ikm = await kdf(b64u.dec(ph.auth), sh, cat(te.encode('WebPush: info\0'), ua, asPub), 32);
  const key = await crypto.subtle.importKey('raw', await kdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: await kdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12) }, key, ct));
  return new TextDecoder().decode(pt.slice(0, pt.lastIndexOf(2)));
}
const fakePush = async (url, init) => {
  const ph = phones.get(url); if (!ph) return new Response('gone', { status: 410 });
  sent.push({ url, at: Date.now(), json: await decrypt(new Uint8Array(init.body), ph), headers: init.headers });
  return new Response('', { status: 201 });
};

const port = +process.argv[2] || 8788;
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString('utf8');
  const url = `http://127.0.0.1:${port}${req.url}`;
  try {
    if (req.url.startsWith('/__admin/')) {
      const j = body ? JSON.parse(body) : {}; let out;
      if (req.url === '/__admin/phone') { phones.set(j.endpoint, j); out = { ok: true }; }
      else if (req.url === '/__admin/cron') out = await runCron(env, { now: j.now ?? Date.now(), sleep: async () => {}, fetch: fakePush, prune: false });
      else if (req.url === '/__admin/sent') out = sent;
      else if (req.url === '/__admin/sql') out = env.DB.raw.prepare(j.sql).all(...(j.args || []));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(out)); return;
    }
    const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }), env, { waitUntil: p => p.catch(e => console.error(e)), fetch: fakePush });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(port, '127.0.0.1', () => console.log('worker dev server on ' + port));
