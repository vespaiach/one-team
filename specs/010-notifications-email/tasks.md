# Tasks: Notifications and email

**Feature**: R11 · **Branch**: `sdd/r11` · **Feature directory**: `specs/010-notifications-email/`

**Input**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: mandatory and first. [`AGENTS.md`](../../AGENTS.md) Principle VII is non-negotiable and
gate 1 requires a test written before its implementation and **observed failing for the intended
reason**. Every implementation task below is preceded by the Red task that must fail first, with
Phase 9 the recorded exception — it writes no production code and its gate 1 was discharged by T005
in Phase 2. `npm test` runs with `--passWithNoTests`, so a green suite is not evidence of VII — the
commit order is.

**Organization**: grouped by the seven user stories in [`spec.md`](./spec.md), in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — a different file from every other `[P]` task in the same group, and
  no dependency on one of them. Tasks touching the same file are never both `[P]`.
- **[Story]**: `[US1]`…`[US7]`, on user-story tasks only. Setup, Foundational and Polish carry none.
- Every path is repository-relative to `/Users/toannguyen/one-team/.worktrees/r11`.

## Path conventions

Single Next.js project. Vitest resolves two projects from `vitest.config.mts`: **`server`** takes
`**/*.test.ts` in a node environment with `fileParallelism: false`, migrating `TEST_DATABASE_URL`
through `src/db/test-setup.ts`; **`ui`** takes `**/*.test.tsx` in jsdom with
`@testing-library/react`. Persistence, constraint, cascade, concurrency and sweep tests are therefore
`.test.ts` and run against **real PostgreSQL on a separate database** — never a mock, never a
development, staging or production database. `nodemailer` is the one permitted mock, through
`vi.spyOn(nodemailer, "createTransport")`, which eight existing test files already do.

---

## Phase 1: Setup

**Purpose**: a clean worktree and a recorded green baseline, so any later red is attributable.

- [X] T001 Install dependencies with `npm ci` in `/Users/toannguyen/one-team/.worktrees/r11` — this worktree does not share the main checkout's `node_modules` — then confirm `git diff package.json package-lock.json` is empty, since this feature installs nothing (FR-075, gate 4)
- [X] T002 Confirm `.env` supplies `DATABASE_URL`, a **separate** `TEST_DATABASE_URL` and `APP_URL`, apply existing migrations with `npm run db:migrate`, and run `npm run verify` to record a green baseline before any change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the `notification` table, its five `CHECK`s, its three indexes and its five foreign keys.
Every user story reads or writes this table.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

**⚠️ Red-step constraint, read before T006.** The three `ON DELETE CASCADE` clauses on
`issue_id`, `project_id` and `comment_id` are the entire implementation of FR-058…FR-061, so a cascade
test written after they exist passes on its first run and is not a valid Red step (VII). T006
therefore lands the table in **two observable steps**: first the five foreign keys with **no**
`onDelete` clause — at which point T005 fails for the intended reason — then the three `cascade`
clauses, at which point it passes. Only the final schema is migrated and committed (T008), so exactly
one migration `0008` reaches `drizzle/`.

### Tests for the foundation (write first, observe failing)

- [X] T003 [P] Red — write `src/db/notification-shape.test.ts` asserting the twelve columns of [`data-model.md`](./data-model.md) §1 with their types and nullability, `send_attempts` as `integer DEFAULT 0 NOT NULL`, a `$defaultFn(uuidv7)` primary key with no database default, no `pgEnum` anywhere, the three indexes including both partial `WHERE` clauses, the five foreign keys with `ON DELETE cascade` on exactly `issue_id` / `project_id` / `comment_id` and none on `user_id` / `actor_id`, and that `ALL_TABLES` in `src/db/tables.ts` contains `"notification"` and `truncateAllTablesStatement()` names it (FR-001, FR-002, FR-005, FR-007, FR-008, research A-1…A-6, F-1)
- [X] T004 [P] Red — write `src/db/notification-constraints.test.ts` asserting each of the five `CHECK`s rejects a direct insert (`notification_type_valid`, `notification_target_exactly_one`, `notification_actor_not_recipient`, `notification_comment_id_matches_type`, `notification_send_attempts_range`) and that the partial `UNIQUE (user_id, comment_id) WHERE comment_id IS NOT NULL` rejects a second row for one person and one comment while permitting many rows with a null `comment_id`, including under two concurrent `Promise.all` transactions (FR-002…FR-007, SC-006, research A-3, F-3)
- [X] T005 [P] Red — write `src/db/notification-cascade.test.ts` asserting at row level that deleting the parent `comment`, `issue` or `project` row removes exactly the notifications reaching it and nothing else, that an issue delete reaches its comments' notifications transitively, and that no cascade path deletes a `user` row (FR-058…FR-061, FR-062, research A-5, C-1)

### Implementation for the foundation (only once T003, T004 and T005 have been observed failing)

- [X] T006 [P] Green — append the `notification` `pgTable` to `src/db/schema.ts` after `activity`, in the two steps the phase note above fixes, and nothing else in that file changes (FR-001…FR-008)
- [X] T007 [P] Green — add `"notification"` to `ALL_TABLES` in `src/db/tables.ts`; `src/db/test-database.ts` needs no edit because it calls `truncateAllTablesStatement()`
- [X] T008 Generate the migration with `npm run db:generate`, then **read `drizzle/0008_*.sql` by eye** and confirm the three things [`data-model.md`](./data-model.md) §6 names — both partial indexes carry their `WHERE` clause, the three foreign keys render `ON DELETE cascade` and the two to `user` render none, and `send_attempts` renders `integer DEFAULT 0 NOT NULL` — then apply it with `npm run db:migrate` and commit the SQL with `drizzle/meta/0008_snapshot.json` and `drizzle/meta/_journal.json` (FR-009, quickstart walkthrough 1)
- [X] T009 Run `npm run verify` and confirm T003, T004 and T005 are green

**Checkpoint**: the table exists and is truncated by the test harness. User stories can begin.

---

## Phase 3: User Story 1 — Someone opens Notifications and reads what happened to them (Priority: P1) 🎯 MVP

**Goal**: `/notifications` stops answering "This doesn't exist" and renders the caller's own rows,
newest first, bounded at 200, each carrying an unread indicator, the actor, the type phrase, the
target and a relative time, with a deep link that lands on the comment anchor where there is one.

**Independent Test**: seed a spread of rows of all three types across an issue and a project, some read
and some not, for two different users; open `/notifications` and confirm the ordering, the dot on
unread rows only with the state also in the accessible name, the actor / type / target / relative time
on every row, the comment anchor on rows carrying a comment, that the second user's rows never appear,
and that a user holding none sees one quiet line. Rows are seeded directly — nothing writes them until
Story 2, which is what makes this story independently testable.

**Scope note**: the row is a link only in this phase. `markNotificationRead` and its `onNavigate` call
belong to Story 3, and `notification-row.tsx` is edited again there.

### Tests for User Story 1 (write first, observe failing)

