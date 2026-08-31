# Contract — Create issue and Issue detail

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**:
[`../research.md`](../research.md) group D

Two routes, both registered by R2 as pages whose whole body is a guard. This feature replaces the
bodies. Neither route is added and neither is moved — `OT-SCOPE-007`'s screen table is closed, and
these are two of its rows.

---

## The two routes

| Route | Screen | Access | Guard order |
| --- | --- | --- | --- |
| `/projects/[projectKey]/issues/new` | Create issue, full page (`FR-027`) | signed in **and** `isMember` | actor · project exists · membership |
| `/projects/[projectKey]/issues/[issueNumber]/details` | Issue detail, full page (`FR-041`) | any signed-in user | actor · issue exists |

`params` is asynchronous in Next.js 16 and is awaited in both.

### Create issue decides existence before authorization, and must

R2's convention is the reverse: an admin-only route refuses before revealing whether anything is
there. `isMember` is a predicate over a project, so there is no membership question to answer until
the project is resolved — a key matching nothing has no project to check against. The spec's edge
case fixes the outcome: *"Create issue opened for a project key that matches nothing reads 'This
doesn't exist' rather than Forbidden"*.

Nothing leaks. `OT-AUTHZ-002` makes every project readable by every signed-in user, so a project's
existence is not a fact membership was hiding. Full reasoning in
[`../research.md`](../research.md) D-1.

```
requireActor()                       → redirect /signin        FR-029
resolve project by key               → notFound() if none      FR-046, OT-UX-004
isMember(actor, project)             → forbidden() if not      FR-029, OT-SEC-015
load columns + assignee pool
render <CreateIssueForm …/>
```

The disabled control and the Forbidden screen are independent — neither implies the other was
skipped (`FR-029`).

### Issue detail refuses nobody past sign-in

```
requireActor()                       → redirect /signin        FR-041
resolve issue from (projectKey, number) → notFound() if none   FR-046, FR-017
read isMember and isAdmin for presentation only
render <IssueDetail …/>
```

`FR-021` gives every signed-in user read access to every issue. The write boundary is expressed as
disabled controls carrying an inline reason (`FR-026`), never as a refused page — which is why an
assigned non-member reaches their own issue and reads it (`FR-023`).

Issue number 7 in `WEB` and issue number 7 in `API` are different rows and the pair is the address:
the query filters on both, and a number that exists only in another project does not resolve
(`FR-017`, US2 scenario 5).

---

## Component structure

Every `page.tsx` is a thin async wrapper over a **synchronous** component taking plain props. Vitest
cannot render async Server Components and this repository has no E2E runner and cannot add one (IV),
so this split is what makes gate 1 reachable for every acceptance scenario
([`../research.md`](../research.md) D-2). It is R2's constraint, followed unchanged.

```
src/features/issues/components/
  create-issue-form.tsx      "use client"  the form, useActionState        FR-030…FR-039
  issue-detail.tsx           synchronous   main column + 262px rail        FR-042, FR-043
  issue-key.tsx              "use client"  the key and its copy control    FR-042
  editable-text.tsx          "use client"  title and description, one component  FR-048, FR-049
  issue-rail.tsx             "use client"  the four quick-change controls  FR-051, FR-052
  delete-issue-control.tsx   "use client"  the control and its confirmation  FR-061, FR-062
```

`editable-text.tsx` has two call sites in the commit that creates it — title and description — so
Principle I's precondition is met on arrival rather than guessed at. It is **not** promoted to
`src/components/shared`: R5's project details has its own in-place fields, and if the two prove
identical the promotion happens then, with both callers visible
([`../research.md`](../research.md) D-4).

The rail's four controls are **not** abstracted behind a shared field component. Three React Aria
`Select`s that differ in what they render per item, plus a date input, do not justify a render-prop
indirection today (III). R10's board is the second call site if there is one
([`../research.md`](../research.md) D-6).

---

## Create issue — the form

| Field | Control | Default | Requirement |
| --- | --- | --- | --- |
| Title | single-line text, first and focused, required | — | `FR-030` |
| Description | growing multi-line, raw source, no preview, no toolbar | empty | `FR-031`, `FR-044` |
| Column | React Aria `Select` over the project's own columns | the first by board position | `FR-032` |
| Priority | React Aria `Select`, five values | **No priority** | `FR-033` |
| Assignee | React Aria `Select` over the pool | Unassigned | `FR-034`, `FR-022` |
| Due date | native `<input type="date">` | empty | `FR-035`, D-7 |

The project is fixed by the route and is not a field (`FR-036`). Labels are not rendered at all —
entry R8.

**Validation is per field and on blur** (`FR-037`, `OT-UX-011`). The Create control stays enabled and
reports what is missing inline; it never goes dead. An over-length title or description is an inline
error on the field naming the bound — nothing is truncated, nothing is capped at the keyboard, and no
save is issued (`FR-037`, `SC-016`).

**The write is not optimistic** (`FR-038`, `OT-UX-008`). The control shows in-flight state, the form
waits, and no key is displayed anywhere until the server supplies the number (`FR-015`). On success
the browser lands on the new issue's page; Cancel returns to where the user came from and writes
nothing (`FR-039`).

