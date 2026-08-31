# Contract — the four cross-cutting conventions this entry lands

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**: [`../research.md`](../research.md)

Entry R2 states four rules and writes no code for them, because the shell loads nothing and its one
write leaves the application. Entry R4 has both a load and a write, so it honours all four
(`FR-031`–`FR-034`).

**They are not one obligation of the same kind, and this entry does not treat them as a transferable
bundle.** The spec's clarification split them by kind rather than by build order: two are per-screen
work this screen authors for itself in either order, and two are single app-wide instances that live
in the shell and that no entry owns. Nothing below depends on whether R3 or R4 is built first, and
this entry adds no dependency on R3.

---

## Per-screen: authored here, for this screen, and not shared

### `FR-031` · The skeleton · `OT-UX-005`

| | |
| --- | --- |
| What | `ProfileSkeleton` — the same rows as `ProfileScreen`, at the same heights, in the same order |
| Where | `src/features/profile/components/profile-skeleton.tsx`, beside the component it stands in for |
| Placement | inside a `Suspense` boundary **below** the route's authorization guard, never in a `loading.tsx` above it ([R2 `ux-conventions.md`](../../002-app-shell-ux/contracts/ux-conventions.md)) |
| Never | a full-screen spinner. Data landing shifts no layout |

**Why nothing is extracted.** A skeleton matches the layout it replaces, by its own definition. One
that matched both this screen and R3's roster would match neither. There is no shared component to
inherit and none to extract (Principle I).

### `FR-032` · Re-query on revisit · `OT-UX-006`

| | |
| --- | --- |
| What | a revisit by in-app navigation or reload queries the server; nothing renders from a client cache. Browser back/forward is the one case outside the rule, named by `FR-032` itself |
| How | the framework's own default. The client cache's `dynamic` stale time is `0` — "not cached" — and this page is dynamic because it reads `cookies()` through `loadActor()` |
| Configuration added | **none.** `next.config.ts` is untouched by this entry |

**Why nothing is extracted.** This is a data-fetching posture, not a component. It holds identically
whichever entry is built first, and there is no artefact for a second caller to share.

**The back/forward exception is in the requirement, not only here.** The same framework setting
explicitly does not change back/forward caching, "to prevent layout shift and to prevent losing the
browser scroll position"
(`01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md`). A browser Back to `/profile`
may restore a remembered tree, and this entry does not override that: the only writer of this record
is this screen, so a restored tree can only be stale against the same user's own edit in another tab,
and the stored row — which is what `SC-002` is about — is unaffected. `FR-032` states that exception
in its own words, so the requirement and this contract describe one behaviour rather than the design
narrowing an absolute.

---

## App-wide singletons: one instance in the shell, owned by no entry

Both are mounted once in R2's `src/app/(app)/layout.tsx`. Every screen consumes them; no screen
stands up a second. Whether they already exist when this screen is built or arrive with it, no entry
owns them — which is why this contract describes them as the shell's rather than as R4's.

### `FR-033` · The message host · `OT-UX-016`

| | |
| --- | --- |
| What | four kinds — success, info, warning, error — shown top-right, newest nearest the origin, auto-dismissing after five seconds, at most three visible with the rest queued (`FR-033`) |
| The host | `src/features/shell/components/message-host.tsx`, rendering `UNSTABLE_ToastRegion` from `react-aria-components/Toast` |
| The queue | `src/features/shell/messages.ts`, one module-level `UNSTABLE_ToastQueue` configured `timeout: 5000` and `maxVisibleToasts: 3`. A screen raises a message by calling `messages.add(…)`; auto-dismiss is the queue's own `timeout`, whose five-second floor React Aria enforces for readability. Each `add` is its own entry — identical refusals are not coalesced (`FR-033`) |
| Mounted | once, in `(app)/layout.tsx`. **A screen must not stand up a second host** (`FR-033`) |
| This entry's callers | a refused save (`FR-014`), a refused write while offline (`FR-034`), the change-password confirmation (`FR-029`) and its throttle refusal (`FR-028`) |

**Why React Aria's rather than a hand-built stack.** AGENTS.md permits a hand-built component only
where React Aria ships no equivalent. The installed `react-aria-components@1.20.0` ships one, and its
region carries the landmark and live-region semantics a hand-built stack would have to reproduce
exactly. The exports are `UNSTABLE_`-prefixed; that adoption is recorded in the plan's Complexity
Tracking, and it adds no dependency and edits no version range — the lockfile pins `1.20.0` and CI
runs `npm ci` ([`../research.md`](../research.md) D-3).

### `FR-034` · The connection banner · `OT-UX-017`

| | |
| --- | --- |
| What | one banner reading **"You're offline. Changes can't be saved."** while the connection is lost, and writes refused with **"Changes need a connection"** — the banner's text and the refusal's are two strings, not one (`FR-034`) |
| How | `navigator.onLine` plus the `online` and `offline` window events — the Web platform's own, so no dependency (Principle IV) |
| Where | `src/features/shell/components/connection-banner.tsx`, rendered into R2's banner region so it stacks with the must-change-password banner rather than replacing it |
| Mounted | once, in `(app)/layout.tsx`. One banner for the whole application, never one per screen (`FR-034`) |
| Queueing | **none.** A save attempted while offline is refused *before* the action is dispatched, so there is no in-flight request to retry and no pending state to hold |

The refusal takes the same rollback path as any other refusal ([`../research.md`](../research.md)
B-1, D-5), so offline is not a second failure mode with its own code.

---

## What this entry does **not** land from R2's stated-not-implemented set

| Requirement | Rule | Why not here |
| --- | --- | --- |
| R2 `FR-023`, `OT-UX-002` | an action a user cannot take renders as a disabled control carrying an inline reason | This screen has no such control. Every one of its controls is usable by the person looking at it — a profile has exactly one person who may edit it, and they are the only one who can reach it. R2's contract already assigns this to R3's last-active-admin **Deactivate** control, "whichever is built first" |
| R2 `FR-013`, `OT-UX-021` | member-only navigation follows the same rule rather than the hidden-navigation exception | There is no membership on this screen and no project-scoped control. R5 and R6 bring the first |

---

## No shared write path exists to extract

R3's writes wait for the server and show in-flight state on their own control (R3's `FR-059`); this
screen's saves apply optimistically and roll back (`FR-014`, `OT-UX-008`). The two are deliberately
different postures, which `OT-UX-008` itself distinguishes — small local writes optimistic, larger
writes waiting. A primitive covering both would be an abstraction over a difference rather than a
shared shape, which Principle I forbids. The in-place editing control this entry builds stays inside
`src/features/profile`; its second surface is R5's project details, and that is where promotion to
`src/components/ui` belongs.
