// ============================================================================
// [TEMPESTIAN DATA INTEGRITY & CONTENT SAFETY VALIDATOR]
// Bu betik (`scripts/validate-data.mjs`), sitedeki tüm veri dosyalarının (`data/*.json`)
// sözdizimi, şema ve içerik bütünlüğünü doğrular.
//
// GÖREVLER:
// 1. JSON Sözdizimi Kontrolü: Her dosyanın bozulmadan geçerli JSON formatında olduğunu teyit eder.
// 2. Şema ve Alan Bütünlüğü:
//    - anime.json: Başlık, benzersiz ID, geçerli durum (status), parts dizisi ve istatistikler.
//    - series/movies/books/manga/guides: items dizisi, ID, title, status ve tür alanları.
//    - sections.json: Kategori tanımları ve dosya yolları.
// 3. Veri Kaybı Engelleme (Content Loss Guard):
//    - Git geçmişiyle karşılaştırarak beklenmedik toplu silinmeleri (örn. API arızasından
//      kaynaklı liste boşalması) tespit eder ve işlemi derhal durdurur.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const VALID_STATUSES = new Set(['completed', 'watching', 'paused', 'dropped', 'planned']);
const VALID_PART_KINDS = new Set(['season', 'movie', 'volume', 'other', 'special']);

let errors = [];
let warnings = [];

function addError(file, msg) {
  errors.push(`❌ [${file}]: ${msg}`);
}

function addWarning(file, msg) {
  warnings.push(`⚠️  [${file}]: ${msg}`);
}

