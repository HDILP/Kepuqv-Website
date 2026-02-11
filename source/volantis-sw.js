/* Volantis Service Worker
 * 目标：版本隔离、可观测更新、平滑切换。
 */

const SW_PREFIX = 'volantis-community';
const cacheSuffixVersion = '00000018-::cacheSuffixVersion::'; // 构建时替换
const ACTIVE_VERSION = cacheSuffixVersion;

const PRECACHE_NAME = `${SW_PREFIX}-v${ACTIVE_VERSION}-precache`;
const RUNTIME_NAME = `${SW_PREFIX}-v${ACTIVE_VERSION}-runtime`;

const DEBUG = true;
const PRECACHE_ASSETS = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/js/search/hexo.js',
];

const UPDATE_CONCURRENCY = 3;
const CDN_RACE_LIMIT = 3;
const CDN_RACE_TIMEOUT_MS = 5000;
const CDN_FAIL_COOLDOWN_MS = 5 * 60 * 1000;

const logger = (() => {
  if (!DEBUG) return { info: () => {}, warn: () => {}, error: () => {} };
  return {
    info: (...args) => console.log('%c[SW]', 'color:#2196F3;font-weight:bold;', ...args),
    warn: (...args) => console.warn('%c[SW]', 'color:#FF9800;font-weight:bold;', ...args),
    error: (...args) => console.error('%c[SW]', 'color:#F44336;font-weight:bold;', ...args),
  };
})();

let hintedNextVersion = ACTIVE_VERSION;
let updateJobPromise = null;
const extraPendingUrls = new Set();
const cdnFailureUntil = new Map();

const cacheNameFor = (version, type) => `${SW_PREFIX}-v${version}-${type}`;
const cleanPath = (url) => {
  const stripped = String(url || '').trim().split('#')[0];
  if (!stripped || stripped.startsWith('data:') || stripped.startsWith('javascript:') || stripped.startsWith('mailto:')) return null;
  if (/^https?:\/\//i.test(stripped)) return stripped;
  if (stripped.startsWith('//')) return `https:${stripped}`;
  const relative = stripped.startsWith('./') ? stripped.slice(1) : stripped;
  return relative.startsWith('/') ? relative : `/${relative}`;
};

const isHtmlRequest = (request) => {
  const accept = request.headers.get('accept') || '';
  return request.mode === 'navigate' || accept.includes('text/html');
};

const isBingWallpaperRequest = (url) => /\/bing(?:-wallpaper)?\//i.test(url.pathname) || /HPImageArchive/i.test(url.href);
const isListenerScript = (url) => /\/js\/sw-update-listener\.js(?:\?|$)/.test(url.pathname + url.search);
const isAudioRequest = (request, url) => request.headers.has('range') || /\.(mp3|aac|m4a|ogg|wav|flac)$/i.test(url.pathname) || /(music\.163\.com|music\.126\.net|qqmusic\.qq\.com)/i.test(url.hostname);

const CDN_URL_REGEXP = /(cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|gcore\.jsdelivr\.net|testingcf\.jsdelivr\.net|unpkg\.com|npm\.elemecdn\.com|cdnjs\.cloudflare\.com)/i;
const isCDNUrl = (url) => CDN_URL_REGEXP.test(url);

async function sendMessageToAllClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach((client) => {
    try {
      client.postMessage(message);
    } catch (_) {
      // ignore
    }
  });
}

async function putSafe(cacheName, req, res) {
  if (!res) return;
  const cache = await caches.open(cacheName);
  await cache.put(req, res.clone());
}

