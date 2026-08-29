# One Team — requirements index (v1)

## 1. Document authority

| | |
| --- | --- |
| **Source of truth** | [`docs/product/specifications.md`](specifications.md) — "One Team — product specification (v1)" |
| **This document** | A traceability index over that specification. It is **derived, not authoritative**. |
| **Precedence** | Where this index and the specification disagree, the specification wins and this index is the defect. |
| **Scope of extraction** | Only rules that apply across **two or more capabilities**. Feature-specific behaviour stays in the source and is deliberately not restated here. |
| **IDs** | Immutable and append-only. An ID is never reused, renumbered or repurposed. A withdrawn requirement is struck, not deleted. |
| **`Source` column** | Section numbers refer to the specification's own `§` headings. |

No behaviour below is invented. Every row restates something the source states; gaps and contradictions are reported in §5 rather than resolved.

---

## 2. Global requirements

### 2.1 Scope — `OT-SCOPE`

| ID | Requirement | Source | Applies to |
|---|---|---|---|
| OT-SCOPE-001 | The installation MUST represent exactly one team. Workspaces, tenants, an org layer and a team switcher MUST NOT exist. | §1, §3 | All |
| OT-SCOPE-002 | Structure MUST be exactly two levels — issues live in projects. Nothing above projects, nothing between projects and issues. | §1 | Projects, Issues |
| OT-SCOPE-003 | Issues MUST be flat. An issue MUST NOT reference another issue as parent or child. | §1, §3.4, §5 | Issues, Board, Data model |
| OT-SCOPE-004 | v1 MUST target a desktop browser only. No responsive layout and no mobile breakpoint MAY be shipped. | §1, §3 | All screens |
| OT-SCOPE-005 | Out-of-scope features MUST NOT be built: search of any kind, file attachments, sub-issues, milestones, sprints, estimates, roadmap/timeline/list/calendar views, command palette, private or confidential projects, guest/read-only roles, project-level invitations, a team-settings screen, third-party integrations, audit log, local-first/offline use, real-time push and live collaboration, public sign-up, social login, SSO, 2FA, magic-link sign-in. | §1 | All |
| OT-SCOPE-006 | The system MUST be server-authoritative: the database is the only copy of the data and every read is a query against it. A sync engine, client database or service worker MUST NOT be used. | §1, §5, §7 | All |
| OT-SCOPE-007 | Every screen MUST be reachable at the route assigned to it in the screen table; the thirteen screens plus modals are the whole surface. | §3 | Routing |

### 2.2 Permissions and authorization — `OT-AUTHZ`

| ID | Requirement | Source | Applies to |
|---|---|---|---|
| OT-AUTHZ-001 | Authorization MUST reduce to two predicates: `isAdmin(user) = user.role === 'admin'` and `isMember(user, project) = isAdmin(user) \|\| hasProjectMemberRow(project.id, user.id)`. Admins MUST be implicit members of every project, so no downstream rule carries an `\|\| isAdmin` branch. | §2 | All mutators |
| OT-AUTHZ-002 | Every signed-in user MUST be able to read every project, issue, comment and activity row. Membership MUST NOT be used as a visibility boundary. | §2, §3.11, §5 | All reads |
| OT-AUTHZ-003 | Notifications MUST be readable only by their own `user_id`. This MUST be the only row-level read rule in the system. | §3.6, §5 | Notifications |
| OT-AUTHZ-004 | Every mutator MUST enforce its predicate server-side, and the project used for an `isMember` check MUST be derived from the stored row — never from a client-supplied `project_id`. | §2 | All mutators |
| OT-AUTHZ-005 | The client MAY run the same predicates to disable controls, but the server check MUST be the enforcement and the client check MUST NOT be. | §2 | All screens |
| OT-AUTHZ-006 | Membership **lists** — the project-details roster, the Accounts project count, the Create-project member chips — MUST read `project_member` rows only, so an admin appears only if explicitly added. | §2, §3.7, §3.8, §3.9 | Projects, Accounts |
| OT-AUTHZ-007 | The assignee pool and the `@mention` priority group MUST read `project_member` rows **plus** every admin, and MUST exclude deactivated users. | §2, §3.4, §3.5, §3.8 | Issues, Comments |
| OT-AUTHZ-008 | `updateComment` MUST require authorship. `deleteComment` MUST require authorship **or** `isAdmin`. Neither MUST require current project membership. Nobody MUST be able to edit another user's comment. | §2 | Comments |
| OT-AUTHZ-009 | Activity records MUST NOT be editable or deletable by anyone, including admins. The only removal is cascade — from a deleted comment, issue or project. | §2, §4, §5 | Activity |
| OT-AUTHZ-010 | Labels MUST be created, renamed, recoloured and deleted by admins only, and applied or removed on an issue by any member of that issue's project. | §2, §3.10 | Labels, Issues |
| OT-AUTHZ-011 | Role changes MUST be CLI-only in v1. No UI MAY set a role. Invitation and deactivation MUST have UI. | §2, §3.9, §6 | Accounts, Auth |
| OT-AUTHZ-012 | Losing write access mid-session MUST remove no rows; controls MUST become disabled on the next render. | §2 | All screens |
| OT-AUTHZ-013 | Removing a project member MUST revoke write access to that project and nothing else — assignments, comments, activity and visibility all survive — and MUST be recorded in that project's activity. | §2, §3.8 | Projects |
| OT-AUTHZ-014 | Content authored by removed or deactivated users MUST survive, and their names MUST still render everywhere they already did. | §2, §3.9 | All feeds |
| OT-AUTHZ-015 | An assigned non-member MUST be a supported state: they see their issue, cannot change it, and the page names the project they would need to be added to. | §2, §3.3, §3.4 | Issues, Board |
| OT-AUTHZ-016 | "Mark all read" MUST be one `markAllNotificationsRead` mutator requiring only self, clearing every unread row for the caller in one statement rather than one call per row. The rows it clears MUST be scoped from the session server-side, never from a client-supplied user id. | §3.6, §2 | Notifications |

