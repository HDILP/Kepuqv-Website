(function () {
  if (!('serviceWorker' in navigator)) return;

  iziToast.settings({
    timeout: 0,
    close: false,
    position: 'topCenter',
    zindex: 99999
  });

  let updateTriggered = false;

  navigator.serviceWorker.ready.then(reg => {
    if (updateTriggered) return;
    updateTriggered = true;

    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'FORCE_UPDATE' });
    }
  });

    let refreshing = false;
    let doneShown = false;
    const PROG_TOAST_CLASS = 'sw-update-progress-toast';

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }, { once: true });

    function showUpdateToast(title, message) {
      if (doneShown) return;
      doneShown = true;
      
      // 强制清理进度条
      const old = document.querySelector('.' + PROG_TOAST_CLASS);
      if (old) iziToast.destroy();

      iziToast.show({
        title: title || '发现新版本',
        message: message || '新资源已准备就绪，点击刷新应用。',
        buttons: [
          ['<button><b>立即刷新</b></button>', (instance, toast) => {
            instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
            navigator.serviceWorker.getRegistration().then(reg => {
              if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              else window.location.reload();
            });
            setTimeout(() => { if (!refreshing) window.location.reload(); }, 1500);
          }, true],
          ['<button>忽略</button>', (instance, toast) => {
            instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
          }]
        ]
      });
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'UPDATE_STARTED' && !doneShown) {
        iziToast.show({
          class: PROG_TOAST_CLASS,
          message: `
            <div style="min-width:200px;">
              <div style="font-weight:bold; margin-bottom:5px;">正在后台更新资源...</div>
              <div style="background: rgba(0,0,0,0.1); height:6px; border-radius:4px; overflow:hidden;">
                <div class="sw-update-bar" style="width:0%; height:100%; background:#42b983; transition: width 0.3s;"></div>
              </div>
              <div class="sw-update-text" style="font-size:12px; margin-top:4px; text-align:right;">0%</div>
            </div>`
        });
      } else if (data.type === 'UPDATE_PROGRESS') {
        const toastEl = document.querySelector('.' + PROG_TOAST_CLASS);
        if (toastEl) {
          const bar = toastEl.querySelector('.sw-update-bar');
          const txt = toastEl.querySelector('.sw-update-text');
          const pct = data.progress || 0;
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = pct + '%';
        }
      } else if (data.type === 'NEW_VERSION_CACHED') {
        // 关键修复：先销毁进度条再弹窗
        const p = document.querySelector('.' + PROG_TOAST_CLASS);
        if (p) iziToast.hide({ transitionOut: 'fadeOutUp' }, p);
        showUpdateToast();
      }
    });
})();