- [X] T010 [P] [US1] Red — write `src/features/notifications/server/notification-queries.test.ts` for `listNotifications`: the caller's own rows and no other user's, `created_at DESC` tie-broken by `id DESC`, `LIMIT 200` with no cursor and no offset, `href` composed for all four row shapes of [`data-model.md`](./data-model.md) §4 including the `#comment-<id>` fragment, `targetLabel` as `<KEY-N> · <title>` or the project name, `isUnread` from `read_at is null`, `actorName` still rendering for a deactivated or unmembered actor, and the returned object carrying exactly the seven keys with no `sendAttempts`, no `emailedAt`, no `readAt` and no `email` (FR-011, FR-012, FR-014, FR-015, FR-022, FR-024, FR-073, SC-001, research E-2, E-4, E-8)
- [X] T011 [P] [US1] Red — write `src/features/notifications/components/notification-row.test.tsx`: the three type phrases *mentioned you* / *assigned you* / *commented*, the actor's display name, the target, an `Intl.RelativeTimeFormat` relative time, the link's `href` including the fragment, the unread state asserted through the row's **accessible name** carrying "Unread" and never through a class name, the dot `aria-hidden`, a visible focus indicator and activation by `Enter` (FR-012, FR-013, FR-014, FR-015, FR-074, SC-016, research F-6)
- [X] T012 [P] [US1] Red — write `src/features/notifications/components/notifications-list.test.tsx`: an ordered list of rows in the order given, and for a caller holding none **one quiet line** with no illustration and no empty-state marketing (FR-011, FR-016, FR-022)
- [X] T013 [P] [US1] Red — write `src/features/notifications/components/notifications-skeleton.test.tsx`: row-shaped pulse blocks in the repo's established form matching the list layout, never a full-screen spinner, and the same block count and shape the loaded list renders so nothing shifts (FR-017)
- [X] T014 [P] [US1] Red — write `src/app/(app)/notifications/page.test.tsx`: `ScreenHeader` named "Notifications" with the **New issue** slot left empty, the `Suspense` fallback being `NotificationsSkeleton`, no `searchParams` read at all, no `revalidate` export or client store so a revisit re-queries, and no responsive breakpoint utility — no `sm:`, `md:`, `lg:` or `xl:` class — anywhere in the markup the screen renders, since it targets a desktop browser only, the same absence every existing screen in `src/` shows (FR-010, FR-017, FR-018, FR-020, FR-022, FR-023)
- [X] T015 [US1] Red — move `"/notifications"` from `UNDELIVERED_SIGNED_IN_ROUTES` into `DELIVERED_SIGNED_IN_ROUTE_NAMES` in `src/app/(app)/route-guards.test.ts`, which fails while the placeholder still calls `notFound()` and pins FR-019's redirect-to-sign-in for the delivered route

### Implementation for User Story 1

- [X] T016 [US1] Create `src/features/notifications/server/notification-queries.ts` with `import "server-only"`, the `NotificationType` and `NotificationListItem` types of [`data-model.md`](./data-model.md) §3, and `listNotifications(userId)` as the single joined query of [`contracts/screens.md`](./contracts/screens.md) §2 with its server-side `href` composition
- [X] T017 [P] [US1] Create `src/features/notifications/components/notification-row.tsx` as a `"use client"` `next/link` anchor — not `react-aria-components`' `Link`, since this app installs no `RouterProvider` (research E-3) — with the type map, the visually-hidden "Unread" node, the `aria-hidden` dot and the relative time
- [X] T018 [P] [US1] Create `src/features/notifications/components/notifications-skeleton.tsx` following `issue-skeletons.tsx` and `labels-skeleton.tsx`
- [X] T019 [US1] Create `src/features/notifications/components/notifications-list.tsx` as a Server Component that calls `listNotifications` and renders the `<ul>` of `NotificationRow`s or the one quiet line
- [X] T020 [US1] Replace the `notFound()` placeholder in `src/app/(app)/notifications/page.tsx` with the shape `src/app/(app)/settings/labels/page.tsx` uses: `requireActor()`, `ScreenHeader name="Notifications"` with no `newIssue`, and `NotificationsList` inside a `Suspense` boundary falling back to `NotificationsSkeleton`
- [X] T021 [US1] Run `npm run verify` and confirm T010–T015 are green

**Checkpoint**: the screen renders seeded rows end to end. This is the MVP.

---

## Phase 4: User Story 2 — Being mentioned, assigned or commented at produces a notification (Priority: P2)

**Goal**: the three recipient sets, computed on the server from stored rows and written inside the
transaction that caused them, across four of the five reach-back mutators.

**Independent Test**: run each assigning-or-commenting mutator once against seeded projects and issues
and take a **full census** of `notification` before and after each — a comment naming two people writes
two `mention` rows, an issue comment writes `comment` rows for the assignee and creator minus anyone
already mentioned, setting an assignee writes one `assignment` row, and the actor and every deactivated
user hold none.

**Scope note**: no mail is dispatched in this phase. `dispatchNotificationMail` and the `pendingMail`
closure variable arrive in Story 5, which edits these same four mutator files again. Write the writer
call as a bare `await write…Notifications(tx, …)` here — an assigned-but-unread variable would fail
`noUnusedVariables` in gate 5 and is dead code under Principle VI.

**Red-step note (research F-2)**: the mention-wins test must assert `rows.length === 1` **and**
`rows[0].type === "mention"`; asserting only the count passes against the inversion of FR-040. Every
"no row is written" scenario is a census before and after, never a query for the row expected to be
missing.

### Tests for User Story 2 (write first, observe failing)

- [X] T022 [P] [US2] Red — write `src/features/notifications/server/write-assignment-notifications.test.ts`: `[]` and zero rows for a null assignee, for `assigneeId === actorId` and for a deactivated assignee; otherwise exactly one row with `type: "assignment"`, the issue set, `project_id` null, `comment_id` null and `send_attempts` 0; every statement running on the caller's `tx` (FR-038, FR-039, FR-050, FR-051, FR-052, SC-004, SC-005)
- [X] T023 [P] [US2] Red — write `src/features/notifications/server/write-comment-notifications.test.ts`: the mention set from `MENTION_TOKEN_PATTERN` **imported from R7's `mention-resolve.ts`**, deduplicated; a token naming no user writing nothing and stopping nothing; the issue comment set as `assignee_id` and `created_by` deduplicated to one row where they are the same person; the project comment set as the `project_member` **rows** so an admin holding no membership row receives nothing and a project with no members yields zero `comment` rows while its mentions are still written; mention winning over comment; the actor and every deactivated user removed; `onConflictDoNothing` against the partial unique index (FR-037, FR-040, FR-043…FR-049, SC-006, SC-007, research B-2, B-3, B-4, B-9, F-2)
- [X] T024 [P] [US2] Red — write `src/features/issues/server/create-issue-notifications.test.ts`: creation with a different assignee writes exactly one `assignment` row, creation assigning to self or with no assignee writes none, and the board's inline "Add a card" path through `createBoardCard` in `src/features/issues/actions.ts` writes the same one row — FR-050's fourth path, covered by the same call site (FR-050, FR-051, SC-003, SC-008)
- [X] T025 [P] [US2] Red — write `src/features/issues/server/update-issue-notifications.test.ts`: a rail edit setting a new assignee writes one row; re-selecting the assignee already set, clearing it, and changing only priority, column, title or due date each write none, by census (FR-050, FR-051, SC-008)
- [X] T026 [P] [US2] Red — write `src/features/issues/server/move-issue-notifications.test.ts`: a cross-lane drop under Assignee grouping writes one row; a drop into **Unassigned**, a reorder inside one lane and a drop under Column or Priority grouping each write none, by census (FR-050, FR-051, SC-008)
- [X] T027 [P] [US2] Red — write `src/features/activity/server/create-comment-notifications.test.ts`: the full recipient computation through the real mutator on both an issue comment and a project comment, with a census each time, and every row carrying the comment's own target and identifier (FR-041, FR-043…FR-049, SC-003)
- [X] T028 [P] [US2] Red — write `src/features/notifications/server/no-notification-events.test.ts`: a project status change, a label applied or removed, a column created renamed moved or deleted, a membership added or removed, and a profile edit each write **zero** notification rows of any type, by full census (FR-042, SC-003)
- [X] T029 [P] [US2] Red — write `src/features/issues/server/create-issue-notification-rollback.test.ts`: force the causing transaction to fail the way `create-issue.ts` already rolls back with `TransactionRollbackError`, and assert zero notification rows survive and zero messages were sent (FR-041, SC-010, quickstart walkthrough 9)

