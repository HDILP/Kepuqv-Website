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
const DB_NAME = prefix + '-db'; // 持久化小型本地 "DB"（用 caches 实现）
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
const fullPath = (url) => {
  try {
    const urlObj = new URL(url, self.location.origin);
    let path = urlObj.pathname;
    if (urlObj.origin === self.location.origin) {
      if (path.endsWith('/')) path += 'index.html';
      else {
        const last = path.split('/').pop();
        if (last && !last.includes('.')) path += '/index.html';
      }
    }
    return `${urlObj.origin}${path}`;
  } catch (e) {
    return url;
  }
};
const requestFor = (url) => new Request(fullPath(url));

/* ==================== Simple DB (caches-based) ==================== */
const db = {
  read: async (key) => {
    try {
      const cache = await caches.open(DB_NAME);
      const res = await cache.match(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`));
      return res ? await res.text() : null;
    } catch (e) {
      logger.error('db.read error:', e);
      return null;
    }
  },
  write: async (key, value) => {
    try {
      const cache = await caches.open(DB_NAME);
      await cache.put(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`), new Response(value));
    } catch (e) {
      logger.error('db.write error:', e);
    }
  }
};

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
async function cacheNewVersionResources(cache) {
  // 一次性把可能的资源列表从 db/latest-list 取出来；若没有，再尝试抓取主页并解析资源
  await sendMessageToAllClients({ type: 'UPDATE_STARTED' });
  let latestList = [];
  try {
    const txt = await db.read('latest-list');
    if (txt) latestList = JSON.parse(txt);
  } catch (e) { /* ignore */ }

  // fallback: parse index.html to find CSS/JS if no latest-list
  if (!latestList || latestList.length === 0) {
    try {
      const res = await fetch(new Request(`/?t=${Date.now()}`));
      if (res && res.ok) {
        const html = await res.text();
        const rx = /(?:href|src)=["']([^"']+\.(?:css|js))["']/g;
        let m;
        const set = new Set(["/", ...PreCachlist]);
        while ((m = rx.exec(html)) !== null) {
          let url = m[1];
          if (!url) continue;
          if (url.startsWith('http') || url.startsWith('//')) continue; // skip third-party by default
          if (!url.startsWith('/')) {
            if (url.startsWith('./')) url = url.substring(1);
            url = '/' + url;
          }
          set.add(url);
        }
        latestList = Array.from(set);
        // 缓存至 DB 以便下次使用
        try { await db.write('latest-list', JSON.stringify(latestList)); } catch (e) {}
      }
    } catch (e) {
      logger.warn('Dynamic parse failed:', e);
    }
  }

  const total = latestList.length;
  if (total === 0) {
    await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED' });
    return;
  }

  let done = 0;
  const MAX_CONCURRENT = 3;

  // 分批并发下载并发送进度
  for (let i = 0; i < latestList.length; i += MAX_CONCURRENT) {
    const batch = latestList.slice(i, i + MAX_CONCURRENT).map(async (url) => {
      try {
        const req = requestFor(url);
        const res = await fetch(req);
        if (res && res.ok) {
          await cache.put(req, res.clone()).catch(() => {});
        }
      } catch (e) {
        // 忽略单个资源失败
      }
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
      // uuid 保持（兼容）
      if (!await db.read('uuid')) await db.write('uuid', (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random()));

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
      await cacheNewVersionResources(cache);

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
      await Promise.all(keys.map(key => {
        if (!key.includes(cacheSuffixVersion) && key !== DB_NAME) {
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
  try { return await fetch(event.request); } catch (e) { return new Response('Offline', { status: 503 }); }
};

const CacheFirst = async (event) => {
  const req = requestFor(event.request.url);
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(event.request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME + '-runtime');
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) { return new Response('Network error', { status: 504 }); }
};

const CacheAlways = async (event) => {
  const req = requestFor(event.request.url);
  const cache = await caches.open(CACHE_NAME + '-runtime');
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(event.request);
    if (res && (res.ok || res.type === 'opaque')) await cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) { return new Response('Network error', { status: 504 }); }
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
  if (/nocache/.test(url)) {
    return NetworkOnly(event);
  } else if (/@latest/.test(url)) {
    return CacheFirst(event);
  } else if (/cdnjs\.cloudflare\.com/.test(url)) {
    return CacheAlways(event);
  } else if (/music\.126\.net/.test(url)) {
    return CacheAlways(event);
  } else if (/qqmusic\.qq\.com/.test(url)) {
    return CacheAlways(event);
  } else if (/jsdelivr\.net/.test(url)) {
    return CacheAlways(event);
  } else if (/npm\.elemecdn\.com/.test(url)) {
    return CacheAlways(event);
  } else if (/unpkg\.com/.test(url)) {
    return CacheAlways(event);
  } else if (/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico|eot|ttf|woff|woff2)$/.test(url)) {
    return CacheAlways(event);
  } else if (/.*\.(css|js)$/.test(url)) {
    return CacheAlways(event);
  } else {
    return CacheFirst(event);
  }
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
    caches.open(CACHE_NAME + '-precache').then(cache => cacheNewVersionResources(cache));
  }
});

/* ==================== End ==================== */
const cdn = {
  gh: {
    jsdelivr: 'https://cdn.jsdelivr.net/gh',
    fastly: 'https://fastly.jsdelivr.net/gh',
    gcore: 'https://gcore.jsdelivr.net/gh',
    testingcf: 'https://testingcf.jsdelivr.net/gh',
    test1: 'https://test1.jsdelivr.net/gh',
  },
  combine: {
    jsdelivr: 'https://cdn.jsdelivr.net/combine',
    fastly: 'https://fastly.jsdelivr.net/combine',
    gcore: 'https://gcore.jsdelivr.net/combine',
    testingcf: 'https://testingcf.jsdelivr.net/combine',
    test1: 'https://test1.jsdelivr.net/combine',
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
