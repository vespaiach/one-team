# One Team — product specification (v1)

## 1. Product

One Team is a small, self-hosted work tracker for **one team** of under twenty people. Two levels of structure: **issues** live in **projects**. Nothing above projects, nothing between projects and issues.

There is exactly **one team across the app** — no workspaces, no team switcher, no org or tenant layer. Everyone who signs in is in the same team, and the team is the installation.

Server-authoritative: the database is the only copy of the data, and every read is a query against it. Invite-only: there is no public sign-up — an admin invites, and only an admin can. Project membership, by contrast, is never invited: an admin adds an existing user and they are in. Desktop-only: v1 targets a desktop browser.

### In scope

| Area | v1 |
| --- | --- |
| Issues | title, description, status, priority, assignee, labels, due date, comments — **flat, no hierarchy** |
| Projects | key, name, description, status (`active` / `archived` only), start/target dates, colour, members, comments + activity |
| Board | Trello-style Kanban, admin-editable columns (five by default), drag to move and reorder |
| Issue detail | full page, deep-linkable at `/projects/:projectKey/issues/:issueNumber/details` |
| Comments & activity | plain-text comments with `@mention`, folded into a Trello-style **activity feed** on every issue and, on project details, on every project |
| Notifications | in-app feed + email, for mention / assignment / comment |
| Access | everyone reads everything; project membership gates writes |
| Auth | email + password. No public sign-up — accounts exist only by admin invitation |

### Out of scope

Roadmap or timeline view · milestones · **sub-issues and parent issues** · **file attachments** · **a team-settings screen** · **project-level invitations** · sprints or cycles · estimates · workspaces or multiple teams · responsive and mobile layouts · list and calendar views · command palette · confidential or private projects · guest/read-only roles · third-party integrations · local-first or offline use of any kind · real-time push and live collaboration · audit log · public sign-up · social login · SSO · 2FA · magic-link sign-in.

---

## 2. Users, roles, permissions

Two roles on the user record (`admin`, `member`), plus project membership. Everything reduces to two predicates:

```ts
isAdmin(user)           = user.is_admin === true
isMember(user, project) = isAdmin(user) || hasProjectMemberRow(project.id, user.id)
```

Admins are implicitly members of every project, so no downstream rule needs an `|| isAdmin` branch. One further check exists anywhere in the system: **authorship**, which applies to comments only.

### Matrix

`✓` allowed · `—` not allowed. "Non-member" = a signed-in user not in the project in question.

| Action | Admin | Member of project | Non-member |
| --- | :---: | :---: | :---: |
| Read any project, issue, comment, activity | ✓ | ✓ | ✓ |
| Comment on a project | ✓ | ✓ | — |
| Edit or delete an activity record | — | — | — |
| Create or delete a project | ✓ | — | — |
| Edit a project's name, description, start or target date, colour | ✓ | ✓ | — |
| Change a project's status (archive / reactivate) | ✓ | — | — |
| Add or remove project members | ✓ | — | — |
| Create, rename, reorder or delete a project's board columns | ✓ | — | — |
| Create issue in the project | ✓ | ✓ | — |
| Edit **any** issue in the project (all fields, incl. status, assignee, priority, due date, order) | ✓ | ✓ | — |
| Delete issue | ✓ | — (move to a canceled-kind column) | — |
| Post comment | ✓ | ✓ | — |
| Edit or delete **own** comment | ✓ | ✓ | n/a |
| Edit **another user's** comment | — | — | — |
| Delete **another user's** comment | ✓ | — | — |
| Create / edit / delete labels (the team-wide set) | ✓ | — | — |
| Apply or remove labels on an issue | ✓ | ✓ | — |
| Invite a user to the team | ✓ | — | — |
| Add or remove a project member (no invitation) | ✓ | — | — |
| Deactivate or reactivate a user account | ✓ | — | — |
| Set roles | ✓ (CLI) | — | — |
| Read own notifications, mark read; edit own profile | ✓ | ✓ | ✓ |

Four choices worth naming:

- **Everything is readable by everyone.** Membership is a write boundary, never a visibility one. The cost, accepted deliberately: there is no confidential project. For a team under twenty this is a limitation, not an oversight.
- **Members edit any issue in their project**, not only their own. Editing an issue *is* the work — dragging a card is an update — and an authorship-scoped rule would break the board's primary gesture for most cards.
- **Members cancel; admins delete.** Canceling — moving an issue into a `canceled`-kind column — is reversible and keeps history. Hard deletion is admin-only.
- **Labels are curated by admins, applied by anyone.**
- **Activity is append-only and unowned.** Nobody edits or deletes an activity record, not even an admin — it is a log, and a log you can rewrite is worth less than no log. The one exception is indirect: deleting a comment removes its own feed entry, because the comment *is* the entry.

### Consequences the UI must handle

