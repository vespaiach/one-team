# Contract — the four column mutators

**Feature**: [`../spec.md`](../spec.md) · **Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md)

Four Server Actions, exported from `src/features/projects/column-actions.ts` (top-level
`"use server"`). Each delegates to one module under `src/features/projects/server/`. Sign-in is the
only mutation in this product that is a Route Handler; these four are Server Actions
(`AGENTS.md` → Next.js 16 and the server boundary).

## The preamble every one of the four runs, in this order

```
1. assertSameOrigin({ headers: await headers() })
2. const actor = await requireActor()
3. resolve the row this call acts on           ← missing ⇒ notFound(), NEVER forbidden   (FR-010)
4. derive projectId from that stored row       ← never from a client argument            (FR-008)
5. if (!isAdmin(actor)) return { ok: false, error: "forbidden" }                          (FR-007)
6. parse and validate every remaining input                              (FR-004, FR-053, II)
7. one db.transaction — the write and its activity row together                    (FR-048, FR-049)
8. refresh() on success                                                                  (FR-012)
```

**Every input is validated at runtime, and the ones that address a row are validated before step 3
reads with them** — a TypeScript union is not runtime validation (`AGENTS.md` → TypeScript, FR-053,
II, gate 3). Per input, for all four:

| Input | Taken by | Validated as | A value that fails |
| --- | --- | --- | --- |
| `projectKey` | `createColumn` | a well-formed project key — `^[A-Z][A-Z0-9]{0,7}$`, the pattern `project_key_pattern` holds | `notFound()` — it can name no project |
| `columnId` | `updateColumn`, `moveColumn`, `deleteColumn` | a well-formed UUID | `notFound()` — it can name no column (FR-010) |
| `targetColumnId` | `moveColumn` | a well-formed UUID | `{ ok: false, error: "not_found" }` — it can name no column, so it is a missing row and never `invalid_target` |
| `placement` | `moveColumn` | exactly `"before"` or `"after"` | `{ ok: false, error: "invalid_input" }` — **never defaulted to `"after"`, never coerced** |
| `name` | `createColumn`, `updateColumn` | `parseColumnName` — trim, then bound at 200 | `{ ok: false, error: "invalid_name" }` (FR-004) |

An identifier is refused **before** it is passed to the database, not after: `board_column.id` and
`project.id` are `uuid` columns, and a malformed value reaching one raises PostgreSQL `22P02`, an
exception crossing the boundary that FR-052 forbids. Refusing it as the missing row FR-010 already
fixes is the explicit rejection II requires — a value that can name no row names none — and it is not
a coercion: nothing is trimmed to fit, defaulted, or partially accepted anywhere in the table above.

**Step 3 precedes step 5.** Every column is readable by every signed-in user, so a row that is not
there is "This doesn't exist", never "you don't have access" (`OT-UX-004`, `OT-AUTHZ-005`, §4).
This is the reverse of `src/features/labels/server/delete-label.ts`'s order, deliberately —
[`../research.md`](../research.md) D-1.

**Membership is never consulted, and neither is `project.status`.** All four remain available on an
archived project (FR-007, third Clarification).

**`kind` is accepted by no mutator, on no call but the create — where it is a literal, not a
parameter.** (FR-002, FR-003, `OT-INV-015`.)

---

## `createColumn`

**Action** `createColumn({ projectKey, name }): Promise<CreateColumnState>`
**Module** `src/features/projects/server/create-column.ts`

```ts
type CreateColumnState =
  | { ok: true; column: ProjectColumnRow }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "invalid_name"; reason: "required" | "too_long" }
  | { ok: false; error: "duplicate_name"; holder: { id: string; name: string } };
```

Row resolved: the project, by `projectKey`, through `loadProjectByKey`. Absent ⇒ `notFound()`.

Transaction:

1. `SELECT sort_order FROM board_column WHERE project_id = $1 ORDER BY sort_order DESC, id DESC LIMIT 1 FOR UPDATE`
2. `INSERT` with `name` (trimmed), `kind: "open"` **as a literal**, `sortOrder: generateKeyBetween(highest ?? null, null)`, `createdAt`, and `touched({})`'s `updatedAt`
3. `writeActivity(tx, { type: "column_added", target: { projectId }, actorId, field: name })`

