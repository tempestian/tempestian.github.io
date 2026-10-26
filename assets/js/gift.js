// ============================================================================
// [AI-MIMARI-NOTU: SÜRPRİZ / HEDİYE GERİ SAYIM KUTUCUĞU]
// Bu modül ana sayfadaki `#gift` kutucuğunu yönetir.
// `data/sections.json` içindeki `gift` nesnesinden (`window.SITE_CONFIG.gift` veya
// `siteconfig` olayı üzerinden) gelen ayarları dinamik olarak uygular:
// - `enabled`: false ise kutucuk tamamen gizlenir.
// - `targetDate`: ISO 8601 tarih/saat (ör. "2026-10-27T00:00:00+03:00").
// - `leadText`, `dateLabel`, `expiredLeadText`, `expiredSubText`, `expiredUrl`, `units`.
// ============================================================================
(() => {
  const card = document.getElementById('gift'), btn = document.getElementById('giftBtn');
  if (!card || !btn) return;

  let cfg = {
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
  };

  let targetMs = Date.parse(cfg.targetDate);
  const cd = document.getElementById('giftCd'), lead = document.getElementById('giftLead'), date = document.getElementById('giftDate');
  const out = {}; cd.querySelectorAll('[data-u]').forEach(b => { out[b.dataset.u] = b; });
  const unitSpans = {}; cd.querySelectorAll('[data-ul]').forEach(s => { unitSpans[s.dataset.ul] = s; });
  const pad = n => String(n).padStart(2, '0');
  let timer = 0;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      for (const entry of entries) {
        card.classList.toggle('vis', entry.isIntersecting);
      }
    }, { threshold: 0.1, rootMargin: '60px' }).observe(card);
  } else {
    card.classList.add('vis');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      card.classList.remove('vis');
      if (timer) { clearInterval(timer); timer = 0; }
    } else {
      card.classList.add('vis');
      if (card.classList.contains('open') && targetMs > Date.now()) {
        render();
        if (!timer) timer = setInterval(render, 1000);
      }
    }
  });

  const render = () => {
    const left = targetMs - Date.now();
    if (isNaN( left ) || left <= 0) {
      lead.textContent = cfg.expiredLeadText || 'Hediyenin açılma zamanı geldi';
      if (cfg.expiredUrl) {
        date.innerHTML = '';
        const a = document.createElement('a');
        a.href = cfg.expiredUrl;
        a.textContent = cfg.expiredSubText || 'Sürprizi okumak için tıkla ✨';
        a.style.color = 'var(--accent)';
        a.style.fontWeight = '600';
        date.append(a);
      } else {
        date.textContent = cfg.expiredSubText || 'Az sonra burada olacak.';
      }
      cd.hidden = true;
      stop();
      return;
    }
    cd.hidden = false;
    if (lead.textContent !== (cfg.leadText || 'Hediyenin açılmasına kalan süre')) {
      lead.textContent = cfg.leadText || 'Hediyenin açılmasına kalan süre';
    }
    if (date.textContent !== (cfg.dateLabel || '')) {
      date.textContent = cfg.dateLabel || '';
    }
    const s = Math.floor(left / 1000);
    const dVal = String(Math.floor(s / 86400));
    const hVal = pad(Math.floor(s % 86400 / 3600));
    const mVal = pad(Math.floor(s % 3600 / 60));
    const sVal = pad(s % 60);
    if (out.d && out.d.textContent !== dVal) out.d.textContent = dVal;
    if (out.h && out.h.textContent !== hVal) out.h.textContent = hVal;
    if (out.m && out.m.textContent !== mVal) out.m.textContent = mVal;
    if (out.s && out.s.textContent !== sVal) out.s.textContent = sVal;
  };

  const start = () => { render(); if (!timer && targetMs > Date.now()) timer = setInterval(render, 1000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };

  function applyGiftConfig(newGift) {
    if (!newGift) return;
    cfg = { ...cfg, ...newGift, units: { ...cfg.units, ...(newGift.units || {}) } };
    if (cfg.enabled === false) {
      stop();
      card.hidden = true;
      return;
    }
    card.hidden = false;
    if (cfg.ariaLabel) card.setAttribute('aria-label', cfg.ariaLabel);

    const parsed = Date.parse(cfg.targetDate);
    if (!isNaN(parsed)) targetMs = parsed;

    const isExpired = isNaN(targetMs) || targetMs <= Date.now();
    if (isExpired && !card.classList.contains('open')) {
      card.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }

    const isOpen = card.classList.contains('open');
    btn.setAttribute('aria-label', isOpen ? (cfg.closeLabel || 'Sürprizi kapat') : (cfg.openLabel || 'Sürprizi aç'));
    for (const k of ['d', 'h', 'm', 's']) {
      if (unitSpans[k] && cfg.units[k]) unitSpans[k].textContent = cfg.units[k];
    }
    if (isOpen || isExpired) start();
    else {
      lead.textContent = cfg.leadText || '';
      date.textContent = cfg.dateLabel || '';
    }
  }

  if (window.SITE_CONFIG && window.SITE_CONFIG.gift) applyGiftConfig(window.SITE_CONFIG.gift);
  document.addEventListener('siteconfig', e => {
    if (e.detail && e.detail.gift) applyGiftConfig(e.detail.gift);
  });

  btn.addEventListener('click', () => {
    const isExpired = isNaN(targetMs) || targetMs <= Date.now();
    if (isExpired && card.classList.contains('open') && cfg.expiredUrl) {
      window.location.href = cfg.expiredUrl;
      return;
    }
    const open = !card.classList.contains('open');
    card.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? (cfg.closeLabel || 'Sürprizi kapat') : (cfg.openLabel || 'Sürprizi aç'));
    open ? start() : stop();
  });
})();
