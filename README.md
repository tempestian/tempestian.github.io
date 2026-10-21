# tempestian.github.io

Statik site, derleme gerektirmez. Tüm veri AniList'ten gelir. Depo adı `tempestian.github.io` olmalı; dosyalar kök dizine yüklenir (`.nojekyll` dahil).

## Performans notları
- `backdrop-filter` yalnızca alt menü, üst çubuk ve detay penceresinde; kartlar/listeler düz yarı saydam (arka plan zaten bulanık).
- Arka plan yalnızca CSS (üç yumuşak gradyan + koyu temada hafif gren); bölüme özgü görsel kullanılmaz, yeni bölümler eklenince değişmez.
- Üst çubuk durumu scroll'da sınıf (`.bar.on`) ile değişir; başlık küçülmesi `animation-timeline:scroll()` ile.
- Anime listesinde DOM bir kez kurulur; filtre `hidden`, sıralama yeniden dizme ile yapılır.
- Sayfa geçişleri hafif tutuldu (`@view-transition`, yalnızca kök solma + alt menü hapı); `speculationrules` ile hedef sayfa önceden yüklenir.

## Yapı
- `index.html`: ana sayfa
- `anime/index.html`: liste sayfası (`/anime/`)
- `data/anime.json`: tüm içerik burada, tek kaynak
- `assets/img/`: logo ve simgeler (`logo.png` ana sayfadaki işaret, `favicon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`); kökte `favicon.ico`.
- `assets/css/style.css`, `assets/js/theme.js` (açık/koyu tema, sistemi izler, düğmeyle değişir), `assets/js/common.js` (üst çubuk, alt menü, ana sayfa), `assets/js/anime.js`.
- `data/sections.json`: menü, ana sayfa bölümleri ve bağlantılar. Yeni bölüm: bu dosyaya kayıt ekleyin, `<bölüm>/index.html` oluşturun (`anime/index.html` örnek, `data-root` ve `data-section` değerlerini değiştirin). Alt menü simgesi `id` ile eşleşir (`home`, `anime`); farklı simge için kayıta `icon` alanı ekleyin, `common.js` içindeki `P` listesine karşılığını yazın.

## anime.json şeması (`schemaVersion: 3`)
Dosya elle düzenlenmez, AniList senkronu tarafından üretilir. Her kayıt bir franchise'dır; sezonlar, filmler ve ek içerikler `parts` içinde tutulur.
| Alan | Tip | Not |
|---|---|---|
| `id` | string | `al-<AniList ID>` |
| `title` | string | İngilizce ad, yoksa romaji |
| `anilistId` | int | franchise'ın ilk sezonunun (yoksa ilk girişin) AniList ID'si |
| `url` | string | AniList sayfası |
| `status` | string | `completed`, `watching`, `paused`, `dropped`, `planned` (yalnızca sezonlardan hesaplanır) |
| `score` | number/null | 10 üzerinden, ondalıklı; puanlanmış tüm parçaların ortalaması |
| `next` | true | yalnızca "Devam edilecek" ise bulunur (aşağıya bakın) |
| `parts` | dizi | franchise'ın tüm içeriği, yayın sırasıyla: `{id, name, kind, format, episodes, watched, status, release, year}`; `kind`: `season`, `movie`, `other`. Listede olmayan (izlenmemiş) içeriklerin `status` değeri `NONE`, `watched` değeri 0'dır |
| `parts[].repeat` | int | yalnızca yeniden izleme sayısı 0'dan büyükse bulunur; istatistiğe katılmaz, listede "↻ N× tekrar" etiketi (franchise içindeki en çok tekrar izlenen parçanın tekrar sayısı; parçaların tekrarları toplanmaz), detay ekranında her sezon/film için "İzlendi · N kez" (N = repeat + 1) gösterilir |
| `genres` | dizi | yalnızca doluysa; franchise'ın izlenen parçalarındaki türler, sık olandan aza, en çok 6 (AniList İngilizce adlarıyla; arayüz Türkçeleştirir) |
| `image` | string/null | AniList kapak görseli |
| `addedAt` | `YYYY-MM-DD` | |

Bir animeye tıklayınca açılan detay ekranı `parts` listesini sırayla gösterir (İzlendi, İzleniyor, İzlenmedi, Planlandı, Yayınlanmadı...). Adres `anime/#al-<ID>` biçimindedir. Ana listede "Devam edilecek" etiketi ve süzgeci `next` alanından gelir.

