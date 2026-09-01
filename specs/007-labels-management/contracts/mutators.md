# Contract — `createLabel`, `updateLabel`, `deleteLabel`, `addIssueLabel`, `removeIssueLabel`

**Feature**: Labels · **Entry**: R8 · **Spec**: [`../spec.md`](../spec.md) · **Data model**:
[`../data-model.md`](../data-model.md)

## Shared rules

- Every mutator is a Server Action, called only from `src/features/labels/actions.ts`, which carries
  the top-level `"use server"` (`AGENTS.md` → Structure).
- Every mutator re-derives its authorization inside its own call — no client-supplied `role` or
  `isMember` flag is ever trusted (`OT-AUTHZ-005`, restated for this feature by `FR-020`).
- Every mutator returns a typed result: `{ ok: true, ...data }` or `{ ok: false, error: <named reason> }`.
  Only a genuinely unexpected failure — a dead connection, a constraint this feature did not itself
  intend to hit — is allowed to throw ([`research.md`](../research.md) C-8).
- No mutator here accepts a raw database row as an argument or returns one; each takes and returns the
  DTOs [`../data-model.md`](../data-model.md) §3 defines.

---

## `createLabel`

**Requires**: `isAdmin(actor)` (`FR-001`, matching §2's write-rules table).

**Input**: `{ name: string, color: string }`.

**Validates** (server, independent of the modal's own on-blur checks — `FR-007`, Principle II):

1. `name` trimmed, non-empty, `<= 200` characters.
2. `color` is one of the seven palette values ([`../data-model.md`](../data-model.md) §1).
3. No existing label matches `lower(name)` — checked as the insert attempt, refused by the unique
   index if a race slipped past the pre-check ([`research.md`](../research.md) C-3).

**Writes** (one transaction): one `label` row.

**Returns**: `{ ok: true, label: LabelView }` with `issueCount: 0`, or `{ ok: false, error: 'duplicate_name', holder: { id, name } }` naming the clash (`FR-007`).

**Revalidates**: `/settings/labels`.

---

## `updateLabel`

**Requires**: `isAdmin(actor)` (`FR-009`).

**Input**: `{ id: string, name: string, color: string }` — both fields together, since the modal
`FR-009` describes edits both at once and there is no in-place single-field save the way an issue's
title is edited.

**Validates**: the same three checks as `createLabel`, with the clash check excluding the label's own
current row (renaming a label to its own existing name is not a clash).

**Writes** (one transaction): one `label` update, through `touched()`.

**Returns**: `{ ok: true, label: LabelView }` (its `issueCount` unchanged by this call) or
`{ ok: false, error: 'duplicate_name', holder }` / `{ ok: false, error: 'not_found' }`.

**Revalidates**: `/settings/labels`, plus every issue and board-card surface that renders this label —
served for free, since none of those surfaces cache the label row independently (`FR-010`; no separate
re-tagging step exists anywhere in this feature).

---

## `deleteLabel`

**Requires**: `isAdmin(actor)` (`FR-012`).

**Input**: `{ id: string }`.

**Precondition read**: `COUNT(*) FROM issue_label WHERE label_id = $1`, the same query the confirmation
dialog rendered ([`research.md`](../research.md) C-4) — read again inside this call's own transaction
so the count in the response matches the count the delete actually reached, even if it has moved since
the dialog opened.

**Writes** (one transaction): one `label` delete, cascading (at the database, not in this mutator's
own statements — [`../data-model.md`](../data-model.md) §4) to every `issue_label` row naming it.

**Returns**: `{ ok: true, removedFromIssueCount: number }` — the settled count, which the toast or the
dialog's own closing state may echo back to the admin who just confirmed it (`OT-DATA-008`).

**Revalidates**: `/settings/labels`.

**Does not write**: any `activity` row, on the label's own history (there is none) or on any issue it
was removed from (`FR-013`, the spec's explicit "by §3.10, not by omission").

---

## `addIssueLabel`

**Requires**: `isMember(actor, project)`, where `project` is derived server-side from
`issue.project_id` for the issue named by `issueId` — never from a client-supplied project id
(`FR-019`, `FR-020`).

**Input**: `{ issueId: string, labelId: string }`.

**Writes** (one transaction):

1. `INSERT INTO issue_label (issue_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`
   ([`research.md`](../research.md) C-5).
2. **Only when that insert actually added a row** (the database's own affected-row count, not a
   pre-check the mutator runs itself): one `activity` insert —
   `{ issueId, actorId: actor.id, type: 'label_added', toValue: label.name }`, written through the
   activity writer R7 establishes ([`research.md`](../research.md) C-6). **This step is blocked until
   R7's plan exists and names that writer's actual signature.** Every other line of this mutator does
   not depend on R7.

**Returns**: `{ ok: true, applied: true }` whether this call was the one that inserted the row or the
row was already present — the picker's post-condition ("this issue now carries this label") holds
either way, which is what makes the toggle idempotent from the caller's perspective (`FR-022`).

**Revalidates**: the calling issue's own detail path,
`/projects/:projectKey/issues/:issueNumber/details`.

---

## `removeIssueLabel`

**Requires**: the same `isMember` derivation as `addIssueLabel` (`FR-019`, `FR-020`).

**Input**: `{ issueId: string, labelId: string }`.

**Writes** (one transaction):

1. `DELETE FROM issue_label WHERE issue_id = $1 AND label_id = $2` — matches zero or one row and never
   raises on zero ([`research.md`](../research.md) C-5).
2. **Only when that delete actually removed a row**: one `activity` insert —
   `{ issueId, actorId: actor.id, type: 'label_removed', fromValue: label.name }`, through the same
   R7 writer `addIssueLabel` depends on and under the same block.

**Returns**: `{ ok: true, applied: false }`.

**Revalidates**: the calling issue's own detail path.

---

## What later entries attach here

Nothing. Unlike R6's mutators — which R7, R9, R10 and R11 each edit in place to add activity,
notifications, or grouping fields — no roadmap entry after R8 is named as reaching back into any of
these five. R10's board-card label chips (deferred, [`../spec.md`](../spec.md) Assumptions) read
`issue_label` directly for display; they call none of these mutators and none of these mutators change
to serve that read.
