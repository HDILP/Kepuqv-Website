import requests
import re
import json

url = "https://api.yaerxing.com/GetSTBuddies"

payload = "unionid=c215d6c4512b3d296f3c5f20a7055749&api_sig=74E57ACC672EC43B3419652B634CFA1F&openid=c215d6c4512b3d296f3c5f20a7055749&channel=none&type=1&app_c=144&call_id=1717310986902&os_v=33&um_token=&rom=EMUI&app_v=1.15.1&api_key=9608ebc12b0dcfac257dd071357e3c2c&appid=wx2bd42ba7f4c547f5&device_token=&platform_id=2&model=ELN-W09&page=0&brand=HONOR&search_text="

headers = {
  'User-Agent': "android",
  'Connection': "Keep-Alive",
  'Accept': "application/json",
  'Accept-Encoding': "gzip",
  'Content-Type': "application/x-www-form-urlencoded"
}

response = requests.post(url, data=payload, headers=headers)

code = json.loads(response.text)
code = code['buddies'] # code now is 列表，列表里面是字典[{},{},{}]

uids = []
logo_url = []

for member in code:
    uid = member['home_id']
    uids.append(uid)
    logo = member['logo']
    logo_url.append(logo)

for i, url in zip(uids, logo_url):  # 假设uids和logo_url长度相同，一一对应
    response = requests.get(url)
    if response.status_code == 200:
        file_path = f"./source/avatar/{i}.jpg"
        with open(file_path, 'wb') as f:
            f.write(response.content)
        print(f"图片已成功保存至 {file_path}")
    else:
        print(f"为UID {i} 下载图片失败，HTTP状态码：{response.status_code}")