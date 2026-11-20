"""Reader header (play · surah cartouche · settings) and the "Go to" panel, on a 390 px phone in Arabic.

  python3 tests/reader_header_e2e.py
"""
import os, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8097; URL = f'http://127.0.0.1:{PORT}/index.html'
fails = []
def check(c, m): print(('  ✓ ' if c else '  ✗ ') + m); c or fails.append(m)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    c.add_init_script("localStorage.setItem('nur.settings', JSON.stringify({lang:'ar',locMode:'manual',loc:{name:'Dibis',lat:35.65,lng:44.06,tz:'Asia/Baghdad'}}))")
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '#home'); pg.wait_for_timeout(1200)
    check(pg.evaluate("document.querySelector('#qHead').hidden"), 'header hidden outside the reader')
    pg.evaluate("openSurah(67)"); pg.wait_for_timeout(2000)
    t = pg.evaluate("document.querySelector('#qHead').innerText")
    check('سورة الملك' in t and 'التاسع والعشرون' in t, 'cartouche shows juz 29 · Surat al-Mulk')
    pos = pg.evaluate("[document.querySelector('#qhPlay').getBoundingClientRect().left, document.querySelector('#qhSet').getBoundingClientRect().left]")
    check(pos[0] < 100 and pos[1] > 290, 'play button top-left, settings top-right')
    check(pg.evaluate("getComputedStyle(document.querySelector('.topbar')).display") == 'none', 'phone top bar replaced by the header')
    pg.click('#qhGo'); pg.wait_for_timeout(500)
    check(pg.evaluate("document.querySelector('#qGo').classList.contains('on')"), 'tapping the cartouche opens Go to')
    def spin(k, i):
        pg.evaluate(f"(()=>{{const w=document.querySelector('#qGo [data-w=\"{k}\"]'); w.scrollTop={i}*40; w.dispatchEvent(new Event('scroll'));}})()"); pg.wait_for_timeout(450)
        return pg.evaluate("[QG.s,QG.n,JUZ[gIndex(QG.s,QG.n)],PAGE[gIndex(QG.s,QG.n)]]")
    check(spin('p', 581) == [78, 1, 30, 582], 'page wheel 582 → An-Naba 1, juz 30')
    check(spin('j', 1) == [2, 142, 2, 22], 'juz wheel 2 → Al-Baqarah 142, page 22')
    check(spin('s', 113) == [114, 1, 30, 604], 'surah wheel 114 → page 604')
    pg.fill('#qgoQ', 'القلم'); pg.wait_for_timeout(300)
    check(pg.evaluate("QG.s") == 68, 'typing a surah name moves the wheels')
    pg.click('[data-qg=goto]'); pg.wait_for_timeout(1800)
    check(pg.evaluate("R.range.s") == 68 and 'سورة القلم' in pg.evaluate("document.querySelector('#qHead').innerText"), '«انتقل» opens the chosen surah')
    pg.click('#qhGo'); pg.wait_for_timeout(300); pg.click('[data-tab=juz]'); pg.wait_for_timeout(200)
    check(pg.evaluate("document.querySelectorAll('#qGo .qgo-row').length") == 30, 'juz tab lists 30 parts')
    pg.click('[data-tab=sura]'); pg.wait_for_timeout(200)
    check(pg.evaluate("document.querySelectorAll('#qGo .qgo-row').length") == 114, 'surah tab lists 114 surahs')
    pg.go_back(); pg.wait_for_timeout(300)
    check(not pg.evaluate("document.querySelector('#qGo').classList.contains('on')") and pg.evaluate("curView") == 'quran', 'phone back button closes the panel only')
    check(pg.evaluate("document.documentElement.scrollWidth") <= 390, 'no sideways scrolling')
    check(not errs, 'no page errors ' + ' | '.join(errs))
    b.close()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED'); raise SystemExit(1 if fails else 0)
