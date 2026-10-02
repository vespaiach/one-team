#!/usr/bin/env bash
set -euo pipefail

ROOT=/srv/tracklite
RELEASES=$ROOT/releases
RUNS=$ROOT/runs
INCOMING=$ROOT/incoming
LOCK=$ROOT/release.lock
HISTORY=$ROOT/live-history
SCRIPT=$(readlink -f "${BASH_SOURCE[0]}")
HERE=$(dirname "$SCRIPT")

iso() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

slot() {
  if [ -L "$ROOT/$1" ]; then
    basename "$(readlink "$ROOT/$1")"
  fi
}

set_slot() {
  rm -f "$ROOT/$1.next"
  ln -s "releases/$2" "$ROOT/$1.next"
  mv -T "$ROOT/$1.next" "$ROOT/$1"
}

field() { sed -n "s/^$2=//p" "$1" | tail -n 1; }
record() { printf '%s=%s\n' "$2" "$3" >>"$1"; }

unit() { printf 'tracklite@%s.service' "$1"; }
main_pid() { systemctl show -p MainPID --value "$(unit "$1")"; }
start_instance() { sudo -n systemctl start "$(unit "$1")"; }
stop_instance() { sudo -n systemctl stop "$(unit "$1")"; }
set_oom() { { printf '%s\n' "$2" >"/proc/$1/oom_score_adj"; } 2>/dev/null; }

running_instances() {
  systemctl list-units --all --plain --no-legend 'tracklite@*.service' |
    awk '$3 != "inactive" { sub(/^tracklite@/, "", $1); sub(/\.service$/, "", $1); print $1 }'
}

stop_others() {
  local live id
  live=$(slot current)
  for id in $(running_instances); do
    if [ "$id" != "$live" ]; then
      stop_instance "$id" >/dev/null 2>&1 &
    fi
  done
  wait
}

append_history() {
  if [ "$(tail -n 1 "$HISTORY" 2>/dev/null)" != "$1" ]; then
    printf '%s\n' "$1" >>"$HISTORY"
  fi
}

same_commit() {
  [ "$(cat "$RELEASES/$1/REVISION" 2>/dev/null)" = "$(cat "$RELEASES/$2/REVISION" 2>/dev/null)" ]
}

# Sets SLOT_UNCHECKED=1 when psql fails although the check should run (T020a); previous is then left as it is.
check_slot() {
  local found names name
  SLOT_UNCHECKED=
  [ -L "$ROOT/current" ] || return 0
  found=$(psql -X -q -d tracklite -Atc "select to_regclass('public.schema_migrations') is not null" 2>/dev/null) || {
    SLOT_UNCHECKED=1
    return 0
  }
  [ "$found" = t ] || return 0
  names=$(psql -X -q -d tracklite -Atc 'select name from schema_migrations' 2>/dev/null) || {
    SLOT_UNCHECKED=1
    return 0
  }
  while IFS= read -r name; do
    if [ -n "$name" ] && [ ! -f "$ROOT/current/migrations/$name" ]; then
      rm -f "$ROOT/previous"
      return 0
    fi
  done <<<"$names"
}

prune_runs() {
  local newest
  newest=$(find "$RUNS" -maxdepth 1 -name '*.record' | sort | tail -n 1)
  find "$RUNS" -maxdepth 1 -type f -mmin +20160 ! -path "$newest" -delete 2>/dev/null || true
}