### 2.3 Security and authentication — `OT-SEC`

| ID | Requirement | Source | Applies to |
|---|---|---|---|
| OT-SEC-001 | Authentication MUST be hand-written with one credential — email + password. No JWT library MAY be used; sessions MUST be database rows behind a cookie. | §6, §7 | Auth |
| OT-SEC-002 | Exactly four routes MUST be reachable by an unauthenticated caller: sign-in, the reset request, the reset submission, and invite acceptance. | §3, §6 | Routing |
| OT-SEC-003 | There MUST be no public sign-up. An account MUST come into being only by an admin invitation (7-day, single-use link) or the first-run seed. Members MUST NOT be able to invite. | §1, §3.9, §6 | Auth, Accounts |
| OT-SEC-004 | Passwords MUST be at least twelve characters, MUST have no composition rules, and MUST be checked against a blocklist of common passwords — the same policy at every entry point. | §3.1, §3.12 | Auth |
| OT-SEC-005 | Password hashes MUST be Argon2id in a separate `credential` table, and MUST never appear in a response, a cookie or a log. | §5, §6 | Auth |
| OT-SEC-006 | Session, invite and reset tokens MUST be 32 random bytes stored as SHA-256 digests, so no two secrets are ever compared. | §6 | Auth |
| OT-SEC-007 | Sign-in MUST set one opaque session id as an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie, 30 days sliding, refreshed on use, carrying no claims and no signature. There MUST be no "remember me". | §3.1, §6 | Auth |
| OT-SEC-008 | `loadActor()` MUST resolve the cookie to a session row and read `role` and `deactivated_at` from the database on every request. Identity, role and membership MUST NOT be cached anywhere. | §6 | All requests |
| OT-SEC-009 | CSRF MUST be handled by `SameSite=Lax` plus an origin check on every mutating request. A CSRF token MUST NOT be used. | §6 | All mutators |
| OT-SEC-010 | Sign-in MUST refuse for fifteen minutes after five failures for one address, or twenty failures from one IP across any addresses, counted durably in `auth_attempt`; the refusal MUST state the remaining time. Reset requests MUST be throttled the same way. | §3.1, §5, §6 | Auth |
| OT-SEC-011 | Sign-in MUST return one identical message for a wrong password and an unknown email, and the reset request MUST answer identically whether or not the address exists. Neither MUST reveal account existence. | §3.1, §6 | Auth |
| OT-SEC-012 | Any completed password reset MUST end every session for that user, including the one that requested it. | §3.1, §6 | Auth, Profile |
| OT-SEC-013 | Deactivation MUST delete every session row and revoke sign-in and writes immediately, everywhere; membership rows MUST be retained so reactivation restores prior access. | §3.9, §6 | Accounts |
| OT-SEC-014 | First-run seeding MUST be skipped if any `user` row exists; that check MUST be the whole marker, so the path can neither run twice nor mint a second admin later. | §6 | Bootstrap |
| OT-SEC-015 | An unauthenticated request to an authenticated route MUST redirect to `/signin` and MUST NOT reach the Forbidden screen. | §3.11 | Routing |
| OT-SEC-016 | Expired, used and unknown tokens MUST each get their own explanatory state, on both Accept invite and Change password. | §3.1 | Auth |
| OT-SEC-017 | Sign-in and reset attempts MUST be counted in separate `auth_attempt` buckets, discriminated by `flow` (`signin \| reset`) alongside `kind`, under the same limits and window. Reset traffic MUST NOT lock an address out of sign-in, and a failed sign-in MUST NOT block a reset request. A reset request MUST record a row every time, never only for an unknown address. A successful sign-in MUST clear that address's `signin` rows only — not its `reset` rows, and not the IP's. | §3.1, §5, §6 | Auth |
| OT-SEC-018 | A route reachable by an unauthenticated caller MUST NOT disclose any `user` record. Where the deactivated sign-in message names a contact, it MUST be the operator-configured address, and MUST name none when the operator has configured none. | §3.1, §5, §6 | Auth, Routing |
| OT-SEC-019 | Every credential-setting entry point outside invite acceptance — first-run seeding and `admin:grant` — MUST validate the password against the policy (`OT-SEC-004`) and MUST refuse a non-compliant value, writing nothing. `admin:grant` MUST read the password from the terminal, never from a command argument. | §3.1, §6 | Auth, Bootstrap |

