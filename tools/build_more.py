"""Extra translations / tafsirs for AlQuran -> data/*.bin (gzip, one line per ayah).
Tafsir: ayat explained together are stored once ('⟦N-M⟧' + text, the others '^N-M');
paragraph breaks become U+2029; editor notes [[...]] are removed."""
import json, sys, gzip, re, os
SRC, OUT = sys.argv[1], sys.argv[2]
AY = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]
def clean(t):
    t = (t or '').replace('\r', '')
    t = re.sub(r'\s*\[\[.*?\]\]', '', t, flags=re.S)
    t = re.sub(r'[ \t]+', ' ', t)
    return re.sub(r'\n\s*\n+', ' ', t.strip()).replace('\n', ' ')
def group(lines):
    i = 0
    while i < len(lines):
        j = i
        while j + 1 < len(lines) and lines[j + 1] == lines[i] and len(lines[i]) > 40: j += 1
        if j > i:
            lines[i] = f'⟦{i + 1}-{j + 1}⟧' + lines[i]
            for k in range(i + 1, j + 1): lines[k] = f'^{i + 1}-{j + 1}'
        i = j + 1
    return lines
def tafsir_surahs(d):
    for s in range(1, 115):
        a = sorted(json.load(open(f'{SRC}/tf/{d}/{s}.json', encoding='utf-8')), key=lambda x: int(x['ayah']))
        assert len(a) == AY[s - 1] and [int(x['ayah']) for x in a] == list(range(1, AY[s - 1] + 1)), (d, s)
        yield s, group([clean(x['text']) for x in a])
def write(path, lines):
    with gzip.open(path, 'wb', compresslevel=9) as f: f.write('\n'.join(lines).encode('utf-8'))
for d, out in [('en-tafsir-al-mukhtasar', 'eng-mukhtasar'), ('french-mokhtasar', 'fra-mukhtasar'), ('spanish-mokhtasar', 'spa-mukhtasar'), ('kurdish-mokhtasar', 'kur-mukhtasar'), ('kurd-tafsir-rebar', 'kur-rebar')]:
    lines = [l for s, ls in tafsir_surahs(d) for l in ls]; assert len(lines) == 6236
    write(f'{OUT}/{out}.bin', lines); print(out, os.path.getsize(f'{OUT}/{out}.bin'))
os.makedirs(f'{OUT}/ibnkathir', exist_ok=True); tot = 0
for s, ls in tafsir_surahs('en-tafisr-ibn-kathir'):
    write(f'{OUT}/ibnkathir/{s:03d}.bin', ls); tot += os.path.getsize(f'{OUT}/ibnkathir/{s:03d}.bin')
print('ibnkathir', tot)
for f, out in [('german_aburida', 'deu-aburida'), ('german_rwwad', 'deu-rwwad')]:
    d = json.load(open(f'{SRC}/{f}.json', encoding='utf-8'))
    lines = []
    for s in range(1, 115):
        a = sorted(d[str(s)], key=lambda x: int(x['verse'])); assert len(a) == AY[s - 1], (f, s)
        lines += [re.sub(r'\s+', ' ', x['text']).strip() for x in a]
    assert len(lines) == 6236 and all(lines)
    write(f'{OUT}/{out}.bin', lines); print(out, os.path.getsize(f'{OUT}/{out}.bin'))
