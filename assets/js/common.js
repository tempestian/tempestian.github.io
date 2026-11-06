// ============================================================================
// [AI-MIMARI-NOTU: ORTAK KABUK, ALT MENÜ (#DOCK), ÇOKLU-MEDYA ÖZETİ VE KUTUCUK MOTORU]
// Bu dosya tüm sayfalarda (Ana sayfa, Anime, Dizi, Film, Manga, Kitap ve Rehber)
// çalışan ortak veri ve arayüz katmanıdır.
//
// 1. Alt Menü (`#dock`) Mimari Notu:
//    - HTML şablonlarında `<nav id="dock" class="dock glass">` doğrudan flex kapsayıcısıdır.
//    - İçine ikinci bir `<nav>` EKLENMEMELİDİR; `<a>` öğeleri doğrudan `#dock` içine
//      yerleştirilir ve aktif sekmenin (`it.id === cur`) içine `<span class="pill">`
//      eklenerek yan yana (yatay) Liquid Glass sekme görünümü korunur.
//
// 2. Çoklu-Medya Arşiv Özeti (`summarize` — Adım 12 & 13):
//    - `anime`, `series`, `movie`, `manga`, `book` ve `guide` bölümlerinin her biri için
//      ilgili JSON dosyasındaki (`data/anime.json`, `data/series.json` vb.) `stats` ve
//      kayıt dizisini okuyarak ana sayfadaki kategori kartlarında zengin sayaçları
//      (ör. Dizi/Sezon/Bölüm, Film/Ort. Puan, Kitap/Sayfa, Manga/Bölüm) ve 4'lü kapak
//      şeridini (`strip`) oluşturur.
// ============================================================================
(() => {
  const root = document.body.dataset.root || '', cur = document.body.dataset.section;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} };
  const json = k => { try { return JSON.parse(ls(k)); } catch (e) { return null; } };

  const P = {
    home: '<path d="M3.5 10.6 12 3.5l8.5 7.1V19a2 2 0 0 1-2 2h-4.2v-5a1.3 1.3 0 0 0-1.3-1.3h-2a1.3 1.3 0 0 0-1.3 1.3v5H5.5a2 2 0 0 1-2-2z"/>',
    anime: '<path d="M13 4H5.5A2.5 2.5 0 0 0 3 6.5v9A2.5 2.5 0 0 0 5.5 18h13a2.5 2.5 0 0 0 2.5-2.5V11"/><polygon points="10 8.5 14.8 11.2 10 14" fill="currentColor"/><path d="M8 21h8"/><path d="m18.5 2 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="currentColor" stroke="none"/>',
    manga: '<rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M3.5 10h17"/><path d="M13 3l-2 7"/><path d="M11 10v11"/>',
    book: '<path d="M2.5 5.5A2.5 2.5 0 0 1 5 3h5.5A1.5 1.5 0 0 1 12 4.5v15a1.5 1.5 0 0 0-1.5-1.5H5a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M21.5 5.5A2.5 2.5 0 0 0 19 3h-5.5A1.5 1.5 0 0 0 12 4.5v15a1.5 1.5 0 0 1 1.5-1.5H19a2.5 2.5 0 0 0 2.5-2.5z"/><path d="M16 3v5.5l1.5-1.2 1.5 1.2V3"/>',
    movie: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    series: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="m8 2.8 4 4.2 4-4.2"/><polygon points="10.2 10.8 14.8 13.5 10.2 16.2" fill="currentColor"/>',
    guide: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7.5 9.5 3 2.5-3 2.5"/><path d="M12.5 14.5h4.5"/>',
    game: '<rect x="2.5" y="6.5" width="19" height="11" rx="5.5"/><path d="M6.5 12h4M8.5 10v4"/><circle cx="15.2" cy="10.8" r="1" fill="currentColor"/><circle cx="17.5" cy="13.2" r="1" fill="currentColor"/>',
    music: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5.5l-3 13"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    sparkle: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    dot: '<circle cx="12" cy="12" r="7.5"/>',
    back: '<path d="M19 12H5.5M11.5 6l-6 6 6 6"/>',
    moon: '<path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
    next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    out: '<path d="M7.5 16.5 16.5 7.5M9 7.5h7.5V15"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/>',
    down: '<path d="m6 9.5 6 6 6-6"/>',
    grid: '<rect x="3.8" y="3.8" width="6.8" height="6.8" rx="2"/><rect x="13.4" y="3.8" width="6.8" height="6.8" rx="2"/><rect x="3.8" y="13.4" width="6.8" height="6.8" rx="2"/><rect x="13.4" y="13.4" width="6.8" height="6.8" rx="2"/>',
    list: '<path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20"/><rect x="4" y="5.2" width="2.6" height="2.6" rx=".8" fill="currentColor"/><rect x="4" y="10.7" width="2.6" height="2.6" rx=".8" fill="currentColor"/><rect x="4" y="16.2" width="2.6" height="2.6" rx=".8" fill="currentColor"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    chev: '<path d="m6 9.5 6 6 6-6"/>',
    star: '<path fill="currentColor" d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/>',
    tier: '<rect x="3.5" y="4.5" width="4.5" height="4.5" rx="1.2"/><path d="M11 6.8h9.5"/><rect x="3.5" y="10.8" width="4.5" height="4.5" rx="1.2"/><path d="M11 13h7.5"/><rect x="3.5" y="17" width="4.5" height="4.5" rx="1.2"/><path d="M11 19.2h5.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.2"/><circle cx="8.5" cy="8.5" r="1.25" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.25" fill="currentColor"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.25" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.25" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><polyline points="12 7 12 12 15.2 14"/>',
    chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    technopat: '<path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/><path d="m9 12 2 2 4-4"/>',
    github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    anilist: '<path d="m11.9 2 9.6 18.5H16.8l-2.1-4.2H9.3l-2.1 4.2H2.5L11.9 2zm0 6.8-2.6 5.5h5.2l-2.6-5.5z"/>'
  };
  const icon = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.dot) + '</svg>';

  // ============================================================================
  // [YENİ 5 YILDIZLI AĞIRLIKLI KRİTER PUANLAMA MOTORU]
  // ============================================================================
  window.TempestianRating = {
    CRITERIA: {
      anime: [
        { id: 'story', label: 'Hikâye & Kurgusal Mimari', weight: 0.25, desc: 'Olay örgüsünün merakı, ritmi, mantıksal tutarlılığı ve finalin gücü' },
        { id: 'world', label: 'Dünya Tasarımı & Evren İnşası', weight: 0.20, desc: 'Evrenin mitolojisi, kuralları, güç sistemleri veya atmosfer inandırıcılığı' },
        { id: 'characters', label: 'Karakter Derinliği & Gelişim', weight: 0.20, desc: 'Karakterlerin motivasyonları, aralarındaki kimya ve katmanları' },
        { id: 'visuals', label: 'Görsel Yönetmenlik & Animasyon', weight: 0.15, desc: 'Çizim tutarlılığı, sahne yönetimi, kadrajlar ve aksiyon akışı (sakuga)' },
        { id: 'sound', label: 'Ses Tasarımı, Müzik & Seslendirme', weight: 0.10, desc: 'Sahne ruhunu yükselten OST\'ler, ses efektleri ve seiyuu performansı' },
        { id: 'enjoyment', label: 'Seyir Hazzı & Duygusal Tortu', weight: 0.10, desc: 'Eserin bıraktığı tatmin, sürükleyicilik ve akılda kalıcılık' }
      ],
      manga: [
        { id: 'story', label: 'Hikâye & Senaryo Örgüsü', weight: 0.25, desc: 'Gizemlerin işlenişi, ters köşeler, olayların kurgulanma ustalığı' },
        { id: 'world', label: 'Dünya Tasarımı, Lore & Sistem', weight: 0.25, desc: 'Evrenin derinliği, kuralları, güç dengeleri ve mitolojik arka plan' },
        { id: 'characters', label: 'Karakterler & Diyalog Kalitesi', weight: 0.20, desc: 'Karakter tasarımları, psikolojik derinlik ve repliklerin edebi ağırlığı' },
        { id: 'art', label: 'Çizim & Panel Yönetimi', weight: 0.20, desc: 'Çizim ustalığı, panel ritmi (paneling), aksiyon akışı ve kompozisyon' },
        { id: 'enjoyment', label: 'Okuma Sürükleyiciliği & Etki', weight: 0.10, desc: 'Sayfa çevirtme temposu ve genel tatmin' }
      ],
      movie: [
        { id: 'story', label: 'Senaryo & Anlatım Bütünlüğü', weight: 0.25, desc: 'Sürenin dolu ve dengeli kullanımı, boş sahne barındırmaması, diyalog zekası' },
        { id: 'world', label: 'Dünya Tasarımı & Mekân Hissi', weight: 0.20, desc: 'Atmosfer, dekor, kostüm ve kurulan dünyanın inandırıcılığı' },
        { id: 'acting', label: 'Oyunculuk & Karakter İnandırıcılığı', weight: 0.20, desc: 'Oyuncuların karaktere bürünmesi, beden dili ve kadro kimyası' },
        { id: 'directing', label: 'Yönetmenlik & Sinematografi', weight: 0.15, desc: 'Kamera dili, kadraj tercihleri, ışık ve görsel kompozisyon' },
        { id: 'sound', label: 'Ses Miksajı & Film Müziği', weight: 0.10, desc: 'Sahne duygusunu besleyen besteler ve ambiyans ses miksajı' },
        { id: 'impact', label: 'Duygusal Katarsis & Final Vuruşu', weight: 0.10, desc: 'Finalin çarpıcılığı, zihinde bıraktığı sarsıcı iz ve kalıcılık' }
      ],
      series: [
        { id: 'story', label: 'Ana Kurgu & Sezon Devamlılığı', weight: 0.25, desc: 'Sezonlar boyu hikaye iplerini elden kaçırmama, mantık tutarlılığı' },
        { id: 'world', label: 'Dünya Tasarımı & Sosyolojik Doku', weight: 0.20, desc: 'Mekanın yaşayan bir evrene dönüşmesi, atmosfer ve kuralların tutarlılığı' },
        { id: 'characters', label: 'Karakter Arkları & Kadro Derinliği', weight: 0.20, desc: 'Karakterlerin zamanla dönüşümü ve yan karakterlerin katkısı' },
        { id: 'pacing', label: 'Bölüm Temposu & Sürükleyicilik', weight: 0.15, desc: 'Gereksiz uzatılmış (filler) hissi yaşatmaması, akıcılık' },
        { id: 'production', label: 'Prodüksiyon & Sinematografi', weight: 0.10, desc: 'Yönetmenlik, sahne tasarımı, çekim kalitesi ve görsel özen' },
        { id: 'music_finale', label: 'Müzik & Finallerin Ağırlığı', weight: 0.10, desc: 'Jenerik müziği, tema müzikleri ve sezon finallerinin doyuruculuğu' }
      ],
      book: [
        { id: 'story', label: 'Kurgu, Olay Örgüsü & Fikir', weight: 0.25, desc: 'Yazarın ana tezi veya hikayesinin zekası, kurgusal merak' },
        { id: 'world', label: 'Dünya Tasarımı & Evren İnşası', weight: 0.25, desc: 'Mekânın, dönemin ve atmosferin okuyucunun zihninde inşası' },
        { id: 'prose', label: 'Anlatım Dili & Edebi Üslup', weight: 0.25, desc: 'Kelime zenginliği, yazarın sesi, ritim ve cümle mimarisi' },
        { id: 'characters', label: 'Karakter & Psikolojik Katman', weight: 0.15, desc: 'Karakterlerin iç çatışmaları, inandırıcılıkları ve motivasyonları' },
        { id: 'impact', label: 'Düşünsel Tortu & Kalıcılık', weight: 0.10, desc: 'Kitap kapağı kapandığında zihne ektiği felsefi veya insani tohum' }
      ]
    },
    computeScore(criteria, subScores) {
      if (!subScores || typeof subScores !== 'object') return null;
      let totalScore = 0;
      let totalWeight = 0;
      for (const c of criteria) {
        const star = Number(subScores[c.id]);
        if (!isNaN(star) && star >= 1 && star <= 5) {
          totalScore += star * 2 * c.weight;
          totalWeight += c.weight;
        }
      }
      if (totalWeight <= 0) return null;
      return Math.round((totalScore / totalWeight) * 10) / 10;
    },
    deriveSubScores(typeKey, targetScore, profile = 'balanced') {
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria || targetScore == null || isNaN(targetScore) || Number(targetScore) < 1.0) return null;
      const target = Math.max(2.0, Math.min(10.0, Number(targetScore)));
      const n = criteria.length;

      const profileWeights = {
        action: { visuals: 2.2, sound: 1.6, enjoyment: 1.4, directing: 1.5, art: 2.0, story: 0.6, world: 0.8, characters: 0.8, prose: 0.5 },
        story: { story: 2.2, world: 1.8, characters: 1.2, prose: 2.0, visuals: 0.7, sound: 0.6, enjoyment: 1.0, art: 0.8 },
        character: { characters: 2.2, enjoyment: 1.8, acting: 2.0, impact: 1.5, story: 1.2, visuals: 0.7, sound: 0.7, world: 0.7, prose: 1.0 },
        balanced: {}
      }[profile] || {};

      let bestCombo = null;
      let minDiff = Infinity;
      let bestMetric = -Infinity;

      function recurse(idx, current) {
        if (idx === n) {
          let sum = 0;
          let totalW = 0;
          for (let i = 0; i < n; i++) {
            sum += current[i] * 2 * criteria[i].weight;
            totalW += criteria[i].weight;
          }
          const score = Math.round((sum / totalW) * 10) / 10;
          const diff = Math.abs(score - target);

          let metric = 0;
          if (profile === 'balanced') {
            const avg = current.reduce((a, b) => a + b, 0) / n;
            const variance = current.reduce((a, b) => a + Math.pow(b - avg, 2), 0);
            metric = -variance;
          } else {
            for (let i = 0; i < n; i++) {
              const cid = criteria[i].id;
              const pw = profileWeights[cid] || 1.0;
              metric += current[i] * pw;
            }
          }

          if (diff < minDiff || (Math.abs(diff - minDiff) < 1e-6 && metric > bestMetric)) {
            minDiff = diff;
            bestMetric = metric;
            bestCombo = [...current];
          }
          return;
        }
        for (let s = 1; s <= 5; s++) {
          current.push(s);
          recurse(idx + 1, current);
          current.pop();
        }
      }

      recurse(0, []);

      if (!bestCombo) return null;
      const res = {};
      for (let i = 0; i < n; i++) {
        res[criteria[i].id] = bestCombo[i];
      }
      return res;
    },
    computeWeightedSubScores(typeKey, item) {
      if (!item) return null;
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria) return null;

      const parts = Array.isArray(item.parts) ? item.parts : [];
      const ratedParts = parts.filter(p => p && p.subScores && typeof p.subScores === 'object' && Object.values(p.subScores).some(v => v != null && v > 0));

      if (ratedParts.length === 0) {
        return (item.subScores && typeof item.subScores === 'object' && Object.values(item.subScores).some(v => v != null && v > 0))
          ? { ...item.subScores }
          : null;
      }
      if (ratedParts.length === 1) {
        return { ...ratedParts[0].subScores };
      }

      const continuousAvg = {};
      let totalPartWeight = 0;
      let weightedSumScore = 0;

      for (const p of ratedParts) {
        const sc = p.score != null ? Number(p.score) : this.computeScore(criteria, p.subScores);
        let w = 1.0;
        if (p.kind === 'movie' || p.format === 'MOVIE') w = 0.35;
        else if (p.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(p.format)) w = 0.15;

        if (sc != null && !isNaN(sc)) {
          weightedSumScore += sc * w;
          totalPartWeight += w;
        }
      }

      for (const c of criteria) {
        let cSum = 0;
        let cWeight = 0;
        for (const p of ratedParts) {
          const star = Number(p.subScores[c.id]);
          if (!isNaN(star) && star >= 1 && star <= 5) {
            let w = 1.0;
            if (p.kind === 'movie' || p.format === 'MOVIE') w = 0.35;
            else if (p.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(p.format)) w = 0.15;
            cSum += star * w;
            cWeight += w;
          }
        }
        continuousAvg[c.id] = cWeight > 0 ? cSum / cWeight : 3;
      }

      const targetScore = totalPartWeight > 0 ? Math.round((weightedSumScore / totalPartWeight) * 10) / 10 : (Number(item.score) || 5);

      const n = criteria.length;
      const options = criteria.map(c => {
        const a = continuousAvg[c.id];
        const fl = Math.max(1, Math.min(5, Math.floor(a)));
        const ce = Math.max(1, Math.min(5, Math.ceil(a)));
        const set = new Set([fl, ce]);
        if (fl > 1) set.add(fl - 1);
        if (ce < 5) set.add(ce + 1);
        return Array.from(set);
      });

      let bestCombo = null;
      let minDiffToTarget = Infinity;
      let minDeviationFromAvg = Infinity;

      function recurse(idx, current) {
        if (idx === n) {
          let sum = 0, tw = 0, dev = 0;
          for (let i = 0; i < n; i++) {
            const val = current[i];
            sum += val * 2 * criteria[i].weight;
            tw += criteria[i].weight;
            const diff = val - continuousAvg[criteria[i].id];
            dev += diff * diff;
          }
          const s = Math.round((sum / tw) * 10) / 10;
          const targetDiff = Math.abs(s - targetScore);
          if (targetDiff < minDiffToTarget || (Math.abs(targetDiff - minDiffToTarget) < 1e-6 && dev < minDeviationFromAvg)) {
            minDiffToTarget = targetDiff;
            minDeviationFromAvg = dev;
            bestCombo = [...current];
          }
          return;
        }
        for (const val of options[idx]) {
          current.push(val);
          recurse(idx + 1, current);
          current.pop();
        }
      }
      recurse(0, []);

      if (!bestCombo) return null;
      const res = {};
      for (let i = 0; i < n; i++) {
        res[criteria[i].id] = bestCombo[i];
      }
      return res;
    },
    renderBreakdownGrid(typeKey, subScores) {
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria) return '';
      return criteria.map(c => {
        const star = Number(subScores && subScores[c.id]) || 0;
        const filledStars = '★'.repeat(star) + '☆'.repeat(5 - star);
        const weightPct = Math.round(c.weight * 100);
        return `
          <div class="sh-rb-item" title="${c.desc} (Ağırlık: %${weightPct})">
            <div class="sh-rb-top">
              <span class="sh-rb-lbl">${c.label}</span>
              <span class="sh-rb-num">${star > 0 ? star + '/5' : '-'}</span>
            </div>
            <div class="sh-rb-stars">${filledStars}</div>
          </div>
        `;
      }).join('');
    },
    renderBreakdownHtml(typeKey, subScores, overallScore) {
      return `
        <div class="sh-rb-head">
          <span class="sh-rb-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/></svg>
            Detaylı Puanlama Karnesi
          </span>
          <span class="sh-rb-score">★ ${overallScore || '-'} / 10</span>
        </div>
        <div class="sh-rb-grid">
          ${this.renderBreakdownGrid(typeKey, subScores)}
        </div>
      `;
    },
    renderSheetBreakdown(containerEl, typeKey, item, overallScore) {
      if (!containerEl || !item) return;
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria) {
        containerEl.hidden = true;
        containerEl.replaceChildren();
        return;
      }

      const parts = Array.isArray(item.parts) ? item.parts : [];
      const ratedParts = parts.filter(p => p && p.subScores && typeof p.subScores === 'object' && Object.values(p.subScores).some(v => v != null && v > 0));
      let effectiveItemSubScores = (item.subScores && typeof item.subScores === 'object' && Object.values(item.subScores).some(v => v != null && v > 0))
        ? item.subScores
        : null;

      if (!effectiveItemSubScores && ratedParts.length > 0) {
        effectiveItemSubScores = this.computeWeightedSubScores(typeKey, item);
      }

      if (!ratedParts.length && !effectiveItemSubScores) {
        containerEl.hidden = true;
        containerEl.replaceChildren();
        return;
      }

      containerEl.hidden = false;

      // Durum 1: Tek parça veya doğrudan yapım seviyesi değerlendirme
      if (ratedParts.length <= 1) {
        const targetScores = effectiveItemSubScores || (ratedParts.length === 1 ? ratedParts[0].subScores : null);
        const targetTitle = (ratedParts.length === 1 && ratedParts[0].name && ratedParts[0].name !== item.title)
          ? `Detaylı Puanlama Karnesi · ${ratedParts[0].name}`
          : 'Detaylı Puanlama Karnesi';
        const targetScore = overallScore || (ratedParts.length === 1 && ratedParts[0].score != null ? ratedParts[0].score : null);

        containerEl.innerHTML = `
          <div class="sh-rb-head">
            <span class="sh-rb-title">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/></svg>
              ${esc(targetTitle)}
            </span>
            <span class="sh-rb-score">★ ${targetScore || '-'} / 10</span>
          </div>
          <div class="sh-rb-grid">
            ${this.renderBreakdownGrid(typeKey, targetScores)}
          </div>
        `;
        return;
      }

      // Durum 2: Çoklu Sezon / Parça Değerlendirmesi (Kompakt ve şık yatay sekme şeridi ile minimal görünüm)
      const tabs = [];
      if (effectiveItemSubScores) {
        tabs.push({ id: 'item_overall', name: 'Genel', score: overallScore, subScores: effectiveItemSubScores });
      }
      ratedParts.forEach((p, idx) => {
        tabs.push({
          id: 'part_' + idx,
          name: p.name || `${idx + 1}. Sezon`,
          score: p.score != null ? p.score : this.computeScore(criteria, p.subScores),
          subScores: p.subScores
        });
      });

      let activeTabIdx = 0;

      const renderView = () => {
        const curTab = tabs[activeTabIdx] || tabs[0];
        const existingTabsBar = containerEl.querySelector('.sh-rb-tabs');
        const prevScrollLeft = existingTabsBar ? existingTabsBar.scrollLeft : 0;

        const tabsHtml = tabs.map((t, i) => `
          <button type="button" class="sh-rb-tab${i === activeTabIdx ? ' active' : ''}" data-tab-idx="${i}" role="tab" aria-selected="${i === activeTabIdx}">
            <span>${esc(t.name)}</span>
            <span class="sh-rb-tab-score">· ${t.score || '-'}</span>
          </button>
        `).join('');

        containerEl.innerHTML = `
          <div class="sh-rb-head">
            <span class="sh-rb-title">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/></svg>
              Detaylı Puanlama Karnesi
            </span>
            <span class="sh-rb-score">★ ${curTab.score || overallScore || '-'} / 10</span>
          </div>
          <div class="sh-rb-tabs" role="tablist" aria-label="Sezon Puanları">
            ${tabsHtml}
          </div>
          <div class="sh-rb-grid">
            ${this.renderBreakdownGrid(typeKey, curTab.subScores)}
          </div>
        `;

        const newTabsBar = containerEl.querySelector('.sh-rb-tabs');
        if (newTabsBar && prevScrollLeft > 0) {
          newTabsBar.scrollLeft = prevScrollLeft;
        }

        containerEl.querySelectorAll('.sh-rb-tab').forEach(btn => {
          btn.onclick = e => {
            e.stopPropagation();
            activeTabIdx = Number(btn.dataset.tabIdx);
            renderView();
            const activeBtn = containerEl.querySelector(`.sh-rb-tab[data-tab-idx="${activeTabIdx}"]`);
            if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
              activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
            }
          };
        });
      };

      renderView();
    }
  };

  const resolveAsset = u => {
    if (!u) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
    return root + u.replace(/^\.?\//, '');
  };

  // ============================================================================
  // [AKILLI HİBRİT MODEL: TARİH BİÇİMLENDİRME & GÖSTERİM MOTORU]
  // 'YYYY-MM' (Ay Yıl, örn: '2024-10' -> 'Ekim 2024')
  // 'YYYY'    (Yalnızca Yıl, örn: '2023' -> '2023')
  // Geriye dönük uyumluluk: 'YYYY-MM-DD' gelirse 'Ekim 2024' olarak çözülür.
  // ============================================================================
  const TURKISH_MONTHS = [
    '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const formatHybridDate = val => {
    if (!val || typeof val !== 'string') return '';
    const s = val.trim();
    const mMatch = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (mMatch) {
      const y = mMatch[1];
      const m = parseInt(mMatch[2], 10);
      const mName = TURKISH_MONTHS[m];
      return mName ? `${mName} ${y}` : y;
    }
    if (/^\d{4}$/.test(s)) {
      return s;
    }
    return s;
  };
  window.formatHybridDate = formatHybridDate;

  const themeBtn = document.getElementById('theme');
  const barIn = document.querySelector('.bar-in:not(.admin-bar-in)');
  if (barIn) {
    let actions = barIn.querySelector('.bar-actions');
    if (!actions) {
      actions = el('div', 'bar-actions');
      const statsBtns = Array.from(barIn.querySelectorAll('.bar-stats-btn'));
      if (themeBtn) {
        themeBtn.parentNode.insertBefore(actions, themeBtn);
        statsBtns.forEach(b => actions.appendChild(b));
        actions.appendChild(themeBtn);
      } else {
        barIn.appendChild(actions);
      }
    }
  }
  const syncIcons = () => {
    document.querySelectorAll('[data-icon]').forEach(b => { b.innerHTML = icon(b.dataset.icon === 'theme' ? (document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon') : b.dataset.icon); });
    if (themeBtn) themeBtn.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
  };
  syncIcons(); document.addEventListener('themechange', syncIcons);
  if (themeBtn) themeBtn.onclick = () => window.toggleTheme();

  const bar = document.querySelector('.bar');
  let on = false;
  const upd = () => { const n = scrollY > 36; if (n !== on) { on = n; bar && bar.classList.toggle('on', n); } };
  addEventListener('scroll', upd, { passive: true }); upd();

  const parts = it => {
    const raw = it.parts || (it.seasons || []).map(s => ({ ...s, kind: 'season' }));
    if (!raw.length && it.status === 'completed') {
      return [{ kind: 'season', status: 'COMPLETED', episodes: 1, watched: 1, repeat: 0 }];
    }
    const anyDone = raw.some(p => p && (p.status === 'COMPLETED' || (p.watched || 0) > 0));
    return raw.map((p, idx) => {
      const ep = Math.max(0, Number(p.episodes) || 0);
      let w = Math.max(0, Number(p.watched) || 0);
      let st = p.status || 'NONE';
      if (!anyDone && it.status === 'completed' && (p.kind === 'season' || idx === 0)) st = 'COMPLETED';
      if (st === 'COMPLETED' && w === 0) w = ep > 0 ? ep : 1;
      if (ep > 0 && w >= ep && st === 'CURRENT') st = 'COMPLETED';
      return {
        ...p,
        kind: p.kind === 'movie' ? 'movie' : p.kind === 'other' ? 'other' : 'season',
        episodes: ep,
        watched: w,
        status: st
      };
    });
  };

  const tally = (items, statsConfig = {}) => {
    const includeInProgress = statsConfig.includeInProgressEpisodes !== false;
    const rule = statsConfig.animeCountRule || 'completed_season_or_movie';
    const t = { anime: 0, season: 0, film: 0, ep: 0 };
    for (const it of items) {
      const ps = parts(it);
      const done = ps.filter(p => p.status === 'COMPLETED' && p.watched > 0);
      const doneSeasonOrMovie = done.filter(p => p.kind === 'season' || p.kind === 'movie');
      const active = ps.filter(p => p.status !== 'NONE' && p.status !== 'PLANNING' && p.watched > 0);
      const isCounted = rule === 'completed_only'
        ? it.status === 'completed'
        : rule === 'any_watched'
          ? (active.length > 0 || done.length > 0 || it.status === 'completed')
          : (doneSeasonOrMovie.length > 0 || (done.length > 0 && !ps.some(p => p.kind === 'season' || p.kind === 'movie')) || it.status === 'completed');

      for (const p of done) {
        if (isCounted) {
          if (p.kind === 'season') t.season++;
          else if (p.kind === 'movie') t.film++;
        }
        t.ep += p.watched;
      }
      if (includeInProgress) {
        for (const p of active) {
          if (p.status !== 'COMPLETED') t.ep += p.watched;
        }
      }
      if (isCounted) t.anime++;
    }
    return t;
  };
  // [AI-MIMARI-NOTU: ADIM 21 — EVRENSEL GÜVENLİ METİN KAÇIŞI (UI.esc), GELİŞMİŞ ALTYAZI/PARÇA ARAMASI VE MODAL YATAY KAYDIRMA]
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ============================================================================
  // [AI-MIMARI-NOTU: AMBİENT GLOW (AURA IŞIK) TAMAMEN KALDIRILDI & FRAGMAN OYNATICI]
  // Kullanıcı talebi doğrultusunda arka planı kaplayan rahatsız edici sarı/renkli ışık hüzmesi
  // tamamen kaldırılmış; temiz, sade ve göz yormayan karanlık cam (dark glass) görünüme dönülmüştür.
  // Geriye dönük uyumluluk için UI.updateAmbientGlow ve UI.hideAmbientGlow güvenli boş fonksiyon yapılmıştır.
  // ============================================================================
  try {
    const staleGlow = document.querySelector('.sheet-ambient-glow');
    if (staleGlow) staleGlow.remove();
    document.body.classList.remove('has-sheet-open');
  } catch (_) {}

  function updateAmbientGlow() {}
  function hideAmbientGlow() {}

  function openTrailer() {}
  function closeTrailer() {}

  function showToast(msg, type = 'info') {
    let t = document.getElementById('tpToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'tpToast';
      t.className = 'tp-toast glass';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.dataset.type = type;
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('visible'), 3200);
  }
  window.showToast = showToast;

  window.UI = { icon, el, parts, tally, resolveAsset, esc, icons: Object.keys(P), updateAmbientGlow, hideAmbientGlow, openTrailer, closeTrailer, showToast };
  try { localStorage.removeItem('wall'); } catch (e) {}

  const dock = document.getElementById('dock'), list = document.getElementById('sections'), links = document.getElementById('links');
  const boxesTop = document.getElementById('boxesTop'), boxesBottom = document.getElementById('boxesBottom');
  const cover = x => x.image || null;

  const CANONICAL_SECTION_META = {
    anime: { path: 'anime/', data: 'data/anime.json', countKey: 'anime', unit: 'anime', icon: 'anime', showStrip: true },
    guide: { path: 'rehber/', data: 'data/guides.json', countKey: 'guides', unit: 'rehber', icon: 'guide', showStrip: false },
    series: { path: 'dizi/', data: 'data/series.json', countKey: 'series', unit: 'dizi', icon: 'series', showStrip: true },
    movie: { path: 'film/', data: 'data/movies.json', countKey: 'movies', unit: 'film', icon: 'movie', showStrip: true },
    manga: { path: 'manga/', data: 'data/manga.json', countKey: 'manga', unit: 'manga', icon: 'manga', showStrip: true },
    book: { path: 'kitap/', data: 'data/books.json', countKey: 'books', unit: 'kitap', icon: 'book', showStrip: true }
  };

  function ensureSectionDefaults(s) {
    if (!s || typeof s !== 'object') return s;
    const def = CANONICAL_SECTION_META[s.id];
    if (!def) return s;
    return {
      ...def,
      ...s,
      path: s.path || def.path,
      data: s.data || def.data,
      countKey: s.countKey || def.countKey,
      unit: s.unit || def.unit,
      icon: s.icon || def.icon,
      showStrip: s.showStrip !== undefined ? s.showStrip : def.showStrip
    };
  }

  // [AI-MIMARI-NOTU: ADIM 12 & 13 — ÇOKLU-MEDYA KART ÖZETLEYİCİ]
  const summarize = (rawSec, j) => {
    const s = ensureSectionDefaults(rawSec);
    const items = (j && (Array.isArray(j.items) ? j.items : Array.isArray(j[s.countKey]) ? j[s.countKey] : Array.isArray(j[s.id]) ? j[s.id] : Array.isArray(j.anime) ? j.anime : [])) || [];
    const st = j && j.stats;
    const rawTally = tally(items, j && j.statsConfig);
    const t = st
      ? {
          main: (st.watched ?? st.read ?? st.published ?? st.anime ?? rawTally.anime) || items.length,
          season: (st.seasons ?? st.volumes ?? st.films ?? st.season ?? rawTally.season) || 0,
          film: (st.film ?? st.specials ?? st.extras ?? rawTally.film) || 0,
          ep: (st.episodes ?? st.pages ?? st.chapters ?? st.watchCount ?? rawTally.ep) || 0,
          avg: st.avgScore
        }
      : {
          main: rawTally.anime || items.length,
          season: rawTally.season,
          film: rawTally.film,
          ep: rawTally.ep,
          avg: null
        };
    let nums;
    if (s.id === 'anime') {
      nums = [[st && st.anime != null ? st.anime : t.main, 'anime'], [t.season, 'sezon'], [t.film, 'film'], [t.ep, 'bölüm']];
    } else if (s.id === 'series') {
      nums = [[t.main, 'dizi'], [t.season, 'sezon'], [t.ep, 'bölüm']];
    } else if (s.id === 'movie') {
      nums = [[t.main, 'film'], ...(t.avg ? [[t.avg, 'ort. puan']] : [])];
    } else if (s.id === 'manga') {
      nums = [[t.main, 'manga'], [t.ep, 'bölüm']];
    } else if (s.id === 'book') {
      nums = [[t.main, 'kitap'], [t.ep, 'sayfa']];
    } else if (s.id === 'guide') {
      const catCount = st && Array.isArray(st.genres) ? st.genres.length : 0;
      nums = [[items.length, 'rehber'], ...(catCount ? [[catCount, 'kategori']] : [])];
    } else {
      nums = [[items.length, s.unit || 'içerik']];
    }
    return { nums: j ? nums : null, imgs: s.showStrip === false ? [] : items.map(cover).filter(Boolean).slice(0, 4) };
  };

  function renderCustomBoxes(container, boxItems) {
    if (!container) return;
    const activeBoxes = (boxItems || []).filter(b => b && b.enabled !== false);
    if (!activeBoxes.length) {
      container.hidden = true;
      container.replaceChildren();
      return;
    }
    const fr = document.createDocumentFragment();
    for (const b of activeBoxes) {
      const li = el('li', 'tile glass sq custom-box' + (b.span === 'full' ? ' span-full' : ''));
      const isLink = Boolean(b.url);
      const box = isLink ? Object.assign(el('a'), { href: resolveAsset(b.url) }) : el('div');
      if (isLink && /^https?:\/\//i.test(b.url)) box.rel = 'noopener';
      const top = el('div', 'tile-top');
      const titleWrap = el('div', 'box-head-left');
      if (b.image) {
        const img = el('img', 'box-thumb');
        img.src = resolveAsset(b.image);
        img.alt = '';
        img.width = 40;
        img.height = 40;
        img.decoding = 'async';
        titleWrap.append(img);
      } else if (b.icon && P[b.icon]) {
        const ic = el('span', 'box-ic');
        ic.innerHTML = icon(b.icon);
        titleWrap.append(ic);
      }
      titleWrap.append(el('h2', '', b.title || ''));
      top.append(titleWrap);
      if (b.badge) {
        top.append(el('span', 'tag', b.badge));
      } else if (isLink) {
        const g = el('span', 'go');
        g.innerHTML = icon(/^https?:\/\//i.test(b.url) ? 'out' : 'next');
        top.append(g);
      }
      box.append(top);
      if (b.text) {
        box.append(el('p', 'box-txt', b.text));
      }
      if (Array.isArray(b.stats) && b.stats.length) {
        const n = el('p', 'nums');
        for (const st of b.stats) {
          if (!st || (st.value == null && !st.label)) continue;
          const sp = el('span');
          sp.append(el('b', '', st.value ?? ''), ' ' + (st.label || ''));
          n.append(sp);
        }
        box.append(n);
      }
      li.append(box);
      fr.append(li);
    }
    container.replaceChildren(fr);
    container.hidden = false;
  }

  function applySiteIdentity(d) {
    const site = (d && d.site) || {};
    if (site.favicon32) {
      const f32 = document.getElementById('fav32') || document.querySelector('link[sizes="32x32"]');
      if (f32) f32.href = resolveAsset(site.favicon32);
    }
    if (site.icon192) {
      const f192 = document.getElementById('fav192') || document.querySelector('link[sizes="192x192"]');
      if (f192) f192.href = resolveAsset(site.icon192);
    }
    if (site.appleTouchIcon) {
      const fa = document.getElementById('favApple') || document.querySelector('link[rel="apple-touch-icon"]');
      if (fa) fa.href = resolveAsset(site.appleTouchIcon);
    }
    if (cur === 'home') {
      if (site.title) document.title = site.title;
      if (site.description) {
        const md = document.querySelector('meta[name="description"]');
        if (md) md.content = site.description;
      }
      const bt = document.getElementById('barTitle') || document.querySelector('.bar-title');
      if (bt && (site.barTitle || site.title)) {
        const txt = bt.querySelector('.bar-title-txt') || bt.querySelector('span');
        if (txt) txt.textContent = site.barTitle || site.title;
        else bt.textContent = site.barTitle || site.title;
      }
      const ht = document.getElementById('heroTitle') || document.querySelector('.hero h1');
      if (ht && site.title !== undefined) ht.textContent = site.title;
      const hs = document.getElementById('heroSub') || document.querySelector('.hero .sub');
      if (hs) {
        hs.textContent = '';
        hs.hidden = true;
      }
      const hl = document.getElementById('heroLogo') || document.querySelector('.hero .mark');
      if (hl && site.logo) hl.src = resolveAsset(site.logo);
    } else if (cur && d && d.pages && d.pages[cur]) {
      const pg = d.pages[cur];
      if (pg.metaTitle) document.title = pg.metaTitle;
      if (pg.description) {
        const md = document.querySelector('meta[name="description"]');
        if (md) md.content = pg.description;
      }
      const bt = document.querySelector('.bar-title');
      if (bt && pg.title) {
        const txt = bt.querySelector('.bar-title-txt') || bt.querySelector('span');
        if (txt) txt.textContent = pg.title;
        else bt.textContent = pg.title;
      }
      const h1 = document.querySelector('.page-head h1');
      if (h1 && pg.title) h1.textContent = pg.title;
      const headEl = document.querySelector('.page-head');
      if (headEl && pg.subtitle !== undefined) {
        let subEl = headEl.querySelector('.sub');
        if (!subEl && pg.subtitle) {
          subEl = el('p', 'sub');
          subEl.style.marginTop = '4px';
          subEl.style.fontSize = '.98rem';
          headEl.append(subEl);
        }
        if (subEl) {
          subEl.textContent = pg.subtitle;
          subEl.hidden = !pg.subtitle;
        }
      }
    }
  }

  function render(d, sum) {
    window.SITE_CONFIG = d;
    document.dispatchEvent(new CustomEvent('siteconfig', { detail: d }));
    applySiteIdentity(d);

    const visibleSections = (d.sections || []).filter(Boolean).map(ensureSectionDefaults).filter(s => s.status !== 'hidden');
    const active = visibleSections.filter(s => s.status === 'active' || s.id === cur);

    initFlyoutCapsule(sum);

    // [AI-MIMARI-NOTU]: #dock zaten <nav id="dock" class="dock glass"> olduğu için
    // Dock completely removed in favor of Top Flyout Capsule (Idea 3)
    if (dock) {
      dock.replaceChildren();
      dock.hidden = true;
      dock.remove();
    }

    if (boxesTop || boxesBottom) {
      const allBoxes = Array.isArray(d.boxes) ? d.boxes : [];
      renderCustomBoxes(boxesTop, allBoxes.filter(b => b.position !== 'below'));
      renderCustomBoxes(boxesBottom, allBoxes.filter(b => b.position === 'below'));
    }

    if (list) {
      const fr = document.createDocumentFragment();
      for (const s of visibleSections) {
        const on = s.status === 'active', m = sum[s.id] || {};
        const isFeatured = on && (s.id === 'anime' || s.id === 'guide');
        const li = el('li', 'tile glass sq' + (isFeatured ? ' tile-featured' : on ? ' tile-active' : ' tile-companion soon'));
        const box = on ? Object.assign(el('a'), { href: root + s.path }) : el('div');
        const top = el('div', 'tile-top');
        const headLeft = el('div', 'box-head-left');
        if (s.customImage) {
          const cimg = el('img', 'box-thumb');
          cimg.src = resolveAsset(s.customImage);
          cimg.alt = '';
          cimg.width = 36;
          cimg.height = 36;
          headLeft.append(cimg);
        } else if (s.icon && P[s.icon]) {
          const ic = el('span', 'box-ic' + (isFeatured ? ' box-ic-gold' : ''));
          ic.innerHTML = icon(s.icon);
          headLeft.append(ic);
        }
        headLeft.append(el('h2', '', s.title));
        top.append(headLeft);
        if (on) {
          const badge = el('span', 'tag tag-active', isFeatured && s.id === 'anime' ? 'Aktif Arşiv' : isFeatured && s.id === 'guide' ? 'Technopat Rehber' : 'Aktif');
          top.append(badge);
          const g = el('span', 'go'); g.innerHTML = icon('next'); top.append(g);
        } else {
          top.append(el('span', 'tag', s.badgeText || s.description || 'Yakında'));
        }
        box.append(top);
        if (s.subtitle) {
          box.append(el('p', 'box-txt', s.subtitle));
        } else if (s.description && !on) {
          box.append(el('p', 'box-txt', s.description));
        }
        if (isFeatured && s.id === 'guide') {
          const tagsRow = el('div', 'guide-chips-row');
          for (const t of ['GNU/Linux', 'Donanım', 'Optimizasyon']) {
            tagsRow.append(el('span', 'chip-mini', t));
          }
          box.append(tagsRow);
        }
        if (on && m.nums) {
          const n = el('p', 'nums');
          for (const [v, u] of m.nums) { const sp = el('span'); sp.append(el('b', '', v), ' ' + u); n.append(sp); }
          box.append(n);
        }
        if (on && m.imgs && m.imgs.length && s.showStrip !== false) {
          const st = el('div', 'strip');
          for (const u of m.imgs) { const im = el('img'); im.src = resolveAsset(u); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.width = 88; im.height = 132; im.onload = () => im.classList.add('in'); st.append(im); }
          box.append(st);
        }
        li.append(box); fr.append(li);
      }
      list.replaceChildren(fr);
    }

    if (links) {
      const activeLinks = (d.links || []).filter(l => l && l.enabled !== false);
      const fr = document.createDocumentFragment();
      for (const l of activeLinks) {
        const li = el('li', 'link-item');
        const a = el('a', 'glass sq link-btn');
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener me';
        let icName = 'link';
        if (/technopat\.net/i.test(l.url)) icName = 'technopat';
        else if (/github\.com/i.test(l.url)) icName = 'github';
        else if (/anilist\.co/i.test(l.url)) icName = 'anilist';
        const ic = el('span', 'link-ic');
        ic.innerHTML = icon(icName);
        a.append(ic);
        a.append(el('span', 'link-title', l.title));
        const o = el('span', 'out'); o.innerHTML = icon('out'); a.append(o);
        li.append(a); fr.append(li);
      }
      links.replaceChildren(fr);
    }

    // Dynamic greeting and hero counters
    const gEl = document.getElementById('irisGreeting');
    if (gEl) {
      const hr = new Date().getHours();
      let g = 'İyi akşamlar';
      if (hr >= 5 && hr < 12) g = 'Günaydın';
      else if (hr >= 12 && hr < 18) g = 'İyi günler';
      else if (hr >= 18 && hr < 23) g = 'İyi akşamlar';
      else g = 'İyi geceler';
      gEl.textContent = g;
    }
    if (sum && sum.anime && sum.anime.nums && sum.anime.nums[0]) {
      const ca = document.getElementById('chipAnimeCount');
      if (ca) ca.textContent = sum.anime.nums[0][0];
    }
    if (sum && sum.guide && sum.guide.nums && sum.guide.nums[0]) {
      const cg = document.getElementById('chipGuideCount');
      if (cg) cg.textContent = sum.guide.nums[0][0];
    }
  }

  const previewCfg = json('tp_site_preview');
  const cached = json('ui2');
  if (previewCfg) {
    render(previewCfg, (cached && cached.s) || {});
  } else if (cached && cached.d) {
    render(cached.d, cached.s || {});
  }

  (async () => {
    try {
      const remoteCfg = await fetch(root + 'data/sections.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
      let d = remoteCfg || previewCfg;
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
        d = { ...remoteCfg, ...previewCfg, sections: mergedSecs };
      }
      if (!d) return;
      const sum = (cached && cached.s) || {};
      render(d, sum);
      if (list) {
        const previewAnime = json('tp_anime_preview');
        const previewMulti = json('tp_multimedia_preview') || {};
        await Promise.all((d.sections || []).filter(Boolean).map(ensureSectionDefaults).filter(s => s.status === 'active' && s.data).map(async s => {
          try {
            const remoteJ = await fetch(root + s.data, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
            let j = remoteJ;
            if (s.id === 'anime' && previewAnime && Array.isArray(previewAnime.anime) && previewAnime.anime.length >= ((remoteJ && remoteJ.anime && remoteJ.anime.length) || 0)) {
              j = previewAnime;
            } else if (previewMulti[s.id] && Array.isArray(previewMulti[s.id].items) && previewMulti[s.id].items.length > 0 && previewMulti[s.id].items.length >= ((remoteJ && (remoteJ.items || remoteJ[s.countKey]) || []).length)) {
              j = previewMulti[s.id];
            }
            if (j) sum[s.id] = summarize(s, j);
          } catch (e) {}
        }));
        render(d, sum);
      }
      ls('ui2', JSON.stringify({ d, s: sum }));
    } catch (e) {}
  })();

  // [AI-MIMARI-NOTU]: Masaüstünde (PC) `.chips`, `.dock` ve `.rq-strip` gibi yatay şeritlerin
  // hem fareyle basılı tutup sürükleyerek (drag-to-scroll) hem de fare tekerleğiyle (wheel)
  // kaydırılabilmesini sağlayan evrensel olay dinleyicisi.
  (() => {
    // [AI-MIMARI-NOTU: ADIM 21]: .cmdk-ScopeBar, .sh-rb-tabs (Sezon Kriter Karnesi Sekmeleri), .criteria-profiles-bar
    // ve yatay filtre şeritleri dahil edilerek hem fare tekerleği (wheel), hem dokunmatik (touch/swipe),
    // hem de fare ile sürükleme (drag-to-scroll) pürüzsüz çalıştırıldı.
    const SELECTOR = '.chips, .dock, .rq-strip, .cmdk-ScopeBar, .cmdk-scope-bar, .sh-rb-tabs, .criteria-profiles-bar, .tag-group-chips';

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
      const btn = e.target && e.target.closest ? e.target.closest('.chips button, .sh-rb-tab') : null;
      if (!btn) return;
      const bar = btn.closest('.chips, .sh-rb-tabs');
      if (bar && bar.scrollWidth > bar.clientWidth && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });

    // [AI-MIMARI-NOTU: AKILLI DOCK & SEKME GEÇİŞİ — GERİ TUŞU YIĞILMASINI ÖNLEME]
    // Kullanıcı alt menüdeki (dock) sekmeler arasında gezinirken tarayıcı geçmişine
    // sürekli yeni sayfa katmanı yığıp kullanıcının siteden çıkmak için 5-10 kez
    // geri tuşuna basmak zorunda kalmasını engellemek için dock geçişleri 'replace' (yerine yazma)
    // mantığıyla çalıştırılır.
    document.addEventListener('click', e => {
      const dockLink = e.target && e.target.closest ? e.target.closest('#dock a') : null;
      if (!dockLink) return;
      // Yeni sekmede açma veya özel tuş kombinasyonlarını (Ctrl/Cmd/Shift) tarayıcıya bırak
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (dockLink.target && dockLink.target !== '_self') return;

      const targetHref = dockLink.getAttribute('href');
      if (!targetHref || targetHref.startsWith('#')) return;

      // Aynı sayfaya tıklanmışsa işlem yapma
      if (dockLink.getAttribute('aria-current') === 'page') {
        e.preventDefault();
        return;
      }

      const targetUrl = new URL(dockLink.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;

      // Standart tıklamayı ele al ve geçmiş yığılmasını önleyerek konumu güncelle
      e.preventDefault();
      if (typeof window.location.replace === 'function') {
        window.location.replace(targetUrl.href);
      } else {
        window.location.href = targetUrl.href;
      }
    });
  })();


  // ============================================================================
  // [AI-MIMARI-NOTU: ADIM 16 — EVRENSEL KOMUT PALETİ VE GLOBAL ARAMA (Ctrl+K)]
  // Tüm sayfalarda (`index.html`, `/anime/`, `/rehber/`, `/dizi/`, `/film/`, `/manga/`, `/kitap/`)
  // üst çubuğa arama ikonu ekler ve `Ctrl+K` / `⌘K` kısayoluyla tüm arşivlerde eşzamanlı
  // anlık arama ve hızlı gezinme sağlar.
  // ============================================================================
  (() => {
    if (cur === 'admin') return;

    const barIn = document.querySelector('.bar-in');
    if (barIn && themeBtn && !document.getElementById('globalSearchBtn')) {
      const sBtn = el('button', 'btn glass bar-search-btn');
      sBtn.id = 'globalSearchBtn';
      sBtn.type = 'button';
      sBtn.title = 'Tüm sitede ara (Ctrl+K)';
      sBtn.setAttribute('aria-label', 'Tüm sitede ara (Ctrl+K)');
      sBtn.innerHTML = icon('search');
      if (themeBtn.parentNode) {
        themeBtn.parentNode.insertBefore(sBtn, themeBtn);
      } else {
        barIn.insertBefore(sBtn, themeBtn);
      }
      sBtn.onclick = () => openCommandPalette();
    }

    let modal = null;
    let inp = null;
    let listEl = null;
    let scopeBar = null;
    let indexedItems = null;
    let loadingPromise = null;
    let activeScope = 'all';
    let activeIdx = 0;
    let currentMatches = [];

    const SECTION_DEFS = [
      { id: 'anime', label: 'Anime', path: 'anime/', data: 'data/anime.json', key: 'anime', icon: 'anime' },
      { id: 'guide', label: 'Rehber', path: 'rehber/', data: 'data/guides.json', key: 'items', icon: 'guide', isGuide: true },
      { id: 'series', label: 'Dizi', path: 'dizi/', data: 'data/series.json', key: 'items', icon: 'series' },
      { id: 'movie', label: 'Film', path: 'film/', data: 'data/movies.json', key: 'items', icon: 'movie' },
      { id: 'manga', label: 'Manga', path: 'manga/', data: 'data/manga.json', key: 'items', icon: 'manga' },
      { id: 'book', label: 'Kitap', path: 'kitap/', data: 'data/books.json', key: 'items', icon: 'book' }
    ];

    function computeQuickScore(it) {
      if (!it || typeof it !== 'object') return null;
      const ps = Array.isArray(it.parts) ? it.parts : [];
      let wSum = 0, wTot = 0;
      for (const p of ps) {
        if (!p) continue;
        const sc = Number(p.score);
        if (!isNaN(sc) && sc > 0) {
          const w = (p.kind === 'movie' || p.format === 'MOVIE') ? 0.35 : (p.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(p.format)) ? 0.15 : 1.0;
          wSum += sc * w;
          wTot += w;
        }
      }
      if (wTot > 0) return Math.round((wSum / wTot) * 10) / 10;
      const d = Number(it.score);
      return (!isNaN(d) && d > 0) ? Math.round(d * 10) / 10 : null;
    }

    async function ensureIndexLoaded() {
      if (indexedItems) return indexedItems;
      if (loadingPromise) return loadingPromise;
      loadingPromise = (async () => {
        const all = [];
        const prevAnime = json('tp_anime_preview');
        const prevMulti = json('tp_multimedia_preview') || {};

        await Promise.all(SECTION_DEFS.map(async sec => {
          try {
            let doc = null;
            const r = await fetch(root + sec.data, { cache: 'no-store' }).catch(() => null);
            if (r && r.ok) doc = await r.json();
            if (sec.id === 'anime' && prevAnime && Array.isArray(prevAnime.anime) && prevAnime.anime.length >= ((doc && doc.anime && doc.anime.length) || 0)) {
              doc = prevAnime;
            } else if (prevMulti[sec.id] && Array.isArray(prevMulti[sec.id].items) && prevMulti[sec.id].items.length > 0 && prevMulti[sec.id].items.length >= ((doc && (doc.items || doc[sec.key]) || []).length)) {
              doc = prevMulti[sec.id];
            }
            const arr = (doc && (doc.items || doc[sec.key] || doc.anime || doc.guides)) || [];
            for (const it of arr) {
              if (!it || !it.title) continue;
              const cats = Array.isArray(it.customGenres) && it.customGenres.length ? it.customGenres : (it.genres || []);
              const sc = sec.isGuide ? null : computeQuickScore(it);
              const extra = it.author || it.director || it.network || it.forumSection || '';
              // [AI-MIMARI-NOTU: ADIM 21]: Sezon/film/yan içerik alt başlıkları (ör. Mugen Train) ve çıkış yılları da arama indeksine eklendi.
              const partNames = Array.isArray(it.parts) ? it.parts.map(p => (p && p.name) || '').filter(Boolean).join(' ') : '';
              const yearStr = it.year || (Array.isArray(it.parts) && it.parts.find(p => p && p.year) ? String(it.parts.find(p => p && p.year).year) : '');
              const hay = `${it.title} ${cats.join(' ')} ${extra} ${it.summary || ''} ${partNames} ${yearStr}`.toLocaleLowerCase('tr');
              all.push({
                id: it.id,
                title: it.title,
                sectionId: sec.id,
                sectionLabel: sec.label,
                sectionPath: sec.path,
                icon: sec.icon,
                isGuide: Boolean(sec.isGuide),
                url: it.url || it.firstSeasonUrl || '',
                image: it.image || '',
                score: sc,
                favorite: Boolean(it.favorite),
                categories: cats.slice(0, 3),
                extra,
                addedAt: it.addedAt || '',
                hay
              });
            }
          } catch (e) {}
        }));

        indexedItems = all;
        return all;
      })();
      return loadingPromise;
    }

    function ensureModalDOM() {
      if (modal) return;
      modal = el('div', 'cmdk-modal');
      modal.hidden = true;
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Evrensel Arama ve Komut Paleti');
      modal.innerHTML = `
        <div class="cmdk-bg"></div>
        <div class="cmdk-card sq">
          <div class="cmdk-top">
            ${icon('search')}
            <input type="search" class="cmdk-inp" placeholder="Anime, rehber, dizi, film, manga, kitap veya komut ara..." autocomplete="off">
            <button type="button" class="cmdk-kbd" data-cmdk-close>ESC</button>
          </div>
          <div class="cmdk-ScopeBar cmdk-scope-bar" role="group" aria-label="Bölüm filtresi"></div>
          <div class="cmdk-list" role="listbox"></div>
          <div class="cmdk-foot">
            <span>↑↓ Gezin · Enter Aç · ESC Kapat</span>
            <span id="cmdkCountLbl"></span>
          </div>
        </div>
      `;
      document.body.append(modal);
      inp = modal.querySelector('.cmdk-inp');
      listEl = modal.querySelector('.cmdk-list');
      scopeBar = modal.querySelector('.cmdk-ScopeBar');

      const scopes = [
        ['all', 'Tümü'],
        ['fav', '★ Başyapıt / Öne Çıkan'],
        ['anime', 'Anime'],
        ['guide', 'Rehber'],
        ['series', 'Dizi'],
        ['movie', 'Film'],
        ['manga', 'Manga'],
        ['book', 'Kitap']
      ];
      for (const [val, lbl] of scopes) {
        const b = el('button', 'cmdk-scope-btn', lbl);
        b.type = 'button';
        b.dataset.scope = val;
        b.setAttribute('aria-pressed', val === activeScope);
        b.onclick = () => {
          activeScope = val;
          scopeBar.querySelectorAll('.cmdk-scope-btn').forEach(x => x.setAttribute('aria-pressed', x.dataset.scope === activeScope));
          if (typeof b.scrollIntoView === 'function') {
            b.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
          }
          activeIdx = 0;
          renderResults();
          inp.focus();
        };
        scopeBar.append(b);
      }

      modal.querySelector('.cmdk-bg').onclick = closeCommandPalette;
      modal.querySelector('[data-cmdk-close]').onclick = closeCommandPalette;
      inp.oninput = () => {
        activeIdx = 0;
        renderResults();
      };
      inp.onkeydown = e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentMatches.length) {
            activeIdx = (activeIdx + 1) % currentMatches.length;
            syncActiveHighlight();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentMatches.length) {
            activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
            syncActiveHighlight();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (currentMatches[activeIdx]) {
            triggerResultItem(currentMatches[activeIdx]);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeCommandPalette();
        }
      };
    }

    function syncActiveHighlight() {
      if (!listEl) return;
      const rows = [...listEl.querySelectorAll('.cmdk-item')];
      rows.forEach((r, i) => {
        r.classList.toggle('active', i === activeIdx);
        if (i === activeIdx && typeof r.scrollIntoView === 'function') {
          r.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function triggerResultItem(entry) {
      if (!entry) return;
      if (entry.isCommand && typeof entry.run === 'function') {
        closeCommandPalette();
        entry.run();
        return;
      }
      if (entry.isGuide) {
        closeCommandPalette();
        if (entry.url) {
          window.open(entry.url, '_blank', 'noopener');
        } else {
          location.href = root + entry.sectionPath;
        }
        return;
      }
      closeCommandPalette();
      if (cur === entry.sectionId) {
        // [AI-MIMARI-NOTU: ADIM 21]: Hash zaten hedef yapıma aitse tarayıcı hashchange tetiklemeyebilir; yapay HashChangeEvent ile modal açılışı garantiye alınır.
        const targetHash = '#' + encodeURIComponent(entry.id);
        if (location.hash === targetHash) {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } else {
          location.hash = targetHash;
        }
      } else {
        location.href = `${root}${entry.sectionPath}#${encodeURIComponent(entry.id)}`;
      }
    }

    function renderResults() {
      if (!listEl) return;
      listEl.replaceChildren();
      const q = (inp.value || '').trim().toLocaleLowerCase('tr');
      const all = indexedItems || [];

      const quickCommands = [];
      if (activeScope === 'all' && (!q || 'rastgele seç ne izlesem okusam'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '🎲 Rastgele Bir Yapım / Rehber Öner',
          sub: 'Arşivdeki kayıtlar arasından rastgele birini seçip açar',
          badge: 'Kısayol',
          icon: 'dice',
          run: () => {
            const rndBtn = document.getElementById('randomPickBtn');
            if (rndBtn) {
              rndBtn.click();
            } else if (all.length) {
              const pick = all[Math.floor(Math.random() * all.length)];
              triggerResultItem(pick);
            }
          }
        });
      }
      if (activeScope === 'all' && (!q || 'tema değiştir karanlık açık koyu'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '🌗 Temayı Değiştir (Açık / Koyu)',
          sub: 'Görünüm temasını anında değiştirir',
          badge: 'Komut',
          icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon',
          run: () => window.toggleTheme && window.toggleTheme()
        });
      }
      if (activeScope === 'all' && (!q || 'zaman tüneli yolculuk kronoloji timeline geçmiş'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '⏳ Zaman Tüneline Git',
          sub: 'Yıllara göre izlenen ve okunan yapımların kronolojik akışı',
          badge: 'Sayfa',
          icon: 'clock',
          run: () => { location.href = root + 'zaman-tuneli/'; }
        });
      }
      if (activeScope === 'all' && (!q || 'istatistik grafikler analiz stats rapor'.includes(q))) {
        quickCommands.push({
          isCommand: true,
          title: '📊 Genel İstatistiklere Git',
          sub: 'Tüm kategorilerin arşiv özet ve grafik dağılımları',
          badge: 'Sayfa',
          icon: 'chart',
          run: () => { location.href = root + 'istatistik/'; }
        });
      }

      const matched = all.filter(item => {
        if (activeScope === 'fav' && !item.favorite) return false;
        if (activeScope !== 'all' && activeScope !== 'fav' && item.sectionId !== activeScope) return false;
        if (q && !item.hay.includes(q)) return false;
        return true;
      });

      matched.sort((a, b) => {
        if (q) {
          const aStarts = a.title.toLocaleLowerCase('tr').startsWith(q) ? 1 : 0;
          const bStarts = b.title.toLocaleLowerCase('tr').startsWith(q) ? 1 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;
        }
        return (Number(b.favorite) - Number(a.favorite)) || ((b.score || 0) - (a.score || 0)) || (b.addedAt || '').localeCompare(a.addedAt || '');
      });

      currentMatches = [...quickCommands, ...matched.slice(0, 45)];
      const countLbl = document.getElementById('cmdkCountLbl');
      if (countLbl) countLbl.textContent = `${matched.length} sonuç`;

      if (!currentMatches.length) {
        const empty = el('p', 'note', 'Eşleşen içerik bulunamadı.');
        empty.style.padding = '28px 12px';
        listEl.append(empty);
        return;
      }

      const fr = document.createDocumentFragment();
      currentMatches.forEach((m, idx) => {
        const btn = el('button', 'cmdk-item' + (idx === activeIdx ? ' active' : ''));
        btn.type = 'button';
        if (m.image) {
          const im = el('img', 'cmdk-thumb');
          im.src = resolveAsset(m.image);
          im.alt = '';
          im.loading = 'lazy';
          btn.append(im);
        } else {
          const ic = el('span', 'cmdk-ic');
          ic.innerHTML = icon(m.icon || 'sparkle');
          btn.append(ic);
        }
        const info = el('div', 'cmdk-info');
        const tRow = el('div', 'cmdk-title', m.title);
        info.append(tRow);
        const subParts = m.isCommand
          ? [m.sub]
          : [m.sectionLabel, m.extra, ...(m.categories || [])].filter(Boolean);
        info.append(el('div', 'cmdk-sub', subParts.join(' · ')));
        btn.append(info);

        if (m.favorite) {
          btn.append(el('span', 'cmdk-badge fav', m.isGuide ? '★ Öne Çıkan' : '★ Başyapıt'));
        }
        if (m.score) {
          btn.append(el('span', 'cmdk-badge', '★ ' + m.score));
        } else if (m.badge) {
          btn.append(el('span', 'cmdk-badge', m.badge));
        } else {
          btn.append(el('span', 'cmdk-badge', m.sectionLabel));
        }

        btn.onclick = () => triggerResultItem(m);
        fr.append(btn);
      });
      listEl.append(fr);
    }

    async function openCommandPalette(initialScope = 'all') {
      ensureModalDOM();
      if (initialScope) {
        activeScope = initialScope;
        scopeBar.querySelectorAll('.cmdk-scope-btn').forEach(x => x.setAttribute('aria-pressed', x.dataset.scope === activeScope));
      }
      modal.hidden = false;
      renderResults();
      inp.focus();
      inp.select();
      await ensureIndexLoaded();
      renderResults();
    }

    function closeCommandPalette() {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
    }

    window.openCommandPalette = openCommandPalette;

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal && !modal.hidden) closeCommandPalette();
        else openCommandPalette('all');
      } else if (e.key === 'Escape' && modal && !modal.hidden) {
        e.preventDefault();
        closeCommandPalette();
      }
    });
  })();

  // ============================================================================
  // [YENİ ÖZELLİK 1]: AKILLI YUKARI ÇIK (BACK TO TOP) BUTONU
  // ============================================================================
  (() => {
    let topBtn = null;
    function ensureBackToTopBtn() {
      if (topBtn) return topBtn;
      topBtn = document.createElement('button');
      topBtn.type = 'button';
      topBtn.className = 'back-to-top glass';
      topBtn.id = 'backToTopBtn';
      topBtn.setAttribute('aria-label', 'Yukarı Çık');
      topBtn.setAttribute('title', 'Yukarı Çık');
      topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
      topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.appendChild(topBtn);
      return topBtn;
    }

    let isScrolling = false;
    window.addEventListener('scroll', () => {
      if (isScrolling) return;
      isScrolling = true;
      requestAnimationFrame(() => {
        const btn = ensureBackToTopBtn();
        if (window.scrollY > 320) {
          btn.classList.add('visible');
        } else {
          btn.classList.remove('visible');
        }
        isScrolling = false;
      });
    }, { passive: true });
  })();

  // ============================================================================
  // [YENİ ÖZELLİK 2]: HIZLI ARAMA KISAYOLU (/), TEMİZLEME (✕), ESC VE YARDIM PENCERESİ (?)
  // ============================================================================
  (() => {
    // 1. Kısayol Yardım Penceresi (Modal)
    let kbdOverlay = null;
    const createKbdModal = () => {
      if (kbdOverlay) return kbdOverlay;
      kbdOverlay = document.createElement('div');
      kbdOverlay.className = 'kbd-overlay';
      kbdOverlay.setAttribute('role', 'dialog');
      kbdOverlay.setAttribute('aria-modal', 'true');
      kbdOverlay.setAttribute('aria-label', 'Klavye Kısayolları');
      kbdOverlay.innerHTML = `
        <div class="kbd-dialog glass sq">
          <div class="kbd-head">
            <h3>Klavye Kısayolları</h3>
            <button type="button" class="kbd-close" aria-label="Kapat">✕</button>
          </div>
          <ul class="kbd-list">
            <li><span>Arama kutusuna odaklan</span><div class="kbd-keys"><kbd>/</kbd></div></li>
            <li><span>Açık pencereyi kapat / Aramayı temizle</span><div class="kbd-keys"><kbd>Esc</kbd></div></li>
            <li><span>Koyu / Açık tema değiştir</span><div class="kbd-keys"><kbd>T</kbd></div></li>
            <li><span>Rastgele yapım seç</span><div class="kbd-keys"><kbd>R</kbd></div></li>
            <li><span>Kart / Liste / Katman görünümü</span><div class="kbd-keys"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></div></li>
            <li><span>Bu yardım penceresini aç / kapat</span><div class="kbd-keys"><kbd>?</kbd></div></li>
          </ul>
        </div>
      `;
      document.body.appendChild(kbdOverlay);
      kbdOverlay.addEventListener('click', e => {
        if (e.target === kbdOverlay || e.target.closest('.kbd-close')) {
          closeKbdModal();
        }
      });
      return kbdOverlay;
    };

    const toggleKbdModal = () => {
      const modal = createKbdModal();
      modal.classList.toggle('open');
    };
    const closeKbdModal = () => {
      if (kbdOverlay) kbdOverlay.classList.remove('open');
    };

    // 2. Klavye Dinleyicisi
    document.addEventListener('keydown', e => {
      const activeTag = document.activeElement && document.activeElement.tagName;
      const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
      
      // '?' Tuşu: Kısayol modalını aç/kapat
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isInputActive) {
        e.preventDefault();
        toggleKbdModal();
        return;
      }

      // '/' Tuşu: Arama kutusuna odaklan
      if (e.key === '/' && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const searchInp = document.getElementById('search') || document.getElementById('q') || document.querySelector('input[type="search"]');
        if (searchInp) {
          e.preventDefault();
          searchInp.focus();
          searchInp.select();
        }
      }
      // 'Escape' Tuşu: Modal açıksa kapat, yoksa arama kutusundaysa metni temizle ve odaktan çık
      else if (e.key === 'Escape') {
        if (kbdOverlay && kbdOverlay.classList.contains('open')) {
          e.preventDefault();
          closeKbdModal();
          return;
        }
        if (isInputActive) {
          const searchInp = document.activeElement;
          if (searchInp && (searchInp.id === 'search' || searchInp.id === 'q' || searchInp.type === 'search')) {
            if (searchInp.value) {
              searchInp.value = '';
              searchInp.dispatchEvent(new Event('input', { bubbles: true }));
            }
            searchInp.blur();
          }
        }
      }
      // 'T' Tuşu: Tema değiştir
      else if ((e.key === 't' || e.key === 'T') && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (typeof window.toggleTheme === 'function') {
          e.preventDefault();
          window.toggleTheme();
        }
      }
      // 'R' Tuşu: Rastgele seç (varsa)
      else if ((e.key === 'r' || e.key === 'R') && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const diceBtn = document.getElementById('randomPickBtn') || document.querySelector('[data-icon="dice"]');
        if (diceBtn) {
          e.preventDefault();
          diceBtn.click();
        }
      }
      // '1', '2', '3' Tuşları: Görünüm değiştir
      else if (['1', '2', '3'].includes(e.key) && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const viewMap = { '1': 'grid', '2': 'list', '3': 'tier' };
        const viewBtn = document.querySelector(`[data-view="${viewMap[e.key]}"]`);
        if (viewBtn) {
          e.preventDefault();
          viewBtn.click();
        }
      }
    });

    // 3. Arama Temizleme (✕) Butonu ve Kısayol İpucu Entegrasyonu
    const mountSearchControls = () => {
      const searchInps = document.querySelectorAll('input#search, input#q, .search input');
      searchInps.forEach(searchInp => {
        const wrap = searchInp.parentElement;
        if (!wrap) return;
        wrap.classList.add('search-wrap');

        // Kısayol rozeti ('/')
        if (!wrap.querySelector('.search-kbd-hint')) {
          const hint = document.createElement('kbd');
          hint.className = 'search-kbd-hint';
          hint.textContent = '/';
          hint.setAttribute('title', 'Aramak için / tuşuna basın');
          wrap.appendChild(hint);
        }

        // Temizleme butonu ('✕')
        let clearBtn = wrap.querySelector('.search-clear');
        if (!clearBtn) {
          clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'search-clear';
          clearBtn.setAttribute('aria-label', 'Aramayı temizle');
          clearBtn.innerHTML = '✕';
          wrap.appendChild(clearBtn);

          const syncClear = () => {
            clearBtn.classList.toggle('on', Boolean(searchInp.value && searchInp.value.trim().length > 0));
          };
          searchInp.addEventListener('input', syncClear);
          syncClear();

          clearBtn.addEventListener('click', e => {
            e.preventDefault();
            searchInp.value = '';
            searchInp.dispatchEvent(new Event('input', { bubbles: true }));
            searchInp.focus();
            syncClear();
          });
        }
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountSearchControls);
    else mountSearchControls();
  })();

  // ============================================================================
  // [YENİ ÖZELLİK 3]: KIRIK GÖRSEL FALLBACK POSTERİ (SVG DİNAMİK YEDEKLEME)
  // ============================================================================
  (() => {
    window.addEventListener('error', e => {
      const target = e.target;
      if (target && target.tagName === 'IMG' && !target.dataset.fallbackApplied) {
        target.dataset.fallbackApplied = 'true';
        const altText = target.alt || target.title || 'Tempestian';
        const initial = (altText.trim()[0] || 'T').toUpperCase();
        const svgFallback = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231a1e2e"/><stop offset="100%" stop-color="%230f121d"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><rect x="12" y="12" width="276" height="396" rx="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/><text x="50%" y="46%" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="54" fill="rgba(255,255,255,0.35)" text-anchor="middle" dominant-baseline="central">${encodeURIComponent(initial)}</text><text x="50%" y="60%" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="14" fill="rgba(255,255,255,0.45)" text-anchor="middle" dominant-baseline="central">Görsel Yok</text></svg>`;
        target.src = svgFallback;
        target.classList.add('img-fallback-applied');
      }
    }, true);
  })();

  // ============================================================================
  // [IRIS FLYOUT CONTROL CAPSULE]: Minimal Island & Dropdown Control Center (Idea 3)
  // ============================================================================
  const initFlyoutCapsule = (sum) => {
    if (cur === 'admin') return;

    const bar = document.querySelector('.bar');
    if (!bar) return;
    const barIn = bar.querySelector('.bar-in');
    if (!barIn) return;

    let trigger = document.getElementById('flyoutTrigger');
    let menu = document.getElementById('flyoutMenu');

    if (trigger && !trigger.querySelector('.flyout-chevron')) {
      const ch = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ch.setAttribute('class', 'flyout-chevron');
      ch.setAttribute('viewBox', '0 0 24 24');
      ch.setAttribute('fill', 'none');
      ch.setAttribute('stroke', 'currentColor');
      ch.setAttribute('stroke-width', '2.2');
      ch.setAttribute('stroke-linecap', 'round');
      ch.setAttribute('stroke-linejoin', 'round');
      ch.setAttribute('aria-hidden', 'true');
      ch.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
      trigger.appendChild(ch);
    }

    // Alt sayfalarda flyoutTrigger veya flyoutMenu yoksa dinamik olarak inşa et
    if (!trigger || !menu) {
      const titleEl = barIn.querySelector('.bar-title');
      const curTitle = titleEl ? titleEl.textContent.trim() : (cur ? cur.charAt(0).toUpperCase() + cur.slice(1) : 'Menü');

      if (!trigger) {
        trigger = el('button', 'bar-title flyout-trigger');
        trigger.id = 'flyoutTrigger';
        trigger.type = 'button';
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', 'flyoutMenu');
        trigger.setAttribute('aria-label', 'Bölüm Değiştir');
        trigger.title = 'Bölümler Arasında Geçiş Yap';
        trigger.innerHTML = `<span>${esc(curTitle)}</span><svg class="flyout-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

        if (titleEl) {
          titleEl.replaceWith(trigger);
        } else {
          barIn.insertBefore(trigger, barIn.querySelector('.bar-actions') || null);
        }
      }

      if (!menu) {
        menu = el('div', 'flyout-menu');
        menu.id = 'flyoutMenu';
        menu.hidden = true;

        const isAct = (sec) => (cur === sec ? ' active' : '');

        menu.innerHTML = `
          <div class="flyout-header">
            <span class="flyout-sec-title">Gezinme & Arşiv</span>
          </div>
          <div class="flyout-grid">
            <a class="flyout-item${isAct('home')}" href="${root}">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Ana Sayfa</span>
                <span class="flyout-desc">Portal görünümü</span>
              </div>
            </a>
            <a class="flyout-item${isAct('anime')}" href="${root}anime/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Anime Arşivi</span>
                <span class="flyout-desc" id="flyAnimeDesc">İzleme Listesi · Puanlar</span>
              </div>
              <span class="flyout-badge">Aktif</span>
            </a>
            <a class="flyout-item${isAct('guide') || isAct('rehber')}" href="${root}rehber/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Rehberler</span>
                <span class="flyout-desc" id="flyGuideDesc">GNU/Linux & Donanım</span>
              </div>
              <span class="flyout-badge">Technopat</span>
            </a>
            <a class="flyout-item${isAct('series') || isAct('dizi')}" href="${root}dizi/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Dizi</span>
                <span class="flyout-desc">Dizi Arşivi</span>
              </div>
            </a>
            <a class="flyout-item${isAct('movie') || isAct('film')}" href="${root}film/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Film</span>
                <span class="flyout-desc">Sinema Arşivi</span>
              </div>
            </a>
            <a class="flyout-item${isAct('manga')}" href="${root}manga/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Manga</span>
                <span class="flyout-desc">Okuma Listesi</span>
              </div>
            </a>
            <a class="flyout-item${isAct('book') || isAct('kitap')}" href="${root}kitap/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Kitap</span>
                <span class="flyout-desc">Kitaplık</span>
              </div>
            </a>
          </div>
          <div class="flyout-sep"></div>
          <div class="flyout-header">
            <span class="flyout-sec-title">Zaman ve Metrikler</span>
          </div>
          <div class="flyout-grid">
            <a class="flyout-item${isAct('zaman-tuneli')}" href="${root}zaman-tuneli/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">Zaman Tüneli</span>
                <span class="flyout-desc">Kronolojik arşiv akışı</span>
              </div>
            </a>
            <a class="flyout-item${isAct('istatistik')}" href="${root}istatistik/">
              <span class="flyout-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
              <div class="flyout-info">
                <span class="flyout-name">İstatistikler</span>
                <span class="flyout-desc">Metrik ve grafikler</span>
              </div>
            </a>
          </div>
        `;
        bar.appendChild(menu);
      }
    }

    if (!trigger._flyoutBound) {
      trigger._flyoutBound = true;

      const toggle = (force) => {
        const open = force !== undefined ? force : menu.hidden;
        menu.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
        trigger.classList.toggle('open', open);
      };

      trigger.onclick = (e) => {
        e.stopPropagation();
        toggle();
      };

      if (new URLSearchParams(location.search).has('flyout')) {
        toggle(true);
      }

      menu.onclick = (e) => {
        if (e.target.closest('a')) {
          toggle(false);
        } else {
          e.stopPropagation();
        }
      };

      document.addEventListener('click', (e) => {
        if (!menu.hidden && !trigger.contains(e.target) && !menu.contains(e.target)) {
          toggle(false);
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.hidden) {
          toggle(false);
          trigger.focus();
        }
      });
    }

    if (sum && sum.anime && sum.anime.nums && sum.anime.nums[0]) {
      const el = document.getElementById('flyAnimeDesc');
      if (el) el.textContent = `${sum.anime.nums[0][0]} Anime · Arşiv`;
    }
    if (sum && sum.guide && sum.guide.nums && sum.guide.nums[0]) {
      const el = document.getElementById('flyGuideDesc');
      if (el) el.textContent = `${sum.guide.nums[0][0]} Rehber · Donanım & Linux`;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initFlyoutCapsule());
  } else {
    initFlyoutCapsule();
  }

})();
