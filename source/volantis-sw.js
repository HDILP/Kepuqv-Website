// volantis-sw.js — Gradient Update Model (Double Pool)

// 全站打包上传 npm，sw 并发请求 cdn
const prefix = 'volantis-community';
const cacheSuffixVersion = '00000018-::cacheSuffixVersion::';

// 1. 缓存结构设计：双池模型
// CACHE_PRECACHE: 包含核心资源，带版本号，更新时重新构建
const CACHE_PRECACHE = prefix + '-v' + cacheSuffixVersion + '-precache';
// CACHE_RUNTIME: 包含静态资源，全局不带版本号，永久保留（除非配额溢出）
const CACHE_RUNTIME = prefix + '-runtime';

// 2. Precache 列表 (设计稿 V.3)
const PreCachlist = [
  "/",
  "/css/style.css",
  "/js/app.js",
  "/js/search/hexo.js",
  "/css/izitotal.css",
  "https://bing-wallpaper.hdilp.top/bing.jpg"
];

let debug = false;
// location.hostname == 'localhost' && (debug = true);

const handleFetch = async (event) => {
  const url = event.request.url;
  // 6. Fetch 策略：排除更新监听脚本与音频范围请求
  if (/nocache/.test(url) || /sw-update-listener\.js/.test(url)) {
    return NetworkOnly(event)
  } else if (/@latest/.test(url)) {
    return CacheFirst(event)
  } else if (/cdnjs\.cloudflare\.com/.test(url)) {
    return CacheAlways(event)
  } else if (/music\.126\.net/.test(url)) {
    return NetworkOnly(event)
  } else if (/qqmusic\.qq\.com/.test(url)) {
    return NetworkOnly(event)
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

const installFunction = async () => {
  return caches.open(CACHE_PRECACHE) // 使用版本化 Precache
    .then(async function (cache) {
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

self.addEventListener('install', async function (event) {
  logger.bg.event("service worker install event listening");
  try {
    // 5. 更新流程：禁止自动 skipWaiting，等待用户触发
    // self.skipWaiting(); <--- REMOVED
    event.waitUntil(installFunction());
    logger.bg.ready('service worker install sucess!');
  } catch (error) {
    logger.error('[install] ' + (error.stack || error));
  }
});

// 5. 更新流程：监听用户刷新触发的 SKIP_WAITING
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', async event => {
  logger.bg.event("service worker activate event listening");
  try {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => {
          // 5. 更新流程：Activate 阶段只删除旧的 Precache，保留 Runtime
          if (key.includes(prefix) && key.includes('-precache') && key !== CACHE_PRECACHE) {
            caches.delete(key);
            logger.bg.ready('Deleted Outdated Cache: ' + key);
          }
          // Runtime cache (no version in name) persists naturally
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
    // 2. 缓存结构：Runtime 使用全局无版本号缓存池
    const cache = await caches.open(CACHE_RUNTIME);
    cache.put(request, response.clone()).catch(error => {
      logger.error('[Cache Runtime] ' + (error.stack || error));
      if (error.name === 'QuotaExceededError') {
        caches.delete(CACHE_RUNTIME); // Clean global runtime on quota error
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

  let res;
  if (urls.length)
    res = FetchEngine(urls)
  else
    res = fetch(req)

  return res
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
