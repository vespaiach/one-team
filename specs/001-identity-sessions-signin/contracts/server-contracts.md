# Contract — internal server surface

**Plan**: [`../plan.md`](../plan.md)

The functions R2 through R12 inherit. Each is established once here; a later slice consumes it and
does not reimplement it.

Everything below lives under `src/features/auth/server/` or `src/db/`, and every module in those
directories imports `server-only`, so a Client Component that reaches one fails the build rather
than leaking at runtime (AGENTS.md).

---

## `loadActor()` and `requireActor()`

`src/features/auth/server/actor.ts`. The centre of the whole feature: `OT-SEC-008` and `FR-020`.

```text
loadActor():    Promise<Actor | null>
requireActor(): Promise<Actor>            redirects to /signin when there is no actor
```

| Guarantee | |
| --- | --- |
| One query | the session row and the user's `role` and `deactivated_at` are read together, not in two round trips |
| Nothing cached between requests | identity, role and membership are read fresh every time (`FR-009`, `OT-SCOPE-006`) |
| Three no-actor cases | no session row for the digest, past `expires_at`, or `deactivated_at` set (`FR-021`) |
| Sliding refresh | a resolved session's `last_seen_at` and `expires_at` move to `now` and `now + 30 days` |
| Redirect, never Forbidden | `requireActor()` sends an unauthenticated caller to `/signin`; the Forbidden screen is for an authenticated caller who lacks a permission (`FR-022`, `OT-SEC-015`) |

`loadActor()` is wrapped in React's `cache()` so two callers within **one render pass** share one
query. That is per-request memoization, not a cache of identity across requests — the distinction
`OT-SEC-008` turns on (research B-2).

**Called from pages, Server Actions and route handlers. Never from a layout** — layouts do not
re-render on client-side navigation and do not control whether the rest of the route renders, so a
check placed there is not a check (research B-2).

`Actor` is `{ id, role, firstName, lastName }` and is not a table row. It is passed to every read
query and every mutator; a mutator derives its subject from stored rows, never from a
client-supplied identifier (`FR-024`, `OT-AUTHZ-004`).

---

## `assertSameOrigin()`

`src/features/auth/server/origin.ts`. `FR-023`, `OT-SEC-009`.

Compares `Origin` against the origin `APP_URL` names — never against a value taken from the request
being checked, which could never refuse anything (`FR-023`). **A missing `Origin` is treated as a
foreign one.** No CSRF token exists anywhere in the product.

Called as the first statement of the sign-in route handler and of every Server Action — including
every Server Action R3 through R12 add.

---

## The throttle

`src/features/auth/server/throttle.ts`. `FR-039`…`FR-043`, `OT-SEC-010`, `OT-SEC-017`.

```text
assertNotThrottled(flow, email, ip, now):  void | throws Throttled(retryAfterSeconds)
recordFailure(flow, email, ip, now):       void
clearSignInAttempts(email):                void
```

| | |
| --- | --- |
| Window | 15 minutes, counted for one `(flow, kind, subject)` taken together |
| Limits | 5 for `kind = 'email'`, 20 for `kind = 'ip'` |
| Flows | `signin` and `reset` count in their own buckets and never share one |
| Durability | rows in `auth_attempt`; a restart removes nothing (`SC-006`) |
| Concurrency | count, decision and insert run under `pg_advisory_xact_lock` keyed on the subject, so two attempts racing the fifth failure cannot both pass (research C-5) |
| `retryAfterSeconds` | derived from the **oldest** attempt still inside the window; the screen renders it as whole minutes **rounded up**, so a refusal in force never reads as no wait (`FR-039`) |
| The `ip` subject | the connection's own peer address; `X-Forwarded-For` is read only where the operator set `TRUST_PROXY`, and then only its last hop (`FR-016`) |
| Refusals | a refused attempt records **no** row, so a refusal cannot extend the window that produced it (`FR-041`) |
| Both limits at once | where the address and the IP are both inside their windows, the **later** of the two clearing instants is reported, so the caller is never invited back while a limit still holds (`FR-068`) |

`clearSignInAttempts()` removes that address's `('signin','email')` rows **only** — not its `reset`
rows, and not the originating IP's, so holding one valid credential is not a way to reset the
per-IP counter (`FR-018`).

---

## Hashing and tokens

`src/features/auth/server/crypto.ts`. `FR-028`, `FR-029`, `OT-SEC-005`, `OT-SEC-006`.

```text
hashPassword(plaintext):            Promise<string>       Argon2id, parameters in research B-10
verifyPassword(hash, plaintext):    Promise<boolean>
issueToken():                       { token, digest }     32 CSPRNG bytes, base64url, SHA-256 hex
digestToken(token):                 string
```

The 32 bytes come from the runtime's cryptographically secure random source, never from `Math.random`
or a seeded generator (`FR-029`). `hashPassword` sets `memoryCost: 19456`, `timeCost: 2`,
`parallelism: 1` explicitly rather than taking a library default (`FR-028`, research B-10).

`issueToken()` serves session and reset tokens alike, and R3's invitation token. Nothing in the
codebase compares two secrets: a presented token is hashed and the **digest** is looked up.