| Requirement | How |
| --- | --- |
| FR-019 | name only; `kind` literal `open`; key generated after the project's highest ⇒ last in board order |
| FR-003 | `kind` is not a parameter, so no caller can supply one |
| FR-021, FR-051 | no pre-flight read. `23505` on `board_column_project_id_name_lower_idx` ⇒ `duplicate_name`; the holder's stored name is then read **for the message only**, after the failed transaction has rolled back and on `db` rather than on the aborted `tx`, which can serve no further statement — the pattern `src/features/labels/server/create-label.ts` already uses, where `findLabelNameHolder` runs outside the `db.transaction` whose violation it is explaining |
| FR-004 | `parseColumnName` trims first, then bounds at 200; `board_column_name_length` is the backstop |
| FR-022 | touches no existing column and no issue |
| FR-053 | `projectKey` checked at runtime against `^[A-Z][A-Z0-9]{0,7}$` before `loadProjectByKey` runs; a malformed key ⇒ `notFound()` |

A `23505` naming any other constraint is re-thrown, not reported as a name collision
([`../research.md`](../research.md) B-3).

---

## `updateColumn` — rename, and nothing else

**Action** `updateColumn({ columnId, name }): Promise<UpdateColumnState>`
**Module** `src/features/projects/server/update-column.ts`

```ts
type UpdateColumnState =
  | { ok: true }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "invalid_name"; reason: "required" | "too_long" }
  | { ok: false; error: "duplicate_name"; holder: { id: string; name: string } };
```

Row resolved: the column, by `columnId`. Absent ⇒ `notFound()` (the eleventh Edge Case — a column
another admin deleted is a missing row, not a permission failure). `projectId` comes off that row.

Transaction:

1. `SELECT … FOR UPDATE` on the column row; capture `previousName`
2. if `trimmed === previousName` ⇒ return `{ ok: true }` having written nothing
3. `UPDATE board_column SET … touched({ name })  WHERE id = $1`
4. `writeActivity(tx, { type: "column_renamed", target: { projectId }, actorId, field: previousName, fromValue: previousName, toValue: name })`

| Requirement | How |
| --- | --- |
| FR-023 | the parameter list is `columnId` and `name`. No kind, no position, no project, no colour — not even as ignored fields |
| FR-025 | same `23505` mapping and same message as `createColumn`; the constraint belongs to the pair, not to either mutator |
| FR-026 | the row being renamed is the row being updated, so `"Todo"` → `"todo"` cannot collide with itself. No `id <>` clause is needed |
| FR-045, FR-046 | `field` and `from_value` both carry the **pre-rename** name; `to_value` the new one |
| FR-027 | the client applies optimistically and rolls back on any `ok: false`, inline through `EditableField`'s `conflict` variant — `forbidden` included, mapped in `ColumnRow` and never left to the generic toast ([`screens.md`](./screens.md) → *`ColumnRow`'s rename*) |
| FR-053 | `columnId` checked for UUID shape before the resolve of step 3; a malformed id ⇒ `notFound()` |

---

## `moveColumn` — reorder

**Action** `moveColumn({ columnId, targetColumnId, placement }): Promise<MoveColumnState>`
where `placement: "before" | "after"`. **No `projectKey`** — the project comes off the stored
`columnId` row (FR-008), so a key on this payload could only be ignored or wrongly trusted
([`../research.md`](../research.md) B-4, which this contract settles).
**Module** `src/features/projects/server/move-column.ts`

```ts
type MoveColumnState =
  | { ok: true }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_target" }
  | { ok: false; error: "invalid_input" };
```

`invalid_input` is `placement`'s refusal and only that: a value that is neither `"before"` nor
`"after"` is refused explicitly rather than defaulted or coerced (FR-053, II). It is distinct from
`invalid_target`, which is a *legal-shaped* target that exists and is not a legal destination, and
from `not_found`, which is a target that is gone or was never nameable.

Row resolved: the moved column, by `columnId`. Absent at that initial resolve ⇒ `notFound()`.
`projectId` comes off it. `targetColumnId` must belong to that same project, verified against the
locked read and never against a client claim.

