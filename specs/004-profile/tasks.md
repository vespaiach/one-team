---
description: "Task list for entry R4 — Profile"
---

# Tasks: Profile

**Input**: Design documents from [`specs/004-profile/`](./)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md), [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: Required, not optional. AGENTS.md Principle VII is non-negotiable and gate 1 demands a test
written first and *observed failing for the intended reason*. Every implementation task below is
preceded by the Red step that justifies it.

**Organization**: One phase per user story, in the spec's priority order, so each is independently
implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US5]`, matching the spec's user stories. Setup, Foundational and Polish carry none
- **[Red]** / **[Green]**: the two halves of gate 1 and gate 2. A `[Red]` task is complete only when
  its test has been run and seen to fail for the intended reason

## Path Conventions

One Next.js project, sources under `src/` at the repository root. Tests are colocated beside the
module they cover, and the extension picks the runner (`vitest.config.mts`, untouched by this feature):

- `*.test.ts` → the **server** project: node, real PostgreSQL at `TEST_DATABASE_URL`, `fileParallelism: false`
- `*.test.tsx` → the **ui** project: jsdom, Testing Library

No test renders `src/app/(app)/profile/page.tsx` — the runner cannot render an async Server Component,
which is why that file stays a thin wrapper and every assertion lands below it
([`research.md`](./research.md) A-4, E-4).

---

## ⚠️ Blocked on entry R2

`src/app/(app)/` does not exist in this tree. There is no shell, no `/profile` route to fill, no
`ScreenHeader` to compose and no banner region. **T001 is a hard gate: nothing below it can start
until R2 lands.** Every task that edits an R2 file is written against R2's plan and contracts, not
against code.

---

## Phase 1: Setup

**Purpose**: establish the precondition and a green baseline. This feature installs no dependency,
changes no configuration and adds no migration, so there is nothing else to set up.

- [ ] T001 Confirm entry R2 has landed — `src/app/(app)/layout.tsx` and `src/app/(app)/profile/page.tsx` both exist and the latter's body is R2's `notFound()`. A `No such file` stops every task below ([`plan.md`](./plan.md) *Technical Context*, [`quickstart.md`](./quickstart.md) *Prerequisite*)
- [ ] T002 Establish the baseline: set `TEST_DATABASE_URL` and run `npm run verify` green on the tree as it stands, so every later failure is this feature's and not inherited

**Checkpoint**: R2 present, suite green, nothing added.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the field table, the read, the display-name rule and the app-wide message host — each
needed by two or more stories.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [ ] T003 [P] [Red] Write `src/features/profile/fields.test.ts` — exactly seven field names, each with its label and its bound (2000 avatar; 200 first name, last name, job title, Slack handle, phone; 10000 bio), and nothing server-only imported so a Client Component can read it (`FR-006`, `FR-020`, [`research.md`](./research.md) C-4)
- [ ] T004 [Green] Implement `src/features/profile/fields.ts` as a table of plain data — no schema builder (`FR-006`, Principle III)
- [ ] T005 [P] [Red] Write `src/features/profile/server/queries.test.ts` — the read selects R1's `accountUser` projection keyed by the actor's id, never the `user` table directly, and maps to `ProfileRecord`: nine fields, with `id` and `deactivatedAt` dropped at the boundary (`FR-003`, `OT-DATA-005`, [`data-model.md`](./data-model.md) §1–§2)
- [ ] T006 [Green] Implement `src/features/profile/server/queries.ts` with `import "server-only"` (`FR-003`)
- [ ] T007 [P] [Red] Write `src/lib/display-name.test.ts` — first and last name joined by exactly one space, at the address the second caller uses (`FR-004`, `OT-UX-019`)
- [ ] T008 [Green] Move `src/features/shell/display-name.ts` to `src/lib/display-name.ts` and update R2's user-chip import. If R3 has already moved it there, import it and skip the move — the rule has one implementation either way; only its address is in question ([`contracts/profile-screen.md`](./contracts/profile-screen.md), [`plan.md`](./plan.md) *Complexity Tracking*)
- [ ] T009 [P] [Red] Write `src/features/shell/messages.test.ts` — one module-level queue configured `timeout: 5000` and `maxVisibleToasts: 3`, and each `add` its own entry so identical refusals are never coalesced (`FR-033`)
- [ ] T010 [Green] Implement `src/features/shell/messages.ts` around `UNSTABLE_ToastQueue` from `react-aria-components` (`FR-033`, [`research.md`](./research.md) D-3)
- [ ] T011 [Red] Write `src/features/shell/components/message-host.test.tsx` — four kinds (success, info, warning, error), top-right, newest nearest the origin, at most three visible with the rest queued, auto-dismissing after five seconds (`FR-033`, `OT-UX-016`)
- [ ] T012 [Green] Implement `src/features/shell/components/message-host.tsx` with `"use client"`, rendering `UNSTABLE_ToastRegion` — React Aria's, not a hand-built stack (`FR-033`, Principle IV)
- [ ] T013 [Red] Write `src/features/shell/shell-surface.test.ts` — a structural test over the shell asserting `src/app/(app)/layout.tsx` mounts `<MessageHost />` **exactly once**, and that no other file in the tree stands up a second. The positive half Reds naturally against R2's layout, which mounts none; observe the negative half by temporarily adding a second `<MessageHost />` to that layout, then delete it (`FR-033`, gate 1, idiom of `src/features/auth/role-surface.test.ts`)
- [ ] T014 [Green] Mount `<MessageHost />` once in `src/app/(app)/layout.tsx`. One app-wide instance; no screen stands up a second (`FR-033`, [`contracts/ux-conventions.md`](./contracts/ux-conventions.md))

**Checkpoint**: the record can be read, a name can be joined, a message has somewhere to go.

---

## Phase 3: User Story 1 — A signed-in user maintains their own record (Priority: P1) 🎯 MVP

**Goal**: nine values on `/profile`, seven of them edited in place — click, change, blur or ⌘-enter
saves, Escape reverts, a refusal rolls that one field back with a message.

**Independent Test**: sign in as any account, open `/profile`, change each of the seven writable
fields in turn. Confirm each save is one write of that field alone, that Escape abandons an edit
untouched, and that a refused write restores the previous value with a message.

- [ ] T015 [P] [Red] [US1] Write `src/features/profile/server/input.test.ts` — trim before every rule and never inside a value (`FR-012`); empty-after-trim refused on the two names (`FR-007`) and mapped to `NULL` on the five optional fields (`FR-012a`); the avatar's scheme checked with `URL.canParse` against an allowlist of exactly `http:` and `https:`, with uppercase `HTTPS://` accepted and `javascript:`, `data:` and `mailto:` refused (`FR-011`, C-2); an empty avatar cleared without the scheme rule running (`FR-012a`, C-3); each bound counted in **code points** via `[...value].length`, so a bound-many astral-character value saves (`FR-020`, C-4); a Slack handle and a phone accepted exactly as typed with no format rule applied (`FR-008`); a `value` that is not a string — `undefined` included — refused before the trim and never coerced (`FR-020`)
- [ ] T016 [Green] [US1] Implement `src/features/profile/server/input.ts` as small pure `unknown` → value-or-named-refusal functions, mirroring `src/features/auth/server/input.ts` (`FR-007`, `FR-011`, `FR-012`, `FR-012a`, `FR-020`, C-1)
- [ ] T017 [Red] [US1] Write `src/features/profile/actions.test.ts` against real PostgreSQL — the nine steps of [`contracts/update-own-profile.md`](./contracts/update-own-profile.md) in order; each of the seven writes its own column and no other; a value identical to the stored one returns `unchanged` with `updated_at` unmoved (`FR-016`, the `IS DISTINCT FROM` write, B-5); a value at exactly its bound saves and one character beyond is refused; a refused value stores nothing; clearing an optional field stores `NULL` asserted as `IS NULL`, never `= ''` (`FR-012a`); the four typed refusal reasons and the verbatim generic message `"Something went wrong. Try again."` with no SQL or stack trace (`FR-023`); `role`, `email`, `must_change_password` and `feed_filter` unchanged after every one of the seven writes (`FR-021`, `FR-025`); `updated_at` moved through `touched()` in the same statement (`FR-022`); no activity row and no notification for anybody (`FR-036`, `SC-005`); the same field saved from two of the user's own sessions resolving as last write wins — a differing second value replaces the first, a matching one returns `unchanged` with `updated_at` unmoved, and there is no version token and no conflict prompt (spec edge case, AGENTS.md *Testing*); `revalidatePath("/profile")` on an accepted write only and never on a refusal (B-4); a thrown error never used for an expected failure (B-2); the avatar's scheme refused before storage when the action is called **directly** rather than through the screen (`SC-010`, C-5)
- [ ] T018 [Green] [US1] Implement `updateOwnProfile` in `src/features/profile/actions.ts` with top-level `"use server"` — one field name, one value, one `UPDATE` whose `WHERE` pins the actor's id and requires `IS DISTINCT FROM` (`FR-018`…`FR-023`, [`data-model.md`](./data-model.md) §3)
- [ ] T019 [P] [Red] [US1] Write `src/features/profile/components/editable-field.test.tsx` for the gestures — press the value and it becomes a focused field carrying the current value; `Escape` restores the previous value and writes nothing; blur writes a changed value and not an unchanged one; `⌘`/`Ctrl`+`Enter` writes without waiting for focus to move; plain `Enter` inserts a line break in the bio and does **nothing** in the six single-line fields; after a save, a rollback and an `Escape`, focus returns to the control the field replaced (`FR-013`, `FR-013a`, `SC-012`)
- [ ] T020 [Green] [US1] Implement `src/features/profile/components/editable-field.tsx` with `"use client"` — a React Aria `Button` for the affordance and a `TextField` for the field, `onPress` never `onClick`, no `div` with a click handler and no hand-added `role` (`FR-013`, `FR-013a`, `FR-035`, B-7, B-8)
- [ ] T021 [Red] [US1] Extend `src/features/profile/components/editable-field.test.tsx` for the optimistic path — the new value renders before the server answers; a refusal restores the value the server holds; a rollback touches **only** the field that failed, leaving a second field mid-edit alone; two saves in succession are dispatched and awaited one at a time so their answers cannot arrive out of order; a re-query landing mid-edit loses to the edit in progress (`FR-014`, `FR-015`, `SC-003`, B-1, B-3)
- [ ] T022 [Green] [US1] Add `useOptimistic` per field plus `useTransition` to `src/features/profile/components/editable-field.tsx` — no hand-written revert path, and no `useMemo`/`useCallback`/`memo` (React Compiler is enabled) (`FR-014`, `FR-015`, B-1)
- [ ] T023 [Red] [US1] Extend `src/features/profile/components/editable-field.test.tsx` for validation and messages — reported per field as the field is left, never a wall of errors on a submit; error text programmatically associated with its field and never conveyed by colour alone; no control on the screen goes dead in response to an invalid value; a refusal raises one message into the shell's host naming what failed and why (`FR-014`, `FR-017`, `FR-035`, `OT-UX-011`)
- [ ] T024 [Green] [US1] Wire React Aria `Label` and `FieldError` and the `messages.add(…)` call into `src/features/profile/components/editable-field.tsx` (`FR-017`, `FR-035`)
- [ ] T025 [Red] [US1] Write `src/features/profile/components/profile-screen.test.tsx` — nine values in §3.12's order; the avatar a URL text field with no upload control, no file picker and no stored file (`FR-010`); the four empty lines verbatim, `"Add a job title"`, `"Add a Slack handle"`, `"Add a phone number"`, `"Add a bio"`, each line itself the button that opens the field; an avatar with no value, and one whose image fails to load, rendering the display name alone with no substitute image and no broken-image frame; a stored bio's line breaks surviving to the output with no markup parsed and no `dangerouslySetInnerHTML`; the bio at least three rows, growing with content, no maximum (`FR-006`, `FR-009`, `FR-012b`, `OT-DATA-016`)
- [ ] T026 [Green] [US1] Implement `src/features/profile/components/profile-screen.tsx` as a synchronous Server Component taking `ProfileRecord` (`FR-006`, `FR-009`, `FR-012b`)
- [ ] T027 [Red] [US1] Write `src/features/profile/components/profile-skeleton.test.tsx` — the same rows, at the same heights, in the same order as `ProfileScreen`, the bio's three-row minimum included, so data landing shifts no layout. Never a full-screen spinner (`FR-031`, `OT-UX-005`)
- [ ] T028 [Green] [US1] Implement `src/features/profile/components/profile-skeleton.tsx`, authored for this layout and shared with nothing (`FR-031`, D-1)
- [ ] T029 [Red] [US1] Write `src/features/profile/profile-surface.test.ts` — a structural test over `src/app/(app)/profile/page.tsx`: `requireActor()` is called before the query, the record reaches `<ProfileScreen>` through a `Suspense` whose fallback is `<ProfileSkeleton />`, and no `loading.tsx` exists at or above the route. It Reds naturally against R2's body, which is `notFound()` and does none of the three. Asserted structurally because the runner cannot render an async Server Component (`FR-001`, `FR-005`, `FR-031`, A-4, A-5, E-4)
- [ ] T030 [Green] [US1] Fill `src/app/(app)/profile/page.tsx`, replacing R2's `notFound()` body — `requireActor()`, then the query, then `<ScreenHeader name="Profile" />`, then `<Suspense>` with the skeleton **below** the guard and never in a `loading.tsx` above it. Guard, query, render and nothing else. The page is dynamic because it reads `cookies()` through `loadActor()`, which is what makes `FR-032`'s re-query on revisit the framework's own default with no configuration added (`FR-001`, `FR-003`, `FR-005`, `FR-031`, `FR-032`, A-4, A-5, A-6, D-2)

