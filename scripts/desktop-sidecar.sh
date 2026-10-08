#!/usr/bin/env bash
#
# Puts the server binary where Tauri expects a sidecar.
#
# Tauri looks for `binaries/<name>-<target-triple>` next to `tauri.conf.json`
# and renames it to `<name>` inside the bundle. Nothing else in the build can
# produce that file, so both `tauri build` and `tauri dev` fail without this
# step - and a dev build that cannot start is exactly what the scenario this
# exists for needs to be able to run.
#
# Usage:
#   scripts/desktop-sidecar.sh            # build the server, then copy it
#   scripts/desktop-sidecar.sh --no-build # copy what is already in dist
#
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
server_dist="$root/apps/server/dist/lantern-server"
binaries="$root/apps/desktop/src-tauri/binaries"

if [ "${1:-}" != "--no-build" ]; then
  echo "building the server…"
  (cd "$root" && pnpm build:server)
fi

if [ ! -f "$server_dist" ]; then
  echo "no server binary at $server_dist" >&2
  echo "run: pnpm build:server" >&2
  exit 1
fi

# The triple rustc is building for; that is the one Tauri will look for.
host="$(rustc -vV | sed -n 's/^host: //p')"
if [ -z "$host" ]; then
  echo "could not read the rust host triple (is rustc installed?)" >&2
  exit 1
fi

# On Windows the compiler produces lantern-server.exe, and Tauri expects the
# suffix on the target name too.
if [ "${OS:-}" = "Windows_NT" ] || [ -f "$server_dist.exe" ]; then
  source="$server_dist.exe"
  target="$binaries/lantern-server-$host.exe"
else
  source="$server_dist"
  target="$binaries/lantern-server-$host"
fi

mkdir -p "$binaries"
cp "$source" "$target"
chmod +x "$target" 2>/dev/null || true

echo "sidecar ready: apps/desktop/src-tauri/binaries/lantern-server-$host"