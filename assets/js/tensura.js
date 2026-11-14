(() => {
  'use strict';

  const STORAGE_WATCHED_KEY = 'tp_tensura_watched';
  const PREVIEW_KEY = 'tp_tensura_preview';
  const DATA_URL = '../data/tensura-watch-order.json';

  const SUN_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  const MOON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  let currentData = null;
  let activeFilter = 'all';
  let watchedSet = loadWatchedSet();

  function loadWatchedSet() {
    try {
      const raw = localStorage.getItem(STORAGE_WATCHED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveWatchedSet() {
    try {
      localStorage.setItem(STORAGE_WATCHED_KEY, JSON.stringify([...watchedSet]));
    } catch (e) {}
  }

  function sanitizeHttpUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  function syncThemeButton() {
    const btn = document.getElementById('tensuraThemeBtn');
    if (!btn) return;
    const isDark = document.documentElement.dataset.theme === 'dark';
    btn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    btn.setAttribute('aria-label', isDark ? 'Açık temaya geç' : 'Koyu temaya geç');
  }

  function kindClass(kind) {
    const k = String(kind || '').toLowerCase();
    if (k.includes('ana')) return 'kind-main';
    if (k.includes('film') || k.includes('movie')) return 'kind-movie';
    if (k.includes('ova') || k.includes('oad') || k.includes('özel') || k.includes('yan')) return 'kind-ova';
    return '';
  }

  function updateProgress(items) {
    const total = items.length;
    const done = items.filter(it => watchedSet.has(String(it.id))).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const textEl = document.getElementById('tensuraProgressText');
    const fillEl = document.getElementById('tensuraProgressFill');
    if (textEl) textEl.textContent = `${done} / ${total} izlendi`;
    if (fillEl) fillEl.style.width = `${pct}%`;
  }

  function renderPage(data) {
    currentData = data || {};
    const title = currentData.title || 'Tensura İzleme Sırası';
    const subtitle = currentData.subtitle || '';
    const introNote = currentData.introNote || '';
    const footerText = currentData.footerText || '';
    const items = Array.isArray(currentData.items) ? currentData.items : [];

    document.title = title;
    const barTitle = document.getElementById('tensuraBarTitle');
    const pageTitle = document.getElementById('tensuraPageTitle');
    const pageSub = document.getElementById('tensuraPageSubtitle');
    const noteBox = document.getElementById('tensuraIntroNote');
    const noteText = document.getElementById('tensuraIntroNoteText');
    const footerEl = document.getElementById('tensuraFooter');

    if (barTitle) barTitle.textContent = title;
    if (pageTitle) pageTitle.textContent = title;
    if (pageSub) {
      pageSub.textContent = subtitle;
      pageSub.hidden = !subtitle;
    }
    if (noteBox && noteText) {
      noteText.textContent = introNote;
      noteBox.hidden = !introNote;
    }
    if (footerEl) {
      footerEl.textContent = footerText;
      footerEl.hidden = !footerText;
    }

    updateProgress(items);
    renderTimeline(items);
  }

  function renderTimeline(allItems) {
    const container = document.getElementById('tensuraTimeline');
    if (!container) return;
    container.replaceChildren();

    const filtered = allItems.filter(it => {
      if (activeFilter === 'required') return !it.optional;
      if (activeFilter === 'optional') return Boolean(it.optional);
      return true;
    });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tensura-empty glass sq';
      empty.textContent = allItems.length === 0
        ? 'Henüz izleme sırası öğesi eklenmemiş.'
        : 'Bu filtreye uygun içerik bulunmuyor.';
      container.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const originalIndex = allItems.indexOf(item);
      const stepNum = String(originalIndex + 1).padStart(2, '0');
      const isWatched = watchedSet.has(String(item.id));

      const card = document.createElement('article');
      card.className = 'tensura-card glass sq' + (isWatched ? ' is-watched' : '');

      // Step column
      const stepCol = document.createElement('div');
      stepCol.className = 'tensura-step-col';
      const numEl = document.createElement('div');
      numEl.className = 'tensura-step-num';
      numEl.textContent = stepNum;
      stepCol.appendChild(numEl);

      // Content column
      const contentCol = document.createElement('div');

      const topRow = document.createElement('div');
      topRow.className = 'tensura-card-top';

      const headerLeft = document.createElement('div');

      const badges = document.createElement('div');
      badges.className = 'tensura-badges';

      if (item.kind) {
        const kindBadge = document.createElement('span');
        kindBadge.className = 'tensura-pill ' + kindClass(item.kind);
        kindBadge.textContent = item.kind;
        badges.appendChild(kindBadge);
      }

      const reqBadge = document.createElement('span');
      reqBadge.className = 'tensura-pill ' + (item.optional ? 'opt' : 'req');
      reqBadge.textContent = item.optional ? 'İsteğe Bağlı' : 'Zorunlu';
      badges.appendChild(reqBadge);

      headerLeft.appendChild(badges);

      const h2 = document.createElement('h2');
      h2.className = 'tensura-title';
      h2.textContent = item.title || 'İsimsiz İçerik';
      headerLeft.appendChild(h2);

      if (item.episodes) {
        const ep = document.createElement('div');
        ep.className = 'tensura-episodes';
        ep.textContent = item.episodes;
        headerLeft.appendChild(ep);
      }

      topRow.appendChild(headerLeft);

      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'tensura-check-btn' + (isWatched ? ' checked' : '');
      checkBtn.textContent = isWatched ? '✓ İzlendi' : '○ İzlendi Olarak İşaretle';
      checkBtn.addEventListener('click', () => {
        const key = String(item.id);
        if (watchedSet.has(key)) watchedSet.delete(key);
        else watchedSet.add(key);
        saveWatchedSet();
        updateProgress(allItems);
        renderTimeline(allItems);
      });
      topRow.appendChild(checkBtn);

      contentCol.appendChild(topRow);

      if (item.note) {
        const noteP = document.createElement('p');
        noteP.className = 'tensura-note';
        noteP.textContent = item.note;
        contentCol.appendChild(noteP);
      }

      const actions = document.createElement('div');
      actions.className = 'tensura-actions';

      const validLinks = (Array.isArray(item.links) ? item.links : [])
        .map(l => ({
          label: (l && typeof l.label === 'string' && l.label.trim()) ? l.label.trim() : 'İzle',
          url: sanitizeHttpUrl(l && l.url)
        }))
        .filter(l => l.url);

      if (validLinks.length > 0) {
        validLinks.forEach(lnk => {
          const a = document.createElement('a');
          a.className = 'tensura-watch-btn';
          a.href = lnk.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = '▶ ' + lnk.label;
          actions.appendChild(a);
        });
      } else {
        const noLnk = document.createElement('span');
        noLnk.className = 'tensura-no-link';
        noLnk.textContent = 'Henüz izleme linki eklenmemiş';
        actions.appendChild(noLnk);
      }

      contentCol.appendChild(actions);

      card.appendChild(stepCol);
      card.appendChild(contentCol);
      container.appendChild(card);
    });
  }

  async function init() {
    syncThemeButton();
    document.addEventListener('themechange', syncThemeButton);
    const themeBtn = document.getElementById('tensuraThemeBtn');
    if (themeBtn && typeof window.toggleTheme === 'function') {
      themeBtn.addEventListener('click', () => window.toggleTheme());
    }

    document.querySelectorAll('.tensura-filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter || 'all';
        document.querySelectorAll('.tensura-filter-btn[data-filter]').forEach(b => {
          const isAct = b === btn;
          b.classList.toggle('active', isAct);
          b.setAttribute('aria-selected', isAct ? 'true' : 'false');
        });
        if (currentData) {
          renderTimeline(Array.isArray(currentData.items) ? currentData.items : []);
        }
      });
    });

    const previewBanner = document.getElementById('tensuraPreviewBanner');
    const clearPreviewBtn = document.getElementById('tensuraClearPreviewBtn');
    if (clearPreviewBtn) {
      clearPreviewBtn.addEventListener('click', () => {
        try { localStorage.removeItem(PREVIEW_KEY); } catch (e) {}
        location.reload();
      });
    }

    try {
      const previewRaw = localStorage.getItem(PREVIEW_KEY);
      if (previewRaw) {
        const parsed = JSON.parse(previewRaw);
        if (parsed && typeof parsed === 'object') {
          if (previewBanner) previewBanner.hidden = false;
          renderPage(parsed);
          return;
        }
      }
    } catch (e) {}

    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderPage(data);
    } catch (err) {
      const container = document.getElementById('tensuraTimeline');
      if (container) {
        const errBox = document.createElement('div');
        errBox.className = 'tensura-empty glass sq';
        errBox.textContent = 'İzleme sırası verisi yüklenemedi: ' + err.message;
        container.replaceChildren(errBox);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
