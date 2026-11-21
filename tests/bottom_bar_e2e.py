"""Bottom bar: Edit lets you pick and order up to 6 tabs; More always stays.

  python3 tests/bottom_bar_e2e.py
"""
import os, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8100; URL = f'http://127.0.0.1:{PORT}/index.html'
fails = []
def check(c, m): print(('  ✓ ' if c else '  ✗ ') + m); c or fails.append(m)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
TABS = "() => [...document.querySelectorAll('#bottom a')].map(a => a.dataset.v)"

with sync_playwright() as p:
    b = p.chromium.launch(args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    c.add_init_script("localStorage.setItem('nur.settings', JSON.stringify({lang:'en',locMode:'manual',loc:{name:'Dibis',lat:35.65,lng:44.06,tz:'Asia/Baghdad'}}))")
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '#home'); pg.wait_for_timeout(1200)
    check(pg.evaluate(TABS)() == ['home','quran','latin','prayer','azkar','more'] if False else pg.evaluate(TABS) == ['home','quran','latin','prayer','azkar','more'], 'default bar is unchanged')
    check(pg.evaluate("document.querySelectorAll('#bottom .bedit').length") == 1, 'Edit button sits in the bar')
    pg.click('#bottomEdit'); pg.wait_for_timeout(300)
    check(pg.evaluate("document.querySelector('#modal').classList.contains('on')"), 'Edit opens the editor')
    pg.click('.bed-row[data-k="prayer"] [data-tg]'); pg.wait_for_timeout(200)
    check(pg.evaluate(TABS) == ['home','quran','latin','azkar','more'], 'turning Prayer off removes it from the bar')
    pg.click('.bed-row[data-k="search"] [data-tg]'); pg.wait_for_timeout(200)
    check(pg.evaluate(TABS) == ['home','quran','latin','search','azkar','more'], 'turning Search on adds it')
    pg.click('.bed-row[data-k="search"] [data-mv="-1"]'); pg.wait_for_timeout(200)
    check(pg.evaluate(TABS)[2:4] == ['search','latin'], 'moving Search up reorders the bar')
    pg.click('.bed-row[data-k="qibla"] [data-tg]'); pg.wait_for_timeout(200)
    check(pg.evaluate(TABS) == ['home','quran','search','latin','azkar','more'] or len(pg.evaluate(TABS)) == 6, 'bar never shows more than 6 tabs')
    check(pg.evaluate("document.querySelector('.bed-row[data-k=\"more\"] [data-tg]').disabled"), 'More cannot be turned off')
    pg.click('#bedReset'); pg.wait_for_timeout(200)
    check(pg.evaluate(TABS) == ['home','quran','latin','prayer','azkar','more'], 'Reset restores the default bar')
    pg.click('[data-close]'); pg.wait_for_timeout(200)
    pg.click('#bottom a[data-v="azkar"]'); pg.wait_for_timeout(500)
    check(pg.evaluate("curView") == 'azkar', 'tabs still navigate')
    check(pg.evaluate("document.documentElement.scrollWidth") <= 390, 'bar fits 390 px with Edit')
    check(not errs, 'no page errors ' + ' | '.join(errs))
    b.close()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED'); raise SystemExit(1 if fails else 0)
