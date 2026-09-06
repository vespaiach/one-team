# Tasks: Board — grouping, drag and ordering

**Input**: Design documents from [`specs/009-board-grouping-drag-ordering/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/mutators.md`](./contracts/mutators.md),
[`contracts/screens.md`](./contracts/screens.md), [`quickstart.md`](./quickstart.md)

**Tests**: **required, and written first.** Principle VII is non-negotiable and change gate 1 asks for
a test that was *observed failing for the intended reason* before its implementation. Every task below
is either a **Red** step, a **Green** step naming the Red it turns green, or a **Verification** step
that is explicitly *not* standing in for a Red. A Red that passes on its first run is not a valid Red
and must be corrected before the paired Green starts.

**Organization**: by user story, in the spec's priority order. Each story is independently testable
against the *Independent Test* its phase states.

---

## Precondition — R1, R2, R5, R6, R7, R8 and R9 are implemented on this branch

[`plan.md`](./plan.md)'s Technical Context states this and it was re-checked against the tree while
these tasks were generated:

- **R6** — `issue` with `sort_order` (a `customType` rendering `text collate "C"`), the composite
  `issue_project_id_column_id_fk`, `create-issue.ts`'s `generateKeyBetween(highest, null)` append,
  `update-issue.ts`'s `FOR UPDATE` on the single row and its three `field_changed` diffs,
  `issue-queries.ts`'s `listProjectColumns` / `listAssigneePool` / `resolveIssueWriteAccess` /
  `buildIssueWriteReason`, `input.ts`'s `parsePriority` / `parseTitle`, `formatIssueKey`,
  `create-issue-form.tsx`, `new-issue-control.tsx`, `issue-skeletons.tsx`, and `actions.ts`'s
  `assertSameOrigin({ headers: await headers() })` → `requireActor()` preamble (three actions, 103
  lines).
- **R9** — `move-column.ts`'s whole shape: neighbour id plus placement, row-before-role, the
  vanished-versus-illegal two-step probe, the early return on a no-op; `column-input.ts`'s
  `parsePlacement` and `parseColumnId`; `columns-section.tsx`'s `useDragAndDrop` wiring, its explicit
  optimistic overlay, its `dragAndDropHooks={admin ? … : undefined}` pattern and its per-refusal
  message map.
- **R7** — `activity`, its `activity_type_valid` CHECK which **already admits `field_changed`**,
  `writeActivity(tx, …)`, `truncateActivityValue`, and `activity-row.tsx`'s `displayOrNone` with
  `NONE_LABEL = "None"`.
- **R5 / R2 / R1** — `isMember`, `loadProjectByKey`, `ProjectHeader`, `ScreenHeader` (whose
  `control?: ReactNode` slot exists, renders, and is **unused**), `showToast`, `displayName`,
  `touched`, `db`, `requireActor`.

**No task below is blocked and none needs a placeholder import.** There is no NEEDS CLARIFICATION.

**One design detail the two contracts leave to the implementer**, resolved at T046/T047 rather than
left to be discovered: [`contracts/screens.md`](./contracts/screens.md) puts `<GroupingControl>` in
`ProjectHeader`'s `control` slot and, three paragraphs later, puts the grouping `useState` in
`BoardScreen`. Those two are siblings in the tree it draws, so one client boundary has to own both.
See T047.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — at the point this task becomes runnable it touches files no other
  simultaneously runnable `[P]` task touches. **Explicit batches are listed under *Parallel
  Opportunities*; run `[P]` tasks only inside the batch that names them.**
- A task is deliberately **not** marked `[P]` when it edits a file another task in the **same batch**
  edits. *Files edited by more than one task* below is the complete list and the authority; two tasks
  writing one file are never `[P]` against each other, and where such a task may still be worked
  beside a chain on other files, the batch prose and the task's own text say so.
- **[Story]**: `[US1]`…`[US6]`, mapping to the spec's six user stories. Setup, Foundational and Polish
  carry no story label.
- Every task names the file it touches, the requirement that puts it there, and how it is verified.
- Test files land in the Vitest project their extension selects: **`*.test.ts` → `server`** (node,
  `fileParallelism: false`, real PostgreSQL through `TEST_DATABASE_URL`), **`*.test.tsx` → `ui`**
  (jsdom, `@testing-library/react`). `vitest.config.mts` is not edited.
- **The project gate is `npm run verify`** — `style-check` → `type-check` → `test` → `build`. A task's
  own `verify:` line is the narrow check; the gate still runs before each phase checkpoint.

---

## Phase 1: Setup

**Purpose**: establish the baseline and confirm the three facts the whole design rests on — a real
separate test database, that `react-aria-components` already ships every handler the cross-lane drag
needs so gate 4 is met by adding nothing, and that **the schema does not change at all**.

- [X] T001 [P] Record the baseline: run `npm run verify` on `sdd/board-group-drag-order` and confirm
  it is green before a line is changed; confirm `TEST_DATABASE_URL` (`src/db/test-setup.ts`,
  `src/db/test-env-setup.ts`, `src/db/test-database.ts`) points at a database **separate** from
  development, and that `issue`, `activity`, `board_column`, `issue_label`, `label`, `project_member`,
  `project` and `user` are already in `TRUNCATED_TABLES` so `src/db/test-database.ts` needs **no
  edit** (research F-1, `AGENTS.md` → Testing).
  → verify: `npm run verify` exits 0; `git diff --stat src/db/` is empty and stays empty for the whole
  feature.

- [X] T002 [P] Confirm in `node_modules/react-aria-components/` that 1.20.0 exports `GridList` /
  `GridListItem`, `useDragAndDrop` and `DropIndicator` on the subpath entry points this codebase
  already imports from, and that `@react-types/shared/src/dnd.d.ts` declares `onInsert`, `onRootDrop`,
  `onReorder`, `acceptedDragTypes` and `getDropOperation` — the three cross-lane handlers R9 did not
  need. **No drag-and-drop library is added**; `@dnd-kit`, `react-beautiful-dnd`, `sortablejs` and
  every equivalent are barred by Principle IV and unnecessary under FR-044 (research C-1, C-2, plan
  *Dependencies this feature deliberately refuses*).
  → verify: the imports resolve under `npx tsc --noEmit` in a scratch file;
  `git diff --stat package.json package-lock.json` is empty and stays empty for the whole feature.

- [X] T003 [P] **Verification — not a Red, and it does not stand in for one.** Confirm against
  `src/db/schema.ts` that `issue.sort_order` exists as the `customType` rendering `text collate "C"`,
  that `issue.column_id` carries `issue_project_id_column_id_fk`, that `issue.priority` is guarded by
  `issue_priority_valid`, and that `'field_changed'` is **already** in `activity_type_valid` and in
  `ActivityType` in `src/features/activity/server/write-activity.ts`. Therefore **no table, no column,
  no widened CHECK, no index and no migration**: `src/db/schema.ts` is not edited and `drizzle/` gains
  no file for the whole feature (FR-027, FR-063, data-model *The schema change*, research A-1, A-5,
  B-7).
  → verify: `npm run db:migrate` applies the existing migrations with nothing new to apply;
  `git diff --stat src/db/schema.ts drizzle/` is empty and stays empty.

**Checkpoint**: baseline green, zero dependencies needed, zero schema change confirmed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the one read every story consumes and the pure ordering model every story's assertions
bite on. **⚠️ No user story work can begin until this phase is complete** — every screen, every drag
and every parity assertion reads `loadBoard`'s DTO, and every ordering claim is a statement about
`lane-model.ts`.

- [X] T004 **Red** — new `src/features/board/server/board-queries.test.ts` against real PostgreSQL:
  `loadBoard(projectKey, actor)` returns `null` for a key no project holds; otherwise a `BoardView`
  carrying `project`, `columns` in **board order** `(sort_order, id)`, `cards` for the **whole
  project** in `(sort_order, id)` with `order` as each card's zero-based rank, `labels` as
  `{ id, name }` only, an `assignee` public shape, a `commentCount` per card, `assigneePool`,
  `assignedOutsidePool` (people still assigned here who are outside the pool, each exactly once), and
  `canWrite` / `writeReason` — true for a member, true for an **admin holding no membership row**,
  false with a reason **naming the project** for a signed-in non-member. Assert the DTO exposes
  **no `sort_order`** and **no `project_id`** on a card, and no colour field on a label (FR-011,
  FR-031, data-model *DTOs*). Assert a fixed query count: no per-card and no per-lane read (D-5).
  (FR-002, FR-009–FR-014, FR-016, FR-018, FR-022, FR-023)
  → verify: the test fails — the module does not exist.

- [X] T005 **Green (T004)** — implement `src/features/board/server/board-queries.ts` with `loadBoard`
  only. One project read, one columns read, one issues read ordered `(sort_order, id)`, one labels
  join, one `GROUP BY issue_id` comment count, `listAssigneePool` reused, one read for the
  still-assigned-outside-pool set. **No index is added** — `comment_issue_id_created_at_idx` serves
  the count and `issue_label`'s primary key serves the join (A-5, D-5). `server-only` reaches it
  transitively through `@/db`.
  → verify: T004 green; `npx vitest run src/features/board/server/board-queries.test.ts` passes.

- [X] T006 [P] **Red** — new `src/features/board/lane-model.test.ts`: the comparator orders cards by
  `order` alone and is stable; grouping the project sequence into **column** lanes filters that one
  sequence and never re-sorts it; a lane's count equals the cards it holds; every card lands in
  exactly one lane, including a card with no assignee and no priority. **Pure functions — no React
  import and no import from any `server/` directory** (D-2).
  → verify: the test fails — the module does not exist.

