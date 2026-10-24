// ============================================================================
// [AI-MIMARI-NOTU: ADIM 4 — KİŞİSEL İZLEME & OKUMA ZAMAN TÜNELİ (TIMELINE MOTORU)]
// Bu modül (`assets/js/timeline.js`), `data/anime.json`, `data/series.json`, `data/movies.json`,
// `data/manga.json` ve `data/books.json` dosyalarını okuyarak kullanıcının geçmişten bugüne
// medya tüketim geçmişini yıllara ve dönemlere göre dikey zaman çizgisi olarak çizer.
//
// ÖZELLİKLER:
// 1. İki farklı zaman modu sunar:
//    - "added": İzleme / Okuma Tarihine Göre (`addedAt` veya son parça tarihi)
//    - "release": Yapımın Çıkış Yılına Göre (`year`)
// 2. Kategori bazlı filtreleme: Hepsi, Anime, Dizi, Film, Manga, Kitap.
// 3. Tıklanan yapım doğrudan ilgili kategorinin zengin detay modalına (`../anime/#<id>`) yönlendirir.
// ============================================================================

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const CATEGORIES = {
    anime:  { file: '../data/anime.json',  label: 'Anime',  icon: '📺', path: 'anime/', key: 'anime' },
    series: { file: '../data/series.json', label: 'Dizi',   icon: '🎬', path: 'dizi/',  key: 'items' },
    movie:  { file: '../data/movies.json', label: 'Film',   icon: '🍿', path: 'film/',  key: 'items' },
    manga:  { file: '../data/manga.json',  label: 'Manga',  icon: '📖', path: 'manga/', key: 'items' },
    book:   { file: '../data/books.json',  label: 'Kitap',  icon: '📚', path: 'kitap/', key: 'items' }
  };

  const STATUS_LABELS = {
    completed: 'İzlendi / Okundu',
    watching: 'İzleniyor / Okunuyor',
    paused: 'Beklemede',
    dropped: 'Bırakıldı'
  };

  let allMediaItems = [];
  let activeCategory = 'all';
  let activeMode = 'added'; // 'added' veya 'release'

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
  }

  function resolveItemEffectiveScore(item) {
    if (!item) return 0;
    if (Array.isArray(item.parts) && item.parts.length > 0) {
      let sum = 0, weight = 0;
      for (const p of item.parts) {
        const sc = Number(p.score);
        if (!isNaN(sc) && sc > 0) {
          const w = (p.kind === 'movie' || p.format === 'MOVIE') ? 0.35 : (p.kind === 'other' ? 0.15 : 1.0);
          sum += sc * w;
          weight += w;
        }
      }
      if (weight > 0) return Math.round((sum / weight) * 10) / 10;
    }
    const direct = Number(item.score);
    return !isNaN(direct) && direct > 0 ? Math.round(direct * 10) / 10 : 0;
  }

  async function loadAllMedia() {
    const list = [];
    for (const [secKey, meta] of Object.entries(CATEGORIES)) {
      try {
        const res = await fetch(meta.file, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        const rawItems = Array.isArray(data[meta.key]) ? data[meta.key] : (Array.isArray(data.items) ? data.items : []);
        for (const it of rawItems) {
          if (!it || !it.id) continue;
          const score = resolveItemEffectiveScore(it);
          const parts = Array.isArray(it.parts) ? it.parts : [];
          const years = parts.map(p => p.year).filter(Boolean);
          const releaseYear = years.length ? Math.min(...years) : (it.year || null);

          // İzleme / eklenme yılı
          let addedYear = null;
          if (it.addedAt && /^\d{4}/.test(it.addedAt)) {
            addedYear = parseInt(it.addedAt.slice(0, 4), 10);
          } else if (releaseYear) {
            addedYear = releaseYear;
          }

          list.push({
            id: it.id,
            title: it.title || '',
            image: it.image || '',
            score,
            favorite: Boolean(it.favorite),
            status: it.status || 'completed',
            section: secKey,
            sectionMeta: meta,
            partsCount: parts.length,
            addedYear: addedYear || 2026,
            releaseYear: releaseYear || 2024,
            addedAt: it.addedAt || ''
          });
        }
      } catch (e) {
        console.warn(`[Timeline]: ${secKey} yüklenemedi:`, e);
      }
    }
    return list;
  }

  function renderTimeline() {
    const mount = $('#timelineMount');
    if (!mount) return;
    mount.innerHTML = '';

    // Filtreleme
    let filtered = allMediaItems;
    if (activeCategory !== 'all') {
      filtered = filtered.filter(it => it.section === activeCategory);
    }

    if (!filtered.length) {
      mount.innerHTML = `
        <div class="empty-stats-card glass sq" style="margin-top:40px">
          <div class="empty-stats-icon">⏳</div>
          <h2>Bu Filtrede İçerik Bulunamadı</h2>
          <p>Seçili kategoride henüz arşiv kaydı bulunmuyor. Farklı bir filtre seçebilir veya tümünü görüntüleyebilirsiniz.</p>
        </div>
      `;
      return;
    }

    // Yıllara Göre Gruplama
    const yearGroups = new Map();
    for (const it of filtered) {
      const year = activeMode === 'added' ? it.addedYear : it.releaseYear;
      const yKey = year ? String(year) : 'Bilinmeyen';
      if (!yearGroups.has(yKey)) {
        yearGroups.set(yKey, []);
      }
      yearGroups.get(yKey).push(it);
    }

    // Yılları azalan sırada sırala (2026 -> 2025 -> ...)
    const sortedYears = [...yearGroups.keys()].sort((a, b) => {
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      return numB - numA;
    });

    const spine = document.createElement('div');
    spine.className = 'timeline-spine';
    mount.appendChild(spine);

    let globalIndex = 0;

    for (const yStr of sortedYears) {
      const groupItems = yearGroups.get(yStr);
      // Grup içi sıralama: 'added' modunda ay/tarih sırası (Ekim -> Ocak), ardından puan ve favori
      if (activeMode === 'added') {
        groupItems.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.score || 0) - (a.score || 0));
      } else {
        groupItems.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.score || 0) - (a.score || 0));
      }

      const grpEl = document.createElement('div');
      grpEl.className = 'timeline-year-group';

      const hdrEl = document.createElement('div');
      hdrEl.className = 'timeline-year-header';
      hdrEl.innerHTML = `
        <div class="timeline-year-badge">
          <span>${yStr}</span>
          <span class="timeline-year-count">(${groupItems.length} Yapım)</span>
        </div>
      `;
      grpEl.appendChild(hdrEl);

      const listEl = document.createElement('div');
      listEl.className = 'timeline-items-list';

      for (const it of groupItems) {
        const sideClass = globalIndex % 2 === 0 ? 'is-left' : 'is-right';
        const itemEl = document.createElement('div');
        itemEl.className = `timeline-item ${sideClass} ${it.favorite ? 'is-fav' : ''}`;

        // [AI-MIMARI-NOTU: ADIM 4 — GÖRESEL RELATİF PATH DÜZELTMESİ]
        // Alt dizinde ('zaman-tuneli/') çalışan sayfa için yerel resimlerin '../' ile çözülmesi garanti edilir.
        let coverUrl = '../assets/img/icon-512.png';
        if (it.image) {
          if (it.image.startsWith('http')) {
            coverUrl = it.image.replace('/cover/medium/', '/cover/large/');
          } else if (it.image.startsWith('/')) {
            coverUrl = '..' + it.image;
          } else if (it.image.startsWith('../')) {
            coverUrl = it.image;
          } else {
            coverUrl = '../' + it.image;
          }
        }
        const targetUrl = `../${it.sectionMeta.path}#${encodeURIComponent(it.id)}`;
        const statusText = STATUS_LABELS[it.status] || it.status;
        const actionLabel = (it.section === 'book' || it.section === 'manga') ? 'Okuma' : 'İzleme';
        const formattedDate = (window.formatHybridDate ? window.formatHybridDate(it.addedAt) : it.addedAt) || '';
        const dateNote = activeMode === 'added' ? (formattedDate ? `${actionLabel}: ${formattedDate}` : `Dönem: ${it.addedYear}`) : `Çıkış: ${it.releaseYear}`;

        itemEl.innerHTML = `
          <div class="timeline-node-dot" aria-hidden="true"></div>
          <a class="timeline-card glass sq" href="${targetUrl}" title="${esc(it.title)}">
            <img class="timeline-thumb" src="${esc(coverUrl)}" alt="${esc(it.title)}" loading="lazy">
            <div class="timeline-info">
              <div class="timeline-meta-top">
                <span class="timeline-cat-pill">${it.sectionMeta.icon} ${it.sectionMeta.label}</span>
                ${it.score ? `<span class="timeline-score-pill">★ ${it.score}</span>` : ''}
                ${it.favorite ? `<span class="timeline-fav-pill">★ Başyapıt</span>` : ''}
              </div>
              <h3 class="timeline-title">${esc(it.title)}</h3>
              <div class="timeline-sub-txt">${esc(statusText)}</div>
              <div class="timeline-date-lbl">${esc(dateNote)}</div>
            </div>
          </a>
        `;
        listEl.appendChild(itemEl);
        globalIndex++;
      }

      grpEl.appendChild(listEl);
      mount.appendChild(grpEl);
    }
  }

  async function initTimeline() {
    const root = $('#timelineApp');
    if (!root) return;

    allMediaItems = await loadAllMedia();

    // Kontrolleri bağla
    $$('.timeline-cat-btn').forEach(btn => {
      btn.onclick = () => {
        $$('.timeline-cat-btn').forEach(b => b.classList.toggle('is-active', b === btn));
        activeCategory = btn.dataset.cat || 'all';
        renderTimeline();
      };
    });

    $$('.timeline-mode-btn').forEach(btn => {
      btn.onclick = () => {
        $$('.timeline-mode-btn').forEach(b => b.classList.toggle('is-active', b === btn));
        activeMode = btn.dataset.mode || 'added';
        renderTimeline();
      };
    });

    renderTimeline();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeline);
  } else {
    initTimeline();
  }
})();
