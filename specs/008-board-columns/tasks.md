# Tasks: Board columns

**Input**: Design documents from [`specs/008-board-columns/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/mutators.md`](./contracts/mutators.md),
[`contracts/screens.md`](./contracts/screens.md), [`quickstart.md`](./quickstart.md)

**Tests**: **required, and written first.** Principle VII is non-negotiable here and change gate 1 asks
for a test that was *observed failing for the intended reason* before its implementation. Every task
below is either a **Red** step, a **Green** step naming the Red it turns green, or a **Verification**
step that is explicitly *not* standing in for a Red. A Red that passes on its first run is not a valid
Red and must be corrected before the paired Green starts.

**Organization**: by user story, in the spec's priority order. Each story is independently testable
against the *Independent Test* its phase states.

---

## Precondition — R5, R6 and R7 are implemented on this branch

`plan.md`'s Technical Context states this directly and it was re-checked against the tree while these
tasks were generated:

- **R5** — `board_column` with `board_column_project_id_name_lower_idx`, `seed-columns.ts`,
  `isAdmin`/`isMember` in `src/features/projects/server/authorization.ts`, `loadProjectDetails` and
  `ProjectColumnRow` in `src/features/projects/server/queries.ts` (**`issueCount` is hardcoded `0`
  today**, and columns are ordered by `sort_order` alone), the read-only `<table>` in
  `src/features/projects/components/columns-section.tsx`, `editable-field.tsx`,
  `delete-project-control.tsx`, and the action preamble in `src/features/projects/actions.ts`.
- **R6** — `issue`, its composite FK `issue_project_id_column_id_fk`, and `create-issue.ts`'s
  `generateKeyBetween(highest?.sortOrder ?? null, null)` append.
- **R7** — `activity`, its `activity_type_valid` `CHECK` holding **exactly seven** values in
  `src/db/schema.ts` and `drizzle/0006_lying_sugar_man.sql` (the current migration tail),
  `writeActivity` / `truncateActivityValue` / `ActivityType` in
  `src/features/activity/server/write-activity.ts`, a **second** `ActivityType` in
  `src/features/activity/server/feed-queries.ts`, and `buildSentence` in
  `src/features/activity/components/activity-row.tsx`, whose `switch` over
  `Exclude<ActivityType, "comment">` has **no `default`**.

**No task below is blocked and none needs a placeholder import.**

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — at the point this task becomes runnable it touches files no other
  simultaneously runnable `[P]` task touches. **Explicit batches are listed under *Parallel
  Opportunities*; run `[P]` tasks only inside the batch that names them.**
- A task is deliberately **not** marked `[P]` when it edits a file any other task also edits, whatever
  phase that other task sits in. *Files edited by more than one task* below is the complete list and
  the authority: `queries.ts`, `column-actions.ts`, the four
  mutator modules and each of their test files, `columns-section.tsx`, `column-row.tsx`,
  `project-details-screen.tsx`, `details/page.tsx` and the test files of those four. Two tasks writing
  one file are never `[P]` against each other; where such tasks may still be worked beside a chain on
  other files, the batch prose says so.
- **[Story]**: `[US1]`…`[US5]`, mapping to the spec's five user stories.
- Every task names the file it touches, the requirement that puts it there, and how it is verified.
- **The project gate is `npm run verify`** — `style-check` → `type-check` → `test` → `build`. A task's
  own `verify:` line is the narrow check; the gate still runs before the phase's checkpoint.

---

## Phase 1: Setup

**Purpose**: establish the baseline and confirm the two facts the whole design rests on — a real
separate test database, and that `react-aria-components` already ships everything the reorder needs so
gate 4 is met by adding nothing.

- [X] T001 [P] Record the baseline: run `npm run verify` on `sdd/board-columns` and confirm it is
  green before a line is changed; confirm `TEST_DATABASE_URL` (`src/db/test-setup.ts`,
  `src/db/test-database.ts`) points at a database separate from development, and that
  `board_column`, `issue` and `activity` are already in `TRUNCATED_TABLES` so `src/db/test-database.ts`
  needs **no edit** (research F-1, `AGENTS.md` → Testing).
  → verify: `npm run verify` exits 0; `npx vitest run src/db/migration.test.ts` passes.

- [X] T002 [P] Confirm in `node_modules/react-aria-components/` that version 1.20.0 exports
  `GridList`/`GridListItem` (`react-aria-components/GridList`), `useDragAndDrop`
  (`react-aria-components/useDragAndDrop`) and `DropIndicator` on the subpath entry points this
  codebase already imports from, so **no drag-and-drop library is added** (Principle IV, gate 4,
  research E-2, plan *Dependencies this feature deliberately refuses*).
  → verify: the three subpath imports resolve under `npx tsc --noEmit` in a scratch file;
  `git diff --stat package.json package-lock.json` is empty and stays empty for the whole feature.

**Checkpoint**: baseline green, no dependency needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the one migration, the three R7 files it forces, and the two shared reads every later
story needs. **⚠️ No user story work can begin until this phase is complete** — every one of the four
mutators writes its activity row inside its own transaction, so all four are blocked on the widened
`CHECK`, and both the Columns section and `deleteColumn` read the same issue count.

**None of T003–T008 is `[P]`**: they are the three R7 files and the single migration, and the parent
plan records them in Complexity Tracking precisely because they are another entry's.

- [X] T003 **Red** — extend `src/features/activity/server/write-activity.test.ts` with a case writing
  each of `column_added`, `column_renamed`, `column_reordered` and `column_deleted` through
  `writeActivity` against the real database with `target: { projectId }`, asserting the four rows land
  with `issue_id` null and `comment_id` null; **and one negative case** — a fifth, non-admitted value,
  `column_recolored`, is **refused** by the constraint with PostgreSQL `23514`, which is what makes
  FR-042's "exactly four" a bound rather than a floor and holds after T004 widens the `CHECK` (spec
  *Reconciliations*, research D-3). (FR-042, FR-043, research F-3)
  → verify: `npx vitest run src/features/activity/server/write-activity.test.ts` fails with
  PostgreSQL **`23514`** on `activity_type_valid` — the constraint refusing the value, **not** a type
  error — on each of the four; the `column_recolored` case passes from the start and is not the Red.
  Observe that exact code before starting T004.

- [X] T004 **Green (T003)** — widen the `check("activity_type_valid", …)` list in `src/db/schema.ts`
  from seven values to **eleven** by adding exactly `column_added`, `column_renamed`,
  `column_reordered`, `column_deleted` (**four, not five — no `column_recolored`**, spec
  *Reconciliations*, research D-3), and widen `ActivityType` in
  `src/features/activity/server/write-activity.ts` by the same four. Run `npm run db:generate`,
  **inspect** the emitted `drizzle/0007_*.sql` — a `DROP CONSTRAINT` followed by an
  `ADD CONSTRAINT activity_type_valid` carrying eleven values and changing nothing else about the
  table — and commit it together with its `drizzle/meta` update.
  **`drizzle/0006_lying_sugar_man.sql` is never edited** (`AGENTS.md` → Drizzle ORM). The migration
  creates no table and changes nothing about `activity` but the one `CHECK` (FR-001). (FR-001, FR-042)
  → verify: `npm run db:migrate` applies `0007`; T003 green. `npm run type-check` is expected **RED**
  from here — widening the union leaves `buildSentence` in
  `src/features/activity/components/activity-row.tsx` returning `string` from a `switch` with four
  uncovered values and no `default`, so **TS2366** — and stays red until T008 adds the four cases, at
  which point it must be clean (research C-2, plan Complexity Tracking).

- [X] T005 **Red** — new `src/features/activity/server/activity-type-parity.test.ts`: read the two
  `ActivityType` declarations (`write-activity.ts` and `feed-queries.ts`) and assert both declare the
  same eleven values, following the source-inspection idiom
  `src/features/activity/no-polling.test.ts` and `src/db/activity-shape.test.ts` already use. This is
  the observable Red for a union whose only other failure mode is `type-check`; `listFeed` casts
  `row.kind`, so a runtime feed assertion would pass without the widening and would not be a valid
  Red. (FR-042, data-model §4)
  → verify: the test fails naming the four values `feed-queries.ts` is missing.

- [X] T006 **Green (T005)** — widen `ActivityType` in `src/features/activity/server/feed-queries.ts`
  by the same four values. The pre-existing duplication between the two R7 modules is **widened, not
  refactored away** (gate 7, plan Complexity Tracking).
  → verify: T005 green. `npm run type-check` is still expected **RED** with the same **TS2366** in
  `activity-row.tsx`; it must be clean only once T008 lands (research C-2, plan Complexity Tracking).

- [X] T007 **Red** — extend `src/features/activity/components/activity-row.test.tsx` with the four
  sentences fixed by [`contracts/screens.md`](./contracts/screens.md): *Ana added column Review* ·
  *Ana renamed column Todo to Up next* · *Ana moved column Canceled to first* and *…after Todo* when
  `to_value` is set · *Ana deleted column Review*. (FR-045, FR-046, research C-3)
  → verify: the test fails because `buildSentence`'s exhaustive `switch` has no case and no `default`,
  so the paragraph renders empty.

- [X] T008 **Green (T007)** — add the four cases to `buildSentence` in
  `src/features/activity/components/activity-row.tsx`. **No `default` branch is added** — a silent
  fallback is the rendering bug the type system was catching (plan Complexity Tracking).
  → verify: T007 green; `npm run type-check` clean.

