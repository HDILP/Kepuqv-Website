/* =====================================================
   Volantis Service Worker (Final Optimized Version)
   ===================================================== */
const prefix = 'volantis-community';
const cacheSuffixVersion = '00000018-::cacheSuffixVersion::';
const CACHE_NAME = prefix + '-v' + cacheSuffixVersion;
const debug = true; // 发布时请设为 false

const PreCachlist = [
  "/css/style.css",
  "/js/app.js",
  "/js/search/hexo.js",
  "/", // 确保根目录被预缓存
];

/* =====================================================
   1. 工具函数与路径统一 (Key Management)
   ===================================================== */
const fullPath = (url) => {
  try {
    const urlObj = new URL(url, self.location.origin);
    let path = urlObj.pathname;

    // 只对站内链接进行路径补全，避免误伤外部 CDN
    if (urlObj.origin === self.location.origin) {
      if (path.endsWith('/')) {
        path += 'index.html';
      } else {
        const last = path.split('/').pop();
        if (last && !last.includes('.')) path += '/index.html';
      }
    }
    
    return `${urlObj.origin}${path}`;
  } catch (e) { return url; }
};

// 统一生成带标准化路径的 Request
const requestFor = (url) => new Request(fullPath(url));

const logger = {
  info: (...args) => console.log(`[SW]`, ...args),
  ready: (...args) => console.log(`%c[SW]`, 'color:#42b983;font-weight:bold;', ...args),
  warn: (...args) => console.warn(`[SW]`, ...args),
  error: (...args) => console.error(`[SW]`, ...args),
};

/* =====================================================
   2. 数据库与动态更新逻辑
   ===================================================== */
const DB_NAME = prefix + '-db'; // 持久化 DB，不随版本销毁

const db = {
  read: async (key) => {
    try {
      const cache = await caches.open(DB_NAME); // 使用独立的持久库
      const res = await cache.match(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`));
      return res ? res.text() : null;
    } catch (e) {
      logger.error('db.read error:', e);
      return null;
    }
  },
  write: async (key, value) => {
    try {
      const cache = await caches.open(DB_NAME); // 使用独立的持久库
      return cache.put(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`), new Response(value));
    } catch (e) {
      logger.error('db.write error:', e);
    }
  }
};

const cacheNewVersionResources = async (cache) => {
  try {
    await sendMessageToAllClients({ type: 'UPDATE_STARTED' });

    let latestList = [];
    const txt = await (async () => {
      try {
        const dbCache = await caches.open(DB_NAME);
        const res = await dbCache.match(new Request(`https://LOCALCACHE/latest-list`));
        return res ? await res.text() : null;
      } catch (e) { return null; }
    })();
    
    if (txt) latestList = JSON.parse(txt);

    const total = latestList.length;
    if (total === 0) {
      await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED' });
      return;
    }

    let done = 0;
    const MAX_CONCURRENT = 3; // 适度恢复并发
    
    for (let i = 0; i < latestList.length; i += MAX_CONCURRENT) {
      const batch = latestList.slice(i, i + MAX_CONCURRENT).map(async (url) => {
        try {
          const res = await fetch(requestFor(url));
          if (res.ok) await cache.put(requestFor(url), res.clone());
        } catch (e) {}
        done++;
        await sendMessageToAllClients({ 
          type: 'UPDATE_PROGRESS', 
          progress: Math.round((done / total) * 100) 
        });
      });
      await Promise.all(batch);
    }
    await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED' });
  } catch (e) { 
    logger.error('Dynamic cache error:', e);
    await sendMessageToAllClients({ type: 'NEW_VERSION_CACHED' }); // 失败也要关进度条
  }
};

/* =====================================================
   3. 生命周期 (Install / Activate)
   ===================================================== */
