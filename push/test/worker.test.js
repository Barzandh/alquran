import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeD1 } from './d1mock.js';
import worker, { handle, runCron, resetForTests, pushHostOK } from '../src/index.js';
import { b64u } from '../src/webpush.js';

const PY = fileURLToPath(new URL('./pydecode.py', import.meta.url));
const py = req => JSON.parse(execFileSync('python3', [PY], { input: JSON.stringify(req) }).toString());

/* ---------- a fake push service that decrypts with the browser's private key, like a real phone ---------- */
const te = new TextEncoder();
async function hm(k, d) { const key = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', key, d)); }
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const kdf = async (salt, ikm, info, n) => (await hm(await hm(salt, ikm), cat(info, new Uint8Array([1])))).slice(0, n);
async function phoneDecrypt(body, phone) {
  const salt = body.slice(0, 16), asPub = body.slice(21, 86), ct = body.slice(86);
  const priv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: phone.d, x: b64u.enc(b64u.dec(phone.p256dh).slice(1, 33)), y: b64u.enc(b64u.dec(phone.p256dh).slice(33)) }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const pub = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256));
  const ikm = await kdf(b64u.dec(phone.auth), sh, cat(te.encode('WebPush: info\0'), b64u.dec(phone.p256dh), asPub), 32);
  const cek = await kdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await kdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
  return JSON.parse(new TextDecoder().decode(pt.slice(0, pt.lastIndexOf(2))));
}
function pushService(phones, clockRef) {
  const got = [], answer = { status: 201 };
  const fetch = async (url, init) => {
    const at = clockRef.t, run = clockRef.run;
    const ph = phones.get(url);
    if (!ph) return new Response('no such subscription', { status: 404 });
    if (answer.status !== 201) return new Response('nope', { status: answer.status });
    assert.equal(init.headers['Content-Encoding'], 'aes128gcm');
    got.push({ url, at, run, headers: init.headers, msg: await phoneDecrypt(init.body, ph) });
    return new Response('', { status: 201 });
  };
  return { fetch, got, answer };
}

let env, clock;
beforeEach(() => { resetForTests(); env = { DB: makeD1(), SUBJECT: 'https://barzandh.github.io/alquran/' }; clock = { t: Date.now() }; });

const call = async (method, path, body, ctx) => {
  const res = await handle(new Request('https://w.test' + path, { method, headers: { 'Content-Type': 'text/plain' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), env, ctx);
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), json: await res.json().catch(() => null) };
};
async function newPhone(host = 'https://fcm.googleapis.com/fcm/send/') {
  const reg = await call('POST', '/v1/register', { platform: 'android', lang: 'ar', tz: 'Asia/Baghdad', build: 't1' });
  assert.equal(reg.status, 200, JSON.stringify(reg.json));
  const k = py({ op: 'keys' }), endpoint = host + b64u.enc(crypto.getRandomValues(new Uint8Array(12)));
  const s = await call('POST', '/v1/subscribe', { device: reg.json.device, key: reg.json.key, sub: { endpoint, keys: { p256dh: k.p256dh, auth: k.auth } } });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  return { ...reg.json, endpoint, phone: { ...k } };
}
/* run the cron once per virtual minute; the fake sleep doesn't wait, it moves the virtual clock to the time asked for */
async function simulate(svc, fromMs, minutes) {
  let cpu = 0, worst = 0;
  for (let m = 0; m < minutes; m++) {
    const now = fromMs + m * 6e4;
    clock.t = now; clock.run = now; clock.sleeps = clock.sleeps || [];
    const c0 = process.cpuUsage();
    await runCron(env, { now, clock: () => clock.t, sleep: async ms => { if (ms > 0) { clock.t += ms; clock.sleeps.push(clock.t); } }, fetch: svc.fetch });
    const c = process.cpuUsage(c0), ms = (c.user + c.system) / 1000; cpu += ms; worst = Math.max(worst, ms);
  }
  return { cpu, worst };
}

