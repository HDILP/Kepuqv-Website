/* =====================================================
   Volantis Service Worker — Merged & Refactored
   - 将第二份 SW 的可选动态解析与精美 logger、前端进度推送
     与第一份 SW 的高性能 CDN/缓存策略合并。
   - 保留高性能 fetch/CDN 竞速与并发控制。
   - 前端 <-> SW 通信尽量精简：
       * 页面 -> SW: { type: 'FORCE_UPDATE' } 触发后台拉新并缓存（会有进度消息）
       * 页面 -> SW: { type: 'SKIP_WAITING' } 在用户确认后跳过等待并激活
       * SW -> 页面: 'UPDATE_STARTED' / 'UPDATE_PROGRESS' / 'NEW_VERSION_CACHED'
   ===================================================== */

const prefix = 'volantis-community';
const cacheSuffixVersion = '00000018-::cacheSuffixVersion::'; // 构建时替换
const CACHE_NAME = prefix + '-v' + cacheSuffixVersion;
const debug = true;

const PreCachlist = [
  "/css/style.css",
  "/js/app.js",
  "/js/search/hexo.js",
  "/",
];

/* ==================== Logger ==================== */
const logger = (() => {
  if (!debug) return { info: () => {}, warn: () => {}, error: () => {}, ready: () => {} };
  return {
    info: (...a) => console.log('%c[SW]', 'color:#2196F3;font-weight:bold;', ...a),
    ready: (...a) => console.log('%c[SW]', 'color:#42b983;font-weight:bold;', ...a),
    warn: (...a) => console.warn('%c[SW]', 'color:#ff9800;font-weight:bold;', ...a),
    error: (...a) => console.error('%c[SW]', 'color:#f44336;font-weight:bold;', ...a),
  };
})();

/* ==================== Utilities ==================== */
// ==================== Safe request handling ====================
// 不再进行路径推断（不补 /index.html）
// 目录是否可缓存，交给服务器与浏览器自己决定
const requestFor = (urlOrReq) => {
  if (urlOrReq instanceof Request) return urlOrReq;
  return new Request(urlOrReq, { credentials: 'same-origin' });
};

let nextCacheSuffixVersion = cacheSuffixVersion;
const cacheNameFor = (version, type) => `${prefix}-v${version}-${type}`;

/* ==================== Client messaging ==================== */
const sendMessageToAllClients = async (msg) => {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(c => {
      try { c.postMessage(msg); } catch (e) {}
    });
  } catch (e) { logger.error('sendMessageToAllClients error:', e); }
};

/* ==================== Dynamic background caching with progress ==================== */
async function cacheNewVersionResources() {
  await sendMessageToAllClients({ type: 'UPDATE_STARTED' });

  let latestList = [];
  try {
    const res = await fetch(new Request('/', { cache: 'no-store' }));
    if (res && res.ok) {
      const html = await res.text();
      const rx = /(?:href|src)=["']([^"']+)["']/g;
      let m;
      const set = new Set(['/']);
      while ((m = rx.exec(html)) !== null) {
        let url = m[1];
        if (!url) continue;
        if (url.startsWith('http') || url.startsWith('//')) continue;
        if (!url.startsWith('/')) url = '/' + url.replace(/^\.\//, '');
        set.add(url);
      }
      latestList = Array.from(set);
    }
  } catch (e) {}

  const precache = await caches.open(cacheNameFor(nextCacheSuffixVersion, 'precache'));
  const runtime = await caches.open(cacheNameFor(nextCacheSuffixVersion, 'runtime'));

  const total = latestList.length;
  if (total === 0) {
    await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED' });
    return;
  }
  let done = 0;
  const MAX_CONCURRENT = 3;

  for (let i = 0; i < latestList.length; i += MAX_CONCURRENT) {
    const batch = latestList.slice(i, i + MAX_CONCURRENT).map(async (url) => {
      try {
        const req = requestFor(url);
        const res = await fetch(req);
        if (res && res.ok) {
          await precache.put(req, res.clone()).catch(() => {});
          await runtime.put(req, res.clone()).catch(() => {});
        }
      } catch (e) {}
      done++;
      const pct = Math.round((done / total) * 100);
      await sendMessageToAllClients({ type: 'UPDATE_PROGRESS', progress: pct });
    });
    await Promise.all(batch);
  }

  await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED' });
}

/* ==================== Install ==================== */
self.addEventListener('install', event => {
  logger.info('install event');
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME + '-precache');
      // 并发预缓存（小批量）
      const CONC = 2;
      for (let i = 0; i < PreCachlist.length; i += CONC) {
        const batch = PreCachlist.slice(i, i + CONC).map(async (u) => {
          try {
            const req = requestFor(u);
            const matched = await cache.match(req);
            if (!matched) {
              const r = await fetch(req);
              if (r && r.ok) await cache.put(req, r.clone());
            }
          } catch (e) { logger.warn('[install] precache fail', u, e); }
        });
        await Promise.all(batch);
      }

      // 动态拉取并缓存新版本的资源（并发送进度）
      await cacheNewVersionResources();

      // 安装完成后不立即 skipWaiting，等待前端发起 SKIP_WAITING
      logger.ready('install done');

      // 通知 clients 可用（页面端会收到 NEW_VERSION_CACHED）
      try {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        allClients.forEach(c => {
          try {
            c.postMessage({ type: 'INSTALLED' });
          } catch (e) {}
        });
      } catch (e) { logger.warn('notify clients after install failed', e); }

    } catch (e) { logger.error('install error', e); }
  })());
});

