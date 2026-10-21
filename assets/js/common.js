// ============================================================================
// [AI-MIMARI-NOTU: ORTAK KABUK, DİNAMİK SİTE YAPILANDIRMASI VE KUTUCUK MOTORU]
// Bu dosya tüm sayfalarda (Ana sayfa, Anime ve ileride eklenecek Manga, Kitap,
// Film, Dizi, Rehber vb. alt sayfalarda) çalışan ortak veri ve arayüz katmanıdır.
//
// 1. Veri Kaynağı: `data/sections.json` (schemaVersion: 2).
//    - `site`: Başlık, alt başlık, üst çubuk başlığı, meta açıklama ve ikon/logo yolları.
//    - `gift`: Ana sayfadaki sürpriz geri sayım kutucuğunun tüm metinleri, hedef tarihi ve aktiflik durumu.
//    - `boxes`: Admin panelinden eklenebilen özel bilgi/duyuru/kart kutucukları (`position`: 'above' | 'below').
//    - `sections`: Sitedeki ana içerik kategorileri (Anime, Manga, Kitap, Dizi, Film, Rehber vb.).
//      `status`: 'active' (hem alt menüde hem ana sayfada tıklanabilir),
//                'soon' (ana sayfada "Yakında" etiketiyle görünür),
//                'hidden' (taslak; arayüzde gizlenir).
//    - `links`: Ana sayfanın altındaki dış bağlantı kutucukları (`enabled`: true/false).
//    - `pages`: Alt sayfaların (ör. `pages.anime`) başlık, arama, boş durum ve alt bilgi metinleri.
//
// 2. Önbellek ve Canlı Önizleme:
//    - `localStorage['ui2']`: Ziyaretçiler için son çekilen yapılandırma ve özet veriyi saklar (anında çizim sağlar).
//    - `localStorage['tp_site_preview']`: Admin panelinde "Önizlemeye Uygula" dendiğinde GitHub'a commit
//      atmadan önce sitede canlı test yapılmasını sağlar.
// ============================================================================
(() => {
  const root = document.body.dataset.root || '', cur = document.body.dataset.section;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} };
  const json = k => { try { return JSON.parse(ls(k)); } catch (e) { return null; } };

  // [AI-MIMARI-NOTU]: İleride eklenecek yeni bölümler (manga, book, movie, series, guide, game vb.)
  // için ikon sözlüğü şimdiden genişletilmiştir. `sections.json` içindeki `icon` alanı buradaki anahtarları kullanır.
  const P = {
    home: '<path d="M4 11.2 12 4.6l8 6.6V19a1 1 0 0 1-1 1h-4.2v-5.2H9.2V20H5a1 1 0 0 1-1-1z"/>',
    anime: '<rect x="3.5" y="4.5" width="17" height="12.5" rx="3.6"/><path d="M10.4 8.6v4.4l3.8-2.2z"/><path d="M8.5 20.3h7"/>',
    manga: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5V5.5"/><path d="M8 7h8M8 11h6"/>',
    book: '<path d="M12 6.2c-1.8-1.5-4.4-2-7-1.7v13.8c2.6-.3 5.2.2 7 1.7 1.8-1.5 4.4-2 7-1.7V4.5c-2.6-.3-5.2.2-7 1.7z"/><path d="M12 6.2v13.8"/>',
    movie: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/>',
    series: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="m8 3 4 3 4-3"/><path d="M10 10.2v4.6l4-2.3z"/>',
    guide: '<circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-2 5.6-5.6 2 2-5.6z"/>',
    game: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M6.5 12h4M8.5 10v4"/><circle cx="15.5" cy="11" r=".8" fill="currentColor"/><circle cx="17.5" cy="13" r=".8" fill="currentColor"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    sparkle: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
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
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    chev: '<path d="m6 9.5 6 6 6-6"/>',
    star: '<path fill="currentColor" d="M12 3.9l2.4 5.1 5.6.7-4.1 3.9 1 5.6L12 16.4 7.1 19.2l1-5.6L4 9.7l5.6-.7z"/>'
  };
  const icon = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.dot) + '</svg>';

  const resolveAsset = u => {
    if (!u) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
    return root + u.replace(/^\.?\//, '');
  };

  const themeBtn = document.getElementById('theme');
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

  const parts = it => it.parts || (it.seasons || []).map(s => ({ ...s, kind: 'season' }));
  const tally = items => {
    const t = { anime: 0, season: 0, film: 0, ep: 0 };
    for (const it of items) {
      const done = parts(it).filter(p => p.status === 'COMPLETED' && p.watched > 0);
      if (!done.length) continue;
      t.anime++;
      for (const p of done) {
        if (p.kind === 'season') t.season++; else if (p.kind === 'movie') t.film++;
        t.ep += p.watched;
      }
    }
    return t;
  };
  window.UI = { icon, el, parts, tally, resolveAsset, icons: Object.keys(P) };
  try { localStorage.removeItem('wall'); } catch (e) {}

  const dock = document.getElementById('dock'), list = document.getElementById('sections'), links = document.getElementById('links');
  const boxesTop = document.getElementById('boxesTop'), boxesBottom = document.getElementById('boxesBottom');
  const cover = x => x.image || null;

  // Ana sayfa için yalnızca özet (sayılar + 4 kapak) saklanır; 150KB'lık JSON her sayfada işlenmez.
  const summarize = (s, j) => {
    const items = (j && j[s.countKey]) || [];
    const t = j && j.stats ? { anime: j.stats.anime, season: j.stats.season, film: j.stats.film, ep: j.stats.episodes } : tally(items);
    const nums = s.id === 'anime' && items.every(x => x.parts || x.seasons)
      ? [[t.anime, 'anime'], [t.season, 'sezon'], [t.film, 'film'], [t.ep, 'bölüm']]
      : [[items.length, s.unit || '']];
    return { nums: j ? nums : null, imgs: s.showStrip === false ? [] : items.map(cover).filter(Boolean).slice(0, 4) };
  };

  // [AI-MIMARI-NOTU]: Özel kutucukları (duyuru, bilgi, özel kart vb.) ana sayfadaki
  // kategori kutucuklarıyla aynı Liquid Glass (.tile.glass.sq) tasarım dilinde üretir.
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
      if (bt && (site.barTitle || site.title)) bt.textContent = site.barTitle || site.title;
      const ht = document.getElementById('heroTitle') || document.querySelector('.hero h1');
      if (ht && site.title !== undefined) ht.textContent = site.title;
      const hs = document.getElementById('heroSub') || document.querySelector('.hero .sub');
      if (hs) {
        if (site.subtitle !== undefined) hs.textContent = site.subtitle;
        hs.hidden = site.subtitle === '';
      }
      const hl = document.getElementById('heroLogo') || document.querySelector('.hero .mark');
      if (hl) {
        if (site.logo) {
          hl.src = resolveAsset(site.logo);
          hl.hidden = false;
        } else if (site.logo === '') {
          hl.hidden = true;
        }
      }
    } else if (cur && d && d.pages && d.pages[cur]) {
      const pg = d.pages[cur];
      if (pg.metaTitle) document.title = pg.metaTitle;
      else if (pg.title && site.title) document.title = `${pg.title} · ${site.title}`;
      if (pg.description) {
        const md = document.querySelector('meta[name="description"]');
        if (md) md.content = pg.description;
      }
      const bt = document.querySelector('.bar-title');
      if (bt && pg.title) bt.textContent = pg.title;
      const ht = document.querySelector('.hero h1');
      if (ht && pg.title) ht.textContent = pg.title;
    }
  }

  function paint(d, sum) {
    if (!d) return;
    window.SITE_CONFIG = d;
    applySiteIdentity(d);

    const secs = (d.sections || []).filter(s => s && s.status !== 'hidden');
    const homeLabel = (d.site && d.site.homeLabel) || 'Ana sayfa';

    if (dock) {
      const fr = document.createDocumentFragment();
      for (const s of [{ id: 'home', title: homeLabel, path: '', icon: 'home' }, ...secs.filter(s => s.status === 'active')]) {
        const a = el('a'); a.href = (root + s.path) || './';
        if (s.id === cur) { a.setAttribute('aria-current', 'page'); a.append(el('i', 'pill')); }
        a.insertAdjacentHTML('beforeend', icon(s.icon || s.id)); a.append(el('span', '', s.title)); fr.append(a);
      }
      dock.replaceChildren(fr);
    }

    if (boxesTop || boxesBottom) {
      const allBoxes = d.boxes || [];
      renderCustomBoxes(boxesTop, allBoxes.filter(b => (b.position || 'above') === 'above'));
      renderCustomBoxes(boxesBottom, allBoxes.filter(b => b.position === 'below'));
    }

    if (list) {
      const lf = document.createDocumentFragment();
      for (const s of secs) {
        const on = s.status === 'active', li = el('li', 'tile glass sq'), box = on ? Object.assign(el('a'), { href: root + s.path }) : el('div');
        const top = el('div', 'tile-top'); top.append(el('h2', '', s.title));
        if (on) {
          if (s.badge) top.append(el('span', 'tag', s.badge));
          const g = el('span', 'go'); g.innerHTML = icon('next'); top.append(g);
        } else if (s.description) {
          top.append(el('span', 'tag', s.description));
        }
        box.append(top);
        if (!on) li.classList.add('soon');
        if (s.subtitle) box.append(el('p', 'box-txt', s.subtitle));

        const m = sum && sum[s.id];
        const customNums = Array.isArray(s.customStats) && s.customStats.length
          ? s.customStats.map(cs => [cs.value, cs.label])
          : null;
        const numsToRender = customNums || (m && m.nums);
        if (numsToRender && numsToRender.length) {
          const n = el('p', 'nums');
          for (const [v, l] of numsToRender) { const sp = el('span'); sp.append(el('b', '', v), ' ' + l); n.append(sp); }
          box.append(n);
        }
        if (s.showStrip !== false && m && m.imgs && m.imgs.length) {
          const st = el('div', 'strip');
          for (const u of m.imgs) { const im = el('img'); im.src = resolveAsset(u); im.alt = ''; im.width = 48; im.height = 72; im.decoding = 'async'; st.append(im); }
          box.append(st);
        }
        li.append(box); lf.append(li);
      }
      list.replaceChildren(lf);
    }

    if (links) {
      const lf = document.createDocumentFragment();
      for (const l of (d.links || []).filter(x => x && x.enabled !== false)) {
        const li = el('li', 'glass'), a = el('a', '', l.title);
        a.href = l.url;
        a.rel = 'me noopener';
        a.insertAdjacentHTML('beforeend', icon(l.icon || 'out'));
        li.append(a);
        lf.append(li);
      }
      links.replaceChildren(lf);
    }

    document.dispatchEvent(new CustomEvent('siteconfig', { detail: d }));
  }

  try { localStorage.removeItem('ui1'); } catch (e) {}
  const previewCfg = json('tp_site_preview');
  const cached = json('ui2');
  if (previewCfg) {
    paint(previewCfg, (cached && cached.m) || {});
  } else if (cached && cached.s) {
    paint(cached.s, cached.m || {});
  }

  (async () => {
    let d;
    try {
      d = previewCfg || await (await fetch(root + 'data/sections.json')).json();
    } catch (e) {
      if (!cached) paint({ sections: [], links: [] }, {});
      return;
    }
    const sum = {};
    if (list) {   // sayı ve kapaklar yalnızca ana sayfada gerekir
      await Promise.all((d.sections || []).filter(s => s && s.status !== 'hidden' && s.data).map(async s => {
        try { sum[s.id] = summarize(s, await (await fetch(root + s.data)).json()); } catch (e) {}
      }));
    } else if (cached && cached.m) {
      Object.assign(sum, cached.m);
    }
    const fresh = JSON.stringify({ s: d, m: sum });
    if (!previewCfg && (!cached || fresh !== JSON.stringify(cached))) {
      ls('ui2', fresh);
      if (!cached || list) paint(d, sum); else paint(d, cached.m);
    } else if (previewCfg) {
      paint(d, sum);
    }
  })();
})();
