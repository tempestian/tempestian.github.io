(() => {
  const root = document.documentElement;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const SEEDS = [
    { id: 'tensura', name: 'Tensura Azure (Varsayılan)', hex: '#00A3E0', surfaceLight: '#f0f9ff', surfaceDark: '#070b12' },
    { id: 'blue',   name: 'Mavi',                       hex: '#185EAC', surfaceLight: '#f9f9fe', surfaceDark: '#0c0e12' },
    { id: 'ocean',  name: 'Okyanus',                    hex: '#00639B', surfaceLight: '#f8f9fe', surfaceDark: '#0c0e12' },
    { id: 'purple', name: 'Mor',                        hex: '#6750A4', surfaceLight: '#fdf7fe', surfaceDark: '#0f0d12' },
    { id: 'green',  name: 'Orman Yeşili',               hex: '#386A20', surfaceLight: '#f9faf1', surfaceDark: '#0c0f0a' },
    { id: 'amber',  name: 'Kehribar',                   hex: '#7D5700', surfaceLight: '#fff8f3', surfaceDark: '#110e08' },
    { id: 'coral',  name: 'Mercan',                     hex: '#9C4146', surfaceLight: '#fff8f7', surfaceDark: '#130c0c' }
  ];
  window.MD3_SEEDS = SEEDS;

  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  };
  const savedSeed = () => {
    try {
      const s = localStorage.getItem('md3e_seed');
      if (s === 'purple') return 'tensura'; // upgrade legacy purple to tensura azure
      return SEEDS.some(x => x.id === s) ? s : 'tensura';
    } catch (e) {
      return 'tensura';
    }
  };

  const apply = (mode, seedId) => {
    const m = mode || root.dataset.theme || (mq.matches ? 'dark' : 'light');
    const s = seedId || root.dataset.seed || savedSeed();
    root.dataset.theme = m;
    root.dataset.seed = s;
    const seedMeta = SEEDS.find(x => x.id === s) || SEEDS[0];
    const c = document.querySelector('meta[name=theme-color]');
    if (c) c.content = m === 'dark' ? seedMeta.surfaceDark : seedMeta.surfaceLight;
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: m, seed: s } }));
  };

  apply(savedTheme() || (mq.matches ? 'dark' : 'light'), savedSeed());

  mq.addEventListener('change', e => {
    if (!savedTheme()) apply(e.matches ? 'dark' : 'light', root.dataset.seed);
  });

  window.toggleTheme = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (e) {}
    apply(next, root.dataset.seed);
  };

  window.setMaterialSeed = seedId => {
    if (!SEEDS.some(x => x.id === seedId)) return;
    try { localStorage.setItem('md3e_seed', seedId); } catch (e) {}
    apply(root.dataset.theme, seedId);
  };
})();
