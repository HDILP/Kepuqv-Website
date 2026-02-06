(function () {
  if (!('serviceWorker' in navigator)) return;

  iziToast.settings({
    timeout: 0,
    close: false,
    position: 'topCenter',
    transitionIn: 'fadeInDown',
    transitionOut: 'fadeOutUp',
    zindex: 99999
  });

  navigator.serviceWorker.ready.then(registration => {
    let refreshing = false;
    let progressShown = false;
    let doneShown = false;
    const PROG_TOAST_CLASS = 'sw-update-progress-toast';
    const DONE_TOAST_CLASS = 'sw-update-done-toast';

    // 一次性 controllerchange 处理（防止多次触发）
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      // 清理可能残留的 iziToast
      iziToast.destroy();
      // 强制刷新
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });

    function showUpdateToast(title, message) {
      if (doneShown) return;
      doneShown = true;
      const old = document.querySelector('.' + PROG_TOAST_CLASS);
      if (old) iziToast.destroy();

      iziToast.show({
        class: DONE_TOAST_CLASS,
        title: title || '发现新版本',
        message: message || '新资源已准备就绪，点击刷新以应用。',
        buttons: [
          [
            '<button class="iziToast-btn"><b>立即刷新</b></button>',
            (instance, toast) => {
              instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');

              // **用 getRegistration 获取最新 registration 再发送 SKIP_WAITING**
              navigator.serviceWorker.getRegistration().then(function (reg) {
                if (reg && reg.waiting) {
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else if (reg && reg.installing) {
                  // 退一步，尝试对 installing 发消息
                  reg.installing.postMessage({ type: 'SKIP_WAITING' });
                } else if (navigator.serviceWorker.controller) {
                  // 最后尝试向当前 controller 发消息（尽管不一定有用）
                  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
                }
              }).catch(() => {
                // ignore
              });

              // 保底：如果 1.5s 内没有触发 controllerchange，就强制 reload
              setTimeout(() => {
                if (!refreshing) {
                  refreshing = true;
                  iziToast.destroy();
                  window.location.reload();
                }
              }, 1500);
            },
            true
          ],
          [
            '<button>忽略</button>',
            (instance, toast) => {
              instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
            }
          ]
        ]
      });
    }

    // 监听来自 SW 的消息（进度 / 完成）
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'UPDATE_STARTED') {
        if (!progressShown && !doneShown) {
          progressShown = true;
          iziToast.show({
            class: PROG_TOAST_CLASS,
            message: `
              <div style="min-width:200px;">
                <div style="font-weight:bold; margin-bottom:5px;">正在后台更新...</div>
                <div style="background: rgba(0,0,0,0.1); height:6px; border-radius:4px; overflow:hidden;">
                  <div class="sw-update-bar" style="width:0%; height:100%; transition: width 0.3s;"></div>
                </div>
                <div class="sw-update-text" style="font-size:12px; margin-top:4px; text-align:right;">0%</div>
              </div>
            `
          });
        }
      } else if (data.type === 'UPDATE_PROGRESS') {
        const toastEl = document.querySelector('.' + PROG_TOAST_CLASS);
        if (toastEl) {
          const bar = toastEl.querySelector('.sw-update-bar');
          const txt = toastEl.querySelector('.sw-update-text');
          const pct = Math.round((data.cached / data.total) * 100);
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = pct + '%';
        }
      } else if (data.type === 'NEW_VERSION_CACHED') {
        showUpdateToast(data.title, data.message);
      } else if (data.type === 'NEW_ACTIVATED') {
        // 如果 SW 激活时额外发了消息（你在 sw activate 中有发），直接刷新并销毁弹窗
        if (!refreshing) {
          refreshing = true;
          iziToast.destroy();
          window.location.reload();
        }
      }
    });

    // 页面刚打开时，如果已经有 waiting，直接提示（但用 doneShown 防重复）
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting && !doneShown) {
        showUpdateToast('发现新版本', '新版本已在后台就绪，是否刷新？');
      }
    });

    // 标准 updatefound 也保留（但加防重复）
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast('发现新版本', '更新已下载完毕，请刷新。');
        }
      });
    });

  }).catch(()=>{});
})();