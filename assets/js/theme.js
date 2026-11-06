(() => {
  const root = document.documentElement;
  const mq = matchMedia('(prefers-color-scheme: dark)');

  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  };

  const apply = (mode) => {
    const m = mode || root.dataset.theme || savedTheme() || 'dark';
    root.dataset.theme = m;
    const c = document.querySelector('meta[name=theme-color]');
    if (c) c.content = m === 'dark' ? '#080c14' : '#f8fafc';
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: m } }));
  };

  apply(savedTheme() || 'dark');

  mq.addEventListener('change', e => {
    if (!savedTheme()) apply(e.matches ? 'dark' : 'light');
  });

  window.toggleTheme = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (e) {}
    apply(next);
  };
})();
