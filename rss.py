import feedparser
# import schedule
import time
from datetime import datetime

import screenshot, asyncio

# RSS源的URL，请替换为你想要订阅的RSS地址
rss_url = 'https://kepuqv.hdilp.top/atom.xml'

# 用于存储上一次检查时的条目链接
previous_entries_links = set()

async def check_for_updates():
    global previous_entries_links
    
    # 解析RSS源
    feed = feedparser.parse(rss_url)
    
    # 获取新条目
    new_entries = []
    for entry in feed.entries:
        if entry.link not in previous_entries_links:
            new_entries.append(entry)
            previous_entries_links.add(entry.link)
    
    # 打印新条目
    if new_entries:
        print(f"{datetime.now()}: 新的更新：")
        for entry in new_entries:
            print(f"标题：{entry.title}")
            print(f"链接：{entry.link}")
            print(f"发布日期：{entry.published}\n")
            title = entry.title.replace(" ", "")
            title = title.replace('[', '【')
            title = title.replace(']', '】')
            FkNTFS = ['<', '>', '/', '\\', '|', ':', '"', '*', '?']
            for i in FkNTFS:
                title = title.replace(i, '')
            await screenshot.main(entry.link, title)

    else:
        print(f"{datetime.now()}: 没有新的更新。\n")

    # 保存当前的条目链接为下次比较的基准
    with open("previous_entries.txt", "w") as file:
        for link in previous_entries_links:
            file.write("%s\n" % link)

# 初始加载已知的条目链接
try:
    with open("previous_entries.txt", "r") as file:
        previous_entries_links.update(line.strip() for line in file)
except FileNotFoundError:
    pass  # 文件不存在，这是第一次运行

# 安排每天检查一次
# schedule.every().day.at("10:00").do(check_for_updates)  # 例如，设置为每天10点检查
# while True:
#     schedule.run_pending()
#     time.sleep(60)  # 每分钟检查一次是否有待执行的任务

async def main():
    await check_for_updates()  # 使用 await 来等待异步函数完成

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())  # 启动异步程序