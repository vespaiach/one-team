#!/usr/bin/env bash
set -euo pipefail

KEEP=14
NAME="tracklite-$(date -u +%Y-%m-%dT%H-%M-%SZ).dump"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

fail() {
  printf 'Backup failed: %s\n' "$1" >&2
  exit 1
}

pg_dump --format=custom --dbname=tracklite --file="$TMP" >/dev/null 2>&1 || fail dump

[ -n "${BACKUP_REMOTE:-}" ] || fail upload
rclone copyto "$TMP" "$BACKUP_REMOTE/$NAME" >/dev/null 2>&1 || fail upload
printf 'Backup written: %s\n' "$NAME"

LISTING=$(rclone lsf --files-only "$BACKUP_REMOTE" 2>/dev/null) || fail list
OLD=$(printf '%s\n' "$LISTING" | LC_ALL=C sort -r | tail -n +$((KEEP + 1)) | LC_ALL=C sort)
while IFS= read -r object; do
  [ -n "$object" ] || continue
  rclone deletefile "$BACKUP_REMOTE/$object" >/dev/null 2>&1 || fail list
  printf 'Backup deleted: %s\n' "$object"
done <<<"$OLD"
