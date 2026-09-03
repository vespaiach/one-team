# Phase 1 — Data model

**Feature**: Issues — creation, detail and editing · **Entry**: R6 · **Date**: 2026-08-31

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) · **Research**:
[`research.md`](./research.md)

One table added, one of R5's altered, one of R5's read under a lock, and one DTO handed to the
screens. Nothing here is chosen freely: every column restates §5's *Key fields* or a numbered
requirement, and the citation is on the row.

---

## 1. The table this feature adds: `issue`

`src/db/schema.ts`, appended after R5's tables. Types follow §5's conventions, which R1 established
and this feature inherits rather than re-decides.

| Column | Type | Null | Default | Why |
| --- | --- | :---: | --- | --- |
| `id` | `uuid` | no | `uuidv7()` server-side | `OT-DATA-001`, `FR-008` |
| `project_id` | `uuid` | no | — | `FR-001`, `OT-INV-001` — every issue belongs to one project |
| `number` | `integer` | no | — | drawn from `issue_counter`, `FR-013` |
| `title` | `text` | no | — | required and trimmed, `FR-030` |
| `description` | `text` | yes | — | optional markdown source, `FR-009`, `FR-031` |
| `column_id` | `uuid` | no | — | required, always the issue's own project's, `FR-005` |
| `priority` | `text` | no | `'none'` | five values, `FR-004` |
| `assignee_id` | `uuid` | yes | — | optional and clearable, `FR-006` |
| `due_date` | `date` | yes | — | calendar date, string mode, `FR-006`, A-8 |
| `created_by` | `uuid` | no | — | the creating actor, never changed, `FR-011` |
| `sort_order` | `text` `COLLATE "C"` | no | — | foot of the project's order, `FR-040` |
| `created_at` | `timestamptz` | no | written by the mutator | §5 |
| `updated_at` | `timestamptz` | no | written by `touched()` | `FR-008`, §5 |

**Columns that are deliberately absent.** `status` — the column carries those semantics (`FR-003`,
§5). `parent_id` / any self-reference — issues are flat (`FR-002`, `OT-INV-003`). `deleted_at` — the
delete is hard and cancellation is the reversible path (`FR-057`, `OT-DATA-007`). Each absence is
asserted by a test (research E-4), because each is a requirement rather than an omission.

### Constraints

| Constraint | Form | Requirement |
| --- | --- | --- |
| Title bound | `CHECK (char_length(title) <= 200)` | `FR-008`, §5 conventions |
| Description bound | `CHECK (char_length(description) <= 10000)` | `FR-008`, §5 conventions |
| Priority set | `CHECK (priority in ('none','low','medium','high','urgent'))` | `FR-004` |
| The address | `UNIQUE (project_id, number)` | `FR-014`, `FR-017`, `SC-002` |
| Project | `FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE` | R5's §4 cascade arm, A-5 |
| Column belongs to the project | `FOREIGN KEY (project_id, column_id) REFERENCES board_column(project_id, id)` — `NO ACTION` | `OT-INV-004`, `FR-005`, A-3, A-4 |
| Assignee | `FOREIGN KEY (assignee_id) REFERENCES user(id)` — no delete action | `FR-024`, A-5 |
| Creator | `FOREIGN KEY (created_by) REFERENCES user(id)` — no delete action | `FR-011`, A-5 |

`NO ACTION` on the composite key is load-bearing and not a default taken by accident: it defers its
check to the end of the statement, which is what lets `deleteProject`'s cascade remove columns and
issues in either order. `RESTRICT` would break a delete this feature never calls. See
[`research.md`](./research.md) A-4.

### Indexes

One, and it is the unique constraint above. `AGENTS.md` adds indexes for known query patterns only,
and PostgreSQL does not index the referencing side of a foreign key — so `column_id`, `assignee_id`
and `created_by` are unindexed here on purpose. R9's emptiness check, R10's grouping and R12's
roll-up are where those become known patterns, and each adds the index its own query needs
([`research.md`](./research.md) A-2).

---

## 2. The table this feature alters: `board_column` (R5's)

One constraint, whose only purpose is to be a foreign key target:

```
UNIQUE (project_id, id)
```

PostgreSQL requires a foreign key's referenced column list to be covered by a unique constraint, and
`id` being the primary key does not cover `(project_id, id)`. Without it the composite key
`OT-INV-004` requires cannot be declared at all.

R5 has no use for the constraint and does not need to anticipate it. This is a reach-back into an
inherited table and is recorded in [`plan.md`](./plan.md)'s *Complexity Tracking*.

---

## 3. The table this feature reads under a lock: `issue_counter` (R5's)

R5 creates the row; this feature is its only reader, and §5's *Read boundary* keeps it off every read
endpoint permanently. R5's spec does not name its columns, so this plan pinned the contract rather than leaving two entries
to guess at each other ([`research.md`](./research.md) A-7). **R5's plan has since landed and matches
it** — [`specs/005-projects-membership-lifecycle/data-model.md`](../005-projects-membership-lifecycle/data-model.md) §4
carries the same column, the same default and the same meaning, and R5's research A-3 carries the
same draw statement byte for byte. What follows is now a confirmed contract rather than a pin:

```
issue_counter(id uuid PRIMARY KEY,
              project_id uuid NOT NULL UNIQUE REFERENCES project(id) ON DELETE CASCADE,
              last_number integer NOT NULL DEFAULT 0)
```

**Correction (T001, Phase 1)**: the shipped table carries its own `id` primary key
(`$defaultFn(uuidv7)`), with `project_id` as `NOT NULL UNIQUE` rather than the table's primary key —
this block previously omitted `id`. `UNIQUE` still makes the draw's `WHERE project_id = $1` target
exactly one row, so the draw statement below is unaffected.