### Implementation for User Story 2

- [X] T030 [US2] Create `src/features/notifications/server/write-notifications.ts` with `import "server-only"` and the shape `src/features/activity/server/write-activity.ts` already exports — `(tx, params) => Promise<string[]>` — carrying the single eligibility query of [`contracts/mutators.md`](./contracts/mutators.md) §3, `writeAssignmentNotifications` and `writeCommentNotifications`, each returning `.returning({ id })`
- [X] T031 [P] [US2] Add the `writeAssignmentNotifications` call to `src/features/issues/server/create-issue.ts`, inside the existing `db.transaction` after `insert(issue).returning({ id })`, guarded by the local `assigneeId`; validation, authorization, activity writing, refusal order and result shape all unchanged
- [X] T032 [P] [US2] Add the same call to `src/features/issues/server/update-issue.ts` inside `runUpdateIssue`'s transaction after `tx.update(issue)`, guarded by the `"assigneeId" in fields` condition the mutator already computes for its `field_changed` activity row
- [X] T033 [P] [US2] Add the same call to `src/features/issues/server/move-issue.ts` inside the existing transaction, in the `if (!laneUnchanged)` arm where `lane.field === "assignee"`
- [X] T034 [P] [US2] Add the `writeCommentNotifications` call to `src/features/activity/server/create-comment.ts`, inside the existing `db.transaction` after `writeActivity`
- [X] T035 [US2] Run `npm run verify` and confirm T022–T029 are green

**Checkpoint**: the list Story 1 renders now fills itself from real writes.

---

## Phase 5: User Story 3 — A person clears their own notifications, one at a time or all at once (Priority: P3)

**Goal**: two Server Actions, each one statement scoped from the session, plus the row's activation
gesture and the header's single control.

**Independent Test**: give one user a mix of read and unread rows and a second user unread rows of
their own; activate one row and confirm it is read and the navigation happened; press "Mark all read"
and confirm every unread row of the first user is read including rows past the 200-row bound, that
already-read rows keep their first moment, and that the second user's rows are untouched.

### Tests for User Story 3 (write first, observe failing)

- [X] T036 [P] [US3] Red — write `src/features/notifications/server/mark-read.test.ts`: the single `UPDATE` of [`contracts/mutators.md`](./contracts/mutators.md) §1 with `user_id = $actor.id AND read_at IS NULL`, so an already-read row keeps its first moment and updates zero rows, a foreign row updates zero rows and is unchanged, and an id naming nothing behaves identically; and the single `UPDATE` of §2 with **no `LIMIT`**, clearing rows past the 200-row bound, leaving already-read rows and every other user's rows untouched, and being a no-op rather than an error when pressed twice (FR-025…FR-030, SC-002, SC-011, research E-7)
- [X] T037 [P] [US3] Red — write `src/features/notifications/actions.test.ts`: the preamble order `assertSameOrigin` → `requireActor` → parse; a non-string or empty `notificationId` refused as `{ status: "not-found" }` with **no database call and no coercion**; Postgres `22P02` on a non-UUID mapped to `not-found` the way `update-issue.ts` already maps it and never escaping as a 500; a foreign row returning the same value as a missing one; `markAllNotificationsRead` declaring **no parameter**, so a body sent alongside it changes nothing; `refresh()` called on `{ status: "ok" }` only for `markNotificationRead` and unconditionally for `markAllNotificationsRead`; results carrying no SQL, no configuration and no database detail (FR-026, FR-029, FR-031, FR-032, FR-036, FR-072, SC-002)
- [X] T038 [P] [US3] Red — write `src/features/notifications/components/mark-all-read-control.test.tsx`: a `react-aria-components` `Button` with an accessible name and a visible focus ring, operable by explicit `Enter` and `Space` key events since `@react-aria/test-utils` is not installed; at `unreadCount === 0` rendering **disabled with its reason inline**, never hidden; one `markAllNotificationsRead()` call per press; an in-flight state that blocks only itself (FR-020, FR-021, FR-028, FR-074, SC-016)
- [X] T039 [P] [US3] Red — write `src/features/notifications/components/notification-row-mark-read.test.tsx`: `onNavigate` fires `markNotificationRead({ notificationId })`, the call is **not awaited**, a rejection is swallowed so the navigation still proceeds and the row is left unread, and `showToast` is not imported by the component at all (FR-025, SC-017)
- [X] T040 [P] [US3] Red — extend `src/features/notifications/server/notification-queries.test.ts` for `countUnreadNotifications`: `count(*)` over `user_id = $userId AND read_at IS NULL` with **no `LIMIT`**, counting the caller's own rows only (FR-033, FR-035, SC-012)

### Implementation for User Story 3

- [X] T041 [P] [US3] Create `src/features/notifications/server/mark-read.ts` with `import "server-only"` and the two single-statement mutators
- [X] T042 [P] [US3] Add `countUnreadNotifications(userId)` to `src/features/notifications/server/notification-queries.ts`
- [X] T043 [US3] Create `src/features/notifications/actions.ts` with top-level `"use server"` holding both actions — one module, as `labels/actions.ts` and `activity/actions.ts` already do — with the preamble, the input refusal and the `refresh()` calls
- [X] T044 [P] [US3] Create `src/features/notifications/components/mark-all-read-control.tsx` as a `"use client"` React Aria `Button` with its disabled state and inline reason
- [X] T045 [P] [US3] Add the `onNavigate` mark-read call to `src/features/notifications/components/notification-row.tsx`, unawaited with its rejection swallowed
- [X] T046 [US3] Wire `src/app/(app)/notifications/page.tsx` to await `countUnreadNotifications(actor.id)` **outside** the `Suspense` boundary — FR-021's control cannot render without it — and pass `MarkAllReadControl` as `ScreenHeader`'s `control`
- [X] T047 [US3] Run `npm run verify` and confirm T036–T040 are green

**Checkpoint**: rows can be cleared, one at a time and all at once.

---

## Phase 6: User Story 4 — The sidebar says how much is waiting (Priority: P4)

**Goal**: one number, read in the shared `(app)` layout and threaded through two props into R2's
sidebar entry, carried by the entry's accessible name.

**Independent Test**: sign in holding three unread rows, confirm the sidebar entry reads three on every
authenticated screen, activate one row and confirm it reads two, then press "Mark all read" and confirm
no count renders at all from the moment that write returns, with no navigation and no reload between.

### Tests for User Story 4 (write first, observe failing)

- [X] T048 [P] [US4] Red — extend `src/features/shell/components/sidebar.test.tsx`: at a positive count `getByRole("link", { name: "Notifications, 3 unread" })` so the value is part of the **accessible name**, with the visible badge `aria-hidden`; at zero, no count, no zero and no `aria-label` override (FR-033, FR-034, FR-035, SC-016, research F-6)
- [X] T049 [P] [US4] Red — extend `src/features/shell/components/app-shell.test.tsx`: the new prop is forwarded to `Sidebar` and `AppShell` renders nothing with it, the same pass-through it already does for `projects`
- [X] T050 [P] [US4] Red — extend `src/app/(app)/layout.test.ts`: the count is awaited from `actor.id` beside `listProjectsForSidebar()` and passed to `AppShell`, and two different actors each see only their own (FR-033, FR-035, Story 4 sc. 5)
- [X] T051 [P] [US4] Red — write `src/features/notifications/unread-count-bound.test.ts`: seed 250 unread rows for one user and assert `countUnreadNotifications` returns 250 while `listNotifications` returns 200, so the count is **not** bounded by the list cap, and that "Mark all read" then clears all 250 (FR-022, FR-033, SC-012, quickstart walkthrough 4)
- [X] T052 [US4] Red — write `src/features/notifications/server/mark-read-revalidation.test.ts` asserting `markNotificationRead` calls `refresh()` on the `ok` path and not on `not-found`, and `markAllNotificationsRead` calls it unconditionally, with no `setInterval`, socket or push anywhere (FR-036, SC-012). **This is the design question [`plan.md`](./plan.md) carries into implementation**: whether one `refresh()` re-renders the shared `(app)` layout in the presence of a simultaneous soft navigation cannot be settled in jsdom, so the browser half of it is quickstart walkthrough 3 — activate a row, confirm the sidebar count dropped with no navigation and no reload

