"""Independent check of the Worker's Web Push output, written from the RFCs with Python's `cryptography`
(not sharing any code with the JavaScript). Reads JSON on stdin, prints JSON.

  {"op": "keys"}                                   -> new browser-side keys {p256dh, auth, d}
  {"op": "decrypt", "body", "d", "p256dh", "auth"} -> {"plain"}          (RFC 8291 / RFC 8188 aes128gcm)
  {"op": "vapid", "header", "endpoint"}            -> {"ok", "claims"}   (RFC 8292 JWT signature + claims)
"""
import base64, json, sys, struct, time
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives import hashes, hmac, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from urllib.parse import urlparse


def ub64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def eb64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def hmac256(key, data):
    h = hmac.HMAC(key, hashes.SHA256()); h.update(data); return h.finalize()


def hkdf(salt, ikm, info, n):
    return hmac256(hmac256(salt, ikm), info + b"\x01")[:n]


def raw_pub(pub):
    return pub.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def decrypt(body, d, p256dh, auth):
    body, auth, ua_pub = ub64(body), ub64(auth), ub64(p256dh)
    salt, rs, idlen = body[:16], struct.unpack(">I", body[16:20])[0], body[20]
    as_pub = body[21:21 + idlen]
    ct = body[21 + idlen:]
    assert idlen == 65, "keyid must be the 65-byte sender key"
    assert len(ct) <= rs, "single record expected"
    priv = ec.derive_private_key(int.from_bytes(ub64(d), "big"), ec.SECP256R1())
    assert raw_pub(priv.public_key()) == ua_pub, "p256dh does not match private key"
    shared = priv.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_pub))
    ikm = hkdf(auth, shared, b"WebPush: info\x00" + ua_pub + as_pub, 32)
    cek = hkdf(salt, ikm, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = hkdf(salt, ikm, b"Content-Encoding: nonce\x00", 12)
    padded = AESGCM(cek).decrypt(nonce, ct, None)
    plain = padded.rstrip(b"\x00")
    assert plain[-1:] == b"\x02", "last-record delimiter 0x02 missing"
    return plain[:-1].decode("utf-8")


def vapid(header, endpoint):
    parts = dict(p.strip().split("=", 1) for p in header[len("vapid "):].split(","))
    jwt, k = parts["t"], parts["k"]
    h, c, s = jwt.split(".")
    hdr, claims = json.loads(ub64(h)), json.loads(ub64(c))
    assert hdr == {"typ": "JWT", "alg": "ES256"}, hdr
    sig = ub64(s); assert len(sig) == 64, "ES256 signature must be raw r||s (64 bytes)"
    pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ub64(k))
    pub.verify(encode_dss_signature(int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big")), (h + "." + c).encode(), ec.ECDSA(hashes.SHA256()))
    u = urlparse(endpoint)
    assert claims["aud"] == f"{u.scheme}://{u.netloc}", claims
    assert 0 < claims["exp"] - time.time() <= 24 * 3600, "exp must be within 24h"
    assert claims["sub"].startswith(("mailto:", "https://")), claims
    return claims


req = json.load(sys.stdin)
if req["op"] == "keys":
    p = ec.generate_private_key(ec.SECP256R1())
    import os
    print(json.dumps({"p256dh": eb64(raw_pub(p.public_key())), "auth": eb64(os.urandom(16)), "d": eb64(p.private_numbers().private_value.to_bytes(32, "big"))}))
elif req["op"] == "decrypt":
    print(json.dumps({"plain": decrypt(req["body"], req["d"], req["p256dh"], req["auth"])}))
elif req["op"] == "vapid":
    print(json.dumps({"ok": True, "claims": vapid(req["header"], req["endpoint"])}))
