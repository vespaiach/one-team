# Tasks: Home roll-up (R12)

**Input**: Design documents from [`specs/011-home-roll-up/`](./)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/queries.md`](./contracts/queries.md),
[`contracts/screens.md`](./contracts/screens.md), [`quickstart.md`](./quickstart.md)

**Tests**: REQUIRED, and not because they were "requested". [`AGENTS.md`](../../AGENTS.md) Principle
VII is non-negotiable and gate 1 demands a test written **before** the implementation and **observed
failing for the intended reason**. Every production task below is therefore immediately preceded by
its own Red task. A production task may not start until its Red task has been run and seen to fail.

**Organization**: grouped by user story, in the priority order [`spec.md`](./spec.md) fixes
(P1 → P5), so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: file-disjoint from the other `[P]` tasks in the same phase, so an orchestrator may run
  them concurrently. **`[P]` never licenses running an implementation task alongside its own Red
  task** — the Red-first ordering in *Dependencies* binds regardless of the marker.
- **[Story]**: US1…US5, mapping to [`spec.md`](./spec.md)'s five user stories.
- Paths are repository-relative, as in [`plan.md`](./plan.md)'s *Project Structure*.

## Scope reminders that bind every task below

R12 is the one roadmap entry that **adds no table, no column, no migration, no mutator and no Server
Action** (FR-004). No task here may create `actions.ts`, a module carrying `"use server"`, a file
carrying `"use client"`, a migration, an index, or a dependency. `src/db/schema.ts`,
`src/db/tables.ts`, `drizzle.config.ts`, `drizzle/`, `package.json`, `next.config.ts`,
`vitest.config.mts`, `tsconfig.json` and `biome.json` are untouched by this feature.
`src/app/(app)/layout.tsx`, `app-shell.tsx`, `sidebar.tsx` and `screen-header.tsx` are untouched
(FR-002). `src/features/activity/server/feed-queries.ts` is untouched (FR-044) — R7's duplicate
comment row is recorded in [`plan.md`](./plan.md)'s *Complexity Tracking* and no task here acts on it.

---

## Adjudicated conflicts — resolved by `/speckit-analyze`

Five items where an artifact disagreed with another artifact. `/speckit-analyze` has adjudicated all
five, and the resolutions are encoded in [`spec.md`](./spec.md), [`plan.md`](./plan.md),
[`research.md`](./research.md) and in the tasks below. This table is the record of what was decided.

| # | Conflict | Raised by | Resolution now encoded | Tasks carrying it |
| --- | --- | --- | --- | --- |
| **A** | FR-035 requires any value reaching the route to be "rejected explicitly rather than coerced"; [`research.md`](./research.md) D-4 declines to write a validator for input the route cannot receive, calling it dead code under VI. | `checklists/reads.md` CHK008, `checklists/gates.md` CHK006 | **Adjudicated for D-4**: the route declares no `params`, no `searchParams` and no body, so no external value can influence any count; no validator is written. | T004, T005, T019 |
| **B** | FR-036 defines determinism as a tiebreak "on the ordering instant"; [`contracts/queries.md`](./contracts/queries.md) §5 orders **Your projects** by `lower(project.name), project.key`, which has no instant in it. | `checklists/reads.md` CHK011 | **Adjudicated**: the instant tiebreak binds **Assigned to you**, **Mentions** and **Recent activity** only. **Your projects** needs merely a deterministic order, so [`contracts/queries.md`](./contracts/queries.md) §5's `lower(project.name) asc, project.key asc` stands. | T023, T024, T062 |
| **C** | FR-044 forbids altering anything R5–R11 delivered and SC-014 requires every existing test to pass unmodified; the plan adds an exported function to R11's `notification-queries.ts`. Whether an additive export "alters" the module is unsettled. | `checklists/gates.md` CHK015, CHK017 | **Adjudicated**: a purely additive export is not an alteration, so adding `listRecentMentions` to R11's `notification-queries.ts` is permitted. | T035, T036 |
| **D** | The `formatRelativeTime` promotion to `src/lib/` edits one R7 source file and one R11 source file, and [`plan.md`](./plan.md) recorded it as pending reviewer confirmation. | `checklists/gates.md` CHK016 | **Adjudicated: approved.** `formatRelativeTime` already sits at exactly two call sites, so Principle I's threshold is met; both existing suites must stay green and unmodified. | T033, T034 |
| **E** | `src/app/(app)/home/page.test.ts` (R2's, shipped) asserts `expect(result).toBeNull()`. FR-001 requires the page to render six surfaces, so that assertion cannot survive — yet SC-014 requires every R1–R11 test to pass **unmodified**. | observed in the tree; not raised by any checklist | **Adjudicated**: SC-014 and FR-044 carve out that one assertion by name — it is replaced with a real no-header assertion, and no other R1–R11 test moves. | T004, T005, T065 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: establish the baseline this feature must not disturb. It installs nothing and configures
nothing (FR-045, gate 4).

- [x] T001 [P] Run `npm run verify` on the untouched branch and record the result as the green
      baseline SC-014 is measured against; capture the current test count so a later run can show no
      R1–R11 test was lost or skipped
- [x] T002 [P] Confirm the test environment [`quickstart.md`](./quickstart.md) *Prerequisites*
      requires: `TEST_DATABASE_URL` points at a database separate from development, `npm run db:migrate`
      leaves the R11 migration set unchanged, and `SHOW TimeZone;` reports the installation timezone
      the due-this-week window will be compared in (FR-008, SC-013)
- [x] T003 [P] Record the config baseline that must appear in no later diff — `package.json`,
      `next.config.ts`, `vitest.config.mts`, `tsconfig.json`, `biome.json`, `drizzle.config.ts`,
      `src/db/schema.ts`, `src/db/tables.ts`, `drizzle/` — so gate 4 and FR-004 are checkable against a
      recorded starting point rather than by inspection (FR-004, FR-045)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the page frame every one of the five stories renders inside — `requireActor()`, the
greeting, the absence of a header, and the ordered region into which each story mounts its surface.

**⚠ CRITICAL**: no user story work can begin until this phase is complete.

- [x] T004 Red — extend `src/app/(app)/home/page.test.ts` with the frame
      contract: `requireActor()` is awaited before anything renders; the greeting renders
      `displayName(actor)` — first name and last name, one space (FR-005); no header, no title block, no
      per-screen control and no New issue control appear (FR-002, US1 s7); an actor-less request
      propagates the `/signin` redirect and renders no fragment of the page (FR-003, US5 s4). Add the
      behavioural read-boundary assertion [`research.md`](./research.md) D-4 names — rendering with a
      `userId` value present in the request produces the caller's own greeting. Assert that **no**
      validator exists: conflict A is adjudicated to D-4 — the route can receive no external value, so
      none is written. **Replace the shipped `expect(result).toBeNull()` assertion in the "renders no
      header" case with a real no-header assertion** — that one assertion over-asserts FR-002 in a way
      FR-001 cannot survive, and SC-014 and FR-044 carve it out by name. Change nothing else in that
      case and no other R1–R11 test. Observe the new cases failing
- [x] T005 Implement the frame in `src/app/(app)/home/page.tsx`: replace
      `return null` with the greeting and the ordered container for the six surfaces FR-001 fixes,
      keeping the existing `requireActor()` call exactly as R2 wrote it. `HomePage` declares **no**
      `params` and **no** `searchParams`, and no input validator is added (D-4, conflict A
      adjudicated). No `loading.tsx` is added under `src/app/(app)/home/` (D-1). Minimal code to turn
      T004's new cases green, nothing more (gate 2)

**Checkpoint**: `/home` greets its viewer inside R2's headerless frame. Story surfaces can now mount.

---

## Phase 3: User Story 1 - Someone signs in and Home tells them what is theirs (Priority: P1) 🎯 MVP

**Goal**: the greeting, the three stat cards (assigned to you · due this week · unread) and the
**Assigned to you** list — the half of the page that answers "what is mine".

**Independent Test**: sign in as a user holding issues across more than one project, some due inside
the window and some not, plus read and unread notifications; open `/home` and confirm the greeting
names them, each card carries the right number, and the assigned issues are listed. Sign in as a user
with none of the three and confirm each surface says so in one line.

- [x] T006 [P] [US1] Red — `src/features/home/server/assigned-queries.test.ts` against real
      PostgreSQL: `listAssignedIssues(userId)` returns every issue whose `assignee_id` is the viewer,
      with **no** completion filter (an issue in a `done`- and one in a `canceled`-kind column both list,
      US1 s5), **no** project-status filter (an issue in an archived project lists, *Edge Cases*), **no**
      membership filter (an issue in a project the viewer holds no `project_member` row for lists,
      FR-012) and **no** row bound (seed more than 100, FR-010); each row carries the issue key from
      `formatIssueKey`, the title, the project name and the
      `/projects/<KEY>/issues/<number>/details` href (FR-011, FR-013); ordering is
      `created_at desc, id desc` and a seeded tie resolves identically across two reads (FR-036, SC-012).
      Seed a second user and assert their issues are absent. Observe it failing
- [x] T007 [P] [US1] Red — `src/features/home/server/assigned-due-window.test.ts` against real
      PostgreSQL, written to [`research.md`](./research.md) F-2 #1: seed assigned issues at
      `current_date`, `current_date + 6`, `current_date + 7`, `current_date - 1` and one with a null
      `due_date`, and assert the **identity** of the two rows carrying `dueThisWeek === true` — not
      merely that two do, which an off-by-one that counts day seven and drops today would also satisfy
      (FR-008, US1 s4, SC-013). Observe it failing
- [x] T008 [US1] Implement `src/features/home/server/assigned-queries.ts`: the `AssignedIssueRow` DTO
      of [`data-model.md`](./data-model.md) §3.1 and `listAssignedIssues(userId)` wrapped in React
      `cache()`, one statement joining `issue` to `project`, selecting
      `due_date between current_date and current_date + 6` as `dueThisWeek` so the comparison runs in
      PostgreSQL against the database session's `TimeZone` and never in the browser (B-1). No limit, no
      column-kind filter, no project-status filter. `server-only` arrives transitively through `@/db`
- [x] T009 [P] [US1] Red — `src/features/home/components/stat-cards.test.tsx`: three cards render in
      the order *assigned to you*, *due this week*, *unread*, each carrying a number **and** a text label
      naming what it counts, with the number conveyed by neither size, colour nor position alone
      (FR-006, `OT-UX-018`); the first two derive from one `listAssignedIssues` result — `rows.length`
      and the `dueThisWeek` count — so the card and its section cannot disagree (FR-007, SC-002); the
      third is `countUnreadNotifications(actor.id)`, unbounded and therefore equal to the sidebar's
      number for a viewer holding more than 200 notifications (FR-009, SC-003); a zero card renders the
      digit `0`, not an empty state (FR-040, US1 s6). Observe it failing
- [x] T010 [US1] Implement `src/features/home/components/stat-cards.tsx` as a Server Component
      reading the cached `listAssignedIssues` and R11's existing `countUnreadNotifications`. No
      `countAssignedIssues` query is added (B-2)
- [x] T011 [P] [US1] Red — `src/features/home/components/stat-cards-skeleton.test.tsx`: three
      card-shaped blocks in a row matching the real cards' geometry, `aria-busy="true"` as
      `NotificationsSkeleton` sets it, and no spinner (FR-038, SC-011). Observe it failing
- [x] T012 [P] [US1] Implement `src/features/home/components/stat-cards-skeleton.tsx`
- [x] T013 [P] [US1] Red — `src/features/home/components/assigned-issue-row.test.tsx`: the row names
      the issue key, the title and the project (FR-011); it is a `next/link` anchor to
      `/projects/<KEY>/issues/<number>/details` with an accessible name from its own text, reachable and
      operable by keyboard with a visible focus indicator, asserted with explicit keyboard events
      (FR-013, FR-042, E-1, F-4); it renders no control that changes anything. Observe it failing
- [x] T014 [P] [US1] Implement `src/features/home/components/assigned-issue-row.tsx` as a Server
      Component. No `react-aria-components` import and no `RouterProvider` (E-1)
- [x] T015 [P] [US1] Red — `src/features/home/components/assigned-section.test.tsx`: the section is a
      labelled region with a heading (FR-042, screens §4); it renders one row per assigned issue with no
      truncation (FR-010); when the list is empty it renders exactly **one** quiet line — no
      illustration, no call to action, no empty-state marketing (FR-040, SC-010, US1 s6). Observe it
      failing
- [x] T016 [US1] Implement `src/features/home/components/assigned-section.tsx`
- [x] T017 [P] [US1] Red — `src/features/home/components/assigned-skeleton.test.tsx`: an issue-row
      list skeleton carrying `aria-busy="true"`, no spinner or progressbar, and exactly three
      placeholder rows — the count FR-038 reserves for this unbounded section. Assert geometry, not
      cardinality: rendered beside `assigned-section.tsx` holding three issues, the skeleton's list
      frame, heading and per-row height match the loaded section's, so a three-row load shifts nothing
      (FR-038, SC-011). Do not assert that a load of any row count shifts nothing — FR-038 permits the
      section to change height. Observe it failing
- [x] T018 [P] [US1] Implement `src/features/home/components/assigned-skeleton.tsx`
- [x] T019 [US1] Red — extend `src/app/(app)/home/page.test.ts`: surfaces 2 and 3 mount below the
      awaited `requireActor()`, each in its own `<Suspense>` with its own skeleton fallback, in FR-001's
      order after the greeting; the assigned card's number and the section's row count are equal for a
      seeded data shape (FR-007, SC-002). Keep the read-boundary assertion behavioural, as T004 fixed
      it. Observe it failing
- [x] T020 [US1] Wire the stat cards and **Assigned to you** into `src/app/(app)/home/page.tsx`,
      each in its own `<Suspense>` (D-1)

**Checkpoint**: US1 is independently deliverable — the greeting, the three cards and the assigned
list all render and agree. This is the MVP.

---

## Phase 4: User Story 2 - Your projects, with how far along each one is (Priority: P2)

**Goal**: the viewer's **active** projects, each with name, status and a whole-number progress
percentage that never reads blank, a dash, "n/a" or an error, and never reads 100% while one counted
issue is open.

**Independent Test**: sign in as a member of an active project mixing done, canceled and open issues;
an active project with no issues; an active project whose every issue is canceled; an active project
with two `done`-kind columns; and an archived project. Confirm the section lists the active ones only,
each with the right percentage, and that both zero-denominator projects read 0%.

- [x] T021 [P] [US2] Red — `src/features/home/progress.test.ts`, **no database**, written to
      [`research.md`](./research.md) F-2 #2: all of `progressPercent(3, 8) === 38`,
      `progressPercent(0, 0) === 0`, `progressPercent(0, 5) === 0`, `progressPercent(199, 200) === 99`
      and `progressPercent(200, 200) === 100` in one Red step, because the 199/200 case alone is
      satisfied by an implementation that clamps everything to 99 and the 200/200 case is the *Edge
      Cases* entry forbidding that clamp on a complete project (FR-018, FR-019, US2 s1, s2, s3, s6,
      SC-004). Observe it failing
- [x] T022 [P] [US2] Implement `src/features/home/progress.ts`: `progressPercent(done, counted)` —
      `Math.round` for halves-up on non-negative input, a zero denominator returning `0`, and a rounded
      `100` with `done < counted` returning `99`, `done === counted` untouched. No database import, and
      it sits at the feature root rather than under `server/` so the UI test can use it
- [x] T023 [P] [US2] Red — `src/features/home/server/project-queries.test.ts` against real
      PostgreSQL: `listMemberProjectsWithProgress(userId)` starts from the viewer's `project_member`
      **rows**, so an admin never added to a project does not see it — `isMember` must not be reachable
      from this module (FR-015, B-4); `status = 'active'` only, an archived project absent (FR-014,
      US2 s4); the numerator counts issues across **all** `done`-kind columns and the denominator excludes
      issues across **all** `canceled`-kind columns (FR-017, US2 s5); a project with no issues and a
      project whose every issue is canceled each return a row with `done = 0, counted = 0` rather than no
      row, which is what the left joins are for (US2 s2, s3). Assert the FR-036 determinism property —
      two consecutive reads with no intervening write return an identical sequence — and assert the
      ordering key [`contracts/queries.md`](./contracts/queries.md) §5 fixes,
      `lower(project.name) asc, project.key asc`, which conflict B's adjudication confirms as
      sufficient for this section. Observe it failing
- [x] T024 [P] [US2] Implement `src/features/home/server/project-queries.ts`: the
      `ProjectProgressRow` DTO of [`data-model.md`](./data-model.md) §3.2 and one grouped statement with
      `count(*) filter (where board_column.kind = 'done')` over
      `count(*) filter (where board_column.kind <> 'canceled')`. The percentage is **not** a field — it
      is `progressPercent(done, counted)` at render. This query holds the page's only project-status
      filter. Order by `lower(project.name) asc, project.key asc`, the ordering
      [`contracts/queries.md`](./contracts/queries.md) §5 fixes and conflict B's adjudication confirms
- [x] T025 [P] [US2] Red — `src/features/home/components/project-progress-row.test.tsx`: name, status
      and the whole-number percentage render (FR-016, FR-019); the row is a `next/link` anchor to
      `/projects/<KEY>` with an accessible name, keyboard operability and a visible focus indicator
      (FR-042); no data shape renders a blank, a dash, "n/a" or an error (FR-018, SC-004). Observe it
      failing
- [x] T026 [P] [US2] Implement `src/features/home/components/project-progress-row.tsx`
- [x] T027 [P] [US2] Red — `src/features/home/components/projects-section.test.tsx`: a labelled
      region with a heading, one row per active project, and exactly one quiet line when empty (FR-014,
      FR-040, SC-010). Observe it failing
- [x] T028 [US2] Implement `src/features/home/components/projects-section.tsx`
- [x] T029 [P] [US2] Red — `src/features/home/components/projects-skeleton.test.tsx`: a project-row
      list skeleton carrying `aria-busy="true"`, no spinner or progressbar, and exactly three
      placeholder rows — the count FR-038 reserves for this unbounded section. Assert geometry, not
      cardinality: rendered beside `projects-section.tsx` holding three active projects, the skeleton's
      list frame, heading and per-row height match the loaded section's, so a three-row load shifts
      nothing (FR-038, SC-011). Do not assert that a load of any row count shifts nothing (FR-038).
      Observe it failing
- [x] T030 [P] [US2] Implement `src/features/home/components/projects-skeleton.tsx`
- [x] T031 [US2] Red — extend `src/app/(app)/home/page.test.ts`: surface 4 mounts in its own
      `<Suspense>` in FR-001's position, between **Assigned to you** and **Mentions**. Observe it failing
- [x] T032 [US2] Wire **Your projects** into `src/app/(app)/home/page.tsx`

**Checkpoint**: US1 and US2 both work independently. "What is mine" is complete.

---

## Phase 5: User Story 3 - The five most recent times somebody named you (Priority: P3)

**Goal**: five `mention` notifications, newest first, read and unread alike, unread rows carrying the
Notifications screen's dot — and activating one marks **nothing** read.

**Independent Test**: sign in as a user holding seven `mention` notifications plus a spread of
`assignment` and `comment` ones; confirm exactly the five newest `mention` rows render newest first
with dots only on the unread ones, that activating one navigates without clearing its dot or changing
the unread card, and that a second user's mentions never appear.

- [x] T033 [P] [US3] Red — `src/lib/relative-time.test.ts` pinning `formatRelativeTime(instant, now)`'s
      current behaviour exactly as `comment-row.tsx` and `notification-row.tsx` implement it today: the
      `en-US` locale and the full unit ladder, byte-identical in outcome (C-4, FR-024, FR-030). Observe
      it failing
- [x] T034 [US3] Implement the promotion: create `src/lib/relative-time.ts` and replace the
      private copy in `src/features/activity/components/comment-row.tsx` and in
      `src/features/notifications/components/notification-row.tsx` with a one-line import swap. **No
      behaviour changes and no existing test file is edited.** The task is not complete until
      `npx vitest run src/features/activity/components/comment-row.test.tsx` and
      `npx vitest run src/features/notifications/components/notification-row.test.tsx` are green with
      those files unmodified in the diff. This reach-back into R7's and R11's trees is **approved** —
      conflict D is adjudicated in its favour — and `formatRelativeTime` already sits at exactly two
      call sites today, so Principle I's threshold is met. Both existing suites staying green and unmodified
      remains the acceptance condition for this task
- [x] T035 [P] [US3] Red — `src/features/notifications/server/recent-mentions.test.ts` against
      real PostgreSQL, written to [`research.md`](./research.md) F-2 #4: seed **two** users each holding
      `mention` notifications and assert the second user's rows are absent from the first user's result,
      for `listRecentMentions` **and** for `countUnreadNotifications` — a single-user fixture passes
      against a query with no `WHERE user_id` at all (FR-027, SC-007, US3 s5). Assert five rows at most,
      newest first by `created_at desc, id desc` with a seeded tie stable across two reads (FR-021,
      FR-036); `assignment` and `comment` types absent (US3 s3); read and unread rows both present
      (FR-023); the returned `NotificationListItem.href` carrying the `#comment-<id>` anchor whenever the
      row has a `comment_id` (FR-025); and `listNotifications` and `countUnreadNotifications` returning
      exactly what they returned before (FR-044). Observe it failing
