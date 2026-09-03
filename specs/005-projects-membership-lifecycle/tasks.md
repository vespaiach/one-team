---
description: "Task list for R5 — projects: creation, record, membership and lifecycle"
---

# Tasks: Projects — creation, record, membership and lifecycle

**Input**: Design documents from [`specs/005-projects-membership-lifecycle/`](.)

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md),
[`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: **Mandatory, not optional.** [`AGENTS.md`](../../AGENTS.md) Principle VII is
non-negotiable and change gate 1 requires a test written before the implementation and *observed
failing for the intended reason*. Every implementation task below is therefore preceded by its test
task, and the pair is never parallel with itself.

**Organization**: Tasks are grouped by user story so each can be implemented, tested and delivered
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — a different file, and no dependency on an incomplete task
- **[Story]**: the user story the task serves (US1…US5); Setup, Foundational and Polish carry none
- Every task that changes the tree names the exact file it touches; the setup and polish tasks that
  verify rather than change name the command, environment value or diff range they act on instead

---

## ⚠️ Blocking preconditions

Two of these are outside this feature and **no task below can start until they hold**.

| Precondition | Why | Owner |
| --- | --- | --- |
| **Entry R2 has landed** — the `(app)` shell, its sidebar regions and their admin-only `+`, `ScreenHeader`, the Forbidden screen, the toast conventions and the per-screen skeletons | Every screen here renders inside it | roadmap R2, spec `004`/`002` |
| **Entry R3 has landed** — the accounts the member pickers read | `listAddableUsers` has nothing to return without it | roadmap R3 |
| **`@internationalized/date` is recorded in AGENTS.md's approved-dependency table** | `DatePicker`'s value is a `CalendarDate` that `react-aria-components` does not re-export; gate 4 refuses an undeclared dependency | T002 below |

Today `src/` holds `src/app`, `src/db` and `src/features/auth` — R1 and nothing else. The
[`plan.md`](./plan.md) records this; it is not a surprise to discover mid-phase.

---

## Phase 1: Setup

**Purpose**: confirm the ground this feature stands on, and clear the one governance item.

- [X] T001 Confirm the R2 and R3 preconditions by checking that `src/app/(app)/layout.tsx`, `src/features/shell/components/project-list-region.tsx`, `src/features/shell/components/screen-header.tsx` and the accounts query R3 delivers all exist; stop and report if any is absent
- [X] T002 Add one row for `@internationalized/date` to the approved-dependency table in `AGENTS.md`, scoped `runtime`, purpose "Calendar date values for React Aria DatePicker", then declare it in `package.json` at the version already resolved in the tree
- [X] T003 [P] Confirm `TEST_DATABASE_URL` in the environment points at a database separate from development, since every persistence task below truncates tables in it

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the schema, the migration and the three modules every user story reads from.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

**On Red for the schema.** A constraint test's honest first failure is *the write succeeded that
should have been refused*. Write T004–T007 first and run them; they will fail because the tables do
not exist, which is not yet the intended reason. After T008 declares the tables, run them again and
confirm each still fails for its own reason before T009 adds the constraints that make them pass.

- [X] T004 Write failing constraint tests for `project` in `src/db/constraints.test.ts` — the key pattern, `UNIQUE (key)`, the `status` CHECK, the `project_dates_ordered` CHECK, and the 200/10 000 character bounds
- [X] T005 Write failing constraint tests for `project_member` in `src/db/constraints.test.ts` — the `(project_id, user_id)` composite primary key refuses a duplicate pair, and the row disappears when its project is deleted
- [X] T006 Write failing constraint tests for `board_column` in `src/db/constraints.test.ts` — `UNIQUE (project_id, lower(name))` refuses a case-varied duplicate, the `kind` CHECK admits only `open|done|canceled`, and the cascade
- [X] T007 Write failing constraint tests for `issue_counter` in `src/db/constraints.test.ts` — the unique constraint on `project_id` refuses a second row, refuses it under two concurrent inserts as well as sequentially (`SC-017`), the table carries no `created_at` or `updated_at`, and the row cascades with its project
- [X] T008 Declare `project`, `projectMember`, `boardColumn` and `issueCounter` in `src/db/schema.ts` with their columns, foreign keys and the `sortOrder` `customType` that carries `COLLATE "C"`, and add the four table names to `TRUNCATED_TABLES` in `src/db/test-database.ts`
- [X] T009 Add every CHECK and unique constraint from [`data-model.md`](./data-model.md) §1–§4 to `src/db/schema.ts`, then run `npm run db:generate`, read the generated filename off the generator rather than assuming one — `0000` and `0001` are R1's and R2, R3 or R4 may have added their own — inspect it for `collate "C"`, each named CHECK and `ON DELETE CASCADE` on all three child tables, and commit the migration with its snapshot
- [X] T010 [P] Write failing tests for the write boundary in `src/features/projects/server/authorization.test.ts` — `isMember` admits every admin without a query, admits a member by row, refuses a non-member, and the two guards refuse an unauthenticated caller before they refuse an unauthorized one
- [X] T011 Implement `src/features/projects/server/authorization.ts` with `isMember` and the admin and member guards, reusing R1's `requireActor` and `assertSameOrigin`
- [X] T012 [P] Write failing tests for the two shared reads in `src/features/projects/server/queries.test.ts` — `hasProjectMemberRow` and `loadProjectByKey`, the latter returning `null` for a key that matches nothing
- [X] T013 Implement `hasProjectMemberRow` and `loadProjectByKey` in `src/features/projects/server/queries.ts` with `import "server-only"` at the top

**Checkpoint**: the four tables exist and refuse every violating write; the predicate and the two shared reads are green.

---

## Phase 3: User Story 1 — An admin creates the container work lives in (P1) 🎯 MVP

**Goal**: an admin submits a name at `/projects/new` and one project comes into being carrying its
five columns, its issue counter and its chosen roster, written in one transaction.

**Independent test**: sign in as an admin against a database holding accounts but no projects, open
`/projects/new`, submit a name alone, and confirm one project exists with a derived key, `active`
status, five columns in their fixed order and kinds, and its own issue counter.

- [X] T014 [P] [US1] Write failing tests for key derivation in `src/features/projects/key.test.ts` — `Website Redesign` → `WR`, `One Team Design Ops` → `OTDO`, `3D Redesign` → empty, `Re-Design` → `R`, more than eight words truncated to eight characters, punctuation-only → empty, and `isValidProjectKey` against `^[A-Z][A-Z0-9]{0,7}$`
- [X] T015 [US1] Implement `deriveProjectKey` and `isValidProjectKey` in `src/features/projects/key.ts` as pure functions with no DOM
- [X] T016 [P] [US1] Write failing tests for the seeded columns in `src/features/projects/seed-columns.test.ts` — five rows in the order Backlog, Todo, In Progress, Done, Canceled with kinds `open`, `open`, `open`, `done`, `canceled`, and `sort_order` values that ascend under `COLLATE "C"`
- [X] T017 [US1] Implement `src/features/projects/seed-columns.ts` as the five constant rows
- [X] T018 [US1] Write failing tests for `findProjectKeyHolder` and `listAddableUsers` in `src/features/projects/server/queries.test.ts` — the holder's key and name or `null`, and a picker list that excludes deactivated accounts, excludes the named user, excludes existing members, and returns `publicUser` rows ordered by `lower(last_name), lower(first_name)`
- [X] T019 [US1] Implement `findProjectKeyHolder` and `listAddableUsers` in `src/features/projects/server/queries.ts`
- [X] T020 [US1] Write failing persistence tests for the create transaction in `src/features/projects/server/create-project.test.ts` against real PostgreSQL — 1 project + 5 columns + 1 counter seeded at `0` + *n* memberships in one transaction, the creating admin never among them, a `23505` on `project_key_unique` returning the holder rather than a suffix, a target date before the start refused by the table CHECK, a member id chosen before the account was deactivated still written as a membership row because deactivation removes nothing, and two concurrent creations of one key where exactly one succeeds
- [X] T021 [US1] Implement `src/features/projects/server/create-project.ts` as the single transaction, mapping `23505` on the key constraint to a re-read of the holder
- [X] T022 [US1] Write failing tests for the two entry points in `src/features/projects/actions.test.ts` — `createProject` and `checkProjectKeyAvailable` each assert the origin, resolve the actor, require `isAdmin`, validate their input before touching the database, and return a typed result carrying no SQL, no constraint name and no row
- [X] T023 [US1] Implement `createProject` and `checkProjectKeyAvailable` in `src/features/projects/actions.ts` with top-level `"use server"`
- [X] T024 [P] [US1] Write failing jsdom tests for `src/features/projects/components/project-key-field.test.tsx` — the key follows the name, stops following once edited by hand, uppercases as typed, leaves the field empty and required when the derived value fails the pattern, and renders a clash as an inline error naming the holder with no suffix applied
- [X] T025 [US1] Implement `src/features/projects/components/project-key-field.tsx` as a Client Component calling `checkProjectKeyAvailable`
- [X] T026 [P] [US1] Write failing jsdom tests for `src/features/projects/components/member-picker-field.test.tsx` — the picker offers existing accounts, excludes deactivated ones, excludes the creating admin, offers no invitation path, and each chosen person becomes a removable chip
- [X] T027 [US1] Implement `src/features/projects/components/member-picker-field.tsx` from React Aria `ComboBox` and `TagGroup`
- [X] T028 [P] [US1] Write failing jsdom tests for `src/features/projects/components/date-range-fields.test.tsx` — both fields optional and independent, and a target before the start rendering an inline error on the target field
- [X] T029 [US1] Implement `src/features/projects/components/date-range-fields.tsx` from two React Aria `DatePicker`s, using `CalendarDate` from `@internationalized/date` (requires T002)
- [X] T030 [US1] Write failing jsdom tests for `src/features/projects/components/create-project-form.test.tsx` — the name field first in the tab order and focused on mount and its value trimmed before submission (`FR-024`), the description field growing with its content to a maximum height then scrolling within itself and offering no rendered preview (`FR-027`), no status control and no column control anywhere on the form (`FR-031`), validation per field on blur, Create staying enabled and reporting what is missing inline, in-flight state on the control, no optimistic navigation, and Cancel writing nothing
- [X] T031 [US1] Implement `src/features/projects/components/create-project-form.tsx` as a Client Component over `useActionState`, navigating to the new project's board route on success and returning to the referrer or Home on Cancel
- [X] T032 [US1] Implement the admin guard and the page at `src/app/(app)/projects/new/page.tsx`, rendering Forbidden for a signed-in non-admin and letting R2's interrupt redirect an unauthenticated caller to `/signin`

**Checkpoint**: US1 is independently deliverable — a project can be created and nothing else needs to exist.

---

## Phase 4: User Story 2 — Anyone reads a project's record, and its members change it (P2)

**Goal**: every signed-in user opens `/projects/:projectKey/details` and reads the whole record; a
member edits it in place; a non-member sees the same controls disabled with their reasons.

**Independent test**: with one project and two accounts — one a member, one not — open the details
route as each. Confirm both read the whole record; confirm the member's edits save, revert on Escape
and roll back with a message when the server refuses; confirm the non-member's controls are disabled
with a reason and that the server refuses their write independently of the control.

- [X] T033 [P] [US2] Write failing tests for the markdown grammar in `src/features/projects/markdown/parse.test.ts` — the four blocks, the four inlines, inline code suppressing every marker inside it, an unclosed marker rendering as text, ordinals not honoured, no nesting, and every construct outside the subset falling through to its own literal text
- [X] T034 [US2] Implement `src/features/projects/markdown/parse.ts` as a line classifier and an inline scanner, with no DOM and no React
- [X] T035 [US2] Write failing jsdom tests for `src/features/projects/markdown/render.test.tsx` — the container's `textContent` equals the source for an HTML input and `querySelector("script")` is `null`, and a link renders only for `http`, `https` and `mailto`, with `JaVaScRiPt:`, leading whitespace, `java\nscript:`, a relative href and a protocol-relative `//host/path` each rendering as the link's text
- [X] T036 [US2] Implement `src/features/projects/markdown/render.tsx` returning React nodes, checking schemes with the `URL` constructor against `protocol`, and emitting `rel="noopener noreferrer"` on every rendered link
- [X] T037 [US2] Write failing tests for `loadProjectDetails` in `src/features/projects/server/queries.test.ts` — the record, columns by `sort_order`, the roster by `lower(last_name), lower(first_name)` reading `project_member` rows only, and the cascade count as columns plus memberships
- [X] T038 [US2] Implement `loadProjectDetails` and the `ProjectDetails` DTO in `src/features/projects/server/queries.ts`, computing `canEditRecord` and `canAdminister` once per request
- [X] T039 [US2] Write failing persistence tests for `src/features/projects/server/update-project.test.ts` — the four-field partial accepts name, description and both dates, rejects `key` and `status` at runtime, maps `23514` on `project_dates_ordered` to a field-named refusal, refuses a non-member through the `isMember` check the writing transaction itself evaluates, holds that guarantee when a membership is removed concurrently with an update so the write is either seen by the check or ordered after it and never lands between them (`FR-014`), still accepts a member's edit to an **archived** project because archiving is a lifecycle state and not a lock, and two concurrent writes to one field resolve last-write-wins with neither refused
- [X] T040 [US2] Implement `src/features/projects/server/update-project.ts`, writing `updated_at` through `touched()`
- [X] T041 [US2] Write failing tests for the `updateProject` entry point in `src/features/projects/actions.test.ts` — origin, actor, the four-key partial validated before anything is delegated, a project the module did not find surfacing as `notFound()` rather than `forbidden()`, and a typed result carrying no SQL, no constraint name and no row
- [X] T042 [US2] Implement `updateProject` in `src/features/projects/actions.ts`
- [X] T043 [P] [US2] Write failing jsdom tests for `src/features/projects/components/editable-field.test.tsx` — the value is a control with an accessible name and a visible focus ring, opens by keyboard alone, Escape reverts, blur and ⌘-enter and Ctrl-enter each save exactly one call, an unchanged blur makes no call, focus returns to the control on close, at most one field is open at a time, and a refused write rolls back with a message
- [X] T044 [US2] Implement `src/features/projects/components/editable-field.tsx` as the in-place convention every later entry reuses
- [X] T045 [P] [US2] Write failing jsdom tests for `src/features/projects/components/description-view.test.tsx` — rendered markdown on read, raw source in the field while editing, and an empty description rendering a placeholder that opens the editor
- [X] T046 [US2] Implement `src/features/projects/components/description-view.tsx`
- [X] T047 [P] [US2] Write failing jsdom tests for `src/features/projects/components/columns-section.test.tsx` — five rows in board order with name, kind and an issue count of `0`, and no control that adds, renames, reorders or deletes
- [X] T048 [US2] Implement `src/features/projects/components/columns-section.tsx` as a read-only list
- [X] T049 [P] [US2] Write failing jsdom tests for the roster in `src/features/projects/components/members-section.test.tsx` — it lists membership rows only, so an admin never added explicitly is absent, and a deactivated member's row is still present
- [X] T050 [US2] Implement the read-only roster in `src/features/projects/components/members-section.tsx`
- [X] T051 [US2] Write failing jsdom tests for `src/features/projects/components/project-details-screen.test.tsx` — the whole record renders for any signed-in user, the key renders as a shown value stating it is immutable, every record control is disabled with an inline reason naming the project for a non-member, and a re-render with `canEditRecord` falling from `true` to `false` disables those same controls with that reason while removing no rendered content, which is `FR-020`'s next render
- [X] T052 [US2] Implement the record and columns sections of `src/features/projects/components/project-details-screen.tsx` as a synchronous component
- [X] T053 [US2] Implement the page at `src/app/(app)/projects/[projectKey]/details/page.tsx`, awaiting `params`, calling `loadProjectDetails` and rendering "This doesn't exist" for a key that matches nothing

**Checkpoint**: the record screen reads and edits; US3 and US4 add their own sections to the same screen.

---

## Phase 5: User Story 3 — An admin decides who may write in a project (P3)

**Goal**: an admin adds someone who already has an account and they can write on their next request;
removing them takes that write access and nothing else.

**Independent test**: with one project and one non-admin account holding no membership, confirm the
account cannot write. Add them from the roster and confirm they can write on their next request with
no sign-out. Remove them and confirm the write is refused again while every row they authored survives.

- [X] T054 [US3] Write failing persistence tests for `src/features/projects/server/membership.test.ts` — an add writes one row, a remove deletes one row and nothing else, removing the last roster row succeeds with no guardrail, an admin never added explicitly still passes `isMember`, and an admin added then removed still passes
- [X] T055 [US3] Implement `src/features/projects/server/membership.ts` with `addProjectMember` and `removeProjectMember` as one statement each
- [X] T056 [US3] Write failing tests for the two entry points in `src/features/projects/actions.test.ts` — origin, actor, `isAdmin`, the project derived from the stored row, and typed results
- [X] T057 [US3] Implement `addProjectMember` and `removeProjectMember` in `src/features/projects/actions.ts`
- [X] T058 [US3] Write failing jsdom tests for the roster controls in `src/features/projects/components/members-section.test.tsx` — add and remove offered to admins only and disabled with a reason for everyone else, the Add picker excluding deactivated accounts and existing members but **not** the acting admin, no invitation path, and a refused add returning the roster to its previous state with a message
- [X] T059 [US3] Add the add and remove controls to `src/features/projects/components/members-section.tsx`, applying optimistically

**Checkpoint**: the write boundary is complete and every later entry can read it.

---

## Phase 6: User Story 4 — An admin retires a project (P4)

**Goal**: an admin archives a project, which changes nothing else, and only then may delete it —
after a confirmation stating the size of what it destroys.

**Independent test**: with one project, flip its status both ways and confirm no other row changed.
Confirm Delete is refused and disabled while the project is active, offered once archived, states the
size of what it will remove, and leaves nothing behind when confirmed.

- [ ] T060 [US4] Write failing persistence tests for `src/features/projects/server/project-status.test.ts` — both transitions legal, and archiving or reopening changes no column, no membership and no counter row
- [ ] T061 [US4] Implement `src/features/projects/server/project-status.ts` as one statement writing `updated_at` through `touched()`
- [ ] T062 [US4] Write failing persistence tests for `src/features/projects/server/delete-project.test.ts` — an active project is refused, an archived one deletes with its columns, memberships and counter row in one transaction, a project archived and deleted concurrently is decided by the `SELECT … FOR UPDATE` rather than an earlier read, and the deleted key is immediately available to a new project
- [ ] T063 [US4] Implement `src/features/projects/server/delete-project.ts` with `SELECT … FOR UPDATE`, the archived check inside the transaction, and one `DELETE` that the database cascades
- [ ] T064 [US4] Write failing tests for the two entry points in `src/features/projects/actions.test.ts` — `setProjectStatus` and `deleteProject` each assert the origin, require `isAdmin`, and return the settled state
- [ ] T065 [US4] Implement `setProjectStatus` and `deleteProject` in `src/features/projects/actions.ts`
- [ ] T066 [P] [US4] Write failing jsdom tests for `src/features/projects/components/status-switch.test.tsx` — a two-state switch for admins applied optimistically, and the current state shown disabled with its reason for everyone else
- [ ] T067 [US4] Implement `src/features/projects/components/status-switch.tsx` from React Aria `Switch`
- [ ] T068 [P] [US4] Write failing jsdom tests for `src/features/projects/components/delete-project-control.test.tsx` — disabled with a reason on an active project, a confirmation stating the cascade count before anything is written, Escape and Cancel discarding, and the count treated as advisory
- [ ] T069 [US4] Implement `src/features/projects/components/delete-project-control.tsx` from React Aria `Dialog`, navigating to Home on success
- [ ] T070 [US4] Write failing jsdom tests in `src/features/projects/components/project-details-screen.test.tsx` for the status and delete sections rendering for every user with the right affordances
- [ ] T071 [US4] Add the status and delete sections to `src/features/projects/components/project-details-screen.tsx`

**Checkpoint**: the full lifecycle works; only the way in is missing.

---

## Phase 7: User Story 5 — Projects are findable and every project screen knows where it is (P5)

**Goal**: the sidebar lists every project identically for everyone, and every project-scoped header
carries the name and the Board/Details tabs.

**Independent test**: with several projects of both statuses and mixed-case names, confirm the
sidebar's order is identical for an admin, a member and a non-member, and that archived projects
render after active ones and dimmed. Open project details and confirm the header carries the name
and both tabs.

- [ ] T072 [US5] Write failing tests for `listProjectsForSidebar` in `src/features/projects/server/queries.test.ts` — `ORDER BY (status = 'archived'), lower(name)`, the project key breaking a tie between two identical names, and the same rows for every actor whatever their role or membership
- [ ] T073 [US5] Implement `listProjectsForSidebar` in `src/features/projects/server/queries.ts` returning `ProjectListEntry` rows
- [ ] T074 [P] [US5] Write failing jsdom tests for `src/features/shell/components/project-list-region.test.tsx` — alphabetical regardless of case, active before archived with archived dimmed, each entry linking to `/projects/:projectKey`, and a long name truncated visually with the whole name still available to assistive technology
- [ ] T075 [US5] Extend `src/features/shell/components/project-list-region.tsx` to render the entries, leaving R2's existing empty line untouched
- [ ] T076 [US5] Wire `listProjectsForSidebar` into `src/app/(app)/layout.tsx`, which already resolves the actor for the shell
- [ ] T077 [P] [US5] Write failing jsdom tests for `src/features/projects/components/project-header.test.tsx` — the name truncated without displacing the tabs, and the Board and Details tabs with Details marked current on this screen
- [ ] T078 [US5] Implement `src/features/projects/components/project-header.tsx`, composing R2's `ScreenHeader` unchanged with `name` and the tab pair as `context`, from React Aria `Tabs` rendered as links

**Checkpoint**: every acceptance scenario in the specification is reachable through the product.

---

## Phase 8: Polish & cross-cutting concerns

- [ ] T079 Run `npm run verify` from the repository root and confirm `style-check`, `type-check`, `test` and `build` all pass with no failing or skipped tests (gates 5 and 8)
- [ ] T080 Walk all twelve scenarios in [`quickstart.md`](./quickstart.md) against a running dev server and a seeded database, recording any that diverge from the specification
- [ ] T081 Sweep `git diff main...HEAD` for comments, commented-out code, unused imports and unreachable paths, and confirm every changed line traces to a requirement this feature states (gates 6 and 7)
- [ ] T082 Confirm the migration T009 generated under `drizzle/` and its snapshot in `drizzle/meta/` are both committed and that no migration was edited after generation
- [ ] T083 Check each of FR-001 to FR-056 and SC-001 to SC-019 in [`spec.md`](./spec.md) against a test or a walkthrough that exercises it, and record any requirement with no evidence behind it

---

## Dependencies

```text
Setup (T001–T003)
   └─> Foundational (T004–T013)          ← blocks every story
          ├─> US1  (T014–T032)   P1  MVP
          ├─> US2  (T033–T053)   P2
          ├─> US3  (T054–T059)   P3   — needs US2's members-section file
          ├─> US4  (T060–T071)   P4   — needs US2's details-screen file
          └─> US5  (T072–T078)   P5

Polish (T079–T083)                       ← after all five stories, not after US5 alone
```

**Story independence.** US1 and US5 are fully independent of every other story once Foundational is
done. US3 and US4 each *add* to a file US2 creates — `members-section.tsx` and
`project-details-screen.tsx` — so they are independently *testable* but not independently *startable*:
build US2 first, or stub those two files.

**Cross-story file contention** — these files are touched by more than one phase and their tasks are
therefore never `[P]` with each other:

| File | Phases |
| --- | --- |
| `src/features/projects/server/queries.ts` | Foundational, US1, US2, US5 |
| `src/features/projects/actions.ts` | US1, US2, US3, US4 |
| `src/features/projects/components/members-section.tsx` | US2, US3 |
| `src/features/projects/components/project-details-screen.tsx` | US2, US4 |
| `src/db/constraints.test.ts` | T004–T007 |

## Parallel execution

**Why the second half of each group carries no `[P]`.** Only the test tasks are marked, because `[P]`
means *a different file and no dependency on an incomplete task*, and every implementation below
depends on its own Red step. Once that Red step is observed, the implementations named after each
"then" are different files and run together too — the marker records the state at the start of the
phase, not the only moment parallelism is available.

Within Foundational — two independent test files:

- T010 and T012 together, then T011 and T013 together

Within US1 — three component test files, once T023 exists to stub against:

- T024, T026 and T028 together, then T025, T027 and T029 together

Within US2 — four component test files, once T038 and T042 exist:

- T043, T045, T047 and T049 together, then their implementations

Within US4 — two component test files:

- T066 and T068 together, then T067 and T069

Within US5 — two independent component test files:

- T074 and T077 together, then T075 and T078

## Implementation strategy

**MVP is Phase 1 + Phase 2 + US1** — T001 to T032. That is a working create-project flow writing a
complete, correct project into the database. Nothing in R6 through R12 has anywhere to live until it
exists, which is why it is P1.

**Then, in order**: US2 makes the project maintainable for the rest of its life and establishes the
in-place editing and optimistic-write conventions R6, R7 and R10 all reuse. US3 completes the write
boundary every later mutator reads. US4 adds the only lifecycle act a project has. US5 makes all of it
reachable without typing a URL.

**Deliver each phase whole.** Every story's checkpoint is a state the product can sit in — a
half-finished phase leaves a screen with controls that neither work nor explain themselves, which is
the one outcome `OT-UX-002` exists to prevent.
