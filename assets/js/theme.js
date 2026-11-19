(() => {
  const THEMES = {
    'rimuru-dark': { mode: 'dark', color: '#14131d', label: '💧 Rimuru Midnight' },
    'jura-violet': { mode: 'dark', color: '#1a1426', label: '🔮 Jura Violet' },
    'tempest-teal': { mode: 'dark', color: '#0d1b1e', label: '🌊 Tempest Teal' },
    'shuna-sakura': { mode: 'light', color: '#fdf2f6', label: '🌸 Shuna Sakura' },
    'veldora-cream': { mode: 'light', color: '#faf3e8', label: '☀️ Veldora Amber' }
  };
  const ORDER = Object.keys(THEMES);
  const d = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('tp_theme_preset') || localStorage.getItem('theme'); } catch (e) {}
  if (saved === 'dark') saved = 'rimuru-dark';
  if (saved === 'light') saved = 'shuna-sakura';
  if (!saved || !THEMES[saved]) saved = 'rimuru-dark';

  const set = p => {
    const preset = THEMES[p] ? p : 'rimuru-dark';
    const meta = THEMES[preset];
    d.dataset.theme = meta.mode;
    d.dataset.preset = preset;
    d.style.colorScheme = meta.mode;
    const c = document.querySelector('meta[name="theme-color"]');
    if (c) c.content = meta.color;
  };

  set(saved);

  window.THEMES_LIST = ORDER.map(id => ({ id, ...THEMES[id] }));
  window.setThemePreset = p => {
    if (!THEMES[p]) return;
    set(p);
    try {
      localStorage.setItem('tp_theme_preset', p);
      localStorage.setItem('theme', THEMES[p].mode);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('themechange', { detail: { preset: p, ...THEMES[p] } }));
  };

  window.toggleTheme = () => {
    const cur = d.dataset.preset || 'rimuru-dark';
    const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
    window.setThemePreset(next);
  };
})();
