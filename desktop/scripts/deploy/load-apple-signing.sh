#!/usr/bin/env bash
# Load Apple code-signing and notarization env for macOS distribution builds.
# Priority: existing env (ops-dashboard) → APPLE_SIGNING_ENV → scripts/deploy/apple-signing.env → .env
set -euo pipefail

_DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$_DEPLOY_DIR/../.." && pwd)"
export PROJECT_APP_ENV="${PROJECT_APP_ENV:-$ROOT/.env}"

_LOADED=""

load_env_file() {
  local file="$1"
  local base_dir="${2:-}"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  set -a
  # shellcheck source=/dev/null
  source "$file"
  set +a
  if [[ -n "$base_dir" && -n "${APPLE_API_KEY_PATH:-}" && "${APPLE_API_KEY_PATH#/}" == "$APPLE_API_KEY_PATH" ]]; then
    APPLE_API_KEY_PATH="$(cd "$base_dir" && pwd)/$APPLE_API_KEY_PATH"
    export APPLE_API_KEY_PATH
  fi
  _LOADED="$file"
  return 0
}

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  if [[ -n "${APPLE_SIGNING_ENV:-}" ]] && load_env_file "$APPLE_SIGNING_ENV"; then
    :
  elif load_env_file "$_DEPLOY_DIR/apple-signing.env"; then
    :
  elif [[ -n "${PROJECT_APP_ENV:-}" ]] && load_env_file "$PROJECT_APP_ENV"; then
    :
  else
    echo "⚠ No signing env found (configure ops-dashboard Release, scripts/deploy/apple-signing.env, or .env)" >&2
  fi
fi

if [[ -n "$_LOADED" ]]; then
  echo "→ Loaded Apple signing env from $_LOADED"
fi

export CSC_NAME="${CSC_NAME:-${APPLE_SIGNING_IDENTITY:-}}"
export CSC_IDENTITY_AUTO_DISCOVERY="${CSC_IDENTITY_AUTO_DISCOVERY:-false}"

if [[ -n "${APPLE_PASSWORD:-}" && -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  export APPLE_APP_SPECIFIC_PASSWORD="$APPLE_PASSWORD"
fi

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "✗ APPLE_SIGNING_IDENTITY is not set" >&2
  exit 1
fi

if ! security find-identity -p codesigning -v 2>/dev/null | grep -Fq "$APPLE_SIGNING_IDENTITY"; then
  echo "✗ Signing identity not found in keychain: $APPLE_SIGNING_IDENTITY" >&2
  exit 1
fi

has_notary_auth() {
  [[ -n "${NOTARYTOOL_PROFILE:-}" ]] && return 0
  [[ -n "${APPLE_API_KEY_PATH:-}" && -f "${APPLE_API_KEY_PATH:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" ]] && return 0
  [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]] && return 0
  return 1
}

if has_notary_auth; then
  export KLOY_NOTARIZE="${KLOY_NOTARIZE:-1}"
  export RELAYBASE_NOTARIZE="${RELAYBASE_NOTARIZE:-1}"
else
  export KLOY_NOTARIZE="${KLOY_NOTARIZE:-0}"
  export RELAYBASE_NOTARIZE="${RELAYBASE_NOTARIZE:-0}"
  echo "⚠ Notarization credentials not configured; build will sign only." >&2
fi

# Default updater signing key path when not set in .env / ops-dashboard.
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -f "$ROOT/src-tauri/.tauri-signing/updater.key" ]]; then
  export TAURI_SIGNING_PRIVATE_KEY_PATH="$ROOT/src-tauri/.tauri-signing/updater.key"
fi

# Always merge TAURI updater vars from repo .env (apple-signing.env may load without .env).
if [[ -f "${PROJECT_APP_ENV:-}" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^TAURI_SIGNING_PRIVATE_KEY(_PATH|_PASSWORD)?= ]] || continue
    # shellcheck disable=SC2163
    export "$line"
  done < "${PROJECT_APP_ENV}"
fi
