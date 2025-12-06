# Kepuqv-Website

## 🌌 简介 (Introduction)

本项目是 [`HDILP/Kepuqv-Website`](https://github.com/HDILP/Kepuqv-Website) 的代码仓库，是基于 **Hexo 静态博客框架** 和 **Volantis 主题** 搭建的科普区官方网站。我们致力于提供简洁、美观、响应式的阅读体验，用于发布科普文章、项目动态及社区信息。

## 🚀 网站预览 (Live Demo)

| 平台 | 链接 |
|------|------|
| 部署链接 | [https://kepuqv.hdilp.top](https://kepuqv.hdilp.top) |

## ✨ 主要特性 (Key Features)

- **静态高性能**：基于 Hexo 框架生成静态文件，访问速度快，安全性高。
- **Volantis 主题**：采用 Volantis 主题，提供优雅的界面设计和丰富的定制功能。
- **响应式布局**：完美支持桌面、平板和手机等多种设备访问。
- **自动化脚本**：包含 Python 和 Shell 脚本，用于自动化管理如获取成员头像、文章发布等任务。
- **Vercel/GitHub Actions 部署**：集成 CI/CD 流程，实现代码提交后的自动构建和部署。

## 🛠️ 项目结构 (Project Structure)

本项目结构遵循 Hexo 标准，并加入了主题配置和自动化脚本，使维护和发布更加高效。

```
.
├── .github/              # GitHub Actions/工作流配置
├── .vscode/              # VS Code 编辑器配置（如推荐插件）
├── scaffolds/            # Hexo 文章模板（脚手架）
├── source/               # 网站内容源文件
│   └── _posts/           # 博客文章 (.md) 存放目录
├── _config.yml           # Hexo 全局配置文件
├── _config.volantis.yml  # Volantis 主题配置文件
├── package.json          # Node.js 依赖配置
├── yarn.lock             # Yarn 依赖锁定文件
├── GetMembersAvatar.py   # [脚本] 用于获取成员头像等数据
├── post.py               # [脚本] 文章自动化处理脚本
├── REPO.sh               # [脚本] 神秘一键push脚本
├── LICENSE               # 项目代码许可证 (MIT)
└── README.md             # 本项目说明文件
```

## ⚙️ 本地开发环境搭建 (Local Setup)

### 1. 环境准备

请确保您的系统已安装以下环境：

- **Node.js**（推荐 LTS 版本）
- **Yarn** 或 **npm**（本项目推荐使用 Yarn）
- **Git**

### 2. 克隆项目

```bash
git clone https://github.com/HDILP/Kepuqv-Website.git
cd Kepuqv-Website
```

### 3. 安装依赖

本项目使用了 `package.json` 和 `yarn.lock` 管理依赖，请执行：

```bash
yarn install
# 或者使用 npm:
# npm install
```

### 4. 运行本地服务器

启动本地开发服务器，并监听文件变化自动刷新：

```bash
hexo server
# 启动后，您可以在浏览器访问 http://localhost:4000/
```

## 📝 常用 Hexo 命令 (Common Commands)

| 命令 | 描述 |
|------|------|
| `hexo new "文章标题"` | 创建一篇新文章到 `source/_posts/` 目录 |
| `hexo clean` | 清除缓存文件 (`db.json`) 和已生成的静态文件 (`public`) |
| `hexo generate` / `hexo g` | 生成静态文件到 `public` 目录 |
| `hexo deploy` / `hexo d` | 将生成的静态文件部署到远程仓库（需配置 `_config.yml`） |
| `hexo s` | 启动本地服务器进行预览 |
| `hexo clean && hexo g && hexo d` | 清除、生成并部署（常用命令组合） |

## 🤝 贡献 (Contributing)

我们非常欢迎社区贡献！如果您发现任何 Bug 或有改进建议，请随时通过以下方式参与：

1. Fork 本仓库。
2. 创建您的新功能分支：  
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. 提交您的修改：  
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. 推送到您的分支：  
   ```bash
   git push origin feature/AmazingFeature
   ```
5. 提交一个 Pull Request。

## 📜 许可证 (License)

### 💻 项目代码许可证 (MIT)

本项目仓库中的代码、脚本和配置遵循 **MIT 许可证**。详见根目录下的 [`LICENSE`](LICENSE) 文件。

### ✍️ 网站内容许可证 (CC BY-NC-SA 4.0)

本项目网站（[https://kepuqv.hdilp.top](https://kepuqv.hdilp.top)）上的所有原创文章及文字内容遵循 **知识共享署名-非商业性使用-相同方式共享 4.0 国际许可协议**（[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)）。

这意味着：

- **署名 (BY)**：您必须给出适当的署名，并提供指向本许可证的链接。
- **非商业性使用 (NC)**：您不得将本作品用于商业目的。
- **相同方式共享 (SA)**：如果您对本作品进行了修改或衍生，必须使用相同的许可证发布您的贡献。
