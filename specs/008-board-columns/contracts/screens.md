# Contract — the Columns section

**Feature**: [`../spec.md`](../spec.md) · **Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md)

**No route is added.** This feature changes one section of one screen entry R5 already ships:
`/projects/:projectKey/details`. No settings page, no second screen, no modal-only surface for
columns, and nothing on `/projects/:projectKey` — FR-013, `OT-SCOPE-007`.

---

## The screen it edits

`src/app/(app)/projects/[projectKey]/details/page.tsx` — already renders for any signed-in actor and
already calls `notFound()` for an unknown key, so US4 scenario 6 needs no change there. It gains one
thing: the four column actions passed down, on the `admin` branch it already builds for members and
status and delete.

`src/features/projects/components/project-details-screen.tsx` — `ProjectDetailsScreenAdmin` gains the
four action props, following the shape already established for `addProjectMemberAction`,
`setProjectStatusAction` and the rest. `ColumnsSection` gains an optional `admin` prop, exactly as
`MembersSection` has one.

---

## Component tree

```
ColumnsSection                       admin?: ColumnsSectionAdmin
├── GridList  (react-aria-components/GridList)      role="grid"; one markup for every role
│   │         dragAndDropHooks — supplied ONLY for an admin              FR-031, E-2
│   └── GridListItem × n            one per column, in (sort_order, id) order    FR-014, FR-033
│       └── ColumnRow
│           ├── name    admin → EditableField      | everyone else → text        FR-024, FR-016
│           ├── kind    text for EVERY role, never a control                     FR-017
│           ├── count   ProjectColumnRow.issueCount, live per render             FR-015
│           └── Delete  admin only; visible + disabled with its inline reason
│                       when a refusal holds                                     FR-039
│               └── DeleteColumnDialog   DialogTrigger → Modal → Dialog          FR-039
└── AddColumnForm                    admin only; a name field and nothing else   FR-019, FR-020
```

Every control comes from `react-aria-components`; Tailwind supplies the visual layer only. Each
carries an accessible name, a visible focus indicator, and error text associated with its own control.
**No state and no refusal is conveyed by colour alone** — FR-018, `OT-UX-018`, §7,
`AGENTS.md` → React Aria Components.

`onPress`, never `onClick`. Interaction state through `data-hovered`, `data-pressed`,
`data-selected`, `data-focus-visible`.

---

## What each role is offered

| | Admin | Member | Signed-in non-member |
| --- | --- | --- | --- |
| Every column, in board order | ✅ | ✅ | ✅ |
| Name, kind, issue count | ✅ | ✅ | ✅ |
| Add control | ✅ | — | — |
| Editable name | ✅ | — | — |
| Drag affordance | ✅ | — | — |
| Delete control | ✅ | — | — |

FR-016 and US4 scenarios 1–2: the section is a **read-only list** for a non-admin, not a disabled one.
§2's general disabled-with-a-reason rule is displaced here by §3.8's specific statement — recorded in
the spec's Reconciliations. The one control inside this feature that *is* disabled-with-a-reason is an
admin's Delete on a column a refusal covers (FR-039).

Membership is never consulted anywhere in this section, for reads or writes (FR-009).

`refresh()` after each successful mutation is what makes FR-012 true: an admin whose role was revoked
loses the four controls on the next server render, and a write from their stale page is refused by the
server on its own account (US4 scenario 4).

---

## `AddColumnForm` — FR-019, FR-020, FR-021

- One `TextField`. **No kind control and no position control** — kind is fixed at creation as `open`
  and position is always last (US1 scenario 2).
- Validates per field and on blur. **The submit control stays enabled**; a missing or invalid name is
  reported inline rather than the control going dead (`OT-UX-011`).
- A collision renders inline, naming the existing column, from `duplicate_name.holder.name`. **No
  suffix is applied and no retry under another name is attempted** (FR-021, `OT-UX-012`).
- Waits for the server; shows in-flight state (`OT-UX-008`, §4 *Slow write*).
- Empty, whitespace-only, and 201-character names are refused inline **and** independently by the
  server (US1 scenarios 8–9).

