# Phase 1 — Quickstart validation

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Contracts**: [`contracts/`](./contracts/)

Eleven walkthroughs that prove the frame works end to end. Each names the requirement it demonstrates,
so a reviewer can run the list and reach every acceptance scenario the spec states without reading
the code.

---

## Prerequisite: entry R1 is implemented

**Nothing here runs until it is.** This entry writes no table, resolves no session and renders no
form; every one of those is R1's, and today the repository contains only `src/app` and `src/db`.
Specifically this feature consumes `loadActor()`, `requireActor()`, `assertSameOrigin()`, the
`session` table and its deletion, `proxy.ts`, the `MustChangePasswordBanner` component, the token set
in `globals.css`, and the two Vitest projects.

```bash
git log --oneline -1 -- src/features/auth/server/actor.ts
```

An empty result means R1 has not landed and this checklist cannot be started.

---

## Setup

```bash
npm ci
```

```bash
npm run db:migrate
```

Then seed the installation the way §6 does — `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment,
first run only — and create a second, non-admin account with `admin:grant`, so the two sidebars of
walkthrough 2 can be compared side by side.

```bash
npm run dev
```

---

## 1 · The frame is the same everywhere · `FR-001`, `FR-002`, `FR-009`

Sign in, then visit `/home`, `/profile` and `/notifications` in turn. On each: a 262px sidebar at the
inline start, the content region filling the rest, and no chrome beyond the sidebar, the header and
the banner slot. Nothing about the sidebar moves between the three.

Then sign in as the second account and confirm `/signin` and `/reset` render neither
(`FR-004`) — the two route groups are what makes that structural.

## 2 · Two roles, two sidebars · `FR-011`, `FR-012`, `OT-UX-003`

Open `/home` as the admin and as the member, side by side.

| | Admin | Member |
| --- | --- | --- |
| Accounts, Labels, the `+` beside the project list | present | **absent** — not greyed, not present-and-disabled |
| Home, the project-list region, Notifications, the chip | present | present |

Inspect the member's sidebar markup: no element for the three admin entries exists at all. A disabled
control there would be the mistake the specification calls out by name.

## 3 · Home is the one headerless screen · `FR-003`, `FR-007`

`/home` renders the sidebar and no header — no title block, no per-screen control slot, no New issue
slot. Every other authenticated route renders one. `SC-002` is verifiable by walking the route table
in [`contracts/route-surface.md`](./contracts/route-surface.md); there is no second exception.

## 4 · A refusal keeps the frame · `FR-019`, `FR-020`, `SC-006`

As the **member**, request `/settings/accounts` directly.

- The Forbidden screen renders inside the shell: error code, one sentence, a route back to Home.
- The address bar still reads `/settings/accounts` — nothing navigated to a Forbidden path.
- The header is present, its title block names **Forbidden** rather than Accounts, and both slots are
  empty.
- The response status is `403`.

Repeat for `/settings/labels` and `/projects/new`. All three refuse, and none of their screens exists
yet — which is the point of the guards shipping here.

## 5 · Authorization is decided before existence · `FR-029`, `SC-014`

As the **admin**, request the same three routes.

Each answers "This doesn't exist" — not Forbidden — because the admin passed the guard and the screen
has not been delivered. Run walkthroughs 4 and 5 together: the same URL answers differently for the
two accounts, which is the whole of `FR-029`.

## 6 · Signed out means signed in first · `FR-021`, `SC-007`

With no session cookie, request `/notifications`, `/settings/accounts` and `/home`.

Every one lands on `/signin`. The Forbidden screen appears zero times. Then sign in, delete the
`session` row directly in the database, and make one more request: the answer is `/signin` again, not
an empty frame and not a refusal.

## 7 · Two absences, one wording · `FR-022`, `SC-008`

As any signed-in user, request `/nonsense-path` and then any undelivered screen from walkthrough 5.

Both read "This doesn't exist". Neither says anything about access. The frames differ — the second
keeps the sidebar, the first cannot, because a path that matched nothing has no shell in its tree —
and the wording, which is what `SC-008` measures, is identical because one component renders both.

## 8 · The advisory that blocks nothing · `FR-025`…`FR-027`, `SC-009`

Sign in as the seeded admin, whose `must_change_password` is set.

- The banner renders on every authenticated screen, `/home` included — the slot sits above the
  header, which is why the headerless screen still has one.
- Every control on those screens stays operable, and no navigation is withheld.
- `/signin` and `/reset?token=…` carry no banner slot at all.

Clear the flag with `admin:grant` and reload: the banner stops rendering and the content region
starts where it otherwise would.

## 9 · One action ends the session · `FR-018`, `SC-013`

From any authenticated screen, use the sign-out control on the chip.

- The session ends and the browser lands on `/signin`.
- The `session` row is gone; another session for the same user, opened in a second browser, is still
  live.
- The old cookie, replayed, is answered as nobody.
- Submit the action a second time with the stale cookie: it succeeds quietly and redirects again.
- Submit it with a foreign `Origin` header, and with none: refused before anything is written.

## 10 · Width and direction · `FR-001`, `FR-010`, `SC-011`

Narrow the window below 1280px: nothing collapses, stacks or hides, and the page scrolls
horizontally. Widen it past any size: the sidebar stays 262px.

Then send `Accept-Language` for a right-to-left locale. The sidebar moves to the right edge and the
content region to the left; the width, the entries and everything else about the frame are unchanged.

## 11 · Keyboard alone · `FR-031`, `SC-012`

Without touching the pointer, tab from the top of any authenticated screen.

Focus enters the sidebar in visual order, every entry shows a visible focus ring, each has an
accessible name, and the chip's link and its sign-out control are reached as two separate stops. A
long display name is truncated on screen while the accessible name carries it in full.

---

## The gate

```bash
npm run verify
```

`style-check`, `type-check`, `test`, `build` — the same four CI runs. Note that `npm test` passes with
`--passWithNoTests`, so a green run is not by itself evidence of change gate 1; the evidence is the
commit order, one failing test before each implementation.
