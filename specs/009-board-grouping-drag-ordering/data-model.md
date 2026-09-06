# Phase 1 — Data model: Board — grouping, drag and ordering

**Feature**: `specs/009-board-grouping-drag-ordering` | Companion to
[`research.md`](./research.md) and [`contracts/`](./contracts/).

## The schema change

**There is none.**

No table is added. No column is added. No `CHECK` is widened. No index is added. No enumeration gains
a value. `drizzle/` gains no file and `src/db/schema.ts` is not edited.

This is not an ambition; it is what the tree says. Each row below was verified against
`src/db/schema.ts` on this branch.

| What this feature needs | Where it already is |
| --- | --- |
| a project-wide fractional ordering index on an issue | `issue.sort_order`, a `customType` rendering `text collate "C"`, written by R6's `createIssue` |
| the field a Column drop writes | `issue.column_id`, with `issue_project_id_column_id_fk` on `(project_id, column_id)` |
| the field an Assignee drop writes | `issue.assignee_id`, nullable, `references user.id` |
| the field a Priority drop writes | `issue.priority`, guarded by `issue_priority_valid` over the five literals |
| the activity type a cross-lane drop writes | `'field_changed'`, already in `activity_type_valid` |
| the activity row's value bound | `activity_from_value_length` / `activity_to_value_length`, both `<= 200` |
| the lanes under Column grouping | `board_column`, R5's table, R9's editing |
| the assignee pool | `project_member` + `user.role = 'admin'`, `user.deactivated_at IS NULL` |

FR-020 requires that no field exist for the grouping choice and that this feature add none: none
exists on `user` and none is added (`user.feed_filter` is R7's, for a different toggle, and is not
extended). FR-027 requires no new ordering column: none is added. FR-063 requires no widened
enumeration: none is widened.

## Invariants this feature relies on and does not restate in code

| # | Invariant | Enforced by |
| --- | --- | --- |
| 1 | An issue's column belongs to the issue's own project | `issue_project_id_column_id_fk`, a composite FK — the database refuses a cross-project `column_id` outright. `moveIssue` checks it *as well*, to return FR-035's distinct `invalid_target` rather than an opaque `23503` |
| 2 | An issue never changes project | `moveIssue` accepts no project field at all (FR-036) — structural, not checked |
| 3 | A priority is one of five | `issue_priority_valid`, plus `parsePriority` at the boundary |
| 4 | An activity row targets an issue **or** a project, never both and never neither | `activity_target_exactly_one`; this feature always passes `{ issueId }` (FR-062) |
| 5 | An activity row is never updated and is deleted only by cascade from its issue | `activity.issue_id … onDelete: "cascade"`; this feature ships no path that edits or deletes one (FR-064) |
| 6 | Ordering ties are legal and are never repaired | nothing enforces this — it is enforced by the **absence** of any renumbering path (FR-024, SC-005) |

## Ordering

One index per issue, project-wide (FR-022). Every ordered read in this feature is

```text
ORDER BY sort_order, id
```

in SQL, with no secondary sort and no client-side re-sort (FR-023). Because `id` is UUIDv7, the
tie-break is creation order.

A lane is that one sequence, filtered — never a sequence of its own. A key generated strictly between
two lane neighbours therefore also sits between them in the project sequence, which is why FR-025's
consequence (a reorder under one grouping moves the card under the others) is arithmetic rather than
a defect, and why nothing compensates for it.

**The only writes to `issue.sort_order` in the product after this feature:**

| writer | when | rows touched |
| --- | --- | --- |
| `createIssue` (R6, unchanged) | a new issue, from either creation path | 1 — the new row, `generateKeyBetween(highest, null)` |
| `moveIssue` (this feature) | one accepted drop that is not a no-op | 1 — the moved row |

Nothing else. No backfill, no reseed, no rebalance, no repair (FR-026, FR-024).

## DTOs

Database rows never cross the boundary (`AGENTS.md` → TypeScript). `src/features/board/server/board-queries.ts`
returns the shapes below and nothing wider — no `sort_order` reaches the client, because no client
computes an index (FR-031), and no `project_id`, because the route already fixes the project.

