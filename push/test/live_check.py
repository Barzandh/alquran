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
    # A real "Allow" for notifications, stored in Chrome's profile the way tapping Allow stores it.
    # (Playwright's grant_permissions only fakes Notification.permission; Chrome's push service checks the profile.)
    import tempfile
    prof = tempfile.mkdtemp(prefix='chrome-live-'); os.makedirs(prof + '/Default', exist_ok=True)
    json.dump({'profile': {'content_settings': {'exceptions': {'notifications': {'https://barzandh.github.io:443,*': {'setting': 1}}}}}}, open(prof + '/Default/Preferences', 'w'))
    ctx = p.chromium.launch_persistent_context(prof, channel='chrome', headless=False, args=['--no-first-run', '--no-default-browser-check'],
                                               viewport={'width': 412, 'height': 900}, timezone_id='Asia/Baghdad', locale='en-US')
    b = ctx
    ctx.add_init_script(INIT)
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    step('0 permission', None)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    # 1. the expected build is live
    def live():
        pg.goto(APP + '?live=' + str(time.time()), wait_until='domcontentloaded'); pg.wait_for_timeout(2500)
        return pg.evaluate('BUILD_ID') == WANT or not WANT
    ok = until(live, 600, 15)
    step('1 build live', {'ok': bool(ok), 'page_build': pg.evaluate('BUILD_ID'), 'notif': pg.evaluate('Notification.permission')})
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
    step('3b subscribed + schedule', st or {'st': pg.evaluate('PUSH.st()'), 'log': pg.evaluate("LS.get('log', []).filter(e => e.type === 'push').slice(-3).map(e => e.msg)")})
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
        # 4d. a reminder delivered by the minute timer (cron), like a real Fajr reminder
        pg.evaluate("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.forEach(x => x.close()))")
        cr = pg.evaluate("PUSH.test(70).then(r => r, e => ({ error: e.message }))"); step('4d timed reminder requested (70 s)', cr)
        cn = until(lambda: pg.evaluate("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.filter(x => /test/i.test(x.title)).length)"), 200, 3)
        late = (pg.evaluate('Date.now()') - cr.get('at', 0)) / 1000 if cn and isinstance(cr, dict) else None
        step('4e timed reminder shown', {'shown': bool(cn), 'seconds_after_due': late})

    # 5. clean up
    pg.goto(APP + '#reminders'); pg.wait_for_timeout(1500)
    step('5 turned off', pg.evaluate("PUSH.disable().then(() => PUSH.st().on === false)"))
    step('page errors', errs[:5])
    b.close()

passed = res['steps'].get('1 build live', {}).get('ok') and res['steps'].get('2a diagnostics code') and isinstance(res['steps'].get('2b report sent'), dict) and res['steps']['2b report sent'].get('ok') \
    and res['steps'].get('4b notification shown in Chrome') and res['steps'].get('4c shown receipt on server') and (res['steps'].get('4e timed reminder shown') or {}).get('shown') and not res['steps'].get('page errors')
res['passed'] = bool(passed)
open(f'{OUT}/result.json', 'w').write(json.dumps(res, ensure_ascii=False, indent=1))
print('\nLIVE CHECK', 'PASSED' if passed else 'FAILED')
sys.exit(0 if passed else 1)
