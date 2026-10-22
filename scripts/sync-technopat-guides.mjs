// ============================================================================
// [AI-MIMARI-NOTU: ADIM 15 — TECHNOPAT SOSYAL "REHBER" ÖN EKLİ KONU ÇEKİCİ]
// Bu betik (`scripts/sync-technopat-guides.mjs`) yalnızca Admin Panelinden
// manuel olarak tetiklenen `.github/workflows/sync-guides.yml` iş akışı
// tarafından çalıştırılır.
// - Technopat Sosyal (XenForo 2) üzerinde Bayram Tempestian (`user_id = 657641`)
//   tarafından açılan tüm konuları (`/sosyal/ara/member?user_id=657641&content=thread`)
//   sayfa sayfa (`?page=N` ve `before=` паjinasyonu ile) tarar.
// - Yalnızca "Rehber" ön ekine (`<span class="label ...">Rehber</span>`) sahip
//   konuları ayıklar.
// - Mevcut `data/guides.json` içindeki admin düzenlemelerini (`customGenres`,
//   `favorite`, `adminModified`, özel `summary`/`title`) ezmeden yeni rehberleri
//   ekler ve istatistikleri günceller.
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeStats } from './stats.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GUIDES_FILE = path.join(ROOT, 'data', 'guides.json');