`verifyPassword` is also called with a fixed dummy hash on the unknown-address path, so a wrong
password and an unknown address cost the same (`FR-013`).

---

## Password policy

`src/features/auth/server/password-policy.ts`. See
[`http-and-actions.md`](./http-and-actions.md) — the same function serves the reset screen, first-run
seeding and `admin:grant`, which is what `OT-SEC-019` means by "the same policy at every entry
point".

---

## `touched()`

`src/db/touched.ts`. `FR-003`, `OT-DATA-002`.

One helper that stamps `updated_at`, called explicitly by every mutator that writes a table carrying
the column. **No database trigger.** Applies to `user` and `credential` in this feature; §5 fixes
`session`, `reset_token` and `auth_attempt` without the column (research C-1).

---

## Projections

`src/features/auth/server/projections.ts`. `FR-004`, `OT-DATA-005`.

`publicUser` and `accountUser` as defined in [`../data-model.md`](../data-model.md). Every endpoint in
the product selects `user` through one of them; none selects the table directly, so a column added
later cannot leak by default.

`accountUser` has **no caller in this feature** — R3's Accounts screen and R4's Profile are its two.
It is defined here because the read boundary is one of the conventions R1 establishes, and because
defining half a boundary invites the other half to be invented twice.

---

## The active-admin guard

`src/features/auth/server/admin-guard.ts`. `FR-056`, `OT-INV-013`.

```text
withLastAdminGuard(tx, targetUserId, change): void | throws LastAdminRefusal
```

Inside the caller's transaction: locks the active-admin row set with `SELECT … FOR UPDATE`, refuses
if applying `change` would empty it, then applies it. Two concurrent attempts to close the last admin
serialize on the same locked rows, so at most one can succeed (`SC-012`).

Used by `admin:deactivate` and by the CLI role change in this feature. **R3's `deactivateUser`
mutator shares this exact function** — the roadmap records that reach-back explicitly.

---

## Bootstrap and the interval timer

`src/instrumentation.ts` and `src/features/auth/server/bootstrap.ts`. `FR-044`…`FR-048`,
`OT-OPS-003`, `OT-SEC-014`, `OT-SEC-019`.

`register()` runs once per server instance, guarded by `NEXT_RUNTIME === 'nodejs'`, and does three
things in order:

1. **Validate the environment.** `APP_URL` MUST be present and parseable, `ADMIN_EMAIL` — where
   seeding will run — MUST be a valid address, and `ADMIN_PASSWORD` is held to the password policy.
   Any of these failing stops seeding, writes nothing, names the rule that failed **on standard
   error**, and ends the process with a non-zero exit status before any request is served
   (`FR-046`, `FR-058`, `FR-073`). A database that cannot be reached ends the process the same way
   (`FR-072`) — a box that answers requests it cannot serve is worse than one that does not start.
2. **Seed, or skip.** Inside one transaction: if any `user` row exists, skip — that check is the
   whole marker, so the path can neither run twice nor mint a second admin later (`FR-047`). Two
   processes starting against the same empty database both pass the check; the unique address index
   refuses the second insert, and that process reads the violation as "already seeded" and carries
   on starting rather than exiting (`FR-047`, `FR-059`).
   Otherwise write one admin carrying `must_change_password` (`FR-045`, `FR-048`), with the address
   validated and folded to lower case (spec assumption).
3. **Start the sweep.** One `setInterval` running three deletes, each matching only rows that are
   already dead (`FR-044`):

   ```sql
   DELETE FROM auth_attempt WHERE attempted_at < now() - interval '15 minutes';
   DELETE FROM session      WHERE expires_at  < now();
   DELETE FROM reset_token  WHERE used_at IS NOT NULL OR expires_at < now();
   ```

**The interval is five minutes** (`FR-069`) — shorter than the fifteen-minute attempt window, so the
table never holds more than a few windows' worth of rows, and not configurable.

**This is the installation's only timer** (`FR-044`). R11 adds the notification-mail retry to this
same callback; it does not start a second one. The interval is `unref()`d and cleared on `SIGTERM`,
and a sweep already running is allowed to finish — each statement is atomic on its own, so a process
ended mid-sweep leaves nothing partial to repair (`FR-071`). A sweep that throws is caught and
logged and **does not stop the timer**; the next interval runs normally (`FR-070`).

---

## Logging

`FR-064`, `SC-010`. Five events, and this feature introduces no others: a refused sign-in, a throttle
refusal, a mail send failure, a refused first-run seed, and an unhandled server error. Each line
carries the event, the instant, and the address or IP address it concerned — and never a password, a
hash, a session token or a reset token.

That enumeration is what makes `SC-010` checkable: "any log line the installation produces" is these
five and nothing more, so a reviewer greps a bounded set rather than an open one.

---

## Mail

`src/features/auth/server/mail.ts`. One `nodemailer` transport from operator-supplied SMTP
(`FR-058`, `OT-OPS-012`). Sends the reset link and nothing else in this feature. The link is an
absolute URL built from `APP_URL`, because the mail outlives the request that triggered it (`FR-033`).

A send failure is logged server-side and **never changes what the caller is told** (`FR-033`).
R11 adds notification mail and the retry sweep on the same transport.