**The due date uses a native input rather than React Aria's `DatePicker`.** Driving `DatePicker`
means importing `@internationalized/date`, which is not in `AGENTS.md`'s approved table, and gate 4
refuses a dependency whose approval was not recorded beforehand. The native control is the platform's
own — its keyboard, focus and ARIA behaviour are the browser's — and its value is exactly the
`YYYY-MM-DD` the column stores. Flagged for the team in [`../research.md`](../research.md) D-7: if
they want `DatePicker` across R5, R6 and R12, the amendment should be made once, before R5 is built.

---

## Issue detail — the page

**Layout**: a main column plus a **262px** meta rail (`FR-042`, §3.4). The same 262px the sidebar
uses; desktop only, no breakpoint (`OT-SCOPE-004`).

**Main column**, in this order (`FR-043`): the key, the title, the description. The key is the page's
first element and the copy-link target (`FR-042`) — a React Aria `Button` writing `location.href` to
the clipboard, interactive for every user regardless of membership, because copying a link is not a
write.

Activity does not appear. Entry R7 (`Out of Scope`).

**Rail**, in this order:

| Row | For a member | For everyone else |
| --- | --- | --- |
| Column | `Select` over this project's columns only (`FR-052`) | disabled, inline reason |
| Priority | `Select`, five values | disabled, inline reason |
| Assignee | `Select` over the pool, clearable | disabled, inline reason |
| Due date | date input, clearable | disabled, inline reason |
| **Delete** | disabled unless `isAdmin`, inline reason (`FR-061`) | disabled, inline reason |
| Project · Created by · Created · Updated | shown values, never controls (`FR-045`, `OT-UX-010`) | identical |

No label picker. Entry R8.

**The page renders identically for every user in structure** and differs only in which controls are
enabled (`FR-047`, `SC-012`). Nothing is hidden for a permission reason: §2's hide-rather-than-disable
exception is admin-only *navigation* and nothing else, and there is no navigation on this page.

---

## In-place editing

`FR-048`, `OT-UX-009`, and identical on both fields:

| Gesture | Behaviour |
| --- | --- |
| Click the value | it becomes a field |
| Escape | reverts to the saved value, writes nothing |
| Blur, or ⌘-enter | saves — exactly one `updateIssue` call, for that field alone |
| Blur with nothing changed | no call at all (the spec's own assumption; the mutator's half is `FR-055`) |

Title is a single line, required and trimmed. Description is a multi-line area that grows with its
content, showing **raw markdown source** while editing and rendered markdown on read (`FR-044`,
`FR-049`). There is no preview and no formatting toolbar, on either write surface.

An over-length value keeps the field open carrying an inline error naming the bound and issues no
save, so both write surfaces refuse it the same way (`FR-049`, `SC-016`).

**Optimistic apply and rollback** (`FR-050`, `OT-UX-008`): `useOptimistic` holds the pending value
for the transition wrapping the action; a failure ends the transition, the optimistic value is
discarded, the server value re-renders, and a toast names what failed and why. There is no manual
previous-value bookkeeping to get wrong ([`../research.md`](../research.md) D-5).

React Compiler is enabled, so no `useMemo`, `useCallback` or `memo` is hand-written; in exchange no
optimistic value is mutated during render.

For a non-member the title and description are **not clickable** and carry the same disabled reason
as the rail (`FR-054`).

---

## The delete control and its confirmation

`FR-061`, `FR-062`. The control sits in the rail beneath the four editable rows — visible to
everyone, enabled only for an admin, disabled with an inline reason for everyone else, never hidden.

The confirmation is a React Aria `AlertDialog` inside a `Modal`: focus trap, `alertdialog` role,
Escape closes, and the destructive action is not the autofocused control. It confirms **once**, and
no path exists that destroys an issue without it.

Its sentence names the issue by key and title, and states the size of what the cascade will destroy
alongside it — the convention a project delete (§3.8) and a label delete (§3.10) already use. Today
the cascade reaches nothing, so it names the issue and no count, which §3.10's own zero-case clause
requires to read as an ordinary confirmation rather than a special one:

> Delete **WEB-142 · Fix the sign-in redirect**? This can't be undone.

The count's absence is a list with no elements, read on every render, not a seam. R8 and R11 each add
a clause naming their own rows as they attach their arms (`FR-062`).

On success the browser lands on `/projects/:projectKey/details` — R5's route, so the destination
exists when this feature lands (`FR-060`).

---

## What this feature wires in R5's and R2's shell

**The header's New issue control.** R2 delivered the slot and deferred its destination here; R5
renders the header on project details. This feature points the slot at
`/projects/:projectKey/issues/new` on **every project-scoped screen that exists when it lands** —
project details (R5's) and these two — and gives it `OT-UX-021`'s treatment for a non-member: visible,
disabled, carrying a reason naming the project, never hidden (`FR-028`). R10 brings the board's own
entry points under the same rule.

This means editing R5's project-details page to fill a slot R2 built. It is recorded in
[`../plan.md`](../plan.md)'s *Complexity Tracking* rather than left for a reviewer to find.

**What is consumed unchanged**: the `(app)` shell and its 262px sidebar, the Forbidden screen, the
"This doesn't exist" wording, the per-screen skeleton convention, the toast conventions and the
disabled-control-with-inline-reason rule — all R2's, all rendered around these screens
([`../../002-app-shell-ux/contracts/ux-conventions.md`](../../002-app-shell-ux/contracts/ux-conventions.md)).
The project header's colour dot, name and Board / Details tabs are R5's and are unchanged. The
project header's comment count is R7's and does not appear.
