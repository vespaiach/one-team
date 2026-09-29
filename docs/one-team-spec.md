---
product: "One Team"
version: "0.2.0"
release: "R1"
status: Ready to build
updated: "2026-09-23"
---

# One Team: Spec

## Overview

### 1. Summary

One Team is an issue tracker for a small team that outgrew Trello but finds Linear too costly and too complex for its non-technical members. Trello has no project layer, so milestones, goals and shared resources have nowhere to live next to the work. One Team tracks issues inside projects, with each project's description, milestones and resources alongside, and stays simple enough for everyone on the team.

### 2. Features

| ID | Feature | Release | Priority |
|---|---|---|---|
| F-001 | Projects | R1 | Must |
| F-002 | Project description | R1 | Must |
| F-003 | Milestones | R1 | Must |
| F-004 | Project resources | R1 | Must |
| F-005 | Issues | R1 | Must |
| F-006 | Issue fields | R1 | Must |
| F-007 | Deleted issues | R1 | Should |
| F-008 | Kanban board | R1 | Must |
| F-009 | List view | R1 | Should |
| F-010 | Filtering and sorting | R1 | Should |
| F-011 | Comments | R1 | Must |
| F-012 | Activity feeds | R1 | Should |
| F-013 | File attachments | R1 | Should |
| F-014 | Notifications | R1 | Should |
| F-015 | Accounts and sign-in | R1 | Must |
| F-016 | User management | R1 | Should |

### 3. Scope limits

- **Out of scope:**
  - Storing credentials or secrets for third-party accounts
  - Integrations with Slack, GitHub or Google Drive (DEC-004)
  - Native mobile apps and mobile-browser layouts
  - Importing data from Trello
  - Workspaces, teams and multi-tenancy
  - Custom or per-project statuses
  - Attachments on comments
  - Notifications for due dates
  - Notification preferences; email is always on (DEC-007)
  - Encryption at rest (DEC-017)
  - A formal accessibility standard; keyboard use is required instead (NFR-003)
  - Languages other than English
  - Load testing, an availability target, metrics, tracing, dashboards, a status page and a staging environment (DEC-016)
- **Assumptions:** The team is small (single-digit to low double-digit users), so one VPS is enough. Confirm against the owner's headcount before launch.
- **Known limitations in R1:**
  - One VPS holds the app, database and files; any VPS failure takes the whole app down.
  - No backups (DEC-003): losing the VPS disk loses all data permanently.
  - No real-time updates: users see others' changes only after a reload.
  - Desktop browsers only.
  - Sign-in depends on email delivery: while the email service is down, only users already signed in can work.
  - Nothing stops users pasting credentials into resource notes, which are stored as plain text (DEC-010).

### 4. Open questions

| ID | Question | Type | Affects |
|---|---|---|---|
| DEC-025 | Email vendor and request timeout. | Agent's choice (limits in section 12) | API-001 |
| DEC-026 | Test runner and end-to-end browser tool. | Agent's choice (limits in section 12) | Section 12 |

### 5. Glossary

- **Admin:** a user who manages users and projects. There can be several, all with equal rights. Not "owner" or "manager".
- **Member:** any user who isn't an Admin. Sees only the projects they belong to.
- **Project member:** a user an Admin has added to a specific project.
- **Archived project:** a read-only project that an Admin can restore. Not "closed".
- **Deleted issue:** an issue hidden from all views but kept in the database; an Admin can restore it.
- **Deactivated user:** a user who can no longer sign in; their content stays. Not "deleted user".
- **Resource:** a link, note or file stored on a project.
- **Activity feed:** the time-ordered history of changes and comments on an issue or a project.

## Features

### F-001 Projects

**Release:** R1 · **Priority:** Must

**What and why:** Admins create projects, add people to them, and archive finished ones so active work stays uncluttered. Projects are never permanently deleted.

**Flow**

1. An Admin creates a project with a name and an optional description.
2. The Admin adds users to it; each one now sees it in their project list.
3. When the work is done, the Admin archives the project.
4. The system marks it archived, hides its edit controls and rejects every write to it (SEC-009).
5. An Admin can restore it to editable at any time.

**Rules and examples**

- **REQ-004** The system shall let the Admin create a project with a required name and optional description.
  - REQ-004.1: Lan (Admin) creates "Website refresh" with no description → it appears in the project list. (Verify: auto)
  - REQ-004.2: Lan submits the form with an empty name → rejected with a field error; no project is created. (Verify: auto)
- **REQ-005** The system shall let the Admin add a user to a project.
  - REQ-005.1: Lan adds Bao (Member) to "Website refresh" → it appears in Bao's project list. (Verify: auto)
- **REQ-006** The system shall let the Admin remove a user from a project.
  - REQ-006.1: Lan removes Bao from "Website refresh" → opening it gives Bao "not found". (Verify: auto)
- **REQ-007** The system shall let the Admin archive a project, making it read-only.
  - REQ-007.1: Lan archives "Website refresh" → Bao sees it with an "Archived" banner and no edit controls. (Verify: auto)
- **REQ-008** The system shall let the Admin restore an archived project to editable.
  - REQ-008.1: Lan restores the archived "Website refresh" → its edit controls return, and Bao can create issues in it again. (Verify: auto)
- **REQ-010** The system shall provide no way to permanently delete a project.
  - REQ-010.1: Any user, including an Admin, looks for a way to delete "Website refresh" in the UI or among server endpoints → none exists. (Verify: auto)
- **REQ-049** The system shall show the Admin all projects, including archived ones.
  - REQ-049.1: 3 active projects and 1 archived project exist, and Lan is a member of none → Lan's project list shows all 4, with the archived one marked. (Verify: auto)
- **REQ-055** The system shall let an Admin rename a project.
  - REQ-055.1: Lan renames "Website refresh" to "Website 2026" → the new name shows in the project list and on the project. (Verify: auto)
  - REQ-055.2: Bao tries to rename it → "not allowed" (STD-2); the name doesn't change. (Verify: auto)

**Exceptions to standard behaviors:** STD-7: on an empty project list, a Member sees "You haven't been added to a project yet" and an Admin sees a create-project action.

**Uses:** Project, ProjectMembership · SEC-002, SEC-003, SEC-009

### F-002 Project description

