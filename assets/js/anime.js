// ============================================================================
// [AI-MIMARI-NOTU: ANİME LİSTESİ, GELİŞMİŞ İSTATİSTİK GRAFİKLERİ VE DETAY MOTORU (ADIM 7, 8, 11, 13 & 21)]
// Bu dosya `/anime/` sayfasını (`data/anime.json`) oluşturur.
// - Puanlar: Sezon (×1.00), Film (×0.35) ve Yan İçerik (×0.15) ağırlıklı puan ortalamasından
//   (`getEffectiveScore`) otomatik belirlenir.
// - Türler: Yalnızca admin tarafından seçilen özel kategoriler (`customGenres`: Shounen,
//   Seinen, Isekai, Rom-Com vb.) filtrelerde ve istatistiklerde yer alır.
// - Gelişmiş İstatistik Grafikleri (Adım 13):
//   * Özel Kategori Yüzdesel Dağılım Çubukları (`.genre-bars`)
//   * Format Bazlı Puan & İçerik Karşılaştırması (Sezon vs Film vs Yan İçerik ortalama puan ve adet)
//   * İzleme / Eklenme Yılı Dağılımı ve Çıkış On Yılı Grafiği
// - Adım 21 (KATMAN SIRALI DETAY GEZİNMESİ VE ZAR MİKRO-ANİMASYONU):
//   * Katman (Tier List) görünümünde detay penceresi açıldığında Önceki/Sonraki butonları
//     ve ok tuşları doğrudan ekrandaki Katman (S, A+, A, B, C...) görsel sırasını izler.
//   * Rastgele seç (🎲) butonuna tıklandığında pürüzsüz dönme animasyonu tetiklenir.
// ============================================================================
const $ = s => document.querySelector(s);
const ST = {completed:'İzlendi', watching:'İzleniyor', paused:'Beklemede', dropped:'Bırakıldı', planned:'Planlandı'};
const NEXT = 'Devam edilecek';
const FAV_LABEL = '★ Başyapıtlar';
const FMT = {TV:'TV', TV_SHORT:'Kısa', MOVIE:'Film', OVA:'OVA', SPECIAL:'Özel', ONA:'ONA'};
const own = p => p.status !== 'PLANNING' && p.status !== 'NONE';

const pageTexts = {
  searchPlaceholder: 'Ara',
  emptyText: 'Eşleşen anime yok.',
  footerText: "Kapaklar sahiplerine aittir.",
  detailsText: 'Ayrıntılar',
  resetFilterText: 'Filtreleri sıfırla',
  anilistButtonText: "AniList'te aç"
};

function applyAnimePageConfig(cfg) {
  const pa = cfg && cfg.pages && cfg.pages.anime;
  if (!pa) return;
  Object.assign(pageTexts, pa);
  if (pa.externalButtonText && !pa.anilistButtonText) pageTexts.anilistButtonText = pa.externalButtonText;
  const qEl = $('#q');
  if (qEl && pa.searchPlaceholder) qEl.placeholder = pa.searchPlaceholder;
  const footEl = document.querySelector('.foot');
  if (footEl && pa.footerText !== undefined) {
    footEl.textContent = pa.footerText;
    footEl.hidden = pa.footerText === '';
  }
  const emptyEl = $('#empty');
  if (emptyEl && !emptyEl.hidden && state.items.length) emptyEl.textContent = pageTexts.emptyText;
}
if (window.SITE_CONFIG) applyAnimePageConfig(window.SITE_CONFIG);
document.addEventListener('siteconfig', e => applyAnimePageConfig(e.detail));