async function parseLatestHomeAssets(version) {
  const result = new Set();
  const req = new Request(`/?sw_update=${encodeURIComponent(version)}`, { cache: 'no-store', credentials: 'same-origin' });
  const res = await fetch(req);
  if (!res.ok) return result;

  const html = await res.text();
  const regexp = /(?:href|src)=['"]([^'"\s>]+)['"]/g;
  let matched;
  while ((matched = regexp.exec(html)) !== null) {
    const url = cleanPath(matched[1]);
    if (!url) continue;
    if (/^https?:\/\//i.test(url) && !isCDNUrl(url)) continue;
    result.add(url);
  }
  return result;
}

async function fetchAndCacheForVersion(url, version) {
  const normalized = cleanPath(url);
  if (!normalized) throw new Error('invalid url');

  const cacheKey = new Request(normalized, { credentials: 'same-origin' });
  const requestUrl = /^https?:\/\//i.test(normalized)
    ? normalized
    : `${normalized}${normalized.includes('?') ? '&' : '?'}sw_update=${encodeURIComponent(version)}`;

  const fetchReq = new Request(requestUrl, { cache: 'no-store', credentials: 'same-origin' });
  const response = isCDNUrl(fetchReq.url) ? await matchCDN(fetchReq) : await fetch(fetchReq);
  if (!response || (!response.ok && response.type !== 'opaque')) {
    throw new Error(`bad response: ${response ? response.status : 'EMPTY'}`);
  }

  await Promise.all([
    putSafe(cacheNameFor(version, 'precache'), cacheKey, response),
    putSafe(cacheNameFor(version, 'runtime'), cacheKey, response),
  ]);
}

async function cacheNewVersionResources() {
  if (updateJobPromise) return updateJobPromise;

  updateJobPromise = (async () => {
    const version = hintedNextVersion || ACTIVE_VERSION;
    await sendMessageToAllClients({ type: 'UPDATE_STARTED', version });

    const assets = new Set(PRECACHE_ASSETS.map(cleanPath).filter(Boolean));
    extraPendingUrls.forEach((u) => {
      const clean = cleanPath(u);
      if (clean) assets.add(clean);
    });

    try {
      const latestAssets = await parseLatestHomeAssets(version);
      latestAssets.forEach((u) => assets.add(u));
    } catch (err) {
      logger.warn('parse latest homepage failed:', err);
    }

    const list = Array.from(assets);
    const total = list.length;
    if (total === 0) {
      await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED', version, total: 0 });
      return;
    }

    let done = 0;
    let success = 0;
    const failedAssets = [];

    for (let i = 0; i < list.length; i += UPDATE_CONCURRENCY) {
      const batch = list.slice(i, i + UPDATE_CONCURRENCY);
      await Promise.all(batch.map(async (url) => {
        try {
          await fetchAndCacheForVersion(url, version);
          success += 1;
        } catch (err) {
          failedAssets.push(url);
          logger.warn('[FORCE_UPDATE] cache failed:', url, err && err.message ? err.message : err);
        } finally {
          done += 1;
          await sendMessageToAllClients({
            type: 'UPDATE_PROGRESS',
            version,
            done,
            total,
            success,
            failed: failedAssets.length,
            progress: Math.round((done / total) * 100),
          });
        }
      }));
    }

    if (failedAssets.length === 0) {
      await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED', version, total });
      return;
    }

    await sendMessageToAllClients({
      type: 'UPDATE_FAILED',
      version,
      total,
      success,
      failed: failedAssets.length,
      failedAssets: failedAssets.slice(0, 20),
      noRetry: true,
    });
  })().finally(() => {
    updateJobPromise = null;
  });

  return updateJobPromise;
}

async function clearOutdatedCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => {
    if (!key.startsWith(`${SW_PREFIX}-v`)) return Promise.resolve(false);
    if (key === PRECACHE_NAME || key === RUNTIME_NAME) return Promise.resolve(false);
    return caches.delete(key);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE_NAME);
    for (const url of PRECACHE_ASSETS) {
      try {
        const req = new Request(url, { cache: 'no-store', credentials: 'same-origin' });
        const res = await fetch(req);
        if (res && res.ok) {
          await cache.put(new Request(cleanPath(url), { credentials: 'same-origin' }), res.clone());
        }
      } catch (err) {
        logger.warn('[install] precache failed:', url, err);
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await clearOutdatedCaches();
    await self.clients.claim();
  })());
});

async function networkOnly(request) {
  return fetch(request);
}

async function staleWhileRevalidate(event, cacheName, networkRequest) {
  const request = networkRequest || event.request;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const updateFromNetwork = async () => {
    const fresh = await fetch(new Request(request, { cache: 'no-store' }));
    if (fresh && fresh.ok) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  };

  if (cached) {
    event.waitUntil(updateFromNetwork().catch(() => null));
    return cached;
  }

  return updateFromNetwork();
}

async function cacheFirst(request, cacheName, fetcher = fetch) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetcher(request);
  if (res && (res.ok || res.type === 'opaque')) {
    await cache.put(request, res.clone());
  }
  return res;
}

function shouldBypassCDNRace() {
  const connection = self.navigator && self.navigator.connection;
  if (!connection) return false;
  return Boolean(connection.saveData) || /2g/i.test(String(connection.effectiveType || ''));
}

function markCDNFailed(url) {
  try {
    const host = new URL(url).host;
    cdnFailureUntil.set(host, Date.now() + CDN_FAIL_COOLDOWN_MS);
  } catch (_) {
    // noop
  }
}

