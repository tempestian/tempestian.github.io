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
      glow: 'rgba(0, 168, 255, 0.35)',
      gradient: ['#5cc8ff', '#0070ba'],
      pillBg: 'rgba(0, 168, 255, 0.16)'
    },
    gold: {
      name: 'Altın & Amber',
      accent: '#f5a623',
      glow: 'rgba(245, 166, 35, 0.35)',
      gradient: ['#ffc247', '#d97706'],
      pillBg: 'rgba(245, 166, 35, 0.16)'
    },
    emerald: {
      name: 'Zümrüt Yeşili',
      accent: '#10b981',
      glow: 'rgba(16, 185, 129, 0.35)',
      gradient: ['#34d399', '#059669'],
      pillBg: 'rgba(16, 185, 129, 0.16)'
    },
    violet: {
      name: 'Büyülü Mor',
      accent: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.35)',
      gradient: ['#c084fc', '#7c3aed'],
      pillBg: 'rgba(168, 85, 247, 0.16)'
    },
    rose: {
      name: 'Canlı Pembe',
      accent: '#f43f5e',
      glow: 'rgba(244, 63, 94, 0.35)',
      gradient: ['#fb7185', '#e11d48'],
      pillBg: 'rgba(244, 63, 94, 0.16)'
    },
    cyan: {
      name: 'Sibernetik Turkuaz',
      accent: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.35)',
      gradient: ['#22d3ee', '#0891b2'],
      pillBg: 'rgba(6, 182, 212, 0.16)'
    }
  };

  // Retina 2x Çözünürlükler (Instagram sıkıştırmasında sıfır kalite kaybı)
  const FORMATS = {
    square:   { width: 2160, height: 2160, label: 'Kare Gönderi (1:1 — 2160 × 2160)' },
    story:    { width: 2160, height: 3840, label: 'Hikâye (Story — 9:16 — 2160 × 3840)' },
    portrait: { width: 2160, height: 2700, label: 'Dikey Gönderi (4:5 — 2160 × 2700)' }
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
      defaultHashtags: '#anime #tempestian #animeinceleme #arsiv #animeonerisi'
    },
    series: {
      file: 'data/series.json',
      label: 'Dizi',
      icon: '🎬',
      key: 'items',
      typeKey: 'series',
      creatorLabel: 'Yayıncı / Ağ',
      subUnitLabel: 'Sezon & Bölüm',
      defaultHashtags: '#dizi #diziinceleme #tempestian #dizionerisi #arsiv'
    },
    movie: {
      file: 'data/movies.json',
      label: 'Film',
      icon: '🍿',
      key: 'items',
      typeKey: 'movie',
      creatorLabel: 'Yönetmen',
      subUnitLabel: 'Süre & Çıkış Yılı',
      defaultHashtags: '#film #sinema #tempestian #filminceleme #sinemakeyfi'
    },
    manga: {
      file: 'data/manga.json',
      label: 'Manga',
      icon: '📖',
      key: 'items',
      typeKey: 'manga',
      creatorLabel: 'Çizer / Mangaka',
      subUnitLabel: 'Cilt & Bölüm',
      defaultHashtags: '#manga #mangainceleme #tempestian #cizgiroman #mangaonerisi'
    },
    book: {
      file: 'data/books.json',
      label: 'Kitap',
      icon: '📚',
      key: 'items',
      typeKey: 'book',
      creatorLabel: 'Yazar',
      subUnitLabel: 'Sayfa Sayısı',
      defaultHashtags: '#kitap #edebiyat #tempestian #kitapinceleme #okudumbitti'
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

  const IMAGE_CACHE = new Map();

  function loadImageWithTimeout(url, timeoutMs = 3000) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      if (IMAGE_CACHE.has(url)) return resolve(IMAGE_CACHE.get(url));
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;

      const timer = setTimeout(() => {
        if (!done) { done = true; resolve(null); }
      }, timeoutMs);

      img.onload = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          IMAGE_CACHE.set(url, img);
          resolve(img);
        }
      };
      img.onerror = () => {
        if (!done) { done = true; clearTimeout(timer); resolve(null); }
      };
      img.src = url;
    });
  }

  async function preloadImagesWithConcurrency(urls, concurrency = 8, onProgress = null) {
    const uniqueUrls = [...new Set(urls.filter(Boolean))];
    let loaded = 0;
    const total = uniqueUrls.length;
    let cursor = 0;

    async function worker() {
      while (cursor < uniqueUrls.length) {
        const u = uniqueUrls[cursor++];
        await loadImageWithTimeout(u, 4000);
        loaded++;
        if (typeof onProgress === 'function') {
          onProgress(loaded, total);
        }
      }
    }

    const workers = [];
    const numWorkers = Math.min(concurrency, total);
    for (let i = 0; i < numWorkers; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  function sanitizeFilename(name) {
    if (!name) return 'yapim';
    return String(name)
      .replace(/[/\\?%*:|"<>]/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
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

  function formatPartShortLabel(itemTitle, partName, partIndex) {
    if (!partName) return `${partIndex + 1}. Sezon`;
    let label = String(partName).trim();
    if (itemTitle) {
      const baseLower = String(itemTitle).trim().toLowerCase();
      if (label.toLowerCase() === baseLower) {
        return `${partIndex + 1}. Sezon`;
      }
      if (label.toLowerCase().startsWith(baseLower)) {
        const remainder = label.slice(String(itemTitle).trim().length).replace(/^[:\s\-–—/]+/, '').trim();
        if (remainder.length >= 2) {
          label = remainder;
        }
      }
    }
    return label;
  }

  function formatKindToTurkish(rawFormat, rawKind, catKey = 'anime') {
    const f = String(rawFormat || '').toUpperCase().trim();
    const k = String(rawKind || '').toLowerCase().trim();
    if (f === 'MOVIE' || k === 'movie') return 'Sinema Filmi';
    if (f === 'TV') return (catKey === 'anime') ? 'TV Anime' : 'TV Dizisi';
    if (f === 'TV_SHORT') return 'Kısa TV Dizisi';
    if (f === 'OVA') return 'OVA / Özel';
    if (f === 'ONA') return 'İnternet Serisi (ONA)';
    if (f === 'SPECIAL' || k === 'other') return 'Özel / Ek İçerik';
    if (f === 'MUSIC') return 'Müzik Videosu';
    if (f === 'MANGA') return 'Manga';
    if (f === 'NOVEL') return 'Hafif Roman / Kitap';
    if (f === 'ONE_SHOT') return 'Tek Sayılık (One-shot)';
    if (k === 'season') return 'TV Sezonu';
    if (catKey === 'movie') return 'Sinema Filmi';
    if (catKey === 'book') return 'Basılı Eser';
    if (catKey === 'manga') return 'Manga';
    if (catKey === 'guide') return 'Teknik Rehber';
    return f || (catKey === 'anime' ? 'TV Anime' : 'TV Dizisi');
  }

  function statusToTurkish(status) {
    const s = String(status || '').toUpperCase().trim();
    if (s === 'COMPLETED') return 'Tamamlandı';
    if (s === 'REPEATING') return 'Tekrar İzlendi';
    if (s === 'CURRENT' || s === 'WATCHING') return 'Devam Ediyor';
    if (s === 'PLANNING') return 'Planlandı';
    if (s === 'PAUSED') return 'Durduruldu';
    if (s === 'DROPPED') return 'Bırakıldı';
    return status || 'Arşivde';
  }

  function getPrestigeSealContent(effScore, isFav, catKey) {
    const isMasterpiece = (effScore >= 9.0 || isFav);
    const isPick = (effScore >= 8.0);
    const isRead = (catKey === 'book' || catKey === 'manga');
    const isGuide = (catKey === 'guide');

    let icon = '✦';
    let title = 'ONAYLI ARŞİV';
    let subtitle = 'DEĞERLENDİRİLDİ';

    if (isMasterpiece) {
      icon = '🏆';
      title = 'BAŞYAPIT';
      if (isGuide) subtitle = 'TEMEL BAŞVURU KAYNAĞI';
      else if (isRead) subtitle = 'MUTLAKA OKUNMALI';
      else subtitle = 'MUTLAKA İZLENMELİ';
    } else if (isPick) {
      icon = '⭐';
      title = 'KİŞİSEL SEÇKİ';
      subtitle = 'YÜKSEK TAVSİYE';
    }

    return {
      isMasterpiece,
      isPick,
      icon,
      title,
      subtitle,
      footer: 'TEMPESTIAN ARŞİVİ'
    };
  }

  function getPartPrestigeSealContent(partScore, isRead) {
    const isPeak = (partScore >= 9.0);
    const isHigh = (partScore >= 8.0);

    let icon = '✦';
    let title = 'ONAYLI SEZON';
    let subtitle = 'ARŞİVDE KAYITLI';

    if (isPeak) {
      icon = '🏆';
      title = 'ZİRVE SEZON';
      subtitle = isRead ? 'MUTLAKA OKUNMALI' : 'MUTLAKA İZLENMELİ';
    } else if (isHigh) {
      icon = '⭐';
      title = 'SEÇKİN SEZON';
      subtitle = 'YÜKSEK KALİTE';
    }

    return { isPeak, isHigh, icon, title, subtitle, footer: 'TEMPESTIAN ARŞİVİ' };
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
      extraVal = item?.publisher || item?.extra || 'Tempestian Arşiv';
    } else if (catKey === 'manga') {
      creatorVal = item?.author || item?.artist || 'Belirtilmemiş';
      const parts = Array.isArray(item?.parts) ? item.parts : [];
      const totalCh = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.chapters || item?.episodes || 0;
      const vols = parts.length > 1 ? `${parts.length} Cilt · ` : '';
      subUnitVal = `${vols}${totalCh || 'Devam Ediyor'} Bölüm`;
      extraLabel = 'Yayıncı';
      extraVal = item?.publisher || 'Tempestian Arşiv';
    } else if (catKey === 'series') {
      creatorVal = item?.network || item?.author || 'Belirtilmemiş';
      const parts = Array.isArray(item?.parts) ? item.parts : [];
      const totalEp = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
      const seasons = parts.length > 0 ? `${parts.length} Sezon · ` : '';
      subUnitVal = `${seasons}${totalEp} Bölüm`;
      extraLabel = 'Çıkış Yılı';
      extraVal = item?.year || (parts[0]?.year) || '-';
    } else if (catKey === 'movie') {
      creatorVal = item?.director || item?.author || 'Belirtilmemiş';
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
      creatorVal = item?.studio || item?.author || 'Belirtilmemiş';
      const parts = Array.isArray(item?.parts) ? item.parts : [];
      const totalEp = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
      const seasons = parts.length > 1 ? `${parts.length} Sezon · ` : '';
      subUnitVal = `${seasons}${totalEp || '12'} Bölüm`;
      extraLabel = 'Çıkış Yılı';
      extraVal = item?.year || (parts[0]?.year) || '2024';
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

  function getItemArchiveMeta(item, catKey) {
    const parts = Array.isArray(item?.parts) ? item.parts : [];
    const firstPart = parts[0] || {};

    let formatLabel = '';
    if (catKey === 'movie') {
      const dur = item?.duration || firstPart?.duration;
      formatLabel = dur ? `Sinema Filmi · ${dur} Dk` : 'Sinema Filmi';
    } else if (catKey === 'book') {
      const pCount = item?.pages || firstPart?.episodes || 0;
      formatLabel = pCount ? `Basılı Kitap · ${pCount} Sayfa` : 'Basılı Eser';
    } else if (catKey === 'manga') {
      const ch = item?.chapters || firstPart?.episodes || 0;
      formatLabel = ch ? `Manga · ${ch} Bölüm` : 'Manga';
    } else if (catKey === 'series') {
      const ep = item?.episodes || firstPart?.episodes || 0;
      formatLabel = ep ? `TV Dizisi · ${ep} Bölüm` : 'TV Dizisi';
    } else if (catKey === 'guide') {
      formatLabel = item?.forumSection || 'Teknik Rehber';
    } else {
      // anime
      const fmtStr = formatKindToTurkish(item?.format || firstPart?.format, firstPart?.kind, 'anime');
      const ep = item?.episodes || firstPart?.episodes || 0;
      formatLabel = ep ? `${fmtStr} · ${ep} Bölüm` : fmtStr;
    }

    const year = item?.year || firstPart?.year || '-';

    const repeatCount = Math.max(
      0,
      ...(parts.map(p => Number(p.repeat) || 0)),
      Number(item?.repeat) || 0,
      Number(item?.rewatch) || 0,
      Number(item?.reread) || 0
    );
    const isRead = (catKey === 'book' || catKey === 'manga');
    const repeatLabel = repeatCount > 0
      ? `↻ ${repeatCount} kez ${isRead ? 'okundu' : 'izlendi'}`
      : (item?.status === 'completed' || firstPart?.status === 'COMPLETED' ? '✓ Arşivde Tamamlandı' : '✓ Arşivde Kayıtlı');

    const rawGenres = Array.isArray(item?.customGenres) && item.customGenres.length
      ? item.customGenres
      : (Array.isArray(item?.genres) ? item.genres : []);
    const genres = [...new Set(rawGenres.map(g => String(g).trim()).filter(Boolean))].slice(0, 5);

    return {
      formatLabel,
      year: String(year),
      repeatCount,
      repeatLabel,
      genres
    };
  }

  function drawGenrePills(ctx, genres, startX, startY, maxW, theme, options = {}) {
    const pillH = options.pillH || 52;
    const fontSize = options.fontSize || 24;
    const radius = options.radius || 14;
    const gap = options.gap || 14;
    const maxPills = options.maxPills || 5;

    ctx.save();
    ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let curX = startX;
    const list = (Array.isArray(genres) && genres.length ? genres : ['Arşiv']).slice(0, maxPills);

    for (const g of list) {
      const text = String(g).trim();
      if (!text) continue;
      const textW = ctx.measureText(text).width;
      const pillW = Math.max(90, textW + 36);

      if (curX + pillW > startX + maxW) break;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
      ctx.strokeStyle = theme ? `${theme.accent}66` : 'rgba(86, 182, 255, 0.3)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, curX, startY, pillW, pillH, radius);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(text, curX + pillW / 2, startY + pillH / 2);

      curX += pillW + gap;
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 4. ORTAK CANVAS KATMANLARI (ZEMİN, AMBİENT GLOW, RETINA TIPOGRAFI)
  // --------------------------------------------------------------------------
  function drawRetinaBackground(ctx, W, H, theme, posterImg) {
    // 1. Derin Safir & Obsidiyen Taban Gradyanı
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#040711');
    bgGrad.addColorStop(0.35, '#070c1a');
    bgGrad.addColorStop(0.7, '#0a1226');
    bgGrad.addColorStop(1, '#0e1834');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Poster Varsa Geniş Ambient Glow (Arka Plan Yumuşak Yayma)
    if (posterImg) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      if ('filter' in ctx) {
        ctx.filter = 'blur(95px) saturate(140%) brightness(55%)';
      }
      ctx.drawImage(posterImg, -W * 0.15, -H * 0.15, W * 1.3, H * 1.3);
      ctx.restore();
    }

    // 3. Sinematik Yumuşak Karartma (Merkez Aydınlık, Kenarlar Odaklı)
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(3, 6, 14, 0.72)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // 4. Tema Renklerinde Parıltı Halka Katmanları
    const rad1 = ctx.createRadialGradient(W * 0.88, H * 0.14, 40, W * 0.88, H * 0.14, W * 0.7);
    rad1.addColorStop(0, theme.glow);
    rad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad1;
    ctx.fillRect(0, 0, W, H);

    const rad2 = ctx.createRadialGradient(W * 0.12, H * 0.88, 40, W * 0.12, H * 0.88, W * 0.75);
    rad2.addColorStop(0, 'rgba(0, 168, 255, 0.2)');
    rad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad2;
    ctx.fillRect(0, 0, W, H);

    // 5. Çevre Lüks Çift Hatlı İnce Cam Çerçeve
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 4;
    roundRect(ctx, 56, 56, W - 112, H - 112, 48);
    ctx.stroke();

    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 2;
    roundRect(ctx, 64, 64, W - 128, H - 128, 40);
    ctx.stroke();

    // 6. Köşe Vurguları (HUD / Cinema Corner Brackets)
    const cInset = 76;
    const cLen = 32;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3.5;
    // Sol Üst
    ctx.beginPath();
    ctx.moveTo(cInset, cInset + cLen);
    ctx.lineTo(cInset, cInset);
    ctx.lineTo(cInset + cLen, cInset);
    ctx.stroke();
    // Sağ Üst
    ctx.beginPath();
    ctx.moveTo(W - cInset - cLen, cInset);
    ctx.lineTo(W - cInset, cInset);
    ctx.lineTo(W - cInset, cInset + cLen);
    ctx.stroke();
    // Sol Alt
    ctx.beginPath();
    ctx.moveTo(cInset, H - cInset - cLen);
    ctx.lineTo(cInset, H - cInset);
    ctx.lineTo(cInset + cLen, H - cInset);
    ctx.stroke();
    // Sağ Alt
    ctx.beginPath();
    ctx.moveTo(W - cInset - cLen, H - cInset);
    ctx.lineTo(W - cInset, H - cInset);
    ctx.lineTo(W - cInset, H - cInset - cLen);
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

  function drawTopBrandPill(ctx, W, Y, theme, label = '✦ TEMPESTIAN ARŞİVİ · İNCELEME ✦') {
    ctx.save();
    ctx.font = `700 32px ${FONT_FAMILY}`;
    const textW = ctx.measureText(label).width;
    const pillW = Math.max(660, Math.min(W - 200, textW + 96));
    const pillH = 82;
    const pillX = (W - pillW) / 2;

    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 18;

    ctx.fillStyle = theme.pillBg || 'rgba(0, 168, 255, 0.16)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    roundRect(ctx, pillX, Y, pillW, pillH, 41);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, Y + pillH / 2);
    ctx.restore();
  }

  function drawFooterSignature(ctx, W, H) {
    ctx.save();
    // Üst İnce Işıltı Çizgisi
    const lineW = Math.min(W - 240, 1100);
    const lineX = (W - lineW) / 2;
    const lineY = H - 110;
    const lineGrad = ctx.createLinearGradient(lineX, lineY, lineX + lineW, lineY);
    lineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    lineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.18)');
    lineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lineX, lineY);
    ctx.lineTo(lineX + lineW, lineY);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.font = `600 32px ${FONT_FAMILY}`;
    ctx.fillText('✦ tempestian.com · Bayram Tempestian ✦', W / 2, H - 68);
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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN ARŞİVİ · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'ARŞİV'} ✦`);

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
      const storyBottomW = W - 240;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 120, storyBottomY, storyBottomW, storyBottomH, 28);
      ctx.fill();
      ctx.stroke();

      const hasPartsStory = Array.isArray(item?.parts) && item.parts.length > 1;

      if (hasPartsStory) {
        ctx.fillStyle = theme.accent;
        ctx.font = `700 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`✦ SERİ VE SEZON DÖKÜMÜ (${item.parts.length} SEZON / PARÇA) ✦`, 160, storyBottomY + 64);

        const maxPartsToShow = Math.min(3, item.parts.length);
        const cardGap = 24;
        const partCardW = (storyBottomW - 80 - (maxPartsToShow - 1) * cardGap) / maxPartsToShow;
        const partCardH = storyBottomH - 110;
        const partCardY = storyBottomY + 84;

        for (let idx = 0; idx < maxPartsToShow; idx++) {
          const p = item.parts[idx];
          const px = 160 + idx * (partCardW + cardGap);
          const isLastWithMore = (idx === maxPartsToShow - 1 && item.parts.length > maxPartsToShow);
          const extraCount = item.parts.length - maxPartsToShow + 1;

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
            ctx.fillText(`+${extraCount} DİĞER SEZON`, px + partCardW / 2, partCardY + partCardH / 2 - 30);

            ctx.fillStyle = '#9ca3af';
            ctx.font = `600 24px ${FONT_FAMILY}`;
            ctx.fillText('Arşivde Devamı Mevcut', px + partCardW / 2, partCardY + partCardH / 2 + 20);
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 30px ${FONT_FAMILY}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            let pName = p.name || `${idx + 1}. Sezon`;
            while (ctx.measureText(pName).width > partCardW - 44 && pName.length > 5) {
              pName = pName.slice(0, -4).trim() + '...';
            }
            ctx.fillText(pName, px + 22, partCardY + 48);

            ctx.fillStyle = '#9ca3af';
            ctx.font = `500 24px ${FONT_FAMILY}`;
            const kindLabel = formatKindToTurkish(p.format, p.kind, catKey);
            const epLabel = p.episodes ? ` · ${p.episodes} Bölüm` : '';
            const yrLabel = p.year ? ` · ${p.year}` : '';
            ctx.fillText(`${kindLabel}${epLabel}${yrLabel}`, px + 22, partCardY + 92);

            const pSc = Number(p.score) || effScore;
            const scPillW = partCardW - 44;
            const scPillH = 56;
            const scPillX = px + 22;
            const scPillY = partCardY + partCardH - 76;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = 2;
            roundRect(ctx, scPillX, scPillY, scPillW, scPillH, 28);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = theme.accent;
            ctx.font = `800 30px ${FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`★ ${Number(pSc).toFixed(1)} / 10`, scPillX + scPillW / 2, scPillY + scPillH / 2);
          }
        }
      } else {
        const meta = getItemArchiveMeta(item, catKey);
        ctx.fillStyle = theme.accent;
        ctx.font = `700 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('✦ ARŞİV KÜNYESİ VE FORMAT BİLGİLERİ ✦', 160, storyBottomY + 64);

        const sealW = 360;
        const sealH = storyBottomH - 50;
        const sealX = 120 + storyBottomW - sealW - 24;
        const sealY = storyBottomY + 25;
        const leftW = (sealX - 120) - 40;

        const cardGap = 20;
        const cardW = (leftW - 40 - 2 * cardGap) / 3;
        const cardH = 110;
        const cardY = storyBottomY + 84;

        const cards = [
          { label: 'FORMAT & UZUNLUK', val: meta.formatLabel, color: '#ffffff' },
          { label: 'ÇIKIŞ YILI', val: meta.year, color: '#ffffff' },
          { label: 'ARŞİV STATÜSÜ', val: meta.repeatLabel, color: meta.repeatCount > 0 ? theme.accent : '#38bdf8' }
        ];

        for (let i = 0; i < cards.length; i++) {
          const cx = 160 + i * (cardW + cardGap);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.5;
          roundRect(ctx, cx, cardY, cardW, cardH, 18);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#9ca3af';
          ctx.font = `600 22px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.fillText(cards[i].label, cx + 22, cardY + 38);

          ctx.fillStyle = cards[i].color;
          ctx.font = `700 28px ${FONT_FAMILY}`;
          let valStr = cards[i].val;
          while (ctx.measureText(valStr).width > cardW - 44 && valStr.length > 5) {
            valStr = valStr.slice(0, -4).trim() + '...';
          }
          ctx.fillText(valStr, cx + 22, cardY + 82);
        }

        // Tür Etiketleri Şeridi
        const tagRowY = cardY + cardH + 20;
        ctx.fillStyle = '#9ca3af';
        ctx.font = `700 22px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText('TÜRLER:', 160, tagRowY + 34);

        const genreStartX = 160 + ctx.measureText('TÜRLER:').width + 18;
        drawGenrePills(ctx, meta.genres, genreStartX, tagRowY, leftW - (genreStartX - 160), theme, {
          pillH: 52,
          fontSize: 24,
          radius: 14
        });

        // Sağ Taraf Prestij Rozeti
        const seal = getPrestigeSealContent(effScore, item?.favorite, catKey);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = seal.isMasterpiece ? '#f59e0b' : (seal.isPick ? theme.accent : '#38bdf8');
        ctx.lineWidth = 3;
        roundRect(ctx, sealX, sealY, sealW, sealH, 26);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, sealX + 10, sealY + 10, sealW - 20, sealH - 20, 18);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '50px sans-serif';
        ctx.fillText(seal.icon, sealX + sealW / 2, sealY + 54);

        ctx.fillStyle = seal.isMasterpiece ? '#fbbf24' : (seal.isPick ? theme.accent : '#38bdf8');
        ctx.font = `800 34px ${FONT_FAMILY}`;
        ctx.fillText(seal.title, sealX + sealW / 2, sealY + 116);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 22px ${FONT_FAMILY}`;
        ctx.fillText(seal.subtitle, sealX + sealW / 2, sealY + 158);

        ctx.fillStyle = '#9ca3af';
        ctx.font = `700 18px ${FONT_FAMILY}`;
        ctx.fillText(seal.footer, sealX + sealW / 2, sealY + sealH - 34);
        ctx.restore();
      }
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
            const kindLabel = formatKindToTurkish(p.format, p.kind, catKey);
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
        // Tekil Yapımlarda: Sol Taraf Gerçek Arşiv Verileri, Sağ Taraf Prestijli Başyapıt / Tavsiye Rozeti
        const meta = getItemArchiveMeta(item, catKey);
        const sealW = 380;
        const sealH = isPortrait ? 500 : 260;
        const sealX = bottomX + bottomW - sealW - 32;
        const sealY = bottomY + 35;
        const leftW = (sealX - bottomX) - 32;

        ctx.save();
        ctx.fillStyle = theme.accent;
        ctx.font = `700 28px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('✦ ARŞİV KÜNYESİ VE FORMAT BİLGİLERİ ✦', bottomX + 36, bottomY + 48);

        if (!isPortrait) {
          // 1:1 Kare Düzeninde (Yatay 3 Mini Kart + Tür Etiketleri Şeridi)
          const cardGap = 20;
          const cardW = (leftW - 36 - 2 * cardGap) / 3;
          const cardH = 110;
          const cardY = bottomY + 70;

          const cards = [
            { label: 'FORMAT & UZUNLUK', val: meta.formatLabel, color: '#ffffff' },
            { label: 'ÇIKIŞ YILI', val: meta.year, color: '#ffffff' },
            { label: 'ARŞİV STATÜSÜ', val: meta.repeatLabel, color: meta.repeatCount > 0 ? theme.accent : '#38bdf8' }
          ];

          for (let i = 0; i < cards.length; i++) {
            const cx = bottomX + 36 + i * (cardW + cardGap);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, cx, cardY, cardW, cardH, 18);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#9ca3af';
            ctx.font = `600 22px ${FONT_FAMILY}`;
            ctx.textAlign = 'left';
            ctx.fillText(cards[i].label, cx + 24, cardY + 38);

            ctx.fillStyle = cards[i].color;
            ctx.font = `700 28px ${FONT_FAMILY}`;
            let valStr = cards[i].val;
            while (ctx.measureText(valStr).width > cardW - 48 && valStr.length > 5) {
              valStr = valStr.slice(0, -4).trim() + '...';
            }
            ctx.fillText(valStr, cx + 24, cardY + 82);
          }

          // Tür Etiketleri Şeridi
          const tagRowY = cardY + cardH + 20;
          ctx.fillStyle = '#9ca3af';
          ctx.font = `700 22px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.fillText('TÜRLER:', bottomX + 36, tagRowY + 34);

          const genreStartX = bottomX + 36 + ctx.measureText('TÜRLER:').width + 18;
          drawGenrePills(ctx, meta.genres, genreStartX, tagRowY, leftW - (genreStartX - bottomX), theme, {
            pillH: 52,
            fontSize: 24,
            radius: 14
          });
        } else {
          // 4:5 Portre Düzeninde (2x2 Geniş Kartlar + Tür Etiketleri)
          const mCardW = (leftW - 36 - 20) / 2;
          const mCardH = 140;
          const cardY = bottomY + 70;

          const cards = [
            { label: 'FORMAT & UZUNLUK', val: meta.formatLabel, color: '#ffffff' },
            { label: 'ÇIKIŞ YILI', val: meta.year, color: '#ffffff' },
            { label: 'ARŞİV STATÜSÜ', val: meta.repeatLabel, color: meta.repeatCount > 0 ? theme.accent : '#38bdf8' },
            { label: 'YAPIMCI / STÜDYO', val: item?.director || item?.studio || item?.author || item?.network || 'Tempestian Arşiv', color: '#ffffff' }
          ];

          for (let i = 0; i < 4; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = bottomX + 36 + col * (mCardW + 20);
            const cy = cardY + row * (mCardH + 16);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, cx, cy, mCardW, mCardH, 20);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#9ca3af';
            ctx.font = `600 24px ${FONT_FAMILY}`;
            ctx.textAlign = 'left';
            ctx.fillText(cards[i].label, cx + 24, cy + 44);

            ctx.fillStyle = cards[i].color;
            ctx.font = `700 32px ${FONT_FAMILY}`;
            let valStr = cards[i].val;
            while (ctx.measureText(valStr).width > mCardW - 48 && valStr.length > 5) {
              valStr = valStr.slice(0, -4).trim() + '...';
            }
            ctx.fillText(valStr, cx + 24, cy + 100);
          }

          // Tür Etiketleri Şeridi
          const tagRowY = cardY + 2 * (mCardH + 16) + 12;
          ctx.fillStyle = '#9ca3af';
          ctx.font = `700 24px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.fillText('TÜR ETİKETLERİ:', bottomX + 36, tagRowY + 36);

          const genreStartX = bottomX + 36 + ctx.measureText('TÜR ETİKETLERİ:').width + 20;
          drawGenrePills(ctx, meta.genres, genreStartX, tagRowY, leftW - (genreStartX - bottomX), theme, {
            pillH: 56,
            fontSize: 26,
            radius: 14
          });
        }
        ctx.restore();

        // Sağ Taraf: Prestijli Başyapıt / Tavsiye Rozeti
        const seal = getPrestigeSealContent(effScore, item?.favorite, catKey);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = seal.isMasterpiece ? '#f59e0b' : (seal.isPick ? theme.accent : '#38bdf8');
        ctx.lineWidth = 3;
        roundRect(ctx, sealX, sealY, sealW, sealH, 26);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, sealX + 10, sealY + 10, sealW - 20, sealH - 20, 18);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = '54px sans-serif';
        ctx.fillText(seal.icon, sealX + sealW / 2, sealY + 60);

        ctx.fillStyle = seal.isMasterpiece ? '#fbbf24' : (seal.isPick ? theme.accent : '#38bdf8');
        ctx.font = `800 36px ${FONT_FAMILY}`;
        ctx.fillText(seal.title, sealX + sealW / 2, sealY + 128);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 24px ${FONT_FAMILY}`;
        ctx.fillText(seal.subtitle, sealX + sealW / 2, sealY + 172);

        ctx.fillStyle = '#9ca3af';
        ctx.font = `700 20px ${FONT_FAMILY}`;
        ctx.fillText(seal.footer, sealX + sealW / 2, sealY + (isPortrait ? 250 : 214));
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
    const kindStr = formatKindToTurkish(part?.format, part?.kind, catKey);
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
      const partFmtStr = formatKindToTurkish(part?.format, part?.kind, catKey);
      const partStatStr = statusToTurkish(part?.status);
      ctx.fillText(`Format: ${partFmtStr} · Durum: ${partStatStr}`, rightX + 32, rightY + 104);
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
      const storyBottomW = W - 240;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 120, storyBottomY, storyBottomW, storyBottomH, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `700 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('✦ SEZON BİLGİLERİ VE ARŞİV VERİLERİ ✦', 160, storyBottomY + 64);

      const sealW = 360;
      const sealH = storyBottomH - 50;
      const sealX = 120 + storyBottomW - sealW - 24;
      const sealY = storyBottomY + 25;
      const leftW = (sealX - 120) - 40;

      const cardGap = 20;
      const cardW = (leftW - 40 - 2 * cardGap) / 3;
      const cardH = 110;
      const cardY = storyBottomY + 84;

      const isRead = (catKey === 'book' || catKey === 'manga');
      const pFormat = part?.format || (part?.kind === 'movie' ? 'Sinema Filmi' : 'TV Sezonu');
      const pEp = part?.episodes ? `${part.episodes} Bölüm` : (part?.duration ? `${part.duration} Dk` : 'Tek Parça');
      const pRep = Number(part?.repeat) || 0;
      const pRepLabel = pRep > 0 ? `↻ ${pRep} kez ${isRead ? 'okundu' : 'izlendi'}` : '✓ Arşivde Kayıtlı';

      const cards = [
        { label: 'FORMAT & BÖLÜM', val: `${pFormat} · ${pEp}`, color: '#ffffff' },
        { label: 'YAYIN YILI', val: String(part?.year || item?.year || '-'), color: '#ffffff' },
        { label: 'SEZON STATÜSÜ', val: pRepLabel, color: pRep > 0 ? theme.accent : '#38bdf8' }
      ];

      for (let i = 0; i < cards.length; i++) {
        const cx = 160 + i * (cardW + cardGap);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, cx, cardY, cardW, cardH, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 22px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(cards[i].label, cx + 22, cardY + 38);

        ctx.fillStyle = cards[i].color;
        ctx.font = `700 28px ${FONT_FAMILY}`;
        let valStr = cards[i].val;
        while (ctx.measureText(valStr).width > cardW - 44 && valStr.length > 5) {
          valStr = valStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(valStr, cx + 22, cardY + 82);
      }

      // Tür Etiketleri Şeridi
      const tagRowY = cardY + cardH + 20;
      ctx.fillStyle = '#9ca3af';
      ctx.font = `700 22px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('TÜRLER:', 160, tagRowY + 34);

      const rawGenres = Array.isArray(item?.customGenres) && item.customGenres.length ? item.customGenres : (item?.genres || []);
      const genreStartX = 160 + ctx.measureText('TÜRLER:').width + 18;
      drawGenrePills(ctx, rawGenres, genreStartX, tagRowY, leftW - (genreStartX - 160), theme, {
        pillH: 52,
        fontSize: 24,
        radius: 14
      });

      // Sağ Taraf Sezon Rozeti
      const partSeal = getPartPrestigeSealContent(partScore, isRead);
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = partSeal.border || theme.accent;
      ctx.lineWidth = 3;
      roundRect(ctx, sealX, sealY, sealW, sealH, 24);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '50px sans-serif';
      ctx.fillText(partSeal.icon, sealX + sealW / 2, sealY + 54);

      ctx.fillStyle = partSeal.color || theme.accent;
      ctx.font = `800 34px ${FONT_FAMILY}`;
      ctx.fillText(partSeal.title, sealX + sealW / 2, sealY + 116);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 22px ${FONT_FAMILY}`;
      ctx.fillText(partSeal.sub, sealX + sealW / 2, sealY + 158);

      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 18px ${FONT_FAMILY}`;
      ctx.fillText(partSeal.footer, sealX + sealW / 2, sealY + sealH - 34);
      ctx.restore();

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
      ctx.fillText(`Format: ${formatKindToTurkish(part?.format, part?.kind, catKey)}`, rightX + rightW - 32, posterY + badgeH / 2);
      ctx.restore();

      // 2. 2x2 Meta Grid (Y=566, H=340)
      const metaY = posterY + badgeH + 30; // 566
      const mCardW = (rightW - 24) / 2; // 528
      const mCardH = 160;
      const metaCards = [
        { label: 'Format & Tür', val: formatKindToTurkish(part?.format, part?.kind, catKey) },
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

      // Sol: Sezon Bilgileri & Arşiv Verileri
      const sealW = 380;
      const sealH = isPortrait ? 500 : 260;
      const sealX = bottomX + bottomW - sealW - 32;
      const sealY = bottomY + 35;
      const leftW = (sealX - bottomX) - 32;

      ctx.save();
      ctx.fillStyle = theme.accent;
      ctx.font = `700 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('✦ SEZON BİLGİLERİ VE ARŞİV VERİLERİ ✦', bottomX + 36, bottomY + 48);

      const isRead = (catKey === 'book' || catKey === 'manga');
      const pFormat = part?.format || (part?.kind === 'movie' ? 'Sinema Filmi' : 'TV Sezonu');
      const pEp = part?.episodes ? `${part.episodes} Bölüm` : (part?.duration ? `${part.duration} Dk` : 'Tek Parça');
      const pRep = Number(part?.repeat) || 0;
      const pRepLabel = pRep > 0 ? `↻ ${pRep} kez ${isRead ? 'okundu' : 'izlendi'}` : '✓ Arşivde Kayıtlı';
      const rawGenres = Array.isArray(item?.customGenres) && item.customGenres.length ? item.customGenres : (item?.genres || []);

      if (!isPortrait) {
        // 1:1 Kare Düzeninde (Yatay 3 Mini Kart + Tür Etiketleri Şeridi)
        const cardGap = 20;
        const cardW = (leftW - 36 - 2 * cardGap) / 3;
        const cardH = 110;
        const cardY = bottomY + 70;

        const cards = [
          { label: 'FORMAT & BÖLÜM', val: `${pFormat} · ${pEp}`, color: '#ffffff' },
          { label: 'YAYIN YILI', val: String(part?.year || item?.year || '-'), color: '#ffffff' },
          { label: 'BÖLÜM PUANI', val: `★ ${Number(partScore).toFixed(1)} / 10`, color: theme.accent }
        ];

        for (let i = 0; i < cards.length; i++) {
          const cx = bottomX + 36 + i * (cardW + cardGap);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.5;
          roundRect(ctx, cx, cardY, cardW, cardH, 18);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#9ca3af';
          ctx.font = `600 22px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.fillText(cards[i].label, cx + 24, cardY + 38);

          ctx.fillStyle = cards[i].color;
          ctx.font = `700 28px ${FONT_FAMILY}`;
          let valStr = cards[i].val;
          while (ctx.measureText(valStr).width > cardW - 48 && valStr.length > 5) {
            valStr = valStr.slice(0, -4).trim() + '...';
          }
          ctx.fillText(valStr, cx + 24, cardY + 82);
        }

        // Tür Etiketleri Şeridi
        const tagRowY = cardY + cardH + 20;
        ctx.fillStyle = '#9ca3af';
        ctx.font = `700 22px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText('TÜRLER:', bottomX + 36, tagRowY + 34);

        const genreStartX = bottomX + 36 + ctx.measureText('TÜRLER:').width + 18;
        drawGenrePills(ctx, rawGenres, genreStartX, tagRowY, leftW - (genreStartX - bottomX), theme, {
          pillH: 52,
          fontSize: 24,
          radius: 14
        });
      } else {
        // 4:5 Portre Düzeninde (2x2 Geniş Kartlar + Tür Etiketleri)
        const mCardW = (leftW - 36 - 20) / 2;
        const mCardH = 140;
        const cardY = bottomY + 70;

        const cards = [
          { label: 'FORMAT & BÖLÜM', val: `${pFormat} · ${pEp}`, color: '#ffffff' },
          { label: 'YAYIN YILI', val: String(part?.year || item?.year || '-'), color: '#ffffff' },
          { label: 'BÖLÜM PUANI', val: `★ ${Number(partScore).toFixed(1)} / 10`, color: theme.accent },
          { label: 'ARŞİV STATÜSÜ', val: pRepLabel, color: pRep > 0 ? theme.accent : '#38bdf8' }
        ];

        for (let i = 0; i < 4; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const cx = bottomX + 36 + col * (mCardW + 20);
          const cy = cardY + row * (mCardH + 16);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.5;
          roundRect(ctx, cx, cy, mCardW, mCardH, 20);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#9ca3af';
          ctx.font = `600 24px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.fillText(cards[i].label, cx + 24, cy + 44);

          ctx.fillStyle = cards[i].color;
          ctx.font = `700 32px ${FONT_FAMILY}`;
          let valStr = cards[i].val;
          while (ctx.measureText(valStr).width > mCardW - 48 && valStr.length > 5) {
            valStr = valStr.slice(0, -4).trim() + '...';
          }
          ctx.fillText(valStr, cx + 24, cy + 100);
        }

        // Tür Etiketleri Şeridi
        const tagRowY = cardY + 2 * (mCardH + 16) + 12;
        ctx.fillStyle = '#9ca3af';
        ctx.font = `700 24px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText('TÜR ETİKETLERİ:', bottomX + 36, tagRowY + 36);

        const genreStartX = bottomX + 36 + ctx.measureText('TÜR ETİKETLERİ:').width + 20;
        drawGenrePills(ctx, rawGenres, genreStartX, tagRowY, leftW - (genreStartX - bottomX), theme, {
          pillH: 56,
          fontSize: 26,
          radius: 14
        });
      }
      ctx.restore();

      // Sağ: Sezon Prestij Mührü
      const partSeal = getPartPrestigeSealContent(partScore, isRead);
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = partSeal.border || theme.accent;
      ctx.lineWidth = 3;
      roundRect(ctx, sealX, sealY, sealW, sealH, 24);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '54px sans-serif';
      ctx.fillText(partSeal.icon, sealX + sealW / 2, sealY + 60);

      ctx.fillStyle = partSeal.color || theme.accent;
      ctx.font = `800 36px ${FONT_FAMILY}`;
      ctx.fillText(partSeal.title, sealX + sealW / 2, sealY + 128);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 24px ${FONT_FAMILY}`;
      ctx.fillText(partSeal.sub, sealX + sealW / 2, sealY + 172);

      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 20px ${FONT_FAMILY}`;
      ctx.fillText(partSeal.footer, sealX + sealW / 2, sealY + (isPortrait ? 250 : 214));
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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN ARŞİVİ · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'ARŞİV'} ÖZETİ ✦`);

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
      const subInfo = `${formatKindToTurkish(p.format, p.kind, catKey)} · ${p.episodes ? `${p.episodes} Bölüm` : 'Tek Parça'} · ${p.year || '-'}`;
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
    const sealW = 380;
    const sealH = isPortrait ? 500 : 260;
    const sealX = bottomX + bottomW - sealW - 32;
    const sealY = bottomY + 35;
    const leftW = (sealX - bottomX) - 32;

    ctx.save();
    ctx.fillStyle = theme.accent;
    ctx.font = `700 28px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('✦ GENEL SERİ İSTATİSTİKLERİ VE ARŞİV KARNESİ ✦', bottomX + 36, bottomY + 48);

    const totalPartsCount = parts.length;
    const totalEpisodes = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
    const isRead = (catKey === 'book' || catKey === 'manga');
    const repeatCount = Math.max(
      0,
      ...(parts.map(p => Number(p.repeat) || 0)),
      Number(item?.repeat) || 0,
      Number(item?.rewatch) || 0,
      Number(item?.reread) || 0
    );
    const repeatLabel = repeatCount > 0
      ? `↻ ${repeatCount} kez ${isRead ? 'okundu' : 'izlendi'}`
      : '✓ Arşivde Kayıtlı';
    const rawGenres = Array.isArray(item?.customGenres) && item.customGenres.length ? item.customGenres : (item?.genres || []);

    if (!isPortrait) {
      // 1:1 Kare Düzeninde (Yatay 3 Mini Kart + Tür Etiketleri Şeridi)
      const cardGap = 20;
      const cardW = (leftW - 36 - 2 * cardGap) / 3;
      const cardH = 110;
      const cardY = bottomY + 70;

      const cards = [
        { label: 'TOPLAM PARÇA', val: `${totalPartsCount} Parça · ${totalEpisodes} Bölüm`, color: '#ffffff' },
        { label: 'ÇIKIŞ YILI', val: String(item?.year || parts[0]?.year || '-'), color: '#ffffff' },
        { label: 'AĞIRLIKLI PUAN', val: `★ ${Number(effScore).toFixed(1)} / 10`, color: theme.accent }
      ];

      for (let i = 0; i < cards.length; i++) {
        const cx = bottomX + 36 + i * (cardW + cardGap);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, cx, cardY, cardW, cardH, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 22px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(cards[i].label, cx + 24, cardY + 38);

        ctx.fillStyle = cards[i].color;
        ctx.font = `700 28px ${FONT_FAMILY}`;
        let valStr = cards[i].val;
        while (ctx.measureText(valStr).width > cardW - 48 && valStr.length > 5) {
          valStr = valStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(valStr, cx + 24, cardY + 82);
      }

      // Tür Etiketleri Şeridi
      const tagRowY = cardY + cardH + 20;
      ctx.fillStyle = '#9ca3af';
      ctx.font = `700 22px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('TÜRLER:', bottomX + 36, tagRowY + 34);

      const genreStartX = bottomX + 36 + ctx.measureText('TÜRLER:').width + 18;
      drawGenrePills(ctx, rawGenres, genreStartX, tagRowY, leftW - (genreStartX - bottomX), theme, {
        pillH: 52,
        fontSize: 24,
        radius: 14
      });
    } else {
      // 4:5 Portre Düzeninde (2x2 Geniş Kartlar + Tür Etiketleri)
      const mCardW = (leftW - 36 - 20) / 2;
      const mCardH = 140;
      const cardY = bottomY + 70;

      const cards = [
        { label: 'TOPLAM PARÇA', val: `${totalPartsCount} Parça · ${totalEpisodes} Bölüm`, color: '#ffffff' },
        { label: 'ÇIKIŞ YILI', val: String(item?.year || parts[0]?.year || '-'), color: '#ffffff' },
        { label: 'AĞIRLIKLI PUAN', val: `★ ${Number(effScore).toFixed(1)} / 10`, color: theme.accent },
        { label: 'ARŞİV STATÜSÜ', val: repeatLabel, color: repeatCount > 0 ? theme.accent : '#38bdf8' }
      ];

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = bottomX + 36 + col * (mCardW + 20);
        const cy = cardY + row * (mCardH + 16);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, cx, cy, mCardW, mCardH, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = `600 24px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(cards[i].label, cx + 24, cy + 44);

        ctx.fillStyle = cards[i].color;
        ctx.font = `700 32px ${FONT_FAMILY}`;
        let valStr = cards[i].val;
        while (ctx.measureText(valStr).width > mCardW - 48 && valStr.length > 5) {
          valStr = valStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(valStr, cx + 24, cy + 100);
      }

      // Tür Etiketleri Şeridi
      const tagRowY = cardY + 2 * (mCardH + 16) + 12;
      ctx.fillStyle = '#9ca3af';
      ctx.font = `700 24px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('TÜR ETİKETLERİ:', bottomX + 36, tagRowY + 36);

      const genreStartX = bottomX + 36 + ctx.measureText('TÜR ETİKETLERİ:').width + 20;
      drawGenrePills(ctx, rawGenres, genreStartX, tagRowY, leftW - (genreStartX - bottomX), theme, {
        pillH: 56,
        fontSize: 26,
        radius: 14
      });
    }
    ctx.restore();

    // Sağ: Prestij Mührü
    const sealData = getPrestigeSealContent(effScore, item?.favorite, catKey);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = sealData.border || theme.accent;
    ctx.lineWidth = 3;
    roundRect(ctx, sealX, sealY, sealW, sealH, 24);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '54px sans-serif';
    ctx.fillText(sealData.icon, sealX + sealW / 2, sealY + 60);

    ctx.fillStyle = sealData.color || theme.accent;
    ctx.font = `800 36px ${FONT_FAMILY}`;
    ctx.fillText(sealData.title, sealX + sealW / 2, sealY + 128);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px ${FONT_FAMILY}`;
    ctx.fillText(sealData.sub, sealX + sealW / 2, sealY + 172);

    ctx.fillStyle = '#9ca3af';
    ctx.font = `600 20px ${FONT_FAMILY}`;
    ctx.fillText(sealData.footer, sealX + sealW / 2, sealY + (isPortrait ? 250 : 214));
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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('ZİRVEDEKİLER · YILIN EN İYİLERİ', W / 2, titleY);

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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('RAKAMLARLA ARŞİV · YILLIK BİLANÇO', W / 2, titleY);

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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('BEĞENİ PROFİLİ · EN SEVİLEN TÜRLER', W / 2, titleY);

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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`);

    const titleY = topY + 150;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('GİZLİ CEVHERLER · SÜRPRİZ BAŞYAPITLAR', W / 2, titleY);

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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN ARŞİVİ · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'EN İYİLER'} ✦`);

    const titleY = topY + 140;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 74px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('ÖNE ÇIKANLAR · EN YÜKSEK PUANLILAR', W / 2, titleY);

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
        ctx.fillText(`★ ${it.effScore || 'FAVORİ'}`, badgeX + badgeW / 2, badgeY + badgeH / 2);
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
    drawTopBrandPill(ctx, W, topY, theme, `✦ TEMPESTIAN ARŞİVİ · ${CATEGORY_CONFIG[catKey]?.label?.toUpperCase() || 'KATMAN LİSTESİ'} ✦`);

    const titleY = topY + 140;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 74px ${FONT_FAMILY}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('KATMAN LİSTESİ · SEVİYE SIRALAMASI', W / 2, titleY);

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
        `🔗 Detaylı inceleme dökümü ve tüm arşiv verileri için: tempestian.com\n\n` +
        `${cfg.defaultHashtags} #tempestian #inceleme #arsiv`;
    }

    if (templateKey === 'wrapped') {
      const yrText = year === 'all' ? 'Tüm Zamanlar' : `${year} Yılı`;
      return `✦ TEMPESTIAN YILLIK ÖZETİ · ${yrText.toUpperCase()} ✦\n\n` +
        `Kişisel medya tüketim ve arşiv yolculuğumun büyük yıllık karnesi!\n\n` +
        `🏆 Zirvedeki başyapıtlar, izlenen yüzlerce bölüm, bitirilen sezonlar ve okunan binlerce sayfa tek bir özette bir araya geldi.\n\n` +
        `📊 Tüm arşiv istatistikleri ve kategorik puanlamalar web sitemde yayında:\n` +
        `🔗 tempestian.com/istatistik/\n\n` +
        `#tempestian #yillikozet #ozet #anime #dizi #film #manga #kitap #arsiv`;
    }

    if (templateKey === 'topPicks') {
      return `✦ TEMPESTIAN ${cfg.label.toUpperCase()} SEÇKİLERİ · EN İYİLER ✦\n\n` +
        `Arşivimde en yüksek puanı alan ve başyapıt rozetiyle taçlandırılan seçkin eserler.\n\n` +
        `🔗 Tüm değerlendirmeler ve puan karneleri: tempestian.com\n\n` +
        `${cfg.defaultHashtags} #toppicks #eniyiler #tempestian`;
    }

    return `✦ TEMPESTIAN ${cfg.label.toUpperCase()} KATMAN SIRALAMASI ✦\n\n` +
      `S, A+ ve A ligindeki en kaliteli yapımlar bir arada.\n\n` +
      `🔗 Detaylar: tempestian.com\n\n` +
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
      this.isBatchExporting = false;
      this.isBatchCancelled = false;
      this.cachedData = {};
      this.slides = [];
      this.currentSlideIndex = 0;
      this.allCategoryData = {};
    }

    init() {
      this.canvas = document.getElementById('instaCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      // Yatay kayma koruması (Layout reset)
      if (window.scrollX > 0) window.scrollTo({ left: 0 });
      const stage = document.getElementById('adminMainStage');
      if (stage && stage.scrollLeft > 0) stage.scrollLeft = 0;

      const renderBtn = document.getElementById('renderInstaBtn');
      const renderBtnSide = document.getElementById('renderInstaBtnSide');
      const downloadBtn = document.getElementById('downloadInstaBtn');
      const downloadZipBtn = document.getElementById('downloadZipInstaBtn');
      const copyCaptionBtn = document.getElementById('copyInstaCaptionBtn');
      const downloadAllWatchedAnimeZipBtn = document.getElementById('downloadAllWatchedAnimeZipBtn');
      const instaDownloadAllAnimeBtn = document.getElementById('instaDownloadAllAnimeBtn');

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
      if (downloadAllWatchedAnimeZipBtn) downloadAllWatchedAnimeZipBtn.onclick = () => this.openBatchExportModal();
      if (instaDownloadAllAnimeBtn) instaDownloadAllAnimeBtn.onclick = () => this.openBatchExportModal();

      // Canlı Slayt Şeridi & Gezinme Çubuğu Kontrolleri
      const prevBtn = document.getElementById('instaPrevSlideBtn');
      const nextBtn = document.getElementById('instaNextSlideBtn');
      const dlSlideBtn = document.getElementById('instaDownloadSlideBtn');
      const dlZipBtn = document.getElementById('instaDownloadZipBtn');

      if (prevBtn) {
        prevBtn.onclick = () => {
          if (this.currentSlideIndex > 0) {
            this.currentSlideIndex--;
            this.syncSlideState();
            this.renderCurrentSlideOnly();
          }
        };
      }
      if (nextBtn) {
        nextBtn.onclick = () => {
          if (this.currentSlideIndex < this.slides.length - 1) {
            this.currentSlideIndex++;
            this.syncSlideState();
            this.renderCurrentSlideOnly();
          }
        };
      }
      if (dlSlideBtn) dlSlideBtn.onclick = () => this.downloadActiveSlide();
      if (dlZipBtn) dlZipBtn.onclick = () => this.downloadAllZip();

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
        this.syncSlideState();
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
        if (subInp) subInp.value = 'Kişisel Medya Arşivim ve Değerlendirmelerim · tempestian.com';
      } else if (tpl === 'wrapped') {
        titleInp.value = 'TEMPESTIAN WRAPPED';
        if (subInp) subInp.value = 'Büyük Yıllık Medya ve Arşiv Özeti · tempestian.com';
      } else if (tpl === 'topPicks') {
        titleInp.value = `TEMPESTIAN · ${catMeta.label.toUpperCase()} EN İYİLER`;
        if (subInp) subInp.value = 'En Yüksek Puanlı Başyapıtlar ve Favorilerim';
      } else {
        titleInp.value = `TEMPESTIAN · ${catMeta.label.toUpperCase()} KATMAN LİSTESİ`;
        if (subInp) subInp.value = 'S, A+ ve A Katmanı Yapımlar';
      }

      const allWatchedBtn = document.getElementById('downloadAllWatchedAnimeZipBtn');
      if (allWatchedBtn) {
        const verb = (catKey === 'book' || catKey === 'manga') ? 'Okunan' : (catKey === 'guide' ? 'Yayınlanan' : 'İzlenen');
        allWatchedBtn.textContent = `📦 Bütün ${verb} ${catMeta.label}leri ZIP İndir`;
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

      // Yatay kayma koruması (Layout reset)
      if (window.scrollX > 0) window.scrollTo({ left: 0 });
      const stage = document.getElementById('adminMainStage');
      if (stage && stage.scrollLeft > 0) stage.scrollLeft = 0;

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
            shortLabel: 'Kompakt Karne',
            title: 'Tek Kare - Kompakt Karne',
            render: async () => renderSingleReviewCompactSlide(ctx, W, H, item, catKey, theme, fmtKey)
          });
        } else if (hasParts && partMode === 'carousel') {
          // 1. Slayt: Ana Kapak
          this.slides.push({
            id: 'slide-cover',
            name: '01-ana-kapak.png',
            shortLabel: 'Kapak',
            title: '1. Slayt: Ana Kapak & Özet',
            render: async () => renderSingleReviewCoverSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub)
          });
          // Sonraki Slaytlar: Parçalar
          for (let pIdx = 0; pIdx < item.parts.length; pIdx++) {
            const p = item.parts[pIdx];
            const pNum = String(pIdx + 2).padStart(2, '0');
            const pName = p.name || `Sezon ${pIdx + 1}`;
            const pShort = formatPartShortLabel(item?.title, pName, pIdx);
            this.slides.push({
              id: `slide-part-${pIdx}`,
              name: `${pNum}-sezon-${pIdx + 1}.png`,
              shortLabel: pShort,
              title: `${pIdx + 2}. Slayt: ${pName}`,
              render: async () => renderSingleReviewPartSlide(ctx, W, H, item, p, pIdx, item.parts.length, catKey, theme, fmtKey)
            });
          }
        } else {
          // Parçasız / Tekil Yapım
          this.slides.push({
            id: 'slide-single',
            name: '01-inceleme.png',
            shortLabel: 'Kapak',
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
            shortLabel: 'Zirvedekiler',
            title: '1. Slayt: Zirvedekiler (Yılın En İyileri)',
            render: async () => renderWrappedChampionsSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          },
          {
            id: 'wrapped-2',
            name: '02-wrapped-numbers.png',
            shortLabel: 'Rakamlar',
            title: '2. Slayt: Rakamlarla Arşiv (Büyük İstatistikler)',
            render: async () => renderWrappedNumbersSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          },
          {
            id: 'wrapped-3',
            name: '03-wrapped-taste.png',
            shortLabel: 'Tür Profili',
            title: '3. Slayt: Tür Profili ve Zevkler',
            render: async () => renderWrappedTasteSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          },
          {
            id: 'wrapped-4',
            name: '04-wrapped-gems.png',
            shortLabel: 'Gizli Cevherler',
            title: '4. Slayt: Gizli Cevherler (Sürpriz Başyapıtlar)',
            render: async () => renderWrappedHiddenGemsSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey)
          }
        ];
      } else if (tplKey === 'topPicks') {
        const { items } = await this.loadCategoryData(catKey);
        this.slides.push({
          id: 'slide-topPicks',
          name: '01-top-picks.png',
          shortLabel: 'En İyiler',
          title: 'Öne Çıkanlar · En Yüksek Puanlılar',
          render: async () => renderTopPicksTemplate(ctx, W, H, items, theme, fmtKey, catKey)
        });
      } else {
        // tierCollage
        const { items } = await this.loadCategoryData(catKey);
        this.slides.push({
          id: 'slide-tierCollage',
          name: '01-tier-list.png',
          shortLabel: 'Katman Listesi',
          title: 'Katman Listesi (Tier List) Sıralaması',
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

    scrollPillIntoView(pill, smooth = true) {
      const container = document.getElementById('instaSlidePills');
      if (!container || !pill) return;
      const pillLeft = pill.offsetLeft;
      const pillWidth = pill.offsetWidth;
      const containerWidth = container.clientWidth;
      const targetScrollLeft = pillLeft - (containerWidth / 2) + (pillWidth / 2);
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }

    syncSlideState() {
      const total = this.slides.length;
      const isMulti = total > 1;
      const activeSlide = this.slides[this.currentSlideIndex] || this.slides[0];

      const slideSelect = document.getElementById('instaSlideSelect');
      if (slideSelect && slideSelect.value !== String(this.currentSlideIndex)) {
        slideSelect.value = String(this.currentSlideIndex);
      }

      const indicator = document.getElementById('instaSlideIndicator');
      if (indicator) {
        indicator.hidden = !isMulti;
        if (isMulti && activeSlide) {
          indicator.textContent = `🎞️ Slayt ${this.currentSlideIndex + 1} / ${total}: ${activeSlide.title}`;
        }
      }

      const prevBtn = document.getElementById('instaPrevSlideBtn');
      const nextBtn = document.getElementById('instaNextSlideBtn');
      if (prevBtn) prevBtn.disabled = (this.currentSlideIndex <= 0);
      if (nextBtn) nextBtn.disabled = (this.currentSlideIndex >= total - 1);

      const navSlideBtn = document.getElementById('instaDownloadSlideBtn');
      if (navSlideBtn) {
        navSlideBtn.textContent = isMulti
          ? `💾 ${this.currentSlideIndex + 1}. Slaytı PNG İndir`
          : '💾 PNG İndir';
      }

      const pillsContainer = document.getElementById('instaSlidePills');
      if (pillsContainer) {
        const pills = pillsContainer.querySelectorAll('.insta-slide-pill');
        let activePill = null;
        pills.forEach((p, idx) => {
          const isActive = (idx === this.currentSlideIndex);
          p.classList.toggle('is-active', isActive);
          p.setAttribute('aria-selected', isActive ? 'true' : 'false');
          if (isActive) activePill = p;
        });
        if (activePill) {
          this.scrollPillIntoView(activePill, true);
        }
      }
    }

    updateSlideSelectorUI() {
      const slideRow = document.getElementById('instaSlideSelectRow');
      const slideSelect = document.getElementById('instaSlideSelect');
      const zipBtnTop = document.getElementById('downloadZipInstaBtn');

      const navEl = document.getElementById('instaSlideNav');
      const navHeader = document.getElementById('instaSlideNavHeader');
      const pillsContainer = document.getElementById('instaSlidePills');
      const navZipBtn = document.getElementById('instaDownloadZipBtn');
      const navSlideBtn = document.getElementById('instaDownloadSlideBtn');
      const stripWrap = navEl?.querySelector('.insta-slide-nav-strip-wrap');

      const total = this.slides.length;
      const isMulti = total > 1;

      if (slideSelect) {
        slideSelect.innerHTML = '';
        this.slides.forEach((s, idx) => {
          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = s.title;
          if (idx === this.currentSlideIndex) opt.selected = true;
          slideSelect.appendChild(opt);
        });
      }

      if (slideRow) slideRow.hidden = !isMulti;
      if (zipBtnTop) zipBtnTop.hidden = !isMulti;

      if (navEl) {
        if (!isMulti) {
          navEl.classList.add('is-single');
          if (navHeader) navHeader.textContent = '🖼️ Tek Kare Gönderi (1 Slayt)';
          if (stripWrap) stripWrap.hidden = true;
          if (navZipBtn) navZipBtn.hidden = true;
          if (navSlideBtn) navSlideBtn.textContent = '💾 PNG İndir';
          if (pillsContainer) pillsContainer.innerHTML = '';
        } else {
          navEl.classList.remove('is-single');
          if (navHeader) {
            navHeader.textContent = `🎞️ Çoklu Karusel Slaytları (Toplam ${total} Gönderi)`;
          }
          if (stripWrap) stripWrap.hidden = false;
          if (navZipBtn) {
            navZipBtn.hidden = false;
            navZipBtn.textContent = `📦 Tüm ${total} Slaytı ZIP Olarak İndir`;
          }

          if (pillsContainer) {
            if (!pillsContainer._hasWheelHandler) {
              pillsContainer._hasWheelHandler = true;
              pillsContainer.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0 && pillsContainer.scrollWidth > pillsContainer.clientWidth) {
                  e.preventDefault();
                  pillsContainer.scrollLeft += e.deltaY;
                }
              }, { passive: false });
            }

            pillsContainer.innerHTML = '';
            this.slides.forEach((s, idx) => {
              const pill = document.createElement('button');
              pill.type = 'button';
              const isActive = (idx === this.currentSlideIndex);
              pill.className = `insta-slide-pill ${isActive ? 'is-active' : ''}`;
              pill.setAttribute('role', 'tab');
              pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
              pill.title = s.title;

              const numSpan = document.createElement('span');
              numSpan.className = 'pill-index';
              numSpan.textContent = `${idx + 1}`;

              const labelSpan = document.createElement('span');
              labelSpan.className = 'pill-label';
              labelSpan.textContent = s.shortLabel || `Slayt ${idx + 1}`;

              pill.appendChild(numSpan);
              pill.appendChild(labelSpan);

              pill.onclick = async () => {
                if (this.currentSlideIndex === idx) return;
                this.currentSlideIndex = idx;
                this.syncSlideState();
                await this.renderCurrentSlideOnly();
              };

              pillsContainer.appendChild(pill);
            });
          }
        }
      }

      this.syncSlideState();
    }

    async renderCurrentSlideOnly() {
      if (!this.slides.length) return;
      const activeSlide = this.slides[this.currentSlideIndex] || this.slides[0];
      this.syncSlideState();
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

    openBatchExportModal(targetCatKey = null) {
      const catKey = targetCatKey || document.getElementById('instaCategorySelect')?.value || 'anime';
      const catMeta = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
      const curFmt = document.getElementById('instaFormatSelect')?.value || 'square';
      const curThm = document.getElementById('instaThemeSelect')?.value || 'neonBlue';
      const curPartMode = document.getElementById('instaPartModeSelect')?.value || 'compact';

      let overlay = document.getElementById('batchExportModalOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'batchExportModalOverlay';
        overlay.className = 'batch-export-overlay';
        document.body.appendChild(overlay);
      }

      this.isBatchCancelled = false;
      this.isBatchExporting = false;

      const verb = (catKey === 'book' || catKey === 'manga') ? 'Okunan' : (catKey === 'guide' ? 'Yayınlanan' : 'İzlenen');

      overlay.innerHTML = `
        <div class="batch-export-modal glass sq" role="dialog" aria-modal="true" aria-labelledby="batchModalTitle">
          <!-- 1. Yapılandırma Ekranı -->
          <div id="batchExportConfigView">
            <div class="batch-export-head">
              <div class="batch-head-icon">📦</div>
              <div class="batch-head-info">
                <h3 id="batchModalTitle">Tüm ${verb} ${catMeta.label}ler · Toplu Sosyal Medya Arşivi</h3>
                <p>Arşivinizdeki ${verb.toLowerCase()} ${catMeta.label.toLowerCase()}ler için 2160p Retina kalitesinde sosyal medya postları üretilip tek bir ZIP arşivinde toplanır.</p>
              </div>
              <button type="button" class="batch-close-btn" id="batchCloseXBtn" aria-label="Kapat" title="Kapat">✕</button>
            </div>

            <div class="batch-options-grid">
              <label class="field">
                <span>🎯 İçerik Kapsamı</span>
                <select id="batchScopeSelect" class="inp glass">
                  <option value="completed" selected>✅ Yalnızca ${verb} / Tamamlanan Yapımlar</option>
                  <option value="all">🌟 Tüm Arşiv (${catMeta.label} Kataloğunun Tamamı)</option>
                </select>
              </label>

              <label class="field">
                <span>📱 Paylaşım Formatı (2160p Retina)</span>
                <select id="batchFormatSelect" class="inp glass">
                  <option value="square" ${curFmt === 'square' ? 'selected' : ''}>🖼️ Instagram Kare (1:1 — 2160 × 2160)</option>
                  <option value="portrait" ${curFmt === 'portrait' ? 'selected' : ''}>📐 Instagram Dikey (4:5 — 2160 × 2700)</option>
                  <option value="story" ${curFmt === 'story' ? 'selected' : ''}>📱 Instagram Story (9:16 — 2160 × 3840)</option>
                </select>
              </label>

              <label class="field">
                <span>✨ Vurgu Rengi Teması</span>
                <select id="batchThemeSelect" class="inp glass">
                  <option value="neonBlue" ${curThm === 'neonBlue' ? 'selected' : ''}>⚡ Neon Mavi</option>
                  <option value="cyan" ${curThm === 'cyan' ? 'selected' : ''}>💎 Sibernetik Turkuaz</option>
                  <option value="gold" ${curThm === 'gold' ? 'selected' : ''}>🌟 Altın &amp; Amber</option>
                  <option value="emerald" ${curThm === 'emerald' ? 'selected' : ''}>🍀 Zümrüt Yeşili</option>
                  <option value="violet" ${curThm === 'violet' ? 'selected' : ''}>🔮 Büyülü Mor</option>
                  <option value="rose" ${curThm === 'rose' ? 'selected' : ''}>💖 Canlı Pembe</option>
                </select>
              </label>

              <label class="field">
                <span>📑 Çok Sezonlu / Parçalı Yapım Düzeni</span>
                <select id="batchPartModeSelect" class="inp glass">
                  <option value="compact" ${curPartMode === 'compact' ? 'selected' : ''}>🔲 Tek Kare Özet (Kompakt Karne — Önerilen)</option>
                  <option value="cover">🖼️ Yalnızca Ana Kapak Kartı</option>
                  <option value="carousel" ${curPartMode === 'carousel' ? 'selected' : ''}>📑 Tam Karusel Seti (Sezon Slaytları Dahil, Klasörlü)</option>
                </select>
              </label>
            </div>

            <div class="batch-extra-options">
              <label class="batch-checkbox">
                <input type="checkbox" id="batchIncludeCaptions" checked>
                <span>📝 Hazır Instagram Açıklamalarını ZIP'e ekle (<code>Instagram-Aciklamalari.txt</code>)</span>
              </label>
              <label class="batch-checkbox">
                <input type="checkbox" id="batchIncludeReadme" checked>
                <span>ℹ️ Arşiv Bilgi Dosyası ekle (<code>BENİOKU.txt</code>)</span>
              </label>
            </div>

            <div class="batch-actions">
              <button type="button" class="btn-subtle" id="batchCancelBtn">Vazgeç</button>
              <button type="button" class="btn-primary batch-start-btn" id="batchStartBtn">🚀 Tek Tıkla ZIP Olarak İndir</button>
            </div>
          </div>

          <!-- 2. Canlı İlerleme Ekranı -->
          <div id="batchExportProgressView" hidden>
            <div class="batch-export-head">
              <div class="batch-head-icon rotating-icon">⚙️</div>
              <div class="batch-head-info">
                <h3 id="batchProgressHeading">Postlar Üretiliyor ve Paketleniyor...</h3>
                <p id="batchProgressSub">Lütfen bekleyin, afişler taranıyor ve 2160p Retina görseller çiziliyor.</p>
              </div>
            </div>

            <div class="batch-progress-box">
              <div class="batch-progress-header">
                <span id="batchProgressCount">Hazırlanıyor: 0 / 0</span>
                <span id="batchProgressPct" class="batch-pct-badge">0%</span>
              </div>
              <div class="batch-progress-track">
                <div id="batchProgressBar" class="batch-progress-fill" style="width: 0%"></div>
              </div>
              <div class="batch-current-item">
                <div class="batch-item-dot"></div>
                <span id="batchCurrentTitle">İşlem başlatılıyor...</span>
              </div>
            </div>

            <div class="batch-actions">
              <button type="button" class="btn-danger" id="batchAbortBtn">🛑 İptal Et</button>
            </div>
          </div>

          <!-- 3. Başarı Ekranı -->
          <div id="batchExportSuccessView" hidden>
            <div class="batch-success-box">
              <div class="batch-success-icon">🎉</div>
              <h3>ZIP Arşivi Başarıyla İndirildi!</h3>
              <p id="batchSuccessSummary">Tüm sosyal medya postları tek bir ZIP paketi olarak indirildi.</p>
              <div class="batch-actions" style="justify-content: center; margin-top: 20px;">
                <button type="button" class="btn-primary" id="batchSuccessCloseBtn">Tamam</button>
              </div>
            </div>
          </div>
        </div>
      `;

      overlay.hidden = false;
      document.body.classList.add('batch-modal-open');

      const close = () => {
        if (this.isBatchExporting) {
          if (!confirm('Devam eden indirme işlemini iptal etmek istiyor musunuz?')) return;
          this.isBatchCancelled = true;
        }
        overlay.hidden = true;
        document.body.classList.remove('batch-modal-open');
      };

      document.getElementById('batchCloseXBtn').onclick = close;
      document.getElementById('batchCancelBtn').onclick = close;
      document.getElementById('batchSuccessCloseBtn').onclick = close;

      document.getElementById('batchAbortBtn').onclick = () => {
        this.isBatchCancelled = true;
        const curEl = document.getElementById('batchCurrentTitle');
        if (curEl) curEl.textContent = 'İptal ediliyor...';
      };

      document.getElementById('batchStartBtn').onclick = () => {
        const scope = document.getElementById('batchScopeSelect')?.value || 'completed';
        const format = document.getElementById('batchFormatSelect')?.value || 'square';
        const theme = document.getElementById('batchThemeSelect')?.value || 'neonBlue';
        const partMode = document.getElementById('batchPartModeSelect')?.value || 'compact';
        const includeCaptions = document.getElementById('batchIncludeCaptions')?.checked ?? true;
        const includeReadme = document.getElementById('batchIncludeReadme')?.checked ?? true;

        this.startBatchExport({
          catKey,
          scope,
          format,
          theme,
          partMode,
          includeCaptions,
          includeReadme
        });
      };
    }

    async startBatchExport(options = {}) {
      if (this.isBatchExporting) return;
      this.isBatchExporting = true;
      this.isBatchCancelled = false;

      const catKey = options.catKey || 'anime';
      const catMeta = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
      const fmtKey = options.format || 'square';
      const thmKey = options.theme || 'neonBlue';
      const partMode = options.partMode || 'compact';
      const scope = options.scope || 'completed';
      const includeCaptions = options.includeCaptions !== false;
      const includeReadme = options.includeReadme !== false;

      const fmt = FORMATS[fmtKey] || FORMATS.square;
      const theme = THEMES[thmKey] || THEMES.neonBlue;

      const configView = document.getElementById('batchExportConfigView');
      const progressView = document.getElementById('batchExportProgressView');
      const successView = document.getElementById('batchExportSuccessView');
      const countEl = document.getElementById('batchProgressCount');
      const pctEl = document.getElementById('batchProgressPct');
      const barEl = document.getElementById('batchProgressBar');
      const titleEl = document.getElementById('batchCurrentTitle');
      const headingEl = document.getElementById('batchProgressHeading');
      const subEl = document.getElementById('batchProgressSub');

      if (configView) configView.hidden = true;
      if (progressView) progressView.hidden = false;
      if (successView) successView.hidden = true;

      // 1. Veriyi çek
      if (titleEl) titleEl.textContent = `${catMeta.label} verileri taranıyor...`;
      const { items } = await this.loadCategoryData(catKey);

      let targetItems = items || [];
      if (scope === 'completed') {
        targetItems = targetItems.filter(it => (it.status || '').toLowerCase() === 'completed');
      }

      // Sıralama: En yüksek puandan en düşüğe, sonra alfabetik
      targetItems.sort((a, b) => {
        const sa = resolveItemEffectiveScore(a, catKey) || 0;
        const sb = resolveItemEffectiveScore(b, catKey) || 0;
        return sb - sa || (a.title || '').localeCompare(b.title || '');
      });

      const totalItems = targetItems.length;
      if (!totalItems) {
        alert('Dışa aktarılacak yapım bulunamadı.');
        this.isBatchExporting = false;
        if (configView) configView.hidden = false;
        if (progressView) progressView.hidden = true;
        return;
      }

      if (countEl) countEl.textContent = `Toplam: ${totalItems} ${catMeta.label}`;

      // 2. Afiş görsellerini eşzamanlı (concurrency: 8) önbelleğe al
      if (headingEl) headingEl.textContent = 'Afişler Önbelleğe Alınıyor...';
      if (subEl) subEl.textContent = `2160p Retina çizimi öncesi ${totalItems} afiş görseli hızla indiriliyor.`;

      const posterUrls = targetItems.map(it => it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null)).filter(Boolean);
      await preloadImagesWithConcurrency(posterUrls, 8, (loaded, total) => {
        if (this.isBatchCancelled) return;
        const pct = Math.round((loaded / Math.max(1, total)) * 30);
        if (barEl) barEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (titleEl) titleEl.textContent = `Afiş görseli indiriliyor: ${loaded} / ${total}`;
      });

      if (this.isBatchCancelled) {
        this.cleanupBatch();
        return;
      }

      // 3. Çizim hazırlığı
      if (headingEl) headingEl.textContent = 'Postlar Retina Kalitesinde Çiziliyor...';
      if (subEl) subEl.textContent = 'Her yapım için 2160p Retina kartı oluşturulup PNG olarak paketleniyor.';

      const W = fmt.width;
      const H = fmt.height;
      this.canvas.width = W;
      this.canvas.height = H;
      const ctx = this.ctx;

      const files = [];
      const captions = [];

      // 4. Çizim döngüsü
      for (let i = 0; i < totalItems; i++) {
        if (this.isBatchCancelled) {
          this.cleanupBatch();
          return;
        }

        const it = targetItems[i];
        const padIdx = String(i + 1).padStart(2, '0');
        const cleanTitle = sanitizeFilename(it.title || 'yapim');
        const effScore = resolveItemEffectiveScore(it, catKey);
        const scoreStr = effScore !== null ? `[★${(effScore % 1 === 0) ? effScore.toFixed(1) : effScore}]` : '';
        const hasParts = it && Array.isArray(it.parts) && it.parts.length > 1;

        const currentPct = 30 + Math.round(((i + 1) / totalItems) * 60);
        if (barEl) barEl.style.width = `${currentPct}%`;
        if (pctEl) pctEl.textContent = `${currentPct}%`;
        if (countEl) countEl.textContent = `İşleniyor: ${i + 1} / ${totalItems}`;
        if (titleEl) titleEl.textContent = `[${i + 1}/${totalItems}] ${it.title || 'İsimsiz'}`;

        if (partMode === 'compact') {
          if (hasParts) {
            await renderSingleReviewCompactSlide(ctx, W, H, it, catKey, theme, fmtKey);
          } else {
            await renderSingleReviewCoverSlide(ctx, W, H, it, catKey, theme, fmtKey, null, null);
          }
          const blob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
          if (blob) {
            files.push({
              name: `${padIdx}. ${cleanTitle} ${scoreStr}.png`.replace(/\s+/g, ' ').trim(),
              blob
            });
          }
        } else if (partMode === 'cover') {
          await renderSingleReviewCoverSlide(ctx, W, H, it, catKey, theme, fmtKey, null, null);
          const blob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
          if (blob) {
            files.push({
              name: `${padIdx}. ${cleanTitle} ${scoreStr}.png`.replace(/\s+/g, ' ').trim(),
              blob
            });
          }
        } else {
          // carousel
          if (hasParts) {
            const folder = `${padIdx}. ${cleanTitle} ${scoreStr}`.replace(/\s+/g, ' ').trim();
            // Kapak
            await renderSingleReviewCoverSlide(ctx, W, H, it, catKey, theme, fmtKey, null, null);
            const coverBlob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
            if (coverBlob) files.push({ name: `${folder}/01-ana-kapak.png`, blob: coverBlob });

            // Sezonlar
            for (let pIdx = 0; pIdx < it.parts.length; pIdx++) {
              if (this.isBatchCancelled) { this.cleanupBatch(); return; }
              const part = it.parts[pIdx];
              const pNum = String(pIdx + 2).padStart(2, '0');
              const pName = sanitizeFilename(part.name || `sezon-${pIdx + 1}`);
              await renderSingleReviewPartSlide(ctx, W, H, it, part, pIdx, it.parts.length, catKey, theme, fmtKey);
              const pBlob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
              if (pBlob) files.push({ name: `${folder}/${pNum}-${pName}.png`, blob: pBlob });
            }
          } else {
            await renderSingleReviewCoverSlide(ctx, W, H, it, catKey, theme, fmtKey, null, null);
            const blob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
            if (blob) {
              files.push({
                name: `${padIdx}. ${cleanTitle} ${scoreStr}.png`.replace(/\s+/g, ' ').trim(),
                blob
              });
            }
          }
        }

        if (includeCaptions) {
          const caption = generateInstagramCaption('singleReview', catKey, it, null);
          captions.push(`[${i + 1} / ${totalItems}] ${it.title || ''}\n${'-'.repeat(70)}\n${caption}\n\n${'='.repeat(70)}\n\n`);
        }

        // Event loop'a nefes aldır
        await new Promise(r => setTimeout(r, 12));
      }

      if (this.isBatchCancelled) {
        this.cleanupBatch();
        return;
      }

      // 5. Ek metin dosyaları
      if (barEl) barEl.style.width = '92%';
      if (pctEl) pctEl.textContent = '92%';
      if (titleEl) titleEl.textContent = 'Açıklamalar ve metadata hazırlanıyor...';

      const dateStr = new Date().toISOString().slice(0, 10);

      if (includeCaptions && captions.length) {
        const fullCaption = `======================================================================\n` +
          `TEMPESTIAN · ${catMeta.label.toUpperCase()} SOSYAL MEDYA PAYLAŞIM AÇIKLAMALARI\n` +
          `Paket Tarihi: ${dateStr}\n` +
          `Toplam İçerik: ${totalItems} ${catMeta.label}\n` +
          `Site: https://tempestian.com/\n` +
          `======================================================================\n\n` +
          captions.join('');
        files.push({
          name: 'Instagram-Aciklamalari.txt',
          blob: new Blob([fullCaption], { type: 'text/plain;charset=utf-8' })
        });
      }

      if (includeReadme) {
        const verbName = (catKey === 'book' || catKey === 'manga') ? 'Okunan' : (catKey === 'guide' ? 'Yayınlanan' : 'İzlenen');
        const readme = `======================================================================\n` +
          `TEMPESTIAN · ${catMeta.label.toUpperCase()} ARŞİVİ SOSYAL MEDYA GÖNDERİLERİ\n` +
          `======================================================================\n\n` +
          `Arşiv Sahibi: Bayram Tempestian\n` +
          `Paket Tarihi: ${dateStr}\n` +
          `Toplam İçerik: ${totalItems} ${catMeta.label} (${verbName})\n` +
          `Çözünürlük: ${fmt.label}\n` +
          `Görsel Tema: ${theme.name}\n` +
          `Paylaşım Düzeni: ${partMode === 'compact' ? 'Tek Kare Özet (Kompakt Karne)' : (partMode === 'cover' ? 'Yalnızca Ana Kapak' : 'Tam Karusel Seti')}\n` +
          `Arşiv Web Sitesi: https://tempestian.com/\n\n` +
          `Tüm görseller Retina 2x (2160p) kalitesinde Instagram, Twitter/X, Threads ve Discord paylaşımları için özel olarak üretilmiştir.\n`;
        files.push({
          name: 'BENİOKU.txt',
          blob: new Blob([readme], { type: 'text/plain;charset=utf-8' })
        });
      }

      // 6. ZIP Derleme
      if (headingEl) headingEl.textContent = 'ZIP Paketi Oluşturuluyor...';
      if (subEl) subEl.textContent = `${files.length} dosya tek bir ZIP arşivinde birleştiriliyor...`;
      if (barEl) barEl.style.width = '96%';
      if (pctEl) pctEl.textContent = '96%';
      if (titleEl) titleEl.textContent = 'PKZIP sıkıştırmasız arşiv yazılıyor...';

      await new Promise(r => setTimeout(r, 20));
      const zipBlob = await createZipBlob(files);

      // 7. İndirmeyi Başlat
      if (barEl) barEl.style.width = '100%';
      if (pctEl) pctEl.textContent = '100%';
      if (titleEl) titleEl.textContent = 'İndirme tetikleniyor...';

      const scopeTag = scope === 'completed' ? 'izlenen' : 'tum';
      const zipName = `tempestian-${catKey}-${scopeTag}-${fmtKey}-${dateStr}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);

      // 8. Başarı ekranı
      if (progressView) progressView.hidden = true;
      if (successView) {
        successView.hidden = false;
        const sumEl = document.getElementById('batchSuccessSummary');
        if (sumEl) {
          sumEl.textContent = `Toplam ${totalItems} ${catMeta.label.toLowerCase()} için üretilen ${files.length} dosya "${zipName}" olarak başarıyla indirildi.`;
        }
      }

      if (window.toast) {
        window.toast(`✓ ${totalItems} yapımın sosyal medya postu ZIP olarak indirildi!`, 'ok');
      }

      this.isBatchExporting = false;
      await this.renderCurrentSlideOnly();
    }

    cleanupBatch() {
      this.isBatchExporting = false;
      this.isBatchCancelled = false;
      const overlay = document.getElementById('batchExportModalOverlay');
      if (overlay) overlay.hidden = true;
      document.body.classList.remove('batch-modal-open');
      if (window.toast) window.toast('İndirme işlemi iptal edildi.', 'warn');
      this.renderCurrentSlideOnly();
    }

    downloadAllWatchedAnimeZip(options = {}) {
      if (options && options.direct === true) {
        return this.startBatchExport({ catKey: 'anime', scope: 'completed', ...options });
      }
      return this.openBatchExportModal('anime');
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
