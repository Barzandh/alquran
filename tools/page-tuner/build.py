# Builds the standalone "AlQuran page tuner" (published as a claude.ai artifact) from the app itself:
# embeds the UthmanicHafs @font-face from index.html and a sample of mushaf markup (snip.html).
# Usage: python3 tools/page-tuner/build.py  -> /tmp/page-tuner/index.html
import os, re
d = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(d))
html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
font = re.search(r"@font-face\{font-family:'UthmanicHafs[^}]*\}", html).group(0)
s = open(os.path.join(d, 'tuner_src.html'), encoding='utf-8').read()
s = s.replace('__FONT__', font).replace('__SNIP__', open(os.path.join(d, 'snip.html'), encoding='utf-8').read())
os.makedirs('/tmp/page-tuner', exist_ok=True); open('/tmp/page-tuner/index.html', 'w', encoding='utf-8').write(s)
print('ok', len(s))
