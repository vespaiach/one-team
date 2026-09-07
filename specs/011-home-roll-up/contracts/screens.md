# Contract: the Home screen (R12)

`/home` — reachable by **any signed-in user**, no role and no membership (FR-003). An unauthenticated
request redirects to `/signin` and renders no part of this page (US5 s4). The must-change-password
banner R2 renders above every authenticated screen renders here too, and nothing is withheld while it
does (*Edge Cases*).

## 1. The frame

**No header.** No `ScreenHeader`, no title block, no per-screen control slot, no New issue control.
Home is `OT-UX-001`'s single exception and R2 already fixed it; this feature adds nothing to the shell
(FR-002, US1 s7). The sidebar renders exactly as it does everywhere else, from the `(app)` layout,
unchanged.

`src/features/shell/components/screen-header.tsx`, `app-shell.tsx`, `sidebar.tsx` and
`src/app/(app)/layout.tsx` are **not edited**.

## 2. Composition, in the order FR-001 fixes

| # | Surface | Component | Loading | Empty (FR-040) |
| --- | --- | --- | --- | --- |
| 1 | greeting | rendered in `page.tsx` from `displayName(actor)` | none — it needs only the awaited actor | n/a |
| 2 | three stat cards | `home/components/stat-cards.tsx` | `stat-cards-skeleton.tsx` — three card-shaped blocks in a row | n/a — a zero card renders the digit `0` |
| 3 | **Assigned to you** | `assigned-section.tsx` + `assigned-issue-row.tsx` | `assigned-skeleton.tsx` — three rows | one quiet line |
| 4 | **Your projects** | `projects-section.tsx` + `project-progress-row.tsx` | `projects-skeleton.tsx` — three rows | one quiet line |
| 5 | **Mentions** | `mentions-section.tsx` + `mention-row.tsx` | `mentions-skeleton.tsx` — five rows | one quiet line |
| 6 | **Recent activity** | `activity-section.tsx` + `activity-row.tsx` | `activity-skeleton.tsx` — twenty rows | one quiet line |

Surfaces 2 to 6 each sit in their own `<Suspense>`, below the awaited `requireActor()`. No
`loading.tsx` is added: it would sit above the guard and stream a `200` before the redirect could
happen ([`research.md`](../research.md) D-1). No full-screen spinner exists anywhere in the feature,
and each skeleton mirrors its section's real geometry, so the only shift a load can produce is the
vertical reflow of content below a section whose real row count differs from the count its skeleton
reserved (FR-038, `OT-UX-005`, SC-011).

**Every component in this feature is a Server Component.** No file under `src/features/home/` carries
`"use client"`, so no element on the page can issue a mutation (FR-004, SC-009).

## 3. Row shapes

**Stat card** — a number and a text label naming what it counts, in this order: *assigned to you*,
*due this week*, *unread*. The number is never conveyed by size, colour or position alone (FR-006).
The first two are derived from one cached read of **Assigned to you**'s own rows, so the card and the
section beneath it cannot disagree (FR-007, SC-002). The third is
`countUnreadNotifications(actor.id)` — the same unbounded count the sidebar renders (FR-009, SC-003).

**Assigned to you row** — issue key (`WEB-142`), title, project name. Links to
`/projects/<KEY>/issues/<number>/details` (FR-011, FR-013). Every issue assigned to the viewer lists,
including one in a `done`- or `canceled`-kind column (US1 s5) and one in a project the viewer does not
belong to (FR-012) or that is archived (*Edge Cases*).

**Your projects row** — name, status, progress percentage. Links to `/projects/<KEY>`. Active projects
only (FR-014, FR-016, US2 s4).

**Mention row** — the unread dot with an `sr-only` "Unread" text equivalent, actor name, target label,
relative time. Read and unread rows list together (FR-023). Links to the notification's own `href`,
carrying the `#comment-<id>` anchor R7 emits and R11 deep-links to (FR-025). **Activating it does not
mark it read**, and the unread card above is unchanged after the navigation (FR-026, SC-006). Same
shape as `/notifications`' own row (FR-024), because it renders the same DTO.

**Recent activity row** — actor, what happened, the issue key and project (or the project name for a
project-scoped event), relative time (FR-030). The sentence for the ten non-comment types comes from
R7's `ActivityRow`, composed rather than copied; a comment renders as *actor · commented on · target*
and its body is not rendered ([`research.md`](../research.md) E-3). No five-minute collapsing
(FR-031), no Comments only / All activity toggle (FR-032), no pagination control of any kind
(FR-033).

## 4. Accessibility (FR-042, `OT-UX-017`, `OT-UX-018`, `OT-UX-019`)

- Every navigating row is a `next/link` anchor: an accessible name from its own text, a visible focus
  indicator from the application's shared focus styling, and keyboard operability from the platform.
  React Aria's `Link` and a `RouterProvider` are **not** added — React Aria is required where
  behaviour must be reproduced, not where the platform already provides it.
- The unread dot is `aria-hidden` and always accompanied by text; nothing on the page conveys state by
  colour alone.
- Each of the four sections is a labelled region with a heading, so the six surfaces FR-001 orders are
  navigable by heading.
- Skeletons carry `aria-busy="true"`, matching `NotificationsSkeleton`.
- Desktop only; no breakpoint is introduced.

## 5. Refresh behaviour

- Home re-queries on every revisit. No cache configuration is added: the page is dynamic because
  `requireActor()` reads `cookies()`, and a dynamic segment's client router-cache stale time is `0`
  (FR-039, `OT-UX-006`, [`research.md`](../research.md) D-3).
- **No polling, no socket, no focus listener and no timer** (FR-041). New rows appear on the next
  navigation to the page. `OT-OPS-008`'s 30-second re-query stays the board's.
- No `revalidatePath` and no `refresh()` — this feature performs no write for one to follow.

## 6. What this screen must not grow

No control that changes anything; no composer; no "mark all read"; no drag; no toggle; no filter; no
sort control; no "load more"; no route that shows another user's roll-up. Each is listed in the spec's
*Out of Scope* and no task in this feature may add one.
