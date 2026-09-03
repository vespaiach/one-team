# Contract — what R5 adds to R2's shell

**Plan**: [`../plan.md`](../plan.md) · **Spec** §3, *The shell* · `FR-053`…`FR-056`

R2 builds the frame and leaves one thing for this entry: the project list's data and its ordering.
It is a reach-back into R2's module and is carried in the plan's Complexity Tracking. The project
header composes R2's `ScreenHeader` unchanged — its existing `name` and `context` props already
cover what `FR-056` needs, so there is no second reach-back.

---

## 1 · The sidebar's project list

R2 ships `src/features/shell/components/project-list-region.tsx` rendering one quiet empty line and
reading nothing. R5 gives it entries.

**The read** happens in `src/app/(app)/layout.tsx`, which already resolves the actor for the shell.
One query, `listProjectsForSidebar()`, returning `key`, `name` and `status`
([`../data-model.md`](../data-model.md) §5).

**The order** is one `ORDER BY`:

```sql
ORDER BY (status = 'archived'), lower(name)
```

`false` sorts before `true`, so every active project precedes every archived one; `lower(name)` makes
"Zephyr", "atlas", "Beacon" order as *atlas, Beacon, Zephyr* (`FR-053`, `OT-UX-020`, US5 scenario 1).

**It is identical for every user** and carries no user-controlled ordering — the list is not
personalised, and a project renamed to sort differently moves with no other action (`FR-053`,
`SC-013`, US5 scenarios 3 and 4).

**Every project is listed for everyone**, including non-admins and non-members: membership is a write
boundary, never a visibility one (`FR-017`, US5 scenario 5).

**Archived entries render after the active ones and dimmed** (`FR-053`).

**Each entry links to `/projects/:projectKey`** — R10's board route
(`FR-054`). The destination is fixed here; what answers at it is R10's.

**The empty line stays R2's.** An installation with no projects shows the one quiet line R2 already
renders, not an illustration (`FR-055`, `OT-UX-007`, US5 scenario 8). R5 adds no empty state.

The sidebar is a Server Component in the layout, so it is stale only as long as any layout is — and
each of this feature's mutators calls `refresh()`, which is what moves it after a create, a rename, a
status flip or a delete ([`../research.md`](../research.md) C-7).

---

## 2 · The project header

R2's `ScreenHeader` is composed by the **page**, not the layout, and takes:

```text
name       string
context    node | null
control    node | null
newIssue   node | null
```

§3 says a project-scoped screen's title block carries the project's name, its comment count and the
Board / Details tab pair. `FR-056` scopes that to the two this feature can supply.

| Piece | Slot | Requirement |
| --- | --- | --- |
| the project's name | `name` | `FR-056` |
| the Board / Details tab pair, current tab marked | `context` | `FR-056`, US5 scenarios 6 and 7 |
| the comment count | none — R7's | spec → *Out of Scope* |
| **New issue** | `newIssue` — R6's | R2's contract, R6's occupant |

**`ScreenHeader` is composed unchanged.** `name` and `context` already cover everything `FR-056`
asks for, so this is not a reach-back into R2's module at all — `project-header.tsx` is a new
component of this feature's own that calls R2's `ScreenHeader` with those two props.

**The tabs are links, built from React Aria `Tabs`**, with Details marked current on this screen and
Board pointing at `/projects/:projectKey` (`FR-056`, US5 scenarios 6 and 7).

---

## 3 · What R5 does not touch in the shell

| | Why |
| --- | --- |
| The `+` beside the project list | R2 renders it, admin-only and hidden not disabled (`OT-UX-003`). R5 only fills the route it points at |
| The Notifications entry and its unread count | R11 |
| Home's content | R12 |
| The Forbidden screen, the "This doesn't exist" notice, the banner slot, the user chip | R2's, rendered around this feature unchanged |
| The 262px width, the 1280px minimum, the absence of a breakpoint | R2's, and `OT-SCOPE-004` |
