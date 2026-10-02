---

description: "Task list for RM-2 Production Environment"
---

# Tasks: Production Environment

**Input**: Design documents from `/specs/002-production-environment/`

**Prerequisites**: plan.md, spec.md, design.md (Status: Not applicable), research.md, data-model.md, contracts/ (commands.md, https-front.md), quickstart.md

**Tests**: One automated test only, as planned (research R12): `src/server/env-files.test.ts` gains a check that no settings file other than `.env.example` is tracked (OPS-006.1). Everything else (OPS-002 to OPS-006, SEC-005) is "Verify: ops", checked by the trials in quickstart.md on the real server; each story ends with a Verify task naming its quickstart sections.

**Organization**: Tasks are grouped by user story so each story can be implemented and checked on its own.

**Rules for every task**: no new npm package and no server software beyond Caddy 2 and rclone (Constitution IV, approved 2026-10-01); no code comments in `src/` (III); no dead code (II): every file is used by `package.json`, another script, a systemd unit, GitHub or `docs/production.md`. Scripts use `set -euo pipefail`, never `set -x`, never put a secret on a command line, and print only step names, commits, release ids, times and file names (FR-026, research R9). Exit statuses of deploy and rollback are 0 to 4 only (FR-007). Messages are exactly those in contracts/commands.md. Stop conditions to honor: `next build` needing a setting (research R3), Caddy caching the `file` matcher across requests (research R5), Better Stack's free tier unable to check every 5 minutes and alert after two failures (research R10): stop and ask the owner.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 to US6)
- Paths are relative to the repository root (single Next.js project plus `scripts/`, `ops/`, `docs/`, `.github/`; plan.md "Project Structure")
- `docs/production.md` and `ops/release.sh` are each written by several tasks in sequence; tasks on the same file are never [P] with each other

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new folders and commands in the project

- [X] T001 [P] Add `"deploy": "bash scripts/deploy.sh"` and `"rollback": "bash scripts/rollback.sh"` to the `scripts` of `package.json`, changing nothing else (plan.md "Implementation outline" 1)
- [X] T002 [P] In `AGENTS.md`, extend the "Source layout" convention line with one sentence: files installed on or run only on the production server go in the top-level `ops/` folder, commands the owner runs (`deploy.sh`, `rollback.sh`) in `scripts/`, and operations documentation in `docs/production.md` (plan.md "Structure Decision"); and extend the secrets convention line (OPS-006) so it also names `/etc/tracklite/env` (`root:tracklite`, mode `0640`) as where secrets live on the production server, with `docs/production.md` as the reference; keep the `next dev` block at the end of the file unchanged
- [X] T003 [P] Create `docs/production.md` with its section headings only, filled by later tasks: "One-time server setup", "Deploy", "Rollback", "HTTPS", "Backups and restore", "Uptime check", "Secrets and logs", "Cost" (FR-027); no secret values anywhere in it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The server pieces every story stands on: app units, the sudo rule, the HTTPS front with its per-request switch, and the documented one-time server setup

**⚠️ CRITICAL**: No user story can be verified until this phase is complete and the server is prepared

