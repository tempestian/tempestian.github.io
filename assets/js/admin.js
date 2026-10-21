// ============================================================================
// [AI-MIMARI-NOTU: TEMPESTIAN YÖNETİM PANELİ VE GENİŞLETİLEBİLİR İÇERİK MOTORU]
// Bu dosya Adım 1, 2, 3, 4, 5 ve 6 kapsamında şu modülleri yönetir:
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
//           animeler için toplu sorgulanıp site verilerine çekilmesi ve GitHub Actions
//           iş akışıyla (`scripts/sync-anilist.mjs`) tam uyumlu çalıştırılması.
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

  const KNOWN_GENRES = [
    ['Action', 'Aksiyon'], ['Adventure', 'Macera'], ['Comedy', 'Komedi'], ['Drama', 'Drama'],
    ['Ecchi', 'Ecchi'], ['Fantasy', 'Fantastik'], ['Horror', 'Korku'], ['Mahou Shoujo', 'Büyülü Kız'],
    ['Mecha', 'Mecha'], ['Music', 'Müzik'], ['Mystery', 'Gizem'], ['Psychological', 'Psikolojik'],
    ['Romance', 'Romantik'], ['Sci-Fi', 'Bilim Kurgu'], ['Slice of Life', 'Günlük Yaşam'],
    ['Sports', 'Spor'], ['Supernatural', 'Doğaüstü'], ['Thriller', 'Gerilim']
  ];

  const STATUS_LABELS = {
    watching: 'İzleniyor',
    completed: 'İzlendi',
    paused: 'Beklemede',
    dropped: 'Bırakıldı',
    planned: 'Planlandı'
  };

  // [AI-MIMARI-NOTU]: İlk sezon AniList URL'sinden ("https://anilist.co/anime/101280/...")
  // veya doğrudan girilen sayıdan AniList ID ve standart URL üreten yardımcı fonksiyon.
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
    animeData: { schemaVersion: 3, updated: '', source: 'anilist:TurkTempestian', stats: {}, anime: [] },
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
    editingAnimeId: null,
    editingDraft: null
  };

  // [AI-MIMARI-NOTU]: scripts/stats.mjs ile birebir aynı istatistik hesaplama motoru.
  function computeStatsClient(animeList) {
    const eps = a => (a.parts || []).reduce((n, p) => n + (p.watched || 0), 0);
    const reps = a => Math.max(0, ...(a.parts || []).map(p => p.repeat || 0));
    const rank = (list, key) => [...list].sort((a, b) => key(b) - key(a) || eps(b) - eps(a) || (a.title || '').localeCompare(b.title || '', 'tr'))[0];

    const stats = { anime: 0, season: 0, film: 0, other: 0, episodes: 0, avgScore: null, byStatus: {} };
    const counted = [];
    for (const a of animeList) {
      stats.byStatus[a.status] = (stats.byStatus[a.status] || 0) + 1;
      const done = (a.parts || []).filter(p => p.status === 'COMPLETED' && (p.watched || 0) > 0);
      if (!done.length) continue;
      stats.anime++;
      counted.push(a);
      for (const p of done) {
        stats[p.kind === 'season' ? 'season' : p.kind === 'movie' ? 'film' : 'other']++;
        stats.episodes += p.watched || 0;
      }
    }
    stats.listed = animeList.length;
    stats.completed = counted.filter(a => a.status === 'completed').length;
    stats.partial = counted.length - stats.completed;
    stats.excluded = animeList.length - counted.length;
    const rated = counted.filter(a => a.score);
    if (rated.length) stats.avgScore = Math.round(rated.reduce((n, a) => n + a.score, 0) / rated.length * 10) / 10;

    const hl = {};
    if (rated.length) {
      const t = rank(rated, a => a.score);
      hl.topScore = { id: t.id, title: t.title, score: t.score, ties: rated.filter(a => a.score === t.score).length - 1 };
    }
    const w = rank(animeList.filter(a => eps(a) > 0), eps);
    if (w) hl.mostWatched = { id: w.id, title: w.title, episodes: eps(w), status: w.status };
    const r = animeList.filter(a => reps(a) > 0);
    if (r.length) {
      const t = rank(r, reps);
      hl.mostRewatched = { id: t.id, title: t.title, times: reps(t) + 1 };
    }
    if (Object.keys(hl).length) stats.highlights = hl;
    return stats;
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

  function updateDirtyIndicator() {
    const anyDirty = state.dirtyConfig || state.dirtyAnime || state.dirtyOverrides || state.pendingUploads.size > 0;
    const ind = $('#dirtyIndicator');
    if (ind) ind.hidden = !anyDirty;
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
        <button type="button" class="nav-tab" role="tab" data-panel="anime" aria-selected="true">Anime &amp; Kurallar</button>
        <button type="button" class="nav-tab" role="tab" data-panel="texts" aria-selected="false">Metinler &amp; Sayfalar</button>
        <button type="button" class="nav-tab" role="tab" data-panel="images" aria-selected="false">Görseller &amp; İkonlar</button>
        <button type="button" class="nav-tab" role="tab" data-panel="categories" aria-selected="false">Kategoriler (Bölümler)</button>
        <button type="button" class="nav-tab" role="tab" data-panel="boxes" aria-selected="false">Kutucuklar &amp; Bağlantılar</button>
        <button type="button" class="nav-tab" role="tab" data-panel="security" aria-selected="false">Profil &amp; Güvenlik</button>
      </nav>

      <!-- ADIM 3, 4, 5 & 6: ANİME YÖNETİMİ, İLK SEZON ANILIST LİNKİ VE YAN İÇERİK KEŞFİ -->
      <div id="panelAnime" class="admin-panel">
        <div class="admin-card glass sq">
          <div class="card-head split-head">
            <div>
              <h2>Anime Verileri ve Bağlantılı İçerik Yönetimi</h2>
              <p>Her anime için <b>İlk Sezonun AniList Linki</b> üzerinden tüm bağlantılı sezon, film ve yan içerikler (OVA, ONA, Özel Bölüm) hem buradan hem de GitHub Actions betiğiyle otomatik çekilir.</p>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-subtle" id="scanAllRelationsBtn" title="Listedeki animelerin İlk Sezon AniList Linklerini tarayarak eksik sezon, film ve yan içerikleri AniList'ten çeker">Yan İçerikleri Sorgula</button>
              <button type="button" class="btn-subtle" id="triggerActionsBtn" title="GitHub Actions üzerindeki sync-anilist.yml iş akışını tetikler">GitHub Actions Çalıştır</button>
              <button type="button" class="btn-subtle" id="toggleOverridesBtn">Senkron Kuralları (overrides.json)</button>
              <button type="button" class="btn-subtle" id="downloadAnimeJsonBtn">anime.json İndir</button>
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

          <!-- ANİME ARAMA VE FİLTRELEME -->
          <div class="field-row">
            <label class="field" style="flex:2">
              <span>Anime Ara (Başlık, ID veya AniList URL)</span>
              <input type="search" id="admAnimeSearch" class="inp glass" placeholder="Örn: Slime, One Piece, 101280...">
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
              </select>
            </label>
            <label class="field">
              <span>Kaynak / Düzenleme Filtresi</span>
              <select id="admAnimeSourceFilter" class="inp glass">
                <option value="all">Tümü</option>
                <option value="manual">Elle Eklenenler (manual)</option>
                <option value="modified">Admin Düzenlemeli</option>
                <option value="anilist">Standart AniList</option>
              </select>
            </label>
          </div>

          <div id="animeAdminList" class="anime-admin-list"></div>
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

      <!-- ADIM 5: ANİME EKLEME / DÜZENLEME MODALI (İLK SEZON ANILIST LİNKİ ALANI İLE) -->
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
                  <span>Anime Başlığı (title)</span>
                  <input type="text" id="aeTitle" class="inp glass" placeholder="Örn: Solo Leveling" required>
                </label>
                <label class="field">
                  <span>Çözümlenen AniList ID</span>
                  <input type="number" id="aeAnilistId" class="inp glass" placeholder="Örn: 151807">
                </label>
              </div>
              <div class="field-row align-end">
                <label class="field" style="flex:2">
                  <span>İlk Sezonun AniList Linki (URL)</span>
                  <input type="url" id="aeFirstSeasonUrl" class="inp glass" placeholder="https://anilist.co/anime/101280/...">
                  <small>Animenin 1. sezonunun AniList URL'sini girin. Hem buradan hem de GitHub Actions betiği çalıştığında bağlantılı sezon, film ve yan içerikler bu link üzerinden bulunup siteye çekilir.</small>
                </label>
                <button type="button" class="btn-secondary" id="fetchAnilistMetaBtn" title="İlk sezonun AniList linkinden kapak görselini, sezonları, filmleri ve yan içerikleri sorgular">Linkten Bağlantılı Animeleri Çek</button>
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
                  <span>Puan (10 Üzerinden)</span>
                  <input type="number" id="aeScore" class="inp glass" step="0.1" min="0" max="10" placeholder="Örn: 8.5">
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
              </div>
            </div>
          </div>

          <div class="field">
            <span>Türler (Seçmek için tıklayın veya virgülle ekleyin)</span>
            <div id="aeGenreChips" class="template-chips"></div>
            <input type="text" id="aeGenresInput" class="inp glass" placeholder="Action, Fantasy, Adventure">
          </div>

          <div class="field-stack">
            <div class="split-head">
              <div>
                <h4>Bağlantılı İçerikler / Parçalar (Sezon, Film, Yan İçerik / OVA)</h4>
                <p class="meta">İlk sezon linkini girip kaydettiğinizde veya yukarıdaki "Linkten Bağlantılı Animeleri Çek" butonuna bastığınızda tüm sezon, film ve yan içerikler buraya eklenir.</p>
              </div>
              <button type="button" class="btn-secondary" id="addPartBtn">+ Parça (Sezon/Film/Yan İçerik) Ekle</button>
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
      }
      state.animeData = rawAnime;
      if (!state.animeData.stats) state.animeData.stats = computeStatsClient(state.animeData.anime);
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

    const list = state.animeData.anime || [];
    state.animeData.stats = computeStatsClient(list);
    const S = state.animeData.stats;
    const manualCount = list.filter(a => a.source === 'manual' || String(a.id).startsWith('custom-')).length;
    const modCount = list.filter(a => a.adminModified).length;

    statsBar.innerHTML = `
      <div class="adm-stat-pill"><b>${list.length}</b><span>Toplam Kayıt</span></div>
      <div class="adm-stat-pill"><b>${S.anime || 0}</b><span>Sayılan Anime</span></div>
      <div class="adm-stat-pill"><b>${S.season || 0}</b><span>Sezon</span></div>
      <div class="adm-stat-pill"><b>${S.film || 0}</b><span>Film</span></div>
      <div class="adm-stat-pill"><b>${S.episodes || 0}</b><span>Bölüm</span></div>
      <div class="adm-stat-pill"><b>${S.avgScore ?? '-'}</b><span>Ort. Puan</span></div>
      <div class="adm-stat-pill"><b>${manualCount} / ${modCount}</b><span>Elle / Düzenlenen</span></div>
    `;

    const q = state.animeFilterQ.trim().toLocaleLowerCase('tr');
    const stF = state.animeFilterStatus;
    const srcF = state.animeFilterSource;

    const filtered = list.filter(it => {
      if (q && !(it.title || '').toLocaleLowerCase('tr').includes(q) && !String(it.id || '').toLowerCase().includes(q) && !String(it.anilistId || '').includes(q) && !String(it.firstSeasonUrl || '').toLowerCase().includes(q)) return false;
      if (stF !== 'all') {
        if (stF === 'next' && !it.next) return false;
        if (stF !== 'next' && it.status !== stF) return false;
      }
      if (srcF !== 'all') {
        const isManual = it.source === 'manual' || String(it.id).startsWith('custom-');
        if (srcF === 'manual' && !isManual) return false;
        if (srcF === 'modified' && !it.adminModified) return false;
        if (srcF === 'anilist' && (isManual || it.adminModified)) return false;
      }
      return true;
    });

    listEl.replaceChildren();
    if (!filtered.length) {
      const p = document.createElement('p');
      p.className = 'help-txt';
      p.textContent = 'Filtreye uygun anime bulunamadı.';
      listEl.append(p);
      return;
    }

    const fr = document.createDocumentFragment();
    for (const it of filtered) {
      const row = document.createElement('div');
      row.className = 'anime-adm-row';
      const isManual = it.source === 'manual' || String(it.id).startsWith('custom-');
      const parts = it.parts || [];
      const doneEps = parts.reduce((n, p) => n + (p.watched || 0), 0);
      const firstUrl = it.firstSeasonUrl || it.url || (it.anilistId ? 'https://anilist.co/anime/' + it.anilistId : '');

      row.innerHTML = `
        <img class="anime-adm-poster" alt="" loading="lazy">
        <div class="anime-adm-info">
          <div class="anime-adm-title">
            <span class="adm-row-t"></span>
            <span class="src-badge ${isManual ? 'manual' : it.adminModified ? 'modified' : ''}">${isManual ? 'Elle Eklendi' : it.adminModified ? 'Admin Düzenlemeli' : 'AniList'}</span>
            ${it.next ? '<span class="src-badge next">Devam edilecek</span>' : ''}
          </div>
          <div class="anime-adm-sub">
            <span>Durum: <b>${STATUS_LABELS[it.status] || it.status}</b></span>
            <span>Puan: <b>${it.score ? '★ ' + it.score : 'Puansız'}</b></span>
            <span>Parça: <b>${parts.length}</b> (${doneEps} izlenen bölüm)</span>
            <span class="adm-url-slot"></span>
          </div>
        </div>
        <div class="editor-item-actions">
          <button type="button" class="btn-subtle adm-edit-btn">Düzenle</button>
          <button type="button" class="icon-btn del adm-del-btn" title="Sil / Hariç Tut">✕</button>
        </div>
      `;
      const img = row.querySelector('.anime-adm-poster');
      if (it.image) img.src = resolvePreviewSrc(it.image);
      row.querySelector('.adm-row-t').textContent = it.title;
      const urlSlot = row.querySelector('.adm-url-slot');
      if (firstUrl) {
        const a = document.createElement('a');
        a.href = firstUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = `1. Sezon Linki (#${it.anilistId || 'URL'})`;
        a.style.color = 'var(--accent)';
        urlSlot.append(a);
      } else {
        urlSlot.textContent = 'AniList Linki Yok (Salt Yerel)';
      }
      row.querySelector('.adm-edit-btn').onclick = () => openAnimeEditor(it.id);
      row.querySelector('.adm-del-btn').onclick = () => deleteAnimeItem(it.id);
      fr.append(row);
    }
    listEl.append(fr);
  }

  function deleteAnimeItem(animeId) {
    const idx = state.animeData.anime.findIndex(a => a.id === animeId);
    if (idx < 0) return;
    const target = state.animeData.anime[idx];
    state.animeData.anime.splice(idx, 1);
    if (target.anilistId && !state.overrides.exclude.includes(Number(target.anilistId))) {
      state.overrides.exclude.push(Number(target.anilistId));
      markDirty('overrides');
    }
    if (!state.overrides.deletedIds.includes(target.id)) {
      state.overrides.deletedIds.push(target.id);
      markDirty('overrides');
    }
    markDirty('anime');
    renderAnimeAdminPanel();
    renderOverridesEditor();
    toast(`"${target.title}" listeden kaldırıldı ve tekrar senkronlanmaması için hariç tutulanlara eklendi.`);
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
    state.editingAnimeId = animeId;
    const isNew = animeId === '__new__';
    const existing = !isNew ? state.animeData.anime.find(a => a.id === animeId) : null;

    state.editingDraft = existing ? structuredClone(existing) : {
      id: 'custom-' + Date.now(),
      title: '',
      anilistId: null,
      url: '',
      firstSeasonUrl: '',
      status: 'completed',
      score: null,
      genres: [],
      image: '',
      addedAt: new Date().toISOString().slice(0, 10),
      source: 'manual',
      adminModified: true,
      lockedFields: ['title', 'status', 'score', 'genres', 'addedAt'],
      parts: [
        {
          id: 'part-' + Date.now(),
          name: '1. Sezon',
          kind: 'season',
          format: 'TV',
          episodes: 12,
          watched: 12,
          status: 'COMPLETED',
          release: 'FINISHED',
          year: new Date().getFullYear(),
          adminModified: true
        }
      ]
    };

    const d = state.editingDraft;
    const parsed = parseAnilistUrlOrId(d.firstSeasonUrl || d.url || d.anilistId || d.id);
    const initialUrl = d.firstSeasonUrl || parsed.url || '';

    $('#animeModalTitle').textContent = isNew ? 'Yeni Anime Ekle (İlk Sezon AniList Linki veya Elle)' : `Anime Düzenle: ${d.title}`;
    $('#aeTitle').value = d.title || '';
    $('#aeFirstSeasonUrl').value = initialUrl;
    $('#aeAnilistId').value = parsed.id || '';
    $('#aeImage').value = d.image || '';
    $('#aeCoverPreview').src = d.image ? resolvePreviewSrc(d.image) : '';
    $('#aeStatus').value = d.status || 'completed';
    $('#aeScore').value = d.score != null ? d.score : '';
    $('#aeNext').value = d.next === true ? 'yes' : d.next === false ? 'no' : 'auto';
    $('#aeAddedAt').value = d.addedAt || new Date().toISOString().slice(0, 10);
    $('#aeGenresInput').value = (d.genres || []).join(', ');
    $('#deleteAnimeModalBtn').hidden = isNew;

    renderAnimeGenreChips();
    renderAnimePartsEditor();
    $('#animeEditModal').hidden = false;
  }

  function renderAnimeGenreChips() {
    const wrap = $('#aeGenreChips');
    if (!wrap) return;
    wrap.replaceChildren();
    const curGenres = new Set(
      ($('#aeGenresInput').value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );
    for (const [en, tr] of KNOWN_GENRES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-chip' + (curGenres.has(en) ? ' on' : '');
      btn.textContent = `${tr} (${en})`;
      btn.onclick = () => {
        const set = new Set(
          ($('#aeGenresInput').value || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        );
        if (set.has(en)) set.delete(en);
        else set.add(en);
        $('#aeGenresInput').value = [...set].join(', ');
        renderAnimeGenreChips();
      };
      wrap.append(btn);
    }
  }

  function renderAnimePartsEditor() {
    const wrap = $('#aePartsList');
    if (!wrap || !state.editingDraft) return;
    wrap.replaceChildren();
    const parts = state.editingDraft.parts || [];

    parts.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'part-edit-row';
      row.innerHTML = `
        <div class="part-edit-head">
          <span>#${idx + 1} · ${AdminSecurity.sanitizeText(p.name || 'Parça', 80)}</span>
          <div class="editor-item-actions">
            <button type="button" class="icon-btn" data-pact="up" title="Yukarı">↑</button>
            <button type="button" class="icon-btn" data-pact="down" title="Aşağı">↓</button>
            <button type="button" class="icon-btn del" data-pact="del" title="Parçayı Sil">✕</button>
          </div>
        </div>
        <div class="field-row">
          <label class="field" style="flex:2">
            <span>Parça Adı (name)</span>
            <input type="text" class="inp glass" data-pf="name" placeholder="1. Sezon">
          </label>
          <label class="field">
            <span>Parça ID (AniList / Özel)</span>
            <input type="text" class="inp glass" data-pf="id">
          </label>
          <label class="field">
            <span>Tür (kind)</span>
            <select class="inp glass" data-pf="kind">
              <option value="season">Sezon (season)</option>
              <option value="movie">Film (movie)</option>
              <option value="other">Yan İçerik / OVA (other)</option>
            </select>
          </label>
          <label class="field">
            <span>Format</span>
            <select class="inp glass" data-pf="format">
              <option value="TV">TV</option>
              <option value="ONA">ONA</option>
              <option value="MOVIE">MOVIE</option>
              <option value="OVA">OVA</option>
              <option value="SPECIAL">SPECIAL</option>
              <option value="TV_SHORT">TV_SHORT</option>
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span>İzleme Durumu</span>
            <select class="inp glass" data-pf="status">
              <option value="COMPLETED">İzlendi (COMPLETED)</option>
              <option value="CURRENT">İzleniyor (CURRENT)</option>
              <option value="PAUSED">Beklemede (PAUSED)</option>
              <option value="DROPPED">Bırakıldı (DROPPED)</option>
              <option value="PLANNING">Planlandı (PLANNING)</option>
              <option value="NONE">İzlenmedi (NONE)</option>
            </select>
          </label>
          <label class="field">
            <span>İzlenen Bölüm</span>
            <input type="number" class="inp glass" data-pf="watched" min="0">
          </label>
          <label class="field">
            <span>Toplam Bölüm</span>
            <input type="number" class="inp glass" data-pf="episodes" min="0">
          </label>
          <label class="field">
            <span>Çıkış Yılı</span>
            <input type="number" class="inp glass" data-pf="year" placeholder="2024">
          </label>
          <label class="field">
            <span>Yayın Durumu</span>
            <select class="inp glass" data-pf="release">
              <option value="FINISHED">Tamamlandı (FINISHED)</option>
              <option value="RELEASING">Yayınlanıyor (RELEASING)</option>
              <option value="NOT_YET_RELEASED">Yayınlanmadı</option>
              <option value="CANCELLED">İptal Edildi</option>
            </select>
          </label>
          <label class="field">
            <span>Tekrar Sayısı</span>
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
          } else if (f === 'id') {
            const raw = inp.value.trim();
            p.id = /^\d+$/.test(raw) ? Number(raw) : AdminSecurity.sanitizeText(raw, 80);
          } else {
            p[f] = AdminSecurity.sanitizeText(inp.value, 160);
          }
          if (f === 'name') {
            row.querySelector('.part-edit-head span').textContent = `#${idx + 1} · ${p.name || 'Parça'}`;
          }
        };
      });

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
      };

      wrap.append(row);
    });
  }

  // [AI-MIMARI-NOTU]: İlk sezon AniList URL'sinden (veya ID'sinden) başlayarak
  // bağlantılı tüm sezon, film ve yan içerikleri (`PREQUEL`, `SEQUEL`, `SIDE_STORY`,
  // `PARENT`, `SUMMARY`, `SPIN_OFF`) çeken ortak sorgu fonksiyonu.
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
      if (!$('#aeGenresInput').value.trim() && Array.isArray(rootMedia.genres)) {
        $('#aeGenresInput').value = rootMedia.genres.slice(0, 6).join(', ');
        renderAnimeGenreChips();
      }

      const existingParts = state.editingDraft.parts || [];
      // Eğer tek bir yer tutucu "1. Sezon" varsa onu ilk sezon ID'siyle eşleştir
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
          ...(prev && prev.repeat > 0 ? { repeat: prev.repeat } : {}),
          ...(prev && prev.adminModified ? { adminModified: true } : {})
        };
      });

      renderAnimePartsEditor();
      toast(`${sortedMedia.length} bağlantılı içerik (sezon, film ve yan içerik) çekildi!`);
    } catch (err) {
      toast('AniList sorgusu başarısız: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  // Mevcut veya yeni eklenmiş tüm animelerin İlk Sezon AniList Linklerinden yan içerikleri toplu sorgulama
  async function scanAllAnimeForSideContent() {
    const btn = $('#scanAllRelationsBtn');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Yan İçerikler Taranıyor...';
    const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
    const LINKS = new Set(['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'SUMMARY', 'SPIN_OFF']);
    const kindFn = f => SERIES.has(f) ? 'season' : f === 'MOVIE' ? 'movie' : 'other';
    const dk = s => ((s && s.year) || 9999) * 10000 + ((s && s.month) || 0) * 100 + ((s && s.day) || 0);
    const excluded = new Set((state.overrides.exclude || []).map(Number));

    try {
      const seeds = [];
      for (const a of state.animeData.anime || []) {
        const parsed = parseAnilistUrlOrId(a.firstSeasonUrl || a.url || a.anilistId || a.id);
        if (parsed.id && !excluded.has(parsed.id)) {
          a.anilistId = parsed.id;
          a.firstSeasonUrl = a.firstSeasonUrl || parsed.url;
          a.url = parsed.url;
          seeds.push(parsed.id);
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

      state.animeData.stats = computeStatsClient(state.animeData.anime);
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
      // Eğer tek bir yer tutucu parça varsa, ilk sezon ID'siyle bağla ki GitHub Actions çalıştığında yan içerikleri bunun etrafına kursun
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
    const scVal = $('#aeScore').value.trim();
    d.score = scVal !== '' ? Math.min(10, Math.max(0, Math.round(Number(scVal) * 10) / 10)) : null;

    const statusSel = $('#aeStatus').value;
    d.status = statusSel === 'auto' ? deriveFranchiseStatusFromParts(d.parts) : statusSel;

    const nextSel = $('#aeNext').value;
    if (nextSel === 'yes') d.next = true;
    else if (nextSel === 'no') delete d.next;

    d.addedAt = S($('#aeAddedAt').value, 20) || new Date().toISOString().slice(0, 10);
    const genres = ($('#aeGenresInput').value || '')
      .split(',')
      .map(g => S(g, 40))
      .filter(Boolean);
    if (genres.length) d.genres = genres;
    else delete d.genres;

    d.adminModified = true;
    const locked = new Set(d.lockedFields || []);
    ['title', 'score', 'status', 'genres', 'addedAt'].forEach(k => locked.add(k));
    if (d.image) locked.add('image');
    if (nextSel !== 'auto') locked.add('next');
    d.lockedFields = [...locked];

    d.parts = (d.parts || []).map(p => {
      const clean = {
        id: p.id || ('part-' + Date.now()),
        name: S(p.name, 180) || title,
        kind: ['season', 'movie', 'other'].includes(p.kind) ? p.kind : 'season',
        format: p.format || 'TV',
        episodes: Number(p.episodes) || 0,
        watched: Number(p.watched) || 0,
        status: p.status || 'COMPLETED',
        release: p.release || 'FINISHED',
        year: p.year ? Number(p.year) : null
      };
      if (p.repeat && Number(p.repeat) > 0) clean.repeat = Number(p.repeat);
      if (p.adminModified) clean.adminModified = true;
      return clean;
    });

    if (d.anilistId) {
      state.overrides.titles[String(d.anilistId)] = d.title;
      state.overrides.exclude = (state.overrides.exclude || []).filter(x => Number(x) !== Number(d.anilistId));
      markDirty('overrides');
    }
    state.overrides.deletedIds = (state.overrides.deletedIds || []).filter(x => x !== d.id);

    const existingIdx = state.animeData.anime.findIndex(a => a.id === state.editingAnimeId || a.id === d.id);
    if (existingIdx >= 0) {
      state.animeData.anime[existingIdx] = d;
    } else {
      state.animeData.anime.unshift(d);
    }

    state.animeData.anime.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || (a.title || '').localeCompare(b.title || '', 'tr'));
    state.animeData.stats = computeStatsClient(state.animeData.anime);
    state.animeData.updated = new Date().toISOString().slice(0, 10);

    markDirty('anime');
    $('#animeEditModal').hidden = true;
    renderAnimeAdminPanel();
    renderOverridesEditor();
    toast(`"${d.title}" kaydedildi ve istatistikler güncellendi.`);
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
        $('#panelTexts').hidden = target !== 'texts';
        $('#panelImages').hidden = target !== 'images';
        $('#panelCategories').hidden = target !== 'categories';
        $('#panelBoxes').hidden = target !== 'boxes';
        $('#panelSecurity').hidden = target !== 'security';
      };
    });

    $$('#panelTexts input, #panelTexts textarea, #panelBoxes input').forEach(inp => {
      inp.addEventListener('input', () => markDirty('config'));
      inp.addEventListener('change', () => markDirty('config'));
    });

    // Adım 3, 4, 5, 6: Anime Yönetimi Olayları
    $('#admAnimeSearch').oninput = e => { state.animeFilterQ = e.target.value; renderAnimeAdminPanel(); };
    $('#admAnimeStatusFilter').onchange = e => { state.animeFilterStatus = e.target.value; renderAnimeAdminPanel(); };
    $('#admAnimeSourceFilter').onchange = e => { state.animeFilterSource = e.target.value; renderAnimeAdminPanel(); };

    $('#addNewAnimeBtn').onclick = () => openAnimeEditor('__new__');
    $('#scanAllRelationsBtn').onclick = scanAllAnimeForSideContent;
    $('#triggerActionsBtn').onclick = async () => {
      try {
        await AdminSecurity.githubTriggerWorkflow('sync-anilist.yml', { sync_mode: 'hybrid' });
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
      state.animeData.stats = computeStatsClient(state.animeData.anime);
      downloadBlobJson(state.animeData, 'anime.json');
      toast('anime.json indirildi.');
    };
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

    // Anime Modal Olayları (İlk Sezon AniList URL <-> ID çift yönlü senkronu)
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

    $('#aeImage').oninput = () => {
      $('#aeCoverPreview').src = resolvePreviewSrc(AdminSecurity.sanitizeUrl($('#aeImage').value, true));
    };
    $('#aeGenresInput').oninput = renderAnimeGenreChips;
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
        adminModified: true
      });
      renderAnimePartsEditor();
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
      state.animeData.stats = computeStatsClient(state.animeData.anime);
      localStorage.setItem('tp_site_preview', JSON.stringify(state.config, null, 2));
      localStorage.setItem('tp_anime_preview', JSON.stringify(state.animeData));
      try {
        const S = state.animeData.stats;
        const animeSummary = {
          nums: [[S.anime, 'anime'], [S.season, 'sezon'], [S.film, 'film'], [S.episodes, 'bölüm']],
          imgs: state.animeData.anime.map(x => x.image).filter(Boolean).slice(0, 4)
        };
        localStorage.setItem('ui2', JSON.stringify({ s: state.config, m: { anime: animeSummary } }));
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
          state.animeData.stats = computeStatsClient(state.animeData.anime);
          state.animeData.updated = new Date().toISOString().slice(0, 10);
          await AdminSecurity.githubPutFile('data/anime.json', JSON.stringify(state.animeData, null, 2) + '\n', 'Anime verileri admin panelinden güncellendi', false);
          state.dirtyAnime = false;
        }

        localStorage.removeItem('tp_site_preview');
        localStorage.removeItem('tp_anime_preview');
        $('#clearPreviewBtn').hidden = true;
        updateDirtyIndicator();
        toast('Değişiklikler GitHub deposuna başarıyla kaydedildi! GitHub Actions yan içerik senkronunu otomatik çalıştıracaktır.');
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
      await AdminSecurity.verifyGithubWriteAccess(pat, 'tempestian', 'tempestian.github.io');
      await AdminSecurity.unlockWithVault(vaultObj, u, p, c, false);
      await AdminSecurity.updateSessionCredentials({ pat, saveToDevice: true });
      const info = AdminSecurity.getSessionInfo();
      toast('Cihazınız başarıyla yetkilendirildi ve Google Authenticator ile eşleştirildi.');
      onSessionUnlocked(info);
    } catch (err) {
      AdminSecurity.lockSession('');
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
