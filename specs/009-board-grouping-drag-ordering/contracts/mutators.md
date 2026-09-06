# Contract — mutators

**Feature**: `specs/009-board-grouping-drag-ordering`

This feature delivers **one** new mutator. It adds callers to one existing mutator and changes it in
no way.

---

## `moveIssue` — new

`src/features/issues/server/move-issue.ts`, reached through the Server Action exported from
`src/features/issues/actions.ts`.

### Input

```text
MoveIssueInput = {
  actor:         Actor
  issueId:       unknown
  grouping:      unknown    "column" | "assignee" | "priority"
  laneId:        unknown    column id · user id · priority literal · null for Unassigned
  targetIssueId: unknown    the card dropped before or after — null for the lane's head or foot
  placement:     unknown    "before" | "after"
}
```

Every field is `unknown` and parsed at the boundary (II, gate 3). There is **no** `sortOrder` field,
**no** `projectId` field and **no** `rank` field — not accepted, not optional, not ignored. FR-031
and FR-036 are structural here, not checks.

`targetIssueId: null` with `placement: "before"` is the lane's **head**; with `placement: "after"` it
is the lane's **foot**. Four drop positions from two fields, reusing R9's two-valued `parsePlacement`
rather than declaring a three-valued enum (research B-1).

### Output

```text
MoveIssueState =
  | { ok: true }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_target" }
  | { ok: false; error: "forbidden"; reason: string }
  | { ok: false; error: "no_index_available" }
```

Exactly four refusals, as FR-041 and the second Clarification fix them. `forbidden` carries its
`reason` naming the project, following `updateIssue`'s
`` `Only project members can edit issues in ${projectRow.name}.` `` — FR-041 requires a permission
refusal name the project. The other three are described by the client from the error alone.

There is **no** `invalid_input` member. R9's `MoveColumnState` has one; adding it here would make the
outcome set five where FR-041 enumerates four. A malformed `grouping`, `laneId` or `placement`
returns `invalid_target` (research B-2); an unparseable `issueId` raises `notFound()` before anything
returns, exactly as `moveColumn` does.

### Order of evaluation — fixed, and the order is the requirement

| # | Step | Refusal | Requirement |
| --- | --- | --- | --- |
| 1 | parse `issueId` | `notFound()` | `OT-UX-004` |
| 2 | load the issue row `FOR UPDATE`; derive `projectId` **from it** | `not_found` | FR-034, FR-033 |
| 3 | `isMember(actor, projectId)` | `forbidden` | FR-033, FR-002 |
| 4 | parse `grouping` and `placement` | `invalid_target` | II |
| 5 | resolve the lane under the grouping | `not_found` / `invalid_target` | FR-034, FR-035, FR-037 |
| 6 | read the lane's cards in `(sort_order, id)`, splice, generate the key | `no_index_available` | FR-031 |
| 7 | write, then the activity row | — | FR-028, FR-060 |

**Step 2 before step 3 is not a style choice.** Every issue is readable by every signed-in user
(FR-002), so an issue that cannot be found is "This doesn't exist" and never a permission refusal
(FR-034, `OT-AUTHZ-005`). Reversing them would leak the existence of rows through the difference
between two refusals.

### Step 5 — the lane, per grouping

| grouping | accepted `laneId` | `not_found` when | `invalid_target` when |
| --- | --- | --- | --- |
| `column` | a `board_column.id` in **this issue's project** | no `board_column` row holds that id | a row holds it but in another project |
| `assignee` | a `user.id` in `listAssigneePool(projectId)`, or `null` | no such user, **or** the user exists, is outside the pool, and holds no issue in this project | the user exists, is outside the pool — deactivated, or a non-member — **and** still holds an issue in this project |
| `priority` | one of `none`, `low`, `medium`, `high`, `urgent` | — | anything `parsePriority` refuses |

The column case is R9's exact two-step probe: miss the project's set, then re-select by id alone to
tell a vanished row from another project's (`move-column.ts` lines 77–84). The assignee case applies
the same distinction to people: a person who exists and holds a lane here but is not writable is
"exists but is not legal" (FR-035), while a person who is neither in the pool nor assigned here has
no lane to have vanished from (FR-034).

`laneId: null` under `assignee` is **Unassigned** and clears the field (FR-037). It is a legal
target, not a missing one.

`laneId` is ignored entirely under no grouping — it is required in all three, because all three name
a lane.

### Step 6 — the index, derived from rows read inside the write

```text
lane        = the project's issues whose grouping field equals laneId, ORDER BY sort_order, id
reordered   = lane with the moved card removed, then reinserted per (targetIssueId, placement)
if reordered position == original position AND the grouping field is unchanged → { ok: true }, write nothing
previous    = reordered[i - 1]?.sortOrder ?? null
next        = reordered[i + 1]?.sortOrder ?? null
sortOrder   = generateKeyBetween(previous, next)      throws → { ok: false, error: "no_index_available" }
```