- [x] T036 [US3] Add the single export `listRecentMentions(userId, limit)` to the existing
      `src/features/notifications/server/notification-queries.ts`, reusing that module's private
      `composeHref`, `composeTargetPath` and `composeTargetLabel` helpers and its `NotificationListItem`
      type (C-1). `listNotifications` and `countUnreadNotifications` must be **byte-identical** after the
      edit, no parameter is added to either, and no existing test in
      `notification-queries.test.ts` is modified. Conflict C is adjudicated: a purely additive export
      is not an "altering" of the module under FR-044 / SC-014, so this export is permitted. Even so,
      do not restructure the module, do not extract a shared query builder, and do not move the two
      existing functions
- [x] T037 [P] [US3] Red — `src/features/home/components/mention-row.test.tsx`: the row renders the
      actor, the target label and a relative time in the Notifications screen's own shape (FR-024); an
      unread row carries the dot **and** an `sr-only` "Unread" text equivalent with the dot
      `aria-hidden`, and a read row reserves the same box so nothing shifts (FR-023, E-2); the row is a
      `next/link` anchor to the item's `href` including the `#comment-<id>` anchor, keyboard-operable
      with a visible focus indicator (FR-025, FR-042); and the module imports **neither**
      `markNotificationRead` **nor** `markAllNotificationsRead` **nor** R11's `notification-row.tsx`, and
      carries no `"use client"` (FR-026, FR-043, C-3, A-1). Observe it failing
