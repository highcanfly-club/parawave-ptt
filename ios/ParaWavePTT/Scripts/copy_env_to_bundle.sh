#!/bin/bash
# Copy the .env file from project root into the built app bundle resources so the app can read it at runtime.
# Add this script as a Run Script build phase in your iOS target (see README in the Scripts folder).

set -e

# PROJECT_DIR points to the directory containing the Xcode project file for this build
SRC_ENV_PATH="${PROJECT_DIR}/.env"
TARGET_ENV_PATH="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/.env"

if [ -f "${SRC_ENV_PATH}" ]; then
  echo "📦 Copying .env into app bundle: ${TARGET_ENV_PATH}"
  mkdir -p "$(dirname "${TARGET_ENV_PATH}")"
  cp "${SRC_ENV_PATH}" "${TARGET_ENV_PATH}" || true
else
  echo "⚠️ .env not found at ${SRC_ENV_PATH} — skipping copy"
fi
