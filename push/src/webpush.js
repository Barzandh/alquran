/* Web Push for Cloudflare Workers (and Node 20+): WebCrypto only, no packages.
   - Message encryption: RFC 8291 (aes128gcm content coding, RFC 8188)
   - Sender identity: RFC 8292 (VAPID, ES256 JWT)                                  */

const te = new TextEncoder();
const subtle = crypto.subtle;

export const b64u = {
  enc(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    if (typeof str !== 'string') throw new TypeError('base64url: expected a string, got ' + typeof str);
    const s = str.replace(/-/g, '+').replace(/_/g, '/'), p = s + '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob(p), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(key, data) {
  const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, data));
}
/* HKDF with a single output block (all lengths here are <= 32 bytes) */
async function hkdf(salt, ikm, info, len) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, len);
}

/* raw uncompressed P-256 point (65 bytes) <-> JWK */
export function rawToJwk(raw, d) {
  if (!(raw instanceof Uint8Array) || raw.length !== 65 || raw[0] !== 4) throw new TypeError('P-256 public key must be 65 bytes starting with 0x04');
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u.enc(raw.slice(1, 33)), y: b64u.enc(raw.slice(33, 65)), ext: true };
  if (d) jwk.d = typeof d === 'string' ? d : b64u.enc(d);
  return jwk;
}
export const jwkToRaw = jwk => concat(new Uint8Array([4]), b64u.dec(jwk.x), b64u.dec(jwk.y));

/* ---------- RFC 8291 encryption ----------
   sub: { endpoint, keys: { p256dh, auth } } (base64url strings, exactly what PushSubscription.toJSON() gives)
   test: { asPrivateJwk, salt } — only for the RFC test vector                                                  */
export async function encrypt(payload, sub, test) {
  if (!sub || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') throw new TypeError('subscription keys missing');
  const uaPub = b64u.dec(sub.keys.p256dh), auth = b64u.dec(sub.keys.auth);
  if (uaPub.length !== 65) throw new TypeError('p256dh must be 65 bytes, got ' + uaPub.length);
  if (auth.length !== 16) throw new TypeError('auth secret must be 16 bytes, got ' + auth.length);
  const plain = typeof payload === 'string' ? te.encode(payload) : payload;
  if (plain.length > 3993) throw new RangeError('push payload too large: ' + plain.length + ' bytes (max 3993)');

  let asPriv, asPub;
  if (test && test.asPrivateJwk) {
    asPriv = await subtle.importKey('jwk', test.asPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    asPub = jwkToRaw(test.asPrivateJwk);
  } else {
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPriv = kp.privateKey; asPub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  }
  const uaKey = await subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPriv, 256));

  const ikm = await hkdf(auth, ecdh, concat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = test && test.salt ? test.salt : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, rs); header[20] = 65; header.set(asPub, 21);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plain, new Uint8Array([2]))));
  return concat(header, ct);
}

/* ---------- RFC 8292 VAPID ---------- */
export async function vapidKeys() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  return { privateJwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, publicKey: b64u.enc(jwkToRaw(jwk)) };
}
/* The signed token is valid 12 h, so it is reused per push service for 11 h: saves the ECDSA signature
   (about half the CPU of a push) on every message after the first. */
const vapidCache = new Map();
export async function vapidHeader(endpoint, vapid, subject, now = Date.now()) {
  const aud = new URL(endpoint).origin, ck = aud + '|' + vapid.publicKey + '|' + subject, hit = vapidCache.get(ck);
  if (hit && hit.until > now) return hit.value;
  const value = await signVapid(aud, vapid, subject, now);
  if (vapidCache.size > 50) vapidCache.clear();
  vapidCache.set(ck, { value, until: now + 11 * 3600e3 });
  return value;
}
async function signVapid(aud, vapid, subject, now) {
  const h = b64u.enc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u.enc(te.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + c)));
  return `vapid t=${h}.${c}.${b64u.enc(sig)}, k=${vapid.publicKey}`;
}

/* Build the HTTP request for one push. Returns { url, init } so callers (and tests) can send it with any fetch. */
export async function buildPush(sub, payload, vapid, { subject, ttl = 900, urgency = 'high', topic } = {}) {
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) throw new TypeError('bad push endpoint');
  const body = await encrypt(payload, sub);
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    TTL: String(Math.max(0, Math.floor(ttl))),
    Urgency: urgency,
    Authorization: await vapidHeader(sub.endpoint, vapid, subject),
  };
  if (topic) headers.Topic = String(topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  return { url: sub.endpoint, init: { method: 'POST', headers, body } };
}
