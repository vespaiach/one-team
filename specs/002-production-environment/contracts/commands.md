# Contract: Production commands and jobs (RM-2)

Commands run from the repository root on the owner's machine and reach the server through the SSH host alias `tracklite` (owner's `~/.ssh/config`, the `tracklite` account, key only). Every line they print is free of secret values, tokens and links (FR-026). Times are UTC ISO 8601. Release states and the run record are in [../data-model.md](../data-model.md).

## Exit status (both commands)

| Status | Meaning |
|--------|---------|
| 0 | succeeded |
| 1 | failed before the switch |
| 2 | refused by a check |
| 3 | refused because a run is in progress |
| 4 | connection lost |

These are the only exit statuses (FR-007). A run that passed the switch, its commit point, is `succeeded` (status 0) whatever happens afterwards; problems after the switch are printed as `Warning: <problem>` lines. Status 1 leaves the live release unchanged; status 2 and 3 change nothing that the live release or a running run uses (FR-006): the only writes are a deploy's own `incoming/<random id>/` directory (deleted by the first run's cleanup that finds it more than 60 minutes old) and marking an earlier outcome as reported. Status 4: the local script maps any SSH connection failure after the upload (`ssh` exit status 255) to 4 and always prints the connection-lost message (below).

## Messages printed first on the server

The first thing a command prints once it reaches the server (the first output of `ops/release.sh`), before taking any action, is at most one of these about the latest earlier run whose outcome was not yet reported, then it carries on (FR-007). Local refusals (FR-002) and an upload failure happen before the server is reached and print none of them; the outcome stays unreported until a command reaches the server. Release ids are `<yyyymmddTHHMMSSZ>-<sha7>` (data-model.md).

```text
Last deploy (<sha7>, started <time>): succeeded at <time>        # recorded, not yet reported
Last deploy (<sha7>, started <time>): succeeded at <time>; Warning: <problem>   # one Warning per post-switch problem
Last deploy (<sha7>, started <time>): failed: <reason>
Last rollback (<sha7>, started <time>): succeeded at <time>      # recorded, not yet reported
Last rollback (<sha7>, started <time>): succeeded at <time>; Warning: <problem>   # one Warning per post-switch problem
Last rollback (<sha7>, started <time>): failed: <reason>
Last deploy (<release id>, started <time>) was interrupted; <live release id> is live
Last rollback (<release id>, started <time>) was interrupted; <live release id> is live
```

`was interrupted` covers a run that died, and a run past its switch whose end could not be recorded; the live release id then names the new live release.

When `current` is absent (a first deploy that failed or died before its switch), every message that would name the live release says `nothing is live yet` instead: `Last deploy (<release id>, started <time>) was interrupted; nothing is live yet`, `Deploy failed: health check (no 200 within 60 s); nothing is live yet`, `Deploy failed: interrupted; nothing is live yet`.

## `npm run deploy` (`scripts/deploy.sh`)

Deploys the commit at `HEAD` of `main` (FR-001 to FR-007).