### 2.4 Data — `OT-DATA`

| ID | Requirement | Source | Applies to |
|---|---|---|---|
| OT-DATA-001 | Primary keys MUST be server-generated UUIDv7. Enumerations MUST be `text` + `CHECK`, not `pgEnum`. Calendar dates MUST be `date` and instants `timestamptz`. `sort_order` MUST be `text COLLATE "C"`. Colours MUST be lowercase six-digit hex. Tables MUST be `snake_case` and singular. | §5 | Data model |
| OT-DATA-002 | `updated_at` MUST be written explicitly by every mutator through one `touched()` helper. A database trigger MUST NOT be used. | §5 | All mutators |
| OT-DATA-003 | Every free-text column MUST be length-bounded by a `CHECK`: 200 characters for names, titles, keys and handles; 10 000 for descriptions, comment bodies and bios. | §5 | Data model |
| OT-DATA-004 | Calendar dates MUST be compared in the server's own timezone, set once by the operator, so "due this week" and overdue mean the same for everyone. | §5, §3.2 | Issues, Home |
| OT-DATA-005 | `user` MUST be selected through the `publicUser` projection (`id, first_name, last_name, avatar_url, role, job_title, deactivated_at`) everywhere; the contact fields (`email`, `slack_handle`, `phone`, `bio`) MUST come from the `accountUser` projection, used only by Accounts and by Profile reading its own row. | §5, §3.9, §3.12 | All reads |
| OT-DATA-006 | `credential`, `session`, `reset_token`, `invite` secrets, `issue_counter` and `auth_attempt` MUST NOT be reachable from any read endpoint. | §5 | All reads |
| OT-DATA-007 | Deletes MUST be hard and cascade in the database. There MUST be no `deleted_at`; cancellation (issues) and archiving (projects) are the reversible paths, and a user MUST never be deleted. | §4 | All deletes |
| OT-DATA-008 | Every delete MUST run in one server transaction, and the response MUST carry the settled state. There MUST be no moment where a row is gone and its dependents are not. | §4 | All deletes |
| OT-DATA-009 | An activity row MUST be written in the same database transaction as the change it describes, and a notification row MUST be written in the same transaction as the change that caused it. | §3.6, §5 | Activity, Notifications |
| OT-DATA-010 | Activity `from_value` / `to_value` MUST be display strings frozen at write time and truncated to 200 characters, and MUST NOT be re-resolved on read. | §5 | Activity |
| OT-DATA-011 | A comment, an activity row and a notification MUST each attach to exactly one issue **or** one project, enforced by a `CHECK` on the pair. | §5 | Comments, Activity, Notifications |
| OT-DATA-012 | Issue numbers MUST be handed out by `issue_counter` under a row lock inside the creating transaction, MUST NOT touch the project row, and MUST be monotonic per project and never reused. | §3.5, §5 | Issues |
| OT-DATA-013 | Every colour — project, board column, label — MUST be one of the seven palette values, with the accent as the default. Free colour entry and per-surface palettes MUST NOT exist. | §7 | Projects, Columns, Labels |
| OT-DATA-014 | Mention tokens MUST be stored in `comment.body` as `@[<user_id>]` and rendered as that user's current display name, so a rename follows. | §5 | Comments |
| OT-DATA-015 | Issue and project descriptions MUST be stored as markdown source and support only bold, italic, inline code, links, bullet and numbered lists and headings. HTML MUST be escaped, not rendered. Tables, images and embeds MUST NOT be supported. | §3.4, §3.5, §3.7, §3.8 | Issues, Projects |
| OT-DATA-016 | Comment bodies and profile bios MUST be plain text with no markdown. | §3.12, §5 | Comments, Profile |
| OT-DATA-017 | Ordering MUST use one base-62 fractional index per issue across the whole project, written by one `moveIssue` call touching one row. Ties MUST be legal and never repaired; every ordered query MUST sort by `(sort_order, id)`. | §3.3 | Board, Issues |
| OT-DATA-018 | `createIssue` MUST write a `sort_order` after every existing issue in the same project, so a new issue sorts last under every grouping and no existing row is touched. This MUST be the only `sort_order` write that does not originate from a drop. | §3.3, §3.5 | Issues, Board |
| OT-DATA-019 | Board column lifecycle MUST be recorded by five activity types — `column_added`, `column_renamed`, `column_recolored`, `column_reordered`, `column_deleted` — each carrying that column's frozen name in `field`. `from_value` / `to_value` MUST carry a transition only where the change has one: the old and new name for a rename, the old and new palette name for a recolour, and for a reorder the name of the column it now follows in `to_value`, null meaning first. `activity` MUST NOT carry a column reference. | §5, §3.8 | Activity, Columns |
| OT-DATA-020 | `member_added` / `member_removed` MUST hold that member's display name as a frozen string in `to_value` / `from_value` respectively, with `field` unused and the actor coming from `actor_id`. | §5, §3.8 | Activity, Projects |

