# Implementation Plan: Board — grouping, drag and ordering

**Branch**: `sdd/board-group-drag-order` | **Date**: 2026-09-05 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/009-board-grouping-drag-ordering/spec.md`](./spec.md)
and roadmap entry **R10**, whose scope boundary this plan does not widen.

## Summary

R10 renders the board at `/projects/:projectKey` — a route that answers "This doesn't exist" today —
and makes its cards draggable. **One new mutator**, `moveIssue`: one drop, one call, one issue row
written, plus one `field_changed` activity row when the drop crossed a lane. Three groupings —
Column, Assignee, Priority — over the same cards, the same gesture and the same composer, differing
only in what a lane means and therefore which field a cross-lane drop writes. An "Add a card"
composer at the foot of every lane, calling R6's `createIssue` unchanged.

**Four decisions carry the design, and all four came from reading the tree rather than the spec.**

1. **The schema does not change — at all.** `issue.sort_order` already exists as a `customType`
   rendering `text collate "C"`; `create-issue.ts` already writes `generateKeyBetween` into it; and
   `activity_type_valid` **already lists `field_changed`**. So unlike R9, which widened a `CHECK` by
   four values and shipped `drizzle/0007_*.sql`, this feature edits neither `src/db/schema.ts` nor
   `drizzle/`, adds no index, and needs no migration. ([`research.md`](./research.md) A-1, A-5, B-7.)

2. **`moveIssue` takes neighbour ids and a placement, derives the index inside its own write, and
   refuses with exactly four outcomes.** `{ issueId, grouping, laneId, targetIssueId, placement }` —
   no `sortOrder`, no `projectId`, not even as ignored optional fields. `targetIssueId: null` with
   `placement` gives the lane's head or foot, so four drop positions come out of two fields and R9's
   `parsePlacement` is reused rather than a three-valued enum declared. The refusals are
   `not_found`, `invalid_target`, `forbidden` and `no_index_available` and **no fifth** — R9's
   `moveColumn` carries an `invalid_input` that FR-041's enumeration does not admit here, so a
   malformed lane or placement folds into `invalid_target`. (B-1, B-2.)

3. **A tie is where `generateKeyBetween` throws, and that throw is the `no_index_available` refusal.**
   Distinct base-62 keys can always be split; the reachable throw is two neighbours holding *equal*
   indexes, which FR-024 declares legal and forbids repairing. It is caught and refused — nothing is
   renumbered, retried or nudged. **This is a deliberate inversion of R9**, whose research concluded
   no collision guard was warranted because a locked, uniquely-named column set cannot collide.
   Issues carry no such uniqueness and ties are explicitly legal, so the guard that would have been
   dead code there is a live requirement here. (A-3.)

4. **Only the moved row is locked, and the lane deliberately is not.** FR-057 and SC-007 require the
   last write to win outright with neither client rejected, so any lock-and-recheck over the lane is
   one step from the staleness refusal the specification forbids. `FOR UPDATE` on the single row
   being written — R6's `updateIssue` precedent — makes that row's read-modify-write atomic without
   rejecting anybody. The opposite of R9's `deleteColumn`, which locks a project's whole column set
   because it has four invariants to enforce; `moveIssue` has none. (B-5.)

**No dependency is added, and none is needed.** The drag is `useDragAndDrop` from
`react-aria-components@1.20.0` — verified present in the installed tree and already shipped by R9's
`columns-section.tsx`. FR-044 requires React Aria's own drag and drop by name, so this is not even a
judgement call; Principle IV would reach it unaided, since no drag-and-drop library is on
`AGENTS.md`'s approved table. What is new here is the **cross-lane** path: R9 needed only `onReorder`
within one list, while a board needs `onInsert` for a drop into another lane and `onRootDrop` for a
drop onto an empty one. Both were read from the installed typings, not assumed. (C-1, C-2.)

Full reasoning in [`research.md`](./research.md) — 36 decisions across six groups. The mutator in
[`contracts/mutators.md`](./contracts/mutators.md); the screen, its tree and its roles in
[`contracts/screens.md`](./contracts/screens.md).

## Technical Context

**Precondition — R1, R2, R5, R6, R7, R8 and R9 are implemented on this branch, not merely planned.**
Every function, table, guard and component this feature builds on was read, not assumed:

- **R6** — `issue` with its `sort_order`, `issue_project_id_column_id_fk`, `create-issue.ts`'s
  `generateKeyBetween` append under the `issue_counter` update, `update-issue.ts`'s refusal order and
  its three `field_changed` diffs, `issue-queries.ts`'s `listProjectColumns` / `listAssigneePool` /
  `resolveIssueWriteAccess`, `input.ts`'s `parsePriority` / `parseTitle`, `formatIssueKey`,
  `create-issue-form.tsx`, `new-issue-control.tsx`, `issue-rail.tsx`, `issue-skeletons.tsx`, and
  `actions.ts`'s `assertSameOrigin` → `requireActor` preamble.
- **R9** — `move-column.ts`'s whole shape: neighbour id plus placement, row-before-role, the
  vanished-versus-illegal probe, the early return on a no-op, and `column-input.ts`'s
  `parsePlacement` / `parseColumnId`. `columns-section.tsx`'s `useDragAndDrop` wiring, its explicit
  optimistic overlay and its per-refusal message map.
- **R7** — `activity`, its `activity_type_valid` CHECK (which **already** admits `field_changed`),
  `writeActivity(tx, …)`, `truncateActivityValue`, and `activity-row.tsx`'s `displayOrNone` with
  `NONE_LABEL = "None"`.
- **R5 / R2 / R1** — `isMember`, `loadProjectByKey`, `ProjectHeader`, `ScreenHeader` (whose
  `control` slot exists and is unused), `showToast`, `touched`, `db`, `requireActor`.

**Consequently there is no blocked requirement, no placeholder import and no NEEDS CLARIFICATION.**

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled
(`babel-plugin-react-compiler` 1.0.0), `react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over
`postgres` 3.4.9, `fractional-indexing` 4.0.0, `uuidv7`, Tailwind CSS v4 configured in CSS,
Biome 2.4.2.

