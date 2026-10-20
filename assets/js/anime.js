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

const go = () => document.startViewTransition ? document.startViewTransition(render) : render();
const byAdded = (a,b) => (b.addedAt||'').localeCompare(a.addedAt||'');
function render(){
  const s = state, q = s.q.toLowerCase();
  const l = s.items.filter(i => (s.filter==='all' || (s.filter==='next' ? i.next : i.status===s.filter)) && i.title.toLowerCase().includes(q));
  l.sort((a,b) => s.sort==='score' ? (b.score||0)-(a.score||0)
    : s.sort==='title' ? a.title.localeCompare(b.title,'tr')
    : byAdded(a,b));
  const root = $('#list'); root.className = s.view; root.innerHTML = '';
  l.forEach((it, n) => {
    const ps = UI.parts(it).filter(own), ep = sum(ps,'episodes'), w = sum(ps,'watched');
    const cnt = k => ps.filter(p => p.kind===k).length, sn = cnt('season'), fl = cnt('movie'), ot = cnt('other');
    const li = document.createElement('li');
    li.innerHTML = '<div class="poster"><img alt="" loading="lazy"></div><div class="t"><h3><a target="_blank" rel="noopener"></a></h3><p class="meta"></p><p class="st"></p></div>';
    const a = li.querySelector('a'); a.textContent = it.title;
    a.href = '#'+it.id; a.onclick = e => { if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); openSheet(it.id, true); };
    li.querySelector('.meta').textContent = [sn && sn+' sezon', fl && fl+' film', ot && ot+' ek', rew(ps), !ep ? w+' bölüm' : w===ep ? ep+' bölüm' : w+'/'+ep+' bölüm'].filter(Boolean).join(', ');
    const st = li.querySelector('.st');
    if(it.status !== 'completed'){ st.textContent = ST[it.status]||it.status; st.classList.add('st-'+it.status); }
    else if(it.next){ st.textContent = NEXT; st.classList.add('st-next'); } else st.remove();
    if(it.score){
      const sc = document.createElement('span'); sc.className = 'score glass';
      sc.setAttribute('role', 'img'); sc.setAttribute('aria-label', 'Puan '+it.score+'/10'); sc.innerHTML = UI.icon('star'); sc.append(String(it.score));
      s.view === 'grid' ? li.querySelector('.poster').after(sc) : li.append(sc);
    }
    if(n < 60) li.style.viewTransitionName = 'a-'+it.id;
    const im = li.querySelector('img'); im.onload = () => im.classList.add('in');
    if(it.image) im.src = it.image;
    root.appendChild(li);
  });
  $('#empty').hidden = l.length > 0;
  $('#empty').textContent = 'Eşleşen anime yok.';
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view===s.view));
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filter===s.filter));
}

fetch('../data/anime.json').then(r => r.json()).then(d => {
  state.items = d.anime;
  UI.wall([...d.anime].sort(byAdded).slice(0,3).map(i => i.image));
  const t = UI.tally(d.anime), sc = d.anime.filter(i => UI.tally([i]).anime).map(i => i.score).filter(Boolean);
  const stats = $('#stats');
  for(const [v,l,tip] of [[t.anime,'anime','Sezonlar, filmler ve ek içerikler ayrı sayılmaz; en az bir parçası tamamlanmış olanlar sayılır (izleniyor, beklemede, bırakıldı ve planlananlar dahil değil)'],[t.season,'sezon'],[t.film,'film'],[t.ep,'bölüm','Yalnızca tamamlanan parçaların bölümleri; film ve ek içerik dahil, yeniden izlemeler hariç'],[sc.length ? (sc.reduce((a,b)=>a+b,0)/sc.length).toFixed(1) : '-','ort. puan']]){
    const t = document.createElement('div'); t.className = 'stat'; t.innerHTML = '<b></b><span></span>';
    t.firstChild.textContent = v; t.lastChild.textContent = l; if(tip) t.title = tip; stats.append(t);
  }
  stats.hidden = false;
  const chips = $('#chips');
  for(const [k,label] of [['all','Hepsi'], ['next',NEXT], ...Object.entries(ST)]){
    if(k==='next' ? !d.anime.some(i => i.next) : k!=='all' && !d.anime.some(i => i.status===k)) continue;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.filter = k; b.textContent = label;
    b.onclick = () => { state.filter = k; go(); }; chips.appendChild(b);
  }
  render(); syncSheet();
}).catch(() => { const e = $('#empty'); e.textContent = 'Liste yüklenemedi.'; e.hidden = false; });

$('#q').oninput = e => { state.q = e.target.value; go(); };
$('#sort').onchange = e => { state.sort = e.target.value; go(); };
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; ls('view', state.view); go(); });

const sheet = document.createElement('div');
sheet.className = 'sheet'; sheet.hidden = true; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-labelledby','sh-title');
sheet.innerHTML = '<div class="sheet-bg"></div><div class="sheet-card glass sq"><div class="sheet-head"><img class="sheet-cover" alt=""><div class="sheet-t"><h2 id="sh-title"></h2><p class="sh-sub"></p></div><button class="btn glass" type="button" aria-label="Kapat" data-close></button></div><ol class="parts"></ol><a class="sh-al" target="_blank" rel="noopener"></a></div>';
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
  const im = t('.sheet-cover'); im.hidden = !it.image; if(it.image) im.src = it.image;
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
