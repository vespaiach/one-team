# Phase 1 — Data model

**Feature**: Comments and activity feeds · **Entry**: R7 · **Date**: 2026-09-01

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) · **Research**:
[`research.md`](./research.md)

Two tables added, one column already present, and the queries and DTOs that sit above them. Every
column below restates a functional requirement; the citation is on the row.

---

## 1. `comment`

One plain-text message, attached to exactly one issue or one project. §5, `comment`.

| Column | Type | Constraints | Requirement |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `$defaultFn(uuidv7)` | `FR-005`, `OT-DATA-001` |
| `author_id` | `uuid` | `NOT NULL`, → `user.id`, no delete action | `FR-001` |
| `body` | `text` | `NOT NULL`, `CHECK (char_length ≤ 10000)` | `FR-001`, `FR-010`, `OT-DATA-016` |
| `issue_id` | `uuid` | nullable, → `issue.id` `ON DELETE CASCADE` | `FR-001`, research A-3 |
| `project_id` | `uuid` | nullable, → `project.id` `ON DELETE CASCADE` | `FR-001`, research A-3 |
| `created_at` | `timestamptz` | `NOT NULL` | `FR-005`, §5 |
| `updated_at` | `timestamptz` | `NOT NULL`, written through `touched()` | `FR-005`, §5 |

**Table check** — exactly one target, research A-2:

```sql
CHECK (num_nonnulls(issue_id, project_id) = 1)
```

**`author_id` carries no delete action**, matching R6's `assignee_id`/`created_by` (R6 research A-5):
§4 never deletes a user, so there is no cascade to declare and no null-out to implement — authorship
survives removal from the project and deactivation alike (`FR-017`).

**No `edited_at` or edit history.** `updated_at` alone marks that an edit happened; the specification
names no requirement to show a prior version, and none is invented.

---

## 2. `activity`

One append-only entry in the same feed as a project's or an issue's comments. §5, `activity`.

| Column | Type | Constraints | Requirement |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `$defaultFn(uuidv7)` | `FR-005`, `OT-DATA-001` |
| `actor_id` | `uuid` | `NOT NULL`, → `user.id`, no delete action | `FR-002` |
| `type` | `text` | `NOT NULL`, `CHECK` over seven values | `FR-004`, research A-6 |
| `issue_id` | `uuid` | nullable, → `issue.id` `ON DELETE CASCADE` | `FR-002`, research A-3 |
| `project_id` | `uuid` | nullable, → `project.id` `ON DELETE CASCADE` | `FR-002`, research A-3 |
| `field` | `text` | nullable | `FR-002` |
| `from_value` | `text` | nullable, `CHECK (char_length ≤ 200)` | `FR-002`, `FR-008` |
| `to_value` | `text` | nullable, `CHECK (char_length ≤ 200)` | `FR-002`, `FR-008` |
| `comment_id` | `uuid` | nullable, → `comment.id` `ON DELETE CASCADE` | `FR-002`, research A-4 |
| `created_at` | `timestamptz` | `NOT NULL` | `FR-005`, §5 |

**No `updated_at`.** `FR-003` requires the absence, asserted against the table object's own keys
(research A-5) — the row's only removal is a cascade, never a write.

**Table checks**:

```sql
CHECK (num_nonnulls(issue_id, project_id) = 1)              -- research A-2
CHECK ((type = 'comment') = (comment_id IS NOT NULL))        -- research A-4
```

**`type`'s `CHECK`**, research A-6:

```sql
CHECK (type IN ('created', 'field_changed', 'member_added', 'member_removed',
                 'archived', 'reopened', 'comment'))
```

**Indexes**, research A-8 — the only reads this feature issues:

```sql
CREATE INDEX ON comment  (issue_id, created_at);
CREATE INDEX ON comment  (project_id, created_at);   -- also serves FR-059's count
CREATE INDEX ON activity (issue_id, created_at);
CREATE INDEX ON activity (project_id, created_at);
```

---

## 3. The column this feature does not migrate: `user.feed_filter`

`text`, `NOT NULL DEFAULT 'all'`, `CHECK (feed_filter IN ('comments', 'all'))` — already present.
Research A-7 records the discovery: R1's own migration (`drizzle/0001_chubby_stellaris.sql`, commit
`0b3478b`) added this column to `user` when the table was first created, ahead of `FR-006`'s framing
of it as this feature's own addition. The shape matches `FR-006` exactly — same type, same default,
same two-value `CHECK` — so nothing is corrected; this feature's migration adds `comment` and
`activity` and touches no column on `user`. `setFeedFilter` (§5 below) is this column's first writer
and first reader outside R1's own migration.

---

## 4. What is read

### The feed

