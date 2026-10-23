// ============================================================================
// [AI-MIMARI-NOTU: ADIM 3 — ADMİN PANELİ INSTAGRAM GÖRSEL VE POST ÜRETİCİSİ (CANVAS STUDIO)]
// Bu modül (`assets/js/admin-instagram.js`), yalnızca depo sahibinin (admin) görebildiği
// ve tek tıkla Instagram Story (9:16 — 1080x1920) veya Gönderi (1:1 / 4:5) ölçülerinde
// yüksek çözünürlüklü şık poster kolajları, istatistik özetleri ve Tier List görselleri
// üreten HTML5 Canvas motorudur.
//
// ÖZELLİKLER:
// 1. Dışarıdan ziyaretçilere kapalıdır; yalnızca TOTP yetkili admin panelinde yer alır.
// 2. Anime, Dizi, Film, Kitap ve Manga verilerini okuyarak 3 farklı şablon sunar:
//    - "topPicks": En yüksek puanlı ve favori yapımların afişleri ve puanları
//    - "statsSummary": Kategori KPI'ları + en iyi 3 yapım afişi (Wrapped tarzı)
//    - "tierCollage": S, A+ ve A katmanlarındaki yapımların görsel kolajı
// 3. Görseller yüklenirken CORS gecikmelerine karşı fallback zarif cam kart çizer;
//    asla çökmez veya asılı kalmaz.
// 4. `canvas.toBlob` ile kayıpsız PNG olarak anında yerel diske indirilir.
// ============================================================================

