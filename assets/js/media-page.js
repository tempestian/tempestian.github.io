// ============================================================================
// [AI-MIMARI-NOTU: ADIM 12, 13 & 21 — ORTAK ÇOKLU-MEDYA VİTRİN VE İSTATİSTİK MOTORU]
// Bu dosya `/dizi/`, `/film/`, `/manga/` ve `/kitap/` sayfalarını tek bir ortak
// mimariyle çalıştırır.
// - Hangi sayfada çalıştığını `<body data-section="series|movie|manga|book">`
//   ve `data-data="../data/..."` özniteliklerinden otomatik algılar.
// - Dizi ve Filmlerde IMDb'nin genel/global puanı yerine %100 kullanıcının kendi
//   verdiği ağırlıklı sezon/film puanları (`getEffectiveScore`) ve özel kategoriler
//   (`customGenres`) gösterilir.
// - Adım 11 ("★ Başyapıtlar") ve Adım 13 (Özel Kategori Yüzdesel Dağılım Grafikleri,
//   Format Puan Analizi, Eklenme Yılı Dağılımı) tüm medya sayfalarında aktiftir.
// - Adım 21 (KATMAN SIRALI DETAY GEZİNMESİ VE ZAR MİKRO-ANİMASYONU):
//   * Katman (Tier List) modunda detay penceresi açıldığında Önceki/Sonraki ve klavye ok tuşları
//     ekrandaki Katman sıralamasını izler.
//   * Rastgele seç (🎲) butonunda mikro-dönme animasyonu tetiklenir.
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
  const pageTexts = {
    searchPlaceholder: '',
    emptyText: P.emptyText,
    detailsText: 'Ayrıntılar',
    resetFilterText: 'Filtreleri sıfırla',
    externalButtonText: P.extBtnText,
    footerText: P.footerText
  };

  function applyMediaPageConfig(cfg) {
    const pg = cfg && cfg.pages && cfg.pages[sectionId];
    if (!pg) return;
    if (pg.emptyText) P.emptyText = pg.emptyText;
    if (pg.externalButtonText || pg.anilistButtonText) P.extBtnText = pg.externalButtonText || pg.anilistButtonText;
    if (pg.footerText !== undefined) P.footerText = pg.footerText;
    Object.assign(pageTexts, pg);
    const qEl = $('#q');
    if (qEl && pg.searchPlaceholder) qEl.placeholder = pg.searchPlaceholder;
    const footEl = document.querySelector('.foot');
    if (footEl && pg.footerText !== undefined) {
      footEl.textContent = pg.footerText;
      footEl.hidden = pg.footerText === '';
    }
    const emptyEl = $('#empty');
    if (emptyEl && !emptyEl.hidden) emptyEl.textContent = P.emptyText;
    const moreBtn = document.querySelector('#stats > .more');
    if (moreBtn && pg.detailsText) {
      const ic = moreBtn.querySelector('svg');
      moreBtn.textContent = pg.detailsText;
      if (ic) moreBtn.append(ic);
    }
    const rstBtn = document.querySelector('#fp .more');
    if (rstBtn && pg.resetFilterText) rstBtn.textContent = pg.resetFilterText;
  }
  if (window.SITE_CONFIG) applyMediaPageConfig(window.SITE_CONFIG);
  document.addEventListener('siteconfig', e => applyMediaPageConfig(e.detail));

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
  const savedV = ls('view_' + sectionId);
  const state = { items: [], view: (savedV === 'list' || savedV === 'tier') ? savedV : 'grid', filter: 'all', sort: 'added', q: '', sc: 'all', dc: 'all', kd: 'all', gn: 'all', ay: 'all', mt: 'all' };

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
    const m = { li, it, sc: effScore || 0, key: ((it.title || '') + ' ' + extraMeta).toLocaleLowerCase('tr'), mt: String(extraMeta || '').trim(), y, ay: addedYear, d: dec(y), sn, fl, rp: Math.max(0, ...ps.map(p => p.repeat || 0)), ep: w, g: effGenres };
    nodes.set(it.id, m);
    return li;
  }