- [X] T007 [P] **Green (T006)** — implement `src/features/board/lane-model.ts` with the comparator and
  the **column** grouping only. Assignee and priority grouping arrive at T041, the splice at T033 and
  the replay at T069; all four edit this file, so none of them is ever `[P]` against another.
  → verify: T006 green.

**Checkpoint**: one board read with one order, one pure model to assert against. User story work can
begin.

---

## Phase 3: User Story 1 — Anyone signed in opens a project and reads its board (Priority: P1) 🎯 MVP

**Goal**: `/projects/:projectKey` stops answering "This doesn't exist" and renders the board — columns
as lanes, cards with only the fields actually set, an empty lane's one quiet line, and lane-shaped
skeletons.

**Independent Test**: sign in against a project holding its five seeded columns and issues spread
across them; open `/projects/:projectKey`; confirm each column renders in board order with its name,
its live count and its cards in `(sort_order, id)` order; that a card shows its key and title plus
only the optional fields set on it; that an empty column shows one line and no illustration; and that
clicking a card lands on that issue's detail page. No other story needs to exist.

- [X] T008 [P] [US1] **Red** — new `src/features/board/components/board-skeleton.test.tsx`: the
  skeleton is **lane-shaped**, matching the lane layout it replaces, with no full-screen spinner and
  no `role="progressbar"` covering the page, and its frame is the frame the loaded board renders into
  so the layout does not shift. (FR-007, §4 *Loading*)
  → verify: the test fails — the component does not exist.

- [X] T009 [P] [US1] **Green (T008)** — `src/features/board/components/board-skeleton.tsx`, following
  `src/features/issues/components/issue-skeletons.tsx`.
  → verify: T008 green.

- [X] T010 [P] [US1] **Red** — new `src/features/board/components/issue-card.test.tsx`: a card shows
  the issue's key and title **always**; a priority glyph, its labels, its assignee's avatar, its due
  date and its comment count **only when set**; and **nothing else** — no placeholder, no empty slot,
  no "unassigned" chip for an unset field. A label is told apart by its **name alone and carries no
  colour swatch**, and nothing on the card carries a colour identifying a project, a column or a label.
  The key is the DTO's `key` string rendered as-is, never recomputed or reformatted. Activating the
  card navigates to that issue's own page URL — a full page, never a peek panel.
  (FR-010, FR-011, FR-012, FR-013, FR-014, SC-016)
  → verify: the test fails — the component does not exist.

- [X] T011 [P] [US1] **Green (T010)** — `src/features/board/components/issue-card.tsx`. The card face
  and nothing more; it owns no drag wiring (that arrives at T035) and no inline field control (the
  spec's *Out of Scope*).
  → verify: T010 green.

- [X] T012 [US1] **Red** — new `src/features/board/components/board-lane.test.tsx`: the lane shows its
  name and the number of cards **currently rendered** in it; an empty lane shows **one quiet line and
  no illustration**; the lane is a `GridList` carrying `aria-label` equal to the lane's name, so every
  drop target has an accessible name; cards render in exactly the order handed to it and the lane
  performs no sort of its own. (FR-008, FR-009, FR-023, FR-043)
  → verify: the test fails — the component does not exist.

- [X] T013 [US1] **Green (T012)** — `src/features/board/components/board-lane.tsx`: a `GridList` of
  `GridListItem`s wrapping `IssueCard`. **Read-only — no `dragAndDropHooks` and no composer yet**
  (T035 and T055).
  → verify: T012 green.

- [X] T014 [US1] **Red** — new `src/features/board/components/board-screen.test.tsx`: one lane per
  project column in board order under the default **Column** grouping; every card appears in exactly
  one lane; the lane strip scrolls horizontally when it exceeds the viewport, with **no responsive
  layout and no mobile breakpoint** anywhere in the markup; a lane renders every card it holds with no
  pagination and no "show more". (FR-006, FR-015 default, FR-016, the *lane holding hundreds of cards*
  edge case)
  → verify: the test fails — the component does not exist.

- [X] T015 [US1] **Green (T014)** — `src/features/board/components/board-screen.tsx`, `"use client"`
  at this boundary only. Column grouping only for now; the grouping state and control land at T047,
  the pending-move overlay at T037, the timers at T071 — all four edit this file and none is `[P]`
  against another.
  → verify: T014 green.

- [X] T016 [US1] **Red** — new `src/app/(app)/projects/[projectKey]/page.test.ts`, following the
  mocking idiom of `src/app/(app)/projects/[projectKey]/issues/new/page.test.ts`: the page awaits
  `requireActor()` first, so an unauthenticated request redirects to sign-in and **never** reaches the
  board or the Forbidden screen; `params` is awaited (async in Next 16); a key no project holds calls
  `notFound()`; **`forbidden()` is never called on this route and there is no membership gate** —
  every signed-in user reads every board; the page renders `ProjectHeader` with `current="board"` and
  the client board inside a `Suspense` boundary whose fallback is `BoardSkeleton`. Assert an archived
  project renders exactly as an active one.
  (FR-001, FR-002, FR-003, FR-004, FR-007, US1 sc.9–12)
  → verify: the test fails — the page is `await requireActor()` followed by an unconditional
  `notFound()`.

- [X] T017 [US1] **Green (T016)** — replace the placeholder in
  `src/app/(app)/projects/[projectKey]/page.tsx`. No `revalidate`, no `dynamic`, no `unstable_cache`:
  `requireActor()` reads `cookies()` and makes the route dynamic on every request, which is what
  satisfies FR-058 without a directive (research D-4). `ProjectHeader` is rendered **without** a
  `control` prop here — that prop does not exist until T045.
  → verify: T016 green; `npx vitest run "src/app/(app)/projects/[projectKey]"` passes.

**Checkpoint**: `npm run verify` green. The board renders and is readable by every signed-in user;
walkthrough 1 of [`quickstart.md`](./quickstart.md) passes. US1 is independently demonstrable.

---

## Phase 4: User Story 2 — A member drags a card to move it between lanes and to reorder it (Priority: P2)

**Goal**: `moveIssue` — one drop, one call, one issue row, four refusals — plus the optimistic drop,
its rollback and the one `field_changed` row a cross-lane Column drop writes.

**Independent Test**: as a member, drag a card from Todo to In Progress and confirm exactly one issue
row changed — its `column_id` and its `sort_order` — with **no other issue's index touched** (full
census); drag a card up two positions inside one lane and confirm only `sort_order` changed; confirm
the card renders in its new position before the server answers and returns to its origin with a toast
if the call fails.

- [X] T018 [P] [US2] **Red** — new `src/features/issues/server/move-issue-input.test.ts`:
  `parseGrouping` accepts exactly `"column"`, `"assignee"` and `"priority"` and rejects every other
  value **explicitly, never defaulting and never coercing**; `parseIssueId` accepts a well-formed UUID
  and rejects `""`, `"abc"`, a UUID with a trailing character and a non-string **without the value
  ever reaching a query**, since `issue.id` is a `uuid` column and a malformed value raises PostgreSQL
  `22P02`. Assert the module **re-exports nothing** — `parsePlacement` is R9's, imported from
  `src/features/projects/server/column-input.ts`, not re-declared (research B-1, E-4).
  (`AGENTS.md` → Principle II, gate 3)
  → verify: the test fails — the module does not exist.

- [X] T019 [P] [US2] **Green (T018)** — implement `src/features/issues/server/move-issue-input.ts`
  with `parseGrouping` and `parseIssueId` only. Two small predicates, **not a schema library and not a
  generic validator** — no dependency is added (III, IV, gate 4).
  → verify: T018 green.

- [X] T020 [US2] **Red** — new `src/features/issues/server/move-issue.test.ts` against real
  PostgreSQL, **Column grouping only**, shaped by SC-002's census (research F-3): read every issue's
  `sort_order`, `column_id`, `assignee_id` and `priority` in the project **before and after** each
  drop and assert **exactly one row changed**. Cover: a cross-lane drop writes `sort_order` **and**
  `column_id` and nothing else; a same-lane reorder writes `sort_order` **alone** and leaves
  `column_id` exactly as it was; `targetIssueId: null` with `placement: "before"` sorts before every
  card in the lane and with `"after"` sorts after every card in it; the written index sorts **strictly
  between** the two new neighbours when re-read under `ORDER BY sort_order, id`; `updated_at` is
  written explicitly through `touched()`; the input carries **no `sortOrder`, no `projectId` and no
  `rank`** and the project is derived from the stored row.
  (FR-028, FR-029, FR-030, FR-031, FR-033, FR-036, FR-038, SC-002, SC-003, SC-004, SC-005)
  → verify: the test fails — `move-issue.ts` does not exist.

- [X] T021 [US2] **Green (T020)** — implement `src/features/issues/server/move-issue.ts` for the
  happy path: parse `issueId`, `SELECT … FOR UPDATE` the moved row inside one `db.transaction`, derive
  `projectId` **from that row**, `isMember`, resolve the **column** lane, read the lane's cards
  `ORDER BY sort_order, id` **without a lock**, splice, `generateKeyBetween`, one `UPDATE` on the one
  row with `touched()`. **The lane is deliberately not locked** — FR-057 and SC-007 require the last
  write to win outright with neither client rejected, and any lock-and-recheck over the lane is one
  step from the staleness refusal the specification forbids (research B-5).
  → verify: T020 green; the census assertions hold.