**Two vanishings are `not_found`, not `invalid_target`** (FR-010, sixth Clarification, eleventh Edge
Case): the moved column itself gone from the locked read of step 1 — a concurrent admin deleted it
between the resolve and the lock, the same race `deleteColumn` already covers below — and a
`targetColumnId` naming a column a concurrent admin deleted between the render and that read. The client renders both exactly as it renders `deleteColumn`'s `not_found`: the column
is reported as already gone and the section is refreshed, never as a permission refusal and never as
one of this mutator's own input refusals, since every column is readable by every signed-in user.
`invalid_target` is left to a target that **exists** but is not a legal destination.

**No ordinal, no index and no `sort_order` string crosses the boundary in either
direction** ([`../research.md`](../research.md) B-4).

Transaction:

1. `SELECT id, name, sort_order FROM board_column WHERE project_id = $1 ORDER BY id FOR UPDATE`
   — the project's whole column set, locked, in the **same** fixed, total acquisition order
   `deleteColumn` uses, so a move and a delete on one project cannot deadlock against each other
   (FR-050). `id` is immutable and total; `sort_order` is the column this mutator rewrites and so
   cannot order the lock. The moved column absent from this result ⇒ `not_found`. A
   `targetColumnId` absent from it is resolved once more against `board_column` by id alone: **no row
   at all ⇒ `not_found`** — the target was deleted under the drag — **and a row belonging to another
   project ⇒ `invalid_target`**, the code reserved for a destination that exists and is illegal
   (FR-010)
2. sort that **already-locked** result by `(sort_order, id)` in memory — an ordinary ordering of rows
   the transaction already holds, never a second `FOR UPDATE` read — then splice: remove the moved
   column from that list, re-insert it before/after the target
3. **if its index is unchanged ⇒ return `{ ok: true }` having issued no `UPDATE` and no activity insert**
4. `UPDATE … touched({ sortOrder: generateKeyBetween(previousNeighbourKey, nextNeighbourKey) })`
5. `writeActivity(tx, { type: "column_reordered", target: { projectId }, actorId, field: column.name, toValue: previousNeighbour?.name ?? null })`

| Requirement | How |
| --- | --- |
| FR-010 | a vanished subject column and a vanished drag target are both `not_found`, rendered as the stale-render case — the column already gone, the section refreshed — never `forbidden` and never `invalid_target` |
| FR-028 | one `UPDATE`, one column, `sort_order` only. No name, no kind, no project, no issue |
| FR-029 | one call per drop; the drop position is the only ordering input |
| FR-030 | step 3 — nothing at all, `updated_at` included |
| FR-033 | the write and every reader use the same `(sort_order, id)` order |
| FR-046 | `to_value` is the name of the column it **now follows**; `null` when it is now first |
| FR-047 | exactly one row, for the moved column. Columns whose ordinal merely shifted are not written and get no row |
| FR-053 | `placement` checked at runtime against the two literals ⇒ `invalid_input`; both ids checked for UUID shape before any query, a malformed `columnId` ⇒ `notFound()` and a malformed `targetColumnId` ⇒ `not_found` |

Neighbour keys are always distinct inside the lock, so `generateKeyBetween` cannot throw and no
rebalance path is written ([`../research.md`](../research.md) A-3).

---

## `deleteColumn` — the four refusals

**Action** `deleteColumn({ columnId }): Promise<DeleteColumnState>`
**Module** `src/features/projects/server/delete-column.ts`

```ts
type DeleteColumnState =
  | { ok: true }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "refused"; refusal: ColumnDeleteRefusal };
```

Row resolved: the column, by `columnId`. Absent at that initial resolve ⇒ `notFound()`. Absent again
inside the locked read of step 2 — a concurrent admin deleted it between the resolve and the lock —
⇒ `{ ok: false, error: "not_found" }`, the one refusal path that is not one of the four. The client
renders it as the stale-render case the spec already fixes (eleventh Edge Case, FR-010, `OT-UX-004`):
the column is reported as already gone and the section is refreshed, never as `forbidden` and never
as one of the four delete refusals, since every column is readable by every signed-in user.