### 2.5 UX — `OT-UX`

| ID | Requirement | Source | Applies to |
|---|---|---|---|
| OT-UX-001 | Every authenticated screen MUST sit inside the persistent shell (262px fixed sidebar + header). Home MUST be the one exception: sidebar without header. Sign in and Change password MUST render outside the shell entirely. | §3, §3.1, §3.2 | All screens |
| OT-UX-002 | Any action a user cannot take MUST render as a disabled control with an inline reason. A dead button MUST NOT be used, and a tooltip alone MUST NOT be the explanation. | §2, §4 | All screens |
| OT-UX-003 | Navigation leading to an admin-only screen MUST be hidden rather than disabled — sidebar entries and links alike. | §2, §3.10 | Shell, Labels |
| OT-UX-004 | A missing row MUST read "This doesn't exist" and MUST NOT imply a hidden-access state, since everyone can read everything. | §3.11, §4 | All screens |
| OT-UX-005 | Loading MUST use per-screen skeletons that match the layout they replace. A full-screen spinner MUST NOT be used, and data landing MUST NOT shift layout. | §4 | All screens |
| OT-UX-006 | A revisited screen MUST re-query the server. Nothing MUST render from a client cache. | §4 | All screens |
| OT-UX-007 | An empty surface MUST be one quiet line. Illustrations and empty-state marketing MUST NOT be used. | §3.3, §3.9, §3.10, §4 | All screens |
| OT-UX-008 | Small, local writes (drag, status, assignee, in-place field edits) MUST apply optimistically and roll back with a toast naming what failed and why. Larger writes — create issue, create project — MUST wait for the server and show in-flight state on the button. | §3.4, §3.5, §3.7, §3.12, §4 | All writes |
| OT-UX-009 | In-place editing MUST behave identically on every surface that offers it: click the value to make it a field, Escape reverts, blur or ⌘-enter saves, one mutator call per field. | §3.4, §3.8, §3.12 | Issues, Projects, Profile |
| OT-UX-010 | An immutable field MUST render as a shown value, not a control — project key, issue key, an issue's project, email, and account role all follow the same convention. | §3.4, §3.8, §3.12 | Issues, Projects, Profile |
| OT-UX-011 | Form validation MUST be per-field and on blur, never a wall of errors on submit. The submit control MUST stay enabled and report what is missing inline rather than going dead. | §3.5, §3.7, §3.9, §3.10 | All forms |
| OT-UX-012 | A uniqueness clash — project key, column name, label name — MUST be an inline error naming the existing holder. A silent suffix MUST NOT be applied. | §3.7, §3.8, §3.10 | Projects, Columns, Labels |
| OT-UX-013 | Both activity feeds MUST be one reverse-chronological stream interleaving comments and system records, with no tabs inside the feed, a composer at the head, and comment rows carrying edit for their author and delete for their author or an admin. | §3.4, §3.8 | Issues, Projects |
| OT-UX-014 | Both feeds MUST offer the same Comments only / All activity toggle, remembering the choice per user in `user.feed_filter` across both. | §3.4, §3.8, §5 | Issues, Projects |
| OT-UX-015 | Both feeds MUST load the most recent 50 rows and append the next page on scroll, and MUST collapse consecutive changes by the same actor within five minutes into one expandable line. | §3.4, §3.8 | Issues, Projects |
| OT-UX-016 | Toasts MUST be four kinds — success, info, warning, error — top-right, stacked, auto-dismissing. | §4 | All screens |
| OT-UX-017 | A lost connection MUST show one banner and refuse writes with "Changes need a connection". Nothing MUST be queued for later. | §4 | All writes |
| OT-UX-018 | Interaction behaviour, focus management, keyboard support and ARIA semantics MUST come from React Aria Components; Tailwind MUST supply the visual layer only. A custom component MAY be built only where no suitable React Aria component exists, and MUST reproduce the same keyboard, focus and ARIA behaviour. | §7 | All components |
| OT-UX-019 | A user's display name MUST be their first and last name joined with a space, everywhere in the app. | §3.12 | All screens |
| OT-UX-020 | The sidebar MUST list projects alphabetically by name, active first, then archived and dimmed. Projects MUST NOT carry a manual `sort_order`. | §3, §5 | Shell |
| OT-UX-021 | Navigation to a **member-only** screen MUST render as a disabled control with an inline reason naming the project, never hidden — `OT-UX-003`'s hide-rather-than-disable rule covers admin-only navigation only. Every entry point to Create issue — the header's **New issue** button, the board's inline composer and its chevron — MUST follow this for a non-member, and the route MUST still answer Forbidden to a caller who reaches it directly. | §2, §3.3, §3.5 | Shell, Board, Issues |