- [X] T009 [P] **Red** — new `src/features/projects/server/column-queries.test.ts` against real
  PostgreSQL: `countIssuesByColumn(executor, projectId)` returns a `Map<string, number>` of column id
  → live issue count, excludes issues of other projects, and accepts either `db` or a transaction
  handle. (FR-015, FR-034, research E-8)
  → verify: the test fails — the module does not exist.

- [X] T010 [P] **Green (T009)** — implement `src/features/projects/server/column-queries.ts` with
  `countIssuesByColumn` only. It has two real call sites on day one (T012 and T051), which is what
  Principle I's second-call-site rule asks for. **No index is added** — the `project_id` filter is
  already served by `issue_project_id_number_unique`'s prefix (data-model §2).
  → verify: T009 green.

- [X] T011 **Red (after T010)** — extend `src/features/projects/server/queries.test.ts`:
  `loadProjectDetails` returns a **live** `issueCount` per column from `countIssuesByColumn`, and
  orders columns by `(sort_order, id)` so two columns sharing a key never render in a different order
  on two reads. (FR-014, FR-015, FR-033, research A-2, E-8)
  → verify: the test fails — `issueCount` is hardcoded `0` and the order is `asc(sortOrder)` alone.

- [X] T012 **Green (T011)** — edit `src/features/projects/server/queries.ts`: order by
  `(sort_order, id)` and fill `ProjectColumnRow.issueCount` from `countIssuesByColumn(db, row.id)`.
  **`deleteRefusal` is deliberately not added here** — it lands in T049, and both tasks edit this file,
  so they are never `[P]` against each other.
  → verify: T011 green; `npx vitest run src/features/projects` passes.

- [X] T078 [P] **Red** — new `src/features/projects/server/column-input.test.ts`:
  `parseColumnId` accepts a well-formed UUID and rejects everything else — `""`, `"abc"`, a UUID with
  a trailing character, a non-string — **without** the value ever reaching a query, since
  `board_column.id` and `project.id` are `uuid` columns and a malformed value raises PostgreSQL
  `22P02`, an exception FR-052 forbids crossing the boundary; `parseProjectKey` accepts a key matching
  `^[A-Z][A-Z0-9]{0,7}$` — the pattern `project_key_pattern` already holds — and rejects everything
  else; `parsePlacement` accepts exactly `"before"` and `"after"` and rejects every other value
  **explicitly, never defaulting to `"after"` and never coercing**, which is the whole point: the
  `"before" | "after"` union is a compile-time claim and `AGENTS.md` states outright that a TypeScript
  type is not runtime validation. Unit-testable without a database.
  (FR-053, `AGENTS.md` → Principle II and gate 3)
  → verify: the test fails — the module does not exist.

- [X] T079 [P] **Green (T078)** — implement `src/features/projects/server/column-input.ts` with
  `parseColumnId`, `parseProjectKey` and `parsePlacement`. Three small predicates, **not a schema
  library and not a generic validator** — no dependency is added (Principle III, IV, gate 4). It has
  four real call sites on day one (the four actions), which is what Principle I's second-call-site rule
  asks for. Its id is appended rather than inserted so no existing task id shifts.
  → verify: T078 green.

**Checkpoint**: the `CHECK` admits the four values, R7's three files agree, the count and the board
order are one read shape with one order, and every mutator input has a runtime parser to reach for.
User story work can begin.

---

## Phase 3: User Story 1 — An admin adds and renames columns (Priority: P1) 🎯 MVP

**Goal**: `createColumn` and `updateColumn`, the shared uniqueness refusal, and the Columns section
becoming something other than a list.

**Independent Test**: sign in as an admin against a project holding its five seeded columns; add a
column named "Review" and confirm it exists last in board order with kind `open`; rename "Todo" to
"Up next" in place; attempt a rename to "backlog" and confirm it is refused with an inline error
naming the existing "Backlog" column and that nothing was written.

- [X] T013 [P] [US1] **Red** — new `src/features/projects/server/column-name.test.ts`:
  `parseColumnName` **trims first**, then bounds; `""` and `"   "` are `{ ok: false, reason: "required" }`;
  exactly 200 characters after trimming is accepted; 201 is `"too_long"` and is **refused, never
  truncated**; `" Todo "` yields `"Todo"` so it collides with `"Todo"` (seventh Edge Case). No internal
  whitespace collapsing, no Unicode normalization, no zero-width stripping (data-model §1).
  (FR-004, research D-4)
  → verify: the test fails — the module does not exist.

- [X] T014 [P] [US1] **Green (T013)** — implement `src/features/projects/server/column-name.ts`.
  → verify: T013 green.

- [X] T015 [US1] **Red (after T014)** — new `src/features/projects/server/create-column.test.ts`
  against real PostgreSQL: one row written with the trimmed name, **`kind: "open"` as a literal the
  signature cannot accept from a caller**, `sortOrder = generateKeyBetween(highest, null)` placing it
  last, `createdAt` and `touched({})`'s `updatedAt`; the five existing columns and every issue
  untouched; a non-admin gets `{ ok: false, error: "forbidden" }`; an unknown project key is
  `notFound()` and **never** `forbidden`; `invalid_name` for empty and for 201 characters; the create
  succeeds on an **archived** project, `project.status` never consulted. `updated_at` comes from the
  shared `touched` helper rather than a hand-written value (FR-006).
  (FR-003, FR-006, FR-007, FR-010, FR-019, FR-022, SC-008, SC-015, contracts/mutators.md)
  → verify: the test fails — the module does not exist.

- [X] T016 [US1] **Green (T015)** — implement `src/features/projects/server/create-column.ts`
  exactly as [`contracts/mutators.md`](./contracts/mutators.md) specifies: lock the project's highest
  key, insert, one `db.transaction`.
  → verify: T015 green.

- [X] T017 [US1] **Red** — extend `create-column.test.ts`: a name an existing column of the same
  project already holds — same casing and differing only in case — is refused
  `{ ok: false, error: "duplicate_name", holder }` carrying that column's stored `id` and `name`, with
  **no pre-flight read**; the refusal comes from `23505` matched **by constraint name** on
  `board_column_project_id_name_lower_idx`, and the holder is read afterwards on `db` (the aborted
  `tx` can serve no further statement), the shape `src/features/labels/server/create-label.ts`'s
  `findLabelNameHolder` already uses on its rollback path; a `23505` naming
  `board_column_project_id_id_unique` is **re-thrown**, never reported as a name collision.
  **Not `[P]`** — this pair writes `create-column.test.ts` and `create-column.ts`, the same two files
  as T015/T016 and T019/T020, so the three pairs run in one sequence and never beside one another.
  (FR-021, FR-051, SC-006, research B-3, data-model §1)
  → verify: the test fails — the current implementation lets the `23505` escape untyped.

- [X] T018 [US1] **Green (T017)** — add the constraint-name-matched `23505` mapping and the
  holder read to `src/features/projects/server/create-column.ts`. Reuse `isUniqueViolation` from
  `src/db/unique-violation.ts`; do **not** add a pre-flight uniqueness read (FR-051 forbids it, and
  this is the deliberate departure from `create-label.ts`).
  → verify: T017 green.

- [X] T019 [US1] **Red** — extend `create-column.test.ts`: exactly one `column_added` row on the
  **project's** feed, `actor_id` the acting admin, `field` the new name, `from_value` and `to_value`
  null, `issue_id` null, written inside the mutator's own transaction; a refused create (duplicate,
  invalid name, forbidden) leaves **no** row behind. **Not `[P]`** — same two files as T015/T016 and
  T017/T018; it runs after T018. (FR-043…FR-046, FR-048, SC-011)
  → verify: the test fails — no `writeActivity` call exists yet.

- [X] T020 [US1] **Green (T019)** — add
  `writeActivity(tx, { type: "column_added", target: { projectId }, actorId, field: name })` inside
  `create-column.ts`'s existing transaction. R7's writer is called; **no insert is assembled here**
  (FR-043).
  → verify: T019 green.

- [X] T021 [US1] **Red (after T014)** — new
  `src/features/projects/server/update-column.test.ts` against real PostgreSQL: a rename writes `name`
  and `updated_at` and nothing else — `kind`, `sort_order`, `project_id` unchanged, no issue touched;
  a submitted name **equal to the column's current name** returns `{ ok: true }` having written
  nothing at all, `updated_at` included and no activity row (FR-024's server half, so the outcome does
  not depend on which side noticed); a case-only change of the column's **own** name succeeds
  (FR-026 — the row being renamed is the row being updated, no `id <>` clause); an unknown or
  concurrently deleted `columnId` is `notFound()` and never `forbidden` (eleventh Edge Case); a
  non-admin is `forbidden`; `invalid_name` for empty and 201 characters; it works on an archived
  project. (FR-023…FR-026, SC-007, SC-015)
  → verify: the test fails — the module does not exist.

- [X] T022 [US1] **Green (T021)** — implement `src/features/projects/server/update-column.ts`.
  Its parameter list is `{ columnId, name }` and nothing else — **no kind, no position, no project, no
  colour, not even as ignored optional fields** — `kind` is fixed at creation and no path this feature
  delivers can change it (FR-002, FR-023, VI, research B-6).
  → verify: T021 green.

