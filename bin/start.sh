#!/usr/bin/env bash

set -Eeuo pipefail

BIN_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${BIN_DIR}/.." && pwd)"
BACKEND_DIR="${APP_DIR}/be"
BACKEND_BINARY="${BACKEND_DIR}/schema-curd"
LOG_DIR="${APP_DIR}/logs"
RUN_DIR="${APP_DIR}/run"
BACKEND_PID_FILE="${RUN_DIR}/backend.pid"
PINGAP_PID_FILE="${RUN_DIR}/pingap.pid"
BACKEND_LOG="${LOG_DIR}/backend.log"
PINGAP_LOG="${LOG_DIR}/pingap.log"

is_running() {
  local pid_file="$1"
  local pid
  [[ -s "${pid_file}" ]] || return 1
  pid="$(<"${pid_file}")"
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  kill -0 "${pid}" 2>/dev/null
}

if [[ ! -x "${BACKEND_BINARY}" ]]; then
  echo "Rust backend is not installed. Run ./bin/install.sh first." >&2
  exit 1
fi

if [[ ! -x "${BIN_DIR}/pingap" ]]; then
  echo "Pingap executable not found: ${BIN_DIR}/pingap" >&2
  exit 1
fi

if [[ ! -f "${BIN_DIR}/pingap.toml" ]]; then
  echo "Pingap configuration not found: ${BIN_DIR}/pingap.toml" >&2
  exit 1
fi

if is_running "${BACKEND_PID_FILE}" || is_running "${PINGAP_PID_FILE}"; then
  echo "Application is already running."
  [[ -s "${BACKEND_PID_FILE}" ]] && echo "Backend PID: $(<"${BACKEND_PID_FILE}")"
  [[ -s "${PINGAP_PID_FILE}" ]] && echo "Pingap PID: $(<"${PINGAP_PID_FILE}")"
  exit 0
fi

mkdir -p "${LOG_DIR}" "${RUN_DIR}"

(
  cd "${BACKEND_DIR}"
  nohup "${BACKEND_BINARY}" \
    > "${BACKEND_LOG}" 2>&1 < /dev/null &
  echo "$!" > "${BACKEND_PID_FILE}"
)
backend_pid="$(<"${BACKEND_PID_FILE}")"

sleep 1
if ! kill -0 "${backend_pid}" 2>/dev/null; then
  echo "Rust backend failed to start. See ${BACKEND_LOG}" >&2
  tail -n 20 "${BACKEND_LOG}" >&2 || true
  : > "${BACKEND_PID_FILE}"
  exit 1
fi

(
  cd "${APP_DIR}"
  nohup "${BIN_DIR}/pingap" --conf "${BIN_DIR}/pingap.toml" \
    > "${PINGAP_LOG}" 2>&1 < /dev/null &
  echo "$!" > "${PINGAP_PID_FILE}"
)
pingap_pid="$(<"${PINGAP_PID_FILE}")"

sleep 1
if ! kill -0 "${pingap_pid}" 2>/dev/null; then
  echo "Pingap failed to start. See ${PINGAP_LOG}" >&2
  tail -n 20 "${PINGAP_LOG}" >&2 || true
  kill "${backend_pid}" 2>/dev/null || true
  : > "${BACKEND_PID_FILE}"
  : > "${PINGAP_PID_FILE}"
  exit 1
fi

echo "Application started."
echo "Backend PID: ${backend_pid}, log: ${BACKEND_LOG}"
echo "Pingap PID: ${pingap_pid}, log: ${PINGAP_LOG}"
echo "Open http://<server-ip>/"
