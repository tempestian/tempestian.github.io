// ============================================================================
// [AI-MIMARI-NOTU: ADIM 2 — ÇOKLU KATEGORİ STATİK SOSYAL MEDYA PAYLAŞIM KARTLARI (OPEN GRAPH & TWITTER CARDS)]
// Bu modül (`scripts/generate-share-cards.mjs`), `data/anime.json`, `data/series.json`,
// `data/movies.json`, `data/manga.json` ve `data/books.json` dosyalarındaki yapımlar için:
// - Anime: `a/<id>.html` -> `../anime/#<id>`
// - Dizi:  `d/<id>.html` -> `../dizi/#<id>`
// - Film:  `f/<id>.html` -> `../film/#<id>`
// - Manga: `m/<id>.html` -> `../manga/#<id>`
// - Kitap: `k/<id>.html` -> `../kitap/#<id>`
// statik paylaşım kartları üretir.
//
// DEPOLAMA AVANTAJI:
// - Her HTML dosyası yalnızca ~1 KB metin etiketinden ibarettir.
// - Görseller sunucuda saklanmaz; doğrudan AniList, TMDB veya OpenLibrary CDN'lerinden çekilir.
// - Yüzlerce yapım dahi toplamda 1 MB depolama alanı tutmaz; GitHub Pages için sıfır yüktür.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEffectiveScore, resolveEffectiveGenres, normalizePartsForStats } from './stats.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_ORIGIN = 'https://tempestian.github.io';