- [x] T038 [US3] Implement `src/features/home/components/mention-row.tsx` as a Server Component
- [x] T039 [P] [US3] Red — `src/features/home/components/mentions-section.test.tsx`: a labelled
      region with a heading, at most five rows, exactly one quiet line when empty (FR-021, FR-040,
      SC-005, SC-010). Observe it failing
- [x] T040 [US3] Implement `src/features/home/components/mentions-section.tsx`
- [x] T041 [P] [US3] Red — `src/features/home/components/mentions-skeleton.test.tsx`: **five**
      mention-row-shaped blocks with `aria-busy="true"` (FR-038, screens §2). Observe it failing
- [x] T042 [P] [US3] Implement `src/features/home/components/mentions-skeleton.tsx`
- [x] T043 [US3] Red — extend `src/app/(app)/home/page.test.ts`: surface 5 mounts in its own
      `<Suspense>` in FR-001's position, between **Your projects** and **Recent activity**. Observe it
      failing
- [x] T044 [US3] Wire **Mentions** into `src/app/(app)/home/page.tsx`

**Checkpoint**: US1, US2 and US3 each work independently. Home still writes nothing.

---

## Phase 6: User Story 4 - What just happened, everywhere (Priority: P4)

**Goal**: the twenty most recent events anywhere in the installation, newest first, drawn from every
project feed and every issue feed at once, one row per comment, with no collapsing, no toggle and no
page control.