### 2.6 Operations — `OT-OPS`

| ID | Requirement | Source | Applies to |
|---|---|---|---|
| OT-OPS-001 | Notification email MUST be sent after the causing transaction commits, never inside it, so a slow or dead SMTP host can neither fail a write nor hold a request open. | §3.6 | Notifications |
| OT-OPS-002 | A successful send MUST stamp `emailed_at`; a failure MUST leave it null and be retried by the sweep up to three times over an hour, after which the in-app row survives and the email is abandoned. | §3.6 | Notifications |
| OT-OPS-003 | One in-process interval timer MUST cover both the notification-mail retry sweep and the `auth_attempt` sweep. A queue or external scheduler MUST NOT be used. | §6, §7 | Infrastructure |
| OT-OPS-004 | Exactly three notification types MUST exist — `mention`, `assignment`, `comment`. Status changes MUST notify nobody, activity records MUST notify nobody, and a user MUST never be notified about their own action. | §3.6, §4 | Notifications |
| OT-OPS-005 | The actor MUST be removed from every recipient set before rows are written — including a self-mention — so `CHECK (user_id <> actor_id)` is a backstop, never the mechanism. | §3.6, §5 | Notifications |
| OT-OPS-006 | One person MUST receive at most one row per comment; where `mention` and `comment` would both apply, `mention` MUST win. | §3.6 | Notifications |
| OT-OPS-007 | Mail MUST be one message per notification, sent immediately. Digests, batching and opt-out MUST NOT exist in v1. | §3.6 | Notifications |
| OT-OPS-008 | The board MUST re-query on window focus and every 30 seconds while it is the active tab. A re-query landing mid-drag MUST update the board underneath the drag and MUST NOT cancel it; the drop then resolves against the fresh neighbours. | §3.3, §4 | Board |
| OT-OPS-009 | There MUST be no locking and no live push. The last `moveIssue` to reach the server MUST win outright, and a losing client MUST learn of staleness only from the periodic re-query, never from a rejected write. | §3.3 | Board |
| OT-OPS-010 | Nothing MUST cascade beyond what §4 lists: archiving a project MUST NOT touch its issues, and renaming, reordering or deleting a column MUST NOT touch an issue. | §4 | Projects, Columns |
| OT-OPS-011 | Every transition MUST be legal in both directions — any issue column to any other, and a project between `active` and `archived`. There MUST be no terminal state, guardrail or confirmation on a transition. | §4 | Issues, Projects |
| OT-OPS-012 | Deployment MUST be self-hosted on a single box, with SMTP supplied by the operator. | §7 | Infrastructure |
| OT-OPS-013 | `updateComment` MUST notify only the users the saved body names and the replaced body did not, writing one `mention` row each under the rules that apply to a new comment. It MUST NOT write `comment`-type rows, MUST NOT re-notify anyone already holding a row for that comment, and MUST NOT delete or alter a row for a mention the edit removed. | §3.6, §2 | Comments, Notifications |
| OT-OPS-014 | A project `comment` notification MUST go to that project's `project_member` rows only — a membership list, not the predicate — so an admin receives one only where they were added explicitly. | §3.6, §2 | Notifications |

---

## 3. Invariants

