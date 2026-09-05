# Phase 0 — Research: Board columns (R9)

**Feature**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md)

Every decision below was taken by reading the code that already exists on this branch, not by
inference from the specification alone. R5, R6 and R7 are **implemented**, not merely planned, so
this feature has no blocked requirement and no placeholder import — the departure from R8's
situation, and the reason this plan carries no "waiting on R7" row.

Groups: **A** structure and ordering · **B** the four mutators · **C** activity ·
**D** authorization and the boundary · **E** the section and its components · **F** testing.

---

## A. Structure and ordering

### A-1. `board_column.sort_order` is a fractional index string, not an integer position

**Decision**: `moveColumn` and `createColumn` write a base-62 fractional index using
`generateKeyBetween` from `fractional-indexing`. No integer `position` column exists, none is added,
and no renumbering pass is written.

**Rationale**: read from the actual schema rather than assumed. `src/db/schema.ts` declares

```
const sortOrder = customType<{ data: string }>({ dataType() { return `text collate "C"`; } });
```

and `boardColumn.sortOrder` uses it — `sort_order text COLLATE "C"`, exactly the convention
`docs/product/specifications.md` §5 fixes for the whole product. `src/features/projects/seed-columns.ts`
seeds the five rows with the literal keys `a0` `a1` `a2` `a3` `a4`, which are `fractional-indexing`'s
own key space. `src/features/issues/server/create-issue.ts` is the one existing caller and already
imports `generateKeyBetween` to append an issue at the foot of a project's order. `fractional-indexing`
is on `AGENTS.md`'s approved-dependency table, so this adds no dependency.

The spec's `ProjectColumnRow.position: number` is a **derived display ordinal**, computed by
`loadProjectDetails` as the array index of the ordered read. It is not stored and this feature does not
begin storing it.

**Alternatives rejected**: *an integer `position` column with a renumbering `UPDATE` on every move* —
requires a migration this feature has no requirement for, rewrites every row on each drag, and
contradicts §5's stated convention. *Reusing R10's yet-unwritten ordering module* — R10 does not exist;
Principle I forbids extracting a shared ordering abstraction before its second call site, and
`create-issue.ts` calling `generateKeyBetween` inline is the pattern already in the tree.

### A-2. Board order is read as `ORDER BY sort_order, id`

**Decision**: every query that renders a project's columns orders by `(sort_order, id)`.
`loadProjectDetails` today orders by `sortOrder` alone; this feature adds the `id` tie-break.

**Rationale**: FR-033 requires one board order per project that every reader agrees on, and fixes that
order as `(sort_order, id)`, carrying §3.3's rule for issues forward to a project's columns. Two
columns cannot share a key through any write this feature makes (A-3), but a deterministic sort makes
that a property of the query rather than a property of the data.

### A-3. Neighbour keys are always distinct, so no rebalancing machinery is written

**Decision**: `generateKeyBetween(previousKey, nextKey)` is called on the two neighbours read inside
the move's own locked transaction. No collision-recovery branch, no `generateNKeysBetween` rebalance,
no retry loop.

**Rationale**: the five seeded keys are distinct; every key this feature generates is strictly between
two distinct existing keys, so it is distinct from both. `generateKeyBetween` throws only when
`previous >= next`, which the locked, ordered read cannot produce. Writing a recovery path for a state
no code path reaches is dead code under Principle VI and speculative machinery under Principle III.
If ties ever arrive from outside this feature, A-2's `id` tie-break keeps the render stable.

### A-4. `createColumn` appends by reading the project's highest key under the same lock

**Decision**: `generateKeyBetween(highestKey ?? null, null)`, the highest key read inside the create's
transaction from the project's locked column rows.

**Rationale**: FR-019 requires the new column last in board order. This mirrors `create-issue.ts`
line for line, which is the house idiom for "append to the foot of this project's order".

### A-5. This feature creates no table, no column and no index

**Decision**: the only schema change is D-3's `CHECK` widening on `activity.type`.

