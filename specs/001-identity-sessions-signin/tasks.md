# Tasks: Identity, sessions and sign-in

**Feature**: roadmap entry **R1** · **Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md)

**Input**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: **REQUIRED, and written first.** The template treats test tasks as optional; AGENTS.md
Principle VII is NON-NEGOTIABLE and gate 1 requires a test observed failing before its
implementation, so every implementation task below is preceded by the test that must be red first.
The plan's Constitution Check already commits all 42 acceptance scenarios to that discipline.

**Organization**: grouped by user story, in the spec's priority order, so each is independently
implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US5]`, matching the spec's user stories
- Every task names the file it touches and the requirement that puts it there (gate 7)

## Path conventions

One Next.js project. `src/app` holds routing only; behaviour lives in `src/features/auth/`, with
server-only modules under its `server/` directory. Tests are colocated with the module they cover.

---

## Reconciliations this plan inherits

Two, both discovered when the tasks were cut against the current tree rather than against the tree
the plan was written on. Neither changes a requirement.

1. **The token set already landed.** `29a9ace ui: add global tokens` committed a design-token block
   to `src/app/globals.css` that differs from research A-4…A-9 in ten particulars: a warm
   eleven-step ramp instead of a cool ten-step one, `--color-border-active` for
   `--color-border-control`, `--color-danger-fill` for `--color-danger-surface`, no `--color-focus`
   token, six custom type steps where A-5 said add none, a 440px card and a 44px field where A-7
   said 400px and 40px, and `* { border-radius: 0 }` where A-7 specified radii. The committed tokens
   are the decision; T008 brings the two documents to them.
2. **The declared font is never loaded.** `globals.css` sets `--font-sans: Archivo` while
   `src/app/layout.tsx` loads Geist through `next/font`. Geist is downloaded and unused and Archivo
   resolves to the fallback stack — research A-9's bug in a new form. T033 closes it.

`vitest.config.ts` in the plan's structure diagram is `vitest.config.mts` on disk; tasks name the
real file.

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: everything the first failing test needs in order to run.

- [X] T001 Install `@node-rs/argon2`, `nodemailer` and `uuidv7` and record them under `dependencies` in `package.json` — all three are pre-approved in AGENTS.md's table, so gate 4 needs no amendment
- [X] T002 [P] Add `admin:grant` and `admin:deactivate` script entries to `package.json`, pointing at `scripts/admin-grant.ts` and `scripts/admin-deactivate.ts` (`FR-051`, `FR-054`)
- [X] T003 Replace the single jsdom environment in `vitest.config.mts` with two projects — `server` (node; `src/**/server/**/*.test.ts`, `src/db/**/*.test.ts`, `src/instrumentation.test.ts`, `scripts/**/*.test.ts`) and `ui` (jsdom; `**/*.test.tsx`) — per research D-1; note the `scripts/` glob is not in D-1's list and the CLI tests need it
- [X] T004 Add the PostgreSQL test harness in `src/db/test-database.ts` and its Vitest setup file: read `TEST_DATABASE_URL`, run the committed migrations once, and expose a truncate helper — truncation rather than a wrapping transaction, because C-5 and C-7 assert on concurrent transactions (research D-2)
- [X] T005 [P] Extend `.env.example` with `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SUPPORT_EMAIL`, `TRUST_PROXY`, `SMTP_URL`, `MAIL_FROM`, `TZ` and `TEST_DATABASE_URL`, matching [`contracts/environment.md`](./contracts/environment.md)
- [X] T006 [P] Add the newline-delimited blocklist of the ten thousand most common passwords as `src/features/auth/server/common-passwords.txt` — repository data, never a dependency (`FR-026`, research B-9)
- [X] T007 Verify against the installed `next` package whether a Route Handler can read the connection's peer address, and record the answer in [`research.md`](./research.md) C-3. `NextRequest.ip` existed in earlier versions and was removed; if Next 16 exposes nothing, the value comes from the runtime adapter. `FR-016` fixes the rule either way — this task settles only how it is read
- [X] T008 Reconcile [`contracts/auth-layout.md`](./contracts/auth-layout.md)'s token contract and [`research.md`](./research.md) A-4…A-9 with the tokens committed in `src/app/globals.css`, listing each of the ten divergences above with the committed value; re-measure the A-4 contrast table against the warm ramp, since `--color-text-muted` and `--color-danger` are the two that sit near the 4.5:1 line

**Checkpoint**: `npm test` runs both projects against a real database and finds nothing.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the schema and the shared server modules that two or more stories each need.

**⚠️ CRITICAL**: no user story can begin until this phase is complete.

### The schema and its migration

- [X] T009 [P] Failing test in `src/db/schema.test.ts` asserting the five tables use UUIDv7 primary keys, `text` + `CHECK` for `role`, `feed_filter`, `flow` and `kind` rather than `pgEnum`, and `timestamptz` for every instant (`FR-001`, `OT-DATA-001`)
- [X] T010 [P] Failing test in `src/db/constraints.test.ts` asserting every free-text bound rejects an over-long value — 200 for names, handles, `email` and `auth_attempt.subject`; 10 000 for `bio`; 45 for `ip_address`; 1000 for `user_agent`; 2000 for `avatar_url`; 255 for `password_hash`; exactly 64 for both `token_digest` columns (`FR-002`, research C-2, C-3, C-4, C-11)
- [X] T011 [P] Failing test in `src/db/user-uniqueness.test.ts` asserting `UNIQUE (lower(email))` refuses two addresses differing only in case, and that a concurrent duplicate insert surfaces as a catchable violation rather than an unhandled error (`FR-006`, `FR-059`, `OT-INV-016`)
- [X] T012 [P] Failing test in `src/db/migration.test.ts` asserting no `setup_check` relation exists and that every index research C-9 lists is present (`FR-008`)
- [X] T013 Implement the five tables — `user`, `credential`, `session`, `reset_token`, `auth_attempt` — and remove `setupCheck` in `src/db/schema.ts`, following [`data-model.md`](./data-model.md) column for column
- [X] T014 Run `npm run db:generate`, read the generated SQL to confirm it both drops `setup_check` and creates the five tables in one migration, and commit `drizzle/` with its metadata (research C-10)

### Shared server modules

- [X] T015 [P] Failing test in `src/db/touched.test.ts` asserting `touched()` stamps `updated_at` and that no database trigger writes it (`FR-003`, `OT-DATA-002`)
- [X] T016 Implement `src/db/touched.ts` — the one helper every mutator on `user` and `credential` calls explicitly
- [X] T017 [P] Failing test in `src/features/auth/server/crypto.test.ts` asserting `hashPassword` sets `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1` explicitly, that `issueToken()` draws 32 bytes from the CSPRNG and returns a 64-character SHA-256 hex digest, and that a stored hash round-trips through `verifyPassword` (`FR-028`, `FR-029`, research B-10)
- [X] T018 Implement `src/features/auth/server/crypto.ts` with `hashPassword`, `verifyPassword`, `issueToken` and `digestToken`
- [X] T019 [P] Failing test in `src/features/auth/server/password-policy.test.ts` asserting eleven characters fails `too_short`, 129 fails `too_long`, a blocklisted value fails `blocklisted` whatever its case, twelve compliant characters pass, and no composition rule is applied (`FR-026`, `FR-027`)
- [X] T020 Implement `assertPasswordPolicy()` in `src/features/auth/server/password-policy.ts` — the name [`contracts/http-and-actions.md`](./contracts/http-and-actions.md) fixes — loading `common-passwords.txt` once at module load into a `Set` (research B-9)
- [X] T021 [P] Failing test in `src/features/auth/server/input.test.ts` asserting an address over 200 characters, a malformed address and a password over 128 characters are each refused before any database lookup, any hash and any attempt row, and that a valid address is folded with the runtime's Unicode-aware lower-casing (`FR-063`, `FR-006`)
- [X] T022 Implement `src/features/auth/server/input.ts` — the address and password boundary parser the five entry points share
- [X] T023 [P] Failing test in `src/features/auth/server/projections.test.ts` asserting `publicUser` carries exactly its seven columns, `accountUser` adds exactly the four contact fields, and neither selects a password (`FR-004`, `OT-DATA-005`)
- [X] T024 Implement `src/features/auth/server/projections.ts`; `accountUser` ships with no caller in this slice, per the plan's Complexity Tracking
- [X] T025 [P] Failing test in `src/features/auth/server/origin.test.ts` asserting a missing `Origin` is refused like a foreign one, that the expected origin comes from `APP_URL` and never from a header on the request under test, and that no CSRF token is involved (`FR-023`, research B-5)
- [X] T026 Implement `src/features/auth/server/origin.ts` exposing `assertSameOrigin()`
- [X] T027 [P] Failing test in `src/features/auth/server/log.test.ts` asserting the module writes exactly the five events `FR-064` enumerates, each carrying the event, the instant and the address or IP it concerned, and that no line can carry a password, a hash, a session token or a reset token (`FR-064`, `SC-010`)
- [X] T028 Implement `src/features/auth/server/log.ts` with one writer per enumerated event

- [X] T029 [P] Failing test in `src/features/auth/server/sessions.test.ts` asserting a sign-in writes one row with `expires_at = now + 30 days`, stores only the digest — a row behind an opaque cookie, never a claim inside a signed token — and that any use slides `last_seen_at` and `expires_at` forward, so a holder who uses the product once in any thirty days is never asked again — and that `deleteAllSessionsForUser()` removes every row for one user and none for any other — US1 scenarios 1 and 7, US3 scenario 10 (`FR-010`, `FR-016`, `FR-017`, `FR-038`, `FR-054`, `SC-004`, `SC-008`)
- [X] T030 Implement `src/features/auth/server/sessions.ts` — issue, resolve by digest, the sliding refresh, and `deleteAllSessionsForUser()`. Foundational rather than US1 because three stories call it: US1 issues and resolves, US3 deletes every session on a completed reset, and US5 deletes them on deactivation — Principle I's two-call-site rule met by fact

### The common layout

- [X] T031 [P] Failing test in `src/app/(auth)/layout.test.tsx` asserting the layout renders a `<main>` landmark carrying the page background, the app mark and the card, and that it is a Server Component holding no state and importing nothing from `react-aria-components` (research A-1, A-2, `OT-UX-001`)
- [X] T032 Implement `src/app/(auth)/layout.tsx` per [`contracts/auth-layout.md`](./contracts/auth-layout.md)'s structural contract, using the committed tokens — `--color-page`, `--color-surface`, `--color-border`, `--size-card` — and `py-16` on the centring container so a tall state scrolls rather than centring off-screen
- [X] T033 Close the font gap in `src/app/layout.tsx` and `src/app/globals.css`: load Archivo through `next/font/google` and remove the unused Geist wiring, so the `--font-sans` the committed tokens declare is the font that actually loads (research A-9, restated by reconciliation 2 above)

**Checkpoint**: the schema, the shared modules and the layout exist; user stories can begin.

---

## Phase 3: User Story 1 — An account holder signs in and stays signed in (P1) 🎯 MVP

**Goal**: a holder signs in, lands on `/home`, and is answered as themselves on every later request
for thirty days of use.

**Independent Test**: seed one account and its credential directly in the test database, then drive
`/signin` — correct credentials produce a session and land on `/home`; a wrong password and an
unknown address produce one identical message; a request to an authenticated route without a cookie
redirects to `/signin`. No other story needs to exist; `sessions.ts` is Foundational (T029, T030).

### Tests for User Story 1

- [ ] T034 [P] [US1] Failing test in `src/features/auth/server/actor.test.ts` asserting `loadActor()` reads the session row and the user's `role` and `deactivated_at` in one query, holds no client-side copy of any of it, and resolves to no actor for a cookie naming no row, a row past `expires_at` and a user whose `deactivated_at` is set — scenarios 6 and 8 (`FR-009`, `FR-020`, `FR-021`)
- [ ] T035 [US1] Extend `src/features/auth/server/actor.test.ts`: `requireActor()` redirects to `/signin` and never reaches the Forbidden screen, and two calls in one render pass share one query while two requests do not — scenario 9 (`FR-022`, `SC-011`, research B-2)
- [ ] T036 [P] [US1] Failing test in `src/app/api/auth/signin/route.test.ts` asserting `ok` writes one session row, sets `one_team_session` with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` and `Secure` only in production, and that the caller lands on `/home` — scenario 1 (`FR-016`, `FR-017`, `FR-019`, research B-7)
- [ ] T037 [US1] Extend `src/app/api/auth/signin/route.test.ts`: a wrong password, an unknown address and an account with no credential row return byte-identical `rejected` bodies, and each performs one Argon2id verification so the three cost the same — scenarios 2 and 3 (`FR-013`, `FR-062`, `SC-003`)
- [ ] T038 [US1] Extend `src/app/api/auth/signin/route.test.ts`: correct credentials for a deactivated account return `deactivated` carrying `SUPPORT_EMAIL`, and `null` where the operator configured none — scenarios 4 and 5 (`FR-014`); and a deactivated account with a *wrong* password returns `rejected`, per the spec's edge case
- [ ] T039 [US1] Extend `src/app/api/auth/signin/route.test.ts`: a foreign or absent `Origin` is `403 forbidden`, a malformed body is `400 invalid_request`, and an over-long address or password is refused before any lookup — scenario 10 (`FR-023`, `FR-063`)
- [ ] T040 [US1] Extend `src/app/api/auth/signin/route.test.ts`: a caller who already holds a valid session gets a second session rather than a reused, extended or deleted one, and no limit is placed on how many a user holds (`FR-060`, `FR-061`)
- [ ] T041 [P] [US1] Failing test in `src/features/auth/components/sign-in-form.test.tsx` covering the form, rejected, deactivated with and without a contact, and in-flight states, and asserting the rejected and deactivated states are carried by the same element in the same position — a visual difference is as much an oracle as a wording one (`FR-012`, `SC-003`)
- [ ] T042 [US1] Extend `src/features/auth/components/sign-in-form.test.tsx` for the interaction contract: per-field validation on blur with the submit control never disabled, validation also running on submit for a field never blurred, focus moving to the first invalid field with no error summary (`FR-081`), the outcome announced when it appears (`FR-082`), keyboard-only completion (`FR-083`), a long address wrapping rather than overflowing (`FR-084`), submit-time validation of a never-blurred field (`FR-085`), and no animation (`FR-086`) — `FR-027`
- [ ] T043 [P] [US1] Failing test in `src/app/(auth)/signin/page.test.tsx` asserting the page sets its own document title, carries exactly one `<h1>`, renders no sign-up link and no "remember me" control, renders the form to a caller who already holds a session, and honours `?reset=done` and no other query parameter (`FR-012`, `FR-060`, `FR-079`)
- [ ] T044 [P] [US1] Failing test in `src/proxy.test.ts` asserting an absent session cookie on a protected path redirects to `/signin`, that exactly `/signin`, `/reset`, `/api/auth/signin`, `/_next/*` and static assets are exempt — the three public routes this feature opens and no fourth, invitation acceptance staying closed until R3 — and that proxy reads no database (`FR-011`, research B-3)
- [ ] T045 [P] [US1] Failing test in `src/app/page.test.tsx` asserting `/` redirects to `/home` (research B-6)

### Implementation for User Story 1

- [ ] T046 [US1] Implement `src/features/auth/server/actor.ts` — `loadActor()` wrapped in React's `cache()` for per-render memoization only, and `requireActor()`; never called from a layout (research B-2)
- [ ] T047 [US1] Implement `POST /api/auth/signin` in `src/app/api/auth/signin/route.ts`, validating in the fixed order origin → shape → address form → credentials, and returning the `SignInResult` union whose `rejected` variant has no shape in which a wrong password could be distinguished from an unknown address
- [ ] T048 [US1] Add the fixed-dummy-hash verification to the unknown-address and no-credential-row paths in `src/app/api/auth/signin/route.ts`, so all three rejections cost one Argon2id verification (`FR-013`, `FR-062`)
- [ ] T049 [US1] Record the caller's IP and user agent on the session row in `src/app/api/auth/signin/route.ts`, normalized and truncated to the 45 and 1000 bounds, taking the address per T007's answer and reading `X-Forwarded-For`'s last hop only under `TRUST_PROXY` (`FR-016`, research C-3)
- [ ] T050 [US1] Wire the refused-sign-in event from `src/app/api/auth/signin/route.ts` into `src/features/auth/server/log.ts` (`FR-064`)
- [ ] T051 [P] [US1] Implement `src/features/auth/components/sign-in-form.tsx` — a Client Component posting with `fetch`, using `<Form validationBehavior="aria">` with controlled `isInvalid` and `<FieldError>`, `onPress` never `onClick` (research B-1, B-8)
- [ ] T052 [P] [US1] Implement `src/app/(auth)/signin/page.tsx` with its `<h1>`, its metadata title and the `?reset=done` banner
- [ ] T053 [P] [US1] Implement `src/proxy.ts` — the fast unauthenticated redirect, explicitly not the authorization
- [ ] T054 [P] [US1] Replace the create-next-app placeholder in `src/app/page.tsx` with the redirect to `/home`

**Checkpoint**: sign-in works end to end and is independently demonstrable. This is the MVP.

---

## Phase 4: User Story 2 — An operator stands a new installation up (P2)

**Goal**: an empty box plus two environment values becomes exactly one admin account, once, or
stops loudly.

**Independent Test**: start against an empty database with a compliant `ADMIN_PASSWORD` and confirm
exactly one admin row carrying `must_change_password`; restart and confirm no second admin; start
with a ten-character password and confirm the app names the rule that failed, writes nothing, and
exits non-zero.

### Tests for User Story 2

- [X] T055 [P] [US2] Failing test in `src/features/auth/server/bootstrap.test.ts` asserting a first start on an empty database creates exactly one admin carrying `must_change_password`, and that a second start creates nothing whatever the environment says — scenarios 1 and 2 (`FR-045`, `FR-047`, `FR-048`, `SC-002`)
- [X] T056 [US2] Extend `src/features/auth/server/bootstrap.test.ts`: a short or blocklisted `ADMIN_PASSWORD` names the failing rule **on standard error**, writes nothing, and exits non-zero before a request is served — scenarios 3 and 4 (`FR-046`, `OT-SEC-019`)
- [X] T057 [US2] Extend `src/features/auth/server/bootstrap.test.ts`: an invalid `ADMIN_EMAIL` and an unreachable database each end the process the same way, and an absent `ADMIN_EMAIL` skips seeding and serves normally (`FR-072`, `FR-073`)
- [X] T058 [US2] Extend `src/features/auth/server/bootstrap.test.ts`: two processes seeding one empty database concurrently leave one admin, the loser reading the unique-index violation as "already seeded" and continuing to start rather than exiting (`FR-047`, `FR-059`)
- [X] T059 [P] [US2] Failing test in `src/instrumentation.test.ts` asserting `register()` runs under the `nodejs` runtime guard only, and that a second call in one process is a no-op (research B-4)
- [X] T060 [P] [US2] Failing test in `src/features/auth/components/must-change-password-banner.test.tsx` asserting the banner states the condition, offers no dismiss control, and is not an error or a modal — scenario 5 (`FR-049`, research D-4)

### Implementation for User Story 2

- [X] T061 [US2] Implement environment validation in `src/features/auth/server/bootstrap.ts` — `APP_URL` present and parseable or the app refuses to start, `ADMIN_EMAIL` a valid address where seeding will run, `ADMIN_PASSWORD` held to the shared policy, and the database reachable (`FR-058`)
- [X] T062 [US2] Implement the seed transaction in `src/features/auth/server/bootstrap.ts`: skip whenever any `user` row exists, otherwise write one admin with the address folded and `must_change_password` set, catching a unique violation as "already seeded"
- [X] T063 [US2] Wire the refused-first-run-seed event and the non-zero exit into `src/features/auth/server/bootstrap.ts` through `src/features/auth/server/log.ts` (`FR-064`, `FR-046`)
- [X] T064 [US2] Implement `src/instrumentation.ts` — `register()` guarded by `NEXT_RUNTIME === 'nodejs'`, dynamically importing bootstrap, with a module-level flag making a second call a no-op
- [X] T065 [P] [US2] Implement `src/features/auth/components/must-change-password-banner.tsx`, delivered here and rendered by no page in this slice — it belongs on authenticated screens and R2 builds the slot
- [X] T066 [US2] Assert in `src/features/auth/server/bootstrap.test.ts` that seeding is the only path setting `must_change_password`, and that every other account-creating path defaults it to false; the two clearing paths land in `src/features/auth/actions.ts` (T081) and `scripts/admin-grant.ts` (T111) (`FR-048`, `FR-050`)

**Checkpoint**: an empty box reaches a signed-in admin using T046…T054 and this phase alone, in under ten minutes — `SC-001`.

---

## Phase 5: User Story 3 — Someone who forgot their password gets back in (P3)

**Goal**: the self-service recovery loop, ending every session the holder had.

**Independent Test**: request a reset for a known address and for an unknown one and confirm the two
answers are identical; follow the emailed link, set a compliant password, and confirm every prior
session is dead and the new password signs in.

### Tests for User Story 3

- [ ] T067 [P] [US3] Failing test in `src/features/auth/server/reset-tokens.test.ts` asserting a token is 32 CSPRNG bytes stored as a digest, expires one hour after issue, and resolves to `valid`, `used`, `expired` or `unknown` — with used checked before expired, so a token that is both reports used (`FR-033`, `FR-036`, research C-8)
- [ ] T068 [US3] Extend `src/features/auth/server/reset-tokens.test.ts`: spending is the conditional `UPDATE … WHERE used_at IS NULL`, zero rows affected rolls the whole transaction back, that two concurrent spends of one token leave exactly one winner, and that spending one of **two outstanding tokens for the same address leaves the other usable** until it expires or is used — the specification withdraws no sibling — scenario 7 (`FR-037`, spec Assumptions)
- [ ] T069 [P] [US3] Failing test in `src/features/auth/actions.test.ts` asserting `requestPasswordReset` returns the same `sent` answer for a known and an unknown address, mails only where the address belongs to an account that may sign in, and never changes its answer because mail failed — scenarios 1 and 2 (`FR-031`, `FR-033`, `SC-003`)
- [ ] T070 [US3] Extend `src/features/auth/actions.test.ts`: `completePasswordReset` returns `mismatch` on differing fields and `policy` naming the one rule that failed, writing nothing in either case — scenarios 4 and 5 (`FR-035`, `FR-027`)
- [ ] T071 [US3] Extend `src/features/auth/actions.test.ts`: a completed reset writes the hash, clears `must_change_password`, deletes **every** session for that user including the requesting one, and redirects to `/signin?reset=done`, all in one transaction — scenarios 6 and 10 (`FR-038`, `FR-050`, `SC-008`)
- [ ] T072 [US3] Extend `src/features/auth/actions.test.ts`: a token whose owner may no longer sign in is spent, writes no password, and returns `unknown` rather than naming the account's condition (`FR-066`)
- [ ] T073 [US3] Extend `src/features/auth/actions.test.ts`: both actions call `assertSameOrigin()` as their first statement, both refuse an over-long address or password before any lookup, and both derive their subject from stored rows rather than from a client-supplied identifier (`FR-023`, `FR-024`, `FR-063`)
- [ ] T074 [P] [US3] Failing test in `src/features/auth/server/mail.test.ts` asserting the reset link is an absolute URL built from `APP_URL`, that the mail is sent from `MAIL_FROM`, and that an unset `MAIL_FROM` or an unreachable transport logs the failure and sends nothing while the caller's answer is unchanged (`FR-033`, `FR-065`, `FR-064`)
- [ ] T075 [P] [US3] Failing test in `src/features/auth/components/reset-request-form.test.tsx` covering the form, in-flight and the single confirmation state, identical either way, and asserting the card carries an email field and a "Send reset link" control and nothing else (`FR-030`)
- [ ] T076 [P] [US3] Failing test in `src/features/auth/components/change-password-form.test.tsx` covering the two fields, mismatch, the three policy failures, and the expired, used and unknown states — asserting the three token states are distinguishable from one another and each offers the same route back to `/reset` — scenarios 3, 8 and 9 (`FR-034`, `FR-036`, `OT-SEC-016`)
- [ ] T077 [P] [US3] Failing test in `src/app/(auth)/reset/page.test.tsx` asserting the route serves both screens on `searchParams.token`, that an empty or malformed token renders `unknown` **without a lookup** rather than falling back to the request form, and that the token value is never echoed into the rendered HTML (`FR-067`)

### Implementation for User Story 3

- [ ] T078 [US3] Implement `src/features/auth/server/reset-tokens.ts` — issue, resolve state, and the atomic spend
- [ ] T079 [US3] Implement `src/features/auth/server/mail.ts` — one `nodemailer` transport from operator-supplied SMTP, sending the reset link and nothing else in this feature
- [ ] T080 [US3] Implement `requestPasswordReset` in `src/features/auth/actions.ts`, the module carrying top-level `"use server"`
- [ ] T081 [US3] Implement `completePasswordReset` in `src/features/auth/actions.ts` — one transaction spending the token, writing the hash, clearing the flag and deleting every session
- [ ] T082 [P] [US3] Implement `src/features/auth/components/reset-request-form.tsx`
- [ ] T083 [P] [US3] Implement `src/features/auth/components/change-password-form.tsx` with the copy research A-10 proposes for the three token states
- [ ] T084 [US3] Implement `src/app/(auth)/reset/page.tsx`, discriminating on `searchParams.token` and resolving the state server-side

**Checkpoint**: the forgotten-password loop runs end to end — `SC-008`, `SC-009`.

---

## Phase 6: User Story 4 — The installation resists credential guessing (P4)

**Goal**: two independent durable limits, per address and per IP, in two independent flows, plus the
sweep that keeps the tables bounded.

**Independent Test**: fail five sign-ins for one address and confirm the sixth is refused with a
remaining time; fail twenty from one IP across twenty addresses and confirm the twenty-first is
refused; restart the app mid-lockout and confirm the lockout survives.

**Integrates with US1 and US3**: this phase adds the attempt-row writing and the refusal check to the
sign-in handler and the reset action those stories delivered.

### Tests for User Story 4

- [ ] T085 [P] [US4] Failing test in `src/features/auth/server/throttle.test.ts` asserting refusal at five for `kind = 'email'` and twenty for `kind = 'ip'`, counted over fifteen minutes for one `(flow, kind, subject)` taken together, each refusal stating the remaining time — scenarios 1 and 2 (`FR-039`, `FR-042`, `SC-005`)
- [ ] T086 [US4] Extend `src/features/auth/server/throttle.test.ts`: `retryAfterSeconds` derives from the **oldest** attempt still inside the window, and where both limits hold the **later** of the two clearing instants is reported (`FR-039`, `FR-068`)
- [ ] T087 [US4] Extend `src/features/auth/server/throttle.test.ts`: the `signin` and `reset` flows never share a counter, in both directions — scenarios 3 and 4 (`FR-040`, `SC-007`)
- [ ] T088 [US4] Extend `src/features/auth/server/throttle.test.ts`: a refused attempt records **no** row, so a refusal cannot extend the window that produced it (`FR-041`)
- [ ] T089 [US4] Extend `src/features/auth/server/throttle.test.ts`: a successful sign-in clears that address's `('signin','email')` rows only, leaving its reset rows and the originating IP's rows — scenario 5 (`FR-018`)
- [ ] T090 [US4] Extend `src/features/auth/server/throttle.test.ts`: two transactions racing the fifth failure serialize on `pg_advisory_xact_lock` and cannot both pass — the spec's edge case, run against real PostgreSQL (research C-5)
- [ ] T091 [US4] Extend `src/features/auth/server/throttle.test.ts`: counters survive a restart, since they are rows — scenario 6 (`FR-043`, `SC-006`)
- [ ] T092 [P] [US4] Failing test in `src/features/auth/server/sweep.test.ts` asserting the three deletes match only rows already dead, that the sweep and a live sign-in touching `auth_attempt` at once cannot remove a row inside the live window, and that no live behaviour changes when it runs — scenario 7 (`FR-044`, research C-6)
- [ ] T093 [US4] Extend `src/features/auth/server/sweep.test.ts`: the interval is five minutes and not configurable, a sweep that throws is logged and does **not** stop the timer, and `SIGTERM` clears the timer while letting a running sweep finish (`FR-069`, `FR-070`, `FR-071`)
- [ ] T094 [US4] Extend `src/app/api/auth/signin/route.test.ts`: a refused attempt returns `throttled` with `retryAfterSeconds` and performs **no** credential check, and a reset request for an address that never had an account still records a row — scenario 8 (`FR-032`, `FR-039`)
- [ ] T095 [P] [US4] Failing test asserting the sign-in screen renders `retryAfterSeconds` as whole minutes **rounded up**, so a refusal in force never reads as no wait at all, in `src/features/auth/components/sign-in-form.test.tsx` (`FR-039`, research A-10)
- [ ] T096 [P] [US4] Failing test asserting the reset-request screen renders its own throttled state, in `src/features/auth/components/reset-request-form.test.tsx` (`FR-087`)

### Implementation for User Story 4

- [ ] T097 [US4] Implement `src/features/auth/server/throttle.ts` — `assertNotThrottled`, `recordFailure` and `clearSignInAttempts`, with count, decision and insert in one transaction under the advisory lock
- [ ] T098 [US4] Wire the throttle into `src/app/api/auth/signin/route.ts` between address validation and the credential check, recording one `('signin','email')` and one `('signin','ip')` row on rejection and clearing on success
- [ ] T099 [US4] Wire the throttle into `requestPasswordReset` in `src/features/auth/actions.ts`, recording one `('reset','email')` and one `('reset','ip')` row on **every** request without exception (`FR-032`)
- [ ] T100 [US4] Wire the throttle-refusal event from `src/features/auth/server/throttle.ts` into `src/features/auth/server/log.ts` (`FR-064`)
- [ ] T101 [US4] Implement `src/features/auth/server/sweep.ts` — the three deletes — and start it from bootstrap as the installation's **only** `setInterval`, `unref()`d and cleared on `SIGTERM`
- [ ] T102 [P] [US4] Render the rounded-up minutes in `src/features/auth/components/sign-in-form.tsx`
- [ ] T103 [P] [US4] Render the throttled state in `src/features/auth/components/reset-request-form.tsx`

**Checkpoint**: both limits hold in both flows, survive a restart, and the tables stay bounded.

---

## Phase 7: User Story 5 — An operator administers accounts from the box (P5)

**Goal**: the break-glass path, and the only route to a role change in v1.

**Independent Test**: run the grant command against a fresh address and confirm an admin exists with
the password typed at the prompt; run it against an existing member and confirm promotion, a cleared
deactivation and a cleared flag; run the deactivate command against the only active admin and
confirm refusal. Nothing here needs US3 — the session deletion it calls is Foundational (T030).

### Tests for User Story 5

- [ ] T104 [P] [US5] Failing test in `src/features/auth/server/admin-guard.test.ts` asserting `withLastAdminGuard` locks the active-admin set with `SELECT … FOR UPDATE` inside the caller's transaction and refuses a change that would empty it, and that two concurrent attempts to close the last admin leave at least one active — scenarios 6 and 7 (`FR-056`, `SC-012`)
- [ ] T105 [P] [US5] Failing test in `scripts/admin-grant.test.ts` asserting a fresh address creates an admin, a member is promoted with its password replaced and `deactivated_at` and `must_change_password` cleared, a deactivated account is reopened, and an address that is already an active admin has its password replaced without error — scenarios 1, 2 and 8 (`FR-051`, `FR-077`)
- [ ] T106 [US5] Extend `scripts/admin-grant.test.ts`: the password is read from the terminal and never accepted as an argument, `--password=…` is an unrecognised flag that writes nothing and exits `2`, and a terminal that cannot suppress echo makes the command refuse to prompt — scenario 4 (`FR-052`, `FR-075`, `FR-076`)
- [ ] T107 [US5] Extend `scripts/admin-grant.test.ts`: a short or blocklisted password is refused naming the one rule that failed, with nothing written — no partial user row, no credential — scenario 3 (`FR-053`)
- [ ] T108 [P] [US5] Failing test in `scripts/admin-deactivate.test.ts` asserting the command sets `deactivated_at`, deletes every session for that user, never deletes the `user` row, and refuses an address with no account while naming it — scenario 5 (`FR-007`, `FR-054`, `FR-057`, `FR-078`, `SC-013`)
- [ ] T109 [US5] Extend `scripts/admin-grant.test.ts` and `scripts/admin-deactivate.test.ts`: exit `0` with one line on stdout on success, `1` with one line on stderr on an actionable refusal, `2` on a usage error, and nothing written to the database on `1` or `2` (`FR-074`)

### Implementation for User Story 5

- [ ] T110 [US5] Implement `src/features/auth/server/admin-guard.ts` — `withLastAdminGuard`, shared with R3's `deactivateUser`
- [ ] T111 [US5] Implement `scripts/admin-grant.ts` using `node:util`'s `parseArgs` in strict mode and `node:readline`'s hidden input, with the app's environment loaded through `@next/env`
- [ ] T112 [US5] Implement `scripts/admin-deactivate.ts`, reusing `deleteAllSessionsForUser()` from T030 and `withLastAdminGuard`
- [ ] T113 [US5] Failing test in `src/features/auth/role-surface.test.ts` asserting no route, page or Server Action in the feature writes `user.role` — the whole role-change surface is `scripts/admin-grant.ts` (`FR-055`, `OT-AUTHZ-011`)

**Checkpoint**: all five stories are independently functional.

---

## Phase 8: Polish & cross-cutting concerns

- [ ] T114 Failing test in `src/features/auth/read-boundary.test.ts` asserting no query outside `src/features/auth/server/` names `credential`, `session`, `reset_token` or `auth_attempt`, and that no unauthenticated route selects `publicUser` or `accountUser` — the read boundary `FR-005` and `FR-015` establish, asserted rather than reviewed
- [ ] T115 Failing test in `src/features/auth/no-secret-leaks.test.ts` asserting no response body, cookie value or log line carries a password, a hash, a session token or a reset token — greppable because `FR-064` bounds the log to five events (`SC-010`)
- [ ] T116 [P] Add the unhandled-server-error path to `src/features/auth/server/log.ts` and confirm responses to callers stay generic while SQL, stack traces and configuration stay server-side (`FR-025`, `FR-064`)
- [ ] T117 [P] Confirm the screens under `src/app/(auth)/` meet WCAG 2.2 Level AA against the tokens in `src/app/globals.css` — the contrast pairs T008 re-measured, the 1024px floor (`FR-080`), the 24×24 target-size minimum, and focus visibility on every control — `FR-012`, `FR-082`, `FR-083`, `FR-086`
- [ ] T118 Run the ten walkthroughs in [`quickstart.md`](./quickstart.md) end to end against a real box, timing walkthrough 1 against the ten-minute bound (`SC-001`) and walkthrough 5 against the three-minute bound (`SC-009`), and record any that do not hold
- [ ] T119 Run `npm run verify` — `style-check`, `type-check`, `test`, `build` — and confirm gates 5 and 8 pass with nothing failing or skipped
- [ ] T120 Confirm gate 6 by reading the whole diff with `git diff main...HEAD`: no comments, no commented-out code, no dead code, and the plan's three declared Complexity Tracking exceptions — the unmounted banner, the caller-less `accountUser`, and `user`'s six unread columns — are the only ones present

---

## Dependencies & execution order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: depends on Foundational only
- **US2 (Phase 4)**: depends on Foundational only. Demonstrating scenario 5 end to end also wants US1
- **US3 (Phase 5)**: depends on Foundational only
- **US4 (Phase 6)**: depends on Foundational, and integrates into US1's route handler and US3's action
- **US5 (Phase 7)**: depends on Foundational only, reusing `deleteAllSessionsForUser()` from T030
- **Polish (Phase 8)**: depends on every story that is being shipped

### Within each story

Tests are written and observed failing before their implementation. Schema before modules, modules
before entry points, entry points before screens.

### Parallel opportunities

- T002, T005, T006 in Setup
- T009–T012, the four schema tests, then every `[P]` module test pair in Foundational
- Within a story, the `[P]` test tasks touching different files
- Once Foundational lands, US1, US2, US3 and US5 can all proceed in parallel by different people —
  `deleteAllSessionsForUser()` is Foundational precisely so US3 and US5 do not queue behind each
  other. US4 alone is not parallel: it wires into the entry points US1 and US3 build

---

## Parallel example: Foundational

```bash
# The four schema tests, all different files:
Task: "Schema conventions test in src/db/schema.test.ts"
Task: "CHECK bound test in src/db/constraints.test.ts"
Task: "Folded uniqueness test in src/db/user-uniqueness.test.ts"
Task: "Migration and index test in src/db/migration.test.ts"

# Then the shared-module test pairs, all different files:
Task: "Crypto test in src/features/auth/server/crypto.test.ts"
Task: "Password policy test in src/features/auth/server/password-policy.test.ts"
Task: "Origin test in src/features/auth/server/origin.test.ts"
Task: "Projections test in src/features/auth/server/projections.test.ts"
Task: "Sessions test in src/features/auth/server/sessions.test.ts"
```

---

## Implementation strategy

### MVP first — User Story 1 only

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 User Story 1
4. **Stop and validate**: quickstart walkthroughs 2, 3 and 10 hold
5. A holder can sign in and stay signed in. Nothing else in the product exists yet, and nothing else
   needs to

### Incremental delivery

1. Setup + Foundational → the schema, the shared modules and the layout
2. **+ US1** → sign-in works — MVP
3. **+ US2** → an empty box reaches a signed-in admin — `SC-001`, and R2 is unblocked
4. **+ US3** → the recovery loop closes
5. **+ US4** → the public routes stop being freely guessable
6. **+ US5** → the break-glass path exists

Each step adds capability without breaking the one before it.

### Parallel team strategy

Setup and Foundational are done together — they are the shared ground. Afterwards US1, US2 and US5
are all independent of one another. US4 goes last because it wires into what US1 and US3 built.

---

## Notes

- `[P]` means different files and no dependency on an incomplete task
- Every task names its file. Requirements are cited on the **test** task of each test/implementation
  pair; the implementation task inherits them from the test it makes pass, which is the same pairing
  gate 1 asks a reviewer to read the commit order for
- The commit order is the evidence gate 1 reads: a reviewer who cannot tell from the diff that the
  test came first must ask for that evidence before approving
- `npm test` runs with `--passWithNoTests`, so a green run is not by itself evidence of Principle VII
- Persistence tasks run against a real PostgreSQL named by `TEST_DATABASE_URL`; no mock stands in
  for a constraint, a lock or a cascade
- Time is passed as an argument, never faked globally — the throttle window is enforced in SQL with
  `now()`, which a process-clock fake would not move (research D-3)
