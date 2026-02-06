(function () {
  if (!('serviceWorker' in navigator)) return;

  // iziToast 基本设置（topCenter，永不自动关闭）
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
    let progressToastId = null; // 存放当前 progress toast 的 DOM 节点 class 标识
    const PROG_TOAST_CLASS = 'sw-update-progress-toast';
    const DONE_TOAST_CLASS = 'sw-update-done-toast';

    // controllerchange 保底
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    // 接收来自 SW 的消息：UPDATE_STARTED / UPDATE_PROGRESS / NEW_VERSION_CACHED / NEW_ACTIVATED
    navigator.serviceWorker.addEventListener('message', (event) => {
      try {
        const data = event && event.data;
        if (!data || !data.type) return;

        if (data.type === 'UPDATE_STARTED') {
          // 创建持久进度 toast（如果已存在则忽略）
          if (document.querySelector('.' + PROG_TOAST_CLASS) || sessionStorage.getItem('sw_update_confirmed')) return;
          const content = `
            <div style="min-width:280px;">
              <div style="font-weight:600; margin-bottom:6px;">后台正在更新（不会打断你）</div>
              <div style="font-size:13px; opacity:0.9;">已缓存：<span class="sw-update-cached">0</span>/<span class="sw-update-total">0</span> · <span class="sw-update-percent">0%</span></div>
              <div style="margin-top:8px;">
                <div style="background: rgba(0,0,0,0.06); border-radius:8px; height:8px; overflow:hidden;">
                  <div class="sw-update-progress" style="width:0%; height:100%; border-radius:8px; background: linear-gradient(90deg,#ffaab2,#ffb7c4);"></div>
                </div>
              </div>
            </div>
          `;
          iziToast.show({
            class: PROG_TOAST_CLASS,
            timeout: 0,
            close: false,
            overlay: false,
            drag: false,
            message: content,
            onOpening: function(instance, toast){
              // 记录 toast 的 DOM（通过 class 选择器更新）
            }
          });
        } else if (data.type === 'UPDATE_PROGRESS') {
          // 更新进度条与数字
          const pct = (typeof data.percent === 'number') ? data.percent : Math.round((data.cached / data.total) * 100 || 0);
          const cached = data.cached || 0;
          const total = data.total || 0;
          const toastEl = document.querySelector('.' + PROG_TOAST_CLASS);
          if (toastEl) {
            const progressEl = toastEl.querySelector('.sw-update-progress');
            const percentEl = toastEl.querySelector('.sw-update-percent');
            const cachedEl = toastEl.querySelector('.sw-update-cached');
            const totalEl = toastEl.querySelector('.sw-update-total');
            if (progressEl) progressEl.style.width = pct + '%';
            if (percentEl) percentEl.textContent = pct + '%';
            if (cachedEl) cachedEl.textContent = cached;
            if (totalEl) totalEl.textContent = total;
          } else {
            // 如果没有进度 toast（可能页面打开后才开始），则创建一个并立即更新
            iziToast.show({
              class: PROG_TOAST_CLASS,
              timeout: 0,
              close: false,
              overlay: false,
              drag: false,
              message: `
                <div style="min-width:280px;">
                  <div style="font-weight:600; margin-bottom:6px;">后台正在更新（不会打断你）</div>
                  <div style="font-size:13px; opacity:0.9;">已缓存：<span class="sw-update-cached">${cached}</span>/<span class="sw-update-total">${total}</span> · <span class="sw-update-percent">${pct}%</span></div>
                  <div style="margin-top:8px;">
                    <div style="background: rgba(0,0,0,0.06); border-radius:8px; height:8px; overflow:hidden;">
                      <div class="sw-update-progress" style="width:${pct}%; height:100%; border-radius:8px; background: linear-gradient(90deg,#ffaab2,#ffb7c4);"></div>
                    </div>
                  </div>
                </div>
              `
            });
          }
        } else if (data.type === 'NEW_VERSION_CACHED') {
          // 后台缓存完成：把进度 toast 替换为完成确认 toast（若用户已确认过则跳过）
          if (sessionStorage.getItem('sw_update_confirmed')) {
            // 已确认过，直接 ignore（或可直接触发 reload）
            return;
          }

          // 先隐藏进度 toast（如果存在）
          const old = document.querySelector('.' + PROG_TOAST_CLASS);
          if (old) {
            // iziToast 没有官方 API 通过 DOM id 隐藏，这里使用 hideAll 再显示新的（也可以精确查找并移除）
            iziToast.destroy(); // 先清空现有 toast，避免残留
          }

          // 显示完成确认 toast（带两个按钮）
          iziToast.show({
            class: DONE_TOAST_CLASS,
            timeout: 0,
            close: false,
            overlay: false,
            drag: false,
            title: data.title || '发现新版本',
            message: data.message || '已在后台缓存新版本资源，是否现在刷新以使用新版本？',
            buttons: [
              [
                '<button class="iziToast-btn">现在刷新 ✨</button>',
                (instance, toast) => {
                  try {
                    sessionStorage.setItem('sw_update_confirmed', '1');

                    // 通知 waiting worker 跳过等待
                    if (registration && registration.waiting && typeof registration.waiting.postMessage === 'function') {
                      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    } else {
                      // 兼容：向所有 serviceWorker 发送（若传入 worker 则优先）
                      if (navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage) {
                        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
                      }
                    }

                    instance.hide({}, toast, 'button');

                    // 保底：若 5s 内未触发 activation 消息，则强制 reload
                    setTimeout(() => {
                      if (!refreshing) {
                        refreshing = true;
                        location.reload();
                      }
                    }, 5000);
                  } catch (e) {
                    if (!refreshing) {
                      refreshing = true;
                      location.reload();
                    }
                  }
                },
                true
              ],
              [
                '<button class="iziToast-btn">稍后再说</button>',
                (instance, toast) => {
                  instance.hide({}, toast, 'button');
                }
              ]
            ]
          });
        } else if (data.type === 'NEW_ACTIVATED') {
          // SW 激活并接管 -> reload（保底）
          if (!refreshing) {
            refreshing = true;
            location.reload();
          }
        }
      } catch (e) {
        console.warn('[sw-update-listener] message handler error', e);
      }
    });

    // 旧的 updatefound / waiting 检查保留：若 registration.waiting 已存在（上次没处理），显示完成确认
    if (registration && registration.waiting) {
      // 触发与 NEW_VERSION_CACHED 类似的流程（尽量复用消息流程）
      // 这里直接显示完成确认（不会显示 progress）
      if (!sessionStorage.getItem('sw_update_confirmed')) {
        iziToast.show({
          class: DONE_TOAST_CLASS,
          timeout: 0,
          close: false,
          overlay: false,
          drag: false,
          title: '发现新版本',
          message: '新版本已在后台准备好。是否现在刷新以使用新版本？',
          buttons: [
            [
              '<button class="iziToast-btn">现在刷新 ✨</button>',
              (instance, toast) => {
                try {
                  sessionStorage.setItem('sw_update_confirmed', '1');
                  if (registration.waiting && typeof registration.waiting.postMessage === 'function') {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                  }
                  instance.hide({}, toast, 'button');
                  setTimeout(() => {
                    if (!refreshing) {
                      refreshing = true;
                      location.reload();
                    }
                  }, 5000);
                } catch (e) {
                  if (!refreshing) {
                    refreshing = true;
                    location.reload();
                  }
                }
              },
              true
            ],
            [
              '<button class="iziToast-btn">稍后再说</button>',
              (instance, toast) => {
                instance.hide({}, toast, 'button');
              }
            ]
          ]
        });
      }
    }

    // 监听后续更新（保持原逻辑：若安装完成且已有 controller，则提示）
    try {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 如果 SW 发出了 NEW_VERSION_CACHED 会最终触发完成确认；这里作为额外兜底可以显示默认完成提示
            if (!sessionStorage.getItem('sw_update_confirmed')) {
              iziToast.show({
                class: DONE_TOAST_CLASS,
                timeout: 0,
                close: false,
                overlay: false,
                drag: false,
                title: '发现新版本',
                message: '新版本已就绪，是否现在刷新？',
                buttons: [
                  [
                    '<button class="iziToast-btn">现在刷新 ✨</button>',
                    (instance, toast) => {
                      try {
                        sessionStorage.setItem('sw_update_confirmed', '1');
                        if (registration.waiting && typeof registration.waiting.postMessage === 'function') {
                          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                        instance.hide({}, toast, 'button');
                        setTimeout(() => {
                          if (!refreshing) {
                            refreshing = true;
                            location.reload();
                          }
                        }, 5000);
                      } catch (e) {
                        if (!refreshing) {
                          refreshing = true;
                          location.reload();
                        }
                      }
                    },
                    true
                  ],
                  [
                    '<button class="iziToast-btn">稍后再说</button>',
                    (instance, toast) => {
                      instance.hide({}, toast, 'button');
                    }
                  ]
                ]
              });
            }
          }
        });
      });
    } catch (e) {
      console.warn('[sw-update-listener] updatefound listener failed', e);
    }

  }).catch(err => {
    console.warn('[sw-update-listener] navigator.serviceWorker.ready failed', err);
  });
})();