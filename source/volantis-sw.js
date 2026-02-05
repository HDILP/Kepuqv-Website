// volantis-sw.js (modified)
// sw 并发请求 cdn
const prefix = 'volantis-community';
const cacheSuffixVersion = '00000018-::cacheSuffixVersion::';
const CACHE_NAME = prefix + '-v' + cacheSuffixVersion;
const PreCachlist = [
  "/css/style.css",
  "/js/app.js",
  "/js/search/hexo.js",
];
let debug = false;
const handleFetch = async (event) => {
  const url = event.request.url;
  if (/nocache/.test(url)) {
    return NetworkOnly(event)
  } else if (/@latest/.test(url)) {
    return CacheFirst(event)
  } else if (/cdnjs\.cloudflare\.com/.test(url)) {
    return CacheAlways(event)
  } else if (/music\.126\.net/.test(url)) {
    return CacheAlways(event)
  } else if (/qqmusic\.qq\.com/.test(url)) {
    return CacheAlways(event)
  } else if (/jsdelivr\.net/.test(url)) {
    return CacheAlways(event)
  } else if (/npm\.elemecdn\.com/.test(url)) {
    return CacheAlways(event)
  } else if (/unpkg\.com/.test(url)) {
    return CacheAlways(event)
  } else if (/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico|eot|ttf|woff|woff2)$/.test(url)) {
    return CacheAlways(event)
  } else if (/.*\.(css|js)$/.test(url)) {
    return CacheAlways(event)
  } else {
    return CacheFirst(event)
  }
}
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
}
const cdn_match_list = []
for (const type in cdn) {
  for (const key in cdn[type]) {
    cdn_match_list.push({ type: type, key: cdn[type][key] })
  }
}
const _console = console;
const color = {
  black: '#000000',
  red: '#FF0000',
  green: '#008000',
  yellow: '#FFFF00',
  blue: '#0000FF',
  magenta: '#FF00FF',
  cyan: '#00FFFF',
  white: '#FFFFFF',
};
const add = (...arr) => {
  let fi = [
    []
  ];
  for (let key = 0; key < arr.length; key++) {
    const [first, ...other] = arr[key];
    fi[0] += first;
    fi = fi.concat(other);
  }
  return fi;
};
const createlog = (util) => (...args) => {
  // const fun = _console[util] ? _console[util] : _console.log;
  const fun = util == "error" ? _console[util] : _console.log;
  fun.apply(void 0, args);
};
const creategroup = (util) => (...args) => {
  const fun = _console.groupCollapsed;
  fun.apply(void 0, args);
};
const colorUtils = {
  bold: (str) => {
    if (typeof str === 'string' || typeof str === 'number') {
      return `${str};font-weight: bold;`;
    }
    for (let key = 1; key < str.length; key++) {
      str[key] += `;font-weight: bold;`;
    }
    return str;
  }
};
const colorHash = {
  log: 'black',
  wait: 'cyan',
  error: 'red',
  warn: 'yellow',
  ready: 'green',
  info: 'blue',
  event: 'magenta',
};
const createChalk = (name) => (...str) => {
  if (typeof str[0] === 'object') {
    createlog(name)(...add(colorUtils.bold(colorUtils[colorHash[name]](`[${firstToUpperCase(name)}] `)), ...str));
    return;
  }
  let strArr = str;
  if (typeof str === 'string' || typeof str === 'number') {
    strArr = colorUtils[colorHash[name]](str);
  }
  createlog(name)(...add(colorUtils.bold(colorUtils[colorHash[name]](`[${firstToUpperCase(name)}] `)), strArr));
};
const createChalkBg = (name) => (...str) => {
  if (typeof str[0] === 'object') {
    createlog(name)(...add(colorUtils.bold(colorUtils[`bg${firstToUpperCase(colorHash[name])}`](`[${firstToUpperCase(name)}] `)), ...str));
    return;
  }
  let strArr = str;
  if (typeof str === 'string' || typeof str === 'number') {
    strArr = colorUtils[colorHash[name]](str);
  }
  createlog(name)(...add(colorUtils.bold(colorUtils[`bg${firstToUpperCase(colorHash[name])}`](`[${firstToUpperCase(name)}] `)), strArr));
};
const createChalkGroup = (name) => (...str) => {
  if (typeof str[0] === 'object') {
    creategroup(name)(...add(colorUtils.bold(colorUtils[colorHash[name]](`[${firstToUpperCase(name)}] `)), ...str));
    return;
  }
  let strArr = str;
  if (typeof str === 'string' || typeof str === 'number') {
    strArr = colorUtils[colorHash[name]](str);
  }
  creategroup(name)(...add(colorUtils.bold(colorUtils[colorHash[name]](`[${firstToUpperCase(name)}] `)), strArr));
};
const chalk = {
  group: {
    end: _console.groupEnd
  },
  bg: {}
};
Object.keys(colorHash).forEach(key => {
  chalk[key] = createChalk(key);
  chalk.group[key] = createChalkGroup(key);
  chalk.bg[key] = createChalkBg(key);
});
const firstToUpperCase = (str) => str.toLowerCase().replace(/( |^)[a-z]/g, (L) => L.toUpperCase());
Object.keys(color).forEach(key => {
  colorUtils[key] = (str) => {
    if (typeof str === 'string' || typeof str === 'number') {
      return [`%c${str}`, `color:${color[key]}`];
    }
    for (let i = 1; i < str.length; i++) {
      str[i] += `;color:${color[key]}`;
    }
    return str;
  };
  colorUtils[`bg${firstToUpperCase(key)}`] = (str) => {
    if (typeof str === 'string' || typeof str === 'number') {
      return [`%c${str}`, `padding: 2px 4px; border-radius: 3px; color: ${key === 'white' ? '#000' : '#fff'}; font-weight: bold; background:${color[key]};`];
    }
    for (let i = 1; i < str.length; i++) {
      str[i] += `;padding: 2px 4px; border-radius: 3px; font-weight: bold; background:${color[key]};`;
    }
    return str;
  };
});
self.logger = {
  add,
  ...chalk,
  ...colorUtils,
};

