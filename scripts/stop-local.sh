#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
RUNTIME_ROOT="$PROJECT_ROOT/.runtime"
PID_PATH="$RUNTIME_ROOT/agent.pid"

cd "$PROJECT_ROOT"
docker compose down

if [ -f "$PID_PATH" ]; then
  AGENT_PID="$(/bin/cat "$PID_PATH" 2>/dev/null || true)"
  case "$AGENT_PID" in
    ''|*[!0-9]*) ;;
    *)
      COMMAND_LINE="$(/bin/ps -p "$AGENT_PID" -o command= 2>/dev/null || true)"
      PROCESS_CWD="$(/usr/sbin/lsof -a -p "$AGENT_PID" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' | /usr/bin/head -n 1 || true)"
      case "$COMMAND_LINE" in
        *"$PROJECT_ROOT/src/host-agent.mjs"*)
          /bin/kill -TERM "$AGENT_PID" 2>/dev/null || true
          ;;
        *"node src/host-agent.mjs"*)
          if [ "$PROCESS_CWD" = "$PROJECT_ROOT" ]; then
            /bin/kill -TERM "$AGENT_PID" 2>/dev/null || true
          else
            printf 'Relative Agent command belongs to another directory; it was not stopped.\n' >&2
          fi
          ;;
        *)
          printf 'Saved PID no longer belongs to this Host Agent; it was not stopped.\n' >&2
          ;;
      esac
      ;;
  esac
fi

/bin/rm -f "$PID_PATH"
printf 'Codex Dream Skin Manager stopped.\n'
