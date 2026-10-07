#!/usr/bin/env bash
#
# Smoke test for the server console, in CI and locally.
#
# The interactive console only appears when stdin is a terminal, so testing it
# needs a pty - which is also why this cannot run on Windows, where `script`
# does not exist. The second half is the opposite: a run with the output piped
# must stay machine-readable, because that is the contract `systemd`,
# `journalctl` and this repository's own CI rely on.
#
# Usage: scripts/console-smoke.sh [--no-build]
#
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
binary="$root/apps/server/dist/testing-server"
workdir="$(mktemp -d)"
port=3471
fifo="$workdir/console.in"

cleanup() {
  [[ -p "$fifo" ]] && rm -f "$fifo"
  [[ -d "$workdir" ]] && rm -rf "$workdir"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if [ "${1:-}" != "--no-build" ]; then
  echo "building the server…"
  (cd "$root" && pnpm build:server)
fi
[ -f "$binary" ] || fail "no server binary at $binary"

if ! command -v script >/dev/null 2>&1; then
  fail "script(1) is missing: this check needs a pty and cannot run here"
fi

echo "== the interactive console, on a pty"
mkfifo "$fifo"
ADMIN_PASSWORD=smoke-console-pw script -qec \
  "$binary --port $port --data $workdir/data --webroot $root/apps/web-client/dist" \
  /dev/null <"$fifo" >"$workdir/tty.log" 2>&1 &
console_pid=$!

# Holding the fifo open, so the pty does not see end-of-input at once.
exec 3>"$fifo"

for _ in $(seq 1 40); do
  if grep -q "listening" "$workdir/tty.log" 2>/dev/null; then break; fi
  sleep 0.5
done
grep -q "listening" "$workdir/tty.log" || fail "the server never reported that it started"

# A terminal gets human lines: level, colour, columns - not JSON.
grep -q $'\033\[' "$workdir/tty.log" || fail "no colour on a terminal: the human formatter did not run"
if grep -q '^{' "$workdir/tty.log"; then
  fail "JSON on a terminal: the piped format leaked into the console"
fi

echo "status" >&3
sleep 1
grep -q "uptime" "$workdir/tty.log" || fail "the status command printed nothing"
grep -q "log level" "$workdir/tty.log" || fail "the status command is missing the log level"

echo "approve nobody" >&3
sleep 1
grep -q "no such account" "$workdir/tty.log" || fail "the approve command did not report the missing account"

echo "stop" >&3
for _ in $(seq 1 20); do
  if grep -q "stopping the server" "$workdir/tty.log"; then break; fi
  sleep 0.5
done
grep -q "stopping the server" "$workdir/tty.log" || fail "stop printed no confirmation"
wait "$console_pid" 2>/dev/null || true
exec 3>&-
echo "   console: ok"

echo "== a piped run stays machine-readable"
ADMIN_PASSWORD=smoke-console-pw "$binary" \
  --port $((port + 1)) --data "$workdir/data2" --no-console \
  >"$workdir/pipe.log" 2>&1 &
piped_pid=$!
trap 'kill "$piped_pid" 2>/dev/null || true; cleanup' EXIT

for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:$((port + 1))/api/health" -o "$workdir/health.json"; then break; fi
  sleep 0.5
done
[ -s "$workdir/health.json" ] || fail "the piped server never answered /api/health"

# No console on a pipe: the banner would mean someone reads it as a log line.
if grep -q "server console" "$workdir/pipe.log"; then
  fail "the console appeared with the output piped"
fi

# Every line is JSON, which is what journalctl and CI consume.
node -e '
const fs = require("node:fs")
const lines = fs.readFileSync(process.argv[1], "utf8").split("\n").filter((l) => l.trim() !== "")
if (lines.length === 0) { console.error("no output at all"); process.exit(1) }
for (const [index, line] of lines.entries()) {
  try {
    const record = JSON.parse(line)
    if (typeof record.level !== "number") throw new Error("no level")
  } catch (error) {
    console.error(`line ${index + 1} is not a log record: ${line.slice(0, 80)}`)
    process.exit(1)
  }
}
console.log(`   ${lines.length} lines, all JSON`)
' "$workdir/pipe.log" || fail "piped output is not JSON"

kill "$piped_pid" 2>/dev/null || true
wait "$piped_pid" 2>/dev/null || true

echo "console smoke: ok"