**Release:** R1 · **Priority:** Must

**What and why:** Each project has a description in basic markdown that also holds its goals, so the team sees why the work exists right next to it.

**Flow**

1. A user with project access opens the project overview.
2. They edit the description in basic markdown and save it.
3. The overview shows the description formatted.

**Rules and examples**

- **REQ-009** The system shall let users with project access edit the project description in basic markdown.
  - REQ-009.1: Bao saves "## Goals" followed by "- Launch by 2026-12-01" → the overview shows a "Goals" heading and one bullet. (Verify: auto)
  - REQ-009.2: The project is archived → no edit control shows, and a direct save request is rejected (SEC-009). (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Project · SEC-008, SEC-009

### F-003 Milestones

**Release:** R1 · **Priority:** Must

**What and why:** Milestones group a project's issues toward a named target with an optional date, and show how much of it is done.

**Flow**

1. A user with project access creates a milestone with a name, an optional description and an optional target date.
2. Users link issues to it through each issue's milestone field (REQ-015).
3. The project overview shows each milestone with its progress.
4. Deleting a milestone leaves its issues in place with no milestone.

**Rules and examples**

- **REQ-034** The system shall let users with project access create a milestone with a required name, optional description, and optional target date.
  - REQ-034.1: Bao creates "Beta" with target date 2026-11-15 → it appears on the project overview. (Verify: auto)
  - REQ-034.2: Bao submits the form with an empty name → rejected with a field error. (Verify: auto)
- **REQ-035** The system shall let users with project access edit a milestone.
  - REQ-035.1: Bao moves the target date of "Beta" from 2026-11-15 to 2026-12-01 → the new date shows. (Verify: auto)
- **REQ-036** The system shall let users with project access delete a milestone.
  - REQ-036.1: "Beta" has 3 linked issues and Bao deletes it → "Beta" no longer appears, the 3 issues remain with no milestone, and each issue's feed records the change. (Verify: auto)
- **REQ-037** The system shall show milestone progress as Done issues over linked issues, excluding Canceled and deleted issues, or "No issues" when none are linked.
  - REQ-037.1: "Beta" has 2 Done, 1 Todo and 1 Canceled issue → progress shows 2 of 3. (Verify: auto)
  - REQ-037.2: "Beta" has no linked issues → it shows "No issues". (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Milestone, Issue

### F-004 Project resources

**Release:** R1 · **Priority:** Must

**What and why:** Links, notes and files kept on a project, so the team finds its material in one place.

**Flow**

1. A user with project access adds a resource with a title and a type: link (a URL), note (basic markdown) or file (an upload, F-013).
2. The project overview lists resources, newest first.
3. Users edit or delete resources; deleting a file resource also deletes its file (DATA-006).

**Rules and examples**

- **REQ-038** The system shall let users with project access add a resource of type link, note, or file.
  - REQ-038.1: Bao adds the link "Brand guide" (https://example.com/brand), then the note "Hosting notes", then the file "logo.png" (200 KB) → all three show, newest first: "logo.png", "Hosting notes", "Brand guide". (Verify: auto)
  - REQ-038.2: Bao picks the type link and leaves the URL empty → rejected with a field error. (Verify: auto)
- **REQ-039** The system shall let users with project access edit a resource.
  - REQ-039.1: Bao changes the URL of "Brand guide" to https://example.com/brand-v2 → the new URL is saved. (Verify: auto)
- **REQ-040** The system shall let users with project access delete a resource.
  - REQ-040.1: Bao deletes "Brand guide" → it no longer appears. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Resource, Attachment · DATA-004, DATA-006, SEC-006, SEC-007, SEC-008

### F-005 Issues

**Release:** R1 · **Priority:** Must

**What and why:** Issues are the units of work in a project. Any user with project access can create and edit any issue in it.

**Flow**

1. A user with project access enters a title and, optionally, a description and the fields in F-006.
2. The system validates the input and saves the issue in Backlog.
3. The issue shows on the board and in the list view.
4. When someone edits it, the system checks nobody else saved it since they loaded it (REQ-026).
5. The system saves the change, records each changed field in the issue feed (F-012) and creates any notifications (F-014).

**Rules and examples**

- **REQ-011** The system shall let users with project access create an issue with a required title and optional markdown description.
  - REQ-011.1: Bao creates "Fix welcome email typo" → it appears in the Backlog column and in the list view. (Verify: auto)
  - REQ-011.2: Bao submits the form with an empty title → rejected with a field error, and the typed description is kept. (Verify: auto)
- **REQ-017** The system shall let users with project access edit any field of any issue in the project.
  - REQ-017.1: Chi edits the title of an issue Bao created → the change is saved. (Verify: auto)
- **REQ-026** The system shall warn a user who saves an issue changed by someone else since they loaded it, let them reload, and keep their unsaved input.
  - REQ-026.1: Bao and Chi open the same issue, Chi saves a new title, then Bao saves a new description → Bao sees a warning with a Reload action, Bao's typed description stays available to copy, and Chi's title is not overwritten. (Verify: auto)
- **REQ-056** The system shall set a new issue's status to Backlog.
  - REQ-056.1: Bao creates an issue → its status is Backlog. (Verify: auto)
- **REQ-058** When a user leaves an issue with unsaved edits, the system shall ask whether to discard them or stay.
  - REQ-058.1: Bao edits an issue's description and clicks the board link → a prompt offers Discard and Stay; Stay keeps the edits on screen. (Verify: auto)
*REQ-059 was superseded by STD-5 (DEC-023).*

**Exceptions to standard behaviors:** None

**Uses:** Issue · F-006, F-012, F-014, SEC-009

### F-006 Issue fields

**Release:** R1 · **Priority:** Must

**What and why:** Each issue carries a status, priority, assignee, milestone and due date, so the team can see its state, urgency and owner.

**Flow**

1. A user sets fields on the new-issue form or on an existing issue.
2. The system checks each value against the rules below.
3. The system saves valid values and rejects invalid ones with a field error (STD-3).

**Rules and examples**

- **REQ-012** The system shall give each issue one status from: Backlog, Todo, In progress, In review, Done, Canceled.
  - REQ-012.1: Bao sets an issue's status to In review → it is saved. (Verify: auto)
  - REQ-012.2: A request sets the status to "Blocked" → rejected. (Verify: auto)
- **REQ-013** The system shall give each issue one priority from: None, Low, Medium, High, Urgent, defaulting to None.
  - REQ-013.1: Bao creates an issue without choosing a priority → its priority is None. (Verify: auto)
  - REQ-013.2: Bao sets the priority to Urgent → it is saved. (Verify: auto)
- **REQ-014** The system shall allow an optional single assignee chosen from active users with access to the project.
  - REQ-014.1: Bao assigns Chi, a member of the project → it is saved. (Verify: auto)
  - REQ-014.2: A request assigns Dung, who isn't a member of the project → rejected with a field error. (Verify: auto)
  - REQ-014.3: Em, a project member, is deactivated → the assignee picker no longer offers Em. (Verify: auto)
- **REQ-015** The system shall allow an optional milestone chosen from the issue's project.
  - REQ-015.1: Bao sets milestone "Beta" from the same project → it is saved. (Verify: auto)
  - REQ-015.2: A request sets milestone "Q1 launch" from the project "Mobile app" → rejected with a field error. (Verify: auto)
- **REQ-016** The system shall allow an optional due date on an issue.
  - REQ-016.1: Bao sets the due date to 2026-10-15, then clears it → each change is saved, and the issue ends with no due date. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Issue, Milestone, User · DATA-008

### F-007 Deleted issues

**Release:** R1 · **Priority:** Should

**What and why:** Deleting an issue hides it everywhere but keeps its data, so an Admin can restore work deleted by mistake.

**Flow**

1. A user with project access deletes an issue.
2. The issue disappears from the board, the list, filter results and milestone progress; its feed records the deletion.
3. An Admin opens Deleted issues for the project and restores it.
4. The issue returns to its previous status column with all its fields, comments and attachments; its feed records the restore.

**Rules and examples**

- **REQ-018** The system shall let users with project access delete an issue by hiding it, without removing its data.
  - REQ-018.1: Bao deletes "Fix welcome email typo" (In progress, milestone "Beta") → it disappears from the board, the list and filter results, "Beta" no longer counts it, and its database row remains. (Verify: auto)
  - REQ-018.2: Bao deletes an issue that Chi already deleted → nothing changes. (Verify: auto)
- **REQ-019** The system shall let the Admin list deleted issues.
  - REQ-019.1: "Website refresh" has 2 deleted issues → Lan's Deleted issues page for that project lists both. (Verify: auto)
  - REQ-019.2: Bao opens the Deleted issues page → "not allowed" (STD-2). (Verify: auto)
- **REQ-020** The system shall let the Admin restore a deleted issue.
  - REQ-020.1: Lan restores "Fix welcome email typo" → it returns to the In progress column with its 2 comments and 1 attachment. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Issue · DATA-001

### F-008 Kanban board

**Release:** R1 · **Priority:** Must

**What and why:** The board shows a project's issues in one column per status, and moving a card changes the issue's status.

**Flow**

1. A user opens a project's board; all six status columns show, in order.
2. The user drags a card to another column, or moves it with the keyboard (NFR-003).
3. The system saves the new status at once, records it in the issue feed and notifies the assignee and creator (F-014).
4. If the save fails or the issue changed since the board loaded, the card goes back to its column.

**Rules and examples**

- **REQ-021** The system shall show a project's issues on a kanban board with one column per status, always showing all six columns in the order Backlog, Todo, In progress, In review, Done, Canceled.
  - REQ-021.1: A project has issues only in Todo and Done → six columns show in order, and the other four are empty. (Verify: auto)
- **REQ-022** The system shall change an issue's status when its card is moved to another column.
  - REQ-022.1: Bao drops a card from Todo into In progress → after a reload, its status is In progress. (Verify: auto)
- **REQ-060** If saving a card move fails, the system shall return the card to its original column and show an error message.
  - REQ-060.1: The database is unavailable when Bao drops a card from Todo into Done → the card returns to Todo, an error shows, and the status stays Todo. (Verify: auto)
- **REQ-061** If an issue changed since the board loaded, the system shall reject a move of its card, return the card to its column, and ask the user to reload.
  - REQ-061.1: Chi edits an issue after Bao loaded the board, then Bao drags its card to Done → the move is rejected, the card returns to its column and Bao is asked to reload. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Issue · F-014, NFR-003

### F-009 List view

**Release:** R1 · **Priority:** Should

**What and why:** The list view shows a project's issues as rows, for scanning and sorting.

**Flow**

1. A user opens a project's list view.
2. The system shows one row per issue, with its status as a column.
3. The user filters and sorts it the same way as the board (F-010).

**Rules and examples**

- **REQ-023** The system shall show a project's issues in a list view, one row per issue with its status as a column.
  - REQ-023.1: A project has 12 issues, 1 of them deleted → the list shows 11 rows, each with its status. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Issue

### F-010 Filtering and sorting

**Release:** R1 · **Priority:** Should

**What and why:** Users narrow and order the issues shown on the board and in the list view.

**Flow**

1. A user picks filters: assignee, priority, milestone, alone or combined.
2. The user picks a sort: priority, due date or created date.
3. The board and the list show only matching issues, in that order.

**Rules and examples**

- **REQ-024** The system shall let users filter issues in the board and list views by assignee, priority and milestone, alone or combined.
  - REQ-024.1: Bao filters by assignee Chi and priority High → only Chi's High issues show on the board and in the list. (Verify: auto)
- **REQ-025** The system shall let users sort issues in the board and list views by priority (Urgent first, None last), due date (soonest first, issues without one last) or created date (newest first).
  - REQ-025.1: Bao sorts by due date, and 3 issues are due 2026-10-20, never and 2026-10-01 → they show as 2026-10-01, 2026-10-20, then the one with no due date, on the board and in the list. (Verify: auto)
  - REQ-025.2: Bao sorts by priority, and a column holds Low, Urgent, None and High issues → they show as Urgent, High, Low, None. (Verify: auto)
- **REQ-062** Where the user hasn't picked a sort, the system shall sort by created date, newest first.
  - REQ-062.1: Bao opens the list without picking a sort, and issues were created on 2026-10-01, 2026-10-03 and 2026-10-02 → they show as 2026-10-03, 2026-10-02, 2026-10-01. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Issue

### F-011 Comments

**Release:** R1 · **Priority:** Must

**What and why:** Users discuss issues and projects in comments and @mention teammates to get their attention.

**Flow**

1. A user writes a comment in basic markdown on an issue or on a project, optionally @mentioning teammates.
2. The system saves it and shows it in the issue or project feed.
3. The system notifies mentioned users and, for an issue, its assignee and creator (F-014).
4. The author can later edit or delete their own comment.

**Rules and examples**

- **REQ-028** The system shall let users with project access comment on an issue in basic markdown.
  - REQ-028.1: Bao posts "**Blocked** on the API key" on an issue → it shows in the issue feed with "Blocked" in bold. (Verify: auto)
  - REQ-028.2: Bao posts an empty comment → rejected; nothing is posted. (Verify: auto)
- **REQ-029** The system shall let users with project access comment on a project in basic markdown.
  - REQ-029.1: Bao posts a comment on "Website refresh" → it shows in the project feed. (Verify: auto)
- **REQ-030** The system shall let a commenter @mention active users with access to the project; any other @name stays plain text.
  - REQ-030.1: Bao types "@" → the picker offers only active project members, not Em (deactivated) or Dung (not a project member). (Verify: auto)
  - REQ-030.2: Bao types "@Dung" by hand and posts → "@Dung" shows as plain text, and Dung gets no notification. (Verify: auto)
- **REQ-031** The system shall let a comment's author edit that comment.
  - REQ-031.1: Bao edits their own comment → the new text shows, marked as edited. (Verify: auto)
- **REQ-032** The system shall let a comment's author delete that comment.
  - REQ-032.1: Bao deletes their own comment → its text no longer shows in the feed (DATA-005). (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Comment · SEC-004, SEC-008, DATA-005

### F-012 Activity feeds

**Release:** R1 · **Priority:** Should

**What and why:** Each issue and project keeps a time-ordered history of changes and comments, so anyone can see what happened and who did it.

**Flow**

1. A user changes an issue or a project, or comments on one.
2. In the same save, the system records an activity event with the actor, the time and the change (DATA-003).
3. The issue page shows its feed interleaved with comments.
4. The project overview shows the project feed with a comment box.

**Rules and examples**

- **REQ-027** The system shall show an activity feed on each issue listing field changes and comments with actor and time.
  - REQ-027.1: Chi moves an issue from Todo to In progress, then Bao reassigns it to Minh → the feed shows both changes, each with its actor and time. (Verify: auto)
- **REQ-033** The system shall show a project activity feed of project changes, issue event summaries, and project comments in time order.
  - REQ-033.1: Lan renames the project at 10:00, Bao creates an issue at 10:05 and Chi comments on the project at 10:10 → the project feed shows all three in that order. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** ActivityEvent, Comment · DATA-003, DATA-009

### F-013 File attachments

**Release:** R1 · **Priority:** Should

**What and why:** Users attach files of up to 10 MB to issues, so related material sits with the work.

**Flow**

1. A user with project access attaches a file to an issue, or adds a file resource (F-004).
2. The system checks the size and the file type (SEC-006).
3. The system stores the file on disk under a generated name and its details in the database (DATA-004).
4. Users download it through a route that checks project access (SEC-007).
5. Any user with project access can remove it, which deletes the file (DATA-007).

**Rules and examples**

- **REQ-041** The system shall let users with project access attach files to an issue.
  - REQ-041.1: Bao attaches "brief.pdf" (2 MB) to an issue → it is listed on the issue and can be downloaded. (Verify: auto)
- **REQ-042** The system shall reject any uploaded file larger than 10 MB with a visible message.
  - REQ-042.1: Bao uploads a 10.5 MB file → rejected with a message stating the 10 MB limit. (Verify: auto)
- **REQ-057** The system shall let users with project access remove an attachment from an issue.
  - REQ-057.1: Chi removes a file that Bao attached → it is no longer listed. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Attachment · DATA-004, DATA-007, DATA-010, SEC-006, SEC-007

### F-014 Notifications

**Release:** R1 · **Priority:** Should

**What and why:** Users hear about assignments, comments, @mentions and status changes, in the app and by email.

**Flow**

1. A user assigns an issue, comments, @mentions someone or changes a status.
2. In the same save, the system creates one in-app notification per recipient, never for the user who acted.
3. After the save, the system emails each notification (OPS-001 retries failures).
4. The recipient opens Notifications and follows a link to the issue or project.

**Rules and examples**

In these examples, Chi is the issue's assignee and Bao created it.

- **REQ-043** The system shall notify a user when they are assigned to an issue.
  - REQ-043.1: Bao assigns an issue to Chi → Chi gets a notification. (Verify: auto)
- **REQ-044** The system shall notify an issue's assignee and creator when a comment is added to it.
  - REQ-044.1: Minh comments on the issue → Chi and Bao each get a notification. (Verify: auto)
- **REQ-045** The system shall notify a user when they are @mentioned in an issue or project comment.
  - REQ-045.1: Bao's comment on the project "Website refresh" mentions @Minh → Minh gets a notification. (Verify: auto)
- **REQ-046** The system shall notify an issue's assignee and creator when its status changes.
  - REQ-046.1: Minh moves the issue to Done → Chi and Bao each get a notification. (Verify: auto)
- **REQ-047** The system shall show each user a list of their in-app notifications.
  - REQ-047.1: Chi has 3 notifications → Notifications lists them newest first, each linking to its issue or project. (Verify: auto)
- **REQ-048** The system shall send each notification by email.
  - REQ-048.1: A notification for Chi is created → an email goes to Chi's address. (Verify: auto)
- **REQ-052** The system shall not notify a user about an action they performed themselves.
  - REQ-052.1: Chi is both assignee and creator of an issue and changes its status → Chi gets no notification. (Verify: auto)
- **REQ-063** The system shall create at most one notification per recipient for each event.
  - REQ-063.1: Minh comments "@Chi please check" on the issue → Chi gets one notification, not two. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** Notification · API-001, OPS-001

### F-015 Accounts and sign-in

**Release:** R1 · **Priority:** Must

**What and why:** Admins invite people by email, and users sign in with a one-time link sent to their email, so no passwords are stored.

**Flow**

1. An Admin enters an email address to invite.
2. The system creates a pending user and emails an invitation link that lasts 7 days (SEC-011).
3. The invitee opens the link, is signed in, becomes active and lands on the project list with no projects.
4. Later, the user enters their email on the sign-in page and gets a one-time link that lasts 15 minutes (SEC-010).

**Rules and examples**

- **REQ-001** The system shall let the Admin invite a person by email address.
  - REQ-001.1: Lan invites chi@example.com → a pending user and an invitation exist, and an invitation email is sent to chi@example.com. (Verify: auto)
  - REQ-001.2: Lan enters "chi@" → rejected with a field error. (Verify: auto)
- **REQ-002** The system shall let an invited person activate their account from the invitation.
  - REQ-002.1: Chi opens the invitation link 2 days after it was sent → Chi is signed in, active, and sees the project list with no projects. (Verify: auto)
- **REQ-054** The system shall tell a user when their sign-in email could not be sent, so they can try again.
  - REQ-054.1: The email service returns an error when Bao requests a sign-in link → "Couldn't send the email, try again" shows, and Bao can request again. (Verify: auto)
- **REQ-064** If the Admin invites an email address that has a pending invitation, the system shall keep one invitation for it with a new link and a new expiry.
  - REQ-064.1: chi@example.com was invited on 2026-10-01, and Lan invites it again on 2026-10-03 → one invitation exists, with a new link that expires on 2026-10-10. (Verify: auto)
- **REQ-065** If the Admin invites the email address of an active user, the system shall reject it with "already a member".
  - REQ-065.1: Lan invites bao@example.com, which belongs to an active user → rejected with "already a member"; no email is sent. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** User, Invitation · API-001, SEC-001, SEC-010, SEC-011, SEC-012, SEC-016, SEC-017, SEC-019

### F-016 User management

**Release:** R1 · **Priority:** Should

**What and why:** Admins control who can use One Team: several Admins with equal rights, promotion and demotion, and deactivation that keeps a person's work.

**Flow**

1. An Admin opens the Users page, which lists active, pending and deactivated users with their roles.
2. The Admin promotes a Member to Admin or demotes another Admin, never leaving zero active Admins (SEC-013).
3. The Admin deactivates a user; the system ends their sessions and hides them from assignee and @mention pickers.
4. An Admin can later reactivate them with their previous role and project memberships.

**Rules and examples**

- **REQ-003** The system shall let the Admin deactivate a user, after which that user cannot sign in.
  - REQ-003.1: Lan deactivates Chi → Chi's next sign-in attempt fails. (Verify: auto)
  - REQ-003.2: Lan deactivates Chi a second time → nothing changes. (Verify: auto)
- **REQ-050** The system shall let an Admin promote a Member to Admin.
  - REQ-050.1: Lan promotes Bao → Bao can invite users. (Verify: auto)
- **REQ-051** The system shall let an Admin demote another Admin to Member.
  - REQ-051.1: Lan and Hoa are Admins, and Lan demotes Hoa → Hoa gets "not allowed" on Admin-only actions. (Verify: auto)
- **REQ-053** The system shall let an Admin reactivate a deactivated user, restoring their previous role and project memberships.
  - REQ-053.1: Chi was a Member of "Website refresh" when deactivated, and Lan reactivates Chi → Chi can sign in and sees "Website refresh" again. (Verify: auto)

**Exceptions to standard behaviors:** None

**Uses:** User, ProjectMembership · SEC-005, SEC-013, SEC-020, DATA-002

## System

### 6. Standard behaviors

One Team has no public API (section 9), so these rows state only what the user sees.

| ID | Situation | What happens |
|---|---|---|
| STD-1 | Not signed in | Redirected to sign-in; nothing changes (SEC-001). |
| STD-2 | Not allowed | A project the user isn't a member of, and anything in it, shows "not found". An Admin-only action shows "not allowed". Any write to an archived project shows "not allowed, project is archived". Nothing changes. |
| STD-3 | Invalid input | The form stays open with the input kept and the invalid field marked. |
| STD-4 | Item not found | Opening something that doesn't exist or was deleted, such as a notification link to a deleted issue, shows the same "not found" page as STD-2, with a link back to the project list. Nothing changes. Admins restore deleted issues from the Deleted issues page (REQ-019). |
| STD-5 | Same action sent twice | Every form disables its submit control while a save is pending. Repeating an action whose result already holds changes nothing, for example deleting an issue that is already deleted. |
| STD-6 | A service we depend on fails | A database failure shows a generic error; the input is kept and nothing is saved. An email failure never blocks the action, except sign-in (REQ-054); other emails retry per OPS-001. |
| STD-7 | Every screen | A simple loading indicator shows while a page or a save is in progress. An empty list shows a one-line message and, where the user can add something, the add action (for example "No issues yet" with a New issue button); a feature block may state its own. Errors show next to the failed control or at the top of the page, and input is kept. Every screen works in the desktop browsers in NFR-001 and by keyboard (NFR-003). Changes by others show after a reload. |

### 7. Roles and permissions

Anyone not signed in can only sign in and accept an invitation (SEC-001). Denials follow STD-2.

| Action | Member | Admin |
|---|---|---|
| Invite, deactivate and reactivate users | No | Yes, never deactivating the last active Admin (SEC-013) |
| Promote a Member; demote an Admin | No | Yes, never demoting the last active Admin (SEC-013) |
| Create, rename, archive and restore projects; add and remove project members | No | Yes |
| See a project and everything in it | Own projects | All projects |
| Create, edit, move and delete issues; edit the project description; manage milestones, resources and issue attachments; comment and @mention | Own projects | All projects |
| View and restore deleted issues | No | Yes |
| Edit or delete a comment | Own comments | Own comments |
| Any write in an archived project | No | No (restore it first) |

### 8. Data

| Entity | What it holds | Notes |
|---|---|---|
| User | Email, name, role (Admin or Member), state (pending, active or deactivated) | Email is unique. Never deleted (DATA-002). States: pending → active ↔ deactivated. |
| Invitation | Email, invited by, created at, expires at | Created with a pending User. Lasts 7 days (SEC-011); one per email address (REQ-064). |
| Project | Name, description (markdown, optional), archived at | Never deleted (REQ-010). States: active ↔ archived. |
| ProjectMembership | User, project | Unique per user and project. |
| Issue | Title, description (markdown), status, priority, assignee, milestone, due date, creator, created at, updated at, version, deleted at | Milestone must be in the same project; assignee must have project access. The version number detects stale saves (REQ-026, REQ-061). States: live ↔ deleted. |
| Milestone | Name, description, target date | Progress is calculated, never stored (REQ-037). |
| Resource | Title, type (link, note or file), URL for a link, markdown body for a note, attachment for a file | Holds exactly one payload, matching its type. |
| Attachment | Filename, file type, size, storage path, uploaded by, created at | Belongs to an issue or a resource. At most 10 MB (REQ-042). Allowed types: PNG, JPEG, GIF, WebP, PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV (DEC-021). |
| Comment | Body (markdown), author, created at, edited at | Belongs to an issue or a project. |
| ActivityEvent | Actor, time, subject (issue or project), change | Append-only (DATA-003). |
| Notification | Recipient, type, link target, created at, read at | At most one per recipient per event (REQ-063). |

All data is kept indefinitely; R1 has no purge.

- **DATA-001** The system shall retain deleted issues, with their comments, attachments, and activity, indefinitely.
  - DATA-001.1: A deleted issue had 2 comments and 1 attachment → the issue, both comments, the attachment with its file, and its activity events all remain in storage. (Verify: auto)
- **DATA-002** The system shall retain a deactivated user's account and authored content.
  - DATA-002.1: Em is deactivated → Em still shows as author on Em's issues and comments, and issues assigned to Em still show Em's name. (Verify: auto)
- **DATA-003** The system shall record each activity event with actor, timestamp, and change, and never alter it afterwards.
  - DATA-003.1: Events exist for an issue → the app offers no way, in the UI or on the server, to update or delete them. (Verify: auto)
- **DATA-004** The system shall store uploaded files on the VPS disk and their metadata in PostgreSQL.
  - DATA-004.1: Bao uploads "logo.png" → its bytes are on the VPS disk under a generated name, and a database row holds its filename, type and size. (Verify: auto)
- **DATA-005** The system shall permanently remove a deleted comment's text and keep a "comment deleted" placeholder with author and time.
  - DATA-005.1: Bao deletes a comment posted at 14:02 → the database no longer holds its text, and the feed shows "comment deleted" with Bao and 14:02. (Verify: auto)
- **DATA-006** The system shall delete a resource's file from disk when the resource is deleted.
  - DATA-006.1: Bao deletes the file resource "logo.png" → the file no longer exists on disk. (Verify: auto)
- **DATA-007** The system shall delete an attachment's file from disk when it is removed from an issue.
  - DATA-007.1: Chi removes an attachment from an issue → its file no longer exists on disk. (Verify: auto)
- **DATA-008** The system shall store due dates and target dates as calendar dates without a time.
  - DATA-008.1: Bao sets a due date of 2026-10-15 → viewers in any timezone see 2026-10-15. (Verify: auto)
- **DATA-009** The system shall show timestamps in the viewer's browser timezone.
  - DATA-009.1: A comment is posted at 14:00 UTC → a viewer whose browser is set to UTC+7 sees 21:00. (Verify: auto)
- **DATA-010** If saving an upload's metadata fails after its file reaches the disk, the system shall delete that file.
  - DATA-010.1: The database write fails after "logo.png" is written to disk → the upload ends with an error, and no "logo.png" file remains on disk. (Verify: auto)

### 9. Interfaces and integrations

One Team has no public API. Its HTTP endpoints serve only its own frontend.

| ID | Call or system | Used for |
|---|---|---|
| API-001 | Email delivery service (vendor: DEC-025) | Sign-in links and invitations (F-015), and notification emails (F-014). If it fails: sign-in shows an error and the user tries again (REQ-054); other emails retry per OPS-001, the in-app notification still exists, and an Admin can resend an invitation (REQ-064). |

### 10. Security and privacy

- **SEC-001** The system shall require an authenticated session for every page and endpoint except sign-in and invitation acceptance.
  - SEC-001.1: With no session, someone opens the project list → they are redirected to sign-in. (Verify: auto)
  - SEC-001.2: With no session, Chi opens a valid invitation link → the invitation page opens. (Verify: auto)
- **SEC-002** The system shall respond "not found" when a Member requests any resource of a project they are not a member of.
  - SEC-002.1: Dung, not a member of "Website refresh", requests the project, one of its issues, one of its files and its feed → each returns "not found". (Verify: auto)
- **SEC-003** The system shall reject Admin-only actions from Members with a "not allowed" error.
  - SEC-003.1: Bao (Member) sends an invite request straight to the server → "not allowed"; nothing changes. (Verify: auto)
- **SEC-004** The system shall reject edits or deletes of a comment by anyone other than its author, including the Admin.
  - SEC-004.1: Lan (Admin) tries to edit Bao's comment, then to delete it → both are rejected. (Verify: auto)
- **SEC-005** The system shall end all active sessions of a user when they are deactivated.
  - SEC-005.1: Chi is signed in on two browsers, and Lan deactivates Chi → Chi's next request from either browser is refused. (Verify: auto)
- **SEC-006** The system shall accept uploads only of allowlisted types (section 8, Attachment), checked on the server by file content.
  - SEC-006.1: Bao uploads an executable renamed "invoice.pdf" → rejected. (Verify: auto)
  - SEC-006.2: Bao uploads "notes.md" → rejected, because Markdown files aren't on the list. (Verify: auto)
- **SEC-007** The system shall serve uploaded files only to users with access to the owning project.
  - SEC-007.1: Dung opens the download link of a file in "Website refresh" → the file isn't served, and Dung gets "not found". (Verify: auto)
- **SEC-008** The system shall render markdown with raw HTML and scripts removed.
  - SEC-008.1: A comment reads `<script>alert(1)</script>**hi**` → it renders a bold "hi", and no script runs. (Verify: auto)
  - SEC-008.2: A note contains `<img src=x onerror=alert(1)>` → the output contains no HTML tag from the note. (Verify: auto)
- **SEC-009** The system shall reject every write to an archived project on the server.
  - SEC-009.1: "Website refresh" is archived, and Bao sends a create-issue request straight to the server → rejected with "not allowed, project is archived". (Verify: auto)
- **SEC-010** The system shall accept each sign-in link once and only within 15 minutes of issue.
  - SEC-010.1: A link sent at 08:50 is opened at 09:00 → Bao is signed in. (Verify: auto)
  - SEC-010.2: The same link is opened again at 09:02 → "This link has expired" shows, with a button to request a new one. (Verify: auto)
  - SEC-010.3: A link sent at 08:40 is opened for the first time at 08:56 → "This link has expired" shows. (Verify: auto)
- **SEC-011** The system shall reject invitation links more than 7 days old.
  - SEC-011.1: An invitation sent on 2026-10-01 is opened on 2026-10-09 → refused; after Lan invites the address again, the new link works. (Verify: auto)
- **SEC-012** The system shall end a session 30 days after sign-in.
  - SEC-012.1: Bao signed in on 2026-10-01 at 09:00 and makes a request on 2026-10-31 at 09:01 → Bao is sent to sign-in. (Verify: auto)
- **SEC-013** The system shall reject any demotion or deactivation that would leave no active Admin.
  - SEC-013.1: Lan is the only active Admin, and a request demotes Lan → rejected. (Verify: auto)
  - SEC-013.2: Lan is the only active Admin, and a request deactivates Lan → rejected. (Verify: auto)
- **SEC-014** The system shall serve all traffic over HTTPS and redirect HTTP to HTTPS.
  - SEC-014.1: A page is requested over http:// on production → it redirects to https:// with a valid certificate. (Verify: ops)
- **SEC-015** The system shall keep secrets in a VPS environment file readable only by the app user and outside the repository.
  - SEC-015.1: On the production VPS, the environment file is readable only by the app's OS user, and a scan of the repository finds no secrets. (Verify: ops)
- **SEC-016** The system shall send at most 5 sign-in links per email address per 15 minutes.
  - SEC-016.1: bao@example.com requests a 6th sign-in link within 15 minutes → no email is sent, and the usual "check your email" message shows. (Verify: auto)
- **SEC-017** The system shall set session cookies as HttpOnly, Secure, and SameSite=Lax.
  - SEC-017.1: After Bao signs in, the session cookie has HttpOnly, Secure and SameSite=Lax set. (Verify: auto)
- **SEC-018** The system shall never write sign-in tokens, secrets, or comment text to logs.
  - SEC-018.1: After sign-ins and comments on production, a search of the log file finds no token, secret or comment text. (Verify: ops)
- **SEC-019** When someone requests a sign-in link for an unknown or deactivated email address, the system shall show the same "check your email" message it shows for an active user.
  - SEC-019.1: Sign-in is requested for nobody@example.com → "check your email" shows, and no email is sent. (Verify: auto)
  - SEC-019.2: Sign-in is requested for Em's address, and Em is deactivated → "check your email" shows, and no link is sent. (Verify: auto)
- **SEC-020** The system shall log each sign-in, role change and deactivation with the actor and the time.
  - SEC-020.1: Lan promotes Bao at 11:30 → a log entry records the role change with Lan as actor and 11:30 as the time. (Verify: auto)

### 11. Quality targets

| ID | Target | How measured |
|---|---|---|
| NFR-001 | Works in current desktop versions of Chrome, Edge, Firefox and Safari. | Run sign-in, create issue, move card, comment and upload by hand in each browser; pass when all complete without layout or functional errors. |
| NFR-002 | Pages load in under 2 seconds in normal team use. | Time the core pages by hand on production with real team data. |
| NFR-003 | Every core journey can be completed with only the keyboard, including moving a board card. | By hand: sign in, create an issue, change its status on the board, comment and upload a file without a mouse. |

### 12. Stack and constraints

- **Stack:** Next.js, PostgreSQL, Drizzle ORM, hosted on a single VPS. Uploaded files on the VPS disk (DATA-004). Email through a transactional service (API-001).
- **Commands:** the npm scripts in `package.json` are the build, test and lint commands (DEC-024). AGENTS.md tells agents to use them and doesn't copy them.
- **Boundaries:**
  - This spec is the source of truth for product behavior.
  - Authorization lives in one server-side layer used by every read and write. There are no client-side-only permission checks.
  - Each user action commits in one database transaction together with its activity events and notification records. Email is sent after the commit.
  - Issues carry a version number that detects stale saves (REQ-026, REQ-061).
  - No real-time updates; pages show current data when they load.
  - Environments: local development and the production VPS only. No feature flags.
- **Agent's choices:**
  - DEC-025 (email vendor and request timeout): a transactional service with an HTTP API; a free or low-cost tier that fits a small team; sends from the owner's domain with SPF and DKIM; the API key lives only in server config (SEC-015). If no vendor fits all of these, stop and ask.
  - DEC-026 (test runner and end-to-end browser tool): pick them when creating the codebase, and run them through npm scripts in `package.json` (DEC-024).

### 13. Release and operations

- **Launch:** deploy to the VPS, the owner runs a smoke check, then the owner invites the team.
- **Rollback:** redeploy the previous version (OPS-004 keeps it compatible with the database).
- **After launch:** the owner reviews the logs during the first week. In an incident, the owner investigates using the logs and tells the team directly.

- **OPS-001** The system shall retry a failed notification or invitation email up to 3 times over about 10 minutes, then drop and log it.
  - OPS-001.1: The email service is down when a notification for Chi is created → sending is tried 4 times in total within about 10 minutes, a log entry records the drop, and Chi's in-app notification still exists. (Verify: auto)
- **OPS-002** The system shall write structured logs, each entry with a request ID, to a file on the VPS and delete entries older than 14 days.
  - OPS-002.1: The log file has entries from 15 days ago → after the retention job runs, they are gone and entries from 13 days ago remain. (Verify: ops)
- **OPS-003** The system shall be watched by an external uptime monitor that emails the owner when the site is unreachable.
  - OPS-003.1: The app is stopped → the owner gets an email after the monitor's next check. (Verify: ops)
- **OPS-004** The system shall use only additive database migrations so the previous release runs on the current schema.
  - OPS-004.1: A release with a migration is deployed, then the previous release is redeployed → sign-in, creating an issue and commenting still work. (Verify: ops)

## Appendix: Decisions and changes

**Resolved decisions**

| ID | Decision | Why |
|---|---|---|
| DEC-001 | Sign-in uses a magic link sent by email; no passwords are stored. Sign-in links work once, for 15 minutes. Invitations last 7 days, and an Admin can resend them. Sessions last 30 days. | Owner's choice (2026-09-23). |
| DEC-002 | Only a comment's author can edit or delete it, and that includes Admins. | Owner's choice (2026-09-23). |
| DEC-003 | No backups in R1. | The owner accepts the risk of total data loss. |
| DEC-004 | No integrations in R1. | Keeps the first release simple. |
| DEC-005 | There can be several Admins, all with equal rights; any Admin can promote or demote others; the last active Admin can't be demoted or deactivated. | So the team isn't locked out if an Admin leaves. |
| DEC-006 | A user is never notified about their own action. | Owner's choice (2026-09-23). |
| DEC-007 | Email notifications are always on; R1 has no preference setting. | Owner's choice (2026-09-23). |
| DEC-008 | An Admin can reactivate a deactivated user, who returns with their previous role and project memberships. | Owner's choice (2026-09-23). |
| DEC-009 | All six board columns always show; there is no column toggle. | Owner's choice (2026-09-23). |
| DEC-010 | The resource note form doesn't warn against pasting credentials. | Accepted as a known limitation (section 3). |
| DEC-011 | A failed sign-in email is shown to the user, with no background retry. Notification and invitation emails retry up to 3 times over about 10 minutes, then are dropped and logged. The vendor is the agent's choice (DEC-025). | Owner's choice (2026-09-23). |
| DEC-012 | Only Admins can rename a project. | Owner's choice (2026-09-23). |
| DEC-013 | A new issue starts in Backlog. | Owner's choice (2026-09-23). |
| DEC-014 | Filter by assignee, priority and milestone. Sort by priority, due date and created date. There is no status filter; the list view shows status as a column. The default sort was never confirmed and moved to DEC-022. | Owner's choice (2026-09-23). |
| DEC-015 | Deleting a comment removes its text for good and leaves a "comment deleted" placeholder with author and time. Deleting a milestone removes it; its issues stay with no milestone, and each issue's feed records it. Deleting a resource removes it and its file. Anyone with project access can remove an issue attachment, and its file is deleted. | Owner's choice (2026-09-23). |
| DEC-016 | Operations baseline: logs to a file on the VPS for 14 days, without tokens, secrets or comment text; a free uptime monitor emails the owner; pages load in under 2 seconds in normal use, with no load testing; no formal accessibility standard, but keyboard-usable; local and production environments only; launch by deploy, smoke check and invite; roll back by redeploying the previous version, with additive migrations only; English only. | Owner's choice (2026-09-23). |
| DEC-017 | Security baseline: HTTPS only, with a free TLS certificate and HTTP redirected; secrets in a VPS environment file readable only by the app user; at most 5 sign-in link requests per email address per 15 minutes; session cookies HttpOnly, Secure and SameSite=Lax; no encryption at rest in R1. | Owner's choice (2026-09-23). |
| DEC-018 | Deactivated users are hidden from the assignee and @mention pickers; existing assignments and authorship still show their name. | Owner's choice (2026-09-23). |
| DEC-019 | Must: F-001, F-002, F-003, F-004, F-005, F-006, F-008, F-011, F-015. Should: F-007, F-009, F-010, F-012, F-013, F-014, F-016. Could: none. All stay in R1. | The Must features replace Trello and add the project layer that is the reason to build One Team. |
| DEC-020 | Project descriptions, issue descriptions, comments and resource notes all use the same basic markdown. | Owner's choice (2026-09-23). |
| DEC-021 | Uploads are limited to PNG, JPEG, GIF, WebP, PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV. | Covers screenshots, office documents and data exports, and leaves out types that can carry scripts or hide their contents. |
| DEC-022 | The default sort is created date, newest first. Each sort has one fixed direction: priority from Urgent to None, due date soonest first, created date newest first. There is no direction toggle. | Keeps the views simple for non-technical members. |
| DEC-023 | STD-4: missing or deleted items show the "not found" page with a link to the project list. STD-5: every form disables its submit control while saving, and repeating a completed action changes nothing. STD-7: loading indicator, one-line empty states with an add action, errors next to the control or at the top with input kept. | One consistent behavior on every screen; STD-5 replaces the issue-only REQ-059. |
| DEC-024 | Build, test and lint commands are the npm scripts in `package.json`; AGENTS.md tells agents to use them and doesn't copy them. | Owner's choice (2026-09-29). |

**ID changes**

- F-001 to F-016 are new; the old features had no IDs. The old Issues feature became F-005 Issues, F-006 Issue fields and F-007 Deleted issues. Accounts and sign-in became F-015, with user management split off as F-016. Both splits keep each feature within 8 rules.
- REQ-058 to REQ-065, SEC-019, SEC-020 and DATA-008 to DATA-010 are new IDs for behavior the old spec stated only in its workflows, screens, data model or non-functional notes.
- The wording of REQ-021, REQ-023, REQ-024, REQ-025, REQ-030, REQ-037 and OPS-002 now includes detail from old sections 5.4, 6.1, 10 and 12 and from DEC-014. SEC-006 now points to the allowlist in section 8.
- STD-1 to STD-7 replace the shared outcomes in old section 5.3. API-001 replaces DEP-001.
- AC-001 to AC-091 became examples under the rules they tested. AC-081 moved from REQ-001 to REQ-064.1, and AC-080 moved from DATA-004 to DATA-010.1.
- TEST-001 to TEST-016 became the Verify tag on each example.
- WF-001 to WF-008 became the flows and rules of F-015, F-016, F-005, F-008, F-007, F-011, F-013 and F-001.
- US-001 to US-008 were dropped; the flows cover them.
- LIMIT-001 to LIMIT-006 became known limitations, FOLLOWUP-001 became an out-of-scope item and ASSUMP-001 became an assumption, all in section 3.
- SPEC-001 was dropped.

**Changelog**

- None.

**Superseded items**

- REQ-059: While an issue save is pending, the system shall disable its save control. Superseded by STD-5, which covers every form (DEC-023).