const BASE_ORIGIN = 'https://www.technopat.net';
const USER_ID = String(process.env.TECHNOPAT_USER_ID || '657641').trim();
const USERNAME = String(process.env.TECHNOPAT_USERNAME || 'Bayram Tempestian').trim();
const TARGET_PREFIX = String(process.env.TECHNOPAT_PREFIX || 'Rehber').trim().toLocaleLowerCase('tr');
const FLARESOLVERR_URL = String(process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1').trim();

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function decodeHtmlEntities(str = '') {
  return String(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html = '') {
  return decodeHtmlEntities(String(html).replace(/<[^>]*>/g, ' '));
}

function isCloudflareChallenge(html = '', status = 200) {
  if (status === 403 || status === 503) {
    if (
      html.includes('Just a moment...') ||
      html.includes('cf-browser-verification') ||
      html.includes('challenge-platform') ||
      html.includes('Bir dakika lütfen') ||
      html.includes('Attention Required! | Cloudflare')
    ) {
      return true;
    }
  }
  return (
    html.includes('<title>Just a moment...</title>') ||
    html.includes('<title>Bir dakika lütfen...</title>') ||
    (html.includes('challenge-platform') && !html.includes('block-row') && !html.includes('structItem'))
  );
}

function toAbsoluteUrl(href = '') {
  const raw = decodeHtmlEntities(href).trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${BASE_ORIGIN}${raw}`;
  return `${BASE_ORIGIN}/sosyal/${raw.replace(/^\.\//, '')}`;
}

function normalizeThreadUrl(rawUrl = '') {
  const abs = toAbsoluteUrl(rawUrl);
  const m = abs.match(/^(https?:\/\/(?:www\.)?technopat\.net\/sosyal\/konu\/[^/?#]+\.\d+)\/?/i);
  return m ? `${m[1]}/` : abs;
}

function extractThreadId(url = '') {
  const m = String(url).match(/\/sosyal\/konu\/[^/?#]*\.(\d+)(?:\/|$)/i);
  return m ? m[1] : null;
}

function inferGuideCategory(title = '', forumSection = '', snippet = '') {
  const hay = `${title} ${forumSection} ${snippet}`.toLocaleLowerCase('tr');
  const cats = [];
  if (/(linux|arch|ubuntu|debian|fedora|cachyos|manjaro|pardus|kde|gnome|hyprland|wayland|kernel|flatpak|wine|proton|bash|terminal|grub|distro|dağıtım)/i.test(hay)) {
    cats.push('Linux & Sistem');
  }
  if (/(oyun|steam|epic games|yama|fps|shader|emülatör|ps[345]|xbox|nintendo|valorant|cs2|call of duty|gta|roblox|minecraft|discord)/i.test(hay)) {
    cats.push('Oyun Rehberi');
  }
  if (/(ekran kartı|gpu|nvidia|amd|radeon|rtx|rx |işlemci|cpu|ryzen|intel|anakart|ram|ssd|nvme|monitör|klavye|mouse|kulaklık|soğutucu|psu|kasa|bios|overclock|undervolt)/i.test(hay)) {
    cats.push('Donanım');
  }
  if (/(yapay zeka|ai |llm|chatgpt|gemini|claude|ollama|stable diffusion|copilot)/i.test(hay)) {
    cats.push('Yapay Zeka');
  }
  if (/(modem|router|dns|vpn|wi-fi|wifi|ethernet|ağ |güvenlik|şifre|antivirüs| güvenlik duvarı|firewall|dpi|goodbyedpi|zapret)/i.test(hay)) {
    cats.push('Ağ & Güvenlik');
  }
  if (/(windows|programlama|yazılım|kodlama|python|javascript|typescript|c\+\+|c#|java|git|github|docker|vs code|tarayıcı|firefox|chrome|brave|android|rom |custom rom|root)/i.test(hay)) {
    cats.push('Yazılım & Kodlama');
  }
  if (!cats.length && forumSection) {
    cats.push(forumSection);
  }
  if (!cats.length) {
    cats.push('Verimlilik & Araçlar');
  }
  return [...new Set(cats)];
}

export function parseXenForoThreadsFromHtml(html = '', targetPrefix = TARGET_PREFIX) {
  const results = [];
  const seenIds = new Set();

  // XenForo 2 arama sonuçları (<li class="block-row ...">) ve konu listesi satırları (<div class="structItem ...">)
  const rowRegex = /<(?:li|div)\b[^>]*class="[^"]*(?:\bblock-row\b|\bstructItem--thread\b)[^"]*"[^>]*>([\s\S]*?)(?=<(?:li|div)\b[^>]*class="[^"]*(?:\bblock-row\b|\bstructItem--thread\b)[^"]*"|<\/ol>|<\/div>\s*<\/div>\s*<div class="block-outer|<footer|$)/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const block = match[1];

    // Konu linkini bul (/sosyal/konu/slug.12345/)
    const titleBlockMatch =
      block.match(/<h3[^>]*class="[^"]*contentRow-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
      block.match(/<div[^>]*class="[^"]*structItem-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    const searchArea = titleBlockMatch ? titleBlockMatch[1] : block;

    // Tüm ön ek etiketlerini (<span class="label ...">Rehber</span>) kontrol et
    const labelMatches = [...searchArea.matchAll(/<span[^>]*class="[^"]*\blabel\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)];
    const labels = labelMatches.map(m => stripTags(m[1]).toLocaleLowerCase('tr')).filter(Boolean);

    const hasTargetPrefix = labels.some(lbl => lbl === targetPrefix || lbl.includes(targetPrefix));
    if (!hasTargetPrefix) continue;

    // Konu URL'sini bul (/sosyal/konu/... ve /unread veya /page- olmayan ana link)
    const linkMatches = [...searchArea.matchAll(/<a\b[^>]*href="([^"]*\/sosyal\/konu\/[^"]*\.\d+\/?[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
    if (!linkMatches.length) continue;

    // Prefix linki olmayan asıl konu başlığı linkini seç
    let chosenHref = '';
    let rawLinkInner = '';
    for (const lm of linkMatches) {
      const href = lm[1];
      const inner = lm[2];
      if (href.includes('prefix_id=')) continue;
      chosenHref = href;
      rawLinkInner = inner;
      break;
    }
    if (!chosenHref) continue;

    const cleanUrl = normalizeThreadUrl(chosenHref);
    const threadId = extractThreadId(cleanUrl);
    if (!threadId || seenIds.has(threadId)) continue;

    // Başlığın içindeki <span class="label...">Rehber</span> kısmını temizle
    const titleWithoutLabels = rawLinkInner.replace(/<span[^>]*class="[^"]*\blabel\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ');
    let cleanTitle = stripTags(titleWithoutLabels)
      .replace(/^rehber\s*[:\-–—]?\s*/i, '')
      .trim();
    if (!cleanTitle) continue;

    // Snippet / özet (.contentRow-snippet)
    const snippetMatch = block.match(/<div[^>]*class="[^"]*contentRow-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const summary = snippetMatch ? stripTags(snippetMatch[1]).slice(0, 320) : '';

    // Tarih (<time ... datetime="2026-09-11T..." data-time="1789...">)
    let addedAt = new Date().toISOString().slice(0, 10);
    const timeIsoMatch = block.match(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})[^"]*"/i);
    const timeUnixMatch = block.match(/<time\b[^>]*data-time="(\d{9,11})"/i);
    if (timeIsoMatch) {
      addedAt = timeIsoMatch[1];
    } else if (timeUnixMatch) {
      const d = new Date(Number(timeUnixMatch[1]) * 1000);
      if (!Number.isNaN(d.getTime())) addedAt = d.toISOString().slice(0, 10);
    }

    // Forum alt bölümü (/sosyal/bolum/...)
    const forumMatch = block.match(/<a\b[^>]*href="[^"]*\/sosyal\/bolum\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const forumSection = forumMatch ? stripTags(forumMatch[1]) : '';

    seenIds.add(threadId);
    results.push({
      id: `tp-konu-${threadId}`,
      threadId: Number(threadId),
      title: cleanTitle,
      url: cleanUrl,
      summary,
      forumSection,
      addedAt,
      status: 'completed',
      source: 'technopat-sync'
    });
  }

  return results;
}

export function extractPaginationInfo(html = '', currentUrl = '') {
  const nextPages = new Set();
  // Sayfa linkleri (?page=2 veya /page-2)
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]*(?:\/sosyal\/(?:ara|search)\/\d+\/\?[^"]*page=\d+|\/sosyal\/(?:ara|search)\/\d+\/page-\d+)[^"]*)"/gi)) {
    const abs = toAbsoluteUrl(m[1]);
    if (abs && abs !== currentUrl) nextPages.add(abs);
  }
  // "Daha eski sonuçları görüntüle" linki (/sosyal/ara/member?user_id=657641&content=thread&before=...)
  let olderBatchUrl = '';
  const olderMatch = html.match(/<a\b[^>]*href="([^"]*\/sosyal\/(?:ara|search)\/member\?[^"]*before=\d+[^"]*)"/i);
  if (olderMatch) {
    olderBatchUrl = toAbsoluteUrl(olderMatch[1]);
  }
  return {
    pageUrls: [...nextPages],
    olderBatchUrl
  };
}

class MultiLayerTechnopatFetcher {
  constructor() {
    this.cookies = new Map();
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  getCookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  storeResponseCookies(res) {
    const setCookies = typeof res.headers?.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const firstPart = String(raw).split(';')[0];
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx > 0) {
        this.cookies.set(firstPart.slice(0, eqIdx).trim(), firstPart.slice(eqIdx + 1).trim());
      }
    }
  }

  async fetchDirect(url) {
    let currentUrl = url;
    for (let redirectCount = 0; redirectCount < 6; redirectCount++) {
      const headers = {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Upgrade-Insecure-Requests': '1'
      };
      const cookieStr = this.getCookieHeader();
      if (cookieStr) headers.Cookie = cookieStr;

      const res = await fetch(currentUrl, { headers, redirect: 'manual' });
      this.storeResponseCookies(res);

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) break;
        currentUrl = toAbsoluteUrl(loc);
        continue;
      }

      const html = await res.text();
      return { status: res.status, url: currentUrl, html };
    }
    throw new Error('Çok fazla yönlendirme (redirect).');
  }

  async fetchWithPlaywright(url) {
    if (!this.page) {
      const pw = await import('playwright');
      this.browser = await pw.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
      this.context = await this.browser.newContext({
        userAgent: USER_AGENT,
        locale: 'tr-TR',
        viewport: { width: 1366, height: 900 }
      });
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });
      this.page = await this.context.newPage();
    }

    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await this.page.waitForTimeout(2500);
    let html = await this.page.content();
    const status = response ? response.status() : 200;

    if (isCloudflareChallenge(html, status)) {
      await this.page.waitForTimeout(6000);
      html = await this.page.content();
    }

    return { status, url: this.page.url(), html };
  }

  async fetchWithFlareSolverr(url) {
    const res = await fetch(FLARESOLVERR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url,
        maxTimeout: 60000
      })
    });
    if (!res.ok) {
      throw new Error(`FlareSolverr HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data?.status !== 'ok' || !data?.solution?.response) {
      throw new Error(`FlareSolverr yanıtı başarısız: ${data?.message || 'Bilinmeyen hata'}`);
    }
    return {
      status: data.solution.status || 200,
      url: data.solution.url || url,
      html: data.solution.response
    };
  }

  async fetchPage(url) {
    try {
      const direct = await this.fetchDirect(url);
      if (direct.status === 200 && !isCloudflareChallenge(direct.html, direct.status)) {
        return direct;
      }
      console.log(`[Bilgi] Doğrudan istek Cloudflare engeline takıldı (${direct.status}), Playwright deneniyor: ${url}`);
    } catch (err) {
      console.log(`[Bilgi] Doğrudan istek hatası (${err.message}), Playwright deneniyor...`);
    }

    try {
      const pwRes = await this.fetchWithPlaywright(url);
      if (!isCloudflareChallenge(pwRes.html, pwRes.status)) {
        return pwRes;
      }
      console.log(`[Bilgi] Playwright Cloudflare engeline takıldı, FlareSolverr servisi deneniyor: ${url}`);
    } catch (err) {
      console.log(`[Bilgi] Playwright hatası (${err.message}), FlareSolverr servisi deneniyor...`);
    }

    return await this.fetchWithFlareSolverr(url);
  }

  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}

async function crawlUserGuideThreads() {
  const fetcher = new MultiLayerTechnopatFetcher();
  const discoveredById = new Map();
  const visitedBatchUrls = new Set();

  try {
    let batchUrl = `${BASE_ORIGIN}/sosyal/ara/member?user_id=${encodeURIComponent(USER_ID)}&content=thread`;
    let batchCount = 0;

    while (batchUrl && !visitedBatchUrls.has(batchUrl) && batchCount < 15) {
      visitedBatchUrls.add(batchUrl);
      batchCount++;
      console.log(`[Tarama] Batch #${batchCount} başlatılıyor: ${batchUrl}`);

      const firstPage = await fetcher.fetchPage(batchUrl);
      const firstItems = parseXenForoThreadsFromHtml(firstPage.html, TARGET_PREFIX);
      for (const it of firstItems) discoveredById.set(it.id, it);

      const { pageUrls, olderBatchUrl } = extractPaginationInfo(firstPage.html, firstPage.url);
      let latestOlderBatchUrl = olderBatchUrl;

      const visitedPages = new Set([firstPage.url, batchUrl]);
      const queue = [...pageUrls];

      while (queue.length > 0 && visitedPages.size < 25) {
        const pageUrl = queue.shift();
        if (!pageUrl || visitedPages.has(pageUrl)) continue;
        visitedPages.add(pageUrl);

        console.log(`  -> Sayfa taranıyor: ${pageUrl}`);
        const pageRes = await fetcher.fetchPage(pageUrl);
        const pageItems = parseXenForoThreadsFromHtml(pageRes.html, TARGET_PREFIX);
        for (const it of pageItems) discoveredById.set(it.id, it);

        const morePag = extractPaginationInfo(pageRes.html, pageRes.url);
        for (const nextP of morePag.pageUrls) {
          if (!visitedPages.has(nextP) && !queue.includes(nextP)) queue.push(nextP);
        }
        if (morePag.olderBatchUrl) latestOlderBatchUrl = morePag.olderBatchUrl;
      }

      batchUrl = latestOlderBatchUrl || '';
    }
  } finally {
    await fetcher.close();
  }

  return [...discoveredById.values()];
}