Rules that must hold at all times. `OT-INV-001`–`OT-INV-014` mirror the specification's numbered invariant table (§5) one-for-one; `015`–`017` are invariant-shaped rules stated elsewhere in the source.

| ID | Invariant | Enforced by | Source |
|---|---|---|---|
| OT-INV-001 | Every issue belongs to a project. | `NOT NULL` | §5 (1) |
| OT-INV-002 | An issue cannot change project. | `updateIssue` | §5 (2), §3.4 |
| OT-INV-003 | Issues are flat — no issue references another. | No parent column exists | §5 (3) |
| OT-INV-004 | An issue's column belongs to the issue's project. | Composite FK `(project_id, column_id)` | §5 (4) |
| OT-INV-005 | A project always has at least one column. | `deleteColumn` | §5 (5), §3.8 |
| OT-INV-006 | A column holding issues cannot be deleted. | `deleteColumn` | §5 (6), §3.8 |
| OT-INV-007 | `project.key` is immutable. | `updateProject` | §5 (7), §3.7 |
| OT-INV-008 | A project must be `archived` before deletion. | `deleteProject` | §5 (8), §3.8 |
| OT-INV-009 | Issue numbers are monotonic per project and never reused. | `issue_counter` row lock | §5 (9) |
| OT-INV-010 | A comment, an activity row and a notification each attach to exactly one issue **or** one project. | `CHECK` on the pair | §5 (10) |
| OT-INV-011 | Activity rows are never updated, and are deleted only by cascade — from their own comment, or from the issue or project they belong to. | No `update` mutator exists; no `delete` mutator targets a row directly | §5 (11), §2 |
| OT-INV-012 | A project always has at least one `canceled`-kind column. | `deleteColumn` | §5 (12), §3.8 |
| OT-INV-013 | At least one admin is always active. | `deactivateUser` / `setUserRole`, counting active admins under a row lock in the same transaction as the change | §5 (13), §2, §3.9 |
| OT-INV-014 | A project always has at least one `done`-kind column. | `deleteColumn` | §5 (14), §3.8 |
| OT-INV-015 | A board column's `kind` is fixed at creation and never changes, so `done`- and `canceled`-kind columns stay identifiable. | `updateColumn` (no `kind` path); a column added later is always `open` | §3.8, §5 |
| OT-INV-016 | Uniqueness holds on `lower(user.email)`, `lower(label.name)`, `(project_id, lower(board_column.name))` and `project.key`. | `UNIQUE` constraints | §5 |
| OT-INV-017 | A user row is never deleted; closure is `deactivated_at` only. | No user delete path exists | §4, §6 |

---

## 4. Capability map

| Capability | Source sections | Applicable requirement IDs |
|---|---|---|
| **Shell and navigation** | §3 (The shell), §3.11 | OT-SCOPE-004, OT-SCOPE-007, OT-UX-001, OT-UX-003, OT-UX-004, OT-UX-020, OT-UX-021, OT-SEC-015 |
| **Authentication and sessions** | §3.1, §6 | OT-SEC-001…019, OT-AUTHZ-011, OT-DATA-006, OT-INV-013, OT-INV-017 |
| **Accounts and invitations** | §3.9, §6 | OT-AUTHZ-006, OT-AUTHZ-011, OT-AUTHZ-014, OT-SEC-003, OT-SEC-013, OT-SEC-016, OT-DATA-005, OT-UX-011, OT-INV-013 |
| **Profile** | §3.12 | OT-AUTHZ-001, OT-DATA-005, OT-DATA-016, OT-UX-009, OT-UX-010, OT-UX-019, OT-SEC-004, OT-SEC-012 |
| **Projects (record, status, members, delete)** | §3.7, §3.8, §4 | OT-SCOPE-002, OT-AUTHZ-001, OT-AUTHZ-006, OT-AUTHZ-013, OT-DATA-013, OT-DATA-015, OT-DATA-020, OT-UX-009…012, OT-OPS-010, OT-OPS-011, OT-INV-007, OT-INV-008, OT-INV-016 |
| **Board columns** | §3.3, §3.8, §4 | OT-AUTHZ-001, OT-DATA-013, OT-DATA-019, OT-UX-012, OT-OPS-010, OT-INV-005, OT-INV-006, OT-INV-012, OT-INV-014, OT-INV-015, OT-INV-016 |
| **Board (grouping, drag, ordering)** | §3.3, §4 | OT-SCOPE-004, OT-AUTHZ-007, OT-AUTHZ-015, OT-DATA-017, OT-DATA-018, OT-UX-008, OT-UX-021, OT-OPS-008, OT-OPS-009, OT-OPS-011, OT-INV-004 |
| **Issues (detail, create, edit)** | §3.4, §3.5, §4 | OT-SCOPE-003, OT-AUTHZ-007, OT-AUTHZ-015, OT-DATA-004, OT-DATA-012, OT-DATA-015, OT-DATA-017, OT-DATA-018, OT-UX-008…011, OT-UX-021, OT-INV-001…004, OT-INV-009 |
| **Labels** | §3.10, §4 | OT-AUTHZ-010, OT-DATA-013, OT-UX-003, OT-UX-011, OT-UX-012, OT-DATA-007, OT-DATA-008, OT-INV-016 |
| **Comments and activity** | §3.4, §3.8, §2, §5 | OT-AUTHZ-008, OT-AUTHZ-009, OT-AUTHZ-014, OT-DATA-009…011, OT-DATA-014, OT-DATA-016, OT-DATA-019, OT-DATA-020, OT-UX-013…015, OT-OPS-013, OT-INV-010, OT-INV-011 |
| **Notifications and email** | §3.6, §5, §7 | OT-AUTHZ-003, OT-AUTHZ-016, OT-DATA-009, OT-DATA-011, OT-OPS-001…007, OT-OPS-013, OT-OPS-014, OT-INV-010 |
| **Home roll-up** | §3.2 | OT-AUTHZ-002, OT-DATA-004, OT-UX-001, OT-UX-005…007, OT-INV-014 |
| **Data model and read boundary** | §5 | OT-SCOPE-006, OT-AUTHZ-002, OT-AUTHZ-003, OT-DATA-001…020, all OT-INV |
| **Deletes and cascades** | §4 | OT-DATA-007, OT-DATA-008, OT-OPS-010, OT-INV-005, OT-INV-006, OT-INV-008, OT-INV-017 |

