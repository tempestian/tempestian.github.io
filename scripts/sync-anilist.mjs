import fs from 'node:fs';
const USER = process.env.ANILIST_USER || 'TurkTempestian';
const LIST = process.env.CUSTOM_LIST || 'Total Anime Sayısı';
const OUT = process.env.OUT || 'data/anime.json';
const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
const Q = `query($u:String,$c:Int){MediaListCollection(userName:$u,type:ANIME,chunk:$c,perChunk:100){hasNextChunk lists{name isCustomList entries{status progress score(format:POINT_10_DECIMAL) createdAt customLists media{id format episodes startDate{year month day} title{romaji english} coverImage{large} relations{edges{relationType node{id}}}}}}}}`;

async function gql(c) {
  if (process.env.FIXTURE) return JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8'));
  for (let t = 1; ; t++) {
    let r, body = '';
    try {
      r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'tempestian-github-io-sync' }, body: JSON.stringify({ query: Q, variables: { u: USER, c } }) });
      body = await r.text();
    } catch (err) {
      if (t >= 4) throw new Error('AniList bağlantı hatası: ' + err.message);
      await new Promise(s => setTimeout(s, 4000 * t));
      continue;
    }
    if (r.ok) {
      const j = JSON.parse(body);
      if (j.errors) throw new Error('AniList sorgu hatası: ' + JSON.stringify(j.errors));
      if (!j.data || !j.data.MediaListCollection) throw new Error('AniList boş yanıt: ' + body.slice(0, 300));
      return j;
    }
    if (t >= 4 || (r.status < 500 && r.status !== 429)) throw new Error('AniList HTTP ' + r.status + ' ' + body.slice(0, 500));
    const ra = Number(r.headers.get('retry-after'));
    await new Promise(s => setTimeout(s, (ra > 0 ? ra : 4 * t) * 1000));
  }
}

const entries = new Map();
for (let c = 1; ; c++) {
  const col = (await gql(c)).data.MediaListCollection;
  for (const l of col.lists) for (const e of l.entries) {
    let m = entries.get(e.media.id);
    if (!m) entries.set(e.media.id, m = { ...e, custom: false });
    if ((l.isCustomList && l.name === LIST) || (e.customLists && e.customLists[LIST])) m.custom = true;
  }
  if (!col.hasNextChunk || process.env.FIXTURE) break;
  await new Promise(s => setTimeout(s, 1000));
}
if (!entries.size) throw new Error('AniList listesi boş geldi: kullanıcı adı veya profil gizliliğini kontrol edin.');

const par = new Map([...entries.keys()].map(k => [k, k]));
const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
for (const m of entries.values()) for (const ed of m.media.relations.edges)
  if (['PREQUEL', 'SEQUEL'].includes(ed.relationType) && entries.has(ed.node.id)) par.set(find(ed.node.id), find(m.media.id));
const groups = new Map();
for (const m of entries.values()) { const r = find(m.media.id); (groups.get(r) || groups.set(r, []).get(r)).push(m); }

const dk = s => (s.year || 9999) * 10000 + (s.month || 0) * 100 + (s.day || 0);
const byDate = (a, b) => dk(a.media.startDate) - dk(b.media.startDate);
const ov = fs.existsSync('data/overrides.json') ? JSON.parse(fs.readFileSync('data/overrides.json', 'utf8')) : {};
const useCustom = [...entries.values()].some(m => m.custom);
const anime = [];

for (const members of groups.values()) {
  members.sort(byDate);
  if (members.some(m => (ov.exclude || []).includes(m.media.id))) continue;
  const series = members.filter(m => SERIES.has(m.media.format));
  let counted;
  if (useCustom) {
    if (!members.some(m => m.custom)) continue;
    counted = series.length ? series : [members.find(m => m.custom)];
  } else {
    counted = series.length ? series : members[0].media.format === 'MOVIE' ? [members[0]] : [];
  }
  if (!counted.length) continue;
  const st = new Set(counted.map(m => m.status === 'REPEATING' ? 'CURRENT' : m.status));
  const status = st.has('CURRENT') ? 'watching' : st.has('PAUSED') ? 'paused' : st.has('DROPPED') ? 'dropped'
    : st.size === 1 && st.has('COMPLETED') ? 'completed' : st.size === 1 && st.has('PLANNING') ? 'planned' : 'watching';
  const scores = counted.map(m => m.score).filter(s => s > 0);
  const first = counted[0].media, ts = Math.min(...counted.map(m => m.createdAt || Infinity));
  anime.push({
    id: 'al-' + first.id,
    title: (ov.titles || {})[first.id] || first.title.english || first.title.romaji,
    anilistId: first.id,
    url: 'https://anilist.co/anime/' + first.id,
    status,
    score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null,
    seasons: counted.map(m => {
      const ep = m.media.episodes || m.progress || 0;
      return { name: m.media.title.english || m.media.title.romaji, episodes: ep, watched: m.status === 'COMPLETED' ? ep : Math.min(m.progress || 0, ep || m.progress || 0) };
    }),
    image: first.coverImage.large,
    addedAt: isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : ''
  });
}
anime.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title));

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (old && JSON.stringify(old.anime) === JSON.stringify(anime)) { console.log('Değişiklik yok.'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify({ schemaVersion: 2, updated: new Date().toISOString().slice(0, 10), source: 'anilist:' + USER, anime }, null, 2) + '\n');
console.log(anime.length + ' anime yazıldı.');
