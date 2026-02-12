/* sw-update-listener.js */
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/volantis-sw.js').then(reg => {
        // 1. 检查是否有处于等待状态的新版本
        if (reg.waiting) {
          showUpdateToast(reg.waiting);
        }

        // 2. 监听安装过程
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            // 只有当新资源完全下载（installed）且页面已有旧版控制时才提示
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(newWorker);
            }
          });
        });
      });

      // 3. 激活后的自动刷新
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  function showUpdateToast(worker) {
    if (typeof iziToast === 'undefined') return;

    iziToast.info({
      theme: 'light',
      class: 'sw-update-toast', // 激活你的 izitotal.css 样式
      title: '发现新版本',
      message: '核心资源已在后台预载完成\n是否现在应用更新以获取最佳体验？',
      position: 'bottomCenter', // 配合你的 translate(-50%, 0) 动画
      timeout: false,
      close: false,
      overlay: true,
      overlayColor: 'rgba(255, 245, 248, 0.4)',
      displayMode: 'once',
      buttons: [
        ['<button class="iziToast-btn"><b>立即刷新</b></button>', function (instance, toast) {
          worker.postMessage('SKIP_WAITING'); // 向 SW 发送跳过等待指令
          instance.hide({ transitionOut: 'fadeOutUp' }, toast, 'button');
        }, true],
        ['<button style="color: #5a3b45; background:none; box-shadow:none; opacity:0.6;">稍后</button>', function (instance, toast) {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
        }]
      ]
    });
  }
})();