**Checkpoint**: `/profile` renders and every field edits in place. This is the MVP — stop and validate.

---

## Phase 4: User Story 2 — The record is theirs alone (Priority: P2)

**Goal**: one person's own record, with no address, control or argument anywhere that reaches
another's.

**Independent Test**: sign in as a member and as an admin in turn and confirm each sees only their own
record. Then issue the profile write naming a different user's identifier and confirm the caller's own
row is what changes and the named row is untouched.

- [ ] T031 [Red] [US2] Extend `src/features/profile/profile-surface.test.ts` — a structural test over the route tree asserting no segment under `src/app` names another user's record: no `[userId]`, no `?user=`, no second profile route. Observe the Red by temporarily adding `src/app/(app)/profile/[userId]/page.tsx`, then delete it (`FR-002`, `SC-004`, E-3, idiom of `src/features/auth/role-surface.test.ts`)
- [ ] T032 [Red] [US2] Extend `src/features/profile/actions.test.ts` — a request whose `Origin` does not match is refused by `assertSameOrigin()` **before** anything is read or written (spec *Inherited constraints*, step 1 of [`contracts/update-own-profile.md`](./contracts/update-own-profile.md))
- [ ] T033 [Green] [US2] Add `assertSameOrigin()` as step 1 of `updateOwnProfile` in `src/features/profile/actions.ts`
- [ ] T034 [Red] [US2] Extend `src/features/profile/actions.test.ts` with two seeded users — the row written is the one the session resolves to, the other user's row is untouched, and the signature admits no user identifier to supply. Neither `isAdmin` nor `isMember` gates the action; there is no check beyond "this is the caller's own row" (`FR-018`, `FR-019`, `OT-AUTHZ-001`, `OT-AUTHZ-004`, US2 scenarios 4–5). **Write this before T018's Green** — see *Gate 1 and story order* below
- [ ] T035 [Red] [US2] Extend `src/features/profile/profile-surface.test.ts` — the guard T029 pinned is R1's `requireActor()`, which redirects to `/signin`, and no Forbidden path exists at or above this route, so a request with no session, an expired one or an account deactivated since the page rendered is returned to sign-in rather than refused. Observe the Red by temporarily swapping the guard for one that renders Forbidden, then revert (`FR-005`, `OT-SEC-015`, US2 scenarios 6–7, A-4). R1's `requireActor()` is not re-proved here