- [X] T004 [P] Create `ops/tracklite@.service` exactly as contracts/commands.md "App units": template instance = release id, `User=tracklite`, `WorkingDirectory=/srv/tracklite/releases/%i`, `EnvironmentFile=/etc/tracklite/env`, `EnvironmentFile=/srv/tracklite/releases/%i/release.env`, `Environment=NODE_ENV=production NEXT_TELEMETRY_DISABLED=1`, `ExecStart=/srv/tracklite/releases/%i/node_modules/.bin/next start --hostname 127.0.0.1` (port from `PORT`), `KillSignal=SIGTERM`, `TimeoutStopSec=30`, `Restart=on-failure`, `After=postgresql.service`, no `OOMScoreAdjust`, output to the journal, no `[Install]` section (instances are never enabled)
- [X] T005 [P] Create `ops/tracklite-boot.service`: one-shot, `After=postgresql.service`, `ConditionPathExists=/srv/tracklite/current`, starts `tracklite@<id>.service` for the release id `current` resolves to (basename of `readlink /srv/tracklite/current`), `[Install] WantedBy=multi-user.target` (contracts/commands.md "App units", research R2 "Boot")
- [X] T006 [P] Create `ops/sudoers-tracklite`: `tracklite` may run, without a password, only `/usr/bin/systemctl start` and `/usr/bin/systemctl stop` on `tracklite@<release id>.service`, matched by an anchored sudoers regular expression (`^…$`, release id `[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7}`) so no extra unit name or argument can follow (research R1); nothing else
- [X] T007 [P] Create `ops/Caddyfile` per contracts/https-front.md for one site block `{$TRACKLITE_DOMAIN}` (domain set in Caddy's environment, documented in T008, not hard-coded): automatic HTTPS and HTTP→HTTPS `308` redirect keeping path and query; `/_next/static/*` with a `dpl` query value served by `file_server` from `/srv/tracklite/releases/{query.dpl}/.next/static/…` only when that file exists (path-cleaned `file` matcher under `/srv/tracklite/releases`), with `Cache-Control: public, max-age=31536000, immutable`; every other request routed by one `file` matcher on `/srv/tracklite/current/port-3001`: `reverse_proxy 127.0.0.1:3001` when it exists, otherwise `127.0.0.1:3002`; no site-level `log` directive (no access log, errors only, FR-025); a global log filter on Caddy's error log (`format filter`) that keeps only the method (`request>method`), the path without the query string (`request>uri` with the query string removed), the status and the error, and deletes every other `request>…` field (`request>remote_ip`, `request>remote_port`, `request>client_ip`, `request>proto`, `request>host`, `request>headers`, `request>tls` and any other present), so no query string, header, address or other request detail reaches the journal (FR-026, research R9; checked in quickstart.md §10 by T034); no reload is ever triggered by a deploy (research R2, R5). The HSTS header is added in T025 (US3)
- [X] T008 Write the "One-time server setup" section of `docs/production.md` (FR-027, research R1, R6): Hostinger VPS Ubuntu 24.04 (2 vCPU, ≥ 2 GB RAM, ≥ 40 GB disk) and a 2 GB swap file; the owner's admin account (SSH key, sudo); the `tracklite` system account owning `/srv/tracklite` (create `releases/`, `incoming/`, `runs/`, empty `release.lock`), with `/srv/tracklite` and `releases/` set explicitly to mode `0755` (`chmod 0755`, since Ubuntu 24.04's `useradd -m` home default is `0750`) so the `caddy` user can traverse them and read `current/port-3001` and `releases/<id>/.next/static/` (each release directory is also `0755`, data-model.md "Release"), SSH key only, and the owner's `~/.ssh/config` host alias `tracklite`; `ufw` allowing 22, 80, 443 only; Node.js 24 (NodeSource), PostgreSQL 18 (PGDG) on `localhost` and its Unix socket with a `tracklite` role and database, password authentication over TCP and peer authentication for the `tracklite` OS account, `log_error_verbosity = terse` and `log_min_error_statement = panic` set in `/etc/postgresql/18/main/postgresql.conf` and applied with `sudo systemctl reload postgresql`, checked with `sudo -u postgres psql -c 'SHOW log_error_verbosity' -c 'SHOW log_min_error_statement'` (`terse`, `panic`), so PostgreSQL's server log writes no `DETAIL:` line with row data on a constraint violation and no failing statement (FR-026, research R8), and the check `systemctl show -p OOMScoreAdjust postgresql@18-main` shows `-900`; `/etc/tracklite/env` created by hand as `root:tracklite` mode `0640` with `DATABASE_URL` (keys listed, values never written in the doc; backup keys added in T031); installing Caddy 2 from its apt repository with `ops/Caddyfile` copied to `/etc/caddy/Caddyfile` and `TRACKLITE_DOMAIN` set through a `caddy.service` environment drop-in; DNS A (and AAAA) records for the team's domain pointing at the VPS (Cloudflare proxy off if Cloudflare is used); installing `ops/tracklite@.service` and `ops/tracklite-boot.service` into `/etc/systemd/system/` (`daemon-reload`, `enable tracklite-boot.service`) and `ops/sudoers-tracklite` into `/etc/sudoers.d/tracklite` checked with `visudo -cf`
- [ ] T009 Verify: prepare the production VPS by following T008 exactly, as the owner's admin account; confirm `sudo -u tracklite sudo -n systemctl start tracklite@x.service` is refused for a non-matching name and `sudo -l -U tracklite` lists only the two rules; `curl -sS -o /dev/null -w '%{http_code}' https://$DOMAIN/` answers `502` (nothing deployed yet, contracts/https-front.md); fix `docs/production.md` wherever a step was missing or wrong (quickstart.md "Prerequisites")

**Checkpoint**: Server prepared, Caddy answering `502` over HTTPS - user stories can now begin

---

## Phase 3: User Story 1 - Deploy the latest `main` with one command (Priority: P1) 🎯 MVP

**Goal**: `npm run deploy` takes a clean, pushed `main`, prepares the release in its own directory, migrates, starts it beside the live one, waits for `/health` `200`, and switches traffic with one atomic `current` rename; zero member-visible downtime; one run at a time, surviving a dropped connection

**Independent Test**: From a clean checkout of `main`, run `npm run deploy`; the new version answers at the team's domain, and a deliberately failing schema change leaves the previous version serving unchanged (quickstart.md §1 to §5, §7)

### Implementation for User Story 1

