import requests
import re

url = input('url:') 
resp = requests.get(url)
code = (resp.text)
resp.close()
code = (re.findall(r"<p>(.+?)</p>", code))
code = (''.join(code))
code = code.replace('<br/>','\n')

code = code.replace("<span class='prohibited-word'>",'')

code = code.replace("</span>",'')
print(code)