**Checkpoint**: US1 and US2 both hold. The record is reachable by exactly one person.

---

## Phase 5: User Story 3 — Email and account role are facts, not fields (Priority: P3)

**Goal**: the address and the role render the way an immutable field renders everywhere else — text
with a label, not a control.

**Independent Test**: open the profile and confirm both are shown, that neither responds to a click
the way an editable field does, and that no sequence of interactions on this screen changes either.

- [ ] T036 [Red] [US3] Write `src/features/profile/components/shown-value.test.tsx` — renders a visible label programmatically associated with its value; is not a `Button`, not focusable and not in the tab order; no press turns it into a field (`FR-024`, `FR-035`, `OT-UX-010`)
- [ ] T037 [Green] [US3] Implement `src/features/profile/components/shown-value.tsx` as a synchronous component (`FR-024`)
- [ ] T038 [Red] [US3] Extend `src/features/profile/components/profile-screen.test.tsx` — email and role render as shown values in positions 8 and 9; the presentation is identical for a member and an admin with only the role's value differing; no interaction available on the screen changes either, and no path on it sets a role (`FR-024`, `FR-025`, `SC-006`, US3 scenarios 1–5)
- [ ] T039 [Green] [US3] Compose `<ShownValue>` into `src/features/profile/components/profile-screen.tsx` (`FR-024`)

