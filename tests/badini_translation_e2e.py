"""Kurdish Badini is a translation (not tafsir): it is listed with the translations and shows verse text.

  python3 tests/badini_translation_e2e.py
"""
import os, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8103; URL = f'http://127.0.0.1:{PORT}/index.html'
fails = []
def check(c, m): print(('  ✓ ' if c else '  ✗ ') + m); c or fails.append(m)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    c.add_init_script("localStorage.setItem('nur.settings', JSON.stringify({lang:'en',locMode:'manual',loc:{name:'Dibis',lat:35.65,lng:44.06,tz:'Asia/Baghdad'}}))")
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '#home'); pg.wait_for_timeout(1200)
    check(pg.evaluate("EDITIONS.kd.tafsir") in (None, False), 'Badini is not flagged as tafsir')
    check(pg.evaluate("EDITIONS.kd.options[0][0]") == 'kmr-ismail', 'Badini uses the kmr-ismail file')
    check('tafsir' not in pg.evaluate("EDITIONS.kd.label") and 'بادینی' in pg.evaluate("EDITIONS.kd.label"), 'label is Kurdish Badini, not tafsir')
    check(pg.evaluate("Object.keys(EDITIONS).filter(k => !EDITIONS[k].tafsir).includes('kd')"), 'Badini is in the translations list')
    check(pg.evaluate("!Object.keys(EDITIONS).filter(k => EDITIONS[k].tafsir).includes('kd')"), 'Badini is not in the tafsir list')
    pg.evaluate("S.show.kd = true; save(); openSurah(1)"); pg.wait_for_timeout(2000)
    pg.click('.ma[data-i="0"]'); pg.wait_for_timeout(700)
    shown = pg.evaluate("document.querySelector('#sheet') ? document.querySelector('#sheet').innerText : ''")
    check('خودایێ' in shown, 'Badini translation text shows under the verses')
    check(not errs, 'no page errors ' + ' | '.join(errs))
    b.close()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED'); raise SystemExit(1 if fails else 0)