- [X] T022 [US2] **Red** — new `src/features/issues/server/move-issue-refusals.test.ts` against real
  PostgreSQL, asserting the refusal ladder **in its fixed order**: an unparseable `issueId` raises
  `notFound()` before anything returns; a missing issue returns `not_found` **even for a non-member**,
  so step 2 precedes step 3 and the difference between two refusals leaks nothing; a non-member gets
  `forbidden` carrying a `reason` **naming the project**; a `laneId` naming no `board_column` row
  anywhere returns `not_found`; a `laneId` naming a column of **another project** returns
  `invalid_target`; a `targetIssueId` naming a card **not in this lane** returns `not_found`; a
  malformed `grouping` or `placement` returns `invalid_target`, **never `not_found`**. Assert
  `MoveIssueState` has **exactly five members** — `ok`, `not_found`, `invalid_target`, `forbidden`,
  `no_index_available` — and **no `invalid_input`**, which R9's `MoveColumnState` carries and FR-041's
  enumeration does not admit. Assert every refusal leaves the census unchanged.
  (FR-033, FR-034, FR-035, FR-041, research B-2, B-3, B-4)
  → verify: the test fails on the missing refusals; observe that a missing-issue call for a non-member
  fails by returning `forbidden` before it returns `not_found`, which is the ordering bug the test
  exists to prevent.

- [X] T023 [US2] **Green (T022)** — the refusal ladder in `move-issue.ts`, in the order
  [`contracts/mutators.md`](./contracts/mutators.md) fixes. The column case uses R9's exact two-step
  probe from `move-column.ts` — miss the project's set, then re-select by id alone to tell a vanished
  row from another project's. Expected failures are **typed results, never thrown** (`AGENTS.md` →
  TypeScript).
  → verify: T022 green.

- [X] T024 [US2] **Red** — new `src/features/issues/server/move-issue-noop.test.ts`: a drop resolving
  to the position the card already occupies, with no field change, returns `{ ok: true }` having
  written **nothing at all** — the census is byte-identical, `updated_at` is unchanged, and `activity`
  gains **no row**. (FR-032, SC-002, quickstart walkthrough 2)
  → verify: the test fails — the row is rewritten with a fresh index and `updated_at`.

- [X] T025 [US2] **Green (T024)** — the early return after the splice, comparing the reordered
  position against the original **and** the grouping's field against the stored row, following
  `move-column.ts`'s own early return. The mutator computes for itself whether the drop crossed lanes;
  a client claiming a cross-lane drop that is not one cannot make it write a field (research B-6).
  → verify: T024 green.

- [X] T026 [US2] **Red — the subtle one; read research F-2 before writing it.** New
  `src/features/issues/server/move-issue-tie.test.ts`: seed two issues holding an **identical**
  `sort_order`, drop a third between them, and observe the **raw `generateKeyBetween` throw escaping
  `moveIssue`** — before any `try` exists in the module. Assert also that no index anywhere in the
  project was renumbered by the attempt. **A test written after the guard would pass on its first run
  and would not be a valid Red** (`AGENTS.md` → VII, gate 1).
  → verify: the test fails with the library's own thrown error propagating out of the action, **not**
  with a returned refusal. Observe that exact failure before starting T027.

- [X] T027 [US2] **Green (T026)** — catch it and return `{ ok: false, error: "no_index_available" }`.
  **Nothing is renumbered, retried, nudged or rebalanced** — FR-024 declares a tie legal and forbids
  repairing it, so refusal is the only behaviour consistent with FR-024 and FR-028 together (research
  A-3). The `try` is the narrowest scope around the one call that throws.
  → verify: T026 green; the census after the refusal is identical to the census before it.

- [X] T028 [US2] **Red** — new `src/features/issues/server/move-issue-activity.test.ts` against real
  PostgreSQL: a cross-lane **Column** drop writes **exactly one** `field_changed` row on the issue's
  own feed, in the move's own transaction, with `field` holding the literal `"column"` and
  `from_value` / `to_value` holding the columns' **names** rather than ids, passed through
  `truncateActivityValue`; a same-lane reorder writes **none**; **no row lands on the project's feed**
  (`SELECT count(*) FROM activity WHERE project_id = …` is unchanged by every drop); a no-op writes
  none. Assert no activity type is added and `activity_type_valid` is not widened.
  (FR-060, FR-061, FR-062, FR-063, FR-064, SC-014)
  → verify: the test fails — no activity row is written.

- [X] T029 [US2] **Green (T028)** — one `writeActivity(tx, { type: "field_changed", target:
  { issueId }, field: "column", … })` inside the same branch that writes the grouping field, so a
  same-lane reorder never reaches it. `target` is `{ issueId }` **because that is the requirement**,
  not because `activity_target_exactly_one` would catch the mistake. The column's name comes from
  `listProjectColumns`, reused not rebuilt. **No file under `src/features/activity/` is edited** and
  **no shared diff-builder is extracted from `updateIssue`** — the two call sites want different
  shapes and Principle I says to wait for the second confirming one (research B-8).
  → verify: T028 green.

- [X] T030 [US2] **Red** — new `src/features/issues/move-issue-write-boundary.test.ts`, following
  `src/features/projects/column-write-boundary.test.ts`: the exported `moveIssue` **Server Action**
  runs `assertSameOrigin({ headers: await headers() })` then `requireActor()` then the mutator, in
  that order, and a cross-origin request is refused before the actor is resolved; on success it calls
  **neither `refresh()` nor `revalidatePath()`** — the board already renders the optimistic result and
  FR-054's own re-query reconciles it, so a server refresh per drop would fight the overlay FR-056
  requires be preserved (research B-10).
  → verify: the test fails — the action does not exist.

- [X] T031 [US2] **Green (T030)** — append the `moveIssue` action to
  `src/features/issues/actions.ts`, following the preamble the three actions there already share. A
  fourth action in a 103-line module leaves its intent obvious; **no new action module is created**,
  the opposite of R9's split for the opposite reason (research B-10).
  → verify: T030 green.

- [X] T032 [P] [US2] **Red** — extend `src/features/board/lane-model.test.ts` (second wave, same file
  as T006): `applyDrop` removes the moved card from the project sequence and reinserts it per
  `(targetIssueId, placement)` — before a card, after a card, at a lane's head, at a lane's foot —
  producing **the same lane order the mutator produces** for the same inputs; an abandoned drop leaves
  the sequence untouched; the function **never mutates its inputs** (Rules of React, React Compiler is
  enabled). **Not `[P]` against T006/T007/T041/T069.** (FR-031, SC-003, research D-2)
  → verify: the test fails — `applyDrop` does not exist.

- [X] T033 [P] [US2] **Green (T032)** — add `applyDrop` to `src/features/board/lane-model.ts`. The
  splice exists **twice on purpose** — here over DTOs in the browser, and in `moveIssue` over rows
  inside a transaction — and is **not** extracted into a shared module: `src/features/board/` may not
  import from a `server/` directory nor the reverse. The contracts say what each must produce; T020's
  census and T032's expectations assert the two agree (research D-2).
  → verify: T032 green.

- [X] T034 [US2] **Red** — new `src/features/board/components/board-lane-drag.test.tsx`: the lane's
  `GridList` receives `dragAndDropHooks` whose `acceptedDragTypes` is a **single board-card drag
  type**, so nothing else on the page — or dragged in from outside the browser — can land on a lane;
  each card carries a `Button slot="drag"` with an accessible name naming the issue; `onReorder`
  produces a same-lane payload from `target.key` and `target.dropPosition`, `onInsert` produces the
  same shape against **another** lane's id, and `onRootDrop` on an **empty** lane produces
  `{ targetIssueId: null, placement: "after" }`. (FR-043, FR-044, research C-2)
  → verify: the test fails — `board-lane.tsx` passes no `dragAndDropHooks`.

- [X] T035 [US2] **Green (T034)** — wire `useDragAndDrop` in
  `src/features/board/components/board-lane.tsx`. Interaction behaviour, focus management, keyboard
  support and ARIA semantics come from React Aria; **Tailwind is the visual layer only**, and
  interaction state is styled through `data-hovered`, `data-pressed`, `data-selected` and
  `data-focus-visible` rather than hand-rolled (`AGENTS.md` → React Aria Components, FR-044).
  → verify: T034 green.

- [X] T036 [US2] **Red** — new `src/features/board/components/board-optimism.test.tsx`: a drop renders
  the card in its new position **before** the action resolves; on each of the four refusals the card
  returns to the **exact** position it came from and a **distinct** toast is shown — `forbidden`
  carrying the reason that names the project, `not_found` saying the card or its lane is gone,
  `invalid_target` saying the drop was not legal for that lane, `no_index_available` saying the card
  could not be placed between those two and nothing was moved — **never one generic message**; a
  **rejected** promise (as distinct from a resolved refusal) shows the connection message and
  **queues nothing for later**; Escape and a drop outside any lane write nothing and return the card.
  Assert the lane counts move with the optimistic drop and move back on a rollback.
  (FR-009, FR-041, FR-042, FR-045, SC-010, research D-7)
  → verify: the test fails — no overlay exists.

- [X] T037 [US2] **Green (T036)** — a `pendingMoves` map from issue id to the drop in flight for it,
  in `src/features/board/components/board-screen.tsx`, with a per-refusal message map and a second
  rejection handler on the `.then(…, …)`, following `columns-section.tsx`'s explicit overlay.
  **`useOptimistic` is not used** — it discards its overlay when the surrounding transition settles
  and re-derives from the passed value, which is precisely what FR-056 forbids (research D-1). The
  replay over fresh rows lands at T069/T071.
  → verify: T036 green.

