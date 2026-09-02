# Phase 1 — Data model

**Feature**: Labels · **Entry**: R8 · **Date**: 2026-09-01

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) · **Research**: [`research.md`](./research.md)

Two tables added, one column altered on neither R5's nor R6's tables, and two DTOs handed to the
screens. Every column restates §5's *Key fields* or a numbered requirement, and the citation is on the
row.

---

## 1. The table this feature adds: `label`

`src/db/schema.ts`, appended after R6's `issue`.

| Column | Type | Null | Default | Why |
| --- | --- | :---: | --- | --- |
| `id` | `uuid` | no | `uuidv7()` server-side | `OT-DATA-001` |
| `name` | `text` | no | — | required, trimmed, unique case-insensitively, `FR-006`, `FR-007` |
| `color` | `text` | no | — | one of the seven palette values, `FR-014`, `OT-DATA-013` |
| `created_at` | `timestamptz` | no | written by the mutator | §5 |
| `updated_at` | `timestamptz` | no | written by `touched()` | §5 |

**Columns deliberately absent.** `project_id` — a label is never project-scoped (§3.10, "No
`project_id`: labels are never project-scoped"). `deleted_at` — the delete is hard (`OT-DATA-007`).
Each absence is asserted by a test, because each is a requirement rather than an omission
([`research.md`](./research.md) A-1).

### Constraints

| Constraint | Form | Requirement |
| --- | --- | --- |
| Name bound | `CHECK (char_length(name) <= 200)` | `FR-007`, §5 conventions ([research.md](./research.md) A-7) |
| Colour set | `CHECK (color IN ('#5b5bd6','#8b909a','#2f7fc4','#d4a017','#3a9d5d','#c8453c','#9b5de5'))` | `FR-014`, `OT-DATA-013` — the literal R5's research A-7 already wrote, reused ([research.md](./research.md) A-6) |
| Name uniqueness | `uniqueIndex("label_name_lower_idx").on(sql\`lower(name)\`)` | `FR-007`, `OT-INV-016` ([research.md](./research.md) A-5) |

### Indexes

One, and it is the uniqueness constraint above. Nothing else queries `label` by anything but its
primary key or its alphabetical `ORDER BY name` (FR-003), which is a sequential scan over a table this
team's size never needs an index to make cheap.

---

## 2. The table this feature adds: `issue_label`

The join between an issue and a label — a fact, not a record with its own history
([`research.md`](./research.md) A-2).

| Column | Type | Null | Why |
| --- | --- | :---: | --- |
| `issue_id` | `uuid` | no | half the composite key, `FR-019` |
| `label_id` | `uuid` | no | half the composite key, `FR-019` |

**Primary key**: `(issue_id, label_id)` — no synthetic `id`, matching R5's `project_member`
([`research.md`](./research.md) A-2). **Columns deliberately absent**: `created_at` / `updated_at` —
nothing orders by attachment time (`FR-003`'s list is alphabetical by label name, never by when a
label was applied).

### Constraints

| Constraint | Form | Requirement |
| --- | --- | --- |
| Belongs to a real issue | `FOREIGN KEY (issue_id) REFERENCES issue(id) ON DELETE CASCADE` | the cascade arm R6's own data-model already named, attributed to R8 ([research.md](./research.md) A-3) |
| Belongs to a real label | `FOREIGN KEY (label_id) REFERENCES label(id) ON DELETE CASCADE` | `OT-DATA-007`, §4 *Deleting a label* ([research.md](./research.md) A-3) |
| No duplicate attachment | the composite primary key itself | `FR-022` |

### Indexes

One beyond the primary key: `index("issue_label_label_id_idx").on(label_id)`. The primary key's
leading column (`issue_id`) already serves the rail's "which labels does this issue carry" read; this
index serves the labels page's per-label usage count and `deleteLabel`'s own cascade, both of which
walk the table by `label_id` and neither of which PostgreSQL indexes by default
([`research.md`](./research.md) A-4).

---

## 3. What the two screens read: `LabelView` and `LabelOption`

`AGENTS.md` forbids exposing a database row as a UI model. Two shapes, not one — the labels page needs
a usage count no picker ever renders, and a picker needs an applied/not-applied flag the labels page
has no concept of.

```
LabelView                                  — /settings/labels, one row per label
  id            string
  name          string                                                  FR-003
  color         string          one of the seven palette hex values     FR-003
  issueCount    integer         COUNT(*) over issue_label, this label   FR-003, FR-011

LabelOption                                — the picker, one entry per team label
  id            string
  name          string                                                  FR-017
  color         string                                                  FR-017
  applied       boolean         true on the issue the picker is open for  FR-022
```

`LabelOption` carries no usage count — the picker has no business showing it, and a field a picker
would never render is a field this feature does not fetch for it (VI).

### The two reads assembled

| Read | Shape | Requirement |
| --- | --- | --- |
| `listLabelsWithUsage()` | `LabelView[]`, alphabetical by `lower(name)` | `FR-003`, `FR-004` |
| `listLabelOptionsForIssue(issueId)` | `LabelOption[]`, every team label, `applied` computed by a `LEFT JOIN` against this one issue's `issue_label` rows | `FR-015`, `FR-016`, `FR-017` |
| `checkLabelNameAvailable(name)` | the holder's `{ id, name }` or `null` | `FR-007` ([research.md](./research.md) C-3) |

`listLabelOptionsForIssue` serves both pickers (the rail, Create issue) unchanged — Create issue's form
has no issue yet, so it calls the same query with no `issueId`, and every option comes back
`applied: false`. One query, two callers, the same shape D-4's presentational component already
assumes.

---

## 4. What is written

Five mutators, and the full contract for each is in [`contracts/mutators.md`](./contracts/mutators.md).
What lands in the database:

| Mutator | Rows written | Transaction |
| --- | --- | --- |
| `createLabel` | one `label` insert | one (`FR-008`) |
| `updateLabel` | one `label` update over changed columns only | one (`FR-010`) |
| `deleteLabel` | one `label` delete, plus every `issue_label` row the cascade reaches | one (`FR-012`, `OT-DATA-008`) |
| `addIssueLabel` | one `issue_label` insert (`ON CONFLICT DO NOTHING`), one `activity` insert when the row actually landed | one (`FR-021`, `FR-022`) |
| `removeIssueLabel` | one `issue_label` delete (zero or one row), one `activity` insert when a row was actually removed | one (`FR-021`, `FR-022`) |

`updated_at` on `label` is written explicitly through `touched()` on `updateLabel` only — never a
trigger, never a database default (§5). `issue_label` carries no `updated_at` to write.

### The cascade, and what this feature itself declares into R6's table

`FR-012`. This feature is the first to attach anything to `issue`'s own cascade beyond what R6 shipped
empty-handed — R6's data-model.md §5 named this exact arm in advance:

| Arm | Declared by | Table |
| --- | --- | --- |
| label joins | **R8 (this feature)** | `issue_label.issue_id ON DELETE CASCADE` |
| comments, activity | R7 | `comment.issue_id`, `activity.issue_id` `ON DELETE CASCADE` |
| notifications | R11 | `notification.issue_id ON DELETE CASCADE` |

`deleteIssue`'s own body, shipped by R6, does not change when this table appears — the database reaches
it without R6 ever being edited, exactly as R6's own plan promised.

---

## 5. Entities the spec names that this feature does not model

- **The `activity` rows `label_added` / `label_removed` write** — §5's `activity` table is R7's to
  create. This feature pins the exact shape each row takes ([`research.md`](./research.md) C-6) and
  writes through a function it does not own the definition of; the table itself is out of this
  feature's scope entirely.
- **Board card label chips** — deferred to R10 by the roadmap; nothing here renders on a card, because
  no card exists yet for this feature to render one on.
- **Issue, project, project membership, user** — R6's, R5's and R1's. Read only, and only where a
  requirement names the read (the issue's own `project_id` for `addIssueLabel`'s and
  `removeIssueLabel`'s authorization, `FR-020`).
