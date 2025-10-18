import os
import json
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# =========================
# 第一步：请求API获取成员数据
# =========================

url = "https://api.yaerxing.com/GetSTBuddies"

payload = "unionid=c215d6c4512b3d296f3c5f20a7055749&api_sig=74E57ACC672EC43B3419652B634CFA1F&openid=c215d6c4512b3d296f3c5f20a7055749&channel=none&type=1&app_c=144&call_id=1717310986902&os_v=33&um_token=&rom=EMUI&app_v=1.15.1&api_key=9608ebc12b0dcfac257dd071357e3c2c&appid=wx2bd42ba7f4c547f5&device_token=&platform_id=2&model=ELN-W09&page=0&brand=HONOR&search_text="

headers = {
    'User-Agent': "android",
    'Connection': "Keep-Alive",
    'Accept': "application/json",
    'Accept-Encoding': "gzip",
    'Content-Type': "application/x-www-form-urlencoded"
}

print("正在请求API获取成员信息...")
response = requests.post(url_api, data=payload, headers=headers)

if response.status_code != 200:
    print(f"API请求失败，状态码：{response.status_code}")
    print(response.text)
    exit()

try:
    code = json.loads(response.text)
    members = code['buddies']  # list of dicts
except KeyError:
    print("返回数据中没有找到 'buddies' 字段")
    print(response.text)
    exit()
except Exception as e:
    print(f"解析JSON失败: {e}")
    exit()

# 提取 uid 和 logo URL
uids = []
logo_url = []

for member in members:
    uid = member.get('home_id')
    logo = member.get('logo')
    if uid and logo:
        uids.append(uid)
        logo_url.append(logo)

print(f"共获取到 {len(uids)} 个成员的头像链接")

# =========================
# 第二步：配置图片下载会话
# =========================

session = requests.Session()
retries = Retry(
    total=5,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    raise_on_redirect=False,
    raise_on_status=False
)
adapter = HTTPAdapter(max_retries=retries)
session.mount('http://', adapter)
session.mount('https://', adapter)

# 下载头像用的请求头（可与API不同）
download_headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
}

# 创建保存目录
save_dir = os.path.join('.', 'source', 'avatar')
os.makedirs(save_dir, exist_ok=True)

# =========================
# 第三步：批量下载头像
# =========================

for uid, url in zip(uids, logo_url):
    file_path = os.path.join(save_dir, f'{uid}.jpg')
    try:
        print(f"📥 正在下载 UID {uid} 的头像...")
        resp = session.get(url, headers=download_headers, timeout=15, stream=True)
        if resp.status_code == 200:
            with open(file_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            print(f"✅ 成功保存: {file_path}")
        else:
            print(f"❌ 下载失败 (UID={uid})，HTTP状态码: {resp.status_code}")
    except Exception as e:
        print(f"⚠️ 下载 UID {uid} 时出错: {e}")

print("🎉 所有头像下载任务完成！")