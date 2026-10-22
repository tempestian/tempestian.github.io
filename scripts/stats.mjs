// ============================================================================
// [AI-MIMARI-NOTU: ANILIST'TEN BAĞIMSIZ, SİTE VERİSİ ODAKLI İSTATİSTİK MOTORU (ADIM 8)]
// Bu modül (`scripts/stats.mjs`), `data/anime.json` içindeki istatistikleri hesaplayan
// tek gerçek kaynaktır (Single Source of Truth) ve Admin Panelindeki `computeStatsClient`
// ile birebir aynı algoritmayı çalıştırır.
//
// KULLANICI TARAFINDAN BELİRLENEN KESİN KURALLAR (ADIM 8):
// 1. Ağırlıklı Otomatik Puan Hesabı (`resolveEffectiveScore` & `PART_SCORE_WEIGHTS`):
//    - Animenin genel puanı her zaman sezonlara, filmlere ve yan içeriklere verilen
//      parça puanlarından (`parts[].score`) ağırlıklı ortalama ile otomatik hesaplanır:
//      * Ana Sezon (`kind === 'season'`, TV / ONA): Ağırlık = 1.00 (%100 etki)
//      * Film (`kind === 'movie'`, MOVIE):          Ağırlık = 0.35 (%35 etki)
//      * Yan İçerik / OVA / Özel (`kind === 'other'` veya `TV_SHORT`/`OVA`/`SPECIAL`): Ağırlık = 0.15 (%15 etki)
//    - Formül: Yuvarla1Ondalık( Toplam(parçaPuanı_i * ağırlık_i) / Toplam(ağırlık_i) )
//    - Eğer parçalara henüz tek tek puan girilmemiş ancak üst düzey `a.score` mevcutsa,
//      veri kaybı (boşluk) olmaması için `a.score` yedek olarak korunur.
//
// 2. İzlenen Bölüm Sayısı (`includeInProgressEpisodes: true`):
//    - Yeni bölüm izledikçe (`+1 Bölüm` yapıldıkça) hem tamamlanan (`COMPLETED`) hem de
//      devam eden (`CURRENT`), beklemede (`PAUSED`) veya bırakılan (`DROPPED`) parçalardaki
//      izlenmiş bölümler (`watched > 0`) toplam bölüm sayısına (`stats.episodes`) anında dahil edilir.
//
// 3. İzlenen Anime Sayısı (`animeCountRule: 'completed_season_or_movie'`):
//    - Bir animenin üstteki "İzlenen Anime" (`stats.anime`) sayısına dahil edilmesi için
//      en az 1 Sezon (`kind === 'season'`) veya Film (`kind === 'movie'`) parçasının
//      tamamlanmış (`status === 'COMPLETED' && watched > 0`) olması gerekir.
//
// 4. Tür / Kategori İstatistikleri (`genreSourceRule: 'custom_only'`):
//    - İstatistiklerde (`stats.genres`) ve filtrelerde AniList'ten gelen ham türler DEĞİL,
//      yalnızca admin tarafından elle seçilen özel kategoriler (`customGenres`: Shounen,
//      Seinen, Isekai, Rom-Com vb.) yer alır.
// ============================================================================
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PART_SCORE_WEIGHTS = {
  season: 1.0,
  movie: 0.35,
  other: 0.15
};

export function getPartWeight(part) {
  if (!part || typeof part !== 'object') return PART_SCORE_WEIGHTS.other;
  if (part.kind === 'movie' || part.format === 'MOVIE') return PART_SCORE_WEIGHTS.movie;
  if (part.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(part.format)) return PART_SCORE_WEIGHTS.other;
  return PART_SCORE_WEIGHTS.season;
}

export const DEFAULT_STATS_CONFIG = {
  // 'completed_season_or_movie': En az 1 sezon veya film bitince izlenen anime sayısına dahil eder (Varsayılan)
  animeCountRule: 'completed_season_or_movie',
  // true: Yeni bölüm izledikçe (+1 Bölüm) izlenen bölüm sayısına anında dahil eder (Varsayılan)
  includeInProgressEpisodes: true,
  // 'custom_only': İstatistikte yalnızca adminin elle seçtiği özel kategoriler (customGenres) yer alır (Varsayılan)
  genreSourceRule: 'custom_only'
};

