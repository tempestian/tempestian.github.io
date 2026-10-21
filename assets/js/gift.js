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
    leadText: 'Hediyenin açılmasına kalan süre',
    targetDate: '2026-10-27T00:00:00+03:00',
    dateLabel: '27 Ekim 2026 · 00.00 (TSİ)',
    expiredLeadText: 'Hediyenin açılma zamanı geldi',
    expiredSubText: 'Az sonra burada olacak.',
    expiredUrl: '',
    units: { d: 'Gün', h: 'Saat', m: 'Dakika', s: 'Saniye' }
  };

  let targetMs = Date.parse(cfg.targetDate);
  const cd = document.getElementById('giftCd'), lead = document.getElementById('giftLead'), date = document.getElementById('giftDate');
  const out = {}; cd.querySelectorAll('[data-u]').forEach(b => { out[b.dataset.u] = b; });
  const unitSpans = {}; cd.querySelectorAll('[data-ul]').forEach(s => { unitSpans[s.dataset.ul] = s; });
  const pad = n => String(n).padStart(2, '0');
  let timer = 0;

  if ('IntersectionObserver' in window) new IntersectionObserver(e => card.classList.toggle('vis', e[0].isIntersecting)).observe(card);
  else card.classList.add('vis');

  const render = () => {
    const left = targetMs - Date.now();
    if (isNaN( left ) || left <= 0) {
      lead.textContent = cfg.expiredLeadText || 'Hediyenin açılma zamanı geldi';
      if (cfg.expiredUrl) {
        date.innerHTML = '';
        const a = document.createElement('a');
        a.href = cfg.expiredUrl;
        a.textContent = cfg.expiredSubText || 'Açmak için tıklayın';
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
    lead.textContent = cfg.leadText || 'Hediyenin açılmasına kalan süre';
    date.textContent = cfg.dateLabel || '';
    const s = Math.floor(left / 1000);
    out.d.textContent = Math.floor(s / 86400);
    out.h.textContent = pad(Math.floor(s % 86400 / 3600));
    out.m.textContent = pad(Math.floor(s % 3600 / 60));
    out.s.textContent = pad(s % 60);
  };

  const start = () => { render(); if (!timer && targetMs > Date.now()) timer = setInterval(render, 1000); };
  const stop = () => { clearInterval(timer); timer = 0; };

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
    const isOpen = card.classList.contains('open');
    btn.setAttribute('aria-label', isOpen ? (cfg.closeLabel || 'Sürprizi kapat') : (cfg.openLabel || 'Sürprizi aç'));
    for (const k of ['d', 'h', 'm', 's']) {
      if (unitSpans[k] && cfg.units[k]) unitSpans[k].textContent = cfg.units[k];
    }
    const parsed = Date.parse(cfg.targetDate);
    if (!isNaN(parsed)) targetMs = parsed;
    if (isOpen) start();
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
    const open = !card.classList.contains('open');
    card.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? (cfg.closeLabel || 'Sürprizi kapat') : (cfg.openLabel || 'Sürprizi aç'));
    open ? start() : stop();
  });
})();