self.addEventListener('install', event => {
  logger.info('Service Worker installing...');
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME + "-precache");
      logger.info(`Precaching ${PreCachlist.length} files...`);
      
      // 并发下载，防止串行阻塞（每批 5 个）
      const MAX_CONCURRENT = 2;
      for (let i = 0; i < PreCachlist.length; i += MAX_CONCURRENT) {
        const batch = PreCachlist.slice(i, i + MAX_CONCURRENT).map(async (url) => {
          const req = requestFor(url);
          const matched = await cache.match(req);
          if (!matched) {
            try {
              const res = await fetch(req);
              if (res.ok) {
                await cache.put(req, res.clone());
                logger.ready(`Precached: ${url}`);
              } else {
                logger.warn(`Failed to precache ${url}: HTTP ${res.status}`);
              }
            } catch (e) { 
              logger.warn(`Failed to precache ${url}:`, e); 
            }
          } else {
            logger.info(`Already cached: ${url}`);
          }
        });
        await Promise.all(batch);
      }
      
      logger.ready('Precache complete.');
      // 移除自动 skipWaiting，由用户点击"立即刷新"按钮触发
      // self.skipWaiting();
    } catch (e) {
      logger.error('Install error:', e);
    }
  })());
});

self.addEventListener('activate', event => {
  logger.info('Service Worker activating...');
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => {
        // 白名单：保护持久化数据库不被清理
        if (!key.includes(cacheSuffixVersion) && key !== DB_NAME) {
          logger.info(`Deleting old cache: ${key}`);
          return caches.delete(key);
        }
      }));
      
      await self.clients.claim();
      
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach(w => {
        try { w.postMessage({ type: 'SW_ACTIVATED' }); } catch (e) {}
      });
      
      logger.ready('Activated and claimed clients.');
    } catch (e) {
      logger.error('Activate error:', e);
    }
  })());
});

/* =====================================================
   4. 缓存策略 (Cache Strategies)
   ===================================================== */
const NetworkOnly = async (event) => {
  try {
    return await fetch(event.request);
  } catch (e) {
    logger.warn('NetworkOnly failed:', e);
    return new Response('Offline', { status: 503 });
  }
};

const CacheFirst = async (event) => {
  const req = requestFor(event.request.url);
  const cached = await caches.match(req);
  if (cached) {
    logger.info(`Cache hit: ${event.request.url}`);
    return cached;
  }
  
  try {
    const res = await fetch(event.request);
    if (res.ok) {
      const cache = await caches.open(CACHE_NAME + "-runtime");
      cache.put(req, res.clone()); // 不阻塞返回
    }
    return res;
  } catch (e) {
    logger.error(`CacheFirst failed for ${event.request.url}:`, e);
    return new Response('Network error', { status: 504 });
  }
};

const CacheAlways = async (event) => {
  const req = requestFor(event.request.url);
  const cache = await caches.open(CACHE_NAME + "-runtime");
  const cached = await cache.match(req);
  if (cached) return cached;
  
  try {
    const res = await fetch(event.request);
    // 增加对 opaque 响应的保护（跨域资源）
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    logger.error(`CacheAlways failed for ${event.request.url}:`, e);
    // 返回一个合适的错误响应而不是抛出异常
    return new Response('Network error', { status: 504 });
  }
};

// Bing 专用：Stale-While-Revalidate (秒开 + 静默更新)
const BingCache = async (event) => {
  const cache = await caches.open(CACHE_NAME + "-runtime");
  const req = requestFor('/bing.jpg'); // 统一存为 bing.jpg
  const cached = await cache.match(req);

  // 后台更新任务（可选延迟）
  const updateTask = async (withDelay = true) => {
    try {
      if (withDelay) await new Promise(r => setTimeout(r, 2000)); // 避开首屏闪烁
      const res = await fetch(event.request);
      if (res.ok) await cache.put(req, res.clone());
      return res;
    } catch (e) { 
      logger.warn('BingCache background update failed:', e);
      return null; 
    }
  };

  if (cached) {
    event.waitUntil(updateTask(true)); // 有缓存时，后台静默延迟更新
    return cached; // 立即返回缓存
  }

  // 没缓存时，立即请求，失败时兜底到原始 fetch
  return updateTask(false).then(res => res || fetch(event.request));
};