prune_releases() {
  local whole=${1:-} current previous keep dir id
  current=$(slot current)
  previous=$(slot previous)
  keep=$(tac "$HISTORY" 2>/dev/null | awk -v c="$current" '$0 != "" && $0 != c && !seen[$0]++' | head -n 5)
  for dir in "$RELEASES"/*/; do
    [ -d "$dir" ] || continue
    id=$(basename "$dir")
    if [ "$id" = "$current" ] || [ "$id" = "$previous" ] || [ "$id" = "$whole" ]; then
      continue
    fi
    if grep -qxF "$id" <<<"$keep"; then
      {
        find "$dir" -mindepth 1 -maxdepth 1 ! -name .next -exec rm -rf {} + &&
          { [ ! -d "$dir/.next" ] || find "$dir/.next" -mindepth 1 -maxdepth 1 ! -name static -exec rm -rf {} +; }
      } 2>/dev/null || printf '%s\n' "${dir%/}"
    else
      rm -rf "$dir" 2>/dev/null || printf '%s\n' "${dir%/}"
    fi
  done
  {
    tac "$HISTORY" 2>/dev/null | awk -v c="$current" '$0 != "" && $0 != c && !seen[$0]++' | head -n 5 | tac
    if [ -n "$current" ]; then
      printf '%s\n' "$current"
    fi
  } >"$HISTORY.next"
  mv -T "$HISTORY.next" "$HISTORY"
}

live_text() {
  local live
  live=$(slot current)
  if [ -n "$live" ]; then
    printf '%s is live' "$live"
  else
    printf 'nothing is live yet'
  fi
}

report() {
  local rec=$1 cmd commit started outcome line warning
  cmd=$(field "$rec" command)
  commit=$(field "$rec" commit)
  started=$(field "$rec" started)
  outcome=$(field "$rec" outcome)
  case $outcome in
    succeeded)
      line="Last $cmd (${commit:0:7}, started $started): succeeded at $(field "$rec" ended)"
      while IFS= read -r warning; do
        line="$line; Warning: $warning"
      done < <(sed -n 's/^warning=//p' "$rec")
      ;;
    failed) line="Last $cmd (${commit:0:7}, started $started): failed: $(field "$rec" reason)" ;;
    *) line="Last $cmd ($(field "$rec" to), started $started) was interrupted; $(live_text)" ;;
  esac
  printf '%s\n' "$line"
  record "$rec" reported "$(now)" 2>/dev/null || true
}

report_ended() {
  local rec
  for rec in $(find "$RUNS" -maxdepth 1 -name '*.record' | sort -r); do
    if [ -n "$(field "$rec" outcome)" ]; then
      if [ -z "$(field "$rec" reported)" ]; then
        report "$rec"
      fi
      return 0
    fi
  done
}

finish_interrupted() {
  local rec=$1 session cmd from to live id
  session=$(field "$rec" session)
  if [ -n "$session" ] && pgrep -s "$session" >/dev/null; then
    kill -KILL -- "-$session" 2>/dev/null || true
  fi
  cmd=$(field "$rec" command)
  from=$(field "$rec" from)
  to=$(field "$rec" to)
  live=$(slot current)
  if [ "$cmd" = deploy ] && [ -n "$live" ] && [ "$live" = "$to" ]; then
    if [ -n "$from" ] && ! same_commit "$from" "$to"; then
      set_slot previous "$from" || rm -f "$ROOT/previous"
    fi
    append_history "$to"
  elif [ "$cmd" = rollback ] && [ -n "$live" ] && [ "$live" = "$to" ]; then
    rm -f "$ROOT/previous"
    append_history "$to"
  else
    check_slot
  fi
  record "$rec" outcome interrupted
  stop_others
  if [ -n "$live" ] && [ "$(main_pid "$live")" = 0 ]; then
    start_instance "$live" >/dev/null 2>&1 || true
  fi
  report "$rec"
}

front_prepare() {
  local cmd=$1 last epoch stamp target=
  last=$(find "$RUNS" -maxdepth 1 -name '*.record' | sort | tail -n 1)
  if [ -n "$last" ]; then
    if [ -z "$(field "$last" outcome)" ]; then
      finish_interrupted "$last"
    elif [ -z "$(field "$last" reported)" ]; then
      report "$last"
    fi
  fi
  check_slot
  if [ "$cmd" = rollback ]; then
    target=$(slot previous)
    if [ -z "$target" ] || [ ! -L "$ROOT/current" ]; then
      echo "Refused: nothing to roll back to"
      exit 2
    fi
    if [ -n "$SLOT_UNCHECKED" ]; then
      echo "Refused: database could not be checked"
      exit 2
    fi
    SHA=$(cat "$RELEASES/$target/REVISION")
  fi
  while :; do
    epoch=$(date -u +%s)
    stamp=$(date -u -d "@$epoch" +%Y%m%dT%H%M%SZ)
    REC=$RUNS/$stamp-$cmd.record
    [ -e "$REC" ] || break
    sleep 1
  done
  FROM=$(slot current)
  TO=${target:-$stamp-${SHA:0:7}}
  {
    record "$REC" command "$cmd"
    record "$REC" commit "$SHA"
    record "$REC" from "$FROM"
    record "$REC" to "$TO"
    record "$REC" started "$(iso "$epoch")"
  }
}

front() {
  local cmd=$1 running worker outcome
  exec 9<>"$LOCK"
  if ! flock -n 9; then
    exec 9>&-
    report_ended
    running=$(cat "$LOCK")
    echo "Refused: a ${running:-deploy} is running"
    exit 3
  fi
  printf '%s\n' "$cmd" >"$LOCK"
  front_prepare "$cmd" 9>&-
  setsid bash "$SCRIPT" worker "$REC" </dev/null >>"${REC%.record}.log" 2>&1 &
  worker=$!
  exec 9>&-
  tail -n +1 -f --pid="$worker" "${REC%.record}.log"
  outcome=$(field "$REC" outcome)
  if [ -n "$outcome" ]; then
    record "$REC" reported "$(now)" 2>/dev/null || true
    if [ "$outcome" = succeeded ]; then
      exit 0
    fi
    exit 1
  fi
  if [ "$(slot current)" = "$TO" ]; then
    success_line "$(now)"
    echo "Warning: run record not written"
    exit 0
  fi
  echo "$VERB failed: interrupted; $(live_text)"
  exit 1
}

success_line() {
  local text=Deployed
  if [ "$CMD" = rollback ]; then
    text="Rolled back to"
  fi
  echo "$text ${SHA:0:7} \"$(cat "$RELEASES/$TO/SUBJECT")\" at $1 (started $(field "$REC" started))"
}

fail() {
  local reason=$1 message=${2:-}
  if [ -n "$NEW_PID" ]; then
    stop_instance "$TO" >/dev/null 2>&1 || true
  fi
  if [ "$CMD" = deploy ]; then
    check_slot
  fi
  {
    record "$REC" reason "$reason"
    record "$REC" ended "$(now)"
    record "$REC" outcome failed
  } 2>/dev/null || true
  echo "$VERB failed: $reason$message"
  exit 1
}

check_new() {
  if [ "$(main_pid "$TO")" != "$NEW_PID" ]; then
    fail start
  fi
}

reset_live() {
  local live pid
  live=$(slot current)
  if [ -n "$live" ]; then
    pid=$(main_pid "$live")
    if [ "$pid" != 0 ] && ! set_oom "$pid" 0; then
      fail "oom_score_adj reset"
    fi
  fi
  stop_others
  prune_runs
}

cleanup() {
  reset_live
  find "$INCOMING" -mindepth 1 -maxdepth 1 -type d -mmin +60 ! -path "$HERE" -exec rm -rf {} + 2>/dev/null || true
  prune_releases >/dev/null || true
  if [ "$(df -Pk "$ROOT" | awk 'NR == 2 { print $4 }')" -lt 3145728 ]; then
    fail "disk space"
  fi
}

build() {
  local dir=$RELEASES/$TO out status=0 file
  echo "Installing"
  mkdir -m 0755 "$dir" || fail install
  tar -xf "$HERE/release.tar" -C "$dir" || fail install
  printf '%s\n' "$SHA" >"$dir/REVISION" || fail install
  cp "$HERE/subject" "$dir/SUBJECT" || fail install
  (cd "$dir" && npm ci --no-audit --no-fund) || fail install
  echo "Building"
  (cd "$dir" && NEXT_TELEMETRY_DISABLED=1 NEXT_DEPLOYMENT_ID=$TO npx next build) || fail build
  echo "Migrating"
  out=$(cd "$dir" && node --env-file=/etc/tracklite/env scripts/migrate.ts 2>&1) || status=$?
  grep -E '^(Applied .+|Nothing pending)$' <<<"$out" || true
  if [ "$status" -ne 0 ]; then
    file=$(sed -n 's/^Migration failed: \([^:]*\).*$/\1/p' <<<"$out" | head -n 1)
    fail "migration${file:+ $file}"
  fi
}

start_new() {
  local dir=$RELEASES/$TO port other deadline next code
  port=3001
  other=3002
  if [ -e "$ROOT/current/port-3001" ]; then
    port=3002
    other=3001
  fi
  printf 'PORT=%s\n' "$port" >"$dir/release.env"
  : >"$dir/port-$port"
  rm -f "$dir/port-$other"
  echo "Starting ${SHA:0:7} on port $port"
  NEW_PID=starting
  start_instance "$TO" || fail start
  NEW_PID=$(main_pid "$TO")
  if [ "$NEW_PID" = 0 ] || ! set_oom "$NEW_PID" 1000; then
    fail start
  fi
  echo "Checking health"
  deadline=$((SECONDS + 60))
  while :; do
    next=$((SECONDS + 2))
    check_new
    code=$(curl -s -o /dev/null --max-time 2 -w '%{http_code}' "http://127.0.0.1:$port/health" 2>/dev/null) || true
    if [ "$code" = 200 ]; then
      return 0
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      if [ -n "$FROM" ]; then
        fail "health check" " (no 200 within 60 s); ${FROM##*-} still live"
      fi
      fail "health check" " (no 200 within 60 s); nothing is live yet"
    fi
    while [ "$SECONDS" -lt "$next" ]; do
      sleep 1
    done
  done
}

switch() {
  local warnings=() result ended warning leftover
  check_new
  record "$REC" switching "$(now)"
  echo "Switching"
  set_slot current "$TO"
  append_history "$TO" 2>/dev/null || true
  if [ "$CMD" = rollback ]; then
    rm -f "$ROOT/previous"
  elif [ -n "$FROM" ] && ! same_commit "$FROM" "$TO"; then
    set_slot previous "$FROM" 2>/dev/null || rm -f "$ROOT/previous"
  fi
  set_oom "$NEW_PID" 0 || warnings+=("oom_score_adj not reset")
  if [ -n "$FROM" ]; then
    echo "Draining ${FROM##*-}"
    sleep 2
    stop_instance "$FROM" >/dev/null 2>&1 || true
    result=$(systemctl show -p Result --value "$(unit "$FROM")" 2>/dev/null) || true
    if [ "$result" = timeout ]; then
      warnings+=("old instance killed after 30 s")
    fi
  fi
  if [ "$CMD" = rollback ]; then
    while IFS= read -r leftover; do
      if [ -n "$leftover" ]; then
        warnings+=("leftover not removed: $leftover")
      fi
    done <<<"$(prune_releases "$FROM")"
  fi
  ended=$(now)
  if ! {
    for warning in "${warnings[@]}"; do
      record "$REC" warning "$warning"
    done
    record "$REC" ended "$ended"
    record "$REC" outcome succeeded
  } 2>/dev/null; then
    warnings+=("run record not written")
  fi
  success_line "$ended"
  for warning in "${warnings[@]}"; do
    echo "Warning: $warning"
  done
  exit 0
}

worker() {
  REC=$1
  record "$REC" session "$(ps -o sid= -p $$ | tr -d ' ')"
  set_oom $$ 1000
  CMD=$(field "$REC" command)
  VERB=Deploy
  if [ "$CMD" = rollback ]; then
    VERB=Rollback
  fi
  SHA=$(field "$REC" commit)
  FROM=$(field "$REC" from)
  TO=$(field "$REC" to)
  NEW_PID=
  if [ "$CMD" = rollback ]; then
    reset_live
  else
    cleanup
    build
  fi
  start_new
  switch
}

main() {
  case ${1:-} in
    deploy)
      CMD=deploy
      VERB=Deploy
      SHA=${2:-}
      front deploy
      ;;
    rollback)
      CMD=rollback
      VERB=Rollback
      SHA=
      front rollback
      ;;
    worker)
      worker "$2" 9>&-
      ;;
    *) exit 2 ;;
  esac
}

main "$@"
