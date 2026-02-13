/* sw-update-listener.js */
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      const pingListenerAlive = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'LISTENER_ALIVE' });
        }
      };
      navigator.serviceWorker.register('/volantis-sw.js').then(reg => {
        // 仍保留 waiting 兜底，处理监听器加载前已完成安装的情况
        if (reg.waiting) {
          showUpdateToast(reg.waiting);
        }

      });

      pingListenerAlive();

      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type !== 'UPDATE_READY') return;
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg && reg.waiting) {
            showUpdateToast(reg.waiting);
          }
        });
      });

      const checkWaitingWorker = () => {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg && reg.waiting) {
            // listener 曾丢过 UPDATE_READY 时，仍可通过 waiting 状态恢复提示
            showUpdateToast(reg.waiting);
          }
        });
      };

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkWaitingWorker();
      });
      setInterval(checkWaitingWorker, 30000);
      setInterval(pingListenerAlive, 30000);

      // 激活后的自动刷新
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        pingListenerAlive();
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  function showUpdateToast(worker) {
    if (typeof iziToast === 'undefined') return;
    if (!worker || worker.state !== 'installed') return;
    if (showUpdateToast.shown) return;
    showUpdateToast.shown = true;

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
      ],
      onClosed: function() {
        showUpdateToast.shown = false;
      }
    });
  }
})();
