# coding:utf-8
import requests
import re
import json
import sys
import time

def getPost():
    # url = input('url:') 
    url = 'https://www.yaerxing.com/shuati/verifyShareNote?adolescent_model=0&api_key=7f7c1aa0c0658b227985268159d50a3e&api_sig=5CE39E6A6E184BE1022D22C01DD0D022&app_v=141&appid=wx2bd42ba7f4c547f5&channel=none&font_size=3&mid=12804388&nid=2726448&os_v=33&platform_id=2&rom=EMUI&timestamp=1714651507853'
    resp = requests.get(url)
    code = (resp.text)
    resp.close()

    FkNTFS = ['<','>','/','\\','|',':','"','*','?']
    print(FkNTFS)
    post = (re.findall(r"<p>(.+?)</p>", code))
    post = (''.join(post))
    title = (re.findall(r'<div class="note-title">(.+?)</div>',code))
    title = (''.join(title)) 
    title = title.replace('[' , '【')
    title = title.replace(']' , '】')
    for i in FkNTFS:
        title = title.replace(i , '') 

    try:
        headimg = (re.findall(r'<img class="fill-img" src="(.*?)">',code))
        print(headimg)
        headimg = headimg[0]
        headimg = headimg.replace('http' , 'https')
    except:
        headimg = (re.findall(r"<img src='(.*?)'>",code))
        print(headimg)
        headimg = headimg[0]
        headimg = headimg.replace('http','https')
                              
    
    post = post.replace('<br/>','\n')
    post = post.replace("<span class='prohibited-word'>",'')
    post = post.replace("</span>",'')

    # print(post)
    # print(title)
    return post , title , headimg


# print(posts.encode("utf-8"))
# print(title.encode("utf-8"))
# print(headimg.encode("utf-8"))

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
# posttime = time.strftime('%Y-%m-%d')
# print(posttime)
# f = open(r'source/_posts/'+ title + ".md" , 'w' , encoding='utf-8')
# f.write('---\ntitle: ' + title + '\ndescription: \nkeywords: \ncategories: \ntags: \ndate: ' + posttime +'\nheadimg: '+headimg+'\nauthor: '+ author + '\n---\n'+posts)

# f.close()

getPost()