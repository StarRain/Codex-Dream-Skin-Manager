#!/bin/bash

set -euo pipefail

REPOSITORY="StarRain/Codex-Dream-Skin-Manager"
ASSET_NAME="codex-dream-skin-manager-macos.tar.gz"
LABEL="com.starrain.codex-dream-skin-manager"
INSTALL_ROOT="${MANAGER_INSTALL_ROOT:-$HOME/.local/share/codex-dream-skin-manager}"
BIN_DIR="${MANAGER_BIN_DIR:-$HOME/.local/bin}"
PLIST_PATH="${MANAGER_LAUNCH_AGENT_PATH:-$HOME/Library/LaunchAgents/${LABEL}.plist}"
RUNTIME_ROOT="${MANAGER_RUNTIME_DIR:-$HOME/Library/Application Support/CodexDreamSkinManager/runtime}"
LOG_ROOT="${MANAGER_LOG_DIR:-$HOME/Library/Logs/CodexDreamSkinManager}"
NO_START="${MANAGER_INSTALL_NO_START:-0}"
SERVICE_WAS_LOADED="false"

[ "$(/usr/bin/uname -s)" = "Darwin" ] || { printf 'This installer supports macOS only.\n' >&2; exit 1; }
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { printf 'Node.js 20+ is required. Install it with Homebrew or nodejs.org first.\n' >&2; exit 1; }
"$NODE_BIN" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || {
  printf 'Node.js 20+ is required.\n' >&2
  exit 1
}

if /bin/launchctl print "gui/$(/usr/bin/id -u)/$LABEL" >/dev/null 2>&1; then SERVICE_WAS_LOADED="true"; fi
if [ "$NO_START" != "1" ] && [ "$SERVICE_WAS_LOADED" != "true" ] && /usr/bin/curl --silent --fail --max-time 1 http://127.0.0.1:19341/healthz >/dev/null 2>&1; then
  printf 'Port 19341 is already in use. Stop the Docker deployment or other manager service first.\n' >&2
  exit 1
fi

TEMP_ROOT="$(/usr/bin/mktemp -d -t codex-dream-skin-manager-install.XXXXXX)"
BACKUP_ROOT=""
cleanup() {
  /bin/rm -rf "$TEMP_ROOT"
  if [ -n "$BACKUP_ROOT" ] && [ -d "$BACKUP_ROOT" ]; then
    /bin/rm -rf "$INSTALL_ROOT"
    /bin/mv "$BACKUP_ROOT" "$INSTALL_ROOT"
  fi
}
trap cleanup EXIT
ARCHIVE_PATH="$TEMP_ROOT/$ASSET_NAME"
CHECKSUM_PATH="$TEMP_ROOT/SHA256SUMS"

if [ -n "${MANAGER_INSTALL_ARCHIVE:-}" ]; then
  /bin/cp "$MANAGER_INSTALL_ARCHIVE" "$ARCHIVE_PATH"
  if [ -n "${MANAGER_INSTALL_CHECKSUMS:-}" ]; then /bin/cp "$MANAGER_INSTALL_CHECKSUMS" "$CHECKSUM_PATH"; fi
else
  if [ -n "${MANAGER_INSTALL_VERSION:-}" ]; then
    RELEASE_ROOT="https://github.com/$REPOSITORY/releases/download/v${MANAGER_INSTALL_VERSION}"
  else
    RELEASE_ROOT="https://github.com/$REPOSITORY/releases/latest/download"
  fi
  printf 'Downloading Codex Dream Skin Manager...\n'
  /usr/bin/curl --fail --silent --show-error --location "$RELEASE_ROOT/$ASSET_NAME" --output "$ARCHIVE_PATH"
  /usr/bin/curl --fail --silent --show-error --location "$RELEASE_ROOT/SHA256SUMS" --output "$CHECKSUM_PATH"
fi

if [ -f "$CHECKSUM_PATH" ]; then
  EXPECTED="$(/usr/bin/awk -v name="$ASSET_NAME" '$2 == name { print $1 }' "$CHECKSUM_PATH")"
  [ -n "$EXPECTED" ] || { printf 'Release checksum does not contain %s.\n' "$ASSET_NAME" >&2; exit 1; }
  ACTUAL="$(/usr/bin/shasum -a 256 "$ARCHIVE_PATH" | /usr/bin/awk '{ print $1 }')"
  [ "$ACTUAL" = "$EXPECTED" ] || { printf 'Release checksum verification failed.\n' >&2; exit 1; }
