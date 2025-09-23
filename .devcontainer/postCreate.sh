#!/usr/bin/env bash
set -euxo pipefail
echo "[postCreate] start"
# If you later add Node-based tooling, uncomment below:
# if command -v node >/dev/null && [ -f package.json ]; then
#   (corepack enable || true)
#   (pnpm i || npm ci || true)
# fi
echo "[postCreate] done"