if (!debug) {
  logger = {
    log: () => { },
    wait: () => { },
    error: () => { },
    warn: () => { },
    ready: () => { },
    info: () => { },
    event: () => { },
    group: {
      log: () => { },
      wait: () => { },
      error: () => { },
      warn: () => { },
      ready: () => { },
      info: () => { },
      event: () => { },
      end: () => { },
    },
    bg: {
      log: () => { },
      wait: () => { },
      error: () => { },
      warn: () => { },
      ready: () => { },
      info: () => { },
      event: () => { },
    }
  };
  console.log = () => { };
}

const generate_uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
self.db = {
  read: (key, config) => {
    if (!config) { config = { type: "text" } }
    return new Promise((resolve, reject) => {
      caches.open(CACHE_NAME).then(cache => {
        cache.match(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`)).then(function (res) {
          if (!res) resolve(null)
          res.text().then(text => resolve(text))
        }).catch(() => {
          resolve(null)
        })
      })
    })
  },
  write: (key, value) => {
    return new Promise((resolve, reject) => {
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`), new Response(value));
        resolve()
      }).catch(() => {
        reject()
      })
    })
  }
}
const compareVersion = (a, b) => {
  let v1 = a.split('.');
  let v2 = b.split('.');
  const len = Math.max(v1.length, v2.length);
  while (v1.length < len) {
    v1.push('0');
  }
  while (v2.length < len) {
    v2.push('0');
  }
  for (let i = 0; i < len; i++) {
    const num1 = parseInt(v1[i]);
    const num2 = parseInt(v2[i]);
    if (num1 > num2) {
      return a;
    } else if (num1 < num2) {
      return b;
    }
  }
  return a;
}

/* =====================================================
   新增：动态解析并缓存新版本资源的逻辑 (不硬编码文件列表)
   ===================================================== */
