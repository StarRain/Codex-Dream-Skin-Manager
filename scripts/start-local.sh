#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
RUNTIME_ROOT="$PROJECT_ROOT/.runtime"
PID_PATH="$RUNTIME_ROOT/agent.pid"
LOG_PATH="$RUNTIME_ROOT/agent.log"
TOKEN_PATH="$RUNTIME_ROOT/agent.token"
AGENT_PORT="4174"
NODE_BIN="$(command -v node || true)"

[ -n "$NODE_BIN" ] || { printf 'Node.js 20+ is required on the Mac host.\n' >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { printf 'Docker Desktop is required.\n' >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { printf 'Docker Compose is required.\n' >&2; exit 1; }

/bin/mkdir -p "$RUNTIME_ROOT"
/bin/chmod 700 "$RUNTIME_ROOT"
if [ ! -s "$TOKEN_PATH" ]; then
  /usr/bin/openssl rand -hex 32 > "$TOKEN_PATH"
  /bin/chmod 600 "$TOKEN_PATH"
fi
AGENT_TOKEN="$(/bin/cat "$TOKEN_PATH")"

agent_matches() {
  local pid="$1"
  case "$pid" in ''|*[!0-9]*) return 1 ;; esac
  /bin/kill -0 "$pid" 2>/dev/null || return 1
  local command_line process_cwd
  command_line="$(/bin/ps -p "$pid" -o command= 2>/dev/null || true)"
  case "$command_line" in *"$PROJECT_ROOT/src/host-agent.mjs"*) return 0 ;; esac
  process_cwd="$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' | /usr/bin/head -n 1 || true)"
  case "$command_line" in *"node src/host-agent.mjs"*) [ "$process_cwd" = "$PROJECT_ROOT" ] ;; *) return 1 ;; esac
}

AGENT_PID=""
if [ -f "$PID_PATH" ]; then
  AGENT_PID="$(/bin/cat "$PID_PATH" 2>/dev/null || true)"
fi

if ! agent_matches "$AGENT_PID"; then
  /bin/rm -f "$PID_PATH"
  MANAGER_RUNTIME_DIR="$RUNTIME_ROOT" MANAGER_AGENT_TOKEN_FILE="$TOKEN_PATH" MANAGER_AGENT_PORT="$AGENT_PORT" \
    /usr/bin/nohup "$NODE_BIN" "$PROJECT_ROOT/src/host-agent.mjs" >>"$LOG_PATH" 2>&1 &
  AGENT_PID="$!"
  printf '%s\n' "$AGENT_PID" > "$PID_PATH"
  /bin/chmod 600 "$PID_PATH" "$LOG_PATH" 2>/dev/null || true
fi

READY="false"
for _ in $(/usr/bin/seq 1 50); do
  if /usr/bin/curl --silent --fail --max-time 1 -H "Authorization: Bearer $AGENT_TOKEN" "http://127.0.0.1:${AGENT_PORT}/api/health" >/dev/null 2>&1; then
    READY="true"
    break
  fi
  /bin/sleep 0.1
done

if [ "$READY" != "true" ]; then
  printf 'Host Agent failed to start. See %s\n' "$LOG_PATH" >&2
  exit 1
fi

cd "$PROJECT_ROOT"
if ! docker compose up -d --build; then
  if agent_matches "$AGENT_PID"; then /bin/kill -TERM "$AGENT_PID" 2>/dev/null || true; fi
  exit 1
fi

printf '\nCodex Dream Skin Manager is ready:\n  http://localhost:19341/management.html\n\n'
printf 'Host Agent log: %s\n' "$LOG_PATH"
