"""End-to-end: the real app (index.html + sw.js) in Chromium, talking to the Worker running locally.

Checks the whole chain: diagnostics (register, automatic error report, manual report), turning on lock-screen
notifications, the server schedule matching the app's own prayer times, silent / mute / custom before-after
reminders, then an encrypted push decrypted by the fake push service and delivered into the service worker,
which must show the notification and send the 'shown' receipt back to the server.

  python3 push/test/e2e_app.py            (needs: python3 -m playwright, node 22+)
Screenshots go to /tmp/e2e/.
"""
import json, os, subprocess, sys, time, urllib.request, socket, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = '/tmp/e2e'; os.makedirs(OUT, exist_ok=True)
W, A = 8788, 8080
WURL, AURL = f'http://127.0.0.1:{W}', f'http://127.0.0.1:{A}'
fails = []

def check(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: fails.append(msg)

def adm(path, body=None):
    req = urllib.request.Request(WURL + path, data=json.dumps(body or {}).encode(), method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=10).read())

def sql(q, *args): return adm('/__admin/sql', {'sql': q, 'args': list(args)})

def wait_port(p, t=10):
    end = time.time() + t
    while time.time() < end:
        try: socket.create_connection(('127.0.0.1', p), timeout=.3).close(); return
        except OSError: time.sleep(.1)
    raise SystemExit(f'port {p} did not open')

def until(f, t=15, step=.25):
    end = time.time() + t
    while time.time() < end:
        v = f()
        if v: return v
        time.sleep(step)
    return f()

