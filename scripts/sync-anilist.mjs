// ============================================================================
// [AI-MIMARI-NOTU: ANILIST PROFİLİNDEN BAĞIMSIZ, SIFIR-DEPOLAMA KAPAK VE BAĞLANTILI ANİME MOTORU (ADIM 10 & 11)]
//
// KULLANICI HEDEFİ (ADIM 10):
// 1. AniList Profil Listesinden Tamamen Kopuş (`SYNC_MODE = 'relations_only'` varsayılan):
//    - Kullanıcı artık AniList hesabına (`MediaListCollection`) yeni girdi eklememektedir.
//    - Tüm yeni anime ekleme, puanlama, kategori seçimi, favori/başyapıt işaretleme ve bölüm
//      takibi doğrudan `tempestian.github.io/admin/` panelinden yapılır.
// 2. Sıfır-Depolama Uzaktan Kapak & Yan İçerik Çekimi:
//    - GitHub Pages depolama sınırını doldurmamak için kapak görselleri repoya İNDİRİLMEZ;
//      AniList'in resmi CDN bağlantıları (`coverImage.large`) doğrudan URL olarak kullanılır.
//    - Bu betik çalıştığında yalnızca `data/anime.json` içindeki animelerin `firstSeasonUrl`
//      (ilk sezon AniList linki) değerlerini tohum (`seed`) olarak alır ve AniList GraphQL
//      API'sinden eksik kapak görseli URL'lerini, bölüm sayılarını ve yeni çıkan sezon, film
//      ve yan içerikleri (`PREQUEL`, `SEQUEL`, `SIDE_STORY`, `PARENT`, `SUMMARY`, `SPIN_OFF`)
//      sorgulayıp ilgili animenin `parts` dizisine ekler.
// 3. Yerel Verilerin %100 Korunması (Adım 7, 8 & 11):
//    - Sitede düzenlenen başlık, ağırlıklı parça puanları (`parts[].score`, `score`),
//      özel kategoriler (`customGenres`), izleme durumu (`status`, `watched`, `repeat`) ve
//      Favori/Başyapıt işareti (`favorite: true`) her zaman korunur.
// ============================================================================
import fs from 'node:fs';
import { computeStats, resolveEffectiveScore, DEFAULT_STATS_CONFIG } from './stats.mjs';
import { generateShareCards } from './generate-share-cards.mjs';

const USER = process.env.ANILIST_USER || 'TurkTempestian';
const LIST = process.env.CUSTOM_LIST || '';
const PLANNED = process.env.INCLUDE_PLANNED === '1';
const OUT = process.env.OUT || 'data/anime.json';
const OVERRIDES_FILE = process.env.OVERRIDES || 'data/overrides.json';
// Adım 10: Varsayılan mod artık 'relations_only' (AniList profil listesine bağımlı olmadan yalnızca sitedeki animelerin kapak ve yan içeriklerini günceller)
const SYNC_MODE = (process.env.SYNC_MODE || 'relations_only').toLowerCase(); // 'relations_only' | 'hybrid'

