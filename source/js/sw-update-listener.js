(function () {
  if (!('serviceWorker' in navigator)) return;

  // iziToast 默认配置（可按需调整）
  iziToast.settings({
    timeout: 0, // 永不自动关闭（除非我们手动）
    close: false,
    position: 'topRight',
    transitionIn: 'fadeInDown',
    transitionOut: 'fadeOutUp'
  });

  navigator.serviceWorker.ready.then(registration => {
    let refreshing = false;

    // controllerchange 保底：当控制器变化时强制 reload（只执行一次）
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // 监听来自 SW 的消息（SW 在 activate 成功后会发 NEW_ACTIVATED）
    navigator.serviceWorker.addEventListener('message', (event) => {
      try {
        const data = event && event.data;
        if (data && data.type === 'NEW_ACTIVATED') {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        }
      } catch (e) {
        // 忽略消息解析错误
        console.warn('[sw-update-listener] message handler error', e);
      }
    });

    // 弹窗与确认处理
    function showUpdateToast(worker) {
      try {
        // 如果当前 tab 已确认过更新，就不再弹窗（sessionStorage 仅对当前 tab 有效）
        if (sessionStorage.getItem('sw_update_confirmed')) return;

        // 如果同类 toast 已存在，先不再重复弹
        if (document.querySelector('.iziToast.sw-update-toast')) return;

        iziToast.show({
          class: 'sw-update-toast',
          title: '发现新版本',
          message: '新版本已在后台准备好。现在刷新即可立即生效。',
          // timeout: 0, // 全局配置已设为 0
          close: false,
          overlay: false,
          // 自定义按钮
          buttons: [
            [
              // 确认按钮
              '<button aria-label="刷新" class="iziToast-btn btn-refresh">立即刷新</button>',
              function (instance, toast) {
                try {
                  // 标记为已确认，避免同一 tab 重复弹窗
                  sessionStorage.setItem('sw_update_confirmed', '1');

                  // 向 waiting worker 发 SKIP_WAITING（优先使用传入的 worker）
                  if (worker && typeof worker.postMessage === 'function') {
                    worker.postMessage({ type: 'SKIP_WAITING' });
                  } else if (registration && registration.waiting && typeof registration.waiting.postMessage === 'function') {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                  }

                  // 关闭 toast
                  instance.hide({}, toast, 'button');

                  // 超时保底：若 5s 内未被 NEW_ACTIVATED 驱动 reload，则强制 reload（保底）
                  setTimeout(() => {
                    if (!refreshing) {
                      refreshing = true;
                      window.location.reload();
                    }
                  }, 5000);
                } catch (err) {
                  // 出错时直接重载作为 fallback
                  console.error('[sw-update-listener] confirm handler error', err);
                  if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                  }
                }
              },
              true
            ],
            [
              // 稍后按钮
              '<button aria-label="稍后" class="iziToast-btn btn-later">稍后</button>',
              function (instance, toast) {
                // 仅关闭提示，保留 waiting worker
                instance.hide({}, toast, 'button');
              },
              true
            ]
          ]
        });
      } catch (e) {
        console.error('[sw-update-listener] showUpdateToast error', e);
      }
    }

    // 如果已经有 waiting worker（上一次访问留下的），立即提示
    try {
      if (registration && registration.waiting) {
        showUpdateToast(registration.waiting);
      }
    } catch (e) {
      console.warn('[sw-update-listener] check registration.waiting failed', e);
    }

    // 监听后续 updatefound 事件，发现新的 installing worker 时关注其 state
    try {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          try {
            // 当新 worker 完成安装并且当前页面已有 controller（说明是更新而不是首次安装）
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(newWorker);
            }
          } catch (e) {
            console.warn('[sw-update-listener] statechange handler error', e);
          }
        });
      });
    } catch (e) {
      console.warn('[sw-update-listener] addEventListener updatefound failed', e);
    }
  }).catch(err => {
    console.warn('[sw-update-listener] navigator.serviceWorker.ready failed', err);
  });
})();