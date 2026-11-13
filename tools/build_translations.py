"""Spanish, Swedish, Norwegian, Dutch and Polish Quran translations for AlQuran -> data/*.bin
(gzip, one line per ayah, 6236 lines). Source: fawazahmed0/quran-api editions/<name>.min.json
Usage: python3 build_translations.py <folder with the .json files> <data folder>"""
import json, sys, gzip, re, os
SRC, OUT = sys.argv[1], sys.argv[2]
EDS = ['spa-juliocortes', 'spa-muhammadisagarc', 'swe-knutbernstrom', 'nor-einarberg',
       'nld-sofianssiregar', 'nld-fredleemhuis', 'pol-jozefabielawski']
for e in EDS:
    q = json.load(open(f'{SRC}/{e}.json', encoding='utf-8'))['quran']
    assert len(q) == 6236, e
    assert [(x['chapter'], x['verse']) for x in q] == sorted((x['chapter'], x['verse']) for x in q), e
    lines = [re.sub(r'\s+', ' ', x['text']).strip() for x in q]
    assert all(lines), e
    with gzip.open(f'{OUT}/{e}.bin', 'wb', compresslevel=9) as f: f.write('\n'.join(lines).encode('utf-8'))
    print(e, os.path.getsize(f'{OUT}/{e}.bin'))
