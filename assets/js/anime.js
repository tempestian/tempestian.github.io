const $ = s => document.querySelector(s);
const ST = {completed:'İzlendi', watching:'İzleniyor', paused:'Beklemede', dropped:'Bırakıldı', planned:'Planlandı'};
const NEXT = 'Devam edilecek';
const FMT = {TV:'TV', TV_SHORT:'Kısa', MOVIE:'Film', OVA:'OVA', SPECIAL:'Özel', ONA:'ONA'};
const own = p => p.status !== 'PLANNING' && p.status !== 'NONE';
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
const rew = ps => { const n = sum(ps,'repeat'); return n ? '↻ '+n+'× tekrar' : ''; };
function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){} }
const state = {items:[], view:ls('view')==='list' ? 'list' : 'grid', filter:'all', sort:'added', q:''};

const byAdded = (a,b) => (b.addedAt||'').localeCompare(a.addedAt||'');
const nodes = new Map();   // id -> meta
let order = '', raf = 0;
const big = u => u && u.replace('/cover/medium/','/cover/large/');
const dec = y => !y ? 'old' : y>=2020 ? '2020' : y>=2010 ? '2010' : y>=2000 ? '2000' : 'old';
const DEC = {2020:"2020'ler",2010:"2010'lar",2000:"2000'ler",old:'Daha eski'};
const DORD = ['2020','2010','2000','old'];
const GEN = {Action:'Aksiyon',Adventure:'Macera',Comedy:'Komedi',Drama:'Drama',Ecchi:'Ecchi',Fantasy:'Fantastik',Horror:'Korku','Mahou Shoujo':'Büyülü Kız',Mecha:'Mecha',Music:'Müzik',Mystery:'Gizem',Psychological:'Psikolojik',Romance:'Romantik','Sci-Fi':'Bilim Kurgu','Slice of Life':'Günlük Yaşam',Sports:'Spor',Supernatural:'Doğaüstü',Thriller:'Gerilim'};
const gl = g => GEN[g] || g;
const SCO = [['9','9 ve üstü'],['8','8–9'],['7','7–8'],['low','7 altı'],['none','Puansız']];
const KIND = [['multi','2+ sezon'],['movie','Filmli'],['rewatch','Tekrar izlenen']];
const COL = {completed:'var(--accent)',watching:'#3ccf91',paused:'var(--warn)',dropped:'var(--bad)',planned:'var(--ink2)'};
const scOk = (v,x) => v==='all' || (v==='none' ? !x : v==='low' ? x>0 && x<7 : v[0]==='b' ? Math.min(10,Math.floor(x))===+v.slice(1) : x>=+v && (+v===9 || x<+v+1));
const kOk = (v,m) => v==='all' || (v==='multi' ? m.sn>1 : v==='movie' ? m.fl>0 : m.rp>0);
const h = (t,c,x) => { const e = document.createElement(t); if(c) e.className = c; if(x!=null) e.textContent = x; return e; };
Object.assign(state, {sc:'all', dc:'all', kd:'all', gn:'all'});
const SORTS = {
  added: byAdded,
  score: (a,b) => (b.score||0)-(a.score||0) || byAdded(a,b),
  title: (a,b) => a.title.localeCompare(b.title,'tr'),
  year: (a,b) => (nodes.get(b.id).y||0)-(nodes.get(a.id).y||0),
  eps: (a,b) => nodes.get(b.id).ep-nodes.get(a.id).ep
};