const cacheNewVersionResources = async (cache) => {
  try {
    // 请求新的主页 HTML (加个时间戳防止被老 SW 拦截返回旧 HTML)
    const htmlReq = new Request(`/?t=${Date.now()}`);
    const response = await fetch(htmlReq);
    if (!response || !response.ok) {
      logger.error('[Dynamic Precache] Failed to fetch index.html or non-ok response');
      return;
    }

    const html = await response.text();

    // 简单的正则匹配 HTML 中的 CSS 和 JS 文件
    // 注意：这只能匹配首页源码里显式引入的资源，动态懒加载的无法匹配
    const resourceRegex = /(?:href|src)=["']([^"']+\.(?:css|js))["']/g;
    let match;
    const resourcesToCache = new Set([
      "/", // 缓存主页本身
      ...PreCachlist // 保留原本的手动列表
    ]);

    while ((match = resourceRegex.exec(html)) !== null) {
      const url = match[1];
      // 过滤掉第三方 CDN 链接，只缓存本站资源（如果需要缓存 CDN，去掉 !url.startsWith('http') 判断）
      if (url && !url.startsWith('http') && !url.startsWith('//')) {
        // 把相对路径也标准化为以斜杠开头（如果需要）
        let normalized = url;
        if (!normalized.startsWith('/')) {
          // 相对路径 -> 转成相对根的绝对路径（简单方式）
          if (normalized.startsWith('./')) normalized = normalized.substring(1);
          normalized = '/' + normalized;
        }
        resourcesToCache.add(normalized);
      }
    }

    logger.group.event(`Dynamic Precache: Found ${resourcesToCache.size} files`);

    // 并发缓存（先检查是否已存在再 add）
    const cachePromises = Array.from(resourcesToCache).map(url => {
      const req = new Request(url);
      return cache.match(req).then(res => {
        if (!res) {
          logger.wait(`Background caching: ${url}`);
          return cache.add(req).catch(e => {
            logger.error(`Failed to cache ${url}: ${e}`);
          });
        } else {
          logger.ready(`Already cached: ${url}`);
        }
      }).catch(e => {
        logger.error(`Error checking/caching ${url}: ${e}`);
      });
    });

    await Promise.all(cachePromises);
    logger.ready(`Background update complete.`);
    logger.group.end();

  } catch (err) {
    logger.error(`[Dynamic Precache Error] ${err}`);
  }
};

/* =====================================================
   原有的 installFunction 保留（用于兼容原 precache 行为）
   ===================================================== */
const installFunction = async () => {
  return caches.open(CACHE_NAME + "-precache")
    .then(async function (cache) {
      if (!await db.read('uuid')) {
        await db.write('uuid', generate_uuid())
      }
      if (PreCachlist.length) {
        logger.group.event(`Precaching ${PreCachlist.length} files.`);
        let index = 0;
        PreCachlist.forEach(function (url) {
          cache.match(new Request(url)).then(function (response) {
            if (response) {
              logger.ready(`Precaching ${url}`);
            } else {
              logger.wait(`Precaching ${url}`);
              cache.add(new Request(url));
            }
            index++;
            if (index === PreCachlist.length) {
              logger.ready(`Precached ${PreCachlist.length} files.`);
              logger.group.end();
            }
          })
        })
      }
    }).catch((error) => {
      logger.error('[install] ' + (error.stack || error));
    })
}

/* =====================================================
   修改：Install 事件（不再立即 skipWaiting；先完成后台缓存）
   ===================================================== */