**Checkpoint**: US1–US3 hold independently.

---

## Phase 6: User Story 4 — Changing a password without leaving the app (Priority: P4)

**Goal**: one press mails R1's reset link to the signed-in user's own address, asking for nothing.

**Independent Test**: press the link as a signed-in user and confirm mail is sent to that user's own
address with no address typed and a confirming message shown. Press it six times inside the window and
confirm the sixth is refused with the time remaining.

- [ ] T040 [P] [Red] [US4] Extend `src/features/auth/actions.test.ts` — `requestOwnPasswordReset()` asserts the origin, resolves the actor, reads that user's own email **by id** and never from an argument, throttles on `flow: "reset"`, records an `auth_attempt` row on every press refused or not, issues a token and mails it. Returns `{ status: "sent" }` or `{ status: "throttled", retryAfterSeconds }` and never throws for an expected failure. Two presses in succession, each awaited, issue two `reset_token` rows and mail two links, both valid until one is used or they expire — the rate limit, not an in-flight lock, is what stops the third and the fourth (spec edge case, `FR-026`, [`contracts/change-password-link.md`](./contracts/change-password-link.md)). The mail's link is `/reset?token=…` — the second of `FR-027`'s two proofs (`FR-019`, `FR-026`, `FR-028`, `OT-SEC-017`, E-1)
- [ ] T041 [Green] [US4] Implement `requestOwnPasswordReset` in `src/features/auth/actions.ts` beside `requestPasswordReset`, reusing R1's `assertNotThrottled`, `recordFailure`, `issueResetToken` and `sendPasswordResetMail` unchanged. `requestPasswordReset` is **not** refactored — the two flows differ in the order that matters (E-2, [`contracts/change-password-link.md`](./contracts/change-password-link.md))
- [ ] T042 [Red] [US4] Extend `src/features/auth/actions.test.ts` for the counter's separation — an address locked out of sign-in can still press this link, and a refused press here cannot block a sign-in for that address (`FR-028`, `OT-SEC-017`, US4 scenarios 8 and 10). **Write this before T041's Green**
- [ ] T043 [P] [Red] [US4] Write `src/features/profile/components/change-password-link.test.tsx` — one press asks for no address and shows no form; while the request is out the link shows that state on itself and cannot be pressed a second time; success raises the verbatim `"Check your email for a link to reset your password."`; a throttled refusal states whole minutes rounded up and never below one, so 130 seconds reads `"Too many requests. Try again in 3 minutes."`; a press that cannot be mailed reports in the same terms as any other failure with the detail left in the server log (`FR-026`, `FR-028`, `FR-029`, `SC-007`, `SC-011`)
- [ ] T044 [Green] [US4] Implement `src/features/profile/components/change-password-link.tsx` with `"use client"` — a link, not a field; this write waits for the server rather than applying optimistically, having nothing on screen to apply (`FR-026`, `FR-029`)
- [ ] T045 [Red] [US4] Extend `src/features/profile/profile-surface.test.ts` — no control on this screen accepts a password: no `type="password"` and no password field in any file under `src/features/profile` or at the profile route. Observe the Red by temporarily adding one, then delete it. This is the first of `FR-027`'s two proofs; the twelve-character rule, the composition rules and the blocklist are R1's and are **not** re-asserted here (`FR-027`, `OT-SEC-004`, E-3)

