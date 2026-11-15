// ============================================================================
// [AI-MIMARI-NOTU: SOSYAL MEDYA GÖRSEL STÜDYOSU — 2X YÜKSEK ÇÖZÜNÜRLÜKLÜ TASARIM MOTORU]
// Bu modül (`assets/js/admin-instagram.js`), admin panelinde yalnızca depo sahibi için
// çalışan; Anime, Dizi, Film, Manga, Kitap ve Rehber arşivinden 2160p kalitesinde
// Tekil İnceleme Kartları, Parçalı Sezon Karuselleri, Yıllık Özetler ve
// Katman Sıralaması görselleri üreten HTML5 Canvas motorudur.
// ============================================================================

(() => {
  // --------------------------------------------------------------------------
  // 1. SAF JS ZIP ÜRETİCİSİ (SIFIR BAĞIMLILIKLI PKZIP STORE)
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
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      fileEntries.push({ nameBytes, crc, size, dosTime, dosDate, offset, localHeader, data });
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
  // 2. SABİTLER, TEMALAR, TÜRKÇE SÖZLÜK VE MEDYA YAPILANDIRMASI
  // --------------------------------------------------------------------------
  const FONT_FAMILY = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Plus Jakarta Sans", sans-serif';

  function toTrUpper(str) {
    return String(str || '').toLocaleUpperCase('tr-TR');
  }

  const THEMES = {
    neonBlue: {
      name: 'Neon Mavi',
      accent: '#38bdf8',
      accentStrong: '#00a8ff',
      glow: 'rgba(56, 189, 248, 0.30)',
      gradient: ['#60d5ff', '#0284c7'],
      pillBg: 'rgba(56, 189, 248, 0.14)'
    },
    gold: {
      name: 'Altın ve Kehribar',
      accent: '#fbbf24',
      accentStrong: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.30)',
      gradient: ['#fcd34d', '#d97706'],
      pillBg: 'rgba(245, 158, 11, 0.14)'
    },
    emerald: {
      name: 'Zümrüt Yeşili',
      accent: '#34d399',
      accentStrong: '#10b981',
      glow: 'rgba(16, 185, 129, 0.30)',
      gradient: ['#6ee7b7', '#059669'],
      pillBg: 'rgba(16, 185, 129, 0.14)'
    },
    violet: {
      name: 'Büyülü Mor',
      accent: '#c084fc',
      accentStrong: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.30)',
      gradient: ['#d8b4fe', '#7c3aed'],
      pillBg: 'rgba(168, 85, 247, 0.14)'
    },
    rose: {
      name: 'Canlı Pembe',
      accent: '#fb7185',
      accentStrong: '#f43f5e',
      glow: 'rgba(244, 63, 94, 0.30)',
      gradient: ['#fda4af', '#e11d48'],
      pillBg: 'rgba(244, 63, 94, 0.14)'
    },
    cyan: {
      name: 'Sibernetik Turkuaz',
      accent: '#22d3ee',
      accentStrong: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.30)',
      gradient: ['#67e8f9', '#0891b2'],
      pillBg: 'rgba(6, 182, 212, 0.14)'
    }
  };

  const FORMATS = {
    square:   { width: 2160, height: 2160, label: 'Kare Gönderi (1:1 · 2160×2160)' },
    portrait: { width: 2160, height: 2700, label: 'Dikey Gönderi (4:5 · 2160×2700)' },
    story:    { width: 2160, height: 3840, label: 'Hikâye Formatı (9:16 · 2160×3840)' }
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
      subUnitLabel: 'Süre & Çıkış',
      defaultHashtags: '#film #sinema #tempestian #filminceleme #sinemakeyfi'
    },
    manga: {
      file: 'data/manga.json',
      label: 'Manga',
      icon: '📖',
      key: 'items',
      typeKey: 'manga',
      creatorLabel: 'Çizer / Yazar',
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
      creatorLabel: 'Platform',
      subUnitLabel: 'Kategori',
      defaultHashtags: '#rehber #technopat #tempestian #linux #teknoloji'
    }
  };

  const CRITERIA_FALLBACK = {
    anime: [
      { id: 'story', label: 'Hikâye & Kurgusal Mimari' },
      { id: 'world', label: 'Dünya Tasarımı & Evren İnşası' },
      { id: 'characters', label: 'Karakter Derinliği & Gelişim' },
      { id: 'visuals', label: 'Görsel Yönetmenlik & Animasyon' },
      { id: 'sound', label: 'Ses Tasarımı, Müzik & Seslendirme' },
      { id: 'enjoyment', label: 'Seyir Hazzı & Duygusal Tortu' }
    ],
    manga: [
      { id: 'story', label: 'Hikâye & Senaryo Örgüsü' },
      { id: 'world', label: 'Dünya Tasarımı & Evren' },
      { id: 'characters', label: 'Karakterler & Diyalog Kalitesi' },
      { id: 'art', label: 'Çizim & Panel Yönetimi' },
      { id: 'enjoyment', label: 'Okuma Sürükleyiciliği & Etki' }
    ],
    series: [
      { id: 'story', label: 'Ana Kurgu & Sezon Devamlılığı' },
      { id: 'world', label: 'Dünya Tasarımı & Atmosfer' },
      { id: 'characters', label: 'Karakter Arkları & Kadro' },
      { id: 'pacing', label: 'Bölüm Temposu & Akıcılık' },
      { id: 'production', label: 'Prodüksiyon & Sinematografi' },
      { id: 'music_finale', label: 'Müzik & Finallerin Ağırlığı' }
    ],
    movie: [
      { id: 'story', label: 'Senaryo & Anlatım Bütünlüğü' },
      { id: 'world', label: 'Dünya Tasarımı & Mekân Hissi' },
      { id: 'acting', label: 'Oyunculuk & Karakter İnandırıcılığı' },
      { id: 'directing', label: 'Yönetmenlik & Sinematografi' },
      { id: 'sound', label: 'Ses Miksajı & Film Müziği' },
      { id: 'impact', label: 'Duygusal Katarsis & Final' }
    ],
    book: [
      { id: 'story', label: 'Kurgu, Olay Örgüsü & Fikir' },
      { id: 'world', label: 'Dünya Tasarımı & Evren İnşası' },
      { id: 'prose', label: 'Anlatım Dili & Edebi Üslup' },
      { id: 'characters', label: 'Karakter & Psikolojik Katman' },
      { id: 'impact', label: 'Düşünsel Tortu & Kalıcılık' }
    ],
    guide: [
      { id: 'clarity', label: 'Anlatım Açıklığı & Sadeliği' },
      { id: 'depth', label: 'Teknik Derinlik & Doğruluk' },
      { id: 'relevance', label: 'Güncellik & Kullanılabilirlik' },
      { id: 'visuals', label: 'Görsel & Komut Zenginliği' }
    ]
  };

  // İngilizce / kısaltma tür etiketlerini temiz Türkçeye çevirir
  const GENRE_TR_MAP = {
    'rom-com': 'Romantik Komedi',
    'romcom': 'Romantik Komedi',
    'romantic comedy': 'Romantik Komedi',
    'slice of life': 'Günlük Yaşam',
    'short': 'Kısa Film',
    'action': 'Aksiyon',
    'adventure': 'Macera',
    'animation': 'Animasyon',
    'comedy': 'Komedi',
    'drama': 'Dram',
    'fantasy': 'Fantastik',
    'dark fantasy': 'Karanlık Fantezi',
    'horror': 'Korku',
    'mystery': 'Gizem',
    'psychological': 'Psikolojik',
    'romance': 'Romantik',
    'sci-fi': 'Bilim Kurgu',
    'science fiction': 'Bilim Kurgu',
    'sports': 'Spor',
    'supernatural': 'Doğaüstü',
    'thriller': 'Gerilim',
    'suspense': 'Gerilim',
    'crime': 'Suç',
    'history': 'Tarih',
    'historical': 'Tarihi',
    'war': 'Savaş',
    'military': 'Askeri',
    'family': 'Aile',
    'music': 'Müzik',
    'musical': 'Müzikal',
    'documentary': 'Belgesel',
    'biography': 'Biyografi',
    'mahou shoujo': 'Büyülü Kız',
    'magical girl': 'Büyülü Kız',
    'mecha': 'Meka',
    'school': 'Okul',
    'super power': 'Süper Güç',
    'post-apocalyptic': 'Kıyamet Sonrası',
    'post-apokaliptik': 'Kıyamet Sonrası',
    'oyun / vr': 'Oyun ve Sanal Gerçeklik',
    'vr': 'Sanal Gerçeklik',
    'cyberpunk': 'Siberpunk',
    'time travel': 'Zaman Yolculuğu',
    'detective': 'Dedektiflik',
    'gourmet': 'Yemek / Gurme',
    'parody': 'Parodi',
    'ecchi': 'Ecchi',
    'isekai': 'Isekai',
    'shounen': 'Shounen',
    'seinen': 'Seinen',
    'shoujo': 'Shoujo',
    'josei': 'Josei',
    'harem': 'Harem'
  };

  function translateGenreToTurkish(genre) {
    const raw = String(genre || '').trim();
    if (!raw) return '';
    const mapped = GENRE_TR_MAP[raw.toLowerCase()];
    return mapped || raw;
  }

  function getItemGenres(item, catKey, maxCount = 5) {
    const raw = (Array.isArray(item?.customGenres) && item.customGenres.length)
      ? item.customGenres
      : (Array.isArray(item?.genres) ? item.genres : []);
    const translated = raw
      .map(g => translateGenreToTurkish(g))
      .filter(Boolean);
    const unique = [...new Set(translated)];
    if (!unique.length) {
      return [CATEGORY_CONFIG[catKey]?.label || 'Arşiv'];
    }
    return unique.slice(0, maxCount);
  }

  // --------------------------------------------------------------------------
  // 3. YARDIMCI GRAFİK & VERİ FONKSİYONLARI
  // --------------------------------------------------------------------------
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    r = Math.max(0, r);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const IMAGE_CACHE = new Map();

  function loadImageWithTimeout(url, timeoutMs = 3500) {
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
      let sum = 0;
      let weight = 0;
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
      const baseTrim = String(itemTitle).trim();
      const baseLower = baseTrim.toLowerCase();
      if (label.toLowerCase() === baseLower) {
        return `${partIndex + 1}. Sezon`;
      }
      if (label.toLowerCase().startsWith(baseLower)) {
        const remainder = label.slice(baseTrim.length).replace(/^[:\s\-–—/]+/, '').trim();
        if (remainder.length >= 2) {
          label = remainder;
        }
      }
    }
    return label;
  }

  function formatKindToTurkish(rawFormat, rawKind, catKey = 'anime') {
    const f = toTrUpper(rawFormat).trim();
    const k = String(rawKind || '').toLowerCase().trim();
    if (f === 'MOVIE' || k === 'movie') return 'Sinema Filmi';
    if (f === 'TV') return (catKey === 'anime') ? 'TV Animesi' : 'TV Dizisi';
    if (f === 'TV_SHORT') return 'Kısa TV Serisi';
    if (f === 'OVA') return 'Özel Bölüm (OVA)';
    if (f === 'ONA') return 'İnternet Serisi (ONA)';
    if (f === 'SPECIAL' || k === 'other') return 'Özel / Ek Bölüm';
    if (f === 'MUSIC') return 'Müzik Klibi';
    if (f === 'MANGA') return 'Manga';
    if (f === 'NOVEL') return 'Hafif Roman / Kitap';
    if (f === 'ONE_SHOT') return 'Tek Sayılık Özel';
    if (k === 'season') return 'TV Sezonu';
    if (catKey === 'movie') return 'Sinema Filmi';
    if (catKey === 'book') return 'Basılı Eser';
    if (catKey === 'manga') return 'Manga';
    if (catKey === 'guide') return 'Teknik Rehber';
    return rawFormat || (catKey === 'anime' ? 'TV Animesi' : 'TV Dizisi');
  }

  function statusToTurkish(status) {
    const s = String(status || '').toUpperCase().trim();
    if (s === 'COMPLETED') return 'Tamamlandı';
    if (s === 'REPEATING') return 'Tekrar İzlendi';
    if (s === 'CURRENT' || s === 'WATCHING') return 'Devam Ediyor';
    if (s === 'PLANNING' || s === 'PLANNED') return 'Planlandı';
    if (s === 'PAUSED') return 'Beklemede';
    if (s === 'DROPPED') return 'Bırakıldı';
    return status || 'Arşivde';
  }

  function getPrestigeSealContent(effScore, isFav, catKey) {
    const isGuide = (catKey === 'guide');
    const isMasterpiece = !isGuide && (effScore >= 9.0 || isFav);
    const isPick = !isGuide && !isMasterpiece && (effScore >= 8.0);
    const isRead = (catKey === 'book' || catKey === 'manga');

    let icon = '✦';
    let title = 'ONAYLI ARŞİV';
    let subtitle = 'DEĞERLENDİRİLDİ';

    if (isGuide) {
      icon = '◈';
      title = 'TEKNİK REHBER';
      subtitle = 'BAŞVURU KAYNAĞI';
    } else if (isMasterpiece) {
      icon = '★';
      title = 'BAŞYAPIT';
      subtitle = isRead ? 'MUTLAKA OKUNMALI' : 'MUTLAKA İZLENMELİ';
    } else if (isPick) {
      icon = '✦';
      title = 'KİŞİSEL SEÇKİ';
      subtitle = 'YÜKSEK TAVSİYE';
    }

    return {
      isMasterpiece,
      isPick,
      isGuide,
      icon,
      title,
      subtitle,
      sub: subtitle,
      footer: 'TEMPESTIAN ARŞİVİ'
    };
  }

  function getPartPrestigeSealContent(partScore, isRead) {
    const isPeak = (partScore >= 9.0);
    const isHigh = !isPeak && (partScore >= 8.0);

    let icon = '✦';
    let title = 'ONAYLI SEZON';
    let subtitle = 'ARŞİVDE KAYITLI';

    if (isPeak) {
      icon = '★';
      title = 'ZİRVE SEZON';
      subtitle = isRead ? 'MUTLAKA OKUNMALI' : 'MUTLAKA İZLENMELİ';
    } else if (isHigh) {
      icon = '✦';
      title = 'SEÇKİN SEZON';
      subtitle = 'YÜKSEK KALİTE';
    }

    return {
      isMasterpiece: isPeak,
      isPick: isHigh,
      isPeak,
      isHigh,
      icon,
      title,
      subtitle,
      sub: subtitle,
      footer: 'TEMPESTIAN ARŞİVİ'
    };
  }

  function getItemRepeatCount(item) {
    const parts = Array.isArray(item?.parts) ? item.parts : [];
    return Math.max(
      0,
      ...(parts.map(p => Number(p.repeat) || 0)),
      Number(item?.repeat) || 0,
      Number(item?.rewatch) || 0,
      Number(item?.reread) || 0
    );
  }

  function getCategoryTerminology(catKey, item) {
    const cfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
    const parts = Array.isArray(item?.parts) ? item.parts : [];
    const repeatCount = getItemRepeatCount(item);
    const isRead = (catKey === 'book' || catKey === 'manga');

    let creatorLabel = cfg.creatorLabel;
    let creatorVal = '';
    let subUnitLabel = cfg.subUnitLabel;
    let subUnitVal = '-';
    let extraLabel = 'Çıkış Yılı';
    let extraVal = '-';

    if (catKey === 'book') {
      creatorVal = item?.author || '';
      if (!creatorVal) {
        creatorLabel = 'Yayın Biçimi';
        creatorVal = 'Basılı Kitap';
      }
      const pCount = item?.pages || (parts[0]?.episodes) || 0;
      subUnitVal = pCount ? `${pCount} Sayfa` : 'Kayıtlı Eser';
      extraLabel = item?.publisher ? 'Yayınevi' : 'Çıkış Yılı';
      extraVal = item?.publisher || item?.year || 'Arşiv';
    } else if (catKey === 'manga') {
      creatorVal = item?.author || item?.artist || '';
      if (!creatorVal) {
        creatorLabel = 'Yayın Biçimi';
        creatorVal = 'Manga Serisi';
      }
      const totalCh = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.chapters || item?.episodes || 0;
      const vols = parts.length > 1 ? `${parts.length} Cilt · ` : '';
      subUnitVal = totalCh ? `${vols}${totalCh} Bölüm` : (parts.length > 1 ? `${parts.length} Cilt` : 'Devam Ediyor');
      extraLabel = 'Çıkış Yılı';
      extraVal = item?.year || (parts[0]?.year) || '-';
    } else if (catKey === 'series') {
      creatorVal = item?.network || item?.author || '';
      if (!creatorVal) {
        creatorLabel = repeatCount > 0 ? 'Tekrar İzleme' : 'Yayın Biçimi';
        creatorVal = repeatCount > 0 ? `${repeatCount} Kez İzlendi` : 'TV Dizisi';
      }
      const totalEp = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
      const seasons = parts.length > 0 ? `${parts.length} Sezon · ` : '';
      subUnitVal = `${seasons}${totalEp} Bölüm`;
      extraVal = item?.year || (parts[0]?.year) || '-';
    } else if (catKey === 'movie') {
      creatorVal = item?.director || item?.author || '';
      if (!creatorVal) {
        creatorLabel = 'Yayın Biçimi';
        creatorVal = 'Sinema Filmi';
      }
      const dur = item?.duration || (parts[0]?.duration) || item?.episodes || null;
      subUnitVal = dur ? `${dur} Dakika` : 'Uzun Metraj';
      extraVal = item?.year || (parts[0]?.year) || '-';
    } else if (catKey === 'guide') {
      creatorVal = 'Technopat Sosyal';
      subUnitLabel = 'Kategori';
      subUnitVal = item?.forumSection || (Array.isArray(item?.genres) && item.genres[0]) || 'Linux ve Sistem';
      extraLabel = 'Yayın Tarihi';
      extraVal = item?.addedAt || item?.updated || 'Güncel';
    } else {
      // anime
      creatorVal = item?.studio || item?.author || '';
      if (!creatorVal) {
        if (repeatCount > 0) {
          creatorLabel = isRead ? 'Tekrar Okuma' : 'Tekrar İzleme';
          creatorVal = `${repeatCount} Kez ${isRead ? 'Okundu' : 'İzlendi'}`;
        } else {
          creatorLabel = 'Yayın Biçimi';
          creatorVal = formatKindToTurkish(item?.format || parts[0]?.format, parts[0]?.kind, 'anime');
        }
      }
      const totalEp = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
      const seasons = parts.length > 1 ? `${parts.length} Parça · ` : '';
      subUnitVal = `${seasons}${totalEp || '12'} Bölüm`;
      extraVal = item?.year || (parts[0]?.year) || '-';
    }

    return {
      categoryLabel: cfg.label,
      creatorLabel,
      creatorVal,
      subUnitLabel,
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
      const fmtStr = formatKindToTurkish(item?.format || firstPart?.format, firstPart?.kind, 'anime');
      const ep = item?.episodes || firstPart?.episodes || 0;
      formatLabel = ep ? `${fmtStr} · ${ep} Bölüm` : fmtStr;
    }

    const year = item?.year || firstPart?.year || (item?.addedAt ? item.addedAt.slice(0, 4) : '-');
    const repeatCount = getItemRepeatCount(item);
    const isRead = (catKey === 'book' || catKey === 'manga');
    const repeatLabel = repeatCount > 0
      ? `↻ ${repeatCount} Kez ${isRead ? 'Okundu' : 'İzlendi'}`
      : (item?.status === 'completed' || firstPart?.status === 'COMPLETED' ? '✓ Tamamlandı' : '✓ Arşivde Kayıtlı');

    const genres = getItemGenres(item, catKey, 5);

    return {
      formatLabel,
      year: String(year),
      repeatCount,
      repeatLabel,
      genres
    };
  }

  // --------------------------------------------------------------------------
  // 4. ORTAK CANVAS ÇİZİM BİLEŞENLERİ (MODERN EDİTORYAL TASARIM)
  // --------------------------------------------------------------------------
  function drawGenrePills(ctx, genres, startX, startY, maxW, theme, options = {}) {
    const pillH = options.pillH || 54;
    const fontSize = options.fontSize || 25;
    const radius = options.radius || 14;
    const gap = options.gap || 14;
    const maxPills = options.maxPills || 5;

    ctx.save();
    ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let curX = startX;
    const list = (Array.isArray(genres) && genres.length ? genres : ['Arşiv']).slice(0, maxPills);

    for (const rawG of list) {
      const text = translateGenreToTurkish(rawG);
      if (!text) continue;
      const textW = ctx.measureText(text).width;
      const pillW = Math.max(96, textW + 44);

      if (curX + pillW > startX + maxW) break;

      ctx.fillStyle = theme ? `${theme.accent}1a` : 'rgba(56, 189, 248, 0.14)';
      ctx.strokeStyle = theme ? `${theme.accent}59` : 'rgba(86, 182, 255, 0.35)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, curX, startY, pillW, pillH, radius);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(text, curX + pillW / 2, startY + pillH / 2 + 1);

      curX += pillW + gap;
    }
    ctx.restore();
  }

  function drawCoverImage(ctx, img, x, y, w, h, radius = 0, focusY = 0.32) {
    ctx.save();
    if (radius > 0) {
      roundRect(ctx, x, y, w, h, radius);
      ctx.clip();
    }
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const boxAspect = w / h;
      let dw, dh, dx, dy;
      if (imgAspect > boxAspect) {
        dh = h;
        dw = h * imgAspect;
        dx = x + (w - dw) / 2;
        dy = y;
      } else {
        dw = w;
        dh = w / imgAspect;
        dx = x;
        dy = y + (h - dh) * focusY;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#111a2e';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function drawPosterPlaceholder(ctx, x, y, w, h, radius, theme, catKey, title) {
    const cfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.guide;
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();

    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#0f1b36');
    grad.addColorStop(0.55, '#091225');
    grad.addColorStop(1, '#050914');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    const glow = ctx.createRadialGradient(x + w * 0.5, y + h * 0.35, 20, x + w * 0.5, y + h * 0.35, w * 0.75);
    glow.addColorStop(0, theme.glow || 'rgba(56, 189, 248, 0.28)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);

    // İnce dekoratif yatay çizgiler
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 2;
    for (let gy = y + 90; gy < y + h - 80; gy += 90) {
      ctx.beginPath();
      ctx.moveTo(x + 48, gy);
      ctx.lineTo(x + w - 48, gy);
      ctx.stroke();
    }

    // Merkez simge halkası
    const cx = x + w / 2;
    const cy = y + h * 0.38;
    ctx.fillStyle = `${theme.accent}18`;
    ctx.strokeStyle = `${theme.accent}66`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.font = `800 84px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toTrUpper(cfg.label.slice(0, 1)), cx, cy + 4);

    // Başlık önizlemesi
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `700 40px ${FONT_FAMILY}`;
    ctx.textBaseline = 'alphabetic';
    drawWrappedTextCentered(ctx, title || cfg.label, cx, cy + 195, w - 120, 52, 4);

    ctx.fillStyle = theme.accent;
    ctx.font = `700 26px ${FONT_FAMILY}`;
    ctx.fillText(`✦ ${toTrUpper(cfg.label)} ARŞİVİ ✦`, cx, y + h - 72);

    ctx.restore();
  }

  function drawWrappedTextCentered(ctx, text, centerX, startY, maxW, lineHeight, maxLines = 4) {
    if (!text) return startY;
    const words = String(text).trim().split(/\s+/);
    let line = '';
    const lines = [];
    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);

    let y = startY;
    for (let i = 0; i < lines.length; i++) {
      let str = lines[i];
      if (i === maxLines - 1 && words.length > lines.join(' ').split(/\s+/).length) {
        while (ctx.measureText(str + '...').width > maxW && str.length > 4) {
          str = str.slice(0, -1).trim();
        }
        str += '...';
      }
      ctx.fillText(str, centerX, y);
      y += lineHeight;
    }
    return y;
  }

  function drawPosterCard(ctx, posterImg, x, y, w, h, radius, theme, catKey, title, options = {}) {
    const score = options.score;
    const favorite = Boolean(options.favorite);

    // Yumuşak derinlik gölgesi
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#091020';
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.restore();

    if (posterImg) {
      drawCoverImage(ctx, posterImg, x, y, w, h, radius, 0.30);
    } else {
      drawPosterPlaceholder(ctx, x, y, w, h, radius, theme, catKey, title);
    }

    // Alt kenar derinlik vinyeti
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    const botGrad = ctx.createLinearGradient(x, y + h * 0.74, x, y + h);
    botGrad.addColorStop(0, 'rgba(5, 9, 18, 0)');
    botGrad.addColorStop(1, 'rgba(5, 9, 18, 0.55)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(x, y + h * 0.74, w, h * 0.26);
    ctx.restore();

    // İnce zarif cam çerçeve
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();

    // Puan Rozeti (Sağ Üst)
    if (score !== null && score !== undefined && Number(score) > 0) {
      const scNum = Number(score);
      const scStr = (scNum % 1 === 0) ? scNum.toFixed(1) : String(scNum);
      const scW = 228;
      const scH = 84;
      const scX = x + w - scW - 24;
      const scY = y + 24;

      ctx.fillStyle = 'rgba(7, 12, 24, 0.88)';
      ctx.strokeStyle = `${theme.accent}cc`;
      ctx.lineWidth = 2.5;
      roundRect(ctx, scX, scY, scW, scH, 22);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 44px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${scStr}`, scX + scW / 2, scY + scH / 2 + 2);
    }

    // Favori Rozeti (Sol Üst)
    if (favorite) {
      const favW = 206;
      const favH = 68;
      const favX = x + 24;
      const favY = y + 24;

      ctx.fillStyle = 'rgba(14, 11, 6, 0.88)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2.5;
      roundRect(ctx, favX, favY, favW, favH, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = `800 30px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★ FAVORİ', favX + favW / 2, favY + favH / 2 + 2);
    }
    ctx.restore();
  }

  function drawRetinaBackground(ctx, W, H, theme, posterImg) {
    // 1. Derin Obsidiyen & Safir Taban Gradyanı
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#040710');
    bgGrad.addColorStop(0.42, '#080e1f');
    bgGrad.addColorStop(1, '#0c162e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Poster Varsa Geniş Yumuşak Ambient Glow
    if (posterImg && posterImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      if ('filter' in ctx) {
        ctx.filter = 'blur(110px) saturate(135%) brightness(52%)';
      }
      ctx.drawImage(posterImg, -W * 0.12, -H * 0.12, W * 1.24, H * 1.24);
      ctx.restore();
    }

    // 3. Yumuşak Vinyet
    const vig = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.78);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(3, 6, 14, 0.72)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // 4. Tema Renkli Atmosferik Işık
    const rad1 = ctx.createRadialGradient(W * 0.86, H * 0.12, 20, W * 0.86, H * 0.12, W * 0.65);
    rad1.addColorStop(0, theme.glow);
    rad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad1;
    ctx.fillRect(0, 0, W, H);

    const rad2 = ctx.createRadialGradient(W * 0.14, H * 0.88, 20, W * 0.14, H * 0.88, W * 0.65);
    rad2.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
    rad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad2;
    ctx.fillRect(0, 0, W, H);

    // 5. Minimal Tekil İnce Cam Çerçeve (Gürültüsüz editoryal kenar)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, 48, 48, W - 96, H - 96, 38);
    ctx.stroke();
    ctx.restore();
  }

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
    const minSize = options.minFontSize || 62;
    const maxSize = options.maxFontSize || 86;
    const preferredColor = options.color || '#ffffff';
    const subText = options.subtitle || null;
    const subColor = options.subtitleColor || '#cbd5e1';
    const subSize = options.subtitleFontSize || 34;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let chosenSize = maxSize;
    let lines = [title];
    let fitsSingle = false;

    for (let s = maxSize; s >= 68; s -= 4) {
      ctx.font = `800 ${s}px ${FONT_FAMILY}`;
      if (ctx.measureText(title).width <= maxW) {
        chosenSize = s;
        lines = [title];
        fitsSingle = true;
        break;
      }
    }

    if (!fitsSingle) {
      const words = title.split(/\s+/);
      if (words.length <= 1) {
        chosenSize = minSize;
        ctx.font = `800 ${chosenSize}px ${FONT_FAMILY}`;
        let singleStr = title;
        while (ctx.measureText(singleStr + '...').width > maxW && singleStr.length > 5) {
          singleStr = singleStr.slice(0, -1);
        }
        lines = [singleStr === title ? singleStr : singleStr + '...'];
      } else {
        let bestSplit = null;
        let bestSize = 72;

        for (let s = 76; s >= minSize; s -= 4) {
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

    ctx.font = `800 ${chosenSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = preferredColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 14;

    const lineHeight = chosenSize * 1.16;
    let curY = startY;

    if (lines.length === 1) {
      curY = startY + 14;
      ctx.fillText(lines[0], centerX, curY);
      curY += chosenSize * 0.5;
    } else {
      curY = startY - 6;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], centerX, curY + i * lineHeight);
      }
      curY += (lines.length - 1) * lineHeight + chosenSize * 0.5;
    }

    let bottomY = curY;
    if (subText) {
      ctx.shadowBlur = 0;
      ctx.font = `500 ${subSize}px ${FONT_FAMILY}`;
      ctx.fillStyle = subColor;
      let subStr = String(subText).trim();
      while (ctx.measureText(subStr).width > maxW && subStr.length > 10) {
        subStr = subStr.slice(0, -4).trim() + '...';
      }
      const subY = curY + (lines.length === 1 ? 46 : 40);
      ctx.fillText(subStr, centerX, subY);
      bottomY = subY + subSize * 0.5;
    }

    ctx.restore();
    return { lines, fontSize: chosenSize, bottomY };
  }

  function drawTopBrandPill(ctx, W, Y, theme, label = '✦ TEMPESTIAN ARŞİVİ · İNCELEME ✦') {
    ctx.save();
    ctx.font = `700 28px ${FONT_FAMILY}`;
    const safeLabel = String(label || '').trim();
    const textW = ctx.measureText(safeLabel).width;
    const pillW = Math.max(540, Math.min(W - 180, textW + 84));
    const pillH = 66;
    const pillX = (W - pillW) / 2;

    ctx.fillStyle = theme.pillBg || 'rgba(56, 189, 248, 0.14)';
    ctx.strokeStyle = `${theme.accent}88`;
    ctx.lineWidth = 2;
    roundRect(ctx, pillX, Y, pillW, pillH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(safeLabel, W / 2, Y + pillH / 2 + 1);
    ctx.restore();
  }

  function drawFooterSignature(ctx, W, H) {
    ctx.save();
    const lineW = Math.min(W - 220, 1180);
    const lineX = (W - lineW) / 2;
    const lineY = H - 114;
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
    ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.font = `600 30px ${FONT_FAMILY}`;
    ctx.fillText('✦ tempestian.com · Bayram Tempestian ✦', W / 2, H - 76);
    ctx.restore();
  }

  function drawMetaGridCards(ctx, startX, startY, totalW, cardH, gapX, gapY, cols, cards, theme) {
    const cardW = (totalW - (cols - 1) * gapX) / cols;
    for (let i = 0; i < cards.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const mx = startX + col * (cardW + gapX);
      const my = startY + row * (cardH + gapY);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, mx, my, cardW, cardH, 22);
      ctx.fill();
      ctx.stroke();

      // Sol dikey vurgu çizgisi
      ctx.fillStyle = theme.accent;
      roundRect(ctx, mx + 14, my + 24, 5, cardH - 48, 3);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 26px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cards[i].label, mx + 34, my + 50);

      ctx.fillStyle = cards[i].color || '#f8fafc';
      ctx.font = `700 36px ${FONT_FAMILY}`;
      let valStr = String(cards[i].val || '-');
      while (ctx.measureText(valStr).width > cardW - 60 && valStr.length > 5) {
        valStr = valStr.slice(0, -4).trim() + '...';
      }
      ctx.fillText(valStr, mx + 34, my + cardH - 36);
      ctx.restore();
    }
  }

  function drawCriteriaPanel(ctx, x, y, w, h, criteriaList, subScores, fallbackScore, theme, itemSummary = null) {
    // Arka plan kartı
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 24);
    ctx.fill();
    ctx.stroke();

    const padX = 28;
    const innerW = w - padX * 2;

    if (fallbackScore === null) {
      // Rehber gibi puansız içerikler için Özet Kutusu
      ctx.fillStyle = theme.accent;
      ctx.font = `800 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('✦ REHBER ÖZETİ VE İÇERİK ODAĞI', x + padX, y + 52);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = `500 32px ${FONT_FAMILY}`;
      const summaryTxt = itemSummary || 'Bu teknik rehber; adım adım kurulum, yapılandırma ve pratik çözüm adımlarını kapsamlı biçimde sunmaktadır.';
      drawWrappedText(ctx, summaryTxt, x + padX, y + 112, innerW, 48, 8);
      ctx.restore();
      return;
    }

    const list = criteriaList.slice(0, 6);
    const count = Math.max(1, list.length);
    const topPad = 24;
    const botPad = 18;
    const usableH = h - topPad - botPad;
    const rowSpacing = usableH / count;

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const cy = y + topPad + i * rowSpacing;
      const rawSub = (subScores && subScores[c.id] != null && Number(subScores[c.id]) > 0)
        ? Number(subScores[c.id])
        : (fallbackScore != null && Number(fallbackScore) > 0 ? Number(fallbackScore) : 8);
      const subVal = Math.max(0.1, Math.min(10, rawSub));
      const scoreTen = subVal.toFixed(1);

      const labelY = cy + rowSpacing * 0.34;
      const barY = cy + rowSpacing * 0.56;
      const barH = 20;

      ctx.fillStyle = '#f1f5f9';
      ctx.font = `600 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      let lbl = c.label;
      while (ctx.measureText(lbl).width > innerW - 160 && lbl.length > 8) {
        lbl = lbl.slice(0, -4).trim() + '...';
      }
      ctx.fillText(lbl, x + padX, labelY);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 33px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${scoreTen} / 10`, x + padX + innerW, labelY);

      // Bar Zemini
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, x + padX, barY, innerW, barH, 10);
      ctx.fill();

      // Bar Doluluk
      const fillW = Math.max(12, innerW * (subVal / 10));
      const barGrad = ctx.createLinearGradient(x + padX, barY, x + padX + fillW, barY);
      barGrad.addColorStop(0, theme.gradient[0]);
      barGrad.addColorStop(1, theme.gradient[1]);
      ctx.fillStyle = barGrad;
      roundRect(ctx, x + padX, barY, fillW, barH, 10);
      ctx.fill();

      // 10'luk Sistem Segment Çentikleri
      ctx.strokeStyle = 'rgba(6, 10, 20, 0.42)';
      ctx.lineWidth = 1.6;
      for (let seg = 1; seg <= 9; seg++) {
        const sx = x + padX + (innerW * seg) / 10;
        ctx.beginPath();
        ctx.moveTo(sx, barY);
        ctx.lineTo(sx, barY + barH);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPrestigeSeal(ctx, x, y, w, h, seal, theme) {
    const borderColor = seal.isMasterpiece ? '#f59e0b' : (seal.isPick ? theme.accent : '#38bdf8');
    const titleColor = seal.isMasterpiece ? '#fbbf24' : (seal.isPick ? theme.accent : '#7dd3fc');

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.5;
    roundRect(ctx, x, y, w, h, 24);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 16);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = titleColor;
    ctx.font = `800 48px ${FONT_FAMILY}`;
    ctx.fillText(seal.icon || '★', x + w / 2, y + h * 0.24);

    ctx.fillStyle = titleColor;
    ctx.font = `800 34px ${FONT_FAMILY}`;
    ctx.fillText(seal.title || 'ONAYLI ARŞİV', x + w / 2, y + h * 0.49);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = `700 22px ${FONT_FAMILY}`;
    ctx.fillText(seal.subtitle || 'DEĞERLENDİRİLDİ', x + w / 2, y + h * 0.67);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(seal.footer || 'TEMPESTIAN ARŞİVİ', x + w / 2, y + h - 32);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 5. ŞABLON 1: TEKİL İÇERİK KARTI VE SEZON SLAYTLARI
  // --------------------------------------------------------------------------
  async function renderSingleReviewCoverSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub) {
    const posterUrl = item?.image ? item.image.replace('/cover/medium/', '/cover/large/') : (item?.banner || null);
    const posterImg = await loadImageWithTimeout(posterUrl, 3500);

    drawRetinaBackground(ctx, W, H, theme, posterImg);

    const catUpper = toTrUpper(CATEGORY_CONFIG[catKey]?.label || 'ARŞİV');
    const topLabelText = (customTitle && customTitle.trim())
      ? `✦ TEMPESTIAN ARŞİVİ · ${toTrUpper(customTitle.trim())} ✦`
      : `✦ TEMPESTIAN ARŞİVİ · ${catUpper} İNCELEMESİ ✦`;

    const topY = fmtKey === 'story' ? 130 : 90;
    drawTopBrandPill(ctx, W, topY, theme, topLabelText);

    const rawTitle = item?.title || 'Yapım İncelemesi';
    const subTitle = (customSub && customSub.trim())
      ? customSub.trim()
      : `${CATEGORY_CONFIG[catKey]?.label || 'Yapım'} İncelemesi ve Genel Değerlendirme · tempestian.com`;

    const titleInfo = drawWrappedTitle(ctx, rawTitle, W / 2, topY + 132, W - 190, {
      maxFontSize: 84,
      minFontSize: 58,
      color: '#ffffff',
      subtitle: subTitle,
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    const meta = getCategoryTerminology(catKey, item);
    const effScore = resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);
    const genres = getItemGenres(item, catKey, 5);
    const isRead = (catKey === 'book' || catKey === 'manga');
    const archiveStatusVal = item?.favorite
      ? '★ Başyapıt Seçkisi'
      : (catKey === 'guide' ? '✓ Yayında / Güncel' : statusToTurkish(item?.status));
    const hasMultipleParts = Array.isArray(item?.parts) && item.parts.length > 1;

    const contentTopY = Math.max(topY + 280, titleInfo.bottomY + 46);

    if (fmtKey === 'story') {
      // 9:16 Dikey Hikâye Düzeni (2160 × 3840)
      const posterW = 860;
      const posterH = 1220;
      const posterX = (W - posterW) / 2;
      const posterY = contentTopY;

      drawPosterCard(ctx, posterImg, posterX, posterY, posterW, posterH, 32, theme, catKey, rawTitle, {
        score: effScore,
        favorite: item?.favorite
      });

      // Tür Etiketleri (Ortalanmış)
      const gy = posterY + posterH + 44;
      drawGenrePills(ctx, genres, 110, gy, W - 220, theme, {
        pillH: 56,
        fontSize: 26,
        radius: 14,
        maxPills: 5
      });

      // 2x2 Meta Kartları
      const metaY = gy + 86;
      const metaCards = [
        { label: meta.creatorLabel, val: meta.creatorVal },
        { label: meta.subUnitLabel, val: meta.subUnitVal },
        { label: meta.extraLabel, val: meta.extraVal },
        { label: 'Arşiv Durumu', val: archiveStatusVal, color: item?.favorite ? '#fbbf24' : '#f8fafc' }
      ];
      drawMetaGridCards(ctx, 110, metaY, W - 220, 146, 22, 20, 2, metaCards, theme);

      // Kriter Barları
      const critY = metaY + 2 * 146 + 20 + 30;
      const critH = 740;
      const subScoresToUse = (window.TempestianRating && typeof window.TempestianRating.computeWeightedSubScores === 'function')
        ? (window.TempestianRating.computeWeightedSubScores(catKey, item) || item?.subScores)
        : item?.subScores;
      drawCriteriaPanel(ctx, 110, critY, W - 220, critH, criteriaList, subScoresToUse, effScore, theme, item?.summary);

      // Alt Bölüm (Kompakt & Orantılı)
      const bottomY = critY + critH + 34;
      const bottomH = H - bottomY - 150;
      const bottomW = W - 220;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      ctx.lineWidth = 2;
      roundRect(ctx, 110, bottomY, bottomW, bottomH, 26);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (hasMultipleParts) {
        drawBottomPartsShowcase(ctx, 110, bottomY, bottomW, bottomH, item, catKey, effScore, theme, false);
      } else {
        drawBottomSingleShowcase(ctx, 110, bottomY, bottomW, bottomH, item, catKey, effScore, theme, false);
      }

    } else {
      // 1:1 Kare (2160 × 2160) veya 4:5 Dikey (2160 × 2700)
      const isPortrait = (fmtKey === 'portrait');
      const sidePad = 96;
      const posterW = 800;
      const posterH = isPortrait ? 1320 : 1140;
      const posterX = sidePad;
      const posterY = contentTopY;

      drawPosterCard(ctx, posterImg, posterX, posterY, posterW, posterH, 32, theme, catKey, rawTitle, {
        score: effScore,
        favorite: item?.favorite
      });

      const rightX = posterX + posterW + 52;
      const rightW = W - rightX - sidePad;

      // 1. Tür Rozetleri
      const badgeH = 56;
      drawGenrePills(ctx, genres, rightX, posterY, rightW, theme, {
        pillH: badgeH,
        fontSize: 25,
        radius: 14,
        gap: 12,
        maxPills: 4
      });

      // 2. 2x2 Meta Kartlar
      const metaY = posterY + badgeH + 26;
      const mCardH = isPortrait ? 168 : 148;
      const metaCards = [
        { label: meta.creatorLabel, val: meta.creatorVal },
        { label: meta.subUnitLabel, val: meta.subUnitVal },
        { label: meta.extraLabel, val: meta.extraVal },
        { label: 'Arşiv Durumu', val: archiveStatusVal, color: item?.favorite ? '#fbbf24' : '#f8fafc' }
      ];
      drawMetaGridCards(ctx, rightX, metaY, rightW, mCardH, 20, 20, 2, metaCards, theme);

      // 3. Kriter Değerlendirme Paneli (Poster alt hizasına tam oturur)
      const critY = metaY + 2 * mCardH + 20 + 26;
      const critH = (posterY + posterH) - critY;
      const subScoresToUse = (window.TempestianRating && typeof window.TempestianRating.computeWeightedSubScores === 'function')
        ? (window.TempestianRating.computeWeightedSubScores(catKey, item) || item?.subScores)
        : item?.subScores;
      drawCriteriaPanel(ctx, rightX, critY, rightW, critH, criteriaList, subScoresToUse, effScore, theme, item?.summary);

      // 4. Alt Vitrin Bölümü
      const bottomX = sidePad;
      const bottomY = posterY + posterH + 38;
      const bottomW = W - sidePad * 2;
      const bottomH = H - bottomY - 148;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      ctx.lineWidth = 2;
      roundRect(ctx, bottomX, bottomY, bottomW, bottomH, 26);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (hasMultipleParts) {
        drawBottomPartsShowcase(ctx, bottomX, bottomY, bottomW, bottomH, item, catKey, effScore, theme, isPortrait);
      } else {
        drawBottomSingleShowcase(ctx, bottomX, bottomY, bottomW, bottomH, item, catKey, effScore, theme, isPortrait);
      }
    }

    drawFooterSignature(ctx, W, H);
  }

  function drawBottomPartsShowcase(ctx, bx, by, bw, bh, item, catKey, effScore, theme, isPortrait) {
    ctx.save();
    ctx.fillStyle = theme.accent;
    ctx.font = `800 28px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`✦ SERİ VE SEZON DÖKÜMÜ (${item.parts.length} PARÇA)`, bx + 32, by + 48);
    ctx.restore();

    const maxPartsToShow = Math.min(4, item.parts.length);
    const cardGap = 20;
    const partCardW = (bw - 64 - (maxPartsToShow - 1) * cardGap) / maxPartsToShow;
    const partCardY = by + 72;
    const partCardH = Math.min(isPortrait ? 340 : 250, bh - 96);

    for (let idx = 0; idx < maxPartsToShow; idx++) {
      const p = item.parts[idx];
      const px = bx + 32 + idx * (partCardW + cardGap);
      const isLastWithMore = (idx === maxPartsToShow - 1 && item.parts.length > maxPartsToShow);
      const extraCount = item.parts.length - (maxPartsToShow - 1);

      ctx.save();
      ctx.fillStyle = isLastWithMore ? `${theme.accent}12` : 'rgba(255, 255, 255, 0.045)';
      ctx.strokeStyle = isLastWithMore ? `${theme.accent}55` : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, px, partCardY, partCardW, partCardH, 20);
      ctx.fill();
      ctx.stroke();

      if (isLastWithMore) {
        // Kalan parçaların ortalama puanını hesapla
        const restParts = item.parts.slice(maxPartsToShow - 1);
        const ratedRest = restParts.filter(rp => Number(rp.score) > 0);
        const avgRest = ratedRest.length
          ? (ratedRest.reduce((a, b) => a + Number(b.score), 0) / ratedRest.length).toFixed(1)
          : Number(effScore).toFixed(1);

        ctx.fillStyle = theme.accent;
        ctx.font = `800 40px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${extraCount} PARÇA DAHA`, px + partCardW / 2, partCardY + partCardH * 0.30);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 26px ${FONT_FAMILY}`;
        ctx.fillText(`Diğer Sezonlar Ort: ★ ${avgRest}`, px + partCardW / 2, partCardY + partCardH * 0.54);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `600 24px ${FONT_FAMILY}`;
        ctx.fillText('Sonraki Slaytlarda Devamı →', px + partCardW / 2, partCardY + partCardH * 0.78);
      } else {
        const shortName = formatPartShortLabel(item?.title, p.name, idx);
        ctx.fillStyle = '#f8fafc';
        ctx.font = `700 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        let pName = shortName;
        while (ctx.measureText(pName).width > partCardW - 44 && pName.length > 5) {
          pName = pName.slice(0, -4).trim() + '...';
        }
        ctx.fillText(pName, px + 24, partCardY + 52);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = `500 25px ${FONT_FAMILY}`;
        const kindLabel = formatKindToTurkish(p.format, p.kind, catKey);
        const epLabel = p.episodes ? ` · ${p.episodes} Blm` : '';
        const yrLabel = p.year ? ` · ${p.year}` : '';
        let metaLine = `${kindLabel}${epLabel}${yrLabel}`;
        while (ctx.measureText(metaLine).width > partCardW - 44 && metaLine.length > 6) {
          metaLine = metaLine.slice(0, -4).trim() + '...';
        }
        ctx.fillText(metaLine, px + 24, partCardY + 96);

        const pSc = Number(p.score) || effScore;
        const scPillW = partCardW - 48;
        const scPillH = 56;
        const scPillX = px + 24;
        const scPillY = partCardY + partCardH - scPillH - 22;

        ctx.fillStyle = `${theme.accent}1c`;
        ctx.strokeStyle = `${theme.accent}88`;
        ctx.lineWidth = 2;
        roundRect(ctx, scPillX, scPillY, scPillW, scPillH, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ ${Number(pSc).toFixed(1)} / 10`, scPillX + scPillW / 2, scPillY + scPillH / 2 + 1);
      }
      ctx.restore();
    }
  }

  function drawBottomSingleShowcase(ctx, bx, by, bw, bh, item, catKey, effScore, theme, isPortrait) {
    const meta = getItemArchiveMeta(item, catKey);
    const sealW = 360;
    const sealH = Math.min(isPortrait ? 380 : 260, bh - 44);
    const sealX = bx + bw - sealW - 28;
    const sealY = by + (bh - sealH) / 2;
    const leftW = (sealX - bx) - 36;

    ctx.save();
    ctx.fillStyle = theme.accent;
    ctx.font = `800 28px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('✦ ARŞİV KÜNYESİ VE BİÇİM BİLGİLERİ', bx + 32, by + 48);

    const cardGap = 18;
    const cardW = (leftW - 32 - 2 * cardGap) / 3;
    const cardH = 114;
    const cardY = by + 72;

    const cards = [
      { label: 'BİÇİM & UZUNLUK', val: meta.formatLabel, color: '#f8fafc' },
      { label: 'ÇIKIŞ YILI', val: meta.year, color: '#f8fafc' },
      { label: 'ARŞİV DURUMU', val: meta.repeatLabel, color: meta.repeatCount > 0 ? theme.accent : '#7dd3fc' }
    ];

    for (let i = 0; i < cards.length; i++) {
      const cx = bx + 32 + i * (cardW + cardGap);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx, cardY, cardW, cardH, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 22px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(cards[i].label, cx + 22, cardY + 38);

      ctx.fillStyle = cards[i].color;
      ctx.font = `700 28px ${FONT_FAMILY}`;
      let valStr = cards[i].val;
      while (ctx.measureText(valStr).width > cardW - 44 && valStr.length > 5) {
        valStr = valStr.slice(0, -4).trim() + '...';
      }
      ctx.fillText(valStr, cx + 22, cardY + 84);
    }

    const tagRowY = cardY + cardH + 22;
    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 23px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText('TÜRLER:', bx + 32, tagRowY + 34);

    const genreStartX = bx + 32 + ctx.measureText('TÜRLER:').width + 18;
    drawGenrePills(ctx, meta.genres, genreStartX, tagRowY, leftW - (genreStartX - bx), theme, {
      pillH: 52,
      fontSize: 24,
      radius: 14,
      maxPills: 4
    });
    ctx.restore();

    const seal = getPrestigeSealContent(effScore, item?.favorite, catKey);
    drawPrestigeSeal(ctx, sealX, sealY, sealW, sealH, seal, theme);
  }

  // Slayt 2..N: Parça / Sezon Detay Slaytı (Karusel Modu)
  async function renderSingleReviewPartSlide(ctx, W, H, item, part, partIndex, totalParts, catKey, theme, fmtKey) {
    const posterUrl = part?.image || item?.image;
    const posterImg = await loadImageWithTimeout(posterUrl ? posterUrl.replace('/cover/medium/', '/cover/large/') : null, 3500);

    drawRetinaBackground(ctx, W, H, theme, posterImg);

    const topY = fmtKey === 'story' ? 130 : 90;
    drawTopBrandPill(ctx, W, topY, theme, `✦ ${toTrUpper(item?.title || 'YAPIM')} · BÖLÜM ${partIndex + 1}/${totalParts} ✦`);

    const partTitle = part?.name || `${partIndex + 1}. Sezon / Parça`;
    const kindStr = formatKindToTurkish(part?.format, part?.kind, catKey);
    const epStr = part?.episodes ? ` · ${part.episodes} Bölüm` : '';
    const yrStr = part?.year ? ` · ${part.year}` : '';

    const titleInfo = drawWrappedTitle(ctx, partTitle, W / 2, topY + 132, W - 190, {
      maxFontSize: 80,
      minFontSize: 56,
      color: '#ffffff',
      subtitle: `${kindStr}${epStr}${yrStr}`,
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    const partScore = Number(part?.score) || resolveItemEffectiveScore(item, catKey);
    const effScore = resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);
    const isRead = (catKey === 'book' || catKey === 'manga');
    const genres = getItemGenres(item, catKey, 5);
    const contentTopY = Math.max(topY + 280, titleInfo.bottomY + 46);

    const pFormatTr = formatKindToTurkish(part?.format, part?.kind, catKey);
    const pEp = part?.episodes ? `${part.episodes} Bölüm` : (part?.duration ? `${part.duration} Dk` : 'Tek Parça');
    const pRep = Number(part?.repeat) || 0;
    const pRepLabel = pRep > 0 ? `↻ ${pRep} Kez ${isRead ? 'Okundu' : 'İzlendi'}` : statusToTurkish(part?.status);

    if (fmtKey === 'story') {
      const posterW = 860;
      const posterH = 1220;
      const posterX = (W - posterW) / 2;
      const posterY = contentTopY;

      drawPosterCard(ctx, posterImg, posterX, posterY, posterW, posterH, 32, theme, catKey, partTitle, {
        score: partScore,
        favorite: partScore >= 9.5
      });

      const metaY = posterY + posterH + 44;
      const metaCards = [
        { label: 'Yayın Biçimi', val: pFormatTr },
        { label: 'Bölüm / Uzunluk', val: pEp },
        { label: 'Yayın Yılı', val: String(part?.year || item?.year || '-') },
        { label: 'Seri Ortalaması', val: `★ ${Number(effScore).toFixed(1)} / 10`, color: theme.accent }
      ];
      drawMetaGridCards(ctx, 110, metaY, W - 220, 146, 22, 20, 2, metaCards, theme);

      const critY = metaY + 2 * 146 + 20 + 30;
      const critH = 740;
      const subScoresToUse = (part?.subScores && Object.keys(part.subScores).length) ? part.subScores : item?.subScores;
      drawCriteriaPanel(ctx, 110, critY, W - 220, critH, criteriaList, subScoresToUse, partScore, theme);

      const bottomY = critY + critH + 34;
      const bottomH = H - bottomY - 150;
      const bottomW = W - 220;
      drawPartBottomShowcase(ctx, 110, bottomY, bottomW, bottomH, pFormatTr, pEp, part?.year || item?.year, pRepLabel, pRep, genres, partScore, isRead, theme, false);

    } else {
      const isPortrait = (fmtKey === 'portrait');
      const sidePad = 96;
      const posterW = 800;
      const posterH = isPortrait ? 1320 : 1140;
      const posterX = sidePad;
      const posterY = contentTopY;

      drawPosterCard(ctx, posterImg, posterX, posterY, posterW, posterH, 32, theme, catKey, partTitle, {
        score: partScore,
        favorite: partScore >= 9.5
      });

      const rightX = posterX + posterW + 52;
      const rightW = W - rightX - sidePad;

      // Üst Sezon Rozet Şeridi
      const badgeH = 62;
      ctx.save();
      ctx.fillStyle = `${theme.accent}18`;
      ctx.strokeStyle = `${theme.accent}55`;
      ctx.lineWidth = 2;
      roundRect(ctx, rightX, posterY, rightW, badgeH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`PARÇA ${partIndex + 1} / ${totalParts} · SEZON KARNESİ`, rightX + 26, posterY + badgeH / 2 + 1);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `600 24px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`Biçim: ${pFormatTr}`, rightX + rightW - 26, posterY + badgeH / 2 + 1);
      ctx.restore();

      const metaY = posterY + badgeH + 24;
      const mCardH = isPortrait ? 168 : 148;
      const metaCards = [
        { label: 'Yayın Biçimi', val: pFormatTr },
        { label: 'Bölüm / Uzunluk', val: pEp },
        { label: 'Yayın Yılı', val: String(part?.year || item?.year || '-') },
        { label: 'Genel Seri Ortalaması', val: `★ ${Number(effScore).toFixed(1)} / 10`, color: theme.accent }
      ];
      drawMetaGridCards(ctx, rightX, metaY, rightW, mCardH, 20, 20, 2, metaCards, theme);

      const critY = metaY + 2 * mCardH + 20 + 24;
      const critH = (posterY + posterH) - critY;
      const subScoresToUse = (part?.subScores && Object.keys(part.subScores).length) ? part.subScores : item?.subScores;
      drawCriteriaPanel(ctx, rightX, critY, rightW, critH, criteriaList, subScoresToUse, partScore, theme);

      const bottomX = sidePad;
      const bottomY = posterY + posterH + 38;
      const bottomW = W - sidePad * 2;
      const bottomH = H - bottomY - 148;
      drawPartBottomShowcase(ctx, bottomX, bottomY, bottomW, bottomH, pFormatTr, pEp, part?.year || item?.year, pRepLabel, pRep, genres, partScore, isRead, theme, isPortrait);
    }

    drawFooterSignature(ctx, W, H);
  }

  function drawPartBottomShowcase(ctx, bx, by, bw, bh, pFormatTr, pEp, yearVal, pRepLabel, pRep, genres, partScore, isRead, theme, isPortrait) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, 26);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const sealW = 360;
    const sealH = Math.min(isPortrait ? 380 : 260, bh - 44);
    const sealX = bx + bw - sealW - 28;
    const sealY = by + (bh - sealH) / 2;
    const leftW = (sealX - bx) - 36;

    ctx.save();
    ctx.fillStyle = theme.accent;
    ctx.font = `800 28px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('✦ SEZON BİLGİLERİ VE ARŞİV VERİLERİ', bx + 32, by + 48);

    const cardGap = 18;
    const cardW = (leftW - 32 - 2 * cardGap) / 3;
    const cardH = 114;
    const cardY = by + 72;

    const cards = [
      { label: 'BİÇİM & BÖLÜM', val: `${pFormatTr} · ${pEp}`, color: '#f8fafc' },
      { label: 'YAYIN YILI', val: String(yearVal || '-'), color: '#f8fafc' },
      { label: 'SEZON DURUMU', val: pRepLabel, color: pRep > 0 ? theme.accent : '#7dd3fc' }
    ];

    for (let i = 0; i < cards.length; i++) {
      const cx = bx + 32 + i * (cardW + cardGap);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx, cardY, cardW, cardH, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 22px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(cards[i].label, cx + 22, cardY + 38);

      ctx.fillStyle = cards[i].color;
      ctx.font = `700 28px ${FONT_FAMILY}`;
      let valStr = cards[i].val;
      while (ctx.measureText(valStr).width > cardW - 44 && valStr.length > 5) {
        valStr = valStr.slice(0, -4).trim() + '...';
      }
      ctx.fillText(valStr, cx + 22, cardY + 84);
    }

    const tagRowY = cardY + cardH + 22;
    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 23px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText('TÜRLER:', bx + 32, tagRowY + 34);

    const genreStartX = bx + 32 + ctx.measureText('TÜRLER:').width + 18;
    drawGenrePills(ctx, genres, genreStartX, tagRowY, leftW - (genreStartX - bx), theme, {
      pillH: 52,
      fontSize: 24,
      radius: 14,
      maxPills: 4
    });
    ctx.restore();

    const partSeal = getPartPrestigeSealContent(partScore, isRead);
    drawPrestigeSeal(ctx, sealX, sealY, sealW, sealH, partSeal, theme);
  }

  // Varyasyon B: Tek Kare Özet Modu (Kompakt Karne)
  async function renderSingleReviewCompactSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub) {
    const posterUrl = item?.image ? item.image.replace('/cover/medium/', '/cover/large/') : (item?.banner || null);
    const posterImg = await loadImageWithTimeout(posterUrl, 3500);

    drawRetinaBackground(ctx, W, H, theme, posterImg);

    const catUpper = toTrUpper(CATEGORY_CONFIG[catKey]?.label || 'ARŞİV');
    const topLabel = (customTitle && customTitle.trim())
      ? `✦ TEMPESTIAN ARŞİVİ · ${toTrUpper(customTitle.trim())} ✦`
      : `✦ TEMPESTIAN ARŞİVİ · ${catUpper} ÖZETİ ✦`;

    const topY = fmtKey === 'story' ? 130 : 90;
    drawTopBrandPill(ctx, W, topY, theme, topLabel);

    const subTitle = (customSub && customSub.trim())
      ? customSub.trim()
      : 'Sezon ve Bölümler Toplu Değerlendirme Karnesi';

    const titleInfo = drawWrappedTitle(ctx, item?.title || 'Yapım Karnesi', W / 2, topY + 132, W - 190, {
      maxFontSize: 84,
      minFontSize: 58,
      color: '#ffffff',
      subtitle: subTitle,
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    const effScore = resolveItemEffectiveScore(item, catKey);
    const parts = Array.isArray(item?.parts) && item.parts.length > 0
      ? item.parts
      : [{ name: item?.title, score: effScore, episodes: item?.episodes, year: item?.year }];
    const contentTopY = Math.max(topY + 280, titleInfo.bottomY + 46);
    const genres = getItemGenres(item, catKey, 5);
    const totalPartsCount = parts.length;
    const totalEpisodes = parts.reduce((acc, p) => acc + (Number(p.episodes) || 0), 0) || item?.episodes || 0;
    const repeatCount = getItemRepeatCount(item);
    const isRead = (catKey === 'book' || catKey === 'manga');
    const repeatLabel = repeatCount > 0 ? `↻ ${repeatCount} Kez ${isRead ? 'Okundu' : 'İzlendi'}` : '✓ Arşivde Kayıtlı';

    const drawPartsList = (rx, ry, rw, rh, maxShow) => {
      const listCount = Math.min(maxShow, parts.length);
      const partGap = 18;
      const partH = (rh - (listCount - 1) * partGap) / listCount;

      for (let i = 0; i < listCount; i++) {
        const p = parts[i];
        const py = ry + i * (partH + partGap);
        const sc = Number(p.score) || effScore;
        const shortLabel = formatPartShortLabel(item?.title, p.name, i);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, rx, py, rw, partH, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 34px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${i + 1}`, rx + 26, py + partH / 2);

        ctx.fillStyle = '#f8fafc';
        ctx.font = `700 32px ${FONT_FAMILY}`;
        let pName = shortLabel;
        while (ctx.measureText(pName).width > rw - 320 && pName.length > 5) {
          pName = pName.slice(0, -4).trim() + '...';
        }
        ctx.fillText(pName, rx + 96, py + partH / 2 - 16);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = `500 24px ${FONT_FAMILY}`;
        const subInfo = `${formatKindToTurkish(p.format, p.kind, catKey)} · ${p.episodes ? `${p.episodes} Bölüm` : 'Tek Parça'} · ${p.year || '-'}`;
        ctx.fillText(subInfo, rx + 96, py + partH / 2 + 22);

        const badgeW = 180;
        const badgeH = Math.min(68, partH - 24);
        const badgeX = rx + rw - badgeW - 22;
        const badgeY = py + (partH - badgeH) / 2;
        ctx.fillStyle = `${theme.accent}1c`;
        ctx.strokeStyle = `${theme.accent}88`;
        ctx.lineWidth = 2;
        roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(`★ ${Number(sc).toFixed(1)}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
        ctx.restore();
      }
    };

    const drawCompactBottom = (bx, by, bw, bh, isPortrait) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      ctx.lineWidth = 2;
      roundRect(ctx, bx, by, bw, bh, 26);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const sealW = 360;
      const sealH = Math.min(isPortrait ? 380 : 260, bh - 44);
      const sealX = bx + bw - sealW - 28;
      const sealY = by + (bh - sealH) / 2;
      const leftW = (sealX - bx) - 36;

      ctx.save();
      ctx.fillStyle = theme.accent;
      ctx.font = `800 28px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('✦ GENEL SERİ İSTATİSTİKLERİ VE ARŞİV KARNESİ', bx + 32, by + 48);

      const cardGap = 18;
      const cardW = (leftW - 32 - 2 * cardGap) / 3;
      const cardH = 114;
      const cardY = by + 72;

      const cards = [
        { label: 'TOPLAM PARÇA', val: `${totalPartsCount} Parça · ${totalEpisodes} Blm`, color: '#f8fafc' },
        { label: 'ÇIKIŞ YILI', val: String(item?.year || parts[0]?.year || '-'), color: '#f8fafc' },
        { label: 'ARŞİV DURUMU', val: repeatLabel, color: repeatCount > 0 ? theme.accent : '#7dd3fc' }
      ];

      for (let i = 0; i < cards.length; i++) {
        const cx = bx + 32 + i * (cardW + cardGap);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, cx, cardY, cardW, cardH, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = `600 22px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(cards[i].label, cx + 22, cardY + 38);

        ctx.fillStyle = cards[i].color;
        ctx.font = `700 28px ${FONT_FAMILY}`;
        let valStr = cards[i].val;
        while (ctx.measureText(valStr).width > cardW - 44 && valStr.length > 5) {
          valStr = valStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(valStr, cx + 22, cardY + 84);
      }

      const tagRowY = cardY + cardH + 22;
      ctx.fillStyle = '#94a3b8';
      ctx.font = `700 23px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('TÜRLER:', bx + 32, tagRowY + 34);

      const genreStartX = bx + 32 + ctx.measureText('TÜRLER:').width + 18;
      drawGenrePills(ctx, genres, genreStartX, tagRowY, leftW - (genreStartX - bx), theme, {
        pillH: 52,
        fontSize: 24,
        radius: 14,
        maxPills: 4
      });
      ctx.restore();

      const sealData = getPrestigeSealContent(effScore, item?.favorite, catKey);
      drawPrestigeSeal(ctx, sealX, sealY, sealW, sealH, sealData, theme);
    };

    if (fmtKey === 'story') {
      const posterW = 860;
      const posterH = 1220;
      const posterX = (W - posterW) / 2;
      const posterY = contentTopY;

      drawPosterCard(ctx, posterImg, posterX, posterY, posterW, posterH, 32, theme, catKey, item?.title, {
        score: effScore,
        favorite: item?.favorite
      });

      const listY = posterY + posterH + 46;
      const listH = 1140;
      drawPartsList(110, listY, W - 220, listH, 7);

      const bottomY = listY + listH + 34;
      const bottomH = H - bottomY - 150;
      drawCompactBottom(110, bottomY, W - 220, bottomH, false);
    } else {
      const isPortrait = (fmtKey === 'portrait');
      const sidePad = 96;
      const posterW = 800;
      const posterH = isPortrait ? 1320 : 1140;
      const posterX = sidePad;
      const posterY = contentTopY;

      drawPosterCard(ctx, posterImg, posterX, posterY, posterW, posterH, 32, theme, catKey, item?.title, {
        score: effScore,
        favorite: item?.favorite
      });

      const rightX = posterX + posterW + 52;
      const rightW = W - rightX - sidePad;
      drawPartsList(rightX, posterY, rightW, posterH, isPortrait ? 7 : 6);

      const bottomY = posterY + posterH + 38;
      const bottomH = H - bottomY - 148;
      drawCompactBottom(sidePad, bottomY, W - sidePad * 2, bottomH, isPortrait);
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 6. ŞABLON 2: TEMPESTIAN YILLIK ÖZETİ (4 SLAYTLIK ÇOKLU ÖZET)
  // --------------------------------------------------------------------------
  async function renderWrappedChampionsSlide(ctx, W, H, allData, year, theme, fmtKey, customTitle, customSub) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = fmtKey === 'story' ? 130 : 100;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    const topLabel = (customTitle && customTitle.trim())
      ? `✦ ${toTrUpper(customTitle.trim())} · ${yearLabel} ✦`
      : `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`;
    drawTopBrandPill(ctx, W, topY, theme, topLabel);

    const titleInfo = drawWrappedTitle(ctx, 'ZİRVEDEKİLER · EN İYİLER', W / 2, topY + 132, W - 190, {
      maxFontSize: 74,
      minFontSize: 56,
      color: '#ffffff',
      subtitle: (customSub && customSub.trim()) ? customSub.trim() : 'Kategoriler bazında en yüksek puanlı başyapıtlar',
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    const champs = [];
    const cats = ['anime', 'series', 'movie', 'manga', 'book'];

    for (const ck of cats) {
      const cData = allData[ck] || { items: [] };
      let list = cData.items || [];
      if (year !== 'all') {
        const filtered = list.filter(it => {
          const y = it.year || (it.addedAt && it.addedAt.slice(0, 4)) || (Array.isArray(it.parts) && it.parts[0]?.year);
          return String(y) === String(year);
        });
        if (filtered.length) list = filtered;
      }
      const sorted = list
        .map(it => ({ ...it, catKey: ck, effScore: resolveItemEffectiveScore(it, ck) }))
        .sort((a, b) => (b.effScore || 0) - (a.effScore || 0));
      if (sorted.length > 0) {
        champs.push(sorted[0]);
      }
    }

    const startY = Math.max(topY + 280, titleInfo.bottomY + 56);
    const availableH = H - startY - 160;

    if (!champs.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 44px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Bu döneme ait arşiv kaydı bulunamadı.', W / 2, H / 2);
      drawFooterSignature(ctx, W, H);
      return;
    }

    const drawChampCard = async (it, cx, cy, cw, ch) => {
      const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
      const img = await loadImageWithTimeout(imgUrl, 2500);

      if (img) {
        drawCoverImage(ctx, img, cx, cy, cw, ch, 28, 0.28);
      } else {
        drawPosterPlaceholder(ctx, cx, cy, cw, ch, 28, theme, it.catKey, it.title);
      }

      ctx.save();
      roundRect(ctx, cx, cy, cw, ch, 28);
      ctx.clip();
      const sh = ctx.createLinearGradient(cx, cy + ch * 0.42, cx, cy + ch);
      sh.addColorStop(0, 'rgba(4, 7, 16, 0)');
      sh.addColorStop(1, 'rgba(4, 7, 16, 0.94)');
      ctx.fillStyle = sh;
      ctx.fillRect(cx, cy + ch * 0.42, cw, ch * 0.58);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 26px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(toTrUpper(CATEGORY_CONFIG[it.catKey]?.label || 'MEDYA'), cx + 24, cy + ch - 108);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      let titleStr = it.title || '';
      while (ctx.measureText(titleStr).width > cw - 48 && titleStr.length > 5) {
        titleStr = titleStr.slice(0, -4).trim() + '...';
      }
      ctx.fillText(titleStr, cx + 24, cy + ch - 56);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
      ctx.lineWidth = 2.5;
      roundRect(ctx, cx, cy, cw, ch, 28);
      ctx.stroke();

      const scW = 156;
      const scH = 64;
      const scX = cx + cw - scW - 18;
      const scY = cy + 18;
      ctx.fillStyle = 'rgba(8, 13, 25, 0.88)';
      ctx.strokeStyle = `${theme.accent}cc`;
      ctx.lineWidth = 2;
      roundRect(ctx, scX, scY, scW, scH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 30px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${it.effScore}`, scX + scW / 2, scY + scH / 2 + 1);
      ctx.restore();
    };

    if (fmtKey === 'story') {
      // 9:16 için 2 sütunlu düzenli grid (kartlar ince şerit olmasın)
      const cols = 2;
      const gap = 32;
      const cardW = (W - 200 - gap) / cols;
      const rows = Math.ceil(champs.length / cols);
      const cardH = Math.min(920, (availableH - (rows - 1) * gap) / rows);

      for (let i = 0; i < champs.length; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const isLastOdd = (champs.length % 2 === 1 && i === champs.length - 1);
        const cx = isLastOdd ? (W - cardW) / 2 : (100 + c * (cardW + gap));
        const cy = startY + r * (cardH + gap);
        await drawChampCard(champs[i], cx, cy, cardW, cardH);
      }
    } else {
      const count = Math.min(5, champs.length);
      const cardGap = 28;
      const cardW = (W - 200 - (count - 1) * cardGap) / count;
      const cardH = Math.min(1380, availableH);
      const cy = startY + (availableH - cardH) / 2;

      for (let i = 0; i < count; i++) {
        const cx = 100 + i * (cardW + cardGap);
        await drawChampCard(champs[i], cx, cy, cardW, cardH);
      }
    }

    drawFooterSignature(ctx, W, H);
  }

  async function renderWrappedNumbersSlide(ctx, W, H, allData, year, theme, fmtKey, customTitle, customSub) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = fmtKey === 'story' ? 130 : 100;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    const topLabel = (customTitle && customTitle.trim())
      ? `✦ ${toTrUpper(customTitle.trim())} · ${yearLabel} ✦`
      : `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`;
    drawTopBrandPill(ctx, W, topY, theme, topLabel);

    const titleInfo = drawWrappedTitle(ctx, 'RAKAMLARLA ARŞİV BİLANÇOSU', W / 2, topY + 132, W - 190, {
      maxFontSize: 72,
      minFontSize: 54,
      color: '#ffffff',
      subtitle: (customSub && customSub.trim()) ? customSub.trim() : 'İzlenen, okunan ve arşive kazandırılan gerçek veriler',
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    let animeEpisodes = 0;
    let movieCount = 0;
    let movieHours = 0;
    let seriesSeasons = 0;
    let totalPages = 0;
    let favCount = 0;
    let totalWorks = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const ck of Object.keys(CATEGORY_CONFIG)) {
      const cData = allData[ck] || { items: [] };
      for (const it of (cData.items || [])) {
        if (year !== 'all') {
          const y = it.year || (it.addedAt && it.addedAt.slice(0, 4)) || (Array.isArray(it.parts) && it.parts[0]?.year);
          if (String(y) !== String(year)) continue;
        }
        totalWorks++;
        if (it.favorite) favCount++;
        const sc = resolveItemEffectiveScore(it, ck);
        if (sc > 0) { scoreSum += sc; scoreCount++; }

        if (ck === 'anime') {
          if (Array.isArray(it.parts) && it.parts.length) {
            for (const p of it.parts) animeEpisodes += Number(p.episodes) || 0;
          } else {
            animeEpisodes += Number(it.episodes) || 0;
          }
        } else if (ck === 'movie') {
          movieCount++;
          const dur = Number(it.duration) || (Array.isArray(it.parts) && Number(it.parts[0]?.duration)) || 105;
          movieHours += Math.round(dur / 60);
        } else if (ck === 'series') {
          seriesSeasons += Array.isArray(it.parts) && it.parts.length ? it.parts.length : 1;
        } else if (ck === 'book' || ck === 'manga') {
          totalPages += Number(it.pages) || Number(it.chapters) || 0;
        }
      }
    }

    const avgScore = scoreCount ? (scoreSum / scoreCount).toFixed(1) : '-';

    const kpis = [
      { label: 'İZLENEN ANİME BÖLÜMÜ', val: animeEpisodes.toLocaleString('tr-TR'), sub: 'Tamamlanan Bölüm Sayısı', icon: '📺' },
      { label: 'SİNEMA VE FİLM ARŞİVİ', val: movieCount > 0 ? `${movieCount} Film` : '0 Film', sub: movieHours > 0 ? `Yaklaşık ${movieHours} Saatlik Sinema` : 'Kayıtlı Sinema Eseri', icon: '🍿' },
      { label: 'DİZİ SEZONU', val: `${seriesSeasons} Sezon`, sub: 'Tamamlanan Dizi Sezonu', icon: '🎬' },
      { label: 'KİTAP & MANGA', val: totalPages.toLocaleString('tr-TR'), sub: 'Okunan Sayfa / Bölüm', icon: '📚' },
      { label: 'ORTALAMA ARŞİV PUANI', val: avgScore !== '-' ? `★ ${avgScore}` : '-', sub: `${scoreCount} Eser Değerlendirildi`, icon: '★' },
      { label: 'BAŞYAPIT VE FAVORİLER', val: `${favCount} / ${totalWorks}`, sub: 'Kişisel Seçki Listesinde', icon: '✦' }
    ];

    const startY = Math.max(topY + 280, titleInfo.bottomY + 56);
    const cols = 2;
    const rows = 3;
    const cardGapX = 36;
    const cardGapY = 30;
    const cardW = (W - 200 - cardGapX) / cols;
    const maxCardH = fmtKey === 'story' ? 540 : 440;
    const cardH = Math.min(maxCardH, (H - startY - 170 - (rows - 1) * cardGapY) / rows);

    for (let i = 0; i < kpis.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const kx = 100 + c * (cardW + cardGapX);
      const ky = startY + r * (cardH + cardGapY);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, kx, ky, cardW, cardH, 26);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      roundRect(ctx, kx + 28, ky + 34, 8, 42, 4);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `700 26px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${kpis[i].icon} ${kpis[i].label}`, kx + 52, ky + 64);

      ctx.fillStyle = '#ffffff';
      ctx.font = `800 72px ${FONT_FAMILY}`;
      ctx.fillText(kpis[i].val, kx + 36, ky + cardH * 0.58);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 26px ${FONT_FAMILY}`;
      ctx.fillText(kpis[i].sub, kx + 36, ky + cardH - 38);
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  async function renderWrappedTasteSlide(ctx, W, H, allData, year, theme, fmtKey, customTitle, customSub) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = fmtKey === 'story' ? 130 : 100;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    const topLabel = (customTitle && customTitle.trim())
      ? `✦ ${toTrUpper(customTitle.trim())} · ${yearLabel} ✦`
      : `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`;
    drawTopBrandPill(ctx, W, topY, theme, topLabel);

    const titleInfo = drawWrappedTitle(ctx, 'BEĞENİ PROFİLİ · EN SEVİLEN TÜRLER', W / 2, topY + 132, W - 190, {
      maxFontSize: 72,
      minFontSize: 54,
      color: '#ffffff',
      subtitle: (customSub && customSub.trim()) ? customSub.trim() : 'En çok tüketilen türler ve ortalama beğeni düzeyleri',
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    const genreMap = {};
    for (const ck of Object.keys(CATEGORY_CONFIG)) {
      const cData = allData[ck] || { items: [] };
      for (const it of (cData.items || [])) {
        if (year !== 'all') {
          const y = it.year || (it.addedAt && it.addedAt.slice(0, 4)) || (Array.isArray(it.parts) && it.parts[0]?.year);
          if (String(y) !== String(year)) continue;
        }
        const sc = resolveItemEffectiveScore(it, ck);
        const itemGenres = getItemGenres(it, ck, 10);
        for (const g of itemGenres) {
          if (!genreMap[g]) genreMap[g] = { count: 0, scoreSum: 0, scored: 0 };
          genreMap[g].count++;
          if (sc > 0) {
            genreMap[g].scoreSum += sc;
            genreMap[g].scored++;
          }
        }
      }
    }

    const topGenres = Object.keys(genreMap).map(g => ({
      name: g,
      count: genreMap[g].count,
      avg: genreMap[g].scored ? (genreMap[g].scoreSum / genreMap[g].scored).toFixed(1) : '-'
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    if (!topGenres.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 44px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Bu dönem için tür verisi bulunamadı.', W / 2, H / 2);
      drawFooterSignature(ctx, W, H);
      return;
    }

    const startY = Math.max(topY + 280, titleInfo.bottomY + 56);
    const maxCount = topGenres[0].count;
    const barW = W - 200;
    const availableH = H - startY - 170;
    const rowGap = 26;
    const rowH = Math.min(280, Math.floor((availableH - (topGenres.length - 1) * rowGap) / topGenres.length));

    for (let i = 0; i < topGenres.length; i++) {
      const tg = topGenres[i];
      const gy = startY + i * (rowH + rowGap);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 100, gy, barW, rowH, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 38px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${i + 1}. ${tg.name}`, 136, gy + 58);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 36px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      const avgTxt = tg.avg !== '-' ? ` · ★ ${tg.avg}` : '';
      ctx.fillText(`${tg.count} Eser${avgTxt}`, 100 + barW - 36, gy + 58);

      const pBarY = gy + 88;
      const pBarW = barW - 72;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, 136, pBarY, pBarW, 28, 14);
      ctx.fill();

      const fillW = Math.max(28, pBarW * (tg.count / maxCount));
      const bGrad = ctx.createLinearGradient(136, pBarY, 136 + fillW, pBarY);
      bGrad.addColorStop(0, theme.gradient[0]);
      bGrad.addColorStop(1, theme.gradient[1]);
      ctx.fillStyle = bGrad;
      roundRect(ctx, 136, pBarY, fillW, 28, 14);
      ctx.fill();

      if (rowH >= 175) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = `500 26px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(`Kişisel arşivde en yüksek ilgiye sahip ${i + 1}. tür kategorisi`, 136, gy + 158);
      }
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  async function renderWrappedHiddenGemsSlide(ctx, W, H, allData, year, theme, fmtKey, customTitle, customSub) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const topY = fmtKey === 'story' ? 130 : 100;
    const yearLabel = year === 'all' ? 'TÜM ZAMANLAR' : `${year} YILI`;
    const topLabel = (customTitle && customTitle.trim())
      ? `✦ ${toTrUpper(customTitle.trim())} · ${yearLabel} ✦`
      : `✦ TEMPESTIAN YILLIK ÖZETİ · ${yearLabel} ✦`;
    drawTopBrandPill(ctx, W, topY, theme, topLabel);

    const titleInfo = drawWrappedTitle(ctx, 'GİZLİ CEVHERLER · SÜRPRİZ BAŞYAPITLAR', W / 2, topY + 132, W - 190, {
      maxFontSize: 72,
      minFontSize: 52,
      color: '#ffffff',
      subtitle: (customSub && customSub.trim()) ? customSub.trim() : 'Yüksek puanlı, keşfedilmeyi bekleyen seçkin yapımlar',
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    let allGems = [];
    for (const ck of Object.keys(CATEGORY_CONFIG)) {
      const cData = allData[ck] || { items: [] };
      for (const it of (cData.items || [])) {
        if (year !== 'all') {
          const y = it.year || (it.addedAt && it.addedAt.slice(0, 4)) || (Array.isArray(it.parts) && it.parts[0]?.year);
          if (String(y) !== String(year)) continue;
        }
        const sc = resolveItemEffectiveScore(it, ck);
        if (sc >= 8.5) {
          allGems.push({ ...it, catKey: ck, effScore: sc });
        }
      }
    }
    if (allGems.length < 4 && year !== 'all') {
      allGems = [];
      for (const ck of Object.keys(CATEGORY_CONFIG)) {
        const cData = allData[ck] || { items: [] };
        for (const it of (cData.items || [])) {
          const sc = resolveItemEffectiveScore(it, ck);
          if (sc >= 8.5) allGems.push({ ...it, catKey: ck, effScore: sc });
        }
      }
    }

    allGems.sort((a, b) => (b.effScore || 0) - (a.effScore || 0));
    const gems = allGems.slice(2, 6);
    const count = Math.min(4, gems.length);
    const startY = Math.max(topY + 280, titleInfo.bottomY + 56);
    const availableH = H - startY - 160;

    if (count === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 44px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Bu kriterlere uygun yapım bulunamadı.', W / 2, H / 2);
      drawFooterSignature(ctx, W, H);
      return;
    }

    const drawGemCard = async (it, cx, cy, cw, ch) => {
      const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
      const img = await loadImageWithTimeout(imgUrl, 2500);

      if (img) {
        drawCoverImage(ctx, img, cx, cy, cw, ch, 28, 0.28);
      } else {
        drawPosterPlaceholder(ctx, cx, cy, cw, ch, 28, theme, it.catKey, it.title);
      }

      ctx.save();
      roundRect(ctx, cx, cy, cw, ch, 28);
      ctx.clip();
      const sh = ctx.createLinearGradient(cx, cy + ch * 0.45, cx, cy + ch);
      sh.addColorStop(0, 'rgba(4, 7, 16, 0)');
      sh.addColorStop(1, 'rgba(4, 7, 16, 0.94)');
      ctx.fillStyle = sh;
      ctx.fillRect(cx, cy + ch * 0.45, cw, ch * 0.55);

      ctx.fillStyle = theme.accent;
      ctx.font = `800 26px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(`✦ ${toTrUpper(CATEGORY_CONFIG[it.catKey]?.label || 'GİZLİ CEVHER')} ✦`, cx + 24, cy + ch - 108);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      let titleStr = it.title || '';
      while (ctx.measureText(titleStr).width > cw - 48 && titleStr.length > 5) {
        titleStr = titleStr.slice(0, -4).trim() + '...';
      }
      ctx.fillText(titleStr, cx + 24, cy + ch - 56);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
      ctx.lineWidth = 2.5;
      roundRect(ctx, cx, cy, cw, ch, 28);
      ctx.stroke();

      const scW = 156;
      const scH = 64;
      const scX = cx + cw - scW - 18;
      const scY = cy + 18;
      ctx.fillStyle = 'rgba(8, 13, 25, 0.88)';
      ctx.strokeStyle = `${theme.accent}cc`;
      ctx.lineWidth = 2;
      roundRect(ctx, scX, scY, scW, scH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.font = `800 30px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${it.effScore}`, scX + scW / 2, scY + scH / 2 + 1);
      ctx.restore();
    };

    if (fmtKey === 'story') {
      const cols = 2;
      const gap = 32;
      const cardW = (W - 200 - gap) / cols;
      const cardH = Math.min(1260, (availableH - gap) / 2);
      for (let i = 0; i < count; i++) {
        const c = i % 2;
        const r = Math.floor(i / 2);
        await drawGemCard(gems[i], 100 + c * (cardW + gap), startY + r * (cardH + gap), cardW, cardH);
      }
    } else {
      const cardGap = 30;
      const cardW = (W - 200 - (count - 1) * cardGap) / count;
      const cardH = Math.min(1380, availableH);
      const cy = startY + (availableH - cardH) / 2;
      for (let i = 0; i < count; i++) {
        await drawGemCard(gems[i], 100 + i * (cardW + cardGap), cy, cardW, cardH);
      }
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 7. ŞABLON 3: EN YÜKSEK PUANLILAR VE FAVORİLER
  // --------------------------------------------------------------------------
  async function renderTopPicksTemplate(ctx, W, H, items, theme, fmtKey, catKey, customTitle, customSub) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const catUpper = toTrUpper(CATEGORY_CONFIG[catKey]?.label || 'ARŞİV');
    const topY = fmtKey === 'story' ? 130 : 100;
    const topLabel = (customTitle && customTitle.trim())
      ? `✦ ${toTrUpper(customTitle.trim())} ✦`
      : `✦ TEMPESTIAN ARŞİVİ · ${catUpper} SEÇKİLERİ ✦`;
    drawTopBrandPill(ctx, W, topY, theme, topLabel);

    const titleInfo = drawWrappedTitle(ctx, 'ÖNE ÇIKANLAR · EN YÜKSEK PUANLILAR', W / 2, topY + 132, W - 190, {
      maxFontSize: 72,
      minFontSize: 54,
      color: '#ffffff',
      subtitle: (customSub && customSub.trim()) ? customSub.trim() : 'Arşivin en beğenilen ve başyapıt derecesindeki seçkileri',
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    const scoredItems = items.map(it => ({ ...it, effScore: resolveItemEffectiveScore(it, catKey) }))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.effScore || 0) - (a.effScore || 0));

    const count = fmtKey === 'story' ? 6 : 6;
    const picks = scoredItems.slice(0, count);

    if (!picks.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 44px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Bu kategoride henüz kayıtlı yapım bulunmuyor.', W / 2, H / 2);
      drawFooterSignature(ctx, W, H);
      return;
    }

    const cols = fmtKey === 'story' ? 2 : 3;
    const rows = Math.ceil(picks.length / cols);
    const startY = Math.max(topY + 280, titleInfo.bottomY + 46);
    const bottomPadding = 160;
    const availableH = H - startY - bottomPadding;
    const cardGap = 32;
    const cardW = (W - 200 - (cols - 1) * cardGap) / cols;
    const cardH = Math.min(920, (availableH - (rows - 1) * cardGap) / rows);
    const gridStartY = startY + Math.max(0, (availableH - (rows * cardH + (rows - 1) * cardGap)) / 2);

    for (let i = 0; i < picks.length; i++) {
      const it = picks[i];
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = 100 + c * (cardW + cardGap);
      const y = gridStartY + r * (cardH + cardGap);

      const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
      const img = await loadImageWithTimeout(imgUrl, 2500);

      if (img) {
        drawCoverImage(ctx, img, x, y, cardW, cardH, 26, 0.28);
      } else {
        drawPosterPlaceholder(ctx, x, y, cardW, cardH, 26, theme, catKey, it.title);
      }

      ctx.save();
      roundRect(ctx, x, y, cardW, cardH, 26);
      ctx.clip();

      const shadowGrad = ctx.createLinearGradient(x, y + cardH * 0.45, x, y + cardH);
      shadowGrad.addColorStop(0, 'rgba(4, 7, 16, 0)');
      shadowGrad.addColorStop(1, 'rgba(4, 7, 16, 0.94)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(x, y + cardH * 0.45, cardW, cardH * 0.55);

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 32px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      let titleStr = it.title || '';
      while (ctx.measureText(titleStr).width > cardW - 48 && titleStr.length > 5) {
        titleStr = titleStr.slice(0, -4).trim() + '...';
      }
      ctx.fillText(titleStr, x + 24, y + cardH - 32);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = it.favorite ? `${theme.accent}cc` : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = it.favorite ? 3.5 : 2;
      roundRect(ctx, x, y, cardW, cardH, 26);
      ctx.stroke();

      if (it.effScore || it.favorite) {
        const badgeW = 156;
        const badgeH = 60;
        const badgeX = x + cardW - badgeW - 18;
        const badgeY = y + 18;
        ctx.fillStyle = 'rgba(7, 12, 24, 0.86)';
        ctx.strokeStyle = `${theme.accent}cc`;
        ctx.lineWidth = 2;
        roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.accent;
        ctx.font = `800 30px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ ${it.effScore || 'FAVORİ'}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
      }
      ctx.restore();
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 8. ŞABLON 4: KATMAN SIRALAMASI ÖZETİ
  // --------------------------------------------------------------------------
  async function renderTierCollageTemplate(ctx, W, H, items, theme, fmtKey, catKey, customTitle, customSub) {
    drawRetinaBackground(ctx, W, H, theme, null);

    const catUpper = toTrUpper(CATEGORY_CONFIG[catKey]?.label || 'ARŞİV');
    const topY = fmtKey === 'story' ? 130 : 100;
    const topLabel = (customTitle && customTitle.trim())
      ? `✦ ${toTrUpper(customTitle.trim())} ✦`
      : `✦ TEMPESTIAN ARŞİVİ · ${catUpper} KATMAN LİSTESİ ✦`;
    drawTopBrandPill(ctx, W, topY, theme, topLabel);

    const titleInfo = drawWrappedTitle(ctx, 'KATMAN LİSTESİ · SEVİYE SIRALAMASI', W / 2, topY + 132, W - 190, {
      maxFontSize: 72,
      minFontSize: 54,
      color: '#ffffff',
      subtitle: (customSub && customSub.trim()) ? customSub.trim() : 'S, A+ ve A katmanlarındaki seçkin yapımların görsel vitrini',
      subtitleFontSize: 34,
      subtitleColor: '#cbd5e1'
    });

    const tierGroups = { 'S': [], 'A+': [], 'A': [] };
    const sorted = [...items].sort((a, b) => (resolveItemEffectiveScore(b, catKey) || 0) - (resolveItemEffectiveScore(a, catKey) || 0));
    for (const it of sorted) {
      const sc = resolveItemEffectiveScore(it, catKey);
      if (sc >= 9.5) tierGroups['S'].push(it);
      else if (sc >= 8.5) tierGroups['A+'].push(it);
      else if (sc >= 7.5) tierGroups['A'].push(it);
    }

    const rows = ['S', 'A+', 'A'];
    const tierColors = { 'S': '#fbbf24', 'A+': '#c084fc', 'A': '#38bdf8' };
    const startY = Math.max(topY + 280, titleInfo.bottomY + 46);
    const rowGap = 28;
    const availableH = H - startY - 160;
    const rowH = (availableH - 2 * rowGap) / 3;
    const maxSlots = fmtKey === 'story' ? 3 : 4;

    for (let r = 0; r < rows.length; r++) {
      const tKey = rows[r];
      const list = tierGroups[tKey].slice(0, maxSlots);
      const ry = startY + r * (rowH + rowGap);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.032)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      roundRect(ctx, 100, ry, W - 200, rowH, 26);
      ctx.fill();
      ctx.stroke();

      const badgeW = 164;
      ctx.fillStyle = tierColors[tKey];
      roundRect(ctx, 100, ry, badgeW, rowH, 26);
      ctx.fill();

      ctx.fillStyle = '#060a14';
      ctx.font = `800 66px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tKey, 100 + badgeW / 2, ry + rowH / 2);
      ctx.restore();

      const posterAreaX = 100 + badgeW + 32;
      const posterAreaW = (W - 200) - badgeW - 56;
      const ph = rowH - 36;
      const maxSlotW = (posterAreaW - (maxSlots - 1) * 24) / maxSlots;
      // Doğal 2:3 afiş oranını koruyarak tek öğede yatay esnemeyi önle
      const pw = Math.min(maxSlotW, Math.round(ph * 0.72));

      if (!list.length) {
        ctx.save();
        ctx.fillStyle = '#64748b';
        ctx.font = `600 32px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Bu katmanda henüz değerlendirilmiş yapım bulunmuyor.', posterAreaX + 16, ry + rowH / 2);
        ctx.restore();
        continue;
      }

      for (let p = 0; p < list.length; p++) {
        const it = list[p];
        const px = posterAreaX + p * (pw + 24);
        const py = ry + 18;

        const imgUrl = it.image ? it.image.replace('/cover/medium/', '/cover/large/') : (it.banner || null);
        const img = await loadImageWithTimeout(imgUrl, 2500);

        if (img) {
          drawCoverImage(ctx, img, px, py, pw, ph, 18, 0.28);
        } else {
          drawPosterPlaceholder(ctx, px, py, pw, ph, 18, theme, catKey, it.title);
        }

        ctx.save();
        roundRect(ctx, px, py, pw, ph, 18);
        ctx.clip();
        const sh = ctx.createLinearGradient(px, py + ph * 0.55, px, py + ph);
        sh.addColorStop(0, 'rgba(4,7,16,0)');
        sh.addColorStop(1, 'rgba(4,7,16,0.92)');
        ctx.fillStyle = sh;
        ctx.fillRect(px, py + ph * 0.55, pw, ph * 0.45);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 24px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        let tStr = it.title || '';
        while (ctx.measureText(tStr).width > pw - 28 && tStr.length > 5) {
          tStr = tStr.slice(0, -4).trim() + '...';
        }
        ctx.fillText(tStr, px + 14, py + ph - 20);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2;
        roundRect(ctx, px, py, pw, ph, 18);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawFooterSignature(ctx, W, H);
  }

  // --------------------------------------------------------------------------
  // 9. HAZIR PAYLAŞIM AÇIKLAMASI ÜRETİCİSİ
  // --------------------------------------------------------------------------
  function generateInstagramCaption(templateKey, catKey, item, year) {
    const cfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
    const meta = getCategoryTerminology(catKey, item);
    const effScore = resolveItemEffectiveScore(item, catKey);
    const criteriaList = getCriteriaList(catKey);

    if (templateKey === 'singleReview') {
      const genresStr = getItemGenres(item, catKey, 6).join(', ');

      if (catKey === 'guide') {
        return `✦ TEMPESTIAN REHBER ARŞİVİ ✦\n\n` +
          `🧭 Rehber: ${item?.title || 'Teknik Rehber'}\n` +
          `🏛️ Platform: Technopat Sosyal\n` +
          `📂 Kategori: ${meta.subUnitVal}\n` +
          `🎭 Etiketler: ${genresStr}\n` +
          (item?.summary ? `\n📝 Özet:\n${item.summary}\n` : '') +
          `\n🔗 Rehbere ve tüm teknik yazılara ulaşmak için: tempestian.com/rehber/\n\n` +
          `${cfg.defaultHashtags} #tempestian #inceleme #arsiv`;
      }

      let criteriaLines = '';
      const subScoresToUse = (window.TempestianRating && typeof window.TempestianRating.computeWeightedSubScores === 'function')
        ? (window.TempestianRating.computeWeightedSubScores(catKey, item) || item?.subScores)
        : item?.subScores;
      for (const c of criteriaList) {
        const rawSub = (subScoresToUse && subScoresToUse[c.id] != null && Number(subScoresToUse[c.id]) > 0)
          ? Number(subScoresToUse[c.id])
          : (effScore != null && Number(effScore) > 0 ? Number(effScore) : 8);
        const subVal = Math.max(0.1, Math.min(10, rawSub));
        const starFill = Math.max(0, Math.min(5, Math.round(subVal / 2)));
        const stars = '★'.repeat(starFill) + '☆'.repeat(5 - starFill);
        const tenScore = subVal.toFixed(1);
        criteriaLines += `• ${c.label}: ${stars} (${tenScore}/10)\n`;
      }

      return `✦ TEMPESTIAN ${toTrUpper(cfg.label)} İNCELEMESİ ✦\n\n` +
        `🏷️ Yapım / Eser: ${item?.title || 'Yapım'}\n` +
        `★ Genel Puan: ${effScore !== null ? `${effScore} / 10` : 'Onaylı'}${item?.favorite ? ' (★ Başyapıt)' : ''}\n` +
        `🎭 Türler: ${genresStr}\n` +
        `👤 ${meta.creatorLabel}: ${meta.creatorVal}\n` +
        `📊 ${meta.subUnitLabel}: ${meta.subUnitVal}\n` +
        `🏛️ ${meta.extraLabel}: ${meta.extraVal}\n\n` +
        `📋 KRİTER DEĞERLENDİRMELERİ:\n${criteriaLines}\n` +
        `🔗 Detaylı inceleme dökümü ve tüm arşiv verileri için: tempestian.com\n\n` +
        `${cfg.defaultHashtags} #inceleme #arsiv`;
    }

    if (templateKey === 'wrapped') {
      const yrText = year === 'all' ? 'Tüm Zamanlar' : `${year} Yılı`;
      return `✦ TEMPESTIAN YILLIK ÖZETİ · ${toTrUpper(yrText)} ✦\n\n` +
        `Kişisel medya tüketim ve arşiv yolculuğumun büyük yıllık karnesi!\n\n` +
        `🏆 Zirvedeki başyapıtlar, izlenen bölümler, bitirilen sezonlar ve en sevilen türler tek bir özette bir araya geldi.\n\n` +
        `📊 Tüm arşiv istatistikleri ve kategorik puanlamalar web sitemde yayında:\n` +
        `🔗 tempestian.com/istatistik/\n\n` +
        `#tempestian #yillikozet #ozet #anime #dizi #film #manga #kitap #arsiv`;
    }

    if (templateKey === 'topPicks') {
      return `✦ TEMPESTIAN ${toTrUpper(cfg.label)} SEÇKİLERİ · EN İYİLER ✦\n\n` +
        `Arşivimde en yüksek puanı alan ve başyapıt rozetiyle taçlandırılan seçkin eserler.\n\n` +
        `🔗 Tüm değerlendirmeler ve puan karneleri: tempestian.com\n\n` +
        `${cfg.defaultHashtags} #eniyiler #seckiler #basyapit`;
    }

    return `✦ TEMPESTIAN ${toTrUpper(cfg.label)} KATMAN SIRALAMASI ✦\n\n` +
      `S, A+ ve A seviyesindeki en kaliteli yapımlar bir arada.\n\n` +
      `🔗 Detaylar: tempestian.com\n\n` +
      `${cfg.defaultHashtags} #katmanlistesi #siralamalar`;
  }

  // --------------------------------------------------------------------------
  // 10. ANA STÜDYO SINIFI & ETKİLEŞİM YÖNETİCİSİ
  // --------------------------------------------------------------------------
  class InstagramStudio {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.isRendering = false;
      this.renderQueued = false;
      this.isBatchExporting = false;
      this.isBatchCancelled = false;
      this.cachedData = {};
      this.slides = [];
      this.currentSlideIndex = 0;
      this.allCategoryData = {};
      this._inputTimer = null;
    }

    init() {
      this.canvas = document.getElementById('instaCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      if (window.scrollX > 0) window.scrollTo({ left: 0 });
      const stage = document.getElementById('adminMainStage');
      if (stage && stage.scrollLeft > 0) stage.scrollLeft = 0;

      const renderBtn = document.getElementById('renderInstaBtn');
      const renderBtnSide = document.getElementById('renderInstaBtnSide');
      const downloadBtn = document.getElementById('downloadInstaBtn');
      const downloadZipBtn = document.getElementById('downloadZipInstaBtn');
      const copyCaptionBtn = document.getElementById('copyInstaCaptionBtn');
      const downloadAllWatchedAnimeZipBtn = document.getElementById('downloadAllWatchedAnimeZipBtn');

      const catSelect = document.getElementById('instaCategorySelect');
      const fmtSelect = document.getElementById('instaFormatSelect');
      const tplSelect = document.getElementById('instaTemplateSelect');
      const thmSelect = document.getElementById('instaThemeSelect');
      const itemSelect = document.getElementById('instaItemSelect');
      const partModeSelect = document.getElementById('instaPartModeSelect');
      const wrappedYear = document.getElementById('instaWrappedYear');
      const slideSelect = document.getElementById('instaSlideSelect');
      const titleInput = document.getElementById('instaTitleInput');
      const subInput = document.getElementById('instaSubInput');

      if (renderBtn) renderBtn.onclick = () => this.render();
      if (renderBtnSide) renderBtnSide.onclick = () => this.render();
      if (downloadBtn) downloadBtn.onclick = () => this.downloadActiveSlide();
      if (downloadZipBtn) downloadZipBtn.onclick = () => this.downloadAllZip();
      if (copyCaptionBtn) copyCaptionBtn.onclick = () => this.copyCaption();
      if (downloadAllWatchedAnimeZipBtn) downloadAllWatchedAnimeZipBtn.onclick = () => this.openBatchExportModal();

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
        this.currentSlideIndex = 0;
        this.updateControlVisibility();
        this.updateDefaultTitles();
        this.populateItems().then(() => this.render());
      };

      if (catSelect) catSelect.onchange = () => {
        this.currentSlideIndex = 0;
        this.updateDefaultTitles();
        this.populateItems().then(() => this.render());
      };

      if (itemSelect) itemSelect.onchange = () => {
        this.currentSlideIndex = 0;
        this.updatePartModeVisibility();
        this.render();
      };

      if (partModeSelect) partModeSelect.onchange = () => {
        this.currentSlideIndex = 0;
        this.render();
      };
      if (wrappedYear) wrappedYear.onchange = () => this.render();
      if (fmtSelect) fmtSelect.onchange = () => this.render();
      if (thmSelect) thmSelect.onchange = () => this.render();

      const scheduleInputRender = () => {
        clearTimeout(this._inputTimer);
        this._inputTimer = setTimeout(() => this.render(), 240);
      };
      if (titleInput) titleInput.oninput = scheduleInputRender;
      if (subInput) subInput.oninput = scheduleInputRender;

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
      const catKey = catSelect?.value || 'anime';
      const catMeta = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.anime;
      const catUpper = toTrUpper(catMeta.label);

      if (titleInp) {
        if (tpl === 'singleReview') {
          titleInp.value = `${catUpper} İNCELEMESİ`;
          if (subInp) subInp.value = 'Kişisel Medya Arşivim ve Değerlendirmelerim · tempestian.com';
        } else if (tpl === 'wrapped') {
          titleInp.value = 'TEMPESTIAN YILLIK ÖZETİ';
          if (subInp) subInp.value = 'Büyük Yıllık Medya ve Arşiv Özeti · tempestian.com';
        } else if (tpl === 'topPicks') {
          titleInp.value = `TEMPESTIAN · ${catUpper} SEÇKİLERİ`;
          if (subInp) subInp.value = 'En Yüksek Puanlı Başyapıtlar ve Favorilerim';
        } else {
          titleInp.value = `TEMPESTIAN · ${catUpper} KATMAN LİSTESİ`;
          if (subInp) subInp.value = 'S, A+ ve A Seviyesi Seçkin Yapımlar';
        }
      }

      const allWatchedBtn = document.getElementById('downloadAllWatchedAnimeZipBtn');
      if (allWatchedBtn) {
        const verb = (catKey === 'book' || catKey === 'manga') ? 'Okunan' : (catKey === 'guide' ? 'Yayınlanan' : 'İzlenen');
        const pluralMap = {
          anime: 'Animeleri',
          series: 'Dizileri',
          movie: 'Filmleri',
          manga: 'Mangaları',
          book: 'Kitapları',
          guide: 'Rehberleri'
        };
        allWatchedBtn.textContent = `📦 Tüm ${verb} ${pluralMap[catKey] || `${catMeta.label}leri`} ZIP İndir`;
      }
    }

    async loadCategoryData(catKey) {
      if (typeof window.getAdminCategoryData === 'function') {
        const live = window.getAdminCategoryData(catKey);
        if (live && Array.isArray(live.items) && live.items.length) {
          this.cachedData[catKey] = live;
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

      console.warn(`[SosyalMedyaStüdyosu]: ${catKey} verisi çekilemedi.`);
      return { items: [], stats: {} };
    }

    async loadAllCategories() {
      for (const ck of Object.keys(CATEGORY_CONFIG)) {
        this.allCategoryData[ck] = await this.loadCategoryData(ck);
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
        opt.textContent = 'Bu kategoride kayıtlı yapım yok';
        itemSelect.appendChild(opt);
        return;
      }

      const sorted = [...items].sort((a, b) => {
        const sa = resolveItemEffectiveScore(a, catKey) || 0;
        const sb = resolveItemEffectiveScore(b, catKey) || 0;
        return sb - sa || (a.title || '').localeCompare(b.title || '', 'tr');
      });

      for (const it of sorted) {
        const opt = document.createElement('option');
        opt.value = String(it.id ?? it.anilistId ?? it.title);
        const sc = resolveItemEffectiveScore(it, catKey);
        const scBadge = sc !== null ? ` [★ ${sc}]` : '';
        const favBadge = it.favorite ? ' · Favori' : '';
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

      let items = null;
      if (typeof window.getAdminCategoryData === 'function') {
        const live = window.getAdminCategoryData(catKey);
        if (live && Array.isArray(live.items) && live.items.length) items = live.items;
      }
      if (!items) items = this.cachedData[catKey]?.items;
      if (!items || !items.length) return null;
      if (!targetVal) return items[0];
      return items.find(it => String(it.id ?? it.anilistId ?? it.title) === String(targetVal)) || items[0] || null;
    }

    async render() {
      if (this.isRendering) {
        this.renderQueued = true;
        return;
      }
      this.isRendering = true;
      this.renderQueued = false;

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

      const resBadge = document.getElementById('instaResolutionBadge');
      if (resBadge) resBadge.textContent = `${fmt.width} × ${fmt.height} · 2x PNG`;

      this.canvas.width = fmt.width;
      this.canvas.height = fmt.height;
      const ctx = this.ctx;
      const W = fmt.width;
      const H = fmt.height;

      this.slides = [];

      if (tplKey === 'singleReview') {
        const item = this.getSelectedItem();
        const hasParts = item && Array.isArray(item.parts) && item.parts.length > 1;

        if (hasParts && partMode === 'compact') {
          this.slides.push({
            id: 'slide-compact',
            name: '01-kompakt-karne.png',
            shortLabel: 'Kompakt Karne',
            title: 'Tek Kare · Kompakt Karne',
            render: async () => renderSingleReviewCompactSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub)
          });
        } else if (hasParts && partMode === 'carousel') {
          this.slides.push({
            id: 'slide-cover',
            name: '01-ana-kapak.png',
            shortLabel: 'Ana Kapak',
            title: 'Ana Kapak ve Özet',
            render: async () => renderSingleReviewCoverSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub)
          });
          for (let pIdx = 0; pIdx < item.parts.length; pIdx++) {
            const p = item.parts[pIdx];
            const pNum = String(pIdx + 2).padStart(2, '0');
            const pName = p.name || `${pIdx + 1}. Sezon`;
            const pShort = formatPartShortLabel(item?.title, pName, pIdx);
            this.slides.push({
              id: `slide-part-${pIdx}`,
              name: `${pNum}-sezon-${pIdx + 1}.png`,
              shortLabel: pShort,
              title: pShort,
              render: async () => renderSingleReviewPartSlide(ctx, W, H, item, p, pIdx, item.parts.length, catKey, theme, fmtKey)
            });
          }
        } else {
          this.slides.push({
            id: 'slide-single',
            name: '01-inceleme.png',
            shortLabel: 'İnceleme Kartı',
            title: 'Tekil İnceleme Kartı',
            render: async () => renderSingleReviewCoverSlide(ctx, W, H, item, catKey, theme, fmtKey, customTitle, customSub)
          });
        }
      } else if (tplKey === 'wrapped') {
        const allData = await this.loadAllCategories();
        this.slides = [
          {
            id: 'wrapped-1',
            name: '01-zirvedekiler.png',
            shortLabel: 'Zirvedekiler',
            title: 'Zirvedekiler · Yılın En İyileri',
            render: async () => renderWrappedChampionsSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey, customTitle, customSub)
          },
          {
            id: 'wrapped-2',
            name: '02-rakamlarla-arsiv.png',
            shortLabel: 'Rakamlar',
            title: 'Rakamlarla Arşiv Bilançosu',
            render: async () => renderWrappedNumbersSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey, customTitle, customSub)
          },
          {
            id: 'wrapped-3',
            name: '03-begeni-profili.png',
            shortLabel: 'Tür Profili',
            title: 'Beğeni Profili ve Türler',
            render: async () => renderWrappedTasteSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey, customTitle, customSub)
          },
          {
            id: 'wrapped-4',
            name: '04-gizli-cevherler.png',
            shortLabel: 'Gizli Cevherler',
            title: 'Gizli Cevherler',
            render: async () => renderWrappedHiddenGemsSlide(ctx, W, H, allData, wrappedYear, theme, fmtKey, customTitle, customSub)
          }
        ];
      } else if (tplKey === 'topPicks') {
        const { items } = await this.loadCategoryData(catKey);
        this.slides.push({
          id: 'slide-topPicks',
          name: '01-en-iyiler.png',
          shortLabel: 'En İyiler',
          title: 'Öne Çıkanlar · En Yüksek Puanlılar',
          render: async () => renderTopPicksTemplate(ctx, W, H, items, theme, fmtKey, catKey, customTitle, customSub)
        });
      } else {
        const { items } = await this.loadCategoryData(catKey);
        this.slides.push({
          id: 'slide-tierCollage',
          name: '01-katman-listesi.png',
          shortLabel: 'Katman Listesi',
          title: 'Katman Listesi Sıralaması',
          render: async () => renderTierCollageTemplate(ctx, W, H, items, theme, fmtKey, catKey, customTitle, customSub)
        });
      }

      if (this.currentSlideIndex >= this.slides.length) this.currentSlideIndex = 0;
      this.updateSlideSelectorUI();
      await this.renderCurrentSlideOnly();

      const captionText = generateInstagramCaption(tplKey, catKey, this.getSelectedItem(), wrappedYear);
      const capArea = document.getElementById('instaCaptionText');
      if (capArea) capArea.value = captionText;

      this.isRendering = false;
      if (this.renderQueued) {
        this.renderQueued = false;
        this.render();
      }
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
          indicator.textContent = `🎞️ Slayt ${this.currentSlideIndex + 1} / ${total} · ${activeSlide.title}`;
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
          opt.textContent = `${idx + 1}. ${s.title}`;
          if (idx === this.currentSlideIndex) opt.selected = true;
          slideSelect.appendChild(opt);
        });
      }

      if (slideRow) slideRow.hidden = !isMulti;
      if (zipBtnTop) zipBtnTop.hidden = !isMulti;

      if (navEl) {
        if (!isMulti) {
          navEl.classList.add('is-single');
          if (navHeader) navHeader.textContent = 'Tek Kare Gönderi (1 Slayt)';
          if (stripWrap) stripWrap.hidden = true;
          if (navZipBtn) navZipBtn.hidden = true;
          if (navSlideBtn) navSlideBtn.textContent = '💾 PNG İndir';
          if (pillsContainer) pillsContainer.innerHTML = '';
        } else {
          navEl.classList.remove('is-single');
          if (navHeader) {
            navHeader.textContent = `Çoklu Slayt Şeridi (Toplam ${total} Gönderi)`;
          }
          if (stripWrap) stripWrap.hidden = false;
          if (navZipBtn) {
            navZipBtn.hidden = false;
            navZipBtn.textContent = `📦 Tüm ${total} Slaytı ZIP İndir`;
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
      const slideSuffix = this.slides.length > 1 ? `-slayt${this.currentSlideIndex + 1}` : '';
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `tempestian-${tplKey}-${catKey}-${fmtKey}${slideSuffix}-${dateStr}.png`;

      try {
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
            window.toast('✓ 2160p yüksek çözünürlüklü PNG görseli indirildi!', 'ok');
          }
        }, 'image/png');
      } catch (err) {
        console.error('[SosyalMedyaStüdyosu]: PNG dışa aktarma hatası:', err);
        if (window.toast) window.toast('Görsel dışa aktarılırken bir hata oluştu.', 'err');
      }
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
      const pluralMap = {
        anime: 'Animeler',
        series: 'Diziler',
        movie: 'Filmler',
        manga: 'Mangalar',
        book: 'Kitaplar',
        guide: 'Rehberler'
      };
      const pluralLowerMap = {
        anime: 'animeler',
        series: 'diziler',
        movie: 'filmler',
        manga: 'mangalar',
        book: 'kitaplar',
        guide: 'rehberler'
      };

      overlay.innerHTML = `
        <div class="batch-export-modal glass sq" role="dialog" aria-modal="true" aria-labelledby="batchModalTitle">
          <div id="batchExportConfigView">
            <div class="batch-export-head">
              <div class="batch-head-icon">📦</div>
              <div class="batch-head-info">
                <h3 id="batchModalTitle">Tüm ${verb} ${pluralMap[catKey] || catMeta.label} · Toplu Sosyal Medya Arşivi</h3>
                <p>Arşivinizdeki ${verb.toLowerCase()} ${pluralLowerMap[catKey] || catMeta.label.toLowerCase()} için 2160p kalitesinde sosyal medya görselleri üretilip tek bir ZIP arşivinde toplanır.</p>
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
                <span>📱 Paylaşım Formatı (2160p)</span>
                <select id="batchFormatSelect" class="inp glass">
                  <option value="square" ${curFmt === 'square' ? 'selected' : ''}>🖼️ Kare Gönderi (1:1 · 2160×2160)</option>
                  <option value="portrait" ${curFmt === 'portrait' ? 'selected' : ''}>📐 Dikey Gönderi (4:5 · 2160×2700)</option>
                  <option value="story" ${curFmt === 'story' ? 'selected' : ''}>📱 Hikâye Formatı (9:16 · 2160×3840)</option>
                </select>
              </label>

              <label class="field">
                <span>✨ Vurgu Rengi Teması</span>
                <select id="batchThemeSelect" class="inp glass">
                  <option value="neonBlue" ${curThm === 'neonBlue' ? 'selected' : ''}>⚡ Neon Mavi</option>
                  <option value="cyan" ${curThm === 'cyan' ? 'selected' : ''}>💎 Sibernetik Turkuaz</option>
                  <option value="gold" ${curThm === 'gold' ? 'selected' : ''}>🌟 Altın ve Kehribar</option>
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
                  <option value="carousel" ${curPartMode === 'carousel' ? 'selected' : ''}>📑 Tam Karusel Seti (Sezon Slaytları Dahil)</option>
                </select>
              </label>
            </div>

            <div class="batch-extra-options">
              <label class="batch-checkbox">
                <input type="checkbox" id="batchIncludeCaptions" checked>
                <span>📝 Hazır Paylaşım Açıklamalarını ZIP'e ekle (<code>Paylasim-Aciklamalari.txt</code>)</span>
              </label>
              <label class="batch-checkbox">
                <input type="checkbox" id="batchIncludeReadme" checked>
                <span>ℹ️ Arşiv Bilgi Dosyası ekle (<code>BENIOKU.txt</code>)</span>
              </label>
            </div>

            <div class="batch-actions">
              <button type="button" class="btn-subtle" id="batchCancelBtn">Vazgeç</button>
              <button type="button" class="btn-primary batch-start-btn" id="batchStartBtn">🚀 Tek Tıkla ZIP Olarak İndir</button>
            </div>
          </div>

          <div id="batchExportProgressView" hidden>
            <div class="batch-export-head">
              <div class="batch-head-icon rotating-icon">⚙️</div>
              <div class="batch-head-info">
                <h3 id="batchProgressHeading">Görseller Üretiliyor ve Paketleniyor...</h3>
                <p id="batchProgressSub">Lütfen bekleyin, afişler taranıyor ve 2160p yüksek çözünürlüklü görseller çiziliyor.</p>
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

          <div id="batchExportSuccessView" hidden>
            <div class="batch-success-box">
              <div class="batch-success-icon">🎉</div>
              <h3>ZIP Arşivi Başarıyla İndirildi!</h3>
              <p id="batchSuccessSummary">Tüm sosyal medya görselleri tek bir ZIP paketi olarak indirildi.</p>
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

      if (titleEl) titleEl.textContent = `${catMeta.label} verileri taranıyor...`;
      const { items } = await this.loadCategoryData(catKey);

      let targetItems = items || [];
      if (scope === 'completed' && catKey !== 'guide') {
        targetItems = targetItems.filter(it => (it.status || '').toLowerCase() === 'completed');
      }

      targetItems.sort((a, b) => {
        const sa = resolveItemEffectiveScore(a, catKey) || 0;
        const sb = resolveItemEffectiveScore(b, catKey) || 0;
        return sb - sa || (a.title || '').localeCompare(b.title || '', 'tr');
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

      if (headingEl) headingEl.textContent = 'Afişler Önbelleğe Alınıyor...';
      if (subEl) subEl.textContent = `2160p çizimi öncesi ${totalItems} afiş görseli hazırlanıyor.`;

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

      if (headingEl) headingEl.textContent = 'Görseller 2160p Kalitesinde Çiziliyor...';
      if (subEl) subEl.textContent = 'Her yapım için kart oluşturulup PNG olarak paketleniyor.';

      const W = fmt.width;
      const H = fmt.height;
      this.canvas.width = W;
      this.canvas.height = H;
      const ctx = this.ctx;

      const files = [];
      const captions = [];

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
            await renderSingleReviewCompactSlide(ctx, W, H, it, catKey, theme, fmtKey, null, null);
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
          if (hasParts) {
            const folder = `${padIdx}. ${cleanTitle} ${scoreStr}`.replace(/\s+/g, ' ').trim();
            await renderSingleReviewCoverSlide(ctx, W, H, it, catKey, theme, fmtKey, null, null);
            const coverBlob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
            if (coverBlob) files.push({ name: `${folder}/01-ana-kapak.png`, blob: coverBlob });

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

        await new Promise(r => setTimeout(r, 10));
      }

      if (this.isBatchCancelled) {
        this.cleanupBatch();
        return;
      }

      if (barEl) barEl.style.width = '92%';
      if (pctEl) pctEl.textContent = '92%';
      if (titleEl) titleEl.textContent = 'Açıklamalar ve bilgi dosyaları hazırlanıyor...';

      const dateStr = new Date().toISOString().slice(0, 10);

      if (includeCaptions && captions.length) {
        const fullCaption = `======================================================================\n` +
          `TEMPESTIAN · ${toTrUpper(catMeta.label)} SOSYAL MEDYA PAYLAŞIM AÇIKLAMALARI\n` +
          `Paket Tarihi: ${dateStr}\n` +
          `Toplam İçerik: ${totalItems} ${catMeta.label}\n` +
          `Site: https://tempestian.com/\n` +
          `======================================================================\n\n` +
          captions.join('');
        files.push({
          name: 'Paylasim-Aciklamalari.txt',
          blob: new Blob([fullCaption], { type: 'text/plain;charset=utf-8' })
        });
      }

      if (includeReadme) {
        const verbName = (catKey === 'book' || catKey === 'manga') ? 'Okunan' : (catKey === 'guide' ? 'Yayınlanan' : 'İzlenen');
        const readme = `======================================================================\n` +
          `TEMPESTIAN · ${toTrUpper(catMeta.label)} ARŞİVİ SOSYAL MEDYA GÖNDERİLERİ\n` +
          `======================================================================\n\n` +
          `Arşiv Sahibi: Bayram Tempestian\n` +
          `Paket Tarihi: ${dateStr}\n` +
          `Toplam İçerik: ${totalItems} ${catMeta.label} (${verbName})\n` +
          `Çözünürlük: ${fmt.label}\n` +
          `Görsel Tema: ${theme.name}\n` +
          `Paylaşım Düzeni: ${partMode === 'compact' ? 'Tek Kare Özet (Kompakt Karne)' : (partMode === 'cover' ? 'Yalnızca Ana Kapak' : 'Tam Karusel Seti')}\n` +
          `Arşiv Web Sitesi: https://tempestian.com/\n\n` +
          `Tüm görseller 2160p yüksek çözünürlükte sosyal medya paylaşımları için üretilmiştir.\n`;
        files.push({
          name: 'BENIOKU.txt',
          blob: new Blob([readme], { type: 'text/plain;charset=utf-8' })
        });
      }

      if (headingEl) headingEl.textContent = 'ZIP Paketi Oluşturuluyor...';
      if (subEl) subEl.textContent = `${files.length} dosya tek bir ZIP arşivinde birleştiriliyor...`;
      if (barEl) barEl.style.width = '96%';
      if (pctEl) pctEl.textContent = '96%';
      if (titleEl) titleEl.textContent = 'Arşiv dosyası yazılıyor...';

      await new Promise(r => setTimeout(r, 20));
      const zipBlob = await createZipBlob(files);

      if (barEl) barEl.style.width = '100%';
      if (pctEl) pctEl.textContent = '100%';
      if (titleEl) titleEl.textContent = 'İndirme başlatılıyor...';

      const scopeTag = scope === 'completed' ? 'tamamlanan' : 'tum';
      const zipName = `tempestian-${catKey}-${scopeTag}-${fmtKey}-${dateStr}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);

      if (progressView) progressView.hidden = true;
      if (successView) {
        successView.hidden = false;
        const sumEl = document.getElementById('batchSuccessSummary');
        if (sumEl) {
          sumEl.textContent = `Toplam ${totalItems} ${catMeta.label.toLowerCase()} için üretilen ${files.length} dosya "${zipName}" olarak başarıyla indirildi.`;
        }
      }

      if (window.toast) {
        window.toast(`✓ ${totalItems} yapımın sosyal medya görseli ZIP olarak indirildi!`, 'ok');
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
          if (window.toast) window.toast('📋 Paylaşım açıklaması panoya kopyalandı!', 'ok');
        });
      } else {
        capArea.select();
        document.execCommand('copy');
        if (window.toast) window.toast('📋 Paylaşım açıklaması kopyalandı!', 'ok');
      }
    }
  }

  window.AdminInstagram = new InstagramStudio();
})();
