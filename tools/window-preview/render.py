"""Render every candidate design to PNG and build a numbered preview sheet.
  python3 tools/window-preview/render.py OUTDIR
Also reports any text that spills outside its design or overlaps another text block."""
import os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wp'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8099), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
CHECK = """key => { const r = document.querySelector('#t-' + key + ' .rbx'), R = r.getBoundingClientRect(), bad = [];
  const leaves = [...r.querySelectorAll('[data-k]')].filter(e => e.textContent.trim());
  leaves.forEach(e => { const b = e.getBoundingClientRect();
    if (b.left < R.left - 1 || b.right > R.right + 1 || b.top < R.top - 1 || b.bottom > R.bottom + 1) bad.push('outside: ' + e.dataset.k);
    let p = e.parentElement; while (p && p !== r) { const s = getComputedStyle(p); if (s.overflow !== 'visible' || p.classList.contains('x-c') || p.classList.contains('x-r') || p.classList.contains('x-t')) { const pb = p.getBoundingClientRect(); if (b.right > pb.right + 1 || b.left < pb.left - 1) bad.push('spills its box: ' + e.dataset.k); break; } p = p.parentElement; } });
  const ink = e => { const r = e.getBoundingClientRect(), f = parseFloat(getComputedStyle(e).fontSize) * (r.height / (e.offsetHeight || r.height) || 1); return { left: r.left, right: r.right, top: r.top + f * .22, bottom: r.bottom - f * .2 }; };
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) { const a = ink(leaves[i]), b = ink(leaves[j]);
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 4 && oy > 8 && !leaves[i].contains(leaves[j]) && !leaves[j].contains(leaves[i])) bad.push('overlap: ' + leaves[i].dataset.k + ' / ' + leaves[j].dataset.k); }
  return bad; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1287, 'height': 1300})
    pg.goto('http://127.0.0.1:8099/tools/window-preview/preview.html'); pg.wait_for_timeout(500)
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(800)
    keys = pg.evaluate("Object.keys(NEW_RBX)"); names = pg.evaluate("NEW_NAMES")
    for key in keys:
        bad = pg.evaluate(CHECK, key); print(f"{key:11s}", 'OK' if not bad else bad)
        pg.locator('#t-' + key).screenshot(path=f'{OUT}/{key}.png')
    b.close()
# sheet: 2 columns, numbered
TW = 760; TH = round(1222 * TW / 1287); PAD = 34; LAB = 74
W = 2 * TW + 3 * PAD; H = 5 * (TH + LAB + PAD) + PAD
sheet = Image.new('RGB', (W, H), '#f2f0eb'); dr = ImageDraw.Draw(sheet)
fnt = ImageFont.truetype(os.path.join(ROOT, 'fonts/t/PoppinsM.woff'), 40) if False else None
try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
except Exception: fnt = ImageFont.load_default()
for i, key in enumerate(keys):
    c, r = i % 2, i // 2; x = PAD + c * (TW + PAD); y = PAD + r * (TH + LAB + PAD)
    dr.text((x + 4, y + 10), f"{i + 1}  {names[key]}", fill='#222', font=fnt)
    im = Image.open(f'{OUT}/{key}.png').convert('RGB').resize((TW, TH), Image.LANCZOS)
    sheet.paste(im, (x, y + LAB))
sheet.save(f'{OUT}/sheet.jpg', quality=88); print('sheet', sheet.size)