**Dependencies this feature installs**: **none.** Every capability it needs — `GridList`,
`useDragAndDrop` with `onInsert` / `onRootDrop` / `getDropOperation` / `acceptedDragTypes`,
`DropIndicator`, `Select`, `TextField`, `Button`, the toast queue and the fractional index — is
already approved and already in `package.json`. The spec agrees: *Dependency approval this feature
triggers*: none.

**Dependencies this feature deliberately refuses**: every drag-and-drop library — `@dnd-kit`,
`react-beautiful-dnd`, `dnd-kit/sortable`, `sortablejs` and equivalents. Absent from `AGENTS.md`'s
table, so Principle IV bars them without a recorded amendment, and FR-044 names React Aria's own drag
and drop, so no amendment is warranted. Hand-building the drag is refused separately: `AGENTS.md`
permits that only "where React Aria ships no equivalent", and it ships one.

**Configuration this feature changes**: none. `next.config.ts`, `vitest.config.mts`, `tsconfig.json`,
`drizzle.config.ts`, `biome.json` and `package.json` are untouched. `src/db/test-database.ts` needs no
edit either — `issue`, `activity`, `board_column`, `issue_label`, `label`, `project_member`, `project`
and `user` are all already in `TRUNCATED_TABLES`.

**Storage**: PostgreSQL 18 via Drizzle. **No table, no column, no `CHECK`, no index and no
migration.** `src/db/schema.ts` is not edited and `drizzle/` gains no file. See
[`data-model.md`](./data-model.md) for the row-by-row verification.

**Testing**: Vitest 4.1.11 in the two projects the repo already configures — `server` (node,
`fileParallelism: false`, migrating `TEST_DATABASE_URL` through `src/db/test-setup.ts`) for the
mutator, its four refusals, the ordering census and the concurrency tests; `ui` (jsdom,
`@testing-library/react`) for every component. Persistence, refusal and concurrency tests run against
a real PostgreSQL instance on a separate database. `@react-aria/test-utils` is not installed and is
not added; keyboard behaviour is verified with explicit key events.

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only — no
responsive layout and no mobile breakpoint anywhere in this feature (FR-006).

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification and none invented; the spec's *Out of Scope*
says so. What the design does fix instead: a drop renders before the server answers, `loadBoard`
issues a fixed number of queries with no per-card or per-lane read, and a lane's count is computed
from the cards it renders rather than fetched.