| Step | On failure | Server changed? |
|------|------------|-----------------|
| Branch is `main` | `Refused: not on main (on <branch>)`, exit 2 | no (server not contacted) |
| Working tree clean | `Refused: uncommitted changes`, exit 2 | no (server not contacted) |
| `git fetch origin main` | `Refused: the shared main couldn't be checked`, exit 2 | no (server not contacted) |
| `HEAD` equals `origin/main` | `Refused: local main differs from the shared main`, exit 2 | no (server not contacted) |
| Upload the commit's archive, `ops/release.sh` and a `subject` file (the commit subject, `git log -1 --format=%s`) to this invocation's own directory `/srv/tracklite/incoming/<random id>/` | `Deploy failed: upload`, exit 1 (earlier outcome not printed) | that directory only; each run uses only its own, and a later run's cleanup under the lock deletes it once it is more than 60 minutes old, never while a concurrent invocation is uploading into it or about to run it (research R4); a second deploy started together with a running one therefore reaches the lock and gets `Refused: a deploy is running`, exit 3 |
| Print the earlier run's unreported outcome (above), first thing on the server | — | its record marked reported |
| Take the lock | `Refused: a deploy is running` / `Refused: a rollback is running`, exit 3 | no |
| Check the previous-release slot (invariant S2, data-model.md) | if `schema_migrations` can't be read (`psql` fails although `current` exists and the table should exist), the deploy does not refuse and carries on; rollback's own check guards the slot later | previous-release slot unchanged |
| Clean up leftovers of earlier runs, first writing `0` to the live instance's `oom_score_adj` (resets a `1000` left by an earlier failed reset; skipped when the live instance has no running process, `MainPID` `0`) | `Deploy failed: oom_score_adj reset` when a running live process exists and that write fails, exit 1, before any other cleanup | nothing; otherwise: other `incoming/` directories more than 60 minutes old deleted; releases outside `current`, `previous` and the last 5 live deleted, those 5 pruned to `.next/static/`; non-live instances stopped |
| Free disk space at least one full release plus the build's headroom (about 3 GB, an estimate; research R2) | `Deploy failed: disk space`, exit 1 | nothing beyond the cleanup |
| Extract, `npm ci`, `next build` (worker and its children at `oom_score_adj` 1000) | `Deploy failed: install` / `Deploy failed: build` (also when the disk is full or the memory runs out), exit 1 | an unused release directory; old release serving untouched |
| Apply schema changes | `Deploy failed: migration <file>`, exit 1 | earlier migrations of this run stay applied; previous-release slot emptied if any were (if `schema_migrations` can't be read at that point, the slot is left unchanged and rollback's own check guards it); old release serving untouched |
| Start the new version beside the old one, on the port the live one does not use, at `oom_score_adj` 1000; record its main PID | `Deploy failed: start`, exit 1, also when, at any later point before the switch, the instance is not running or its main PID differs from the recorded one (it exited, was killed, or systemd restarted it; see "App units") | as above, new instance stopped |
| `/health` `200` within 60 s, polled every 2 s, the main PID checked at each poll and once more right before the switch | `Deploy failed: health check (no 200 within 60 s); <old sha7> still live` (`; nothing is live yet` when `current` is absent), exit 1 | new instance stopped, never got member traffic; slot rule as above |
| Atomic switch (commit point), then old version drained and stopped | `Warning: <problem>` per post-switch problem; still succeeded, exit 0 | new release live; previous slot = old release, or unchanged when the deployed commit was already live (redeploy); requests in progress on the old version have 30 s from the switch to finish (when the old version was not running, nothing is drained and its stop returns at once) |

