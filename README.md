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
</p>

Codex Dream Skin Manager 是一个独立的本地 Web GUI，通过原项目提供的 macOS 脚本管理主题、注入状态与 Codex 连接。它不复制或修改主题引擎源码，也不修改官方 Codex 应用。

> 当前版本仅面向 macOS，并要求已安装 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 主题引擎。

## 界面预览

![Codex Dream Skin Manager 概览](docs/images/overview.jpg)

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

Docker Desktop 中运行的是 Linux 容器，不能直接执行 macOS 的 `launchctl`、`osascript`、`sips`，也不能控制宿主机上的 Codex。因此当前部署由 Web 容器和本机 Host Agent 共同组成：

```text
浏览器
  │ http://localhost:19341/management.html
  ▼
Web 容器（静态页面与 API 代理）
  │ 随机 256-bit Bearer Token
  ▼
Host Agent（macOS 本机 Node.js，端口 4174）
  │ 固定脚本名与参数数组调用
  ▼
Codex Dream Skin macOS scripts
```

| 组件 | 运行位置 | 用途 |
| --- | --- | --- |
| WebUI | Docker，`127.0.0.1:19341` | 提供管理页面并代理 API |
| Host Agent | macOS，端口 `4174` | 调用本机主题脚本并读取状态 |
| Theme Engine | macOS 本机 | 注入主题、维护配置与 CDP 连接 |

## 快速开始

### 环境要求

- macOS
- Docker Desktop（包含 Docker Compose）
- 宿主机 Node.js 20+
- 已安装 `Codex Dream Skin`，或同级目录存在 `Codex-Dream-Skin/macos`

### 启动

```bash
git clone https://github.com/StarRain/Codex-Dream-Skin-Manager.git
cd Codex-Dream-Skin-Manager
chmod +x scripts/start-local.sh scripts/stop-local.sh
./scripts/start-local.sh
```

打开：

```text
http://localhost:19341/management.html
```

也可以使用 npm 别名：

```bash
npm start
```

### 停止

```bash
./scripts/stop-local.sh
```

或：

```bash
npm stop
```

## 指定主题引擎目录

Host Agent 按以下顺序解析引擎目录：

1. 环境变量 `DREAM_SKIN_ENGINE`
2. 默认安装目录 `~/.codex/codex-dream-skin-studio`
3. 同级开发目录 `../Codex-Dream-Skin/macos`

手动指定目录：

```bash
DREAM_SKIN_ENGINE="/absolute/path/to/Codex-Dream-Skin/macos" ./scripts/start-local.sh
```

## 数据与安全

- Web 端口仅绑定 `127.0.0.1`，默认不向局域网开放。
- Host Agent 的每个请求都必须携带随机生成的 256-bit Bearer Token。
- 令牌文件权限为 `0600`，容器仅以只读方式挂载。
- 容器不挂载 `~/.codex` 或 `~/Library/Application Support`。
- API 只允许固定动作、固定脚本名和经过校验的参数。
- 写操作还需要专用请求标记，以阻止普通跨站表单请求。
- 主题删除严格限制在本地主题库目录，并保护预设主题。
- 子进程通过可执行文件和参数数组启动，不使用 `sh -c`。

## 开发与验证

运行单元测试：

```bash
npm test
```

仅启动 Host Agent：

```bash
npm run agent
```

验证或构建容器：

```bash
docker compose config
docker compose build
```

正常使用建议运行 `scripts/start-local.sh`，因为单独启动 Web 服务时还需要提供 Host Agent 地址和令牌文件。

## 相关项目

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)：主题引擎、macOS 脚本与预设主题
- [Codex Dream Skin Manager](https://github.com/StarRain/Codex-Dream-Skin-Manager)：本地管理界面与 Host Agent

## 说明

本项目是社区工具，与 OpenAI 无官方隶属或背书关系。Codex 是其各自权利人的商标。
