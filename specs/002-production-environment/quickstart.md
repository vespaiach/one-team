# Quickstart: Production Environment (RM-2) validation

Phase 1 output for [plan.md](./plan.md). Run-and-check scenarios that prove the slice works end to end. One-time server setup is in `docs/production.md` (delivered by this slice, FR-027); commands, messages and exit statuses are in [contracts/commands.md](./contracts/commands.md) and [contracts/https-front.md](./contracts/https-front.md); release states and the run record are in [data-model.md](./data-model.md).

## Prerequisites

- Owner decisions recorded (plan.md): Hostinger VPS, existing team domain, Cloudflare R2, Better Stack Uptime; Caddy 2 and rclone approved.
- The VPS prepared per `docs/production.md` (accounts, swap, Node 24, PostgreSQL 18 with the `tracklite` role and peer authentication, Caddy, rclone, `/etc/tracklite/env`, systemd units, journald and sudoers drop-ins, firewall); DNS points at the VPS.
- `~/.ssh/config` has the host alias `tracklite`. `DOMAIN` is the team's domain; `ADMIN` is the SSH destination of the owner's admin account.
- A traffic probe for the zero-downtime trials (SC-010), run outside the VPS (the owner's machine) during a deploy or rollback and stopped after it: it requests `https://$DOMAIN/` and `https://$DOMAIN/health` about 20 times a second in total, each with a time limit (for example `curl --max-time 10`), and logs one line per request: UTC time, path, status (`000` when unanswered or timed out) and, for `/`, the `data-dpl-id` attribute (the release id). For example a `while` loop of `curl -sS -o … -w '%{http_code}'` calls.
- A browser (desktop, developer tools open on the Console) for the page-view part of SC-010.

## 1. First deploy (US1, SC-001)

```sh
git switch main && git pull
npm run deploy
curl -sS -o /dev/null -w '%{http_code}\n' https://$DOMAIN/health        # 200
ssh tracklite readlink /srv/tracklite/current                             # releases/<id>
```

Expected: `Deployed <sha7> …`, exit 0, no prompt. Repeat with 10 small commits on `main` (SC-001).

## 2. Refusals before touching the server (FR-002)

- Another branch: `Refused: not on main …`, exit 2. Edited file: `Refused: uncommitted changes`, exit 2. Unpushed commit: `Refused: local main differs from the shared main`, exit 2.
- Shared `main` unreachable (for example `git remote set-url origin https://invalid.example/x.git` temporarily, or offline): `Refused: the shared main couldn't be checked`, exit 2. Restore the remote.
- In each case `ssh tracklite ls /srv/tracklite/incoming` shows nothing new.
- No earlier outcome is printed by a local refusal (FR-007): leave a run's outcome unreported (§7, dropped connection), trigger one of the refusals above (only the refusal is printed), then run `npm run deploy` from a clean `main`: its first output after the upload is the `Last deploy …` line.

## 3. Zero-downtime deploy (US1 scenario 5, SC-010)

Measured exactly as SC-010 says. Load a page of the app in the browser, start the probe, run `npm run deploy` with a harmless change, and after the command ends use the page loaded before the switch (click a link, open a menu), then stop the probe 10 s later.

Counted as caused by the switch (each must be 0): every probe line that is not `200`, including `000` (unanswered), `502` and `503`; every browser console error for a missing `/_next/static` file. Not counted (FR-005): a request on the old version still running 30 s after the switch, and the gap during a server restart (§7). Also expected: release ids change from the old to the new exactly once and never alternate back, and the page used after the switch loads its own release's files or reloads fully (research R3). Repeat for 10 deploys here and 10 rollbacks in §6 (SC-010).

**Static files of the last 5 releases** (FR-005): keep one browser tab loaded before a run of 5 deploys or rollbacks (§6 cycles count), then use it: no console error for a missing `/_next/static` file, and `ssh tracklite ls /srv/tracklite/releases` shows full directories only for `current`, `previous` and the release last switched away from, the others holding only `.next/static/`. `npm run rollback` never targets a pruned release (it offers only `previous`).

**Redeploy of the live commit** (FR-008): with `previous` → A and B live, run `npm run deploy` again without a new commit (for example after editing `/etc/tracklite/env`). Expected: a full deploy (`Building`, `Switching`), probe all `200`, `current` → a new release id with B's commit, `previous` still → A; `npm run rollback` then switches to A.

## 4. Failing migration (US1 scenario 2, SC-002; slot rule)

With releases A then B deployed (`previous` → A), push a throwaway commit adding `migrations/9999_fail.sql` containing `select 1/0;`, run the probe, deploy.

Expected: `Deploy failed: migration 9999_fail.sql`, exit 1; probe all `200` from B; `current` unchanged; `previous` still → A (nothing was applied). Then push a commit with `migrations/9998_ok.sql` (`create table rm2_probe (id int);`) **and** the failing one, deploy: same failure, but now `previous` is absent and `npm run rollback` prints `Refused: nothing to roll back to` (FR-008, FR-010). Clean up: as `ADMIN`, drop `rm2_probe` and delete its `schema_migrations` row by hand, then revert both commits and deploy (outside such a trial, an applied migration file is never deleted; AGENTS.md).

Review rule (FR-011): `.github/pull_request_template.md` asks a pull request adding a file under `migrations/` why it works with the code live in production (`ssh tracklite cat /srv/tracklite/current/REVISION`), and, after a rollback, says that this is the release two back.

## 5. New version fails `/health` (US1 scenario 4, SC-010)

Push a throwaway commit making `src/app/health/route.ts` answer `503`, run the probe, deploy.

Expected: after about 60 s, `Deploy failed: health check (no 200 within 60 s); <old sha7> still live`, exit 1; the probe shows only the old release id and only `200`; `journalctl -u 'tracklite@*'` shows the new instance received only the `/health` polls (no member requests). Revert and deploy. Repeat (SC-010: 100% of such trials).

Also check the Caddy switch is per request: during trial 3, the release id changes at the switch and never alternates back (a Caddy lookup cached across requests would show old ids after the switch; research R5 stop condition).

## 6. Rollback (US2, SC-003)

```sh
npm run deploy          # release A
# commit and push a harmless change
npm run deploy          # release B; previous → A
npm run rollback        # with the probe running; note the UTC time it is run; probe all 200
ssh tracklite cat /srv/tracklite/current/REVISION   # A's sha
npm run rollback        # Refused: nothing to roll back to, exit 2
npm run deploy          # deploys current main normally (US2 scenario 4)
```

Time each rollback from running the command to the first probe line showing A's release id (the switch; SC-003): under 2 minutes. The drain after the switch is not counted, so `time npm run rollback` is not the measure. Repeat the timed rollback with the probe and the browser page 10 times, counted as in §3 (SC-003, SC-010). No `pg_restore` at any point.

Rollback target fails `/health` (US2 scenario 5): deploy a throwaway release C whose `/health` answers `503` while the file `/tmp/rm2-unhealthy` exists, deploy D on top, create the file, run `npm run rollback`. Expected after about 60 s: `Rollback failed: health check …`, exit 1; the probe shows only D; `previous` still → C. Remove the file and the throwaway commits, and deploy `main`.

## 7. Lock and interrupted runs (FR-005 to FR-007, Edge Cases)

- **Concurrent**: start `npm run deploy` in two terminals at the same moment (both upload together); the one that reaches the lock second prints `Refused: a deploy is running`, exit 3, never `Deploy failed: upload` (its fresh `incoming/` directory is not deleted by the other's cleanup, research R4). Repeat 3 times. During a rollback, `npm run deploy` prints `Refused: a rollback is running`.
- **Dropped connection**: during a deploy's build, kill the local `ssh` process (or turn off the network). The command exits 4. On the server, as `ADMIN`, `pgrep -u tracklite -f 'release.sh'` shows the worker still running; the probe stays `200`. After it finishes, `npm run deploy` (or `rollback`) first prints `Last deploy (<sha7>, …): succeeded at …`, then carries on.
- **Interrupted before the switch**: during a deploy's build, as `ADMIN` note the run's session id (`sudo grep '^session' /srv/tracklite/runs/<newest>-deploy.record`) and run `sudo pkill -KILL -u tracklite -f release.sh`. The lock is free at once (the next command is not refused). `pgrep -s <session>` still lists the build (`npm`/`next build`), which `pkill` did not match. After the next command has printed its first line, `pgrep -s <session>` prints nothing: no process of the dead run remains, so none overlaps the new run (FR-006). Repeat once with the kill during `Migrating` (`scripts/migrate.ts` left over): same result. The next command prints `Last deploy (<release id>, …) was interrupted; <old release id> is live`, release ids in the form `<yyyymmddTHHMMSSZ>-<sha7>`; the probe never left the old release; the slot follows the rule in data-model.md.
- **Rollback while nothing is live** (FR-007): on a server with no release yet, kill the first deploy's worker during its build as above, then run `npm run rollback`. Expected: `Last deploy (<release id>, …) was interrupted; nothing is live yet`, then `Refused: nothing to roll back to`, exit 2; a second `npm run rollback` prints only the refusal.
- **Interrupted after the switch**: add a temporary `sleep 30` after the rename in a throwaway copy of `ops/release.sh`, deploy, kill the worker during the sleep. The probe shows the new release from the switch on; the next command prints `Last deploy (<release id>, …) was interrupted; <new release id> is live`; `previous` → the old release; `npm run rollback` works.
- **Problem after the switch** (FR-007): in a throwaway copy of `ops/release.sh`, make the run-record end write fail (for example write it to a read-only path). Expected: the deploy prints its success line and `Warning: run record not written`, exit 0; the next command prints `Last deploy (<release id>, …) was interrupted; <new release id> is live`.
- **Memory pressure** (Edge Cases): during a deploy's build, as `ADMIN`, check `cat /proc/<pid>/oom_score_adj` is `1000` for the worker and `next build`, `0` for the live instance, and `-900` for the PostgreSQL server process; after the switch the new live instance shows `0`. Optionally, on a throwaway server, run a memory hog at `oom_score_adj` `0` during the build: the build is killed, `Deploy failed: build`, exit 1, the probe stays `200` on the old release. Also, during a deploy's `Checking health`, as `ADMIN` run `sudo kill -KILL <new instance MainPID>`: systemd restarts it, yet the deploy prints `Deploy failed: start`, exit 1, the new instance is stopped and the probe stays `200` on the old release.
- **Upload directories** (FR-006): while a deploy runs, a second `npm run deploy` uploads into its own `incoming/<random id>/` and prints `Refused: a deploy is running`, exit 3; the running deploy is unaffected. The refused invocation's directory survives the running deploy's cleanup; a later run's cleanup deletes it once it is more than 60 minutes old (check with `ls -l /srv/tracklite/incoming`).
- **Live instance not running** (FR-004, FR-009): with release A live and B in the slot, as `ADMIN` run `sudo systemctl stop tracklite@<A>.service` (the probe shows `502`), then `npm run rollback`: it does not fail with `oom_score_adj reset`, starts B, switches (the probe shows B), nothing is drained, exit 0. Repeat with `npm run deploy` of `main` instead of the rollback: same, the new release goes live.
- **Server restart mid-run**: `sudo reboot` during a deploy's build. After boot, the old release answers (`tracklite-boot.service`); the next command reports `Last deploy (<release id>, …) was interrupted; <old release id> is live`. The gap while the server restarts is not counted under SC-010.

## 8. HTTPS (US3, SC-004)

```sh
for p in / /health '/my-issues?x=1' /api/nothing; do
  curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "http://$DOMAIN$p"
done
# each: 308 https://$DOMAIN<same path and query>
curl -sSI https://$DOMAIN/ | grep -i strict-transport-security
# strict-transport-security: max-age=31536000   (no includeSubDomains, no preload)
openssl s_client -connect $DOMAIN:443 -servername $DOMAIN </dev/null | openssl x509 -noout -issuer -enddate
```

Renewal: after the renewal window, `sudo journalctl -u caddy | grep -i renew`.

## 9. Backups (US4, SC-005)

```sh
ssh $ADMIN sudo systemctl start tracklite-backup.service
ssh $ADMIN sudo journalctl -u tracklite-backup -n 20      # Backup written: tracklite-<stamp>.dump
rclone lsf backup:<bucket>/<folder>                          # from the owner's machine, without the VPS (FR-019)
```

- Retention: with 14 objects, run once more; the oldest is gone, 14 remain. Every object counts toward the 14, including those from these hand-run trials (FR-017).
- Failure: temporarily set a wrong `RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY`, run; `Backup failed: upload`, unit failed, the 14 untouched. Restore the key.
- Schedule: `systemctl list-timers tracklite-backup.timer` shows 03:00 UTC. Over 15 days, starting after the last hand-run trial above: one new object per day, 14 at the end (SC-005).
- Restore is documented in `docs/production.md`; rehearsed in RM-14 (OPS-003.1).

## 10. Uptime alert (US5, SC-006)

- `sudo systemctl stop postgresql` and note the UTC time: `/health` answers `503`; alert email within 12 minutes of the stop. Start it. Repeat 3 times; all 3 must pass (SC-006).
- Stop the live instance (`sudo systemctl stop tracklite@<id>`) for about 12 minutes: Caddy answers `502`; an alert arrives. Start it again.
- Stop PostgreSQL across one check only: no email.
- Error-log filter (FR-026): during the live-instance stop above, while Caddy answers `502`, send `curl -sS -o /dev/null "https://$DOMAIN/x?token=rm2-fake-token-<random>"`, then as `ADMIN` run `sudo journalctl --since -15min | grep -cF rm2-fake-token-<random>` (the whole journal): `0`. Caddy's `502` error line for that request (`sudo journalctl -u caddy --since -15min -o cat`) holds only the method, the path `/x` without the query string, the status and the error: its `request` object has no other field (no `remote_ip`, `remote_port`, `client_ip`, `proto`, `host`, `headers` or `tls`).
- Each alert email names the address checked and when the failures started.
- During trials 3 and 6 no alert is sent (the live release answers throughout).

## 11. Secrets and logs (US6, SC-007, SC-008)

```sh
npm test                                                   # includes the no-committed-settings-file test
ssh $ADMIN 'sudo stat -c "%U:%G %a" /etc/tracklite/env'   # root:tracklite 640
ssh $ADMIN 'sudo -u nobody cat /etc/tracklite/env'        # Permission denied
```

On the server, as `ADMIN`, search every release, the run records, the upload directories (`/srv/tracklite/incoming/`), 14 days of journal and the log files under `/var/log` for each secret value, printing counts or file names only:

```sh
sudo grep -E '^(DATABASE_URL|RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY|RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID)=' /etc/tracklite/env | cut -d= -f2- > /root/secret-values
sudo sed -nE 's|^DATABASE_URL=[^:]+://[^:@]*:([^@]+)@.*|\1|p' /etc/tracklite/env >> /root/secret-values   # the database password on its own
sudo grep -rlF -f /root/secret-values /srv/tracklite/releases /srv/tracklite/runs /srv/tracklite/incoming --exclude-dir=node_modules   # no output
sudo journalctl --since -14d | grep -cF -f /root/secret-values                                                 # 0
sudo zgrep -lF -f /root/secret-values /var/log/syslog* /var/log/auth.log* /var/log/ufw.log* /var/log/postgresql/*   # no output
sudo shred -u /root/secret-values
```

PostgreSQL's server log holds no row data or statements (FR-026): as `ADMIN`, with `<random>` a fresh value,

```sh
sudo -u postgres psql -Atc 'SHOW log_error_verbosity' -c 'SHOW log_min_error_statement'   # terse, panic
sudo -u tracklite psql -d tracklite -c "create temp table rm2_c (v text primary key); insert into rm2_c values ('rm2-row-<random>'), ('rm2-row-<random>');"   # ERROR: duplicate key …
sudo grep -A3 'rm2_c_pkey' /var/log/postgresql/postgresql-18-main.log   # the ERROR line only: no DETAIL: line, no STATEMENT: line
sudo grep -c 'rm2-row-<random>' /var/log/postgresql/postgresql-18-main.log   # 0
```

Also search a saved copy of the deploy, rollback and backup output (SC-007). Logs (server-wide, every unit in the journal, including system and SSH logs): nothing older than 15 days (`sudo journalctl -o short-iso | grep -m1 -v '^--'` shows the oldest entry; journald drops a whole day file once its newest entry passes 14 days, so up to about 15 days can remain); each of the last 14 days has entries; the same rule for the rsyslog and PostgreSQL files under `/var/log` (`ls -l --time-style=+%F /var/log/syslog* /var/log/auth.log* /var/log/ufw.log* /var/log/postgresql/`: at most the current file plus 14 rotated ones, none last written more than 15 days ago, and the rotated files cover each of the last 14 days); `sudo journalctl --disk-usage` checked during the period, as `docs/production.md` says; run records and logs in `/srv/tracklite/runs/` are outside SC-008 (pruned at the next run, newest record kept); the request log continues across a deploy with no gap (US6 scenario 4: `journalctl -u 'tracklite@*'` shows lines from both instances around the switch).

## 12. Cost (SC-009)

Replace research R11's assumed prices with Hostinger's (including renewal), Cloudflare R2's and Better Stack's current prices; hosting total under $20, and the headroom left for email (about $6 at the VPS renewal price) recorded in `docs/production.md` "Cost". Confirm with the first monthly bills. The total including email is checked in RM-3 (FR-028).
