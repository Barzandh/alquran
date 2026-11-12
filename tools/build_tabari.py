"""Tafsir al-Tabari (Jami' al-Bayan) -> data/tabari/NNN.bin : one gzip file per surah,
one line per ayah. Editor footnotes [[...]] are removed; paragraph breaks become U+2029."""
import json, sys, gzip, re, os
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
tot = 0; dup = 0; prev = None
for s in range(1, 115):
    d = json.load(open(f'{src}/{s}.json', encoding='utf-8'))
    d.sort(key=lambda x: int(x['ayah']))
    assert [int(x['ayah']) for x in d] == list(range(1, len(d) + 1)) and all(int(x['surah']) == s for x in d)
    lines = []; prev = None
    for x in d:
        t = x['text'].replace('\r', '')
        t = re.sub(r'\s*\[\[.*?\]\]', '', t, flags=re.S)
        t = re.sub(r'[ \t]+', ' ', t)
        t = re.sub(r'\n\s*\n+', ' ', t.strip()).replace('\n', ' ')
        if t == prev: dup += 1
        prev = t
        lines.append(t)
    # ayat explained together carry the same text: keep it once, as in the Sa'di data
    # (first ayah: '⟦N-M⟧' + text, the others: '^N-M')
    i = 0
    while i < len(lines):
        j = i
        while j + 1 < len(lines) and lines[j + 1] == lines[i]: j += 1
        if j > i:
            lines[i] = f'⟦{i + 1}-{j + 1}⟧' + lines[i]
            for k in range(i + 1, j + 1): lines[k] = f'^{i + 1}-{j + 1}'
        i = j + 1
    data = '\n'.join(lines).encode('utf-8')
    tot += len(data)
    with gzip.open(f'{out}/{s:03d}.bin', 'wb', compresslevel=9) as f: f.write(data)
print('raw bytes', tot, 'duplicate neighbours', dup)
