"""Tapped (selected) ayah stays readable in light and dark mode: Al-Kahf 18:4 on a 390 px phone.

  python3 tests/ayah_select_dark_e2e.py [--shots DIR]

Measures WCAG contrast between the Quran text colour and the selected-ayah background as it is actually painted
(background colour blended over the page), so a light highlight under light text in dark mode fails.
"""
import os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8098; URL = f'http://127.0.0.1:{PORT}/index.html'
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
fails = []
def check(c, m): print(('  ✓ ' if c else '  ✗ ') + m); c or fails.append(m)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

CONTRAST_JS = """(() => {
  const rgba = s => { const m = s.match(/[\\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const el = document.querySelector('.ma.sel'); if (!el) return null;
  /* paint: blend each ancestor background from the page up to the selected span */
  const chain = []; for (let n = el; n; n = n.parentElement) chain.unshift(n);
  let bg = [255, 255, 255];
  for (const n of chain) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) bg = bg.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); }
  const fg = rgba(getComputedStyle(el).color);
  const a = lum(fg), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
})()"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    for theme in ('light', 'dark'):
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
        c.add_init_script("localStorage.setItem('nur.settings', JSON.stringify({lang:'en',theme:'%s',locMode:'manual',"
                          "loc:{name:'Dibis',lat:35.65,lng:44.06,tz:'Asia/Baghdad'}}))" % theme)
        pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#home'); pg.wait_for_timeout(1200)
        check(pg.evaluate("document.documentElement.dataset.theme") == theme, f'{theme}: theme applied')
        pg.evaluate("openSurah(18)"); pg.wait_for_timeout(2000)
        pg.click('.ma[data-i="3"]'); pg.wait_for_timeout(600)
        check(pg.evaluate("!!document.querySelector('#sheet.on') && !!document.querySelector('.ma.sel')"), f'{theme}: tapping 18:4 selects it and opens the sheet')
        ratio = pg.evaluate(CONTRAST_JS) or 0
        check(ratio >= 4.5, f'{theme}: selected ayah text contrast {ratio:.1f}:1 (need ≥ 4.5)')
        if SHOTS:
            os.makedirs(SHOTS, exist_ok=True); pg.screenshot(path=os.path.join(SHOTS, f'select-{theme}.png'))
        check(not errs, f'{theme}: no page errors ' + ' | '.join(errs))
        c.close()
    b.close()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED'); raise SystemExit(1 if fails else 0)
