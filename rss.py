import feedparser
from datetime import datetime
import os

# 配置常量
RSS_URL = 'https://kepuqv.hdilp.top/atom.xml'
HISTORY_FILE = "previous_entries.txt"

def load_history():
    """加载历史访问记录"""
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def save_history(links):
    """保存最新访问记录"""
    with open(HISTORY_FILE, "w") as f:
        for link in links:
            f.write(f"{link}\n")

def check_rss_updates():
    """执行单次RSS更新检查"""
    existing_links = load_history()
    new_entries = []
    
    try:
        # 解析RSS源数据
        feed = feedparser.parse(RSS_URL)
        if feed.bozo:  # 检查解析错误
            print(f"[错误] RSS解析失败: {feed.bozo_exception}")
            return
    except Exception as e:
        print(f"[错误] 无法获取RSS内容: {str(e)}")
        return

    # 检测新条目
    for entry in feed.entries:
        if entry.link not in existing_links:
            new_entries.append(entry)
            existing_links.add(entry.link)

    # 输出结果
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    if new_entries:
        print(f"\n{timestamp} 发现 {len(new_entries)} 条新内容")
        for idx, entry in enumerate(new_entries, 1):
            print(f"{idx}. {entry.title}")
            print(f"   链接：{entry.link}")
            print(f"   发布时间：{entry.get('published', '未知时间')}\n")
    else:
        print(f"{timestamp} 当前没有发现新内容")

    # 更新历史记录
    if new_entries:
        save_history(existing_links)

if __name__ == "__main__":
    check_rss_updates()