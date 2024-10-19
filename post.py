# coding:utf-8
import requests
import re
import json
import sys, os
import time

def getPost(url):
    # url = input('url:') 
    # url = 'https://www.yaerxing.com/shuati/verifyShareNote?adolescent_model=0&api_key=7f7c1aa0c0658b227985268159d50a3e&api_sig=5CE39E6A6E184BE1022D22C01DD0D022&app_v=141&appid=wx2bd42ba7f4c547f5&channel=none&font_size=3&mid=12804388&nid=2726448&os_v=33&platform_id=2&rom=EMUI&timestamp=1714651507853'
    resp = requests.get(url)
    code = resp.text
    resp.close()
    post = re.findall(r"<p>(.+?)</p>", code)
    print (post)
    post = post[0]
    if post == '':  # 新文章
        post = (re.findall(r'<div class="note-content img-wrap">(.+?)</div>', code))
        post = (''.join(post))

    title = re.findall(r'<div class="note-title">(.+?)</div>', code)[0]
    title = title.replace('[', '【')
    title = title.replace(']', '】')
    FkNTFS = ['<', '>', '/', '\\', '|', ':', '"', '*', '?']
    for i in FkNTFS:
        title = title.replace(i, '')
    try:
        pictures = (re.findall(r'<img class="fill-img" src="(.*?)">', code))
        print(pictures)
        headimg = pictures[0]
        headimg = headimg.replace('http', 'https')
    except:
        try:
            pictures = (re.findall(r"<img src='(.*?)'>", code))
            print(pictures)
            headimg = pictures[0]
            headimg = headimg.replace('http', 'https')
        except:
            headimg = ''

    post = post.replace('<br/>', '\n')
    post = post.replace("<span class='prohibited-word'>", '')
    post = post.replace("</span>", '')

    # print(post)
    # print(title)
    return post, title, headimg, pictures


def getIssues():
    # 从环境变量中获取 GitHub API 密钥
    github_token = os.getenv("GH_TOKEN")
    print(github_token)
    api_url = 'https://api.github.com/repos/HDILP/Kepuqv-Website/issues'
    # url = 'https://api.github.com/repos/HDILP/friends/issues'
    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github+json",
    }
    response = requests.get(api_url, headers=headers)
    code = response.text
    if len(code) == 2:
        sys.exit(0)
    else:
        code = json.loads(code)
        print((code))
        code = code[0]
        body = code["body"]
        print(body)
        post_url = re.findall('<url: (.*?)>', body)[0]
        author = re.findall('<author: (.*?)>', body)[0]
        data = re.findall('<data: (.*?)>', body)[0]
        return post_url, author, data


url, author, data = getIssues()
posts, title, headimg, pictures = getPost(url)

# '''
# ---
# title: 
# description: 
# keywords: 
# categories: 
# tags:
# date: 
# headimg: 
# author: 
# ---
# '''

# ======Creat New File======
posttime = time.strftime('%Y-%m-%d')
print(posttime)
f = open(r'source/_posts/' + title + ".md", 'w', encoding='utf-8')

# =====Front-Matter=====
if data == 'yyyy-mm-dd':
    data = time.strftime('%Y-%m-%d')
else:
    data = data

f.write('---\n' + \
        'title: ' + title + \
        '\ndescription: ' + \
        '\nkeywords: ' + \
        '\ncategories: ' + \
        '\ntags: ' + \
        '\ndate: ' + data + \
        '\nheadimg: ' + headimg + \
        '\nauthor: ' + author + \
        '\n---\n\n')
# ======END======

# pictures
f.write('{% gallery stretch::6::two %}\n')

for i in pictures:
    j = i.replace('http', 'https')
    f.write('![](%s)\n' %j)

f.write('{% endgallery %}\n')

# 正文
f.write(posts + '\n')

f.close()
