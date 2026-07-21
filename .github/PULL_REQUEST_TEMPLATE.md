## Summary / 变更摘要

<!-- Explain what changed and why. / 请说明改动内容及原因。 -->

## Related issue / 关联 Issue

<!-- Example: Closes #123 -->

## Change type / 变更类型

- [ ] Feature / 新功能
- [ ] Bug fix / 缺陷修复
- [ ] Refactor / 重构
- [ ] Documentation or translation / 文档或翻译
- [ ] Test or tooling / 测试或工具

## Verification / 验证结果

<!-- List the commands and manual checks you ran. / 列出已运行的命令和手动检查。 -->

- [ ] `npm test`
- [ ] `node --check public/app.js`
- [ ] `node --check src/host-agent.mjs`
- [ ] `node --check src/web-server.mjs`
- [ ] `docker compose config -q`
- [ ] `git diff --check`

## UI evidence / 界面截图

<!-- Required for visual changes. Include dark/light and zh/en when relevant. / 界面改动请提供截图，必要时覆盖暗色/亮色及中英文。 -->

## Safety checklist / 安全检查

- [ ] No tokens, logs, personal paths, or user state are committed. / 未提交令牌、日志、个人路径或用户状态。
- [ ] New input is validated and system actions remain allowlisted. / 新增输入已校验，系统动作仍使用允许列表。
- [ ] Theme deletion remains confined and preset themes stay protected. / 主题删除仍受目录限制，预设主题继续受保护。
- [ ] New behavior includes tests and bilingual documentation where applicable. / 新行为已按需补充测试和中英文文档。
