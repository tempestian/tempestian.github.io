// İstatistik ve "öne çıkanlar" mantığı tek yerde. Sabit anime adı YOK; kurallar veriden çalışır.
// Senkron betiği bunu her çalıştığında kullanır. AniList'e bağlanmadan yeniden hesaplamak için:
//   node scripts/stats.mjs            (data/anime.json içindeki stats alanını günceller)
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const eps = a => a.parts.reduce((n, p) => n + (p.watched || 0), 0);       // izlenen bölüm (yeniden izlemeler hariç)
const reps = a => Math.max(0, ...a.parts.map(p => p.repeat || 0));        // en çok tekrar izlenen parçanın tekrar sayısı (toplanmaz)
const rank = (list, key) => [...list].sort((a, b) => key(b) - key(a) || eps(b) - eps(a) || a.title.localeCompare(b.title, 'tr'))[0];

export function computeStats(anime) {
  const stats = { anime: 0, season: 0, film: 0, other: 0, episodes: 0, avgScore: null, byStatus: {} };
  const counted = [];
  for (const a of anime) {
    stats.byStatus[a.status] = (stats.byStatus[a.status] || 0) + 1;
    const done = a.parts.filter(p => p.status === 'COMPLETED' && p.watched > 0);
    if (!done.length) continue;                       // anime sayılması için en az bir parçası tamamlanmış olmalı
    stats.anime++; counted.push(a);
    for (const p of done) { stats[p.kind === 'season' ? 'season' : p.kind === 'movie' ? 'film' : 'other']++; stats.episodes += p.watched; }
  }
  // Durum çubuğu listedeki tüm franchise'ları gösterir; üstteki "anime" sayısı ise yalnızca en az bir parçası bitmiş olanları sayar.
  // Fark şeffaf olsun diye döküm yazılır: sayılan = tamamlanan franchise + (devam eden/beklemede/bırakılan ama en az bir parçası bitmiş) franchise.
  stats.listed = anime.length;
  stats.completed = counted.filter(a => a.status === 'completed').length;
  stats.partial = counted.length - stats.completed;
  stats.excluded = anime.length - counted.length;
  const rated = counted.filter(a => a.score);
  if (rated.length) stats.avgScore = Math.round(rated.reduce((n, a) => n + a.score, 0) / rated.length * 10) / 10;

  const hl = {};
  // En yüksek puan: sayılan animeler arasında en yüksek puan; eşitlikte daha çok bölüm izlenen öne geçer.
  if (rated.length) {
    const t = rank(rated, a => a.score);
    hl.topScore = { id: t.id, title: t.title, score: t.score, ties: rated.filter(a => a.score === t.score).length - 1 };
  }
  // En çok izlenen: durumu ne olursa olsun (devam eden dahil) en çok bölümü izlenen.
  const w = rank(anime.filter(a => eps(a) > 0), eps);
  if (w) hl.mostWatched = { id: w.id, title: w.title, episodes: eps(w), status: w.status };
  // En çok tekrar: bir parçanın tekrar sayıları toplanmaz; en çok tekrar izlenen parçanın sayısı alınır (kez = tekrar + 1).
  const r = anime.filter(a => reps(a) > 0);
  if (r.length) { const t = rank(r, reps); hl.mostRewatched = { id: t.id, title: t.title, times: reps(t) + 1 }; }
  if (Object.keys(hl).length) stats.highlights = hl;
  return stats;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const f = process.env.OUT || 'data/anime.json', d = JSON.parse(fs.readFileSync(f, 'utf8'));
  d.stats = computeStats(d.anime);
  fs.writeFileSync(f, JSON.stringify({ ...d, stats: d.stats }, null, 2) + '\n');
  console.log('stats güncellendi:', JSON.stringify(d.stats.highlights));
}
