# Phase 1 — Data model

**Plan**: [`plan.md`](./plan.md) · **Research**: [`research.md`](./research.md) · **Spec**: [`spec.md`](./spec.md)

Four tables, one migration, and the queries and DTOs that sit above them. Every column below traces
to §5's *Key fields* or to a functional requirement; nothing is added because it might be useful.

Types are Drizzle's, in `src/db/schema.ts`. `$inferSelect` and `$inferInsert` derive the persistence
types; no database row is exposed as a UI model — §4 of this document defines the DTOs that cross
that boundary (AGENTS.md → TypeScript).

---

## 1. `project`

The container work lives in. §5, *Key fields* → `project`.

| Column | Type | Constraints | Requirement |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `$defaultFn(uuidv7)` | `FR-012`, `OT-DATA-001` |
| `key` | `text` | `NOT NULL`, `UNIQUE`, `CHECK (key ~ '^[A-Z][A-Z0-9]{0,7}$')`, `CHECK (char_length ≤ 200)` | `FR-002`, `OT-INV-016` |
| `name` | `text` | `NOT NULL`, `CHECK (char_length ≤ 200)` | `FR-002`, `FR-024` |
| `description` | `text` | nullable, `CHECK (char_length ≤ 10000)` | `FR-010`, `FR-027` |
| `status` | `text` | `NOT NULL DEFAULT 'active'`, `CHECK (status IN ('active','archived'))` | `FR-003`, `FR-031` |
| `start_date` | `date` | nullable | `FR-028` |
| `target_date` | `date` | nullable | `FR-028` |
| `color` | `text` | `NOT NULL`, `CHECK` over the seven palette values | `FR-009`, `FR-029`, `OT-DATA-013` |
| `created_at` | `timestamptz` | `NOT NULL` | `FR-012` |
| `updated_at` | `timestamptz` | `NOT NULL`, written through `touched()` | `FR-012` |

**Table check** — the date ordering rule, `project_dates_ordered`:

```sql
CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date)
```

It is a constraint and not only a mutator check because `updateProject` writes one field per call, so
two concurrent calls can each read a legal row and together write an illegal one
([`research.md`](./research.md) A-6).

**No `sort_order`.** `OT-UX-020` and §5 forbid one; the sidebar's order is derived
(`FR-004`, [`research.md`](./research.md) D-9).

**No `deleted_at`.** Archiving is the reversible path and the delete is hard (`FR-049`, `OT-DATA-007`).

**No lead, no owner, no role.** §2 gives a project members and nothing else (`FR-005`).

**Immutability of `key` is a mutator property, not a column property.** `OT-INV-007` names
`updateProject` as its enforcer, and `updateProject`'s input type has no `key` field
([`research.md`](./research.md) C-6). The pattern `CHECK` guards the value; nothing guards against an
`UPDATE` that a mutator never issues.

---

## 2. `project_member`

The whole write grant. §5: `(project_id, user_id)` composite PK, no role column.

| Column | Type | Constraints | Requirement |
| --- | --- | --- | --- |
| `project_id` | `uuid` | `NOT NULL`, → `project.id` `ON DELETE CASCADE` | `FR-005`, `FR-051` |
| `user_id` | `uuid` | `NOT NULL`, → `user.id` `ON DELETE CASCADE` | `FR-005` |
| `created_at` | `timestamptz` | `NOT NULL` | `FR-012` |
| `updated_at` | `timestamptz` | `NOT NULL` | `FR-012` |

**Primary key**: `primaryKey({ columns: [projectId, userId] })`.

**No secondary index.** The composite primary key's leading column serves every read this feature
issues. The reverse direction — "which projects does this user belong to" — is R3's project count and
R12's Home, and whichever of them wires that query adds the index with it
([`research.md`](./research.md) A-9).

**The pair is the identity**, so a duplicate row is impossible and `addProjectMember` needs no
read-then-write (spec, *Edge Cases*; [`research.md`](./research.md) A-2).

**Nothing marks a deactivated member.** §3.9 has deactivation remove nothing; the row stays and the
roster shows the member with the display convention every other surface uses (spec, *Assumptions*).

**`user.id` cascades** because §4 says a user is never deleted at all — the cascade is there so the
foreign key is complete, not because a delete path exists.

---

## 3. `board_column`

A lane belonging to one project. Read-only in this feature; R9 gives it its mutators.

