import subprocess
import re
from datetime import datetime

def capture_screenshots(urls):
    """
    对传入的URL列表使用Playwright CLI进行截图，返回生成的文件名列表
    
    参数：
    urls (list): 需要截图的URL列表
    
    返回：
    list: 生成的截图文件名列表
    """
    filenames = []
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    for index, url in enumerate(urls):
        try:
            filename = f"screenshot_{timestamp}.png"
            
            # 构造Playwright命令
            command = [
                'npx'
                'playwright',
                'screenshot',
                '--viewport-size 1080,1440',
                url,
                filename
            ]
            
            # 执行命令
            result = subprocess.run(
                command,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            filenames.append(filename)
            
        except subprocess.CalledProcessError as e:
            print(f"截图失败：{url}")
            print(f"错误信息：{e.stderr}")
        except Exception as e:
            print(f"处理 {url} 时发生意外错误：{str(e)}")
    
    return filenames