- [X] T023 [US1] **Red** — extend `update-column.test.ts`: a rename colliding with another column
  of the same project, in any casing, is refused `duplicate_name` naming that column, by the **same**
  `23505` mapping and the same wording as the create (the constraint belongs to the pair, not to
  either mutator); and one `column_renamed` row carrying the **pre-rename** name in **both** `field`
  and `from_value` and the new name in `to_value` — the repetition is intended, not a defect.
  (FR-025, FR-045, FR-046, fifth Clarification)
  → verify: the test fails on both counts.

- [X] T024 [US1] **Green (T023)** — add the duplicate mapping and the `writeActivity` call to
  `update-column.ts`.
  → verify: T023 green.

- [X] T025 [US1] **Red** — new `src/features/projects/column-actions.test.ts`: `createColumn` and
  `updateColumn` run the preamble in [`contracts/mutators.md`](./contracts/mutators.md)'s order —
  `assertSameOrigin({ headers: await headers() })`, `requireActor()`, **resolve the row (missing ⇒
  `notFound()`, never `forbidden`)**, derive `projectId` from that stored row and **never** from a
  client argument, then `isAdmin`, then parse input, then one transaction, then `refresh()`. Assert a
  client-supplied internal project id is not accepted or trusted, and that step 3 precedes step 5 —
  the reverse of `src/features/labels/server/delete-label.ts`'s order, deliberately. **Every input is
  validated at runtime before it reaches a query** (contract *The preamble* table, FR-053): a
  `projectKey` that does not match `^[A-Z][A-Z0-9]{0,7}$` is `notFound()` before `loadProjectByKey`
  runs, and a `columnId` that is not a well-formed UUID is `notFound()` before the column resolve —
  neither is passed to the database, and neither surfaces as a PostgreSQL `22P02`.
  **Depends on T079.**
  (FR-007…FR-012, FR-053, research D-1, D-5)
  → verify: the test fails — the module does not exist.

- [X] T026 [US1] **Green (T025)** — create `src/features/projects/column-actions.ts` with a top-level
  `"use server"`, exporting `createColumn` and `updateColumn` over the two server modules, each
  applying T079's parsers at step 6 of the preamble (FR-053). **A
  separate module, not an append to the 240-line `actions.ts`** (research E-7); no barrel file mixes
  server and client exports. Not `[P]` — T042 and T057 edit this same file.
  → verify: T025 green; `npm run type-check` clean.

- [X] T027 [P] [US1] **Red** — extend
  `src/features/projects/components/editable-field.test.tsx`: a
  `{ status: "conflict"; message: string }` save result renders that message **inline** with
  `role="alert"`, associated to the control through `aria-describedby`, raises **no toast**, and still
  rolls the optimistic value back; the three existing variants (`saved`, `invalid`, `forbidden`) behave
  exactly as before. (FR-025, FR-027, `OT-UX-012`, research E-3)
  → verify: the test fails — `EditableFieldSaveResult` has three variants and the only failure path is
  `showToast`.

- [X] T028 [P] [US1] **Green (T027)** — add the fourth `EditableFieldSaveResult` variant and its
  inline rendering to `src/features/projects/components/editable-field.tsx`. **One variant is the
  whole change**; R5's four callers never return it and are unaffected (plan Complexity Tracking).
  → verify: T027 green; `npx vitest run src/features/projects/components/editable-field.test.tsx`
  and the four R5 caller tests all pass.

- [X] T029 [US1] **Red** — new `src/features/projects/components/add-column-form.test.tsx`: one
  `TextField` and **no kind control and no position control** (US1 scenario 2); validates per field and
  on blur while the **submit control stays enabled**, reporting a missing, whitespace-only or
  201-character name inline rather than going dead; a `duplicate_name` result renders inline naming
  `holder.name` with **no suffix applied and no retry under another name**; in-flight state while it
  waits for the server. Queried by role, label and visible text. (FR-019…FR-021, `OT-UX-011`,
  research E-4, F-4)
  → verify: the test fails — the component does not exist.

- [X] T030 [P] [US1] **Green (T029)** — implement
  `src/features/projects/components/add-column-form.tsx` from `react-aria-components` primitives,
  `onPress` never `onClick`, Tailwind for the visual layer only.
  → verify: T029 green.

- [X] T031 [US1] **Red** — new `src/features/projects/components/column-row.test.tsx`: for an admin
  the name renders through `EditableField` — activating it opens a field in place, Escape reverts
  unchanged, blur or ⌘-enter saves, Ctrl-enter is the non-⌘ binding, focus returns to the control when
  the field closes either way, **a blur whose value is unchanged makes no call at all**, and exactly
  **one** `updateColumn` call runs per rename; the `kind` renders as **text for every role, never a
  control, not even a disabled one**; the live `issueCount` renders, and **no colour swatch** — a
  column is told apart by name alone; for a non-admin the row is name,
  kind and count as static text with no control at all.
  **Every refused rename renders inline and none reaches the generic toast** (FR-027): the row's
  `onSave` adapter maps `duplicate_name` **and `forbidden`** to `EditableField`'s
  `{ status: "conflict"; message }` variant, with the two messages
  [`contracts/screens.md`](./contracts/screens.md) → *`ColumnRow`'s rename* pins, asserted verbatim;
  assert that `showToast` is **not** called on either and that
  *"Something went wrong. Try again."* — `defaultErrorMessage`'s default branch, which names neither
  what failed nor why — never renders; the optimistic value still rolls back on both.
  (FR-005, FR-014, FR-016, FR-017, FR-024, FR-025, FR-027, `OT-UX-010`, `OT-UX-012`, research E-6)
  → verify: the test fails — the component does not exist.

- [X] T032 [US1] **Green (T031)** — implement `src/features/projects/components/column-row.tsx`,
  including the `UpdateColumnState` → `EditableFieldSaveResult` adapter that maps both
  `duplicate_name` and `forbidden` to the `conflict` variant T028 adds (FR-027).
  **`editable-field.tsx` is not touched here** — its own `forbidden` branch and R5's four callers keep
  the toast they have; the mapping lives in this file.
  **No Delete control yet** — that is T061, which edits this same file, so neither is `[P]`.
  → verify: T031 green.

- [X] T033 [US1] **Red** — rewrite `src/features/projects/components/columns-section.test.tsx` for the
  `GridList` this feature converts the section to: **one markup for every role**, rows in
  `(sort_order, id)` order each carrying name, kind and issue count; R5's second case — "offers no
  control that adds, renames, reorders or deletes" — **survives verbatim as the non-admin case** and
  gains an admin counterpart offering the add form and the editable name. R5's `getAllByRole("row").slice(1)`
  goes with the `<thead>` it skipped; a `GridList` renders `role="grid"` with no header row.
  (FR-013, FR-014, FR-016, research E-1, plan *Not recorded as complexity*)
  → verify: the test fails — the section is still a `<table>` with a `<thead>`.

- [X] T034 [US1] **Green (T033)** — convert
  `src/features/projects/components/columns-section.tsx` to a single `GridList` from
  `react-aria-components/GridList`, with an optional `admin` prop shaped after `MembersSection`'s,
  rendering one `ColumnRow` per item and `AddColumnForm` beneath the list for an admin only.
  **No `dragAndDropHooks` yet** — that is T044, which edits this same file, so neither is `[P]`.
  → verify: T033 green.

- [X] T035 [US1] **Red** — extend
  `src/features/projects/components/project-details-screen.test.tsx` and
  `src/app/(app)/projects/[projectKey]/details/page.test.tsx`: `ProjectDetailsScreenAdmin` carries
  **`createColumn` and `updateColumn`** alongside `addProjectMemberAction`, `setProjectStatusAction`
  and the rest, and the page passes them on the **existing** `details.canAdminister` branch; a
  non-admin gets none of them and `ColumnsSection` receives no `admin` prop. `moveColumn` and
  `deleteColumn` are **not** asserted here — they do not exist yet, and each gets its own Red, T075
  and T076, before the Green that passes it through. (FR-013, contracts/screens.md)
  → verify: the test fails — the props do not exist.

- [X] T036 [US1] **Green (T035)** — add the column action props to
  `src/features/projects/components/project-details-screen.tsx` and pass `createColumn` and
  `updateColumn` from `src/app/(app)/projects/[projectKey]/details/page.tsx`. **`src/app` gains no
  domain module** — the page passes actions and nothing more. Not `[P]` — T045 and T062 edit these
  same two files.
  → verify: T035 green; `npm run verify` green.

- [X] T077 [P] [US1] **Verification** — new
  `src/features/projects/server/update-column-race.test.ts`, two real connections interleaved
  deliberately, the shape T052's `delete-column-race.test.ts` uses: two admins rename **two distinct
  columns of one project to the same name** at the same moment, each on its own connection, the second
  `UPDATE` issued before the first transaction commits. **Exactly one commits**; the other is refused
  by `board_column_project_id_name_lower_idx` — PostgreSQL `23505`, asserted on the SQLSTATE and never
  on a message — surfacing through T024's mapping as the same inline `duplicate_name` naming the
  existing column that a create is refused with. Assert the settled state directly against
  `board_column`: **no state exists in which both renames succeeded**, and the loser's column keeps its
  original name with no `updated_at` touch and no `column_renamed` row. This is FR-051's concurrency
  half — the uniqueness is the database's, and the test passes only because no pre-flight read is doing
  the work. **Depends on T024** (the `23505` mapping) and so on T022; the unique index it exercises is
  R5's and already on the branch. `[P]` — a new file no other task touches; `fileParallelism: false`
  on the `server` project means it does not race other files while its own two connections race each
  other. Its id is appended rather than inserted so no existing task id shifts.
  **A Verification and not a Red**: the index that refuses the second write is R5's and the mapping is
  T024's, both delivered before this task runs, so it passes on its first run, which Principle VII
  forbids calling a Red ("A test that passes on its first run is not a valid Red step"). It is never
  gate-1 evidence for the uniqueness refusal — that is T023/T024 — and it stays as the regression guard
  on FR-051's concurrency half, which no other task covers.
  (FR-004, FR-025, FR-051, fifth Edge Case, `OT-INV-016`, quickstart *What a browser cannot show you*)
  → verify: the file's every case passes, with exactly one commit and one `23505` on every run.