**Constraints**: every signed-in user reads every board, membership is a **write** boundary and never
a visibility one (FR-002) · the row is resolved before the role, so a missing issue is "This doesn't
exist" and never a permission refusal (FR-034) · the project is derived server-side from the stored
issue row and no project field is accepted (FR-033, FR-036) · one drop → one call → one row; no
neighbour is ever written (FR-028) · ties are legal and **nothing** repairs, renumbers or rebalances
an index (FR-024) · no locking that could reject a stale caller; last write wins (FR-057) · a
cross-lane drop writes exactly one further field and one activity row, a reorder writes neither
(FR-029, FR-030, FR-061) · nothing reaches the project's feed (FR-062) · no enumeration widened
(FR-063) · grouping is page state, not in the URL and not on any record (FR-020) · disabled, never
hidden (FR-052) · no colour identifies a project, column or label (FR-011) · desktop only (FR-006) ·
no dependency outside `AGENTS.md`'s table (IV) · no seam left for R11's notification (I, III, VI).

**Scale/Scope**: one installation, one team under twenty people; a project holds a few hundred
issues across five to a dozen columns. 69 functional requirements, 6 user stories, 65 acceptance
scenarios, 14 edge cases, 16 success criteria. 0 new routes (1 placeholder route replaced), 1 new
screen, 1 new Server Action, 1 new server mutator, 1 new server query module, 1 pure model module,
~7 new components, 5 edited files, **0 migrations**.

**Unknowns**: **none outstanding.** No task in `tasks.md` will need to be marked blocked.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated against the completed Phase 1 design. Both land on
the same row — Phase 1 introduced no principle question Phase 0 had not already settled. **Result:
pass**, with two items in Complexity Tracking and one inherited discrepancy recorded below them.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0), which this plan does not amend.

| | Principle | Assessment |
| --- | --- | --- |
| **I** | Component-Driven Architecture | The board splits along its own concerns rather than into trivial files: a lane, a card, a composer, the grouping control, the skeleton, and one screen that owns grouping state, the overlay and the re-query. `lane-model.ts` is extracted **not** speculatively but because the screen otherwise owns rendering, grouping, drag wiring, polling and optimism at once — and because those transforms are where four success criteria are actually testable (D-2). **Nothing else is extracted.** No shared "board service" sits between the components and the database; no diff-builder is factored out of `updateIssue` and `moveIssue`, because the two call sites want different shapes and Principle I says to wait for the second confirming one (B-8); `src/components/ui/` is still not created. What is reused is what already has callers: `listProjectColumns`, `listAssigneePool`, `parsePriority`, `parsePlacement`, `isMember`, `writeActivity`, `showToast`, `displayName`, `formatIssueKey`. |
| **II** | Validated Input Boundaries | One Server Action, a public server entry point: origin, actor, row, role, then input — the order R6 and R9 already use. `moveIssue` takes every field as `unknown` and parses each; it accepts **no** client-computed `sort_order` and **no** project identifier, so FR-031 and FR-036 are structural rather than checked (B-1). The lane is validated against the database on every call whatever the board rendered — a column of this project, a person in `listAssigneePool`, a priority `parsePriority` admits (B-4) — and `getDropOperation`'s client-side refusal is an affordance only (C-3, FR-065). The Create issue page's new `searchParams` read validates each preselection against the project before rendering it (E-3). |
| **III** | Straightforward Over Clever | `moveIssue` is one locked read, one lane read, an array splice, one `generateKeyBetween`, one `UPDATE` and one optional activity row. No rebalancing, no retry loop, no renormalization — and the one `try/catch` that does exist guards a reachable throw with a named requirement behind it (A-3), not a hypothetical. The drop payload is two fields, not a three-valued enum crossed with an optional id (B-1). No seam, hook or extension point is built for R11's notification (E-5). |
| **IV** | Built-In Features Over Third-Party Libraries | **Zero new dependencies.** The drag is `react-aria-components`' own `useDragAndDrop`, verified present in the installed 1.20.0 along with the cross-list handlers this feature needs; the index is `fractional-indexing`, already used by `create-issue.ts`. Every drag-and-drop library is explicitly refused rather than silently avoided, and so is hand-building the gesture. One inherited discrepancy — `clsx`, in `package.json` but not on the approved table — is recorded below rather than left for a reviewer to find. |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The four places a reader will want an explanation — why the lane is not locked, why a tie is refused rather than repaired, why the overlay is not `useOptimistic`, why the row is resolved before the role — are answered by [`research.md`](./research.md) B-5, A-3, D-1 and B-3 and by the contracts, not by annotation. `MoveIssueState`'s five outcomes are one success and four refusals, and each refusal names its own reason. |
| **VI** | No Dead Code | `moveIssue` accepts no `sortOrder`, `projectId` or `rank` — not even as ignored optional fields, which would be dead surface a reviewer must re-verify. The board DTO exposes no `sort_order`, because no client computes an index. No notification hook is declared for R11. No `invalid_input` member is declared for a state FR-041 does not admit. `kind` is read from a column by nothing at all, as the spec requires. |
| **VII** | Test-First (NON-NEGOTIABLE) | All 65 acceptance scenarios are carried by a Red step written before its implementation, sequenced in `tasks.md`. The two Red steps worth naming: `no_index_available`'s test seeds two **equal** indexes and observes the raw `generateKeyBetween` throw escaping `moveIssue` before any `try` exists — a test written after the guard would pass on its first run and, per `AGENTS.md`, would not be a valid Red step (F-2). And every ordering test takes a full census of the project's indexes before and after, asserting exactly one changed, because SC-002 and SC-005 are statements about what did **not** move (F-3). Concurrency, refusals and invariants are tested against real PostgreSQL, never a mock (F-1). |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. F-2 fixes what the subtlest Red step is and why a passing-first-run test would not count |
| 2 | Minimal implementation, then refactor green | Scoped per task. The mutator does no more than its entry in [`contracts/mutators.md`](./contracts/mutators.md) |
| 3 | Server-side validation at every touched boundary | The Principle II row above. One action and one newly-read `searchParams`; origin, actor, row, role, then input on the action, and per-value validation against the project on the query string |
| 4 | No unapproved dependency | None installed. `package.json` is unchanged. The inherited `clsx` discrepancy is recorded below, untouched by this feature |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | The Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | Each path in Project Structure below names the requirement putting it there. The four reach-backs into R2's and R6's trees are named in Complexity Tracking, not left for the diff |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not itself evidence of VII — the commit order is |