test('register gives a device id, secret key and a 6-letter code; health and vapid work; CORS is open', async () => {
  const h = await call('GET', '/v1/health'); assert.equal(h.status, 200); assert.equal(h.json.ok, true); assert.equal(h.cors, '*');
  const v = await call('GET', '/v1/vapid'); assert.equal(b64u.dec(v.json.key).length, 65);
  const v2 = await call('GET', '/v1/vapid'); assert.equal(v2.json.key, v.json.key, 'VAPID key must stay the same');
  const r = await call('POST', '/v1/register', {}); assert.match(r.json.code, /^[A-HJ-NP-Z2-9]{6}$/); assert.ok(r.json.device && r.json.key);
  const row = env.DB.raw.prepare('SELECT key_hash FROM devices').get(); assert.notEqual(row.key_hash, r.json.key, 'only a hash of the key is stored');
  const o = await handle(new Request('https://w.test/v1/schedule', { method: 'OPTIONS' }), env); assert.equal(o.status, 204);
});

test('a simulated week: every reminder arrives once, at its exact second, decrypted correctly', async () => {
  const svc = pushService(new Map(), clock), p = await newPhone();
  const phones = new Map([[p.endpoint, p.phone]]); Object.assign(svc, pushService(phones, clock));
  const start = Math.ceil(clock.t / 6e4) * 6e4, events = [];
  for (let d = 0; d < 7; d++) for (const [i, name] of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].entries()) {
    const at = start + d * 864e5 + (4 + i * 3.5) * 36e5 + 17e3 + i * 1111;   /* odd seconds on purpose */
    events.push({ k: `p-${name}@${d}`, at, t: '🕌 ' + name, b: 'حان وقت صلاة ' + name, l: 'prayer', kind: 'prayer', s: 'on' });
    events.push({ k: `pre-${name}@${d}`, at: at - 10 * 6e4, t: '⏰ ' + name + ' in 10 min', b: '', l: 'prayer', kind: 'prayer', s: 'silent' });
  }
  const s = await call('POST', '/v1/schedule', { device: p.device, key: p.key, events });
  assert.equal(s.status, 200); assert.equal(s.json.added, 70); assert.equal(s.json.next, Math.min(...events.map(e => e.at)));
  const writes0 = env.DB.meter.writes, reads0 = env.DB.meter.reads;
  const { cpu, worst } = await simulate(svc, start, 7 * 1440 + 10);
  assert.equal(svc.got.length, 70, 'every event delivered');
  for (const e of events) {
    const g = svc.got.filter(x => x.msg.t === e.t && x.msg.ts === e.at);
    assert.equal(g.length, 1, 'exactly once: ' + e.k);
    /* exact second: the cron that sent it ran within the minute before, and slept until exactly e.at */
    assert.ok(g[0].run <= e.at && e.at - g[0].run <= 60e3, 'sent by the right cron run: ' + e.k);
    assert.ok(clock.sleeps.includes(e.at) || e.at === g[0].run, 'woke at its exact time: ' + e.k);
    assert.equal(g[0].msg.b, e.b); assert.equal(g[0].msg.s, e.s); assert.equal(g[0].msg.l, 'prayer');
    assert.ok(Number.isInteger(g[0].msg.i) && typeof g[0].msg.a === 'string', 'carries id + ack token');
    assert.equal(g[0].msg.u, 'https://w.test', 'carries the ack address');
  }
  /* free-plan budget for one phone for a week */
  const reads = env.DB.meter.reads - reads0, writes = env.DB.meter.writes - writes0;
  console.log(`  week: ${reads} rows read, ${writes} rows written, cron CPU total ${cpu.toFixed(0)} ms, worst run ${worst.toFixed(1)} ms`);
  assert.ok(reads / 7 < 50_000, 'reads/day far below 5M');
  assert.ok(writes / 7 < 2_000, 'writes/day far below 100k');
});

