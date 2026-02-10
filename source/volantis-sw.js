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
  '/css/style.css',
  '/js/app.js',
  '/js/search/hexo.js',
  '/',
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
const requestFor = (urlOrReq, extra = {}) => {
  if (urlOrReq instanceof Request) {
    return new Request(urlOrReq, { credentials: 'same-origin', ...extra });
  }
  return new Request(urlOrReq, { credentials: 'same-origin', ...extra });
};

const normalizeLocalAssetPath = (rawUrl) => {
  if (!rawUrl) return null;
  if (/^(?:https?:)?\/\//i.test(rawUrl) || rawUrl.startsWith('data:') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('javascript:')) {
    return null;
  }

  let cleaned = rawUrl.trim();
  if (!cleaned) return null;
  cleaned = cleaned.split('#')[0].split('?')[0];
  if (!cleaned) return null;

  if (cleaned.startsWith('./')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith('/')) cleaned = '/' + cleaned;
  return cleaned;
};

let nextCacheSuffixVersion = cacheSuffixVersion;
const cacheNameFor = (version, type) => `${prefix}-v${version}-${type}`;

const CDN_URL_REGEXP = /(cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|gcore\.jsdelivr\.net|testingcf\.jsdelivr\.net|unpkg\.com|npm\.elemecdn\.com|cdnjs\.cloudflare\.com)/i;
const isCDNUrl = (url) => CDN_URL_REGEXP.test(url);

