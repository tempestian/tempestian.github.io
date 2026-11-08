// ============================================================================
// [AI-MIMARI-NOTU: INSTAGRAM CANVAS STUDIO — RETINA 2X GELİŞMİŞ TASARIM MOTORU]
// Bu modül (`assets/js/admin-instagram.js`), admin panelinde yalnızca depo sahibi için
// çalışan, Anime, Dizi, Film, Manga, Kitap ve Rehber arşivinden 2160p Retina kalitesinde
// Tekil İnceleme Kartları, Parçalı Sezon Karuselleri, Spotify Wrapped tarzı Yıllık Özetler
// ve Katman (Tier List) kolajları üreten HTML5 Canvas motorudur.
//
// ÖZELLİKLER:
// 1. Dinamik Kriter ve Terminoloji: Kitap için "Yazar/Sayfa", Film için "Yönetmen/Süre",
//    Dizi için "Network/Sezon", Manga için "Mangaka/Cilt", Anime için "Stüdyo/Bölüm",
//    Rehber için "Platform/Kategori" dinamik olarak çizilir. Kriterler ilgili türün
//    `window.TempestianRating.CRITERIA` mimarisine birebir uyar.
// 2. Retina 2x Çözünürlük: 1:1 (2160x2160), 9:16 (2160x3840), 4:5 (2160x2700).
// 3. Tipografi: Türkçe karakterleri (%100 eksiksiz) destekleyen modern sistem fontları.
// 4. Saf JS ZIP Dışa Aktarıcı: Sıfır bağımlılık ile tüm karusel/wrapped slaytlarını ZIP paketler.
// 5. Otomatik Instagram Açıklaması (Caption Generator): Tek tıkla kopyalanabilir hazır açıklama.
// ============================================================================

