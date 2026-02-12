if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data === 'UPDATE_READY') {
      iziToast.show({
        title: '更新已准备好',
        message: '刷新页面即可体验最新内容',
        position: 'topRight',
        timeout: false,
        close: false,
        class: 'sw-update-toast',
        buttons: [
          ['<button>刷新一下</button>', function (instance, toast) {
            navigator.serviceWorker.controller?.postMessage('SKIP_WAITING')
          }]
        ]
      })
    }
  })
}