const normalizeAssetForUpdate = (rawUrl) => {
  if (!rawUrl) return null;
  const cleaned = rawUrl.trim().split('#')[0];
  if (!cleaned) return null;

  if (/^https?:\/\//i.test(cleaned)) {
    return isCDNUrl(cleaned) ? cleaned : null;
  }
  if (cleaned.startsWith('//')) {
    const httpsUrl = 'https:' + cleaned;
    return isCDNUrl(httpsUrl) ? httpsUrl : null;
  }
  if (cleaned.startsWith('data:') || cleaned.startsWith('mailto:') || cleaned.startsWith('javascript:')) return null;

  let local = cleaned;
  if (local.startsWith('./')) local = local.slice(1);
  if (!local.startsWith('/')) local = '/' + local;
  return local;
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
let updateJob = null;
const noRetryUpdateVersions = new Set();

const parseHomePageAssets = async () => {
  try {
    const res = await fetch(requestFor('/', { cache: 'no-store' }));
    if (!res || !res.ok) return [];
    const html = await res.text();
    const rx = /(?:href|src)=['"]([^'"\s>]+)['"]/g;
    const result = new Set();

    let m;
    while ((m = rx.exec(html)) !== null) {
      const normalized = normalizeAssetForUpdate(m[1]);
      if (normalized) result.add(normalized);
    }
    return Array.from(result);
  } catch (e) {
    logger.warn('parseHomePageAssets failed:', e);
    return [];
  }
};

const fetchForBackgroundUpdate = async (req) => {
  if (isCDNUrl(req.url)) {
    return matchCDN(req);
  }
  return fetch(req);
};

async function cacheNewVersionResources() {
  if (updateJob) return updateJob;

  if (noRetryUpdateVersions.has(nextCacheSuffixVersion)) {
    logger.warn('[update] skip FORCE_UPDATE because this version is marked as no-retry:', nextCacheSuffixVersion);
    return;
  }

  updateJob = (async () => {
    await sendMessageToAllClients({ type: 'UPDATE_STARTED', version: nextCacheSuffixVersion });

    const latestList = Array.from(new Set([
      ...PreCachlist,
      ...(await parseHomePageAssets()),
    ].map(normalizeAssetForUpdate).filter(Boolean)));

    const precache = await caches.open(cacheNameFor(nextCacheSuffixVersion, 'precache'));
    const runtime = await caches.open(cacheNameFor(nextCacheSuffixVersion, 'runtime'));

    const total = latestList.length;
    if (total === 0) {
      await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED', version: nextCacheSuffixVersion });
      return;
    }

    let done = 0;
    let success = 0;
    const failed = [];
    const MAX_CONCURRENT = 3;

    for (let i = 0; i < latestList.length; i += MAX_CONCURRENT) {
      const batch = latestList.slice(i, i + MAX_CONCURRENT).map(async (url) => {
        try {
          const req = requestFor(url, { cache: 'no-store' });
          const res = await fetchForBackgroundUpdate(req);
          if (!res || (!res.ok && res.type !== 'opaque')) throw new Error(`HTTP ${res ? res.status : 'NO_RESPONSE'}`);
          await precache.put(req, res.clone());
          await runtime.put(req, res.clone());
          success += 1;
        } catch (e) {
          failed.push(url);
          logger.warn('[update] cache fail', url, e);
        }

        done += 1;
        const pct = Math.round((done / total) * 100);
        await sendMessageToAllClients({
          type: 'UPDATE_PROGRESS',
          version: nextCacheSuffixVersion,
          progress: pct,
          done,
          total,
          success,
          failed: failed.length,
        });
      });
      await Promise.all(batch);
    }

    if (failed.length === 0) {
      await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED', version: nextCacheSuffixVersion, total });
    } else {
      noRetryUpdateVersions.add(nextCacheSuffixVersion);
      logger.warn('[update] mark version as no-retry, user should refresh manually:', nextCacheSuffixVersion, failed);
      await sendMessageToAllClients({
        type: 'UPDATE_FAILED',
        version: nextCacheSuffixVersion,
        total,
        success,
        failed: failed.length,
        failedAssets: failed.slice(0, 20),
        noRetry: true,
      });
    }
  })().finally(() => {
    updateJob = null;
  });

  return updateJob;
}

/* ==================== Install ==================== */
self.addEventListener('install', event => {
  logger.info('install event');
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME + '-precache');
      const CONC = 2;
      for (let i = 0; i < PreCachlist.length; i += CONC) {
        const batch = PreCachlist.slice(i, i + CONC).map(async (u) => {
          try {
            const req = requestFor(u, { cache: 'no-store' });
            const matched = await cache.match(req);
            if (!matched) {
              const r = await fetch(req);
              if (r && r.ok) await cache.put(req, r.clone());
            }
          } catch (e) { logger.warn('[install] precache fail', u, e); }
        });
        await Promise.all(batch);
      }

      await cacheNewVersionResources();

      logger.ready('install done');
      try {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        allClients.forEach(c => {
          try {
            c.postMessage({ type: 'INSTALLED', version: cacheSuffixVersion });
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

const NetworkFirst = async (event) => {
  const req = requestFor(event.request, { cache: 'no-store' });
  const runtime = await caches.open(CACHE_NAME + '-runtime');
  const precache = await caches.open(CACHE_NAME + '-precache');

  try {
    const res = await fetch(req);
    if (res && res.ok) {
      runtime.put(req, res.clone()).catch(() => {});
      return res;
    }
    throw new Error('bad response');
  } catch (e) {
    const runtimeCached = await runtime.match(req);
    if (runtimeCached) return runtimeCached;
    const precached = await precache.match(req);
    if (precached) return precached;
    return new Response('Network error', { status: 504 });
  }
};

const isHtmlRequest = (request) => {
  const accept = request.headers.get('accept') || '';
  return request.mode === 'navigate' || accept.includes('text/html');
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

const clearOldRuntimeCaches = async () => {
  const keep = new Set([
    cacheNameFor(cacheSuffixVersion, 'runtime'),
    cacheNameFor(nextCacheSuffixVersion, 'runtime'),
  ]);
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => {
    if (!key.startsWith(prefix + '-v') || !key.endsWith('-runtime')) return Promise.resolve();
    if (keep.has(key)) return Promise.resolve();
    return caches.delete(key);
  }));
};

const putIntoRuntimeCache = async (req, res) => {
  if (!res) return;
  const runtime = await caches.open(CACHE_NAME + '-runtime');
  try {
    await runtime.put(req, res.clone());
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      logger.warn('[runtime] quota exceeded, clearing old runtime caches');
      await clearOldRuntimeCaches();
      try {
        await runtime.put(req, res.clone());
      } catch (retryError) {
        logger.warn('[runtime] retry cache put failed', retryError);
      }
      return;
    }
    throw e;
  }
};

const CacheRuntime = async (event, fetcher) => {
  const req = requestFor(event.request);
  const runtime = await caches.open(CACHE_NAME + '-runtime');
  const cached = await runtime.match(req);
  if (cached) return cached;

  try {
    const res = await fetcher(req);
    if (res && (res.status === 200 || res.type === 'opaque')) {
      putIntoRuntimeCache(req, res).catch(() => {});
    }
    return res;
  } catch (e) {
    logger.error('CacheRuntime error:', e);
    return fetch(req);
  }
};

const shouldBypassCDNRace = () => {
  try {
    const connection = (self.navigator && self.navigator.connection) || null;
    if (!connection) return false;
    const saveData = !!connection.saveData;
    const effectiveType = String(connection.effectiveType || '').toLowerCase();
    return saveData || /2g/.test(effectiveType);
  } catch (e) {
    return false;
  }
};

const CDN_FAIL_COOLDOWN_MS = 5 * 60 * 1000;
const CDN_RACE_LIMIT = 3;
const CDN_RACE_TIMEOUT_MS = 5000;
const cdnFailureUntil = new Map();

const markCDNFailed = (url) => {
  try {
    const host = new URL(url).host;
    cdnFailureUntil.set(host, Date.now() + CDN_FAIL_COOLDOWN_MS);
  } catch (e) {}
};

const isCDNInCooldown = (url) => {
  try {
    const host = new URL(url).host;
    const until = cdnFailureUntil.get(host) || 0;
    if (until <= Date.now()) {
      cdnFailureUntil.delete(host);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

const joinCDNUrl = (base, tailPath) => {
  if (!base) return null;
  if (!tailPath) return base;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanTail = tailPath.startsWith('/') ? tailPath : '/' + tailPath;
  return cleanBase + cleanTail;
};

const createPromiseAny = () => {
  if (Promise.any) return;
  Promise.any = (promises) => {
    return new Promise((resolve, reject) => {
      let errors = [];
      let pending = promises.length;
      promises.forEach((p) => {
        Promise.resolve(p).then(resolve).catch((e) => {
          errors.push(e);
          if (--pending === 0) {
            reject(new AggregateError(errors, 'All promises rejected'));
          }
        });
      });
    });
  };
};

function fetchParallel(urls, reqInit = {}, timeoutMs = CDN_RACE_TIMEOUT_MS) {
  const abortEvent = "abortOtherInstance";
  const eventTarget = new EventTarget();

  return urls.map(url => {
    const controller = new AbortController();
    let tagged = false;

    const onAbort = () => {
      if (!tagged) controller.abort();
    };
    eventTarget.addEventListener(abortEvent, onAbort);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!tagged) {
          controller.abort();
          reject(new Error("Timeout"));
        }
      }, timeoutMs);

      fetch(new Request(url, reqInit), { signal: controller.signal }).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          tagged = true;
          eventTarget.dispatchEvent(new Event(abortEvent));
          resolve(res);
        } else {
          markCDNFailed(url);
          reject(new Error("Bad response"));
        }
      }).catch(err => {
        if (err.name !== 'AbortError') markCDNFailed(url);
        reject(err);
      }).finally(() => {
        clearTimeout(timer);
        eventTarget.removeEventListener(abortEvent, onAbort);
      });
    });
  });
}

