const $ = s => document.querySelector(s);
const ST = {completed:'İzlendi', watching:'İzleniyor', paused:'Beklemede', dropped:'Bırakıldı', planned:'Planlandı'};
const wait = ms => new Promise(r => setTimeout(r, ms));
const sum = (a,k) => a.reduce((n,x) => n+(x[k]||0), 0);
function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){} }
const state = {items:[], view:ls('view')==='list' ? 'list' : 'grid', filter:'all', sort:'added', q:''};

const queue = [], memo = new Map(); let busy = false;
function getCover(it){
  if(it.image) return Promise.resolve(it.image);
  if(!it.malId) return Promise.resolve(null);
  if(memo.has(it.malId)) return memo.get(it.malId);
  const k = 'img:'+it.malId; let c = null;
  try{ c = JSON.parse(ls(k)||'null'); }catch(e){}
  const p = c && Date.now()-c.t < 2592e6 ? Promise.resolve(c.u) : new Promise(res => { queue.push({it, k, res}); pump(); });
  memo.set(it.malId, p); return p;
}
async function pump(){
  if(busy) return; busy = true;
  while(queue.length){
    const job = queue.shift();
    try{
      const r = await fetch('https://api.jikan.moe/v4/anime/'+job.it.malId);
      if(r.status === 429){ queue.unshift(job); await wait(1500); continue; }
      const u = (await r.json()).data.images.jpg.image_url;
      ls(job.k, JSON.stringify({u, t:Date.now()}));
      job.res(u);
    }catch(e){ job.res(null); }
    await wait(450);
  }
  busy = false;
}

const go = () => document.startViewTransition ? document.startViewTransition(render) : render();
const byAdded = (a,b) => (b.addedAt||'').localeCompare(a.addedAt||'');
function render(){
  const s = state, q = s.q.toLowerCase();
  const l = s.items.filter(i => (s.filter==='all' || i.status===s.filter) && i.title.toLowerCase().includes(q));
  l.sort((a,b) => s.sort==='score' ? (b.score||0)-(a.score||0)
    : s.sort==='title' ? a.title.localeCompare(b.title,'tr')
    : byAdded(a,b));
  const root = $('#list'); root.className = s.view; root.innerHTML = '';
  l.forEach((it, n) => {
    const sn = it.seasons.length, ep = sum(it.seasons,'episodes'), w = sum(it.seasons,'watched');
    const li = document.createElement('li');
    li.innerHTML = '<div class="poster"><img alt="" loading="lazy"></div><div class="t"><h3><a target="_blank" rel="noopener"></a></h3><p class="meta"></p><p class="st"></p></div>';
    const a = li.querySelector('a'); a.textContent = it.title;
    if(it.url) a.href = it.url; else if(it.malId) a.href = 'https://myanimelist.net/anime/'+it.malId;
    li.querySelector('.meta').textContent = sn+' sezon, '+(!ep ? w+' bölüm' : w===ep ? ep+' bölüm' : w+'/'+ep+' bölüm');
    const st = li.querySelector('.st');
    if(it.status !== 'completed'){ st.textContent = ST[it.status]||it.status; st.classList.add('st-'+it.status); } else st.remove();
    if(it.score){
      const sc = document.createElement('span'); sc.className = 'score glass';
      sc.setAttribute('aria-label', 'Puan '+it.score+'/10'); sc.innerHTML = UI.icon('star'); sc.append(String(it.score));
      s.view === 'grid' ? li.querySelector('.poster').after(sc) : li.append(sc);
    }
    if(n < 60) li.style.viewTransitionName = 'a-'+it.id;
    const im = li.querySelector('img'); im.onload = () => im.classList.add('in');
    getCover(it).then(u => { if(u) im.src = u; });
    root.appendChild(li);
  });
  $('#empty').hidden = l.length > 0;
  $('#empty').textContent = 'Eşleşen anime yok.';
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view===s.view));
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filter===s.filter));
}

fetch('../data/anime.json').then(r => r.json()).then(d => {
  state.items = d.anime;
  Promise.all([...d.anime].sort(byAdded).slice(0,3).map(getCover)).then(us => UI.wall(us));
  const seasons = d.anime.reduce((n,i) => n+i.seasons.length, 0);
  const eps = d.anime.reduce((n,i) => n+sum(i.seasons,'watched'), 0), sc = d.anime.map(i => i.score).filter(Boolean);
  const stats = $('#stats');
  for(const [v,l,tip] of [[d.anime.length,'anime','Sezonlar ayrı sayılmaz'],[seasons,'sezon'],[eps,'bölüm'],[sc.length ? (sc.reduce((a,b)=>a+b,0)/sc.length).toFixed(1) : '-','ort. puan']]){
    const t = document.createElement('div'); t.className = 'stat'; t.innerHTML = '<b></b><span></span>';
    t.firstChild.textContent = v; t.lastChild.textContent = l; if(tip) t.title = tip; stats.append(t);
  }
  stats.hidden = false;
  const chips = $('#chips');
  for(const [k,label] of [['all','Hepsi'], ...Object.entries(ST)]){
    if(k!=='all' && !d.anime.some(i => i.status===k)) continue;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.filter = k; b.textContent = label;
    b.onclick = () => { state.filter = k; go(); }; chips.appendChild(b);
  }
  render();
}).catch(() => { const e = $('#empty'); e.textContent = 'Liste yüklenemedi.'; e.hidden = false; });

$('#q').oninput = e => { state.q = e.target.value; go(); };
$('#sort').onchange = e => { state.sort = e.target.value; go(); };
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; ls('view', state.view); go(); });