function partState(p){
  const ep = p.episodes||0, w = p.watched||0, frac = ep ? w+'/'+ep : w+' bölüm';
  if(p.status==='NONE' || (!p.status && !w)){
    return p.release==='NOT_YET_RELEASED' ? ['Yayınlanmadı','no'] : p.release==='CANCELLED' ? ['İptal edildi','no'] : ['İzlenmedi','no'];
  }
  if(p.status==='PLANNING') return ['Planlandı','no'];
  if(p.status==='DROPPED') return ['Bırakıldı · '+frac,'drop'];
  if(p.status==='PAUSED') return ['Beklemede · '+frac,'cur'];
  if(p.status==='CURRENT' || (ep && w<ep)) return ['İzleniyor · '+frac,'cur'];
  return ['İzlendi','done'];
}
const sum = (a,k) => a.reduce((n,x) => n+(x[k]||0), 0);
const rew = ps => { const n = Math.max(0, ...ps.map(p => p.repeat||0)); return n ? '↻ '+n+'× tekrar' : ''; };
function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){} }
const savedView = ls('view');
const state = {items:[], statsConfig:{}, view:(savedView==='list'||savedView==='tier') ? savedView : 'grid', filter:'all', sort:'added', q:''};

const byAdded = (a,b) => (b.addedAt||'').localeCompare(a.addedAt||'');
const nodes = new Map();
let order = '', raf = 0;
const big = u => {
  if (!u) return '';
  if (/^(https?:|data:|blob:|\/)/i.test(u)) return u.replace('/cover/medium/','/cover/large/');
  return (document.body.dataset.root || '../') + u.replace(/^\.?\//, '');
};
const dec = y => !y ? 'old' : y>=2020 ? '2020' : y>=2010 ? '2010' : y>=2000 ? '2000' : 'old';
const DEC = {2020:"2020'ler",2010:"2010'lar",2000:"2000'ler",old:'Daha eski'};
const DORD = ['2020','2010','2000','old'];

function getPartWeight(p) {
  if (!p) return 0.15;
  if (p.kind === 'movie' || p.format === 'MOVIE') return 0.35;
  if (p.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(p.format)) return 0.15;
  return 1.0;
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
  if (totalWeight > 0) {
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }
  const s = Number(it.score);
  return !isNaN(s) && s > 0 ? Math.round(s * 10) / 10 : null;
}

function getEffectiveGenres(it, genreSourceRule = 'custom_only') {
  if (!it) return [];
  if (Array.isArray(it.customGenres) && it.customGenres.length) {
    return [...new Set(it.customGenres.map(g => String(g).trim()).filter(Boolean))];
  }
  if (genreSourceRule === 'custom_only') return [];
  const raw = Array.isArray(it.genres) ? it.genres : [];
  return [...new Set(raw.map(g => String(g).trim()).filter(Boolean))];
}

const SCO = [['9','9 ve üstü'],['8','8–9'],['7','7–8'],['low','7 altı'],['none','Puansız']];
const KIND = [['fav','★ Başyapıt'],['multi','2+ sezon'],['movie','Filmli'],['rewatch','Tekrar izlenen']];
const COL = {completed:'var(--accent)',watching:'#3ccf91',paused:'var(--warn)',dropped:'var(--bad)',planned:'var(--ink2)'};
const scOk = (v,x) => v==='all' || (v==='none' ? !x : v==='low' ? x>0 && x<7 : v[0]==='b' ? Math.min(10,Math.floor(x))===+v.slice(1) : x>=+v && (+v===9 || x<+v+1));
const kOk = (v,m) => v==='all' || (v==='fav' ? Boolean(m.it.favorite) : v==='multi' ? m.sn>1 : v==='movie' ? m.fl>0 : m.rp>0);
const h = (t,c,x) => { const e = document.createElement(t); if(c) e.className = c; if(x!=null) e.textContent = x; return e; };
Object.assign(state, {sc:'all', dc:'all', kd:'all', gn:'all', ay:'all'});
const SORTS = {
  added: byAdded,
  score: (a,b) => (nodes.get(b.id).sc||0)-(nodes.get(a.id).sc||0) || byAdded(a,b),
  title: (a,b) => (a.title||'').localeCompare(b.title||'','tr'),
  year: (a,b) => (nodes.get(b.id).y||0)-(nodes.get(a.id).y||0),
  eps: (a,b) => nodes.get(b.id).ep-nodes.get(a.id).ep
};

function build(it){
  const ps = UI.parts(it).filter(own), ep = sum(ps,'episodes'), w = sum(ps,'watched');
  const cnt = k => ps.filter(p => p.kind===k).length, sn = cnt('season'), fl = cnt('movie'), ot = cnt('other');
  const ys = ps.map(p => p.year).filter(Boolean), y = ys.length ? Math.min(...ys) : 0;
  const addedYear = (it.addedAt && /^\d{4}/.test(it.addedAt)) ? it.addedAt.slice(0, 4) : '';
  const effScore = getEffectiveScore(it);
  const effGenres = getEffectiveGenres(it, (state.statsConfig && state.statsConfig.genreSourceRule) || 'custom_only');
  const li = h('li');
  if (it.favorite) li.classList.add('is-fav');
  li.innerHTML = '<div class="poster"><img alt="" loading="lazy" decoding="async" width="142" height="213"></div><div class="t"><h3><a target="_blank" rel="noopener"></a></h3><p class="meta"></p><p class="st"></p></div>';
  const a = li.querySelector('a'); a.textContent = it.title;
  a.href = '#'+it.id; a.onclick = e => { if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); openSheet(it.id, true); };
  const genrePreview = effGenres.slice(0, 2).join(' · ');
  li.querySelector('.meta').textContent = [it.favorite ? '★ Başyapıt' : '', sn && sn+' sezon', fl && fl+' film', ot && ot+' ek', rew(ps), !ep ? w+' bölüm' : w===ep ? ep+' bölüm' : w+'/'+ep+' bölüm', genrePreview].filter(Boolean).join(', ');
  const st = li.querySelector('.st'), po = li.querySelector('.poster');
  if (it.favorite) {
    const fb = h('span', 'fav-badge', '★');
    fb.title = 'Favori / Başyapıt';
    po.append(fb);
  }
  const lab = it.status !== 'completed' ? (ST[it.status]||it.status) : it.next ? NEXT : '';
  if(lab){ st.textContent = lab; st.classList.add('st-'+(it.status !== 'completed' ? it.status : 'next')); const sb = h('span','sb st-'+(it.status !== 'completed' ? it.status : 'next'), lab); po.append(sb); } else st.remove();
  if(it.status !== 'completed' && ep && w < ep){ const pg = h('div','pg'); pg.innerHTML = '<i></i>'; pg.firstChild.style.setProperty('--w', Math.round(w/ep*100)+'%'); po.append(pg); }
  if(effScore){
    const sc = h('span','score glass');
    sc.setAttribute('role','img'); sc.setAttribute('aria-label','Puan '+effScore+'/10'); sc.innerHTML = UI.icon('star'); sc.append(String(effScore));
    li.append(sc);
  }
  const im = li.querySelector('img'); im.onload = () => im.classList.add('in');
  if(it.image) im.src = big(it.image);
  const m = {li, it, sc: effScore || 0, key:(it.title||'').toLocaleLowerCase('tr'), y, ay:addedYear, d:dec(y), sn, fl, rp:Math.max(0, ...ps.map(p => p.repeat||0)), ep:w, g:effGenres};
  nodes.set(it.id, m); return li;
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

const active = () => ['sc','dc','kd','gn','ay'].filter(k => state[k]!=='all').length;
function render(){
  const s = state, q = s.q.trim().toLocaleLowerCase('tr'), root = $('#list');
  root.className = s.view;
  if(order !== s.sort && s.items.length){
    order = s.sort;
    const fr = document.createDocumentFragment();
    [...s.items].sort(SORTS[s.sort]||byAdded).forEach(it => fr.append(nodes.get(it.id).li));
    root.append(fr);
  }
  let shown = 0, first = null, last = null;
  for(const it of s.items){
    const n = nodes.get(it.id);
    const filterMatch = s.filter==='all'
      || (s.filter==='fav' ? Boolean(it.favorite) : s.filter==='next' ? it.next : it.status===s.filter);
    const ok = filterMatch && n.key.includes(q)
      && scOk(s.sc, n.sc) && (s.gn==='all' || n.g.includes(s.gn)) && (s.dc==='all' || n.d===s.dc) && (s.ay==='all' || n.ay===s.ay) && kOk(s.kd, n);
    n.li.hidden = !ok; n.li.classList.remove('f','l');
  }
  const visibleNodes = [];
  for(const li of root.children){ if(li.hidden) continue; shown++; if(!first) first = li; last = li; }
  for(const it of s.items){ const n = nodes.get(it.id); if(n && !n.li.hidden) visibleNodes.push(n); }
  if(first){ first.classList.add('f'); last.classList.add('l'); }
  const isTier = s.view === 'tier';
  const tierBoard = $('#tierBoard');
  if (tierBoard) {
    tierBoard.hidden = !isTier || shown === 0;
    root.hidden = isTier;
    if (isTier && shown > 0) renderTierBoard(visibleNodes);
  }
  $('#empty').hidden = shown > 0;
  $('#empty').textContent = pageTexts.emptyText || 'Eşleşen anime yok.';
  const n = active(), dot = $('#fdot'); dot.hidden = !n; dot.textContent = n;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view===s.view));
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filter===s.filter));
  document.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', state[b.dataset.g]===b.dataset.v));
}
const go = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); };
const setF = (k,v) => { state[k] = v; go(); };
const jump = () => { $('#list').scrollIntoView({behavior:'smooth', block:'start'}); };

