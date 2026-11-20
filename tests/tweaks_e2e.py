"""Reading settings added for 'more tweaks': page look, audio, header & navigation, display.

  python3 tests/tweaks_e2e.py
"""
import os, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8098; URL = f'http://127.0.0.1:{PORT}/index.html'
fails = []
def check(c, m): print(('  ✓ ' if c else '  ✗ ') + m); c or fails.append(m)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

SET = """(([k,v])=>{const d=document.querySelector('#drawer');const el=d.querySelector('[data-k="'+k+'"]');
  if(el.type==='checkbox'){el.checked=v;el.dispatchEvent(new Event('change',{bubbles:true}));}
  else{el.value=String(v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));if(el.tagName==='SELECT')el.dispatchEvent(new Event('change',{bubbles:true}));}
  return true;})"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    c.add_init_script("localStorage.setItem('nur.settings', JSON.stringify({lang:'ar',locMode:'manual',loc:{name:'Dibis',lat:35.65,lng:44.06,tz:'Asia/Baghdad'}}))")
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '#home'); pg.wait_for_timeout(1200)
    pg.evaluate("openSurah(67)"); pg.wait_for_timeout(1800)
    def set_(k, v):
        pg.evaluate(SET, [k, v]); pg.wait_for_timeout(150)
    pg.evaluate("openDrawer()"); pg.wait_for_timeout(300)

    set_('cartouche', 'page')
    check('صفحة' in pg.evaluate("document.querySelector('#qhGo small').textContent"), 'header shows the page number')
    set_('cartouche', 'juz')
    check('الجزء' in pg.evaluate("document.querySelector('#qhGo small').textContent"), 'header switches back to juz')

    pg.evaluate("openDrawer()"); pg.wait_for_timeout(200)
    set_('showHead', False)
    check(pg.evaluate("document.querySelector('#qHead').hidden") and pg.evaluate("getComputedStyle(document.querySelector('.qbar')).display") != 'none', 'hiding the header brings back the old toolbar')
    pg.evaluate("openDrawer()"); pg.wait_for_timeout(200)
    set_('showHead', True)
    check(not pg.evaluate("document.querySelector('#qHead').hidden"), 'showing the header again')

    pg.evaluate("openDrawer()"); pg.wait_for_timeout(200)
    set_('gotoTab', 'juz'); set_('gotoTab', 'go')
    set_('lineH', 2.8)
    check(pg.evaluate("getComputedStyle(document.querySelector('.mushaf')).getPropertyValue('--qlh')").strip() == '2.8', 'line spacing sets the page variable')
    check(pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.mtext')).lineHeight) > 40"), 'line spacing applies to the text')
    set_('lineH', 2.3)
    set_('pageW', 600)
    check(pg.evaluate("document.documentElement.style.getPropertyValue('--pagew')") == '600px', 'page width setting')
    set_('pageW', 0)
    set_('bismShow', False)
    check(pg.evaluate("document.body.classList.contains('no-bism')"), 'basmala can be hidden')
    set_('bismShow', True)
    set_('ayahNum', 'plain')
    check(pg.evaluate("document.body.classList.contains('plain-num')"), 'plain ayah numbers')
    set_('ayahNum', 'ornate')

    pg.evaluate("openDrawer()"); pg.wait_for_timeout(200)
    set_('rate', 1.25)
    check(pg.evaluate("A.el.playbackRate") == 1.25, 'playback speed applies to the audio')
    set_('gap', 3)
    check(pg.evaluate("S.gap") == 3, 'pause between ayahs is saved')
    set_('sleep', 15)
    check(pg.evaluate("A.sleepM") == 15, 'sleep timer is set')
    set_('sleep', 0)

    pg.evaluate("openDrawer()"); pg.wait_for_timeout(200)
    set_('dim', 40)
    check(pg.evaluate("document.documentElement.style.getPropertyValue('--dim')") == '0.4', 'dim setting')
    check(pg.evaluate("!!document.querySelector('#dimOv')"), 'dim overlay exists')
    set_('reduce', True)
    check(pg.evaluate("document.documentElement.classList.contains('rm')"), 'reduce motion class')
    set_('bigtap', True)
    check(pg.evaluate("document.documentElement.classList.contains('bigtap')"), 'larger tap targets class')
    set_('reduce', False); set_('bigtap', False)

    check(pg.evaluate("document.documentElement.scrollWidth") <= 390, 'no sideways scrolling')
    check(not errs, 'no page errors ' + ' | '.join(errs))
    b.close()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED'); raise SystemExit(1 if fails else 0)
