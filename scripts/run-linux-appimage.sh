#!/usr/bin/env bash
set -euo pipefail

# Launcher for the Tauri Linux AppImage on machines where WebKitGTK cannot
# create an EGL display (e.g. Intel Skylake GPUs on Wayland), which results
# in a blank window. Forces software rendering / disables the DMABUF renderer.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APPIMAGE="${APPIMAGE:-$SCRIPT_DIR/testing-system-teacher_0.1.0_amd64.AppImage}"

chmod +x "$APPIMAGE"

exec env \
  WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  LIBGL_ALWAYS_SOFTWARE=1 \
  "$APPIMAGE" "$@"