**Checkpoint**: US1–US4 hold. `OT-SEC-004` is discharged negatively and directionally.

---

## Phase 7: User Story 5 — A corrected name follows the user everywhere (Priority: P5)

**Goal**: one join rule, one implementation, every surface that renders a display name.

**Independent Test**: change the first name, then the last name, and confirm the profile and the
sidebar's user chip both render the new pair joined with a single space on their next render.

- [ ] T046 [Red] [US5] Extend `src/features/profile/components/profile-screen.test.tsx` and R2's user-chip test — both render first and last joined by exactly one space, both show the new pair after a change, and a name saved with surrounding whitespace is stored trimmed so the rendered join carries exactly one space (`FR-004`, `FR-012`, `SC-009`, US5 scenarios 1–4)
- [ ] T047 [Green] [US5] Import `src/lib/display-name.ts` in `src/features/profile/components/profile-screen.tsx` and confirm no second implementation of the join survives anywhere — `src/features/shell/display-name.ts` is gone, not copied (`FR-004`, `OT-UX-019`)

**Checkpoint**: all five stories hold independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: the connection banner, which no user story depends on, and the end-to-end validation the
runner cannot perform.

- [ ] T048 [P] [Red] Write `src/features/shell/components/connection-banner.test.tsx` — one banner reading the verbatim `"You're offline. Changes can't be saved."` while the connection is lost, driven by `navigator.onLine` and the `online` / `offline` window events (`FR-034`, `OT-UX-017`, D-4)
- [ ] T049 [Green] Implement `src/features/shell/components/connection-banner.tsx` with `"use client"` — the Web platform's own API, no dependency (`FR-034`, Principle IV)
- [ ] T050 [Red] Extend `src/features/shell/shell-surface.test.ts` — `src/app/(app)/layout.tsx` mounts `<ConnectionBanner />` **exactly once**, into R2's banner region beside the must-change-password banner rather than in place of it, and no other file stands up a second. The positive half Reds naturally; observe the negative half by temporarily adding a second, then delete it (`FR-034`, gate 1)
- [ ] T051 [Green] Mount `<ConnectionBanner />` once in `src/app/(app)/layout.tsx`, into R2's banner region so it stacks with the must-change-password banner rather than replacing it. One banner for the whole application, never one per screen (`FR-034`)
- [ ] T052 [Red] Extend `src/features/profile/components/editable-field.test.tsx` — a save attempted while offline is refused **before** the action is dispatched, with the distinct wording `"Changes need a connection"`, and nothing is queued for later. The refusal takes the same rollback path as any other (`FR-034`, D-5)
- [ ] T053 [Green] Add the pre-dispatch offline check to `src/features/profile/components/editable-field.tsx` (`FR-034`)
- [ ] T054 Run every walkthrough in [`quickstart.md`](./quickstart.md) 1–12 against `npm run dev`, including the three this feature observes but does not implement — walkthrough 10's sign-out-everywhere, the cleared must-change-password flag and the return to sign-in on the next action, all R1's (`FR-030`, `SC-008`, US4 scenarios 6, 7, 9). The walkthroughs are where `SC-001`'s thirty seconds, `SC-002`'s second browser and `FR-032`'s re-query on revisit are observed — none is assertable in either Vitest project
- [ ] T055 Confirm `npm run db:generate` produces no migration and `src/db/schema.ts` and `drizzle/` are untouched (`FR-037`), and that `package.json`, `next.config.ts`, `vitest.config.mts`, `biome.json` and `tsconfig.json` carry no change — `FR-032` is satisfied by the client cache's `dynamic` stale time of `0`, which this entry gets by configuring nothing (gate 4, gate 7, D-2)
- [ ] T056 Run `npm run verify` — `style-check`, `type-check`, `test`, `build` — and confirm no test is failing or skipped (gates 5 and 8)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: gated on entry R2 having landed. Nothing starts before T001 passes
- **Foundational (Phase 2)**: depends on Setup — **blocks all five stories**
- **User stories (Phases 3–7)**: all depend on Phase 2. US1 is the MVP and carries the route itself, so US2–US5 are ordered after it in practice even though their tests are independent
- **Polish (Phase 8)**: depends on US1's editable field existing (T052 extends it) and on `shell-surface.test.ts` existing (T050 extends what T013 created)