- **An assigned non-member** is a real, reachable state: they see their issue and cannot change it. The issue page explains why and names the project they'd need to be added to.
- **Removing someone from a project** does nothing else — assignments stay, visibility stays, only write access goes. The removal is recorded in that project's activity.
- **Losing write access mid-session** removes no rows; controls become disabled on the next render.
- Any action a user can't take **renders disabled with an inline reason.** Never a dead button, never tooltip-only.
- The **last active admin** cannot be demoted or deactivated — `setUserRole` and `deactivateUser` count active admins under a row lock in the same transaction as the change, so two concurrent requests can't both succeed and leave zero.
- Content authored by removed or deactivated users **survives** — names still render.

### Write rules per mutator

- **Requires `isAdmin`** — `createProject`, `deleteProject`, `setProjectStatus`, `inviteUser`, `resendInvite`, `revokeInvite`, `addProjectMember`, `removeProjectMember`, `createColumn`, `updateColumn`, `moveColumn`, `deleteColumn`, `deleteIssue`, `createLabel`, `updateLabel`, `deleteLabel`, `setUserRole`, `deactivateUser`, `reactivateUser`
- **Requires `isMember` of the affected project** — `updateProject` (name, description, start date, target date, colour — and nothing else; `key` is immutable and `status` has its own admin-only mutator), `createIssue`, `updateIssue`, `moveIssue`, `addIssueLabel`, `removeIssueLabel`, `createComment` (on an issue **or** a project)
- **Requires `isMember` and authorship** — `updateComment`, `deleteComment` (admins may delete anyone's; nobody may edit anyone else's comment)
- **Requires only self** — `updateOwnProfile`, `markNotificationRead`

The project used for an `isMember` check is always derived server-side from the stored row, never from a client-supplied `project_id`. The client runs the same predicates to disable controls; the server check is the enforcement, never the reverse.

---

## 3. Screens

Thirteen screens, plus modals. Every authenticated one sits inside a persistent shell.

