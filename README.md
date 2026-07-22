<p align="center">
  <img src="public/assets/codex-dream-skin-manager-logo-transparent.png" width="112" alt="Codex Dream Skin Manager Logo">
</p>

<h1 align="center">Codex Dream Skin Manager</h1>

<p align="center">面向 macOS Codex Dream Skin 的本地主题管理面板。</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README_EN.md">English</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-v1.0.0-8cff52">
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS-11151d">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%E2%89%A520-5fa04e">
  <img alt="Docker Compose" src="https://img.shields.io/badge/Docker-Compose-2496ed">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-8cff52"></a>
  <a href="https://github.com/StarRain/Codex-Dream-Skin-Manager/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/StarRain/Codex-Dream-Skin-Manager/actions/workflows/ci.yml/badge.svg"></a>
</p>

Codex Dream Skin Manager 是一个独立的本地 Web GUI，通过原项目提供的 macOS 脚本管理主题、注入状态与 Codex 连接。它不复制或修改主题引擎源码，也不修改官方 Codex 应用。

> 当前版本仅面向 macOS，并要求已安装 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 主题引擎。

## 界面预览

![Codex Dream Skin Manager 概览](docs/images/overview.jpg)

![Codex Dream Skin Manager 主题库](docs/images/themes.jpg)

## 核心能力

### 主题管理

- 浏览本地预设与自定义主题
- 展示主题背景预览与当前主题
- 一键应用或重新应用主题
- 删除自定义主题并进行二次确认
- 保护预设主题和当前使用中的主题，防止误删

### 运行状态

- 查看皮肤会话、Codex、CDP 与注入器状态
- 应用皮肤、暂停注入或恢复官方外观
- 查看当前 Host Agent 生命周期内的操作记录
- 手动刷新配置、运行状态、主题库和日志

### 使用体验

- 简体中文与英文界面
- 跟随系统、亮色与暗色外观
- 本地系统信息、版本号及项目仓库快捷入口
- 默认入口：`http://localhost:19341/management.html`

## 运行架构

Homebrew 和 Shell 安装默认使用本机一体化模式，由一个仅监听回环地址的服务同时提供 WebUI、API 和主题脚本调用：

```text
浏览器
  │ http://localhost:19341/management.html
  ▼
Codex Dream Skin Manager（127.0.0.1:19341）
  ├─ 单文件 WebUI
  ├─ 本地管理 API
  │ 固定脚本名与参数数组调用
  ▼
Codex Dream Skin macOS scripts
```

Docker 模式继续保留。由于 Linux 容器不能直接控制 macOS 应用，该模式仍使用 Web 容器与宿主机 Agent，并通过随机 256-bit Token 通信。

## 安装

### 环境要求

- macOS
- 宿主机 Node.js 20+
- 已安装 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)

### Homebrew（推荐）

```bash
brew install starrain/tap/codex-dream-skin-manager
brew services start codex-dream-skin-manager
```

升级：

```bash
brew update
brew upgrade codex-dream-skin-manager
```

### Shell 安装

下载安装脚本后执行：

```bash
curl -fsSLO https://raw.githubusercontent.com/StarRain/Codex-Dream-Skin-Manager/main/scripts/install.sh
bash install.sh
```

安装器会校验 GitHub Release 的 SHA-256、安装本机服务并注册用户级 LaunchAgent。卸载默认保留管理器数据与日志：

```bash
codex-dream-skin-manager uninstall
```

添加 `--purge` 可同时清理管理器运行数据；主题引擎和主题库不在该清理范围内。

### Docker + Host Agent

Docker 方式要求 Docker Desktop 与 Docker Compose：

```bash
git clone https://github.com/StarRain/Codex-Dream-Skin-Manager.git
cd Codex-Dream-Skin-Manager
./scripts/start-local.sh
```

停止：

```bash
./scripts/stop-local.sh
```

## 使用

管理地址：

```text
http://localhost:19341/management.html
```

本机安装提供以下命令：

```bash
codex-dream-skin-manager status
codex-dream-skin-manager open
codex-dream-skin-manager restart
codex-dream-skin-manager logs
codex-dream-skin-manager update
```

## 指定主题引擎目录

Host Agent 按以下顺序解析引擎目录：

1. 环境变量 `DREAM_SKIN_ENGINE`
2. 默认安装目录 `~/.codex/codex-dream-skin-studio`
3. 同级开发目录 `../Codex-Dream-Skin/macos`

手动指定目录：

```bash
DREAM_SKIN_ENGINE="/absolute/path/to/Codex-Dream-Skin/macos" codex-dream-skin-manager serve
```

## 数据与安全

- Web 端口仅绑定 `127.0.0.1`，默认不向局域网开放。
- Docker 模式中 Host Agent 的每个请求都必须携带随机生成的 256-bit Bearer Token。
- Docker 令牌文件权限为 `0600`，容器仅以只读方式挂载。
- 容器不挂载 `~/.codex` 或 `~/Library/Application Support`。
- API 只允许固定动作、固定脚本名和经过校验的参数。
- 写操作还需要专用请求标记，以阻止普通跨站表单请求。
- 主题删除严格限制在本地主题库目录，并保护预设主题。
- 子进程通过可执行文件和参数数组启动，不使用 `sh -c`。

## 开发与验证

运行完整检查和构建：

```bash
npm run check
npm run build:release
```

启动原生开发服务：

```bash
npm run native
```

验证或构建容器：

```bash
docker compose config
docker compose build
```

发布 `vX.Y.Z` 标签时，GitHub Actions 会生成 `management.html`、macOS 压缩包、SHA-256 校验文件、Homebrew Formula 和多架构 GHCR 镜像。

## 相关项目

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)：主题引擎、macOS 脚本与预设主题
- [Codex Dream Skin Manager](https://github.com/StarRain/Codex-Dream-Skin-Manager)：本地管理界面与 Host Agent

## 参与贡献

欢迎提交 Bug 修复、功能代码、测试、文档和翻译。较大的改动请先创建 Feature Request 讨论范围，再按照[贡献指南](CONTRIBUTING.md)提交 Pull Request。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，Copyright (c) 2026 StarRain。

## 说明

本项目是社区工具，与 OpenAI 无官方隶属或背书关系。Codex 是其各自权利人的商标。