---

## 5. Blocking decisions

Contradictions, ambiguities and missing decisions found in the source. **None are resolved here** — the decision belongs to the specification's owner, and a row is struck and marked resolved only once the source itself has been amended. Each open row names the passages that disagree.

| ID | Conflict or gap | Source | Impact if unresolved |
|---|---|---|---|
| OT-DEC-001 | ~~**Column lifecycle activity has no representation in the activity schema.**~~ **Resolved** 2026-08-29 by amendment to specification §5 (`activity`), indexed as `OT-DATA-019`: the `type` enum widens by five `column_` values and `field` carries the board column's frozen name, which leaves `from_value` / `to_value` free for the transition where the change has one and unused where it has none. `field` therefore reads as the thing that changed throughout — a record field for `field_changed`, the column itself for a `column_` row. Dropping column activity from §3.8 was rejected: the two places the source declines to log, team-wide labels (§3.10) and deactivation (§3.9), each lack a feed to attach to — a label has no `project_id` and a user has no feed at all — whereas a column belongs to exactly one project, whose feed §3.8 already promises these events to. A column reference was rejected for the reason `label_added` already stores a name rather than a `label_id`: `OT-DATA-010` freezes display strings at write time. | §3.8 (line 258) vs §5 `activity` (line 377) | None — closed. |
| OT-DEC-002 | ~~**`member_added` / `member_removed` value encoding is undefined.**~~ **Resolved** 2026-08-29 by amendment to specification §5 (`activity`), indexed as `OT-DATA-020`: `to_value` / `from_value` hold that member's display name as a frozen string, exactly as the label types hold a label's, `field` unused and the actor coming from `actor_id`. The analogy is made explicit rather than left inferable; §5 already assumed it in requiring that a later rename of a *user* not rewrite history. A `user_id` reference was rejected for the reason `OT-DATA-019` rejected a column one — `OT-DATA-010` freezes display strings at write time — though here the row would survive, a user never being deleted (`OT-INV-017`). | §3.8 (line 258) vs §5 `activity` (line 377) | None — closed. |
| OT-DEC-003 | ~~**"New issue" visibility for a non-member is unspecified.**~~ **Resolved** 2026-08-29 by amendment to specification §2 (*Consequences the UI must handle*), §3.3 (*Add a card*) and §3.5, indexed as `OT-UX-021`: every entry point to Create issue renders disabled with an inline reason naming the project, and the route still answers Forbidden to a caller who reaches it directly — the two are independent, and neither implies the other was skipped. Hiding was rejected because §2's exception is scoped to admin-only navigation, whose rationale — a door with nothing to explain behind it — does not reach a member-only screen the user can be admitted to; and because roles are CLI-only while membership varies per project, so a hidden control would appear on one board and vanish on the next for the same user, teaching the rule to nobody. Enabled-then-403 was rejected as the dead button §2 names outright. The resolution restates for Create issue what §3.4, §3.8 and §2's assigned non-member already settle for every other member-only surface. The same amendment fixes the chevron's owner, which §3.3 put on the column composer and §3.5 on a card. | §2 (line 84), §3.5 (line 187), §3.3 (line 157) | None — closed. |
| OT-DEC-004 | ~~**Whether a project-comment notification reaches every admin.**~~ **Resolved** 2026-08-29 by amendment to specification §3.6 (*Who receives what*), indexed as `OT-OPS-014`: it reads `project_member` rows only, so an admin receives one only where they were added explicitly, and §2's two admin-inclusive lists stay the closed set it names. Including every admin was rejected on volume: with no digest, no batching and no opt-out in v1, it makes every admin's inbox a function of team-wide project chatter with no way to decline it. Both escape hatches already exist — an admin who wants the traffic adds themselves to the project, and anyone needing a particular admin on a particular comment mentions them, the mention group being one of the two lists that does include every admin. | §3.6 (line 209) vs §2 (line 41) | None — closed. |
| OT-DEC-005 | ~~**Whether editing a comment fires notifications for newly added mentions.**~~ **Resolved** 2026-08-29 by amendment to specification §3.6 (*Who receives what*), indexed as `OT-OPS-013`: an edit writes a `mention` row for each user the saved body names and the replaced body did not, and nothing else. Firing for none was rejected — with no search in v1, a mention that notifies nobody is unreachable by the person it names, and adding a forgotten name is the ordinary reason to edit a comment at all. Reconciling the set in both directions was rejected too: withdrawing a delivered notification rewrites a record the recipient may already have read and whose mail has already gone, and it is a cascade §4 does not list (`OT-OPS-010`). Repeat notification needs no separate guard — one row per comment already blocks a removed-then-re-added mention. | §3.6 (lines 209–211), §2 (line 92) | None — closed. |
| OT-DEC-006 | ~~**Whether reset requests share the sign-in throttle counter.**~~ **Resolved** 2026-08-27 by amendment to specification §5 (`auth_attempt`) and §6 (*Throttle*), indexed as `OT-SEC-017`: the flows count in separate buckets under the same limits, discriminated by a new `flow` column. A shared counter was rejected because it lets a stranger lock any known address out of sign-in with five unauthenticated reset requests, and because it blocks the reset for the one user who most needs it — whoever has just failed sign-in five times. `failed_at` becomes `attempted_at`, a reset request recording a row whether or not the address exists; counting only the unknown ones was rejected as an account-existence oracle against `OT-SEC-011`. | §6 (line 428), §3.1 (line 137) | None — closed. |
| OT-DEC-007 | ~~**"Mark all read" has no mutator.**~~ **Resolved** 2026-08-29 by amendment to specification §2 (*Write rules per mutator*) and §3.6, indexed as `OT-AUTHZ-016`: `markAllNotificationsRead` joins the *requires only self* row and clears the caller's unread rows in one statement. N calls to `markNotificationRead` was rejected — a user holding hundreds of unread rows would fire hundreds of transactions for one click, and the clear could settle half-done, which no other multi-row write in the spec is permitted to do (§4). It needs no new authorization concept: the rows are scoped from the session under the same self rule `OT-AUTHZ-003` already applies to reading them. | §3.6 (line 207) vs §2 (line 93) | None — closed. |
| OT-DEC-008 | ~~**The deactivated sign-in message "names an admin to contact"**~~ **Resolved** 2026-08-27 by amendment to specification §3.1 (*Deactivated*), indexed as `OT-SEC-018`: it names the operator-configured `SUPPORT_EMAIL` and reads no `user` row, naming no address at all where the operator has set none. Selecting an admin from the database was rejected — it hands a real admin's name and address to any unauthenticated caller, and it needs a third reader of the contact fields `OT-DATA-005` confines to Accounts and to Profile reading its own row. | §3.1 (line 134) | None — closed. |
| OT-DEC-009 | ~~**Whether the first-run seeded `ADMIN_PASSWORD` is subject to the password policy.**~~ **Resolved** 2026-08-27 by amendment to specification §6 (*First-run bootstrap*), indexed as `OT-SEC-019`: it is validated, and a non-compliant value refuses the seed and reports the rule it broke. Validating and seeding anyway was rejected — the seeded admin is the root of the whole trust chain, and its only guard would be the banner §6 itself calls advisory. The amendment makes `OT-SEC-004`'s "same policy at every entry point" true rather than forcing it to be narrowed, and carries the same rule to `admin:grant`. | §6 (line 418) vs §3.1 (line 140) | None — closed. |

---

*Index derived from `docs/product/specifications.md`. IDs are append-only.*
