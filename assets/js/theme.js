(() => {
  const root = document.documentElement;
  const mq = matchMedia('(prefers-color-scheme: dark)');

  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  };

  const urlTheme = () => {
    try {
      const p = new URLSearchParams(location.search).get('theme');
      return (p === 'light' || p === 'dark') ? p : null;
    } catch (e) { return null; }
  };

  const apply = (mode) => {
    const m = mode || urlTheme() || root.dataset.theme || savedTheme() || 'dark';
    root.dataset.theme = m;
    const c = document.querySelector('meta[name=theme-color]');
    if (c) c.content = m === 'dark' ? '#090e1a' : '#f0f6ff';
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: m } }));
  };

  apply(urlTheme() || savedTheme() || 'dark');

  mq.addEventListener('change', e => {
    if (!savedTheme()) apply(e.matches ? 'dark' : 'light');
  });

  window.toggleTheme = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (e) {}
    apply(next);
  };
})();
