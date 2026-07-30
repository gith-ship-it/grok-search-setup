#!/usr/bin/env bash
# grok-search-setup - one-line installer (Linux / macOS)
#
#   curl -fsSL https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main/install.sh | bash
#
# Non-interactive (CI): CPA_KEY=sk-xxx curl -fsSL .../install.sh | bash
# Uninstall:            curl -fsSL .../install.sh | bash -s -- --uninstall
set -euo pipefail

REPO="${GROK_SETUP_REPO:-https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main}"
export GROK_SETUP_REPO="$REPO"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required (grok-search-rs ships as a node-installed binary)." >&2
  echo "Install it: https://nodejs.org  — or:  nvm install --lts" >&2
  exit 1
fi

if [ "${1:-}" = "--uninstall" ]; then
  export GROK_UNINSTALL=1
else
  KEY="${CPA_KEY:-}"
  if [ -z "$KEY" ] && [ -r /dev/tty ]; then
    printf "Enter CLIProxyAPI key (sk-...): " > /dev/tty
    IFS= read -rs KEY < /dev/tty || true
    echo > /dev/tty
  fi
  if [ -z "$KEY" ]; then
    echo "No CPA key provided. Re-run in an interactive terminal, or: CPA_KEY=sk-xxx curl ... | bash" >&2
    exit 1
  fi
  export GROK_CPA_KEY="$KEY"
  URL="${CPA_URL:-}"
  if [ -z "$URL" ] && [ -r /dev/tty ]; then
    printf "Endpoint base URL — your CLIProxyAPI/proxy, e.g. https://your-host/v1 [default https://api.x.ai/v1]: " > /dev/tty
    IFS= read -r URL < /dev/tty || true
  fi
  export GROK_URL="${URL:-https://api.x.ai/v1}"
  export GROK_MODEL="${GROK_MODEL:-grok-4.5}"
  export GROK_TIMEOUT="${GROK_TIMEOUT:-150}"
  export GROK_X_SEARCH="${GROK_X_SEARCH:-true}"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$REPO/configure.mjs" -o "$TMP/configure.mjs"
node "$TMP/configure.mjs"
