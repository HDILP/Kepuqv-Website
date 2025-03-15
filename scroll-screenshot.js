const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');

  const viewportHeight = page.viewportSize().height;
  let currentScroll = 0;
  let screenshotIndex = 1;

  // 循环滚动截图
  while (currentScroll < await page.evaluate(() => document.body.scrollHeight)) {
    // 截取当前视口
    await page.screenshot({
      path: `screenshot-${screenshotIndex}.png`,
      fullPage: false // 仅截取当前视口
    });

    // 向下滚动一个视口高度
    await page.evaluate((scrollY) => {
      window.scrollTo(0, scrollY);
    }, currentScroll + viewportHeight);

    currentScroll += viewportHeight;
    screenshotIndex++;
    await page.waitForTimeout(500); // 等待滚动稳定
  }

  await browser.close();
})();