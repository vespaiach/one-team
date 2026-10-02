# Feature Specification: Production Environment

**Feature Branch**: `colau/speckit-sdd-orchestrator-b79f9d`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "**Input**: Parent roadmap: `ROADMAP.md` → entry **RM-2**. Production environment — one command deploys the app to the VPS over HTTPS, with rollback, daily backups and uptime alerts. Scope and deferrals are exactly as listed in ROADMAP.md's RM-2 row (In: OPS-002, OPS-003 backups and rotation, OPS-004, OPS-005 external uptime check, OPS-006 server config file and log rotation, SEC-005, hosting within NFR-009. Deferred: restore rehearsal OPS-003.1 → RM-14). Product behavior source: docs/tracklite-spec.md."

**Parent**: `ROADMAP.md` → RM-2 (Production environment). Behavior source: `docs/tracklite-spec.md` (OPS-002, OPS-003, OPS-003.2, OPS-004, OPS-004.1, OPS-005, OPS-005.1, OPS-006, OPS-006.1, SEC-005, SEC-005.1, SEC-007, NFR-009, sections 3 and 12). Builds on RM-1 (`specs/001-project-foundation`): `/health`, the configuration file, the ordered schema changes and the one-JSON-line-per-request logs.

**Scope boundary**: **In:** one-command deploy from `main` with migrations first (OPS-002); daily off-server backups at 03:00 UTC keeping 14 (OPS-003, OPS-003.2); the previous release kept and a one-command rollback (OPS-004); an external uptime check of `/health` every 5 minutes that emails the owner after two failures in a row (OPS-005); secrets in a config file on the server and logs rotated and kept 14 days (OPS-006); HTTPS everywhere with HTTP redirected and browsers told to use HTTPS only (SEC-005); all of it within the NFR-009 budget. **Deferred:** the restore rehearsal (OPS-003.1) → RM-14.

## Clarifications

### Session 2026-10-01