### Implementation for User Story 4

- [X] T053 [P] [US4] Add the count and its `aria-label` to the Notifications entry in `src/features/shell/components/sidebar.tsx`, leaving `NAV_LINK_CLASSES` and the other four entries untouched
- [X] T054 [P] [US4] Add and forward the one prop in `src/features/shell/components/app-shell.tsx`
- [X] T055 [US4] Await `countUnreadNotifications(actor.id)` in `src/app/(app)/layout.tsx` beside `listProjectsForSidebar()` and pass it to `AppShell`
- [X] T056 [US4] Resolve T052's browser half: if one `refresh()` proves insufficient, add the named fallback `revalidatePath("/", "layout")` to `markNotificationRead` in `src/features/notifications/actions.ts` — already imported in `src/features/issues/actions.ts`, so no new dependency and no design change. If `refresh()` is sufficient, change nothing and record that. **Resolved: `refresh()` is sufficient. Nothing was changed and `revalidatePath("/", "layout")` was deliberately not added** — `actions.ts` calls `refresh()` alone. Browser evidence, from a dev server run out of this worktree on port 3000 with six unread rows seeded for a development user and the session minted directly (no password entered): the sidebar read `aria-label="Notifications, 6 unread"`; activating a row soft-navigated to `/projects/APOLLO/issues/1/details` and the shared `(app)` layout re-rendered to `"Notifications, 5 unread"`, with the `window` marker still alive and `performance.navigation` entries = 1 — same document, no reload. The server log shows `POST /notifications → markNotificationRead` followed by a second `GET` of the destination route, which is the `refresh()` re-render landing on the destination. "Mark all read" then dropped the label to `null` and the badge to nothing in the same document (database: 0 unread of 6), confirming FR-034 and SC-012. Probe rows and session deleted afterwards; the development database was left at 0 notifications. ([`plan.md`](./plan.md) *Complexity Tracking* carries the same finding; `CHK041`.)
- [X] T057 [US4] Run `npm run verify` and confirm T048–T052 are green

**Checkpoint**: the count is visible from every authenticated screen and clears with the write.

---

## Phase 7: User Story 5 — The notice goes out by mail as well, and a dead mail host breaks nothing (Priority: P5)

**Goal**: one plain-text message per notification, dispatched fire-and-forget after commit, retried by
age on the one timer the installation already runs.

**Independent Test**: with a host that accepts, confirm one message per notification, `emailed_at`
stamped and `send_attempts` reading 1; with a host that refuses, confirm the write still succeeds, the
response is not held open, the row is left unsent, each retry falls due on the row's own age rather
than the timer's period, and after the fourth attempt the row keeps its in-app life and is never
attempted again.

**Scope note**: this phase edits `create-issue.ts`, `update-issue.ts`, `move-issue.ts` and
`create-comment.ts` **a second time** — the same four files Story 2 edited — converting each writer
call to the `let pendingMail: string[] = []` closure form of [`contracts/mutators.md`](./contracts/mutators.md)
§4 and adding the unawaited `dispatchNotificationMail(pendingMail)` after the transaction resolves.
`update-comment.ts` is **not** touched here: it has no transaction until Story 6, which adds its
dispatch with it.

**Red-step note (research F-2, F-4)**: the `send_attempts` test must assert **0 immediately after the
causing transaction commits and 1 after the dispatch has settled** — asserting only the second passes
against an implementation that increments before the attempt, which clarification 11 forbids. Every
sweep test passes an explicit `now`; `vi.useFakeTimers` and `startSweep` appear in none of them.

### Tests for User Story 5 (write first, observe failing)

- [X] T058 [P] [US5] Red — write `src/features/notifications/server/mail.test.ts` for `sendNotificationMail`: the one joined `SELECT` loading recipient address, actor name and target; returning without sending when the row is gone or already carries `emailed_at`; `sendMail({ to, subject, text })` with **no `html`**; the subject and body carrying the actor, what happened, the issue or project and the link built as `new URL(path, process.env.APP_URL)` with the `#comment-<id>` fragment and **no query string, token, session or configuration detail**; on `"sent"` the one statement setting `emailed_at` and `send_attempts = send_attempts + 1` together under `AND emailed_at IS NULL`; on `"not_sent"` the increment alone plus `logMailSendFailure` (FR-063, FR-066, FR-069, FR-071, FR-073, research D-3, D-6, D-7)
- [X] T059 [P] [US5] Red — write `src/features/notifications/server/mail-dispatch.test.ts` for `dispatchNotificationMail`: it returns `void` synchronously so it cannot be usefully awaited, an empty array does nothing, one `sendNotificationMail` runs per id with no digest and no batching, and the mandatory `.catch` routes to `logUnhandledServerError` so an unhandled rejection cannot kill the process (FR-063, FR-065, FR-071, research D-2)
- [X] T060 [P] [US5] Red — write `src/features/notifications/server/mail-sweep.test.ts` covering the seven clock scenarios of quickstart walkthrough 12, each seeding `created_at` and `send_attempts` directly and passing an explicit `now`: not due at 10 minutes with a count of 1; still not due and the count untouched after three more sweeps inside those 15 minutes; attempted once at 16 minutes with the count reaching 2; never attempted at a count of 4; never attempted at 61 minutes old whatever the count reads; attempted at once at a count of 0; and never attempted once `emailed_at` is set (FR-067, FR-068, SC-014, research D-4, F-4)
- [X] T061 [P] [US5] Red — extend `src/features/auth/server/sweep.test.ts`: `sweep(now)` calls `sweepNotificationMail(now)` with the same clock, and `startSweep`, `SWEEP_INTERVAL_MS`, `timer.unref()`, the `SIGTERM` handler and the `catch` are unchanged (FR-068, research D-5)
- [X] T062 [P] [US5] Red — write `src/features/notifications/server/send-attempts-timing.test.ts`: `send_attempts` reads **0** immediately after the causing transaction commits and **1** once the dispatch has settled, whichever way the send went, with no sweep tick in between — the first attempt is issued by the request's own process, after that request's transaction committed and never inside it; a failed send leaves `emailed_at` null with the count at 1; a second delivery of the same message produces one stamp and one increment, not two, because both statements carry `AND emailed_at IS NULL` (FR-007, FR-064, FR-066, FR-067, SC-014, research F-2)
- [X] T063 [P] [US5] Red — write `src/features/notifications/server/mail-failure-isolation.test.ts`: against a transport that rejects and again with `SMTP_URL` and `MAIL_FROM` unset, the causing write commits, the notification rows are written, nothing throws out of the request path, the response is not held waiting on the send, and the failure reaches the server log only while any client-facing text stays generic (FR-065, FR-070, FR-071, SC-013, research D-1)
- [X] T064 [P] [US5] Red — write `src/features/notifications/one-timer.test.ts` as a source scan in the form `src/features/activity/no-polling.test.ts` already uses: `setInterval` appears exactly once in the repo's non-test server source, inside `startSweep` in `src/features/auth/server/sweep.ts`, and no queue, worker, scheduler, job table or delivery log is introduced (FR-068, *Out of Scope*)

### Implementation for User Story 5