(() => {
  const THEMES = {
    gold: {
      name: 'Altın & Amber',
      accent: '#f5a623',
      glow: 'rgba(245, 166, 35, 0.28)',
      gradient: ['#ffc247', '#d97706'],
      pillBg: 'rgba(245, 166, 35, 0.16)'
    },
    neonBlue: {
      name: 'Neon Mavi',
      accent: '#00a8ff',
      glow: 'rgba(0, 168, 255, 0.28)',
      gradient: ['#5cc8ff', '#0070ba'],
      pillBg: 'rgba(0, 168, 255, 0.16)'
    },
    emerald: {
      name: 'Zümrüt Yeşili',
      accent: '#52e3a4',
      glow: 'rgba(82, 227, 164, 0.28)',
      gradient: ['#75f0ba', '#16a34a'],
      pillBg: 'rgba(82, 227, 164, 0.16)'
    },
    violet: {
      name: 'Büyülü Mor',
      accent: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.28)',
      gradient: ['#c084fc', '#7c3aed'],
      pillBg: 'rgba(168, 85, 247, 0.16)'
    },
    rose: {
      name: 'Canlı Pembe',
      accent: '#f23d8f',
      glow: 'rgba(242, 61, 143, 0.28)',
      gradient: ['#ff70a6', '#be185d'],
      pillBg: 'rgba(242, 61, 143, 0.16)'
    }
  };

  const FORMATS = {
    story:    { width: 1080, height: 1920, label: 'Story (9:16)' },
    square:   { width: 1080, height: 1080, label: 'Kare Gönderi (1:1)' },
    portrait: { width: 1080, height: 1350, label: 'Dikey Gönderi (4:5)' }
  };

  const CATEGORY_FILES = {
    anime:  { file: '../data/anime.json',  label: 'Anime',  key: 'anime' },
    series: { file: '../data/series.json', label: 'Dizi',   key: 'items' },
    movie:  { file: '../data/movies.json', label: 'Film',   key: 'items' },
    manga:  { file: '../data/manga.json',  label: 'Manga',  key: 'items' },
    book:   { file: '../data/books.json',  label: 'Kitap',  key: 'items' }
  };

  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImageWithTimeout(url, timeoutMs = 2500) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;

      const timer = setTimeout(() => {
        if (!done) { done = true; resolve(null); }
      }, timeoutMs);

      img.onload = () => {
        if (!done) { done = true; clearTimeout(timer); resolve(img); }
      };
      img.onerror = () => {
        if (!done) { done = true; clearTimeout(timer); resolve(null); }
      };
      img.src = url;
    });
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

  class InstagramStudio {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.isRendering = false;
      this.cachedData = {};
    }

    init() {
      this.canvas = document.getElementById('instaCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      const renderBtn = document.getElementById('renderInstaBtn');
      const renderBtnSide = document.getElementById('renderInstaBtnSide');
      const downloadBtn = document.getElementById('downloadInstaBtn');
      const catSelect = document.getElementById('instaCategorySelect');
      const fmtSelect = document.getElementById('instaFormatSelect');
      const tplSelect = document.getElementById('instaTemplateSelect');
      const thmSelect = document.getElementById('instaThemeSelect');

      if (renderBtn) renderBtn.onclick = () => this.render();
      if (renderBtnSide) renderBtnSide.onclick = () => this.render();
      if (downloadBtn) downloadBtn.onclick = () => this.download();

      if (catSelect) catSelect.onchange = () => {
        this.updateDefaultTitles();
        this.render();
      };
      if (fmtSelect) fmtSelect.onchange = () => this.render();
      if (tplSelect) tplSelect.onchange = () => this.render();
      if (thmSelect) thmSelect.onchange = () => this.render();

      this.updateDefaultTitles();
      this.render();
    }

    updateDefaultTitles() {
      const catSelect = document.getElementById('instaCategorySelect');
      const titleInp = document.getElementById('instaTitleInput');
      if (!catSelect || !titleInp) return;
      const catKey = catSelect.value || 'anime';
      const catMeta = CATEGORY_FILES[catKey] || CATEGORY_FILES.anime;
      titleInp.value = `BAYRAM TEMPESTIAN · ${catMeta.label.toUpperCase()} ARŞİVİM`;
    }

    async loadCategoryData(catKey) {
      // [AI-MIMARI-NOTU: ADIM 3 — ADMİN CANLI DÜZENLEME DURUMUNU ÖNCELİKLENDİRME]
      // Admin panelinde kaydedilmemiş veya anlık değiştirilmiş puan/başyapıt durumları varsa,
      // doğrudan RAM üzerindeki veriyi alarak Canvas üzerinde anında görselleştirir.
      if (typeof window.getAdminCategoryData === 'function') {
        const live = window.getAdminCategoryData(catKey);
        if (live && Array.isArray(live.items) && live.items.length) {
          return live;
        }
      }
      if (this.cachedData[catKey]) return this.cachedData[catKey];
      const meta = CATEGORY_FILES[catKey] || CATEGORY_FILES.anime;
      try {
        const res = await fetch(meta.file, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const items = Array.isArray(json[meta.key]) ? json[meta.key] : (Array.isArray(json.items) ? json.items : []);
        this.cachedData[catKey] = { items, stats: json.stats || {} };
        return this.cachedData[catKey];
      } catch (err) {
        console.warn('[InstaStudio]: Veri çekilemedi:', err);
        return { items: [], stats: {} };
      }
    }

    async render() {
      if (this.isRendering) return;
      this.isRendering = true;

      const fmtKey = document.getElementById('instaFormatSelect')?.value || 'story';
      const catKey = document.getElementById('instaCategorySelect')?.value || 'anime';
      const tplKey = document.getElementById('instaTemplateSelect')?.value || 'topPicks';
      const thmKey = document.getElementById('instaThemeSelect')?.value || 'gold';
      const customTitle = document.getElementById('instaTitleInput')?.value || 'TEMPESTIAN ARŞİVİ';
      const customSub = document.getElementById('instaSubInput')?.value || 'Kişisel Medya Arşivim ve Seçkilerim · tempestian.github.io';

      const fmt = FORMATS[fmtKey] || FORMATS.story;
      const theme = THEMES[thmKey] || THEMES.gold;
      const { items, stats } = await this.loadCategoryData(catKey);

      this.canvas.width = fmt.width;
      this.canvas.height = fmt.height;
      const ctx = this.ctx;
      const W = fmt.width;
      const H = fmt.height;

      // 1. Zemin (Derin Karanlık Gradyan & Ambient Işık Dalgası)
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#0a0d15');
      bgGrad.addColorStop(0.5, '#0e121d');
      bgGrad.addColorStop(1, '#151928');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Ambient Işık Parıltıları
      const rad1 = ctx.createRadialGradient(W * 0.85, H * 0.15, 20, W * 0.85, H * 0.15, W * 0.65);
      rad1.addColorStop(0, theme.glow);
      rad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rad1;
      ctx.fillRect(0, 0, W, H);

      const rad2 = ctx.createRadialGradient(W * 0.15, H * 0.85, 20, W * 0.15, H * 0.85, W * 0.7);
      rad2.addColorStop(0, 'rgba(10, 127, 209, 0.18)');
      rad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rad2;
      ctx.fillRect(0, 0, W, H);

      // Çevre İnce Cam Çerçeve
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 3;
      roundRect(ctx, 36, 36, W - 72, H - 72, 32);
      ctx.stroke();

      // 2. Üst Marka Rozeti (Pill)
      ctx.save();
      ctx.fillStyle = theme.pillBg;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      roundRect(ctx, W / 2 - 160, 75, 320, 54, 27);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = '700 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦ TEMPESTIAN ARCHIVE ✦', W / 2, 102);
      ctx.restore();

      // 3. Başlık ve Alt Başlık
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 52px system-ui, -apple-system, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 12;
      ctx.fillText(customTitle, W / 2, 185);

      ctx.font = '500 24px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.shadowBlur = 0;
      ctx.fillText(customSub, W / 2, 235);
      ctx.restore();

      // 4. Şablona Göre İçeriği Çiz
      if (tplKey === 'statsSummary') {
        await this.renderStatsSummaryTemplate(ctx, W, H, items, stats, theme, fmtKey);
      } else if (tplKey === 'tierCollage') {
        await this.renderTierCollageTemplate(ctx, W, H, items, theme, fmtKey);
      } else {
        await this.renderTopPicksTemplate(ctx, W, H, items, theme, fmtKey);
      }

      // 5. Alt İmza / Footer
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '600 20px system-ui, -apple-system, sans-serif';
      ctx.fillText('tempestian.github.io · Bayram', W / 2, H - 65);
      ctx.restore();

      this.isRendering = false;
    }

    async renderTopPicksTemplate(ctx, W, H, items, theme, fmtKey) {
      // Puanı veya favori durumu en yüksek yapımları sırala
      const scoredItems = items.map(it => ({ ...it, effScore: resolveItemEffectiveScore(it) }))
        .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.effScore || 0) - (a.effScore || 0));

      const count = fmtKey === 'story' ? 8 : 6;
      const picks = scoredItems.slice(0, count);

      if (!picks.length) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '600 32px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Bu kategoride henüz kayıtlı yapım bulunmuyor.', W / 2, H / 2);
        return;
      }

      const cols = fmtKey === 'story' ? 2 : 3;
      const rows = Math.ceil(picks.length / cols);
      const startY = 280;
      const bottomPadding = 120;
      const availableH = H - startY - bottomPadding;
      const cardGap = 28;
      const cardW = (W - 120 - (cols - 1) * cardGap) / cols;
      const cardH = (availableH - (rows - 1) * cardGap) / rows;

      for (let i = 0; i < picks.length; i++) {
        const it = picks[i];
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = 60 + c * (cardW + cardGap);
        const y = startY + r * (cardH + cardGap);

        // Poster Yükleme
        const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : null;
        const img = imgUrl ? await loadImageWithTimeout(imgUrl, 2000) : null;

        ctx.save();
        roundRect(ctx, x, y, cardW, cardH, 20);
        ctx.clip();

        if (img) {
          ctx.drawImage(img, x, y, cardW, cardH);
        } else {
          // Zarif Zemin ve Yer Tutucu
          const fallbackGrad = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
          fallbackGrad.addColorStop(0, '#1c2235');
          fallbackGrad.addColorStop(1, '#0e121d');
          ctx.fillStyle = fallbackGrad;
          ctx.fillRect(x, y, cardW, cardH);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.font = '700 48px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎬', x + cardW / 2, y + cardH / 2 - 20);
        }

        // Alt Karartma Gradyanı
        const shadowGrad = ctx.createLinearGradient(x, y + cardH * 0.45, x, y + cardH);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(x, y + cardH * 0.45, cardW, cardH * 0.55);

        // Başlık
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 24px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        const titleStr = (it.title || '').length > 24 ? it.title.slice(0, 22) + '...' : it.title;
        ctx.fillText(titleStr, x + 16, y + cardH - 24);

        ctx.restore();

        // Kart Çerçevesi
        ctx.strokeStyle = it.favorite ? theme.accent : 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = it.favorite ? 3 : 1.5;
        roundRect(ctx, x, y, cardW, cardH, 20);
        ctx.stroke();

        // Puan Rozeti
        if (it.effScore || it.favorite) {
          ctx.save();
          const badgeX = x + cardW - 105;
          const badgeY = y + 16;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
          ctx.strokeStyle = theme.accent;
          ctx.lineWidth = 1.5;
          roundRect(ctx, badgeX, badgeY, 90, 36, 18);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = theme.accent;
          ctx.font = '800 18px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`★ ${it.effScore || 'FAV'}`, badgeX + 45, badgeY + 18);
          ctx.restore();
        }
      }
    }

    async renderStatsSummaryTemplate(ctx, W, H, items, stats, theme, fmtKey) {
      const isAnime = Array.isArray(items) && items.some(i => i.parts);
      let totalUnits = stats.completedEpisodes || stats.episodes || 0;
      let scoredCount = 0, scoreSum = 0;
      let favCount = 0;

      for (const it of items) {
        const sc = resolveItemEffectiveScore(it);
        if (sc > 0) { scoredCount++; scoreSum += sc; }
        if (it.favorite) favCount++;
        if (!isAnime && (it.episodes || it.pages || it.chapters)) {
          totalUnits += (it.pages || it.chapters || it.episodes || 0);
        }
      }

      const totalItems = stats.anime || stats.total || items.length;
      const avgScore = stats.avgScore || (scoredCount ? (scoreSum / scoredCount).toFixed(1) : '-');

      // 4 Adet KPI Kartı
      const kpiY = 300;
      const kpiH = fmtKey === 'story' ? 200 : 160;
      const kpiW = (W - 120 - 24) / 2;

      const kpis = [
        { label: 'TOPLAM YAPIM', val: `${totalItems}`, sub: `${items.length} Arşiv Kaydı` },
        { label: 'İLERLEME & SÜRE', val: `${totalUnits.toLocaleString('tr-TR')}`, sub: 'Tamamlanan Birim' },
        { label: 'ORTALAMA PUAN', val: `★ ${avgScore}`, sub: `${scoredCount} Değerlendirme` },
        { label: 'FAVORİLER', val: `${favCount}`, sub: 'Başyapıt Olarak Seçilen' }
      ];

      for (let i = 0; i < 4; i++) {
        const c = i % 2;
        const r = Math.floor(i / 2);
        const kx = 60 + c * (kpiW + 24);
        const ky = kpiY + r * (kpiH + 20);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, kx, ky, kpiW, kpiH, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = '700 18px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(kpis[i].label, kx + 24, ky + 38);

        ctx.fillStyle = theme.accent;
        ctx.font = '800 48px system-ui, sans-serif';
        ctx.fillText(kpis[i].val, kx + 24, ky + 98);

        ctx.fillStyle = '#808898';
        ctx.font = '500 18px system-ui, sans-serif';
        ctx.fillText(kpis[i].sub, kx + 24, ky + 138);
        ctx.restore();
      }

      // Alt Bölüm: En İyi 3 Poster Vitrini
      const top3Y = kpiY + 2 * (kpiH + 20) + 40;
      const top3H = H - top3Y - 120;
      const top3W = (W - 120 - 40) / 3;

      const topPicks = items.map(it => ({ ...it, effScore: resolveItemEffectiveScore(it) }))
        .sort((a, b) => (b.effScore || 0) - (a.effScore || 0))
        .slice(0, 3);

      for (let i = 0; i < topPicks.length; i++) {
        const it = topPicks[i];
        const px = 60 + i * (top3W + 20);
        const py = top3Y;

        const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : null;
        const img = imgUrl ? await loadImageWithTimeout(imgUrl, 2000) : null;

        ctx.save();
        roundRect(ctx, px, py, top3W, top3H, 20);
        ctx.clip();
        if (img) ctx.drawImage(img, px, py, top3W, top3H);
        else {
          ctx.fillStyle = '#1c2235';
          ctx.fillRect(px, py, top3W, top3H);
        }

        const sh = ctx.createLinearGradient(px, py + top3H * 0.5, px, py + top3H);
        sh.addColorStop(0, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = sh;
        ctx.fillRect(px, py + top3H * 0.5, top3W, top3H * 0.5);

        ctx.fillStyle = '#fff';
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText((it.title || '').slice(0, 18), px + 14, py + top3H - 20);
        ctx.restore();

        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2;
        roundRect(ctx, px, py, top3W, top3H, 20);
        ctx.stroke();
      }
    }

    async renderTierCollageTemplate(ctx, W, H, items, theme, fmtKey) {
      // Katman bazlı gruplama
      const tierGroups = { 'S': [], 'A+': [], 'A': [] };
      for (const it of items) {
        const sc = resolveItemEffectiveScore(it);
        if (sc >= 9.8) tierGroups['S'].push(it);
        else if (sc >= 8.8) tierGroups['A+'].push(it);
        else if (sc >= 7.8) tierGroups['A'].push(it);
      }

      const rows = ['S', 'A+', 'A'];
      const tierColors = { 'S': '#ffb830', 'A+': '#b388ff', 'A': '#5cc8ff' };
      const startY = 300;
      const rowGap = 24;
      const availableH = H - startY - 120;
      const rowH = (availableH - 2 * rowGap) / 3;

      for (let r = 0; r < rows.length; r++) {
        const tKey = rows[r];
        const list = tierGroups[tKey].slice(0, 4);
        const ry = startY + r * (rowH + rowGap);

        // Satır Cam Zemini
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, 60, ry, W - 120, rowH, 20);
        ctx.fill();
        ctx.stroke();

        // Katman Rozeti
        const badgeW = 90;
        ctx.fillStyle = tierColors[tKey];
        roundRect(ctx, 60, ry, badgeW, rowH, 20);
        ctx.fill();

        ctx.fillStyle = '#0b0d13';
        ctx.font = '800 36px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tKey, 60 + badgeW / 2, ry + rowH / 2);
        ctx.restore();

        // Mini Afişler
        const posterCount = Math.min(4, list.length);
        const posterAreaX = 60 + badgeW + 20;
        const posterAreaW = (W - 120) - badgeW - 40;
        const pw = (posterAreaW - (posterCount - 1) * 16) / Math.max(1, posterCount);
        const ph = rowH - 24;

        for (let p = 0; p < posterCount; p++) {
          const it = list[p];
          const px = posterAreaX + p * (pw + 16);
          const py = ry + 12;

          const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : null;
          const img = imgUrl ? await loadImageWithTimeout(imgUrl, 2000) : null;

          ctx.save();
          roundRect(ctx, px, py, pw, ph, 12);
          ctx.clip();
          if (img) ctx.drawImage(img, px, py, pw, ph);
          else {
            ctx.fillStyle = '#1c2235';
            ctx.fillRect(px, py, pw, ph);
          }
          ctx.restore();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          roundRect(ctx, px, py, pw, ph, 12);
          ctx.stroke();
        }
      }
    }

    download() {
      if (!this.canvas) return;
      const catKey = document.getElementById('instaCategorySelect')?.value || 'anime';
      const fmtKey = document.getElementById('instaFormatSelect')?.value || 'story';
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `tempestian-${catKey}-${fmtKey}-${dateStr}.png`;

      this.canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.toast) {
          window.toast('✓ Yüksek çözünürlüklü Instagram görseli indirildi!', 'ok');
        }
      }, 'image/png');
    }
  }

  window.AdminInstagram = new InstagramStudio();
})();
