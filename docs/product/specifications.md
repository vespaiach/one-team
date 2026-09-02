# One Team — product specification (v1)

## 1. Product

One Team is a small, self-hosted work tracker for **one team** of under twenty people. Two levels of structure: **issues** live in **projects**. Nothing above projects, nothing between projects and issues.

There is exactly **one team across the app** — no workspaces, no team switcher, no org or tenant layer. Everyone who signs in is in the same team, and the team is the installation.

Server-authoritative: the database is the only copy of the data, and every read is a query against it. Invite-only: there is no public sign-up — an admin invites, and only an admin can. Project membership, by contrast, is never invited: an admin adds an existing user and they are in. Desktop-only: v1 targets a desktop browser.

### In scope

| Area | v1 |
| --- | --- |
| Issues | title, description, column, priority, assignee, labels, due date, comments — **flat, no hierarchy** |
| Projects | key, name, description, status (`active` / `archived` only), start/target dates, members, comments + activity |
| Board | Trello-style Kanban, admin-editable columns (five by default), drag to move and reorder |
| Issue detail | full page, deep-linkable at `/projects/:projectKey/issues/:issueNumber/details` |
| Comments & activity | plain-text comments with `@mention`, folded into a Trello-style **activity feed** on every issue and, on project details, on every project |
| Notifications | in-app feed + email, for mention / assignment / comment |
| Access | everyone reads everything; project membership gates writes |
| Auth | email + password. No public sign-up — accounts exist only by admin invitation |

### Out of scope

Roadmap or timeline view · milestones · **sub-issues and parent issues** · **file attachments** · **a team-settings screen** · **project-level invitations** · sprints or cycles · estimates · workspaces or multiple teams · responsive and mobile layouts · list and calendar views · command palette · search of any kind · confidential or private projects · guest/read-only roles · third-party integrations · local-first or offline use of any kind · real-time push and live collaboration · audit log · public sign-up · social login · SSO · 2FA · magic-link sign-in.

---

## 2. Users, roles, permissions

Two roles on the user record (`admin`, `member`), plus project membership. Everything reduces to two predicates:

```ts
isAdmin(user)           = user.role === 'admin'
isMember(user, project) = isAdmin(user) || hasProjectMemberRow(project.id, user.id)
```

Admins are implicitly members of every project, so no downstream rule needs an `|| isAdmin` branch. One further check exists anywhere in the system: **authorship**, which applies to comments only.

Membership **predicates** include admins; membership **lists** do not. The roster on project details, the project count on Accounts and the member chips on Create project read `project_member` rows only, so an admin appears in them only if they were added explicitly. Two lists read those rows **plus** every admin: the assignee pool and the `@mention` priority group — an admin is assignable and mention-ranked in every project without holding a row.

### Matrix

`✓` allowed · `—` not allowed. "Non-member" = a signed-in user not in the project in question.

| Action | Admin | Member of project | Non-member |
| --- | :---: | :---: | :---: |
| Read any project, issue, comment, activity | ✓ | ✓ | ✓ |
| Comment on a project | ✓ | ✓ | — |
| Edit or delete an activity record | — | — | — |
| Create or delete a project | ✓ | — | — |
| Edit a project's name, description, start or target date | ✓ | ✓ | — |
| Change a project's status (archive / reopen) | ✓ | — | — |
| Add or remove project members | ✓ | — | — |
| Create, rename, reorder or delete a project's board columns | ✓ | — | — |
| Create issue in the project | ✓ | ✓ | — |
| Edit **any** issue in the project (all fields, incl. column, assignee, priority, due date, order) | ✓ | ✓ | — |
| Delete issue | ✓ | — (move to a canceled-kind column) | — |
| Post comment on an issue | ✓ | ✓ | — |
| Edit or delete **own** comment | ✓ | ✓ | ✓ (authorship survives removal) |
| Edit **another user's** comment | — | — | — |
| Delete **another user's** comment | ✓ | — | — |
| Create / edit / delete labels (the team-wide set) | ✓ | — | — |
| Apply or remove labels on an issue | ✓ | ✓ | — |
| Invite a user to the team | ✓ | — | — |
| Deactivate or reactivate a user account | ✓ | — | — |
| Set roles | ✓ (CLI) | — | — |
| Read own notifications, mark read; edit own profile | ✓ | ✓ | ✓ |

Five choices worth naming:

- **Everything is readable by everyone.** Membership is a write boundary, never a visibility one. The cost, accepted deliberately: there is no confidential project. For a team under twenty this is a limitation, not an oversight.
- **Members edit any issue in their project**, not only their own. Editing an issue *is* the work — dragging a card is an update — and an authorship-scoped rule would break the board's primary gesture for most cards.
- **Members cancel; admins delete.** Canceling — moving an issue into a `canceled`-kind column — is reversible and keeps history. Hard deletion is admin-only.
- **Labels are curated by admins, applied by anyone.**
- **Activity is append-only and unowned.** Nobody edits or deletes an activity record, not even an admin — it is a log, and a log you can rewrite is worth less than no log. The one exception is indirect: deleting a comment removes its own feed entry, because the comment *is* the entry.

### Consequences the UI must handle

- **An assigned non-member** is a real, reachable state: they see their issue and cannot change it. The issue page explains why and names the project they'd need to be added to.
- **Removing someone from a project** does nothing else — assignments stay, visibility stays, only write access goes. The removal is recorded in that project's activity.
- **Losing write access mid-session** removes no rows; controls become disabled on the next render.
- Any action a user can't take **renders disabled with an inline reason.** Never a dead button, never tooltip-only. Navigation is the one exception: sidebar entries and links leading to an admin-only screen are hidden rather than disabled, because there is no control there to explain — only a door. The exception is admin-only navigation and nothing else. A control leading to a member-only screen — the header's **New issue** button (§3.5) — renders disabled with its reason inline like any other action, because membership varies per project and a control that vanished on one board and returned on the next would teach the rule to nobody.
- The **last active admin** cannot be demoted or deactivated — `setUserRole` and `deactivateUser` count active admins under a row lock in the same transaction as the change, so two concurrent requests can't both succeed and leave zero.
- Content authored by removed or deactivated users **survives** — names still render.

### Write rules per mutator

- **Requires `isAdmin`** — `createProject`, `deleteProject`, `setProjectStatus`, `inviteUser`, `resendInvite`, `revokeInvite`, `addProjectMember`, `removeProjectMember`, `createColumn`, `updateColumn`, `moveColumn`, `deleteColumn`, `deleteIssue`, `createLabel`, `updateLabel`, `deleteLabel`, `setUserRole`, `deactivateUser`, `reactivateUser`
- **Requires `isMember` of the affected project** — `updateProject` (name, description, start date, target date — and nothing else; `key` is immutable and `status` has its own admin-only mutator), `createIssue`, `updateIssue`, `moveIssue`, `addIssueLabel`, `removeIssueLabel`, `createComment` (on an issue **or** a project)
- **Requires authorship** — `updateComment`. **Requires authorship or `isAdmin`** — `deleteComment`. Neither requires current project membership: an author removed from the project keeps both rights over their own comment, since removal takes write access to the project, not ownership of what they wrote. Nobody may edit anyone else's comment.
- **Requires only self** — `updateOwnProfile`, `markNotificationRead`, `markAllNotificationsRead`

