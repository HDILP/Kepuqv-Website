#!/usr/bin/env python3
"""
脚本用于添加新作者到静态博客配置中
"""

import yaml
import argparse
import os
from pathlib import Path
import sys

def load_yaml(file_path):
    """加载YAML文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        print(f"错误: 文件 {file_path} 不存在")
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"错误: 解析YAML文件失败: {e}")
        sys.exit(1)

def save_yaml(file_path, data):
    """保存数据到YAML文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    except Exception as e:
        print(f"错误: 保存文件失败: {e}")
        sys.exit(1)

def add_author_to_author_config(author_file, author_id, author_name, author_short):
    config = load_yaml(author_file)
    
    if author_short in config:
        print(f"❌ 错误: 作者简称 '{author_short}' 已存在")
        print(f"   现有作者: {config[author_short]['name']}")
        print(f"   请使用不同的简称或手动更新")
        sys.exit(1)  # 直接退出

    # 添加新作者配置
    config[author_short] = {
        'name': author_name,
        'avatar': f'/avatar/{author_id}.jpg'
    }
    
    # 保存更新
    save_yaml(author_file, config)
    print(f"✓ 已更新 {author_file}")

def add_author_to_friends_config(friends_file, author_name, author_id):
    """添加作者到friends.yml配置"""
    config = load_yaml(friends_file)
    
    # 检查配置格式
    if not isinstance(config, list):
        print(f"错误: {friends_file} 格式不正确，应为列表")
        sys.exit(1)
    
    # 找到第一个分组（假设只有一个分组）
    if len(config) == 0:
        print("错误: friends.yml 中没有找到任何分组")
        sys.exit(1)
    
    first_group = config[0]
    
    # 确保items列表存在
    if 'items' not in first_group:
        first_group['items'] = []
    
    # 检查是否已存在同名友链
    existing_titles = [item.get('title') for item in first_group.get('items', [])]
    if author_name in existing_titles:
        print(f"警告: 友链 '{author_name}' 已存在，将被跳过")
        return
    
    # 添加新友链
    new_friend = {
        'title': author_name,
        'avatar': f'/avatar/{author_id}.jpg',
        'url': '#'
    }
    
    first_group['items'].append(new_friend)
    
    # 保存更新
    save_yaml(friends_file, config)
    print(f"✓ 已更新 {friends_file}")

def main():
    parser = argparse.ArgumentParser(description='添加新作者到博客配置')
    parser.add_argument('--id', required=True, help='作者ID（用于头像文件名）')
    parser.add_argument('--name', required=True, help='作者全名')
    parser.add_argument('--short', required=True, help='作者简称（用于配置键名）')
    
    args = parser.parse_args()
    
    # 文件路径
    base_dir = Path.cwd()
    author_file = base_dir / 'source' / '_data' / 'author.yml'
    friends_file = base_dir / 'source' / '_data' / 'friends.yml'
    
    # 检查文件是否存在
    if not author_file.exists():
        print(f"错误: {author_file} 不存在")
        sys.exit(1)
    
    if not friends_file.exists():
        print(f"错误: {friends_file} 不存在")
        sys.exit(1)
    
    print(f"正在添加作者: {args.name} ({args.short})")
    print(f"作者ID: {args.id}")
    print("-" * 40)
    
    # 更新author.yml
    add_author_to_author_config(author_file, args.id, args.name, args.short)
    
    # 更新friends.yml
    add_author_to_friends_config(friends_file, args.name, args.id)
    
    print("-" * 40)
    print("✅ 作者添加完成!")
    print(f"请确保头像图片已上传到: /avatar/{args.id}.jpg")

if __name__ == '__main__':
    main()
