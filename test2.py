content = "- group: 科普区成员（无先后顺序）\n"
content += "  description: ''\n"
content += "  items:\n"
content += "  - title: 皙子\n"
content += "    avatar: /avatar/3665510.jpg\n"
content += "    url: /friends/\n"

with open('output.txt', 'w', encoding='utf-8') as file:
    file.write(content)

print("文件内容已覆盖写入.")
