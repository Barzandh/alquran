# Writes the content fingerprint of every offline file into sw.js (const HASH = {...};),
# so phones re-download only files whose content changed. Run after bumping BUILD.
import hashlib, json, re, sys, os
root = sys.argv[1] if len(sys.argv) > 1 else '.'
sw = open(os.path.join(root, 'sw.js'), encoding='utf-8').read()
shell = json.loads(re.search(r"const SHELL = (\[[^\]]*\]);", sw).group(1).replace("'", '"'))
h = {}
for u in shell:
    p = 'index.html' if u == './' else u[2:]
    h[u] = hashlib.sha256(open(os.path.join(root, p), 'rb').read()).hexdigest()[:16]
line = 'const HASH = ' + json.dumps(h, separators=(',', ':')) + ';'
if re.search(r'^const HASH = .*;$', sw, re.M): sw = re.sub(r'^const HASH = .*;$', lambda m: line, sw, flags=re.M)
else: sw = re.sub(r'^(const SHELL = .*;)$', lambda m: m.group(1) + '\n' + line, sw, count=1, flags=re.M)
open(os.path.join(root, 'sw.js'), 'w', encoding='utf-8').write(sw)
build = re.search(r"const BUILD = '([0-9.]+)'", sw).group(1)
open(os.path.join(root, 'version.json'), 'w').write(json.dumps({'build': build}) + '\n')   # what the app checks for updates
print(len(h), 'fingerprints written; version.json =', build)
