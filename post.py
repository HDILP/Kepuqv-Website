# coding:utf-8
import requests
import re
import json
import sys, os
import time
from bs4 import BeautifulSoup

def parse_html(html_content):
    '''
    result = {
        "note_title": "",
        "note_content": "",
        "image_links": []
    }

    '''


    soup = BeautifulSoup(html_content, 'html.parser')

    # === 第一步：清理禁止词标签（保留内容）===
    for prohibited in soup.find_all('span', class_='prohibited-word'):
        prohibited.unwrap()  # 移除外层span标签，保留内部所有内容    
    
    result = {
        "note_title": "",
        "note_content": "",
        "headimg": "",
        "image_links": [],
    }

    # 提取标题
    if title_div := soup.find('div', class_='note-title'):
        raw_title = title_div.get_text(strip=True)
        # 内联字符过滤逻辑
        title = raw_title.replace('[', '【').replace(']', '】')
        for char in ['<', '>', '/', '\\', '|', ':', '"', '*', '?']:
            title = title.replace(char, '')
        result["note_title"] = title.strip().replace('  ', ' ')

    # 内容提取策略
    content_parts = []
    
    # 策略1：优先提取note-content中的第一个<p>文本
    if (note_content := soup.find('div', class_='note-content')) and (first_p := note_content.find('p')):
        # 提取第一个<p>内容
        for br in first_p.find_all('br'):
            br.replace_with('\n')
        p_text = first_p.get_text(strip=False).strip()
        if p_text:
            content_parts.append(p_text)
    # 策略2：无有效<p>时提取整个note-content
    elif note_content := soup.find('div', class_='note-content'):
        # 处理整个div内容
        for br in note_content.find_all('br'):
            br.replace_with('\n')
        div_text = note_content.get_text(strip=False).strip()
        if div_text:
            content_parts.append(div_text)
    # 策略3：提取其他<p>标签
    else:
        for p_tag in soup.find_all('p'):
            # 跳过包含图片的<p>
            if p_tag.find('img'):
                continue
            # 处理文本内容
            for br in p_tag.find_all('br'):
                br.replace_with('\n')
            p_text = p_tag.get_text(strip=False).strip()
            if p_text:
                content_parts.append(p_text)

    # 合并内容
    result["note_content"] = '\n\n'.join(content_parts) if content_parts else ""

    # 提取图片（严格限定swiper容器）
    if swiper_container := soup.find(class_='swiper-container'):
        result["image_links"] = [
            img["src"] for img in swiper_container.find_all("img", class_="fill-img")
            if img.has_attr("src")
        ]

    if result["image_links"]:
        result["headimg"] = result["image_links"][0]
    else:
        result["headimg"] = ''

    return result

def getPost(url):
    code = requests.get(url).text

    parse = parse_html(code)

    title = parse['note_title']
    post = parse['note_content']
    pictures = parse['image_links']
    headimg = parse['headimg']

    return post, title, headimg, pictures


def getIssues():
    # 从环境变量中获取 GitHub API 密钥
    github_token = os.getenv("GH_TOKEN")
    print(github_token)
    api_url = 'https://api.github.com/repos/HDILP/Kepuqv-Website/issues'
    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }
    response = requests.get(api_url, params={
        'sort': 'created',
        'direction': 'desc',
        'per_page': 1
    }, headers=headers)

    if response.status_code == 200:
        issues = response.json()
        if issues:
            latest_issue = issues[0]
            print("最新 Issue 标题:", latest_issue['title'])
            print("正文内容:", latest_issue['body'])
            post_url = re.findall('<url: (.*?)>', latest_issue['body'])[0]
            author = re.findall('<author: (.*?)>', latest_issue['body'])[0]
            data = re.findall('<data: (.*?)>', latest_issue['body'])[0]
            return post_url, author, data
        else:
            print("该仓库没有 Issue。")
    else:
        print(f"请求失败，状态码: {response.status_code}")


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

f = open(r'source/_posts/' + title + ".md", 'w', encoding='utf-8')

# =====Front-Matter=====

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
