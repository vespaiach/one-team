# Quickstart — validating R1

**Plan**: [`plan.md`](./plan.md) · **Contracts**: [`contracts/`](./contracts/)

How to stand the installation up from nothing and prove every acceptance scenario in
[`spec.md`](./spec.md) is met. This is a validation guide, not an implementation guide — the details
live in the contracts, and the work itself lands in `tasks.md`.

---

## Prerequisites

| | |
| --- | --- |
| Node.js | the version `next@16.3.2` supports |
| PostgreSQL 18 | two databases: one for development, one for tests |
| An SMTP host | optional — every reset scenario except mail delivery works without it |

Two databases, never one. AGENTS.md: persistence tests run against a real PostgreSQL instance on a
**separate** database, and never point at development, staging or production data.

```bash
createdb one_team_dev && createdb one_team_test
```

`.env.local`:

```text
DATABASE_URL=postgres://localhost/one_team_dev
TEST_DATABASE_URL=postgres://localhost/one_team_test
APP_URL=http://localhost:3000
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<at least 12 characters, not on the blocklist>
SUPPORT_EMAIL=help@example.com
TZ=UTC
```

See [`contracts/environment.md`](./contracts/environment.md) for what each value does and what
happens when it is absent.

---

## Migrate

```bash
npm run db:generate
```

Inspect the generated SQL before applying it. Expect one migration that drops `setup_check` and
creates `user`, `credential`, `session`, `reset_token` and `auth_attempt`, with the constraints and
indexes [`data-model.md`](./data-model.md) lists. Commit the migration **and** its metadata.

```bash
npm run db:migrate
```

---

## The gate

```bash
npm run verify
```

`style-check` → `type-check` → `test` → `build`, which is exactly what CI runs. Green locally means
green in CI.

**A green `npm test` is not by itself evidence of Principle VII.** It runs with `--passWithNoTests`,
so an empty suite passes. Gate 1 asks whether a failing test preceded each implementation, and that
is answered from the commit history, not from this command.

---

## Scenario walkthroughs

Each maps to a success criterion in [`spec.md`](./spec.md). Run them against a **freshly created**
development database.

### 1 · Empty box to signed-in admin — `SC-001`, `SC-002`

```bash
npm run dev
```

