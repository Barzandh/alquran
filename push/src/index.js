/* AlQuran push + diagnostics Worker
   Routes (all JSON; the app sends it as text/plain so browsers skip the CORS preflight):
     GET  /v1/health                      → { ok, version, time }
     GET  /v1/vapid                       → { key }  (public VAPID key for pushManager.subscribe)
     POST /v1/register   {platform,…}     → { device, key, code }      new install
     POST /v1/subscribe  {device,key,sub} → { ok }                     save/replace the browser push subscription
     POST /v1/unsubscribe{device,key}     → { ok }
     POST /v1/schedule   {device,key,events:[…]} → { ok, stored, skipped }  replaces all future events
     POST /v1/test       {device,key,delay} → { ok, id }               one test notification
     POST /v1/status     {device,key}     → { device, pending, next[], recent[] }
     POST /v1/ack        {i,a,w}          → { ok }                     from the service worker: shown / clicked / closed
     POST /v1/diag       {code,kind,build,body} → { ok, id }           diagnostic report or error batch
   Cron (every minute): sends every event due in the next 60 s, each at its exact second.            */
import { b64u, vapidKeys, buildPush } from './webpush.js';

export const WORKER_VERSION = '2026.11.19-1';
const MAX_BODY = 512 * 1024, MAX_EVENTS = 1500, MAX_DIAG = 200 * 1024;
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.apple.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.api.chrome.google.com'];
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PER_RUN = 6;    /* free plan: 10 ms CPU and 50 outgoing requests per run; a push is ~1 ms CPU + 1 fetch + 1 D1 batch.
                         One phone needs at most 2–3 in the same minute; more users → raise this on a paid plan or use Queues. */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, code TEXT UNIQUE, key_hash TEXT NOT NULL,
     endpoint TEXT, p256dh TEXT, auth TEXT, platform TEXT, ua TEXT, lang TEXT, tz TEXT, build TEXT,
     created INTEGER, updated INTEGER, last_seen INTEGER, status TEXT DEFAULT 'new', fails INTEGER DEFAULT 0, last_error TEXT)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT NOT NULL, k TEXT NOT NULL, at INTEGER NOT NULL,
     exp INTEGER NOT NULL, ttl INTEGER, payload TEXT, status TEXT DEFAULT 'pending', claimed INTEGER, sent_at INTEGER, http INTEGER,
     shown_at INTEGER, clicked_at INTEGER, closed_at INTEGER, err TEXT)`,
  /* every query the cron runs each minute walks one of these indexes, so it reads only the rows it needs (free plan: 5M reads/day) */
  `CREATE UNIQUE INDEX IF NOT EXISTS ev_key ON events(device, k)`,
  `CREATE INDEX IF NOT EXISTS ev_due ON events(status, at)`,
  `CREATE INDEX IF NOT EXISTS ev_exp ON events(status, exp)`,
  `CREATE TABLE IF NOT EXISTS diag (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, device TEXT, at INTEGER, kind TEXT, build TEXT, body TEXT)`,
  `CREATE INDEX IF NOT EXISTS diag_code ON diag(code, at)`,
  `CREATE INDEX IF NOT EXISTS diag_at ON diag(at)`,
];

/* ---------------- helpers ---------------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const str = (v, n) => (v == null ? null : String(v).slice(0, n));
const int = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
const rnd = n => b64u.enc(crypto.getRandomValues(new Uint8Array(n)));
const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
async function sha256(s) { return b64u.enc(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }

async function readJSON(req) {
  const len = +req.headers.get('content-length') || 0;
  if (len > MAX_BODY) throw new HttpError(413, 'body too large');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'body too large');
  if (!text) return {};
  try { const o = JSON.parse(text); if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0; return o; }
  catch (e) { throw new HttpError(400, 'body must be a JSON object'); }
}

let ready = null, selfSeen = null;
export function resetForTests() { ready = null; selfSeen = null; }
async function init(env) {
  if (!env || !env.DB) throw new HttpError(500, 'database binding DB is missing');
  if (!ready) ready = (async () => {
    await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)));
    const get = async k => (await env.DB.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first()) || null;
    if (!(await get('vapid'))) {
      const v = await vapidKeys();
      await env.DB.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)').bind('vapid', JSON.stringify(v)).run();
    }
    if (!(await get('ack'))) await env.DB.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)').bind('ack', rnd(32)).run();
    const vapid = JSON.parse((await get('vapid')).v), ack = (await get('ack')).v;   /* re-read: another isolate may have won the race */
    return { vapid, ack };
  })().catch(e => { ready = null; throw e; });
  return ready;
}

async function ackToken(secret, id) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u.enc(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('ev:' + id))).slice(0, 12));
}

async function auth(env, body) {
  const id = str(body.device, 64), key = str(body.key, 128);
  if (!id || !key) throw new HttpError(401, 'device and key required');
  const d = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();
  if (!d || d.key_hash !== (await sha256(key))) throw new HttpError(401, 'unknown device');
  await env.DB.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').bind(Date.now(), id).run();
  return d;
}

export function pushHostOK(endpoint) {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h)); } catch (e) { return false; }
}

function cleanEvent(e, now) {
  if (!e || typeof e !== 'object') return null;
  const at = int(e.at); if (at == null || at < now - 60e3 || at > now + 45 * 864e5) return null;
  const t = str(e.t ?? e.title, 140); if (!t) return null;
  const ttl = Math.min(Math.max(int(e.ttl) ?? 900, 60), 86400);
  return { k: str(e.k ?? e.key, 80) || 'ev', at, ttl, p: { t, b: str(e.b ?? e.body, 400) || '', l: str(e.l ?? e.link, 60) || '', k: str(e.kind, 20) || '', s: e.s === 'silent' ? 'silent' : 'on', g: str(e.g ?? e.tag, 60) || '' } };
}

/* ---------------- sending ---------------- */
async function sendOne(env, keys, row, fetchImpl) {
  const payload = JSON.parse(row.payload || '{}');
  payload.i = row.id; payload.a = await ackToken(keys.ack, row.id); payload.ts = row.at;
  if (keys.self) payload.u = keys.self;   /* where the service worker sends 'shown' / 'clicked' */
  let http = 0, err = null;
  try {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    const req = await buildPush(sub, JSON.stringify(payload), keys.vapid, { subject: env.SUBJECT || 'https://barzandh.github.io/alquran/', ttl: row.ttl || 900 });
    const res = await (fetchImpl || fetch)(req.url, { ...req.init, signal: AbortSignal.timeout(10e3) });
    http = res.status;
    if (http >= 400) err = (await res.text().catch(() => '')).slice(0, 300) || 'HTTP ' + http;
  } catch (e) { err = (e && (e.name + ': ' + e.message)) || String(e); }
  const ok = http >= 200 && http < 300, gone = http === 404 || http === 410;
  const stmts = [env.DB.prepare('UPDATE events SET status = ?, sent_at = ?, http = ?, err = ? WHERE id = ?').bind(ok ? 'sent' : 'failed', Date.now(), http || null, err, row.id)];
  if (gone) stmts.push(env.DB.prepare("UPDATE devices SET status = 'gone', last_error = ?, updated = ? WHERE id = ?").bind('subscription expired (HTTP ' + http + ')', Date.now(), row.device));
  else if (ok) stmts.push(env.DB.prepare('UPDATE devices SET fails = 0 WHERE id = ? AND fails > 0').bind(row.device));
  else stmts.push(env.DB.prepare('UPDATE devices SET fails = fails + 1, last_error = ? WHERE id = ?').bind(err, row.device));
  await env.DB.batch(stmts);
  return { id: row.id, http, ok, err };
}

export async function runCron(env, opts = {}) {
  const keys = await init(env), now = opts.now ?? Date.now(), wait = opts.sleep ?? sleep;
  /* recover rows a crashed run left in 'sending'; drop ones too late to matter */
  await env.DB.batch([
    env.DB.prepare("UPDATE events SET status = 'pending', claimed = NULL WHERE status = 'sending' AND claimed < ?").bind(now - 5 * 6e4),
    env.DB.prepare("UPDATE events SET status = 'expired' WHERE status = 'pending' AND exp < ?").bind(now),
  ]);
  const claimed = await env.DB.prepare(
    `UPDATE events SET status = 'sending', claimed = ?1 WHERE id IN (
       SELECT e.id FROM events e JOIN devices d ON d.id = e.device
       WHERE e.status = 'pending' AND e.at <= ?2 AND d.status = 'active' AND d.endpoint IS NOT NULL
       ORDER BY e.at LIMIT ?3) RETURNING id`).bind(now, now + 60e3, PER_RUN).all();
  const ids = (claimed.results || []).map(r => r.id);
  let results = [];
  if (ids.length) {
    const self = await env.DB.prepare("SELECT v FROM meta WHERE k = 'self'").first();
    keys.self = self ? self.v : null;
    const rows = (await env.DB.prepare(`SELECT e.*, d.endpoint, d.p256dh, d.auth FROM events e JOIN devices d ON d.id = e.device WHERE e.id IN (${ids.map(() => '?').join(',')}) ORDER BY e.at`).bind(...ids).all()).results || [];
    /* start each push at its own second, in time order; sends overlap so a slow push service can't delay the next one */
    const jobs = [];
    for (const row of rows) { await wait(row.at - (opts.clock ? opts.clock() : Date.now())); jobs.push(sendOne(env, keys, row, opts.fetch)); }
    results = await Promise.all(jobs);
  }
  if (opts.prune || new Date(now).getUTCMinutes() === 7) {     const old = now - 14 * 864e5;
    await env.DB.batch([
      ...['sent', 'failed', 'expired'].map(st => env.DB.prepare('DELETE FROM events WHERE status = ? AND at < ?').bind(st, old)),
      env.DB.prepare('DELETE FROM diag WHERE at < ?').bind(now - 60 * 864e5),
    ]);
  }
  return { claimed: ids.length, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}

/* ---------------- routes ---------------- */
const ROUTES = {
  'GET /v1/health': async (req, env) => { const k = await init(env); return { ok: true, version: WORKER_VERSION, time: Date.now(), push: !!k.vapid }; },
  'GET /v1/vapid': async (req, env) => ({ key: (await init(env)).vapid.publicKey }),

  'POST /v1/register': async (req, env, body) => {
    await init(env);
    const id = rnd(16), key = rnd(24), now = Date.now();
    for (let tries = 0; tries < 6; tries++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_ABC[b % CODE_ABC.length]).join('');
      try {
        await env.DB.prepare('INSERT INTO devices (id, code, key_hash, platform, ua, lang, tz, build, created, updated, last_seen, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id, code, await sha256(key), str(body.platform, 40), str(req.headers.get('user-agent'), 300), str(body.lang, 8), str(body.tz, 64), str(body.build, 40), now, now, now, 'new').run();
        return { device: id, key, code };
      } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
    }
    throw new HttpError(500, 'could not create a device code');
  },

  'POST /v1/subscribe': async (req, env, body) => {
    const d = await auth(env, body), s = body.sub;
    if (!s || typeof s !== 'object' || typeof s.endpoint !== 'string' || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') throw new HttpError(400, 'sub must be PushSubscription.toJSON()');
    if (!pushHostOK(s.endpoint)) throw new HttpError(400, 'unknown push service: ' + (() => { try { return new URL(s.endpoint).hostname; } catch (e) { return 'bad URL'; } })());
    if (b64u.dec(s.keys.p256dh).length !== 65 || b64u.dec(s.keys.auth).length !== 16) throw new HttpError(400, 'bad subscription keys');
    await env.DB.prepare("UPDATE devices SET endpoint = ?, p256dh = ?, auth = ?, status = 'active', fails = 0, last_error = NULL, updated = ?, platform = COALESCE(?, platform), lang = COALESCE(?, lang), tz = COALESCE(?, tz), build = COALESCE(?, build) WHERE id = ?")
      .bind(s.endpoint, s.keys.p256dh, s.keys.auth, Date.now(), str(body.platform, 40), str(body.lang, 8), str(body.tz, 64), str(body.build, 40), d.id).run();
    return { ok: true };
  },

  'POST /v1/unsubscribe': async (req, env, body) => {
    const d = await auth(env, body);
    await env.DB.batch([
      env.DB.prepare("UPDATE devices SET status = 'off', endpoint = NULL, p256dh = NULL, auth = NULL, updated = ? WHERE id = ?").bind(Date.now(), d.id),
      env.DB.prepare("DELETE FROM events WHERE device = ? AND status = 'pending'").bind(d.id),
    ]);
    return { ok: true };
  },

  /* Sync = diff, not delete-and-reinsert: only changed rows are written (free plan: 100k writes/day). */
  'POST /v1/schedule': async (req, env, body) => {
    const d = await auth(env, body), now = Date.now();
    if (!Array.isArray(body.events)) throw new HttpError(400, 'events must be an array');
    if (body.events.length > MAX_EVENTS) throw new HttpError(413, 'too many events (max ' + MAX_EVENTS + ')');
    const old = new Map(((await env.DB.prepare('SELECT id, k, at, ttl, payload, status FROM events WHERE device = ? AND (status = ? OR at > ?)').bind(d.id, 'pending', now - 864e5).all()).results || []).map(r => [r.k, r]));
    const want = new Map(); let skipped = 0;
    for (const raw of body.events) { const e = cleanEvent(raw, now); if (!e || want.has(e.k)) { skipped++; continue; } want.set(e.k, e); }
    const stmts = [], add = [];
    let same = 0, changed = 0, removed = 0;
    for (const [k, r] of old) if (r.status === 'pending' && !want.has(k)) { stmts.push(env.DB.prepare('DELETE FROM events WHERE id = ?').bind(r.id)); removed++; }
    for (const [k, e] of want) {
      const r = old.get(k), p = JSON.stringify(e.p);
      if (!r) add.push(e);
      else if (r.status !== 'pending') skipped++;   /* already sent: never send twice */
      else if (r.at === e.at && r.ttl === e.ttl && r.payload === p) same++;
      else { stmts.push(env.DB.prepare('UPDATE events SET at = ?, exp = ?, ttl = ?, payload = ? WHERE id = ?').bind(e.at, e.at + e.ttl * 1000, e.ttl, p, r.id)); changed++; }
    }
    for (let i = 0; i < add.length; i += 12) {
      const part = add.slice(i, i + 12);
      stmts.push(env.DB.prepare('INSERT INTO events (device, k, at, exp, ttl, payload) VALUES ' + part.map(() => '(?,?,?,?,?,?)').join(','))
        .bind(...part.flatMap(e => [d.id, e.k, e.at, e.at + e.ttl * 1000, e.ttl, JSON.stringify(e.p)])));
    }
    stmts.push(env.DB.prepare('UPDATE devices SET updated = ?, tz = COALESCE(?, tz), lang = COALESCE(?, lang), build = COALESCE(?, build) WHERE id = ?').bind(now, str(body.tz, 64), str(body.lang, 8), str(body.build, 40), d.id));
    await env.DB.batch(stmts);
    const pend = [...want.values()].filter(e => !old.has(e.k) || old.get(e.k).status === 'pending');
    return { ok: true, total: pend.length, added: add.length, changed, same, removed, skipped, next: pend.length ? Math.min(...pend.map(e => e.at)) : null, active: d.status === 'active' };
  },

  'POST /v1/test': async (req, env, body, ctx) => {
    const d = await auth(env, body), keys = { ...(await init(env)), self: new URL(req.url).origin };
    if (d.status !== 'active' || !d.endpoint) throw new HttpError(409, 'this device has no push subscription (status: ' + d.status + ')');
    const delay = Math.min(Math.max(int(body.delay) ?? 0, 0), 600) * 1000, at = Date.now() + delay;
    const p = { t: str(body.t, 140) || '🔔 AlQuran test', b: str(body.b, 400) || 'Notifications work ✓', l: 'reminders', k: 'test', s: body.s === 'silent' ? 'silent' : 'on', g: 'test' };
    const r = await env.DB.prepare("INSERT INTO events (device, k, at, exp, ttl, payload, status, claimed) VALUES (?,?,?,?,?,?,?,?) RETURNING id")
      .bind(d.id, 'test:' + at + ':' + rnd(3), at, at + 600e3, 600, JSON.stringify(p), delay <= 25e3 ? 'sending' : 'pending', delay <= 25e3 ? Date.now() : null).first();
    if (delay <= 25e3) {   /* short delays are sent from this request; longer ones by the cron */
      const job = (async () => { await sleep(delay); return sendOne(env, keys, { id: r.id, device: d.id, k: 'test', at, ttl: 600, payload: JSON.stringify(p), endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth }, ctx && ctx.fetch); })();
      if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
    }
    return { ok: true, id: r.id, at };
  },

  'POST /v1/status': async (req, env, body) => {
    const d = await auth(env, body), now = Date.now();
    const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then(r => r.results || []);
    const [cnt] = await q("SELECT COUNT(*) AS n FROM events WHERE device = ? AND status = 'pending'", d.id);
    const next = await q("SELECT id, k, at, payload FROM events WHERE device = ? AND status = 'pending' ORDER BY at LIMIT 5", d.id);
    const recent = await q("SELECT id, k, at, status, sent_at, http, shown_at, clicked_at, err, payload FROM events WHERE device = ? AND status != 'pending' ORDER BY at DESC LIMIT 12", d.id);
    const brief = r => { let p = {}; try { p = JSON.parse(r.payload); } catch (e) {} const o = { ...r, t: p.t }; delete o.payload; return o; };
    return { now, device: { code: d.code, status: d.status, fails: d.fails, last_error: d.last_error, updated: d.updated, has_sub: !!d.endpoint }, pending: cnt ? cnt.n : 0, next: next.map(brief), recent: recent.map(brief), version: WORKER_VERSION };
  },

  'POST /v1/ack': async (req, env, body) => {
    const keys = await init(env), id = int(body.i), w = body.w;
    if (!id || !['shown', 'clicked', 'closed'].includes(w)) throw new HttpError(400, 'i and w required');
    if (str(body.a, 40) !== (await ackToken(keys.ack, id))) throw new HttpError(403, 'bad ack token');
    await env.DB.prepare(`UPDATE events SET ${w}_at = COALESCE(${w}_at, ?) WHERE id = ?`).bind(int(body.ts) || Date.now(), id).run();
    return { ok: true };
  },

  'POST /v1/diag': async (req, env, body) => {
    await init(env);
    const code = (str(body.code, 12) || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ANON';
    const text = JSON.stringify(body.body ?? null);
    if (text.length > MAX_DIAG) throw new HttpError(413, 'report too large');
    const [{ n } = { n: 0 }] = (await env.DB.prepare('SELECT COUNT(*) AS n FROM diag WHERE code = ? AND at > ?').bind(code, Date.now() - 864e5).all()).results || [];
    if (n >= 400) throw new HttpError(429, 'too many reports today');
    const r = await env.DB.prepare('INSERT INTO diag (code, device, at, kind, build, body) VALUES (?,?,?,?,?,?) RETURNING id')
      .bind(code, str(body.device, 64), Date.now(), str(body.kind, 20) || 'report', str(body.build, 40), text).first();
    return { ok: true, id: r.id };
  },
};

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const route = ROUTES[req.method + ' ' + url.pathname.replace(/\/+$/, '')];
  if (!route) return json({ error: 'not found' }, 404);
  try {
    const body = req.method === 'POST' ? await readJSON(req) : {};
    const out = await route(req, env, body, ctx);
    if (selfSeen !== url.origin) { await env.DB.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('self', ?)").bind(url.origin).run(); selfSeen = url.origin; }
    return json(out);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) {   /* server bugs land in the same diagnostics table the app reports to */
      try { await env.DB.prepare('INSERT INTO diag (code, at, kind, build, body) VALUES (?,?,?,?,?)').bind('WORKER', Date.now(), 'worker-error', WORKER_VERSION, JSON.stringify({ route: url.pathname, error: String(e && e.stack || e) }).slice(0, 8000)).run(); } catch (x) {}
    }
    return json({ error: status === 500 ? 'server error: ' + (e && e.message) : e.message }, status);
  }
}

export default {
  fetch: (req, env, ctx) => handle(req, env, ctx),
  scheduled: (ev, env, ctx) => ctx.waitUntil(runCron(env).catch(async e => {
    try { await env.DB.prepare('INSERT INTO diag (code, at, kind, build, body) VALUES (?,?,?,?,?)').bind('WORKER', Date.now(), 'cron-error', WORKER_VERSION, JSON.stringify({ error: String(e && e.stack || e) }).slice(0, 8000)).run(); } catch (x) {}
    throw e;
  })),
};
