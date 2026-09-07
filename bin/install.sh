#!/usr/bin/env bash

set -Eeuo pipefail

BIN_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${BIN_DIR}/.." && pwd)"
BACKEND_BINARY="${APP_DIR}/be/schema-curd"
TARGET_ARCH_FILE="${APP_DIR}/be/target_arch"
PINGAP_BINARY="${BIN_DIR}/pingap"
PINGAP_CONFIG="${BIN_DIR}/pingap.toml"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This production package only supports Linux." >&2
  exit 1
fi

if [[ ! -f "${BACKEND_BINARY}" ]]; then
  echo "Rust backend binary not found: ${BACKEND_BINARY}" >&2
  exit 1
fi

if [[ ! -f "${PINGAP_BINARY}" ]]; then
  echo "Pingap binary not found: ${PINGAP_BINARY}" >&2
  exit 1
fi

if [[ ! -f "${PINGAP_CONFIG}" ]]; then
  echo "Pingap configuration not found: ${PINGAP_CONFIG}" >&2
  exit 1
fi

if [[ ! -f "${TARGET_ARCH_FILE}" ]]; then
  echo "Target architecture metadata not found: ${TARGET_ARCH_FILE}" >&2
  exit 1
fi

target_arch="$(<"${TARGET_ARCH_FILE}")"
case "$(uname -m)" in
  x86_64) host_arch="amd64" ;;
  aarch64|arm64) host_arch="arm64" ;;
  *)
    echo "Unsupported server architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

if [[ "${host_arch}" != "${target_arch}" ]]; then
  echo "Package architecture ${target_arch} does not match server architecture ${host_arch}." >&2
  exit 1
fi

chmod +x "${BACKEND_BINARY}" "${PINGAP_BINARY}" \
  "${BIN_DIR}/start.sh" "${BIN_DIR}/stop.sh"
mkdir -p "${APP_DIR}/logs" "${APP_DIR}/run"

echo "Installation complete for linux/${target_arch}."
echo "Run ./bin/start.sh to start the application."
