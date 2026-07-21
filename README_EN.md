# Codex Dream Skin Manager

[简体中文](README.md) | **English**

An independent local Web GUI for managing the macOS theme engine provided by the sibling
[`Codex-Dream-Skin`](../Codex-Dream-Skin/) project.

This project does not modify or copy the source code of the original project, nor does it modify the official Codex app. It only calls the script interfaces already provided by the original project and reads the themes and runtime state maintained by it.

## Why a Host Agent Is Required

Docker Desktop runs Linux containers, which cannot directly execute macOS tools such as `launchctl`, `osascript`, or `sips`, and cannot control Codex on the host. To make the Docker deployment functional, the project is split into two parts:

```text
Browser
  │ http://localhost:19341/management.html
  ▼
Web container (serves the UI and proxies API requests only)
  │ Random 256-bit token authentication
  ▼
Host Agent (local Node.js process on a dedicated control port)
  │ Invokes executable and argument arrays without shell command concatenation
  ▼
Codex-Dream-Skin/macOS scripts
```

- The Web port is bound to `127.0.0.1` only and is not accessible from the local network.
- Every Host Agent request requires a randomly generated 256-bit Bearer Token. The token file uses `0600` permissions and is mounted read-only inside the container.
- The container does not mount `~/.codex` or `~/Library/Application Support`. Theme images are read by the Agent under controls defined by each theme manifest.

## Local Startup

Requirements:

- macOS
- Docker Desktop with Docker Compose
- Node.js 20+ on the host
- `Codex-Dream-Skin/macos` installed or available in the sibling project directory

First startup:

```bash
chmod +x scripts/start-local.sh scripts/stop-local.sh
./scripts/start-local.sh
```

Then open:

```text
http://localhost:19341/management.html
```

To stop:

```bash
./scripts/stop-local.sh
```

You can also use the npm aliases:

```bash
npm start
npm stop
```

## Engine Directory Resolution

The Host Agent checks the following locations in order:

1. The `DREAM_SKIN_ENGINE` environment variable
2. The default installation directory: `~/.codex/codex-dream-skin-studio`
3. The sibling development directory: `../Codex-Dream-Skin/macos`

To specify a directory explicitly:

```bash
DREAM_SKIN_ENGINE="/absolute/path/to/Codex-Dream-Skin/macos" ./scripts/start-local.sh
```

## Features

- View Skin, Codex, CDP, and injector status
- Apply or pause the skin and restore the official appearance
- Browse the local theme library and preview images
- Switch themes with one click
- Delete themes that are no longer needed, with confirmation; switch away from the active theme before deleting it
- View command output from the current Agent lifecycle

## Development and Verification

Run unit tests:

```bash
npm test
```

Start the Host Agent only:

```bash
npm run agent
```

When starting only the Web service, you must provide the Agent address and token file. For normal use, always run `scripts/start-local.sh`.

Validate the container configuration:

```bash
docker compose config
docker compose build
```

## Security Boundaries

- The API permits only predefined actions and script names.
- The Host Agent rejects unauthenticated requests. Write operations also require a custom request marker to block ordinary cross-site form requests.
- Theme IDs and enum parameters are validated. Theme deletion is strictly confined to the local theme library directory.
- Child processes are started with executable and argument arrays; `sh -c` is not used.
- CDP address validation, process identity checks, configuration backup, and restoration remain the responsibility of the original Codex Dream Skin engine.
