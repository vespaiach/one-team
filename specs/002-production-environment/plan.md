# Implementation Plan: Production Environment

**Branch**: `002-production-environment` (work stays on `colau/speckit-sdd-orchestrator-b79f9d`) | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md) | **Design**: [design.md](./design.md) (Status: Not applicable)

**Input**: Feature specification from `specs/002-production-environment/spec.md` (including every Clarification of 2026-10-01; superseded answers ignored); behavior from `docs/tracklite-spec.md` (OPS-002 to OPS-006, SEC-005, SEC-007, NFR-009, sections 3 and 12); constitution v1.8.0; RM-1 code (`/health`, `readSettings()`, `scripts/migrate.ts` and `schema_migrations`, JSON request log); Next.js 16 docs in `node_modules/next/dist/docs/` (`next start` options, self-hosting, `deploymentId`).

**Status**: Planned. Re-planned on 2026-10-01 for the atomic, zero-downtime, symlink-based deploy the spec now requires; the earlier stop-then-start design is removed. Updated the same day for the spec's latest Clarifications: the deploy's own work is the OOM killer's first choice; the static files of the last 5 releases are kept; post-switch problems are warnings on a `succeeded` run; the missed outcome is printed first once a command reaches the server; a redeploy of the live commit leaves the previous-release slot unchanged; requests in progress get 30 s after the switch; the FR-011 review checks against the code actually live. No open owner question: the provider and software decisions below were already made, and the new design needs no further third-party software.

## Summary