**Independent Test**: seed comments and activity across several projects and issues, sign in as a user
who belongs to **no** project, and confirm exactly twenty rows render newest first spanning more than
one project, each naming its actor, what happened and where — and that a twenty-first, older row is
absent with no control offering it.

- [x] T045 [P] [US4] Red — `src/features/home/server/activity-queries.test.ts` against real
      PostgreSQL: `listInstallationActivity(limit)` returns exactly twenty rows when twenty or more
      exist, newest first, spanning every project and issue with **no** membership filter and **no**
      project-status filter — asserted from a viewer who is a member of nothing (FR-028, FR-034, US4 s1,
      s2, s5, SC-008); ties across the union's **two source tables** resolve identically across two reads
      (FR-036, CHK012, SC-012); each row names its actor through `publicUser` and nothing wider (FR-037),
      its target label with the issue key and its project name (FR-030, US4 s4); five changes by one
      actor inside five minutes produce five rows, not one collapsed group (FR-031, quickstart 13); the
      module imports none of `listFeed`, `collapseFeed`, `filterFeedRows`, `getFeedFilter`,
      `setFeedFilter` and reads no `user.feed_filter` (FR-032, C-5); and `limit` is a module constant,
      never a caller- or request-supplied value (contracts §4). Observe it failing
- [x] T046 [P] [US4] Red — `src/features/home/server/activity-comment-dedupe.test.ts` against real
      PostgreSQL, written to [`research.md`](./research.md) F-2 #3: post the comment **through
      `createComment`**, not by inserting a `comment` row directly, so both the `comment` row and its
      `comment`-type `activity` record exist; assert exactly **one** row for that comment in the result
      and assert **which** one by id (FR-029). A direct insert passes against an implementation with no
      exclusion at all. Observe it failing
