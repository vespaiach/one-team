# Tasks: Issues — creation, detail and editing

**Input**: Design documents from [`specs/006-issues-creation-detail-editing/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: **required, and written first.** Principle VII is non-negotiable in this repository and
change gate 1 asks for a test that was observed failing before its implementation. Every
implementation task below names the test task that must be Red before it starts.

**Organization**: by user story, in the spec's priority order. Each story is independently testable
against the *Independent Test* its phase states.

---

## Blocking precondition — entries R2 and R5

**No task below can start until both are implemented.** The tree today holds R1 only: `src/app`,
`src/db`, `src/features/auth` and two migrations.

This feature consumes, and does not build:

- **from R2** — the `(app)` route group and its shell, `forbidden()` and its screen, the "This
  doesn't exist" notice, the header contract with its New issue slot, the skeleton convention, the
  toast conventions, and the two guard-only pages Phases 3 and 4 fill;
- **from R5** — the `project`, `project_member`, `board_column` and `issue_counter` tables, the
  `isMember` predicate, the five seeded columns, `/projects/:projectKey/details`, the project header,
  and the markdown implementation `T032`–`T035` extract.

```bash
git log --oneline -1 -- src/features/projects/server
```

An empty result means R5 has not landed. `T001` is that check.

**R3 is not a precondition.** The assignee pool filters on `user.deactivated_at`, a column R1's table
already carries (spec, *Dependencies*).

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US5]`, mapping to the spec's five user stories
- Every task names the file it touches and the requirement that puts it there

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the one dependency and the one test-harness line every later phase assumes.

- [X] T001 Confirm entries R2 and R5 have landed by running **both** precondition checks in [`quickstart.md`](./quickstart.md) — stop here if either returns nothing — then work its reconciliation table: read R5's shipped `issue_counter` columns, its `board_column` constraints, where its markdown implementation sits and whether project details renders the New issue slot, and correct this plan where the assumed shape and the shipped one differ. `issue_counter`'s column name and meaning is the one this feature was written against without being able to see it (spec *Obligations*, [`data-model.md`](./data-model.md) §3, research A-7)
- [X] T002 [P] Install `fractional-indexing` and add it to `dependencies` in `package.json` — already recorded in `AGENTS.md`'s approved table for this purpose, so gate 4 is met by a record that predates this plan (FR-040, research A-9)
- [X] T003 [P] Add `"issue"` to `TRUNCATED_TABLES` in `src/db/test-database.ts`, ahead of the R5 tables it references, so each persistence test starts clean (research E-3)

**On gate 1 for this phase.** T002 and T003 add no behaviour of their own — one dependency and one
array entry. Each is proved by a later Red step: T002 by T017, T003 by every persistence test from
T004 onward. No test is written for them here and none is skipped.

**Checkpoint**: the ordering library is available and the runner truncates the new table.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the table every story writes to, and the parsers every mutator validates with. This
phase reaches back into R5's `board_column` — recorded in the plan's Complexity Tracking, not
discovered in the diff.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T004 [P] Write the failing shape and bound tests in `src/db/issue-constraints.test.ts`, against the real PostgreSQL instance `TEST_DATABASE_URL` names: a title of exactly 200 and a description of exactly 10 000 accepted, 201 and 10 001 refused; each of the five priorities accepted and a sixth refused; `project_id`, `number`, `title`, `column_id`, `created_by` and `sort_order` each refused when null (FR-004, FR-008, SC-016, edge cases 19)
- [X] T005 [P] Write the failing absence tests in `src/db/issue-shape.test.ts`: the `issue` table object carries no `status`, no `parentId` or any self-reference, and no `deletedAt` — each absence is a requirement, and the migration is the second check gate 1 asks for (FR-002, FR-003, FR-057, research E-4)
- [X] T006 [P] Write the failing key-and-address tests in `src/db/issue-keys.test.ts`: two issues in one project cannot share a number; the same number in two projects is legal; an issue whose `column_id` belongs to another project is refused by the database rather than by any application check (FR-005, FR-014, FR-017, `OT-INV-004`)
- [X] T007 [P] Write the failing cascade-ordering test in `src/db/issue-cascade.test.ts`: deleting a project that holds both columns and issues succeeds in one statement — the composite key's check is deferred to statement end, so the cascade may remove either side first. This is the test that fails if a later reader "tightens" the key to `RESTRICT` (FR-005, research A-4)
- [X] T008 Implement the `issue` table in `src/db/schema.ts` per [`data-model.md`](./data-model.md) §1 — UUIDv7 key, the three `CHECK` constraints, `UNIQUE (project_id, number)`, the cascading `project_id` key, the composite `(project_id, column_id)` key left at its default `NO ACTION`, and no delete action on `assignee_id` or `created_by` — and add `UNIQUE (project_id, id)` to R5's `board_column` in the same file, which is the constraint the composite key requires and R5 has no other use for (FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, data-model §1–2) — makes T004, T005, T006 and T007 green
- [X] T009 Run `npm run db:generate`, read the generated SQL to confirm the composite key is `NO ACTION` and both bounds are `char_length` checks, and commit the migration with its metadata (`AGENTS.md` → Drizzle) — depends on T008
- [X] T010 [P] Write the failing parser tests in `src/features/issues/server/input.test.ts`: `parseTitle` trims then requires 1–200 and never truncates; `parseDescription` allows empty and refuses over 10 000; `parsePriority` admits exactly five values; `parseDueDate` admits `YYYY-MM-DD` naming a real day, refuses `2026-02-30`, and **accepts a date in the past** — the assertion exists so that a `min` added later fails a test rather than passing review; each returns `null` rather than a coerced value (FR-004, FR-006, FR-008, FR-030, FR-037, edge case *due date in the past*, contracts/mutators.md)
- [X] T011 Implement one parser per field in `src/features/issues/server/input.ts`, in R1's `parseEmail` idiom — takes `unknown`, returns the narrowed value or `null`, never coerces, never truncates, and measures the title's bound after the trim (FR-008, FR-037, Principle II) — makes T010 green

**Checkpoint**: the table exists with every invariant the database owns, and every field has a parser. User story implementation can begin.

---

## Phase 3: User Story 1 — A member creates a unit of work (Priority: P1) 🎯 MVP

**Goal**: Create issue as a full page; one `createIssue` writing the issue and drawing its number in
one transaction; the permanent per-project number; the foot-of-order index.

**Independent Test**: sign in as a member of a project that holds no issues, open
`/projects/:projectKey/issues/new`, submit a title alone, and confirm one issue exists carrying
number 1, the project's first column, no priority, no assignee, no due date, and a sort position at
the foot of the project's order. No other story needs to exist.

**Why first**: nothing in R7 through R12 has anything to attach to until an issue exists, and the
project R5 delivers holds nothing until this story lands.

### Tests for User Story 1 (write first, observe failing) ⚠️

- [X] T012 [P] [US1] Write the failing numbering tests in `src/features/issues/server/create-issue.test.ts`: the first issue in a project takes 1 and the eighth takes 8; the draw advances the counter row and touches no `project` row; deleting the highest-numbered issue does not free its number; a creation that fails after drawing does not return it (FR-013, FR-014, SC-003, US1 s2, US5 s5)
- [X] T013 [P] [US1] Write the failing concurrency test in `src/features/issues/server/create-issue-race.test.ts`: two `createIssue` calls on **two separate `postgres` connections**, each in its own transaction, drawing from the same counter row — the second blocks until the first commits and then reads the higher number, both succeed, and the numbers differ. Two promises on one connection serialize in the driver and prove nothing (FR-016, FR-063, SC-002, US1 s3, research E-2)
- [X] T014 [P] [US1] Write the failing default and transaction tests in `src/features/issues/server/create-issue-defaults.test.ts`: a title alone yields the project's first column by board position, priority `none`, no assignee and no due date; `created_by` is the actor; `created_at` and `updated_at` are written explicitly; the whole write is one database transaction (FR-003, FR-011, FR-032, FR-033, FR-034, FR-035, FR-039, FR-063, US1 s1)
- [X] T015 [P] [US1] Write the failing ordering tests in `src/features/issues/server/create-issue-order.test.ts`: the first issue in an empty project receives the first index of the scheme rather than an empty or sentinel value; the next sorts after it; no existing row's `sort_order` changes (FR-040, SC-005, edge case *base case*)
- [X] T016 [P] [US1] Write the failing refusal tests in `src/features/issues/server/create-issue-refusals.test.ts`: a whitespace-only title is refused and writes nothing; a 201-character title and a 10 001-character description are each refused with the field named and nothing truncated; an assignee outside the project's pool is refused; a project whose counter row is missing is refused rather than having one created (FR-022, FR-030, FR-037, FR-066, SC-016, US1 s4, edge cases *counter row missing*)
- [X] T017 [P] [US1] Write the failing query tests in `src/features/issues/server/issue-queries.test.ts`: the project's columns come back in board order; the assignee pool is that project's `project_member` rows **plus** every admin, with deactivated users excluded and an admin holding no row still present; a user removed from the project or deactivated **keeps** an existing assignment and keeps rendering, but is no longer offered as a new one (FR-022, FR-024, FR-032, `OT-AUTHZ-007`, edge cases *assignee removed*, *deactivated assignee*)
- [X] T018 [P] [US1] Write the failing form tests in `src/features/issues/components/create-issue-form.test.tsx`: title first and focused and the only required field; the project absent as a field; validation per field on blur **and again on submit**, so a form submitted with nothing blurred reports on the fields; the Create control staying enabled while reporting inline; an over-length value reported on the field naming the bound with no save issued; and a project whose assignee pool is empty still rendering the assignee control — offering only unassigned, never hidden and never absent, which `FR-047`'s identical-structure rule makes a failure mode rather than a cosmetic one (FR-030, FR-031, FR-036, FR-037, FR-047, US1 s4, edge case *assignee pool is empty*)
- [X] T019 [P] [US1] Write the failing in-flight tests in `src/features/issues/components/create-issue-flight.test.tsx`: while the action is pending the Create control shows in-flight state, the form waits, and **no key is rendered anywhere** — not a placeholder, not a provisional `WEB-?`; Cancel returns without writing (FR-015, FR-038, FR-039, US1 s5, s6)
- [X] T020 [P] [US1] Write the failing route test in `src/app/(app)/projects/[projectKey]/issues/new/page.test.ts`: `requireActor()` runs first, then the project is resolved and a key matching nothing answers "This doesn't exist", and only then does `isMember` run — the one route in this feature where existence is decided before authorization, which `FR-046` requires and `FR-021` makes safe (FR-027, FR-029, FR-046, research D-1)

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement the columns and assignee-pool reads in `src/features/issues/server/issue-queries.ts`, both reading users through R1's `publicUser` projection (FR-022, FR-032, data-model §4) — makes T017 green
- [X] T022 [US1] Implement `createIssue` in `src/features/issues/server/create-issue.ts` — one transaction holding, in order: the project's highest `sort_order`, the counter draw as a single `UPDATE … RETURNING` that holds its row lock to commit, `generateKeyBetween(highest, null)`, and the insert with `touched()` (FR-013, FR-039, FR-040, FR-063, research A-6, A-9, B-4) — depends on T011, T021; makes T012, T013, T014, T015 green
- [X] T023 [US1] Add the refusal paths to `src/features/issues/server/create-issue.ts` — the typed result union, the pool check, the parser results, and the missing-counter refusal that creates nothing (FR-022, FR-037, FR-066, contracts/mutators.md) — depends on T022, makes T016 green
- [X] T024 [US1] Export `createIssue` as a form action from `src/features/issues/actions.ts` under one top-level `"use server"`, with the `(prevState, formData)` signature `useActionState` needs, delegating to `server/create-issue.ts` and revalidating nothing on success because it redirects (FR-039, research B-1, B-2, B-10) — depends on T023
- [X] T025 [US1] Implement `src/features/issues/components/create-issue-form.tsx` as the one `"use client"` boundary for this screen — the six fields, the defaults, per-field-and-submit validation, and the native `<input type="date">` for the due date rather than React Aria's `DatePicker`, which would require a package absent from `AGENTS.md`'s approved table (FR-030, FR-031, FR-032, FR-033, FR-034, FR-035, FR-036, FR-037, research D-7) — depends on T024, makes T018 green
- [X] T026 [US1] Add the in-flight and cancel behaviour to `src/features/issues/components/create-issue-form.tsx` — the non-optimistic wait, in-flight state on the Create control, and no key rendered before the server supplies the number (FR-015, FR-038, FR-039) — depends on T025, makes T019 green
- [X] T027 [P] [US1] Implement the create form's skeleton in `src/features/issues/components/issue-skeletons.tsx` — the field shapes, matching the layout it replaces, never a spinner (FR-067, `OT-UX-005`)
- [X] T028 [US1] Fill `src/app/(app)/projects/[projectKey]/issues/new/page.tsx` — `requireActor()`, resolve the project by key with `notFound()`, `isMember` with `forbidden()`, then the two queries and the form, wrapping only the data-dependent subtree in `Suspense` with T027's skeleton so the guard still answers `403` and `404` as themselves (FR-027, FR-029, FR-067, research D-1, D-10) — depends on T021, T025, T027; makes T020 green
- [X] T029 [US1] Refactor with the tests green across `create-issue.ts`, `issue-queries.ts`, `create-issue-form.tsx` and the create page: no comment added, no component taking a prop its scenario does not require, and the counter draw and order append left inline in `create-issue.ts` rather than extracted to modules with one caller each (gates 2, 6; Principle I)

**Checkpoint**: US1 is fully functional and testable on its own. Issues can be created and numbered; nothing yet reads them back at a URL.

---

## Phase 4: User Story 2 — Anyone opens an issue at a shareable URL (Priority: P2)

**Goal**: the issue page at its own deep-linkable address, readable by every signed-in user; the key
as its first element and copy-link target; the markdown subset rendered by one implementation that
also serves R5's project descriptions.

**Independent Test**: with one issue in the database, open
`/projects/:projectKey/issues/:issueNumber/details` as a signed-in non-member and confirm the key is
the page's first element, the title and description render, the rail shows column, priority, assignee
and due date, and project, created-by and timestamps render as values rather than controls.

### Tests for User Story 2 (write first, observe failing) ⚠️

- [X] T030 [P] [US2] Write the failing grammar tests in `src/components/shared/markdown/parse.test.ts`: each of the seven constructs in exactly the spelling `FR-009` fixes; `_` carrying no meaning so `created_at` renders whole; no backslash escape, no bare-URL autolink, no inline nesting, and no significance to indentation before a list marker (FR-009, contracts/markdown.md)
- [X] T031 [P] [US2] Write the failing fall-through tests in `src/components/shared/markdown/parse-fallthrough.test.ts`: a table row, an image, an embed, a fence, a blockquote, a rule, raw HTML, an unclosed emphasis run and an unterminated link each parse to the characters the author typed — never to an error, never to the construct they resemble (FR-009, SC-013, edge cases *unsupported construct*, *unclosed emphasis*)
- [X] T032 [P] [US2] Write the failing link-allowlist tests in `src/components/shared/markdown/parse-links.test.ts`: `http`, `https` and `mailto` become link nodes; `javascript:`, `data:`, `file:`, a scheme-relative `//host` and an empty href each become a **text node carrying the source characters** — decided at parse time, so the renderer has no branch that could emit an unchecked href (FR-010, SC-013, research C-6)
- [X] T033 [P] [US2] Write the failing render tests in `src/components/shared/markdown/markdown.test.tsx`: each construct renders as its own element; `<b>hi</b>` renders as visible text with no bold, because the renderer builds React elements and never an HTML string; no `dangerouslySetInnerHTML` appears in the module (FR-009, SC-013, `AGENTS.md` → Architecture notes)
- [X] T034 [P] [US2] Write the failing DTO test in `src/features/issues/server/issue-view.test.ts`: the query resolves an issue from the **pair** of project key and number, a number existing only in another project does not resolve under this key, users come through `publicUser`, and `sort_order` is absent from the DTO (FR-017, FR-045, data-model §4, US2 s5)
- [X] T035 [P] [US2] Write the failing key tests in `src/features/issues/issue-key.test.ts`: the project key and number join as `WEB-142`; the value is derived rather than stored; and the same issue yields the same key by every route that can reach it, at every later point in its life (FR-012, SC-004, data-model §6)
- [X] T036 [P] [US2] Write the failing layout tests in `src/features/issues/components/issue-detail.test.tsx`: a main column plus a 262px rail; the key first **in document order**, then title, then description; the rail carrying column, priority, assignee and due date; project, created-by and timestamps rendered as values and not as controls; no Activity section and no label control anywhere (FR-042, FR-043, FR-045, US2 s1)
- [X] T037 [P] [US2] Write the failing copy tests in `src/features/issues/components/copyable-key.test.tsx`: the control copies the issue's **full address**, the one the browser shows, and is available to every signed-in user because copying a link is not a write (FR-042)
- [X] T038 [P] [US2] Write the failing description tests in `src/features/issues/components/issue-description.test.tsx`: markdown rendered on read; an issue with no description renders nothing where it would be, indistinguishably from one whose description is empty; no preview pane and no formatting toolbar (FR-044, US2 s2, s3)
- [X] T039 [P] [US2] Write the failing route tests in `src/app/(app)/projects/[projectKey]/issues/[issueNumber]/details/page.test.ts`: any signed-in user reaches it; an unmatched project key or issue number reads "This doesn't exist" and implies no hidden-access state; an unauthenticated caller is redirected to `/signin` and never reaches Forbidden (FR-041, FR-046, SC-014, US2 s4, s6)

### Implementation for User Story 2

- [X] T040 [US2] Move R5's markdown implementation from wherever R5 placed it inside `src/features/projects/` to `src/components/shared/markdown/`, splitting it into `parse.ts` (pure, no React) and `markdown.tsx` (blocks to React elements), and repoint R5's two imports. **The move's licence is the path and the imports, nothing else** (FR-044, spec *Obligations*, research C-7, C-8) — makes T033 green
- [X] T041 [US2] Complete `src/components/shared/markdown/parse.ts` against `FR-009`'s grammar — the block scan, the inline scan with no nesting, and the scheme allowlist applied while the link is read (FR-009, FR-010, contracts/markdown.md) — depends on T040; makes T030, T031, T032 green
- [X] T042 [US2] Run R5's own description tests in `src/features/projects/` unchanged (`npx vitest run src/features/projects`) and confirm they pass — they are the extraction's regression test, and a genuine divergence from `OT-DATA-015` found here is an **R5 defect fixed as one**, not absorbed into this diff (FR-044, SC-017) — depends on T041
- [X] T043 [P] [US2] Implement the key formatter in `src/features/issues/issue-key.ts` (FR-012) — makes T035 green
- [X] T044 [US2] Implement the `IssueView` read in `src/features/issues/server/issue-queries.ts`, resolving from the project-key-and-number pair and assembling the DTO per [`data-model.md`](./data-model.md) §4 — never returning a database row, and never carrying `sort_order` (FR-017, FR-045, `AGENTS.md` → TypeScript) — depends on T021, T043; makes T034 green
- [X] T045 [P] [US2] Implement `src/features/issues/components/copyable-key.tsx` as a `"use client"` React Aria `Button` writing the current address to the clipboard (FR-042) — makes T037 green
- [X] T046 [US2] Implement `src/features/issues/components/issue-detail.tsx` as a **synchronous** component taking `IssueView` plus `canWrite`, `canDelete` and `writeReason` — main column, 262px rail, the key first in document order, and the immutable values as values (FR-042, FR-043, FR-045, research D-2) — depends on T043, T045; makes T036, T038 green
- [X] T047 [US2] Add the issue page's skeleton — main column and rail shapes — to `src/features/issues/components/issue-skeletons.tsx`, matching the layout it replaces closely enough that nothing already on the page moves when the data lands, and never a full-screen spinner (FR-067, SC-021, `OT-UX-005`) — depends on T027, which creates the file
- [X] T048 [US2] Fill `src/app/(app)/projects/[projectKey]/issues/[issueNumber]/details/page.tsx` — `requireActor()`, resolve the issue from the pair with `notFound()`, read `isMember` and `isAdmin` for presentation only, and render `IssueDetail`; `Suspense` around the data-dependent subtree with T047's skeleton, below the guard (FR-041, FR-046, FR-067, research D-1, D-10) — depends on T044, T046, T047; makes T039 green
- [X] T049 [US2] Refactor with the tests green across `parse.ts`, `markdown.tsx`, `issue-queries.ts` and `issue-detail.tsx`: no comment added, no `dangerouslySetInnerHTML` anywhere, and nothing extracted from the markdown module beyond the two files two call sites justify (gates 2, 6)

**Checkpoint**: US1 and US2 both work independently. An issue can be created and opened at its own address, and every description in the product renders through one implementation.

---

## Phase 5: User Story 3 — A member changes every field on an issue (Priority: P3)

**Goal**: in-place title and description editing and the rail's four quick-change controls, each one
`updateIssue` call applied optimistically and rolled back with its reason; the partial-field,
one-transaction, changed-field contract four later entries depend on.

**Independent Test**: as a member, edit the title, the description, and each of the four rail fields
on one issue, and confirm each is one save, each is visible before the server answers, and each
reverts with a message when the server refuses it.

### Tests for User Story 3 (write first, observe failing) ⚠️

- [X] T050 [P] [US3] Write the failing partial-field tests in `src/features/issues/server/update-issue.test.ts`: a field absent from the input is left untouched; `null` clears `assigneeId` and `dueDate` and is refused on every other field; a call naming one field leaves every other column byte-identical (FR-006, FR-055, SC-018, US3 s6)
- [X] T051 [P] [US3] Write the failing no-op test in `src/features/issues/server/update-issue-noop.test.ts`: a call whose named values all match the stored row writes nothing at all — `updated_at` byte-identical afterwards, which is the whole assertion because `touched()` supplies it on every write path (FR-055, SC-018, research B-7)
- [X] T052 [P] [US3] Write the failing immutability tests in `src/features/issues/server/update-issue-immutable.test.ts`: `UpdateIssueInput` carries no field for the project, the number, the creator or the ordering index, so `FR-007` and `OT-INV-002` hold by the type rather than by a check that could be forgotten (FR-007, FR-055, SC-009, US3 s7)
- [X] T053 [P] [US3] Write the failing transaction and lock test in `src/features/issues/server/update-issue-transaction.test.ts`: the stored row is read `FOR UPDATE` inside the same transaction that writes, so a second `updateIssue` on the same issue waits rather than computing its change against a value about to change — the property R7's activity row and R11's notification depend on (FR-055, FR-063, research B-5)
- [X] T054 [P] [US3] Write the failing concurrency test in `src/features/issues/server/update-issue-race.test.ts`, on two separate connections: both saves of the same field succeed, neither is refused, neither caller is told it lost, and the later-committing value is what every subsequent reader sees (FR-064, SC-019, edge case *two members editing*)
- [X] T055 [P] [US3] Write the failing refusal tests in `src/features/issues/server/update-issue-refusals.test.ts`: a column belonging to another project is refused **by the database**, not by the control's contents; an assignee outside the pool is refused; an over-length title or description is refused with nothing truncated; a refusal carries no SQL, constraint name or stack trace (FR-022, FR-049, FR-052, FR-065, SC-016, SC-020, edge case *column deleted*)
- [X] T056 [P] [US3] Write the failing in-place tests in `src/features/issues/components/editable-text.test.tsx`: click turns the value into a field; Escape reverts and writes nothing; blur and the command-modifier-with-Enter each save; **exactly one** `updateIssue` call per field, and **zero** when the blurred value matches the one the field opened with; the value is focusable and enters edit mode from the keyboard alone; focus lands in the field on open and returns to the value on save, revert and refusal (FR-048, US3 s1, s2, s3, edge case *blur on an unchanged field*)
- [X] T057 [P] [US3] Write the failing field-shape tests in `src/features/issues/components/editable-text-shape.test.tsx`: the title is one line, required and trimmed, and accepts a multi-line paste with its breaks collapsed to spaces; the description grows to the height at which the page scrolls and scrolls within itself beyond that; an over-length value keeps the field open with an inline error naming the bound and issues no save (FR-049, SC-016, edge case *pasted line breaks*)
- [X] T058 [P] [US3] Write the failing rail tests in `src/features/issues/components/issue-rail.test.tsx`: four quick-change controls, each one `updateIssue` call; the column control offering **this** project's columns and no other's; the assignee and due date each clearable; every column transition legal in both directions with no confirmation; the project's `canceled`-kind column offered like any other and the move out of it as available as the move in, which is the Red step behind US5's cancellation route; and a project holding exactly one column offering a control with one option — already the issue's own — where no transition is possible and none is refused (FR-006, FR-051, FR-052, FR-053, FR-056, US3 s5, s6, US5 s3, edge cases *only canceled-kind column*, *exactly one column*)
- [X] T059 [P] [US3] Write the failing optimistic tests in `src/features/issues/components/issue-rail-optimistic.test.tsx`: a change is visible **before the server answers**; a refusal rolls it back, the rolled-back value is itself visible, and an error toast names what failed and why; a **successful** write raises no toast at all (FR-050, SC-006, US3 s4)

### Implementation for User Story 3

- [X] T060 [US3] Implement `updateIssue` in `src/features/issues/server/update-issue.ts` — one transaction: `SELECT … FOR UPDATE`, the predicate against the stored row's project, the parsers, then the delta (FR-055, FR-063, research B-5) — depends on T011; makes T050, T052, T053, T054 green
- [X] T061 [US3] Add the delta's two uses inside that transaction, in `src/features/issues/server/update-issue.ts` — deciding whether to write at all, and building the `SET` list from changed columns only. **The delta is not returned**: nothing in R6 reads it, and a value exposed for a later entry to consume would be dead code under Principle VI (FR-055, SC-018, research B-6) — depends on T060, makes T051 green
- [X] T062 [US3] Add the refusal paths to `src/features/issues/server/update-issue.ts` — the typed result union, the pool check, the parser results, and a database refusal mapped to the same result kind as a mutator's own, carrying no SQL (FR-022, FR-049, FR-052, FR-065, contracts/mutators.md) — depends on T061, makes T055 green
- [X] T063 [US3] Export `updateIssue` from `src/features/issues/actions.ts` as a typed Server Function — not a form action, because the rail and the in-place fields are single values changing, not forms — and revalidate the issue detail route (FR-048, FR-051, research B-2, B-10) — depends on T062
- [X] T064 [P] [US3] Implement `src/features/issues/components/editable-text.tsx` as one `"use client"` component with **two call sites in this same commit** — title and description, whose behaviour `FR-048` makes identical, differing only in single-line versus growing multi-line and in which bound the error names (FR-048, FR-049, Principle I, research D-4) — depends on T063; makes T056, T057 green
- [X] T065 [US3] Implement `src/features/issues/components/issue-rail.tsx` — three React Aria `Select`s and the native date input, each one `updateIssue` call, with **no shared field abstraction**: the three selects differ in what they render per item, and R10's board is the second call site if there is one (FR-051, FR-052, research D-6) — depends on T063; makes T058 green
- [X] T066 [US3] Add optimistic apply to `editable-text.tsx` and `issue-rail.tsx` with `useOptimistic` inside the transition that wraps the action — the rollback is the transition ending, with no manual previous-value bookkeeping; no `useMemo`, `useCallback` or `memo` is hand-written, because React Compiler is enabled (FR-050, research D-5) — depends on T064, T065; makes T059 green
- [X] T067 [US3] Wire `EditableText` and `IssueRail` into `src/features/issues/components/issue-detail.tsx`, replacing the read-only title, description and rail values from T046 (FR-048, FR-051) — depends on T046, T066
- [X] T068 [US3] Refactor with the tests green across `update-issue.ts`, `editable-text.tsx` and `issue-rail.tsx`: no comment added, the delta still unexposed, and no `RailSelect` extracted for three controls that differ (gates 2, 6; Principles I, VI)

**Checkpoint**: US1 and US2 still stand alone, and US3 is complete on top of US2's page — not independent of it, as the story graph below records. Every field on an issue can be changed, and the mutator contract four later entries extend is complete and tested on this feature alone.

---

## Phase 6: User Story 4 — A non-member meets the write boundary and understands it (Priority: P4)

**Goal**: every control disabled with a sentence naming the project rather than hidden; the server
refusing whatever the client rendered; the assigned non-member told which project they would need to
join.

**Independent Test**: as a signed-in non-member assigned an issue, open that issue and confirm every
rail control and the title and description are disabled with an inline reason naming the project,
that the header's New issue control is disabled with the same reason, and that the create route
answers Forbidden.

### Tests for User Story 4 (write first, observe failing) ⚠️

- [X] T069 [P] [US4] Write the failing predicate tests in `src/features/issues/server/issue-authorization.test.ts`: each mutator resolves its row first and answers a missing row as **missing** rather than as a refusal; each derives its project from a row the server read — the stored issue for two, the route-resolved project for `createIssue`; a caller with no session is refused by every mutator independently of any route guard; a deactivated account resolves to no actor and reaches none of them; and a member may edit **any** issue in their project, with no authorship check anywhere on an issue (FR-018, FR-019, FR-020, SC-007, US5 s4)
- [X] T070 [P] [US4] Write the failing disabled-state tests in `src/features/issues/components/issue-detail-boundary.test.tsx`: for a non-member every rail control is visible and disabled with an inline reason naming the **project by name**, the title and description are not clickable and carry the same reason, and nothing is hidden (FR-026, FR-051, FR-054, US4 s1)
- [X] T071 [P] [US4] Write the failing structure test in `src/features/issues/components/issue-detail-parity.test.tsx`: the same elements in the same order for a member, a non-member and an admin — none absent for one, and none changing between a control and plain text (FR-047, SC-012, US4 s1)
- [X] T072 [P] [US4] Write the failing assigned-non-member test in `src/features/issues/components/assigned-non-member.test.tsx`: the page names the project they would need to be added to, readable without operating any control (FR-023, SC-008, US4 s2)
- [X] T073 [P] [US4] Write the failing accessibility tests in `src/features/issues/components/issue-detail-a11y.test.tsx`: each disabled control's reason is associated with **that control** programmatically rather than sitting as adjacent text; every control carries an accessible name; column and priority each carry a text equivalent beside their colour (FR-068, SC-022)
- [X] T074 [P] [US4] Write the failing New issue tests in `src/features/issues/components/new-issue-control.test.tsx`: for a member it points at `/projects/:projectKey/issues/new`; for a non-member it is visible, disabled and carries a reason naming the project — never hidden (FR-028, `OT-UX-021`, US4 s3)
- [X] T075 [P] [US4] Write the failing route-refusal test in `src/app/(app)/projects/[projectKey]/issues/new/forbidden.test.ts`: a non-member reaching the route by deep link, bookmark or stale tab gets Forbidden; an unauthenticated caller is redirected to `/signin` and never reaches it; the disabled control and the Forbidden screen are independent (FR-029, SC-007, US4 s4)
- [X] T076 [P] [US4] Write the failing admin-and-membership tests in `src/features/issues/server/membership-transitions.test.ts`: an admin holding no membership row has every control enabled, because `isMember` admits every admin; membership removed mid-session removes no row and disables controls on the next render; membership granted mid-session enables them on that same next render (FR-018, FR-025, US4 s5, s6, edge case *membership granted*)

### Implementation for User Story 4

- [X] T077 [US4] Add `canWrite`, `canDelete` and `writeReason` to `src/app/(app)/projects/[projectKey]/issues/new/page.tsx` and `.../[issueNumber]/details/page.tsx`, and to `IssueView`'s companion props in `src/features/issues/server/issue-queries.ts` — decided on the server from `isMember` and `isAdmin`, and passed down as values the client renders rather than predicates it re-derives (FR-019, data-model §4) — depends on T028, T048; makes T069, T076 green
- [X] T078 [US4] Implement the disabled treatment in `editable-text.tsx` and `issue-rail.tsx` — visible, disabled, the reason as text naming the capability and the project by name, and nothing hidden (FR-026, FR-051, FR-054) — depends on T077; makes T070, T071, T072 green
- [X] T079 [US4] Associate every reason and every inline validation error with its own control programmatically, and add the text equivalent beside each colour, across `editable-text.tsx`, `issue-rail.tsx` and `create-issue-form.tsx` (FR-068, SC-022, research D-11) — depends on T078; makes T073 green
- [X] T080 [US4] Implement `src/features/issues/components/new-issue-control.tsx` and wire it into the header slot on **all three** project-scoped screens that exist when this feature lands — R5's project details page under `src/features/projects/`, and this feature's own two pages under `src/app/(app)/projects/[projectKey]/issues/`. R5 cannot do this: the route does not exist until this feature builds it (FR-028, spec *Obligations*) — depends on T077; makes T074 green
- [X] T081 [US4] Add the `isMember` guard with `forbidden()` to `src/app/(app)/projects/[projectKey]/issues/new/page.tsx`, after the project resolution from T028 and never before it (FR-029, research D-1) — depends on T028, makes T075 green
- [X] T082 [US4] Refactor with the tests green across `src/features/issues/components/editable-text.tsx`, `issue-rail.tsx`, `create-issue-form.tsx` and `new-issue-control.tsx`: one reason string built in one place and passed down, rather than composed independently in each component (gates 2, 6, 7)

**Checkpoint**: all four stories are complete. US4 is the boundary treatment of controls US1, US2 and US3 deliver, so it is finished rather than independent. Everyone reads everything, only members write, and every refusal explains itself in the same words.

---

## Phase 7: User Story 5 — An admin destroys an issue, and a member cancels one instead (Priority: P5)

**Goal**: `deleteIssue` behind `isAdmin`, hard and cascading in the database in one transaction; the
rail's Delete control with its single confirmation; the member's reversible route through a
`canceled`-kind column.

**Independent Test**: as an admin, use the issue rail's Delete control, pass its confirmation, and
confirm nothing that referenced the issue survives and the browser lands on that project's details
page; as a member, confirm the same rail control is visible and disabled with its reason and that
moving the issue into a `canceled`-kind column is available instead.

### Tests for User Story 5 (write first, observe failing) ⚠️

- [X] T083 [P] [US5] Write the failing delete tests in `src/features/issues/server/delete-issue.test.ts`: `isAdmin` required and a non-admin refused whether or not the disabled control was bypassed; the delete runs in one database transaction and does not answer until it commits; the freed number is never reissued (FR-014, FR-056, FR-058, SC-003, SC-010, US5 s4, s5)
- [X] T084 [P] [US5] Write the failing cascade test in `src/features/issues/server/delete-issue-cascade.test.ts`: nothing in this feature references an issue, so the delete removes the issue alone; asserted from a **second connection outside the transaction**, so no reader observes an intermediate state (FR-058, FR-059, SC-011, US5 s1)
- [X] T085 [P] [US5] Write the failing control tests in `src/features/issues/components/delete-issue-control.test.tsx`: the control sits in the rail **beneath** the four editable rows; enabled for an admin; visible and disabled with its reason for everyone else, never hidden; no path writes without the confirmation (FR-061, US5 s2)
- [X] T086 [P] [US5] Write the failing confirmation tests in `src/features/issues/components/delete-confirmation.test.tsx`: the sentence names the issue by key and title; with nothing attached it confirms **without a count**, in the same register as any other; the dialog takes and holds focus, dismisses on Escape and on an explicit cancel, returns focus to the Delete control, and does not open with the destructive action focused (FR-061, FR-062, edge case *cascade reaches nothing*)
- [X] T087 [P] [US5] Write the failing navigation test in `src/features/issues/components/delete-navigation.test.tsx`: a successful delete lands on `/projects/:projectKey/details` — R5's route, so the destination exists when this feature lands (FR-060, US5 s1)
### Implementation for User Story 5

- [X] T088 [US5] Write the cancellation **regression** assertion in `src/features/issues/components/cancel-not-delete.test.tsx`: a member is offered the project's `canceled`-kind column through the ordinary column control, the move is reversible, and it needs no mutator of its own (FR-053, FR-056, US5 s3) — **this is not a Red step and must not be written as one.** T065 already delivers the behaviour, so this test passes the first time it runs; its Red step is T058, in US3, written before T065 exists. A test that passes on its first run is not a valid Red step, so it sits here rather than in the block above — depends on T065

- [X] T089 [US5] Implement `deleteIssue` in `src/features/issues/server/delete-issue.ts` — `isAdmin`, the row resolved, then one `DELETE` inside one transaction that answers only after commit. The transaction wrapping one statement is not redundant: R7's and R11's cascade work joins it rather than introducing it (FR-056, FR-058, FR-059, research B-8) — makes T083, T084 green
- [X] T090 [US5] Export `deleteIssue` from `src/features/issues/actions.ts` and revalidate the project details route it navigates to (FR-060, research B-10) — depends on T089
- [X] T091 [US5] Implement `src/features/issues/components/delete-issue-control.tsx` — the rail placement beneath the four rows, the admin-only enablement, and the disabled-with-reason state for everyone else (FR-061) — depends on T090, T078; makes T085 green
- [X] T092 [US5] Add the confirmation to `src/features/issues/components/delete-issue-control.tsx` as a React Aria `AlertDialog` inside a `Modal`, its sentence built from the issue's key and title plus a **list of cascade counts that is empty today** — an array read on every render, not a placeholder, so R8 and R11 each add a clause rather than a seam (FR-062, research D-8) — depends on T091; makes T086 green
- [X] T093 [US5] Add the post-delete navigation to `/projects/:projectKey/details` in `src/features/issues/components/delete-issue-control.tsx` (FR-060) — depends on T092, makes T087 green
- [X] T094 [US5] Confirm the member's cancellation route needed no new code: T088 passed without one line being added to `src/features/issues/components/issue-rail.tsx`, whose column control offers the `canceled`-kind column like any other. A task that writes nothing cannot make a test green, and this one does not claim to — it records that the story's promise was already kept (FR-053, FR-056) — depends on T088

**Checkpoint**: all five stories are complete and the feature is done. Only US1 and US2 were ever independent of each other; the story graph below is what the phases actually deliver.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T095 [P] Run the seven criteria a browser cannot show, from [`quickstart.md`](./quickstart.md)'s closing table, and confirm each names a test that exists and passes: `SC-002`, `SC-011`, `SC-016`, `SC-018`, `SC-015`, `SC-019`, `SC-020`
- [ ] T096 [P] Walk the fifteen walkthroughs in [`quickstart.md`](./quickstart.md) end to end against a running installation, including walkthrough 1's under-a-minute creation from an empty project, walkthrough 14's keyboard-only pass and walkthrough 15's throttled load (SC-001, SC-021)
- [ ] T097 Audit the diff against gate 6 — no comment, no commented-out code, no dead code — across every file this feature touched, with particular attention to `src/features/issues/server/update-issue.ts`'s delta, which must be consumed inside its transaction and returned nowhere (Principles V, VI; research B-6)
- [ ] T098 Audit the diff against gate 7 — every changed line traces to a requirement, and the only files touched outside `src/features/issues/`, `src/components/shared/markdown/` and `src/app/(app)/projects/[projectKey]/issues/` are the three reach-backs the plan's Complexity Tracking records: `src/db/schema.ts` for `board_column`'s constraint, `src/features/projects/` for the markdown imports, and its project-details screen for the header slot
- [ ] T099 Confirm `package.json` gained exactly one dependency, `fractional-indexing`, and that `@internationalized/date` was not added — the due date is a native input for that reason (gate 4, research D-7)
- [ ] T100 Run `npm run verify` — `style-check`, `type-check`, `test`, `build` — and confirm it passes with nothing failing or skipped. `--passWithNoTests` means a green run is not by itself evidence of gate 1; the commit order is (gates 5, 8)

---

## Dependencies & Execution Order

### Phase dependencies

- **Blocking precondition**: entries R2 and R5 implemented. Nothing below starts without both.
- **Setup (Phase 1)**: no dependencies beyond the precondition.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every user story** — there is no table to write to and no parser to validate with until it completes.
- **User stories (Phases 3–7)**: all depend on Foundational. See the story graph below.
- **Polish (Phase 8)**: depends on every story being complete.

### Story dependencies

The five stories are **not** fully independent, and the graph is worth stating plainly rather than claiming otherwise:

- **US1 (P1)** — depends on Foundational only. This is the MVP and it stands alone.
- **US2 (P2)** — depends on Foundational only. It can be built against a row inserted by hand, so it does not require US1; in practice US1 gives it something to read.
- **US3 (P3)** — depends on **US2** for the page its controls sit on (T067 wires into T046's component). The mutator itself (T060–T063) depends on Foundational alone and can be built in parallel with US2.
- **US4 (P4)** — depends on **US1, US2 and US3**, because it is the boundary treatment of controls those three deliver. It is genuinely last-but-one, not merely lower priority.
- **US5 (P5)** — depends on **US2** for the rail and on **US4** for the disabled treatment its control reuses (T091 depends on T078).

### Within each story

- Tests are written and observed failing before the implementation that makes them green
- Schema before queries, queries before mutators, mutators before actions, actions before components, components before pages
- Each story ends with a refactor task run with its tests green (gate 2)

### Parallel opportunities

- T002 and T003 in Setup
- T004–T007 in Foundational — four test files, no shared state; then T008 alone, because all four target one schema file
- Every `Tests for User Story N` block is fully parallel — one test file each
- T021 and T043 across stories
- T027 and T047 write two skeleton shapes into **one file**, so they are sequential: T027 creates it, T047 adds to it. Neither carries `[P]` against the other, and T027's `[P]` is against the rest of its own phase
- The `updateIssue` chain (T060–T063) runs in parallel with all of US2's component work
- With three developers after Foundational: A takes US1, B takes US2, C takes US3's mutator chain — then B and C converge on US4

---

## Parallel Example: User Story 1

```bash
# All nine Red steps, one per file:
Task: "Numbering tests in src/features/issues/server/create-issue.test.ts"
Task: "Concurrency test in src/features/issues/server/create-issue-race.test.ts"
Task: "Default and transaction tests in src/features/issues/server/create-issue-defaults.test.ts"
Task: "Ordering tests in src/features/issues/server/create-issue-order.test.ts"
Task: "Refusal tests in src/features/issues/server/create-issue-refusals.test.ts"
Task: "Query tests in src/features/issues/server/issue-queries.test.ts"
Task: "Form tests in src/features/issues/components/create-issue-form.test.tsx"
Task: "In-flight tests in src/features/issues/components/create-issue-flight.test.tsx"
Task: "Route test in src/app/(app)/projects/[projectKey]/issues/new/page.test.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **critical, blocks everything**
3. Phase 3: User Story 1
4. **Stop and validate**: run quickstart walkthroughs 1, 2 and 3. An issue can be created, numbered
   and ordered, and the create form refuses what it should. Nothing reads it back yet.

### Incremental delivery

1. Setup + Foundational → the table and the parsers exist
2. **+ US1** → issues can be created (MVP)
3. **+ US2** → issues can be opened and shared, and every description in the product renders through one implementation
4. **+ US3** → issues can be changed, and the contract R7, R8, R10 and R11 extend is complete
5. **+ US4** → the write boundary is visible and enforced
6. **+ US5** → the lifecycle closes

Each increment is a usable product. Stopping after US3 leaves a tracker in which everyone can write
— which is wrong, but not broken; stopping after US2 leaves a read-only record, which is coherent.

---

## Notes

- **Tests are not optional here.** Principle VII is non-negotiable and gate 1 requires each test observed failing for the intended reason before its implementation. A test that passes on its first run is not a valid Red step and must be corrected.
- Every persistence test runs against the real PostgreSQL instance `TEST_DATABASE_URL` names, on a separate database. `fileParallelism` is already `false` in the `server` project.
- **No async Server Component is rendered by a test.** Every page is a thin wrapper over a synchronous component, which is what makes gate 1 reachable for every acceptance scenario (research D-2).
- **No seam is built for a later entry.** No hook registry, event dispatch or callback layer appears in any task above: Principle I extracts at a second call site, Principle III admits indirection for a requirement present today, and an unused seam is dead code under Principle VI.
- Commit after each task or logical group; the commit order is the evidence a reviewer needs for gate 1.