self.addEventListener('install', async function (event) {
  logger.bg.event("service worker install event listening");
  try {
    // 不再 self.skipWaiting()，等待用户确认后前端向 SW 发消息再跳过等待
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME + "-precache");
      // uuid 保持
      if (!await db.read('uuid')) {
        await db.write('uuid', generate_uuid())
      }

      // 1) 依然执行 PreCachlist 的预缓存（同步并发）
      if (PreCachlist.length) {
        logger.group.event(`Precaching ${PreCachlist.length} files.`);
        const precachePromises = PreCachlist.map(async (url) => {
          try {
            const r = await cache.match(new Request(url));
            if (r) {
              logger.ready(`Precaching (exists) ${url}`);
            } else {
              logger.wait(`Precaching: ${url}`);
              await cache.add(new Request(url));
            }
          } catch (e) {
            logger.error(`[install] precache ${url} error: ${e}`);
          }
        });
        await Promise.all(precachePromises);
        logger.ready(`Precached ${PreCachlist.length} files.`);
        logger.group.end();
      }

      // 2) 执行动态缓存逻辑：拉取新版本主页并缓存其引用的资源
      await cacheNewVersionResources(cache);

      // 3) 动态缓存完成后，通知所有页面（window clients）——让页面弹窗提示用户刷新（页面端决定是否调用 SKIP_WAITING）
      try {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        allClients.forEach(client => {
          client.postMessage({
            type: 'NEW_VERSION_CACHED',
            title: '发现新版本',
            message: '已在后台缓存新版本资源。是否现在刷新以使用新版本？',
            // 前端可以据此调用 VolantisApp.question(title, message, option, success, cancel, done)
            // 并在用户确认时向 SW 发送 { type: 'SKIP_WAITING' }。
            // 我们在下面添加了对 SKIP_WAITING 的监听。
            showConfirm: true
          });
        });
      } catch (e) {
        logger.error('[install] notify clients error: ' + e);
      }
    })());
    logger.bg.ready('service worker installed (waiting for activation)');
  } catch (error) {
    logger.error('[install] ' + (error.stack || error));
  }
});

/* =====================================================
   activate & fetch 等事件保持不变（仅作整合）
   ===================================================== */
self.addEventListener('activate', async event => {
  logger.bg.event("service worker activate event listening");
  try {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => {
          if (!key.includes(cacheSuffixVersion)) {
            caches.delete(key);
            logger.bg.ready('Deleted Outdated Cache: ' + key);
          }
        }));
      }).catch((error) => {
        logger.error('[activate] ' + (error.stack || error));
      })
    );
    await self.clients.claim()
    logger.bg.ready('service worker activate sucess!');
  } catch (error) {
    logger.error('[activate] ' + (error.stack || error));
  }
})

self.addEventListener('fetch', async event => {
  event.respondWith(
    handleFetch(event).catch((error) => {
      logger.error('[fetch] ' + event.request.url + '\n[error] ' + (error.stack || error));
    })
  )
});


const NetworkOnly = async (event) => {
  logger.group.info('NetworkOnly: ' + new URL(event.request.url).pathname);
  logger.wait('service worker fetch: ' + event.request.url)
  logger.group.end();
  return fetch(event.request)
}
const CacheFirst = async (event) => {
  return caches.match(event.request).then(function (resp) {
    logger.group.info('CacheFirst: ' + new URL(event.request.url).pathname);
    logger.wait('service worker fetch: ' + event.request.url)
    if (resp) {
      logger.group.ready(`Cache Hit`);
      console.log(resp)
      logger.group.end();
      logger.group.end();
      event.waitUntil(CacheRuntime(event.request))
      return resp;
    } else {
      logger.warn(`Cache Miss`);
      logger.group.end();
      return CacheRuntime(event.request)
    }
  })
}
const CacheAlways = async (event) => {
  return caches.match(event.request).then(function (resp) {
    logger.group.info('CacheAlways: ' + new URL(event.request.url).pathname);
    logger.wait('service worker fetch: ' + event.request.url)
    if (resp) {
      logger.group.ready(`Cache Hit`);
      console.log(resp)
      logger.group.end();
      logger.group.end();
      return resp;
    } else {
      logger.warn(`Cache Miss`);
      logger.group.end();
      return CacheRuntime(event.request)
    }
  })
}