**Checkpoint**: User Story 1 is fully functional and independently testable — an admin adds and renames
columns from the Columns section, the collision is refused inline, and both writes land an activity row.

---

## Phase 4: User Story 2 — An admin reorders the board by dragging a column (Priority: P2)

**Goal**: `moveColumn` — one drop, one write, one activity row, and not one issue moved.

**Independent Test**: as an admin on a project holding its five seeded columns, drag "Canceled" from
last to first and confirm on reload that it lists first with the other four in their original relative
order, that no issue changed column, and that repeating the drag onto the position the column already
occupies writes nothing.

- [X] T037 [US2] **Red** — new `src/features/projects/server/move-column.test.ts` against real
  PostgreSQL: the move writes `sort_order` on the **moved row only**, via
  `generateKeyBetween(previousNeighbourKey, nextNeighbourKey)`, leaving every other column's
  `sort_order`, `name`, `kind` and `updated_at` untouched and every issue in exactly the column it was
  in; the project's column set is read `ORDER BY id … FOR UPDATE` — the same fixed, total lock
  acquisition order `deleteColumn` uses, never the `sort_order` the move rewrites — and the splice
  happens against that locked list sorted by `(sort_order, id)` in memory; a `targetColumnId`
  belonging to **another project** returns `{ ok: false, error: "invalid_target" }` — verified
  against the locked read, never against a client claim — while a `targetColumnId` naming a column a
  concurrent admin **deleted** between the render and that locked read returns
  `{ ok: false, error: "not_found" }` and **never** `invalid_target`, and the **moved column itself**
  vanishing between the initial resolve and the lock returns the same `not_found`: a column that is
  gone is a missing row, `invalid_target` being reserved for a target that exists and is illegal;
  **no ordinal, no index and no `sort_order` string crosses the boundary in either direction**;
  an unknown `columnId` is `notFound()`; a non-admin is `forbidden`; it works on an archived project.
  (FR-010, FR-028, FR-029, FR-033, SC-002, SC-015, sixth Clarification, contracts/mutators.md
  `moveColumn`, research A-3, B-4)
  → verify: the test fails — the module does not exist.

- [X] T038 [US2] **Green (T037)** — implement `src/features/projects/server/move-column.ts` per
  [`contracts/mutators.md`](./contracts/mutators.md), including its two `not_found` branches — the
  moved column absent from the locked set, and a `targetColumnId` that resolves to no row at all —
  kept distinct from `invalid_target`, which the target's own resolve reaches only for a row that
  exists in another project (FR-010). **No rebalancing, retry loop or collision
  recovery is written** — distinct neighbours inside the lock cannot produce a collision, and
  machinery for an unreachable state is what Principle III refuses (research A-3).
  → verify: T037 green.

- [X] T039 [US2] **Red** — extend `move-column.test.ts`: a drop resolving to the index the column
  already occupies returns `{ ok: true }` having issued **no `UPDATE` and no activity insert** —
  nothing at all, `updated_at` included; and a real move writes **exactly one** `column_reordered`
  row, for the column the drag moved, `field` its own name, `to_value` the name of the column it
  **now follows** and `null` when it is now first, `from_value` **null**; a column whose ordinal
  merely shifted beneath it gets **no** row. (FR-030, FR-046, FR-047, first Clarification, US2-3,
  research B-5, C-4, C-5)
  → verify: the test fails on both counts.

- [X] T040 [US2] **Green (T039)** — add the no-op short-circuit (contract step 3) and the
  `writeActivity(tx, { type: "column_reordered", … })` call to `move-column.ts`.
  → verify: T039 green.

- [X] T041 [US2] **Red** — extend `src/features/projects/column-actions.test.ts` with `moveColumn`'s
  preamble: same origin, actor, row-before-role resolve, project derived from the stored column row,
  `isAdmin`, one transaction, `refresh()`. The payload is `{ columnId, targetColumnId, placement }`
  and **carries no `projectKey`** — the project comes off the stored column row, so a key could only be
  ignored or wrongly trusted (FR-008, contracts/mutators.md `moveColumn`, research B-4). Each input is
  validated at runtime through T079's parsers before any query (FR-053): a malformed `columnId` is
  `notFound()`, a malformed `targetColumnId` is `{ ok: false, error: "not_found" }`, and a `placement`
  that is neither `"before"` nor `"after"` is `{ ok: false, error: "invalid_input" }` — **refused
  explicitly, never defaulted to `"after"` and never coerced**, the `"before" | "after"` union being a
  compile-time claim and not runtime validation. **Depends on T079.**
  (FR-007…FR-012, FR-053)
  → verify: the test fails — `moveColumn` is not exported.

- [X] T042 [US2] **Green (T041)** — export `moveColumn` from
  `src/features/projects/column-actions.ts`, applying T079's parsers and adding
  `{ ok: false; error: "invalid_input" }` to `MoveColumnState` for a rejected `placement` (FR-053).
  Not `[P]` — same file as T026 and T057.
  → verify: T041 green.

- [X] T043 [US2] **Red** — extend
  `src/features/projects/components/columns-section.test.tsx`: an admin's `GridList` is supplied
  `dragAndDropHooks` and a non-admin's is not, so a non-admin has **no drag affordance**; one drop
  fires exactly one `moveColumn` call with `{ columnId, targetColumnId, placement }` and **never an
  index or a `sort_order` string**; the keyboard path reaches the same reorder — Enter to lift, arrows
  to move, Enter to drop, Escape to abandon — with a visible focus indicator and an accessible name at
  every step, verified with **explicit key events**, not `@react-aria/test-utils`, which is not
  installed and is not added; an abandoned drag and a drop outside the list never fire `onReorder` and
  write nothing; the reorder applies optimistically and rolls back with a message naming what failed
  and why. **That message renders in one inline `<p role="alert">` beneath the `GridList`, referenced
  by the list through `aria-describedby`, and never as a toast** — assert `showToast` is not called —
  with the string [`contracts/screens.md`](./contracts/screens.md) → *The reorder* pins for each of
  `forbidden`, `not_found`, `invalid_target`, `invalid_input` and a call that fails with no reason
  code, asserted verbatim; the `not_found` case additionally refreshes the section; the message is
  cleared on the next successful drop. (FR-029, FR-031, FR-032, FR-053, SC-013, tenth Edge Case,
  research E-2, E-4, F-4)
  → verify: the test fails — the section has no `dragAndDropHooks`.

- [X] T044 [US2] **Green (T043)** — add `useDragAndDrop({ getItems, onReorder })` from
  `react-aria-components/useDragAndDrop` to `src/features/projects/components/columns-section.tsx`,
  supplied as `dragAndDropHooks` **for an admin only**, with the optimistic apply, the rollback, and
  the inline `role="alert"` message region beneath the list that carries the rollback's reason
  (FR-032). **No pointer handlers, no HTML5 drag events, no drag-and-drop library** (Principle IV,
  gate 4). Not `[P]` — same file as T034.
  → verify: T043 green.

- [X] T075 [US2] **Red** — extend
  `src/features/projects/components/project-details-screen.test.tsx` and
  `src/app/(app)/projects/[projectKey]/details/page.test.tsx`: `ProjectDetailsScreenAdmin` carries
  `moveColumn` alongside the two column actions T035 fixed, and the page passes it on the **existing**
  `details.canAdminister` branch; a non-admin gets none of them and `ColumnsSection` still receives no
  `admin` prop. T035 asserts `createColumn` and `updateColumn` only, so without this Red T045 is a
  Green no test fails without (gate 1). Its id is appended rather than inserted so no existing task id
  shifts. Not `[P]` — same two test files as T035 and T076, and `details/page.test.tsx` additionally
  with T065.
  (FR-013, contracts/screens.md)
  → verify: the test fails — `moveColumn` is not among the screen's props.

- [X] T045 [US2] **Green (T075)** — pass `moveColumn` through
  `src/features/projects/components/project-details-screen.tsx` and
  `src/app/(app)/projects/[projectKey]/details/page.tsx`. Not `[P]` — same files as T036 and T062.
  → verify: T075 green; `npm run verify` green.

**Checkpoint**: User Stories 1 **and** 2 both work independently.

---

## Phase 5: User Story 3 — An admin deletes an empty column, and meets four refusals (Priority: P3)

**Goal**: `deleteColumn`, its four refusals in one fixed precedence evaluated against locked rows, and
the confirmation that names the column.

**Independent Test**: on a project holding its five seeded columns and one issue in "Todo", confirm
Delete on "Todo" is refused for holding an issue; move that issue out and confirm Delete then asks for
confirmation naming "Todo" and removes it only once that is accepted, writing nothing if dismissed;
confirm Delete on "Done" is refused as the last `done`-kind and on "Canceled" as the last
`canceled`-kind, each with its own reason; delete down to one column and confirm Delete on it is
refused as the project's last.

