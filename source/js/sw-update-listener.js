(function () {
  if (!('serviceWorker' in navigator)) return;

  // iziToast 配置
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
    const PROG_TOAST_CLASS = 'sw-update-progress-toast';
    const DONE_TOAST_CLASS = 'sw-update-done-toast';

    // 1. 监听控制器变化 (Controller Change) - 这是更新成功的标志
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // 2. 显示更新完成提示的函数
    function showUpdateToast(title, message) {
      // 如果已经显示了完成弹窗，不再重复显示
      if (document.querySelector('.' + DONE_TOAST_CLASS)) return;

      // 销毁进度条弹窗
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
              
              // 核心：向 waiting 状态的 worker 发送 skipWaiting 指令
              const waitingWorker = registration.waiting;
              if (waitingWorker) {
                waitingWorker.postMessage({ type: 'SKIP_WAITING' });
              } else {
                // 激进策略：如果找不到 waiting，向所有可能的目标发消息
                if (registration.installing) registration.installing.postMessage({ type: 'SKIP_WAITING' });
                if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
              }

              // 保底策略：如果 3秒内 SW 没有触发 controllerchange 导致重载，则强制刷新
              setTimeout(() => {
                if (!refreshing) {
                  refreshing = true;
                  window.location.reload();
                }
              }, 3000);
            },
            true // Focus
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

    // 3. 监听 SW 发出的消息
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'UPDATE_STARTED') {
        // 只有当没有进度条且没有完成弹窗时才显示进度条
        if (!document.querySelector('.' + PROG_TOAST_CLASS) && !document.querySelector('.' + DONE_TOAST_CLASS)) {
          iziToast.show({
            class: PROG_TOAST_CLASS,
            message: `
              <div style="min-width:200px;">
                <div style="font-weight:bold; margin-bottom:5px;">正在后台更新...</div>
                <div style="background: rgba(0,0,0,0.1); height:6px; border-radius:4px; overflow:hidden;">
                  <div class="sw-update-bar" style="width:0%; height:100%; background: #4caf50; transition: width 0.3s;"></div>
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
      }
    });

    // 4. 检查是否已有等待中的 Worker (处理页面手动刷新后的情况)
    if (registration.waiting) {
      showUpdateToast('发现新版本', '新版本已在后台就绪，是否刷新？');
    }

    // 5. 监听新的安装过程 (标准 API)
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        // 如果安装完成且进入 waiting 状态，说明所有资源已 ready
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast('发现新版本', '更新已下载完毕，请刷新。');
        }
      });
    });

  });
})();
