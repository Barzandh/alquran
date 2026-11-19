"""Add UI strings to every interface language pack of AlQuran's index.html.

entries: {english_key: {'ar':..., 'ku':..., 'kb':..., 'fr':..., 'de':..., 'es':..., 'kl':...}}
Missing languages fall back to English (LTR) / Sorani (kb). Existing keys are overwritten.
Templates (with # for numbers and @ for words) go in with kind='tpl'.
"""
import json, re

def _js_obj_insert(s, decl, items, quote):
    i = s.index(decl) + len(decl)
    parts = []
    for k, v in items:
        if quote == "'":
            kk = k.replace('\\', '\\\\').replace("'", "\\'")
            vv = v.replace('\\', '\\\\').replace("'", "\\'")
            parts.append(f"'{kk}': '{vv}', ")
        else:
            parts.append(f"{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}, ")
    return s[:i] + '\n  ' + ''.join(parts) + s[i:]

def add(s, entries, kind='dict'):
    decls = {'dict': {'ar': ("const AR = {", "'"), 'ku': ("const KU = {", '"'), 'kb': ("const KB = {", '"')},
             'tpl': {'ar': ("const AR_T = {", "'"), 'ku': ("const KU_T = {", '"'), 'kb': ("const KB_T = {", '"')}}[kind]
    for lang, (decl, q) in decls.items():
        items = [(k, v[lang]) for k, v in entries.items() if v.get(lang)]
        if items:
            assert s.count(decl) == 1, decl
            s = _js_obj_insert(s, decl, items, q)
    for lang in ('fr', 'de', 'es', 'kl'):
        m = re.search(r'(<script type="application/json" id="i18n-%s">)(.*?)(</script>)' % lang, s, re.S)
        pack = json.loads(m.group(2))
        key = 'dict' if kind == 'dict' else 'tpl'
        for k, v in entries.items():
            if v.get(lang):
                pack[key][k] = v[lang]
        s = s[:m.start(2)] + json.dumps(pack, ensure_ascii=False).replace('</', '<\\/') + s[m.end(2):]
    return s