## Project Structure

### Documentation (this feature)

```text
specs/009-board-grouping-drag-ordering/
├── spec.md                     the feature specification
├── plan.md                     this file
├── research.md                 Phase 0 — 36 decisions, six groups
├── data-model.md               Phase 1 — no schema change, DTOs, lanes, the activity row
├── quickstart.md               Phase 1 — 12 walkthroughs, and what a browser cannot show
├── contracts/
│   ├── mutators.md             moveIssue, and createIssue's two new callers
│   └── screens.md              the board, its tree, its roles, and four forced edits
├── checklists/                 spec-quality gate
└── tasks.md                    Phase 2 output (/speckit-tasks — NOT created by this command)
```

### Source code (repository root)

Every path is created or edited by this feature, and each names why it exists.

```text
src/
├── app/(app)/projects/[projectKey]/
│   ├── page.tsx                                     EDIT — the notFound() placeholder is
│   │                                                  replaced by the board            FR-001, FR-003
│   └── issues/new/page.tsx                          EDIT — reads searchParams, validates each
│                                                      preselection against the project        FR-048
├── features/
│   ├── board/                                       NEW — the screen; it owns no table
│   │   ├── components/
│   │   │   ├── board-screen.tsx                     NEW — "use client"; grouping state, the
│   │   │   │                                          pending-move overlay, the re-query
│   │   │   │                                                  FR-015, FR-020, FR-054…FR-059
│   │   │   ├── board-lane.tsx                       NEW — one GridList + its dragAndDropHooks
│   │   │   │                                                  FR-008, FR-009, FR-041…FR-045
│   │   │   ├── issue-card.tsx                       NEW — the card face and nothing more
│   │   │   │                                                  FR-010…FR-014
│   │   │   ├── card-composer.tsx                    NEW — "Add a card", the chevron, the
│   │   │   │                                          disabled states       FR-046…FR-053
│   │   │   ├── grouping-control.tsx                 NEW — the header's one per-screen control
│   │   │   │                                                          FR-005, FR-015
│   │   │   └── board-skeleton.tsx                   NEW — lane-shaped, never a spinner     FR-007
│   │   ├── lane-model.ts                            NEW — pure: grouping, the (sort_order, id)
│   │   │                                              comparator, the splice, the replay of
│   │   │                                              pending drops over fresh rows
│   │   │                                                  FR-017…FR-019, FR-022…FR-025, FR-055, -056
│   │   └── server/
│   │       └── board-queries.ts                     NEW — loadBoard: a fixed query set, no
│   │                                                  per-card read                 FR-002, FR-009…FR-018
│   ├── issues/
│   │   ├── actions.ts                               EDIT — the moveIssue Server Action, on the
│   │   │                                              preamble the three there share        FR-028
│   │   ├── components/
│   │   │   └── create-issue-form.tsx                EDIT — four optional initial values,
│   │   │                                              seeding the useState calls already there
│   │   │                                                                                    FR-048
│   │   └── server/
│   │       ├── move-issue.ts                        NEW — the mutator          FR-028…FR-041, FR-060
│   │       └── move-issue-input.ts                  NEW — parseGrouping, parseIssueId;
│   │                                                  parsePlacement is R9's, imported   II, gate 3
│   └── projects/components/
│       └── project-header.tsx                       EDIT — one `control` prop, forwarded to
│                                                      ScreenHeader's existing slot   FR-004, FR-005
```

