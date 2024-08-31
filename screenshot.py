import asyncio, os
from pyppeteer import launch

async def scroll_and_capture(url, path, name):
    browser = await launch({
                    'headless':True,
                    'executablePath':'/data/data/com.termux/files/usr/bin/chromium-browser',
                    'args':['--disable-gpu'],
                    })
    page = await browser.newPage()
    
    await page.goto(url)
    
    # 设置视口大小，可以根据需要调整
    await page.setViewport({'width': 810, 'height': 1080})
    
    viewport_height = int(await page.evaluate('() => window.innerHeight'))
    full_height = int(await page.evaluate('() => document.body.scrollHeight'))
    scroll_step = viewport_height // 1.1  # 设定每次滚动为视口高度的1/2，可以根据需要调整
    images = []
    position = 0
    i = 1
    while position + viewport_height < full_height:
        screenshot = f'{path}{name}_part_{i}.png'
        await page.evaluate(f'window.scrollTo(0, {position});')
        await asyncio.sleep(2)  # 等待页面滚动加载完成
        position += scroll_step
        
        i += 1

        images.append(await page.screenshot(path=screenshot))
    
    await browser.close()

    return images

async def main(url,name):
    # url = 'https://kepuqv.hdilp.top/'  # 目标网页地址
    path = '/data/data/com.termux/files/home/storage/shared/DCIM/kepuqv'  # 图片保存路径
    if not os.path.exists(path):  # 如果路径不存在，则创建路径
        os.makedirs(path)
    await scroll_and_capture(url, path, name)