async function main() {
  console.log(`=== Technopat Sosyal Rehber Senkronu Başlatıldı ===`);
  console.log(`Üye: ${USERNAME} (#${USER_ID}) | Ön Ek Filtresi: "${TARGET_PREFIX}"`);

  let existingDoc = {
    schemaVersion: 3,
    updated: new Date().toISOString().slice(0, 10),
    source: 'site-first:guide',
    customGenreCatalog: [
      'Linux & Sistem',
      'Yazılım & Kodlama',
      'Donanım',
      'Oyun Rehberi',
      'Ağ & Güvenlik',
      'Yapay Zeka',
      'Verimlilik & Araçlar',
      'İnceleme'
    ],
    stats: {},
    items: []
  };

  try {
    const raw = await fs.readFile(GUIDES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      existingDoc = {
        ...existingDoc,
        ...parsed,
        items: Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed.guides) ? parsed.guides : []
      };
    }
  } catch (err) {
    console.log(`[Bilgi] Mevcut guides.json okunamadı, yeni oluşturulacak.`);
  }

  const fetchedGuides = await crawlUserGuideThreads();
  console.log(`[Sonuç] Technopat Sosyal'de "${TARGET_PREFIX}" ön ekli toplam ${fetchedGuides.length} konu bulundu.`);

  const existingById = new Map();
  const existingByUrl = new Map();
  for (const item of existingDoc.items) {
    if (item?.id) existingById.set(String(item.id), item);
    if (item?.url) existingByUrl.set(normalizeThreadUrl(item.url), item);
  }

  const catalogSet = new Set(existingDoc.customGenreCatalog || []);
  let addedCount = 0;
  let updatedCount = 0;

  for (const fresh of fetchedGuides) {
    const normUrl = normalizeThreadUrl(fresh.url);
    const prev = existingById.get(fresh.id) || existingByUrl.get(normUrl);
    const autoCats = inferGuideCategory(fresh.title, fresh.forumSection, fresh.summary);
    for (const c of autoCats) catalogSet.add(c);

    if (prev) {
      const locked = new Set(Array.isArray(prev.lockedFields) ? prev.lockedFields : []);
      const hasCustomCats = Array.isArray(prev.customGenres) && prev.customGenres.length > 0;
      const merged = {
        ...prev,
        threadId: fresh.threadId || prev.threadId,
        url: prev.adminModified && prev.url ? prev.url : fresh.url,
        title: (prev.adminModified || locked.has('title')) && prev.title ? prev.title : fresh.title,
        summary: prev.summary ? prev.summary : fresh.summary,
        forumSection: fresh.forumSection || prev.forumSection || '',
        addedAt: (prev.adminModified || locked.has('addedAt')) && prev.addedAt ? prev.addedAt : fresh.addedAt,
        status: prev.status || 'completed',
        genres: fresh.forumSection ? [fresh.forumSection] : (prev.genres || []),
        customGenres: hasCustomCats ? prev.customGenres : autoCats
      };
      existingById.set(merged.id, merged);
      updatedCount++;
    } else {
      const newItem = {
        id: fresh.id,
        threadId: fresh.threadId,
        title: fresh.title,
        url: fresh.url,
        summary: fresh.summary,
        forumSection: fresh.forumSection,
        addedAt: fresh.addedAt,
        status: 'completed',
        favorite: false,
        genres: fresh.forumSection ? [fresh.forumSection] : [],
        customGenres: autoCats,
        source: 'technopat-sync',
        adminModified: false,
        lockedFields: [],
        parts: []
      };
      existingById.set(newItem.id, newItem);
      addedCount++;
    }
  }

  const finalItems = [...existingById.values()].sort((a, b) => {
    return (b.addedAt || '').localeCompare(a.addedAt || '') || (b.threadId || 0) - (a.threadId || 0) || (a.title || '').localeCompare(b.title || '', 'tr');
  });

  const stats = computeStats(finalItems, { genreSourceRule: 'custom_only' });

  const outPayload = {
    schemaVersion: 3,
    updated: new Date().toISOString().slice(0, 10),
    source: 'site-first:guide',
    technopatUser: {
      userId: USER_ID,
      username: USERNAME,
      prefixFilter: 'Rehber',
      lastSyncedAt: new Date().toISOString()
    },
    customGenreCatalog: [...catalogSet],
    stats,
    items: finalItems
  };

  await fs.writeFile(GUIDES_FILE, JSON.stringify(outPayload, null, 2) + '\n', 'utf8');
  console.log(`[Tamamlandı] ${addedCount} yeni rehber eklendi, ${updatedCount} mevcut rehber güncellendi. Toplam: ${finalItems.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('[Hata] Technopat Sosyal rehber senkronu başarısız:', err);
    process.exit(1);
  });
}
