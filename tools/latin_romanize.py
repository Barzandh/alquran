"""Latin reading of the Quran (Hafs, connected recitation) generated from the app's own
Uthmani text (Tanzil encoding: ۡ = sukun, ْ = always silent, ࣰࣱࣲ = tanween merged into
the next word, ۢ/ۭ = iqlab, ٰ = dagger alif, ۥ ۦ = silah, ٱ = hamzat al-wasl).

Output, one line per ayah: precise spelling (ā ī ū ḥ ṣ ḍ ṭ ẓ ‘ '); the app derives the
"easy" spelling (aa ee oo) from it. At a pause (ayah end, waqf mark) a word is read as
stopped on, and the ending used when you go on without stopping is kept in brackets:
raḥīm(i), aḥad(un), raḥmah(ti)."""
import gzip, sys, unicodedata

FATHA, DAMMA, KASRA = 'َ', 'ُ', 'ِ'
TAN = {'ً': ('a', False), 'ٌ': ('u', False), 'ٍ': ('i', False),
       'ࣰ': ('a', True), 'ࣱ': ('u', True), 'ࣲ': ('i', True)}
SHADDA, SUKUN, SILENT = 'ّ', 'ۡ', 'ْ'
DAGGER, MADDA, MADDA2 = 'ٰ', 'ٓ', 'ۤ'
HAMZA_A, HAMZA_B = 'ٔ', 'ٕ'
IQLAB = {'ۢ', 'ۭ'}
SMALL_HIGH_YEH, IMALA, TASHIL, SAKTA, SMALL_NOON, ROUND_ZERO = 'ۧ', 'ٜ', '۬', 'ۜ', 'ۨ', '۠'
WAQF = {'ۖ', 'ۗ', 'ۘ', 'ۚ'}           # pause allowed / required
IGNORE_MARKS = {'ۛ', MADDA, MADDA2}                  # mu'anaqa; madd lengths are not written
SKIP_CHARS = {'‏', '۞', '۩', '﻿'}     # RLM, rub el hizb, sajda sign
SILAH = {'ۥ': 'ū', 'ۦ': 'ī'}

CONS = {'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'ḥ', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r',
        'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 'ṣ', 'ض': 'ḍ', 'ط': 'ṭ', 'ظ': 'ẓ', 'ع': '‘', 'غ': 'gh',
        'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
        'ة': 't', 'ء': "'"}
LONG = {'a': 'ā', 'i': 'ī', 'u': 'ū'}
SHORT = {'ā': 'a', 'ī': 'i', 'ū': 'u', 'ē': 'e'}

MUQATTAAT = {  # (surah, ayah): Latin of the first word
    **{(s, 1): 'Alif lām mīm' for s in (2, 3, 29, 30, 31, 32)},
    (7, 1): 'Alif lām mīm ṣād', **{(s, 1): 'Alif lām rā' for s in (10, 11, 12, 14, 15)},
    (13, 1): 'Alif lām mīm rā', (19, 1): 'Kāf hā yā ‘ayn ṣād', (20, 1): 'Ṭā hā',
    (26, 1): 'Ṭā sīm mīm', (28, 1): 'Ṭā sīm mīm', (27, 1): 'Ṭā sīn', (36, 1): 'Yā sīn',
    (38, 1): 'Ṣād', **{(s, 1): 'Ḥā mīm' for s in range(40, 47)}, (42, 2): '‘Ayn sīn qāf',
    (50, 1): 'Qāf', (68, 1): 'Nūn',
}
# hamzat al-wasl read with i although the third letter carries a damma
WASL_I = {'امشوا', 'اقضوا', 'ائتوا', 'ائتوني', 'ابنوا', 'امضوا', 'امرؤا', 'امرؤ'}
SPLIT_AFTER_WA = {'لا', 'لم', 'لن', 'ما', 'من', 'هو', 'هم', 'هي', 'قد', 'لو', 'لولا', 'لقد', 'لكن',
                  'لما', 'كان', 'كانوا', 'كذلك', 'لئن'}


class Cl:
    __slots__ = ('b', 'm', 'w')
    def __init__(self, b, w): self.b, self.m, self.w = b, set(), w
    def __repr__(self): return self.b + ''.join(sorted(self.m))


