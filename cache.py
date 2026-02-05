import os
import re
import hashlib
import time

# 配置项
# Vercel 提供的 Commit SHA 作为唯一版本标识，如果没有则用时间戳
#version_sha = os.environ.get('VERCEL_GIT_COMMIT_SHA', str(int(time.time())))
version_sha = str(int(time.time()))
sw_path = "./public/volantis-sw.js"

precache = {}

def walk_files(path):
    if not os.path.exists(path):
        return
    for root, dirs, files in os.walk(path):
        for f in files:
            full_path = os.path.join(root, f)
            # 匹配 Hexo 生成的带哈希的资源文件 (例如 style.abc123.css)
            if re.search(r"^app\..*\.js$", f):
                precache["app"] = f
            elif re.search(r"^hexo\..*\.js$", f):
                precache["search"] = f
            elif re.search(r"^style\..*\.css$", f):
                precache["style"] = f

def update_sw():
    print(f"==================== SW Update Start (Ver: {version_sha}) ====================")
    
    # 1. 扫描混淆后的文件名
    walk_files("./public/js/")
    walk_files("./public/css/")
    print(f"Detected Assets: {precache}")

    if not os.path.exists(sw_path):
        print("Error: volantis-sw.js not found in public!")
        return

    with open(sw_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 2. 替换资源路径 (适配 Hexo 混淆)
    if "style" in precache:
        content = content.replace("/css/style.css", f"/css/{precache['style']}")
    if "app" in precache:
        content = content.replace("/js/app.js", f"/js/{precache['app']}")
    if "search" in precache:
        content = content.replace("/js/search/hexo.js", f"/js/search/{precache['search']}")

    # 3. 注入版本号和关闭 NPM 检查模式
    # 将占位符替换为真实的构建哈希
    content = content.replace("::cacheSuffixVersion::", version_sha)
    
    # 强制关闭 NPMMirror，因为我们是在 Vercel 内部更新，不需要同步 NPM
    content = content.replace("let NPMMirror = true;", "let NPMMirror = false;")
    
    # 这里的版本号也设为当前构建 ID
    content = re.sub(r'let NPMPackageVersion = ".*?";', f'let NPMPackageVersion = "{version_sha}";', content)

    with open(sw_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print("==================== SW Update End ====================")

if __name__ == "__main__":
    update_sw()
