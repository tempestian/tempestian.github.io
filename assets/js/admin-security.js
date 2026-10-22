(() => {
  const B32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const VAULT_KEY = 'tp_admin_vault_v1';
  const DEVICE_VAULT_KEY = 'tp_admin_dev_vault_v1';
  const ATTEMPT_KEY = 'tp_admin_guard_v1';
  const IDB_NAME = 'tp_admin_idb_v1';
  const IDB_STORE = 'keystore';
  const IDB_KEY_ID = 'device_master_key';
  const IDLE_LIMIT_MS = 15 * 60 * 1000;

  let activeSession = null;
  let idleTimer = 0;
  let onLockCallback = null;

  const toB64 = bytes => {
    let bin = '';
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  };

  const fromB64 = str => {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const utf8ToB64 = str => toB64(new TextEncoder().encode(str));
  const b64ToUtf8 = str => new TextDecoder().decode(fromB64(str.replace(/\s+/g, '')));

  function openKeyDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB desteklenmiyor'));
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB hatası'));
    });
  }

  async function getOrCreateDeviceKey(forceNew = false) {
    const db = await openKeyDB();
    if (!forceNew) {
      const existing = await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY_ID);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (existing) {
        db.close();
        return existing;
      }
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(key, IDB_KEY_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    return key;
  }

  async function saveDeviceVault(payload) {
    const key = await getOrCreateDeviceKey(true);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));
    const record = {
      v: 1,
      mode: 'totp-device',
      username: payload.username || 'tempestian',
      iv: toB64(iv),
      ct: toB64(cipher),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(DEVICE_VAULT_KEY, JSON.stringify(record));
    return record;
  }

  function getDeviceVaultMeta() {
    try {
      const raw = localStorage.getItem(DEVICE_VAULT_KEY);
      if (!raw) return null;
      const j = JSON.parse(raw);
      return j && j.v === 1 && j.ct ? j : null;
    } catch (e) {
      return null;
    }
  }

  async function clearDeviceVault() {
    try { localStorage.removeItem(DEVICE_VAULT_KEY); } catch (e) {}
    try {
      const db = await openKeyDB();
      await new Promise(resolve => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_KEY_ID);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      db.close();
    } catch (e) {}
  }

  function generateBase32Secret(byteLen = 20) {
    const rnd = crypto.getRandomValues(new Uint8Array(byteLen));
    let bits = 0;
    let val = 0;
    let out = '';
    for (let i = 0; i < rnd.length; i++) {
      val = (val << 8) | rnd[i];
      bits += 8;
      while (bits >= 5) {
        out += B32_CHARS[(val >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += B32_CHARS[(val << (5 - bits)) & 31];
    return out;
  }

  function decodeBase32(str) {
    const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let val = 0;
    const out = [];
    for (let i = 0; i < clean.length; i++) {
      const idx = B32_CHARS.indexOf(clean[i]);
      if (idx < 0) continue;
      val = (val << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((val >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(out);
  }

  async function computeTOTP(base32Secret, counter) {
    const keyBytes = decodeBase32(base32Secret);
    if (!keyBytes.length) throw new Error('Geçersiz anahtar');
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, Math.floor(counter / 0x100000000), false);
    view.setUint32(4, counter >>> 0, false);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const offset = sig[sig.length - 1] & 0x0f;
    const code = (((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff)) % 1000000;
    return String(code).padStart(6, '0');
  }

  function timingSafeEqual(a, b) {
    const sa = String(a || '');
    const sb = String(b || '');
    if (sa.length !== sb.length) return false;
    let diff = 0;
    for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
    return diff === 0;
  }

  async function verifyTOTP(base32Secret, userCode, windowSteps = 1) {
    const cleanCode = String(userCode || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) return false;
    const nowStep = Math.floor(Date.now() / 1000 / 30);
    for (let w = -windowSteps; w <= windowSteps; w++) {
      const candidate = await computeTOTP(base32Secret, nowStep + w);
      if (timingSafeEqual(candidate, cleanCode)) return true;
    }
    return false;
  }

  async function deriveVaultKey(username, password, saltBytes, iterations = 600000) {
    const raw = new TextEncoder().encode(`${String(username).trim().toLowerCase()}:${password}`);
    const baseKey = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptVault(payload, username, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iter = 600000;
    const key = await deriveVaultKey(username, password, salt, iter);
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));
    return {
      v: 1,
      kdf: 'PBKDF2-SHA256',
      iter,
      salt: toB64(salt),
      iv: toB64(iv),
      ct: toB64(cipher),
      updatedAt: new Date().toISOString()
    };
  }

  async function decryptVault(vaultObj, username, password) {
    if (!vaultObj || vaultObj.v !== 1 || !vaultObj.salt || !vaultObj.iv || !vaultObj.ct) {
      throw new Error('Geçersiz kasa biçimi');
    }
    const salt = fromB64(vaultObj.salt);
    const iv = fromB64(vaultObj.iv);
    const ct = fromB64(vaultObj.ct);
    const iter = Number(vaultObj.iter) || 600000;
    const key = await deriveVaultKey(username, password, salt, iter);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function checkRateLimit() {
    try {
      const raw = sessionStorage.getItem(ATTEMPT_KEY);
      if (!raw) return { ok: true, waitSec: 0 };
      const state = JSON.parse(raw);
      if (state.until && Date.now() < state.until) {
        return { ok: false, waitSec: Math.ceil((state.until - Date.now()) / 1000) };
      }
      return { ok: true, waitSec: 0 };
    } catch (e) {
      return { ok: true, waitSec: 0 };
    }
  }

  function recordFailedAttempt() {
    try {
      const raw = sessionStorage.getItem(ATTEMPT_KEY);
      const state = raw ? JSON.parse(raw) : { count: 0, until: 0 };
      state.count = (state.count || 0) + 1;
      if (state.count >= 4) {
        const delaySec = Math.min(300, Math.pow(2, state.count - 3) * 5);
        state.until = Date.now() + delaySec * 1000;
      }
      sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function clearFailedAttempts() {
    try { sessionStorage.removeItem(ATTEMPT_KEY); } catch (e) {}
  }

  function getLocalVault() {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocalVault(vaultObj) {
    try {
      localStorage.setItem(VAULT_KEY, JSON.stringify(vaultObj));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearLocalVault() {
    try { localStorage.removeItem(VAULT_KEY); } catch (e) {}
  }

  async function fetchRemoteVault(rootPath = '../') {
    try {
      const res = await fetch(rootPath + 'data/admin-vault.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json();
      return j && j.v === 1 && j.ct ? j : null;
    } catch (e) {
      return null;
    }
  }

  async function verifyGithubWriteAccess(pat, expectedOwner = 'tempestian', expectedRepo = 'tempestian.github.io') {
    const cleanPat = String(pat || '').trim();
    if (!cleanPat) throw new Error('GitHub Fine-Grained Token (PAT) zorunludur.');
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cleanPat}`
    };
    const userRes = await fetch('https://api.github.com/user', { headers, cache: 'no-store' });
    if (!userRes.ok) {
      recordFailedAttempt();
      throw new Error('GitHub Token geçersiz veya süresi dolmuş.');
    }
    const userJson = await userRes.json();
    if (!userJson.login || userJson.login.toLowerCase() !== expectedOwner.toLowerCase()) {
      recordFailedAttempt();
      throw new Error(`Yetkisiz GitHub hesabı. Yalnızca '${expectedOwner}' hesabı yönetici olabilir.`);
    }
    const repoRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(expectedOwner)}/${encodeURIComponent(expectedRepo)}`, { headers, cache: 'no-store' });
    if (!repoRes.ok) {
      recordFailedAttempt();
      throw new Error('Hedef depoya erişim doğrulanamadı.');
    }
    const repoJson = await repoRes.json();
    if (!repoJson.permissions || (!repoJson.permissions.push && !repoJson.permissions.admin)) {
      recordFailedAttempt();
      throw new Error('Bu token hedef depoda yazma (Contents: Read & Write) yetkisine sahip değil.');
    }
    return {
      login: userJson.login,
      repoOwner: expectedOwner,
      repoName: expectedRepo
    };
  }

  function resetIdleTimer() {
    if (!activeSession) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      lockSession('Oturum 15 dakika hareketsizlik nedeniyle otomatik kilitlendi.');
    }, IDLE_LIMIT_MS);
  }

  function bindIdleListeners() {
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => {
      window.addEventListener(ev, resetIdleTimer, { passive: true });
    });
  }
  bindIdleListeners();

  function lockSession(reason = '') {
    activeSession = null;
    clearTimeout(idleTimer);
    idleTimer = 0;
    if (typeof onLockCallback === 'function') onLockCallback(reason);
  }

  function setOnLock(fn) {
    onLockCallback = fn;
  }

  async function unlockWithDeviceTOTP(totpCode) {
    const rl = checkRateLimit();
    if (!rl.ok) throw new Error(`Çok fazla başarısız deneme. Lütfen ${rl.waitSec} saniye bekleyin.`);
    const meta = getDeviceVaultMeta();
    if (!meta) throw new Error('Bu cihazda tanımlı Google Authenticator profili bulunamadı.');
    let data;
    try {
      const key = await getOrCreateDeviceKey(false);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(meta.iv) }, key, fromB64(meta.ct));
      data = JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      recordFailedAttempt();
      throw new Error('Cihaz anahtarı okunamadı. Lütfen şifreli kasayla giriş yapın.');
    }
    if (!data || !data.pat) {
      data = null;
      recordFailedAttempt();
      throw new Error('Cihaz kasasında geçerli yetkilendirme anahtarı bulunamadı.');
    }
    const totpOk = await verifyTOTP(data.totpSecret, totpCode, 1);
    if (!totpOk) {
      data = null;
      recordFailedAttempt();
      throw new Error('Google Authenticator 6 haneli kodu hatalı veya süresi doldu.');
    }
    clearFailedAttempts();
    activeSession = {
      username: data.username || 'tempestian',
      pat: data.pat,
      repoOwner: data.repoOwner || 'tempestian',
      repoName: data.repoName || 'tempestian.github.io',
      branch: data.branch || 'main',
      totpSecret: data.totpSecret,
      unlockedAt: Date.now()
    };
    resetIdleTimer();
    return getSessionInfo();
  }

  async function unlockWithVault(vaultObj, username, password, totpCode, bindDevice = true) {
    const rl = checkRateLimit();
    if (!rl.ok) throw new Error(`Çok fazla başarısız deneme. Lütfen ${rl.waitSec} saniye bekleyin.`);
    let data;
    try {
      data = await decryptVault(vaultObj, username, password);
    } catch (e) {
      recordFailedAttempt();
      throw new Error('Kullanıcı adı veya admin parolası hatalı.');
    }
    if (!data || timingSafeEqual(String(data.username || '').toLowerCase(), String(username || '').trim().toLowerCase()) === false) {
      recordFailedAttempt();
      throw new Error('Kullanıcı adı veya admin parolası hatalı.');
    }
    const totpOk = await verifyTOTP(data.totpSecret, totpCode, 1);
    if (!totpOk) {
      recordFailedAttempt();
      throw new Error('Google Authenticator 6 haneli kodu doğrulanamadı veya süresi doldu.');
    }
    clearFailedAttempts();
    if (bindDevice && data.pat) {
      try { await saveDeviceVault(data); } catch (e) {}
    }
    activeSession = {
      username: data.username,
      pat: data.pat || '',
      repoOwner: data.repoOwner || 'tempestian',
      repoName: data.repoName || 'tempestian.github.io',
      branch: data.branch || 'main',
      totpSecret: data.totpSecret,
      unlockedAt: Date.now()
    };
    resetIdleTimer();
    return getSessionInfo();
  }

  async function githubGetFile(path) {
    if (!activeSession || !activeSession.pat) {
      throw new Error('GitHub API işlemi için yetkilendirilmiş oturum gereklidir.');
    }
    resetIdleTimer();
    const { repoOwner, repoName, branch, pat } = activeSession;
    const cleanPath = String(path).replace(/^\/+/, '');
    const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`
      },
      cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub okuma hatası (${res.status}): ${txt.slice(0, 180)}`);
    }
    const j = await res.json();
    return {
      sha: j.sha,
      content: j.content ? b64ToUtf8(j.content) : '',
      raw: j
    };
  }

  async function githubPutFile(path, contentStrOrBytes, message, isBinary = false) {
    if (!activeSession || !activeSession.pat) {
      throw new Error('GitHub API üzerinden kaydetmek için yetkilendirilmiş oturum gereklidir.');
    }
    resetIdleTimer();
    const { repoOwner, repoName, branch, pat } = activeSession;
    const cleanPath = String(path).replace(/^\/+/, '');
    const existing = await githubGetFile(cleanPath);
    const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${cleanPath}`;
    const b64Content = isBinary ? toB64(contentStrOrBytes) : utf8ToB64(contentStrOrBytes);
    const body = {
      message: message || `${cleanPath} admin panelinden güncellendi`,
      content: b64Content,
      branch
    };
    if (existing && existing.sha) body.sha = existing.sha;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub yazma hatası (${res.status}): ${txt.slice(0, 220)}`);
    }
    return await res.json();
  }

  async function githubListFileCommits(path = 'data/anime.json', perPage = 20) {
    resetIdleTimer();
    const repoOwner = (activeSession && activeSession.repoOwner) || 'tempestian';
    const repoName = (activeSession && activeSession.repoName) || 'tempestian.github.io';
    const pat = activeSession && activeSession.pat;
    const cleanPath = String(path).replace(/^\/+/, '');
    const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/commits?path=${encodeURIComponent(cleanPath)}&per_page=${Number(perPage) || 20}`;
    const headers = { Accept: 'application/vnd.github+json' };
    if (pat) headers.Authorization = `Bearer ${pat}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub commit geçmişi okunamadı (${res.status}): ${txt.slice(0, 180)}`);
    }
    return await res.json();
  }

  async function githubGetFileAtRef(path = 'data/anime.json', ref = 'main') {
    resetIdleTimer();
    const repoOwner = (activeSession && activeSession.repoOwner) || 'tempestian';
    const repoName = (activeSession && activeSession.repoName) || 'tempestian.github.io';
    const pat = activeSession && activeSession.pat;
    const cleanPath = String(path).replace(/^\/+/, '');
    const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${cleanPath}?ref=${encodeURIComponent(ref)}`;
    const headers = { Accept: 'application/vnd.github.v3.raw' };
    if (pat) headers.Authorization = `Bearer ${pat}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Commit içeriği okunamadı (${res.status}): ${txt.slice(0, 180)}`);
    }
    return await res.text();
  }

  async function githubTriggerWorkflow(workflowFile = 'sync-anilist.yml', inputs = { sync_mode: 'hybrid' }) {
    if (!activeSession || !activeSession.pat) {
      throw new Error('GitHub Actions tetiklemek için yetkilendirilmiş oturum gereklidir.');
    }
    resetIdleTimer();
    const { repoOwner, repoName, branch, pat } = activeSession;
    const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: branch, inputs })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub Actions tetikleme hatası (${res.status}): ${txt.slice(0, 200)}`);
    }
    return true;
  }

  function sanitizeText(str, maxLen = 1000) {
    if (str == null) return '';
    return String(str).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLen);
  }

  function sanitizeUrl(urlStr, allowRelative = true) {
    const raw = sanitizeText(urlStr, 600);
    if (!raw) return '';
    if (/^(javascript|data|vbscript|file):/i.test(raw)) return '';
    if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw)) return raw;
    if (allowRelative && /^[a-zA-Z0-9._/-]+([?#][^\s]*)?$/.test(raw) && !raw.includes('..')) return raw;
    return '';
  }

  function getSessionInfo() {
    if (!activeSession) return null;
    return {
      username: activeSession.username,
      repoOwner: activeSession.repoOwner,
      repoName: activeSession.repoName,
      branch: activeSession.branch,
      hasToken: Boolean(activeSession.pat),
      totpSecret: activeSession.totpSecret || '',
      unlockedAt: activeSession.unlockedAt
    };
  }

  async function updateSessionCredentials({ pat, repoOwner, repoName, branch, saveToDevice = true }) {
    if (!activeSession) return;
    if (pat !== undefined && pat.trim()) {
      await verifyGithubWriteAccess(pat.trim(), repoOwner || activeSession.repoOwner, repoName || activeSession.repoName);
      activeSession.pat = pat.trim();
    }
    if (repoOwner) activeSession.repoOwner = sanitizeText(repoOwner, 100);
    if (repoName) activeSession.repoName = sanitizeText(repoName, 100);
    if (branch) activeSession.branch = sanitizeText(branch, 80);
    if (saveToDevice && activeSession.totpSecret && activeSession.pat) {
      await saveDeviceVault({
        username: activeSession.username,
        pat: activeSession.pat,
        repoOwner: activeSession.repoOwner,
        repoName: activeSession.repoName,
        branch: activeSession.branch,
        totpSecret: activeSession.totpSecret
      });
    }
  }

  window.AdminSecurity = {
    generateBase32Secret,
    verifyTOTP,
    computeTOTP,
    encryptVault,
    decryptVault,
    saveDeviceVault,
    getDeviceVaultMeta,
    clearDeviceVault,
    getLocalVault,
    saveLocalVault,
    clearLocalVault,
    fetchRemoteVault,
    verifyGithubWriteAccess,
    unlockWithDeviceTOTP,
    unlockWithVault,
    lockSession,
    setOnLock,
    getSessionInfo,
    updateSessionCredentials,
    githubGetFile,
    githubPutFile,
    githubTriggerWorkflow,
    githubListFileCommits,
    githubGetFileAtRef,
    sanitizeText,
    sanitizeUrl
  };
})();