- [x] T047 [P] [US4] Implement `src/features/home/server/activity-queries.ts`: the
      `InstallationActivityRow` DTO of [`data-model.md`](./data-model.md) §3.4 and the three-step shape
      `listFeed` already uses — `comment` rows `union all` `activity` rows `where type <> 'comment'`
      ordered `created_at desc, id desc` limited to the module constant 20, then one actor hydration
      through `publicUser`, then one target resolution — so the union stays a union and the join fan-out
      stays outside the `LIMIT`. `src/features/activity/server/feed-queries.ts` is **not** edited, not
      parameterized and not called (FR-044, B-5)
- [x] T048 [P] [US4] Red — `src/features/home/components/activity-row.test.tsx`: the ten non-comment
      types render R7's `ActivityRow` sentence **composed**, not reimplemented, beside the target label,
      the project name and a relative time (FR-030, C-5); a comment renders as *actor · commented on ·
      target · relative time* with **no body** and no import of `src/components/shared/markdown` (E-3 —
      recorded in [`plan.md`](./plan.md) as this design's one interpretive call); the row is a
      `next/link` anchor, keyboard-operable with a visible focus indicator (FR-042). Observe it failing
- [x] T049 [P] [US4] Implement `src/features/home/components/activity-row.tsx` as a Server Component
- [x] T050 [P] [US4] Red — `src/features/home/components/activity-section.test.tsx`: a labelled
      region with a heading, up to twenty rows, exactly one quiet line when empty (FR-040, SC-010,
      US4 s3), and **no** page control, "load more", infinite scroll, sort control or Comments only /
      All activity toggle anywhere in the rendered output (FR-032, FR-033, US4 s2). Observe it failing
- [x] T051 [US4] Implement `src/features/home/components/activity-section.tsx`
- [x] T052 [P] [US4] Red — `src/features/home/components/activity-skeleton.test.tsx`: **twenty**
      activity-row-shaped blocks with `aria-busy="true"` (FR-038, screens §2). Observe it failing
- [x] T053 [P] [US4] Implement `src/features/home/components/activity-skeleton.tsx`
- [x] T054 [US4] Red — extend `src/app/(app)/home/page.test.ts`: surface 6 mounts last, in its own
      `<Suspense>`, completing FR-001's order. Observe it failing
- [x] T055 [US4] Wire **Recent activity** into `src/app/(app)/home/page.tsx`

**Checkpoint**: all four sections render. The page is feature-complete; US5 proves its properties.

---

## Phase 7: User Story 5 - Home reads and never writes (Priority: P5)

**Goal**: the whole-page properties — per-section skeletons matching their section's geometry, one quiet line per
empty surface, deterministic ordering, re-query on revisit, and zero writes proved by census rather
than by inspection.

**Independent Test**: open `/home`, exercise every element it renders and confirm no request mutates
anything; navigate away and back and confirm it re-queries; render it with each section empty and
confirm each says so in one line.

**Note on the Red step here**: T060, T061, T062 and T069 assert properties earlier phases were built
to hold, so a carelessly written version passes on its first run and is not a valid Red step (VII,
[`research.md`](./research.md) F-2). Each must first be observed failing against a deliberately broken
local variant — a stray write, a `"use client"` directive, an `ORDER BY` without its tiebreak, a
section query memoized across requests — which is then reverted.

- [x] T056 [P] [US5] Red — `src/app/(app)/home/page-suspense.test.ts`: five `<Suspense>` boundaries
      sit **below** the awaited `requireActor()`, each with its own section skeleton as fallback; the
      greeting needs no boundary; no `loading.tsx` exists under `src/app/(app)/home/`; and no
      full-screen spinner is rendered anywhere (FR-038, US5 s3, SC-011, D-1). Observe it failing
- [x] T057 [US5] Reconcile `src/app/(app)/home/page.tsx` with T056 — fallbacks, boundary placement,
      no `loading.tsx`
- [x] T058 [P] [US5] Red — `src/features/home/components/empty-states.test.tsx`: each of the four
      sections renders exactly **one** line of text when its data is empty, and the three cards render
      the digit `0` rather than an empty state (FR-040, SC-010, US1 s6, US4 s3, D-5). Observe it failing
- [x] T059 [US5] Reconcile `src/features/home/components/assigned-section.tsx`, `projects-section.tsx`,
      `mentions-section.tsx` and `activity-section.tsx` with T058 so each empty surface is exactly one line
- [x] T060 [P] [US5] Red — `src/features/home/server/zero-mutation-census.test.ts`: a full row census
      over **every** table in `src/db/tables.ts`' `ALL_TABLES` — not a spot check — taken before and
      after rendering all six surfaces with data, asserting every table identical; and specifically that
      an unread mention's `read_at` is still null after its Home row is activated and the unread count is
      unchanged (FR-026, FR-043, SC-006, SC-009, F-3). Observe it failing against a deliberately broken
      variant, then revert
- [x] T061 [P] [US5] Red — `src/features/home/read-only-census.test.ts`, a static file census over
      `src/features/home/`: no file carries `"use client"` or `"use server"`; no `actions.ts` exists; no
      module imports `markNotificationRead`, `markAllNotificationsRead`, `isMember`, `listFeed`,
      `collapseFeed`, `filterFeedRows`, `getFeedFilter`, `setFeedFilter`, `MENTION_TOKEN_PATTERN`,
      `mention-resolve`, `mention-queries` or `src/components/shared/markdown`; no module enforces,
      restates or re-implements invariant 14 — the `done` and `canceled` column kinds are read by the
      progress aggregate alone and by no guard (FR-020); and no module contains
      `setInterval`, `setTimeout`, `EventSource`, `WebSocket`, a focus listener, `revalidatePath`,
      `refresh()`, `"use cache"` or `unstable_cache` (FR-004, FR-022, FR-026, FR-032, FR-039, FR-041,
      FR-043, A-1, C-2, C-5, D-3, D-6, `OT-INV-014`). Observe it failing against a deliberately broken
      variant, then revert
- [x] T062 [P] [US5] Red — `src/features/home/server/ordering-determinism.test.ts`: seed a tie in
      each of the four sections' ordering key and assert two consecutive reads with no intervening write
      return identical sequences in all four (FR-036, SC-012). **Your projects** ties resolve on
      `lower(project.name), project.key` and the other three on FR-036's instant tiebreak (conflict B
      adjudicated). Observe it failing against a variant with the tiebreak removed, then revert
