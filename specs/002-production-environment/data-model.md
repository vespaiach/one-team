# Data Model: Production Environment (RM-2)

Phase 1 output for [plan.md](./plan.md). This slice adds **no database table and no migration**. Its entities live on the server's file system, in off-server storage and in an external service. Paths are on the VPS unless stated otherwise. `/srv/tracklite/` and `/srv/tracklite/releases/` are owned by `tracklite`, mode `0755`, so the `caddy` user can traverse them and read `current/port-3001` and `releases/<id>/.next/static/` (contracts/https-front.md). Design reasons are in [research.md](./research.md) (R1, R2, R3, R4).

## Release

One deployed version of the app, prepared completely in its own directory before it can go live, and never changed afterwards except for its two port files while it is not live.

| Field | Where | Rule |
|-------|-------|------|
| Id | directory name `/srv/tracklite/releases/<yyyymmddTHHMMSSZ>-<sha7>/` | UTC deploy start plus the first 7 characters of the commit; unique even when the same commit is deployed twice. Owned by `tracklite`, mode `0755` (with `/srv/tracklite/` and `releases/` also `0755`, the `caddy` user can read `port-3001` and `.next/static/`). |
| Commit | file `REVISION`, the full sha | Written at extraction. |
| Subject | file `SUBJECT`, the commit subject | Written at extraction (copied from the upload directory's `subject`). Used by the `Deployed` and `Rolled back to` lines. |
| Port | file `release.env` (`PORT=3001` or `PORT=3002`) and an empty marker file `port-3001` or `port-3002` | Written each time the release is started before a switch (deploy's new release, or rollback target) as the port the live release does not use (`3001` for the first release), the other marker removed. Never rewritten while the release is live or its instance runs. |
| Deployment id | built into `.next/` (`NEXT_DEPLOYMENT_ID=<id>` at build) | Equals the release id. |
| Built | `.next/` | Present only after a successful `next build`; a release without it is never started. |
| Process | systemd instance `tracklite@<id>.service` | Running only while the release is live, or while it is being checked before a switch, or draining after one (stopped 2 s after the switch, killed at the latest 30 s later). `oom_score_adj` `1000` while being checked, `0` once live (research R1). Its main PID is recorded at start; if it changes or drops to `0` before the switch (the instance exited, or systemd restarted it under `Restart=on-failure`), the run fails with `start` and the instance is never made live. |

**Slots** (symlinks in `/srv/tracklite/`, each replaced only by an atomic rename):

- `current` → the live release. Present from the first successful deploy on. Its rename is **the atomic switch** and the commit point of a deploy or rollback. Caddy routes each request by whether `current/port-3001` exists (contracts/https-front.md), so the target of `current` is the release that answers members.
- `previous` → the one previous-release slot (FR-008). Absent when empty.
- **Invariant S1**: two running instances never have the same port: a release about to be started takes the port `current` does not use (so `previous` may hold either port; it is renumbered when a rollback starts it).
- **Invariant S2** (R2a): if `schema_migrations` names a migration that is not a file in `current/migrations/`, `previous` is absent. The check is skipped when `current` is absent or the `schema_migrations` table does not exist: `previous` is then already absent, and a first deploy must not fail on the missing table. If `psql` fails otherwise (`current` exists and the table should exist), the check has not run: `previous` is left unchanged and is not trusted, so a rollback refuses (`Refused: database could not be checked`, exit 2) rather than switch to it, and works again once the check can run. A deploy whose start-of-run check fails this way does not refuse: it carries on with `previous` unchanged (its migration step fails cleanly if the database is truly down), and the rollback's own check guards the slot later. The same holds for the check a failed or interrupted deploy runs at its end: if it cannot read `schema_migrations`, `previous` is left unchanged and the rollback's own check guards it.
- **Invariant S3**: exactly one `tracklite@` instance serves members: the one `current` points at. Another may run only during a deploy or rollback (being checked, or draining after the switch) and gets no member traffic.
- Directories kept on disk (research R3): `current` and `previous` whole; between runs, also the release just switched away from, whole; and, for the 5 most recent distinct releases in the live history other than `current`, their `.next/static/` folder (so a page left open across up to 5 later switches still loads its own files, FR-005). Each run's cleanup prunes those 5 to `.next/static/` (unless one is `previous`) and deletes every other release directory; a rollback does this after its switch, still keeping the release it switched away from whole (research R2). A release pruned to `.next/static/` is never started and is never a rollback target.

### Transitions

C = target of `current` at the start of the run, P = target of `previous` (either may be absent), N = the release being deployed. "Applied" means the run applied at least one migration. All rows also hold for a run that died at that point, except where "interrupted" is named: then the next command completes the bookkeeping shown (research R2b) and reports the run as `interrupted`, naming the live release.

| Run and how it ends | `current` after | `previous` after | Live during and after | Outcome reported |
|---------------------|-----------------|------------------|-----------------------|------------------|
| Deploy fails or dies before the switch (`oom_score_adj` reset of a running live instance, disk space check, install, build, disk full, out of memory, migration, new version not started or not kept running until the switch), applied none | C | P | C throughout | `failed: <step>` or `interrupted` |
| Same, applied some | C | absent (S2) | C throughout | `failed: <step>` or `interrupted` |
| First deploy (C absent) fails or dies before the switch | absent | absent | nothing live; Caddy keeps answering `502` (contracts/https-front.md) | `failed: <step>` or `interrupted`, saying `nothing is live yet` |
| Deploy: N never answers `/health` `200` within 60 s | C | P if applied none, absent if applied some | C throughout; N stopped, got no member request | `failed: health check` |
| Deploy succeeds | N | C (absent on the first deploy) | C until the switch, N after | `succeeded` (plus a warning line per post-switch problem) |
| Deploy of C's own commit (redeploy of the live commit) succeeds | N (fresh build, same commit) | P, unchanged | C until the switch, N after | `succeeded` (plus warnings, as above) |
| Deploy dies after the switch, or its end can't be recorded (commit point passed) | N | C (P, unchanged, for a redeploy) | N | `interrupted`, naming N |
| Rollback, P absent (including C absent: nothing live yet) | C (absent if C absent) | absent | C (nothing, if C absent) | earlier unreported outcome printed first, then refused: nothing to roll back to |
| Rollback, P present but `schema_migrations` can't be read (S2 check failed; not when C is absent or the table doesn't exist) | C | P, unchanged | C | earlier unreported outcome printed first, then refused: database could not be checked |
| Rollback: the live instance is running and its `oom_score_adj` can't be reset (skipped when it has no running process) | C | P | C throughout | `failed: oom_score_adj reset` |
| Rollback: P fails to start (or exits or is restarted before the switch) or never answers `/health` `200` within 60 s | C | P | C throughout; P stopped | `failed: start` or `failed: health check` |
| Rollback dies before its switch | C | P | C throughout | `interrupted` |
| Rollback succeeds | P | absent | C until the switch, P after | `succeeded` (plus warnings, as above) |
| Rollback dies after its switch, or its end can't be recorded | P | absent | P | `interrupted`, naming P |
| Any command while a run holds the lock | unchanged | unchanged | unchanged | refused: a deploy / a rollback is running |

A second rollback in a row finds `previous` absent and refuses (FR-010). Deploying the commit already live is a full deploy (fresh release, build, start on the other port, switch) that leaves `previous` as it was (FR-008); the replaced release is pruned like any other. A problem after the switch never changes the outcome (FR-007): the old instance killed at its stop limit, a leftover not removed, the `oom_score_adj` reset failed (the next run's cleanup writes `0` again before anything else), or the run record not written each add a `Warning: <problem>` line to a `succeeded` run, exit 0; the next run's cleanup removes leftovers.

## Run record (the spec's Deploy record)

One per deploy or rollback that gets past the lock, in `/srv/tracklite/runs/`: `<yyyymmddTHHMMSSZ>-<deploy|rollback>.record` (fields) and `….log` (everything the run printed). Written by the server, so it survives a dropped connection (FR-005, FR-007).

| Field | Written | Value |
|-------|---------|-------|
| `command` | at creation | `deploy` or `rollback` |
| `commit` | at creation | deploy: the commit deployed; rollback: the commit of the target release |
| `from`, `to` | at creation | release ids: live at the start, and the release to switch to |
| `started` | at creation | UTC ISO 8601 |
| `session` | by the worker as its first act, before it starts any child | the worker's session id: it runs as its own session through `setsid`, so this equals its PID and the process-group id of every child it starts (`npm ci`, `next build`, `scripts/migrate.ts`, `curl`). The next command kills that whole process group before finishing an interrupted run's bookkeeping (research R2b). Absent only if the worker died before starting any child |
| `switching` | immediately before the rename | UTC time; marks that the commit point may have passed |
| `ended` | at the end | UTC time; absent if the run died |
| `outcome` | at the end, or by the next command | `succeeded`, `failed` or `interrupted` |
| `reason` | on failure | the step (`oom_score_adj reset`, `disk space`, `install`, `build`, `migration <file>`, `health check`, `start`; `start` also covers an instance that exited or was restarted before the switch) |
| `warning` | after the switch, one per problem | `old instance killed after 30 s`, `leftover not removed: <path>`, `oom_score_adj not reset` |
| `reported` | when a command has printed the outcome to the owner | UTC time |

- **States**: running (lock held by its worker) → ended (`ended` and `outcome` set) → reported. Or running → died, or its end could not be written (lock free, no `ended`) → the next command kills the run's process group (`kill -KILL -- -<session>`), then sets `outcome=interrupted` → reported, naming the live release by its id.
- **Reported** means printed by a command that reached the server, as its first output (FR-007). A local refusal or an upload failure prints nothing about earlier runs, so the record stays unreported.
- **Retention**: outside SC-008/FR-025's 14-day log rule (they are not in the journal). Each run deletes records and logs older than 14 days, so they are pruned to 14 days at the next run; the newest record is always kept.
- Fields hold no secret: commits, release ids, times, step and migration file names only (FR-026).

## Lock

`/srv/tracklite/release.lock`, held with `flock` by the worker of the running deploy or rollback through a file descriptor it inherits from the front (research R4). Exists as a file permanently; *held* only while that worker process is alive, released by the kernel when it ends or dies (FR-006). Right after `flock -n` succeeds, the front writes `deploy` or `rollback` into the file; a refused command reads which one is running from the lock file, not from the newest run record.

## Live history

`/srv/tracklite/live-history`: release ids in the order they became live, one per line. Appended right after each committed switch, or by the next command for a run that died after its switch (research R2b). Read only by the cleanup, which keeps the `.next/static/` folders of the 5 most recent distinct ids other than `current` and trims the file to them (research R3). Holds no secret.

## Upload directory

`/srv/tracklite/incoming/<random id>/`: one per deploy invocation, holding the commit's archive, its `ops/release.sh` and a `subject` file (the commit subject), written before the lock. A run uses only its own; each run's cleanup, under the lock, deletes every other one whose modification time is more than 60 minutes old, so a concurrent invocation's directory (still uploading, or uploaded and about to reach the lock) is never deleted and that invocation is refused at the lock, not failed at upload (research R4). While nothing is live, a rollback runs the `release.sh` of the most recently written one, so it can print an unreported outcome before refusing (research R4).

## Server config file

`/etc/tracklite/env`, owned `root:tracklite`, mode `0640`. `NAME=value` lines.

| Key | Used by | Secret | Notes |
|-----|---------|--------|-------|
| `DATABASE_URL` | app, migrations | yes (password) | `postgres://tracklite:<password>@localhost:5432/tracklite` |
| `BACKUP_REMOTE` | backup | no | `backup:<bucket>/<folder>` |
| `RCLONE_CONFIG_BACKUP_TYPE` | backup | no | `s3` |
| `RCLONE_CONFIG_BACKUP_PROVIDER` | backup | no | `Cloudflare` |
| `RCLONE_CONFIG_BACKUP_ENDPOINT` | backup | no | `https://<account id>.r2.cloudflarestorage.com` |
| `RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID` | backup | yes | R2 token scoped to the backup bucket |
| `RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY` | backup | yes | |
| `RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET` | backup | no | `true`; needed with a token scoped to one bucket, which cannot check or create buckets |

RM-3 adds the email provider's API key here. Never inside a release, the repository or any output; every release reads the same file (FR-023, FR-024). `PORT` is not here: it belongs to each release (`release.env`).

## Backup

| Field | Rule |
|-------|------|
| Name | `tracklite-<yyyy-mm-ddTHH-MM-SSZ>.dump` (UTC start); names sort in time order. |
| Content | `pg_dump --format=custom` of the whole `tracklite` database, one snapshot. |
| Retention | After each successful upload, objects beyond the 14 newest by name are deleted (FR-017). Every object in `$BACKUP_REMOTE` counts toward the 14, whether the timer or a hand-run trial (`systemctl start tracklite-backup.service`) took it. A failed run deletes nothing (FR-018). |
| Location | `$BACKUP_REMOTE` in Cloudflare R2, reachable without the VPS (FR-019). |

## Uptime alert

Configured in Better Stack Uptime, not in the repository: `https://<domain>/health`, every 5 minutes, about 10 s limit, failure = non-`200`, no answer or time-out, alert after 2 consecutive failures, sent to the owner's email address set in the service.

## Log file

The systemd journal (`/var/log/journal/`), daily files, deleted after 14 days, with journald's default size cap (no `SystemMaxUse`). The retention is server-wide: it covers every log in the journal, including system and SSH logs, and the plain files under `/var/log` that rsyslog (`syslog`, `auth.log`, `ufw.log`, …) and PostgreSQL (`/var/log/postgresql/*.log`) write, whose logrotate configs are set to `daily` and `rotate 14` at setup, so they follow the same 15-day/last-14-days rule (research R8). PostgreSQL's log holds no row data or statements: `postgresql.conf` sets `log_error_verbosity = terse` (no `DETAIL:` line, which on a constraint violation quotes the key or failing row) and `log_min_error_statement = panic` (no failing statement) (FR-026, research R8). Holds the JSON request lines of every `tracklite@` instance (unchanged from RM-1), the backup job's output and Caddy's errors, filtered to method, path without query string, status and error only (every other request field deleted: query string, headers, remote address, proto, host, TLS; research R9). Caddy writes no access log. Run records and run logs in `/srv/tracklite/runs/` are not part of it (see "Run record").
