#!/usr/bin/env bash
set -euo pipefail

ssh_opts=(-o ServerAliveInterval=15 -o ServerAliveCountMax=4)

remote='if [ -L /srv/tracklite/current ]; then
  exec bash /srv/tracklite/current/ops/release.sh rollback
fi
script=$(ls -t /srv/tracklite/incoming/????????????????/release.sh 2>/dev/null | head -n 1)
if [ -n "$script" ]; then
  exec bash "$script" rollback
fi
echo "Refused: nothing to roll back to"
exit 2'

status=0
ssh "${ssh_opts[@]}" tracklite "$remote" </dev/null || status=$?
case $status in
  0 | 1 | 2 | 3 | 4) exit "$status" ;;
  *)
    echo "Connection lost. If it got past the lock, the rollback continues on the server; run npm run deploy or npm run rollback later to see its outcome."
    exit 4
    ;;
esac
