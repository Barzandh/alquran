"""App permission behaviour on a simulated iPhone (Chromium + stubs), and the Qibla page's width.

  python3 tests/permissions_e2e.py

iPhone rules being simulated (WebKit):
- DeviceOrientationEvent.requestPermission() answers 'denied' when called outside a tap, and is forgotten when
  the page closes, so every new launch needs one tap.
- Geolocation permission of a web app can be forgotten; navigator.permissions.query then says 'prompt'.
"""
import json, os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8093; URL = f'http://127.0.0.1:{PORT}/index.html'
fails = []
def check(c, m): print(('  ✓ ' if c else '  ✗ ') + m); c or fails.append(m)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

def init(geo_state, loc_mode='live'):
    return """
(() => {
  localStorage.setItem('nur.settings', JSON.stringify({ lang: 'en', locMode: '%s', loc: { name: 'Dibis', lat: 35.65, lng: 44.06, tz: 'Asia/Baghdad' }, ptOfficial: false }));
  window.__calls = { motion: 0, motionNoTap: 0, geo: 0, watch: 0 };
  /* iPhone-like motion permission */
  window.DeviceOrientationEvent = window.DeviceOrientationEvent || function () {};
  DeviceOrientationEvent.requestPermission = () => { __calls.motion++; const tap = navigator.userActivation && navigator.userActivation.isActive; if (!tap) __calls.motionNoTap++; return Promise.resolve(tap ? 'granted' : 'denied'); };
  Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
  /* geolocation with a permission state */
  const st = '%s';
  if (navigator.permissions) { const q = navigator.permissions.query.bind(navigator.permissions); navigator.permissions.query = d => d && d.name === 'geolocation' ? Promise.resolve({ state: st }) : q(d); }
  navigator.geolocation.getCurrentPosition = (ok) => { __calls.geo++; setTimeout(() => ok({ coords: { latitude: 35.65, longitude: 44.06 } }), 10); };
  navigator.geolocation.watchPosition = () => { __calls.watch++; return 1; };
  navigator.geolocation.clearWatch = () => {};
})();""" % (loc_mode, geo_state)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    def page(geo='prompt', ua_ios=True, hash='home'):
        c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block',
                          user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' if ua_ios else None)
        c.add_init_script(init(geo)); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#' + hash); pg.wait_for_timeout(2500)
        return c, pg, errs

    print('Location')
    c, pg, errs = page('prompt')
    calls = pg.evaluate('__calls')
    check(calls['geo'] == 0 and calls['watch'] == 0, f"permission forgotten → no automatic location request at launch (geo {calls['geo']}, watch {calls['watch']})")
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(400)
    check(pg.evaluate('__calls.geo') == 0, 'coming back to the app doesn\'t ask either')
    check(any('paused' in (x.get('msg') or '') for x in pg.evaluate("LS.get('log', [])")), 'the pause is logged for diagnostics')
    c.close()
    c, pg, errs = page('granted')
    calls = pg.evaluate('__calls')
    check(calls['geo'] + calls['watch'] >= 1, f"permission still granted → silent automatic update works (geo {calls['geo']}, watch {calls['watch']})")
    c.close()

    print('Compass')
    c, pg, errs = page('granted', hash='qibla')
    check(pg.evaluate('__calls.motionNoTap') == 0, 'app opened on the Qibla page: no request outside a tap')
    check(pg.evaluate('!CMP.denied && !CMP.on'), 'nothing marked as denied')
    pg.mouse.click(200, 400); pg.wait_for_timeout(300)
    check(pg.evaluate('CMP.on') is True, 'one tap anywhere starts the compass')
    c.close()
    c, pg, errs = page('granted', hash='home')
    pg.click('[data-go="qibla"]'); pg.wait_for_timeout(500)
    check(pg.evaluate('CMP.on') is True and pg.evaluate('__calls.motion') == 1, 'the tap that opens Qibla starts the compass (one tap, one question)')
    check(pg.evaluate('__calls.motionNoTap') == 0, 'never asked outside a tap')

    print('Whole session: how many system questions does the user see?')
    c2, pg2, errs2 = page('granted', hash='home')
    for step in ["document.querySelector('[data-go=\"qibla\"]').click()", "go('home')", "go('prayer')", "go('qibla')", "document.dispatchEvent(new Event('visibilitychange'))", "go('home')", "go('qibla')"]:
        if 'click' in step: pg2.click('[data-go="qibla"]')
        else: pg2.evaluate(step)
        pg2.wait_for_timeout(250)
        if pg2.evaluate("curView") == 'qibla': pg2.mouse.click(200, 300); pg2.wait_for_timeout(150)
    n = pg2.evaluate('__calls.motion')
    check(n == 1, f'one session (open Qibla, leave, come back, background/foreground, tap around): motion question shown {n}× — must be exactly 1')
    check(pg2.evaluate('__calls.geo + __calls.watch') <= 2 and pg2.evaluate("__calls.motionNoTap") == 0, 'no location question, nothing asked outside a tap')
    c2.close()

    print('Qibla page width')
    for hd in (0, 45, 135, 315):
        pg.evaluate(f'onOrient({{ webkitCompassHeading: {hd} }})'); pg.wait_for_timeout(350)
        bad = pg.evaluate("""() => { const W = document.documentElement.clientWidth, out = [];
          const clipped = el => { for (let a = el.parentElement; a && a.id !== 'v-qibla'; a = a.parentElement) { const cs = getComputedStyle(a); if (/hidden|clip/.test(cs.overflowX)) { const r = a.getBoundingClientRect(); if (r.left >= -1 && r.right <= W + 1) return true; } } return /hidden|clip/.test(getComputedStyle(document.getElementById('v-qibla')).overflowX); };
          for (const el of document.querySelectorAll('#v-qibla *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1) && !clipped(el)) out.push(el.tagName + '.' + (el.className.baseVal ?? el.className)); }
          return out; }""")
        check(not bad, f'compass turned {hd}°: nothing sticks out past the screen' + (f' ({bad[:3]})' if bad else ''))
    check(not errs, 'no page errors' + (': ' + '; '.join(errs[:3]) if errs else ''))
    c.close()
    b.close()
srv.shutdown()
print('\nFAILED: %d' % len(fails) if fails else '\nALL PASSED'); sys.exit(1 if fails else 0)