**Rationale**: FR-001. `board_column` already carries `project_id`, `name`, `sort_order`, `kind`,
`created_at`, `updated_at`, the `UNIQUE (project_id, lower(name))` index
(`board_column_project_id_name_lower_idx`), the 200-character `CHECK`
(`board_column_name_length`) and the kind `CHECK` (`board_column_kind_valid`). The per-column issue
count reads `issue` filtered by `project_id` and grouped by `column_id`;
`issue_project_id_number_unique` on `(project_id, number)` already serves the `project_id` prefix, so
`AGENTS.md`'s "add indexes for known query patterns only" adds none here.

---

## B. The four mutators

### B-1. `deleteColumn` evaluates all four refusals inside one transaction against `FOR UPDATE`-locked rows

**Decision**: the transaction body is, in order:

1. `SELECT id, name, kind FROM board_column WHERE project_id = $1 ORDER BY id FOR UPDATE`
   — every column of the project, locked, in a deterministic order.
2. The target row is found in that result; absent ⇒ `not_found`.
3. `countIssuesByColumn(tx, projectId)` — the emptiness read, project-wide and inside the lock, the
   **same** function `loadProjectDetails` uses for the count the section shows, which is what makes
   the shown count and the refused count one read (FR-015, SC-010, E-8, data-model §2). A
   target-only `count(*)` would be a second read shape and would put the two out of step.
4. The four refusals are evaluated against those two reads, in FR-038's fixed precedence.
5. `DELETE`, then the activity row, then commit.

**Rationale**: FR-050 forbids treating a read followed by a write as protection, and `AGENTS.md`
says the same. Two properties follow from the lock, and neither is available without it:

- **The issue race (SC-005, the third Edge Case).** PostgreSQL takes a `FOR KEY SHARE` lock on the
  referenced `board_column` row when a transaction inserts or updates an `issue` referencing it
  through `issue_project_id_column_id_fk`. `FOR UPDATE` on that same row conflicts with `FOR KEY SHARE`,
  so a concurrent write moving an issue *into* the column either commits before the lock is taken —
  and the emptiness count sees it — or blocks until the delete commits and then fails its own FK
  check against a row that is gone. There is no window in which the count is stale.
- **The last-of-a-kind race (SC-003, the fourth Edge Case).** Two concurrent deletes of a project's
  two remaining `done`-kind columns both need `FOR UPDATE` over overlapping row sets, so they
  serialize. The second one's step-1 read sees the first one's commit and refuses.

`ORDER BY id` fixes the lock acquisition order, so two concurrent deletes on one project cannot
deadlock against each other.

**Alternatives rejected**: *`SELECT ... FOR UPDATE` on the target row alone* — locks nothing about the
other columns, so two deletes of the last two `done`-kind columns each read "two exist" and both
succeed. *`SERIALIZABLE` isolation* — pushes the failure to a serialization error the caller must
retry, turning four precise, user-facing reasons into one generic retry; FR-038 and FR-052 require the
opposite. *An advisory lock keyed on the project* — a second, parallel locking scheme beside the row
locks the rest of the codebase uses, for no capability the row locks lack (III).

### B-2. The refusal precedence is a pure function, evaluated after every check has run

**Decision**: all four predicates are computed, then one reason is selected from them by a fixed
ordered list — `holds_issues`, `last_column`, `last_canceled_kind`, `last_done_kind`. The selection is
a small pure function over the four booleans, unit-testable without a database.

**Rationale**: FR-038 requires the shown reason to be chosen by precedence and *not* by evaluation
order, so "the same column always explains itself the same way". Early-returning from the first
failing check makes the answer depend on the order the checks happen to be written in, which is
precisely what the requirement rules out. Separating "which refusals hold" from "which one is shown"
also lets the client render the disabled Delete control's inline reason (FR-039) through the same
function, satisfying SC-004 with one implementation rather than two that can drift.

### B-3. Name uniqueness is enforced by the database index and never by a pre-flight read

**Decision**: `createColumn` and `updateColumn` attempt the write and catch PostgreSQL `23505` whose
`constraint_name` is `board_column_project_id_name_lower_idx`. Only then does a follow-up read resolve
the offending column's stored name, and only to build the message.