The project used for an `isMember` check is always derived server-side from the stored row, never from a client-supplied `project_id`. The client runs the same predicates to disable controls; the server check is the enforcement, never the reverse.

---

## 3. Screens

Thirteen screens, plus modals. Every authenticated one sits inside a persistent shell.

| # | Screen | Route | Access |
| --- | --- | --- | --- |
| 1 | Sign in | `/signin`, `/invite/accept`, `/reset` | public |
| 2 | Home | `/home` | any signed-in user |
| 3 | Board | `/projects/:projectKey` | read all; write if member |
| 4 | Issue detail | `/projects/:projectKey/issues/:issueNumber/details` | read all; write if member |
| 5 | Create issue | `/projects/:projectKey/issues/new` | member |
| 6 | Notifications | `/notifications` | own only |
| 7 | Create project | `/projects/new` | admin |
| 8 | Project details (record, columns, members, activity) | `/projects/:projectKey/details` | read all; members edit the record and comment; admin-only status, members, columns |
| 9 | Accounts (Invitations · Accounts) | `/settings/accounts` | admin |
| 10 | Labels | `/settings/labels` | admin |
| 11 | Forbidden (403) | any | — |
| 12 | Profile | `/profile` | own only |
| 13 | Change password | `/reset?token=…` | public — reachable only via the token link emailed after a reset request (Forgot password, §3.1, or Profile's "Change password", §3.12) |
| 14 | Modals | — | Add member, Invite user, Create label, Edit label |

### The shell

- **Sidebar, 262px fixed** — app mark, Home, the project list (alphabetical by name, active first, then archived and dimmed), Notifications (with unread count), Accounts and Labels (admin only, hidden for everyone else), user chip at the foot. No team switcher; there is one team, and the only project-level screen of its kind is project details (reached from the board header).
- **Header** — title block (name + context line), one per-screen control (board grouping, notifications' "mark all read"), and a **New issue** button pinned far right. On a project-scoped screen the title block also carries the project's name, comment count and the Board / Details tab pair (§3.8), and it is only there — Board, issue detail, project details — that **New issue** renders at all, since only those routes name the project it would create in.
- Content fills the remainder. No mobile breakpoint.

### 3.1 Sign in

Full-screen card on the page background, outside the shell. Email + password, and **no sign-up link** — there is nothing for a stranger to do here.

| State | Screen |
| --- | --- |
| Form | Email, password, "Sign in", and a "Forgot password?" link. Nothing else. |
| Rejected | One message for both a wrong password and an unknown email: "That email and password don't match." Never reveal whether an account exists. |
| Deactivated | Its own message — the credentials were right, the account is closed. It names the operator-configured contact address (`SUPPORT_EMAIL`), and nothing else: no `user` row is read or disclosed on this route. Where the operator has set none, the message names no address and reads "Contact your One Team administrator." |
| Throttled | After five failures for one address, or twenty for one IP address across any addresses, sign-in refuses for fifteen minutes and says so with the remaining time. |
| Accept invite | `/invite/accept?token=…` — first name, last name, and a password the user chooses, with the invited address shown and immutable. Submitting creates the `user` row and signs them straight in. Expired, used and unknown tokens each get their own explanatory state. |
| Forgot password | `/reset` — an email field and "Send reset link", nothing else. Submitting always reports "If that address has an account, a link is on the way", whether or not one exists, and is throttled the same as sign-in (§6). |
| Reset password | This is the **Change password** screen (§3, screen 13): `/reset?token=…`, a full-page screen outside the shell, exactly like Sign in itself: no sidebar, no header. Reached either from the emailed link above or from Profile's "Change password" (§3.12) — there is no other way in; the route is never entered directly. Two required fields, **New password** and **Confirm password**; the password must meet the same policy as everywhere else (below): minimum twelve characters, no composition rules, checked against the blocklist. A mismatch between the two fields is an inline error on Confirm password. Expired, used and unknown tokens each get their own explanatory state, the same convention as Accept invite. On success the password is updated, every session for that user ends (below), and the screen redirects to `/signin` with a success message — the user signs in fresh with the new password. |

Passwords: minimum twelve characters, no composition rules, checked against a blocklist of the common ones. Any completed reset ends every session for that user, including — when the request came from an authenticated Profile page — the one that made the request; that browser returns to Sign in on its next action. Sign-in sets one `HttpOnly` session cookie; there is no "remember me" — the cookie is always 30 days sliding.

### 3.2 Home

The landing page after sign-in. Unlike every other authenticated screen, Home renders without the shell's Header (§3) — no title block, no per-screen control, no New issue button; the sidebar still shows. Read-only roll-up, no writes at all:

greeting · three stat cards (assigned to you, due this week, unread) · **Assigned to you** (issue rows) · **Your projects** (name, status, progress — active projects only) · **Mentions** (the 5 most recent `mention` notifications addressed to the viewer, newest first) · **Recent activity** (the 20 most recent rows across every project and issue feed, newest first).

Project progress = issues in a `done` column / (total − issues in a `canceled` column). When that denominator is zero — a project with no issues, or none outside its `canceled` columns — progress reads 0%.

**Mentions reads `notification`, not comment bodies.** The recipient set was already computed and filtered when the row was written (§3.6) — the actor removed, deactivated users excluded, `mention` winning over `comment` — so re-deriving it from `@[<user_id>]` tokens in `comment.body` would be a second implementation of the same rule, free to drift from the first and unindexed besides. Rows are listed read and unread alike, unread carrying the same dot §3.6 gives them: Home writes nothing and so can mark nothing read, and an unread-only section would drain behind the reader with no way to refill it, while the unread stat card above already counts what is outstanding. Like every notification read, the query is scoped to the viewer's own `user_id` (§5, *Read boundary*).

### 3.3 Board — the Trello model

The project's main screen and the app's centre of gravity.

- **Columns belong to the project.** Every new project starts with five: Backlog · Todo · In Progress · Done · Canceled, in that order. An admin can rename them, add more, reorder them by drag, and delete them under the restrictions in §3.8 — per project, so two projects need not agree. Each column shows its name and a count.
- **Every project has at least one column**, and column edits live on project details (§3.8), not on the board itself.
- **Columns are lists of cards.** Drag a card anywhere: to another column, to any position within a column. Drop position is the only ordering input — no sort control, no manual rank field.
- **"Add a card"** sits inline at the foot of every column: click, type a title, enter. Creates an issue in that column. Shift-enter or a chevron opens the full New issue page instead (§3.5), with that column preselected. Under Assignee or Priority grouping there is no column to take: the issue lands in the project's first column by `sort_order` and carries the assignee or priority its drop column represents, and the chevron preselects the same. For a non-member the composer renders in every column, disabled, its placeholder carrying the reason in place of "Add a card", so the board keeps the same shape for everyone and only its affordances differ (§3.8).
- **A card shows** key (`WEB-142`), title, and, when set: priority glyph, labels, assignee avatar, due date, comment count. Nothing else.
- **Clicking a card** opens issue detail as a full page (not a peek panel), so the URL is shareable.
- **Grouping** — the header control regroups the board by Column (default), Assignee, or Priority. Under Column the columns are the project's own; under Priority they are the five priorities; under Assignee they are the project's members plus every admin (§2), plus anyone still assigned an issue here but no longer a member (§2, *an assigned non-member*), each listed once, with an **Unassigned** column first — assignee is optional, and those cards must land somewhere. The drop-sets-the-field behaviour is identical in each; only what the columns mean changes.
- **Empty column** — a single quiet line, not an illustration.

**Ordering.** One `moveIssue` call per drop. It writes `sort_order` (a base-62 fractional index, one row touched) and, on a cross-column drop, whichever field the current grouping represents — column, assignee, or priority.

An issue has **one order across the whole project**, not one per column. Every grouping is that single sequence, filtered. The honest consequence, which the UI should not hide: reordering under Column also changes relative position under Assignee. Ties are legal and never repaired; every ordered query sorts by `(sort_order, id)`, and since ids are UUIDv7 the tie-break is creation order.

**Creation.** `createIssue` writes an index after every existing issue in the project, so a new issue is last in that single sequence — and therefore last in whatever column, assignee or priority lane it lands in, which for the board's inline composer puts the new card directly above the composer that made it. It is the only `sort_order` write that does not originate from a drop; both creation paths use it, the inline "Add a card" composer and the Create issue page (§3.5). No existing row is touched.

There is no locking and no live push (out of scope, §1): the last `moveIssue` to reach the server wins outright, and dragging is optimistic against whatever the client last fetched. A losing client only learns its board is stale from the periodic re-query (§4, *Board drift*), never from a rejected write. A re-query landing mid-drag updates the board underneath the drag and the drop then resolves against the fresh neighbours; it never cancels the drag, and the write still wins outright.

### 3.4 Issue detail

Full page. Main column + **262px meta rail**.

- **Key** — the project key plus the issue's number, `WEB-142`. The number is auto-incremented per project by `issue_counter` at creation, permanent and never reused; both parts are read-only on this page (§5, *Keys*). It is the page's first element and the copy-link target.
- **Main** — key, title, description, then **Activity**. In the comment composer — the only place mentions are written (§7) — `@mention` autocomplete lists project members and admins first (§2), everyone else below, and excludes deactivated users.
- **Title and description are edited in place** — no edit mode, no separate form. Click the text and it becomes a field: title a single line (22px/700, required, trimmed), description a multi-line area that grows with its content. Escape reverts, and a blur or ⌘-enter saves; a save is one `updateIssue` call, applied optimistically and rolled back with a toast if the server refuses. For a non-member the text is not clickable and carries the same disabled reason as the rail.
- **The description supports basic markdown** — bold, italic, inline code, links, bullet and numbered lists, and headings. Nothing else: no tables, no images, no embeds, no HTML (it is escaped, not rendered). Stored as the markdown source in `issue.description`; rendered on read, shown raw while editing. Comments stay plain text with mention tokens.
- **Activity** is a single reverse-chronological feed, Trello's model: comments and system records share one stream rather than sitting in separate tabs. A comment composer sits at its head; a **Comments only / All activity** toggle filters the stream and remembers the choice per user in `user.feed_filter` (§5). The feed loads the most recent 50 rows and appends the next page on scroll, exactly as a project's does (§3.8).

Everything that happens around an issue lands there: created · title, description, column, priority, assignee or due date changed · label added or removed · commented. One row per change with actor, verb, from → to, and a relative time (`Ana moved this from Todo to In Progress · 2h`). Consecutive changes by the same actor within five minutes collapse into one line, expandable.
- **Rail** — column, priority, assignee, labels and due date are quick-change controls for members and disabled controls with a reason for non-members; project, created-by and timestamps are shown, not controls, the way an immutable field renders elsewhere (§3.12) — an issue cannot change project (§5, invariant 2). The assignee pool is the project's members plus every admin (§2), deactivated users excluded.
- **Issues are flat.** There is no parent and no child: an issue belongs to a project and nothing else. A team that needs to break work down writes a checklist in the description or files separate issues in the same project.

### 3.5 Create issue

A full page at `/projects/:projectKey/issues/new`, not a modal — title, description, column, priority, labels, assignee and due date is more than a modal should hold, the same reasoning as Create project (§3.7). Reached from the header's **New issue** button on any project-scoped screen (Board, issue detail, project details) and from the column composer's chevron on the board, which preselects that column (§3.3). Write access follows project membership. For a non-member every entry point renders disabled with the reason inline (§2) — the header's **New issue** button, the board's inline composer and its chevron — and is never hidden; the reason names the project, as elsewhere ("Only project members can create issues in Website Redesign"). The route itself still refuses: a non-member who reaches it by deep link, bookmark, stale tab, or a membership removed mid-session gets Forbidden (§3.11). The disabled control and the Forbidden screen are independent — neither implies the other was skipped. Cancel returns to wherever the user came from; Create runs one `createIssue` call and, on success, navigates to the new issue's detail page.

| Field | Behaviour |
| --- | --- |
| **Title** | Required, trimmed, the form's first and focused field — the only required field. Create stays enabled and reports a missing title as an inline error rather than going dead. |
| **Description** | Optional, multi-line, grows with its content, and supports the same **basic markdown** as an issue's own description (§3.4): bold, italic, inline code, links, bullet and numbered lists, headings. Nothing else, no HTML. Stored as markdown source. |
| **Column** | One of the project's own board columns (§3.8, Columns). Defaults to the project's first column by `sort_order`; preselected when opened from a column's chevron. |
| **Priority** | One of **Urgent, High, Medium, Low, No priority**. Defaults to No priority. |
| **Labels** | Optional, multiple, picked from the team-wide label set (§3.10). The picker offers only what exists — no inline creation here, same as the issue rail's label picker. |
| **Assignee** | Optional, one of the project's members plus every admin (§2), deactivated users excluded. Unassigned by default. |
| **Due date** | Optional. |

Project is fixed by the route, not a field on the form. The write is not optimistic: like an issue's key elsewhere on the page, its number is server-assigned under a row lock (§5, *Keys*) and can't be known until the server responds, so the form waits and shows in-flight state on the button.

**Ordering.** Creation places the issue at the foot of the project's single order (§3.3, *Creation*), exactly as the board's inline composer does.

**Activity.** Creation writes one `created` row to the new issue's own activity feed (§3.4) — so an issue's history opens with its own creation rather than starting blank.

### 3.6 Notifications

Reverse-chronological list. Unread rows carry a dot. Each row names the actor, the type (mentioned you / assigned you / commented), the issue or project, and a relative time; clicking it opens the issue or project, at the comment when there is one (`#comment-<id>` on that route). "Mark all read" lives in the header and is one `markAllNotificationsRead` call (§2) over the caller's own unread rows, not one call per row; the set it clears is scoped server-side from the session, never from anything the client sends. Three types only: `mention`, `assignment`, `comment` (issue or project). Status changes notify nobody. Activity records notify nobody — the feed is a log, not a channel. You are never notified about your own action.

**Who receives what.** A `mention` goes to each person named in the comment. An `assignment` goes to the new assignee, whichever write set the field (below). A `comment` on an issue goes to that issue's assignee and its creator; a `comment` on a project goes to that project's `project_member` rows — a membership **list**, not the predicate (§2), so an admin receives one only where they were added explicitly. With no digest, no batching and no opt-out below, mailing every admin on every project comment would be a cost no admin could decline; one who wants that traffic adds themselves to the project, and anyone who needs a particular admin on a particular comment mentions them. The actor is removed from every recipient set before the rows are written — including when they mention themselves — so `CHECK (user_id <> actor_id)` (§5) is a backstop, never the mechanism. Deactivated users are removed from every recipient set too — the exclusion §3.9 already makes in every picker, applied here as well — so a closed account is neither written a row nor mailed; deactivation deliberately keeps its `project_member` rows so reactivation restores prior access (§6), and without this rule those retained rows would go on drawing mail to an address whose owner can no longer sign in to read it. One person gets one row per comment: if they would receive both, the `mention` wins.

**An `assignment` follows the field, not the mutator.** Three writes set `issue.assignee_id` — `createIssue`, from Create issue's Assignee field or from the board's inline composer under Assignee grouping (§3.5, §3.3); `updateIssue`, from the issue rail (§3.4); and `moveIssue`, on a cross-lane drop under Assignee grouping (§3.3) — and each writes one `assignment` row whenever it sets that field to somebody other than the actor. Classifying by mutator instead would make one visible event — you were given this issue — notify in some paths and not others, with nothing on screen to explain which, and it would leave the board's primary gesture silent: dropping a card into someone's lane is the most direct way to hand over work in the product, and dragging is where most of that handing over happens. A write that does not change the field notifies nobody, so reordering inside one assignee's lane is silent; so is a drop into **Unassigned**, which clears the field and leaves no new assignee to tell. Assigning yourself is silent under the actor rule above, not under a rule of its own.

**An edit notifies only the people it newly names.** `updateComment` (§2) diffs the mention set of the saved body against the body it replaces and writes one `mention` row per user added, under the same rules as a new comment — the actor removed, the mail sent after commit. Nothing else fires: the `comment` recipient set belongs to the comment's creation and is never revisited, and a mention an edit takes out takes nothing back, since the row and its mail are already delivered and withdrawing them is a cascade §4 does not list. A person already holding a row for this comment gets no second one — one row per comment holds for the comment's whole life, not only its first write, which is what stops a mention removed and re-added from notifying anyone twice.

**Delivery.** The `notification` row is written in the same transaction as the change that caused it; the email goes out after that transaction commits, never inside it, so a slow or dead SMTP host can neither fail a write nor hold a request open. A send that succeeds stamps `emailed_at`; one that fails leaves it null and is retried by the sweep (§7) up to three times over an hour, after which the row keeps its in-app life and the email is abandoned. One mail per notification, immediate — no digest, no batching, no opt-out in v1.

### 3.7 Create project — admin

A full page at `/projects/new`, not a modal — the form carries six fields and a member roster, which is more than a modal should hold. Reached from the sidebar's `+` beside Projects; admin-only. A non-admin who lands on the route gets Forbidden (§3.11). Cancel returns to wherever the user came from; Create runs one `createProject` call, seeds the five default columns, and navigates to the new board.

| Field | Behaviour |
| --- | --- |
| **Name** | Required, trimmed, the form's first and focused field. |
| **Project key** | **Derived from the name**: the first letter of each word, uppercased, truncated to **8 characters** (`Website Redesign` → `WR`, `One Team Design Ops` → `OTDO`). It keeps following the name until the user edits it, after which it is theirs and the name no longer touches it. Editable inline, uppercased as typed, `^[A-Z][A-Z0-9]{0,7}$`. Unique across the team, checked against the server as typed and again on submit; a collision is an inline error on the field with the taken key named, never a silent suffix. A derived value that is empty or does not match the pattern — `3D Redesign` derives to `3R`, which does not — leaves the field empty and required. **Immutable after creation** (§5, invariant 7) — the field says so. |
| **Description** | Optional, multi-line, grows with its content, and supports the same **basic markdown** as an issue description: bold, italic, inline code, links, bullet and numbered lists, headings. Nothing else, no HTML. Stored as markdown source. |
| **Start date** | Optional. |
| **Target date** | Optional, and independent of start — either, both or neither. If both are set, target must not precede start; that is an inline error on the target field. The same rule holds wherever the dates are edited later (§3.8) and is enforced by `updateProject`, not the form alone. |
| **Members** | Optional. Picks from users who already have accounts — the same picker as Add member (§3.8), deactivated users excluded, and no invitation path from here; if the person has no account, an admin invites them first (§3.9) and adds them afterwards. The creating admin is not listed: admins are implicitly members of every project. Chips with a remove affordance; each one becomes a `project_member` row in the creating transaction. |

Not on this form: **status**, which starts at `active` (a project is either active or archived, and nothing is created archived), and **columns** — both are set afterwards on project details (§3.8), which is where the project's whole record lives. Creation asks for the least that makes a board usable.

**Validation** is per-field and on blur, never a wall of errors on submit. Create stays enabled and reports what is missing rather than going dead. The write is not optimistic: a project is a large object with a unique key, so the form waits for the server and shows in-flight state on the button.

**Activity.** Creation writes one `created` row to the project's feed, plus one `member_added` row per member, all in the same transaction — so a new project's feed opens with its own history rather than an empty stream, which is why the feed needs no empty state.

### 3.8 Project details

The project's record, at `/projects/:projectKey/details`, reached from the tab beside Board in the project header, which also carries the project's name and comment count. **One screen** — no separate settings page and no separate activity page; everything about the project lives here, and what a given user may change is decided per section, not per screen. Anyone signed in can open and read it. Every control a user cannot use renders disabled with an inline reason (§2), so the page looks the same to everyone and only its affordances differ.

**Details — editable by project members.** Name, description, start date, target date, edited in place exactly as on an issue: click the value, it becomes a field, escape reverts, blur or ⌘-enter saves, one `updateProject` call. The description takes the same basic markdown as the create form (§3.7). The key is shown and immutable (§5, invariant 7). There is no project lead: a project has members and nothing else.

**Status — admin only.** A two-state switch, `active` or `archived`. Archiving is the only lifecycle act a project has: it is reversible, changes nothing else about the project, and is what unlocks Delete. Members see the current state, disabled, with the reason.

**Columns — admin only.** The board's columns in board order: name, kind, and issue count per row. Every project starts with five default columns — Backlog, Todo, In Progress, Done, and Canceled — and only an admin can add, update, remove or reorder them: add appends a column of kind `open`, drag reorders, rename is inline; `kind` itself is fixed at creation and never editable afterward, so a project's `done`- and `canceled`-kind columns stay identifiable and can't be reassigned around a delete restriction. A rename colliding with another column in the same project (case-insensitively, §5) is an inline error naming the existing column, never a silent suffix. **Delete is offered only on an empty column** — a column holding issues must be emptied first, so no issue is ever moved or destroyed by a column edit. The last column cannot be deleted; neither can the project's last `canceled`-kind column, a member's only route to remove an issue (§2); neither can the project's last `done`-kind column, without which the project's progress could never leave zero and no later column could restore it, `kind` being fixed at creation. Each refusal states its own reason. For everyone else this is a read-only list of the board's columns and their counts.

**Members — admin only.** The roster, with add and remove. **Add member** picks from the users who already have accounts; there is no project-level invitation, no pending membership and nothing to accept — an added member has write access on their next request. If the person has no account yet, an admin invites them to the team first (**Invite people**, §3.9) and adds them once they have accepted. Removing a member revokes their write access to this project and nothing else: assignments, comments and activity all stay. Members and non-members see the roster and cannot change it.

Every change on this screen — an edited field, a status change, a column edit, an add or a remove (naming both the actor and the member) — is recorded in the project's activity feed.

**Delete — admin only.** Available only when the project is `archived`, and it states the size of what it will destroy before doing it.

**Activity — read by anyone, comment if a member.** The project's feed sits at the foot of this screen, not on a page of its own.

- **Composer at the head** — plain text, `@mention` autocomplete (project members and admins first (§2), everyone else below, deactivated users excluded), ⌘-enter to post. A posted comment appears at the top of the feed immediately. Non-members get the composer disabled with a reason.
- **One reverse-chronological stream** — comments and system records interleaved, newest first, exactly as on an issue. No tabs inside the feed.
- **A row is** actor avatar and name, the verb, from → to for a field change, and a relative time: `Ana archived this project · 2h`. Comment rows show the body, plus edit for their author and delete for their author or an admin (§2); every other row is fixed text — activity is append-only and nobody edits it.
- **Comments only / All activity** toggle, the same control as on an issue, remembering the choice per user across both feeds in `user.feed_filter` (§5).
- **Collapsing** — consecutive changes by the same actor within five minutes fold into one line ("Ana made 3 changes"), expandable.
- **Pagination** — the feed loads the most recent 50 rows and appends the next page on scroll.

Everything that happens to the project record lands here: **created** · **renamed** · **description, start or target date changed** · **member added or removed** (naming both the actor and the member) · **column added, renamed, reordered or deleted** · **archived or reopened** · **commented**.

The feed is about the project record itself, not a merge of its issues' feeds. Issue churn stays on issues; a busy project would otherwise bury its own history under a hundred card moves. Home's **Recent activity** section is the cross-project roll-up and reads from both feeds.

### 3.9 Accounts — admin, a full page

A full page at `/settings/accounts`, reached from the sidebar's **Accounts** item (admin only, under Notifications); admin-only. A non-admin who lands on the route gets Forbidden (§3.11). It is the only place accounts are created or closed, and the last thing left over from the removed Team settings screen. Two tabs, **Invitations** and **Accounts**, in that order, with Invitations selected on arrival. The tab is local page state, not a route — there is nothing to link to.

**Invitations.** An **Invite** button at the top of the tab opens the invite form in a modal: one email field, a submit button, and inline validation on blur — malformed address, an address that already has an account (it names the account and offers a link to it), an address already invited (it offers resend instead). Submitting runs one `inviteUser` call, mails a 7-day single-use link, closes the modal and shows the new invitation at the top of the list. Cancel or Escape closes it and discards the field.

Below the button, every invitation not yet accepted or revoked: address, who invited them, when it was sent, when it expires, and **Resend** and **Revoke** beside each. Resend reissues the link and restarts the 7 days; revoke invalidates the token immediately and drops the row. Expired invitations stay in the list, marked expired, with resend still offered. An invitation grants a login, not membership — accepting it creates the user and nothing more; projects are joined afterwards, by an admin, from project details (§3.8). Empty: one quiet line, "No outstanding invitations".

**Accounts.** Every account on the team, active first, then deactivated: avatar and name, email, role, joined date, and the projects they belong to as a count. Each row carries **Deactivate** (or **Reactivate** on a closed account) as its one control; roles stay CLI-only in v1.

- **Deactivate** ends every session for that user, refuses their next sign-in with the deactivated message (§3.1), and excludes them from every picker — Add member, assignee, `@mention`. It removes nothing: memberships, assignments, comments and activity all stay, and their name still renders everywhere it already did. It asks for confirmation once, naming what stays.
- **Reactivate** restores sign-in and picker eligibility, with the memberships the account already had. No re-invitation, no new token.
- The **last active admin** cannot be deactivated — that row's control is disabled with the reason inline (§2).
- Deactivating or reactivating a user is not project activity and creates no activity record. The account’s current state is represented by user.deactivated_at; previous state changes and their actors are not retained in v1. Projects and project memberships are untouched.

### 3.10 Labels — admin, a full page

One global set, shared by every project. A label has one field and nothing else: **name**. It is never scoped to a project, so the same set appears everywhere and applying one is never gated by which project the issue is in. Members apply and remove labels on issues from the issue rail's label picker (§3.4); they cannot create, rename or delete one — the picker offers only what exists, and its "Manage labels" link, being navigation to an admin-only screen, is hidden for them rather than disabled (§2).

The set is curated on a full page at `/settings/labels`, admin-only, reached from the sidebar's **Labels** item (§3, The shell) or from the "Manage labels" link at the foot of any label picker — the issue rail's and Create issue's alike — shown to admins only. A non-admin who lands on the route gets Forbidden (§3.11).

**The list.** Every label on the team, alphabetical: name, and the number of issues currently carrying it, across all projects. Each row carries **Edit** and **Delete**. A **New label** button sits at the head of the page. Empty: one quiet line, "No labels yet".

**Create — a modal.** **New label** opens a modal with a name field and nothing else, so the form is submittable the moment a name is typed. Validation on blur: name is required, trimmed, and unique case-insensitively (§5) — a clash names the existing label. Enter or **Create label** runs one `createLabel` call; escape or Cancel closes and discards. The new label appears in the list immediately and is available in every picker on the next open.

**Edit — the same modal, populated.** Name, editable, one `updateLabel` call. **An update applies everywhere at once**: the label is one row, so a rename changes it on every issue that carries it, on every board card, and in every picker — there is no per-project or per-issue copy to reconcile, and nothing is re-tagged.

**Delete — everywhere, and immediate.** Deleting a label removes it **from every issue that carries it**, in every project. It is a hard delete of the label row and its `issue_label` joins in one transaction (§4); the issues themselves are untouched. Because it is not reversible, delete confirms once and states the size of what it will affect by name and count — "Delete *blocked*? It will be removed from 14 issues. This can't be undone." A label carrying no issues confirms the same way, without the count.

Creating, renaming, or deleting a team-wide label creates no activity record in v1, and a deletion writes none on the issues it is removed from either. Applying or removing a label on an issue by hand still creates `label_added` or `label_removed` activity on that issue.

### 3.11 Forbidden (403)

Rendered **inside the shell**, not as a full-screen takeover: error code, one sentence of explanation, and a route back to Home. It is for a signed-in user who lacks a right; an unauthenticated request to an authenticated route redirects to `/signin` and never reaches this screen. Since everyone can read everything, a missing row means it genuinely does not exist — the UI must not imply a hidden-access state.

### 3.12 Profile

A full page at `/profile`, reached from the sidebar's user chip (§3, The shell). Shows and edits only the signed-in user's own record — there is no route to view or edit anyone else's profile; their name, avatar and job title still surface contextually elsewhere (assignee, activity actor, the Accounts roster) without a dedicated page. Write access follows `updateOwnProfile` (§2): requires only self, nobody else's permission enters into it.

Fields are edited in place exactly as on project details (§3.8): click a value, it becomes a field, escape reverts, blur or ⌘-enter saves, one `updateOwnProfile` call per field, applied optimistically and rolled back with a toast if the server refuses.

| Field | Behaviour |
| --- | --- |
| **Avatar** | A URL text field (`avatar_url`) — paste a link, no upload control, consistent with the rest of v1 (out of scope: file attachments). |
| **First name** | Required, trimmed. |
| **Last name** | Required, trimmed. |
| **Job title** | Optional, free text — a role or position, e.g. "Web Developer", "Design Lead". Distinct from the account's `admin`/`member` role (below), which this screen never edits. |
| **Slack handle** | Optional, free text. No format validation. |
| **Phone** | Optional, free text. No format validation. |
| **Bio** | Optional, free text, multi-line, grows with its content. Plain text, no markdown — the same convention as comments (§5). |

**Read-only.** Email and account role (`admin`/`member`) are shown but never editable here — email is the login credential, and role changes stay CLI-only (§2, §6). Both render the way an immutable field does elsewhere in the app (the project key, §3.8): shown, not a control.

**Change password.** A link, not a field: one click sends a reset link to the signed-in user's own email, no form, reusing the identical request-and-token mechanism and throttle as Forgot password (§3.1) and landing on the Change password screen (§3, screen 13). A toast confirms: "Check your email for a link to reset your password."

Elsewhere in the app, a user's display name is their first and last name joined with a space.

**No activity record.** Activity attaches only to a project or an issue (§5, invariant 10); there is no user-level feed, so editing your own profile is not recorded anywhere and notifies nobody.

---

## 4. Behaviour and states

### Nothing cascades

- Archiving a project does not touch its issues: they keep their columns and stay readable, and members keep write access.
- Renaming, reordering or deleting a column never touches an issue. Deletion is refused under the restrictions in §3.8.
- Status changes fire no notifications. They are recorded as activity, which is a different thing: writing history costs nothing and interrupts nobody.
- Every transition is legal in both directions: any issue column to any other, and a project between `active` and `archived`. No terminal state, no guardrails, no confirmation.

### Deletes

Hard deletes, cascading in the database. There is no `deleted_at` — cancellation (issues) and archiving (projects) are the reversible paths, and a user is never deleted at all (`deactivated_at` instead).

- **Deleting a project** requires `status = 'archived'` first, then cascades through its columns, issues, comments, activity, label joins, notifications, memberships and its `issue_counter` row.
- **Deleting a column** is refused unless it is empty, is not the project's last, and — if it is `canceled`- or `done`-kind — is not the project's last column of that kind, so it never cascades, members never lose their only route to remove an issue, and a project never loses its only way to count work done.
- **Deleting an issue** cascades to its comments, activity, label joins and notifications. Nothing else references it, so nothing survives it.
- **Deleting a label** cascades to its `issue_label` joins only, so it disappears from every issue carrying it and the issues themselves are unchanged. There is no archived state for a label and no refusal: a label in heavy use deletes as readily as an unused one, after one confirmation naming the count (§3.10).
- **Deleting a comment** cascades to its own `activity` row — the comment *is* the entry (§2) — and to any `notification` carrying its `comment_id`. It is the one delete a non-admin can perform.

Every delete runs in **one server transaction** — the row and everything the cascade reaches go together, and the response carries the settled state. There is no intermediate moment where a row is gone and its dependents are not. Project delete navigates away on success.

### Cross-cutting states

| State | Treatment |
| --- | --- |
| Loading | Per-screen skeletons that match the layout they replace — board columns, issue rail, feed rows. Never a full-screen spinner, never a layout shift when data lands. |
| Stale after navigation | A revisited screen re-queries the server; nothing renders from a client cache. |
| Board drift | The board re-queries on window focus and every 30s while it's the active tab, so a drop made by someone else surfaces without a manual navigation; a re-query landing mid-drag updates the board underneath the drag, and the drop then resolves against the fresh neighbours rather than the stale ones. It never cancels the drag, and the write still wins outright (§3.3). |
| Empty | One quiet line per surface. No illustrations, no empty-state marketing. |
| Slow write | The control shows in-flight state and stays interactive-blocked only for itself. Small, local writes (drag, status, assignee) apply immediately and roll back on failure; anything larger waits for the server. |
| Rejected write | The change rolls back and a toast names what failed and why ("Only project members can edit issues in Website Redesign"). |
| Connection lost | A single banner: "Can't reach the server. Reconnecting." Writes are refused with "Changes need a connection" — nothing is queued for later. |
| Permission-disabled | Disabled control + inline reason. |
| Not found | "This doesn't exist" — never "you don't have access". |
| Toasts | Four kinds (success / info / warning / error), top-right, stacked, auto-dismiss. |

---

## 5. Data model

Sixteen tables, all server-side: `user`, `project`, `project_member`, `board_column`, `issue`, `label`, `issue_label`, `comment`, `activity`, `notification`, `issue_counter`, `credential`, `invite`, `reset_token`, `session`, `auth_attempt`. (`milestone` and `attachment` are removed with their features.) Nothing replicates to the client; what a screen can see is decided by the query that serves it.

Conventions: UUIDv7 primary keys, server-generated · `text` + `CHECK` for enumerations, not `pgEnum`, because widening a `CHECK` is an ordinary transactional migration · `date` for calendar dates (`due_date`, `start_date`, `target_date`) and `timestamptz` for instants · `sort_order text COLLATE "C"` · `snake_case`, singular table names · `updated_at` written explicitly by every mutator through one `touched()` helper, never a trigger · every free-text column is length-bounded by a `CHECK`: 200 characters for names, titles, keys and handles, 10 000 for descriptions, comment bodies and bios · calendar dates are compared in the server's own timezone, set once by the operator, so "due this week" and overdue mean the same thing for everyone on the installation.

### Key fields

**`user`** — `first_name`, `last_name`, `email` (`UNIQUE (lower(email))`), `avatar_url`, `role` (`admin|member`), `job_title`, `slack_handle`, `phone`, `bio`, `deactivated_at`, `must_change_password` (default `false`, set only on the seeded first admin, §6), `feed_filter` (`comments|all`, default `all` — the activity toggle's remembered choice, §3.4). The password hash lives in a separate `credential` table and is never selected into a response; `role` is read from this row on every request rather than cached in a token.
**`project`** — `key` (`^[A-Z][A-Z0-9]{0,7}$` — up to 8 characters, unique, **immutable**, derived from the name at creation per §3.7), `name`, `description`, `status` (`active|archived`, default `active` — there is no planned, paused or completed state), `start_date`, `target_date`. No `sort_order`: the sidebar lists projects alphabetically by name (§3, The shell).
**`project_member`** — `(project_id, user_id)` composite PK. No role column.
**`board_column`** — `project_id`, `name`, `sort_order`, and `kind` (`open|done|canceled`, set at creation and never changed by `updateColumn`) which carries the semantics status used to: `done` and `canceled` are what Home's progress figure and "cancel rather than delete" read. Seeded with five rows on project creation (Backlog `open` · Todo `open` · In Progress `open` · Done `done` · Canceled `canceled`); a column added later is always `open`. `UNIQUE (project_id, lower(name))`. A project always has at least one row, at least one `canceled`-kind row and at least one `done`-kind row (invariants 12 and 14); `kind` need not otherwise be unique within a project.
**`issue`** — `project_id` (required), `number`, `title`, `description`, `column_id` (required, and always a column of the issue's own project — this replaces the old `status` enum), `priority` (`none|low|medium|high|urgent`), `assignee_id`, `due_date`, `created_by`, `sort_order`.
**`label`** — one global set, `UNIQUE (lower(name))`. No `project_id`: labels are never project-scoped.
**`comment`** — `author_id`, plain-text `body` which may carry mention tokens (`@[<user_id>]`, rendered as that user's current display name, so a rename follows), and exactly one of `issue_id` / `project_id` (`CHECK` on the pair) so the same table serves both feeds. Editable by its author, deletable by its author or an admin (§2). Plain text only — there is no upload control, no file storage, no attachments root to configure and no orphan files to reclaim anywhere in v1. A team that needs to share a file links to it.

**`activity`** — the append-only log behind both feeds. Exactly one of `issue_id` / `project_id`; `actor_id`; `type` (`created | field_changed | label_added | label_removed | member_added | member_removed | column_added | column_renamed | column_reordered | column_deleted | archived | reopened | comment`); `field` and `from_value` / `to_value` as nullable text, `field` naming the thing that changed — for `field_changed` a single scalar (column, priority, assignee, due date, name, description, dates); for `label_added` / `label_removed`, `to_value` / `from_value` respectively hold that one label's name, so a multi-label change is one row per label rather than one row holding a set; `member_added` / `member_removed` use those same two slots the same way, for that member's display name (§3.12), `field` unused and the actor coming from `actor_id` as it does on every row. For a `column_` row `field` is that board column's own name, and the value pair carries a transition only where the change has one: `column_renamed` holds the old and new names, and `column_reordered` holds in `to_value` the name of the column it now follows, null meaning it is now first; `column_added` and `column_deleted` carry neither. Reordering several columns writes one row per column moved, which §3.8's five-minute collapsing folds into one line. All of these are frozen display strings captured at write time and truncated to 200 characters — so a long description never lands whole in the log, a display name joining two 200-character columns cannot overrun the bound §5's conventions put on every free-text column, and a later rename of the column, user or label does not rewrite history. `comment_id` for `comment` rows; `created_at`. No `updated_at` — rows are never modified. Written by the mutators, in the same database transaction as the change they describe, so a change and its record land together or not at all.
**`notification`** — `user_id`, `actor_id`, `type` (`mention|assignment|comment`), exactly one of `issue_id` / `project_id` (a project comment's mention or comment notification has no issue to attach to), `comment_id` optional, `read_at`, `emailed_at`. `CHECK (user_id <> actor_id)`.
**`auth_attempt`** — the throttle's durable counter (§6): `flow` (`signin|reset`), `kind` (`email|ip`), `subject` (the lowercased address or the IP), `attempted_at`. A sign-in records a row only when it fails; a reset request records one every time, since it cannot fail from the caller's side (§3.1) and counting only the requests for an unknown address would make the throttle itself an account-existence oracle. Attempts are counted over the last fifteen minutes for one `(flow, kind, subject)`, so the two flows never share a counter; a successful sign-in clears that address's `signin` rows and leaves the IP's untouched, so holding one valid credential is not a way to reset the per-IP counter; rows past the window are swept by the same timer that retries mail (§7).

### Keys

Issues are addressed as `WEB-142` — a per-project key plus a per-project number, both permanent. An `issue_counter` table hands out numbers under a row lock, so issue creation never touches the project row; numbers are **monotonic and never reused**. The number is assigned server-side within the creating transaction, so it is correct and final the first time the client sees it.

### Invariants

| # | Invariant | Enforced by |
| --- | --- | --- |
| 1 | Every issue belongs to a project | `NOT NULL` |
| 2 | An issue cannot change project | `updateIssue` |
| 3 | Issues are flat — no issue references another | no parent column exists |
| 4 | An issue's column belongs to the issue's project | composite FK `(project_id, column_id)` |
| 5 | A project always has at least one column | `deleteColumn` |
| 6 | A column with issues cannot be deleted | `deleteColumn` |
| 7 | `project.key` is immutable | `updateProject` |
| 8 | A project must be `archived` before deletion | `deleteProject` |
| 9 | Issue numbers are monotonic per project, never reused | `issue_counter` |
| 10 | A comment, an activity row and a notification each attach to exactly one issue **or** one project | `CHECK` on the pair |
| 11 | Activity rows are never updated, and are deleted only by cascade — from their own comment, or from the issue or project they belong to | no `update` mutator exists, and no `delete` mutator targets a row directly |
| 12 | A project always has at least one `canceled`-kind column | `deleteColumn` |
| 13 | At least one admin is always active | `deactivateUser` / `setUserRole`, under a row lock on the admin count, in the same transaction as the change |
| 14 | A project always has at least one `done`-kind column | `deleteColumn` |

### Read boundary

Every response is shaped by the query behind it, not by a replication rule. Two conventions hold that line: `user` is selected through one `publicUser` projection (`id, first_name, last_name, avatar_url, role, job_title, deactivated_at`) that every endpoint reuses, so a column added later cannot leak by default — the contact fields (`email`, `slack_handle`, `phone`, `bio`) come from a second `accountUser` projection used only by Accounts (admin, §3.9) and by Profile reading its own row (§3.12), which is what "no route to view anyone else's profile" (§3.12) means in the data; and the auth tables (`credential`, `session`, `reset_token`, `invite` secrets), `issue_counter` and `auth_attempt` are never reachable from a read endpoint at all. One row-level rule exists in the whole system: notifications are readable only by their own `user_id`. Everything else is readable by any signed-in user, which is what keeps the queries simple at this team size.

---

## 6. Authentication

Hand-written, no auth library. One credential: **email + password**.

**No public sign-up.** Four routes are reachable by a stranger and no more: sign-in, the reset request, the reset submission and invite acceptance — the public screens of §3. Sign-in is `POST /api/auth/signin`, a plain route handler rather than a server action, so the throttle and the origin check sit in one place. An account comes into being one way: an **admin invites an address**, which mails a 7-day single-use link; accepting it sets a first name, last name and password and creates the `user` row. Members cannot invite. There is no self-service route in and no open registration form to attack.

**An invitation is a login, not access.** It creates a user who can sign in and read; it never carries project membership. Adding someone to a project is a separate, direct act by an admin with no acceptance step — so the two concerns stay apart, and a pending invitation can never leave a half-joined project behind.

**First-run bootstrap.** On first deployment only, the app seeds a **single default admin** from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the environment. `ADMIN_PASSWORD` is held to the same password policy as every other entry point (§3.1): a value under twelve characters or on the blocklist is refused, seeding does not run, and the app reports which rule the value failed. Since no other route creates the first account, the installation stays uninstalled until the operator supplies a compliant value — the failure is loud, first-run only, and fixed by editing the environment. If any user row already exists, seeding is skipped — that check is the whole marker, so the path cannot run twice and cannot be used to mint a second admin later. The seeded row carries `must_change_password` (§5); until that admin changes the password, every screen carries a banner saying so. The banner is advisory and blocks nothing. They change it through Profile's **Change password** link (§3.12) like anyone else or, if SMTP is not yet configured, with `admin:grant` over SSH (below); either path clears the flag. Every other account in the system descends from an invitation by that admin or one they promoted.

**Storage.** Passwords are Argon2id hashes in a `credential` table — never in a response, never in a cookie, never logged. Session, invite and reset tokens are 32 random bytes stored as SHA-256 digests, so nothing in the codebase compares two secrets and a leaked database yields no working credential.

**Sessions are server-side, in a cookie.** A successful sign-in writes a `session` row (user, created, last-seen, expiry, user-agent, IP) and sets one opaque session id as an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie — 30 days sliding, refreshed on use. The cookie carries **no claims and no signature to verify**: it is a lookup key, and every request reads the session row to learn who the actor is and whether they are still allowed in. Nothing about identity is cached in a token, so a revoked session dies on its next request rather than at the end of some expiry window. Signing out, a password reset, or deactivation deletes the rows and takes effect immediately, everywhere, including other devices.

**Every request is authenticated the same way.** `loadActor()` resolves the cookie to a session row and reads `role` and `deactivated_at` from Postgres in the same query, and that is the actor every read query and every mutator receives. Nothing about identity or membership is cached anywhere — membership is read per mutation — so there is no stale-claim window and no second, weaker check to get wrong.

**CSRF.** `SameSite=Lax` plus an origin check on every mutating request. No cross-site form posts, no token-in-header dance.

**Throttle** — five failed sign-ins for one address locks that address for fifteen minutes; independently, twenty failed sign-ins from one IP address, across any addresses it targets, locks that IP for fifteen minutes — so a party who doesn't hold the address can't sustain a lockout against it by cycling attempts from one source. Both counted in `auth_attempt` (§5) so they survive a restart. Reset requests are throttled the same way — the same five-per-address and twenty-per-IP limits over the same fifteen minutes — but in their own counter, discriminated by `auth_attempt.flow` (§5), so reset traffic can never lock an address out of sign-in and failed sign-ins can never block the reset that would fix them. They always answer identically whether or not the address exists.

**Break-glass and user administration** — `npm run admin:grant -- --email=… --first-name=… --last-name=…` over SSH creates or promotes an admin, sets a password, clears `deactivated_at` and clears `must_change_password`; `admin:deactivate` closes an account. The password is prompted for and read from the terminal, never passed as a flag — the command runs over SSH on the box itself, where an argument would land in shell history and the process table — and it is held to the same policy as every other entry point (§3.1); a non-compliant value is refused and the command writes nothing. With no team-settings screen, **role changes remain CLI-only in v1**; deactivation and invitations, which are needed routinely, have their own UI instead (Accounts, §3.9). This is also the total-lockout recovery, separate from first-run seeding.

**Deactivation** revokes sign-in and writes immediately and deletes every session row, so reads stop on the next request too. Membership rows are retained so reactivation restores prior access.

---

## 7. Stack

Next.js 16.x App Router (server components and server actions for reads and writes, sign-in excepted — it is a route handler, §6) · React Aria Components · Tailwind · React Aria Drag and Drop for board · Drizzle ORM + PostgreSQL 18 · `@node-rs/argon2` + `nodemailer` for hand-written auth — no JWT library, sessions are database rows behind a cookie · `uuidv7`, `fractional-indexing`. No sync engine, no client database, no service worker. One in-process interval timer covers the notification-mail retry sweep (§3.6) and the `auth_attempt` sweep (§6) — no queue, no external scheduler. Self-hosted on a single box; SMTP is whatever the operator already runs.

### Palette

Monochrome. Two red-orange families and a neutral ramp are the whole hue set the product uses — accent `#ec3013` for interface state (primary actions, links, the focus ring) and a muted second tone, accent-2 `#e15b47`, for advisory state. There is no per-project, per-column or per-label colour: those three identities are told apart by **name alone**, never by a swatch. A project, a board column and a label each carry one field for identity — `name` — and nothing else picks a colour for them (§5).

### Frontend rules

**Component behaviour and accessibility: React Aria Components.** Interaction behaviour, focus management, keyboard support and ARIA semantics come from React Aria Components; Tailwind supplies the visual layer only.

**Coding rule — React Aria first.** Reach for a React Aria component before writing anything: buttons, fields, selects, checkboxes, dialogs, popovers, menus, tabs, tooltips, list boxes, toasts. Only when no suitable React Aria component exists (or the pinned version does not ship one) is a custom-built component acceptable, and it must reproduce the same keyboard, focus and ARIA behaviour. Exception in v1: `@mention` autocomplete inside comments (custom, built from `Popover` + `ListBox`) — comments only, since mention tokens live in `comment.body` alone (§5) and a description is markdown source.