// DOM bir kez kurulur; filtre/arama yalnızca hidden, sıralama yalnızca yeniden dizme yapar.
function build(it){
  const ps = UI.parts(it).filter(own), ep = sum(ps,'episodes'), w = sum(ps,'watched');
  const cnt = k => ps.filter(p => p.kind===k).length, sn = cnt('season'), fl = cnt('movie'), ot = cnt('other');
  const ys = ps.map(p => p.year).filter(Boolean), y = ys.length ? Math.min(...ys) : 0;
  const li = h('li');
  li.innerHTML = '<div class="poster"><img alt="" loading="lazy" decoding="async" width="142" height="213"></div><div class="t"><h3><a target="_blank" rel="noopener"></a></h3><p class="meta"></p><p class="st"></p></div>';
  const a = li.querySelector('a'); a.textContent = it.title;
  a.href = '#'+it.id; a.onclick = e => { if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); openSheet(it.id, true); };
  li.querySelector('.meta').textContent = [sn && sn+' sezon', fl && fl+' film', ot && ot+' ek', rew(ps), !ep ? w+' bölüm' : w===ep ? ep+' bölüm' : w+'/'+ep+' bölüm'].filter(Boolean).join(', ');
  const st = li.querySelector('.st'), po = li.querySelector('.poster');
  const lab = it.status !== 'completed' ? (ST[it.status]||it.status) : it.next ? NEXT : '';
  if(lab){ st.textContent = lab; st.classList.add('st-'+(it.status !== 'completed' ? it.status : 'next')); const sb = h('span','sb st-'+(it.status !== 'completed' ? it.status : 'next'), lab); po.append(sb); } else st.remove();
  if(it.status !== 'completed' && ep && w < ep){ const pg = h('div','pg'); pg.innerHTML = '<i></i>'; pg.firstChild.style.setProperty('--w', Math.round(w/ep*100)+'%'); po.append(pg); }
  if(it.score){
    const sc = h('span','score glass');
    sc.setAttribute('role','img'); sc.setAttribute('aria-label','Puan '+it.score+'/10'); sc.innerHTML = UI.icon('star'); sc.append(String(it.score));
    li.append(sc);
  }
  const im = li.querySelector('img'); im.onload = () => im.classList.add('in');
  if(it.image) im.src = big(it.image);
  const m = {li, it, key:it.title.toLocaleLowerCase('tr'), y, d:dec(y), sn, fl, rp:sum(ps,'repeat'), ep:w, g:it.genres||[]};
  nodes.set(it.id, m); return li;
}
const active = () => ['sc','dc','kd','gn'].filter(k => state[k]!=='all').length;
function render(){
  const s = state, q = s.q.trim().toLocaleLowerCase('tr'), root = $('#list');
  root.className = s.view;
  if(order !== s.sort){
    order = s.sort;
    const fr = document.createDocumentFragment();
    [...s.items].sort(SORTS[s.sort]||byAdded).forEach(it => fr.append(nodes.get(it.id).li));
    root.append(fr);
  }
  let shown = 0, first = null, last = null;
  for(const it of s.items){
    const n = nodes.get(it.id);
    const ok = (s.filter==='all' || (s.filter==='next' ? it.next : it.status===s.filter)) && n.key.includes(q)
      && scOk(s.sc, it.score||0) && (s.gn==='all' || n.g.includes(s.gn)) && (s.dc==='all' || n.d===s.dc) && kOk(s.kd, n);
    n.li.hidden = !ok; n.li.classList.remove('f','l');
  }
  for(const li of root.children){ if(li.hidden) continue; shown++; if(!first) first = li; last = li; }
  if(first){ first.classList.add('f'); last.classList.add('l'); }
  $('#empty').hidden = shown > 0;
  $('#empty').textContent = 'Eşleşen anime yok.';
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
  const fp = $('#fpIn'), box = h('div');
  const grp = (title, k, opts, counts) => {
    const g = h('div','fg'), row = h('div','chips'); g.append(h('span',null,title), row);
    chip(row,'Hepsi',null,{g:k,v:'all'},() => setF(k,'all'));
    for(const [v,l] of opts){ const c = counts[v]; if(c===0) continue; chip(row,l,c,{g:k,v},() => setF(k,v)); }
    box.append(g);
  };
  const ms = [...nodes.values()], gcount = {};
  for(const m of ms) for(const g of m.g) gcount[g] = (gcount[g]||0)+1;
  grp('Puan','sc',SCO,Object.fromEntries(SCO.map(([v]) => [v, ms.filter(m => scOk(v,m.it.score||0)).length])));
  grp('Yıl','dc',DORD.map(k => [k,DEC[k]]),Object.fromEntries(DORD.map(v => [v, ms.filter(m => m.d===v).length])));
  const gs = Object.keys(gcount).sort((a,b) => gcount[b]-gcount[a] || gl(a).localeCompare(gl(b),'tr'));
  if(gs.length) grp('Tür','gn',gs.map(g => [g,gl(g)]),gcount);
  grp('İçerik','kd',KIND,Object.fromEntries(KIND.map(([v]) => [v, ms.filter(m => kOk(v,m)).length])));
  const rs = h('button','more','Filtreleri sıfırla'); rs.type = 'button';
  rs.onclick = () => { Object.assign(state,{sc:'all',dc:'all',kd:'all',gn:'all',filter:'all',q:''}); $('#q').value = ''; go(); };
  box.append(rs); fp.append(box);
  $('#fbtn').onclick = () => { const o = $('#fp').classList.toggle('open'); $('#fbtn').setAttribute('aria-expanded', o); };
}
function stats(d){
  const box = $('#stats'), cn = d.anime.filter(i => UI.tally([i]).anime), t = UI.tally(d.anime), scs = cn.map(i => i.score).filter(Boolean);
  const row = h('div','stats-row');
  for(const [v,l,tip] of [[t.anime,'anime','Sezonlar, filmler ve ek içerikler ayrı sayılmaz; en az bir parçası tamamlanmış olanlar sayılır (izleniyor, beklemede, bırakıldı ve planlananlar dahil değil)'],[t.season,'sezon'],[t.film,'film'],[t.ep,'bölüm','Yalnızca tamamlanan parçaların bölümleri; film ve ek içerik dahil, yeniden izlemeler hariç'],[scs.length ? (scs.reduce((a,b)=>a+b,0)/scs.length).toFixed(1) : '-','ort. puan']]){
    const e = h('div','stat'); e.innerHTML = '<b></b><span></span>'; e.firstChild.textContent = v; e.lastChild.textContent = l; if(tip) e.title = tip; row.append(e);
  }
  const more = h('button','more','Ayrıntılar'); more.type = 'button'; more.setAttribute('aria-expanded','false'); more.insertAdjacentHTML('beforeend', UI.icon('down'));
  const ins = h('div','ins'), inn = h('div','ins-in'); ins.append(inn);
  const blk = (title, ...kids) => { const b = h('div','blk'); b.append(h('h4',null,title), ...kids); inn.append(b); };
  const bars = (arr, fn) => { const w = h('div','hbs'), mx = Math.max(1,...arr.map(a => a[1]));
    for(const [l,n,k,v] of arr){ const b = h('button','hb'); b.type = 'button'; b.setAttribute('aria-label', l+': '+n); b.innerHTML = '<b></b><i></i><span></span>'; b.children[0].textContent = n || ''; b.children[1].style.setProperty('--h', (n/mx*100)+'%'); b.children[2].textContent = l; b.onclick = () => { setF(k,v); jump(); }; w.append(b); } return w; };
  const hist = Array.from({length:10},(_,i) => [String(i+1), 0, 'sc', 'b'+(i+1)]);
  for(const x of scs) hist[Math.min(10,Math.max(1,Math.floor(x)))-1][1]++;
  blk('Puan dağılımı', bars(hist.slice(Math.min(...hist.map((x,i) => x[1] ? i : 9))))); 
  const dcs = [...DORD].reverse().map(k => [DEC[k].replace("'ler",'').replace("'lar",''), cn.filter(i => nodes.get(i.id).d===k).length, 'dc', k]);
  blk('Çıkış yılına göre', bars(dcs));
  const sg = h('div','seg'), lg = h('div','leg');
  for(const k of Object.keys(ST)){ const n = d.anime.filter(i => i.status===k).length; if(!n) continue;
    const b = h('button'); b.type = 'button'; b.title = ST[k]+': '+n; b.style.cssText = '--n:'+n+';--c:'+COL[k]; b.onclick = () => { setF('filter',k); jump(); }; sg.append(b);
    const l = h('span'); l.innerHTML = '<i></i>'; l.firstChild.style.setProperty('--c',COL[k]); l.append(ST[k]+' '+n); lg.append(l); }
  blk('Durum', sg, lg);
  const ms = cn.map(i => nodes.get(i.id)), top = (f) => [...ms].sort((a,b) => f(b)-f(a))[0];
  const hl = h('div','hl'), add = (l,m,v) => { if(!m || !v) return; const r = h('div'); r.append(h('span',null,l), h('b',null,m.it.title+' · '+v)); hl.append(r); };
  const tp = top(m => m.it.score||0), lg2 = top(m => m.ep), rw = top(m => m.rp);
  add('En yüksek puan', tp, tp && tp.it.score); add('En uzun', lg2, lg2 && lg2.ep+' bölüm'); add('En çok tekrar', rw, rw && rw.rp+'× tekrar');
  if(hl.children.length) blk('Öne çıkanlar', hl);
  const gc = {}; for(const m of nodes.values()) for(const g of m.g) gc[g] = (gc[g]||0)+1;
  const tg = Object.keys(gc).sort((a,b) => gc[b]-gc[a]).slice(0,8);
  if(tg.length){ const row = h('div','chips'); for(const g of tg) chip(row, gl(g), gc[g], {g:'gn',v:g}, () => { setF('gn',g); jump(); }); blk('Türler', row); }
  more.onclick = () => { const o = box.classList.toggle('open'); more.setAttribute('aria-expanded', o); };
  box.append(row, ins, more); box.hidden = false;
}