const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
const LINKS = new Set(['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'SUMMARY', 'SPIN_OFF']);
const kind = f => SERIES.has(f) ? 'season' : f === 'MOVIE' ? 'movie' : 'other';

export function parseAnilistId(input) {
  if (input == null || input === '') return null;
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input;
  const s = String(input).trim();
  const urlMatch = s.match(/anilist\.co\/anime\/(\d+)/i);
  if (urlMatch) return Number(urlMatch[1]);
  const alPrefixMatch = s.match(/^al-(\d+)$/i);
  if (alPrefixMatch) return Number(alPrefixMatch[1]);
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

export function extractSeedAnilistId(item) {
  if (!item || typeof item !== 'object') return null;
  return (
    parseAnilistId(item.firstSeasonUrl) ||
    parseAnilistId(item.url) ||
    parseAnilistId(item.anilistId) ||
    parseAnilistId(item.id)
  );
}

const Q = `query($u:String,$c:Int){MediaListCollection(userName:$u,type:ANIME,chunk:$c,perChunk:100){hasNextChunk lists{name isCustomList entries{status progress repeat score(format:POINT_10_DECIMAL) createdAt customLists media{id format status episodes startDate{year month day} genres title{romaji english} coverImage{large} relations{edges{relationType node{id}}}}}}}}`;

const QM = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id format status episodes startDate{year month day} genres title{romaji english} coverImage{large} relations{edges{relationType node{id}}}}}}`;

const sleep = ms => new Promise(s => setTimeout(s, ms));

async function call(query, variables, fixture) {
  if (fixture) return fixture(variables);
  for (let t = 1; ; t++) {
    let r, body = '';
    try {
      r = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'tempestian-github-io-sync' },
        body: JSON.stringify({ query, variables })
      });
      body = await r.text();
    } catch (err) {
      if (t >= 4) throw new Error('AniList bağlantı hatası: ' + err.message);
      await sleep(4000 * t);
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

// 1. Mevcut site verisini (data/anime.json) ve kuralları (data/overrides.json) oku
const existingData = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { anime: [] };
const existingAnimeList = Array.isArray(existingData.anime) ? existingData.anime : [];
const ov = fs.existsSync(OVERRIDES_FILE) ? JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8')) : {};
const excludedIds = new Set((ov.exclude || []).map(Number).filter(Boolean));
const deletedFranchiseIds = new Set(ov.deletedIds || []);

const existingById = new Map();
const existingByAnilistId = new Map();
const existingPartMap = new Map();

for (const item of existingAnimeList) {
  if (deletedFranchiseIds.has(item.id)) continue;
  const seedId = extractSeedAnilistId(item);
  if (seedId && excludedIds.has(seedId)) continue;
  if (seedId) {
    item.anilistId = seedId;
    if (!item.firstSeasonUrl) item.firstSeasonUrl = 'https://anilist.co/anime/' + seedId;
    if (!item.url) item.url = 'https://anilist.co/anime/' + seedId;
    existingByAnilistId.set(seedId, item);
  }
  existingById.set(item.id, item);

  const parts = item.parts || [];
  if (seedId && parts.length === 1 && typeof parts[0].id === 'string' && parts[0].id.startsWith('part-')) {
    parts[0].id = seedId;
  }

  for (const p of parts) {
    if (p && p.id != null) {
      const pid = parseAnilistId(p.id) || p.id;
      existingPartMap.set(pid, p);
      if (typeof pid === 'number') existingByAnilistId.set(pid, item);
    }
  }
}

// 2. Kullanıcı profili senkronu (Yalnızca SYNC_MODE === 'hybrid' ise çalışır; varsayılan 'relations_only' modunda AniList profiline hiç bakılmaz)
const entries = new Map();
if (SYNC_MODE === 'hybrid') {
  try {
    for (let c = 1; ; c++) {
      const res = await gql(c);
      const col = res && res.data && res.data.MediaListCollection;
      if (!col) break;
      for (const l of col.lists || []) {
        for (const e of l.entries || []) {
          if (!e || !e.media || e.media.format === 'MUSIC') continue;
          if (excludedIds.has(e.media.id)) continue;
          let m = entries.get(e.media.id);
          if (!m) entries.set(e.media.id, m = { ...e, custom: false });
          if (LIST && ((l.isCustomList && l.name === LIST) || (e.customLists && e.customLists[LIST]))) m.custom = true;
        }
      }
      if (!col.hasNextChunk || process.env.FIXTURE) break;
      await sleep(1000);
    }
  } catch (err) {
    console.warn('AniList kullanıcı listesi çekilemedi, mevcut yerel kayıtlarla devam ediliyor: ' + err.message);
  }
}

// 3. Sitedeki tüm animelerin AniList ID'lerini yan içerik / bağlantılı anime ve kapak URL tarama havuzuna ekle
const seedMediaIds = new Set();
for (const item of existingAnimeList) {
  if (deletedFranchiseIds.has(item.id)) continue;
  const seedId = extractSeedAnilistId(item);
  if (seedId && !excludedIds.has(seedId) && !entries.has(seedId)) {
    seedMediaIds.add(seedId);
  }
  for (const p of item.parts || []) {
    const pid = parseAnilistId(p.id);
    if (pid && !excludedIds.has(pid) && !entries.has(pid)) {
      seedMediaIds.add(pid);
    }
  }
}

const extra = new Map(), seen = new Set(entries.keys());
let frontier = [];
const follow = edges => {
  for (const ed of edges || []) {
    if (ed && ed.node && LINKS.has(ed.relationType) && !excludedIds.has(ed.node.id) && !seen.has(ed.node.id)) {
      seen.add(ed.node.id);
      frontier.push(ed.node.id);
    }
  }
};

for (const m of entries.values()) follow(m.media.relations && m.media.relations.edges);
for (const sid of seedMediaIds) {
  if (!seen.has(sid)) {
    seen.add(sid);
    frontier.push(sid);
  }
}

const buildMediaMock = () => {
  if (!process.env.FIXTURE_MEDIA) return null;
  return v => {
    const f = JSON.parse(fs.readFileSync(process.env.FIXTURE_MEDIA, 'utf8'));
    return {
      data: {
        Page: {
          media: v.ids.filter(id => f[id]).map(id => ({
            id,
            format: f[id].format || 'TV',
            status: f[id].status || 'FINISHED',
            episodes: f[id].episodes ?? 12,
            startDate: { year: f[id].year || 2024, month: f[id].month || 1, day: f[id].day || 1 },
            genres: f[id].genres || [],
            title: { romaji: f[id].name, english: f[id].english || f[id].name },
            coverImage: { large: f[id].image || ('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx' + id + '.jpg') },
            relations: { edges: f[id].edges || [] }
          }))
        }
      }
    };
  };
};

try {
  for (let round = 0; frontier.length && round < 10; round++) {
    const ids = frontier;
    frontier = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const got = (await call(QM, { ids: chunk }, buildMediaMock())).data.Page.media || [];
      for (const n of got) {
        if (n.format === 'MUSIC' || excludedIds.has(n.id)) continue;
        extra.set(n.id, n);
        follow(n.relations && n.relations.edges);
      }
      if (!process.env.FIXTURE_MEDIA) await sleep(800);
    }
  }
} catch (err) {
  console.warn('Ara düğümler çözülemedi, eldeki bağlantılarla devam: ' + err.message);
}

// 4. Union-Find ile Bağlantılı Anime Zincirlerini (Sezon, Film, Yan İçerik) Grupla
const par = new Map();
const find = x => {
  if (!par.has(x)) par.set(x, x);
  while (par.get(x) !== x) {
    par.set(x, par.get(par.get(x)));
    x = par.get(x);
  }
  return x;
};

const allEdges = [
  ...[...entries].map(([id, m]) => [id, (m.media.relations && m.media.relations.edges) || []]),
  ...[...extra].map(([id, n]) => [id, (n.relations && n.relations.edges) || []])
];
const chain = new Set();
for (const [id, edges] of allEdges) {
  for (const ed of edges) {
    if (!ed || !ed.node || excludedIds.has(ed.node.id)) continue;
    if (LINKS.has(ed.relationType)) par.set(find(ed.node.id), find(id));
    if (ed.relationType === 'PREQUEL' || ed.relationType === 'SEQUEL') {
      chain.add(id);
      chain.add(ed.node.id);
    }
  }
}
for (const [a, b] of Object.entries(ov.merge || {})) {
  par.set(find(Number(a)), find(Number(b)));
}

const groups = new Map(), extraBy = new Map();
for (const m of entries.values()) {
  const r = find(m.media.id);
  (groups.get(r) || groups.set(r, []).get(r)).push(m);
}
for (const n of extra.values()) {
  const r = find(n.id);
  (extraBy.get(r) || extraBy.set(r, []).get(r)).push(n);
}
for (const sid of seedMediaIds) {
  if (extra.has(sid)) {
    const r = find(sid);
    if (!groups.has(r)) groups.set(r, []);
  }
}

const dk = s => ((s && s.year) || 9999) * 10000 + ((s && s.month) || 0) * 100 + ((s && s.day) || 0);
const byDate = (a, b) => dk(a.media.startDate) - dk(b.media.startDate);

const state = m => {
  const ep = m.media.episodes || 0, pr = m.progress || 0, s = m.status === 'REPEATING' ? 'COMPLETED' : m.status;
  if (s === 'COMPLETED' || s === 'DROPPED') return s;
  if (ep && pr >= ep) return 'COMPLETED';
  if (s === 'CURRENT' && pr === 0) return 'PLANNING';
  return s;
};

const noCont = ov.noContinue || [];
const hit = (list, id, names) => list.some(x => typeof x === 'number' ? x === id : names.some(n => (n || '').toLowerCase().includes(String(x).toLowerCase())));

const anime = [];
const processedExistingIds = new Set();

for (const [root, members] of groups) {
  members.sort(byDate);
  const exts = (extraBy.get(root) || []).filter(n => n.format !== 'MUSIC' && !excludedIds.has(n.id));
  if (members.some(m => excludedIds.has(m.media.id))) continue;

  let matchedExisting = null;
  for (const m of members) {
    if (existingByAnilistId.has(m.media.id)) { matchedExisting = existingByAnilistId.get(m.media.id); break; }
  }
  if (!matchedExisting) {
    for (const n of exts) {
      if (existingByAnilistId.has(n.id)) { matchedExisting = existingByAnilistId.get(n.id); break; }
    }
  }
  if (matchedExisting && deletedFranchiseIds.has(matchedExisting.id)) continue;
  if (matchedExisting) processedExistingIds.add(matchedExisting.id);

  if (!matchedExisting) {
    if (LIST && !members.some(m => m.custom)) continue;
    if (!PLANNED && members.length && members.every(m => m.status === 'PLANNING')) continue;
    if (!members.length) continue;
  }

  const memberIds = new Set(members.map(m => m.media.id));
  const own = members.map(m => {
    const ep = m.media.episodes || m.progress || 0, st = state(m);
    const prevPart = existingPartMap.get(m.media.id);
    const keepAdminPart = prevPart && (prevPart.adminModified || (matchedExisting && matchedExisting.adminModified));
    const partScore = (prevPart && prevPart.score != null) ? prevPart.score : (m.score > 0 ? m.score : null);
    return {
      id: m.media.id,
      name: (keepAdminPart && prevPart.name && prevPart.name !== '1. Sezon') ? prevPart.name : (m.media.title.english || m.media.title.romaji),
      kind: (keepAdminPart && prevPart.kind) ? prevPart.kind : kind(m.media.format),
      format: m.media.format || (prevPart && prevPart.format) || null,
      episodes: ep || (prevPart && prevPart.episodes) || 0,
      watched: keepAdminPart && prevPart.watched != null
        ? prevPart.watched
        : (st === 'COMPLETED' ? ep : st === 'PLANNING' ? 0 : Math.min(m.progress || 0, ep || m.progress || 0)),
      status: (keepAdminPart && prevPart.status) ? prevPart.status : st,
      release: m.media.status || (prevPart && prevPart.release) || null,
      year: (m.media.startDate && m.media.startDate.year) || (prevPart && prevPart.year) || null,
      d: dk(m.media.startDate),
      ...(partScore != null ? { score: partScore } : {}),
      createdAt: m.createdAt || 0,
      repeat: (keepAdminPart && prevPart.repeat != null) ? prevPart.repeat : (m.repeat || 0),
      ...(keepAdminPart ? { adminModified: true } : {})
    };
  });

  const ext = exts.filter(n => !memberIds.has(n.id)).map(n => {
    const prevPart = existingPartMap.get(n.id);
    const isSeedNode = matchedExisting && extractSeedAnilistId(matchedExisting) === n.id;
    const hasLocalProgress = prevPart && (prevPart.adminModified || prevPart.status !== 'NONE' || (prevPart.watched || 0) > 0);
    const ep = n.episodes || (prevPart && prevPart.episodes) || 0;
    let watchedVal = 0;
    let statusVal = 'NONE';
    if (hasLocalProgress) {
      statusVal = prevPart.status || 'COMPLETED';
      watchedVal = (prevPart.watched != null && prevPart.watched > 0) ? prevPart.watched : (statusVal === 'COMPLETED' ? ep : 0);
    } else if (isSeedNode && matchedExisting && (!matchedExisting.parts || matchedExisting.parts.length === 0)) {
      statusVal = matchedExisting.status === 'completed' ? 'COMPLETED' : matchedExisting.status === 'watching' ? 'CURRENT' : 'COMPLETED';
      watchedVal = statusVal === 'COMPLETED' ? ep : 0;
    }
    return {
      id: n.id,
      name: (hasLocalProgress && prevPart.name && prevPart.name !== '1. Sezon') ? prevPart.name : (n.title.english || n.title.romaji),
      kind: (hasLocalProgress && prevPart.kind) ? prevPart.kind : kind(n.format),
      format: n.format || (prevPart && prevPart.format) || null,
      episodes: ep,
      watched: watchedVal,
      status: statusVal,
      release: n.status || (prevPart && prevPart.release) || null,
      year: (n.startDate && n.startDate.year) || (prevPart && prevPart.year) || null,
      d: dk(n.startDate || {}),
      ...(prevPart && prevPart.score != null ? { score: prevPart.score } : {}),
      repeat: hasLocalProgress ? (prevPart.repeat || 0) : 0,
      ...(hasLocalProgress && prevPart.adminModified ? { adminModified: true } : {})
    };
  });

  const graphedIds = new Set([...own.map(p => String(p.id)), ...ext.map(p => String(p.id))]);
  const manualExtraParts = ((matchedExisting && matchedExisting.parts) || [])
    .filter(p => !graphedIds.has(String(p.id)) && !excludedIds.has(Number(p.id)))
    .map(p => ({ ...p, d: (p.year || 9999) * 10000 }));

  const parts = [...own, ...ext, ...manualExtraParts].sort((x, y) => (x.d || 99990000) - (y.d || 99990000));
  const activeParts = parts.filter(p => p.status && p.status !== 'NONE' && p.status !== 'PLANNING');
  const pool = activeParts.length ? activeParts : parts;
  const main = pool.some(p => p.kind === 'season') ? pool.filter(p => p.kind === 'season') : pool;
  const stSet = new Set(main.map(p => p.status));
  const computedStatus = stSet.has('CURRENT') ? 'watching' : stSet.has('PAUSED') ? 'paused' : stSet.has('DROPPED') ? 'dropped'
    : stSet.size === 1 && stSet.has('COMPLETED') ? 'completed' : stSet.size === 1 && stSet.has('PLANNING') ? 'planned' : 'watching';

  const preferredSeedId = matchedExisting ? extractSeedAnilistId(matchedExisting) : null;
  const head = (preferredSeedId && parts.find(p => p.id === preferredSeedId))
    || pool.find(p => p.kind === 'season')
    || pool[0];
  const hm = (members.find(m => m.media.id === head.id) && members.find(m => m.media.id === head.id).media)
    || extra.get(head.id)
    || (members[0] && members[0].media)
    || exts[0];

  const locked = new Set((matchedExisting && matchedExisting.lockedFields) || []);
  const isModified = Boolean(matchedExisting && matchedExisting.adminModified);

  const defaultTitle = (ov.titles || {})[head.id] || (hm && (hm.title.english || hm.title.romaji)) || (matchedExisting && matchedExisting.title) || head.name;
  const title = (isModified && locked.has('title') && matchedExisting.title) ? matchedExisting.title : defaultTitle;

  const score = resolveEffectiveScore({ ...(matchedExisting || {}), parts });

  const status = (isModified && locked.has('status') && matchedExisting.status) ? matchedExisting.status : computedStatus;

  const ts = Math.min(...pool.map(p => p.createdAt || Infinity));
  const computedAddedAt = isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : ((matchedExisting && matchedExisting.addedAt) || new Date().toISOString().slice(0, 10));
  const addedAt = (isModified && locked.has('addedAt') && matchedExisting.addedAt) ? matchedExisting.addedAt : computedAddedAt;

  const seas = parts.filter(p => p.kind === 'season'), fw = seas.findIndex(p => p.watched > 0);
  const computedNext = status === 'completed' && fw >= 0 && !hit(noCont, head.id, [title, ...parts.map(p => p.name)]) && !parts.some(p => hit(noCont, p.id, []))
    && seas.slice(fw + 1).some(p => p.watched === 0 && p.format !== 'TV_SHORT' && (chain.has(p.id) || p.kind === 'season') && ['FINISHED', 'RELEASING'].includes(p.release));
  const next = (isModified && locked.has('next')) ? Boolean(matchedExisting.next) : computedNext;

  const customGenres = (matchedExisting && Array.isArray(matchedExisting.customGenres) && matchedExisting.customGenres.length)
    ? matchedExisting.customGenres
    : null;

  const image = (isModified && locked.has('image') && matchedExisting.image)
    ? matchedExisting.image
    : ((hm && hm.coverImage && hm.coverImage.large) || (matchedExisting && matchedExisting.image) || null);

  const finalAnilistId = preferredSeedId || head.id;
  const canonicalUrl = 'https://anilist.co/anime/' + finalAnilistId;
  const firstSeasonUrl = (matchedExisting && matchedExisting.firstSeasonUrl) || canonicalUrl;
  const isFavorite = Boolean(matchedExisting && matchedExisting.favorite);

  anime.push({
    id: (matchedExisting && matchedExisting.id && !String(matchedExisting.id).startsWith('custom-')) ? matchedExisting.id : ('al-' + finalAnilistId),
    title,
    anilistId: finalAnilistId,
    url: canonicalUrl,
    firstSeasonUrl,
    status,
    ...(isFavorite ? { favorite: true } : {}),
    ...(next ? { next: true } : {}),
    ...(customGenres && customGenres.length ? { genres: customGenres, customGenres } : {}),
    score: score ?? null,
    parts: parts.map(({ id, name, kind, format, episodes, watched, status, release, year, score: pScore, repeat, adminModified }) => ({
      id,
      name,
      kind,
      format,
      episodes,
      watched,
      status,
      release,
      year,
      ...(pScore != null ? { score: pScore } : {}),
      ...(repeat > 0 ? { repeat } : {}),
      ...(adminModified ? { adminModified: true } : {})
    })),
    image,
    addedAt,
    ...(matchedExisting && matchedExisting.source ? { source: matchedExisting.source } : {}),
    ...(isModified ? { adminModified: true, lockedFields: [...locked] } : {})
  });
}

// 5. AniList linki olmayan veya grafikte eşleşmeyen yerel kayıtları eksiksiz koru
for (const item of existingAnimeList) {
  if (deletedFranchiseIds.has(item.id)) continue;
  const seedId = extractSeedAnilistId(item);
  if (seedId && excludedIds.has(seedId)) continue;
  if (!processedExistingIds.has(item.id)) {
    item.score = resolveEffectiveScore(item);
    anime.push(item);
  }
}

if (!anime.length) {
  throw new Error('Senkronizasyon sonucunda hiç anime kaydı oluşmadı; mevcut veri korundu.');
}

anime.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || a.title.localeCompare(b.title));

const statsConfig = { ...DEFAULT_STATS_CONFIG, ...(existingData.statsConfig || {}), animeCountRule: 'completed_season_or_movie', includeInProgressEpisodes: true, genreSourceRule: 'custom_only' };
const stats = computeStats(anime, statsConfig);

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (old && JSON.stringify(old.anime) === JSON.stringify(anime) && JSON.stringify(old.stats) === JSON.stringify(stats)) {
  console.log('Değişiklik yok.');
  process.exit(0);
}

const outPayload = {
  schemaVersion: 3,
  updated: new Date().toISOString().slice(0, 10),
  source: 'site-first:' + SYNC_MODE,
  statsConfig,
  ...(Array.isArray(existingData.customGenreCatalog) ? { customGenreCatalog: existingData.customGenreCatalog } : {}),
  stats,
  anime
};

fs.writeFileSync(OUT, JSON.stringify(outPayload, null, 2) + '\n');
console.log(`${anime.length} franchise yazıldı (${SYNC_MODE} modu); sayılan: ${stats.anime} anime, ${stats.season} sezon, ${stats.film} film, ${stats.other} ek, ${stats.episodes} bölüm, ${stats.favorites || 0} favori.`);

// [AI-MIMARI-NOTU: ADIM 22 — SOSYAL MEDYA PAYLAŞIM KARTLARI]:
// Güncellenen anime verileri doğrultusunda `a/<id>.html` statik Open Graph ve Twitter kartlarını yeniden üretir.
try {
  generateShareCards();
} catch (e) {
  console.warn('Paylaşım kartları üretimi atlandı:', e.message);
}
