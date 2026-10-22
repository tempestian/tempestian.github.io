// ============================================================================
// [AI-MIMARI-NOTU: TEMPESTIAN YÖNETİM PANELİ VE GENİŞLETİLEBİLİR İÇERİK MOTORU]
// Bu dosya Adım 1, 2, 3, 4, 5, 6, 7 ve 8 kapsamında şu modülleri yönetir:
// - Adım 1: Sıfır Açık QR (Zero-Public-QR), GitHub API sahiplik doğrulaması,
//           Google Authenticator (RFC 6238 TOTP) ve AES-256-GCM mühürlü kasa.
// - Adım 2: Site metinleri, görselleri, kategorileri (`sections`), sürpriz kutucuğu (`gift`),
//           özel bilgi/duyuru kutucukları (`boxes`) ve dış bağlantıların (`links`) yönetimi.
// - Adım 3 & 4: Anime verilerinin (`data/anime.json`) arayüzden düzenlenmesi, AniList haricinde
//           elle yeni anime ve sezon/film/ek içerik (`parts`) eklenmesi, mevcut AniList
//           kayıtlarının düzenlenmesi, `data/overrides.json` kurallarının yönetimi ve
//           admin düzenlemelerinin (`adminModified`, `lockedFields`) korunması.
// - Adım 5 & 6: Her anime için Yeni Anime Ekleme ve Anime Düzenleme menülerinde
//           "İlk Sezonun AniList Linki (URL)" (`firstSeasonUrl`) alanının sunulması,
//           bu link üzerinden sezon, film ve yan içeriklerin (`PREQUEL`, `SEQUEL`,
//           `SIDE_STORY`, `PARENT`, `SUMMARY`, `SPIN_OFF`) hem tekil hem de mevcut tüm
//           animeler için toplu sorgulanıp site verilerine çekilmesi.
// - Adım 14 (VERİ SAĞLIĞI DENETÇİSİ VE TAM YEDEKLEME / GERİ YÜKLEME MERKEZİ):
//   * Tüm medya bölümlerinde kategorisi eksik, puanı eksik, kapak URL'si eksik,
//     kaynak linki eksik veya yeni sezonu çıkmış yapımları tek ekranda raporlar
//     ve tek tıkla ⚡ Hızlı Sıralı Düzenleme kuyruğuna gönderir.
//   * Tüm site JSON dosyalarını (`sections`, `anime`, `overrides`, `series`, `movies`,
//     `manga`, `books`, `guides`) tek bir tarihli pakette indirir ve geri yükler.
// - Adım 15 (TECHNOPAT SOSYAL YÖNLENDİRMELİ REHBER KATALOĞU `/rehber/`):
//   * Rehberleri sitede makale olarak tutmak yerine başlık, özet, kategori ve
//     Technopat Sosyal konu linkiyle (`url`) katalog olarak yönetir.
// - Adım 10 (ANILIST PROFİLİNDEN KOPUŞ & SIFIR-DEPOLAMA UZAKTAN KAPAK/VERİ ÇEKİCİ):
//   * GitHub Pages depolama sınırını korumak için kapak görselleri repoya indirilmez;
//     dış katalogların (AniList, IMDb/TVMaze, OpenLibrary) CDN URL'leri kullanılır.
//   * `ExternalCatalogFetcher` modülü; Anime ve Manga için AniList GraphQL'den,
//     Dizi ve Film için IMDb linki/ID'si (`tt...`) üzerinden, Kitap için OpenLibrary'den
//     yalnızca kapak URL'si, çıkış yılı ve sezon/bölüm/cilt/sayfa yapısını çeker;
//     genel global puanları ASLA çekmez (puanlar %100 kullanıcının kendi puanlarıdır).
// - Adım 11 (FAVORİLER / BAŞYAPITLAR VİTRİNİ — `favorite: true`):
//   * Hem liste satırlarında hem düzenleme modalında hem de Hızlı Sıralı Düzenleme
//     kuyruğunda tek tıkla "★ Başyapıt / Favori" işaretleme ve filtreleme.
// - Adım 9 (EVRENSEL HIZLI SIRALI TOPLU DÜZENLEME MİMARİSİ — ContentAdapterRegistry & UniversalRapidQueue):
//   * Bu mimari SADECE Anime için değil; ileride eklenecek Manga, Kitap, Dizi, Film ve Rehber
//     bölümleri için ortak bir Adaptör Deseni (Adapter Pattern) üzerine kurulmuştur.
//   * Başka bir yapay zeka ileride yeni bir bölüm (ör. `manga`, `book`, `series`, `movie`, `guide`)
//     eklediğinde sıfırdan hızlı düzenleme arayüzü YAZMAMALIDIR; yalnızca `CONTENT_ADAPTER_REGISTRY`
//     içindeki ilgili adaptörün `dataFile` ve `subItemWeights` ayarlarını kullanması yeterlidir.
// - Adım 7 & 8:
//   * Ağırlıklı Otomatik Puanlama: Her zaman sezonlara, filmlere ve yan içeriklere verilen
//     puanlar (`parts[].score`) animenin genel puanını otomatik belirler:
//     - Sezon (`kind === 'season'`): Ağırlık = 1.00 (%100 etki)
//     - Film (`kind === 'movie'`):   Ağırlık = 0.35 (%35 etki)
//     - Yan İçerik / OVA (`other`):  Ağırlık = 0.15 (%15 etki)
//   * Tür / Kategori Özelleştirmesi (`customGenres`): İstatistiklerde ve filtrelerde
//     yalnızca adminin elle seçtiği özel kategoriler (Shounen, Seinen, Isekai, Rom-Com vb.)
//     yer alır (`genreSourceRule: 'custom_only'`).
//   * İzlenen Anime & Bölüm Sayısı: En az 1 sezon veya film bitince izlenen anime sayısına
//     dahil edilir (`completed_season_or_movie`); yeni bölüm izledikçe (`+1 Bölüm`)
//     toplam izlenen bölüm sayısına anında yansır (`includeInProgressEpisodes: true`).
// ============================================================================
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const root = document.body.dataset.root || '../';

  const DEFAULT_CONFIG = {
    schemaVersion: 2,
    site: {
      title: 'Tempestian',
      subtitle: 'Bayram',
      barTitle: 'Tempestian',
      description: "Bayram Tempestian'ın kişisel sitesi.",
      homeLabel: 'Ana sayfa',
      logo: 'assets/img/logo.png',
      favicon32: 'assets/img/favicon-32.png',
      icon192: 'assets/img/icon-192.png',
      appleTouchIcon: 'assets/img/apple-touch-icon.png'
    },
    gift: {
      enabled: true,
      ariaLabel: 'Sürpriz',
      openLabel: 'Sürprizi aç',
      closeLabel: 'Sürprizi kapat',
      leadText: 'Hediyenin açılmasına kalan süre',
      targetDate: '2026-10-27T00:00:00+03:00',
      dateLabel: '27 Ekim 2026 · 00.00 (TSİ)',
      expiredLeadText: 'Hediyenin açılma zamanı geldi',
      expiredSubText: 'Az sonra burada olacak.',
      expiredUrl: '',
      units: { d: 'Gün', h: 'Saat', m: 'Dakika', s: 'Saniye' }
    },
    boxes: [],
    sections: [
      {
        id: 'anime',
        title: 'Anime',
        path: 'anime/',
        description: 'İzlediğim animeler',
        data: 'data/anime.json',
        countKey: 'anime',
        unit: 'anime',
        status: 'active',
        icon: 'anime',
        showStrip: true
      }
    ],
    links: [
      { id: 'lnk-technopat', title: 'Technopat Sosyal', url: 'https://www.technopat.net/sosyal/uye/bayram-tempestian.657641/', enabled: true },
      { id: 'lnk-github', title: 'GitHub', url: 'https://github.com/tempestian', enabled: true },
      { id: 'lnk-anilist', title: 'AniList', url: 'https://anilist.co/user/TurkTempestian', enabled: true }
    ],
    pages: {
      anime: {
        title: 'Anime',
        metaTitle: 'Anime · Tempestian',
        description: "Tempestian'ın izlediği animeler: puanlar, sezonlar ve izleme durumu.",
        searchPlaceholder: 'Ara',
        emptyText: 'Eşleşen anime yok.',
        footerText: "AniList'ten günde bir güncellenir. Kapaklar sahiplerine aittir.",
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        anilistButtonText: "AniList'te aç"
      }
    }
  };

  const SECTION_TEMPLATES = {
    manga: { id: 'manga', title: 'Manga', path: 'manga/', description: 'Yakında', data: 'data/manga.json', countKey: 'manga', unit: 'manga', status: 'soon', icon: 'manga', showStrip: true },
    book: { id: 'book', title: 'Kitap', path: 'kitap/', description: 'Yakında', data: 'data/books.json', countKey: 'books', unit: 'kitap', status: 'soon', icon: 'book', showStrip: true },
    series: { id: 'series', title: 'Dizi', path: 'dizi/', description: 'Yakında', data: 'data/series.json', countKey: 'series', unit: 'dizi', status: 'soon', icon: 'series', showStrip: true },
    movie: { id: 'movie', title: 'Film', path: 'film/', description: 'Yakında', data: 'data/movies.json', countKey: 'movies', unit: 'film', status: 'soon', icon: 'movie', showStrip: true },
    guide: { id: 'guide', title: 'Rehber', path: 'rehber/', description: 'Yakında', data: 'data/guides.json', countKey: 'guides', unit: 'rehber', status: 'soon', icon: 'guide', showStrip: false }
  };

  const IMAGE_SLOTS = [
    { key: 'logo', label: 'Ana Sayfa Logo / İşaret', defaultPath: 'assets/img/logo.png', desc: 'Ana sayfada başlığın üstünde görünen 64×64 simge.' },
    { key: 'favicon32', label: 'Favicon (32×32)', defaultPath: 'assets/img/favicon-32.png', desc: 'Tarayıcı sekme ikonu (PNG).' },
    { key: 'icon192', label: 'Uygulama İkonu (192×192)', defaultPath: 'assets/img/icon-192.png', desc: 'Mobil ve PWA kısayol ikonu.' },
    { key: 'appleTouchIcon', label: 'Apple Touch İkonu', defaultPath: 'assets/img/apple-touch-icon.png', desc: 'iOS ana ekrana ekleme ikonu.' }
  ];

  const CURATED_GENRE_GROUPS = [
    {
      label: 'Demografi & Hedef Kitle',
      items: ['Shounen', 'Seinen', 'Shoujo', 'Josei']
    },
    {
      label: 'Özel Alt Türler & Temalar',
      items: [
        'Isekai', 'Rom-Com', 'Reenkarnasyon', 'Karanlık Fantezi', 'Siberpunk',
        'Post-Apokaliptik', 'Zaman Yolculuğu', 'Oyun / VR', 'Süper Güç', 'Askeri',
        'Dedektiflik', 'Okul', 'Tarihi', 'Büyülü Kız', 'Harem', 'Parodi', 'Yemek / Gurme'
      ]
    },
    {
      label: 'Temel Türler',
      items: [
        'Aksiyon', 'Macera', 'Fantastik', 'Komedi', 'Dram', 'Romantik',
        'Psikolojik', 'Bilim Kurgu', 'Gizem', 'Gerilim', 'Doğaüstü',
        'Slice of Life', 'Spor', 'Mecha', 'Müzik', 'Korku', 'Ecchi'
      ]
    }
  ];

  const QUICK_SCORES = [null, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

  const STATUS_LABELS = {
    watching: 'İzleniyor',
    completed: 'İzlendi',
    paused: 'Beklemede',
    dropped: 'Bırakıldı',
    planned: 'Planlandı'
  };

  // [AI-MIMARI-NOTU]: Kullanıcının Adım 8'de onayladığı kesin istatistik kuralları:
  const DEFAULT_STATS_CONFIG = {
    animeCountRule: 'completed_season_or_movie',
    includeInProgressEpisodes: true,
    genreSourceRule: 'custom_only'
  };

  const PART_SCORE_WEIGHTS = {
    season: 1.0,
    movie: 0.35,
    other: 0.15
  };

  function getPartWeight(part) {
    if (!part || typeof part !== 'object') return PART_SCORE_WEIGHTS.other;
    if (part.kind === 'movie' || part.format === 'MOVIE') return PART_SCORE_WEIGHTS.movie;
    if (part.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(part.format)) return PART_SCORE_WEIGHTS.other;
    return PART_SCORE_WEIGHTS.season;
  }

  function parseAnilistUrlOrId(input) {
    if (input == null || input === '') return { id: null, url: '' };
    if (typeof input === 'number' && Number.isInteger(input) && input > 0) {
      return { id: input, url: 'https://anilist.co/anime/' + input };
    }
    const raw = String(input).trim();
    const m = raw.match(/anilist\.co\/anime\/(\d+)/i);
    if (m) {
      const id = Number(m[1]);
      return { id, url: 'https://anilist.co/anime/' + id };
    }
    const al = raw.match(/^al-(\d+)$/i);
    if (al) {
      const id = Number(al[1]);
      return { id, url: 'https://anilist.co/anime/' + id };
    }
    if (/^\d+$/.test(raw) && Number(raw) > 0) {
      const id = Number(raw);
      return { id, url: 'https://anilist.co/anime/' + id };
    }
    return { id: null, url: '' };
  }

  const state = {
    config: structuredClone(DEFAULT_CONFIG),
    animeData: {
      schemaVersion: 3,
      updated: '',
      source: 'hybrid:TurkTempestian',
      statsConfig: structuredClone(DEFAULT_STATS_CONFIG),
      customGenreCatalog: [],
      stats: {},
      anime: []
    },
    overrides: { exclude: [], titles: {}, merge: {}, noContinue: [], deletedIds: [] },
    dirtyConfig: false,
    dirtyAnime: false,
    dirtyOverrides: false,
    setupSecret: '',
    verifiedSetupContext: null,
    remoteVault: null,
    importedVault: null,
    pendingUploads: new Map(),
    animeFilterQ: '',
    animeFilterStatus: 'all',
    animeFilterSource: 'all',
    activeAdminMediaType: 'anime',
    editingAnimeId: null,
    editingDraft: null,
    multiMediaStore: {},
    rapidQueue: {
      activeType: 'anime',
      filterMode: 'uncategorized',
      queueIds: [],
      currentIndex: 0,
      draftItem: null,
      editedInSession: new Set()
    }
  };

  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 7 & 8 — AĞIRLIKLI PUAN, ÖZEL TÜR VE İSTATİSTİK MOTORU]
  // `scripts/stats.mjs` ile %100 aynı matematiksel modeli çalıştırır.
  // ============================================================================
  function resolveEffectiveScore(a) {
    if (!a || typeof a !== 'object') return null;
    const parts = Array.isArray(a.parts) ? a.parts : [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const p of parts) {
      if (!p) continue;
      const sc = Number(p.score);
      if (!isNaN(sc) && sc > 0) {
        const w = getPartWeight(p);
        weightedSum += sc * w;
        totalWeight += w;
      }
    }

    if (totalWeight > 0) {
      return Math.round((weightedSum / totalWeight) * 10) / 10;
    }

    const direct = Number(a.score);
    return !isNaN(direct) && direct > 0 ? Math.round(direct * 10) / 10 : null;
  }

  function resolveEffectiveGenres(a, genreSourceRule = 'custom_only') {
    if (!a || typeof a !== 'object') return [];
    if (Array.isArray(a.customGenres) && a.customGenres.length > 0) {
      return [...new Set(a.customGenres.map(g => String(g).trim()).filter(Boolean))];
    }
    if (genreSourceRule === 'custom_only') {
      return [];
    }
    const raw = Array.isArray(a.genres) ? a.genres : [];
    return [...new Set(raw.map(g => String(g || '').trim()).filter(Boolean))];
  }

  function normalizePartsForStats(a) {
    const rawParts = Array.isArray(a && a.parts) ? a.parts : [];
    if (!rawParts.length) {
      if (a && a.status === 'completed') {
        return [{ kind: 'season', format: 'TV', status: 'COMPLETED', episodes: 1, watched: 1, repeat: 0 }];
      }
      return [];
    }
    const anyDone = rawParts.some(p => p && (p.status === 'COMPLETED' || (p.watched || 0) > 0));
    return rawParts.map((p, idx) => {
      const ep = Math.max(0, Number(p.episodes) || 0);
      let w = Math.max(0, Number(p.watched) || 0);
      let st = p.status || 'NONE';
      if (!anyDone && a.status === 'completed' && (p.kind === 'season' || idx === 0)) {
        st = 'COMPLETED';
      }
      if (st === 'COMPLETED' && w === 0) {
        w = ep > 0 ? ep : 1;
      }
      if (ep > 0 && w >= ep && st === 'CURRENT') {
        st = 'COMPLETED';
      }
      return {
        ...p,
        kind: p.kind === 'movie' ? 'movie' : p.kind === 'other' ? 'other' : 'season',
        episodes: ep,
        watched: w,
        status: st,
        repeat: Math.max(0, Number(p.repeat) || 0)
      };
    });
  }

  function computeStatsClient(animeList, rawConfig) {
    const cfg = { ...DEFAULT_STATS_CONFIG, ...(rawConfig || (state.animeData && state.animeData.statsConfig) || {}) };
    const list = Array.isArray(animeList) ? animeList : [];

    const eps = a => normalizePartsForStats(a).reduce((n, p) => {
      if (p.status === 'NONE' || p.status === 'PLANNING') return n;
      if (!cfg.includeInProgressEpisodes && p.status !== 'COMPLETED') return n;
      return n + (p.watched || 0);
    }, 0);

    const reps = a => Math.max(0, ...normalizePartsForStats(a).map(p => p.repeat || 0));
    const rank = (arr, key) => [...arr].sort((a, b) => key(b) - key(a) || eps(b) - eps(a) || (a.title || '').localeCompare(b.title || '', 'tr'))[0];

    const stats = {
      anime: 0,
      season: 0,
      film: 0,
      other: 0,
      episodes: 0,
      completedEpisodes: 0,
      inProgressEpisodes: 0,
      favorites: 0,
      avgScore: null,
      byStatus: {},
      genres: [],
      scoreHistogram: {},
      rules: cfg
    };

    const counted = [];
    const genreCounts = new Map();

    for (const a of list) {
      if (a.favorite) stats.favorites++;
      const st = a.status || 'watching';
      stats.byStatus[st] = (stats.byStatus[st] || 0) + 1;

      const normParts = normalizePartsForStats(a);
      const doneParts = normParts.filter(p => p.status === 'COMPLETED' && p.watched > 0);
      const doneSeasonOrMovie = doneParts.filter(p => p.kind === 'season' || p.kind === 'movie');
      const activeParts = normParts.filter(p => p.status !== 'NONE' && p.status !== 'PLANNING' && p.watched > 0);

      let isCounted = false;
      if (cfg.animeCountRule === 'completed_only') {
        isCounted = st === 'completed';
      } else if (cfg.animeCountRule === 'any_watched') {
        isCounted = activeParts.length > 0 || doneParts.length > 0 || st === 'completed';
      } else {
        isCounted = doneSeasonOrMovie.length > 0 || (doneParts.length > 0 && !normParts.some(p => p.kind === 'season' || p.kind === 'movie')) || st === 'completed';
      }

      for (const p of doneParts) {
        if (isCounted) {
          stats[p.kind === 'season' ? 'season' : p.kind === 'movie' ? 'film' : 'other']++;
        }
        stats.completedEpisodes += p.watched;
      }

      for (const p of activeParts) {
        if (p.status !== 'COMPLETED') {
          stats.inProgressEpisodes += p.watched;
        }
      }

      if (!isCounted) continue;
      stats.anime++;
      counted.push(a);

      const gList = resolveEffectiveGenres(a, cfg.genreSourceRule);
      for (const g of gList) {
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      }
    }

    stats.episodes = cfg.includeInProgressEpisodes
      ? (stats.completedEpisodes + stats.inProgressEpisodes)
      : stats.completedEpisodes;

    stats.listed = list.length;
    stats.completed = counted.filter(a => a.status === 'completed').length;
    stats.partial = counted.length - stats.completed;
    stats.excluded = list.length - counted.length;

    const rated = counted
      .map(a => ({ item: a, effScore: resolveEffectiveScore(a) }))
      .filter(x => x.effScore != null && x.effScore > 0);

    if (rated.length) {
      stats.avgScore = Math.round((rated.reduce((n, x) => n + x.effScore, 0) / rated.length) * 10) / 10;
      for (let b = 1; b <= 10; b++) stats.scoreHistogram[b] = 0;
      for (const { effScore } of rated) {
        const bucket = Math.min(10, Math.max(1, Math.floor(effScore)));
        stats.scoreHistogram[bucket] = (stats.scoreHistogram[bucket] || 0) + 1;
      }
    }

    stats.genres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
      .map(([name, count]) => ({ name, count }));

    const hl = {};
    if (rated.length) {
      const best = [...rated].sort((a, b) => b.effScore - a.effScore || eps(b.item) - eps(a.item) || (a.item.title || '').localeCompare(b.item.title || '', 'tr'))[0];
      hl.topScore = {
        id: best.item.id,
        title: best.item.title,
        score: best.effScore,
        ties: rated.filter(x => x.effScore === best.effScore).length - 1
      };
    }
    const w = rank(list.filter(a => eps(a) > 0), eps);
    if (w) hl.mostWatched = { id: w.id, title: w.title, episodes: eps(w), status: w.status };
    const r = list.filter(a => reps(a) > 0);
    if (r.length) {
      const t = rank(r, reps);
      hl.mostRewatched = { id: t.id, title: t.title, times: reps(t) + 1 };
    }
    if (Object.keys(hl).length) stats.highlights = hl;
    return stats;
  }

  function computeMediaStatsClient(items, rawConfig, mediaType = 'anime') {
    const list = Array.isArray(items) ? items : [];
    if (mediaType === 'guide') {
      const byStatus = {};
      const genreCounts = new Map();
      let favorites = 0;
      let published = 0;
      for (const it of list) {
        if (!it) continue;
        if (it.favorite) favorites++;
        const st = it.status || 'completed';
        byStatus[st] = (byStatus[st] || 0) + 1;
        if (st === 'completed') published++;
        for (const g of resolveEffectiveGenres(it, 'custom_only')) {
          genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
        }
      }
      const genres = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
        .map(([name, count]) => ({ name, count }));
      return {
        total: list.length,
        published,
        draft: list.length - published,
        favorites,
        byStatus,
        genres
      };
    }

    const base = computeStatsClient(list, rawConfig);
    if (mediaType === 'book') {
      return {
        total: list.length,
        read: base.anime,
        volumes: base.season,
        extras: base.film + base.other,
        pages: base.episodes,
        completedPages: base.completedEpisodes,
        inProgressPages: base.inProgressEpisodes,
        favorites: base.favorites,
        avgScore: base.avgScore,
        byStatus: base.byStatus,
        genres: base.genres,
        scoreHistogram: base.scoreHistogram
      };
    }
    if (mediaType === 'manga') {
      return {
        total: list.length,
        read: base.anime,
        volumes: base.season,
        specials: base.film + base.other,
        chapters: base.episodes,
        completedChapters: base.completedEpisodes,
        inProgressChapters: base.inProgressEpisodes,
        favorites: base.favorites,
        avgScore: base.avgScore,
        byStatus: base.byStatus,
        genres: base.genres,
        scoreHistogram: base.scoreHistogram
      };
    }
    if (mediaType === 'movie') {
      return {
        total: list.length,
        watched: base.anime,
        films: base.season + base.film,
        extras: base.other,
        watchCount: base.episodes,
        favorites: base.favorites,
        avgScore: base.avgScore,
        byStatus: base.byStatus,
        genres: base.genres,
        scoreHistogram: base.scoreHistogram
      };
    }
    if (mediaType === 'series') {
      return {
        total: list.length,
        watched: base.anime,
        seasons: base.season,
        specials: base.film + base.other,
        episodes: base.episodes,
        completedEpisodes: base.completedEpisodes,
        inProgressEpisodes: base.inProgressEpisodes,
        favorites: base.favorites,
        avgScore: base.avgScore,
        byStatus: base.byStatus,
        genres: base.genres,
        scoreHistogram: base.scoreHistogram
      };
    }
    return base;
  }

  function cleanMediaItemsForSave(items, mediaType = 'anime') {
    const list = Array.isArray(items) ? items : [];
    if (mediaType !== 'guide') return list;
    return list.map(it => {
      const copy = { ...it };
      delete copy.parts;
      delete copy.anilistId;
      delete copy.firstSeasonUrl;
      delete copy.lockedFields;
      delete copy.score;
      return copy;
    });
  }

  function deriveFranchiseStatusFromParts(parts) {
    const act = (parts || []).filter(p => p.status && p.status !== 'NONE' && p.status !== 'PLANNING');
    const pool = act.length ? act : (parts || []);
    if (!pool.length) return 'planned';
    const main = pool.some(p => p.kind === 'season') ? pool.filter(p => p.kind === 'season') : pool;
    const st = new Set(main.map(p => p.status));
    return st.has('CURRENT') ? 'watching' : st.has('PAUSED') ? 'paused' : st.has('DROPPED') ? 'dropped'
      : st.size === 1 && st.has('COMPLETED') ? 'completed' : st.size === 1 && st.has('PLANNING') ? 'planned' : 'watching';
  }

  function findActiveTrackablePart(animeItem) {
    const parts = animeItem.parts || [];
    if (!parts.length) return null;
    let target = parts.find(p => p.status === 'CURRENT');
    if (target) return target;
    target = parts.find(p => p.status !== 'COMPLETED' && (p.watched || 0) > 0 && (!p.episodes || p.watched < p.episodes));
    if (target) return target;
    target = parts.find(p => p.kind === 'season' && p.status !== 'COMPLETED' && p.release !== 'NOT_YET_RELEASED');
    if (target) return target;
    target = parts.find(p => p.status !== 'COMPLETED');
    return target || parts[parts.length - 1];
  }

  function quickIncrementEpisode(animeId, completeSeason = false) {
    const adapter = getActiveAdminAdapter();
    const list = adapter.getItems();
    const item = list.find(a => a.id === animeId);
    if (!item) return;
    if (!Array.isArray(item.parts) || !item.parts.length) {
      item.parts = [{
        id: item.anilistId || ('part-' + Date.now()),
        name: '1. Sezon',
        kind: 'season',
        format: 'TV',
        episodes: 12,
        watched: 0,
        status: 'CURRENT',
        release: 'FINISHED',
        year: new Date().getFullYear(),
        adminModified: true
      }];
    }
    const part = findActiveTrackablePart(item);
    if (!part) return;

    const totalEp = Number(part.episodes) || 0;
    const prevWatched = Number(part.watched) || 0;

    if (completeSeason) {
      part.watched = totalEp > 0 ? totalEp : Math.max(1, prevWatched);
      part.status = 'COMPLETED';
    } else {
      const nextWatched = totalEp > 0 ? Math.min(totalEp, prevWatched + 1) : (prevWatched + 1);
      part.watched = nextWatched;
      if (totalEp > 0 && nextWatched >= totalEp) {
        part.status = 'COMPLETED';
      } else {
        part.status = 'CURRENT';
      }
    }

    part.adminModified = true;
    item.adminModified = true;
    const locked = new Set(item.lockedFields || []);
    locked.add('status');
    item.lockedFields = [...locked];
    item.status = deriveFranchiseStatusFromParts(item.parts);
    item.score = resolveEffectiveScore(item);

    adapter.saveItem(item);
    renderAnimeAdminPanel();

    const unitWord = adapter.subItemUnitLabel || 'bölüm';
    const frac = part.episodes ? `${part.watched}/${part.episodes} ${unitWord}` : `${part.watched} ${unitWord}`;
    toast(`${item.title} (${part.name}): ${frac} · ${part.status === 'COMPLETED' ? 'Tamamlandı!' : 'Güncellendi'}`);
  }

  function quickToggleFavorite(animeId) {
    const adapter = getActiveAdminAdapter();
    const list = adapter.getItems();
    const item = list.find(a => a.id === animeId);
    if (!item) return;
    item.favorite = !item.favorite;
    if (!item.favorite) delete item.favorite;
    item.adminModified = true;
    adapter.saveItem(item);
    renderAnimeAdminPanel();
    const favLabel = adapter.id === 'guide' ? '★ Öne Çıkan Rehber' : '★ Başyapıt / Favori';
    toast(item.favorite ? `"${item.title}" ${favLabel} olarak işaretlendi!` : `"${item.title}" öne çıkanlardan/favorilerden çıkarıldı.`);
  }

  function toast(msg, type = 'ok') {
    const area = $('#toastArea');
    if (!area) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    area.append(t);
    setTimeout(() => { t.remove(); }, 4200);
  }

  function showAuthAlert(msg) {
    const el = $('#authAlert');
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
    } else {
      el.textContent = msg;
      el.hidden = false;
    }
  }



  function markDirty(kind = 'config') {
    if (kind === 'config') state.dirtyConfig = true;
    else if (kind === 'anime') state.dirtyAnime = true;
    else if (kind === 'overrides') state.dirtyOverrides = true;
    updateDirtyIndicator();
  }

  function switchAuthTab(tabId) {
    showAuthAlert('');
    $$('[data-auth-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.authTab === tabId));
    $('#authPaneTotp').hidden = tabId !== 'totp';
    $('#authPanePair').hidden = tabId !== 'pair';
  }

  function buildOtpAuthUri(username, secret) {
    const cleanUser = encodeURIComponent(username || 'tempestian');
    const issuer = encodeURIComponent('Tempestian');
    return `otpauth://totp/${issuer}:${cleanUser}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  }

  async function initAuthGate() {
    const devMeta = AdminSecurity.getDeviceVaultMeta();
    const localVault = AdminSecurity.getLocalVault();
    state.remoteVault = await AdminSecurity.fetchRemoteVault(root);
    const hasSealedVault = Boolean(state.remoteVault || localVault);

    $('#pairVaultBox').hidden = !hasSealedVault;
    $('#pairInitialGate').hidden = hasSealedVault;
    $('#pairDynamicMount').replaceChildren();

    if (devMeta) {
      $('#deviceReadyBox').hidden = false;
      $('#deviceMissingBox').hidden = true;
      $('#deviceStatusBanner').innerHTML = `<span><b>${AdminSecurity.sanitizeText(devMeta.username || 'tempestian')}</b> profili bu cihazda Google Authenticator ile eşleşmiş durumda.</span>`;
      switchAuthTab('totp');
      setTimeout(() => { const inp = $('#loginTotpCode'); if (inp) inp.focus(); }, 60);
    } else {
      $('#deviceReadyBox').hidden = true;
      $('#deviceMissingBox').hidden = false;
      switchAuthTab('totp');
    }
  }

  function mountSetupQRStep() {
    const mount = $('#pairDynamicMount');
    if (!mount || !state.verifiedSetupContext) return;
    state.setupSecret = AdminSecurity.generateBase32Secret(20);
    const { login } = state.verifiedSetupContext;
    const uri = buildOtpAuthUri(login, state.setupSecret);

    mount.innerHTML = `
      <form id="formSetupProfile" autocomplete="off">
        <div class="status-banner ok">
          <span>GitHub depo yazma yetkisi (<b>${AdminSecurity.sanitizeText(login)}</b>) doğrulandı. Şimdi Google Authenticator uygulamanızı eşleştirip kasayı mühürleyin.</span>
        </div>
        <div class="setup-grid">
          <div class="setup-col">
            <h3>Adım 2: Yönetici Kasa Parolası</h3>
            <label class="field">
              <span>Yönetici Kullanıcı Adı</span>
              <input type="text" id="setupUsername" class="inp glass" readonly>
            </label>
            <label class="field">
              <span>Yönetici Ana Parolası (En az 8 karakter)</span>
              <input type="password" id="setupVaultPass" class="inp glass" minlength="8" placeholder="Güçlü yönetici parolanız" required>
              <small>Bu parola, TOTP anahtarınızı <b>PBKDF2 (600.000 iterasyon) + AES-256-GCM</b> ile şifreleyip <code>data/admin-vault.json</code> olarak depoya mühürler. GitHub Token'ınız güvenlik için asla depoya yazılmaz; yalnızca cihazınızın donanım/tarayıcı anahtarında tutulur.</small>
            </label>
          </div>
          <div class="setup-col">
            <h3>Adım 3: Google Authenticator Eşleştirme</h3>
            <div class="qr-card glass">
              <div id="qrContainer" class="qr-box" aria-label="Google Authenticator QR Kodu"></div>
              <div class="qr-meta">
                <span class="qr-label">Kurulum Anahtarı (Base32):</span>
                <code id="totpSecretDisplay" class="secret-code"></code>
                <div class="qr-btns">
                  <button type="button" class="btn-subtle" id="copySecretBtn">Anahtarı Kopyala</button>
                  <button type="button" class="btn-subtle" id="regenSecretBtn">Yeni QR Üret</button>
                </div>
              </div>
            </div>
            <label class="field">
              <span>Google Authenticator Doğrulama Kodu (6 Hane)</span>
              <input type="text" id="setupVerifyCode" class="totp-input glass" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required>
              <small>QR kodu telefonunuzdaki Google Authenticator ile okutun ve üretilen 6 haneli kodu girin.</small>
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" id="finalizeSetupBtn">Doğrula, Kasayı Depoya Mühürle ve Giriş Yap</button>
        </div>
      </form>
    `;

    $('#setupUsername').value = login;
    $('#qrContainer').innerHTML = window.QRGenerator.renderQRSVG(uri, 3);
    $('#totpSecretDisplay').textContent = state.setupSecret;

    $('#regenSecretBtn').onclick = () => {
      state.setupSecret = AdminSecurity.generateBase32Secret(20);
      $('#qrContainer').innerHTML = window.QRGenerator.renderQRSVG(buildOtpAuthUri(login, state.setupSecret), 3);
      $('#totpSecretDisplay').textContent = state.setupSecret;
    };

    $('#copySecretBtn').onclick = async () => {
      try {
        await navigator.clipboard.writeText(state.setupSecret);
        toast('Google Authenticator kurulum anahtarı kopyalandı.');
      } catch (e) {
        toast('Anahtar: ' + state.setupSecret);
      }
    };

    $('#formSetupProfile').onsubmit = handleFinalizeSetup;
  }

  async function handleFinalizeSetup(e) {
    e.preventDefault();
    showAuthAlert('');
    if (!state.verifiedSetupContext || !state.setupSecret) {
      showAuthAlert('Önce GitHub yetki doğrulamasını tamamlayın.');
      return;
    }
    const { login, pat, repoOwner, repoName, branch } = state.verifiedSetupContext;
    const vaultPass = $('#setupVaultPass').value;
    const verifyCode = $('#setupVerifyCode').value.trim();

    if (!vaultPass || vaultPass.length < 8) {
      showAuthAlert('Lütfen en az 8 karakterli güçlü bir yönetici ana parolası belirleyin.');
      return;
    }

    const isCodeValid = await AdminSecurity.verifyTOTP(state.setupSecret, verifyCode, 1);
    if (!isCodeValid) {
      showAuthAlert('Girilen 6 haneli Google Authenticator kodu doğrulanamadı. Lütfen QR kodu okutup güncel kodu girin.');
      return;
    }

    const devicePayload = {
      username: login,
      pat,
      repoOwner,
      repoName,
      branch,
      totpSecret: state.setupSecret,
      createdAt: new Date().toISOString()
    };

    const repoVaultPayload = {
      username: login,
      repoOwner,
      repoName,
      branch,
      totpSecret: state.setupSecret,
      createdAt: new Date().toISOString()
    };

    const btn = $('#finalizeSetupBtn');
    btn.disabled = true;
    btn.textContent = 'Kasa Şifreleniyor ve Mühürleniyor...';

    try {
      await AdminSecurity.saveDeviceVault(devicePayload);
      const encryptedVault = await AdminSecurity.encryptVault(repoVaultPayload, login, vaultPass);
      AdminSecurity.saveLocalVault(encryptedVault);

      const info = await AdminSecurity.unlockWithDeviceTOTP(verifyCode);
      await AdminSecurity.githubPutFile(
        'data/admin-vault.json',
        JSON.stringify(encryptedVault, null, 2) + '\n',
        'Yönetici şifreli kasası mühürlendi',
        false
      );
      state.remoteVault = encryptedVault;
      toast('Admin profiliniz oluşturuldu ve kurulum ekranı mühürlendi!');
      onSessionUnlocked(info);
    } catch (err) {
      showAuthAlert('Profil kaydedilirken hata oluştu: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Doğrula, Kasayı Depoya Mühürle ve Giriş Yap';
      }
    }
  }

  function mountAdminDashboardDOM() {
    const app = $('#adminApp');
    if (!app) return;
    app.innerHTML = `
      <div class="admin-toolbar glass sq">
        <div class="toolbar-info">
          <strong id="activeUserLabel">tempestian</strong>
          <span id="syncModeLabel" class="mode-pill">GitHub API Bağlı</span>
          <span id="dirtyIndicator" class="dirty-pill" hidden>Kaydedilmemiş değişiklikler var</span>
        </div>
        <div class="toolbar-btns">
          <button type="button" class="btn-subtle" id="previewApplyBtn" title="Değişiklikleri tarayıcı önbelleğine uygular">Canlı Önizlemeye Uygula</button>
          <button type="button" class="btn-subtle" id="clearPreviewBtn" hidden title="Önizleme önbelleğini temizler">Önizlemeyi Sıfırla</button>
          <button type="button" class="btn-subtle" id="downloadJsonBtn">sections.json İndir</button>
          <button type="button" class="btn-primary" id="commitGithubBtn">GitHub'a Kaydet (Commit)</button>
        </div>
      </div>

      <nav class="admin-nav glass sq" role="tablist" aria-label="Yönetim Bölümleri">
        <button type="button" class="nav-tab" role="tab" data-panel="anime" aria-selected="true">Medya &amp; İstatistik (Anime/Dizi/Film/Kitap)</button>
        <button type="button" class="nav-tab" role="tab" data-panel="rapid" aria-selected="false">⚡ Hızlı Sıralı Düzenleme</button>
        <button type="button" class="nav-tab" role="tab" data-panel="texts" aria-selected="false">Metinler &amp; Sayfalar</button>
        <button type="button" class="nav-tab" role="tab" data-panel="images" aria-selected="false">Görseller &amp; İkonlar</button>
        <button type="button" class="nav-tab" role="tab" data-panel="categories" aria-selected="false">Kategoriler (Bölümler)</button>
        <button type="button" class="nav-tab" role="tab" data-panel="boxes" aria-selected="false">Kutucuklar &amp; Bağlantılar</button>
        <button type="button" class="nav-tab" role="tab" data-panel="health" aria-selected="false">🛡️ Veri Sağlığı &amp; Yedek</button>
        <button type="button" class="nav-tab" role="tab" data-panel="security" aria-selected="false">Profil &amp; Güvenlik</button>
      </nav>

      <!-- ADIM 3, 4, 5, 6, 7 & 8: ANİME YÖNETİMİ, AĞIRLIKLI PUAN, ÖZEL KATEGORİ VE İSTATİSTİK MOTORU -->
      <div id="panelAnime" class="admin-panel">
        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2 id="admPanelMainTitle">Medya Verileri, Ağırlıklı Puanlama ve Özel Kategori Yönetimi</h2>
              <p id="admPanelMainSub">Sezon (<b>×1.00</b>), Film (<b>×0.35</b>) ve Yan İçerik (<b>×0.15</b>) puanlarınız genel puanı otomatik belirler. İstatistiklerde yalnızca sizin seçtiğiniz özel kategoriler yer alır.</p>
            </div>
            <div class="form-actions">
              <select id="admMediaTypeSelect" class="inp glass" style="width:auto;min-width:155px;font-weight:650" title="Yönetilecek Medya Bölümünü Seçin">
                <option value="anime">📺 Bölüm: Anime</option>
                <option value="series">🎬 Bölüm: Dizi</option>
                <option value="movie">🍿 Bölüm: Film</option>
                <option value="manga">📖 Bölüm: Manga</option>
                <option value="book">📚 Bölüm: Kitap</option>
                <option value="guide">🧭 Bölüm: Rehber (Technopat Katalog)</option>
              </select>
              <button type="button" class="btn-secondary" id="openCommitRecoveryBtn" title="GitHub'daki önceki commit'lerinizden düzenlediğiniz kategori, puan ve başyapıt verilerini tek tıkla geri getirir">🕰️ Eski Commit'ten Verileri Kurtar</button>
              <button type="button" class="btn-subtle" id="scanAllRelationsBtn" title="Listedeki animelerin İlk Sezon AniList Linklerini tarayarak eksik sezon, film ve yan içerikleri AniList'ten çeker">Yan İçerikleri Sorgula</button>
              <button type="button" class="btn-subtle" id="triggerActionsBtn" title="GitHub Actions üzerindeki sync-anilist.yml iş akışını tetikler">GitHub Actions Çalıştır</button>
              <button type="button" class="btn-subtle" id="toggleOverridesBtn">Senkron Kuralları (overrides.json)</button>
              <button type="button" class="btn-subtle" id="downloadAnimeJsonBtn">anime.json İndir</button>
              <button type="button" class="btn-secondary" id="openRapidQueueFromAnimeBtn" title="Tüm girdileri sırayla öne çıkararak hızlıca kategori, puan ve bölüm düzenlemenizi sağlar">⚡ Hızlı Sıralı Düzenleme</button>
              <button type="button" class="btn-primary" id="addNewAnimeBtn">+ Yeni Anime Ekle</button>
            </div>
          </div>

          <div id="animeStatsSummary" class="anime-stats-bar"></div>

          <!-- OVERRIDES.JSON GÖRSEL DÜZENLEYİCİ -->
          <div id="overridesEditorSection" class="editor-item" hidden>
            <div class="editor-item-head">
              <div class="editor-item-title">
                <span>Senkronizasyon Kuralları (data/overrides.json)</span>
              </div>
              <button type="button" class="btn-subtle" id="downloadOverridesBtn">overrides.json İndir</button>
            </div>
            <div class="ov-grid">
              <div class="ov-box">
                <h4>Özel Başlıklar (titles)</h4>
                <p class="meta">AniList ID'sine sahip franchise'ın sitede hangi başlıkla görüneceğini zorlar.</p>
                <div class="field-row align-end">
                  <label class="field"><span>AniList ID</span><input type="number" id="ovTitleId" class="inp glass" placeholder="15687"></label>
                  <label class="field"><span>Özel Başlık</span><input type="text" id="ovTitleVal" class="inp glass" placeholder="Love, Chunibyo..."></label>
                  <button type="button" class="btn-secondary" id="addOvTitleBtn">Ekle</button>
                </div>
                <div id="ovTitlesList" class="ov-list"></div>
              </div>

              <div class="ov-box">
                <h4>Franchise Birleştirme (merge)</h4>
                <p class="meta">AniList'te otomatik bağlanmayan bir ID'yi hedef franchise ID'sine bağlar.</p>
                <div class="field-row align-end">
                  <label class="field"><span>Alt AniList ID</span><input type="number" id="ovMergeFrom" class="inp glass" placeholder="8460"></label>
                  <label class="field"><span>Hedef Franchise ID</span><input type="number" id="ovMergeTo" class="inp glass" placeholder="10620"></label>
                  <button type="button" class="btn-secondary" id="addOvMergeBtn">Ekle</button>
                </div>
                <div id="ovMergeList" class="ov-list"></div>
              </div>

              <div class="ov-box">
                <h4>"Devam Edilecek" Etiketi Engeli (noContinue)</h4>
                <p class="meta">Yeni sezonu çıksa bile "Devam edilecek" olarak işaretlenmeyecek başlık veya ID'ler.</p>
                <div class="field-row align-end">
                  <label class="field"><span>Başlık Kelimesi veya ID</span><input type="text" id="ovNoContVal" class="inp glass" placeholder="Mushoku Tensei"></label>
                  <button type="button" class="btn-secondary" id="addOvNoContBtn">Ekle</button>
                </div>
                <div id="ovNoContList" class="ov-list"></div>
              </div>

              <div class="ov-box">
                <h4>Hariç Tutulan AniList ID'leri (exclude)</h4>
                <p class="meta">Senkronizasyondan ve listeden tamamen dışlanacak AniList ID'leri.</p>
                <div class="field-row align-end">
                  <label class="field"><span>Dışlanacak AniList ID</span><input type="number" id="ovExcludeVal" class="inp glass" placeholder="12345"></label>
                  <button type="button" class="btn-secondary" id="addOvExcludeBtn">Ekle</button>
                </div>
                <div id="ovExcludeList" class="ov-list"></div>
              </div>
            </div>
          </div>

          <!-- MEDYA ARAMA VE FİLTRELEME -->
          <div class="field-row">
            <label class="field" style="flex:2">
              <span id="admAnimeSearchLabel">Anime Ara (Başlık, Özel Kategori, ID veya AniList URL)</span>
              <input type="search" id="admAnimeSearch" class="inp glass" placeholder="Örn: Slime, Isekai, Seinen, 101280...">
            </label>
            <label class="field">
              <span>Durum Filtresi</span>
              <select id="admAnimeStatusFilter" class="inp glass">
                <option value="all">Tüm Durumlar</option>
                <option value="watching">İzleniyor</option>
                <option value="completed">İzlendi</option>
                <option value="paused">Beklemede</option>
                <option value="dropped">Bırakıldı</option>
                <option value="planned">Planlandı</option>
                <option value="next">Devam Edilecekler</option>
                <option value="fav">★ Başyapıtlar / Favoriler</option>
              </select>
            </label>
            <label class="field">
              <span>Kategori &amp; Düzenleme Filtresi</span>
              <select id="admAnimeSourceFilter" class="inp glass">
                <option value="all">Tümü</option>
                <option value="uncategorized">Kategorisi Seçilmemiş Olanlar</option>
                <option value="categorized">Özel Kategorisi Seçilmiş Olanlar</option>
                <option value="manual">Elle Eklenenler (manual)</option>
                <option value="modified">Admin Düzenlemeli</option>
              </select>
            </label>
          </div>

          <div id="animeAdminList" class="anime-admin-list"></div>
        </div>
      </div>

      <!-- ADIM 9: EVRENSEL HIZLI SIRALI TOPLU DÜZENLEME PANELİ (ANİME, MANGA, KİTAP, DİZİ, FİLM, REHBER UYUMLU) -->
      <div id="panelRapid" class="admin-panel" hidden>
        <div class="rapid-queue-card glass sq">
          <div class="rq-top-bar">
            <div class="field-row" style="flex:2;min-width:280px">
              <label class="field">
                <span>İçerik Bölümü (Adaptör)</span>
                <select id="rqContentTypeSelect" class="inp glass">
                  <option value="anime">📺 Anime</option>
                  <option value="series">🎬 Dizi</option>
                  <option value="movie">🍿 Film</option>
                  <option value="manga">📖 Manga</option>
                  <option value="book">📚 Kitap</option>
                  <option value="guide">🧭 Rehber (Technopat Katalog)</option>
                </select>
              </label>
              <label class="field" style="flex:1.4">
                <span>Sıralama / Kuyruk Filtresi</span>
                <select id="rqFilterSelect" class="inp glass">
                  <option value="uncategorized">Özel Kategorisi Seçilmemiş Olanlar (Önerilen)</option>
                  <option value="all">Tüm Girdiler (Baştan Sona Sırayla)</option>
                  <option value="favorites">★ Sadece Başyapıtlar / Favoriler</option>
                  <option value="unscored">Puanı Girilmemiş Olanlar</option>
                  <option value="unmodified">Henüz Admin Düzenlemesi Olmayanlar</option>
                  <option value="watching">Devam Edenler (İzleniyor / Okunuyor)</option>
                </select>
              </label>
              <div class="field" style="align-self:end">
                <button type="button" class="btn-subtle" id="rqRebuildQueueBtn" title="Seçili filtreye göre kuyruğu yeniden oluşturur">Kuyruğu Yenile</button>
              </div>
            </div>

            <div class="rq-progress-wrap">
              <div class="rq-progress-meta">
                <span id="rqProgressText">0 / 0</span>
                <span id="rqSessionCountText">Bu oturumda 0 girdi kaydedildi</span>
              </div>
              <div class="rq-progress-track">
                <div id="rqProgressFill" class="rq-progress-fill" style="width:0%"></div>
              </div>
            </div>
          </div>

          <!-- YATAY MINI KUYRUK ŞERİDİ -->
          <div id="rqStrip" class="rq-strip" aria-label="Sıradaki Girdiler"></div>

          <!-- AKTİF GİRDİ (SPOTLIGHT) DÜZENLEME ALANI -->
          <div id="rqEmptyState" class="status-banner ok" hidden>
            <span>Seçili filtrede düzenlenecek girdi kalmadı! "Tüm Girdiler" filtresine geçebilir veya değişikliklerinizi GitHub'a kaydedebilirsiniz.</span>
            <button type="button" class="btn-subtle" id="rqSwitchToAllBtn">Tüm Girdileri Göster</button>
          </div>

          <div id="rqSpotlightBody" class="rq-spotlight">
            <div class="rq-poster-col">
              <div class="rq-poster"><img id="rqPosterImg" alt=""></div>
              <div class="score-badge-big" id="rqWeightedScoreBadge" title="Ağırlıklı Genel Puan">Puansız</div>
              <button type="button" class="fav-toggle-btn" id="rqFavoriteBtn" style="width:100%;justify-content:center">☆ Başyapıt İşaretle</button>
              <button type="button" class="btn-subtle" id="rqOpenFullModalBtn" style="width:100%">Detaylı Pencere</button>
            </div>

            <div class="rq-main-col">
              <div class="field-row">
                <label class="field" style="flex:2">
                  <span id="rqTitleLabel">Başlık</span>
                  <input type="text" id="rqTitleInput" class="inp glass" placeholder="Başlık">
                </label>
                <label class="field">
                  <span>Genel Durum</span>
                  <select id="rqStatusSelect" class="inp glass"></select>
                </label>
                <label class="field" id="rqNextFieldWrap">
                  <span>Devam Edilecek</span>
                  <select id="rqNextSelect" class="inp glass">
                    <option value="auto">Otomatik</option>
                    <option value="yes">Evet</option>
                    <option value="no">Hayır</option>
                  </select>
                </label>
              </div>

              <div class="field-row align-end">
                <label class="field" style="flex:2">
                  <span id="rqExternalUrlLabel">İlk Sezonun AniList Linki / Kaynak URL</span>
                  <input type="url" id="rqExternalUrlInput" class="inp glass" placeholder="https://anilist.co/anime/...">
                </label>
                <label class="field" id="rqExtraMetaWrap" hidden>
                  <span id="rqExtraMetaLabel">Yazar / Yönetmen / Ek Bilgi</span>
                  <input type="text" id="rqExtraMetaInput" class="inp glass">
                </label>
                <button type="button" class="btn-subtle" id="rqFetchRelationsBtn">Linkten Yan İçerikleri Çek</button>
              </div>

              <!-- HIZLI KATEGORİ / TÜR SEÇİMİ -->
              <div class="genre-studio">
                <div class="split-head">
                  <div>
                    <h4 id="rqGenreHeading">Özel Tür &amp; Kategori Seçimi (Tıklayarak Seçin)</h4>
                    <p class="meta">Seçtiğiniz kategoriler istatistiklere doğrudan yansır. Kaydet ve Sıradakine Geç ile anında bir sonraki girdiye geçebilirsiniz.</p>
                  </div>
                  <button type="button" class="btn-subtle" id="rqClearGenresBtn">Kategorileri Temizle</button>
                </div>
                <div id="rqGenreGroups" class="field-stack"></div>
                <div class="field-row align-end">
                  <label class="field" style="flex:2">
                    <span>Seçili Özel Kategoriler</span>
                    <input type="text" id="rqGenresInput" class="inp glass" placeholder="Shounen, Isekai, Fantastik...">
                  </label>
                  <label class="field">
                    <span>Yeni Kategori Tanımla</span>
                    <input type="text" id="rqNewGenreInput" class="inp glass" placeholder="Örn: Felsefi, Vampir...">
                  </label>
                  <button type="button" class="btn-secondary" id="rqAddNewGenreBtn">+ Ekle</button>
                </div>
              </div>

              <!-- ALT BİRİMLER (SEZON / FİLM / YAN İÇERİK / BÖLÜM / CİLT) HIZLI PUANLAMA VE DURUM LİSTESİ -->
              <div class="score-studio">
                <div class="score-studio-top">
                  <div>
                    <h4 id="rqSubItemsHeading">Sezon, Film ve Yan İçerik Puanları (Sezon ×1.00 · Film ×0.35 · Yan İçerik ×0.15)</h4>
                    <p class="meta">Her sezon veya filme tıklayarak puan verin; genel puan ağırlıklı olarak otomatik hesaplanır.</p>
                  </div>
                  <div class="template-chips" id="rqBulkSeasonScoreChips"></div>
                </div>
                <div id="rqSubItemsList" class="rq-subitems-grid"></div>
              </div>
            </div>
          </div>

          <div class="rq-nav-footer">
            <div class="form-actions" style="margin:0">
              <button type="button" class="btn-subtle" id="rqPrevBtn">← Önceki Girdi</button>
              <button type="button" class="btn-subtle" id="rqSkipBtn">Değiştirmeden Sıradakine Geç →</button>
            </div>
            <span class="rq-kbd-hint">Kısayollar: <kbd>Ctrl</kbd>+<kbd>Enter</kbd> Kaydet ve Sıradakine Geç · <kbd>Alt</kbd>+<kbd>→</kbd> Atla · <kbd>Alt</kbd>+<kbd>←</kbd> Önceki</span>
            <div class="form-actions" style="margin:0">
              <button type="button" class="btn-secondary" id="rqSaveStayBtn">Sadece Kaydet</button>
              <button type="button" class="btn-primary" id="rqSaveNextBtn">Kaydet ve Sıradakine Geç →</button>
            </div>
          </div>
        </div>
      </div>

      <div id="panelTexts" class="admin-panel" hidden>
        <div class="card-grid">
          <div class="admin-card glass sq">
            <div class="card-head">
              <h2>Ana Sayfa &amp; Kimlik Metinleri</h2>
              <p>Ana sayfa başlığı, alt başlık, üst çubuk ve arama motoru açıklaması.</p>
            </div>
            <div class="field-stack">
              <label class="field">
                <span>Ana Başlık (h1)</span>
                <input type="text" id="cfgSiteTitle" class="inp glass" placeholder="Tempestian">
              </label>
              <label class="field">
                <span>Alt Başlık / İsim (.sub)</span>
                <input type="text" id="cfgSiteSubtitle" class="inp glass" placeholder="Bayram">
              </label>
              <label class="field">
                <span>Üst Çubuk Başlığı (.bar-title)</span>
                <input type="text" id="cfgSiteBarTitle" class="inp glass" placeholder="Tempestian">
              </label>
              <label class="field">
                <span>Alt Menü Ana Sayfa Etiketi</span>
                <input type="text" id="cfgSiteHomeLabel" class="inp glass" placeholder="Ana sayfa">
              </label>
              <label class="field">
                <span>Site Meta Açıklaması (description)</span>
                <textarea id="cfgSiteDesc" class="inp glass" rows="2" placeholder="Bayram Tempestian'ın kişisel sitesi."></textarea>
              </label>
            </div>
          </div>

          <div class="admin-card glass sq">
            <div class="card-head">
              <h2>Anime Sayfası Metinleri</h2>
              <p>/anime/ sayfasındaki başlıklar, arama kutusu, butonlar ve alt bilgi notu.</p>
            </div>
            <div class="field-stack">
              <div class="field-row">
                <label class="field">
                  <span>Sayfa Başlığı (h1)</span>
                  <input type="text" id="cfgAnimeTitle" class="inp glass" placeholder="Anime">
                </label>
                <label class="field">
                  <span>Tarayıcı Sekme Başlığı</span>
                  <input type="text" id="cfgAnimeMetaTitle" class="inp glass" placeholder="Anime · Tempestian">
                </label>
              </div>
              <label class="field">
                <span>Sayfa Meta Açıklaması</span>
                <input type="text" id="cfgAnimeDesc" class="inp glass">
              </label>
              <div class="field-row">
                <label class="field">
                  <span>Arama Kutusu İpucu</span>
                  <input type="text" id="cfgAnimeSearch" class="inp glass" placeholder="Ara">
                </label>
                <label class="field">
                  <span>Boş Sonuç Metni</span>
                  <input type="text" id="cfgAnimeEmpty" class="inp glass" placeholder="Eşleşen anime yok.">
                </label>
              </div>
              <div class="field-row">
                <label class="field">
                  <span>İstatistik Ayrıntılar Butonu</span>
                  <input type="text" id="cfgAnimeDetails" class="inp glass" placeholder="Ayrıntılar">
                </label>
                <label class="field">
                  <span>Filtre Sıfırlama Butonu</span>
                  <input type="text" id="cfgAnimeReset" class="inp glass" placeholder="Filtreleri sıfırla">
                </label>
                <label class="field">
                  <span>AniList Bağlantı Metni</span>
                  <input type="text" id="cfgAnimeAlBtn" class="inp glass" placeholder="AniList'te aç">
                </label>
              </div>
              <label class="field">
                <span>Alt Bilgi Notu (.foot)</span>
                <textarea id="cfgAnimeFooter" class="inp glass" rows="2"></textarea>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div id="panelImages" class="admin-panel" hidden>
        <div class="admin-card glass sq">
          <div class="card-head">
            <h2>Site Görselleri ve İkonları</h2>
            <p>Görsel yollarını düzenleyebilir veya bilgisayarınızdan yeni görsel seçip doğrudan <code>assets/img/</code> klasörüne yükleyebilirsiniz.</p>
          </div>
          <div id="imageSlotsGrid" class="img-slots-grid"></div>
        </div>

        <div class="admin-card glass sq">
          <div class="card-head">
            <h2>Yeni Görsel Yükleyici (assets/img/)</h2>
            <p>Özel kutucuklarda, kategorilerde veya anime kapaklarında kullanmak için depoya yeni bir görsel dosyası yükleyin.</p>
          </div>
          <div class="field-row align-end">
            <label class="field">
              <span>Hedef Dosya Adı (assets/img/ içinde)</span>
              <input type="text" id="customImgName" class="inp glass" placeholder="ornek-gorsel.png">
            </label>
            <label class="field">
              <span>Görsel Dosyası Seç</span>
              <input type="file" id="customImgFile" accept="image/*" class="inp glass file-inp">
            </label>
            <button type="button" class="btn-secondary" id="uploadCustomImgBtn">Kuyruğa Ekle</button>
          </div>
          <div id="pendingUploadsBox" class="pending-uploads" hidden>
            <h4>Kaydedilmeyi Bekleyen Görseller</h4>
            <ul id="pendingUploadsList" class="item-list"></ul>
          </div>
        </div>
      </div>

      <div id="panelCategories" class="admin-panel" hidden>
        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Site Kategorileri ve Bölüm Kutucukları</h2>
              <p>Ana sayfadaki kategori kutucuklarını ve alt menüyü (Dock) yönetin. İleride eklenecek bölümleri <b>Yakında</b> veya <b>Gizli</b> olarak şimdiden hazırlayabilirsiniz.</p>
            </div>
            <div class="quick-add-bar">
              <button type="button" class="btn-primary" id="addCategoryBtn">+ Yeni Kategori</button>
            </div>
          </div>
          <div class="template-chips">
            <span>Hızlı Şablon Ekle:</span>
            <button type="button" class="btn-chip" data-tpl-sec="manga">+ Manga</button>
            <button type="button" class="btn-chip" data-tpl-sec="book">+ Kitap</button>
            <button type="button" class="btn-chip" data-tpl-sec="series">+ Dizi</button>
            <button type="button" class="btn-chip" data-tpl-sec="movie">+ Film</button>
            <button type="button" class="btn-chip" data-tpl-sec="guide">+ Rehber</button>
          </div>
          <div id="categoriesList" class="editor-stack"></div>
        </div>
      </div>

      <div id="panelBoxes" class="admin-panel" hidden>
        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Sürpriz / Hediye Geri Sayım Kutucuğu (#gift)</h2>
              <p>Ana sayfadaki animasyonlu hediye kutucuğunun görünürlüğünü, hedef tarihini ve metinlerini yönetin.</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="cfgGiftEnabled" checked>
              <span>Kutucuk Aktif</span>
            </label>
          </div>
          <div class="field-stack">
            <div class="field-row">
              <label class="field">
                <span>Geri Sayım Üst Metni (leadText)</span>
                <input type="text" id="cfgGiftLead" class="inp glass" placeholder="Hediyenin açılmasına kalan süre">
              </label>
              <label class="field">
                <span>Hedef Tarih &amp; Saat (ISO 8601)</span>
                <input type="text" id="cfgGiftTarget" class="inp glass" placeholder="2026-10-27T00:00:00+03:00">
              </label>
              <label class="field">
                <span>Tarih Alt Etiketi (dateLabel)</span>
                <input type="text" id="cfgGiftDateLabel" class="inp glass" placeholder="27 Ekim 2026 · 00.00 (TSİ)">
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>Süre Dolduğunda Başlık</span>
                <input type="text" id="cfgGiftExpLead" class="inp glass" placeholder="Hediyenin açılma zamanı geldi">
              </label>
              <label class="field">
                <span>Süre Dolduğunda Alt Metin</span>
                <input type="text" id="cfgGiftExpSub" class="inp glass" placeholder="Az sonra burada olacak.">
              </label>
              <label class="field">
                <span>Süre Dolduğunda Bağlantı URL (İsteğe bağlı)</span>
                <input type="text" id="cfgGiftExpUrl" class="inp glass" placeholder="https://...">
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>Gün Etiketi</span>
                <input type="text" id="cfgGiftUnitD" class="inp glass" placeholder="Gün">
              </label>
              <label class="field">
                <span>Saat Etiketi</span>
                <input type="text" id="cfgGiftUnitH" class="inp glass" placeholder="Saat">
              </label>
              <label class="field">
                <span>Dakika Etiketi</span>
                <input type="text" id="cfgGiftUnitM" class="inp glass" placeholder="Dakika">
              </label>
              <label class="field">
                <span>Saniye Etiketi</span>
                <input type="text" id="cfgGiftUnitS" class="inp glass" placeholder="Saniye">
              </label>
            </div>
          </div>
        </div>

        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Özel Bilgi &amp; Duyuru Kutucukları (boxes)</h2>
              <p>Ana sayfaya duyuru, bilgi notu, durum kartı veya özel yönlendirme kutucukları ekleyin.</p>
            </div>
            <button type="button" class="btn-primary" id="addCustomBoxBtn">+ Özel Kutucuk Ekle</button>
          </div>
          <div id="customBoxesList" class="editor-stack"></div>
        </div>

        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Dış Bağlantı Kutucukları (links)</h2>
              <p>Ana sayfanın alt kısmındaki sosyal medya ve profil bağlantılarını düzenleyin.</p>
            </div>
            <button type="button" class="btn-primary" id="addLinkBtn">+ Yeni Bağlantı Ekle</button>
          </div>
          <div id="linksList" class="editor-stack"></div>
        </div>
      </div>

      <!-- ADIM 14: VERİ SAĞLIĞI DENETÇİSİ VE TEK TIKLA TAM YEDEKLEME / GERİ YÜKLEME MERKEZİ -->
      <div id="panelHealth" class="admin-panel" hidden>
        <div class="admin-card glass sq" id="commitRecoveryCard">
          <div class="card-head split-head">
            <div>
              <h2>🕰️ GitHub Commit Geçmişinden Kategori ve Puan Kurtarma</h2>
              <p>Yeni ZIP yüklemesi sonrasında üzerine yazılan <code>data/anime.json</code> (veya <code>data/sections.json</code>) verilerinizi, GitHub reponuzdaki önceki commit'lerden tek tıkla geri yükleyin veya birleştirin.</p>
            </div>
            <div class="form-actions" style="margin:0">
              <select id="commitHistoryFileSelect" class="inp glass" style="width:auto;min-width:165px;font-weight:650">
                <option value="data/anime.json">📺 data/anime.json</option>
                <option value="data/sections.json">⚙️ data/sections.json</option>
                <option value="data/overrides.json">🔧 data/overrides.json</option>
              </select>
              <button type="button" class="btn-primary" id="fetchCommitHistoryBtn">🕰️ Repondaki Son Commit'leri Listele</button>
            </div>
          </div>
          <div id="commitHistoryList" class="editor-stack">
            <p class="help-txt" style="margin:0">Yukarıdaki <b>"Repondaki Son Commit'leri Listele"</b> butonuna tıkladığınızda GitHub deponuzdaki son commit'ler tarih ve saatleriyle aşağıda listelenir. 1 saat önceki commit'inizin yanındaki <b>"Kategorileri &amp; Puanları Kurtar"</b> butonuna basmanız yeterlidir.</p>
          </div>
        </div>

        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Veri Sağlığı Denetçisi (Eksik Veri &amp; Devam Sezonu Taraması)</h2>
              <p>Seçili bölümdeki kategorisi eksik, puanı girilmemiş, kapak URL'si olmayan veya yeni sezonu çıkmış yapımları tespit edip tek tıkla <b>⚡ Hızlı Sıralı Düzenleme</b> kuyruğuna aktarır.</p>
            </div>
            <div class="form-actions" style="margin:0">
              <select id="healthSectionSelect" class="inp glass" style="width:auto;min-width:170px;font-weight:650">
                <option value="anime">📺 Anime Verileri</option>
                <option value="series">🎬 Dizi Verileri</option>
                <option value="movie">🍿 Film Verileri</option>
                <option value="manga">📖 Manga Verileri</option>
                <option value="book">📚 Kitap Verileri</option>
                <option value="guide">🧭 Rehber Kataloğu</option>
              </select>
              <button type="button" class="btn-subtle" id="refreshHealthBtn">Denetimi Yenile</button>
            </div>
          </div>
          <div id="healthAuditGrid" class="health-grid"></div>
        </div>

        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Tek Tıkla Tam Yedekleme (Snapshot) ve Geri Yükleme Merkezi</h2>
              <p>Sitedeki tüm JSON dosyalarını (<code>sections</code>, <code>anime</code>, <code>overrides</code>, <code>series</code>, <code>movies</code>, <code>manga</code>, <code>books</code>, <code>guides</code>) tek bir tarihli yedek paketinde indirin veya mevcut bir yedeği geri yükleyin.</p>
            </div>
            <button type="button" class="btn-primary" id="exportFullSnapshotBtn">📦 Tüm Site Verilerini Tek Pakette İndir (.json)</button>
          </div>
          <div class="field-row align-end">
            <label class="field" style="flex:2">
              <span>Yedek Paketi Dosyası Seç (<code>tempestian-backup-*.json</code>)</span>
              <input type="file" id="importSnapshotFile" accept=".json,application/json" class="inp glass file-inp">
            </label>
            <button type="button" class="btn-secondary" id="restoreSnapshotBtn">📂 Yedeği Geri Yükle ve Uygula</button>
          </div>
          <div id="snapshotSummaryBox" class="status-banner ok" hidden></div>
        </div>
      </div>

      <div id="panelSecurity" class="admin-panel" hidden>
        <div class="card-grid">
          <div class="admin-card glass sq">
            <div class="card-head">
              <h2>GitHub API &amp; Oturum Ayarları</h2>
              <p>Değişiklikleri tek tıkla depoya göndermek için GitHub Fine-Grained PAT bilginizi güncelleyebilirsiniz.</p>
            </div>
            <div class="field-stack">
              <div class="field-row">
                <label class="field">
                  <span>Repo Sahibi</span>
                  <input type="text" id="secRepoOwner" class="inp glass" value="tempestian">
                </label>
                <label class="field">
                  <span>Repo Adı</span>
                  <input type="text" id="secRepoName" class="inp glass" value="tempestian.github.io">
                </label>
                <label class="field">
                  <span>Dal (Branch)</span>
                  <input type="text" id="secBranch" class="inp glass" value="main">
                </label>
              </div>
              <label class="field">
                <span>GitHub Fine-Grained Token (PAT)</span>
                <input type="password" id="secPatInput" class="inp glass" placeholder="Değiştirmek için yeni token girin">
              </label>
              <div class="form-actions">
                <button type="button" class="btn-primary" id="saveSecTokenBtn">Token ve Repo Bilgisini Güncelle</button>
              </div>
            </div>
          </div>

          <div class="admin-card glass sq">
            <div class="card-head">
              <h2>Google Authenticator &amp; Şifreli Kasa Yedeği</h2>
              <p>Aktif Google Authenticator QR kodunuzu görüntüleyin veya çoklu cihaz için AES-256-GCM şifreli kasa oluşturun.</p>
            </div>
            <div id="activeQrSection" class="qr-card glass" hidden>
              <div id="secQrContainer" class="qr-box"></div>
              <div class="qr-meta">
                <span class="qr-label">Aktif Google Authenticator Anahtarı:</span>
                <code id="secTotpSecret" class="secret-code"></code>
              </div>
            </div>
            <div class="field-stack">
              <label class="field">
                <span>Taşınabilir Kasa Parolası (admin-vault.json için)</span>
                <input type="password" id="exportVaultPass" class="inp glass" placeholder="Şifreli yedek parolası belirleyin">
              </label>
              <div class="form-actions wrap-actions">
                <button type="button" class="btn-subtle" id="toggleSecQrBtn">Google Authenticator QR Göster/Gizle</button>
                <button type="button" class="btn-subtle" id="downloadVaultBtn">Şifreli Kasayı İndir (.vault.json)</button>
                <button type="button" class="btn-secondary" id="commitVaultToRepoBtn">Şifreli Kasayı Repoya Mühürle</button>
                <button type="button" class="btn-danger" id="resetDeviceVaultBtn">Cihaz Eşleşmesini Sil</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ADIM 5, 7 & 8: ANİME EKLEME / DÜZENLEME MODALI -->
      <div id="animeEditModal" class="adm-modal" role="dialog" aria-modal="true" aria-labelledby="animeModalTitle" hidden>
        <div class="adm-modal-bg" id="animeModalBg"></div>
        <div class="adm-modal-card sq">
          <div class="adm-modal-head">
            <h3 id="animeModalTitle">Anime Düzenle</h3>
            <button type="button" class="btn glass" id="closeAnimeModalBtn" aria-label="Kapat">✕</button>
          </div>

          <div class="anime-edit-top">
            <div class="anime-edit-cover"><img id="aeCoverPreview" alt=""></div>
            <div class="field-stack">
              <div class="field-row">
                <label class="field" style="flex:2">
                  <span id="aeTitleFieldLabel">Anime Başlığı (title)</span>
                  <input type="text" id="aeTitle" class="inp glass" placeholder="Örn: Solo Leveling" required>
                </label>
                <label class="field" id="aeAnilistIdFieldWrap">
                  <span id="aeAnilistIdFieldLabel">Çözümlenen AniList ID</span>
                  <input type="number" id="aeAnilistId" class="inp glass" placeholder="Örn: 151807">
                </label>
              </div>
              <div class="field-row align-end">
                <label class="field" style="flex:2">
                  <span id="aeUrlFieldLabel">İlk Sezonun AniList Linki (URL)</span>
                  <input type="text" id="aeFirstSeasonUrl" class="inp glass" placeholder="https://anilist.co/anime/101280/... veya IMDb tt...">
                  <small id="aeUrlFieldHint">Animenin 1. sezonunun AniList URL'sini (Dizi/Film için IMDb linkini, Kitap için OpenLibrary/ISBN bilgisini) girin.</small>
                </label>
                <label class="field" id="aeExtraMetaWrap" hidden>
                  <span id="aeExtraMetaLabel">Yazar / Yönetmen / Kanal</span>
                  <input type="text" id="aeExtraMetaInput" class="inp glass" placeholder="">
                </label>
                <button type="button" class="btn-secondary" id="fetchAnilistMetaBtn" title="Dış katalogdan kapak görseli URL'sini ve sezon/bölüm yapısını (genel puan hariç) çeker">Linkten Kapak &amp; Bilgileri Çek</button>
              </div>
              <label class="field">
                <span>Kapak Görseli URL veya Yolu</span>
                <input type="text" id="aeImage" class="inp glass" placeholder="https://s4.anilist.co/... veya assets/img/...">
              </label>
              <div class="field-row">
                <label class="field">
                  <span>Genel Durum</span>
                  <select id="aeStatus" class="inp glass">
                    <option value="auto">Otomatik (Parçalardan Hesapla)</option>
                    <option value="watching">İzleniyor</option>
                    <option value="completed">İzlendi</option>
                    <option value="paused">Beklemede</option>
                    <option value="dropped">Bırakıldı</option>
                    <option value="planned">Planlandı</option>
                  </select>
                </label>
                <label class="field">
                  <span>Devam Edilecek Etiketi</span>
                  <select id="aeNext" class="inp glass">
                    <option value="auto">Otomatik</option>
                    <option value="yes">Evet (Devam edilecek)</option>
                    <option value="no">Hayır</option>
                  </select>
                </label>
                <label class="field">
                  <span>Eklenme Tarihi</span>
                  <input type="date" id="aeAddedAt" class="inp glass">
                </label>
                <div class="field" style="align-self:end">
                  <button type="button" class="fav-toggle-btn" id="aeFavoriteBtn" style="height:42px;justify-content:center">☆ Başyapıt / Favori</button>
                </div>
              </div>
            </div>
          </div>

          <!-- ADIM 7 & 8: AĞIRLIKLI SEZON / FİLM / YAN İÇERİK PUANLAMA ÖZETİ -->
          <div class="score-studio" id="aeScoreStudioWrap">
            <div class="score-studio-top">
              <div>
                <h4 id="aeScoreStudioHeading">Ağırlıklı Otomatik Puanlama (Sezon ×1.00 · Film ×0.35 · Yan İçerik ×0.15)</h4>
                <p class="meta" id="aeScoreStudioSub">Aşağıdaki sezon, film ve yan içerik kartlarına girdiğiniz puanlar ağırlıklarına göre genel puanı otomatik belirler.</p>
              </div>
              <div class="score-badge-big" id="aeWeightedScoreDisplay">Puansız</div>
            </div>
            <div class="field-row align-end">
              <label class="field" style="flex:2">
                <span id="aeQuickScoreLabel">Tüm İzlenen Parçalara Hızlı Puan Ata (İsteğe Bağlı Kısayol)</span>
                <div id="aeQuickScoreChips" class="template-chips"></div>
              </label>
            </div>
          </div>

          <!-- ADIM 7 & 8: TÜR / KATEGORİ ÖZELLEŞTİRME STÜDYOSU -->
          <div class="genre-studio">
            <div class="split-head">
              <div>
                <h4>Özel Tür &amp; Kategori Seçimi (İstatistiklerde Yalnızca Seçtikleriniz Gösterilir)</h4>
                <p class="meta" id="aeGenreStudioSub">Otomatik türler yerine kendi kategorilerinizi seçin veya yeni kategori tanımlayın.</p>
              </div>
              <div class="form-actions" style="margin:0">
                <button type="button" class="btn-subtle" id="clearGenresBtn">Seçili Kategorileri Temizle</button>
              </div>
            </div>

            <div id="aeGenreGroupsContainer" class="field-stack"></div>

            <div class="field-row align-end">
              <label class="field" style="flex:2">
                <span id="aeGenresInputLabel">Bu İçerik İçin Seçtiğiniz Kategoriler (Virgülle ayırarak da yazabilirsiniz)</span>
                <input type="text" id="aeGenresInput" class="inp glass" placeholder="Örn: Bilim Kurgu, Fantastik, Dram...">
              </label>
              <label class="field">
                <span>Kataloğa Yeni Kategori Ekle</span>
                <input type="text" id="newCustomGenreInp" class="inp glass" placeholder="Örn: Felsefi, Siberpunk...">
              </label>
              <button type="button" class="btn-secondary" id="addCustomGenreToCatalogBtn">+ Kataloğa Ekle</button>
            </div>
          </div>

          <div class="field-stack" id="aePartsSectionWrap">
            <div class="split-head">
              <div>
                <h4 id="aePartsSectionHeading">Bağlantılı İçerikler / Parçalar (Sezon, Film, Yan İçerik / OVA)</h4>
                <p class="meta" id="aePartsSectionSub">Her sezon, film veya yan içeriğin ilerlemesini ve puanını buradan girin; genel puan ağırlıklı olarak otomatik hesaplanır.</p>
              </div>
              <button type="button" class="btn-secondary" id="addPartBtn">+ Parça Ekle</button>
            </div>
            <div id="aePartsList" class="editor-stack"></div>
          </div>

          <div class="form-actions" style="justify-content:space-between">
            <button type="button" class="btn-danger" id="deleteAnimeModalBtn">Animeyi Listeden Sil</button>
            <div class="form-actions" style="margin:0">
              <button type="button" class="btn-subtle" id="cancelAnimeModalBtn">Vazgeç</button>
              <button type="button" class="btn-primary" id="saveAnimeModalBtn">Animeyi Kaydet</button>
            </div>
          </div>
        </div>
      </div>
    `;
    bindDashboardEvents();
  }

  function normalizeConfig(raw) {
    const merged = structuredClone(DEFAULT_CONFIG);
    if (!raw || typeof raw !== 'object') return merged;
    if (raw.site && typeof raw.site === 'object') Object.assign(merged.site, raw.site);
    if (raw.gift && typeof raw.gift === 'object') {
      Object.assign(merged.gift, raw.gift);
      merged.gift.units = { ...DEFAULT_CONFIG.gift.units, ...(raw.gift.units || {}) };
    }
    if (Array.isArray(raw.boxes)) merged.boxes = raw.boxes;
    if (Array.isArray(raw.sections)) merged.sections = raw.sections;
    if (Array.isArray(raw.links)) merged.links = raw.links;
    if (raw.pages && raw.pages.anime) {
      merged.pages.anime = { ...DEFAULT_CONFIG.pages.anime, ...raw.pages.anime };
    }
    return merged;
  }

  async function loadAllData() {
    let rawCfg = null;
    try {
      const preview = localStorage.getItem('tp_site_preview');
      if (preview) {
        rawCfg = JSON.parse(preview);
        const clr = $('#clearPreviewBtn');
        if (clr) clr.hidden = false;
      }
    } catch (e) {}
    if (!rawCfg) {
      try {
        const res = await fetch(root + 'data/sections.json', { cache: 'no-store' });
        if (res.ok) rawCfg = await res.json();
      } catch (e) {}
    }
    state.config = normalizeConfig(rawCfg);

    let rawAnime = null;
    try {
      const prevAnime = localStorage.getItem('tp_anime_preview');
      if (prevAnime) {
        rawAnime = JSON.parse(prevAnime);
        const clr = $('#clearPreviewBtn');
        if (clr) clr.hidden = false;
      }
    } catch (e) {}
    if (!rawAnime) {
      try {
        const res = await fetch(root + 'data/anime.json', { cache: 'no-store' });
        if (res.ok) rawAnime = await res.json();
      } catch (e) {}
    }
    if (rawAnime && Array.isArray(rawAnime.anime)) {
      for (const a of rawAnime.anime) {
        const parsed = parseAnilistUrlOrId(a.firstSeasonUrl || a.url || a.anilistId || a.id);
        if (parsed.id) {
          a.anilistId = parsed.id;
          if (!a.firstSeasonUrl) a.firstSeasonUrl = parsed.url;
          if (!a.url) a.url = parsed.url;
        }
        // Mevcut puanların boşlukta kalmaması için, üst düzey puanı olup parçalarında henüz puan olmayan
        // animelerin tamamlanmış ana sezonlarına başlangıç puanını miras bırak:
        if (a.score != null && Array.isArray(a.parts)) {
          const anyPartScored = a.parts.some(p => p && p.score != null && Number(p.score) > 0);
          if (!anyPartScored) {
            const doneSeasons = a.parts.filter(p => p && p.kind === 'season' && p.status === 'COMPLETED');
            const targets = doneSeasons.length ? doneSeasons : a.parts.filter(p => p && p.status === 'COMPLETED');
            for (const p of targets) p.score = Number(a.score);
          }
          a.score = resolveEffectiveScore(a);
        }
      }
      state.animeData = {
        ...rawAnime,
        statsConfig: { ...DEFAULT_STATS_CONFIG, ...(rawAnime.statsConfig || {}), animeCountRule: 'completed_season_or_movie', includeInProgressEpisodes: true, genreSourceRule: 'custom_only' },
        customGenreCatalog: Array.isArray(rawAnime.customGenreCatalog) ? rawAnime.customGenreCatalog : []
      };
      state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
    }

    let rawOv = null;
    try {
      const res = await fetch(root + 'data/overrides.json', { cache: 'no-store' });
      if (res.ok) rawOv = await res.json();
    } catch (e) {}
    state.overrides = {
      exclude: Array.isArray(rawOv && rawOv.exclude) ? rawOv.exclude : [],
      titles: (rawOv && typeof rawOv.titles === 'object' && rawOv.titles) ? { ...rawOv.titles } : {},
      merge: (rawOv && typeof rawOv.merge === 'object' && rawOv.merge) ? { ...rawOv.merge } : {},
      noContinue: Array.isArray(rawOv && rawOv.noContinue) ? [...rawOv.noContinue] : [],
      deletedIds: Array.isArray(rawOv && rawOv.deletedIds) ? [...rawOv.deletedIds] : []
    };

    // Adım 12: Dizi, Film, Manga ve Kitap veri dosyalarını yükle
    let prevMulti = {};
    try { prevMulti = JSON.parse(localStorage.getItem('tp_multimedia_preview') || '{}') || {}; } catch (e) {}
    for (const mType of ['series', 'movie', 'manga', 'book', 'guide']) {
      const adapter = CONTENT_ADAPTER_REGISTRY[mType];
      if (!adapter) continue;
      let rawM = prevMulti[mType] || null;
      if (!rawM) {
        try {
          const r = await fetch(root + adapter.dataFile, { cache: 'no-store' });
          if (r.ok) rawM = await r.json();
        } catch (e) {}
      }
      const items = (rawM && (rawM[adapter.countKey] || rawM.items)) || [];
      state.multiMediaStore[mType] = {
        items,
        customGenreCatalog: Array.isArray(rawM && rawM.customGenreCatalog) ? rawM.customGenreCatalog : [],
        stats: computeStatsClient(items, state.animeData.statsConfig),
        dirty: false
      };
    }

    populateEditorFields();
    renderAnimeAdminPanel();
    renderOverridesEditor();
    state.dirtyConfig = false;
    state.dirtyAnime = false;
    state.dirtyOverrides = false;
    updateDirtyIndicator();
  }

  function renderAnimeAdminPanel() {
    const statsBar = $('#animeStatsSummary');
    const listEl = $('#animeAdminList');
    if (!statsBar || !listEl) return;

    const adapter = getActiveAdminAdapter();
    const list = adapter.getItems();
    const S = computeStatsClient(list, state.animeData.statsConfig);
    if (adapter.id === 'anime') state.animeData.stats = S;
    else if (state.multiMediaStore[adapter.id]) state.multiMediaStore[adapter.id].stats = S;
    const SECTION_UI_META = {
      anime: {
        panelTitle: 'Anime Verileri, Ağırlıklı Puanlama ve Özel Kategori Yönetimi',
        panelSub: 'Sezon (<b>×1.00</b>), Film (<b>×0.35</b>) ve Yan İçerik (<b>×0.15</b>) puanlarınız genel anime puanını otomatik belirler. İstatistiklerde yalnızca sizin seçtiğiniz özel kategoriler yer alır.',
        searchLabel: 'Anime Ara (Başlık, Özel Kategori, ID veya AniList URL)',
        searchPlaceholder: 'Örn: Slime, Isekai, Seinen, 101280...',
        emptyText: 'Filtreye uygun anime bulunamadı.',
        totalLabel: 'Listedeki Anime',
        consumedLabel: 'İzlenen Anime',
        seasonLabel: 'Bitmiş Sezon',
        filmLabel: 'Bitmiş Film',
        unitStatLabel: 'İzlenen Bölüm',
        rowUnitText: 'izlenen bölüm',
        plusBtnText: '+1 Bölüm'
      },
      series: {
        panelTitle: 'Dizi Verileri, Ağırlıklı Sezon Puanlaması ve Özel Kategori Yönetimi',
        panelSub: 'Sezon (<b>×1.00</b>), Film (<b>×0.35</b>) ve Özel Bölüm (<b>×0.15</b>) puanlarınız genel dizi puanını otomatik belirler. Kapak ve sezon bilgileri IMDb üzerinden çekilebilir.',
        searchLabel: 'Dizi Ara (Başlık, Özel Kategori, Kanal veya IMDb ID)',
        searchPlaceholder: 'Örn: Breaking Bad, Severance, Bilim Kurgu, tt0903747...',
        emptyText: 'Filtreye uygun dizi bulunamadı.',
        totalLabel: 'Listedeki Dizi',
        consumedLabel: 'İzlenen Dizi',
        seasonLabel: 'Bitmiş Sezon',
        filmLabel: 'Özel / Film',
        unitStatLabel: 'İzlenen Bölüm',
        rowUnitText: 'izlenen bölüm',
        plusBtnText: '+1 Bölüm'
      },
      movie: {
        panelTitle: 'Film Verileri, Kişisel Puanlama ve Özel Kategori Yönetimi',
        panelSub: 'İzlediğiniz filmleri, kişisel puanlarınızı, başyapıt/favori seçimlerinizi ve özel kategorilerinizi yönetin. Kapak ve yıl bilgileri IMDb üzerinden çekilebilir.',
        searchLabel: 'Film Ara (Başlık, Özel Kategori, Yönetmen veya IMDb ID)',
        searchPlaceholder: 'Örn: Interstellar, Oppenheimer, Bilim Kurgu, tt0816692...',
        emptyText: 'Filtreye uygun film bulunamadı.',
        totalLabel: 'Listedeki Film',
        consumedLabel: 'İzlenen Film',
        seasonLabel: 'Seri / Ana Film',
        filmLabel: 'Bitmiş Film',
        unitStatLabel: 'Toplam İzlenen',
        rowUnitText: 'izlenen film',
        plusBtnText: '+1 Film'
      },
      manga: {
        panelTitle: 'Manga Verileri, Cilt/Bölüm Takibi ve Özel Kategori Yönetimi',
        panelSub: 'Okuduğunuz mangaları, bölüm ilerlemenizi, kişisel puanlarınızı ve özel kategorilerinizi yönetin. Kapak ve meta veriler AniList üzerinden çekilebilir.',
        searchLabel: 'Manga Ara (Başlık, Özel Kategori, Yazar veya AniList URL)',
        searchPlaceholder: 'Örn: Berserk, Vagabond, Seinen, 30002...',
        emptyText: 'Filtreye uygun manga bulunamadı.',
        totalLabel: 'Listedeki Manga',
        consumedLabel: 'Okunan Manga',
        seasonLabel: 'Bitmiş Seri / Cilt',
        filmLabel: 'Yan Hikaye / Özel',
        unitStatLabel: 'Okunan Bölüm',
        rowUnitText: 'okunan bölüm',
        plusBtnText: '+1 Bölüm'
      },
      book: {
        panelTitle: 'Kitap Verileri, Sayfa/Cilt Takibi ve Özel Kategori Yönetimi',
        panelSub: 'Okuduğunuz kitapları, sayfa ilerlemenizi, kişisel puanlarınızı ve özel kategorilerinizi yönetin. Kapak ve yazar bilgileri OpenLibrary üzerinden çekilebilir.',
        searchLabel: 'Kitap Ara (Kitap Adı, Özel Kategori, Yazar veya ISBN)',
        searchPlaceholder: 'Örn: Dune, Vakıf, Bilim Kurgu, Frank Herbert...',
        emptyText: 'Filtreye uygun kitap bulunamadı.',
        totalLabel: 'Listedeki Kitap',
        consumedLabel: 'Okunan Kitap',
        seasonLabel: 'Bitmiş Kitap / Cilt',
        filmLabel: 'Ek Materyal',
        unitStatLabel: 'Okunan Sayfa',
        rowUnitText: 'okunan sayfa',
        plusBtnText: '+1 Sayfa'
      },
      guide: {
        panelTitle: 'Technopat Sosyal Rehber Kataloğu ve Kategori Yönetimi',
        panelSub: 'Sitenizde katalog olarak listelenen ve tıklandığında Technopat Sosyal konularınıza yönlendiren rehberlerinizi yönetin.',
        searchLabel: 'Rehber Ara (Başlık, Kategori, Özet veya Technopat URL)',
        searchPlaceholder: 'Örn: Linux, Arch, Windows 11, Donanım...',
        emptyText: 'Filtreye uygun rehber bulunamadı.',
        totalLabel: 'Listedeki Rehber',
        consumedLabel: 'Yayındaki Rehber',
        seasonLabel: 'Makale / Konu',
        filmLabel: 'Ek Rehber',
        unitStatLabel: 'Toplam Rehber',
        rowUnitText: 'bölüm/konu',
        plusBtnText: '+1'
      }
    };
    const uiMeta = SECTION_UI_META[adapter.id] || SECTION_UI_META.anime;

    if ($('#admMediaTypeSelect') && $('#admMediaTypeSelect').value !== adapter.id) {
      $('#admMediaTypeSelect').value = adapter.id;
    }
    if ($('#admPanelMainTitle')) $('#admPanelMainTitle').textContent = uiMeta.panelTitle;
    if ($('#admPanelMainSub')) $('#admPanelMainSub').innerHTML = uiMeta.panelSub;
    if ($('#admAnimeSearchLabel')) $('#admAnimeSearchLabel').textContent = uiMeta.searchLabel;
    if ($('#admAnimeSearch')) $('#admAnimeSearch').placeholder = uiMeta.searchPlaceholder;

    const stFilterEl = $('#admAnimeStatusFilter');
    if (stFilterEl && Array.isArray(adapter.statusOptions)) {
      const prevSt = state.animeFilterStatus || 'all';
      const dynamicOptions = [
        ['all', 'Tüm Durumlar'],
        ...adapter.statusOptions,
        ...(adapter.supportsNextBadge ? [['next', 'Devam Edilecekler']] : []),
        ['fav', adapter.id === 'guide' ? '★ Öne Çıkan Rehberler' : '★ Başyapıtlar / Favoriler']
      ];
      const sig = dynamicOptions.map(x => `${x[0]}:${x[1]}`).join('|');
      if (stFilterEl.dataset.sig !== sig) {
        stFilterEl.dataset.sig = sig;
        stFilterEl.innerHTML = dynamicOptions.map(([val, lbl]) => `<option value="${val}">${lbl}</option>`).join('');
        stFilterEl.value = dynamicOptions.some(([val]) => val === prevSt) ? prevSt : 'all';
        state.animeFilterStatus = stFilterEl.value;
      }
    }

    if ($('#addNewAnimeBtn')) $('#addNewAnimeBtn').textContent = `+ Yeni ${adapter.label} Ekle`;
    if ($('#downloadAnimeJsonBtn')) $('#downloadAnimeJsonBtn').textContent = `${adapter.id === 'anime' ? 'anime' : adapter.countKey}.json İndir`;
    if ($('#scanAllRelationsBtn')) $('#scanAllRelationsBtn').hidden = adapter.id !== 'anime';
    const trigBtn = $('#triggerActionsBtn');
    if (trigBtn) {
      trigBtn.hidden = !(adapter.id === 'anime' || adapter.id === 'guide');
      if (!trigBtn.disabled) {
        if (adapter.id === 'guide') {
          trigBtn.textContent = "🔄 Technopat'tan Rehberleri Çek (GitHub Actions)";
          trigBtn.title = "Sadece siz tıkladığınızda çalışır: Technopat Sosyal'de Bayram Tempestian (#657641) tarafından açılan 'Rehber' ön ekli tüm konuları GitHub Actions ile çekip listeler";
        } else {
          trigBtn.textContent = 'GitHub Actions Çalıştır';
          trigBtn.title = 'GitHub Actions üzerindeki sync-anilist.yml iş akışını tetikler';
        }
      }
    }
    if ($('#toggleOverridesBtn')) $('#toggleOverridesBtn').hidden = adapter.id !== 'anime';
    if (adapter.id !== 'anime' && $('#overridesEditorSection')) $('#overridesEditorSection').hidden = true;

    const categorizedCount = list.filter(a => Array.isArray(a.customGenres) && a.customGenres.length > 0).length;
    const topGenreLabel = S.genres && S.genres.length ? `${S.genres[0].name} (${S.genres[0].count})` : 'Henüz seçilmedi';

    if (adapter.id === 'guide') {
      const publishedCount = list.filter(a => (a.status || 'completed') === 'completed').length;
      statsBar.innerHTML = `
        <div class="adm-stat-pill"><b>${list.length}</b><span>${uiMeta.totalLabel}</span></div>
        <div class="adm-stat-pill"><b>${publishedCount}</b><span>${uiMeta.consumedLabel}</span></div>
        <div class="adm-stat-pill"><b>★ ${S.favorites || 0}</b><span>Öne Çıkan Rehber</span></div>
        <div class="adm-stat-pill"><b>${topGenreLabel}</b><span>Lider Kategori</span></div>
        <div class="adm-stat-pill"><b>${categorizedCount} / ${list.length}</b><span>Kategorisi Seçilen</span></div>
      `;
    } else if (adapter.id === 'movie') {
      statsBar.innerHTML = `
        <div class="adm-stat-pill"><b>${list.length}</b><span>${uiMeta.totalLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.anime || 0}</b><span>${uiMeta.consumedLabel}</span></div>
        <div class="adm-stat-pill"><b>${(S.film || 0) + (S.season || 0)}</b><span>${uiMeta.filmLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.episodes || 0}</b><span>${uiMeta.unitStatLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.avgScore ?? '-'}</b><span>Ort. Puan</span></div>
        <div class="adm-stat-pill"><b>★ ${S.favorites || 0}</b><span>Başyapıt / Favori</span></div>
        <div class="adm-stat-pill"><b>${topGenreLabel}</b><span>Lider Kategori</span></div>
        <div class="adm-stat-pill"><b>${categorizedCount} / ${list.length}</b><span>Kategorisi Seçilen</span></div>
      `;
    } else {
      statsBar.innerHTML = `
        <div class="adm-stat-pill"><b>${list.length}</b><span>${uiMeta.totalLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.anime || 0}</b><span>${uiMeta.consumedLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.season || 0}</b><span>${uiMeta.seasonLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.film || 0}</b><span>${uiMeta.filmLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.episodes || 0}</b><span>${uiMeta.unitStatLabel}</span></div>
        <div class="adm-stat-pill"><b>${S.avgScore ?? '-'}</b><span>Ort. Puan</span></div>
        <div class="adm-stat-pill"><b>★ ${S.favorites || 0}</b><span>Başyapıt / Favori</span></div>
        <div class="adm-stat-pill"><b>${topGenreLabel}</b><span>Lider Kategori</span></div>
        <div class="adm-stat-pill"><b>${categorizedCount} / ${list.length}</b><span>Kategorisi Seçilen</span></div>
      `;
    }

    const q = state.animeFilterQ.trim().toLocaleLowerCase('tr');
    const stF = state.animeFilterStatus;
    const srcF = state.animeFilterSource;

    const filtered = list.filter(it => {
      const gText = resolveEffectiveGenres(it, 'custom_only').join(' ').toLocaleLowerCase('tr');
      if (q && !(it.title || '').toLocaleLowerCase('tr').includes(q) && !gText.includes(q) && !String(it.id || '').toLowerCase().includes(q) && !String(it.anilistId || '').includes(q) && !String(it.firstSeasonUrl || '').toLowerCase().includes(q)) return false;
      if (stF !== 'all') {
        if (stF === 'fav' && !it.favorite) return false;
        if (stF === 'next' && !it.next) return false;
        if (stF !== 'next' && stF !== 'fav' && it.status !== stF) return false;
      }
      if (srcF !== 'all') {
        const isManual = it.source === 'manual' || String(it.id).startsWith('custom-');
        const hasCustomGenres = Array.isArray(it.customGenres) && it.customGenres.length > 0;
        if (srcF === 'uncategorized' && hasCustomGenres) return false;
        if (srcF === 'categorized' && !hasCustomGenres) return false;
        if (srcF === 'manual' && !isManual) return false;
        if (srcF === 'modified' && !it.adminModified) return false;
      }
      return true;
    });

    listEl.replaceChildren();
    if (!filtered.length) {
      const p = document.createElement('p');
      p.className = 'help-txt';
      p.textContent = uiMeta.emptyText;
      listEl.append(p);
      return;
    }

    const statusLabelMap = Object.fromEntries(adapter.statusOptions || []);
    const fr = document.createDocumentFragment();
    for (const it of filtered) {
      const row = document.createElement('div');
      row.className = 'anime-adm-row';
      const isManual = it.source === 'manual' || String(it.id).startsWith('custom-');
      const normParts = normalizePartsForStats(it);
      const doneEps = normParts.reduce((n, p) => n + ((p.status !== 'NONE' && p.status !== 'PLANNING') ? (p.watched || 0) : 0), 0);
      const effScore = resolveEffectiveScore(it);
      const effGenres = resolveEffectiveGenres(it, 'custom_only');
      const activePart = findActiveTrackablePart(it);
      const firstUrl = it.firstSeasonUrl || it.url || (it.anilistId ? 'https://anilist.co/anime/' + it.anilistId : '');

      const activePartLabel = activePart
        ? `${activePart.name || 'Parça'}: ${activePart.watched || 0}${activePart.episodes ? '/' + activePart.episodes : ''}`
        : '';
      const statusText = statusLabelMap[it.status] || STATUS_LABELS[it.status] || it.status;
      const sourceBadgeText = isManual ? 'Elle Eklendi' : it.adminModified ? 'Admin Düzenlemeli' : (adapter.id === 'anime' || adapter.id === 'manga' ? 'AniList' : 'Katalog');

      row.innerHTML = `
        <img class="anime-adm-poster" alt="" loading="lazy">
        <div class="anime-adm-info">
          <div class="anime-adm-title">
            <span class="adm-row-t"></span>
            <span class="src-badge ${isManual ? 'manual' : it.adminModified ? 'modified' : ''}">${sourceBadgeText}</span>
            ${it.favorite ? `<span class="src-badge fav">★ ${adapter.id === 'guide' ? 'Öne Çıkan' : 'Başyapıt'}</span>` : ''}
            ${it.next ? '<span class="src-badge next">Devam edilecek</span>' : ''}
            <span class="adm-genre-pills"></span>
          </div>
          <div class="anime-adm-sub">
            <span>Durum: <b>${statusText}</b></span>
            ${adapter.id === 'guide' ? '' : `<span>Puan: <b>${effScore ? '★ ' + effScore : 'Puansız'}</b></span>`}
            ${adapter.id === 'guide' ? '' : `<span>Parça: <b>${(it.parts || []).length}</b> (${doneEps} ${uiMeta.rowUnitText})</span>`}
            ${activePartLabel && adapter.id !== 'guide' ? `<span class="adm-active-part">Aktif: <b></b></span>` : ''}
            <span class="adm-url-slot"></span>
          </div>
        </div>
        <div class="editor-item-actions">
          <button type="button" class="fav-toggle-btn adm-fav-btn ${it.favorite ? 'on' : ''}" title="Favori / Başyapıt olarak işaretle">${it.favorite ? (adapter.id === 'guide' ? '★ Öne Çıkan' : '★ Başyapıt') : '☆'}</button>
          <button type="button" class="quick-ep-btn adm-plus-ep-btn" ${adapter.id === 'guide' ? 'hidden' : ''} title="Aktif parçaya +1 ilerleme ekler">${uiMeta.plusBtnText}</button>
          <button type="button" class="quick-ep-btn done adm-done-part-btn" ${adapter.id === 'guide' ? 'hidden' : ''} title="Aktif parçayı tamamlandı olarak işaretler">Tamamla</button>
          <button type="button" class="btn-subtle adm-edit-btn">Düzenle</button>
          <button type="button" class="icon-btn del adm-del-btn" title="Sil / Hariç Tut">✕</button>
        </div>
      `;
      const img = row.querySelector('.anime-adm-poster');
      if (it.image) img.src = resolvePreviewSrc(it.image);
      row.querySelector('.adm-row-t').textContent = it.title;
      const actPartEl = row.querySelector('.adm-active-part b');
      if (actPartEl) actPartEl.textContent = activePartLabel;

      const pillsWrap = row.querySelector('.adm-genre-pills');
      if (effGenres.length) {
        effGenres.slice(0, 4).forEach(g => {
          const sp = document.createElement('span');
          sp.className = 'genre-mini-pill';
          sp.textContent = g;
          pillsWrap.append(sp);
        });
      }

      const urlSlot = row.querySelector('.adm-url-slot');
      if (firstUrl) {
        const a = document.createElement('a');
        a.href = firstUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        if (adapter.id === 'guide') {
          a.textContent = `Technopat Konusu (${it.threadId ? '#' + it.threadId : 'Link'}) ↗`;
        } else if (adapter.id === 'series') {
          a.textContent = 'IMDb / Dizi Linki ↗';
        } else if (adapter.id === 'movie') {
          a.textContent = 'IMDb / Film Linki ↗';
        } else if (adapter.id === 'book') {
          a.textContent = 'Kitap Kaynak Linki ↗';
        } else if (adapter.id === 'manga') {
          a.textContent = `Manga Linki (${it.anilistId ? '#' + it.anilistId : 'URL'}) ↗`;
        } else {
          a.textContent = `1. Sezon Linki (#${it.anilistId || 'URL'})`;
        }
        a.style.color = 'var(--accent)';
        urlSlot.append(a);
      } else {
        urlSlot.textContent = 'Salt Yerel';
      }

      row.querySelector('.adm-fav-btn').onclick = () => quickToggleFavorite(it.id);
      row.querySelector('.adm-plus-ep-btn').onclick = () => quickIncrementEpisode(it.id, false);
      row.querySelector('.adm-done-part-btn').onclick = () => quickIncrementEpisode(it.id, true);
      row.querySelector('.adm-edit-btn').onclick = () => openAnimeEditor(it.id);
      row.querySelector('.adm-del-btn').onclick = () => deleteAnimeItem(it.id);
      fr.append(row);
    }
    listEl.append(fr);
  }

  function deleteAnimeItem(animeId) {
    const adapter = getActiveAdminAdapter();
    const list = adapter.getItems();
    const idx = list.findIndex(a => a.id === animeId);
    if (idx < 0) return;
    const target = list[idx];
    list.splice(idx, 1);
    if (adapter.id === 'anime') {
      if (target.anilistId && !state.overrides.exclude.includes(Number(target.anilistId))) {
        state.overrides.exclude.push(Number(target.anilistId));
        markDirty('overrides');
      }
      if (!state.overrides.deletedIds.includes(target.id)) {
        state.overrides.deletedIds.push(target.id);
        markDirty('overrides');
      }
      markDirty('anime');
      renderOverridesEditor();
    } else {
      ensureMultiMediaStore(adapter.id).dirty = true;
      updateDirtyIndicator();
    }
    renderAnimeAdminPanel();
    toast(`"${target.title}" listeden kaldırıldı.`);
  }

  function renderOverridesEditor() {
    const ov = state.overrides;
    const tList = $('#ovTitlesList');
    if (tList) {
      tList.replaceChildren();
      for (const [id, title] of Object.entries(ov.titles || {})) {
        const div = document.createElement('div');
        div.className = 'ov-item';
        div.innerHTML = `<span><b>#${id}</b> → <em></em></span><button type="button" class="icon-btn del">✕</button>`;
        div.querySelector('em').textContent = title;
        div.querySelector('button').onclick = () => {
          delete ov.titles[id];
          markDirty('overrides');
          renderOverridesEditor();
        };
        tList.append(div);
      }
    }
    const mList = $('#ovMergeList');
    if (mList) {
      mList.replaceChildren();
      for (const [fromId, toId] of Object.entries(ov.merge || {})) {
        const div = document.createElement('div');
        div.className = 'ov-item';
        div.innerHTML = `<span><b>#${fromId}</b> → Hedef <b>#${toId}</b></span><button type="button" class="icon-btn del">✕</button>`;
        div.querySelector('button').onclick = () => {
          delete ov.merge[fromId];
          markDirty('overrides');
          renderOverridesEditor();
        };
        mList.append(div);
      }
    }
    const ncList = $('#ovNoContList');
    if (ncList) {
      ncList.replaceChildren();
      (ov.noContinue || []).forEach((val, idx) => {
        const div = document.createElement('div');
        div.className = 'ov-item';
        div.innerHTML = `<span></span><button type="button" class="icon-btn del">✕</button>`;
        div.querySelector('span').textContent = String(val);
        div.querySelector('button').onclick = () => {
          ov.noContinue.splice(idx, 1);
          markDirty('overrides');
          renderOverridesEditor();
        };
        ncList.append(div);
      });
    }
    const exList = $('#ovExcludeList');
    if (exList) {
      exList.replaceChildren();
      (ov.exclude || []).forEach((val, idx) => {
        const div = document.createElement('div');
        div.className = 'ov-item';
        div.innerHTML = `<span>AniList ID: <b>#${val}</b></span><button type="button" class="icon-btn del">✕</button>`;
        div.querySelector('button').onclick = () => {
          ov.exclude.splice(idx, 1);
          markDirty('overrides');
          renderOverridesEditor();
        };
        exList.append(div);
      });
    }
  }

  function openAnimeEditor(animeId = '__new__') {
    const adapter = getActiveAdminAdapter();
    state.editingAnimeId = animeId;
    const isNew = animeId === '__new__';
    const existing = !isNew ? adapter.getItems().find(a => a.id === animeId) : null;

    const defaultPartName = adapter.id === 'movie'
      ? 'Ana Film'
      : adapter.id === 'book'
        ? '1. Kitap / Cilt'
        : adapter.id === 'manga'
          ? 'Ana Seri'
          : adapter.id === 'guide'
            ? 'Ana Rehber'
            : '1. Sezon';
    const defaultPartFormat = adapter.id === 'movie' ? 'MOVIE' : adapter.id === 'book' ? 'BOOK' : adapter.id === 'manga' ? 'MANGA' : adapter.id === 'guide' ? 'GUIDE' : 'TV';
    const defaultPartEps = adapter.id === 'movie' || adapter.id === 'guide' ? 1 : adapter.id === 'book' ? 300 : 12;

    state.editingDraft = existing ? structuredClone(existing) : {
      id: 'custom-' + Date.now(),
      title: '',
      anilistId: null,
      url: '',
      firstSeasonUrl: '',
      status: 'completed',
      score: null,
      genres: [],
      customGenres: [],
      image: '',
      addedAt: new Date().toISOString().slice(0, 10),
      source: 'manual',
      adminModified: true,
      lockedFields: ['title', 'status', 'score', 'genres', 'addedAt'],
      parts: [
        {
          id: 'part-' + Date.now(),
          name: defaultPartName,
          kind: adapter.id === 'movie' ? 'movie' : 'season',
          format: defaultPartFormat,
          episodes: defaultPartEps,
          watched: defaultPartEps,
          status: 'COMPLETED',
          release: 'FINISHED',
          year: new Date().getFullYear(),
          score: null,
          adminModified: true
        }
      ]
    };

    const d = state.editingDraft;
    const parsed = parseAnilistUrlOrId(d.firstSeasonUrl || d.url || d.anilistId || d.id);
    const initialUrl = d[adapter.externalUrlField || 'firstSeasonUrl'] || d.firstSeasonUrl || d.url || parsed.url || '';

    $('#animeModalTitle').textContent = isNew ? `Yeni ${adapter.label} Ekle` : `${adapter.label} Düzenle: ${d.title}`;
    if ($('#aeTitleFieldLabel')) $('#aeTitleFieldLabel').textContent = `${adapter.titleLabel || (adapter.label + ' Başlığı')} (title)`;
    if ($('#aeTitle')) {
      const titlePlaceholders = {
        anime: 'Örn: Solo Leveling',
        series: 'Örn: Breaking Bad',
        movie: 'Örn: Interstellar',
        manga: 'Örn: Berserk',
        book: 'Örn: Dune',
        guide: 'Örn: Arch Linux Kurulum Rehberi'
      };
      $('#aeTitle').placeholder = titlePlaceholders[adapter.id] || 'Başlık girin...';
    }
    if ($('#aeAnilistIdFieldWrap')) {
      $('#aeAnilistIdFieldWrap').hidden = !(adapter.id === 'anime' || adapter.id === 'manga');
    }
    if ($('#aeAnilistIdFieldLabel')) {
      $('#aeAnilistIdFieldLabel').textContent = adapter.id === 'manga' ? 'Çözümlenen AniList Manga ID' : 'Çözümlenen AniList ID';
    }
    $('#aeUrlFieldLabel').textContent = adapter.externalUrlLabel || 'Kaynak Linki (URL)';
    if ($('#aeFirstSeasonUrl')) {
      const urlPlaceholders = {
        anime: 'https://anilist.co/anime/101280/...',
        series: 'https://www.imdb.com/title/tt0903747/ veya tt0903747',
        movie: 'https://www.imdb.com/title/tt0816692/ veya tt0816692',
        manga: 'https://anilist.co/manga/30002/...',
        book: 'ISBN (Örn: 9789753638029) veya OpenLibrary URL',
        guide: 'https://www.technopat.net/sosyal/konu/...'
      };
      $('#aeFirstSeasonUrl').placeholder = urlPlaceholders[adapter.id] || 'https://...';
    }
    if ($('#aeUrlFieldHint')) {
      const urlHints = {
        anime: "Animenin 1. sezonunun AniList URL'sini girin; kapak ve bağlantılı sezon/filmler otomatik çekilir.",
        series: "Dizinin IMDb linkini veya tt... ID'sini girin; kapak ve sezon/bölüm yapısı otomatik çekilir.",
        movie: "Filmin IMDb linkini veya tt... ID'sini girin; yüksek çözünürlüklü afiş ve yıl bilgisi otomatik çekilir.",
        manga: "Manganın AniList URL'sini girin; kapak ve bölüm bilgileri otomatik çekilir.",
        book: "Kitabın ISBN numarasını veya adını girin; OpenLibrary üzerinden kapak ve yazar bilgisi çekilir.",
        guide: "Technopat Sosyal'deki rehber konunuzun tam bağlantısını girin."
      };
      $('#aeUrlFieldHint').textContent = urlHints[adapter.id] || '';
    }
    const fetchBtn = $('#fetchAnilistMetaBtn');
    if (fetchBtn) {
      fetchBtn.hidden = adapter.id === 'guide';
      fetchBtn.textContent = (adapter.id === 'series' || adapter.id === 'movie')
        ? "IMDb'den Kapak & Bilgi Çek"
        : adapter.id === 'book'
          ? "OpenLibrary'den Kapak & Bilgi Çek"
          : "Linkten Kapak & Bağlantılı İçerikleri Çek";
    }
    const exWrap = $('#aeExtraMetaWrap');
    if (adapter.extraMetaField) {
      exWrap.hidden = false;
      $('#aeExtraMetaLabel').textContent = adapter.extraMetaField.label;
      $('#aeExtraMetaInput').placeholder = adapter.extraMetaField.placeholder || '';
      $('#aeExtraMetaInput').value = d[adapter.extraMetaField.key] || '';
    } else {
      exWrap.hidden = true;
    }

    const aeStatusEl = $('#aeStatus');
    if (aeStatusEl && Array.isArray(adapter.statusOptions)) {
      aeStatusEl.innerHTML = [
        ['auto', 'Otomatik (Parçalardan Hesapla)'],
        ...adapter.statusOptions
      ].map(([val, lbl]) => `<option value="${val}">${lbl}</option>`).join('');
    }
    const nextFieldWrap = $('#aeNext')?.closest('.field');
    if (nextFieldWrap) nextFieldWrap.hidden = !adapter.supportsNextBadge;

    if ($('#aeScoreStudioWrap')) $('#aeScoreStudioWrap').hidden = adapter.id === 'guide';
    if ($('#aeScoreStudioHeading')) $('#aeScoreStudioHeading').textContent = adapter.subItemHeading || 'Ağırlıklı Otomatik Puanlama';
    if ($('#aeScoreStudioSub')) {
      const scoreStudioSubs = {
        anime: 'Aşağıdaki sezon, film ve yan içerik kartlarına girdiğiniz puanlar ağırlıklarına göre genel anime puanını otomatik belirler.',
        series: 'Aşağıdaki sezon ve özel bölüm kartlarına girdiğiniz puanlar ağırlıklarına göre genel dizi puanını otomatik belirler.',
        movie: 'Filme (veya seri filmlerine) verdiğiniz kişisel puan genel film puanını belirler.',
        manga: 'Cilt veya seri kısımlarına verdiğiniz puanlar genel manga puanını otomatik belirler.',
        book: 'Kitaba veya seri ciltlerine verdiğiniz puanlar genel kitap puanını otomatik belirler.'
      };
      $('#aeScoreStudioSub').textContent = scoreStudioSubs[adapter.id] || '';
    }
    if ($('#aeQuickScoreLabel')) {
      const quickScoreLabels = {
        anime: 'Tüm İzlenen Sezonlara Hızlı Puan Ata (İsteğe Bağlı Kısayol)',
        series: 'Tüm İzlenen Sezonlara Hızlı Puan Ata (İsteğe Bağlı Kısayol)',
        movie: 'Filme Hızlı Puan Ata (Kısayol)',
        manga: 'Okunan Kısımlara Hızlı Puan Ata (Kısayol)',
        book: 'Kitaba / Ciltlere Hızlı Puan Ata (Kısayol)'
      };
      $('#aeQuickScoreLabel').textContent = quickScoreLabels[adapter.id] || 'Hızlı Puan Ata';
    }
    if ($('#aeGenreStudioSub')) {
      const genreStudioSubs = {
        anime: 'AniList türleri yerine kendi kategorilerinizi (Shounen, Seinen, Isekai, Rom-Com vb.) seçin veya yeni kategori tanımlayın.',
        series: 'Dizinin kendi kategorilerini (Bilim Kurgu, Suç & Polisiye, Dram vb.) seçin veya yeni kategori tanımlayın.',
        movie: 'Filmin kendi kategorilerini (Bilim Kurgu, Aksiyon, Dram, Suç & Noir vb.) seçin veya yeni kategori tanımlayın.',
        manga: 'Manganın kendi kategorilerini (Seinen, Shounen, Karanlık Fantezi vb.) seçin veya yeni kategori tanımlayın.',
        book: 'Kitabın kendi kategorilerini (Bilim Kurgu, Felsefe, Klasik, Tarih vb.) seçin veya yeni kategori tanımlayın.',
        guide: 'Rehberin hangi konulara ait olduğunu (Linux & Sistem, Paket Yönetimi, Masaüstü & Özelleştirme, Donanım & Sürücü vb.) seçin veya yeni kategori tanımlayın.'
      };
      $('#aeGenreStudioSub').textContent = genreStudioSubs[adapter.id] || '';
    }
    if ($('#aeGenresInputLabel')) $('#aeGenresInputLabel').textContent = `Bu ${adapter.label} İçin Seçtiğiniz Kategoriler (Virgülle ayırarak da yazabilirsiniz)`;
    if ($('#aeGenresInput')) {
      const genrePlaceholders = {
        anime: 'Örn: Shounen, Isekai, Fantastik, Rom-Com',
        series: 'Örn: Bilim Kurgu, Suç & Polisiye, Dram',
        movie: 'Örn: Bilim Kurgu, Aksiyon, Dram',
        manga: 'Örn: Seinen, Karanlık Fantezi, Aksiyon',
        book: 'Örn: Bilim Kurgu, Felsefe, Klasik',
        guide: 'Örn: Linux & Sistem, Paket Yönetimi, Masaüstü & Özelleştirme'
      };
      $('#aeGenresInput').placeholder = genrePlaceholders[adapter.id] || 'Kategorileri virgülle ayırın...';
    }
    if ($('#aePartsSectionWrap')) $('#aePartsSectionWrap').hidden = adapter.id === 'guide';
    if ($('#aePartsSectionHeading')) {
      const partHeadings = {
        anime: 'Bağlantılı İçerikler / Parçalar (Sezon, Film, Yan İçerik / OVA)',
        series: 'Dizi Sezonları ve Özel Bölümler',
        movie: 'Film / Seri Parçaları ve Puanlama',
        manga: 'Manga Ciltleri / Kısımları ve Okunan Bölüm Takibi',
        book: 'Kitap / Seri Ciltleri ve Okunan Sayfa Takibi'
      };
      $('#aePartsSectionHeading').textContent = partHeadings[adapter.id] || 'Alt Parçalar ve Puanlama';
    }
    if ($('#aePartsSectionSub')) {
      const partSubs = {
        anime: 'Her sezon, film veya yan içeriğin izlenen bölümünü (+1 Bölüm / Tamamla) ve Parça Puanını buradan girin; genel puan ağırlıklı olarak otomatik hesaplanır.',
        series: 'Her sezon veya özel bölümün izlenen bölümünü (+1 Bölüm / Tamamla) ve sezon puanını buradan girin; genel dizi puanı otomatik hesaplanır.',
        movie: 'Tekil film veya film serisi parçalarının izlenme durumunu ve kişisel puanınızı buradan girin.',
        manga: 'Her cilt veya seri kısmının okunan bölümünü (+1 Bölüm / Tamamla) ve puanını buradan girin.',
        book: 'Her kitap veya cildin okunan sayfasını (+1 Sayfa / Tamamla) ve puanını buradan girin.'
      };
      $('#aePartsSectionSub').textContent = partSubs[adapter.id] || '';
    }
    if ($('#addPartBtn')) {
      const addPartLabels = {
        anime: '+ Parça (Sezon/Film/Yan İçerik) Ekle',
        series: '+ Sezon / Özel Bölüm Ekle',
        movie: '+ Film Parçası Ekle',
        manga: '+ Cilt / Kısım Ekle',
        book: '+ Kitap / Cilt Ekle'
      };
      $('#addPartBtn').textContent = addPartLabels[adapter.id] || '+ Parça Ekle';
    }
    if ($('#deleteAnimeModalBtn')) {
      $('#deleteAnimeModalBtn').hidden = isNew;
      $('#deleteAnimeModalBtn').textContent = `${adapter.label} Kaydını Sil`;
    }
    if ($('#saveAnimeModalBtn')) {
      $('#saveAnimeModalBtn').textContent = `${adapter.label} Kaydet`;
    }

    $('#aeTitle').value = d.title || '';
    $('#aeFirstSeasonUrl').value = initialUrl;
    $('#aeAnilistId').value = parsed.id || '';
    $('#aeImage').value = d.image || '';
    $('#aeCoverPreview').src = d.image ? resolvePreviewSrc(d.image) : '';
    $('#aeStatus').value = d.status || 'completed';
    $('#aeNext').value = d.next === true ? 'yes' : d.next === false ? 'no' : 'auto';
    $('#aeAddedAt').value = d.addedAt || new Date().toISOString().slice(0, 10);

    // Yalnızca admin tarafından seçilen özel kategorileri (`customGenres`) göster
    const activeGenres = Array.isArray(d.customGenres) ? d.customGenres : [];
    $('#aeGenresInput').value = activeGenres.join(', ');

    syncModalFavoriteBtn();
    syncScoreStudioUI();
    renderQuickScoreChips();
    renderAnimeGenreStudio();
    renderAnimePartsEditor();
    $('#animeEditModal').hidden = false;
  }

  function syncModalFavoriteBtn() {
    const btn = $('#aeFavoriteBtn');
    if (!btn || !state.editingDraft) return;
    const adapter = getActiveAdminAdapter();
    const isFav = Boolean(state.editingDraft.favorite);
    btn.classList.toggle('on', isFav);
    if (adapter.id === 'guide') {
      btn.textContent = isFav ? '★ Öne Çıkan Rehber (Seçili)' : '☆ Öne Çıkan İşaretle';
    } else {
      btn.textContent = isFav ? '★ Başyapıt (Seçili)' : '☆ Başyapıt İşaretle';
    }
  }

  function syncScoreStudioUI() {
    if (!state.editingDraft) return;
    const effScore = resolveEffectiveScore(state.editingDraft);
    state.editingDraft.score = effScore;
    const badge = $('#aeWeightedScoreDisplay');
    if (badge) {
      badge.textContent = effScore != null ? `★ ${effScore}` : 'Puansız';
    }
    renderQuickScoreChips();
  }

  function renderQuickScoreChips() {
    const wrap = $('#aeQuickScoreChips');
    if (!wrap || !state.editingDraft) return;
    wrap.replaceChildren();
    const curVal = resolveEffectiveScore(state.editingDraft);
    for (const sc of QUICK_SCORES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = (sc === null && curVal === null) || (sc !== null && curVal === sc);
      btn.className = 'btn-chip' + (isSelected ? ' on' : '');
      btn.textContent = sc === null ? 'Puanları Temizle' : `★ ${sc}`;
      btn.onclick = () => {
        const parts = state.editingDraft.parts || [];
        if (sc === null) {
          for (const p of parts) {
            delete p.score;
            p.adminModified = true;
          }
          state.editingDraft.score = null;
        } else {
          // İzlenen sezonlara (veya hiç sezon yoksa ilk parçaya) hızlı puan ata
          const targets = parts.filter(p => p.kind === 'season' && p.status !== 'NONE' && p.status !== 'PLANNING');
          const listToScore = targets.length ? targets : (parts.length ? [parts[0]] : []);
          for (const p of listToScore) {
            p.score = sc;
            p.adminModified = true;
          }
        }
        renderAnimePartsEditor();
        syncScoreStudioUI();
      };
      wrap.append(btn);
    }
  }

  function renderAnimeGenreStudio() {
    const container = $('#aeGenreGroupsContainer');
    if (!container) return;
    container.replaceChildren();

    const curGenres = new Set(
      ($('#aeGenresInput').value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );

    const adapter = getActiveAdminAdapter();
    const groups = [...(adapter.categoryGroups || CURATED_GENRE_GROUPS)];
    const extraCustom = (adapter.getCustomCatalog() || []).filter(Boolean);
    if (extraCustom.length) {
      groups.push({ label: 'Sizin Eklediğiniz Özel Kategoriler', items: extraCustom });
    }

    for (const grp of groups) {
      const box = document.createElement('div');
      box.className = 'genre-group-box';
      const lbl = document.createElement('span');
      lbl.className = 'genre-group-label';
      lbl.textContent = grp.label;
      const chipsRow = document.createElement('div');
      chipsRow.className = 'template-chips';

      for (const gName of grp.items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-chip' + (curGenres.has(gName) ? ' on' : '');
        btn.textContent = gName;
        btn.onclick = () => {
          const set = new Set(
            ($('#aeGenresInput').value || '')
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          );
          if (set.has(gName)) set.delete(gName);
          else set.add(gName);
          $('#aeGenresInput').value = [...set].join(', ');
          renderAnimeGenreStudio();
        };
        chipsRow.append(btn);
      }
      box.append(lbl, chipsRow);
      container.append(box);
    }
  }

  function renderAnimePartsEditor() {
    const wrap = $('#aePartsList');
    if (!wrap || !state.editingDraft) return;
    wrap.replaceChildren();
    const adapter = getActiveAdminAdapter();
    if (adapter.id === 'guide') return;
    const parts = state.editingDraft.parts || [];

    const isRead = adapter.id === 'book' || adapter.id === 'manga';
    const isBook = adapter.id === 'book';
    const isMovie = adapter.id === 'movie';
    const isSeries = adapter.id === 'series';

    const plusBtnLabel = isBook ? '+1 Sayfa' : isMovie ? '+1 Film' : '+1 Bölüm';
    const nameFieldLabel = isBook ? 'Kitap / Cilt Adı' : isMovie ? 'Film / Parça Adı' : adapter.id === 'manga' ? 'Cilt / Kısım Adı' : 'Sezon / Parça Adı';
    const namePlaceholder = isBook ? '1. Cilt' : isMovie ? 'Ana Film' : adapter.id === 'manga' ? 'Ana Seri' : '1. Sezon';
    const idFieldLabel = (adapter.id === 'anime' || adapter.id === 'manga')
      ? 'Parça ID (AniList / Özel)'
      : (isSeries || isMovie)
        ? 'Parça ID (IMDb / Özel)'
        : 'Parça ID (ISBN / Özel)';

    const kindOptionsHtml = isBook
      ? `<option value="season">Ana Kitap / Cilt (×1.00)</option>
         <option value="movie">Ek Kitap (×0.50)</option>
         <option value="other">Öykü / Ek Materyal (×0.25)</option>`
      : adapter.id === 'manga'
        ? `<option value="season">Ana Seri / Cilt (×1.00)</option>
           <option value="movie">Özel Cilt (×0.50)</option>
           <option value="other">Yan Hikaye / One-Shot (×0.20)</option>`
        : isMovie
          ? `<option value="season">Ana Film (×1.00)</option>
             <option value="movie">Seri Filmi (×1.00)</option>
             <option value="other">Kısa Film / Ek (×0.20)</option>`
          : isSeries
            ? `<option value="season">Dizi Sezonu (×1.00)</option>
               <option value="movie">Özel Film (×0.35)</option>
               <option value="other">Özel Bölüm / Mini (×0.15)</option>`
            : `<option value="season">Sezon (×1.00)</option>
               <option value="movie">Film (×0.35)</option>
               <option value="other">Yan İçerik / OVA (×0.15)</option>`;

    const formatOptionsHtml = isBook
      ? `<option value="BOOK">BOOK (Kitap)</option>
         <option value="NOVEL">NOVEL (Roman)</option>
         <option value="SPECIAL">SPECIAL (Ek)</option>
         <option value="TV">Genel</option>`
      : adapter.id === 'manga'
        ? `<option value="MANGA">MANGA</option>
           <option value="ONE_SHOT">ONE_SHOT</option>
           <option value="NOVEL">NOVEL (Light Novel)</option>
           <option value="SPECIAL">SPECIAL</option>
           <option value="TV">Genel</option>`
        : isMovie
          ? `<option value="MOVIE">MOVIE (Film)</option>
             <option value="SPECIAL">SPECIAL (Kısa / Özel)</option>
             <option value="TV">Genel</option>`
          : isSeries
            ? `<option value="TV">TV (Dizi Sezonu)</option>
               <option value="ONA">MINI / Dijital</option>
               <option value="MOVIE">MOVIE (Özel Film)</option>
               <option value="SPECIAL">SPECIAL (Özel Bölüm)</option>`
            : `<option value="TV">TV</option>
               <option value="ONA">ONA</option>
               <option value="MOVIE">MOVIE</option>
               <option value="OVA">OVA</option>
               <option value="SPECIAL">SPECIAL</option>
               <option value="TV_SHORT">TV_SHORT</option>`;

    const statusFieldLabel = isRead ? 'Okuma Durumu' : 'İzleme Durumu';
    const statusOptionsHtml = isRead
      ? `<option value="COMPLETED">Okundu (COMPLETED)</option>
         <option value="CURRENT">Okunuyor (CURRENT)</option>
         <option value="PAUSED">Beklemede (PAUSED)</option>
         <option value="DROPPED">Bırakıldı (DROPPED)</option>
         <option value="PLANNING">Okunacak (PLANNING)</option>
         <option value="NONE">Okunmadı (NONE)</option>`
      : `<option value="COMPLETED">İzlendi (COMPLETED)</option>
         <option value="CURRENT">İzleniyor (CURRENT)</option>
         <option value="PAUSED">Beklemede (PAUSED)</option>
         <option value="DROPPED">Bırakıldı (DROPPED)</option>
         <option value="PLANNING">Planlandı (PLANNING)</option>
         <option value="NONE">İzlenmedi (NONE)</option>`;

    const watchedFieldLabel = isBook ? 'Okunan Sayfa' : adapter.id === 'manga' ? 'Okunan Bölüm' : isMovie ? 'İzlenen' : 'İzlenen Bölüm';
    const totalFieldLabel = isBook ? 'Toplam Sayfa' : adapter.id === 'manga' ? 'Toplam Bölüm' : isMovie ? 'Toplam Parça' : 'Toplam Bölüm';
    const repeatFieldLabel = isRead ? 'Tekrar Okuma' : 'Tekrar İzleme';

    parts.forEach((p, idx) => {
      const weights = adapter.subItemWeights || { season: 1.0, movie: 0.35, other: 0.15 };
      const wVal = p.kind === 'movie' ? weights.movie : p.kind === 'other' ? weights.other : weights.season;
      const wLabel = `Ağırlık ×${Number(wVal).toFixed(2)}`;
      const row = document.createElement('div');
      row.className = 'part-edit-row';
      row.innerHTML = `
        <div class="part-edit-head">
          <span>#${idx + 1} · ${AdminSecurity.sanitizeText(p.name || 'Parça', 80)} <small style="opacity:.75">(${wLabel})</small></span>
          <div class="editor-item-actions">
            <button type="button" class="quick-ep-btn" data-pact="plus1" title="İlerlemeyi 1 artır">${plusBtnLabel}</button>
            <button type="button" class="quick-ep-btn done" data-pact="complete" title="Bu parçayı tamamlandı olarak işaretle">Tamamla</button>
            <button type="button" class="icon-btn" data-pact="up" title="Yukarı">↑</button>
            <button type="button" class="icon-btn" data-pact="down" title="Aşağı">↓</button>
            <button type="button" class="icon-btn del" data-pact="del" title="Parçayı Sil">✕</button>
          </div>
        </div>
        <div class="field-row">
          <label class="field" style="flex:2">
            <span>${nameFieldLabel}</span>
            <input type="text" class="inp glass" data-pf="name" placeholder="${namePlaceholder}">
          </label>
          <label class="field">
            <span>${idFieldLabel}</span>
            <input type="text" class="inp glass" data-pf="id">
          </label>
          <label class="field">
            <span>Tür (kind)</span>
            <select class="inp glass" data-pf="kind">
              ${kindOptionsHtml}
            </select>
          </label>
          <label class="field">
            <span>Format</span>
            <select class="inp glass" data-pf="format">
              ${formatOptionsHtml}
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span>${statusFieldLabel}</span>
            <select class="inp glass" data-pf="status">
              ${statusOptionsHtml}
            </select>
          </label>
          <label class="field">
            <span>${watchedFieldLabel}</span>
            <input type="number" class="inp glass" data-pf="watched" min="0">
          </label>
          <label class="field">
            <span>${totalFieldLabel}</span>
            <input type="number" class="inp glass" data-pf="episodes" min="0">
          </label>
          <label class="field">
            <span>Puan (10 Üzerinden)</span>
            <input type="number" class="inp glass" data-pf="score" min="0" max="10" step="0.1" placeholder="Örn: 9.0">
          </label>
          <label class="field">
            <span>Çıkış Yılı</span>
            <input type="number" class="inp glass" data-pf="year" placeholder="2024">
          </label>
          <label class="field">
            <span>Yayın Durumu</span>
            <select class="inp glass" data-pf="release">
              <option value="FINISHED">Tamamlandı (FINISHED)</option>
              <option value="RELEASING">Devam Ediyor (RELEASING)</option>
              <option value="NOT_YET_RELEASED">Henüz Çıkmadı</option>
              <option value="CANCELLED">İptal Edildi</option>
            </select>
          </label>
          <label class="field">
            <span>${repeatFieldLabel}</span>
            <input type="number" class="inp glass" data-pf="repeat" min="0" placeholder="0">
          </label>
        </div>
      `;

      row.querySelectorAll('[data-pf]').forEach(inp => {
        const f = inp.dataset.pf;
        inp.value = p[f] ?? (f === 'repeat' || f === 'watched' || f === 'episodes' ? 0 : '');
        inp.oninput = () => {
          p.adminModified = true;
          if (['watched', 'episodes', 'year', 'repeat'].includes(f)) {
            const n = inp.value === '' ? null : Number(inp.value);
            p[f] = isNaN(n) ? 0 : n;
            if (f === 'watched') {
              const tot = Number(p.episodes) || 0;
              if (tot > 0 && p.watched >= tot) {
                p.status = 'COMPLETED';
                row.querySelector('[data-pf="status"]').value = 'COMPLETED';
              } else if (p.watched > 0 && (p.status === 'NONE' || p.status === 'PLANNING')) {
                p.status = 'CURRENT';
                row.querySelector('[data-pf="status"]').value = 'CURRENT';
              }
            }
          } else if (f === 'score') {
            const sc = inp.value.trim() === '' ? null : Math.min(10, Math.max(0, Math.round(Number(inp.value) * 10) / 10));
            p.score = isNaN(sc) ? null : sc;
            syncScoreStudioUI();
          } else if (f === 'kind' || f === 'format') {
            p[f] = inp.value;
            syncScoreStudioUI();
          } else if (f === 'status') {
            p.status = inp.value;
            if (p.status === 'COMPLETED' && (!p.watched || p.watched === 0) && (p.episodes || 0) > 0) {
              p.watched = Number(p.episodes);
              row.querySelector('[data-pf="watched"]').value = p.watched;
            }
          } else if (f === 'id') {
            const raw = inp.value.trim();
            p.id = /^\d+$/.test(raw) ? Number(raw) : AdminSecurity.sanitizeText(raw, 80);
          } else {
            p[f] = AdminSecurity.sanitizeText(inp.value, 160);
          }
          if (f === 'name' || f === 'kind') {
            const wl = p.kind === 'movie' ? 'Ağırlık ×0.35' : p.kind === 'other' ? 'Ağırlık ×0.15' : 'Ağırlık ×1.00';
            row.querySelector('.part-edit-head span').innerHTML = `#${idx + 1} · ${AdminSecurity.sanitizeText(p.name || 'Parça', 80)} <small style="opacity:.75">(${wl})</small>`;
          }
        };
      });

      row.querySelector('[data-pact="plus1"]').onclick = () => {
        p.adminModified = true;
        const tot = Number(p.episodes) || 0;
        const cur = Number(p.watched) || 0;
        p.watched = tot > 0 ? Math.min(tot, cur + 1) : (cur + 1);
        if (tot > 0 && p.watched >= tot) p.status = 'COMPLETED';
        else p.status = 'CURRENT';
        renderAnimePartsEditor();
      };

      row.querySelector('[data-pact="complete"]').onclick = () => {
        p.adminModified = true;
        const tot = Number(p.episodes) || 0;
        p.watched = tot > 0 ? tot : Math.max(1, Number(p.watched) || 0);
        p.status = 'COMPLETED';
        renderAnimePartsEditor();
      };

      row.querySelector('[data-pact="up"]').onclick = () => {
        if (idx === 0) return;
        [parts[idx - 1], parts[idx]] = [parts[idx], parts[idx - 1]];
        renderAnimePartsEditor();
      };
      row.querySelector('[data-pact="down"]').onclick = () => {
        if (idx >= parts.length - 1) return;
        [parts[idx + 1], parts[idx]] = [parts[idx], parts[idx + 1]];
        renderAnimePartsEditor();
      };
      row.querySelector('[data-pact="del"]').onclick = () => {
        parts.splice(idx, 1);
        renderAnimePartsEditor();
        syncScoreStudioUI();
      };

      wrap.append(row);
    });
  }

  async function queryConnectedAnilistGraph(seedIds) {
    const LINKS = new Set(['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'SUMMARY', 'SPIN_OFF']);
    const QM = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id format status episodes startDate{year month day} genres title{romaji english} coverImage{large} relations{edges{relationType node{id}}}}}}`;
    const seen = new Set(seedIds.map(Number).filter(Boolean));
    let frontier = [...seen];
    const mediaMap = new Map();

    for (let round = 0; frontier.length && round < 8; round++) {
      const ids = frontier.slice(0, 50);
      frontier = frontier.slice(50);
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: QM, variables: { ids } })
      });
      if (!res.ok) throw new Error('AniList HTTP ' + res.status);
      const j = await res.json();
      const list = (j && j.data && j.data.Page && j.data.Page.media) || [];
      for (const m of list) {
        if (m.format === 'MUSIC') continue;
        mediaMap.set(m.id, m);
        for (const ed of (m.relations && m.relations.edges) || []) {
          if (ed && ed.node && LINKS.has(ed.relationType) && !seen.has(ed.node.id)) {
            seen.add(ed.node.id);
            frontier.push(ed.node.id);
          }
        }
      }
    }
    return mediaMap;
  }

  async function fetchAnilistRelationsForModal() {
    const adapter = getActiveAdminAdapter();
    const rawUrlOrQuery = $('#aeFirstSeasonUrl').value.trim() || $('#aeTitle').value.trim();
    if (adapter.id !== 'anime') {
      if (!rawUrlOrQuery) {
        toast('Lütfen önce bir link (IMDb, OpenLibrary, AniList) veya başlık girin.', 'warn');
        return;
      }
      const btn = $('#fetchAnilistMetaBtn');
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sorgulanıyor...';
      try {
        let info = null;
        if (adapter.id === 'manga') info = await ExternalCatalogFetcher.fetchMangaFromAnilist(rawUrlOrQuery);
        else if (adapter.id === 'series' || adapter.id === 'movie') info = await ExternalCatalogFetcher.fetchSeriesOrMovieFromImdb(rawUrlOrQuery, adapter.id);
        else if (adapter.id === 'book') info = await ExternalCatalogFetcher.fetchBookFromOpenLibrary(rawUrlOrQuery);
        if (info) {
          if (info.title && !$('#aeTitle').value.trim()) $('#aeTitle').value = info.title;
          if (info.image) {
            $('#aeImage').value = info.image;
            $('#aeCoverPreview').src = resolvePreviewSrc(info.image);
          }
          if (info.url) $('#aeFirstSeasonUrl').value = info.url;
          if (info.extraMeta && adapter.extraMetaField) {
            $('#aeExtraMetaInput').value = info.extraMeta;
            state.editingDraft[adapter.extraMetaField.key] = info.extraMeta;
          }
          if (Array.isArray(info.parts) && info.parts.length) {
            state.editingDraft.parts = info.parts;
            renderAnimePartsEditor();
            syncScoreStudioUI();
          }
          toast(`${adapter.label} kapak URL'si ve bilgileri (puanlar hariç) çekildi!`);
        }
      } catch (err) {
        toast('Sorgu başarısız: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
      return;
    }
    const parsed = parseAnilistUrlOrId($('#aeFirstSeasonUrl').value.trim() || $('#aeAnilistId').value.trim());
    if (!parsed.id) {
      toast('Lütfen önce ilk sezonun AniList linkini (URL) veya ID\'sini girin.', 'warn');
      return;
    }
    $('#aeAnilistId').value = parsed.id;
    if (!$('#aeFirstSeasonUrl').value.trim()) $('#aeFirstSeasonUrl').value = parsed.url;

    const btn = $('#fetchAnilistMetaBtn');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sorgulanıyor...';
    const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
    const kindFn = f => SERIES.has(f) ? 'season' : f === 'MOVIE' ? 'movie' : 'other';

    try {
      const mediaMap = await queryConnectedAnilistGraph([parsed.id]);
      const rootMedia = mediaMap.get(parsed.id);
      if (!rootMedia) throw new Error('Bu AniList linki için kayıt bulunamadı.');

      if (!$('#aeTitle').value.trim()) {
        $('#aeTitle').value = rootMedia.title.english || rootMedia.title.romaji || '';
      }
      if (rootMedia.coverImage && rootMedia.coverImage.large) {
        $('#aeImage').value = rootMedia.coverImage.large;
        $('#aeCoverPreview').src = rootMedia.coverImage.large;
      }

      const existingParts = state.editingDraft.parts || [];
      if (existingParts.length === 1 && String(existingParts[0].id).startsWith('part-')) {
        existingParts[0].id = parsed.id;
      }
      const existingById = new Map(existingParts.map(p => [Number(p.id) || p.id, p]));
      const dk = s => ((s && s.year) || 9999) * 10000 + ((s && s.month) || 0) * 100 + ((s && s.day) || 0);
      const sortedMedia = [...mediaMap.values()].sort((a, b) => dk(a.startDate) - dk(b.startDate));

      state.editingDraft.parts = sortedMedia.map(m => {
        const prev = existingById.get(m.id);
        return {
          id: m.id,
          name: (prev && prev.adminModified && prev.name && prev.name !== '1. Sezon') ? prev.name : (m.title.english || m.title.romaji),
          kind: kindFn(m.format),
          format: m.format || null,
          episodes: m.episodes || (prev && prev.episodes) || 0,
          watched: prev ? (prev.watched || 0) : (m.id === parsed.id ? (m.episodes || 0) : 0),
          status: prev ? prev.status : (m.id === parsed.id ? 'COMPLETED' : 'NONE'),
          release: m.status || null,
          year: (m.startDate && m.startDate.year) || null,
          ...(prev && prev.score != null ? { score: prev.score } : {}),
          ...(prev && prev.repeat > 0 ? { repeat: prev.repeat } : {}),
          ...(prev && prev.adminModified ? { adminModified: true } : {})
        };
      });

      renderAnimePartsEditor();
      syncScoreStudioUI();
      toast(`${sortedMedia.length} bağlantılı içerik (sezon, film ve yan içerik) çekildi!`);
    } catch (err) {
      toast('AniList sorgusu başarısız: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  async function scanAllAnimeForSideContent() {
    const btn = $('#scanAllRelationsBtn');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Taranıyor...';
    const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
    const LINKS = new Set(['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'SUMMARY', 'SPIN_OFF']);
    const kindFn = f => SERIES.has(f) ? 'season' : f === 'MOVIE' ? 'movie' : 'other';
    const dk = s => ((s && s.year) || 9999) * 10000 + ((s && s.month) || 0) * 100 + ((s && s.day) || 0);
    const excluded = new Set((state.overrides.exclude || []).map(Number));

    try {
      const seeds = [];
      for (const a of state.animeData.anime || []) {
        const p = parseAnilistUrlOrId(a.firstSeasonUrl || a.url || a.anilistId || a.id);
        if (p.id && !excluded.has(p.id)) {
          a.anilistId = p.id;
          if (!a.firstSeasonUrl) a.firstSeasonUrl = p.url;
          seeds.push(p.id);
        }
      }
      if (!seeds.length) {
        toast('Taranacak AniList linkli anime bulunamadı.', 'warn');
        return;
      }

      const mediaMap = await queryConnectedAnilistGraph(seeds);
      const par = new Map();
      const find = x => {
        if (!par.has(x)) par.set(x, x);
        while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); }
        return x;
      };
      for (const [id, m] of mediaMap.entries()) {
        for (const ed of (m.relations && m.relations.edges) || []) {
          if (ed && ed.node && LINKS.has(ed.relationType) && mediaMap.has(ed.node.id)) {
            par.set(find(ed.node.id), find(id));
          }
        }
      }

      let addedPartsCount = 0;
      for (const a of state.animeData.anime || []) {
        if (!a.anilistId || !mediaMap.has(a.anilistId)) continue;
        const rootGroup = find(a.anilistId);
        const connected = [...mediaMap.values()].filter(m => find(m.id) === rootGroup && !excluded.has(m.id));
        connected.sort((x, y) => dk(x.startDate) - dk(y.startDate));

        if (!a.image) {
          const hm = mediaMap.get(a.anilistId);
          if (hm && hm.coverImage && hm.coverImage.large) a.image = hm.coverImage.large;
        }

        const existingParts = a.parts || [];
        if (existingParts.length === 1 && String(existingParts[0].id).startsWith('part-')) {
          existingParts[0].id = a.anilistId;
        }
        const byId = new Map(existingParts.map(p => [Number(p.id) || p.id, p]));

        for (const m of connected) {
          if (!byId.has(m.id)) {
            addedPartsCount++;
            byId.set(m.id, {
              id: m.id,
              name: m.title.english || m.title.romaji,
              kind: kindFn(m.format),
              format: m.format || null,
              episodes: m.episodes || 0,
              watched: 0,
              status: 'NONE',
              release: m.status || null,
              year: (m.startDate && m.startDate.year) || null
            });
          } else {
            const prev = byId.get(m.id);
            if (!prev.episodes && m.episodes) prev.episodes = m.episodes;
            if (m.status) prev.release = m.status;
            if (!prev.year && m.startDate && m.startDate.year) prev.year = m.startDate.year;
          }
        }
        a.parts = [...byId.values()].sort((x, y) => ((x.year || 9999) - (y.year || 9999)));
      }

      state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
      markDirty('anime');
      renderAnimeAdminPanel();
      toast(`Tarama tamamlandı; ${addedPartsCount} yeni sezon/film/yan içerik eklendi.`);
    } catch (err) {
      toast('Yan içerik taraması başarısız: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  function saveAnimeFromModal() {
    if (!state.editingDraft) return;
    const S = AdminSecurity.sanitizeText;
    const U = AdminSecurity.sanitizeUrl;
    const title = S($('#aeTitle').value, 200);
    if (!title) {
      toast('Anime başlığı boş bırakılamaz.', 'warn');
      return;
    }

    const rawUrlInput = $('#aeFirstSeasonUrl').value.trim();
    const rawAidInput = $('#aeAnilistId').value.trim();
    const parsed = parseAnilistUrlOrId(rawUrlInput || rawAidInput);
    const anilistId = parsed.id;
    const isNew = state.editingAnimeId === '__new__';

    const d = state.editingDraft;
    d.title = title;
    if (anilistId && anilistId > 0) {
      d.anilistId = anilistId;
      if (isNew || String(d.id).startsWith('custom-')) d.id = 'al-' + anilistId;
      d.url = parsed.url;
      d.firstSeasonUrl = U(rawUrlInput, false) || parsed.url;
      if (Array.isArray(d.parts) && d.parts.length === 1 && String(d.parts[0].id).startsWith('part-')) {
        d.parts[0].id = anilistId;
      }
    } else {
      d.anilistId = null;
      if (isNew && !d.id) d.id = 'custom-' + Date.now();
      d.url = '';
      d.firstSeasonUrl = '';
      d.source = 'manual';
    }

    d.image = U($('#aeImage').value, true) || null;

    d.parts = (d.parts || []).map(p => {
      const ep = Number(p.episodes) || 0;
      let w = Number(p.watched) || 0;
      const st = p.status || 'COMPLETED';
      if (st === 'COMPLETED' && w === 0 && ep > 0) w = ep;
      const clean = {
        id: p.id || ('part-' + Date.now()),
        name: S(p.name, 180) || title,
        kind: ['season', 'movie', 'other'].includes(p.kind) ? p.kind : 'season',
        format: p.format || 'TV',
        episodes: ep,
        watched: w,
        status: st,
        release: p.release || 'FINISHED',
        year: p.year ? Number(p.year) : null
      };
      if (p.score != null && p.score !== '' && !isNaN(Number(p.score)) && Number(p.score) > 0) {
        clean.score = Math.min(10, Math.max(0, Math.round(Number(p.score) * 10) / 10));
      }
      if (p.repeat && Number(p.repeat) > 0) clean.repeat = Number(p.repeat);
      if (p.adminModified) clean.adminModified = true;
      return clean;
    });

    // Genel puan her zaman sezon, film ve yan içeriklerin ağırlıklı ortalamasından otomatik hesaplanır
    d.score = resolveEffectiveScore(d);

    const statusSel = $('#aeStatus').value;
    d.status = statusSel === 'auto' ? deriveFranchiseStatusFromParts(d.parts) : statusSel;

    const nextSel = $('#aeNext').value;
    if (nextSel === 'yes') d.next = true;
    else if (nextSel === 'no') delete d.next;
    if (d.favorite) d.favorite = true;
    else delete d.favorite;

    d.addedAt = S($('#aeAddedAt').value, 20) || new Date().toISOString().slice(0, 10);

    const customGenres = [
      ...new Set(
        ($('#aeGenresInput').value || '')
          .split(',')
          .map(g => S(g, 40))
          .filter(Boolean)
      )
    ];
    if (customGenres.length) {
      d.customGenres = customGenres;
      d.genres = customGenres;
    } else {
      delete d.customGenres;
      delete d.genres;
    }

    d.adminModified = true;
    const locked = new Set(d.lockedFields || []);
    ['title', 'score', 'status', 'genres', 'addedAt'].forEach(k => locked.add(k));
    if (d.image) locked.add('image');
    if (nextSel !== 'auto') locked.add('next');
    d.lockedFields = [...locked];

    const adapter = getActiveAdminAdapter();
    if (adapter.extraMetaField) {
      d[adapter.extraMetaField.key] = S($('#aeExtraMetaInput').value, 160);
    }
    if (adapter.id !== 'anime' && rawUrlInput) {
      d.firstSeasonUrl = U(rawUrlInput, false);
      d.url = d.firstSeasonUrl;
    }
    if (adapter.id === 'anime') {
      if (d.anilistId) {
        state.overrides.titles[String(d.anilistId)] = d.title;
        state.overrides.exclude = (state.overrides.exclude || []).filter(x => Number(x) !== Number(d.anilistId));
        markDirty('overrides');
      }
      state.overrides.deletedIds = (state.overrides.deletedIds || []).filter(x => x !== d.id);
    }
    const list = adapter.getItems();
    const existingIdx = list.findIndex(a => a.id === state.editingAnimeId || a.id === d.id);
    if (existingIdx >= 0) list[existingIdx] = d;
    else list.unshift(d);
    list.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || (a.title || '').localeCompare(b.title || '', 'tr'));
    adapter.saveItem(d);

    $('#animeEditModal').hidden = true;
    renderAnimeAdminPanel();
    if (adapter.id === 'anime') renderOverridesEditor();
    toast(`"${d.title}" (${adapter.label}) kaydedildi (Ağırlıklı Puan: ${d.score ?? 'Puansız'}).`);
  }

  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 9 — ÇOKLU-MEDYA UYUMLU EVRENSEL HIZLI SIRALI DÜZENLEME MİMARİSİ]
  //
  // NEDEN BU MİMARİ KURULDU?
  // Kullanıcı ileride siteye yalnızca Anime değil; Rehber (`guide`), Kitap (`book`),
  // Manga (`manga`), Dizi (`series`) ve Film (`movie`) bölümleri ekleyecektir.
  // Başka bir yapay zeka modeli ileride bu bölümleri eklerken sıfırdan toplu düzenleme
  // ekranı YAZMAMALIDIR. Aşağıdaki `CONTENT_ADAPTER_REGISTRY` sözleşmesi (contract)
  // sayesinde her içerik türü kendi veri yapısını, alt birim ağırlıklarını ve kategori
  // gruplarını tanımlar; `UniversalRapidQueue` motoru ise tüm içerik türlerini aynı
  // sıralı kart arayüzüyle çalıştırır.
  //
  // YENİ BİR İÇERİK TÜRÜ EKLERKEN YAPAY ZEKANIN YAPMASI GEREKENLER:
  // 1. `CONTENT_ADAPTER_REGISTRY` içindeki ilgili adaptörün (`manga`, `book`, `series`,
  //    `movie`, `guide`) `dataFile` yolundaki JSON dosyasını oluşturmak.
  // 2. Eğer o içerik türü farklı bir API'den (ör. TMDB, Google Books, OpenLibrary, MangaDex)
  //    veri çekiyorsa, yalnızca adaptörün `fetchExternalRelations(draft)` metodunu bağlamak.
  // 3. Kuyruk motoruna (`buildRapidQueue`, `renderRapidQueueCard`, `saveRapidQueueCurrentAndAdvance`)
  //    DOKUNMAMAK — çünkü motor tamamen adaptör güdümlüdür!
  // ============================================================================
  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 10 — SIFIR-DEPOLAMA UZAKTAN KAPAK VE METADATA ÇEKİCİ]
  // GitHub Pages depolama sınırını korumak için görseller repoya indirilmez.
  // Bu servis; Anime/Manga için AniList'ten, Dizi/Film için IMDb linki/ID'si (`tt...`)
  // üzerinden TVMaze & IMDb API'sinden, Kitap için OpenLibrary'den YALNIZCA kapak
  // görseli CDN bağlantısını (`image`), çıkış yılını ve sezon/bölüm/cilt/sayfa yapısını
  // çeker. Global puanları ASLA çekmez; puanlar %100 kullanıcının kendi verdiği puanlardır.
  // ============================================================================
  function parseImdbId(input) {
    if (!input) return null;
    const m = String(input).trim().match(/(tt\d{5,10})/i);
    return m ? m[1].toLowerCase() : null;
  }

  const ExternalCatalogFetcher = {
    async fetchMangaFromAnilist(urlOrIdOrQuery) {
      const parsed = parseAnilistUrlOrId(urlOrIdOrQuery);
      const isId = Boolean(parsed.id);
      const query = isId
        ? `query($id:Int){Media(id:$id,type:MANGA){id title{romaji english} status chapters volumes startDate{year} coverImage{large}}}`
        : `query($q:String){Media(search:$q,type:MANGA){id title{romaji english} status chapters volumes startDate{year} coverImage{large}}}`;
      const variables = isId ? { id: parsed.id } : { q: String(urlOrIdOrQuery).trim() };
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables })
      });
      if (!res.ok) throw new Error('AniList Manga HTTP ' + res.status);
      const j = await res.json();
      const m = j && j.data && j.data.Media;
      if (!m) throw new Error('Manga bulunamadı.');
      return {
        externalId: m.id,
        url: 'https://anilist.co/manga/' + m.id,
        title: m.title.english || m.title.romaji || '',
        image: (m.coverImage && m.coverImage.large) || '',
        parts: [
          {
            id: m.id,
            name: (m.title.english || m.title.romaji || 'Ana Seri') + (m.volumes ? ` (${m.volumes} Cilt)` : ''),
            kind: 'season',
            format: 'MANGA',
            episodes: m.chapters || m.volumes || 0,
            watched: m.chapters || m.volumes || 0,
            status: 'COMPLETED',
            release: m.status || 'FINISHED',
            year: (m.startDate && m.startDate.year) || null
          }
        ]
      };
    },

    async fetchSeriesOrMovieFromImdb(inputUrlOrQuery, mediaKind = 'series') {
      const imdbId = parseImdbId(inputUrlOrQuery);
      const cleanQuery = String(inputUrlOrQuery || '').trim();

      // 1. Dizi (veya IMDb ID'li TV yapımı) için TVMaze Lookup / Seasons API (Sıfır anahtar, doğrudan IMDb tt... destekli)
      if (mediaKind === 'series' || imdbId) {
        try {
          const lookupUrl = imdbId
            ? `https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdbId)}`
            : `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanQuery)}`;
          const res = await fetch(lookupUrl);
          if (res.ok) {
            const show = await res.json();
            if (show && show.id) {
              const sRes = await fetch(`https://api.tvmaze.com/shows/${show.id}/seasons`);
              const seasons = sRes.ok ? await sRes.json() : [];
              const parts = (seasons || [])
                .filter(s => s && (s.number || 0) > 0)
                .map(s => ({
                  id: `tvmaze-s-${s.id}`,
                  name: s.name || `${s.number}. Sezon`,
                  kind: 'season',
                  format: 'TV',
                  episodes: s.episodeOrder || 0,
                  watched: 0,
                  status: 'NONE',
                  release: 'FINISHED',
                  year: s.premiereDate ? Number(s.premiereDate.slice(0, 4)) : null
                }));
              if (parts.length) {
                parts[0].status = 'COMPLETED';
                parts[0].watched = parts[0].episodes || 1;
              }
              const resolvedImdb = (show.externals && show.externals.imdb) || imdbId || '';
              return {
                externalId: resolvedImdb || show.id,
                url: resolvedImdb ? `https://www.imdb.com/title/${resolvedImdb}/` : (show.officialSite || ''),
                title: show.name || '',
                image: (show.image && (show.image.original || show.image.medium)) || '',
                extraMeta: (show.network && show.network.name) || (show.webChannel && show.webChannel.name) || '',
                parts: parts.length ? parts : [{
                  id: resolvedImdb || ('part-' + Date.now()),
                  name: '1. Sezon',
                  kind: 'season',
                  format: 'TV',
                  episodes: 1,
                  watched: 1,
                  status: 'COMPLETED',
                  release: 'FINISHED',
                  year: show.premiered ? Number(show.premiered.slice(0, 4)) : null
                }]
              };
            }
          }
        } catch (e) {}
      }

      // 2. Film veya IMDb yedek sorgusu (search.imdbot.workers.dev) — Genel IMDb puanı çekilmez, sadece kapak URL ve yıl alınır
      const qParam = imdbId ? `tt=${encodeURIComponent(imdbId)}` : `q=${encodeURIComponent(cleanQuery)}`;
      const res2 = await fetch(`https://search.imdbot.workers.dev/?${qParam}`);
      if (!res2.ok) throw new Error('IMDb servisine ulaşılamadı.');
      const j2 = await res2.json();
      const desc = (j2 && j2.description && j2.description[0]) || (j2 && j2.short ? j2 : null);
      if (!desc) throw new Error('IMDb üzerinde eşleşen dizi/film bulunamadı.');
      const title = desc['#TITLE'] || (j2.short && j2.short.name) || '';
      const year = desc['#YEAR'] || null;
      const poster = desc['#IMG_POSTER'] || (j2.short && j2.short.image) || '';
      const resolvedId = desc['#IMDB_ID'] || imdbId || ('imdb-' + Date.now());
      const actors = desc['#ACTORS'] || '';
      return {
        externalId: resolvedId,
        url: `https://www.imdb.com/title/${resolvedId}/`,
        title,
        image: poster,
        extraMeta: actors,
        parts: [
          {
            id: resolvedId,
            name: mediaKind === 'movie' ? (title || 'Ana Film') : '1. Sezon',
            kind: mediaKind === 'movie' ? 'movie' : 'season',
            format: mediaKind === 'movie' ? 'MOVIE' : 'TV',
            episodes: 1,
            watched: 1,
            status: 'COMPLETED',
            release: 'FINISHED',
            year: year ? Number(year) : null
          }
        ]
      };
    },

    async fetchBookFromOpenLibrary(inputUrlOrQuery) {
      const raw = String(inputUrlOrQuery || '').trim();
      const isbnMatch = raw.match(/(?:isbn[/:=\s]*)?(97[89]\d{10}|\d{9}[\dXx])/i);
      const q = isbnMatch ? `isbn:${isbnMatch[1]}` : raw.replace(/^https?:\/\/openlibrary\.org\/works\//i, '');
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=1`);
      if (!res.ok) throw new Error('OpenLibrary HTTP ' + res.status);
      const j = await res.json();
      const doc = j && j.docs && j.docs[0];
      if (!doc) throw new Error('Kitap bulunamadı.');
      const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '';
      const pages = doc.number_of_pages_median || 0;
      return {
        externalId: doc.key || ('book-' + Date.now()),
        url: doc.key ? `https://openlibrary.org${doc.key}` : raw,
        title: doc.title || '',
        image: coverUrl,
        extraMeta: (doc.author_name && doc.author_name[0]) || '',
        parts: [
          {
            id: doc.key || ('book-part-' + Date.now()),
            name: doc.title || '1. Kitap',
            kind: 'season',
            format: 'BOOK',
            episodes: pages,
            watched: pages,
            status: 'COMPLETED',
            release: 'FINISHED',
            year: doc.first_publish_year || null
          }
        ]
      };
    }
  };

  const CONTENT_ADAPTER_REGISTRY = {
    anime: {
      id: 'anime',
      label: 'Anime',
      dataFile: 'data/anime.json',
      countKey: 'anime',
      titleLabel: 'Anime Başlığı',
      externalUrlLabel: 'İlk Sezonun AniList Linki (URL)',
      externalUrlField: 'firstSeasonUrl',
      extraMetaField: null,
      supportsNextBadge: true,
      supportsAnilistGraph: true,
      statusOptions: [
        ['completed', 'İzlendi'],
        ['watching', 'İzleniyor'],
        ['paused', 'Beklemede'],
        ['dropped', 'Bırakıldı'],
        ['planned', 'Planlandı']
      ],
      subItemHeading: 'Sezon, Film ve Yan İçerik Puanları (Sezon ×1.00 · Film ×0.35 · Yan İçerik ×0.15)',
      subItemWeights: { season: 1.0, movie: 0.35, other: 0.15 },
      subItemUnitLabel: 'bölüm',
      categoryGroups: CURATED_GENRE_GROUPS,
      getItems: () => state.animeData.anime || [],
      getCustomCatalog: () => state.animeData.customGenreCatalog || [],
      addCustomCategory: (cat) => {
        if (!Array.isArray(state.animeData.customGenreCatalog)) state.animeData.customGenreCatalog = [];
        if (!state.animeData.customGenreCatalog.includes(cat)) state.animeData.customGenreCatalog.push(cat);
        markDirty('anime');
      },
      computeScore: (item) => resolveEffectiveScore(item),
      saveItem: (updatedItem) => {
        const list = state.animeData.anime || [];
        const idx = list.findIndex(x => x.id === updatedItem.id);
        updatedItem.score = resolveEffectiveScore(updatedItem);
        updatedItem.adminModified = true;
        const locked = new Set(updatedItem.lockedFields || []);
        ['title', 'score', 'status', 'genres', 'addedAt'].forEach(k => locked.add(k));
        updatedItem.lockedFields = [...locked];
        if (updatedItem.anilistId) {
          state.overrides.titles[String(updatedItem.anilistId)] = updatedItem.title;
          markDirty('overrides');
        }
        if (idx >= 0) list[idx] = updatedItem;
        else list.unshift(updatedItem);
        state.animeData.stats = computeStatsClient(list, state.animeData.statsConfig);
        state.animeData.updated = new Date().toISOString().slice(0, 10);
        markDirty('anime');
        renderAnimeAdminPanel();
      }
    },
    manga: {
      id: 'manga',
      label: 'Manga',
      dataFile: 'data/manga.json',
      countKey: 'manga',
      titleLabel: 'Manga Başlığı',
      externalUrlLabel: 'AniList / MangaDex / MAL Linki (URL)',
      externalUrlField: 'firstSeasonUrl',
      extraMetaField: { key: 'author', label: 'Mangaka / Yazar', placeholder: 'Örn: Kentaro Miura' },
      supportsNextBadge: true,
      supportsAnilistGraph: true,
      statusOptions: [
        ['completed', 'Okundu'],
        ['watching', 'Okunuyor'],
        ['paused', 'Beklemede'],
        ['dropped', 'Bırakıldı'],
        ['planned', 'Planlandı']
      ],
      subItemHeading: 'Cilt / Kısım Puanları ve Okunan Bölüm Takibi (Ana Seri ×1.00 · Yan Hikaye ×0.20)',
      subItemWeights: { season: 1.0, movie: 0.5, other: 0.2 },
      subItemUnitLabel: 'bölüm',
      categoryGroups: CURATED_GENRE_GROUPS,
      getItems: () => ensureMultiMediaStore('manga').items,
      getCustomCatalog: () => ensureMultiMediaStore('manga').customGenreCatalog,
      addCustomCategory: (cat) => addMultiMediaCategory('manga', cat),
      computeScore: (item) => resolveEffectiveScore(item),
      saveItem: (updatedItem) => saveMultiMediaItem('manga', updatedItem)
    },
    book: {
      id: 'book',
      label: 'Kitap',
      dataFile: 'data/books.json',
      countKey: 'books',
      titleLabel: 'Kitap Adı',
      externalUrlLabel: 'Goodreads / OpenLibrary / Kaynak Linki',
      externalUrlField: 'url',
      extraMetaField: { key: 'author', label: 'Yazar', placeholder: 'Örn: Frank Herbert' },
      supportsNextBadge: false,
      supportsAnilistGraph: true,
      statusOptions: [
        ['completed', 'Okundu'],
        ['watching', 'Okunuyor'],
        ['paused', 'Yarım Kaldı'],
        ['dropped', 'Bırakıldı'],
        ['planned', 'Okunacak']
      ],
      subItemHeading: 'Kitap / Seri Cilt Puanı ve Okunan Sayfa Takibi',
      subItemWeights: { season: 1.0, movie: 0.5, other: 0.25 },
      subItemUnitLabel: 'sayfa',
      categoryGroups: [
        { label: 'Edebiyat & Kurgu', items: ['Bilim Kurgu', 'Fantastik', 'Distopya', 'Klasik', 'Polisiye & Suç', 'Tarihi Roman', 'Korku & Gerilim', 'Macera', 'Dram'] },
        { label: 'Kurgu Dışı & Araştırma', items: ['Felsefe', 'Tarih', 'Bilim & Teknoloji', 'Psikoloji', 'Biyografi', 'Ekonomi', 'Kişisel Gelişim', 'Deneme'] }
      ],
      getItems: () => ensureMultiMediaStore('book').items,
      getCustomCatalog: () => ensureMultiMediaStore('book').customGenreCatalog,
      addCustomCategory: (cat) => addMultiMediaCategory('book', cat),
      computeScore: (item) => resolveEffectiveScore(item),
      saveItem: (updatedItem) => saveMultiMediaItem('book', updatedItem)
    },
    series: {
      id: 'series',
      label: 'Dizi',
      dataFile: 'data/series.json',
      countKey: 'series',
      titleLabel: 'Dizi Başlığı',
      externalUrlLabel: 'IMDb / TMDB Linki (URL)',
      externalUrlField: 'firstSeasonUrl',
      extraMetaField: { key: 'network', label: 'Platform / Kanal', placeholder: 'Örn: HBO, Netflix...' },
      supportsNextBadge: true,
      supportsAnilistGraph: true,
      statusOptions: [
        ['completed', 'İzlendi'],
        ['watching', 'İzleniyor'],
        ['paused', 'Beklemede'],
        ['dropped', 'Bırakıldı'],
        ['planned', 'Planlandı']
      ],
      subItemHeading: 'Sezon ve Özel Bölüm Puanları (Sezon ×1.00 · Film ×0.35 · Özel Bölüm ×0.15)',
      subItemWeights: { season: 1.0, movie: 0.35, other: 0.15 },
      subItemUnitLabel: 'bölüm',
      categoryGroups: [
        { label: 'Dizi Türleri', items: ['Bilim Kurgu', 'Fantastik', 'Suç & Polisiye', 'Dram', 'Gerilim & Gizem', 'Komedi', 'Sitcom', 'Aksiyon', 'Tarihi', 'Belgesel', 'Siberpunk', 'Post-Apokaliptik', 'Psikolojik'] }
      ],
      getItems: () => ensureMultiMediaStore('series').items,
      getCustomCatalog: () => ensureMultiMediaStore('series').customGenreCatalog,
      addCustomCategory: (cat) => addMultiMediaCategory('series', cat),
      computeScore: (item) => resolveEffectiveScore(item),
      saveItem: (updatedItem) => saveMultiMediaItem('series', updatedItem)
    },
    movie: {
      id: 'movie',
      label: 'Film',
      dataFile: 'data/movies.json',
      countKey: 'movies',
      titleLabel: 'Film Adı',
      externalUrlLabel: 'IMDb / Letterboxd / TMDB Linki',
      externalUrlField: 'url',
      extraMetaField: { key: 'director', label: 'Yönetmen', placeholder: 'Örn: Christopher Nolan' },
      supportsNextBadge: false,
      supportsAnilistGraph: true,
      statusOptions: [
        ['completed', 'İzlendi'],
        ['watching', 'İzleniyor'],
        ['planned', 'İzlenecek'],
        ['dropped', 'Yarım Bırakıldı']
      ],
      subItemHeading: 'Film / Seri Filmleri Puanlama Tablosu (Ana Film ×1.00 · Ek/Kısa Film ×0.20)',
      subItemWeights: { season: 1.0, movie: 1.0, other: 0.2 },
      subItemUnitLabel: 'film',
      categoryGroups: [
        { label: 'Film Türleri', items: ['Bilim Kurgu', 'Fantastik', 'Aksiyon', 'Dram', 'Suç & Noir', 'Gerilim', 'Gizem', 'Korku', 'Komedi', 'Animasyon', 'Tarihi', 'Savaş', 'Psikolojik', 'Biyografi'] }
      ],
      getItems: () => ensureMultiMediaStore('movie').items,
      getCustomCatalog: () => ensureMultiMediaStore('movie').customGenreCatalog,
      addCustomCategory: (cat) => addMultiMediaCategory('movie', cat),
      computeScore: (item) => resolveEffectiveScore(item),
      saveItem: (updatedItem) => saveMultiMediaItem('movie', updatedItem)
    },
    guide: {
      id: 'guide',
      label: 'Rehber',
      dataFile: 'data/guides.json',
      countKey: 'guides',
      titleLabel: 'Rehber Başlığı',
      externalUrlLabel: 'Technopat Sosyal Konu Linki (URL)',
      externalUrlField: 'url',
      extraMetaField: { key: 'summary', label: 'Rehber Kısa Özeti / Açıklaması', placeholder: 'Bu rehberde neler anlatılıyor? (Katalog kartında görünür)' },
      supportsNextBadge: false,
      supportsAnilistGraph: false,
      statusOptions: [
        ['completed', 'Yayında'],
        ['watching', 'Güncelleniyor'],
        ['planned', 'Taslak']
      ],
      subItemHeading: 'Rehber Bölümleri / Adımları',
      subItemWeights: { season: 1.0, movie: 0.5, other: 0.2 },
      subItemUnitLabel: 'adım',
      categoryGroups: [
        { label: 'Rehber Kategorileri', items: ['Linux & Sistem', 'Paket Yönetimi', 'Masaüstü & Özelleştirme', 'Donanım & Sürücü', 'Yazılım & Araçlar', 'Oyun Rehberi', 'Yapay Zeka', 'Ağ & Güvenlik', 'İnceleme'] }
      ],
      getItems: () => ensureMultiMediaStore('guide').items,
      getCustomCatalog: () => ensureMultiMediaStore('guide').customGenreCatalog,
      addCustomCategory: (cat) => addMultiMediaCategory('guide', cat),
      computeScore: (item) => resolveEffectiveScore(item),
      saveItem: (updatedItem) => saveMultiMediaItem('guide', updatedItem)
    }
  };

  function ensureMultiMediaStore(typeId) {
    if (!state.multiMediaStore[typeId]) {
      state.multiMediaStore[typeId] = { items: [], customGenreCatalog: [], dirty: false };
    }
    return state.multiMediaStore[typeId];
  }

  function addMultiMediaCategory(typeId, cat) {
    const store = ensureMultiMediaStore(typeId);
    if (!store.customGenreCatalog.includes(cat)) store.customGenreCatalog.push(cat);
    store.dirty = true;
    updateDirtyIndicator();
  }

  function saveMultiMediaItem(typeId, updatedItem) {
    const store = ensureMultiMediaStore(typeId);
    const idx = store.items.findIndex(x => x.id === updatedItem.id);
    updatedItem.score = resolveEffectiveScore(updatedItem);
    updatedItem.adminModified = true;
    if (idx >= 0) store.items[idx] = updatedItem;
    else store.items.unshift(updatedItem);
    store.dirty = true;
    updateDirtyIndicator();
  }

  function getActiveAdminAdapter() {
    const t = state.activeAdminMediaType || 'anime';
    return CONTENT_ADAPTER_REGISTRY[t] || CONTENT_ADAPTER_REGISTRY.anime;
  }

  function getActiveAdminList() {
    const adapter = getActiveAdminAdapter();
    return adapter.getItems();
  }

  function updateDirtyIndicator() {
    const anyMultiDirty = Object.values(state.multiMediaStore || {}).some(s => s && s.dirty);
    const anyDirty = state.dirtyConfig || state.dirtyAnime || state.dirtyOverrides || anyMultiDirty || state.pendingUploads.size > 0;
    const ind = $('#dirtyIndicator');
    if (ind) ind.hidden = !anyDirty;
  }

  function getActiveAdapter() {
    const typeId = state.rapidQueue.activeType || 'anime';
    return CONTENT_ADAPTER_REGISTRY[typeId] || CONTENT_ADAPTER_REGISTRY.anime;
  }

  function filterItemsForRapidQueue(items, filterMode, adapter) {
    if (filterMode === 'health_custom' && Array.isArray(state.rapidQueue.customTargetIds) && state.rapidQueue.customTargetIds.length) {
      const allowed = new Set(state.rapidQueue.customTargetIds);
      return items.filter(it => allowed.has(it.id));
    }
    return items.filter(it => {
      if (filterMode === 'uncategorized') {
        return !Array.isArray(it.customGenres) || it.customGenres.length === 0;
      }
      if (filterMode === 'unscored') {
        return adapter.computeScore(it) == null;
      }
      if (filterMode === 'unmodified') {
        return !it.adminModified;
      }
      if (filterMode === 'favorites') {
        return Boolean(it.favorite);
      }
      if (filterMode === 'watching') {
        return it.status === 'watching';
      }
      return true;
    });
  }

  function initOrRefreshRapidQueue(preserveCurrentId = false) {
    const adapter = getActiveAdapter();
    const allItems = adapter.getItems();
    const filterMode = $('#rqFilterSelect') ? $('#rqFilterSelect').value : state.rapidQueue.filterMode;
    state.rapidQueue.filterMode = filterMode;

    const prevId = preserveCurrentId && state.rapidQueue.draftItem ? state.rapidQueue.draftItem.id : null;
    const filtered = filterItemsForRapidQueue(allItems, filterMode, adapter);
    state.rapidQueue.queueIds = filtered.map(x => x.id);

    if (prevId && state.rapidQueue.queueIds.includes(prevId)) {
      state.rapidQueue.currentIndex = state.rapidQueue.queueIds.indexOf(prevId);
    } else {
      state.rapidQueue.currentIndex = 0;
    }

    loadRapidQueueItemAtIndex(state.rapidQueue.currentIndex);
  }

  function loadRapidQueueItemAtIndex(idx) {
    const adapter = getActiveAdapter();
    const allItems = adapter.getItems();
    const qIds = state.rapidQueue.queueIds || [];

    const emptyBox = $('#rqEmptyState');
    const bodyBox = $('#rqSpotlightBody');
    const footerBox = document.querySelector('.rq-nav-footer');

    if (!qIds.length) {
      state.rapidQueue.currentIndex = 0;
      state.rapidQueue.draftItem = null;
      if (emptyBox) emptyBox.hidden = false;
      if (bodyBox) bodyBox.hidden = true;
      if (footerBox) footerBox.hidden = true;
      renderRapidQueueProgressAndStrip();
      return;
    }

    if (emptyBox) emptyBox.hidden = true;
    if (bodyBox) bodyBox.hidden = false;
    if (footerBox) footerBox.hidden = false;

    const clamped = Math.max(0, Math.min(qIds.length - 1, idx));
    state.rapidQueue.currentIndex = clamped;
    const targetId = qIds[clamped];
    const sourceItem = allItems.find(x => x.id === targetId) || allItems[0];
    state.rapidQueue.draftItem = structuredClone(sourceItem);

    renderRapidQueueProgressAndStrip();
    renderRapidQueueCard();
  }

  function renderRapidQueueProgressAndStrip() {
    const adapter = getActiveAdapter();
    const allItems = adapter.getItems();
    const qIds = state.rapidQueue.queueIds || [];
    const curIdx = state.rapidQueue.currentIndex || 0;
    const total = qIds.length;
    const pos = total ? curIdx + 1 : 0;
    const pct = total ? Math.round((pos / total) * 100) : 100;

    if ($('#rqProgressText')) {
      $('#rqProgressText').textContent = `${adapter.label} Kuyruğu: ${pos} / ${total} (%${pct})`;
    }
    if ($('#rqSessionCountText')) {
      $('#rqSessionCountText').textContent = `Bu oturumda ${state.rapidQueue.editedInSession.size} girdi düzenlendi`;
    }
    if ($('#rqProgressFill')) {
      $('#rqProgressFill').style.width = `${pct}%`;
    }

    const strip = $('#rqStrip');
    if (!strip) return;
    strip.replaceChildren();
    const byId = new Map(allItems.map(x => [x.id, x]));

    // Performans için aktif öğenin etrafındaki 40 öğelik pencereyi çiz
    const start = Math.max(0, curIdx - 10);
    const end = Math.min(total, start + 40);

    for (let i = start; i < end; i++) {
      const id = qIds[i];
      const it = byId.get(id);
      if (!it) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      const isDone = state.rapidQueue.editedInSession.has(id) || (Array.isArray(it.customGenres) && it.customGenres.length > 0);
      btn.className = 'rq-strip-item' + (i === curIdx ? ' active' : '') + (isDone ? ' done-mark' : '');
      const img = document.createElement('img');
      if (it.image) img.src = resolvePreviewSrc(it.image);
      img.alt = '';
      const sp = document.createElement('span');
      sp.textContent = `${i + 1}. ${it.title || 'İsimsiz'}`;
      btn.append(img, sp);
      btn.onclick = () => loadRapidQueueItemAtIndex(i);
      strip.append(btn);
    }
  }

  function renderRapidQueueCard() {
    const adapter = getActiveAdapter();
    const d = state.rapidQueue.draftItem;
    if (!d) return;

    $('#rqTitleLabel').textContent = adapter.titleLabel || 'Başlık';
    $('#rqTitleInput').value = d.title || '';

    const stSel = $('#rqStatusSelect');
    stSel.innerHTML = adapter.statusOptions.map(([val, lbl]) => `<option value="${val}">${lbl}</option>`).join('');
    stSel.value = d.status || adapter.statusOptions[0][0];

    $('#rqNextFieldWrap').hidden = !adapter.supportsNextBadge;
    if (adapter.supportsNextBadge) {
      $('#rqNextSelect').value = d.next === true ? 'yes' : d.next === false ? 'no' : 'auto';
    }

    $('#rqExternalUrlLabel').textContent = adapter.externalUrlLabel || 'Kaynak Linki';
    const urlField = adapter.externalUrlField || 'url';
    const parsed = parseAnilistUrlOrId(d[urlField] || d.url || d.anilistId || d.id);
    $('#rqExternalUrlInput').value = d[urlField] || parsed.url || '';
    $('#rqFetchRelationsBtn').hidden = !adapter.supportsAnilistGraph;

    const extraWrap = $('#rqExtraMetaWrap');
    if (adapter.extraMetaField) {
      extraWrap.hidden = false;
      $('#rqExtraMetaLabel').textContent = adapter.extraMetaField.label;
      $('#rqExtraMetaInput').placeholder = adapter.extraMetaField.placeholder || '';
      $('#rqExtraMetaInput').value = d[adapter.extraMetaField.key] || '';
    } else {
      extraWrap.hidden = true;
    }

    $('#rqPosterImg').src = d.image ? resolvePreviewSrc(d.image) : '';
    $('#rqSubItemsHeading').textContent = adapter.subItemHeading;

    const activeGenres = Array.isArray(d.customGenres) ? d.customGenres : [];
    $('#rqGenresInput').value = activeGenres.join(', ');

    const favBtn = $('#rqFavoriteBtn');
    if (favBtn) {
      const isFav = Boolean(d.favorite);
      favBtn.classList.toggle('on', isFav);
      if (adapter.id === 'guide') {
        favBtn.textContent = isFav ? '★ Öne Çıkan Rehber (Seçili)' : '☆ Öne Çıkan İşaretle';
      } else {
        favBtn.textContent = isFav ? '★ Başyapıt (Seçili)' : '☆ Başyapıt İşaretle';
      }
    }
    if ($('#rqWeightedScoreBadge')) {
      $('#rqWeightedScoreBadge').hidden = adapter.id === 'guide';
    }
    if ($('#rqExternalUrlInput')) {
      const rqUrlPlaceholders = {
        anime: 'https://anilist.co/anime/...',
        series: 'https://www.imdb.com/title/tt... veya tt...',
        movie: 'https://www.imdb.com/title/tt... veya tt...',
        manga: 'https://anilist.co/manga/...',
        book: 'ISBN veya OpenLibrary linki...',
        guide: 'https://www.technopat.net/sosyal/konu/...'
      };
      $('#rqExternalUrlInput').placeholder = rqUrlPlaceholders[adapter.id] || 'https://...';
    }
    if ($('#rqGenresInput')) {
      const rqGenrePlaceholders = {
        anime: 'Shounen, Isekai, Fantastik...',
        series: 'Bilim Kurgu, Suç & Polisiye, Dram...',
        movie: 'Bilim Kurgu, Aksiyon, Dram...',
        manga: 'Seinen, Karanlık Fantezi...',
        book: 'Bilim Kurgu, Felsefe, Klasik...',
        guide: 'Linux & Sistem, Paket Yönetimi, Masaüstü & Özelleştirme...'
      };
      $('#rqGenresInput').placeholder = rqGenrePlaceholders[adapter.id] || 'Kategoriler...';
    }
    const fetchBtn = $('#rqFetchRelationsBtn');
    if (fetchBtn) {
      fetchBtn.hidden = adapter.id === 'guide' || !adapter.supportsAnilistGraph;
      fetchBtn.textContent = adapter.id === 'anime'
        ? 'Linkten Kapak & Yan İçerikleri Çek'
        : adapter.id === 'series' || adapter.id === 'movie'
          ? 'IMDb Linkinden Kapak & Bilgi Çek'
          : 'Linkten Kapak & Bilgi Çek';
    }
    const subItemsContainer = $('#rqSubItemsList')?.closest('.genre-studio, .field-stack, div');
    if (subItemsContainer && $('#rqSubItemsHeading')) {
      subItemsContainer.hidden = adapter.id === 'guide';
    }
    renderRapidQueueGenres();
    renderRapidQueueSubItems();
    syncRapidQueueScoreBadge();
  }

  function syncRapidQueueScoreBadge() {
    const adapter = getActiveAdapter();
    const d = state.rapidQueue.draftItem;
    if (!d) return;
    const eff = adapter.computeScore(d);
    d.score = eff;
    const badge = $('#rqWeightedScoreBadge');
    if (badge) badge.textContent = eff != null ? `★ ${eff}` : 'Puansız';
  }

  function renderRapidQueueGenres() {
    const adapter = getActiveAdapter();
    const container = $('#rqGenreGroups');
    if (!container) return;
    container.replaceChildren();

    const curSet = new Set(
      ($('#rqGenresInput').value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );

    const groups = [...(adapter.categoryGroups || CURATED_GENRE_GROUPS)];
    const extra = (adapter.getCustomCatalog() || []).filter(Boolean);
    if (extra.length) {
      groups.push({ label: 'Sizin Eklediğiniz Özel Kategoriler', items: extra });
    }

    for (const grp of groups) {
      const box = document.createElement('div');
      box.className = 'genre-group-box';
      const lbl = document.createElement('span');
      lbl.className = 'genre-group-label';
      lbl.textContent = grp.label;
      const row = document.createElement('div');
      row.className = 'template-chips';

      for (const gName of grp.items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-chip' + (curSet.has(gName) ? ' on' : '');
        btn.textContent = gName;
        btn.onclick = () => {
          const nextSet = new Set(
            ($('#rqGenresInput').value || '')
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          );
          if (nextSet.has(gName)) nextSet.delete(gName);
          else nextSet.add(gName);
          $('#rqGenresInput').value = [...nextSet].join(', ');
          renderRapidQueueGenres();
        };
        row.append(btn);
      }
      box.append(lbl, row);
      container.append(box);
    }
  }

  function renderRapidQueueSubItems() {
    const adapter = getActiveAdapter();
    const d = state.rapidQueue.draftItem;
    const listEl = $('#rqSubItemsList');
    const bulkChips = $('#rqBulkSeasonScoreChips');
    if (!listEl || !d) return;
    listEl.replaceChildren();

    if (adapter.id === 'guide') {
      if (bulkChips) bulkChips.replaceChildren();
      return;
    }
    if (bulkChips) {
      bulkChips.replaceChildren();
      const lbl = document.createElement('span');
      lbl.textContent = adapter.id === 'book'
        ? 'Tüm Ciltlere Ata:'
        : adapter.id === 'manga'
          ? 'Tüm Kısımlara Ata:'
          : adapter.id === 'movie'
            ? 'Filme Ata:'
            : 'Tüm Sezonlara Ata:';
      bulkChips.append(lbl);
      for (const sc of [7, 7.5, 8, 8.5, 9, 9.5, 10]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rq-mini-sc';
        b.textContent = `★ ${sc}`;
        b.onclick = () => {
          const allP = d.parts || [];
          const targets = allP.filter(p => p.kind === 'season' && p.status !== 'NONE' && p.status !== 'PLANNING');
          const listToScore = targets.length ? targets : allP;
          for (const p of listToScore) {
            p.score = sc;
            p.adminModified = true;
          }
          renderRapidQueueSubItems();
          syncRapidQueueScoreBadge();
        };
        bulkChips.append(b);
      }
    }

    const parts = d.parts || [];
    parts.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'rq-subitem-row';
      const wMap = adapter.subItemWeights || { season: 1.0, movie: 0.35, other: 0.15 };
      const wTag = adapter.id === 'book'
        ? (p.kind === 'movie' ? `Ek ×${wMap.movie}` : p.kind === 'other' ? `Öykü ×${wMap.other}` : `Cilt ×${wMap.season.toFixed(2)}`)
        : adapter.id === 'manga'
          ? (p.kind === 'movie' ? `Özel ×${wMap.movie}` : p.kind === 'other' ? `Yan ×${wMap.other}` : `Seri ×${wMap.season.toFixed(2)}`)
          : adapter.id === 'movie'
            ? (p.kind === 'other' ? `Ek ×${wMap.other}` : `Film ×${wMap.season.toFixed(2)}`)
            : (p.kind === 'movie' ? `Film ×${wMap.movie}` : p.kind === 'other' ? `Yan ×${wMap.other}` : `Sezon ×${wMap.season.toFixed(2)}`);

      row.innerHTML = `
        <div class="rq-subitem-title" title="${AdminSecurity.sanitizeText(p.name || '', 120)}">
          #${idx + 1} · ${AdminSecurity.sanitizeText(p.name || 'Parça', 65)} <small style="opacity:.7">(${wTag})</small>
        </div>
        <div class="rq-subitem-scores"></div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" class="inp glass rq-part-score-inp" min="0" max="10" step="0.1" placeholder="Puan" style="width:74px;height:34px;padding:0 8px;text-align:center;font-weight:650">
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="meta rq-part-ep-lbl">${p.watched || 0}/${p.episodes || 0} ${adapter.subItemUnitLabel}</span>
          <button type="button" class="quick-ep-btn rq-part-plus-btn">+1</button>
          <button type="button" class="quick-ep-btn done rq-part-done-btn">Bitir</button>
        </div>
      `;

      const scWrap = row.querySelector('.rq-subitem-scores');
      const scInp = row.querySelector('.rq-part-score-inp');
      scInp.value = p.score != null ? p.score : '';

      for (const sc of [7, 8, 8.5, 9, 9.5, 10]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rq-mini-sc' + (Number(p.score) === sc ? ' on' : '');
        b.textContent = String(sc);
        b.onclick = () => {
          p.score = sc;
          p.adminModified = true;
          scInp.value = sc;
          renderRapidQueueSubItems();
          syncRapidQueueScoreBadge();
        };
        scWrap.append(b);
      }

      scInp.oninput = () => {
        const val = scInp.value.trim() === '' ? null : Math.min(10, Math.max(0, Math.round(Number(scInp.value) * 10) / 10));
        p.score = isNaN(val) ? null : val;
        p.adminModified = true;
        syncRapidQueueScoreBadge();
      };

      row.querySelector('.rq-part-plus-btn').onclick = () => {
        const tot = Number(p.episodes) || 0;
        const cur = Number(p.watched) || 0;
        p.watched = tot > 0 ? Math.min(tot, cur + 1) : (cur + 1);
        p.status = (tot > 0 && p.watched >= tot) ? 'COMPLETED' : 'CURRENT';
        p.adminModified = true;
        renderRapidQueueSubItems();
      };

      row.querySelector('.rq-part-done-btn').onclick = () => {
        const tot = Number(p.episodes) || 0;
        p.watched = tot > 0 ? tot : Math.max(1, Number(p.watched) || 0);
        p.status = 'COMPLETED';
        p.adminModified = true;
        renderRapidQueueSubItems();
      };

      listEl.append(row);
    });
  }

  function commitCurrentRapidQueueDraft(advanceNext = true) {
    const adapter = getActiveAdapter();
    const d = state.rapidQueue.draftItem;
    if (!d) return;

    const S = AdminSecurity.sanitizeText;
    const U = AdminSecurity.sanitizeUrl;
    d.title = S($('#rqTitleInput').value, 200) || d.title;
    d.status = $('#rqStatusSelect').value || d.status;

    if (adapter.supportsNextBadge) {
      const nx = $('#rqNextSelect').value;
      if (nx === 'yes') d.next = true;
      else if (nx === 'no') delete d.next;
    }

    const rawUrl = $('#rqExternalUrlInput').value.trim();
    if (adapter.id === 'anime') {
      const parsed = parseAnilistUrlOrId(rawUrl || d.anilistId || d.id);
      if (parsed.id) {
        d.anilistId = parsed.id;
        d.url = parsed.url;
        d.firstSeasonUrl = U(rawUrl, false) || parsed.url;
      }
    } else if (adapter.externalUrlField) {
      d[adapter.externalUrlField] = U(rawUrl, true);
    }

    if (adapter.extraMetaField) {
      d[adapter.extraMetaField.key] = S($('#rqExtraMetaInput').value, 160);
    }

    const customGenres = [
      ...new Set(
        ($('#rqGenresInput').value || '')
          .split(',')
          .map(g => S(g, 40))
          .filter(Boolean)
      )
    ];
    if (customGenres.length) {
      d.customGenres = customGenres;
      d.genres = customGenres;
    } else {
      delete d.customGenres;
      delete d.genres;
    }

    d.score = adapter.computeScore(d);
    state.rapidQueue.editedInSession.add(d.id);
    adapter.saveItem(structuredClone(d));

    if (advanceNext) {
      const qIds = state.rapidQueue.queueIds || [];
      if (state.rapidQueue.currentIndex < qIds.length - 1) {
        loadRapidQueueItemAtIndex(state.rapidQueue.currentIndex + 1);
        toast(`"${d.title}" kaydedildi → Sıradaki girdiye geçildi.`);
      } else {
        renderRapidQueueProgressAndStrip();
        toast(`"${d.title}" kaydedildi! Kuyruktaki son girdiyi tamamladınız.`);
      }
    } else {
      renderRapidQueueProgressAndStrip();
      toast(`"${d.title}" kaydedildi.`);
    }
  }

  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 14 — VERİ SAĞLIĞI DENETÇİSİ VE TAM YEDEKLEME MERKEZİ]
  // ============================================================================
  // [AI-MIMARI-NOTU]: GitHub Commit Geçmişinden `data/anime.json` (veya `sections.json`)
  // kurtarma ve akıllı birleştirme motoru. Eski bir commit'teki `customGenres`, `genres`,
  // `score`, `parts` (ve sezon puanları), `favorite`, `title` ve `status` düzenlemelerini
  // yeni şemayı hiç bozmadan mevcut veriye aktarır.
  function mergeHistoricalAnimeData(oldData, replaceEntirely = false) {
    const oldList = Array.isArray(oldData && oldData.anime) ? oldData.anime : [];
    if (!oldList.length) throw new Error('Seçilen commit içinde anime listesi bulunamadı.');

    if (Array.isArray(oldData.customGenreCatalog) && oldData.customGenreCatalog.length) {
      const catSet = new Set([...(state.animeData.customGenreCatalog || []), ...oldData.customGenreCatalog]);
      state.animeData.customGenreCatalog = [...catSet];
    }

    if (replaceEntirely) {
      for (const a of oldList) {
        const parsed = parseAnilistUrlOrId(a.firstSeasonUrl || a.url || a.anilistId || a.id);
        if (parsed.id) {
          a.anilistId = parsed.id;
          if (!a.firstSeasonUrl) a.firstSeasonUrl = parsed.url;
          if (!a.url) a.url = parsed.url;
        }
        a.score = resolveEffectiveScore(a);
      }
      state.animeData.anime = oldList;
    } else {
      const curById = new Map();
      const curByAid = new Map();
      for (const cur of state.animeData.anime || []) {
        curById.set(cur.id, cur);
        if (cur.anilistId) curByAid.set(Number(cur.anilistId), cur);
      }

      for (const oldItem of oldList) {
        const aid = Number(oldItem.anilistId) || parseAnilistUrlOrId(oldItem.firstSeasonUrl || oldItem.url || oldItem.id).id;
        const target = curById.get(oldItem.id) || (aid ? curByAid.get(aid) : null);
        if (target) {
          if (oldItem.title) target.title = oldItem.title;
          if (oldItem.status) target.status = oldItem.status;
          if (oldItem.favorite) target.favorite = true;
          if (Array.isArray(oldItem.customGenres) && oldItem.customGenres.length) {
            target.customGenres = [...oldItem.customGenres];
            target.genres = [...oldItem.customGenres];
          } else if (oldItem.adminModified && Array.isArray(oldItem.genres) && oldItem.genres.length) {
            target.customGenres = [...oldItem.genres];
            target.genres = [...oldItem.genres];
          }
          if (Array.isArray(oldItem.parts) && oldItem.parts.length) {
            const oldPartsById = new Map(oldItem.parts.map(p => [String(p.id), p]));
            for (const tp of target.parts || []) {
              const op = oldPartsById.get(String(tp.id));
              if (op) {
                if (op.score != null) tp.score = op.score;
                if (op.watched != null) tp.watched = op.watched;
                if (op.status) tp.status = op.status;
                if (op.repeat != null) tp.repeat = op.repeat;
                if (op.adminModified) tp.adminModified = true;
              }
            }
          }
          if (oldItem.score != null) {
            const anyPartSc = (target.parts || []).some(p => p && p.score != null && Number(p.score) > 0);
            if (!anyPartSc) {
              for (const p of (target.parts || []).filter(x => x.kind === 'season' && x.status === 'COMPLETED')) {
                p.score = Number(oldItem.score);
              }
            }
            target.score = resolveEffectiveScore(target) ?? oldItem.score;
          } else {
            target.score = resolveEffectiveScore(target);
          }
          if (oldItem.adminModified) target.adminModified = true;
          if (Array.isArray(oldItem.lockedFields)) {
            target.lockedFields = [...new Set([...(target.lockedFields || []), ...oldItem.lockedFields])];
          }
        } else {
          oldItem.score = resolveEffectiveScore(oldItem);
          state.animeData.anime.push(oldItem);
        }
      }
    }

    state.animeData.anime.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || (a.title || '').localeCompare(b.title || '', 'tr'));
    state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
    state.animeData.updated = new Date().toISOString().slice(0, 10);
    markDirty('anime');
    renderAnimeAdminPanel();
    renderHealthAuditor();
  }

  async function fetchAndRenderCommitHistory() {
    const listEl = $('#commitHistoryList');
    const btn = $('#fetchCommitHistoryBtn');
    const filePath = ($('#commitHistoryFileSelect') && $('#commitHistoryFileSelect').value) || 'data/anime.json';
    if (!listEl || !btn) return;
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Commit Geçmişi Çekiliyor...';
    try {
      const commits = await AdminSecurity.githubListFileCommits(filePath, 20);
      listEl.replaceChildren();
      if (!Array.isArray(commits) || !commits.length) {
        listEl.innerHTML = `<p class="help-txt" style="margin:0">Bu dosya için commit geçmişi bulunamadı.</p>`;
        return;
      }
      for (const c of commits) {
        const sha = c.sha || '';
        const shortSha = sha.slice(0, 7);
        const msg = (c.commit && c.commit.message) ? c.commit.message.split('\n')[0] : 'Commit';
        const dateRaw = (c.commit && c.commit.author && c.commit.author.date) || '';
        const dateStr = dateRaw ? new Date(dateRaw).toLocaleString('tr-TR') : '';
        const author = (c.commit && c.commit.author && c.commit.author.name) || '';

        const item = document.createElement('div');
        item.className = 'editor-item';
        item.style.padding = '12px 16px';
        item.innerHTML = `
          <div class="editor-item-head">
            <div>
              <strong style="font-size:.93rem"><code>${AdminSecurity.sanitizeText(shortSha, 12)}</code> · ${AdminSecurity.sanitizeText(msg, 120)}</strong>
              <p class="meta" style="margin-top:2px">🕒 ${AdminSecurity.sanitizeText(dateStr, 60)} · Yazar: ${AdminSecurity.sanitizeText(author, 60)}</p>
            </div>
            <div class="form-actions" style="margin:0">
              ${filePath === 'data/anime.json' ? `<button type="button" class="btn-primary commit-merge-btn">⚡ Kategorileri &amp; Puanları Kurtar (Birleştir)</button>` : ''}
              <button type="button" class="btn-secondary commit-replace-btn">Tamamen Bu Commit'e Dön</button>
            </div>
          </div>
        `;
        const restoreFn = async (replaceAll) => {
          try {
            toast(`${shortSha} commit'inden ${filePath} çekiliyor...`);
            const rawJsonStr = await AdminSecurity.githubGetFileAtRef(filePath, sha);
            const parsed = JSON.parse(rawJsonStr);
            if (filePath === 'data/anime.json') {
              mergeHistoricalAnimeData(parsed, replaceAll);
              toast(`"${shortSha}" (${dateStr}) commit'indeki tüm kategori ve puanlar başarıyla kurtarıldı! Şimdi üstten "GitHub'a Kaydet" butonuna basabilirsiniz.`);
            } else if (filePath === 'data/sections.json') {
              state.config = normalizeConfig(parsed);
              populateEditorFields();
              markDirty('config');
              toast(`"${shortSha}" commit'indeki site ayarları geri yüklendi!`);
            } else if (filePath === 'data/overrides.json') {
              state.overrides = { ...state.overrides, ...parsed };
              renderOverridesEditor();
              markDirty('overrides');
              toast(`"${shortSha}" commit'indeki kurallar geri yüklendi!`);
            }
          } catch (err) {
            toast('Kurtarma hatası: ' + err.message, 'err');
          }
        };
        const mBtn = item.querySelector('.commit-merge-btn');
        if (mBtn) mBtn.onclick = () => restoreFn(false);
        item.querySelector('.commit-replace-btn').onclick = () => restoreFn(true);
        listEl.append(item);
      }
      toast(`${commits.length} geçmiş commit listelendi.`);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  function computeHealthReport(typeId) {
    const adapter = CONTENT_ADAPTER_REGISTRY[typeId] || CONTENT_ADAPTER_REGISTRY.anime;
    const items = adapter.getItems() || [];
    const missingGenres = [];
    const missingScore = [];
    const missingCover = [];
    const missingUrl = [];
    const unwatchedSequels = [];

    for (const it of items) {
      const hasGenres = Array.isArray(it.customGenres) && it.customGenres.length > 0;
      if (!hasGenres) missingGenres.push(it);

      if (typeId !== 'guide') {
        const effScore = adapter.computeScore(it);
        if (effScore == null && (it.status === 'completed' || it.status === 'watching')) {
          missingScore.push(it);
        }
        if (!it.image) missingCover.push(it);
      }

      const extUrl = it[adapter.externalUrlField || 'url'] || it.url || it.firstSeasonUrl || '';
      if (!extUrl) missingUrl.push(it);

      if (typeId === 'anime' || typeId === 'series') {
        const parts = it.parts || [];
        const hasUnwatched = parts.some(p => p.kind === 'season' && (p.watched || 0) === 0 && (p.release === 'FINISHED' || p.release === 'RELEASING'));
        if (it.next || hasUnwatched) unwatchedSequels.push(it);
      }
    }

    return [
      {
        key: 'missing_genres',
        title: 'Özel Kategorisi Seçilmemiş Olanlar',
        desc: 'Henüz özel tür/kategori (Shounen, Seinen, Isekai vb.) atanmamış kayıtlar.',
        items: missingGenres
      },
      {
        key: 'missing_score',
        title: 'Puanı Girilmemiş Olanlar',
        desc: 'İzlendi/Okundu veya devam ediyor olup henüz sezon/parça puanı verilmemiş kayıtlar.',
        items: missingScore
      },
      {
        key: 'missing_cover',
        title: "Kapak Görseli URL'si Eksik Olanlar",
        desc: 'Poster/kapak görseli bağlantısı boş olan kayıtlar.',
        items: missingCover
      },
      {
        key: 'missing_url',
        title: `${adapter.externalUrlLabel || 'Kaynak Linki'} Eksik Olanlar`,
        desc: 'Dış kaynak veya Technopat Sosyal bağlantısı girilmemiş kayıtlar.',
        items: missingUrl
      },
      {
        key: 'unwatched_sequels',
        title: 'İzlenmemiş Devam Sezonu Bulunanlar',
        desc: 'Yayınlanmış fakat henüz izlenmemiş sezonu bulunan yapımlar.',
        items: unwatchedSequels
      }
    ];
  }

  function sendHealthItemsToRapidQueue(typeId, targetItems, issueTitle) {
    if (!targetItems || !targetItems.length) return;
    state.rapidQueue.activeType = typeId;
    state.rapidQueue.customTargetIds = targetItems.map(x => x.id);
    if ($('#rqContentTypeSelect')) $('#rqContentTypeSelect').value = typeId;

    // Ensure custom option exists in #rqFilterSelect
    const sel = $('#rqFilterSelect');
    if (sel) {
      let opt = sel.querySelector('option[value="health_custom"]');
      if (!opt) {
        opt = document.createElement('option');
        opt.value = 'health_custom';
        sel.prepend(opt);
      }
      opt.textContent = `🛡️ Denetim: ${issueTitle} (${targetItems.length})`;
      sel.value = 'health_custom';
    }

    $$('[data-panel]').forEach(b => b.setAttribute('aria-selected', b.dataset.panel === 'rapid'));
    $('#panelHealth').hidden = true;
    $('#panelAnime').hidden = true;
    $('#panelRapid').hidden = false;
    initOrRefreshRapidQueue(false);
    toast(`${targetItems.length} kayıt Hızlı Sıralı Düzenleme kuyruğuna aktarıldı.`);
  }

  function renderHealthAuditor() {
    const grid = $('#healthAuditGrid');
    if (!grid) return;
    const typeId = ($('#healthSectionSelect') && $('#healthSectionSelect').value) || state.activeAdminMediaType || 'anime';
    const adapter = CONTENT_ADAPTER_REGISTRY[typeId] || CONTENT_ADAPTER_REGISTRY.anime;
    const totalCount = (adapter.getItems() || []).length;
    const groups = computeHealthReport(typeId);

    grid.replaceChildren();
    for (const grp of groups) {
      const card = document.createElement('div');
      card.className = 'health-card';
      const cnt = grp.items.length;
      card.innerHTML = `
        <div>
          <div class="health-card-top">
            <strong style="font-size:.95rem">${grp.title}</strong>
            <span class="health-count ${cnt === 0 ? 'ok' : 'warn'}">${cnt} / ${totalCount}</span>
          </div>
          <p class="meta" style="margin-top:4px">${grp.desc}</p>
        </div>
        <div class="health-sample-list"></div>
        <div class="form-actions" style="margin:0">
          <button type="button" class="btn-secondary health-queue-btn" ${cnt === 0 ? 'disabled' : ''} style="width:100%">
            ${cnt === 0 ? '✓ Eksik Kayıt Yok' : `⚡ ${cnt} Kaydı Hızlı Düzenleme Kuyruğuna Gönder`}
          </button>
        </div>
      `;
      const sampleBox = card.querySelector('.health-sample-list');
      if (cnt === 0) {
        sampleBox.innerHTML = `<div class="health-sample-item"><span>Tüm kayıtlar tam!</span><span>✓</span></div>`;
      } else {
        for (const it of grp.items.slice(0, 6)) {
          const row = document.createElement('div');
          row.className = 'health-sample-item';
          const sp = document.createElement('span');
          sp.textContent = it.title || it.id;
          sp.style.overflow = 'hidden';
          sp.style.textOverflow = 'ellipsis';
          sp.style.whiteSpace = 'nowrap';
          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn-subtle';
          editBtn.style.padding = '3px 9px';
          editBtn.style.fontSize = '.74rem';
          editBtn.textContent = 'Düzenle';
          editBtn.onclick = () => {
            state.activeAdminMediaType = typeId;
            if ($('#admMediaTypeSelect')) $('#admMediaTypeSelect').value = typeId;
            renderAnimeAdminPanel();
            openAnimeEditor(it.id);
          };
          row.append(sp, editBtn);
          sampleBox.append(row);
        }
      }
      card.querySelector('.health-queue-btn').onclick = () => sendHealthItemsToRapidQueue(typeId, grp.items, grp.title);
      grid.append(card);
    }
  }

  function exportFullBackupSnapshot() {
    collectFormFieldsIntoConfig();
    state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
    const bundles = {
      sections: state.config,
      anime: state.animeData,
      overrides: state.overrides
    };
    for (const mKey of ['series', 'movie', 'manga', 'book', 'guide']) {
      const store = ensureMultiMediaStore(mKey);
      bundles[mKey] = {
        schemaVersion: 3,
        updated: new Date().toISOString().slice(0, 10),
        source: 'site-first:' + mKey,
        customGenreCatalog: store.customGenreCatalog || [],
        stats: computeStatsClient(store.items || [], state.animeData.statsConfig),
        items: store.items || []
      };
    }
    const snapshot = {
      snapshotVersion: 1,
      site: 'tempestian.github.io',
      exportedAt: new Date().toISOString(),
      counts: {
        anime: (state.animeData.anime || []).length,
        series: (bundles.series.items || []).length,
        movie: (bundles.movie.items || []).length,
        manga: (bundles.manga.items || []).length,
        book: (bundles.book.items || []).length,
        guide: (bundles.guide.items || []).length
      },
      bundles
    };
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlobJson(snapshot, `tempestian-backup-${dateStr}.json`);
    toast('Tüm site verileri tek yedek paketinde indirildi!');
  }

  async function restoreFullBackupSnapshot() {
    const fInp = $('#importSnapshotFile');
    const f = fInp && fInp.files && fInp.files[0];
    if (!f) {
      toast('Lütfen önce bir yedek dosyası (.json) seçin.', 'warn');
      return;
    }
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      if (!parsed || !parsed.bundles || typeof parsed.bundles !== 'object') {
        throw new Error('Geçersiz yedek paketi formatı.');
      }
      const b = parsed.bundles;
      if (b.sections) {
        state.config = normalizeConfig(b.sections);
        state.dirtyConfig = true;
      }
      if (b.anime && Array.isArray(b.anime.anime)) {
        state.animeData = b.anime;
        state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
        state.dirtyAnime = true;
      }
      if (b.overrides) {
        state.overrides = b.overrides;
        state.dirtyOverrides = true;
      }
      for (const mKey of ['series', 'movie', 'manga', 'book', 'guide']) {
        if (b[mKey] && Array.isArray(b[mKey].items)) {
          state.multiMediaStore[mKey] = {
            items: b[mKey].items,
            customGenreCatalog: Array.isArray(b[mKey].customGenreCatalog) ? b[mKey].customGenreCatalog : [],
            stats: computeStatsClient(b[mKey].items, state.animeData.statsConfig),
            dirty: true
          };
        }
      }
      populateEditorFields();
      renderAnimeAdminPanel();
      renderOverridesEditor();
      renderHealthAuditor();
      updateDirtyIndicator();
      const sumBox = $('#snapshotSummaryBox');
      if (sumBox) {
        sumBox.hidden = false;
        sumBox.innerHTML = `<span>Yedek paketi (<b>${AdminSecurity.sanitizeText(parsed.exportedAt || '', 40)}</b>) başarıyla geri yüklendi! Üstteki <b>GitHub'a Kaydet (Commit)</b> butonuyla tüm dosyaları depoya yazabilirsiniz.</span>`;
      }
      toast('Yedek paketi başarıyla geri yüklendi!');
    } catch (err) {
      toast('Yedek geri yüklenemedi: ' + err.message, 'err');
    }
  }

  function populateEditorFields() {
    const { site, gift, pages } = state.config;
    const pa = (pages && pages.anime) || {};

    $('#cfgSiteTitle').value = site.title || '';
    $('#cfgSiteSubtitle').value = site.subtitle || '';
    $('#cfgSiteBarTitle').value = site.barTitle || '';
    $('#cfgSiteHomeLabel').value = site.homeLabel || '';
    $('#cfgSiteDesc').value = site.description || '';

    $('#cfgAnimeTitle').value = pa.title || '';
    $('#cfgAnimeMetaTitle').value = pa.metaTitle || '';
    $('#cfgAnimeDesc').value = pa.description || '';
    $('#cfgAnimeSearch').value = pa.searchPlaceholder || '';
    $('#cfgAnimeEmpty').value = pa.emptyText || '';
    $('#cfgAnimeDetails').value = pa.detailsText || '';
    $('#cfgAnimeReset').value = pa.resetFilterText || '';
    $('#cfgAnimeAlBtn').value = pa.anilistButtonText || '';
    $('#cfgAnimeFooter').value = pa.footerText || '';

    $('#cfgGiftEnabled').checked = gift.enabled !== false;
    $('#cfgGiftLead').value = gift.leadText || '';
    $('#cfgGiftTarget').value = gift.targetDate || '';
    $('#cfgGiftDateLabel').value = gift.dateLabel || '';
    $('#cfgGiftExpLead').value = gift.expiredLeadText || '';
    $('#cfgGiftExpSub').value = gift.expiredSubText || '';
    $('#cfgGiftExpUrl').value = gift.expiredUrl || '';
    $('#cfgGiftUnitD').value = (gift.units && gift.units.d) || 'Gün';
    $('#cfgGiftUnitH').value = (gift.units && gift.units.h) || 'Saat';
    $('#cfgGiftUnitM').value = (gift.units && gift.units.m) || 'Dakika';
    $('#cfgGiftUnitS').value = (gift.units && gift.units.s) || 'Saniye';

    renderImageSlots();
    renderCategoriesEditor();
    renderCustomBoxesEditor();
    renderLinksEditor();
  }

  function collectFormFieldsIntoConfig() {
    const S = AdminSecurity.sanitizeText;
    const U = AdminSecurity.sanitizeUrl;
    const { site, gift, pages } = state.config;

    site.title = S($('#cfgSiteTitle').value, 120) || 'Tempestian';
    site.subtitle = S($('#cfgSiteSubtitle').value, 120);
    site.barTitle = S($('#cfgSiteBarTitle').value, 120) || site.title;
    site.homeLabel = S($('#cfgSiteHomeLabel').value, 80) || 'Ana sayfa';
    site.description = S($('#cfgSiteDesc').value, 300);

    pages.anime = {
      title: S($('#cfgAnimeTitle').value, 120) || 'Anime',
      metaTitle: S($('#cfgAnimeMetaTitle').value, 140) || 'Anime · Tempestian',
      description: S($('#cfgAnimeDesc').value, 300),
      searchPlaceholder: S($('#cfgAnimeSearch').value, 80) || 'Ara',
      emptyText: S($('#cfgAnimeEmpty').value, 160) || 'Eşleşen anime yok.',
      detailsText: S($('#cfgAnimeDetails').value, 80) || 'Ayrıntılar',
      resetFilterText: S($('#cfgAnimeReset').value, 80) || 'Filtreleri sıfırla',
      anilistButtonText: S($('#cfgAnimeAlBtn').value, 80) || "AniList'te aç",
      footerText: S($('#cfgAnimeFooter').value, 400)
    };

    gift.enabled = Boolean($('#cfgGiftEnabled').checked);
    gift.leadText = S($('#cfgGiftLead').value, 200);
    gift.targetDate = S($('#cfgGiftTarget').value, 60) || '2026-10-27T00:00:00+03:00';
    gift.dateLabel = S($('#cfgGiftDateLabel').value, 140);
    gift.expiredLeadText = S($('#cfgGiftExpLead').value, 200);
    gift.expiredSubText = S($('#cfgGiftExpSub').value, 200);
    gift.expiredUrl = U($('#cfgGiftExpUrl').value, true);
    gift.units = {
      d: S($('#cfgGiftUnitD').value, 30) || 'Gün',
      h: S($('#cfgGiftUnitH').value, 30) || 'Saat',
      m: S($('#cfgGiftUnitM').value, 30) || 'Dakika',
      s: S($('#cfgGiftUnitS').value, 30) || 'Saniye'
    };
  }

  function resolvePreviewSrc(pathOrUrl) {
    if (!pathOrUrl) return '';
    const clean = pathOrUrl.replace(/^\.?\//, '');
    if (state.pendingUploads.has(clean)) {
      return state.pendingUploads.get(clean).previewUrl;
    }
    return UI.resolveAsset(pathOrUrl);
  }

  function renderImageSlots() {
    const grid = $('#imageSlotsGrid');
    if (!grid) return;
    grid.replaceChildren();
    for (const slot of IMAGE_SLOTS) {
      const curVal = state.config.site[slot.key] ?? slot.defaultPath;
      const card = document.createElement('div');
      card.className = 'img-slot-card';
      card.innerHTML = `
        <div class="img-slot-top">
          <div class="img-preview-box"><img alt=""></div>
          <div>
            <strong></strong>
            <p class="meta"></p>
          </div>
        </div>
        <label class="field">
          <span>Görsel Yolu veya URL</span>
          <input type="text" class="inp glass slot-path-inp">
        </label>
        <label class="field">
          <span>Bilgisayardan Yeni Görsel Seç</span>
          <input type="file" accept="image/*" class="inp glass file-inp slot-file-inp">
        </label>
      `;
      card.querySelector('strong').textContent = slot.label;
      card.querySelector('.meta').textContent = slot.desc;
      const imgEl = card.querySelector('img');
      const src = resolvePreviewSrc(curVal);
      if (src) imgEl.src = src;
      const pathInp = card.querySelector('.slot-path-inp');
      pathInp.value = curVal;
      pathInp.oninput = () => {
        state.config.site[slot.key] = AdminSecurity.sanitizeUrl(pathInp.value, true);
        imgEl.src = resolvePreviewSrc(state.config.site[slot.key]);
        markDirty('config');
      };
      const fileInp = card.querySelector('.slot-file-inp');
      fileInp.onchange = async () => {
        const f = fileInp.files && fileInp.files[0];
        if (!f) return;
        const targetPath = (pathInp.value.trim() && /^assets\/img\//.test(pathInp.value.trim()))
          ? pathInp.value.trim()
          : slot.defaultPath;
        await queueImageUpload(f, targetPath);
        state.config.site[slot.key] = targetPath;
        pathInp.value = targetPath;
        imgEl.src = resolvePreviewSrc(targetPath);
        markDirty('config');
      };
      grid.append(card);
    }
    renderPendingUploadsList();
  }

  async function queueImageUpload(file, targetPath) {
    const cleanTarget = targetPath.replace(/^\/+/, '');
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const previewUrl = URL.createObjectURL(file);
    state.pendingUploads.set(cleanTarget, {
      bytes,
      previewUrl,
      fileName: file.name,
      size: file.size
    });
    renderPendingUploadsList();
    updateDirtyIndicator();
    toast(`${cleanTarget} yükleme kuyruğuna eklendi.`);
  }

  function renderPendingUploadsList() {
    const box = $('#pendingUploadsBox');
    const ul = $('#pendingUploadsList');
    if (!box || !ul) return;
    if (!state.pendingUploads.size) {
      box.hidden = true;
      ul.replaceChildren();
      return;
    }
    box.hidden = false;
    ul.replaceChildren();
    for (const [path, info] of state.pendingUploads.entries()) {
      const li = document.createElement('li');
      const sp = document.createElement('span');
      sp.textContent = `${path} (${Math.round(info.size / 1024)} KB)`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn-danger';
      rm.textContent = 'Kaldır';
      rm.onclick = () => {
        state.pendingUploads.delete(path);
        renderImageSlots();
        updateDirtyIndicator();
      };
      li.append(sp, rm);
      ul.append(li);
    }
  }

  function renderCategoriesEditor() {
    const wrap = $('#categoriesList');
    if (!wrap) return;
    wrap.replaceChildren();
    const icons = (window.UI && window.UI.icons) || ['anime', 'manga', 'book', 'movie', 'series', 'guide', 'game', 'music', 'code', 'star', 'sparkle', 'info', 'dot'];

    state.config.sections.forEach((sec, idx) => {
      const item = document.createElement('div');
      item.className = 'editor-item';
      const iconOpts = icons.map(ic => `<option value="${ic}"${(sec.icon || sec.id) === ic ? ' selected' : ''}>${ic}</option>`).join('');
      item.innerHTML = `
        <div class="editor-item-head">
          <div class="editor-item-title">
            <span class="sec-ic-preview"></span>
            <span class="sec-title-lbl"></span>
          </div>
          <div class="editor-item-actions">
            <button type="button" class="icon-btn" data-act="up" title="Yukarı taşı">↑</button>
            <button type="button" class="icon-btn" data-act="down" title="Aşağı taşı">↓</button>
            <button type="button" class="icon-btn del" data-act="del" title="Kategoriyi sil">✕</button>
          </div>
        </div>
        <div class="field-row">
          <label class="field">
            <span>Kategori Kimliği (id)</span>
            <input type="text" class="inp glass" data-f="id">
          </label>
          <label class="field">
            <span>Başlık</span>
            <input type="text" class="inp glass" data-f="title">
          </label>
          <label class="field">
            <span>Sayfa Yolu (path)</span>
            <input type="text" class="inp glass" data-f="path" placeholder="anime/">
          </label>
          <label class="field">
            <span>Durum</span>
            <select class="inp glass" data-f="status">
              <option value="active">Aktif (Tıklanabilir &amp; Menüde)</option>
              <option value="soon">Yakında (Etiketli Kutucuk)</option>
              <option value="hidden">Gizli (Taslak)</option>
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span>İkon</span>
            <select class="inp glass" data-f="icon">${iconOpts}</select>
          </label>
          <label class="field">
            <span>Etiket / Açıklama (Yakında etiketi)</span>
            <input type="text" class="inp glass" data-f="description" placeholder="İzlediğim animeler / Yakında">
          </label>
          <label class="field">
            <span>Kutucuk Alt Metni (İsteğe bağlı)</span>
            <input type="text" class="inp glass" data-f="subtitle" placeholder="Ek açıklama satırı">
          </label>
        </div>
        <div class="field-row align-end">
          <label class="field">
            <span>Veri Dosyası (data)</span>
            <input type="text" class="inp glass" data-f="data" placeholder="data/anime.json">
          </label>
          <label class="field">
            <span>Veri Dizi Anahtarı (countKey)</span>
            <input type="text" class="inp glass" data-f="countKey" placeholder="anime">
          </label>
          <label class="field">
            <span>Sayaç Birimi (unit)</span>
            <input type="text" class="inp glass" data-f="unit" placeholder="anime">
          </label>
          <label class="toggle-switch">
            <input type="checkbox" data-f="showStrip">
            <span>4'lü Kapak Şeridini Göster</span>
          </label>
        </div>
      `;

      const updateHeader = () => {
        item.querySelector('.sec-ic-preview').innerHTML = UI.icon(sec.icon || sec.id);
        item.querySelector('.sec-title-lbl').textContent = `${sec.title || 'İsimsiz Kategori'} (${sec.status === 'active' ? 'Aktif' : sec.status === 'soon' ? 'Yakında' : 'Gizli'})`;
      };
      updateHeader();

      item.querySelectorAll('[data-f]').forEach(inp => {
        const f = inp.dataset.f;
        if (inp.type === 'checkbox') {
          inp.checked = sec[f] !== false;
          inp.onchange = () => { sec[f] = inp.checked; markDirty('config'); };
        } else {
          inp.value = sec[f] || '';
          inp.oninput = () => {
            sec[f] = f === 'path' || f === 'data'
              ? AdminSecurity.sanitizeUrl(inp.value, true)
              : AdminSecurity.sanitizeText(inp.value, 160);
            updateHeader();
            markDirty('config');
          };
        }
      });

      item.querySelector('[data-act="up"]').onclick = () => {
        if (idx === 0) return;
        const arr = state.config.sections;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        renderCategoriesEditor();
        markDirty('config');
      };
      item.querySelector('[data-act="down"]').onclick = () => {
        const arr = state.config.sections;
        if (idx >= arr.length - 1) return;
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        renderCategoriesEditor();
        markDirty('config');
      };
      item.querySelector('[data-act="del"]').onclick = () => {
        state.config.sections.splice(idx, 1);
        renderCategoriesEditor();
        markDirty('config');
      };

      wrap.append(item);
    });
  }

  function renderCustomBoxesEditor() {
    const wrap = $('#customBoxesList');
    if (!wrap) return;
    wrap.replaceChildren();
    if (!state.config.boxes.length) {
      const p = document.createElement('p');
      p.className = 'help-txt';
      p.textContent = 'Henüz özel kutucuk eklenmemiş. "+ Özel Kutucuk Ekle" butonuyla ana sayfaya duyuru veya bilgi kartı ekleyebilirsiniz.';
      wrap.append(p);
      return;
    }
    const icons = ['', ...((window.UI && window.UI.icons) || ['info', 'sparkle', 'star'])];

    state.config.boxes.forEach((box, idx) => {
      const item = document.createElement('div');
      item.className = 'editor-item';
      const iconOpts = icons.map(ic => `<option value="${ic}"${(box.icon || '') === ic ? ' selected' : ''}>${ic || 'İkon Yok'}</option>`).join('');
      item.innerHTML = `
        <div class="editor-item-head">
          <div class="editor-item-title">
            <span class="box-title-lbl"></span>
          </div>
          <div class="editor-item-actions">
            <label class="toggle-switch">
              <input type="checkbox" data-bf="enabled">
              <span>Aktif</span>
            </label>
            <button type="button" class="icon-btn" data-bact="up" title="Yukarı taşı">↑</button>
            <button type="button" class="icon-btn" data-bact="down" title="Aşağı taşı">↓</button>
            <button type="button" class="icon-btn del" data-bact="del" title="Kutucuğu sil">✕</button>
          </div>
        </div>
        <div class="field-row">
          <label class="field">
            <span>Kutucuk Başlığı</span>
            <input type="text" class="inp glass" data-bf="title" placeholder="Duyuru / Hakkımda">
          </label>
          <label class="field">
            <span>Sağ Üst Etiket (badge)</span>
            <input type="text" class="inp glass" data-bf="badge" placeholder="Yeni / Güncel">
          </label>
          <label class="field">
            <span>Konum</span>
            <select class="inp glass" data-bf="position">
              <option value="above">Kategorilerin Üstünde</option>
              <option value="below">Kategorilerin Altında</option>
            </select>
          </label>
          <label class="field">
            <span>Genişlik</span>
            <select class="inp glass" data-bf="span">
              <option value="full">Tam Genişlik</option>
              <option value="half">Yarım Genişlik (Kart)</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>Kutucuk Metni / İçeriği</span>
          <textarea class="inp glass" rows="2" data-bf="text" placeholder="Kutucuk içinde görünecek açıklama..."></textarea>
        </label>
        <div class="field-row">
          <label class="field">
            <span>İkon Seçimi</span>
            <select class="inp glass" data-bf="icon">${iconOpts}</select>
          </label>
          <label class="field">
            <span>Görsel Yolu / URL (İsteğe bağlı)</span>
            <input type="text" class="inp glass" data-bf="image" placeholder="assets/img/...">
          </label>
          <label class="field">
            <span>Tıklama Bağlantısı URL (İsteğe bağlı)</span>
            <input type="text" class="inp glass" data-bf="url" placeholder="https://... veya alt-sayfa/">
          </label>
        </div>
      `;

      const updateTitle = () => {
        item.querySelector('.box-title-lbl').textContent = box.title || `Özel Kutucuk #${idx + 1}`;
      };
      updateTitle();

      item.querySelectorAll('[data-bf]').forEach(inp => {
        const f = inp.dataset.bf;
        if (inp.type === 'checkbox') {
          inp.checked = box[f] !== false;
          inp.onchange = () => { box[f] = inp.checked; markDirty('config'); };
        } else {
          inp.value = box[f] || (f === 'position' ? 'above' : f === 'span' ? 'full' : '');
          inp.oninput = () => {
            box[f] = (f === 'url' || f === 'image')
              ? AdminSecurity.sanitizeUrl(inp.value, true)
              : AdminSecurity.sanitizeText(inp.value, 600);
            updateTitle();
            markDirty('config');
          };
        }
      });

      item.querySelector('[data-bact="up"]').onclick = () => {
        if (idx === 0) return;
        const arr = state.config.boxes;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        renderCustomBoxesEditor();
        markDirty('config');
      };
      item.querySelector('[data-bact="down"]').onclick = () => {
        const arr = state.config.boxes;
        if (idx >= arr.length - 1) return;
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        renderCustomBoxesEditor();
        markDirty('config');
      };
      item.querySelector('[data-bact="del"]').onclick = () => {
        state.config.boxes.splice(idx, 1);
        renderCustomBoxesEditor();
        markDirty('config');
      };

      wrap.append(item);
    });
  }

  function renderLinksEditor() {
    const wrap = $('#linksList');
    if (!wrap) return;
    wrap.replaceChildren();
    state.config.links.forEach((lnk, idx) => {
      const item = document.createElement('div');
      item.className = 'editor-item';
      item.innerHTML = `
        <div class="editor-item-head">
          <div class="editor-item-title">
            <span class="lnk-title-lbl"></span>
          </div>
          <div class="editor-item-actions">
            <label class="toggle-switch">
              <input type="checkbox" data-lf="enabled">
              <span>Aktif</span>
            </label>
            <button type="button" class="icon-btn" data-lact="up" title="Yukarı taşı">↑</button>
            <button type="button" class="icon-btn" data-lact="down" title="Aşağı taşı">↓</button>
            <button type="button" class="icon-btn del" data-lact="del" title="Bağlantıyı sil">✕</button>
          </div>
        </div>
        <div class="field-row">
          <label class="field">
            <span>Bağlantı Başlığı</span>
            <input type="text" class="inp glass" data-lf="title" placeholder="GitHub">
          </label>
          <label class="field">
            <span>Hedef URL</span>
            <input type="url" class="inp glass" data-lf="url" placeholder="https://github.com/tempestian">
          </label>
        </div>
      `;
      const updateTitle = () => {
        item.querySelector('.lnk-title-lbl').textContent = lnk.title || `Bağlantı #${idx + 1}`;
      };
      updateTitle();

      const enInp = item.querySelector('[data-lf="enabled"]');
      enInp.checked = lnk.enabled !== false;
      enInp.onchange = () => { lnk.enabled = enInp.checked; markDirty('config'); };

      const tInp = item.querySelector('[data-lf="title"]');
      tInp.value = lnk.title || '';
      tInp.oninput = () => { lnk.title = AdminSecurity.sanitizeText(tInp.value, 120); updateTitle(); markDirty('config'); };

      const uInp = item.querySelector('[data-lf="url"]');
      uInp.value = lnk.url || '';
      uInp.oninput = () => { lnk.url = AdminSecurity.sanitizeUrl(uInp.value, true); markDirty('config'); };

      item.querySelector('[data-lact="up"]').onclick = () => {
        if (idx === 0) return;
        const arr = state.config.links;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        renderLinksEditor();
        markDirty('config');
      };
      item.querySelector('[data-lact="down"]').onclick = () => {
        const arr = state.config.links;
        if (idx >= arr.length - 1) return;
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        renderLinksEditor();
        markDirty('config');
      };
      item.querySelector('[data-lact="del"]').onclick = () => {
        state.config.links.splice(idx, 1);
        renderLinksEditor();
        markDirty('config');
      };

      wrap.append(item);
    });
  }

  function downloadBlobJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bindDashboardEvents() {
    $$('[data-panel]').forEach(btn => {
      btn.onclick = () => {
        const target = btn.dataset.panel;
        $$('[data-panel]').forEach(b => b.setAttribute('aria-selected', b.dataset.panel === target));
        $('#panelAnime').hidden = target !== 'anime';
        $('#panelRapid').hidden = target !== 'rapid';
        if (target === 'rapid') initOrRefreshRapidQueue();
        $('#panelTexts').hidden = target !== 'texts';
        $('#panelImages').hidden = target !== 'images';
        $('#panelCategories').hidden = target !== 'categories';
        $('#panelBoxes').hidden = target !== 'boxes';
        $('#panelHealth').hidden = target !== 'health';
        if (target === 'health') renderHealthAuditor();
        $('#panelSecurity').hidden = target !== 'security';
      };
    });

    $$('#panelTexts input, #panelTexts textarea, #panelBoxes input').forEach(inp => {
      inp.addEventListener('input', () => markDirty('config'));
      inp.addEventListener('change', () => markDirty('config'));
    });

    // Adım 3–8: Anime Yönetimi ve İstatistik Olayları
    $('#admMediaTypeSelect').onchange = e => {
      state.activeAdminMediaType = e.target.value;
      renderAnimeAdminPanel();
    };
    $('#admAnimeSearch').oninput = e => { state.animeFilterQ = e.target.value; renderAnimeAdminPanel(); };
    $('#admAnimeStatusFilter').onchange = e => { state.animeFilterStatus = e.target.value; renderAnimeAdminPanel(); };
    $('#admAnimeSourceFilter').onchange = e => { state.animeFilterSource = e.target.value; renderAnimeAdminPanel(); };

    $('#openRapidQueueFromAnimeBtn').onclick = () => {
      const targetType = state.activeAdminMediaType || 'anime';
      $$('[data-panel]').forEach(b => b.setAttribute('aria-selected', b.dataset.panel === 'rapid'));
      $('#panelAnime').hidden = true;
      $('#panelRapid').hidden = false;
      if ($('#rqContentTypeSelect')) $('#rqContentTypeSelect').value = targetType;
      state.rapidQueue.activeType = targetType;
      initOrRefreshRapidQueue();
    };
    $('#rqContentTypeSelect').onchange = e => {
      state.rapidQueue.activeType = e.target.value;
      initOrRefreshRapidQueue(false);
    };
    $('#rqFilterSelect').onchange = () => initOrRefreshRapidQueue(false);
    $('#rqRebuildQueueBtn').onclick = () => initOrRefreshRapidQueue(false);
    $('#rqSwitchToAllBtn').onclick = () => {
      $('#rqFilterSelect').value = 'all';
      initOrRefreshRapidQueue(false);
    };
    $('#rqGenresInput').oninput = renderRapidQueueGenres;
    $('#rqClearGenresBtn').onclick = () => {
      $('#rqGenresInput').value = '';
      renderRapidQueueGenres();
    };
    $('#rqAddNewGenreBtn').onclick = () => {
      const adapter = getActiveAdapter();
      const newG = AdminSecurity.sanitizeText($('#rqNewGenreInput').value, 40);
      if (!newG) return;
      adapter.addCustomCategory(newG);
      const cur = new Set(
        ($('#rqGenresInput').value || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
      cur.add(newG);
      $('#rqGenresInput').value = [...cur].join(', ');
      $('#rqNewGenreInput').value = '';
      renderRapidQueueGenres();
      toast(`"${newG}" kataloğa eklendi ve seçildi.`);
    };
    $('#rqOpenFullModalBtn').onclick = () => {
      if (state.rapidQueue.draftItem && state.rapidQueue.activeType === 'anime') {
        openAnimeEditor(state.rapidQueue.draftItem.id);
      }
    };
    $('#rqFavoriteBtn').onclick = () => {
      const d = state.rapidQueue.draftItem;
      if (!d) return;
      d.favorite = !d.favorite;
      if (!d.favorite) delete d.favorite;
      const favBtn = $('#rqFavoriteBtn');
      favBtn.classList.toggle('on', Boolean(d.favorite));
      favBtn.textContent = d.favorite ? '★ Başyapıt (Seçili)' : '☆ Başyapıt İşaretle';
    };

    $('#rqFetchRelationsBtn').onclick = async () => {
      const adapter = getActiveAdapter();
      const d = state.rapidQueue.draftItem;
      if (!d) return;
      const rawInput = $('#rqExternalUrlInput').value.trim() || $('#rqTitleInput').value.trim();
      if (adapter.id !== 'anime') {
        if (!rawInput) {
          toast('Lütfen bir link (IMDb, AniList, OpenLibrary) veya başlık girin.', 'warn');
          return;
        }
        const btn = $('#rqFetchRelationsBtn');
        const origTxt = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Çekiliyor...';
        try {
          let info = null;
          if (adapter.id === 'manga') info = await ExternalCatalogFetcher.fetchMangaFromAnilist(rawInput);
          else if (adapter.id === 'series' || adapter.id === 'movie') info = await ExternalCatalogFetcher.fetchSeriesOrMovieFromImdb(rawInput, adapter.id);
          else if (adapter.id === 'book') info = await ExternalCatalogFetcher.fetchBookFromOpenLibrary(rawInput);
          if (info) {
            if (info.title && !$('#rqTitleInput').value.trim()) {
              d.title = info.title;
              $('#rqTitleInput').value = info.title;
            }
            if (info.image) {
              d.image = info.image;
              $('#rqPosterImg').src = resolvePreviewSrc(info.image);
            }
            if (info.url) {
              $('#rqExternalUrlInput').value = info.url;
              d[adapter.externalUrlField || 'url'] = info.url;
            }
            if (info.extraMeta && adapter.extraMetaField) {
              d[adapter.extraMetaField.key] = info.extraMeta;
              $('#rqExtraMetaInput').value = info.extraMeta;
            }
            if (Array.isArray(info.parts) && info.parts.length) {
              d.parts = info.parts;
              renderRapidQueueSubItems();
              syncRapidQueueScoreBadge();
            }
            toast(`${adapter.label} kapak URL'si ve bilgileri (puanlar hariç) çekildi!`);
          }
        } catch (err) {
          toast('Veri çekilemedi: ' + err.message, 'err');
        } finally {
          btn.disabled = false;
          btn.textContent = origTxt;
        }
        return;
      }
      const parsed = parseAnilistUrlOrId($('#rqExternalUrlInput').value.trim() || d.anilistId || d.id);
      if (!parsed.id) {
        toast('Lütfen geçerli bir AniList ilk sezon linki girin.', 'warn');
        return;
      }
      const btn = $('#rqFetchRelationsBtn');
      btn.disabled = true;
      btn.textContent = 'Çekiliyor...';
      try {
        const mediaMap = await queryConnectedAnilistGraph([parsed.id]);
        const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
        const kindFn = f => SERIES.has(f) ? 'season' : f === 'MOVIE' ? 'movie' : 'other';
        const dk = s => ((s && s.year) || 9999) * 10000 + ((s && s.month) || 0) * 100 + ((s && s.day) || 0);
        const sorted = [...mediaMap.values()].sort((a, b) => dk(a.startDate) - dk(b.startDate));
        const byId = new Map((d.parts || []).map(p => [Number(p.id) || p.id, p]));
        d.parts = sorted.map(m => {
          const prev = byId.get(m.id);
          return {
            id: m.id,
            name: (prev && prev.adminModified && prev.name) ? prev.name : (m.title.english || m.title.romaji),
            kind: kindFn(m.format),
            format: m.format || null,
            episodes: m.episodes || (prev && prev.episodes) || 0,
            watched: prev ? (prev.watched || 0) : (m.id === parsed.id ? (m.episodes || 0) : 0),
            status: prev ? prev.status : (m.id === parsed.id ? 'COMPLETED' : 'NONE'),
            release: m.status || null,
            year: (m.startDate && m.startDate.year) || null,
            ...(prev && prev.score != null ? { score: prev.score } : {}),
            ...(prev && prev.repeat > 0 ? { repeat: prev.repeat } : {})
          };
        });
        renderRapidQueueSubItems();
        syncRapidQueueScoreBadge();
        toast(`${sorted.length} bağlantılı sezon/film/yan içerik çekildi.`);
      } catch (err) {
        toast('Bağlantılı içerik hatası: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Linkten Yan İçerikleri Çek';
      }
    };
    $('#rqPrevBtn').onclick = () => {
      if (state.rapidQueue.currentIndex > 0) {
        loadRapidQueueItemAtIndex(state.rapidQueue.currentIndex - 1);
      }
    };
    $('#rqSkipBtn').onclick = () => {
      const qIds = state.rapidQueue.queueIds || [];
      if (state.rapidQueue.currentIndex < qIds.length - 1) {
        loadRapidQueueItemAtIndex(state.rapidQueue.currentIndex + 1);
      }
    };
    $('#rqSaveStayBtn').onclick = () => commitCurrentRapidQueueDraft(false);
    $('#rqSaveNextBtn').onclick = () => commitCurrentRapidQueueDraft(true);

    document.addEventListener('keydown', e => {
      const rapidPanel = $('#panelRapid');
      if (!rapidPanel || rapidPanel.hidden) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        commitCurrentRapidQueueDraft(true);
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        $('#rqSkipBtn').click();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        $('#rqPrevBtn').click();
      }
    });

    $('#addNewAnimeBtn').onclick = () => openAnimeEditor('__new__');
    $('#scanAllRelationsBtn').onclick = scanAllAnimeForSideContent;
    $('#triggerActionsBtn').onclick = async () => {
      const adapter = getActiveAdminAdapter();
      const btn = $('#triggerActionsBtn');
      if (adapter.id === 'guide') {
        try {
          if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Technopat Rehberleri Çekiliyor...';
          }
          const triggerTime = Date.now() - 5000;
          await AdminSecurity.githubTriggerWorkflow('sync-guides.yml', {
            user_id: '657641',
            username: 'Bayram Tempestian',
            prefix_filter: 'Rehber'
          });
          toast("GitHub Actions (Technopat Sosyal 'Rehber' Senkronu) başlatıldı! Tamamlandığında liste otomatik güncellenecek...");

          let attempts = 0;
          const maxAttempts = 28;
          const pollTimer = setInterval(async () => {
            attempts++;
            try {
              const run = await AdminSecurity.githubGetLatestWorkflowRun('sync-guides.yml');
              if (run && new Date(run.createdAt).getTime() >= triggerTime) {
                if (btn) {
                  btn.textContent = run.status === 'completed'
                    ? "🔄 Technopat'tan Rehberleri Çek (GitHub Actions)"
                    : `⏳ Technopat Taranıyor (${run.status})...`;
                }
                if (run.status === 'completed') {
                  clearInterval(pollTimer);
                  if (btn) btn.disabled = false;
                  if (run.conclusion === 'success') {
                    const session = AdminSecurity.getSessionInfo();
                    const rawGuides = await AdminSecurity.githubGetFileAtRef('data/guides.json', (session && session.branch) || 'main');
                    const parsedGuides = JSON.parse(rawGuides);
                    const items = Array.isArray(parsedGuides.items) ? parsedGuides.items : (parsedGuides.guides || []);
                    const store = ensureMultiMediaStore('guide');
                    store.items = items;
                    store.customGenreCatalog = Array.isArray(parsedGuides.customGenreCatalog) ? parsedGuides.customGenreCatalog : store.customGenreCatalog;
                    store.stats = parsedGuides.stats || computeStatsClient(items, state.animeData.statsConfig);
                    store.dirty = false;
                    updateDirtyIndicator();
                    renderAnimeAdminPanel();
                    toast(`✅ Technopat Sosyal rehber senkronu tamamlandı! Toplam ${items.length} rehber listelendi.`);
                  } else {
                    toast(`GitHub Actions tamamlandı ancak durum: ${run.conclusion || 'bilinmiyor'}. Actions sekmesini kontrol edin.`, 'err');
                  }
                }
              }
            } catch (_) {}
            if (attempts >= maxAttempts) {
              clearInterval(pollTimer);
              if (btn) {
                btn.disabled = false;
                btn.textContent = "🔄 Technopat'tan Rehberleri Çek (GitHub Actions)";
              }
            }
          }, 6000);
        } catch (err) {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "🔄 Technopat'tan Rehberleri Çek (GitHub Actions)";
          }
          toast(err.message, 'err');
        }
        return;
      }

      try {
        await AdminSecurity.githubTriggerWorkflow('sync-anilist.yml', { sync_mode: 'relations_only' });
        toast('GitHub Actions (AniList ve yan içerik senkronu) başarıyla tetiklendi!');
      } catch (err) {
        toast(err.message, 'err');
      }
    };
    $('#toggleOverridesBtn').onclick = () => {
      const sec = $('#overridesEditorSection');
      sec.hidden = !sec.hidden;
    };

    $('#downloadAnimeJsonBtn').onclick = () => {
      const adapter = getActiveAdminAdapter();
      if (adapter.id === 'anime') {
        state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
        downloadBlobJson(state.animeData, 'anime.json');
        toast('anime.json indirildi.');
      } else {
        const store = ensureMultiMediaStore(adapter.id);
        const payload = {
          schemaVersion: 3,
          updated: new Date().toISOString().slice(0, 10),
          source: 'site-first:' + adapter.id,
          customGenreCatalog: store.customGenreCatalog || [],
          stats: computeMediaStatsClient(store.items, state.animeData.statsConfig, adapter.id),
          items: cleanMediaItemsForSave(store.items, adapter.id)
        };
        downloadBlobJson(payload, `${adapter.countKey}.json`);
        toast(`${adapter.countKey}.json indirildi.`);
      }
    };
    if ($('#openCommitRecoveryBtn')) {
      $('#openCommitRecoveryBtn').onclick = () => {
        $$('[data-panel]').forEach(b => b.setAttribute('aria-selected', b.dataset.panel === 'health'));
        $('#panelAnime').hidden = true;
        $('#panelHealth').hidden = false;
        renderHealthAuditor();
        fetchAndRenderCommitHistory();
      };
    }
    if ($('#fetchCommitHistoryBtn')) {
      $('#fetchCommitHistoryBtn').onclick = fetchAndRenderCommitHistory;
    }
    if ($('#commitHistoryFileSelect')) {
      $('#commitHistoryFileSelect').onchange = fetchAndRenderCommitHistory;
    }
    $('#healthSectionSelect').onchange = renderHealthAuditor;
    $('#refreshHealthBtn').onclick = renderHealthAuditor;
    $('#exportFullSnapshotBtn').onclick = exportFullBackupSnapshot;
    $('#restoreSnapshotBtn').onclick = restoreFullBackupSnapshot;

    $('#downloadOverridesBtn').onclick = () => {
      downloadBlobJson(state.overrides, 'overrides.json');
      toast('overrides.json indirildi.');
    };

    // Overrides Ekleme Butonları
    $('#addOvTitleBtn').onclick = () => {
      const id = $('#ovTitleId').value.trim();
      const val = AdminSecurity.sanitizeText($('#ovTitleVal').value, 180);
      if (!id || !val) return;
      state.overrides.titles[id] = val;
      $('#ovTitleId').value = '';
      $('#ovTitleVal').value = '';
      markDirty('overrides');
      renderOverridesEditor();
    };
    $('#addOvMergeBtn').onclick = () => {
      const f = $('#ovMergeFrom').value.trim();
      const t = Number($('#ovMergeTo').value.trim());
      if (!f || !t) return;
      state.overrides.merge[f] = t;
      $('#ovMergeFrom').value = '';
      $('#ovMergeTo').value = '';
      markDirty('overrides');
      renderOverridesEditor();
    };
    $('#addOvNoContBtn').onclick = () => {
      const raw = AdminSecurity.sanitizeText($('#ovNoContVal').value, 140);
      if (!raw) return;
      const val = /^\d+$/.test(raw) ? Number(raw) : raw;
      if (!state.overrides.noContinue.includes(val)) state.overrides.noContinue.push(val);
      $('#ovNoContVal').value = '';
      markDirty('overrides');
      renderOverridesEditor();
    };
    $('#addOvExcludeBtn').onclick = () => {
      const id = Number($('#ovExcludeVal').value.trim());
      if (!id) return;
      if (!state.overrides.exclude.includes(id)) state.overrides.exclude.push(id);
      $('#ovExcludeVal').value = '';
      markDirty('overrides');
      renderOverridesEditor();
    };

    // Anime Modal Olayları
    const closeAnimeModal = () => { $('#animeEditModal').hidden = true; };
    $('#closeAnimeModalBtn').onclick = closeAnimeModal;
    $('#cancelAnimeModalBtn').onclick = closeAnimeModal;
    $('#animeModalBg').onclick = closeAnimeModal;

    $('#aeFirstSeasonUrl').oninput = () => {
      const parsed = parseAnilistUrlOrId($('#aeFirstSeasonUrl').value);
      if (parsed.id) $('#aeAnilistId').value = parsed.id;
    };
    $('#aeAnilistId').oninput = () => {
      const parsed = parseAnilistUrlOrId($('#aeAnilistId').value);
      if (parsed.id) $('#aeFirstSeasonUrl').value = parsed.url;
    };

    $('#aeFavoriteBtn').onclick = () => {
      if (!state.editingDraft) return;
      state.editingDraft.favorite = !state.editingDraft.favorite;
      if (!state.editingDraft.favorite) delete state.editingDraft.favorite;
      syncModalFavoriteBtn();
    };
    $('#aeImage').oninput = () => {
      $('#aeCoverPreview').src = resolvePreviewSrc(AdminSecurity.sanitizeUrl($('#aeImage').value, true));
    };

    // Adım 7 & 8: Tür / Kategori Stüdyosu Olayları
    $('#aeGenresInput').oninput = renderAnimeGenreStudio;
    $('#clearGenresBtn').onclick = () => {
      $('#aeGenresInput').value = '';
      renderAnimeGenreStudio();
    };
    $('#addCustomGenreToCatalogBtn').onclick = () => {
      const adapter = getActiveAdminAdapter();
      const newG = AdminSecurity.sanitizeText($('#newCustomGenreInp').value, 40);
      if (!newG) return;
      adapter.addCustomCategory(newG);
      const cur = new Set(
        ($('#aeGenresInput').value || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
      cur.add(newG);
      $('#aeGenresInput').value = [...cur].join(', ');
      $('#newCustomGenreInp').value = '';
      renderAnimeGenreStudio();
      toast(`"${newG}" özel kategori kataloğuna eklendi ve seçildi.`);
    };

    $('#fetchAnilistMetaBtn').onclick = fetchAnilistRelationsForModal;
    $('#addPartBtn').onclick = () => {
      if (!state.editingDraft) return;
      const n = (state.editingDraft.parts || []).length + 1;
      state.editingDraft.parts.push({
        id: 'part-' + Date.now() + '-' + n,
        name: `${n}. Sezon`,
        kind: 'season',
        format: 'TV',
        episodes: 12,
        watched: 12,
        status: 'COMPLETED',
        release: 'FINISHED',
        year: new Date().getFullYear(),
        score: null,
        adminModified: true
      });
      renderAnimePartsEditor();
      syncScoreStudioUI();
    };
    $('#saveAnimeModalBtn').onclick = saveAnimeFromModal;
    $('#deleteAnimeModalBtn').onclick = () => {
      if (!state.editingAnimeId || state.editingAnimeId === '__new__') return;
      $('#animeEditModal').hidden = true;
      deleteAnimeItem(state.editingAnimeId);
    };

    // Kategori, Özel Kutucuk ve Bağlantı Olayları
    $('#addCategoryBtn').onclick = () => {
      const newId = 'bolum-' + (state.config.sections.length + 1);
      state.config.sections.push({
        id: newId,
        title: 'Yeni Bölüm',
        path: newId + '/',
        description: 'Yakında',
        data: '',
        countKey: '',
        unit: 'içerik',
        status: 'soon',
        icon: 'sparkle',
        showStrip: true
      });
      renderCategoriesEditor();
      markDirty('config');
    };

    $$('[data-tpl-sec]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.tplSec;
        const tpl = SECTION_TEMPLATES[key];
        if (!tpl) return;
        if (state.config.sections.some(s => s.id === tpl.id)) {
          toast(`${tpl.title} kategorisi zaten listede mevcut.`, 'warn');
          return;
        }
        state.config.sections.push(structuredClone(tpl));
        renderCategoriesEditor();
        markDirty('config');
        toast(`${tpl.title} şablonu eklendi.`);
      };
    });

    $('#addCustomBoxBtn').onclick = () => {
      state.config.boxes.push({
        id: 'box-' + Date.now(),
        title: 'Yeni Kutucuk',
        badge: 'Bilgi',
        text: '',
        icon: 'sparkle',
        image: '',
        url: '',
        position: 'above',
        span: 'full',
        enabled: true
      });
      renderCustomBoxesEditor();
      markDirty('config');
    };

    $('#addLinkBtn').onclick = () => {
      state.config.links.push({
        id: 'lnk-' + Date.now(),
        title: 'Yeni Bağlantı',
        url: 'https://',
        enabled: true
      });
      renderLinksEditor();
      markDirty('config');
    };

    $('#uploadCustomImgBtn').onclick = async () => {
      const fInp = $('#customImgFile');
      const f = fInp.files && fInp.files[0];
      if (!f) {
        toast('Lütfen önce bir görsel dosyası seçin.', 'warn');
        return;
      }
      const rawName = AdminSecurity.sanitizeText($('#customImgName').value, 80) || f.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const targetPath = 'assets/img/' + rawName.replace(/^assets\/img\//, '');
      await queueImageUpload(f, targetPath);
      $('#customImgName').value = '';
      fInp.value = '';
    };

    $('#previewApplyBtn').onclick = () => {
      collectFormFieldsIntoConfig();
      state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
      localStorage.setItem('tp_site_preview', JSON.stringify(state.config, null, 2));
      localStorage.setItem('tp_anime_preview', JSON.stringify(state.animeData));
      const multiPreview = {};
      for (const [mKey, store] of Object.entries(state.multiMediaStore || {})) {
        multiPreview[mKey] = {
          schemaVersion: 3,
          updated: new Date().toISOString().slice(0, 10),
          customGenreCatalog: store.customGenreCatalog || [],
          stats: computeMediaStatsClient(store.items || [], state.animeData.statsConfig, mKey),
          items: cleanMediaItemsForSave(store.items || [], mKey)
        };
      }
      localStorage.setItem('tp_multimedia_preview', JSON.stringify(multiPreview));
      try {
        const S = state.animeData.stats;
        const animeSummary = {
          nums: [[S.anime, 'anime'], [S.season, 'sezon'], [S.film, 'film'], [S.episodes, 'bölüm']],
          imgs: state.animeData.anime.map(x => x.image).filter(Boolean).slice(0, 4)
        };
        localStorage.setItem('ui2', JSON.stringify({ d: state.config, s: { anime: animeSummary } }));
      } catch (e) {}
      $('#clearPreviewBtn').hidden = false;
      toast('Tüm site ve anime değişiklikleri canlı önizlemeye uygulandı!');
    };

    $('#clearPreviewBtn').onclick = () => {
      localStorage.removeItem('tp_site_preview');
      localStorage.removeItem('tp_anime_preview');
      localStorage.removeItem('ui2');
      $('#clearPreviewBtn').hidden = true;
      toast('Canlı önizleme sıfırlandı.');
    };

    $('#downloadJsonBtn').onclick = () => {
      collectFormFieldsIntoConfig();
      downloadBlobJson(state.config, 'sections.json');
      toast('sections.json indirildi.');
    };

    $('#commitGithubBtn').onclick = async () => {
      collectFormFieldsIntoConfig();
      const sess = AdminSecurity.getSessionInfo();
      if (!sess || !sess.hasToken) {
        toast('GitHub\'a doğrudan kaydetmek için "Profil & Güvenlik" sekmesinden GitHub Fine-Grained Token (PAT) ekleyin.', 'warn');
        return;
      }
      const btn = $('#commitGithubBtn');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Kaydediliyor...';
      try {
        for (const [targetPath, info] of state.pendingUploads.entries()) {
          await AdminSecurity.githubPutFile(targetPath, info.bytes, `Görsel güncellendi: ${targetPath}`, true);
        }
        state.pendingUploads.clear();
        renderPendingUploadsList();

        if (state.dirtyConfig || (!state.dirtyAnime && !state.dirtyOverrides)) {
          await AdminSecurity.githubPutFile('data/sections.json', JSON.stringify(state.config, null, 2) + '\n', 'Site içeriği admin panelinden güncellendi', false);
          state.dirtyConfig = false;
        }
        if (state.dirtyOverrides) {
          await AdminSecurity.githubPutFile('data/overrides.json', JSON.stringify(state.overrides, null, 2) + '\n', 'Senkron kuralları (overrides.json) güncellendi', false);
          state.dirtyOverrides = false;
        }
        if (state.dirtyAnime) {
          state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
          state.animeData.updated = new Date().toISOString().slice(0, 10);
          await AdminSecurity.githubPutFile('data/anime.json', JSON.stringify(state.animeData, null, 2) + '\n', 'Anime verileri ve istatistikler admin panelinden güncellendi', false);
          state.dirtyAnime = false;
        }
        for (const [mKey, store] of Object.entries(state.multiMediaStore || {})) {
          if (store && store.dirty) {
            const adapter = CONTENT_ADAPTER_REGISTRY[mKey];
            if (adapter && adapter.dataFile) {
              const payload = {
                schemaVersion: 3,
                updated: new Date().toISOString().slice(0, 10),
                source: 'site-first:' + mKey,
                customGenreCatalog: store.customGenreCatalog || [],
                stats: computeMediaStatsClient(store.items || [], state.animeData.statsConfig, mKey),
                items: cleanMediaItemsForSave(store.items || [], mKey)
              };
              await AdminSecurity.githubPutFile(adapter.dataFile, JSON.stringify(payload, null, 2) + '\n', `${adapter.label} verileri admin panelinden güncellendi`, false);
              store.dirty = false;
            }
          }
        }

        localStorage.removeItem('tp_site_preview');
        localStorage.removeItem('tp_anime_preview');
        $('#clearPreviewBtn').hidden = true;
        updateDirtyIndicator();
        toast('Değişiklikler GitHub deposuna başarıyla kaydedildi!');
      } catch (err) {
        toast(err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    };

    $('#saveSecTokenBtn').onclick = async () => {
      const pat = $('#secPatInput').value.trim();
      const repoOwner = $('#secRepoOwner').value.trim() || 'tempestian';
      const repoName = $('#secRepoName').value.trim() || 'tempestian.github.io';
      const branch = $('#secBranch').value.trim() || 'main';
      try {
        await AdminSecurity.updateSessionCredentials({
          pat: pat || undefined,
          repoOwner,
          repoName,
          branch,
          saveToDevice: true
        });
        const info = AdminSecurity.getSessionInfo();
        onSessionUnlocked(info);
        $('#secPatInput').value = '';
        toast('Oturum ve cihaz profili güncellendi.');
      } catch (err) {
        toast(err.message, 'err');
      }
    };

    $('#toggleSecQrBtn').onclick = () => {
      const box = $('#activeQrSection');
      box.hidden = !box.hidden;
    };

    $('#downloadVaultBtn').onclick = async () => {
      const pass = $('#exportVaultPass').value;
      if (!pass || pass.length < 8) {
        toast('Lütfen şifreli kasa için en az 8 karakterli bir parola belirleyin.', 'warn');
        return;
      }
      const info = AdminSecurity.getSessionInfo();
      if (!info || !info.totpSecret) {
        toast('Aktif Google Authenticator anahtarı bulunamadı.', 'warn');
        return;
      }
      const vaultObj = await AdminSecurity.encryptVault({
        username: info.username,
        repoOwner: info.repoOwner,
        repoName: info.repoName,
        branch: info.branch,
        totpSecret: info.totpSecret
      }, info.username, pass);
      AdminSecurity.saveLocalVault(vaultObj);
      downloadBlobJson(vaultObj, 'admin-vault.json');
      toast('AES-256-GCM şifreli kasa (admin-vault.json) indirildi.');
    };

    $('#commitVaultToRepoBtn').onclick = async () => {
      const pass = $('#exportVaultPass').value;
      if (!pass || pass.length < 8) {
        toast('Repoya kaydetmeden önce en az 8 karakterli güçlü bir kasa parolası girin.', 'warn');
        return;
      }
      const info = AdminSecurity.getSessionInfo();
      if (!info || !info.hasToken) {
        toast('Repoya kaydetmek için geçerli bir GitHub Token tanımlı olmalıdır.', 'warn');
        return;
      }
      try {
        const vaultObj = await AdminSecurity.encryptVault({
          username: info.username,
          repoOwner: info.repoOwner,
          repoName: info.repoName,
          branch: info.branch,
          totpSecret: info.totpSecret
        }, info.username, pass);
        await AdminSecurity.githubPutFile('data/admin-vault.json', JSON.stringify(vaultObj, null, 2) + '\n', 'Şifreli yönetici kasası mühürlendi', false);
        state.remoteVault = vaultObj;
        toast('Şifreli kasa data/admin-vault.json olarak repoya mühürlendi.');
      } catch (err) {
        toast(err.message, 'err');
      }
    };

    $('#resetDeviceVaultBtn').onclick = async () => {
      await AdminSecurity.clearDeviceVault();
      AdminSecurity.clearLocalVault();
      AdminSecurity.lockSession('Cihazdaki Google Authenticator eşleşmesi silindi.');
    };
  }

  function onSessionUnlocked(sessionInfo) {
    mountAdminDashboardDOM();
    $('#authGate').hidden = true;
    $('#adminApp').hidden = false;
    $('#lockBtn').hidden = false;
    const badge = $('#sessionBadge');
    badge.hidden = false;
    badge.textContent = `Açık · ${sessionInfo.username}`;
    $('#activeUserLabel').textContent = sessionInfo.username;

    const modeLbl = $('#syncModeLabel');
    if (sessionInfo.hasToken) {
      modeLbl.textContent = `GitHub API Bağlı (${sessionInfo.repoOwner}/${sessionInfo.repoName})`;
      modeLbl.classList.add('online');
    } else {
      modeLbl.textContent = 'Salt Okunur / PAT Eksik';
      modeLbl.classList.remove('online');
    }

    $('#secRepoOwner').value = sessionInfo.repoOwner || 'tempestian';
    $('#secRepoName').value = sessionInfo.repoName || 'tempestian.github.io';
    $('#secBranch').value = sessionInfo.branch || 'main';

    if (sessionInfo.totpSecret) {
      const uri = buildOtpAuthUri(sessionInfo.username, sessionInfo.totpSecret);
      $('#secQrContainer').innerHTML = window.QRGenerator.renderQRSVG(uri, 3);
      $('#secTotpSecret').textContent = sessionInfo.totpSecret;
    }

    loadAllData();
  }

  AdminSecurity.setOnLock(reason => {
    const app = $('#adminApp');
    if (app) {
      app.hidden = true;
      app.replaceChildren();
    }
    $('#authGate').hidden = false;
    $('#lockBtn').hidden = true;
    $('#sessionBadge').hidden = true;
    $('#loginTotpCode').value = '';
    state.verifiedSetupContext = null;
    $('#pairDynamicMount').replaceChildren();
    if (reason) showAuthAlert(reason);
    initAuthGate();
  });

  $$('[data-auth-tab]').forEach(btn => {
    btn.onclick = () => switchAuthTab(btn.dataset.authTab);
  });
  $('#goToPairBtn').onclick = () => switchAuthTab('pair');

  const loginTotpInput = $('#loginTotpCode');
  async function handleDeviceTotpLogin(e) {
    if (e) e.preventDefault();
    showAuthAlert('');
    const code = loginTotpInput.value.trim();
    if (code.length !== 6) return;
    try {
      const info = await AdminSecurity.unlockWithDeviceTOTP(code);
      toast('Google Authenticator doğrulandı. Hoş geldiniz!');
      onSessionUnlocked(info);
    } catch (err) {
      showAuthAlert(err.message);
      loginTotpInput.select();
    }
  }
  $('#formDeviceTotp').onsubmit = handleDeviceTotpLogin;
  loginTotpInput.oninput = () => {
    loginTotpInput.value = loginTotpInput.value.replace(/\D/g, '').slice(0, 6);
    if (loginTotpInput.value.length === 6) handleDeviceTotpLogin();
  };

  $('#formVerifySetupToken').onsubmit = async e => {
    e.preventDefault();
    showAuthAlert('');
    if (state.remoteVault) {
      showAuthAlert('Mühürlü yönetici kasası zaten mevcut. İlk kurulum yapılamaz.');
      return;
    }
    const repoOwner = AdminSecurity.sanitizeText($('#setupRepoOwner').value, 80) || 'tempestian';
    const repoName = AdminSecurity.sanitizeText($('#setupRepoName').value, 100) || 'tempestian.github.io';
    const branch = AdminSecurity.sanitizeText($('#setupBranch').value, 80) || 'main';
    const pat = $('#setupPat').value.trim();
    const btn = $('#verifySetupPatBtn');
    btn.disabled = true;
    btn.textContent = 'GitHub API ile Doğrulanıyor...';
    try {
      const verified = await AdminSecurity.verifyGithubWriteAccess(pat, repoOwner, repoName);
      state.verifiedSetupContext = {
        login: verified.login,
        pat,
        repoOwner,
        repoName,
        branch
      };
      $('#pairInitialGate').hidden = true;
      mountSetupQRStep();
      toast('GitHub depo sahipliği doğrulandı.');
    } catch (err) {
      showAuthAlert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'GitHub API ile Sahipliği Doğrula';
    }
  };

  $('#vaultFileInput').onchange = async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      if (parsed && parsed.v === 1 && parsed.ct) {
        state.importedVault = parsed;
        AdminSecurity.saveLocalVault(parsed);
        toast('Şifreli kasa dosyası yüklendi.');
      } else {
        showAuthAlert('Geçersiz kasa dosyası.');
      }
    } catch (err) {
      showAuthAlert('Kasa dosyası okunamadı.');
    }
  };

  $('#formPairExistingVault').onsubmit = async e => {
    e.preventDefault();
    showAuthAlert('');
    const vaultObj = state.importedVault || state.remoteVault || AdminSecurity.getLocalVault();
    if (!vaultObj) {
      showAuthAlert('Mühürlü kasa bulunamadı.');
      return;
    }
    const u = $('#vaultUsername').value.trim();
    const p = $('#vaultPassword').value;
    const c = $('#vaultTotpCode').value.trim();
    const pat = $('#vaultPatInput').value.trim();
    const btn = $('#pairExistingBtn');
    btn.disabled = true;
    btn.textContent = 'Doğrulanıyor...';
    try {
      const info = await AdminSecurity.unlockWithEncryptedVault({
        vaultObj,
        username: u,
        password: p,
        totpCode: c,
        pat,
        saveToDevice: true
      });
      toast('Cihazınız başarıyla yetkilendirildi!');
      onSessionUnlocked(info);
    } catch (err) {
      showAuthAlert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Doğrula ve Bu Cihazı Yetkilendir';
    }
  };

  $('#lockBtn').onclick = () => {
    AdminSecurity.lockSession('Oturum kilitlendi.');
  };

  initAuthGate();
})();
