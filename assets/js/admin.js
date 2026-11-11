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
      leadText: 'Hediyenin açılma zamanı geldi',
      targetDate: '2026-10-26T00:00:00+03:00',
      dateLabel: '26 Ekim 2026 · 00.00 (TSİ)',
      expiredLeadText: 'Hediyenin açılma zamanı geldi',
      expiredSubText: 'Sürprizi okumak için tıkla ✨',
      expiredUrl: 'hediye/',
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
      },
      {
        id: 'guide',
        title: 'Rehber',
        path: 'rehber/',
        description: 'Technopat Sosyal rehber kataloğum',
        subtitle: 'Technopat Sosyal üzerinde yayınladığım GNU/Linux, donanım ve yazılım rehberleri.',
        data: 'data/guides.json',
        countKey: 'guides',
        unit: 'rehber',
        status: 'active',
        icon: 'guide',
        showStrip: false
      },
      {
        id: 'project',
        title: 'Projeler',
        path: 'projeler/',
        description: 'Açık kaynak projelerim ve forklarım',
        subtitle: 'Kişisel GNU/Linux yapılandırmalarım, masaüstü shell forkları ve açık kaynak katkılarım.',
        data: 'data/projects.json',
        countKey: 'projects',
        unit: 'proje',
        status: 'active',
        icon: 'code',
        showStrip: false
      },
      {
        id: 'series',
        title: 'Dizi',
        path: 'dizi/',
        description: 'Yakında',
        data: 'data/series.json',
        countKey: 'series',
        unit: 'dizi',
        status: 'soon',
        icon: 'series',
        showStrip: true
      },
      {
        id: 'movie',
        title: 'Film',
        path: 'film/',
        description: 'Yakında',
        data: 'data/movies.json',
        countKey: 'movies',
        unit: 'film',
        status: 'soon',
        icon: 'movie',
        showStrip: true
      },
      {
        id: 'manga',
        title: 'Manga',
        path: 'manga/',
        description: 'Yakında',
        data: 'data/manga.json',
        countKey: 'manga',
        unit: 'manga',
        status: 'soon',
        icon: 'manga',
        showStrip: true
      },
      {
        id: 'book',
        title: 'Kitap',
        path: 'kitap/',
        description: 'Yakında',
        data: 'data/books.json',
        countKey: 'books',
        unit: 'kitap',
        status: 'soon',
        icon: 'book',
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
        subtitle: '',
        metaTitle: 'Anime · Tempestian',
        description: "Tempestian'ın izlediği animeler: puanlar, sezonlar ve izleme durumu.",
        searchPlaceholder: 'Ara',
        emptyText: 'Eşleşen anime yok.',
        footerText: "AniList'ten günde bir güncellenir. Kapaklar sahiplerine aittir.",
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        anilistButtonText: "AniList'te aç",
        externalButtonText: "AniList'te aç"
      },
      guide: {
        title: 'Rehber',
        subtitle: 'Technopat Sosyal üzerinde yayınladığım rehber ve incelemelerin kataloğu.',
        metaTitle: 'Rehber · Tempestian',
        description: "Bayram Tempestian'ın Technopat Sosyal üzerinde yayınladığı rehberler ve teknik inceleme kataloğu.",
        searchPlaceholder: 'Rehber başlığı, konu veya kategori ara...',
        emptyText: 'Henüz rehber eklenmemiş veya aramayla eşleşen rehber yok.',
        footerText: 'Rehber kartlarına tıkladığınızda Technopat Sosyal üzerindeki ilgili konuya yönlendirilirsiniz.',
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        externalButtonText: 'Technopat Sosyal'
      },
      project: {
        title: 'Projeler',
        subtitle: 'Açık kaynak sistem yapılandırmaları, kabuk forkları ve yazılım projeleri kataloğu.',
        metaTitle: 'Projeler · Tempestian',
        description: "Bayram Tempestian'ın açık kaynak projeleri: NixOS yapılandırması, iNiR Quickshell kabuğu ve yazılım depoları.",
        searchPlaceholder: 'Proje, teknoloji veya anahtar kelime ara...',
        emptyText: 'Henüz proje eklenmemiş veya aramayla eşleşen proje yok.',
        footerText: 'Tüm projeler açık kaynaklıdır. Proje kartlarına tıklayarak doğrudan ilgili GitHub deposuna gidebilirsiniz.',
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        externalButtonText: 'GitHub Deposu'
      },
      series: {
        title: 'Dizi',
        subtitle: '',
        metaTitle: 'Dizi · Tempestian',
        description: "Bayram Tempestian'ın izlediği diziler, sezon puanları ve izleme durumu.",
        searchPlaceholder: 'Dizi, kategori veya kanal ara...',
        emptyText: 'Henüz dizi eklenmemiş veya filtreyle eşleşen dizi yok.',
        footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        externalButtonText: "IMDb'de aç"
      },
      movie: {
        title: 'Film',
        subtitle: '',
        metaTitle: 'Film · Tempestian',
        description: "Bayram Tempestian'ın izlediği filmler, kişisel puanlar ve favoriler.",
        searchPlaceholder: 'Film, kategori veya yönetmen ara...',
        emptyText: 'Henüz film eklenmemiş veya filtreyle eşleşen film yok.',
        footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        externalButtonText: "IMDb'de aç"
      },
      manga: {
        title: 'Manga',
        subtitle: '',
        metaTitle: 'Manga · Tempestian',
        description: "Bayram Tempestian'ın okuduğu mangalar, cilt/bölüm takibi ve kişisel puanlar.",
        searchPlaceholder: 'Manga, kategori veya yazar ara...',
        emptyText: 'Henüz manga eklenmemiş veya filtreyle eşleşen manga yok.',
        footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        externalButtonText: 'Kaynakta aç'
      },
      book: {
        title: 'Kitap',
        subtitle: '',
        metaTitle: 'Kitap · Tempestian',
        description: "Bayram Tempestian'ın okuduğu kitaplar, sayfa takibi ve kişisel değerlendirmeler.",
        searchPlaceholder: 'Kitap, kategori veya yazar ara...',
        emptyText: 'Henüz kitap eklenmemiş veya filtreyle eşleşen kitap yok.',
        footerText: 'Kapak görselleri sahiplerine aittir. Puanlar kişisel değerlendirmedir.',
        detailsText: 'Ayrıntılar',
        resetFilterText: 'Filtreleri sıfırla',
        externalButtonText: 'Kaynakta aç'
      }
    }
  };

  const SECTION_TEMPLATES = {
    manga: { id: 'manga', title: 'Manga', path: 'manga/', description: 'Yakında', data: 'data/manga.json', countKey: 'manga', unit: 'manga', status: 'soon', icon: 'manga', showStrip: true },
    book: { id: 'book', title: 'Kitap', path: 'kitap/', description: 'Yakında', data: 'data/books.json', countKey: 'books', unit: 'kitap', status: 'soon', icon: 'book', showStrip: true },
    series: { id: 'series', title: 'Dizi', path: 'dizi/', description: 'Yakında', data: 'data/series.json', countKey: 'series', unit: 'dizi', status: 'soon', icon: 'series', showStrip: true },
    movie: { id: 'movie', title: 'Film', path: 'film/', description: 'Yakında', data: 'data/movies.json', countKey: 'movies', unit: 'film', status: 'soon', icon: 'movie', showStrip: true },
    guide: { id: 'guide', title: 'Rehber', path: 'rehber/', description: 'Yakında', data: 'data/guides.json', countKey: 'guides', unit: 'rehber', status: 'soon', icon: 'guide', showStrip: false },
    project: { id: 'project', title: 'Projeler', path: 'projeler/', description: 'Açık kaynak projelerim ve forklarım', data: 'data/projects.json', countKey: 'projects', unit: 'proje', status: 'active', icon: 'code', showStrip: false }
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

  function parseAnilistUrlOrId(input, mediaType = 'anime') {
    const kindPath = mediaType === 'manga' ? 'manga' : 'anime';
    if (input == null || input === '') return { id: null, url: '' };
    if (typeof input === 'number' && Number.isInteger(input) && input > 0) {
      return { id: input, url: `https://anilist.co/${kindPath}/` + input };
    }
    const raw = String(input).trim();
    const m = raw.match(/anilist\.co\/(anime|manga)\/(\d+)/i);
    if (m) {
      const detectedKind = m[1].toLowerCase();
      const id = Number(m[2]);
      return { id, url: `https://anilist.co/${detectedKind}/` + id };
    }
    const al = raw.match(/^al-(\d+)$/i);
    if (al) {
      const id = Number(al[1]);
      return { id, url: `https://anilist.co/${kindPath}/` + id };
    }
    if (/^\d{1,8}$/.test(raw) && Number(raw) > 0) {
      const id = Number(raw);
      return { id, url: `https://anilist.co/${kindPath}/` + id };
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
    sessionChangesLog: [],
    initialSnapshots: null,
    dismissedNotices: new Set(),
    setupSecret: '',
    verifiedSetupContext: null,
    remoteVault: null,
    importedVault: null,
    pendingUploads: new Map(),
    animeFilterQ: '',
    animeFilterStatus: 'all',
    animeFilterSource: 'all',
    activeAdminMediaType: 'anime',
    selectedAdminIds: new Set(),
    lastFilteredIds: [],
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
  function resolveEffectiveScore(a, typeId) {
    if (!a || typeof a !== 'object') return null;

    const tid = typeId || (typeof getActiveAdapter === 'function' ? getActiveAdapter()?.id : null) || (typeof getActiveAdminAdapter === 'function' ? getActiveAdminAdapter()?.id : null) || a.kind || a.type || 'anime';
    const criteria = window.TempestianRating ? (window.TempestianRating.CRITERIA[tid] || window.TempestianRating.CRITERIA.anime) : null;

    // 1. Parçalar varsa, önce parçaların alt kriter puanlarını (p.subScores) hesapla ve parçaların ağırlıklı ortalamasını al
    const parts = Array.isArray(a.parts) ? a.parts : [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const p of parts) {
      if (!p) continue;
      if (p.subScores && typeof p.subScores === 'object' && criteria) {
        const sc = window.TempestianRating.computeScore(criteria, p.subScores);
        if (sc != null) p.score = sc;
      }
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

    // 2. Parça puanı yoksa, genel yapım subScores'u (Varsa)
    if (a.subScores && typeof a.subScores === 'object' && criteria) {
      const sc = window.TempestianRating.computeScore(criteria, a.subScores);
      if (sc != null) return sc;
    }

    // 3. Doğrudan genel puan
    const direct = Number(a.score);
    return !isNaN(direct) && direct > 0 ? Math.round(direct * 10) / 10 : null;
  }

  function resolveEffectiveGenres(a, genreSourceRule = 'custom_only') {
    if (!a || typeof a !== 'object') return [];
    if (Array.isArray(a.customGenres) && a.customGenres.length > 0) {
      return [...new Set(a.customGenres.map(g => String(g).trim()).filter(Boolean))];
    }
    if (Array.isArray(a.categories) && a.categories.length > 0) {
      return [...new Set(a.categories.map(g => String(g).trim()).filter(Boolean))];
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

    if (mediaType === 'project') {
      const byStatus = {};
      const catCounts = new Map();
      let favorites = 0;
      let published = 0;
      let forks = 0;
      for (const it of list) {
        if (!it) continue;
        if (it.favorite) favorites++;
        if (it.isFork) forks++;
        const st = it.status || 'completed';
        byStatus[st] = (byStatus[st] || 0) + 1;
        if (st === 'completed') published++;
        for (const g of resolveEffectiveGenres(it, 'custom_only')) {
          catCounts.set(g, (catCounts.get(g) || 0) + 1);
        }
      }
      const categories = [...catCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
        .map(([name, count]) => ({ name, count }));
      return {
        total: list.length,
        published,
        draft: list.length - published,
        favorites,
        forks,
        byStatus,
        categories,
        genres: categories
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
    if (mediaType === 'guide' || mediaType === 'project') {
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
    return list;
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
  // [AI-MIMARI-NOTU: ADIM 3 & ADIM 9 — ADMİN PANELİ GLOBAL ENTEGRASYON KÖPRÜSÜ]
  // Admin modülündeki anlık düzenlemelerin Instagram Studio tarafından canlı okunabilmesi ve
  // toast bildirimlerinin harici modüllerde çalışması için window nesnesine bağlanır.
  window.toast = toast;
  window.getAdminCategoryData = function(catKey) {
    if (catKey === 'anime') {
      return {
        items: state.animeData.anime || [],
        stats: state.animeData.stats || {}
      };
    }
    const store = state.multiMediaStore && state.multiMediaStore[catKey];
    if (store && Array.isArray(store.items) && store.items.length) {
      return {
        items: store.items,
        stats: store.stats || {}
      };
    }
    return null;
  };

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
    else if (state.multiMediaStore && state.multiMediaStore[kind]) {
      state.multiMediaStore[kind].dirty = true;
    }
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
    showAuthAlert('');
    const devMeta = AdminSecurity.getDeviceVaultMeta();

    if (devMeta) {
      $('#deviceReadyBox').hidden = false;
      $('#tokenEntryBox').hidden = true;
      $('#deviceStatusBanner').innerHTML = `<span><b>${AdminSecurity.sanitizeText(devMeta.username || 'tempestian')}</b> profiline ait GitHub Token bu tarayıcıda kayıtlı.</span>`;
    } else {
      $('#deviceReadyBox').hidden = true;
      $('#tokenEntryBox').hidden = false;
      setTimeout(() => { const inp = $('#loginPatInput'); if (inp) inp.focus(); }, 60);
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

  function renderAdminApp() {
    const app = $('#adminApp');
    if (!app) return;
    app.innerHTML = `
      <div class="admin-shell" id="adminShell">
        <aside class="admin-sidebar glass sq" id="adminSidebar">
          <div class="acp-sidebar-brand">
            <div class="acp-brand-logo">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div class="acp-brand-text">
              <strong class="acp-brand-title">Tempestian Panel</strong>
              <span class="acp-brand-sub">Yönetim Paneli</span>
            </div>
          </div>

          <nav class="acp-nav-tree" role="tablist" aria-label="Yönetim Menüsü">
            <div class="acp-nav-group">
              <div class="acp-nav-heading">Genel Bakış</div>
              <button type="button" class="acp-nav-item nav-tab active" role="tab" data-panel="dashboard" aria-selected="true" title="Yönetim Özeti">
                <span class="acp-nav-icon">📊</span>
                <span class="acp-nav-label">Yönetim Özeti</span>
              </button>
            </div>

            <div class="acp-nav-group">
              <div class="acp-nav-heading">İçerik Yönetimi</div>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="anime" aria-selected="false" title="Medya &amp; Arşiv">
                <span class="acp-nav-icon">📺</span>
                <span class="acp-nav-label">Medya &amp; Arşiv</span>
              </button>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="rapid" aria-selected="false" title="Hızlı Sıralı İnceleme">
                <span class="acp-nav-icon">⚡</span>
                <span class="acp-nav-label">Hızlı Sıralı İnceleme</span>
              </button>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="instagram" aria-selected="false" title="Görsel Stüdyosu">
                <span class="acp-nav-icon">📸</span>
                <span class="acp-nav-label">Görsel Stüdyosu</span>
              </button>
            </div>

            <div class="acp-nav-group">
              <div class="acp-nav-heading">Site Yapısı &amp; Sayfalar</div>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="nodes" aria-selected="false" title="Bölümler &amp; Düğümler (Nodes)">
                <span class="acp-nav-icon">🌳</span>
                <span class="acp-nav-label">Bölümler &amp; Düğümler (Nodes)</span>
              </button>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="images" aria-selected="false" title="Görseller &amp; Medya">
                <span class="acp-nav-icon">🖼️</span>
                <span class="acp-nav-label">Görseller &amp; Medya</span>
              </button>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="boxes" aria-selected="false" title="Kutucuk &amp; Hızlı Linkler">
                <span class="acp-nav-icon">🧩</span>
                <span class="acp-nav-label">Kutucuk &amp; Hızlı Linkler</span>
              </button>
            </div>

            <div class="acp-nav-group">
              <div class="acp-nav-heading">Sistem &amp; Bakım</div>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="health" aria-selected="false" title="🛠️ Araçlar &amp; Veri Sağlığı">
                <span class="acp-nav-icon">🛠️</span>
                <span class="acp-nav-label">🛠️ Araçlar &amp; Veri Sağlığı</span>
              </button>
              <button type="button" class="acp-nav-item nav-tab" role="tab" data-panel="security" aria-selected="false" title="Güvenlik &amp; PAT">
                <span class="acp-nav-icon">🔐</span>
                <span class="acp-nav-label">Güvenlik &amp; PAT</span>
              </button>
            </div>
          </nav>

          <div class="acp-sidebar-footer">
            <div class="acp-footer-info">
              <span class="acp-branch-tag" id="acpBranchBadge">🌿 <span id="acpBranchLabel">main</span></span>
              <span class="acp-count-tag" id="acpTotalItemsBadge">0 İçerik</span>
            </div>
          </div>
        </aside>

        <div class="admin-main-stage" id="adminMainStage">
          <div class="admin-toolbar glass sq">
            <div class="toolbar-info">
              <button type="button" class="btn glass acp-sidebar-toggle" id="sidebarToggleBtn" aria-label="Menüyü Daralt/Genişlet" title="Sol Menüyü Daralt / Genişlet">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              </button>
              <nav class="acp-breadcrumb" id="acpBreadcrumb" aria-label="Yol Haritası">
                <span class="crumb-root">Panel</span>
                <span class="crumb-sep">/</span>
                <span class="crumb-user" id="activeUserLabel">tempestian</span>
                <span class="crumb-sep">/</span>
                <strong class="crumb-current" id="acpBreadcrumbPanel">Yönetim Özeti</strong>
              </nav>
              <span id="syncModeLabel" class="mode-pill">GitHub API Bağlı</span>
              <span id="dirtyIndicator" class="dirty-pill" hidden>Kaydedilmemiş değişiklikler var</span>
            </div>
            <div class="toolbar-btns">
              <button type="button" class="btn-subtle" id="openCmdPaletteBtn" title="Tüm kategorilerde hızlı içerik arama ve komut paletini açar (Ctrl+K)">🔍 Hızlı Arama &amp; Komut (Ctrl+K)</button>
              <button type="button" class="btn-subtle" id="previewApplyBtn" title="Değişiklikleri tarayıcı önbelleğine uygular (Ctrl+S)">Canlı Önizlemeye Uygula</button>
              <button type="button" class="btn-subtle" id="clearPreviewBtn" hidden title="Önizleme önbelleğini temizler">Önizlemeyi Sıfırla</button>
              <button type="button" class="btn-subtle" id="downloadJsonBtn">sections.json İndir</button>
              <button type="button" class="btn-primary" id="commitGithubBtn">GitHub'a Kaydet (Commit)</button>
            </div>
          </div>

          <!-- ADIM 5: AKILLI YÖNETİCİ BİLDİRİMLERİ (NOTICES & AKILLI HATIRLATICILAR) -->
          <div id="acpNoticesContainer" class="acp-notices-container" aria-live="polite"></div>

          <!-- YÖNETİM ÖZETİ DASHBOARD (GENEL BAKIŞ) -->
          <div id="panelDashboard" class="admin-panel">
            <div id="acpDashboardContent"></div>
          </div>

          <!-- ADIM 3, 4, 5, 6, 7 & 8: ANİME YÖNETİMİ, AĞIRLIKLI PUAN, ÖZEL KATEGORİ VE İSTATİSTİK MOTORU -->
          <div id="panelAnime" class="admin-panel" hidden>
        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2 id="admPanelMainTitle">Medya Verileri, Ağırlıklı Puanlama ve Özel Kategori Yönetimi</h2>
              <p id="admPanelMainSub">Sezon (<b>×1.00</b>), Film (<b>×0.35</b>) ve Yan İçerik (<b>×0.15</b>) puanlarınız genel puanı otomatik belirler. İstatistiklerde yalnızca sizin seçtiğiniz özel kategoriler yer alır.</p>
            </div>
            <div class="form-actions adm-primary-actions">
              <select id="admMediaTypeSelect" class="inp glass" style="width:auto;min-width:165px;font-weight:650" title="Yönetilecek Medya Bölümünü Seçin">
                <option value="anime">📺 Bölüm: Anime</option>
                <option value="series">🎬 Bölüm: Dizi</option>
                <option value="movie">🍿 Bölüm: Film</option>
                <option value="manga">📖 Bölüm: Manga</option>
                <option value="book">📚 Bölüm: Kitap</option>
                <option value="guide">🧭 Bölüm: Rehber (Technopat Katalog)</option>
                <option value="project">💻 Bölüm: Projeler &amp; Forklar</option>
              </select>
              <select id="admSectionStatusSelect" class="inp glass" style="width:auto;min-width:170px;font-weight:600" title="Seçili bölümün sitedeki yayın durumu (Yayında olmasa bile girdi ekleyebilir, istediğiniz zaman Yayında yapabilirsiniz)">
                <option value="active">🟢 Sitede: Yayında (Aktif)</option>
                <option value="soon">🟡 Sitede: Yakında Kartı</option>
                <option value="hidden">⚪ Sitede: Gizli (Taslak)</option>
              </select>
              <button type="button" class="btn-secondary" id="openRapidQueueFromAnimeBtn" title="Tüm girdileri sırayla öne çıkararak hızlıca kategori, puan ve bölüm düzenlemenizi sağlar">⚡ Hızlı Sıralı Düzenleme</button>
              <button type="button" class="btn-primary" id="addNewAnimeBtn">+ Yeni Anime Ekle</button>
            </div>
          </div>

          <div class="adm-studio-strip">
            <span class="adm-strip-label">Stüdyo Araçları</span>
            <div class="adm-strip-btns">
              <button type="button" class="btn-subtle" id="toggleTagManagerBtn" title="Bu bölümdeki özel kategorileri yeniden adlandırın, birleştirin veya silin">🏷️ Kategori Yöneticisi</button>
              <button type="button" class="btn-subtle" id="toggleOverridesBtn">🔧 Senkron Kuralları (overrides.json)</button>
              <button type="button" class="btn-subtle" id="scanAllRelationsBtn" title="Listedeki animelerin İlk Sezon AniList Linklerini tarayarak eksik sezon, film ve yan içerikleri AniList'ten çeker">🔄 Yan İçerikleri Sorgula</button>
              <button type="button" class="btn-subtle" id="triggerActionsBtn" title="GitHub Actions üzerindeki sync-anilist.yml iş akışını tetikler">⚡ GitHub Actions Çalıştır</button>
              <button type="button" class="btn-subtle" id="openCommitRecoveryBtn" title="GitHub'daki önceki commit'lerinizden düzenlediğiniz kategori, puan ve başyapıt verilerini tek tıkla geri getirir">🕰️ Eski Commit'ten Kurtar</button>
              <button type="button" class="btn-subtle" id="downloadAnimeJsonBtn">💾 anime.json İndir</button>
              <button type="button" class="btn-subtle" id="exportAllAnimePostsBtn" style="color:var(--accent);font-weight:600" title="İzlenen bütün 73 animenin sosyal medya postlarını tek tıkla ZIP arşivi olarak indirin">📸 İzlenen Anime Postlarını İndir (ZIP)</button>
            </div>
          </div>

          <div id="animeStatsSummary" class="anime-stats-bar"></div>

          <!-- ÖZEL KATEGORİ (ETİKET) YÖNETİCİSİ: YENİDEN ADLANDIR / BİRLEŞTİR / SİL -->
          <div id="admTagManagerSection" class="editor-item" hidden>
            <div class="editor-item-head">
              <div class="editor-item-title">
                <span id="admTagManagerTitle">🏷️ Özel Kategori Yöneticisi (Yeniden Adlandır / Birleştir / Sil)</span>
              </div>
              <div class="field-row align-end" style="margin:0;gap:8px">
                <input type="text" id="admTagNewInput" class="inp glass" placeholder="Yeni kategori adı..." style="height:34px;width:190px;font-size:.82rem">
                <button type="button" class="btn-secondary" id="admTagAddNewBtn" style="padding:6px 12px;font-size:.8rem">+ Kataloğa Ekle</button>
                <button type="button" class="btn-subtle" id="closeTagManagerBtn" style="padding:6px 12px;font-size:.8rem">Kapat ✕</button>
              </div>
            </div>
            <p class="meta" style="margin:0">Bir kategorinin adını değiştirdiğinizde o kategoriye sahip tüm kayıtlarda otomatik güncellenir. Mevcut başka bir kategorinin adını yazarsanız iki kategori tek isim altında birleştirilir.</p>
            <div id="admTagManagerGrid" class="tag-mgr-grid"></div>
          </div>

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
                <option value="unscored">Puanı Girilmemiş Olanlar</option>
                <option value="missing_cover">Kapak Görseli Eksik Olanlar</option>
                <option value="manual">Elle Eklenenler (manual)</option>
                <option value="modified">Admin Düzenlemeli</option>
              </select>
            </label>
            <label class="field">
              <span>Liste Sıralaması</span>
              <select id="admAnimeSortSelect" class="inp glass">
                <option value="added_desc">En Yeni Eklenen</option>
                <option value="added_asc">En Eski Eklenen</option>
                <option value="score_desc">Puan (Yüksek → Düşük)</option>
                <option value="score_asc">Puan (Düşük → Yüksek)</option>
                <option value="title_asc">Başlık (A → Z)</option>
                <option value="title_desc">Başlık (Z → A)</option>
                <option value="parts_desc">Bölüm / Parça Sayısı (Çok → Az)</option>
              </select>
            </label>
          </div>

          <!-- ADIM 18: ÇOKLU SEÇİM (BATCH ACTIONS) VE TOPLU YÖNETİM ÇUBUĞU -->
          <div id="admBatchBar" class="adm-batch-bar">
            <div class="adm-batch-left">
              <label title="Listelenen tüm kayıtları seç veya seçimi kaldır">
                <input type="checkbox" id="admSelectAllCheck">
                <span id="admBatchCountText">Tümünü Seç (0)</span>
              </label>
              <button type="button" class="btn-subtle" id="admClearSelectionBtn" style="padding:4px 10px;font-size:.78rem" hidden>Seçimi Temizle</button>
            </div>
            <div id="admBatchActionsWrap" class="adm-batch-actions" hidden>
              <div class="adm-batch-group">
                <select id="admBatchCatSelect" class="inp glass adm-batch-inp" title="Seçili kayıtlara eklenecek veya çıkarılacak kategori"></select>
                <input type="text" id="admBatchCustomCatInp" class="inp glass adm-batch-inp" placeholder="veya yeni kategori..." style="max-width:135px">
                <button type="button" class="btn-secondary" id="admBatchAddCatBtn" style="padding:5px 10px;font-size:.78rem" title="Seçili tüm kayıtlara bu kategoriyi ekler">+ Kategori Ekle</button>
                <button type="button" class="btn-subtle" id="admBatchRemoveCatBtn" style="padding:5px 10px;font-size:.78rem" title="Seçili tüm kayıtlardan bu kategoriyi çıkarır">− Çıkar</button>
              </div>
              <div class="adm-batch-group">
                <select id="admBatchStatusSelect" class="inp glass adm-batch-inp" title="Seçili kayıtların yeni durumu"></select>
                <button type="button" class="btn-secondary" id="admBatchApplyStatusBtn" style="padding:5px 10px;font-size:.78rem">Durumu Uygula</button>
              </div>
              <div class="adm-batch-group" id="admBatchScoreGroup">
                <input type="number" id="admBatchScoreInp" class="inp glass adm-batch-inp" min="0" max="10" step="0.1" placeholder="Puan (Örn: 8.5)" style="width:118px!important">
                <button type="button" class="btn-secondary" id="admBatchApplyScoreBtn" style="padding:5px 10px;font-size:.78rem" title="Seçili kayıtların izlenen sezonlarına/parçalarına bu puanı atar">★ Puan Ata</button>
              </div>
              <div class="adm-batch-group">
                <button type="button" class="fav-toggle-btn" id="admBatchFavOnBtn" style="padding:5px 10px;font-size:.78rem">★ İşaretle</button>
                <button type="button" class="btn-subtle" id="admBatchFavOffBtn" style="padding:5px 10px;font-size:.78rem">☆ Kaldır</button>
              </div>
              <button type="button" class="btn-secondary" id="admBatchSendToRapidBtn" style="padding:5px 11px;font-size:.78rem" title="Yalnızca seçtiğiniz bu kayıtları Hızlı Sıralı Düzenleme kuyruğuna gönderir">⚡ Seçilenleri Hızlı Düzenle</button>
              <button type="button" class="btn-danger" id="admBatchDeleteBtn" style="padding:5px 11px;font-size:.78rem">🗑️ Seçilenleri Sil</button>
            </div>
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
                  <option value="no_subscores">★ 5 Yıldız Kriter Karnesi Eksik Olanlar (Hızlı Puanlama)</option>
                  <option value="uncategorized">Özel Kategorisi Seçilmemiş Olanlar</option>
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
              <button type="button" class="btn-secondary" id="rqOpenCoverPickerBtn" style="width:100%;padding:7px 10px;font-size:.78rem">🖼️ Sezon / Kapak Seç</button>
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
              <div id="rqCoverPickerWrap" class="cover-picker-drawer" hidden></div>

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
                    <p class="meta">Kriterlere 5 yıldız verin veya parçaları güncelleyin; genel puan otomatik hesaplanır.</p>
                  </div>
                  <div class="template-chips" id="rqBulkSeasonScoreChips"></div>
                </div>
                <div id="rqCriteriaStudioMount"></div>
                <div id="rqSubItemsList" class="rq-subitems-grid"></div>
              </div>
            </div>
          </div>

          <div class="rq-nav-footer">
            <div class="form-actions" style="margin:0">
              <button type="button" class="btn-subtle" id="rqPrevBtn">← Önceki Girdi</button>
              <button type="button" class="btn-subtle" id="rqSkipBtn">Değiştirmeden Sıradakine Geç →</button>
            </div>
            <span class="rq-kbd-hint">Kısayollar: <kbd>1</kbd> Aksiyon · <kbd>2</kbd> Hikâye · <kbd>3</kbd> Karakter · <kbd>4</kbd> Dengeli · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> Kaydet &amp; Geç</span>
            <div class="form-actions" style="margin:0">
              <button type="button" class="btn-secondary" id="rqSaveStayBtn">Sadece Kaydet</button>
              <button type="button" class="btn-primary" id="rqSaveNextBtn">Kaydet ve Sıradakine Geç →</button>
            </div>
          </div>
        </div>
      </div>

      <div id="panelNodes" class="admin-panel" hidden>
        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Bölümler &amp; Düğümler (Nodes)</h2>
              <p>Sitenin tüm ana bölümlerini, sayfalarını ve katalog yapısını XenForo ACP hiyerarşisiyle yönetin. Sıralamayı belirleyin, yayın durumunu (Aktif / Yakında / Gizli) tek tıkla değiştirin veya detaylı ayarlarını açın.</p>
            </div>
            <div class="quick-add-bar">
              <button type="button" class="btn-primary" id="addCategoryBtn">+ Yeni Düğüm / Bölüm Ekle</button>
            </div>
          </div>

          <!-- Düğümler / Site Kimliği Alt Sekmeleri -->
          <div class="page-text-tabs" id="nodesViewNavTabs" role="tablist" style="margin-bottom:14px">
            <button type="button" class="page-text-tab active" id="nodesSubNavTreeBtn">🌳 Bölüm &amp; Düğüm Ağacı</button>
            <button type="button" class="page-text-tab" id="nodesSubNavIdentityBtn">🌐 Site Kimliği &amp; Ana Sayfa Metinleri</button>
          </div>

          <!-- ALT GÖRÜNÜM 1: DÜĞÜM AĞACI -->
          <div id="nodesTreeWrap">
            <div class="nodes-stats-bar" id="nodesStatsBar"></div>
            <div class="template-chips" style="margin-bottom:14px">
              <span>Hızlı Şablon Ekle:</span>
              <button type="button" class="btn-chip" data-tpl-sec="manga">+ Manga</button>
              <button type="button" class="btn-chip" data-tpl-sec="book">+ Kitap</button>
              <button type="button" class="btn-chip" data-tpl-sec="series">+ Dizi</button>
              <button type="button" class="btn-chip" data-tpl-sec="movie">+ Film</button>
              <button type="button" class="btn-chip" data-tpl-sec="guide">+ Rehber</button>
              <button type="button" class="btn-chip" data-tpl-sec="project">+ Projeler</button>
            </div>
            <div id="categoriesList" class="node-tree"></div>
          </div>

          <!-- ALT GÖRÜNÜM 2: SİTE KİMLİĞİ VE ANA SAYFA METİNLERİ -->
          <div id="siteIdentityWrap" hidden>
            <div class="field-stack" style="margin-top:10px">
              <div class="field-row">
                <label class="field" style="flex:2">
                  <span>Ana Sayfa Başlığı (h1)</span>
                  <input type="text" id="cfgSiteTitle" class="inp glass" placeholder="Tempestian">
                </label>
                <label class="field">
                  <span>Alt Başlık / İsim (.sub)</span>
                  <input type="text" id="cfgSiteSubtitle" class="inp glass" placeholder="Bayram">
                </label>
              </div>
              <div class="field-row">
                <label class="field">
                  <span>Üst Çubuk Başlığı (.bar-title)</span>
                  <input type="text" id="cfgSiteBarTitle" class="inp glass" placeholder="Tempestian">
                </label>
                <label class="field">
                  <span>Alt Menü (Dock) Ana Sayfa Etiketi</span>
                  <input type="text" id="cfgSiteHomeLabel" class="inp glass" placeholder="Ana sayfa">
                </label>
              </div>
              <label class="field">
                <span>Site Meta Açıklaması (description — SEO ve Arama Motorları)</span>
                <textarea id="cfgSiteDesc" class="inp glass" rows="2" placeholder="Bayram Tempestian'ın kişisel sitesi."></textarea>
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
                <input type="text" id="cfgGiftTarget" class="inp glass" placeholder="2026-10-26T00:00:00+03:00">
              </label>
              <label class="field">
                <span>Tarih Alt Etiketi (dateLabel)</span>
                <input type="text" id="cfgGiftDateLabel" class="inp glass" placeholder="26 Ekim 2026 · 00.00 (TSİ)">
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

      <!-- ADIM 14 & 15: ARAÇLAR, VERİ SAĞLIĞI VE ÖNBELLEK MERKEZİ -->
      <div id="panelHealth" class="admin-panel" hidden>
        <!-- A) ÖNBELLEK & DİZİN YENİDEN OLUŞTURMA -->
        <div class="admin-card glass sq" id="rebuildCachesCard">
          <div class="card-head split-head">
            <div>
              <h2>🔄 Önbellek &amp; Dizin Yeniden Oluşturma (Rebuild Caches)</h2>
              <p>Tüm medya bölümlerindeki ağırlıklı puanları, özel kategori sayaçlarını ve arama dizinlerini tek tıkla baştan derleyin.</p>
            </div>
          </div>
          <div class="tools-action-grid">
            <div class="tool-action-box">
              <div class="tool-action-info">
                <strong>⚡ Tüm Puanları Yeniden Hesapla</strong>
                <p>Tüm anime, dizi, film, manga ve kitap kayıtlarındaki alt parça (parts) ve kriter ağırlıklarını baştan hesaplar, istatistikleri ve özet metrikleri günceller.</p>
              </div>
              <button type="button" class="btn-secondary" id="recalcAllScoresBtn">⚡ Tüm Puanları Yeniden Hesapla</button>
            </div>

            <div class="tool-action-box">
              <div class="tool-action-info">
                <strong>🏷️ Kategori Sayaçlarını Yeniden Dizinle</strong>
                <p>Tüm bölümlerdeki kullanılan özel türleri tarar, her türün kullanım sayısını günceller, özel kategori kataloğunu tazeler.</p>
              </div>
              <button type="button" class="btn-secondary" id="reindexCategoriesBtn">🏷️ Kategori Sayaçlarını Yeniden Dizinle</button>
            </div>

            <div class="tool-action-box highlight">
              <div class="tool-action-info">
                <strong>🚀 Tüm Site Önbelleğini Baştan Derle</strong>
                <p>Hem ağırlıklı puanları, hem tür sayaçlarını, hem de Dashboard metriklerini tek tıkla baştan derleyip yeniler.</p>
              </div>
              <button type="button" class="btn-primary" id="rebuildAllCachesBtn">🚀 Tüm Site Önbelleğini Baştan Derle</button>
            </div>
          </div>
        </div>

        <!-- B) KIRIK GÖRSEL VE BAĞLANTI TEŞHİSİ -->
        <div class="admin-card glass sq" id="diagnosticsCard">
          <div class="card-head split-head">
            <div>
              <h2>🔍 Kırık Görsel ve Bağlantı Teşhisi (Diagnostics)</h2>
              <p>Kapak görsellerinin (poster) ve harici kaynak bağlantılarının (Anilist, IMDb, Technopat) 404 verip vermediğini tarayıcı içinde hızlıca test eder.</p>
            </div>
            <div class="form-actions" style="margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <select id="diagSectionSelect" class="inp glass" style="width:auto;min-width:170px;font-weight:650">
                <option value="all">🌐 Tüm Medya Arşivi</option>
                <option value="anime">📺 Anime Verileri</option>
                <option value="series">🎬 Dizi Verileri</option>
                <option value="movie">🍿 Film Verileri</option>
                <option value="manga">📖 Manga Verileri</option>
                <option value="book">📚 Kitap Verileri</option>
                <option value="guide">🧭 Rehber Kataloğu</option>
              </select>
              <button type="button" class="btn-primary" id="startDiagBtn">🔍 Taramayı Başlat</button>
            </div>
          </div>
          <div id="diagResultsArea" class="diag-results-stack">
            <p class="help-txt" style="margin:0">Yukarıdaki <b>"Taramayı Başlat"</b> butonuna tıklayarak seçili bölümdeki tüm kapak görsellerinin erişilebilirliğini tarayıcınız üzerinden canlı test edebilirsiniz.</p>
          </div>
        </div>

        <!-- C) GELİŞMİŞ TOPLU GÜNCELLEME SİHİRBAZI -->
        <div class="admin-card glass sq" id="batchUpdateCard">
          <div class="card-head split-head">
            <div>
              <h2>⚡ Toplu Güncelleme Sihirbazı (Batch Update)</h2>
              <p>Belirli bir filtreye uyan kayıtlara tek seferde toplu durum, özel tür veya puan işlemi uygulayın.</p>
            </div>
          </div>
          <div class="batch-wizard-form">
            <div class="field-row">
              <label class="field" style="flex:1">
                <span>1. Medya Bölümü</span>
                <select id="batchSectionSelect" class="inp glass">
                  <option value="anime">📺 Anime</option>
                  <option value="series">🎬 Dizi</option>
                  <option value="movie">🍿 Film</option>
                  <option value="manga">📖 Manga</option>
                  <option value="book">📚 Kitap</option>
                  <option value="guide">🧭 Rehber</option>
                </select>
              </label>
              <label class="field" style="flex:1">
                <span>2. Hedef Kriter Filtresi</span>
                <select id="batchCriteriaSelect" class="inp glass">
                  <option value="all">Tüm Kayıtlar</option>
                  <option value="no_genre">Özel Türü Olmayanlar</option>
                  <option value="no_score">Puanı Olmayanlar</option>
                  <option value="completed">Tamamlanmış Olanlar</option>
                </select>
              </label>
              <label class="field" style="flex:1">
                <span>3. Uygulanacak Eylem</span>
                <select id="batchActionSelect" class="inp glass">
                  <option value="add_genre">Özel Tür Ekle</option>
                  <option value="change_status">Sitedeki Yayın Durumunu Değiştir</option>
                  <option value="recalc_score">Tüm Seçilenlerin Puanını Yeniden Hesapla</option>
                </select>
              </label>
            </div>

            <div id="batchActionParams" class="batch-action-params" style="margin-top:6px;">
              <div id="batchParamGenreWrap" class="field-row">
                <label class="field" style="flex:1">
                  <span>Eklenecek Özel Tür Adı</span>
                  <input type="text" id="batchGenreInput" class="inp glass" placeholder="Örn: Siberpunk, Kült Klasik, Distopya...">
                </label>
              </div>
              <div id="batchParamStatusWrap" class="field-row" hidden>
                <label class="field" style="flex:1">
                  <span>Sitedeki Yayın Durumu</span>
                  <select id="batchStatusSelect" class="inp glass"></select>
                </label>
              </div>
              <div id="batchParamRecalcWrap" class="help-txt" hidden style="margin-bottom:0">
                <span>ℹ️ Seçili kritere uyan tüm kayıtların parça puanları ve kriter katsayıları baştan hesaplanacak, istatistikler güncellenecektir.</span>
              </div>
            </div>

            <div class="batch-wizard-footer" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
              <div id="batchMatchSummary" class="batch-match-pill">
                <span>Hedef: <b>0</b> kayıt eşleşti</span>
              </div>
              <button type="button" class="btn-primary" id="applyBatchBtn" style="min-width:260px">
                ⚡ Seçili Kriterdeki Kayıtlara Uygula
              </button>
            </div>
            <div id="batchResultBanner" class="status-banner ok" hidden style="margin-top:12px;margin-bottom:0;"></div>
          </div>
        </div>

        <div class="admin-card glass sq" id="commitRecoveryCard">
          <div class="card-head split-head">
            <div>
              <h2>🕰️ GitHub Commit Geçmişinden Kategori ve Puan Kurtarma</h2>
              <p>Yeni ZIP yüklemesi sonrasında üzerine yazılan <code>data/anime.json</code> (veya <code>data/sections.json</code>) verilerinizi, GitHub reponuzdaki önceki commit'lerden tek tıkla geri yükleyin veya birleştirin.</p>
            </div>
            <div class="form-actions" style="margin:0">
              <select id="commitHistoryFileSelect" class="inp glass" style="width:auto;min-width:165px;font-weight:650">
                <option value="data/anime.json">📺 data/anime.json</option>
                <option value="data/guides.json">🧭 data/guides.json</option>
                <option value="data/projects.json">💻 data/projects.json</option>
                <option value="data/series.json">🎬 data/series.json</option>
                <option value="data/movies.json">🍿 data/movies.json</option>
                <option value="data/manga.json">📖 data/manga.json</option>
                <option value="data/books.json">📚 data/books.json</option>
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
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn-subtle" id="copyActiveSectionJsonBtn" title="Şu an seçili olan medya bölümünün güncel JSON verisini panoya kopyalar">📋 Seçili Bölümün JSON'unu Kopyala</button>
              <button type="button" class="btn-primary" id="exportFullSnapshotBtn">📦 Tüm Site Verilerini Tek Pakette İndir (.json)</button>
            </div>
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
              <h2>Tarayıcı Token Hafızası &amp; Güvenlik</h2>
              <p>GitHub Fine-Grained Token bilginiz bu tarayıcıda WebCrypto (AES-GCM) ile güvenle saklanır. İstediğiniz an kayıtlı oturumu silebilirsiniz.</p>
            </div>
            <div class="field-stack">
              <div class="form-actions wrap-actions">
                <button type="button" class="btn-danger" id="resetDeviceVaultBtn">Bu Tarayıcıdaki Kayıtlı Token'ı Sil ve Çıkış Yap</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- [AI-MIMARI-NOTU: ADIM 3 — ADMİN İÇİ INSTAGRAM POST VE STORY GÖRSEL ÜRETİCİSİ] -->
      <!-- [AI-MIMARI-NOTU: ADIM 3 — ADMİN İÇİ INSTAGRAM POST VE STORY GÖRSEL ÜRETİCİSİ (RETINA 2X STUDIO)] -->
      <div id="panelInstagram" class="admin-panel" hidden>
        <div class="admin-card glass sq insta-studio-container">
          <div class="card-head split-head">
            <div>
              <h2>📸 Instagram Görsel ve Paylaşım Stüdyosu (Retina 2x Studio)</h2>
              <p>Anime, Dizi, Film, Manga, Kitap ve Rehber arşiviniz için 2160p Retina kalitesinde Tekil İnceleme Kartları, Sezon Karuselleri, Spotify Wrapped tarzı Yıllık Özetler ve Katman kolajları üretin.</p>
            </div>
            <div class="form-actions" style="display:flex; gap:10px; flex-wrap:wrap">
              <button type="button" class="btn-subtle" id="renderInstaBtn">🎨 Görseli Yenile</button>
              <button type="button" class="btn-subtle" id="downloadZipInstaBtn" title="Karusel ve Wrapped slaytlarını tek bir ZIP paketi olarak indirin">📦 Tüm Slaytları ZIP İndir</button>
              <button type="button" class="btn-subtle" id="downloadInstaBtn">💾 Aktif Slaytı PNG İndir</button>
              <button type="button" class="btn-primary" id="downloadAllWatchedAnimeZipBtn" style="background: linear-gradient(135deg, #00a8ff 0%, #7c3aed 100%); border-color: transparent; font-weight: 650; box-shadow: 0 4px 14px rgba(0, 168, 255, 0.35);" title="İzlenen bütün animelerin sosyal medya postlarını tek tıkla ZIP arşivi olarak indirin">📦 Bütün İzlenen Animeleri ZIP İndir</button>
            </div>
          </div>

          <div class="insta-setup-grid">
            <div class="field-stack glass" style="padding: 20px; border-radius: var(--rm)">
              <label class="field">
                <span>🎨 Şablon / Düzen Türü</span>
                <select id="instaTemplateSelect" class="inp glass">
                  <option value="singleReview">🎯 Tekil İçerik Kartı &amp; İnceleme (Review Post)</option>
                  <option value="wrapped">✨ Tempestian Wrapped (Yıllık Özet Karuseli)</option>
                  <option value="topPicks">🏆 En Yüksek Puanlılar &amp; Favorilerim (Top Picks)</option>
                  <option value="tierCollage">🥇 Katman (Tier List) Özeti</option>
                </select>
              </label>

              <label class="field" id="instaCategoryRow">
                <span>📺 Medya Kategorisi</span>
                <select id="instaCategorySelect" class="inp glass">
                  <option value="anime">📺 Anime</option>
                  <option value="series">🎬 Dizi</option>
                  <option value="movie">🍿 Film</option>
                  <option value="manga">📖 Manga</option>
                  <option value="book">📚 Kitap</option>
                  <option value="guide">🧭 Rehber</option>
                </select>
              </label>

              <label class="field" id="instaItemSelectRow">
                <span>🎬 Paylaşılacak Yapım / Eser</span>
                <select id="instaItemSelect" class="inp glass">
                  <option value="">Yükleniyor...</option>
                </select>
              </label>

              <label class="field" id="instaPartModeRow" hidden>
                <span>📑 Parçalı Yapım Düzeni</span>
                <select id="instaPartModeSelect" class="inp glass">
                  <option value="carousel">📑 Kaydırmalı Karusel Seti (Çoklu Slayt)</option>
                  <option value="compact">🔲 Tek Kare Özet (Kompakt Karne)</option>
                </select>
              </label>

              <label class="field" id="instaWrappedYearRow" hidden>
                <span>📅 Wrapped Özeti Yılı</span>
                <select id="instaWrappedYear" class="inp glass">
                  <option value="2026">🌟 2026 Yılı Özeti</option>
                  <option value="2025">✨ 2025 Yılı Özeti</option>
                  <option value="2024">💫 2024 Yılı Özeti</option>
                  <option value="all">🌌 Tüm Zamanlar (Genel Arşiv)</option>
                </select>
              </label>

              <label class="field" id="instaSlideSelectRow" hidden>
                <span>🎞️ Canlı Önizlenen Slayt</span>
                <select id="instaSlideSelect" class="inp glass">
                  <option value="0">1. Slayt</option>
                </select>
              </label>

              <label class="field">
                <span>📱 Paylaşım Formatı &amp; Çözünürlük (Retina 2x)</span>
                <select id="instaFormatSelect" class="inp glass">
                  <option value="square">🖼️ Instagram Kare Gönderi (1:1 — 2160 × 2160)</option>
                  <option value="story">📱 Instagram Story (9:16 — 2160 × 3840)</option>
                  <option value="portrait">📐 Instagram Dikey Gönderi (4:5 — 2160 × 2700)</option>
                </select>
              </label>

              <label class="field">
                <span>✍️ Başlık Metni</span>
                <input type="text" id="instaTitleInput" class="inp glass" value="TEMPESTIAN İNCELEME">
              </label>

              <label class="field">
                <span>📝 Alt Başlık Metni</span>
                <input type="text" id="instaSubInput" class="inp glass" value="Kişisel Medya Arşivim ve Değerlendirmelerim · tempestian.com">
              </label>

              <label class="field">
                <span>✨ Vurgu Rengi Teması</span>
                <select id="instaThemeSelect" class="inp glass">
                  <option value="gold">🌟 Altın &amp; Amber (#f5a623)</option>
                  <option value="neonBlue" selected>⚡ Neon Mavi (#00a8ff)</option>
                  <option value="emerald">🍀 Zümrüt Yeşili (#52e3a4)</option>
                  <option value="violet">🔮 Büyülü Mor (#a855f7)</option>
                  <option value="rose">💖 Canlı Pembe (#f23d8f)</option>
                </select>
              </label>

              <div class="form-actions" style="margin-top: 10px; display:flex; gap:8px">
                <button type="button" class="btn-primary" id="renderInstaBtnSide" style="flex:1">Görseli Güncelle</button>
              </div>
            </div>

            <div class="insta-preview-panel">
              <div id="instaSlideIndicator" class="insta-slide-indicator" hidden>
                <span>🎞️ Slayt 1 / 1</span>
              </div>
              <div class="insta-canvas-wrapper">
                <canvas id="instaCanvas" class="insta-canvas"></canvas>
              </div>

              <!-- [AI-MIMARI-NOTU: SLAYT ŞERİDİ & GEZİNME ÇUBUĞU (CAROUSEL FILMSTRIP & SWITCHER)] -->
              <div id="instaSlideNav" class="insta-slide-nav">
                <div class="insta-slide-nav-head">
                  <div class="insta-slide-nav-title">
                    <span class="insta-nav-icon">🎞️</span>
                    <span id="instaSlideNavHeader">Çoklu Karusel Slaytları (Toplam 1 Gönderi)</span>
                  </div>
                  <div class="insta-slide-nav-actions">
                    <button type="button" class="btn-subtle insta-nav-btn" id="instaDownloadAllAnimeBtn" title="İzlenen bütün animelerin sosyal medya postlarını tek bir ZIP paketi olarak indirin">
                      📦 Tüm İzlenenler (ZIP)
                    </button>
                    <button type="button" class="btn-subtle insta-nav-btn" id="instaDownloadSlideBtn" title="Aktif slaytı PNG olarak indirin">
                      💾 Aktif Slaytı PNG İndir
                    </button>
                    <button type="button" class="btn-primary insta-nav-btn" id="instaDownloadZipBtn" title="Tüm karusel slaytlarını tek bir ZIP paketi olarak indirin">
                      📦 Tüm Slaytları ZIP İndir
                    </button>
                  </div>
                </div>

                <div class="insta-slide-nav-strip-wrap">
                  <button type="button" class="btn-subtle insta-nav-arrow" id="instaPrevSlideBtn" title="Önceki Slayt">
                    ◀ Önceki
                  </button>
                  <div id="instaSlidePills" class="insta-slide-pills" role="tablist" aria-label="Slayt Listesi">
                    <!-- Dinamik Pill Butonları -->
                  </div>
                  <button type="button" class="btn-subtle insta-nav-arrow" id="instaNextSlideBtn" title="Sonraki Slayt">
                    Sonraki ▶
                  </button>
                </div>
              </div>

              <p style="margin-top: 14px; font-size: 0.8rem; color: var(--txt-sub); text-align: center">
                Canlı önizleme ekrana sığdırılmıştır; indirdiğinizde 2160p Retina 2x ultra keskin kalitede PNG olarak kaydedilir.
              </p>

              <div class="insta-caption-box">
                <div class="insta-caption-header">
                  <h4>📝 Hazır Instagram Açıklaması (Caption)</h4>
                  <button type="button" class="btn-subtle" id="copyInstaCaptionBtn" style="font-size:0.8rem; padding:4px 12px">📋 Açıklamayı Kopyala</button>
                </div>
                <textarea id="instaCaptionText" class="insta-caption-textarea" readonly placeholder="Görsel oluşturulduğunda hazır açıklama metni burada belirecektir..."></textarea>
              </div>
            </div>
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
              <div class="field-row align-end" id="aeImageFieldWrap">
                <label class="field" style="flex:2">
                  <span>Kapak Görseli URL veya Yolu <small>(Kapak menüsünden seçtiğinizde otomatik dolar)</small></span>
                  <input type="text" id="aeImage" class="inp glass" placeholder="https://s4.anilist.co/... veya assets/img/...">
                </label>
                <button type="button" class="btn-secondary" id="aeOpenCoverPickerBtn" title="Sezonların, filmlerin veya alternatif basımların kapak görsellerini listeler ve seçtiğinizi otomatik uygular">🖼️ Sezon / Kapak Seçici Menüsü</button>
              </div>
              <div class="field-row" id="aeBannerFieldWrap">
                <label class="field" style="flex:2">
                  <span>🖼️ Sinematik Geniş Sahne Görseli (Backdrop Banner) URL <small>(Sıfır depolama: IMDb / AniList / TVMaze CDN)</small></span>
                  <input type="text" id="aeBanner" class="inp glass" placeholder="https://m.media-amazon.com/... veya https://s4.anilist.co/file/anilistcdn/media/anime/banner/...">
                </label>
              </div>
              <div id="aeCoverPickerWrap" class="cover-picker-drawer" hidden></div>
              <!-- PROJEYE ÖZEL ALANLAR (DİL, DAL, FORK, UPSTREAM, ÖZET, TERMİNAL KOMUTU) -->
              <div id="aeProjectFieldsWrap" class="field-stack" hidden>
                <div class="field-row">
                  <label class="field">
                    <span>Programlama Dili / Ana Teknoloji</span>
                    <input type="text" id="aeProjectLang" class="inp glass" placeholder="Örn: Nix, QML / Nix, Rust, Shell...">
                  </label>
                  <label class="field">
                    <span>İzlenen Dal (Branch)</span>
                    <input type="text" id="aeProjectBranch" class="inp glass" placeholder="Örn: main, fix-nix-support...">
                  </label>
                </div>
                <div class="project-fork-card" id="aeProjectForkCard">
                  <label class="project-fork-label">
                    <input type="checkbox" id="aeProjectIsFork" class="project-fork-check">
                    <div class="project-fork-info">
                      <div class="project-fork-title-row">
                        <span class="project-fork-title">Bu depo bir çataldır (Fork)</span>
                        <span class="project-fork-badge" id="aeProjectForkBadge">Bağımsız Proje</span>
                      </div>
                      <span class="project-fork-sub">snowarch/iNiR gibi orijinal bir upstream depodan türetildi; upstream değişiklikleri ve yamaları takip eder.</span>
                    </div>
                  </label>
                </div>
                <div class="field-row" id="aeProjectUpstreamRow" hidden>
                  <label class="field">
                    <span>Orijinal Depo Adı (Upstream)</span>
                    <input type="text" id="aeProjectUpstreamName" class="inp glass" placeholder="Örn: snowarch/iNiR">
                  </label>
                  <label class="field" style="flex:2">
                    <span>Orijinal Depo Linki (Upstream URL)</span>
                    <input type="text" id="aeProjectUpstreamUrl" class="inp glass" placeholder="https://github.com/snowarch/iNiR">
                  </label>
                </div>
                <div class="field-row">
                  <label class="field" style="flex:2">
                    <span>Proje Kısa Özeti <small>(Katalog kartında ve vitrinde görünür)</small></span>
                    <textarea id="aeProjectSummary" class="inp glass" rows="2" placeholder="Projenin kısa, vurucu ve net tek cümlelik özeti..."></textarea>
                  </label>
                </div>
                <div class="field-row">
                  <label class="field" style="flex:2">
                    <span>Terminal Kurulum / Klonlama Komutu</span>
                    <input type="text" id="aeProjectInstallCmd" class="inp glass project-cmd-input" placeholder="Örn: sudo nixos-rebuild switch --flake github:tempestian/nixos-config#nixos">
                    <small>Katalog kartında tek tıkla kopyalanabilir terminal bloğu olarak gösterilir.</small>
                  </label>
                </div>
                <div class="field-row">
                  <label class="field" style="flex:2">
                    <span>Öne Çıkan Özellikler / Vurgular <small>(Her satıra bir özellik; kartta rozet listesi olarak dizilir)</small></span>
                    <textarea id="aeProjectHighlights" class="inp glass project-highlights-textarea" rows="5" placeholder="Nix Flake &amp; Home Manager modüler mimarisi&#10;Niri scrollable Wayland kompozitör yapılandırması&#10;Quickshell 0.3+ dinamik masaüstü kabuk entegrasyonu&#10;Matugen ile duvar kâğıdından dinamik tema&#10;Zapret DPI aşımı ve CPU optimizasyonları"></textarea>
                  </label>
                </div>
                <div class="field-row">
                  <label class="field" style="flex:2">
                    <span>Proje Detaylı Açıklaması</span>
                    <textarea id="aeProjectDesc" class="inp glass" rows="4" placeholder="Projenin amacı, teknik mimarisi ve detaylı açıklaması..."></textarea>
                  </label>
                </div>
              </div>
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
                  <span style="display:flex;justify-content:space-between;align-items:center">
                    <span>Eklenme / İzleme Tarihi</span>
                    <small id="aeAddedAtPreview" style="color:var(--accent);font-size:.78rem;font-weight:600"></small>
                  </span>
                  <div style="display:flex;gap:6px;align-items:center">
                    <input type="text" id="aeAddedAt" class="inp glass" placeholder="YYYY-AA veya YYYY (Örn: 2024-10)" style="flex:1" autocomplete="off">
                    <button type="button" class="btn-secondary" id="aeAddedAtNowBtn" style="height:40px;padding:0 12px;font-size:.8rem;flex:none;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center" title="Mevcut ayı doldur">Bu Ay</button>
                  </div>
                </label>
                <label class="field" id="aeFavoriteFieldWrap">
                  <span id="aeFavoriteFieldLabel">Öne Çıkarma &amp; Vitrin</span>
                  <button type="button" class="fav-toggle-btn adm-modal-fav-btn" id="aeFavoriteBtn">☆ Başyapıt / Favori</button>
                </label>
              </div>
            </div>
          </div>

          <!-- ADIM 7 & 8: AĞIRLIKLI SEZON / FİLM / YAN İÇERİK PUANLAMA ÖZETİ -->
          <div class="score-studio" id="aeScoreStudioWrap">
            <div class="score-studio-top">
              <div>
                <h4 id="aeScoreStudioHeading">Ağırlıklı Otomatik Puanlama (Sezon ×1.00 · Film ×0.35 · Yan İçerik ×0.15)</h4>
                <p class="meta" id="aeScoreStudioSub">Aşağıdaki 5 yıldızlı kriterleri puanlayın; sistem ağırlıklarına göre 10 üzerinden virgüllü puanı otomatik belirler.</p>
              </div>
              <div class="score-badge-big" id="aeWeightedScoreDisplay">Puansız</div>
            </div>
            <div id="aeCriteriaStudioMount"></div>
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

      <!-- XENFORO ACP DÜĞÜM / BÖLÜM YAPILANDIRMA MODALI -->
      <div id="nodeEditModal" class="adm-modal" role="dialog" aria-modal="true" aria-labelledby="nodeModalTitle" hidden>
        <div class="adm-modal-bg" id="nodeModalBg"></div>
        <div class="adm-modal-card sq" style="max-width:760px">
          <div class="adm-modal-head">
            <h3 id="nodeModalTitle">⚙️ Düğüm Yapılandırması: <span id="nodeModalTitleSpan"></span></h3>
            <button type="button" class="btn glass" id="closeNodeModalBtn" aria-label="Kapat">✕</button>
          </div>

          <div style="padding:16px 20px">
            <!-- Düğüm Üst Bilgi Kartı -->
            <div class="node-modal-banner" id="nodeModalBanner">
              <span class="node-modal-ic" id="nodeModalIconPreview"></span>
              <div class="node-modal-meta" style="flex:1">
                <h4 id="nodeModalHeadTitle">Bölüm Adı</h4>
                <div class="node-modal-slug-row">
                  <span class="node-modal-slug" id="nodeModalSlugPreview">/yol/</span>
                  <span class="node-status-badge" id="nodeModalStatusBadge">🟢 Aktif</span>
                  <span class="node-count-badge" id="nodeModalCountBadge">0 Öğe</span>
                </div>
              </div>
            </div>

            <!-- Sekmeli Ayar Grubu -->
            <div class="page-text-tabs" id="nodeModalTabs" role="tablist">
              <button type="button" class="page-text-tab active" data-node-tab="general">📌 Temel &amp; Görünüm</button>
              <button type="button" class="page-text-tab" data-node-tab="texts">📝 Sayfa &amp; Arama Metinleri</button>
              <button type="button" class="page-text-tab" data-node-tab="advanced">⚙️ Veri &amp; Sistem</button>
            </div>

            <!-- SEKME 1: TEMEL BİLGİLER & GÖRÜNÜM -->
            <div id="nodeTabGeneral" class="node-tab-content">
              <div class="field-row">
                <label class="field" style="flex:2">
                  <span>Bölüm / Düğüm Başlığı (title)</span>
                  <input type="text" id="nmTitle" class="inp glass" placeholder="Örn: Projeler" required>
                  <small>Menüde, ana sayfa kartında ve sayfa başlığında görünür.</small>
                </label>
                <label class="field">
                  <span>Sayfa Yolu / URL Slug (path)</span>
                  <input type="text" id="nmPath" class="inp glass" placeholder="Örn: projeler/" required>
                  <small>Adres satırındaki göreceli yol.</small>
                </label>
              </div>

              <div class="field-row">
                <label class="field" style="flex:2">
                  <span>Alt Başlık / Slogan (subtitle)</span>
                  <input type="text" id="nmSubtitle" class="inp glass" placeholder="Örn: Kişisel GNU/Linux yapılandırmalarım, açık kaynak projelerim ve forklarım.">
                  <small>Kart altında ve sayfa üstünde açıklayıcı slogan olarak yer alır.</small>
                </label>
                <label class="field">
                  <span>Bölüm İkonu</span>
                  <select id="nmIcon" class="inp glass">
                    <option value="code">code (Kod / Depo)</option>
                    <option value="anime">anime (TV / Ekran)</option>
                    <option value="guide">guide (Rehber / Terminal)</option>
                    <option value="series">series (Dizi / Film Şeridi)</option>
                    <option value="movie">movie (Film / Klaket)</option>
                    <option value="manga">manga (Manga / Çizgi)</option>
                    <option value="book">book (Kitap / Cilt)</option>
                    <option value="game">game (Oyun Konsolu)</option>
                    <option value="music">music (Müzik Notası)</option>
                    <option value="star">star (Yıldız / Favori)</option>
                    <option value="sparkle">sparkle (Işıltı / Özel)</option>
                    <option value="info">info (Bilgi)</option>
                    <option value="dot">dot (Nokta)</option>
                  </select>
                </label>
              </div>

              <div class="field-row">
                <label class="field">
                  <span>Yayın Durumu (status)</span>
                  <select id="nmStatus" class="inp glass">
                    <option value="active">🟢 Aktif (Sitede Yayında &amp; Menüde Tıklanabilir)</option>
                    <option value="soon">🟡 Yakında (Ana Sayfada 'Yakında' Rozetiyle Görünür)</option>
                    <option value="hidden">⚪ Gizli (Ziyaretçilere Kapalı / Taslak)</option>
                  </select>
                </label>
                <label class="field" style="flex:2">
                  <span>Kutucuk Rozet Açıklaması (description)</span>
                  <input type="text" id="nmDescription" class="inp glass" placeholder="Örn: Açık kaynak projelerim ve forklarım / Yakında">
                  <small>Ana sayfa kutucuğundaki kısa durum metni.</small>
                </label>
              </div>

              <div class="field-row" style="margin-top:4px">
                <label class="project-fork-card" style="width:100%;cursor:pointer">
                  <div class="project-fork-label">
                    <input type="checkbox" id="nmShowStrip" class="project-fork-check">
                    <div class="project-fork-info">
                      <span class="project-fork-title">Ana Sayfa 4'lü Kapak Şeridini Göster</span>
                      <span class="project-fork-sub">Aktif edildiğinde ana sayfadaki bölüm kutucuğunun içinde son eklenen veya öne çıkan 4 içeriğin kapak görseli mini şerit olarak akar.</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <!-- SEKME 2: SAYFA METİNLERİ & ARAMA -->
            <div id="nodeTabTexts" class="node-tab-content" hidden>
              <div class="field-row">
                <label class="field">
                  <span>Tarayıcı Sekme Başlığı (&lt;title&gt;)</span>
                  <input type="text" id="nmMetaTitle" class="inp glass" placeholder="Örn: Projeler · Tempestian">
                </label>
                <label class="field" style="flex:2">
                  <span>Sayfa SEO Meta Açıklaması</span>
                  <input type="text" id="nmMetaDesc" class="inp glass" placeholder="Arama motorlarında ve paylaşımlarda görünen açıklama.">
                </label>
              </div>

              <div class="field-row">
                <label class="field">
                  <span>Arama Kutusu İpucu (searchPlaceholder)</span>
                  <input type="text" id="nmSearchPlaceholder" class="inp glass" placeholder="Örn: Proje, teknoloji ara...">
                </label>
                <label class="field">
                  <span>Boş Arama Sonucu Metni (emptyText)</span>
                  <input type="text" id="nmEmptyText" class="inp glass" placeholder="Örn: Henüz proje eklenmemiş veya eşleşen kayıt yok.">
                </label>
              </div>

              <div class="field-row">
                <label class="field">
                  <span>Dış Kaynak Buton Metni</span>
                  <input type="text" id="nmExternalBtn" class="inp glass" placeholder="Örn: GitHub Deposu / AniList'te aç / Technopat Sosyal">
                  <small>Detay kartlarında dış kaynağa yönlendiren buton etiketi.</small>
                </label>
                <label class="field">
                  <span>Ayrıntılar Buton Metni</span>
                  <input type="text" id="nmDetailsText" class="inp glass" placeholder="Ayrıntılar">
                </label>
                <label class="field">
                  <span>Filtre Sıfırlama Buton Metni</span>
                  <input type="text" id="nmResetText" class="inp glass" placeholder="Filtreleri sıfırla">
                </label>
              </div>

              <div class="field-row">
                <label class="field" style="flex:2">
                  <span>Sayfa Alt Bilgi Notu (footerText)</span>
                  <textarea id="nmFooterText" class="inp glass" rows="2" placeholder="Sayfanın en altında görünecek telif, kaynak veya açıklama notu..."></textarea>
                </label>
              </div>
            </div>

            <!-- SEKME 3: VERİ & SİSTEM BAĞLANTISI -->
            <div id="nodeTabAdvanced" class="node-tab-content" hidden>
              <div class="field-row">
                <label class="field">
                  <span>Veri Dosyası (data)</span>
                  <input type="text" id="nmDataFile" class="inp glass" placeholder="data/projects.json">
                  <small>Bölümün içeriklerinin tutulduğu JSON dosyası yolu.</small>
                </label>
                <label class="field">
                  <span>Veri Dizi Anahtarı (countKey)</span>
                  <input type="text" id="nmCountKey" class="inp glass" placeholder="projects">
                  <small>JSON içindeki ana dizi anahtarı.</small>
                </label>
                <label class="field">
                  <span>Sayaç Birimi (unit)</span>
                  <input type="text" id="nmUnit" class="inp glass" placeholder="proje">
                  <small>Örn: 'proje', 'anime', 'rehber', 'kitap'.</small>
                </label>
              </div>
            </div>
          </div>

          <div class="form-actions" style="justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid rgba(86,182,255,0.14);margin:0">
            <button type="button" class="btn-subtle" id="cancelNodeModalBtn">İptal</button>
            <button type="button" class="btn-primary" id="saveNodeModalBtn">Değişiklikleri Uygula</button>
          </div>
        </div>
      </div>

      <!-- EVRENSEL HIZLI KOMUT VE TÜM KATEGORİLERDE İÇERİK ARAMA PALETİ (Ctrl+K) -->
      <div id="admCmdPaletteModal" class="adm-modal" role="dialog" aria-modal="true" aria-label="Hızlı Komut ve İçerik Arama Paleti" hidden>
        <div class="adm-modal-bg" id="admCmdPaletteBg"></div>
        <div class="cmd-palette-card sq">
          <div class="adm-modal-head" style="padding-bottom:8px">
            <h3 style="font-size:1.02rem">🔍 Hızlı İçerik Arama &amp; Komut Paleti</h3>
            <button type="button" class="btn glass" id="closeCmdPaletteBtn" aria-label="Kapat">✕</button>
          </div>
          <input type="search" id="admCmdSearchInput" class="inp glass" placeholder="Tüm bölümlerde içerik ara (Anime, Dizi, Film, Manga, Kitap, Rehber) veya komut yaz..." autocomplete="off">
          <div id="admCmdResultsList" class="cmd-palette-list"></div>
          <div class="rq-kbd-hint" style="display:flex;justify-content:space-between;align-items:center">
            <span>İpucu: Herhangi bir esere tıklayarak doğrudan düzenleme penceresini açabilirsiniz.</span>
            <span><kbd>Ctrl</kbd>+<kbd>K</kbd> Aç/Kapat · <kbd>Esc</kbd> Kapat</span>
          </div>
        </div>
      </div>

      <!-- ADIM 4: COMMIT ÖNCESİ DEĞİŞİKLİK İNCELEME (DIFF PREVIEW & LOG) MODALI -->
      <div id="commitDiffModal" class="adm-modal" role="dialog" aria-modal="true" aria-labelledby="commitDiffTitle" hidden>
        <div class="adm-modal-bg" id="commitDiffModalBg"></div>
        <div class="adm-modal-card sq commit-diff-card">
          <div class="adm-modal-head">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="commit-diff-icon">🚀</span>
              <div>
                <h3 id="commitDiffTitle" style="margin:0;font-size:1.12rem">GitHub'a Kaydet · Değişiklik İnceleme (Diff Preview)</h3>
                <p class="meta" style="margin:2px 0 0;font-size:0.8rem">Depoya gönderilecek tüm değişiklikleri inceleyin ve commit mesajını belirleyin.</p>
              </div>
            </div>
            <button type="button" class="btn glass" id="closeCommitDiffModalBtn" aria-label="Kapat">✕</button>
          </div>

          <div class="commit-diff-body">
            <div class="field" style="margin-bottom:0.75rem">
              <label for="commitMsgInput" style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-weight:600;font-size:0.86rem">Commit Mesajı</span>
                <small class="meta" style="font-size:0.76rem">GitHub commit geçmişinde görünecektir</small>
              </label>
              <input type="text" id="commitMsgInput" class="inp glass" placeholder="feat(content): anime, dizi ve site ayarları güncellendi">
            </div>

            <div class="commit-diff-tree-wrap">
              <div class="commit-diff-tree-head">
                <span style="font-weight:650;font-size:0.86rem">Değişiklik Özeti Ağacı</span>
                <span id="commitDiffTotalBadge" class="commit-diff-count-badge">0 Değişiklik</span>
              </div>
              <div id="commitDiffList" class="commit-diff-list"></div>
            </div>

            <div id="commitProgressWrap" class="commit-progress-wrap" hidden>
              <div class="commit-progress-bar-bg">
                <div id="commitProgressBar" class="commit-progress-bar" style="width:0%"></div>
              </div>
              <div id="commitProgressStatus" class="commit-progress-status">GitHub'a yükleniyor...</div>
            </div>
          </div>

          <div class="form-actions" style="justify-content:flex-end;gap:10px;margin-top:1rem">
            <button type="button" class="btn-subtle" id="cancelCommitDiffBtn">İptal</button>
            <button type="button" class="btn-primary" id="confirmCommitDiffBtn" style="background:linear-gradient(135deg, #059669 0%, #047857 100%)">
              <span>🚀 Onayla ve GitHub'a Kaydet (Commit)</span>
            </button>
          </div>
        </div>
      </div>
    `;
    bindDashboardEvents();
  }
  const mountAdminDashboardDOM = renderAdminApp;

  const ACTIVE_SECTION_DESCRIPTIONS = {
    anime: 'İzlediğim animeler',
    guide: 'Technopat Sosyal rehber kataloğum',
    series: 'İzlediğim diziler',
    movie: 'İzlediğim filmler',
    manga: 'Okuduğum mangalar',
    book: 'Okuduğum kitaplar'
  };

  function ensureSectionEntryInConfig(secId) {
    if (!state.config || !Array.isArray(state.config.sections)) return null;
    const def = DEFAULT_CONFIG.sections.find(s => s.id === secId) || SECTION_TEMPLATES[secId];
    let entry = state.config.sections.find(s => s && s.id === secId);
    if (!entry && def) {
      entry = structuredClone(def);
      state.config.sections.push(entry);
    } else if (entry && def) {
      if (!entry.path) entry.path = def.path;
      if (!entry.data) entry.data = def.data;
      if (!entry.countKey) entry.countKey = def.countKey;
      if (!entry.unit) entry.unit = def.unit;
      if (!entry.icon) entry.icon = def.icon;
      if (entry.showStrip === undefined) entry.showStrip = def.showStrip;
    }
    return entry || null;
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
    if (Array.isArray(raw.sections)) {
      const defMap = new Map(DEFAULT_CONFIG.sections.map(s => [s.id, s]));
      const seen = new Set();
      const normalizedSecs = [];
      for (const s of raw.sections) {
        if (!s || !s.id) continue;
        seen.add(s.id);
        const def = defMap.get(s.id) || SECTION_TEMPLATES[s.id];
        if (def) {
          normalizedSecs.push({
            ...def,
            ...s,
            path: s.path || def.path,
            data: s.data || def.data,
            countKey: s.countKey || def.countKey,
            unit: s.unit || def.unit,
            icon: s.icon || def.icon,
            showStrip: s.showStrip !== undefined ? s.showStrip : def.showStrip
          });
        } else {
          normalizedSecs.push(s);
        }
      }
      for (const def of DEFAULT_CONFIG.sections) {
        if (!seen.has(def.id)) {
          normalizedSecs.push(structuredClone(def));
        }
      }
      merged.sections = normalizedSecs;
    }
    if (Array.isArray(raw.links)) merged.links = raw.links;
    if (raw.pages && typeof raw.pages === 'object') {
      for (const pKey of Object.keys(DEFAULT_CONFIG.pages)) {
        if (raw.pages[pKey] && typeof raw.pages[pKey] === 'object') {
          merged.pages[pKey] = { ...DEFAULT_CONFIG.pages[pKey], ...raw.pages[pKey] };
        }
      }
    }
    return merged;
  }

  async function loadAllData() {
    let remoteCfg = null;
    try {
      const res = await fetch(root + 'data/sections.json', { cache: 'no-store' });
      if (res.ok) remoteCfg = await res.json();
    } catch (e) {}
    let previewCfg = null;
    try {
      const preview = localStorage.getItem('tp_site_preview');
      if (preview) {
        previewCfg = JSON.parse(preview);
        const clr = $('#clearPreviewBtn');
        if (clr) clr.hidden = false;
      }
    } catch (e) {}
    let rawCfg = remoteCfg || previewCfg;
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
      rawCfg = { ...remoteCfg, ...previewCfg, sections: mergedSecs };
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

    // Adım 12 & 15: Dizi, Film, Manga, Kitap ve Rehber veri dosyalarını yükle
    // Not: Tarayıcı önbelleğindeki eski/boş `tp_multimedia_preview` verisinin depodaki
    // gerçek veriyi (`data/guides.json` vb.) gizlememesi için önce her zaman depodaki
    // güncel JSON dosyası (`cache: 'no-store'`) okunur.
    let prevMulti = {};
    try { prevMulti = JSON.parse(localStorage.getItem('tp_multimedia_preview') || '{}') || {}; } catch (e) {}
    for (const mType of ['series', 'movie', 'manga', 'book', 'guide', 'project']) {
      const adapter = CONTENT_ADAPTER_REGISTRY[mType];
      if (!adapter) continue;
      let remoteM = null;
      try {
        const r = await fetch(root + adapter.dataFile, { cache: 'no-store' });
        if (r.ok) remoteM = await r.json();
      } catch (e) {}
      const prevM = prevMulti[mType] || null;
      const remoteItems = (remoteM && (remoteM.items || remoteM[adapter.countKey])) || [];
      const prevItems = (prevM && (prevM.items || prevM[adapter.countKey])) || [];
      const rawM = (prevItems.length > 0 && prevItems.length > remoteItems.length) ? prevM : (remoteM || prevM);
      const items = (rawM && (rawM.items || rawM[adapter.countKey])) || [];
      state.multiMediaStore[mType] = {
        items,
        customGenreCatalog: Array.isArray(rawM && rawM.customGenreCatalog) ? rawM.customGenreCatalog : [],
        stats: computeMediaStatsClient(items, state.animeData.statsConfig, mType),
        dirty: false
      };
    }

    const sess = AdminSecurity.getSessionInfo();
    if (sess && sess.hasToken) {
      try {
        await Promise.allSettled([
          AdminSecurity.githubGetFile('data/anime.json'),
          AdminSecurity.githubGetFile('data/sections.json'),
          AdminSecurity.githubGetFile('data/overrides.json')
        ]);
      } catch (e) {
        console.warn('Taban SHA önbelleklenirken hata:', e);
      }
    }

    populateEditorFields();
    renderAnimeAdminPanel();
    renderOverridesEditor();
    state.dirtyConfig = false;
    state.dirtyAnime = false;
    state.dirtyOverrides = false;
    captureInitialSnapshots();
    state.sessionChangesLog = [];
    updateDirtyIndicator();
    switchAdminPanel('dashboard');
  }

  function syncBatchActionBar() {
    const bar = $('#admBatchBar');
    if (!bar) return;
    const adapter = getActiveAdminAdapter();
    const allItems = adapter.getItems() || [];
    const validIds = new Set(allItems.map(x => x.id));
    for (const id of [...state.selectedAdminIds]) {
      if (!validIds.has(id)) state.selectedAdminIds.delete(id);
    }

    const selCount = state.selectedAdminIds.size;
    const filteredIds = state.lastFilteredIds || [];
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => state.selectedAdminIds.has(id));

    bar.classList.toggle('has-sel', selCount > 0);
    const allChk = $('#admSelectAllCheck');
    if (allChk) {
      allChk.checked = allFilteredSelected;
      allChk.indeterminate = selCount > 0 && !allFilteredSelected;
    }
    const cntTxt = $('#admBatchCountText');
    if (cntTxt) {
      cntTxt.textContent = selCount > 0
        ? `⚡ ${selCount} ${adapter.label.toLocaleLowerCase('tr')} seçildi`
        : `Filtrelenenlerin Tümünü Seç (${filteredIds.length})`;
    }
    const clrBtn = $('#admClearSelectionBtn');
    if (clrBtn) clrBtn.hidden = selCount === 0;
    const actWrap = $('#admBatchActionsWrap');
    if (actWrap) actWrap.hidden = selCount === 0;

    const catSel = $('#admBatchCatSelect');
    if (catSel) {
      const catSet = new Set();
      for (const grp of (adapter.categoryGroups || CURATED_GENRE_GROUPS)) {
        for (const g of (grp.items || [])) catSet.add(g);
      }
      for (const g of (adapter.getCustomCatalog() || [])) {
        if (g) catSet.add(g);
      }
      const cats = [...catSet];
      const sig = cats.join('|');
      if (catSel.dataset.sig !== sig) {
        catSel.dataset.sig = sig;
        catSel.innerHTML = `<option value="">-- Kategori Seçin --</option>` + cats.map(c => `<option value="${AdminSecurity.sanitizeText(c, 50)}">${AdminSecurity.sanitizeText(c, 50)}</option>`).join('');
      }
    }

    const stSel = $('#admBatchStatusSelect');
    if (stSel && Array.isArray(adapter.statusOptions)) {
      const stSig = adapter.statusOptions.map(x => `${x[0]}:${x[1]}`).join('|');
      if (stSel.dataset.sig !== stSig) {
        stSel.dataset.sig = stSig;
        stSel.innerHTML = adapter.statusOptions.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
      }
    }

    const favOnBtn = $('#admBatchFavOnBtn');
    if (favOnBtn) {
      favOnBtn.textContent = adapter.id === 'guide' ? '★ Öne Çıkan Yap' : '★ Başyapıt Yap';
    }
    const scGrp = $('#admBatchScoreGroup');
    if (scGrp) scGrp.hidden = adapter.id === 'guide';
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
      },
      project: {
        panelTitle: 'Açık Kaynak Projeler, Forklar ve Sistem Yapılandırmaları Yönetimi',
        panelSub: 'Sitenizde listelenen GitHub projelerinizi, NixOS dotfile yapılandırmalarınızı, Quickshell/kabuk forklarınızı ve terminal kurulum komutlarınızı yönetin.',
        searchLabel: 'Proje Ara (Proje Adı, Kategori, Teknoloji, Dal veya GitHub URL)',
        searchPlaceholder: 'Örn: nixos-config, iNiR, Nix, Quickshell, Wayland, Niri...',
        emptyText: 'Filtreye uygun proje bulunamadı.',
        totalLabel: 'Listedeki Proje',
        consumedLabel: 'Aktif / Tamamlanan',
        seasonLabel: 'Özgün Proje',
        filmLabel: 'Özel Fork',
        unitStatLabel: 'Toplam Proje',
        rowUnitText: 'proje',
        plusBtnText: '+1'
      }
    };
    const uiMeta = SECTION_UI_META[adapter.id] || SECTION_UI_META.anime;

    if ($('#admMediaTypeSelect') && $('#admMediaTypeSelect').value !== adapter.id) {
      $('#admMediaTypeSelect').value = adapter.id;
    }
    const secEntry = ensureSectionEntryInConfig(adapter.id);
    if ($('#admSectionStatusSelect') && secEntry) {
      $('#admSectionStatusSelect').value = secEntry.status || 'soon';
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
    const scanBtn = $('#scanAllRelationsBtn');
    if (scanBtn) {
      scanBtn.hidden = !['anime', 'series', 'movie', 'manga'].includes(adapter.id);
      if (!scanBtn.disabled) {
        if (adapter.id === 'series') {
          scanBtn.textContent = '🔄 Sezonları & Kapakları Güncelle (IMDb/TVMaze)';
          scanBtn.title = "Listedeki dizilerin IMDb/TVMaze bağlantıları üzerinden yeni çıkan sezonları, bölüm sayılarını ve eksik kapakları tarar";
        } else if (adapter.id === 'movie') {
          scanBtn.textContent = '🔄 Eksik Kapak & Sahne Görselleri (IMDb/TVMaze)';
          scanBtn.title = "Listedeki filmlerin IMDb ve TVMaze bağlantıları üzerinden eksik afiş ve sahne görsellerini tamamlar";
        } else if (adapter.id === 'manga') {
          scanBtn.textContent = '🔄 Bölüm, Cilt & Banner Güncelle (AniList)';
          scanBtn.title = "Listedeki mangaların AniList bağlantıları üzerinden güncel bölüm/cilt sayılarını ve bannerlarını günceller";
        } else if (adapter.id === 'book') {
          scanBtn.textContent = '🔄 Sayfa & Kapakları Güncelle (OpenLibrary)';
          scanBtn.title = "Listedeki kitapların OpenLibrary üzerinden güncel sayfa sayılarını, yazarlarını ve kapaklarını çeker";
        } else {
          scanBtn.textContent = 'Yan İçerikleri Sorgula';
          scanBtn.title = "Listedeki animelerin İlk Sezon AniList Linklerini tarayarak eksik sezon, film ve yan içerikleri AniList'ten çeker";
        }
      }
    }
    const trigBtn = $('#triggerActionsBtn');
    if (trigBtn) {
      trigBtn.hidden = false;
      if (!trigBtn.disabled) {
        if (adapter.id === 'guide') {
          trigBtn.textContent = "🔄 Technopat'tan Rehberleri Çek (GitHub Actions)";
          trigBtn.title = "Sadece siz tıkladığınızda çalışır: Technopat Sosyal'de Bayram Tempestian (#657641) tarafından açılan 'Rehber' ön ekli tüm konuları GitHub Actions ile çekip listeler";
        } else if (adapter.id === 'project') {
          trigBtn.textContent = "💻 GitHub Proje Bilgilerini Güncelle";
          trigBtn.title = "Açık kaynak depoları ve fork bilgileri";
        } else if (adapter.id === 'anime') {
          trigBtn.textContent = '⚡ Anime & Yan İçerik Senkronu (sync-anilist.yml)';
          trigBtn.title = 'GitHub Actions üzerindeki sync-anilist.yml iş akışını tetikler';
        } else {
          trigBtn.textContent = `⚡ Çoklu API Senkronu (${adapter.label} · sync-multimedia.yml)`;
          trigBtn.title = `${adapter.label} için TVMaze, OpenLibrary, AniList veya IMDb iş akışını (sync-multimedia.yml) tetikler`;
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
    } else if (adapter.id === 'project') {
      const activeCount = list.filter(a => (a.status || 'completed') === 'completed').length;
      const forkCount = list.filter(a => Boolean(a.isFork)).length;
      statsBar.innerHTML = `
        <div class="adm-stat-pill"><b>${list.length}</b><span>${uiMeta.totalLabel}</span></div>
        <div class="adm-stat-pill"><b>${activeCount}</b><span>Aktif Proje</span></div>
        <div class="adm-stat-pill"><b>${forkCount}</b><span>Özel Fork</span></div>
        <div class="adm-stat-pill"><b>★ ${S.favorites || 0}</b><span>Öne Çıkan</span></div>
        <div class="adm-stat-pill"><b>${topGenreLabel}</b><span>Lider Teknoloji</span></div>
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
      if (q) {
        const hay = [
          it.title || '',
          gText,
          it.id || '',
          it.anilistId || '',
          it.threadId || '',
          it.firstSeasonUrl || '',
          it.url || '',
          it.summary || '',
          it.author || '',
          it.director || '',
          it.network || '',
          it.forumSection || ''
        ].join(' ').toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
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
        if (srcF === 'unscored' && resolveEffectiveScore(it) != null) return false;
        if (srcF === 'missing_cover' && Boolean(it.image)) return false;
        if (srcF === 'manual' && !isManual) return false;
        if (srcF === 'modified' && !it.adminModified) return false;
      }
      return true;
    });

    const sortMode = state.animeSortMode || 'added_desc';
    filtered.sort((a, b) => {
      if (sortMode === 'added_asc') {
        return (a.addedAt || '').localeCompare(b.addedAt || '') || (a.title || '').localeCompare(b.title || '', 'tr');
      }
      if (sortMode === 'score_desc') {
        return (resolveEffectiveScore(b) ?? -1) - (resolveEffectiveScore(a) ?? -1) || (a.title || '').localeCompare(b.title || '', 'tr');
      }
      if (sortMode === 'score_asc') {
        return (resolveEffectiveScore(a) ?? 99) - (resolveEffectiveScore(b) ?? 99) || (a.title || '').localeCompare(b.title || '', 'tr');
      }
      if (sortMode === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '', 'tr');
      }
      if (sortMode === 'title_desc') {
        return (b.title || '').localeCompare(a.title || '', 'tr');
      }
      if (sortMode === 'parts_desc') {
        const epA = normalizePartsForStats(a).reduce((n, p) => n + (p.watched || 0), 0);
        const epB = normalizePartsForStats(b).reduce((n, p) => n + (p.watched || 0), 0);
        return epB - epA || (b.parts || []).length - (a.parts || []).length;
      }
      return (b.addedAt || '').localeCompare(a.addedAt || '') || (a.title || '').localeCompare(b.title || '', 'tr');
    });

    state.lastFilteredIds = filtered.map(x => x.id);
    syncBatchActionBar();
    if ($('#admTagManagerSection') && !$('#admTagManagerSection').hidden) {
      renderTagManager();
    }

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
      const isRowSelected = state.selectedAdminIds.has(it.id);
      row.className = 'anime-adm-row' + (isRowSelected ? ' selected' : '');
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
        <label class="adm-row-check-wrap" title="Toplu işlem için seç">
          <input type="checkbox" class="adm-row-check" ${isRowSelected ? 'checked' : ''}>
        </label>
        <img class="anime-adm-poster" alt="" loading="lazy">
        <div class="anime-adm-info">
          <div class="anime-adm-title">
            <span class="adm-row-t"></span>
            <span class="src-badge ${isManual ? 'manual' : it.adminModified ? 'modified' : ''}">${sourceBadgeText}</span>
            ${it.favorite ? `<span class="src-badge fav">★ ${(adapter.id === 'guide' || adapter.id === 'project') ? 'Öne Çıkan' : 'Başyapıt'}</span>` : ''}
            ${it.next ? '<span class="src-badge next">Devam edilecek</span>' : ''}
            <span class="adm-genre-pills"></span>
          </div>
          <div class="anime-adm-sub">
            <span style="display:inline-flex;align-items:center;gap:4px">Durum: <select class="inp glass adm-quick-status-sel" title="Durumu doğrudan değiştir">${(adapter.statusOptions || []).map(([v, l]) => `<option value="${v}" ${it.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></span>
            ${adapter.id === 'guide' && it.forumSection ? `<span>Bölüm: <b>${AdminSecurity.sanitizeText(it.forumSection, 50)}</b></span>` : ''}
            ${it.addedAt ? `<span>Tarih: <b>${AdminSecurity.sanitizeText(window.formatHybridDate ? window.formatHybridDate(it.addedAt) : it.addedAt, 20)}</b></span>` : ''}
            ${(adapter.id === 'guide' || adapter.id === 'project') ? '' : `<span>Puan: <b>${effScore ? '★ ' + effScore : 'Puansız'}</b></span>`}
            ${(adapter.id === 'guide' || adapter.id === 'project') ? '' : `<span>Parça: <b>${(it.parts || []).length}</b> (${doneEps} ${uiMeta.rowUnitText})</span>`}
            ${adapter.id === 'project' && it.language ? `<span>Dil: <b>${AdminSecurity.sanitizeText(it.language, 40)}</b></span>` : ''}
            ${adapter.id === 'project' && it.isFork ? `<span style="color:#ce93d8">Fork: <b>${AdminSecurity.sanitizeText(it.upstreamName || 'Kaynak', 60)}</b></span>` : ''}
            ${adapter.id === 'project' && it.branch ? `<span>Dal: <code>${AdminSecurity.sanitizeText(it.branch, 40)}</code></span>` : ''}
            ${activePartLabel && (adapter.id !== 'guide' && adapter.id !== 'project') ? `<span class="adm-active-part">Aktif: <b></b></span>` : ''}
            <span class="adm-url-slot"></span>
          </div>
        </div>
        <div class="editor-item-actions">
          <button type="button" class="fav-toggle-btn adm-fav-btn ${it.favorite ? 'on' : ''}" title="Favori / Başyapıt olarak işaretle">${it.favorite ? ((adapter.id === 'guide' || adapter.id === 'project') ? '★ Öne Çıkan' : '★ Başyapıt') : '☆'}</button>
          <button type="button" class="quick-ep-btn adm-plus-ep-btn" ${(adapter.id === 'guide' || adapter.id === 'project') ? 'hidden' : ''} title="Aktif parçaya +1 ilerleme ekler">${uiMeta.plusBtnText}</button>
          <button type="button" class="quick-ep-btn done adm-done-part-btn" ${(adapter.id === 'guide' || adapter.id === 'project') ? 'hidden' : ''} title="Aktif parçayı tamamlandı olarak işaretler">Tamamla</button>
          <button type="button" class="btn-subtle adm-edit-btn">Düzenle</button>
          <button type="button" class="icon-btn del adm-del-btn" title="Sil / Hariç Tut">✕</button>
        </div>
      `;
      const img = row.querySelector('.anime-adm-poster');
      if (it.image) {
        img.src = resolvePreviewSrc(it.image);
      } else if (adapter.id === 'guide' || adapter.id === 'project') {
        img.hidden = true;
      }
      row.querySelector('.adm-row-t').textContent = it.fullName || it.title || it.name;
      const actPartEl = row.querySelector('.adm-active-part b');
      if (actPartEl) actPartEl.textContent = activePartLabel;

      const pillsWrap = row.querySelector('.adm-genre-pills');
      const rowCategories = Array.isArray(it.categories) && it.categories.length ? it.categories : effGenres;
      if (rowCategories.length) {
        rowCategories.slice(0, 4).forEach(g => {
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
        } else if (adapter.id === 'project') {
          a.textContent = `GitHub Deposu (${it.fullName || it.name || 'Repo'}) ↗`;
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

      const rowChk = row.querySelector('.adm-row-check');
      if (rowChk) {
        rowChk.onchange = () => {
          if (rowChk.checked) state.selectedAdminIds.add(it.id);
          else state.selectedAdminIds.delete(it.id);
          row.classList.toggle('selected', rowChk.checked);
          syncBatchActionBar();
        };
      }
      const quickStSel = row.querySelector('.adm-quick-status-sel');
      if (quickStSel) {
        quickStSel.onchange = () => {
          it.status = quickStSel.value;
          it.adminModified = true;
          if (adapter.id === 'anime') {
            const locked = new Set(it.lockedFields || []);
            locked.add('status');
            it.lockedFields = [...locked];
            state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
            markDirty('anime');
          } else {
            const store = ensureMultiMediaStore(adapter.id);
            store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, adapter.id);
            store.dirty = true;
            updateDirtyIndicator();
          }
          renderAnimeAdminPanel();
          toast(`"${it.title}" durumu "${statusLabelMap[it.status] || it.status}" olarak güncellendi.`);
        };
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
    logSessionChange({
      file: adapter.dataFile || 'data/anime.json',
      mediaType: adapter.id,
      action: 'delete',
      title: target.title,
      detail: 'Listeden silindi'
    });
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
    const isNew = !animeId || animeId === '__new__';
    state.editingAnimeId = isNew ? '__new__' : animeId;
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
      addedAt: new Date().toISOString().slice(0, 7),
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

    if (isNew && (adapter.id === 'guide' || adapter.id === 'project')) {
      state.editingDraft.parts = [];
      delete state.editingDraft.anilistId;
      delete state.editingDraft.firstSeasonUrl;
      delete state.editingDraft.score;
      delete state.editingDraft.lockedFields;
    }
    const d = state.editingDraft;
    const isAnilistType = adapter.id === 'anime' || adapter.id === 'manga';
    const parsed = isAnilistType ? parseAnilistUrlOrId(d.firstSeasonUrl || d.url || d.anilistId || d.id, adapter.id) : { id: null, url: '' };
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
        guide: 'Örn: Arch Linux Kurulum Rehberi',
        project: 'Örn: nixos-config veya iNiR'
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
        guide: 'https://www.technopat.net/sosyal/konu/...',
        project: 'https://github.com/tempestian/nixos-config'
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
        guide: "Technopat Sosyal'deki rehber konunuzun tam bağlantısını girin.",
        project: "Projenin veya forku olduğunuz deponun GitHub URL adresini girin."
      };
      $('#aeUrlFieldHint').textContent = urlHints[adapter.id] || '';
    }
    const fetchBtn = $('#fetchAnilistMetaBtn');
    if (fetchBtn) {
      fetchBtn.hidden = adapter.id === 'guide' || adapter.id === 'project';
      fetchBtn.textContent = (adapter.id === 'series' || adapter.id === 'movie')
        ? "IMDb'den Kapak & Bilgi Çek"
        : adapter.id === 'book'
          ? "OpenLibrary'den Kapak & Bilgi Çek"
          : "Linkten Kapak & Bağlantılı İçerikleri Çek";
    }
    const exWrap = $('#aeExtraMetaWrap');
    if (adapter.extraMetaField && adapter.id !== 'project') {
      exWrap.hidden = false;
      $('#aeExtraMetaLabel').textContent = adapter.extraMetaField.label;
      $('#aeExtraMetaInput').placeholder = adapter.extraMetaField.placeholder || '';
      $('#aeExtraMetaInput').value = d[adapter.extraMetaField.key] || '';
    } else {
      exWrap.hidden = true;
    }

    const aeStatusEl = $('#aeStatus');
    if (aeStatusEl && Array.isArray(adapter.statusOptions)) {
      const opts = (adapter.id === 'guide' || adapter.id === 'project')
        ? [...adapter.statusOptions]
        : [['auto', 'Otomatik (Parçalardan Hesapla)'], ...adapter.statusOptions];
      aeStatusEl.innerHTML = opts.map(([val, lbl]) => `<option value="${val}">${lbl}</option>`).join('');
    }
    const nextFieldWrap = $('#aeNext')?.closest('.field');
    if (nextFieldWrap) nextFieldWrap.hidden = !adapter.supportsNextBadge;

    if ($('#aeScoreStudioWrap')) $('#aeScoreStudioWrap').hidden = adapter.id === 'guide' || adapter.id === 'project';
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
        guide: 'Rehberin hangi konulara ait olduğunu (Linux & Sistem, Paket Yönetimi, Masaüstü & Özelleştirme, Donanım & Sürücü vb.) seçin veya yeni kategori tanımlayın.',
        project: 'Projenin ait olduğu teknolojileri ve kategorileri (NixOS, Quickshell, Wayland, Niri, Dotfiles vb.) seçin veya yeni kategori tanımlayın.'
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
        guide: 'Örn: Linux & Sistem, Paket Yönetimi, Masaüstü & Özelleştirme',
        project: 'Örn: NixOS, Quickshell, Wayland, Niri, Dotfiles'
      };
      $('#aeGenresInput').placeholder = genrePlaceholders[adapter.id] || 'Kategorileri virgülle ayırın...';
    }
    if ($('#aePartsSectionWrap')) $('#aePartsSectionWrap').hidden = adapter.id === 'guide' || adapter.id === 'project';
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
    if ($('#aeBanner')) $('#aeBanner').value = d.banner || '';
    const coverBoxEl = $('#aeCoverPreview')?.closest('.anime-edit-cover');
    if (coverBoxEl) coverBoxEl.hidden = adapter.id === 'guide' || adapter.id === 'project';
    const topGridEl = $('#aeCoverPreview')?.closest('.anime-edit-top');
    if (topGridEl) topGridEl.style.gridTemplateColumns = (adapter.id === 'guide' || adapter.id === 'project') ? '1fr' : '';
    if ($('#aeImageFieldWrap')) $('#aeImageFieldWrap').hidden = adapter.id === 'guide' || adapter.id === 'project';
    if ($('#aeBannerFieldWrap')) $('#aeBannerFieldWrap').hidden = adapter.id === 'guide' || adapter.id === 'project';
    if ($('#aeCoverPickerWrap')) {
      $('#aeCoverPickerWrap').hidden = true;
      $('#aeCoverPickerWrap').replaceChildren();
    }
    state.modalCoverCandidates = [];

    const prjWrap = $('#aeProjectFieldsWrap');
    if (prjWrap) {
      if (adapter.id === 'project') {
        prjWrap.hidden = false;
        if ($('#aeProjectLang')) $('#aeProjectLang').value = d.language || '';
        if ($('#aeProjectBranch')) $('#aeProjectBranch').value = d.branch || 'main';
        const updateForkCardState = (isFork) => {
          $('#aeProjectForkCard')?.classList.toggle('is-fork', isFork);
          if ($('#aeProjectForkBadge')) {
            $('#aeProjectForkBadge').textContent = isFork ? '🍴 Çatal (Fork) Depo' : 'Bağımsız Proje';
          }
          if ($('#aeProjectUpstreamRow')) $('#aeProjectUpstreamRow').hidden = !isFork;
        };
        if ($('#aeProjectIsFork')) {
          const isForkVal = Boolean(d.isFork);
          $('#aeProjectIsFork').checked = isForkVal;
          updateForkCardState(isForkVal);
          $('#aeProjectIsFork').onchange = (e) => updateForkCardState(e.target.checked);
        }
        if ($('#aeProjectUpstreamName')) $('#aeProjectUpstreamName').value = d.upstreamName || '';
        if ($('#aeProjectUpstreamUrl')) $('#aeProjectUpstreamUrl').value = d.upstreamUrl || '';
        if ($('#aeProjectSummary')) $('#aeProjectSummary').value = d.summary || '';
        if ($('#aeProjectInstallCmd')) $('#aeProjectInstallCmd').value = d.installCommand || '';
        if ($('#aeProjectHighlights')) $('#aeProjectHighlights').value = Array.isArray(d.highlights) ? d.highlights.join('\n') : (d.highlights || '');
        if ($('#aeProjectDesc')) $('#aeProjectDesc').value = d.description || '';
      } else {
        prjWrap.hidden = true;
      }
    }

    $('#aeStatus').value = d.status || 'completed';
    $('#aeNext').value = d.next === true ? 'yes' : d.next === false ? 'no' : 'auto';
    const rawAdded = d.addedAt || new Date().toISOString().slice(0, 7);
    $('#aeAddedAt').value = /^\d{4}-\d{2}-\d{2}$/.test(rawAdded) ? rawAdded.slice(0, 7) : rawAdded;
    if ($('#aeAddedAtNowBtn')) {
      $('#aeAddedAtNowBtn').onclick = () => {
        $('#aeAddedAt').value = new Date().toISOString().slice(0, 7);
        syncAddedAtPreview();
      };
    }
    $('#aeAddedAt').oninput = syncAddedAtPreview;
    syncAddedAtPreview();

    // Yalnızca admin tarafından seçilen özel kategorileri (`customGenres` / `categories`) göster
    const activeGenres = Array.isArray(d.customGenres) ? d.customGenres : (Array.isArray(d.categories) ? d.categories : []);
    $('#aeGenresInput').value = activeGenres.join(', ');

    syncModalFavoriteBtn();
    const hasMultipleParts = Array.isArray(d.parts) && d.parts.length > 1;
    const topTitle = hasMultipleParts ? 'Genel Yapım Puanlama Stüdyosu (Opsiyonel)' : '5 Yıldızlı Ağırlıklı Puanlama Stüdyosu';
    const topSub = hasMultipleParts
      ? 'Aşağıdaki parçaları sezon sezon ayrı ayrı 5 yıldızla puanlayabilirsiniz. Genel puan tüm sezonların ağırlıklı ortalamasından otomatik hesaplanır.'
      : 'Kriterlere 1–5 yıldız verin; sistem ağırlıklarına göre 10 üzerinden virgüllü puanı otomatik hesaplar.';

    renderCriteriaRatingStudio($('#aeCriteriaStudioMount'), state.editingDraft, adapter.id, () => {
      syncScoreStudioUI();
    }, topTitle, topSub);
    syncScoreStudioUI();
    renderQuickScoreChips();
    renderAnimeGenreStudio();
    renderAnimePartsEditor();
    $('#animeEditModal').hidden = false;
  }

  function syncAddedAtPreview() {
    const el = $('#aeAddedAt');
    const prev = $('#aeAddedAtPreview');
    if (!el || !prev) return;
    const v = (el.value || '').trim();
    if (!v) {
      prev.textContent = '';
    } else if (/^\d{4}-\d{2}$/.test(v)) {
      prev.textContent = `✓ ${window.formatHybridDate ? window.formatHybridDate(v) : v}`;
    } else if (/^\d{4}$/.test(v)) {
      prev.textContent = `✓ ${v} (Yalnızca Yıl)`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      prev.textContent = `✓ ${window.formatHybridDate ? window.formatHybridDate(v.slice(0, 7)) : v} (Kaydederken gün kırpılacak)`;
    } else {
      prev.textContent = `⚠️ Geçersiz format (YYYY-AA veya YYYY giriniz)`;
    }
  }

  function syncModalFavoriteBtn() {
    const btn = $('#aeFavoriteBtn');
    if (!btn || !state.editingDraft) return;
    const adapter = getActiveAdminAdapter();
    const isFav = Boolean(state.editingDraft.favorite);
    btn.classList.toggle('on', isFav);
    const favLabel = $('#aeFavoriteFieldLabel');
    if (adapter.id === 'guide') {
      if (favLabel) favLabel.textContent = 'Öne Çıkarma & Rehber';
      btn.textContent = isFav ? '★ Öne Çıkan Rehber (Seçili)' : '☆ Öne Çıkan İşaretle';
    } else if (adapter.id === 'project') {
      if (favLabel) favLabel.textContent = 'Öne Çıkarma & Vitrin';
      btn.textContent = isFav ? '★ Öne Çıkan Proje (Seçili)' : '☆ Öne Çıkan Proje';
    } else {
      if (favLabel) favLabel.textContent = 'Öne Çıkarma & Favori';
      btn.textContent = isFav ? '★ Başyapıt (Seçili)' : '☆ Başyapıt İşaretle';
    }
  }

  function syncScoreStudioUI() {
    if (!state.editingDraft) return;
    const adapter = getActiveAdminAdapter();
    const effScore = resolveEffectiveScore(state.editingDraft, adapter.id);
    state.editingDraft.score = effScore;

    // Otomatik Genel Yapım 5 Yıldız Kriter Karnesi Eşleme:
    // Sezonlar, filmler veya yan içerikler puanlandığında genel yapımın puanı ve karnesi otomatik hesaplanır!
    const parts = Array.isArray(state.editingDraft.parts) ? state.editingDraft.parts : [];
    const hasRatedParts = parts.some(p => p && (p.score != null || (p.subScores && Object.keys(p.subScores).length > 0)));

    if (hasRatedParts && effScore != null && effScore >= 2.0) {
      if (window.TempestianRating && typeof window.TempestianRating.computeWeightedSubScores === 'function') {
        const weightedSub = window.TempestianRating.computeWeightedSubScores(adapter.id, state.editingDraft);
        if (weightedSub) {
          state.editingDraft.subScores = weightedSub;
        } else if (typeof window.TempestianRating.deriveSubScores === 'function') {
          state.editingDraft.subScores = window.TempestianRating.deriveSubScores(adapter.id, effScore);
        }
      } else if (window.TempestianRating && typeof window.TempestianRating.deriveSubScores === 'function') {
        state.editingDraft.subScores = window.TempestianRating.deriveSubScores(adapter.id, effScore);
      }
    } else if (hasRatedParts && (effScore == null || effScore < 1.0)) {
      delete state.editingDraft.subScores;
    }

    const badge = $('#aeWeightedScoreDisplay');
    if (badge) {
      badge.textContent = effScore != null ? `★ ${effScore}` : 'Puansız';
    }

    // Ana kriter stüdyosu açıksa güncelle
    const mainCritMount = $('#aeCriteriaStudioMount');
    if (mainCritMount && mainCritMount.children.length > 0) {
      renderCriteriaRatingStudio(mainCritMount, state.editingDraft, adapter.id, (newSc) => {
        state.editingDraft.score = newSc;
      });
    }

    renderQuickScoreChips();
  }

  function renderCriteriaRatingStudio(mountEl, item, typeId, onScoreChange, customTitle, customSub) {
    if (!mountEl) return;
    mountEl.replaceChildren();
    if (typeId === 'guide' || !window.TempestianRating) return;

    const criteria = window.TempestianRating.CRITERIA[typeId] || window.TempestianRating.CRITERIA.anime;
    if (!criteria) return;

    if (!item.subScores || typeof item.subScores !== 'object') {
      item.subScores = {};
    }

    const wrap = document.createElement('div');
    wrap.className = 'criteria-studio';

    const titleText = customTitle || '5 Yıldızlı Ağırlıklı Puanlama Stüdyosu';
    const subText = customSub || 'Kriterlere 1–5 yıldız verin; sistem ağırlıklarına göre 10 üzerinden virgüllü puanı otomatik hesaplar.';

    const head = document.createElement('div');
    head.className = 'criteria-studio-head';
    head.innerHTML = `
      <div>
        <h5>${titleText}</h5>
        <p class="meta">${subText}</p>
      </div>
      <div class="criteria-studio-actions" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn-subtle btn-xs" id="autoFillSubScoresBtn" title="Genel puana göre 5 yıldızlı kriterleri otomatik dağıt">★ Puana Göre Kriterleri Doldur</button>
        <button type="button" class="btn-subtle btn-xs" id="clearSubScoresBtn">Puanı Sıfırla</button>
      </div>
    `;
    wrap.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'criteria-rows-grid';

    criteria.forEach(c => {
      const curVal = Number(item.subScores[c.id]) || 0;
      const weightPct = Math.round(c.weight * 100);

      const row = document.createElement('div');
      row.className = 'criterion-row';
      row.dataset.cid = c.id;

      row.innerHTML = `
        <div class="criterion-info">
          <div class="criterion-title-wrap">
            <span class="criterion-name">${c.label}</span>
            <span class="criterion-weight">%${weightPct}</span>
          </div>
          <span class="criterion-desc">${c.desc}</span>
        </div>
        <div class="criterion-stars-wrap">
          <div class="criterion-stars" role="radiogroup" aria-label="${c.label}"></div>
          <span class="criterion-num-badge">${curVal > 0 ? curVal + '/5' : 'Seçilmedi'}</span>
        </div>
      `;

      const starsContainer = row.querySelector('.criterion-stars');
      const badge = row.querySelector('.criterion-num-badge');
      if (curVal > 0) badge.classList.add('active');

      for (let star = 1; star <= 5; star++) {
        const starBtn = document.createElement('button');
        starBtn.type = 'button';
        starBtn.className = 'c-star-btn' + (star <= curVal ? ' on' : '');
        starBtn.textContent = '★';
        starBtn.title = `${star} / 5 Yıldız`;

        starBtn.onmouseenter = () => {
          const allBtns = starsContainer.querySelectorAll('.c-star-btn');
          allBtns.forEach((b, idx) => {
            b.classList.toggle('hover', idx < star);
          });
        };

        starBtn.onmouseleave = () => {
          const allBtns = starsContainer.querySelectorAll('.c-star-btn');
          allBtns.forEach(b => b.classList.remove('hover'));
        };

        starBtn.onclick = () => {
          if (item.subScores[c.id] === star) {
            delete item.subScores[c.id];
          } else {
            item.subScores[c.id] = star;
          }
          item.adminModified = true;
          const updatedVal = Number(item.subScores[c.id]) || 0;
          badge.textContent = updatedVal > 0 ? updatedVal + '/5' : 'Seçilmedi';
          badge.classList.toggle('active', updatedVal > 0);

          const allBtns = starsContainer.querySelectorAll('.c-star-btn');
          allBtns.forEach((b, idx) => {
            b.classList.toggle('on', idx < updatedVal);
          });

          const hasAny = Object.values(item.subScores).some(v => v != null && v > 0);
          if (!hasAny) {
            delete item.subScores;
          }

          const calculatedScore = window.TempestianRating ? window.TempestianRating.computeScore(criteria, item.subScores) : null;
          item.score = calculatedScore;
          if (typeof onScoreChange === 'function') {
            onScoreChange(calculatedScore);
          }
        };

        starsContainer.appendChild(starBtn);
      }

      grid.appendChild(row);
    });

    // Akıllı Arketip Profilleri Barı (Hızlı ve gerçekçi puanlama)
    const profilesBar = document.createElement('div');
    profilesBar.className = 'criteria-profiles-bar';
    profilesBar.innerHTML = `
      <span class="crit-prof-label">⚡ Akıllı Profil:</span>
      <button type="button" class="btn-subtle btn-xs" data-prof="action" title="Görsel, animasyon, ses ve aksiyonu öne çıkararak puana uyarlar">⚡ Aksiyon & Görsel</button>
      <button type="button" class="btn-subtle btn-xs" data-prof="story" title="Senaryo, kurgu ve dünya inşasını öne çıkararak puana uyarlar">📖 Hikâye & Kurgu</button>
      <button type="button" class="btn-subtle btn-xs" data-prof="character" title="Karakter derinliği, oyunculuk/seslendirme ve duyguyu öne çıkarır">🎭 Karakter & Duygu</button>
      <button type="button" class="btn-subtle btn-xs" data-prof="balanced" title="Kriterler arasında dengeli ve homojen dağıtır">⚖️ Dengeli</button>
    `;

    function applyArchetypeProfile(profKey) {
      const partRow = mountEl.closest ? mountEl.closest('.part-edit-row') : null;
      const partScoreInp = partRow ? partRow.querySelector('[data-pf="score"]') : null;
      const scoreInput = partScoreInp || document.getElementById('editScore') || document.getElementById('p_score');
      let targetVal = (item && item.score != null) ? Number(item.score) : (scoreInput && scoreInput.value !== '' ? Number(scoreInput.value) : null);
      if (targetVal == null || isNaN(targetVal) || targetVal < 1) {
        const userVal = prompt('Lütfen profile göre dağıtılacak genel puanı girin (örn: 8.5):', item.score || '8.0');
        if (!userVal) return;
        targetVal = Number(userVal);
      }
      if (isNaN(targetVal) || targetVal < 1 || targetVal > 10) {
        if (typeof showToast === 'function') showToast('Geçerli bir puan giriniz (1 - 10).', 'warn');
        return;
      }

      const derived = window.TempestianRating ? window.TempestianRating.deriveSubScores(typeId, targetVal, profKey) : null;
      if (!derived) {
        if (typeof showToast === 'function') showToast('Kriter puanları türetilemedi.', 'warn');
        return;
      }

      item.subScores = { ...derived };
      item.adminModified = true;

      const calculated = window.TempestianRating.computeScore(criteria, item.subScores);
      if (calculated != null) {
        item.score = calculated;
      }

      renderCriteriaRatingStudio(mountEl, item, typeId, onScoreChange, customTitle, customSub);
      if (typeof onScoreChange === 'function' && calculated != null) {
        onScoreChange(calculated);
      }
      if (typeof showToast === 'function') {
        const profNames = { action: 'Aksiyon & Görsel', story: 'Hikâye & Kurgu', character: 'Karakter & Duygu', balanced: 'Dengeli' };
        showToast(`[${profNames[profKey] || profKey}] profili ile 5 yıldızlı karnesi uyarlandı! (${targetVal})`, 'success');
      }
    }

    profilesBar.querySelectorAll('[data-prof]').forEach(btn => {
      btn.onclick = () => applyArchetypeProfile(btn.dataset.prof);
    });

    wrap.appendChild(profilesBar);
    wrap.appendChild(grid);

    const autoFillBtn = head.querySelector('#autoFillSubScoresBtn');
    if (autoFillBtn) {
      autoFillBtn.onclick = () => applyArchetypeProfile('balanced');
    }

    const clearBtn = head.querySelector('#clearSubScoresBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        item.subScores = {};
        delete item.subScores;
        item.score = null;
        item.adminModified = true;
        renderCriteriaRatingStudio(mountEl, item, typeId, onScoreChange, customTitle, customSub);
        if (typeof onScoreChange === 'function') {
          onScoreChange(null);
        }
      };
    }

    mountEl.appendChild(wrap);
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
    if (adapter.id === 'guide' || adapter.id === 'project') return;
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
          <label class="field" style="min-width:145px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
              <span>Puan (10 Üz.)</span>
              <button type="button" class="part-criteria-btn btn-subtle btn-xs" data-pact="toggle-crit" title="5 Yıldızlı Kriterlerle Puanla"></button>
            </div>
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
        <div class="part-criteria-mount" style="display:none;margin-top:10px;"></div>
      `;

      const critBtn = row.querySelector('[data-pact="toggle-crit"]');
      const critMount = row.querySelector('.part-criteria-mount');
      const scoreInp = row.querySelector('[data-pf="score"]');

      const syncCritBtnState = () => {
        if (!critBtn) return;
        const subCount = p.subScores ? Object.values(p.subScores).filter(v => v != null && v > 0).length : 0;
        if (subCount > 0) {
          critBtn.textContent = `★ ${p.score != null ? p.score : '-'} (${subCount}/6)`;
          critBtn.classList.add('has-score');
        } else {
          critBtn.textContent = '☆ 5 Yıldız';
          critBtn.classList.remove('has-score');
        }
      };
      syncCritBtnState();

      if (critBtn && critMount) {
        critBtn.onclick = () => {
          const isOpening = critMount.style.display === 'none';
          critMount.style.display = isOpening ? 'block' : 'none';
          critBtn.classList.toggle('active', isOpening);
          if (isOpening) {
            renderCriteriaRatingStudio(
              critMount,
              p,
              adapter.id,
              (newSc) => {
                p.score = newSc;
                p.adminModified = true;
                if (scoreInp) scoreInp.value = newSc != null ? newSc : '';
                syncCritBtnState();
                syncScoreStudioUI();
              },
              `#${idx + 1} ${AdminSecurity.sanitizeText(p.name || 'Parça', 40)} · Kriter Puanlaması`,
              'Bu sezon için kriterlere 1–5 yıldız verin; sezonun puanı ve genel yapım puanı ağırlıklarına göre otomatik güncellenir.'
            );
          }
        };
      }

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
            const wValDyn = p.kind === 'movie' ? weights.movie : p.kind === 'other' ? weights.other : weights.season;
            const wl = `Ağırlık ×${Number(wValDyn).toFixed(2)}`;
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
    const QM = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id format status episodes startDate{year month day} genres title{romaji english} coverImage{extraLarge large} bannerImage relations{edges{relationType node{id}}}}}}`;
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
    const rawUrlOrQuery = $('#aeFirstSeasonUrl').value.trim() || $('#aeAnilistId').value.trim() || $('#aeTitle').value.trim();
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
            state.editingDraft.image = info.image;
          }
          if (info.banner && $('#aeBanner')) {
            $('#aeBanner').value = info.banner;
            state.editingDraft.banner = info.banner;
          }
          if (info.url) $('#aeFirstSeasonUrl').value = info.url;
          if (adapter.id === 'manga' && info.externalId) $('#aeAnilistId').value = info.externalId;
          if (info.extraMeta && adapter.extraMetaField) {
            $('#aeExtraMetaInput').value = info.extraMeta;
            state.editingDraft[adapter.extraMetaField.key] = info.extraMeta;
          }
          if (Array.isArray(info.genres) && info.genres.length) {
            const curG = Array.isArray(state.editingDraft.customGenres) ? state.editingDraft.customGenres : [];
            const merged = [...new Set([...curG, ...info.genres])];
            state.editingDraft.customGenres = merged;
            state.editingDraft.genres = merged;
            if ($('#aeGenresInput')) $('#aeGenresInput').value = merged.join(', ');
            renderAnimeGenreStudio();
          }
          if (Array.isArray(info.parts) && info.parts.length) {
            state.editingDraft.parts = info.parts;
            renderAnimePartsEditor();
            syncScoreStudioUI();
          }
          const cands = Array.isArray(info.coverCandidates) ? info.coverCandidates : [];
          state.modalCoverCandidates = cands;
          if (cands.length > 0) {
            renderCoverPickerDrawer('modal', cands, $('#aeTitle').value.trim() || rawUrlOrQuery);
          }
          toast(`${adapter.label} bilgileri ve ${cands.length || 1} kapak görseli çekildi!`);
        }
      } catch (err) {
        toast('Sorgu başarısız: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
      return;
    }

    if (!rawUrlOrQuery) {
      toast('Lütfen önce ilk sezonun AniList linkini (URL), ID\'sini veya anime adını girin.', 'warn');
      return;
    }

    const btn = $('#fetchAnilistMetaBtn');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sorgulanıyor...';
    const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
    const kindFn = f => SERIES.has(f) ? 'season' : f === 'MOVIE' ? 'movie' : 'other';

    try {
      let parsed = parseAnilistUrlOrId($('#aeFirstSeasonUrl').value.trim() || $('#aeAnilistId').value.trim());
      let extraSearchMedia = [];
      if (!parsed.id) {
        const searchMatches = await ExternalCatalogFetcher.searchAnilistAnime(rawUrlOrQuery);
        if (!searchMatches.length) throw new Error('Eşleşen anime bulunamadı.');
        parsed = { id: searchMatches[0].id, url: 'https://anilist.co/anime/' + searchMatches[0].id };
        extraSearchMedia = searchMatches.slice(1);
      }
      $('#aeAnilistId').value = parsed.id;
      if (!$('#aeFirstSeasonUrl').value.trim()) $('#aeFirstSeasonUrl').value = parsed.url;

      const mediaMap = await queryConnectedAnilistGraph([parsed.id]);
      const rootMedia = mediaMap.get(parsed.id);
      if (!rootMedia) throw new Error('Bu AniList linki için kayıt bulunamadı.');

      if (!$('#aeTitle').value.trim()) {
        $('#aeTitle').value = rootMedia.title.english || rootMedia.title.romaji || '';
      }
      const rootCover = (rootMedia.coverImage && (rootMedia.coverImage.extraLarge || rootMedia.coverImage.large)) || '';
      if (rootCover && !$('#aeImage').value.trim()) {
        $('#aeImage').value = rootCover;
        $('#aeCoverPreview').src = rootCover;
        state.editingDraft.image = rootCover;
      } else if (rootCover && $('#aeImage').value.trim()) {
        $('#aeCoverPreview').src = resolvePreviewSrc($('#aeImage').value.trim());
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

      const cands = ExternalCatalogFetcher.buildAnimeCoverCandidates(sortedMedia, parsed.id, extraSearchMedia);
      state.modalCoverCandidates = cands;
      if (rootMedia && rootMedia.bannerImage && $('#aeBanner') && !$('#aeBanner').value.trim()) {
        $('#aeBanner').value = rootMedia.bannerImage;
        state.editingDraft.banner = rootMedia.bannerImage;
      }
      if (cands.length > 0) {
        if (!$('#aeImage').value.trim()) {
          $('#aeImage').value = cands[0].url;
          $('#aeCoverPreview').src = resolvePreviewSrc(cands[0].url);
          state.editingDraft.image = cands[0].url;
        }
        renderCoverPickerDrawer('modal', cands, $('#aeTitle').value.trim() || rawUrlOrQuery);
      }

      renderAnimePartsEditor();
      syncScoreStudioUI();
      toast(`${sortedMedia.length} bağlantılı içerik ve ${cands.length} sezon/film kapak görseli çekildi!`);
    } catch (err) {
      toast('AniList sorgusu başarısız: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  async function scanAllAnimeForSideContent() {
    const adapter = getActiveAdminAdapter();
    const btn = $('#scanAllRelationsBtn');
    if (adapter.id === 'series' || adapter.id === 'movie') {
      const list = adapter.getItems();
      if (!list.length) {
        toast(`Taranacak ${adapter.label.toLocaleLowerCase('tr')} kaydı bulunamadı.`, 'warn');
        return;
      }
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'IMDb / TVMaze Taranıyor...';
      let updatedItems = 0;
      let addedSeasons = 0;
      try {
        for (const item of list) {
          const query = item.imdbId || item.firstSeasonUrl || item.url || item.title;
          if (!query) continue;
          try {
            const info = await ExternalCatalogFetcher.fetchSeriesOrMovieFromImdb(query, adapter.id);
            if (info) {
              if (!item.image && info.image) item.image = info.image;
              if (!item.banner && info.banner) item.banner = info.banner;
              if (!item.url && info.url) item.url = info.url;
              if (adapter.id === 'series' && !item.firstSeasonUrl && info.url) item.firstSeasonUrl = info.url;
              if (adapter.extraMetaField && !item[adapter.extraMetaField.key] && info.extraMeta) {
                item[adapter.extraMetaField.key] = info.extraMeta;
              }
              if (Array.isArray(info.genres) && info.genres.length && (!item.customGenres || !item.customGenres.length)) {
                item.customGenres = [...info.genres];
                item.genres = [...info.genres];
              }
              if (adapter.id === 'series' && Array.isArray(info.parts) && info.parts.length) {
                const existingParts = Array.isArray(item.parts) ? item.parts : [];
                const byNameOrIdx = new Map();
                existingParts.forEach((ep, i) => {
                  byNameOrIdx.set(String(ep.id), ep);
                  byNameOrIdx.set(`idx:${i}`, ep);
                });
                const mergedParts = info.parts.map((fp, i) => {
                  const prev = byNameOrIdx.get(String(fp.id)) || byNameOrIdx.get(`idx:${i}`);
                  if (prev) {
                    if (!prev.episodes && fp.episodes) prev.episodes = fp.episodes;
                    if (!prev.year && fp.year) prev.year = fp.year;
                    return prev;
                  }
                  addedSeasons++;
                  return fp;
                });
                item.parts = mergedParts;
                const hasUnwatchedSeason = mergedParts.some(p => p.kind === 'season' && (p.watched || 0) === 0);
                if (item.status === 'completed' && hasUnwatchedSeason) item.next = true;
              }
              updatedItems++;
            }
          } catch (_) {}
        }
        const store = ensureMultiMediaStore(adapter.id);
        store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, adapter.id);
        store.dirty = true;
        updateDirtyIndicator();
        renderAnimeAdminPanel();
        toast(`${updatedItems} ${adapter.label.toLocaleLowerCase('tr')} tarandı${addedSeasons ? `, ${addedSeasons} yeni sezon eklendi` : ''}!`);
      } catch (err) {
        toast('Tarama hatası: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
      return;
    }

    if (adapter.id === 'manga') {
      const list = adapter.getItems();
      if (!list.length) {
        toast('Taranacak manga kaydı bulunamadı.', 'warn');
        return;
      }
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'AniList Manga Taranıyor...';
      let updatedCount = 0;
      try {
        for (const item of list) {
          const q = item.firstSeasonUrl || item.url || item.anilistId || item.title;
          if (!q) continue;
          try {
            const info = await ExternalCatalogFetcher.fetchMangaFromAnilist(q);
            if (!info) continue;
            if (!item.image && info.image) item.image = info.image;
            if (!item.banner && info.banner) item.banner = info.banner;
            if (!item.url && info.url) {
              item.url = info.url;
              item.firstSeasonUrl = info.url;
            }
            if (Array.isArray(item.parts) && item.parts.length && Array.isArray(info.parts) && info.parts[0]) {
              const p0 = item.parts[0];
              if (!p0.episodes && info.parts[0].episodes) p0.episodes = info.parts[0].episodes;
              if (!p0.year && info.parts[0].year) p0.year = info.parts[0].year;
            }
            updatedCount++;
          } catch (_) {}
        }
        const store = ensureMultiMediaStore('manga');
        store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, 'manga');
        store.dirty = true;
        updateDirtyIndicator();
        renderAnimeAdminPanel();
        toast(`${updatedCount} manga kaydı AniList üzerinden güncellendi!`);
      } catch (err) {
        toast('Manga tarama hatası: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
      return;
    }

    if (adapter.id === 'book') {
      const list = adapter.getItems();
      if (!list.length) {
        toast('Taranacak kitap kaydı bulunamadı.', 'warn');
        return;
      }
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'OpenLibrary Kitapları Taranıyor...';
      let updatedCount = 0;
      try {
        for (const item of list) {
          const q = item.title;
          if (!q) continue;
          try {
            const info = await ExternalCatalogFetcher.fetchBookFromOpenLibrary(q);
            if (!info) continue;
            if (!item.image && info.image) item.image = info.image;
            if (!item.banner && info.banner) item.banner = info.banner;
            if (!item.author && info.extraMeta) item.author = info.extraMeta;
            if (Array.isArray(info.parts) && info.parts[0] && (!item.parts || !item.parts.length || !item.parts[0].episodes)) {
              item.parts = info.parts;
            }
            updatedCount++;
          } catch (_) {}
        }
        const store = ensureMultiMediaStore('book');
        store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, 'book');
        store.dirty = true;
        updateDirtyIndicator();
        renderAnimeAdminPanel();
        toast(`${updatedCount} kitap kaydı OpenLibrary üzerinden güncellendi!`);
      } catch (err) {
        toast('Kitap tarama hatası: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
      return;
    }
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
    const adapter = getActiveAdminAdapter();
    const S = AdminSecurity.sanitizeText;
    const U = AdminSecurity.sanitizeUrl;
    const title = S($('#aeTitle').value, 200);
    if (!title) {
      toast(`${adapter.label} başlığı boş bırakılamaz.`, 'warn');
      return;
    }

    const rawUrlInput = $('#aeFirstSeasonUrl').value.trim();
    const rawAidInput = $('#aeAnilistId').value.trim();
    const isAnilistType = adapter.id === 'anime' || adapter.id === 'manga';
    const parsed = isAnilistType ? parseAnilistUrlOrId(rawUrlInput || rawAidInput, adapter.id) : { id: null, url: '' };
    const anilistId = parsed.id;
    const isNew = state.editingAnimeId === '__new__';

    const d = state.editingDraft;
    d.title = title;

    if (isAnilistType) {
      if (anilistId && anilistId > 0) {
        d.anilistId = anilistId;
        if (isNew || String(d.id).startsWith('custom-')) d.id = (adapter.id === 'manga' ? 'mg-' : 'al-') + anilistId;
        d.url = parsed.url;
        d.firstSeasonUrl = U(rawUrlInput, false) || parsed.url;
        if (Array.isArray(d.parts) && d.parts.length === 1 && String(d.parts[0].id).startsWith('part-')) {
          d.parts[0].id = anilistId;
        }
      } else {
        d.anilistId = null;
        if (isNew && !d.id) d.id = 'custom-' + Date.now();
        const cleanExt = U(rawUrlInput, true);
        d.url = cleanExt;
        d.firstSeasonUrl = cleanExt;
        if (!d.source) d.source = 'manual';
      }
    } else {
      delete d.anilistId;
      const cleanExt = U(rawUrlInput, true);
      if (adapter.id === 'guide') {
        const tpMatch = cleanExt.match(/\/sosyal\/konu\/[^/?#]*\.(\d+)(?:\/|$)/i);
        if (tpMatch) {
          d.threadId = Number(tpMatch[1]);
          if (isNew || String(d.id).startsWith('custom-')) d.id = 'tp-konu-' + d.threadId;
        }
        d.url = cleanExt;
        delete d.firstSeasonUrl;
      } else if (adapter.id === 'project') {
        d.url = cleanExt || ('https://github.com/tempestian/' + title.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
        const repoName = title.trim().split('/').pop().replace(/\s+/g, '-').toLowerCase();
        d.name = title.trim();
        d.fullName = d.url.includes('github.com/') ? d.url.split('github.com/')[1].replace(/\/+$/, '') : ('tempestian/' + repoName);
        if (isNew || !d.id || String(d.id).startsWith('custom-')) {
          d.id = 'prj-' + (repoName || Date.now());
        }
        delete d.firstSeasonUrl;
      } else {
        const imdbId = parseImdbId(cleanExt || rawUrlInput);
        if (imdbId) {
          d.imdbId = imdbId;
          if (isNew || String(d.id).startsWith('custom-')) d.id = 'imdb-' + imdbId;
        }
        const urlField = adapter.externalUrlField || 'url';
        d[urlField] = cleanExt;
        d.url = cleanExt;
      }
      if (!d.source) d.source = 'manual';
    }

    const cleanImg = U($('#aeImage').value, true);
    if (cleanImg) d.image = cleanImg;
    else if (adapter.id === 'guide' || adapter.id === 'project') delete d.image;
    else d.image = null;

    const cleanBanner = $('#aeBanner') ? U($('#aeBanner').value, true) : '';
    if (cleanBanner && adapter.id !== 'project') d.banner = cleanBanner;
    else delete d.banner;

    if (adapter.id === 'guide' || adapter.id === 'project') {
      delete d.parts;
      delete d.score;
      delete d.lockedFields;
      const statusSel = $('#aeStatus').value;
      d.status = (!statusSel || statusSel === 'auto') ? 'completed' : statusSel;
    } else {
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
      d.score = resolveEffectiveScore(d);
      const statusSel = $('#aeStatus').value;
      d.status = statusSel === 'auto' ? deriveFranchiseStatusFromParts(d.parts) : statusSel;
    }

    const nextSel = $('#aeNext').value;
    if (adapter.supportsNextBadge && nextSel === 'yes') d.next = true;
    else if (!adapter.supportsNextBadge || nextSel === 'no') delete d.next;

    if (d.favorite) d.favorite = true;
    else delete d.favorite;

    let rawAdded = S($('#aeAddedAt').value, 20).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawAdded)) rawAdded = rawAdded.slice(0, 7);
    d.addedAt = rawAdded || new Date().toISOString().slice(0, 7);

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
      if (adapter.id === 'project') {
        d.categories = customGenres;
        d.tags = customGenres;
      } else if (adapter.id !== 'guide') {
        d.genres = customGenres;
      }
    } else {
      delete d.customGenres;
      if (adapter.id === 'project') {
        d.categories = [];
        d.tags = [];
      } else if (adapter.id !== 'guide') {
        delete d.genres;
      }
    }

    if (adapter.id === 'project') {
      const lang = S($('#aeProjectLang')?.value || '', 60);
      d.language = lang || 'Nix';
      const langColors = {
        'Nix': '#5277C3',
        'QML / Nix': '#41CD52',
        'Rust': '#dea584',
        'JavaScript': '#f1e05a',
        'TypeScript': '#3178c6',
        'Python': '#3572A5',
        'Shell': '#89e051',
        'C++': '#f34b7d',
        'Go': '#00ADD8'
      };
      d.languageColor = langColors[d.language] || '#5277C3';
      d.branch = S($('#aeProjectBranch')?.value || '', 60) || 'main';
      const isForkChecked = Boolean($('#aeProjectIsFork')?.checked);
      d.isFork = isForkChecked;
      if (isForkChecked) {
        d.upstreamName = S($('#aeProjectUpstreamName')?.value || '', 100);
        d.upstreamUrl = U($('#aeProjectUpstreamUrl')?.value || '', true);
      } else {
        delete d.upstreamName;
        delete d.upstreamUrl;
      }
      const summaryVal = S($('#aeProjectSummary')?.value || '', 500).trim();
      if (summaryVal) d.summary = summaryVal;
      d.installCommand = S($('#aeProjectInstallCmd')?.value || '', 300);
      const hlText = $('#aeProjectHighlights')?.value || '';
      d.highlights = hlText.split('\n').map(l => S(l, 200).trim()).filter(Boolean);
      const descVal = S($('#aeProjectDesc')?.value || '', 1000);
      if (descVal) d.description = descVal;
      if (d.stars == null) d.stars = 0;
      if (d.forks == null) d.forks = 0;
    }

    d.adminModified = true;
    if (adapter.id === 'anime') {
      const locked = new Set(d.lockedFields || []);
      ['title', 'score', 'status', 'genres', 'addedAt'].forEach(k => locked.add(k));
      if (d.image) locked.add('image');
      if (nextSel !== 'auto') locked.add('next');
      d.lockedFields = [...locked];
    }

    if (adapter.extraMetaField && adapter.id !== 'project') {
      const maxExtraLen = adapter.id === 'guide' ? 500 : 160;
      d[adapter.extraMetaField.key] = S($('#aeExtraMetaInput').value, maxExtraLen);
    }

    if (adapter.id === 'project') {
      if (!d.summary && d.description) {
        d.summary = d.description.length > 180 ? (d.description.slice(0, 177) + '...') : d.description;
      } else if (!d.description && d.summary) {
        d.description = d.summary;
      }
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
    logSessionChange({
      file: adapter.dataFile || 'data/anime.json',
      mediaType: adapter.id,
      action: isNew ? 'add' : 'update',
      title: d.title,
      detail: adapter.id === 'project' ? `Teknoloji: ${d.language}` : `Puan: ${d.score != null ? d.score : 'Puansız'}`
    });

    $('#animeEditModal').hidden = true;
    renderAnimeAdminPanel();
    if (adapter.id === 'anime') renderOverridesEditor();
    if ($('#panelHealth') && !$('#panelHealth').hidden) renderHealthAuditor();
    if (adapter.id === 'guide') {
      toast(`"${d.title}" (Rehber) kaydedildi.`);
    } else if (adapter.id === 'project') {
      toast(`"${d.title}" (Proje) kaydedildi.`);
    } else {
      toast(`"${d.title}" (${adapter.label}) kaydedildi (Puan: ${d.score ?? 'Puansız'}).`);
    }
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
    dedupeCoverCandidates(list) {
      const seen = new Set();
      const out = [];
      for (const item of list || []) {
        if (!item || !item.url) continue;
        const cleanUrl = String(item.url).trim();
        if (!cleanUrl || seen.has(cleanUrl)) continue;
        seen.add(cleanUrl);
        out.push({
          url: cleanUrl,
          badge: item.badge || 'Kapak',
          label: item.label || 'Kapak Görseli',
          year: item.year || '',
          sub: item.sub || ''
        });
      }
      return out;
    },

    async searchAnilistAnime(queryText) {
      const q = String(queryText || '').trim();
      if (!q) return [];
      const query = `query($q:String){Page(perPage:10){media(search:$q,type:ANIME){id format status episodes startDate{year month day} title{romaji english} coverImage{extraLarge large}}}}`;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables: { q } })
      });
      if (!res.ok) return [];
      const j = await res.json();
      return ((j && j.data && j.data.Page && j.data.Page.media) || []).filter(m => m && m.format !== 'MUSIC');
    },

    buildAnimeCoverCandidates(sortedMedia, rootId, extraSearchMedia = []) {
      const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
      const raw = [];
      let seasonCounter = 0;
      for (const m of sortedMedia || []) {
        const img = (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '';
        if (!img) continue;
        const isSeason = SERIES.has(m.format);
        if (isSeason) seasonCounter++;
        const badge = isSeason
          ? `${seasonCounter}. Sezon`
          : m.format === 'MOVIE'
            ? 'Film'
            : (m.format || 'Yan İçerik');
        const title = m.title.english || m.title.romaji || badge;
        const year = (m.startDate && m.startDate.year) || '';
        raw.push({
          url: img,
          badge: m.id === rootId && isSeason ? `${seasonCounter}. Sezon (Ana)` : badge,
          label: title,
          year,
          sub: m.episodes ? `${m.episodes} Bölüm` : (m.format || '')
        });
      }
      for (const em of extraSearchMedia || []) {
        const img = (em.coverImage && (em.coverImage.extraLarge || em.coverImage.large)) || '';
        if (!img) continue;
        raw.push({
          url: img,
          badge: 'Alternatif Eşleşme',
          label: em.title.english || em.title.romaji || 'Anime',
          year: (em.startDate && em.startDate.year) || '',
          sub: em.format || ''
        });
      }
      return this.dedupeCoverCandidates(raw);
    },

    async fetchMangaFromAnilist(urlOrIdOrQuery) {
      const parsed = parseAnilistUrlOrId(urlOrIdOrQuery, 'manga');
      const isId = Boolean(parsed.id);
      const cleanQ = String(urlOrIdOrQuery || '').trim();
      const query = isId
        ? `query($id:Int){Media(id:$id,type:MANGA){id format title{romaji english} status chapters volumes startDate{year} coverImage{extraLarge large} bannerImage relations{edges{relationType node{id type format title{romaji english} chapters volumes startDate{year} coverImage{extraLarge large}}}}}}`
        : `query($q:String){Page(perPage:10){media(search:$q,type:MANGA){id format title{romaji english} status chapters volumes startDate{year} coverImage{extraLarge large} bannerImage relations{edges{relationType node{id type format title{romaji english} chapters volumes startDate{year} coverImage{extraLarge large}}}}}}}`;
      const variables = isId ? { id: parsed.id } : { q: cleanQ };
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables })
      });
      if (!res.ok) throw new Error('AniList Manga HTTP ' + res.status);
      const j = await res.json();
      const pageList = !isId ? ((j && j.data && j.data.Page && j.data.Page.media) || []) : [];
      const m = isId ? (j && j.data && j.data.Media) : pageList[0];
      if (!m) throw new Error('Manga bulunamadı.');

      const rawCands = [];
      const mainImg = (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '';
      if (mainImg) {
        rawCands.push({
          url: mainImg,
          badge: 'Ana Seri Kapağı',
          label: m.title.english || m.title.romaji || 'Manga',
          year: (m.startDate && m.startDate.year) || '',
          sub: m.volumes ? `${m.volumes} Cilt` : (m.chapters ? `${m.chapters} Bölüm` : 'MANGA')
        });
      }
      for (const ed of (m.relations && m.relations.edges) || []) {
        const node = ed && ed.node;
        if (!node || !node.coverImage) continue;
        const nImg = node.coverImage.extraLarge || node.coverImage.large;
        if (!nImg) continue;
        const relLbl = ed.relationType === 'SEQUEL'
          ? 'Devam Serisi'
          : ed.relationType === 'PREQUEL'
            ? 'Ön Seri'
            : ed.relationType === 'SIDE_STORY' || ed.relationType === 'SPIN_OFF'
              ? 'Yan Hikaye / Spin-Off'
              : (node.format || 'Bağlantılı');
        rawCands.push({
          url: nImg,
          badge: relLbl,
          label: (node.title && (node.title.english || node.title.romaji)) || 'Bağlantılı Eser',
          year: (node.startDate && node.startDate.year) || '',
          sub: node.volumes ? `${node.volumes} Cilt` : (node.format || '')
        });
      }
      for (const alt of pageList.slice(1)) {
        const aImg = alt.coverImage && (alt.coverImage.extraLarge || alt.coverImage.large);
        if (!aImg) continue;
        rawCands.push({
          url: aImg,
          badge: alt.format === 'NOVEL' ? 'Light Novel' : alt.format === 'ONE_SHOT' ? 'One-Shot' : 'Alternatif / Seri',
          label: (alt.title && (alt.title.english || alt.title.romaji)) || 'Manga',
          year: (alt.startDate && alt.startDate.year) || '',
          sub: alt.volumes ? `${alt.volumes} Cilt` : ''
        });
      }

      const coverCandidates = this.dedupeCoverCandidates(rawCands);
      return {
        externalId: m.id,
        url: 'https://anilist.co/manga/' + m.id,
        title: m.title.english || m.title.romaji || '',
        image: mainImg || (coverCandidates[0] && coverCandidates[0].url) || '',
        banner: m.bannerImage || null,
        coverCandidates,
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

    mapEnglishGenresToCatalog(rawGenres) {
      if (!rawGenres) return [];
      const list = Array.isArray(rawGenres) ? rawGenres : String(rawGenres).split(',').map(s => s.trim()).filter(Boolean);
      const map = {
        'action': 'Aksiyon',
        'adventure': 'Macera',
        'animation': 'Animasyon',
        'anime': 'Animasyon',
        'biography': 'Biyografi',
        'comedy': 'Komedi',
        'crime': 'Suç & Noir',
        'documentary': 'Belgesel',
        'drama': 'Dram',
        'family': 'Aile',
        'fantasy': 'Fantastik',
        'film-noir': 'Suç & Noir',
        'history': 'Tarihi',
        'horror': 'Korku',
        'music': 'Müzik',
        'musical': 'Müzikal',
        'mystery': 'Gizem',
        'romance': 'Romantik',
        'sci-fi': 'Bilim Kurgu',
        'science fiction': 'Bilim Kurgu',
        'sport': 'Spor',
        'thriller': 'Gerilim',
        'war': 'Savaş',
        'western': 'Western',
        'police': 'Suç & Polisiye'
      };
      const out = [];
      for (const g of list) {
        const lower = g.toLowerCase().trim();
        const mapped = map[lower] || g;
        if (!out.includes(mapped)) out.push(mapped);
      }
      return out;
    },

    async fetchSeriesOrMovieFromImdb(inputUrlOrQuery, mediaKind = 'series') {
      const imdbId = parseImdbId(inputUrlOrQuery);
      const cleanQuery = String(inputUrlOrQuery || '').trim();
      const rawCands = [];

      // 1. Dizi için TVMaze Lookup / Seasons / Images API (Dizilerde sezonları ve bölüm sayılarını en doğru TVMaze verir)
      if (mediaKind === 'series' && (imdbId || cleanQuery)) {
        try {
          const lookupUrl = imdbId
            ? `https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdbId)}`
            : `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanQuery)}`;
          const res = await fetch(lookupUrl);
          if (res.ok) {
            const show = await res.json();
            if (show && show.id) {
              const [sRes, imgRes] = await Promise.allSettled([
                fetch(`https://api.tvmaze.com/shows/${show.id}/seasons`),
                fetch(`https://api.tvmaze.com/shows/${show.id}/images`)
              ]);
              const seasons = (sRes.status === 'fulfilled' && sRes.value.ok) ? await sRes.value.json() : [];
              const showImages = (imgRes.status === 'fulfilled' && imgRes.value.ok) ? await imgRes.value.json() : [];

              const mainImg = (show.image && (show.image.original || show.image.medium)) || '';
              if (mainImg) {
                rawCands.push({
                  url: mainImg,
                  badge: 'Ana Dizi Posteri',
                  label: show.name || 'Ana Kapak',
                  year: show.premiered ? show.premiered.slice(0, 4) : '',
                  sub: 'TVMaze Ana Afiş'
                });
              }

              for (const s of (seasons || [])) {
                if (!s || (s.number || 0) <= 0) continue;
                const sImg = s.image && (s.image.original || s.image.medium);
                if (sImg) {
                  rawCands.push({
                    url: sImg,
                    badge: `${s.number}. Sezon Kapağı`,
                    label: s.name || `${show.name || 'Dizi'} · ${s.number}. Sezon`,
                    year: s.premiereDate ? s.premiereDate.slice(0, 4) : '',
                    sub: s.episodeOrder ? `${s.episodeOrder} Bölüm` : `${s.number}. Sezon`
                  });
                }
              }

              let altIdx = 1;
              for (const gi of (showImages || [])) {
                if (!gi || (gi.type && gi.type !== 'poster')) continue;
                const gUrl = gi.resolutions && ((gi.resolutions.original && gi.resolutions.original.url) || (gi.resolutions.medium && gi.resolutions.medium.url));
                if (gUrl) {
                  rawCands.push({
                    url: gUrl,
                    badge: gi.main ? 'Resmi Ana Poster' : `Alternatif Poster #${altIdx++}`,
                    label: show.name || 'Dizi Posteri',
                    year: show.premiered ? show.premiered.slice(0, 4) : '',
                    sub: 'Resmi Poster Galerisi'
                  });
                }
              }

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
              const coverCandidates = this.dedupeCoverCandidates(rawCands);
              const bgImg = (showImages || []).find(gi => gi && gi.type === 'background');
              const banner = (bgImg && bgImg.resolutions && ((bgImg.resolutions.original && bgImg.resolutions.original.url) || (bgImg.resolutions.medium && bgImg.resolutions.medium.url))) || (show.image && show.image.original) || null;
              const networkName = (show.network && show.network.name) || (show.webChannel && show.webChannel.name) || '';
              const genres = this.mapEnglishGenresToCatalog(show.genres);

              return {
                externalId: resolvedImdb || show.id,
                url: resolvedImdb ? `https://www.imdb.com/title/${resolvedImdb}/` : (show.officialSite || ''),
                title: show.name || '',
                image: mainImg || (coverCandidates[0] && coverCandidates[0].url) || '',
                banner,
                coverCandidates,
                extraMeta: networkName,
                genres,
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
        } catch (_) {}
      }

      // 2. Film (veya TVMaze'de bulunamayan Dizi) için IMDb / OMDb / Wikidata Servisi
      let omdbData = null;
      let omdbSearchList = [];
      const omdbKeys = ['trilogy', '4a3b711b'];

      for (const k of omdbKeys) {
        try {
          const qUrl = imdbId
            ? `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${k}`
            : `https://www.omdbapi.com/?t=${encodeURIComponent(cleanQuery)}&type=${mediaKind === 'movie' ? 'movie' : 'series'}&apikey=${k}`;
          const res = await fetch(qUrl);
          if (res.ok) {
            const j = await res.json();
            if (j && j.Response === 'True') {
              omdbData = j;
              // Eğer metin ile arandıysa ek afiş seçenekleri için arama sorgusunu da çek
              if (!imdbId && cleanQuery) {
                try {
                  const sRes = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(cleanQuery)}&type=${mediaKind === 'movie' ? 'movie' : 'series'}&apikey=${k}`);
                  if (sRes.ok) {
                    const sJ = await sRes.json();
                    if (sJ && Array.isArray(sJ.Search)) omdbSearchList = sJ.Search;
                  }
                } catch (_) {}
              }
              break;
            }
          }
        } catch (_) {}
      }

      // 3. OMDb verilerini ayrıştır
      let title = '';
      let year = null;
      let poster = '';
      let resolvedId = imdbId || '';
      let director = '';
      let writer = '';
      let actors = '';
      let genres = [];
      let rating = null;

      if (omdbData) {
        title = omdbData.Title || '';
        year = parseInt(omdbData.Year, 10) || null;
        poster = (omdbData.Poster && omdbData.Poster !== 'N/A') ? omdbData.Poster : '';
        resolvedId = omdbData.imdbID || imdbId || ('imdb-' + Date.now());
        director = (omdbData.Director && omdbData.Director !== 'N/A') ? omdbData.Director : '';
        writer = (omdbData.Writer && omdbData.Writer !== 'N/A') ? omdbData.Writer : '';
        actors = (omdbData.Actors && omdbData.Actors !== 'N/A') ? omdbData.Actors : '';
        genres = this.mapEnglishGenresToCatalog(omdbData.Genre);
        rating = (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') ? parseFloat(omdbData.imdbRating) : null;

        if (poster) {
          rawCands.push({
            url: poster,
            badge: mediaKind === 'movie' ? 'Ana Film Afişi' : 'Ana Dizi Afişi',
            label: title || 'IMDb Afiş',
            year: year || '',
            sub: resolvedId
          });
        }

        // Alternatif afiş adayları
        omdbSearchList.forEach((sItem, idx) => {
          const p = sItem && sItem.Poster;
          if (p && p !== 'N/A' && p !== poster) {
            rawCands.push({
              url: p,
              badge: `Alternatif Afiş #${idx + 2}`,
              label: sItem.Title || title,
              year: sItem.Year || '',
              sub: sItem.imdbID || ''
            });
          }
        });
      }

      // 4. Yönetmen veya Başlık eksikse Wikidata SPARQL Servisiyle Tamamla (100% Free / Keyless)
      if (resolvedId && (!director || !title)) {
        try {
          const sparql = `SELECT ?item ?title ?directorLabel ?year ?genreLabel WHERE {
            ?item wdt:P345 "${resolvedId}".
            OPTIONAL { ?item rdfs:label ?title. FILTER(LANG(?title) = "tr" || LANG(?title) = "en") }
            OPTIONAL { ?item wdt:P57 ?director. }
            OPTIONAL { ?item wdt:P577 ?date. BIND(YEAR(?date) AS ?year) }
            OPTIONAL { ?item wdt:P136 ?genre. }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }
          } LIMIT 5`;
          const wdUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
          const wdRes = await fetch(wdUrl, { headers: { Accept: 'application/sparql-results+json' } });
          if (wdRes.ok) {
            const wdJson = await wdRes.json();
            const bindings = (wdJson && wdJson.results && wdJson.results.bindings) || [];
            for (const b of bindings) {
              if (!director && b.directorLabel && b.directorLabel.value) director = b.directorLabel.value;
              if (!title && b.title && b.title.value) title = b.title.value;
              if (!year && b.year && b.year.value) year = parseInt(b.year.value, 10);
              if (b.genreLabel && b.genreLabel.value) {
                const gMapped = this.mapEnglishGenresToCatalog([b.genreLabel.value]);
                for (const gm of gMapped) {
                  if (!genres.includes(gm)) genres.push(gm);
                }
              }
            }
          }
        } catch (_) {}
      }

      if (!title) {
        throw new Error('IMDb üzerinde eşleşen yapım bulunamadı. Lütfen doğrudan IMDb bağlantısı (https://www.imdb.com/title/tt...) veya IMDb ID (tt...) giriniz.');
      }

      const extraMeta = mediaKind === 'movie'
        ? director
        : (writer || actors || '');

      const coverCandidates = this.dedupeCoverCandidates(rawCands);
      return {
        externalId: resolvedId,
        url: `https://www.imdb.com/title/${resolvedId}/`,
        title,
        director,
        image: poster || (coverCandidates[0] && coverCandidates[0].url) || '',
        banner: poster || null,
        coverCandidates,
        extraMeta,
        genres,
        score: rating,
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
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12`);
      if (!res.ok) throw new Error('OpenLibrary HTTP ' + res.status);
      const j = await res.json();
      const docs = (j && j.docs) || [];
      const doc = docs[0];
      if (!doc) throw new Error('Kitap bulunamadı.');
      const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '';
      const pages = doc.number_of_pages_median || 0;

      const rawCands = [];
      if (coverUrl) {
        rawCands.push({
          url: coverUrl,
          badge: 'Ana Kitap Kapağı',
          label: doc.title || 'Kitap',
          year: doc.first_publish_year || '',
          sub: (doc.author_name && doc.author_name[0]) || ''
        });
      }

      // Farklı basım/cilt kapaklarını OpenLibrary Editions API üzerinden çek
      if (doc.key && String(doc.key).startsWith('/works/')) {
        try {
          const edRes = await fetch(`https://openlibrary.org${doc.key}/editions.json?limit=24`);
          if (edRes.ok) {
            const edJson = await edRes.json();
            let edIdx = 1;
            for (const ed of (edJson && edJson.entries) || []) {
              const cid = ed && Array.isArray(ed.covers) && ed.covers.find(c => c && c > 0);
              if (!cid) continue;
              rawCands.push({
                url: `https://covers.openlibrary.org/b/id/${cid}-L.jpg`,
                badge: `Basım / Cilt #${edIdx++}`,
                label: ed.title || doc.title || 'Basım',
                year: ed.publish_date || '',
                sub: (Array.isArray(ed.publishers) && ed.publishers[0]) || ''
              });
            }
          }
        } catch (_) {}
      }

      // Arama sonuçlarındaki diğer cilt/basım kapakları
      docs.slice(1).forEach((dItem, idx) => {
        if (!dItem || !dItem.cover_i) return;
        rawCands.push({
          url: `https://covers.openlibrary.org/b/id/${dItem.cover_i}-L.jpg`,
          badge: `Alternatif / Cilt #${idx + 2}`,
          label: dItem.title || doc.title || 'Kitap',
          year: dItem.first_publish_year || '',
          sub: (dItem.author_name && dItem.author_name[0]) || ''
        });
      });

      const coverCandidates = this.dedupeCoverCandidates(rawCands);
      return {
        externalId: doc.key || ('book-' + Date.now()),
        url: doc.key ? `https://openlibrary.org${doc.key}` : raw,
        title: doc.title || '',
        image: coverUrl || (coverCandidates[0] && coverCandidates[0].url) || '',
        banner: coverUrl || null,
        coverCandidates,
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
    },

    async fetchCoverCandidatesOnly(mediaType, rawQueryOrUrl) {
      const q = String(rawQueryOrUrl || '').trim();
      if (!q) throw new Error('Kapak aramak için lütfen önce başlık veya kaynak linki girin.');
      if (mediaType === 'anime') {
        let parsed = parseAnilistUrlOrId(q, 'anime');
        let extraSearch = [];
        if (!parsed.id) {
          const matches = await this.searchAnilistAnime(q);
          if (!matches.length) throw new Error('Eşleşen anime kapağı bulunamadı.');
          parsed = { id: matches[0].id, url: 'https://anilist.co/anime/' + matches[0].id };
          extraSearch = matches.slice(1);
        }
        const mediaMap = await queryConnectedAnilistGraph([parsed.id]);
        const dk = s => ((s && s.year) || 9999) * 10000 + ((s && s.month) || 0) * 100 + ((s && s.day) || 0);
        const sortedMedia = [...mediaMap.values()].sort((a, b) => dk(a.startDate) - dk(b.startDate));
        return this.buildAnimeCoverCandidates(sortedMedia, parsed.id, extraSearch);
      }
      if (mediaType === 'manga') {
        const info = await this.fetchMangaFromAnilist(q);
        return (info && info.coverCandidates) || [];
      }
      if (mediaType === 'series' || mediaType === 'movie') {
        const info = await this.fetchSeriesOrMovieFromImdb(q, mediaType);
        return (info && info.coverCandidates) || [];
      }
      if (mediaType === 'book') {
        const info = await this.fetchBookFromOpenLibrary(q);
        return (info && info.coverCandidates) || [];
      }
      return [];
    }
  };

  function renderCoverPickerDrawer(targetMode, candidates, initialQuery = '') {
    const isModal = targetMode === 'modal';
    const wrap = $(isModal ? '#aeCoverPickerWrap' : '#rqCoverPickerWrap');
    if (!wrap) return;
    const adapter = isModal ? getActiveAdminAdapter() : getActiveAdapter();
    if (adapter.id === 'guide') {
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    wrap.replaceChildren();

    const currentImgUrl = isModal
      ? ($('#aeImage')?.value.trim() || '')
      : (state.rapidQueue.draftItem?.image || '');

    const head = document.createElement('div');
    head.className = 'cover-picker-head';
    head.innerHTML = `
      <div class="cover-picker-title">
        <span>🖼️ ${AdminSecurity.sanitizeText(adapter.label, 30)} Kapak Görseli Seçici (Sezon &amp; Alternatif Kapaklar)</span>
        <span class="cover-picker-count">${candidates.length} kapak</span>
      </div>
      <div class="cover-picker-search">
        <input type="text" class="inp glass cover-picker-q-inp" placeholder="Farklı sezon / başlık / ID ile kapak ara...">
        <button type="button" class="btn-subtle cover-picker-q-btn">🔍 Kapakları Getir</button>
        <button type="button" class="btn-subtle cover-picker-close-btn">Gizle ✕</button>
      </div>
    `;
    const qInp = head.querySelector('.cover-picker-q-inp');
    qInp.value = initialQuery || '';
    const qBtn = head.querySelector('.cover-picker-q-btn');
    const closeBtn = head.querySelector('.cover-picker-close-btn');
    closeBtn.onclick = () => { wrap.hidden = true; };

    const triggerSearch = async () => {
      const qVal = qInp.value.trim();
      if (!qVal) {
        toast('Lütfen aranacak başlık veya link girin.', 'warn');
        return;
      }
      qBtn.disabled = true;
      qBtn.textContent = 'Aranıyor...';
      try {
        const newCands = await ExternalCatalogFetcher.fetchCoverCandidatesOnly(adapter.id, qVal);
        if (isModal) state.modalCoverCandidates = newCands;
        else state.rqCoverCandidates = newCands;
        renderCoverPickerDrawer(targetMode, newCands, qVal);
        if (!newCands.length) toast('Eşleşen kapak görseli bulunamadı.', 'warn');
      } catch (err) {
        toast('Kapak araması başarısız: ' + err.message, 'err');
      } finally {
        qBtn.disabled = false;
        qBtn.textContent = '🔍 Kapakları Getir';
      }
    };
    qBtn.onclick = triggerSearch;
    qInp.onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerSearch();
      }
    };
    wrap.append(head);

    if (!candidates.length) {
      const empty = document.createElement('p');
      empty.className = 'help-txt';
      empty.style.margin = '0';
      empty.textContent = 'Henüz listelenecek kapak bulunamadı. Yukarıdaki arama kutusuna eser adını veya linkini yazıp "Kapakları Getir" butonuna tıklayın.';
      wrap.append(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'cover-picker-grid';

    candidates.forEach(cand => {
      const card = document.createElement('button');
      card.type = 'button';
      const isSel = currentImgUrl === cand.url;
      card.className = 'cover-pick-card' + (isSel ? ' selected' : '');
      card.innerHTML = `
        <div class="cover-pick-thumb">
          <img src="${AdminSecurity.sanitizeUrl(cand.url, true)}" alt="" loading="lazy" referrerpolicy="no-referrer">
          <span class="cover-pick-badge">${AdminSecurity.sanitizeText(cand.badge || 'Kapak', 40)}</span>
          ${isSel ? '<span class="cover-pick-check">✓ Seçili</span>' : ''}
        </div>
        <div class="cover-pick-caption">${AdminSecurity.sanitizeText(cand.label || '', 70)}</div>
        <div class="cover-pick-sub">${AdminSecurity.sanitizeText([cand.year, cand.sub].filter(Boolean).join(' · '), 50)}</div>
      `;
      card.onclick = () => {
        const cleanUrl = AdminSecurity.sanitizeUrl(cand.url, true);
        if (isModal) {
          if ($('#aeImage')) $('#aeImage').value = cleanUrl;
          if ($('#aeCoverPreview')) $('#aeCoverPreview').src = resolvePreviewSrc(cleanUrl);
          if (state.editingDraft) state.editingDraft.image = cleanUrl;
        } else {
          if (state.rapidQueue.draftItem) state.rapidQueue.draftItem.image = cleanUrl;
          if ($('#rqPosterImg')) $('#rqPosterImg').src = resolvePreviewSrc(cleanUrl);
        }
        renderCoverPickerDrawer(targetMode, candidates, qInp.value);
        toast(`"${cand.badge}" kapak görseli seçildi ve URL otomatik ayarlandı!`);
      };
      grid.append(card);
    });

    wrap.append(grid);
  }

  async function openAndFetchCoverPicker(targetMode) {
    const isModal = targetMode === 'modal';
    const wrap = $(isModal ? '#aeCoverPickerWrap' : '#rqCoverPickerWrap');
    const btn = $(isModal ? '#aeOpenCoverPickerBtn' : '#rqOpenCoverPickerBtn');
    const adapter = isModal ? getActiveAdminAdapter() : getActiveAdapter();
    if (!wrap || adapter.id === 'guide') return;

    const existingCands = isModal ? (state.modalCoverCandidates || []) : (state.rqCoverCandidates || []);
    const rawQuery = isModal
      ? ($('#aeFirstSeasonUrl')?.value.trim() || $('#aeAnilistId')?.value.trim() || $('#aeTitle')?.value.trim() || '')
      : ($('#rqExternalUrlInput')?.value.trim() || $('#rqTitleInput')?.value.trim() || state.rapidQueue.draftItem?.title || '');

    if (!wrap.hidden && existingCands.length) {
      wrap.hidden = true;
      return;
    }

    if (existingCands.length) {
      renderCoverPickerDrawer(targetMode, existingCands, rawQuery);
      return;
    }

    if (!rawQuery) {
      renderCoverPickerDrawer(targetMode, [], '');
      toast(`Kapakları çekmek için önce ${adapter.label.toLocaleLowerCase('tr')} başlığını veya kaynak linkini yazın.`, 'warn');
      return;
    }

    const origTxt = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Kapaklar Çekiliyor...';
    }
    try {
      const cands = await ExternalCatalogFetcher.fetchCoverCandidatesOnly(adapter.id, rawQuery);
      if (isModal) state.modalCoverCandidates = cands;
      else state.rqCoverCandidates = cands;
      if (cands.length > 0) {
        if (isModal && !$('#aeImage').value.trim()) {
          $('#aeImage').value = cands[0].url;
          $('#aeCoverPreview').src = resolvePreviewSrc(cands[0].url);
          if (state.editingDraft) state.editingDraft.image = cands[0].url;
        } else if (!isModal && state.rapidQueue.draftItem && !state.rapidQueue.draftItem.image) {
          state.rapidQueue.draftItem.image = cands[0].url;
          $('#rqPosterImg').src = resolvePreviewSrc(cands[0].url);
        }
      }
      renderCoverPickerDrawer(targetMode, cands, rawQuery);
      if (cands.length > 0) {
        toast(`${cands.length} sezon / alternatif kapak görseli listelendi. İstediğinize tıklayın!`);
      } else {
        toast('Bu sorgu için kapak görseli bulunamadı.', 'warn');
      }
    } catch (err) {
      renderCoverPickerDrawer(targetMode, [], rawQuery);
      toast('Kapak çekme hatası: ' + err.message, 'err');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = origTxt;
      }
    }
  }

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
      computeScore: (item) => resolveEffectiveScore(item, 'anime'),
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
      computeScore: (item) => resolveEffectiveScore(item, 'manga'),
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
      computeScore: (item) => resolveEffectiveScore(item, 'book'),
      saveItem: (updatedItem) => saveMultiMediaItem('book', updatedItem)
    },
    series: {
      id: 'series',
      label: 'Dizi',
      dataFile: 'data/series.json',
      countKey: 'series',
      titleLabel: 'Dizi Başlığı',
      externalUrlLabel: 'IMDb Linki (URL)',
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
      computeScore: (item) => resolveEffectiveScore(item, 'series'),
      saveItem: (updatedItem) => saveMultiMediaItem('series', updatedItem)
    },
    movie: {
      id: 'movie',
      label: 'Film',
      dataFile: 'data/movies.json',
      countKey: 'movies',
      titleLabel: 'Film Adı',
      externalUrlLabel: 'IMDb / Letterboxd Linki',
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
      computeScore: (item) => resolveEffectiveScore(item, 'movie'),
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
      computeScore: () => null,
      saveItem: (updatedItem) => saveMultiMediaItem('guide', updatedItem)
    },
    project: {
      id: 'project',
      label: 'Proje',
      dataFile: 'data/projects.json',
      countKey: 'projects',
      titleLabel: 'Proje / Depo Başlığı',
      externalUrlLabel: 'GitHub Depo Bağlantısı (URL)',
      externalUrlField: 'url',
      extraMetaField: { key: 'summary', label: 'Proje Kısa Özeti (Katalog Kartında Görünür)', placeholder: 'Projenin kısa tek cümlelik özeti...' },
      supportsNextBadge: false,
      supportsAnilistGraph: false,
      statusOptions: [
        ['completed', 'Aktif & Güncel'],
        ['watching', 'Geliştiriliyor'],
        ['planned', 'Planlandı / Taslak']
      ],
      subItemHeading: 'Öne Çıkan Özellikler & Modüller',
      subItemWeights: { season: 1.0, movie: 0.5, other: 0.2 },
      subItemUnitLabel: 'özellik',
      categoryGroups: [
        { label: 'Proje Teknolojileri & Kategoriler', items: ['NixOS', 'Quickshell', 'Wayland', 'Niri', 'Dotfiles', 'Fork', 'Sistem', 'Masaüstü & Kabuk', 'Rust', 'Linux'] }
      ],
      getItems: () => ensureMultiMediaStore('project').items,
      getCustomCatalog: () => ensureMultiMediaStore('project').customGenreCatalog,
      addCustomCategory: (cat) => addMultiMediaCategory('project', cat),
      computeScore: () => null,
      saveItem: (updatedItem) => saveMultiMediaItem('project', updatedItem)
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
    if (typeId === 'guide' || typeId === 'project') {
      delete updatedItem.score;
      delete updatedItem.parts;
      delete updatedItem.anilistId;
      delete updatedItem.firstSeasonUrl;
      delete updatedItem.lockedFields;
    } else {
      updatedItem.score = resolveEffectiveScore(updatedItem);
    }
    updatedItem.adminModified = true;
    if (idx >= 0) store.items[idx] = updatedItem;
    else store.items.unshift(updatedItem);
    store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, typeId);
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
    const acpDirtyVal = $('#acpSysDirtyVal');
    if (acpDirtyVal) {
      acpDirtyVal.textContent = anyDirty ? 'Kaydedilmemiş Değişiklikler Var' : 'Değişiklik Yok';
      acpDirtyVal.className = anyDirty ? 'stat-v err' : 'stat-v ok';
    }
    renderAcpNotices();
  }

  // ============================================================================
  // [ADIM 4 & 5: COMMIT ÖNCESİ DEĞİŞİKLİK İNCELEME (DIFF) & AKILLI YÖNETİCİ BİLDİRİMLERİ]
  // ============================================================================

  function captureInitialSnapshots() {
    state.initialSnapshots = {
      config: JSON.parse(JSON.stringify(state.config || {})),
      anime: (state.animeData?.anime || []).map(a => ({
        id: a.id,
        title: a.title,
        score: a.score,
        status: a.status,
        image: a.image,
        customGenres: Array.isArray(a.customGenres) ? [...a.customGenres] : []
      })),
      overrides: JSON.parse(JSON.stringify(state.overrides || {})),
      multi: {}
    };
    for (const mKey of ['series', 'movie', 'manga', 'book', 'guide', 'project']) {
      const items = state.multiMediaStore[mKey]?.items || [];
      state.initialSnapshots.multi[mKey] = items.map(it => ({
        id: it.id,
        title: it.title,
        score: it.score,
        status: it.status,
        image: it.image,
        customGenres: Array.isArray(it.customGenres) ? [...it.customGenres] : []
      }));
    }
  }

  function logSessionChange(entry) {
    if (!entry) return;
    state.sessionChangesLog.push({
      timestamp: Date.now(),
      ...entry
    });
  }

  function computeDetailedDiff() {
    const groups = [];

    // 1. data/sections.json
    if (state.dirtyConfig) {
      const configChanges = [];
      const initCfg = state.initialSnapshots?.config || {};
      const currCfg = state.config || {};

      if (JSON.stringify(initCfg.hero) !== JSON.stringify(currCfg.hero)) {
        configChanges.push({ type: 'update', title: 'Ana Başlık & Karşılama (Hero)', detail: 'Giriş metinleri ve butonlar güncellendi', badge: '~ Güncellenen', badgeClass: 'diff-mod' });
      }
      if (JSON.stringify(initCfg.about) !== JSON.stringify(currCfg.about)) {
        configChanges.push({ type: 'update', title: 'Hakkında & Profil Biyografisi', detail: 'Profil metni veya rozetler güncellendi', badge: '~ Güncellenen', badgeClass: 'diff-mod' });
      }
      if (JSON.stringify(initCfg.countdown) !== JSON.stringify(currCfg.countdown) || JSON.stringify(initCfg.gift) !== JSON.stringify(currCfg.gift)) {
        configChanges.push({ type: 'update', title: 'Geri Sayım & Hediye Ayarları', detail: 'Etkinlik ve sayaç yapılandırması güncellendi', badge: '~ Güncellenen', badgeClass: 'diff-mod' });
      }

      const initSecs = initCfg.sections || [];
      const currSecs = currCfg.sections || [];
      for (const cs of currSecs) {
        const is = initSecs.find(s => s.id === cs.id);
        if (is && (is.status !== cs.status || is.title !== cs.title)) {
          configChanges.push({
            type: 'update',
            title: `Kategori: ${cs.title || cs.id}`,
            detail: `Yayın Durumu: ${is.status} ➔ ${cs.status}`,
            badge: '~ Güncellenen',
            badgeClass: 'diff-mod'
          });
        }
      }

      if (currCfg.pages && initCfg.pages) {
        for (const [pKey, pVal] of Object.entries(currCfg.pages)) {
          if (JSON.stringify(pVal) !== JSON.stringify(initCfg.pages[pKey])) {
            configChanges.push({
              type: 'update',
              title: `Kategori Sayfa Metni: ${pKey.toUpperCase()}`,
              detail: 'Başlık, açıklama veya alt metinler güncellendi',
              badge: '~ Güncellenen',
              badgeClass: 'diff-mod'
            });
          }
        }
      }

      if (configChanges.length === 0) {
        configChanges.push({ type: 'update', title: 'Site Yapılandırması', detail: 'Genel site ayarları güncellendi', badge: '~ Güncellenen', badgeClass: 'diff-mod' });
      }

      groups.push({
        file: 'data/sections.json',
        label: 'Site Yapılandırması & Metinleri',
        changes: configChanges
      });
    }

    // 2. data/anime.json
    if (state.dirtyAnime) {
      const animeChanges = [];
      const initAnimeMap = new Map((state.initialSnapshots?.anime || []).map(a => [a.id, a]));
      const currAnimeMap = new Map((state.animeData?.anime || []).map(a => [a.id, a]));

      for (const [id, curr] of currAnimeMap.entries()) {
        const init = initAnimeMap.get(id);
        if (!init) {
          animeChanges.push({
            type: 'add',
            title: curr.title || 'Yeni Anime',
            detail: `Yeni içerik · Puan: ${curr.score != null ? curr.score : 'Puansız'} · ${curr.status || 'Durum belirtilmedi'}`,
            badge: '+ Yeni Eklenen',
            badgeClass: 'diff-add'
          });
        } else {
          const scoreChanged = init.score !== curr.score;
          const statusChanged = init.status !== curr.status;
          const imageChanged = init.image !== curr.image;
          const titleChanged = init.title !== curr.title;
          if (scoreChanged || statusChanged || imageChanged || titleChanged || curr.adminModified) {
            const detailParts = [];
            if (scoreChanged) detailParts.push(`Puan: ${init.score ?? 'Yok'} ➔ ${curr.score ?? 'Yok'}`);
            if (statusChanged) detailParts.push(`Durum: ${init.status ?? 'Yok'} ➔ ${curr.status ?? 'Yok'}`);
            if (imageChanged) detailParts.push('Kapak görseli güncellendi');
            if (titleChanged) detailParts.push(`Başlık: ${init.title} ➔ ${curr.title}`);
            if (!detailParts.length) detailParts.push('İçerik/parça verileri güncellendi');
            animeChanges.push({
              type: 'update',
              title: curr.title || 'Anime',
              detail: detailParts.join(' · '),
              badge: '~ Güncellenen',
              badgeClass: 'diff-mod'
            });
          }
        }
      }

      for (const [id, init] of initAnimeMap.entries()) {
        if (!currAnimeMap.has(id)) {
          animeChanges.push({
            type: 'delete',
            title: init.title || 'Anime',
            detail: 'Listeden silindi',
            badge: '🗑️ Silinen',
            badgeClass: 'diff-del'
          });
        }
      }

      if (animeChanges.length === 0) {
        animeChanges.push({
          type: 'update',
          title: 'Anime Kataloğu',
          detail: 'İstatistikler veya puanlar güncellendi',
          badge: '~ Güncellenen',
          badgeClass: 'diff-mod'
        });
      }

      groups.push({
        file: 'data/anime.json',
        label: `Anime Kataloğu (${animeChanges.length} işlem)`,
        changes: animeChanges
      });
    }

    // 3. Çoklu Medya Verileri (series, movie, manga, book, guide)
    for (const [mKey, store] of Object.entries(state.multiMediaStore || {})) {
      if (store && store.dirty) {
        const adapter = CONTENT_ADAPTER_REGISTRY[mKey];
        if (!adapter) continue;
        const mediaChanges = [];
        const initItemsMap = new Map((state.initialSnapshots?.multi?.[mKey] || []).map(it => [it.id, it]));
        const currItemsMap = new Map((store.items || []).map(it => [it.id, it]));

        for (const [id, curr] of currItemsMap.entries()) {
          const init = initItemsMap.get(id);
          if (!init) {
            mediaChanges.push({
              type: 'add',
              title: curr.title || `Yeni ${adapter.label}`,
              detail: `Yeni kayıt · Puan: ${curr.score != null ? curr.score : 'Puansız'}`,
              badge: '+ Yeni Eklenen',
              badgeClass: 'diff-add'
            });
          } else {
            const scoreChanged = init.score !== curr.score;
            const statusChanged = init.status !== curr.status;
            const imageChanged = init.image !== curr.image;
            const titleChanged = init.title !== curr.title;
            if (scoreChanged || statusChanged || imageChanged || titleChanged || curr.adminModified) {
              const detailParts = [];
              if (scoreChanged) detailParts.push(`Puan: ${init.score ?? 'Yok'} ➔ ${curr.score ?? 'Yok'}`);
              if (statusChanged) detailParts.push(`Durum: ${init.status ?? 'Yok'} ➔ ${curr.status ?? 'Yok'}`);
              if (imageChanged) detailParts.push('Kapak görseli güncellendi');
              if (titleChanged) detailParts.push(`Başlık: ${init.title} ➔ ${curr.title}`);
              if (!detailParts.length) detailParts.push('Detaylar güncellendi');
              mediaChanges.push({
                type: 'update',
                title: curr.title || adapter.label,
                detail: detailParts.join(' · '),
                badge: '~ Güncellenen',
                badgeClass: 'diff-mod'
              });
            }
          }
        }

        for (const [id, init] of initItemsMap.entries()) {
          if (!currItemsMap.has(id)) {
            mediaChanges.push({
              type: 'delete',
              title: init.title || adapter.label,
              detail: 'Listeden silindi',
              badge: '🗑️ Silinen',
              badgeClass: 'diff-del'
            });
          }
        }

        if (mediaChanges.length === 0) {
          mediaChanges.push({
            type: 'update',
            title: `${adapter.label} Kataloğu`,
            detail: 'Veriler güncellendi',
            badge: '~ Güncellenen',
            badgeClass: 'diff-mod'
          });
        }

        groups.push({
          file: adapter.dataFile,
          label: `${adapter.label} Kataloğu (${mediaChanges.length} işlem)`,
          changes: mediaChanges
        });
      }
    }

    // 4. overrides.json
    if (state.dirtyOverrides) {
      groups.push({
        file: 'data/overrides.json',
        label: 'Senkronizasyon Kuralları',
        changes: [
          { type: 'update', title: 'overrides.json', detail: 'Hariç tutulanlar, başlık eşleşmeleri veya birleştirmeler güncellendi', badge: '~ Güncellenen', badgeClass: 'diff-mod' }
        ]
      });
    }

    // 5. Yüklenen Görseller (pendingUploads)
    if (state.pendingUploads.size > 0) {
      const uploadChanges = [];
      for (const [targetPath, info] of state.pendingUploads.entries()) {
        uploadChanges.push({
          type: 'add',
          title: targetPath,
          detail: `Yeni görsel dosyası (${Math.round((info.bytes?.length || 0) / 1024)} KB)`,
          badge: '+ Yeni Görsel',
          badgeClass: 'diff-add'
        });
      }
      groups.push({
        file: 'assets/img/...',
        label: `Yüklenen Yeni Görseller (${state.pendingUploads.size})`,
        changes: uploadChanges
      });
    }

    return groups;
  }

  function generateCommitMessage(diffGroups) {
    const fileNames = diffGroups.map(g => g.file);
    const hasConfig = fileNames.includes('data/sections.json');
    const hasAnime = fileNames.includes('data/anime.json');
    const hasUploads = diffGroups.some(g => g.file.startsWith('assets/'));

    const parts = [];
    if (hasAnime) parts.push('anime');
    if (fileNames.includes('data/series.json')) parts.push('dizi');
    if (fileNames.includes('data/movies.json')) parts.push('film');
    if (fileNames.includes('data/manga.json')) parts.push('manga');
    if (fileNames.includes('data/books.json')) parts.push('kitap');
    if (fileNames.includes('data/guides.json')) parts.push('rehber');
    if (fileNames.includes('data/projects.json')) parts.push('proje');
    if (hasConfig) parts.push('site ayarları');
    if (hasUploads) parts.push('yeni görseller');

    if (parts.length === 0) return 'feat(content): içerik ve site verileri güncellendi';
    if (parts.length === 1) return `feat(${parts[0]}): ${parts[0]} verileri güncellendi`;
    return `feat(content): ${parts.join(', ')} güncellendi`;
  }

  function getGlobalMissingDataStats() {
    let missingCoverCount = 0;
    let missingScoreCount = 0;
    const missingItems = [];
    const types = ['anime', 'series', 'movie', 'manga', 'book'];
    for (const t of types) {
      const adapter = CONTENT_ADAPTER_REGISTRY[t];
      if (!adapter) continue;
      const items = adapter.getItems() || [];
      for (const it of items) {
        let isMissing = false;
        if (!it.image) {
          missingCoverCount++;
          isMissing = true;
        }
        const effScore = adapter.computeScore(it);
        if (effScore == null && (it.status === 'completed' || it.status === 'watching')) {
          missingScoreCount++;
          isMissing = true;
        }
        if (isMissing) {
          missingItems.push({ ...it, mediaType: t });
        }
      }
    }
    return {
      missingCoverCount,
      missingScoreCount,
      totalMissing: missingItems.length,
      uniqueMissingItems: missingItems
    };
  }

  function renderAcpNotices() {
    const container = $('#acpNoticesContainer');
    if (!container) return;
    container.replaceChildren();

    const anyMultiDirty = Object.values(state.multiMediaStore || {}).some(s => s && s.dirty);
    const anyDirty = state.dirtyConfig || state.dirtyAnime || state.dirtyOverrides || anyMultiDirty || state.pendingUploads.size > 0;
    const hasPreview = Boolean(
      localStorage.getItem('tp_site_preview') ||
      localStorage.getItem('tp_anime_preview') ||
      localStorage.getItem('tp_multimedia_preview')
    );
    const missingStats = getGlobalMissingDataStats();

    // A) Kaydedilmemiş Değişiklik Bildirimi (Amber)
    if (anyDirty && !state.dismissedNotices.has('uncommitted_changes')) {
      const noticeA = document.createElement('div');
      noticeA.className = 'acp-notice acp-notice-amber';
      noticeA.innerHTML = `
        <div class="acp-notice-left">
          <span class="acp-notice-icon">💾</span>
          <span class="acp-notice-text"><b>Dikkat:</b> Oturumda kaydedilmemiş değişiklikler var. Değişiklikler tarayıcı önbelleğinde duruyor.</span>
        </div>
        <div class="acp-notice-actions">
          <button type="button" class="btn-subtle acp-notice-btn" id="noticePreviewBtn">Canlı Önizlemeye Uygula</button>
          <button type="button" class="btn-primary acp-notice-btn" id="noticeCommitBtn">🚀 Değişiklikleri İncele &amp; Kaydet</button>
          <button type="button" class="acp-notice-dismiss" aria-label="Bildirimi Gizle" title="Bu bildirimi bu oturum için gizle">✕</button>
        </div>
      `;
      noticeA.querySelector('#noticePreviewBtn').onclick = () => $('#previewApplyBtn')?.click();
      noticeA.querySelector('#noticeCommitBtn').onclick = () => $('#commitGithubBtn')?.click();
      noticeA.querySelector('.acp-notice-dismiss').onclick = () => {
        state.dismissedNotices.add('uncommitted_changes');
        renderAcpNotices();
      };
      container.appendChild(noticeA);
    }

    // B) Canlı Önizleme Aktif Bildirimi (Sapphire)
    if (hasPreview && !state.dismissedNotices.has('preview_active')) {
      const noticeB = document.createElement('div');
      noticeB.className = 'acp-notice acp-notice-sapphire';
      noticeB.innerHTML = `
        <div class="acp-notice-left">
          <span class="acp-notice-icon">👁️</span>
          <span class="acp-notice-text"><b>Canlı Önizleme Aktif:</b> Ziyaretçiler henüz bu değişiklikleri görmüyor. Canlı sitede yayınlamak için GitHub'a commit gönderebilirsiniz.</span>
        </div>
        <div class="acp-notice-actions">
          <button type="button" class="btn-subtle acp-notice-btn" id="noticeClearPreviewBtn">Önizlemeyi Sıfırla</button>
          <button type="button" class="acp-notice-dismiss" aria-label="Bildirimi Gizle" title="Bu bildirimi bu oturum için gizle">✕</button>
        </div>
      `;
      noticeB.querySelector('#noticeClearPreviewBtn').onclick = () => $('#clearPreviewBtn')?.click();
      noticeB.querySelector('.acp-notice-dismiss').onclick = () => {
        state.dismissedNotices.add('preview_active');
        renderAcpNotices();
      };
      container.appendChild(noticeB);
    }

    // C) Kritik Veri Eksikliği Bildirimi (Rose)
    if (missingStats.totalMissing > 0 && !state.dismissedNotices.has('missing_data')) {
      const noticeC = document.createElement('div');
      noticeC.className = 'acp-notice acp-notice-rose';
      noticeC.innerHTML = `
        <div class="acp-notice-left">
          <span class="acp-notice-icon">⚠️</span>
          <span class="acp-notice-text"><b>Veri Eksikliği:</b> <b>${missingStats.totalMissing}</b> içerikte kapak görseli veya puan eksik.</span>
        </div>
        <div class="acp-notice-actions">
          <button type="button" class="btn-danger-soft acp-notice-btn" id="noticeFixMissingBtn">⚡ Hızlı Sıralı'da Düzelt</button>
          <button type="button" class="acp-notice-dismiss" aria-label="Bildirimi Gizle" title="Bu bildirimi bu oturum için gizle">✕</button>
        </div>
      `;
      noticeC.querySelector('#noticeFixMissingBtn').onclick = () => {
        const first = missingStats.uniqueMissingItems[0];
        const targetType = (first && first.mediaType) || 'anime';
        state.rapidQueue.activeType = targetType;
        const matchingIds = missingStats.uniqueMissingItems.filter(it => it.mediaType === targetType).map(it => it.id);
        state.rapidQueue.customTargetIds = matchingIds;
        state.rapidQueue.filterMode = 'health_custom';
        switchAdminPanel('rapid', { rebuildQueue: true });
      };
      noticeC.querySelector('.acp-notice-dismiss').onclick = () => {
        state.dismissedNotices.add('missing_data');
        renderAcpNotices();
      };
      container.appendChild(noticeC);
    }
  }

  function openCommitDiffModal() {
    const diffGroups = computeDetailedDiff();
    const modal = $('#commitDiffModal');
    if (!modal) return;

    const totalChanges = diffGroups.reduce((acc, g) => acc + g.changes.length, 0);
    const countBadge = $('#commitDiffTotalBadge');
    if (countBadge) countBadge.textContent = `${totalChanges} Değişiklik`;

    const msgInput = $('#commitMsgInput');
    if (msgInput) {
      msgInput.value = generateCommitMessage(diffGroups);
    }

    const list = $('#commitDiffList');
    if (list) {
      list.replaceChildren();
      for (const grp of diffGroups) {
        const groupEl = document.createElement('div');
        groupEl.className = 'commit-diff-group';
        groupEl.innerHTML = `
          <div class="commit-diff-group-head">
            <span class="commit-diff-file-tag">${grp.file}</span>
            <span class="commit-diff-group-title">${grp.label}</span>
            <span class="commit-diff-group-count">${grp.changes.length} değişiklik</span>
          </div>
          <div class="commit-diff-group-items"></div>
        `;
        const itemsBox = groupEl.querySelector('.commit-diff-group-items');
        for (const ch of grp.changes) {
          const row = document.createElement('div');
          row.className = 'commit-diff-row';
          row.innerHTML = `
            <span class="commit-diff-badge ${ch.badgeClass}">${ch.badge}</span>
            <span class="commit-diff-item-title">${AdminSecurity.sanitizeText(ch.title, 120)}</span>
            <span class="commit-diff-item-detail">${AdminSecurity.sanitizeText(ch.detail, 160)}</span>
          `;
          itemsBox.appendChild(row);
        }
        list.appendChild(groupEl);
      }
    }

    const progWrap = $('#commitProgressWrap');
    if (progWrap) progWrap.hidden = true;
    const confirmBtn = $('#confirmCommitDiffBtn');
    if (confirmBtn) confirmBtn.disabled = false;
    const cancelBtn = $('#cancelCommitDiffBtn');
    if (cancelBtn) cancelBtn.disabled = false;

    modal.hidden = false;
    if (msgInput) msgInput.focus();
  }

  async function executeCommitProcess() {
    const sess = AdminSecurity.getSessionInfo();
    if (!sess || !sess.hasToken) {
      toast('GitHub\'a kaydetmek için GitHub Fine-Grained Token (PAT) gereklidir.', 'warn');
      return;
    }

    const confirmBtn = $('#confirmCommitDiffBtn');
    const cancelBtn = $('#cancelCommitDiffBtn');
    const progWrap = $('#commitProgressWrap');
    const progBar = $('#commitProgressBar');
    const progStatus = $('#commitProgressStatus');

    if (confirmBtn) confirmBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (progWrap) progWrap.hidden = false;

    const customCommitMsg = ($('#commitMsgInput')?.value || '').trim() || 'feat(content): içerik ve site verileri güncellendi';

    try {
      // 1. Görseller
      if (state.pendingUploads.size > 0) {
        if (progStatus) progStatus.textContent = `Görseller yükleniyor (0/${state.pendingUploads.size})...`;
        if (progBar) progBar.style.width = '15%';
        let upIdx = 0;
        for (const [targetPath, info] of state.pendingUploads.entries()) {
          upIdx++;
          if (progStatus) progStatus.textContent = `Görsel yükleniyor (${upIdx}/${state.pendingUploads.size}): ${targetPath}...`;
          await AdminSecurity.githubPutFile(targetPath, info.bytes, `Görsel yüklendi: ${targetPath}`, true);
        }
        state.pendingUploads.clear();
        renderPendingUploadsList();
      }

      // 2. data/sections.json
      const anyMultiDirty = Object.values(state.multiMediaStore || {}).some(s => s && s.dirty);
      if (state.dirtyConfig || (!state.dirtyAnime && !state.dirtyOverrides && !anyMultiDirty)) {
        if (progStatus) progStatus.textContent = 'Site ayarları (data/sections.json) kaydediliyor...';
        if (progBar) progBar.style.width = '35%';
        await AdminSecurity.githubPutFile('data/sections.json', JSON.stringify(state.config, null, 2) + '\n', `${customCommitMsg} [sections.json]`, false);
        state.dirtyConfig = false;
      }

      // 3. data/overrides.json
      if (state.dirtyOverrides) {
        if (progStatus) progStatus.textContent = 'Senkron kuralları (data/overrides.json) kaydediliyor...';
        if (progBar) progBar.style.width = '55%';
        await AdminSecurity.githubPutFile('data/overrides.json', JSON.stringify(state.overrides, null, 2) + '\n', `${customCommitMsg} [overrides.json]`, false);
        state.dirtyOverrides = false;
      }

      // 4. data/anime.json
      if (state.dirtyAnime) {
        if (progStatus) progStatus.textContent = 'Anime kataloğu (data/anime.json) kaydediliyor...';
        if (progBar) progBar.style.width = '75%';
        state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
        state.animeData.updated = new Date().toISOString().slice(0, 10);
        await AdminSecurity.githubPutFile('data/anime.json', JSON.stringify(state.animeData, null, 2) + '\n', `${customCommitMsg} [anime.json]`, false);
        state.dirtyAnime = false;
      }

      // 5. Çoklu Medya Verileri
      for (const [mKey, store] of Object.entries(state.multiMediaStore || {})) {
        if (store && store.dirty) {
          const adapter = CONTENT_ADAPTER_REGISTRY[mKey];
          if (adapter && adapter.dataFile) {
            if (progStatus) progStatus.textContent = `${adapter.label} kataloğu (${adapter.dataFile}) kaydediliyor...`;
            if (progBar) progBar.style.width = '88%';
            const payload = {
              schemaVersion: 3,
              updated: new Date().toISOString().slice(0, 10),
              source: 'site-first:' + mKey,
              customGenreCatalog: store.customGenreCatalog || [],
              stats: computeMediaStatsClient(store.items || [], state.animeData.statsConfig, mKey),
              items: cleanMediaItemsForSave(store.items || [], mKey)
            };
            await AdminSecurity.githubPutFile(adapter.dataFile, JSON.stringify(payload, null, 2) + '\n', `${customCommitMsg} [${adapter.dataFile}]`, false);
            store.dirty = false;
          }
        }
      }

      if (progBar) progBar.style.width = '100%';
      if (progStatus) progStatus.textContent = 'Değişiklikler başarıyla kaydedildi!';

      localStorage.removeItem('tp_site_preview');
      localStorage.removeItem('tp_anime_preview');
      localStorage.removeItem('tp_multimedia_preview');
      localStorage.removeItem('ui2');
      const clrBtn = $('#clearPreviewBtn');
      if (clrBtn) clrBtn.hidden = true;

      captureInitialSnapshots();
      state.sessionChangesLog = [];
      updateDirtyIndicator();

      setTimeout(() => {
        const modal = $('#commitDiffModal');
        if (modal) modal.hidden = true;
        toast('Değişiklikler GitHub deposuna başarıyla kaydedildi!');
      }, 450);
    } catch (err) {
      toast(err.message, 'err');
      if (progStatus) progStatus.textContent = 'Hata: ' + err.message;
      if (confirmBtn) confirmBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
    }
  }

  function handleCommitClick() {
    collectFormFieldsIntoConfig();
    const anyMultiDirty = Object.values(state.multiMediaStore || {}).some(s => s && s.dirty);
    const anyDirty = state.dirtyConfig || state.dirtyAnime || state.dirtyOverrides || anyMultiDirty || state.pendingUploads.size > 0;

    if (!anyDirty) {
      toast('Kaydedilecek herhangi bir değişiklik bulunmuyor.');
      return;
    }

    const sess = AdminSecurity.getSessionInfo();
    if (!sess || !sess.hasToken) {
      toast('GitHub\'a doğrudan kaydetmek için "Profil & Güvenlik" sekmesinden GitHub Fine-Grained Token (PAT) ekleyin.', 'warn');
      return;
    }

    openCommitDiffModal();
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
      if (filterMode === 'no_subscores') {
        const hasSub = (it.subScores && Object.keys(it.subScores).length > 0) ||
          (Array.isArray(it.parts) && it.parts.some(p => p.subScores && Object.keys(p.subScores).length > 0));
        return !hasSub;
      }
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
    const rqPosterWrap = $('#rqPosterImg')?.closest('.rq-poster');
    if (rqPosterWrap) rqPosterWrap.hidden = adapter.id === 'guide';
    if ($('#rqOpenCoverPickerBtn')) $('#rqOpenCoverPickerBtn').hidden = adapter.id === 'guide';
    if ($('#rqCoverPickerWrap')) {
      $('#rqCoverPickerWrap').hidden = true;
      $('#rqCoverPickerWrap').replaceChildren();
    }
    state.rqCoverCandidates = [];
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
    const hasMultiplePartsRq = Array.isArray(d.parts) && d.parts.length > 1;
    const rqTitle = hasMultiplePartsRq ? 'Genel Yapım Puanlama Stüdyosu (Opsiyonel)' : '5 Yıldızlı Ağırlıklı Puanlama Stüdyosu';
    const rqSub = hasMultiplePartsRq
      ? 'Aşağıdaki parçaları sezon sezon ayrı ayrı 5 yıldızla puanlayabilirsiniz. Genel puan tüm sezonların ağırlıklı ortalamasından otomatik hesaplanır.'
      : 'Kriterlere 1–5 yıldız verin; sistem ağırlıklarına göre 10 üzerinden virgüllü puanı otomatik hesaplar.';

    renderCriteriaRatingStudio($('#rqCriteriaStudioMount'), d, adapter.id, () => {
      syncRapidQueueScoreBadge();
    }, rqTitle, rqSub);
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
          <input type="number" class="inp glass rq-part-score-inp" min="0" max="10" step="0.1" placeholder="Puan" style="width:70px;height:34px;padding:0 6px;text-align:center;font-weight:650">
          <button type="button" class="part-criteria-btn btn-subtle btn-xs rq-crit-btn" title="5 Yıldızlı Kriterlerle Puanla"></button>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="meta rq-part-ep-lbl">${p.watched || 0}/${p.episodes || 0} ${adapter.subItemUnitLabel}</span>
          <button type="button" class="quick-ep-btn rq-part-plus-btn">+1</button>
          <button type="button" class="quick-ep-btn done rq-part-done-btn">Bitir</button>
        </div>
      `;

      const critMount = document.createElement('div');
      critMount.className = 'rq-part-criteria-mount';
      critMount.style.display = 'none';
      critMount.style.width = '100%';

      const scWrap = row.querySelector('.rq-subitem-scores');
      const scInp = row.querySelector('.rq-part-score-inp');
      const critBtn = row.querySelector('.rq-crit-btn');
      scInp.value = p.score != null ? p.score : '';

      const syncRqCritBtn = () => {
        if (!critBtn) return;
        const subCount = p.subScores ? Object.values(p.subScores).filter(v => v != null && v > 0).length : 0;
        if (subCount > 0) {
          critBtn.textContent = `★ (${subCount}/6)`;
          critBtn.classList.add('has-score');
        } else {
          critBtn.textContent = '☆ Kriter';
          critBtn.classList.remove('has-score');
        }
      };
      syncRqCritBtn();

      if (critBtn) {
        critBtn.onclick = () => {
          const isOpening = critMount.style.display === 'none';
          critMount.style.display = isOpening ? 'block' : 'none';
          critBtn.classList.toggle('active', isOpening);
          if (isOpening) {
            renderCriteriaRatingStudio(
              critMount,
              p,
              adapter.id,
              (newSc) => {
                p.score = newSc;
                p.adminModified = true;
                scInp.value = newSc != null ? newSc : '';
                syncRqCritBtn();
                syncRapidQueueScoreBadge();
              },
              `#${idx + 1} ${AdminSecurity.sanitizeText(p.name || 'Parça', 40)} · Kriter Puanlaması`,
              'Kriterlere 1–5 yıldız verin; sezonun puanı ve genel yapım puanı otomatik güncellenir.'
            );
            setTimeout(() => {
              critMount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 60);
          }
        };
      }

      for (const sc of [7, 8, 8.5, 9, 9.5, 10]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rq-mini-sc' + (Number(p.score) === sc ? ' on' : '');
        b.textContent = String(sc);
        b.onclick = () => {
          p.score = sc;
          p.adminModified = true;
          scInp.value = sc;
          syncRqCritBtn();
          renderRapidQueueSubItems();
          syncRapidQueueScoreBadge();
        };
        scWrap.append(b);
      }

      scInp.oninput = () => {
        const val = scInp.value.trim() === '' ? null : Math.min(10, Math.max(0, Math.round(Number(scInp.value) * 10) / 10));
        p.score = isNaN(val) ? null : val;
        p.adminModified = true;
        syncRqCritBtn();
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
      listEl.append(critMount);
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
    if (adapter.id === 'anime' || adapter.id === 'manga') {
      const parsed = parseAnilistUrlOrId(rawUrl || d.anilistId || d.id, adapter.id);
      if (parsed.id) {
        d.anilistId = parsed.id;
        d.url = parsed.url;
        d.firstSeasonUrl = U(rawUrl, false) || parsed.url;
      } else {
        const cleanU = U(rawUrl, true);
        d.url = cleanU;
        d.firstSeasonUrl = cleanU;
      }
    } else if (adapter.externalUrlField) {
      const cleanU = U(rawUrl, true);
      d[adapter.externalUrlField] = cleanU;
      d.url = cleanU;
      if (adapter.id === 'guide') {
        const tpMatch = cleanU.match(/\/sosyal\/konu\/[^/?#]*\.(\d+)(?:\/|$)/i);
        if (tpMatch) d.threadId = Number(tpMatch[1]);
      }
    }

    if (adapter.extraMetaField) {
      const maxLen = adapter.id === 'guide' ? 500 : 160;
      d[adapter.extraMetaField.key] = S($('#rqExtraMetaInput').value, maxLen);
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
    logSessionChange({
      file: adapter.dataFile || 'data/anime.json',
      mediaType: adapter.id,
      action: 'update',
      title: d.title,
      detail: `Hızlı Sıralı'da güncellendi (Puan: ${d.score != null ? d.score : 'Puansız'})`
    });

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
            const mediaFileMap = {
              'data/projects.json': 'project',
              'data/guides.json': 'guide',
              'data/series.json': 'series',
              'data/movies.json': 'movie',
              'data/manga.json': 'manga',
              'data/books.json': 'book'
            };
            if (filePath === 'data/anime.json') {
              mergeHistoricalAnimeData(parsed, replaceAll);
              toast(`"${shortSha}" (${dateStr}) commit'indeki tüm kategori ve puanlar başarıyla kurtarıldı! Şimdi üstten "GitHub'a Kaydet" butonuna basabilirsiniz.`);
            } else if (mediaFileMap[filePath]) {
              const mType = mediaFileMap[filePath];
              const adapter = CONTENT_ADAPTER_REGISTRY[mType];
              const items = (parsed && (parsed.items || parsed[adapter.countKey])) || [];
              const store = ensureMultiMediaStore(mType);
              store.items = items;
              store.customGenreCatalog = Array.isArray(parsed && parsed.customGenreCatalog) ? parsed.customGenreCatalog : store.customGenreCatalog;
              store.stats = computeMediaStatsClient(items, state.animeData.statsConfig, mType);
              store.dirty = true;
              updateDirtyIndicator();
              renderAnimeAdminPanel();
              renderHealthAuditor();
              toast(`"${shortSha}" commit'indeki ${adapter.label} verileri (${items.length} kayıt) geri yüklendi!`);
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

    if (typeId === 'guide') {
      const missingSummary = items.filter(it => !it.summary || !String(it.summary).trim());
      return [
        {
          key: 'missing_genres',
          title: 'Özel Kategorisi Seçilmemiş Rehberler',
          desc: 'Henüz konu kategorisi (Linux & Sistem, Paket Yönetimi vb.) atanmamış rehberler.',
          items: missingGenres
        },
        {
          key: 'missing_summary',
          title: 'Kısa Özeti Eksik Rehberler',
          desc: 'Katalog kartında görünecek açıklama/özet metni boş olan rehberler.',
          items: missingSummary
        },
        {
          key: 'missing_url',
          title: 'Technopat Sosyal Linki Eksik Rehberler',
          desc: 'Technopat Sosyal konu bağlantısı girilmemiş rehberler.',
          items: missingUrl
        }
      ];
    }

    const cards = [
      {
        key: 'missing_genres',
        title: 'Özel Kategorisi Seçilmemiş Olanlar',
        desc: `Henüz özel tür/kategori atanmamış ${adapter.label.toLocaleLowerCase('tr')} kayıtları.`,
        items: missingGenres
      },
      {
        key: 'missing_score',
        title: 'Puanı Girilmemiş Olanlar',
        desc: 'Tamamlanmış veya devam ediyor olup henüz puan verilmemiş kayıtlar.',
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
        desc: 'Dış kaynak bağlantısı girilmemiş kayıtlar.',
        items: missingUrl
      }
    ];
    if (typeId === 'anime' || typeId === 'series') {
      cards.push({
        key: 'unwatched_sequels',
        title: 'İzlenmemiş Devam Sezonu Bulunanlar',
        desc: 'Yayınlanmış fakat henüz izlenmemiş sezonu bulunan yapımlar.',
        items: unwatchedSequels
      });
    }
    return cards;
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

    switchAdminPanel('rapid', { skipQueueInit: true });
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
        <div class="form-actions" style="margin:0;display:grid;gap:6px">
          ${grp.key === 'missing_cover' && cnt > 0 && typeId !== 'guide' ? `<button type="button" class="btn-primary health-autofetch-cover-btn" style="width:100%">🖼️ ${cnt} Kaydın Eksik Kapağını Otomatik Çek</button>` : ''}
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
      const autoCoverBtn = card.querySelector('.health-autofetch-cover-btn');
      if (autoCoverBtn) {
        autoCoverBtn.onclick = async () => {
          autoCoverBtn.disabled = true;
          let filled = 0;
          for (let i = 0; i < grp.items.length; i++) {
            const target = grp.items[i];
            autoCoverBtn.textContent = `⏳ Kapaklar Çekiliyor (${i + 1} / ${grp.items.length})...`;
            const q = target.firstSeasonUrl || target.url || target.imdbId || target.anilistId || target.title;
            if (!q) continue;
            try {
              const cands = await ExternalCatalogFetcher.fetchCoverCandidatesOnly(typeId, q);
              if (cands && cands.length > 0 && cands[0].url) {
                target.image = cands[0].url;
                target.adminModified = true;
                filled++;
              }
            } catch (_) {}
          }
          if (filled > 0) {
            if (typeId === 'anime') {
              state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
              markDirty('anime');
            } else {
              const store = ensureMultiMediaStore(typeId);
              store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, typeId);
              store.dirty = true;
              updateDirtyIndicator();
            }
            renderAnimeAdminPanel();
            renderHealthAuditor();
            toast(`✅ ${filled} kaydın kapak görseli otomatik çekildi ve eklendi!`);
          } else {
            autoCoverBtn.disabled = false;
            autoCoverBtn.textContent = `🖼️ ${cnt} Kaydın Eksik Kapağını Otomatik Çek`;
            toast('Eksik kapaklar için eşleşen görsel bulunamadı.', 'warn');
          }
        };
      }
      grid.append(card);
    }
  }

  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 15 — ARAÇLAR, BAKIM VE TEŞHİS MOTORU]
  // ============================================================================

  function rebuildAllScores() {
    const scoredMediaKeys = ['anime', 'series', 'movie', 'manga', 'book'];
    let totalUpdated = 0;
    let totalScanned = 0;

    for (const key of scoredMediaKeys) {
      const adapter = CONTENT_ADAPTER_REGISTRY[key];
      if (!adapter) continue;
      const items = adapter.getItems() || [];
      totalScanned += items.length;

      let sectionModified = false;
      for (const it of items) {
        if (!it) continue;
        const newScore = resolveEffectiveScore(it, key);
        if (newScore !== it.score) {
          it.score = newScore;
          it.adminModified = true;
          totalUpdated++;
          sectionModified = true;
        }
      }

      if (key === 'anime') {
        state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
        state.animeData.updated = new Date().toISOString().slice(0, 10);
        markDirty('anime');
      } else {
        const store = ensureMultiMediaStore(key);
        store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, key);
        store.dirty = true;
        updateDirtyIndicator();
      }
    }

    if (getActiveAdminAdapter()) {
      renderAnimeAdminPanel();
    }
    toast(`⚡ ${totalScanned} kayıt tarandı, ${totalUpdated} puan güncellendi ve tüm istatistikler baştan hesaplandı.`);
    return { totalScanned, totalUpdated };
  }

  function reindexAllCategories() {
    const allMediaKeys = ['anime', 'series', 'movie', 'manga', 'book', 'guide', 'project'];
    let totalUniqueGenres = 0;
    let totalUsageCount = 0;

    for (const key of allMediaKeys) {
      const adapter = CONTENT_ADAPTER_REGISTRY[key];
      if (!adapter) continue;
      const items = adapter.getItems() || [];
      const genreCounts = new Map();

      // Mevcut katalogdaki türleri başlangıçta 0 ile ekle
      const existingCatalog = adapter.getCustomCatalog() || [];
      for (const g of existingCatalog) {
        if (g && typeof g === 'string' && g.trim()) {
          genreCounts.set(g.trim(), 0);
        }
      }

      // Tüm kayıtlardaki customGenres ve categories alanlarını tara
      for (const it of items) {
        if (!it) continue;
        const genres = Array.isArray(it.customGenres) ? it.customGenres : (Array.isArray(it.categories) ? it.categories : []);
        for (const g of genres) {
          if (g && typeof g === 'string' && g.trim()) {
            const clean = g.trim();
            genreCounts.set(clean, (genreCounts.get(clean) || 0) + 1);
            totalUsageCount++;
          }
        }
      }

      // Dizinlenen katalog: kullanım sayısına ve alfabetik sıraya göre
      const sortedCatalog = [...genreCounts.keys()].sort((a, b) => {
        const diff = (genreCounts.get(b) || 0) - (genreCounts.get(a) || 0);
        return diff !== 0 ? diff : a.localeCompare(b, 'tr');
      });

      totalUniqueGenres += sortedCatalog.length;

      if (key === 'anime') {
        state.animeData.customGenreCatalog = sortedCatalog;
        state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
        markDirty('anime');
      } else {
        const store = ensureMultiMediaStore(key);
        store.customGenreCatalog = sortedCatalog;
        store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, key);
        store.dirty = true;
        updateDirtyIndicator();
      }
    }

    if (typeof renderTagManager === 'function') {
      renderTagManager();
    }
    toast(`🏷️ Tüm bölümlerdeki ${totalUniqueGenres} özel kategori dizinlendi ve sayaçlar güncellendi.`);
    return { totalUniqueGenres, totalUsageCount };
  }

  function rebuildAllSiteCaches() {
    rebuildAllScores();
    reindexAllCategories();
    renderAcpDashboard();
    renderHealthAuditor();
    toast('🚀 Tüm site önbelleği, ağırlıklı puanlar, kategori dizinleri ve pano metrikleri baştan derlendi!');
  }

  function testImageProbe(url, timeoutMs = 3000) {
    return new Promise((resolve) => {
      if (!url || typeof url !== 'string' || !url.trim()) {
        resolve({ ok: false, reason: 'Kapak görseli belirtilmemiş (Boş URL)' });
        return;
      }
      const trimmed = url.trim();
      const img = new Image();
      let timer = null;
      let finished = false;

      const finish = (ok, reason) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        img.src = '';
        resolve({ ok, reason });
      };

      timer = setTimeout(() => {
        finish(false, 'Zaman aşımı (3 sn)');
      }, timeoutMs);

      img.onload = () => finish(true, 'Yüklendi');
      img.onerror = () => finish(false, 'Yüklenemedi (404 veya Bağlantı Hatası)');
      img.referrerPolicy = 'no-referrer';
      img.src = trimmed;
    });
  }

  async function runImageDiagnostics() {
    const startBtn = $('#startDiagBtn');
    const secSelect = $('#diagSectionSelect');
    const resultsArea = $('#diagResultsArea');
    if (!startBtn || !resultsArea) return;

    const chosenSec = secSelect ? secSelect.value : 'all';
    const targetKeys = chosenSec === 'all' ? ['anime', 'series', 'movie', 'manga', 'book', 'guide', 'project'] : [chosenSec];

    const candidates = [];
    for (const key of targetKeys) {
      const adapter = CONTENT_ADAPTER_REGISTRY[key];
      if (!adapter) continue;
      const items = adapter.getItems() || [];
      for (const it of items) {
        if (!it) continue;
        candidates.push({
          id: it.id,
          title: it.title || it.id,
          image: it.image || '',
          sectionKey: key,
          sectionLabel: adapter.label,
          rawItem: it
        });
      }
    }

    if (candidates.length === 0) {
      resultsArea.innerHTML = `<div class="status-banner ok" style="margin:0">Seçili bölümde taranacak kayıt bulunamadı.</div>`;
      return;
    }

    startBtn.disabled = true;
    if (secSelect) secSelect.disabled = true;

    resultsArea.innerHTML = `
      <div class="diag-progress-bar">
        <div class="diag-progress-inner" id="diagProgressFill" style="width:0%"></div>
      </div>
      <p class="help-txt" id="diagProgressTxt" style="margin:8px 0 0">🔍 Kapak görselleri test ediliyor (0 / ${candidates.length})...</p>
    `;

    const brokenList = [];
    let completed = 0;
    let index = 0;
    const concurrency = 6;

    const worker = async () => {
      while (index < candidates.length) {
        const i = index++;
        const cand = candidates[i];
        const res = await testImageProbe(cand.image, 3000);
        completed++;
        const pct = Math.round((completed / candidates.length) * 100);
        const fill = $('#diagProgressFill');
        if (fill) fill.style.width = pct + '%';
        const txt = $('#diagProgressTxt');
        if (txt) txt.textContent = `🔍 Kapak görselleri test ediliyor (${completed} / ${candidates.length}) — %${pct}`;

        if (!res.ok) {
          brokenList.push({ ...cand, reason: res.reason });
        }
      }
    };

    const pool = Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker());
    await Promise.all(pool);

    startBtn.disabled = false;
    if (secSelect) secSelect.disabled = false;

    if (brokenList.length === 0) {
      resultsArea.innerHTML = `
        <div class="status-banner ok" style="margin:0">
          ✅ Taranan ${candidates.length} kaydın tamamında kapak görselleri başarıyla yüklendi.
        </div>
      `;
      toast(`✅ Taranan ${candidates.length} kaydın tamamında kapak görselleri sorunsuz.`);
    } else {
      resultsArea.innerHTML = `
        <div class="status-banner warn" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <strong>⚠️ Kırık veya Erişilemeyen Kapak Görselleri Bulundu</strong>
            <p class="meta" style="margin:4px 0 0">Taranan ${candidates.length} kayıttan <b>${brokenList.length}</b> tanesinde görsel yükleme hatası tespit edildi.</p>
          </div>
          <button type="button" class="btn-secondary" id="sendAllBrokenToRapidBtn">⚡ Hepsini Hızlı Sıralı'ya Aktar (${brokenList.length})</button>
        </div>
        <div class="diag-broken-list" id="diagBrokenList"></div>
      `;

      const listEl = $('#diagBrokenList');
      brokenList.forEach(b => {
        const row = document.createElement('div');
        row.className = 'diag-broken-item';
        row.innerHTML = `
          <div class="diag-broken-main">
            <div class="diag-thumb-ph" aria-hidden="true">🖼️</div>
            <div class="diag-broken-meta">
              <div class="diag-broken-title-row">
                <strong>${AdminSecurity.sanitizeText(b.title, 80)}</strong>
                <span class="diag-badge-sec">${b.sectionLabel}</span>
                <span class="diag-reason-badge">${AdminSecurity.sanitizeText(b.reason, 60)}</span>
              </div>
              <code class="diag-url" title="${AdminSecurity.sanitizeText(b.image, 250)}">${AdminSecurity.sanitizeText(b.image || 'Kapak Görseli Yok', 80)}</code>
            </div>
          </div>
          <div class="diag-actions">
            <button type="button" class="btn-subtle diag-edit-btn" style="padding:5px 12px;font-size:.78rem">Kapağı Düzenle</button>
            <button type="button" class="btn-secondary diag-rapid-btn" style="padding:5px 12px;font-size:.78rem">⚡ Hızlı Sıralı'ya Aktar</button>
          </div>
        `;
        row.querySelector('.diag-edit-btn').onclick = () => {
          state.activeAdminMediaType = b.sectionKey;
          if ($('#admMediaTypeSelect')) $('#admMediaTypeSelect').value = b.sectionKey;
          renderAnimeAdminPanel();
          openAnimeEditor(b.id);
        };
        row.querySelector('.diag-rapid-btn').onclick = () => {
          sendHealthItemsToRapidQueue(b.sectionKey, [b.rawItem], 'Kırık Görsel Teşhisi');
        };
        listEl.appendChild(row);
      });

      const sendAllBtn = $('#sendAllBrokenToRapidBtn');
      if (sendAllBtn) {
        sendAllBtn.onclick = () => {
          const bySection = {};
          for (const b of brokenList) {
            if (!bySection[b.sectionKey]) bySection[b.sectionKey] = [];
            bySection[b.sectionKey].push(b.rawItem);
          }
          const keys = Object.keys(bySection);
          if (keys.length === 1) {
            sendHealthItemsToRapidQueue(keys[0], bySection[keys[0]], 'Kırık Görsel Teşhisi');
          } else if (keys.length > 1) {
            const targetKey = keys.includes(state.activeAdminMediaType) ? state.activeAdminMediaType : keys[0];
            sendHealthItemsToRapidQueue(targetKey, bySection[targetKey], 'Kırık Görsel Teşhisi');
            toast(`Öncelikli olarak "${CONTENT_ADAPTER_REGISTRY[targetKey].label}" bölümündeki ${bySection[targetKey].length} kırık kayıt Hızlı Düzenleme'ye aktarıldı.`);
          }
        };
      }
      toast(`⚠️ ${brokenList.length} kayıtta kırık görsel tespit edildi.`, 'warn');
    }
  }

  function getBatchMatchingItems(secKey, criteria) {
    const adapter = CONTENT_ADAPTER_REGISTRY[secKey];
    if (!adapter) return [];
    const items = adapter.getItems() || [];
    return items.filter(it => {
      if (!it) return false;
      if (criteria === 'all') return true;
      if (criteria === 'no_genre') {
        return !Array.isArray(it.customGenres) || it.customGenres.length === 0;
      }
      if (criteria === 'no_score') {
        if (secKey === 'guide') return false;
        const sc = adapter.computeScore(it);
        return sc == null || Number(sc) <= 0;
      }
      if (criteria === 'completed') {
        return it.status === 'completed';
      }
      return false;
    });
  }

  function updateBatchWizardUI() {
    const secSelect = $('#batchSectionSelect');
    const critSelect = $('#batchCriteriaSelect');
    const actionSelect = $('#batchActionSelect');
    if (!secSelect || !critSelect || !actionSelect) return;

    const secKey = secSelect.value || 'anime';
    const criteria = critSelect.value || 'all';
    const action = actionSelect.value || 'add_genre';
    const adapter = CONTENT_ADAPTER_REGISTRY[secKey] || CONTENT_ADAPTER_REGISTRY.anime;

    const statusSelect = $('#batchStatusSelect');
    if (statusSelect && statusSelect.dataset.lastSec !== secKey) {
      statusSelect.dataset.lastSec = secKey;
      statusSelect.replaceChildren();
      const opts = adapter.statusOptions || [];
      opts.forEach(([val, lbl]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = lbl;
        statusSelect.appendChild(opt);
      });
    }

    const genreWrap = $('#batchParamGenreWrap');
    const statusWrap = $('#batchParamStatusWrap');
    const recalcWrap = $('#batchParamRecalcWrap');
    if (genreWrap) genreWrap.hidden = (action !== 'add_genre');
    if (statusWrap) statusWrap.hidden = (action !== 'change_status');
    if (recalcWrap) recalcWrap.hidden = (action !== 'recalc_score');

    const matched = getBatchMatchingItems(secKey, criteria);
    const summary = $('#batchMatchSummary');
    if (summary) {
      summary.innerHTML = `<span>Hedef: <b>${matched.length}</b> kayıt eşleşti</span>`;
    }

    const applyBtn = $('#applyBatchBtn');
    if (applyBtn) {
      applyBtn.textContent = `⚡ Seçili Kriterdeki ${matched.length} Kayda Uygula`;
      applyBtn.disabled = (matched.length === 0);
    }
  }

  function applyBatchWizardAction() {
    const secSelect = $('#batchSectionSelect');
    const critSelect = $('#batchCriteriaSelect');
    const actionSelect = $('#batchActionSelect');
    if (!secSelect || !critSelect || !actionSelect) return;

    const secKey = secSelect.value || 'anime';
    const criteria = critSelect.value || 'all';
    const action = actionSelect.value || 'add_genre';
    const matched = getBatchMatchingItems(secKey, criteria);
    if (!matched.length) {
      toast('Seçili kritere uyan kayıt bulunamadı.', 'warn');
      return;
    }

    const adapter = CONTENT_ADAPTER_REGISTRY[secKey];
    let updatedCount = 0;

    if (action === 'add_genre') {
      const rawTag = ($('#batchGenreInput')?.value || '').trim();
      const tag = AdminSecurity.sanitizeText(rawTag, 40);
      if (!tag) {
        toast('Lütfen eklenecek özel tür adını girin.', 'warn');
        $('#batchGenreInput')?.focus();
        return;
      }
      for (const it of matched) {
        if (!Array.isArray(it.customGenres)) it.customGenres = [];
        if (!it.customGenres.includes(tag)) {
          it.customGenres.push(tag);
          if (secKey !== 'guide') {
            if (!Array.isArray(it.genres)) it.genres = [];
            if (!it.genres.includes(tag)) it.genres.push(tag);
          }
          it.adminModified = true;
          updatedCount++;
        }
      }
      adapter.addCustomCategory(tag);
    } else if (action === 'change_status') {
      const nextStatus = $('#batchStatusSelect')?.value || 'completed';
      for (const it of matched) {
        if (it.status !== nextStatus) {
          it.status = nextStatus;
          it.adminModified = true;
          updatedCount++;
        }
      }
    } else if (action === 'recalc_score') {
      if (secKey === 'guide') {
        toast('Rehber kataloğunda puanlama modeli bulunmamaktadır.', 'warn');
        return;
      }
      for (const it of matched) {
        const eff = resolveEffectiveScore(it, secKey);
        if (eff != null) {
          it.score = eff;
          it.adminModified = true;
          updatedCount++;
        }
      }
    }

    if (secKey === 'anime') {
      state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
      state.animeData.updated = new Date().toISOString().slice(0, 10);
      markDirty('anime');
    } else {
      const store = ensureMultiMediaStore(secKey);
      store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, secKey);
      store.dirty = true;
      updateDirtyIndicator();
    }

    const banner = $('#batchResultBanner');
    if (banner) {
      banner.hidden = false;
      banner.className = 'status-banner ok';
      banner.textContent = `✅ Seçili ${matched.length} kayıttan ${updatedCount} tanesine işlem başarıyla uygulandı!`;
    }

    updateBatchWizardUI();
    if (state.activeAdminMediaType === secKey) renderAnimeAdminPanel();
    renderHealthAuditor();
    toast(`${updatedCount} kayıt başarıyla güncellendi.`);
  }

  function initToolsAndMaintenanceModule() {
    if ($('#recalcAllScoresBtn')) $('#recalcAllScoresBtn').onclick = rebuildAllScores;
    if ($('#reindexCategoriesBtn')) $('#reindexCategoriesBtn').onclick = reindexAllCategories;
    if ($('#rebuildAllCachesBtn')) $('#rebuildAllCachesBtn').onclick = rebuildAllSiteCaches;
    if ($('#startDiagBtn')) $('#startDiagBtn').onclick = runImageDiagnostics;

    if ($('#batchSectionSelect')) $('#batchSectionSelect').onchange = updateBatchWizardUI;
    if ($('#batchCriteriaSelect')) $('#batchCriteriaSelect').onchange = updateBatchWizardUI;
    if ($('#batchActionSelect')) $('#batchActionSelect').onchange = updateBatchWizardUI;
    if ($('#applyBatchBtn')) $('#applyBatchBtn').onclick = applyBatchWizardAction;

    updateBatchWizardUI();
  }

  function exportFullBackupSnapshot() {
    collectFormFieldsIntoConfig();
    state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
    const bundles = {
      sections: state.config,
      anime: state.animeData,
      overrides: state.overrides
    };
    for (const mKey of ['series', 'movie', 'manga', 'book', 'guide', 'project']) {
      const store = ensureMultiMediaStore(mKey);
      bundles[mKey] = {
        schemaVersion: 3,
        updated: new Date().toISOString().slice(0, 10),
        source: 'site-first:' + mKey,
        customGenreCatalog: store.customGenreCatalog || [],
        stats: computeMediaStatsClient(store.items || [], state.animeData.statsConfig, mKey),
        items: cleanMediaItemsForSave(store.items || [], mKey)
      };
    }
    const snapshot = {
      snapshotVersion: 1,
      site: 'tempestian.com',
      exportedAt: new Date().toISOString(),
      counts: {
        anime: (state.animeData.anime || []).length,
        series: (bundles.series.items || []).length,
        movie: (bundles.movie.items || []).length,
        manga: (bundles.manga.items || []).length,
        book: (bundles.book.items || []).length,
        guide: (bundles.guide.items || []).length,
        project: (bundles.project.items || []).length
      },
      bundles
    };
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlobJson(snapshot, `tempestian-backup-${dateStr}.json`);
    toast('Tüm site verileri tek yedek paketinde indirildi!');
  }

  function copyActiveSectionJsonToClipboard() {
    try {
      const adapter = getActiveAdminAdapter();
      let dataToCopy = null;
      if (adapter.id === 'anime') {
        dataToCopy = state.animeData;
      } else {
        const store = ensureMultiMediaStore(adapter.id);
        dataToCopy = {
          schemaVersion: 3,
          updated: new Date().toISOString().slice(0, 10),
          source: 'site-first:' + adapter.id,
          customGenreCatalog: store.customGenreCatalog || [],
          stats: computeMediaStatsClient(store.items || [], state.animeData.statsConfig, adapter.id),
          items: cleanMediaItemsForSave(store.items || [], adapter.id)
        };
      }
      const jsonStr = JSON.stringify(dataToCopy, null, 2);
      const count = (dataToCopy.anime || dataToCopy.items || []).length;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr)
          .then(() => toast(`"${adapter.label || adapter.id}" verisi (${count} kayıt) panoya kopyalandı!`, 'ok'))
          .catch(() => {
            fallbackCopy(jsonStr);
            toast(`"${adapter.label || adapter.id}" verisi (${count} kayıt) panoya kopyalandı!`, 'ok');
          });
      } else {
        fallbackCopy(jsonStr);
        toast(`"${adapter.label || adapter.id}" verisi (${count} kayıt) panoya kopyalandı!`, 'ok');
      }
    } catch (err) {
      toast('Kopyalama sırasında hata oluştu: ' + (err.message || err), 'err');
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
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
      for (const mKey of ['series', 'movie', 'manga', 'book', 'guide', 'project']) {
        if (b[mKey] && Array.isArray(b[mKey].items)) {
          state.multiMediaStore[mKey] = {
            items: cleanMediaItemsForSave(b[mKey].items, mKey),
            customGenreCatalog: Array.isArray(b[mKey].customGenreCatalog) ? b[mKey].customGenreCatalog : [],
            stats: computeMediaStatsClient(b[mKey].items, state.animeData.statsConfig, mKey),
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

  const PAGE_TEXT_META = {
    anime: { label: 'Anime (/anime/)', extLabel: 'AniList Bağlantı Butonu Metni' },
    guide: { label: 'Rehber (/rehber/)', extLabel: 'Kart Sağ Üst Kaynak Rozeti Metni' },
    project: { label: 'Projeler (/projeler/)', extLabel: 'Depo Bağlantı Butonu Metni' },
    series: { label: 'Dizi (/dizi/)', extLabel: "Detay Kartı Kaynak Butonu (Örn: IMDb'de aç)" },
    movie: { label: 'Film (/film/)', extLabel: "Detay Kartı Kaynak Butonu (Örn: IMDb'de aç)" },
    manga: { label: 'Manga (/manga/)', extLabel: 'Detay Kartı Kaynak Butonu (Örn: Kaynakta aç)' },
    book: { label: 'Kitap (/kitap/)', extLabel: 'Detay Kartı Kaynak Butonu (Örn: Kaynakta aç)' }
  };

  function populatePageTextInputsForSection(secId) {
    const activeSec = secId || state.activeTextPageId || 'anime';
    state.activeTextPageId = activeSec;
    if (!state.config.pages) state.config.pages = structuredClone(DEFAULT_CONFIG.pages);
    const defPg = DEFAULT_CONFIG.pages[activeSec] || DEFAULT_CONFIG.pages.anime;
    const pg = { ...defPg, ...(state.config.pages[activeSec] || {}) };
    const meta = PAGE_TEXT_META[activeSec] || PAGE_TEXT_META.anime;

    $$('#cfgPageSectionTabs [data-pg-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pgTab === activeSec);
    });
    if ($('#cfgPageCardHeading')) $('#cfgPageCardHeading').textContent = `${meta.label} Sayfası Metinleri`;
    if ($('#cfgAnimeExtBtnLabel')) $('#cfgAnimeExtBtnLabel').textContent = meta.extLabel;
    if ($('#cfgAnimeResetWrap')) $('#cfgAnimeResetWrap').hidden = activeSec === 'guide';

    $('#cfgAnimeTitle').value = pg.title ?? defPg.title ?? '';
    $('#cfgAnimeSubtitle').value = pg.subtitle ?? defPg.subtitle ?? '';
    $('#cfgAnimeMetaTitle').value = pg.metaTitle ?? defPg.metaTitle ?? '';
    $('#cfgAnimeDesc').value = pg.description ?? defPg.description ?? '';
    $('#cfgAnimeSearch').value = pg.searchPlaceholder ?? defPg.searchPlaceholder ?? '';
    $('#cfgAnimeEmpty').value = pg.emptyText ?? defPg.emptyText ?? '';
    $('#cfgAnimeDetails').value = pg.detailsText ?? defPg.detailsText ?? '';
    $('#cfgAnimeReset').value = pg.resetFilterText ?? defPg.resetFilterText ?? '';
    $('#cfgAnimeAlBtn').value = pg.externalButtonText || pg.anilistButtonText || defPg.externalButtonText || '';
    $('#cfgAnimeFooter').value = pg.footerText ?? defPg.footerText ?? '';
  }

  function saveCurrentPageTextInputsToConfig() {
    const S = AdminSecurity.sanitizeText;
    const activeSec = state.activeTextPageId || 'anime';
    if (!state.config.pages) state.config.pages = structuredClone(DEFAULT_CONFIG.pages);
    const defPg = DEFAULT_CONFIG.pages[activeSec] || DEFAULT_CONFIG.pages.anime;
    const extBtn = S($('#cfgAnimeAlBtn').value, 80) || defPg.externalButtonText || "Kaynakta aç";
    state.config.pages[activeSec] = {
      title: S($('#cfgAnimeTitle').value, 120) || defPg.title,
      subtitle: S($('#cfgAnimeSubtitle').value, 240),
      metaTitle: S($('#cfgAnimeMetaTitle').value, 140) || defPg.metaTitle,
      description: S($('#cfgAnimeDesc').value, 300),
      searchPlaceholder: S($('#cfgAnimeSearch').value, 100) || defPg.searchPlaceholder,
      emptyText: S($('#cfgAnimeEmpty').value, 180) || defPg.emptyText,
      detailsText: S($('#cfgAnimeDetails').value, 80) || 'Ayrıntılar',
      resetFilterText: S($('#cfgAnimeReset').value, 80) || 'Filtreleri sıfırla',
      externalButtonText: extBtn,
      ...(activeSec === 'anime' ? { anilistButtonText: extBtn } : {}),
      footerText: S($('#cfgAnimeFooter').value, 400)
    };
  }

  function renderTagManager() {
    const grid = $('#admTagManagerGrid');
    if (!grid) return;
    const adapter = getActiveAdminAdapter();
    if ($('#admTagManagerTitle')) {
      $('#admTagManagerTitle').textContent = `🏷️ ${adapter.label} Özel Kategori Yöneticisi (Yeniden Adlandır / Birleştir / Sil)`;
    }
    const items = adapter.getItems() || [];
    const counts = new Map();
    for (const c of (adapter.getCustomCatalog() || [])) {
      if (c) counts.set(c, 0);
    }
    for (const it of items) {
      for (const g of (it.customGenres || [])) {
        if (g) counts.set(g, (counts.get(g) || 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'));
    grid.replaceChildren();
    if (!sorted.length) {
      grid.innerHTML = `<p class="help-txt" style="margin:0;grid-column:1/-1">Bu bölümde henüz özel kategori kullanılmamış.</p>`;
      return;
    }
    for (const [tagName, cnt] of sorted) {
      const card = document.createElement('div');
      card.className = 'tag-mgr-item';
      card.innerHTML = `
        <div class="tag-mgr-name">
          <span>${AdminSecurity.sanitizeText(tagName, 50)}</span>
          <span class="tag-mgr-cnt">${cnt} kayıt</span>
        </div>
        <div style="display:flex;gap:4px">
          <button type="button" class="btn-subtle tag-filter-btn" style="padding:3px 8px;font-size:.73rem" title="Bu kategorideki kayıtları filtrele">🔍 Filtrele</button>
          <button type="button" class="icon-btn del tag-del-btn" style="width:26px;height:26px;font-size:.75rem" title="Bu kategoriyi tüm kayıtlardan ve katalogdan kaldır">✕</button>
        </div>
        <div class="tag-mgr-actions">
          <input type="text" class="inp glass tag-rename-inp" value="${AdminSecurity.sanitizeText(tagName, 50)}" placeholder="Yeni ad veya birleştirilecek kategori...">
          <button type="button" class="btn-secondary tag-rename-btn" style="padding:4px 10px;font-size:.75rem">Adlandır / Birleştir</button>
        </div>
      `;
      card.querySelector('.tag-filter-btn').onclick = () => {
        state.animeFilterQ = tagName;
        if ($('#admAnimeSearch')) $('#admAnimeSearch').value = tagName;
        renderAnimeAdminPanel();
      };
      card.querySelector('.tag-rename-btn').onclick = () => {
        const newName = AdminSecurity.sanitizeText(card.querySelector('.tag-rename-inp').value, 40);
        if (!newName || newName === tagName) return;
        let affected = 0;
        for (const it of items) {
          if (Array.isArray(it.customGenres) && it.customGenres.includes(tagName)) {
            const nextSet = new Set(it.customGenres.map(x => (x === tagName ? newName : x)));
            it.customGenres = [...nextSet];
            if (adapter.id !== 'guide') it.genres = [...nextSet];
            it.adminModified = true;
            affected++;
          }
        }
        const catArr = adapter.getCustomCatalog() || [];
        const nextCat = [...new Set(catArr.map(x => (x === tagName ? newName : x)))];
        if (!nextCat.includes(newName)) nextCat.push(newName);
        if (adapter.id === 'anime') {
          state.animeData.customGenreCatalog = nextCat;
          state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
          markDirty('anime');
        } else {
          const store = ensureMultiMediaStore(adapter.id);
          store.customGenreCatalog = nextCat;
          store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, adapter.id);
          store.dirty = true;
          updateDirtyIndicator();
        }
        renderAnimeAdminPanel();
        renderTagManager();
        toast(`"${tagName}" → "${newName}" olarak güncellendi (${affected} kayıt).`);
      };
      card.querySelector('.tag-del-btn').onclick = () => {
        let affected = 0;
        for (const it of items) {
          if (Array.isArray(it.customGenres) && it.customGenres.includes(tagName)) {
            it.customGenres = it.customGenres.filter(x => x !== tagName);
            if (adapter.id !== 'guide') it.genres = [...it.customGenres];
            it.adminModified = true;
            affected++;
          }
        }
        const catArr = adapter.getCustomCatalog() || [];
        const nextCat = catArr.filter(x => x !== tagName);
        if (adapter.id === 'anime') {
          state.animeData.customGenreCatalog = nextCat;
          state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
          markDirty('anime');
        } else {
          const store = ensureMultiMediaStore(adapter.id);
          store.customGenreCatalog = nextCat;
          store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, adapter.id);
          store.dirty = true;
          updateDirtyIndicator();
        }
        renderAnimeAdminPanel();
        renderTagManager();
        toast(`"${tagName}" kategorisi kaldırıldı (${affected} kayıt güncellendi).`);
      };
      grid.append(card);
    }
  }

  function openCommandPalette() {
    const modal = $('#admCmdPaletteModal');
    if (!modal) return;
    modal.hidden = false;
    const inp = $('#admCmdSearchInput');
    if (inp) {
      inp.value = '';
      setTimeout(() => inp.focus(), 20);
    }
    renderCommandPaletteResults('');
  }

  function renderCommandPaletteResults(queryStr) {
    const listEl = $('#admCmdResultsList');
    if (!listEl) return;
    listEl.replaceChildren();
    const q = String(queryStr || '').trim().toLocaleLowerCase('tr');

    const commands = [
      { title: '+ Yeni Anime Ekle', sub: 'Anime bölümünde yeni kayıt penceresini açar', badge: 'Komut', run: () => { switchToMediaSectionAndOpen('anime', '__new__'); } },
      { title: '+ Yeni Dizi Ekle', sub: 'Dizi bölümünde yeni kayıt penceresini açar', badge: 'Komut', run: () => { switchToMediaSectionAndOpen('series', '__new__'); } },
      { title: '+ Yeni Film Ekle', sub: 'Film bölümünde yeni kayıt penceresini açar', badge: 'Komut', run: () => { switchToMediaSectionAndOpen('movie', '__new__'); } },
      { title: '+ Yeni Manga Ekle', sub: 'Manga bölümünde yeni kayıt penceresini açar', badge: 'Komut', run: () => { switchToMediaSectionAndOpen('manga', '__new__'); } },
      { title: '+ Yeni Kitap Ekle', sub: 'Kitap bölümünde yeni kayıt penceresini açar', badge: 'Komut', run: () => { switchToMediaSectionAndOpen('book', '__new__'); } },
      { title: '+ Yeni Rehber Ekle', sub: 'Rehber kataloğuna yeni Technopat konusu ekler', badge: 'Komut', run: () => { switchToMediaSectionAndOpen('guide', '__new__'); } },
      { title: '📊 Yönetim Özeti (Genel Bakış)', sub: 'İçerik metrikleri, veri denetimi ve sistem genel bakışı', badge: 'Panel', run: () => { switchAdminPanel('dashboard'); } },
      { title: '⚡ Hızlı Sıralı Düzenleme Ekranını Aç', sub: 'Kuyruk modunda hızlı kategori ve puan düzenleme', badge: 'Panel', run: () => { switchAdminPanel('rapid'); } },
      { title: '🌳 Bölümler & Düğümler (Nodes)', sub: 'Bölüm yapılandırması, URL yolları, sayfa metinleri ve durum yönetimi', badge: 'Panel', run: () => { switchAdminPanel('nodes'); } },
      { title: '🛡️ Veri Sağlığı & Commit Kurtarma Merkezi', sub: 'Eksik kapak/puan denetimi ve tam yedekleme', badge: 'Panel', run: () => { switchAdminPanel('health'); } },
      { title: '💾 Canlı Önizlemeye Uygula (Ctrl+S)', sub: 'Değişiklikleri tarayıcı önbelleğine yazar', badge: 'İşlem', run: () => { $('#previewApplyBtn')?.click(); } },
      { title: "🚀 GitHub'a Kaydet (Commit)", sub: 'Tüm değişiklikleri doğrudan GitHub deposuna gönderir', badge: 'İşlem', run: () => { $('#commitGithubBtn')?.click(); } }
    ];

    const matchedCmds = commands.filter(c => !q || `${c.title} ${c.sub}`.toLocaleLowerCase('tr').includes(q));
    for (const cmd of matchedCmds.slice(0, q ? 5 : 6)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmd-palette-item';
      btn.innerHTML = `
        <div class="cmd-palette-left">
          <div>
            <div class="cmd-palette-title">${AdminSecurity.sanitizeText(cmd.title, 90)}</div>
            <div class="cmd-palette-sub">${AdminSecurity.sanitizeText(cmd.sub, 120)}</div>
          </div>
        </div>
        <span class="cmd-palette-badge">${cmd.badge}</span>
      `;
      btn.onclick = () => {
        $('#admCmdPaletteModal').hidden = true;
        cmd.run();
      };
      listEl.append(btn);
    }

    const mediaMatches = [];
    for (const secKey of ['anime', 'series', 'movie', 'manga', 'book', 'guide', 'project']) {
      const ad = CONTENT_ADAPTER_REGISTRY[secKey];
      if (!ad) continue;
      for (const it of (ad.getItems() || [])) {
        const hay = `${it.title || ''} ${(it.customGenres || it.categories || []).join(' ')} ${it.author || ''} ${it.director || ''} ${it.network || ''} ${it.language || ''} ${it.branch || ''}`.toLocaleLowerCase('tr');
        if (!q || hay.includes(q)) {
          mediaMatches.push({ secKey, label: ad.label, item: it });
          if (mediaMatches.length >= (q ? 24 : 12)) break;
        }
      }
      if (mediaMatches.length >= (q ? 24 : 12)) break;
    }

    for (const m of mediaMatches) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmd-palette-item';
      const sc = (m.secKey !== 'guide' && m.secKey !== 'project') ? resolveEffectiveScore(m.item) : null;
      const cats = (m.item.customGenres || m.item.categories || []).slice(0, 3).join(', ');
      btn.innerHTML = `
        <div class="cmd-palette-left">
          ${m.item.image ? `<img src="${resolvePreviewSrc(m.item.image)}" alt="" loading="lazy">` : ''}
          <div style="min-width:0">
            <div class="cmd-palette-title">${AdminSecurity.sanitizeText(m.item.title || 'İsimsiz', 90)}</div>
            <div class="cmd-palette-sub">${[sc ? '★ ' + sc : '', cats].filter(Boolean).join(' · ') || 'Düzenlemek için tıklayın'}</div>
          </div>
        </div>
        <span class="cmd-palette-badge">${m.label}</span>
      `;
      btn.onclick = () => {
        $('#admCmdPaletteModal').hidden = true;
        switchToMediaSectionAndOpen(m.secKey, m.item.id);
      };
      listEl.append(btn);
    }
  }

  function switchToMediaSectionAndOpen(secKey, itemId) {
    switchAdminPanel('anime');
    state.activeAdminMediaType = secKey;
    if ($('#admMediaTypeSelect')) $('#admMediaTypeSelect').value = secKey;
    renderAnimeAdminPanel();
    openAnimeEditor(itemId);
  }

  function populateEditorFields() {
    const { site, gift } = state.config;

    $('#cfgSiteTitle').value = site.title || '';
    $('#cfgSiteSubtitle').value = site.subtitle || '';
    $('#cfgSiteBarTitle').value = site.barTitle || '';
    $('#cfgSiteHomeLabel').value = site.homeLabel || '';
    $('#cfgSiteDesc').value = site.description || '';

    populatePageTextInputsForSection(state.activeTextPageId || 'anime');

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
    const { site, gift } = state.config;

    site.title = S($('#cfgSiteTitle').value, 120) || 'Tempestian';
    site.subtitle = S($('#cfgSiteSubtitle').value, 120);
    site.barTitle = S($('#cfgSiteBarTitle').value, 120) || site.title;
    site.homeLabel = S($('#cfgSiteHomeLabel').value, 80) || 'Ana sayfa';
    site.description = S($('#cfgSiteDesc').value, 300);

    saveCurrentPageTextInputsToConfig();

    gift.enabled = Boolean($('#cfgGiftEnabled').checked);
    gift.leadText = S($('#cfgGiftLead').value, 200);
    gift.targetDate = S($('#cfgGiftTarget').value, 60) || '2026-10-26T00:00:00+03:00';
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
    logSessionChange({
      file: cleanTarget,
      action: 'add',
      title: cleanTarget,
      detail: `Yeni görsel dosyası (${Math.round(file.size / 1024)} KB)`
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

  // ============================================================================
  // XENFORO ACP NODES (DÜĞÜM & BÖLÜM YÖNETİMİ) SİSTEMİ
  // ============================================================================
  let activeEditingNodeId = null;

  function renderNodesManager() {
    const wrap = $('#categoriesList');
    if (!wrap) return;
    wrap.replaceChildren();

    // 1. Düğüm İstatistik Çubuğu (XenForo ACP Nodes Header)
    const statsBar = $('#nodesStatsBar');
    if (statsBar) {
      const total = state.config.sections.length;
      const active = state.config.sections.filter(s => s.status === 'active').length;
      const soon = state.config.sections.filter(s => s.status === 'soon').length;
      const hidden = state.config.sections.filter(s => s.status === 'hidden').length;
      statsBar.innerHTML = `
        <span class="nodes-stat-pill"><strong>${total}</strong> Toplam Düğüm</span>
        <span class="nodes-stat-pill active"><strong>${active}</strong> Yayında (Aktif)</span>
        <span class="nodes-stat-pill soon"><strong>${soon}</strong> Yakında Rozetli</span>
        ${hidden > 0 ? `<span class="nodes-stat-pill hidden"><strong>${hidden}</strong> Gizli Taslak</span>` : ''}
      `;
    }

    // 2. Düğüm Ağacı Listesi
    state.config.sections.forEach((sec, idx) => {
      const row = document.createElement('div');
      row.className = 'node-row';
      row.dataset.secId = sec.id;

      const adapter = CONTENT_ADAPTER_REGISTRY[sec.id];
      const itemsCount = (adapter && adapter.getItems && adapter.getItems()) ? adapter.getItems().length : 0;
      const countLabel = `${itemsCount} ${sec.unit || 'öğe'}`;

      const icHtml = (window.UI && typeof window.UI.icon === 'function')
        ? window.UI.icon(sec.icon || sec.id)
        : '';

      const descSnippet = sec.subtitle || sec.description || 'Açıklama belirtilmemiş';
      const isStrip = Boolean(sec.showStrip);

      row.innerHTML = `
        <div class="node-row-left">
          <div class="node-order-controls">
            <button type="button" class="node-order-btn" data-act="up" title="Yukarı Taşı">▲</button>
            <span class="node-order-idx">#${idx + 1}</span>
            <button type="button" class="node-order-btn" data-act="down" title="Aşağı Taşı">▼</button>
          </div>
          <div class="node-icon-box">
            ${icHtml}
          </div>
          <div class="node-main-info">
            <div class="node-title-row">
              <span class="node-title-text">${AdminSecurity.escapeHtml(sec.title || 'İsimsiz Bölüm')}</span>
              <span class="node-slug-badge">/${AdminSecurity.escapeHtml(sec.path || '')}</span>
              ${isStrip ? '<span class="node-strip-badge" title="Ana sayfa kartında kapak şeridi gösterilir">🖼️ Kapak Şeridi</span>' : ''}
            </div>
            <span class="node-desc-preview" title="${AdminSecurity.escapeHtml(descSnippet)}">${AdminSecurity.escapeHtml(descSnippet)}</span>
          </div>
        </div>

        <div class="node-row-right">
          <span class="node-count-badge" title="Toplam kayıtlı içerik">${countLabel}</span>
          <select class="inp glass node-status-select ${sec.status || 'soon'}" data-act="status" title="Yayın Durumunu Değiştir">
            <option value="active"${sec.status === 'active' ? ' selected' : ''}>🟢 Aktif (Yayında)</option>
            <option value="soon"${sec.status === 'soon' ? ' selected' : ''}>🟡 Yakında</option>
            <option value="hidden"${sec.status === 'hidden' ? ' selected' : ''}>⚪ Gizli (Taslak)</option>
          </select>
          <button type="button" class="btn-secondary" data-act="edit" style="padding:0 12px;height:32px;font-size:0.8rem;white-space:nowrap">⚙️ Ayarlar</button>
          <button type="button" class="icon-btn del" data-act="del" title="Düğümü Sil" style="width:32px;height:32px">✕</button>
        </div>
      `;

      // Hızlı Durum Değiştirici
      const stSelect = row.querySelector('[data-act="status"]');
      stSelect.onchange = (e) => {
        sec.status = e.target.value;
        stSelect.className = `inp glass node-status-select ${sec.status}`;
        if (sec.status === 'active' && (!sec.description || sec.description === 'Yakında') && ACTIVE_SECTION_DESCRIPTIONS[sec.id]) {
          sec.description = ACTIVE_SECTION_DESCRIPTIONS[sec.id];
        }
        if (state.activeAdminMediaType === sec.id && $('#admSectionStatusSelect')) {
          $('#admSectionStatusSelect').value = sec.status;
        }
        markDirty('config');
        renderNodesManager();
        const stLabels = { active: 'Yayında (Aktif)', soon: 'Yakında Rozetli', hidden: 'Gizli (Taslak)' };
        toast(`"${sec.title}" yayın durumu "${stLabels[sec.status] || sec.status}" yapıldı.`);
      };

      // Düğüm Düzenleme Modalı Aç
      row.querySelector('[data-act="edit"]').onclick = () => {
        openNodeEditor(sec.id);
      };

      // Sıralama Butonları
      row.querySelector('[data-act="up"]').onclick = () => {
        if (idx === 0) return;
        const arr = state.config.sections;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        renderNodesManager();
        markDirty('config');
      };

      row.querySelector('[data-act="down"]').onclick = () => {
        const arr = state.config.sections;
        if (idx >= arr.length - 1) return;
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        renderNodesManager();
        markDirty('config');
      };

      // Silme Butonu
      row.querySelector('[data-act="del"]').onclick = () => {
        if (!confirm(`"${sec.title}" bölüm düğümünü silmek istediğinize emin misiniz?\n(Bu işlem içerik dosyalarını silmez, yalnızca site menüsünden ve yapılandırmasından kaldırır.)`)) return;
        state.config.sections.splice(idx, 1);
        renderNodesManager();
        markDirty('config');
        toast(`"${sec.title}" düğümü kaldırıldı.`);
      };

      wrap.append(row);
    });
  }

  function renderCategoriesEditor() {
    renderNodesManager();
  }

  function openNodeEditor(secId) {
    const sec = state.config.sections.find(s => s && s.id === secId);
    if (!sec) return;
    activeEditingNodeId = sec.id;

    if (!state.config.pages) state.config.pages = structuredClone(DEFAULT_CONFIG.pages);
    const defPg = DEFAULT_CONFIG.pages[sec.id] || DEFAULT_CONFIG.pages.anime || {};
    const pg = { ...defPg, ...(state.config.pages[sec.id] || {}) };

    if ($('#nodeModalTitleSpan')) $('#nodeModalTitleSpan').textContent = sec.title;
    if ($('#nodeModalHeadTitle')) $('#nodeModalHeadTitle').textContent = sec.title;
    if ($('#nodeModalSlugPreview')) $('#nodeModalSlugPreview').textContent = `/${sec.path || ''}`;
    const stLabels = { active: '🟢 Aktif (Yayında)', soon: '🟡 Yakında', hidden: '⚪ Gizli (Taslak)' };
    if ($('#nodeModalStatusBadge')) $('#nodeModalStatusBadge').textContent = stLabels[sec.status] || sec.status;
    const adapter = CONTENT_ADAPTER_REGISTRY[sec.id];
    const itemsCount = (adapter && adapter.getItems && adapter.getItems()) ? adapter.getItems().length : 0;
    if ($('#nodeModalCountBadge')) $('#nodeModalCountBadge').textContent = `${itemsCount} ${sec.unit || 'Öğe'}`;
    if ($('#nodeModalIconPreview')) {
      $('#nodeModalIconPreview').innerHTML = (window.UI && typeof window.UI.icon === 'function')
        ? window.UI.icon(sec.icon || sec.id)
        : '';
    }

    switchNodeModalTab('general');

    // Tab 1: General & Display
    $('#nmTitle').value = sec.title || '';
    $('#nmPath').value = sec.path || '';
    $('#nmSubtitle').value = sec.subtitle || pg.subtitle || '';
    $('#nmIcon').value = sec.icon || sec.id || 'code';
    $('#nmStatus').value = sec.status || 'soon';
    $('#nmDescription').value = sec.description || '';
    $('#nmShowStrip').checked = sec.showStrip !== false;

    // Tab 2: Page Texts & SEO
    $('#nmMetaTitle').value = pg.metaTitle || `${sec.title} · Tempestian`;
    $('#nmMetaDesc').value = pg.description || '';
    $('#nmSearchPlaceholder').value = pg.searchPlaceholder || '';
    $('#nmEmptyText').value = pg.emptyText || '';
    $('#nmExternalBtn').value = pg.externalButtonText || pg.anilistButtonText || '';
    $('#nmDetailsText').value = pg.detailsText || 'Ayrıntılar';
    $('#nmResetText').value = pg.resetFilterText || 'Filtreleri sıfırla';
    $('#nmFooterText').value = pg.footerText || '';

    // Tab 3: Data & Advanced
    $('#nmDataFile').value = sec.data || '';
    $('#nmCountKey').value = sec.countKey || '';
    $('#nmUnit').value = sec.unit || '';

    $('#nodeEditModal').hidden = false;
  }

  function switchNodeModalTab(tabKey) {
    $$('#nodeModalTabs [data-node-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nodeTab === tabKey);
    });
    const tabs = {
      general: $('#nodeTabGeneral'),
      texts: $('#nodeTabTexts'),
      advanced: $('#nodeTabAdvanced')
    };
    Object.keys(tabs).forEach(k => {
      if (tabs[k]) tabs[k].hidden = (k !== tabKey);
    });
  }

  function saveNodeFromModal() {
    if (!activeEditingNodeId) return;
    const sec = state.config.sections.find(s => s && s.id === activeEditingNodeId);
    if (!sec) return;

    const S = AdminSecurity.sanitizeText;

    // 1. Bölüm Genel Verilerini Güncelle
    const newTitle = S($('#nmTitle').value, 100) || sec.title;
    sec.title = newTitle;
    sec.path = S($('#nmPath').value, 100) || sec.path;
    sec.subtitle = S($('#nmSubtitle').value, 240);
    sec.icon = $('#nmIcon').value || sec.icon;
    sec.status = $('#nmStatus').value || 'soon';
    sec.description = S($('#nmDescription').value, 200) || sec.description;
    sec.showStrip = Boolean($('#nmShowStrip').checked);
    sec.data = S($('#nmDataFile').value, 120) || sec.data;
    sec.countKey = S($('#nmCountKey').value, 60) || sec.countKey;
    sec.unit = S($('#nmUnit').value, 40) || sec.unit;

    // 2. Sayfa ve Katalog Metinlerini Güncelle (state.config.pages)
    if (!state.config.pages) state.config.pages = structuredClone(DEFAULT_CONFIG.pages);
    const defPg = DEFAULT_CONFIG.pages[sec.id] || DEFAULT_CONFIG.pages.anime || {};
    const extBtnVal = S($('#nmExternalBtn').value, 80) || defPg.externalButtonText || '';

    state.config.pages[sec.id] = {
      ...(state.config.pages[sec.id] || {}),
      title: sec.title,
      subtitle: sec.subtitle,
      metaTitle: S($('#nmMetaTitle').value, 140) || `${sec.title} · Tempestian`,
      description: S($('#nmMetaDesc').value, 300),
      searchPlaceholder: S($('#nmSearchPlaceholder').value, 100) || defPg.searchPlaceholder,
      emptyText: S($('#nmEmptyText').value, 180) || defPg.emptyText,
      detailsText: S($('#nmDetailsText').value, 80) || 'Ayrıntılar',
      resetFilterText: S($('#nmResetText').value, 80) || 'Filtreleri sıfırla',
      externalButtonText: extBtnVal,
      ...(sec.id === 'anime' ? { anilistButtonText: extBtnVal } : {}),
      footerText: S($('#nmFooterText').value, 400)
    };

    markDirty('config');
    renderNodesManager();
    $('#nodeEditModal').hidden = true;
    activeEditingNodeId = null;
    toast(`"${sec.title}" düğüm ayarları başarıyla güncellendi.`);
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

  const ACP_PANEL_TITLES = {
    dashboard: 'Yönetim Özeti',
    anime: 'Medya & Arşiv',
    rapid: 'Hızlı Sıralı İnceleme',
    instagram: 'Görsel Stüdyosu',
    nodes: 'Bölümler & Düğümler (Nodes)',
    texts: 'Bölümler & Düğümler (Nodes)',
    images: 'Görseller & Medya',
    categories: 'Bölümler & Düğümler (Nodes)',
    boxes: 'Kutucuk & Hızlı Linkler',
    health: '🛠️ Araçlar & Veri Sağlığı',
    security: 'Güvenlik & PAT'
  };

  const ACP_PANEL_IDS = {
    dashboard: 'panelDashboard',
    anime: 'panelAnime',
    rapid: 'panelRapid',
    instagram: 'panelInstagram',
    nodes: 'panelNodes',
    images: 'panelImages',
    boxes: 'panelBoxes',
    health: 'panelHealth',
    security: 'panelSecurity'
  };

  function switchAdminPanel(targetPanel, options = {}) {
    if (targetPanel === 'projects') {
      state.activeAdminMediaType = 'project';
      targetPanel = 'anime';
      if ($('#admMediaTypeSelect')) $('#admMediaTypeSelect').value = 'project';
    }
    if (targetPanel === 'categories' || targetPanel === 'texts') {
      targetPanel = 'nodes';
    }
    const panelKey = ACP_PANEL_IDS[targetPanel] ? targetPanel : 'dashboard';

    // 1. Sol menü [data-panel] aktiflik ve aria-selected güncellemesi
    $$('[data-panel]').forEach(btn => {
      const isTarget = btn.dataset.panel === panelKey;
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      btn.classList.toggle('active', isTarget);
    });

    // 2. Panellerin görünürlük ayarı
    Object.keys(ACP_PANEL_IDS).forEach(k => {
      const el = $('#' + ACP_PANEL_IDS[k]);
      if (el) el.hidden = (k !== panelKey);
    });

    // 3. ACP Breadcrumb başlığı güncellemesi
    const panelTitleEl = $('#acpBreadcrumbPanel');
    if (panelTitleEl) {
      panelTitleEl.textContent = ACP_PANEL_TITLES[panelKey] || panelKey;
    }

    // 4. Panel başlatıcılarının tetiklenmesi
    if (panelKey === 'dashboard') {
      renderAcpDashboard();
    } else if (panelKey === 'anime') {
      renderAnimeAdminPanel();
    } else if (panelKey === 'rapid') {
      if (!options.skipQueueInit) {
        initOrRefreshRapidQueue(options.rebuildQueue !== false);
      }
    } else if (panelKey === 'nodes') {
      renderNodesManager();
    } else if (panelKey === 'health') {
      renderHealthAuditor();
      if (typeof updateBatchWizardUI === 'function') updateBatchWizardUI();
    } else if (panelKey === 'instagram') {
      if (window.AdminInstagram && typeof window.AdminInstagram.init === 'function') {
        window.AdminInstagram.init();
      }
    }

    renderAcpNotices();

    const stage = $('#adminMainStage');
    if (stage) stage.scrollTop = 0;
  }

  function renderAcpDashboard() {
    const container = $('#panelDashboard');
    if (!container) return;

    const sess = (window.AdminSecurity && AdminSecurity.getSessionInfo && AdminSecurity.getSessionInfo()) || {};
    const repoText = `${sess.repoOwner || 'tempestian'}/${sess.repoName || 'tempestian.github.io'}`;
    const branchText = sess.branch || 'main';
    const authStatus = sess.hasToken ? 'Contents: Read & Write (PAT Doğrulandı)' : 'Salt Okunur (PAT Tanımsız)';
    const hasLocalPreview = Boolean(
      localStorage.getItem('tp_site_preview') ||
      localStorage.getItem('tp_anime_preview') ||
      localStorage.getItem('tp_multimedia_preview')
    );
    const previewStatusText = hasLocalPreview
      ? '🟡 Önizleme Aktif (Tarayıcı Depolama)'
      : '🟢 Depoyla Eşitlenmiş (Canlı)';

    const sectionKeys = ['anime', 'series', 'movie', 'manga', 'book', 'guide', 'project'];
    const sectionMeta = {
      anime: { title: 'Anime Arşivi', icon: '📺', unit: 'anime', scoreLabel: 'Ortalama Puan', desc: 'Sezon & Film Ağırlıklı' },
      series: { title: 'Dizi Arşivi', icon: '🎬', unit: 'dizi', scoreLabel: 'Ortalama Puan', desc: 'Sezon & Bölüm Puanları' },
      movie: { title: 'Film Arşivi', icon: '🍿', unit: 'film', scoreLabel: 'Ortalama Puan', desc: 'Ana & Yan Film Puanları' },
      manga: { title: 'Manga Arşivi', icon: '📖', unit: 'manga', scoreLabel: 'Ortalama Puan', desc: 'Cilt & Bölüm Takibi' },
      book: { title: 'Kitap Arşivi', icon: '📚', unit: 'kitap', scoreLabel: 'Ortalama Puan', desc: 'Sayfa & Cilt Puanları' },
      guide: { title: 'Rehber Kataloğu', icon: '🧭', unit: 'rehber', scoreLabel: 'Katalog Yayını', desc: 'Technopat Sosyal Kataloğu' },
      project: { title: 'Projeler & Forklar', icon: '💻', unit: 'proje', scoreLabel: 'Açık Kaynak', desc: 'NixOS & Masaüstü Depoları' }
    };

    let totalAllItems = 0;
    const sectionStats = {};
    const attentionIssues = {
      total: 0,
      missingCover: [],
      missingScore: [],
      missingGenres: [],
      bySection: {}
    };

    for (const secKey of sectionKeys) {
      const adapter = CONTENT_ADAPTER_REGISTRY[secKey];
      const items = (adapter && adapter.getItems && adapter.getItems()) || [];
      totalAllItems += items.length;

      let scoreText = '—';
      if (secKey === 'guide') {
        const published = items.filter(it => it && it.status === 'completed').length;
        scoreText = `${published} Yayında`;
      } else if (secKey === 'project') {
        const active = items.filter(it => it && (it.status || 'completed') === 'completed').length;
        scoreText = `${active} Aktif`;
      } else {
        const scored = items.filter(it => it && (it.score != null || (Array.isArray(it.parts) && it.parts.length > 0)) && Number(adapter.computeScore(it)) > 0);
        if (scored.length) {
          const avg = scored.reduce((sum, it) => sum + Number(adapter.computeScore(it)), 0) / scored.length;
          scoreText = `${avg.toFixed(1)} / 10`;
        } else {
          scoreText = 'Puanlanmadı';
        }
      }

      const secCfg = ensureSectionEntryInConfig(secKey);
      const status = secCfg ? (secCfg.status || 'active') : 'active';
      const statusBadge = status === 'active'
        ? { text: '🟢 Yayında (Aktif)', cls: 'status-active' }
        : status === 'soon'
        ? { text: '🟡 Yakında Kartı', cls: 'status-soon' }
        : { text: '⚪ Gizli (Taslak)', cls: 'status-hidden' };

      sectionStats[secKey] = {
        count: items.length,
        scoreText,
        statusBadge,
        status
      };

      const secMissingCover = [];
      const secMissingScore = [];
      const secMissingGenres = [];

      for (const it of items) {
        if (!it) continue;
        const hasGenres = (Array.isArray(it.customGenres) && it.customGenres.length > 0) || (Array.isArray(it.categories) && it.categories.length > 0);
        if (!hasGenres) secMissingGenres.push({ secKey, item: it });

        if (secKey !== 'guide' && secKey !== 'project') {
          const effScore = adapter.computeScore(it);
          if (effScore == null && (it.status === 'completed' || it.status === 'watching')) {
            secMissingScore.push({ secKey, item: it });
          }
          if (!it.image) {
            secMissingCover.push({ secKey, item: it });
          }
        }
      }

      attentionIssues.missingCover.push(...secMissingCover);
      attentionIssues.missingScore.push(...secMissingScore);
      attentionIssues.missingGenres.push(...secMissingGenres);
      attentionIssues.bySection[secKey] = {
        cover: secMissingCover.length,
        score: secMissingScore.length,
        genres: secMissingGenres.length,
        total: secMissingCover.length + secMissingScore.length + secMissingGenres.length
      };
    }

    attentionIssues.total = attentionIssues.missingCover.length + attentionIssues.missingScore.length + attentionIssues.missingGenres.length;

    // Sidebar rozetlerini güncelle
    const totalBadge = $('#acpTotalItemsBadge');
    if (totalBadge) totalBadge.textContent = `${totalAllItems} İçerik`;
    const branchBadge = $('#acpBranchLabel');
    if (branchBadge) branchBadge.textContent = branchText;

    // HTML İçeriği
    container.innerHTML = `
      <div class="acp-dashboard-container">
        <!-- 1. Hero / Karşılama Kartı -->
        <div class="acp-hero-card glass sq">
          <div class="acp-hero-head">
            <div class="acp-hero-title">
              <h2>🛡️ Yönetim Kontrol Merkezi</h2>
              <p id="acpHeroStatusText">Sistem hazır. <strong>${totalAllItems}</strong> arşiv kaydı ve 6 medya bölümü senkronize edildi.</p>
            </div>
            <div class="acp-hero-actions">
              <button type="button" class="btn-primary" id="acpQuickAddBtn"><span>+ Yeni İçerik Ekle</span></button>
              <button type="button" class="btn-secondary" id="acpQuickRapidBtn"><span>⚡ Hızlı Sıralı</span></button>
              <button type="button" class="btn-subtle" id="acpQuickHealthBtn"><span>🛡️ Veri Sağlığı Denetimi</span></button>
              <button type="button" class="btn-subtle" id="acpQuickPreviewBtn"><span>💾 Canlı Önizleme</span></button>
              <button type="button" class="btn-primary" id="acpQuickCommitBtn" style="background:linear-gradient(135deg, #059669 0%, #047857 100%)"><span>🚀 GitHub'a Kaydet</span></button>
            </div>
          </div>
        </div>

        <!-- 2. Veri Denetimi / İnceleme Bekleyenler Kuyruğu -->
        <div id="acpAttentionBoxContainer">
          ${attentionIssues.total > 0 ? `
            <div class="acp-attention-card warn glass sq" id="acpAttentionBox">
              <div class="acp-attention-head">
                <div class="acp-attention-icon">⚠️</div>
                <div>
                  <h3 style="margin:0 0 4px 0;font-size:1.05rem">İnceleme Bekleyenler · Veri Denetimi</h3>
                  <p class="sub" style="margin:0;font-size:0.85rem">Tüm bölümlerde toplam <strong>${attentionIssues.total}</strong> kayıt eksik veri (kapak, puan veya özel kategori) nedeniyle dikkat gerektiriyor.</p>
                </div>
              </div>
              <div class="acp-attention-chips">
                <span class="acp-chip ${attentionIssues.missingCover.length ? 'warn' : 'ok'}">🖼️ ${attentionIssues.missingCover.length} Kapak Görseli Eksik</span>
                <span class="acp-chip ${attentionIssues.missingScore.length ? 'warn' : 'ok'}">⭐ ${attentionIssues.missingScore.length} Puan Eksik</span>
                <span class="acp-chip ${attentionIssues.missingGenres.length ? 'warn' : 'ok'}">🏷️ ${attentionIssues.missingGenres.length} Özel Türü Tanımlanmamış</span>
              </div>
              <div class="acp-attention-actions">
                <button type="button" class="btn-primary" id="acpResolveInRapidBtn">⚡ Hızlı Sıralı Kuyruğunda Çöz</button>
                <button type="button" class="btn-subtle" id="acpInspectInHealthBtn">🛡️ Veri Sağlığı Denetleyicisini Aç</button>
              </div>
            </div>
          ` : `
            <div class="acp-attention-card ok glass sq" id="acpAttentionBox">
              <div class="acp-attention-head">
                <div class="acp-attention-icon ok">✅</div>
                <div>
                  <h3 style="margin:0 0 4px 0;font-size:1.05rem">%100 Veri Bütünlüğü Tamamlandı</h3>
                  <p class="sub" style="margin:0;font-size:0.85rem">Tüm anime, dizi, film, manga, kitap ve rehber kayıtlarınızda kapaklar, puanlar ve özel tür kategorileri eksiksiz tanımlanmış.</p>
                </div>
              </div>
              <div class="acp-attention-chips">
                <span class="acp-chip ok">✨ Tüm Kapaklar Tam</span>
                <span class="acp-chip ok">⭐ Puanlar Eksiksiz</span>
                <span class="acp-chip ok">🏷️ Özel Kategoriler Eşleşti</span>
              </div>
            </div>
          `}
        </div>

        <!-- 3. İçerik Sayaçları ve Durum Matrisi -->
        <div class="acp-section-heading-row">
          <div>
            <h3 style="margin:0;font-size:1.08rem;font-weight:750">📊 Medya &amp; Arşiv Durum Matrisi</h3>
            <span class="meta" style="font-size:0.8rem">Bölümlerin sitedeki yayın durumu, kayıt sayıları ve ağırlıklı puan ortalamaları</span>
          </div>
        </div>

        <div class="acp-stats-grid">
          ${sectionKeys.map(key => {
            const meta = sectionMeta[key];
            const stat = sectionStats[key];
            return `
              <div class="acp-stat-card glass sq">
                <div class="acp-stat-top">
                  <div class="acp-stat-title">
                    <span style="font-size:1.35rem">${meta.icon}</span>
                    <span>${meta.title}</span>
                  </div>
                  <span class="acp-status-pill ${stat.statusBadge.cls}">${stat.statusBadge.text}</span>
                </div>
                <div>
                  <div class="acp-stat-count">${stat.count} <small style="font-size:0.82rem;font-weight:550;color:var(--iris-ink-secondary,#a8c5eb)">${meta.unit}</small></div>
                  <div style="font-size:0.82rem;color:var(--iris-ink-secondary,#a8c5eb);margin-top:4px">${meta.scoreLabel}: <strong style="color:var(--iris-ink,#edf4ff)">${stat.scoreText}</strong></div>
                </div>
                <div class="acp-stat-meta">
                  <span>${meta.desc}</span>
                  <button type="button" class="btn-subtle acp-jump-btn" data-jump-section="${key}">Yönet →</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- 4. Sistem ve Depo Bilgisi Kutusu -->
        <div class="acp-section-heading-row" style="margin-top:12px">
          <div>
            <h3 style="margin:0;font-size:1.08rem;font-weight:750">⚙️ Depo, Senkronizasyon ve Veri Yönetimi</h3>
            <span class="meta" style="font-size:0.8rem">GitHub API bağlantısı, dal durumu ve tam veri dışa aktarımı</span>
          </div>
        </div>

        <div class="acp-system-grid">
          <div class="acp-system-box glass sq">
            <h4>📦 GitHub Depo &amp; Dal Bilgisi</h4>
            <div class="acp-info-list">
              <div class="acp-info-row">
                <span class="acp-info-label">Depo:</span>
                <span class="acp-info-value" id="acpSysRepoVal">${AdminSecurity.sanitizeText(repoText, 80)}</span>
              </div>
              <div class="acp-info-row">
                <span class="acp-info-label">Aktif Dal:</span>
                <span class="acp-info-value" id="acpSysBranchVal">${AdminSecurity.sanitizeText(branchText, 50)}</span>
              </div>
              <div class="acp-info-row">
                <span class="acp-info-label">PAT Yetkisi:</span>
                <span class="acp-info-value" id="acpSysAuthVal">${authStatus}</span>
              </div>
              <div class="acp-info-row">
                <span class="acp-info-label">Toplam İçerik:</span>
                <span class="acp-info-value" id="acpSysTotalCountVal">${totalAllItems} Kayıt</span>
              </div>
            </div>
          </div>

          <div class="acp-system-box glass sq">
            <h4>💾 Canlı Önizleme &amp; Bellek Durumu</h4>
            <div class="acp-info-list">
              <div class="acp-info-row">
                <span class="acp-info-label">Önizleme Deposu:</span>
                <span class="acp-info-value" id="acpSysPreviewVal">${previewStatusText}</span>
              </div>
              <div class="acp-info-row">
                <span class="acp-info-label">Kayıt Bekleyen:</span>
                <span class="acp-info-value" id="acpSysDirtyVal">Değişiklik Yok</span>
              </div>
              <div class="acp-info-row">
                <span class="acp-info-label">Son Güncelleme:</span>
                <span class="acp-info-value" id="acpSysUpdatedVal">${state.animeData?.updated || 'Bugün'}</span>
              </div>
            </div>
          </div>

          <div class="acp-system-box glass sq">
            <h4>⚡ Hızlı Dışa Aktarım &amp; Yedek</h4>
            <p class="meta" style="margin-top:0;margin-bottom:12px;font-size:0.8rem">Tüm verilerinizi tek tıkla cihazınıza indirebilir ve güvenle arşivleyebilirsiniz.</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <button type="button" class="btn-subtle" id="acpDownloadSectionsBtn">sections.json İndir</button>
              <button type="button" class="btn-secondary" id="acpDownloadAllJsonBtn">📦 Tüm JSON Paketini İndir</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Olay Dinleyicileri
    const addBtn = $('#acpQuickAddBtn');
    if (addBtn) {
      addBtn.onclick = () => {
        state.activeAdminMediaType = 'anime';
        if ($('#admMediaTypeSelect')) $('#admMediaTypeSelect').value = 'anime';
        switchAdminPanel('anime');
        openAnimeEditor('__new__');
      };
    }

    const qRapidBtn = $('#acpQuickRapidBtn');
    if (qRapidBtn) {
      qRapidBtn.onclick = () => switchAdminPanel('rapid');
    }

    const qHealthBtn = $('#acpQuickHealthBtn');
    if (qHealthBtn) {
      qHealthBtn.onclick = () => switchAdminPanel('health');
    }

    const qPrevBtn = $('#acpQuickPreviewBtn');
    if (qPrevBtn) {
      qPrevBtn.onclick = () => $('#previewApplyBtn')?.click();
    }

    const qCommitBtn = $('#acpQuickCommitBtn');
    if (qCommitBtn) {
      qCommitBtn.onclick = () => $('#commitGithubBtn')?.click();
    }

    const dlSecBtn = $('#acpDownloadSectionsBtn');
    if (dlSecBtn) {
      dlSecBtn.onclick = () => $('#downloadJsonBtn')?.click();
    }

    const dlAllBtn = $('#acpDownloadAllJsonBtn');
    if (dlAllBtn) {
      dlAllBtn.onclick = () => {
        const fullBackup = {
          app: 'Tempestian ACP Backup',
          exportDate: new Date().toISOString(),
          sections: state.config,
          anime: state.animeData,
          overrides: state.overrides,
          multimedia: state.multiMediaStore
        };
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadBlobJson(fullBackup, `tempestian-full-backup-${dateStr}.json`);
        toast('Tüm JSON veri paketi indirildi.');
      };
    }

    const resRapid = $('#acpResolveInRapidBtn');
    if (resRapid) {
      resRapid.onclick = () => {
        let targetType = 'anime';
        for (const k of ['anime', 'series', 'movie', 'manga', 'book', 'guide']) {
          if (attentionIssues.bySection[k]?.total > 0) {
            targetType = k;
            break;
          }
        }
        state.rapidQueue.activeType = targetType;
        if ($('#rqContentTypeSelect')) $('#rqContentTypeSelect').value = targetType;
        switchAdminPanel('rapid');
        toast(`${sectionMeta[targetType]?.title || targetType} Hızlı Sıralı kuyruğunda açıldı.`);
      };
    }

    const inspHealth = $('#acpInspectInHealthBtn');
    if (inspHealth) {
      inspHealth.onclick = () => switchAdminPanel('health');
    }

    $$('.acp-jump-btn').forEach(btn => {
      btn.onclick = () => {
        const targetSec = btn.dataset.jumpSection;
        if (!targetSec) return;
        state.activeAdminMediaType = targetSec;
        const sel = $('#admMediaTypeSelect');
        if (sel) sel.value = targetSec;
        state.selectedAdminIds.clear();
        switchAdminPanel('anime');
        renderAnimeAdminPanel();
        toast(`${sectionMeta[targetSec]?.title || targetSec} yönetim ekranına geçildi.`);
      };
    });

    updateDirtyIndicator();
  }

  function bindDashboardEvents() {
    $$('[data-panel]').forEach(btn => {
      btn.onclick = () => {
        switchAdminPanel(btn.dataset.panel);
        const shell = $('#adminShell');
        if (shell && window.innerWidth <= 900) {
          shell.classList.remove('mobile-nav-open');
        }
      };
    });

    const toggleBtn = $('#sidebarToggleBtn');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const shell = $('#adminShell');
        if (!shell) return;
        if (window.innerWidth <= 900) {
          shell.classList.toggle('mobile-nav-open');
        } else {
          shell.classList.toggle('sidebar-collapsed');
          const isCollapsed = shell.classList.contains('sidebar-collapsed');
          localStorage.setItem('tp_acp_sidebar_collapsed', isCollapsed ? '1' : '0');
        }
      };
    }

    if (localStorage.getItem('tp_acp_sidebar_collapsed') === '1' && window.innerWidth > 900) {
      $('#adminShell')?.classList.add('sidebar-collapsed');
    }

    $$('#panelNodes input, #panelNodes textarea, #panelBoxes input').forEach(inp => {
      inp.addEventListener('input', () => markDirty('config'));
      inp.addEventListener('change', () => markDirty('config'));
    });

    // Adım 3–8: Anime Yönetimi ve İstatistik Olayları
    $('#admMediaTypeSelect').onchange = e => {
      state.activeAdminMediaType = e.target.value;
      state.selectedAdminIds.clear();
      renderAnimeAdminPanel();
    };

    const persistBatchChanges = (adapter) => {
      if (adapter.id === 'anime') {
        state.animeData.stats = computeStatsClient(state.animeData.anime, state.animeData.statsConfig);
        state.animeData.updated = new Date().toISOString().slice(0, 10);
        markDirty('anime');
      } else {
        const store = ensureMultiMediaStore(adapter.id);
        store.stats = computeMediaStatsClient(store.items, state.animeData.statsConfig, adapter.id);
        store.dirty = true;
        updateDirtyIndicator();
      }
      renderAnimeAdminPanel();
    };

    if ($('#admSelectAllCheck')) {
      $('#admSelectAllCheck').onchange = e => {
        const filteredIds = state.lastFilteredIds || [];
        if (e.target.checked) {
          for (const id of filteredIds) state.selectedAdminIds.add(id);
        } else {
          for (const id of filteredIds) state.selectedAdminIds.delete(id);
        }
        renderAnimeAdminPanel();
      };
    }
    if ($('#admClearSelectionBtn')) {
      $('#admClearSelectionBtn').onclick = () => {
        state.selectedAdminIds.clear();
        renderAnimeAdminPanel();
      };
    }
    if ($('#admBatchAddCatBtn')) {
      $('#admBatchAddCatBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const customVal = AdminSecurity.sanitizeText($('#admBatchCustomCatInp')?.value || '', 40);
        const selVal = $('#admBatchCatSelect')?.value || '';
        const cat = customVal || selVal;
        if (!cat) {
          toast('Lütfen eklenecek bir kategori seçin veya yazın.', 'warn');
          return;
        }
        if (customVal) {
          adapter.addCustomCategory(customVal);
          if ($('#admBatchCustomCatInp')) $('#admBatchCustomCatInp').value = '';
        }
        const list = adapter.getItems();
        let count = 0;
        for (const it of list) {
          if (!state.selectedAdminIds.has(it.id)) continue;
          const cur = new Set(Array.isArray(it.customGenres) ? it.customGenres : []);
          cur.add(cat);
          it.customGenres = [...cur];
          if (adapter.id !== 'guide') it.genres = [...cur];
          it.adminModified = true;
          count++;
        }
        if (count > 0) {
          persistBatchChanges(adapter);
          toast(`Seçili ${count} kayda "${cat}" kategorisi eklendi.`);
        }
      };
    }
    if ($('#admBatchRemoveCatBtn')) {
      $('#admBatchRemoveCatBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const customVal = AdminSecurity.sanitizeText($('#admBatchCustomCatInp')?.value || '', 40);
        const selVal = $('#admBatchCatSelect')?.value || '';
        const cat = customVal || selVal;
        if (!cat) {
          toast('Lütfen çıkarılacak bir kategori seçin veya yazın.', 'warn');
          return;
        }
        const list = adapter.getItems();
        let count = 0;
        for (const it of list) {
          if (!state.selectedAdminIds.has(it.id)) continue;
          const cur = new Set(Array.isArray(it.customGenres) ? it.customGenres : []);
          if (cur.has(cat)) {
            cur.delete(cat);
            it.customGenres = [...cur];
            if (adapter.id !== 'guide') it.genres = [...cur];
            it.adminModified = true;
            count++;
          }
        }
        persistBatchChanges(adapter);
        toast(`${count} kayıttan "${cat}" kategorisi çıkarıldı.`);
      };
    }
    if ($('#admBatchApplyStatusBtn')) {
      $('#admBatchApplyStatusBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const newSt = $('#admBatchStatusSelect')?.value;
        if (!newSt) return;
        const list = adapter.getItems();
        let count = 0;
        for (const it of list) {
          if (!state.selectedAdminIds.has(it.id)) continue;
          it.status = newSt;
          it.adminModified = true;
          count++;
        }
        if (count > 0) {
          persistBatchChanges(adapter);
          const stMap = Object.fromEntries(adapter.statusOptions || []);
          toast(`Seçili ${count} kaydın durumu "${stMap[newSt] || newSt}" olarak güncellendi.`);
        }
      };
    }
    if ($('#admBatchFavOnBtn')) {
      $('#admBatchFavOnBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const list = adapter.getItems();
        let count = 0;
        for (const it of list) {
          if (!state.selectedAdminIds.has(it.id)) continue;
          it.favorite = true;
          it.adminModified = true;
          count++;
        }
        if (count > 0) {
          persistBatchChanges(adapter);
          toast(`Seçili ${count} kayıt ${adapter.id === 'guide' ? '★ Öne Çıkan Rehber' : '★ Başyapıt'} olarak işaretlendi!`);
        }
      };
    }
    if ($('#admBatchFavOffBtn')) {
      $('#admBatchFavOffBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const list = adapter.getItems();
        let count = 0;
        for (const it of list) {
          if (!state.selectedAdminIds.has(it.id)) continue;
          delete it.favorite;
          it.adminModified = true;
          count++;
        }
        if (count > 0) {
          persistBatchChanges(adapter);
          toast(`Seçili ${count} kaydın ★ işareti kaldırıldı.`);
        }
      };
    }
    if ($('#admBatchDeleteBtn')) {
      $('#admBatchDeleteBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const selCount = state.selectedAdminIds.size;
        if (!selCount) return;
        const btn = $('#admBatchDeleteBtn');
        if (btn.dataset.confirming !== 'yes') {
          btn.dataset.confirming = 'yes';
          btn.textContent = `⚠️ Emin misiniz? (${selCount} Kaydı Silmek İçin Tekrar Tıklayın)`;
          setTimeout(() => {
            if (btn) {
              delete btn.dataset.confirming;
              btn.textContent = '🗑️ Seçilenleri Sil';
            }
          }, 4000);
          return;
        }
        delete btn.dataset.confirming;
        btn.textContent = '🗑️ Seçilenleri Sil';

        const list = adapter.getItems();
        const kept = [];
        let removedCount = 0;
        for (const it of list) {
          if (state.selectedAdminIds.has(it.id)) {
            removedCount++;
            if (adapter.id === 'anime') {
              if (it.anilistId && !state.overrides.exclude.includes(Number(it.anilistId))) {
                state.overrides.exclude.push(Number(it.anilistId));
                markDirty('overrides');
              }
              if (!state.overrides.deletedIds.includes(it.id)) {
                state.overrides.deletedIds.push(it.id);
                markDirty('overrides');
              }
            }
          } else {
            kept.push(it);
          }
        }
        list.splice(0, list.length, ...kept);
        state.selectedAdminIds.clear();
        if (adapter.id === 'anime') renderOverridesEditor();
        persistBatchChanges(adapter);
        toast(`${removedCount} kayıt listeden kaldırıldı.`);
      };
    }
    if ($('#admSectionStatusSelect')) {
      $('#admSectionStatusSelect').onchange = e => {
        const adapter = getActiveAdminAdapter();
        const secEntry = ensureSectionEntryInConfig(adapter.id);
        if (!secEntry) return;
        secEntry.status = e.target.value;
        if (secEntry.status === 'active' && (!secEntry.description || secEntry.description === 'Yakında') && ACTIVE_SECTION_DESCRIPTIONS[adapter.id]) {
          secEntry.description = ACTIVE_SECTION_DESCRIPTIONS[adapter.id];
        }
        renderCategoriesEditor();
        markDirty('config');
        const stLabels = { active: 'Yayında (Aktif)', soon: 'Yakında Kartı', hidden: 'Gizli (Taslak)' };
        toast(`${adapter.label} bölümünün yayın durumu "${stLabels[secEntry.status] || secEntry.status}" olarak ayarlandı.`);
      };
    }
    if ($('#nodesSubNavTreeBtn')) {
      $('#nodesSubNavTreeBtn').onclick = () => {
        $('#nodesSubNavTreeBtn').classList.add('active');
        $('#nodesSubNavIdentityBtn')?.classList.remove('active');
        if ($('#nodesTreeWrap')) $('#nodesTreeWrap').hidden = false;
        if ($('#siteIdentityWrap')) $('#siteIdentityWrap').hidden = true;
      };
    }
    if ($('#nodesSubNavIdentityBtn')) {
      $('#nodesSubNavIdentityBtn').onclick = () => {
        $('#nodesSubNavIdentityBtn').classList.add('active');
        $('#nodesSubNavTreeBtn')?.classList.remove('active');
        if ($('#nodesTreeWrap')) $('#nodesTreeWrap').hidden = true;
        if ($('#siteIdentityWrap')) $('#siteIdentityWrap').hidden = false;
      };
    }

    const closeNodeModal = () => {
      if ($('#nodeEditModal')) $('#nodeEditModal').hidden = true;
      activeEditingNodeId = null;
    };
    if ($('#closeNodeModalBtn')) $('#closeNodeModalBtn').onclick = closeNodeModal;
    if ($('#cancelNodeModalBtn')) $('#cancelNodeModalBtn').onclick = closeNodeModal;
    if ($('#saveNodeModalBtn')) $('#saveNodeModalBtn').onclick = () => saveNodeFromModal();
    $$('#nodeModalTabs [data-node-tab]').forEach(btn => {
      btn.onclick = () => switchNodeModalTab(btn.dataset.nodeTab);
    });

    ['#cfgSiteTitle', '#cfgSiteSubtitle', '#cfgSiteBarTitle', '#cfgSiteHomeLabel', '#cfgSiteDesc'].forEach(sel => {
      const el = $(sel);
      if (el) {
        el.addEventListener('input', () => {
          collectFormFieldsIntoConfig();
          markDirty('config');
        });
      }
    });

    if ($('#toggleTagManagerBtn')) {
      $('#toggleTagManagerBtn').onclick = () => {
        const sec = $('#admTagManagerSection');
        if (!sec) return;
        sec.hidden = !sec.hidden;
        if (!sec.hidden) renderTagManager();
      };
    }
    if ($('#closeTagManagerBtn')) {
      $('#closeTagManagerBtn').onclick = () => {
        if ($('#admTagManagerSection')) $('#admTagManagerSection').hidden = true;
      };
    }
    if ($('#admTagAddNewBtn')) {
      $('#admTagAddNewBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const val = AdminSecurity.sanitizeText($('#admTagNewInput')?.value || '', 40);
        if (!val) return;
        adapter.addCustomCategory(val);
        if ($('#admTagNewInput')) $('#admTagNewInput').value = '';
        renderTagManager();
        syncBatchActionBar();
        toast(`"${val}" özel kategori kataloğuna eklendi.`);
      };
    }

    if ($('#admBatchApplyScoreBtn')) {
      $('#admBatchApplyScoreBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        if (adapter.id === 'guide') return;
        const rawVal = $('#admBatchScoreInp')?.value.trim();
        const sc = rawVal === '' ? null : Math.min(10, Math.max(0, Math.round(Number(rawVal) * 10) / 10));
        if (sc == null || isNaN(sc)) {
          toast('Lütfen 0 ile 10 arasında geçerli bir puan girin.', 'warn');
          return;
        }
        const list = adapter.getItems();
        let count = 0;
        for (const it of list) {
          if (!state.selectedAdminIds.has(it.id)) continue;
          const parts = Array.isArray(it.parts) ? it.parts : [];
          const targets = parts.filter(p => p.kind === 'season' && p.status !== 'NONE' && p.status !== 'PLANNING');
          const listToScore = targets.length ? targets : (parts.length ? [parts[0]] : []);
          for (const p of listToScore) {
            p.score = sc;
            p.adminModified = true;
          }
          it.score = resolveEffectiveScore(it);
          it.adminModified = true;
          count++;
        }
        if (count > 0) {
          persistBatchChanges(adapter);
          toast(`Seçili ${count} kayda ★ ${sc} puanı uygulandı.`);
        }
      };
    }
    if ($('#admBatchSendToRapidBtn')) {
      $('#admBatchSendToRapidBtn').onclick = () => {
        const adapter = getActiveAdminAdapter();
        const selectedItems = (adapter.getItems() || []).filter(x => state.selectedAdminIds.has(x.id));
        if (!selectedItems.length) return;
        sendHealthItemsToRapidQueue(adapter.id, selectedItems, `Seçili Kayıtlar`);
      };
    }

    if ($('#openCmdPaletteBtn')) {
      $('#openCmdPaletteBtn').onclick = openCommandPalette;
    }
    if ($('#closeCmdPaletteBtn')) {
      $('#closeCmdPaletteBtn').onclick = () => { $('#admCmdPaletteModal').hidden = true; };
    }
    if ($('#admCmdPaletteBg')) {
      $('#admCmdPaletteBg').onclick = () => { $('#admCmdPaletteModal').hidden = true; };
    }
    if ($('#admCmdSearchInput')) {
      $('#admCmdSearchInput').oninput = e => renderCommandPaletteResults(e.target.value);
    }
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const modal = $('#admCmdPaletteModal');
        if (modal && !modal.hidden) modal.hidden = true;
        else openCommandPalette();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if ($('#adminApp') && !$('#adminApp').hidden) {
          e.preventDefault();
          if ($('#animeEditModal') && !$('#animeEditModal').hidden) {
            saveAnimeFromModal();
          } else {
            $('#previewApplyBtn')?.click();
          }
        }
      } else if (e.key === 'Escape') {
        if ($('#admCmdPaletteModal') && !$('#admCmdPaletteModal').hidden) {
          $('#admCmdPaletteModal').hidden = true;
        }
      }
    });

    $('#admAnimeSearch').oninput = e => { state.animeFilterQ = e.target.value; renderAnimeAdminPanel(); };
    $('#admAnimeStatusFilter').onchange = e => { state.animeFilterStatus = e.target.value; renderAnimeAdminPanel(); };
    $('#admAnimeSourceFilter').onchange = e => { state.animeFilterSource = e.target.value; renderAnimeAdminPanel(); };
    if ($('#admAnimeSortSelect')) {
      $('#admAnimeSortSelect').onchange = e => { state.animeSortMode = e.target.value; renderAnimeAdminPanel(); };
    }

    $('#openRapidQueueFromAnimeBtn').onclick = () => {
      const targetType = state.activeAdminMediaType || 'anime';
      if ($('#rqContentTypeSelect')) $('#rqContentTypeSelect').value = targetType;
      state.rapidQueue.activeType = targetType;
      switchAdminPanel('rapid');
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
      if (state.rapidQueue.draftItem) {
        const activeType = state.rapidQueue.activeType || 'anime';
        state.activeAdminMediaType = activeType;
        if ($('#admMediaTypeSelect')) $('#admMediaTypeSelect').value = activeType;
        renderAnimeAdminPanel();
        openAnimeEditor(state.rapidQueue.draftItem.id);
      }
    };
    $('#rqFavoriteBtn').onclick = () => {
      const d = state.rapidQueue.draftItem;
      if (!d) return;
      const adapter = getActiveAdapter();
      d.favorite = !d.favorite;
      if (!d.favorite) delete d.favorite;
      const favBtn = $('#rqFavoriteBtn');
      favBtn.classList.toggle('on', Boolean(d.favorite));
      if (adapter.id === 'guide') {
        favBtn.textContent = d.favorite ? '★ Öne Çıkan Rehber (Seçili)' : '☆ Öne Çıkan İşaretle';
      } else {
        favBtn.textContent = d.favorite ? '★ Başyapıt (Seçili)' : '☆ Başyapıt İşaretle';
      }
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
            if (Array.isArray(info.genres) && info.genres.length) {
              const curG = Array.isArray(d.customGenres) ? d.customGenres : [];
              const merged = [...new Set([...curG, ...info.genres])];
              d.customGenres = merged;
              d.genres = merged;
              if ($('#rqGenresInput')) $('#rqGenresInput').value = merged.join(', ');
              if (typeof renderRapidQueueGenres === 'function') renderRapidQueueGenres();
            }
            if (Array.isArray(info.parts) && info.parts.length) {
              d.parts = info.parts;
              renderRapidQueueSubItems();
              syncRapidQueueScoreBadge();
            }
            const cands = Array.isArray(info.coverCandidates) ? info.coverCandidates : [];
            state.rqCoverCandidates = cands;
            if (cands.length > 0) {
              renderCoverPickerDrawer('rq', cands, d.title || rawInput);
            }
            toast(`${adapter.label} bilgileri ve ${cands.length || 1} kapak görseli çekildi!`);
          }
        } catch (err) {
          toast('Veri çekilemedi: ' + err.message, 'err');
        } finally {
          btn.disabled = false;
          btn.textContent = origTxt;
        }
        return;
      }
      let parsed = parseAnilistUrlOrId($('#rqExternalUrlInput').value.trim() || d.anilistId || d.id);
      if (!parsed.id && !rawInput) {
        toast('Lütfen geçerli bir AniList linki veya anime başlığı girin.', 'warn');
        return;
      }
      const btn = $('#rqFetchRelationsBtn');
      const origBtnTxt = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Çekiliyor...';
      try {
        let extraSearch = [];
        if (!parsed.id) {
          const matches = await ExternalCatalogFetcher.searchAnilistAnime(rawInput);
          if (!matches.length) throw new Error('Eşleşen anime bulunamadı.');
          parsed = { id: matches[0].id, url: 'https://anilist.co/anime/' + matches[0].id };
          extraSearch = matches.slice(1);
          d.anilistId = parsed.id;
          d.firstSeasonUrl = parsed.url;
          d.url = parsed.url;
          $('#rqExternalUrlInput').value = parsed.url;
        }
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
        const cands = ExternalCatalogFetcher.buildAnimeCoverCandidates(sorted, parsed.id, extraSearch);
        state.rqCoverCandidates = cands;
        if (cands.length > 0) {
          if (!d.image) {
            d.image = cands[0].url;
            $('#rqPosterImg').src = resolvePreviewSrc(cands[0].url);
          }
          renderCoverPickerDrawer('rq', cands, d.title || rawInput || '');
        }
        renderRapidQueueSubItems();
        syncRapidQueueScoreBadge();
        toast(`${sorted.length} bağlantılı içerik ve ${cands.length} sezon/film kapağı çekildi.`);
      } catch (err) {
        toast('Bağlantılı içerik hatası: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = origBtnTxt;
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
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        commitCurrentRapidQueueDraft(true);
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        $('#rqSkipBtn').click();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        $('#rqPrevBtn').click();
      } else if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === '1') {
          const btn = $('#rqCriteriaStudioMount')?.querySelector('[data-prof="action"]');
          if (btn) { e.preventDefault(); btn.click(); }
        } else if (e.key === '2') {
          const btn = $('#rqCriteriaStudioMount')?.querySelector('[data-prof="story"]');
          if (btn) { e.preventDefault(); btn.click(); }
        } else if (e.key === '3') {
          const btn = $('#rqCriteriaStudioMount')?.querySelector('[data-prof="character"]');
          if (btn) { e.preventDefault(); btn.click(); }
        } else if (e.key === '4') {
          const btn = $('#rqCriteriaStudioMount')?.querySelector('[data-prof="balanced"]');
          if (btn) { e.preventDefault(); btn.click(); }
        }
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
                    store.stats = parsedGuides.stats || computeMediaStatsClient(items, state.animeData.statsConfig, 'guide');
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

      if (adapter.id === 'anime') {
        try {
          await AdminSecurity.githubTriggerWorkflow('sync-anilist.yml', { sync_mode: 'relations_only' });
          toast('GitHub Actions (AniList ve yan içerik senkronu) başarıyla tetiklendi!');
        } catch (err) {
          toast(err.message, 'err');
        }
      } else {
        // [AI-MIMARI-NOTU: ADIM 9 — DİZİ, FİLM, KİTAP, MANGA WORKFLOW TETİKLEME]
        try {
          if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ GitHub Actions Tetikleniyor...';
          }
          await AdminSecurity.githubTriggerWorkflow('sync-multimedia.yml', { force_sync: 'true' });
          toast(`GitHub Actions (sync-multimedia.yml - ${adapter.label}) başarıyla tetiklendi!`);
        } catch (err) {
          toast(err.message, 'err');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = `⚡ Çoklu API Senkronu (${adapter.label} · sync-multimedia.yml)`;
          }
        }
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
    if ($('#exportAllAnimePostsBtn')) {
      $('#exportAllAnimePostsBtn').onclick = () => {
        switchAdminPanel('instagram');
        if (window.AdminInstagram && typeof window.AdminInstagram.openBatchExportModal === 'function') {
          window.AdminInstagram.openBatchExportModal('anime');
        }
      };
    }
    if ($('#openCommitRecoveryBtn')) {
      $('#openCommitRecoveryBtn').onclick = () => {
        switchAdminPanel('health');
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
    if ($('#copyActiveSectionJsonBtn')) $('#copyActiveSectionJsonBtn').onclick = copyActiveSectionJsonToClipboard;
    $('#restoreSnapshotBtn').onclick = restoreFullBackupSnapshot;
    initToolsAndMaintenanceModule();

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
      const mType = state.activeAdminMediaType || 'anime';
      if (mType !== 'anime' && mType !== 'manga') return;
      const parsed = parseAnilistUrlOrId($('#aeFirstSeasonUrl').value, mType);
      if (parsed.id) $('#aeAnilistId').value = parsed.id;
    };
    $('#aeAnilistId').oninput = () => {
      const mType = state.activeAdminMediaType || 'anime';
      if (mType !== 'anime' && mType !== 'manga') return;
      const parsed = parseAnilistUrlOrId($('#aeAnilistId').value, mType);
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
    if ($('#aeOpenCoverPickerBtn')) {
      $('#aeOpenCoverPickerBtn').onclick = () => openAndFetchCoverPicker('modal');
    }
    const aeCoverBox = $('#aeCoverPreview')?.closest('.anime-edit-cover');
    if (aeCoverBox) {
      aeCoverBox.onclick = () => openAndFetchCoverPicker('modal');
    }
    if ($('#rqOpenCoverPickerBtn')) {
      $('#rqOpenCoverPickerBtn').onclick = () => openAndFetchCoverPicker('rq');
    }

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
      const adapter = getActiveAdminAdapter();
      if (!Array.isArray(state.editingDraft.parts)) state.editingDraft.parts = [];
      const n = state.editingDraft.parts.length + 1;
      const pName = adapter.id === 'book'
        ? `${n}. Kitap / Cilt`
        : adapter.id === 'manga'
          ? `${n}. Cilt / Kısım`
          : adapter.id === 'movie'
            ? `${n}. Film`
            : `${n}. Sezon`;
      const pFormat = adapter.id === 'book' ? 'BOOK' : adapter.id === 'manga' ? 'MANGA' : adapter.id === 'movie' ? 'MOVIE' : 'TV';
      const pEps = adapter.id === 'book' ? 300 : adapter.id === 'movie' ? 1 : adapter.id === 'manga' ? 20 : 12;
      state.editingDraft.parts.push({
        id: 'part-' + Date.now() + '-' + n,
        name: pName,
        kind: adapter.id === 'movie' ? 'movie' : 'season',
        format: pFormat,
        episodes: pEps,
        watched: pEps,
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

    // Düğüm (Node), Özel Kutucuk ve Bağlantı Olayları
    $('#addCategoryBtn').onclick = () => {
      const newId = 'bolum-' + (state.config.sections.length + 1);
      state.config.sections.push({
        id: newId,
        title: 'Yeni Bölüm',
        path: newId + '/',
        description: 'Yakında',
        subtitle: '',
        data: '',
        countKey: '',
        unit: 'içerik',
        status: 'soon',
        icon: 'sparkle',
        showStrip: true
      });
      renderNodesManager();
      markDirty('config');
      openNodeEditor(newId);
      toast('Yeni düğüm eklendi: "Yeni Bölüm". Ayarları düzenleyebilirsiniz.');
    };

    $$('[data-tpl-sec]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.tplSec;
        const tpl = SECTION_TEMPLATES[key];
        if (!tpl) return;
        if (state.config.sections.some(s => s.id === tpl.id)) {
          toast(`${tpl.title} düğümü zaten listede mevcut.`, 'warn');
          return;
        }
        state.config.sections.push(structuredClone(tpl));
        renderNodesManager();
        markDirty('config');
        openNodeEditor(tpl.id);
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
        const summaries = {
          anime: {
            nums: [[S.anime || (state.animeData.anime || []).length, 'anime'], [S.season || 0, 'sezon'], [S.film || 0, 'film'], [S.episodes || 0, 'bölüm']],
            imgs: (state.animeData.anime || []).map(x => x.image).filter(Boolean).slice(0, 4)
          }
        };
        for (const mKey of ['guide', 'series', 'movie', 'manga', 'book', 'project']) {
          const stStore = ensureMultiMediaStore(mKey);
          const mItems = stStore.items || [];
          const mStats = computeMediaStatsClient(mItems, state.animeData.statsConfig, mKey);
          if (mKey === 'guide') {
            summaries.guide = {
              nums: [[mItems.length, 'rehber'], ...((mStats.genres && mStats.genres.length) ? [[mStats.genres.length, 'kategori']] : [])],
              imgs: []
            };
          } else if (mKey === 'project') {
            summaries.project = {
              nums: [[mItems.length, 'proje'], [mItems.filter(p => p.isFork).length, 'çatal']],
              imgs: []
            };
          } else if (mKey === 'series') {
            summaries.series = {
              nums: [[mStats.watched || mItems.length, 'dizi'], [mStats.seasons || 0, 'sezon'], [mStats.episodes || 0, 'bölüm']],
              imgs: mItems.map(x => x.image).filter(Boolean).slice(0, 4)
            };
          } else if (mKey === 'movie') {
            summaries.movie = {
              nums: [[mStats.watched || mItems.length, 'film'], ...(mStats.avgScore ? [[mStats.avgScore, 'ort. puan']] : [])],
              imgs: mItems.map(x => x.image).filter(Boolean).slice(0, 4)
            };
          } else if (mKey === 'manga') {
            summaries.manga = {
              nums: [[mStats.read || mItems.length, 'manga'], [mStats.chapters || 0, 'bölüm']],
              imgs: mItems.map(x => x.image).filter(Boolean).slice(0, 4)
            };
          } else if (mKey === 'book') {
            summaries.book = {
              nums: [[mStats.read || mItems.length, 'kitap'], [mStats.pages || 0, 'sayfa']],
              imgs: mItems.map(x => x.image).filter(Boolean).slice(0, 4)
            };
          }
        }
        localStorage.setItem('ui2', JSON.stringify({ d: state.config, s: summaries }));
      } catch (e) {}
      $('#clearPreviewBtn').hidden = false;
      toast('Tüm site ve medya değişiklikleri canlı önizlemeye uygulandı!');
    };

    $('#clearPreviewBtn').onclick = () => {
      localStorage.removeItem('tp_site_preview');
      localStorage.removeItem('tp_anime_preview');
      localStorage.removeItem('tp_multimedia_preview');
      localStorage.removeItem('ui2');
      $('#clearPreviewBtn').hidden = true;
      loadAllData();
      toast('Canlı önizleme sıfırlandı ve güncel depo verileri yüklendi.');
    };

    $('#downloadJsonBtn').onclick = () => {
      collectFormFieldsIntoConfig();
      downloadBlobJson(state.config, 'sections.json');
      toast('sections.json indirildi.');
    };

    $('#commitGithubBtn').onclick = handleCommitClick;
    const commitDiffModal = $('#commitDiffModal');
    const closeCommitModal = () => {
      const confirmBtn = $('#confirmCommitDiffBtn');
      if (confirmBtn && confirmBtn.disabled) return;
      if (commitDiffModal) commitDiffModal.hidden = true;
    };
    if ($('#closeCommitDiffModalBtn')) $('#closeCommitDiffModalBtn').onclick = closeCommitModal;
    if ($('#cancelCommitDiffBtn')) $('#cancelCommitDiffBtn').onclick = closeCommitModal;
    if ($('#commitDiffModalBg')) $('#commitDiffModalBg').onclick = closeCommitModal;
    if ($('#confirmCommitDiffBtn')) $('#confirmCommitDiffBtn').onclick = executeCommitProcess;

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
    const resetBtn = $('#resetDeviceVaultBtn');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        await AdminSecurity.clearDeviceVault();
        AdminSecurity.clearLocalVault();
        AdminSecurity.lockSession('Tarayıcıdaki kayıtlı GitHub Token silindi.');
      };
    }
  }

  function onSessionUnlocked(sessionInfo) {
    renderAdminApp();
    $('#authGate').hidden = true;
    $('#adminApp').hidden = false;
    $('#lockBtn').hidden = false;
    const badge = $('#sessionBadge');
    badge.hidden = false;
    badge.textContent = `Açık · ${sessionInfo.username}`;
    if ($('#activeUserLabel')) $('#activeUserLabel').textContent = sessionInfo.username;
    if ($('#acpBranchLabel')) $('#acpBranchLabel').textContent = sessionInfo.branch || 'main';

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
    const loginInput = $('#loginPatInput');
    if (loginInput) loginInput.value = '';
    state.verifiedSetupContext = null;
    if (reason) showAuthAlert(reason);
    initAuthGate();
  });

  const savedBtn = $('#savedTokenLoginBtn');
  if (savedBtn) {
    savedBtn.onclick = async () => {
      showAuthAlert('');
      savedBtn.disabled = true;
      savedBtn.textContent = 'Doğrulanıyor...';
      try {
        const info = await AdminSecurity.unlockWithSavedToken();
        toast('Hoş geldiniz!');
        onSessionUnlocked(info);
      } catch (err) {
        showAuthAlert(err.message);
        $('#deviceReadyBox').hidden = true;
        $('#tokenEntryBox').hidden = false;
        setTimeout(() => { const inp = $('#loginPatInput'); if (inp) inp.focus(); }, 50);
      } finally {
        savedBtn.disabled = false;
        savedBtn.textContent = 'Kayıtlı Token ile Giriş Yap';
      }
    };
  }

  const showManualBtn = $('#showManualTokenBtn');
  if (showManualBtn) {
    showManualBtn.onclick = () => {
      showAuthAlert('');
      $('#deviceReadyBox').hidden = true;
      $('#tokenEntryBox').hidden = false;
      setTimeout(() => { const inp = $('#loginPatInput'); if (inp) inp.focus(); }, 50);
    };
  }

  const formTokenLogin = $('#formTokenLogin');
  if (formTokenLogin) {
    formTokenLogin.onsubmit = async e => {
      e.preventDefault();
      showAuthAlert('');
      const pat = $('#loginPatInput').value.trim();
      const repoOwner = AdminSecurity.sanitizeText($('#tokenRepoOwner').value, 80) || 'tempestian';
      const repoName = AdminSecurity.sanitizeText($('#tokenRepoName').value, 100) || 'tempestian.github.io';
      const branch = AdminSecurity.sanitizeText($('#tokenBranch').value, 80) || 'main';
      const remember = $('#rememberMe').checked;

      const submitBtn = $('#tokenLoginSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Doğrulanıyor...';
      try {
        const info = await AdminSecurity.unlockWithPat(pat, repoOwner, repoName, branch, remember);
        toast('Giriş başarılı. Hoş geldiniz!');
        onSessionUnlocked(info);
      } catch (err) {
        showAuthAlert(err.message);
        $('#loginPatInput').select();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Doğrula ve Giriş Yap';
      }
    };
  }

  $('#lockBtn').onclick = () => {
    AdminSecurity.lockSession('Oturum kapatıldı.');
  };

  initAuthGate();

  // [AI-MIMARI-NOTU]: Masaüstünde (PC) `.chips`, `.dock` ve `.rq-strip` gibi yatay şeritlerin
  // hem fareyle basılı tutup sürükleyerek (drag-to-scroll) hem de fare tekerleğiyle (wheel)
  // kaydırılabilmesini sağlayan evrensel olay dinleyicisi.
  (() => {
    const SELECTOR = '.chips, .dock, .rq-strip, .anime-stats-bar, .criteria-profiles-bar, .tag-group-chips, .template-chips, .sh-rb-tabs';

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

})();
