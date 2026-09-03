#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_OWNER="$(stat -c '%u:%g' "$ROOT")"
ROOT_OWNER_USER="$(stat -c '%U' "$ROOT")"
ROOT_OWNER_HOME="$(getent passwd "$ROOT_OWNER_USER" | cut -d: -f6)"
BUILD_VENV="/tmp/llm-speed-chat-build-check"
WHEEL_VENV="/tmp/llm-speed-chat-wheel-check"
CONTAINER_NAME="llm-speed-chat-release-smoke"

repair_workspace_ownership() {
  if [ "$(id -u)" -eq 0 ]; then
    chown -R "$ROOT_OWNER" "$ROOT"
  fi
}

run_as_workspace_owner() {
  if [ "$(id -u)" -eq 0 ] && [ "$ROOT_OWNER_USER" != "root" ]; then
    HOME="$ROOT_OWNER_HOME" XDG_CACHE_HOME="$ROOT_OWNER_HOME/.cache" runuser -u "$ROOT_OWNER_USER" -- "$@"
    return
  fi
  "$@"
}

cleanup() {
  if command -v docker >/dev/null 2>&1; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
  repair_workspace_ownership
}

trap cleanup EXIT

cd "$ROOT"
repair_workspace_ownership

if [ "${SKIP_NPM_CI:-0}" != "1" ]; then
  run_as_workspace_owner npm ci
fi

if [ "${SKIP_PLAYWRIGHT_INSTALL:-0}" != "1" ]; then
  if [ "$(id -u)" -eq 0 ] && [ "$ROOT_OWNER_USER" != "root" ]; then
    npx playwright install-deps chromium
    run_as_workspace_owner npx playwright install chromium
  else
    run_as_workspace_owner npx playwright install --with-deps chromium
  fi
fi

run_as_workspace_owner python3 -m unittest discover -s tests -v
run_as_workspace_owner npm run test:e2e

rm -rf "$BUILD_VENV" "$WHEEL_VENV"
run_as_workspace_owner rm -rf "$ROOT/dist" "$ROOT/build" "$ROOT/src/llm_speed_chat.egg-info"
run_as_workspace_owner python3 -m venv "$BUILD_VENV"
run_as_workspace_owner "$BUILD_VENV/bin/python" -m pip install --upgrade pip build twine
run_as_workspace_owner "$BUILD_VENV/bin/python" -m build
run_as_workspace_owner "$BUILD_VENV/bin/python" -m twine check dist/*

run_as_workspace_owner python3 -m venv "$WHEEL_VENV"
run_as_workspace_owner "$WHEEL_VENV/bin/python" -m pip install dist/*.whl
(
  cd /tmp
  run_as_workspace_owner "$WHEEL_VENV/bin/python" "$ROOT/scripts/smoke-installed.py"
)

if command -v docker >/dev/null 2>&1; then
  docker build -t llm-speed-chat:test .
  docker run -d --rm --name "$CONTAINER_NAME" -p 18080:8080 llm-speed-chat:test
  run_as_workspace_owner python3 scripts/smoke_http.py --base-url http://127.0.0.1:18080 --wait-seconds 30
else
  echo "docker not found; skipped container smoke"
fi

run_as_workspace_owner python3 scripts/audit-release-metadata.py --strict