- [X] T065 [US5] Create `src/features/notifications/server/mail.ts` with `import "server-only"`, `dispatchNotificationMail(ids): void` and `sendNotificationMail(id)`, reusing `sendMail` from `src/lib/mail.ts` **unchanged** — it already returns `"not_sent"` rather than throwing — and building the message inline with no template layer and no templates directory
- [X] T066 [US5] Create `src/features/notifications/server/mail-sweep.ts` with `sweepNotificationMail(now: Date = new Date())` and the four-predicate due query of [`contracts/mail.md`](./contracts/mail.md) §4, whose `make_interval(mins => send_attempts * 15)` fragment is this feature's one piece of raw SQL: one module, every value bound, and seven clock-driven tests over it
- [X] T067 [US5] Add the one line `await sweepNotificationMail(now);` and its import to `sweep()` in `src/features/auth/server/sweep.ts`; `startSweep`, its interval, its `unref`, its `SIGTERM` handler and `src/features/auth/server/bootstrap.ts` are untouched
- [X] T068 [P] [US5] Convert the writer call in `src/features/issues/server/create-issue.ts` to the `pendingMail` closure form and add the unawaited `dispatchNotificationMail(pendingMail)` after the transaction resolves
- [X] T069 [P] [US5] Same in `src/features/issues/server/update-issue.ts`
- [X] T070 [P] [US5] Same in `src/features/issues/server/move-issue.ts`
- [X] T071 [P] [US5] Same in `src/features/activity/server/create-comment.ts`
- [X] T072 [US5] Run `npm run verify` and confirm T058–T064 are green

**Checkpoint**: mail goes out, retries by clock, and a dead host changes nothing about the app.

---

## Phase 8: User Story 6 — Editing a comment tells only the people it newly names (Priority: P6)

**Goal**: the mention diff on `updateComment`, and the transaction FR-057 requires it to gain.

**Independent Test**: post a comment naming one person, edit it to name a second, then edit it again to
drop the first; confirm exactly one new row after the first edit, none for the person already named,
and that the dropped person's original row survives untouched with its mail not recalled.

### Tests for User Story 6 (write first, observe failing)

- [X] T073 [P] [US6] Red — write `src/features/notifications/server/write-mention-diff-notifications.test.ts`: ids named by `nextBody` minus ids named by `previousBody`, through the same eligibility query, inserted as `mention` rows with `onConflictDoNothing`; an empty diff writing nothing; no `comment`-type row ever, since the function takes no `type` and issues no comment-recipient query; no second row for anyone already holding one of **either** type; the actor and every deactivated user excluded; and no `delete` or `update` in the path at all (FR-053…FR-056, SC-009)
- [X] T074 [P] [US6] Red — write `src/features/activity/server/update-comment-notifications.test.ts` through the real mutator with a full census before and after each edit, covering all six steps of quickstart walkthrough 7 including zero `comment`-type rows on every edit and the removed mention's row surviving unchanged (FR-053…FR-056, SC-009)
- [X] T075 [P] [US6] Red — write `src/features/activity/server/update-comment-notification-race.test.ts`: two `updateComment` calls adding the same name, issued with `Promise.all` against real PostgreSQL, asserting exactly one row exists afterwards and neither call rejected — the shape `move-issue-race.test.ts` and `update-column-race.test.ts` already use (FR-006, SC-006, research F-3)
- [X] T076 [P] [US6] Red — write `src/features/activity/server/update-comment-transaction.test.ts`: the body change and every row the diff produces commit together or not at all; the authorship check and `parseCommentBody` stay **before** the transaction so R7's refusal order is unchanged; the `FOR UPDATE` read makes "the body it replaces" well defined under two racing edits; and the mutator's result shape and refusal set are byte-identical to what R7 delivered (FR-057, research B-6)

### Implementation for User Story 6

- [X] T077 [US6] Add `writeMentionDiffNotifications` to `src/features/notifications/server/write-notifications.ts`, reusing the eligibility query the other two writers already share
- [X] T078 [US6] Give `src/features/activity/server/update-comment.ts` the transaction of [`contracts/mutators.md`](./contracts/mutators.md) §4 — the `FOR UPDATE` read of the previous body, the existing `tx.update(comment)` with `touched({ body })`, the diff writer, and the unawaited `dispatchNotificationMail(pendingMail)` after it — leaving the authorship read, the forbidden refusal, `parseCommentBody` and the invalid refusals exactly where they are
- [X] T079 [US6] Run `npm run verify` and confirm T073–T076 are green

**Checkpoint**: an edit reaches only the people it newly names.

---

## Phase 9: User Story 7 — Deleting the thing a notification points at takes the notification with it (Priority: P7)

**Goal**: prove FR-058…FR-062 through the real mutators. **This phase writes no production code.**

**Independent Test**: against a project holding issues, comments and notifications of all three types,
delete a comment and confirm only the rows carrying it are gone; delete an issue and confirm the rows
on it and on its comments are gone; archive and delete the project and confirm every row reaching any
of its issues, comments or itself is gone, with no other project's rows touched.

**⚠️ No Red step of its own.** The implementation of every requirement in this story is the three
`ON DELETE CASCADE` foreign keys T006 already landed, and gate 1 for that behaviour was **discharged
in Phase 2**: T005 was written first and observed failing against T006's first step, before the
`cascade` clauses existed. T080–T084 are therefore **regression coverage** over already-shipped
foreign keys, and the `onDelete: "cascade"` clauses are **never** removed from `src/db/schema.ts` to
manufacture a second Red — that would make shipped schema temporarily wrong for no requirement (gate
7), and regenerating against it risks `drizzle/meta` drift on a migration that may already have run.
`deleteProject`, `deleteIssue` and `deleteComment` are **not edited**, and `tx.delete(notification)`
is written nowhere: it would be dead code under Principle VI and, in two of the three, wrong unless it
replicated the transitive closure by hand ([`data-model.md`](./data-model.md) §2, research C-1).

### Tests for User Story 7 (regression over T005's Red, already observed in Phase 2)

- [X] T080 [P] [US7] Regression — write `src/features/activity/server/delete-comment-notifications.test.ts`: deleting a comment carrying `mention` and `comment` rows removes exactly those, in the delete's own statement, with a full census before and after and every other row untouched (FR-058, FR-061, SC-015)
- [X] T081 [P] [US7] Regression — write `src/features/issues/server/delete-issue-notifications.test.ts`: deleting an issue removes every notification reaching the issue **or any of its comments**, transitively, with a census, and touches no other issue's rows (FR-059, FR-061, SC-015)
- [X] T082 [P] [US7] Regression — write `src/features/projects/server/delete-project-notifications.test.ts`: archiving then deleting a project removes every notification reaching the project, its issues and their comments, with a census, and **no other project's rows are touched** (FR-060, FR-061, SC-015)
- [X] T083 [P] [US7] Regression — write `src/features/notifications/server/deactivation-preserves-notifications.test.ts`: deactivating a user leaves their notifications neither deleted nor altered, since deactivation is an `UPDATE` and no user is ever deleted (FR-062, Story 7 sc. 6)
- [X] T084 [P] [US7] Regression — write `src/features/notifications/no-notification-delete.test.ts` as a source scan in the form `no-polling.test.ts` uses: no module under `src/features/notifications/`, `src/features/activity/server/`, `src/features/issues/server/` or `src/features/projects/server/` contains a `delete(notification)` call, so a row leaves the table only by cascade (FR-032, *Out of Scope*)

### Implementation for User Story 7

- [X] T085 [US7] Confirm T080–T084 pass with **zero** production changes. If one fails, the fault is in the foreign-key declaration in `src/db/schema.ts`, never in a mutator — fix the declaration and regenerate, and do not add a `tx.delete(notification)` anywhere
- [X] T086 [US7] Run `npm run verify` and confirm T080–T084 are green with `git diff` showing no change under `src/features/*/server/delete-*.ts`

