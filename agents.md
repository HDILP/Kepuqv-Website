# agents.md

## 两个关键文件路径：
- service worker (/source/volantis-sw.js)
- listener (/source/js/sw-update-listener.js)

这是一个生产级 Service Worker，任何额外复杂度都视为缺陷。
目标：严格按照以下设计稿实现渐变式更新模型。

⚠️ 重要约束：

必须在“当前主线 sw”基础上修改

不允许引入新的缓存分层概念（只允许 precache + runtime 双池）
不允许引入 DB、资源扫描、HTML 解析
不允许重构现有 CDN race 逻辑
不允许改变现有 fetch 策略结构
不允许增加额外依赖

你只允许：

调整 install / activate 生命周期逻辑
调整缓存命名方式
调整更新触发顺序
增加必要的注释

---

设计稿如下：

Service Worker 设计稿
（渐变式更新 · 双池模型 · CDN竞速）

一、核心目标

Service Worker 的职责只有三件事：

1）优化首次访问的网络路径（CDN race）
2）保证重复访问的高命中率（runtime 缓存）
3）在版本更新时保持体验连续（渐变式切换）

它不是资源站构建器。
它不是依赖解析器。
它只是时间的守护层。

优先级顺序：

连续性 > 新鲜度 > 离线完整性

---

二、缓存结构

采用双池模型：

1）precache（版本化）

包含核心资源： 
  "/css/style.css",
  "/js/app.js",
  "/js/search/hexo.js",
  "https://bing-wallpaper.hdilp.top/bing.jpg"
  "/"


与 SW 版本号绑定，每次版本更新重新下载

2）runtime（全局）

不带版本号
由真实访问自然生长
永不在 activate 阶段清空

用于： 图片、字体、第三方 CDN 资源、文章静态资源

原则：
核心资源永远来自 precache
runtime 仅作为长期记忆池

---

三、首次访问流程

用户首次访问网站
→ 浏览器加载页面
→ SW 安装
→ precache 下载核心资源
→ CDN race 处理冷资源
→ 资源写入 runtime

此阶段允许冷启动
但 CDN 竞速优化网络路径

---

四、常态访问（无更新）

SW 版本号未变化：

→ precache 命中核心资源
→ runtime 命中静态资源
→ 秒开

不触发任何缓存清理
不触发后台扫描

---

五、更新流程（渐变式模型）

当 SW 版本号变化时：

1）旧 SW 继续控制页面（SWR 策略）
2）新 SW 进入 installing
3）新 SW 在 install 阶段：

下载新版 precache（/、style.css、app.js、bing.jpg）

使用 CDN race

4）precache 下载完成后： → 发送 UPDATE_READY 消息给前端

5）用户点击刷新： → 发送 SKIP_WAITING → 新 SW activate

6）activate 阶段：

删除旧 precache
保留 runtime

7）刷新后： → 核心资源来自新 precache → 其他资源来自旧 runtime → 若存在新资源触发 CDN race

体验结果：

无缓存真空
无冷启动断层
核心层替换
记忆层继承

——

六、Fetch 策略

首页： Cache First （依赖 precache + 版本）

bing.jpg： Stale-While-Revalidate

核心 CSS / JS： Cache First（来自 precache）

静态资源： Cache First + CDN race

以下资源必须直连网络：
- sw-update-listener.js
- 带 Range 的音频资源
- https://api.i-meto.com

---

七、设计约束

禁止：
在 SW 内解析 HTML 构建资源清单
批量抓取全站资源
使用 DB 存储版本列表
在 activate 阶段清空 runtime

允许浏览器兜底缺失资源。

---

八、时间模型总结

首次访问： 冷启动 → 建立记忆

重复访问： 命中 → 秒开

版本更新： 旧 SW 服务
新 SW 预热
核心替换
记忆保留

更新不是切断。
更新是叠加。

---

实现要求：

1）缓存结构

precache 必须带版本号
runtime 必须为全局 cache，不带版本号
activate 阶段只能删除旧 precache
runtime 永远不得删除

2）更新流程

旧 SW 必须继续控制页面直到用户点击刷新
新 SW 在 install 阶段完成 precache 下载
只有在 precache 完成后才允许发送 UPDATE_READY
禁止自动 skipWaiting

3）首次访问

保留现有 CDN race
保留 runtime 自然生长机制

4）代码要求

保持现有日志结构
不改变现有 fetch 路由策略
修改必须最小化
在关键逻辑处添加清晰注释

---

工作逻辑：
> 用户首次访问网站→sw激活→cdn race&cache→缓存空间已有资源→如果无新版(sw版本号没变)→秒开→如果sw版本号变化(网站更新)→旧版本sw仍然接管页面（swr）→新版本Installing→新sw为了新版本首屏，提前下载新版本的precache（包含/、首屏样式和app.js还有当天的bing.jpg)→前端通知更新→刷新→旧sw不删除runtime→秒开（→cdn race）

---

输出要求：

不输出解释说明
不改变无关代码结构
不删除已有功能