test('resync is a diff: unchanged rows untouched, edits updated, removed ones deleted, sent ones never resent', async () => {
  const p = await newPhone(), phones = new Map([[p.endpoint, p.phone]]), svc = pushService(phones, clock);
  const t0 = Math.ceil(clock.t / 6e4) * 6e4 + 6e4;
  const ev = i => ({ k: 'e' + i, at: t0 + i * 6e4, t: 'E' + i, b: 'b', kind: 'azkar' });
  const all = Array.from({ length: 10 }, (_, i) => ev(i));
  assert.equal((await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: all })).json.added, 10);
  const w0 = env.DB.meter.writes;
  const same = await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: all });
  assert.equal(same.json.same, 10); assert.equal(same.json.added, 0);
  assert.ok(env.DB.meter.writes - w0 <= 2, 'identical resync writes ~nothing');
  const edited = all.map((e, i) => i === 3 ? { ...e, t: 'E3 edited', at: e.at + 30e3 } : e).filter((e, i) => i !== 5);
  const r = await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: edited });
  assert.equal(r.json.changed, 1); assert.equal(r.json.removed, 1); assert.equal(r.json.same, 8);
  const titlesInOrder = () => svc.got.slice().sort((a, b) => a.msg.ts - b.msg.ts).map(g => g.msg.t);
  await simulate(svc, t0, 2);   /* e0..e2 go out (the run at t0+1min also covers e2 at t0+2min) */
  assert.deepEqual(titlesInOrder(), ['E0', 'E1', 'E2']);
  const again = await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: edited });   /* phone resyncs with old copies */
  assert.equal(again.json.skipped, 3, 'the 3 already sent are skipped'); assert.equal(again.json.same, 6);
  await simulate(svc, t0 + 2 * 6e4, 12);
  const titles = titlesInOrder();
  assert.deepEqual(titles, ['E0', 'E1', 'E2', 'E3 edited', 'E4', 'E6', 'E7', 'E8', 'E9']);
  assert.equal(svc.got.find(g => g.msg.t === 'E3 edited').msg.ts, t0 + 3 * 6e4 + 30e3);
  assert.ok(clock.sleeps.includes(t0 + 3 * 6e4 + 30e3), 'edited time honoured to the second');
  const empty = await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: [] });   /* "mute all" */
  assert.equal(empty.json.total, 0);
});

test('expired subscription (410) marks the device gone and stops sending; resubscribe revives it', async () => {
  const p = await newPhone(), svc = pushService(new Map([[p.endpoint, p.phone]]), clock);
  const t0 = Math.ceil(clock.t / 6e4) * 6e4 + 6e4;
  await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: [0, 1, 2].map(i => ({ k: 'x' + i, at: t0 + i * 6e4, t: 'X' + i })) });
  svc.answer.status = 410;
  await simulate(svc, t0, 1);
  const st = await call('POST', '/v1/status', { device: p.device, key: p.key });
  assert.equal(st.json.device.status, 'gone'); assert.equal(st.json.recent[0].http, 410);
  svc.answer.status = 201;
  await simulate(svc, t0 + 6e4, 3);
  assert.equal(svc.got.length, 0, 'nothing sent to a dead subscription');
  await call('POST', '/v1/subscribe', { device: p.device, key: p.key, sub: { endpoint: p.endpoint, keys: { p256dh: p.phone.p256dh, auth: p.phone.auth } } });
  await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: [{ k: 'y', at: t0 + 5 * 6e4, t: 'Y' }] });
  await simulate(svc, t0 + 4 * 6e4, 2);
  assert.deepEqual(svc.got.map(g => g.msg.t), ['Y']);
});

test('push service errors (500, timeout) are recorded, not retried forever; device keeps working', async () => {
  const p = await newPhone(), svc = pushService(new Map([[p.endpoint, p.phone]]), clock);
  const t0 = Math.ceil(clock.t / 6e4) * 6e4 + 6e4;
  await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: [{ k: 'a', at: t0, t: 'A' }, { k: 'b', at: t0 + 6e4, t: 'B' }] });
  const boom = { fetch: async () => { throw new TypeError('Network connection lost.'); } };
  await runCron(env, { now: t0 - 1000, clock: () => t0, sleep: async () => {}, fetch: boom.fetch });
  const st = await call('POST', '/v1/status', { device: p.device, key: p.key });
  assert.equal(st.json.recent[0].status, 'failed'); assert.match(st.json.recent[0].err, /Network connection lost/);
  assert.equal(st.json.device.status, 'active'); assert.equal(st.json.device.fails, 1);
  await simulate(svc, t0 + 6e4, 1);
  assert.deepEqual(svc.got.map(g => g.msg.t), ['B']);
  assert.equal((await call('POST', '/v1/status', { device: p.device, key: p.key })).json.device.fails, 0);
});

