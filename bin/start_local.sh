#!/usr/bin/env bash

set -Eeuo pipefail

BIN_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${BIN_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_DIR}/be"
FRONTEND_DIR="${PROJECT_DIR}/fe"
backend_pid=""
frontend_pid=""

cleanup() {
  trap - EXIT INT TERM
  [[ -n "${backend_pid}" ]] && kill "${backend_pid}" 2>/dev/null || true
  [[ -n "${frontend_pid}" ]] && kill "${frontend_pid}" 2>/dev/null || true
  [[ -n "${backend_pid}" ]] && wait "${backend_pid}" 2>/dev/null || true
  [[ -n "${frontend_pid}" ]] && wait "${frontend_pid}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! command -v cargo-watch >/dev/null 2>&1; then
  echo "The cargo-watch command is required; install it with: cargo install cargo-watch" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "The bun command is required to run the frontend" >&2
  exit 1
fi

echo "Starting Rust backend at http://127.0.0.1:8000 with cargo-watch."
echo "Starting frontend at http://127.0.0.1:3000"
echo "Press Ctrl+C to stop both services."

(
  cd "${BACKEND_DIR}"
  exec cargo watch -x run
) &
backend_pid="$!"

(
  cd "${FRONTEND_DIR}"
  exec bun run dev --host 0.0.0.0
) &
frontend_pid="$!"

while kill -0 "${backend_pid}" 2>/dev/null && kill -0 "${frontend_pid}" 2>/dev/null; do
  sleep 1
done
echo "A development service exited; stopping the other service." >&2
exit 1