const STATUS_LABELS = {
  completed: 'İzlendi / Okundu',
  watching: 'İzleniyor / Okunuyor',
  paused: 'Beklemede',
  dropped: 'Bırakıldı',
  planned: 'Planlandı'
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function resolveLargeImage(imgUrl) {
  if (!imgUrl) return `${BASE_ORIGIN}/assets/img/icon-512.png`;
  if (/^https?:\/\//i.test(imgUrl)) {
    return imgUrl.replace('/cover/medium/', '/cover/large/');
  }
  return `${BASE_ORIGIN}/${imgUrl.replace(/^\.?\//, '')}`;
}

export function buildShareCardHtml(item, sectionMeta = { id: 'anime', folder: 'a', path: 'anime/', label: 'Anime' }) {
  const effScore = resolveEffectiveScore(item);
  const effGenres = resolveEffectiveGenres(item, 'custom_only');
  const parts = normalizePartsForStats(item);

  const ownParts = parts.filter(p => p.status !== 'PLANNING' && p.status !== 'NONE');
  const snCount = ownParts.filter(p => p.kind === 'season').length;
  const flCount = ownParts.filter(p => p.kind === 'movie').length;
  const otCount = ownParts.filter(p => p.kind === 'other').length;
  const totalEp = ownParts.reduce((acc, p) => acc + (p.episodes || 0), 0);
  const watchedEp = ownParts.reduce((acc, p) => acc + (p.watched || 0), 0);
  const maxRepeat = Math.max(0, ...ownParts.map(p => p.repeat || 0));

  const partsDescList = [];
  if (snCount) partsDescList.push(`${snCount} Sezon`);
  if (flCount) partsDescList.push(`${flCount} Film`);
  if (otCount) partsDescList.push(`${otCount} Ek`);
  const partsSummary = partsDescList.join(', ');

  let epSummary = '';
  if (watchedEp > 0) {
    epSummary = (totalEp && watchedEp < totalEp) ? `${watchedEp}/${totalEp} Bölüm` : `${watchedEp} Bölüm`;
  } else if (totalEp > 0) {
    epSummary = `${totalEp} Bölüm`;
  }

  const statusText = item.status === 'completed' && item.next ? 'Devam edilecek' : (STATUS_LABELS[item.status] || item.status || 'İzlendi');
  const scoreBadge = effScore ? `★ ${effScore} / 10` : '';

  // Kart Başlığı ve Açıklaması (Discord, Twitter, WhatsApp için optimize edilmiş)
  const ogTitle = `${item.title}${effScore ? ' · ★ ' + effScore : ''}${item.favorite ? ' (★ Başyapıt)' : ''}`;
  
  const descParts = [];
  if (effScore) descParts.push(`Puan: ★ ${effScore}/10`);
  if (item.favorite) descParts.push('★ Başyapıt');

  // Kategoriye Özel Detaylar
  if (sectionMeta.id === 'anime') {
    if (partsSummary) descParts.push(partsSummary);
    if (epSummary) descParts.push(epSummary);
    if (maxRepeat > 0) descParts.push(`↻ ${maxRepeat + 1} kez izlendi`);
  } else if (sectionMeta.id === 'series') {
    if (item.seasons) descParts.push(`${item.seasons} Sezon`);
    if (item.episodes) descParts.push(`${item.episodes} Bölüm`);
    if (item.network) descParts.push(item.network);
  } else if (sectionMeta.id === 'movie') {
    if (item.director) descParts.push(`Yönetmen: ${item.director}`);
    if (item.runtime) descParts.push(`${item.runtime} Dk.`);
    if (item.year) descParts.push(`${item.year}`);
  } else if (sectionMeta.id === 'book') {
    if (item.author) descParts.push(`Yazar: ${item.author}`);
    if (item.pages) descParts.push(`${item.pages} Sayfa`);
    if (item.volumes) descParts.push(`${item.volumes} Cilt`);
  } else if (sectionMeta.id === 'manga') {
    if (item.author) descParts.push(`Çizer/Yazar: ${item.author}`);
    if (item.volumes) descParts.push(`${item.volumes} Cilt`);
    if (item.chapters) descParts.push(`${item.chapters} Bölüm`);
  }

  if (effGenres.length) descParts.push(effGenres.slice(0, 3).join(', '));
  if (statusText) descParts.push(statusText);

  const ogDescription = descParts.length
    ? `${descParts.join(' · ')} · Bayram Tempestian Arşivi`
    : `Bayram Tempestian'ın ${sectionMeta.label} arşivinde yer alan ${item.title} incelemesi ve detayları.`;

  const coverUrl = resolveLargeImage(item.image);
  // [AI-MIMARI-NOTU: ADIM 8 — SİNEMATİK GENİŞ SAHNE GÖRSELİNİ PAYLAŞIM KARTINA TAŞIMA]
  // Banner veya backdrop mevcutsa 16:9 oranında sinematik Twitter & Discord büyük önizlemesi sunar.
  const shareImageUrl = resolveLargeImage(item.banner || item.backdrop || item.image);
  const targetAppUrl = `../${sectionMeta.path}#${encodeURIComponent(item.id)}`;
  const canonicalUrl = `${BASE_ORIGIN}/${sectionMeta.path}#${encodeURIComponent(item.id)}`;
  const folder = sectionMeta.folder || 'a';
  const sharePageUrl = `${BASE_ORIGIN}/${folder}/${encodeURIComponent(item.id)}.html`;
  const themeColor = item.favorite ? '#f5a623' : '#0a7fd1';

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(ogTitle)} · Tempestian</title>
<meta name="description" content="${esc(ogDescription)}">
<link rel="canonical" href="${esc(canonicalUrl)}">

<!-- Discord & Tarayıcı Tema Rengi -->
<meta name="theme-color" content="${themeColor}">

<!-- Open Graph / Facebook / Discord / WhatsApp -->
<meta property="og:site_name" content="Tempestian">
<meta property="og:type" content="${sectionMeta.id === 'book' ? 'book' : 'video.tv_show'}">
<meta property="og:url" content="${esc(sharePageUrl)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDescription)}">
<meta property="og:image" content="${esc(shareImageUrl)}">
<meta property="og:image:alt" content="${esc(item.title)} Önizlemesi">

<!-- Twitter Card (Büyük Görsel Modu) -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(ogDescription)}">
<meta name="twitter:image" content="${esc(shareImageUrl)}">

<!-- 0ms İstemci Tarafı Otomatik Yönlendirme -->
<meta http-equiv="refresh" content="0; url=${esc(targetAppUrl)}">
<script>
  try {
    location.replace(${JSON.stringify(targetAppUrl)});
  } catch (e) {
    location.href = ${JSON.stringify(targetAppUrl)};
  }
</script>

