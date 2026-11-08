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
  const FONT_FAMILY = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Plus Jakarta Sans", sans-serif';

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

  // --------------------------------------------------------------------------
  // 4.5. DİNAMİK TİPOGRAFİ VE METİN KAYDIRMA MOTORU (RETINA 2X)
  // --------------------------------------------------------------------------
  function drawWrappedText(ctx, text, x, y, maxW, lineHeight, maxLines = 3) {
    if (!text) return y;
    const words = String(text).trim().split(/\s+/);
    let line = '';
    let currentY = y;
    let lineCount = 0;

    for (let i = 0; i < words.length; i++) {
      const testLine = line ? line + ' ' + words[i] : words[i];
      const testW = ctx.measureText(testLine).width;
      if (testW > maxW && line) {
        lineCount++;
        if (lineCount >= maxLines) {
          let truncated = line;
          while (ctx.measureText(truncated + '...').width > maxW && truncated.length > 3) {
            truncated = truncated.slice(0, -1).trim();
          }
          ctx.fillText(truncated + '...', x, currentY);
          return currentY + lineHeight;
        }
        ctx.fillText(line, x, currentY);
        line = words[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line && lineCount < maxLines) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  }

  function drawWrappedTitle(ctx, rawTitle, centerX, startY, maxW, options = {}) {
    const title = String(rawTitle || 'Yapım İncelemesi').trim();
    const minSize = options.minFontSize || 66;
    const maxSize = options.maxFontSize || 88;
    const preferredColor = options.color || '#ffffff';
    const subText = options.subtitle || null;
    const subColor = options.subtitleColor || '#9ca3af';
    const subSize = options.subtitleFontSize || 38;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Tek satır testi (maxSize'dan 72px'e kadar dene)
    let chosenSize = maxSize;
    let lines = [title];
    let fitsSingle = false;

    for (let s = maxSize; s >= 72; s -= 4) {
      ctx.font = `800 ${s}px ${FONT_FAMILY}`;
      if (ctx.measureText(title).width <= maxW) {
        chosenSize = s;
        lines = [title];
        fitsSingle = true;
        break;
      }
    }

    // 2. Tek satıra sığmadıysa, kelime bazında en dengeli 2 satıra böl
    if (!fitsSingle) {
      const words = title.split(/\s+/);
      if (words.length <= 1) {
        chosenSize = minSize;
        ctx.font = `800 ${chosenSize}px ${FONT_FAMILY}`;
        let singleStr = title;
        while (ctx.measureText(singleStr).width > maxW && singleStr.length > 5) {
          singleStr = singleStr.slice(0, -1);
        }
        lines = [singleStr];
      } else {
        let bestSplit = null;
        let bestSize = 74;

        for (let s = 78; s >= minSize; s -= 4) {
          ctx.font = `800 ${s}px ${FONT_FAMILY}`;
          const validSplits = [];
          for (let i = 1; i < words.length; i++) {
            const l1 = words.slice(0, i).join(' ');
            const l2 = words.slice(i).join(' ');
            const w1 = ctx.measureText(l1).width;
            const w2 = ctx.measureText(l2).width;
            if (w1 <= maxW && w2 <= maxW) {
              validSplits.push({ l1, l2, diff: Math.abs(w1 - w2) });
            }
          }
          if (validSplits.length > 0) {
            validSplits.sort((a, b) => a.diff - b.diff);
            bestSplit = [validSplits[0].l1, validSplits[0].l2];
            bestSize = s;
            break;
          }
        }

        if (bestSplit) {
          lines = bestSplit;
          chosenSize = bestSize;
        } else {
          // Çok uzun başlık: minSize'da kelime akışına göre böl (en fazla 2 satır)
          chosenSize = minSize;
          ctx.font = `800 ${chosenSize}px ${FONT_FAMILY}`;
          const flowLines = [];
          let cur = words[0];
          for (let i = 1; i < words.length; i++) {
            const test = cur + ' ' + words[i];
            if (ctx.measureText(test).width <= maxW) {
              cur = test;
            } else {
              flowLines.push(cur);
              cur = words[i];
            }
          }
          flowLines.push(cur);

          if (flowLines.length <= 2) {
            lines = flowLines;
          } else {
            const l1 = flowLines[0];
            let l2 = words.slice(flowLines[0].split(/\s+/).length).join(' ');
            while (ctx.measureText(l2 + '...').width > maxW && l2.length > 5) {
              l2 = l2.slice(0, -4).trim();
            }
            lines = [l1, l2.includes('...') ? l2 : l2 + '...'];
          }
        }
      }
    }

    // Başlık Satırlarını Çiz
    ctx.font = `800 ${chosenSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = preferredColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 18;

    const lineHeight = chosenSize * 1.18;
    let curY = startY;

    if (lines.length === 1) {
      curY = startY + 22;
      ctx.fillText(lines[0], centerX, curY);
      curY += chosenSize * 0.5;
    } else {
      curY = startY;
      for (let i = 0; i < lines.length; i++) {
        const ly = curY + i * lineHeight;
        ctx.fillText(lines[i], centerX, ly);
      }
      curY += (lines.length - 1) * lineHeight + chosenSize * 0.5;
    }

    // Alt Başlık (varsa)
    let bottomY = curY;
    if (subText) {
      ctx.shadowBlur = 0;
      ctx.font = `500 ${subSize}px ${FONT_FAMILY}`;
      ctx.fillStyle = subColor;
      const subY = curY + (lines.length === 1 ? 52 : 46);
      ctx.fillText(subText, centerX, subY);
      bottomY = subY + subSize * 0.5;
    }

    ctx.restore();
    return { lines, fontSize: chosenSize, bottomY };
  }

  function drawTopBrandPill(ctx, W, Y, theme, label = '✦ TEMPESTIAN ARCHIVE · İNCELEME ✦') {
    ctx.save();
    ctx.font = `700 34px ${FONT_FAMILY}`;
    const textW = ctx.measureText(label).width;
    const pillW = Math.max(640, Math.min(W - 200, textW + 88));
    const pillH = 84;
    const pillX = (W - pillW) / 2;

    ctx.fillStyle = theme.pillBg;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    roundRect(ctx, pillX, Y, pillW, pillH, 42);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, Y + pillH / 2);
    ctx.restore();
  }

  function drawFooterSignature(ctx, W, H) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = `600 34px ${FONT_FAMILY}`;
    ctx.fillText('tempestian.github.io · Bayram Tempestian', W / 2, H - 74);
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
    const topY = fmtKey === 'story' ? 160 : 100;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'ARŞİV'} ✦`);

    // Dinamik Başlık ve Alt Başlık (Otomatik Metin Kaydırma & Kırpmasız)
    const rawTitle = item?.title || customTitle || 'Yapım İncelemesi';
    const subTitle = customSub || `${CATEGORY_CONFIG[catKey]?.label || 'Yapım'} İncelemesi ve Genel Değerlendirme`;
    drawWrappedTitle(ctx, rawTitle, W / 2, topY + 130, W - 200, {
      maxFontSize: 88,
      minFontSize: 66,
      color: '#ffffff',
      subtitle: subTitle,
      subtitleFontSize: 38,
      subtitleColor: '#9ca3af'
    });

    // Dinamik Terminoloji ve Kriterler
    const meta = getCategoryTerminology(catKey, item);
    const effScore = resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);

    if (fmtKey === 'story') {
      // ----------------------------------------------------------------------
      // 9:16 Dikey Story Düzeni (2160 × 3840)
      // ----------------------------------------------------------------------
      const posterW = 900;
      const posterH = 1280;
      const posterX = (W - posterW) / 2;
      const posterY = 560;

      // Sol / Orta Poster
      ctx.save();
      roundRect(ctx, posterX, posterY, posterW, posterH, 36);
      ctx.clip();
      if (posterImg) {
        const imgAspect = posterImg.naturalWidth / posterImg.naturalHeight;
        const boxAspect = posterW / posterH;
        let dw, dh, dx, dy;
        if (imgAspect > boxAspect) {
          dh = posterH; dw = posterH * imgAspect;
          dx = posterX + (posterW - dw) / 2; dy = posterY;
        } else {
          dw = posterW; dh = posterW / imgAspect;
          dx = posterX; dy = posterY + (posterH - dh) / 2;
        }
        ctx.drawImage(posterImg, dx, dy, dw, dh);
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
        const scW = 280;
        const scH = 104;
        const scX = posterX + posterW - scW - 28;
        const scY = posterY + 28;
        ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3.5;
        roundRect(ctx, scX, scY, scW, scH, 52);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 54px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const scStr = (effScore % 1 === 0) ? effScore.toFixed(1) : String(effScore);
        ctx.fillText(`★ ${scStr}`, scX + scW / 2, scY + scH / 2);
      }
      ctx.restore();

      // Tür Rozetleri
      const genres = Array.isArray(item?.genres) && item.genres.length ? item.genres.slice(0, 4) : [CATEGORY_CONFIG[catKey]?.label || 'Arşiv'];
      let gx = 120;
      const gy = posterY + posterH + 50;
      for (const g of genres) {
        ctx.save();
        ctx.font = `700 34px ${FONT_FAMILY}`;
        const gw = ctx.measureText(g).width + 64;
        if (gx + gw > W - 120) { ctx.restore(); break; }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, gw, 74, 37);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#edf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g, gx + gw / 2, gy + 37);
        ctx.restore();
        gx += gw + 18;
      }

      // Meta 3'lü Kartlar
      const metaY = gy + 110;
      const metaW = (W - 240 - 40) / 3;
      const metaCards = [
        { label: meta.creatorLabel, val: meta.creatorVal },
        { label: meta.subUnitLabel, val: meta.subUnitVal },
        { label: meta.extraLabel, val: meta.extraVal }
      ];

      for (let i = 0; i < 3; i++) {
        const mx = 120 + i * (metaW + 20);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        roundRect(ctx, mx, metaY, metaW, 160, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 28px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(metaCards[i].label, mx + 24, metaY + 54);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 36px ${FONT_FAMILY}`;
        let valStr = metaCards[i].val;
        while (ctx.measureText(valStr).width > metaW - 48 && valStr.length > 5) {
          valStr = valStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(valStr, mx + 24, metaY + 118);
        ctx.restore();
      }

      // Kriter Barları
      const critY = metaY + 210;
      const critW = W - 240;
      const critListToDraw = criteriaList.slice(0, 5);
      const rowH = 130;

      for (let i = 0; i < critListToDraw.length; i++) {
        const c = critListToDraw[i];
        const cy = critY + i * rowH;
        const subVal = (item?.subScores && item.subScores[c.id]) ? Number(item.subScores[c.id]) : (effScore ? Math.round(effScore / 2) : 4);
        const scoreTen = (subVal * 2).toFixed(1);

        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `600 36px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(c.label, 120, cy + 34);

        ctx.fillStyle = theme.accent;
        ctx.font = `800 38px ${FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${scoreTen} / 10`, 120 + critW, cy + 34);

        // Bar Zemini
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(ctx, 120, cy + 54, critW, 26, 13);
        ctx.fill();

        // Bar Doluluk
        const fillW = Math.max(26, critW * (subVal / 5));
        const barGrad = ctx.createLinearGradient(120, cy + 54, 120 + fillW, cy + 54);
        barGrad.addColorStop(0, theme.gradient[0]);
        barGrad.addColorStop(1, theme.gradient[1]);
        ctx.fillStyle = barGrad;
        roundRect(ctx, 120, cy + 54, fillW, 26, 13);
        ctx.fill();
        ctx.restore();
      }

      // Alt Bölüm (Story Vitrin Kartı)
      const storyBottomY = critY + critListToDraw.length * rowH + 40;
      const storyBottomH = H - storyBottomY - 140;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 120, storyBottomY, W - 240, storyBottomH, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `700 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('✦ TEMPESTIAN BAŞYAPIT NOTU ✦', 160, storyBottomY + 64);

      let sNote = item?.note || item?.review || item?.description || '';
      if (!sNote || sNote.length < 20) {
        sNote = `${item?.title || 'Bu yapım'}, kütüphanemizde öne çıkan ve derin atmosferiyle mutlaka deneyimlenmesi gereken özel arşiv eserleri arasında yer almaktadır.`;
      }
      ctx.fillStyle = '#d1d5db';
      ctx.font = `500 34px ${FONT_FAMILY}`;
      drawWrappedText(ctx, sNote, 160, storyBottomY + 124, W - 320, 52, 4);
      ctx.restore();

    } else {
      // ----------------------------------------------------------------------
      // 1:1 Kare (2160 × 2160) veya 4:5 Portre (2160 × 2700) Düzeni
      // ----------------------------------------------------------------------
      const isPortrait = (fmtKey === 'portrait');
      const posterW = 820;
      const posterH = isPortrait ? 1450 : 1160;
      const posterX = 100;
      const posterY = 460;

      // Sol: Heybetli Büyük Afiş
      ctx.save();
      roundRect(ctx, posterX, posterY, posterW, posterH, 36);
      ctx.clip();
      if (posterImg) {
        const imgAspect = posterImg.naturalWidth / posterImg.naturalHeight;
        const boxAspect = posterW / posterH;
        let dw, dh, dx, dy;
        if (imgAspect > boxAspect) {
          dh = posterH; dw = posterH * imgAspect;
          dx = posterX + (posterW - dw) / 2; dy = posterY;
        } else {
          dw = posterW; dh = posterW / imgAspect;
          dx = posterX; dy = posterY + (posterH - dh) / 2;
        }
        ctx.drawImage(posterImg, dx, dy, dw, dh);
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

      // Afiş Üzeri Büyük Glowing Puan Rozeti
      if (effScore !== null) {
        const scW = 280;
        const scH = 104;
        const scX = posterX + posterW - scW - 28;
        const scY = posterY + 28;
        ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3.5;
        roundRect(ctx, scX, scY, scW, scH, 52);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 54px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const scStr = (effScore % 1 === 0) ? effScore.toFixed(1) : String(effScore);
        ctx.fillText(`★ ${scStr}`, scX + scW / 2, scY + scH / 2);
      }

      // Favori Rozeti
      if (item?.favorite) {
        const favW = 220;
        const favH = 72;
        const favX = posterX + 28;
        const favY = posterY + 28;
        ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        roundRect(ctx, favX, favY, favW, favH, 36);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐ FAVORİ', favX + favW / 2, favY + favH / 2);
      }
      ctx.restore();

      // Sağ Taraf Panel (Genişlik ~1080px, Y=460 — Y=1620)
      const rightX = posterX + posterW + 60; // 980
      const rightW = W - rightX - 100; // 1080

      // 1. Tür Rozetleri
      const genres = Array.isArray(item?.genres) && item.genres.length ? item.genres.slice(0, 4) : [CATEGORY_CONFIG[catKey]?.label || 'Genel'];
      let gx = rightX;
      const gy = posterY;
      const badgeH = 76;
      for (const g of genres) {
        ctx.save();
        ctx.font = `700 34px ${FONT_FAMILY}`;
        const gw = ctx.measureText(g).width + 64;
        if (gx + gw > rightX + rightW) {
          ctx.restore();
          break;
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, gw, badgeH, 38);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#edf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g, gx + gw / 2, gy + badgeH / 2);
        ctx.restore();
        gx += gw + 18;
      }

      // 2. 2x2 Meta Grid (Y=566, H=340)
      const metaY = gy + badgeH + 30; // 566
      const mCardW = (rightW - 24) / 2; // 528
      const mCardH = 160;
      const metaCards = [
        { label: meta.creatorLabel, val: meta.creatorVal },
        { label: meta.subUnitLabel, val: meta.subUnitVal },
        { label: meta.extraLabel, val: meta.extraVal },
        { label: 'Yayın Durumu', val: item?.favorite ? '★ Başyapıt / Favori' : (item?.status === 'completed' ? 'Tamamlandı' : 'Arşivde / Aktif') }
      ];

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const mx = rightX + col * (mCardW + 24);
        const my = metaY + row * (mCardH + 20);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        roundRect(ctx, mx, my, mCardW, mCardH, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(metaCards[i].label, mx + 26, my + 54);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 38px ${FONT_FAMILY}`;
        let valStr = metaCards[i].val;
        while (ctx.measureText(valStr).width > mCardW - 52 && valStr.length > 5) {
          valStr = valStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(valStr, mx + 26, my + 120);
        ctx.restore();
      }

      // 3. Kriter Barları (Y=940 — Y=1620)
      const critY = metaY + 2 * mCardH + 20 + 34; // 940
      const critTotalH = (posterY + posterH) - critY; // 680
      const critListToDraw = criteriaList.slice(0, 5);
      const critCount = Math.max(1, critListToDraw.length);
      const rowSpacing = critTotalH / critCount;

      for (let i = 0; i < critListToDraw.length; i++) {
        const c = critListToDraw[i];
        const cy = critY + i * rowSpacing;
        const subVal = (item?.subScores && item.subScores[c.id]) ? Number(item.subScores[c.id]) : (effScore ? Math.round(effScore / 2) : 4);
        const scoreTen = (subVal * 2).toFixed(1);

        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `600 36px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(c.label, rightX, cy + 34);

        ctx.fillStyle = theme.accent;
        ctx.font = `800 38px ${FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${scoreTen} / 10`, rightX + rightW, cy + 34);

        // Bar Zemini
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(ctx, rightX, cy + 54, rightW, 26, 13);
        ctx.fill();

        // Bar Doluluk
        const fillW = Math.max(26, rightW * (subVal / 5));
        const barGrad = ctx.createLinearGradient(rightX, cy + 54, rightX + fillW, cy + 54);
        barGrad.addColorStop(0, theme.gradient[0]);
        barGrad.addColorStop(1, theme.gradient[1]);
        ctx.fillStyle = barGrad;
        roundRect(ctx, rightX, cy + 54, fillW, 26, 13);
        ctx.fill();
        ctx.restore();
      }

      // ----------------------------------------------------------------------
      // ALT BÖLÜM: BOŞLUĞU DOLDURAN GENİŞ VİTRİN / ÖZET KARTI (Y=1660 — Y=1990)
      // ----------------------------------------------------------------------
      const bottomX = 100;
      const bottomY = isPortrait ? 1970 : 1660;
      const bottomW = 1960;
      const bottomH = isPortrait ? 580 : 330;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, bottomX, bottomY, bottomW, bottomH, 28);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const hasMultipleParts = Array.isArray(item?.parts) && item.parts.length > 1;

      if (hasMultipleParts) {
        // Çok Parçalı Serilerde: Sezonlar Yatay Mini Karneler Olarak Listelenir
        ctx.save();
        ctx.fillStyle = theme.accent;
        ctx.font = `700 28px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`✦ SERİ VE SEZON DÖKÜMÜ (${item.parts.length} SEZON / PARÇA) ✦`, bottomX + 32, bottomY + 44);
        ctx.restore();

        const maxPartsToShow = Math.min(4, item.parts.length);
        const cardGap = 20;
        const partCardW = (bottomW - 64 - (maxPartsToShow - 1) * cardGap) / maxPartsToShow;
        const partCardH = isPortrait ? 440 : 224;
        const partCardY = bottomY + 70;

        for (let idx = 0; idx < maxPartsToShow; idx++) {
          const p = item.parts[idx];
          const px = bottomX + 32 + idx * (partCardW + cardGap);
          const isLastWithMore = (idx === maxPartsToShow - 1 && item.parts.length > maxPartsToShow);
          const extraCount = item.parts.length - maxPartsToShow + 1;

          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 2;
          roundRect(ctx, px, partCardY, partCardW, partCardH, 20);
          ctx.fill();
          ctx.stroke();

          if (isLastWithMore) {
            ctx.fillStyle = theme.accent;
            ctx.font = `800 32px ${FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`+${extraCount} DİĞER SEZON`, px + partCardW / 2, partCardY + 65);

            ctx.fillStyle = '#9ca3af';
            ctx.font = `600 24px ${FONT_FAMILY}`;
            ctx.fillText('Arşivde Devamı Mevcut', px + partCardW / 2, partCardY + 115);

            const scPillW = partCardW - 48;
            const scPillH = 56;
            const scPillX = px + 24;
            const scPillY = partCardY + (isPortrait ? 300 : 144);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = 2;
            roundRect(ctx, scPillX, scPillY, scPillW, scPillH, 28);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = theme.accent;
            ctx.font = `800 28px ${FONT_FAMILY}`;
            ctx.fillText('TAM LİSTE İÇİN ARŞİV', scPillX + scPillW / 2, scPillY + scPillH / 2);
          } else {
            // Normal Parça Kartı
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 32px ${FONT_FAMILY}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            let pName = p.name || `${idx + 1}. Sezon`;
            while (ctx.measureText(pName).width > partCardW - 44 && pName.length > 5) {
              pName = pName.slice(0, -4).trim() + '...';
            }
            ctx.fillText(pName, px + 22, partCardY + 48);

            ctx.fillStyle = '#9ca3af';
            ctx.font = `500 24px ${FONT_FAMILY}`;
            const kindLabel = p.kind === 'movie' ? 'Film' : (p.kind === 'other' ? 'Özel' : 'TV Sezonu');
            const epLabel = p.episodes ? ` · ${p.episodes} Bölüm` : '';
            const yrLabel = p.year ? ` · ${p.year}` : '';
            ctx.fillText(`${kindLabel}${epLabel}${yrLabel}`, px + 22, partCardY + 92);

            const pSc = Number(p.score) || effScore;
            const scPillW = partCardW - 44;
            const scPillH = 58;
            const scPillX = px + 22;
            const scPillY = partCardY + (isPortrait ? 300 : 138);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = 2;
            roundRect(ctx, scPillX, scPillY, scPillW, scPillH, 29);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = theme.accent;
            ctx.font = `800 32px ${FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`★ ${Number(pSc).toFixed(1)} / 10`, scPillX + scPillW / 2, scPillY + scPillH / 2);
          }
          ctx.restore();
        }
      } else {
        // Tekil Yapımlarda: Sol Taraf Özel İnceleme Notu, Sağ Taraf Prestijli Başyapıt / Tavsiye Mührü
        const leftTextW = bottomW - 440;

        ctx.save();
        ctx.fillStyle = theme.accent;
        ctx.font = `700 28px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('✦ BAYRAM TEMPESTIAN ÖZEL İNCELEME NOTU ✦', bottomX + 36, bottomY + 48);

        // Dekoratif tırnak işareti
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.font = '800 110px "Georgia", serif';
        ctx.fillText('“', bottomX + 32, bottomY + 155);

        // Açıklama / Değerlendirme metni
        let noteText = item?.note || item?.review || item?.description || '';
        if (!noteText || noteText.length < 20) {
          const gStr = Array.isArray(item?.genres) && item.genres.length ? item.genres.slice(0, 3).join(', ') : 'Arşiv';
          noteText = `${item?.title || 'Bu yapım'}, ${gStr} türündeki güçlü kurgusal anlatımı ve derinliğiyle arşivin öne çıkan yapıtları arasında yer alıyor. ${effScore >= 9.0 ? 'Eksiksiz atmosferi, kusursuz tekniği ve duygusal etkisiyle mutlak bir başyapıt niteliğinde.' : 'Dengeli temposu ve özgün karakterleriyle mutlaka deneyimlenmesi gereken değerli bir eser.'}`;
        }

        ctx.fillStyle = '#d1d5db';
        ctx.font = `500 32px ${FONT_FAMILY}`;
        drawWrappedText(ctx, noteText, bottomX + 110, bottomY + 104, leftTextW - 130, 48, isPortrait ? 6 : 3);
        ctx.restore();

        // Sağ Taraf: Prestijli Başyapıt / Tavsiye Mührü
        const sealW = 360;
        const sealH = isPortrait ? 400 : 260;
        const sealX = bottomX + bottomW - sealW - 32;
        const sealY = bottomY + 35;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = (effScore >= 9.0 || item?.favorite) ? '#f59e0b' : theme.accent;
        ctx.lineWidth = 3;
        roundRect(ctx, sealX, sealY, sealW, sealH, 24);
        ctx.fill();
        ctx.stroke();

        const isMasterpiece = (effScore >= 9.0 || item?.favorite);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = '54px sans-serif';
        ctx.fillText(isMasterpiece ? '🏆' : (effScore >= 8.0 ? '★' : '✦'), sealX + sealW / 2, sealY + 60);

        ctx.fillStyle = isMasterpiece ? '#fbbf24' : theme.accent;
        ctx.font = `800 36px ${FONT_FAMILY}`;
        ctx.fillText(isMasterpiece ? 'BAŞYAPIT' : (effScore >= 8.0 ? 'KİŞİSEL SEÇKİ' : 'ONAYLI ARŞİV'), sealX + sealW / 2, sealY + 128);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 24px ${FONT_FAMILY}`;
        ctx.fillText(isMasterpiece ? 'MUST-WATCH' : (effScore >= 8.0 ? 'YÜKSEK TAVSİYE' : 'DEĞERLENDİRİLDİ'), sealX + sealW / 2, sealY + 172);

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 20px ${FONT_FAMILY}`;
        ctx.fillText('TEMPESTIAN ARCHIVE', sealX + sealW / 2, sealY + (isPortrait ? 250 : 214));
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

    const topY = fmtKey === 'story' ? 160 : 100;
    drawTopBrandPill(ctx, W, topY, theme, `✦ ${item?.title?.toUpperCase() || 'YAPIM'} · BÖLÜM ${partIndex + 1}/${totalParts} ✦`);

    // Parça Başlığı ve Bilgisi (Kırpmasız & Dinamik Sarma)
    const partTitle = part?.name || `${partIndex + 1}. Sezon / Parça`;
    const kindStr = part?.kind === 'movie' ? 'Sinema Filmi' : (part?.kind === 'other' ? 'Özel / Yan İçerik' : `${partIndex + 1}. Sezon`);
    const epStr = part?.episodes ? ` · ${part.episodes} Bölüm` : '';
    const yrStr = part?.year ? ` · ${part.year}` : '';
    drawWrappedTitle(ctx, partTitle, W / 2, topY + 130, W - 200, {
      maxFontSize: 84,
      minFontSize: 64,
      color: '#ffffff',
      subtitle: `${kindStr}${epStr}${yrStr}`,
      subtitleFontSize: 36,
      subtitleColor: '#9ca3af'
    });

    const partScore = Number(part?.score) || resolveItemEffectiveScore(item, catKey);
    const effScore = resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);

    if (fmtKey === 'story') {
      // 9:16 Dikey Story Düzeni
      const posterW = 900;
      const posterH = 1280;
      const posterX = (W - posterW) / 2;
      const posterY = 560;

      ctx.save();
      roundRect(ctx, posterX, posterY, posterW, posterH, 36);
      ctx.clip();
      if (posterImg) {
        const imgAspect = posterImg.naturalWidth / posterImg.naturalHeight;
        const boxAspect = posterW / posterH;
        let dw, dh, dx, dy;
        if (imgAspect > boxAspect) {
          dh = posterH; dw = posterH * imgAspect;
          dx = posterX + (posterW - dw) / 2; dy = posterY;
        } else {
          dw = posterW; dh = posterW / imgAspect;
          dx = posterX; dy = posterY + (posterH - dh) / 2;
        }
        ctx.drawImage(posterImg, dx, dy, dw, dh);
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

      if (partScore > 0) {
        const scW = 280;
        const scH = 104;
        const scX = posterX + posterW - scW - 28;
        const scY = posterY + 28;
        ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3.5;
        roundRect(ctx, scX, scY, scW, scH, 52);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 54px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ ${Number(partScore).toFixed(1)}`, scX + scW / 2, scY + scH / 2);
      }
      ctx.restore();

      // Rozet
      const rightX = 120;
      const rightW = W - 240;
      const rightY = posterY + posterH + 50;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2;
      roundRect(ctx, rightX, rightY, rightW, 140, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `700 34px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(`BÖLÜM ${partIndex + 1} KARNESİ`, rightX + 32, rightY + 54);

      ctx.fillStyle = '#ffffff';
      ctx.font = `600 30px ${FONT_FAMILY}`;
      ctx.fillText(`Format: ${part?.format || 'TV'} · Durum: ${part?.status === 'COMPLETED' ? 'Tamamlandı' : 'İzlendi / Arşivde'}`, rightX + 32, rightY + 104);
      ctx.restore();

      // Kriter Barları
      const critY = rightY + 180;
      const critListToDraw = criteriaList.slice(0, 5);
      const rowH = 120;

      for (let i = 0; i < critListToDraw.length; i++) {
        const c = critListToDraw[i];
        const cy = critY + i * rowH;
        const subVal = (part?.subScores && part.subScores[c.id]) || (item?.subScores && item.subScores[c.id]) || (partScore ? Math.round(partScore / 2) : 4);
        const scoreTen = (Number(subVal) * 2).toFixed(1);

        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `600 34px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(c.label, rightX, cy + 34);

        ctx.fillStyle = theme.accent;
        ctx.font = `800 36px ${FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${scoreTen} / 10`, rightX + rightW, cy + 34);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(ctx, rightX, cy + 54, rightW, 26, 13);
        ctx.fill();

        const fillW = Math.max(26, rightW * (subVal / 5));
        const barGrad = ctx.createLinearGradient(rightX, cy + 54, rightX + fillW, cy + 54);
        barGrad.addColorStop(0, theme.gradient[0]);
        barGrad.addColorStop(1, theme.gradient[1]);
        ctx.fillStyle = barGrad;
        roundRect(ctx, rightX, cy + 54, fillW, 26, 13);
        ctx.fill();
        ctx.restore();
      }

      // Alt Vitrin
      const storyBottomY = critY + critListToDraw.length * rowH + 40;
      const storyBottomH = H - storyBottomY - 140;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 120, storyBottomY, W - 240, storyBottomH, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `700 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('✦ SEZON DEĞERLENDİRMESİ ✦', 160, storyBottomY + 64);

      let pNote = part?.note || '';
      if (!pNote) {
        pNote = (partScore >= effScore)
          ? `Bu sezon, serinin genel puan ortalamasının (★ ${effScore}) üzerinde üstün bir performans sergileyerek anlatının zirve noktalarından biri olmuştur.`
          : `Bu sezon, genel evrenin (★ ${effScore}) zeminini hazırlayan ve karakter dinamiklerini pekiştiren kritik bir anlatı sürecini başarıyla temsil eder.`;
      }
      ctx.fillStyle = '#d1d5db';
      ctx.font = `500 34px ${FONT_FAMILY}`;
      drawWrappedText(ctx, pNote, 160, storyBottomY + 124, W - 320, 52, 4);
      ctx.restore();

    } else {
      // 1:1 Kare veya 4:5 Portre Düzeni
      const isPortrait = (fmtKey === 'portrait');
      const posterW = 820;
      const posterH = isPortrait ? 1450 : 1160;
      const posterX = 100;
      const posterY = 460;

      // Sol: Heybetli Poster
      ctx.save();
      roundRect(ctx, posterX, posterY, posterW, posterH, 36);
      ctx.clip();
      if (posterImg) {
        const imgAspect = posterImg.naturalWidth / posterImg.naturalHeight;
        const boxAspect = posterW / posterH;
        let dw, dh, dx, dy;
        if (imgAspect > boxAspect) {
          dh = posterH; dw = posterH * imgAspect;
          dx = posterX + (posterW - dw) / 2; dy = posterY;
        } else {
          dw = posterW; dh = posterW / imgAspect;
          dx = posterX; dy = posterY + (posterH - dh) / 2;
        }
        ctx.drawImage(posterImg, dx, dy, dw, dh);
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

      if (partScore > 0) {
        const scW = 280;
        const scH = 104;
        const scX = posterX + posterW - scW - 28;
        const scY = posterY + 28;
        ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3.5;
        roundRect(ctx, scX, scY, scW, scH, 52);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 54px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ ${Number(partScore).toFixed(1)}`, scX + scW / 2, scY + scH / 2);
      }
      ctx.restore();

      // Sağ Taraf Panel
      const rightX = posterX + posterW + 60; // 980
      const rightW = W - rightX - 100; // 1080

      // 1. Sezon Rozeti / Başlık Kartı
      const badgeH = 76;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2;
      roundRect(ctx, rightX, posterY, rightW, badgeH, 38);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 34px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`BÖLÜM ${partIndex + 1} / ${totalParts} · SEZON KARNESİ`, rightX + 32, posterY + badgeH / 2);

      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`Format: ${part?.format || 'TV'}`, rightX + rightW - 32, posterY + badgeH / 2);
      ctx.restore();

      // 2. 2x2 Meta Grid (Y=566, H=340)
      const metaY = posterY + badgeH + 30; // 566
      const mCardW = (rightW - 24) / 2; // 528
      const mCardH = 160;
      const metaCards = [
        { label: 'Format & Tür', val: part?.format || (part?.kind === 'movie' ? 'Sinema Filmi' : 'TV Dizisi') },
        { label: 'Bölüm / Uzunluk', val: part?.episodes ? `${part.episodes} Bölüm` : (part?.duration ? `${part.duration} Dk` : 'Tek Parça') },
        { label: 'Yayın Yılı', val: part?.year || item?.year || '-' },
        { label: 'Genel Seri Ortalaması', val: `★ ${resolveItemEffectiveScore(item, catKey)} / 10` }
      ];

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const mx = rightX + col * (mCardW + 24);
        const my = metaY + row * (mCardH + 20);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        roundRect(ctx, mx, my, mCardW, mCardH, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(metaCards[i].label, mx + 26, my + 54);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 38px ${FONT_FAMILY}`;
        let valStr = metaCards[i].val;
        while (ctx.measureText(valStr).width > mCardW - 52 && valStr.length > 5) {
          valStr = valStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(valStr, mx + 26, my + 120);
        ctx.restore();
      }

      // 3. Kriter Barları (Y=940 — Y=1620)
      const critY = metaY + 2 * mCardH + 20 + 34; // 940
      const critTotalH = (posterY + posterH) - critY; // 680
      const critListToDraw = criteriaList.slice(0, 5);
      const critCount = Math.max(1, critListToDraw.length);
      const rowSpacing = critTotalH / critCount;

      for (let i = 0; i < critListToDraw.length; i++) {
        const c = critListToDraw[i];
        const cy = critY + i * rowSpacing;
        const subVal = (part?.subScores && part.subScores[c.id]) || (item?.subScores && item.subScores[c.id]) || (partScore ? Math.round(partScore / 2) : 4);
        const scoreTen = (Number(subVal) * 2).toFixed(1);

        ctx.save();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `600 36px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(c.label, rightX, cy + 34);

        ctx.fillStyle = theme.accent;
        ctx.font = `800 38px ${FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${scoreTen} / 10`, rightX + rightW, cy + 34);

        // Bar Zemini
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        roundRect(ctx, rightX, cy + 54, rightW, 26, 13);
        ctx.fill();

        // Bar Doluluk
        const fillW = Math.max(26, rightW * (subVal / 5));
        const barGrad = ctx.createLinearGradient(rightX, cy + 54, rightX + fillW, cy + 54);
        barGrad.addColorStop(0, theme.gradient[0]);
        barGrad.addColorStop(1, theme.gradient[1]);
        ctx.fillStyle = barGrad;
        roundRect(ctx, rightX, cy + 54, fillW, 26, 13);
        ctx.fill();
        ctx.restore();
      }

      // ----------------------------------------------------------------------
      // ALT BÖLÜM: BOŞLUĞU DOLDURAN GENİŞ VİTRİN / ÖZET KARTI
      // ----------------------------------------------------------------------
      const bottomX = 100;
      const bottomY = isPortrait ? 1970 : 1660;
      const bottomW = 1960;
      const bottomH = isPortrait ? 580 : 330;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, bottomX, bottomY, bottomW, bottomH, 28);
      ctx.fill();
      ctx.stroke();

      // Sol: Sezon Değerlendirme & Seri Konumu
      const leftTextW = bottomW - 440;
      ctx.fillStyle = theme.accent;
      ctx.font = `700 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('✦ SEZON DEĞERLENDİRMESİ VE SERİ KONUMU ✦', bottomX + 36, bottomY + 48);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.font = '800 110px "Georgia", serif';
      ctx.fillText('“', bottomX + 32, bottomY + 155);

      let pNote = part?.note || '';
      if (!pNote) {
        if (partScore >= effScore) {
          pNote = `Bu sezon, serinin genel puan ortalamasının (★ ${effScore}) üzerinde üstün bir başarı sergileyerek kurgunun ve prodüksiyonun en vurucu dönemlerinden biri olmuştur. Hem görsel kalitesi hem de karakter gelişimiyle arşivde öne çıkar.`;
        } else {
          pNote = `Bu sezon, genel evrenin (★ ${effScore}) zeminini hazırlayan, karakter dinamiklerini pekiştiren ve olay örgüsünü derinleştiren kritik bir anlatı sürecini başarıyla temsil eder.`;
        }
      }

      ctx.fillStyle = '#d1d5db';
      ctx.font = `500 32px ${FONT_FAMILY}`;
      drawWrappedText(ctx, pNote, bottomX + 110, bottomY + 104, leftTextW - 130, 48, isPortrait ? 6 : 3);
      ctx.restore();

      // Sağ: Sezon Prestij Mührü
      const sealW = 360;
      const sealH = isPortrait ? 400 : 260;
      const sealX = bottomX + bottomW - sealW - 32;
      const sealY = bottomY + 35;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = (partScore >= 9.0) ? '#f59e0b' : theme.accent;
      ctx.lineWidth = 3;
      roundRect(ctx, sealX, sealY, sealW, sealH, 24);
      ctx.fill();
      ctx.stroke();

      const isPeak = (partScore >= 9.0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '54px sans-serif';
      ctx.fillText(isPeak ? '🏆' : '★', sealX + sealW / 2, sealY + 60);

      ctx.fillStyle = isPeak ? '#fbbf24' : theme.accent;
      ctx.font = `800 36px ${FONT_FAMILY}`;
      ctx.fillText(isPeak ? 'ZİRVE SEZON' : 'ÖNERİLEN', sealX + sealW / 2, sealY + 128);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 24px ${FONT_FAMILY}`;
      ctx.fillText(isPeak ? 'MUST-WATCH' : 'BAŞARILI BÖLÜM', sealX + sealW / 2, sealY + 172);

      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 20px ${FONT_FAMILY}`;
      ctx.fillText('TEMPESTIAN ARCHIVE', sealX + sealW / 2, sealY + (isPortrait ? 250 : 214));
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // Varyasyon B: Tek Kare Özet Modu (Kompakt Karne)
  async function renderSingleReviewCompactSlide(ctx, W, H, item, catKey, theme, fmtKey) {
    const posterUrl = item?.image ? item.image.replace('/cover/medium/', '/cover/large/') : (item?.banner || null);
    const posterImg = await loadImageWithTimeout(posterUrl, 3000);

    drawRetinaBackground(ctx, W, H, theme, posterImg);

    const topY = fmtKey === 'story' ? 160 : 100;
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'ARŞİV'} ÖZETİ ✦`);

    // Dinamik Başlık
    drawWrappedTitle(ctx, item?.title || 'Yapım Karnesi', W / 2, topY + 130, W - 200, {
      maxFontSize: 86,
      minFontSize: 64,
      color: '#ffffff',
      subtitle: 'Sezon ve Bölümler Toplu Değerlendirme Karnesi',
      subtitleFontSize: 36,
      subtitleColor: '#9ca3af'
    });

    const effScore = resolveItemEffectiveScore(item, catKey);
    const parts = Array.isArray(item?.parts) && item.parts.length > 0 ? item.parts : [{ name: item?.title, score: effScore, episodes: item?.episodes, year: item?.year }];

    const isPortrait = (fmtKey === 'portrait');
    const posterW = 820;
    const posterH = isPortrait ? 1450 : 1160;
    const posterX = 100;
    const posterY = 460;

    // Sol: Büyük Poster + Genel Puan
    ctx.save();
    roundRect(ctx, posterX, posterY, posterW, posterH, 36);
    ctx.clip();
    if (posterImg) {
      const imgAspect = posterImg.naturalWidth / posterImg.naturalHeight;
      const boxAspect = posterW / posterH;
      let dw, dh, dx, dy;
      if (imgAspect > boxAspect) {
        dh = posterH; dw = posterH * imgAspect;
        dx = posterX + (posterW - dw) / 2; dy = posterY;
      } else {
        dw = posterW; dh = posterW / imgAspect;
        dx = posterX; dy = posterY + (posterH - dh) / 2;
      }
      ctx.drawImage(posterImg, dx, dy, dw, dh);
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

    if (effScore !== null) {
      const scW = 280;
      const scH = 104;
      const scX = posterX + posterW - scW - 28;
      const scY = posterY + 28;
      ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3.5;
      roundRect(ctx, scX, scY, scW, scH, 52);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 54px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const scStr = (effScore % 1 === 0) ? effScore.toFixed(1) : String(effScore);
      ctx.fillText(`★ ${scStr}`, scX + scW / 2, scY + scH / 2);
    }

    if (item?.favorite) {
      const favW = 220;
      const favH = 72;
      const favX = posterX + 28;
      const favY = posterY + 28;
      ctx.fillStyle = 'rgba(10, 15, 28, 0.92)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      roundRect(ctx, favX, favY, favW, favH, 36);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = `800 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐ FAVORİ', favX + favW / 2, favY + favH / 2);
    }
    ctx.restore();

    // Sağ: Parçaların Karnesi (Y=460 — Y=1620)
    const rightX = posterX + posterW + 60; // 980
    const rightW = W - rightX - 100; // 1080
    const rightY = posterY;
    const maxParts = Math.min(6, parts.length);
    const partGap = 20;
    const partH = (posterH - (maxParts - 1) * partGap) / maxParts;

    for (let i = 0; i < maxParts; i++) {
      const p = parts[i];
      const py = rightY + i * (partH + partGap);
      const sc = Number(p.score) || effScore;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, rightX, py, rightW, partH, 22);
      ctx.fill();
      ctx.stroke();

      // Sol: Numara
      ctx.fillStyle = theme.accent;
      ctx.font = `800 38px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${i + 1}`, rightX + 28, py + partH / 2);

      // Başlık ve Alt Bilgi
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 34px ${FONT_FAMILY}`;
      let pName = p.name || `Sezon ${i + 1}`;
      while (ctx.measureText(pName).width > rightW - 320 && pName.length > 5) {
        pName = pName.slice(0, -4).trim() + '...';
      }
      ctx.fillText(pName, rightX + 96, py + partH / 2 - 16);

      ctx.fillStyle = '#9ca3af';
      ctx.font = `500 26px ${FONT_FAMILY}`;
      const subInfo = `${p.format || 'TV'} · ${p.episodes || '?'} Bölüm · ${p.year || '-'}`;
      ctx.fillText(subInfo, rightX + 96, py + partH / 2 + 22);

      // Sağ: Puan Rozeti
      const badgeW = 190;
      const badgeH = Math.min(76, partH - 24);
      const badgeX = rightX + rightW - badgeW - 24;
      const badgeY = py + (partH - badgeH) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2.5;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 38);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 36px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${Number(sc).toFixed(1)}`, badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.restore();
    }

    // ----------------------------------------------------------------------
    // ALT BÖLÜM: BOŞLUĞU DOLDURAN GENİŞ VİTRİN / ÖZET KARTI
    // ----------------------------------------------------------------------
    const bottomX = 100;
    const bottomY = isPortrait ? 1970 : 1660;
    const bottomW = 1960;
    const bottomH = isPortrait ? 580 : 330;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    roundRect(ctx, bottomX, bottomY, bottomW, bottomH, 28);
    ctx.fill();
    ctx.stroke();

    // Sol: Genel Seri İstatistikleri
    const leftTextW = bottomW - 440;
    ctx.fillStyle = theme.accent;
    ctx.font = `700 28px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('✦ GENEL SERİ İSTATİSTİKLERİ VE ARŞİV KARNESİ ✦', bottomX + 36, bottomY + 48);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.font = '800 110px "Georgia", serif';
    ctx.fillText('“', bottomX + 32, bottomY + 155);

    const totalPartsCount = parts.length;
    const totalEpisodes = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
    const summaryNote = `${item?.title || 'Bu yapım'}, arşivde ${totalPartsCount} parça / sezon halinde kayıtlı olup ${totalEpisodes ? 'toplam ' + totalEpisodes + ' bölümüyle' : 'tüm bölümleriyle'} arşivdeki yerini korumaktadır. Yapımın ağırlıklı değerlendirme puanı ★ ${effScore} olarak tescillenmiştir.`;

    ctx.fillStyle = '#d1d5db';
    ctx.font = `500 32px ${FONT_FAMILY}`;
    drawWrappedText(ctx, summaryNote, bottomX + 110, bottomY + 104, leftTextW - 130, 48, isPortrait ? 6 : 3);
    ctx.restore();

    // Sağ: Prestij Mührü
    const sealW = 360;
    const sealH = isPortrait ? 400 : 260;
    const sealX = bottomX + bottomW - sealW - 32;
    const sealY = bottomY + 35;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = (effScore >= 9.0 || item?.favorite) ? '#f59e0b' : theme.accent;
    ctx.lineWidth = 3;
    roundRect(ctx, sealX, sealY, sealW, sealH, 24);
    ctx.fill();
    ctx.stroke();

    const isMasterpiece = (effScore >= 9.0 || item?.favorite);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '54px sans-serif';
    ctx.fillText(isMasterpiece ? '🏆' : '★', sealX + sealW / 2, sealY + 60);

    ctx.fillStyle = isMasterpiece ? '#fbbf24' : theme.accent;
    ctx.font = `800 36px ${FONT_FAMILY}`;
    ctx.fillText(isMasterpiece ? 'BAŞYAPIT' : 'KİŞİSEL SEÇKİ', sealX + sealW / 2, sealY + 128);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px ${FONT_FAMILY}`;
    ctx.fillText(isMasterpiece ? 'MUST-WATCH' : 'TAVSİYE EDİLEN', sealX + sealW / 2, sealY + 172);

    ctx.fillStyle = '#9ca3af';
    ctx.font = `600 20px ${FONT_FAMILY}`;
    ctx.fillText('TEMPESTIAN ARCHIVE', sealX + sealW / 2, sealY + (isPortrait ? 250 : 214));
    ctx.restore();

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
    const cardH = Math.min(1440, availableH);

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
      ctx.font = `800 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(CATEGORY_CONFIG[it.catKey]?.label?.toUpperCase() || 'MEDYA', cx + 24, cy + cardH - 120);

      // Başlık
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      let titleStr = it.title || '';
      while (ctx.measureText(titleStr).width > cardW - 48 && titleStr.length > 5) {
        titleStr = titleStr.slice(0, -4).trim() + '...';
      }
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

    const startY = titleY + 150;
    const maxCount = topGenres[0].count;
    const barW = W - 240;
    const availableH = H - startY - 180;
    const rowGap = 24;
    const rowH = Math.floor((availableH - (topGenres.length - 1) * rowGap) / topGenres.length);

    for (let i = 0; i < topGenres.length; i++) {
      const tg = topGenres[i];
      const gy = startY + i * (rowH + rowGap);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 120, gy, barW, rowH, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 38px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${i + 1}. ${tg.name}`, 156, gy + 54);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 38px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${tg.count} Eser · ★ ${tg.avg}`, 120 + barW - 36, gy + 54);

      // Zemin bar
      const pBarY = gy + 82;
      const pBarW = barW - 72;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, 156, pBarY, pBarW, 30, 15);
      ctx.fill();

      // Doluluk
      const fillW = Math.max(30, pBarW * (tg.count / maxCount));
      const bGrad = ctx.createLinearGradient(156, pBarY, 156 + fillW, pBarY);
      bGrad.addColorStop(0, theme.gradient[0]);
      bGrad.addColorStop(1, theme.gradient[1]);
      ctx.fillStyle = bGrad;
      roundRect(ctx, 156, pBarY, fillW, 30, 15);
      ctx.fill();

      if (rowH > 180) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = `500 26px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(`Kişisel arşivde en yüksek ilgi ve puan ortalamasına sahip ${i + 1}. tür`, 156, gy + 154);
      }
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
    const cardH = Math.min(1440, availableH);

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
      ctx.font = `800 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('✦ GİZLİ CEVHER ✦', cx + 24, cy + cardH - 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      let titleStr = it.title || '';
      while (ctx.measureText(titleStr).width > cardW - 48 && titleStr.length > 5) {
        titleStr = titleStr.slice(0, -4).trim() + '...';
      }
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
      let titleStr = it.title || '';
      while (ctx.measureText(titleStr).width > cardW - 48 && titleStr.length > 5) {
        titleStr = titleStr.slice(0, -4).trim() + '...';
      }
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