def clusters(text):
    """flat list of letter clusters; .w = word index. Returns (clusters, words_waqf, words_sakta)."""
    out, waqf, sakta = [], [], []
    w = -1
    for word in text.split(' '):
        word = ''.join(ch for ch in word if ch not in SKIP_CHARS)
        if not word: continue
        if all(unicodedata.category(ch) == 'Mn' for ch in word):   # a lone pause mark
            if waqf and any(ch in WAQF for ch in word): waqf[-1] = True
            continue
        w += 1; waqf.append(False); sakta.append(False)
        for ch in word:
            if unicodedata.category(ch) == 'Mn':
                if ch in WAQF: waqf[w] = True
                elif ch == SAKTA and out[-1].b != 'ص': sakta[w] = True
                else: out[-1].m.add(ch)
            else:
                out.append(Cl(ch, w))
    return out, waqf, sakta


def plain(cs):
    return ''.join(c.b for c in cs if c.b not in 'ـۥۦ').replace('ٱ', 'ا').replace('ى', 'ي')


def vowel_of(c):
    for v, k in ((FATHA, 'a'), (DAMMA, 'u'), (KASRA, 'i')):
        if v in c.m: return k
    for t in TAN:
        if t in c.m: return TAN[t][0]
    return None


def tanween_of(c):
    for t in TAN:
        if t in c.m: return 'open' if TAN[t][1] else 'clear'
    if c.m & IQLAB and vowel_of(c): return 'iqlab'
    return None


def is_bare(c):
    return c.b in CONS and not (c.m & {FATHA, DAMMA, KASRA, SHADDA, SUKUN, SILENT, DAGGER, HAMZA_A, HAMZA_B, IMALA} or tanween_of(c))


def has_hamza(c):
    return c.b == 'ء' or (c.b in 'اوىيـ' and c.m & {HAMZA_A, HAMZA_B})