<style>
  :root { color-scheme: dark light; }
  body {
    margin: 0;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    background: #0b0d13;
    color: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    box-sizing: border-box;
  }
  .card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 32px 24px;
    max-width: 380px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(16px);
  }
  .thumb {
    width: 150px;
    height: 225px;
    object-fit: cover;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    margin-bottom: 18px;
  }
  h1 {
    font-size: 1.25rem;
    margin: 0 0 8px;
    line-height: 1.35;
    font-weight: 650;
  }
  .score {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 99px;
    background: ${item.favorite ? 'rgba(245, 166, 35, 0.2)' : 'rgba(10, 127, 209, 0.2)'};
    color: ${item.favorite ? '#ffc247' : '#5cc8ff'};
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 12px;
  }
  .meta {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-bottom: 20px;
    line-height: 1.5;
  }
  .btn {
    display: inline-block;
    background: #0a7fd1;
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
    padding: 10px 20px;
    border-radius: 99px;
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .btn:hover {
    background: #0867aa;
    transform: scale(1.03);
  }
</style>
</head>
<body>
<div class="card">
  <img class="thumb" src="${esc(coverUrl)}" alt="${esc(item.title)}">
  <h1>${esc(item.title)}</h1>
  ${scoreBadge ? `<div class="score">${esc(scoreBadge)}</div>` : ''}
  <div class="meta">${esc(ogDescription)}</div>
  <a class="btn" href="${esc(targetAppUrl)}">Sitede İncele &rarr;</a>
</div>
</body>
</html>
`;
}

// [AI-MIMARI-NOTU: ADIM 2 — SİLİNEN VEYA YENİDEN ADLANDIRILAN YAPIMLARIN TEMİZLİĞİ (ORPHAN CLEANUP)]
function cleanOrphanCards(directory, activeFileNames) {
  if (!fs.existsSync(directory)) return;
  const existingFiles = fs.readdirSync(directory);
  for (const f of existingFiles) {
    if (f.endsWith('.html') && !activeFileNames.has(f)) {
      try {
        fs.unlinkSync(path.join(directory, f));
      } catch (_) {}
    }
  }
}

export function generateShareCards() {
  const animeOutDir = path.join(ROOT, 'a');
  if (!fs.existsSync(animeOutDir)) {
    fs.mkdirSync(animeOutDir, { recursive: true });
  }

  let animeCount = 0;
  const activeAnimeFiles = new Set();
  const animeFile = path.join(ROOT, 'data', 'anime.json');
  if (fs.existsSync(animeFile)) {
    const raw = JSON.parse(fs.readFileSync(animeFile, 'utf8'));
    const list = Array.isArray(raw.anime) ? raw.anime : [];
    for (const a of list) {
      if (!a || !a.id) continue;
      const fileName = `${a.id}.html`;
      activeAnimeFiles.add(fileName);
      const html = buildShareCardHtml(a, { id: 'anime', folder: 'a', path: 'anime/', label: 'Anime' });
      fs.writeFileSync(path.join(animeOutDir, fileName), html, 'utf8');
      animeCount++;
    }
  }
  cleanOrphanCards(animeOutDir, activeAnimeFiles);

  // Çoklu Medya Bölümleri (Dizi: d/, Film: f/, Manga: m/, Kitap: k/)
  const multimediaConfigs = [
    { file: 'data/series.json', meta: { id: 'series', folder: 'd', path: 'dizi/', label: 'Dizi' } },
    { file: 'data/movies.json', meta: { id: 'movie', folder: 'f', path: 'film/', label: 'Film' } },
    { file: 'data/manga.json', meta: { id: 'manga', folder: 'm', path: 'manga/', label: 'Manga' } },
    { file: 'data/books.json', meta: { id: 'book', folder: 'k', path: 'kitap/', label: 'Kitap' } }
  ];

  let multiCount = 0;
  for (const mCfg of multimediaConfigs) {
    const targetDir = path.join(ROOT, mCfg.meta.folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const activeMultiFiles = new Set();
    const mPath = path.join(ROOT, mCfg.file);
    if (fs.existsSync(mPath)) {
      try {
        const rawM = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        const mItems = Array.isArray(rawM.items) ? rawM.items : [];
        for (const it of mItems) {
          if (!it || !it.id) continue;
          const fileName = `${it.id}.html`;
          activeMultiFiles.add(fileName);
          const html = buildShareCardHtml(it, mCfg.meta);
          fs.writeFileSync(path.join(targetDir, fileName), html, 'utf8');
          multiCount++;
        }
      } catch (_) {}
    }
    cleanOrphanCards(targetDir, activeMultiFiles);
  }

  console.log(`[ShareCards]: ${animeCount} anime (a/) ve ${multiCount} diğer medya (d/, f/, m/, k/) için statik sosyal medya paylaşım kartları üretildi.`);
}

if (process.argv[1] && process.argv[1].endsWith('generate-share-cards.mjs')) {
  generateShareCards();
}