**Rationale**: FR-051 is explicit — "enforced by the database constraint rather than by a check the
mutator performs before writing, so two concurrent writes claiming the same name cannot both succeed"
(the fifth Edge Case). This is a deliberate departure from `src/features/labels/server/create-label.ts`,
which pre-reads `findLabelNameHolder` and then also catches the violation; the labels feature has no
equivalent requirement. The follow-up read here is for FR-021's message text ("naming that existing
column"), not for enforcement, and it runs only on the refusal path.

The constraint name is matched explicitly rather than using the shared `isUniqueViolation` helper
alone, because `board_column` carries a second unique constraint — `board_column_project_id_id_unique`,
R6's composite-FK target — and a `23505` from it must not be reported as a name collision. The pattern
is the one `src/features/projects/server/update-project.ts` already uses for
`project_dates_ordered`: read `code` and `constraint_name` off the error's `cause`.

`updateColumn`'s comparison excludes the row being renamed for free — the row is the one being
updated, so `lower(name)` colliding with itself is not a violation. FR-026 and the sixth Edge Case
("Todo" → "todo") are satisfied by the constraint's own semantics rather than by an `id <>` clause.

### B-4. `moveColumn` takes a neighbour-relative payload, not an index

**Decision**: the action's payload is `{ columnId, targetColumnId, placement }` where `placement` is
`"before" | "after"`, and **no `projectKey`**. The server derives the project from the stored
`columnId` row (FR-008), verifies `targetColumnId` belongs to that same project, and computes the two
neighbour keys from the locked, ordered list — never from a client-supplied ordinal or key.
`placement` is validated at runtime to be one of the two literals, and both ids for UUID shape, before
either reaches a query (FR-053, II).

**Rationale**: II. A client-supplied index or a client-computed `sort_order` string is user input that
decides where a row lands; a neighbour id is a claim the server can verify against stored rows. React
Aria's `useDragAndDrop` `onReorder` hands back exactly `{ target: { key, dropPosition }, keys }`, which
maps to this payload with no arithmetic on the client.

A `projectKey` alongside `columnId` would be a second, redundant statement of the project the stored
column row already settles — and FR-008 requires the project be resolved from that stored row and the
caller re-authorized against it, so the key could only ever be ignored or, worse, trusted. An input a
mutator refuses to honour is dead surface (VI) and an attack surface a reviewer must re-verify (II),
exactly as B-6 argues for `updateColumn`. `createColumn` is the one of the four that takes a
`projectKey`, because it has no column row to resolve a project from.
[`contracts/mutators.md`](./contracts/mutators.md) is authoritative on all four signatures.

### B-5. A no-op drop is detected server-side and writes nothing, `updated_at` included

**Decision**: inside the transaction, the ordered locked list is spliced — the moved column removed,
then re-inserted at the resolved target index. If the resulting index equals its current index, the
transaction returns the settled state having issued no `UPDATE` and no activity insert.

**Rationale**: FR-030 says "nothing at all, `updated_at` included", and US2 scenario 3 and SC-011
check that no activity row appears. Computing this on the client only would leave a bypassed call
free to write a no-op row; the server is the enforcement, as everywhere else here.

### B-6. `updateColumn`'s parameter list is one name

**Decision**: `updateColumn(columnId, actor, name)`. No `changes` object, no `kind`, no
`sortOrder`, no `projectId`, no colour — not as an ignored field, not as an optional one.

**Rationale**: FR-002, FR-003, FR-023, FR-005 and `OT-INV-015`. A parameter the mutator refuses to
honour is dead surface (VI) and an attack surface a reviewer must re-verify (II). The narrow signature
makes "kind is immutable" a property of the type rather than of a guard. `createColumn` likewise takes
a name and no kind; `kind: "open"` is a literal inside the insert.

Contrast `updateProject`, which takes a `changes` bag and filters it against `UPDATE_PROJECT_FIELDS` —
that shape exists because four fields are independently editable there. Here there is one.

### B-7. Every mutator runs in exactly one `db.transaction`

**Decision**: four transactions, one per mutator, each holding its write and its activity insert.

**Rationale**: FR-049, FR-048 and `OT-DATA-008`. `createColumn` and `moveColumn` need the transaction
for their ordered read as much as for atomicity; `updateColumn` needs it to pair the rename with its
row; `deleteColumn` needs it for B-1.

