// ============================================================================
// [TEMPESTIAN AÇIK KAYNAK PROJELER & FORKLAR KATALOĞU MOTORU]
// Bu dosya `/projeler/` sayfasını (`data/projects.json`) oluşturur.
// - Kişisel NixOS yapılandırmaları, Quickshell/Niri masaüstü kabuk forkları ve
//   açık kaynak depoları zengin katalog kartları (`.project-card`) olarak sunulur.
// - Kartlar doğrudan ilgili GitHub deposuna yönlendirir (`target="_blank" rel="noopener"`).
// - Kategori ve teknoloji çipleri, arama (`#q`), sıralama (`#sort`) ve
//   öne çıkan filtreleri içerir.
// ============================================================================
(() => {
  const $ = s => document.querySelector(s);
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} }

  const state = {
    items: [],
    filter: 'all',
    sort: 'added',
    q: ''
  };

  const pageTexts = {
    searchPlaceholder: 'Proje adı, teknoloji veya anahtar kelime ara...',
    emptyText: 'Henüz proje eklenmemiş veya aramayla eşleşen proje yok.',
    detailsText: 'Ayrıntılar',
    externalButtonText: 'GitHub Deposu',
    footerText: 'Tüm projeler açık kaynaklıdır. Kartlara tıklayarak doğrudan ilgili GitHub deposuna gidebilirsiniz.'
  };

  function applyProjectPageConfig(cfg) {
    const pg = cfg && cfg.pages && cfg.pages.project;
    if (!pg) return;
    Object.assign(pageTexts, pg);
    const qEl = $('#q');
    if (qEl && pg.searchPlaceholder) qEl.placeholder = pg.searchPlaceholder;
    const footEl = document.querySelector('.foot');
    if (footEl && pg.footerText !== undefined) {
      footEl.textContent = pg.footerText;
      footEl.hidden = pg.footerText === '';
    }
    const emptyEl = $('#empty');
    if (emptyEl && pg.emptyText) emptyEl.textContent = pg.emptyText;
    const moreBtn = document.querySelector('#stats > .more');
    if (moreBtn && pg.detailsText) {
      const ic = moreBtn.querySelector('svg');
      moreBtn.textContent = pg.detailsText;
      if (ic) moreBtn.append(ic);
    }
    document.querySelectorAll('.project-out-badge > span').forEach(sp => {
      if (pg.externalButtonText) sp.textContent = pg.externalButtonText;
    });
  }
  if (window.SITE_CONFIG) applyProjectPageConfig(window.SITE_CONFIG);
  document.addEventListener('siteconfig', e => applyProjectPageConfig(e.detail));

  function getCategories(it) {
    if (!it) return [];
    const arr = Array.isArray(it.categories) && it.categories.length ? it.categories : (it.genres || []);
    return [...new Set(arr.map(g => String(g).trim()).filter(Boolean))];
  }

  function renderStats(items) {
    const box = $('#stats');
    if (!box) return;
    box.replaceChildren();
    if (!items.length) {
      box.hidden = true;
      return;
    }

    const catCounts = {};
    let favCount = 0;
    let forkCount = 0;
    for (const it of items) {
      if (it.favorite) favCount++;
      if (it.isFork) forkCount++;
      for (const c of getCategories(it)) {
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
    }
    const sortedCats = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a] || a.localeCompare(b, 'tr'));

    const row = h('div', 'stats-row project-stats-row');
    const statPairs = [
      [items.length, 'proje'],
      [sortedCats.length, 'kategori / teknoloji']
    ];
    if (forkCount > 0) statPairs.push([forkCount, 'özel fork']);
    if (favCount > 0) statPairs.push([favCount, '★ öne çıkan']);

    for (const [v, l] of statPairs) {
      const e = h('div', 'stat');
      e.innerHTML = '<b></b><span></span>';
      e.firstChild.textContent = v;
      e.lastChild.textContent = l;
      row.append(e);
    }

    if (sortedCats.length) {
      const more = h('button', 'more', pageTexts.detailsText || 'Ayrıntılar');
      more.type = 'button';
      more.setAttribute('aria-expanded', 'false');
      more.insertAdjacentHTML('beforeend', window.UI ? window.UI.icon('down') : '');

      const ins = h('div', 'ins');
      const inn = h('div', 'ins-in');
      ins.append(inn);

      const blk = h('div', 'blk');
      blk.append(h('h4', null, 'Proje teknoloji & kategori dağılımı'));

      const maxG = Math.max(1, ...sortedCats.map(c => catCounts[c]));
      const totalItems = Math.max(1, items.length);
      const gBars = h('div', 'genre-bars');
      for (const c of sortedCats) {
        const cnt = catCounts[c];
        const pct = Math.round((cnt / totalItems) * 100);
        const widthPct = Math.round((cnt / maxG) * 100);
        const btn = h('button', 'genre-bar-row');
        btn.type = 'button';
        btn.innerHTML = `<div class="gb-head"><span class="gb-name"></span><span class="gb-val"></span></div><div class="gb-track"><i style="--w:${widthPct}%"></i></div>`;
        btn.querySelector('.gb-name').textContent = c;
        btn.querySelector('.gb-val').textContent = `${cnt} proje (%${pct})`;
        btn.onclick = () => {
          state.filter = state.filter === c ? 'all' : c;
          renderList();
          const listEl = $('#projectList');
          if (listEl) listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        gBars.append(btn);
      }
      blk.append(gBars);
      inn.append(blk);

      more.onclick = () => {
        const o = box.classList.toggle('open');
        more.setAttribute('aria-expanded', o);
      };
      row.append(more);
      box.append(row, ins);
    } else {
      box.append(row);
    }
    box.hidden = false;
  }

  function renderChips(items) {
    const chips = $('#chips');
    if (!chips) return;
    chips.replaceChildren();

    const addChip = (val, label, count) => {
      const b = h('button', null, label);
      b.type = 'button';
      b.dataset.filter = val;
      b.setAttribute('aria-pressed', state.filter === val);
      if (count != null) b.append(h('small', null, count));
      b.onclick = () => {
        state.filter = val;
        renderList();
      };
      chips.append(b);
    };

    addChip('all', 'Hepsi', items.length);
    const favCount = items.filter(i => i.favorite).length;
    if (favCount > 0) addChip('__fav__', '★ Öne Çıkanlar', favCount);

    const forkCount = items.filter(i => i.isFork).length;
    if (forkCount > 0) addChip('__fork__', 'Forklar', forkCount);

    const catCounts = {};
    for (const it of items) {
      for (const c of getCategories(it)) {
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
    }
    const sortedCats = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a] || a.localeCompare(b, 'tr'));
    for (const c of sortedCats) {
      addChip(c, c, catCounts[c]);
    }
  }

  function renderList() {
    const ul = $('#projectList');
    if (!ul) return;
    ul.replaceChildren();

    document.querySelectorAll('#chips [data-filter]').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.filter === state.filter);
    });

    const q = state.q.trim().toLocaleLowerCase('tr');
    const filtered = state.items.filter(it => {
      const cats = getCategories(it);
      if (state.filter === '__fav__' && !it.favorite) return false;
      if (state.filter === '__fork__' && !it.isFork) return false;
      if (state.filter !== 'all' && state.filter !== '__fav__' && state.filter !== '__fork__' && !cats.includes(state.filter)) return false;
      if (q) {
        const hay = `${it.title || ''} ${it.name || ''} ${it.fullName || ''} ${it.description || ''} ${it.summary || ''} ${cats.join(' ')} ${(it.tags || []).join(' ')} ${it.language || ''}`.toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (state.sort === 'title') return (a.title || a.name || '').localeCompare(b.title || b.name || '', 'tr');
      if (state.sort === 'fav') return (Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))) || (b.addedAt || '').localeCompare(a.addedAt || '');
      return (b.addedAt || '').localeCompare(a.addedAt || '') || (a.title || a.name || '').localeCompare(b.title || b.name || '', 'tr');
    });

    let afBar = $('#activeFilters');
    const tbPanel = document.querySelector('.tools') || $('#chips');
    if (!afBar && tbPanel && tbPanel.parentElement) {
      afBar = h('div', 'iris-active-filters');
      afBar.id = 'activeFilters';
      afBar.hidden = true;
      tbPanel.insertAdjacentElement('afterend', afBar);
    }
    if (afBar) {
      const pills = [];
      if (state.filter !== 'all') {
        const lbl = state.filter === '__fav__' ? '★ Öne Çıkanlar' : state.filter === '__fork__' ? 'Forklar' : state.filter;
        pills.push({ label: `Filtre: ${lbl}`, clear: () => { state.filter = 'all'; renderList(); } });
      }
      if (state.q && state.q.trim()) {
        pills.push({ label: `Arama: "${state.q.trim()}"`, clear: () => { state.q = ''; const qEl = $('#q'); if (qEl) qEl.value = ''; renderList(); } });
      }
      if (!pills.length) {
        afBar.hidden = true;
        afBar.replaceChildren();
      } else {
        afBar.replaceChildren();
        afBar.append(h('span', 'af-count', `${state.items.length} projeden ${filtered.length} eşleşme`));
        const listWrap = h('div', 'af-pills');
        for (const p of pills) {
          const b = h('button', 'af-pill');
          b.type = 'button';
          b.append(h('span', '', p.label), h('i', 'af-x', '×'));
          b.onclick = p.clear;
          listWrap.append(b);
        }
        afBar.append(listWrap);
        afBar.hidden = false;
      }
    }

    $('#empty').hidden = filtered.length > 0;
    if (!filtered.length) return;

    const fr = document.createDocumentFragment();
    let idx = 0;
    for (const it of filtered) {
      const li = h('li', 'tile glass sq project-card' + (it.favorite ? ' is-fav' : '') + (it.isFork ? ' is-fork' : ''));
      li.style.setProperty('--stagger', `${Math.min(idx++, 15) * 30}ms`);
      const targetUrl = it.url || `https://github.com/tempestian/${it.name || ''}`;

      li.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.project-terminal-bar')) return;
        window.open(targetUrl, '_blank', 'noopener');
      });

      const cardInner = h('div', 'project-card-inner');

      // Top row: Badges + Tech Meta (Language, Branch)
      const headRow = h('div', 'project-header-row');
      const badgeGrp = h('div', 'project-badge-group');
      if (it.favorite) {
        badgeGrp.append(h('span', 'tag tag-active', '★ Öne Çıkan'));
      }
      if (it.isFork) {
        badgeGrp.append(h('span', 'tag tag-fork', 'Fork'));
      }
      for (const c of getCategories(it).slice(0, 3)) {
        badgeGrp.append(h('span', 'tag', c));
      }
      headRow.append(badgeGrp);

      const techMeta = h('div', 'project-tech-meta');
      if (it.language) {
        const langPill = h('span', 'project-lang-pill');
        if (it.languageColor) {
          const dot = h('span', 'lang-dot');
          dot.style.backgroundColor = it.languageColor;
          langPill.append(dot);
        }
        langPill.append(h('span', '', it.language));
        techMeta.append(langPill);
      }
      if (it.branch) {
        techMeta.append(h('span', 'project-branch-pill', it.branch));
      }
      headRow.append(techMeta);
      cardInner.append(headRow);

      // Title & upstream info
      const titleBlock = h('div', 'project-title-block');
      const h2 = h('h2', 'project-name');
      const titleLink = h('a', '', it.fullName || it.title || it.name || 'İsimsiz Proje');
      titleLink.href = targetUrl;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener';
      h2.append(titleLink);
      titleBlock.append(h2);

      if (it.isFork && it.upstreamName) {
        const upEl = h('div', 'project-upstream-line');
        const upUrl = it.upstreamUrl || `https://github.com/${it.upstreamName}`;
        upEl.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg><span>Kaynak: <a href="${upUrl}" target="_blank" rel="noopener">${it.upstreamName}</a></span>`;
        titleBlock.append(upEl);
      }
      cardInner.append(titleBlock);

      // Description
      if (it.description || it.summary) {
        cardInner.append(h('p', 'box-txt project-desc', it.description || it.summary));
      }

      // Tech Pills (tags / highlights summary)
      const pills = (Array.isArray(it.tags) && it.tags.length) ? it.tags : getCategories(it);
      if (pills.length) {
        const pillsRow = h('div', 'project-pills-row');
        for (const tag of pills.slice(0, 6)) {
          pillsRow.append(h('span', 'pill-chip', tag));
        }
        cardInner.append(pillsRow);
      }

      // Terminal Quick Command
      if (it.installCommand) {
        const termBar = h('div', 'project-terminal-bar');
        const promptSpan = h('span', 'term-prompt', '$');
        const codeSpan = h('span', 'term-code', it.installCommand);
        const copyBtn = h('button', 'term-copy-btn');
        copyBtn.type = 'button';
        copyBtn.title = 'Komutu panoya kopyala';
        copyBtn.setAttribute('aria-label', 'Komutu panoya kopyala');
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

        const doCopy = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (navigator.clipboard) {
            navigator.clipboard.writeText(it.installCommand);
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#41cd52" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            setTimeout(() => {
              copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
            }, 1800);
            if (window.UI && window.UI.showToast) {
              window.UI.showToast('Komut panoya kopyalandı! 📋');
            }
          }
        };

        termBar.onclick = doCopy;
        copyBtn.onclick = doCopy;
        termBar.append(promptSpan, codeSpan, copyBtn);
        cardInner.append(termBar);
      }

      // Footer Row: Added date + GitHub Repo button
      const footerRow = h('div', 'project-footer-row');
      const fmtDate = (it.addedAt && window.formatHybridDate ? window.formatHybridDate(it.addedAt) : it.addedAt) || '';
      footerRow.append(h('span', 'project-date', fmtDate));

      const ghBtn = h('a', 'btn-github-out');
      ghBtn.href = targetUrl;
      ghBtn.target = '_blank';
      ghBtn.rel = 'noopener';
      const extLabel = pageTexts.externalButtonText || 'GitHub Deposu';
      ghBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg><span>${extLabel}</span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
      footerRow.append(ghBtn);

      cardInner.append(footerRow);
      li.append(cardInner);
      fr.append(li);
    }
    ul.replaceChildren(fr);
  }

  // Random Pick Button
  const rndBtn = $('#randomPickBtn');
  if (rndBtn) {
    rndBtn.onclick = () => {
      rndBtn.classList.remove('spin');
      void rndBtn.offsetWidth;
      rndBtn.classList.add('spin');
      setTimeout(() => rndBtn.classList.remove('spin'), 650);

      const items = state.items;
      if (!items.length) return;
      const pick = items[Math.floor(Math.random() * items.length)];
      if (pick) {
        state.filter = 'all';
        state.q = pick.title || pick.name || '';
        const qEl = $('#q');
        if (qEl) qEl.value = state.q;
        renderList();
        const listEl = $('#projectList');
        if (listEl) listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (window.UI && window.UI.showToast) {
          window.UI.showToast(`🎲 Rastgele seçildi: ${pick.title || pick.name}`);
        }
      }
    };
  }

  // Search and Sort controls
  const qEl = $('#q');
  if (qEl) {
    qEl.oninput = () => {
      state.q = qEl.value;
      renderList();
    };
  }

  const sortEl = $('#sort');
  if (sortEl) {
    sortEl.onchange = () => {
      state.sort = sortEl.value;
      renderList();
    };
  }

  // Data Loading
  async function init() {
    const dataSrc = document.body.dataset.data || '../data/projects.json';
    try {
      const res = await fetch(dataSrc, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      state.items = Array.isArray(json.items) ? json.items : (Array.isArray(json) ? json : []);
      renderStats(state.items);
      renderChips(state.items);
      renderList();
    } catch (e) {
      console.warn('Projects data load failed, checking fallback:', e);
      state.items = [];
      renderList();
    }
  }

  init();
})();