| Column | Type | Constraints | Requirement |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `$defaultFn(uuidv7)` | `FR-012` |
| `project_id` | `uuid` | `NOT NULL`, → `project.id` `ON DELETE CASCADE` | `FR-006`, `FR-051` |
| `name` | `text` | `NOT NULL`, `CHECK (char_length ≤ 200)` | `FR-006` |
| `color` | `text` | `NOT NULL`, `CHECK` over the seven palette values | `FR-009`, `OT-DATA-013` |
| `sort_order` | `text collate "C"` | `NOT NULL` | `FR-006`, §5 |
| `kind` | `text` | `NOT NULL`, `CHECK (kind IN ('open','done','canceled'))` | `FR-006`, `OT-INV-015` |
| `created_at` | `timestamptz` | `NOT NULL` | `FR-012` |
| `updated_at` | `timestamptz` | `NOT NULL` | `FR-012` |

**Unique index**: `board_column_project_id_name_lower_idx` on `(project_id, lower(name))`
(`OT-INV-016`, §5). No caller in this feature — the five seeded names cannot collide and no rename
exists — but the constraint belongs to the table, and R9's inline-rename clash is enforced by it.

**No secondary index.** The unique index above already leads with `project_id`, which is what the
Columns section's per-project read filters on; the `ORDER BY sort_order` is a sort over five rows.

**`sort_order` is a custom type**, because Drizzle's `text()` carries no collation option
([`research.md`](./research.md) A-4b).

### The five seeded rows

Written by `createProject` in its own transaction, in this order (`FR-007`, §3.3, §7):

| # | Name | Kind | Colour | `sort_order` |
| --- | --- | --- | --- | --- |
| 1 | Backlog | `open` | grey `#8b909a` | `a0` |
| 2 | Todo | `open` | blue `#2f7fc4` | `a1` |
| 3 | In Progress | `open` | amber `#d4a017` | `a2` |
| 4 | Done | `done` | green `#3a9d5d` | `a3` |
| 5 | Canceled | `canceled` | red `#c8453c` | `a4` |

The constants live in `src/features/projects/seed-columns.ts` as one exported array, so the seed, the
test that asserts it, and R9's "a column added later is always `open`" all read the same list.

---

## 4. `issue_counter`

The per-project source of issue numbers. Created here, drawn from in R6, and never read by a screen.

| Column | Type | Constraints | Requirement |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `$defaultFn(uuidv7)` | `FR-008` |
| `project_id` | `uuid` | `NOT NULL`, `UNIQUE`, → `project.id` `ON DELETE CASCADE` | `FR-008`, `FR-051` |
| `last_number` | `integer` | `NOT NULL DEFAULT 0` | `FR-008` |

**No `created_at`, no `updated_at`** — this is the one table in the feature outside `FR-012`'s
timestamp rule, so drawing a number writes no timestamp.

**`UNIQUE (project_id)`** is what makes "exactly one counter per project" a database fact rather than
a convention: a second row cannot exist to hand out numbers the first has already issued.

**`last_number` holds the last number issued**, seeded at `0`, so the first issue R6 draws is `1`.

**Unreachable from any read** (`OT-DATA-006`). No query in §5 of this document selects from it, and
none of the DTOs below carries a field derived from it. R6 draws a number with one statement inside
the creating transaction:

```sql
UPDATE issue_counter SET last_number = last_number + 1 WHERE project_id = $1 RETURNING last_number
```

which is atomic on its own row, touches no project row, and satisfies `OT-DATA-012` and `OT-INV-009`
in R6 rather than here.

---

## 5. The reads

Every read is a plain Drizzle query in `src/features/projects/server/queries.ts`, `import "server-only"`
at the top. There is no ORM relation graph and no repository layer.

| Query | Returns | Ordering | Requirement |
| --- | --- | --- | --- |
| `listProjectsForSidebar()` | every project: `key`, `name`, `status`, `color` | `(status = 'archived'), lower(name)` | `FR-053`, `FR-054`, `OT-UX-020` |
| `loadProjectByKey(key)` | the project row, or `null` | — | `FR-035`, `FR-040` |
| `loadProjectDetails(key)` | the record, its columns, its roster, and the cascade count | columns by `sort_order`; roster by `lower(last_name), lower(first_name)` | `FR-035`, `FR-044`, `FR-045`, `FR-048` |
| `findProjectKeyHolder(key)` | `{ key, name }` of the holder, or `null` | — | `FR-026`, `OT-UX-012` |
| `listAddableUsers({ excludeProjectId, excludeUserId })` | `publicUser` rows | `lower(last_name), lower(first_name)` | `FR-030`, `FR-045`, `OT-AUTHZ-006` |
| `hasProjectMemberRow(projectId, userId)` | boolean | — | `FR-013`, `OT-AUTHZ-001` |

**The roster reads `project_member` rows only** — never `project_member` unioned with admins — so an
admin appears on it only where they were added explicitly (`FR-018`, `OT-AUTHZ-006`). The **predicate**
includes admins; the **list** does not, and the two live in different modules so the distinction is
visible in the import.

**Users are read through `publicUser`**, R1's projection. Neither the roster nor either picker widens
it, and `accountUser` is not imported by this feature (§5, *Read boundary*).

