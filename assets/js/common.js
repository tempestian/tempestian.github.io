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

  // ============================================================================
  // STEP 8 — AMBIENT GLOW ENGINE (Dynamic Accent & Backdrop Glow)
  // ============================================================================
  const GLOW_PALETTES = [
    'rgba(88, 185, 255, 0.24)',
    'rgba(168, 85, 247, 0.24)',
    'rgba(52, 211, 153, 0.22)',
    'rgba(245, 158, 11, 0.22)',
    'rgba(236, 72, 153, 0.24)',
    'rgba(99, 102, 241, 0.25)'
  ];

  function hashColor(str) {
    let h = 0;
    const s = String(str || 'tempestian');
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return GLOW_PALETTES[Math.abs(h) % GLOW_PALETTES.length];
  }

  function updateAmbientGlow(seedOrUrl) {
    const col = hashColor(seedOrUrl);
    document.documentElement.style.setProperty('--ambient-glow', col);
    document.body.classList.add('has-ambient-glow');
  }

  function hideAmbientGlow() {
    document.body.classList.remove('has-ambient-glow');
  }

  window.UI = {
    icon,
    el,
    parts,
    tally,
    resolveAsset,
    esc,
    icons: Object.keys(P),
    updateAmbientGlow,
    hideAmbientGlow,
    openTrailer() {},
    closeTrailer() {},
    showToast
  };

  // ============================================================================
  // STEP 9 — BROKEN POSTER / IMAGE SVG FALLBACK ENGINE
  // ============================================================================
  function initImageFallback() {
    window.addEventListener('error', e => {
      const target = e.target;
      if (target && target.tagName === 'IMG' && !target.dataset.fallbackApplied) {
        target.dataset.fallbackApplied = 'true';
        const altText = (target.alt || target.title || 'Tempestian').trim();
        const initial = (altText[0] || 'T').toUpperCase();
        const label = altText.slice(0, 22);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="50%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#0b0d14"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="14" y="14" width="292" height="452" rx="16" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/><text x="50%" y="44%" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="68" fill="rgba(88,185,255,0.45)" text-anchor="middle" dominant-baseline="central">${esc(initial)}</text><text x="50%" y="58%" font-family="Inter,system-ui,sans-serif" font-weight="600" font-size="14" fill="rgba(244,246,251,0.55)" text-anchor="middle" dominant-baseline="central">${esc(label)}</text></svg>`;
        target.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        target.classList.add('in', 'loaded', 'img-fallback-applied');
      }
    }, true);
  }

  // ============================================================================
  // UNIFIED TOP NAVIGATION BAR + STEP 15 MOBILE FLOATING BOTTOM BAR
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
    const oldMobNav = document.getElementById('mobileBottomNav');
    if (oldMobNav) oldMobNav.remove();

    const bar = document.querySelector('.bar');
    if (!bar) return;

    const navGroups = [
      {
        title: 'Medya Arşivi',
        items: [
          { id: 'home', label: 'Vitrin', path: '', icon: 'home' },
          { id: 'anime', label: 'Anime', path: 'anime/', icon: 'anime' },
          { id: 'movie', label: 'Film', path: 'film/', icon: 'movie' },
          { id: 'series', label: 'Dizi', path: 'dizi/', icon: 'series' },
          { id: 'book', label: 'Kitap', path: 'kitap/', icon: 'book' },
          { id: 'manga', label: 'Manga', path: 'manga/', icon: 'manga' }
        ]
      },
      {
        title: 'Üretim & Analiz',
        items: [
          { id: 'guide', label: 'Rehberler', path: 'rehber/', icon: 'guide' },
          { id: 'project', label: 'Projeler', path: 'projeler/', icon: 'code' },
          { id: 'timeline', label: 'Zaman Tüneli', path: 'zaman-tuneli/', icon: 'clock' },
          { id: 'stats', label: 'İstatistikler', path: 'istatistik/', icon: 'chart' }
        ]
      }
    ];

    const isNavActive = id => {
      if (cur === id) return true;
      if (id === 'movie' && cur === 'film') return true;
      if (id === 'series' && cur === 'dizi') return true;
      if (id === 'book' && cur === 'kitap') return true;
      if (id === 'guide' && cur === 'rehber') return true;
      return false;
    };

    const existingStatsBtn = bar.querySelector('.bar-stats-btn');
    const statsHref = existingStatsBtn ? existingStatsBtn.getAttribute('href') : null;
    const statsTitle = existingStatsBtn ? existingStatsBtn.getAttribute('title') : 'İstatistikler';

    const rimuruBadgeSvg = `<svg class="brand-slime-ic" viewBox="0 0 64 54" width="24" height="20" aria-hidden="true"><path d="M8 36 C8 16, 20 7, 32 7 C44 7, 56 16, 56 36 C56 46, 46 50, 32 50 C18 50, 8 46, 8 36 Z" fill="var(--frame-bg)" stroke="var(--line)" stroke-width="4"/><path d="M20 31 L26 29 M38 29 L44 31" stroke="var(--line)" stroke-width="3.5" stroke-linecap="round"/></svg>`;

    const themesList = window.THEMES_LIST || [
      { id: 'rimuru-dark', label: '💧 Rimuru Midnight' },
      { id: 'jura-violet', label: '🔮 Jura Violet' },
      { id: 'tempest-teal', label: '🌊 Tempest Teal' },
      { id: 'shuna-sakura', label: '🌸 Shuna Sakura' },
      { id: 'veldora-cream', label: '☀️ Veldora Amber' }
    ];

    bar.innerHTML = `
      <div class="bar-in">
        <div class="bar-left">
          <button type="button" class="btn Neo-btn sidebar-toggle-btn" id="sidebarToggleBtn" aria-label="Menüyü Aç/Kapat" title="Kenar Çubuğunu Aç/Kapat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="9" y1="4" x2="9" y2="20"/></svg>
          </button>
          <a class="nav-brand" href="${root || './'}" id="barTitle">
            ${rimuruBadgeSvg}
            <span>Tempestian</span>
          </a>
          <div class="win-nav-Cluster">
            <button type="button" class="btn neo-sq-btn" id="winBackBtn" title="Geri" aria-label="Geri">‹</button>
            <button type="button" class="btn neo-sq-btn" id="winFwdBtn" title="İleri" aria-label="İleri">›</button>
          </div>
        </div>

        <button class="neo-search-bar" id="searchTrigger" type="button" aria-label="Hızlı Arama" title="Tüm Arşivde Ara (/ veya Ctrl+K)">
          <span class="neo-search-ic">${icon('search')}</span>
          <span class="neo-search-placeholder">Anime, film, dizi, kitap, rehber ara...</span>
          <kbd>/</kbd>
        </button>

        <div class="bar-actions">
          ${statsHref ? `<a class="btn bar-stats-btn" href="${esc(statsHref)}" title="${esc(statsTitle)}" aria-label="${esc(statsTitle)}">${icon('chart')}</a>` : ''}
          <button class="btn aside-toggle-btn" id="asideToggleBtn" type="button" title="Müzik Paneli (Last.fm)" aria-label="Müzik Paneli">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </button>
          <div class="theme-picker-wrap">
            <button class="btn theme-trigger-btn" id="themePickerBtn" type="button" title="Tema Seç" aria-label="Tema Seç">
              <span class="theme-swatch-dot"></span>
              <span class="theme-btn-lbl">Tema</span>
            </button>
            <div class="theme-popover" id="themePopover" hidden>
              <div class="theme-pop-title">YERLEŞİK TEMALAR</div>
              ${themesList.map(t => `
                <button type="button" class="theme-opt-btn" data-preset-opt="${t.id}">
                  <span>${t.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
          <button class="btn" id="theme" type="button" data-icon="theme" aria-label="Hızlı Tema Değiştir" title="Sonraki Temaya Geç (T)"></button>
        </div>
      </div>
    `;

    // Build Left App Sidebar + Main Content Workspace Grid
    const mainEl = document.querySelector('main.wrap, main.tensura-wrap');
    if (mainEl && !document.getElementById('appWorkspace')) {
      const workspace = el('div', 'app-workspace');
      workspace.id = 'appWorkspace';

      const sidebar = el('aside', 'app-sidebar');
      sidebar.id = 'appSidebar';
      sidebar.setAttribute('aria-label', 'Uygulama Menüsü');

      sidebar.innerHTML = `
        <div class="sidebar-inner">
          ${navGroups.map(grp => `
            <div class="sidebar-group">
              <div class="sidebar-group-lbl">${grp.title}</div>
              <nav class="sidebar-nav">
                ${grp.items.map(it => `
                  <a class="sidebar-link${isNavActive(it.id) ? ' active' : ''}" href="${root}${it.path}" data-nav="${it.id}">
                    <span class="sb-ic">${icon(it.icon)}</span>
                    <span class="sb-txt">${it.label}</span>
                  </a>
                `).join('')}
              </nav>
            </div>
          `).join('')}

          <div class="sidebar-group sidebar-quick-group">
            <div class="sidebar-group-lbl">Hızlı Eylemler</div>
            <button type="button" class="sidebar-link sb-action-btn" id="sbWheelActionBtn">
              <span class="sb-ic">🎡</span>
              <span class="sb-txt">Ne İzlemeliyim?</span>
            </button>
            <a class="sidebar-link" href="${root}tensura-izleme-sirasi/">
              <span class="sb-ic">${icon('sparkle')}</span>
              <span class="sb-txt">Tensura Sırası</span>
            </a>
          </div>

          <div class="sidebar-footer">
            <span class="sb-status-pill"><i class="sb-dot"></i>Jura Tempest v3.5</span>
          </div>
        </div>
      `;

      // Build Right Aside (Last.fm & Live Music Room)
      const aside = el('aside', 'app-aside');
      aside.id = 'appAside';
      aside.setAttribute('aria-label', 'Müzik ve Last.fm');
      aside.innerHTML = `
        <div class="aside-inner">
          <div class="aside-header">
            <div class="aside-title-group">
              <span class="aside-title-ic">🎧</span>
              <span class="aside-title">Müzik Odası</span>
            </div>
            <div class="aside-header-actions">
              <a href="https://www.last.fm" target="_blank" rel="noopener" class="btn neo-sq-btn aside-link-btn" id="lastfmExtLink" title="Last.fm Profilini Aç">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
              <button type="button" class="btn neo-sq-btn aside-close-btn" id="asideCloseBtn" title="Kapat" aria-label="Kapat">✕</button>
            </div>
          </div>

          <div class="lastfm-card" id="lastfmCard">
            <div class="lastfm-card-top">
              <span class="lastfm-live-pill" id="lastfmLivePill">
                <span class="live-dot"></span>
                <span id="lastfmStatusTxt">Son Çalınan</span>
              </span>
              <span class="lastfm-badge">LAST.FM</span>
            </div>

            <div class="lastfm-cover-box">
              <img class="lastfm-cover-img" id="lastfmCoverImg" src="" alt="Albüm Kapağı" style="display:none;" />
            </div>

            <div class="lastfm-track-info">
              <a class="lastfm-title" id="lastfmTitle" href="#" target="_blank" rel="noopener">Last.fm Bağlanıyor...</a>
              <div class="lastfm-artist" id="lastfmArtist">—</div>
              <div class="lastfm-album" id="lastfmAlbum">—</div>
            </div>

            <div class="lastfm-card-bottom">
              <div class="lastfm-equalizer" id="lastfmEq" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
              <a class="lastfm-user-link" id="lastfmUserLink" href="https://www.last.fm" target="_blank" rel="noopener">
                <span id="lastfmUserDisplay">@tempestian</span> ↗
              </a>
            </div>
          </div>

          <div class="aside-history-wrap">
            <div class="aside-group-lbl">Önceki Dinlenenler</div>
            <div class="lastfm-history-list" id="lastfmHistoryList">
              <div class="lastfm-hist-placeholder">Geçmiş yükleniyor...</div>
            </div>
          </div>
        </div>
      `;

      mainEl.parentNode.insertBefore(workspace, mainEl);
      workspace.append(sidebar, mainEl, aside);

      // Mobile horizontal pill strip right inside main top for touch ergonomics
      const mobStrip = el('nav', 'mobile-section-strip');
      mobStrip.setAttribute('aria-label', 'Bölümler');
      const allMobileItems = [...navGroups[0].items, ...navGroups[1].items];
      mobStrip.innerHTML = allMobileItems.map(it => `
        <a class="mob-strip-pill${isNavActive(it.id) ? ' active' : ''}" href="${root}${it.path}">${it.label}</a>
      `).join('');
      if (bar) {
        bar.after(mobStrip);
      } else {
        mainEl.insertBefore(mobStrip, mainEl.firstChild);
      }

      const toggleBtn = document.getElementById('sidebarToggleBtn');
      if (toggleBtn) {
        if (ls('tp_sidebar_collapsed') === '1') workspace.classList.add('sidebar-collapsed');
        toggleBtn.onclick = () => {
          if (window.innerWidth <= 940) {
            workspace.classList.toggle('sidebar-mobile-open');
          } else {
            const c = workspace.classList.toggle('sidebar-collapsed');
            ls('tp_sidebar_collapsed', c ? '1' : '0');
          }
        };

        sidebar.querySelectorAll('a').forEach(a => {
          a.addEventListener('click', () => {
            workspace.classList.remove('sidebar-mobile-open');
          });
        });

        document.addEventListener('click', (e) => {
          if (workspace.classList.contains('sidebar-mobile-open') &&
              !sidebar.contains(e.target) &&
              !toggleBtn.contains(e.target)) {
            workspace.classList.remove('sidebar-mobile-open');
          }
        });
      }

      const asideBtn = document.getElementById('asideToggleBtn');
      const asideClose = document.getElementById('asideCloseBtn');
      if (asideBtn) {
        asideBtn.onclick = () => {
          if (window.innerWidth <= 1280) {
            workspace.classList.toggle('aside-open');
          } else {
            workspace.classList.toggle('aside-collapsed');
          }
        };
      }
      if (asideClose) {
        asideClose.onclick = () => {
          workspace.classList.remove('aside-open');
          if (window.innerWidth > 1280) {
            workspace.classList.add('aside-collapsed');
          }
        };
      }
      document.addEventListener('click', (e) => {
        if (workspace.classList.contains('aside-open') &&
            !aside.contains(e.target) &&
            !asideBtn?.contains(e.target)) {
          workspace.classList.remove('aside-open');
        }
      });

      initLastFmWidget();

      const sbWheel = document.getElementById('sbWheelActionBtn');
      if (sbWheel) {
        sbWheel.onclick = async () => {
          const wBtn = document.getElementById('whatToWatchBtn');
          if (wBtn) { wBtn.click(); return; }
          if (!cachedAnimeData) {
            try {
              const r = await fetch(root + 'data/anime.json');
              if (r.ok) { const j = await r.json(); cachedAnimeData = j.anime || j.items || []; }
            } catch (_) {}
          }
          const pool = (cachedAnimeData || []).filter(x => x && (x.status === 'watching' || x.status === 'paused' || Boolean(x.next)));
          openWhatToWatchWheel(pool.length ? pool : (cachedAnimeData || []).slice(0, 10));
        };
      }
    }

    async function initLastFmWidget() {
      const card = document.getElementById('lastfmCard');
      if (!card) return;

      const defaultUser = 'TurkTempestian';
      const defaultKey = 'b25b959554ed76058ac220b7b2e0a026';

      let siteConfig = null;
      try {
        const secRes = await fetch(root + 'data/sections.json');
        if (secRes.ok) siteConfig = await secRes.json();
      } catch (_) {}

      const lfmCfg = (siteConfig && siteConfig.lastfm) || {};
      if (lfmCfg.enabled === false) {
        const asideEl = document.getElementById('appAside');
        if (asideEl) asideEl.style.display = 'none';
        const asideBtn = document.getElementById('asideToggleBtn');
        if (asideBtn) asideBtn.style.display = 'none';
        return;
      }

      const currentUser = lfmCfg.user || defaultUser;
      const currentKey = lfmCfg.apiKey || defaultKey;

      async function update() {
        const titleEl = document.getElementById('lastfmTitle');
        const artistEl = document.getElementById('lastfmArtist');
        const albumEl = document.getElementById('lastfmAlbum');
        const coverEl = document.getElementById('lastfmCoverImg');
        const statusTxt = document.getElementById('lastfmStatusTxt');
        const livePill = document.getElementById('lastfmLivePill');
        const userLink = document.getElementById('lastfmUserLink');
        const extLink = document.getElementById('lastfmExtLink');
        const userDisplay = document.getElementById('lastfmUserDisplay');
        const historyList = document.getElementById('lastfmHistoryList');
        const cardEl = document.getElementById('lastfmCard');

        const profileUrl = 'https://www.last.fm/user/' + encodeURIComponent(currentUser);
        if (userDisplay) userDisplay.textContent = '@' + currentUser;
        if (userLink) userLink.href = profileUrl;
        if (extLink) extLink.href = profileUrl;

        try {
          const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(currentUser)}&api_key=${encodeURIComponent(currentKey)}&format=json&limit=5`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('API isteği başarısız');
          const data = await res.json();

          if (data.error) {
            if (statusTxt) statusTxt.textContent = 'Bağlantı Bekleniyor';
            if (titleEl) {
              titleEl.textContent = 'Son Çalınan Parça';
              titleEl.href = profileUrl;
            }
            if (artistEl) artistEl.textContent = 'Last.fm hesabı: ' + currentUser;
            if (albumEl) albumEl.textContent = 'Yönetim panelinden kullanıcı adınızı güncelleyin';
            if (livePill) livePill.classList.remove('is-now-playing');
            if (cardEl) cardEl.classList.remove('is-playing');
            if (historyList) {
              historyList.innerHTML = '<div class="lastfm-empty-hist">Yönetim Panelinden Last.fm kullanıcı adınızı güncelleyin.</div>';
            }
            return;
          }

          const tracks = (data.recenttracks && data.recenttracks.track) || [];
          if (!tracks.length) {
            if (titleEl) titleEl.textContent = 'Kayıtlı Parça Yok';
            if (artistEl) artistEl.textContent = '—';
            return;
          }

          const current = tracks[0];
          const isNow = current['@attr'] && current['@attr'].nowplaying === 'true';

          if (titleEl) {
            titleEl.textContent = current.name || 'Bilinmeyen Parça';
            titleEl.href = current.url || '#';
            titleEl.onclick = null;
          }
          if (artistEl) artistEl.textContent = (current.artist && (current.artist['#text'] || current.artist.name)) || 'Bilinmeyen Sanatçı';
          if (albumEl) albumEl.textContent = (current.album && current.album['#text']) || '';

          const imgUrl = (current.image && (current.image[3] || current.image[2] || current.image[1])['#text']) || '';
          if (coverEl) {
            if (imgUrl) {
              coverEl.src = imgUrl;
              coverEl.style.display = 'block';
            } else {
              coverEl.src = '';
              coverEl.style.display = 'none';
            }
          }

          if (isNow) {
            if (statusTxt) statusTxt.textContent = 'Şu An Çalıyor';
            if (livePill) livePill.classList.add('is-now-playing');
            if (cardEl) cardEl.classList.add('is-playing');
          } else {
            if (statusTxt) statusTxt.textContent = (current.date && current.date['#text']) ? 'Son Çalınan' : 'Dinlendi';
            if (livePill) livePill.classList.remove('is-now-playing');
            if (cardEl) cardEl.classList.remove('is-playing');
          }

          if (historyList) {
            const historyTracks = tracks.slice(1, 4);
            if (!historyTracks.length) {
              historyList.innerHTML = '<div class="lastfm-empty-hist">Önceki parça kaydı yok</div>';
            } else {
              historyList.innerHTML = historyTracks.map(t => {
                const tImg = (t.image && (t.image[1] || t.image[0])['#text']) || '';
                const tArtist = (t.artist && (t.artist['#text'] || t.artist.name)) || '';
                return `
                  <a class="lastfm-hist-item" href="${t.url || '#'}" target="_blank" rel="noopener">
                    ${tImg ? `<img class="lastfm-hist-thumb" src="${tImg}" alt="" />` : '<div class="lastfm-hist-thumb-ph">🎵</div>'}
                    <div class="lastfm-hist-info">
                      <span class="lastfm-hist-title">${t.name}</span>
                      <span class="lastfm-hist-artist">${tArtist}</span>
                    </div>
                  </a>
                `;
              }).join('');
            }
          }
        } catch (err) {
          if (statusTxt) statusTxt.textContent = 'Bağlantı Bekleniyor';
          if (titleEl) {
            titleEl.textContent = 'Son Çalınan Parça';
            titleEl.href = profileUrl;
          }
          if (artistEl) artistEl.textContent = 'Last.fm hesabı: ' + currentUser;
        }
      }

      update();
      setInterval(update, 35000);
    }


    const winBack = document.getElementById('winBackBtn');
    const winFwd = document.getElementById('winFwdBtn');
    if (winBack) winBack.onclick = () => history.back();
    if (winFwd) winFwd.onclick = () => history.forward();

    const pickerBtn = document.getElementById('themePickerBtn');
    const popover = document.getElementById('themePopover');
    if (pickerBtn && popover) {
      const syncActivePreset = () => {
        const curPreset = document.documentElement.dataset.preset || 'rimuru-dark';
        popover.querySelectorAll('[data-preset-opt]').forEach(b => {
          b.classList.toggle('active', b.dataset.presetOpt === curPreset);
        });
      };
      syncActivePreset();
      document.addEventListener('themechange', syncActivePreset);

      pickerBtn.onclick = e => {
        e.stopPropagation();
        popover.hidden = !popover.hidden;
        syncActivePreset();
      };
      popover.querySelectorAll('[data-preset-opt]').forEach(b => {
        b.onclick = e => {
          e.stopPropagation();
          if (typeof window.setThemePreset === 'function') window.setThemePreset(b.dataset.presetOpt);
          popover.hidden = true;
        };
      });
      document.addEventListener('click', e => {
        if (!popover.hidden && !e.target.closest('.theme-picker-wrap')) popover.hidden = true;
      });
    }

    const searchBtn = document.getElementById('searchTrigger');
    if (searchBtn) {
      searchBtn.onclick = e => {
        e.preventDefault();
        if (typeof window.openCommandPalette === 'function') window.openCommandPalette();
      };
    }

    let on = false;
    const upd = () => {
      const n = scrollY > 10;
      if (n !== on) { on = n; bar.classList.toggle('on', n); }
    };
    addEventListener('scroll', upd, { passive: true });
    upd();
  }

  // ============================================================================
  // STEP 5 & 7 — IN-PLACE HOME DETAIL MODAL SHEET & CLICKABLE GENRE CHIPS
  // ============================================================================
  let homeSheetEl = null;
  let homeSheetList = [];
  let homeSheetIdx = -1;
  let homeSheetType = 'anime';

  function getHomeEffectiveScore(item, typeKey = 'anime') {
    if (!item) return null;
    const criteria = window.TempestianRating ? (window.TempestianRating.CRITERIA[typeKey] || window.TempestianRating.CRITERIA.anime) : null;
    const ps = Array.isArray(item.parts) ? item.parts : [];
    let wSum = 0, wTot = 0;
    for (const p of ps) {
      if (!p) continue;
      const sc = (p.subScores && criteria) ? window.TempestianRating.computeScore(criteria, p.subScores) : Number(p.score);
      if (sc != null && !isNaN(sc) && sc > 0) {
        const w = (p.kind === 'movie' || p.format === 'MOVIE') ? 0.35 : (p.kind === 'other' ? 0.15 : 1.0);
        wSum += sc * w;
        wTot += w;
      }
    }
    if (wTot > 0) return Math.round((wSum / wTot) * 10) / 10;
    if (item.subScores && criteria) {
      const sc = window.TempestianRating.computeScore(criteria, item.subScores);
      if (sc != null) return sc;
    }
    const s = Number(item.score);
    return !isNaN(s) && s > 0 ? Math.round(s * 10) / 10 : null;
  }

  function ensureHomeSheet() {
    if (homeSheetEl) return homeSheetEl;
    homeSheetEl = el('div', 'sheet');
    homeSheetEl.hidden = true;
    homeSheetEl.setAttribute('role', 'dialog');
    homeSheetEl.setAttribute('aria-modal', 'true');
    homeSheetEl.setAttribute('aria-labelledby', 'home-sh-title');
    homeSheetEl.innerHTML = `
      <div class="sheet-bg"></div>
      <div class="sheet-card">
        <div class="sheet-backdrop" hidden>
          <img class="sheet-backdrop-img" alt="" decoding="async">
          <div class="sheet-backdrop-grad"></div>
        </div>
        <div class="sheet-head">
          <img class="sheet-cover" alt="" decoding="async">
          <div class="sheet-t">
            <h2 id="home-sh-title"></h2>
            <p class="sh-sub"></p>
            <div class="sh-genres"></div>
          </div>
          <button class="btn" type="button" aria-label="Kapat" data-close>${icon('close')}</button>
        </div>
        <div class="sh-pg" hidden><i></i></div>
        <div class="sh-rating-breakdown" id="homeShRatingBreakdown" hidden></div>
        <ol class="parts"></ol>
        <div class="sh-similar-box" id="homeShSimilarBox" hidden></div>
        <div class="sheet-foot-bar">
          <div class="sheet-nav-grp">
            <button type="button" class="sheet-nav-btn" data-sh-prev title="Önceki (←)">← Önceki</button>
            <span class="sheet-pos-lbl" data-sh-pos></span>
            <button type="button" class="sheet-nav-btn" data-sh-next title="Sonraki (→)">Sonraki →</button>
          </div>
          <div class="sheet-act-grp">
            <button type="button" class="sheet-share-btn" data-sh-share>🔗 Bağlantıyı Kopyala</button>
            <a class="sh-al" target="_blank" rel="noopener"></a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(homeSheetEl);

    const close = () => {
      homeSheetEl.hidden = true;
      document.body.style.overflow = '';
      hideAmbientGlow();
    };
    homeSheetEl.querySelector('.sheet-bg').onclick = close;
    homeSheetEl.querySelector('[data-close]').onclick = close;

    window.addEventListener('keydown', e => {
      if (!homeSheetEl || homeSheetEl.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') {
        const b = homeSheetEl.querySelector('[data-sh-prev]');
        if (b && !b.disabled) b.click();
      } else if (e.key === 'ArrowRight') {
        const b = homeSheetEl.querySelector('[data-sh-next]');
        if (b && !b.disabled) b.click();
      }
    });

    return homeSheetEl;
  }

  // Step 3 (New List): Similar Items / Same Genre Recommendations Renderer inside any Detail Sheet
  function renderSimilarItemsInSheet(containerEl, currentItem, allPool, onSelectItem, typeKey = 'anime') {
    if (!containerEl || !currentItem || !Array.isArray(allPool) || allPool.length < 2) {
      if (containerEl) { containerEl.hidden = true; containerEl.replaceChildren(); }
      return;
    }
    const getGenres = it => (Array.isArray(it.customGenres) && it.customGenres.length ? it.customGenres : (it.genres || []));
    const curGenres = new Set(getGenres(currentItem));

    const scored = [];
    for (const cand of allPool) {
      if (!cand || cand.id === currentItem.id) continue;
      const cGenres = getGenres(cand);
      let shared = 0;
      for (const g of cGenres) if (curGenres.has(g)) shared++;
      if (shared > 0 || curGenres.size === 0) {
        const sc = getHomeEffectiveScore(cand, typeKey) || 0;
        scored.push({ item: cand, shared, sc });
      }
    }

    scored.sort((a, b) => b.shared - a.shared || (b.item.favorite ? 1 : 0) - (a.item.favorite ? 1 : 0) || b.sc - a.sc);
    const picks = scored.slice(0, 4).map(x => x.item);
    if (!picks.length) {
      containerEl.hidden = true;
      containerEl.replaceChildren();
      return;
    }

    containerEl.innerHTML = `<div class="sh-sim-head"><span>Benzer Yapımlar &amp; Aynı Türden Öneriler</span></div><div class="sh-sim-grid"></div>`;
    const grid = containerEl.querySelector('.sh-sim-grid');
    picks.forEach(p => {
      const btn = el('button', 'sh-sim-card');
      btn.type = 'button';
      const sc = getHomeEffectiveScore(p, typeKey);
      const imgUrl = p.image ? resolveAsset(p.image.replace('/cover/medium/', '/cover/large/')) : '';
      btn.innerHTML = `
        <div class="sh-sim-poster">
          ${imgUrl ? `<img src="${esc(imgUrl)}" alt="${esc(p.title)}" loading="lazy">` : ''}
          ${sc ? `<span class="sh-sim-sc">★ ${sc.toFixed(1)}</span>` : ''}
        </div>
        <span class="sh-sim-title">${esc(p.title)}</span>
      `;
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        onSelectItem(p);
      };
      grid.append(btn);
    });
    containerEl.hidden = false;
  }
  window.renderSimilarItemsInSheet = renderSimilarItemsInSheet;

  function openHomeSheet(item, list, typeKey = 'anime') {
    if (!item) return;
    const sh = ensureHomeSheet();
    homeSheetList = Array.isArray(list) && list.length ? list : [item];
    homeSheetIdx = homeSheetList.findIndex(x => x && x.id === item.id);
    if (homeSheetIdx < 0) homeSheetIdx = 0;
    homeSheetType = typeKey;

    const t = s => sh.querySelector(s);
    const card = t('.sheet-card');
    const bdEl = t('.sheet-backdrop');
    const bdImg = t('.sheet-backdrop-img');
    const bdUrl = item.banner || item.backdrop || '';
    if (bdUrl) {
      bdEl.hidden = false;
      bdImg.src = resolveAsset(bdUrl);
      card.classList.add('has-backdrop');
    } else {
      bdEl.hidden = true;
      bdImg.src = '';
      card.classList.remove('has-backdrop');
    }

    updateAmbientGlow(item.title || item.id);

    t('#home-sh-title').textContent = item.title || '';
    const effScore = getHomeEffectiveScore(item, typeKey);
    const stMap = { completed: 'İzlendi', watching: 'İzleniyor', paused: 'Beklemede', dropped: 'Bırakıldı', planned: 'Planlandı' };
    const bits = [];
    if (item.favorite) bits.push('★ Başyapıt');
    if (item.director) bits.push(item.director);
    if (item.author) bits.push(item.author);
    if (item.status) bits.push(stMap[item.status] || item.status);
    if (effScore) bits.push('★ ' + effScore);
    t('.sh-sub').textContent = bits.join(' · ');

    const genres = (Array.isArray(item.customGenres) && item.customGenres.length ? item.customGenres : (item.genres || []));
    const gWrap = t('.sh-genres');
    const sectionFolder = typeKey === 'movie' ? 'film/' : typeKey === 'series' ? 'dizi/' : typeKey === 'book' ? 'kitap/' : typeKey === 'manga' ? 'manga/' : 'anime/';
    gWrap.innerHTML = genres.map(g => `<a class="sh-genre-chip is-clickable" href="${root}${sectionFolder}?tur=${encodeURIComponent(g)}" title="${esc(g)} türündeki yapımları filtrele">${esc(g)}</a>`).join('');
    gWrap.hidden = !genres.length;

    const cov = t('.sheet-cover');
    if (item.image) {
      cov.src = resolveAsset(item.image.replace('/cover/medium/', '/cover/large/'));
      cov.hidden = false;
    } else {
      cov.hidden = true;
    }

    const ps = parts(item);
    const totEp = ps.reduce((a, p) => a + (p.episodes || 0), 0);
    const watEp = ps.reduce((a, p) => a + (p.watched || 0), 0);
    const pg = t('.sh-pg');
    if (totEp > 0 && watEp > 0 && watEp < totEp) {
      pg.hidden = false;
      pg.firstChild.style.setProperty('--w', Math.round((watEp / totEp) * 100) + '%');
    } else {
      pg.hidden = true;
    }

    const rbEl = t('#homeShRatingBreakdown');
    if (rbEl && window.TempestianRating) {
      window.TempestianRating.renderSheetBreakdown(rbEl, typeKey, item, effScore);
    }

    const ol = t('.parts');
    ol.replaceChildren();
    const FMT = { TV: 'TV', TV_SHORT: 'Kısa', MOVIE: 'Film', OVA: 'OVA', SPECIAL: 'Özel', ONA: 'ONA' };
    for (const p of ps) {
      const li = el('li', 'part ' + (p.status === 'COMPLETED' ? 'done' : p.status === 'CURRENT' ? 'cur' : p.status === 'DROPPED' ? 'drop' : 'no'));
      const epStr = p.episodes ? `${p.watched || 0}/${p.episodes} bölüm` : (p.watched ? `${p.watched} bölüm` : '');
      const stTxt = p.status === 'COMPLETED' ? 'İzlendi' : p.status === 'CURRENT' ? `İzleniyor · ${epStr}` : p.status === 'PAUSED' ? `Beklemede · ${epStr}` : 'Planlandı';
      li.innerHTML = `<span class="pd"></span><div class="pt"><span class="pt-name">${esc(p.name || item.title)}</span><span class="pm">${esc([FMT[p.format] || '', p.year, p.episodes > 1 ? p.episodes + ' bölüm' : '', p.score ? '★ ' + p.score : ''].filter(Boolean).join(' · '))}</span></div><span class="ps">${esc(stTxt)}</span>`;
      ol.append(li);
    }

    const simBox = t('#homeShSimilarBox');
    const fullPool = typeKey === 'movie' ? (cachedMoviesData || homeSheetList) : (cachedAnimeData || homeSheetList);
    renderSimilarItemsInSheet(simBox, item, fullPool, nextIt => openHomeSheet(nextIt, fullPool, typeKey), typeKey);

    const al = t('.sh-al');
    const extUrl = item.url || item.firstSeasonUrl || (item.anilistId ? 'https://anilist.co/anime/' + item.anilistId : '');
    if (extUrl) {
      al.href = extUrl;
      al.textContent = typeKey === 'anime' ? "AniList'te aç" : typeKey === 'movie' || typeKey === 'series' ? "IMDb'de aç" : 'Kaynakta aç';
      al.hidden = false;
    } else {
      al.hidden = true;
    }

    const prevBtn = t('[data-sh-prev]');
    const nextBtn = t('[data-sh-next]');
    const posLbl = t('[data-sh-pos]');
    if (posLbl) posLbl.textContent = `${homeSheetIdx + 1} / ${homeSheetList.length}`;
    if (prevBtn) {
      prevBtn.disabled = homeSheetIdx <= 0;
      prevBtn.onclick = () => { if (homeSheetIdx > 0) openHomeSheet(homeSheetList[homeSheetIdx - 1], homeSheetList, homeSheetType); };
    }
    if (nextBtn) {
      nextBtn.disabled = homeSheetIdx >= homeSheetList.length - 1;
      nextBtn.onclick = () => { if (homeSheetIdx < homeSheetList.length - 1) openHomeSheet(homeSheetList[homeSheetIdx + 1], homeSheetList, homeSheetType); };
    }

    const shareBtn = t('[data-sh-share]');
    if (shareBtn) {
      shareBtn.textContent = '🔗 Bağlantıyı Kopyala';
      shareBtn.onclick = () => {
        const folderMap = { anime: 'a', movie: 'f', series: 'd', book: 'k', manga: 'm' };
        const shareUrl = `${location.origin}/${folderMap[typeKey] || 'a'}/${encodeURIComponent(item.id)}.html`;
        navigator.clipboard.writeText(shareUrl).then(() => {
          shareBtn.textContent = '✓ Kopyalandı!';
          setTimeout(() => { shareBtn.textContent = '🔗 Bağlantıyı Kopyala'; }, 2000);
        });
      };
    }

    sh.hidden = false;
    document.body.style.overflow = 'hidden';
    card.scrollTop = 0;
  }
  window.openHomeSheet = openHomeSheet;

  // Step 7: Delegated click handler so any .sh-genre-chip on any archive page filters by genre immediately
  document.addEventListener('click', e => {
    const chipEl = e.target.closest('.sh-genre-chip');
    if (!chipEl) return;
    if (chipEl.tagName === 'A') return;
    const genreName = (chipEl.textContent || '').trim();
    if (!genreName) return;
    const matchingFilterBtn = [...document.querySelectorAll('[data-g="gn"]')].find(b => b.dataset.v === genreName);
    if (matchingFilterBtn) {
      e.preventDefault();
      matchingFilterBtn.click();
      const closeBtn = document.querySelector('.sheet:not([hidden]) [data-close]');
      if (closeBtn) closeBtn.click();
      showToast(`🏷️ "${genreName}" kategorisine göre filtrelendi`);
    }
  });

  // Step 8: Ambient glow on poster hover and detail modal open
  document.addEventListener('pointerover', e => {
    const card = e.target.closest('.poster-card, #list.grid li, .fame-card');
    if (card) {
      const title = card.querySelector('h3, .poster-title, .fame-title');
      updateAmbientGlow((title && title.textContent) || '');
    }
  }, { passive: true });

  // ============================================================================
  // STEP 1 (Rimuru Slime Loader) & HOME PAGE RENDERERS
  // ============================================================================
  const FMT_LABEL = { TV: 'TV', TV_SHORT: 'Kısa', MOVIE: 'Film', OVA: 'OVA', SPECIAL: 'Özel', ONA: 'ONA' };

  function buildPosterCard(item, href, gradIndex, showStatus, listContext = [], typeKey = 'anime') {
    const effScore = getHomeEffectiveScore(item, typeKey);
    const isMasterpiece = Boolean(item.favorite || (typeof effScore === 'number' && effScore >= 9.5));
    const a = el('a', `poster-card grad-${gradIndex % 10}${isMasterpiece ? ' is-fav' : ''}`);
    a.href = href;

    const artFrame = el('div', 'poster-art-frame');

    if (item.image) {
      const img = el('img');
      img.src = resolveAsset(item.image.replace('/cover/medium/', '/cover/large/'));
      img.alt = item.title || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.onload = () => {
        img.classList.add('in');
        a.classList.add('img-loaded');
      };
      if (img.complete) {
        img.classList.add('in');
        a.classList.add('img-loaded');
      }
      artFrame.append(img);
    } else {
      a.classList.add('img-loaded');
    }
    if (typeof effScore === 'number' && effScore > 0) {
      const badge = el('span', 'poster-rating');
      badge.innerHTML = `<span class="star">★</span>${effScore.toFixed(1)}`;
      artFrame.append(badge);
    }

    const ps = parts(item);
    const activePart = ps.find(p => p.status === 'CURRENT' || p.status === 'PAUSED') || ps[0];
    const watched = activePart ? (activePart.watched || 0) : 0;
    const total = activePart ? (activePart.episodes || 0) : 0;

    if (showStatus) {
      const stTxt = item.status === 'watching'
        ? (watched > 0 ? `İzleniyor · ${total ? watched + '/' + total : watched + '. blm'}` : 'İzleniyor')
        : item.status === 'paused'
        ? (watched > 0 ? `Beklemede · ${total ? watched + '/' + total : watched}` : 'Beklemede')
        : item.next ? 'Sıradaki' : '';
      if (stTxt) artFrame.append(el('span', 'poster-status-dot', stTxt));
      if (watched > 0 && total > 0) {
        const pct = Math.min(100, Math.round((watched / total) * 100));
        const pg = el('div', 'poster-card-pg');
        pg.innerHTML = `<i style="width:${pct}%"></i>`;
        artFrame.append(pg);
      }
    }

    const title = el('h3', 'poster-title', item.title || '');
    a.append(artFrame, title);

    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      openHomeSheet(item, listContext, typeKey);
    });

    return a;
  }

  function renderHeroSpotlight(animeList) {
    const heroEl = document.getElementById('heroSpotlight');
    if (!heroEl || !Array.isArray(animeList) || !animeList.length) return;

    const watchingItems = animeList.filter(a => a && a.status === 'watching');
    const masterpieces = animeList
      .filter(a => a && a.status !== 'watching' && (a.favorite || (getHomeEffectiveScore(a, 'anime') || 0) >= 9.5))
      .slice(0, 4);
    const slides = [...watchingItems, ...masterpieces].slice(0, 5);
    if (!slides.length && animeList[0]) slides.push(animeList[0]);
    if (!slides.length) return;

    const eyebrowEl = document.getElementById('heroEyebrow');
    const titleEl = document.getElementById('heroSpotlightTitle');
    const metaEl = document.getElementById('heroSpotlightMeta');
    const bgImg = document.getElementById('heroBgImg');
    const pgGroup = document.getElementById('heroProgressGroup');
    const pgFill = document.getElementById('heroProgressFill');
    const pgText = document.getElementById('heroProgressText');
    const detailBtn = document.getElementById('heroDetailBtn');
    const archiveBtn = document.getElementById('heroArchiveBtn');
    const navWrap = document.getElementById('heroCarouselNav');
    const dotsWrap = document.getElementById('heroSlideDots');
    const prevBtn = document.getElementById('heroPrevBtn');
    const nextBtn = document.getElementById('heroNextBtn');

    let activeSlideIdx = 0;
    let slideTimer = null;

    function showSlide(idx) {
      activeSlideIdx = (idx + slides.length) % slides.length;
      const target = slides[activeSlideIdx];
      if (!target) return;

      const targetPart = (Array.isArray(target.parts) && (target.parts.find(p => p && p.status === 'CURRENT') || target.parts[0])) || null;
      const isWatching = target.status === 'watching';
      const effSc = getHomeEffectiveScore(target, 'anime');

      if (eyebrowEl) {
        eyebrowEl.textContent = isWatching ? 'ŞU ANDA İZLENİYOR' : `★ BAŞYAPIT VİTRİNİ${effSc ? ' · ' + effSc.toFixed(1) : ''}`;
      }
      if (titleEl) titleEl.textContent = target.title || 'Tempestian';

      const fmt = targetPart && targetPart.format ? (FMT_LABEL[targetPart.format] || targetPart.format) : 'TV';
      const year = (targetPart && targetPart.year) || (target.parts && target.parts[0] && target.parts[0].year) || '';
      const genres = (Array.isArray(target.customGenres) && target.customGenres.length ? target.customGenres : (target.genres || [])).slice(0, 3);
      const metaParts = [fmt, year, ...genres].filter(Boolean);
      if (metaEl) metaEl.textContent = metaParts.join(' · ');

      const bgUrl = target.banner || target.image || '';
      if (bgImg) {
        if (bgUrl) {
          bgImg.classList.remove('loaded');
          bgImg.onload = () => bgImg.classList.add('loaded');
          bgImg.src = resolveAsset(bgUrl);
        } else {
          bgImg.classList.remove('loaded');
          bgImg.removeAttribute('src');
        }
      }

      const watched = (targetPart && typeof targetPart.watched === 'number') ? targetPart.watched : 0;
      const total = (targetPart && typeof targetPart.episodes === 'number') ? targetPart.episodes : 0;
      if (pgGroup && (watched > 0 || total > 0)) {
        const pct = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : (isWatching ? 25 : 100);
        if (pgFill) pgFill.style.width = pct + '%';
        if (pgText) pgText.textContent = total > 0 ? `${watched} / ${total} bölüm` : `${watched} bölüm`;
        pgGroup.hidden = false;
      } else if (pgGroup) {
        pgGroup.hidden = true;
      }

      if (detailBtn) {
        detailBtn.href = root + 'anime/#' + encodeURIComponent(target.id || '');
        detailBtn.onclick = e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          openHomeSheet(target, slides, 'anime');
        };
      }
      if (archiveBtn) archiveBtn.href = root + 'anime/#' + encodeURIComponent(target.id || '');
      if (activeSlideIdx === 0) heroEl.dataset.heroId = target.id || '';

      if (dotsWrap) {
        dotsWrap.querySelectorAll('.hero-dot').forEach((d, i) => {
          d.classList.toggle('active', i === activeSlideIdx);
          d.setAttribute('aria-selected', i === activeSlideIdx);
        });
      }
    }

    function resetAutoTimer() {
      clearInterval(slideTimer);
      if (slides.length > 1) {
        slideTimer = setInterval(() => {
          if (!document.hidden && (!homeSheetEl || homeSheetEl.hidden)) {
            showSlide(activeSlideIdx + 1);
          }
        }, 7000);
      }
    }

    if (slides.length > 1 && navWrap && dotsWrap) {
      dotsWrap.innerHTML = slides.map((s, i) => `<button type="button" class="hero-dot${i === 0 ? ' active' : ''}" role="tab" aria-label="${esc(s.title)}" title="${esc(s.title)}"></button>`).join('');
      dotsWrap.querySelectorAll('.hero-dot').forEach((d, i) => {
        d.onclick = () => { showSlide(i); resetAutoTimer(); };
      });
      if (prevBtn) prevBtn.onclick = () => { showSlide(activeSlideIdx - 1); resetAutoTimer(); };
      if (nextBtn) nextBtn.onclick = () => { showSlide(activeSlideIdx + 1); resetAutoTimer(); };
      navWrap.hidden = false;
      heroEl.addEventListener('pointerenter', () => clearInterval(slideTimer));
      heroEl.addEventListener('pointerleave', resetAutoTimer);

      // Step 5 (New List): Touch Swipe on Hero Spotlight Banner
      let touchStartX = 0;
      let touchStartY = 0;
      heroEl.addEventListener('touchstart', e => {
        if (!e.touches || !e.touches[0]) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });
      heroEl.addEventListener('touchend', e => {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          showSlide(dx < 0 ? activeSlideIdx + 1 : activeSlideIdx - 1);
          resetAutoTimer();
        }
      }, { passive: true });
    }

    showSlide(0);
    resetAutoTimer();
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
    const limit = Math.max(7, Number(hf.highlightsLimit) || 12);

    const standout = animeList
      .filter(a => a && typeof getHomeEffectiveScore(a, 'anime') === 'number' && getHomeEffectiveScore(a, 'anime') >= minScore)
      .sort((a, b) => (getHomeEffectiveScore(b, 'anime') || 0) - (getHomeEffectiveScore(a, 'anime') || 0) || (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
      .slice(0, limit);

    if (!standout.length) return;
    const fr = document.createDocumentFragment();
    standout.forEach((a, i) => fr.append(buildPosterCard(a, root + 'anime/#' + encodeURIComponent(a.id || ''), i, false, standout, 'anime')));
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
    const slice = queue.slice(0, 12);
    const fr = document.createDocumentFragment();
    slice.forEach((a, i) => fr.append(buildPosterCard(a, root + 'anime/#' + encodeURIComponent(a.id || ''), i + 7, true, slice, 'anime')));
    rail.replaceChildren(fr);
    sec.hidden = false;
  }

  // ============================================================================
  // CUSTOM FEATURE: "NE İZLEMELİYİM?" SPINNING WHEEL OF FORTUNE (Rimuru Edition)
  // ============================================================================
  const WHEEL_COLORS = [
    ['#1e3a8a', '#3b82f6'],
    ['#581c87', '#a855f7'],
    ['#065f46', '#10b981'],
    ['#7c2d12', '#f97316'],
    ['#831843', '#ec4899'],
    ['#312e81', '#6366f1'],
    ['#134e4a', '#14b8a6'],
    ['#713f12', '#eab308']
  ];

  function openWhatToWatchWheel(poolItems) {
    if (!Array.isArray(poolItems) || !poolItems.length) {
      showToast('Şu anda devam edilecek aktif içerik bulunamadı.');
      return;
    }

    let modal = document.getElementById('wheelModal');
    if (modal) modal.remove();

    modal = el('div', 'wheel-modal-backdrop');
    modal.id = 'wheelModal';
    modal.innerHTML = `
      <div class="wheel-modal-card" role="dialog" aria-modal="true" aria-label="Ne İzlemeliyim Çarkı">
        <button type="button" class="btn wheel-close-btn" id="wheelCloseBtn" aria-label="Kapat">${icon('close')}</button>
        <div class="wheel-head">
          <span class="wheel-eyebrow">RİMURU'NUN KADER ÇARKI · ${poolItems.length} AKTİF YAPIM</span>
          <h2>Ne İzlemeliyim?</h2>
          <p class="wheel-sub" id="wheelTickerText">Çarkı çevir, sıradaki devam edeceğin yapımı kader belirlesin!</p>
        </div>

        <div class="wheel-stage">
          <div class="wheel-pointer" aria-hidden="true">▼</div>
          <canvas id="wheelCanvas" width="380" height="380"></canvas>
          <button type="button" class="wheel-center-cap" id="wheelCenterSpinBtn" aria-label="Çarkı Çevir">
            <svg viewBox="0 0 64 54" width="34" height="28">
              <path d="M8 36 C8 17, 20 8, 32 8 C44 8, 56 17, 56 36 C56 46, 46 50, 32 50 C18 50, 8 46, 8 36 Z" fill="#58b9ff"/>
              <path d="M20 31 L26 29 M38 29 L44 31" stroke="#0b0d14" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="wheel-winner-card" id="wheelWinnerCard" hidden></div>

        <div class="wheel-actions">
          <button type="button" class="hero-btn-primary wheel-spin-btn" id="wheelSpinMainBtn">🎡 Çarkı Çevir!</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
      modal.remove();
      document.body.style.overflow = '';
    };
    modal.querySelector('#wheelCloseBtn').onclick = close;
    modal.onclick = e => { if (e.target === modal) close(); };

    const canvas = modal.querySelector('#wheelCanvas');
    const ctx = canvas.getContext('2d');
    const tickerEl = modal.querySelector('#wheelTickerText');
    const winnerBox = modal.querySelector('#wheelWinnerCard');
    const spinBtn = modal.querySelector('#wheelSpinMainBtn');
    const centerBtn = modal.querySelector('#wheelCenterSpinBtn');

    const items = poolItems.slice(0, 14);
    const N = items.length;
    const arc = (Math.PI * 2) / N;
    let currentAngle = 0;
    let isSpinning = false;

    function getPointerIndex(angle) {
      // Pointer is at top (-PI/2 = 3*PI/2)
      const norm = ((Math.PI * 1.5 - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      return Math.floor(norm / arc) % N;
    }

    function drawWheel(angle, highlightIdx = -1) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = cx - 12;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < N; i++) {
        const start = angle + i * arc;
        const end = start + arc;
        const [c1, c2] = WHEEL_COLORS[i % WHEEL_COLORS.length];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();

        const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, r);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, i === highlightIdx ? '#58b9ff' : c2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.lineWidth = i === highlightIdx ? 3 : 1.5;
        ctx.strokeStyle = i === highlightIdx ? '#ffffff' : 'rgba(11, 13, 20, 0.7)';
        ctx.stroke();

        // Slice Title
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px Inter, system-ui, sans-serif';
        const rawTitle = items[i].title || '';
        const label = rawTitle.length > 19 ? rawTitle.slice(0, 18) + '…' : rawTitle;
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 4;
        ctx.fillText(label, r - 16, 4);
        ctx.restore();
      }

      // Outer rim
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();
    }

    drawWheel(currentAngle);

    // Web Audio API subtle tick sound
    let audioCtx = null;
    function playTick(freq = 520, dur = 0.025) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + dur);
      } catch (_) {}
    }

    function spin() {
      if (isSpinning) return;
      isSpinning = true;
      winnerBox.hidden = true;
      spinBtn.disabled = true;
      spinBtn.textContent = '🌪️ Çark Dönüyor...';

      const extraSpins = (6 + Math.random() * 4) * Math.PI * 2;
      const startAngle = currentAngle;
      const targetAngle = startAngle + extraSpins;
      const duration = 4200;
      const startTime = performance.now();
      let lastSliceIdx = -1;

      function frame(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Dramatic quintic ease-out
        const easeOut = 1 - Math.pow(1 - t, 4.5);
        currentAngle = startAngle + (targetAngle - startAngle) * easeOut;

        const curIdx = getPointerIndex(currentAngle);
        if (curIdx !== lastSliceIdx) {
          lastSliceIdx = curIdx;
          const activeIt = items[curIdx];
          if (tickerEl && activeIt) tickerEl.textContent = `🎯 ${activeIt.title}`;
          playTick(440 + (1 - t) * 260, 0.022);
        }

        drawWheel(currentAngle, t >= 1 ? curIdx : -1);

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          isSpinning = false;
          spinBtn.disabled = false;
          spinBtn.textContent = '🔄 Tekrar Çevir';
          const winner = items[curIdx];
          playTick(780, 0.12);
          showWinner(winner);
        }
      }

      requestAnimationFrame(frame);
    }

    function showWinner(winner) {
      if (!winner) return;
      if (tickerEl) tickerEl.textContent = `🎉 Kaderin seçimi: ${winner.title}!`;
      const ps = parts(winner);
      const curPart = ps.find(p => p.status === 'CURRENT' || p.status === 'PAUSED') || ps[0];
      const epInfo = curPart && curPart.episodes
        ? `${curPart.watched || 0} / ${curPart.episodes} bölüm`
        : (curPart && curPart.watched ? `${curPart.watched}. bölümde kaldın` : 'Devam edilecek');
      const cover = winner.image ? resolveAsset(winner.image.replace('/cover/medium/', '/cover/large/')) : '';

      winnerBox.innerHTML = `
        <div class="ww-left">
          ${cover ? `<img class="ww-cover" src="${esc(cover)}" alt="${esc(winner.title)}">` : ''}
          <div class="ww-info">
            <span class="ww-badge">SIRADAKİ BÖLÜMÜN HAZIR</span>
            <h3 class="ww-title">${esc(winner.title)}</h3>
            <span class="ww-ep">${esc(epInfo)}</span>
          </div>
        </div>
        <button type="button" class="hero-btn-primary ww-open-btn" id="wwOpenBtn">İzlemeye Devam Et →</button>
      `;
      winnerBox.hidden = false;
      winnerBox.querySelector('#wwOpenBtn').onclick = () => {
        close();
        openHomeSheet(winner, items, winner._mediaType || 'anime');
      };
    }

    spinBtn.onclick = spin;
    centerBtn.onclick = spin;
  }

  function renderHomeMovies(movieList) {
    const sec = document.getElementById('homeMovies');
    const rail = document.getElementById('moviesRail');
    if (!sec || !rail || !Array.isArray(movieList) || !movieList.length) return;

    const slice = movieList.slice(0, 10);
    const fr = document.createDocumentFragment();
    slice.forEach((m, i) => fr.append(buildPosterCard(m, root + 'film/#' + encodeURIComponent(m.id || ''), i + 2, false, slice, 'movie')));
    rail.replaceChildren(fr);
    sec.hidden = false;
  }

  function renderHomeGuidesAndProjects(guideList, projectList) {
    const wrap = document.getElementById('homeLiveColumns');
    const gBox = document.getElementById('homeGuidesList');
    const pBox = document.getElementById('homeProjectsList');
    if (!wrap || !gBox || !pBox) return;

    const topGuides = [...(guideList || [])]
      .sort((a, b) => (Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))) || (b.addedAt || '').localeCompare(a.addedAt || ''))
      .slice(0, 3);

    const topProjects = [...(projectList || [])]
      .sort((a, b) => (Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))) || (b.addedAt || '').localeCompare(a.addedAt || ''))
      .slice(0, 3);

    if (!topGuides.length && !topProjects.length) return;

    gBox.innerHTML = topGuides.map(g => {
      const cat = (Array.isArray(g.customGenres) && g.customGenres[0]) || (Array.isArray(g.genres) && g.genres[0]) || 'GNU/Linux';
      const dt = (g.addedAt && window.formatHybridDate) ? window.formatHybridDate(g.addedAt) : (g.addedAt || '');
      return `
        <a class="home-preview-card" href="${esc(g.url || 'rehber/')}" target="_blank" rel="noopener">
          <div class="hp-top">
            <span class="tag${g.favorite ? ' tag-active' : ''}">${esc(cat)}</span>
            <span class="hp-meta">${esc(dt)}</span>
          </div>
          <h3 class="hp-title">${esc(g.title)}</h3>
          <span class="hp-link">Technopat Sosyal ↗</span>
        </a>
      `;
    }).join('');

    pBox.innerHTML = topProjects.map(p => {
      const lang = p.language || 'Linux';
      const col = p.languageColor || '#58b9ff';
      return `
        <a class="home-preview-card" href="${esc(p.url || 'projeler/')}" target="_blank" rel="noopener">
          <div class="hp-top">
            <span class="tag"><span class="lang-dot" style="background:${esc(col)}"></span>${esc(lang)}</span>
            ${p.isFork ? '<span class="tag tag-fork">Fork</span>' : ''}
          </div>
          <h3 class="hp-title">${esc(p.fullName || p.title || p.name)}</h3>
          <p class="hp-desc">${esc(p.summary || p.description || '')}</p>
        </a>
      `;
    }).join('');

    wrap.hidden = false;
  }

  function initShelfArrows() {
    document.querySelectorAll('.shelf-nav-btn[data-rail]').forEach(btn => {
      const rail = document.getElementById(btn.dataset.rail);
      if (!rail) return;
      btn.onclick = () => {
        const dir = btn.classList.contains('prev') ? -1 : 1;
        const step = Math.max(320, Math.round(rail.clientWidth * 0.72));
        rail.scrollBy({ left: dir * step, behavior: 'smooth' });
      };
    });
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
  // STEP 7 (New List) — LOCAL SEARCH INPUT CLEAR (✕) & LIVE MATCH COUNTER
  // ============================================================================
  function initLocalSearchEnhancements() {
    const qInp = document.getElementById('q');
    const searchWrap = qInp && qInp.closest('.search');
    if (!qInp || !searchWrap || searchWrap.querySelector('.local-search-clear')) return;

    const countBadge = el('span', 'local-search-count');
    countBadge.hidden = true;
    const clearBtn = el('button', 'search-clear local-search-clear', '✕');
    clearBtn.type = 'button';
    clearBtn.title = 'Aramayı Temizle';
    clearBtn.setAttribute('aria-label', 'Aramayı Temizle');

    searchWrap.append(countBadge, clearBtn);

    const updateSearchHUD = () => {
      const val = (qInp.value || '').trim();
      clearBtn.classList.toggle('on', val.length > 0);
      if (!val) {
        countBadge.hidden = true;
        return;
      }
      setTimeout(() => {
        const listEl = document.getElementById('list') || document.getElementById('guideList') || document.getElementById('projectList');
        if (!listEl) return;
        const visibleCount = [...listEl.children].filter(li => !li.hidden).length;
        countBadge.textContent = `${visibleCount} sonuç`;
        countBadge.hidden = false;
      }, 30);
    };

    qInp.addEventListener('input', updateSearchHUD);
    clearBtn.onclick = e => {
      e.preventDefault();
      qInp.value = '';
      qInp.dispatchEvent(new Event('input', { bubbles: true }));
      qInp.focus();
      updateSearchHUD();
    };
  }

  // ============================================================================
  // STEP 12 — TIER LIST EXPORT / SHARE IMAGE BUTTON
  // ============================================================================
  function initTierExportButton() {
    const tierBoard = document.getElementById('tierBoard');
    const toolsBar = document.querySelector('.tools');
    if (!tierBoard || !toolsBar || document.getElementById('tierExportBtn')) return;

    const expBtn = el('button', 'btn tier-export-btn');
    expBtn.id = 'tierExportBtn';
    expBtn.type = 'button';
    expBtn.hidden = true;
    expBtn.title = 'Katman Listesini Görsel Olarak İndir (PNG)';
    expBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Tier Görseli İndir</span>`;
    toolsBar.appendChild(expBtn);

    const syncVisibility = () => {
      expBtn.hidden = tierBoard.hidden;
    };
    const obs = new MutationObserver(syncVisibility);
    obs.observe(tierBoard, { attributes: true, attributeFilter: ['hidden'] });
    syncVisibility();

    expBtn.onclick = () => {
      const rows = [...tierBoard.querySelectorAll('.tier-row')];
      if (!rows.length) return;
      showToast('🖼️ Katman (Tier List) görseli hazırlanıyor...');

      const tierData = rows.map(r => {
        const letter = (r.querySelector('.tier-letter') && r.querySelector('.tier-letter').textContent) || 'S';
        const name = (r.querySelector('.tier-name') && r.querySelector('.tier-name').textContent) || '';
        const fg = r.querySelector('.tier-head') ? getComputedStyle(r.querySelector('.tier-head')).getPropertyValue('--tier-fg').trim() || '#f5c542' : '#f5c542';
        const items = [...r.querySelectorAll('.tier-card')].map(c => ({
          title: (c.querySelector('.tier-card-title') && c.querySelector('.tier-card-title').textContent) || '',
          score: (c.querySelector('.tier-card-sc') && c.querySelector('.tier-card-sc').textContent) || ''
        }));
        return { letter, name, fg, items };
      });

      const canvas = document.createElement('canvas');
      const W = 1200;
      const rowHeights = tierData.map(t => Math.max(96, 52 + Math.ceil(t.items.length / 4) * 38));
      const H = 110 + rowHeights.reduce((a, b) => a + b + 14, 0);
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#f4f6fb';
      ctx.font = '800 26px Inter, system-ui, sans-serif';
      const pageHeading = (document.querySelector('h1') && document.querySelector('h1').textContent) || 'Arşiv';
      ctx.fillText(`Tempestian · ${pageHeading} Katman Listesi (Tier List)`, 36, 56);

      ctx.fillStyle = '#9ba3b8';
      ctx.font = '500 14px Inter, system-ui, sans-serif';
      ctx.fillText(`tempestian.com · ${new Date().toLocaleDateString('tr-TR')}`, 36, 82);

      let y = 108;
      tierData.forEach((t, idx) => {
        const rh = rowHeights[idx];
        ctx.fillStyle = '#151926';
        ctx.fillRect(36, y, W - 72, rh);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeRect(36, y, W - 72, rh);

        ctx.fillStyle = t.fg.startsWith('var') ? '#58b9ff' : t.fg;
        ctx.fillRect(36, y, 88, rh);
        ctx.fillStyle = '#0b0d14';
        ctx.font = '800 28px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.letter, 80, y + rh / 2 + 10);
        ctx.textAlign = 'left';

        t.items.forEach((it, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const ix = 142 + col * 252;
          const iy = y + 16 + row * 36;
          ctx.fillStyle = '#1c2132';
          ctx.fillRect(ix, iy, 240, 28);
          ctx.fillStyle = '#f4f6fb';
          ctx.font = '600 12px Inter, system-ui, sans-serif';
          const shortT = it.title.length > 26 ? it.title.slice(0, 25) + '…' : it.title;
          ctx.fillText(shortT, ix + 10, iy + 18);
          if (it.score) {
            ctx.fillStyle = '#f5c542';
            ctx.font = '700 11px Inter, system-ui, sans-serif';
            ctx.fillText(it.score, ix + 195, iy + 18);
          }
        });

        y += rh + 14;
      });

      const link = document.createElement('a');
      link.download = `tempestian-${cur || 'tier'}-list.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('✅ Tier List görseli indirildi!');
    };
  }

  // ============================================================================
  // STEP 10 — GLOBAL COMMAND PALETTE (/ or Ctrl+K) COVERING ALL 7 ARCHIVES
  // ============================================================================
  let cmdPaletteMounted = false;
  let cachedAnimeData = null;
  let cachedMoviesData = null;
  let cachedSeriesData = null;
  let cachedBooksData = null;
  let cachedMangaData = null;
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
          <input type="text" class="cmd-palette-input" id="cmdInput" placeholder="Anime, film, dizi, kitap, manga, rehber veya proje ara..." autocomplete="off" spellcheck="false" />
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
      { id: 'stats', title: 'İstatistikler', desc: 'Tüm arşiv özeti ve grafikler', path: 'istatistik/', badge: 'Metrik' }
    ];

    async function loadData() {
      const loaders = [];
      if (!cachedAnimeData) loaders.push(fetch(root + 'data/anime.json').then(r => r.ok ? r.json() : null).then(j => { cachedAnimeData = (j && (j.anime || j.items)) || []; }).catch(() => { cachedAnimeData = []; }));
      if (!cachedMoviesData) loaders.push(fetch(root + 'data/movies.json').then(r => r.ok ? r.json() : null).then(j => { cachedMoviesData = (j && (j.items || j.movies)) || []; }).catch(() => { cachedMoviesData = []; }));
      if (!cachedSeriesData) loaders.push(fetch(root + 'data/series.json').then(r => r.ok ? r.json() : null).then(j => { cachedSeriesData = (j && (j.items || j.series)) || []; }).catch(() => { cachedSeriesData = []; }));
      if (!cachedBooksData) loaders.push(fetch(root + 'data/books.json').then(r => r.ok ? r.json() : null).then(j => { cachedBooksData = (j && (j.items || j.books)) || []; }).catch(() => { cachedBooksData = []; }));
      if (!cachedMangaData) loaders.push(fetch(root + 'data/manga.json').then(r => r.ok ? r.json() : null).then(j => { cachedMangaData = (j && (j.items || j.manga)) || []; }).catch(() => { cachedMangaData = []; }));
      if (!cachedGuidesData) loaders.push(fetch(root + 'data/guides.json').then(r => r.ok ? r.json() : null).then(j => { cachedGuidesData = (j && (j.items || j.guides)) || []; }).catch(() => { cachedGuidesData = []; }));
      if (!cachedProjectsData) loaders.push(fetch(root + 'data/projects.json').then(r => r.ok ? r.json() : null).then(j => { cachedProjectsData = (j && (j.items || j.projects)) || []; }).catch(() => { cachedProjectsData = []; }));
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

      let matchedSections = [], matchedAnime = [], matchedMovies = [], matchedSeries = [], matchedBooks = [], matchedManga = [], matchedGuides = [], matchedProjects = [], matchedActions = [];
      if (!trimmed) {
        matchedSections = defaultSections.slice(0, 6);
        matchedAnime = (cachedAnimeData || []).filter(a => a.favorite || (a.score && a.score >= 9.5)).slice(0, 4);
      } else {
        matchedActions = quickActions.filter(a => matchesText(a.title, trimmed) || matchesText(a.desc, trimmed) || (a.keywords && a.keywords.some(k => matchesText(k, trimmed))));
        matchedSections = defaultSections.filter(s => matchesText(s.title, trimmed) || matchesText(s.desc, trimmed)).slice(0, 4);
        matchedAnime = (cachedAnimeData || []).filter(a => matchesText(a.title, trimmed) || (a.customGenres && a.customGenres.some(g => matchesText(g, trimmed))) || (a.genres && a.genres.some(g => matchesText(g, trimmed)))).slice(0, 6);
        matchedMovies = (cachedMoviesData || []).filter(m => matchesText(m.title, trimmed) || matchesText(m.director, trimmed)).slice(0, 4);
        matchedSeries = (cachedSeriesData || []).filter(s => matchesText(s.title, trimmed) || matchesText(s.network, trimmed)).slice(0, 4);
        matchedBooks = (cachedBooksData || []).filter(b => matchesText(b.title, trimmed) || matchesText(b.author, trimmed)).slice(0, 4);
        matchedManga = (cachedMangaData || []).filter(m => matchesText(m.title, trimmed) || matchesText(m.author, trimmed)).slice(0, 4);
        matchedGuides = (cachedGuidesData || []).filter(g => matchesText(g.title, trimmed) || matchesText(g.forumSection, trimmed)).slice(0, 5);
        matchedProjects = (cachedProjectsData || []).filter(p => matchesText(p.title, trimmed) || matchesText(p.name, trimmed) || matchesText(p.description, trimmed)).slice(0, 3);
      }

      const totalFound = matchedActions.length + matchedSections.length + matchedAnime.length + matchedMovies.length + matchedSeries.length + matchedBooks.length + matchedManga.length + matchedGuides.length + matchedProjects.length;
      if (!totalFound) {
        resultsContainer.append(el('div', 'cmd-empty', `"${trimmed}" için sonuç bulunamadı.`));
        return;
      }

      const addGroup = (label, items, renderItem) => {
        if (!items.length) return;
        resultsContainer.append(el('div', 'cmd-group-title', label));
        items.forEach(it => resultsContainer.append(renderItem(it)));
      };

      const renderMediaCmdItem = (it, secId, folder, icName, subText) => {
        const item = el('a', 'cmd-item');
        item.href = (cur === secId ? '#' : root + folder + '#') + encodeURIComponent(it.id);
        const eff = getHomeEffectiveScore(it, secId);
        const sc = eff ? `★ ${Number(eff).toFixed(1)}` : folder.replace('/', '');
        const thumb = it.image ? `<img class="cmd-item-thumb" src="${esc(resolveAsset(it.image))}" alt="" loading="lazy">` : `<span class="cmd-item-ic">${icon(icName)}</span>`;
        item.innerHTML = `<div class="cmd-item-left">${thumb}<div class="cmd-item-info"><span class="cmd-item-title">${esc(it.title)}</span><span class="cmd-item-desc">${esc(subText)}</span></div></div><span class="cmd-item-badge">${esc(sc)}</span>`;
        item.onclick = e => {
          window.closeCommandPalette();
          if (cur === 'home' && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            openHomeSheet(it, [it], secId);
          }
        };
        return item;
      };

      addGroup('Bölümler', matchedSections, s => {
        const a = el('a', 'cmd-item');
        a.href = root + s.path;
        a.innerHTML = `<div class="cmd-item-left"><span class="cmd-item-ic">${icon(s.id === 'movie' ? 'movie' : s.id === 'book' ? 'book' : s.id === 'project' ? 'code' : s.id === 'timeline' ? 'clock' : s.id === 'stats' ? 'chart' : s.id)}</span><div class="cmd-item-info"><span class="cmd-item-title">${esc(s.title)}</span><span class="cmd-item-desc">${esc(s.desc)}</span></div></div><span class="cmd-item-badge">${esc(s.badge)}</span>`;
        a.onclick = () => window.closeCommandPalette();
        return a;
      });

      addGroup('Anime', matchedAnime, a => renderMediaCmdItem(a, 'anime', 'anime/', 'anime', (a.customGenres || a.genres || []).slice(0, 3).join(' · ') || 'Anime'));
      addGroup('Filmler', matchedMovies, m => renderMediaCmdItem(m, 'movie', 'film/', 'movie', [m.year, m.director].filter(Boolean).join(' · ') || 'Film'));
      addGroup('Diziler', matchedSeries, s => renderMediaCmdItem(s, 'series', 'dizi/', 'series', [s.network, s.year].filter(Boolean).join(' · ') || 'Dizi'));
      addGroup('Kitaplar', matchedBooks, b => renderMediaCmdItem(b, 'book', 'kitap/', 'book', b.author || 'Kitap'));
      addGroup('Mangalar', matchedManga, m => renderMediaCmdItem(m, 'manga', 'manga/', 'manga', m.author || 'Manga'));

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

    initShelfArrows();
    initTierExportButton();
    initLocalSearchEnhancements();

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
    initImageFallback();
    initTopNav();
    initCommandPalette();
    initInteractions();

    try {
      const cfg = await fetch(root + 'data/sections.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (cfg) {
        window.SITE_CONFIG = cfg;
        document.dispatchEvent(new CustomEvent('siteconfig', { detail: cfg }));

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

        const boxesTop = document.getElementById('boxesTop');
        const boxesBottom = document.getElementById('boxesBottom');
        if (boxesTop || boxesBottom) {
          const allBoxes = Array.isArray(cfg.boxes) ? cfg.boxes : [];
          renderCustomBoxes(boxesTop, allBoxes.filter(b => b.position !== 'below'));
          renderCustomBoxes(boxesBottom, allBoxes.filter(b => b.position === 'below'));
        }
      }

      if (cur === 'home') {
        const [animeJson, moviesJson, seriesJson, booksJson, mangaJson, guidesJson, projectsJson] = await Promise.all([
          fetch(root + 'data/anime.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(root + 'data/movies.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(root + 'data/series.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(root + 'data/books.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(root + 'data/manga.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
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

        const seriesList = (seriesJson && (seriesJson.items || seriesJson.series)) || [];
        cachedSeriesData = seriesList;
        const bookList = (booksJson && (booksJson.items || booksJson.books)) || [];
        cachedBooksData = bookList;
        const mangaList = (mangaJson && (mangaJson.items || mangaJson.manga)) || [];
        cachedMangaData = mangaList;

        // Bind "Ne İzlemeliyim?" Wheel button with all currently continuing/paused items across archives
        const wheelBtn = document.getElementById('whatToWatchBtn');
        if (wheelBtn) {
          const isContinuing = x => x && (x.status === 'watching' || x.status === 'paused' || Boolean(x.next));
          const activePool = [
            ...animeList.filter(isContinuing).map(x => ({ ...x, _mediaType: 'anime' })),
            ...seriesList.filter(isContinuing).map(x => ({ ...x, _mediaType: 'series' })),
            ...movieList.filter(isContinuing).map(x => ({ ...x, _mediaType: 'movie' })),
            ...mangaList.filter(isContinuing).map(x => ({ ...x, _mediaType: 'manga' })),
            ...bookList.filter(isContinuing).map(x => ({ ...x, _mediaType: 'book' }))
          ];
          wheelBtn.onclick = () => openWhatToWatchWheel(activePool);
        }

        const guideList = (guidesJson && (guidesJson.items || guidesJson.guides)) || [];
        cachedGuidesData = guideList;
        const gs = document.getElementById('hubGuideSub');
        if (gs && guideList.length) gs.textContent = `${guideList.length} teknik rehber · GNU/Linux & Donanım`;

        const projectList = (projectsJson && (projectsJson.items || projectsJson.projects)) || [];
        cachedProjectsData = projectList;
        const ps = document.getElementById('hubProjectSub');
        if (ps && projectList.length) ps.textContent = `${projectList.length} açık kaynak proje · GitHub`;

        renderHomeGuidesAndProjects(guideList, projectList);
      }
    } catch (e) {
      console.warn('Bootstrap error:', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
