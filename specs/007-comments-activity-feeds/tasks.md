# Tasks: Comments and activity feeds

**Input**: Design documents from [`specs/007-comments-activity-feeds/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: **required, and written first.** Principle VII is non-negotiable in this repository and
change gate 1 asks for a test that was observed failing before its implementation. Every
implementation task below names the test task that must be Red before it starts.

**Organization**: by user story, in the spec's priority order. Each story is independently testable
against the *Independent Test* its phase states.

---

## Precondition — R2, R5 and R6, corrected against what actually shipped

**`plan.md`'s Technical Context now states directly that entries R2, R5 and R6 have landed and that
implementation is not blocked**, matching this tree rather than the tree the plan was originally
written against. All three have landed:

```bash
git log --oneline -1 -- 'src/app/(app)'                                   # R2's shell
git log --oneline -1 -- src/features/projects/server src/features/issues/server  # R5, R6
```

Both return commits, not nothing — `src/features/labels/` (R8) has landed too, ahead of its own
`Depends on: R6, R7` in `docs/ROADMAP.md`, though nothing there is this feature's concern (R8's own
`no-activity.test.ts` already asserts its three curation mutators write no activity row, and its
`addIssueLabel`/`removeIssueLabel` gaining `label_added`/`label_removed` calls is R8's own future reach-back
into this feature's writer, not a task this feature performs).

T001 below is where the plan's own assumptions about R5's and R6's shipped shape are checked against
the code, confirming the corrections already applied to `spec.md` and `plan.md` — this feature's
version of the check R6's own `tasks.md` T001 ran against R5.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US5]`, mapping to the spec's five user stories
- Every task names the file it touches and the requirement that puts it there

---

## Phase 1: Setup

**Purpose**: reconcile the plan against the shipped code, and prepare the one shared test fixture
every later phase's persistence tests assume.

- [X] T001 Read `src/features/projects/server/update-project.ts`, `create-project.ts`,
  `project-status.ts`, `membership.ts` and `src/features/issues/server/update-issue.ts` and confirm
  these five facts, already corrected into `spec.md` and `plan.md` directly, before any later task
  depends on them:
  - `user.feed_filter` already exists exactly as `FR-006` describes (`src/db/schema.ts`, `feedFilter`
    column) — this feature's migration touches no column on `user` (research A-7).
  - `project` carries **no `colour` column**, matching `spec.md`'s Assumptions section and `FR-051`'s
    now-four-field list — `name`, `description`, `start_date`, `target_date`. `colour` has no call site
    anywhere in this feature's diff, and the palette-naming rule this spec previously numbered FR-009 is
    retired rather than renumbered, per [`docs/product/specifications.md`](../../docs/product/specifications.md)
    §7's own Palette section, which states no per-project, per-column or per-label colour exists at all.
  - `updateProject`'s stored-row read is **already unconditional** — it runs on every call, for the
    membership check, not only when a date field is named — but it is **not** `FOR UPDATE` locked, and
    the mutator writes whichever fields `changes` names with **no comparison** to the row it just read,
    matching `plan.md`'s Complexity Tracking. This feature still adds the lock, the diff and the no-op
    short-circuit (`T040`).
  - `updateIssue`'s delta is computed exactly where research D-6 says it is — the `fields` object,
    compared field-by-field against the locked `row` — confirmed additive, no correction needed.
  - `createProject`, `setProjectStatus`, `addProjectMember` and `removeProjectMember` accept **no actor
    parameter today**, and `setProjectStatus`/`addProjectMember`/`removeProjectMember` run as a **single
    un-transacted statement**, not `db.transaction`. `FR-054` requires R5's own test files —
    `create-project.test.ts`, `project-status.test.ts`, `membership.test.ts` — to keep passing
    **unmodified**, and those files call all four with today's signature. `T039`–`T042` therefore add an
    **optional trailing `actorId`** rather than a required one, gate the `writeActivity` call on its
    presence, and wrap the three single-statement mutators in `db.transaction` so their write and their
    activity row commit together — `plan.md`'s Complexity Tracking third item, met once here rather than
    found in the diff.
- [X] T002 [P] Add `"comment"` and `"activity"` to `TRUNCATED_TABLES` in `src/db/test-database.ts`,
  ahead of `"issue"`, `"project"` and `"user"` — the tables they reference — so every persistence test
  from `T003` onward starts clean (R6 research E-3's precedent)

**On gate 1 for this phase.** T001 corrects assumptions and writes no code; T002 adds one array entry.
Neither has a test of its own — each is proved by every persistence test from T003 onward finding a
clean table.

**No dependency is installed.** `plan.md`'s Technical Context: "Dependencies this feature installs:
none." `Popover` and `ListBox` are already in `react-aria-components`.

**Checkpoint**: the plan's assumptions are checked against the shipped code, and the test runner
truncates both new tables.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the two tables, the one writer every later mutator calls through, and the one read every
feed page uses.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T003 [P] Write the failing shape and bound tests in `src/db/comment-constraints.test.ts`, against
  the real PostgreSQL instance `TEST_DATABASE_URL` names: a body of exactly 10 000 characters accepted,
  10 001 refused; `author_id`, `body`, `created_at` and `updated_at` each refused when null; exactly one
  of `issue_id`/`project_id` required — both present and both null are each refused; deleting the
  parent issue or the parent project removes the comment (FR-001, FR-005, `OT-DATA-011`, `OT-INV-010`,
  data-model §1)
- [X] T004 [P] Write the failing shape, bound and type tests in `src/db/activity-constraints.test.ts`:
  `from_value`/`to_value` accepted at exactly 200 characters, refused at 201; `type` admits exactly the
  seven values `FR-004` names and refuses an eighth; exactly one of `issue_id`/`project_id` required;
  `comment_id` set if and only if `type = 'comment'`, refused in both directions; deleting the parent
  issue, the parent project, or the referenced comment removes the row (FR-002, FR-004, FR-005,
  data-model §2, research A-2, A-4, A-6)
- [X] T005 [P] Write the failing absence test in `src/db/activity-shape.test.ts`: the `activity` table
  object carries no `updatedAt` key, following R6's own precedent for asserting a column's absence by
  the table object's own keys rather than by behaviour (FR-003, research A-5)
- [X] T006 Implement `comment` and `activity` in `src/db/schema.ts` per [`data-model.md`](./data-model.md)
  §1–2 — UUIDv7 keys, the `num_nonnulls` CHECK on each table, `activity`'s `(type = 'comment') =
  (comment_id IS NOT NULL)` CHECK, the seven-value `type` CHECK, the two 200-character bounds, the
  10 000-character body bound, cascading `issue_id`/`project_id`/`comment_id`, and the four indexes
  (research A-8) — makes T003, T004, T005 green
- [X] T007 Run `npm run db:generate`, read the generated SQL to confirm both CHECKs per table, the
  seven-value `type` CHECK, the four indexes, and that **no column is added to `user`** (T001's first
  finding), then commit the migration with its metadata (`AGENTS.md` → Drizzle) — depends on T006
- [X] T008 [P] Write the failing tests in `src/features/activity/server/write-activity.test.ts`: given
  an already-open transaction, inserts exactly one row carrying the type, target, actor and optional
  field/from/to/comment values it was passed, for each of the seven types; opens no transaction of its
  own and performs no authorization — verified by calling it inside a transaction the test itself rolls
  back and confirming the row existed only inside that transaction (FR-011, FR-013,
  contracts/mutators.md)
- [X] T009 [P] Write the failing tests in `src/features/activity/server/input.test.ts`: `parseCommentBody`
  trims, requires the result to be non-empty, admits exactly 10 000 characters, refuses 10 001, and
  never truncates (FR-040, FR-041)
- [X] T010 Implement `writeActivity` in `src/features/activity/server/write-activity.ts` per
  [`contracts/mutators.md`](./contracts/mutators.md)'s signature — one `INSERT`, nothing else (FR-011,
  FR-013, research B-1, B-2, B-3) — depends on T006; makes T008 green
- [X] T011 [P] Implement `parseCommentBody` in `src/features/activity/server/input.ts`, in R1's
  `parseEmail`/R6's `parseTitle` idiom — takes `unknown`, returns the trimmed string or `null`, never
  coerces or truncates (FR-040, FR-041) — makes T009 green
- [X] T012 [P] Write the failing tests in `src/features/activity/server/feed-queries.test.ts`:
  `listFeed({ issueId })` and `listFeed({ projectId })` each return only that target's own comment and
  activity rows, newest first by `(created_at, id)` descending; a first call with no cursor returns the
  50 most recent rows and whether a next page exists; a call with a cursor returns the next page intact
  across a row inserted between the two calls (keyset survives a concurrent insert, research F-1); an
  issue's feed never carries its project's own rows and the reverse; no row is ever filtered by the
  viewer's own membership (FR-014, `OT-AUTHZ-002`); `canEdit`/`canDelete` on a comment row are computed
  against the passed-in viewer id and `isAdmin` flag, both `null` on an activity row (FR-032, data-model
  §4, research F-1)
- [X] T013 Implement `listFeed` in `src/features/activity/server/feed-queries.ts` — the `UNION ALL` over
  `comment` and `activity` scoped to one target, keyset-paginated on `(created_at, id)`, joining
  `publicUser` for the actor (FR-014, FR-032, data-model §4, research F-1) — depends on T006; makes T012
  green

**Checkpoint**: both tables exist with every invariant the database owns; the one writer every later
mutator calls through is proven to do nothing but insert; the one read every feed page will use exists.
User story implementation can begin.

---

## Phase 3: User Story 1 — A member posts a comment where anyone can read it (Priority: P1) 🎯 MVP

**Goal**: `createComment`; the composer; the feed rendering comment rows newest-first with optimistic
posting; wired into both host pages.

**Independent Test**: sign in as a member of a project holding one issue and no comments, open that
issue, post a plain-text comment, confirm it renders at the top with author, avatar and relative time,
that a second signed-in non-member sees the identical comment on reload, and that the same sequence
succeeds on the project's own details feed. No other story needs to exist.

### Tests for User Story 1 (write first, observe failing) ⚠️

- [X] T014 [P] [US1] Write the failing tests in `src/features/activity/server/create-comment.test.ts`:
  writes one `comment` row and exactly one `activity` row of type `comment` carrying the new comment's
  id in `comment_id` and no field/from/to, in one transaction; a whitespace-only or 10 001-character
  body is refused and writes neither row; a `{ projectId }` target derives `isMember` from the project
  itself, a `{ issueId }` target derives it from the stored issue's own `project_id` — never from a
  client-supplied project id; a non-member is refused independently of which target shape was sent
  (FR-015, FR-040, FR-041, FR-045, FR-046, `OT-AUTHZ-004`, US1 s1, s2, s4, s5, s6, s7)
- [X] T015 [P] [US1] Write the failing tests in `src/features/activity/components/comment-row.test.tsx`:
  shows avatar, display name, body and a relative time; carries `id="comment-<id>"` unconditionally in
  the markup; carries neither an edit nor a delete control when `canEdit` and `canDelete` are both false
  (FR-028, FR-029, US1 s1, s8)
- [X] T016 [P] [US1] Write the failing tests in `src/features/activity/components/composer.test.tsx`:
  grows with content; trims on submit and refuses an empty-after-trim submission inline, issuing no
  `createComment` call; refuses a 10 001-character body on the field naming the bound, never truncating;
  ⌘-enter submits; disabled with `postReason` as its accessible description when `canPost` is false,
  never hidden (FR-021, FR-035, FR-039, FR-040, FR-041, FR-042, FR-061, US1 s4, s5, s6)
- [X] T017 [P] [US1] Write the failing tests in `src/features/activity/components/feed.test.tsx`: renders
  `Composer` fixed at the head and the initial page's rows newest-first, no tabs; posting applies
  optimistically — the new row renders before the action resolves — and a refusal rolls the optimistic
  row back and raises a toast naming the server's own returned message, never a generic fallback string
  (FR-027, FR-037, US1 s1)
- [X] T018 [P] [US1] Write the failing test in `src/features/activity/components/feed-skeleton.test.tsx`:
  matches the feed's own layout rather than a full-screen spinner (FR-060)

### Implementation for User Story 1

- [X] T019 [US1] Implement `createComment` in `src/features/activity/server/create-comment.ts` — one
  transaction: resolve the target's project (the stored issue's `project_id` for `{ issueId }`, the
  target itself for `{ projectId }`), run `isMember`, validate the body with `parseCommentBody`, insert
  the comment, call `writeActivity` with `type: 'comment'` and the new comment's id (FR-015, FR-045,
  FR-046, contracts/mutators.md) — depends on T010, T011, T013; makes T014 green
- [X] T020 [US1] Export `createComment` from `src/features/activity/actions.ts` under one top-level
  `"use server"` — `assertSameOrigin` → `requireActor()` → delegate → `refresh()` → return the typed
  result, never redirecting (contracts/mutators.md's eight-step shape) — depends on T019
- [X] T021 [P] [US1] Implement `src/features/activity/components/comment-row.tsx` — avatar, display
  name, plain body (mention resolution is US4's own addition — no token can exist in a body yet), a
  relative time, and the `comment-<id>` anchor; edit/delete slots left absent until US3 wires them
  (FR-028, FR-029) — makes T015 green
- [X] T022 [P] [US1] Implement `src/features/activity/components/composer.tsx` as one `"use client"`
  component — the growing plain-text field, trim-and-require validation, the 10 000-character bound,
  ⌘-enter submit, and the disabled-with-`postReason` state via React Aria's own slot mechanism (FR-021,
  FR-035, FR-039…FR-042, FR-061) — makes T016 green
- [X] T023 [US1] Implement `src/features/activity/components/feed.tsx` as one `"use client"` component
  taking `{ target, initialPage, canPost, postReason }`, rendering `Composer` and each row through
  `comment-row.tsx` directly — no dispatcher yet, since every row this story can produce is a comment;
  `T038` introduces the dispatcher once activity rows exist — with `createComment` wrapped in a
  transition and `useOptimistic` for the post/reconcile/roll-back cycle, using `showToast` from
  `src/features/shell/components/toast-region.tsx` on refusal (FR-027, FR-037, research F-1) — depends
  on T020, T021; makes T017 green
- [X] T024 [P] [US1] Implement `src/features/activity/components/feed-skeleton.tsx` matching the feed's
  own layout (FR-060) — makes T018 green
- [X] T025 [US1] Wire `<Feed target={{ issueId }} />` into `src/features/issues/components/issue-detail.tsx`
  immediately after the description, computing `canPost`/`postReason` from `isMember` server-side in
  `src/app/(app)/projects/[projectKey]/issues/[issueNumber]/details/page.tsx` and passing `initialPage`
  from `listFeed({ issueId })`, `Suspense`-wrapped below the page's own guard with T024's skeleton
  (FR-026, FR-060, contracts/screens.md) — depends on T013, T023, T024
- [X] T026 [US1] Wire `<Feed target={{ projectId }} />` into
  `src/features/projects/components/project-details-screen.tsx` as the screen's last section, after
  `DeleteProjectControl`, computed and wired the same way in
  `src/app/(app)/projects/[projectKey]/details/page.tsx` (FR-026, FR-060, contracts/screens.md) —
  depends on T013, T023, T024
- [X] T027 [US1] Refactor with the tests green across `create-comment.ts`, `comment-row.tsx`,
  `composer.tsx` and `feed.tsx`: no comment added, no dead code, no component taking a prop its scenario
  does not require (gates 2, 6)

**Checkpoint**: US1 is fully functional and testable on its own. A comment posts, renders immediately
and optimistically, and is visible to every signed-in user on both an issue's feed and its project's
feed.

---

## Phase 4: User Story 2 — Every change to a project or an issue writes its own history (Priority: P2)

**Goal**: the activity-row sentence renderer and the `feed-row` dispatcher; activity writing added to
`createProject`, `updateProject`, `setProjectStatus`, `addProjectMember`, `removeProjectMember`,
`createIssue` and `updateIssue`.

**Independent Test**: with a project holding no activity, rename it, add a member, archive it and
reopen it, and confirm four rows appear on its feed in that order, each naming the actor and the
change. Separately, create an issue, change its column and reassign it, and confirm three rows — one
`created` and two `field_changed` — appear on that issue's own feed and nowhere else.

### Tests for User Story 2 (write first, observe failing) ⚠️

- [ ] T028 [P] [US2] Write the failing tests in `src/features/activity/components/activity-row.test.tsx`:
  each of the six non-comment types renders the sentence [`contracts/screens.md`](./contracts/screens.md)'s
  table states; a `null` `from_value` or `to_value` renders the literal string `"None"`; no row of any
  type ever carries an edit or delete control (FR-028, FR-030)
- [ ] T029 [P] [US2] Write the failing test in `src/features/activity/components/feed-row.test.tsx`: a
  `comment`-kind row dispatches to `CommentRow`, every other kind dispatches to `ActivityRow` (FR-028)
- [ ] T030 [P] [US2] Write the failing tests in `src/features/projects/server/create-project-activity.test.ts`:
  `createProject` writes one `created` row naming the actor and one `member_added` row per seeded
  member, each carrying that member's display name in `to_value`, all inside the transaction that
  writes the project and its seeded rows; a call carrying no `actorId` — the shape R5's own
  `create-project.test.ts` already uses — writes no activity row and still creates the project exactly
  as before (FR-050, FR-054)
- [ ] T031 [P] [US2] Write the failing tests in `src/features/projects/server/update-project-activity.test.ts`:
  a call naming one differing field writes one `field_changed` row for it alone, naming `name`,
  `description`, `start_date` or `target_date` and the frozen old and new values; a call naming two
  differing fields writes two rows in the one transaction; a call whose named values all match the
  stored row writes nothing; the stored row is locked `FOR UPDATE` for the write's duration, verified by
  a concurrent `updateProject` on the same row waiting rather than reading a stale value (FR-051,
  SC-003, research D-2)
- [ ] T032 [P] [US2] Write the failing tests in `src/features/projects/server/project-status-activity.test.ts`:
  archiving writes one `archived` row and reopening writes one `reopened` row, each with no
  field/from/to, inside the same transaction as the status `UPDATE`; a call carrying no `actorId` — the
  shape R5's own `project-status.test.ts` already uses — writes no row and still changes the status
  exactly as before (FR-052, FR-054)
- [ ] T033 [P] [US2] Write the failing tests in `src/features/projects/server/membership-activity.test.ts`:
  `addProjectMember` writes one `member_added` row carrying the added user's display name in `to_value`;
  `removeProjectMember` writes one `member_removed` row carrying the removed user's display name in
  `from_value`; both inside the same transaction as their own write; a call to either carrying no
  `actorId` — the shape R5's own `membership.test.ts` already uses — writes no row and still changes the
  roster exactly as before (FR-053, FR-054, research D-4)
- [ ] T034 [P] [US2] Write the failing tests in `src/features/issues/server/create-issue-activity.test.ts`:
  `createIssue` writes one `created` row naming the actor, inside the same transaction as the issue, with
  no row for any optional value — column, priority, assignee, due date — set at creation (FR-055)
- [ ] T035 [P] [US2] Write the failing tests in `src/features/issues/server/update-issue-activity.test.ts`:
  a call naming one differing field writes one `field_changed` row for it alone, naming `title`,
  `description`, `column`, `priority`, `assignee` or `due_date`; a changed column or assignee freezes
  the column's or the person's **name**, not its id, on both `from_value` and `to_value`; a call whose
  named values all match the stored row writes nothing (FR-056, SC-003)
- [ ] T036 [P] [US2] Run R5's own suite (`npx vitest run src/features/projects`) and R6's own suite
  (`npx vitest run src/features/issues`) unmodified against this feature's diff and confirm every test
  still passes — this is the task that proves FR-054 and FR-057, not a new test file of its own

### Implementation for User Story 2

- [ ] T037 [P] [US2] Implement `src/features/activity/components/activity-row.tsx` per
  [`contracts/screens.md`](./contracts/screens.md)'s sentence table, rendering a `null` from/to value as
  `"None"` (FR-030) — makes T028 green
- [ ] T038 [US2] Implement `src/features/activity/components/feed-row.tsx` as the `kind` dispatcher, and
  switch `feed.tsx` to render every row through it instead of `comment-row.tsx` directly (FR-028) —
  depends on T023, T037; makes T029 green
- [ ] T039 [US2] Add an optional `actorId` field to `CreateProjectInput` and, when present, call
  `writeActivity` once for `type: 'created'` and once per seeded member for `type: 'member_added'`
  inside `createProject`'s existing transaction in `src/features/projects/server/create-project.ts`
  (FR-050, research D-1) — depends on T010; makes T030 green
- [ ] T040 [US2] In `src/features/projects/server/update-project.ts`: lock the existing unconditional
  read `FOR UPDATE` (widening scope on the same statement, not adding a second lock — T001, research
  D-2), diff each key in `changes` against the locked row, short-circuit to a no-op write when nothing
  differs, and call `writeActivity` once per differing field among `name`, `description`, `startDate`,
  `targetDate` (FR-051, SC-003, research D-2) — this feature's own reach-back beyond "add a call,"
  recorded per `plan.md`'s Complexity Tracking — depends on T010; makes T031 green
- [ ] T041 [US2] Add an optional `actorId` parameter to `setProjectStatus` in
  `src/features/projects/server/project-status.ts`, wrap its `UPDATE` in `db.transaction`, and call
  `writeActivity` for `type: 'archived'` or `'reopened'` when `actorId` is present (FR-052, T001) —
  depends on T010; makes T032 green
- [ ] T042 [US2] Add an optional `actorId` parameter to `addProjectMember` and `removeProjectMember` in
  `src/features/projects/server/membership.ts`, wrap each in `db.transaction`, add the one `SELECT` each
  needs for the target user's `publicUser` row, and call `writeActivity` for `type: 'member_added'` or
  `'member_removed'` when `actorId` is present (FR-053, research D-4, T001) — depends on T010; makes
  T033 green
- [ ] T043 [US2] Add one `writeActivity` call for `type: 'created'`, naming `input.actor.id`, inside
  `createIssue`'s existing transaction in `src/features/issues/server/create-issue.ts` (FR-055, research
  D-5) — depends on T010; makes T034 green
- [ ] T044 [US2] Add one `writeActivity` call per entry in the delta `updateIssue` already computes, in
  `src/features/issues/server/update-issue.ts`, resolving the changed column's and the changed
  assignee's **names** (via `listProjectColumns`/`publicUser`, reading both the old and the new value)
  before freezing them (FR-056, research D-6) — depends on T010; makes T035 green
- [ ] T045 [US2] Thread `actor.id` from each Server Action call site in
  `src/features/projects/actions.ts` — `createProject`, `setProjectStatus`, `addProjectMember`,
  `removeProjectMember` — into the `actorId` parameter T039–T042 each added (FR-050, FR-052, FR-053) —
  depends on T039, T041, T042
- [ ] T046 [US2] Refactor with the tests green across `activity-row.tsx`, `feed-row.tsx`, and the seven
  mutator files: no comment added, the `actorId`-present guard stated once per mutator rather than
  duplicated (gates 2, 6)

**Checkpoint**: US1 and US2 both stand. Every write R5 or R6 already ships now logs itself, visible on
the feed US1 built.

---

## Phase 5: User Story 3 — An author manages their own words; an admin removes anyone's (Priority: P3)

**Goal**: `updateComment`, `deleteComment`, the in-place edit gesture, and the delete control's inline
confirmation.

**Independent Test**: as the author of a comment, edit its text and confirm the change is visible
immediately; delete it and confirm it and only it disappears. As a different member, confirm no edit or
delete control renders on someone else's comment. As an admin who authored nothing there, confirm a
delete control renders on every comment and works.

### Tests for User Story 3 (write first, observe failing) ⚠️

- [ ] T047 [P] [US3] Write the failing tests in `src/features/activity/server/update-comment.test.ts`:
  updates `body` and `updated_at` through `touched()`, writes no activity row; the predicate is
  authorship alone — not current membership, not `isAdmin`; a whitespace-only edit is refused and the
  prior text kept; an author who has since left the project can still edit; an unknown `commentId`
  resolves to `not-found` (FR-016, FR-017, FR-019, FR-047, US3 s1, s4, s8)
- [ ] T048 [P] [US3] Write the failing tests in `src/features/activity/server/delete-comment.test.ts`:
  hard-deletes the row; the predicate is authorship or `isAdmin`; a second delete of the same id
  resolves to `not-found` rather than a second success; the comment's own activity row is gone
  afterward, verified as the schema's cascade rather than a second statement this mutator issues
  (FR-016, FR-048, US3 s5, s6, s7, spec → Edge Cases)
- [ ] T049 [P] [US3] Write the failing tests in
  `src/features/activity/components/comment-row-controls.test.tsx`: an edit control renders only when
  `canEdit`; a delete control renders only when `canDelete`; pressing delete swaps it in place for an
  inline Confirm/Cancel pair rather than deleting immediately; Cancel, or moving focus away, reverts to
  the original control with nothing deleted; only Confirm calls `deleteComment` (FR-028, FR-044, US3 s3,
  s7)
- [ ] T050 [P] [US3] Write the failing tests in `src/features/activity/components/comment-row-edit.test.tsx`:
  activating the body turns it into a field; Escape reverts to the saved text and writes nothing;
  ⌘-enter saves with exactly one `updateComment` call (FR-043, US3 s1, s2)

### Implementation for User Story 3

- [ ] T051 [US3] Implement `updateComment` in `src/features/activity/server/update-comment.ts` — the
  one-statement write through `touched()`, the authorship predicate resolved from the stored comment
  (FR-016, FR-017, FR-019, FR-047, contracts/mutators.md) — depends on T011; makes T047 green
- [ ] T052 [US3] Implement `deleteComment` in `src/features/activity/server/delete-comment.ts` — the
  authorship-or-admin predicate, the one `DELETE`, and the affected-row-count check that turns a second
  delete into `not-found` (FR-016, FR-048, contracts/mutators.md) — makes T048 green
- [ ] T053 [US3] Export `updateComment` and `deleteComment` from `src/features/activity/actions.ts`
  (contracts/mutators.md's eight-step shape) — depends on T051, T052
- [ ] T054 [US3] Add the in-place edit gesture — click to activate, Escape to revert, ⌘-enter to save —
  to `comment-row.tsx` (FR-043) — depends on T021, T053; makes T050 green
- [ ] T055 [US3] Add the edit and delete controls, and the delete control's inline Confirm/Cancel swap,
  to `comment-row.tsx` (FR-028, FR-044) — depends on T054; makes T049 green
- [ ] T056 [US3] Refactor with the tests green across `update-comment.ts`, `delete-comment.ts` and
  `comment-row.tsx` (gates 2, 6)

**Checkpoint**: US1–US3 stand together. A comment's author can fix or retract it, an admin can remove
anyone's, and nobody else can touch either.

---

## Phase 6: User Story 4 — Someone is named in a comment, and finds themselves while typing (Priority: P4)

**Goal**: `listMentionCandidates`, `resolveMentions`, the `@`-triggered `MentionPicker`, and the
composer's interplay between the picker and its own submit/cancel gestures.

**Independent Test**: on a project holding two members, one admin and one unrelated signed-in user,
type `@` and a fragment of each name and confirm the members and the admin rank above the unrelated
user and that a deactivated account never appears. Pick a suggestion, post, rename that person, and
confirm the comment now shows their new name.

### Tests for User Story 4 (write first, observe failing) ⚠️

- [ ] T057 [P] [US4] Write the failing tests in `src/features/activity/server/mention-queries.test.ts`:
  `listMentionCandidates({ issueId } | { projectId })` returns `scoped` (that target's project's members
  plus every admin) ranked above `everyoneElse`, both alphabetized, both excluding deactivated accounts
  unconditionally, re-read live rather than cached (FR-024, research E-2)
- [ ] T058 [P] [US4] Write the failing tests in `src/features/activity/server/mention-resolve.test.ts`:
  `resolveMentions` replaces every `@[<user_id>]` token in a body with that user's current display name,
  batched in one query per distinct id, and a deactivated user's mention still resolves (FR-022, FR-023,
  research E-1)
- [ ] T059 [P] [US4] Write the failing tests in `src/features/activity/components/mention-picker.test.tsx`:
  built from `Popover`/`ListBox`; opens on `@` with the full ranked list even with no letters typed yet;
  narrows on further letters, re-querying on every keystroke; closes on Escape without submitting the
  composer; selection inserts `@[<userId>]` at the trigger position, rendered to the typist as the
  display name (FR-024, FR-025, US4 s1, s4)
- [ ] T060 [P] [US4] Write the failing tests in
  `src/features/activity/components/composer-mention-interplay.test.tsx`: the first Escape while the
  picker is open closes the picker alone, leaving the composer's text and cursor untouched and requiring
  a second Escape to revert the field; ⌘-enter submits the composer's text exactly as typed, never
  implicitly selecting a highlighted suggestion, and closes the picker as a consequence of the submit
  (FR-063)
- [ ] T061 [P] [US4] Add the failing mention-rendering test to `comment-row.test.tsx`: a body carrying
  `@[<user_id>]` renders the resolved display name, never the raw bracket syntax (FR-022, FR-023)

### Implementation for User Story 4

- [ ] T062 [P] [US4] Implement `listMentionCandidates` in `src/features/activity/server/mention-queries.ts`
  (FR-024, research E-2) — makes T057 green
- [ ] T063 [P] [US4] Implement `resolveMentions` in `src/features/activity/server/mention-resolve.ts`
  (FR-022, FR-023, research E-1) — makes T058 green
- [ ] T064 [US4] Wire `resolveMentions` into `comment-row.tsx`'s body rendering (FR-022) — depends on
  T063; makes T061 green
- [ ] T065 [US4] Implement `src/features/activity/components/mention-picker.tsx` from `Popover`/`ListBox`,
  querying `listMentionCandidates` debounced on every keystroke after `@`, ranked and alphabetized
  within each group (FR-024, FR-025, research E-3, E-4) — depends on T062; makes T059 green
- [ ] T066 [US4] Wire the `@` trigger, the picker's open/close state, and the Escape/⌘-enter interplay
  into `composer.tsx` (FR-039, FR-063) — depends on T065; makes T060 green
- [ ] T067 [US4] Refactor with the tests green across `mention-resolve.ts`, `mention-queries.ts`,
  `mention-picker.tsx` and `composer.tsx` (gates 2, 6)

**Checkpoint**: a member can name someone while typing, and the name shown always matches who they go
by now, even after a rename.

---

## Phase 7: User Story 5 — A long history stays readable (Priority: P5)

**Goal**: `setFeedFilter`; the five-minute collapsing transform, including its re-merge across a page
boundary; 50-row pagination on scroll; the Comments only / All activity toggle.

**Independent Test**: on a feed seeded with more than 50 rows including a run of five field changes by
one actor inside one minute, confirm the run renders as one expandable line, the Comments only toggle
hides every non-comment row and its state is remembered on the other feed too, and scrolling to the foot
appends the next 50 without a full reload.

### Tests for User Story 5 (write first, observe failing) ⚠️

- [ ] T068 [P] [US5] Write the failing tests in `src/features/activity/server/feed-filter.test.ts`:
  `setFeedFilter` updates the caller's own `user.feed_filter`, requires nothing but a session, and
  writes no other row (FR-034, research C-6)
- [ ] T069 [P] [US5] Write the failing tests in `src/features/activity/components/collapse.test.ts` (a
  pure function, no rendering): consecutive non-comment rows by the same actor within five minutes of
  the immediately preceding row already in the run collapse into one group; a gap over five minutes, a
  different actor, or any comment row ends the run; re-running the function over an earlier page plus an
  appended one merges a run left open at the first page's foot with its continuation, rather than
  leaving two collapsed groups (FR-031, FR-062, research F-2)
- [ ] T070 [P] [US5] Write the failing tests in `src/features/activity/components/feed-pagination.test.tsx`:
  the feed loads 50 rows on open; scrolling to the foot of what is loaded calls `listFeed` again with the
  last row's cursor and appends the result without a full reload; the 50-row count is of raw rows
  fetched, unaffected by how many collapse into fewer lines (FR-032, SC-008)
- [ ] T071 [P] [US5] Write the failing tests in `src/features/activity/components/feed-filter-toggle.test.tsx`:
  a two-state toggle calling `setFeedFilter` on change; **Comments only** hides every non-comment row
  from what is already loaded, client-side, issuing no re-fetch; the initial state comes from the
  `feedFilter` prop with no flash of the other state (FR-033, FR-034, SC-009, US5 s3, s5)

### Implementation for User Story 5

- [ ] T072 [US5] Implement `setFeedFilter` in `src/features/activity/server/feed-filter.ts` and export it
  from `actions.ts` (FR-034) — makes T068 green
- [ ] T073 [P] [US5] Implement the collapsing transform in `src/features/activity/components/collapse.ts`,
  applied by `feed.tsx` at render time before handing rows to `feed-row.tsx` (FR-031, FR-062, research
  F-2) — depends on T038; makes T069 green
- [ ] T074 [US5] Add "load more on scroll to the foot" to `feed.tsx`, calling `listFeed` with the last
  loaded row's `(createdAt, id)` cursor and appending the result (FR-032, research F-1) — depends on
  T023, T073; makes T070 green
- [ ] T075 [P] [US5] Implement `src/features/activity/components/feed-filter-toggle.tsx` and wire it into
  `feed.tsx`, filtering the already-loaded rows client-side (FR-033, FR-034) — depends on T072; makes
  T071 green
- [ ] T076 [US5] Read `user.feed_filter` server-side in both host pages
  (`.../issues/[issueNumber]/details/page.tsx`, `.../details/page.tsx`) and pass it as `feed.tsx`'s
  initial `feedFilter` prop (FR-033, SC-009) — depends on T075
- [ ] T077 [US5] Refactor with the tests green across `collapse.ts`, `feed.tsx` and
  `feed-filter-toggle.tsx` (gates 2, 6)

**Checkpoint**: all five stories are complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T078 [P] Write the failing test and implement `countProjectComments` in
  `src/features/activity/server/feed-queries.ts` — `count(*) FROM comment WHERE project_id = $1` — and
  wire it into `src/features/projects/components/project-header.tsx`, read live on every render, next to
  the existing Board/Details tabs (FR-059)
- [ ] T079 [P] Write and confirm the failing-then-green absence test that `feed.tsx` and its host pages
  issue no `setInterval`/polling call of any kind — the feed re-queries only on navigation (FR-036,
  `OT-UX-006`)
- [ ] T080 [P] Add the accessibility pass across `composer.tsx`, `mention-picker.tsx`,
  `comment-row.tsx`'s delete confirmation and `feed-filter-toggle.tsx`: every disabled reason and inline
  error associated with its own control programmatically, every control an accessible name and a visible
  focus indicator, every colour-only state given a text or shape equivalent (FR-038, FR-061)
- [ ] T081 Walk the twelve [`quickstart.md`](./quickstart.md) walkthroughs end to end against a running
  installation (`npm run dev`), including its closing "What a browser cannot show you" table, and
  confirm each of `SC-004`, `SC-005`, `SC-006`, `SC-011`, `SC-012` and `SC-013` names a test that exists
  and passes
- [ ] T082 Audit the diff against gate 6 — no comment, no commented-out code, no dead code — with
  particular attention to the `actorId`-present guard repeated across `create-project.ts`,
  `project-status.ts` and `membership.ts` (Principles V, VI)
- [ ] T083 Audit the diff against gate 7 — every changed line traces to a requirement — confirming the
  only files touched outside `src/features/activity/` are the reach-backs `plan.md`'s Complexity
  Tracking and T001 name: `src/db/schema.ts`, `src/db/test-database.ts`, the four files in
  `src/features/projects/server/` and two in `src/features/issues/server/` `FR-050`…`FR-057` name, their
  `actions.ts` call sites, and the two host screens' pages and components
- [ ] T084 Confirm `package.json` gained no new dependency (gate 4, `plan.md` Technical Context)
- [ ] T085 Run `npm run verify` — `style-check`, `type-check`, `test`, `build` — and confirm it passes
  with nothing failing or skipped. `--passWithNoTests` means a green run is not by itself evidence of
  gate 1; the commit order is (gates 5, 8)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies. R2, R5 and R6 are already implemented in this tree (Precondition
  above) — nothing here waits on them landing.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every user story** — there is no table to write
  to, no writer to call, and no read to render from until it completes.
- **User stories (Phases 3–7)**: all depend on Foundational. See the story graph below.
- **Polish (Phase 8)**: depends on every story being complete.

### Story dependencies

The five stories are not fully independent, and the graph is worth stating plainly:

- **US1 (P1)** — depends on Foundational only. This is the MVP: the comment infrastructure and the Feed
  shell every later story extends.
- **US2 (P2)** — depends on Foundational for the writer, and on **US1** for `feed.tsx` and the two host
  pages it mounts into, since US2's own Independent Test reads "confirm four rows appear on its feed."
  The mutator edits themselves (`T039`–`T045`) need only Foundational and can be built in parallel with
  US1's UI work.
- **US3 (P3)** — depends on **US1** for `comment-row.tsx`, which its edit and delete controls extend.
- **US4 (P4)** — depends on **US1** for `composer.tsx` and `comment-row.tsx`, which the mention trigger
  and mention rendering extend.
- **US5 (P5)** — depends on **US1** for `feed.tsx`, and on **US2** for `feed-row.tsx`/`activity-row.tsx`,
  since collapsing (`FR-031`) only has non-comment rows to fold once US2 produces them.

### Within each story

- Tests are written and observed failing before the implementation that makes them green
- Schema and the shared writer before mutators; mutators before actions; actions before components;
  components before pages
- Each story ends with a refactor task run with its tests green (gate 2)

### Parallel opportunities

- T003, T004, T005 in Foundational — three test files, no shared state; then T006 alone, because all
  three target one schema file
- T008, T009, T012 in Foundational — three independent modules
- Every `Tests for User Story N` block is fully parallel — one test file each
- T030–T035 in US2 — six independent mutator test files across two features
- T062 and T063 in US4; T073 and T075 in US5
- With three developers after Foundational: A takes US1 (the MVP), B takes US2's seven mutator edits
  (Foundational-only dependency), C waits on US1's `comment-row.tsx`/`composer.tsx` for US3/US4 — then
  converges once US1 lands

---

## Parallel Example: User Story 1

```bash
# All five Red steps, one per file:
Task: "Mutator tests in src/features/activity/server/create-comment.test.ts"
Task: "Comment row tests in src/features/activity/components/comment-row.test.tsx"
Task: "Composer tests in src/features/activity/components/composer.test.tsx"
Task: "Feed tests in src/features/activity/components/feed.test.tsx"
Task: "Skeleton test in src/features/activity/components/feed-skeleton.test.tsx"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **critical, blocks everything**
3. Phase 3: User Story 1
4. **Stop and validate**: run quickstart walkthroughs 1 and 2. A comment posts, renders before anything
   else, and is visible to a non-member on their next view. Nothing yet logs a change to a project or an
   issue.

### Incremental delivery

1. Setup + Foundational → both tables, the writer, and the one read exist
2. **+ US1** → comments can be posted and read (MVP)
3. **+ US2** → every write R5 or R6 already ships logs itself on the feed US1 built
4. **+ US3** → a comment's author can fix or retract it; an admin can remove anyone's
5. **+ US4** → a member can name someone while composing
6. **+ US5** → a long feed narrows, folds and paginates rather than loading everything at once

Each increment is a usable product. Stopping after US2 leaves a read-and-audit-trail feed nobody can
correct; stopping after US1 leaves a feed that only talks, never explains what changed.

---

## Notes

- **Tests are not optional here.** Principle VII is non-negotiable and gate 1 requires each test
  observed failing for the intended reason before its implementation. A test that passes on its first
  run is not a valid Red step and must be corrected.
- Every persistence test runs against the real PostgreSQL instance `TEST_DATABASE_URL` names, on a
  separate database.
- **No async Server Component is rendered by a test.** Every feed component is synchronous and takes
  plain props; only the host page resolves data (research, contracts/screens.md).
- **No seam is built for R8, R9 or R11.** `writeActivity`'s signature admits every field a future
  `activity.type` value might need because this feature's own seven values already use a different
  subset of them (`plan.md` Principle VI row) — nothing here is widened further on R8's or R9's behalf.
- Commit after each task or logical group; the commit order is the evidence a reviewer needs for gate 1.