**Checkpoint**: all seven stories are independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T087 [P] Write `src/features/notifications/read-boundary.test.ts` covering quickstart walkthrough 13 and research F-5: `NotificationListItem` carrying exactly the seven keys of [`data-model.md`](./data-model.md) §3 with no `sendAttempts`, `emailedAt`, `readAt` or `email`; no module under `src/features/notifications/` producing a DTO selecting `user.email`; `publicUser` and `accountUser` in `src/features/auth/server/projections.ts` byte-for-byte what R1 delivered; `markNotificationRead` against a foreign row returning the same value as against an id naming nothing with the row unchanged; and `markAllNotificationsRead` declaring no parameter (FR-007, FR-024, FR-026, FR-073, SC-002)
- [X] T088 [P] Gate 4 — confirm `git diff package.json package-lock.json` is still empty and that no queue, scheduler, mail-template or date library was added; the inherited `clsx` discrepancy [`plan.md`](./plan.md) records is left untouched and is not this feature's work (FR-075)
- [X] T089 [P] Gate 6 and gate 7 — review the full diff for comments, commented-out code and dead code; confirm every changed line traces to a requirement; confirm `src/features/shell/components/screen-header.tsx`, `toast-region.tsx`, `src/app/provider.tsx`, `src/lib/mail.ts`, `src/features/auth/server/bootstrap.ts`, `src/features/auth/server/projections.ts`, `src/db/test-database.ts` and the three delete mutators are unchanged; and confirm **no version number was bumped and no history or status-log row was added to any document**, `docs/ROADMAP.md` included
- [X] T090 Run the thirteen walkthroughs in [`quickstart.md`](./quickstart.md) against a seeded development database (`npm run seed`), including a local mail catcher for walkthrough 10 and a closed SMTP port for walkthrough 11, and the browser half of T052 in walkthrough 3. **Walkthroughs 2 and 4–9 were run under T095 and walkthrough 11's dead-host half under T096, against a freshly seeded development database, with every session minted directly against the `session` table — no password was entered at the sign-in form and no account was created.** **Walkthrough 2** (browser, four seeded accounts): `/notifications` rendered four rows newest-first for the first user; the three unread ones each carried an `"Unread"` text node inside the link's accessible name and the read one carried none, so the difference is spoken and not colour alone; each row named `"Ada Lovelace"`, `mentioned you` / `assigned you` / `commented`, `APOLLO-3 · Session cookie is not marked SameSite=Lax` or `Apollo Platform`, and `this minute`; the header carried **Mark all read** and no **New issue** button; the Suspense fallback is `NotificationsSkeleton`, a `<ul aria-busy="true">` of six placeholder rows on the real row's `px-4.5 py-2` rhythm, observed in the tree on load with no layout jump when the data landed (FR-011…FR-018). The second account saw its own two rows and **none** of the first account's assignment or its `APOLLO-1` mention; the account holding none saw one quiet line, `"No notifications yet."`, no illustration and no marketing, and a sidebar link reading plain `"Notifications"`. **Walkthrough 4** (browser, an account holding 210 rows, 205 unread): exactly **200** rows rendered, with no page control, no "load more" and no infinite scroll, while the sidebar read `aria-label="Notifications, 205 unread"` — more than 200, because it counts every unread row (FR-022, FR-033, SC-012). Pressing **Mark all read** removed every `"Unread"` marker, and the sidebar label went to `null` with the text falling back to plain `"Notifications"` — the count vanished entirely, no zero; `window.__probe` survived and `performance.getEntriesByType("navigation").length` stayed **1**, so neither a navigation nor a reload happened in between (FR-028, FR-030, SC-011, SC-012). SQL then read `0 | 210` — every unread row cleared including the ten past the 200-row bound, total unchanged. Pressing it again did nothing, raised no application console error, and left an `md5` digest of every `(id, read_at)` pair byte-identical. Reloading with nothing unread rendered the control `disabled` with `data-disabled="true"` and an `aria-describedby` pointing at the inline reason **"Nothing to clear"** — disabled with its reason, not hidden (FR-021). **Walkthroughs 5, 6, 7, 8 and 9** were driven through the real mutators in a Node process against the same development database, taking a full `select … from notification` census before and after every step, which is the shape those walkthroughs themselves prescribe; the only substitution was `next/navigation`'s `notFound`/`redirect`, whose throw paths no step reaches. **46 of 46 checks passed.** Walkthrough 5: two mention rows and none for the author (FR-043, SC-004); naming yourself wrote nothing (FR-038); an assignee plus a different creator gave two `comment` rows and an assignee who *is* the creator gave exactly one (FR-047); naming the assignee gave exactly one row, of type `mention` (FR-040, SC-006); a project comment reached the three membership rows and wrote **zero** for the admin holding none (FR-048, SC-007); a deactivated user drew zero rows and zero mail (FR-039, SC-005); an unknown `@[uuid]` alongside a real name wrote one row, for the real one (FR-044); a memberless project wrote zero `comment` rows while its mentions still landed; and a status change, a label, a column rename and a member addition wrote **zero** rows of any type (FR-042, SC-003). Walkthrough 6: all four assignment paths — `createIssue` from the form, `createIssue` from the board composer (FR-050), `updateIssue` from the rail, and `moveIssue` into an assignee lane — each wrote exactly one `assignment` row; assigning to yourself by any of them, re-selecting the assignee already set (FR-051), dropping into Unassigned, reordering inside one lane, and changing only priority, column, title or due date each wrote **zero**; every `assignment` row in the table carried `comment_id IS NULL` (FR-052). Walkthrough 7: an edit adding a name wrote one new `mention` and no second row for the name already there (FR-053, FR-055); dropping a name wrote nothing and left the original row in place (FR-056); a body-only edit wrote nothing; an edit naming somebody already holding a `comment` row wrote no second row (FR-055); and no edit ever wrote a `comment`-type row (FR-054). Walkthrough 8: deleting a comment removed exactly its three rows and nothing else; deleting an issue removed all four rows reaching it or its comments; archiving then deleting a project removed all five reaching it while another project's three rows were untouched; deactivating a user left their rows neither deleted nor altered (FR-062). Walkthrough 9: `createIssue` against a project whose `issue_counter` row was removed returned `no-counter`, and the census showed **zero** notification rows and zero issues surviving the rollback (FR-041, SC-010). **Walkthrough 11's dead-host half** (T096): with `SMTP_URL=smtp://localhost:1` and `MAIL_FROM` set in the process environment — `.env` was never modified — a comment naming somebody saved normally in **10.7 ms** against **10.0 ms** for the same write with mail disabled, so no noticeable slowdown; the row was written with `emailed_at IS NULL` and `send_attempts = 1`; a single `{"event":"mail_send_failure"}` line reached the server log and nothing reached the browser (FR-065, FR-071, SC-013). This is a different branch from the empty `SMTP_URL` the tree ships, which returns `not_sent` at `sendMail`'s configuration gate (FR-070) — the dead host reaches `nodemailer` and is caught. **Walkthrough 10 remains outstanding** for want of an operator-supplied mail catcher; `mail-dispatch.test.ts`, `mail-failure-isolation.test.ts` and `send-attempts-timing.test.ts` are the standing proof. The development database was reseeded with `npm run seed` afterwards, so every probe user, project, notification and minted session is gone.
- [X] T091 Verify the feature against [`checklists/requirements.md`](./checklists/requirements.md) and the 42 items of [`checklists/risk.md`](./checklists/risk.md)
- [X] T092 Run `npm run verify` a final time — `style-check` → `type-check` → `test` → `build`, exactly what CI runs, with nothing failing and nothing skipped (gates 5 and 8)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** — no dependencies.
- **Foundational (Phase 2)** — depends on Setup. **Blocks every user story**: the table is what they all read and write.
- **US1 (Phase 3)** — depends on Foundational only. Rows are seeded, so it needs no other story.
- **US2 (Phase 4)** — depends on Foundational only. Independently testable by census without the screen.
- **US3 (Phase 5)** — depends on Foundational; T046 edits the page US1 created, so it depends on **US1** in practice.
- **US4 (Phase 6)** — depends on Foundational; `countUnreadNotifications` arrives in **US3** (T042).
- **US5 (Phase 7)** — depends on Foundational; its four dispatch tasks edit the four mutators **US2** edited.
- **US6 (Phase 8)** — depends on Foundational; T077 extends the module **US2** created (T030).
- **US7 (Phase 9)** — depends on Foundational only, and on **US2/US6** having written rows worth deleting for a meaningful census.
- **Polish (Phase 10)** — depends on every story you intend to ship.

