(() => {
  const root = document.body.dataset.root || '', cur = document.body.dataset.section;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} };
  const json = k => { try { return JSON.parse(ls(k)); } catch (e) { return null; } };

  const P = {
    home: '<path d="M4 11.2 12 4.6l8 6.6V19a1 1 0 0 1-1 1h-4.2v-5.2H9.2V20H5a1 1 0 0 1-1-1z"/>',
    anime: '<rect x="3.5" y="4.5" width="17" height="12.5" rx="3.6"/><path d="M10.4 8.6v4.4l3.8-2.2z"/><path d="M8.5 20.3h7"/>',
    dot: '<circle cx="12" cy="12" r="7.5"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    moon: '<path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
    next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    out: '<path d="M8 16 16 8M9 8h7v7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/>',
    down: '<path d="m6 9.5 6 6 6-6"/>',
    grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="2"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="2"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="2"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="2"/>',
    list: '<path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20"/><circle cx="5" cy="6.5" r=".6"/><circle cx="5" cy="12" r=".6"/><circle cx="5" cy="17.5" r=".6"/>',
    star: '<path fill="currentColor" d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/>'
  };
  const icon = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.dot) + '</svg>';

  const themeBtn = document.getElementById('theme');
  const syncIcons = () => {
    document.querySelectorAll('[data-icon]').forEach(b => { b.innerHTML = icon(b.dataset.icon === 'theme' ? (document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon') : b.dataset.icon); });
    if (themeBtn) themeBtn.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
  };
  syncIcons(); document.addEventListener('themechange', syncIcons);
  if (themeBtn) themeBtn.onclick = () => window.toggleTheme();

  const bar = document.querySelector('.bar'), hero = document.querySelector('.hero'), de = document.documentElement;
  let tick = false;
  const upd = () => { tick = false; const h = Math.max(60, (hero ? hero.offsetHeight : 120) - (bar ? bar.offsetHeight : 60) - 6); de.style.setProperty('--p', Math.min(1, Math.max(0, scrollY / h)).toFixed(3)); };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', upd); upd();

  const wallEl = el('div', 'wall'); wallEl.setAttribute('aria-hidden', 'true'); document.body.prepend(wallEl);
  let wallNow = [];
  const wall = urls => {
    urls = [...new Set(urls.filter(Boolean))].slice(0, 3);
    if (!urls.length || urls.join() === wallNow.join()) return;
    wallNow = urls; ls('wall', JSON.stringify(urls)); wallEl.replaceChildren();
    for (const u of urls) { const im = new Image(); im.alt = ''; im.decoding = 'async'; im.onload = () => im.classList.add('in'); im.onerror = () => im.remove(); im.src = u; wallEl.append(im); }
  };
  window.UI = { icon, wall, el };
  wall(json('wall') || []);

  const dock = document.getElementById('dock'), list = document.getElementById('sections'), links = document.getElementById('links');
  const cover = x => x.image || null;
  function paint(d, data) {
    dock.replaceChildren();
    for (const s of [{ id: 'home', title: 'Ana sayfa', path: '' }, ...d.sections.filter(s => s.status === 'active')]) {
      const a = el('a'); a.href = (root + s.path) || './';
      if (s.id === cur) { a.setAttribute('aria-current', 'page'); a.append(el('i', 'pill')); }
      a.insertAdjacentHTML('beforeend', icon(s.icon || s.id)); a.append(el('span', '', s.title)); dock.append(a);
    }
    if (list) {
      list.replaceChildren();
      for (const s of d.sections) {
        const on = s.status === 'active', li = el('li', 'tile glass sq'), box = on ? Object.assign(el('a'), { href: root + s.path }) : el('div');
        const top = el('div', 'tile-top'); top.append(el('h2', '', s.title));
        if (on) { const g = el('span', 'go'); g.innerHTML = icon('next'); top.append(g); } else if (s.description) top.append(el('span', 'tag', s.description));
        box.append(top); if (!on) li.classList.add('soon');
        const j = data[s.id], items = (j && j[s.countKey]) || [];
        if (j) {
          const n = el('p', 'nums'), sum = f => items.reduce((t, x) => t + f(x), 0);
          const parts = s.id === 'anime' && items.every(x => x.seasons)
            ? [[items.length, 'anime'], [sum(x => x.seasons.length), 'sezon'], [sum(x => x.seasons.reduce((t, q) => t + (q.watched || 0), 0)), 'bölüm']]
            : [[items.length, s.unit || '']];
          for (const [v, l] of parts) { const sp = el('span'); sp.append(el('b', '', v), ' ' + l); n.append(sp); }
          box.append(n);
        }
        const imgs = items.map(cover).filter(Boolean).slice(0, 4);
        if (imgs.length) { const st = el('div', 'strip'); for (const u of imgs) { const im = el('img'); im.src = u; im.alt = ''; im.loading = 'lazy'; st.append(im); } box.append(st); }
        li.append(box); list.append(li);
      }
      const a = data.anime && data.anime.anime;
      if (a) wall(a.map(cover));
    }
    if (links) {
      links.replaceChildren();
      for (const l of d.links || []) { const li = el('li', 'glass'), a = el('a', '', l.title); a.href = l.url; a.rel = 'me noopener'; a.insertAdjacentHTML('beforeend', icon('out')); li.append(a); links.append(li); }
    }
  }

  const cached = json('ui1');
  if (cached) paint(cached.s, cached.d);
  (async () => {
    let d; try { d = await (await fetch(root + 'data/sections.json')).json(); } catch (e) { if (!cached) paint({ sections: [], links: [] }, {}); return; }
    const data = {};
    await Promise.all(d.sections.filter(s => s.data).map(async s => { try { data[s.id] = await (await fetch(root + s.data)).json(); } catch (e) {} }));
    const fresh = JSON.stringify({ s: d, d: data });
    if (!cached || fresh !== JSON.stringify(cached)) { ls('ui1', fresh); paint(d, data); }
  })();
})();
