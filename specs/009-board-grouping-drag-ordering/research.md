# Phase 0 — Outline & Research: Board — grouping, drag and ordering

**Feature**: `specs/009-board-grouping-drag-ordering` | **Branch**: `sdd/board-group-drag-order`

Every decision below was reached by reading this branch's tree, not by assuming it. R1, R2, R5, R6,
R7, R8 and R9 are all implemented here — `src/db/schema.ts`, `src/features/issues/server/`,
`src/features/projects/server/`, `src/features/activity/server/` and `src/features/labels/server/`
were read directly. **No unknown is outstanding and no requirement is blocked.**

Six groups: A the ordering index · B the `moveIssue` mutator · C drag and drop · D the board's read
and its freshness · E structure and reuse · F testing.

---

## A. The ordering index

### A-1 — `sort_order` already exists, is already a base-62 fractional index, and is not touched by this feature

**Decision**: reuse `issue.sort_order` exactly as R6 writes it. Add no table, no column, no second
ordering field and no per-lane index.

**Evidence**: `src/db/schema.ts` declares a module-level `sortOrder` `customType` rendering
`text collate "C"`, used by both `board_column.sort_order` and `issue.sort_order`. The `"C"`
collation is what makes a byte-wise `ORDER BY` agree with `fractional-indexing`'s own ordering.
`src/features/issues/server/create-issue.ts` already writes `generateKeyBetween(highest ?? null, null)`
inside its transaction. `fractional-indexing@4.0.0` is on `AGENTS.md`'s approved table.

**Rationale**: FR-022, FR-027 and the spec's *Inherited constraints* all say this outright. There is
nothing to design.

**Alternatives rejected**: an integer `position` per lane (three lanes × three groupings = a
denormalized order the product does not have, and it contradicts FR-022's single project-wide
sequence); a `board_card` join table (FR-027 forbids a new table).

### A-2 — `(sort_order, id)` is the only ordering, and the `id` tie-break is not decoration

**Decision**: every ordered read of issues in this feature sorts `ORDER BY sort_order, id` and by
nothing else, in SQL, not in JavaScript.

**Evidence**: `issue.id` is `uuidv7()`, so id order is creation order (FR-023). R9 fixed the same
tie-break for columns and `issue-queries.ts`'s `listProjectColumns` already carries
`.orderBy(asc(boardColumn.sortOrder), asc(boardColumn.id))`.

**Rationale**: FR-023, FR-024, SC-005. Ties are a legal state; the tie-break must be deterministic or
two renders of the same data disagree, which would break FR-059's "no visible change".

### A-3 — A tie is exactly where `generateKeyBetween` throws, and that throw is FR-031's `no_index_available`

**Decision**: `moveIssue` calls `generateKeyBetween(previous, next)` inside a `try`; a throw is
mapped to `{ ok: false, error: "no_index_available" }`. Nothing is renumbered, rebalanced or retried,
and no other row is read for a fallback.

**Evidence**: `generateKeyBetween` throws when `a >= b`. Distinct base-62 keys can always be split —
the library appends digits — so the reachable throw is the case where the two neighbours hold **equal**
keys, which FR-024 declares legal and forbids repairing.

**Rationale**: `OT-DATA-017` forbids both repairing a tie and touching more than one row, so
renumbering and "place it somewhere close" are both unavailable; refusal is the only remaining
behaviour, and the spec's *Defaults* section says so.

**This is a deliberate divergence from R9.** `specs/008-board-columns/research.md` A-3 concluded that
no collision recovery was warranted for `moveColumn`, because a `UNIQUE (project_id, lower(name))`
board column set is read under `FOR UPDATE` and distinct rows cannot collide. Issues carry no such
uniqueness on `sort_order` and ties are explicitly legal here, so the guard that was dead code there
is a live requirement here.

**Alternatives rejected**: renormalizing the lane (FR-024, SC-005 — a hundred drops must leave every
untouched index at its original value); nudging the card to an adjacent slot (FR-031: "rather than
placing the card elsewhere"); widening the key alphabet (a change to a shared library's behaviour for
one call site).

### A-4 — Neighbours are lane neighbours; a key between them is automatically consistent with the project sequence

**Decision**: the splice runs over the **target lane's** issues in `(sort_order, id)` order, and the
generated key sits between the lane neighbours.

