# Production

## One-time server setup

Done once, by the owner, on a fresh server. Commands run as the owner's admin account unless they say otherwise. `<domain>` is the team's domain and `<vps address>` the server's public IP address. No secret value is ever written in this document, a script or the repository: secrets go only into `/etc/tracklite/env` on the server.

### 1. Server and admin account

1. Order a Hostinger VPS with Ubuntu 24.04 LTS: 2 vCPU, at least 2 GB RAM, at least 40 GB disk.
2. Create the owner's admin account with an SSH key and `sudo`, then turn off password and root login over SSH:

   ```sh
   adduser <admin>
   usermod -aG sudo <admin>
   install -d -m 0700 -o <admin> -g <admin> /home/<admin>/.ssh
   # put the owner's public key in /home/<admin>/.ssh/authorized_keys, owned by <admin>, mode 0600
   ```

   In `/etc/ssh/sshd_config` set `PasswordAuthentication no` and `PermitRootLogin no`, then `sudo systemctl restart ssh`. Check from a second terminal that `ssh <admin>@<vps address>` still works before closing the first.
3. Update the system: `sudo apt update && sudo apt full-upgrade -y`.
4. Add a 2 GB swap file (the build needs it on a 2 GB plan):

   ```sh
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

   Check: `swapon --show` lists `/swapfile` with size `2G`.
5. Firewall, allowing SSH, HTTP and HTTPS only:

   ```sh
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

   Check: `sudo ufw status` lists 22, 80 and 443 only.

### 2. Node.js 24

```sh
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
```

Check: `node --version` prints `v24.…`.

### 3. PostgreSQL 18

```sh
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt install -y postgresql-18
```

PostgreSQL listens on `localhost` and its Unix socket only (the default `listen_addresses`). Create the `tracklite` role, with a password typed at the prompt, and its database:

```sh
sudo -u postgres createuser --pwprompt tracklite
sudo -u postgres createdb --owner=tracklite tracklite
```

The default `/etc/postgresql/18/main/pg_hba.conf` already gives what Tracklite needs: password authentication (`scram-sha-256`) over TCP on `127.0.0.1` and `::1`, used by the app through `DATABASE_URL`, and peer authentication on the Unix socket, used by the `tracklite` OS account for the deploy's checks and the backups. Leave it unchanged.

Keep row data and statements out of PostgreSQL's server log: in `/etc/postgresql/18/main/postgresql.conf` set

```text
log_error_verbosity = terse
log_min_error_statement = panic
```

then apply and check:

```sh
sudo systemctl reload postgresql
sudo -u postgres psql -c 'SHOW log_error_verbosity' -c 'SHOW log_min_error_statement'
```

Expected: `terse` and `panic`.

Check that PostgreSQL ranks below the app for the kernel's out-of-memory killer: `systemctl show -p OOMScoreAdjust postgresql@18-main` prints `OOMScoreAdjust=-900`.

### 4. The `tracklite` account and `/srv/tracklite`

The `tracklite` system account runs the app and is the account `npm run deploy` and `npm run rollback` log in as, with an SSH key only (it has no password).

```sh
sudo useradd --system --create-home --home-dir /srv/tracklite --shell /bin/bash tracklite
sudo chmod 0755 /srv/tracklite
sudo -u tracklite install -d -m 0755 /srv/tracklite/releases
sudo -u tracklite install -d /srv/tracklite/incoming /srv/tracklite/runs
sudo -u tracklite touch /srv/tracklite/release.lock
sudo -u tracklite install -d -m 0700 /srv/tracklite/.ssh
# put the owner's public key in /srv/tracklite/.ssh/authorized_keys, owned by tracklite, mode 0600
```

`/srv/tracklite` and `releases/` are set to `0755` explicitly (Ubuntu 24.04 creates home folders as `0750`) so that the `caddy` user can read `current/port-3001` and each release's `.next/static/`. Each release directory is also `0755`.

On the owner's machine, add the host alias used by the deploy and rollback commands to `~/.ssh/config`:

```text
Host tracklite
  HostName <vps address>
  User tracklite
  IdentityFile ~/.ssh/<owner's key>
```

Check: `ssh tracklite ls /srv/tracklite` lists `incoming`, `release.lock`, `releases` and `runs`.

### 5. Server config file `/etc/tracklite/env`

The only place secrets live on the server. Create it empty with the right owner and mode, then edit it:

```sh
sudo install -d -m 0755 /etc/tracklite
sudo install -m 0640 -o root -g tracklite /dev/null /etc/tracklite/env
sudoedit /etc/tracklite/env
```

One `NAME=value` line per setting:

- `DATABASE_URL`: the PostgreSQL connection URL for the `tracklite` role on `localhost`, port `5432`, database `tracklite`, with the password chosen in step 3.

The backup settings are added in "Backups and restore". Check: `ls -l /etc/tracklite/env` shows `-rw-r----- root tracklite`. Never copy this file anywhere else.

### 6. Caddy and DNS

Install Caddy 2 from its apt repository:

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

At the domain's DNS provider, point an `A` record for `<domain>` at the VPS's IPv4 address, and an `AAAA` record at its IPv6 address if it has one. If the domain uses Cloudflare, set these records to "DNS only" (proxy off), so Caddy itself terminates HTTPS. Wait until `dig +short <domain>` answers the VPS's address.

Give Caddy the domain through a drop-in, so it is not written in the Caddyfile: `sudo systemctl edit caddy` and add

```text
[Service]
Environment=TRACKLITE_DOMAIN=<domain>
```