/* ==================== Activate ==================== */
self.addEventListener('activate', event => {
  logger.info('activate event');
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      const keepVersions = new Set([cacheSuffixVersion, nextCacheSuffixVersion]);
      await Promise.all(keys.map(key => {
        const shouldKeep = Array.from(keepVersions).some(version => key.includes(`-v${version}-`));
        if (!shouldKeep) {
          logger.info('Deleting old cache', key);
          return caches.delete(key);
        }
      }));
      await self.clients.claim();
      logger.ready('activated and claimed');
    } catch (e) { logger.error('activate error', e); }
  })());
});

/* ==================== Fetch strategies ==================== */
const NetworkOnly = async (event) => {
  try {
    return await fetch(event.request);
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
};

const CacheFirst = async (event) => {
  const req = requestFor(event.request);
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME + '-runtime');
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    return new Response('Network error', { status: 504 });
  }
};

const CacheAlways = async (event) => {
  const req = requestFor(event.request);
  const cache = await caches.open(CACHE_NAME + '-runtime');
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    return new Response('Network error', { status: 504 });
  }
};

// ==================== Smart jsDelivr racing (基于你的 cdn 表) ====================
const raceFetch = async (urls, reqInit = {}, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.any(
      urls.map(u => fetch(new Request(u, reqInit), { signal: controller.signal }).then(r => {
        if (r && (r.ok || r.type === 'opaque')) return r;
        throw new Error('bad response');
      }))
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
};

const matchCDN = async (req) => {
  try {
    const url = req.url;

    // gh
    if (url.startsWith(cdn.gh.jsdelivr)) {
      const path = url.slice(cdn.gh.jsdelivr.length);
      return raceFetch([
        cdn.gh.jsdelivr + path,
        cdn.gh.fastly + path,
        cdn.gh.gcore + path,
        cdn.gh.testingcf + path,
      ], { method: req.method, headers: req.headers, mode: req.mode, credentials: req.credentials });
    }

    // combine
    if (url.startsWith(cdn.combine.jsdelivr)) {
      const path = url.slice(cdn.combine.jsdelivr.length);
      return raceFetch([
        cdn.combine.jsdelivr + path,
        cdn.combine.fastly + path,
        cdn.combine.gcore + path,
      ], { method: req.method, headers: req.headers, mode: req.mode, credentials: req.credentials });
    }

    // npm
    if (url.startsWith(cdn.npm.jsdelivr)) {
      const path = url.slice(cdn.npm.jsdelivr.length);
      return raceFetch([
        cdn.npm.jsdelivr + path,
        cdn.npm.fastly + path,
        cdn.npm.gcore + path,
        cdn.npm.eleme + path,
        cdn.npm.unpkg + path,
      ], { method: req.method, headers: req.headers, mode: req.mode, credentials: req.credentials });
    }

    // cdnjs
    if (url.startsWith(cdn.cdnjs.cdnjs)) {
      const path = url.slice(cdn.cdnjs.cdnjs.length);
      return raceFetch([
        cdn.cdnjs.cdnjs + path,
        cdn.cdnjs.baomitu + path,
        cdn.cdnjs.bootcdn + path,
        cdn.cdnjs.bytedance + path,
        cdn.cdnjs.sustech + path,
      ], { method: req.method, headers: req.headers, mode: req.mode, credentials: req.credentials });
    }

    return fetch(req);
  } catch (e) {
    return fetch(req);
  }
};

/* ==================== Fetch routing ==================== */
const handleFetch = async (event) => {
  const url = event.request.url;

  // === 🎵 音乐 / 播放器资源：完全绕过 SW ===
  if (
    event.request.headers.has('range') ||
    /\.(mp3|aac|m4a|ogg|wav|flac)$/i.test(url) ||
    /(music\.163\.com|music\.126\.net|qqmusic\.qq\.com)/i.test(url)
  ) {
    return fetch(event.request);
  }

  if (/nocache/.test(url)) return NetworkOnly(event);
  if (/@latest/.test(url)) return CacheFirst(event);

  if (/(cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|gcore\.jsdelivr\.net|testingcf\.jsdelivr\.net|unpkg\.com|npm\.elemecdn\.com|cdnjs\.cloudflare\.com)/.test(url)) {
    return matchCDN(event.request);
  }

  if (/\.(png|jpg|jpeg|svg|gif|webp|ico|eot|ttf|woff|woff2)$/i.test(url)) {
    return CacheAlways(event);
  }
  if (/\.(css|js)$/i.test(url)) {
    return CacheAlways(event);
  }

  return CacheFirst(event);
};

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    handleFetch(event).catch(err => {
      logger.error('handleFetch critical error:', err);
      return fetch(event.request).catch(() => new Response('Service Worker Error', { status: 503 }));
    })
  );
});