| Step | Expect |
| --- | --- |
| Server starts | one admin exists, carrying `must_change_password` |
| Start once against an empty database with an eleven-character `ADMIN_PASSWORD` | the app names the length rule, writes nothing, and exits non-zero without serving a request (`FR-046`) |
| Visit `/` | redirected to `/signin` — no session cookie |
| Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` | redirected to `/home`; **404 until R2 delivers it** — the redirect is what this feature owns |
| Stop and restart the server | still exactly one admin. Run the count query in `db:studio` to confirm |

Set `ADMIN_PASSWORD` to eleven characters and start against an empty database: the app reports that
the value is too short, writes nothing, and no `user` row appears. Set it to a blocklisted value:
the app reports that it is blocklisted — one rule named, not both.

### 2 · The two failure messages are one message — `SC-003`

On `/signin`, submit the admin address with a wrong password, then an address with no account.

Compare the two responses in the network panel: **the bodies must be byte-identical**, the status
lines identical, and the rendered card identical in wording, spacing and position. If anything
differs — including the time taken — `FR-013` is not met.

### 3 · The session slides — `SC-004`

With a session in hand, move `session.last_seen_at` and `expires_at` back 29 days in `db:studio`,
then load any page: the request succeeds and `expires_at` moves 30 days out from now. Move them back
31 days instead: the next request redirects to `/signin`.

### 4 · The throttle — `SC-005`, `SC-006`, `SC-007`

| Step | Expect |
| --- | --- |
| Five wrong passwords for one address | the sixth is refused and the message states the remaining time |
| Restart the app mid-lockout | the lockout is still in force, expiring when it originally would have |
| Request a reset for that locked address | answered normally — the sign-in lockout does not block it |
| Five reset requests for one address, then a sixth | refused; sign-in for that address still works |
| Twenty wrong passwords from one IP across twenty different addresses | the twenty-first is refused whichever address it targets |
| Four failures, then a correct sign-in | that address's `signin` rows are gone; its `reset` rows and the IP's rows are untouched |

Inspect `auth_attempt` in `db:studio` between steps — it is the only place the state lives.

### 5 · The forgotten-password loop — `SC-008`, `SC-009`

| Step | Expect |
| --- | --- |
| Request a reset for a known address, and for an unknown one | the same sentence both times; a row in `auth_attempt` both times |
| Open the emailed link | Change password renders **outside the shell** — no sidebar, no header |
| Enter two different passwords | inline error on Confirm password; nothing written |
| Enter an eleven-character password | the field names the length rule; nothing written |
| Enter a blocklisted password | the field names the blocklist rule — one rule, not both |
| Enter a compliant password | redirected to `/signin` with the success message |
| Sign in with the new password | succeeds |
| The other browser you were signed in on | redirected to `/signin` on its next action |
| Open the same link again | the "already used" state |

With no `SMTP_URL` configured, the request still answers with the same sentence and the failure
appears in the server log alone.

### 6 · Token states are three different states — `FR-036`

Craft each in `db:studio` and open `/reset?token=…`:

| Row | State |
| --- | --- |
| `used_at` set | used |
| `used_at` null, `expires_at` in the past | expired |
| no row for the digest | unknown |
| `used_at` set **and** `expires_at` in the past | used — the stronger fact wins (research C-8) |

Each must be visibly distinct and each must offer a route back to `/reset`.

### 7 · The origin check — `FR-023`

```bash
curl -i -X POST http://localhost:3000/api/auth/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"…"}'
```

`curl` sends no `Origin`, so expect `403`. Repeat with `-H 'Origin: http://evil.example'` — also
`403`. A missing origin is a foreign one. The comparison is against `APP_URL`, not against anything
the request carries, so setting `Host` does not move it.

### 8 · Operator commands — `SC-012`, `SC-013`

| Step | Expect |
| --- | --- |
| `npm run admin:grant -- --email=new@example.com --first-name=A --last-name=B` | prompts for a password without echoing; creates an admin |
| The same with `--password=…` | the flag is not accepted as the password |
| The same with a short password at the prompt | refused, the rule named, nothing written |
| `npm run admin:grant` for an existing member | promoted; password replaced; `deactivated_at` and `must_change_password` cleared |
| `npm run admin:deactivate -- --email=…` on a non-last admin | `deactivated_at` set; every session for that user gone; that user's next request anywhere redirects to `/signin` |
| `npm run admin:deactivate` on the **only** active admin | refused; nothing written |
| Two of those run concurrently against the last admin | at most one succeeds; the installation is never left with zero active admins |

### 9 · Nothing leaks — `SC-010`

Grep the server log and every response body from the runs above for the admin password, any hash,
any session token and any reset token. **None may appear anywhere**, including in an error response.

### 10 · The layout is one layout — the `/speckit-plan` input

| Check | |
| --- | --- |
| `/signin` and `/reset` | identical card geometry, background, border, radius, padding and app mark |
| Change password (`/reset?token=…`) | the same again — "exactly like Sign in itself" (§3.1) |
| Tab through every control on all three | one focus ring, identical treatment, always visible |
| Blur an empty required field | the error appears on blur, on that field alone, and the submit control stays enabled |
| Resize the window | nothing responds — desktop only, no breakpoints |
| `src/app/(auth)/layout.tsx` | contains no `"use client"`, no `react-aria-components` import, no database access |

The last row is the structural claim: if the shared frame has drifted into the client module graph
or grown a data dependency, the layout has stopped being a layout.

---

## What is **not** validated here

Deferred by the roadmap's R1 boundary, so their absence is correct rather than a gap:

| | Owner |
| --- | --- |
| `/home` — the sign-in redirect target 404s | R2 |
| The shell that hosts the must-change-password banner, so the banner renders nowhere | R2 |
| A sign-out control | R2 |
| `/invite/accept` and every invitation route | R3 |
| The Accounts screen's deactivate and reactivate controls | R3 |
| Profile and its "Change password" link | R4 |
| The notification-mail retry on the interval timer | R11 |
