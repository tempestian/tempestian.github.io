# tempestian.github.io

Statik site, derleme gerektirmez. Depo adı `tempestian.github.io` olmalı; dosyalar kök dizine yüklenir (`.nojekyll` dahil).

## Yapı
- `index.html`: ana sayfa
- `anime/index.html`: liste sayfası (`/anime/`)
- `data/anime.json`: tüm içerik burada, tek kaynak
- `assets/img/icon.svg`: favicon.
- `assets/css/style.css`, `assets/js/theme.js` (açık/koyu tema, sistemi izler, düğmeyle değişir), `assets/js/common.js` (üst çubuk, alt menü, ana sayfa), `assets/js/anime.js`.
- `data/sections.json`: menü, ana sayfa bölümleri ve bağlantılar. Yeni bölüm: bu dosyaya kayıt ekleyin, `<bölüm>/index.html` oluşturun (`anime/index.html` örnek, `data-root` ve `data-section` değerlerini değiştirin). Alt menü simgesi `id` ile eşleşir (`home`, `anime`); farklı simge için kayıta `icon` alanı ekleyin, `common.js` içindeki `P` listesine karşılığını yazın.

## anime.json şeması (`schemaVersion: 1`)
| Alan | Tip | Not |
|---|---|---|
| `id` | string | benzersiz, küçük harf-tire |
| `title` | string | |
| `malId` | int | franchise'ın MAL'daki ilk sezon sayfası; görsel ve bağlantı için |
| `status` | string | `completed`, `watching`, `paused`, `dropped`, `planned` |
| `score` | int/null | 1-10 |
| `seasons` | dizi | her eleman `{name, episodes, watched}`; sezon sayısı = dizi uzunluğu |
| `image` | string/null | doluysa Jikan çağrılmaz |
| `addedAt` | `YYYY-MM-DD` | |

Bölüm ve sezon bilgisi MAL'dan çekilmez, yalnızca kapak görseli çekilir.

## AniList senkronu
`.github/workflows/sync-anilist.yml` her gün 03:17 UTC'de `scripts/sync-anilist.mjs` çalıştırır, `data/anime.json` değiştiyse commit atar. Elle çalıştırmak için: depo, Actions sekmesi, "AniList senkronu", Run workflow.
- Kullanıcı: `TurkTempestian` (workflow dosyasındaki `ANILIST_USER`). Profil herkese açık olmalı.
- Franchise: PREQUEL/SEQUEL ile bağlı girişler tek anime sayılır. TV/TV_SHORT/ONA sezon olarak sayılır, devam filmi, OVA ve özel bölümler sayılmaz, tek başına filmler sayılır.
- Özel liste `Total Anime Sayısı` doluysa hangi franchise'ların listeleneceğini o belirler (`CUSTOM_LIST` ile değişir).
- Hatalı sonuçlar için `data/overrides.json`: `exclude` (AniList ID listesi) ve `titles` (`{"ID": "Başlık"}`).
- Puan, AniList'teki puanın 10 üzerinden (ondalıklı) halidir; birden çok sezonda ortalaması alınır.
- Senkron bozulursa son `anime.json` yerinde kalır, site etkilenmez.
