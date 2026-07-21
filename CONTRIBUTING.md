# 参与贡献

**简体中文** | [English](CONTRIBUTING_EN.md)

感谢你为 Codex Dream Skin Manager 提交改进。Bug 修复、功能建议、文档、翻译和测试都欢迎参与。

## 提交前

1. 搜索现有 [Issues](https://github.com/StarRain/Codex-Dream-Skin-Manager/issues)，确认问题或建议没有重复。
2. Bug 请使用 Bug Report 模板，并提供可复现步骤、版本和必要日志。
3. 较大的功能或架构变更请先创建 Feature Request，确认方向后再开始编码。
4. 不要在 Issue、日志、截图或提交中包含令牌、密钥、个人路径或其他敏感信息。

## 本地开发

环境要求：

- macOS
- Node.js 20+
- Docker Desktop 与 Docker Compose
- 已安装 Codex Dream Skin 主题引擎

```bash
git clone https://github.com/<your-name>/Codex-Dream-Skin-Manager.git
cd Codex-Dream-Skin-Manager
npm test
./scripts/start-local.sh
```

建议从最新的 `main` 创建短生命周期分支：

```bash
git switch -c feat/short-description
```

推荐的分支前缀：`feat/`、`fix/`、`docs/`、`refactor/`、`test/`。

## 代码要求

- 保持 API 动作和可执行脚本名为显式允许列表。
- 所有来自 URL、请求体、主题清单和环境变量的输入都必须验证。
- 启动子进程时使用可执行文件与参数数组，不拼接 shell 命令，不使用 `sh -c`。
- WebUI 与 Host Agent 默认只服务本机，不能无提示扩大网络暴露范围。
- 修改界面文案时同时维护中英文翻译。
- 修改界面样式时同时验证暗色、亮色和跟随系统模式。
- 主题删除必须继续限制在主题目录内，并保护预设主题和当前主题。
- 不提交 `.runtime`、令牌、日志、用户状态文件或本机专用配置。

## 验证

提交 Pull Request 前至少运行：

```bash
npm test
node --check public/app.js
node --check src/host-agent.mjs
node --check src/web-server.mjs
docker compose config -q
git diff --check
```

涉及界面的改动还应验证：

- 中文和英文
- 暗色和亮色模式
- 概览、主题库、操作记录和系统信息页面
- 加载失败、空数据和按钮禁用状态

## 提交与 Pull Request

提交信息建议使用简洁的 Conventional Commits 风格：

```text
feat: add update notification
fix: protect preset theme deletion
docs: improve installation guide
```

Pull Request 请做到：

- 聚焦一个问题，避免混入无关格式化或重构。
- 说明变更原因、实现方式和验证结果。
- 关联对应 Issue，例如 `Closes #123`。
- 界面改动提供截图或录屏。
- 新功能补充测试和中英文文档。
- 确认提交内容拥有可分发授权，并符合本项目 MIT License。

提交 Pull Request 即表示你同意按照本项目的 [MIT License](LICENSE) 授权你的贡献。