fetch('../data/anime.json').then(r => r.json()).then(d => {
  state.items = d.anime;
  const root = $('#list'), fr = document.createDocumentFragment();
  d.anime.forEach(it => fr.append(build(it)));
  root.append(fr);
  UI.wall([...d.anime].sort(byAdded).slice(0,3).map(i => i.image));
  stats(d); filters(d);
  const chips = $('#chips');
  for(const [k,label] of [['all','Hepsi'], ['next',NEXT], ...Object.entries(ST)]){
    const n = k==='all' ? d.anime.length : k==='next' ? d.anime.filter(i => i.next).length : d.anime.filter(i => i.status===k).length;
    if(!n) continue;
    chip(chips,label,n,{filter:k},() => setF('filter',k));
  }
  render(); syncSheet();
}).catch(() => { const e = $('#empty'); e.textContent = 'Liste yüklenemedi.'; e.hidden = false; });

$('#q').oninput = e => { state.q = e.target.value; go(); };
$('#sort').onchange = e => { state.sort = e.target.value; go(); };
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; ls('view', state.view); go(); });

const sheet = document.createElement('div');
sheet.className = 'sheet'; sheet.hidden = true; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-labelledby','sh-title');
sheet.innerHTML = '<div class="sheet-bg"></div><div class="sheet-card glass sq"><div class="sheet-head"><img class="sheet-cover" alt=""><div class="sheet-t"><h2 id="sh-title"></h2><p class="sh-sub"></p></div><button class="btn glass" type="button" aria-label="Kapat" data-close></button></div><div class="sh-pg" hidden><i></i></div><ol class="parts"></ol><a class="sh-al" target="_blank" rel="noopener"></a></div>';
document.body.append(sheet);
const closeBtn = sheet.querySelector('[data-close]'); closeBtn.innerHTML = UI.icon('close');
let opener = null, pushed = false;

