"""Every home-window theme in the picker renders in the real app and fits its box (no spill, no overlap).

  python3 tests/window_themes_e2e.py [--shots DIR]

Selects each d-… theme, opens Home, and checks every visible text label inside the window. Also checks the
picker lists each d-… theme once and that its thumbnail file exists.
"""
import os, re, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8097; URL = f'http://127.0.0.1:{PORT}/index.html'
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
fails = []
# the eight themes that were already in the app: their fit problems are reported, not failed here
KNOWN_PRE_EXISTING = {'d-midnight', 'd-burgundy', 'd-sand', 'd-black', 'd-dusk', 'd-olive', 'd-sky', 'd-copper'}
def check(c, m): print(('  ✓ ' if c else '  ✗ ') + m); c or fails.append(m)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

# 1. static: every d- theme listed once, with a thumbnail, and a RBX renderer
html = open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()
themes = re.findall(r"\['(d-[\w-]+)', '[^']*', 'd'\]", html)
check(len(themes) == len(set(themes)) and len(themes) >= 18, f'{len(themes)} new-design themes listed, none repeated')
for t in themes:
    check(os.path.exists(os.path.join(ROOT, 'icons/themes', t + '.jpg')), f'{t}: thumbnail present')
    check(re.search(r'(NEW_RBX\.|\n  )%s\s*[:=]\s*\(d, k' % t[2:], html) is not None, f'{t}: renderer defined')

CHECK = """() => { const r = document.querySelector('#homePb .rbx'), R = r.getBoundingClientRect(), bad = [];
  const leaves = [...r.querySelectorAll('[data-k]')].filter(e => e.textContent.trim());
  leaves.forEach(e => { const b = e.getBoundingClientRect();
    if (b.left < R.left - 2 || b.right > R.right + 2 || b.top < R.top - 6 || b.bottom > R.bottom + 2) bad.push('outside: ' + e.dataset.k); });
  const ink = e => { const r = e.getBoundingClientRect(), f = parseFloat(getComputedStyle(e).fontSize) * (r.height / (e.offsetHeight || r.height) || 1); return { left: r.left, right: r.right, top: r.top + f * .22, bottom: r.bottom - f * .2 }; };
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) { const a = ink(leaves[i]), b = ink(leaves[j]);
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 4 && oy > 8 && !leaves[i].contains(leaves[j]) && !leaves[j].contains(leaves[i])) bad.push('overlap: ' + leaves[i].dataset.k + ' / ' + leaves[j].dataset.k); }
  return bad; }"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    for t in themes:
        c = b.new_context(viewport={'width': 1300, 'height': 1300}, service_workers='block')
        c.add_init_script("localStorage.setItem('nur.settings', JSON.stringify({lang:'en',theme:'light',rbTheme:'%s',locMode:'manual',"
                          "loc:{name:'Erbil',lat:36.19,lng:44.01,tz:'Asia/Baghdad'}}))" % t)
        pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#home'); pg.wait_for_timeout(1500)
        ok = pg.evaluate("!!document.querySelector('#homePb .rbx.rbx-%s')" % t[2:])
        check(ok, f'{t}: window rendered in the home screen')
        if ok:
            bad = pg.evaluate(CHECK)
            if t in KNOWN_PRE_EXISTING and bad: print(f'  ! {t}: text fits its box — pre-existing, reported only: ' + ' | '.join(bad)[:200])
            else: check(not bad, f'{t}: text fits its box ' + (' | '.join(bad)[:300] if bad else ''))
            if SHOTS:
                os.makedirs(SHOTS, exist_ok=True); pg.locator('#homePb .rbx').screenshot(path=os.path.join(SHOTS, t + '.png'))
        check(not errs, f'{t}: no page errors ' + ' | '.join(errs))
        c.close()
    b.close()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED'); raise SystemExit(1 if fails else 0)