- [X] T046 [P] [US3] **Red** — new `src/features/projects/server/column-delete-refusal.test.ts`: the
  pure selector over the four booleans returns them in the fixed precedence `holds_issues` →
  `last_column` → `last_canceled_kind` → `last_done_kind`, and `null` when none holds. **All four are
  computed before one is chosen**, so a column that is non-empty **and** the project's last always
  reports `holds_issues` (second Edge Case) and a column that is the project's last **and** its only
  `canceled`- and only `done`-kind column always reports `last_column` (first Edge Case) — the answer
  never depends on the order the checks are written in. Unit-testable without a database.
  (FR-038, SC-004, second Clarification, research B-2)
  → verify: the test fails — the module does not exist.

- [X] T047 [P] [US3] **Green (T046)** — implement
  `src/features/projects/server/column-delete-refusal.ts` — the `ColumnDeleteRefusal` union and the
  pure selector. An ordered list, **not a strategy table** (Principle III).
  → verify: T046 green.

- [X] T048 [US3] **Red (after T047)** — extend `src/features/projects/server/queries.test.ts`:
  `ProjectColumnRow` carries `deleteRefusal`, chosen by the **same** selector the mutator uses so the
  disabled control and the server never word the same refusal differently; it is `null` for a
  deletable column **and** `null` for every non-admin viewer, who is offered no Delete control at all
  and for whom it would be computed and discarded (VI). `sort_order` is still **not** exposed.
  (FR-016, FR-039, SC-004, SC-010, data-model §4)
  → verify: the test fails — the field does not exist.

- [X] T049 [US3] **Green (T048)** — add `deleteRefusal` to `ProjectColumnRow` and fill it in
  `loadProjectDetails` from the **same** `countIssuesByColumn` read T012 introduced, so the count
  shown beside a column and the reason its Delete control carries come from one read (FR-015, SC-010).
  Update the `ProjectColumnRow` fixtures the widened type breaks in
  `columns-section.test.tsx` and `column-row.test.tsx`. Not `[P]` — same file as T012.
  → verify: T048 green; `npx vitest run src/features/projects` passes.

- [X] T050 [US3] **Red (after T047)** — new
  `src/features/projects/server/delete-column.test.ts` against real PostgreSQL: a permitted delete
  removes exactly the one row in one transaction, **cascades to nothing**, leaves every other column's
  name, kind and relative order unchanged with **no gap and no renumbering** (the others' fractional
  keys are not written), and moves, changes or destroys **no issue**; each of the four refusals returns
  its own reason and writes nothing; a project with **two** `done`-kind columns lets one go, the
  restriction being on the last of a kind and not on the kind; a column deleted between the initial
  resolve and the locked read returns `{ ok: false, error: "not_found" }` — the one refusal path that
  is not one of the four — and **never** `forbidden`; a non-admin is `forbidden` even calling the
  mutator directly with the control bypassed; it works on an archived project.
  (FR-034…FR-041, FR-049, US3-7, SC-002, SC-015)
  → verify: the test fails — the module does not exist.

- [X] T051 [US3] **Green (T050)** — implement
  `src/features/projects/server/delete-column.ts`: resolve the target, count via
  `countIssuesByColumn(tx, projectId)`, compute all four booleans, select **one** reason through
  T047's selector, `DELETE`. **Minimal — no lock yet**; the lock is T053, whose Red is T052.
  → verify: T050 green.

- [X] T052 [P] [US3] **Red** — new `src/features/projects/server/delete-column-race.test.ts`, two real
  connections interleaved deliberately, shaped after
  `src/features/labels/server/issue-labels-race.test.ts`: **(a)** an issue inserted into the target
  column between the emptiness read and the delete ⇒ the delete is refused `holds_issues` rather than
  removing a column that now holds work (third Edge Case, SC-005); **(b)** two admins each deleting one
  of a project's last two `done`-kind columns at the same moment ⇒ one commits, the other is refused
  `last_done_kind`, and the project never reaches zero (fourth Edge Case, SC-003).
  (FR-050, research B-1, F-2; `fileParallelism: false` on the `server` project means these do not race
  other files while they race each other)
  → verify: **both cases fail against T051's unlocked read** — that is the intended reason, and it is
  what makes T053 a real Green rather than a no-op.

- [X] T053 [US3] **Green (T052)** — in `delete-column.ts`, replace the unlocked resolve with
  `SELECT id, name, kind FROM board_column WHERE project_id = $1 ORDER BY id FOR UPDATE` over the
  project's **whole column set** — a fixed, total order on every call so two concurrent deletes
  serialize rather than deadlock — and move the `countIssuesByColumn(tx, …)` call **inside** that lock.
  PostgreSQL's `FOR KEY SHARE` on a `board_column` row for any referencing `issue` write is what makes
  case (a) impossible to miss (data-model §2, research B-1). **A read followed by a write is not
  protection.** Not `[P]` — same file as T051 and T055.
  → verify: T052 green; T050 still green.

- [X] T054 [US3] **Red** — extend `delete-column.test.ts`: one `column_deleted` row on the
  project's feed, `field` the column's name **at delete time**, `from_value` and `to_value` null,
  `issue_id` null, written in the same transaction as the `DELETE`; **every** refusal — all four, plus
  `not_found` and `forbidden` — writes none. (FR-045, FR-046, FR-048, US5-5, SC-011)
  → verify: the test fails — no `writeActivity` call exists yet.

- [X] T055 [US3] **Green (T054)** — add
  `writeActivity(tx, { type: "column_deleted", target: { projectId }, actorId, field: column.name })`
  to `delete-column.ts`, after the `DELETE` and inside the same transaction. Not `[P]` against T051 or
  T053 — same file.
  → verify: T054 green.

- [X] T056 [US3] **Red** — extend `src/features/projects/column-actions.test.ts` with `deleteColumn`'s
  preamble, and assert its `{ ok: false, error: "not_found" }` reaches the client as the **stale-render
  case** the spec fixes — the column reported as already gone and the section refreshed — never as
  `forbidden` and never as one of the four delete refusals, since every column is readable by every
  signed-in user. A `columnId` that is not a well-formed UUID is `notFound()` through T079's parser
  before the resolve, never passed to the `uuid` column and never surfacing as a PostgreSQL `22P02`
  (FR-053). **Depends on T079.**
  (FR-007…FR-012, FR-053, eleventh Edge Case, `OT-UX-004`)
  → verify: the test fails — `deleteColumn` is not exported.

- [X] T057 [US3] **Green (T056)** — export `deleteColumn` from
  `src/features/projects/column-actions.ts`, applying T079's `parseColumnId` at step 6 (FR-053).
  Not `[P]` — same file as T026 and T042.
  → verify: T056 green.

- [X] T058 [US3] **Red** — new
  `src/features/projects/components/delete-column-dialog.test.tsx`: `DialogTrigger` → `Button` →
  `Modal isDismissable` → `Dialog`, the shape
  `src/features/projects/components/delete-project-control.tsx` already establishes; the dialog
  **names the column**; Confirm calls `deleteColumn` exactly once and shows in-flight state while it
  waits; **Cancel, dismiss and Escape each make no call, write nothing, leave the activity feed
  untouched** and return focus to the Delete control they were raised from — which `DialogTrigger` does
  on its own. A confirmation raised **over the section**, not a route and not a second screen.
  (FR-039, ninth Edge Case, SC-014, fourth Clarification, research E-5)
  → verify: the test fails — the component does not exist.

- [X] T059 [P] [US3] **Green (T058)** — implement
  `src/features/projects/components/delete-column-dialog.tsx`.
  → verify: T058 green.

- [X] T060 [US3] **Red** — extend `src/features/projects/components/column-row.test.tsx`: for an admin
  the Delete control **always renders**; when `deleteRefusal` is set it is **visible and disabled**
  with that refusal's reason in an inline `<p>` referenced by `aria-describedby` — **never hidden and
  never a dead control** — and the wording is the string
  [`contracts/screens.md`](./contracts/screens.md) → *The four refusals, worded* pins for that
  refusal, asserted **verbatim** for all four and identical to the one the mutator returns;
  when it is `null` the control is enabled and opens the dialog; a non-admin gets **no Delete control
  at all**; the enabled state always agrees with the count rendered beside it, and the test records
  that this describes the last render and is not a promise about the server.
  (FR-016, FR-039, SC-004, SC-010, research E-5)
  → verify: the test fails — the row renders no Delete control.

- [X] T061 [US3] **Green (T060)** — add the Delete control, its `DeleteColumnDialog` and its inline
  reason to `src/features/projects/components/column-row.tsx`, wording each refusal from the four
  strings [`contracts/screens.md`](./contracts/screens.md) → *The four refusals, worded* pins — **one
  place, read by both this control and the mutator's refusal**, so neither invents copy (FR-038,
  SC-004). Not `[P]` — same file as T032.
  → verify: T060 green.

