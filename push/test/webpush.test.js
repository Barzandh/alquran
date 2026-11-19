import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encrypt, buildPush, vapidKeys, vapidHeader, b64u, rawToJwk } from '../src/webpush.js';

const PY = fileURLToPath(new URL('./pydecode.py', import.meta.url));
const py = req => JSON.parse(execFileSync('python3', [PY], { input: JSON.stringify(req) }).toString());

test('RFC 8291 Appendix A test vector, byte for byte', async () => {
  const asPub = b64u.dec('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const body = await encrypt('When I grow up, I want to be a watermelon', {
    endpoint: 'https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV',
    keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
  }, { asPrivateJwk: rawToJwk(asPub, 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), salt: b64u.dec('DGv6ra1nlYgDCS1FRnbzlw') });
  assert.equal(b64u.enc(body),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
  /* and the independent Python implementation decrypts it with the RFC's browser private key */
  assert.equal(py({ op: 'decrypt', body: b64u.enc(body), d: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94', p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' }).plain,
    'When I grow up, I want to be a watermelon');
});

test('random keys: Python decrypts what the Worker encrypts (Arabic, Kurdish, emoji)', async () => {
  for (const msg of ['🕌 حان وقت صلاة الفجر · 04:52 · Kirkuk', 'کاتی نوێژی بەیانی', JSON.stringify({ t: 'x'.repeat(3000) })]) {
    const k = py({ op: 'keys' });
    const body = await encrypt(msg, { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: k.p256dh, auth: k.auth } });
    assert.equal(py({ op: 'decrypt', body: b64u.enc(body), ...k }).plain, msg);
  }
});

test('VAPID header verifies in Python (signature, aud, exp, sub)', async () => {
  const v = await vapidKeys();
  const ep = 'https://web.push.apple.com/QGuQyavXutnMH8Q?x=1';
  const h = await vapidHeader(ep, v, 'https://barzandh.github.io/alquran/');
  const r = py({ op: 'vapid', header: h, endpoint: ep });
  assert.equal(r.claims.aud, 'https://web.push.apple.com');
  /* the key survives a JSON round trip, which is how it is stored in D1 */
  const v2 = JSON.parse(JSON.stringify(v));
  assert.ok(py({ op: 'vapid', header: await vapidHeader(ep, v2, 'mailto:a@b.c'), endpoint: ep }).ok);
});

test('buildPush: headers Apple and Google require', async () => {
  const k = py({ op: 'keys' }), v = await vapidKeys();
  const { url, init } = await buildPush({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: k }, '{"t":"hi"}', v, { subject: 'https://a.b/', ttl: 600 });
  assert.equal(url, 'https://fcm.googleapis.com/fcm/send/x');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(init.headers.TTL, '600');
  assert.equal(init.headers.Urgency, 'high');
  assert.match(init.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
  assert.ok(init.body instanceof Uint8Array && init.body.length > 86);
});

test('bad input gives clear TypeErrors, never a crash deep in WebCrypto', async () => {
  const k = py({ op: 'keys' });
  await assert.rejects(encrypt('x', null), /subscription keys missing/);
  await assert.rejects(encrypt('x', { keys: { p256dh: 123, auth: k.auth } }), /subscription keys missing/);
  await assert.rejects(encrypt('x', { keys: { p256dh: k.auth, auth: k.auth } }), /p256dh must be 65 bytes/);
  await assert.rejects(encrypt('x', { keys: { p256dh: k.p256dh, auth: k.p256dh } }), /auth secret must be 16 bytes/);
  await assert.rejects(encrypt('x'.repeat(4000), { keys: k }), /too large/);
  await assert.rejects(buildPush({ endpoint: 'http://insecure', keys: k }, 'x', await vapidKeys()), /bad push endpoint/);
  assert.throws(() => b64u.dec(undefined), /expected a string/);
});

test('speed: one push costs well under the free plan 10 ms CPU limit', async () => {
  const k = py({ op: 'keys' }), v = await vapidKeys(), n = 30;
  await buildPush({ endpoint: 'https://fcm.googleapis.com/x', keys: k }, 'warm', v);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) await buildPush({ endpoint: 'https://fcm.googleapis.com/x', keys: k }, '{"t":"🕌 Fajr","b":"04:52"}', v);
  const per = (performance.now() - t0) / n;
  console.log(`  ~${per.toFixed(2)} ms per push`);
  assert.ok(per < 5, `${per} ms per push`);
});