export function resolveEffectiveScore(a) {
  if (!a || typeof a !== 'object') return null;
  const parts = Array.isArray(a.parts) ? a.parts : [];
  let weightedSum = 0;
  let totalWeight = 0;

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

  const direct = Number(a.score);
  return !isNaN(direct) && direct > 0 ? Math.round(direct * 10) / 10 : null;
}

export function resolveEffectiveGenres(a, genreSourceRule = 'custom_only') {
  if (!a || typeof a !== 'object') return [];
  if (Array.isArray(a.customGenres) && a.customGenres.length > 0) {
    return [...new Set(a.customGenres.map(g => String(g).trim()).filter(Boolean))];
  }
  if (genreSourceRule === 'custom_only') {
    return [];
  }
  const raw = Array.isArray(a.genres) ? a.genres : [];
  return [...new Set(raw.map(g => String(g || '').trim()).filter(Boolean))];
}

export function normalizePartsForStats(a) {
  const rawParts = Array.isArray(a && a.parts) ? a.parts : [];
  if (!rawParts.length) {
    if (a && a.status === 'completed') {
      return [{ kind: 'season', format: 'TV', status: 'COMPLETED', episodes: 1, watched: 1, repeat: 0 }];
    }
    return [];
  }
  const anyDone = rawParts.some(p => p && (p.status === 'COMPLETED' || (p.watched || 0) > 0));
  return rawParts.map((p, idx) => {
    const ep = Math.max(0, Number(p.episodes) || 0);
    let w = Math.max(0, Number(p.watched) || 0);
    let st = p.status || 'NONE';
    if (!anyDone && a.status === 'completed' && (p.kind === 'season' || idx === 0)) {
      st = 'COMPLETED';
    }
    if (st === 'COMPLETED' && w === 0) {
      w = ep > 0 ? ep : 1;
    }
    if (ep > 0 && w >= ep && st === 'CURRENT') {
      st = 'COMPLETED';
    }
    return {
      ...p,
      kind: p.kind === 'movie' ? 'movie' : p.kind === 'other' ? 'other' : 'season',
      episodes: ep,
      watched: w,
      status: st,
      repeat: Math.max(0, Number(p.repeat) || 0)
    };
  });
}