test('cron missed for an hour: stale reminders expire instead of arriving late; stuck rows recover', async () => {
  const p = await newPhone(), svc = pushService(new Map([[p.endpoint, p.phone]]), clock);
  const t0 = Math.ceil(clock.t / 6e4) * 6e4 + 6e4;
  await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: [{ k: 'old', at: t0, t: 'Old', ttl: 900 }, { k: 'new', at: t0 + 3600e3, t: 'New' }] });
  env.DB.raw.prepare("UPDATE events SET status='sending', claimed=? WHERE k='new'").run(t0 - 3600e3);   /* a crashed run */
  await simulate(svc, t0 + 3600e3, 1);
  assert.deepEqual(svc.got.map(g => g.msg.t), ['New']);
  const st = await call('POST', '/v1/status', { device: p.device, key: p.key });
  assert.equal(st.json.recent.find(r => r.k === 'old').status, 'expired');
});

test('two phones are independent; one cannot touch the other', async () => {
  const a = await newPhone(), b = await newPhone('https://web.push.apple.com/');
  const svc = pushService(new Map([[a.endpoint, a.phone], [b.endpoint, b.phone]]), clock);
  const t0 = Math.ceil(clock.t / 6e4) * 6e4 + 6e4;
  await call('POST', '/v1/schedule', { device: a.device, key: a.key, events: [{ k: 'p', at: t0, t: 'A-Fajr' }] });
  await call('POST', '/v1/schedule', { device: b.device, key: b.key, events: [{ k: 'p', at: t0, t: 'B-Fajr' }] });
  const bad = await call('POST', '/v1/schedule', { device: a.device, key: b.key, events: [] });
  assert.equal(bad.status, 401);
  await simulate(svc, t0, 1);
  assert.deepEqual(svc.got.map(g => [g.url, g.msg.t]).sort(), [[a.endpoint, 'A-Fajr'], [b.endpoint, 'B-Fajr']].sort());
});

test('test notification: immediate, and delayed via waitUntil', async () => {
  const p = await newPhone(), svc = pushService(new Map([[p.endpoint, p.phone]]), clock);
  const r = await call('POST', '/v1/test', { device: p.device, key: p.key }, { fetch: svc.fetch });
  assert.equal(r.status, 200); assert.equal(svc.got.length, 1); assert.equal(svc.got[0].msg.k, 'test'); assert.equal(svc.got[0].msg.u, 'https://w.test', 'test push carries the receipt address too');
  const jobs = [], r2 = await call('POST', '/v1/test', { device: p.device, key: p.key, delay: 0.05 }, { fetch: svc.fetch, waitUntil: j => jobs.push(j) });
  assert.equal(r2.status, 200); await Promise.all(jobs); assert.equal(svc.got.length, 2);
  const r3 = await call('POST', '/v1/test', { device: p.device, key: p.key, delay: 120 });   /* long delay → cron */
  assert.equal(r3.status, 200);
  await simulate(svc, r3.json.at - 30e3, 2); assert.equal(svc.got.length, 3); assert.ok(clock.sleeps.includes(r3.json.at));
  const reg = await call('POST', '/v1/register', {});
  assert.equal((await call('POST', '/v1/test', { device: reg.json.device, key: reg.json.key })).status, 409, 'no subscription yet → clear 409');
});