### User Story Dependencies

- **US1 (P1)**: Phase 2 only. Delivers the screen, the write and the route
- **US2 (P2)**: extends US1's action and `profile-surface.test.ts`, which T029 creates. Its assertions are structural and behavioural, not a new module
- **US3 (P3)**: one new component and one composition into US1's screen
- **US4 (P4)**: fully parallel with US2 and US3 — it touches `src/features/auth/actions.ts` and one new component, neither of which US2 or US3 opens
- **US5 (P5)**: depends on T008's move. No new module

### Gate 1 and story order

Two tasks — **T034** and **T042** — are tests belonging to a later story that constrain an earlier
task's module. Each must be **written and observed failing before that module's Green step**, so the
phase ordering below reflects requirement traceability, not commit order. Writing them afterwards
would produce a test that passes on its first run, which AGENTS.md rules out as a valid Red step.

Five tasks — **T013**, **T031**, **T035**, **T045** and **T050** — prove a negative. A negative has
no natural Red, so each names the temporary violating artifact to add, observe the failure against,
and delete. Do not skip that step: a structural test that has never failed proves nothing about the
tree it reads. T013 and T050 are half-and-half: their positive claim — *exactly one* mount — Reds on
its own against a layout that mounts none, and only their "and no second" half needs the temporary
artifact.