**Rationale**: a lane is a filter of the one project-wide sequence (FR-022). A key strictly between
two lane neighbours is therefore also between them in the project sequence, and every card the filter
hid sits outside that interval by construction. This is why FR-025's "reordering under one grouping
changes relative position under the others" is a consequence rather than a bug, and why nothing
compensates for it.

### A-5 — No index is added

**Decision**: add no index. The board's read is `WHERE project_id = ? ORDER BY sort_order, id`.

**Rationale**: `AGENTS.md` — "Add indexes for known query patterns only" — and the spec's
*Scale/Scope*: one installation, one team under twenty people. `issue_project_id_number_unique`'s
`(project_id, number)` prefix already serves the filter; the sort is over a few hundred rows at most.
R9 declined an index on the same reasoning for the same table. Adding one now would be speculative
optimization and would need a migration this feature otherwise does not have.

---

## B. The `moveIssue` mutator

### B-1 — The payload is neighbour identifiers and a placement, never an index

**Decision**:

```text
moveIssue({ actor, issueId, grouping, laneId, targetIssueId, placement })
```

with `targetIssueId: null` meaning the lane's head (`placement: "before"`) or foot
(`placement: "after"`). No `sortOrder` field is accepted, declared or read from the client.

**Evidence**: R9's `src/features/projects/server/move-column.ts` takes exactly
`{ columnId, targetColumnId, placement }` and derives the key itself. `column-input.ts` already
exports `parsePlacement` returning `"before" | "after" | null`.

**Rationale**: the first Clarification, FR-031, Principle II and change gate 3. A client-supplied
index decides where a row lands and is trivially forged. Deriving it from rows read inside the write
is also the only shape that satisfies FR-055 — a drop that resolves against neighbours read at write
time is correct however stale the client's board was.

**Why `targetIssueId: null` rather than a `"head" | "foot"` placement member**: it keeps `placement`
identical to R9's two-valued parser, and the four cases (before a card, after a card, head of lane,
foot of lane) fall out of two fields instead of a three-valued enum crossed with an optional id. One
parser is reused rather than a second one written (I, III).

### B-2 — Exactly four returned outcomes, and a malformed payload is folded into them

**Decision**:

```text
{ ok: true }
{ ok: false; error: "not_found" }
{ ok: false; error: "invalid_target" }
{ ok: false; error: "forbidden" }
{ ok: false; error: "no_index_available" }
```

An unparseable `issueId` raises Next.js's `notFound()` before anything returns, exactly as
`moveColumn` does with an unparseable `columnId`. An unparseable `grouping`, `laneId` or `placement`
returns `invalid_target`.

**Rationale**: the second Clarification and FR-041 fix the outcome set at four and require each to
carry its own message. R9's `MoveColumnState` carries a fifth, `invalid_input`; adding it here would
contradict FR-041's enumeration. `invalid_target` is the honest home for a payload whose *target* is
not something a drop can land on, which is what a malformed grouping or placement is. `not_found` is
reserved for a row that genuinely does not exist (`OT-UX-004`, FR-069) and must not be spent on
malformed input, which would tell the user something vanished when nothing did.

**Alternatives rejected**: a fifth `invalid_input` (contradicts FR-041); one generic refusal (FR-041
requires four distinct messages); throwing (`AGENTS.md` — expected failures are typed results).

### B-3 — Row before role, then target: the refusal order is fixed

**Decision**, in order:

1. parse `issueId`; unparseable → `notFound()`
2. load the issue row; absent → `not_found`
3. derive the project **from that row**; `isMember(actor, projectId)` false → `forbidden`
4. resolve the lane under the grouping → `not_found` or `invalid_target`
5. splice and generate the key → `no_index_available`

**Evidence**: `move-column.ts` resolves the row, then `isAdmin`, then the target.
`update-issue.ts` resolves the issue, then the project, then `isMember`.

**Rationale**: FR-034 is explicit — an issue nobody can find is "This doesn't exist", never a
permission refusal, because every issue is readable by every signed-in user (`OT-AUTHZ-005`,
FR-002). FR-033 requires the project be derived server-side from the stored row; the call accepts no
project field at all, which is also how FR-036 is satisfied structurally rather than by a check.

### B-4 — What each grouping validates, and where the vanished/illegal split falls

**Decision**:

| `grouping` | lane value | vanished → `not_found` | exists but illegal → `invalid_target` |
| --- | --- | --- | --- |
| `column` | a `board_column.id` | no such column row anywhere | the column belongs to another project |
| `assignee` | a `user.id`, or `null` for **Unassigned** | no such user, and not assigned here | outside `listAssigneePool` — deactivated, or a non-member still assigned here |
| `priority` | one of the five literals | — | anything `parsePriority` refuses |

**Evidence**: `move-column.ts` performs exactly this two-step probe — miss the project's locked set,
then re-select by id alone to tell "vanished" from "another project's". `issue-queries.ts` already
exports `listAssigneePool(projectId)`, whose SQL is `deactivated_at IS NULL AND (role = 'admin' OR
EXISTS project_member)` — precisely FR-037's pool. `input.ts` already exports `parsePriority`.

**Rationale**: FR-034, FR-035, FR-037, `OT-INV-004`. The composite foreign key
`issue_project_id_column_id_fk` on `(project_id, column_id)` already makes a cross-project column
impossible at the database, but the explicit check is what produces the *distinct* `invalid_target`
outcome FR-035 requires instead of an opaque `23503`.

A person outside the pool but still assigned here gets `invalid_target`, not `not_found`: they exist
and they hold a lane on this board (FR-018), the lane simply cannot be written into (FR-037). That is
"exists but is not legal" by FR-035's own definition. A person who is neither in the pool nor
assigned here is `not_found`, which is what FR-034's second sentence names.

### B-5 — Lock the subject row, never the lane — FR-057 forbids the lane lock

**Decision**: `SELECT … FROM issue WHERE id = ? FOR UPDATE` on the moved row only. The lane's other
issues are read without a lock, inside the same transaction.

**Evidence**: `update-issue.ts` line 68 already takes `FOR UPDATE` on exactly that row.

**Rationale**: FR-057 — "There MUST be no locking … the last `moveIssue` to reach the server MUST win
outright … never from a rejected write" — and SC-007. Locking the lane would serialize two drops of
different cards into one lane for no invariant, and any `FOR UPDATE`-plus-recheck pattern is one step
from rejecting a stale caller, which FR-057 forbids outright. Locking the single row being written is
not that: it makes this row's read-modify-write atomic against a concurrent `updateIssue` on the same
issue, and the later writer still wins and is still not rejected.

This is the deliberate opposite of R9's `deleteColumn`, which locks the project's whole column set
because it has four invariants to enforce. `moveIssue` has none: FR-028 writes one row, and the
board's correctness under concurrency is "last write wins", not "no lost update".

**Alternatives rejected**: `FOR UPDATE` over the lane (serializes drops, buys nothing, risks
violating FR-057); optimistic concurrency on `updated_at` (a rejected write is exactly what FR-057
and SC-007 forbid); an advisory lock per lane (same objection, plus machinery for an invariant that
does not exist — III).

### B-6 — One row written, one further field at most, and a no-op writes nothing

**Decision**: after the splice, if the moved card's position in the reordered lane equals its
original position **and** the grouping's field is unchanged, return `{ ok: true }` having written
nothing and having created no activity row. Otherwise write one `UPDATE issue SET sort_order = …
[, column_id | assignee_id | priority = …], updated_at = …` on the moved row and nothing else.

**Evidence**: `move-column.ts` lines 100–103 return early on exactly this comparison.
`update-issue.ts` builds a `fields` object and returns `{ status: "ok" }` when it is empty.

**Rationale**: FR-028, FR-029, FR-030, FR-032, SC-002, SC-004. The mutator computes for itself
whether the drop crossed lanes by comparing the lane value against the stored row — the client does
not tell it, so a client claiming a cross-lane drop that is not one cannot make it write a field.

### B-7 — `updated_at` through `touched()`, activity through `writeActivity`, both in the one transaction

**Decision**: `touched({ … })` on the update (FR-038); one `writeActivity(tx, { type: "field_changed",
target: { issueId }, field, fromValue, toValue })` in the same `db.transaction` (FR-060).

**Evidence**: `src/db/touched.ts` is a two-line helper already used by every mutator.
`write-activity.ts` already admits `"field_changed"` in its `ActivityType` union, and
`schema.ts`'s `activity_type_valid` CHECK already lists it.