One `UNION ALL` per target (issue or project), keyset-paginated, research F-1:

```text
FeedRow
  id            string
  kind          'comment' | ActivityType
  actorId       string
  actor         PublicUser        joined in, never a bare id on the row a component renders
  createdAt     Date
  -- comment rows only
  body          string | null     mention tokens un-resolved; resolution is a render-time pass (E-1)
  canEdit       boolean | null    author === viewer
  canDelete     boolean | null    author === viewer || isAdmin
  -- activity rows only
  field         string | null
  fromValue     string | null
  toValue       string | null
```

`PublicUser` is R1's projection, reused unchanged — the same fields every earlier entry already reads
a user through (`id`, `firstName`, `lastName`, `avatarUrl`, `role`, `jobTitle`, `deactivatedAt`).

Query shape: `listFeed({ issueId } | { projectId }, cursor?, limit = 50)`, returning the 50 rows and
whether a next page exists. `canEdit`/`canDelete` are computed server-side per row against the
requesting actor, following the same "server decides, client renders the answer" split every earlier
entry's DTO already takes (R6 data-model §4).

### The mention list

`listMentionCandidates({ issueId } | { projectId })` → `{ scoped: PublicUser[], everyoneElse:
PublicUser[] }`, research E-2. `scoped` is that target's project's `project_member` rows plus every
admin, deactivated excluded — the same shape as R6's assignee pool
(`src/features/issues/server/issue-queries.ts`), read fresh, not imported, because this feature's
query additionally needs `everyoneElse` and the two features do not share a module for one query each
(Principle I — one call site apiece).

### The comment count

`countProjectComments(projectId)` → `number`. `count(*) FROM comment WHERE project_id = $1` — served
by the same index the project feed's own read uses (research A-8) — never counting a comment attached
to one of the project's issues (`FR-059`).

---

## 5. What is written

| Mutator | Rows written | Transaction |
| --- | --- | --- |
| `createComment` | one `comment` insert; one `activity` insert (`type: 'comment'`) | one (`FR-045`) |
| `updateComment` | one `comment` update, or **nothing** if the body is unchanged after trim | one statement |
| `deleteComment` | one `comment` delete; its `activity` row removed by cascade | one statement |
| `setFeedFilter` | one `user` update | one statement (research C-6) |

`updated_at` is written through `touched()` on every `comment` write (§5, `FR-005`). `activity` never
receives one (§2 above).

### What R7 adds inside R5's and R6's own transactions

| Mutator | Adds | New read this feature introduces |
| --- | --- | --- |
| `createProject` | one `created` row, one `member_added` row per seeded member | none — every value is already in hand (research D-1) |
| `updateProject` | one `field_changed` row per differing field | the stored row, now read unconditionally rather than only for the date pair (research D-2) |
| `setProjectStatus` | one `archived` or `reopened` row | none — the target value is the whole answer (research D-3) |
| `addProjectMember` | one `member_added` row | the added user's `publicUser` row, for `to_value` (research D-4) |
| `removeProjectMember` | one `member_removed` row | the removed user's `publicUser` row, for `from_value` (research D-4) |
| `createIssue` | one `created` row | none (research D-5) |
| `updateIssue` | one `field_changed` row per differing field | none — the delta already exists (research D-6) |

None of the seven additions changes what its mutator returns to the caller or what row it writes to
`project`, `project_member` or `issue` (`FR-054`, `FR-057`).

### The cascade, today and as it grows

`FR-058`. `deleteIssue` and `deleteProject`'s bodies are unchanged by this feature — the arm attaches
at the schema:

| Table | Reaches an issue via | Reaches a project via |
| --- | --- | --- |
| `comment` | `issue_id ON DELETE CASCADE` | `project_id ON DELETE CASCADE` |
| `activity` | `issue_id ON DELETE CASCADE` | `project_id ON DELETE CASCADE` |

Both arms are declared in this feature's own migration, on this feature's own tables — the same
mechanism R6's `data-model.md` §5 already named these two rows under, before this feature existed.

---

## 6. Entities the spec names that this feature does not model

- **Mention token** — `@[<user_id>]` inside `comment.body`. Not a column, not a join table: it is
  characters inside the text column FR-001 already bounds, resolved by a render-time pass (research
  E-1). Storing it any other way would create a second place the mention lives and a way for the
  stored body and a structured list to disagree.
- **Label activity, column activity** — R8's and R9's own values, added to `activity.type`'s `CHECK`
  by their own migrations (research A-6). This feature declares neither value and writes neither.
- **Notification** — R11's table. This feature computes no recipient set and writes no row to it.
- **Project, issue, project_member, user** — R1's, R5's and R6's. Read and, for the seven mutators
  in §5's second table, written into by this feature; created by none of them.