/* =====================================================
   5. Fetch 路由与 CDN 并发
   ===================================================== */
const handleFetch = async (event) => {
  const url = event.request.url;
  
  // nocache 强制走网络
  if (/nocache/.test(url)) return NetworkOnly(event);
  
  // @latest 标记的资源优先缓存
  if (/@latest/.test(url)) return CacheFirst(event);
  
  // Bing 每日图片特殊处理
  if (new URL(url).pathname.includes('bing.jpg') || /bing\.com\/th\?/.test(url)) {
    return BingCache(event);
  }
  
  // 静态资源与 CDN 匹配
  const isStatic = /\.(png|jpg|jpeg|svg|gif|webp|ico|css|js|woff2?|ttf|eot)$/i.test(url);
  const isCDN = /(cdnjs\.cloudflare\.com|jsdelivr\.net|elemecdn\.com|unpkg\.com)/.test(url);

  if (isCDN) return matchCDN(event.request);
  if (isStatic) return CacheAlways(event);
  
  // 默认策略：缓存优先
  return CacheFirst(event);
};

self.addEventListener('fetch', event => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    handleFetch(event).catch(err => {
      logger.error('handleFetch critical error:', err);
      // 最后的兜底：尝试直接 fetch
      return fetch(event.request).catch(() => 
        new Response('Service Worker Error', { status: 503 })
      );
    })
  );
});

/* =====================================================
   6. CDN 并发引擎 (Simplified)
   ===================================================== */
const matchCDN = async (req) => {
  const urlObj = new URL(req.url);
  const urls = [req.url];
  
  // 1. 备选节点逻辑：仅对有备选的域名启用竞速
  let hasAlternative = false;
  if (urlObj.hostname.includes('jsdelivr.net')) {
    urls.push(req.url.replace('cdn.jsdelivr.net', 'fastly.jsdelivr.net'));
    hasAlternative = true;
  }

  // --- 核心优化 A: 针对 unpkg 等单节点资源，直接走简单 Fetch ---
  // 不创建 AbortController，不进入 Promise.any，极大节省内存和连接数
  if (!hasAlternative) {
    // 如果是 unpkg，强制开启低优先级，避开主线程资源争抢
    const fetchOptions = urlObj.hostname.includes('unpkg.com') 
      ? { priority: 'low' } 
      : {};
    return fetch(req, fetchOptions).catch(() => fetch(req));
  }

  // --- 核心优化 B: 竞速模式优化 ---
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 略微缩短超时
  
  const fetchPromises = urls.map((u, index) => 
    fetch(new Request(u), { 
      signal: controller.signal,
      // 核心优化 C: 阶梯启动（如果是备选节点，延迟 50ms 发出）
      // 这能让主节点在极快的情况下直接成功，从而根本不发出第二个网络请求
      priority: index === 0 ? 'high' : 'low' 
    })
      .then(async (res) => {
        if (res.ok) {
          clearTimeout(timeout);
          controller.abort(); 
          return res;
        }
        throw res;
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          logger.warn(`CDN node ${u} failed:`, err.status || err);
        }
        throw err;
      })
  );

  return new Promise((resolve, reject) => {
    let errors = 0;
    fetchPromises.forEach(p => {
      p.then(resolve).catch(() => {
        errors++;
        if (errors === fetchPromises.length) {
          clearTimeout(timeout);
          reject(new Error('All CDN nodes failed'));
        }
      });
    });
  }).catch(() => {
    return fetch(req);
  });
};

/* =====================================================
   7. 消息监听
   ===================================================== */
self.addEventListener('message', (event) => {
  if (!event.data) return;
  
  if (event.data.type === 'SKIP_WAITING') {
    logger.info('SKIP_WAITING received, activating new SW...');
    self.skipWaiting();
  }
  
  if (event.data.type === 'FORCE_UPDATE') {
    logger.info('FORCE_UPDATE received, caching new resources...');
    caches.open(CACHE_NAME + "-precache").then(cache => cacheNewVersionResources(cache));
  }
});