Copy `ops/Caddyfile` from the repository to the server and install it (from the owner's machine, `scp ops/Caddyfile <admin>@<vps address>:/tmp/`):

```sh
sudo install -m 0644 /tmp/Caddyfile /etc/caddy/Caddyfile
sudo -u caddy env TRACKLITE_DOMAIN=<domain> caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl restart caddy
```

Caddy obtains the Let's Encrypt certificate on its own; `journalctl -u caddy` shows it.

### 7. App units and the sudo rule

Copy the three files from the repository to the server (from the owner's machine):

```sh
scp 'ops/tracklite@.service' ops/tracklite-boot.service ops/sudoers-tracklite <admin>@<vps address>:/tmp/
```

On the server, install the units and enable the boot unit (it starts the live release after a reboot; the `tracklite@` instances themselves are never enabled):

```sh
sudo install -m 0644 '/tmp/tracklite@.service' /tmp/tracklite-boot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tracklite-boot.service
```

Install the sudo rule, which lets `tracklite` run only `systemctl start` and `systemctl stop` on `tracklite@<release id>.service`:

```sh
sudo visudo -cf /tmp/sudoers-tracklite
sudo install -m 0440 -o root -g root /tmp/sudoers-tracklite /etc/sudoers.d/tracklite
sudo visudo -c
```

Each `visudo` must print `parsed OK`. Then check:

- `sudo -l -U tracklite` lists only the two `systemctl` rules (`start` and `stop`).
- `sudo -u tracklite sudo -n systemctl start tracklite@x.service` is refused (`a password is required`).

### 8. Final check

From the owner's machine, before the first deploy:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/
```

Expected: `502` over a valid certificate (Caddy answers, nothing is deployed yet). `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://<domain>/x?y=1'` answers `308 https://<domain>/x?y=1`.

## Deploy

From the repository root, on a clean `main` that is pushed to the shared `main`:

```sh
git switch main && git pull
npm run deploy
```

The command checks the checkout without contacting the server, uploads the commit into its own `/srv/tracklite/incoming/<random id>/` directory, and runs that commit's `ops/release.sh` on the server. The server builds the release in its own directory, applies schema changes, starts it beside the live release, waits up to 60 s for `/health` to answer `200`, then switches traffic with one atomic rename of `/srv/tracklite/current`. Members see no downtime. The release switched away from becomes the previous release (the rollback target) and gets 30 s to finish the requests it is handling.

Progress lines name each step (`Uploading`, `Installing`, `Building`, `Migrating`, `Starting <sha7> on port <port>`, `Checking health`, `Switching`, `Draining <old sha7>`). Success ends with `Deployed <sha7> "<subject>" at <time> (started <time>)`, followed by a `Warning: <problem>` line for each problem after the switch (the deploy still succeeded; the next deploy cleans up).

### Exit statuses

| Status | Meaning |
|--------|---------|
| 0 | Deployed. |
| 1 | Failed before the switch: the live release is unchanged. |
| 2 | Refused by a check: nothing changed. |
| 3 | Refused because another deploy or rollback is running: nothing changed. |
| 4 | Connection lost: the deploy may still be running on the server. |

### Refusals (status 2, the server is not contacted)

- `Refused: not on main (on <branch>)`: switch to `main`.
- `Refused: uncommitted changes`: commit or discard them.
- `Refused: the shared main couldn't be checked`: GitHub could not be reached; try again later.
- `Refused: local main differs from the shared main`: push or pull first.

### Failures (status 1, the live release keeps serving)

- `Deploy failed: upload`: the upload to the server failed.
- `Deploy failed: oom_score_adj reset`: the live app's memory priority could not be reset; nothing else was done.
- `Deploy failed: disk space`: less than about 3 GB free under `/srv/tracklite`.
- `Deploy failed: install` / `Deploy failed: build`: `npm ci` or `next build` failed (also when memory or disk ran out).
- `Deploy failed: migration <file>`: that schema change failed. Earlier schema changes of the same deploy stay applied, and if any were, the previous-release slot is emptied, so `npm run rollback` refuses.
- `Deploy failed: start`: the new version did not start or did not keep running until the switch.
- `Deploy failed: health check (no 200 within 60 s); <old sha7> still live`: the new version never answered `/health`; it was stopped and got no member traffic. On a first deploy it ends `; nothing is live yet` instead.
- `Deploy failed: interrupted; <release id> is live`: the server-side run ended without recording an outcome before the switch; the named release is live (`Deploy failed: interrupted; nothing is live yet` on a first deploy).

### Dropped connection and earlier outcomes

A deploy that got past the lock keeps running on the server if the connection drops (status 4). The next `npm run deploy` or `npm run rollback`, once it reaches the server, first prints the outcome it missed, for example `Last deploy (<sha7>, started <time>): succeeded at <time>`, or `Last deploy (<release id>, started <time>) was interrupted; <release id> is live` for a run that died (the next command finishes its bookkeeping first; `; nothing is live yet` when no release is live yet). Local refusals and upload failures print no earlier outcome.

### Changing the server config file

Every release reads `/etc/tracklite/env` when it starts. To apply an edit, run `npm run deploy` again without a new commit: it is a full deploy of the live commit (new release, switch with no downtime) and leaves the previous-release slot as it was.

### Run records

Each deploy that got past the lock writes `/srv/tracklite/runs/<time>-deploy.record` (command, commit, release ids, times, outcome, reason, warnings) and `<time>-deploy.log` (everything it printed). They hold no secret and are deleted after 14 days, except the newest record. Release directories are in `/srv/tracklite/releases/`; `current` and `previous` are symlinks to them, and the live release's commit is in `/srv/tracklite/current/REVISION`.

## Rollback

From the repository root, on any branch:

```sh
npm run rollback
```

The command switches the live app back to the release in the previous-release slot (`/srv/tracklite/previous`). It runs the live release's own `ops/release.sh` on the server, starts the previous release beside the live one on the other port, waits up to 60 s for its `/health` to answer `200`, then switches traffic with the same atomic rename of `/srv/tracklite/current` as a deploy. Members see no downtime, and the switch happens within 2 minutes of running the command. The release switched away from gets 30 s to finish the requests it is handling. There is no build and no database step: a rollback never restores or changes the database, so the release rolled back to runs against the schema as it is now.

Progress lines name each step (`Starting <sha7> on port <port>`, `Checking health`, `Switching`, `Draining <old sha7>`). Success ends with `Rolled back to <sha7> "<subject>" at <time> (started <time>)`, followed by a `Warning: <problem>` line for each problem after the switch (the rollback still succeeded; the next run cleans up).

The exit statuses are those of `npm run deploy` (0 rolled back, 1 failed before the switch, 2 refused, 3 another run in progress, 4 connection lost). Like a deploy, a rollback first prints the outcome of an earlier run that was never reported, and keeps running on the server if the connection drops.

### Refusals and failures

- `Refused: nothing to roll back to` (status 2): the previous-release slot is empty. It is empty after a rollback (only one previous release is kept, so a second rollback in a row refuses), after a failed or interrupted deploy that applied a schema change (the kept release is only guaranteed to work one schema step back), and while nothing is live yet.
- `Refused: database could not be checked` (status 2): the applied schema changes could not be read to check the previous release. The live app and the previous-release slot are unchanged, so rollback works again once the check can run.
- `Refused: a deploy is running` / `Refused: a rollback is running` (status 3): wait for that run to end.
- `Rollback failed: oom_score_adj reset` (status 1): the live app's memory priority could not be reset; nothing else was done.
- `Rollback failed: start` (status 1): the previous release did not start or did not keep running until the switch.
- `Rollback failed: health check (no 200 within 60 s); <current sha7> still live` (status 1): the previous release never answered `/health`; it was stopped and got no member traffic.
- `Rollback failed: interrupted; <release id> is live` (status 1): the server-side run ended without recording an outcome before the switch; the named release is live.

After a failure the live release keeps serving and the previous-release slot still holds the rollback target. After a successful rollback, `npm run deploy` deploys the current `main` as usual, and the release then live becomes the previous release.

### Schema changes and rollback

Rollback relies on every schema change working with the code live in production when it is applied (FR-011), instead of reversing schema changes. A pull request that adds a file under `migrations/` states, in the "Schema changes" section of `.github/pull_request_template.md`, why it keeps working with that code (`ssh tracklite cat /srv/tracklite/current/REVISION`). Normally that is the previous release; after a rollback it is the release two back, and the statement says so. The reviewer checks the statement against that live code before approving.

## HTTPS

Caddy serves the app at `https://<domain>` only, with a Let's Encrypt certificate it obtains and renews on its own before it expires, with no manual step. Every `http://` request gets a `308` redirect to the same path and query over HTTPS.

Every HTTPS response carries `Strict-Transport-Security: max-age=31536000`: browsers use HTTPS only for this host for one year. It does not cover subdomains (no `includeSubDomains`) and has no `preload`. Never submit the domain to a browser preload list.

Check renewals on the server:

```sh
sudo journalctl -u caddy | grep -i renew
```

A failed renewal is logged there and Caddy retries; the current certificate keeps working until it expires.

When `ops/Caddyfile` changes, copy it to the server (from the owner's machine, `scp ops/Caddyfile <admin>@<vps address>:/tmp/`) and install it:

```sh
sudo install -m 0644 /tmp/Caddyfile /etc/caddy/Caddyfile
sudo -u caddy env TRACKLITE_DOMAIN=<domain> caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

A reload applies the new file without dropping connections. If `caddy validate` fails, fix the file before reloading; the running configuration keeps serving.

## Backups and restore

Every day at 03:00 UTC, `tracklite-backup.timer` starts `tracklite-backup.service`, which runs `ops/backup.sh` from the live release as `tracklite` with `/etc/tracklite/env` loaded. It takes a `pg_dump --format=custom` of the whole `tracklite` database (one consistent snapshot, even while a deploy applies schema changes) and uploads it to Cloudflare R2 as `tracklite-<yyyy-mm-ddTHH-MM-SSZ>.dump`, named by its UTC start time. Only after the upload succeeds does it list the bucket folder and delete every object beyond the 14 newest by name. The 14 kept are the 14 most recent objects in the folder, whichever run took them: backups started by hand for checks count too. A failed run deletes nothing, marks the unit failed and is logged in the journal; no email or other alert is sent. If the server is down at 03:00 UTC, that day has no backup (`Persistent=false`) and the stored ones are not touched. Backups hold the database only; releases and `/etc/tracklite/env` are rebuilt from the repository and the owner's own copy of the secrets.

### One-time setup

1. In the Cloudflare dashboard, under R2, create a bucket for the backups (for example `tracklite-backups`), private, with no public access.
2. Under R2, "Manage API tokens", create an API token with "Object Read & Write" permission applied to that bucket only. Keep its access key ID and secret access key in the owner's password manager; they are shown once. Note the account's S3 endpoint, `https://<account id>.r2.cloudflarestorage.com`.
3. Add the backup settings to `/etc/tracklite/env` with `sudoedit /etc/tracklite/env`, one `NAME=value` line each (values are never written here):
   - `BACKUP_REMOTE`: `backup:<bucket>/<folder>`, for example `backup:tracklite-backups/production`.
   - `RCLONE_CONFIG_BACKUP_TYPE`: `s3`.
   - `RCLONE_CONFIG_BACKUP_PROVIDER`: `Cloudflare`.
   - `RCLONE_CONFIG_BACKUP_ENDPOINT`: the endpoint from step 2.
   - `RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET`: `true` (needed with a token scoped to one bucket, which cannot check or create buckets).
   - `RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID`: the token's access key ID (secret).
   - `RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY`: the token's secret access key (secret).

   rclone reads the remote `backup` from these variables only; there is no rclone config file on the server.
4. Install rclone from its official source:

   ```sh
   curl -fsSL https://rclone.org/install.sh -o /tmp/rclone-install.sh
   sudo bash /tmp/rclone-install.sh
   ```

   Check: `rclone version` prints the version.
5. Copy the two units from the repository to the server (from the owner's machine):

   ```sh
   scp ops/tracklite-backup.service ops/tracklite-backup.timer <admin>@<vps address>:/tmp/
   ```

   On the server, install them and start the timer:

   ```sh
   sudo install -m 0644 /tmp/tracklite-backup.service /tmp/tracklite-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now tracklite-backup.timer
   ```

   Check: `systemctl list-timers tracklite-backup.timer` shows the next run at 03:00 UTC. The service runs `/srv/tracklite/current/ops/backup.sh`, so it needs a release deployed that contains `ops/backup.sh`.

### Running a backup by hand

There is no backup command. For checks only, start the scheduled job directly on the server:

```sh
sudo systemctl start tracklite-backup.service
```

It waits until the backup has finished. Each backup taken this way is stored like a scheduled one and counts toward the 14 kept, so the oldest is deleted once there are more than 14.

### Reading the backup log

```sh
sudo journalctl -u tracklite-backup
```

A successful run prints `Backup written: tracklite-<stamp>.dump`, then `Backup deleted: <name>` for each object removed beyond the 14 newest. A failed run prints one of `Backup failed: dump` (the database could not be dumped), `Backup failed: upload` (R2 could not be written, or `BACKUP_REMOTE` is missing) or `Backup failed: list` (the bucket could not be listed or an old object could not be deleted; the new backup was already written), and `systemctl status tracklite-backup.service` shows the unit as failed. The output never holds a setting value or rclone's or `pg_dump`'s own messages; to diagnose, run the failing step by hand. The next day's run tries again on its own.

### Listing backups without the server

The backups live in R2, so they stay reachable if the server or its disk is lost. On the owner's machine, install rclone and run `rclone config` once to create a remote named `backup` with the same settings as the server: type `s3`, provider `Cloudflare`, the endpoint, `no_check_bucket = true`, and the access key ID and secret access key typed at the prompts (they stay in the owner's own rclone config, never in the repository). Then:

```sh
rclone lsf backup:<bucket>/<folder>
```

Names sort in time order; the last one is the newest. The Cloudflare dashboard also lists the bucket's objects.

### Restoring

Restoring replaces the contents of the `tracklite` database with those of one backup. It is documented here and rehearsed in RM-14 (OPS-003.1).

1. On the owner's machine (remote `backup` set up as in "Listing backups without the server"), fetch the newest backup, or the one wanted:

   ```sh
   rclone copyto backup:<bucket>/<folder>/tracklite-<stamp>.dump ./tracklite-<stamp>.dump
   ```

   Copy it to the server: `scp ./tracklite-<stamp>.dump <admin>@<vps address>:/tmp/`, then on the server `sudo install -m 0600 -o tracklite -g tracklite /tmp/tracklite-<stamp>.dump /srv/tracklite/restore.dump`.
2. On the server, restore it into the `tracklite` database as `tracklite`, over the Unix socket (peer authentication):

   ```sh
   sudo -u tracklite pg_restore --clean --if-exists --no-owner -d tracklite /srv/tracklite/restore.dump
   ```

   On a new server, first complete "One-time server setup" up to step 3 (the `tracklite` role and an empty `tracklite` database), then restore, then deploy.
3. Remove the dump file from the server afterwards (`sudo rm /srv/tracklite/restore.dump /tmp/tracklite-<stamp>.dump`) and from the owner's machine; it holds the team's data.

## Uptime check

Better Stack Uptime, on its free tier, calls `https://<domain>/health` from outside the VPS every 5 minutes and emails the owner when two checks in a row fail. A single failed check followed by a pass sends no email. The monitor lives in Better Stack only; nothing in the repository or on the server configures it.

A check fails when `/health` answers anything other than `200` (for example `503` with the database stopped, or Caddy's `502` with the live instance stopped), does not answer, or answers after the 10 s time limit. A stop is seen by the next check (within 5 minutes) and confirmed by the one after it (5 minutes later), so the email arrives within about 10 minutes of the stop, and within 12 minutes at most. During a deploy or rollback the live release keeps answering `200` until the switch, and the new one answers `200` before it, so neither raises an alert.

### One-time setup

The free tier's terms (checked October 2026) allow a check interval of 3 minutes or more and email alerts; the confirmation period is set in seconds per monitor. If the free tier no longer offers the 5-minute interval or a 5-minute confirmation period, stop and choose another hosted monitor whose free tier does (for example UptimeRobot), or a paid tier only if the hosting total stays within the budget in "Cost".

1. The owner signs up for Better Stack Uptime with their own email address. That address, set in Better Stack only, receives the alerts; it is never written in the repository.
2. Create a monitor with these settings:

   | Setting | Value |
   |---------|-------|
   | Monitor type | URL availability (HTTP status) |
   | URL to monitor | `https://<domain>/health` |
   | On a new incident | Email (to the owner only) |
   | Check frequency | 5 minutes |
   | Request timeout | 10 seconds |
   | Confirmation period | 5 minutes (one check interval) |
   | Recovery period | default |

   With a 5-minute confirmation period, Better Stack starts an incident, and sends the email, only when the check after the first failure also fails: two failures in a row. Do not set it shorter, which would alert on one failure, or longer, which would push the email past 12 minutes.
3. Check: the monitor shows "Up" after its first check.

### Reading an alert

The alert email names the monitored URL and the time the incident started (the first confirmed failure). The monitor's page in Better Stack lists each check's status, answer code and time. When `/health` answers `200` again, Better Stack resolves the incident on its own.

To find the cause on the server: `sudo systemctl status postgresql`, `sudo journalctl -u 'tracklite@*' --since -30min`, `sudo journalctl -u caddy --since -30min`.

## Secrets and logs

### Secrets

Secrets live in two places only: `/etc/tracklite/env` on the server and the git-ignored `.env.local` on a developer's machine. `/etc/tracklite/env` is owned by `root:tracklite` with mode `0640` (step 5 of "One-time server setup"): `root` edits it, the `tracklite` account reads it, no other account can. It is never copied into a release, the repository or anywhere else; every release reads it when it starts, and a redeploy applies an edit ("Changing the server config file"). No secret, token, magic link, description or comment text is ever written to a log or to the output of a deploy, rollback or backup. Check:

```sh
sudo stat -c '%U:%G %a' /etc/tracklite/env   # root:tracklite 640
sudo -u nobody cat /etc/tracklite/env        # Permission denied
```

### Log retention (one-time setup)

All app, backup and Caddy output goes to the systemd journal. Keep 14 days of it: copy the journald drop-in from the repository to the server (from the owner's machine, `scp ops/journald-tracklite.conf <admin>@<vps address>:/tmp/`), then on the server install it and restart journald:

```sh
sudo install -d -m 0755 /etc/systemd/journald.conf.d
sudo install -m 0644 /tmp/journald-tracklite.conf /etc/systemd/journald.conf.d/tracklite.conf
sudo systemctl restart systemd-journald
```

The retention is server-wide: it applies to every log in the journal, including system and SSH logs, not only Tracklite's. journald keeps one file per day and deletes a whole day file once its newest entry is older than 14 days, so entries up to about 15 days old can remain. The drop-in sets no `SystemMaxUse`, so journald's default size cap stays; during the first 14 days, check with `sudo journalctl --disk-usage` that the cap is not deleting logs before they are 14 days old.

Ubuntu also writes plain log files outside the journal. Rotate them on the same 14-day rule: in `/etc/logrotate.d/rsyslog` (`/var/log/syslog`, `auth.log`, `kern.log`, `ufw.log` and the others it lists) and in `/etc/logrotate.d/postgresql-common` (`/var/log/postgresql/*.log`), set each block's rotation to

```text
daily
rotate 14
```

replacing its `weekly` and `rotate` lines. logrotate already runs daily from `logrotate.timer`. Check the configuration with `sudo logrotate -d /etc/logrotate.conf` (a dry run: it reports what it would do and changes nothing).

PostgreSQL's server log keeps no row data or statements: `log_error_verbosity = terse` and `log_min_error_statement = panic`, set in step 3 of "One-time server setup". Recheck them after any PostgreSQL upgrade:

```sh
sudo -u postgres psql -c 'SHOW log_error_verbosity' -c 'SHOW log_min_error_statement'   # terse, panic
```

### Reading logs

```sh
sudo journalctl -u 'tracklite@*'        # the app's request log, both instances
sudo journalctl -u tracklite-backup     # backups
sudo journalctl -u caddy                # Caddy
```

Add `--since -30min` (or another time) to narrow the output. Both app instances log to the same journal, so the request log continues without a gap across a deploy or rollback. Caddy keeps no access log; its error lines are filtered to the method, the path without its query string, the status and the error.

Run records and run logs in `/srv/tracklite/runs/` ("Run records") are files outside the journal and outside the 14-day log rule above: each deploy or rollback deletes those older than 14 days when it starts, always keeping the newest record. They hold no secrets.

## Cost

The monthly cost of hosting must stay under $20, with what is left kept for the email provider (NFR-009, DEC-003). The prices below are assumptions, not checked prices: confirm each one on the provider's price page before opening the account, then with the first monthly bills, and replace any that differ.

| Item | Assumption | Per month |
|------|------------|-----------|
| VPS | Hostinger's smallest plan with 2 vCPU (at least 2 GB RAM, at least 40 GB disk): introductory price about $7, renewal price up to about $13 | about $7 to $13 |
| Domain | the team's existing domain; about $10 to $15 per year if charged to this budget | $0 to about $1 |
| Off-server backups | Cloudflare R2: 14 small dumps stay under the free 10 GB-month of storage, operations stay under the free allowance, and R2 charges no egress fee | $0 |
| Uptime check | Better Stack Uptime free tier | $0 |
| TLS certificate | Let's Encrypt, through Caddy | $0 |
| **Hosting total** | | **about $7 to $14** |

Hosting is under $20, about $6 left for email: at the VPS renewal price hosting costs about $14 per month, leaving about $6 under $20 for the email provider (about $12 while the introductory VPS price lasts). Plan with the renewal figure. The full NFR-009 total, including email, is checked when the email provider is chosen (RM-3); if that provider does not fit the headroom, stop and ask before going ahead (DEC-003).
