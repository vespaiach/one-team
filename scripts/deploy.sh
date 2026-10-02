#!/usr/bin/env bash
set -euo pipefail

ssh_opts=(-o ServerAliveInterval=15 -o ServerAliveCountMax=4)

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != main ]; then
  echo "Refused: not on main (on $branch)"
  exit 2
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Refused: uncommitted changes"
  exit 2
fi
if ! GIT_TERMINAL_PROMPT=0 git fetch --quiet origin main >/dev/null 2>&1; then
  echo "Refused: the shared main couldn't be checked"
  exit 2
fi
sha=$(git rev-parse HEAD)
if [ "$sha" != "$(git rev-parse origin/main)" ]; then
  echo "Refused: local main differs from the shared main"
  exit 2
fi

id=$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')
dir=/srv/tracklite/incoming/$id

echo "Uploading"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if ! {
  git archive --format=tar -o "$tmp/release.tar" "$sha" &&
    git show "$sha:ops/release.sh" >"$tmp/release.sh" &&
    git log -1 --format=%s "$sha" >"$tmp/subject" &&
    tar -C "$tmp" -cf - release.tar release.sh subject |
    ssh "${ssh_opts[@]}" tracklite "set -e; mkdir '$dir.tmp'; tar -xmf - -C '$dir.tmp'; mv -T '$dir.tmp' '$dir'"
} >/dev/null 2>&1; then
  echo "Deploy failed: upload"
  exit 1
fi

status=0
ssh "${ssh_opts[@]}" tracklite "bash '$dir/release.sh' deploy $sha" </dev/null || status=$?
case $status in
  0 | 1 | 2 | 3 | 4) exit "$status" ;;
  127)
    echo "Deploy failed: upload"
    exit 1
    ;;
  *)
    echo "Connection lost. If it got past the lock, the deploy continues on the server; run npm run deploy or npm run rollback later to see its outcome."
    exit 4
    ;;
esac