**One transaction. All four refusals evaluated against locked rows. A read followed by a write is not
protection** (FR-050, `AGENTS.md` → Drizzle ORM and PostgreSQL 18):

1. `SELECT id, name, kind FROM board_column WHERE project_id = $1 ORDER BY id FOR UPDATE`
   — the project's whole column set, locked, in the one fixed, total acquisition order every mutator
   here that locks the set shares, so no two concurrent column mutations can deadlock
2. the target inside that result; absent ⇒ `not_found`
3. `countIssuesByColumn(tx, projectId)` — the emptiness read, **inside the lock**, the same function
   `loadProjectDetails` uses for the count the section shows (FR-015, SC-010)
4. compute all four booleans, then select **one** reason by the fixed precedence
5. any refusal ⇒ return it; **nothing is written, and no activity row appears** (FR-048, US5-5)
6. `DELETE FROM board_column WHERE id = $1` — cascading to nothing, because a deletable column is by
   definition empty and no other table references it (FR-041)
7. `writeActivity(tx, { type: "column_deleted", target: { projectId }, actorId, field: column.name })`

### The fixed precedence — FR-038, second Clarification

| # | Refusal | Holds when | Message names |
| --- | --- | --- | --- |
| 1 | `holds_issues` | the count for this column is > 0 | that the column still holds issues, which must be moved out first |
| 2 | `last_column` | the project has exactly one column | that a project always has at least one column |
| 3 | `last_canceled_kind` | `kind === "canceled"` and it is the only `canceled`-kind column | that it is a member's only route to remove an issue |
| 4 | `last_done_kind` | `kind === "done"` and it is the only `done`-kind column | that the project could never leave zero progress, and that `kind` cannot be reassigned afterwards |

The user-facing string for each is fixed in [`screens.md`](./screens.md) → *The four refusals,
worded*, and both the disabled control's inline reason and this mutator's refusal read that one
wording (FR-038, SC-004).

**All four are computed before one is chosen.** Early-returning from the first failing check makes the
answer depend on the order the checks are written in, which FR-038 rules out and SC-004 tests. The
selection function is pure and is the one both this mutator and the disabled control's inline reason
read ([`../research.md`](../research.md) B-2).

The two races the lock closes, each with its own test:

- **an issue moved into the column between the render and the submit** (third Edge Case, SC-005) — the
  `FOR UPDATE` on the column row conflicts with the `FOR KEY SHARE` PostgreSQL takes on it for the
  referencing `issue` write, so the count is never stale
- **two admins deleting the last two `done`-kind columns at once** (fourth Edge Case, SC-003) — the
  overlapping `FOR UPDATE` sets serialize; the second read sees the first commit and refuses

| Requirement | How |
| --- | --- |
| FR-034…FR-037 | the four rows above, each with its own reason, worded once in [`screens.md`](./screens.md) → *The four refusals, worded* (FR-038) |
| FR-053 | `columnId` checked for UUID shape before the resolve; a malformed id ⇒ `notFound()` |
| FR-039 | the control's disabled reason comes from the same selection function, so an enabled Delete always agrees with the count last rendered beside it; the locked re-check remains authoritative and may still refuse it (SC-010, SC-005, third Edge Case) |
| FR-040 | every refusal is evaluated server-side and refuses a bypassed control identically (US3 scenario 7) |
| FR-041 | one `DELETE`; every other column's name, kind and relative order untouched, with no renumbering, because the fractional keys of the others are not written |

---

## What every one of the four returns to a client

A discriminated union of reason codes. **No `Error` crosses the boundary, no constraint name, no SQL,
no stack trace and no configuration** (FR-052, `AGENTS.md` → the server boundary). The client maps a
code to prose; the server logs the detail.

## What no mutator here does

- moves, changes or destroys an issue — **no such path exists and none is added** (§4, FR-022,
  FR-028, FR-041, SC-002)
- changes a `kind` (FR-002)
- accepts or writes a colour, or writes a `column_recolored` row (FR-005)
- writes a notification — no column event produces one of the three types (spec *Out of Scope*)
- appears on any issue's feed (FR-044, US5 scenario 7)