**Consequence, and it is the headline one: this feature widens no enumeration, adds no activity type
and needs no migration.** FR-063 predicted this and the schema confirms it. Contrast R9, which had to
widen the CHECK by four values and ship `drizzle/0007_*.sql`. **`drizzle/` gains no file.**

### B-8 — The activity row's shape is copied from `updateIssue`, not invented

**Decision**: `field` holds the literal `"column"`, `"priority"` or `"assignee"`; `from_value` and
`to_value` hold frozen display strings through `truncateActivityValue`; a drop into **Unassigned**
writes `to_value: null`.

**Evidence**: `update-issue.ts` lines 179–214 already build exactly these three diffs — `"priority"`
with the raw enum value, `"assignee"` with `` `${firstName} ${lastName}` ``, `"column"` with the name
resolved through `listProjectColumns`. `activity-row.tsx` renders a null through
`displayOrNone(value)` where `NONE_LABEL = "None"`, which is the third Clarification's requirement
already satisfied by code that exists.

**Rationale**: the third Clarification — a drop is the same change made by another gesture, so it
writes the shape that already exists rather than a second one. `src/features/activity/server/frozen-vs-live.test.ts`
already guards the frozen-value rule.

**No shared "diff builder" is extracted.** `updateIssue` resolves up to six diffs in one batched
`inArray` read; `moveIssue` resolves exactly one, and only on a cross-lane drop. Extracting a common
helper would fit neither call site without a parameter that switches between them — the abstraction
Principle I says to wait for. What *is* reused is what already exists and already has two callers:
`listProjectColumns` for a column's name and `displayName` from `src/lib/display-name.ts` for a
person's.

### B-9 — A reorder writes no activity, and no card move writes to the project's feed

**Decision**: the `writeActivity` call sits inside the same branch that writes the grouping field. A
same-lane reorder never reaches it. `target` is always `{ issueId }`, never `{ projectId }`.

**Rationale**: FR-061, FR-062, FR-064, SC-014. `activity_target_exactly_one` makes the second half
structurally true, but the code says `{ issueId }` because that is the requirement, not because a
CHECK would catch the mistake.

### B-10 — The Server Action goes into `src/features/issues/actions.ts`, not a new module

**Decision**: `moveIssue` is exported from the existing `src/features/issues/actions.ts`, following
its established preamble — `assertSameOrigin({ headers: await headers() })`, then `requireActor()`,
then the mutator.

**Rationale**: `AGENTS.md` requires a dedicated module carrying top-level `"use server"`, not a
dedicated module *per action*. `issues/actions.ts` is 103 lines with three actions; a fourth leaves
its intent obvious. R9 split `column-actions.ts` out of `projects/actions.ts` for the opposite
reason, stated in its own plan: that file was already 240 lines with six actions. Same rule, opposite
answer, because the input differs.

**No `revalidatePath` and no `refresh()` on a successful move.** `updateIssue` calls `refresh()`
because the issue rail's server data must catch up. Here the board is already showing the optimistic
result and FR-054's own re-query is what reconciles it; a server refresh on every drop would fight
the overlay FR-056 requires be preserved, and would re-render the whole board mid-gesture.

---

## C. Drag and drop

### C-1 — React Aria's `useDragAndDrop`, already installed, already in use. Zero new dependencies

**Decision**: `useDragAndDrop` from `react-aria-components@1.20.0`, imported on the subpath this
codebase uses (`react-aria-components/useDragAndDrop`).

**Evidence**: verified present in the installed tree at
`node_modules/react-aria-components/dist/types/exports/useDragAndDrop.d.ts`, and already imported by
`src/features/projects/components/columns-section.tsx`, which R9 shipped.

**Rationale**: FR-044 does not leave this open — the drag's interaction behaviour, focus management,
keyboard support and ARIA semantics "MUST come from React Aria's own drag and drop". Principle IV
would reach the same answer unaided: a drag-and-drop library is absent from `AGENTS.md`'s approved
table, so `@dnd-kit`, `react-beautiful-dnd`, `dnd-kit/sortable`, `sortablejs` and every equivalent
are barred without a recorded amendment, and no amendment is warranted because the installed
capability covers the requirement including its keyboard path.

**Hand-building is also rejected**, and separately: `AGENTS.md` permits a hand-built component only
"where React Aria ships no equivalent". It ships one. Reproducing its keyboard drag mode, its live
announcements and its drop-target semantics by hand would be a worse copy of installed code.