- [X] T038 [P] [US2] **Red** — new `src/features/board/components/board-keyboard.test.tsx`: the whole
  drag is completable **with the keyboard alone**, driven by explicit key events; every drop target
  announces its lane's name; the drag handle and every control carry a visible focus indicator; no
  state and no error is conveyed through colour alone. **`@react-aria/test-utils` is not installed and
  is not added** (IV, `AGENTS.md` → React Aria Components, research C-4). (FR-043, SC-015)
  → verify: the test fails on the missing accessible name or focus affordance.

- [X] T039 [US2] **Green (T038)** — whatever the keyboard test forces in `board-lane.tsx` and
  `issue-card.tsx`. **No roles and no keyboard handlers are added to patch around an incorrectly
  composed component** — if a handler seems needed, the composition is wrong (`AGENTS.md`).
  → verify: T038 green.

**Checkpoint**: `npm run verify` green. Walkthroughs 2, 3, 8, 10 and 11 of
[`quickstart.md`](./quickstart.md) pass under Column grouping. US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Anyone regroups the board by Column, Assignee or Priority (Priority: P3)

**Goal**: the header's one per-screen control, the three lane sets, and the two further fields a
cross-lane drop writes under Assignee and Priority.

**Independent Test**: on a board with issues across several columns, assignees and priorities, switch
to Assignee and confirm the lanes are Unassigned-first, then the members-plus-admins pool, then every
still-assigned non-member exactly once; drop a card into another person's lane and confirm the
assignee changed and the column did not; switch to Priority, drop into Urgent, and confirm the
priority changed and neither the column nor the assignee did.

- [X] T040 [P] [US3] **Red** — extend `src/features/board/lane-model.test.ts` (third wave):
  `lanesFor(grouping, board)` returns the column lanes in board order; **exactly five** priority lanes
  in the order Urgent, High, Medium, Low, No priority, with every issue in the lane its own priority
  names; the assignee lanes as **Unassigned first**, then the pool ordered by `lower(last_name)` then
  `lower(first_name)` — `listAssigneePool`'s own ordering, not the rendered display name — then
  everyone still assigned here who is outside the pool as **its own block after the pool**, never
  interleaved with it, under that **same** ordering — **each person appearing exactly once**. Every
  card lands in **exactly one lane under every grouping**, with no card missing from every lane and no
  card in two, including cards with no assignee and no priority. `canAcceptDrop` is true for
  Unassigned and for the pool and **false** for the third assignee group. **Not `[P]` against T006/
  T007/T032/T033/T069.** (FR-017, FR-018, FR-019, FR-021, FR-037, SC-006, data-model *Lanes*)
  → verify: the test fails — only column grouping exists.

- [X] T041 [P] [US3] **Green (T040)** — extend `src/features/board/lane-model.ts` with the assignee
  and priority lane sets. **A column's `kind` is read by nothing** (the spec's *Out of Scope*).
  → verify: T040 green.

- [X] T042 [US3] **Red** — new `src/features/board/components/grouping-control.test.tsx`: a React Aria
  `Select` with the accessible name **"Group by"** offering **exactly** Column, Assignee and Priority,
  defaulting to Column, with a visible focus indicator and operable by keyboard alone. Assert **no
  sort control and no filter control exists anywhere on this screen** — drop position is the only
  ordering input. (FR-015, FR-005, SC-015)
  → verify: the test fails — the component does not exist.

- [X] T043 [US3] **Green (T042)** — `src/features/board/components/grouping-control.tsx`.
  → verify: T042 green.

- [X] T044 [US3] **Red** — extend `src/features/projects/components/project-header.test.tsx`:
  `ProjectHeader` accepts `control?: ReactNode` and forwards it to `ScreenHeader`'s **existing**
  `control` slot; a caller passing none renders **exactly as it does today**; the Board/Details tab
  pair, the comment count and the `newIssue` button are unchanged, and **nothing else is added to the
  header** (FR-004, FR-005, plan *Complexity Tracking*).
  → verify: the test fails — `ProjectHeader` declares no `control` prop.

- [X] T045 [US3] **Green (T044)** — one prop in
  `src/features/projects/components/project-header.tsx`, forwarded. **No markup, no layout and no
  other prop changes.** `ScreenHeader` is **not** edited — R2 built the slot and nothing had used it
  (research E-2).
  → verify: T044 green; `npx vitest run src/features/projects/components/project-header.test.tsx`
  passes and every other project-header caller still renders unchanged.

- [X] T046 [US3] **Red** — extend `src/features/board/components/board-screen.test.tsx`: the grouping
  choice is component state, resets to **Column** on remount, and reaches **neither the URL nor a
  cookie nor any user record** — assert no `searchParams` read, no `document.cookie` write and no
  second route; switching the control regroups **the same cards** with the card face, the drag gesture
  and the composer **identical** in all three; a reorder made under one grouping changes relative
  position under the others and **nothing hides or compensates for it**.
  (FR-020, FR-021, FR-025, SC-006, research D-6)
  → verify: the test fails — grouping is fixed to `"column"`.

- [X] T047 [US3] **Green (T046)** — `useState<Grouping>("column")` in
  `src/features/board/components/board-screen.tsx`, and the control wired to it.
  **Resolve the contract detail named in the Precondition here**:
  [`contracts/screens.md`](./contracts/screens.md) places `<GroupingControl>` in `ProjectHeader`'s
  `control` slot and the `useState` in `BoardScreen`, which are siblings — so **one client boundary
  must own both**. The minimal shape consistent with FR-004, FR-005 and FR-020 is for the page to
  render a single client component that supplies the header's `control` **and** the board from the one
  state; do not add a second header (FR-004), do not move the control into the board body (FR-005),
  and do not lift the choice into the URL or a context provider (FR-020, III). Update
  `src/app/(app)/projects/[projectKey]/page.tsx` accordingly — the same file T017 wrote, so these two
  are never `[P]` against each other.
  → verify: T046 green; T016 still green; the board URL is unchanged under all three groupings.

- [X] T048 [US3] **Red** — new `src/features/issues/server/move-issue-lanes.test.ts` against real
  PostgreSQL, with the same census as T020. **Assignee**: `laneId` naming a user in
  `listAssigneePool` writes `assignee_id` and leaves `column_id` and `priority` untouched;
  `laneId: null` is **Unassigned**, a legal target that **clears** the field; a user who exists and
  **still holds an issue in this project** but is **outside the pool** — deactivated, or a non-member
  still assigned here — returns `invalid_target`; a user who is **neither in the pool nor assigned
  here** returns `not_found`, whether the id names nobody at all or a deactivated user who holds no
  issue in this project. **Priority**: a value `parsePriority` admits writes `priority` and leaves
  `column_id` and `assignee_id` untouched; anything it refuses returns `invalid_target`. Under both,
  a same-lane reorder writes `sort_order` **alone**, and exactly one row changes.
  (FR-029, FR-030, FR-034, FR-035, FR-037, SC-004, research B-4)
  → verify: the test fails — only the column lane resolves.

- [X] T049 [US3] **Green (T048)** — extend step 5 of `src/features/issues/server/move-issue.ts`,
  reusing `listAssigneePool` and `parsePriority` from `src/features/issues/server/` rather than
  rebuilding either (research E-4). Every lane is validated **against the database on every call,
  whatever the board rendered** (II, gate 3, FR-065).
  → verify: T048 green.

- [X] T050 [US3] **Red** — extend `src/features/issues/server/move-issue-activity.test.ts` (second
  wave): an **Assignee** cross-lane drop writes `field: "assignee"` with from and to as the people's
  **display names** rather than ids, and a drop into **Unassigned** writes a **null `to_value`**,
  which `activity-row.tsx`'s existing `displayOrNone` renders as the literal `"None"`; a **Priority**
  cross-lane drop writes `field: "priority"` with the raw enum literals — the identical shape
  `updateIssue` already writes for the same three fields. A reorder inside any lane writes **none**.
  (FR-060, FR-061, third Clarification, research B-8, data-model *The activity row*)
  → verify: the test fails — only the column diff is written.

- [X] T051 [US3] **Green (T050)** — the two further diffs in `move-issue.ts`, using `displayName` from
  `src/lib/display-name.ts` for a person's name. **`src/features/activity/` is still not edited**
  (FR-063).
  → verify: T050 green.

- [X] T052 [US3] **Red** — extend `src/features/board/components/board-lane.test.tsx` (second wave): a
  lane whose `canAcceptDrop` is false returns `"cancel"` from `getDropOperation`, its cards still
  render in it, and it still shows its name and count — it neither hides nor silently swallows the
  gesture. (FR-037, US3 sc.12, research C-3)
  → verify: the test fails — every lane accepts every drop.

- [X] T053 [US3] **Green (T052)** — `getDropOperation` in
  `src/features/board/components/board-lane.tsx`. This is an **affordance only**: FR-065 makes the
  server check the enforcement, and T048 already refuses the same case independently.
  → verify: T052 green.

**Checkpoint**: `npm run verify` green. Walkthroughs 4 and 5 of [`quickstart.md`](./quickstart.md)
pass. US1–US3 all work independently.

---

## Phase 6: User Story 4 — A member adds a card without leaving the board (Priority: P4)

**Goal**: the "Add a card" composer at the foot of every lane, its chevron into the Create issue page
with the lane's meaning preselected, and the disabled-not-hidden states.