const matchCache = async (event) => {
  return caches.match(event.request).then(function (resp) {
    logger.group.info('service worker fetch: ' + event.request.url)
    if (resp) {
      logger.group.ready(`Cache Hit`);
      console.log(resp)
      logger.group.end();
      logger.group.end();
      return resp;
    } else {
      logger.warn(`Cache Miss`);
      logger.group.end();
      return CacheRuntime(event.request)
    }
  })
}
async function CacheRuntime(request) {
  const url = new URL(request.url);
  let response = await matchCDN(request);
  if (!response) {
    response = await fetch(request).catch(() => null)
  }
  logger.group.event(`Cache Runtime ${url.pathname}`);
  logger.wait(`Caching url: ${request.url}`);
  console.log(response);

  if (request.method === "GET" && (url.protocol == "https:")) {
    const cache = await caches.open(CACHE_NAME + "-runtime");
    cache.put(request, response.clone()).catch(error => {
      logger.error('[Cache Runtime] ' + (error.stack || error));
      if (error.name === 'QuotaExceededError') {
        caches.delete(CACHE_NAME + "-runtime");
        logger.ready("deleted cache")
      }
    })
    logger.ready(`Cached url: ${request.url}`);
  } else {
    logger.warn(`Not Cached url: ${request.url}`);
  }
  logger.group.end();
  return response;
}

const matchCDN = async (req) => {
  const nav = navigator
  const { saveData, effectiveType } = nav.connection || nav.mozConnection || nav.webkitConnection || {}
  if (saveData || /2g/.test(effectiveType)) {
    logger.warn("Slow Network: Transparent Proxy");
    return fetch(req);
  }
  const urls = []
  let urlObj = new URL(req.url)
  let pathType = urlObj.pathname.split('/')[1]
  let pathTestRes = "";

  if (!urls.length) {
    for (const item of cdn_match_list) {
      if (new RegExp(item.key).test(req.url)) {
        pathType = item.type
        pathTestRes = new RegExp(item.key).exec(req.url)[0]
        break;
      }
    }
    for (const type in cdn) {
      if (type === pathType) {
        logger.group.ready(`Match CDN ${pathType}: ` + req.url);
        for (const key in cdn[type]) {
          const url = cdn[type][key] + req.url.replace(pathTestRes, '')
          console.log(url);
          urls.push(url)
        }
        logger.group.end()
      }
    }
  }

  let res;
  if (urls.length)
    res = FetchEngine(urls)
  else
    res = fetch(req)
  return res
}

const fullPath = (url) => {
  url = url.split('?')[0].split('#')[0]
  if (url.endsWith('/')) {
    url += 'index.html'
  } else {
    const list = url.split('/')
    const last = list[list.length - 1]
    if (last.indexOf('.') === -1) {
      url += '.html'
    }
  }
  return url
}
async function progress(res) {
  return new Response(await res.arrayBuffer(), {
    status: res.status,
    headers: res.headers
  })
}

function createPromiseAny() {
  Promise.any = function (promises) {
    return new Promise((resolve, reject) => {
      promises = Array.isArray(promises) ? promises : []
      let len = promises.length
      let errs = []
      if (len === 0) return reject(new AggregateError('All promises were rejected'))
      promises.forEach((p) => {
        if (p instanceof Promise) {
          p.then(
            (res) => resolve(res),
            (err) => {
              len--
              errs.push(err)
              if (len === 0) reject(new AggregateError(errs))
            }
          )
        } else {
          reject(p)
        }
      })
    })
  }
}

function fetchAny(reqs) {
  const controller = new AbortController()

  return reqs.map(req => {
    return new Promise((resolve, reject) => {
      fetch(req, {
        signal: controller.signal
      })
        .then(progress)
        .then(res => {
          controller.abort()
          if (res.status !== 200)
            reject(null)
          else
            resolve(res)
        })
        .catch(() => reject(null))
    })
  })
}

function fetchParallel(reqs) {
  const abortEvent = new Event("abortOtherInstance")
  const eventTarget = new EventTarget();

  return reqs.map(async req => {
    const controller = new AbortController();
    let tagged = false;
    eventTarget.addEventListener(abortEvent.type, () => {
      if (!tagged) controller.abort();
    })
    return new Promise((resolve, reject) => {
      fetch(req, {
        signal: controller.signal,
      }).then(res => {
        tagged = true;
        eventTarget.dispatchEvent(abortEvent)
        if (res.status !== 200)
          reject(null)
        else
          resolve(res)
      }).catch(() => reject(null))
    })
  });
}

