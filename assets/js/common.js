// ============================================================================
// TEMPESTIAN — COMMON SHELL, NAVIGATION, HOME SPOTLIGHT & COMMAND PALETTE
// ============================================================================
(() => {
  const root = document.body.dataset.root || '';
  const cur = document.body.dataset.section || '';
  const el = (t, c, x) => {
    const e = document.createElement(t);
    if (c) e.className = c;
    if (x != null) e.textContent = x;
    return e;
  };
  const ls = (k, v) => {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {}
  };
  const json = k => {
    try { return JSON.parse(ls(k)); } catch (e) { return null; }
  };

  const P = {
    home: '<path d="M3.5 10.6 12 3.5l8.5 7.1V19a2 2 0 0 1-2 2h-4.2v-5a1.3 1.3 0 0 0-1.3-1.3h-2a1.3 1.3 0 0 0-1.3 1.3v5H5.5a2 2 0 0 1-2-2z"/>',
    anime: '<path d="M13 4H5.5A2.5 2.5 0 0 0 3 6.5v9A2.5 2.5 0 0 0 5.5 18h13a2.5 2.5 0 0 0 2.5-2.5V11"/><polygon points="10 8.5 14.8 11.2 10 14" fill="currentColor"/><path d="M8 21h8"/>',
    manga: '<rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M3.5 10h17"/><path d="M13 3l-2 7"/><path d="M11 10v11"/>',
    book: '<path d="M2.5 5.5A2.5 2.5 0 0 1 5 3h5.5A1.5 1.5 0 0 1 12 4.5v15a1.5 1.5 0 0 0-1.5-1.5H5a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M21.5 5.5A2.5 2.5 0 0 0 19 3h-5.5A1.5 1.5 0 0 0 12 4.5v15a1.5 1.5 0 0 1 1.5-1.5H19a2.5 2.5 0 0 0 2.5-2.5z"/>',
    movie: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    series: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="m8 2.8 4 4.2 4-4.2"/><polygon points="10.2 10.8 14.8 13.5 10.2 16.2" fill="currentColor"/>',
    guide: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7.5 9.5 3 2.5-3 2.5"/><path d="M12.5 14.5h4.5"/>',
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
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const resolveAsset = u => {
    if (!u) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
    return root + u.replace(/^\.?\//, '');
  };

  // ============================================================================
  // WEIGHTED RATING ENGINE (Preserved 100% for all archive pages)
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
    SCALE_MIN: 0.1,
    SCALE_MAX: 10,
    computeScore(criteria, subScores) {
      if (!subScores || typeof subScores !== 'object') return null;
      let totalScore = 0, totalWeight = 0;
      for (const c of criteria) {
        const val = Number(subScores[c.id]);
        if (!isNaN(val) && val > 0 && val <= 10) {
          totalScore += val * c.weight;
          totalWeight += c.weight;
        }
      }
      if (totalWeight <= 0) return null;
      return Math.round((totalScore / totalWeight) * 10) / 10;
    },
    _calibrateSubScores(criteria, rawMap, targetScore, emphasisMap = {}) {
      const target = Math.round(Math.max(0.1, Math.min(10.0, Number(targetScore))) * 10) / 10;
      const clamp10 = v => Math.round(Math.max(0.1, Math.min(10.0, v)) * 10) / 10;
      const out = {};
      for (const c of criteria) {
        const raw = Number(rawMap[c.id]);
        out[c.id] = clamp10(isNaN(raw) || raw <= 0 ? target : raw);
      }
      for (let step = 0; step < 60; step++) {
        const curVal = this.computeScore(criteria, out);
        if (curVal == null) break;
        const diff = Math.round((target - curVal) * 10) / 10;
        if (Math.abs(diff) < 1e-6) break;
        const dir = diff > 0 ? 0.1 : -0.1;
        let bestId = null, bestPenalty = Infinity;
        for (const c of criteria) {
          const nextVal = Math.round((out[c.id] + dir) * 10) / 10;
          if (nextVal < 0.1 || nextVal > 10.0) continue;
          const emp = emphasisMap[c.id] || 0;
          const penalty = (dir > 0 ? -emp : emp) + Math.abs(nextVal - target) * 0.15 - c.weight * 0.05;
          if (penalty < bestPenalty) { bestPenalty = penalty; bestId = c.id; }
        }
        if (!bestId) break;
        out[bestId] = Math.round((out[bestId] + dir) * 10) / 10;
      }
      return out;
    },
    deriveSubScores(typeKey, targetScore, profile = 'balanced') {
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria || targetScore == null || isNaN(targetScore) || Number(targetScore) <= 0) return null;
      const target = Math.round(Math.max(0.1, Math.min(10.0, Number(targetScore))) * 10) / 10;
      if (profile === 'balanced') {
        const flat = {};
        for (const c of criteria) flat[c.id] = target;
        return flat;
      }
      const profileOffsets = {
        action: { visuals: 0.9, sound: 0.5, enjoyment: 0.4, directing: 0.6, art: 0.8, production: 0.7, pacing: 0.5, story: -0.7, world: -0.3, characters: -0.4, acting: -0.4, prose: -0.7 },
        story: { story: 0.9, world: 0.6, prose: 0.8, characters: 0.2, impact: 0.3, visuals: -0.6, sound: -0.6, art: -0.5, pacing: -0.3, production: -0.5 },
        character: { characters: 0.9, acting: 0.8, enjoyment: 0.5, impact: 0.6, music_finale: 0.4, story: 0.1, visuals: -0.5, sound: -0.4, world: -0.5, directing: -0.3, prose: 0.1 }
      }[profile] || {};
      let totalW = 0, weightedOffsetSum = 0;
      for (const c of criteria) { totalW += c.weight; weightedOffsetSum += (profileOffsets[c.id] || 0) * c.weight; }
      const meanOffset = totalW > 0 ? weightedOffsetSum / totalW : 0;
      const centered = {};
      let scale = 1.0;
      const minBound = target >= 1.0 ? 1.0 : 0.1;
      for (const c of criteria) {
        const d = (profileOffsets[c.id] || 0) - meanOffset;
        centered[c.id] = d;
        if (d > 0 && target + d * scale > 10.0) scale = Math.min(scale, (10.0 - target) / d);
        else if (d < 0 && target + d * scale < minBound) scale = Math.min(scale, (target - minBound) / (-d));
      }
      scale = Math.max(0, scale);
      const initial = {};
      for (const c of criteria) initial[c.id] = Math.round((target + centered[c.id] * scale) * 10) / 10;
      return this._calibrateSubScores(criteria, initial, target, centered);
    },
    computeWeightedSubScores(typeKey, item) {
      if (!item) return null;
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria) return null;
      const partsArr = Array.isArray(item.parts) ? item.parts : [];
      const hasSub = p => p && p.subScores && typeof p.subScores === 'object' && Object.values(p.subScores).some(v => v != null && Number(v) > 0);
      const getWeight = p => (p.kind === 'movie' || p.format === 'MOVIE') ? 0.35 : ((p.kind === 'other' || ['OVA', 'SPECIAL', 'TV_SHORT'].includes(p.format)) ? 0.15 : 1.0);
      const ratedParts = partsArr.filter(p => hasSub(p) || (p && p.score != null && Number(p.score) > 0));
      const partsWithSub = ratedParts.filter(hasSub);
      if (partsWithSub.length === 0) {
        return (item.subScores && typeof item.subScores === 'object' && Object.values(item.subScores).some(v => v != null && Number(v) > 0)) ? { ...item.subScores } : null;
      }
      if (ratedParts.length === 1 && partsWithSub.length === 1) return { ...partsWithSub[0].subScores };
      const continuousAvg = {};
      let totalPartWeight = 0, weightedSumScore = 0;
      for (const p of ratedParts) {
        const sc = hasSub(p) ? this.computeScore(criteria, p.subScores) : Number(p.score);
        const w = getWeight(p);
        if (sc != null && !isNaN(sc) && sc > 0) { weightedSumScore += sc * w; totalPartWeight += w; }
      }
      for (const c of criteria) {
        let cSum = 0, cWeight = 0;
        for (const p of ratedParts) {
          const val = hasSub(p) ? Number(p.subScores[c.id]) : Number(p.score);
          if (!isNaN(val) && val > 0 && val <= 10) { const w = getWeight(p); cSum += val * w; cWeight += w; }
        }
        continuousAvg[c.id] = cWeight > 0 ? cSum / cWeight : 6;
      }
      const targetScore = totalPartWeight > 0 ? Math.round((weightedSumScore / totalPartWeight) * 10) / 10 : (Number(item.score) || 5);
      const roundedMap = {};
      for (const c of criteria) roundedMap[c.id] = Math.round(Math.max(0.1, Math.min(10.0, continuousAvg[c.id])) * 10) / 10;
      return this._calibrateSubScores(criteria, roundedMap, targetScore);
    },
    renderBreakdownGrid(typeKey, subScores) {
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria) return '';
      return criteria.map(c => {
        const raw = Number(subScores && subScores[c.id]) || 0;
        const val = raw > 0 ? Math.max(0.1, Math.min(10, raw)) : 0;
        const pct = Math.round((val / 10) * 100);
        const weightPct = Math.round(c.weight * 100);
        const tierCls = val >= 9 ? ' tier-master' : val >= 7.5 ? ' tier-high' : val >= 5 ? ' tier-mid' : val > 0 ? ' tier-low' : '';
        const valText = val > 0 ? `${val.toFixed(1)}/10` : '-';
        return `<div class="sh-rb-item${tierCls}" title="${c.desc} (Ağırlık: %${weightPct})"><div class="sh-rb-top"><span class="sh-rb-lbl">${c.label}</span><span class="sh-rb-num">${valText}</span></div><div class="sh-rb-bar" role="progressbar" aria-valuenow="${val}" aria-valuemin="0" aria-valuemax="10"><div class="sh-rb-bar-fill" style="width:${pct}%"></div></div></div>`;
      }).join('');
    },
    renderBreakdownHtml(typeKey, subScores, overallScore) {
      return `<div class="sh-rb-head"><span class="sh-rb-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/></svg>Detaylı Puanlama Karnesi</span><span class="sh-rb-score">★ ${overallScore || '-'} / 10</span></div><div class="sh-rb-grid">${this.renderBreakdownGrid(typeKey, subScores)}</div>`;
    },
    renderSheetBreakdown(containerEl, typeKey, item, overallScore) {
      if (!containerEl || !item) return;
      const criteria = this.CRITERIA[typeKey] || this.CRITERIA.anime;
      if (!criteria) { containerEl.hidden = true; containerEl.replaceChildren(); return; }
      const partsArr = Array.isArray(item.parts) ? item.parts : [];
      const ratedParts = partsArr.filter(p => p && p.subScores && typeof p.subScores === 'object' && Object.values(p.subScores).some(v => v != null && Number(v) > 0));
      let effectiveItemSubScores = (item.subScores && typeof item.subScores === 'object' && Object.values(item.subScores).some(v => v != null && Number(v) > 0)) ? item.subScores : null;
      if (!effectiveItemSubScores && ratedParts.length > 0) effectiveItemSubScores = this.computeWeightedSubScores(typeKey, item);
      if (!ratedParts.length && !effectiveItemSubScores) { containerEl.hidden = true; containerEl.replaceChildren(); return; }
      containerEl.hidden = false;
      if (ratedParts.length <= 1) {
        const targetScores = effectiveItemSubScores || (ratedParts.length === 1 ? ratedParts[0].subScores : null);
        const targetTitle = (ratedParts.length === 1 && ratedParts[0].name && ratedParts[0].name !== item.title) ? `Detaylı Puanlama Karnesi · ${ratedParts[0].name}` : 'Detaylı Puanlama Karnesi';
        const targetScore = overallScore || (ratedParts.length === 1 && ratedParts[0].score != null ? ratedParts[0].score : null);
        containerEl.innerHTML = `<div class="sh-rb-head"><span class="sh-rb-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/></svg>${esc(targetTitle)}</span><span class="sh-rb-score">★ ${targetScore || '-'} / 10</span></div><div class="sh-rb-grid">${this.renderBreakdownGrid(typeKey, targetScores)}</div>`;
        return;
      }
      const tabs = [];
      if (effectiveItemSubScores) tabs.push({ id: 'item_overall', name: 'Genel', score: overallScore, subScores: effectiveItemSubScores });
      ratedParts.forEach((p, idx) => tabs.push({ id: 'part_' + idx, name: p.name || `${idx + 1}. Sezon`, score: p.score != null ? p.score : this.computeScore(criteria, p.subScores), subScores: p.subScores }));
      let activeTabIdx = 0;
      const renderView = () => {
        const curTab = tabs[activeTabIdx] || tabs[0];
        const tabsHtml = tabs.map((t, i) => `<button type="button" class="sh-rb-tab${i === activeTabIdx ? ' active' : ''}" data-tab-idx="${i}" role="tab" aria-selected="${i === activeTabIdx}"><span>${esc(t.name)}</span><span class="sh-rb-tab-score"> · ${t.score || '-'}</span></button>`).join('');
        containerEl.innerHTML = `<div class="sh-rb-head"><span class="sh-rb-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/></svg>Detaylı Puanlama Karnesi</span><span class="sh-rb-score">★ ${curTab.score || overallScore || '-'} / 10</span></div><div class="sh-rb-tabs" role="tablist">${tabsHtml}</div><div class="sh-rb-grid">${this.renderBreakdownGrid(typeKey, curTab.subScores)}</div>`;
        containerEl.querySelectorAll('.sh-rb-tab').forEach(btn => {
          btn.onclick = e => { e.stopPropagation(); activeTabIdx = Number(btn.dataset.tabIdx); renderView(); };
        });
      };
      renderView();
    }
  };

  // Hybrid Date Formatter
  const TURKISH_MONTHS = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const formatHybridDate = val => {
    if (!val || typeof val !== 'string') return '';
    const s = val.trim();
    const mMatch = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (mMatch) {
      const mName = TURKISH_MONTHS[parseInt(mMatch[2], 10)];
      return mName ? `${mName} ${mMatch[1]}` : mMatch[1];
    }
    return s;
  };
  window.formatHybridDate = formatHybridDate;

  // Parts & Tally Utilities
  const parts = it => {
    const raw = it.parts || (it.seasons || []).map(s => ({ ...s, kind: 'season' }));
    if (!raw.length && it.status === 'completed') return [{ kind: 'season', status: 'COMPLETED', episodes: 1, watched: 1, repeat: 0 }];
    const anyDone = raw.some(p => p && (p.status === 'COMPLETED' || (p.watched || 0) > 0));
    return raw.map((p, idx) => {
      const ep = Math.max(0, Number(p.episodes) || 0);
      let w = Math.max(0, Number(p.watched) || 0);
      let st = p.status || 'NONE';
      if (!anyDone && it.status === 'completed' && (p.kind === 'season' || idx === 0)) st = 'COMPLETED';
      if (st === 'COMPLETED' && w === 0) w = ep > 0 ? ep : 1;
      if (ep > 0 && w >= ep && st === 'CURRENT') st = 'COMPLETED';
      return { ...p, kind: p.kind === 'movie' ? 'movie' : p.kind === 'other' ? 'other' : 'season', episodes: ep, watched: w, status: st };
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
      const isCounted = rule === 'completed_only' ? it.status === 'completed'
        : rule === 'any_watched' ? (active.length > 0 || done.length > 0 || it.status === 'completed')
        : (doneSeasonOrMovie.length > 0 || (done.length > 0 && !ps.some(p => p.kind === 'season' || p.kind === 'movie')) || it.status === 'completed');
      for (const p of done) {
        if (isCounted) { if (p.kind === 'season') t.season++; else if (p.kind === 'movie') t.film++; }
        t.ep += p.watched;
      }
      if (includeInProgress) {
        for (const p of active) { if (p.status !== 'COMPLETED') t.ep += p.watched; }
      }
      if (isCounted) t.anime++;
    }
    return t;
  };

  function showToast(msg, type = 'info') {
    let t = document.getElementById('tpToast');
    if (!t) {
      t = el('div', 'tp-toast');
      t.id = 'tpToast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.dataset.type = type;
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('visible'), 3000);
  }
  window.showToast = showToast;
  window.UI = { icon, el, parts, tally, resolveAsset, esc, icons: Object.keys(P), updateAmbientGlow() {}, hideAmbientGlow() {}, openTrailer() {}, closeTrailer() {}, showToast };

  // ============================================================================
  // UNIFIED TOP NAVIGATION BAR (Matches 4376.jpg across ALL pages)
  // ============================================================================
  function bindThemeAndIcons() {
    const themeBtn = document.getElementById('theme');
    const syncIcons = () => {
      document.querySelectorAll('[data-icon]').forEach(b => {
        b.innerHTML = icon(b.dataset.icon === 'theme' ? (document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon') : b.dataset.icon);
      });
      if (themeBtn) themeBtn.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
    };
    syncIcons();
    if (!window.__tpThemeBound) {
      window.__tpThemeBound = true;
      document.addEventListener('themechange', syncIcons);
    }
    if (themeBtn) themeBtn.onclick = () => window.toggleTheme();
  }

  function initTopNav() {
    if (cur === 'admin') {
      bindThemeAndIcons();
      return;
    }
    const dock = document.getElementById('dock');
    if (dock) dock.remove();

    const bar = document.querySelector('.bar');
    if (!bar) return;

    const navItems = [
      { id: 'anime', label: 'Anime', path: 'anime/' },
      { id: 'movie', label: 'Film', path: 'film/' },
      { id: 'series', label: 'Dizi', path: 'dizi/' },
      { id: 'book', label: 'Kitap', path: 'kitap/' },
      { id: 'manga', label: 'Manga', path: 'manga/' },
      { id: 'guide', label: 'Rehber', path: 'rehber/' }
    ];

    const isNavActive = id => {
      if (cur === id) return true;
      if (id === 'movie' && cur === 'film') return true;
      if (id === 'series' && cur === 'dizi') return true;
      if (id === 'book' && cur === 'kitap') return true;
      if (id === 'guide' && cur === 'rehber') return true;
      return false;
    };

    // Preserve any existing stats link on subpages (e.g. anime/istatistik/)
    const existingStatsBtn = bar.querySelector('.bar-stats-btn');
    const statsHref = existingStatsBtn ? existingStatsBtn.getAttribute('href') : null;
    const statsTitle = existingStatsBtn ? existingStatsBtn.getAttribute('title') : 'İstatistikler';

    bar.innerHTML = `
      <div class="bar-in">
        <div class="bar-left">
          <a class="nav-brand" href="${root || './'}" id="barTitle">Tempestian</a>
          <nav class="top-nav" aria-label="Ana gezinme">
            ${navItems.map(n => `<a class="nav-link${isNavActive(n.id) ? ' active' : ''}" href="${root}${n.path}" data-nav="${n.id}">${n.label}</a>`).join('')}
          </nav>
        </div>
        <div class="bar-actions">
          ${statsHref ? `<a class="btn bar-stats-btn" href="${esc(statsHref)}" title="${esc(statsTitle)}" aria-label="${esc(statsTitle)}">${icon('chart')}</a>` : ''}
          <button class="search-pill" id="searchTrigger" type="button" aria-label="Hızlı Arama" title="Hızlı Arama (/ veya Ctrl+K)">
            <span>Ara</span>
            <kbd>/</kbd>
          </button>
          <button class="btn" id="theme" type="button" data-icon="theme" aria-label="Tema"></button>
        </div>
      </div>
    `;

    const themeBtn = document.getElementById('theme');
    const syncIcons = () => {
      document.querySelectorAll('[data-icon]').forEach(b => {
        b.innerHTML = icon(b.dataset.icon === 'theme' ? (document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon') : b.dataset.icon);
      });
      if (themeBtn) themeBtn.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
    };
    syncIcons();
    document.addEventListener('themechange', syncIcons);
    if (themeBtn) themeBtn.onclick = () => window.toggleTheme();

    const searchBtn = document.getElementById('searchTrigger');
    if (searchBtn) {
      searchBtn.onclick = e => {
        e.preventDefault();
        if (typeof window.openCommandPalette === 'function') window.openCommandPalette();
      };
    }

    let on = false;
    const upd = () => {
      const n = scrollY > 18;
      if (n !== on) { on = n; bar.classList.toggle('on', n); }
    };
    addEventListener('scroll', upd, { passive: true });
    upd();
  }

  // ============================================================================
  // HOME PAGE RENDERERS (Hero Spotlight, Öne Çıkan Başyapıtlar, Devam Edilecek)
  // ============================================================================
  const FMT_LABEL = { TV: 'TV', TV_SHORT: 'Kısa', MOVIE: 'Film', OVA: 'OVA', SPECIAL: 'Özel', ONA: 'ONA' };

  function buildPosterCard(item, href, gradIndex, showStatus) {
    const a = el('a', `poster-card grad-${gradIndex % 10}`);
    a.href = href;
    if (item.image) {
      const img = el('img');
      img.src = resolveAsset(item.image.replace('/cover/medium/', '/cover/large/'));
      img.alt = item.title || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.onload = () => img.classList.add('in');
      a.append(img);
    }
    if (typeof item.score === 'number' && item.score > 0) {
      const badge = el('span', 'poster-rating');
      badge.innerHTML = `<span class="star">★</span>${item.score.toFixed(1)}`;
      a.append(badge);
    }
    if (showStatus) {
      const stTxt = item.status === 'watching' ? 'İzleniyor' : item.status === 'paused' ? 'Beklemede' : '';
      if (stTxt) a.append(el('span', 'poster-status-dot', stTxt));
    }
    const title = el('h3', 'poster-title', item.title || '');
    a.append(title);
    return a;
  }

  function renderHeroSpotlight(animeList) {
    const heroEl = document.getElementById('heroSpotlight');
    if (!heroEl || !Array.isArray(animeList) || !animeList.length) return;

    let target = null, targetPart = null;
    for (const a of animeList) {
      if (a && a.status === 'watching' && Array.isArray(a.parts)) {
        const cp = a.parts.find(p => p && p.status === 'CURRENT');
        if (cp) { target = a; targetPart = cp; break; }
      }
    }
    if (!target) {
      target = animeList.find(a => a && a.status === 'watching') || animeList[0];
      if (target && Array.isArray(target.parts)) {
        targetPart = target.parts.find(p => p && p.status === 'CURRENT') || target.parts[0];
      }
    }
    if (!target) return;

    const titleEl = document.getElementById('heroSpotlightTitle');
    const metaEl = document.getElementById('heroSpotlightMeta');
    const bgImg = document.getElementById('heroBgImg');
    const pgGroup = document.getElementById('heroProgressGroup');
    const pgFill = document.getElementById('heroProgressFill');
    const pgText = document.getElementById('heroProgressText');
    const detailBtn = document.getElementById('heroDetailBtn');
    const archiveBtn = document.getElementById('heroArchiveBtn');

    if (titleEl) titleEl.textContent = target.title || 'Tempestian';

    const fmt = targetPart && targetPart.format ? (FMT_LABEL[targetPart.format] || targetPart.format) : 'TV';
    const year = (targetPart && targetPart.year) || (target.parts && target.parts[0] && target.parts[0].year) || '';
    const genres = (Array.isArray(target.customGenres) && target.customGenres.length ? target.customGenres : (target.genres || [])).slice(0, 3);
    const metaParts = [fmt, year, ...genres].filter(Boolean);
    if (metaEl) metaEl.textContent = metaParts.join(' · ');

    const bgUrl = target.banner || target.image || '';
    if (bgImg && bgUrl) {
      bgImg.onload = () => bgImg.classList.add('loaded');
      bgImg.src = resolveAsset(bgUrl);
    }

    const watched = (targetPart && typeof targetPart.watched === 'number') ? targetPart.watched : 0;
    const total = (targetPart && typeof targetPart.episodes === 'number') ? targetPart.episodes : 0;
    if (pgGroup && (watched > 0 || total > 0)) {
      const pct = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 25;
      if (pgFill) pgFill.style.width = pct + '%';
      if (pgText) pgText.textContent = total > 0 ? `${watched} / ${total} bölüm` : `${watched} bölüm`;
      pgGroup.hidden = false;
    }

    if (detailBtn) detailBtn.href = root + 'anime/#' + encodeURIComponent(target.id || '');
    if (archiveBtn) archiveBtn.href = root + 'anime/';
    heroEl.dataset.heroId = target.id || '';
  }

  function renderHomeHighlights(animeList, cfg) {
    const sec = document.getElementById('homeHighlights');
    const rail = document.getElementById('hhRail');
    if (!sec || !rail || !Array.isArray(animeList) || !animeList.length) return;

    const hf = (cfg && cfg.homeFeatures) || {};
    if (hf.highlightsEnabled === false) { sec.hidden = true; return; }
    const titleEl = document.getElementById('hhTitle');
    if (titleEl && hf.highlightsTitle) titleEl.textContent = hf.highlightsTitle;

    const minScore = typeof hf.highlightsMinScore === 'number' ? hf.highlightsMinScore : 8.5;
    const limit = Math.max(7, Number(hf.highlightsLimit) || 10);

    let standout = animeList
      .filter(a => a && typeof a.score === 'number' && a.score >= minScore)
      .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
      .slice(0, limit);

    if (!standout.length) return;
    const fr = document.createDocumentFragment();
    standout.forEach((a, i) => fr.append(buildPosterCard(a, root + 'anime/#' + encodeURIComponent(a.id || ''), i, false)));
    rail.replaceChildren(fr);
    sec.hidden = false;
  }

  function renderHomeContinue(animeList) {
    const sec = document.getElementById('homeContinue');
    const rail = document.getElementById('continueRail');
    if (!sec || !rail || !Array.isArray(animeList) || !animeList.length) return;

    const heroId = (document.getElementById('heroSpotlight') && document.getElementById('heroSpotlight').dataset.heroId) || '';
    const queue = animeList.filter(a => {
      if (!a || a.id === heroId) return false;
      return a.status === 'watching' || a.status === 'paused' || Boolean(a.next);
    });

    if (!queue.length) { sec.hidden = true; return; }
    const fr = document.createDocumentFragment();
    queue.slice(0, 12).forEach((a, i) => fr.append(buildPosterCard(a, root + 'anime/#' + encodeURIComponent(a.id || ''), i + 7, false)));
    rail.replaceChildren(fr);
    sec.hidden = false;
  }

  function renderHomeMovies(movieList) {
    const sec = document.getElementById('homeMovies');
    const rail = document.getElementById('moviesRail');
    if (!sec || !rail || !Array.isArray(movieList) || !movieList.length) return;

    const fr = document.createDocumentFragment();
    movieList.slice(0, 10).forEach((m, i) => fr.append(buildPosterCard(m, root + 'film/#' + encodeURIComponent(m.id || ''), i + 2, false)));
    rail.replaceChildren(fr);
    sec.hidden = false;
  }

  function renderCustomBoxes(container, boxItems) {
    if (!container) return;
    const activeBoxes = (boxItems || []).filter(b => b && b.enabled !== false);
    if (!activeBoxes.length) { container.hidden = true; container.replaceChildren(); return; }
    const fr = document.createDocumentFragment();
    for (const b of activeBoxes) {
      const li = el('li', 'custom-box');
      const box = b.url ? Object.assign(el('a'), { href: resolveAsset(b.url) }) : el('div');
      if (b.url && /^https?:\/\//i.test(b.url)) box.rel = 'noopener';
      const kickerRow = el('div', 'cbox-kicker-row');
      kickerRow.append(el('span', 'cbox-kicker', b.badge || 'DURUM NOTU'));
      box.append(kickerRow);
      if (b.title) box.append(el('h3', 'cbox-title', b.title));
      if (b.text) box.append(el('p', 'box-txt', b.text));
      li.append(box);
      fr.append(li);
    }
    container.replaceChildren(fr);
    container.hidden = false;
  }

  // ============================================================================
  // GLOBAL COMMAND PALETTE (/ or Ctrl+K)
  // ============================================================================
  let cmdPaletteMounted = false;
  let cachedAnimeData = null;
  let cachedMoviesData = null;
  let cachedGuidesData = null;
  let cachedProjectsData = null;
  let cmdActiveIndex = -1;

  function initCommandPalette() {
    if (cmdPaletteMounted || cur === 'admin') return;
    cmdPaletteMounted = true;

    const backdrop = el('div', 'cmd-palette-backdrop');
    backdrop.id = 'cmdPalette';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="cmd-palette-modal" role="dialog" aria-modal="true" aria-label="Hızlı Arama">
        <div class="cmd-palette-head">
          <span class="cmd-search-ic">${icon('search')}</span>
          <input type="text" class="cmd-palette-input" id="cmdInput" placeholder="Anime, film, rehber veya bölüm ara..." autocomplete="off" spellcheck="false" />
          <span class="cmd-kbd-badge">ESC</span>
          <button type="button" class="cmd-close-btn" id="cmdClose" aria-label="Kapat">${icon('close')}</button>
        </div>
        <div class="cmd-palette-results" id="cmdResults" role="listbox"></div>
        <div class="cmd-palette-footer">
          <span class="cmd-hint"><kbd>↑</kbd><kbd>↓</kbd> Gezin</span>
          <span class="cmd-hint"><kbd>↵</kbd> Aç</span>
          <span class="cmd-hint"><kbd>ESC</kbd> Kapat</span>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#cmdInput');
    const resultsContainer = backdrop.querySelector('#cmdResults');
    const closeBtn = backdrop.querySelector('#cmdClose');

    const defaultSections = [
      { id: 'home', title: 'Ana Sayfa', desc: 'Vitrin ve öne çıkanlar', path: '', badge: 'Vitrin' },
      { id: 'anime', title: 'Anime', desc: 'Anime arşivi ve puanlar', path: 'anime/', badge: 'Arşiv' },
      { id: 'movie', title: 'Film', desc: 'Sinema arşivi', path: 'film/', badge: 'Arşiv' },
      { id: 'series', title: 'Dizi', desc: 'Dizi arşivi', path: 'dizi/', badge: 'Arşiv' },
      { id: 'book', title: 'Kitap', desc: 'Kitaplık', path: 'kitap/', badge: 'Arşiv' },
      { id: 'manga', title: 'Manga', desc: 'Okuma listesi', path: 'manga/', badge: 'Arşiv' },
      { id: 'guide', title: 'Rehber', desc: 'Technopat GNU/Linux rehberleri', path: 'rehber/', badge: 'Rehber' },
      { id: 'project', title: 'Projeler', desc: 'Açık kaynak depolar', path: 'projeler/', badge: 'GitHub' },
      { id: 'timeline', title: 'Zaman Tüneli', desc: 'Kronolojik akış', path: 'zaman-tuneli/', badge: 'Akış' },
      { id: 'stats', title: 'İstatistikler', desc: 'Metrik ve grafikler', path: 'istatistik/', badge: 'Metrik' }
    ];

    async function loadData() {
      const loaders = [];
      if (!cachedAnimeData) {
        loaders.push(fetch(root + 'data/anime.json').then(r => r.ok ? r.json() : null).then(j => { cachedAnimeData = (j && (j.anime || j.items)) || []; }).catch(() => { cachedAnimeData = []; }));
      }
      if (!cachedMoviesData) {
        loaders.push(fetch(root + 'data/movies.json').then(r => r.ok ? r.json() : null).then(j => { cachedMoviesData = (j && (j.items || j.movies)) || []; }).catch(() => { cachedMoviesData = []; }));
      }
      if (!cachedGuidesData) {
        loaders.push(fetch(root + 'data/guides.json').then(r => r.ok ? r.json() : null).then(j => { cachedGuidesData = (j && (j.items || j.guides)) || []; }).catch(() => { cachedGuidesData = []; }));
      }
      if (!cachedProjectsData) {
        loaders.push(fetch(root + 'data/projects.json').then(r => r.ok ? r.json() : null).then(j => { cachedProjectsData = (j && (j.items || j.projects)) || []; }).catch(() => { cachedProjectsData = []; }));
      }
      await Promise.all(loaders);
    }

    const matchesText = (str, query) => str && query && String(str).toLocaleLowerCase('tr-TR').includes(String(query).toLocaleLowerCase('tr-TR').trim());

    function renderResults(q) {
      resultsContainer.replaceChildren();
      cmdActiveIndex = -1;
      const trimmed = (q || '').trim();

      const quickActions = [
        {
          title: 'Temayı Değiştir',
          desc: 'Koyu ve açık tema arasında geçiş yap',
          badge: 'Tema',
          run: () => { if (typeof window.toggleTheme === 'function') window.toggleTheme(); }
        },
        {
          title: (window.SITE_CONFIG && window.SITE_CONFIG.secretBook && window.SITE_CONFIG.secretBook.title) || 'Özel Anı Kitabı',
          desc: 'Fotoğraflı hatıra sayfalarını aç',
          badge: 'Özel',
          keywords: (window.SITE_CONFIG && window.SITE_CONFIG.secretBook && window.SITE_CONFIG.secretBook.keywords) || ['özel', 'anı', 'hatıra', 'kitap'],
          run: () => { location.href = root + ((window.SITE_CONFIG && window.SITE_CONFIG.secretBook && window.SITE_CONFIG.secretBook.url) || 'kitap/ozel/'); }
        }
      ];

      let matchedSections = [], matchedAnime = [], matchedMovies = [], matchedGuides = [], matchedProjects = [], matchedActions = [];
      if (!trimmed) {
        matchedSections = defaultSections.slice(0, 6);
        matchedAnime = (cachedAnimeData || []).filter(a => a.favorite || (a.score && a.score >= 9.5)).slice(0, 4);
      } else {
        matchedActions = quickActions.filter(a => matchesText(a.title, trimmed) || matchesText(a.desc, trimmed) || (a.keywords && a.keywords.some(k => matchesText(k, trimmed))));
        matchedSections = defaultSections.filter(s => matchesText(s.title, trimmed) || matchesText(s.desc, trimmed)).slice(0, 4);
        matchedAnime = (cachedAnimeData || []).filter(a => matchesText(a.title, trimmed) || (a.genres && a.genres.some(g => matchesText(g, trimmed)))).slice(0, 8);
        matchedMovies = (cachedMoviesData || []).filter(m => matchesText(m.title, trimmed) || matchesText(m.director, trimmed)).slice(0, 4);
        matchedGuides = (cachedGuidesData || []).filter(g => matchesText(g.title, trimmed) || matchesText(g.forumSection, trimmed)).slice(0, 5);
        matchedProjects = (cachedProjectsData || []).filter(p => matchesText(p.title, trimmed) || matchesText(p.name, trimmed) || matchesText(p.description, trimmed)).slice(0, 3);
      }

      if (!matchedActions.length && !matchedSections.length && !matchedAnime.length && !matchedMovies.length && !matchedGuides.length && !matchedProjects.length) {
        resultsContainer.append(el('div', 'cmd-empty', `"${trimmed}" için sonuç bulunamadı.`));
        return;
      }

      const addGroup = (label, items, renderItem) => {
        if (!items.length) return;
        resultsContainer.append(el('div', 'cmd-group-title', label));
        items.forEach(it => resultsContainer.append(renderItem(it)));
      };

      addGroup('Bölümler', matchedSections, s => {
        const a = el('a', 'cmd-item');
        a.href = root + s.path;
        a.innerHTML = `<div class="cmd-item-left"><span class="cmd-item-ic">${icon(s.id === 'movie' ? 'movie' : s.id === 'book' ? 'book' : s.id === 'project' ? 'code' : s.id === 'timeline' ? 'clock' : s.id === 'stats' ? 'chart' : s.id)}</span><div class="cmd-item-info"><span class="cmd-item-title">${esc(s.title)}</span><span class="cmd-item-desc">${esc(s.desc)}</span></div></div><span class="cmd-item-badge">${esc(s.badge)}</span>`;
        a.onclick = () => window.closeCommandPalette();
        return a;
      });

      addGroup('Anime', matchedAnime, a => {
        const item = el('a', 'cmd-item');
        item.href = (cur === 'anime' ? '#' : root + 'anime/#') + encodeURIComponent(a.id);
        const sc = a.score ? `★ ${Number(a.score).toFixed(1)}` : 'Anime';
        const thumb = a.image ? `<img class="cmd-item-thumb" src="${esc(resolveAsset(a.image))}" alt="" loading="lazy">` : `<span class="cmd-item-ic">${icon('anime')}</span>`;
        item.innerHTML = `<div class="cmd-item-left">${thumb}<div class="cmd-item-info"><span class="cmd-item-title">${esc(a.title)}</span><span class="cmd-item-desc">${esc((a.genres || []).slice(0, 3).join(' · ') || 'Anime')}</span></div></div><span class="cmd-item-badge">${esc(sc)}</span>`;
        item.onclick = () => window.closeCommandPalette();
        return item;
      });

      addGroup('Filmler', matchedMovies, m => {
        const item = el('a', 'cmd-item');
        item.href = (cur === 'movie' ? '#' : root + 'film/#') + encodeURIComponent(m.id);
        const sc = m.score ? `★ ${Number(m.score).toFixed(1)}` : 'Film';
        item.innerHTML = `<div class="cmd-item-left"><span class="cmd-item-ic">${icon('movie')}</span><div class="cmd-item-info"><span class="cmd-item-title">${esc(m.title)}</span><span class="cmd-item-desc">${esc([m.year, m.director].filter(Boolean).join(' · ') || 'Film')}</span></div></div><span class="cmd-item-badge">${esc(sc)}</span>`;
        item.onclick = () => window.closeCommandPalette();
        return item;
      });

      addGroup('Rehberler', matchedGuides, g => {
        const item = el('a', 'cmd-item');
        item.href = g.url || (root + 'rehber/');
        if (g.url && g.url.startsWith('http')) { item.target = '_blank'; item.rel = 'noopener'; }
        item.innerHTML = `<div class="cmd-item-left"><span class="cmd-item-ic">${icon('guide')}</span><div class="cmd-item-info"><span class="cmd-item-title">${esc(g.title)}</span><span class="cmd-item-desc">${esc(g.forumSection || 'Technopat Sosyal')}</span></div></div><span class="cmd-item-badge">Rehber</span>`;
        item.onclick = () => window.closeCommandPalette();
        return item;
      });

      addGroup('Projeler', matchedProjects, p => {
        const item = el('a', 'cmd-item');
        item.href = p.url || (root + 'projeler/');
        if (p.url && p.url.startsWith('http')) { item.target = '_blank'; item.rel = 'noopener'; }
        item.innerHTML = `<div class="cmd-item-left"><span class="cmd-item-ic">${icon('code')}</span><div class="cmd-item-info"><span class="cmd-item-title">${esc(p.fullName || p.title || p.name)}</span><span class="cmd-item-desc">${esc(p.summary || p.description || 'GitHub')}</span></div></div><span class="cmd-item-badge">${esc(p.language || 'Proje')}</span>`;
        item.onclick = () => window.closeCommandPalette();
        return item;
      });

      addGroup('Eylemler', matchedActions, act => {
        const btn = el('button', 'cmd-item');
        btn.type = 'button';
        btn.innerHTML = `<div class="cmd-item-left"><span class="cmd-item-ic">${icon('sparkle')}</span><div class="cmd-item-info"><span class="cmd-item-title">${esc(act.title)}</span><span class="cmd-item-desc">${esc(act.desc)}</span></div></div><span class="cmd-item-badge">${esc(act.badge)}</span>`;
        btn.onclick = e => { e.preventDefault(); window.closeCommandPalette(); act.run(); };
        return btn;
      });

      updateSelection(0);
    }

    function updateSelection(idx) {
      const items = resultsContainer.querySelectorAll('.cmd-item');
      if (!items.length) { cmdActiveIndex = -1; return; }
      cmdActiveIndex = (idx + items.length) % items.length;
      items.forEach((it, i) => {
        it.classList.toggle('selected', i === cmdActiveIndex);
        if (i === cmdActiveIndex) it.scrollIntoView({ block: 'nearest' });
      });
    }

    input.oninput = () => renderResults(input.value);
    input.onkeydown = e => {
      const items = resultsContainer.querySelectorAll('.cmd-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); updateSelection(cmdActiveIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); updateSelection(cmdActiveIndex - 1); }
      else if (e.key === 'Enter' && cmdActiveIndex >= 0 && items[cmdActiveIndex]) { e.preventDefault(); items[cmdActiveIndex].click(); }
    };
    closeBtn.onclick = () => window.closeCommandPalette();
    backdrop.onclick = e => { if (e.target === backdrop) window.closeCommandPalette(); };

    window.openCommandPalette = initialQuery => {
      backdrop.hidden = false;
      document.body.style.overflow = 'hidden';
      input.value = typeof initialQuery === 'string' ? initialQuery : '';
      loadData().then(() => { if (!backdrop.hidden) renderResults(input.value); });
      renderResults(input.value);
      setTimeout(() => input.focus(), 20);
    };
    window.closeCommandPalette = () => {
      backdrop.hidden = true;
      document.body.style.overflow = '';
    };

    document.addEventListener('keydown', e => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        backdrop.hidden ? window.openCommandPalette() : window.closeCommandPalette();
      } else if (e.key === '/' && backdrop.hidden && !isInput) {
        e.preventDefault();
        window.openCommandPalette();
      } else if (e.key === 'Escape' && !backdrop.hidden) {
        e.preventDefault();
        window.closeCommandPalette();
      }
    });
  }

  // ============================================================================
  // HORIZONTAL RAIL DRAG & WHEEL SCROLL + BACK-TO-TOP + SHORTCUTS
  // ============================================================================
  function initInteractions() {
    const SELECTOR = '.poster-rail, .chips, .sh-rb-tabs';
    let activeWheelEl = null;
    const onWheel = e => {
      if (!activeWheelEl || activeWheelEl.scrollWidth <= activeWheelEl.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const max = activeWheelEl.scrollWidth - activeWheelEl.clientWidth;
        if ((e.deltaY > 0 && activeWheelEl.scrollLeft < max - 1) || (e.deltaY < 0 && activeWheelEl.scrollLeft > 1)) {
          e.preventDefault();
          activeWheelEl.scrollLeft += e.deltaY;
        }
      }
    };
    document.addEventListener('pointerover', e => {
      const target = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (target && target !== activeWheelEl) {
        if (activeWheelEl) activeWheelEl.removeEventListener('wheel', onWheel);
        activeWheelEl = target;
        activeWheelEl.addEventListener('wheel', onWheel, { passive: false });
      } else if (!target && activeWheelEl) {
        activeWheelEl.removeEventListener('wheel', onWheel);
        activeWheelEl = null;
      }
    }, { passive: true });

    // Back to top
    let topBtn = null;
    window.addEventListener('scroll', () => {
      if (!topBtn) {
        topBtn = el('button', 'back-to-top');
        topBtn.type = 'button';
        topBtn.setAttribute('aria-label', 'Yukarı Çık');
        topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
        topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.appendChild(topBtn);
      }
      topBtn.classList.toggle('visible', window.scrollY > 360);
    }, { passive: true });

    // Keyboard shortcuts (T, R, 1/2/3)
    document.addEventListener('keydown', e => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 't' || e.key === 'T') {
        if (typeof window.toggleTheme === 'function') { e.preventDefault(); window.toggleTheme(); }
      } else if (e.key === 'r' || e.key === 'R') {
        const dice = document.getElementById('randomPickBtn');
        if (dice) { e.preventDefault(); dice.click(); }
      } else if (['1', '2', '3'].includes(e.key)) {
        const map = { '1': 'grid', '2': 'list', '3': 'tier' };
        const btn = document.querySelector(`[data-view="${map[e.key]}"]`);
        if (btn) { e.preventDefault(); btn.click(); }
      }
    });

    // Secret book dot
    const secretDot = document.getElementById('heroStatusDot');
    if (secretDot) {
      const go = e => { if (e) e.preventDefault(); location.href = root + (secretDot.getAttribute('data-secret-book') || 'kitap/ozel/'); };
      secretDot.addEventListener('click', go);
      secretDot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(e); });
    }
  }

  // ============================================================================
  // BOOTSTRAP & DATA HYDRATION
  // ============================================================================
  async function boot() {
    initTopNav();
    initCommandPalette();
    initInteractions();

    try {
      const cfg = await fetch(root + 'data/sections.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (cfg) {
        window.SITE_CONFIG = cfg;
        document.dispatchEvent(new CustomEvent('siteconfig', { detail: cfg }));

        // Footer links on home
        const linksEl = document.getElementById('links');
        if (linksEl && Array.isArray(cfg.links)) {
          const fr = document.createDocumentFragment();
          for (const l of cfg.links.filter(x => x && x.enabled !== false)) {
            const li = el('li');
            const a = el('a', '', l.title);
            a.href = l.url;
            a.target = '_blank';
            a.rel = 'noopener me';
            li.append(a);
            fr.append(li);
          }
          linksEl.replaceChildren(fr);
        }

        // Custom boxes on home
        const boxesTop = document.getElementById('boxesTop');
        const boxesBottom = document.getElementById('boxesBottom');
        if (boxesTop || boxesBottom) {
          const allBoxes = Array.isArray(cfg.boxes) ? cfg.boxes : [];
          renderCustomBoxes(boxesTop, allBoxes.filter(b => b.position !== 'below'));
          renderCustomBoxes(boxesBottom, allBoxes.filter(b => b.position === 'below'));
        }
      }

      if (cur === 'home') {
        const [animeJson, moviesJson, guidesJson, projectsJson] = await Promise.all([
          fetch(root + 'data/anime.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(root + 'data/movies.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(root + 'data/guides.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(root + 'data/projects.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        const animeList = (animeJson && (animeJson.anime || animeJson.items)) || [];
        cachedAnimeData = animeList;
        renderHeroSpotlight(animeList);
        renderHomeHighlights(animeList, cfg);
        renderHomeContinue(animeList);

        const movieList = (moviesJson && (moviesJson.items || moviesJson.movies)) || [];
        cachedMoviesData = movieList;
        renderHomeMovies(movieList);

        const guideList = (guidesJson && (guidesJson.items || guidesJson.guides)) || [];
        cachedGuidesData = guideList;
        const gs = document.getElementById('hubGuideSub');
        if (gs && guideList.length) gs.textContent = `${guideList.length} teknik rehber · GNU/Linux & Donanım`;

        const projectList = (projectsJson && (projectsJson.items || projectsJson.projects)) || [];
        cachedProjectsData = projectList;
        const ps = document.getElementById('hubProjectSub');
        if (ps && projectList.length) ps.textContent = `${projectList.length} açık kaynak proje · GitHub`;
      }
    } catch (e) {
      console.warn('Bootstrap error:', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