- [X] T076 [US3] **Red** — extend
  `src/features/projects/components/project-details-screen.test.tsx` and
  `src/app/(app)/projects/[projectKey]/details/page.test.tsx`: `ProjectDetailsScreenAdmin` carries
  `deleteColumn` alongside the three column actions T035 and T075 fixed, and the page passes it on the
  **existing** `details.canAdminister` branch; a non-admin gets none of the four. Neither T035 nor T060
  asserts this file's props for the delete, so without this Red T062 is a Green no test fails without
  (gate 1). Its id is appended rather than inserted so no existing task id shifts. Not `[P]` — same two
  test files as T035 and T075, and `details/page.test.tsx` additionally with T065.
  (FR-013, contracts/screens.md)
  → verify: the test fails — `deleteColumn` is not among the screen's props.

- [X] T062 [US3] **Green (T076)** — pass `deleteColumn` through
  `src/features/projects/components/project-details-screen.tsx` and
  `src/app/(app)/projects/[projectKey]/details/page.tsx`. Not `[P]` — same files as T036 and T045.
  → verify: T076 green; `npm run verify` green.

- [X] T074 [P] [US3] **Verification** — new
  `src/features/projects/server/move-delete-race.test.ts`, two real connections interleaved
  deliberately, the shape T052 uses: `moveColumn` and `deleteColumn` run
  **concurrently against the same project's column set**, the move splicing across the column the
  delete is removing, and **both transactions reach a settled state** — one commits, and the other
  either commits or returns one of its own defined refusals — for the move that is **`not_found`**,
  the column the delete removed being a missing row rather than an illegal destination, and
  **never `invalid_target`**, which is reserved for a target that exists in another project and is
  therefore unreachable in this race (FR-010, sixth Clarification); for the delete,
  `holds_issues`, `last_column`, `last_canceled_kind`, `last_done_kind` or `not_found`.
  **Neither may fail with a deadlock**: PostgreSQL SQLSTATE `40P01` on either connection is a
  test failure, asserted on the error code and never on a message. This is the pair FR-050 binds to one
  acquisition order — both lock the set `ORDER BY id`, never by the `sort_order` the move rewrites.
  **Depends on T040 and T053**, since it exercises `move-column.ts` and the *locked* `delete-column.ts`
  together; its id is appended rather than inserted so no existing task id shifts. `[P]` — a new file
  no other task touches; `fileParallelism: false` on the `server` project means it does not race other
  files while its own two connections race each other.
  **A Verification and not a Red**: the shared `ORDER BY id` acquisition order it exercises is already
  delivered by T038 and T053, so it passes on its first run, which Principle VII forbids calling a Red
  ("A test that passes on its first run is not a valid Red step"). It is never gate-1 evidence for
  either lock — those are T037/T038 and T052/T053 — and it stays as the regression guard on the one
  acquisition order both mutators share.
  (FR-050, contracts/mutators.md `moveColumn` step 1 and `deleteColumn` step 1, research B-1)
  → verify: the file's every case passes, with **no** SQLSTATE `40P01` on either connection.

**Checkpoint**: all four mutators exist; the board cannot be made unusable.

---

## Phase 6: User Story 4 — Everyone who is not an admin reads and cannot change (Priority: P4)

**Goal**: the write boundary, proved end to end.

**⚠️ This phase carries no new production code, and says so deliberately.** Every guard it covers was
written under a Red step in Phases 3–5 — each mutator's own `forbidden` case is asserted in T015, T021,
T037 and T050, and the non-admin section rendering in T033. Its tasks are therefore **Verification**
steps, not Red steps, and none of them may be used as the gate-1 evidence for a guard. Writing them as
Reds would produce tests that pass on their first run, which Principle VII forbids.

**Independent Test**: with a project holding six columns, open its details page as a member and again
as a signed-in non-member and confirm both see all six with kinds and counts and neither is offered an
add, rename, reorder or delete affordance; then call each of the four mutators directly as each user
and confirm all eight calls are refused.

- [X] T063 [P] [US4] **Verification** — new
  `src/features/projects/column-write-boundary.test.ts`: the **eight** direct calls — four actions ×
  (project member, signed-in non-member) — are all refused `forbidden` with nothing written to
  `board_column` and nothing written to `activity`, whatever the client rendered; and an **admin who
  is not a member** of the project succeeds on all four, proving membership is never a second
  condition and that no rule carries an `|| isAdmin` branch. (FR-007, FR-009, FR-011, FR-040, SC-009,
  US4-3, research D-2)
  → verify: the file's every case passes; the guards' own Reds are T015, T021, T037, T050.

- [X] T064 [P] [US4] **Verification** — new
  `src/features/projects/server/column-read-boundary.test.ts`: a member, a signed-in non-member and an
  admin all read **every** column of **every** project with its kind and its live issue count, byte for
  byte the same rows; membership is never consulted for the read; `deleteRefusal` is `null` for the
  two non-admins. (FR-009, FR-014, FR-016, SC-009, US4-1, US4-5)
  → verify: the file's every case passes.

- [X] T065 [US4] **Verification** — extend
  `src/features/projects/components/columns-section.test.tsx` and
  `src/app/(app)/projects/[projectKey]/details/page.test.tsx`: a member and a signed-in non-member get
  the section with every row, kind and count and **no add control, no editable name, no drag affordance
  and no delete control** — a read-only list, not a disabled one (spec *Reconciliations*, §3.8);
  an admin whose `canAdminister` goes false loses the four controls on the next render with **no row
  removed and nothing else about the section changed**, which `refresh()` on each successful mutation
  is what makes true; and a project key matching no project still reads "This doesn't exist" and never
  implies a hidden-access state. Not `[P]` — these two files are edited in Phases 3 and 4.
  (FR-012, FR-016, US4-1, US4-2, US4-4, US4-6)
  → verify: `npm run verify` green.

**Checkpoint**: the write boundary holds from both sides.

---

## Phase 7: User Story 5 — Every column edit lands in the project's activity feed (Priority: P5)

**Goal**: the four rows, their frozen wording, and where they do and do not appear.

**Its production code already exists**: the widened `CHECK` and the three R7 files (T004, T006, T008)
and the four `writeActivity` calls (T020, T024, T040, T055), each written after its own Red. This
phase's tasks are the **cross-cutting** assertions the story names — the ones no single mutator's test
can make.

**Independent Test**: on a project with an empty feed, add a column, rename it, drag it one position
and delete it, then confirm four rows appear on that project's feed in that order, each naming the
actor and the column, with the rename carrying both names and the reorder naming the column it now
follows — and confirm all four still read correctly after the project's other columns are renamed.

- [X] T066 [P] [US5] **Verification** — new
  `src/features/projects/server/column-activity.test.ts`: the four edits in sequence produce **exactly
  four** rows on the project's feed in that order, each naming the actor and the column, and each row's
  `field` / `from_value` / `to_value` matches [`data-model.md`](./data-model.md) §3's *Row shapes*
  table exactly; **every refused edit produces none** — a colliding create, a colliding rename, a
  no-op rename, a no-op drop and each of the four delete refusals — asserted **against the `activity`
  table** rather than through the feed that reads it. Every string passes through R7's
  `truncateActivityValue`. (FR-045…FR-048, SC-011, US5-1…US5-5)
  → verify: the file's every case passes.

- [X] T067 [P] [US5] **Verification** — new
  `src/features/projects/server/column-activity-frozen.test.ts`: a row's `field`, `from_value` and
  `to_value` are unchanged after the column it names is renamed **again** and after it is **deleted
  outright**; no row carries a reference to the column, which is why it survives that column's deletion
  intact; and no row this feature writes is ever updated or deleted by any path but the cascade from
  the project. (FR-045, FR-048, SC-012, US5-8, `OT-INV-011`)
  → verify: the file's every case passes.

- [X] T068 [US5] **Verification** — extend
  `src/features/activity/server/feed-queries.test.ts`: a column edit appears on the **project's** feed
  and on **no issue's** feed in that project; and four column edits by one admin inside five minutes
  fold into one expandable line under R7's existing five-minute collapsing, which is **read, not
  modified** — `feed.tsx`, `feed-row.tsx`, `collapse.ts`, `feed-filter-toggle.tsx` and the pagination
  stay untouched. Not `[P]` — an R7 file. (FR-044, US5-6, US5-7)
  → verify: `npm run verify` green; `git status --short src/features/activity/components/` shows only
  `activity-row.tsx` and its test changed.

**Checkpoint**: all five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T069 [P] **Verification** — new `src/features/projects/server/no-issue-writes.test.ts`: take a
  full census of every issue's `column_id`, `sort_order` and `updated_at` before and after exercising
  all four mutators **including every refusal path**, and assert it identical; plus a source scan of
  `create-column.ts`, `update-column.ts`, `move-column.ts`, `delete-column.ts` and `column-actions.ts`
  asserting none of them writes the `issue` table, the idiom
  `src/features/labels/server/no-activity.test.ts` already uses. **No path that moves an issue exists
  and none is added.** (SC-002, FR-022, FR-028, FR-041, §4)
  → verify: the file's every case passes.

- [X] T070 [P] **Verification** — new `src/features/projects/column-refusal-surface.test.ts`: every
  `ok: false` payload the four mutators return is a reason code from
  [`contracts/mutators.md`](./contracts/mutators.md)'s unions and nothing else — **no `Error` crosses
  the boundary, no constraint name, no SQL, no stack trace and no configuration** — and the client maps
  the code to prose while the server logs the detail — `moveColumn`'s `invalid_input` included, and a
  malformed identifier surfacing as the missing row and never as a PostgreSQL `22P02` reaching the
  client. (FR-052, FR-053, research D-6, `AGENTS.md` → the server boundary)
  → verify: the file's every case passes.