**Independent Test**: under Column grouping, type a title into In Progress's composer and press enter;
confirm one issue is created in that column, rendering as the last card in the lane directly above the
composer, with **no existing issue's index written**; press shift-enter and confirm the Create issue
page opens with In Progress preselected; sign in as a non-member and confirm the composer renders in
every lane, disabled, with the reason naming the project in its placeholder.

- [X] T054 [US4] **Red** — new `src/features/board/components/card-composer.test.tsx`: an "Add a card"
  `TextField` at the foot of **every** lane taking a **title and nothing else**; enter submits; an
  empty or whitespace-only title creates nothing and shows its refusal **inline on the field, not as a
  toast**; while the call is in flight the control shows in-flight state and **no card appears until
  the server answers** — creation is not optimistic because the issue's number is assigned server-side
  and its key cannot be rendered before it is known; on success the field clears and stays ready for
  the next one. (FR-046, FR-050, FR-051, `OT-UX-008`)
  → verify: the test fails — the component does not exist.

- [X] T055 [US4] **Green (T054)** — `src/features/board/components/card-composer.tsx`, rendered by
  `board-lane.tsx` at the lane's foot. The client-side title check is an **affordance**; the server
  check in `createIssue`'s existing `parseTitle` — required, trimmed, bounded, refused rather than
  truncated — is the enforcement (II, FR-065).
  → verify: T054 green; T012's empty-lane assertion still holds — an empty lane shows its one quiet
  line **and** its composer (FR-008).

- [X] T056 [US4] **Red** — new `src/features/board/components/card-composer-disabled.test.tsx`: for a
  **non-member** the composer renders in **every** lane, **disabled**, its placeholder carrying the
  reason **in place of "Add a card" and naming the project**, and the chevron likewise — **neither is
  ever hidden**, because the hide-rather-than-disable rule covers admin-only navigation only. For a
  **member**, a lane outside the assignee pool renders its composer **and its chevron** disabled with the
  same reason inline, because FR-037 excludes that person from the pool the composer would have to write
  and from the preselection the chevron would have to carry.
  (FR-052, `OT-UX-021`, fourth Clarification, Clarifications 2026-09-05, US3 sc.12, US4 sc.9)
  → verify: the test fails — the composer is enabled for everyone.

- [X] T057 [US4] **Green (T056)** — the disabled states, reading `canWrite` / `writeReason` and the
  lane's `canAcceptDrop` / `refusalReason` from `loadBoard`'s DTO.
  → verify: T056 green.

- [X] T058 [US4] **Red** — new `src/features/board/components/card-composer-create.test.tsx`: under
  **Column** grouping the composer calls `createIssue` with `columnId` = that lane; under **Assignee**
  grouping with `columnId` = the project's **first column by board order** plus that lane's assignee,
  and with **no assignee** for Unassigned; under **Priority** grouping with the first column plus that
  lane's priority. Nothing else is set — everything the composer does not pass is left to
  `createIssue`'s own defaults. (FR-047, contracts/mutators.md *createIssue*)
  → verify: the test fails — the composer passes no lane meaning.

- [X] T059 [US4] **Green (T058)** — the three payloads.
  → verify: T058 green.

- [X] T060 [US4] **Red** — new `src/features/board/board-order.test.ts` against real PostgreSQL:
  driving the composer's `createIssue` payload places the new issue **after every existing issue in
  the project** and **writes no existing row** (full census before and after), so it renders **last in
  its lane, directly above the composer that made it**; submitting twice in quick succession creates
  two issues and neither touches the other's index. Assert
  `src/features/issues/server/create-issue.ts` is **not edited** and its behaviour is unchanged.
  (FR-026, FR-049, SC-013, the *composer submitted twice* edge case)
  → verify: the test fails on the composer payload path. **If it passes on its first run it is not a
  valid Red** — it is asserting `createIssue` in isolation rather than the composer's own payload;
  narrow it until it fails for the intended reason.

- [X] T061 [US4] **Green (T060)** — whatever the composer's call needs. **`create-issue.ts` gains not
  one line** — this feature adds callers to that mutator and changes nothing about it (FR-026).
  → verify: T060 green; `git diff --stat src/features/issues/server/create-issue.ts` is empty.

- [X] T062 [P] [US4] **Red** — extend `src/features/issues/components/create-issue-form.test.tsx`:
  `initialTitle`, `initialColumnId`, `initialAssigneeId` and `initialPriority` seed the `useState`
  calls that are there today (`useState("")`, `useState(columns[0]?.id ?? "")`, …), and a caller
  passing **none** behaves **exactly as it does now**, so the header's existing New issue entry point
  is unaffected. (FR-048, plan *Complexity Tracking*)
  → verify: the test fails — the form accepts no initial values.

- [X] T063 [P] [US4] **Green (T062)** — four optional props in
  `src/features/issues/components/create-issue-form.tsx`, each seeding the state already there.
  **Additive and optional; nothing adjacent changes** (gate 7). A second create form is **not** built
  — that is what Principle I exists to prevent.
  → verify: T062 green; every existing `create-issue-form` test still passes unchanged.

- [X] T064 [P] [US4] **Red** — extend
  `src/app/(app)/projects/[projectKey]/issues/new/page.test.ts`: the page reads `searchParams`
  (async in Next 16) and passes a preselection to the form **only when the project actually admits
  it** — the column must be in `listProjectColumns`, the assignee in `listAssigneePool`, the priority
  one `parsePriority` accepts; **anything else is dropped and the form renders its own default**, so a
  `?columnId=` naming another project's column never appears preselected. That drop answers only a
  hand-typed URL: T066's chevron never emits an `assigneeId` outside the pool. The route's existing
  `forbidden()` for a non-member is **untouched** — the disabled control and the Forbidden screen stay
  independent, neither implying the other was skipped. (FR-048, FR-053, II, gate 3, research E-3)
  → verify: the test fails — the route ignores its query string entirely.

- [X] T065 [P] [US4] **Green (T064)** — read and validate the four parameters in
  `src/app/(app)/projects/[projectKey]/issues/new/page.tsx`. `createIssue` re-validates all four on
  submit regardless, so this is not the security boundary; it is the rule that input failing
  validation is **rejected rather than silently rendered** (II).
  → verify: T064 green.

- [X] T066 [US4] **Red** — new `src/features/board/components/card-composer-chevron.test.tsx`:
  shift-enter, and the chevron beside the composer, open `/projects/:projectKey/issues/new` carrying
  **exactly the preselection the composer would have written** — that column under Column grouping,
  the first column plus the lane's assignee or priority under the other two — plus **any title already
  typed**. The chevron has its own accessible name and is never hidden. In a lane whose person is outside
  the assignee pool it is **disabled** with the composer's reason and carries **no** `assigneeId`, so the
  drop rule T064 fixes is never reached from the board. (FR-048, FR-052, Clarifications 2026-09-05, US4
  sc.4, sc.7)
  → verify: the test fails — no chevron exists.

- [X] T067 [US4] **Green (T066)** — the chevron and the shift-enter path in `card-composer.tsx`.
  → verify: T066 green; quickstart walkthrough 6 passes end to end.

**Checkpoint**: `npm run verify` green. Walkthrough 6 of [`quickstart.md`](./quickstart.md) passes.
US1–US4 all work independently.

---

## Phase 7: User Story 5 — The board keeps itself current, and the last drop to land wins (Priority: P5)

**Goal**: the thirty-second interval and the focus refresh, the replay of pending drops over fresh
rows, and last-write-wins with neither client rejected.

**Independent Test**: open the board, move a card from a second session, and confirm the first board
shows it within thirty seconds without navigation and immediately on refocusing; begin a drag, let a
re-query land mid-gesture, and confirm the drag survives and the drop resolves against the refreshed
neighbours; issue two conflicting moves for one card and confirm the later one persists with neither
client shown a rejection.

- [X] T068 [P] [US5] **Red** — extend `src/features/board/lane-model.test.ts` (fourth wave):
  `replayPendingMoves(freshCards, pendingMoves)` applies each in-flight drop over the **newest** server
  rows, so the caller's own optimistic position survives a re-query carrying older data (FR-056); a
  re-query that no longer carries the moved card **discards that pending move silently** (US5 sc.8);
  a re-query whose data is unchanged replays to an **identical** result, so nothing shifts (FR-059);
  the replay **never mutates its inputs**. **Not `[P]` against T006/T007/T032/T033/T041.**
  (FR-055, FR-056, FR-059, research D-1, D-2)
  → verify: the test fails — `replayPendingMoves` does not exist.

- [X] T069 [P] [US5] **Green (T068)** — add `replayPendingMoves` to
  `src/features/board/lane-model.ts`.
  → verify: T068 green.

- [X] T070 [US5] **Red** — new `src/features/board/components/board-freshness.test.tsx`: a
  thirty-second interval calls `router.refresh()` **only while `document.visibilityState ===
  "visible"`**, a `focus` listener refreshes **immediately**, and both are torn down on unmount; a
  re-query of an already-rendered board shows **no skeleton** and produces no layout shift; nothing
  renders from a client cache on a revisit. (FR-007, FR-054, FR-058, FR-059, the *window that never
  regains focus* edge case, research D-3)
  → verify: the test fails — no timer and no listener exist.