```text
BoardCard
  id            string
  key           string          formatted by R6's formatIssueKey — not recomputed here (FR-012)
  title         string
  columnId      string
  assigneeId    string | null
  priority      "none" | "low" | "medium" | "high" | "urgent"
  dueDate       string | null
  labels        { id, name }[]  name only — no colour, no swatch (FR-011)
  assignee      { id, firstName, lastName, avatarUrl } | null
  commentCount  number
  order         number          the card's rank in the project sequence; see below

BoardLane
  id            string | null   column id · user id · priority literal · null for Unassigned
  name          string
  canAcceptDrop boolean         false for a person outside the assignee pool (FR-037)
  refusalReason string           rendered inline on that lane's composer (FR-052)

BoardView
  project       { id, key, name, status }
  columns       { id, name }[]  board order — the lanes under Column grouping (FR-016)
  cards         BoardCard[]     in (sort_order, id) order, the whole project (FR-022)
  assigneePool  { id, firstName, lastName, avatarUrl }[]
  assignedOutsidePool { id, firstName, lastName, avatarUrl }[]   still assigned, not in the pool (FR-018)
  canWrite      boolean
  writeReason   string
```

### Why `order: number` and not `sortOrder: string`

The client needs to keep the cards in one stable sequence and to splice a card into a new position
optimistically. It does **not** need the index's value, and giving it one invites the mistake FR-031
exists to prevent — a client that holds a `sort_order` string is one refactor away from sending one
back. `order` is the card's zero-based rank in the already-sorted `cards` array, produced by the
server; the client reorders ranks and never computes a key. A drop is expressed as neighbour ids and
a placement, exactly as it is sent.

`canAcceptDrop` and `refusalReason` are computed on the server for the same reason the mutator
re-checks them: FR-065 makes the client's copy an affordance and the server's the enforcement.

## Lanes, by grouping

| grouping | lanes | order | `canAcceptDrop` |
| --- | --- | --- | --- |
| **Column** (default) | the project's own `board_column` rows | board order — `(sort_order, id)` (FR-016) | always true |
| **Priority** | exactly five | Urgent, High, Medium, Low, No priority (FR-017) | always true |
| **Assignee** | **Unassigned**, then the assignee pool, then anyone still assigned here who is outside it | Unassigned first (FR-019); then each people group by `lower(last_name), lower(first_name)`, which is `listAssigneePool`'s own ordering and the only ordering the product has for people, with the third group its own block after the pool rather than interleaved with it (FR-018) | true for Unassigned and for the pool; **false** for the third group (FR-037) |

The third Assignee group is not only deactivated users. `listAssigneePool` excludes anyone who is
neither an admin nor a `project_member` row, so a member removed from the project while still holding
issues here lands there too. FR-018 gives them a lane so no card is homeless; FR-037 refuses a drop
into it because they are not someone `moveIssue` may write. US3 scenario 12 names the deactivated
case; the rule is the pool, not the deactivation. The read for it carries the same `ORDER BY` as
`listAssigneePool` rather than a second ordering rule, so `assigneePool` and `assignedOutsidePool`
both arrive ordered and `lanesFor` sorts neither.

Every lane shows its name and the count of cards **currently rendered** in it (FR-009) — computed
from the rendered set, not fetched, so an optimistic drop moves both lanes' counts and a rollback
moves them back.

## The activity row a cross-lane drop writes

One row, in the move's own transaction, through R7's `writeActivity` (FR-060). Nothing else is
written and no row goes to the project's feed (FR-062).

| grouping | `type` | `field` | `from_value` | `to_value` |
| --- | --- | --- | --- | --- |
| Column | `field_changed` | `column` | the old column's **name** | the new column's **name** |
| Priority | `field_changed` | `priority` | the old priority literal | the new priority literal |
| Assignee | `field_changed` | `assignee` | the old assignee's display name, or `null` | the new assignee's display name, or `null` for **Unassigned** |

Values are frozen display strings, not ids, and pass through `truncateActivityValue` (200
characters). A `null` renders as the literal `"None"` — `activity-row.tsx` already does this through
`displayOrNone`, so nothing in R7 is edited.

**A same-lane reorder writes no row at all** (FR-061): the ordering index is not among the scalars
`field_changed` names, and card position is not part of an issue's history. **A no-op drop writes
neither the issue row nor an activity row** (FR-032).

This is the identical shape `updateIssue` writes for the same three fields (R7, FR-056/FR-007/FR-030
of `specs/007-comments-activity-feeds`), so a column change made by dragging and one made from the
issue rail are indistinguishable in the feed — which is the point.

## Reach-back this feature accepts but does not build

R11 will add the `assignment` notification to `moveIssue`'s transaction, for a cross-lane drop under
Assignee grouping that sets `assignee_id` to somebody other than the actor (`OT-OPS-016`). This
feature writes **no** notification row and leaves **no** hook, parameter or extension point for one:
a seam built for a caller that does not exist is dead surface (VI) and speculative machinery (III).
R11 edits `move-issue.ts` when it lands, exactly as this feature edits R6's files where a requirement
forces it.