function isCDNInCooldown(url) {
  try {
    const host = new URL(url).host;
    const until = cdnFailureUntil.get(host) || 0;
    if (until <= Date.now()) {
      cdnFailureUntil.delete(host);
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function joinCDNUrl(base, tailPath) {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const t = tailPath.startsWith('/') ? tailPath : `/${tailPath}`;
  return `${b}${t}`;
}

function raceFetch(urls, templateRequest) {
  const controllers = [];
  let settled = false;

  const abortOthers = () => {
    controllers.forEach((controller) => controller.abort());
  };

  return Promise.any(urls.map((url) => {
    const controller = new AbortController();
    controllers.push(controller);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('timeout'));
      }, CDN_RACE_TIMEOUT_MS);

      fetch(new Request(url, {
        method: templateRequest.method,
        mode: templateRequest.mode,
        credentials: templateRequest.credentials,
        redirect: templateRequest.redirect,
        referrer: templateRequest.referrer,
        referrerPolicy: templateRequest.referrerPolicy,
        integrity: templateRequest.integrity,
      }), { signal: controller.signal }).then((res) => {
        clearTimeout(timeoutId);
        if (!res || (!res.ok && res.type !== 'opaque')) {
          markCDNFailed(url);
          reject(new Error('bad response'));
          return;
        }
        if (!settled) {
          settled = true;
          abortOthers();
        }
        resolve(res);
      }).catch((err) => {
        clearTimeout(timeoutId);
        if (err && err.name !== 'AbortError') {
          markCDNFailed(url);
        }
        reject(err);
      });
    });
  }));
}

async function matchCDN(request) {
  if (shouldBypassCDNRace()) return fetch(request);

  const reqUrl = request.url;
  const matched = cdnMatchList.find((item) => item.regexp.test(reqUrl));
  if (!matched) return fetch(request);

  const tailPath = reqUrl.replace(matched.base, '');
  const mirrorUrls = Object.values(cdn[matched.type])
    .filter(Boolean)
    .map((base) => joinCDNUrl(base, tailPath))
    .filter((url, i, arr) => arr.indexOf(url) === i)
    .filter((url) => url !== reqUrl)
    .filter((url) => !isCDNInCooldown(url));

  const urls = [reqUrl, ...mirrorUrls].slice(0, CDN_RACE_LIMIT);
  try {
    return await raceFetch(urls, request);
  } catch (err) {
    logger.warn('[CDN] race failed, fallback native fetch:', err && err.message ? err.message : err);
    return fetch(request);
  }
}

async function handleFetch(event) {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return fetch(request);

  if (isListenerScript(url)) {
    return fetch(new Request(request, { cache: 'no-store' }));
  }

  if (isAudioRequest(request, url)) {
    return networkOnly(request);
  }

  if (url.searchParams.has('nocache') || url.searchParams.has('_sw_refresh')) {
    return networkOnly(new Request(request, { cache: 'reload' }));
  }

  if (isHtmlRequest(request)) {
    const htmlRequest = new Request(request.url, { cache: 'no-store', credentials: 'same-origin' });
    return staleWhileRevalidate(event, RUNTIME_NAME, htmlRequest);
  }

  if (isBingWallpaperRequest(url)) {
    return staleWhileRevalidate(event, RUNTIME_NAME, request);
  }

  if (isCDNUrl(url.href)) {
    return cacheFirst(request, RUNTIME_NAME, matchCDN);
  }

  if (/\.(css|js|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot)$/i.test(url.pathname)) {
    return cacheFirst(request, RUNTIME_NAME);
  }

  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  event.respondWith(
    handleFetch(event).catch((err) => {
      logger.error('fetch failed:', err);
      return fetch(event.request).catch(() => new Response('Service Worker Error', { status: 503 }));
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (!data.type) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SET_NEXT_VERSION' && data.version) {
    hintedNextVersion = data.version;
    return;
  }

  if (data.type === 'PRECACHE_URL' && data.url) {
    extraPendingUrls.add(data.url);
    return;
  }

  if (data.type === 'FORCE_UPDATE') {
    event.waitUntil(cacheNewVersionResources());
  }
});

const cdn = {
  gh: {
    jsdelivr: 'https://cdn.jsdelivr.net/gh',
    fastly: 'https://fastly.jsdelivr.net/gh',
    gcore: 'https://gcore.jsdelivr.net/gh',
    testingcf: 'https://testingcf.jsdelivr.net/gh',
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
  },
  cdnjs: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs',
    baomitu: 'https://lib.baomitu.com',
    bootcdn: 'https://cdn.bootcdn.net/ajax/libs',
    bytedance: 'https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M',
    sustech: 'https://mirrors.sustech.edu.cn/cdnjs/ajax/libs',
  },
};

const cdnMatchList = Object.entries(cdn).flatMap(([type, mirrors]) =>
  Object.values(mirrors).filter(Boolean).map((base) => ({
    type,
    base,
    regexp: new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  }))
);

logger.info('Volantis SW loaded:', ACTIVE_VERSION);
