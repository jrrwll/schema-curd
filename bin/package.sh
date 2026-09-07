#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_DIR}/be"
FRONTEND_DIR="${PROJECT_DIR}/fe"
OUTPUT_DIR="${OUTPUT_DIR:-${PROJECT_DIR}/dist}"
WORK_ROOT="${PROJECT_DIR}/.package-work"
TARGET_ARCH="${1:-${TARGET_ARCH:-amd64}}"
BACKEND_BINARY="${BACKEND_BINARY:-}"
PINGAP_BINARY="${PINGAP_BINARY:-}"
VERSION="$(sed -n 's/^version = "\([^"]*\)"/\1/p' "${BACKEND_DIR}/Cargo.toml" | head -n 1)"
PINGAP_VERSION="0.13.9"

if [[ -z "${VERSION}" ]]; then
  echo "Unable to read project version from be/Cargo.toml" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "The bun command is required to build the frontend" >&2
  exit 1
fi

if ! command -v file >/dev/null 2>&1; then
  echo "The file command is required to verify the Rust backend architecture" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to generate schema.sqlite" >&2
  exit 1
fi

if [[ -z "${PINGAP_BINARY}" ]] && ! command -v curl >/dev/null 2>&1; then
  echo "The curl command is required to download Pingap" >&2
  exit 1
fi

case "${TARGET_ARCH}" in
  amd64|x86_64)
    TARGET_ARCH="amd64"
    PINGAP_ARCH="x86"
    ;;
  arm64|aarch64)
    TARGET_ARCH="arm64"
    PINGAP_ARCH="aarch64"
    ;;
  *)
    echo "Unsupported TARGET_ARCH: ${TARGET_ARCH}. Use amd64 or arm64." >&2
    exit 1
    ;;
esac

PACKAGE_NAME="schema-curd-${VERSION}-linux-${TARGET_ARCH}"
ARCHIVE_PATH="${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz"
mkdir -p "${WORK_ROOT}"
WORK_DIR="$(mktemp -d "${WORK_ROOT}/schema-curd-package.XXXXXX")"
PACKAGE_DIR="${WORK_DIR}/${PACKAGE_NAME}"

