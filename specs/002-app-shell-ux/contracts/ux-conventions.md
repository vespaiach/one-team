# Contract — the cross-cutting conventions this entry fixes

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md)

Entry R2 exists as much to settle rules as to render a frame. Six of the rules below are implemented
here; six are stated here and implemented by the first entry with a surface for them. This file is
what R3 through R12 read instead of re-deriving them.

---

## Implemented here

| Rule | Where it lands | Requirement |
| --- | --- | --- |
| **Navigation to an admin-only screen is hidden, never disabled** — Accounts, Labels, and the `+` into Create project | `sidebar.tsx` | `FR-011`, `OT-UX-003` |
| **Hiding is never the enforcement** — every route checks on the server, and a deep link, a bookmark or a stale tab is refused there | every `page.tsx` | `FR-014`, `FR-015`, `OT-AUTHZ-005` |
| **A display name is first and last name joined by one space**, everywhere | `display-name.ts` | `FR-017`, `OT-UX-019` |
| **A refusal renders inside the shell at the URL that refused**, never a takeover and never a redirect | `(app)/forbidden.tsx` | `FR-019`, `FR-020`, §3.11 |
| **A missing row and an unclaimed path read alike** — "This doesn't exist", never a hint of access | `not-found-notice.tsx`, two mounts | `FR-022`, `OT-UX-004` |
| **An empty surface is one quiet line** — no illustration, no empty-state marketing | `project-list-region.tsx` | `FR-024`, `OT-UX-007` |
| **React Aria supplies behaviour; the styling layer supplies appearance** — hand-build only where React Aria ships no equivalent, and reproduce the same keyboard, focus and ARIA behaviour | `sign-out-control.tsx` | `FR-030`, `OT-UX-018`, §7 |
| **Desktop only** — no responsive layout, no breakpoint, no collapse at any width | `app-shell.tsx` | `FR-010`, `OT-SCOPE-004` |

---

## Stated here, implemented by the entry that first has a surface

Six requirements, no test in this entry, and the spec marks each one inline. This is not an omission
under change gate 1: the entry has no caller for any of them, and gate 1 asks for no test it cannot
write. The roadmap's R2 row records the same reconciliation.

### Disabled with an inline reason — first implemented by R3

| Requirement | Rule |
| --- | --- |
| `FR-023`, `OT-UX-002` | Any action a user cannot take renders as a **disabled control carrying an inline reason**. Never a dead button. Never a tooltip as the only explanation. |
| `FR-013`, `OT-UX-021` | Navigation to a **member-only** screen follows the same rule rather than the hidden-navigation exception, because membership varies per project and a control that vanished on one board and returned on the next would teach the rule to nobody. The header's New issue control is that case. |

**Why not here.** Every control this entry renders is either usable by everyone or hidden under
`OT-UX-003`, and the one member-only control in the header contract — New issue — renders only on
project-scoped screens, which arrive with R5 and R6.

**First caller.** R3's last-active-admin **Deactivate** control, which §3.9 already specifies as
disabled with the reason inline. R4 has no counterpart, so R3 owns it whichever is built first.

### Loading, staleness, toasts and the lost connection — first implemented by R3

| Requirement | Rule |
| --- | --- |
| `FR-032`, `OT-UX-005` | Per-screen skeletons matching the layout they replace. Never a full-screen spinner; data landing never shifts the layout. |
| `FR-033`, `OT-UX-006` | A revisited screen re-queries the server; nothing renders from a client cache. |
| `FR-034`, `OT-UX-016` | Toasts are four kinds — success, info, warning, error — top-right, stacked, auto-dismissing. |
| `FR-035`, `OT-UX-017` | A lost connection shows one banner, "Can't reach the server. Reconnecting.", and refuses writes with "Changes need a connection". Nothing is queued. |

**Why not here.** The shell loads nothing, and its one write — sign-out — ends the session and leaves
the application, so there is no optimistic state to roll back, nothing to re-query and no skeleton to
show.

**First caller.** R3, for all four: its invitation create, its `deactivateUser` and `reactivateUser`
writes, and the two lists `/settings/accounts` loads. R4's one in-place field edit is their second
caller, so R3 owns them whichever is built first — the same reasoning that settles `FR-023` above,
and R4's spec already consumes the four on that footing.

**Two things the implementing entry inherits from this one:**

- `FR-032`'s skeleton goes **below** the route's authorization guard. A `loading.tsx` above it turns
  a `403` or `404` into a streamed `200` ([`route-surface.md`](./route-surface.md)).
- `FR-033` is already true for pages: the client cache's `dynamic` stale time defaults to `0`, so a
  page segment is refetched on every navigation. Shared layouts are reused rather than refetched, and
  this entry adds no cache setting either way ([`../research.md`](../research.md) A-7).

---

## No component library

Under Principle I a shared primitive is extracted at its **second** call site. This entry builds the
shell's own components and nothing speculative, and `src/components/ui` is not created — the roadmap
says so in §1.1 and R1 made the same call. The first primitive with two real callers is the first one
extracted.