## `ColumnRow`'s rename — FR-024, FR-025, FR-027

Reuses `src/features/projects/components/editable-field.tsx`, which already implements the gesture
FR-024 describes and has tests for it: activate the name → it becomes a field in place; Escape
reverts unchanged; blur or ⌘-enter saves; Ctrl-enter on a platform with no ⌘ key; focus returns to the
control when the field closes either way; **a blur whose value is unchanged makes no call at all**.

`EditableField` gains one thing — a fourth `EditableFieldSaveResult` variant,
`{ status: "conflict"; message: string }`, rendered inline with `role="alert"` and associated through
`aria-describedby`, instead of raising a toast, while still rolling the optimistic value back. R5's
four callers never return it and are unaffected. This is the minimal way to serve FR-025's *inline*
error without a second in-place-editing component ([`../research.md`](../research.md) E-3); it is
recorded in the plan's Complexity Tracking.

Exactly one `updateColumn` call runs per rename (US1 scenario 3). Applies optimistically; rolls back
with a message naming what failed and why (FR-027).

**Every refused rename is worded here and rendered inline**, through that same `conflict` variant —
never through `EditableField`'s `showToast` fallback, whose `defaultErrorMessage` default branch reads
*"Something went wrong. Try again."* and names neither what failed nor why (FR-027). `ColumnRow`'s
`onSave` adapter maps `UpdateColumnState` to an `EditableFieldSaveResult`, and a `forbidden` is mapped
to `conflict` rather than passed through as `forbidden`:

| `UpdateColumnState` | Variant | Message |
| --- | --- | --- |
| `duplicate_name` | `conflict` | *That name is already taken by the column {holder.name}.* |
| `forbidden` | `conflict` | *That rename wasn't saved — only an admin can rename a project's columns.* |
| `invalid_name` `required` / `too_long` | `invalid` | `EditableField`'s own wording, unchanged |

`conflict` is chosen over a fifth `EditableFieldSaveResult` variant because it already renders exactly
what FR-027 asks for — inline, `role="alert"`, `aria-describedby`, no toast, optimistic value rolled
back — and a second variant rendering identically is duplication Principle III and VI both refuse.
`EditableField`'s own `forbidden` branch is **not** changed, so R5's four callers keep the toast they
have (plan *Complexity Tracking*); the mapping lives in `ColumnRow`, this feature's own file.

## The reorder — FR-029, FR-031, FR-032

`useDragAndDrop({ getItems, onReorder })` from `react-aria-components/useDragAndDrop`, passed to the
`GridList` as `dragAndDropHooks`. **No pointer handlers, no HTML5 drag events, and no drag-and-drop
library** — `react-aria-components@1.20.0` ships `useDragAndDrop`, `DropIndicator` and `GridList` on
the subpath entries this codebase already imports from, and Principle IV forbids adding a library for
what an approved one already does ([`../research.md`](../research.md) E-2).

- `onReorder` fires once per drop and issues exactly one `moveColumn` call, with
  `{ columnId, targetColumnId, placement }` — a neighbour id, never an index or a `sort_order` string.
- The keyboard path is React Aria's own — Enter to lift, arrows to move, Enter to drop, Escape to
  abandon — which is what US2 scenario 4 and SC-013 need, with a visible focus indicator and an
  accessible name at every step, and no hand-written key handler.
- A drop outside the list or an abandoned drag never fires `onReorder`, so **nothing is written**
  (tenth Edge Case).
- A drop on the position the column already occupies is additionally caught server-side, so a bypassed
  call cannot write a no-op row either (FR-030, US2 scenario 3).
- Applies optimistically; rolls back with a message on refusal (FR-032).

**Where the rollback message renders.** A refused or failed reorder snaps the list back to the order
the server holds and renders its reason in **one inline `<p role="alert">` beneath the `GridList`**,
referenced by the list through `aria-describedby` — **not a toast**. This follows the two refusal
surfaces this feature already has: the uniqueness error is inline on the field it belongs to, and a
Delete refusal is inline on the control it disables. A drag has no field of its own, so the list is
the control the error belongs to (FR-018) — and the keyboard reorder path SC-013 requires leaves
focus *inside* that list, where an alert beside it is announced without moving focus to a separate
toast region. The message is cleared on the next successful drop.

