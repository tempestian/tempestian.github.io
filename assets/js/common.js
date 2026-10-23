// ============================================================================
// [AI-MIMARI-NOTU: ORTAK KABUK, ALT MENÜ (#DOCK), ÇOKLU-MEDYA ÖZETİ VE KUTUCUK MOTORU]
// Bu dosya tüm sayfalarda (Ana sayfa, Anime, Dizi, Film, Manga, Kitap ve Rehber)
// çalışan ortak veri ve arayüz katmanıdır.
//
// 1. Alt Menü (`#dock`) Mimari Notu:
//    - HTML şablonlarında `<nav id="dock" class="dock glass">` doğrudan flex kapsayıcısıdır.
//    - İçine ikinci bir `<nav>` EKLENMEMELİDİR; `<a>` öğeleri doğrudan `#dock` içine
//      yerleştirilir ve aktif sekmenin (`it.id === cur`) içine `<span class="pill">`
//      eklenerek yan yana (yatay) Liquid Glass sekme görünümü korunur.
//
// 2. Çoklu-Medya Arşiv Özeti (`summarize` — Adım 12 & 13):
//    - `anime`, `series`, `movie`, `manga`, `book` ve `guide` bölümlerinin her biri için
//      ilgili JSON dosyasındaki (`data/anime.json`, `data/series.json` vb.) `stats` ve
//      kayıt dizisini okuyarak ana sayfadaki kategori kartlarında zengin sayaçları
//      (ör. Dizi/Sezon/Bölüm, Film/Ort. Puan, Kitap/Sayfa, Manga/Bölüm) ve 4'lü kapak
//      şeridini (`strip`) oluşturur.
// ============================================================================
(() => {
  const root = document.body.dataset.root || '', cur = document.body.dataset.section;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} };
  const json = k => { try { return JSON.parse(ls(k)); } catch (e) { return null; } };

  const P = {
    home: '<path d="M4 11.2 12 4.6l8 6.6V19a1 1 0 0 1-1 1h-4.2v-5.2H9.2V20H5a1 1 0 0 1-1-1z"/>',
    anime: '<rect x="3.5" y="4.5" width="17" height="12.5" rx="3.6"/><path d="M10.4 8.6v4.4l3.8-2.2z"/><path d="M8.5 20.3h7"/>',
    manga: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5V5.5"/><path d="M8 7h8M8 11h6"/>',
    book: '<path d="M12 6.2c-1.8-1.5-4.4-2-7-1.7v13.8c2.6-.3 5.2.2 7 1.7 1.8-1.5 4.4-2 7-1.7V4.5c-2.6-.3-5.2.2-7 1.7z"/><path d="M12 6.2v13.8"/>',
    movie: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/>',
    series: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="m8 3 4 3 4-3"/><path d="M10 10.2v4.6l4-2.3z"/>',
    guide: '<circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-2 5.6-5.6 2 2-5.6z"/>',
    game: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M6.5 12h4M8.5 10v4"/><circle cx="15.5" cy="11" r=".8" fill="currentColor"/><circle cx="17.5" cy="13" r=".8" fill="currentColor"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    sparkle: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    dot: '<circle cx="12" cy="12" r="7.5"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    moon: '<path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
    next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    out: '<path d="M8 16 16 8M9 8h7v7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/>',
    down: '<path d="m6 9.5 6 6 6-6"/>',
    grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="2"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="2"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="2"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="2"/>',
    list: '<path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20"/><circle cx="5" cy="6.5" r=".6"/><circle cx="5" cy="12" r=".6"/><circle cx="5" cy="17.5" r=".6"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    chev: '<path d="m6 9.5 6 6 6-6"/>',
    star: '<path fill="currentColor" d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/>',
    tier: '<rect x="3.5" y="4.5" width="4.5" height="4.5" rx="1.2"/><path d="M11 6.8h9.5"/><rect x="3.5" y="10.8" width="4.5" height="4.5" rx="1.2"/><path d="M11 13h7.5"/><rect x="3.5" y="17" width="4.5" height="4.5" rx="1.2"/><path d="M11 19.2h5.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><polyline points="12 7 12 12 15 14"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
  };
  const icon = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.dot) + '</svg>';

  const resolveAsset = u => {
    if (!u) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
    return root + u.replace(/^\.?\//, '');
  };

  const themeBtn = document.getElementById('theme');
  const syncIcons = () => {
    document.querySelectorAll('[data-icon]').forEach(b => { b.innerHTML = icon(b.dataset.icon === 'theme' ? (document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon') : b.dataset.icon); });
    if (themeBtn) themeBtn.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
  };
  syncIcons(); document.addEventListener('themechange', syncIcons);
  if (themeBtn) themeBtn.onclick = () => window.toggleTheme();

  const bar = document.querySelector('.bar');
  let on = false;
  const upd = () => { const n = scrollY > 36; if (n !== on) { on = n; bar && bar.classList.toggle('on', n); } };
  addEventListener('scroll', upd, { passive: true }); upd();

  const parts = it => {
    const raw = it.parts || (it.seasons || []).map(s => ({ ...s, kind: 'season' }));
    if (!raw.length && it.status === 'completed') {
      return [{ kind: 'season', status: 'COMPLETED', episodes: 1, watched: 1, repeat: 0 }];
    }
    const anyDone = raw.some(p => p && (p.status === 'COMPLETED' || (p.watched || 0) > 0));
    return raw.map((p, idx) => {
      const ep = Math.max(0, Number(p.episodes) || 0);
      let w = Math.max(0, Number(p.watched) || 0);
      let st = p.status || 'NONE';
      if (!anyDone && it.status === 'completed' && (p.kind === 'season' || idx === 0)) st = 'COMPLETED';
      if (st === 'COMPLETED' && w === 0) w = ep > 0 ? ep : 1;
      if (ep > 0 && w >= ep && st === 'CURRENT') st = 'COMPLETED';
      return {
        ...p,
        kind: p.kind === 'movie' ? 'movie' : p.kind === 'other' ? 'other' : 'season',
        episodes: ep,
        watched: w,
        status: st
      };
    });
  };

  const tally = (items, statsConfig = {}) => {
    const includeInProgress = statsConfig.includeInProgressEpisodes !== false;
    const rule = statsConfig.animeCountRule || 'completed_season_or_movie';
    const t = { anime: 0, season: 0, film: 0, ep: 0 };
    for (const it of items) {
      const ps = parts(it);
      const done = ps.filter(p => p.status === 'COMPLETED' && p.watched > 0);
      const doneSeasonOrMovie = done.filter(p => p.kind === 'season' || p.kind === 'movie');
      const active = ps.filter(p => p.status !== 'NONE' && p.status !== 'PLANNING' && p.watched > 0);
      const isCounted = rule === 'completed_only'
        ? it.status === 'completed'
        : rule === 'any_watched'
          ? (active.length > 0 || done.length > 0 || it.status === 'completed')
          : (doneSeasonOrMovie.length > 0 || (done.length > 0 && !ps.some(p => p.kind === 'season' || p.kind === 'movie')) || it.status === 'completed');

      for (const p of done) {
        if (isCounted) {
          if (p.kind === 'season') t.season++;
          else if (p.kind === 'movie') t.film++;
        }
        t.ep += p.watched;
      }
      if (includeInProgress) {
        for (const p of active) {
          if (p.status !== 'COMPLETED') t.ep += p.watched;
        }
      }
      if (isCounted) t.anime++;
    }
    return t;
  };
  // [AI-MIMARI-NOTU: ADIM 21 — EVRENSEL GÜVENLİ METİN KAÇIŞI (UI.esc), GELİŞMİŞ ALTYAZI/PARÇA ARAMASI VE MODAL YATAY KAYDIRMA]
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 5 & 6 — DİNAMİK AMBİENT GLOW (AURA) VE RESMİ FRAGMAN OYNATICI]
  // Modal açıldığında afişin rengini Canvas ile hafifçe okuyup arka plana Spotify/Apple Music
  // tarzı yumuşak bir ışık hüzmesi (aurora) yayar. Fragman oynatıcı ise sıfır depolama ile
  // YouTube üzerinden resmi fragmanı temiz bir cam modalda çalar ve kapatıldığında sesi anında keser.
  // ============================================================================
  let ambientGlowEl = null;
  function getAmbientGlowEl() {
    if (!ambientGlowEl) {
      ambientGlowEl = document.querySelector('.sheet-ambient-glow');
      if (!ambientGlowEl) {
        ambientGlowEl = document.createElement('div');
        ambientGlowEl.className = 'sheet-ambient-glow';
        ambientGlowEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(ambientGlowEl);
      }
    }
    return ambientGlowEl;
  }

  // [AI-MIMARI-NOTU: ADIM 5 — DİNAMİK AMBİENT GLOW (AKILLI TÜRE GÖRE RENK PALETİ VE CANVAS ÖRNEKLEMESİ)]
  function getGenreFallbackAura(item) {
    const rawGenres = [...(item.customGenres || []), ...(item.genres || [])].map(g => String(g).toLowerCase());
    if (rawGenres.some(g => g.includes('aksiyon') || g.includes('action') || g.includes('shounen') || g.includes('gerilim'))) {
      return 'rgba(225, 29, 72, 0.42)'; // Rose Red
    }
    if (rawGenres.some(g => g.includes('romantik') || g.includes('romance') || g.includes('aşk'))) {
      return 'rgba(236, 72, 153, 0.42)'; // Pink
    }
    if (rawGenres.some(g => g.includes('bilim') || g.includes('sci-fi') || g.includes('mecha') || g.includes('cyber'))) {
      return 'rgba(6, 182, 212, 0.42)'; // Cyan
    }
    if (rawGenres.some(g => g.includes('fantastik') || g.includes('fantasy') || g.includes('büyü') || g.includes('magic'))) {
      return 'rgba(168, 85, 247, 0.42)'; // Violet
    }
    if (rawGenres.some(g => g.includes('komedi') || g.includes('comedy'))) {
      return 'rgba(245, 158, 11, 0.42)'; // Amber
    }
    if (rawGenres.some(g => g.includes('dram') || g.includes('drama') || g.includes('yaşam') || g.includes('slice'))) {
      return 'rgba(16, 185, 129, 0.42)'; // Emerald
    }
    return 'rgba(14, 116, 219, 0.42)'; // Modern Deep Blue
  }

  function updateAmbientGlow(item, imgEl) {
    const el = getAmbientGlowEl();
    if (!item) {
      el.style.opacity = '0';
      return;
    }
    document.body.classList.add('has-sheet-open');
    if (item.favorite) {
      el.style.setProperty('--aura-color', 'rgba(245, 166, 35, 0.46)');
      el.style.opacity = '0.95';
      return;
    }
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 24;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imgEl, 0, 0, 16, 24);
        const data = ctx.getImageData(0, 0, 16, 24).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i+1], pb = data[i+2];
          const lum = (pr * 299 + pg * 587 + pb * 114) / 1000;
          if (lum > 25 && lum < 230) {
            r += pr; g += pg; b += pb; count++;
          }
        }
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          el.style.setProperty('--aura-color', `rgba(${r}, ${g}, ${b}, 0.5)`);
          el.style.opacity = '0.95';
          return;
        }
      } catch (_) {}
    }
    el.style.setProperty('--aura-color', getGenreFallbackAura(item));
    el.style.opacity = '0.95';
  }

  function hideAmbientGlow() {
    const el = getAmbientGlowEl();
    el.style.opacity = '0';
    document.body.classList.remove('has-sheet-open');
  }

  let trailerModalEl = null;
  // [AI-MIMARI-NOTU: ADIM 6 — FRAGMAN MODALI VE ESC OLAY YAKALAMA (CAPTURE: TRUE)]
  function getTrailerModalEl() {
    if (!trailerModalEl) {
      trailerModalEl = document.getElementById('trailerModal');
      if (!trailerModalEl) {
        trailerModalEl = document.createElement('div');
        trailerModalEl.id = 'trailerModal';
        trailerModalEl.className = 'trailer-modal';
        trailerModalEl.hidden = true;
        trailerModalEl.setAttribute('role', 'dialog');
        trailerModalEl.setAttribute('aria-modal', 'true');
        trailerModalEl.innerHTML = `
          <div class="trailer-bg" data-trailer-close></div>
          <div class="trailer-card glass sq">
            <div class="trailer-head">
              <span class="trailer-title" id="trailerTitle">Fragman</span>
              <button type="button" class="btn glass" data-trailer-close aria-label="Kapat" style="padding:6px;width:34px;height:34px">${icon('close')}</button>
            </div>
            <div class="trailer-frame-box">
              <iframe id="trailerFrame" src="" title="Fragman Oynatıcı" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
            </div>
          </div>
        `;
        document.body.appendChild(trailerModalEl);
        trailerModalEl.querySelectorAll('[data-trailer-close]').forEach(b => {
          b.onclick = () => closeTrailer();
        });
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && trailerModalEl && !trailerModalEl.hidden) {
            e.preventDefault();
            e.stopPropagation();
            closeTrailer();
          }
        }, { capture: true });
      }
    }
    return trailerModalEl;
  }

  function openTrailer(item) {
    if (!item || !item.title) return;
    const modal = getTrailerModalEl();
    const titleEl = modal.querySelector('#trailerTitle');
    const frameEl = modal.querySelector('#trailerFrame');
    if (titleEl) titleEl.textContent = `${item.title} · Resmi Fragman`;

    let embedUrl = '';
    const rawTrailer = item.trailer;
    if (rawTrailer) {
      if (typeof rawTrailer === 'string') {
        if (rawTrailer.startsWith('http')) {
          const match = rawTrailer.match(/(?:watch\?v=|embed\/|youtu\.be\/)([\w-]+)/);
          if (match) embedUrl = `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1`;
        } else {
          embedUrl = `https://www.youtube-nocookie.com/embed/${rawTrailer}?autoplay=1`;
        }
      } else if (typeof rawTrailer === 'object' && rawTrailer.id) {
        embedUrl = `https://www.youtube-nocookie.com/embed/${rawTrailer.id}?autoplay=1`;
      }
    }
    if (!embedUrl) {
      const query = encodeURIComponent(`${item.title} official trailer`);
      embedUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${query}&autoplay=1`;
    }

    if (frameEl) frameEl.src = embedUrl;
    modal.hidden = false;
  }

  function closeTrailer() {
    if (!trailerModalEl) return;
    const frameEl = trailerModalEl.querySelector('#trailerFrame');
    if (frameEl) frameEl.src = '';
    trailerModalEl.hidden = true;
  }

  window.UI = { icon, el, parts, tally, resolveAsset, esc, icons: Object.keys(P), updateAmbientGlow, hideAmbientGlow, openTrailer, closeTrailer };
  try { localStorage.removeItem('wall'); } catch (e) {}

  const dock = document.getElementById('dock'), list = document.getElementById('sections'), links = document.getElementById('links');
  const boxesTop = document.getElementById('boxesTop'), boxesBottom = document.getElementById('boxesBottom');
  const cover = x => x.image || null;

  const CANONICAL_SECTION_META = {
    anime: { path: 'anime/', data: 'data/anime.json', countKey: 'anime', unit: 'anime', icon: 'anime', showStrip: true },
    guide: { path: 'rehber/', data: 'data/guides.json', countKey: 'guides', unit: 'rehber', icon: 'guide', showStrip: false },
    series: { path: 'dizi/', data: 'data/series.json', countKey: 'series', unit: 'dizi', icon: 'series', showStrip: true },
    movie: { path: 'film/', data: 'data/movies.json', countKey: 'movies', unit: 'film', icon: 'movie', showStrip: true },
    manga: { path: 'manga/', data: 'data/manga.json', countKey: 'manga', unit: 'manga', icon: 'manga', showStrip: true },
    book: { path: 'kitap/', data: 'data/books.json', countKey: 'books', unit: 'kitap', icon: 'book', showStrip: true }
  };

  function ensureSectionDefaults(s) {
    if (!s || typeof s !== 'object') return s;
    const def = CANONICAL_SECTION_META[s.id];
    if (!def) return s;
    return {
      ...def,
      ...s,
      path: s.path || def.path,
      data: s.data || def.data,
      countKey: s.countKey || def.countKey,
      unit: s.unit || def.unit,
      icon: s.icon || def.icon,
      showStrip: s.showStrip !== undefined ? s.showStrip : def.showStrip
    };
  }

  // [AI-MIMARI-NOTU: ADIM 12 & 13 — ÇOKLU-MEDYA KART ÖZETLEYİCİ]
  const summarize = (rawSec, j) => {
    const s = ensureSectionDefaults(rawSec);
    const items = (j && (Array.isArray(j.items) ? j.items : Array.isArray(j[s.countKey]) ? j[s.countKey] : Array.isArray(j[s.id]) ? j[s.id] : Array.isArray(j.anime) ? j.anime : [])) || [];
    const st = j && j.stats;
    const rawTally = tally(items, j && j.statsConfig);
    const t = st
      ? {
          main: (st.watched ?? st.read ?? st.published ?? st.anime ?? rawTally.anime) || items.length,
          season: (st.seasons ?? st.volumes ?? st.films ?? st.season ?? rawTally.season) || 0,
          film: (st.film ?? st.specials ?? st.extras ?? rawTally.film) || 0,
          ep: (st.episodes ?? st.pages ?? st.chapters ?? st.watchCount ?? rawTally.ep) || 0,
          avg: st.avgScore
        }
      : {
          main: rawTally.anime || items.length,
          season: rawTally.season,
          film: rawTally.film,
          ep: rawTally.ep,
          avg: null
        };
    let nums;
    if (s.id === 'anime') {
      nums = [[st && st.anime != null ? st.anime : t.main, 'anime'], [t.season, 'sezon'], [t.film, 'film'], [t.ep, 'bölüm']];
    } else if (s.id === 'series') {
      nums = [[t.main, 'dizi'], [t.season, 'sezon'], [t.ep, 'bölüm']];
    } else if (s.id === 'movie') {
      nums = [[t.main, 'film'], ...(t.avg ? [[t.avg, 'ort. puan']] : [])];
    } else if (s.id === 'manga') {
      nums = [[t.main, 'manga'], [t.ep, 'bölüm']];
    } else if (s.id === 'book') {
      nums = [[t.main, 'kitap'], [t.ep, 'sayfa']];
    } else if (s.id === 'guide') {
      const catCount = st && Array.isArray(st.genres) ? st.genres.length : 0;
      nums = [[items.length, 'rehber'], ...(catCount ? [[catCount, 'kategori']] : [])];
    } else {
      nums = [[items.length, s.unit || 'içerik']];
    }
    return { nums: j ? nums : null, imgs: s.showStrip === false ? [] : items.map(cover).filter(Boolean).slice(0, 4) };
  };

  function renderCustomBoxes(container, boxItems) {
    if (!container) return;
    const activeBoxes = (boxItems || []).filter(b => b && b.enabled !== false);
    if (!activeBoxes.length) {
      container.hidden = true;
      container.replaceChildren();
      return;
    }
    const fr = document.createDocumentFragment();
    for (const b of activeBoxes) {
      const li = el('li', 'tile glass sq custom-box' + (b.span === 'full' ? ' span-full' : ''));
      const isLink = Boolean(b.url);
      const box = isLink ? Object.assign(el('a'), { href: resolveAsset(b.url) }) : el('div');
      if (isLink && /^https?:\/\//i.test(b.url)) box.rel = 'noopener';
      const top = el('div', 'tile-top');
      const titleWrap = el('div', 'box-head-left');
      if (b.image) {
        const img = el('img', 'box-thumb');
        img.src = resolveAsset(b.image);
        img.alt = '';
        img.width = 40;
        img.height = 40;
        img.decoding = 'async';
        titleWrap.append(img);
      } else if (b.icon && P[b.icon]) {
        const ic = el('span', 'box-ic');
        ic.innerHTML = icon(b.icon);
        titleWrap.append(ic);
      }
      titleWrap.append(el('h2', '', b.title || ''));
      top.append(titleWrap);
      if (b.badge) {
        top.append(el('span', 'tag', b.badge));
      } else if (isLink) {
        const g = el('span', 'go');
        g.innerHTML = icon(/^https?:\/\//i.test(b.url) ? 'out' : 'next');
        top.append(g);
      }
      box.append(top);
      if (b.text) {
        box.append(el('p', 'box-txt', b.text));
      }
      if (Array.isArray(b.stats) && b.stats.length) {
        const n = el('p', 'nums');
        for (const st of b.stats) {
          if (!st || (st.value == null && !st.label)) continue;
          const sp = el('span');
          sp.append(el('b', '', st.value ?? ''), ' ' + (st.label || ''));
          n.append(sp);
        }
        box.append(n);
      }
      li.append(box);
      fr.append(li);
    }
    container.replaceChildren(fr);
    container.hidden = false;
  }

  function applySiteIdentity(d) {
    const site = (d && d.site) || {};
    if (site.favicon32) {
      const f32 = document.getElementById('fav32') || document.querySelector('link[sizes="32x32"]');
      if (f32) f32.href = resolveAsset(site.favicon32);
    }
    if (site.icon192) {
      const f192 = document.getElementById('fav192') || document.querySelector('link[sizes="192x192"]');
      if (f192) f192.href = resolveAsset(site.icon192);
    }
    if (site.appleTouchIcon) {
      const fa = document.getElementById('favApple') || document.querySelector('link[rel="apple-touch-icon"]');
      if (fa) fa.href = resolveAsset(site.appleTouchIcon);
    }
    if (cur === 'home') {
      if (site.title) document.title = site.title;
      if (site.description) {
        const md = document.querySelector('meta[name="description"]');
        if (md) md.content = site.description;
      }
      const bt = document.getElementById('barTitle') || document.querySelector('.bar-title');
      if (bt && (site.barTitle || site.title)) bt.textContent = site.barTitle || site.title;
      const ht = document.getElementById('heroTitle') || document.querySelector('.hero h1');
      if (ht && site.title !== undefined) ht.textContent = site.title;
      const hs = document.getElementById('heroSub') || document.querySelector('.hero .sub');
      if (hs) {
        if (site.subtitle !== undefined) hs.textContent = site.subtitle;
        hs.hidden = site.subtitle === '';
      }
      const hl = document.getElementById('heroLogo') || document.querySelector('.hero .mark');
      if (hl && site.logo) hl.src = resolveAsset(site.logo);
    } else if (cur && d && d.pages && d.pages[cur]) {
      const pg = d.pages[cur];
      if (pg.metaTitle) document.title = pg.metaTitle;
      if (pg.description) {
        const md = document.querySelector('meta[name="description"]');
        if (md) md.content = pg.description;
      }
      const bt = document.querySelector('.bar-title');
      if (bt && pg.title) bt.textContent = pg.title;
      const h1 = document.querySelector('.page-head h1');
      if (h1 && pg.title) h1.textContent = pg.title;
      const headEl = document.querySelector('.page-head');
      if (headEl && pg.subtitle !== undefined) {
        let subEl = headEl.querySelector('.sub');
        if (!subEl && pg.subtitle) {
          subEl = el('p', 'sub');
          subEl.style.marginTop = '4px';
          subEl.style.fontSize = '.98rem';
          headEl.append(subEl);
        }
        if (subEl) {
          subEl.textContent = pg.subtitle;
          subEl.hidden = !pg.subtitle;
        }
      }
    }
  }

  function render(d, sum) {
    window.SITE_CONFIG = d;
    document.dispatchEvent(new CustomEvent('siteconfig', { detail: d }));
    applySiteIdentity(d);

    const visibleSections = (d.sections || []).filter(Boolean).map(ensureSectionDefaults).filter(s => s.status !== 'hidden');
    const active = visibleSections.filter(s => s.status === 'active');

    // [AI-MIMARI-NOTU]: #dock zaten <nav id="dock" class="dock glass"> olduğu için
    // bağlantılar doğrudan #dock içine eklenir (iç içe <nav> kullanılmaz); böylece
    // tüm alt menü öğeleri yan yana (yatay flex satırı halinde) dizilir.
    if (dock) {
      if (active.length) {
        const homeLabel = (d.site && d.site.homeLabel) || 'Ana sayfa';
        const items = [{ id: 'home', title: homeLabel, href: root || './', icon: 'home' }, ...active.map(s => ({ id: s.id, title: s.title, href: root + s.path, icon: s.icon || s.id }))];
        const fr = document.createDocumentFragment();
        for (const it of items) {
          const a = el('a');
          a.href = it.href;
          if (it.id === cur) {
            a.setAttribute('aria-current', 'page');
            const pill = el('span', 'pill');
            pill.setAttribute('aria-hidden', 'true');
            a.append(pill);
          }
          a.insertAdjacentHTML('beforeend', icon(it.icon));
          a.append(el('span', '', it.title));
          fr.append(a);
        }
        dock.replaceChildren(fr);
        dock.hidden = false;
      } else {
        dock.replaceChildren();
        dock.hidden = true;
      }
    }

    if (boxesTop || boxesBottom) {
      const allBoxes = Array.isArray(d.boxes) ? d.boxes : [];
      renderCustomBoxes(boxesTop, allBoxes.filter(b => b.position !== 'below'));
      renderCustomBoxes(boxesBottom, allBoxes.filter(b => b.position === 'below'));
    }

    if (list) {
      const fr = document.createDocumentFragment();
      for (const s of visibleSections) {
        const on = s.status === 'active', m = sum[s.id] || {};
        const li = el('li', 'tile glass sq' + (on ? '' : ' soon'));
        const box = on ? Object.assign(el('a'), { href: root + s.path }) : el('div');
        const top = el('div', 'tile-top');
        const headLeft = el('div', 'box-head-left');
        if (s.customImage) {
          const cimg = el('img', 'box-thumb');
          cimg.src = resolveAsset(s.customImage);
          cimg.alt = '';
          cimg.width = 36;
          cimg.height = 36;
          headLeft.append(cimg);
        } else if (s.icon && P[s.icon]) {
          const ic = el('span', 'box-ic');
          ic.innerHTML = icon(s.icon);
          headLeft.append(ic);
        }
        headLeft.append(el('h2', '', s.title));
        top.append(headLeft);
        if (on) {
          const g = el('span', 'go'); g.innerHTML = icon('next'); top.append(g);
        } else {
          top.append(el('span', 'tag', s.badgeText || s.description || 'Yakında'));
        }
        box.append(top);
        if (s.subtitle) {
          box.append(el('p', 'box-txt', s.subtitle));
        }
        if (on && m.nums) {
          const n = el('p', 'nums');
          for (const [v, u] of m.nums) { const sp = el('span'); sp.append(el('b', '', v), ' ' + u); n.append(sp); }
          box.append(n);
        }
        if (on && m.imgs && m.imgs.length && s.showStrip !== false) {
          const st = el('div', 'strip');
          for (const u of m.imgs) { const im = el('img'); im.src = resolveAsset(u); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.width = 88; im.height = 132; im.onload = () => im.classList.add('in'); st.append(im); }
          box.append(st);
        }
        li.append(box); fr.append(li);
      }
      list.replaceChildren(fr);
    }

    if (links) {
      const activeLinks = (d.links || []).filter(l => l && l.enabled !== false);
      const fr = document.createDocumentFragment();
      for (const l of activeLinks) {
        const li = el('li'), a = el('a', 'glass', l.title);
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener me';
        const o = el('span', 'out'); o.innerHTML = icon('out'); a.append(o);
        li.append(a); fr.append(li);
      }
      links.replaceChildren(fr);
    }
  }

  const previewCfg = json('tp_site_preview');
  const cached = json('ui2');
  if (previewCfg) {
    render(previewCfg, (cached && cached.s) || {});
  } else if (cached && cached.d) {
    render(cached.d, cached.s || {});
  }

  (async () => {
    try {
      const remoteCfg = await fetch(root + 'data/sections.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
      let d = remoteCfg || previewCfg;
      if (previewCfg && remoteCfg && Array.isArray(remoteCfg.sections)) {
        const prevIds = new Set((previewCfg.sections || []).map(s => s.id));
        const mergedSecs = [...(previewCfg.sections || [])];
        for (const rs of remoteCfg.sections) {
          if (!prevIds.has(rs.id)) mergedSecs.push(rs);
          else if (rs.status === 'active') {
            const idx = mergedSecs.findIndex(x => x.id === rs.id);
            if (idx >= 0 && mergedSecs[idx].status !== 'active') mergedSecs[idx].status = 'active';
          }
        }
        d = { ...remoteCfg, ...previewCfg, sections: mergedSecs };
      }
      if (!d) return;
      const sum = (cached && cached.s) || {};
      render(d, sum);
      if (list) {
        const previewAnime = json('tp_anime_preview');
        const previewMulti = json('tp_multimedia_preview') || {};
        await Promise.all((d.sections || []).filter(Boolean).map(ensureSectionDefaults).filter(s => s.status === 'active' && s.data).map(async s => {
          try {
            const remoteJ = await fetch(root + s.data, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
            let j = remoteJ;
            if (s.id === 'anime' && previewAnime && Array.isArray(previewAnime.anime) && previewAnime.anime.length >= ((remoteJ && remoteJ.anime && remoteJ.anime.length) || 0)) {
              j = previewAnime;
            } else if (previewMulti[s.id] && Array.isArray(previewMulti[s.id].items) && previewMulti[s.id].items.length > 0 && previewMulti[s.id].items.length >= ((remoteJ && (remoteJ.items || remoteJ[s.countKey]) || []).length)) {
              j = previewMulti[s.id];
            }
            if (j) sum[s.id] = summarize(s, j);
          } catch (e) {}
        }));
        render(d, sum);
      }
      ls('ui2', JSON.stringify({ d, s: sum }));
    } catch (e) {}
  })();

  // [AI-MIMARI-NOTU]: Masaüstünde (PC) `.chips`, `.dock` ve `.rq-strip` gibi yatay şeritlerin
  // hem fareyle basılı tutup sürükleyerek (drag-to-scroll) hem de fare tekerleğiyle (wheel)
  // kaydırılabilmesini sağlayan evrensel olay dinleyicisi.
  (() => {
    // [AI-MIMARI-NOTU: ADIM 21]: .cmdk-ScopeBar sekme şeridi de dahil edilerek arama modalında pürüzsüz kaydırma sağlandı.
    const SELECTOR = '.chips, .dock, .rq-strip, .cmdk-ScopeBar';

    document.addEventListener('wheel', e => {
      const el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!el || el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        const canRight = e.deltaY > 0 && el.scrollLeft < maxScroll - 1;
        const canLeft = e.deltaY < 0 && el.scrollLeft > 1;
        if (canRight || canLeft) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    }, { passive: false });

    document.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!el || el.scrollWidth <= el.clientWidth) return;

      const startX = e.clientX;
      const startScroll = el.scrollLeft;
      let moved = false;

      const onMove = ev => {
        const dx = ev.clientX - startX;
        if (!moved && Math.abs(dx) > 5) {
          moved = true;
          el.classList.add('is-dragging');
        }
        if (moved) {
          ev.preventDefault();
          el.scrollLeft = startScroll - dx;
        }
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (moved) {
          setTimeout(() => el.classList.remove('is-dragging'), 0);
          const stopClick = ce => {
            ce.stopPropagation();
            ce.preventDefault();
          };
          window.addEventListener('click', stopClick, { capture: true, once: true });
        } else {
          el.classList.remove('is-dragging');
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    document.addEventListener('click', e => {
      const btn = e.target && e.target.closest ? e.target.closest('.chips button') : null;
      if (!btn) return;
      const bar = btn.closest('.chips');
      if (bar && bar.scrollWidth > bar.clientWidth && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
  })();


  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 16 — EVRENSEL KOMUT PALETİ VE GLOBAL ARAMA (Ctrl+K)]
  // Tüm sayfalarda (`index.html`, `/anime/`, `/rehber/`, `/dizi/`, `/film/`, `/manga/`, `/kitap/`)
  // üst çubuğa arama ikonu ekler ve `Ctrl+K` / `⌘K` kısayoluyla tüm arşivlerde eşzamanlı
  // anlık arama ve hızlı gezinme sağlar.
  // ============================================================================
  (() => {
    if (cur === 'admin') return;

    const barIn = document.querySelector('.bar-in');
    if (barIn && themeBtn && !document.getElementById('globalSearchBtn')) {
      const sBtn = el('button', 'btn glass bar-search-btn');
      sBtn.id = 'globalSearchBtn';
      sBtn.type = 'button';
      sBtn.title = 'Tüm sitede ara (Ctrl+K)';
      sBtn.setAttribute('aria-label', 'Tüm sitede ara (Ctrl+K)');
      sBtn.innerHTML = icon('search');
      barIn.insertBefore(sBtn, themeBtn);
      sBtn.onclick = () => openCommandPalette();
    }

    let modal = null;
    let inp = null;
    let listEl = null;
    let scopeBar = null;
    let indexedItems = null;
    let loadingPromise = null;
    let activeScope = 'all';
    let activeIdx = 0;
    let currentMatches = [];

    const SECTION_DEFS = [
      { id: 'anime', label: 'Anime', path: 'anime/', data: 'data/anime.json', key: 'anime', icon: 'anime' },
      { id: 'guide', label: 'Rehber', path: 'rehber/', data: 'data/guides.json', key: 'items', icon: 'guide', isGuide: true },
      { id: 'series', label: 'Dizi', path: 'dizi/', data: 'data/series.json', key: 'items', icon: 'series' },
      { id: 'movie', label: 'Film', path: 'film/', data: 'data/movies.json', key: 'items', icon: 'movie' },
      { id: 'manga', label: 'Manga', path: 'manga/', data: 'data/manga.json', key: 'items', icon: 'manga' },
      { id: 'book', label: 'Kitap', path: 'kitap/', data: 'data/books.json', key: 'items', icon: 'book' }
    ];

    function computeQuickScore(it) {
      if (!it || typeof it !== 'object') return null;
      const ps = Array.isArray(it.parts) ? it.parts : [];
      let wSum = 0, wTot = 0;
      for (const p of ps) {
        if (!p) continue;
        const sc = Number(p.score);
        if (!isNaN(sc) && sc > 0) {
          const w = (p.kind === 'movie' || p.format === 'MOVIE') ? 0.35 : (p.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(p.format)) ? 0.15 : 1.0;
          wSum += sc * w;
          wTot += w;
        }
      }
      if (wTot > 0) return Math.round((wSum / wTot) * 10) / 10;
      const d = Number(it.score);
      return (!isNaN(d) && d > 0) ? Math.round(d * 10) / 10 : null;
    }

    async function ensureIndexLoaded() {
      if (indexedItems) return indexedItems;
      if (loadingPromise) return loadingPromise;
      loadingPromise = (async () => {
        const all = [];
        const prevAnime = json('tp_anime_preview');
        const prevMulti = json('tp_multimedia_preview') || {};

        await Promise.all(SECTION_DEFS.map(async sec => {
          try {
            let doc = null;
            const r = await fetch(root + sec.data, { cache: 'no-store' }).catch(() => null);
            if (r && r.ok) doc = await r.json();
            if (sec.id === 'anime' && prevAnime && Array.isArray(prevAnime.anime) && prevAnime.anime.length >= ((doc && doc.anime && doc.anime.length) || 0)) {
              doc = prevAnime;
            } else if (prevMulti[sec.id] && Array.isArray(prevMulti[sec.id].items) && prevMulti[sec.id].items.length > 0 && prevMulti[sec.id].items.length >= ((doc && (doc.items || doc[sec.key]) || []).length)) {
              doc = prevMulti[sec.id];
            }
            const arr = (doc && (doc.items || doc[sec.key] || doc.anime || doc.guides)) || [];
            for (const it of arr) {
              if (!it || !it.title) continue;
              const cats = Array.isArray(it.customGenres) && it.customGenres.length ? it.customGenres : (it.genres || []);
              const sc = sec.isGuide ? null : computeQuickScore(it);
              const extra = it.author || it.director || it.network || it.forumSection || '';
              // [AI-MIMARI-NOTU: ADIM 21]: Sezon/film/yan içerik alt başlıkları (ör. Mugen Train) ve çıkış yılları da arama indeksine eklendi.
              const partNames = Array.isArray(it.parts) ? it.parts.map(p => (p && p.name) || '').filter(Boolean).join(' ') : '';
              const yearStr = it.year || (Array.isArray(it.parts) && it.parts.find(p => p && p.year) ? String(it.parts.find(p => p && p.year).year) : '');
              const hay = `${it.title} ${cats.join(' ')} ${extra} ${it.summary || ''} ${partNames} ${yearStr}`.toLocaleLowerCase('tr');
              all.push({
                id: it.id,
                title: it.title,
                sectionId: sec.id,
                sectionLabel: sec.label,
                sectionPath: sec.path,
                icon: sec.icon,
                isGuide: Boolean(sec.isGuide),
                url: it.url || it.firstSeasonUrl || '',
                image: it.image || '',
                score: sc,
                favorite: Boolean(it.favorite),
                categories: cats.slice(0, 3),
                extra,
                addedAt: it.addedAt || '',
                hay
              });
            }
          } catch (e) {}
        }));

        indexedItems = all;
        return all;
      })();
      return loadingPromise;
    }

    function ensureModalDOM() {
      if (modal) return;
      modal = el('div', 'cmdk-modal');
      modal.hidden = true;
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Evrensel Arama ve Komut Paleti');
      modal.innerHTML = `
        <div class="cmdk-bg"></div>
        <div class="cmdk-card sq">
          <div class="cmdk-top">
            ${icon('search')}
            <input type="search" class="cmdk-inp" placeholder="Anime, rehber, dizi, film, manga, kitap veya komut ara..." autocomplete="off">
            <button type="button" class="cmdk-kbd" data-cmdk-close>ESC</button>
          </div>
          <div class="cmdk-ScopeBar" role="group" aria-label="Bölüm filtresi"></div>
          <div class="cmdk-list" role="listbox"></div>
          <div class="cmdk-foot">
            <span>↑↓ Gezin · Enter Aç · ESC Kapat</span>
            <span id="cmdkCountLbl"></span>
          </div>
        </div>
      `;
      document.body.append(modal);
      inp = modal.querySelector('.cmdk-inp');
      listEl = modal.querySelector('.cmdk-list');
      scopeBar = modal.querySelector('.cmdk-ScopeBar');

      const scopes = [
        ['all', 'Tümü'],
        ['fav', '★ Başyapıt / Öne Çıkan'],
        ['anime', 'Anime'],
        ['guide', 'Rehber'],
        ['series', 'Dizi'],
        ['movie', 'Film'],
        ['manga', 'Manga'],
        ['book', 'Kitap']
      ];
      for (const [val, lbl] of scopes) {
        const b = el('button', 'cmdk-scope-btn', lbl);
        b.type = 'button';
        b.dataset.scope = val;
        b.setAttribute('aria-pressed', val === activeScope);
        b.onclick = () => {
          activeScope = val;
          scopeBar.querySelectorAll('.cmdk-scope-btn').forEach(x => x.setAttribute('aria-pressed', x.dataset.scope === activeScope));
          activeIdx = 0;
          renderResults();
          inp.focus();
        };
        scopeBar.append(b);
      }

      modal.querySelector('.cmdk-bg').onclick = closeCommandPalette;
      modal.querySelector('[data-cmdk-close]').onclick = closeCommandPalette;
      inp.oninput = () => {
        activeIdx = 0;
        renderResults();
      };
      inp.onkeydown = e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentMatches.length) {
            activeIdx = (activeIdx + 1) % currentMatches.length;
            syncActiveHighlight();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentMatches.length) {
            activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
            syncActiveHighlight();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (currentMatches[activeIdx]) {
            triggerResultItem(currentMatches[activeIdx]);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeCommandPalette();
        }
      };
    }

    function syncActiveHighlight() {
      if (!listEl) return;
      const rows = [...listEl.querySelectorAll('.cmdk-item')];
      rows.forEach((r, i) => {
        r.classList.toggle('active', i === activeIdx);
        if (i === activeIdx && typeof r.scrollIntoView === 'function') {
          r.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function triggerResultItem(entry) {
      if (!entry) return;
      if (entry.isCommand && typeof entry.run === 'function') {
        closeCommandPalette();
        entry.run();
        return;
      }
      if (entry.isGuide) {
        closeCommandPalette();
        if (entry.url) {
          window.open(entry.url, '_blank', 'noopener');
        } else {
          location.href = root + entry.sectionPath;
        }
        return;
      }
      closeCommandPalette();
      if (cur === entry.sectionId) {
        // [AI-MIMARI-NOTU: ADIM 21]: Hash zaten hedef yapıma aitse tarayıcı hashchange tetiklemeyebilir; yapay HashChangeEvent ile modal açılışı garantiye alınır.
        const targetHash = '#' + encodeURIComponent(entry.id);
        if (location.hash === targetHash) {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } else {
          location.hash = targetHash;
        }
      } else {
        location.href = `${root}${entry.sectionPath}#${encodeURIComponent(entry.id)}`;
      }
    }

    function renderResults() {
      if (!listEl) return;
      listEl.replaceChildren();
      const q = (inp.value || '').trim().toLocaleLowerCase('tr');
      const all = indexedItems || [];

      const quickCommands = [];
      if (activeScope === 'all' && (!q || 'rastgele seç ne izlesem okusam'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '🎲 Rastgele Bir Yapım / Rehber Öner',
          sub: 'Arşivdeki kayıtlar arasından rastgele birini seçip açar',
          badge: 'Kısayol',
          icon: 'dice',
          run: () => {
            const rndBtn = document.getElementById('randomPickBtn');
            if (rndBtn) {
              rndBtn.click();
            } else if (all.length) {
              const pick = all[Math.floor(Math.random() * all.length)];
              triggerResultItem(pick);
            }
          }
        });
      }
      if (activeScope === 'all' && (!q || 'tema değiştir karanlık açık koyu'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '🌗 Temayı Değiştir (Açık / Koyu)',
          sub: 'Görünüm temasını anında değiştirir',
          badge: 'Komut',
          icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon',
          run: () => window.toggleTheme && window.toggleTheme()
        });
      }
      if (activeScope === 'all' && (!q || 'zaman tüneli yolculuk kronoloji timeline geçmiş'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '⏳ Zaman Tüneline Git',
          sub: 'Yıllara göre izlenen ve okunan yapımların kronolojik akışı',
          badge: 'Sayfa',
          icon: 'clock',
          run: () => { location.href = root + 'zaman-tuneli/'; }
        });
      }
      if (activeScope === 'all' && (!q || 'istatistik grafikler analiz stats rapor'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '📊 Genel İstatistiklere Git',
          sub: 'Tüm kategorilerin arşiv özet ve grafik dağılımları',
          badge: 'Sayfa',
          icon: 'chart',
          run: () => { location.href = root + 'istatistik/'; }
        });
      }

      const matched = all.filter(item => {
        if (activeScope === 'fav' && !item.favorite) return false;
        if (activeScope !== 'all' && activeScope !== 'fav' && item.sectionId !== activeScope) return false;
        if (q && !item.hay.includes(q)) return false;
        return true;
      });

      matched.sort((a, b) => {
        if (q) {
          const aStarts = a.title.toLocaleLowerCase('tr').startsWith(q) ? 1 : 0;
          const bStarts = b.title.toLocaleLowerCase('tr').startsWith(q) ? 1 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;
        }
        return (Number(b.favorite) - Number(a.favorite)) || ((b.score || 0) - (a.score || 0)) || (b.addedAt || '').localeCompare(a.addedAt || '');
      });

      currentMatches = [...quickCommands, ...matched.slice(0, 45)];
      const countLbl = document.getElementById('cmdkCountLbl');
      if (countLbl) countLbl.textContent = `${matched.length} sonuç`;

      if (!currentMatches.length) {
        const empty = el('p', 'note', 'Eşleşen içerik bulunamadı.');
        empty.style.padding = '28px 12px';
        listEl.append(empty);
        return;
      }

      const fr = document.createDocumentFragment();
      currentMatches.forEach((m, idx) => {
        const btn = el('button', 'cmdk-item' + (idx === activeIdx ? ' active' : ''));
        btn.type = 'button';
        if (m.image) {
          const im = el('img', 'cmdk-thumb');
          im.src = resolveAsset(m.image);
          im.alt = '';
          im.loading = 'lazy';
          btn.append(im);
        } else {
          const ic = el('span', 'cmdk-ic');
          ic.innerHTML = icon(m.icon || 'sparkle');
          btn.append(ic);
        }
        const info = el('div', 'cmdk-info');
        const tRow = el('div', 'cmdk-title', m.title);
        info.append(tRow);
        const subParts = m.isCommand
          ? [m.sub]
          : [m.sectionLabel, m.extra, ...(m.categories || [])].filter(Boolean);
        info.append(el('div', 'cmdk-sub', subParts.join(' · ')));
        btn.append(info);

        if (m.favorite) {
          btn.append(el('span', 'cmdk-badge fav', m.isGuide ? '★ Öne Çıkan' : '★ Başyapıt'));
        }
        if (m.score) {
          btn.append(el('span', 'cmdk-badge', '★ ' + m.score));
        } else if (m.badge) {
          btn.append(el('span', 'cmdk-badge', m.badge));
        } else {
          btn.append(el('span', 'cmdk-badge', m.sectionLabel));
        }

        btn.onclick = () => triggerResultItem(m);
        fr.append(btn);
      });
      listEl.append(fr);
    }

    async function openCommandPalette(initialScope = 'all') {
      ensureModalDOM();
      if (initialScope) {
        activeScope = initialScope;
        scopeBar.querySelectorAll('.cmdk-scope-btn').forEach(x => x.setAttribute('aria-pressed', x.dataset.scope === activeScope));
      }
      modal.hidden = false;
      inp.focus();
      inp.select();
      await ensureIndexLoaded();
      renderResults();
    }

    function closeCommandPalette() {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
    }

    window.openCommandPalette = openCommandPalette;

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal && !modal.hidden) closeCommandPalette();
        else openCommandPalette('all');
      } else if (e.key === 'Escape' && modal && !modal.hidden) {
        e.preventDefault();
        closeCommandPalette();
      }
    });
  })();

})();
