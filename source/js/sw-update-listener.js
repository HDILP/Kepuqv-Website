(function () {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(registration => {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    const promptNewVersion = (worker) => {
      VolantisApp.question(
        '发现新版本',
        '新版本已经在后台准备好了。\n\n现在刷新，就能立刻用上。',
        {},
        () => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        },
        () => {
          // 用户选择稍后
        }
      );
    };

    // 已存在 waiting 状态（可能是上次访问留下的）
    if (registration.waiting) {
      promptNewVersion(registration.waiting);
    }

    // 监听后续更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          promptNewVersion(newWorker);
        }
      });
    });
  });
})();