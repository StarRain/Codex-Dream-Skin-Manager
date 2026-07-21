#!/bin/bash

set -euo pipefail

LABEL="com.starrain.codex-dream-skin-manager"
INSTALL_ROOT="${MANAGER_INSTALL_ROOT:-$HOME/.local/share/codex-dream-skin-manager}"
BIN_PATH="${MANAGER_BIN_DIR:-$HOME/.local/bin}/codex-dream-skin-manager"
PLIST_PATH="${MANAGER_LAUNCH_AGENT_PATH:-$HOME/Library/LaunchAgents/${LABEL}.plist}"
RUNTIME_ROOT="${MANAGER_RUNTIME_DIR:-$HOME/Library/Application Support/CodexDreamSkinManager}"
LOG_ROOT="${MANAGER_LOG_DIR:-$HOME/Library/Logs/CodexDreamSkinManager}"

if /bin/launchctl print "gui/$(/usr/bin/id -u)/$LABEL" >/dev/null 2>&1; then
  /bin/launchctl bootout "gui/$(/usr/bin/id -u)/$LABEL"
fi

/bin/rm -f "$PLIST_PATH"
if [ -L "$BIN_PATH" ]; then /bin/rm -f "$BIN_PATH"; fi
/bin/rm -rf "$INSTALL_ROOT"

if [ "${1:-}" = "--purge" ]; then
  /bin/rm -rf "$RUNTIME_ROOT" "$LOG_ROOT"
  printf 'Codex Dream Skin Manager and manager data were removed.\n'
else
  printf 'Codex Dream Skin Manager was removed. Manager data and logs were preserved.\n'
  printf 'Run uninstall with --purge to remove them as well.\n'
fi
