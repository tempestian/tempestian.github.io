// ============================================================================
// [AI-MIMARI-NOTU: ANILIST'TEN BAĞIMSIZ, SİTE VERİSİ ODAKLI İSTATİSTİK MOTORU (ADIM 8 & 11)]
// Bu modül (`scripts/stats.mjs`), `data/anime.json` içindeki istatistikleri hesaplayan
// tek gerçek kaynaktır (Single Source of Truth) ve Admin Panelindeki `computeStatsClient`
// ile birebir aynı algoritmayı çalıştırır.
//
// KULLANICI TARAFINDAN BELİRLENEN KESİN KURALLAR (ADIM 8 & 11):
// 1. Ağırlıklı Otomatik Puan Hesabı (`resolveEffectiveScore` & `PART_SCORE_WEIGHTS`):
//    - Animenin genel puanı her zaman sezonlara, filmlere ve yan içeriklere verilen
//      parça puanlarından (`parts[].score`) ağırlıklı ortalama ile otomatik hesaplanır:
//      * Ana Sezon (`kind === 'season'`, TV / ONA): Ağırlık = 1.00 (%100 etki)
//      * Film (`kind === 'movie'`, MOVIE):          Ağırlık = 0.35 (%35 etki)
//      * Yan İçerik / OVA / Özel (`kind === 'other'` veya `TV_SHORT`/`OVA`/`SPECIAL`): Ağırlık = 0.15 (%15 etki)
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
//
// 5. Favoriler / Başyapıtlar (`favorite: true` — Adım 11):
//    - Admin tarafından "⭐ Favori / Başyapıt" olarak işaretlenen yapımlar `stats.favorites`
//      sayacında toplanır ve vitrinde öne çıkarılır.
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
  animeCountRule: 'completed_season_or_movie',
  includeInProgressEpisodes: true,
  genreSourceRule: 'custom_only'
};

export const RATING_CRITERIA = {
  anime: [
    { id: 'story', label: 'Hikâye & Kurgusal Mimari', weight: 0.25 },
    { id: 'world', label: 'Dünya Tasarımı & Evren İnşası', weight: 0.20 },
    { id: 'characters', label: 'Karakter Derinliği & Gelişim', weight: 0.20 },
    { id: 'visuals', label: 'Görsel Yönetmenlik & Animasyon', weight: 0.15 },
    { id: 'sound', label: 'Ses Tasarımı, Müzik & Seslendirme', weight: 0.10 },
    { id: 'enjoyment', label: 'Seyir Hazzı & Duygusal Tortu', weight: 0.10 }
  ],
  manga: [
    { id: 'story', label: 'Hikâye & Senaryo Örgüsü', weight: 0.25 },
    { id: 'world', label: 'Dünya Tasarımı, Lore & Sistem', weight: 0.25 },
    { id: 'characters', label: 'Karakterler & Diyalog Kalitesi', weight: 0.20 },
    { id: 'art', label: 'Çizim & Panel Yönetimi', weight: 0.20 },
    { id: 'enjoyment', label: 'Okuma Sürükleyiciliği & Etki', weight: 0.10 }
  ],
  movie: [
    { id: 'story', label: 'Senaryo & Anlatım Bütünlüğü', weight: 0.25 },
    { id: 'world', label: 'Dünya Tasarımı & Mekân Hissi', weight: 0.20 },
    { id: 'acting', label: 'Oyunculuk & Karakter İnandırıcılığı', weight: 0.20 },
    { id: 'directing', label: 'Yönetmenlik & Sinematografi', weight: 0.15 },
    { id: 'sound', label: 'Ses Miksajı & Film Müziği', weight: 0.10 },
    { id: 'impact', label: 'Duygusal Katarsis & Final Vuruşu', weight: 0.10 }
  ],
  series: [
    { id: 'story', label: 'Ana Kurgu & Sezon Devamlılığı', weight: 0.25 },
    { id: 'world', label: 'Dünya Tasarımı & Sosyolojik Doku', weight: 0.20 },
    { id: 'characters', label: 'Karakter Arkları & Kadro Derinliği', weight: 0.20 },
    { id: 'pacing', label: 'Bölüm Temposu & Sürükleyicilik', weight: 0.15 },
    { id: 'production', label: 'Prodüksiyon & Sinematografi', weight: 0.10 },
    { id: 'music_finale', label: 'Müzik & Finallerin Ağırlığı', weight: 0.10 }
  ],
  book: [
    { id: 'story', label: 'Kurgu, Olay Örgüsü & Fikir', weight: 0.25 },
    { id: 'world', label: 'Dünya Tasarımı & Evren İnşası', weight: 0.25 },
    { id: 'prose', label: 'Anlatım Dili & Edebi Üslup', weight: 0.25 },
    { id: 'characters', label: 'Karakter & Psikolojik Katman', weight: 0.15 },
    { id: 'impact', label: 'Düşünsel Tortu & Kalıcılık', weight: 0.10 }
  ]
};

