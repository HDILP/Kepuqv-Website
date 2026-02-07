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

// 简化的 CDN 竞速（优先用首节点，启用备选时用 AbortController）
const matchCDN = async (req) => {
  try {
    const urlObj = new URL(req.url);
    const isJsdelivr = urlObj.hostname.includes('jsdelivr.net');
    if (!isJsdelivr) return fetch(req).catch(() => fetch(req));

    const alternatives = [req.url, req.url.replace('cdn.jsdelivr.net', 'fastly.jsdelivr.net')];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const promises = alternatives.map((u, idx) => fetch(new Request(u), { signal: controller.signal }).then(r => {
      if (r && r.ok) {
        clearTimeout(timeout); controller.abort(); return r;
      }
      throw new Error('bad');
    }));
    return Promise.any(promises).catch(() => fetch(req));
  } catch (e) { return fetch(req).catch(() => null); }
};

/* ==================== Fetch routing ==================== */
const handleFetch = async (event) => {
  const url = event.request.url;
  if (/nocache/.test(url)) return NetworkOnly(event);
  if (/@latest/.test(url)) return CacheFirst(event);
  if (/bing\.com\/th\?/.test(url) || new URL(url).pathname.includes('bing.jpg')) return CacheAlways(event);

  const isStatic = /\.(png|jpg|jpeg|svg|gif|webp|ico|css|js|woff2?|ttf|eot)$/i.test(url);
  const isCDN = /(cdnjs\.cloudflare\.com|jsdelivr\.net|unpkg\.com|npm\.elemecdn\.com)/.test(url);

  if (isCDN) return matchCDN(event.request);
  if (isStatic) return CacheAlways(event);
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
    caches.open(CACHE_NAME + '-precache').then(cache => cacheNewVersionResources(cache));
  }
});

/* ==================== End ==================== */
logger.ready('Volantis SW (merged) loaded');
