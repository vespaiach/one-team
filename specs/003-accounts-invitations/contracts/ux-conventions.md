# Contract — the four conventions R3 implements for the first time

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) E · **Stated by**: [`../../002-app-shell-ux/contracts/ux-conventions.md`](../../002-app-shell-ux/contracts/ux-conventions.md)

Entry R2 fixed five rules it had no surface for and wrote no code for any of them. A clarification
settled all five on R3, by first caller rather than by build order. This feature is where four of
them become real; the fifth — disabled-with-inline-reason — lands on the last-admin control and is
specified in [`accounts-screen.md`](./accounts-screen.md).

**R2's wording is binding.** Where this feature's `FR-054`…`FR-057` are terser than R2's
`FR-032`…`FR-035`, R2's is the requirement and this contract quotes it rather than paraphrasing. The
strings below are binding exactly as quoted.

---

## `OT-UX-016` — toasts · R2 `FR-034`, R3 `FR-054`

| Rule | R2's text | How |
| --- | --- | --- |
| Four kinds | success, info, warning and error | one union, all four in the type |
| Position | top-right | the region, fixed |
| Stacking | "newest nearest the corner", no limit fixed | the queue's own order |
| Auto-dismiss | "five seconds from the toast appearing" | the queue's timeout |
| Dismiss control | "every toast MUST also carry a dismiss control, so the timer is never the only way out of one" | a close `Button` on each |
| Announced | "React Aria's toast region rather than a hand-rolled live region" | `UNSTABLE_ToastRegion` |

```text
src/features/accounts/components/toast-region.tsx    "use client"

import {
  UNSTABLE_ToastRegion, UNSTABLE_Toast,
  UNSTABLE_ToastContent, UNSTABLE_ToastQueue,
} from "react-aria-components/Toast"
```

**The API ships `UNSTABLE_`-prefixed in `react-aria-components@1.20.0`.** R2's `FR-034` requires React
Aria's toast region by name, so the component is not optional; the prefix is the library saying the
API may move in a minor. `package.json` therefore pins **`"react-aria-components": "1.20.0"`** exactly,
replacing the caret range — the same move R2 made for `next@16.3.2` when it adopted `authInterrupts`.
Pinning a version is not adding a dependency; gate 4 is untouched
([`../research.md`](../research.md) E-1).

**Which kind, where:**

| Event | Kind | Requirement |
| --- | --- | --- |
| An invitation created and mailed | success | `FR-054`, US1 s12 |
| An invitation created, mail did not go | **warning** | `FR-017` — the write succeeded; the invitation stands |
| Resend, revoke, deactivate, reactivate completed | success | `FR-054` |
| Any rejected write | **error**, naming what failed and why | `FR-058`, US4 s13 |
| — | info | no caller in this entry; the set is four because `FR-054` fixes four |

---

## `OT-UX-005` — per-screen skeletons · R2 `FR-032`, R3 `FR-055`

| Rule | Held by |
| --- | --- |
| "matching the layout they replace" — same regions, same number, same dimensions | one skeleton per panel, built from the same table markup |
| "A full-screen spinner MUST NOT be used" | none is written |
| "data landing MUST NOT shift the layout: the tolerance is zero" | fixed row height and column widths, shared between skeleton and table |

```text
src/features/accounts/components/invitations-skeleton.tsx
src/features/accounts/components/roster-skeleton.tsx
```

**Two skeletons, not one shared component.** Principle I extracts at the second call site; these are
two different layouts, and a shared "skeleton" parameterised by shape would be the generic machinery
Principle III rejects for a rule whose whole content is *matching this particular layout*.

**Below the guard, never a `loading.tsx`.** R2's route-surface contract states the reason and this
feature inherits it: a `403` is a real status only while the response has not begun streaming, so a
`loading.tsx` above `requireActor()` turns the refusal into a streamed `200`. The skeletons render
inside the page, under the admin check ([`../research.md`](../research.md) E-3).

---

## `OT-UX-006` — re-query on navigation · R2 `FR-033`, R3 `FR-056`

| Half | How | Requirement |
| --- | --- | --- |
| Navigation | already true — the client router cache's `dynamic` stale time is `0`, so a page segment refetches on every navigation. **No cache configuration is added** | `FR-056`, US3 s9 |
| After a write | `revalidatePath("/settings/accounts")` at the end of every mutator | `FR-056`, `FR-059` |

R2's research A-7 established the first half and this feature adds nothing to it — a cache setting
written "to be sure" is the speculative configuration Principle III rejects. The second half is what
this feature owes: after a mutation the screen must not render the pre-write payload.

**The rule's subject is the screen**, as R2's `FR-033` says in full: the shell is not screen data, and
a frame persisting across navigation is framework behaviour, not a cache this requirement forbids.
This feature renders inside that frame and does not touch it.

---

## `OT-UX-017` — the lost connection · R2 `FR-035`, R3 `FR-057`

```text
src/features/accounts/components/connection-banner.tsx    "use client"
```

| Rule | R2's text, binding | How |
| --- | --- | --- |
| The banner | `"Can't reach the server. Reconnecting."` | one banner, above the tabs |
| Refusing writes | `"Changes need a connection"` | every action call short-circuits |
| Queueing | "Nothing MUST be queued for later" | nothing is stored, nothing replays |
| What counts as lost | "a request fails to **reach** the server — a transport failure, not an error the server itself returned" | `online`/`offline` events, plus an action call that rejects before a response |
| Clearing | "MUST clear on the next request that does reach the server" | the next successful action or navigation |
| Retry cadence | "'Reconnecting' obliges no retry cadence of its own" | no polling is written |

**The distinction is the requirement.** A server that answers with a refusal is a **rejected write** and
takes an error toast under `FR-058`; a request that never arrives is a **lost connection** and takes
the banner. Conflating them would put the banner up on every permission refusal.

**One banner, one screen.** It is built here because this is the first screen with writes. It is not
promoted into R2's shell: Principle I extracts at the second call site, and that is R4.

---

## Two rules that were already this feature's, restated so they are not lost

| Rule | Requirement | Where |
| --- | --- | --- |
| **A rejected write rolls back and raises a toast naming what failed and why** | `FR-058` | [`server-mutators.md`](./server-mutators.md), *Refusals* |
| **Every write waits for the server and shows in-flight state on its own control** — nothing is optimistic | `FR-059` | `useActionState`'s pending flag, per control |

`FR-059` is not a restriction this plan invents. `OT-UX-008` makes small local gestures optimistic —
drag, status, assignee, in-place field edits — and every write on this screen is either a create with
a server-assigned expiry or an account-state change behind a confirmation. Neither is that gesture
(spec *Assumptions*).

---

## What R4 inherits from this file

R4/Profile is the **second** caller for all four conventions, and its own spec already says so —
`FR-031`…`FR-034` there are obligations on that screen, not a claim on who authored them.

Under Principle I, R4 is where extracting a shared primitive becomes legitimate. Three candidates,
named here so R4 does not have to rediscover them:

| Candidate | Where it would go | Why not now |
| --- | --- | --- |
| The toast region and its queue | `src/components/ui/` | One call site. R4 is the second, and it wants the same region for `OT-UX-008`'s optimistic rollback |
| The connection banner | `src/features/shell/` — it belongs to the frame once two screens want it | R2 owns the shell and has no write; moving it there now would be R3 editing R2's layout for a caller that does not exist |
| A skeleton | nowhere | Two panels here and one screen there are three different layouts. `OT-UX-005`'s content is *matching this layout*, which is not shareable |