Untouched and named so: **`src/db/schema.ts` and the whole of `drizzle/`** (no migration — B-7) ·
`package.json`, `next.config.ts`, `vitest.config.mts`, `tsconfig.json`, `drizzle.config.ts`,
`biome.json` · `src/db/test-database.ts` (every table this feature writes is already truncated) ·
`src/db/touched.ts`, `src/db/unique-violation.ts` · `src/features/issues/server/create-issue.ts`,
`update-issue.ts`, `delete-issue.ts`, `input.ts`, `issue-queries.ts`, `issue-key.ts` — **every R6
mutator and query is called, none is edited** · the whole of `src/features/activity/` including
`write-activity.ts` and `activity-row.tsx`, because `field_changed` and `"None"` already exist
(FR-063) · the whole of `src/features/labels/` · `src/features/projects/**` but `project-header.tsx`,
so R9's four column mutators, `columns-section.tsx` and `queries.ts` are all read-only here ·
`src/features/shell/**`, including `screen-header.tsx`, whose `control` slot is used as delivered ·
`src/components/ui/` (still not created) · `src/features/activity/no-polling.test.ts`, deliberately —
see below.

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. `src/app` gains no domain module — the
board route resolves the actor, loads the board and renders; the Create issue route reads and
validates four query parameters. All behaviour lives under `src/features/`, with everything touching
the database in a `server/` directory carrying `server-only` transitively through `@/db`. No barrel
file mixes server and client exports.

Two structural calls worth stating, because a reviewer could reasonably expect the other answer:

- **`moveIssue` lives in `src/features/issues/server/`, not in `src/features/board/server/`.** It
  writes the `issue` table, sits beside `createIssue`, `updateIssue` and `deleteIssue`, and reuses
  `listAssigneePool`, `listProjectColumns` and `parsePriority` from that directory. Putting it under
  the board would split one table's write surface across two features — the exact objection R9
  recorded when it kept the column mutators in `src/features/projects/`. The **screen** is the
  opposite case and gets its own feature: a route, a header control, seven components and a read that
  belongs to none of the three features it draws from. (E-1.)
- **The action is appended to `src/features/issues/actions.ts` rather than given a module of its
  own.** `AGENTS.md` requires a dedicated module carrying top-level `"use server"`, not one per
  action; that file is 103 lines with three actions and a fourth leaves its intent obvious. R9 split
  `column-actions.ts` out of `projects/actions.ts` for the stated opposite reason — 240 lines and six
  actions. Same rule, different input, different answer. (B-10.)

## Complexity Tracking

