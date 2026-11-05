// ============================================================================
// [AI-MIMARI-NOTU: ADIM 1 — KATEGORİ BAZLI ÖZEL İSTATİSTİK MOTORU]
// Bu modül (`assets/js/stats-page.js`), her kategori için (`anime`, `series`, `movie`,
// `book`, `manga`) ilgili JSON verisini okuyarak canlı KPI metriklerini, puan
// dağılım grafiğini, tür/kategori oranlarını, izleme/okuma sürelerini ve en yüksek
// puanlı yapımlardan oluşan "Başyapıtlar & Favoriler Vitrini"ni (Hall of Fame) çizer.
//
// HESAPLAMA PRENSİPLERİ (ADIM 8 & 11 İLE BİREBİR UYUMLU):
// 1. Ağırlıklı Puan: Sezon (1.00), Film (0.35), Yan İçerik (0.15)
// 2. İzlenen Bölüm: Tamamlanan + Devam eden bölümlerin toplamı
// 3. Zaman Hesabı:
//    - Anime: Bölüm başı ~23 dakika
//    - Dizi: Bölüm başı ~45 dakika
//    - Film: Film başı ~110 dakika
//    - Kitap: Sayfa başı ~1.5 dakika
//    - Manga: Bölüm başı ~6 dakika
// ============================================================================

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const SECTION_CONFIGS = {
    anime: {
      id: 'anime',
      title: 'Anime İstatistikleri',
      label: 'Anime',
      icon: '📺',
      navPath: 'anime/istatistik/',
      appPath: 'anime/',
      defaultData: '../../data/anime.json',
      unitItem: 'Anime',
      unitSub: 'Bölüm',
      timePerUnitMin: 23,
      timeVerb: 'İzleme Süresi'
    },
    series: {
      id: 'series',
      title: 'Dizi İstatistikleri',
      label: 'Dizi',
      icon: '🎬',
      navPath: 'dizi/istatistik/',
      appPath: 'dizi/',
      defaultData: '../../data/series.json',
      unitItem: 'Dizi',
      unitSub: 'Bölüm',
      timePerUnitMin: 45,
      timeVerb: 'İzleme Süresi'
    },
    movie: {
      id: 'movie',
      title: 'Film İstatistikleri',
      label: 'Film',
      icon: '🍿',
      navPath: 'film/istatistik/',
      appPath: 'film/',
      defaultData: '../../data/movies.json',
      unitItem: 'Film',
      unitSub: 'Film',
      timePerUnitMin: 110,
      timeVerb: 'İzleme Süresi'
    },
    manga: {
      id: 'manga',
      title: 'Manga İstatistikleri',
      label: 'Manga',
      icon: '📖',
      navPath: 'manga/istatistik/',
      appPath: 'manga/',
      defaultData: '../../data/manga.json',
      unitItem: 'Manga',
      unitSub: 'Bölüm',
      timePerUnitMin: 6,
      timeVerb: 'Okuma Süresi'
    },
    book: {
      id: 'book',
      title: 'Kitap İstatistikleri',
      label: 'Kitap',
      icon: '📚',
      navPath: 'kitap/istatistik/',
      appPath: 'kitap/',
      defaultData: '../../data/books.json',
      unitItem: 'Kitap',
      unitSub: 'Sayfa',
      timePerUnitMin: 1.5,
      timeVerb: 'Okuma Süresi'
    }
  };

  const TIER_COLORS = {
    'S (10)': { color: '#ffb830', dot: '#ffb830', label: 'S (10 Puan)' },
    'A+ (9)': { color: '#b388ff', dot: '#b388ff', label: 'A+ (9 Puan)' },
    'A (8)':  { color: '#5cc8ff', dot: '#5cc8ff', label: 'A (8 Puan)' },
    'B (7)':  { color: '#52e3a4', dot: '#52e3a4', label: 'B (7 Puan)' },
    'C (6)':  { color: '#ff8f3d', dot: '#ff8f3d', label: 'C (6 Puan)' },
    'D (≤5)': { color: '#f87171', dot: '#f87171', label: 'D (≤ 5 Puan)' }
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

  function formatTime(minutes) {
    if (!minutes || minutes <= 0) return { days: 0, hours: 0, text: '0 Saat' };
    const totalHours = Math.round(minutes / 60);
    const days = (minutes / (60 * 24)).toFixed(1);
    if (totalHours < 24) {
      return { days: 0, hours: totalHours, text: `${totalHours} Saat` };
    }
    return { days, hours: totalHours, text: `~${days} Gün (${totalHours.toLocaleString('tr-TR')} Saat)` };
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

  function getTierBucket(score) {
    if (score >= 9.8) return 'S (10)';
    if (score >= 8.8) return 'A+ (9)';
    if (score >= 7.8) return 'A (8)';
    if (score >= 6.8) return 'B (7)';
    if (score >= 5.8) return 'C (6)';
    return 'D (≤5)';
  }

  function renderCategoryNav(currentSection, rootPath = '../../') {
    const nav = document.createElement('nav');
    nav.className = 'stats-nav glass sq';
    nav.setAttribute('aria-label', 'İstatistik Kategorileri');

    const sections = ['anime', 'series', 'movie', 'manga', 'book'];
    nav.innerHTML = sections.map(secKey => {
      const cfg = SECTION_CONFIGS[secKey];
      const isActive = secKey === currentSection;
      const targetUrl = `${rootPath}${cfg.navPath}`;
      return `<a class="stats-nav-item ${isActive ? 'is-active' : ''}" href="${targetUrl}">
        <span aria-hidden="true">${cfg.icon}</span>
        <span>${cfg.label}</span>
      </a>`;
    }).join('');

    return nav;
  }

  async function initStatsPage() {
    const rootPath = document.body.dataset.root || '../../';
    const sectionKey = document.body.dataset.statsSection || document.body.dataset.section || 'anime';
    const cfg = SECTION_CONFIGS[sectionKey] || SECTION_CONFIGS.anime;
    const dataUrl = document.body.dataset.data || `${rootPath}data/${sectionKey === 'series' ? 'series.json' : (sectionKey === 'movie' ? 'movies.json' : (sectionKey === 'book' ? 'books.json' : `${sectionKey}.json`))}`;

    const mount = $('#statsApp');
    if (!mount) return;

    // Üst Navigasyon Sekmeleri
    const navEl = renderCategoryNav(sectionKey, rootPath);
    mount.appendChild(navEl);

    // Hero Başlık
    const heroEl = document.createElement('div');
    heroEl.className = 'stats-hero';
    heroEl.innerHTML = `
      <div class="stats-badge">${cfg.icon} ${cfg.label} ARŞİV ANALİZİ</div>
      <h1>${cfg.title}</h1>
      <p class="sub">Bayram Tempestian kişisel ${cfg.label.toLowerCase()} arşivi puanlama, süre, tür ve durum dağılımı analizi.</p>
    `;
    mount.appendChild(heroEl);

    // Veri Yükleme
    try {
      const res = await fetch(dataUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderDashboard(mount, cfg, data, rootPath);
    } catch (err) {
      console.error('[StatsPage]: Veri yüklenemedi:', err);
      mount.innerHTML += `
        <div class="empty-stats-card glass sq">
          <div class="empty-stats-icon">⚠️</div>
          <h2>Veri Yüklenemedi</h2>
          <p>İstatistik verisi (${dataUrl}) yüklenirken bir sorun oluştu.</p>
          <a class="btn glass" href="${rootPath}${cfg.appPath}">&larr; ${cfg.label} Sayfasına Dön</a>
        </div>
      `;
    }
  }

  function renderDashboard(mount, cfg, data, rootPath) {
    const isAnime = cfg.id === 'anime';
    const items = isAnime ? (Array.isArray(data.anime) ? data.anime : []) : (Array.isArray(data.items) ? data.items : []);
    const statsObj = data.stats || {};

    if (!items.length && (!statsObj.total || statsObj.total === 0)) {
      mount.innerHTML += `
        <div class="empty-stats-card glass sq">
          <div class="empty-stats-icon">${cfg.icon}</div>
          <h2>Henüz Kayıtlı ${cfg.label} Bulunmuyor</h2>
          <p>Bu kategori için henüz arşiv kaydı girilmedi. Yönetim panelinden ilk içeriklerinizi eklediğinizde veya API senkronizasyonu tamamlandığında istatistikleriniz otomatik olarak burada canlanacak.</p>
          <a class="btn glass" href="${rootPath}${cfg.appPath}">&larr; ${cfg.label} Sayfasına Dön</a>
        </div>
      `;
      return;
    }

    // Metrikleri Hesapla
    let totalItems = statsObj.anime || statsObj.total || items.length;
    let totalUnits = 0;
    let favoritesCount = 0;
    let scoredItems = 0;
    let scoreSum = 0;
    const tierCounts = {
      'S (10)': 0,
      'A+ (9)': 0,
      'A (8)': 0,
      'B (7)': 0,
      'C (6)': 0,
      'D (≤5)': 0
    };
    const genresMap = new Map();
    const statusMap = {
      completed: 0,
      watching: 0,
      paused: 0,
      dropped: 0
    };
    const hallOfFame = [];

    // İtems üzerinden geçerek verileri derle
    for (const it of items) {
      const score = resolveItemEffectiveScore(it);
      if (score > 0) {
        scoredItems++;
        scoreSum += score;
        const bucket = getTierBucket(score);
        tierCounts[bucket] = (tierCounts[bucket] || 0) + 1;
      }

      if (it.favorite) {
        favoritesCount++;
      }

      // Hall of Fame: 8.5 üzeri veya favorite olanlar
      if (it.favorite || score >= 8.5) {
        hallOfFame.push({ ...it, effectiveScore: score });
      }

      // Durum
      const st = it.status || 'completed';
      if (st in statusMap) statusMap[st]++;
      else if (st === 'CURRENT' || st === 'reading') statusMap.watching++;

      // Türler
      const gList = Array.isArray(it.customGenres) && it.customGenres.length ? it.customGenres : (Array.isArray(it.genres) ? it.genres : []);
      for (const g of gList) {
        if (!g) continue;
        genresMap.set(g, (genresMap.get(g) || 0) + 1);
      }

      // Alt birim (bölüm, sayfa vs.)
      if (isAnime) {
        if (Array.isArray(it.parts)) {
          for (const p of it.parts) {
            totalUnits += (p.watched || (p.status === 'COMPLETED' ? (p.episodes || 1) : 0));
          }
        }
      } else if (it.episodes || it.pages || it.chapters) {
        totalUnits += (it.pages || it.chapters || it.episodes || 0);
      }
    }

    // Anime JSON stats'ten yedekleme
    if (isAnime && statsObj.episodes) totalUnits = statsObj.completedEpisodes || statsObj.episodes;
    if (isAnime && statsObj.favorites) favoritesCount = statsObj.favorites;
    const avgScore = statsObj.avgScore || (scoredItems > 0 ? (scoreSum / scoredItems).toFixed(1) : 0);

    // Süre Hesabı
    const totalMinutes = totalUnits * cfg.timePerUnitMin;
    const timeInfo = formatTime(totalMinutes);

    // 1. KPI Izgarası
    const kpiEl = document.createElement('div');
    kpiEl.className = 'kpi-grid';
    kpiEl.innerHTML = `
      <div class="kpi-card glass sq" style="--kpi-glow: rgba(10, 127, 209, 0.2)">
        <span class="kpi-icon">${cfg.icon}</span>
        <div>
          <div class="kpi-val">${totalItems.toLocaleString('tr-TR')}<span class="unit">${cfg.unitItem}</span></div>
          <div class="kpi-lbl">Toplam Yapım</div>
          <div class="kpi-sub">${items.length} arşiv kaydı</div>
        </div>
      </div>

      <div class="kpi-card glass sq" style="--kpi-glow: rgba(82, 227, 164, 0.2)">
        <span class="kpi-icon">⏱️</span>
        <div>
          <div class="kpi-val">${totalUnits.toLocaleString('tr-TR')}<span class="unit">${cfg.unitSub}</span></div>
          <div class="kpi-lbl">İlerleme &amp; ${cfg.timeVerb}</div>
          <div class="kpi-sub">${timeInfo.text}</div>
        </div>
      </div>

      <div class="kpi-card glass sq" style="--kpi-glow: rgba(255, 184, 48, 0.2)">
        <span class="kpi-icon">⭐</span>
        <div>
          <div class="kpi-val">${avgScore}<span class="unit">/ 10</span></div>
          <div class="kpi-lbl">Ortalama Puan</div>
          <div class="kpi-sub">${scoredItems} puanlanmış yapım</div>
        </div>
      </div>

      <div class="kpi-card glass sq" style="--kpi-glow: rgba(245, 166, 35, 0.25)">
        <span class="kpi-icon">🏆</span>
        <div>
          <div class="kpi-val">${favoritesCount}<span class="unit">Başyapıt</span></div>
          <div class="kpi-lbl">Favoriler</div>
          <div class="kpi-sub">En yüksek takdir edilenler</div>
        </div>
      </div>
    `;
    mount.appendChild(kpiEl);

    // 2. İki Kolonlu İstatistik Bölümü: Puan Dağılımı & Tür Oranları
    const rowEl = document.createElement('div');
    rowEl.className = 'stats-row';

    // Puan Dağılım Kartı
    const maxScoreCount = Math.max(1, ...Object.values(tierCounts));
    const scoreBarsHtml = Object.entries(TIER_COLORS).map(([tierKey, meta]) => {
      const count = tierCounts[tierKey] || 0;
      const pct = Math.round((count / (scoredItems || 1)) * 100);
      const barPct = Math.round((count / maxScoreCount) * 100);
      return `
        <div class="score-bar-row">
          <div class="score-tier-lbl">
            <span class="dot" style="background:${meta.dot}"></span>
            <span>${tierKey}</span>
          </div>
          <div class="score-bar-track">
            <div class="score-bar-fill" style="width:${barPct}%; background:${meta.color}"></div>
          </div>
          <div class="score-bar-count">${count} <small style="font-weight:normal;opacity:0.65">(%${pct})</small></div>
        </div>
      `;
    }).join('');

    // Türler / Kategoriler Kartı
    let genresList = [];
    if (isAnime && Array.isArray(statsObj.genres) && statsObj.genres.length) {
      genresList = statsObj.genres;
    } else {
      genresList = [...genresMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }
    const topGenres = genresList.slice(0, 15);
    const genrePillsHtml = topGenres.length ? topGenres.map(g => `
      <div class="genre-pill-item">
        <span>${esc(g.name)}</span>
        <span class="genre-pill-count">${g.count}</span>
      </div>
    `).join('') : '<p class="hint">Özel kategori verisi bulunmuyor.</p>';

    rowEl.innerHTML = `
      <div class="stats-panel glass sq">
        <div class="stats-panel-head">
          <h2>🎯 Puan ve Katman (Tier) Dağılımı</h2>
          <span class="hint">${scoredItems} Değerlendirme</span>
        </div>
        <div class="score-dist-list">
          ${scoreBarsHtml}
        </div>
      </div>

      <div class="stats-panel glass sq">
        <div class="stats-panel-head">
          <h2>🏷️ En Çok Yer Alan Türler &amp; Kategoriler</h2>
          <span class="hint">${topGenres.length} Kategori</span>
        </div>
        <div class="genre-pills-list">
          ${genrePillsHtml}
        </div>
      </div>
    `;
    mount.appendChild(rowEl);

    // 3. Durum Dağılımı (Status Distribution)
    const statusRowEl = document.createElement('div');
    statusRowEl.className = 'stats-row';
    const totalStatuses = (statusMap.completed + statusMap.watching + statusMap.paused + statusMap.dropped) || 1;

    statusRowEl.innerHTML = `
      <div class="stats-panel glass sq" style="grid-column: 1 / -1">
        <div class="stats-panel-head">
          <h2>📊 İzleme / Okuma Durumu Özeti</h2>
          <span class="hint">Genel Dağılım</span>
        </div>
        <div class="status-meter-list" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
          <div class="status-meter-item">
            <span class="status-meter-name">✅ Tamamlandı</span>
            <span style="font-weight:700;color:#52e3a4">${statusMap.completed} <small style="opacity:0.7">(%${Math.round((statusMap.completed / totalStatuses) * 100)})</small></span>
          </div>
          <div class="status-meter-item">
            <span class="status-meter-name">▶️ Devam Eden / İzleniyor</span>
            <span style="font-weight:700;color:#5cc8ff">${statusMap.watching} <small style="opacity:0.7">(%${Math.round((statusMap.watching / totalStatuses) * 100)})</small></span>
          </div>
          <div class="status-meter-item">
            <span class="status-meter-name">⏸️ Beklemede</span>
            <span style="font-weight:700;color:#ffb830">${statusMap.paused} <small style="opacity:0.7">(%${Math.round((statusMap.paused / totalStatuses) * 100)})</small></span>
          </div>
          <div class="status-meter-item">
            <span class="status-meter-name">⏹️ Bırakıldı</span>
            <span style="font-weight:700;color:#f87171">${statusMap.dropped} <small style="opacity:0.7">(%${Math.round((statusMap.dropped / totalStatuses) * 100)})</small></span>
          </div>
        </div>
      </div>
    `;
    mount.appendChild(statusRowEl);

    // 4. Hall of Fame (Başyapıtlar & Favoriler Vitrini)
    if (hallOfFame.length) {
      hallOfFame.sort((a, b) => (b.effectiveScore || 0) - (a.effectiveScore || 0));
      const fameSection = document.createElement('section');
      fameSection.className = 'fame-section';
      fameSection.innerHTML = `
        <div class="fame-section-head">
          <h2>⭐ Başyapıtlar &amp; En Yüksek Puanlılar Vitrini</h2>
          <span class="hint">${hallOfFame.length} Özel Yapım</span>
        </div>
        <div class="fame-grid">
          ${hallOfFame.map(item => {
            const targetAppUrl = `${rootPath}${cfg.appPath}#${encodeURIComponent(item.id)}`;
            const cover = item.image
              ? (item.image.startsWith('http') ? item.image.replace('/cover/medium/', '/cover/large/') : (item.image.startsWith('/') ? item.image : rootPath + item.image))
              : `${rootPath}assets/img/icon-512.png`;
            return `
              <a class="fame-card glass sq" href="${targetAppUrl}" data-id="${esc(item.id)}" title="${esc(item.title)}">
                <div class="fame-thumb-box">
                  <img class="fame-thumb" src="${esc(cover)}" alt="${esc(item.title)}" loading="lazy">
                  ${item.effectiveScore ? `<span class="fame-score-badge">★ ${item.effectiveScore}</span>` : ''}
                </div>
                <div class="fame-title">${esc(item.title)}</div>
              </a>
            `;
          }).join('')}
        </div>
      `;
      mount.appendChild(fameSection);

      // In-Place Modal Sheet Engine for Statistics Page
      let sheetEl = null;
      let currentSheetItem = null;
      const sheetItems = hallOfFame;

      function ensureSheet() {
        if (sheetEl) return sheetEl;
        sheetEl = document.createElement('div');
        sheetEl.className = 'sheet';
        sheetEl.hidden = true;
        sheetEl.setAttribute('role', 'dialog');
        sheetEl.setAttribute('aria-modal', 'true');
        sheetEl.setAttribute('aria-labelledby', 'sh-title');
        sheetEl.innerHTML = `
          <div class="sheet-bg"></div>
          <div class="sheet-card glass sq">
            <div class="sheet-backdrop" hidden>
              <img class="sheet-backdrop-img" alt="" decoding="async">
              <div class="sheet-backdrop-grad"></div>
            </div>
            <div class="sheet-head">
              <img class="sheet-cover" alt="" decoding="async">
              <div class="sheet-t">
                <h2 id="sh-title"></h2>
                <p class="sh-sub"></p>
                <p class="sh-genres meta" style="margin-top:4px"></p>
              </div>
              <button class="btn glass" type="button" aria-label="Kapat" data-close>${window.UI && window.UI.icon ? window.UI.icon('close') : '✕'}</button>
            </div>
            <div class="sh-pg" hidden><i></i></div>
            <div class="sh-rating-breakdown" id="shRatingBreakdown" hidden></div>
            <ol class="parts"></ol>
            <div class="sheet-foot-bar">
              <div class="sheet-nav-grp">
                <button type="button" class="sheet-nav-btn" data-sh-prev title="Önceki yapım (←)">← Önceki</button>
                <span class="sheet-pos-lbl" data-sh-pos></span>
                <button type="button" class="sheet-nav-btn" data-sh-next title="Sonraki yapım (→)">Sonraki →</button>
              </div>
              <div class="sheet-act-grp">
                <button type="button" class="sheet-share-btn" data-sh-share title="Bu yapımın doğrudan bağlantısını kopyala">🔗 Bağlantıyı Kopyala</button>
                <a class="sh-al" target="_blank" rel="noopener"></a>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(sheetEl);

        sheetEl.querySelector('.sheet-bg').onclick = closeSheet;
        sheetEl.querySelector('[data-close]').onclick = closeSheet;

        const shareBtn = sheetEl.querySelector('[data-sh-share]');
        if (shareBtn) {
          shareBtn.onclick = () => {
            if (!currentSheetItem) return;
            const url = `${location.origin}${location.pathname}#${encodeURIComponent(currentSheetItem.id)}`;
            navigator.clipboard.writeText(url).then(() => {
              const old = shareBtn.textContent;
              shareBtn.textContent = '✓ Kopyalandı!';
              setTimeout(() => { shareBtn.textContent = old; }, 2000);
            });
          };
        }

        window.addEventListener('keydown', (e) => {
          if (sheetEl.hidden) return;
          if (e.key === 'Escape') {
            closeSheet();
          } else if (e.key === 'ArrowLeft') {
            const prev = sheetEl.querySelector('[data-sh-prev]');
            if (prev && !prev.disabled) prev.click();
          } else if (e.key === 'ArrowRight') {
            const next = sheetEl.querySelector('[data-sh-next]');
            if (next && !next.disabled) next.click();
          }
        });

        return sheetEl;
      }

      function fillSheet(it) {
        const el = ensureSheet();
        const t = s => el.querySelector(s);
        const cardEl = t('.sheet-card');
        const bdEl = t('.sheet-backdrop');
        const bdImg = t('.sheet-backdrop-img');
        const bdUrl = it.banner || it.backdrop || null;
        if (bdUrl) {
          bdEl.hidden = false;
          bdImg.src = bdUrl;
          cardEl.classList.add('has-backdrop');
        } else {
          bdEl.hidden = true;
          bdImg.src = '';
          cardEl.classList.remove('has-backdrop');
        }

        t('#sh-title').textContent = it.title;

        const bits = [];
        if (it.favorite) bits.push('★ Başyapıt');
        const stLabels = { completed: 'İzlendi', watching: 'İzleniyor', paused: 'Beklemede', dropped: 'Bırakıldı', planned: 'İzlenecek' };
        if (it.status) bits.push(stLabels[it.status] || it.status);
        if (it.effectiveScore) bits.push('★ ' + it.effectiveScore);

        const parts = (window.UI && window.UI.parts) ? window.UI.parts(it) : (Array.isArray(it.parts) ? it.parts : []);
        if (parts.length > 1) bits.push(parts.length + ' parça / sezon');
        t('.sh-sub').textContent = bits.join(' · ');

        const gEl = t('.sh-genres');
        const genres = it.genres || it.genre || [];
        if (Array.isArray(genres) && genres.length) {
          gEl.innerHTML = genres.map(g => `<span class="sh-genre-chip">${esc(g)}</span>`).join('');
          gEl.hidden = false;
        } else {
          gEl.hidden = true;
        }

        const coverEl = t('.sheet-cover');
        const coverSrc = it.image
          ? (it.image.startsWith('http') ? itemCover(it.image) : (it.image.startsWith('/') ? it.image : rootPath + it.image))
          : `${rootPath}assets/img/icon-512.png`;
        coverEl.src = coverSrc;
        coverEl.hidden = false;

        const rbEl = t('#shRatingBreakdown');
        if (rbEl && window.TempestianRating) {
          window.TempestianRating.renderSheetBreakdown(rbEl, cfg.id, it, it.effectiveScore);
        }

        const ol = t('.parts');
        ol.replaceChildren();
        const FMT = { TV: 'TV', MOVIE: 'Film', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Özel', MANGA: 'Manga', NOVEL: 'Roman' };
        for (const p of parts) {
          const li = document.createElement('li');
          const isDone = p.status === 'COMPLETED' || (p.watched && p.episodes && p.watched >= p.episodes);
          li.className = 'part ' + (isDone ? 'done' : '');
          const isNumericId = typeof p.id === 'number' || /^\d+$/.test(String(p.id || ''));
          const partUrl = p.url || (cfg.id === 'anime' && isNumericId ? 'https://anilist.co/anime/' + p.id : '');
          li.innerHTML = `
            <span class="pd" aria-hidden="true"></span>
            <div class="pt">
              ${partUrl ? `<a href="${partUrl}" target="_blank" rel="noopener"></a>` : `<span class="pt-name"></span>`}
              <span class="pm"></span>
            </div>
            <span class="ps"></span>
          `;
          const nameNode = li.querySelector('a, .pt-name');
          nameNode.textContent = p.name || it.title;
          if (partUrl && nameNode.tagName === 'A') nameNode.href = partUrl;
          const pmBits = [FMT[p.format] || (p.kind === 'movie' ? 'Film' : ''), p.year, p.episodes && p.episodes > 1 ? p.episodes + ' bölüm' : '', p.score ? '★ ' + p.score : ''].filter(Boolean);
          li.querySelector('.pm').textContent = pmBits.join(' · ');
          li.querySelector('.ps').textContent = isDone ? 'Tamamlandı' : (p.watched ? `${p.watched}/${p.episodes || '?'} bölüm` : '');
          ol.appendChild(li);
        }

        const al = t('.sh-al');
        const extUrl = it.url || (cfg.id === 'anime' && it.anilistId ? 'https://anilist.co/anime/' + it.anilistId : '');
        if (extUrl) {
          al.href = extUrl;
          al.textContent = cfg.id === 'anime' ? "AniList'te aç" : 'Dış Kaynakta Aç';
          al.hidden = false;
        } else {
          al.hidden = true;
        }

        const curIdx = sheetItems.findIndex(x => String(x.id) === String(it.id));
        const prevBtn = t('[data-sh-prev]');
        const nextBtn = t('[data-sh-next]');
        const posLbl = t('[data-sh-pos]');
        if (posLbl) posLbl.textContent = curIdx >= 0 ? `${curIdx + 1} / ${sheetItems.length}` : '';
        if (prevBtn) {
          prevBtn.disabled = curIdx <= 0;
          prevBtn.onclick = () => { if (curIdx > 0) openSheet(sheetItems[curIdx - 1]); };
        }
        if (nextBtn) {
          nextBtn.disabled = curIdx < 0 || curIdx >= sheetItems.length - 1;
          nextBtn.onclick = () => { if (curIdx >= 0 && curIdx < sheetItems.length - 1) openSheet(sheetItems[curIdx + 1]); };
        }

        cardEl.scrollTop = 0;
      }

      function itemCover(img) {
        if (!img) return `${rootPath}assets/img/icon-512.png`;
        if (img.startsWith('http')) return img.replace('/cover/medium/', '/cover/large/');
        return img.startsWith('/') ? img : rootPath + img;
      }

      function openSheet(it) {
        currentSheetItem = it;
        ensureSheet();
        fillSheet(it);
        sheetEl.hidden = false;
        document.body.style.overflow = 'hidden';
        history.replaceState(null, '', location.pathname + location.search + '#' + encodeURIComponent(it.id));
      }

      function closeSheet() {
        if (sheetEl) sheetEl.hidden = true;
        document.body.style.overflow = '';
        currentSheetItem = null;
        history.replaceState(null, '', location.pathname + location.search);
      }

      fameSection.addEventListener('click', (e) => {
        const card = e.target.closest('.fame-card');
        if (!card) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const id = card.dataset.id;
        const target = items.find(x => String(x.id) === String(id)) || hallOfFame.find(x => String(x.id) === String(id));
        if (target) openSheet(target);
      });

      // Initial hash check
      const initialHash = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
      if (initialHash) {
        const target = items.find(x => String(x.id) === initialHash) || hallOfFame.find(x => String(x.id) === initialHash);
        if (target) openSheet(target);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatsPage);
  } else {
    initStatsPage();
  }
})();
