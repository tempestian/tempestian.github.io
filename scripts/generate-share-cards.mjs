// ============================================================================
// [AI-MIMARI-NOTU: ADIM 22 — STATİK SOSYAL MEDYA PAYLAŞIM KARTLARI (OPEN GRAPH & TWITTER CARDS)]
// Bu modül (`scripts/generate-share-cards.mjs`), `data/anime.json` ve diğer çoklu-medya
// dosyalarındaki yapımlar için `a/<id>.html` statik paylaşım kartları üretir.
//
// NEDEN BU MİMARİ SEÇİLDİ?
// 1. Discord, WhatsApp, Telegram, X (Twitter), Facebook ve iMessage gibi platformların
//    web crawler botları JavaScript ÇALIŞTIRMAZ ve URL'deki `#hash` fragmentını okuyamaz.
// 2. Bir kullanıcı bir animeyi veya yapımı paylaştığında (`https://tempestian.github.io/a/al-16498.html`),
//    crawler botu bu HTML dosyasındaki `<meta property="og:...">` etiketlerinden:
//    - Kullanıcının kendi verdiği ağırlıklı puanı (`★ 9.5 / 10`),
//    - Sezon ve bölüm sayısını (`4 Sezon · 87 Bölüm`),
//    - Özel kategorileri (`Shounen, Aksiyon, Gizem`) ve izleme durumunu,
//    - Resmi kapak görselini devasa ve estetik bir kart (`summary_large_image`) olarak çeker.
// 3. İnsan bir kullanıcı bu linke tıkladığında ise `<script>` ve `<meta http-equiv="refresh">`
//    sayesinde 0 milisaniyede `../anime/#al-16498` sayfasına yönlendirilir ve detay penceresi açılır.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEffectiveScore, resolveEffectiveGenres, normalizePartsForStats } from './stats.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'a');
const BASE_ORIGIN = 'https://tempestian.github.io';

const STATUS_LABELS = {
  completed: 'İzlendi',
  watching: 'İzleniyor',
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

export function buildShareCardHtml(item, sectionMeta = { id: 'anime', path: 'anime/', label: 'Anime' }) {
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
  if (partsSummary) descParts.push(partsSummary);
  if (epSummary) descParts.push(epSummary);
  if (maxRepeat > 0) descParts.push(`↻ ${maxRepeat + 1} kez izlendi`);
  if (effGenres.length) descParts.push(effGenres.slice(0, 3).join(', '));
  if (statusText) descParts.push(statusText);

  const ogDescription = descParts.length
    ? `${descParts.join(' · ')} · Bayram Tempestian Arşivi`
    : `Bayram Tempestian'ın ${sectionMeta.label} arşivinde yer alan ${item.title} incelemesi ve detayları.`;

  const coverUrl = resolveLargeImage(item.image);
  const targetAppUrl = `../${sectionMeta.path}#${encodeURIComponent(item.id)}`;
  const canonicalUrl = `${BASE_ORIGIN}/${sectionMeta.path}#${encodeURIComponent(item.id)}`;
  const sharePageUrl = `${BASE_ORIGIN}/a/${encodeURIComponent(item.id)}.html`;
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
<meta property="og:type" content="video.tv_show">
<meta property="og:url" content="${esc(sharePageUrl)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDescription)}">
<meta property="og:image" content="${esc(coverUrl)}">
<meta property="og:image:alt" content="${esc(item.title)} Posteri">

<!-- Twitter Card (Büyük Görsel Modu) -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(ogDescription)}">
<meta name="twitter:image" content="${esc(coverUrl)}">

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

export function generateShareCards() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let animeCount = 0;
  const animeFile = path.join(ROOT, 'data', 'anime.json');
  if (fs.existsSync(animeFile)) {
    const raw = JSON.parse(fs.readFileSync(animeFile, 'utf8'));
    const list = Array.isArray(raw.anime) ? raw.anime : [];
    for (const a of list) {
      if (!a || !a.id) continue;
      const html = buildShareCardHtml(a, { id: 'anime', path: 'anime/', label: 'Anime' });
      fs.writeFileSync(path.join(OUT_DIR, `${a.id}.html`), html, 'utf8');
      animeCount++;
    }
  }

  // Çoklu Medya Bölümleri (Dizi, Film, Manga, Kitap)
  const multimediaConfigs = [
    { file: 'data/series.json', meta: { id: 'series', path: 'dizi/', label: 'Dizi' } },
    { file: 'data/movies.json', meta: { id: 'movie', path: 'film/', label: 'Film' } },
    { file: 'data/manga.json', meta: { id: 'manga', path: 'manga/', label: 'Manga' } },
    { file: 'data/books.json', meta: { id: 'book', path: 'kitap/', label: 'Kitap' } }
  ];

  let multiCount = 0;
  for (const mCfg of multimediaConfigs) {
    const mPath = path.join(ROOT, mCfg.file);
    if (fs.existsSync(mPath)) {
      try {
        const rawM = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        const mItems = Array.isArray(rawM.items) ? rawM.items : [];
        for (const it of mItems) {
          if (!it || !it.id) continue;
          const html = buildShareCardHtml(it, mCfg.meta);
          fs.writeFileSync(path.join(OUT_DIR, `${it.id}.html`), html, 'utf8');
          multiCount++;
        }
      } catch (_) {}
    }
  }

  console.log(`[ShareCards]: ${animeCount} anime ve ${multiCount} diğer medya için statik sosyal medya paylaşım kartları üretildi -> /a/`);
}

if (process.argv[1] && process.argv[1].endsWith('generate-share-cards.mjs')) {
  generateShareCards();
}