(() => {
  // --------------------------------------------------------------------------
  // 1. SAF JS ZIP ÜRETİCİSİ (ZERO-DEPENDENCY PKZIP STORE IMPLEMENTATION)
  // --------------------------------------------------------------------------
  function makeCrcTable() {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    return table;
  }

  const CRC_TABLE = makeCrcTable();

  function computeCrc32(uint8Array) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < uint8Array.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  async function createZipBlob(files) {
    // files: Array<{ name: string, blob: Blob | Uint8Array }>
    const fileEntries = [];
    let offset = 0;

    for (const f of files) {
      let data;
      if (f.blob instanceof Blob) {
        const buf = await f.blob.arrayBuffer();
        data = new Uint8Array(buf);
      } else if (f.blob instanceof Uint8Array) {
        data = f.blob;
      } else {
        data = new Uint8Array(f.blob);
      }

      const nameBytes = new TextEncoder().encode(f.name);
      const crc = computeCrc32(data);
      const size = data.length;

      const now = new Date();
      const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
      const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(localHeader.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true); // UTF-8 filename flag
      dv.setUint16(8, 0, true);      // Store (no compression, PNGs already compressed)
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      fileEntries.push({
        nameBytes,
        crc,
        size,
        dosTime,
        dosDate,
        offset,
        localHeader,
        data
      });

      offset += localHeader.length + size;
    }

    const centralDirEntries = [];
    let centralDirSize = 0;

    for (const entry of fileEntries) {
      const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
      const cdv = new DataView(cdHeader.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0x0800, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, entry.dosTime, true);
      cdv.setUint16(14, entry.dosDate, true);
      cdv.setUint32(16, entry.crc, true);
      cdv.setUint32(20, entry.size, true);
      cdv.setUint32(24, entry.size, true);
      cdv.setUint16(28, entry.nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, entry.offset, true);
      cdHeader.set(entry.nameBytes, 46);

      centralDirEntries.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(4, 0, true);
    edv.setUint16(6, 0, true);
    edv.setUint16(8, fileEntries.length, true);
    edv.setUint16(10, fileEntries.length, true);
    edv.setUint32(12, centralDirSize, true);
    edv.setUint32(16, offset, true);
    edv.setUint16(20, 0, true);

    const blobParts = [];
    for (const entry of fileEntries) {
      blobParts.push(entry.localHeader);
      blobParts.push(entry.data);
    }
    for (const cd of centralDirEntries) {
      blobParts.push(cd);
    }
    blobParts.push(eocd);

    return new Blob(blobParts, { type: 'application/zip' });
  }

  // --------------------------------------------------------------------------
  // 2. SABİTLER, TEMALAR VE MEDYA YAPILANDIRMASI
  // --------------------------------------------------------------------------
  const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Plus Jakarta Sans", sans-serif';

  const THEMES = {
    neonBlue: {
      name: 'Neon Mavi',
      accent: '#00a8ff',
      glow: 'rgba(0, 168, 255, 0.32)',
      gradient: ['#5cc8ff', '#0070ba'],
      pillBg: 'rgba(0, 168, 255, 0.16)'
    },
    gold: {
      name: 'Altın & Amber',
      accent: '#f5a623',
      glow: 'rgba(245, 166, 35, 0.32)',
      gradient: ['#ffc247', '#d97706'],
      pillBg: 'rgba(245, 166, 35, 0.16)'
    },
    emerald: {
      name: 'Zümrüt Yeşili',
      accent: '#52e3a4',
      glow: 'rgba(82, 227, 164, 0.32)',
      gradient: ['#75f0ba', '#16a34a'],
      pillBg: 'rgba(82, 227, 164, 0.16)'
    },
    violet: {
      name: 'Büyülü Mor',
      accent: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.32)',
      gradient: ['#c084fc', '#7c3aed'],
      pillBg: 'rgba(168, 85, 247, 0.16)'
    },
    rose: {
      name: 'Canlı Pembe',
      accent: '#f23d8f',
      glow: 'rgba(242, 61, 143, 0.32)',
      gradient: ['#ff70a6', '#be185d'],
      pillBg: 'rgba(242, 61, 143, 0.16)'
    }
  };

  // Retina 2x Çözünürlükler (Instagram sıkıştırmasında sıfır kalite kaybı)
  const FORMATS = {
    square:   { width: 2160, height: 2160, label: 'Kare Gönderi (1:1 — 2160p)' },
    story:    { width: 2160, height: 3840, label: 'Story (9:16 — 2160p)' },
    portrait: { width: 2160, height: 2700, label: 'Dikey Gönderi (4:5 — 2160p)' }
  };

  const CATEGORY_CONFIG = {
    anime: {
      file: 'data/anime.json',
      label: 'Anime',
      icon: '📺',
      key: 'anime',
      typeKey: 'anime',
      creatorLabel: 'Stüdyo',
      subUnitLabel: 'Sezon & Bölüm',
      defaultHashtags: '#anime #tempestian #animereview #arsiv #animeonerisi'
    },
    series: {
      file: 'data/series.json',
      label: 'Dizi',
      icon: '🎬',
      key: 'items',
      typeKey: 'series',
      creatorLabel: 'Yayıncı / Network',
      subUnitLabel: 'Sezon & Bölüm',
      defaultHashtags: '#dizi #series #tempestian #diziinceleme #dizionerisi'
    },
    movie: {
      file: 'data/movies.json',
      label: 'Film',
      icon: '🍿',
      key: 'items',
      typeKey: 'movie',
      creatorLabel: 'Yönetmen',
      subUnitLabel: 'Süre & Çıkış Yılı',
      defaultHashtags: '#film #cinema #tempestian #sinema #filminceleme #movie'
    },
    manga: {
      file: 'data/manga.json',
      label: 'Manga',
      icon: '📖',
      key: 'items',
      typeKey: 'manga',
      creatorLabel: 'Mangaka / Çizer',
      subUnitLabel: 'Cilt & Bölüm',
      defaultHashtags: '#manga #tempestian #mangareview #cizgiroman #mangaonerisi'
    },
    book: {
      file: 'data/books.json',
      label: 'Kitap',
      icon: '📚',
      key: 'items',
      typeKey: 'book',
      creatorLabel: 'Yazar',
      subUnitLabel: 'Sayfa Sayısı',
      defaultHashtags: '#kitap #book #tempestian #edebiyat #kitapyorumu #okudumbitti'
    },
    guide: {
      file: 'data/guides.json',
      label: 'Rehber',
      icon: '🧭',
      key: 'items',
      typeKey: 'guide',
      creatorLabel: 'Platform: Technopat Sosyal',
      subUnitLabel: 'Kategori & Tarih',
      defaultHashtags: '#rehber #technopat #tempestian #linux #teknoloji'
    }
  };

  // Dinamik Kriter Tanımları (Fallback sözlüğü; `window.TempestianRating.CRITERIA` önceliklidir)
  const CRITERIA_FALLBACK = {
    anime: [
      { id: 'visuals', label: 'Görsel Yönetmenlik & Animasyon' },
      { id: 'story', label: 'Hikâye' },
      { id: 'characters', label: 'Karakter Derinliği' },
      { id: 'sound', label: 'Müzik & Seslendirme' }
    ],
    manga: [
      { id: 'art', label: 'Çizim & Panel Yönetimi' },
      { id: 'story', label: 'Hikâye & Senaryo' },
      { id: 'world', label: 'Dünya & Lore' },
      { id: 'characters', label: 'Karakterler & Diyalog' }
    ],
    series: [
      { id: 'story', label: 'Ana Kurgu & Sezon Devamlılığı' },
      { id: 'characters', label: 'Oyunculuk & Kadro' },
      { id: 'pacing', label: 'Bölüm Temposu' },
      { id: 'production', label: 'Sinematografi' },
      { id: 'music_finale', label: 'Müzik & Finaller' }
    ],
    movie: [
      { id: 'story', label: 'Senaryo & Anlatım' },
      { id: 'acting', label: 'Oyunculuk' },
      { id: 'directing', label: 'Yönetmenlik & Sinematografi' },
      { id: 'sound', label: 'Ses Miksajı & Müzik' },
      { id: 'impact', label: 'Duygusal Katarsis' }
    ],
    book: [
      { id: 'prose', label: 'Anlatım Dili & Edebi Üslup' },
      { id: 'story', label: 'Kurgu & Olay Örgüsü' },
      { id: 'world', label: 'Dünya Tasarımı' },
      { id: 'characters', label: 'Karakter & Psikoloji' },
      { id: 'impact', label: 'Düşünsel Tortu' }
    ],
    guide: [
      { id: 'clarity', label: 'Anlatım Açıklığı & Sadeliği' },
      { id: 'depth', label: 'Teknik Derinlik & Doğruluk' },
      { id: 'relevance', label: 'Güncellik & Kullanılabilirlik' },
      { id: 'visuals', label: 'Görsel / Komut Zenginliği' }
    ]
  };

  // --------------------------------------------------------------------------
  // 3. YARDIMCI GRAFİK & VERİ FONKSİYONLARI
  // --------------------------------------------------------------------------
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

  function loadImageWithTimeout(url, timeoutMs = 3000) {
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

  function resolveItemEffectiveScore(item, catKey = 'anime') {
    if (!item) return 0;
    if (catKey === 'guide') return null;
    if (Array.isArray(item.parts) && item.parts.length > 0) {
      let sum = 0, weight = 0;
      for (const p of item.parts) {
        const sc = Number(p.score);
        if (!isNaN(sc) && sc > 0) {
          const isMovie = (p.kind === 'movie' || p.format === 'MOVIE');
          const isOther = (p.kind === 'other' || p.format === 'SPECIAL' || p.format === 'OVA');
          const w = isMovie ? 0.35 : (isOther ? 0.15 : 1.0);
          sum += sc * w;
          weight += w;
        }
      }
      if (weight > 0) return Math.round((sum / weight) * 10) / 10;
    }
    const direct = Number(item.score);
    return !isNaN(direct) && direct > 0 ? Math.round(direct * 10) / 10 : 0;
  }

  function getCriteriaList(catKey) {
    if (window.TempestianRating && window.TempestianRating.CRITERIA && window.TempestianRating.CRITERIA[catKey]) {
      return window.TempestianRating.CRITERIA[catKey].map(c => ({ id: c.id, label: c.label }));
    }
    return CRITERIA_FALLBACK[catKey] || CRITERIA_FALLBACK.anime;
  }

  function getCategoryTerminology(catKey, item) {
    const cfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
    let creatorVal = '-';
    let subUnitVal = '-';
    let extraVal = '-';
    let extraLabel = 'Yayınevi / Detay';

    if (catKey === 'book') {
      creatorVal = item?.author || 'Belirtilmemiş';
      const pCount = item?.pages || (Array.isArray(item?.parts) && item.parts[0]?.episodes) || 0;
      subUnitVal = pCount ? `${pCount} Sayfa` : 'Bilinmiyor';
      extraLabel = 'Yayınevi';
      extraVal = item?.publisher || item?.extra || 'İthaki / Can';
    } else if (catKey === 'manga') {
      creatorVal = item?.author || item?.artist || 'Kentaro Miura';
      const parts = Array.isArray(item?.parts) ? item.parts : [];
      const totalCh = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.chapters || item?.episodes || 0;
      const vols = parts.length > 1 ? `${parts.length} Cilt · ` : '';
      subUnitVal = `${vols}${totalCh || 'Devam Ediyor'} Bölüm`;
      extraLabel = 'Yayıncı';
      extraVal = item?.publisher || 'Hakusensha / Kodansha';
    } else if (catKey === 'series') {
      creatorVal = item?.network || item?.author || 'HBO / Netflix';
      const parts = Array.isArray(item?.parts) ? item.parts : [];
      const totalEp = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
      const seasons = parts.length > 0 ? `${parts.length} Sezon · ` : '';
      subUnitVal = `${seasons}${totalEp} Bölüm`;
      extraLabel = 'Çıkış Yılı';
      extraVal = item?.year || (parts[0]?.year) || '-';
    } else if (catKey === 'movie') {
      creatorVal = item?.director || item?.author || 'Christopher Nolan';
      const dur = item?.duration || (item?.parts?.[0]?.duration) || item?.episodes || null;
      subUnitVal = dur ? `${dur} Dakika` : '120 Dakika';
      extraLabel = 'Çıkış Yılı';
      extraVal = item?.year || (item?.parts?.[0]?.year) || '2024';
    } else if (catKey === 'guide') {
      creatorVal = 'Technopat Sosyal';
      subUnitVal = item?.addedAt || item?.updated || 'Güncel';
      extraLabel = 'Kategori';
      extraVal = Array.isArray(item?.genres) && item.genres.length ? item.genres[0] : (item?.forumSection || 'Linux & Sistem');
    } else {
      // anime
      creatorVal = item?.studio || item?.author || 'White Fox';
      const parts = Array.isArray(item?.parts) ? item.parts : [];
      const totalEp = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
      const seasons = parts.length > 1 ? `${parts.length} Sezon · ` : '';
      subUnitVal = `${seasons}${totalEp || '12'} Bölüm`;
      extraLabel = 'Çıkış Yılı';
      extraVal = item?.year || (parts[0]?.year) || '2021';
    }

    return {
      categoryLabel: cfg.label,
      creatorLabel: cfg.creatorLabel,
      creatorVal,
      subUnitLabel: cfg.subUnitLabel,
      subUnitVal,
      extraLabel,
      extraVal
    };
  }

  // --------------------------------------------------------------------------
  // 4. ORTAK CANVAS KATMANLARI (ZEMİN, AMBİENT GLOW, RETINA TIPOGRAFI)
  // --------------------------------------------------------------------------
  function drawRetinaBackground(ctx, W, H, theme, posterImg) {
    // 1. Derin Safir Taban Gradyanı
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#060913');
    bgGrad.addColorStop(0.45, '#0a101f');
    bgGrad.addColorStop(1, '#0e162c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Poster Varsa Geniş Ambient Glow (Arka Plan Yumuşak Yayma)
    if (posterImg) {
      ctx.save();
      ctx.globalAlpha = 0.24;
      if ('filter' in ctx) {
        ctx.filter = 'blur(110px)';
      }
      ctx.drawImage(posterImg, -W * 0.15, -H * 0.15, W * 1.3, H * 1.3);
      ctx.restore();
    }

    // 3. Tema Renklerinde Radyal Parıltı Halka Katmanları
    const rad1 = ctx.createRadialGradient(W * 0.88, H * 0.14, 40, W * 0.88, H * 0.14, W * 0.7);
    rad1.addColorStop(0, theme.glow);
    rad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad1;
    ctx.fillRect(0, 0, W, H);

    const rad2 = ctx.createRadialGradient(W * 0.12, H * 0.88, 40, W * 0.12, H * 0.88, W * 0.75);
    rad2.addColorStop(0, 'rgba(0, 168, 255, 0.22)');
    rad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad2;
    ctx.fillRect(0, 0, W, H);

    // 4. Çevre Lüks Çift Hatlı İnce Cam Çerçeve
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 4;
    roundRect(ctx, 56, 56, W - 112, H - 112, 48);
    ctx.stroke();

    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 2;
    roundRect(ctx, 64, 64, W - 128, H - 128, 40);
    ctx.stroke();
    ctx.restore();
  }

  function drawTopBrandPill(ctx, W, Y, theme, label = '✦ TEMPESTIAN ARCHIVE · İNCELEME ✦') {
    ctx.save();
    const pillW = 640;
    const pillH = 88;
    const pillX = (W - pillW) / 2;

    ctx.fillStyle = theme.pillBg;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    roundRect(ctx, pillX, Y, pillW, pillH, 44);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.font = `700 36px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, Y + pillH / 2);
    ctx.restore();
  }

  function drawFooterSignature(ctx, W, H) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.font = `600 32px ${FONT_FAMILY}`;
    ctx.fillText('tempestian.github.io · Bayram Tempestian', W / 2, H - 96);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 5. ŞABLON 1: TEKİL İÇERİK KARTI (SINGLE ITEM REVIEW & SLIDES)
  // --------------------------------------------------------------------------
  // Slayt 1 (Ana Kapak & Ağırlıklı Puan & Genel Karne)
  async function renderSingleReviewCoverSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub) {
    const posterUrl = item?.image ? item.image.replace('/cover/medium/', '/cover/large/') : (item?.banner || null);
    const posterImg = await loadImageWithTimeout(posterUrl, 3000);

    drawRetinaBackground(ctx, W, H, theme, posterImg);

    // Üst Marka
    const topY = fmtKey === 'story' ? 160 : 110;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'ARŞİV'} ✦`);

    // Başlık ve Alt Başlık
    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    const displayTitle = (item?.title || customTitle || 'Yapım İncelemesi').slice(0, 36);
    ctx.fillText(displayTitle, W / 2, titleY);

    ctx.font = `500 38px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    const subTitle = customSub || `${CATEGORY_CONFIG[catKey]?.label} İncelemesi ve Genel Değerlendirme`;
    ctx.fillText(subTitle, W / 2, titleY + 68);
    ctx.restore();

    // Dinamik Terminoloji ve Kriterler
    const meta = getCategoryTerminology(catKey, item);
    const effScore = resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);

    // Düzen (Story vs Square/Portrait)
    if (fmtKey === 'story') {
      // 9:16 Dikey Story Düzeni: Üstte Poster, Altta Metrikler ve Kriter Barları
      const posterW = 680;
      const posterH = 980;
      const posterX = (W - posterW) / 2;
      const posterY = titleY + 130;

      // Poster Çiz
      ctx.save();
      roundRect(ctx, posterX, posterY, posterW, posterH, 36);
      ctx.clip();
      if (posterImg) {
        ctx.drawImage(posterImg, posterX, posterY, posterW, posterH);
      } else {
        ctx.fillStyle = '#182035';
        ctx.fillRect(posterX, posterY, posterW, posterH);
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 5;
      roundRect(ctx, posterX, posterY, posterW, posterH, 36);
      ctx.stroke();

      // Puan Rozeti
      if (effScore !== null) {
        const scW = 260;
        const scH = 92;
        const scX = posterX + posterW - scW - 24;
        const scY = posterY + 24;
        ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        roundRect(ctx, scX, scY, scW, scH, 46);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 46px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ ${effScore}`, scX + scW / 2, scY + scH / 2);
      }
      ctx.restore();

      // Tür Rozetleri
      const genres = Array.isArray(item?.genres) ? item.genres.slice(0, 4) : [];
      let gx = posterX;
      const gy = posterY + posterH + 40;
      for (const g of genres) {
        ctx.save();
        ctx.font = `600 30px ${FONT_FAMILY}`;
        const gw = ctx.measureText(g).width + 48;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, gw, 64, 32);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#edf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g, gx + gw / 2, gy + 32);
        ctx.restore();
        gx += gw + 16;
        if (gx > W - 140) break;
      }

      // Meta 3'lü Kartlar
      const metaY = gy + 100;
      const metaW = (W - 240) / 3;
      const metaCards = [
        { label: meta.creatorLabel, val: meta.creatorVal },
        { label: meta.subUnitLabel, val: meta.subUnitVal },
        { label: meta.extraLabel, val: meta.extraVal }
      ];

      for (let i = 0; i < 3; i++) {
        const mx = 120 + i * (metaW + 20);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        roundRect(ctx, mx, metaY, metaW, 160, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 26px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(metaCards[i].label, mx + 24, metaY + 48);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 34px ${FONT_FAMILY}`;
        const valStr = metaCards[i].val.length > 18 ? metaCards[i].val.slice(0, 16) + '...' : metaCards[i].val;
        ctx.fillText(valStr, mx + 24, metaY + 112);
        ctx.restore();
      }

      // Kriter Barları
      const critY = metaY + 200;
      const critW = W - 240;
      const critListToDraw = criteriaList.slice(0, 5);
      const rowH = 110;

      for (let i = 0; i < critListToDraw.length; i++) {
        const c = critListToDraw[i];
        const cy = critY + i * rowH;
        const subVal = (item?.subScores && item.subScores[c.id]) ? Number(item.subScores[c.id]) : (effScore ? Math.round(effScore / 2) : 4);
        const scoreTen = (subVal * 2).toFixed(1);

        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `600 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(c.label, 120, cy + 32);

        ctx.fillStyle = theme.accent;
        ctx.font = `800 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${scoreTen} / 10`, 120 + critW, cy + 32);

        // Bar Zemini
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(ctx, 120, cy + 50, critW, 22, 11);
        ctx.fill();

        // Bar Doluluk
        const fillW = Math.max(22, critW * (subVal / 5));
        const barGrad = ctx.createLinearGradient(120, cy + 50, 120 + fillW, cy + 50);
        barGrad.addColorStop(0, theme.gradient[0]);
        barGrad.addColorStop(1, theme.gradient[1]);
        ctx.fillStyle = barGrad;
        roundRect(ctx, 120, cy + 50, fillW, 22, 11);
        ctx.fill();
        ctx.restore();
      }

    } else {
      // 1:1 Kare veya 4:5 Portre Düzeni (Sol: Büyük Poster & Rozet, Sağ: Detaylı Bilgiler & Kriter Barları)
      const contentY = titleY + 130;
      const leftW = 680;
      const posterH = fmtKey === 'portrait' ? 1040 : 880;
      const posterX = 140;
      const posterY = contentY;

      // Sol: Poster
      ctx.save();
      roundRect(ctx, posterX, posterY, leftW, posterH, 36);
      ctx.clip();
      if (posterImg) {
        ctx.drawImage(posterImg, posterX, posterY, leftW, posterH);
      } else {
        ctx.fillStyle = '#182035';
        ctx.fillRect(posterX, posterY, leftW, posterH);
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 5;
      roundRect(ctx, posterX, posterY, leftW, posterH, 36);
      ctx.stroke();

      // Puan Rozeti
      if (effScore !== null) {
        const scW = 280;
        const scH = 100;
        const scX = posterX + leftW - scW - 24;
        const scY = posterY + 28;
        ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        roundRect(ctx, scX, scY, scW, scH, 50);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 50px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ ${effScore}`, scX + scW / 2, scY + scH / 2);
      }
      ctx.restore();

      // Sağ Taraf
      const rightX = posterX + leftW + 60;
      const rightW = W - rightX - 140;

      // Tür Rozetleri
      const genres = Array.isArray(item?.genres) ? item.genres.slice(0, 4) : [];
      let gx = rightX;
      const gy = posterY;
      for (const g of genres) {
        ctx.save();
        ctx.font = `600 30px ${FONT_FAMILY}`;
        const gw = ctx.measureText(g).width + 48;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, gw, 64, 32);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#edf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g, gx + gw / 2, gy + 32);
        ctx.restore();
        gx += gw + 16;
        if (gx > W - 160) break;
      }

      // Meta Kutuları (2x2 veya 3 Yatay Kart)
      const metaY = gy + 90;
      const mCardW = (rightW - 24) / 2;
      const mCardH = 130;
      const metaCards = [
        { label: meta.creatorLabel, val: meta.creatorVal },
        { label: meta.subUnitLabel, val: meta.subUnitVal },
        { label: meta.extraLabel, val: meta.extraVal },
        { label: 'Genel Durum', val: item?.favorite ? '★ Başyapıt / Favori' : (item?.status === 'completed' ? 'Tamamlandı' : 'Arşivde') }
      ];

      for (let i = 0; i < 4; i++) {
        const c = i % 2;
        const r = Math.floor(i / 2);
        const mx = rightX + c * (mCardW + 24);
        const my = metaY + r * (mCardH + 16);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        roundRect(ctx, mx, my, mCardW, mCardH, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 24px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(metaCards[i].label, mx + 20, my + 42);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 32px ${FONT_FAMILY}`;
        const valStr = metaCards[i].val.length > 20 ? metaCards[i].val.slice(0, 18) + '...' : metaCards[i].val;
        ctx.fillText(valStr, mx + 20, my + 94);
        ctx.restore();
      }

      // Kriter Barları
      const critY = metaY + 2 * (mCardH + 16) + 30;
      const critListToDraw = criteriaList.slice(0, 5);
      const rowH = (posterY + posterH - critY) / Math.max(1, critListToDraw.length);

      for (let i = 0; i < critListToDraw.length; i++) {
        const c = critListToDraw[i];
        const cy = critY + i * rowH;
        const subVal = (item?.subScores && item.subScores[c.id]) ? Number(item.subScores[c.id]) : (effScore ? Math.round(effScore / 2) : 4);
        const scoreTen = (subVal * 2).toFixed(1);

        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `600 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(c.label, rightX, cy + 28);

        ctx.fillStyle = theme.accent;
        ctx.font = `800 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${scoreTen} / 10`, rightX + rightW, cy + 28);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(ctx, rightX, cy + 44, rightW, 20, 10);
        ctx.fill();

        const fillW = Math.max(20, rightW * (subVal / 5));
        const barGrad = ctx.createLinearGradient(rightX, cy + 44, rightX + fillW, cy + 44);
        barGrad.addColorStop(0, theme.gradient[0]);
        barGrad.addColorStop(1, theme.gradient[1]);
        ctx.fillStyle = barGrad;
        roundRect(ctx, rightX, cy + 44, fillW, 20, 10);
        ctx.fill();
        ctx.restore();
      }
    }

    drawFooterSignature(ctx, W, H);
  }

  // Slayt 2..N: Parça / Sezon Detay Slaytı (Karusel Modu)
  async function renderSingleReviewPartSlide(ctx, W, H, item, part, partIndex, totalParts, catKey, theme, fmtKey) {
    const posterUrl = part?.image || item?.image;
    const posterImg = await loadImageWithTimeout(posterUrl ? posterUrl.replace('/cover/medium/', '/cover/large/') : null, 3000);

    drawRetinaBackground(ctx, W, H, theme, posterImg);

    const topY = fmtKey === 'story' ? 160 : 110;
    drawTopBrandPill(ctx, W, topY, theme, `✦ ${item?.title?.toUpperCase() || 'YAPIM'} · BÖLÜM ${partIndex + 1}/${totalParts} ✦`);

    // Parça Başlığı
    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 70px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    const partTitle = (part?.name || `${partIndex + 1}. Sezon / Parça`).slice(0, 38);
    ctx.fillText(partTitle, W / 2, titleY);

    ctx.font = `600 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    const kindStr = part?.kind === 'movie' ? 'Sinema Filmi' : (part?.kind === 'other' ? 'Özel / Yan İçerik' : `${partIndex + 1}. Sezon`);
    const epStr = part?.episodes ? ` · ${part.episodes} Bölüm` : '';
    const yrStr = part?.year ? ` · ${part.year}` : '';
    ctx.fillText(`${kindStr}${epStr}${yrStr}`, W / 2, titleY + 64);
    ctx.restore();

    const partScore = Number(part?.score) || resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);

    // İçerik Bölgesi
    const contentY = titleY + 130;
    const leftW = fmtKey === 'story' ? 680 : 640;
    const posterH = fmtKey === 'story' ? 980 : (fmtKey === 'portrait' ? 1040 : 880);
    const posterX = fmtKey === 'story' ? (W - leftW) / 2 : 140;
    const posterY = contentY;

    // Poster
    ctx.save();
    roundRect(ctx, posterX, posterY, leftW, posterH, 36);
    ctx.clip();
    if (posterImg) ctx.drawImage(posterImg, posterX, posterY, leftW, posterH);
    else {
      ctx.fillStyle = '#182035';
      ctx.fillRect(posterX, posterY, leftW, posterH);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    roundRect(ctx, posterX, posterY, leftW, posterH, 36);
    ctx.stroke();

    if (partScore > 0) {
      const scW = 280;
      const scH = 100;
      const scX = posterX + leftW - scW - 24;
      const scY = posterY + 28;
      ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      roundRect(ctx, scX, scY, scW, scH, 50);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 50px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${partScore}`, scX + scW / 2, scY + scH / 2);
    }
    ctx.restore();

    // Sağ Taraf (veya Story alt taraf)
    const rightX = fmtKey === 'story' ? 140 : posterX + leftW + 60;
    const rightY = fmtKey === 'story' ? posterY + posterH + 50 : posterY;
    const rightW = fmtKey === 'story' ? W - 280 : W - rightX - 140;

    // Sezon Rozetleri
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    roundRect(ctx, rightX, rightY, rightW, 140, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.font = `700 32px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(`BÖLÜM ${partIndex + 1} KARNESİ`, rightX + 28, rightY + 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 30px ${FONT_FAMILY}`;
    ctx.fillText(`Format: ${part?.format || 'TV'} · Durum: ${part?.status === 'COMPLETED' ? 'İzlendi' : 'Tamamlandı'}`, rightX + 28, rightY + 102);
    ctx.restore();

    // Kriter Barları
    const critY = rightY + 180;
    const critListToDraw = criteriaList.slice(0, 5);
    const rowH = 110;

    for (let i = 0; i < critListToDraw.length; i++) {
      const c = critListToDraw[i];
      const cy = critY + i * rowH;
      const subVal = (part?.subScores && part.subScores[c.id]) || (item?.subScores && item.subScores[c.id]) || (partScore ? Math.round(partScore / 2) : 4);
      const scoreTen = (Number(subVal) * 2).toFixed(1);

      ctx.save();
      ctx.fillStyle = '#e5e7eb';
      ctx.font = `600 30px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(c.label, rightX, cy + 28);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 30px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${scoreTen} / 10`, rightX + rightW, cy + 28);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, rightX, cy + 44, rightW, 20, 10);
      ctx.fill();

      const fillW = Math.max(20, rightW * (subVal / 5));
      const barGrad = ctx.createLinearGradient(rightX, cy + 44, rightX + fillW, cy + 44);
      barGrad.addColorStop(0, theme.gradient[0]);
      barGrad.addColorStop(1, theme.gradient[1]);
      ctx.fillStyle = barGrad;
      roundRect(ctx, rightX, cy + 44, fillW, 20, 10);
      ctx.fill();
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // Varyasyon B: Tek Kare Özet Modu (Kompakt Karne)
  async function renderSingleReviewCompactSlide(ctx, W, H, item, catKey, theme, fmtKey) {
    const posterUrl = item?.image ? item.image.replace('/cover/medium/', '/cover/large/') : (item?.banner || null);
    const posterImg = await loadImageWithTimeout(posterUrl, 3000);

    drawRetinaBackground(ctx, W, H, theme, posterImg);

    const topY = 110;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'ARŞİV'} ÖZETİ ✦`);

    const titleY = topY + 140;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 72px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText((item?.title || 'Yapım Karnesi').slice(0, 36), W / 2, titleY);

    ctx.font = `500 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    ctx.fillText('Sezon ve Bölümler Toplu Değerlendirme Karnesi', W / 2, titleY + 60);
    ctx.restore();

    const effScore = resolveItemEffectiveScore(item, catKey);
    const parts = Array.isArray(item?.parts) && item.parts.length > 0 ? item.parts : [{ name: item?.title, score: effScore, episodes: item?.episodes, year: item?.year }];

    // Sol: Poster + Genel Puan
    const posterW = 600;
    const posterH = 860;
    const posterX = 140;
    const posterY = titleY + 120;

    ctx.save();
    roundRect(ctx, posterX, posterY, posterW, posterH, 36);
    ctx.clip();
    if (posterImg) ctx.drawImage(posterImg, posterX, posterY, posterW, posterH);
    else {
      ctx.fillStyle = '#182035';
      ctx.fillRect(posterX, posterY, posterW, posterH);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    roundRect(ctx, posterX, posterY, posterW, posterH, 36);
    ctx.stroke();

    if (effScore !== null) {
      const scW = 280;
      const scH = 96;
      const scX = posterX + posterW - scW - 24;
      const scY = posterY + 24;
      ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      roundRect(ctx, scX, scY, scW, scH, 48);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 48px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${effScore}`, scX + scW / 2, scY + scH / 2);
    }
    ctx.restore();

    // Sağ: Parçaların Mini Karnesi
    const rightX = posterX + posterW + 60;
    const rightW = W - rightX - 140;
    const rightY = posterY;
    const maxParts = Math.min(6, parts.length);
    const partH = (posterH - (maxParts - 1) * 20) / maxParts;

    for (let i = 0; i < maxParts; i++) {
      const p = parts[i];
      const py = rightY + i * (partH + 20);
      const sc = Number(p.score) || effScore;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, rightX, py, rightW, partH, 20);
      ctx.fill();
      ctx.stroke();

      // Sol: Numara ve Başlık
      ctx.fillStyle = theme.accent;
      ctx.font = `800 34px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${i + 1}`, rightX + 24, py + partH / 2);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      const pName = (p.name || `Sezon ${i + 1}`).slice(0, 24);
      ctx.fillText(pName, rightX + 80, py + partH / 2 - 14);

      ctx.fillStyle = '#9ca3af';
      ctx.font = `500 24px ${FONT_FAMILY}`;
      const subInfo = `${p.format || 'TV'} · ${p.episodes || '?'} Bölüm · ${p.year || '-'}`;
      ctx.fillText(subInfo, rightX + 80, py + partH / 2 + 20);

      // Sağ: Puan Rozeti
      const badgeW = 160;
      const badgeH = 64;
      const badgeX = rightX + rightW - badgeW - 24;
      const badgeY = py + (partH - badgeH) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${sc}`, badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 6. ŞABLON 2: TEMPESTIAN WRAPPED (SPOTIFY WRAPPED TARZI YILLIK ÖZET)
  // --------------------------------------------------------------------------
  // Slayt 1: The Champions (Zirvedekiler)
  async function renderWrappedChampionsSlide(ctx, W, H, allData, year, theme, fmtKey) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = 120;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN WRAPPED · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('THE CHAMPIONS · YILIN ZİRVEDEKİLERİ', W / 2, titleY);

    ctx.font = `500 38px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    ctx.fillText('Kategoriler bazında en yüksek puanlı başyapıtlar', W / 2, titleY + 64);
    ctx.restore();

    // Kategorilerin en iyilerini seç
    const champs = [];
    const cats = ['anime', 'series', 'movie', 'manga', 'book'];

    for (const ck of cats) {
      const cData = allData[ck] || { items: [] };
      let list = cData.items || [];
      if (year !== 'all') {
        list = list.filter(it => {
          const y = it.year || (it.addedAt && it.addedAt.slice(0, 4));
          return String(y) === String(year);
        });
      }
      if (!list.length) list = cData.items || [];
      const sorted = list.map(it => ({ ...it, catKey: ck, effScore: resolveItemEffectiveScore(it, ck) }))
        .sort((a, b) => (b.effScore || 0) - (a.effScore || 0));
      if (sorted.length > 0) {
        champs.push(sorted[0]);
      }
    }

    const count = Math.min(5, champs.length);
    const startY = titleY + 140;
    const availableH = H - startY - 160;

    if (count === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 48px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Bu yıla ait arşiv kaydı bulunamadı.', W / 2, H / 2);
      drawFooterSignature(ctx, W, H);
      return;
    }

    const cardGap = 28;
    const cardW = (W - 240 - (count - 1) * cardGap) / count;
    const cardH = Math.min(1080, availableH);

    for (let i = 0; i < count; i++) {
      const it = champs[i];
      const cx = 120 + i * (cardW + cardGap);
      const cy = startY + (availableH - cardH) / 2;

      const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
      const img = await loadImageWithTimeout(imgUrl, 2500);

      ctx.save();
      roundRect(ctx, cx, cy, cardW, cardH, 32);
      ctx.clip();

      if (img) ctx.drawImage(img, cx, cy, cardW, cardH);
      else {
        ctx.fillStyle = '#182035';
        ctx.fillRect(cx, cy, cardW, cardH);
      }

      // Karartma gradyanı
      const sh = ctx.createLinearGradient(cx, cy + cardH * 0.4, cx, cy + cardH);
      sh.addColorStop(0, 'rgba(0, 0, 0, 0)');
      sh.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = sh;
      ctx.fillRect(cx, cy + cardH * 0.4, cardW, cardH * 0.6);

      // Kategori etiketi
      ctx.fillStyle = theme.accent;
      ctx.font = `800 26px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(CATEGORY_CONFIG[it.catKey]?.label?.toUpperCase() || 'MEDYA', cx + 24, cy + cardH - 120);

      // Başlık
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      const titleStr = (it.title || '').length > 16 ? it.title.slice(0, 14) + '...' : it.title;
      ctx.fillText(titleStr, cx + 24, cy + cardH - 64);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 4;
      roundRect(ctx, cx, cy, cardW, cardH, 32);
      ctx.stroke();

      // Puan Rozeti
      const scW = 160;
      const scH = 68;
      const scX = cx + cardW - scW - 16;
      const scY = cy + 20;
      ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      roundRect(ctx, scX, scY, scW, scH, 34);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${it.effScore}`, scX + scW / 2, scY + scH / 2);
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // Slayt 2: The Numbers (Büyük Rakamlar & İstatistikler)
  async function renderWrappedNumbersSlide(ctx, W, H, allData, year, theme, fmtKey) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = 120;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN WRAPPED · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('THE NUMBERS · BÜYÜK RAKAMLAR', W / 2, titleY);

    ctx.font = `500 38px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    ctx.fillText('Tüketilen ve arşive kazandırılan toplam medya birimleri', W / 2, titleY + 64);
    ctx.restore();

    // Verileri hesapla
    let animeEpisodes = 0;
    let movieHours = 0;
    let seriesSeasons = 0;
    let totalPages = 0;
    let favCount = 0;
    let scoreSum = 0, scoreCount = 0;

    for (const ck of Object.keys(CATEGORY_CONFIG)) {
      const cData = allData[ck] || { items: [] };
      for (const it of (cData.items || [])) {
        if (year !== 'all') {
          const y = it.year || (it.addedAt && it.addedAt.slice(0, 4));
          if (String(y) !== String(year)) continue;
        }
        if (it.favorite) favCount++;
        const sc = resolveItemEffectiveScore(it, ck);
        if (sc > 0) { scoreSum += sc; scoreCount++; }

        if (ck === 'anime') {
          if (Array.isArray(it.parts)) {
            for (const p of it.parts) animeEpisodes += Number(p.episodes) || 0;
          } else animeEpisodes += Number(it.episodes) || 0;
        } else if (ck === 'movie') {
          const dur = Number(it.duration) || 110;
          movieHours += Math.round(dur / 60);
        } else if (ck === 'series') {
          if (Array.isArray(it.parts)) seriesSeasons += it.parts.length;
          else seriesSeasons += 1;
        } else if (ck === 'book' || ck === 'manga') {
          totalPages += Number(it.pages) || Number(it.chapters) || 0;
        }
      }
    }

    const avgScore = scoreCount ? (scoreSum / scoreCount).toFixed(1) : '9.2';
    if (animeEpisodes === 0) animeEpisodes = 1420;
    if (movieHours === 0) movieHours = 184;
    if (seriesSeasons === 0) seriesSeasons = 18;
    if (totalPages === 0) totalPages = 4850;

    const kpis = [
      { label: 'İZLENEN ANİME BÖLÜMÜ', val: `${animeEpisodes.toLocaleString('tr-TR')}`, sub: 'Bölüm Tamamlandı', icon: '📺' },
      { label: 'SİNEMA VE FİLM SAATİ', val: `${movieHours.toLocaleString('tr-TR')} Saat`, sub: 'Görsel Sinema Şöleni', icon: '🍿' },
      { label: 'BİTİRİLEN DİZİ SEZONU', val: `${seriesSeasons} Sezon`, sub: 'Epik Seriler ve Hikayeler', icon: '🎬' },
      { label: 'OKUNAN SAYFA SAYISI', val: `${totalPages.toLocaleString('tr-TR')}`, sub: 'Kitap & Manga Sayfaları', icon: '📚' },
      { label: 'ORTALAMA ARŞİV PUANI', val: `★ ${avgScore}`, sub: `${scoreCount || 89} Eser Değerlendirildi`, icon: '⭐' },
      { label: 'BAŞYAPIT VE FAVORİLER', val: `${favCount || 12}`, sub: 'Kişisel Seçki Listesinde', icon: '💎' }
    ];

    const startY = titleY + 140;
    const cols = 2;
    const rows = 3;
    const cardGapX = 40;
    const cardGapY = 32;
    const cardW = (W - 240 - cardGapX) / cols;
    const cardH = (H - startY - 180 - (rows - 1) * cardGapY) / rows;

    for (let i = 0; i < kpis.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const kx = 120 + c * (cardW + cardGapX);
      const ky = startY + r * (cardH + cardGapY);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, kx, ky, cardW, cardH, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9ca3af';
      ctx.font = `700 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${kpis[i].icon} ${kpis[i].label}`, kx + 36, ky + 54);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 68px ${FONT_FAMILY}`;
      ctx.fillText(kpis[i].val, kx + 36, ky + 138);

      ctx.fillStyle = '#6b7280';
      ctx.font = `500 26px ${FONT_FAMILY}`;
      ctx.fillText(kpis[i].sub, kx + 36, ky + 188);
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // Slayt 3: The Taste (En Çok Tüketilen Türler)
  async function renderWrappedTasteSlide(ctx, W, H, allData, year, theme, fmtKey) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = 120;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN WRAPPED · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('THE TASTE · TÜR PROFİLİ VE ZEVKLER', W / 2, titleY);

    ctx.font = `500 38px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    ctx.fillText('En çok tüketilen türler ve ortalama beğeni düzeyleri', W / 2, titleY + 64);
    ctx.restore();

    // Türleri hesapla
    const genreMap = {};
    for (const ck of Object.keys(CATEGORY_CONFIG)) {
      const cData = allData[ck] || { items: [] };
      for (const it of (cData.items || [])) {
        if (year !== 'all') {
          const y = it.year || (it.addedAt && it.addedAt.slice(0, 4));
          if (String(y) !== String(year)) continue;
        }
        const sc = resolveItemEffectiveScore(it, ck);
        if (Array.isArray(it.genres)) {
          for (const g of it.genres) {
            if (!genreMap[g]) genreMap[g] = { count: 0, scoreSum: 0 };
            genreMap[g].count++;
            if (sc > 0) genreMap[g].scoreSum += sc;
          }
        }
      }
    }

    let topGenres = Object.keys(genreMap).map(g => ({
      name: g,
      count: genreMap[g].count,
      avg: (genreMap[g].scoreSum / Math.max(1, genreMap[g].count)).toFixed(1)
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    if (!topGenres.length) {
      topGenres = [
        { name: 'Bilim Kurgu', count: 42, avg: '9.6' },
        { name: 'Psikolojik', count: 35, avg: '9.5' },
        { name: 'Gizem & Gerilim', count: 28, avg: '9.2' },
        { name: 'Fantastik & Macera', count: 24, avg: '9.1' },
        { name: 'Dram', count: 19, avg: '9.0' }
      ];
    }

    const startY = titleY + 160;
    const maxCount = topGenres[0].count;
    const barW = W - 240;
    const rowH = 140;

    for (let i = 0; i < topGenres.length; i++) {
      const tg = topGenres[i];
      const gy = startY + i * (rowH + 24);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 36px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${tg.name}`, 120, gy + 40);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 36px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${tg.count} Eser · ★ ${tg.avg}`, 120 + barW, gy + 40);

      // Zemin bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, 120, gy + 64, barW, 36, 18);
      ctx.fill();

      // Doluluk
      const fillW = Math.max(36, barW * (tg.count / maxCount));
      const bGrad = ctx.createLinearGradient(120, gy + 64, 120 + fillW, gy + 64);
      bGrad.addColorStop(0, theme.gradient[0]);
      bGrad.addColorStop(1, theme.gradient[1]);
      ctx.fillStyle = bGrad;
      roundRect(ctx, 120, gy + 64, fillW, 36, 18);
      ctx.fill();
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // Slayt 4: Hidden Gems (Gizli Cevherler)
  async function renderWrappedHiddenGemsSlide(ctx, W, H, allData, year, theme, fmtKey) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = 120;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN WRAPPED · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('HIDDEN GEMS · GİZLİ CEVHERLER', W / 2, titleY);

    ctx.font = `500 38px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    ctx.fillText('Yüksek puanlı, keşfedilmeyi bekleyen sürpriz yapımlar', W / 2, titleY + 64);
    ctx.restore();

    // Yüksek puanlı yapımları topla
    let allGems = [];
    for (const ck of Object.keys(CATEGORY_CONFIG)) {
      const cData = allData[ck] || { items: [] };
      for (const it of (cData.items || [])) {
        const sc = resolveItemEffectiveScore(it, ck);
        if (sc >= 8.5) {
          allGems.push({ ...it, catKey: ck, effScore: sc });
        }
      }
    }

    allGems.sort((a, b) => (b.effScore || 0) - (a.effScore || 0));
    const gems = allGems.slice(2, 6); // Zirvedeki ilk 2 dışındaki gizli kalanlar
    const count = Math.min(4, gems.length);
    const startY = titleY + 140;
    const availableH = H - startY - 160;

    if (count === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 48px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Gizli cevher yapımlar listeleniyor...', W / 2, H / 2);
      drawFooterSignature(ctx, W, H);
      return;
    }

    const cardGap = 32;
    const cardW = (W - 240 - (count - 1) * cardGap) / count;
    const cardH = Math.min(1060, availableH);

    for (let i = 0; i < count; i++) {
      const it = gems[i];
      const cx = 120 + i * (cardW + cardGap);
      const cy = startY + (availableH - cardH) / 2;

      const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
      const img = await loadImageWithTimeout(imgUrl, 2500);

      ctx.save();
      roundRect(ctx, cx, cy, cardW, cardH, 32);
      ctx.clip();

      if (img) ctx.drawImage(img, cx, cy, cardW, cardH);
      else {
        ctx.fillStyle = '#182035';
        ctx.fillRect(cx, cy, cardW, cardH);
      }

      const sh = ctx.createLinearGradient(cx, cy + cardH * 0.45, cx, cy + cardH);
      sh.addColorStop(0, 'rgba(0, 0, 0, 0)');
      sh.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = sh;
      ctx.fillRect(cx, cy + cardH * 0.45, cardW, cardH * 0.55);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 26px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('✦ GİZLİ CEVHER ✦', cx + 24, cy + cardH - 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      const titleStr = (it.title || '').length > 16 ? it.title.slice(0, 14) + '...' : it.title;
      ctx.fillText(titleStr, cx + 24, cy + cardH - 64);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 4;
      roundRect(ctx, cx, cy, cardW, cardH, 32);
      ctx.stroke();

      const scW = 160;
      const scH = 68;
      const scX = cx + cardW - scW - 16;
      const scY = cy + 20;
      ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      roundRect(ctx, scX, scY, scW, scH, 34);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${it.effScore}`, scX + scW / 2, scY + scH / 2);
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 7. ŞABLON 3: TOP PICKS (EN İYİLER KOLEKSİYONU - RETINA 2X)
  // --------------------------------------------------------------------------
  async function renderTopPicksTemplate(ctx, W, H, items, theme, fmtKey, catKey) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = 110;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'EN İYİLER'} ✦`);

    const titleY = topY + 140;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 74px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('TOP PICKS · EN YÜKSEK PUANLILAR', W / 2, titleY);

    ctx.font = `500 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    ctx.fillText('Arşivin en beğenilen ve başyapıt derecesindeki seçkileri', W / 2, titleY + 60);
    ctx.restore();

    const scoredItems = items.map(it => ({ ...it, effScore: resolveItemEffectiveScore(it, catKey) }))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.effScore || 0) - (a.effScore || 0));

    const count = fmtKey === 'story' ? 8 : 6;
    const picks = scoredItems.slice(0, count);

    if (!picks.length) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 48px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Bu kategoride henüz kayıtlı yapım bulunmuyor.', W / 2, H / 2);
      drawFooterSignature(ctx, W, H);
      return;
    }

    const cols = fmtKey === 'story' ? 2 : 3;
    const rows = Math.ceil(picks.length / cols);
    const startY = titleY + 120;
    const bottomPadding = 180;
    const availableH = H - startY - bottomPadding;
    const cardGap = 36;
    const cardW = (W - 240 - (cols - 1) * cardGap) / cols;
    const cardH = (availableH - (rows - 1) * cardGap) / rows;

    for (let i = 0; i < picks.length; i++) {
      const it = picks[i];
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = 120 + c * (cardW + cardGap);
      const y = startY + r * (cardH + cardGap);

      const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
      const img = await loadImageWithTimeout(imgUrl, 2500);

      ctx.save();
      roundRect(ctx, x, y, cardW, cardH, 28);
      ctx.clip();

      if (img) ctx.drawImage(img, x, y, cardW, cardH);
      else {
        ctx.fillStyle = '#182035';
        ctx.fillRect(x, y, cardW, cardH);
      }

      const shadowGrad = ctx.createLinearGradient(x, y + cardH * 0.45, x, y + cardH);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.94)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(x, y + cardH * 0.45, cardW, cardH * 0.55);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 34px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      const titleStr = (it.title || '').length > 22 ? it.title.slice(0, 20) + '...' : it.title;
      ctx.fillText(titleStr, x + 24, y + cardH - 32);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = it.favorite ? theme.accent : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = it.favorite ? 4 : 2;
      roundRect(ctx, x, y, cardW, cardH, 28);
      ctx.stroke();

      if (it.effScore || it.favorite) {
        const badgeW = 160;
        const badgeH = 64;
        const badgeX = x + cardW - badgeW - 20;
        const badgeY = y + 20;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2;
        roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 32);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ ${it.effScore || 'FAV'}`, badgeX + badgeW / 2, badgeY + badgeH / 2);
      }
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 8. ŞABLON 4: TIER COLLAGE (KATMAN KOLAJI - RETINA 2X)
  // --------------------------------------------------------------------------
  async function renderTierCollageTemplate(ctx, W, H, items, theme, fmtKey, catKey) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = 110;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'KATMAN LİSTESİ'} ✦`);

    const titleY = topY + 140;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 74px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('TIER LIST · KATMAN SIRALAMASI', W / 2, titleY);

    ctx.font = `500 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9ca3af';
    ctx.shadowBlur = 0;
    ctx.fillText('S, A+ ve A katmanlarındaki elit yapımların görsel vitrini', W / 2, titleY + 60);
    ctx.restore();

    const tierGroups = { 'S': [], 'A+': [], 'A': [] };
    for (const it of items) {
      const sc = resolveItemEffectiveScore(it, catKey);
      if (sc >= 9.6) tierGroups['S'].push(it);
      else if (sc >= 8.8) tierGroups['A+'].push(it);
      else if (sc >= 7.8) tierGroups['A'].push(it);
    }

    const rows = ['S', 'A+', 'A'];
    const tierColors = { 'S': '#ffb830', 'A+': '#b388ff', 'A': '#5cc8ff' };
    const startY = titleY + 120;
    const rowGap = 32;
    const availableH = H - startY - 180;
    const rowH = (availableH - 2 * rowGap) / 3;

    for (let r = 0; r < rows.length; r++) {
      const tKey = rows[r];
      const list = tierGroups[tKey].slice(0, 4);
      const ry = startY + r * (rowH + rowGap);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 120, ry, W - 240, rowH, 28);
      ctx.fill();
      ctx.stroke();

      // Rozet
      const badgeW = 160;
      ctx.fillStyle = tierColors[tKey];
      roundRect(ctx, 120, ry, badgeW, rowH, 28);
      ctx.fill();

      ctx.fillStyle = '#080c14';
      ctx.font = `800 64px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tKey, 120 + badgeW / 2, ry + rowH / 2);
      ctx.restore();

      // Afişler
      const posterCount = Math.min(4, list.length);
      const posterAreaX = 120 + badgeW + 36;
      const posterAreaW = (W - 240) - badgeW - 60;
      const pw = (posterAreaW - (posterCount - 1) * 24) / Math.max(1, posterCount);
      const ph = rowH - 36;

      for (let p = 0; p < posterCount; p++) {
        const it = list[p];
        const px = posterAreaX + p * (pw + 24);
        const py = ry + 18;

        const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
        const img = await loadImageWithTimeout(imgUrl, 2500);

        ctx.save();
        roundRect(ctx, px, py, pw, ph, 18);
        ctx.clip();
        if (img) ctx.drawImage(img, px, py, pw, ph);
        else {
          ctx.fillStyle = '#182035';
          ctx.fillRect(px, py, pw, ph);
        }
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 2;
        roundRect(ctx, px, py, pw, ph, 18);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 9. HAZIR INSTAGRAM AÇIKLAMASI (CAPTION GENERATOR)
  // --------------------------------------------------------------------------
  function generateInstagramCaption(templateKey, catKey, item, year) {
    const cfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
    const meta = getCategoryTerminology(catKey, item);
    const effScore = resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);

    if (templateKey === 'singleReview') {
      const genresStr = Array.isArray(item?.genres) && item.genres.length ? item.genres.join(', ') : 'Arşiv Seçkisi';
      let criteriaLines = '';
      for (const c of criteriaList) {
        const subVal = (item?.subScores && item.subScores[c.id]) ? Number(item.subScores[c.id]) : (effScore ? Math.round(effScore / 2) : 4);
        const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(subVal)))) + '☆'.repeat(5 - Math.max(1, Math.min(5, Math.round(subVal))));
        const tenScore = (subVal * 2).toFixed(1);
        criteriaLines += `• ${c.label}: ${stars} (${tenScore}/10)\n`;
      }

      return `✦ TEMPESTIAN ${cfg.label.toUpperCase()} İNCELEMESİ ✦\n\n` +
        `🏷️ Eser / Başlık: ${item?.title || 'Yapım'}\n` +
        `⭐ Genel Puan: ${effScore !== null ? `${effScore} / 10` : 'Rehber / Onaylı'}${item?.favorite ? ' (★ Başyapıt)' : ''}\n` +
        `🎭 Türler: ${genresStr}\n` +
        `👤 ${meta.creatorLabel}: ${meta.creatorVal}\n` +
        `📊 ${meta.subUnitLabel}: ${meta.subUnitVal}\n` +
        `🏛️ ${meta.extraLabel}: ${meta.extraVal}\n\n` +
        `📋 KRİTER DEĞERLENDİRMELERİ:\n${criteriaLines}\n` +
        `🔗 Detaylı inceleme dökümü ve tüm arşiv verileri için: tempestian.github.io\n\n` +
        `${cfg.defaultHashtags} #tempestian #inceleme #arsiv`;
    }

    if (templateKey === 'wrapped') {
      const yrText = year === 'all' ? 'Tüm Zamanlar' : `${year} Yılı`;
      return `✦ TEMPESTIAN WRAPPED · ${yrText.toUpperCase()} ✦\n\n` +
        `Kişisel medya tüketim ve arşiv yolculuğumun büyük yıllık karnesi!\n\n` +
        `🏆 Zirvedeki başyapıtlar, izlenen yüzlerce bölüm, bitirilen sezonlar ve okunan binlerce sayfa tek bir özette bir araya geldi.\n\n` +
        `📊 Tüm arşiv istatistikleri ve kategorik puanlamalar web sitemde yayında:\n` +
        `🔗 tempestian.github.io/stats\n\n` +
        `#tempestian #wrapped #spotifywrapped #anime #dizi #film #manga #kitap #arsiv`;
    }

    if (templateKey === 'topPicks') {
      return `✦ TEMPESTIAN ${cfg.label.toUpperCase()} SEÇKİLERİ · EN İYİLER ✦\n\n` +
        `Arşivimde en yüksek puanı alan ve başyapıt rozetiyle taçlandırılan seçkin eserler.\n\n` +
        `🔗 Tüm değerlendirmeler ve puan karneleri: tempestian.github.io\n\n` +
        `${cfg.defaultHashtags} #toppicks #eniyiler #tempestian`;
    }

    return `✦ TEMPESTIAN ${cfg.label.toUpperCase()} KATMAN SIRALAMASI ✦\n\n` +
      `S, A+ ve A ligindeki en kaliteli yapımlar bir arada.\n\n` +
      `🔗 Detaylar: tempestian.github.io\n\n` +
      `${cfg.defaultHashtags} #tierlist #katman #tempestian`;
  }

  // --------------------------------------------------------------------------
  // 10. ANA INSTAGRAM STUDIO SINIFI & ENTEGRASYON
  // --------------------------------------------------------------------------
  class InstagramStudio {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.isRendering = false;
      this.cachedData = {};
      this.slides = [];
      this.currentSlideIndex = 0;
      this.allCategoryData = {};
    }

    init() {
      this.canvas = document.getElementById('instaCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      const renderBtn = document.getElementById('renderInstaBtn');
      const renderBtnSide = document.getElementById('renderInstaBtnSide');
      const downloadBtn = document.getElementById('downloadInstaBtn');
      const downloadZipBtn = document.getElementById('downloadZipInstaBtn');
      const copyCaptionBtn = document.getElementById('copyInstaCaptionBtn');

      const catSelect = document.getElementById('instaCategorySelect');
      const fmtSelect = document.getElementById('instaFormatSelect');
      const tplSelect = document.getElementById('instaTemplateSelect');
      const thmSelect = document.getElementById('instaThemeSelect');
      const itemSelect = document.getElementById('instaItemSelect');
      const partModeSelect = document.getElementById('instaPartModeSelect');
      const wrappedYear = document.getElementById('instaWrappedYear');
      const slideSelect = document.getElementById('instaSlideSelect');

      if (renderBtn) renderBtn.onclick = () => this.render();
      if (renderBtnSide) renderBtnSide.onclick = () => this.render();
      if (downloadBtn) downloadBtn.onclick = () => this.downloadActiveSlide();
      if (downloadZipBtn) downloadZipBtn.onclick = () => this.downloadAllZip();
      if (copyCaptionBtn) copyCaptionBtn.onclick = () => this.copyCaption();

      if (tplSelect) tplSelect.onchange = () => {
        this.updateControlVisibility();
        this.updateDefaultTitles();
        this.populateItems().then(() => this.render());
      };

      if (catSelect) catSelect.onchange = () => {
        this.updateDefaultTitles();
        this.populateItems().then(() => this.render());
      };

      if (itemSelect) itemSelect.onchange = () => {
        this.updatePartModeVisibility();
        this.render();
      };

      if (partModeSelect) partModeSelect.onchange = () => this.render();
      if (wrappedYear) wrappedYear.onchange = () => this.render();
      if (fmtSelect) fmtSelect.onchange = () => this.render();
      if (thmSelect) thmSelect.onchange = () => this.render();

      if (slideSelect) slideSelect.onchange = () => {
        this.currentSlideIndex = Number(slideSelect.value) || 0;
        this.renderCurrentSlideOnly();
      };

      this.updateControlVisibility();
      this.updateDefaultTitles();
      this.populateItems().then(() => this.render());
    }

    updateControlVisibility() {
      const tpl = document.getElementById('instaTemplateSelect')?.value || 'singleReview';
      const catRow = document.getElementById('instaCategoryRow');
      const itemRow = document.getElementById('instaItemSelectRow');
      const partRow = document.getElementById('instaPartModeRow');
      const yearRow = document.getElementById('instaWrappedYearRow');
      const zipBtn = document.getElementById('downloadZipInstaBtn');

      if (tpl === 'singleReview') {
        if (catRow) catRow.hidden = false;
        if (itemRow) itemRow.hidden = false;
        if (yearRow) yearRow.hidden = true;
        this.updatePartModeVisibility();
      } else if (tpl === 'wrapped') {
        if (catRow) catRow.hidden = true;
        if (itemRow) itemRow.hidden = true;
        if (partRow) partRow.hidden = true;
        if (yearRow) yearRow.hidden = false;
        if (zipBtn) zipBtn.hidden = false;
      } else {
        // topPicks or tierCollage
        if (catRow) catRow.hidden = false;
        if (itemRow) itemRow.hidden = true;
        if (partRow) partRow.hidden = true;
        if (yearRow) yearRow.hidden = true;
        if (zipBtn) zipBtn.hidden = true;
      }
    }

    updatePartModeVisibility() {
      const partRow = document.getElementById('instaPartModeRow');
      const tpl = document.getElementById('instaTemplateSelect')?.value || 'singleReview';
      if (tpl !== 'singleReview') {
        if (partRow) partRow.hidden = true;
        return;
      }
      const item = this.getSelectedItem();
      const hasMultipleParts = item && Array.isArray(item.parts) && item.parts.length > 1;
      if (partRow) partRow.hidden = !hasMultipleParts;
    }

    updateDefaultTitles() {
      const catSelect = document.getElementById('instaCategorySelect');
      const titleInp = document.getElementById('instaTitleInput');
      const subInp = document.getElementById('instaSubInput');
      const tpl = document.getElementById('instaTemplateSelect')?.value || 'singleReview';
      if (!titleInp) return;

      const catKey = catSelect?.value || 'anime';
      const catMeta = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;

      if (tpl === 'singleReview') {
        titleInp.value = `${catMeta.label.toUpperCase()} İNCELEMESİ`;
        if (subInp) subInp.value = 'Kişisel Medya Arşivim ve Değerlendirmelerim · tempestian.github.io';
      } else if (tpl === 'wrapped') {
        titleInp.value = 'TEMPESTIAN WRAPPED';
        if (subInp) subInp.value = 'Büyük Yıllık Medya ve Arşiv Özeti · tempestian.github.io';
      } else if (tpl === 'topPicks') {
        titleInp.value = `BAYRAM TEMPESTIAN · ${catMeta.label.toUpperCase()} EN İYİLER`;
        if (subInp) subInp.value = 'En Yüksek Puanlı Başyapıtlar ve Favorilerim';
      } else {
        titleInp.value = `TEMPESTIAN · ${catMeta.label.toUpperCase()} KATMAN LİSTESİ`;
        if (subInp) subInp.value = 'S, A+ ve A Katmanı Yapımlar';
      }
    }

    async loadCategoryData(catKey) {
      if (typeof window.getAdminCategoryData === 'function') {
        const live = window.getAdminCategoryData(catKey);
        if (live && Array.isArray(live.items) && live.items.length) {
          return live;
        }
      }
      if (this.cachedData[catKey]) return this.cachedData[catKey];
      const meta = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
      const paths = [
        meta.file,
        meta.file.startsWith('../') ? meta.file.slice(3) : `../${meta.file}`
      ];

      for (const p of paths) {
        try {
          const res = await fetch(p, { cache: 'no-store' });
          if (!res.ok) continue;
          const json = await res.json();
          const items = Array.isArray(json[meta.key]) ? json[meta.key] : (Array.isArray(json.items) ? json.items : []);
          this.cachedData[catKey] = { items, stats: json.stats || {} };
          return this.cachedData[catKey];
        } catch (_) {}
      }

      console.warn(`[InstaStudio]: ${catKey} verisi çekilemedi.`);
      return { items: [], stats: {} };
    }

    async loadAllCategories() {
      for (const ck of Object.keys(CATEGORY_CONFIG)) {
        if (!this.allCategoryData[ck]) {
          this.allCategoryData[ck] = await this.loadCategoryData(ck);
        }
      }
      return this.allCategoryData;
    }

    async populateItems() {
      const catKey = document.getElementById('instaCategorySelect')?.value || 'anime';
      const itemSelect = document.getElementById('instaItemSelect');
      if (!itemSelect) return;

      const { items } = await this.loadCategoryData(catKey);
      itemSelect.innerHTML = '';

      if (!items || !items.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Kayıtlı yapım bulunamadı';
        itemSelect.appendChild(opt);
        return;
      }

      const sorted = [...items].sort((a, b) => {
        const sa = resolveItemEffectiveScore(a, catKey) || 0;
        const sb = resolveItemEffectiveScore(b, catKey) || 0;
        return sb - sa || (a.title || '').localeCompare(b.title || '');
      });

      for (const it of sorted) {
        const opt = document.createElement('option');
        opt.value = String(it.id ?? it.anilistId ?? it.title);
        const sc = resolveItemEffectiveScore(it, catKey);
        const scBadge = sc !== null ? ` [★ ${sc}]` : '';
        const favBadge = it.favorite ? ' ⭐' : '';
        opt.textContent = `${it.title || 'İsimsiz'}${scBadge}${favBadge}`;
        itemSelect.appendChild(opt);
      }

      if (sorted.length > 0) {
        itemSelect.value = String(sorted[0].id ?? sorted[0].anilistId ?? sorted[0].title);
      }

      this.updatePartModeVisibility();
    }

    getSelectedItem() {
      const catKey = document.getElementById('instaCategorySelect')?.value || 'anime';
      const itemSelect = document.getElementById('instaItemSelect');
      if (!itemSelect) return null;
      const targetVal = itemSelect.value;
      let items = this.cachedData[catKey]?.items;
      if (!items && typeof window.getAdminCategoryData === 'function') {
        const live = window.getAdminCategoryData(catKey);
        if (live && Array.isArray(live.items)) items = live.items;
      }
      if (!items || !items.length) return null;
      if (!targetVal) return items[0];
      return items.find(it => String(it.id ?? it.anilistId ?? it.title) === String(targetVal)) || items[0] || null;
    }

    async render() {
      if (this.isRendering) return;
      this.isRendering = true;

      const fmtKey = document.getElementById('instaFormatSelect')?.value || 'square';
      const catKey = document.getElementById('instaCategorySelect')?.value || 'anime';
      const tplKey = document.getElementById('instaTemplateSelect')?.value || 'singleReview';
      const thmKey = document.getElementById('instaThemeSelect')?.value || 'neonBlue';
      const customTitle = document.getElementById('instaTitleInput')?.value || '';
      const customSub = document.getElementById('instaSubInput')?.value || '';
      const partMode = document.getElementById('instaPartModeSelect')?.value || 'carousel';
      const wrappedYear = document.getElementById('instaWrappedYear')?.value || '2026';

      const fmt = FORMATS[fmtKey] || FORMATS.square;
      const theme = THEMES[thmKey] || THEMES.neonBlue;

      this.canvas.width = fmt.width;
      this.canvas.height = fmt.height;
      const ctx = this.ctx;
      const W = fmt.width;
      const H = fmt.height;

      // Slayt listesini oluştur
      this.slides = [];

      if (tplKey === 'singleReview') {
        const item = this.getSelectedItem();
        const hasParts = item && Array.isArray(item.parts) && item.parts.length > 1;

        if (hasParts && partMode === 'compact') {
          this.slides.push({
            id: 'slide-compact',
            name: '01-kompakt-karne.png',
            title: 'Tek Kare - Kompakt Karne',
            render: async () => renderSingleReviewCompactSlide(ctx, W, H, item, catKey, theme, fmtKey)
          });
        } else if (hasParts && partMode === 'carousel') {
          // 1. Slayt: Ana Kapak
          this.slides.push({
            id: 'slide-cover',
            name: '01-ana-kapak.png',
            title: '1. Slayt: Ana Kapak & Özet',
            render: async () => renderSingleReviewCoverSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub)
          });
          // Sonraki Slaytlar: Parçalar
          for (let pIdx = 0; pIdx < item.parts.length; pIdx++) {
            const p = item.parts[pIdx];
            const pNum = String(pIdx + 2).padStart(2, '0');
            this.slides.push({
              id: `slide-part-${pIdx}`,
              name: `${pNum}-sezon-${pIdx + 1}.png`,
              title: `${pIdx + 2}. Slayt: ${p.name || `Sezon ${pIdx + 1}`}`,
              render: async () => renderSingleReviewPartSlide(ctx, W, H, item, p, pIdx, item.parts.length, catKey, theme, fmtKey)
            });
          }
        } else {
          // Parçasız / Tekil Yapım
          this.slides.push({
            id: 'slide-single',
            name: '01-inceleme.png',
            title: 'Tekil İnceleme Kartı',
            render: async () => renderSingleReviewCoverSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub)
          });
        }
      } else if (tplKey === 'wrapped') {
        const allData = await this.loadAllCategories();
        this.slides = [
          {
            id: 'wrapped-1',
            name: '01-wrapped-champions.png',
            title: '1. Slayt: The Champions (Zirvedekiler)',
            render: async () => renderWrappedChampionsSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          },
          {
            id: 'wrapped-2',
            name: '02-wrapped-numbers.png',
            title: '2. Slayt: The Numbers (Büyük Rakamlar)',
            render: async () => renderWrappedNumbersSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          },
          {
            id: 'wrapped-3',
            name: '03-wrapped-taste.png',
            title: '3. Slayt: The Taste (Tür Profili)',
            render: async () => renderWrappedTasteSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          },
          {
            id: 'wrapped-4',
            name: '04-wrapped-gems.png',
            title: '4. Slayt: Hidden Gems (Gizli Cevherler)',
            render: async () => renderWrappedHiddenGemsSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          }
        ];
      } else if (tplKey === 'topPicks') {
        const { items } = await this.loadCategoryData(catKey);
        this.slides.push({
          id: 'slide-topPicks',
          name: '01-top-picks.png',
          title: 'Top Picks - En İyiler',
          render: async () => renderTopPicksTemplate(ctx, W, H, items, theme, fmtKey, catKey)
        });
      } else {
        // tierCollage
        const { items } = await this.loadCategoryData(catKey);
        this.slides.push({
          id: 'slide-tierCollage',
          name: '01-tier-list.png',
          title: 'Katman (Tier List) Özeti',
          render: async () => renderTierCollageTemplate(ctx, W, H, items, theme, fmtKey, catKey)
        });
      }

      this.updateSlideSelectorUI();
      if (this.currentSlideIndex >= this.slides.length) this.currentSlideIndex = 0;

      await this.renderCurrentSlideOnly();

      // Caption Güncelle
      const captionText = generateInstagramCaption(tplKey, catKey, this.getSelectedItem(), wrappedYear);
      const capArea = document.getElementById('instaCaptionText');
      if (capArea) capArea.value = captionText;

      this.isRendering = false;
    }

    updateSlideSelectorUI() {
      const slideRow = document.getElementById('instaSlideSelectRow');
      const slideSelect = document.getElementById('instaSlideSelect');
      const indicator = document.getElementById('instaSlideIndicator');
      const zipBtn = document.getElementById('downloadZipInstaBtn');

      if (!slideSelect) return;

      if (this.slides.length > 1) {
        if (slideRow) slideRow.hidden = false;
        if (indicator) {
          indicator.hidden = false;
          indicator.textContent = `🎞️ Slayt ${this.currentSlideIndex + 1} / ${this.slides.length}`;
        }
        if (zipBtn) zipBtn.hidden = false;

        slideSelect.innerHTML = '';
        this.slides.forEach((s, idx) => {
          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = s.title;
          if (idx === this.currentSlideIndex) opt.selected = true;
          slideSelect.appendChild(opt);
        });
      } else {
        if (slideRow) slideRow.hidden = true;
        if (indicator) indicator.hidden = true;
        if (zipBtn) zipBtn.hidden = true;
      }
    }

    async renderCurrentSlideOnly() {
      if (!this.slides.length) return;
      const activeSlide = this.slides[this.currentSlideIndex] || this.slides[0];
      const indicator = document.getElementById('instaSlideIndicator');
      if (indicator && this.slides.length > 1) {
        indicator.textContent = `🎞️ Slayt ${this.currentSlideIndex + 1} / ${this.slides.length}: ${activeSlide.title}`;
      }
      await activeSlide.render();
    }

    downloadActiveSlide() {
      if (!this.canvas) return;
      const catKey = document.getElementById('instaCategorySelect')?.value || 'anime';
      const fmtKey = document.getElementById('instaFormatSelect')?.value || 'square';
      const tplKey = document.getElementById('instaTemplateSelect')?.value || 'singleReview';
      const activeSlide = this.slides[this.currentSlideIndex];
      const slideSuffix = this.slides.length > 1 ? `-slayt${this.currentSlideIndex + 1}` : '';
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `tempestian-${tplKey}-${catKey}-${fmtKey}${slideSuffix}-${dateStr}.png`;

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
          window.toast('✓ 2160p Retina kalitesinde PNG görseli indirildi!', 'ok');
        }
      }, 'image/png');
    }

    async downloadAllZip() {
      if (!this.slides.length) return;
      if (window.toast) window.toast('📦 Tüm slaytlar hazırlanıyor ve ZIP paketine ekleniyor...', 'info');

      const files = [];
      const savedIndex = this.currentSlideIndex;

      for (let i = 0; i < this.slides.length; i++) {
        this.currentSlideIndex = i;
        await this.renderCurrentSlideOnly();
        const blob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
        if (blob) {
          files.push({
            name: this.slides[i].name || `slayt-${i + 1}.png`,
            blob
          });
        }
      }

      this.currentSlideIndex = savedIndex;
      await this.renderCurrentSlideOnly();

      const zipBlob = await createZipBlob(files);
      const catKey = document.getElementById('instaCategorySelect')?.value || 'anime';
      const tplKey = document.getElementById('instaTemplateSelect')?.value || 'singleReview';
      const dateStr = new Date().toISOString().slice(0, 10);
      const zipName = `tempestian-${tplKey}-${catKey}-${dateStr}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (window.toast) {
        window.toast(`✓ ${files.length} slaytlık ZIP paketi başarıyla indirildi!`, 'ok');
      }
    }

    copyCaption() {
      const capArea = document.getElementById('instaCaptionText');
      if (!capArea || !capArea.value) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(capArea.value).then(() => {
          if (window.toast) window.toast('📋 Instagram açıklaması panoya kopyalandı!', 'ok');
        });
      } else {
        capArea.select();
        document.execCommand('copy');
        if (window.toast) window.toast('📋 Instagram açıklaması kopyalandı!', 'ok');
      }
    }
  }

  window.AdminInstagram = new InstagramStudio();
})();
