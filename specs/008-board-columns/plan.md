# Implementation Plan: Board columns

**Branch**: `sdd/board-columns` | **Date**: 2026-09-04 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/008-board-columns/spec.md`](./spec.md) and roadmap entry
**R9**, whose scope boundary this plan does not widen.

## Summary

R9 makes the Columns section on `/projects/:projectKey/details` — which entry R5 ships as a read-only
list of five seeded rows — editable by an admin, and by nobody else. Four Server Actions:
`createColumn` (a name, kind `open` as a literal, appended last), `updateColumn` (a rename and
nothing else), `moveColumn` (one drag, one write, one activity row) and `deleteColumn` (four refusals
in a fixed precedence). Each writes one `column_*` row through the activity writer entry R7 already
delivers, in the same transaction as the change it describes. **No issue is ever moved, changed or
destroyed by any path here** (§4, SC-002).

**Three decisions carry the design, and all three came from reading the code rather than the spec.**

1. **Ordering is a fractional index string, not an integer position.** `src/db/schema.ts` declares
   `sortOrder` as a `customType` rendering `text collate "C"`; `seed-columns.ts` seeds `a0`…`a4`; and
   `create-issue.ts` already imports `generateKeyBetween` from `fractional-indexing` — which is on
   `AGENTS.md`'s approved table. `moveColumn` writes `generateKeyBetween(previous, next)` on the moved
   row only. There is no integer position and none is added. The spec's
   `ProjectColumnRow.position: number` is a derived display ordinal, not a stored value.
   ([`research.md`](./research.md) A-1.)

2. **`deleteColumn`'s four refusals are evaluated against `FOR UPDATE`-locked rows in one
   transaction, and precedence is applied after every check has run.** The lock closes the two races
   the spec's Edge Cases name: PostgreSQL takes a `FOR KEY SHARE` lock on a `board_column` row for
   any `issue` write referencing it through R6's composite FK, so `FOR UPDATE` on the project's whole
   column set makes an issue moved in mid-delete impossible to miss, and makes two concurrent deletes
   of the last two `done`-kind columns serialize. Computing all four booleans and *then* selecting one
   reason by the fixed list is what FR-038 means by "chosen by precedence rather than by evaluation
   order" — and it lets the disabled Delete control show the same reason the mutator would give, from
   the same function. (B-1, B-2.)

3. **Name uniqueness is the database index's job, never a pre-flight read.** FR-051 is explicit, and
   this is a deliberate departure from `src/features/labels/server/create-label.ts`, which pre-reads.
   The mutators attempt the write and map `23505` on `board_column_project_id_name_lower_idx` — matched
   by constraint name, because `board_column` carries a second unique constraint that must not be
   mistaken for a name collision. The holder's stored name is read afterwards, on the refusal path,
   for the message only. (B-3.)

**No dependency is added, and none is needed.** The reorder is `useDragAndDrop` from
`react-aria-components@1.20.0` — verified present on the subpath entries this codebase already imports
from — which supplies the keyboard drag FR-031 and SC-013 require. A drag-and-drop library is absent
from the approved table and Principle IV refuses it. (E-2.)

Full reasoning in [`research.md`](./research.md) — 35 decisions across six groups. The four mutators
in [`contracts/mutators.md`](./contracts/mutators.md); the one edited section in
[`contracts/screens.md`](./contracts/screens.md).

## Technical Context

**Precondition — R5, R6 and R7 are implemented on this branch, not merely planned.** Every function,
table, guard and component this feature builds on was read, not assumed:

- **R5** — `board_column` with its `UNIQUE (project_id, lower(name))` index, `seed-columns.ts`,
  `isAdmin` / `isMember` / `requireAdmin` in `server/authorization.ts`, `loadProjectDetails`,
  `ProjectColumnRow`, the read-only `columns-section.tsx` this feature makes editable, `EditableField`,
  `delete-project-control.tsx`'s confirmation shape, and `projects/actions.ts`'s action preamble.
- **R6** — `issue`, its composite FK `issue_project_id_column_id_fk`, and `create-issue.ts`'s
  `generateKeyBetween` append.
- **R7** — the `activity` table, its `activity_type_valid` `CHECK`, `writeActivity(tx, …)`,
  `truncateActivityValue`, `activity-row.tsx` and the feed.

**Consequently there is no blocked requirement and no placeholder import** — the departure from R8's
situation, where R7 did not yet exist in code.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over `postgres` 3.4.9, `fractional-indexing`
4.0.0, `uuidv7`, Tailwind CSS v4 configured in CSS, Biome 2.4.2.

**Dependencies this feature installs**: **none.** Every capability it needs — `GridList`,
`useDragAndDrop`, `DropIndicator`, `Dialog`, `Modal`, `TextField`, `Button`, and the fractional
ordering index — is already approved and already in `package.json`.

**Dependencies this feature deliberately refuses**: any drag-and-drop library (`@dnd-kit`,
`react-beautiful-dnd` and every equivalent). Absent from `AGENTS.md`'s table, so Principle IV bars
them without a recorded amendment — and `useDragAndDrop` covers FR-031 including its keyboard path, so
no amendment is warranted. The spec agrees: *Dependency approval this feature triggers*: none.

**Configuration this feature changes**: none. `next.config.ts`, `vitest.config.mts`, `tsconfig.json`,
`drizzle.config.ts` and `biome.json` are untouched. `src/db/test-database.ts` needs no edit either —
`board_column`, `issue` and `activity` are already in `TRUNCATED_TABLES`.

**Storage**: PostgreSQL 18 via Drizzle. **No table and no column is added.** One `CHECK` is widened by
exactly four values — `activity_type_valid` goes from the seven values `drizzle/0006_lying_sugar_man.sql`
created to eleven, R8 having landed without widening it — as a **new** migration (`drizzle/0007_*.sql`),
generated with `npm run db:generate` and its SQL inspected before commit; `drizzle/0006_lying_sugar_man.sql`
itself is not edited. **No index is added** — the count query's `project_id` filter is already served by
`issue_project_id_number_unique`'s prefix.

**Testing**: Vitest 4.1.11 in the two projects the repo already configures — `server` (node,
`fileParallelism: false`, migrating `TEST_DATABASE_URL` through `src/db/test-setup.ts`) for the schema
change, the four mutators, the precedence function and the two concurrency tests; `ui` (jsdom,
`@testing-library/react`) for every component. Persistence, locking and constraint tests run against a
real PostgreSQL instance on a separate database. `@react-aria/test-utils` is not installed and is not
added; keyboard behaviour is verified with explicit key events.

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification and none invented. The spec says so in its own
*Out of Scope*. What this feature does fix instead: a rename and a reorder show their result without
waiting for the server, and a delete never runs against a stale emptiness read.

**Constraints**: admin-only for all four writes, readable by every signed-in user, membership never
consulted (FR-007, FR-009) · the row is resolved **before** the role, so a missing row is
"This doesn't exist" and never a permission refusal (FR-010) · all four mutators available on an
archived project (third Clarification) · `kind` fixed at creation and accepted by no mutator but the
create, where it is a literal (`OT-INV-015`) · no colour, no swatch, no `column_recolored` (§7
*Palette*) · uniqueness enforced by the database, mapped to an inline error naming the existing column
(`OT-UX-012`) · four refusals in one locked transaction, one reason by fixed precedence (FR-038,
FR-050) · every write and its activity row in one transaction (FR-048) · no SQL, constraint name or
stack trace reaches a client (FR-052) · no dependency outside `AGENTS.md`'s table (IV) · no seam built
for R10 (I, III, VI).

**Scale/Scope**: one installation, one team under twenty people; a project holds five to a dozen
columns. 52 functional requirements, 5 user stories, 38 acceptance scenarios, 13 edge cases, 15
success criteria. 0 new routes, 1 edited section on 1 existing screen, 4 Server Actions, 4 server
mutator modules, 2 shared server helpers, ~5 components (3 new, 2 edited), 3 R7 files widened, 1
migration.

**Unknowns**: **none outstanding.** Every dependency is implemented and was read directly. No task in
`tasks.md` will need to be marked blocked.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated against the completed Phase 1 design. Both land on
the same row — Phase 1 introduced no principle question Phase 0 had not already settled. **Result:
pass**, with two items in Complexity Tracking.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0), which this plan does not amend.

| | Principle | Assessment |
| --- | --- | --- |
| **I** | Component-Driven Architecture | Two abstractions are extracted, each at a genuine **second** call site existing on day one: `parseColumnName` (`createColumn` + `updateColumn`, D-4) and `countIssuesByColumn` (`loadProjectDetails` + `deleteColumn`, E-8 — which FR-015 *requires* be one read, not two). One is reused rather than rebuilt: `EditableField`, R5's, gaining one result variant instead of a second in-place editor (E-3). Nothing else is extracted — the four mutators stay four modules, no shared "column service" sits between them and the database, and `src/components/ui` is still not created. `columns-section.tsx` splits into a section, a row, an add form and a delete dialog because it now owns four unrelated concerns; the split stops there. |
| **II** | Validated Input Boundaries | Four Server Actions, each a public server entry point. Each re-derives its project from a stored row and never from an argument (FR-008); each re-checks `isAdmin` regardless of what the client rendered (FR-011, FR-040). `moveColumn` takes a neighbour **id** the server verifies against locked rows, never a client-computed index or `sort_order` string (B-4). Names are trimmed then bounded at 200 and **refused, never truncated** — with `board_column_name_length` as the backstop. Uniqueness is the database's (B-3). |
| **III** | Straightforward Over Clever | `deleteColumn` is one locked read, one count, four booleans and a `DELETE`. The precedence is an ordered list, not a strategy table. No rebalancing, retry loop or collision recovery is written for `generateKeyBetween`, because distinct neighbours inside a lock cannot produce a collision (A-3) — machinery for an unreachable state is exactly what this principle refuses. `updateColumn` takes a name, not a `changes` bag, because there is one field (B-6). |
| **IV** | Built-In Features Over Third-Party Libraries | **Zero new dependencies.** The reorder is `react-aria-components`' own `useDragAndDrop`, verified present in the installed 1.20.0; the ordering index is `fractional-indexing`, already used by `create-issue.ts`. A drag-and-drop library is explicitly refused rather than silently avoided. |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The three places a reader will want an explanation — why the lock is taken over the project's whole column set, why uniqueness has no pre-check, why the row is resolved before the role — are answered by [`research.md`](./research.md) B-1, B-3 and D-1 and by the contracts, not by annotation. `ColumnDeleteRefusal`'s four members name their own reasons. |
| **VI** | No Dead Code | `updateColumn` accepts no `kind`, `position`, `project` or colour — not even as ignored optional fields, which would be dead surface a reviewer must re-verify. `ProjectColumnRow` exposes no `sort_order`, because no client reads one. `deleteRefusal` is `null` for every non-admin viewer rather than computed and discarded. No `column_recolored` value is declared for an event no mutator writes (FR-042). |
| **VII** | Test-First (NON-NEGOTIABLE) | All 38 acceptance scenarios are carried by a Red step written before its implementation, sequenced in `tasks.md`. **The migration is not exempt**: the first Red step is a `server` test inserting an `activity` row of type `column_added` and observing it refused with `23514` against the un-widened `CHECK`, before `src/db/schema.ts` is touched (F-3). The four invariants, the two races and the uniqueness rule are tested by attempting the violating or racing write against the real database and asserting the refusal or the settle — never against a mock, because locks and constraints are the enforcement (F-1, F-2). |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. Includes the schema change — F-3 fixes what its Red step is and why a type error would not count |
| 2 | Minimal implementation, then refactor green | Scoped per task. No mutator does more than its entry in [`contracts/mutators.md`](./contracts/mutators.md) |
| 3 | Server-side validation at every touched boundary | The Principle II row above. Four actions; origin, actor, row, role, then input — in that order, on every one |
| 4 | No unapproved dependency | None installed. Nothing to record. `package.json` is unchanged |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | The Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | Each path in Project Structure below names the requirement putting it there. The three reach-backs into R5's and R7's trees are named in Complexity Tracking, not left for the diff |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not itself evidence of VII — the commit order is |

## Project Structure

### Documentation (this feature)

```text
specs/008-board-columns/
├── spec.md                     the feature specification
├── plan.md                     this file
├── research.md                 Phase 0 — 35 decisions, six groups
├── data-model.md               Phase 1 — no table added, one CHECK widened, DTOs, invariants
├── quickstart.md               Phase 1 — 10 walkthroughs, and what a browser cannot show
├── contracts/
│   ├── mutators.md             createColumn, updateColumn, moveColumn, deleteColumn
│   └── screens.md              the one edited section, its component tree, its roles
├── checklists/                 spec-quality gate
└── tasks.md                    Phase 2 output (/speckit-tasks — NOT created by this command)
```

### Source code (repository root)

Every path is created or edited by this feature, and each names why it exists.

```text
src/
├── db/
│   └── schema.ts                                    EDIT — activity_type_valid widened by
│                                                      exactly four column_* values      FR-042
├── app/(app)/projects/[projectKey]/details/
│   └── page.tsx                                     EDIT — pass the four actions on the
│                                                      existing admin branch             FR-013
└── features/
    ├── projects/
    │   ├── column-actions.ts                        NEW — "use server"; the four entry points,
    │   │                                              each with the shared preamble  FR-007…FR-012
    │   ├── components/
    │   │   ├── columns-section.tsx                  EDIT — one GridList for every role;
    │   │   │                                          dragAndDropHooks for an admin only
    │   │   │                                                       FR-013…FR-018, FR-031, FR-033
    │   │   ├── column-row.tsx                       NEW — name, kind, count, Delete   FR-014, FR-024
    │   │   ├── add-column-form.tsx                  NEW — a name field and nothing else
    │   │   │                                                              FR-019…FR-021
    │   │   ├── delete-column-dialog.tsx             NEW — confirm once, naming the column   FR-039
    │   │   ├── editable-field.tsx                   EDIT — one result variant, {status:"conflict"},
    │   │   │                                          rendered inline instead of toasted
    │   │   │                                                              FR-025, FR-027
    │   │   └── project-details-screen.tsx           EDIT — the four actions onto
    │   │                                              ProjectDetailsScreenAdmin              FR-013
    │   └── server/
    │       ├── create-column.ts                                          FR-019…FR-022
    │       ├── update-column.ts                                          FR-023…FR-027
    │       ├── move-column.ts                                            FR-028…FR-033
    │       ├── delete-column.ts                                          FR-034…FR-041, FR-050
    │       ├── column-delete-refusal.ts             NEW — the four reasons and the pure
    │       │                                          precedence function                    FR-038
    │       ├── column-name.ts                       NEW — parseColumnName; two callers  FR-004
    │       ├── column-queries.ts                    NEW — countIssuesByColumn; two callers
    │       │                                                                     FR-015, FR-034
    │       └── queries.ts                           EDIT — live issueCount, deleteRefusal,
    │                                                  ORDER BY (sort_order, id)
    │                                                                     FR-014, FR-015, FR-033
    └── activity/                                    EDIT (R7's) — three touches, all forced:
        ├── server/write-activity.ts                   four values into ActivityType      FR-042
        ├── server/feed-queries.ts                     four values into its own union     FR-042
        └── components/activity-row.tsx                four cases in buildSentence —
                                                       the switch is exhaustive           FR-045, -046

drizzle/0007_*.sql + meta                            NEW — generated, inspected, committed  FR-042
```

Untouched and named so: `package.json`, `next.config.ts`, `vitest.config.mts`, `tsconfig.json`,
`drizzle.config.ts`, `biome.json`, `src/db/test-database.ts` (the three tables are already truncated),
`src/db/touched.ts`, `src/db/unique-violation.ts`, `src/features/projects/actions.ts`,
`src/features/projects/seed-columns.ts` (no reseed, no backfill), `src/features/projects/server/authorization.ts`,
`src/features/issues/**` but `server/issue-queries.ts`, whose `listProjectColumns` gains the `id`
tie-break FR-033 fixes on every query that reads columns, `src/features/labels/**`, every file under
`src/app/(app)/projects/[projectKey]/`
but the details page, `src/components/ui/` (still not created), and the whole of R7's feed —
`feed.tsx`, `feed-row.tsx`, `collapse.ts`, `feed-filter-toggle.tsx`, `feed-pagination`.

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. `src/app` gains no domain module — the
details page passes actions and nothing more. All behaviour lives in `src/features/projects/`, with
everything touching the database under its `server/` directory and carrying `server-only` transitively
through `@/db`.

Two structural calls worth stating, because a reviewer could reasonably expect the other answer:

- **The four mutators live in `src/features/projects/`, not a new `src/features/columns/`.** The
  section, its DTO, its query, its screen, its guard and `seed-columns.ts` are all already there. A
  separate feature would split one screen's behaviour across two directories and force
  `loadProjectDetails` to be split with it, for a boundary the product does not have. R10 will read
  columns from where this puts them. (E-7.)
- **A separate `column-actions.ts` rather than appending to `actions.ts`.** `AGENTS.md` requires a
  dedicated module carrying top-level `"use server"`, not a single one; `actions.ts` is already 240
  lines with six actions, and four more would push it past the point where its intent is obvious (I).
  No barrel file mixes server and client exports.

## Complexity Tracking

Two places this design reaches into work another entry owns. Each is recorded so a reviewer meets it
here rather than discovering it in the diff (gate 7).

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **Three files R7 owns are edited** — `write-activity.ts` and `feed-queries.ts` gain four `ActivityType` values, `activity-row.tsx` gains four `buildSentence` cases | FR-042 and FR-043: R7 establishes the single writer and this feature writes its four events through it rather than assembling an insert of its own — the roadmap's R7 row commits R9 to exactly this, and R7's own FR-004 names R9 as one of the entries that widens the `CHECK`. The `activity-row.tsx` edit is not optional scope: its `switch` over `Exclude<ActivityType, "comment">` has no `default`, so widening the union without adding the cases fails `npm run type-check`. | *Write to the `activity` table directly from the column mutators.* A second insert implementation of the same one-row-per-change contract R5's, R6's and R7's mutators all share — the drift Principle I extracts against, and contrary to FR-043. *Declare the values in R7 instead.* R7 has shipped; `AGENTS.md` forbids editing a migration that may have run, and R7's FR-004 already assigns the widening here. *Add a `default` branch to `buildSentence` so the union can widen alone.* A silent fallback for a row type nobody wrote a sentence for — a rendering bug the type system was catching. Note the pre-existing `ActivityType` duplication between the two R7 server modules is **widened, not refactored away** (gate 7). |
| **`EditableField`, R5's component, gains a fourth `EditableFieldSaveResult` variant** — `{ status: "conflict"; message: string }`, rendered inline with `role="alert"` instead of raising a toast, still rolling back | FR-024 asks for precisely the gesture `EditableField` already implements and has tests for — activate in place, Escape reverts, blur or ⌘-enter saves, Ctrl-enter as the non-⌘ binding, focus returns on close, an unchanged blur makes no call. What it lacks is FR-025's and `OT-UX-012`'s **inline** error naming the existing column; its only failure path is `showToast`. One variant is the minimal change; R5's four callers never return it and are unaffected. | *A second in-place-editing component for the column name.* Duplicates a solved component and every edge case it already handles — what Principle I exists to prevent. *Report the collision as a toast.* Fails FR-025's "inline error" and `OT-UX-012` outright. *Have the row swallow the error and report it itself.* The optimistic value would not roll back, failing FR-027. |

**Not recorded as complexity, because it is this feature's own scope**: `columns-section.test.tsx`
changes with the component it tests. R5's version asserts `getAllByRole("row").slice(1)` against a
`<table>` with a `<thead>`; a `GridList` has no header row. Its second case — "offers no control that
adds, renames, reorders or deletes" — survives verbatim as the non-admin case and gains an admin
counterpart. FR-013 and FR-014 put the change there.

## Explicitly out of scope

Named so no task claims them: the board (`/projects/:projectKey`) and every card, grouping control and
`moveIssue` — R10 · any path that moves an issue, which **does not exist and must not** (§4) · editing
a `kind`, which exists nowhere in the product (`OT-INV-015`) · a column colour, swatch or
`column_recolored` event (§7 *Palette*) · notifications, since no column event produces one of the
three types · Home's progress figure — R12 · reseeding or backfilling columns on existing projects ·
the feed component itself, its toggle, its collapsing and its pagination — R7's, rendering these rows
unchanged.

**No row is added to `docs/ROADMAP.md` §6 *Status log* and no version number is bumped anywhere.**

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 35 decisions; **no unknown outstanding**, R5/R6/R7 read directly from the tree |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — **pass**, two items in Complexity Tracking |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — 77 tasks across eight phases, every task labelled Red, Green or Verification |
| Implementation | — | not started |
