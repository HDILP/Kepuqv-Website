const { chromium } = require('playwright');

(async () => {
  // 从命令行参数读取 URL（例如：node script.js https://example.com）
  const url = process.argv[2];
  if (!url) {
    console.error('请提供 URL 参数，例如：node scroll-screenshot.js https://example.com');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url); // 使用动态 URL

  const viewportHeight = page.viewportSize().height;
  let currentScroll = 0;
  let screenshotIndex = 1;

  while (currentScroll < await page.evaluate(() => document.body.scrollHeight)) {
    await page.screenshot({
      path: `screenshot-${screenshotIndex}.png`,
      fullPage: false
    });

    await page.evaluate((scrollY) => {
      window.scrollTo(0, scrollY);
    }, currentScroll + viewportHeight);

    currentScroll += viewportHeight;
    screenshotIndex++;
    await page.waitForTimeout(500);
  }

  await browser.close();
})();