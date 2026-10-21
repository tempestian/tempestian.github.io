(() => {
  const card = document.getElementById('gift'), btn = document.getElementById('giftBtn');
  if (!card || !btn) return;
  // 27 Ekim 2026 00.00, Türkiye saati (UTC+3) — cihaz saat diliminden bağımsız
  const TARGET = Date.parse('2026-10-27T00:00:00+03:00');
  const cd = document.getElementById('giftCd'), lead = document.getElementById('giftLead'), date = document.getElementById('giftDate');
  const out = {}; cd.querySelectorAll('[data-u]').forEach(b => { out[b.dataset.u] = b; });
  const pad = n => String(n).padStart(2, '0');
  let timer = 0;
  if ('IntersectionObserver' in window) new IntersectionObserver(e => card.classList.toggle('vis', e[0].isIntersecting)).observe(card); else card.classList.add('vis');

  const render = () => {
    const left = TARGET - Date.now();
    if (left <= 0) {
      lead.textContent = 'Hediyenin açılma zamanı geldi';
      date.textContent = 'Az sonra burada olacak.';
      cd.hidden = true; stop(); return;
    }
    const s = Math.floor(left / 1000);
    out.d.textContent = Math.floor(s / 86400);
    out.h.textContent = pad(Math.floor(s % 86400 / 3600));
    out.m.textContent = pad(Math.floor(s % 3600 / 60));
    out.s.textContent = pad(s % 60);
  };
  const start = () => { render(); if (!timer && TARGET > Date.now()) timer = setInterval(render, 1000); };
  const stop = () => { clearInterval(timer); timer = 0; };

  btn.addEventListener('click', () => {
    const open = !card.classList.contains('open');
    card.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? 'Sürprizi kapat' : 'Sürprizi aç');
    open ? start() : stop();
  });
})();
