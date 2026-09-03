# Contract — Project details, `/projects/:projectKey/details`

**Plan**: [`../plan.md`](../plan.md) · **Spec** §3.8 · **Mutators**: [`mutators.md`](./mutators.md)

One screen. No separate settings page. Readable by every signed-in user; what a given user may change
is decided per section, not per screen, so the page looks the same to everyone and only its
affordances differ (`FR-035`, §3.8).

A key matching no project reads "This doesn't exist" and never implies a hidden-access state
(`FR-040`, `OT-UX-004`) — the notice is R2's, mounted through `notFound()`.

---

## Composition

```text
app/(app)/projects/[projectKey]/details/page.tsx    async — await params, load, compute two booleans
└── ProjectDetailsScreen                            synchronous, takes ProjectDetails
    ├── ProjectRecordSection      name · description · dates · key            FR-036…FR-039
    ├── StatusSwitch              "use client", admin only, optimistic        FR-041, FR-042
    ├── ColumnsSection            read-only list in board order               FR-044
    ├── MembersSection            roster + add/remove, admin only             FR-045, FR-046
    └── DeleteProjectControl      "use client", archived only, confirms       FR-047, FR-048
```

`canEditRecord` (`isMember`) and `canAdminister` (`isAdmin`) are computed once on the server and
passed down ([`../data-model.md`](../data-model.md) §6). Every control a user may not use renders
**disabled with an inline reason** — never a dead button, never tooltip-only (`FR-021`, `OT-UX-002`,
`SC-015`).

---

## The record — edited in place by members

`FR-036` and `OT-UX-009` fix the behaviour, identically on every surface that offers it:

| Gesture | Result |
| --- | --- |
| click the value | it becomes a field, in place — no edit mode, no separate form |
| Escape | the previous value returns, nothing is written |
| blur, or ⌘-enter | exactly one `updateProject` call, for that field alone |

**Optimistic, with a rollback that names the reason** (`FR-038`, `OT-UX-008`): the new value appears
immediately; a refusal reverts it and the toast names what failed and why. The toast primitive is R3's
or R4's, whichever is built first — R5 calls it ([`../research.md`](../research.md) F-3).

Four fields use it — name, description, start date, target date — so `EditableField` has four
call sites the day it ships, which is what makes extracting it Principle I rather than speculation.

**The key is a shown value, not a control**, and the screen states that it is immutable (`FR-037`,
`OT-UX-010`, `OT-INV-007`, `SC-005`). No route changes it.

**The description renders markdown on read and shows raw source while editing** (`FR-039`, §3.4,
§3.8). The grammar is [`markdown.md`](./markdown.md).

**A non-member sees every field, not clickable, each carrying an inline reason naming the project
they would need to be added to** (`FR-021`, US2 scenario 8). The server refuses their write
independently of the disabled control (`FR-014`).

**A member removed while the screen is open** keeps every row they wrote; only the controls change,
and only on the next render (`FR-020`, `OT-AUTHZ-012`, US2 scenario 9).

---

## Status — admin only

A two-state `Switch`, `active` ⇄ `archived`, applied optimistically (`FR-041`). Every other user sees
the current state as a disabled control carrying its reason.

Both transitions are legal, with no terminal state, no guardrail and no confirmation on the
transition itself (`FR-042`, `OT-OPS-011`). Archiving touches nothing else (`FR-043`, `OT-OPS-010`,
`SC-009`), and an archived project is still readable, still editable by its members, and still listed
— it is a lifecycle state, not a lock (spec, *Edge Cases*).

---

## Columns — a read-only list

Board order, showing name, kind and issue count per row (`FR-044`, §3.8).

**This feature offers no control that adds, renames, reorders or deletes a column.** R9
does, and with it `OT-INV-005`, `-006`, `-012` and `-014`, which are `deleteColumn`'s and have no
enforcer here (spec → *Out of Scope*).

`kind` is meaningful from day one — it is set by the seed and fixed at creation (`OT-INV-015`). The
issue count is `0` for every column until R6 lands; the field is real and the number is true
([`../research.md`](../research.md) D-8).

---

## Members — admin only

The roster, with add and remove. Members and non-members read it and see both controls disabled with
their reason (`FR-045`, US3 scenario 7).

**The roster reads `project_member` rows only** (`FR-018`, `OT-AUTHZ-006`), so an admin appears on it
only where they were added explicitly (US3 scenario 5) — while every admin may still write in the
project, roster or not (US3 scenario 6).

**Add member** lists accounts that already exist, excludes deactivated accounts, and excludes people
already on the roster (`FR-045`). There is no project-level invitation, no pending membership and
nothing to accept (`OT-SCOPE-005`).

**A deactivated member keeps their row and their place on the roster**, so reactivation restores the
access they had; the picker never offers them (spec, *Edge Cases*; §3.9).

**Removing the last remaining row succeeds**, with no guardrail and no confirmation (`FR-045`, US3
scenario 9).

**Add and remove apply optimistically and roll back with a message** (spec, *Assumptions*): one row
changed from one control is `OT-UX-008`'s small-write pattern, which is the half a roster toggle
falls in even though `OT-UX-008` does not name it.

**An added member can write on their very next request** — no acceptance, no re-authentication
(`FR-046`, `SC-007`).

---

## Delete — admin only, archived only

**Offered only while the project is `archived`.** On an active project the control is disabled with
its reason, *and* `deleteProject` refuses the call independently of the control (`FR-047`,
`OT-INV-008`, `SC-010`).

**One confirmation before anything is written, stating the size of what it will destroy** (`FR-048`).
The size is the count of rows the cascade actually reaches when the confirmation is shown — in this
feature the project's board columns and its membership rows — computed by `loadProjectDetails` and
passed in as a number.

> **Obligation on later entries.** Each entry that attaches a table to `deleteProject`'s cascade
> extends that count. `FR-048` puts it there rather than leaving the sentence to be rewritten:
> R6 (`issue`), R7 (`comment`, `activity`), R11 (`notification`).

**On confirmation** the project, its columns, its memberships and its counter row disappear together
in one transaction; no caller observes a partial state (`FR-050`, `FR-051`, `SC-011`), the response
carries the settled state, and the browser navigates away (`FR-052`).

**The key is immediately reusable** (`SC-012`).

---

## What is not on this screen

| | Owner |
| --- | --- |
| The Activity feed, its composer, its filter toggle and its collapsing | R7 |
| The header's comment count | R7 |
| Column add, rename, reorder, delete | R9 |
| Every issue count above zero | R6 |
| A project lead, a project role, any permission finer than membership | nothing — the specification gives a project members and nothing else |