### C-2 — One `GridList` per lane, and cross-lane drops arrive through `onInsert` / `onRootDrop`

**Decision**: each lane renders its own `GridList` with its own `dragAndDropHooks`. The three
handlers map to the three drop shapes:

| handler | gesture | resulting call |
| --- | --- | --- |
| `onReorder` | dropped between cards **in its own lane** | same lane, `targetIssueId` from `target.key`, `placement` from `target.dropPosition` |
| `onInsert` | dropped between cards in **another** lane | that lane's id, same target/placement |
| `onRootDrop` | dropped on an **empty** lane | that lane's id, `targetIssueId: null`, `placement: "after"` |

`getItems` serializes the dragged issue's id under a board-specific drag type; the receiving lane
reads it from `e.items` and knows its own lane from its props. `acceptedDragTypes` is set to that one
type so nothing else on the page — or dragged in from outside the browser — can land on a lane.

**Evidence**: read from the installed typings. `DroppableCollectionUtilityOptions` in
`node_modules/@react-types/shared/src/dnd.d.ts` declares `onInsert`, `onRootDrop`, `onItemDrop`,
`onReorder`, `acceptedDragTypes` and `shouldAcceptItemDrop`; `getDropOperation` is on
`DroppableCollectionBaseProps`. `DroppableCollectionInsertDropEvent` carries
`target: ItemDropTarget` with `{ key, dropPosition }`; `DroppableCollectionRootDropEvent` carries no
target at all, which is why an empty lane's drop is a foot drop.

**Rationale**: R9 needed only `onReorder` because a single list reorders within itself. A board is
many lanes and every drop that matters crosses one, so `onInsert` and `onRootDrop` are not optional
extras — without `onRootDrop` an empty lane could not be dropped into, and FR-008 renders empty lanes
on every board.

### C-3 — A lane that accepts no drop refuses it in the hook, and the server refuses it again

**Decision**: a lane whose person is outside the assignee pool returns `"cancel"` from
`getDropOperation`. A non-member's board passes `dragAndDropHooks: undefined` to every lane, so no
drag begins at all.

**Evidence**: `columns-section.tsx` already uses the second pattern —
`dragAndDropHooks={admin ? dragAndDropHooks : undefined}` — for exactly the same purpose.

