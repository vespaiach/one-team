# Contract — the route surface and its guards

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) A-4…A-9

`FR-028` fixes the surface at §3's thirteen screens and nothing else. `FR-029` fixes the order in
which each of them answers: **may you be here** is decided before **is anything here**. This contract
is what a later entry replaces, one route at a time.

---

## Every route, and what it does in this feature

| Screen | Route | Guard registered here | Answer in this feature | Filled by |
| --- | --- | --- | --- | --- |
| Home | `/home` | signed in | the frame, no header, empty content | R12 |
| Board | `/projects/[projectKey]` | signed in | `notFound()` | R10 |
| Issue detail | `/projects/[projectKey]/issues/[issueNumber]/details` | signed in | `notFound()` | R6 |
| Create issue | `/projects/[projectKey]/issues/new` | signed in · *member half is R5's* | `notFound()` | R6 |
| Create project | `/projects/new` | signed in + **admin** | `forbidden()` · else `notFound()` | R5 |
| Project details | `/projects/[projectKey]/details` | signed in | `notFound()` | R5 |
| Notifications | `/notifications` | signed in | `notFound()` | R11 |
| Accounts | `/settings/accounts` | signed in + **admin** | `forbidden()` · else `notFound()` | R3 |
| Labels | `/settings/labels` | signed in + **admin** | `forbidden()` · else `notFound()` | R8 |
| Profile | `/profile` | signed in | `notFound()` | R4 |
| Forbidden | *no route of its own* | — | `(app)/forbidden.tsx`, rendered in place | **R2** |
| Sign in · reset request | `/signin`, `/reset` | public | R1's, untouched | R1 |
| Change password | `/reset?token=…` | public | R1's, untouched | R1 |
| Invite acceptance | `/invite/accept` | public | **not registered** — see below | R3 |

**`/invite/accept` is deliberately left closed.** `OT-SEC-002` fixes the reachable-by-a-stranger set
at four routes; R1 opened three and left this one shut until R3 owns it. `FR-029`'s reasoning does
not reach it: a public route has no guard to register, so leaving it closed makes no screen
untestable. The spec's registration note is about the authenticated group this feature owns.

**The `member` Access column is honoured as far as it can be.** `isMember` needs `project` and
`project_member`, which arrive with R5. Until then `/projects/[projectKey]/issues/new` carries the
signed-in guard, and `SC-014` is scoped to admin-only routes for exactly this reason
([`../research.md`](../research.md) A-6).

---

## The shape every guard-only route has

```text
export default async function Page() {
  const actor = await requireActor()          // redirects to /signin when there is none   FR-021
  if (actor.role !== 'admin') forbidden()     // admin-only routes only                    FR-019
  notFound()                                  // until the owning entry lands              FR-022
}
```

Three properties are load-bearing, and each is asserted:

1. **`requireActor()` is first.** An unauthenticated caller is redirected and never reaches Forbidden
   (`FR-021`, `OT-SEC-015`).
2. **The role check precedes `notFound()`.** A member asking for an admin-only route is refused at
   the real URL; an admin asking for the same undelivered route is told it does not exist
   (`FR-029`, `SC-014`, US3 scenarios 3 and 8).
3. **Both terminals throw.** Neither can be forgotten by a later author the way a `return` can, and
   both leave the requested URL untouched (`FR-020`).

**No `loading.tsx` above a guard.** The `403` and `404` are real status codes only while the response
has not begun streaming; a skeleton placed above one of these checks turns the refusal into a `200`
(`04-functions/forbidden.md`, *Status codes*). When R3 and R4 implement `FR-032`, the skeleton goes
below the guard.

---

## The two refusal screens

### `(app)/forbidden.tsx` — §3.11

Renders inside the shell, and renders the full frame:

```text
<ScreenHeader name="Forbidden" />        title block names Forbidden itself,
                                         both slots empty                    FR-019
<ForbiddenNotice />                      the error code · one sentence ·
                                         a route back to Home                §3.11
```

Reached only by `forbidden()`. It is not a route, it takes no props (`03-file-conventions/forbidden.md`),
and the URL in the address bar is the one that refused (`FR-020`).

Enabled by `experimental: { authInterrupts: true }` in `next.config.ts`, which this feature adds.

### Not found — one wording, two mounts

| File | Catches | Frame |
| --- | --- | --- |
| `(app)/not-found.tsx` | `notFound()` thrown by any route in the group — an undelivered screen now, an absent record later | inside the shell |
| `src/app/not-found.tsx` | a URL that matches no route at all | root layout only; the shell is not in that tree |

Both render `<NotFoundNotice />` and no header — a path that matches nothing is not a screen and has
no name for a title block ([`../research.md`](../research.md), *Assumptions carried forward* 2).
`FR-022` and `SC-008` ask for one wording, and one component is what produces it.

An unauthenticated caller never reaches either: R1's `proxy.ts` redirects a request with no session
cookie before it matches anything.

---

## What a later entry does to this contract

Replace the route's `page.tsx` body with the screen, keeping the guard as its first statements. Do
not move the guard into a layout, and do not remove `notFound()` from a route whose screen is still
absent. Three routes change guard rather than screen:

| Entry | Change |
| --- | --- |
| R3 | registers `/invite/accept` as the fourth public route, and fills `/settings/accounts` |
| R5 | brings `project_member`, so `/projects/[projectKey]/issues/new` gains its `isMember` half |
| R6, R10 | the project-scoped screens gain the New issue slot's occupant and its target |