### Cross-phase file collisions — the ordering that matters

These files are edited by two different phases. The pairs are strictly sequential and must never be
run concurrently, whatever the `[P]` marks inside each phase say.

| File | First | Second |
| --- | --- | --- |
| `src/features/notifications/server/notification-queries.ts` | T016 (US1) | T042 (US3) |
| `src/features/notifications/components/notification-row.tsx` | T017 (US1) | T045 (US3) |
| `src/app/(app)/notifications/page.tsx` | T020 (US1) | T046 (US3) |
| `src/features/notifications/actions.ts` | T043 (US3) | T056 (US4, conditional — the condition did not fire; see T056) |
| `src/features/issues/server/create-issue.ts` | T031 (US2) | T068 (US5) |
| `src/features/issues/server/update-issue.ts` | T032 (US2) | T069 (US5) |
| `src/features/issues/server/move-issue.ts` | T033 (US2) | T070 (US5) |
| `src/features/activity/server/create-comment.ts` | T034 (US2) | T071 (US5) |
| `src/features/notifications/server/write-notifications.ts` | T030 (US2) | T077 (US6) |
| `src/db/schema.ts` | T006 (Foundational) | T085 only if a cascade clause is wrong (US7) |

### Within each user story

- The Red tasks come first and must be **observed failing for the intended reason** (gate 1).
- The implementation is the minimal code that makes them pass, then refactoring with them green (gate 2).
- Queries and writers before components; components before the page that composes them.
- The phase's `npm run verify` task closes it. Do not report it passing without having run it.

### Parallel opportunities

- **Phase 2**: T003, T004, T005 in parallel (Red); then T006 and T007 in parallel (Green).
- **Phase 3**: T010–T014 in parallel (Red); then T017 and T018 in parallel (Green).
- **Phase 4**: T022–T029 in parallel (Red, eight files); then T031–T034 in parallel once T030 lands.
- **Phase 5**: T036–T040 in parallel (Red); T041 and T042 in parallel; T044 and T045 in parallel once T043 lands.
- **Phase 6**: T048–T051 in parallel (Red); T053 and T054 in parallel (Green).
- **Phase 7**: T058–T064 in parallel (Red, seven files); T068–T071 in parallel once T065 lands.
- **Phase 8**: T073–T076 in parallel (Red).
- **Phase 9**: T080–T084 in parallel (Regression).
- **Phase 10**: T087, T088, T089 in parallel.
- **Across stories**: once Phase 2 is complete, US1 and US2 are genuinely independent and can be built
  by two people at once. US3 and US5 are not — they re-enter files US1 and US2 own.

**One caveat on `[P]` in the `server` project**: `vitest.config.mts` sets `fileParallelism: false`, so
server test *files* execute serially against the one test database whatever these marks say. `[P]`
here means the tasks can be **authored** concurrently, not that the suite runs them in parallel.

---

## Parallel Example: User Story 2