test('ack: shown / clicked recorded only with the right token', async () => {
  const p = await newPhone(), svc = pushService(new Map([[p.endpoint, p.phone]]), clock);
  await call('POST', '/v1/test', { device: p.device, key: p.key }, { fetch: svc.fetch });
  const m = svc.got[0].msg;
  assert.equal((await call('POST', '/v1/ack', { i: m.i, a: 'forged', w: 'shown' })).status, 403);
  assert.equal((await call('POST', '/v1/ack', { i: m.i, a: m.a, w: 'deleted' })).status, 400);
  assert.equal((await call('POST', '/v1/ack', { i: m.i, a: m.a, w: 'shown', ts: 1234 })).status, 200);
  assert.equal((await call('POST', '/v1/ack', { i: m.i, a: m.a, w: 'clicked' })).status, 200);
  const row = env.DB.raw.prepare('SELECT shown_at, clicked_at FROM events WHERE id=?').get(m.i);
  assert.equal(row.shown_at, 1234); assert.ok(row.clicked_at > 0);
});

test('diagnostics: stored by code, size and rate limited, worker errors land there too', async () => {
  const r = await call('POST', '/v1/diag', { code: 'k7q-4mx', kind: 'report', build: 'b1', body: { ua: 'x', errors: [{ msg: 'TypeError: x is undefined' }] } });
  assert.equal(r.status, 200);
  const row = env.DB.raw.prepare("SELECT code, kind, body FROM diag WHERE id=?").get(r.json.id);
  assert.equal(row.code, 'K7Q4MX'); assert.match(row.body, /TypeError/);
  assert.equal((await call('POST', '/v1/diag', { code: 'A', body: 'x'.repeat(210 * 1024) })).status, 413);
  for (let i = 0; i < 399; i++) env.DB.raw.prepare("INSERT INTO diag (code, at, kind, body) VALUES ('SPAM', ?, 'auto', '1')").run(Date.now());
  assert.equal((await call('POST', '/v1/diag', { code: 'SPAM', body: 1 })).status, 200);
  assert.equal((await call('POST', '/v1/diag', { code: 'SPAM', body: 1 })).status, 429);
  /* a server bug: break the database mid-request */
  const brokenEnv = env; const realPrep = env.DB.prepare;
  env.DB.prepare = sql => { if (/FROM devices WHERE id/.test(sql)) throw new Error('D1 exploded'); return realPrep(sql); };
  const e = await call('POST', '/v1/status', { device: 'x', key: 'y' });
  env.DB.prepare = realPrep;
  assert.equal(e.status, 500); assert.match(e.json.error, /D1 exploded/);
  const w = brokenEnv.DB.raw.prepare("SELECT body FROM diag WHERE code='WORKER'").get(); assert.match(w.body, /D1 exploded/);
});

test('hostile and broken input: always a clean 4xx with a message, never a crash or a TypeError 500', async () => {
  const p = await newPhone();
  const cases = [
    ['POST', '/v1/schedule', 'not json', 400], ['POST', '/v1/schedule', '[1,2]', 400], ['POST', '/v1/schedule', 'null', 400],
    ['POST', '/v1/schedule', {}, 401], ['POST', '/v1/schedule', { device: p.device }, 401],
    ['POST', '/v1/schedule', { device: p.device, key: p.key }, 400], ['POST', '/v1/schedule', { device: p.device, key: p.key, events: 'x' }, 400],
    ['POST', '/v1/schedule', { device: p.device, key: p.key, events: new Array(1501).fill({}) }, 413],
    ['POST', '/v1/subscribe', { device: p.device, key: p.key }, 400],
    ['POST', '/v1/subscribe', { device: p.device, key: p.key, sub: { endpoint: 'https://evil.example/x', keys: { p256dh: p.phone.p256dh, auth: p.phone.auth } } }, 400],
    ['POST', '/v1/subscribe', { device: p.device, key: p.key, sub: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'abc', auth: p.phone.auth } } }, 400],
    ['POST', '/v1/subscribe', { device: p.device, key: p.key, sub: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 5, auth: null } } }, 400],
    ['POST', '/v1/ack', {}, 400], ['POST', '/v1/ack', { i: 'abc', w: 'shown' }, 400],
    ['GET', '/v1/schedule', undefined, 404], ['POST', '/nope', {}, 404], ['POST', '/v1/register', 'x'.repeat(600 * 1024), 413],
  ];
  for (const [m, path, body, want] of cases) {
    const r = await call(m, path, body);
    assert.equal(r.status, want, `${m} ${path} ${String(JSON.stringify(body)).slice(0, 60)} → ${r.status} ${JSON.stringify(r.json)}`);
    assert.ok(r.json && typeof r.json.error === 'string');
  }
  /* junk inside the events array is skipped, good ones kept; undefined/objects never reach the database */
  const t = Date.now() + 6e5;
  const r = await call('POST', '/v1/schedule', { device: p.device, key: p.key, events: [null, 5, 'x', {}, { at: 'soon', t: 'x' }, { at: t }, { at: t, t: { o: 1 }, b: ['a'], l: 7, kind: null }, { at: Date.now() - 864e5, t: 'old' }, { at: t + 1e12, t: 'far' }, { k: 'ok', at: t, t: 'OK' }] });
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.added, 2); assert.equal(r.json.skipped, 8);
  assert.equal(pushHostOK('https://fcm.googleapis.com.evil.com/x'), false);
  assert.equal(pushHostOK('https://web.push.apple.com/x'), true);
  assert.equal(pushHostOK('http://fcm.googleapis.com/x'), false);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM diag WHERE code='WORKER'").get().n, 0, 'no server errors from any of this');
});