export function computeStats(anime, rawConfig = {}) {
  const cfg = { ...DEFAULT_STATS_CONFIG, ...(rawConfig || {}) };
  const list = Array.isArray(anime) ? anime : [];

  const eps = a => normalizePartsForStats(a).reduce((n, p) => {
    if (p.status === 'NONE' || p.status === 'PLANNING') return n;
    if (!cfg.includeInProgressEpisodes && p.status !== 'COMPLETED') return n;
    return n + (p.watched || 0);
  }, 0);

  const reps = a => Math.max(0, ...normalizePartsForStats(a).map(p => p.repeat || 0));
  const rank = (arr, key) => [...arr].sort((a, b) => key(b) - key(a) || eps(b) - eps(a) || (a.title || '').localeCompare(b.title || '', 'tr'))[0];

  const stats = {
    anime: 0,
    season: 0,
    film: 0,
    other: 0,
    episodes: 0,
    completedEpisodes: 0,
    inProgressEpisodes: 0,
    avgScore: null,
    byStatus: {},
    genres: [],
    scoreHistogram: {},
    rules: cfg
  };

  const counted = [];
  const genreCounts = new Map();

  for (const a of list) {
    const st = a.status || 'watching';
    stats.byStatus[st] = (stats.byStatus[st] || 0) + 1;

    const normParts = normalizePartsForStats(a);
    const doneParts = normParts.filter(p => p.status === 'COMPLETED' && p.watched > 0);
    const doneSeasonOrMovie = doneParts.filter(p => p.kind === 'season' || p.kind === 'movie');
    const activeParts = normParts.filter(p => p.status !== 'NONE' && p.status !== 'PLANNING' && p.watched > 0);

    let isCounted = false;
    if (cfg.animeCountRule === 'completed_only') {
      isCounted = st === 'completed';
    } else if (cfg.animeCountRule === 'any_watched') {
      isCounted = activeParts.length > 0 || doneParts.length > 0 || st === 'completed';
    } else {
      // Varsayılan ('completed_season_or_movie'): En az 1 sezon veya film tamamlanmışsa (veya yalnızca OVA'dan oluşan bir seride tamamlanan parça varsa) sayılır
      isCounted = doneSeasonOrMovie.length > 0 || (doneParts.length > 0 && !normParts.some(p => p.kind === 'season' || p.kind === 'movie')) || st === 'completed';
    }

    // Tamamlanan sezon, film ve yan içeriklerin sayıları + tamamlanan bölümler
    for (const p of doneParts) {
      if (isCounted) {
        stats[p.kind === 'season' ? 'season' : p.kind === 'movie' ? 'film' : 'other']++;
      }
      stats.completedEpisodes += p.watched;
    }

    // Devam eden / beklemede / bırakılan parçalardaki izlenmiş bölümler (anında toplama yansır)
    for (const p of activeParts) {
      if (p.status !== 'COMPLETED') {
        stats.inProgressEpisodes += p.watched;
      }
    }

    if (!isCounted) continue;
    stats.anime++;
    counted.push(a);

    // Sadece admin tarafından elle seçilen özel kategorileri (customGenres) say
    const gList = resolveEffectiveGenres(a, cfg.genreSourceRule);
    for (const g of gList) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }
  }

  stats.episodes = cfg.includeInProgressEpisodes
    ? (stats.completedEpisodes + stats.inProgressEpisodes)
    : stats.completedEpisodes;

  stats.listed = list.length;
  stats.completed = counted.filter(a => a.status === 'completed').length;
  stats.partial = counted.length - stats.completed;
  stats.excluded = list.length - counted.length;

  // Puanlar: Sezon/film/yan içerik ağırlıklı puan ortalamasını kullan
  const rated = counted
    .map(a => ({ item: a, effScore: resolveEffectiveScore(a) }))
    .filter(x => x.effScore != null && x.effScore > 0);

  if (rated.length) {
    stats.avgScore = Math.round((rated.reduce((n, x) => n + x.effScore, 0) / rated.length) * 10) / 10;
    for (let b = 1; b <= 10; b++) stats.scoreHistogram[b] = 0;
    for (const { effScore } of rated) {
      const bucket = Math.min(10, Math.max(1, Math.floor(effScore)));
      stats.scoreHistogram[bucket] = (stats.scoreHistogram[bucket] || 0) + 1;
    }
  }

  stats.genres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([name, count]) => ({ name, count }));

  const hl = {};
  if (rated.length) {
    const best = [...rated].sort((a, b) => b.effScore - a.effScore || eps(b.item) - eps(a.item) || (a.item.title || '').localeCompare(b.item.title || '', 'tr'))[0];
    hl.topScore = {
      id: best.item.id,
      title: best.item.title,
      score: best.effScore,
      ties: rated.filter(x => x.effScore === best.effScore).length - 1
    };
  }
  const w = rank(list.filter(a => eps(a) > 0), eps);
  if (w) hl.mostWatched = { id: w.id, title: w.title, episodes: eps(w), status: w.status };
  const r = list.filter(a => reps(a) > 0);
  if (r.length) {
    const t = rank(r, reps);
    hl.mostRewatched = { id: t.id, title: t.title, times: reps(t) + 1 };
  }
  if (Object.keys(hl).length) stats.highlights = hl;
  return stats;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const f = process.env.OUT || 'data/anime.json';
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  // Mevcut animelerde üst düzey puan varsa ancak tamamlanmış sezonlarda henüz parça puanı yoksa,
  // ağırlıklı puan sistemine geçişte hiçbir puanın boşlukta kalmaması için tamamlanan ana sezonlara miras bırak:
  for (const a of d.anime || []) {
    if (a.score != null && Array.isArray(a.parts)) {
      const anyPartScored = a.parts.some(p => p && p.score != null && Number(p.score) > 0);
      if (!anyPartScored) {
        const doneSeasons = a.parts.filter(p => p && p.kind === 'season' && p.status === 'COMPLETED');
        const targets = doneSeasons.length ? doneSeasons : a.parts.filter(p => p && p.status === 'COMPLETED');
        for (const p of targets) {
          p.score = Number(a.score);
        }
      }
      a.score = resolveEffectiveScore(a);
    }
  }
  d.statsConfig = { ...DEFAULT_STATS_CONFIG, ...(d.statsConfig || {}), animeCountRule: 'completed_season_or_movie', includeInProgressEpisodes: true, genreSourceRule: 'custom_only' };
  d.stats = computeStats(d.anime, d.statsConfig);
  fs.writeFileSync(f, JSON.stringify({ ...d, statsConfig: d.statsConfig, stats: d.stats }, null, 2) + '\n');
  console.log('stats güncellendi:', JSON.stringify(d.stats.highlights));
}