- [x] T069 [P] [US5] Red — `src/app/(app)/home/page-requery.test.ts`: US5 s2 — render Home for a
      seeded viewer, change the rows behind all six surfaces, then render it again in a fresh request
      scope and assert the second render reports the changed rows; the per-request `cache()` memo must
      not survive into the second render, so nothing a revisit shows comes from a cache spanning
      requests (FR-039, US5 s2, D-3). Observe it failing against a deliberately broken variant — the
      section queries hoisted into a module-level cache that outlives the request — with the failure
      being the second render returning the pre-change rows, then revert. This is US5 s2's Red step;
      T061's negative census over cache directives and [`quickstart.md`](./quickstart.md) scenario 16's
      manual walkthrough do not stand in for it (gate 1, VII)

**Checkpoint**: every acceptance scenario in all five stories is covered by a test that was written
first and observed failing.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T063 [P] Red then satisfy — `src/features/home/components/home-a11y.test.tsx`: every navigating
      row type (issue, project, mention, activity) carries an accessible name, is reachable and operable
      by keyboard using explicit keyboard events, and shows a visible focus indicator; each of the four
      sections is a labelled region navigable by heading; no state is conveyed by colour alone (FR-042,
      `OT-UX-017`, `OT-UX-018`, `OT-UX-019`, E-1, E-2, F-4). `@react-aria/test-utils` is not installed
      and is not added (IV, F-4)
