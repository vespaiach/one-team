---

description: "Task list for R3 — Accounts and invitations"
---

# Tasks: Accounts and invitations

**Input**: design documents in [`specs/003-accounts-invitations/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md), [`data-model.md`](./data-model.md), [`contracts/`](./contracts/)

**Tests are not optional here.** [`AGENTS.md`](../../AGENTS.md) Principle **VII** is non-negotiable and
gate **1** requires a test written first and observed failing. Every implementation task below is
preceded by the Red task that must fail before it, and the pairing is the evidence a reviewer reads.
The five **🛡 Guard** tasks are the one declared exception — they assert invariants over code this
feature does not write, so no implementation follows them and none can be Red. They are named as such
here and recorded in [`plan.md`](./plan.md)'s *Complexity Tracking*, rather than passing themselves off
as Red steps that happen to go green on the first run.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `US1`…`US4`, mapping to the four user stories in [`spec.md`](./spec.md)
- **⛔ R2**: cannot start until roadmap entry **R2** lands. There is no `src/app/(app)/`, no shell, no
  `ScreenHeader` and no `forbidden.tsx` in the tree today ([`plan.md`](./plan.md), *Technical Context*)
- **🛡 Guard**: an invariant assertion over behaviour this feature does not itself implement — R1's
  code, a constraint already in place, or the absence of something anywhere in the tree. A guard
  **cannot be Red**: it passes the moment it is written, and its value is that it fails later, when
  someone changes what it watches. It is the one declared exception to Principle **VII**, recorded in
  [`plan.md`](./plan.md)'s *Complexity Tracking* so a reviewer meets it there. Every other task below
  is a Red or the Green that answers it

## Path conventions

One Next.js project. Tests are **colocated** with their subject, as entry R1 already does:
`src/features/accounts/server/roster.ts` is tested by `src/features/accounts/server/roster.test.ts`.
Vitest runs two projects — `server` (node, `*.test.ts`, real PostgreSQL, `fileParallelism: false`)
and `ui` (jsdom, `*.test.tsx`).

**No async Server Component is put in the render tree.** R1's page tests `await Page({...})` and
render the returned JSX with the server modules mocked; every page task below follows that pattern
([`research.md`](./research.md) D-6).

---

## Phase 1: Setup

**Purpose**: the one repository-level change this feature needs. The project is already initialized.

- [ ] T001 Replace `"react-aria-components": "^1.20.0"` with the exact pin `"1.20.0"` in `package.json` and reinstall, so the `UNSTABLE_`-prefixed toast API cannot move under this feature in a minor release ([`research.md`](./research.md) E-1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the one new table, the guard that keeps R1's sweep off it, and the five promotions out of
entry R1's delivered code. Every user story below depends on this phase.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### The `invite` table

Write all three Red tasks before T005. Each fails first because the table does not exist, and each
states a distinct claim — shape, index definition, and enforced behaviour.

- [ ] T002 [P] Red: assert `invite`'s eight columns, their types and their nullability in `src/db/schema.test.ts` — `accepted_at` nullable and every other column not null (data-model §1)
- [ ] T003 [P] Red: assert both index definitions in `src/db/migration.test.ts` — unique on `token_digest`, and `invite_email_lower_unspent_idx` unique and **partial** on `lower(email) WHERE accepted_at IS NULL` (FR-009a, FR-014)
- [ ] T004 [P] Red: assert enforced behaviour in `src/db/constraints.test.ts` — a second unspent row for one case-folded address is rejected, a second row is accepted once the first is spent, the digest must be 64 characters and the email at most 200 (FR-009a, FR-010)
- [ ] T005 Add the `invite` table with both indexes and both check constraints to `src/db/schema.ts`, keying on UUIDv7 and cascading `invited_by` to `user.id` (FR-009a, FR-014, FR-018)
- [ ] T006 Run `npm run db:generate`, inspect the emitted SQL, and commit `drizzle/0002_*.sql` with its `meta` entry; apply it with `npm run db:migrate`
- [ ] T007 Add `"invite"` to `TRUNCATED_TABLES` in `src/db/test-database.ts`, placed **before** `"user"` so the truncation order stays child-first — T004 goes green here
- [ ] T008 🛡 Guard · Assert `sweep()` deletes no `invite` row, spent or expired, by extending `src/features/auth/server/sweep.test.ts`. R1's timer already deletes `reset_token` rows `where used_at is not null or expires_at < now` — the sibling table follows the **opposite** convention, and this assertion is the only thing standing between that statement and `invite` joining it (FR-031a, SC-004, B-4)

### Five promotions out of entry R1

Each is Principle I's second call site arriving, not a tidiness refactor. None changes existing
behaviour, and R1's own tests must stay green through all five ([`research.md`](./research.md) F).
`TOKEN_SHAPE` travels with `classifyToken` under F-1 because it is the same convention: R1 gates the
token's shape in `reset/page.tsx` before it queries, and a copied regex is the drift F-1 exists to
prevent. It is a page-level gate at both routes, not a server-module one.

- [ ] T009 [P] Red: assert `classifyToken`'s four-state ordering — **used beats expired** for a token that is both — and that `TOKEN_SHAPE` is exported and accepts exactly what R1's reset page accepts today, in a new `src/features/auth/server/token-state.test.ts` (FR-032, B-1, F-1)
- [ ] T010 Extract `classifyToken` **and `TOKEN_SHAPE`** into `src/features/auth/server/token-state.ts`; refactor `resolveResetTokenState` in `src/features/auth/server/reset-tokens.ts` onto the first and `src/app/(auth)/reset/page.tsx` onto the second, leaving `src/features/auth/server/reset-tokens.test.ts` and `src/app/(auth)/reset/page.test.tsx` green (F-1)
- [ ] T011 [P] Red: assert `isUniqueViolation` recognises `23505` through the `postgres` driver's wrapped `error.cause` in a new `src/db/unique-violation.test.ts` (F-2)
- [ ] T012 Promote `isUniqueViolation` out of `src/features/auth/server/bootstrap.ts` into `src/db/unique-violation.ts` and import it back, leaving `src/features/auth/server/bootstrap.test.ts` green (F-2)
- [ ] T013 [P] Red: assert `sendMail` returns `"sent" | "not_sent"` and never throws, including when `SMTP_URL` or `MAIL_FROM` is unset, in a new `src/lib/mail.test.ts` (F-3, B-6)
- [ ] T014 Promote the SMTP transport into `src/lib/mail.ts` and reduce `src/features/auth/server/mail.ts` to composition, still discarding the outcome so the reset's answer cannot vary with whether an address exists (F-3, `OT-SEC-011`)
- [ ] T015 [P] Red: assert `issueSession` writes through a caller-supplied executor, matching `deleteAllSessionsForUser`'s existing signature, in `src/features/auth/server/sessions.test.ts` (F-4)
- [ ] T016 Give `issueSession` an optional executor and extract `SESSION_COOKIE_OPTIONS` in `src/features/auth/server/sessions.ts`, leaving `src/app/api/auth/signin/route.test.ts` green as the extraction's proof (F-4, F-5)

**Checkpoint**: the table exists, the five promotions have landed, and every user story can start.

---

## Phase 3: User Story 1 — An admin offers someone a login (Priority: P1) 🎯 MVP

**Goal**: an admin can invite one address, see the offer listed with its issuer and its two instants,
resend it, revoke it, and be refused with the fitting remedy when the address is already spoken for.

**Independent Test**: sign in as the seeded admin, invite a fresh address, and confirm one invitation
appears carrying its issuer, its sent instant and an expiry seven days out, and that a link was
mailed. Re-submit the same address and confirm the form offers resend. Submit the admin's own address
and confirm the form names the existing account. Revoke and confirm the row goes.

### Server — buildable today

- [ ] T017 [P] [US1] Red: `issueInvitation` writes one row whose `expires_at` is seven days out, stores only the SHA-256 digest of R1's `issueToken()`, and records the calling admin — `src/features/accounts/server/invitations.test.ts` (FR-013, FR-014)
- [ ] T018 [US1] Implement `issueInvitation` in `src/features/accounts/server/invitations.ts` (FR-013, FR-014, FR-015)
- [ ] T019 [US1] Red: `resendInvitation` replaces the digest and restarts the seven days **on the existing row**, touches `updated_at`, and refuses a row that is missing or already accepted — `src/features/accounts/server/invitations.test.ts` (FR-020, FR-020a, FR-021a)
- [ ] T020 [US1] Implement `resendInvitation` in `src/features/accounts/server/invitations.ts` (FR-020, FR-020a)
- [ ] T021 [US1] Red: `revokeInvitation` deletes an unspent row and **refuses a spent one**, writing nothing, so revoke can never destroy what FR-031a retains — `src/features/accounts/server/invitations.test.ts` (FR-021, FR-021a)
- [ ] T022 [US1] Implement `revokeInvitation` in `src/features/accounts/server/invitations.ts` (FR-021, FR-021a)
- [ ] T023 [P] [US1] Red: `listOutstandingInvitations` excludes spent rows, orders `created_at` then `id` descending so two renders agree, computes `isExpired` against one `now`, carries `invitedByName` for a deactivated inviter, and **never selects `tokenDigest`** — `src/features/accounts/server/roster.test.ts` (FR-018, FR-015, FR-022)
- [ ] T024 [US1] Implement `listOutstandingInvitations` returning `InvitationRow[]` in `src/features/accounts/server/roster.ts` (FR-018, data-model §3)
- [ ] T025 [P] [US1] Red: `sendInvitationMail` returns its outcome, and the message carries the installation, that an administrator issued it, the link and the expiry instant — and names **neither the issuing admin nor any other account** — `src/features/accounts/server/mail.test.ts` (FR-013a, FR-017)
- [ ] T026 [US1] Implement `sendInvitationMail` in `src/features/accounts/server/mail.ts` over `src/lib/mail.ts`, building the link from `APP_URL` (FR-013a, FR-017)
- [ ] T027 [P] [US1] Red: `checkInviteAddress` returns each of `AddressCheck`'s four shapes, folds case at both ends, distinguishes a deactivated account from an active one, and refuses a non-admin caller — `src/features/accounts/actions.test.ts` (FR-006, FR-008a, FR-010, FR-060)
- [ ] T028 [US1] Implement `checkInviteAddress` in `src/features/accounts/actions.ts` behind the origin check and `parseEmail` (FR-006, FR-008, FR-008a, FR-009, FR-060)
- [ ] T029 [US1] Red: `inviteUser` runs the prelude then returns `created`, `malformed`, `has_account` or `has_invitation`; **two admins submitting one address concurrently leave exactly one row and the loser is offered resend rather than an error**; the screen is revalidated — `src/features/accounts/actions.test.ts`, against real PostgreSQL (FR-009a, FR-012, FR-056, US1 s17)
- [ ] T030 [US1] Implement `inviteUser` in `src/features/accounts/actions.ts`, turning `23505` on the partial index into FR-009's resend offer and riding the mail outcome back in the result (FR-009a, FR-012, FR-017)
- [ ] T031 [US1] Red: `resendInvite` and `revokeInvite` each require `isAdmin`, derive the invitation from its stored row, refuse a member with nothing written, and revalidate — `src/features/accounts/actions.test.ts` (FR-012, FR-060, US1 s11)
- [ ] T032 [US1] Implement `resendInvite` and `revokeInvite` in `src/features/accounts/actions.ts` (FR-012, FR-019, FR-056)

### Screen — ⛔ blocked on R2

- [ ] T033 [P] [US1] ⛔ R2 · Red: `invitations-table.tsx` shows address, inviter, sent and expires with both controls, marks an expired row **in text rather than colour alone** while still offering Resend, and renders exactly `No outstanding invitations` when empty — `src/features/accounts/components/invitations-table.test.tsx` (FR-018, FR-019, FR-022, FR-023)
- [ ] T034 [US1] ⛔ R2 · Implement `src/features/accounts/components/invitations-table.tsx` as a synchronous component over `InvitationRow[]` (FR-018, FR-019, FR-022, FR-023)
- [ ] T035 [P] [US1] ⛔ R2 · Red: `invitations-skeleton.tsx` renders the same regions, the same row count and the same dimensions as the table it replaces, so nothing shifts — `src/features/accounts/components/invitations-skeleton.test.tsx` (FR-055)
- [ ] T036 [US1] ⛔ R2 · Implement `src/features/accounts/components/invitations-skeleton.tsx` (FR-055, `OT-UX-005`)
- [ ] T037 [P] [US1] ⛔ R2 · Red: the toast region carries all four kinds, renders top-right, stacks newest nearest the corner, auto-dismisses at five seconds and gives **every** toast a dismiss control — `src/features/accounts/components/toast-region.test.tsx` (FR-054, R2 FR-034)
- [ ] T038 [US1] ⛔ R2 · Implement `src/features/accounts/components/toast-region.tsx` on `UNSTABLE_ToastRegion` and `UNSTABLE_ToastQueue` (FR-054, `OT-UX-016`)
- [ ] T039 [P] [US1] ⛔ R2 · Red: the banner reads `Can't reach the server. Reconnecting.`, writes are refused with `Changes need a connection`, nothing is queued, and it appears only for a **transport** failure — never for a refusal the server itself returned — clearing on the next request that lands — `src/features/accounts/components/connection-banner.test.tsx` (FR-057, R2 FR-035)
- [ ] T040 [US1] ⛔ R2 · Implement `src/features/accounts/components/connection-banner.tsx` (FR-057, `OT-UX-017`)
- [ ] T041 [US1] ⛔ R2 · Red: the Invite modal carries one field and nothing else, validates on blur per field, renders all four inline refusals, keeps submit **enabled** while a field is invalid, discards on Cancel and Escape, does **not** close on an outside press, and shows in-flight state only while the write is outstanding — `src/features/accounts/components/invite-modal.test.tsx` (FR-005…FR-011, FR-059)
- [ ] T042 [US1] ⛔ R2 · Implement `src/features/accounts/components/invite-modal.tsx` (FR-005…FR-011, FR-059)
- [ ] T043 [US1] ⛔ R2 · Red: the screen selects Invitations on arrival, **no write moves the tab**, the toast region and the banner sit at page level so an outcome raised on one tab is seen from the other, and FR-008's control closes the modal, discards the field, switches the tab, moves focus to the row, announces the account it reached and marks the row by more than colour — with no URL change and no history entry, and with steps 4 and 5 happening whether or not scrolling was needed — `src/features/accounts/components/accounts-screen.test.tsx` (FR-003, FR-003a, FR-008, FR-008b, US1 s15, s16)
- [ ] T044 [US1] ⛔ R2 · Implement `src/features/accounts/components/accounts-screen.tsx` holding `selectedKey` and the highlighted account id (FR-003, FR-003a, FR-008, FR-008a, FR-008b)
- [ ] T045 [US1] ⛔ R2 · Replace the body of `src/app/(app)/settings/accounts/page.tsx`, keeping R2's `requireActor()` then `forbidden()` guard as its first statements and passing plain data to `accounts-screen.tsx`; add no `loading.tsx` above the guard (FR-001, FR-002, E-3)

**Checkpoint**: an admin can issue, list, resend and revoke an invitation, and the form refuses a
duplicate with the remedy that fits.

---

## Phase 4: User Story 2 — An invited person accepts and is inside (Priority: P2)

**Goal**: the mailed link creates the account and signs the holder in, and a dead link says which of
the three things happened to it.

**Independent Test**: seed one live invitation, open its link, complete the form, and confirm a `user`
row exists, a session is live, and the browser is inside the app. Open the same link again and confirm
the "already used" state. Repeat with an invitation seeded past its expiry, and with a token string
that matches nothing.

**Not blocked on R2.** `/invite/accept` joins entry R1's existing `(auth)` group, whose layout is
already the full-screen card outside the shell that FR-025 requires. This phase is buildable in full
today, which makes it the natural slice to build alongside US1's server half.

**Both acceptance Red tasks precede the one implementation**, as T002–T004 precede T005 and for the
same reason: a race test written after the mechanism that defeats the race passes on its first run,
and Principle **VII** says that is not a Red step. T050 and T051 both fail before T052 exists — the
first on the unit claims, the second on the three races — and T052 is what turns both green.

- [ ] T046 [P] [US2] Red: the proxy matcher exempts `invite/accept` while still redirecting every other unauthenticated path — `src/proxy.test.ts` (FR-024, `OT-SEC-002`)
- [ ] T047 [US2] Add `invite/accept$` to the matcher in `src/proxy.ts`, opening the fourth and last public route (FR-024)
- [ ] T048 [P] [US2] Red: `resolveInvitationState` returns valid, used, expired and unknown, **used beating expired**, with a revoked row and a token superseded by a resend both reading unknown; and `spendInvitation` spends only an unspent row, returning the row it spent or nothing — `src/features/accounts/server/invitations.test.ts` (FR-031, FR-032, B-2, B-3)
- [ ] T049 [US2] Implement `resolveInvitationState` over the shared `classifyToken`, and `spendInvitation` as `update … where accepted_at is null returning *`, both in `src/features/accounts/server/invitations.ts` — the conditional spend is the mechanism holding FR-031, and it lives in `server/` with the rest of this feature's persistence (FR-031, FR-032)
- [ ] T050 [US2] Red: `acceptInvitation` calls `spendInvitation` and writes `user`, `credential` and `session` in **one transaction**; the account is `member` with `must_change_password` false; the password policy runs on the server whatever the form allowed; the cookie is set and `/home` is the destination; a zero-row spend returns `used`; a `23505` on `user_email_lower_idx` returns `taken`; **no `user` row is read at any point**; and a session the caller already held is neither reused, extended nor deleted — `src/features/accounts/actions.test.ts` (FR-024b, FR-027…FR-031, FR-033, FR-034)
- [ ] T051 [US2] Red: the three acceptance races against real PostgreSQL — one link accepted in two tabs yields one `user` row and one `used`; an address that acquired an account between issue and acceptance is refused with `taken`; revoke racing acceptance leaves the row dropped **or** spent and never both — `src/features/accounts/actions.test.ts` (SC-005, FR-021a, FR-034, US2 s9)
- [ ] T052 [US2] Implement `acceptInvitation` in `src/features/accounts/actions.ts`, turning both T050 and T051 green (FR-027…FR-031, FR-033, FR-034, FR-024b)
- [ ] T053 [P] [US2] Red: the acceptance form shows the invited address as a **value rather than a control**, carries one password field and not two, reports which policy rule failed, and shows in-flight state that will not take a second submission — `src/features/accounts/components/accept-invitation-form.test.tsx` (FR-026, FR-027, FR-028a)
- [ ] T054 [US2] Implement `src/features/accounts/components/accept-invitation-form.tsx` together with the used, expired, unknown and taken states, each visibly distinct and each following R1's `ChangePasswordForm` shape — a heading, one sentence and a route onward (FR-026, FR-028a, FR-032, FR-034)
- [ ] T055 [US2] Red: the route gates the token on the promoted `TOKEN_SHAPE` **before any query** — a malformed string renders unknown with `resolveInvitationState` never called, exactly as `src/app/(auth)/reset/page.test.tsx` already asserts for the reset route — then renders either the form or one dead-link state, reads no `user` record, and never carries the token into an outgoing reference — `src/app/(auth)/invite/accept/page.test.tsx`, awaiting the page and rendering its JSX (FR-024a, FR-025, FR-032, FR-033, FR-060)
- [ ] T056 [US2] Create `src/app/(auth)/invite/accept/page.tsx` as a thin wrapper over the synchronous form, with the `TOKEN_SHAPE` gate as its first statement (FR-024, FR-025, FR-032, FR-033, FR-060, D-6)

**Checkpoint**: an invitation can be taken, and a dead one explains itself. With US1's server half this
is a working loop end to end, without a screen.

---

## Phase 5: User Story 3 — An admin sees who is on the team (Priority: P3)

**Goal**: the Accounts tab reads the whole team on one page, active before closed, with the email
column that only this screen may show.

**Independent Test**: seed several accounts, some deactivated, and confirm the tab lists all of them,
active before deactivated, each showing name, email, role, joined date and a project count.

- [ ] T057 [P] [US3] Red: `loadRoster` returns active accounts before closed, orders by display name under **one fixed collation that does not follow the request locale**, breaks ties by the unique address, selects through `accountUser` and never `publicUser`, joins the display name with one space, reads `joinedAt` from `created_at`, reports `projectCount` as literally `0`, and returns `activeAdminCount` in the same read — `src/features/accounts/server/roster.test.ts` (FR-036…FR-041, FR-050)
- [ ] T058 [US3] Implement `loadRoster` returning `RosterView` in `src/features/accounts/server/roster.ts` (FR-036…FR-041, FR-050, data-model §3, §4)
- [ ] T059 [P] [US3] ⛔ R2 · Red: each row shows avatar, display name, email, role, joined date and project count and carries **exactly one** control — Deactivate on active, Reactivate on closed — with no control anywhere setting a role; and on the sole active admin Deactivate renders **disabled and not hidden**, its reason reading exactly `The last active admin can't be deactivated.`, reachable by keyboard and programmatically associated with the control rather than living only in a tooltip — `src/features/accounts/components/roster-table.test.tsx` (FR-037, FR-042, FR-050, `OT-UX-002`, `OT-UX-018`)
- [ ] T060 [US3] ⛔ R2 · Implement `src/features/accounts/components/roster-table.tsx` as a synchronous component over `RosterView` (FR-037, FR-038, FR-042, FR-050)
- [ ] T061 [P] [US3] ⛔ R2 · Red: `roster-skeleton.tsx` matches the roster's own regions, count and dimensions — `src/features/accounts/components/roster-skeleton.test.tsx` (FR-055)
- [ ] T062 [US3] ⛔ R2 · Implement `src/features/accounts/components/roster-skeleton.tsx` (FR-055, `OT-UX-005`)
- [ ] T063 [US3] ⛔ R2 · Red: the row named by US1's jump renders its transient marker and clears it after a short interval or on the next interaction, whichever is first — extend `src/features/accounts/components/roster-table.test.tsx` (FR-008b, [`research.md`](./research.md) *Assumptions carried forward* 1)
- [ ] T064 [US3] ⛔ R2 · Wire the roster and its skeleton into the Accounts panel of `src/features/accounts/components/accounts-screen.tsx` and load `RosterView` in `src/app/(app)/settings/accounts/page.tsx`; render no empty state, FR-049 keeping one active account standing at every moment (FR-036, FR-055)
- [ ] T065 [P] [US3] ⛔ R2 · 🛡 Guard · A signed-in member gets the Forbidden screen inside the shell at this URL, and an unauthenticated caller is redirected to `/signin` and never reaches Forbidden — `src/app/(app)/settings/accounts/page.test.tsx`. The guard itself is R2's and T045 keeps it verbatim, so this asserts an order this feature must not disturb rather than behaviour it writes (FR-002, `OT-SEC-015`, US3 s6, s7)
- [ ] T066 [US3] 🛡 Guard · Every **admin** mutator revalidates `/settings/accounts`, and **no cache option is added anywhere** — the router's `dynamic` stale time is already `0`. `acceptInvitation` is the one exception and is asserted as such: it ends in `redirect("/home")`, which throws, so any revalidation it does must precede the redirect and the screen it would revalidate is not one its caller may read — `src/features/accounts/actions.test.ts` (FR-056, `OT-UX-006`, US3 s9, C-4)

**Checkpoint**: the roster reads the team, and the last active admin's control explains why it is off.

---

## Phase 6: User Story 4 — An admin closes an account, and later reopens it (Priority: P4)

**Goal**: closing stops a person's reads and writes everywhere by their next request while removing
nothing they wrote, reopening restores exactly what they had, and the installation refuses to lose its
last active admin.

**Independent Test**: seed two admins and a member. Close the member's account and confirm their
sessions are gone, their next request redirects to sign-in, their next sign-in is refused with the
closed-account message, and their authored content is untouched. Reopen it and confirm sign-in works.
Close one admin, then confirm the remaining admin's Deactivate control is disabled with its reason
stated.

**The two account races precede both implementations**, for the reason T050 and T051 do: a race test
written after `withLastAdminGuard` is already wired passes on its first run, which Principle **VII**
refuses. T067, T068 and T069 all fail before T070 and T071 exist; those two turn all three green, and
T069 is the proof that R1's lock was reused rather than reproduced.

- [ ] T067 [P] [US4] Red: `deactivateAccount` sets `deactivated_at`, deletes **every** session row for the account, refuses an account already closed with `unchanged`, refuses the last active admin under R1's `withLastAdminGuard` writing nothing, and writes no activity, no notification and no membership change — `src/features/accounts/server/accounts.test.ts` (FR-045, FR-045b, FR-047, FR-049, FR-052, FR-053)
- [ ] T068 [US4] Red: `reactivateAccount` clears `deactivated_at` under a `select … for update` on the target row, refuses an account already active with `unchanged`, issues no token and no invitation, and does **not** bring back the sessions a deactivation deleted — `src/features/accounts/server/accounts.test.ts` (FR-045b, FR-051, FR-051a)
- [ ] T069 [US4] Red: the two account races against real PostgreSQL — the last two active admins deactivated at once leave at least one standing, and a deactivate racing a reactivate on one account serialises on that row and lands on one of the two states, never between them — `src/features/accounts/server/accounts.test.ts` (FR-049, FR-051a, SC-008, US4 s8)
- [ ] T070 [US4] Implement `deactivateAccount` in `src/features/accounts/server/accounts.ts` over R1's `withLastAdminGuard`, **reused and not reproduced** — that sharing is what makes `OT-INV-013` hold across the CLI path and the screen path at once (FR-045, FR-049, A-4)
- [ ] T071 [US4] Implement `reactivateAccount` in `src/features/accounts/server/accounts.ts` (FR-051, FR-051a, SC-009)

- [ ] T072 [P] [US4] Red: `deactivateUser` and `reactivateUser` each require `isAdmin`, derive the subject **from the stored row**, return `forbidden`, `last_admin` or `unchanged` with nothing written, revalidate the screen, and surface a rejected write as an error toast naming what failed and why — `src/features/accounts/actions.test.ts` (FR-043, FR-058, FR-060, FR-061, US4 s7, s12, s13)
- [ ] T073 [US4] Implement `deactivateUser` and `reactivateUser` in `src/features/accounts/actions.ts` (FR-043, FR-058, FR-060)
- [ ] T074 [US4] Red: an admin may close **their own** account where they are not the last active one, their own sessions going with the rest, so the response returns them to `/signin` — `src/features/accounts/actions.test.ts` (FR-045a)
- [ ] T075 [US4] Implement FR-045a's self-closure path in `src/features/accounts/actions.ts` (FR-045a, FR-049)
- [ ] T076 [P] [US4] Red: a closed account's sign-in is refused with the **closed-account** message rather than the generic one — asserted end to end against entry R1's existing route, which this feature does not modify — `src/app/api/auth/signin/route.test.ts` (FR-046, `OT-SEC-013`, C-5)
- [ ] T077 [US4] 🛡 Guard · Losing the admin role mid-session removes no row and is refused by the server on the **very next call**, `loadActor()` reading `user.role` per request and caching nothing across them — `src/features/accounts/actions.test.ts`. FR-062's remaining clause, that the screen's controls go dead on the next render, is discharged on this screen by something stronger and needs no task of its own: a demoted admin's next render hits T045's `actor.role !== "admin"` and gets Forbidden, so there are no controls left to disable (FR-062, FR-002, `OT-AUTHZ-012`, `OT-SEC-008`)
- [ ] T078 [US4] ⛔ R2 · Red: each confirmation is asked once and names its own consequence — deactivation's names what stays (memberships, assignments, comments and activity), reactivation's names what it restores (sign-in and picker eligibility with the memberships already held) and says no new link and no invitation is issued — `src/features/accounts/components/roster-table.test.tsx` (FR-044, US4 s1, s9)
- [ ] T079 [US4] ⛔ R2 · Implement both confirmations in `src/features/accounts/components/roster-table.tsx` (FR-044, FR-047, FR-051)

**Checkpoint**: all four stories are complete and independently exercisable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T080 ⛔ R2 · Red: a panel whose read fails renders an explanatory state naming that the data could not be loaded and offering a retry — never an empty list, and never FR-055's skeleton left standing — `src/features/accounts/components/accounts-screen.test.tsx` (FR-055a)
- [ ] T081 ⛔ R2 · Implement the read-failure state in `src/features/accounts/components/accounts-screen.tsx`, one per panel so a failed roster read leaves the Invitations tab intact (FR-055a, FR-055)
- [ ] T082 [P] Red: every refusal carries a generic message and `logUnhandledServerError` receives the invitation's id and **never its token**; no database error, stack trace or configuration value reaches a caller — `src/features/accounts/actions.test.ts` (FR-024a, FR-063)
- [ ] T083 Reduce every unexpected failure in `src/features/accounts/actions.ts` to a generic result and route its detail to `logUnhandledServerError`, passing the invitation's id where there is one (FR-024a, FR-063)
- [ ] T084 [P] 🛡 Guard · A structural test in a new `src/features/accounts/read-surface.test.ts`, following the pattern of `src/features/auth/role-surface.test.ts` — no module under `src/features/accounts/` selects `tokenDigest` into a DTO or an action result, none assigns `role`, none writes a project or membership row, and `acceptInvitation` is the only path in `src/` outside first-run seeding that inserts a `user`. It passes when written and earns its place by failing later (FR-004, FR-015, FR-016, FR-029, FR-035, `OT-DATA-006`, `OT-AUTHZ-011`, `OT-SCOPE-005`)
- [ ] T085 Run `npm run verify` and confirm `style-check`, `type-check`, `test` and `build` all pass with nothing failing and nothing skipped (gates 5, 8)
- [ ] T086 Walk [`quickstart.md`](./quickstart.md) 9 and 10 — the five races against real PostgreSQL, and the unconfigured-mail path where the invitation stands and a **warning** toast reports the mail did not go (FR-017)
- [ ] T087 ⛔ R2 · Walk [`quickstart.md`](./quickstart.md) 1 through 8 in a browser, covering what the suite structurally cannot: layout shift when a skeleton is replaced, toast stacking order and the five-second timer as seen, and the scroll and transient marker on the jumped-to row

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001)**: no dependencies
- **Foundational (T002–T016)**: blocks every user story. Inside it, T002–T004 are Red and must precede T005–T007; the five promotions T009–T016 are mutually independent
- **US1 (T017–T045)**, **US2 (T046–T056)**, **US3 (T057–T066)**, **US4 (T067–T079)**: all depend on Foundational
- **Polish (T080–T087)**: depends on the stories it verifies

