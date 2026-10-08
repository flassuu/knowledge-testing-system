#!/usr/bin/env bash
set -euo pipefail

# Launcher for the Linux AppImage on machines where WebKitGTK cannot create
# an EGL display (e.g. Mesa 26 + Wayland compositors such as Hyprland),
# which results in a blank/white window.
#
# Two things are needed:
#   1. WEBKIT_DISABLE_DMABUF_RENDERER=1 — disable the newer DMA-BUF renderer
#      (the standard fix for blank WebKitGTK windows on Wayland).
#   2. LD_PRELOAD of the SYSTEM libwayland-client — the AppImage bundles an
#      older libwayland-client that is ABI-incompatible with libEGL from
#      Mesa 26, making EGL init abort with EGL_BAD_PARAMETER.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# The bundle is named after productName, so it is `LANtern_<version>_amd64.AppImage`
# — mixed case, and a different version every release. Globbing it means this
# launcher keeps working across releases instead of needing an edit each time;
# set APPIMAGE to point at a specific build.
if [ -n "${APPIMAGE:-}" ]; then
  :
else
  APPIMAGE="$(ls -1t "$SCRIPT_DIR"/LANtern_*_amd64.AppImage 2>/dev/null | head -n 1 || true)"
  if [ -z "$APPIMAGE" ]; then
    echo "No LANtern AppImage next to this script ($SCRIPT_DIR)." >&2
    echo "Build one with: NO_STRIP=true pnpm --filter @lantern/desktop tauri build" >&2
    echo "or point APPIMAGE at the file you want to run." >&2
    exit 1
  fi
fi

chmod +x "$APPIMAGE"

export WEBKIT_DISABLE_DMABUF_RENDERER=1
export LD_PRELOAD="${LD_PRELOAD:+$LD_PRELOAD:}/usr/lib/libwayland-client.so"

exec "$APPIMAGE" "$@"