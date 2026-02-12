import os
import time
import re

# 使用 Vercel Commit SHA，没有则使用时间戳
version_sha = os.environ.get('VERCEL_GIT_COMMIT_SHA', str(int(time.time())))

sw_path = "./public/volantis-sw.js"

def update_sw():
    print(f"=========== SW Version Inject Start ({version_sha}) ===========")

    if not os.path.exists(sw_path):
        print("Error: volantis-sw.js not found!")
        return

    with open(sw_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "::cacheSuffixVersion::" not in content:
        print("Warning: placeholder ::cacheSuffixVersion:: not found.")
    else:
        content = content.replace("::cacheSuffixVersion::", version_sha)

    with open(sw_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("=========== SW Version Inject Done ===========")

if __name__ == "__main__":
    update_sw()