The draw, inside `createIssue`'s transaction and nowhere else:

```sql
UPDATE issue_counter SET last_number = last_number + 1
WHERE project_id = $1 RETURNING last_number
```

One statement takes the row lock, holds it to commit, and hands back the number. It touches no
project row (`OT-DATA-012`), it is monotonic, and a deleted issue returns nothing to it (`FR-014`).

> **Dependency on R5's plan.** If R5 names the column `next_number` starting at `1`, or puts the
> counter's primary key elsewhere, this statement is the one line in R6 that changes. Recorded here
> so the divergence is caught by reading two documents rather than by a failing migration.

---

## 4. What is read: the `IssueView` DTO

`AGENTS.md` forbids exposing a database row as a UI model. Both screens receive an explicit DTO,
assembled by the query in `src/features/issues/server/issue-queries.ts`.

```
IssueView
  id            string
  key           string        "WEB-142", formatted server-side          FR-012
  number        integer                                                 FR-012
  title         string                                                  FR-043
  description   string | null  markdown source, rendered on read        FR-044
  column        { id, name, color }                                     FR-051
  priority      'none'|'low'|'medium'|'high'|'urgent'                    FR-004
  assignee      PublicUser | null                                       FR-022, FR-024
  dueDate       string | null  YYYY-MM-DD                               FR-006
  project       { key, name, color }   shown, never a control           FR-007, FR-045
  createdBy     PublicUser     shown, never a control                   FR-011, FR-045
  createdAt     Date           shown                                    FR-045
  updatedAt     Date           shown                                    FR-045
```

`PublicUser` is R1's `publicUser` projection — `id`, `first_name`, `last_name`, `avatar_url`, `role`,
`job_title`, `deactivated_at` — reused unchanged, which is what keeps `email`, `phone`, `slack_handle`
and `bio` off a page with no business showing them (§5, *Read boundary*).

**`sort_order` is not in the DTO.** Neither screen renders order and `FR-040` makes creation its only
writer. A field the client holds and cannot use is a field a later reader will find a use for.

### Alongside it, three decided values

| Value | Type | Decided by | Requirement |
| --- | --- | --- | --- |
| `canWrite` | boolean | `isMember(actor, project)` on the server | `FR-018`, `FR-019` |
| `canDelete` | boolean | `isAdmin(actor)` on the server | `FR-018`, `FR-056` |
| `writeReason` | string | one sentence naming the project | `FR-023`, `FR-026`, `OT-UX-002` |

The client renders the answer; it never re-derives the predicate, and the server check on each
mutator is the enforcement (`FR-019`, `OT-AUTHZ-005`). `writeReason` reads in the specification's own
register — "Only project members can edit issues in Website Redesign" (§4, *Rejected write*).

### The two supporting reads

| Read | Shape | Requirement |
| --- | --- | --- |
| The project's columns, in board order | `{ id, name, color, sortOrder }[]` | `FR-032`, `FR-052` |
| The assignee pool | `PublicUser[]` — `project_member` rows **plus** every admin, deactivated excluded | `FR-022`, `OT-AUTHZ-007` |

The pool is the one list in this feature that reads membership rows *plus* admins rather than the
`isMember` predicate; §2 names it and the `@mention` group as the only two. An admin is assignable in
every project without holding a row.

---

## 5. What is written

Three mutators, and the full contract for each is in
[`contracts/mutators.md`](./contracts/mutators.md). What lands in the database:

| Mutator | Rows written | Transaction |
| --- | --- | --- |
| `createIssue` | one `issue` insert; one `issue_counter` update | one, holding both (`FR-039`) |
| `updateIssue` | one `issue` update over changed columns only, or **nothing** | one, holding the locked read and the write (`FR-055`) |
| `deleteIssue` | one `issue` delete, plus whatever the cascade reaches | one (`FR-058`, `OT-DATA-008`) |

`updated_at` is written explicitly through `touched()` on every write path — never a trigger, never a
database default (§5, `FR-008`). That is what makes `SC-018` observable: a save that changes nothing
leaves the timestamp untouched, because no write ran at all.

### The cascade, today and as it grows

`FR-059`. Nothing in this feature references an issue, so deleting one removes the issue alone. Each
later entry attaches its own arm **at the database** by declaring its table's cascading reference,
and `deleteIssue`'s body does not change:

| Arm | Declared by | Table |
| --- | --- | --- |
| comments | R7 | `comment.issue_id ON DELETE CASCADE` |
| activity | R7 | `activity.issue_id ON DELETE CASCADE` |
| label joins | R8 | `issue_label.issue_id ON DELETE CASCADE` |
| notifications | R11 | `notification.issue_id ON DELETE CASCADE` |

Each of those entries also adds its own count to the confirmation `FR-062` fixes.

---

## 6. Entities the spec names that this feature does not model

- **Issue key** — `Key Entities` calls it out precisely because it is *not* a stored field. It is
  `project.key` + `'-'` + `issue.number`, formatted server-side into the DTO. Storing it would create
  a third place the address lives and a way for it to disagree with the two halves that are permanent.
- **Board column** — R5's table. This feature reads it, adds one unique constraint to it (§2 above)
  and changes no row in it. `deleteColumn`'s four refusals are R9's and are not enforced here.
- **Issue counter** — R5's table. Read under a lock (§3 above), never written outside
  `createIssue`'s transaction, never reachable from a read endpoint.
- **Project, project membership, user** — R5's and R1's/R3's. Read only.
- **Comment, activity, label, issue_label, notification** — none exist yet, and this feature creates
  none of them. They appear above only as the cascade arms their own entries will declare.
