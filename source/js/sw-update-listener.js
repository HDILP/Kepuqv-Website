(function () {
  if (!('serviceWorker' in navigator)) return;
  if (window.__VOLANTIS_SW_UPDATE_LISTENER_INIT__) return;
  window.__VOLANTIS_SW_UPDATE_LISTENER_INIT__ = true;

  iziToast.settings({
    timeout: 0,
    close: false,
    position: 'topCenter',
    zindex: 99999,
  });

  const PROG_TOAST_CLASS = 'sw-update-progress-toast';
  const READY_TOAST_CLASS = 'sw-update-ready-toast';
  const FAILED_TOAST_CLASS = 'sw-update-failed-toast';

  let nextVersion = null;
  const NO_RETRY_STORE_KEY = '__VOLANTIS_SW_NO_RETRY_FAILED_VERSIONS__';
  const loadNoRetryVersions = () => {
    try {
      const raw = window.localStorage.getItem(NO_RETRY_STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string' && v) : [];
    } catch (e) {
      return [];
    }
  };
  const saveNoRetryVersions = (setObj) => {
    try {
      window.localStorage.setItem(NO_RETRY_STORE_KEY, JSON.stringify(Array.from(setObj).slice(-20)));
    } catch (e) {}
  };

  let activatedByUser = false;
  let preferPjaxReloadAfterActivate = false;

  const isHomePage = () => {
    const path = window.location.pathname;
    return path === '/' || path === '/index.html';
  };

  const pjaxReloadCurrentPage = () => {
    if (!window.pjax || typeof window.pjax.loadUrl !== 'function') {
      window.location.reload();
      return;
    }

    const url = window.location.pathname + window.location.search;
    const connector = url.includes('?') ? '&' : '?';
    const refreshUrl = url + connector + '_sw_refresh=true';

    let finished = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!finished) window.location.reload();
    }, 5000);

    const cleanup = () => {
      finished = true;
      window.clearTimeout(fallbackTimer);
      document.removeEventListener('pjax:complete', onComplete);
      document.removeEventListener('pjax:error', onError);
    };
    const onComplete = () => {
      cleanup();
      // 清理 URL 中的 _sw_refresh 参数，保持地址栏美观
      if (window.history.replaceState) {
        const cleanUrl = window.location.href.replace(/[?&]_sw_refresh=true/, '').replace(/\?$/, '');
        window.history.replaceState({}, '', cleanUrl);
      }
      iziToast.success({
        timeout: 3000,
        title: '刷新完成',
        message: '已通过 PJAX 切换到新版本页面。',
      });
    };
    const onError = () => {
      cleanup();
      window.location.reload();
    };

    document.addEventListener('pjax:complete', onComplete);
    document.addEventListener('pjax:error', onError);
    window.pjax.loadUrl(refreshUrl);
  };

  const extractVersion = (scriptText) => {
    const match = scriptText.match(/cacheSuffixVersion\s*=\s*['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  };

  const hideToast = (className) => {
    const el = document.querySelector('.' + className);
    if (el) iziToast.hide({ transitionOut: 'fadeOutUp' }, el);
  };

  const showProgressToast = () => {
    if (document.querySelector('.' + PROG_TOAST_CLASS)) return;
    iziToast.show({
      class: PROG_TOAST_CLASS,
      message: `
        <div style="min-width:240px;">
          <div style="font-weight:bold; margin-bottom:6px;">正在后台准备新版本...</div>
          <div style="background: rgba(0,0,0,0.1); height:6px; border-radius:4px; overflow:hidden;">
            <div class="sw-update-bar" style="width:0%; height:100%; background:#42b983; transition: width 0.3s;"></div>
          </div>
          <div class="sw-update-text" style="font-size:12px; margin-top:4px; text-align:right;">0%</div>
        </div>`,
    });
  };

  const updateProgressToast = (progress) => {
    showProgressToast();
    const toastEl = document.querySelector('.' + PROG_TOAST_CLASS);
    if (!toastEl) return;
    const bar = toastEl.querySelector('.sw-update-bar');
    const txt = toastEl.querySelector('.sw-update-text');
    const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = pct + '%';
  };

  const sendMessageToWorker = (worker, message) => {
    try {
      if (worker) worker.postMessage(message);
    } catch (e) {}
  };

  const sendVersionHint = (worker) => {
    if (!worker || !nextVersion) return;
    sendMessageToWorker(worker, { type: 'SET_NEXT_VERSION', version: nextVersion });
  };

  const showReadyToast = (registration) => {
    hideToast(PROG_TOAST_CLASS);
    hideToast(READY_TOAST_CLASS);

    iziToast.show({
      class: READY_TOAST_CLASS,
      timeout: 0,
      close: false,
      drag: false,
      overlay: false,
      title: '新版本已就绪',
      message: '所有关键资源已缓存完成。是否立即刷新到新版本？',
      buttons: [
        [
          '<button style="padding:6px 10px;">立即刷新</button>',
          function (instance, toast) {
            activatedByUser = true;
            preferPjaxReloadAfterActivate = isHomePage();
            sendMessageToWorker(registration.waiting, { type: 'SKIP_WAITING' });
            instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
          },
          true,
        ],
        [
          '<button style="padding:6px 10px;">稍后再说</button>',
          function (instance, toast) {
            activatedByUser = false;
            instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
          },
        ],
      ],
    });
  };

  const showFailedToast = (failedCount) => {
    hideToast(PROG_TOAST_CLASS);
    hideToast(FAILED_TOAST_CLASS);
    iziToast.warning({
      class: FAILED_TOAST_CLASS,
      timeout: 8000,
      close: true,
      title: '后台更新未完成',
      message: `有 ${failedCount} 个资源未缓存成功。已停止自动重试，请手动刷新以切换到新版本。`,
    });
  };

  const captureInstallingVersion = (worker) => {
    if (!worker) return;
    fetch(worker.scriptURL, { cache: 'no-store' })
      .then(res => (res && res.ok ? res.text() : null))
      .then(text => {
        if (!text) return;
        nextVersion = extractVersion(text);
        sendVersionHint(worker);
      })
      .catch(() => {});
  };

  const noRetryFailedVersions = new Set(loadNoRetryVersions());

  const triggerBackgroundUpdate = (registration) => {
    const target = registration.waiting || registration.installing;
    if (!target) return;
    if (nextVersion && noRetryFailedVersions.has(nextVersion)) {
      console.warn('[SW-UPDATE] Skip FORCE_UPDATE for failed version (no-retry):', nextVersion);
      return;
    }
    sendVersionHint(target);
    // 告知 SW 预缓存当前页面
    sendMessageToWorker(target, {
      type: 'PRECACHE_URL',
      url: window.location.pathname + window.location.search
    });
    sendMessageToWorker(target, { type: 'FORCE_UPDATE' });
  };

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'UPDATE_STARTED') {
      showProgressToast();
      return;
    }

    if (data.type === 'UPDATE_PROGRESS') {
      updateProgressToast(data.progress || 0);
      return;
    }

    if (data.type === 'NEW_VERSION_CACHED') {
      if (data && data.version && noRetryFailedVersions.has(data.version)) {
        noRetryFailedVersions.delete(data.version);
        saveNoRetryVersions(noRetryFailedVersions);
      }
      navigator.serviceWorker.getRegistration().then(registration => {
        if (!registration || !registration.waiting) return;
        showReadyToast(registration);
      });
      return;
    }

    if (data.type === 'UPDATE_FAILED') {
      if (data && data.version && data.noRetry) {
        noRetryFailedVersions.add(data.version);
        saveNoRetryVersions(noRetryFailedVersions);
        console.warn('[SW-UPDATE] Background cache failed; no auto-retry. Refresh manually to activate new version.', {
          version: data.version,
          failed: data.failed || 1,
          failedAssets: data.failedAssets || [],
        });
      }
      showFailedToast(data.failed || 1);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!activatedByUser) return;
    if (preferPjaxReloadAfterActivate && isHomePage()) {
      pjaxReloadCurrentPage();
      return;
    }
    window.location.reload();
  });

  navigator.serviceWorker.ready.then((registration) => {
    if (!registration) return;

    if (registration.waiting) {
      captureInstallingVersion(registration.waiting);
      triggerBackgroundUpdate(registration);
    }

    registration.update().catch(() => {});

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      captureInstallingVersion(worker);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          navigator.serviceWorker.getRegistration().then(reg => {
            if (!reg) return;
            triggerBackgroundUpdate(reg);
          });
        }
      });
    });
  });
})();