- Q: Must the new version pass `/health` with `200` before it receives any member traffic (FR-004, FR-005, SC-010)? → A: *(Superseded by the atomic-deployment change request below.)* No: stop the old version, start the new one, check `/health`, and switch back to the previous release automatically if it fails. Members may see a short gap or errors during a deploy or a bad release; no side-by-side run is required.
- Q: What HTTPS-only policy should browsers be given (FR-014, SEC-005)? → A: One year, this host only (not extended to subdomains), and the domain is not submitted to browsers' built-in preload list.
- Q: After rolling back from release B to release A, what does a second rollback do (FR-008 to FR-010)? → A: It refuses: only one previous-release slot is kept, so there is nothing older to roll back to.
- Q: Should the server that handles HTTPS in front of the app keep its own access logs (FR-025, FR-026, SEC-007)? → A: No: it logs errors only; the app's existing JSON request logs (RM-1) are the request log.
- Q: Is an on-demand backup command in scope (FR-016, FR-017, User Story 4)? → A: No: backups run only from the daily schedule; tests run the scheduled job directly.
- Q: If the connection to the server drops after the old version is stopped but before the new one is started, may the app be left with no version answering until the owner re-runs the command, or must the server finish (or undo) the switch on its own? → A: *(Superseded by the atomic-deployment change request below.)* The app may be left with no version answering until the owner re-runs the deploy command. Re-running the command must then finish or repeat the deploy safely, and the app must never serve a mix of two releases.
- Q: How should deploy cutover work? → A: Atomic deployment (symlink-based, zero-downtime), by the user's change request "I want to apply Atomic Deployment method (Symlink Deployment, Zero-Downtime Deployment)". Each release is prepared completely in its own place; the new version is started and must answer `/health` with `200` before it receives any member traffic; the cutover is a single atomic switch, so members never see a gap, errors from a half-switched state, or a mix of two releases. A new version that fails `/health` never receives traffic and the old version keeps serving untouched. Rollback is the same atomic switch back to the kept previous release. A dropped connection leaves exactly one complete release live (old or new), never none and never a mix. (Supersedes the two answers above: the deploy-cutover answer and the dropped-connection answer.)
- Q: With release B live and release A in the previous-release slot, a deploy of release C applies its schema changes and then fails `/health`; what does the previous-release slot hold afterwards (FR-008, FR-011, Release)? → A: The slot keeps A only if the failed deploy applied no schema change; if it applied any, the slot is emptied and rollback refuses with "nothing to roll back to". FR-011 stays "works with the previous release's code" (one step back).
- Q: What happens on the server if the owner's connection drops in the middle of a deploy (FR-005, FR-006, Edge Cases)? → A: *(Extended to rollback, and the refusal message replaced, by the last answer below.)* The server-side run continues to the end. The one-at-a-time lock is held only while that run is alive and is freed automatically when it ends or dies (never stuck). A re-run while the run is still going refuses with "another deploy is running".
- Q: How long do deploy and rollback wait for the new version's `/health` to answer `200` before declaring it failed (FR-004, FR-009, SC-003)? → A: Up to 60 seconds, polling every 2 seconds.
- Q: What does the deploy command do when the shared `main` can't be reached to compare against the local checkout (FR-002)? → A: It refuses before touching the server and says the shared `main` couldn't be checked.
- Q: When and how is it verified that a schema change keeps working with the previous release's code (FR-011, OPS-004)? → A: In pull-request review: each migration's pull request states why it is compatible with the previous release's code.
- Q: If the owner's connection drops and the server-side run continues to the end, how does the owner learn that run's outcome, does continue-to-the-end also apply to rollback, and what does a command get while the other holds the lock? → A: Both deploy and rollback continue to the end on the server after a dropped connection and record their outcome. When the owner next runs either command, it first prints the outcome of the last run that wasn't reported because the connection dropped, then carries on as normal. While a deploy or rollback holds the shared lock, either command refuses with a message naming which one is running (e.g. "a deploy is running" / "a rollback is running").
- Q: If a deploy or rollback run dies before it ends (e.g. the server restarts mid-run), what outcome is recorded and printed to the owner on their next command? → A: The next command (deploy or rollback) reports the last run as "interrupted" (it never recorded an end) and names which release is live now, then carries on as normal. Because the switch is atomic, exactly one complete release is live at that point. The lock from the dead run is already freed (it is tied to the run being alive).
- Q: If an interrupted deploy had already applied schema changes before it died, what does the previous-release slot hold afterwards? → A: An interrupted deploy that never switched follows the same rule as a failed deploy: if it applied any schema change, the slot is emptied and rollback refuses with "nothing to roll back to"; if it applied none, the slot is unchanged.
- Q: If a deploy dies after the atomic switch completed (new release live, but no end recorded), what does the previous-release slot hold afterwards? → A: The switch is the commit point: the slot is set as after a successful deploy — it holds the release that was live before the deploy, and rollback works normally. The run is still reported as "interrupted" on the next command, naming the new live release.
- Q: What does the previous-release slot hold after a rollback that fails its `/health` check or is interrupted (before or after its atomic switch)? → A: The switch is the commit point, mirroring deploy. A rollback that fails `/health`, or dies before its switch, changes nothing: the current release keeps serving and the slot still holds the rollback target. A rollback that dies after its switch counts as a successful rollback: the target is live, the slot is empty, and a second rollback refuses. Either way the next command reports an interrupted run as "interrupted", naming the live release.
- Q: After a rollback from B to A, a deploy of C applies schema changes while A serves; which code must C's schema changes keep working with (FR-011)? → A: The FR-011 review checks each schema change against the code actually live in production. After a rollback that is two releases back, and the migration's pull request says so.
- Q: What happens when the server runs short of memory during a deploy (Edge Cases)? → A: Under memory pressure the deploy's own work (install, build, the new instance) MUST be the first to be killed; the live instance and PostgreSQL are protected; the deploy then fails before switching.
- Q: Does "no mix of old and new code" apply only per request, or also to a page that stays open across a switch (FR-005, SC-010)? → A: "No mix of old and new code" applies per page view, not only per request: a page keeps loading its own release's static files. The static files of the last 5 releases are kept, so a page left open across up to 5 later deploys/rollbacks still works.
- Q: What is the outcome when something goes wrong after the atomic switch (FR-005, FR-007)? → A: A problem after the commit point (old instance doesn't stop within its limit and is killed, leftovers, run record can't be written) does not change the outcome: the run is "succeeded", exit 0, with a warning line naming the problem; the next run's cleanup removes leftovers. If the run record can't be written, the next command reports the run as "interrupted", naming the new live release.
- Q: What does "first" mean when a command prints the last run's unreported outcome (FR-007)? → A: "First" means the first thing printed once the command reaches the server. Local refusals (e.g. shared `main` unreachable) and an upload failure don't print it; the missed outcome stays unreported until a command reaches the server.
- Q: What does deploying the commit that's already live do (Edge Cases, FR-008)? → A: Redeploying the commit that's already live is a full deploy (fresh build and restart, e.g. after editing the server config file), but the previous-release slot keeps what it held.
- Q: How long may requests in progress on the old version run after the switch (FR-005, SC-003)? → A: Requests in progress on the old version complete normally if they finish within 30 seconds of the switch; longer ones may be cut.
- Q: What must RM-2 prove about cost when the email provider is only chosen in RM-3 (FR-028, SC-009)? → A: RM-2 proves that hosting costs under $20 per month now, and records in `docs/production.md` "Cost" the headroom left for email (about $6 at the VPS renewal price). The full NFR-009 total including email is checked in RM-3 when it picks the email provider (DEC-003 already says to stop and ask).
- Q: What may the HTTPS front server's error log lines contain (FR-025, FR-026, SEC-007)? → A: Method, path without the query string, status and error only; a log filter in the front server's config removes the query string and all headers.
- Q: What exactly must the uptime-alert trial show (FR-021, SC-006)? → A: The alert email arrives within 12 minutes of the stop in 3 out of 3 trials; the 5-minute interval and the alert on the second failure in a row stay.
- Q: Do the deploy and rollback run records and run logs fall under the 14-day log rule (FR-025, SC-008)? → A: No: they are outside it. They are pruned to 14 days at the next run, the newest record is always kept, and they hold no secrets (FR-026).
- Q: Does the 14-day log retention apply only to the app's logs, and is a size limit set (FR-025, SC-008)? → A: The 14-day retention is server-wide and applies to all server logs, including system and SSH logs, with the default size cap (no separate size limit); `docs/production.md` has the owner check the logs' disk usage during the SC-008 period.
- Q: Which backups count toward the 14 kept, and when does the SC-005 observation start (FR-016, FR-017, SC-005)? → A: Every backup in the off-server storage counts toward the 14 kept, including ones from running the scheduled job by hand in trials ("the 14 most recent backups", not "daily"). SC-005's 15-day observation period starts after the last hand-run trial.
- Q: journald deletes a whole day's archived file only once its newest entry passes 14 days, so entries up to ~15 days old can remain. What does SC-008 require (FR-025, SC-008)? → A: No log in the journal is older than 15 days, and every day of the last 14 days is present. The retention policy stays 14 days; the extra day is journald's whole-file granularity.
- Q: When the scripts can't read `schema_migrations` (psql fails although `current` exists and the table should exist) to check whether the rollback slot is safe, what happens (FR-008, FR-009, FR-011)? → A: Rollback refuses with exit 2 and a message saying the database couldn't be checked ("Refused: database could not be checked"), and the previous-release slot is left unchanged, so rollback works again once the check can run. The check is skipped only when `current` is absent or `schema_migrations` doesn't exist.
- Q: When a deploy's start-of-run S2 check can't read `schema_migrations` (psql fails although `current` exists and the table should exist), does the deploy refuse or carry on (FR-003, FR-008, FR-009)? → A: The deploy carries on and leaves the previous-release slot unchanged; rollback's own S2 check guards the slot later (refusing with `Refused: database could not be checked` if it still can't read the table). The deploy's own migration step needs the database anyway and fails cleanly if it's truly down.