| # | Screen | Route | Access |
| --- | --- | --- | --- |
| 1 | Sign in | `/signin`, `/invite/accept`, `/reset` | public |
| 2 | Home | `/home` | any signed-in user |
| 3 | Board | `/projects/:key` | read all; write if member |
| 4 | Issue detail | `/projects/:projectKey/issues/:issueNumber/details` | read all; write if member |
| 5 | Create issue | `/projects/:projectKey/issues/new` | member |
| 6 | Notifications | `/notifications` | own only |
| 7 | Create project | `/projects/new` | admin |
| 8 | Project details (record, columns, members, activity) | `/projects/:key/details` | read all; members edit the record and comment; admin-only status, members, columns |
| 9 | Accounts (Invitations · Accounts) | `/settings/accounts` | admin |
| 10 | Labels | `/settings/labels` | admin |
| 11 | Unauthorized (401) | any | — |
| 12 | Profile | `/profile` | own only |
| 13 | Change password | `/reset?token=…` | public — reachable only via the token link emailed after a reset request (Forgot password, §3.1, or Profile's "Change password", §3.12) |
| 14 | Modals | — | Add member, Invite user, Create label, Edit label |

### The shell

- **Sidebar, 262px fixed** — app mark, Home, the project list, Notifications (with unread count), Accounts (admin only), user chip at the foot. No team switcher; there is one team, and the only project-level screen of its kind is project details (reached from the board header).
- **Header** — title block (name + context line), one per-screen control (board grouping, notifications' "mark all read"), search, and a **New issue** button pinned far right.
- Content fills the remainder. No mobile breakpoint.

### 3.1 Sign in

Full-screen card on the page background, outside the shell. Email + password, and **no sign-up link** — there is nothing for a stranger to do here.

| State | Screen |
| --- | --- |
| Form | Email, password, "Sign in", and a "Forgot password?" link. Nothing else. |
| Rejected | One message for both a wrong password and an unknown email: "That email and password don't match." Never reveal whether an account exists. |
| Deactivated | Its own message — the credentials were right, the account is closed. Names an admin to contact. |
| Throttled | After five failures for one address, or twenty for one IP address across any addresses, sign-in refuses for fifteen minutes and says so with the remaining time. |
| Accept invite | `/invite/accept?token=…` — first name, last name, and a password the user chooses, with the invited address shown and immutable. Submitting creates the `user` row and signs them straight in. Expired, used and unknown tokens each get their own explanatory state. |
| Forgot password | `/reset` — an email field and "Send reset link", nothing else. Submitting always reports "If that address has an account, a link is on the way", whether or not one exists, and is throttled the same as sign-in (§6). |
| Reset password | This is the **Change password** screen (§3, screen 13): `/reset?token=…`, a full-page screen outside the shell, exactly like Sign in itself: no sidebar, no header. Reached either from the emailed link above or from Profile's "Change password" (§3.12) — there is no other way in; the route is never entered directly. Two required fields, **New password** and **Confirm password**; the password must meet the same policy as everywhere else (below): minimum twelve characters, no composition rules, checked against the blocklist. A mismatch between the two fields is an inline error on Confirm password. Expired, used and unknown tokens each get their own explanatory state, the same convention as Accept invite. On success the password is updated, every session for that user ends (below), and the screen redirects to `/signin` with a success message — the user signs in fresh with the new password. |

Passwords: minimum twelve characters, no composition rules, checked against a blocklist of the common ones. Any completed reset ends every other session for that user — including, when the request came from an authenticated Profile page, the session that made the request; that browser returns to Sign in on its next action. Sign-in sets one `HttpOnly` session cookie; there is no "remember me" — the cookie is always 30 days sliding.

### 3.2 Home

The landing page after sign-in. Unlike every other authenticated screen, Home renders without the shell's Header (§3) — no title block, no per-screen control, no search, no team avatars, no New issue button; the sidebar still shows. Read-only roll-up, no writes at all:

greeting · three stat cards (assigned to you, due this week, unread) · **Assigned to you** (issue rows) · **Your projects** (name, status, progress) · **Mentions** · **Recent activity**.

Project progress = issues in a `done` column / (total − issues in a `canceled` column).

### 3.3 Board — the Trello model

The project's main screen and the app's centre of gravity.

- **Columns belong to the project.** Every new project starts with five: Backlog · Todo · In Progress · Done · Canceled, in that order. An admin can rename them, add more, reorder them by drag, and delete any that is empty — per project, so two projects need not agree. Each column shows its name, a count, and its colour dot.
- **Every project has at least one column**, and column edits live on project details (§3.8), not on the board itself.
- **Columns are lists of cards.** Drag a card anywhere: to another column, to any position within a column. Drop position is the only ordering input — no sort control, no manual rank field.
- **"Add a card"** sits inline at the foot of every column: click, type a title, enter. Creates an issue in that column. Shift-enter or a chevron opens the full New issue page instead (§3.5), with that column preselected.
- **A card shows** key (`WEB-142`), title, and, when set: priority glyph, labels, assignee avatar, due date, comment count. Nothing else.
- **Clicking a card** opens issue detail as a full page (not a peek panel), so the URL is shareable.
- **Grouping** — the header control regroups the board by Column (default), Assignee, or Priority. Under Column the columns are the project's own; under the other two they are the people or the five priorities. The drop-sets-the-field behaviour is identical in each; only what the columns mean changes.
- **Empty column** — a single quiet line, not an illustration.

**Ordering.** One `moveIssue` call per drop. It writes `sort_order` (a base-62 fractional index, one row touched) and, on a cross-column drop, whichever field the current grouping represents — column, assignee, or priority.

An issue has **one order across the whole project**, not one per column. Every grouping is that single sequence, filtered. The honest consequence, which the UI should not hide: reordering under Column also changes relative position under Assignee. Ties are legal and never repaired; every ordered query sorts by `(sort_order, id)`, and since ids are UUIDv7 the tie-break is creation order.

There is no locking and no live push (out of scope, §1): the last `moveIssue` to reach the server wins outright, and dragging is optimistic against whatever the client last fetched, not against the server's current state. A losing client only learns its board is stale from the periodic re-query (§4, *Board drift*), never from a rejected write.

### 3.4 Issue detail

Full page. Main column + **262px meta rail**.

- **Key** — the project key plus the issue's number, `WEB-142`. The number is auto-incremented per project by `issue_counter` at creation, permanent and never reused; both parts are read-only on this page (§5, *Keys*). It is the page's first element and the copy-link target.
- **Main** — key, title, description, then **Activity**. `@mention` autocomplete lists project members first, everyone else below, and excludes deactivated users.
- **Title and description are edited in place** — no edit mode, no separate form. Click the text and it becomes a field: title a single line (22px/700, required, trimmed), description a multi-line area that grows with its content. Escape reverts, and a blur or ⌘-enter saves; a save is one `updateIssue` call, applied optimistically and rolled back with a toast if the server refuses. For a non-member the text is not clickable and carries the same disabled reason as the rail.
- **The description supports basic markdown** — bold, italic, inline code, links, bullet and numbered lists, and headings. Nothing else: no tables, no images, no embeds, no HTML (it is escaped, not rendered). Stored as the markdown source in `issue.description`; rendered on read, shown raw while editing. Comments stay plain text with mention tokens.
- **Activity** is a single reverse-chronological feed, Trello's model: comments and system records share one stream rather than sitting in separate tabs. A comment composer sits at its head; a **Comments only / All activity** toggle filters the stream and remembers the choice per user.

Everything that happens around an issue lands there: created · title, description, column, priority, assignee or due date changed · label added or removed · commented. One row per change with actor, verb, from → to, and a relative time (`Ana moved this from Todo to In Progress · 2h`). Consecutive changes by the same actor within five minutes collapse into one line, expandable.
- **Rail** — column, priority, assignee, labels, due date, project, created-by, timestamps. Each is a quick-change control for members and a disabled control with a reason for non-members.
- **Issues are flat.** There is no parent and no child: an issue belongs to a project and nothing else. A team that needs to break work down writes a checklist in the description or files separate issues in the same project.

### 3.5 Create issue

A full page at `/projects/:projectKey/issues/new`, not a modal — title, description, column, priority, labels, assignee and due date is more than a modal should hold, the same reasoning as Create project (§3.7). Reached from the header's **New issue** button on any project-scoped screen (Board, issue detail, project details) and from a card's chevron on the board, which preselects that card's column. Write access follows project membership: a non-member who lands on the route gets Unauthorized (§3.11). Cancel returns to wherever the user came from; Create runs one `createIssue` call and, on success, navigates to the new issue's detail page.

| Field | Behaviour |
| --- | --- |
| **Title** | Required, trimmed, the form's first and focused field — the only required field. Create stays enabled and reports a missing title as an inline error rather than going dead. |
| **Description** | Optional, multi-line, grows with its content, and supports the same **basic markdown** as an issue's own description (§3.4): bold, italic, inline code, links, bullet and numbered lists, headings. Nothing else, no HTML. Stored as markdown source. |
| **Column** | One of the project's own board columns (§3.8, Columns). Defaults to the project's first column by `sort_order`; preselected when opened from a column's chevron. |
| **Priority** | One of **Urgent, High, Medium, Low, No priority**. Defaults to No priority. |
| **Labels** | Optional, multiple, picked from the team-wide label set (§3.10). The picker offers only what exists — no inline creation here, same as the issue rail's label picker. |
| **Assignee** | Optional, one of the project's members — the same pool as Add member (§3.8), deactivated users excluded. Unassigned by default. |
| **Due date** | Optional. |

Project is fixed by the route, not a field on the form. The write is not optimistic: like an issue's key elsewhere on the page, its number is server-assigned under a row lock (§5, *Keys*) and can't be known until the server responds, so the form waits and shows in-flight state on the button.

**Activity.** Creation writes one `created` row to the new issue's own activity feed (§3.4) — so an issue's history opens with its own creation rather than starting blank.

### 3.6 Notifications

Reverse-chronological list. Unread rows carry a dot. Each row names the actor, the type (mentioned you / assigned you / commented), the issue or project, and a relative time; clicking it opens the issue or project, at the comment when there is one. "Mark all read" lives in the header. Three types only: `mention`, `assignment`, `comment` (issue or project). Status changes notify nobody. Activity records notify nobody — the feed is a log, not a channel. You are never notified about your own action.

### 3.7 Create project — admin

A full page at `/projects/new`, not a modal — the form carries eight fields and a member roster, which is more than a modal should hold. Reached from the sidebar's `+` beside Projects; admin-only. A non-admin who lands on the route gets Unauthorized (§3.11). Cancel returns to wherever the user came from; Create runs one `createProject` call, seeds the five default columns, and navigates to the new board.

| Field | Behaviour |
| --- | --- |
| **Name** | Required, trimmed, the form's first and focused field. |
| **Project key** | **Derived from the name**: the first letter of each word, uppercased, truncated to **8 characters** (`Website Redesign` → `WR`, `One Team Design Ops` → `OTDO`). It keeps following the name until the user edits it, after which it is theirs and the name no longer touches it. Editable inline, uppercased as typed, `^[A-Z][A-Z0-9]{0,7}$`. Unique across the team, checked against the server as typed and again on submit; a collision is an inline error on the field with the taken key named, never a silent suffix. A name with no letters (or one that derives to nothing) leaves the field empty and required. **Immutable after creation** (§5, invariant 7) — the field says so. |
| **Description** | Optional, multi-line, grows with its content, and supports the same **basic markdown** as an issue description: bold, italic, inline code, links, bullet and numbered lists, headings. Nothing else, no HTML. Stored as markdown source. |
| **Start date** | Optional. |
| **Target date** | Optional, and independent of start — either, both or neither. If both are set, target must not precede start; that is an inline error on the target field. |
| **Colour** | Required, one of the seven palette values (§7 accent + the five status colours), picked from swatches. Defaults to the accent. It is the dot beside the project everywhere in the app. |
| **Members** | Optional. Picks from users who already have accounts — the same picker as Add member (§3.8), deactivated users excluded, and no invitation path from here; if the person has no account, an admin invites them first (§3.9) and adds them afterwards. The creating admin is not listed: admins are implicitly members of every project. Chips with a remove affordance; each one becomes a `project_member` row in the creating transaction. |

Not on this form: **status**, which starts at `active` (a project is either active or archived, and nothing is created archived), and **columns** — both are set afterwards on project details (§3.8), which is where the project's whole record lives. Creation asks for the least that makes a board usable.

**Validation** is per-field and on blur, never a wall of errors on submit. Create stays enabled and reports what is missing rather than going dead. The write is not optimistic: a project is a large object with a unique key, so the form waits for the server and shows in-flight state on the button.

**Activity.** Creation writes one `created` row to the project's feed, plus one `member_added` row per member, all in the same transaction — so a new project's feed opens with its own history rather than "History starts here".

### 3.8 Project details

The project's record, at `/projects/:key/details`, reached from the tab beside Board in the project header, which also carries the project's colour dot, name and comment count. **One screen** — no separate settings page and no separate activity page; everything about the project lives here, and what a given user may change is decided per section, not per screen. Anyone signed in can open and read it. Every control a user cannot use renders disabled with an inline reason (§2), so the page looks the same to everyone and only its affordances differ.

**Details — editable by project members.** Name, description, start date, target date, colour, edited in place exactly as on an issue: click the value, it becomes a field, escape reverts, blur or ⌘-enter saves, one `updateProject` call. The description takes the same basic markdown as the create form (§3.7). The key is shown and immutable (§5, invariant 7). There is no project lead: a project has members and nothing else.

**Status — admin only.** A two-state switch, `active` or `archived`. Archiving is the only lifecycle act a project has: it is reversible, changes nothing else about the project, and is what unlocks Delete. Members see the current state, disabled, with the reason.

**Columns — admin only.** The board's columns in board order: name, colour, kind, and issue count per row. Every project starts with five default columns — Backlog, Todo, In Progress, Done, and Canceled — and only an admin can add, update, remove or reorder them: add appends a column of kind `open`, drag reorders, rename is inline; `kind` itself is fixed at creation and never editable afterward, so a project's `done`- and `canceled`-kind columns stay identifiable and can't be reassigned around a delete restriction. **Delete is offered only on an empty column** — a column holding issues must be emptied first, so no issue is ever moved or destroyed by a column edit. The last column cannot be deleted, and neither can the project's last `canceled`-kind column: it's a member's only route to remove an issue (§2), so deleting the last one is refused with that reason. For everyone else this is a read-only list of the board's columns and their counts.

**Members — admin only.** The roster, with add and remove. **Add member** picks from the users who already have accounts; there is no project-level invitation, no pending membership and nothing to accept — an added member has write access on their next request. If the person has no account yet, an admin invites them to the team first (**Invite people**, §3.9) and adds them once they have accepted. Removing a member revokes their write access to this project and nothing else: assignments, comments and activity all stay. Members and non-members see the roster and cannot change it.

Every change on this screen — an edited field, a status change, a column edit, an add or a remove (naming both the actor and the member) — is recorded in the project's activity feed.

**Delete — admin only.** Available only when the project is `archived`, and it states the size of what it will destroy before doing it.

**Activity — read by anyone, comment if a member.** The project's feed sits at the foot of this screen, not on a page of its own.

- **Composer at the head** — plain text, `@mention` autocomplete (project members first, everyone else below, deactivated users excluded), ⌘-enter to post. A posted comment appears at the top of the feed immediately. Non-members get the composer disabled with a reason.
- **One reverse-chronological stream** — comments and system records interleaved, newest first, exactly as on an issue. No tabs inside the feed.
- **A row is** actor avatar and name, the verb, from → to for a field change, and a relative time: `Ana archived this project · 2h`. Comment rows show the body, and, for their author, edit and delete; every other row is fixed text — activity is append-only and nobody edits it.
- **Comments only / All activity** toggle, the same control as on an issue, remembering the choice per user across both feeds.
- **Collapsing** — consecutive changes by the same actor within five minutes fold into one line ("Ana made 3 changes"), expandable.
- **Empty** — one quiet line, "History starts here", for a project whose records predate the log (§9).
- **Pagination** — the feed loads the most recent 50 rows and appends the next page on scroll.

Everything that happens to the project record lands here: **created** · **renamed** · **description, start or target date, or colour changed** · **member added or removed** (naming both the actor and the member) · **column added, renamed, reordered or deleted** · **archived or reopened** · **commented**.

The feed is about the project record itself, not a merge of its issues' feeds. Issue churn stays on issues; a busy project would otherwise bury its own history under a hundred card moves. Home's **Recent activity** section is the cross-project roll-up and reads from both feeds.

### 3.9 Accounts — admin, a full page

A full page at `/settings/accounts`, reached from the sidebar's **Accounts** item (admin only, under Notifications); admin-only. A non-admin who lands on the route gets Unauthorized (§3.11). It is the only place accounts are created or closed, and the last thing left over from the removed Team settings screen. Two tabs, **Invitations** and **Accounts**, in that order, with Invitations selected on arrival. The tab is local page state, not a route — there is nothing to link to.

**Invitations.** An **Invite** button at the top of the tab opens the invite form in a modal: one email field, a submit button, and inline validation on blur — malformed address, an address that already has an account (it names the account and offers a link to it), an address already invited (it offers resend instead). Submitting runs one `inviteUser` call, mails a 7-day single-use link, closes the modal and shows the new invitation at the top of the list. Cancel or Escape closes it and discards the field.

Below the button, the invitations still outstanding: address, who invited them, when it was sent, when it expires, and **Resend** and **Revoke** beside each. Resend reissues the link and restarts the 7 days; revoke invalidates the token immediately and drops the row. Expired invitations stay in the list, marked expired, with resend still offered. An invitation grants a login, not membership — accepting it creates the user and nothing more; projects are joined afterwards, by an admin, from project details (§3.8). Empty: one quiet line, "No outstanding invitations".

**Accounts.** Every account on the team, active first, then deactivated: avatar and name, email, role, joined date, and the projects they belong to as a count. Each row carries **Deactivate** (or **Reactivate** on a closed account) as its one control; roles stay CLI-only in v1.

- **Deactivate** ends every session for that user, refuses their next sign-in with the deactivated message (§3.1), and excludes them from every picker — Add member, assignee, `@mention`. It removes nothing: memberships, assignments, comments and activity all stay, and their name still renders everywhere it already did. It asks for confirmation once, naming what stays.
- **Reactivate** restores sign-in and picker eligibility, with the memberships the account already had. No re-invitation, no new token.
- The **last active admin** cannot be deactivated — that row's control is disabled with the reason inline (§2).
- Deactivating or reactivating a user is not project activity and creates no activity record. The account’s current state is represented by user.deactivated_at; previous state changes and their actors are not retained in v1. Projects and project memberships are untouched.

### 3.10 Labels — admin, a full page

One global set, shared by every project. A label has two fields and nothing else: **name** and **colour**. It is never scoped to a project, so the same set appears everywhere and applying one is never gated by which project the issue is in. Members apply and remove labels on issues from the issue rail's label picker (§3.4); they cannot create, rename, recolour or delete one — the picker offers only what exists, and its create affordance is absent for them rather than disabled.

The set is curated on a full page at `/settings/labels`, admin-only, reached from the "Manage labels" link at the foot of any issue's label picker (shown to admins only). A non-admin who lands on the route gets Unauthorized (§3.11).

**The list.** Every label on the team, alphabetical: colour swatch, name, and the number of issues currently carrying it, across all projects. Each row carries **Edit** and **Delete**. A **New label** button sits at the head of the page. Empty: one quiet line, "No labels yet".

**Create — a modal.** **New label** opens a modal with a name field and a colour picker over the same fixed palette used for projects and columns; a swatch is pre-selected so the form is submittable with a name alone. Validation on blur: name is required, trimmed, and unique case-insensitively (§5) — a clash names the existing label. Enter or **Create label** runs one `createLabel` call; escape or Cancel closes and discards. The new label appears in the list immediately and is available in every picker on the next open.

**Edit — the same modal, populated.** Name and colour, both editable, one `updateLabel` call. **An update applies everywhere at once**: the label is one row, so a rename or a recolour changes it on every issue that carries it, on every board card, and in every picker — there is no per-project or per-issue copy to reconcile, and nothing is re-tagged.

**Delete — everywhere, and immediate.** Deleting a label removes it **from every issue that carries it**, in every project. It is a hard delete of the label row and its `issue_label` joins in one transaction (§4); the issues themselves are untouched. Because it is not reversible, delete confirms once and states the size of what it will affect by name and count — "Delete *blocked*? It will be removed from 14 issues. This can't be undone." A label carrying no issues confirms the same way, without the count.

Creating, renaming, recolouring, or deleting a team-wide label creates no activity record in v1. Applying or removing a label from an issue still creates label_added or label_removed activity on that issue.

### 3.11 Unauthorized (401)

Rendered **inside the shell**, not as a full-screen takeover: error code, one sentence of explanation, and a route back to Home. Since everyone can read everything, a missing row means it genuinely does not exist — the UI must not imply a hidden-access state.

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
- Renaming, reordering or deleting a column never touches an issue. Deletion is refused while the column holds any.
- Status changes fire no notifications. They are recorded as activity, which is a different thing: writing history costs nothing and interrupts nobody.
- Every transition is legal in both directions: any issue column to any other, and a project between `active` and `archived`. No terminal state, no guardrails, no confirmation.

### Deletes

Hard deletes, cascading in the database. There is no `deleted_at` — cancellation (issues) and archiving (projects) are the reversible paths, and a user is never deleted at all (`deactivated_at` instead).

- **Deleting a project** requires `status = 'archived'` first, then cascades through its columns, issues, comments, activity, labels-joins, notifications and memberships.
- **Deleting a column** is refused unless it is empty, is not the project's last, and — if it is `canceled`-kind — is not the project's last `canceled`-kind column, so it never cascades and members never lose their only route to remove an issue.
- **Deleting an issue** cascades to its comments, activity, label joins and notifications. Nothing else references it, so nothing survives it.
- **Deleting a label** cascades to its `issue_label` joins only, so it disappears from every issue carrying it and the issues themselves are unchanged. There is no archived state for a label and no refusal: a label in heavy use deletes as readily as an unused one, after one confirmation naming the count (§3.10).

Both deletes run in **one server transaction** — the row and everything the cascade reaches go together, and the response carries the settled state. There is no intermediate moment where a row is gone and its dependents are not. Project delete navigates away on success.

### Cross-cutting states

| State | Treatment |
| --- | --- |
| Loading | Per-screen skeletons that match the layout they replace — board columns, issue rail, feed rows. Never a full-screen spinner, never a layout shift when data lands. |
| Stale after navigation | A revisited screen re-queries the server; nothing renders from a client cache. |
| Board drift | The board re-queries on window focus and every 30s while it's the active tab, so a drop made by someone else surfaces without a manual navigation; if a card the user is mid-drag on has already moved server-side, the drop target re-resolves against the fresh position rather than overwriting it silently. |
| Empty | One quiet line per surface. No illustrations, no empty-state marketing. |
| Slow write | The control shows in-flight state and stays interactive-blocked only for itself. Small, local writes (drag, status, assignee) apply immediately and roll back on failure; anything larger waits for the server. |
| Rejected write | The change rolls back and a toast names what failed and why ("Only project members can edit issues in Website Redesign"). |
| Connection lost | A single banner: "Can't reach the server. Reconnecting." Writes are refused with "Changes need a connection" — nothing is queued for later. |
| Permission-disabled | Disabled control + inline reason. |
| Not found | "This doesn't exist" — never "you don't have access". |
| Toasts | Four kinds (success / info / warning / error), top-right, stacked, auto-dismiss. |

---

## 5. Data model

Fifteen tables, all server-side: `user`, `project`, `project_member`, `board_column`, `issue`, `label`, `issue_label`, `comment`, `activity`, `notification`, `issue_counter`, `credential`, `invite`, `reset_token`, `session`. (`milestone` and `attachment` are removed with their features.) Nothing replicates to the client; what a screen can see is decided by the query that serves it.

Conventions: UUIDv7 primary keys, server-generated · `text` + `CHECK` for enumerations, not `pgEnum`, because widening a `CHECK` is an ordinary transactional migration · `date` for calendar dates (`due_date`, `start_date`, `target_date`) and `timestamptz` for instants · `sort_order text COLLATE "C"` · lowercase six-digit hex for colours · `snake_case`, singular table names · `updated_at` written explicitly by every mutator through one `touched()` helper, never a trigger.

### Key fields

**`user`** — `first_name`, `last_name`, `email` (`UNIQUE (lower(email))`), `avatar_url`, `role` (`admin|member`), `job_title`, `slack_handle`, `phone`, `bio`, `deactivated_at`. The password hash lives in a separate `credential` table and is never selected into a response; `role` is read from this row on every request rather than cached in a token.
**`project`** — `key` (`^[A-Z][A-Z0-9]{0,7}$` — up to 8 characters, unique, **immutable**, derived from the name at creation per §3.7), `name`, `description`, `status` (`active|archived`, default `active` — there is no planned, paused or completed state), `start_date`, `target_date`, `color`, `sort_order`.
**`project_member`** — `(project_id, user_id)` composite PK. No role column.
**`board_column`** — `project_id`, `name`, `color`, `sort_order`, and `kind` (`open|done|canceled`, set at creation and never changed by `updateColumn`) which carries the semantics status used to: `done` and `canceled` are what Home's progress figure and "cancel rather than delete" read. Seeded with five rows on project creation (Backlog `open` · Todo `open` · In Progress `open` · Done `done` · Canceled `canceled`); a column added later is always `open`. `UNIQUE (project_id, lower(name))`. A project always has at least one row and at least one `canceled`-kind row (invariant 12); `kind` need not otherwise be unique within a project.
**`issue`** — `project_id` (required), `number`, `title`, `description`, `column_id` (required, and always a column of the issue's own project — this replaces the old `status` enum), `priority` (`none|low|medium|high|urgent`), `assignee_id`, `due_date`, `created_by`, `sort_order`.
**`label`** — one global set, `UNIQUE (lower(name))`, colour. No `project_id`: labels are never project-scoped.
**`comment`** — `author_id`, plain-text `body` which may carry mention tokens, and exactly one of `issue_id` / `project_id` (`CHECK` on the pair) so the same table serves both feeds. Editable and deletable by its author. Plain text only — there is no upload control, no file storage, no attachments root to configure and no orphan files to reclaim anywhere in v1. A team that needs to share a file links to it.

**`activity`** — the append-only log behind both feeds. Exactly one of `issue_id` / `project_id`; `actor_id`; `type` (`created | field_changed | label_added | label_removed | member_added | member_removed | archived | reopened | comment`); `field` and `from_value` / `to_value` as nullable text — for `field_changed` a single scalar (column, priority, assignee, due date, name, description, dates, colour); for `label_added` / `label_removed`, `to_value` / `from_value` respectively hold that one label's name, so a multi-label change is one row per label rather than one row holding a set. Both are frozen display strings captured at write time, not re-resolved on read, so a later rename of the column, user or label does not rewrite history. `comment_id` for `comment` rows; `created_at`. No `updated_at` — rows are never modified. Written by the mutators, in the same database transaction as the change they describe, so a change and its record land together or not at all.
**`notification`** — `user_id`, `actor_id`, `type` (`mention|assignment|comment`), exactly one of `issue_id` / `project_id` (a project comment's mention or comment notification has no issue to attach to), `comment_id` optional, `read_at`, `emailed_at`. `CHECK (user_id <> actor_id)`.

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
| 11 | Activity rows are never updated or individually deleted | no `update`/`delete` mutator exists |
| 12 | A project always has at least one `canceled`-kind column | `deleteColumn` |
| 13 | At least one admin is always active | `deactivateUser` / `setUserRole`, under a row lock on the admin count, in the same transaction as the change |

### Read boundary

Every response is shaped by the query behind it, not by a replication rule. Two conventions hold that line: `user` is selected through one `publicUser` projection (`id, first_name, last_name, email, avatar_url, role, job_title, slack_handle, phone, bio, deactivated_at`) that every endpoint reuses, so a column added later cannot leak by default; and the auth tables (`credential`, `session`, `reset_token`, `invite` secrets) and `issue_counter` are never reachable from a read endpoint at all. One row-level rule exists in the whole system: notifications are readable only by their own `user_id`. Everything else is readable by any signed-in user, which is what keeps the queries simple at this team size.

---

## 6. Authentication

Hand-written, no auth library. One credential: **email + password**.

**No public sign-up.** `POST /api/auth/signin` is the endpoint a stranger can reach. An account comes into being one way: an **admin invites an address**, which mails a 7-day single-use link; accepting it sets a first name, last name and password and creates the `user` row. Members cannot invite. There is no self-service route in and no open registration form to attack.

**An invitation is a login, not access.** It creates a user who can sign in and read; it never carries project membership. Adding someone to a project is a separate, direct act by an admin with no acceptance step — so the two concerns stay apart, and a pending invitation can never leave a half-joined project behind.

**First-run bootstrap.** On first deployment only, the app seeds a **single default admin** from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the environment, and records that it has done so. If any user row already exists, seeding is skipped — the path cannot run twice and cannot be used to mint a second admin later. That first admin must change the seeded password before anything else; until they do, every screen carries a banner saying so. Every other account in the system descends from an invitation by that admin or one they promoted.

**Storage.** Passwords are Argon2id hashes in a `credential` table — never in a response, never in a cookie, never logged. Session, invite and reset tokens are 32 random bytes stored as SHA-256 digests, so nothing in the codebase compares two secrets and a leaked database yields no working credential.

**Sessions are server-side, in a cookie.** A successful sign-in writes a `session` row (user, created, last-seen, expiry, user-agent, IP) and sets one opaque session id as an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie — 30 days sliding, refreshed on use. The cookie carries **no claims and no signature to verify**: it is a lookup key, and every request reads the session row to learn who the actor is and whether they are still allowed in. Nothing about identity is cached in a token, so a revoked session dies on its next request rather than at the end of some expiry window. Signing out, a password reset, or deactivation deletes the rows and takes effect immediately, everywhere, including other devices.

**Every request is authenticated the same way.** `loadActor()` resolves the cookie to a session row and reads `role` and `deactivated_at` from Postgres in the same query, and that is the actor every read query and every mutator receives. Nothing about identity or membership is cached anywhere — membership is read per mutation — so there is no stale-claim window and no second, weaker check to get wrong.

**CSRF.** `SameSite=Lax` plus an origin check on every mutating request. No cross-site form posts, no token-in-header dance.

**Throttle** — five failed sign-ins for one address locks that address for fifteen minutes; independently, twenty failed sign-ins from one IP address, across any addresses it targets, locks that IP for fifteen minutes — so a party who doesn't hold the address can't sustain a lockout against it by cycling attempts from one source. Both counted in the database so they survive a restart. Reset requests are throttled the same way and always answer identically whether or not the address exists.

**Break-glass and user administration** — `npm run admin:grant -- --email=… --name=…` over SSH creates or promotes an admin, sets a password, and clears `deactivated_at`; `admin:deactivate` closes an account. With no team-settings screen, **role changes remain CLI-only in v1** (see open items); deactivation and invitations, which are needed routinely, have their own UI instead (Accounts, §3.9). This is also the total-lockout recovery, separate from first-run seeding.

**Deactivation** revokes sign-in and writes immediately and deletes every session row, so reads stop on the next request too. Membership rows are retained so reactivation restores prior access.

---

## 7. Stack

Next.js 16.x App Router (server components and server actions for reads and writes) · React Aria Components · Tailwind · React Aria Drag and Drop for board · Drizzle ORM + PostgreSQL 18 · `@node-rs/argon2` + `nodemailer` for hand-written auth — no JWT library, sessions are database rows behind a cookie · `uuidv7`, `fractional-indexing`. No sync engine, no client database, no service worker. Self-hosted on a single box; SMTP is whatever the operator already runs.

### Frontend rules

**Component behaviour and accessibility: React Aria Components.** Interaction behaviour, focus management, keyboard support and ARIA semantics come from React Aria Components; Tailwind supplies the visual layer only.

**Coding rule — React Aria first.** Reach for a React Aria component before writing anything: buttons, fields, selects, checkboxes, dialogs, popovers, menus, tabs, tooltips, list boxes, toasts. Only when no suitable React Aria component exists (or the pinned version does not ship one) is a custom-built component acceptable, and it must reproduce the same keyboard, focus and ARIA behaviour. Exceptions in v1: @mention autocomplete inside comments and descriptions (custom, built from `Popover` + `ListBox`).
