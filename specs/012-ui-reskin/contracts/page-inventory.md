# Contract — page inventory (FR-006, SC-001)

Every route file in `src/app` today, grouped by the user story that covers it. This is the
literal checklist SC-001 ("zero surfaces retain the prior visual system") is measured against —
22 route files, all 22 in scope, none deferred. The only surface named in the spec's own Assumptions
as out of scope — the cross-project work-list screen — has no route file yet and so has no row here.

## User Story 1 — Sign-in and account-recovery (P1)

| Route file | Screen | States this feature must restyle without breaking |
| --- | --- | --- |
| `src/app/(auth)/layout.tsx` | Auth shell (wraps every row below) | — |
| `src/app/(auth)/signin/page.tsx` | Sign in | success, wrong credentials, locked, closed account |
| `src/app/(auth)/reset/page.tsx` | Forgot password *and* reset password (one route, dispatched on `?token`) | request form; expired/used/unknown token; valid-token change-password form |
| `src/app/(auth)/invite/accept/page.tsx` | Accept invitation | expired/used link; valid-link accept form |
| `src/app/(auth)/error.tsx` | Auth route-group error boundary, shown when a sign-in-flow page throws | error banner; "request a new link" action |

## User Story 2 — The signed-in app shell (P2)

| Route file | Screen |
| --- | --- |
| `src/app/(app)/layout.tsx` | Sidebar + header frame (wraps every row in US3) |
| `src/app/(app)/forbidden.tsx` | 403 boundary, inside the shell |
| `src/app/(app)/not-found.tsx` | Not-found boundary, inside the shell |
| `src/app/not-found.tsx` | Root not-found boundary (outside either route group) |

The shell's component sources are `src/features/shell/components/*` — `app-shell.tsx`,
`sidebar.tsx`, `project-list-region.tsx`, `screen-header.tsx`, `user-chip.tsx`,
`sign-out-control.tsx`, `connection-banner.tsx`, `toast-region.tsx`, `forbidden-notice.tsx`,
`not-found-notice.tsx`.

## User Story 3 — Home, Notifications, Profile, and the remaining pages (P3)

| Route file | Screen |
| --- | --- |
| `src/app/(app)/home/page.tsx` | Home (empty and populated states) |
| `src/app/(app)/notifications/page.tsx` | Notifications |
| `src/app/(app)/profile/page.tsx` | Profile |
| `src/app/(app)/projects/[projectKey]/page.tsx` | Project board (kanban) |
| `src/app/(app)/projects/[projectKey]/details/page.tsx` | Project details |
| `src/app/(app)/projects/[projectKey]/issues/new/page.tsx` | Issue creation |
| `src/app/(app)/projects/[projectKey]/issues/[issueNumber]/details/page.tsx` | Issue detail |
| `src/app/(app)/projects/new/page.tsx` | New-project form |
| `src/app/(app)/settings/accounts/page.tsx` | Settings — Accounts |
| `src/app/(app)/settings/labels/page.tsx` | Settings — Labels |

## Untouched by route, touched by token only

| Route file | Why it needs no content edit |
| --- | --- |
| `src/app/layout.tsx` | Loads the three typefaces already (research.md); no font import or variable changes |
| `src/app/page.tsx` | Redirect-only entry point — confirmed: its entire body is a single `redirect("/home")` call, no JSX returned, so there is no UI of its own to restyle |
| `src/app/api/auth/signin/route.ts` | Route Handler, no UI |

## Explicitly out of scope

| Screen | Why |
| --- | --- |
| Cross-project work-list | Not yet built — no route file exists (spec *Assumptions*, confirmed: no matching path under `src/app`) |

## How this inventory is used

Every row above gets a manual walkthrough in `quickstart.md`. None gets a new automated visual-
regression test — SC-002 requires every *existing* automated test to keep passing, and this
repository's testing guidance (AGENTS.md) already directs component tests to query by role, label,
and visible text rather than snapshot pixels; a page that changes only its token values produces no
new assertion to write unless its class *shape* changes (research.md D-8.2).
