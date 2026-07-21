# Contributing

[简体中文](CONTRIBUTING.md) | **English**

Thank you for improving Codex Dream Skin Manager. Bug fixes, features, documentation, translations, and tests are all welcome.

## Before You Start

1. Search existing [Issues](https://github.com/StarRain/Codex-Dream-Skin-Manager/issues) to avoid duplicates.
2. Use the Bug Report form for defects and include reproducible steps, version information, and relevant logs.
3. Open a Feature Request before implementing a substantial feature or architectural change so its direction can be discussed first.
4. Never include tokens, secrets, personal paths, or other sensitive information in issues, logs, screenshots, or commits.

## Local Development

Requirements:

- macOS
- Node.js 20+
- Docker Desktop with Docker Compose
- The Codex Dream Skin theme engine installed

```bash
git clone https://github.com/<your-name>/Codex-Dream-Skin-Manager.git
cd Codex-Dream-Skin-Manager
npm test
./scripts/start-local.sh
```

Create a short-lived branch from the latest `main`:

```bash
git switch -c feat/short-description
```

Recommended branch prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, and `test/`.

## Code Requirements

- Keep API actions and executable script names explicitly allowlisted.
- Validate all input from URLs, request bodies, theme manifests, and environment variables.
- Launch child processes with executable and argument arrays. Do not concatenate shell commands or use `sh -c`.
- Keep the WebUI and Host Agent local-only by default. Never expand network exposure without clear user control.
- Update both Chinese and English translations when changing UI text.
- Verify dark, light, and system appearance modes when changing UI styles.
- Keep theme deletion confined to the theme directory and protect preset and active themes.
- Do not commit `.runtime`, tokens, logs, user state, or machine-specific configuration.

## Verification

Run at least the following before opening a Pull Request:

```bash
npm test
node --check public/app.js
node --check src/host-agent.mjs
node --check src/web-server.mjs
docker compose config -q
git diff --check
```

For UI changes, also verify:

- Chinese and English
- Dark and light modes
- Overview, Themes, Logs, and System Information pages
- Loading failures, empty states, and disabled controls

## Commits and Pull Requests

Prefer concise Conventional Commits-style messages:

```text
feat: add update notification
fix: protect preset theme deletion
docs: improve installation guide
```

Pull Requests should:

- Focus on one problem without unrelated formatting or refactoring.
- Explain the motivation, implementation, and verification results.
- Link the relevant issue, for example `Closes #123`.
- Include screenshots or a recording for UI changes.
- Add tests and bilingual documentation for new behavior.
- Contain only material you are authorized to distribute under the project's MIT License.

By submitting a Pull Request, you agree to license your contribution under the project's [MIT License](LICENSE).