- The lane is read **without** a lock. FR-057 forbids any locking that could reject a stale caller;
  the last write wins outright and neither client is refused (SC-007). Only the moved row is
  `FOR UPDATE`, and only because it is the row being written (research B-5).
- `targetIssueId` naming a card that is **not in this lane** is `not_found` — it vanished from the
  lane between the render and the write, which is exactly the first Edge Case.
- A throw from `generateKeyBetween` means the two neighbours hold **equal** indexes, which FR-024
  declares legal. It is refused, never repaired (research A-3). **No other row is read, written or
  renumbered on this path.**

### Step 7 — the write

One statement, one row:

```text
UPDATE issue
   SET sort_order = <derived>,
       [ column_id | assignee_id | priority = <lane> ]   only on a cross-lane drop
       updated_at = now                                   via touched()
 WHERE id = <issueId>
```

Then, **only on a cross-lane drop**, one `writeActivity(tx, …)` in the same transaction, of the shape
[`data-model.md`](../data-model.md) fixes.

**Guarantees, each testable against the database:**

| Guarantee | Requirement |
| --- | --- |
| exactly one issue row is written per accepted call | FR-028, SC-002 |
| no neighbouring row's `sort_order` is read-modify-written | FR-028, SC-005 |
| `sort_order` is written on every accepted non-no-op call | FR-029 |
| at most one further field, and only the one the grouping names | FR-029, SC-004 |
| a same-lane reorder writes `sort_order` alone | FR-030, SC-004 |
| a no-op writes nothing and creates no activity row | FR-032 |
| the written index sorts strictly between the neighbours under `(sort_order, id)` | FR-031, SC-003 |
| `updated_at` is written explicitly through `touched()` | FR-038 |
| exactly one `field_changed` row on the issue's feed, none on the project's | FR-060, FR-062, SC-014 |
| a reorder writes no activity row | FR-061, SC-014 |
| project status is never a condition — archived projects accept every call | FR-039 |
| a `done`- or `canceled`-kind column is not special; `kind` is never read | FR-040, and the spec's *Out of Scope* |

### The Server Action

`src/features/issues/actions.ts`, following the preamble the three actions there already share:

```text
assertSameOrigin({ headers: await headers() })
const actor = await requireActor()
→ runMoveIssue({ actor, ...payload })
```

**No `refresh()` and no `revalidatePath()` on success.** `updateIssue` calls `refresh()` because the
issue rail's server data must catch up; here the board already renders the optimistic result and
FR-054's own re-query reconciles it. A server refresh per drop would fight the overlay FR-056
requires be preserved (research B-10).

---

## `createIssue` — existing, unchanged, two new callers

`src/features/issues/server/create-issue.ts` is **not edited**. This feature adds callers to it and
changes nothing about its behaviour (FR-026, FR-049).

| caller | passes |
| --- | --- |
| the lane composer under **Column** grouping | `title`, `columnId` = that lane |
| the lane composer under **Assignee** grouping | `title`, `columnId` = the project's **first column by board order**, `assigneeId` = that lane (empty for Unassigned) |
| the lane composer under **Priority** grouping | `title`, `columnId` = the project's first column by board order, `priority` = that lane |

Everything the composer does not set is left to `createIssue`'s own defaults — it already resolves
`columns[0]` when `columnId` is absent, `"none"` for priority and `null` for assignee.

`createIssue` places the new issue after every existing issue in the project
(`generateKeyBetween(highest, null)`), touching no existing row, so it lands last in its lane and
therefore directly above the composer that made it (FR-049, SC-013).

**Not optimistic** (FR-050): the composer shows in-flight state on its control and waits, because the
issue's number is assigned server-side under the `issue_counter` row's update and the card's key
cannot be rendered before it is known.

Title validation is `createIssue`'s existing `parseTitle` — required, trimmed, bounded at 200,
refused rather than truncated (FR-051). The composer's client-side check is an affordance; the server
check is the enforcement (II, FR-065).

### The composer's refusals

`createIssue`'s existing `CreateIssueResult` is used as it stands — no member is added. `forbidden`
already carries a reason naming the project; `invalid` on `title` with `required` or `too-long` is
rendered inline on the field (FR-051), not toasted.

---

## Mutators this feature does **not** touch

`updateIssue`, `deleteIssue` (R6) · `createColumn`, `updateColumn`, `moveColumn`, `deleteColumn`
(R9) · `createLabel`, `updateLabel`, `deleteLabel`, the issue-label writers (R8) · `createComment`,
`updateComment`, `deleteComment` (R7) · every project and membership mutator (R5).

`writeActivity` is **called**, not widened: `"field_changed"` is already in its `ActivityType` union
and already in the `activity_type_valid` CHECK. This feature edits no file under
`src/features/activity/` (FR-063).