def romanize(text, s, a):
    cs, waqf, sakta = clusters(text)
    nw = len(waqf)
    words = [[] for _ in range(nw)]        # token lists: (kind, value, tag)
    glue = [False] * nw                     # word joins the previous one (hamzat al-wasl)
    pause = [False] * nw
    for w in range(nw): pause[w] = waqf[w] or w == nw - 1
    first_word = 0
    if (s, a) in MUQATTAAT:
        words[0] = [('P', MUQATTAAT[(s, a)], None)]
        cs = [c for c in cs if c.w != 0]
        first_word = 1
    restart = {first_word} | {w + 1 for w in range(nw) if pause[w] or sakta[w]}
    single = set()          # cluster index whose shadda letter is said once (first half went to the bare letter before)
    skip = set()

    def nxt(k):             # next sounding cluster after k
        j = k + 1
        while j < len(cs) and (SILENT in cs[j].m or cs[j].b in 'ۥۦ'): j += 1
        return j if j < len(cs) else None

    def last_vowel(tok):
        for i in range(len(tok) - 1, -1, -1):
            if tok[i][0] == 'V': return i
            if tok[i][0] in 'CN': return None
        return None

    for k, c in enumerate(cs):
        w, T = c.w, words[c.w]
        if k in skip: continue
        if SILENT in c.m: continue
        pos = sum(1 for x in cs[:k] if x.w == w)   # cluster position in word
        start = pos == 0
        if start and w > first_word and w not in restart and c.b == 'ٱ': glue[w] = True
        b, m = c.b, c.m
        j = nxt(k)
        nc = cs[j] if j is not None and cs[j].w in (w, w + 1) and not (cs[j].w == w + 1 and (w + 1) in restart) else None

        # ---- hamzat al-wasl ----
        if b == 'ٱ':
            if start and w in restart:
                p = plain([x for x in cs if x.w == w])
                n1 = cs[k + 1] if k + 1 < len(cs) and cs[k + 1].w == w else None
                n2 = cs[k + 2] if k + 2 < len(cs) and cs[k + 2].w == w else None
                if n1 and n1.b == 'ل' and (is_bare(n1) or SUKUN in n1.m or SHADDA in n1.m): v = 'a'
                elif n2 and DAMMA in n2.m and p not in WASL_I: v = 'u'
                else: v = 'i'
                T.append(('V', v, 'wasl'))
            continue
        # ---- silah (small waw / yeh after the pronoun ha) ----
        if b in SILAH:
            i = last_vowel(T)
            if i is not None and T[i][1] in 'ui': T[i] = ('V', LONG[T[i][1]], 'silah')
            continue
        # ---- carriers that are long vowels or silent ----
        if not has_hamza(c):
            if b == 'ا' and TASHIL in m:
                T += [('C', "'", None), ('V', 'a', None)]; continue
            if b == 'ا' and not vowel_of(c):
                i = last_vowel(T)
                if ROUND_ZERO in m: T.append(('OA', '', None)); continue
                if i is not None and T[i][1] == 'a' and not (i + 1 < len(T) and T[i + 1][0] == 'N'): T[i] = ('V', 'ā', T[i][2])
                continue
            if b == 'ى' and not vowel_of(c):
                i = last_vowel(T)
                tan = i is not None and i + 1 < len(T) and T[i + 1][0] == 'N'
                if tan: continue
                if i is not None and T[i][1] in ('a', 'ā'): T[i] = ('V', 'ā', None)
                elif i is not None and T[i][1] == 'i': T[i] = ('V', 'ī', None)
                elif DAGGER in m: T.append(('V', 'ā', None))
                continue
            if b == 'ـ':
                v = vowel_of(c)
                if SMALL_HIGH_YEH in m and v: T += [('C', 'y', None), ('V', v, None)]; continue
                if SMALL_HIGH_YEH in m:
                    i = last_vowel(T)
                    if i is not None: T[i] = ('V', 'ī', None)
                    continue
                if SMALL_NOON in m: T.append(('C', 'n', None)); continue
                if DAGGER in m:
                    i = last_vowel(T)
                    if i is not None and T[i][1] == 'a': T[i] = ('V', 'ā', None)
                    else: T.append(('V', 'ā', None))
                continue
            if b in 'وي' and is_bare(c) and not (nc is not None and SHADDA in nc.m and nc.b == b):
                i = last_vowel(T)
                pv = T[i][1] if i is not None else None
                if DAGGER in m:
                    if pv == 'a': T[i] = ('V', 'ā', None)
                    else: T.append(('V', 'ā', None))
                    continue
                if SMALL_HIGH_YEH in m and b == 'ي':
                    if i is not None: T[i] = ('V', 'ī', None)
                    continue
                if (b == 'و' and pv == 'u') or (b == 'ي' and pv == 'i'):
                    T[i] = ('V', LONG[pv], None); continue
                if pv in ('a', None) and i is not None and i == len(T) - 1:
                    T.append(('C', CONS[b], None)); continue      # diphthong aw / ay
                continue
            if b in 'وي' and DAGGER in m and not (m & {FATHA, DAMMA, KASRA, SHADDA, SUKUN}):
                i = last_vowel(T)
                if i is not None and T[i][1] == 'a': T[i] = ('V', 'ā', None)
                else: T.append(('V', 'ā', None))
                continue
        # ---- consonants ----
        cons = "'" if has_hamza(c) else CONS.get(b)
        if cons is None: continue
        if b == 'ص' and SAKTA in m: cons = 's'
        if is_bare(c) and not has_hamza(c):
            if SMALL_NOON in m: T.append(('C', 'n', None)); continue
            if b == 'ن' and m & IQLAB: T.append(('C', 'm', None)); continue
            if nc is not None and SHADDA in nc.m and not sakta[w]:
                T.append(('C', 'n' if (b == 'ن' and nc.b in 'ب') else CONS.get(nc.b, cons) if not has_hamza(nc) else cons, 'assim'))
                single.add(j)
                if is_article(cs, k): T.append(('H', '-', None))
                continue
            if b == 'ن' and nc is not None and nc.b in 'وي' and not has_hamza(nc) and nc.w == w + 1 and not sakta[w]:
                T.append(('C', CONS[nc.b], None)); continue
            T.append(('C', cons, None))
            if is_article(cs, k): T.append(('H', '-', None))
            continue
        if SHADDA in m and k not in single and not start:
            T.append(('C', cons, None))
            if is_article(cs, k): T.append(('H', '-', None))
        T.append(('C', cons, 'tm' if b == 'ة' else None))
        if SUKUN in m and is_article(cs, k): T.append(('H', '-', None))
        v = vowel_of(c)
        if v is None and has_hamza(c) and m & {MADDA, MADDA2}: v = 'ā'
        if IMALA in m:
            T.append(('V', 'ē', None))
            if j is not None and cs[j].b == 'ى': skip.add(j)
            continue
        if v is None:
            if DAGGER in m: T.append(('V', 'ā', None))
            continue
        if v == 'a' and (DAGGER in m or is_allah(cs, k)): v = 'ā'
        tan = tanween_of(c)
        T.append(('V', v, None))
        if tan:
            j2 = k + 1
            while j2 < len(cs) and cs[j2].w == w: j2 += 1
            while j2 < len(cs) and (SILENT in cs[j2].m or cs[j2].b == 'ٱ' and False): j2 += 1
            T.append(('N', tan, j2 if j2 < len(cs) else None))

    # ---- realise tanween, joins, pauses ----
    for w in range(nw):
        T = words[w]
        for i, t in enumerate(T):
            if t[0] != 'N': continue
            kind, j = t[1], t[2]
            n = 'n'
            if kind == 'iqlab': n = 'm'
            elif w + 1 < nw and not pause[w] and not sakta[w]:
                if glue[w + 1]: n = 'ni'
                elif kind == 'open' and j is not None and cs[j].w == w + 1:
                    nb = cs[j]
                    if SHADDA in nb.m and not has_hamza(nb): n = CONS.get(nb.b, 'n'); single.add(j)
                    elif nb.b in 'وي' and not has_hamza(nb): n = CONS[nb.b]
            T[i] = ('N', n, None)
    # vocative yā and the conjunctions wa / fa are written apart, as in most Latin mushafs
    for w in range(nw):
        wc = [x for x in cs if x.w == w]
        T = words[w]
        if len(wc) < 2 or len(T) < 3 or T[0][0] != 'C': continue
        c0 = wc[0]
        cut = None
        if c0.b == 'ي' and FATHA in c0.m and DAGGER in c0.m: cut = 2
        elif c0.b in 'وف' and c0.m == {FATHA} and ((has_hamza(wc[1]) and (vowel_of(wc[1]) or wc[1].m & {MADDA, MADDA2} or (len(wc) > 2 and wc[2].b == 'ا'))) or plain(wc[1:]) in SPLIT_AFTER_WA): cut = 2
        if cut and T[1][0] == 'V':
            rest = T[cut:]
            if rest and rest[0][0] == 'C' and rest[0][1] == "'": rest = rest[1:]
            words[w] = T[:cut] + [('S', ' ', None)] + rest
    for w in range(1, nw):
        if glue[w]:
            P = words[w - 1]
            while P and P[-1][0] == 'OA': P.pop()
            if P and P[-1][0] == 'V' and P[-1][1] in SHORT: P[-1] = ('V', SHORT[P[-1][1]], P[-1][2])
    for w in range(nw):
        T = words[w]
        if pause[w] and T and T[0][0] != 'P' or (pause[w] and len(T) > 1):
            pause_form(T)
        else:
            words[w] = [t for t in T if t[0] != 'OA']
    return render(words, glue, pause, sakta, nw)


