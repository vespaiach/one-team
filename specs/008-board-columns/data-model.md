# Phase 1 — Data model: Board columns (R9)

**Feature**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) · **Research**: [`research.md`](./research.md)

This feature **creates no table and no column**. It is the first caller that writes `board_column`
rows after project creation, and it widens one `CHECK` on a table entry R7 shipped. Everything below
that is not marked **CHANGED** is stated so a reader knows it was checked and left alone.

---

## 1. `board_column` — read and written, never altered

Declared in `src/db/schema.ts` by entry R5; the composite unique constraint is entry R6's.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | UUIDv7, server-generated via `$defaultFn` |
| `project_id` | `uuid NOT NULL` | → `project.id` `ON DELETE cascade` |
| `name` | `text NOT NULL` | written by `createColumn` and `updateColumn` |
| `sort_order` | `text COLLATE "C" NOT NULL` | **fractional index**, written by `createColumn` and `moveColumn` |
| `kind` | `text NOT NULL` | `open` \| `done` \| `canceled` — written **once**, at creation, always `open` after project creation |
| `created_at` | `timestamptz NOT NULL` | |
| `updated_at` | `timestamptz NOT NULL` | written through `touched()` on every write (FR-006, `OT-DATA-002`) |

Constraints already present, all load-bearing here:

| Name | Shape | What it enforces for this feature |
| --- | --- | --- |
| `board_column_project_id_name_lower_idx` | `UNIQUE (project_id, lower(name))` | FR-004, FR-021, FR-025, FR-051 — the **only** uniqueness enforcement; no mutator pre-checks |
| `board_column_project_id_id_unique` | `UNIQUE (project_id, id)` | R6's composite-FK target; a `23505` from it must **not** be reported as a name collision |
| `board_column_name_length` | `char_length(name) <= 200` | FR-004's bound, backstop behind `parseColumnName` |
| `board_column_kind_valid` | `kind in ('open','done','canceled')` | `OT-INV-015`'s backstop |
| `board_column_project_id_project_id_fk` | FK → `project` `ON DELETE cascade` | the only path that ever deletes a column other than `deleteColumn` |

**The fold is PostgreSQL's own.** "Unique when folded to lower case" is the index expression
`lower(name)` in `board_column_project_id_name_lower_idx` (`src/db/schema.ts`,
`drizzle/0003_supreme_skullbuster.sql`), evaluated under the database's collation, and it is the only
folding that exists anywhere in this feature — FR-051 forbids a mutator-side comparison, so no second
implementation can disagree with it for a non-ASCII name.

**A name is trimmed and nothing else.** No internal whitespace is collapsed, no Unicode normalization
form is applied and no zero-width character is stripped, matching `parseColumnName`'s only precedent in
the codebase, `src/features/labels/server/create-label.ts`, which trims and then bounds. Two names
differing by any of those are different names, and the seventh Edge Case's " Todo " / "Todo" collision
is the trim's doing alone.

**`sort_order` is a string, not a number.** `sortOrder` is a Drizzle `customType` rendering
`text collate "C"`; the five seeded values are `a0` `a1` `a2` `a3` `a4`, the key space
`fractional-indexing` generates. `moveColumn` writes `generateKeyBetween(previous, next)`;
`createColumn` writes `generateKeyBetween(highest, null)`. No integer position exists and none is
added. ([`research.md`](./research.md) A-1.)

**Board order** is `ORDER BY sort_order, id` — the `id` tie-break is added by this feature to
`loadProjectDetails`, which orders by `sort_order` alone today. (A-2.)

**Not added, deliberately**: no `color`, no `position` integer, no `issue_count` cache, no
`deleted_at`. FR-005 forbids the first; A-1 and E-8 forbid the second and third; §4 *Deletes* forbids
the fourth.

---

## 2. `issue` — read only

Read for the per-column count and never written by this feature (FR-022, FR-028, FR-041, SC-002).

The count is `SELECT column_id, count(*) FROM issue WHERE project_id = $1 GROUP BY column_id`,
served by the existing `issue_project_id_number_unique` index's `project_id` prefix. **No index is
added.**

`issue_project_id_column_id_fk` — `FOREIGN KEY (project_id, column_id) REFERENCES board_column
(project_id, id)` — is what makes `deleteColumn`'s lock correct: a transaction inserting or updating
an `issue` that references a column takes a `FOR KEY SHARE` lock on that `board_column` row, which
conflicts with the delete's `FOR UPDATE`. ([`research.md`](./research.md) B-1.)

---

## 3. `activity` — one `CHECK` widened, nothing else **CHANGED**

| Column | Value for this feature's four types |
| --- | --- |
| `actor_id` | the acting admin (FR-044) |
| `type` | one of the four new values |
| `issue_id` | **always null** — a column edit is project history (FR-044, US5 scenario 7) |
| `project_id` | the column's project, derived server-side |
| `field` | the column's name, frozen at write time; the **pre-rename** name on `column_renamed` (FR-045) |
| `from_value` / `to_value` | per the table below (FR-046) |
| `comment_id` | **always null** — `activity_comment_id_matches_type` requires it |
| `created_at` | the write instant. There is no `updated_at`: rows are never modified (`OT-INV-011`) |

### The `CHECK` change — the feature's only schema edit

