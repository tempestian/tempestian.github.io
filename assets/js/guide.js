// ============================================================================
// [AI-MIMARI-NOTU: ADIM 15 & 21 — TECHNOPAT SOSYAL YÖNLENDİRMELİ REHBER KATALOĞU MOTORU]
// Bu dosya `/rehber/` sayfasını (`data/guides.json`) oluşturur.
// - Rehber içerikleri sitede uzun makaleler olarak tutulmaz; her rehber kartı bir
//   Katalog Kartı (`.tile.glass.sq.guide-card`) olarak sunulur ve tıklandığında
//   doğrudan kullanıcının Technopat Sosyal üzerindeki ilgili rehber konusuna (`url`)
//   yeni sekmede (`target="_blank" rel="noopener"`) yönlendirir.
// - Kategori çipleri (`customGenres` / `genres`), arama kutusu (`#q`), sıralama (`#sort`)
//   ve "★ Öne Çıkanlar" (`favorite: true`) filtrelemesi içerir.
// - Adım 21: Rastgele rehber seç (🎲) butonunda mikro-dönme animasyonu tetiklenir.
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
    searchPlaceholder: 'Rehber başlığı, konu veya kategori ara...',
    emptyText: 'Henüz rehber eklenmemiş veya aramayla eşleşen rehber yok.',
    detailsText: 'Ayrıntılar',
    externalButtonText: 'Technopat Sosyal',
    footerText: 'Rehber kartlarına tıkladığınızda Technopat Sosyal üzerindeki ilgili konuya yönlendirilirsiniz.'
  };

  function applyGuidePageConfig(cfg) {
    const pg = cfg && cfg.pages && cfg.pages.guide;
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
    document.querySelectorAll('.guide-out-badge > span').forEach(sp => {
      if (pg.externalButtonText) sp.textContent = pg.externalButtonText;
    });
  }
  if (window.SITE_CONFIG) applyGuidePageConfig(window.SITE_CONFIG);
  document.addEventListener('siteconfig', e => applyGuidePageConfig(e.detail));

  function getCategories(it) {
    if (!it) return [];
    const arr = Array.isArray(it.customGenres) && it.customGenres.length ? it.customGenres : (it.genres || []);
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
    for (const it of items) {
      if (it.favorite) favCount++;
      for (const c of getCategories(it)) {
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
    }
    const sortedCats = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a] || a.localeCompare(b, 'tr'));

    const row = h('div', 'stats-row');
    row.style.gridTemplateColumns = 'repeat(3, 1fr)';
    for (const [v, l] of [
      [items.length, 'rehber'],
      [sortedCats.length, 'kategori'],
      [favCount, '★ öne çıkan']
    ]) {
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
      more.insertAdjacentHTML('beforeend', UI.icon('down'));

      const ins = h('div', 'ins');
      const inn = h('div', 'ins-in');
      ins.append(inn);

      const blk = h('div', 'blk');
      blk.append(h('h4', null, 'Rehber kategori dağılımı'));

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
        btn.querySelector('.gb-val').textContent = `${cnt} rehber (%${pct})`;
        btn.onclick = () => {
          state.filter = state.filter === c ? 'all' : c;
          renderList();
          const listEl = $('#guideList');
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
      box.append(row, ins, more);
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
    const ul = $('#guideList');
    if (!ul) return;
    ul.replaceChildren();

    document.querySelectorAll('#chips [data-filter]').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.filter === state.filter);
    });

    const q = state.q.trim().toLocaleLowerCase('tr');
    const filtered = state.items.filter(it => {
      const cats = getCategories(it);
      if (state.filter === '__fav__' && !it.favorite) return false;
      if (state.filter !== 'all' && state.filter !== '__fav__' && !cats.includes(state.filter)) return false;
      if (q) {
        const hay = `${it.title || ''} ${it.summary || ''} ${cats.join(' ')}`.toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (state.sort === 'title') return (a.title || '').localeCompare(b.title || '', 'tr');
      if (state.sort === 'fav') return (Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))) || (b.addedAt || '').localeCompare(a.addedAt || '');
      return (b.addedAt || '').localeCompare(a.addedAt || '') || (a.title || '').localeCompare(b.title || '', 'tr');
    });

    $('#empty').hidden = filtered.length > 0;
    if (!filtered.length) return;

    const fr = document.createDocumentFragment();
    for (const it of filtered) {
      const li = h('li', 'tile glass sq guide-card span-full');
      const targetUrl = it.url || it.firstSeasonUrl || 'https://www.technopat.net/sosyal/';
      const a = h('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener';

      const top = h('div', 'tile-top');
      const headLeft = h('div', 'box-head-left');
      if (it.image) {
        const img = h('img', 'box-thumb');
        img.src = UI.resolveAsset(it.image);
        img.alt = '';
        img.width = 44;
        img.height = 44;
        headLeft.append(img);
      } else {
        const ic = h('span', 'box-ic');
        ic.innerHTML = UI.icon('guide');
        headLeft.append(ic);
      }
      const titleBox = h('div');
      const h2 = h('h2', '', it.title || 'İsimsiz Rehber');
      h2.style.fontSize = '1.22rem';
      titleBox.append(h2);
      if (it.addedAt) {
        const dt = h('p', 'meta', it.addedAt + (it.favorite ? ' · ★ Öne Çıkan Rehber' : ''));
        titleBox.append(dt);
      }
      headLeft.append(titleBox);
      top.append(headLeft);

      const rightBadge = h('span', 'tag guide-out-badge');
      rightBadge.innerHTML = `<span>${ UI.esc ? UI.esc(pageTexts.externalButtonText || 'Technopat Sosyal') : (pageTexts.externalButtonText || 'Technopat Sosyal') }</span> ${UI.icon('out')}`;
      top.append(rightBadge);
      a.append(top);

      if (it.summary) {
        a.append(h('p', 'box-txt', it.summary));
      }

      const cats = getCategories(it);
      if (cats.length) {
        const catRow = h('div', 'guide-cat-row');
        for (const c of cats) {
          catRow.append(h('span', 'tag', c));
        }
        a.append(catRow);
      }

      li.append(a);
      fr.append(li);
    }
    ul.append(fr);
  }

  (async () => {
    try {
      let remoteDoc = null;
      try {
        const r = await fetch('../data/guides.json', { cache: 'no-store' });
        if (r.ok) remoteDoc = await r.json();
      } catch (e) {}

      let previewDoc = null;
      try {
        const prevAll = JSON.parse(ls('tp_multimedia_preview') || '{}');
        if (prevAll && prevAll.guide) previewDoc = prevAll.guide;
      } catch (e) {}

      const remoteItems = (remoteDoc && (remoteDoc.items || remoteDoc.guides)) || [];
      const previewItems = (previewDoc && (previewDoc.items || previewDoc.guides)) || [];

      const items = (previewItems.length > 0 && previewItems.length >= remoteItems.length)
        ? previewItems
        : remoteItems;

      state.items = items;
      renderStats(items);
      renderChips(items);
      renderList();
    } catch (err) {
      const e = $('#empty');
      e.hidden = false;
    }
  })();

  $('#q').oninput = e => { state.q = e.target.value; renderList(); };
  $('#sort').onchange = e => { state.sort = e.target.value; renderList(); };

  const rndBtn = document.getElementById('randomPickBtn');
  if (rndBtn) {
    rndBtn.onclick = () => {
      // [AI-MIMARI-NOTU: ADIM 21]: Butona mikro-dönme animasyonu ekler
      rndBtn.classList.remove('is-rolling');
      void rndBtn.offsetWidth;
      rndBtn.classList.add('is-rolling');
      const cards = [...document.querySelectorAll('#guideList .guide-card')];
      if (!cards.length) return;
      cards.forEach(c => c.classList.remove('random-highlight'));
      const pick = cards[Math.floor(Math.random() * cards.length)];
      pick.classList.add('random-highlight');
      pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }
})();
