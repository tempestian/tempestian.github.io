// ============================================================================
// [AI-MIMARI-NOTU: ADIM 15 — TECHNOPAT SOSYAL YÖNLENDİRMELİ REHBER KATALOĞU MOTORU]
// Bu dosya `/rehber/` sayfasını (`data/guides.json`) oluşturur.
// - Rehber içerikleri sitede uzun makaleler olarak tutulmaz; her rehber kartı bir
//   Katalog Kartı (`.tile.glass.sq.guide-card`) olarak sunulur ve tıklandığında
//   doğrudan kullanıcının Technopat Sosyal üzerindeki ilgili rehber konusuna (`url`)
//   yeni sekmede (`target="_blank" rel="noopener"`) yönlendirir.
// - Kategori çipleri (`customGenres` / `genres`), arama kutusu (`#q`), sıralama (`#sort`)
//   ve "★ Öne Çıkanlar" (`favorite: true`) filtrelemesi içerir.
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
    const catSet = new Set();
    let favCount = 0;
    for (const it of items) {
      if (it.favorite) favCount++;
      for (const c of getCategories(it)) catSet.add(c);
    }

    const row = h('div', 'stats-row');
    row.style.gridTemplateColumns = 'repeat(3, 1fr)';
    for (const [v, l] of [
      [items.length, 'rehber'],
      [catSet.size, 'kategori'],
      [favCount, '★ öne çıkan']
    ]) {
      const e = h('div', 'stat');
      e.innerHTML = '<b></b><span></span>';
      e.firstChild.textContent = v;
      e.lastChild.textContent = l;
      row.append(e);
    }
    box.append(row);
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
      rightBadge.innerHTML = `<span>Technopat Sosyal</span> ${UI.icon('out')}`;
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
})();