- [X] T071 **Verification** — accessibility and interaction sweep across
  `add-column-form.test.tsx`, `column-row.test.tsx`, `delete-column-dialog.test.tsx` and
  `columns-section.test.tsx`: every control this feature adds carries an accessible name, a visible
  focus indicator and error text associated with its own control; **no state and no refusal is conveyed
  by colour alone**; `onPress` and never `onClick`; interaction state through `data-hovered`,
  `data-pressed`, `data-selected` and `data-focus-visible`; the reorder is completable with the
  keyboard alone. Not `[P]` — it touches four files earlier phases own.
  **A Verification and not a Red**: every behaviour it sweeps for is either React Aria's own — `onPress`,
  the `data-*` interaction state, the focus indicator, the focus return `DialogTrigger` performs — or
  already asserted under an earlier Red on the same four files (T029, T031, T043, T058, T060), so it
  passes on its first run, which Principle VII forbids calling a Red. It is gate-1 evidence for
  nothing, and needs no Green; a failure here is a regression in one of those Reds' components, fixed
  under that Red rather than under this task.
  (FR-018, SC-013, `OT-UX-018`, §7, `AGENTS.md` → React Aria Components)
  → verify: `npx vitest run src/features/projects/components` passes.

- [X] T072 **Verification** — run the ten walkthroughs in [`quickstart.md`](./quickstart.md) against
  `npm run dev` and a
  seeded project, as an admin, a member and a signed-in non-member. Record that its own *What a browser
  cannot show you* section — the **three** races and the `FOR UPDATE` lock — is covered by T052, T074
  and **T077** instead, not by the browser. This is where the one-screen claim is exercised end to
  end: all four
  edits are made from the Columns section with each change visible in the list without navigating
  away (SC-001). (SC-001)
  → verify: all ten walkthroughs behave as written; nothing is amended in `quickstart.md`.

- [X] T073 **Verification** — final gate. Run `npm run verify` and confirm `style-check` →
  `type-check` → `test` → `build` is green with **nothing failing and nothing skipped** (gates 5, 8). Confirm
  `git diff --stat package.json package-lock.json` is empty (gate 4); that the diff carries no
  comments, no commented-out code and no dead code (gates 5, 6); that `drizzle/0006_lying_sugar_man.sql`
  is unmodified and `drizzle/0007_*.sql` is committed with its `meta` update; and that every changed
  line traces to a requirement named in a task above (gate 7). Confirm the files
  [`plan.md`](./plan.md) lists as untouched are untouched — `next.config.ts`, `vitest.config.mts`,
  `tsconfig.json`, `drizzle.config.ts`, `biome.json`, `src/db/test-database.ts`, `src/db/touched.ts`,
  `src/db/unique-violation.ts`, `src/features/projects/actions.ts`, `seed-columns.ts`,
  `server/authorization.ts`, `src/features/issues/**`, `src/features/labels/**`, and every file under
  `src/app/(app)/projects/[projectKey]/` but the details page.
  → verify: `npm run verify` exits 0; `git status --short` shows only the paths this task list names.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** — no dependencies.
- **Foundational (Phase 2)** — depends on Setup. **Blocks every user story**: all four mutators write
  an activity row inside their own transaction, so all four are blocked on the widened `CHECK`
  (T003–T004), and both the section and `deleteColumn` read `countIssuesByColumn` (T009–T010), and all
  four actions validate their inputs through T079's parsers (T078–T079).
- **US1 (Phase 3)** — depends on Foundational; **T025 additionally depends on T079**, the parsers its
  preamble applies, and **T077 on T024**, the `23505` mapping it asserts the loser of the race
  surfaces through.
- **US2 (Phase 4)** — depends on Foundational; **T041 additionally depends on T079**, **T044 on
  T034, and T075→T045 on T035 and T036**, the files they edit.
- **US3 (Phase 5)** — depends on Foundational; **T049 depends on T012**, **T061 on T032**, **T076→T062 on
  T036/T045**, and **T057 on T026/T042** — the same files — with **T056 additionally on T079**. **T074 depends on T053 and additionally on
  Phase 4's T040**, since it runs `moveColumn` and `deleteColumn` against one project together.
- **US4 (Phase 6)** — verification only; depends on US1, US2 and US3 being complete.
- **US5 (Phase 7)** — verification only; depends on all four `writeActivity` calls (T020, T024, T040,
  T055) and on T004/T006/T008.
- **Polish (Phase 8)** — depends on every story being complete.

### Within each unit

- A **Green** never starts before its named **Red** has been run and observed failing **for the reason
  the Red names**. A Red that passes on its first run is corrected, not accepted (VII, gate 1).
- A **Verification** task is never used as gate-1 evidence for production code.
- Models and pure functions before the mutators that read them; mutators before the actions that
  export them; actions before the components that call them.

### Files edited by more than one task — never `[P]` against each other

| File | Tasks |
| --- | --- |
| `src/features/projects/server/queries.ts` | **T012, T049** |
| `src/features/projects/column-actions.ts` | **T026, T042, T057** |
| `src/features/projects/components/columns-section.tsx` | **T034, T044** |
| `src/features/projects/components/column-row.tsx` | **T032, T061** |
| `src/features/projects/components/project-details-screen.tsx` | **T036, T045, T062** |
| `src/app/(app)/projects/[projectKey]/details/page.tsx` | **T036, T045, T062** |
| `src/features/projects/server/delete-column.ts` | **T051, T053, T055** |
| `src/features/projects/server/queries.test.ts` | **T011, T048** |
| `src/features/projects/server/create-column.test.ts` | **T015, T017, T019** |
| `src/features/projects/server/create-column.ts` | **T016, T018, T020** |
| `src/features/projects/server/update-column.test.ts` | **T021, T023** |
| `src/features/projects/server/update-column.ts` | **T022, T024** |
| `src/features/projects/server/move-column.test.ts` | **T037, T039** |
| `src/features/projects/server/move-column.ts` | **T038, T040** |
| `src/features/projects/server/delete-column.test.ts` | **T050, T054** |
| `src/features/projects/column-actions.test.ts` | **T025, T041, T056** |
| `src/features/projects/components/columns-section.test.tsx` | **T033, T043, T049, T065, T071** |
| `src/features/projects/components/column-row.test.tsx` | **T031, T049, T060, T071** |
| `src/features/projects/components/add-column-form.test.tsx` | **T029, T071** |
| `src/features/projects/components/delete-column-dialog.test.tsx` | **T058, T071** |
| `src/features/projects/components/project-details-screen.test.tsx` | **T035, T075, T076** |
| `src/app/(app)/projects/[projectKey]/details/page.test.tsx` | **T035, T065, T075, T076** |

Phase 2's files are absent because each is edited by exactly **one** task: `schema.ts`,
`drizzle/0007_*.sql` and `write-activity.ts` by T004; `write-activity.test.ts` by T003;
`activity-type-parity.test.ts` by T005; `feed-queries.ts` by T006; `feed-queries.test.ts` by T068;
`activity-row.tsx` by T008; `activity-row.test.tsx` by T007; `column-input.test.ts` by T078 and
`column-input.ts` by T079. A Red and its Green there write a test
file and its implementation, which are two files, not one. Their strict order is a **dependency**, not
a file collision, and Phase 2 states it: none of T003–T008 is `[P]`.

### Parallel Opportunities — the explicit batches

Run `[P]` tasks only inside the batch that names them.

- **Batch 1 (Phase 1)**: T001, T002.
- **Batch 2 (Phase 2)**: T003→T004→T005→T006→T007→T008 is one strictly sequential chain (R7 and the
  migration). T009→T010→T011→T012 is a second chain that may run **beside** it, and T078→T079 a third
  — a test file and an implementation file no other task touches. Nothing else.
- **Batch 3 (Phase 3, Reds)**: T013, then after T014 — T015, T021, T027 and T029 each open a chain on
  a file of its own, and the four chains may be worked beside one another. T015 and T021 are **not**
  `[P]`: T017/T019 and T023 write those same two test files later in the phase.
- **Batch 4 (Phase 3, Greens)**: T028 and T030 in parallel, beside two **sequential** chains the
  shared-file table forces — T016→T017→T018→T019→T020 on `create-column.ts` and
  `create-column.test.ts`, and T022→T023→T024 on `update-column.ts` and `update-column.test.ts`.
  **T017/T018 and T019/T020 are not two parallel chains**: all four write those same two files, so
  T017/T018 completes before T019/T020 begins.
- **Batch 5 (Phase 3, tail — sequential)**: T025→T026→T031→T032→T033→T034→T035→T036. **T077 `[P]`** —
  a new file no other task touches — may be worked beside that chain any time after T024.
- **Batch 6 (Phase 4)**: T037→T038→T039→T040 is one chain — all four write `move-column.ts` and its
  test, so none is `[P]` — and it may be worked beside Phase 5's T046→T047.
  T041→T042→T043→T044→T075→T045 is sequential.
- **Batch 7 (Phase 5)**: T046→T047, then T050→T051→T052→T053→T054→T055 beside T058→T059.
  T048/T049, T056/T057, T060/T061 and T076/T062 are sequential. **T074 runs last in the phase**, after
  T053 and Phase 4's T040.
- **Batch 8 (Phase 6)**: T063, T064 in parallel; T065 after them.
- **Batch 9 (Phase 7)**: T066, T067 in parallel; T068 after them.
- **Batch 10 (Phase 8)**: T069, T070 in parallel; then T071→T072→T073.