function chip(root, label, count, attrs, fn){
  const b = h('button',null,label); b.type = 'button'; Object.assign(b.dataset, attrs);
  if(count!=null) b.append(h('small',null,count));
  b.onclick = fn; root.append(b);
}
function filters(d){
  const fp = $('#fpIn'); fp.replaceChildren();
  const box = h('div');
  const grp = (title, k, opts, counts) => {
    const g = h('div','fg'), row = h('div','chips'); g.append(h('span',null,title), row);
    chip(row,'Hepsi',null,{g:k,v:'all'},() => setF(k,'all'));
    for(const [v,l] of opts){ const c = counts[v]; if(c===0) continue; chip(row,l,c,{g:k,v},() => setF(k,v)); }
    box.append(g);
  };
  const ms = [...nodes.values()], gcount = {};
  for(const m of ms) for(const g of m.g) gcount[g] = (gcount[g]||0)+1;
  grp('Puan','sc',SCO,Object.fromEntries(SCO.map(([v]) => [v, ms.filter(m => scOk(v,m.sc)).length])));
  grp('Yıl','dc',DORD.map(k => [k,DEC[k]]),Object.fromEntries(DORD.map(v => [v, ms.filter(m => m.d===v).length])));
  const gs = Object.keys(gcount).sort((a,b) => gcount[b]-gcount[a] || a.localeCompare(b,'tr'));
  if(gs.length) grp('Tür / Kategori','gn',gs.map(g => [g,g]),gcount);
  grp('İçerik','kd',KIND,Object.fromEntries(KIND.map(([v]) => [v, ms.filter(m => kOk(v,m)).length])));
  const rs = h('button','more', pageTexts.resetFilterText || 'Filtreleri sıfırla'); rs.type = 'button';
  rs.onclick = () => { Object.assign(state,{sc:'all',dc:'all',kd:'all',gn:'all',ay:'all',filter:'all',q:''}); $('#q').value = ''; go(); };
  box.append(rs); fp.append(box);
  $('#fbtn').onclick = () => { const o = $('#fp').classList.toggle('open'); $('#fbtn').setAttribute('aria-expanded', o); };
}

