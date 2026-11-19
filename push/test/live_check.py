"""Live check against production: the published app (GitHub Pages) in real Google Chrome, the deployed Worker,
and Google's real push service (FCM). Runs on GitHub Actions (live-check workflow), no manual steps.

  xvfb-run python3 push/test/live_check.py <expected BUILD id>

1. waits until GitHub Pages serves the expected build
2. diagnostics: the phone registers and gets a code; a report with a note reaches the server
3. turns on lock-screen notifications through the real UI (real FCM subscription)
4. server test push → Google → this Chrome → notification shown → 'shown' receipt in the server's status
5. turns notifications off again (so the server doesn't keep pushing to a CI machine)
"""
import json, sys, time, os
from playwright.sync_api import sync_playwright

APP = 'https://barzandh.github.io/alquran/'
WANT = sys.argv[1] if len(sys.argv) > 1 else ''
RUN = os.environ.get('GITHUB_RUN_ID', 'local')
OUT = '/tmp/live'; os.makedirs(OUT, exist_ok=True)
res = {'build': WANT, 'run': RUN, 'steps': {}}
def step(k, v): res['steps'][k] = v; print(k, '→', json.dumps(v, ensure_ascii=False)[:400], flush=True)
def until(f, t, dt=1.0):
    end = time.time() + t
    while time.time() < end:
        try:
            v = f()
            if v: return v
        except Exception as e: last = e
        time.sleep(dt)
    return None

INIT = """(() => { if (!localStorage.getItem('nur.__live')) { localStorage.setItem('nur.__live', '1');
  localStorage.setItem('nur.settings', JSON.stringify({ lang: 'en', loc: { name: 'Kirkuk', lat: 35.4681, lng: 44.3922, tz: 'Asia/Baghdad' }, ptOfficial: false }));
  localStorage.setItem('nur.reminders', JSON.stringify([{ id: 'p-fajr', kind: 'prayer', on: true }, { id: 'az-m', kind: 'azkar', on: true }])); } })();"""

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=False, args=['--no-first-run', '--no-default-browser-check'])
    ctx = b.new_context(viewport={'width': 412, 'height': 900}, timezone_id='Asia/Baghdad', locale='en-US')
    ctx.grant_permissions(['notifications'], origin='https://barzandh.github.io')
    ctx.add_init_script(INIT)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    # 1. the expected build is live
    def live():
        pg.goto(APP + '?live=' + str(time.time()), wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
        return pg.evaluate('BUILD_ID') == WANT or not WANT
    ok = until(live, 600, 15)
    step('1 build live', {'ok': bool(ok), 'page_build': pg.evaluate('BUILD_ID')})
    pg.reload(); pg.wait_for_timeout(4000)   # service worker now controls the page

    # 2. diagnostics
    code = until(lambda: pg.evaluate("LS.get('dx', {}).code"), 40)
    step('2a diagnostics code', code)
    rep = pg.evaluate("DX.send('report', { note: 'live-check run %s' }).then(r => r, e => ({ error: e.message }))" % RUN)
    step('2b report sent', rep)

    # 3. lock-screen notifications through the real UI
    pg.goto(APP + '#reminders'); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{OUT}/1_reminders.png')
    card = pg.inner_text('.pushcard') if pg.query_selector('.pushcard') else ''
    step('3a card', card[:120])
    if pg.query_selector('[data-px="on"]'):
        pg.click('[data-px="on"]')
    st = until(lambda: (lambda s: s if s.get('ok') and s.get('total') else None)(pg.evaluate('PUSH.st()')), 60)
    step('3b subscribed + schedule', st or pg.evaluate('PUSH.st()'))
    try:
        ep = pg.evaluate("navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).then(s => s && new URL(s.endpoint).hostname)")
    except Exception as e: ep = 'error ' + str(e)
    step('3c push service', ep)
    pg.screenshot(path=f'{OUT}/2_on.png')

    # 4. real push round trip
    if st:
        t0 = pg.evaluate('Date.now()')
        step('4a test requested', pg.evaluate("PUSH.test(0).then(r => r, e => ({ error: e.message }))"))
        note = until(lambda: pg.evaluate("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.filter(x => /test/i.test(x.title)).map(x => ({ t: x.title, b: x.body })))"), 90, 2)
        step('4b notification shown in Chrome', note)
        stat = until(lambda: (lambda s: s if any(r.get('k', '').startswith('test') and r.get('shown_at') for r in s.get('recent', [])) else None)(pg.evaluate("PUSH.status()")), 60, 3)
        step('4c shown receipt on server', bool(stat) and [ {k: r.get(k) for k in ('k', 'status', 'http', 'shown_at')} for r in stat['recent'][:3]])
        if not stat: step('4c status', pg.evaluate("PUSH.status().then(r => r, e => ({ error: e.message }))"))

    # 5. clean up
    pg.goto(APP + '#reminders'); pg.wait_for_timeout(1500)
    step('5 turned off', pg.evaluate("PUSH.disable().then(() => PUSH.st().on === false)"))
    step('page errors', errs[:5])
    b.close()

passed = res['steps'].get('1 build live', {}).get('ok') and res['steps'].get('2a diagnostics code') and isinstance(res['steps'].get('2b report sent'), dict) and res['steps']['2b report sent'].get('ok') \
    and res['steps'].get('4b notification shown in Chrome') and res['steps'].get('4c shown receipt on server') and not res['steps'].get('page errors')
res['passed'] = bool(passed)
open(f'{OUT}/result.json', 'w').write(json.dumps(res, ensure_ascii=False, indent=1))
print('\nLIVE CHECK', 'PASSED' if passed else 'FAILED')
sys.exit(0 if passed else 1)
