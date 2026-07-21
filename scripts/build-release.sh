#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { printf 'Node.js 20+ is required.\n' >&2; exit 1; }

VERSION="$($NODE_BIN -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).version' "$PROJECT_ROOT/package.json")"
OUTPUT_ROOT="$PROJECT_ROOT/dist/release"
STAGING_ROOT="$(/usr/bin/mktemp -d -t codex-dream-skin-manager-release.XXXXXX)"
PACKAGE_NAME="codex-dream-skin-manager"
PACKAGE_ROOT="$STAGING_ROOT/$PACKAGE_NAME"
trap '/bin/rm -rf "$STAGING_ROOT"' EXIT

/bin/rm -rf "$OUTPUT_ROOT"
/bin/mkdir -p "$OUTPUT_ROOT" "$PACKAGE_ROOT/bin" "$PACKAGE_ROOT/libexec/src" "$PACKAGE_ROOT/share/codex-dream-skin-manager" "$PACKAGE_ROOT/scripts"

"$NODE_BIN" "$SCRIPT_DIR/build-management-html.mjs" "$OUTPUT_ROOT/management.html" >/dev/null
/bin/cp "$PROJECT_ROOT/bin/codex-dream-skin-manager" "$PACKAGE_ROOT/bin/"
/bin/cp "$PROJECT_ROOT/scripts/uninstall.sh" "$PACKAGE_ROOT/scripts/"
/bin/cp "$PROJECT_ROOT/src/host-agent.mjs" "$PROJECT_ROOT/src/lib.mjs" "$PROJECT_ROOT/src/static-server.mjs" "$PACKAGE_ROOT/libexec/src/"
/bin/cp "$PROJECT_ROOT/package.json" "$PACKAGE_ROOT/libexec/package.json"
/bin/cp "$PROJECT_ROOT/package.json" "$PACKAGE_ROOT/package.json"
/bin/cp "$PROJECT_ROOT/LICENSE" "$PROJECT_ROOT/README.md" "$PROJECT_ROOT/README_EN.md" "$PACKAGE_ROOT/"
/bin/cp "$OUTPUT_ROOT/management.html" "$PACKAGE_ROOT/share/codex-dream-skin-manager/management.html"
/bin/chmod 755 "$PACKAGE_ROOT/bin/codex-dream-skin-manager" "$PACKAGE_ROOT/scripts/uninstall.sh"

/usr/bin/tar -czf "$OUTPUT_ROOT/codex-dream-skin-manager-macos.tar.gz" -C "$STAGING_ROOT" "$PACKAGE_NAME"
PACKAGE_SHA="$(/usr/bin/shasum -a 256 "$OUTPUT_ROOT/codex-dream-skin-manager-macos.tar.gz" | /usr/bin/awk '{ print $1 }')"
"$NODE_BIN" "$SCRIPT_DIR/render-homebrew-formula.mjs" "$VERSION" "$PACKAGE_SHA" "$OUTPUT_ROOT/codex-dream-skin-manager.rb" >/dev/null
(
  cd "$OUTPUT_ROOT"
  /usr/bin/shasum -a 256 codex-dream-skin-manager-macos.tar.gz management.html codex-dream-skin-manager.rb > SHA256SUMS
)

printf 'Built Codex Dream Skin Manager v%s release assets in %s\n' "$VERSION" "$OUTPUT_ROOT"
