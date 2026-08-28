#!/usr/bin/env sh
set -eu

[ "$#" -eq 1 ] || { echo "Usage: $0 <https-web-origin>" >&2; exit 2; }
web_origin="${1%/}"
case "$web_origin" in
  https://*) ;;
  *) echo "Web origin must use HTTPS." >&2; exit 2 ;;
esac

temporary_directory="$(mktemp -d)"
headers="$temporary_directory/headers"
body="$temporary_directory/body"
trap 'rm -f "$headers" "$body"; rmdir "$temporary_directory"' EXIT

status="$(curl --silent --show-error --dump-header "$headers" --output "$body" \
  --write-out '%{http_code}' "$web_origin/")"
[ "$status" = "200" ] || { echo "Web root returned $status." >&2; exit 1; }
grep -Eiq '^content-security-policy:.*frame-ancestors .none.' "$headers"
grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' "$headers"
grep -Eiq '^x-frame-options:[[:space:]]*DENY' "$headers"
grep -Eiq '^permissions-policy:.*camera=\(\).*microphone=\(\)' "$headers"
grep -Eiq '^strict-transport-security:' "$headers"

status="$(curl --silent --show-error --output "$body" --write-out '%{http_code}' \
  --request POST "$web_origin/not-api")"
[ "$status" = "405" ] || { echo "Unexpected static POST status $status." >&2; exit 1; }
if grep -Eiq 'stack|node_modules|/workspace/' "$body"; then
  echo "Web error response leaked implementation details." >&2
  exit 1
fi

echo "Web security smoke passed: $web_origin"