function fillSheet(it){
  const ps = UI.parts(it), t = sheet.querySelector.bind(sheet);
  t('#sh-title').textContent = it.title;
  const bits = [it.status==='completed' && it.next ? NEXT : (ST[it.status]||it.status)];
  if(it.score) bits.push('★ '+it.score);
  const cnt = k => ps.filter(p => p.kind===k && own(p)).length;
  const c = [cnt('season') && cnt('season')+' sezon', cnt('movie') && cnt('movie')+' film', cnt('other') && cnt('other')+' ek'].filter(Boolean).join(', ');
  if(c) bits.push(c);
  const rp = rew(ps.filter(own)); if(rp) bits.push(rp);
  t('.sh-sub').textContent = bits.join(' · ');
  const im = t('.sheet-cover'); im.hidden = !it.image; if(it.image) im.src = big(it.image);
  const own2 = ps.filter(own), te = sum(own2,'episodes'), tw = sum(own2,'watched'), pg = t('.sh-pg');
  pg.hidden = !(te && tw < te); if(!pg.hidden) pg.firstChild.style.setProperty('--w', Math.round(tw/te*100)+'%');
  const ol = t('.parts'); ol.replaceChildren();
  for(const p of ps){
    const [txt, cls] = partState(p), li = document.createElement('li');
    li.className = 'part '+cls;
    li.innerHTML = '<span class="pd" aria-hidden="true"></span><div class="pt"><a target="_blank" rel="noopener"></a><span class="pm"></span></div><span class="ps"></span>';
    const a = li.querySelector('a'); a.textContent = p.name; a.href = 'https://anilist.co/anime/'+p.id;
    li.querySelector('.pm').textContent = [FMT[p.format]||(p.kind==='movie'?'Film':''), p.year, p.kind!=='movie' && p.episodes>1 ? p.episodes+' bölüm' : ''].filter(Boolean).join(' · ');
    li.querySelector('.ps').textContent = txt + (p.repeat ? (cls==='done' ? ' · '+(p.repeat+1)+' kez' : ' · ↻ '+p.repeat+' tekrar') : '');
    ol.append(li);
  }
  const al = t('.sh-al'); al.href = it.url || 'https://anilist.co/anime/'+it.anilistId; al.textContent = "AniList'te aç";
  t('.sheet-card').scrollTop = 0;
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
  else if(e.key==='Tab'){
    const f = [...sheet.querySelectorAll('a[href],button')].filter(x => !x.hidden);
    if(!f.length) return;
    const first = f[0], last = f[f.length-1];
    if(!sheet.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
});
