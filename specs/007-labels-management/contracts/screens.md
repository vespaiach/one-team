# Contract — Labels (`/settings/labels`) and the two label pickers

**Feature**: Labels · **Entry**: R8 · **Spec**: [`../spec.md`](../spec.md)

## The one route

| Route | Guard | Fills |
| --- | --- | --- |
| `/settings/labels` | `isAdmin(actor)`, else `forbidden()` | a page R2 reserved but did not build ([`research.md`](../research.md) D-1) |

`/settings/labels` is the only new route this feature adds. The two pickers are fields inside routes
R6 already built (`/projects/:projectKey/issues/:issueNumber/details`,
`/projects/:projectKey/issues/new`) — this feature edits those two components, it does not add routes
for them.

A signed-in non-admin who reaches `/settings/labels` by direct URL, bookmark, or a role change
mid-session sees Forbidden (`FR-001`, §3.11); the sidebar's own entry is hidden for them before that,
per R2's shell contract and `OT-UX-003` (`FR-002`).

## Component structure

```
LabelsScreen                          synchronous — guard has already run in the page
├── (no labels) "No labels yet"        FR-004
└── (labels exist)
    ├── NewLabelButton                 "use client" — opens LabelFormModal with no `label` prop
    └── LabelTable
        └── LabelRow × n                name · issueCount · Edit · Delete
            ├── opens LabelFormModal    with this row's `label` prop                    FR-009
            └── opens DeleteLabelDialog                                                 FR-011, FR-012

LabelFormModal                        "use client" — Dialog, one instance, two modes    FR-006, FR-009
DeleteLabelDialog                     "use client" — AlertDialog, count from LabelView   FR-011

LabelPickerField                      "use client" — presentational, no commit of its own FR-017
├── (rail caller, in src/features/issues/) commits via addIssueLabel / removeIssueLabel  FR-015
└── (create-issue caller, in src/features/issues/) local selection, folded into createIssue's payload FR-016
```

## `/settings/labels`

1. Guard: `loadActor()`, `isAdmin(actor)` or `forbidden()`.
2. Query: `listLabelsWithUsage()` ([`../data-model.md`](../data-model.md) §3), wrapped in `Suspense`
   under the guard, never above it ([`research.md`](../research.md) D-7).
3. Render: header block ("Labels"), `NewLabelButton`, then the table or the empty line.

## `LabelFormModal` — Create and Edit, one component

- **Fields**: name (`TextField`, required, trimmed, validated on blur against `checkLabelNameAvailable`)
  — the label's only field (§3.10).
- **Submit**: `createLabel` or `updateLabel`, chosen by whether a `label` prop was passed in
  ([`research.md`](../research.md) D-2). Stays enabled through a missing or clashing name and reports
  the problem inline (`OT-UX-011`); disables only while its own request is in flight.
- **Cancel / Escape**: closes and discards every field's local state; writes nothing (`FR-008`).
- **On success**: closes, and the new or updated row is what the (revalidated) table already shows —
  no separate optimistic insert into a local list.

## `DeleteLabelDialog`

- Opens from a row's **Delete** control, in a React Aria `AlertDialog` ([`research.md`](../research.md) D-3).
- Body: the label's name and, when `issueCount > 0`, the exact sentence `FR-011` fixes — "It will be
  removed from 14 issues. This can't be undone." At `issueCount === 0`, the same confirmation without
  the count clause.
- Confirm calls `deleteLabel`; the dialog closes on `{ ok: true }` and the row disappears from the
  (revalidated) table. A refusal (`ok: false`, unexpected) closes the dialog and the change rolls back
  with the standard rejected-write toast (§4).

## `LabelPickerField` — the shared picker

A multi-select list of every team label (`listLabelOptionsForIssue`, [`../data-model.md`](../data-model.md)
§3), each option showing its name, `applied` rendering as a checked state
(`ListBox` with `selectionMode="multiple"`). At its foot, **Manage labels** — a link to
`/settings/labels`, rendered only when `actor.role === 'admin'` (`FR-018`, `OT-UX-003`,
[`research.md`](../research.md) D-6).

`LabelPickerField` itself holds no state about *how* a toggle is committed — that is each caller's own
concern ([`research.md`](../research.md) D-4):

### Caller 1 — the issue rail (`src/features/issues/components/issue-rail.tsx`, edited)

Toggling an option calls `addIssueLabel` or `removeIssueLabel` immediately, applied optimistically and
rolled back with a toast on refusal — the same convention every other rail control already follows
(column, priority, assignee, due date). For a non-member, the whole field renders disabled with the
rail's own inline reason (`FR-019`), exactly as the rest of the rail does; no option is togglable and
no mutator is ever called.

### Caller 2 — Create issue (`src/features/issues/components/create-issue-form.tsx`, edited)

Toggling an option updates local form state; no mutator runs per toggle. On submit, the selected label
ids ride inside `createIssue`'s own call, and the newly created issue's `issue_label` rows are written
in that same transaction — R6's `createIssue` gains one more field to accept and one more set of rows to
insert alongside its existing `issue` row, with no change to its authorization or its existing writes.

## What this feature wires into R6's screens

| Screen (R6's) | What changes |
| --- | --- |
| Issue detail rail | gains the `LabelPickerField` as a fifth quick-change control, alongside column, priority, assignee, due date (`FR-015`) |
| Create issue form | gains the `LabelPickerField` as an optional field, between Priority and Assignee, matching the field order §3.5's table states (`FR-016`) |
| `createIssue` (R6's mutator) | accepts an optional `labelIds: string[]`, inserting the matching `issue_label` rows in the same transaction as the `issue` insert |

No other R6 surface changes. The Board (R10) is untouched by this feature; card label chips are its
own, deferred entry.