Two places this design reaches into work another entry owns, and one thing that looks like a
violation and is not. Each is recorded so a reviewer meets it here rather than discovering it in the
diff (gate 7).

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **Two files R6 owns are edited** — `create-issue-form.tsx` gains four optional initial values, and `issues/new/page.tsx` starts reading `searchParams` | FR-048: shift-enter and the chevron must open the Create issue page "preselecting exactly what the composer would have written … and carrying across any title already typed". The form's state is initialized with literals (`useState("")`, `useState(columns[0]?.id ?? "")`); there is no way to seed it from outside today, and the route ignores its query string entirely. Both edits are additive and optional — the existing New issue entry point passes nothing and behaves exactly as it does now. | *A second create form for the board's chevron.* Duplicates a 270-line form, its validation, its label picker and its in-flight handling — what Principle I exists to prevent, and it would drift from the one the header's **New issue** button opens. *Carry the preselection in `sessionStorage` or a cookie instead of the URL.* The chevron opens a full page at a shareable URL (§3.5); hiding its state off-URL makes a reload lose it and adds a channel the product does not have. *Pass the preselection through without validating it.* Fails Principle II and gate 3 — a `?columnId=` naming another project's column would render preselected. |
| **One file R2/R5 owns is edited** — `project-header.tsx` gains a `control` prop | FR-004 and FR-005: the board renders inside R5's project header and its grouping control must occupy "the header's single per-screen control slot", adding nothing else. `ScreenHeader` **already declares and renders** `control?: ReactNode` — R2 built the slot and no screen has used it yet — but `ProjectHeader` does not forward it. One prop is the entire edit; no markup, no layout and no other prop changes, and the **New issue** button is passed through exactly as delivered. | *Render the grouping control inside the board body instead.* Fails FR-005 outright and puts a per-screen control somewhere the shell contract does not have one. *Build a second header for the board.* Two headers for one project, diverging on the tab pair and the comment count — and FR-004 says the board uses the header R5 delivers. *Add the slot to `ScreenHeader`.* It is already there; nothing to add. |

**Not recorded as a violation, because it is not one — but a reviewer will ask.**
`src/features/activity/no-polling.test.ts` asserts that three named files issue no `setInterval`,
`setTimeout`, `requestAnimationFrame` or `poll`: R7's feed component and the project-details and
issue-details pages. FR-054 requires this board to re-query on a thirty-second interval. The two do
not conflict: R7's rule is feed-scoped (`OT-UX-006`) and its test enumerates its three files
explicitly; the board's timer lives in `src/features/board/components/board-screen.tsx`, which is not
among them. **That test is left exactly as it is** — extending its file list would be adjacent code
this feature was not asked to touch (gate 7), and narrowing it would weaken a guard R7 owns. (D-3.)

**One inherited discrepancy, recorded rather than fixed.** `package.json` carries `clsx@^2.1.1` as a
runtime dependency; it is **not** on `AGENTS.md`'s approved-dependency table, which that file calls
"the complete set". It predates R10, is imported only by `src/app/components/common/logo.tsx` and
`src/features/auth/components/primary-button-classes.ts`, and nothing in this feature adds, removes
or relies on it. It is named here because a reviewer applying gate 4 to this diff will read that
table and should know the discrepancy is inherited, not introduced. **Resolving it — an amendment
recording the approval, or removing the package — is not this feature's work and no task here does
it.**

## Explicitly out of scope

Named so no task claims them: locking, live push, sockets and real-time collaboration — freshness is
FR-054's re-query and nothing else (§1) · **every notification**, including the `assignment` row an
Assignee-grouping drop will eventually write; R11 owns the `notification` table and adds its
recipient computation to this feature's `moveIssue` when it lands, and **no seam is left for it here**
· Home's progress figure, R12's — **this feature reads a column's `kind` for nothing at all** ·
column editing, R9's, on project details; the board reads columns and never adds, renames, reorders
or deletes one · label curation, R8's; the board renders a card's labels and offers no way to change
them · any field edit that is not a drop — the issue rail R6 delivers is where a field is changed by
hand, and the board carries no inline field control on a card · deleting an issue from the board,
R6's admin-only `deleteIssue` from the issue's own page; a member removes an issue by dragging it
into a `canceled`-kind column · a list view, a calendar, search, filtering, sorting and a command
palette (§1) · pagination inside a lane, which no source specifies · sub-issues, attachments and
issue hierarchy (§1) · any responsive or mobile layout (FR-006).

**No row is added to `docs/ROADMAP.md` §6 *Status log* and no version number is bumped anywhere.**

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 36 decisions; **no unknown outstanding**, R1/R2/R5/R6/R7/R8/R9 read directly from the tree, React Aria's cross-list handlers verified in the installed typings |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — **pass**, two items in Complexity Tracking plus one inherited discrepancy recorded |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — 94 tasks across 9 phases |
| Implementation | — | not started |