---

## C. Activity

### C-1. The four events are written through R7's existing `writeActivity`, unchanged

**Decision**: `writeActivity(tx, { type, target: { projectId }, actorId, field, fromValue, toValue })`
from `src/features/activity/server/write-activity.ts`, called inside each mutator's own open
transaction. No second writer, no insert assembled in this feature.

**Rationale**: FR-043, and the roadmap's R7 row states it in these words. The function already exists
and already takes a transaction handle as its first parameter — R7 built it for exactly this. The one
edit it needs is C-2.

### C-2. Three R7 modules gain the four values; nothing else in R7 is touched

**Decision**:

| File | Edit | Why |
| --- | --- | --- |
| `src/features/activity/server/write-activity.ts` | four values into the `ActivityType` union | otherwise the mutators cannot name their type |
| `src/features/activity/server/feed-queries.ts` | four values into its own `ActivityType` union | `FeedRow.kind` is typed from this second, independent union |
| `src/features/activity/components/activity-row.tsx` | four cases in `buildSentence` | its `switch` over `Exclude<ActivityType, "comment">` is exhaustive; widening the union without adding the cases is a compile error |

**Rationale**: this is not optional scope. `activity-row.tsx` has no `default` branch, so `npm run
type-check` fails the moment the union widens. The feed component, its pagination, its filter and its
five-minute collapsing are untouched — the rows render inside them exactly as R7 built them, which is
what the spec's *Out of Scope* means by "the rows this feature writes render inside them unchanged".

The duplicated `ActivityType` union in `feed-queries.ts` is pre-existing; this feature widens it and
does **not** refactor the duplication away (gate 7 — adjacent code is left untouched, and a reviewer
should meet the duplication as it was, not as a drive-by fix).

### C-3. The four sentences

| Type | `field` | `from_value` | `to_value` | Rendered |
| --- | --- | --- | --- | --- |
| `column_added` | new column's name | null | null | *Ana added column Review* |
| `column_renamed` | **old** name | old name | new name | *Ana renamed column Todo to Up next* |
| `column_reordered` | column's name at write time | null | name of the column it now follows, **null ⇒ now first** | *Ana moved column Canceled to first* / *…after Todo* |
| `column_deleted` | column's name at write time | null | null | *Ana deleted column Review* |

**Rationale**: FR-045 and FR-046, and the Clarifications session settles the rename's `field` as the
pre-rename name — so `field` repeats `from_value` on that one row, which the spec records as intended.
Every string is passed through R7's `truncateActivityValue`, which the 200-character `CHECK` on
`from_value` / `to_value` requires; `field` carries no `CHECK` but is truncated identically so a
feed line cannot disagree with its own pair.

No row carries a column reference — there is no `column_id` on `activity` and none is added — which is
why SC-012 holds after the column is deleted.

### C-4. `from_value` on a reorder row stays null

**Decision**: `column_reordered` writes `to_value` only.

**Rationale**: the spec's own Assumptions, from §5 — the pair carries a transition only where the
change has one, and §5 names `to_value` alone for this type. Recording the previously-followed column
would be an additive change to one write path if it is ever wanted.

### C-5. One row per drag, for the moved column only

**Decision**: `moveColumn` writes exactly one activity row. Columns whose ordinal shifted beneath the
moved one get none.

**Rationale**: FR-047 and the first Clarification. The fractional index makes this the natural
implementation as well as the required one — only the moved row's `sort_order` is written, so there is
nothing else to record.

---

## D. Authorization, validation and the boundary

### D-1. Row first, then `isAdmin` — the reverse of the labels feature's order

**Decision**: each of the four actions resolves its row before it evaluates the role. A caller acting
on a column or project that does not exist gets `notFound()`, never `forbidden`.

**Rationale**: FR-010, `OT-UX-004` and `OT-AUTHZ-005` — every column is readable by every signed-in
user, so "you may not touch this" is never the honest answer for a row that is not there, and §4's
"Not found" row requires "This doesn't exist", never "you don't have access".
`src/features/labels/server/delete-label.ts` checks `isAdmin` first; labels are a different read
boundary and that order is right there and wrong here. Recording the divergence so a reviewer does not
"fix" it toward the labels precedent.