### The R2 blocker

Entry **R2** is specified and planned but **not built**. Every task marked ⛔ R2 above waits on it:
T033–T045, T059–T065, T078–T081 and T087 — 25 of the 87.

Everything else — 62 tasks, including the whole of US2 and the whole server side of US1, US3 and US4
— is buildable today. That is why the ordering starts at the server: the feature can be taken to a
complete, tested server boundary and a working public acceptance route before R2 lands, leaving only
the admin screen to assemble afterwards.

### User story dependencies

- **US1 (P1)**: independent. Its server half needs only Foundational
- **US2 (P2)**: independent of US1 at the module level, but T048 and T049 **extend `src/features/accounts/server/invitations.ts`**, which T018 creates. Sequence the two stories' work on that file, or let US1 land T018 first
- **US3 (P3)**: its query (T057, T058) and its table (T059–T062) are independently testable. Only T064 depends on US1 — the roster mounts inside `accounts-screen.tsx`, which US1's T044 creates — and only T063 depends on US1's FR-008 jump for its meaning
- **US4 (P4)**: its server half is independent. T078 and T079 extend `roster-table.tsx`, which US3's T060 creates

Two files are genuinely shared and cannot be worked in parallel across stories:
`src/features/accounts/actions.ts` (US1, US2, US4) and `src/features/accounts/server/roster.ts`
(US1's list, US3's roster). Both are named in the plan's structure and neither is split, because the
Server Action module must carry one top-level `"use server"` and the two lists share the screen.