**Live instance not running** (`current` exists but its instance has `MainPID` `0`, for example after crash-looping past systemd's restart limit or being stopped by hand): deploy and rollback proceed as above, so either can recover the site. The `oom_score_adj` reset is skipped; the new instance or target is checked on its own port as usual; after the switch there is nothing to drain and the old instance's stop returns at once; a failure before the switch leaves `current` as it was, still not running (research R2).

Progress lines name the step (`Uploading`, `Installing`, `Building`, `Migrating`, `Starting <sha7> on port <port>`, `Checking health`, `Switching`, `Draining <old sha7>`). Output of `npm ci` and `next build` is passed through. Of the migration runner's output only its `Applied <name>` and `Nothing pending` lines are passed through; on failure the file name is taken from its `Migration failed: <name>` line and the cause text after it (a PostgreSQL error that can quote data values) is dropped (FR-026).

Success ends with:

```text
Deployed <sha7> "<subject>" at <end time> (started <start time>)
Warning: <problem>        # zero or more: old instance killed after 30 s, leftover not removed: <path>, oom_score_adj not reset, run record not written
```

If the worker ends without recording an outcome while the command is still attached, the command prints the same success line with `Warning: run record not written` and exits 0 when the switch had happened, otherwise `Deploy failed: interrupted; <live release id> is live` (`; nothing is live yet` when `current` is absent) and exits 1 (research R4).

If the SSH connection fails at any point after the upload, the local script always prints `Connection lost. If it got past the lock, the deploy continues on the server; run npm run deploy or npm run rollback later to see its outcome.` and exits 4. If it got past the lock, the run continues on the server to the end and records its outcome.

## `npm run rollback` (`scripts/rollback.sh`)

Switches the live app back to the release in the previous-release slot, without touching the database (FR-008 to FR-010). No local checks: it does not require `main`.

| Case | Output | Exit |
|------|--------|------|
| Lock held | `Refused: a deploy is running` / `Refused: a rollback is running` | 3 |
| No live release on the server yet (`current` absent; run by the front from an upload directory, see "Server-side `ops/release.sh`") | the earlier run's unreported outcome first (with `nothing is live yet`), then `Refused: nothing to roll back to` | 2 |
| Slot empty (after a rollback, or a failed or interrupted deploy that applied a schema change) | `Refused: nothing to roll back to` | 2 |
| Slot holds a release but `schema_migrations` can't be read to check it (invariant S2: `psql` fails although `current` exists and the table should exist) | `Refused: database could not be checked`; slot left unchanged, so rollback works again once the check can run | 2 |
| Live instance is running and its `oom_score_adj` can't be set to `0` at the start of the cleanup (skipped when it has no running process) | `Rollback failed: oom_score_adj reset` | 1 |
| Target fails to start, or before the switch is not running or has a main PID other than the one recorded at its start (target instance stopped; live release and slot unchanged) | `Rollback failed: start` | 1 |
| Target answers `/health` `200` within 60 s; switched | `Rolled back to <sha7> "<subject>" at <end time> (started <start time>)`, plus a `Warning: <problem>` line per post-switch problem | 0 |
| Target never answers `/health` `200` within 60 s | `Rollback failed: health check (no 200 within 60 s); <current sha7> still live` | 1 |
| Worker ended without recording an outcome while attached | as for deploy: success line with `Warning: run record not written` (0) if switched, else `Rollback failed: interrupted; <live release id> is live` (1) | 0 or 1 |
| Connection lost (any SSH connection failure) | `Connection lost. If it got past the lock, the rollback continues on the server; run npm run deploy or npm run rollback later to see its outcome.` | 4 |

Switches within 2 minutes of running the command (SC-003, measured to the switch, when the previous release serves traffic again): no build and no database step; the cleanup before the switch (leftover non-live instances stopped in parallel, at most 30 s in total) plus start plus at most 60 s of `/health` wait. Deleting and pruning release directories happens after the switch, and the drain after the switch (stop 2 s after it, killed at the latest 30 s later) doesn't count. The target is started on the port the live release does not use. Before reaching the server nothing is printed about earlier runs; once there, the earlier outcome is printed first, as above.

## Server-side `ops/release.sh`

Run only by the two commands above, as `tracklite`, always through `bash` (`bash <path>/release.sh …`; the uploaded copy has no execute bit). `deploy <sha>` is run from `/srv/tracklite/incoming/<random id>/release.sh` (the copy uploaded by this invocation from the commit being deployed); `rollback` from `/srv/tracklite/current/ops/release.sh`, or, when `current` is absent, from the most recently written `/srv/tracklite/incoming/*/release.sh`. While nothing is live, every run that got past the lock was a deploy, and its own upload directory survives until the next run's cleanup, so such a copy exists whenever an outcome can be unreported; the front takes the lock, prints that outcome first like any other command (FR-007), then refuses because `previous` is absent: `Refused: nothing to roll back to`, exit 2 (exit 3 if the lock is held). If no such copy exists either, no run ever got past the lock and `rollback.sh`'s remote command prints `Refused: nothing to roll back to` itself, exit 2. One process (the front) stays attached to the SSH session; it hands the held lock to a detached worker (`setsid`) and follows its log. The worker records its session id in the run record before starting any child; before finishing the bookkeeping of an interrupted run, the front kills that session's whole process group (`kill -KILL -- -<session>`), so no child of a killed worker keeps running (research R2b). Implements the transitions in [../data-model.md](../data-model.md) and research R2 and R4. Uses `sudo systemctl start|stop tracklite@<release id>.service`, the only commands its sudoers rule allows, `systemctl show` (no privilege) to read an instance's main PID (recorded at start and rechecked before the switch, "App units") and stop result, `psql -d tracklite` (peer authentication) to read `schema_migrations`, and writes to `/proc/<pid>/oom_score_adj` of its own processes, the instance it started and the live instance (`0` at the start of the cleanup, only when it has a running main process) (as `tracklite`, no privilege; research R1). Its only exit statuses are 0 to 4.

## App units

- **`tracklite@.service`** (template, instance = release id, not enabled): `User=tracklite`, `WorkingDirectory=/srv/tracklite/releases/%i`, `EnvironmentFile=/etc/tracklite/env`, `EnvironmentFile=/srv/tracklite/releases/%i/release.env`, `Environment=NODE_ENV=production NEXT_TELEMETRY_DISABLED=1`, `ExecStart=/srv/tracklite/releases/%i/node_modules/.bin/next start --hostname 127.0.0.1` (port from `PORT`), `KillSignal=SIGTERM`, `TimeoutStopSec=30` (stopped 2 s after a switch, so requests in progress get at least 30 s from the switch, FR-005), no `OOMScoreAdjust` (the default `0`; the release script raises a not-yet-live instance's value itself), `Restart=on-failure`, `After=postgresql.service`. Output to the journal. `Restart=on-failure` is there for the live instance. A not-yet-live instance (a deploy's new release or a rollback target) is never switched to after a restart: right after starting it the release script records its main PID (`systemctl show -p MainPID --value`, the PID whose `oom_score_adj` it raises to `1000`), reads it again at every `/health` poll and once more immediately before the rename, and fails the run with `start` if it is `0` or different. An instance that systemd restarted (for example after the OOM killer took it) therefore runs at `oom_score_adj` `0` only until the run stops it, and is never made live (research R1). The unit itself is the same for every instance; nothing about it changes when an instance becomes live. A missing setting stops start-up with `Missing setting: NAME` (RM-1), which the deploy reports as a failed start or health check.
- **`tracklite-boot.service`** (one-shot, enabled, `After=postgresql.service`, `ConditionPathExists=/srv/tracklite/current`): starts `tracklite@<id>.service` for the release `current` points at, so a reboot brings back the live release and nothing else.

## Scheduled backup job (`tracklite-backup.timer` → `tracklite-backup.service` → `ops/backup.sh`)

- Starts daily at 03:00 UTC (`OnCalendar=*-*-* 03:00:00 UTC`, `Persistent=false`). No on-demand command; trials run `sudo systemctl start tracklite-backup.service`.
- Runs as `tracklite` with `/etc/tracklite/env` loaded, the script taken from `/srv/tracklite/current/ops/backup.sh`; `pg_dump` connects by peer authentication.
- Success: `Backup written: tracklite-<stamp>.dump`, then `Backup deleted: <name>` for each object beyond the 14 newest; exit 0.
- Failure: `Backup failed: dump` / `Backup failed: upload` / `Backup failed: list`; deletes nothing; non-zero exit, unit marked failed. No alert (FR-018).
- Output to the journal (`journalctl -u tracklite-backup`).

## Pull-request rule for schema changes (FR-011)

`.github/pull_request_template.md` contains a "Schema changes" section: a pull request that adds a file under `migrations/` states why the change keeps working with the code actually live in production (`/srv/tracklite/current/REVISION`): the previous release, or, after a rollback, the release two back, which the statement then names as such; the reviewer checks it against that live code before approving.