**Rationale**: FR-037 and US3 scenario 12 for the first; FR-065 and US6 scenario 2 ("no drag begins
and no call is made") for the second. Both are affordances only: FR-065 is explicit that the server
check is the enforcement and never the reverse, so `moveIssue` refuses the same two cases
independently (B-4's `invalid_target`, B-3's `forbidden`) whatever the client rendered. SC-011's
"including one issued without going through a control" is tested against the mutator, not the
component.

### C-4 — Keyboard, verified with explicit key events

**Decision**: each card carries a `Button slot="drag"`, as `columns-section.tsx`'s rows do, which is
what gives `useDragAndDrop` its keyboard entry point. Every lane's `GridList` carries an
`aria-label` naming the lane, so every drop target has an accessible name.

**Rationale**: FR-043, SC-015. `@react-aria/test-utils` is not installed and `AGENTS.md` says adding
it needs approval under IV; R9 tested the same gesture with explicit keyboard events and this feature
follows that precedent rather than adding a dependency.

---

## D. The board's read, its optimism and its freshness

### D-1 — The overlay is explicit state, not `useOptimistic`

**Decision**: the board holds `pendingMoves`, a map from issue id to the drop that is in flight for
it, and derives what it renders by replaying those drops over the newest server rows. It does **not**
use `useOptimistic`.

**Rationale**: this is the one place the requirements rule out the pattern the rest of the codebase
uses. `useOptimistic` discards its overlay when the surrounding transition settles and re-derives
from the passed value on every render of new server data — which is precisely what FR-056 forbids:
"A re-query MUST NOT overwrite the caller's own in-flight optimistic drop with older data." A
re-query landing before the caller's own write returns would drop the card back and then jump it
forward again.

Replaying pending drops over fresh rows satisfies three requirements with one mechanism:

- **FR-055** — a re-query mid-drag updates the board underneath the drag, because the server rows
  change and the replay runs against the new ones.
- **FR-056** — the caller's own in-flight drop survives, because it is replayed after the fresh rows
  land and is removed only when its own call settles.
- **FR-059** — unchanged data replays to an identical result, so nothing shifts.

**Evidence**: `columns-section.tsx` already uses an explicit overlay
(`reorderedColumns ?? columns`) with a render-phase reconciliation rather than `useOptimistic`,
so the shape has a precedent here. R9's version clears the overlay on **every** server update, which
is correct for a column reorder and would violate FR-056 on a board; the board's version keys the
overlay by issue id and clears one entry when that entry's call settles.

**Alternatives rejected**: `useOptimistic` (FR-056, above); freezing the board during a drag (FR-055
requires the opposite); a client cache keyed by grouping (FR-058 — nothing renders from a client
cache on a revisit).

### D-2 — The splice and the replay are pure functions in their own module, and they are where the tests bite

**Decision**: `src/features/board/lane-model.ts` holds, with no React and no imports from the server:
grouping a project's cards into lanes under each of the three groupings; the `(sort_order, id)`
comparator; the splice that produces a lane's order after a drop; and the replay of pending drops
over fresh rows.

**Rationale**: Principle I — the board screen otherwise owns rendering, grouping, drag wiring,
polling and optimism at once. It is also the honest answer to VII: jsdom cannot perform a pointer
drag, so a test that proves FR-055, FR-056 and FR-025 through the DOM would be testing the harness.
These are pure data transforms with exact expected outputs, and SC-003, SC-005, SC-006 and SC-009 are
all statements about them.

The same splice logic exists **twice on purpose** — once here for the render, once in `moveIssue` for
the write — and it is not extracted into a shared module, because one runs in the browser over DTOs
and the other runs inside a transaction over rows, and `src/features/board/` may not import from a
`server/` directory nor the reverse. The contracts say what each must produce; the tests assert the
two agree (SC-003 re-reads the board's own ordering rather than trusting the optimistic render).

### D-3 — Freshness is `router.refresh()` on an interval and on focus

**Decision**: `board-screen.tsx` sets a 30-second interval that calls `router.refresh()` only while
`document.visibilityState === "visible"`, and a `focus` listener that refreshes immediately. Both are
torn down on unmount.

**Rationale**: FR-054, and the last Edge Case — "A window that never regains focus still re-queries
on the thirty-second interval only while the board is the active tab."

**A note a reviewer will want.** `src/features/activity/no-polling.test.ts` asserts that three named
files issue no `setInterval`, `setTimeout`, `requestAnimationFrame` or `poll`: the feed component and
the project-details and issue-details pages. R7's rule is feed-scoped (`FR-036`, `OT-UX-006`) and its
test names its three files explicitly. The board's timer lives in
`src/features/board/components/board-screen.tsx`, which is not among them, and FR-054 mandates it.
**That test is left exactly as it is** — extending its file list would be adjacent code this feature
was not asked to touch (gate 7), and narrowing it would weaken a guard R7 owns.

### D-4 — The board route is already dynamic, and nothing needs a cache directive

**Decision**: the page stays a Server Component that awaits `params`, calls `requireActor()` and
loads the board. No `revalidate`, no `dynamic`, no `unstable_cache`.

**Rationale**: `requireActor()` reads `cookies()`, which makes the route dynamic on every request, so
FR-058's "nothing renders from a client cache on a revisit" holds without a directive. Every existing
project-scoped page in this tree is built the same way.

### D-5 — `loadBoard` is a fixed number of queries, and the count moves with the overlay

**Decision**: one server function, `loadBoard(projectKey, actor)`, issuing a fixed set of queries —
the project, its columns, its issues in `(sort_order, id)`, the labels on those issues, a
`GROUP BY issue_id` comment count, the assignee pool, and the still-assigned people outside it. No
per-card query and no per-lane query.

A **lane's count is computed from the cards it renders**, not fetched, so an optimistic drop moves
both counts at once (FR-009) and a refused drop moves them back.

**Rationale**: FR-009, FR-010, the "lane holding hundreds of cards" edge case, and SC-002's census.
`comment_issue_id_created_at_idx` serves the comment count's `GROUP BY`; `issue_label`'s
`(issue_id, label_id)` primary key serves the label join. No index is needed (A-5).

### D-6 — Grouping is `useState` in the client component and reaches neither the URL nor the database

**Decision**: `const [grouping, setGrouping] = useState<Grouping>("column")`. No `searchParams`, no
second route, no cookie, no `user` column.

**Rationale**: FR-020 and the fifth Clarification, which settle both halves — §5 enumerates every
field of every table and carries none for this, while it carries `feed_filter` explicitly for the
toggle that *is* remembered. A `?group=` parameter is a board URL the specification never describes,
and FR-001 admits one board route.

### D-7 — A deleted card, a deleted lane and a lost connection

**Decision**: a re-query that no longer carries a card drops it from the board silently, and its
pending move is discarded (US5 sc.8, the mid-drag edge case). A `moveIssue` promise that **rejects**
— rather than resolving to a refusal — rolls back and toasts the connection message, queueing
nothing (FR-045).

**Evidence**: `columns-section.tsx` already passes a second, rejection handler to its `.then(…, …)`
for exactly this, with a distinct message.

---

## E. Structure and reuse

### E-1 — The mutator lives with the issues, the screen lives in a new `src/features/board/`

**Decision**:

- `moveIssue` → `src/features/issues/server/move-issue.ts`, its action in `src/features/issues/actions.ts`.
- the board screen and its components → a new `src/features/board/`.

**Rationale**: these look inconsistent and are not. `moveIssue` is an issue mutator: it writes the
`issue` table, sits beside `createIssue`, `updateIssue` and `deleteIssue`, and reuses
`listAssigneePool`, `listProjectColumns` and `parsePriority` from `issues/server/`. Putting it under
`src/features/board/server/` would split one table's write surface across two directories — the exact
objection R9 recorded when it kept the column mutators in `src/features/projects/`.

The **screen** is the opposite case: a route, a header control, seven components and a read that
belongs to none of the three features it draws from. Hanging it off `src/features/issues/` would make
that directory own a project-scoped screen; hanging it off `src/features/projects/` would put a
board next to `project-details-screen.tsx` with no relationship but the URL. `AGENTS.md` says
business behaviour lives in `src/features/<feature>/` and the board is a feature.

### E-2 — Three existing files are edited, each because a requirement forces it

| file | edit | forced by |
| --- | --- | --- |
| `src/app/(app)/projects/[projectKey]/page.tsx` | the `notFound()` placeholder is replaced by the board | FR-001 |
| `src/features/projects/components/project-header.tsx` | one `control` prop, forwarded to `ScreenHeader` | FR-004, FR-005 |
| `src/features/issues/components/create-issue-form.tsx` | optional initial title, column, assignee and priority | FR-048 |
| `src/app/(app)/projects/[projectKey]/issues/new/page.tsx` | reads `searchParams` and passes validated preselections | FR-048 |
| `src/features/issues/actions.ts` | the `moveIssue` action | FR-028 |

`ScreenHeader` **already** declares a `control?: ReactNode` slot and renders it — R2 built the slot
and nothing has used it yet. `ProjectHeader` simply does not forward it. One prop is the whole edit;
the header contract is not changed (FR-004: "MUST add nothing to that header but its one per-screen
control").

### E-3 — The chevron's preselection is validated on the server, not trusted from the query string

**Decision**: the Create issue page reads `searchParams`, and passes a value through to the form only
when it is one the project actually admits — the column must be in `listProjectColumns`, the assignee
in `listAssigneePool`, the priority one `parsePriority` accepts. Anything else is dropped and the
form renders its own default.

**Rationale**: Principle II and change gate 3 — query parameters are named explicitly among the entry
points that must validate on the server. `createIssue` re-validates all four on submit regardless
(`create-issue.ts` lines 85–116), so this is not the security boundary; it is FR-051's sibling
requirement that input which fails validation is rejected rather than silently rendered. A
`?columnId=` naming another project's column must not appear preselected in this project's form.

### E-4 — What is reused rather than rebuilt

`listProjectColumns`, `listAssigneePool`, `parsePriority`, `parseTitle` (R6) · `parsePlacement`,
`parseColumnId` (R9's `column-input.ts`) · `isMember` (R5) · `writeActivity`,
`truncateActivityValue` (R7) · `touched`, `db` (R1) · `showToast` and `ToastRegion` (R2) ·
`displayName` (`src/lib/`) · `formatIssueKey` (R6, FR-012 — the key is not recomputed here) ·
`generateKeyBetween`. Nothing in that list is copied, wrapped or re-implemented.

### E-5 — What is deliberately not built

No `src/components/ui/` (still not created — no primitive here has a second call site) · no shared
"board service" between the components and the database · no `deleteIssue` path, no inline field
control on a card, no column editing, no label editing (all named in the spec's *Out of Scope*) · no
notification row of any kind, which is R11's, and **no seam left for it** — R11 will add its
recipient computation to `moveIssue`'s transaction when it lands, and a hook placed now for a caller
that does not exist is dead surface (VI) and speculative machinery (III).

---

## F. Testing

### F-1 — Persistence, refusals and concurrency run against real PostgreSQL

**Decision**: every `moveIssue` test is a `server`-project Vitest test against `TEST_DATABASE_URL`.

**Evidence**: `vitest.config.mts` declares two projects — `server` (node, `fileParallelism: false`,
`globalSetup: ./src/db/test-setup.ts`) and `ui` (jsdom, `@testing-library/react`).
`src/db/test-database.ts`'s `TRUNCATED_TABLES` already lists `issue`, `activity`, `board_column`,
`project_member`, `project`, `user`, `label` and `issue_label`, so **no test-harness file needs
editing.**

**Rationale**: `AGENTS.md` — invariants are enforced by constraints and row locks, which a mock
cannot verify. SC-002's census, SC-005's hundred drops, SC-007's two conflicting writes and SC-014's
activity assertions are all statements about database state and are asserted against it.

### F-2 — The Red step for the tie case comes before the `try`

**Decision**: the first test written for A-3 inserts two issues holding an **identical** `sort_order`,
drops a third between them, and observes the raw `generateKeyBetween` throw escaping `moveIssue`
before the `try/catch` exists. Only then is the mapping to `no_index_available` written.

**Rationale**: gate 1 and Principle VII — the test must be observed failing *for the intended
reason*. A test written after the `try` would pass on its first run and, per `AGENTS.md`, would not
be a valid Red step.

### F-3 — SC-002's census is the shape of the ordering tests

**Decision**: the drop tests read every issue's `sort_order` in the project before and after, and
assert exactly one changed. Not "the moved one is where I expect".

**Rationale**: SC-002 and SC-005 say so in those words, and it is the only assertion that catches an
accidental renumbering — the failure `OT-DATA-017` exists to prevent.

### F-4 — What jsdom can prove, and what it cannot

**Decision**: `ui` tests cover the card face and its unset fields (FR-010), the empty lane's line and
its composer (FR-008), the disabled composer and its reason for a non-member (FR-052), the three
groupings' lane sets and order (FR-017, FR-018, FR-019), the grouping control's three options
(FR-015), skeletons (FR-007), and the absence of `dragAndDropHooks` for a non-member (US6 sc.2).
Drop *behaviour* — FR-055, FR-056, FR-025, SC-003, SC-006, SC-009 — is proven against
`lane-model.ts`'s pure functions and against the mutator, not through a simulated pointer drag.
Keyboard order is verified with explicit key events (C-4).

**Rationale**: `AGENTS.md` — query by role, label and visible text before `data-testid`; avoid
snapshots as the only proof of interactive behaviour; `@react-aria/test-utils` is not installed and
is not added.

### F-5 — Read-boundary and parity tests follow the precedent already in the tree

**Decision**: SC-012's "renders identically for a member and a non-member" is a test comparing the two
rendered lane-and-card structures, following
`src/features/issues/components/issue-detail-parity.test.tsx`. SC-011's write boundary follows
`src/features/projects/column-write-boundary.test.ts`.

---

## Unknowns

**None.** Every dependency of this feature is implemented on this branch and was read, not assumed.
No task in `tasks.md` will need to be marked blocked, and no NEEDS CLARIFICATION survives into
`plan.md`.

## One question this plan raises but does not answer

`package.json` carries **`clsx@^2.1.1`** as a runtime dependency. It is **not** on `AGENTS.md`'s
approved-dependency table, which that file says "is the complete set: anything absent needs its own
approval, recorded here by amendment before it is installed." This predates R10 — it is imported by
`src/app/components/common/logo.tsx` and
`src/features/auth/components/primary-button-classes.ts`, neither of which this feature touches, and
nothing here adds, removes or relies on it. It is recorded because a
reviewer applying change gate 4 to this diff will read that table, and should know the discrepancy is
inherited rather than introduced. Resolving it — an amendment recording the approval, or removing the
package — is not this feature's work and no task here does it.