RM-2 puts the RM-1 app on one Ubuntu VPS behind Caddy (automatic Let's Encrypt HTTPS, HTTP→HTTPS redirect, one-year host-only HSTS, no access log). Each release is prepared completely in its own directory under `/srv/tracklite/releases/` with a fixed port (`3001` or `3002`, the one the live release does not use) and runs as its own `tracklite@<release>` systemd instance. The `current` symlink names the live release; Caddy routes every request by one lookup through it (`current/port-3001` exists → `:3001`, else `:3002`), so the **atomic rename of `current` is the switch** that moves traffic, with no Caddy reload. `npm run deploy` checks the checkout is a clean `main` equal to the shared `main`, uploads the commit into a per-invocation `incoming/<random id>/` directory, and the server-side `ops/release.sh` hands a `flock` it holds to a detached worker that keeps running if the connection drops: build (with `NEXT_DEPLOYMENT_ID`), migrate, start the new version beside the old, wait up to 60 s (every 2 s) for `/health` `200`, rename `current`, set `previous` (unchanged on a redeploy of the live commit), drain the old version for 30 s and stop it. The worker, its children and the not-yet-live instance run at `oom_score_adj` 1000, so under memory pressure the deploy's work is killed first and the deploy fails before switching. A failure before the rename never touches the live release; a problem after it is a warning on a `succeeded` run. The `.next/static/` folders of the last 5 live releases are kept and served per page by deployment id. `npm run rollback` does the same switch back to `previous` and empties the slot. Run records on the server let the next command print an unreported or `interrupted` outcome first, once it reaches the server, and finish an interrupted run's bookkeeping. A systemd timer runs `pg_dump` at 03:00 UTC to Cloudflare R2 with rclone, keeping 14. Secrets live in `/etc/tracklite/env`; logs go to the journal, kept 14 days server-wide (rsyslog's and PostgreSQL's `/var/log` files set to `daily` + `rotate 14` in their logrotate configs at setup), with Caddy's error lines filtered to method, path without query, status and error; Better Stack emails the owner after two failed `/health` checks. No app code, table or npm package is added. Details: [research.md](./research.md).

## Technical Context

**Language/Version**: Bash (owner's machine and server) for the deploy, rollback, release and backup scripts; the app stays TypeScript on Node.js 24 LTS with Next.js 16.3 (RM-1)

**Primary Dependencies**: no new npm package. Server: Ubuntu 24.04 LTS, Node.js 24 (NodeSource), PostgreSQL 18 (PGDG, with its `psql` and `pg_dump`), systemd and journald, `ufw`, util-linux (`flock`, `setsid`), `curl`, `sudo` (base system); Caddy 2 and rclone (approved by the owner 2026-10-01). External: Hostinger VPS, an existing team domain, Cloudflare R2, Better Stack Uptime (free tier)

**Storage**: PostgreSQL 18 on the VPS (localhost and Unix socket); release directories, symlink slots and run records under `/srv/tracklite`; daily `pg_dump` files in Cloudflare R2. No new table or migration ([data-model.md](./data-model.md))

**Testing**: one Vitest unit test beside RM-1's `src/server/env-files.test.ts` (no committed settings file other than `.env.example`, OPS-006.1); everything else is "Verify: ops", checked by the trials in [quickstart.md](./quickstart.md), including a request probe for zero downtime (SC-010)

**Target Platform**: one Hostinger VPS (Ubuntu 24.04, 2 vCPU, ≥ 2 GB RAM plus a 2 GB swap file, ≥ 40 GB disk), which fits two app processes during a switch (research R1); owner's machine with Git, Bash and SSH

**Project Type**: web application (the RM-1 Next.js project) plus operations scripts and server configuration

**Performance Goals**: zero member-visible downtime and zero switch-caused errors during deploys and rollbacks (FR-005, SC-010); new version's `/health` wait at most 60 s, polled every 2 s (FR-004); rollback live within 2 minutes (SC-003); outage email within 12 minutes of the stop, 3 of 3 trials (SC-006)

**Constraints**: one VPS, no containers, no CI deploy, no staging; exactly one complete release live at every moment, switched by one atomic symlink rename (FR-005, spec Assumptions); no page view mixes releases, with the static files of the last 5 releases kept (FR-005); requests in progress get 30 s after the switch (FR-005); deploy work killed first under memory pressure (Edge Cases); exit statuses 0 to 4 only (FR-007); one deploy or rollback at a time, the lock tied to a live run (FR-006); runs continue after a dropped connection (FR-005); secrets only in `/etc/tracklite/env` (FR-023 to FR-026, SEC-007); hosting under $20 per month, with the headroom left for the planned email provider recorded; the total including email is checked in RM-3 (FR-028, NFR-009); no new package or server software without owner approval (Constitution IV)

**Scale/Scope**: team under 15; 2 owner commands, 1 server-side release script, 1 backup script, 1 Caddyfile, 4 systemd unit files, 2 drop-ins (journald, sudoers), 1 operations doc, 1 pull-request template, 1 unit test

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Checked against constitution v1.8.0.

| Principle | Pre-design | Post-design | Notes |
|-----------|-----------|-------------|-------|
| I. Simplicity First | Pass | Pass | The smallest mechanism meeting the mandated symlink, zero-downtime method: one symlink rename as the switch, read by Caddy on each request (no reload, no second state); two fixed ports; one systemd template; one script for deploy and rollback; `flock` and `setsid` from the base system for the lock and the detached run; one durable invariant (R2a) instead of step-tracking for the rollback slot; `oom_score_adj` written through `/proc` (kernel, no root) for memory pressure; old static files kept by pruning release directories to `.next/static/` in place, so Caddy's existing deployment-id rule serves them unchanged; a port chosen at start, so a redeploy of the live commit needs no special case beyond leaving `previous` alone. Version-skew handling uses Next.js's own `NEXT_DEPLOYMENT_ID` with no config change. No deploy tool, process manager or app code change. |
| II. No Dead Code | Pass | Pass | Every new file is used: the two scripts by `package.json`, `ops/release.sh` by them, `ops/backup.sh` by its unit, each unit and drop-in by the setup in `docs/production.md`, the pull-request template by GitHub. `.env.example` unchanged. No on-demand backup command. |
| III. No Code Comments | Pass | Pass | The only `src/` change is one test, without comments. Scripts and configuration sit outside `src/`. |
| IV. Dependency Approval | Pass | Pass | No npm package. Caddy 2 and rclone: approved by the owner on 2026-10-01. Everything else is in the approved stack (Node.js 24, PostgreSQL 18 and its client tools) or the Ubuntu base system (systemd, util-linux, curl, sudo, ufw). The zero-downtime design and the latest clarifications (OOM ranking via `/proc/<pid>/oom_score_adj`, static-file pruning, per-invocation upload directories, warnings, live history) add no third-party software, so no new approval is needed. |
| V. UI Design Gate | Pass | Pass | design.md: Status Not applicable (no screen, overlay, email or in-app text; command output and the external alert email are not app UI). |

**Gate result**: PASS before and after design (re-checked after the latest Clarifications). No violation, no Complexity Tracking entry, no open question.

## Owner decisions

Made by the owner on 2026-10-01 and carried over unchanged into this re-plan.

**Q1. Providers.**

| Item | Decision | Notes |
|------|----------|-------|
| VPS | **Hostinger**, Ubuntu 24.04, 2 vCPU, ≥ 2 GB RAM, ≥ 40 GB disk | Re-checked for two app processes side by side: about 1.1 GB during a switch, about 2.2 GB peak while building (the build peak existed before); fits with the 2 GB swap file (research R1). No larger plan needed. Uses only SSH, Ubuntu packages and `ufw`. |
| Domain and DNS | **an existing team domain**, A (and AAAA) record to the VPS | Fallback: Cloudflare Registrar with the proxy off, so Caddy terminates HTTPS. |
| Off-server backups | **Cloudflare R2** | Different company from the VPS provider. |
| Uptime monitor | **Better Stack Uptime, free tier** | Research R10's stop condition and fallback apply. |

**Q2. Constitution IV.** **Caddy 2** and **rclone** approved (2026-10-01). No other new third-party server software is used.

**NFR-009**: RM-2 proves hosting under $20, about $6 left for email: hosting is about $7 to $14 per month on assumed prices, leaving about $6 for the email provider at the VPS renewal price (research R11), recorded in `docs/production.md` "Cost". The full NFR-009 total including email is checked in RM-3 when it picks the provider (DEC-003: stop and ask if it doesn't fit). The zero-downtime design adds nothing to the cost.

## Design notes carried into implementation

- The switch is `ln -s releases/<id> current.next && mv -T current.next current`; nothing else changes traffic. `previous` is written only after that rename (left as it was when the new release has the live commit), the new id is appended to `/srv/tracklite/live-history`, and an interrupted run's bookkeeping is finished by the next command from the run record (research R2b).
- After the switch nothing changes the outcome: a killed old instance, a leftover, a failed `oom_score_adj` reset or an unwritten run record each print `Warning: <problem>` on a `succeeded` run, exit 0; an unwritten record is reported by the next command as `interrupted`, naming the new live release (FR-007, research R2).
- Memory pressure: the worker writes `1000` to its own `oom_score_adj` before any step and to the new instance's right after starting it, and `0` to the new live instance after the switch; it records the new instance's (or rollback target's) `MainPID` at start and rechecks it at each `/health` poll and right before the rename, failing with `start` if it changed or is `0`, so a candidate restarted by `Restart=on-failure` (at `oom_score_adj` `0`) is never switched to, while the live instance keeps that restart protection; each run's cleanup first writes `0` to the live instance's `/proc/<MainPID>/oom_score_adj` (resetting a `1000` left by an earlier failed reset) and, if that write fails, the run fails (`oom_score_adj reset`, exit 1) before any deploy work; PostgreSQL keeps postgresql-common's `-900` (research R1).
- Ports are written into a release each time it is started before a switch, as the one the live release does not use (research R2).
- Cleanup under the lock: the live instance's `oom_score_adj` reset to `0` first, skipped when it has no running process (`MainPID` `0`), so a deploy or rollback can replace a live release that is down (research R1, R2); other `incoming/` directories more than 60 minutes old deleted, so a concurrent invocation's upload survives and it is refused at the lock (research R4); `current` and `previous` kept whole; the 5 most recent earlier live releases pruned to `.next/static/`; everything else deleted (research R3, R4); a rollback deletes and prunes release directories after its switch (research R2).
- The unreported outcome is the first output of `ops/release.sh`; local refusals and upload failures print none (research R4). Any SSH connection failure after the upload exits 4 with the connection-lost message printed by the local script.
- Rollback-slot invariant S2 (data-model.md): checked at the end of every failed deploy and at the start of every command, by reading `schema_migrations` with `psql -d tracklite` (peer authentication).
- The new instance is checked directly on its port (`curl --max-time 2 http://127.0.0.1:<port>/health`), never through Caddy, so it gets no member traffic before the switch.
- After the switch: wait 2 s, then `systemctl stop` the old instance (SIGTERM; `next start` finishes in-flight requests; `TimeoutStopSec=30`), so every request in progress at the switch has at least 30 s to finish (FR-005).
- The build never sees `/etc/tracklite/env`; it gets `NEXT_TELEMETRY_DISABLED=1` and `NEXT_DEPLOYMENT_ID=<release id>`. Stop condition: if `next build` needs a setting, stop and ask (research R3).
- Migrations run as `node --env-file=/etc/tracklite/env scripts/migrate.ts` in the new release; `scripts/migrate.ts` needs no change: `release.sh` passes through only its `Applied <name>` and `Nothing pending` lines, and on failure takes the file name from `Migration failed: <name>` and drops the cause text (the PostgreSQL error can quote data values; FR-026).
- Stop condition: if the trials show Caddy's `file` matcher result reused across requests, stop and ask before choosing another switch (research R5).
- Scripts use `set -euo pipefail`, never `set -x`, and never pass a secret on a command line (research R9).
- Restoring a backup (`rclone copyto` the newest object, `pg_restore --clean --if-exists --no-owner -d tracklite`) is documented in `docs/production.md`; rehearsed in RM-14 (OPS-003.1).
- `README.md` gets `npm run deploy` and `npm run rollback` in its Scripts table and a link to `docs/production.md`; `AGENTS.md` gets the `ops/` folder in its source layout line and, in its migration convention, the FR-011 pull-request statement: why the change works with the code actually live in production when it is applied, which after a rollback is the release two back, and the statement says so.

## Implementation outline

1. **Owner commands**: `scripts/deploy.sh`, `scripts/rollback.sh`; `package.json` scripts `deploy` and `rollback` ([contracts/commands.md](./contracts/commands.md)).
2. **Server-side release**: `ops/release.sh` (front and worker; lock hand-off; `oom_score_adj`; cleanup incl. `incoming/` and static pruning; build; migrate; port files; start; `/health` wait; switch; live history; drain; post-switch warnings; run records; interrupted-run bookkeeping; slot invariant) per [data-model.md](./data-model.md).
3. **App units**: `ops/tracklite@.service`, `ops/tracklite-boot.service`, `ops/sudoers-tracklite`.
4. **HTTPS front**: `ops/Caddyfile` per [contracts/https-front.md](./contracts/https-front.md).
5. **Backups**: `ops/backup.sh`, `ops/tracklite-backup.service`, `ops/tracklite-backup.timer`.
6. **Logs**: `ops/journald-tracklite.conf`; a one-time setup step in `docs/production.md` sets `/etc/logrotate.d/rsyslog` and `/etc/logrotate.d/postgresql-common` to `daily` + `rotate 14` (no file added to the repository; research R8).
7. **Review rule**: `.github/pull_request_template.md` (FR-011: compatible with the code actually live, two back after a rollback).
8. **Test**: extend `src/server/env-files.test.ts`.
9. **Docs**: `docs/production.md` (FR-027: one-time setup incl. swap, PostgreSQL role with peer authentication and its `OOMScoreAdjust=-900` checked, `/etc/tracklite/env`, installing the `ops/` files, DNS, R2 bucket and scoped token, Better Stack settings; deploy; rollback; reading logs and run records; restoring a backup; cost table); `README.md`, `AGENTS.md` updates.
10. **Validation**: the trials in [quickstart.md](./quickstart.md) on the real server.

## Project Structure

### Documentation (this feature)

```text
specs/002-production-environment/
├── spec.md
├── design.md            # Status: Not applicable
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1: releases, slots, transitions, run record, lock, config, backup
├── quickstart.md        # Phase 1: validation trials
├── contracts/
│   ├── commands.md      # deploy, rollback, release script, app units, backup job, PR rule
│   └── https-front.md   # Caddy: redirect, HSTS, per-request switch, static files by release
├── checklists/
│   ├── requirements.md
│   └── deploy.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json                      # + "deploy", "rollback" scripts
README.md                         # + deploy/rollback rows, link to docs/production.md
AGENTS.md                         # + ops/ in source layout; FR-011 statement in the migration convention
.github/
└── pull_request_template.md      # "Schema changes": why compatible with the code live in production (two back after a rollback)
docs/
└── production.md                 # one-time setup, deploy, rollback, logs, restore, cost (FR-027)
scripts/
├── deploy.sh                     # owner's machine: checks, upload, run ops/release.sh deploy
└── rollback.sh                   # owner's machine: run current/ops/release.sh rollback (newest incoming/*/release.sh when nothing is live)
ops/
├── release.sh                    # server: front + detached worker, lock, oom_score_adj, cleanup, build, migrate, start, health, switch, drain, warnings, records
├── backup.sh                     # server: pg_dump, rclone upload, keep 14
├── tracklite@.service            # one instance per release (next start on 127.0.0.1:$PORT)
├── tracklite-boot.service        # at boot, start the instance `current` points at
├── tracklite-backup.service      # one backup run
├── tracklite-backup.timer        # 03:00 UTC daily
├── Caddyfile                     # HTTPS, redirect, HSTS, per-request switch via current/port-3001, static by release, error-log filter (only method, path without query, status, error)
├── journald-tracklite.conf       # persistent journal, daily files, 14-day retention server-wide, default size cap
└── sudoers-tracklite             # tracklite may only start/stop tracklite@<release id>.service
src/server/
└── env-files.test.ts             # + no tracked settings file other than .env.example
```

On the server (not in the repository): `/srv/tracklite/{releases/,current,previous,incoming/<random id>/,runs/,live-history,release.lock}`, `/etc/tracklite/env`.

**Structure Decision**: The RM-1 single Next.js project is unchanged. Commands the owner runs go in `scripts/` beside `migrate.ts`; files installed on or run only on the server go in a top-level `ops/` folder; operations documentation goes in `docs/production.md`; the review rule goes in GitHub's standard `.github/pull_request_template.md`.

## Complexity Tracking

No constitution violations to justify.
