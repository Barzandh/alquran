/* Candidate home-window designs, same contract as RBX in index.html:
   NEW_RBX[key](d, k, lab, p) -> HTML for a 1287 x 1222 canvas; NEW_CSS[key] -> its CSS.
   Extra fields these designs need from rbxData(): mt, m0..m5 (minutes since midnight), c0..c3 / s0 s1 (clock digits),
   pa0..pa5 (' x-past' for prayers already gone). */
const NEW_RBX = {}, NEW_CSS = {};
const nb = key => `.rbx-${key}{position:relative;width:1287px;height:1222px;overflow:hidden}.rbx-${key} *{box-sizing:border-box}
.rbx-${key} .x-a{position:absolute}.rbx-${key} .ar{direction:rtl}.rbx-${key} .x-ctr{left:0;right:0;text-align:center}.rbx-${key} svg.x-full{position:absolute;inset:0}`;
const PR6 = [0, 1, 2, 3, 4, 5];

/* 1 · Sun Path — the day as the sun's arc: sunrise to maghrib, the sun where it is now */
NEW_RBX.sunpath = (d, k, lab, p) => {
  const cx = 643, cy = 850, r = 440, sr = d.m1, ss = d.m4;
  const ang = m => Math.PI * (1 - Math.max(0, Math.min(1, (m - sr) / (ss - sr))));
  const pt = m => [cx + r * Math.cos(ang(m)), cy - r * Math.sin(ang(m))];
  const [sx, sy] = pt(d.mt), day = d.mt > sr && d.mt < ss;
  const dot = (i, up) => { const [x, y] = pt(d['m' + i]); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#f6f1e7" stroke="#b9a685" stroke-width="3"/>`; };
  const lbl = i => { const [x, y] = pt(d['m' + i]), a = ang(d['m' + i]), end = i === 1 || i === 4, ox = end ? 0 : Math.cos(a) * 54, oy = end ? 44 : -Math.sin(a) * 54;
    return `<div class="x-a x-al" style="left:${(x + ox - 110).toFixed(0)}px;top:${(y + oy - 20).toFixed(0)}px">${k('p' + i + 'e')}</div>`; };
  return `<svg class="x-full" viewBox="0 0 1287 1222"><defs><radialGradient id="${p}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f6b24a" stop-opacity=".55"/><stop offset="1" stop-color="#f6b24a" stop-opacity="0"/></radialGradient></defs>
  <rect y="${cy}" width="1287" height="${1222 - cy}" fill="#ebe2d0"/><line x1="60" x2="1227" y1="${cy}" y2="${cy}" stroke="#cbbb9d" stroke-width="3"/>
  <path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#d8cbb2" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round"/>
  ${day ? `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${sx.toFixed(1)} ${sy.toFixed(1)}" fill="none" stroke="#e08a2e" stroke-width="7" stroke-linecap="round"/>` : ''}
  ${[1, 2, 3, 4].map(i => dot(i)).join('')}
  ${day ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="90" fill="url(#${p}g)"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="30" fill="#f0a136"/>` : ''}</svg>
  <div class="x-a x-pm" style="left:70px;top:58px;font-size:56px;color:#2b2722"><svg width="34" height="44" viewBox="0 0 84 104" style="margin-right:14px;vertical-align:-2px"><path d="M42 100C24 76 8 58 8 38a34 34 0 0 1 68 0c0 20-16 38-34 62z" fill="none" stroke="#e08a2e" stroke-width="9"/><circle cx="42" cy="38" r="11" fill="#e08a2e"/></svg>${k('city')}</div>
  <div class="x-a x-pl" style="left:72px;top:140px;font-size:32px;line-height:1.5;color:#7a6f60;text-align:left">${k('date')}<br>${k('hij')}</div>
  <div class="x-a x-pl" style="right:70px;top:44px;font-size:170px;line-height:1;color:#2b2722;letter-spacing:-.02em">${k('hm')}<span class="x-pm" style="font-size:40px;letter-spacing:0;color:#e08a2e;margin-left:12px">${k('sec')}</span><span class="x-pm" style="font-size:36px;letter-spacing:0;color:#7a6f60;margin-left:10px">${k('ap')}</span></div>
  ${[1, 2, 3, 4].map(lbl).join('')}
  <div class="x-a x-ctr x-pm" style="top:560px;font-size:26px;letter-spacing:.32em;color:#9a8d78">${lab('Next prayer')}</div>
  <div class="x-a x-ctr" style="top:600px;line-height:1.1"><span class="x-pm" style="font-size:88px;color:#2b2722">${k('nx')}</span><span class="x-em ar" style="font-size:64px;color:#e08a2e;margin-left:26px">${k('nxar')}</span></div>
  <div class="x-a x-ctr x-pl" style="top:708px;font-size:50px;color:#2b2722">${k('nt')} ${k('nap')}<span style="color:#9a8d78;font-size:36px;margin-left:22px">− ${k('cd')}</span></div>
  <div class="x-row">${PR6.map(i => `<div class="x-c${d['on' + i]}${d['pa' + i]}"><b>${k('p' + i + 'e')}</b><span>${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}</div>`;
};
NEW_CSS.sunpath = nb('sunpath') + `
.rbx-sunpath{background:linear-gradient(180deg,#fbf7ef 0%,#f6f1e7 70%);color:#2b2722}
.rbx-sunpath .x-pl{font-family:PoppinsL}.rbx-sunpath .x-pm{font-family:PoppinsM}.rbx-sunpath .x-em{font-family:ElMessiri;font-weight:700}
.rbx-sunpath .x-al{width:220px;text-align:center;font:30px PoppinsL;color:#8a7c66}
.rbx-sunpath .x-row{position:absolute;left:60px;right:60px;top:930px;display:flex;gap:10px}
.rbx-sunpath .x-c{flex:1;height:200px;border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:PoppinsL}
.rbx-sunpath .x-c b{font-family:PoppinsM;font-weight:400;font-size:31px;color:#5d5346}.rbx-sunpath .x-c span{font-size:36px;color:#2b2722}
.rbx-sunpath .x-c.x-past{opacity:.45}
.rbx-sunpath .x-c.x-on{background:#2b2722}.rbx-sunpath .x-c.x-on b{color:#f0a136}.rbx-sunpath .x-c.x-on span{color:#fbf7ef}`;

/* 2 · Bauhaus — primary shapes, big condensed type */
NEW_RBX.bauhaus = (d, k, lab, p) => `<svg class="x-full" viewBox="0 0 1287 1222"><circle cx="1150" cy="150" r="250" fill="#d6402b"/><rect x="1080" y="400" width="207" height="207" fill="#1b1b1b"/>
  <path d="M0 1222V1062a160 160 0 0 1 320 0v160z" fill="#f0b31b"/><rect x="760" y="1150" width="527" height="72" fill="#1e3c8c"/></svg>
  <div class="x-a x-bb" style="left:64px;top:44px;font-size:118px;line-height:1;letter-spacing:.02em">${k('city', 1)}</div>
  <div class="x-a x-oz" style="left:68px;top:168px;font-size:34px;letter-spacing:.08em;line-height:1.45">${k('date', 1)}<br><span style="color:#d6402b">${k('hij', 1)}</span></div>
  <div class="x-a x-bb" style="left:56px;top:278px;font-size:370px;line-height:1">${k('hm')}</div>
  <div class="x-a x-bb" style="left:1100px;top:426px;width:167px;text-align:center;font-size:96px;line-height:1;color:#f1ebdf">${k('sec')}<div class="x-oz" style="font-size:34px;color:#f0b31b;margin-top:2px">${k('ap')}</div></div>
  <div class="x-a" style="left:64px;top:660px;width:660px;height:460px;background:#1e3c8c;color:#fff;padding:34px 44px">
    <div class="x-oz" style="font-size:30px;letter-spacing:.3em;color:#f0b31b">${lab('Next prayer')}</div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:8px"><span class="x-bb" style="font-size:170px;line-height:1">${k('nx', 1)}</span><span class="x-rk ar" style="font-size:84px;color:#f0b31b">${k('nxar')}</span></div>
    <div class="x-bb" style="font-size:96px;line-height:1;margin-top:6px">${k('nt')} <span style="font-size:56px">${k('nap')}</span></div>
    <div class="x-oz" style="font-size:36px;letter-spacing:.12em;margin-top:14px;color:#c9d3f0">− ${k('cd')}</div></div>
  <div class="x-list">${PR6.map(i => `<div class="x-r${d['on' + i]}${d['pa' + i]}"><b>${k('p' + i + 'e', 1)}</b><span>${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}</div>`;
NEW_CSS.bauhaus = nb('bauhaus') + `
.rbx-bauhaus{background:#f1ebdf;color:#1b1b1b}.rbx-bauhaus .x-bb{font-family:Bebas}.rbx-bauhaus .x-oz{font-family:Oswald}.rbx-bauhaus .x-rk{font-family:Rakkas}
.rbx-bauhaus .x-list{position:absolute;left:770px;right:64px;top:660px;height:460px;display:flex;flex-direction:column;border-top:6px solid #1b1b1b}
.rbx-bauhaus .x-r{flex:1;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1b1b1b;font-family:Oswald;font-size:38px;padding:0 6px}
.rbx-bauhaus .x-r b{font-weight:400;letter-spacing:.06em}.rbx-bauhaus .x-r.x-past{opacity:.4}
.rbx-bauhaus .x-r.x-on{background:#d6402b;color:#fff;border-bottom-color:#d6402b;padding:0 16px}`;

/* 3 · Almanac — a newspaper front page */
NEW_RBX.almanac = (d, k, lab, p) => `<div class="x-a x-ctr x-pf" style="top:40px;font-size:30px;letter-spacing:.34em;color:#8a1c1c">${k('hij', 1)}</div>
  <div class="x-a" style="left:70px;right:70px;top:92px;border-top:3px solid #1b1b1b;border-bottom:1px solid #1b1b1b;height:9px"></div>
  <div class="x-a x-ctr x-pfi" style="top:104px;font-size:150px;line-height:1.08">${k('city')}</div>
  <div class="x-a" style="left:70px;right:70px;top:278px;border-top:1px solid #1b1b1b;border-bottom:3px solid #1b1b1b;height:9px"></div>
  <div class="x-a x-ctr x-cg" style="top:300px;font-size:34px;letter-spacing:.2em">${k('date', 1)}</div>
  <div class="x-a" style="left:70px;top:378px;width:560px;height:420px;border-right:1px solid #1b1b1b">
    <div class="x-cg" style="font-size:28px;letter-spacing:.3em;color:#8a1c1c">${lab('Current time')}</div>
    <div class="x-pf" style="font-size:210px;line-height:1.05;letter-spacing:-.02em">${k('hm')}</div>
    <div class="x-cg" style="font-size:54px;margin-top:6px">${k('sec')} <span style="color:#6d655a">·</span> ${k('ap')}</div></div>
  <div class="x-a" style="left:672px;top:378px;width:545px">
    <div class="x-cg" style="font-size:28px;letter-spacing:.3em;color:#8a1c1c">${lab('Next prayer')}</div>
    <div class="x-pf" style="font-size:112px;line-height:1.1">${k('nx')}</div>
    <div class="x-am ar" style="font-size:72px;line-height:1.3;text-align:left;color:#8a1c1c">${k('nxar')}</div>
    <div class="x-pfi" style="font-size:60px;line-height:1.25">${k('nt')} ${k('nap')}</div>
    <div class="x-cg" style="font-size:46px;color:#6d655a">− ${k('cd')}</div></div>
  <div class="x-a" style="left:70px;right:70px;top:836px;border-top:3px solid #1b1b1b"></div>
  <div class="x-tab">${PR6.map(i => `<div class="x-t${d['on' + i]}${d['pa' + i]}"><span class="x-pf">${k('p' + i + 'e')}</span><i></i><span class="x-cg">${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}</div>`;
NEW_CSS.almanac = nb('almanac') + `
.rbx-almanac{background:#f4efe4;color:#1b1b1b}
.rbx-almanac::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(80,60,30,.025) 0 2px,transparent 2px 6px)}
.rbx-almanac .x-pf{font-family:Playfair}.rbx-almanac .x-pfi{font-family:Playfair;font-style:italic}.rbx-almanac .x-cg{font-family:Cormorant;font-weight:600}.rbx-almanac .x-am{font-family:AmiriT}
.rbx-almanac .x-tab{position:absolute;left:70px;right:70px;top:866px;display:grid;grid-template-columns:1fr 1fr;column-gap:80px;row-gap:14px}
.rbx-almanac .x-t{display:flex;align-items:baseline;gap:14px;font-size:44px;height:92px;padding-top:14px}
.rbx-almanac .x-t i{flex:1;border-bottom:3px dotted #9b8f7c;transform:translateY(-10px)}
.rbx-almanac .x-t .x-cg{font-size:46px}.rbx-almanac .x-t.x-past{opacity:.42}
.rbx-almanac .x-t.x-on{color:#8a1c1c}.rbx-almanac .x-t.x-on i{border-color:#8a1c1c}`;

/* 4 · Departures — a station split-flap board */
const flap = (k, n, cls) => `<span class="x-fl ${cls || ''}">${k(n)}</span>`;
NEW_RBX.departures = (d, k, lab, p) => `<div class="x-a" style="left:0;right:0;top:0;height:132px;background:#f5c400;color:#111;display:flex;align-items:center;justify-content:space-between;padding:0 56px">
    <span class="x-oz" style="font-size:58px;letter-spacing:.06em">${lab('Prayer times')}</span><span class="x-oz" style="font-size:58px;letter-spacing:.06em">${k('city', 1)}</span></div>
  <div class="x-a x-oz" style="left:56px;top:178px;font-size:38px;line-height:1.5;color:#f5c400;letter-spacing:.06em">${k('wdu')}<br><span style="color:#e9e6dc">${k('day')} ${k('my', 1)}</span><br><span style="color:#8d8a80;font-size:32px">${k('hij', 1)}</span></div>
  <div class="x-a x-clock">${flap(k, 'c0')}${flap(k, 'c1')}<span class="x-col">:</span>${flap(k, 'c2')}${flap(k, 'c3')}<span class="x-sm">${flap(k, 's0', 'x-s')}${flap(k, 's1', 'x-s')}<b class="x-oz">${k('ap')}</b></span></div>
  <div class="x-rows">${PR6.map(i => `<div class="x-r${d['on' + i]}${d['pa' + i]}"><span class="x-t">${k('p' + i + 'h')}<small>${k('p' + i + 'm')}</small></span><span class="x-n">${k('p' + i + 'e', 1)}</span><span class="x-ar ar">${k('p' + i + 'a')}</span><span class="x-st">${d['on' + i] ? k('cd') : d['pa' + i] ? '✓' : ''}</span></div>`).join('')}</div>`;
NEW_CSS.departures = nb('departures') + `
.rbx-departures{background:#0e0f11;color:#e9e6dc}.rbx-departures .x-oz{font-family:Oswald}
.rbx-departures .x-clock{right:56px;top:170px;display:flex;align-items:center;gap:12px}
.rbx-departures .x-fl{position:relative;display:inline-block;width:132px;height:196px;border-radius:14px;background:linear-gradient(180deg,#26272b 0 49.5%,#0e0f11 49.5% 50.5%,#1d1e21 50.5%);font:400 168px/196px Oswald;text-align:center;color:#f5c400;box-shadow:inset 0 2px 0 rgba(255,255,255,.06)}
.rbx-departures .x-fl.x-s{width:62px;height:92px;font-size:76px;line-height:92px;border-radius:8px;color:#e9e6dc}
.rbx-departures .x-col{font:400 120px Oswald;color:#f5c400;margin:0 -2px}
.rbx-departures .x-sm{display:flex;flex-wrap:wrap;width:140px;gap:6px 8px;align-self:flex-end}.rbx-departures .x-sm b{font-size:44px;font-weight:400;color:#f5c400;width:100%;text-align:center}
.rbx-departures .x-rows{position:absolute;left:40px;right:40px;top:430px;bottom:40px;display:flex;flex-direction:column;gap:10px}
.rbx-departures .x-r{flex:1;display:flex;align-items:center;gap:30px;padding:0 26px;border-radius:12px;background:#17181b;font-family:Oswald}
.rbx-departures .x-t{width:250px;font-size:66px;color:#f5c400;letter-spacing:.04em}.rbx-departures .x-t small{font-size:30px;margin-left:8px}
.rbx-departures .x-n{flex:1;font-size:56px;letter-spacing:.08em}.rbx-departures .x-ar{font-family:Cairo;font-weight:700;font-size:50px;color:#b9b5a8;width:220px;text-align:right}
.rbx-departures .x-st{width:230px;text-align:right;font-size:46px;color:#7fd17f}
.rbx-departures .x-r.x-past{opacity:.38}.rbx-departures .x-r.x-past .x-st{color:#e9e6dc}
.rbx-departures .x-r.x-on{background:#f5c400;color:#111}.rbx-departures .x-r.x-on .x-t,.rbx-departures .x-r.x-on .x-ar,.rbx-departures .x-r.x-on .x-st{color:#111}`;

/* 5 · Astrolabe — engraved brass dial, noon at the top, the hand at now */
NEW_RBX.astrolabe = (d, k, lab, p) => {
  const cx = 643, cy = 560, R = 486;
  const at = (m, rr) => { const a = (m / 1440 * 360 + 180) * Math.PI / 180; return [cx + rr * Math.sin(a), cy - rr * Math.cos(a)]; };
  let ticks = '';
  for (let h = 0; h < 96; h++) { const big = h % 12 === 0, [x1, y1] = at(h * 15, R - (big ? 30 : h % 4 === 0 ? 20 : 10)), [x2, y2] = at(h * 15, R);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }
  const nums = [0, 3, 6, 9, 12, 15, 18, 21].map(h => { const [x, y] = at(h * 60, R + 38); return `<text x="${x.toFixed(1)}" y="${(y + 10).toFixed(1)}">${h}</text>`; }).join('');
  const marks = PR6.map(i => { const [x, y] = at(d['m' + i], R - 54), [lx, ly] = at(d['m' + i], R - 110);
    return `<g class="${(d['on' + i] || '').trim()}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${d['on' + i] ? 13 : 8}"/></g>`; }).join('');
  const labs = PR6.map(i => { const [lx, ly] = at(d['m' + i], R - 112);
    return `<div class="x-a x-ml${d['on' + i]}" style="left:${(lx - 120).toFixed(0)}px;top:${(ly - 18).toFixed(0)}px">${k('p' + i + 'e')}</div>`; }).join('');
  const [hx, hy] = at(d.mt, R - 20);
  return `<svg class="x-full" viewBox="0 0 1287 1222"><defs><radialGradient id="${p}bg" cx=".5" cy=".46" r=".7"><stop offset="0" stop-color="#123b46"/><stop offset="1" stop-color="#06161b"/></radialGradient></defs>
  <rect width="1287" height="1222" fill="url(#${p}bg)"/>
  <g fill="none" stroke="#c9a35a"><circle cx="${cx}" cy="${cy}" r="${R}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${R + 6}" stroke-width="1" opacity=".6"/><circle cx="${cx}" cy="${cy}" r="${R - 74}" stroke-width="1.5" opacity=".55"/><circle cx="${cx}" cy="${cy}" r="${R - 150}" stroke-width="1" opacity=".35" stroke-dasharray="3 9"/>
  <g stroke-width="2" opacity=".8">${ticks}</g></g>
  <g font-family="Cinzel" font-size="28" fill="#c9a35a" text-anchor="middle" opacity=".85">${nums}</g>
  <g fill="#c9a35a">${marks}</g>
  <line x1="${at(d.mt, R - 150)[0].toFixed(1)}" y1="${at(d.mt, R - 150)[1].toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#f1d58e" stroke-width="3" opacity=".9"/>
  <path d="M${hx.toFixed(1)} ${(hy - 16).toFixed(1)}l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="#f1d58e"/></svg>
  ${labs}
  <div class="x-a x-ctr x-cz" style="top:${cy - 270}px;font-size:46px;letter-spacing:.18em;color:#f1d58e">${k('city', 1)}</div>
  <div class="x-a x-ctr x-cg" style="top:${cy - 205}px;font-size:176px;line-height:1;color:#f6ecd4">${k('hm')}<span style="font-size:46px;color:#c9a35a;margin-left:12px">${k('sec')} ${k('ap')}</span></div>
  <div class="x-a x-ctr x-cg" style="top:${cy - 18}px;font-size:36px;color:#d9ccaa">${k('date')}</div>
  <div class="x-a x-ctr x-cg" style="top:${cy + 30}px;font-size:34px;color:#c9a35a">${k('hij')}</div>
  <div class="x-a x-ctr x-cz" style="top:${cy + 110}px;font-size:24px;letter-spacing:.34em;color:#c9a35a">${lab('Next prayer')}</div>
  <div class="x-a x-ctr" style="top:${cy + 146}px;line-height:1.1"><span class="x-cz" style="font-size:58px;color:#f6ecd4">${k('nx', 1)}</span><span class="x-am ar" style="font-size:58px;color:#f1d58e;margin-left:22px">${k('nxar')}</span></div>
  <div class="x-a x-ctr x-cg" style="top:${cy + 224}px;font-size:44px;color:#f6ecd4">${k('nt')} ${k('nap')} <span style="color:#c9a35a">· ${k('cd')}</span></div>
  <div class="x-a x-ctr x-cz" style="top:1108px;font-size:30px;letter-spacing:.2em;color:#c9a35a;opacity:.85">✦ &nbsp; ${PR6.filter(i => i !== 1).map(i => k('p' + i + 'h') + ' ' + k('p' + i + 'm')).join(' &nbsp;·&nbsp; ')} &nbsp; ✦</div>`;
};
NEW_CSS.astrolabe = nb('astrolabe') + `
.rbx-astrolabe{background:#06161b;color:#f6ecd4}.rbx-astrolabe .x-cz{font-family:Cinzel}.rbx-astrolabe .x-cg{font-family:Cormorant;font-weight:600}.rbx-astrolabe .x-am{font-family:AmiriT}
.rbx-astrolabe .x-ml{width:240px;text-align:center;font:600 30px Cormorant;color:#c9a35a}
.rbx-astrolabe .x-ml.x-on{color:#f1d58e;font-weight:700}
.rbx-astrolabe svg .x-on circle{fill:#f1d58e}`;

/* 6 · Paper Hills — layered paper-cut landscape */
NEW_RBX.hills = (d, k, lab, p) => `<svg class="x-full" viewBox="0 0 1287 1222"><defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3ea"/><stop offset="1" stop-color="#d7e5d6"/></linearGradient></defs>
  <rect width="1287" height="1222" fill="url(#${p}s)"/><circle cx="1050" cy="560" r="96" fill="#f7dfb0"/><circle cx="1050" cy="560" r="150" fill="#f7dfb0" opacity=".25"/>
  <path d="M0 640C180 560 330 610 470 590S760 520 900 580 1150 640 1287 590V1222H0z" fill="#3e6a59" opacity=".18" transform="translate(0 14)"/>
  <path d="M0 640C180 560 330 610 470 590S760 520 900 580 1150 640 1287 590V1222H0z" fill="#b9d0bd"/>
  <path d="M0 760C160 700 320 740 520 710S860 650 1050 720 1200 760 1287 730V1222H0z" fill="#2c5245" opacity=".2" transform="translate(0 14)"/>
  <path d="M0 760C160 700 320 740 520 710S860 650 1050 720 1200 760 1287 730V1222H0z" fill="#8fb39c"/>
  <path d="M0 870C220 820 380 860 600 830S980 800 1287 860V1222H0z" fill="#1f3e34" opacity=".22" transform="translate(0 14)"/>
  <path d="M0 870C220 820 380 860 600 830S980 800 1287 860V1222H0z" fill="#5f8c77"/>
  <path d="M0 990C260 950 520 985 760 960S1100 950 1287 975V1222H0z" fill="#10261f" opacity=".25" transform="translate(0 14)"/>
  <path d="M0 990C260 950 520 985 760 960S1100 950 1287 975V1222H0z" fill="#2f5b4b"/></svg>
  <div class="x-a x-jo" style="left:70px;top:62px;font-size:52px;letter-spacing:.1em;color:#2f5b4b">${k('city', 1)}</div>
  <div class="x-a x-qs" style="left:72px;top:134px;font-size:32px;line-height:1.5;color:#5f7a6d">${k('date')}<br>${k('hij')}</div>
  <div class="x-a x-jo" style="right:70px;top:40px;font-size:190px;line-height:1;color:#23463a">${k('hm')}<span style="font-size:44px;margin-left:12px;color:#5f8c77">${k('sec')} ${k('ap')}</span></div>
  <div class="x-a x-qs" style="left:70px;top:300px;font-size:28px;letter-spacing:.3em;color:#5f7a6d">${lab('Next prayer')}</div>
  <div class="x-a" style="left:66px;top:340px;line-height:1.1"><span class="x-jo" style="font-size:118px;color:#23463a">${k('nx')}</span><span class="x-em ar" style="font-size:76px;color:#5f8c77;margin-left:30px">${k('nxar')}</span></div>
  <div class="x-a x-qs" style="left:72px;top:478px;font-size:52px;color:#23463a">${k('nt')} ${k('nap')}<span style="color:#5f7a6d;font-size:38px;margin-left:20px">− ${k('cd')}</span></div>
  <div class="x-row">${PR6.map(i => `<div class="x-c${d['on' + i]}${d['pa' + i]}"><b>${k('p' + i + 'e')}</b><span>${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}</div>`;
NEW_CSS.hills = nb('hills') + `
.rbx-hills{background:#eef3ea}.rbx-hills .x-jo{font-family:Josefin}.rbx-hills .x-qs{font-family:Quicksand;font-weight:700}.rbx-hills .x-em{font-family:ElMessiri;font-weight:700}
.rbx-hills .x-row{position:absolute;left:50px;right:50px;top:1030px;height:150px;display:flex;gap:8px}
.rbx-hills .x-c{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border-radius:24px;font-family:Quicksand;font-weight:700;color:#e6efe6}
.rbx-hills .x-c b{font-size:30px;font-weight:700;opacity:.8}.rbx-hills .x-c span{font-size:36px}
.rbx-hills .x-c.x-past{opacity:.5}.rbx-hills .x-c.x-on{background:#f7dfb0;color:#23463a}`;

/* 7 · Retro Sunset — 1970s rainbow stripes */
NEW_RBX.retro = (d, k, lab, p) => {
  const cols = ['#7a2f19', '#b5481f', '#e2702f', '#f0a33a', '#f5c96a', '#f8e2a8'];
  const arcs = cols.map((c, i) => { const r = 420 - i * 56; return `<path d="M${643 - r} 1222A${r} ${r} 0 0 1 ${643 + r} 1222z" fill="${c}"/>`; }).join('');
  return `<svg class="x-full" viewBox="0 0 1287 1222">${arcs}<path d="M0 1222V1180H1287V1222z" fill="#5a2a16"/></svg>
  <div class="x-a x-bl" style="left:64px;top:52px;font-size:58px;color:#5a2a16">${k('city')}</div>
  <div class="x-a x-qs" style="right:64px;top:56px;font-size:32px;line-height:1.45;text-align:right;color:#8a4a2a">${k('date')}<br>${k('hij')}</div>
  <div class="x-a x-ctr x-bl" style="top:150px;font-size:250px;line-height:1;color:#5a2a16">${k('hm')}<span class="x-qs" style="font-size:52px;margin-left:16px;color:#e2702f">${k('sec')}</span><span class="x-qs" style="font-size:46px;margin-left:10px">${k('ap')}</span></div>
  <div class="x-a" style="left:150px;right:150px;top:440px;height:200px;border-radius:100px;background:#5a2a16;color:#f8e2a8;display:flex;align-items:center;justify-content:center;gap:34px">
    <div style="text-align:center"><div class="x-qs" style="font-size:24px;letter-spacing:.3em;color:#f0a33a">${lab('Next prayer')}</div><div class="x-bl" style="font-size:84px;line-height:1.05">${k('nx')}</div></div>
    <div class="x-em ar" style="font-size:72px;color:#f0a33a">${k('nxar')}</div>
    <div style="text-align:center"><div class="x-bl" style="font-size:64px;line-height:1.1">${k('nt')} ${k('nap')}</div><div class="x-qs" style="font-size:34px;color:#f5c96a">− ${k('cd')}</div></div></div>
  <div class="x-row">${PR6.map(i => `<div class="x-c${d['on' + i]}${d['pa' + i]}"><b>${k('p' + i + 'e')}</b><span>${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}</div>`;
};
NEW_CSS.retro = nb('retro') + `
.rbx-retro{background:#f6e7cb;color:#5a2a16}.rbx-retro .x-bl{font-family:Baloo;font-weight:800}.rbx-retro .x-qs{font-family:Quicksand;font-weight:700}.rbx-retro .x-em{font-family:ElMessiri;font-weight:700}
.rbx-retro .x-row{position:absolute;left:50px;right:50px;top:672px;height:118px;display:flex;gap:8px}
.rbx-retro .x-c{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:40px;font-family:Quicksand;font-weight:700;border:3px solid #e2b37a}
.rbx-retro .x-c b{font-size:30px;color:#8a4a2a}.rbx-retro .x-c span{font-size:35px}
.rbx-retro .x-c.x-past{opacity:.45}.rbx-retro .x-c.x-on{background:#e2702f;border-color:#e2702f;color:#fff}.rbx-retro .x-c.x-on b{color:#fde7c0}`;

/* 8 · Aurora — soft northern lights on night, light type */
NEW_RBX.aurora = (d, k, lab, p) => `<div class="x-a x-pl" style="left:80px;top:70px;font-size:32px;letter-spacing:.32em;color:#9fe9d0">${k('city', 1)}</div>
  <div class="x-a x-pl" style="left:80px;top:120px;font-size:32px;line-height:1.5;color:#b8bfd6">${k('date')}<br>${k('hij')}</div>
  <div class="x-a x-pt" style="left:70px;top:236px;font-size:280px;line-height:1;letter-spacing:-.03em">${k('hm')}<span class="x-pl" style="font-size:56px;letter-spacing:0;color:#9fe9d0;margin-left:14px">${k('sec')}</span><span class="x-pl" style="font-size:50px;letter-spacing:0;color:#b8bfd6;margin-left:10px">${k('ap')}</span></div>
  <div class="x-a x-pl" style="left:80px;top:560px;font-size:28px;letter-spacing:.32em;color:#b8bfd6">${lab('Next prayer')}</div>
  <div class="x-a" style="left:76px;top:600px;line-height:1.1"><span class="x-ps x-gt" style="font-size:124px">${k('nx')}</span><span class="x-cai ar" style="font-size:78px;color:#c9b8ff;margin-left:30px">${k('nxar')}</span></div>
  <div class="x-a x-pl" style="left:80px;top:752px;font-size:56px">${k('nt')} ${k('nap')}<span style="color:#b8bfd6;font-size:40px;margin-left:24px">− ${k('cd')}</span></div>
  <div class="x-a" style="left:80px;right:80px;top:860px;height:6px;border-radius:3px;background:rgba(255,255,255,.12)"><div style="width:${d.pct}%;height:100%;border-radius:3px;background:linear-gradient(90deg,#2ed99a,#8c6bff);box-shadow:0 0 18px rgba(46,217,154,.6)"></div></div>
  <div class="x-row">${PR6.map(i => `<div class="x-c${d['on' + i]}${d['pa' + i]}"><b>${k('p' + i + 'e')}</b><span>${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}</div>`;
NEW_CSS.aurora = nb('aurora') + `
.rbx-aurora{color:#f3f5fb;background:radial-gradient(620px 420px at 18% 12%,rgba(46,217,154,.32),transparent 70%),radial-gradient(720px 520px at 88% 30%,rgba(140,107,255,.34),transparent 70%),radial-gradient(900px 420px at 50% 112%,rgba(0,168,204,.30),transparent 70%),#070a14}
.rbx-aurora .x-pl{font-family:PoppinsL}.rbx-aurora .x-pt{font-family:PoppinsL;color:#fff}.rbx-aurora .x-ps{font-family:PoppinsSB}.rbx-aurora .x-cai{font-family:Cairo;font-weight:700}
.rbx-aurora .x-gt{background:linear-gradient(90deg,#7ff0c4,#b39dff);-webkit-background-clip:text;background-clip:text;color:transparent}
.rbx-aurora .x-row{position:absolute;left:60px;right:60px;top:930px;height:220px;display:flex;gap:10px}
.rbx-aurora .x-c{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:PoppinsL;border-radius:26px}
.rbx-aurora .x-c b{font-weight:400;font-size:30px;color:#b8bfd6}.rbx-aurora .x-c span{font-size:38px}
.rbx-aurora .x-c.x-past{opacity:.4}
.rbx-aurora .x-c.x-on{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 2px rgba(127,240,196,.55)}.rbx-aurora .x-c.x-on b{color:#7ff0c4}`;

/* 9 · Pure — white, one black typeface, a timeline */
NEW_RBX.pure = (d, k, lab, p) => {
  const x0 = 140, x1 = 1147, step = (x1 - x0) / 5;
  let fill = 0; const next = PR6.find(i => d['on' + i]);
  if (next != null) fill = next === 0 ? 0 : (next - 1 + d.pct / 100) * step; else fill = x1 - x0;
  return `<div class="x-a x-pm" style="left:90px;top:74px;font-size:30px;letter-spacing:.34em">${k('city', 1)}</div>
  <div class="x-a x-pl" style="right:90px;top:66px;font-size:32px;line-height:1.5;text-align:right;color:#777">${k('date')}<br>${k('hij')}</div>
  <div class="x-a x-px" style="left:76px;top:170px;font-size:310px;line-height:1;letter-spacing:-.04em">${k('hm')}<span class="x-pl" style="display:inline-block;font-size:56px;line-height:1.2;letter-spacing:0;color:#999;margin-left:14px;vertical-align:8px">${k('sec')}<br><span class="x-pm" style="font-size:34px;letter-spacing:.2em">${k('ap')}</span></span></div>
  <div class="x-a" style="left:90px;top:620px;width:1107px;border-top:2px solid #111"></div>
  <div class="x-a x-pl" style="left:90px;top:650px;font-size:28px;letter-spacing:.3em;color:#777">${lab('Next prayer')}</div>
  <div class="x-a" style="left:86px;top:692px;line-height:1.1"><span class="x-pm" style="font-size:104px">${k('nx')}</span><span class="x-taj ar" style="font-size:66px;color:#0f7a5a;margin-left:28px">${k('nxar')}</span></div>
  <div class="x-a x-pl" style="right:90px;top:700px;font-size:86px;text-align:right;line-height:1">${k('nt')}<span style="font-size:36px;margin-left:8px">${k('nap')}</span><div style="font-size:38px;color:#0f7a5a;margin-top:12px">− ${k('cd')}</div></div>
  <svg class="x-full" viewBox="0 0 1287 1222"><line x1="${x0}" x2="${x1}" y1="990" y2="990" stroke="#ddd" stroke-width="4"/><line x1="${x0}" x2="${x0 + fill}" y1="990" y2="990" stroke="#111" stroke-width="6"/>
  ${PR6.map(i => `<circle cx="${x0 + i * step}" cy="990" r="${d['on' + i] ? 16 : 10}" fill="${d['on' + i] ? '#0f7a5a' : d['pa' + i] ? '#111' : '#fff'}" stroke="${d['on' + i] ? '#0f7a5a' : '#111'}" stroke-width="4"/>`).join('')}</svg>
  ${PR6.map(i => `<div class="x-a x-tk${d['on' + i]}${d['pa' + i]}" style="left:${x0 + i * step - 110}px"><b>${k('p' + i + 'e')}</b><span>${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}`;
};
NEW_CSS.pure = nb('pure') + `
.rbx-pure{background:#fbfbf9;color:#111}.rbx-pure .x-pl{font-family:PoppinsL}.rbx-pure .x-pm{font-family:PoppinsM}.rbx-pure .x-px{font-family:PoppinsL}.rbx-pure .x-taj{font-family:TajawalB}
.rbx-pure .x-tk{top:1040px;width:220px;text-align:center;font-family:PoppinsL}
.rbx-pure .x-tk>b{display:block;font-family:PoppinsM;font-weight:400;font-size:31px;color:#555}
.rbx-pure .x-tk>span{display:block;margin-top:10px;font-size:38px}
.rbx-pure .x-tk.x-past{opacity:.45}.rbx-pure .x-tk.x-on b,.rbx-pure .x-tk.x-on span{color:#0f7a5a;font-family:PoppinsM}`;

/* 10 · Calligrapher — rice paper, black ink, red seal */
NEW_RBX.ink = (d, k, lab, p) => {
  let s = 7, fib = ''; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) { const x = rnd() * 1287, y = rnd() * 1222, l = 30 + rnd() * 70, a = rnd() * 6.28;
    fib += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}q${(Math.cos(a) * l / 2 + 10).toFixed(0)} ${(Math.sin(a) * l / 2 - 8).toFixed(0)} ${(Math.cos(a) * l).toFixed(0)} ${(Math.sin(a) * l).toFixed(0)}"/>`; }
  return `<svg class="x-full" viewBox="0 0 1287 1222"><g fill="none" stroke="#b9a983" stroke-width="1.3" opacity=".22">${fib}</g>
  <path d="M70 690c120-14 300-6 520-12s420-16 560 2c30 4 50 10 60 14-80 2-240-2-420 4s-470 14-610 6c-60-3-110-8-110-14z" fill="#1b1714" opacity=".88"/></svg>
  <div class="x-a x-cg" style="left:80px;top:60px;font-size:38px;letter-spacing:.3em">${k('city', 1)}</div>
  <div class="x-a x-cg" style="left:76px;top:110px;font-size:230px;line-height:1">${k('hm')}<span style="font-size:52px;margin-left:12px;color:#7a6a55">${k('sec')} ${k('ap')}</span></div>
  <div class="x-a x-cgi" style="left:82px;top:360px;font-size:42px;line-height:1.4;color:#3b332b">${k('date')}<br><span style="color:#a3281c">${k('hij')}</span></div>
  <div class="x-a x-rq" style="left:640px;width:600px;top:110px;text-align:center;font-size:250px;line-height:1.25;color:#1b1714">${k('nxar')}</div>
  <div class="x-a" style="left:840px;top:450px;width:200px;height:200px;background:#b0281d;transform:rotate(-4deg);border-radius:10px;color:#f6efe0;text-align:center;padding-top:22px;box-shadow:inset 0 0 0 8px #b0281d,inset 0 0 0 11px #f6efe0">
    <div class="x-cg" style="font-size:66px;line-height:1">${k('nt')}</div><div class="x-cg" style="font-size:34px">${k('nap')}</div><div class="x-cg" style="font-size:30px;margin-top:4px">${k('cd')}</div></div>
  <div class="x-a x-cgi" style="left:640px;width:200px;top:500px;text-align:right;padding-right:30px;font-size:52px">${k('nx')}</div>
  <div class="x-row">${PR6.map(i => `<div class="x-c${d['on' + i]}${d['pa' + i]}"><b class="ar">${k('p' + i + 'a')}</b><i>${k('p' + i + 'e')}</i><span>${k('p' + i + 'h')} ${k('p' + i + 'm')}</span></div>`).join('')}</div>`;
};
NEW_CSS.ink = nb('ink') + `
.rbx-ink{background:radial-gradient(1200px 900px at 40% 30%,#f7f0e1,#ece1c9);color:#1b1714}
.rbx-ink .x-cg{font-family:Cormorant;font-weight:600}.rbx-ink .x-cgi{font-family:Cormorant;font-style:italic;font-weight:600}.rbx-ink .x-rq{font-family:Ruqaa}
.rbx-ink .x-row{position:absolute;left:60px;right:60px;top:790px;height:360px;display:flex}
.rbx-ink .x-c{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-left:1px solid rgba(27,23,20,.25)}
.rbx-ink .x-c:first-child{border-left:0}
.rbx-ink .x-c b{font-family:AmiriT;font-weight:700;font-size:60px;line-height:1.3}
.rbx-ink .x-c i{font-family:Cormorant;font-style:italic;font-weight:600;font-size:36px;color:#5b4f42}
.rbx-ink .x-c span{font-family:Cormorant;font-weight:700;font-size:44px}
.rbx-ink .x-c.x-past{opacity:.42}.rbx-ink .x-c.x-on b,.rbx-ink .x-c.x-on span{color:#b0281d}`;

const NEW_NAMES = { sunpath: 'Sun Path', bauhaus: 'Bauhaus', almanac: 'Almanac', departures: 'Departures', astrolabe: 'Astrolabe',
  hills: 'Paper Hills', retro: 'Retro Sunset', aurora: 'Aurora', pure: 'Pure', ink: 'Calligrapher' };