| `MoveColumnState` | Message |
| --- | --- |
| `forbidden` | *That column wasn't moved — only an admin can reorder a project's columns.* |
| `not_found` | *That column wasn't moved — it has already been deleted. The list has been refreshed.* |
| `invalid_target` | *That column wasn't moved — a column can only be reordered among its own project's columns.* |
| `invalid_input` | *That column wasn't moved — that drop wasn't understood. Try the drag again.* |
| the call fails without returning a reason code | *That column wasn't moved. Try again.* |

`not_found` additionally refreshes the section, which is the stale-render case FR-010 and the eleventh
Edge Case already fix — the message says the column is gone and the refreshed list shows it gone.

## `DeleteColumnDialog` — FR-039, ninth Edge Case, SC-014

`DialogTrigger` → `Button` → `Modal isDismissable` → `Dialog`, the shape
`delete-project-control.tsx` already establishes. The dialog **names the column**. Confirm calls
`deleteColumn`; Cancel, dismiss and Escape each make **no call, write nothing, leave the activity feed
untouched**, and return focus to the Delete control they were raised from — which `DialogTrigger`
does on its own.

When a refusal holds, the trigger renders **visible and disabled** with that refusal's reason in an
inline `<p>` referenced by `aria-describedby` — never hidden, never a dead control. The reason comes
from `ProjectColumnRow.deleteRefusal`, selected by the same precedence function the mutator uses, so the control
and the server never word the same refusal differently (SC-004) and the control's enabled or disabled state
always agrees with the count rendered beside it (SC-010). That state describes the **last render** and is not a
promise about the server: `deleteColumn` re-evaluates the emptiness refusal inside its own lock, which is
authoritative and may still refuse an enabled Delete where an issue was moved into the column after that
render (SC-005, third Edge Case).

### The four refusals, worded — FR-038, SC-004

These four strings are the refusals' user-facing wording, fixed here as the activity sentences below
are fixed here, so no implementation invents the copy. Each states **its own** reason (FR-038); none is
a paraphrase of another and none is a generic "can't delete this". One string is shown at a time,
chosen by the precedence in [`mutators.md`](./mutators.md) *The fixed precedence*.

| `ColumnDeleteRefusal` | Message |
| --- | --- |
| `holds_issues` | *This column still holds issues. Move them to another column before deleting it.* |
| `last_column` | *This is the project's last column, and a project always has at least one.* |
| `last_canceled_kind` | *This is the project's last canceled column, and it's a member's only way to remove an issue.* |
| `last_done_kind` | *This is the project's last done column, so no work could be counted as done — and a column's kind can't be changed afterwards.* |

The same string serves both surfaces, from the one selection function: inline under the disabled
Delete control (FR-039) and in the `deleteColumn` refusal a bypassed control reaches (FR-040), so the
control and the server never word the same refusal differently (SC-004).

---

## The activity rows, rendered

`src/features/activity/components/activity-row.tsx` gains four cases in `buildSentence` — required,
not optional: its `switch` is exhaustive over `Exclude<ActivityType, "comment">` and `type-check`
fails without them ([`../research.md`](../research.md) C-2).

| Type | Sentence |
| --- | --- |
| `column_added` | *Ana added column Review* |
| `column_renamed` | *Ana renamed column Todo to Up next* |
| `column_reordered` | *Ana moved column Canceled to first* · *…after Todo* when `to_value` is set |
| `column_deleted` | *Ana deleted column Review* |

The feed itself, its reverse-chronological stream, its Comments-only toggle, its five-minute
collapsing (US5 scenario 6) and its 50-row pagination are entry R7's and are **not touched** — these
rows render inside them unchanged. Nothing appears on any issue's feed (FR-044, US5 scenario 7).

## Not built here

The board's rendering of the result (`/projects/:projectKey`, R10), any card, any grouping control,
`moveIssue`, a column colour or swatch, a kind editor, a notification, and Home's progress figure
(R12). No file under `src/app/(app)/projects/[projectKey]/` other than the details page is touched.