**Every Green in this file has a Red before it, including the three that write no component.** T014
and T051 mount the two shell singletons and T030 fills the route; each is production code, so each is
preceded by a structural Red — T013, T050 and T029 respectively. `FR-033` and `FR-034` make *exactly
one, app-wide* the requirement itself, and `page.tsx` cannot be rendered by either runner, so a
structural assertion is the only Red available for all three.

### Parallel Opportunities

- T003, T005, T007 and T009 — four independent Red steps in four files
- T015 and T019 — the parser's tests and the field control's tests touch different files
- T040 and T043 — the auth action and the link component
- US4 can run alongside US2 and US3 once US1 is complete; the three open disjoint files
- T048 is independent of everything except its own mount Red at T050 and the layout mount at T051

---

## Parallel Example: Phase 2

```bash
# Four Red steps, four files, no shared dependency:
Task: "Write src/features/profile/fields.test.ts"
Task: "Write src/features/profile/server/queries.test.ts"
Task: "Write src/lib/display-name.test.ts"
Task: "Write src/features/shell/messages.test.ts"
```

## Parallel Example: after the MVP

```bash
# US2, US3 and US4 open disjoint files once US1 is green:
Task: "US2 — src/features/profile/profile-surface.test.ts and actions.test.ts"
Task: "US3 — src/features/profile/components/shown-value.tsx"
Task: "US4 — src/features/auth/actions.ts and components/change-password-link.tsx"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 — confirm R2, green baseline
2. Phase 2 — the field table, the read, the display-name rule, the message host
3. Phase 3 — US1, which lands `/profile` and every in-place edit
4. **Stop and validate**: quickstart walkthroughs 1–5 and 8 all pass
5. Demo. The screen is usable and correct at this point

### Incremental delivery

Each story after US1 is a small closed increment on a working screen: US2 hardens the boundary, US3
adds two shown values, US4 adds the link, US5 confirms the name propagates. None breaks the one
before it, and every one is demoable on its own.

---

## Notes

- **Test-first is not optional here.** Gate 1 asks a reviewer to determine *from the diff* that the
  test came first, so commit the Red step and its observed failure before the Green step that answers it
- **No dependency, no configuration change, no migration.** If a task seems to need one, it has left
  the boundary `FR-037` and gate 4 draw
- **React Compiler is enabled** — do not hand-write `useMemo`, `useCallback` or `memo`, and do not
  mutate props or state during render
- **No comments in the diff** (Principle V). The three places a reader will want an explanation —
  why the empty check precedes the scheme check, why the update carries `IS DISTINCT FROM`, and why the
  two reset actions are not one — are answered by the contracts, not by annotation
- The persistence half of every server test runs against the real instance `TEST_DATABASE_URL` names.
  The length `CHECK`s and the `IS DISTINCT FROM` write are not observable against a mock
- Commit after each Red/Green pair, or after each logical group