- [x] T064 Confirm `docs/ROADMAP.md`'s R12 row: the `Sub-spec` cell points at
      `specs/011-home-roll-up/`, `Status` stays `planned`, and **no version is bumped and no history or
      status-log row is added**. The working tree already carries this edit; verify rather than repeat it
- [x] T065 [P] Audit the diff for SC-014: no test file belonging to R1–R11 is modified beyond the one carve-out below, and
      `npx vitest run src/features/activity/components/comment-row.test.tsx` and
      `npx vitest run src/features/notifications/components/notification-row.test.tsx` and
      `npx vitest run src/features/notifications/server/notification-queries.test.ts` are green
      unmodified. The one carve-out SC-014 and FR-044 name — the single
      `expect(result).toBeNull()` assertion in the "renders no header" case of
      `src/app/(app)/home/page.test.ts`, R2's frame test — is replaced with a real no-header assertion
      and nothing else in that file or any other R1–R11 test file moves
- [x] T066 [P] Audit the diff for gates 6 and 7: no comments, no commented-out code, no dead code
      (V, VI); every changed line traces to a requirement named in [`plan.md`](./plan.md)'s *Project
      Structure*; no adjacent code was "improved"; the four edits to files other entries own are
      exactly the four [`plan.md`](./plan.md) records and no more
- [x] T067 Run `npm run verify` — `style-check` → `type-check` → `test` → `build` — and see it pass
      (gates 5 and 8). A green `npm test` is not itself evidence of VII; the commit order is
- [x] T068 Walk [`quickstart.md`](./quickstart.md)'s eighteen scenarios against a seeded installation
      and confirm each observable outcome, including the browser-timezone check in scenario 3, the
      two-user read boundary in scenario 10, the one-row-per-comment check in scenario 12 and the
      two-minute no-polling watch in scenario 17

---

## Dependencies & Execution Order

### The rule that overrides every other ordering

**Red before Green, per pair (VII, gates 1–2).** Every implementation task is blocked by the Red task
immediately preceding it, and that Red task must have been *run* and *seen to fail for the intended
reason*. A `[P]` marker describes file-disjointness among siblings; it never permits an
implementation task to start before its own Red task is red.

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks all five stories** — nothing can mount
  before the page frame exists.
- **US1 (Phase 3)**: depends on Phase 2 only.
- **US2 (Phase 4)**: depends on Phase 2 only. Independent of US1.
- **US3 (Phase 5)**: depends on Phase 2 only. T034 (the `formatRelativeTime` promotion) blocks T038
  and, across phases, T049.
- **US4 (Phase 6)**: depends on Phase 2, and on T034 for `activity-row.tsx`'s relative time.
- **US5 (Phase 7)**: depends on all four section phases — its censuses render every surface.
  T069 carries the ID after T068 because no existing task is renumbered; it belongs to Phase 7 and
  runs with T056, T058, T060, T061 and T062, before Phase 8.
- **Polish (Phase 8)**: depends on every story phase intended for delivery.

### The one shared file

`src/app/(app)/home/page.tsx` and `src/app/(app)/home/page.test.ts` are touched by T004/T005,
T019/T020, T031/T032, T043/T044, T054/T055 and T057. **None of those is `[P]`** and they must be
serialized in that order, even when the story phases are otherwise run in parallel.

### Within each story

Query module → its DTO → the row component → the section → the skeleton → the page wiring. Skeletons
are independent of the queries and may be built at any point in their phase.

### Parallel opportunities