export function computeCriteriaScore(criteria, subScores) {
  if (!subScores || typeof subScores !== 'object') return null;
  let totalScore = 0;
  let totalWeight = 0;
  for (const c of criteria) {
    const star = Number(subScores[c.id]);
    if (!isNaN(star) && star >= 1 && star <= 5) {
      totalScore += star * 2 * c.weight;
      totalWeight += c.weight;
    }
  }
  if (totalWeight <= 0) return null;
  return Math.round((totalScore / totalWeight) * 10) / 10;
}

export function resolveEffectiveScore(a, type = 'anime') {
  if (!a || typeof a !== 'object') return null;

  if (a.subScores && typeof a.subScores === 'object') {
    const criteria = RATING_CRITERIA[type] || RATING_CRITERIA.anime;
    const s = computeCriteriaScore(criteria, a.subScores);
    if (s != null) return s;
  }

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
    favorites: 0,
    avgScore: null,
    byStatus: {},
    genres: [],
    scoreHistogram: {},
    rules: cfg
  };

  const counted = [];
  const genreCounts = new Map();

  for (const a of list) {
    if (a.favorite) stats.favorites++;
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
      isCounted = doneSeasonOrMovie.length > 0 || (doneParts.length > 0 && !normParts.some(p => p.kind === 'season' || p.kind === 'movie')) || st === 'completed';
    }

    for (const p of doneParts) {
      if (isCounted) {
        stats[p.kind === 'season' ? 'season' : p.kind === 'movie' ? 'film' : 'other']++;
      }
      stats.completedEpisodes += p.watched;
    }

    for (const p of activeParts) {
      if (p.status !== 'COMPLETED') {
        stats.inProgressEpisodes += p.watched;
      }
    }

    if (!isCounted) continue;
    stats.anime++;
    counted.push(a);

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


export function computeMediaStats(items, rawConfig = {}, mediaType = 'anime') {
  const list = Array.isArray(items) ? items : [];
  if (mediaType === 'guide') {
    const byStatus = {};
    const genreCounts = new Map();
    let favorites = 0;
    let published = 0;
    for (const it of list) {
      if (!it) continue;
      if (it.favorite) favorites++;
      const st = it.status || 'completed';
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (st === 'completed') published++;
      for (const g of resolveEffectiveGenres(it, 'custom_only')) {
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      }
    }
    const genres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
      .map(([name, count]) => ({ name, count }));
    return {
      total: list.length,
      published,
      draft: list.length - published,
      favorites,
      byStatus,
      genres
    };
  }

  const base = computeStats(list, rawConfig);
  if (mediaType === 'book') {
    return {
      total: list.length,
      read: base.anime,
      volumes: base.season,
      extras: base.film + base.other,
      pages: base.episodes,
      completedPages: base.completedEpisodes,
      inProgressPages: base.inProgressEpisodes,
      favorites: base.favorites,
      avgScore: base.avgScore,
      byStatus: base.byStatus,
      genres: base.genres,
      scoreHistogram: base.scoreHistogram
    };
  }
  if (mediaType === 'manga') {
    return {
      total: list.length,
      read: base.anime,
      volumes: base.season,
      specials: base.film + base.other,
      chapters: base.episodes,
      completedChapters: base.completedEpisodes,
      inProgressChapters: base.inProgressEpisodes,
      favorites: base.favorites,
      avgScore: base.avgScore,
      byStatus: base.byStatus,
      genres: base.genres,
      scoreHistogram: base.scoreHistogram
    };
  }
  if (mediaType === 'movie') {
    return {
      total: list.length,
      watched: base.anime,
      films: base.season + base.film,
      extras: base.other,
      watchCount: base.episodes,
      favorites: base.favorites,
      avgScore: base.avgScore,
      byStatus: base.byStatus,
      genres: base.genres,
      scoreHistogram: base.scoreHistogram
    };
  }
  if (mediaType === 'series') {
    return {
      total: list.length,
      watched: base.anime,
      seasons: base.season,
      specials: base.film + base.other,
      episodes: base.episodes,
      completedEpisodes: base.completedEpisodes,
      inProgressEpisodes: base.inProgressEpisodes,
      favorites: base.favorites,
      avgScore: base.avgScore,
      byStatus: base.byStatus,
      genres: base.genres,
      scoreHistogram: base.scoreHistogram
    };
  }
  return base;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const f = process.env.OUT || 'data/anime.json';
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
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