// [AI-MIMARI-NOTU: ADIM 13 — GELİŞMİŞ İSTATİSTİK GRAFİKLERİ]
function stats(d){
  const box = $('#stats'); box.replaceChildren();
  const cfg = { animeCountRule: 'completed_season_or_movie', includeInProgressEpisodes: true, genreSourceRule: 'custom_only', ...(d.statsConfig || {}) };
  const cn = d.anime.filter(i => UI.tally([i], cfg).anime > 0);
  const S = d.stats;
  const t = S ? {anime:S.anime, season:S.season, film:S.film, ep:S.episodes} : UI.tally(d.anime, cfg);
  const scs = cn.map(i => getEffectiveScore(i)).filter(Boolean);
  const avg = S && S.avgScore != null ? S.avgScore : (scs.length ? (scs.reduce((a,b)=>a+b,0)/scs.length) : null);
  const favCount = d.anime.filter(i => i.favorite).length;
  const row = h('div','stats-row');
  for(const [v,l,tip] of [
    [t.anime,'anime','En az 1 sezonu veya filmi tamamlanmış olan animeler sayılır'],
    [t.season,'sezon'],
    [t.film,'film'],
    [t.ep,'bölüm','Tamamlanan ve şu an izlenmekte olan parçaların toplam izlenen bölümleri (yeniden izlemeler hariç)'],
    [avg ? (+avg).toFixed(1) : '-','ort. puan','Sezon (×1.00), Film (×0.35) ve Yan İçerik (×0.15) ağırlıklı puan ortalaması']
  ]){
    const e = h('div','stat'); e.innerHTML = '<b></b><span></span>'; e.firstChild.textContent = v; e.lastChild.textContent = l; if(tip) e.title = tip; row.append(e);
  }
  const more = h('button','more', pageTexts.detailsText || 'Ayrıntılar'); more.type = 'button'; more.setAttribute('aria-expanded','false'); more.insertAdjacentHTML('beforeend', UI.icon('down'));
  const ins = h('div','ins'), inn = h('div','ins-in'); ins.append(inn);
  const blk = (title, ...kids) => { const b = h('div','blk'); b.append(h('h4',null,title), ...kids); inn.append(b); };
  const bars = (arr) => { const w = h('div','hbs'), mx = Math.max(1,...arr.map(a => a[1]));
    for(const [l,n,k,v] of arr){ const b = h('button','hb'); b.type = 'button'; b.setAttribute('aria-label', l+': '+n); b.innerHTML = '<b></b><i></i><span></span>'; b.children[0].textContent = n || ''; b.children[1].style.setProperty('--h', (n/mx*100)+'%'); b.children[2].textContent = l; b.onclick = () => { setF(k,v); jump(); }; w.append(b); } return w; };
  const hist = Array.from({length:10},(_,i) => [String(i+1), 0, 'sc', 'b'+(i+1)]);
  for(const x of scs) hist[Math.min(10,Math.max(1,Math.floor(x)))-1][1]++;
  blk('Puan dağılımı', bars(hist.slice(Math.min(...hist.map((x,i) => x[1] ? i : 9)))));

  // Adım 13: Format Bazlı Puan & İçerik Analizi (Sezon vs Film vs Yan İçerik)
  const formatBuckets = {
    season: { label: 'Ana Sezonlar (×1.00)', count: 0, scores: [] },
    movie: { label: 'Filmler (×0.35)', count: 0, scores: [] },
    other: { label: 'Yan İçerikler / OVA (×0.15)', count: 0, scores: [] }
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
  for (const [k, fb] of Object.entries(formatBuckets)) {
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

  const dcs = [...DORD].reverse().map(k => [DEC[k].replace("'ler",'').replace("'lar",''), cn.filter(i => nodes.get(i.id).d===k).length, 'dc', k]);
  blk('Çıkış yılına göre', bars(dcs));

  // Adım 13: İzleme / Eklenme Yılına Göre Dağılım
  const ayCounts = {};
  for (const i of cn) {
    const ay = nodes.get(i.id) && nodes.get(i.id).ay;
    if (ay) ayCounts[ay] = (ayCounts[ay] || 0) + 1;
  }
  const ayKeys = Object.keys(ayCounts).sort();
  if (ayKeys.length > 1) {
    blk('Eklenme / izleme yılına göre', bars(ayKeys.map(y => [y, ayCounts[y], 'ay', y])));
  }

  const sg = h('div','seg'), lg = h('div','leg');
  for(const k of Object.keys(ST)){ const n = d.anime.filter(i => i.status===k).length; if(!n) continue;
    const b = h('button'); b.type = 'button'; b.title = ST[k]+': '+n; b.style.cssText = '--n:'+n+';--c:'+COL[k]; b.onclick = () => { setF('filter',k); jump(); }; sg.append(b);
    const l = h('span'); l.innerHTML = '<i></i>'; l.firstChild.style.setProperty('--c',COL[k]); l.append(ST[k]+' '+n); lg.append(l); }
  const note = S && S.listed ? h('p','meta',S.listed+' anime listede; '+S.anime+' tanesi sayılıyor (en az 1 sezon veya filmi tamamlananlar). '+(S.inProgressEpisodes ? 'Devam eden sezonlarda izlenen '+S.inProgressEpisodes+' bölüm toplam bölüme dahil edildi.' : '')) : null;
  if(note) note.style.marginTop = '10px';
  blk('Durum', ...[sg, lg, note].filter(Boolean));
  const H = S && S.highlights, hl = h('div','hl');
  const add = (l, o, v) => { if(!o) return; const r = h('div'); r.append(h('span',null,l), h('b',null,o.title+' · '+v)); hl.append(r); };
  if(H){
    add('En yüksek puan', H.topScore, H.topScore && H.topScore.score + (H.topScore.ties ? ' ('+H.topScore.ties+' anime daha aynı puanda)' : ''));
    add('En çok izlenen', H.mostWatched, H.mostWatched && H.mostWatched.episodes+' bölüm'+(H.mostWatched.status!=='completed' ? ' · '+(ST[H.mostWatched.status]||'').toLocaleLowerCase('tr') : ''));
    add('En çok tekrar', H.mostRewatched, H.mostRewatched && H.mostRewatched.times+' kez izlendi');
  }
  if (favCount > 0) {
    const r = h('div');
    r.append(h('span', null, 'Favoriler / Başyapıtlar'), h('b', null, favCount + ' yapım'));
    hl.append(r);
  }
  if(hl.children.length) blk('Öne çıkanlar', hl);

  // Adım 13: Özel Kategori Yüzdesel Dağılım Grafiği (.genre-bars)
  const gc = {};
  for(const i of cn){
    const gs = nodes.get(i.id) ? nodes.get(i.id).g : getEffectiveGenres(i, cfg.genreSourceRule);
    for(const g of gs) gc[g] = (gc[g]||0)+1;
  }
  const tg = Object.keys(gc).sort((a,b) => gc[b]-gc[a] || a.localeCompare(b,'tr')).slice(0,12);
  if(tg.length){
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
      btn.querySelector('.gb-val').textContent = `${gc[g]} anime (%${pct})`;
      btn.onclick = () => { setF('gn', g); jump(); };
      gBars.append(btn);
    }
    blk('Özel kategori & tür dağılımı', gBars);
  }
  more.onclick = () => { const o = box.classList.toggle('open'); more.setAttribute('aria-expanded', o); };
  box.append(row, ins, more); box.hidden = false;
}

(async () => {
  try {
    let remoteDoc = null;
    try {
      const r = await fetch('../data/anime.json', { cache: 'no-store' });
      if (r.ok) remoteDoc = await r.json();
    } catch (e) {}
    let prevDoc = null;
    try {
      const prev = ls('tp_anime_preview');
      if (prev) prevDoc = JSON.parse(prev);
    } catch (e) {}
    const remLen = (remoteDoc && Array.isArray(remoteDoc.anime)) ? remoteDoc.anime.length : 0;
    const prevLen = (prevDoc && Array.isArray(prevDoc.anime)) ? prevDoc.anime.length : 0;
    const d = (prevLen > 0 && prevLen >= remLen && (prevDoc.updated || '') >= ((remoteDoc && remoteDoc.updated) || ''))
      ? prevDoc
      : (remoteDoc || prevDoc);
    state.items = d.anime;
    state.statsConfig = { animeCountRule: 'completed_season_or_movie', includeInProgressEpisodes: true, genreSourceRule: 'custom_only', ...(d.statsConfig || {}) };
    const root = $('#list'), fr = document.createDocumentFragment();
    d.anime.forEach(it => fr.append(build(it)));
    root.append(fr);
    stats(d); filters(d);
    const chips = $('#chips');
    for(const [k,label] of [['all','Hepsi'], ['fav',FAV_LABEL], ['next',NEXT], ...Object.entries(ST)]){
      const n = k==='all' ? d.anime.length : k==='fav' ? d.anime.filter(i => i.favorite).length : k==='next' ? d.anime.filter(i => i.next).length : d.anime.filter(i => i.status===k).length;
      if(!n) continue;
      chip(chips,label,n,{filter:k},() => setF('filter',k));
    }
    render(); syncSheet();
  } catch (err) {
    const e = $('#empty'); e.textContent = 'Liste yüklenemedi.'; e.hidden = false;
  }
})();

$('#q').oninput = e => { state.q = e.target.value; go(); };
$('#sort').onchange = e => { state.sort = e.target.value; go(); };
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; ls('view', state.view); go(); });