def is_article(cs, k):
    """lam of the definite article (after ٱ, or the لِل of li + al-)"""
    c = cs[k]
    if c.b != 'ل': return False
    if is_allah(cs, k) or (k + 1 < len(cs) and cs[k + 1].w == c.w and is_allah(cs, k + 1)): return False
    prev = cs[k - 1] if k and cs[k - 1].w == c.w else None
    if prev is None: return False
    if prev.b == 'ٱ': return True
    if prev.b == 'ل' and KASRA in prev.m:
        pp = cs[k - 2] if k >= 2 and cs[k - 2].w == c.w else None
        return pp is None or (pp.b in 'وف' and FATHA in pp.m and (k < 3 or cs[k - 3].w != c.w))
    return False


def is_allah(cs, k):
    c = cs[k]
    if c.b != 'ل' or SHADDA not in c.m or FATHA not in c.m or DAGGER in c.m: return False
    prev = cs[k - 1] if k and cs[k - 1].w == c.w else None
    nx = cs[k + 1] if k + 1 < len(cs) and cs[k + 1].w == c.w else None
    if not prev or prev.b != 'ل' or not nx or nx.b != 'ه' or SUKUN in nx.m: return False
    after = cs[k + 2] if k + 2 < len(cs) and cs[k + 2].w == c.w else None
    return after is None or (after.b == 'م' and SHADDA in after.m)


