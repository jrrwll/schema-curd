#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_DIR}/be"
TARGET_ARCH="${1:-amd64}"
OUTPUT_PATH="${2:-${BACKEND_DIR}/schema-curd-linux-${TARGET_ARCH}}"
WORK_ROOT="${PROJECT_DIR}/.build-work"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to cross-build the Linux backend" >&2
  exit 1
fi

case "${TARGET_ARCH}" in
  amd64|x86_64)
    TARGET_ARCH="amd64"
    PLATFORM="linux/amd64"
    ;;
  arm64|aarch64)
    TARGET_ARCH="arm64"
    PLATFORM="linux/arm64"
    ;;
  *)
    echo "Unsupported target architecture: ${TARGET_ARCH}. Use amd64 or arm64." >&2
    exit 1
    ;;
esac

mkdir -p "${WORK_ROOT}"
WORK_DIR="$(mktemp -d "${WORK_ROOT}/backend-build.XXXXXX")"

cleanup() {
  local work_parent
  local work_name
  work_parent="$(cd -- "$(dirname -- "${WORK_DIR}")" && pwd -P)"
  work_name="$(basename -- "${WORK_DIR}")"
  if [[ ! -d "${WORK_DIR}" || "${work_parent}" != "${WORK_ROOT}" || ! "${work_name}" =~ ^backend-build\.[A-Za-z0-9]+$ ]]; then
    echo "Refusing to clean unexpected build directory: ${WORK_DIR}" >&2
    return 1
  fi
  find "${WORK_DIR}" -depth -delete
  rmdir "${WORK_ROOT}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Building Rust backend for ${PLATFORM}..."
DOCKER_BUILDKIT=1 docker build \
  --platform "${PLATFORM}" \
  --file "${SCRIPT_DIR}/Dockerfile.cross" \
  --target artifact \
  --output "type=local,dest=${WORK_DIR}/artifact" \
  "${BACKEND_DIR}"

if [[ ! -f "${WORK_DIR}/artifact/schema-curd" ]]; then
  echo "Backend build did not produce schema-curd" >&2
  exit 1
fi

mkdir -p "$(dirname -- "${OUTPUT_PATH}")"
cp "${WORK_DIR}/artifact/schema-curd" "${OUTPUT_PATH}"
chmod +x "${OUTPUT_PATH}"
echo "Backend binary created: ${OUTPUT_PATH}"