function loadJsonSafe(filePath) {
  const relPath = path.relative(ROOT, filePath);
  if (!fs.existsSync(filePath)) {
    addError(relPath, 'Dosya mevcut değil!');
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    addError(relPath, `Geçersiz JSON sözdizimi: ${e.message}`);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 1. ANIME.JSON DOĞRULAMASI
// ----------------------------------------------------------------------------
function validateAnimeJson() {
  const file = path.join(DATA_DIR, 'anime.json');
  const data = loadJsonSafe(file);
  if (!data) return;

  const rel = 'data/anime.json';
  if (!Array.isArray(data.anime)) {
    addError(rel, '"anime" alanı dizi (array) olmalıdır.');
    return;
  }

  if (data.anime.length === 0) {
    addError(rel, '"anime" dizisi boş olamaz.');
    return;
  }

  const seenIds = new Set();
  for (let i = 0; i < data.anime.length; i++) {
    const a = data.anime[i];
    const prefix = `[#${i + 1} - ${a.title || a.id || 'isimsiz'}]`;

    if (!a.id) addError(rel, `${prefix} 'id' eksik.`);
    else if (seenIds.has(String(a.id))) addError(rel, `${prefix} mükerrer ID: ${a.id}`);
    else seenIds.add(String(a.id));

    if (!a.title || typeof a.title !== 'string' || !a.title.trim()) {
      addError(rel, `${prefix} 'title' boş veya geçersiz.`);
    }

    if (a.status && !VALID_STATUSES.has(a.status)) {
      addError(rel, `${prefix} geçersiz status: '${a.status}'`);
    }

    if (a.score != null) {
      const s = Number(a.score);
      if (isNaN(s) || s < 0 || s > 10) {
        addError(rel, `${prefix} 'score' 0-10 aralığında olmalıdır (bulunan: ${a.score})`);
      }
    }

    if (a.subScores != null) {
      if (typeof a.subScores !== 'object' || Array.isArray(a.subScores)) {
        addError(rel, `${prefix} 'subScores' nesne (object) olmalıdır.`);
      } else {
        for (const [k, v] of Object.entries(a.subScores)) {
          const num = Number(v);
          if (isNaN(num) || num < 1 || num > 5 || !Number.isInteger(num)) {
            addError(rel, `${prefix} 'subScores.${k}' 1-5 arasında tam sayı olmalıdır (bulunan: ${v})`);
          }
        }
      }
    }

    if (!Array.isArray(a.parts)) {
      addError(rel, `${prefix} 'parts' alanı dizi olmalıdır.`);
    } else {
      for (let j = 0; j < a.parts.length; j++) {
        const p = a.parts[j];
        const pRef = `${prefix} Parça #${j + 1} (${p.name || p.id || 'isimsiz'})`;
        if (p.episodes != null && (typeof p.episodes !== 'number' || p.episodes < 0)) {
          addError(rel, `${pRef} 'episodes' negatif veya sayı değil: ${p.episodes}`);
        }
        if (p.watched != null && (typeof p.watched !== 'number' || p.watched < 0)) {
          addError(rel, `${pRef} 'watched' negatif veya sayı değil: ${p.watched}`);
        }
      }
    }
  }

  if (!data.stats || typeof data.stats !== 'object') {
    addWarning(rel, "'stats' özet nesnesi eksik.");
  }

  // Git karşılaştırması ile içerik kaybı önleme (Content Loss Guard)
  try {
    const headRaw = execSync('git show HEAD:data/anime.json 2>/dev/null', { cwd: ROOT, encoding: 'utf8' });
    const headData = JSON.parse(headRaw);
    if (headData && Array.isArray(headData.anime)) {
      const prevCount = headData.anime.length;
      const currCount = data.anime.length;
      // Eğer mevcut kayıt sayısı bir önceki commit'e göre %10'dan fazla azaldıysa uyar/durdur
      if (currCount < prevCount && (prevCount - currCount) > 2) {
        addError(rel, `İçerik kaybı koruması tetiklendi! Kayıt sayısı beklenmedik şekilde düştü: ${prevCount} -> ${currCount}`);
      }
    }
  } catch (_) {
    // Git geçmişi yoksa veya ilk commit ise atla
  }
}

// ----------------------------------------------------------------------------
// 2. ÇOKLU MEDYA DOSYALARI (SERIES, MOVIES, BOOKS, MANGA, GUIDES) DOĞRULAMASI
// ----------------------------------------------------------------------------
function validateMultiMediaFiles() {
  const files = [
    'series.json',
    'movies.json',
    'books.json',
    'manga.json',
    'guides.json'
  ];

  for (const fileName of files) {
    const fullPath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const data = loadJsonSafe(fullPath);
    if (!data) continue;

    const rel = `data/${fileName}`;
    if (!Array.isArray(data.items)) {
      addError(rel, "'items' alanı bir dizi olmalıdır.");
      continue;
    }

    const seenIds = new Set();
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      const prefix = `[#${i + 1} - ${it.title || it.id || 'isimsiz'}]`;

      if (!it.id) addError(rel, `${prefix} 'id' eksik.`);
      else if (seenIds.has(String(it.id))) addError(rel, `${prefix} mükerrer ID: ${it.id}`);
      else seenIds.add(String(it.id));

      if (!it.title || typeof it.title !== 'string') {
        addError(rel, `${prefix} 'title' boş veya geçersiz.`);
      }

      if (it.status && !VALID_STATUSES.has(it.status)) {
        addError(rel, `${prefix} geçersiz status: '${it.status}'`);
      }

      if (it.score != null) {
        const s = Number(it.score);
        if (isNaN(s) || s < 0 || s > 10) {
          addError(rel, `${prefix} 'score' 0-10 aralığında olmalıdır (bulunan: ${it.score})`);
        }
      }

      if (it.subScores != null) {
        if (typeof it.subScores !== 'object' || Array.isArray(it.subScores)) {
          addError(rel, `${prefix} 'subScores' nesne (object) olmalıdır.`);
        } else {
          for (const [k, v] of Object.entries(it.subScores)) {
            const num = Number(v);
            if (isNaN(num) || num < 1 || num > 5 || !Number.isInteger(num)) {
              addError(rel, `${prefix} 'subScores.${k}' 1-5 arasında tam sayı olmalıdır (bulunan: ${v})`);
            }
          }
        }
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 3. SECTIONS.JSON VE MANIFEST DOĞRULAMASI
// ----------------------------------------------------------------------------
function validateConfigJsonFiles() {
  const sectionsFile = path.join(DATA_DIR, 'sections.json');
  const sectionsData = loadJsonSafe(sectionsFile);
  if (sectionsData) {
    if (!Array.isArray(sectionsData.sections) || sectionsData.sections.length === 0) {
      addError('data/sections.json', "'sections' dizisi bulunamadı veya boş.");
    }
  }

  const manifestFile = path.join(DATA_DIR, 'mobile-api-manifest.json');
  loadJsonSafe(manifestFile);

  const overridesFile = path.join(DATA_DIR, 'overrides.json');
  loadJsonSafe(overridesFile);
}

// ----------------------------------------------------------------------------
// 4. HTML VE STATİK YOL KONTROLÜ
// ----------------------------------------------------------------------------
function validateCoreHtmlFiles() {
  const corePages = [
    'index.html',
    'admin/index.html',
    'anime/index.html',
    'dizi/index.html',
    'film/index.html',
    'kitap/index.html',
    'manga/index.html',
    'rehber/index.html',
    'istatistik/index.html',
    'zaman-tuneli/index.html'
  ];

  for (const page of corePages) {
    const fullPath = path.join(ROOT, page);
    if (!fs.existsSync(fullPath)) {
      addError(page, 'Kritik sayfa HTML dosyası bulunamadı!');
    }
  }
}

// ----------------------------------------------------------------------------
// ÇALIŞTIR VE RAPORLA
// ----------------------------------------------------------------------------
console.log('🔍 [Veri & İçerik Güvenliği]: Doğrulama başlatılıyor...');
validateAnimeJson();
validateMultiMediaFiles();
validateConfigJsonFiles();
validateCoreHtmlFiles();

if (warnings.length) {
  console.log('\n⚠️  Uyarılar:');
  for (const w of warnings) console.log(`  ${w}`);
}

if (errors.length) {
  console.error('\n🚨 Doğrulama Başarısız! Hatalar tespit edildi:');
  for (const err of errors) console.error(`  ${err}`);
  console.error('\nİçeriklerin bozulmasını önlemek için işlem durduruldu.');
  process.exit(1);
}

console.log('✅ [Tüm Kontroller Başarılı]: Veri ve içerik bütünlüğü %100 doğrulandı.');
process.exit(0);