- [X] T071 [US5] **Green (T070)** — the interval and the `focus` listener in
  `src/features/board/components/board-screen.tsx`. **`src/features/activity/no-polling.test.ts` is
  left exactly as it is**: R7's rule is feed-scoped and its test enumerates its three files
  explicitly, none of which is this one. Extending its list would be adjacent code this feature was
  not asked to touch (gate 7); narrowing it would weaken a guard R7 owns (research D-3, plan
  *Complexity Tracking*).
  → verify: T070 green; `npx vitest run src/features/activity/no-polling.test.ts` passes with that
  file unmodified.

- [X] T072 [US5] **Red** — new `src/features/board/components/board-mid-drag.test.tsx`: a re-query
  landing **while a drag is in progress** updates the board underneath the drag and **does not cancel
  it**, and the drop then resolves against the **refreshed** neighbours rather than the stale ones; a
  re-query landing before the caller's own write returns does **not** overwrite that in-flight
  optimistic drop with older data; a re-query that removes the card being dragged ends the drag with
  **no write and no error**. (FR-055, FR-056, SC-009, the *re-query that removes the dragged card*
  edge case)
  → verify: the test fails — a re-query replaces the rendered set outright.

- [X] T073 [US5] **Green (T072)** — derive the rendered set by replaying `pendingMoves` over the
  newest server rows in `board-screen.tsx`, clearing **one** entry when **that entry's** call settles.
  R9's overlay clears on every server update, which is correct for a column reorder and would violate
  FR-056 here (research D-1).
  → verify: T072 green.

- [ ] T074 [US5] **Red** — new `src/features/issues/server/move-issue-race.test.ts` against real
  PostgreSQL, following `src/features/issues/server/update-issue-race.test.ts`: two conflicting
  `moveIssue` calls for **one** card — the **later write is the state that persists**, **neither call
  is rejected for staleness**, and no client learns of the other from a refusal. Assert that only the
  moved row is taken `FOR UPDATE` and **the lane is not locked**, so two drops of different cards into
  one lane are not serialized. (FR-057, SC-007, research B-5)
  → verify: the test fails if either call is rejected or if a lane lock serializes the two.

- [ ] T075 [US5] **Green (T074)** — confirm and, if needed, correct the locking in `move-issue.ts`.
  **No lane lock, no optimistic-concurrency check on `updated_at`, no advisory lock** — a rejected
  write is exactly what FR-057 and SC-007 forbid (research B-5).
  → verify: T074 green.

- [X] T076 [US5] **Red** — new `src/features/board/components/board-deleted-rows.test.tsx`: a re-query
  that no longer carries a card removes it from the board **with no error shown**, and a drop already
  in flight for it is refused as a **missing row** rather than a permission one; a re-query that no
  longer carries a column removes that lane under Column grouping and **every remaining card is still
  in a lane**; a lost connection refuses the drop with the connection message, queues nothing and
  returns the card. (FR-045, US5 sc.8, sc.9, sc.10, research D-7)
  → verify: the test fails — a vanished card or lane throws or strands a card.

- [X] T077 [US5] **Green (T076)** — the vanished-row handling in `board-screen.tsx`.
  → verify: T076 green.

**Checkpoint**: `npm run verify` green. Walkthrough 7 of [`quickstart.md`](./quickstart.md) passes.
US1–US5 all work independently.

---

## Phase 8: User Story 6 — A non-member reads the board and cannot change it (Priority: P6)

**Goal**: the read boundary tested from the other side — identical structure, differing affordances,
and a server that refuses whatever the board rendered.

**Independent Test**: sign in as a signed-in non-member, open the board, and confirm the lanes, cards
and counts are identical to a member's; that no card can be dragged; that every composer is disabled
with the reason naming the project; and that a `moveIssue` call issued **directly** is refused.
Confirm an assigned non-member sees their own card and the project it belongs to named.

- [ ] T078 [P] [US6] **Red** — new `src/features/board/components/board-parity.test.tsx`, following
  `src/features/issues/components/issue-detail-parity.test.tsx`: the lanes, cards, counts and
  empty-lane lines a signed-in **non-member** sees are **identical** to a member's, compared as two
  rendered structures; **only affordances differ**. Nothing anywhere implies a hidden-access state —
  a row that is missing genuinely does not exist. (FR-002, FR-069, SC-012, research F-5)
  → verify: the test fails wherever the two structures diverge.

- [ ] T079 [P] [US6] **Green (T078)** — whatever the parity test forces. Membership is a **write**
  boundary and is never used as a visibility one anywhere in this feature (FR-002).
  → verify: T078 green.

- [X] T080 [US6] **Red** — new `src/features/board/components/board-affordances.test.tsx`: a
  non-member's lanes receive `dragAndDropHooks={undefined}`, so **no drag begins and no call is
  made** — the pattern `columns-section.tsx` already uses; every composer and **every entry point to
  Create issue** is disabled with an inline reason naming the project and **none is hidden**; a member
  whose membership is removed while their board is open has the controls become disabled with their
  reason on the next render, with **no card removed and nothing else about the board changed**, and an
  in-flight drop refused and rolled back. (FR-052, FR-065, FR-066, US6 sc.2, sc.3, sc.5, research C-3)
  → verify: the test fails — a non-member's lanes still receive drag hooks.

- [X] T081 [US6] **Green (T080)** — the conditional hooks and the disabled affordances.
  → verify: T080 green.