else
  printf 'Refusing installation without a checksum file.\n' >&2
  exit 1
fi

/usr/bin/tar -xzf "$ARCHIVE_PATH" -C "$TEMP_ROOT"
EXTRACTED_ROOT="$TEMP_ROOT/codex-dream-skin-manager"
[ -x "$EXTRACTED_ROOT/bin/codex-dream-skin-manager" ] || { printf 'Release package is incomplete.\n' >&2; exit 1; }
[ -f "$EXTRACTED_ROOT/share/codex-dream-skin-manager/management.html" ] || { printf 'Release package is missing management.html.\n' >&2; exit 1; }

if [ "$NO_START" != "1" ] && [ "$SERVICE_WAS_LOADED" = "true" ]; then
  /bin/launchctl bootout "gui/$(/usr/bin/id -u)/$LABEL"
fi

/bin/mkdir -p "$(/usr/bin/dirname "$INSTALL_ROOT")" "$BIN_DIR" "$(/usr/bin/dirname "$PLIST_PATH")" "$RUNTIME_ROOT" "$LOG_ROOT"
/bin/chmod 700 "$RUNTIME_ROOT" "$LOG_ROOT"
if [ -e "$INSTALL_ROOT" ]; then
  BACKUP_ROOT="${INSTALL_ROOT}.backup.$(/usr/bin/date +%s)"
  /bin/mv "$INSTALL_ROOT" "$BACKUP_ROOT"
fi
/bin/mv "$EXTRACTED_ROOT" "$INSTALL_ROOT"
/bin/ln -sfn "$INSTALL_ROOT/bin/codex-dream-skin-manager" "$BIN_DIR/codex-dream-skin-manager"

PROGRAM_PATH="$INSTALL_ROOT/bin/codex-dream-skin-manager"
MANAGER_LOG="$LOG_ROOT/manager.log"
MANAGER_ERROR_LOG="$LOG_ROOT/manager-error.log"
escape_xml() {
  printf '%s' "$1" | /usr/bin/sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}
PROGRAM_XML="$(escape_xml "$PROGRAM_PATH")"
INSTALL_ROOT_XML="$(escape_xml "$INSTALL_ROOT")"
MANAGER_LOG_XML="$(escape_xml "$MANAGER_LOG")"
MANAGER_ERROR_LOG_XML="$(escape_xml "$MANAGER_ERROR_LOG")"
RUNTIME_ROOT_XML="$(escape_xml "$RUNTIME_ROOT")"
LOG_ROOT_XML="$(escape_xml "$LOG_ROOT")"
NODE_BIN_XML="$(escape_xml "$NODE_BIN")"
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$PROGRAM_XML</string><string>serve</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>WorkingDirectory</key><string>$INSTALL_ROOT_XML</string>
  <key>StandardOutPath</key><string>$MANAGER_LOG_XML</string>
  <key>StandardErrorPath</key><string>$MANAGER_ERROR_LOG_XML</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MANAGER_RUNTIME_DIR</key><string>$RUNTIME_ROOT_XML</string>
    <key>MANAGER_LOG_DIR</key><string>$LOG_ROOT_XML</string>
    <key>MANAGER_NODE_BIN</key><string>$NODE_BIN_XML</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>Umask</key><integer>63</integer>
</dict>
</plist>
PLIST
/bin/chmod 600 "$PLIST_PATH"
/usr/bin/plutil -lint "$PLIST_PATH" >/dev/null

if [ "$NO_START" != "1" ]; then
  /bin/launchctl bootstrap "gui/$(/usr/bin/id -u)" "$PLIST_PATH"
  READY="false"
  for _ in $(/usr/bin/seq 1 50); do
    if /usr/bin/curl --silent --fail --max-time 1 http://127.0.0.1:19341/healthz >/dev/null 2>&1; then READY="true"; break; fi
    /bin/sleep 0.1
  done
  [ "$READY" = "true" ] || { printf 'Service failed to start. See %s.\n' "$MANAGER_ERROR_LOG" >&2; exit 1; }
fi

if [ -n "$BACKUP_ROOT" ] && [ -d "$BACKUP_ROOT" ]; then /bin/rm -rf "$BACKUP_ROOT"; fi
BACKUP_ROOT=""
printf '\nCodex Dream Skin Manager installed successfully.\n'
printf 'Management page: http://localhost:19341/management.html\n'
printf 'Command: %s/codex-dream-skin-manager\n' "$BIN_DIR"
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  printf 'Add %s to PATH to use the command globally.\n' "$BIN_DIR"
fi
