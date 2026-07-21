# Codex Dream Skin Manager

**简体中文** | [English](README_EN.md)

一个独立的本地 Web GUI，用于管理同级项目
[`Codex-Dream-Skin`](../Codex-Dream-Skin/) 的 macOS 主题引擎。

本项目不修改、不复制原项目源码，也不修改官方 Codex 应用。它只调用原项目已经提供的
脚本接口，并读取原项目维护的主题与状态。

## 为什么有一个 Host Agent

Docker Desktop 中运行的是 Linux 容器，不能直接执行 macOS 的 `launchctl`、`osascript`、
`sips`，也不能控制宿主机上的 Codex。为了让 Docker 部署真正可用，本项目拆成两部分：

```text
浏览器
  │ http://localhost:19341/management.html
  ▼
Web 容器（只提供页面与 API 代理）
  │ 随机 256-bit 密钥认证
  ▼
Host Agent（本机 Node，独立控制端口）
  │ 参数数组调用，不拼接 shell 命令
  ▼
Codex-Dream-Skin/macOS scripts
```

- Web 端口只映射到 `127.0.0.1`，局域网不可访问。
- Host Agent 的每一个请求都需要随机生成的 256-bit Bearer Token；密钥文件权限为
  `0600`，容器只读挂载该文件。
- 容器不挂载 `~/.codex` 或 `~/Library/Application Support`；主题图片由 Agent 按主题
  清单受控读取。

## 本地启动

要求：

- macOS
- Docker Desktop（含 Docker Compose）
- 宿主机 Node.js 20+
- 已安装或在同级目录存在 `Codex-Dream-Skin/macos`

首次启动：

```bash
chmod +x scripts/start-local.sh scripts/stop-local.sh
./scripts/start-local.sh
```

然后访问：

```text
http://localhost:19341/management.html
```

停止：

```bash
./scripts/stop-local.sh
```

也可以使用 npm 别名：

```bash
npm start
npm stop
```

## 引擎目录解析

Host Agent 按顺序使用：

1. 环境变量 `DREAM_SKIN_ENGINE`
2. 默认安装目录 `~/.codex/codex-dream-skin-studio`
3. 同级开发目录 `../Codex-Dream-Skin/macos`

若需要指定目录：

```bash
DREAM_SKIN_ENGINE="/absolute/path/to/Codex-Dream-Skin/macos" ./scripts/start-local.sh
```

## 功能

- 查看 Skin、Codex、CDP 与注入器状态
- 应用、暂停、恢复官方外观
- 浏览本地主题库与预览图片
- 一键切换主题
- 删除不再需要的主题（二次确认，当前主题需先切换）
- 查看当前 Agent 生命周期内的操作输出

## 开发与验证

单元测试：

```bash
npm test
```

仅启动 Host Agent：

```bash
npm run agent
```

仅启动 Web 服务时，需要向它提供 Agent 地址和密钥文件；正常使用建议始终运行
`scripts/start-local.sh`。

验证容器配置：

```bash
docker compose config
docker compose build
```

## 安全边界

- API 只允许固定动作与固定脚本名。
- Host Agent 拒绝未认证请求；写操作还必须携带自定义请求标记，阻断普通跨站表单请求。
- 主题 ID 和枚举参数都会校验；主题删除严格限制在本地主题库目录内。
- 子进程使用可执行文件和参数数组启动，不使用 `sh -c`。
- CDP 地址验证、进程身份校验、配置备份与恢复仍由原 Codex Dream Skin 引擎负责。