- T001, T002, T003 together.
- Within US1: T006, T007, T009, T011, T013, T015, T017 (Red steps, all distinct files); then
  T012, T014, T018 alongside T010.
- Within US2: T021, T023, T025, T027, T029; then T022, T024, T026, T030.
- Within US3: T033, T035, T037, T039, T041; then T042 alongside T038.
- Within US4: T045, T046, T048, T050, T052; then T047, T049, T053.
- Within US5: T056, T058, T060, T061, T062, T069.
- Across stories: once Phase 2 is green, US1, US2, US3 and US4 can be developed by four workers,
  serializing only their page-wiring pairs.

---

## Parallel Example: User Story 1

```bash
# Red steps for US1, all distinct files, all run together:
Task: "Red — assigned-queries.test.ts: scope, no filters, no bound, ordering"
Task: "Red — assigned-due-window.test.ts: four boundary days, by identity"
Task: "Red — stat-cards.test.tsx: three cards, labels, card equals section"
Task: "Red — stat-cards-skeleton.test.tsx"
Task: "Red — assigned-issue-row.test.tsx: key, title, project, link, keyboard"
Task: "Red — assigned-section.test.tsx: rows, no truncation, one quiet line"
Task: "Red — assigned-skeleton.test.tsx"

# Then the file-disjoint implementations:
Task: "Implement stat-cards-skeleton.tsx"
Task: "Implement assigned-issue-row.tsx"
Task: "Implement assigned-skeleton.tsx"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup — the baseline SC-014 is measured against.
2. Phase 2: Foundational — the frame. **Blocks everything.**
3. Phase 3: US1 — greeting, three cards, **Assigned to you**.
4. **STOP and VALIDATE**: [`quickstart.md`](./quickstart.md) scenarios 1–6.
5. This alone answers "what is mine" and is the landing page every sign-in arrives at.

### Incremental delivery

- Setup + Foundational → the frame renders.
- US1 → validate with quickstart 1–6 → **MVP**.
- US2 → validate with quickstart 7.
- US3 → validate with quickstart 8, 9, 10.
- US4 → validate with quickstart 11, 12, 13.
- US5 → validate with quickstart 14–18 plus the two censuses.
- Polish → `npm run verify`, the a11y sweep, the SC-014 and gate-6 audits.

### Notes

- `[P]` = different files, no dependency on an incomplete task. It never overrides Red-before-Green.
- Five artifact conflicts are recorded above, all five adjudicated by `/speckit-analyze`; the tasks
  they touch state the resolution they encode.
- Commit after each Red/Green pair. The commit order is gate 1's evidence — `npm test` runs with
  `--passWithNoTests`, so a green suite proves nothing about VII on its own.
- No task in this file may add a mutator, a Server Action, a `"use client"` file, a migration, an
  index, a dependency, a header on Home, a mark-read control, a feed toggle or a page control. Each is
  named in [`spec.md`](./spec.md)'s *Out of Scope* and in [`plan.md`](./plan.md)'s
  *Explicitly out of scope*.

---

## Phase 9: Convergence

Appended by `/speckit-converge` after the Phase 1–8 implement pass. No task above is renumbered,
unticked or rewritten, and neither [`spec.md`](./spec.md) nor [`plan.md`](./plan.md) is edited. The
scope reminders at the head of this file bind these two tasks exactly as they bind the rest.

- [x] T070 Remove the unimported `export` on the `ActivityActor` type in
      `src/features/home/server/activity-queries.ts` per Constitution VI (contradicts) — **CRITICAL**.
      The type is consumed only inside its own module, as `InstallationActivityRow.actor`, and no file
      under `src/` imports it; Principle VI names an unused **export** among the forms of dead code
      that MUST be removed before a commit, and Biome's `noUnusedVariables` does not flag one, so gate
      5 goes green with it in place while gate 6 does not. Change `export type ActivityActor` to
      `type ActivityActor` and change nothing else — no DTO field moves, no query moves, and
      `InstallationActivityRow` stays exported because `activity-row.tsx` imports it. This is a
      behaviour-preserving deletion covered by the existing green suite, the Refactor half of
      Red-Green-Refactor, so gate 1 asks for no new Red step here and none may be invented (VII, gate
      2). Not complete until `npx vitest run src/features/home/server/activity-queries.test.ts`,
      `npm run style-check` and `npm run type-check` are green
- [ ] T071 Walk [`quickstart.md`](./quickstart.md) scenarios 15 and 17 against a seeded installation
      in an authenticated browser session per tasks: T068 (partial) — the two of T068's eighteen
      scenarios that pass could not be observed, because no such session was obtainable. Scenario 15:
      throttle the database or the network, load `/home`, and confirm visually that the greeting and
      the three stat cards do not move, that every element keeps its horizontal position and its own
      height, and that the only movement is the vertical reflow below a section whose real row count
      differs from the rows its skeleton reserved (FR-038, SC-011, US5 s3). Scenario 17: sit on
      `/home` for two minutes with the server log visible and confirm no further request is issued
      (FR-041). This task adds **no** code and **no** test: both assertions are already carried by
      Red-first tests that pass — T011, T017, T029, T041 and T052 for the skeletons' geometry and
      reserved counts, and T061's static census for the absence of `setInterval`, `setTimeout`,
      `EventSource`, `WebSocket` and any focus listener under `src/features/home/`. If a scenario
      contradicts what those tests assert, stop and raise it rather than editing either the test or
      the requirement