# --- servers -------------------------------------------------------------------------------------
worker = subprocess.Popen(['node', '--experimental-sqlite', '--no-warnings', os.path.join(ROOT, 'push/test/devserver.js'), str(W)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self): self.send_header('Cache-Control', 'no-store'); super().end_headers()
httpd = http.server.ThreadingHTTPServer(('127.0.0.1', A), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
wait_port(W); wait_port(A)

keys = json.loads(subprocess.run(['python3', os.path.join(ROOT, 'push/test/pydecode.py')], input='{"op":"keys"}', capture_output=True, text=True, check=True).stdout)
ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-' + str(int(time.time()))
adm('/__admin/phone', {'endpoint': ENDPOINT, **keys})

SETTINGS = {'lang': 'en', 'theme': 'light', 'loc': {'name': 'Kirkuk', 'lat': 35.4681, 'lng': 44.3922, 'tz': 'Asia/Baghdad'}, 'ptOfficial': False}
REMS = [{'id': 'p-fajr', 'kind': 'prayer', 'on': True}, {'id': 'p-maghrib', 'kind': 'prayer', 'on': True}, {'id': 'az-m', 'kind': 'azkar', 'on': True}]
INIT = """
(() => {
  if (location.port !== '%d') return;
  if (!localStorage.getItem('nur.__e2e')) {
    localStorage.setItem('nur.__e2e', '1');
    localStorage.setItem('nur.settings', JSON.stringify(%s));
    localStorage.setItem('nur.reminders', JSON.stringify(%s));
    localStorage.setItem('nur.pushUrl', JSON.stringify('%s'));
  }
  /* headless Chromium has no real push service: stand in for the browser's PushManager with fixed keys */
  const SUB = %s;
  const load = () => { try { return JSON.parse(sessionStorage.getItem('fakeSub') || 'null'); } catch (e) { return null; } };
  const wrap = o => o && { endpoint: o.endpoint, options: { applicationServerKey: new Uint8Array(o.k).buffer, userVisibleOnly: true }, toJSON: () => ({ endpoint: o.endpoint, keys: SUB.keys }), unsubscribe: async () => { sessionStorage.removeItem('fakeSub'); return true; } };
  if (window.PushManager) {
    PushManager.prototype.getSubscription = async function () { return wrap(load()); };
    PushManager.prototype.subscribe = async function (opt) {
      if (!opt || !opt.userVisibleOnly || !opt.applicationServerKey) throw new TypeError('subscribe: userVisibleOnly + applicationServerKey required');
      const k = Array.from(new Uint8Array(opt.applicationServerKey.buffer || opt.applicationServerKey));
      if (k.length !== 65 || k[0] !== 4) throw new TypeError('applicationServerKey must be a 65-byte P-256 key');
      sessionStorage.setItem('fakeSub', JSON.stringify({ endpoint: SUB.endpoint, k })); return wrap(load());
    };
  }
})();
""" % (A, json.dumps(SETTINGS), json.dumps(REMS), WURL, json.dumps({'endpoint': ENDPOINT, 'keys': {'p256dh': keys['p256dh'], 'auth': keys['auth']}}))

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='chromium', args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Asia/Baghdad', locale='en-US')
    ctx.grant_permissions(['notifications'], origin=AURL)
    ctx.add_init_script(INIT)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' and 'net::ERR' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto(AURL + '/index.html#more'); pg.wait_for_timeout(2500)
    pg.reload(); pg.wait_for_timeout(2500)   # second load: service worker controls the page

    print('Diagnostics')
    code = until(lambda: pg.evaluate("LS.get('dx', {}).code"), 12)
    check(bool(code) and len(code) == 6, f'phone registered, code {code}')
    pg.evaluate("RENDER.more()"); pg.wait_for_timeout(300)
    check(code[:3] in pg.inner_text('#dxCard'), 'More shows the diagnostics code')
    pg.screenshot(path=f'{OUT}/more_en.png', full_page=False)
    pg.evaluate("setTimeout(() => { const o = null; o.boom(); }, 10)")   # a real TypeError, like the one that broke the Codex version
    got = until(lambda: sql("SELECT kind, body FROM diag WHERE code = ? AND kind = 'auto'", code), 15)
    check(bool(got) and 'TypeError' in got[0]['body'] and 'boom' in got[0]['body'], 'TypeError reached the server automatically')
    errors[:] = [e for e in errors if 'boom' not in e]
    pg.click('#dxSend'); pg.fill('#dxNote', 'e2e: the adhan did not ring'); pg.click('#dxGo')
    rep = until(lambda: sql("SELECT body FROM diag WHERE code = ? AND kind = 'report'", code), 20)
    if rep:
        body = json.loads(rep[0]['body'])
        check(body.get('note') == 'e2e: the adhan did not ring', 'manual report with the note')
        check(body['ctx']['settings']['loc']['lat'] == 35.5, 'location is rounded (35.4681 → 35.5)')
        check(isinstance(body.get('tests'), list) and len(body['tests']) > 5, f"self-tests included ({len(body.get('tests') or [])})")
        check(body['ctx']['platform'] in ('android-browser', 'desktop', 'ios-safari'), 'platform: ' + body['ctx']['platform'])
    else: check(False, 'manual report reached the server')

    print('Lock-screen notifications')
    pg.goto(AURL + '/index.html#reminders'); pg.wait_for_timeout(800)
    card = pg.inner_text('.pushcard')
    check('Turn on' in card, 'Reminders shows the lock-screen card with Turn on')
    pg.screenshot(path=f'{OUT}/rem_off.png', full_page=True)
    pg.click('[data-px="on"]')
    dev = until(lambda: [d for d in sql("SELECT id, status, endpoint FROM devices WHERE code = ?", code) if d['status'] == 'active'], 10) or sql("SELECT id, status, endpoint FROM devices WHERE code = ?", code)
    check(dev and dev[0]['status'] == 'active' and dev[0]['endpoint'] == ENDPOINT, 'server has the subscription')
    n_app = until(lambda: pg.evaluate("PUSH.st().total"), 10)
    n_build = pg.evaluate("PUSH.build().length")
    n_srv = sql("SELECT COUNT(*) n FROM events WHERE device = ? AND status = 'pending'", dev[0]['id'])[0]['n']
    check(n_app and n_app == n_srv == n_build, f'14-day schedule on the server: {n_srv} reminders (app built {n_build})')
    check(n_srv >= 40, 'about 3 reminders a day for 14 days + refresh note')
    fajr_app = pg.evaluate("(() => { const r = remList().find(x => x.id === 'p-fajr'); return remNext(r).getTime(); })()")
    fajr_srv = sql("SELECT at, payload FROM events WHERE device = ? AND k LIKE 'p-fajr@%' ORDER BY at LIMIT 1", dev[0]['id'])[0]
    check(fajr_srv['at'] == fajr_app, f"next Fajr on the server = app's prayer time ({time.strftime('%d %b %H:%M', time.localtime(fajr_app / 1000))})")
    pj = json.loads(fajr_srv['payload'])
    check(pj['t'].startswith('🕌') and 'Fajr' in pj['t'] and pj['s'] == 'on' and pj['l'] == 'prayer', f"payload: {pj['t']} / {pj['b']}")
    pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/rem_on.png', full_page=True)
    check('On ✓' in pg.inner_text('.pushcard'), 'card says On ✓')

    print('Silent / mute / before-after reminders')
    pg.click('.remrow[data-id="p-fajr"] [data-r="mode"]'); pg.wait_for_timeout(3500)
    s_ = until(lambda: json.loads(sql("SELECT payload FROM events WHERE device = ? AND k LIKE 'p-fajr@%' ORDER BY at LIMIT 1", dev[0]['id'])[0]['payload'])['s'] == 'silent', 8)
    check(s_, 'Fajr set to silent → server payload silent')
    pg.click('#remMute [data-v="-1"]')
    check(until(lambda: sql("SELECT COUNT(*) n FROM events WHERE device = ? AND status = 'pending'", dev[0]['id'])[0]['n'] == 0, 8), 'mute until I turn it back on → nothing planned on the server')
    pg.screenshot(path=f'{OUT}/rem_muted.png', full_page=False)
    pg.click('#remMute [data-v="0"]')
    check(until(lambda: sql("SELECT COUNT(*) n FROM events WHERE device = ? AND status = 'pending'", dev[0]['id'])[0]['n'] == n_srv, 8), 'unmute → all back')
    pg.click('[data-x="add"]'); pg.wait_for_timeout(300)
    pg.fill('#rmf input[name="title"]', 'Prepare for Maghrib')
    pg.click('#rmWhen [data-v="prayer"]'); pg.fill('#rmf input[name="min"]', '15')
    pg.select_option('#rmf select[name="dir"]', '-1'); pg.select_option('#rmf select[name="anchor"]', 'maghrib')
    pg.screenshot(path=f'{OUT}/form_relative.png')
    pg.click('#rmf button.pri'); pg.wait_for_timeout(300)
    mag = pg.evaluate("(() => { const r = remList().find(x => x.id === 'p-maghrib'); return remNext(r).getTime(); })()")
    cust = until(lambda: sql("SELECT at, payload FROM events WHERE device = ? AND payload LIKE '%Prepare for Maghrib%' ORDER BY at LIMIT 1", dev[0]['id']), 8)
    if cust:
        diff = (mag - cust[0]['at']) / 60000
        check(abs(diff - 15) < 0.01 or abs(diff - 15 - 1440) < 3, f'"15 min before Maghrib" is planned 15 min before Maghrib ({diff:.0f} min)')
        check('Maghrib' in json.loads(cust[0]['payload'])['b'], 'body names the prayer: ' + json.loads(cust[0]['payload'])['b'])
    else: check(False, 'custom relative reminder reached the server')
    row = pg.inner_text('#v-reminders')
    check('15 min before Maghrib' in row, 'row shows "15 min before Maghrib"')
    pg.screenshot(path=f'{OUT}/rem_custom.png', full_page=True)

    print('Push → service worker → lock-screen notification')
    r = pg.evaluate("PUSH.test(0)")
    sent = until(lambda: adm('/__admin/sent'), 8)
    check(bool(sent), 'server sent the test push (encrypted, decrypted by the fake push service)')
    msg = json.loads(sent[-1]['json'])
    check(msg.get('u') == WURL and msg.get('i') and msg.get('a'), 'payload carries receipt address and token')
    cdp = ctx.new_cdp_session(pg); regs = []
    cdp.on('ServiceWorker.workerRegistrationUpdated', lambda e: regs.extend(e['registrations']))
    cdp.send('ServiceWorker.enable'); pg.wait_for_timeout(500)
    reg = [x for x in regs if x['scopeURL'].startswith(AURL) and not x['isDeleted']]
    check(bool(reg), 'service worker registered')
    if reg:
        cdp.send('ServiceWorker.deliverPushMessage', {'origin': AURL + '/', 'registrationId': reg[0]['registrationId'], 'data': sent[-1]['json']})
        notes = until(lambda: pg.evaluate("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.map(x => ({ t: x.title, b: x.body, tag: x.tag, silent: x.silent, data: x.data })))"), 8)
        check(bool(notes) and notes[-1]['t'] == msg['t'], f"notification shown: {notes[-1]['t'] if notes else '—'} / {notes[-1]['b'] if notes else ''}")
        check(notes and notes[-1]['silent'] is True, 'app is open on screen → notification is silent (the app rings itself)')
        # the iPhone case: right after locking, the page is frozen but still reports 'visible' → the notification must ring
        r2 = pg.evaluate("PUSH.test(0)"); sent2 = until(lambda: len(adm('/__admin/sent')) >= 2 and adm('/__admin/sent'), 8)
        pg.evaluate("setTimeout(() => { const t = Date.now() + 3000; while (Date.now() < t) {} }, 50)")   # page can't answer, like a frozen one
        time.sleep(0.3)
        cdp.send('ServiceWorker.deliverPushMessage', {'origin': AURL + '/', 'registrationId': reg[0]['registrationId'], 'data': sent2[-1]['json']})
        time.sleep(3.5)
        tag2 = json.loads(sent2[-1]['json'])
        n2 = pg.evaluate("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.map(x => ({ tag: x.tag, silent: x.silent })))")
        mine = [x for x in n2 if x['tag'].endswith('@' + str(tag2['ts']))]
        check(mine and mine[0]['silent'] is False, 'page frozen (phone just locked) → notification rings, not silent')
        check(len({x['tag'] for x in n2}) == len(n2) >= 2, 'every notification has its own tag (iPhone silences replacements)')
        shown = until(lambda: sql('SELECT shown_at FROM events WHERE id = ?', msg['i'])[0]['shown_at'], 8)
        check(bool(shown), "'shown' receipt reached the server")
        # a reminder for the scheduler: cron at the time of the next one sends exactly that one
        nxt = sql("SELECT id, at FROM events WHERE device = ? AND status = 'pending' ORDER BY at LIMIT 1", dev[0]['id'])[0]
        before = len(adm('/__admin/sent'))
        out = adm('/__admin/cron', {'now': nxt['at'] - 30000})
        check(out['claimed'] >= 1 and out['sent'] >= 1 and len(adm('/__admin/sent')) > before, f"cron 30 s before the next reminder sends it (claimed {out['claimed']})")

    print('Arabic (right-to-left)')
    pg.evaluate("S.lang = 'ar'; save(); applyLang && applyLang();") if pg.evaluate("typeof applyLang === 'function'") else pg.evaluate("S.lang = 'ar'; save(); location.reload()")
    pg.wait_for_timeout(1500); pg.goto(AURL + '/index.html#reminders'); pg.wait_for_timeout(1200)
    t = pg.inner_text('.pushcard')
    check('إشعارات على شاشة القفل' in t, 'lock-screen card in Arabic')
    pg.screenshot(path=f'{OUT}/rem_ar.png', full_page=True)
    pg.goto(AURL + '/index.html#more'); pg.wait_for_timeout(900)
    check('التشخيص' in pg.inner_text('#dxCard'), 'diagnostics card in Arabic')
    pg.screenshot(path=f'{OUT}/more_ar.png')
    sw_w = pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    check(sw_w, 'no sideways scrolling')
    b.close()

worker.terminate(); httpd.shutdown()
errs = [e for e in errors if 'boom' not in e]
check(not errs, 'no page errors' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
print('\nFAILED: %d' % len(fails) if fails else '\nALL PASSED')
sys.exit(1 if fails else 0)