/* ==================== Message listener (简洁) ==================== */
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    logger.info('SKIP_WAITING received');
    self.skipWaiting();
  }
  if (event.data.type === 'FORCE_UPDATE') {
    logger.info('FORCE_UPDATE received — starting background update');
    cacheNewVersionResources();
  }
  if (event.data.type === 'SET_NEXT_VERSION') {
    if (event.data.version) {
      nextCacheSuffixVersion = event.data.version;
      logger.info('SET_NEXT_VERSION received', nextCacheSuffixVersion);
    }
  }
});

/* ==================== End ==================== */
const cdn = {
  gh: {
    jsdelivr: 'https://cdn.jsdelivr.net/gh',
    fastly: 'https://fastly.jsdelivr.net/gh',
    gcore: 'https://gcore.jsdelivr.net/gh',
  },
  combine: {
    jsdelivr: 'https://cdn.jsdelivr.net/combine',
    fastly: 'https://fastly.jsdelivr.net/combine',
    gcore: 'https://gcore.jsdelivr.net/combine',
  },
  npm: {
    jsdelivr: 'https://cdn.jsdelivr.net/npm',
    fastly: 'https://fastly.jsdelivr.net/npm',
    gcore: 'https://gcore.jsdelivr.net/npm',
    unpkg: 'https://unpkg.com',
    eleme: 'https://npm.elemecdn.com',
    admincdn: 'https://jsd.admincdn.com/npm/',
  },
  cdnjs: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs',
    baomitu: 'https://lib.baomitu.com',
    bootcdn: 'https://cdn.bootcdn.net/ajax/libs',
    bytedance: 'https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M',
    sustech: 'https://mirrors.sustech.edu.cn/cdnjs/ajax/libs',
    admincdn: 'https://cdnjs.admincdn.com/ajax/libs',
  }
};

logger.ready('Volantis SW (merged) loaded');