**No read is membership-scoped.** Every signed-in user reads every project, every column and every
roster (`FR-017`, `OT-AUTHZ-002`). Membership decides writes and nothing else.

**The cascade count** in `loadProjectDetails` is `count(board_column) + count(project_member)` for
that project — the rows the cascade actually reaches when the confirmation renders (`FR-048`). Each
later entry that attaches a table to the cascade adds its count here.

---

## 6. What crosses the boundary

Explicit DTOs, defined beside the queries that produce them. No `$inferSelect` row reaches a
component.

```text
ProjectListEntry            the sidebar
  key, name, status, color

ProjectRecord               the details screen's record section
  key, name, description, status, startDate, targetDate, color

ProjectColumnRow            the Columns section
  id, name, color, kind, position, issueCount

RosterEntry                 the Members section, and the create form's chips
  userId, displayName, avatarUrl, jobTitle, deactivated

ProjectDetails              what the details page hands its synchronous component
  record          ProjectRecord
  columns         ProjectColumnRow[]
  roster          RosterEntry[]
  cascadeCount    number
  canEditRecord   boolean        isMember  — the record section's controls
  canAdminister   boolean        isAdmin   — status, members and delete
```

**`issueCount` is `0` for every column** until R6 exists to write issues. The field is real and the
number is true; it is not a placeholder ([`research.md`](./research.md) D-8).

**`canEditRecord` and `canAdminister` are booleans, not a role.** They are computed once per request
on the server and drive the disabled controls and their inline reasons (`FR-021`); the mutator's own
check is the enforcement (`FR-014`), and it is written in a different module
([`research.md`](./research.md) B-3).

**`startDate` and `targetDate` cross as calendar dates, not instants.** They are `date` columns and
§5 compares calendar dates in the server's own timezone; nothing converts them to a `Date` with a
time component on the way out.

---

## 7. The writes

| Mutator | Tables | Rows | Transaction |
| --- | --- | --- | --- |
| `createProject` | `project`, `board_column`, `issue_counter`, `project_member` | 1 + 5 + 1 + *n* | one (`FR-034`) |
| `updateProject` | `project` | 1 | one statement |
| `setProjectStatus` | `project` | 1 | one statement (`FR-043`) |
| `deleteProject` | `project` + the cascade | 1 + everything referencing it | one, with `SELECT … FOR UPDATE` first (`FR-050`) |
| `addProjectMember` | `project_member` | 1 | one statement |
| `removeProjectMember` | `project_member` | 1 | one statement |

`updated_at` is written by `touched()` on every write to a table that carries one (`FR-012`).

**`setProjectStatus` touches the project row and nothing else** — no column, no membership, and once
they exist, no issue (`FR-043`, `OT-OPS-010`, `SC-009`).

**`removeProjectMember` deletes one row and nothing else.** Assignments, comments and activity are in
tables it does not name, so `FR-019`'s "nothing else" is true by the statement's shape rather than by
a rule the mutator has to remember (`OT-AUTHZ-013`, `SC-008`).

### The cascade, today and later

`deleteProject` issues one `DELETE FROM project WHERE id = $1`. What follows is the database's:

| Table | Reaches it via | Lands with |
| --- | --- | --- |
| `board_column` | `project_id ON DELETE CASCADE` | R5 |
| `project_member` | `project_id ON DELETE CASCADE` | R5 |
| `issue_counter` | `project_id ON DELETE CASCADE` | R5 |
| `issue` | R6's own FK | R6 |
| `comment`, `activity` | R7's own FKs | R7 |
| `notification` | R11's own FK | R11 |

`FR-051` puts the obligation on each later entry to attach its table to the same cascade. Nothing is
declared here for a table that does not exist.

**A deleted project's key is immediately reusable** (`FR-049`, `SC-012`): the delete is hard and
leaves no reserved row, so the `UNIQUE` on `project.key` frees the value with the row.

---

## 8. Entities named by the spec that this feature does not model

| Entity | Owner | What R5 does |
| --- | --- | --- |
| `issue` | R6 | creates the counter its numbers come from; renders `0` as every column's issue count |
| `activity` | R7 | writes none. R7 adds the writing to all five of this feature's mutators, in the same transaction as each change, and with it the second half of `OT-AUTHZ-013` |
| `comment` | R7 | renders no feed and no comment count |
| `notification` | R11 | declares no `notification` arm on the cascade |
| `label`, `issue_label` | R8 | untouched |
| `user` contact fields | R3, R4, through `accountUser` | never selected; every user read goes through `publicUser` |
| Column mutators | R9 | seeds the five rows and renders them read-only; enforces `OT-INV-005`, `-006`, `-012`, `-014` nowhere, because they are `deleteColumn`'s |
