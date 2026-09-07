#!/usr/bin/env bash

set -Eeuo pipefail

BIN_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${BIN_DIR}/.." && pwd)"
BACKEND_DIR="${APP_DIR}/be"
RUN_DIR="${APP_DIR}/run"
STOP_TIMEOUT="${STOP_TIMEOUT:-10}"

if [[ ! "${STOP_TIMEOUT}" =~ ^[0-9]+$ ]]; then
  echo "STOP_TIMEOUT must be a non-negative integer" >&2
  exit 1
fi

process_matches() {
  local pid="$1"
  local expected_command="$2"
  local expected_path
  local actual_path=""
  local command_line=""

  expected_path="$(readlink -f "${expected_command}" 2>/dev/null || true)"
  [[ -n "${expected_path}" ]] || expected_path="${expected_command}"

  if [[ -L "/proc/${pid}/exe" ]]; then
    actual_path="$(readlink "/proc/${pid}/exe" 2>/dev/null || true)"
    actual_path="${actual_path% (deleted)}"
    if [[ "${actual_path}" == "${expected_path}" ]]; then
      return 0
    fi
  fi

  if [[ -r "/proc/${pid}/cmdline" ]]; then
    IFS= read -r -d '' command_line < "/proc/${pid}/cmdline" || true
    if [[ "${command_line}" == "${expected_command}" || "${command_line}" == "${expected_path}" ]]; then
      return 0
    fi
  fi

  command_line="$(ps -p "${pid}" -o command= 2>/dev/null || true)"
  [[ "${command_line}" == *"${expected_command}"* || "${command_line}" == *"${expected_path}"* ]]
}

stop_process() {
  local name="$1"
  local pid_file="$2"
  local expected_command="$3"
  local pid
  local waited=0

  if [[ ! -s "${pid_file}" ]]; then
    echo "${name} is not running (PID file not found)."
    return 0
  fi

  pid="$(<"${pid_file}")"
  if [[ ! "${pid}" =~ ^[0-9]+$ ]]; then
    echo "Ignoring invalid ${name} PID file: ${pid_file}" >&2
    : > "${pid_file}"
    return 1
  fi

  if ! kill -0 "${pid}" 2>/dev/null; then
    echo "${name} is not running (stale PID ${pid})."
    : > "${pid_file}"
    return 0
  fi

  if ! process_matches "${pid}" "${expected_command}"; then
    echo "Refusing to stop ${name}: PID ${pid} does not match ${expected_command}" >&2
    return 1
  fi

  echo "Stopping ${name} (PID ${pid})..."
  kill -TERM "${pid}"

  while kill -0 "${pid}" 2>/dev/null && (( waited < STOP_TIMEOUT )); do
    sleep 1
    (( waited += 1 ))
  done

  if kill -0 "${pid}" 2>/dev/null; then
    echo "${name} did not stop within ${STOP_TIMEOUT}s; sending KILL." >&2
    kill -KILL "${pid}"
  fi

  : > "${pid_file}"
  echo "${name} stopped."
}

status=0
stop_process "Pingap" "${RUN_DIR}/pingap.pid" "${BIN_DIR}/pingap" || status=1
stop_process "Rust backend" "${RUN_DIR}/backend.pid" "${BACKEND_DIR}/schema-curd" || status=1
exit "${status}"
