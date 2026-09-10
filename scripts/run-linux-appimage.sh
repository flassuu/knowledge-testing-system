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
APPIMAGE="${APPIMAGE:-$SCRIPT_DIR/testing-system-teacher_0.1.0_amd64.AppImage}"

chmod +x "$APPIMAGE"

export WEBKIT_DISABLE_DMABUF_RENDERER=1
export LD_PRELOAD="${LD_PRELOAD:+$LD_PRELOAD:}/usr/lib/libwayland-client.so"

exec "$APPIMAGE" "$@"