test('missing database binding gives a readable error, and the scheduled() entry point works', async () => {
  resetForTests();
  const r = await handle(new Request('https://w.test/v1/health'), {}, {});
  assert.equal(r.status, 500); assert.match((await r.json()).error, /binding DB is missing/);
  resetForTests();
  const jobs = []; worker.scheduled({ scheduledTime: Date.now() }, env, { waitUntil: j => jobs.push(j) });
  const out = await jobs[0]; assert.equal(out.claimed, 0);
});

test('every query the cron runs each minute uses an index (so D1 reads stay tiny on the free plan)', async () => {
  await call('GET', '/v1/health');
  const plan = sql => env.DB.raw.prepare('EXPLAIN QUERY PLAN ' + sql).all().map(r => r.detail).join(' | ');
  const q = [
    "UPDATE events SET status = 'pending', claimed = NULL WHERE status = 'sending' AND claimed < 1",
    "UPDATE events SET status = 'expired' WHERE status = 'pending' AND exp < 1",
    `UPDATE events SET status = 'sending', claimed = 1 WHERE id IN (SELECT e.id FROM events e JOIN devices d ON d.id = e.device WHERE e.status = 'pending' AND e.at <= 2 AND d.status = 'active' AND d.endpoint IS NOT NULL ORDER BY e.at LIMIT 6) RETURNING id`,
    "DELETE FROM events WHERE status = 'sent' AND at < 1",
    'DELETE FROM diag WHERE at < 1',
    "SELECT COUNT(*) AS n FROM diag WHERE code = 'X' AND at > 1",
    "SELECT id, k, at, ttl, payload, status FROM events WHERE device = 'x' AND (status = 'pending' OR at > 1)",
  ];
  for (const sql of q) { const p = plan(sql); assert.doesNotMatch(p, /SCAN (events|diag)\b(?! USING)/, sql + '\n  → ' + p); }
});

test('no promise is shared between requests (Cloudflare forbids settling one request\'s promise in another)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const globals = [...src.matchAll(/^let ([^;]+);/gm)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s*=/)[0]));
  assert.ok(globals.length, 'found module-level variables');
  for (const g of globals) assert.doesNotMatch(src, new RegExp('\\b' + g + '\\s*=\\s*(\\(async|[^;\\n]*\\.then\\(|new Promise)'), `module-level "${g}" must hold values, not promises`);
  /* and overlapping first requests on a cold isolate all succeed */
  resetForTests();
  const rs = await Promise.all([call('POST', '/v1/register', {}), call('GET', '/v1/vapid'), call('POST', '/v1/register', {}), call('GET', '/v1/health')]);
  assert.deepEqual(rs.map(r => r.status), [200, 200, 200, 200]);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM meta WHERE k IN ('vapid','ack')").get().n, 2);
});