- [X] T082 [US6] **Verification — not a Red, and it does not stand in for one.** Extend
  `src/features/issues/move-issue-write-boundary.test.ts` (T030's file) against real PostgreSQL: call
  `moveIssue` **directly, without going through a control**, as a signed-in non-member and confirm it
  is refused on **100% of attempts whatever the board rendered**; an **admin holding no
  `project_member` row** may move; an **archived** project accepts every call, because project status
  is never a condition; a drop **into and straight back out of** a `done`- or `canceled`-kind column
  is accepted with no confirmation and no guardrail, and `kind` is read by nothing. This task adds
  **no production code**, so it is not a Red; if any assertion fails, the defect is in T023 or T049
  and is fixed there. (FR-039, FR-040, FR-065, FR-068, SC-011, research F-5)
  → verify: `npx vitest run src/features/issues/move-issue-write-boundary.test.ts` passes.

- [ ] T083 [P] [US6] **Red** — new `src/features/board/components/board-admin.test.tsx`: an **admin
  holding no membership row** may drag and compose exactly as a member does, and has a **lane of their
  own** under Assignee grouping. (FR-068, US6 sc.8)
  → verify: the test fails — the admin renders as a non-member or has no assignee lane.

- [ ] T084 [P] [US6] **Green (T083)** — whatever the admin case forces in the DTO's `canWrite` and in
  the assignee lane set.
  → verify: T083 green.

- [ ] T085 [US6] **Red** — new
  `src/features/board/components/board-assigned-non-member.test.tsx`, following
  `src/features/issues/components/assigned-non-member.test.tsx`: an **assigned non-member**'s card
  renders, they cannot move it, and the board **names the project they would need to be added to**.
  (FR-067, `OT-AUTHZ-015`, US6 sc.6)
  → verify: the test fails — the reason does not name the project.

- [ ] T086 [US6] **Green (T085)** — the reason string, built through
  `buildIssueWriteReason`-shaped wording already in `issue-queries.ts` rather than a second phrasing
  (research E-4).
  → verify: T085 green.

- [X] T087 [US6] **Verification — not a Red.** Run walkthrough 9 of
  [`quickstart.md`](./quickstart.md) end to end against a seeded project: the non-member view, the
  direct `moveIssue` call, the Create issue route still answering **Forbidden** to that user by deep
  link (FR-053), and the admin-without-a-membership-row case.
  → verify: every step behaves as walkthrough 9 states; `npm run verify` exits 0.

**Checkpoint**: `npm run verify` green. All six user stories work independently.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T088 [P] **Red** — new `src/features/board/components/board-a11y.test.tsx`, following
  `src/features/issues/components/issue-detail-a11y.test.tsx`: **every** control this feature adds
  carries an accessible name and a visible focus indicator; **no state and no error is conveyed
  through colour alone**; error text is associated with its control; and **no card, lane or label
  anywhere on the board carries a colour that identifies it** — a project, a column and a label are
  each told apart by name alone. (FR-011, FR-043, SC-015, SC-016)
  → verify: the test fails on whichever control is missing a name or an indicator.

- [ ] T089 [P] **Green (T088)** — the missing names and indicators, styled through
  `data-focus-visible` rather than hand-rolled.
  → verify: T088 green.

- [X] T090 **Verification** — confirm the diff touches **none** of the files plan.md names as
  untouched: `src/db/schema.ts` and the whole of `drizzle/` · `package.json`, `package-lock.json`,
  `next.config.ts`, `vitest.config.mts`, `tsconfig.json`, `drizzle.config.ts`, `biome.json` ·
  `src/db/test-database.ts`, `src/db/touched.ts`, `src/db/unique-violation.ts` ·
  `src/features/issues/server/create-issue.ts`, `update-issue.ts`, `delete-issue.ts`, `input.ts`,
  `issue-queries.ts`, `issue-key.ts` · the whole of `src/features/activity/`, including
  `no-polling.test.ts` · the whole of `src/features/labels/` · `src/features/projects/**` **except**
  `project-header.tsx` · `src/features/shell/**`, including `screen-header.tsx` ·
  `src/components/ui/` (still not created). (gates 4 and 7, plan *Untouched and named so*)
  → verify: `git diff --stat` against each path is empty.

- [X] T091 **Verification** — no dead surface and no speculative machinery: `moveIssue` accepts **no**
  `sortOrder`, `projectId` or `rank`, not even as ignored optional fields; `MoveIssueState` declares
  **no `invalid_input`** member; the board DTO exposes **no `sort_order`**; a column's `kind` is read
  by **nothing at all**; and **no hook, parameter or extension point is left for R11's notification**
  — R11 edits `move-issue.ts` when it lands. (V, VI, III, research E-5, data-model *Reach-back*)
  → verify: grep each name across `src/features/board/` and `src/features/issues/server/move-issue*`
  and find no occurrence; `npm run style-check` reports no unused import or variable.

- [X] T092 **Verification** — the diff carries **no comments, no commented-out code and no dead
  code**, and every changed line traces to the requirement its task names; adjacent code is left
  untouched. (V, VI, gates 6 and 7)
  → verify: `npm run style-check` and `npm run type-check` both clean.

- [X] T093 **Verification** — walk all twelve walkthroughs of [`quickstart.md`](./quickstart.md)
  against a seeded project, including the SQL censuses in walkthrough 2, the **hundred-drop
  tie run** in walkthrough 3 (every index that was not itself the subject of a drop still holds the
  value it started with), the four refusals in walkthrough 8, and the activity queries in
  walkthrough 11. (SC-002, SC-003, SC-005, SC-010, SC-014)
  → verify: every walkthrough behaves as written.

- [ ] T094 **Verification** — `npm run verify` green: `style-check` → `type-check` → `test` →
  `build`, with **nothing failing and nothing skipped** (gates 5 and 8). Note that
  `npm test` runs with `--passWithNoTests`, so a green run is **not by itself** evidence of Principle
  VII — the Red-before-Green commit order is.
  → verify: `npm run verify` exits 0; the commit history shows each Red committed before its Green.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** — no dependencies; starts immediately.
- **Foundational (Phase 2)** — depends on Setup. **Blocks all six user stories**: every screen reads
  `loadBoard`'s DTO and every ordering claim is a statement about `lane-model.ts`.
- **US1 (Phase 3)** — depends on Foundational only. Delivers the MVP.
- **US2 (Phase 4)** — depends on US1 for the components it wires drag into (`board-lane.tsx`,
  `board-screen.tsx`, `issue-card.tsx`). The mutator half (T018–T031) depends on Foundational only and
  can be worked beside US1.
- **US3 (Phase 5)** — depends on US2's mutator and drop machinery: every grouping reuses it with a
  different field on the end.
- **US4 (Phase 6)** — depends on US1's lanes and US3's lane meanings (FR-047's three payloads). Its
  R6-file edits (T062–T065) depend on Foundational only.
- **US5 (Phase 7)** — depends on US2's overlay, which it replays over fresh rows.
- **US6 (Phase 8)** — depends on US1 (parity), US2 (the boundary the direct call tests) and US4 (the
  composers it asserts are disabled).
- **Polish (Phase 9)** — depends on every story that will ship.

### Within each unit

- The **Red** is written, run, and **observed failing for the intended reason** before its Green
  exists. A Red that passes on its first run is corrected, not accepted (VII, gate 1).
- The Green is the **minimal** code that turns that Red green; refactoring happens with it green
  (gate 2).
- Server input parsers precede the mutator that calls them; the mutator precedes its Server Action;
  the pure model precedes the components that render from it.
- A **Verification** task never stands in for a Red and never carries production code.

### Files edited by more than one task — never `[P]` against each other

This list is the authority for the `[P]` marks above.

| file | tasks |
| --- | --- |
| `src/features/board/lane-model.ts` (+ its test) | T007, T033, T041, T069 |
| `src/features/board/components/board-screen.tsx` (+ its test) | T015, T037, T047, T071, T073, T077 |
| `src/features/board/components/board-lane.tsx` (+ its test) | T013, T035, T039, T053, T055 |
| `src/features/board/components/issue-card.tsx` | T011, T039 |
| `src/features/board/components/card-composer.tsx` | T055, T057, T059, T067 |
| `src/features/issues/server/move-issue.ts` | T021, T023, T025, T027, T029, T049, T051, T075 |
| `src/features/issues/server/move-issue-activity.test.ts` | T028, T050 |
| `src/features/issues/move-issue-write-boundary.test.ts` | T030, T082 |
| `src/app/(app)/projects/[projectKey]/page.tsx` (+ its test) | T017, T047 |

### Parallel Opportunities — the explicit batches

Run `[P]` tasks only inside the batch that names them.

- **Batch A (Phase 1)**: T001, T002, T003 — three independent verifications, no file written.
- **Batch B (Phase 2)**: the `board-queries` chain (T004 → T005) beside the `lane-model` chain
  (T006 → T007). Different directories, no shared file.
- **Batch C (Phase 3)**: the `board-skeleton` chain (T008 → T009) beside the `issue-card` chain
  (T010 → T011). T012 onward is serial — `board-lane.tsx` and `board-screen.tsx` are each written by
  several tasks.
- **Batch D (Phase 4)**: the `move-issue-input` chain (T018 → T019) beside the start of the mutator
  chain (T020 → T021). T032 → T033 (`lane-model.ts`) may run beside T034 → T037 (components), but
  **not** beside T007, T041 or T069. T038 may be written beside T036; **T039 is not `[P]`** — it edits
  `board-lane.tsx` and `issue-card.tsx`.
- **Batch E (Phase 5)**: T040 → T041 (`lane-model.ts`) beside T042 → T043 (`grouping-control.tsx`).
  T044 → T045 (`project-header.tsx`) may also run here — it shares no file with either.
- **Batch F (Phase 6)**: the R6-file chains T062 → T063 (`create-issue-form.tsx`) and T064 → T065
  (`issues/new/page.tsx`) run beside each other and beside the composer chain; **the composer chain
  itself is serial** — T055, T057, T059 and T067 all write `card-composer.tsx`.
- **Batch G (Phase 7)**: T068 → T069 (`lane-model.ts`) beside T074 → T075 (the mutator's race test).
  T070 onward writes `board-screen.tsx` and is serial.
- **Batch H (Phase 8)**: T078 → T079 (parity) beside T083 → T084 (admin) — two independent files.
  T080, T082, T085 and T087 are serial after them; **T082 is not `[P]`** because it extends T030's
  file.
- **Batch I (Phase 9)**: T088 → T089 beside the four verification tasks T090–T093, which write
  nothing. T094 runs last, alone.

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 — Setup: baseline green, zero dependencies, zero schema change.
2. Phase 2 — Foundational: `loadBoard` and the pure lane model. **Blocks everything.**
3. Phase 3 — US1: the board renders where "This doesn't exist" used to be.
4. **STOP and VALIDATE**: quickstart walkthrough 1, and `npm run verify`.
5. This alone replaces a route that refuses with the screen the roadmap calls the app's centre of
   gravity, and it is readable by every signed-in user.

### Incremental delivery

1. Setup + Foundational → the read and the model exist.
2. **+ US1** → the board renders. Demo (MVP).
3. **+ US2** → cards drag, under Column grouping, with four distinct refusals and one activity row.
   Demo.
4. **+ US3** → the same board answers three questions. Demo.
5. **+ US4** → cards are created without leaving the screen. Demo.
6. **+ US5** → the board keeps itself current and the last drop wins. Demo.
7. **+ US6** → the read boundary is proven from the other side.
8. **+ Polish** → accessibility, the untouched-files audit, and the full gate.

Each step adds value without breaking the previous one, and each ends on a `npm run verify` green.

### Parallel team strategy

After Phase 2, the mutator half of US2 (T018–T031, `src/features/issues/server/`) and the component
half of US1 (T008–T017, `src/features/board/components/`) are genuinely independent and can be worked
by two people. From US3 onward the work converges on `move-issue.ts` and `board-screen.tsx`, and the
*Files edited by more than one task* table above is the coordination point.

---

## Notes

- **`[P]` means different files at the moment the task becomes runnable.** Where two tasks write one
  file, they are never `[P]` against each other, whatever phase they sit in.
- **Commit each Red before its Green.** `npm test` runs with `--passWithNoTests`, so gate 8 goes green
  on an empty suite; the commit order is the evidence a reviewer applying gate 1 will look for.
- **Zero new dependencies and zero schema change** are load-bearing claims, re-checked at T002, T003
  and T090. `package.json` and `drizzle/` must be untouched in the final diff.
- **One inherited discrepancy is recorded, not fixed**: `package.json` carries `clsx@^2.1.1`, absent
  from `AGENTS.md`'s approved-dependency table. It predates R10, is imported only by
  `src/app/components/common/logo.tsx` and
  `src/features/auth/components/primary-button-classes.ts`, and **no task here adds, removes or relies
  on it**. Resolving it is not this feature's work (plan *Complexity Tracking*, research *One question
  this plan raises*).
- **`checklists/drag-ordering.md` is reviewer-owned and currently entirely unchecked.** It is a
  requirements-quality artifact, not an implementation gate these tasks satisfy, and
  `/speckit-implement` reads its checkbox state. Nothing in this file modifies its markers. Two of its
  items — CHK016 and CHK017 — are the ones its own Notes flag as most likely to change the mutator's
  contract if the reviewer finds against the current wording; T022 and T048 encode the contract as it
  stands today.
- **No row is added to `docs/ROADMAP.md` §6 and no version number is bumped anywhere.**

---

## Phase 10: Convergence

**Purpose**: close the gaps a codebase assessment against `spec.md`, `plan.md` and `tasks.md` found
after the implementation pass. Appended by `/speckit-converge`; no existing task, checklist marker or
line of production code was altered to write this phase.

- [x] T095 Make the optimistic overlay grouping-aware in `src/features/board/lane-model.ts` per
  FR-041, FR-021, FR-055 and FR-056 (partial). `applyDrop` resolves a lane with
  `card.columnId === drop.laneId` and settles a cross-lane drop by writing `columnId`, with no
  `grouping` in its signature, so it is correct under Column grouping only: an Assignee drop onto a
  target card returns the list unchanged and renders no optimistic move at all, and a Priority root
  drop writes the priority id into `columnId` while leaving `priority` untouched. `replayPendingMoves`
  and therefore `BoardScreen`'s overlay inherit both. **Red first**: extend
  `src/features/board/lane-model.test.ts` with an Assignee drop onto a neighbour and a Priority drop
  onto an empty lane, asserting the moved card's `assigneeId` / `priority` and its new position — both
  fail today for the reasons above. Then thread the grouping through `applyDrop` so the lane predicate
  and the settled field follow it, and pass it from `BoardScreen`'s `replayPendingMoves` call.
  → verify: the two new assertions fail before the change and pass after; the existing Column-grouping
  cases in `lane-model.test.ts` and `board-optimism.test.tsx` stay green.

- [x] T096 Make the board's skeleton reachable on first load in
  `src/app/(app)/projects/[projectKey]/page.tsx` per FR-007 (partial). `await loadBoard(...)` runs in
  the page body before any JSX is returned, and the `<Suspense fallback={<BoardSkeleton />}>` wraps
  `BoardScreen`, a synchronous client component that never suspends; the route has no `loading.tsx`.
  The fallback therefore cannot render while the board's data loads, so the screen shows no skeleton
  at all rather than the lane-shaped one FR-007 requires. `issues/new/page.tsx` already carries the
  shape that works — an async `CreateIssueFormData` child *inside* the boundary. **Red first**: extend
  `src/app/(app)/projects/[projectKey]/page.test.ts` to assert the board read happens inside the
  Suspense boundary rather than before it — today's test asserts only that a boundary exists with a
  `BoardSkeleton` fallback, which passes either way. Then move the `loadBoard` call into an async
  component rendered inside the boundary, keeping `notFound()` for a key no project holds and leaving
  the header outside so the layout does not shift when the data lands. FR-007's other half must stay
  true: a re-query of an already-rendered board still shows no skeleton
  (`board-freshness.test.tsx` covers it).
  → verify: the new assertion fails before the change and passes after; `board-freshness.test.tsx`
  stays green.

- [x] T097 Pass the project's comment count to the board's header in
  `src/app/(app)/projects/[projectKey]/page.tsx` per FR-004 (partial). FR-004 names the header R5
  delivers as the project's name, **its comment count** and the Board / Details tab pair, and allows
  the board to add nothing to it but the grouping control. The page passes `projectKey`, `name`,
  `current` and `newIssue` and omits `commentCount`, which `project-header.tsx` renders only when
  defined, so the count shows on the Details tab (`details/page.tsx`) and is absent on the Board tab.
  **Red first**: assert in `page.test.ts` that `ProjectHeader` receives the count. Then read it the
  way the details route already does and pass it through. Add no prop to `ProjectHeader` and no markup
  to the header — the slot and the rendering already exist.
  → verify: the new assertion fails before the change and passes after;
  `git diff --stat src/features/projects/components/project-header.tsx` shows no further edit beyond
  the `control` prop this feature already added.

- [x] T098 Key the drop rollback to the refused drop rather than to the issue in
  `src/features/board/components/board-screen.tsx` per FR-041 (partial). `pendingMoves` is a map keyed
  by issue id and `rollBack(issueId)` deletes by that key, so a second drop of one card replaces the
  first's entry and a refusal of the now-superseded first call removes the **second** drop's optimistic
  position — the card leaves the place it was last dropped instead of returning "to the exact position
  it came from", and a toast names a move the user has already replaced. **Red first**: add a case to
  `board-optimism.test.tsx` that drops one card twice with the first call still in flight, then refuses
  the first, and asserts the card holds the second drop's position. Then make the rollback and the
  refusal message apply only when the refused drop is still the pending one for that issue. This is the
  behaviour `checklists/drag-ordering.md` CHK001 asks about and no requirement settles; **the reviewer
  owns CHK001 and this task changes no checklist marker** — it only stops a superseded refusal from
  discarding a live optimistic position, which FR-041 already requires on its own terms.
  → verify: the new case fails before the change and passes after; the four refusal-message cases in
  `board-optimism.test.tsx` stay green.

**Checkpoint**: the optimistic overlay behaves the same under all three groupings, the first load
shows the lane-shaped skeleton, the board's header matches the one FR-004 names, and a refused drop
rolls back only itself.

## Phase 11: Convergence

**Purpose**: close the gaps a second codebase assessment against `spec.md`, `plan.md`,
`contracts/mutators.md` and `tasks.md` found after Phase 10 was implemented. Appended by
`/speckit-converge`; no existing task, checklist marker or line of production code was altered to
write this phase.

- [x] T099 Surface the composer's server refusals in
  `src/features/board/components/card-composer.tsx` and
  `src/features/board/components/board-screen.tsx` per FR-051, FR-052, FR-065, FR-066 and
  `contracts/mutators.md` → *The composer's refusals* (partial). `CardComposer.onCreate` is typed
  `(payload) => Promise<void>` and `BoardScreen.createCard` is `await createBoardCard(payload)` with
  the `CreateIssueResult` discarded, so every server refusal is invisible: a title over the 200-char
  bound the client never checks is refused as `{ status: "invalid", field: "title",
  reason: "too-long" }` and the composer clears the field and shows nothing; a member who lost
  membership while the board was open submits, is refused `forbidden`, and sees no reason and no
  toast, which is exactly the stale-affordance case FR-065 and FR-066 name; and a rejected call — the
  connection lost mid-submit — escapes `void submit()` unhandled with the typed title still
  discarded by the `finally`. The contract fixes the treatment: `invalid` on `title` with `required`
  or `too-long` renders **inline on the field**, as the existing empty-title path already does
  through `FieldError`; `forbidden` already carries its project-naming reason. **Red first**: add
  cases to `card-composer.test.tsx` — an `onCreate` resolving `{ status: "invalid", field: "title",
  reason: "too-long" }` must leave the typed title in the field and name the refusal through
  `aria-describedby`, and one resolving `forbidden` must surface its reason — plus a case in
  `card-composer-create.test.tsx` or `board-optimism.test.tsx` for a rejected call. All fail today,
  because the result is not read at all. Then widen `onCreate` to return the result, render an
  `invalid` title refusal inline beside the existing `TITLE_REQUIRED` path, carry a `forbidden`
  reason, and clear the field only on `ok`. Add no member to `CreateIssueResult` and edit no file
  under `src/features/issues/server/` — `createIssue` is unchanged here (FR-026, FR-049).
  → verify: the new cases fail before the change and pass after; the existing empty-title, in-flight
  and payload-shape cases in `card-composer.test.tsx` and `card-composer-create.test.tsx` stay green.

- [x] T100 Stop the board's first load shifting its layout in
  `src/app/(app)/projects/[projectKey]/page.tsx` and
  `src/features/board/components/board-skeleton.tsx` per FR-007, FR-004 and FR-005 (partial). T096
  moved the board read inside the Suspense boundary, and because `BoardScreen` owns the grouping
  state and `cloneElement`s `ProjectHeader` to inject `GroupingControl`, the header moved inside the
  boundary with it. `BoardSkeleton` renders only the lane strip, so while the data loads the page
  shows no header at all and then the loaded header — `ScreenHeader`'s `border-b-2 … px-4.5 py-3`
  block carrying the project name, the tab pair, the comment count, **New issue** and the grouping
  control — appears above the strip and pushes it down. FR-007 requires the skeleton match "the lane
  layout they replace" **and** that "the layout MUST NOT shift when the data lands", and
  `issues/new/page.tsx` already carries the shape that satisfies both: `ScreenHeader` outside the
  boundary, only the awaited data inside. **Red first**: assert in `page.test.ts` that `ProjectHeader`
  is rendered outside the Suspense boundary — reachable from the page's own returned JSX without
  awaiting the async child — which fails today because the header is only reachable through
  `insideBoundary`. Then close it by whichever route the test forces: lift the grouping state and the
  header above the boundary so `BoardScreen` no longer clones its own header, or give `BoardSkeleton`
  a header-shaped placeholder of the same height and keep the header where it is. The second is
  cheaper and touches less; the first is what FR-004 and FR-005 describe, a header the board renders
  into rather than one it produces. State which was chosen and why in the task's completion note.
  Whatever is chosen, the board read MUST stay inside the boundary (T096) and a re-query of an
  already-rendered board MUST still show no skeleton.
  → verify: the new assertion fails before the change and passes after; `board-skeleton.test.tsx`,
  `board-freshness.test.tsx` and the four `page.test.ts` boundary cases T096 added stay green.
  → chosen: the second route, a header-shaped placeholder in `BoardSkeleton`, leaving the header where
  `BoardScreen` renders it. Lifting the header above the boundary needs the project name, the comment
  count and the write reason before the boundary — three reads T096 put inside it — and needs the
  grouping state to reach `BoardScreen` across the boundary through a context the one control does not
  justify (I, III). The placeholder duplicates only `ScreenHeader`'s frame, and
  `board-skeleton.test.tsx` compares it against a rendered `ScreenHeader` so the two cannot drift.

**Checkpoint**: a composer submission the server refuses says so on the field it came from, and the
board's first load lands its data without moving the lanes.