cleanup() {
  local work_parent
  local work_name
  work_parent="$(cd -- "$(dirname -- "${WORK_DIR}")" && pwd -P)"
  work_name="$(basename -- "${WORK_DIR}")"
  if [[ ! -d "${WORK_DIR}" || "${work_parent}" != "${WORK_ROOT}" || ! "${work_name}" =~ ^schema-curd-package\.[A-Za-z0-9]+$ ]]; then
    echo "Refusing to clean unexpected work directory: ${WORK_DIR}" >&2
    return 1
  fi
  find "${WORK_DIR}" -depth -delete
  rmdir "${WORK_ROOT}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Building frontend..."
(
  cd "${FRONTEND_DIR}"
  bun install --frozen-lockfile
  bun run build
)

mkdir -p \
  "${PACKAGE_DIR}/be/migrations" \
  "${PACKAGE_DIR}/bin" \
  "${PACKAGE_DIR}/fe" \
  "${OUTPUT_DIR}"

if [[ -n "${BACKEND_BINARY}" ]]; then
  if [[ ! -f "${BACKEND_BINARY}" ]]; then
    echo "BACKEND_BINARY does not exist: ${BACKEND_BINARY}" >&2
    exit 1
  fi
  echo "Using supplied Rust backend binary: ${BACKEND_BINARY}"
  cp "${BACKEND_BINARY}" "${PACKAGE_DIR}/be/schema-curd"
else
  "${SCRIPT_DIR}/build.sh" "${TARGET_ARCH}" "${PACKAGE_DIR}/be/schema-curd"
fi

binary_type="$(file "${PACKAGE_DIR}/be/schema-curd")"
if [[ "${binary_type}" != *"ELF 64-bit"* ]]; then
  echo "Rust backend is not a Linux ELF binary: ${binary_type}" >&2
  exit 1
fi
if [[ "${TARGET_ARCH}" == "amd64" && "${binary_type}" != *"x86-64"* ]]; then
  echo "Rust backend architecture does not match amd64: ${binary_type}" >&2
  exit 1
fi
if [[ "${TARGET_ARCH}" == "arm64" && "${binary_type}" != *"ARM aarch64"* ]]; then
  echo "Rust backend architecture does not match arm64: ${binary_type}" >&2
  exit 1
fi

cp "${BACKEND_DIR}/schema.json" "${WORK_DIR}/schema.json"
"${SCRIPT_DIR}/schema2sqlite.py" "${WORK_DIR}/schema.json"
cp "${WORK_DIR}/schema.sqlite" "${PACKAGE_DIR}/be/schema.sqlite"
cp \
  "${BACKEND_DIR}/migrations/schema.sqlite.sql" \
  "${PACKAGE_DIR}/be/migrations/schema.sqlite.sql"
cp \
  "${BACKEND_DIR}/migrations/schema.mysql.sql" \
  "${PACKAGE_DIR}/be/migrations/schema.mysql.sql"
cp "${BACKEND_DIR}/.env.example" "${PACKAGE_DIR}/be/.env.example"
printf '%s\n' "${TARGET_ARCH}" > "${PACKAGE_DIR}/be/target_arch"
cp -R "${FRONTEND_DIR}/dist" "${PACKAGE_DIR}/fe/dist"
cp "${SCRIPT_DIR}/install.sh" "${PACKAGE_DIR}/bin/install.sh"
cp "${SCRIPT_DIR}/start.sh" "${PACKAGE_DIR}/bin/start.sh"
cp "${SCRIPT_DIR}/stop.sh" "${PACKAGE_DIR}/bin/stop.sh"
cp "${SCRIPT_DIR}/schema2sqlite.py" "${PACKAGE_DIR}/bin/schema2sqlite.py"
cp "${SCRIPT_DIR}/pingap.toml" "${PACKAGE_DIR}/bin/pingap.toml"

if [[ -n "${PINGAP_BINARY}" ]]; then
  if [[ ! -f "${PINGAP_BINARY}" ]]; then
    echo "PINGAP_BINARY does not exist: ${PINGAP_BINARY}" >&2
    exit 1
  fi
  echo "Using local Pingap binary: ${PINGAP_BINARY}"
  cp "${PINGAP_BINARY}" "${PACKAGE_DIR}/bin/pingap"
else
  echo "Downloading Pingap ${PINGAP_VERSION} for linux/${TARGET_ARCH}..."
  PINGAP_ARCHIVE="${WORK_DIR}/pingap.tar.gz"
  PINGAP_EXTRACT_DIR="${WORK_DIR}/pingap-extract"
  PINGAP_RELEASE_BINARY="pingap-linux-gnu-${PINGAP_ARCH}"
  PINGAP_URL="https://github.com/vicanso/pingap/releases/download/v${PINGAP_VERSION}/pingap-linux-gnu-${PINGAP_ARCH}.tar.gz"
  mkdir -p "${PINGAP_EXTRACT_DIR}"
  curl --fail --location --silent --show-error \
    --retry 3 \
    --connect-timeout 20 \
    --output "${PINGAP_ARCHIVE}" \
    "${PINGAP_URL}"
  tar -C "${PINGAP_EXTRACT_DIR}" -xzf "${PINGAP_ARCHIVE}"
  cp "${PINGAP_EXTRACT_DIR}/${PINGAP_RELEASE_BINARY}" "${PACKAGE_DIR}/bin/pingap"
fi

chmod +x \
  "${PACKAGE_DIR}/be/schema-curd" \
  "${PACKAGE_DIR}/bin/pingap" \
  "${PACKAGE_DIR}/bin/install.sh" \
  "${PACKAGE_DIR}/bin/start.sh" \
  "${PACKAGE_DIR}/bin/stop.sh" \
  "${PACKAGE_DIR}/bin/schema2sqlite.py"

find "${PACKAGE_DIR}" -type f -name '.DS_Store' -delete
tar -C "${WORK_DIR}" -czf "${ARCHIVE_PATH}" "${PACKAGE_NAME}"
echo "Package created: ${ARCHIVE_PATH}"