İstatistikler (site tarafında hesaplanır): yalnızca tamamlanmış (`COMPLETED`) parçalar sayılır. anime = en az bir tamamlanmış parçası olan franchise (izleniyor/beklemede/bırakıldı durumundaki bir sezon, franchise'ın başka tamamlanmış parçası varsa onu etkilemez; hiç tamamlanmış parçası yoksa franchise sayılmaz, bitince sayılır); sezon/film = tamamlanmış `season`/`movie` parçaları; bölüm = tamamlanmış tüm parçaların bölümleri (film ve OVA dahil; yeniden izlemeler ana istatistiğe katılmaz); ortalama puan = sayılan franchise'ların puanlarının ortalaması. Liste sayfası yine tüm durumları gösterir.

## İstatistik ve öne çıkanlar (`scripts/stats.mjs`)
Mantık tek dosyada, belirli bir anime adı yazılmadan kurallarla çalışır; senkron her çalıştığında `anime.json` içindeki `stats` alanını yeniden üretir, site yalnızca bunu gösterir. AniList'e bağlanmadan yeniden hesaplamak için: `node scripts/stats.mjs`.
- **Sayılar:** anime = en az bir parçası tamamlanmış franchise (durumu ne olursa olsun; bu yüzden "anime" sayısı, durum çubuğundaki "İzlendi" sayısından büyük olabilir: sayılan = tamamlanan + yarım kalan ama en az bir parçası bitmiş; `stats.listed/completed/partial/excluded` dökümü verir); sezon/film/ek = tamamlanmış parçalar; bölüm = tamamlanmış parçaların bölümleri (yeniden izlemeler hariç).
- **En yüksek puan:** sayılan animeler içinde en yüksek puan; eşitlikte daha çok bölümü izlenen seçilir, kaç animenin aynı puanda olduğu da yazılır.
- **En çok izlenen:** durumu ne olursa olsun (devam eden dahil) en çok bölümü izlenen.
- **En çok tekrar:** parçaların tekrar sayıları toplanmaz; en çok tekrar izlenen parçanın sayısı alınır (kez = tekrar + 1). Eşitlikte daha çok bölüm.
Kuralı değiştirmek için yalnızca `stats.mjs` düzenlenir; sonraki senkronda herkes yeni kurala göre güncellenir.

## Elle senkron
- **GitHub'da:** depo → Actions → "AniList senkronu" → Run workflow. Komut satırından: `gh workflow run "AniList senkronu"`. (`scripts/sync-anilist.mjs`, `data/overrides.json` veya workflow dosyası push'lanınca da otomatik çalışır.)
- **Kendi bilgisayarında:** depo kökünde (Node 18+ yeterli, paket kurulumu yok): `node scripts/sync-anilist.mjs`. Ardından `git add data/anime.json && git commit -m "AniList verisi güncellendi" && git push`.
- İsteğe bağlı ortam değişkenleri: `ANILIST_USER=kullanici`, `INCLUDE_PLANNED=1` (planlananları da al), `OUT=/tmp/anime.json` (başka dosyaya yaz, denemek için).

## AniList senkronu
Sayılar (`stats` alanı dahil) AniList'in toplam veya özel liste sayılarından değil, betiğin kayıtlardan kendi hesapladığı değerlerdir. Durum da ilerlemeden doğrulanır: tüm bölümleri izlenmiş giriş `completed`, ilerlemesi 0 olan "izleniyor" girişi `planned` sayılır; `completed` ve `dropped` listede işaretlendiği gibi kalır.

`.github/workflows/sync-anilist.yml` her gün 03:17 UTC'de `scripts/sync-anilist.mjs` çalıştırır, `data/anime.json` değiştiyse commit atar ve GitHub Pages derlemesini tetikler. Betik, iş akışı veya `data/overrides.json` değişince de bir kez çalışır. Elle çalıştırmak için: depo, Actions sekmesi, "AniList senkronu", Run workflow.
- Kullanıcı: `TurkTempestian` (workflow dosyasındaki `ANILIST_USER`). Profil herkese açık olmalı.
- Kaynak: AniList listesindeki tüm girişler (özel liste gerekmez). `MUSIC` biçimi atlanır; `PLANNING` girişler varsayılan olarak alınmaz (`INCLUDE_PLANNED=1` ile alınır).
- Franchise: PREQUEL, SEQUEL, SIDE_STORY, PARENT ve SUMMARY ilişkileriyle bağlı girişler tek anime sayılır; listede olmayan ara girişler de AniList'ten sorgulanıp zincir kapanana kadar izlenir (en çok 10 tur, yalnızca bağlamak için; listeye eklenmez). Bu sorgu başarısız olursa senkron durmaz, eldeki bağlantılarla devam eder. Yanlış birleşen franchise'lar için `overrides.json` içindeki `exclude` kullanılabilir. TV/TV_SHORT/ONA `season`, MOVIE `movie`, OVA/SPECIAL `other` olur; hepsi `parts` içinde listelenir. Tek başına duran film/OVA da ayrı bir kayıt olur.
- Devam edilecek (`next`): durumu `completed` olan franchise'ta, izlenen ilk sezondan sonra yayınlanmış (FINISHED/RELEASING), PREQUEL/SEQUEL zincirinde olan (TV veya ONA) ve izlenmemiş bir sezon varsa. Yayınlanmamış sezonlar sayılmaz. `overrides.json` içindeki `noContinue` listesindekilerde hiç etiketlenmez: sayı = franchise'daki herhangi bir AniList ID'si, yazı = başlıkta geçen ifade (şu an `Mushoku Tensei`).
- Tekrar izleme (`REPEATING`) bir kez bitirilmiş sayılır.
- İsteğe bağlı: `CUSTOM_LIST` doluysa yalnızca o özel listeden en az bir girişi olan franchise'lar alınır (varsayılan kapalı).
- Hatalı sonuçlar için `data/overrides.json`: `exclude` (AniList ID listesi), `titles` (`{"ID": "Başlık"}`; ID, franchise'ın ilk izlenen sezonudur), `merge` (`{"ID": "hedef ID"}`; AniList'te bağlı görünmeyen bir girişi, hedef ID'nin franchise'ına katar) ve `noContinue` (yukarıya bakın).
- Puan, AniList'teki puanın 10 üzerinden (ondalıklı) halidir.
- Senkron bozulursa son `anime.json` yerinde kalır, site etkilenmez.