- [X] T010 [US1] Create `scripts/deploy.sh` (contracts/commands.md "`npm run deploy`", research R4): local refusals before contacting the server, each exit 2 with the exact message (not on `main`, uncommitted changes from `git status --porcelain`, `git fetch origin main` failing → `Refused: the shared main couldn't be checked`, `HEAD` ≠ `origin/main`); generate a 16-hex-character id from `/dev/urandom`; upload `git archive <sha>` and that commit's `ops/release.sh` (`git show <sha>:ops/release.sh`) into `/srv/tracklite/incoming/<id>/` over the `tracklite` SSH alias, written under temporary names then `mv`'d into place (`Deploy failed: upload`, exit 1 on failure); run `bash /srv/tracklite/incoming/<id>/release.sh deploy <sha>` over SSH (the uploaded copy has no execute bit), passing its output through and returning its status; if the remote script or its upload directory is gone (remote status 127 or equivalent, research R4), print `Deploy failed: upload` and exit 1, so exit statuses stay within 0 to 4 (FR-007); map `ssh` exit status 255 after the upload to exit 4 with the exact connection-lost message
- [X] T011 [US1] Create `ops/release.sh` with its shared helpers (data-model.md "Release", "Run record", "Live history"; research R2, R2b): release id `<yyyymmddTHHMMSSZ>-<sha7>` in UTC; run record files `/srv/tracklite/runs/<stamp>-<deploy|rollback>.record` and `.log` with fields `command`, `commit`, `from`, `to`, `started`, `session`, `switching`, `ended`, `outcome`, `reason`, `warning`, `reported` (UTC ISO 8601); reading `current`/`previous` targets and the live instance's `MainPID` with `systemctl show -p MainPID --value`; writing `/proc/<pid>/oom_score_adj`; `sudo systemctl start|stop tracklite@<id>.service` as the only privileged calls; the slot invariant S2: skipped when `current` is absent or the `schema_migrations` table does not exist (the slot is then empty anyway, so a first deploy does not fail under `set -euo pipefail`); otherwise list `schema_migrations` with `psql -d tracklite` (peer authentication) and remove `previous` if any name is not a file in `current/migrations/` (if `psql` fails otherwise, leave `previous` unchanged: a deploy carries on, a rollback refuses, T020a); deleting run files older than 14 days except the newest record (research R8)
- [X] T012 [US1] Add the front role to `ops/release.sh` (research R4 "Front", contracts/commands.md "Messages printed first on the server"): open `/srv/tracklite/release.lock` and `flock -n` it; if held, print any ended-but-unreported outcome then `Refused: a deploy is running` / `Refused: a rollback is running` read from the lock file, exit 3; if free, write the command name into the lock file, then, as the very first output, finish the bookkeeping of a run without `ended` (R2b: first, when the record has a `session` id and a process of that group remains, kill the dead run's whole process group with `kill -KILL -- -<session>` so no `npm ci`, `next build` or `scripts/migrate.ts` left by the killed worker overlaps the new run; then deploy whose `to` is `current` → set `previous` to `from` unless same commit, append `to` to live history; otherwise apply S2; rollback whose target is `current` → remove `previous`, append to history; close as `interrupted`, stop any non-live instance, start the live one if not running) and print the exact `Last deploy|rollback (…)` line (`nothing is live yet` when `current` is absent), or print an ended-but-unreported outcome, and mark it reported; apply S2; create the new run record; start the worker with `setsid`, stdin from `/dev/null`, output appended to the run's log, handing it the locked descriptor and closing its own; follow the log with `tail --pid=<worker>`; mark reported and exit with the recorded status, or, when the worker ended with no outcome, print the success line plus `Warning: run record not written` and exit 0 if `current` names the run's target, else `Deploy failed: interrupted; <live release id> is live` / `Rollback failed: interrupted; <live release id> is live` (or `… nothing is live yet`) and exit 1
- [X] T013 [US1] Add the worker's start and cleanup to `ops/release.sh` (research R1, R2 "Deploy order", R3, R4; contracts/commands.md deploy table): run every child command with the lock descriptor closed and without job control (no `set -m`), so each stays in the worker's process group; as its very first act, before starting any child, write its session id (`ps -o sid= -p $$`, equal to its PID under `setsid`) to the run record's `session` field (data-model.md "Run record"); then write `1000` to its own `/proc/self/oom_score_adj`; cleanup: if the live instance has a running `MainPID`, write `0` to its `oom_score_adj` and on failure end with `oom_score_adj reset`, exit 1, before anything else (skip when `MainPID` is `0`); stop every `tracklite@` instance except the live one; delete other `incoming/` directories with `find … -mindepth 1 -maxdepth 1 -type d -mmin +60`; delete run files older than 14 days except the newest record (T011 helper, FR-025); keep `current` and `previous` whole, prune the release directories of the 5 most recent distinct ids in `/srv/tracklite/live-history` other than `current` to `.next/static/` only (unless one is `previous`), delete every other release directory, trim the history to those ids; then check free disk space ≥ about 3 GB, else `Deploy failed: disk space`, exit 1
- [X] T014 [US1] Add the deploy build and migration steps to `ops/release.sh` (research R2, R3, R6; FR-003): extract the uploaded archive into `/srv/tracklite/releases/<release id>/`, write `REVISION` (full sha); `npm ci` (`Deploy failed: install`); `NEXT_TELEMETRY_DISABLED=1 NEXT_DEPLOYMENT_ID=<release id> npx next build` without `/etc/tracklite/env` loaded (`Deploy failed: build`); `node --env-file=/etc/tracklite/env scripts/migrate.ts` in the new release, passing through only its `Applied <name>` and `Nothing pending` lines, and on failure taking the file name from its `Migration failed: <name>` line and dropping the cause text after it (the PostgreSQL error can quote data values, FR-026), printing `Deploy failed: migration <file>`, exit 1; print the progress lines `Installing`, `Building`, `Migrating`; on any failure before the switch stop the new instance if started, apply S2 and record `failed: <step>`
- [X] T015 [US1] Add starting and checking the new version to `ops/release.sh` (research R1, R2; FR-004): write `release.env` (`PORT=3001|3002`, the port `current` does not use, `3001` when nothing is live) and the matching empty `port-3001`/`port-3002` marker (remove the other); `sudo systemctl start tracklite@<id>.service`; record its `MainPID` and write `1000` to its `oom_score_adj`; print `Starting <sha7> on port <port>` and `Checking health`; poll `curl --max-time 2 http://127.0.0.1:<port>/health` every 2 s for up to 60 s, rechecking `MainPID` at each poll (`0` or changed → `Deploy failed: start`); on timeout `Deploy failed: health check (no 200 within 60 s); <old sha7> still live` (`; nothing is live yet` when `current` is absent), stop the new instance, exit 1
- [X] T016 [US1] Add the switch and post-switch steps to `ops/release.sh` (research R2, data-model.md "Transitions"; FR-005, FR-007, FR-008): recheck `MainPID`; record `switching`; print `Switching`; `ln -s releases/<id> current.next && mv -T current.next current` (commit point); append the id to `live-history`; set `previous` to the old release by the same atomic rename unless the new release has the old release's commit (redeploy leaves `previous` as it was) or nothing was live; write `0` to the new instance's `oom_score_adj`; print `Draining <old sha7>`, wait 2 s, `sudo systemctl stop tracklite@<old>.service` and read `systemctl show -p Result` (`timeout` → warning); collect `Warning: old instance killed after 30 s`, `leftover not removed: <path>`, `oom_score_adj not reset`, `run record not written` without changing the outcome; record `ended`, `outcome=succeeded`; print `Deployed <sha7> "<subject>" at <end> (started <start>)` then the warning lines; exit 0
- [X] T017 [US1] Write the "Deploy" section of `docs/production.md`: running `npm run deploy` from a clean, pushed `main`, the exit statuses 0 to 4, what each refusal and failure means, the dropped-connection behavior and how the next command reports it, how a redeploy of the live commit applies an edited `/etc/tracklite/env`, and where run records live (`/srv/tracklite/runs/`)
- [ ] T018 [US1] Verify: run quickstart.md §1 (10 deploys, SC-001), §2 (every refusal, nothing new in `incoming/`, no earlier outcome printed by a local refusal), §3 (zero downtime with the probe and an open browser page, static files of the last 5 releases, redeploy of the live commit; SC-010), §4 first half (failing migration keeps the slot when nothing was applied; SC-002), §5 (new version failing `/health` gets no member request; Caddy switch per request, research R5 stop condition) and the deploy items of §7 (concurrent deploys, dropped connection, interrupted before and after the switch with no process of the killed run left afterwards (`pgrep -s <session>` empty), problem after the switch, memory pressure and a killed candidate, upload directories, live instance not running, server restart mid-run); fix `ops/release.sh` or `scripts/deploy.sh` for every mismatch with contracts/commands.md

**Checkpoint**: The owner can deploy `main` with one command, safely and with zero downtime

---

## Phase 4: User Story 2 - Roll back to the previous release (Priority: P1)

**Goal**: `npm run rollback` switches back to the release in the previous-release slot within 2 minutes through the same atomic switch, no database restore; refuses when the slot is empty

**Independent Test**: Deploy B on top of A, run `npm run rollback`, confirm A serves within 2 minutes with the database untouched; a second rollback refuses (quickstart.md §6)

### Implementation for User Story 2

- [X] T019 [US2] Create `scripts/rollback.sh` (contracts/commands.md "`npm run rollback`", research R4): no local checks; over the `tracklite` alias run `bash /srv/tracklite/current/ops/release.sh rollback`, or when `current` is absent `bash` on the most recently written `/srv/tracklite/incoming/*/release.sh` with `rollback`, or when neither exists print `Refused: nothing to roll back to` and exit 2; pass output and status through; map `ssh` exit 255 to exit 4 with the rollback connection-lost message
- [X] T020 [US2] Add the rollback path to `ops/release.sh` (research R2 "Rollback order", data-model.md "Transitions"; FR-008 to FR-010): after the front's first output and S2, refuse with `Refused: nothing to roll back to`, exit 2, when `previous` is absent (also when `current` is absent), and with `Refused: database could not be checked`, exit 2, leaving `previous` unchanged, when `previous` is present but the S2 check could not read `schema_migrations` (T020a); worker: `session` recorded first as in T013, `oom_score_adj` 1000 on itself, cleanup limited to the live instance's `oom_score_adj` reset (`Rollback failed: oom_score_adj reset`, exit 1), stopping leftover non-live instances in parallel, and deleting run files older than 14 days except the newest record (T011 helper, FR-025); write the target's port files (port `current` does not use), start it, record `MainPID`, raise its `oom_score_adj`, same 60 s / 2 s `/health` wait and `MainPID` checks (`Rollback failed: start` / `Rollback failed: health check (no 200 within 60 s); <current sha7> still live`, target stopped, slot unchanged); then record `switching`, rename `current` to the target, append it to `live-history`, remove `previous`, reset its `oom_score_adj` to `0`, wait 2 s, stop the old instance, then delete and prune release directories as the cleanup does while keeping the release switched away from whole (failure → `leftover not removed` warning); print `Rolled back to <sha7> "<subject>" at <end> (started <start>)` plus warnings; exit 0
- [X] T020a [US2] Implement S2 check-failure refusal in `ops/release.sh` (FR-009, data-model.md invariant S2 and "Transitions", research R2a, contracts/commands.md "`npm run rollback`"): make the T011 S2 helper report when `psql -d tracklite` fails although `current` exists and `schema_migrations` should exist (as opposed to the two skip cases: `current` absent, table absent), without failing the script under `set -euo pipefail` and without touching `previous`; in the rollback front, after the earlier outcome is printed and `previous` is found present, refuse with `Refused: database could not be checked`, exit 2, no run record created, live release and slot unchanged; in the deploy front the same failure does not refuse: the deploy carries on with `previous` unchanged; the same failure in the check a failed or interrupted deploy runs at its end also leaves `previous` unchanged (the rollback's own check guards it)
- [X] T021 [P] [US2] Create `.github/pull_request_template.md` with a "Schema changes" section (FR-011, research R12, contracts/commands.md "Pull-request rule"): a pull request that adds a file under `migrations/` states why the change keeps working with the code actually live in production (`ssh tracklite cat /srv/tracklite/current/REVISION`), which is the previous release, or, after a rollback, the release two back, and the statement then says so; the reviewer checks it against that live code before approving
- [X] T022 [P] [US2] In `AGENTS.md`, extend the migration convention line ("Schema changes are new SQL files…") so that each migration's pull request states why it works with the code actually live in production when it is applied, which after a rollback is the release two back, and says so (FR-011, plan.md "Design notes"); keep the `next dev` block unchanged
- [X] T023 [US2] Write the "Rollback" section of `docs/production.md`: running `npm run rollback`, when it refuses (slot empty after a rollback, or after a failed or interrupted deploy that applied a schema change), that it never restores the database, that a second rollback refuses, and the FR-011 review rule for schema changes
- [ ] T024 [US2] Verify: run quickstart.md §6 (rollback timed to the switch under 2 minutes 10 times with the probe and browser page, SC-003, SC-010; second rollback refused; deploy after rollback; rollback target failing `/health` keeps D live and the slot on C), §4 second half (deploy that applied a migration then failed empties the slot, rollback refuses) and the rollback items of §7 (deploy refused during a rollback, rollback while nothing is live, live instance not running then rollback); fix `ops/release.sh` or `scripts/rollback.sh` for every mismatch with contracts/commands.md

**Checkpoint**: Deploy and rollback both work; every later slice can ship

---

## Phase 5: User Story 3 - Members reach the app only over HTTPS (Priority: P1)

**Goal**: Every HTTP request is redirected to HTTPS with path and query kept; every HTTPS response carries one-year, host-only HSTS without preload; the certificate renews itself

**Independent Test**: Request pages over HTTP and check the `308` to the same path over HTTPS; check the HSTS header and certificate over HTTPS (quickstart.md §8)

### Implementation for User Story 3

- [X] T025 [US3] Add `header Strict-Transport-Security "max-age=31536000"` to the site block of `ops/Caddyfile` so it is on every HTTPS response, with no `includeSubDomains` and no `preload` (FR-014, contracts/https-front.md)
- [X] T026 [US3] Write the "HTTPS" section of `docs/production.md`: Let's Encrypt through Caddy with automatic renewal (FR-015), checking renewals with `journalctl -u caddy`, the HSTS policy and that the domain is never submitted to a preload list, re-installing `ops/Caddyfile` with `sudo systemctl reload caddy` after it changes
- [ ] T027 [US3] Verify: re-install `ops/Caddyfile` on the server and run quickstart.md §8 (every HTTP address answers `308` to the same path and query; `strict-transport-security: max-age=31536000` only; certificate issuer and expiry; SC-004)

**Checkpoint**: The app is reachable only over HTTPS; RM-3 sign-in cookies can rely on it

---

## Phase 6: User Story 4 - Daily off-server backups (Priority: P2)

**Goal**: At 03:00 UTC every day a consistent `pg_dump` goes to Cloudflare R2, named by UTC time; the 14 newest are kept, every object counting, hand-run trials included; a failure deletes nothing and is logged

**Independent Test**: Start the backup service directly, confirm the object in R2 from the owner's machine; with 14 stored, take one more and confirm 14 remain with the oldest gone (quickstart.md §9)

### Implementation for User Story 4

- [X] T028 [P] [US4] Create `ops/backup.sh` (research R7, data-model.md "Backup", contracts/commands.md "Scheduled backup job"): `set -euo pipefail`; `pg_dump --format=custom --dbname=tracklite` over the Unix socket into a temporary file (`Backup failed: dump`); `rclone copyto` it to `$BACKUP_REMOTE/tracklite-<yyyy-mm-ddTHH-MM-SSZ>.dump` (`Backup failed: upload`); print `Backup written: <name>`; only then `rclone lsf`, sort by name, `rclone deletefile` every object beyond the 14 newest, printing `Backup deleted: <name>` each (`Backup failed: list`); remove the temporary file on every exit; never print environment values; non-zero exit on any failure
- [X] T029 [P] [US4] Create `ops/tracklite-backup.service`: `Type=oneshot`, `User=tracklite`, `EnvironmentFile=/etc/tracklite/env`, `ExecStart=/bin/bash /srv/tracklite/current/ops/backup.sh`, `After=postgresql.service`, output to the journal
- [X] T030 [P] [US4] Create `ops/tracklite-backup.timer`: `OnCalendar=*-*-* 03:00:00 UTC`, `Persistent=false`, `Unit=tracklite-backup.service`, `[Install] WantedBy=timers.target`
- [X] T031 [US4] Write the "Backups and restore" section of `docs/production.md` (FR-016 to FR-019, FR-027): creating the R2 bucket and a token scoped to it; adding `BACKUP_REMOTE` and the `RCLONE_CONFIG_BACKUP_*` keys to `/etc/tracklite/env` (names only); installing rclone from its official source and the two units, `enable --now tracklite-backup.timer`; running a backup by hand for checks with `sudo systemctl start tracklite-backup.service` (no on-demand command), noting that every backup in the bucket, hand-run ones included, counts toward the 14 kept (FR-017); reading `journalctl -u tracklite-backup`; listing backups without the VPS; restoring (`rclone copyto` the newest object, `pg_restore --clean --if-exists --no-owner -d tracklite`), rehearsal deferred to RM-14 (OPS-003.1)
- [ ] T032 [US4] Verify: after a deploy that ships `ops/backup.sh`, run quickstart.md §9 (backup written and listed from the owner's machine; retention at 14; a wrong secret key gives `Backup failed: upload`, unit failed, 14 untouched; `systemctl list-timers` shows 03:00 UTC; SC-005 tracked over 15 days starting after the last hand-run trial)

**Checkpoint**: The team's data is protected off the VPS before real data exists

---

## Phase 7: User Story 5 - Uptime alerts to the owner (Priority: P2)

**Goal**: Better Stack checks `https://<domain>/health` every 5 minutes and emails the owner after two failures in a row, never after one

**Independent Test**: Stop PostgreSQL (or the app) and receive an email within 12 minutes of the stop; a single failed check sends none (quickstart.md §10)

### Implementation for User Story 5

- [X] T033 [US5] Write the "Uptime check" section of `docs/production.md` (FR-020 to FR-022, research R10, data-model.md "Uptime alert"): Better Stack Uptime free tier monitor on `https://<domain>/health`, every 5 minutes, about 10 s time limit, failure = non-`200`, no answer or time-out, alert by email to the owner after 2 consecutive failures; the owner's address set in the service only. Confirm on Better Stack's current free-tier terms that a 5-minute interval and a 2-failure confirmation are available; if not, stop and ask the owner (research R10 stop condition, fallback UptimeRobot)
- [ ] T034 [US5] Verify: set up the monitor per T033 and run quickstart.md §10 (database stopped → email within 12 minutes of the stop, in 3 out of 3 trials; live instance stopped for about 12 minutes → email, and during that `502` a request with a fake token in its query string leaves no trace in the journal (Caddy error-log filter, T007, FR-026); one failed check → no email; each alert email names the address checked and when failures started; no alert during the deploy and rollback trials; SC-006)

**Checkpoint**: The owner learns about an outage without anyone reporting it

---

## Phase 8: User Story 6 - Secrets and logs kept in order on the server (Priority: P3)

**Goal**: Secrets only in `/etc/tracklite/env` (never in the repository, a release or any output); logs in the journal, rotated daily and kept 14 days server-wide

**Independent Test**: Search the repository, releases, run records and 14 days of journal for every secret value; check log retention (quickstart.md §11)

### Implementation for User Story 6

- [X] T035 [P] [US6] Create `ops/journald-tracklite.conf` as a `[Journal]` drop-in with `Storage=persistent`, `MaxFileSec=1day`, `MaxRetentionSec=14day`, and no `SystemMaxUse` (journald's default size cap stays); whole-day files mean entries up to about 15 days old can remain, which SC-008 allows (FR-025, research R8)
- [X] T036 [P] [US6] Extend `src/server/env-files.test.ts` with one test, no comments: `git ls-files` lists no settings file (`.env`, `.env.*`, `*.env`) other than `.env.example` (OPS-006.1, research R12); run `npm test`
- [X] T037 [US6] Write the "Secrets and logs" section of `docs/production.md` (FR-023 to FR-026): `/etc/tracklite/env` ownership `root:tracklite` mode `0640`, never copied into a release or the repository, every release reads it and a redeploy applies an edit; installing `ops/journald-tracklite.conf` into `/etc/systemd/journald.conf.d/` and restarting `systemd-journald`; the 14-day retention is server-wide, applying to all server logs including system and SSH logs, with journald's default size cap (no `SystemMaxUse`); a one-time step edits `/etc/logrotate.d/rsyslog` (`/var/log/syslog`, `auth.log`, `ufw.log`, …) and `/etc/logrotate.d/postgresql-common` (`/var/log/postgresql/*.log`) to `daily` and `rotate 14`, checked with `sudo logrotate -d /etc/logrotate.conf` (research R8); PostgreSQL's `log_error_verbosity = terse` and `log_min_error_statement = panic` (set in T008) keep row data and statements out of `/var/log/postgresql/*.log`, rechecked with `SHOW` (FR-026); and the owner checks `journalctl --disk-usage` during the SC-008 period; reading logs (`journalctl -u 'tracklite@*'`, `-u tracklite-backup`, `-u caddy`); Caddy keeps no access log and its error lines are filtered to method, path without query string, status and error; run records and run logs in `/srv/tracklite/runs/` are outside SC-008/FR-025's 14-day log rule: they are pruned to 14 days at the next run, the newest record is always kept, and they hold no secrets (FR-026)
- [ ] T038 [US6] Verify: install the journald drop-in, apply the logrotate edits of T037 and run quickstart.md §11 (`npm test`; config file `root:tracklite 640` and unreadable by `nobody`; secret-value search, including the database password on its own, over releases, run records, `/srv/tracklite/incoming/`, 14 days of journal and the log files under `/var/log` finds nothing, and over saved deploy, rollback and backup output; `SHOW log_error_verbosity` is `terse` and `SHOW log_min_error_statement` is `panic`, and one deliberate constraint violation leaves its `ERROR` line in the PostgreSQL log with no `DETAIL` line, no statement and no row value (FR-026); request log continues across a switch; SC-007, SC-008 tracked over 14 days for all server logs, the journal and the rsyslog and PostgreSQL files under `/var/log` (nothing older than 15 days, each of the last 14 days present), with `journalctl --disk-usage` checked, run records and run logs excluded); after a deploy and a rollback, `/srv/tracklite/runs/` holds no run record or run log older than 14 days other than the newest record (FR-025)

**Checkpoint**: All user stories complete

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation links, cost, checks across the whole slice

- [X] T039 [P] In `README.md`, add `npm run deploy` ("Deploys `main` to production") and `npm run rollback` ("Switches production back to the previous release") rows to the Scripts table and a link to `docs/production.md` (plan.md "Design notes")
- [X] T040 Write the "Cost" section of `docs/production.md` from research R11 with the providers' current prices (Hostinger including renewal, R2, Better Stack, Let's Encrypt, domain): stating "hosting under $20, X left for email", with X the headroom from those prices (about $6 at the VPS renewal price) (FR-028, SC-009, quickstart.md §12); note that the first monthly bills confirm it and that the full NFR-009 total including email is checked in RM-3 when it picks the email provider (DEC-003)
- [X] T041 Run `npm test`, `npm run lint` and `npm run typecheck` from the repository root, all passing; `grep -n 'set -x' scripts/*.sh ops/*.sh` finds nothing; review every `echo`/`printf` in `scripts/deploy.sh`, `scripts/rollback.sh`, `ops/release.sh` and `ops/backup.sh` against contracts/commands.md messages and FR-026 (no environment value, token or link printed)
- [ ] T042 Verify FR-027: read `docs/production.md` top to bottom against the server as prepared and every `ops/` file, confirming each one-time step, install path and command is present and correct and that it holds no secret value; confirm every file in `ops/` is referenced by `docs/production.md` or a script (Constitution II)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup (T008 writes into the T003 skeleton); T009 needs T004 to T008; blocks every story's Verify task
- **US1 (Phase 3)**: after Foundational; it is the delivery path for every later server change
- **US2 (Phase 4)**: after US1 (rollback extends `ops/release.sh` written in US1, and needs two deploys to test)
- **US3 (Phase 5)**: implementation (T025, T026) can start after Foundational; T027 after T009
- **US4 (Phase 6)**: T028 to T031 after Foundational; T032 after a successful deploy (US1), since the unit runs `current/ops/backup.sh`
- **US5 (Phase 7)**: T033 any time after Foundational; T034 after US1 (a live `/health`)
- **US6 (Phase 8)**: T035, T036 any time; T038 after US1 and US4 (searches releases, run records and backup output)
- **Polish (Phase 9)**: after all stories

### User Story Dependencies

- **US1 (P1)**: depends only on Foundational - the MVP
- **US2 (P1)**: depends on US1 (same script, needs deployed releases)
- **US3 (P1)**: independent of US1/US2 for its implementation; its verification is meaningful once a release is live
- **US4 (P2)**, **US5 (P2)**, **US6 (P3)**: independent of each other; each verification needs US1 deployed

### Within Each User Story

- `ops/release.sh` tasks run in order T011 → T012 → T013 → T014 → T015 → T016 → T020 → T020a
- `docs/production.md` tasks run in order T003 → T008 → T017 → T023 → T026 → T031 → T033 → T037 → T040
- Each story's Verify task comes last in the story

### Parallel Opportunities

- Setup: T001, T002, T003 together
- Foundational: T004, T005, T006, T007 together, then T008
- US1: T010 (`scripts/deploy.sh`) in parallel with the `ops/release.sh` sequence
- US2: T019, T021, T022 in parallel with T020
- US3/US4/US6 file work (T025, T028, T029, T030, T035, T036) can run in parallel with US1 implementation once Foundational is done
- Polish: T039 in parallel with T040

---

## Parallel Example: User Story 1

```text
Task: "T010 [US1] Create scripts/deploy.sh (local checks, upload, ssh, exit 4 mapping)"
Task: "T011 [US1] Create ops/release.sh shared helpers" → then T012 … T016 in order
```

## Parallel Example: User Story 4

```text
Task: "T028 [P] [US4] Create ops/backup.sh"
Task: "T029 [P] [US4] Create ops/tracklite-backup.service"
Task: "T030 [P] [US4] Create ops/tracklite-backup.timer"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (server prepared, Caddy answering `502`)
2. Phase 3 US1: `npm run deploy` with atomic, zero-downtime switch
3. **STOP and VALIDATE**: T018 (quickstart.md §1 to §5, §7)

### Incremental Delivery

1. US1 deploy → US2 rollback (deploy is now safe to use for every slice)
2. US3 HSTS (HTTPS itself already comes from Foundational's Caddy) → RM-3 can rely on HTTPS-only cookies
3. US4 backups → must be in place before real data (RM-3 onward)
4. US5 uptime alerts → US6 log retention and secret checks
5. Polish: README, cost, final checks

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- Verify tasks (T009, T018, T024, T027, T032, T034, T038, T042) run on the real VPS with the owner's accounts; SC-005, SC-008 and SC-009 complete only after 15 days, 14 days and the first bills
- Every task that changes `ops/` takes effect on the server only through a deploy (`release.sh`, `backup.sh`) or by re-installing the file as `docs/production.md` describes (units, Caddyfile, sudoers, journald drop-in)
- No database table or migration is added by this slice; the throwaway migrations and commits of quickstart.md §4 to §7 are never merged

---

## Phase 10: Convergence

- [X] T043 In `docs/production.md`, add the command messages the code prints but the doc does not explain: under "Rollback" → "Refusals and failures", `Refused: database could not be checked` (status 2: the applied schema changes could not be read to check the previous release; the live app and the previous-release slot are unchanged, so rollback works again once the check can run); under "Deploy" and "Rollback", `Deploy failed: interrupted; <release id> is live` / `Rollback failed: interrupted; <release id> is live` (status 1) and the `nothing is live yet` variants of the interrupted and health-check messages (contracts/commands.md) per FR-027, FR-009, US2/AC8 (partial)
- [X] T044 Make `npm run lint` pass from the repository root as T041 requires: it currently fails only on the formatting of `.design-sync/config.json` (trailing newline, from commit 8e6e3de, outside this slice), so fix it with `npx biome format --write .design-sync/config.json` or report it to the owner to fix in its own change, then re-run `npm test` (with `TEST_DATABASE_URL` set), `npm run lint` and `npm run typecheck` per T041 (partial)
- [X] T045 Record in the design docs what the code does beyond them: in `specs/002-production-environment/data-model.md`, add the release directory's `SUBJECT` file (the commit subject, written at extraction, used by the `Deployed`/`Rolled back to` lines) to the "Release" table, the `subject` file to "Upload directory", and `RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET` (`true`, not secret, needed with a bucket-scoped R2 token) to the "Server config file" table; in `contracts/commands.md`, add the `subject` file to the upload step of `npm run deploy` per plan: data-model and contracts decisions (unrequested)
