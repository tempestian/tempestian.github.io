(() => {
  const root = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)');
  const saved = () => { try { return localStorage.getItem('theme'); } catch (e) { return null; } };
  const apply = m => {
    root.dataset.theme = m;
    const c = document.querySelector('meta[name=theme-color]');
    if (c) c.content = m === 'dark' ? '#000000' : '#eceef3';
    document.dispatchEvent(new Event('themechange'));
  };
  apply(saved() || (mq.matches ? 'dark' : 'light'));
  mq.addEventListener('change', e => { if (!saved()) apply(e.matches ? 'dark' : 'light'); });
  window.toggleTheme = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (e) {}
    apply(next);
  };
})();