def pause_form(T):
    while T and T[-1][0] == 'OA':
        T.pop()
        i = len(T) - 1
        if i >= 0 and T[i][0] == 'V' and T[i][1] == 'a': T[i] = ('V', 'ā', None)
        return
    if not T: return
    if T[-1][0] == 'N':
        n = T.pop(); v = T.pop()
        if T and T[-1][0] == 'C' and T[-1][2] == 'tm':
            T[-1] = ('C', 'h', None); T.append(('P', '(t' + v[1] + 'n)', None))
        elif v[1] == 'a': T.append(('V', 'ā', None)); T.append(('P', '(n)', None))
        else: T.append(('P', '(' + v[1] + 'n)', None))
        return
    if T[-1][0] == 'V':
        v = T[-1]
        if v[2] == 'silah': T.pop(); T.append(('P', '(' + v[1] + ')', None)); return
        if v[1] in 'aiu' and v[2] != 'wasl' and len(T) > 1:
            T.pop()
            if T and T[-1][0] == 'C' and T[-1][2] == 'tm': T[-1] = ('C', 'h', None); T.append(('P', '(t' + v[1] + ')', None))
            else: T.append(('P', '(' + v[1] + ')', None))
            return
    if T[-1][0] == 'C' and T[-1][2] == 'tm': T[-1] = ('C', 'h', None)


def render(words, glue, pause, sakta, nw):
    out = ''
    for w in range(nw):
        T = words[w]
        s = ''
        prev = None
        for i, t in enumerate(T):
            k, v = t[0], t[1]
            if k == 'C':
                if prev is not None and prev[0] == 'C' and v == 'h' and prev[1] in ('t', 'd', 'k', 's', 'g'): s += '-'
                if v == "'" and (s == '' or s.endswith('-')) and not (glue[w] and out and not s): pass
                if v == "'" and (s.endswith(('-', ' ')) or (s == '' and not glue[w])): prev = t; continue
                s += v
            elif k in ('V', 'P'): s += v
            elif k == 'N': s += v
            elif k == 'H': s += '-'
            elif k == 'S': s += ' '
            prev = t
        if not s: continue
        if glue[w] and out and not out.endswith((' ', ', ')):
            out += s
        else:
            out += ('' if not out else ' ') + s
        if sakta[w]: out += '…'
        elif pause[w]: out += '.' if w == nw - 1 else ','
    out = out.replace('- ', ' ')
    for i, ch in enumerate(out):
        if ch.isalpha():
            out = out[:i] + ch.upper() + out[i + 1:]; break
    return out


SURAH_AYAHS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6]
REFS = [(s, a) for s, n in enumerate(SURAH_AYAHS, 1) for a in range(1, n + 1)]

if __name__ == '__main__':
    L = gzip.open(sys.argv[1]).read().decode('utf-8').split('\n')
    assert len(L) == 6236 == len(REFS)
    res = [romanize(l.replace('﻿', ''), *REFS[i]) for i, l in enumerate(L)]
    if len(sys.argv) > 2 and sys.argv[2].endswith('.bin'):
        with gzip.open(sys.argv[2], 'wb', compresslevel=9) as f: f.write('\n'.join(res).encode('utf-8'))
    elif len(sys.argv) > 2:
        for spec in sys.argv[2:]:
            s, a = map(int, spec.split(':'))
            print(spec, res[REFS.index((s, a))])