const sheet = document.createElement('div');
sheet.className = 'sheet'; sheet.hidden = true; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-labelledby','sh-title');
sheet.innerHTML = '<div class="sheet-bg"></div><div class="sheet-card glass sq"><div class="sheet-head"><img class="sheet-cover" alt=""><div class="sheet-t"><h2 id="sh-title"></h2><p class="sh-sub"></p><p class="sh-genres meta" style="margin-top:4px"></p></div><button class="btn glass" type="button" aria-label="Kapat" data-close></button></div><div class="sh-pg" hidden><i></i></div><ol class="parts"></ol><div class="sheet-foot-bar"><div class="sheet-nav-grp"><button type="button" class="sheet-nav-btn" data-sh-prev title="Önceki yapım (←)">← Önceki</button><span class="sheet-pos-lbl" data-sh-pos></span><button type="button" class="sheet-nav-btn" data-sh-next title="Sonraki yapım (→)">Sonraki →</button></div><div class="sheet-act-grp"><button type="button" class="sheet-share-btn" data-sh-share title="Bu yapımın doğrudan bağlantısını kopyala">🔗 Bağlantıyı Kopyala</button><a class="sh-al" target="_blank" rel="noopener"></a></div></div></div>';
document.body.append(sheet);
const closeBtn = sheet.querySelector('[data-close]'); closeBtn.innerHTML = UI.icon('close');
let opener = null, pushed = false;