const FetchEngine = (reqs) => {
  if (!Promise.any) createPromiseAny();
  return Promise.any(fetchParallel(reqs)).then(res => res)
    .catch((e) => {
      if (e == "AggregateError: All promises were rejected") {
        return Promise.any(fetchAny(reqs))
          .then((res) => res)
          .catch(() => null);
      }
      return null;
    });
};

const getContentType = (ext) => {
  switch (ext) {
    case 'js':
      return 'text/javascript'
    case 'html':
      return 'text/html'
    case 'css':
      return 'text/css'
    case 'json':
      return 'application/json'
    case 'webp':
      return 'image/webp'
    case 'jpg':
      return 'image/jpg'
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'xml':
      return 'text/xml'
    case 'xsl':
      return 'text/xml'
    case 'webmanifest':
      return 'text/webmanifest'
    case 'map':
      return 'application/json'
    case 'bcmap':
      return 'image/vnd.wap.wbmp'
    case 'wbmp':
      return 'image/vnd.wap.wbmp'
    case 'bmp':
      return 'image/bmp'
    case 'ico':
      return 'image/vnd.microsoft.icon'
    case 'tiff':
      return 'image/tiff'
    case 'tif':
      return 'image/tiff'
    case 'svg':
      return 'image/svg+xml'
    case 'svgz':
      return 'image/svg+xml'
    case 'woff':
      return 'application/font-woff'
    case 'woff2':
      return 'application/font-woff2'
    case 'ttf':
      return 'application/font-ttf'
    case 'otf':
      return 'application/font-otf'
    case 'eot':
      return 'application/vnd.ms-fontobject'
    case 'zip':
      return 'application/zip'
    case 'tar':
      return 'application/x-tar'
    case 'gz':
      return 'application/gzip'
    case 'bz2':
      return 'application/x-bzip2'
    case 'rar':
      return 'application/x-rar-compressed'
    case '7z':
      return 'application/x-7z-compressed'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xls':
      return 'application/vnd.ms-excel'
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'ppt':
      return 'application/vnd.ms-powerpoint'
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    case 'pdf':
      return 'application/pdf'
    case 'txt':
      return 'text/plain'
    case 'rtf':
      return 'application/rtf'
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/x-wav'
    case 'ogg':
      return 'audio/ogg'
    case 'mp4':
      return 'video/mp4'
    case 'm4v':
      return 'video/x-m4v'
    case 'mov':
      return 'video/quicktime'
    case 'avi':
      return 'video/x-msvideo'
    case 'wmv':
      return 'video/x-ms-wmv'
    case 'flv':
      return 'video/x-flv'
    case 'swf':
      return 'application/x-shockwave-flash'
    case 'mpg':
      return 'video/mpeg'
    case 'mpeg':
      return 'video/mpeg'
    case 'mpe':
      return 'video/mpeg'
    case 'mpv':
      return 'video/mpeg'
    case 'm2v':
      return 'video/mpeg'
    case 'm4a':
      return 'audio/mp4'
    case 'aac':
      return 'audio/aac'
    case 'm3u':
      return 'audio/x-mpegurl'
    case 'm3u8':
      return 'application/vnd.apple.mpegurl'
    case 'pls':
      return 'audio/x-scpls'
    case 'cue':
      return 'application/x-cue'
    case 'wma':
      return 'audio/x-ms-wma'
    case 'flac':
      return 'audio/flac'
    case 'aif':
      return 'audio/x-aiff'
    case 'aiff':
      return 'audio/x-aiff'
    case 'aifc':
      return 'audio/x-aiff'
    case 'au':
      return 'audio/basic'
    case 'snd':
      return 'audio/basic'
    case 'mid':
      return 'audio/midi'
    case 'midi':
      return 'audio/midi'
    case 'kar':
      return 'audio/midi'
    default:
      return 'text/plain'
  }
}

/* =====================================================
   新增：监听前端发来的 "SKIP_WAITING" 指令
   （前端在用户确认刷新时应发送该消息）
   ===================================================== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    logger.bg.event("User confirmed update, skipping waiting...");
    self.skipWaiting();
  }
});