const FetchEngine = async (urls, reqInit = {}, timeoutMs = CDN_RACE_TIMEOUT_MS) => {
  if (!urls || urls.length === 0) throw new Error('empty urls');
  createPromiseAny();
  return Promise.any(fetchParallel(urls, reqInit, timeoutMs));
};

const matchCDN = async (req) => {
  try {
    if (shouldBypassCDNRace()) {
      return fetch(req);
    }

    const reqUrl = req.url;
    const matched = cdn_match_list.find((item) => item.regexp.test(reqUrl));
    if (!matched || !matched.type || !matched.base) {
      return fetch(req);
    }

    const pathType = matched.type;
    const pathTestRes = matched.base;
    const tailPath = reqUrl.replace(pathTestRes, '');
    const mirrorUrls = Object.values(cdn[pathType])
      .filter(Boolean)
      .map(base => joinCDNUrl(base, tailPath))
      .filter(Boolean)
      .filter((url, index, arr) => arr.indexOf(url) === index)
      .filter((url) => url !== reqUrl)
      .filter((url) => !isCDNInCooldown(url));

    const urls = [reqUrl, ...mirrorUrls].slice(0, CDN_RACE_LIMIT);

    if (urls.length === 0) {
      return fetch(req);
    }

    return await FetchEngine(urls, {
      method: req.method,
      mode: req.mode,
      credentials: req.credentials,
      redirect: req.redirect,
      referrer: req.referrer,
      referrerPolicy: req.referrerPolicy,
      integrity: req.integrity,
    });
  } catch (e) {
    logger.warn('[matchCDN] race failed, fallback to native fetch', {
      url: req && req.url,
      message: e && e.message,
      errors: e && e.errors ? e.errors.map(err => err && err.message ? err.message : String(err)).slice(0, 5) : [],
    });
    return fetch(req);
  }
};

/* ==================== Fetch routing ==================== */
const handleFetch = async (event) => {
  const url = event.request.url;

  if (/sw-update-listener\.js$/.test(url)) {
    return fetch(event.request);
  }
  if (
    event.request.headers.has('range') ||
    /\.(mp3|aac|m4a|ogg|wav|flac)$/i.test(url) ||
    /(music\.163\.com|music\.126\.net|qqmusic\.qq\.com)/i.test(url)
  ) {
    return fetch(event.request);
  }

  if (/nocache/.test(url)) return NetworkOnly(event);
  if (isHtmlRequest(event.request)) return NetworkFirst(event);
  if (/@latest/.test(url)) return CacheFirst(event);

  if (isCDNUrl(url)) {
    return CacheRuntime(event, matchCDN);
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

/* ==================== Message listener ==================== */
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    logger.info('SKIP_WAITING received');
    self.skipWaiting();
  }
  if (event.data.type === 'FORCE_UPDATE') {
    logger.info('FORCE_UPDATE received — starting background update');
    event.waitUntil(cacheNewVersionResources());
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
    testingcf: 'https://testingcf.jsdelivr.net/gh'
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


const cdn_match_list = Object.entries(cdn).flatMap(([type, mirrors]) =>
  Object.values(mirrors).filter(Boolean).map(base => ({
    type,
    base,
    regexp: new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  }))
);

logger.ready('Volantis SW (merged) loaded');