function renderTierBoard(visibleNodes) {
  const board = $('#tierBoard');
  if (!board) return;
  board.replaceChildren();
  const tiers = [
    { key: 'S', name: '★ Başyapıt', bg: 'rgba(245,166,35,.18)', fg: '#d98b00', items: [] },
    { key: 'A+', name: '9.0 – 10', bg: 'rgba(43,182,115,.16)', fg: '#2bb673', items: [] },
    { key: 'A', name: '8.0 – 8.9', bg: 'rgba(0,112,243,.15)', fg: 'var(--accent)', items: [] },
    { key: 'B', name: '7.0 – 7.9', bg: 'rgba(139,92,246,.15)', fg: '#8b5cf6', items: [] },
    { key: 'C', name: '7.0 Altı', bg: 'rgba(249,115,22,.15)', fg: '#f97316', items: [] },
    { key: '?', name: 'Puansız', bg: 'var(--glass2)', fg: 'var(--ink2)', items: [] }
  ];
  const sorted = [...visibleNodes].sort((a, b) => (b.sc || 0) - (a.sc || 0) || byAdded(a.it, b.it));
  for (const n of sorted) {
    if (n.it.favorite) tiers[0].items.push(n);
    else if (n.sc >= 9) tiers[1].items.push(n);
    else if (n.sc >= 8) tiers[2].items.push(n);
    else if (n.sc >= 7) tiers[3].items.push(n);
    else if (n.sc > 0) tiers[4].items.push(n);
    else tiers[5].items.push(n);
  }
  const fr = document.createDocumentFragment();
  for (const t of tiers) {
    if (!t.items.length) continue;
    const row = h('div', 'tier-row');
    const head = h('div', 'tier-head');
    head.style.setProperty('--tier-bg', t.bg);
    head.style.setProperty('--tier-fg', t.fg);
    head.append(h('span', 'tier-letter', t.key), h('span', 'tier-name', t.name), h('span', 'tier-cnt', t.items.length + ' yapım'));
    const body = h('div', 'tier-items');
    for (const n of t.items) {
      const card = h('button', 'tier-card');
      card.type = 'button';
      card.dataset.id = n.it.id;
      card.title = n.it.title + (n.sc ? ` (★ ${n.sc})` : '');
      const pWrap = h('div', 'tier-card-poster');
      if (n.it.image) {
        const im = h('img');
        im.src = big(n.it.image);
        im.alt = '';
        im.loading = 'lazy';
        pWrap.append(im);
      }
      if (n.sc) pWrap.append(h('span', 'tier-card-sc', '★ ' + n.sc));
      if (n.it.favorite) pWrap.append(h('span', 'tier-card-fav', '★'));
      card.append(pWrap, h('span', 'tier-card-title', n.it.title));
      card.onclick = () => openSheet(n.it.id, true);
      body.append(card);
    }
    row.append(head, body);
    fr.append(row);
  }
  board.append(fr);
}

  const active = () => ['sc', 'dc', 'kd', 'gn', 'ay', 'mt'].filter(k => state[k] !== 'all').length;
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
        && scOk(s.sc, n.sc) && (s.gn === 'all' || n.g.includes(s.gn)) && (s.dc === 'all' || n.d === s.dc) && (s.ay === 'all' || n.ay === s.ay) && (s.mt === 'all' || n.mt === s.mt) && kOk(s.kd, n);
      n.li.hidden = !ok; n.li.classList.remove('f', 'l');
    }
    const visibleNodes = [];
    for (const li of root.children) { if (li.hidden) continue; shown++; if (!first) first = li; last = li; }
    for (const it of s.items) { const n = nodes.get(it.id); if (n && !n.li.hidden) visibleNodes.push(n); }
    if (first) { first.classList.add('f'); last.classList.add('l'); }
    const isTier = s.view === 'tier';
    const tierBoard = $('#tierBoard');
    if (tierBoard) {
      tierBoard.hidden = !isTier || shown === 0;
      root.hidden = isTier;
      if (isTier && shown > 0) renderTierBoard(visibleNodes);
    }
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
    const ms = [...nodes.values()], gcount = {}, mtCount = {}, ayCount = {};
    for (const m of ms) {
      for (const g of m.g) gcount[g] = (gcount[g] || 0) + 1;
      if (m.mt) mtCount[m.mt] = (mtCount[m.mt] || 0) + 1;
      if (m.ay) ayCount[m.ay] = (ayCount[m.ay] || 0) + 1;
    }
    grp('Puan', 'sc', SCO, Object.fromEntries(SCO.map(([v]) => [v, ms.filter(m => scOk(v, m.sc)).length])));
    grp('Çıkış Dönemi', 'dc', DORD.map(k => [k, DEC[k]]), Object.fromEntries(DORD.map(v => [v, ms.filter(m => m.d === v).length])));
    const ayList = Object.keys(ayCount).sort((a, b) => b.localeCompare(a));
    if (ayList.length > 1) grp('Eklenme / İzleme Yılı', 'ay', ayList.map(y => [y, y]), ayCount);
    const gs = Object.keys(gcount).sort((a, b) => gcount[b] - gcount[a] || a.localeCompare(b, 'tr'));
    if (gs.length) grp('Tür / Kategori', 'gn', gs.map(g => [g, g]), gcount);
    const mtList = Object.keys(mtCount).sort((a, b) => mtCount[b] - mtCount[a] || a.localeCompare(b, 'tr')).slice(0, 20);
    const mtLabel = sectionId === 'series' ? 'Platform / Kanal' : sectionId === 'movie' ? 'Yönetmen' : sectionId === 'manga' ? 'Mangaka / Yazar' : 'Yazar';
    if (mtList.length) grp(mtLabel, 'mt', mtList.map(x => [x, x]), mtCount);
    grp('İçerik', 'kd', KIND, Object.fromEntries(KIND.map(([v]) => [v, ms.filter(m => kOk(v, m)).length])));
    const rs = h('button', 'more', pageTexts.resetFilterText || 'Filtreleri sıfırla'); rs.type = 'button';
    rs.onclick = () => { Object.assign(state, { sc: 'all', dc: 'all', kd: 'all', gn: 'all', ay: 'all', mt: 'all', filter: 'all', q: '' }); $('#q').value = ''; go(); };
    box.append(rs); fp.append(box);
    $('#fbtn').onclick = () => { const o = $('#fp').classList.toggle('open'); $('#fbtn').setAttribute('aria-expanded', o); };
  }

  function stats(items, S) {
    const box = $('#stats'); if (!box) return;
    box.replaceChildren();
    if (!items.length) { box.hidden = true; return; }
    const countedRaw = items.filter(i => UI.tally([i]).anime > 0 || i.status === 'completed');
    const cn = countedRaw.length ? countedRaw : items;
    const rawTally = UI.tally(items);
    const t = S && (S.watched != null || S.read != null || S.anime != null)
      ? {
          anime: (S.watched ?? S.read ?? S.anime) || cn.length,
          season: (S.seasons ?? S.volumes ?? S.films ?? S.season ?? rawTally.season) || cn.length,
          film: S.specials ?? S.extras ?? S.film ?? rawTally.film ?? 0,
          ep: S.episodes ?? S.pages ?? S.chapters ?? S.watchCount ?? rawTally.ep ?? 0
        }
      : {
          anime: rawTally.anime || cn.length,
          season: rawTally.season || cn.length,
          film: rawTally.film,
          ep: rawTally.ep
        };
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

    const more = h('button', 'more', pageTexts.detailsText || 'Ayrıntılar'); more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.insertAdjacentHTML('beforeend', UI.icon('down'));
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

    if (sectionId !== 'movie') {
      const formatBuckets = {
        season: { label: `Ana ${P.unitSeason} (×${P.weights.season.toFixed(2)})`, count: 0, scores: [] },
        movie: { label: `${P.unitFilm} (×${P.weights.movie.toFixed(2)})`, count: 0, scores: [] },
        other: { label: `Yan / Ek (×${P.weights.other.toFixed(2)})`, count: 0, scores: [] }
      };
      for (const it of cn) {
        for (const p of UI.parts(it)) {
          if (p.status !== 'COMPLETED' && !(p.watched > 0)) continue;
          const k = p.kind === 'movie' ? 'movie' : p.kind === 'other' ? 'other' : 'season';
          if (p.status === 'COMPLETED') formatBuckets[k].count++;
          const psc = Number(p.score);
          if (!isNaN(psc) && psc > 0) formatBuckets[k].scores.push(psc);
        }
      }
      const fmtGrid = h('div', 'fmt-cmp-grid');
      for (const fb of Object.values(formatBuckets)) {
        if (!fb.count && !fb.scores.length) continue;
        const fAvg = fb.scores.length ? (fb.scores.reduce((a, b) => a + b, 0) / fb.scores.length).toFixed(1) : '-';
        const card = h('div', 'fmt-cmp-card glass');
        card.innerHTML = `<span class="fmt-cmp-lbl"></span><b class="fmt-cmp-val"></b><small class="fmt-cmp-sub"></small>`;
        card.querySelector('.fmt-cmp-lbl').textContent = fb.label;
        card.querySelector('.fmt-cmp-val').textContent = fAvg !== '-' ? `★ ${fAvg}` : `${fb.count} tamamlandı`;
        card.querySelector('.fmt-cmp-sub').textContent = `${fb.count} tamamlanan · ${fb.scores.length} puanlı`;
        fmtGrid.append(card);
      }
      if (fmtGrid.children.length) blk('Format & ağırlıklı puan analizi', fmtGrid);
    }

    const ayCounts = {};
    for (const i of cn) {
      const ay = nodes.get(i.id) && nodes.get(i.id).ay;
      if (ay) ayCounts[ay] = (ayCounts[ay] || 0) + 1;
    }
    const ayKeys = Object.keys(ayCounts).sort();
    if (ayKeys.length > 1) {
      blk('Eklenme yılına göre', bars(ayKeys.map(y => [y, ayCounts[y], 'ay', y])));
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
  sheet.innerHTML = '<div class="sheet-bg"></div><div class="sheet-card glass sq"><div class="sheet-head"><img class="sheet-cover" alt=""><div class="sheet-t"><h2 id="sh-title"></h2><p class="sh-sub"></p><p class="sh-genres meta" style="margin-top:4px"></p></div><button class="btn glass" type="button" aria-label="Kapat" data-close></button></div><div class="sh-pg" hidden><i></i></div><ol class="parts"></ol><div class="sheet-foot-bar"><div class="sheet-nav-grp"><button type="button" class="sheet-nav-btn" data-sh-prev title="Önceki (←)">← Önceki</button><span class="sheet-pos-lbl" data-sh-pos></span><button type="button" class="sheet-nav-btn" data-sh-next title="Sonraki (→)">Sonraki →</button></div><div class="sheet-act-grp"><button type="button" class="sheet-share-btn" data-sh-share title="Bağlantıyı kopyala">🔗 Bağlantıyı Kopyala</button><a class="sh-al" target="_blank" rel="noopener"></a></div></div></div>';
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
    const orderedIds = getVisibleOrderedIds();
    const curIdx = orderedIds.indexOf(it.id);
    const prevBtn = t('[data-sh-prev]'), nextBtn = t('[data-sh-next]'), posLbl = t('[data-sh-pos]'), shareBtn = t('[data-sh-share]');
    if (posLbl) posLbl.textContent = curIdx >= 0 ? `${curIdx + 1} / ${orderedIds.length}` : '';
    if (prevBtn) {
      prevBtn.disabled = curIdx <= 0;
      prevBtn.onclick = () => { if (curIdx > 0) navigateSheetTo(orderedIds[curIdx - 1]); };
    }
    if (nextBtn) {
      nextBtn.disabled = curIdx < 0 || curIdx >= orderedIds.length - 1;
      nextBtn.onclick = () => { if (curIdx >= 0 && curIdx < orderedIds.length - 1) navigateSheetTo(orderedIds[curIdx + 1]); };
    }
    if (shareBtn) {
      shareBtn.textContent = '🔗 Bağlantıyı Kopyala';
      shareBtn.onclick = async () => {
        // [AI-MIMARI-NOTU: ADIM 22 — SOSYAL MEDYA PAYLAŞIM KARTI BAĞLANTISI]:
        const rootPath = document.body.dataset.root || '../';
        const cleanBase = new URL(rootPath, location.href).href;
        const shareUrl = `${cleanBase}a/${encodeURIComponent(it.id)}.html`;
        try {
          await navigator.clipboard.writeText(shareUrl);
          shareBtn.textContent = '✓ Kopyalandı!';
          setTimeout(() => { shareBtn.textContent = '🔗 Bağlantıyı Kopyala'; }, 2000);
        } catch (e) {}
      };
    }
    t('.sheet-card').scrollTop = 0;
  }

  function getVisibleOrderedIds() {
    // [AI-MIMARI-NOTU: ADIM 21]: Katman (Tier List) modundayken ekrandaki S -> A+ -> A -> B... görsel sırasını izler.
    if (state.view === 'tier') {
      const tb = $('#tierBoard');
      if (tb && !tb.hidden) {
        const tierIds = [...tb.querySelectorAll('.tier-card')].map(c => c.dataset.id).filter(Boolean);
        if (tierIds.length) return tierIds;
      }
    }
    const root = $('#list');
    const domIds = [];
    if (root && root.children.length) {
      for (const li of root.children) {
        if (li.hidden) continue;
        const a = li.querySelector('h3 a');
        if (a && a.getAttribute('href')) domIds.push(decodeURIComponent(a.getAttribute('href').slice(1)));
      }
    }
    return domIds.length ? domIds : state.items.map(x => x.id);
  }

  function navigateSheetTo(targetId) {
    if (!targetId) return;
    history.replaceState(null, '', '#' + encodeURIComponent(targetId));
    syncSheet();
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
  addEventListener('keydown', e => {
    if (sheet.hidden) return;
    if (e.key === 'Escape') closeSheet();
    else if (e.key === 'ArrowLeft') {
      const prevBtn = sheet.querySelector('[data-sh-prev]');
      if (prevBtn && !prevBtn.disabled) { e.preventDefault(); prevBtn.click(); }
    } else if (e.key === 'ArrowRight') {
      const nextBtn = sheet.querySelector('[data-sh-next]');
      if (nextBtn && !nextBtn.disabled) { e.preventDefault(); nextBtn.click(); }
    }
  });

  (async () => {
    try {
      let remoteDoc = null;
      try {
        const r = await fetch(dataPath, { cache: 'no-store' });
        if (r.ok) remoteDoc = await r.json();
      } catch (e) {}
      let previewDoc = null;
      try {
        const prevAll = JSON.parse(ls('tp_multimedia_preview') || '{}');
        if (prevAll && prevAll[sectionId]) previewDoc = prevAll[sectionId];
      } catch (e) {}
      const remItems = (remoteDoc && (Array.isArray(remoteDoc.items) ? remoteDoc.items : Array.isArray(remoteDoc[sectionId]) ? remoteDoc[sectionId] : Array.isArray(remoteDoc.books) ? remoteDoc.books : Array.isArray(remoteDoc.movies) ? remoteDoc.movies : [])) || [];
      const prevItems = (previewDoc && (Array.isArray(previewDoc.items) ? previewDoc.items : Array.isArray(previewDoc[sectionId]) ? previewDoc[sectionId] : Array.isArray(previewDoc.books) ? previewDoc.books : Array.isArray(previewDoc.movies) ? previewDoc.movies : [])) || [];
      const d = (prevItems.length > 0 && prevItems.length >= remItems.length) ? previewDoc : (remoteDoc || previewDoc);
      const items = (d && (Array.isArray(d.items) ? d.items : Array.isArray(d[sectionId]) ? d[sectionId] : Array.isArray(d.books) ? d.books : Array.isArray(d.movies) ? d.movies : Array.isArray(d.series) ? d.series : Array.isArray(d.manga) ? d.manga : [])) || [];
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

  const rndBtn = document.getElementById('randomPickBtn');
  if (rndBtn) {
    rndBtn.onclick = () => {
      // [AI-MIMARI-NOTU: ADIM 21]: Butona mikro-dönme animasyonu ekler
      rndBtn.classList.remove('is-rolling');
      void rndBtn.offsetWidth;
      rndBtn.classList.add('is-rolling');
      const visible = state.items.filter(it => {
        const n = nodes.get(it.id);
        return n && !n.li.hidden;
      });
      const pool = visible.length ? visible : state.items;
      if (!pool.length) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      openSheet(pick.id, true);
    };
  }
})();