### Within each story

- The Red task **must be observed failing for its intended reason** before the implementation task
  beside it (gate 1). A test that passes on its first run is not a valid Red step — which is why the
  two race tasks, T051 and T069, sit **ahead of** the implementations that defeat their races, and why
  the five assertions that genuinely cannot be Red are marked 🛡 Guard instead of pretending otherwise
- Server modules before actions; actions before the components that call them
- Synchronous components before the pages that wrap them ([`research.md`](./research.md) D-6)

### Parallel opportunities

- **Foundational**: T002, T003 and T004 together; then T009, T011, T013 and T015 together, each with
  its implementation following
- **US1 server**: T017, T023, T025 and T027 are four different files and can be written together
- **US2**: T046, T048 and T053 touch `src/proxy.ts`, `invitations.ts` and a new component
  respectively
- **Across stories once Foundational lands**: US1's server half, US2 in full, US3's query and US4's
  server half are four independent tracks

## Parallel example: Foundational's five promotions

```bash
# Four Red tasks, four different files, no shared state:
Task: "T009 classifyToken's used-beats-expired ordering in src/features/auth/server/token-state.test.ts"
Task: "T011 isUniqueViolation unwrapping error.cause in src/db/unique-violation.test.ts"
Task: "T013 sendMail returning an outcome in src/lib/mail.test.ts"
Task: "T015 issueSession taking an executor in src/features/auth/server/sessions.test.ts"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 — Setup (T001)
2. Phase 2 — Foundational (T002–T016). **Blocks everything**
3. Phase 3 — US1's server half (T017–T032)
4. **Stop and validate**: an admin can issue, list, resend and revoke an invitation, and the form
   refuses duplicates. Provable by `npm test` alone, with no screen
5. Phase 4 — US2 in full (T046–T056). Now an invitation can actually be taken

Steps 1–5 need nothing from R2 and deliver the loop the roadmap says every later entry depends on:
a second person can join the installation.

### Incremental delivery

1. Setup + Foundational → the table and the five promotions
2. US1 server + US2 → a working invite-and-accept loop, tested end to end without a screen
3. US3 query + US4 server → the roster and the account-state mutators, still server-only
4. **R2 lands** → assemble all four screens' components, then walk the browser scenarios (T087)

Reversing 3 and 4 is not available: the screen has nowhere to render until the `(app)` group exists.

### Parallel team strategy

Once Foundational is done, four tracks run independently:

- Developer A: US1's server half, then US1's screen when R2 lands
- Developer B: US2 in full — no R2 dependency at all
- Developer C: US3's roster query and table
- Developer D: US4's two mutators and their races

A and B coordinate on `src/features/accounts/server/invitations.ts`; A, B and D coordinate on
`src/features/accounts/actions.ts`.

---

## Requirement coverage

70 of the spec's 79 functional requirements are cited by a task above, five more fall inside a cited
range (FR-007 in `FR-005…FR-011`; FR-028 and FR-030 in `FR-027…FR-031`; FR-039 and FR-040 in
`FR-036…FR-041`). The remaining four are discharged rather than built, and are named here so none is
mistaken for an omission.

| Requirement | Discharged by |
| --- | --- |
| **FR-004** — this screen is the only surface that creates or closes an account | T084's structural assertion, plus T045 and T056 being the only two pages this feature adds. The remaining routes to either are first-run seeding and the command line, both entry R1's |
| **FR-016** — an invitation grants a login and never project membership | T084 asserts no module here writes a project or membership row. `project_member` does not exist until entry R5 (`OT-SCOPE-005`) |
| **FR-031b** — a spent invitation retains no more than the account it created holds, and has no erasure path | T005's column set is the whole of it — address, issuer and two instants, and no `revoked_at` or `accepted_by`. T021's refusal is what stops revoke from deleting a spent row, and T008's guard is what stops the sweep from doing it instead (`OT-INV-017`) |
| **FR-048** — a closed account is excluded from every picker | **Not this feature's to build.** R3 delivers no picker; what it owes is that `deactivated_at` is set and every session is gone, which T067 and T070 assert. The exclusion lands in each picker as that picker does — entries R5, R6 and R7 |

---

## Notes

- **`[P]` means different files with no incomplete dependency.** Two tasks touching
  `src/features/accounts/actions.ts` are never both `[P]`
- **Commit the Red task and the Green task separately.** Gate 1 asks a reviewer to determine from the
  diff that a test was written first; the commit order is that evidence. A 🛡 Guard has no second
  commit — it is one task because there is no implementation for it to precede
- **The five concurrency races are held by four tasks — T029, T051, T069 and the constraint behaviour in T004 — and all run against
  real PostgreSQL** on the database `TEST_DATABASE_URL` names, never a mock and never development or
  production data. A mock cannot fail a constraint
- **`npm test` runs with `--passWithNoTests`**, so a green run is not by itself evidence of Principle
  VII. The pairing above is
- **No comment appears in any file this list produces** (V). Where a reader will want an explanation,
  [`research.md`](./research.md) and [`contracts/`](./contracts/) hold it
- **`projectCount` is a literal `0` and the toast type carries an unused `info` kind.** Both look like
  dead code and are not; both are declared in [`plan.md`](./plan.md)'s *Complexity Tracking* so a
  reviewer meets them there rather than in the diff