```
CONSTRAINT "activity_type_valid" CHECK ("activity"."type" in (
  'created', 'field_changed', 'member_added', 'member_removed',
  'archived', 'reopened', 'comment',
  'column_added', 'column_renamed', 'column_reordered', 'column_deleted'   -- added
))
```

**Four values. Not five.** No `column_recolored` — §7 *Palette* retires per-column colour and §5
enumerates four. ([`research.md`](./research.md) D-3.)

Delivered as a **new** migration, `drizzle/0007_*.sql`, generated by `npm run db:generate` and
inspected before commit. `drizzle/0006_lying_sugar_man.sql`, which created the constraint, is **not
edited** — `AGENTS.md` → Drizzle ORM. The list this migration rewrites holds **seven** values today, the ones
`drizzle/0006_lying_sugar_man.sql` created, and this feature takes it to **eleven**. Entry R8 has landed without
widening it — `src/features/labels/` writes no activity row of any type — so there is no second widening of
this constraint to compose with and no ordering between two migrations to reason about. The two `label_*`
values R8's roadmap entry calls for were never implemented and are tracked outside this feature.

### Row shapes

| `type` | `field` | `from_value` | `to_value` |
| --- | --- | --- | --- |
| `column_added` | new name | `null` | `null` |
| `column_renamed` | **old** name | old name | new name |
| `column_reordered` | current name | `null` | name of the column it now follows; **`null` ⇒ now first** |
| `column_deleted` | name at delete time | `null` | `null` |

Every string passes through R7's `truncateActivityValue` (200 characters), which
`activity_from_value_length` and `activity_to_value_length` require. No row carries a reference to
the column, which is why a row survives its column's deletion intact (SC-012).

A reorder writes **one** row, for the column the drag moved (FR-047). A no-op drop, a refused rename
and a refused delete each write **none** (FR-030, FR-048, SC-011).

---

## 4. DTOs at the boundary

Database rows are never returned to a client. `AGENTS.md` → TypeScript.

### `ProjectColumnRow` — **CHANGED**, in `src/features/projects/server/queries.ts`

```ts
export type ProjectColumnRow = {
  id: string;
  name: string;
  kind: "open" | "done" | "canceled";
  position: number;      // derived ordinal of the ordered read — NOT board_column.sort_order
  issueCount: number;    // CHANGED: live count, was hardcoded 0 by R5
  deleteRefusal: ColumnDeleteRefusal | null;   // NEW: null ⇒ deletable
};
```

`sort_order` is **not** exposed. The client never sees a fractional key and never computes one — a
move is expressed as a neighbour id plus a placement ([`research.md`](./research.md) B-4).

`issueCount` becomes load-bearing here: FR-015 and SC-010 require the shown count and the count the
emptiness refusal reads to be the same read, which `countIssuesByColumn` serves for both callers (E-8).

`deleteRefusal` carries the precedence-selected reason so the disabled Delete control shows the same
reason the mutator would give (FR-039, SC-004). It is `null` for a deletable column and for every
non-admin viewer, who is offered no Delete control at all (FR-016).

### `ColumnDeleteRefusal` — new, in `src/features/projects/server/column-delete-refusal.ts`

```ts
export type ColumnDeleteRefusal =
  | "holds_issues"
  | "last_column"
  | "last_canceled_kind"
  | "last_done_kind";
```

The precedence order is the declaration order and is fixed by FR-038 and the second Clarification:
holds issues → project's last column → project's last `canceled`-kind → project's last `done`-kind.
Selection is a pure function over the four booleans, unit-testable without a database, and is the
single source both the mutator and the rendered reason read ([`research.md`](./research.md) B-2).

### `ActivityType` — **CHANGED**, two independent unions

`src/features/activity/server/write-activity.ts` and `src/features/activity/server/feed-queries.ts`
each declare their own `ActivityType`. Both gain the same four values. The duplication is
pre-existing and is **not** refactored away here (gate 7). `activity-row.tsx`'s `buildSentence`
switch is exhaustive over `Exclude<ActivityType, "comment">` and gains four cases, without which
`npm run type-check` fails. ([`research.md`](./research.md) C-2.)

---

## 5. Invariants this feature is the enforcement point for

| # | Invariant | Enforced here by |
| --- | --- | --- |
| 5 | A project always has at least one column | `deleteColumn`, inside the `FOR UPDATE` lock |
| 6 | A column with issues cannot be deleted | `deleteColumn`, count read inside the same lock |
| 12 | A project always has at least one `canceled`-kind column | `deleteColumn`, same lock |
| 14 | A project always has at least one `done`-kind column | `deleteColumn`, same lock |
| 15 | `kind` is fixed at creation | `updateColumn`'s signature — it takes a name and nothing else |
| 16 | Column names are unique per project, case-insensitively | `board_column_project_id_name_lower_idx`, **not** a mutator read |

Invariants 5, 6, 12 and 14 are all evaluated against rows locked by one
`SELECT … WHERE project_id = $1 ORDER BY id FOR UPDATE`, in one transaction, before any write. A read
followed by a write is not protection for any of them (FR-050).

## 6. What this feature does not touch

`project`, `project_member`, `comment`, `notification`, `label`, `issue_label`, `issue_counter`,
`user`, and every auth table. No `issue` row is written by any path here — verified by SC-002's
before-and-after census rather than asserted.