function fillSheet(it){
  const ps = UI.parts(it), t = sheet.querySelector.bind(sheet);
  const effScore = getEffectiveScore(it);
  const effGenres = getEffectiveGenres(it, (state.statsConfig && state.statsConfig.genreSourceRule) || 'custom_only');
  t('#sh-title').textContent = it.title;
  const bits = [];
  if (it.favorite) bits.push('★ Başyapıt');
  bits.push(it.status==='completed' && it.next ? NEXT : (ST[it.status]||it.status));
  if(effScore) bits.push('★ '+effScore);
  const cnt = k => ps.filter(p => p.kind===k && own(p)).length;
  const c = [cnt('season') && cnt('season')+' sezon', cnt('movie') && cnt('movie')+' film', cnt('other') && cnt('other')+' ek'].filter(Boolean).join(', ');
  if(c) bits.push(c);
  const rp = rew(ps.filter(own)); if(rp) bits.push(rp);
  t('.sh-sub').textContent = bits.join(' · ');
  const gEl = t('.sh-genres');
  if (gEl) {
    gEl.textContent = effGenres.join(' · ');
    gEl.hidden = !effGenres.length;
  }
  const im = t('.sheet-cover'); im.hidden = !it.image; if(it.image) im.src = big(it.image);
  const own2 = ps.filter(own), te = sum(own2,'episodes'), tw = sum(own2,'watched'), pg = t('.sh-pg');
  pg.hidden = !(te && tw < te); if(!pg.hidden) pg.firstChild.style.setProperty('--w', Math.round(tw/te*100)+'%');
  const ol = t('.parts'); ol.replaceChildren();
  for(const p of ps){
    const [txt, cls] = partState(p), li = document.createElement('li');
    li.className = 'part '+cls;
    const isNumericId = typeof p.id === 'number' || /^\d+$/.test(String(p.id || ''));
    const partUrl = p.url || (isNumericId ? 'https://anilist.co/anime/'+p.id : '');
    li.innerHTML = '<span class="pd" aria-hidden="true"></span><div class="pt">'+(partUrl ? '<a target="_blank" rel="noopener"></a>' : '<span class="pt-name"></span>')+'<span class="pm"></span></div><span class="ps"></span>';
    const nameNode = li.querySelector('a, .pt-name');
    nameNode.textContent = p.name;
    if (partUrl && nameNode.tagName === 'A') nameNode.href = partUrl;
    li.querySelector('.pm').textContent = [FMT[p.format]||(p.kind==='movie'?'Film':''), p.year, p.kind!=='movie' && p.episodes>1 ? p.episodes+' bölüm' : '', p.score ? '★ '+p.score : ''].filter(Boolean).join(' · ');
    li.querySelector('.ps').textContent = txt + (p.repeat ? (cls==='done' ? ' · '+(p.repeat+1)+' kez' : ' · ↻ '+p.repeat+' tekrar') : '');
    ol.append(li);
  }
  const al = t('.sh-al');
  const mainUrl = it.url || (it.anilistId ? 'https://anilist.co/anime/'+it.anilistId : '');
  if (mainUrl) {
    al.href = mainUrl;
    al.textContent = pageTexts.anilistButtonText || "AniList'te aç";
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
      // Doğrudan `a/<id>.html` adresi kopyalanır; böylece Discord, WhatsApp, Twitter gibi
      // platformların crawler botları kullanıcının puanını, sezon/bölüm sayısını ve afişini
      // estetik büyük kart olarak çekerken, tıklayan kişi 0ms içinde `anime/#<id>` detayına yönlendirilir.
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
const hashId = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch(e) { return ''; } };
function syncSheet(){
  const it = state.items.find(i => i.id === hashId());
  if(it){
    if(sheet.hidden) opener = document.activeElement;
    fillSheet(it); sheet.hidden = false; document.body.style.overflow = 'hidden'; closeBtn.focus({preventScroll:true});
  } else if(!sheet.hidden){
    sheet.hidden = true; document.body.style.overflow = ''; pushed = false;
    if(opener && opener.focus) opener.focus({preventScroll:true}); opener = null;
  }
}
function openSheet(id, viaClick){ pushed = !!viaClick; location.hash = id; }
function closeSheet(){ if(pushed) history.back(); else { history.replaceState(null,'',location.pathname+location.search); syncSheet(); } }
sheet.querySelector('.sheet-bg').onclick = closeSheet; closeBtn.onclick = closeSheet;
addEventListener('hashchange', syncSheet);
addEventListener('keydown', e => {
  if(sheet.hidden) return;
  if(e.key==='Escape') closeSheet();
  else if(e.key==='ArrowLeft'){
    const prevBtn = sheet.querySelector('[data-sh-prev]');
    if(prevBtn && !prevBtn.disabled){ e.preventDefault(); prevBtn.click(); }
  } else if(e.key==='ArrowRight'){
    const nextBtn = sheet.querySelector('[data-sh-next]');
    if(nextBtn && !nextBtn.disabled){ e.preventDefault(); nextBtn.click(); }
  }
  else if(e.key==='Tab'){
    const f = [...sheet.querySelectorAll('a[href],button')].filter(x => !x.hidden);
    if(!f.length) return;
    const first = f[0], last = f[f.length-1];
    if(!sheet.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
});

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
