// ============================================================================
// [AI-MIMARI-NOTU: ADIM 12 & 13 — ORTAK ÇOKLU-MEDYA VİTRİN VE İSTATİSTİK MOTORU]
// Bu dosya `/dizi/`, `/film/`, `/manga/` ve `/kitap/` sayfalarını tek bir ortak
// mimariyle çalıştırır.
// - Hangi sayfada çalıştığını `<body data-section="series|movie|manga|book">`
//   ve `data-data="../data/..."` özniteliklerinden otomatik algılar.
// - Dizi ve Filmlerde IMDb'nin genel/global puanı yerine %100 kullanıcının kendi
//   verdiği ağırlıklı sezon/film puanları (`getEffectiveScore`) ve özel kategoriler
//   (`customGenres`) gösterilir.
// - Adım 11 ("★ Başyapıtlar") ve Adım 13 (Özel Kategori Yüzdesel Dağılım Grafikleri,
//   Format Puan Analizi, Eklenme Yılı Dağılımı) tüm medya sayfalarında aktiftir.
// ============================================================================
(() => {
  const $ = s => document.querySelector(s);
  const sectionId = document.body.dataset.section || 'series';
  const dataPath = document.body.dataset.data || `../data/${sectionId}.json`;

  const SECTION_PROFILES = {
    series: {
      unitMain: 'dizi',
      unitSeason: 'sezon',
      unitFilm: 'özel',
      unitEp: 'bölüm',
      emptyText: 'Henüz dizi eklenmemiş veya filtreyle eşleşen dizi yok.',
      extBtnText: "IMDb'de aç",
      footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
      metaKey: 'network',
      statusLabels: { completed: 'İzlendi', watching: 'İzleniyor', paused: 'Beklemede', dropped: 'Bırakıldı', planned: 'Planlandı' },
      weights: { season: 1.0, movie: 0.35, other: 0.15 }
    },
    movie: {
      unitMain: 'film',
      unitSeason: 'ana film',
      unitFilm: 'seri filmi',
      unitEp: 'izleme',
      emptyText: 'Henüz film eklenmemiş veya filtreyle eşleşen film yok.',
      extBtnText: "IMDb'de aç",
      footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
      metaKey: 'director',
      statusLabels: { completed: 'İzlendi', watching: 'İzleniyor', paused: 'Beklemede', dropped: 'Yarım Bırakıldı', planned: 'İzlenecek' },
      weights: { season: 1.0, movie: 1.0, other: 0.2 }
    },
    manga: {
      unitMain: 'manga',
      unitSeason: 'seri',
      unitFilm: 'özel',
      unitEp: 'bölüm',
      emptyText: 'Henüz manga eklenmemiş veya filtreyle eşleşen manga yok.',
      extBtnText: "Kaynakta aç",
      footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
      metaKey: 'author',
      statusLabels: { completed: 'Okundu', watching: 'Okunuyor', paused: 'Beklemede', dropped: 'Bırakıldı', planned: 'Planlandı' },
      weights: { season: 1.0, movie: 0.5, other: 0.2 }
    },
    book: {
      unitMain: 'kitap',
      unitSeason: 'cilt',
      unitFilm: 'ek',
      unitEp: 'sayfa',
      emptyText: 'Henüz kitap eklenmemiş veya filtreyle eşleşen kitap yok.',
      extBtnText: "Kaynakta aç",
      footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
      metaKey: 'author',
      statusLabels: { completed: 'Okundu', watching: 'Okunuyor', paused: 'Yarım Kaldı', dropped: 'Bırakıldı', planned: 'Okunacak' },
      weights: { season: 1.0, movie: 0.5, other: 0.25 }
    }
  };

  const P = SECTION_PROFILES[sectionId] || SECTION_PROFILES.series;
  const ST = P.statusLabels;
  const NEXT = 'Devam edilecek';
  const FAV_LABEL = '★ Başyapıtlar';
  const own = p => p.status !== 'PLANNING' && p.status !== 'NONE';

  function partState(p) {
    const ep = p.episodes || 0, w = p.watched || 0, frac = ep ? w + '/' + ep : w + ' ' + P.unitEp;
    if (p.status === 'NONE' || (!p.status && !w)) {
      return p.release === 'NOT_YET_RELEASED' ? ['Yayınlanmadı', 'no'] : [ST.planned || 'İzlenmedi', 'no'];
    }
    if (p.status === 'PLANNING') return [ST.planned || 'Planlandı', 'no'];
    if (p.status === 'DROPPED') return [ST.dropped + ' · ' + frac, 'drop'];
    if (p.status === 'PAUSED') return [(ST.paused || 'Beklemede') + ' · ' + frac, 'cur'];
    if (p.status === 'CURRENT' || (ep && w < ep)) return [ST.watching + ' · ' + frac, 'cur'];
    return [ST.completed, 'done'];
  }

  const sum = (a, k) => a.reduce((n, x) => n + (x[k] || 0), 0);
  const rew = ps => { const n = Math.max(0, ...ps.map(p => p.repeat || 0)); return n ? '↻ ' + n + '× tekrar' : ''; };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} }
  const state = { items: [], view: ls('view_' + sectionId) === 'list' ? 'list' : 'grid', filter: 'all', sort: 'added', q: '', sc: 'all', dc: 'all', kd: 'all', gn: 'all', ay: 'all' };

  const byAdded = (a, b) => (b.addedAt || '').localeCompare(a.addedAt || '');
  const nodes = new Map();
  let order = '', raf = 0;

  const big = u => {
    if (!u) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
    return (document.body.dataset.root || '../') + u.replace(/^\.?\//, '');
  };
  const dec = y => !y ? 'old' : y >= 2020 ? '2020' : y >= 2010 ? '2010' : y >= 2000 ? '2000' : 'old';
  const DEC = { 2020: "2020'ler", 2010: "2010'lar", 2000: "2000'ler", old: 'Daha eski' };
  const DORD = ['2020', '2010', '2000', 'old'];

  function getPartWeight(p) {
    if (!p) return P.weights.other;
    if (p.kind === 'movie' || p.format === 'MOVIE') return P.weights.movie;
    if (p.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(p.format)) return P.weights.other;
    return P.weights.season;
  }

  function getEffectiveScore(it) {
    if (!it) return null;
    const parts = Array.isArray(it.parts) ? it.parts : [];
    let weightedSum = 0, totalWeight = 0;
    for (const p of parts) {
      if (!p) continue;
      const sc = Number(p.score);
      if (!isNaN(sc) && sc > 0) {
        const w = getPartWeight(p);
        weightedSum += sc * w;
        totalWeight += w;
      }
    }
    if (totalWeight > 0) return Math.round((weightedSum / totalWeight) * 10) / 10;
    const s = Number(it.score);
    return !isNaN(s) && s > 0 ? Math.round(s * 10) / 10 : null;
  }

  function getEffectiveGenres(it) {
    if (!it) return [];
    const arr = Array.isArray(it.customGenres) && it.customGenres.length ? it.customGenres : (it.genres || []);
    return [...new Set(arr.map(g => String(g).trim()).filter(Boolean))];
  }

  const SCO = [['9', '9 ve üstü'], ['8', '8–9'], ['7', '7–8'], ['low', '7 altı'], ['none', 'Puansız']];
  const KIND = [['fav', '★ Başyapıt'], ['multi', 'Çoklu sezon/cilt'], ['rewatch', 'Tekrarlanan']];
  const COL = { completed: 'var(--accent)', watching: '#3ccf91', paused: 'var(--warn)', dropped: 'var(--bad)', planned: 'var(--ink2)' };
  const scOk = (v, x) => v === 'all' || (v === 'none' ? !x : v === 'low' ? x > 0 && x < 7 : v[0] === 'b' ? Math.min(10, Math.floor(x)) === +v.slice(1) : x >= +v && (+v === 9 || x < +v + 1));
  const kOk = (v, m) => v === 'all' || (v === 'fav' ? Boolean(m.it.favorite) : v === 'multi' ? m.sn > 1 : m.rp > 0);
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

  const SORTS = {
    added: byAdded,
    score: (a, b) => (nodes.get(b.id).sc || 0) - (nodes.get(a.id).sc || 0) || byAdded(a, b),
    title: (a, b) => (a.title || '').localeCompare(b.title || '', 'tr'),
    year: (a, b) => (nodes.get(b.id).y || 0) - (nodes.get(a.id).y || 0),
    eps: (a, b) => nodes.get(b.id).ep - nodes.get(a.id).ep
  };

  function build(it) {
    const ps = UI.parts(it).filter(own), ep = sum(ps, 'episodes'), w = sum(ps, 'watched');
    const cnt = k => ps.filter(p => p.kind === k).length, sn = cnt('season'), fl = cnt('movie'), ot = cnt('other');
    const ys = ps.map(p => p.year).filter(Boolean), y = ys.length ? Math.min(...ys) : 0;
    const addedYear = (it.addedAt && /^\d{4}/.test(it.addedAt)) ? it.addedAt.slice(0, 4) : '';
    const effScore = getEffectiveScore(it);
    const effGenres = getEffectiveGenres(it);
    const extraMeta = P.metaKey && it[P.metaKey] ? it[P.metaKey] : '';
    const li = h('li');
    if (it.favorite) li.classList.add('is-fav');
    li.innerHTML = '<div class="poster"><img alt="" loading="lazy" decoding="async" width="142" height="213"></div><div class="t"><h3><a target="_blank" rel="noopener"></a></h3><p class="meta"></p><p class="st"></p></div>';
    const a = li.querySelector('a'); a.textContent = it.title;
    a.href = '#' + it.id; a.onclick = e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); openSheet(it.id, true); };
    const genrePreview = effGenres.slice(0, 2).join(' · ');
    const epInfo = sectionId === 'movie'
      ? (y ? String(y) : '')
      : (!ep ? w + ' ' + P.unitEp : w === ep ? ep + ' ' + P.unitEp : w + '/' + ep + ' ' + P.unitEp);
    li.querySelector('.meta').textContent = [
      it.favorite ? '★ Başyapıt' : '',
      extraMeta,
      sectionId !== 'movie' && sn ? sn + ' ' + P.unitSeason : '',
      rew(ps),
      epInfo,
      genrePreview
    ].filter(Boolean).join(', ');

    const st = li.querySelector('.st'), po = li.querySelector('.poster');
    if (it.favorite) {
      const fb = h('span', 'fav-badge', '★');
      fb.title = 'Favori / Başyapıt';
      po.append(fb);
    }
    const lab = it.status !== 'completed' ? (ST[it.status] || it.status) : it.next ? NEXT : '';
    if (lab) {
      st.textContent = lab;
      st.classList.add('st-' + (it.status !== 'completed' ? it.status : 'next'));
      const sb = h('span', 'sb st-' + (it.status !== 'completed' ? it.status : 'next'), lab);
      po.append(sb);
    } else st.remove();
    if (it.status !== 'completed' && ep && w < ep) {
      const pg = h('div', 'pg'); pg.innerHTML = '<i></i>'; pg.firstChild.style.setProperty('--w', Math.round(w / ep * 100) + '%'); po.append(pg);
    }
    if (effScore) {
      const sc = h('span', 'score glass');
      sc.setAttribute('role', 'img'); sc.setAttribute('aria-label', 'Puan ' + effScore + '/10'); sc.innerHTML = UI.icon('star'); sc.append(String(effScore));
      li.append(sc);
    }
    const im = li.querySelector('img'); im.onload = () => im.classList.add('in');
    if (it.image) im.src = big(it.image);
    const m = { li, it, sc: effScore || 0, key: ((it.title || '') + ' ' + extraMeta).toLocaleLowerCase('tr'), y, ay: addedYear, d: dec(y), sn, fl, rp: Math.max(0, ...ps.map(p => p.repeat || 0)), ep: w, g: effGenres };
    nodes.set(it.id, m);
    return li;
  }

  const active = () => ['sc', 'dc', 'kd', 'gn', 'ay'].filter(k => state[k] !== 'all').length;
  function render() {
    const s = state, q = s.q.trim().toLocaleLowerCase('tr'), root = $('#list');
    root.className = s.view;
    if (order !== s.sort && s.items.length) {
      order = s.sort;
      const fr = document.createDocumentFragment();
      [...s.items].sort(SORTS[s.sort] || byAdded).forEach(it => fr.append(nodes.get(it.id).li));
      root.append(fr);
    }
    let shown = 0, first = null, last = null;
    for (const it of s.items) {
      const n = nodes.get(it.id);
      const filterMatch = s.filter === 'all'
        || (s.filter === 'fav' ? Boolean(it.favorite) : s.filter === 'next' ? it.next : it.status === s.filter);
      const ok = filterMatch && n.key.includes(q)
        && scOk(s.sc, n.sc) && (s.gn === 'all' || n.g.includes(s.gn)) && (s.dc === 'all' || n.d === s.dc) && (s.ay === 'all' || n.ay === s.ay) && kOk(s.kd, n);
      n.li.hidden = !ok; n.li.classList.remove('f', 'l');
    }
    for (const li of root.children) { if (li.hidden) continue; shown++; if (!first) first = li; last = li; }
    if (first) { first.classList.add('f'); last.classList.add('l'); }
    $('#empty').hidden = shown > 0;
    $('#empty').textContent = P.emptyText;
    const n = active(), dot = $('#fdot');
    if (dot) { dot.hidden = !n; dot.textContent = n; }
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === s.view));
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filter === s.filter));
    document.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', state[b.dataset.g] === b.dataset.v));
  }
  const go = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); };
  const setF = (k, v) => { state[k] = v; go(); };
  const jump = () => { $('#list').scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  function chip(root, label, count, attrs, fn) {
    const b = h('button', null, label); b.type = 'button'; Object.assign(b.dataset, attrs);
    if (count != null) b.append(h('small', null, count));
    b.onclick = fn; root.append(b);
  }

  function filters() {
    const fp = $('#fpIn'); if (!fp) return;
    fp.replaceChildren();
    const box = h('div');
    const grp = (title, k, opts, counts) => {
      const g = h('div', 'fg'), row = h('div', 'chips'); g.append(h('span', null, title), row);
      chip(row, 'Hepsi', null, { g: k, v: 'all' }, () => setF(k, 'all'));
      for (const [v, l] of opts) { const c = counts[v]; if (c === 0) continue; chip(row, l, c, { g: k, v }, () => setF(k, v)); }
      box.append(g);
    };
    const ms = [...nodes.values()], gcount = {};
    for (const m of ms) for (const g of m.g) gcount[g] = (gcount[g] || 0) + 1;
    grp('Puan', 'sc', SCO, Object.fromEntries(SCO.map(([v]) => [v, ms.filter(m => scOk(v, m.sc)).length])));
    grp('Yıl', 'dc', DORD.map(k => [k, DEC[k]]), Object.fromEntries(DORD.map(v => [v, ms.filter(m => m.d === v).length])));
    const gs = Object.keys(gcount).sort((a, b) => gcount[b] - gcount[a] || a.localeCompare(b, 'tr'));
    if (gs.length) grp('Tür / Kategori', 'gn', gs.map(g => [g, g]), gcount);
    grp('İçerik', 'kd', KIND, Object.fromEntries(KIND.map(([v]) => [v, ms.filter(m => kOk(v, m)).length])));
    const rs = h('button', 'more', 'Filtreleri sıfırla'); rs.type = 'button';
    rs.onclick = () => { Object.assign(state, { sc: 'all', dc: 'all', kd: 'all', gn: 'all', ay: 'all', filter: 'all', q: '' }); $('#q').value = ''; go(); };
    box.append(rs); fp.append(box);
    $('#fbtn').onclick = () => { const o = $('#fp').classList.toggle('open'); $('#fbtn').setAttribute('aria-expanded', o); };
  }

  function stats(items, S) {
    const box = $('#stats'); if (!box) return;
    box.replaceChildren();
    if (!items.length) { box.hidden = true; return; }
    const cn = items.filter(i => UI.tally([i]).anime > 0);
    const t = S && (S.watched != null || S.read != null || S.anime != null)
      ? {
          anime: S.watched ?? S.read ?? S.anime ?? 0,
          season: S.seasons ?? S.volumes ?? S.films ?? S.season ?? 0,
          film: S.specials ?? S.extras ?? S.film ?? 0,
          ep: S.episodes ?? S.pages ?? S.chapters ?? S.watchCount ?? 0
        }
      : UI.tally(items);
    const scs = cn.map(i => getEffectiveScore(i)).filter(Boolean);
    const avg = S && S.avgScore != null ? S.avgScore : (scs.length ? (scs.reduce((a, b) => a + b, 0) / scs.length) : null);
    const favCount = items.filter(i => i.favorite).length;

    const row = h('div', 'stats-row');
    const statCols = sectionId === 'movie'
      ? [[t.anime, P.unitMain], [favCount, 'başyapıt'], [items.length, 'toplam'], [t.ep, P.unitEp], [avg ? (+avg).toFixed(1) : '-', 'ort. puan']]
      : [[t.anime, P.unitMain], [t.season, P.unitSeason], [favCount, 'başyapıt'], [t.ep, P.unitEp], [avg ? (+avg).toFixed(1) : '-', 'ort. puan']];

    for (const [v, l] of statCols) {
      const e = h('div', 'stat'); e.innerHTML = '<b></b><span></span>'; e.firstChild.textContent = v; e.lastChild.textContent = l; row.append(e);
    }

    const more = h('button', 'more', 'Ayrıntılar'); more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.insertAdjacentHTML('beforeend', UI.icon('down'));
    const ins = h('div', 'ins'), inn = h('div', 'ins-in'); ins.append(inn);
    const blk = (title, ...kids) => { const b = h('div', 'blk'); b.append(h('h4', null, title), ...kids); inn.append(b); };
    const bars = (arr) => {
      const w = h('div', 'hbs'), mx = Math.max(1, ...arr.map(a => a[1]));
      for (const [l, n, k, v] of arr) {
        const b = h('button', 'hb'); b.type = 'button'; b.setAttribute('aria-label', l + ': ' + n);
        b.innerHTML = '<b></b><i></i><span></span>'; b.children[0].textContent = n || ''; b.children[1].style.setProperty('--h', (n / mx * 100) + '%'); b.children[2].textContent = l;
        b.onclick = () => { setF(k, v); jump(); }; w.append(b);
      }
      return w;
    };

    if (scs.length) {
      const hist = Array.from({ length: 10 }, (_, i) => [String(i + 1), 0, 'sc', 'b' + (i + 1)]);
      for (const x of scs) hist[Math.min(10, Math.max(1, Math.floor(x))) - 1][1]++;
      blk('Puan dağılımı', bars(hist.slice(Math.min(...hist.map((x, i) => x[1] ? i : 9)))));
    }

    const sg = h('div', 'seg'), lg = h('div', 'leg');
    for (const k of Object.keys(ST)) {
      const n = items.filter(i => i.status === k).length; if (!n) continue;
      const b = h('button'); b.type = 'button'; b.title = ST[k] + ': ' + n; b.style.cssText = '--n:' + n + ';--c:' + COL[k]; b.onclick = () => { setF('filter', k); jump(); }; sg.append(b);
      const l = h('span'); l.innerHTML = '<i></i>'; l.firstChild.style.setProperty('--c', COL[k]); l.append(ST[k] + ' ' + n); lg.append(l);
    }
    blk('Durum', sg, lg);

    const gc = {};
    for (const i of cn) {
      const gs = nodes.get(i.id) ? nodes.get(i.id).g : getEffectiveGenres(i);
      for (const g of gs) gc[g] = (gc[g] || 0) + 1;
    }
    const tg = Object.keys(gc).sort((a, b) => gc[b] - gc[a] || a.localeCompare(b, 'tr')).slice(0, 12);
    if (tg.length) {
      const maxG = Math.max(1, ...tg.map(g => gc[g]));
      const totalCounted = Math.max(1, cn.length);
      const gBars = h('div', 'genre-bars');
      for (const g of tg) {
        const pct = Math.round((gc[g] / totalCounted) * 100);
        const widthPct = Math.round((gc[g] / maxG) * 100);
        const btn = h('button', 'genre-bar-row');
        btn.type = 'button';
        btn.dataset.g = 'gn';
        btn.dataset.v = g;
        btn.innerHTML = `<div class="gb-head"><span class="gb-name"></span><span class="gb-val"></span></div><div class="gb-track"><i style="--w:${widthPct}%"></i></div>`;
        btn.querySelector('.gb-name').textContent = g;
        btn.querySelector('.gb-val').textContent = `${gc[g]} ${P.unitMain} (%${pct})`;
        btn.onclick = () => { setF('gn', g); jump(); };
        gBars.append(btn);
      }
      blk('Özel kategori & tür dağılımı', gBars);
    }

    more.onclick = () => { const o = box.classList.toggle('open'); more.setAttribute('aria-expanded', o); };
    box.append(row, ins, more);
    box.hidden = false;
  }

  const sheet = document.createElement('div');
  sheet.className = 'sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'sh-title');
  sheet.innerHTML = '<div class="sheet-bg"></div><div class="sheet-card glass sq"><div class="sheet-head"><img class="sheet-cover" alt=""><div class="sheet-t"><h2 id="sh-title"></h2><p class="sh-sub"></p><p class="sh-genres meta" style="margin-top:4px"></p></div><button class="btn glass" type="button" aria-label="Kapat" data-close></button></div><div class="sh-pg" hidden><i></i></div><ol class="parts"></ol><a class="sh-al" target="_blank" rel="noopener"></a></div>';
  document.body.append(sheet);
  const closeBtn = sheet.querySelector('[data-close]'); closeBtn.innerHTML = UI.icon('close');
  let opener = null, pushed = false;

  function fillSheet(it) {
    const ps = UI.parts(it), t = sheet.querySelector.bind(sheet);
    const effScore = getEffectiveScore(it);
    const effGenres = getEffectiveGenres(it);
    const extraMeta = P.metaKey && it[P.metaKey] ? it[P.metaKey] : '';
    t('#sh-title').textContent = it.title;
    const bits = [];
    if (it.favorite) bits.push('★ Başyapıt');
    if (extraMeta) bits.push(extraMeta);
    bits.push(it.status === 'completed' && it.next ? NEXT : (ST[it.status] || it.status));
    if (effScore) bits.push('★ ' + effScore);
    const rp = rew(ps.filter(own)); if (rp) bits.push(rp);
    t('.sh-sub').textContent = bits.join(' · ');
    const gEl = t('.sh-genres');
    if (gEl) {
      gEl.textContent = effGenres.join(' · ');
      gEl.hidden = !effGenres.length;
    }
    const im = t('.sheet-cover'); im.hidden = !it.image; if (it.image) im.src = big(it.image);
    const own2 = ps.filter(own), te = sum(own2, 'episodes'), tw = sum(own2, 'watched'), pg = t('.sh-pg');
    pg.hidden = !(te && tw < te); if (!pg.hidden) pg.firstChild.style.setProperty('--w', Math.round(tw / te * 100) + '%');
    const ol = t('.parts'); ol.replaceChildren();
    for (const p of ps) {
      const [txt, cls] = partState(p), li = document.createElement('li');
      li.className = 'part ' + cls;
      li.innerHTML = '<span class="pd" aria-hidden="true"></span><div class="pt"><span class="pt-name"></span><span class="pm"></span></div><span class="ps"></span>';
      li.querySelector('.pt-name').textContent = p.name;
      li.querySelector('.pm').textContent = [p.year, p.episodes > 1 ? p.episodes + ' ' + P.unitEp : '', p.score ? '★ ' + p.score : ''].filter(Boolean).join(' · ');
      li.querySelector('.ps').textContent = txt + (p.repeat ? ' · ' + (p.repeat + 1) + ' kez' : '');
      ol.append(li);
    }
    const al = t('.sh-al');
    const mainUrl = it.firstSeasonUrl || it.url || '';
    if (mainUrl) {
      al.href = mainUrl;
      al.textContent = P.extBtnText;
      al.hidden = false;
    } else {
      al.hidden = true;
    }
    t('.sheet-card').scrollTop = 0;
  }

  const hashId = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; } };
  function syncSheet() {
    const it = state.items.find(i => i.id === hashId());
    if (it) {
      if (sheet.hidden) opener = document.activeElement;
      fillSheet(it); sheet.hidden = false; document.body.style.overflow = 'hidden'; closeBtn.focus({ preventScroll: true });
    } else if (!sheet.hidden) {
      sheet.hidden = true; document.body.style.overflow = ''; pushed = false;
      if (opener && opener.focus) opener.focus({ preventScroll: true }); opener = null;
    }
  }
  function openSheet(id, viaClick) { pushed = !!viaClick; location.hash = id; }
  function closeSheet() { if (pushed) history.back(); else { history.replaceState(null, '', location.pathname + location.search); syncSheet(); } }
  sheet.querySelector('.sheet-bg').onclick = closeSheet; closeBtn.onclick = closeSheet;
  addEventListener('hashchange', syncSheet);

  (async () => {
    try {
      let d = null;
      try {
        const prevAll = JSON.parse(ls('tp_multimedia_preview') || '{}');
        if (prevAll && prevAll[sectionId]) d = prevAll[sectionId];
      } catch (e) {}
      if (!d) {
        const r = await fetch(dataPath);
        if (r.ok) d = await r.json();
      }
      const items = (d && (d[sectionId] || d.items || d.books || d.movies)) || [];
      state.items = items;
      const root = $('#list'), fr = document.createDocumentFragment();
      items.forEach(it => fr.append(build(it)));
      root.append(fr);
      stats(items, d && d.stats);
      filters();
      const chips = $('#chips');
      for (const [k, label] of [['all', 'Hepsi'], ['fav', FAV_LABEL], ['next', NEXT], ...Object.entries(ST)]) {
        const n = k === 'all' ? items.length : k === 'fav' ? items.filter(i => i.favorite).length : k === 'next' ? items.filter(i => i.next).length : items.filter(i => i.status === k).length;
        if (!n) continue;
        chip(chips, label, n, { filter: k }, () => setF('filter', k));
      }
      render();
      syncSheet();
    } catch (err) {
      const e = $('#empty'); e.textContent = P.emptyText; e.hidden = false;
    }
  })();

  $('#q').oninput = e => { state.q = e.target.value; go(); };
  $('#sort').onchange = e => { state.sort = e.target.value; go(); };
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; ls('view_' + sectionId, state.view); go(); });
})();