`src/app/(app)/projects/[projectKey]/details/page.tsx` already renders for any signed-in actor and
already calls `notFound()` for an unknown key, so US4 scenario 6 needs no route change.

### D-2. Membership and project status are never consulted

**Decision**: the predicate is `isAdmin(actor)` and nothing else. No `isMember` call, no
`|| isAdmin` branch, no `status !== 'archived'` guard.

**Rationale**: FR-007, and the third Clarification — archiving is reversible and §4 *Nothing cascades*
names no consequence of it for a project's columns. `src/features/projects/server/authorization.ts`
already exports `isAdmin`; this feature adds no predicate. Note that `updateProject` needs its
membership branch and `deleteProject` needs its archived guard — neither pattern is copied here, and
the eighth Edge Case ("A column added to an archived project — allowed") is a test, not a comment.

### D-3. One new migration widens `activity_type_valid` by exactly four values

**Decision**: edit the `check("activity_type_valid", …)` list in `src/db/schema.ts` to add
`column_added`, `column_renamed`, `column_reordered`, `column_deleted`; run `npm run db:generate`;
inspect the emitted SQL; commit `drizzle/0007_*.sql` and its `meta` update.

**Rationale**: FR-042, `AGENTS.md` → Drizzle ORM ("Generate migrations with Drizzle Kit, inspect the
generated SQL, and commit the migration plus its metadata" / "Never edit a migration that may already
have run"). `drizzle/0006_lying_sugar_man.sql` created the constraint and is not touched. The emitted
form is a `DROP CONSTRAINT` followed by an `ADD CONSTRAINT` carrying the widened list; the inspection
step confirms it names `activity_type_valid` and changes nothing else about the table. §5's
conventions chose `text` + `CHECK` over `pgEnum` precisely so that "widening a `CHECK` is an ordinary
transactional migration", and this is the first exercise of that choice.

**Four values, not five.** `docs/ROADMAP.md`'s R9 row, R7's *Out of Scope* and `OT-DATA-019` each say
"five" because they were written from the derived requirements index, which counts a
`column_recolored` event. `docs/product/specifications.md` §7 *Palette* retires per-column colour
outright and §5 enumerates exactly four `column_` values; the specification wins and the spec's
Reconciliations record it. **Four values. No `column_recolored`, no colour anywhere in this feature.**

**This widening is unambiguously first, and a later one must be generated on top of it.**
`activity_type_valid` admits exactly **seven** values today — `created`, `field_changed`,
`member_added`, `member_removed`, `archived`, `reopened`, `comment` (`drizzle/0006_lying_sugar_man.sql`,
`src/db/schema.ts:364`). This feature's migration takes that list to **eleven**, generated from the
current schema, so there is no second widening to compose with and no ordering question for R9.

Entry R8 has landed and added nothing to it: `src/features/labels/server/no-activity.test.ts` shows
labels as built write no activity at all, so the `label_added` and `label_removed` values R8's roadmap
entry calls for do not exist in the constraint and were never added. That gap is tracked separately,
outside this feature. **Whenever it is fixed, its migration must be generated from the then-current
`src/db/schema.ts` — post-R9 — so the replacement `CHECK` carries this feature's four `column_*`
values alongside the two `label_*` ones.** Drizzle rewrites a `CHECK` as a whole list rather than
appending to it, which is the real hazard: a migration generated against a stale schema silently drops
whatever the other entry added. Nothing here reserves a slot for it.

### D-4. One name parser, two callers

**Decision**: `parseColumnName(raw): { ok: true; name: string } | { ok: false; reason: "required" | "too_long" }`
— trims, rejects empty or whitespace-only, rejects over 200 characters after trimming.

**Rationale**: FR-004 requires trimming *before* the length bound and *before* the uniqueness
comparison (the seventh Edge Case: `" Todo "` collides with `"Todo"`). Two call sites — `createColumn`
and `updateColumn` — exist on day one, so Principle I's second-call-site rule is met rather than
anticipated. Over-length input is refused, never truncated (II). The `board_column_name_length` `CHECK`
remains the backstop, so a bypassed client cannot write 400 characters even if the parser were wrong.

### D-5. Every action re-asserts origin and actor the way `projects/actions.ts` already does

**Decision**: `assertSameOrigin({ headers: await headers() })`, then `requireActor()`, then D-1's
order, then `refresh()` on success.

**Rationale**: matching the four existing project actions exactly. `AGENTS.md` — "Every Server Action
is a public server entry point: validate input, authenticate, authorize the exact resource, return a
safe result." `refresh()` is what makes FR-012 true: an admin whose role was revoked gets a re-render
without the four controls on the next server render.

### D-6. Refusals cross the boundary as a discriminated union of reason codes

**Decision**: each mutator returns a typed result — `{ ok: true, … }` or
`{ ok: false, error: "…" }` — and the client maps the code to prose. No `Error` is thrown across the
boundary, no constraint name, no SQL and no stack trace reaches a client.

**Rationale**: FR-052, `AGENTS.md` → TypeScript ("Model expected failures as typed results or domain
errors") and → the server boundary ("Return generic messages to clients and keep SQL, stack traces,
and configuration in server logs"). Every refusal here is expected, not exceptional.

---

## E. The Columns section and its components

### E-1. One `GridList` renders the section for every role; only the affordances differ

**Decision**: `columns-section.tsx` renders a single `GridList` from
`react-aria-components/GridList` for admins and non-admins alike. For an admin it is additionally
supplied `dragAndDropHooks` from `useDragAndDrop`, and each row additionally renders the editable
name, the Delete control and the add form beneath the list. For everyone else the same rows render
name, kind and count as static text.

**Rationale**: FR-014 and FR-016, and US4 scenario 1 — "the Columns section renders every column in
board order with its name, its kind and its issue count, exactly as it does for an admin". Two
markups for two roles would be two things to keep in agreement; one markup with conditional
affordances is the same rule the rest of this codebase follows (`EditableField`'s `isDisabled`,
`MembersSection`'s optional `admin` prop, `ProjectDetailsScreen`'s optional `admin` prop). The
`admin` prop shape is copied from `MembersSection` deliberately.

**Consequence for R5's existing test.** `columns-section.test.tsx` currently asserts
`getAllByRole("row").slice(1)` against the `<table>` R5 shipped, skipping a `<thead>` row. A `GridList`
renders `role="grid"` with no header row, so that test changes with the component it tests. This is
FR-013's and FR-014's change landing where it belongs, not a drive-by edit; the test's second case —
"offers no control that adds, renames, reorders or deletes" — survives verbatim as the non-admin case
and gains an admin counterpart.

### E-2. The reorder is React Aria's `useDragAndDrop`, which supplies the keyboard path for free

**Decision**: `useDragAndDrop({ getItems, onReorder })` from
`react-aria-components/useDragAndDrop`, wired into the `GridList` via `dragAndDropHooks`. No pointer
handlers, no `onMouseDown`, no HTML5 drag events, no drag library.

**Rationale**: FR-031 and `AGENTS.md` → React Aria Components ("Build a component by hand only where
React Aria ships no equivalent"). `react-aria-components@1.20.0` exports `useDragAndDrop`,
`DropIndicator` and `GridList` on the subpath entry points this codebase already imports from
(`react-aria-components/useDragAndDrop`, `react-aria-components/GridList`) — verified against the
installed package. Its built-in keyboard drag — Enter on a row to lift, arrows to move, Enter to drop,
Escape to abandon — is what makes US2 scenario 4 and SC-013 pass without a hand-written key handler,
and abandoning the drag writes nothing (the tenth Edge Case) because `onReorder` never fires.

**Dependency check**: `react-aria-components` is on `AGENTS.md`'s approved table. **No drag-and-drop
library is added.** Nothing in this feature needs one, and Principle IV would refuse it if it did.

### E-3. The rename reuses R5's `EditableField`, which gains one result variant

**Decision**: `ColumnRow`'s name uses `src/features/projects/components/editable-field.tsx`.
`EditableFieldSaveResult` gains a fourth variant, `{ status: "conflict"; message: string }`, and
`EditableField` renders that message inline — `role="alert"`, associated to the control through
`aria-describedby` — instead of raising a toast, while still rolling its optimistic value back.

**Rationale**: FR-024 asks for exactly the gesture `EditableField` already implements and already has
tests for: activate to open a field, Escape reverts, blur or ⌘-enter saves, Ctrl-enter on a platform
with no ⌘ key, focus returns to the control when the field closes, and a blur whose value is unchanged
makes no call (`draft === initialDraftRef.current` → `closeEdit()` with no dispatch). Reimplementing
that for one row would duplicate a solved component and its edge cases.

What it does not do is FR-025's inline error naming the existing column — its only failure path is
`showToast`. One variant is the minimal change that serves both callers: R5's four fields never return
`conflict` and are unaffected; this feature's rename returns it and gets its inline error. The
alternative — a second in-place-editing component for one row — is the duplication Principle I exists
to prevent, and the toast-only alternative fails FR-025's "inline error" and `OT-UX-012` outright.
Recorded in the plan's Complexity Tracking as a touch into R5's component.

### E-4. Add and delete wait for the server; rename and reorder are optimistic

**Decision**: `ColumnRow`'s rename and the list's reorder use `useOptimistic` and roll back with a
message on refusal. The add form and the delete dialog show in-flight state and wait.

**Rationale**: FR-027, FR-032 and the spec's own Assumptions from `OT-UX-008` — in-place field edits
and drags are the optimistic cases, and writes that create or destroy wait. §4's *Slow write* row says
the same. A delete additionally has four refusals a client cannot evaluate for itself, so an optimistic
removal would show a row vanishing and returning.

### E-5. Delete is visible-and-disabled with its own inline reason, and confirms once

**Decision**: for an admin, the Delete control always renders. When any refusal holds it is
`isDisabled` with that refusal's reason in an inline `<p>` referenced by `aria-describedby`. When none
holds, pressing it opens a `Dialog` inside a `Modal` naming the column; only Confirm calls
`deleteColumn`. For a non-admin the control is not rendered at all.

**Rationale**: FR-039 — "visible and disabled with that refusal's reason inline, never hidden and
never as a dead control" — plus §2's general disabled-with-a-reason rule, which the spec's
Reconciliations confirm still applies to *this* control even though the section as a whole is
read-only rather than disabled for non-admins. The confirmation is the fourth Clarification and
follows §3.10's label-delete and §4's project-delete house pattern.
`src/features/projects/components/delete-project-control.tsx` is the shape to follow: `DialogTrigger` →
`Button` → `Modal` → `Dialog`, `isDismissable`, `close` from `{ state }`, focus returning to the
trigger on dismiss (the ninth Edge Case) because that is what `DialogTrigger` does. This is a
confirmation raised over the section, which FR-039 distinguishes from the modal-only *surface*
FR-013 bars.

The reason shown is chosen by the same precedence function B-2 defines, so SC-004's "the same column
always produces the same reason" holds across the control and the mutator by construction.

### E-6. The kind is rendered as text for every role

**Decision**: a plain string in the row. No `Select`, no `RadioGroup`, no disabled control.

**Rationale**: FR-017 and `OT-UX-010` — a disabled control implies a right somebody holds, and nobody
of any role may change a kind. This is the one place the disabled-with-a-reason rule deliberately does
not apply.

### E-7. Four Server Actions in their own `"use server"` module inside the projects feature

**Decision**: `src/features/projects/column-actions.ts`, carrying a top-level `"use server"` and
exporting `createColumn`, `updateColumn`, `moveColumn` and `deleteColumn`. The four server modules sit
beside R5's under `src/features/projects/server/`.

**Rationale**: the section, its DTO (`ProjectColumnRow`), its query (`loadProjectDetails`), its screen
(`project-details-screen.tsx`), its guard (`authorization.ts`) and `seed-columns.ts` are all already in
`src/features/projects/`. A new `src/features/columns/` feature would split one screen's behaviour
across two directories and force `loadProjectDetails` to be split with it, for no boundary that exists
in the product. A separate actions module rather than appending to the 240-line `actions.ts` keeps the
column entry points together and stops one file from growing past the point where its intent is
obvious (I). `AGENTS.md` requires a dedicated module marked `"use server"`, not a single one.

### E-8. The issue count is one read shape with two callers

**Decision**: `countIssuesByColumn(executor, projectId): Promise<Map<string, number>>` in
`src/features/projects/server/column-queries.ts`, taking either `db` or a transaction handle.
`loadProjectDetails` calls it with `db` to fill `ProjectColumnRow.issueCount`; `deleteColumn` calls it
with its own `tx` inside the lock.

**Rationale**: FR-015 requires the count the section shows and the count the refusal reads to be the
same read, and SC-010 tests that they never disagree. One function with two callers meets Principle I's
second-call-site rule on day one. `loadProjectDetails` today hardcodes `issueCount: 0` — R5 shipped it
as a placeholder that read zero until R6 landed, and this feature is where it becomes load-bearing.

---

## F. Testing

### F-1. Persistence, locking and constraint tests run against real PostgreSQL

**Decision**: every mutator test is a `*.test.ts` under the Vitest `server` project, using
`src/db/test-database.ts` against `TEST_DATABASE_URL`. `board_column`, `issue` and `activity` are
already in `TRUNCATED_TABLES`, so no edit to that file is needed.

**Rationale**: `AGENTS.md` → Testing ("Persistence tests MUST run against a real PostgreSQL instance
on a separate database — invariants are enforced by constraints and row locks, which a mock cannot
verify"), and the spec's Inherited constraints say the same. Nothing in B-1's lock behaviour, B-3's
`23505` mapping or D-3's widened `CHECK` is observable against a mock.

### F-2. The two concurrency tests drive two real connections

**Decision**: the last-of-a-kind race and the issue-moved-in race each open two transactions on
separate connections, interleave them deliberately, and assert one commit and one refusal.
`src/features/labels/server/issue-labels-race.test.ts` is the existing precedent for the shape.

**Rationale**: SC-003 and SC-005 name concurrency explicitly, and the fourth and third Edge Cases are
the scenarios. `fileParallelism: false` on the `server` project means these tests do not race other
files while they race each other.

### F-3. Red before green, per unit, and the schema change is Red too

**Decision**: the failing test precedes every unit of production code, including the migration: the
first Red step is a `server` test inserting an `activity` row of type `column_added` and asserting it
commits — which fails against the current `CHECK` with a `23514` before `src/db/schema.ts` is touched.

**Rationale**: VII and gate 1. A migration is production code; "observed failing for the intended
reason" means seeing the constraint refuse the value, not seeing a type error. The ordered task list
in `tasks.md` will carry the pairing; this decision fixes that the schema change is not exempt.

### F-4. Component tests are `*.test.tsx` under the `ui` project, queried by role and text

**Decision**: `@testing-library/react` + jsdom. Keyboard reordering is verified with explicit
`keyDown` events, not with `@react-aria/test-utils`.

**Rationale**: `AGENTS.md` → React Aria Components ("`@react-aria/test-utils` is not installed; adding
it needs approval under IV. Use explicit keyboard events to verify focus order") and → Testing ("Query
by role, label, and visible text before `data-testid`").

---

## Unknowns

**None outstanding.** R5, R6 and R7 are implemented on this branch, so every function, table, guard
and component this feature depends on was read rather than assumed. No requirement is blocked and no
task in `tasks.md` will need to be marked blocked.

## Dependency decisions

**Installed by this feature: none.** `react-aria-components` (drag and drop, `GridList`, `Dialog`,
`Modal`, `TextField`, `Button`), `fractional-indexing` (the ordering index), `drizzle-orm` and
`postgres` (the transaction and its row locks) are all on `AGENTS.md`'s approved table already.

**Deliberately refused: a drag-and-drop library.** `@dnd-kit`, `react-beautiful-dnd` and every
equivalent are absent from the approved table, so Principle IV forbids them without a recorded
amendment — and `useDragAndDrop` covers FR-031 including its keyboard path, so no amendment is
warranted. The spec's own *Dependency approval this feature triggers* says the same: none.
