// ============================================================================
// [AI-MIMARI-NOTU: ADIM 9 — DİZİ, FİLM, KİTAP, MANGA OTOMASYONU (MULTI-PROVIDER API WORKFLOW)]
// Bu betik (`scripts/sync-multimedia.mjs`), `data/series.json`, `data/movies.json`,
// `data/books.json` ve `data/manga.json` dosyalarını çoklu harici API sağlayıcıları üzerinden
// sıfır depolama şartıyla senkronize eder:
//
// SAĞLAYICILAR VE SIFIR-DEPOLAMA PRENSİBİ:
// 1. Dizi (TV Series):
//    - TVMaze API (ÜCRETSİZ / API KEY İSTEMEZ): `https://api.tvmaze.com/singlesearch/shows`
//      Sezon sayıları, toplam bölüm sayısı, yayın durumu ve yüksek çözünürlüklü kapak linklerini çeker.
//    - TMDB API (Opsiyonel / `TMDB_API_KEY` varsa): Yüksek kaliteli sinematik sahne görselleri (`backdrop_path`) çeker.
//
// 2. Film (Movies):
//    - TMDB API (veya TVMaze/Open Search fallback): Süre, çıkış yılı, yüksek çözünürlüklü sinematik
//      sahne görseli (`backdrop_path` -> `https://image.tmdb.org/t/p/w1280/...`) ve afiş linkini çeker.
//
// 3. Kitap (Books):
//    - OpenLibrary API (ÜCRETSİZ / API KEY İSTEMEZ): `https://openlibrary.org/search.json`
//      Sayfa sayısı (`number_of_pages_median`), ilk basım yılı, yazar ve kapak CDN linkini çeker.
//
// 4. Manga:
//    - AniList GraphQL API (ÜCRETSİZ / API KEY İSTEMEZ):
//      Güncel bölüm (chapter), cilt (volume) sayıları, kapak ve geniş sahne görseli (`bannerImage`) çeker.
//
// KULLANICI VERİLERİNİN KORUNMASI:
// - Kullanıcının verdiği puanlar (`score`), özel kategoriler (`customGenres`), favori/başyapıt
//   işaretleri (`favorite: true`) ve kişisel izleme notları ASLA ezilmez.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateShareCards } from './generate-share-cards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'Tempestian-Media-Sync/1.0',
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SafeFetch Warning]: ${url} alınamadı:`, err.message);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 1. DİZİ (SERIES) — TVMaze & TMDB Entegrasyonu
// ----------------------------------------------------------------------------
async function syncSeriesItem(item) {
  if (!item || !item.title) return item;
  console.log(`  🎬 [Dizi]: "${item.title}" taranıyor...`);

  // TVMaze API Sorgusu (API Key Gerekmez)
  const query = encodeURIComponent(item.title);
  const tvData = await safeFetchJson(`https://api.tvmaze.com/singlesearch/shows?q=${query}&embed[]=seasons&embed[]=episodes`);

  let updated = { ...item };

  if (tvData) {
    // Kapak görseli (eğer yoksa veya remote)
    if (!updated.image && tvData.image) {
      updated.image = tvData.image.original || tvData.image.medium;
    }

    // Backdrop sahne görseli
    if (!updated.banner && tvData.image && tvData.image.original) {
      updated.banner = tvData.image.original;
    }

    // Yayın durumu
    if (!updated.status) {
      updated.status = tvData.status === 'Running' ? 'watching' : 'completed';
    }

    // Sezon ve Bölüm sayıları
    const seasons = tvData._embedded && Array.isArray(tvData._embedded.seasons) ? tvData._embedded.seasons : [];
    const episodes = tvData._embedded && Array.isArray(tvData._embedded.episodes) ? tvData._embedded.episodes : [];

    if (!Array.isArray(updated.parts) || updated.parts.length === 0) {
      updated.parts = seasons.map(s => ({
        id: `s-${s.number}`,
        name: `${s.number}. Sezon`,
        kind: 'season',
        episodes: s.episodeOrder || (episodes.filter(ep => ep.season === s.number).length) || 10,
        watched: updated.status === 'completed' ? (s.episodeOrder || 10) : 0,
        status: updated.status === 'completed' ? 'COMPLETED' : 'CURRENT',
        year: s.premiereDate ? parseInt(s.premiereDate.slice(0, 4), 10) : (tvData.premiered ? parseInt(tvData.premiered.slice(0, 4), 10) : null)
      }));
    }
  }

  // TMDB API Entegrasyonu (Geniş Açılı Sinematik Backdrop için)
  if (TMDB_API_KEY) {
    await sleep(250);
    const tmdbRes = await safeFetchJson(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${query}&language=tr-TR`);
    const tmdbFirst = tmdbRes && tmdbRes.results && tmdbRes.results[0];
    if (tmdbFirst && tmdbFirst.backdrop_path) {
      updated.banner = `https://image.tmdb.org/t/p/w1280${tmdbFirst.backdrop_path}`;
    }
  }

  return updated;
}