## User Scenarios & Testing *(mandatory)*

The people served by this slice are the owner, who deploys, rolls back and gets alerts, and the team members, who reach the app over HTTPS at the team's domain. This slice adds no product screen; its value is that every later slice ships through a real, safe deploy and the team's data is protected from the first day it exists.

### User Story 1 - Deploy the latest `main` with one command (Priority: P1)

The owner runs one deploy command on their machine. It takes the current `main`, prepares the new release completely in its own place on the server, applies any pending schema changes to the production database, and only if they all succeed starts the new version alongside the old one. Only when the new version answers `/health` with `200` does the command switch member traffic to it, in one atomic step; if it fails its `/health` check, it never receives traffic and the old version keeps serving untouched. Members see no downtime. The owner sees whether the deploy succeeded and, if not, why.

**Why this priority**: Nothing reaches the team until it can be deployed, and every later slice ships through this command (ROADMAP "Working through it", step 1).

**Independent Test**: From a checkout of `main`, run the deploy command against the production server; the new version answers at the team's domain, and a deliberately failing schema change leaves the previous version serving unchanged.

**Acceptance Scenarios**:

1. **Given** a new commit on `main` whose schema changes succeed, **When** the owner runs the deploy command, **Then** the schema changes are applied, the new version serves traffic, and no manual step is needed (OPS-002.1).
2. **Given** a new commit on `main` with a schema change that fails, **When** the owner runs the deploy command, **Then** the old version keeps serving traffic unchanged and the command exits with a failure that names the failing change (OPS-002.2).
3. **Given** the owner's checkout is not on `main`, has uncommitted changes, or differs from the shared `main`, or the shared `main` can't be reached, **When** the owner runs the deploy command, **Then** it refuses before touching the server and says why (for an unreachable shared `main`: that the shared `main` couldn't be checked).
4. **Given** the new release is prepared and its schema changes applied, **When** the new version fails to answer `/health` with `200` within 60 seconds of start-up (polled every 2 seconds), **Then** it never receives member traffic, the old version keeps serving untouched, and the command exits with a failure that says so.
5. **Given** a deploy in progress, **When** members are using the app, **Then** every request is answered by the old version until the atomic switch and by the new version after it; no request goes unanswered or gets an error caused by the switch, no page view mixes old and new code (a page keeps loading its own release's static files, for up to 5 later deploys or rollbacks), and requests already in progress on the old version at the moment of the switch complete normally if they finish within 30 seconds of it.

---

### User Story 2 - Roll back to the previous release (Priority: P1)

After a deploy that turns out to cause errors, the owner runs one rollback command, and within 2 minutes the previous release is serving traffic again, without restoring the database and without downtime: the previous release is started and must answer `/health` with `200` within 60 seconds before the same atomic switch moves traffic back to it.

**Why this priority**: A deploy with no fast way back makes every release risky; OPS-004 pairs the two.

**Independent Test**: Deploy release B on top of release A, run the rollback command, and confirm release A is serving within 2 minutes with the database untouched.

**Acceptance Scenarios**:

1. **Given** release B was deployed on top of release A and causes errors, **When** the owner runs the rollback command, **Then** release A serves traffic within 2 minutes through one atomic switch, members see no gap or switch-caused errors, and no database restore is needed (OPS-004.1).
2. **Given** release B's schema changes were applied, **When** release A runs again after rollback, **Then** release A works against the changed schema, because every schema change keeps working with the previous release's code (OPS-004).
3. **Given** there is no previous release on the server (the first deploy, right after a rollback, including one interrupted after its atomic switch, or after a failed deploy, or a deploy interrupted before the atomic switch, that applied any schema change), **When** the owner runs the rollback command, **Then** it refuses with a message saying there is nothing to roll back to, and the live app is unchanged.
4. **Given** a rollback has just been done, **When** the owner runs the deploy command again later, **Then** it deploys the then-current `main` normally.
5. **Given** release B is live and release A is in the previous-release slot, **When** a rollback fails A's `/health` check, or dies before its atomic switch, **Then** B keeps serving untouched and the slot still holds A, so the rollback can be run again; a rollback that died is reported as "interrupted" by the next command, naming B as live.
6. **Given** release B is live and release A is in the previous-release slot, **When** a rollback dies after its atomic switch completed, **Then** it counts as a successful rollback: A is live, the slot is empty, a second rollback refuses with "nothing to roll back to", and the next command reports the run as "interrupted", naming A as live.
7. **Given** the owner's connection drops during a rollback, **When** the rollback's server-side run continues to the end and the owner later runs the deploy or rollback command, **Then** that command first prints the rollback's recorded outcome, then carries on as normal.
8. **Given** release B is live and release A is in the previous-release slot, **When** the owner runs the rollback command and the database's applied schema changes can't be read to check that A is safe, **Then** it refuses with a message saying the database couldn't be checked (exit 2), B keeps serving untouched and the slot still holds A, so the rollback works again once the check can run.

---

### User Story 3 - Members reach the app only over HTTPS (Priority: P1)

A member opens the team's Tracklite address. Whether they type `http://` or `https://`, they end up on the HTTPS page, and their browser is told to use HTTPS only from then on.

**Why this priority**: Sign-in (RM-3) relies on cookies sent only over HTTPS (SEC-004); the app cannot be used by the team until HTTPS is in place.

**Independent Test**: Request any page over plain HTTP and check the redirect to the same path over HTTPS; request a page over HTTPS and check the browser is told to use HTTPS only and that the certificate is valid.

**Acceptance Scenarios**:

1. **Given** a member opens `http://…/my-issues`, **When** the request arrives, **Then** they are redirected to `https://…/my-issues`, keeping the path and query (SEC-005.1).
2. **Given** any HTTPS response, **When** a browser receives it, **Then** it is told to use HTTPS only for this host for one year, not extended to subdomains (SEC-005).
3. **Given** the certificate approaches its expiry date, **When** time passes, **Then** it is renewed without any manual step, and members never see a certificate warning.

---

### User Story 4 - Daily off-server backups (Priority: P2)

Every day at 03:00 UTC the production database is backed up to storage off the VPS. The 14 most recent backups are kept, whichever run took them; when the 15th is taken, the oldest is deleted.

**Why this priority**: One VPS holds everything (section 3), so off-server backups are the only protection for the team's data; it must be in place before real data exists (RM-3 onward).

**Independent Test**: Run the scheduled backup job directly (there is no on-demand backup command), confirm a backup appears in the off-server storage with its UTC date; with 14 backups already stored, take one more and confirm the oldest is gone and 14 remain.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** 03:00 UTC arrives, **Then** a full backup of the production database is written to storage off the VPS, named so its UTC date and time are clear.
2. **Given** 14 backups are stored, **When** the 15th is taken, **Then** the oldest is deleted and 14 remain (OPS-003.2).
3. **Given** a backup fails (the database or the off-server storage can't be reached), **When** the failure happens, **Then** no existing backup is deleted, and the failure is logged; no email or other alert is sent to the owner in this slice.
4. **Given** a backup has been written, **When** the owner looks at it, **Then** it holds no secret from the server config file other than what the database itself contains.

---

### User Story 5 - Uptime alerts to the owner (Priority: P2)

An external service checks `/health` every 5 minutes. When it fails twice in a row, the owner gets an email, and so knows the app or its database is down without anyone having to report it.

**Why this priority**: There is no uptime target (section 11), but the owner must learn about an outage quickly; with no redundancy, a quick manual fix is the only recovery.

**Independent Test**: Stop the production database (or the app) and confirm the owner is emailed within 12 minutes of the stop; start it again and confirm checks pass.

**Acceptance Scenarios**:

1. **Given** the database stops, **When** the external check calls `/health` twice in a row and gets `503` both times, **Then** the owner is emailed within 12 minutes of the database stopping (OPS-005.1's "about 10 minutes", measured as in SC-006).
2. **Given** the whole VPS or the app is unreachable, **When** the external check gets no answer twice in a row, **Then** the owner is emailed the same way.
3. **Given** a single failed check followed by a passing one, **When** the checks run, **Then** no email is sent.
4. **Given** the check runs from outside the VPS, **When** the VPS itself is down, **Then** the alert still goes out (the check doesn't depend on the server it watches).

---

### User Story 6 - Secrets and logs kept in order on the server (Priority: P3)

The owner keeps production secrets (such as the database password and, from RM-3, the email API key) in one config file on the server, never in the repository. The app's logs are rotated and kept for 14 days, so they neither fill the disk nor are lost too soon.

**Why this priority**: The config-file mechanism and the logs already exist from RM-1; this story adds the production file and rotation, which matter once the app runs for weeks.

**Independent Test**: Search the repository for the production secret values; inspect the server's log storage after rotation and confirm no log is older than 15 days and every day of the last 14 days is present.

**Acceptance Scenarios**:

1. **Given** the production config file on the server, **When** the repository is searched for its secret values (for example the email API key), **Then** there is no match (OPS-006.1).
2. **Given** the production config file, **When** a user other than the owner's admin account and the app's own account on the server tries to read it, **Then** they can't.
3. **Given** the app has been logging for more than 14 days, **When** logs are rotated, **Then** logs from the last 14 days are kept and none older than 15 days remain (OPS-006; the extra day is journald's whole-file granularity), for every server log; the deploy and rollback run records and run logs are outside this and are pruned to 14 days at the next run, always keeping the newest record (FR-025).
4. **Given** a deploy or rollback, **When** the new release starts, **Then** it reads the same server config file and the rotated logs continue without a gap; neither command copies secrets into the repository or into the release itself.
5. **Given** the deploy and rollback commands and the scheduled backup job write their own output, **When** they run, **Then** that output never contains a secret value (SEC-007).

---

### Edge Cases

- Two deploys, two rollbacks, or a deploy and a rollback, are started at the same time: the second refuses with a message naming which one is running ("a deploy is running" / "a rollback is running"), and the live app is unchanged by it.
- The connection to the server drops in the middle of a deploy or rollback: exactly one complete release is live at every moment — the old one if the drop happens before the atomic switch, the new one if after — never none and never a mix. The server-side run (deploy or rollback) continues to the end despite the drop and records its outcome; either command run while it is still going refuses with a message naming which one is running. The next deploy or rollback command the owner runs afterwards first prints that unreported outcome, then carries on as normal.
- A deploy or rollback run on the server ends or dies (for example the server restarts mid-run): the one-at-a-time lock is freed automatically, never left stuck. A run that dies never records an end; the next deploy or rollback command reports it as "interrupted" and names the release live now by its release id (commit and deploy time; exactly one complete release is live, because the switch is atomic), then carries on as normal. If an interrupted deploy died before the atomic switch, the previous-release slot follows the failed-deploy rule (FR-008): emptied if it applied any schema change, unchanged if it applied none. If an interrupted deploy died after the atomic switch completed, the switch is the commit point: the previous-release slot is set as after a successful deploy (it holds the release that was live before that deploy) and rollback works normally; the run is still reported as "interrupted", naming the new live release. Rollback follows the same commit point: a rollback that died before its atomic switch changed nothing (the current release keeps serving and the slot still holds the rollback target); one that died after it counts as a successful rollback (the target is live, the slot is empty, and a second rollback refuses). Either is reported as "interrupted", naming the live release. A partly prepared or started new version that never received traffic is left harmless and is cleaned up or replaced when the owner re-runs the command, which then deploys safely.
- A deploy of release C (B live, A in the previous-release slot) applies schema changes and then fails, or dies before the atomic switch (interrupted): B keeps serving, and the previous-release slot is emptied because A is not guaranteed to work with C's schema changes; a later rollback refuses with "nothing to roll back to". If the failed or interrupted deploy applied no schema change, the slot keeps A.
- The server runs out of disk space during a deploy: the deploy fails before switching, and the old version keeps serving untouched.
- The server runs short of memory during a deploy (for example starting the new version alongside the old one): the deploy's own work (install, build, the new version) MUST be the first to be killed; the live version and the database (PostgreSQL) are protected. The deploy then fails before switching, and the old version keeps serving untouched.
- A deploy of the commit that's already live (for example after editing the server config file): it is a full deploy (fresh build and restart through the same atomic switch), but the previous-release slot keeps what it held.
- Something goes wrong after the atomic switch (the old version doesn't stop within its time limit and is killed, leftovers remain, or the run record can't be written): the outcome is unchanged — the run succeeded, exits 0 and prints a warning line naming the problem; the next run's cleanup removes leftovers (FR-007).
- Rolling back twice in a row: the second rollback refuses, because only one previous release is kept and there is nothing older to roll back to; the live app is unchanged. This holds also when the first rollback was interrupted after its atomic switch.
- The database's applied schema changes can't be read when a rollback checks whether the previous-release slot is safe (a release is live and the schema-change table exists): the rollback refuses with a message saying the database couldn't be checked, the live app is unchanged, and the slot is left as it was, so a later rollback works once the check can run. The check is skipped only when nothing is live yet or the schema-change table doesn't exist.
- A rollback whose target fails its `/health` check: the current release keeps serving untouched, the previous-release slot still holds the rollback target, and the command reports the failure.
- The backup time (03:00 UTC) arrives while a deploy is applying schema changes: the backup is still a consistent copy of the database at one moment.
- The VPS is down at 03:00 UTC: no backup is taken that day, and the existing 14 are not touched.
- The uptime check's own service has an outage: the app is unaffected; the owner simply gets no alert during that time (accepted, single-owner setup).
- `/health` answers slowly but within the check's time limit: it counts as passing; past the limit, it counts as a failure.
- The certificate can't be renewed (for example, the domain no longer points to the server): the current certificate keeps working until expiry and the failure is logged.
- A member's browser already holds the HTTPS-only instruction and the certificate later becomes invalid: the browser refuses the page rather than falling back to HTTP (expected HTTPS-only behavior).

## Requirements *(mandatory)*

### Functional Requirements

**Deploy (OPS-002)**

- **FR-001**: The project MUST provide one deploy command, run from a checkout of `main` on the owner's machine, that deploys that commit to the production server with no other manual step (OPS-002.1).
- **FR-002**: The deploy command MUST refuse, before changing anything on the server, when the checkout isn't on `main`, has uncommitted changes, or differs from the shared `main`, and say why. If the shared `main` can't be reached, it MUST likewise refuse before touching the server and say that the shared `main` couldn't be checked.
- **FR-003**: The deploy command MUST apply pending schema changes to the production database before switching versions, and switch to the new version only if they all succeed; on a failure, the old version MUST keep serving unchanged and the command MUST exit with a failure naming the failing change (OPS-002.2).
- **FR-004**: Each release MUST be prepared completely in its own place on the server, separate from the live release, before any switch. After applying schema changes, the deploy command MUST start the new version while the old one keeps serving, and MUST switch member traffic to it only after it answers `/health` with `200`, waiting up to 60 seconds and polling every 2 seconds. If it doesn't within that time, the new version MUST never receive member traffic, the old version MUST keep serving untouched, and the command MUST report the failure.
- **FR-005**: The cutover from old to new version MUST be a single atomic switch with zero member-visible downtime: at every moment exactly one complete release is live, no request goes unanswered or gets an error caused by the switch, and no mix of old and new code is used — per page view, not only per request: a page keeps loading its own release's static files. The static files of the last 5 releases MUST be kept, so a page left open across up to 5 later deploys or rollbacks still works. Requests in progress on the old version when the switch happens MUST complete normally if they finish within 30 seconds of the switch; longer ones may be cut. "Live" means the release the atomic switch (`current`) names; it is the only release that receives member traffic. A server restart is not a switch: nothing answers until boot starts the live release again, and that gap is not counted under FR-005 or SC-010. The atomic switch is the commit point: a problem after it does not change the run's outcome (FR-007). If the connection to the server drops at any point, exactly one complete release (old or new) MUST remain live, never none and never a mix. A deploy's or rollback's server-side run MUST continue to the end when the owner's connection drops and MUST record its outcome; once it has ended or died, re-running the command MUST deploy safely.
- **FR-006**: Only one deploy or rollback MAY run at a time; while either holds the shared lock, a deploy or rollback command MUST refuse with a message naming which one is running ("a deploy is running" / "a rollback is running"). The one-at-a-time lock MUST be held only while the run holding it is alive and MUST be freed automatically when that run ends or dies, so it can never be left stuck. A refused command MUST NOT change anything the running deploy or rollback uses.
- **FR-007**: The deploy and rollback commands MUST each report success with the commit now live (deploy: the deployed commit; rollback: the commit rolled back to), or failure or refusal with the reason, and exit with a matching status: 0 succeeded, 1 failed before the switch, 2 refused by a check, 3 refused because a run is in progress, 4 connection lost. A problem after the atomic switch (the old version doesn't stop within its time limit and is killed, leftovers remain, or the run record can't be written) MUST NOT change the outcome: the run is "succeeded", exits 0, and prints a warning line naming the problem; the next run's cleanup removes leftovers. If the run record can't be written, the next command reports that run as "interrupted", naming the new live release. When the owner runs the deploy or rollback command and the last run's outcome was not reported because the connection dropped (FR-005), the command MUST first print that outcome, then carry on as normal; "first" means the first thing printed once the command reaches the server. Refusals made locally before reaching the server (for example the shared `main` can't be reached, FR-002) and a failure to upload the release don't print it; the missed outcome stays unreported until a command reaches the server. When the last deploy or rollback run died before it ended (for example the server restarted mid-run) and so never recorded an end, the next deploy or rollback command MUST report that run as "interrupted" and name the release live now by its release id (commit and deploy time), then carry on as normal.

**Rollback and releases (OPS-004)**

- **FR-008**: The server MUST keep the previous release alongside the live one after every successful deploy (OPS-004). A deploy of the commit that's already live is a full deploy (fresh build and restart through the atomic switch), but MUST leave the previous-release slot holding what it held. After a failed deploy, or a deploy interrupted before the atomic switch (FR-007), the previous-release slot MUST stay as it was if that deploy applied no schema change, and MUST be emptied if it applied any (the kept release is only guaranteed to work one schema step back, FR-011). The atomic switch is a deploy's commit point: a deploy interrupted after the switch completed MUST leave the slot as after a successful deploy, holding the release that was live before that deploy, and it is still reported as "interrupted" (FR-007). The same commit point applies to rollback: a rollback that fails its `/health` check, or is interrupted before its atomic switch, MUST leave the live release and the previous-release slot unchanged (the slot still holds the rollback target); a rollback interrupted after its switch completed MUST leave the slot as after a successful rollback (empty), and it is still reported as "interrupted" (FR-007). When the database's applied schema changes can't be read to check whether the slot is safe (while a release is live and the schema-change table exists), the slot MUST be left unchanged, so it is checked again by the next command.
- **FR-009**: The project MUST provide one rollback command that switches the live app back to the previous release within 2 minutes, without any database restore (OPS-004.1). Rollback MUST use the same atomic, zero-downtime switch as a deploy: the previous release is started and must answer `/health` with `200` before it receives traffic, with the same wait of up to 60 seconds polled every 2 seconds; if it doesn't, the current release keeps serving untouched, the previous-release slot still holds the rollback target, and the command reports the failure. When the previous-release slot holds a release but the database's applied schema changes can't be read to check that it is safe (FR-008, FR-011), rollback MUST refuse with exit 2 and a message saying the database couldn't be checked, leaving the live app and the slot unchanged, so rollback works again once the check can run.
- **FR-010**: The rollback command MUST refuse, leaving the live app unchanged, when there is no previous release, with a message saying there is nothing to roll back to. Only one previous-release slot is kept, so a second rollback in a row (after rolling back from B to A) MUST refuse: there is nothing older to roll back to. This includes a rollback interrupted after its atomic switch completed, which counts as a successful rollback (FR-008). The same refusal applies after a failed deploy, or a deploy interrupted before the atomic switch, that applied any schema change (FR-008).
- **FR-011**: Every schema change MUST keep working with the previous release's code (OPS-004), as already required of every slice (RM-1, AGENTS.md); the deploy and rollback workflow MUST rely on this rather than reversing schema changes. "The previous release's code" means the code actually live in production when the change is applied; after a rollback, that is the release two back. This is verified in pull-request review: each pull request that adds a schema change MUST state why it is compatible with the code live in production, and, after a rollback, say that this is the release two back. Rollback MUST NOT switch to the previous release unless the database's applied schema changes were read and checked against the live release's (FR-009).

**HTTPS (SEC-005)**

- **FR-012**: The app MUST be served over HTTPS only, at the team's domain, with a certificate that browsers trust.
- **FR-013**: Every plain HTTP request MUST be redirected to the same path and query over HTTPS (SEC-005.1).
- **FR-014**: Every HTTPS response MUST tell browsers to use HTTPS only for this host for one year (SEC-005). The instruction MUST NOT extend to subdomains, and the domain MUST NOT be submitted to browsers' built-in HTTPS-only (preload) list.
- **FR-015**: The certificate MUST be renewed automatically before it expires, with no manual step.

**Backups (OPS-003)**

- **FR-016**: The production database MUST be backed up daily at 03:00 UTC to storage off the VPS (OPS-003). Each backup MUST be a consistent copy of the whole database at one moment, named with its UTC date and time. Backups run only from this daily schedule; no on-demand backup command is provided in this slice.
- **FR-017**: Exactly the 14 most recent backups MUST be kept; taking the 15th MUST delete the oldest (OPS-003.2). Every backup in the off-server storage counts toward the 14, including ones taken by running the scheduled job by hand in trials. Deleting MUST happen only after the new backup has been fully written.
- **FR-018**: A failed backup MUST NOT delete any existing backup, and MUST be logged. No email or other alert to the owner is added for a failed backup in this slice.
- **FR-019**: The backup storage MUST be reachable for a restore without the VPS (so a lost VPS disk doesn't lose the backups); rehearsing a restore is deferred to RM-14 (OPS-003.1).

**Uptime check (OPS-005)**

- **FR-020**: An external uptime check, running outside the VPS, MUST call `/health` over HTTPS every 5 minutes (OPS-005).
- **FR-021**: The owner MUST be emailed when the check fails twice in a row, so that a database stop leads to an email within about 10 minutes (OPS-005.1), measured as within 12 minutes of the stop (SC-006); the check interval stays 5 minutes and the alert stays on the second failure in a row. A non-`200` answer, no answer, or an answer past the check's time limit counts as a failure.
- **FR-022**: A single failure followed by a pass MUST NOT send an email.

**Server config and logs (OPS-006)**

- **FR-023**: Production secrets and settings MUST live in one config file on the server, read by the app at start-up through the same mechanism as RM-1, readable only by the app and the server's admin account, and never in the repository (OPS-006, OPS-006.1).
- **FR-024**: Each release MUST read the same server config file, so deploy and rollback never copy, change or print secrets.
- **FR-025**: The app's logs on the server MUST be rotated and kept for 14 days; older logs MUST be deleted (OPS-006). This 14-day retention is server-wide: it applies to all server logs, including system and SSH logs, with the default size cap (no separate size limit). The server that handles HTTPS in front of the app MUST keep no access log of its own and log errors only; the app's existing JSON request logs (RM-1) are the request log. The deploy and rollback run records and run logs are outside this rule: they are pruned to 14 days at the next run, the newest record is always kept, and they hold no secrets (FR-026).
- **FR-026**: The output of the deploy and rollback commands and the scheduled backup job, and the server logs, MUST never contain secret values, tokens, magic links, or description and comment text (SEC-007). Error log lines of the server that handles HTTPS in front of the app MUST keep only the method, the path without the query string, the status and the error; the query string and all headers MUST be removed.
- **FR-027**: The repository MUST document, without secret values, the one-time steps to prepare a new server, the domain and the off-server storage, and how to run deploy and rollback, so the owner can rebuild the production environment from scratch.

**Cost (NFR-009)**

- **FR-028**: The production environment's hosting — server, off-server backup storage, uptime check, certificate and domain — MUST cost under $20 per month (NFR-009), and the headroom left under $20 for the planned email provider (DEC-003) MUST be recorded (about $6 at the VPS renewal price). The full NFR-009 total including email is checked in RM-3 when it picks the email provider (DEC-003 already says to stop and ask). Free tiers MAY be used where they meet the requirements above.

### Key Entities

- **Release**: one deployed version of the app on the server, identified by its commit and deploy time, prepared completely in its own place before it can go live. Exactly one release is live at a time — the one the single, atomically changed switch names — and only it receives member traffic. At most two are kept runnable: the live one and one previous-release slot (unchanged by a deploy of the commit that's already live; empty after a rollback, including one interrupted after its atomic switch; unchanged after a rollback that fails its `/health` check or is interrupted before its switch; empty after a failed deploy or a deploy interrupted before the atomic switch that applied any schema change; such a deploy that applied none leaves it as it was; a deploy interrupted after the atomic switch completed sets it as a successful deploy does, to the release that was live before). Separately, the static files of the last 5 releases are kept so pages left open keep working (FR-005); keeping them does not make those releases rollback targets.
- **Deploy record**: what the deploy and rollback commands report: commit, start and end time (UTC), outcome, and the failure reason or post-switch warning if any. It is recorded on the server even when the owner's connection drops, and the next deploy or rollback command prints it first (once it reaches the server) if it was not yet reported. A run that died before it ended, or whose record couldn't be written, has no end time; its outcome is "interrupted", reported by the next deploy or rollback command together with the release id of the release live now.
- **Backup**: one copy of the production database in off-server storage, identified by its UTC date and time. The 14 most recent are kept, whichever run took them (the daily schedule or a hand-run trial).
- **Server config file**: the production settings and secrets on the server, outside every release and the repository.
- **Uptime alert**: the email the owner gets after two failed checks in a row, naming the address checked and when the failures started.
- **Log file**: the app's rotated output on the server, kept 14 days, like every other server log (server-wide retention). Run records and run logs are not log files in this sense (FR-025).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner deploys a new commit of `main` by running one command, with zero manual steps, in 10 out of 10 trial deploys.
- **SC-002**: In 100% of trials with a deliberately failing schema change, the previous version keeps serving and the command reports the failure.
- **SC-003**: The rollback command restores the previous release within 2 minutes in 10 out of 10 trials, measured from running the command to the switch (the previous release serving traffic again), with no database restore; within that time, the previous release's `/health` wait is at most 60 seconds (polled every 2 seconds).
- **SC-004**: 100% of plain HTTP requests in a sample of addresses are redirected to HTTPS with the path kept, and 100% of HTTPS responses carry the HTTPS-only instruction for one year, for this host only, without preload.
- **SC-005**: Over 15 consecutive days, starting after the last hand-run trial backup, a backup exists for each day, each is in off-server storage, and after day 15 exactly 14 remain with the oldest gone.
- **SC-006**: With the database stopped, the owner receives an alert email within 12 minutes of the stop in 3 out of 3 trials; a single failed check followed by a pass sends 0 emails.
- **SC-007**: A search of the repository for every production secret value finds zero matches, and a search of 14 days of server logs and command output finds zero secret values or tokens.
- **SC-008**: No server log in the journal is older than 15 days, and logs from each of the last 14 days are present (the retention policy is 14 days; the extra day is journald's whole-file granularity). This covers all server logs (server-wide retention), not the deploy and rollback run records and run logs, which follow their own rule (FR-025).
- **SC-009**: The monthly cost of the production environment's hosting is under $20, with the headroom left for the planned email provider recorded, shown by the cost table in `docs/production.md` and then by the first monthly bills; the total including email is checked in RM-3 (FR-028).
- **SC-010**: During 10 trial deploys and 10 trial rollbacks with steady member-like traffic, 0 requests go unanswered, 0 get an error caused by the switch, and 0 page views mix old and new code (zero member-visible downtime). Measurement: a probe outside the VPS requests `/` and `/health` about 20 times a second, and a browser page is loaded before the switch and used after it; with a harmless change deployed, every non-200 or unanswered probe request and every console error for a missing `/_next/static` file counts as caused by the switch. Requests on the old version still running 30 seconds after the switch, and the gap during a server restart, are not counted (FR-005). In 100% of trials with a new version that fails its `/health` check, that version receives 0 member requests and the old release serves throughout.

## Assumptions

- The owner provides the VPS, the team's domain (pointed at the server) and the accounts for off-server storage and the uptime check; choosing specific providers and tools within NFR-009 is left to `/speckit-plan`, and any new npm package still needs the owner's approval (Constitution IV).
- "The owner" is a single person who runs deploys and receives alerts; their email address is a setting, not hard-coded in the repository.
- Deploy and rollback are run from the owner's own machine (with access to the server), not from a CI service; adding CI-driven deploys is out of scope.
- "Differs from the shared `main`" means the local `main` commit is not the same as the one on the shared remote; the deploy uses that exact commit. If the shared remote can't be reached, the check counts as failed and the deploy refuses (FR-002).
- Deployment method (user-mandated constraint): symlink-based atomic deployment — each release is prepared in its own place and the live release is chosen by one atomic switch, giving zero-downtime deploys and rollbacks. No maintenance page is used. `/speckit-plan` MUST use this method; other implementation detail is left to the plan.
- During a deploy or rollback the old and new versions run side by side briefly (from the new version's start until the switch and the old version's in-progress requests finish, at most 30 seconds after the switch). The VPS size chosen in the plan must leave room for this, and that size must still fit FR-028 / NFR-009; this spec sets no memory or size figure. If no server within budget can run two versions at once, that conflict must be raised during planning rather than dropping zero downtime.
- The database runs on the same VPS as the app (section 12); backups copy only the database, not the releases or the server config file, which can be rebuilt from the repository and the owner's own copy of the secrets.
- Backup files are stored with the protection the storage provider offers; extra encryption of backups is not required by the spec (section 10: no encryption at rest beyond what the host provides).
- Restoring from a backup is documented in this slice but rehearsed only in RM-14 (OPS-003.1).
- The uptime check emails the owner directly from the check's own service; it does not depend on the app's email provider, which arrives in RM-3 (DEC-003).
- The app's logs are the one-JSON-object-per-line standard output from RM-1; this slice captures them to files on the server and rotates them, without changing their content. They are the only request log; the HTTPS front server logs errors only.
- There is no staging environment: the two environments are local development and the production VPS (section 12).
- This slice adds no screen, email or user-visible text inside the app, so its `design.md` is expected to be Not applicable (Constitution V); the uptime alert email is written by the external service, not by the app.
