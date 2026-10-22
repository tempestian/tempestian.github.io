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
  window.UI = { icon, el, parts, tally, resolveAsset, icons: Object.keys(P) };
  try { localStorage.removeItem('wall'); } catch (e) {}

  const dock = document.getElementById('dock'), list = document.getElementById('sections'), links = document.getElementById('links');
  const boxesTop = document.getElementById('boxesTop'), boxesBottom = document.getElementById('boxesBottom');
  const cover = x => x.image || null;

  // [AI-MIMARI-NOTU: ADIM 12 & 13 — ÇOKLU-MEDYA KART ÖZETLEYİCİ]
  const summarize = (s, j) => {
    const items = (j && (j[s.countKey] || j.items || j.anime)) || [];
    const t = j && j.stats ? { anime: j.stats.anime, season: j.stats.season, film: j.stats.film, ep: j.stats.episodes, avg: j.stats.avgScore } : tally(items, j && j.statsConfig);
    let nums;
    if (s.id === 'anime') {
      nums = [[t.anime, 'anime'], [t.season, 'sezon'], [t.film, 'film'], [t.ep, 'bölüm']];
    } else if (s.id === 'series') {
      nums = [[t.anime, 'dizi'], [t.season, 'sezon'], [t.ep, 'bölüm']];
    } else if (s.id === 'movie') {
      nums = [[t.anime || items.filter(x => x.status === 'completed').length, 'film'], ...(t.avg ? [[t.avg, 'ort. puan']] : [])];
    } else if (s.id === 'manga') {
      nums = [[t.anime, 'manga'], [t.ep, 'bölüm']];
    } else if (s.id === 'book') {
      nums = [[t.anime, 'kitap'], [t.ep, 'sayfa']];
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
      if (bt && (site.barTitle || site.title)) bt.textContent = site.barTitle || site.title;
      const ht = document.getElementById('heroTitle') || document.querySelector('.hero h1');
      if (ht && site.title !== undefined) ht.textContent = site.title;
      const hs = document.getElementById('heroSub') || document.querySelector('.hero .sub');
      if (hs) {
        if (site.subtitle !== undefined) hs.textContent = site.subtitle;
        hs.hidden = site.subtitle === '';
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
      if (bt && pg.title) bt.textContent = pg.title;
      const h1 = document.querySelector('.page-head h1');
      if (h1 && pg.title) h1.textContent = pg.title;
    }
  }

  function render(d, sum) {
    window.SITE_CONFIG = d;
    document.dispatchEvent(new CustomEvent('siteconfig', { detail: d }));
    applySiteIdentity(d);

    const visibleSections = (d.sections || []).filter(s => s && s.status !== 'hidden');
    const active = visibleSections.filter(s => s.status === 'active');

    // [AI-MIMARI-NOTU]: #dock zaten <nav id="dock" class="dock glass"> olduğu için
    // bağlantılar doğrudan #dock içine eklenir (iç içe <nav> kullanılmaz); böylece
    // tüm alt menü öğeleri yan yana (yatay flex satırı halinde) dizilir.
    if (dock) {
      if (active.length) {
        const homeLabel = (d.site && d.site.homeLabel) || 'Ana sayfa';
        const items = [{ id: 'home', title: homeLabel, href: root || './', icon: 'home' }, ...active.map(s => ({ id: s.id, title: s.title, href: root + s.path, icon: s.icon || s.id }))];
        const fr = document.createDocumentFragment();
        for (const it of items) {
          const a = el('a');
          a.href = it.href;
          if (it.id === cur) {
            a.setAttribute('aria-current', 'page');
            const pill = el('span', 'pill');
            pill.setAttribute('aria-hidden', 'true');
            a.append(pill);
          }
          a.insertAdjacentHTML('beforeend', icon(it.icon));
          a.append(el('span', '', it.title));
          fr.append(a);
        }
        dock.replaceChildren(fr);
        dock.hidden = false;
      } else {
        dock.replaceChildren();
        dock.hidden = true;
      }
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
        const li = el('li', 'tile glass sq' + (on ? '' : ' soon'));
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
          const ic = el('span', 'box-ic');
          ic.innerHTML = icon(s.icon);
          headLeft.append(ic);
        }
        headLeft.append(el('h2', '', s.title));
        top.append(headLeft);
        if (on) {
          const g = el('span', 'go'); g.innerHTML = icon('next'); top.append(g);
        } else {
          top.append(el('span', 'tag', s.badgeText || s.description || 'Yakında'));
        }
        box.append(top);
        if (s.subtitle) {
          box.append(el('p', 'box-txt', s.subtitle));
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
        const li = el('li'), a = el('a', 'glass', l.title);
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener me';
        const o = el('span', 'out'); o.innerHTML = icon('out'); a.append(o);
        li.append(a); fr.append(li);
      }
      links.replaceChildren(fr);
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
      const d = previewCfg || await fetch(root + 'data/sections.json').then(r => r.json());
      const sum = (cached && cached.s) || {};
      render(d, sum);
      if (list) {
        const previewAnime = json('tp_anime_preview');
        const previewMulti = json('tp_multimedia_preview') || {};
        await Promise.all((d.sections || []).filter(s => s.status === 'active' && s.data).map(async s => {
          try {
            const j = (s.id === 'anime' && previewAnime)
              ? previewAnime
              : (previewMulti[s.id] ? previewMulti[s.id] : await fetch(root + s.data).then(r => r.json()));
            sum[s.id] = summarize(s, j);
          } catch (e) {}
        }));
        render(d, sum);
      }
      if (!previewCfg) ls('ui2', JSON.stringify({ d, s: sum }));
    } catch (e) {}
  })();
})();
