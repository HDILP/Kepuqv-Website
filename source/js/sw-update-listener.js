(function () {
  if (!('serviceWorker' in navigator)) return;
  if (window.__VOLANTIS_SW_UPDATE_LISTENER_INIT__) return;
  window.__VOLANTIS_SW_UPDATE_LISTENER_INIT__ = true;

  const PROGRESS_TOAST_CLASS = 'sw-update-progress-toast';
  const READY_TOAST_CLASS = 'sw-update-ready-toast';
  const FAILED_TOAST_CLASS = 'sw-update-failed-toast';
  const NO_RETRY_STORE_KEY = '__VOLANTIS_SW_NO_RETRY_FAILED_VERSIONS__';

  iziToast.settings({
    timeout: 0,
    close: false,
    position: 'topCenter',
    zindex: 99999,
  });

  let activatedByUser = false;
  let preferPjaxReload = false;
  let installingVersion = null;

  const loadNoRetryVersions = () => {
    try {
      const raw = localStorage.getItem(NO_RETRY_STORE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  };

  const saveNoRetryVersions = (versions) => {
    try {
      localStorage.setItem(NO_RETRY_STORE_KEY, JSON.stringify(Array.from(versions).slice(-20)));
    } catch (_) {
      // ignore
    }
  };

  const noRetryVersions = new Set(loadNoRetryVersions());

  const extractVersionFromScript = (scriptText) => {
    const matched = scriptText.match(/cacheSuffixVersion\s*=\s*['"]([^'"]+)['"]/);
    return matched ? matched[1] : null;
  };

  const isHomePage = () => {
    const path = window.location.pathname;
    return path === '/' || path === '/index.html';
  };

  const hideToast = (className) => {
    const el = document.querySelector(`.${className}`);
    if (el) iziToast.hide({ transitionOut: 'fadeOutUp' }, el);
  };

  const showProgressToast = () => {
    if (document.querySelector(`.${PROGRESS_TOAST_CLASS}`)) return;
    iziToast.show({
      class: PROGRESS_TOAST_CLASS,
      message: `
        <div style="min-width:240px;">
          <div style="font-weight:bold; margin-bottom:6px;">正在后台准备新版本...</div>
          <div style="background: rgba(0,0,0,0.1); height:6px; border-radius:4px; overflow:hidden;">
            <div class="sw-update-bar" style="width:0%; height:100%; background:#42b983; transition: width .25s;"></div>
          </div>
          <div class="sw-update-text" style="font-size:12px; margin-top:6px; text-align:right;">0%</div>
        </div>`,
    });
  };

  const updateProgressToast = (progress) => {
    showProgressToast();
    const toast = document.querySelector(`.${PROGRESS_TOAST_CLASS}`);
    if (!toast) return;

    const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    const bar = toast.querySelector('.sw-update-bar');
    const text = toast.querySelector('.sw-update-text');
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `${pct}%`;
  };

  const showFailedToast = (count) => {
    hideToast(PROGRESS_TOAST_CLASS);
    hideToast(FAILED_TOAST_CLASS);

    iziToast.warning({
      class: FAILED_TOAST_CLASS,
      timeout: 8000,
      close: true,
      title: '后台更新未完成',
      message: `有 ${count} 个资源缓存失败，已停止自动重试。你可以手动刷新触发强制更新。`,
    });
  };

  const pjaxReloadCurrentPage = () => {
    if (!window.pjax || typeof window.pjax.loadUrl !== 'function') {
      window.location.reload();
      return;
    }

    const current = window.location.pathname + window.location.search;
    const nextUrl = `${current}${current.includes('?') ? '&' : '?'}_sw_refresh=true`;

    let done = false;
    const fallback = window.setTimeout(() => {
      if (!done) window.location.reload();
    }, 5000);

    const cleanup = () => {
      done = true;
      clearTimeout(fallback);
      document.removeEventListener('pjax:complete', onComplete);
      document.removeEventListener('pjax:error', onError);
    };

    const onComplete = () => {
      cleanup();
      if (window.history.replaceState) {
        const cleanHref = window.location.href.replace(/[?&]_sw_refresh=true/, '').replace(/\?$/, '');
        window.history.replaceState({}, '', cleanHref);
      }
    };

    const onError = () => {
      cleanup();
      window.location.reload();
    };

    document.addEventListener('pjax:complete', onComplete);
    document.addEventListener('pjax:error', onError);
    window.pjax.loadUrl(nextUrl);
  };

  const postMessageToWorker = (worker, message) => {
    if (!worker) return;
    try {
      worker.postMessage(message);
    } catch (_) {
      // ignore
    }
  };

  const showReadyToast = (registration) => {
    hideToast(PROGRESS_TOAST_CLASS);
    hideToast(READY_TOAST_CLASS);

    iziToast.show({
      class: READY_TOAST_CLASS,
      timeout: 0,
      close: false,
      title: '新版本已就绪',
      message: '关键资源已完成缓存。是否立即切换到新版本？',
      buttons: [
        [
          '<button style="padding:6px 10px;">立即刷新</button>',
          (instance, toast) => {
            activatedByUser = true;
            preferPjaxReload = isHomePage();
            postMessageToWorker(registration.waiting, { type: 'SKIP_WAITING' });
            instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
          },
          true,
        ],
        [
          '<button style="padding:6px 10px;">稍后</button>',
          (instance, toast) => {
            activatedByUser = false;
            instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
          },
        ],
      ],
    });
  };

  const captureVersion = (worker) => {
    if (!worker || !worker.scriptURL) return Promise.resolve();

    return fetch(worker.scriptURL, { cache: 'no-store' })
      .then((res) => (res && res.ok ? res.text() : null))
      .then((text) => {
        if (!text) return;
        installingVersion = extractVersionFromScript(text);
      })
      .catch(() => null);
  };

  const triggerBackgroundUpdate = (registration) => {
    const worker = registration.waiting || registration.installing;
    if (!worker) return;

    if (installingVersion && noRetryVersions.has(installingVersion)) {
      console.warn('[SW-UPDATE] Skip FORCE_UPDATE for no-retry version:', installingVersion);
      return;
    }

    if (installingVersion) {
      postMessageToWorker(worker, { type: 'SET_NEXT_VERSION', version: installingVersion });
    }

    postMessageToWorker(worker, { type: 'PRECACHE_URL', url: window.location.pathname + window.location.search });
    postMessageToWorker(worker, { type: 'FORCE_UPDATE' });
  };

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    if (!data.type) return;

    if (data.type === 'UPDATE_STARTED') {
      showProgressToast();
      return;
    }

    if (data.type === 'UPDATE_PROGRESS') {
      updateProgressToast(data.progress || 0);
      return;
    }

    if (data.type === 'NEW_VERSION_CACHED') {
      if (data.version && noRetryVersions.has(data.version)) {
        noRetryVersions.delete(data.version);
        saveNoRetryVersions(noRetryVersions);
      }
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration && registration.waiting) {
          showReadyToast(registration);
        }
      });
      return;
    }

    if (data.type === 'UPDATE_FAILED') {
      if (data.version && data.noRetry) {
        noRetryVersions.add(data.version);
        saveNoRetryVersions(noRetryVersions);
      }
      showFailedToast(data.failed || 1);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!activatedByUser) return;
    if (preferPjaxReload && isHomePage()) {
      pjaxReloadCurrentPage();
      return;
    }
    window.location.reload();
  });

  navigator.serviceWorker.ready.then((registration) => {
    if (!registration) return;

    if (registration.waiting) {
      captureVersion(registration.waiting).then(() => triggerBackgroundUpdate(registration));
    }

    registration.update().catch(() => null);

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;

      captureVersion(worker);
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        navigator.serviceWorker.getRegistration().then((latest) => {
          if (latest) triggerBackgroundUpdate(latest);
        });
      });
    });
  });
})();