Different user stories can be staffed in parallel once Phase 2 is complete, subject to the shared-file
table above.

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 — Setup (T001–T002).
2. Phase 2 — Foundational (T003–T012, and T078–T079 before its checkpoint). **Critical: blocks all
   stories.**
3. Phase 3 — User Story 1 (T013–T036, and T077 before its checkpoint).
4. **Stop and validate** against US1's *Independent Test*. An admin can add and rename columns, the
   collision is refused inline naming the existing column, and both writes land an activity row.
5. Deploy or demo.

### Incremental delivery

1. Setup + Foundational → the `CHECK` admits four values and the count is one read.
2. + US1 → add and rename (**MVP**).
3. + US2 → reorder by drag and by keyboard.
4. + US3 → delete, with the four refusals that will not let a board become unusable.
5. + US4 → the write boundary proved from both sides.
6. + US5 → the four rows verified frozen and on the right feed.
7. + Polish → the SC-002 census, the refusal surface, the a11y sweep, the quickstart and the gate.

Each step adds value without breaking the previous one.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task, **and** inside the batch that names it.
- **This feature installs no dependency.** The reorder is `react-aria-components`' own
  `useDragAndDrop`; the ordering index is `fractional-indexing`, already used by `create-issue.ts`.
  Any task that appears to need a package has been misread (Principle IV, gate 4).
- **No integer position exists and none is added.** `sort_order` is a fractional index string; the
  client never sees one and never computes one — a move is a neighbour id plus a placement.
- **`kind` is accepted by no mutator but the create, where it is a literal.** No control edits a kind
  anywhere in the product.
- **No colour, no swatch, no `column_recolored`** — four `column_*` values, not five.
- Persistence, locking and constraint tests are `*.test.ts` under the Vitest `server` project against
  a real PostgreSQL instance on a separate database. Component tests are `*.test.tsx` under `ui`,
  queried by role, label and visible text.
- Commit after each task or logical Red/Green pair — **the commit order is the gate-1 evidence a
  reviewer reads.**
- **No row is added to `docs/ROADMAP.md` §6 *Status log*, no version number is bumped anywhere, and no
  item in [`checklists/`](./checklists/) is ticked by any task above.**

---

## Phase 9: Convergence

- [X] T080 Render `deleteColumn`'s `{ ok: false, error: "not_found" }` on the client as the
  stale-render case — the column reported as already gone and the section refreshed — per FR-010 and
  [`contracts/mutators.md`](./contracts/mutators.md) → *`deleteColumn`* (missing). Today
  `column-row.tsx`'s `ColumnDeleteControl` passes `onDelete={async () => { await deleteColumn(...) }}`
  and discards the whole `DeleteColumnState`, and `delete-column-dialog.tsx` closes the dialog
  unconditionally, so a column a concurrent admin deleted between the render and the confirm produces
  no message and no refresh. `columns-section.tsx` already does exactly this for `moveColumn`'s
  `not_found` — the same message-plus-`router.refresh()` treatment, worded in
  [`contracts/screens.md`](./contracts/screens.md) → *The reorder*.
  → verify: a Red in `column-row.test.tsx` asserting a `not_found` confirm reports the column already
  gone and refreshes the section, observed failing first.

- [X] T081 Surface every `ok: false` `DeleteColumnState` an **enabled** Delete can return as an inline
  message naming what failed and why, per FR-052 and SC-004 (missing). The locked re-check is
  authoritative and may still refuse an enabled Delete where an issue was moved into the column after
  the render (third Edge Case, SC-005), and a stale-role page can return `forbidden` (FR-011) — both
  are today swallowed, so a refused deletion states nothing at all, which is less than the generic
  failure SC-004 already forbids. Reuse the four strings `column-row.tsx`'s `DELETE_REFUSAL_MESSAGES`
  already holds, fixed in [`contracts/screens.md`](./contracts/screens.md) → *The four refusals,
  worded*, so the control and the server never word the same refusal differently; invent no copy.
  Render inline on the Delete control with `role="alert"`, the treatment this feature's other two
  refusals already have — not a toast (FR-018).
  → verify: a Red in `column-row.test.tsx` for each of `refused` (all four refusals) and `forbidden`,
  observed failing first. Note `column-row.test.tsx`'s existing case *"describes the last render and
  never promises the server will agree"* asserts only that the control stays as rendered; it is
  extended, not replaced, and stays ticked.

- [X] T082 Give `listProjectColumns` in `src/features/issues/server/issue-queries.ts` the `id`
  tie-break it lacks, so it reads `(sort_order, id)`, per FR-033 (partial). FR-033 fixes that order
  "on every query that reads columns" and states that ties are legal and MUST NOT be repaired, which
  makes the tie-break the only thing keeping two columns sharing an ordering index from appearing in a
  different order on two reads; this query orders by `sort_order` alone. **Raise before implementing**:
  [`plan.md`](./plan.md) → *Project Structure* lists `src/features/issues/**` as untouched, so this is
  a spec-over-plan call on a file entry R6 owns — confirm the one-line change belongs here rather than
  as an R6 correction before making it (gate 7).
  → verify: a Red in `src/features/issues/server/issue-queries.test.ts` seeding two columns of the
  project with the same `sort_order` and asserting a stable `(sort_order, id)` order across two reads,
  observed failing first.

---

## Phase 10: Convergence

- [X] T083 Give the conflict alert `src/features/projects/components/editable-field.tsx` renders an id
  unique to the field instance rather than the literal `` `${label}-conflict` ``, so each column row's
  refused rename is associated with its own control, per FR-018 and FR-027 (partial). FR-018 requires
  "error text associated with the control it belongs to" and FR-027 puts every `updateColumn` refusal
  inline on the name field through this one variant. `column-row.tsx` renders
  `<EditableField label="Column name" …>` on **every** row, so the id is the same string on all of
  them: two rows each holding a conflict — an admin meets FR-025's collision on one column, then on a
  second — emit two `<p id="Column name-conflict" role="alert">` and both name buttons carry
  `aria-describedby="Column name-conflict"`, which resolves to the first match in document order, so
  the second row's control is described by the first row's message. `conflictMessage` clears only when
  that same row is reopened, so both persist. `ColumnDeleteControl` in `column-row.tsx` already does
  the right thing with `useId()`; this is the same treatment for the rename's alert. The
  `disabledReason` id beside it is R5's and has no second caller on this screen — leave it untouched
  (gate 7). Change no wording: the four `UpdateColumnState` messages stay exactly as
  [`contracts/screens.md`](./contracts/screens.md) → *`ColumnRow`'s rename* fixes them.
  → verify: a Red in `column-row.test.tsx` (or `columns-section.test.tsx`) rendering a section of at
  least two admin rows, driving a `duplicate_name` refusal on each, and asserting the two alerts carry
  different ids and that each row's name button is `aria-describedby` its own alert — observed failing
  first.

---

## Phase 11: Convergence

- [X] T084 Replace the four undefined CSS custom properties this feature's own components style with,
  so the visual layer FR-018 and SC-013 describe actually renders, per FR-018, SC-013 and
  [`contracts/screens.md`](./contracts/screens.md) → *Component tree* (partial). `src/app/globals.css`
  is the only stylesheet in the repo, and `grep -rn "focus-ring" src/` returns four consumption sites
  and no definition — `--color-focus-ring`, `--color-text-danger` and `--color-surface-active` are
  referenced but never declared, so each utility emits `var(…)` with no value and the declaration is
  dropped. Six sites, all in files this feature added:
  `add-column-form.tsx:87` (`data-[pressed]:bg-(--color-surface-active)` and
  `data-[focus-visible]:outline-(--color-focus-ring)`), `columns-section.tsx:137` and `:141`
  (the `GridListItem` and the drag `Button`, both `outline-(--color-focus-ring)`),
  `columns-section.tsx:157` (the reorder rollback `role="alert"`, `text-(--color-text-danger)`),
  `column-row.tsx:66` (the delete failure `role="alert"`, `text-(--color-text-danger)`) and
  `column-row.tsx:79` (the disabled Delete, `outline-(--color-focus-ring)`). The defined tokens the
  repo already uses are: `--color-accent` for the focus ring — `globals.css` states in its own words
  that `--color-accent` "stays reserved for the focus ring and other non-text uses", and
  `project-header.tsx`, `new-issue-control.tsx` and `mention-picker.tsx` all write
  `data-[focus-visible]:outline-(--color-accent)`; `--color-danger-text` for refusal text, which this
  feature's **own** `editable-field.tsx:227` conflict alert already uses correctly, so the feature
  words the same kind of message in two different tokens; and `--color-accent-pressed` for a pressed
  button, per `primary-button-classes.ts`. Do **not** add tokens to `src/app/globals.css` — the
  palette is R1's and §7's, and every colour these six sites need is already declared there. Leave
  `--color-surface-hover` on `add-column-form.tsx:87` alone: it is equally undefined but has a
  pre-existing caller in R7's `mention-picker.tsx:83`, so it is a repo-wide gap rather than this
  branch's, and gate 7 keeps it out of this diff. Change no markup, no wording, no `role`, no
  `aria-describedby` wiring and no test expectation — this is `className` strings only.
  → verify: `npm run verify` green, and a manual read of the six lines confirming every
  `--color-*` they name resolves against a declaration in `src/app/globals.css`.

