import fs from 'node:fs';
import { computeStats } from './stats.mjs';
const USER = process.env.ANILIST_USER || 'TurkTempestian';
const LIST = process.env.CUSTOM_LIST || '';
const PLANNED = process.env.INCLUDE_PLANNED === '1';
const OUT = process.env.OUT || 'data/anime.json';
const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
const LINKS = new Set(['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'SUMMARY']);
const kind = f => SERIES.has(f) ? 'season' : f === 'MOVIE' ? 'movie' : 'other';
const Q = `query($u:String,$c:Int){MediaListCollection(userName:$u,type:ANIME,chunk:$c,perChunk:100){hasNextChunk lists{name isCustomList entries{status progress repeat score(format:POINT_10_DECIMAL) createdAt customLists media{id format status episodes startDate{year month day} genres title{romaji english} coverImage{large} relations{edges{relationType node{id}}}}}}}}`;

const QM = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id format status episodes startDate{year month day} title{romaji english} relations{edges{relationType node{id}}}}}}`;
const sleep = ms => new Promise(s => setTimeout(s, ms));

async function call(query, variables, fixture) {
  if (fixture) return fixture(variables);
  for (let t = 1; ; t++) {
    let r, body = '';
    try {
      r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'tempestian-github-io-sync' }, body: JSON.stringify({ query, variables }) });
      body = await r.text();
    } catch (err) {
      if (t >= 4) throw new Error('AniList bağlantı hatası: ' + err.message);
      await new Promise(s => setTimeout(s, 4000 * t));
      continue;
    }
    if (r.ok) {
      const j = JSON.parse(body);
      if (j.errors) throw new Error('AniList sorgu hatası: ' + JSON.stringify(j.errors));
      if (!j.data) throw new Error('AniList boş yanıt: ' + body.slice(0, 300));
      return j;
    }
    if (t >= 4 || (r.status < 500 && r.status !== 429)) throw new Error('AniList HTTP ' + r.status + ' ' + body.slice(0, 500));
    const ra = Number(r.headers.get('retry-after'));
    await sleep((ra > 0 ? ra : 4 * t) * 1000);
  }
}
const fx = f => f && (v => JSON.parse(fs.readFileSync(f, 'utf8')));
const gql = c => call(Q, { u: USER, c }, fx(process.env.FIXTURE));

const entries = new Map();
for (let c = 1; ; c++) {
  const col = (await gql(c)).data.MediaListCollection;
  if (!col) throw new Error('AniList boş yanıt: kullanıcı adı veya profil gizliliğini kontrol edin.');
  for (const l of col.lists) for (const e of l.entries) {
    let m = entries.get(e.media.id);
    if (!m) entries.set(e.media.id, m = { ...e, custom: false });
    if (LIST && ((l.isCustomList && l.name === LIST) || (e.customLists && e.customLists[LIST]))) m.custom = true;
  }
  if (!col.hasNextChunk || process.env.FIXTURE) break;
  await new Promise(s => setTimeout(s, 1000));
}
for (const [id, m] of entries) if (m.media.format === 'MUSIC') entries.delete(id);
if (!entries.size) throw new Error('AniList listesi boş geldi: kullanıcı adı veya profil gizliliğini kontrol edin.');

const extra = new Map(), seen = new Set(entries.keys());
let frontier = [];
const follow = edges => { for (const ed of edges) if (LINKS.has(ed.relationType) && !seen.has(ed.node.id)) { seen.add(ed.node.id); frontier.push(ed.node.id); } };
for (const m of entries.values()) follow(m.media.relations.edges);
try {
  for (let round = 0; frontier.length && round < 10; round++) {
    const ids = frontier; frontier = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const mock = process.env.FIXTURE_MEDIA && (v => { const f = JSON.parse(fs.readFileSync(process.env.FIXTURE_MEDIA, 'utf8')); return { data: { Page: { media: v.ids.filter(id => f[id]).map(id => ({ id, format: f[id].format, status: f[id].status, episodes: f[id].episodes, startDate: { year: f[id].year }, title: { romaji: f[id].name, english: null }, relations: { edges: f[id].edges || [] } })) } } }; });
      const got = (await call(QM, { ids: chunk }, mock)).data.Page.media || [];
      for (const n of got) { extra.set(n.id, n); follow(n.relations.edges); }
      if (!process.env.FIXTURE_MEDIA) await sleep(800);
    }
  }
} catch (err) { console.warn('Ara düğümler çözülemedi, eldeki bağlantılarla devam: ' + err.message); }

const ov = fs.existsSync('data/overrides.json') ? JSON.parse(fs.readFileSync('data/overrides.json', 'utf8')) : {};
const par = new Map();
const find = x => { if (!par.has(x)) par.set(x, x); while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
const allEdges = [...[...entries].map(([id, m]) => [id, m.media.relations.edges]), ...[...extra].map(([id, n]) => [id, n.relations.edges])];
const chain = new Set();
for (const [id, edges] of allEdges) for (const ed of edges) {
  if (LINKS.has(ed.relationType)) par.set(find(ed.node.id), find(id));
  if (ed.relationType === 'PREQUEL' || ed.relationType === 'SEQUEL') { chain.add(id); chain.add(ed.node.id); }
}
for (const [a, b] of Object.entries(ov.merge || {})) par.set(find(Number(a)), find(Number(b)));
const groups = new Map(), extraBy = new Map();
for (const m of entries.values()) { const r = find(m.media.id); (groups.get(r) || groups.set(r, []).get(r)).push(m); }
for (const n of extra.values()) { const r = find(n.id); (extraBy.get(r) || extraBy.set(r, []).get(r)).push(n); }

const dk = s => (s.year || 9999) * 10000 + (s.month || 0) * 100 + (s.day || 0);
const byDate = (a, b) => dk(a.media.startDate) - dk(b.media.startDate);
const anime = [];
// Durum, AniList'in liste durumuna körü körüne güvenmeden izleme ilerlemesinden de doğrulanır.
const state = m => {
  const ep = m.media.episodes || 0, pr = m.progress || 0, s = m.status === 'REPEATING' ? 'COMPLETED' : m.status;
  if (s === 'COMPLETED' || s === 'DROPPED') return s;
  if (ep && pr >= ep) return 'COMPLETED';               // tüm bölümler izlenmiş
  if (s === 'CURRENT' && pr === 0) return 'PLANNING';   // hiç başlanmamış
  return s;
};

const noCont = ov.noContinue || [];
const hit = (list, id, names) => list.some(x => typeof x === 'number' ? x === id : names.some(n => (n || '').toLowerCase().includes(String(x).toLowerCase())));

for (const [root, members] of groups) {
  members.sort(byDate);
  const exts = (extraBy.get(root) || []).filter(n => n.format !== 'MUSIC');
  if (members.some(m => (ov.exclude || []).includes(m.media.id)) || exts.some(n => (ov.exclude || []).includes(n.id))) continue;
  if (LIST && !members.some(m => m.custom)) continue;
  if (!PLANNED && members.every(m => m.status === 'PLANNING')) continue;
  const own = members.map(m => {
    const ep = m.media.episodes || m.progress || 0, st = state(m);
    return {
      id: m.media.id,
      name: m.media.title.english || m.media.title.romaji,
      kind: kind(m.media.format),
      format: m.media.format || null,
      episodes: ep,
      watched: st === 'COMPLETED' ? ep : st === 'PLANNING' ? 0 : Math.min(m.progress || 0, ep || m.progress || 0),
      status: st,
      release: m.media.status || null,
      year: m.media.startDate.year || null,
      d: dk(m.media.startDate),
      score: m.score > 0 ? m.score : null,
      createdAt: m.createdAt || 0,
      repeat: m.repeat || 0
    };
  });
  const ext = exts.map(n => ({
    id: n.id, name: n.title.english || n.title.romaji, kind: kind(n.format), format: n.format || null,
    episodes: n.episodes || 0, watched: 0, status: 'NONE', release: n.status || null,
    year: (n.startDate || {}).year || null, d: dk(n.startDate || {})
  }));
  const parts = [...own, ...ext].sort((x, y) => x.d - y.d);
  const act = own.filter(p => p.status !== 'PLANNING'), pool = act.length ? act : own;
  const main = pool.some(p => p.kind === 'season') ? pool.filter(p => p.kind === 'season') : pool;
  const st = new Set(main.map(p => p.status));
  const status = st.has('CURRENT') ? 'watching' : st.has('PAUSED') ? 'paused' : st.has('DROPPED') ? 'dropped'
    : st.size === 1 && st.has('COMPLETED') ? 'completed' : st.size === 1 && st.has('PLANNING') ? 'planned' : 'watching';
  const head = pool.find(p => p.kind === 'season') || pool[0];
  const hm = members.find(m => m.media.id === head.id).media;
  const title = (ov.titles || {})[head.id] || hm.title.english || hm.title.romaji;
  const scores = pool.map(p => p.score).filter(Boolean);
  const ts = Math.min(...pool.map(p => p.createdAt || Infinity));
  const seas = parts.filter(p => p.kind === 'season'), fw = seas.findIndex(p => p.watched > 0);
  const next = status === 'completed' && fw >= 0 && !hit(noCont, head.id, [title, ...parts.map(p => p.name)]) && !parts.some(p => hit(noCont, p.id, []))
    && seas.slice(fw + 1).some(p => p.watched === 0 && p.format !== 'TV_SHORT' && chain.has(p.id) && ['FINISHED', 'RELEASING'].includes(p.release));
  const gc = new Map();
  for (const m of members) if (pool.some(p => p.id === m.media.id)) for (const g of m.media.genres || []) gc.set(g, (gc.get(g) || 0) + 1);
  const genres = [...gc].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(x => x[0]);
  anime.push({
    id: 'al-' + head.id,
    title,
    anilistId: head.id,
    url: 'https://anilist.co/anime/' + head.id,
    status,
    ...(next ? { next: true } : {}),
    ...(genres.length ? { genres } : {}),
    score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null,
    parts: parts.map(({ id, name, kind, format, episodes, watched, status, release, year, repeat }) => ({ id, name, kind, format, episodes, watched, status, release, year, ...(repeat > 0 ? { repeat } : {}) })),
    image: hm.coverImage.large,
    addedAt: isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : ''
  });
}
anime.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title));

// Sayılar ve öne çıkanlar AniList'in toplam/özel liste sayılarından değil, çözülen kayıtlardan scripts/stats.mjs ile hesaplanır.
const stats = computeStats(anime);

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (old && JSON.stringify(old.anime) === JSON.stringify(anime) && JSON.stringify(old.stats) === JSON.stringify(stats)) { console.log('Değişiklik yok.'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify({ schemaVersion: 3, updated: new Date().toISOString().slice(0, 10), source: 'anilist:' + USER, stats, anime }, null, 2) + '\n');
console.log(anime.length + ' franchise yazıldı; sayılan: ' + stats.anime + ' anime, ' + stats.season + ' sezon, ' + stats.film + ' film, ' + stats.other + ' ek, ' + stats.episodes + ' bölüm.');
