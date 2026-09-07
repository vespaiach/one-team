# Contract: the read surface (R12)

**There is no mutator contract for this feature, and that absence is the contract.** R12 adds no
Server Action, no Route Handler, no `"use server"` module and no write of any kind (FR-004, FR-043).
Everything below is a read.

---

## 1. New server functions

All four live in a `server/` directory and carry `server-only` transitively through `@/db`.

| Function | Module | Signature | Requirements |
| --- | --- | --- | --- |
| `listAssignedIssues` | `src/features/home/server/assigned-queries.ts` | `(userId: string) => Promise<AssignedIssueRow[]>`, wrapped in React `cache()` | FR-007, FR-008, FR-010…FR-013 |
| `listMemberProjectsWithProgress` | `src/features/home/server/project-queries.ts` | `(userId: string) => Promise<ProjectProgressRow[]>` | FR-014…FR-018, FR-020 |
| `listInstallationActivity` | `src/features/home/server/activity-queries.ts` | `(limit: number) => Promise<InstallationActivityRow[]>` | FR-028…FR-031, FR-034 |
| `listRecentMentions` | `src/features/notifications/server/notification-queries.ts` **(existing module, one added export)** | `(userId: string, limit: number) => Promise<NotificationListItem[]>` | FR-021…FR-027 |

And one pure function, with no database and no `server-only`:

| Function | Module | Signature | Requirements |
| --- | --- | --- | --- |
| `progressPercent` | `src/features/home/progress.ts` | `(done: number, counted: number) => number` | FR-017…FR-019 |

## 2. Existing functions called unchanged

| Function | Module | Why |
| --- | --- | --- |
| `requireActor` | `@/features/auth/server/actor` | the session, the redirect, and the only source of a user id on this page (FR-003, FR-035) |
| `countUnreadNotifications` | `@/features/notifications/server/notification-queries` | the unread card reads the **same** unbounded count the sidebar reads (FR-009, SC-003) |
| `displayName` | `@/lib/display-name` | the greeting (FR-005, `OT-UX-019`) |
| `formatIssueKey` | `@/features/issues/issue-key` | `WEB-142` on every issue row (FR-011, FR-030) |
| `publicUser` | `@/features/auth/server/projections` | every actor name, and nothing wider (FR-037) |

## 3. Functions deliberately **not** called, each refused by name

| Not called | Why |
| --- | --- |
| `markNotificationRead`, `markAllNotificationsRead` | FR-026, FR-043 — Home cannot mark anything read |
| `isMember` (`projects/server/authorization.ts`) | FR-015 — **Your projects** reads membership rows, not the predicate; an admin never added to a project does not see it |
| `listFeed` (`activity/server/feed-queries.ts`) | scoped to one issue or one project; **Recent activity** is installation-wide (FR-028) and must exclude the duplicate comment record (FR-029) |
| `collapseFeed` | FR-031 — twenty rows means twenty rows |
| `filterFeedRows`, `getFeedFilter`, `setFeedFilter` | FR-032 — no toggle, and `user.feed_filter` is not read |
| `MENTION_TOKEN_PATTERN`, `mention-resolve.ts`, `mention-queries.ts` | FR-022 — mentions come from the `notification` table, never re-derived from comment bodies |
| `listProjectsForSidebar` | lists every project regardless of membership, archived included — a different question |
| `loadProjectDetails` | N+1, and loads a roster, a column list and a delete-refusal calculation Home does not render |
| `listNotifications` | bounded at 200 rows and untyped by notification type; **Mentions** needs five `mention` rows (FR-021) |

## 4. Boundary table (gate 3)

Every entry point this feature adds, with what it validates.

| Entry point | Client input accepted | Authentication | Authorization | Result |
| --- | --- | --- | --- | --- |
| `GET /home` (`page.tsx`) | **none** — the component declares no `params` and no `searchParams` | `requireActor()`, which redirects to `/signin` when there is no session (FR-003, US5 s4) | none beyond a session — Home requires no role and no membership (FR-003) | HTML; no SQL, stack trace or configuration reaches it (FR-037) |
| `listRecentMentions` | none | caller passes `actor.id` | `where notification.user_id = $1` (`OT-AUTHZ-003`, FR-027) | rows scoped to the caller |
| `countUnreadNotifications` | none | caller passes `actor.id` | same | one integer |
| `listAssignedIssues` | none | caller passes `actor.id` | `where issue.assignee_id = $1` — a filter, not a permission (`OT-AUTHZ-002`) | rows |
| `listMemberProjectsWithProgress` | none | caller passes `actor.id` | `where project_member.user_id = $1` | rows |
| `listInstallationActivity` | `limit` — a module constant, never a request value | n/a | none; every signed-in user reads everything (FR-034) | rows |

**There is no request shape that widens any of these to another user's rows** (SC-007). The only user
id in the feature comes from `requireActor()`; no exported signature accepts one from elsewhere, and
`page.tsx` reads nothing from the URL.

## 5. Ordering guarantees (FR-036, SC-012)

| Surface | `ORDER BY` |
| --- | --- |
| **Assigned to you** | `issue.created_at desc, issue.id desc` |
| **Your projects** | `lower(project.name) asc, project.key asc` |
| **Mentions** | `notification.created_at desc, notification.id desc` |
| **Recent activity** | `created_at desc, id desc` across the union |

Primary keys are UUIDv7, so each tiebreak is both stable and time-ordered.

## 6. Bounds

| Surface | Bound | Source |
| --- | --- | --- |
| assigned card / **Assigned to you** | **none** | FR-010 — §3.2 states a bound where it wants one and states none here |
| unread card | **none** | FR-009 — it follows the sidebar's count, not the Notifications screen's 200-row list |
| **Your projects** | **none** beyond `status = 'active'` | FR-014 |
| **Mentions** | 5 | FR-021 |
| **Recent activity** | 20, with no page control, no "load more" and no infinite scroll | FR-028, FR-033 |