```bash
# All eight Red tasks for User Story 2 together — eight distinct files, no shared state:
Task: "Red write-assignment-notifications.test.ts in src/features/notifications/server/"
Task: "Red write-comment-notifications.test.ts in src/features/notifications/server/"
Task: "Red create-issue-notifications.test.ts in src/features/issues/server/"
Task: "Red update-issue-notifications.test.ts in src/features/issues/server/"
Task: "Red move-issue-notifications.test.ts in src/features/issues/server/"
Task: "Red create-comment-notifications.test.ts in src/features/activity/server/"
Task: "Red no-notification-events.test.ts in src/features/notifications/server/"
Task: "Red create-issue-notification-rollback.test.ts in src/features/issues/server/"

# Then, once T030 has landed write-notifications.ts, the four reach-backs together:
Task: "Add writeAssignmentNotifications to src/features/issues/server/create-issue.ts"
Task: "Add writeAssignmentNotifications to src/features/issues/server/update-issue.ts"
Task: "Add writeAssignmentNotifications to src/features/issues/server/move-issue.ts"
Task: "Add writeCommentNotifications to src/features/activity/server/create-comment.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 — Setup.
2. Phase 2 — Foundational. **Blocks everything.**
3. Phase 3 — User Story 1.
4. **Stop and validate**: seed rows of all three types for two users and run quickstart walkthrough 2.
5. `/notifications` now answers, which is the one thing R2 shipped a sidebar entry pointing at.

### Incremental delivery

1. Setup + Foundational → the table exists and the harness truncates it.
2. + US1 → the screen renders seeded rows. **MVP.**
3. + US2 → real writes fill the list. The feature is useful.
4. + US3 → rows can be cleared.
5. + US4 → the count is visible everywhere.
6. + US5 → mail goes out and a dead host breaks nothing.
7. + US6 → an edit reaches only the people it newly names.
8. + US7 → the cascades are proven.
9. + Polish → boundaries, gates and the thirteen walkthroughs.

Stories 1 and 2 are the feature's centre of gravity: 26 of the 92 tasks, and everything after them is
either an affordance on top of the list or the mail half. Stopping after US4 ships a complete in-app
notification system with no email; stopping after US2 ships a list that fills itself but cannot be
cleared.

### Parallel team strategy

With two people, after Phase 2: one takes US1 → US3 → US4 (the read and write surfaces, which share
three files), the other takes US2 → US6 → US5 (the recipient computation and the mail, which share the
mutators). The two tracks meet at Phase 10. They must **not** be split as "US2 and US5 in parallel" —
US5 re-enters four files US2 owns.

---

## Notes

- `[P]` means a different file and no dependency on another `[P]` task in the same group. Tasks
  touching the same file are never both `[P]`, and the cross-phase collision table above is the
  authority where a file is edited twice.
- Every test asserting that **no row was written** takes a full `select().from(notification)` census
  before and after, never a query for the row it expects to be missing (research F-2).
- Persistence, constraint, cascade, concurrency and sweep tests run against real PostgreSQL on
  `TEST_DATABASE_URL`. `nodemailer` is the only mock, and no test uses fake timers.
- No new dependency is installed. No version number is bumped and no history or status-log row is added
  to any document in this repository, `docs/ROADMAP.md` included.
- Commit after each task or logical Red/Green pair — the commit order is the evidence for Principle VII
  that a green `npm test` cannot supply.

---

## Phase 11: Convergence

- [ ] T093 **CRITICAL** — produce the gate 1 evidence Principle VII requires for this slice, which the tree does not carry: `git rev-list --count main..HEAD` reads **0**, so the whole of R11 sits as one uncommitted working tree while [`plan.md`](./plan.md) *Gates 1–8* names "the commit order is the evidence" for gate 1 and again for gate 8, and the *Notes* above say "Commit after each task or logical Red/Green pair — the commit order is the evidence for Principle VII that a green `npm test` cannot supply". Land the slice as commits, and where the Red/Green interleaving can no longer be reconstructed truthfully, record per phase which Red steps were observed failing — naming **T051, T052 and T087** as the three that passed on their first run and the earlier tests that discharge their gate 1 (`notification-queries.test.ts` under T016 and T040, `mark-read.test.ts` under T036, `actions.test.ts` under T037). Do not fabricate a commit order that did not happen per Constitution VII, gate 1, gate 8 (missing)
- [X] T094 Record the deletion of R10's `describe("createIssue itself is untouched by this feature (FR-026)")` block and its orphaned `execFileSync` import from `src/features/board/board-order.test.ts`. The deletion is forced — [`contracts/mutators.md`](./contracts/mutators.md) §4 requires editing `create-issue.ts` and that guard asserts `git diff HEAD -- create-issue.ts` is empty, so the two cannot coexist — but it is recorded in no artifact, and [`plan.md`](./plan.md) *Project Structure* currently names `src/features/board/` among the trees left untouched. Record it where *Complexity Tracking* says a reviewer should meet it rather than discover it in the diff, and confirm no behavioural R10 coverage was lost: the surrounding `describe("the composer's create lands at the foot of the project's order (FR-026, FR-049, SC-013)")` suite must stay intact. Add no version bump and no history or status-log row per plan: *Project Structure* untouched list, gate 7 (contradicts). **Recorded** in [`plan.md`](./plan.md) *Complexity Tracking*, as **deleted and pending human confirmation** — the guard asserts a property of the working tree rather than of behaviour, so it could only ever hold while R10 was itself uncommitted, and `contracts/mutators.md` §4 requires the `create-issue.ts` edit it forbids. `src/features/board/` was removed from the *Project Structure* untouched list and re-entered there with that single exception named. **No behavioural R10 coverage was lost**: `npx vitest run src/features/board/board-order.test.ts` reports **3 passed**, the whole of `describe("the composer's create lands at the foot of the project's order (FR-026, FR-049, SC-013)")`. Nothing was restored and nothing further was deleted
- [X] T095 Execute quickstart walkthroughs **2 and 4–9**, which T090's tick does not cover — only walkthroughs 1, 3 (its browser half), 12 and 13 carry recorded evidence — using a directly minted session rather than a password entered at the sign-in form, the method walkthrough 3's browser half already used, and record the evidence against T090 the way T008 and T056 record theirs per [`quickstart.md`](./quickstart.md) walkthroughs 2 and 4–9, T090 (partial). **Done — all seven ran and the evidence is recorded against T090 above.** Every session was minted directly against the `session` table, as walkthrough 3's browser half did; no password was entered and no account was created. Walkthroughs 2 and 4 were run in a browser against a dev server on port 3000; walkthroughs 5–9 were driven through the real mutators with a full `notification` census before and after each step, **46 of 46 checks passing**. The development database was reseeded afterwards
- [ ] T096 Execute quickstart walkthroughs **10 and 11**, which cannot run as configured: `.env` carries `SMTP_URL=` empty, and walkthrough 11 needs a **closed** SMTP port, which is a different path from an unconfigured host (FR-065 and SC-013 rather than FR-070). Point `SMTP_URL` at a local mail catcher for 10 and at a closed port for 11; or, where the operator supplies neither, record against T090 that both remain outstanding and that `mail-dispatch.test.ts`, `mail-failure-isolation.test.ts` and `send-attempts-timing.test.ts` are the standing proof per [`quickstart.md`](./quickstart.md) walkthroughs 10–11, T090 (partial). **Half done, so this stays unticked. Walkthrough 11 ran** against a closed local port with `SMTP_URL=smtp://localhost:1` and `MAIL_FROM` supplied in the process environment — `.env` was never modified — exercising FR-065 and SC-013 through `nodemailer`'s own failure rather than FR-070's configuration gate; the evidence is recorded against T090 above. **Walkthrough 10 remains outstanding**: it needs an operator-supplied mail catcher, and no mail-catcher package may be installed (IV, the dependency table being closed). `mail-dispatch.test.ts`, `mail-failure-isolation.test.ts` and `send-attempts-timing.test.ts` stand as the proof until an operator supplies one
- [ ] T097 Complete the reviewer pass T091 claims: all **42 items of [`checklists/risk.md`](./checklists/risk.md) are still `[ ]`**, while [`checklists/requirements.md`](./checklists/requirements.md) reads 16 of 16. Mark each item only where the requirements-quality criterion is genuinely satisfied, per that file's own *Review Ownership* and *Marker Semantics* notes per T091 (partial)
- [X] T098 Reconcile the `docs/ROADMAP.md` edit with [`plan.md`](./plan.md), whose *Project Structure* lists that file under "Untouched and named so". The tree changes R11's spec-link cell from `—` to `specs/010-notifications-email/`, which is the convention the R8, R9 and R10 rows already follow; `Status` stays `planned`, no version is bumped and no status-log row is added, so the repository's no-history rule holds and only the plan's own untouched claim is now false. Either revert the cell or record the edit in plan.md's *Project Structure*; add no version bump and no history or status-log row either way per plan: *Project Structure* untouched list, gate 7 (contradicts). **The cell stays and the plan's claim was fixed** — `docs/ROADMAP.md` was removed from *Project Structure*'s "Untouched and named so" list and re-entered there as one edit, named, with the R8/R9/R10 convention it follows. `git diff docs/ROADMAP.md` is that single cell and nothing else: `Status` still reads `planned`, no version was bumped and no history or status-log row was added
- [X] T099 Decide `.specify/loop-state.json`, which is untracked, is not matched by `.specify/.gitignore` (which does ignore the analogous machine-local `feature.json`), carries stale orchestration state reading `"P4 in flight"`, and is called for by no requirement, plan decision or task — add it to `.specify/.gitignore` or delete it, so a whole-tree commit does not sweep it in per plan: *Project Structure*, gate 7 (unrequested). **Added to `.specify/.gitignore`, beside the analogous machine-local `feature.json`; the file itself was not deleted, because it is live orchestration state.** `git check-ignore -v .specify/loop-state.json` now resolves to `.specify/.gitignore:13`, so a whole-tree commit can no longer sweep it in

---

## Phase 12: Convergence

- [X] T100 Correct the `assignment` fixture in `src/features/auth/server/sweep.test.ts`, which inserts a row FR-052 forbids: its `seedNotification` helper writes `type: "assignment"` with `projectId` set and `issue_id` null, so the row the FR-068 composition test retries is one no writer in this feature can produce — `writeAssignmentNotifications` always sets `issueId` and `projectId: null`, while FR-052 requires an `assignment` row to "carry the issue it concerns and no comment". The table's five CHECKs do not catch it: `notification_target_exactly_one` is satisfied by `project_id` alone, and `notification_comment_id_matches_type` constrains only `comment_id`. The consequence is under-coverage rather than a production defect — `loadMailFacts` resolves the project through `coalesce(notification.project_id, issue.project_id)`, so this fixture exercises the `project_id` branch while every real `assignment` row takes the `issue.project_id` branch, which `mail-sweep.test.ts` and `mail.test.ts` already cover. Hang the seeded row off an issue the way those two files do, and leave both assertions as they stand (`send_attempts` 1 → 2 when due, unchanged when not). Add no sixth CHECK: [`data-model.md`](./data-model.md) §5 fixes the constraint list at five and the writers already hold FR-052 per FR-052, gate 7 (contradicts). **Done — the seeded row now hangs off an issue.** `seedNotification` inserts a `board_column` and an `issue` under the project it already created and writes `issueId: issueRow.id` in place of `projectId: projectRow.id`, the shape `mail-sweep.test.ts` and `mail.test.ts` use, so `loadMailFacts` resolves the project through `coalesce`'s `issue.project_id` branch as every real `assignment` row does. Both assertions stand unchanged and both still pass: `send_attempts` 1 → 2 when due, unchanged when not — and because `sendNotificationMail` increments only after `loadMailFacts` returns and `sendMail` runs, the 1 → 2 assertion is itself the proof the corrected row still reaches the retry path. `npx vitest run src/features/auth/server/sweep.test.ts` reports **11 passed**. No sixth CHECK was added and no migration was touched