// ----------------------------------------------------------------------------
// 2. FİLM (MOVIES) — TMDB & Açık Dizin Entegrasyonu
// ----------------------------------------------------------------------------
async function syncMovieItem(item) {
  if (!item || !item.title) return item;
  console.log(`  🍿 [Film]: "${item.title}" taranıyor...`);
  const query = encodeURIComponent(item.title);
  let updated = { ...item };

  if (TMDB_API_KEY) {
    const tmdbRes = await safeFetchJson(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&language=tr-TR`);
    const movie = tmdbRes && tmdbRes.results && tmdbRes.results[0];
    if (movie) {
      if (!updated.image && movie.poster_path) {
        updated.image = `https://image.tmdb.org/t/p/w780${movie.poster_path}`;
      }
      if (movie.backdrop_path) {
        updated.banner = `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
      }
      if (!updated.year && movie.release_date) {
        updated.year = parseInt(movie.release_date.slice(0, 4), 10);
      }
      if (!updated.parts || !updated.parts.length) {
        updated.parts = [{
          id: `m-1`,
          name: updated.title,
          kind: 'movie',
          episodes: 1,
          watched: updated.status === 'completed' ? 1 : 0,
          status: updated.status === 'completed' ? 'COMPLETED' : 'CURRENT',
          year: updated.year || (movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : null)
        }];
      }
    }
  } else {
    // TVMaze arama fallback (bazı TV filmleri ve mini yapımlar için)
    const tvData = await safeFetchJson(`https://api.tvmaze.com/singlesearch/shows?q=${query}`);
    if (tvData && tvData.image) {
      if (!updated.image) updated.image = tvData.image.original || tvData.image.medium;
      if (!updated.banner) updated.banner = tvData.image.original;
      if (!updated.year && tvData.premiered) updated.year = parseInt(tvData.premiered.slice(0, 4), 10);
    }
  }

  return updated;
}

// ----------------------------------------------------------------------------
// 3. KİTAP (BOOKS) — OpenLibrary API Entegrasyonu (API Key Gerekmez)
// ----------------------------------------------------------------------------
async function syncBookItem(item) {
  if (!item || !item.title) return item;
  console.log(`  📚 [Kitap]: "${item.title}" taranıyor...`);
  const query = encodeURIComponent(item.title);
  const olData = await safeFetchJson(`https://openlibrary.org/search.json?q=${query}&limit=1`);

  let updated = { ...item };
  const doc = olData && olData.docs && olData.docs[0];

  if (doc) {
    if (!updated.image && doc.cover_i) {
      updated.image = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    if (!updated.author && doc.author_name && doc.author_name[0]) {
      updated.author = doc.author_name[0];
    }
    const pages = doc.number_of_pages_median || 250;
    if (!updated.parts || !updated.parts.length) {
      updated.parts = [{
        id: `b-1`,
        name: updated.title,
        kind: 'book',
        episodes: pages,
        watched: updated.status === 'completed' ? pages : 0,
        status: updated.status === 'completed' ? 'COMPLETED' : 'CURRENT',
        year: doc.first_publish_year || null
      }];
    }
  }

  return updated;
}

// ----------------------------------------------------------------------------
// 4. MANGA — AniList GraphQL API Entegrasyonu (API Key Gerekmez)
// ----------------------------------------------------------------------------
async function syncMangaItem(item) {
  if (!item || !item.title) return item;
  console.log(`  📖 [Manga]: "${item.title}" taranıyor...`);
  const query = `query($search:String){Media(search:$search,type:MANGA){id status chapters volumes coverImage{large} bannerImage genres startDate{year}}}`;
  const res = await safeFetchJson('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { search: item.title } })
  });

  let updated = { ...item };
  const media = res && res.data && res.data.Media;

  if (media) {
    if (!updated.image && media.coverImage && media.coverImage.large) {
      updated.image = media.coverImage.large;
    }
    if (media.bannerImage) {
      updated.banner = media.bannerImage;
    }
    const chapters = media.chapters || 50;
    if (!updated.parts || !updated.parts.length) {
      updated.parts = [{
        id: `mg-1`,
        name: updated.title,
        kind: 'manga',
        episodes: chapters,
        watched: updated.status === 'completed' ? chapters : 0,
        status: updated.status === 'completed' ? 'COMPLETED' : 'CURRENT',
        year: media.startDate ? media.startDate.year : null
      }];
    }
  }

  return updated;
}

// ----------------------------------------------------------------------------
// ANA ÇOKLU-MEDYA SENKRONİZASYON AKIŞI
// ----------------------------------------------------------------------------
export async function syncAllMultimedia() {
  console.log('⚡ [Tempestian Multi-Provider Sync]: Başlatılıyor...');

  const SECTIONS = [
    { key: 'series', file: path.join(ROOT, 'data/series.json'), handler: syncSeriesItem },
    { key: 'movies', file: path.join(ROOT, 'data/movies.json'), handler: syncMovieItem },
    { key: 'books',  file: path.join(ROOT, 'data/books.json'),  handler: syncBookItem },
    { key: 'manga',  file: path.join(ROOT, 'data/manga.json'),  handler: syncMangaItem }
  ];

  let totalUpdated = 0;

  for (const sec of SECTIONS) {
    if (!fs.existsSync(sec.file)) continue;
    let jsonDoc;
    try {
      jsonDoc = JSON.parse(fs.readFileSync(sec.file, 'utf8'));
    } catch (e) {
      console.warn(`[Sync Warning]: ${sec.file} okunamadı:`, e.message);
      continue;
    }

    const items = Array.isArray(jsonDoc.items) ? jsonDoc.items : [];
    if (!items.length) {
      console.log(`ℹ️ [${sec.key}]: Henüz kayıtlı içerik bulunmuyor (0 yapım).`);
      continue;
    }

    console.log(`🔍 [${sec.key}]: ${items.length} yapım senkronize ediliyor...`);
    const newItems = [];
    for (const it of items) {
      await sleep(350); // API sağlayıcılarını yormamak için nazik gecikme
      const resItem = await sec.handler(it);
      newItems.push(resItem);
    }

    jsonDoc.items = newItems;
    jsonDoc.updated = new Date().toISOString().slice(0, 10);

    // İstatistik özeti güncelleme
    let watchedCount = 0, epCount = 0, favCount = 0;
    for (const it of newItems) {
      if (it.status === 'completed') watchedCount++;
      if (it.favorite) favCount++;
      if (Array.isArray(it.parts)) {
        for (const p of it.parts) {
          epCount += Number(p.watched) || 0;
        }
      }
    }
    if (jsonDoc.stats) {
      jsonDoc.stats.total = newItems.length;
      jsonDoc.stats.watched = watchedCount;
      jsonDoc.stats.episodes = epCount;
      jsonDoc.stats.favorites = favCount;
    }

    fs.writeFileSync(sec.file, JSON.stringify(jsonDoc, null, 2) + '\n', 'utf8');
    totalUpdated += newItems.length;
    console.log(`✓ [${sec.key}]: ${newItems.length} yapım güncellendi ve kaydedildi.`);
  }

  // Sosyal medya kartlarını eşzamanlı yenile
  console.log('🌐 [Sosyal Medya Kartları]: Güncelleniyor...');
  await generateShareCards();

  console.log(`✨ [Multi-Provider Sync Tamamlandı]: Toplam ${totalUpdated} kayıt işlendi.`);
}

// Doğrudan CLI'dan çalıştırılıyorsa
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  syncAllMultimedia().catch(err => {
    console.error('❌ Multi-Provider Sync Hatası:', err);
    process.exit(1);
  });
}
