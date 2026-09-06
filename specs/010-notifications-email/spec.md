# Feature Specification: Notifications and email

**Feature Branch**: `sdd/r11`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R11**

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "R11 — Notifications and email. Tell people the three things worth interrupting them for, in the app and by mail."

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R11** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## Clarifications

### Session 2026-09-06

- Q: What surface does `markNotificationRead` have, given §3.6 names the mutator but describes no per-row control? → A: Activating a row on `/notifications` is its only surface. §3.6 gives the screen exactly one header control — "Mark all read" — and describes the row's own gesture as opening its target; §3.2 fixes the contrast by ruling that Home lists the same rows with the same dot and "writes nothing and so can mark nothing read". Marking read is therefore a property of activating a row on this screen, not of arriving at a comment. (FR-025)
- Q: Does `OT-OPS-002`'s "up to three times over an hour" count the immediate post-commit send? → A: No. `OT-OPS-002` calls the three attempts *retries* and gives the sweep as their owner, while §3.6 and `OT-OPS-007` make the first send immediate and outside the sweep. A row therefore gets one immediate send plus at most three sweep retries — four attempts at most. (FR-067, SC-014)
- Q: Who issues the immediate send, and when? → A: The process serving the request that caused the notification, after that request's transaction has committed and without the response waiting on it. The sweep never issues a first attempt; it picks up only rows the immediate send left unstamped. (FR-064, FR-065)
- Q: §3.6 names the board's inline "Add a card" composer under Assignee grouping among the writes that set `issue.assignee_id`. Is it a fourth assignment path? → A: No — it is `createIssue` reached from the board, already inside the path FR-050 covers. FR-050 names it so the rule is not misread as belonging to the Create issue page alone. (FR-050)
- Q: How is `OT-OPS-002`'s three-retry bound enforced across a process restart? → A: The row carries its own send-attempt count. Wall-clock alone cannot enforce the bound — deriving attempts from the row's age either re-sends on every sweep tick or abandons the row at a restart — so the count is a field on the row. This widens the field list §5 enumerates, deliberately and for that stated reason, and the field is exposed by no read endpoint and carried by no DTO. The arithmetic already settled is unchanged: one immediate send after commit plus at most three sweep retries, four attempts at most across the hour. (FR-001, FR-007, FR-073, SC-014)
- Q: When "Mark all read" runs, when does the sidebar's unread count drop to zero? → A: Immediately, as part of the mutation — the shell re-renders with the write rather than waiting for the next navigation. Revalidation on mutation is what the no-live-push rule permits; polling, a socket and any live push stay prohibited, and the earlier "next render" reading is corrected to this. (FR-028, FR-036, SC-012)
- Q: Is the notifications list bounded? → A: Yes — the screen renders the 200 most recent notifications the caller holds, newest first, with no page control and no infinite scroll. It stays the single reverse-chronological list §3.6 describes, just bounded. A row past the newest 200 is simply not listed: it is not deleted, it still counts toward the sidebar's unread number, and "Mark all read" still clears it. (FR-011, FR-022, FR-033, SC-001)
- Q: What format is a notification email? → A: Plain text only. No HTML alternative part and no template layer. It still carries the four facts FR-069 fixes — the actor, what happened, the issue or project, and the deep link. (FR-069)
- Q: What happens when the mark-read write fails while a row is being activated? → A: The navigation proceeds anyway, the row stays unread, and no toast fires; the dot self-corrects the next time the row is activated. This is the one deliberate exception to §4's rejected-write toast convention in this feature: the user's intent was to open the target and that succeeded, the read stamp is a side effect they did not author, and a toast about it would interrupt a successful navigation with nothing to act on. (FR-025)
- Q: Does the send-attempt count FR-007 adds include the immediate post-commit attempt, or only the sweep's retries? → A: Every attempt, the immediate one included. The field is 0 when the row is inserted, reads 1 once the immediate send has returned, and the sweep stops once it reaches 4 — one immediate attempt plus at most three retries. The bound is the same arithmetic already settled; this fixes the numbering the field, its default and the stop condition are all expressed in. (FR-001, FR-007, FR-067, SC-014)
- Q: When is the send-attempt count incremented — before the attempt is made or after it returns? → A: After it returns: on success in the same write that stamps the emailed moment, on failure in a write of its own. The consequence is stated rather than hidden — a process that dies mid-send records neither the stamp nor the attempt, so that message may be sent twice. That is the trade this spec already prefers, a duplicate message over a lost one, and the one-hour window and the four-attempt bound cap how far it can go. (FR-066, FR-067)
- Q: What makes an unsent row eligible for its next sweep retry? → A: Its age, not the sweep's tick. A row is eligible once its age exceeds its attempt count × 15 minutes — roughly 15, 30 and 45 minutes after creation — and stops being eligible once its age passes one hour from creation or its count reaches 4, whichever comes first. Retry spacing is therefore assertable by clock and independent of how often the shared timer fires; any reading that ties spacing to the timer's period is corrected to this. (FR-067, FR-068, SC-014)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Someone opens Notifications and reads what happened to them (Priority: P1)

A signed-in user follows the sidebar's Notifications entry to `/notifications`. Until now that route answered "This doesn't exist". It now renders their own notifications, newest first and bounded at the 200 most recent: each row carries an unread dot while it is unread, the name of the person who caused it, what happened (mentioned you / assigned you / commented), the issue or project it happened on, and how long ago. Activating a row takes them straight there — and where a comment caused it, to that comment on the page rather than the top of it. They see nobody else's notifications, and no route exists that would show them any.

**Why this priority**: This is the screen the entry is named for, and the destination of a sidebar entry entry R2 already shipped pointing at a route that refuses. Every other story here either fills this list or acts on a row in it. Until it renders, every notification this feature writes is invisible.

**Independent Test**: Sign in as a user holding a spread of notification rows of all three types, across an issue and a project, some read and some not, open `/notifications`, and confirm the rows render newest first with the dot only on unread ones, each naming actor, type, target and a relative time; that activating a row lands on the right page, at the comment anchor where the row carries a comment; that a second user's rows never appear; and that a user holding none sees one quiet line. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** a signed-in user holding notifications of all three types, **When** they open `/notifications`, **Then** the rows they hold render in reverse-chronological order, at most the 200 most recent of them, and no row belonging to anyone else renders.
2. **Given** an unread notification, **When** its row renders, **Then** it carries an unread dot; a read one carries none, and the difference is conveyed by more than colour alone.
3. **Given** a `mention` row, an `assignment` row and a `comment` row, **When** they render, **Then** each names the actor by display name, says which of mentioned you / assigned you / commented it is, names the issue or project it happened on, and shows a relative time.
4. **Given** a notification carrying a comment, **When** the user activates its row, **Then** they land on that comment's own anchor on the issue or project page rather than the top of the page.
5. **Given** a notification carrying no comment, **When** the user activates its row, **Then** they land on the issue's page or the project's details page.
6. **Given** a user holding no notifications, **When** they open the screen, **Then** it shows one quiet line, no illustration and no marketing.
7. **Given** the screen still loading, **When** it renders, **Then** it shows a skeleton matching the row layout it replaces, never a full-screen spinner, and the layout does not shift when the data lands.
8. **Given** an unauthenticated request to `/notifications`, **When** it is made, **Then** it redirects to sign-in and never reaches the screen or the Forbidden screen.
9. **Given** a user returning to the screen after navigating away, **When** it renders, **Then** it re-queries the server and renders nothing from a client cache.
10. **Given** the actor of a notification has since been deactivated or removed from the project, **When** the row renders, **Then** their name still renders and the row is unchanged.
11. **Given** a user holding more than 200 notifications, **When** they open the screen, **Then** the 200 most recent render, no page control and no infinite scroll appears, and the rows past them are neither listed nor deleted.

---

### User Story 2 - Being mentioned, assigned or commented at produces a notification (Priority: P2)

Somebody names a person in a comment, hands them an issue, or comments where they are listening. One row is written for that person, in the same transaction as the change that caused it, so the change and the notice land together or not at all. The person acting is never told about their own action, and a closed account is never written to.

**Why this priority**: The list in Story 1 is empty until something writes to it. This is the whole of the recipient computation, added to the mutators entries R6, R7 and R10 already deliver, and it is the reason the entry depends directly on all four earlier slices.

**Independent Test**: Against existing projects and issues, run each of the four assigning-or-commenting mutators once and confirm the rows written: a comment naming two people writes two `mention` rows; the same comment on an issue writes `comment` rows for the issue's assignee and creator, minus anyone already holding a `mention` row for it; setting an assignee writes one `assignment` row; and every write leaves the actor and every deactivated user without a row.

**Acceptance Scenarios**:

1. **Given** a member posts a comment on an issue naming two other people, **When** it is saved, **Then** each of those two holds one `mention` row carrying that comment, and the author holds none.
2. **Given** a member posts a comment naming themselves, **When** it is saved, **Then** no row is written for them.
3. **Given** a member posts a comment on an issue that has an assignee and a creator who are neither the author nor mentioned, **When** it is saved, **Then** each holds one `comment` row.
4. **Given** an issue whose assignee is also its creator, **When** somebody else comments on it, **Then** that person holds exactly one `comment` row, not two.
5. **Given** a person who would receive both a `mention` and a `comment` row for one comment, **When** it is saved, **Then** they hold exactly one row and it is the `mention`.
6. **Given** a comment posted on a project, **When** it is saved, **Then** one `comment` row goes to each of that project's explicitly added members and none to an admin who holds no membership row there.
7. **Given** a mentioned or listening user who has been deactivated, **When** the comment is saved, **Then** no row is written for them and no mail is addressed to them.
8. **Given** any of issue creation, an issue-rail edit or a board drop that sets an issue's assignee to somebody other than the person acting, **When** it is saved, **Then** that assignee holds exactly one `assignment` row naming that issue.
9. **Given** a write that leaves the assignee unchanged, or one that clears it, **When** it is saved, **Then** no `assignment` row is written by it.
10. **Given** a person assigns an issue to themselves, **When** it is saved, **Then** no row is written.
11. **Given** the transaction carrying the change fails, **When** it rolls back, **Then** no notification row survives it and no mail is sent.
12. **Given** a project's status is changed, a label is applied, a column is renamed or a member is added, **When** it is saved, **Then** no notification row of any type is written.

---

### User Story 3 - A person clears their own notifications, one at a time or all at once (Priority: P3)

Opening a notification marks it read, and where that write fails the navigation still happens and the row simply stays unread. When the list has built up, one control in the header clears every unread row the person holds — one call, not one per row — the sidebar's count drops to zero with that same write, and the set it clears is worked out on the server from the session, so nothing a client sends can widen it to somebody else's rows.

**Why this priority**: The unread dot and the sidebar count are only useful if there is a way down from them. It follows Story 2 because there is nothing to clear until rows are written.

**Independent Test**: Give one user a mix of read and unread rows and a second user unread rows of their own; open one row and confirm it is now read; use "Mark all read" and confirm every one of the first user's unread rows is read, that the already-read ones keep the moment they were read, and that the second user's rows are untouched.

**Acceptance Scenarios**:

1. **Given** an unread notification, **When** the user activates its row, **Then** it becomes read and they arrive at its target.
2. **Given** an already-read notification, **When** the user activates it again, **Then** it stays read and the moment it was first read is unchanged.
3. **Given** a user holding unread rows, **When** they use "Mark all read", **Then** every one of their unread rows becomes read in a single call — including any the screen's 200-row bound left unlisted — and the sidebar's count reads zero without a navigation or a reload.
4. **Given** two users each holding unread rows, **When** one of them marks all read, **Then** the other's rows are untouched.
5. **Given** a caller who supplies another user's identifier alongside the call, **When** it is processed, **Then** the supplied value changes nothing: only the session's own rows are cleared.
6. **Given** a caller naming a notification that belongs to somebody else, **When** they try to mark it read, **Then** they get the "This doesn't exist" treatment rather than a permission refusal, and the row is unchanged.
7. **Given** a caller naming a notification identifier that is malformed or names no row, **When** it is processed, **Then** it is refused explicitly and nothing is written.
8. **Given** a user holding no unread rows, **When** the screen renders, **Then** "Mark all read" renders disabled with its reason inline rather than hidden.
9. **Given** an unauthenticated caller, **When** either mutator is invoked directly, **Then** it is refused and writes nothing.
10. **Given** an unread notification whose mark-read write fails, **When** the user activates its row, **Then** they still arrive at its target, the row is still unread, and no toast fires.

---

### User Story 4 - The sidebar says how much is waiting (Priority: P4)

The Notifications entry in the sidebar carries the number of unread notifications the signed-in user holds, so the count is visible from every authenticated screen without opening the list.

**Why this priority**: It is the one piece of this feature that shows up outside its own screen, and entry R2 shipped the sidebar entry with the count deferred to here. It depends on the same unread state Story 3 clears.

**Independent Test**: Sign in holding three unread rows, confirm the sidebar entry reads three on every authenticated screen, open one row and confirm it reads two, then use "Mark all read" and confirm no count renders at all from the moment that write returns, with no navigation and no reload in between.

**Acceptance Scenarios**:

1. **Given** a user holding unread notifications, **When** any authenticated screen renders, **Then** the sidebar's Notifications entry shows exactly that number.
2. **Given** a user holding none, **When** the sidebar renders, **Then** the entry shows no count and no zero.
3. **Given** the count renders, **When** it is read by assistive technology, **Then** the entry's accessible name carries the number rather than leaving it to a visual badge alone.
4. **Given** a user uses "Mark all read", **When** the write returns, **Then** the count is already gone — the shell re-rendered with the write rather than waiting for the next navigation — and no polling, socket or live push was involved.
5. **Given** two users signed in, **When** each renders the shell, **Then** each sees only their own unread count.

---

### User Story 5 - The notice goes out by mail as well, and a dead mail host breaks nothing (Priority: P5)

Every notification is also one email, sent as soon as the change that caused it has committed. A slow or unreachable mail host neither fails the write nor holds the request open: the row is already saved, and the send is retried a few times over the following hour before the email is given up on and the in-app row carries on alone.

**Why this priority**: Mail is half of what the entry promises, but the in-app rows are usable without it, and its failure path must never reach a write. It follows Stories 2 and 3 because there is nothing to mail until rows exist.

**Independent Test**: With a mail host that accepts, confirm one message per notification, that each row records when it was sent, and that its attempt count reads one; with a host that refuses, confirm the write still succeeds, the response is not delayed, the row is left unsent, that each retry falls due on the row's own age rather than on the timer's period, and that after the fourth attempt the row keeps its in-app life and is never attempted again.

**Acceptance Scenarios**:

1. **Given** a change that writes three notifications, **When** it commits, **Then** three separate messages go out, one per notification, with no digest and no batching.
2. **Given** the mail host is unreachable, **When** the causing write runs, **Then** the write succeeds, the caller's response is not held waiting on the send, and the notification row is written all the same.
3. **Given** a send that succeeds, **When** it completes, **Then** the row records the moment it was emailed and its attempt count reads one, both written together.
4. **Given** a send that fails, **When** it completes, **Then** the row is left with no emailed stamp, its attempt count has risen by one, and it is picked up by the retry sweep once it is due.
5. **Given** a row whose immediate send failed and which has since failed three sweep retries — an attempt count of four — **When** the sweep next runs, **Then** it is not attempted again, and its in-app row is unchanged and still readable.
6. **Given** a row created more than an hour ago that is still unsent, **When** the sweep runs, **Then** it is not attempted again, whatever its attempt count reads.
7. **Given** the installation has no mail host configured, **When** a notification is written, **Then** the write succeeds, nothing crashes, and the row keeps its in-app life.
8. **Given** the retry sweep, **When** it runs, **Then** it runs on the one in-process timer the installation already has, with no queue and no external scheduler.
9. **Given** a message that goes out, **When** it is read, **Then** it names the actor, what happened and the issue or project, links to the same place the row's own deep link opens, and is plain text with no HTML alternative part.
10. **Given** an unsent row with an attempt count of one that was created ten minutes ago, **When** the sweep runs, **Then** it is not attempted, because its age has not yet passed its count × 15 minutes; **When** the sweep runs again after the row turns fifteen minutes old, **Then** it is attempted, and running the sweep any number of extra times inside those first fifteen minutes changes neither answer.

---

### User Story 6 - Editing a comment tells only the people it newly names (Priority: P6)

Someone edits a comment they wrote and adds a name that was not in it before. That person is notified, once. Nobody who was already named is notified again, nobody who was dropped from the comment has anything taken back, and the people who were told about the comment when it was posted are not told about it a second time.

**Why this priority**: It is a narrow rule on one existing mutator and the list is useful without it, but it is the difference between an edit being a way to reach someone and an edit being a way to spam everyone in a thread.

**Independent Test**: Post a comment naming one person, then edit it to name a second, then edit it again to drop the first; confirm exactly one new row after the first edit, none for the person already named, and that the dropped person's original row survives untouched.

**Acceptance Scenarios**:

1. **Given** a comment naming one person, **When** its author edits it to also name a second, **Then** the second holds one new `mention` row and the first holds no second row.
2. **Given** a comment whose author edits it without changing which names it carries, **When** it is saved, **Then** no notification row is written.
3. **Given** an edit that removes a name, **When** it is saved, **Then** the row that mention already produced is neither deleted nor altered, and its mail is not recalled.
4. **Given** an edit that names a person who already holds a `comment` row for that comment, **When** it is saved, **Then** they hold no second row.
5. **Given** an edit that names the author themselves, **When** it is saved, **Then** no row is written for them.
6. **Given** an edit that names a deactivated user, **When** it is saved, **Then** no row is written and no mail is addressed to them.
7. **Given** any edit, **When** it is saved, **Then** it writes no `comment`-type row: that recipient set belongs to the comment's creation and is never revisited.
8. **Given** the edit's own transaction, **When** it commits, **Then** the body change and every row the diff produced land together, and the mail goes out only afterwards.

---

### User Story 7 - Deleting the thing a notification points at takes the notification with it (Priority: P7)

When a project, an issue or a comment is deleted, the notifications that point at it go in the same transaction, so no row survives pointing at nothing.

**Why this priority**: It is the smallest slice here and it is invisible until something is deleted, but the deletes it completes have shipped already with this arm explicitly deferred to this entry.

**Independent Test**: Against a project holding issues, comments and notifications of all three types, delete a comment and confirm only the rows carrying it are gone; delete an issue and confirm the rows on it and on its comments are gone; archive and delete the project and confirm every row reaching any of its issues, comments or itself is gone, with no other project's rows touched.

**Acceptance Scenarios**:

1. **Given** a comment carrying `mention` and `comment` notifications, **When** it is deleted, **Then** exactly those rows are deleted with it, in the same transaction.
2. **Given** an issue carrying notifications and holding commented-on notifications, **When** an admin deletes it, **Then** every notification reaching the issue or its comments is deleted with it.
3. **Given** an archived project, **When** an admin deletes it, **Then** every notification reaching the project, its issues and their comments is deleted with it.
4. **Given** any of those deletes, **When** it runs, **Then** there is no moment at which the row is gone and a notification pointing at it is not.
5. **Given** notifications belonging to another project, **When** a project is deleted, **Then** none of them is touched.
6. **Given** a user is deactivated, **When** it takes effect, **Then** their notifications are neither deleted nor altered — deactivation is not a delete.

---

### Edge Cases

- **A mention token naming a user that no longer exists.** The comment stores the token; no user answers it, so no row is written for it and the rest of the mention set is written normally.
- **A person mentioned who is not a member of the project.** They are notified: a mention follows the name, not the membership, and every project is readable by every signed-in user.
- **A project comment on a project with no explicit members.** No `comment` rows are written, and any mentions the body carries are written as usual.
- **An issue with no assignee.** An issue comment writes a `comment` row for the creator alone.
- **The actor is the issue's only listener.** No rows are written at all, and no mail goes out.
- **A recipient deactivated between the row being written and the mail being sent.** The row and its mail stand; the exclusion applies when the recipient set is computed, and no cascade withdraws a delivered notice.
- **Two edits of one comment racing, each adding the same name.** At most one row exists for that person and that comment; the second write finds the row already there and adds none.
- **A drop into Unassigned under Assignee grouping.** The field is cleared, there is no new assignee, and nothing is written.
- **A reorder inside one assignee's lane.** The field is unchanged, so nothing is written.
- **A caller holding more than 200 notifications.** The screen lists the 200 most recent and offers no way to page past them. The older rows stay in the table with their read state intact, are still counted by the sidebar where they are unread, and are still cleared by "Mark all read".
- **The mark-read write fails while a row is being activated.** The navigation goes through, the row is left unread and no toast fires; the next activation of that row marks it read.
- **A notification whose target was deleted between the list rendering and the row being activated.** The row is gone with its target; the person gets the "This doesn't exist" treatment rather than a permission refusal.
- **"Mark all read" pressed twice in quick succession.** The second call clears nothing, changes no `read_at` already set, and is not an error.
- **A caller marking read a notification identifier belonging to another user.** Indistinguishable from one that does not exist.
- **The process restarts with unsent rows outstanding.** The sweep picks up each row on the first tick after its age makes it due again, and each row's own attempt count survives the restart, so the row resumes from the attempt the count records rather than starting the schedule over.
- **The sweep ticks while an unsent row is not yet due.** The row is skipped and its attempt count is untouched; a tick is an opportunity to attempt a due row, never itself a retry.
- **The mail host accepts the message but the process dies before the row is stamped.** Neither the emailed stamp nor the attempt is recorded, so the row is retried and the recipient may receive the message twice; no source asks for exactly-once delivery, and a duplicate notice is preferable to a lost one. The hour-long window and the four-attempt bound cap how many duplicates that can produce.

## Requirements *(mandatory)*

### Functional Requirements

#### The notification record

- **FR-001**: This feature MUST add the `notification` table named in §5 — the sixteenth and last table of the data model — carrying `user_id`, `actor_id`, `type`, exactly one of `issue_id` / `project_id`, an optional `comment_id`, `read_at`, `emailed_at` and the send-attempt count FR-007 adds, and MUST follow the data-model conventions entry R1 fixed: a server-generated UUIDv7 primary key, `timestamptz` instants, and `updated_at` written explicitly through the shared helper. (§5)
- **FR-002**: `type` MUST be a `text` column constrained by a `CHECK` to exactly `mention`, `assignment` and `comment`. No fourth type MUST exist anywhere in this feature. (§3.6, `OT-OPS-004`)
- **FR-003**: A `CHECK` MUST enforce that exactly one of `issue_id` and `project_id` is set on every row, as it already does for a comment and an activity row. (§5, `OT-DATA-011`, `OT-INV-010`)
- **FR-004**: A `CHECK (user_id <> actor_id)` MUST exist as a backstop. It MUST NOT be the mechanism by which the actor is excluded — every recipient set MUST already have removed them before any row is written. (§3.6, §5, `OT-OPS-005`)
- **FR-005**: `comment_id` MUST be set on every `mention` row and every `comment` row, and MUST be null on every `assignment` row.
- **FR-006**: A person MUST hold at most one notification per comment. This MUST be enforced by the recipient computation and MUST additionally be backed by a database constraint over `(user_id, comment_id)` for rows carrying a comment, so two concurrent writes cannot both insert one. (§3.6, `OT-OPS-006`)
- **FR-007**: The row MUST record how many send attempts have been made for it, so the retry bound in FR-067 is enforceable across a process restart. The count MUST include every attempt, the immediate one under FR-064 included: it MUST default to 0 when the row is inserted and MUST read 1 once that immediate send has returned. This field widens the list §5 enumerates, and it is added deliberately for that reason alone: `OT-OPS-002`'s bound is otherwise unenforceable, because deriving the attempt count from wall-clock alone either re-sends on every sweep tick or abandons the row at a restart. It MUST be exposed by no read endpoint and carried by no DTO. (§5, `OT-OPS-002`)
- **FR-008**: Indexes MUST be added for the two query patterns this feature actually issues — a user's rows newest-first, and a user's unread rows — and for nothing else. (`AGENTS.md`, Drizzle guidance)
- **FR-009**: The migration MUST be generated by the project's migration tooling, its SQL inspected, and the migration and its metadata committed with this change.

#### The Notifications screen

- **FR-010**: This feature MUST render the Notifications screen at `/notifications`, replacing the placeholder that answers "This doesn't exist" today. It MUST create no second notifications route and no notifications modal. (§3, screen 6)
- **FR-011**: The list MUST render the caller's own notifications in reverse-chronological order, bounded as FR-022 requires, and MUST render no row belonging to anyone else. (§3.6, `OT-AUTHZ-003`)
- **FR-012**: Every row MUST carry an unread indicator while it is unread, the actor's display name, which of the three types it is, the issue or project it happened on, and a relative time. The unread state MUST NOT be conveyed by colour alone. (§3.6, `OT-UX-019`)
- **FR-013**: The type MUST read as *mentioned you*, *assigned you* or *commented*. (§3.6)
- **FR-014**: Activating a row MUST open the issue or the project it names, and where the row carries a comment MUST open it at that comment's own anchor on the target route — the `#comment-<id>` anchor entry R7 already emits on every comment row. (§3.6)
- **FR-015**: A row on an issue MUST link to that issue's detail page and a row on a project MUST link to that project's details page, each at the route the screen table fixes. (§3, screens 4 and 8)
- **FR-016**: A caller holding no notifications MUST see one quiet line, with no illustration and no empty-state marketing. (§4, *Empty*)
- **FR-017**: While the screen's data is loading it MUST show a skeleton matching the row layout it replaces, never a full-screen spinner, and the layout MUST NOT shift when the data lands. (§4, *Loading*)
- **FR-018**: A revisited screen MUST re-query the server and MUST render nothing from a client cache. (§4, *Stale after navigation*)
- **FR-019**: An unauthenticated request MUST redirect to sign-in and MUST NOT reach the screen or the Forbidden screen. (`OT-AUTHZ-011`)
- **FR-020**: The screen MUST render inside the shell entry R2 delivers, and "Mark all read" MUST occupy the header's single per-screen control slot. The header's **New issue** slot MUST stay empty here: this is not a project-scoped route. (§3, *The shell*)
- **FR-021**: When the caller holds no unread rows, "Mark all read" MUST render disabled with its reason inline, never hidden. (§2, `OT-UX-021`)
- **FR-022**: The list MUST render at most the 200 most recent notifications the caller holds, newest first, and MUST offer no page control and no infinite scroll: it stays the single reverse-chronological list §3.6 describes, bounded. A row outside the newest 200 MUST simply not be listed — it MUST NOT be deleted, MUST still be counted under FR-033 and MUST still be cleared by FR-028. (§3.6)
- **FR-023**: The screen MUST target a desktop browser only, with no responsive layout and no mobile breakpoint. (`OT-SCOPE-004`)

#### Reading and marking read

- **FR-024**: A notification MUST be readable only by the user whose row it is. This MUST remain the only row-level read rule in the system, and no other endpoint, screen or query MUST expose one user's notifications to another. (§5, *Read boundary*, `OT-AUTHZ-003`)
- **FR-025**: Activating a notification row MUST mark that notification read and take the caller to its target, in one action. This MUST be the only surface `markNotificationRead` has in this feature, and no per-row mark-read control MUST exist beside it. Where the mark-read write fails, the navigation MUST proceed regardless, the row MUST be left unread and no toast MUST fire — the dot corrects itself the next time the row is activated. This MUST be the only departure in this feature from §4's rejected-write treatment, and no other write this feature adds MUST fail silently. (§3.6, §3.2, §4)
- **FR-026**: `markNotificationRead` MUST require only self. It MUST resolve the row from the caller's session and MUST refuse a row belonging to anyone else with the "This doesn't exist" treatment, never with a permission refusal, so a caller cannot learn that another user's notification exists. (§2, §4, `OT-AUTHZ-003`)
- **FR-027**: Marking a notification read MUST be idempotent: a row already read MUST keep the moment it was first read, and the call MUST NOT be an error.
- **FR-028**: `markAllNotificationsRead` MUST require only self and MUST clear every unread row the caller holds — including rows the 200-row bound in FR-022 leaves off the screen — in one statement rather than one call per row. The call MUST revalidate the shell so the sidebar's count reads zero as part of the same interaction, as FR-036 requires. (§3.6, §2, `OT-AUTHZ-016`)
- **FR-029**: The set `markAllNotificationsRead` clears MUST be scoped server-side from the session and MUST NOT be derived from any client-supplied user identifier; a client-supplied identifier MUST change nothing. (§3.6, `OT-AUTHZ-016`)
- **FR-030**: `markAllNotificationsRead` MUST leave already-read rows untouched and MUST touch no other user's rows.
- **FR-031**: Both mutators MUST validate their input on the server, authenticate the caller, run the origin check every mutating request runs, and return a safe result carrying no configuration and no database detail. A malformed identifier MUST be rejected explicitly and MUST NOT be coerced. (§6, `AGENTS.md` II, gate 3)
- **FR-032**: No mutator MUST delete a notification row. A row leaves only through the cascades in FR-058 to FR-061.

#### The sidebar's unread count

- **FR-033**: The sidebar's Notifications entry MUST carry the number of unread notifications the signed-in user holds, on every authenticated screen. It MUST count every unread row the caller holds and MUST NOT be bounded by FR-022's 200-row list cap, so it may exceed the number of unread rows the screen shows. (§3, *The shell*)
- **FR-034**: A caller holding no unread notifications MUST see no count and no zero.
- **FR-035**: The count MUST be scoped from the session, MUST count only the caller's own rows, and its value MUST be part of the entry's accessible name rather than conveyed by a visual badge alone. (`OT-AUTHZ-003`, `OT-UX-019`)
- **FR-036**: A write that changes the caller's unread set MUST revalidate the shell so the count reflects the change as part of that write rather than on a later navigation: "Mark all read" MUST leave the count at zero in the same interaction that clears the rows, with no manual reload. Revalidation on mutation is the only refresh mechanism permitted; polling, a socket and any live push MUST NOT be introduced. (§1, §4)

#### Recipient computation — rules that hold for every type

- **FR-037**: Every recipient set MUST be computed on the server from stored rows, never from anything the client sends. (`AGENTS.md` II, gate 3)
- **FR-038**: The actor MUST be removed from every recipient set before rows are written, including when they name themselves in a comment and when they assign an issue to themselves. (§3.6, `OT-OPS-005`)
- **FR-039**: Every deactivated user MUST be removed from every recipient set, so a closed account is neither written a row nor mailed. (§3.6, §3.9, `OT-OPS-015`)
- **FR-040**: Where a person would receive both a `mention` and a `comment` row for one comment, the `mention` MUST win and exactly one row MUST be written. (§3.6, `OT-OPS-006`)
- **FR-041**: Every notification row MUST be written in the same database transaction as the change that caused it, so the change and its notice land together or not at all. (§3.6, §5, `OT-DATA-009`)
- **FR-042**: A project's status change, an activity record, a label change, a column change, a membership change and a profile edit MUST notify nobody. (§3.6, §4, `OT-OPS-004`)

#### `mention` recipients

- **FR-043**: Creating a comment MUST write one `mention` row for each user the body names, after the actor and every deactivated user have been removed. (§3.6)
- **FR-044**: A mention token naming a user that does not exist MUST write no row, and MUST NOT prevent the rest of the set from being written.
- **FR-045**: A mention MUST NOT require the mentioned person to be a member of the project: it follows the name, not the membership.
- **FR-046**: Every `mention` row MUST carry the comment's own target — the issue or the project it was posted on — and the comment's identifier. (§5, `OT-INV-010`)

#### `comment` recipients

- **FR-047**: A comment on an issue MUST write one `comment` row for that issue's assignee and one for its creator, after FR-038 to FR-040 have been applied; where they are the same person, exactly one row MUST be written. (§3.6)
- **FR-048**: A comment on a project MUST write one `comment` row per row in that project's explicit member list — the membership list, not the membership predicate — so an admin receives one only where they were added explicitly. (§3.6, §2, `OT-OPS-014`)
- **FR-049**: Every `comment` row MUST carry the comment's target and identifier, and MUST be written only by the comment's creation, never by an edit. (§3.6, `OT-OPS-013`)

#### `assignment` recipients

- **FR-050**: Every write that sets an issue's assignee to somebody other than the actor MUST write exactly one `assignment` row for that assignee — issue creation from the Create issue page, issue creation from the board's inline "Add a card" composer under Assignee grouping, an issue-rail edit and a board drop alike. The rule MUST follow the field, not the mutator. (§3.6, `OT-OPS-016`)
- **FR-051**: A write that leaves the assignee unchanged, and one that clears it, MUST write no `assignment` row. (§3.6, `OT-OPS-016`)
- **FR-052**: An `assignment` row MUST carry the issue it concerns and no comment. (§5)

#### The mention diff on a comment edit

- **FR-053**: Editing a comment MUST diff the mention set of the saved body against the body it replaces and MUST write one `mention` row per user the edit newly names, under the same rules that apply to a new comment. (§3.6, `OT-OPS-013`)
- **FR-054**: An edit MUST write no `comment`-type row. (§3.6, `OT-OPS-013`)
- **FR-055**: An edit MUST write no second row for anyone already holding a row for that comment, of either type. (§3.6, `OT-OPS-006`, `OT-OPS-013`)
- **FR-056**: An edit MUST NOT delete or alter a row a mention it removed already produced, and MUST NOT recall its mail. (§3.6, `OT-OPS-013`)
- **FR-057**: The body change and every row the diff produces MUST commit in one transaction, which means the comment edit MUST become transactional where it is not already. (§3.6, `OT-DATA-009`)

#### The notification arm of the deletes

- **FR-058**: Deleting a comment MUST delete every notification carrying that comment, in the delete's own transaction. (§4, *Deletes*)
- **FR-059**: Deleting an issue MUST delete every notification reaching that issue or any of its comments, in the delete's own transaction. (§4, *Deletes*)
- **FR-060**: Deleting a project MUST delete every notification reaching that project, any of its issues or any of their comments, in the delete's own transaction. (§4, *Deletes*)
- **FR-061**: There MUST be no intermediate moment at which a deleted row is gone and a notification pointing at it is not. (§4, *Deletes*)
- **FR-062**: Deactivating a user MUST NOT delete or alter their notifications: deactivation is not a delete and a user is never deleted at all. (§4, §6)

#### Mail

- **FR-063**: Mail MUST be one message per notification, sent immediately. Digests, batching and opt-out MUST NOT exist. (§3.6, `OT-OPS-007`)
- **FR-064**: A message MUST be sent only after the transaction that wrote its notification has committed, never inside it, and its first attempt MUST be issued by the process serving that request rather than left to the sweep. (§3.6, `OT-OPS-001`, `OT-OPS-007`)
- **FR-065**: The request that caused the change MUST NOT wait on the send: a slow or dead mail host MUST be unable to fail the write or hold the request open. (§3.6, `OT-OPS-001`)
- **FR-066**: A successful send MUST stamp the row's emailed moment. A failed send MUST leave it unstamped for the sweep to retry. The row's send-attempt count MUST be incremented after the attempt returns, never before it is made — on success in the same write that stamps the emailed moment, on failure in a write of its own. A process that dies mid-send therefore records neither the stamp nor the attempt, and that message MUST be allowed to go out a second time rather than be lost; the hour and the four-attempt bound FR-067 fixes are what limit the duplication. (§3.6, `OT-OPS-002`)
- **FR-067**: A row MUST receive one immediate send under FR-064 and, where that send fails, at most three sweep retries — four attempts at most, which is the send-attempt count FR-007 records reaching 4. Eligibility for the next attempt MUST be decided by the row's age and MUST NOT depend on how often the sweep runs: a row MUST become eligible once its age exceeds its send-attempt count × 15 minutes — roughly 15, 30 and 45 minutes after its creation — and MUST stop being eligible once its age passes one hour from creation or its count reaches 4, whichever comes first. A row past either bound MUST NOT be attempted again, and the in-app row MUST survive an abandoned email unchanged. (§3.6, `OT-OPS-002`)
- **FR-068**: The retry sweep MUST run on the one in-process interval timer the installation already runs for the sign-in throttle's sweep. A queue, a worker and an external scheduler MUST NOT be introduced. The timer's period MUST NOT set the retry spacing: each tick MUST attempt only the rows FR-067's age rule has made eligible, so a faster or slower timer changes when a due row is picked up and never how many attempts it gets. (§7, `OT-OPS-003`)
- **FR-069**: A message MUST be addressed to the recipient's own address, MUST name the actor, what happened and the issue or project, and MUST link to the same place the row's own deep link opens. It MUST be plain text: no HTML alternative part and no template layer MUST exist. It MUST carry no session, no token and no configuration detail. (§3.6, §6)
- **FR-070**: An installation with no mail host configured MUST still write notifications, MUST NOT crash and MUST NOT fail a write; the rows keep their in-app life. (§7)
- **FR-071**: Mail failures MUST be recorded in the server log only, and any client-facing message MUST stay generic. (`AGENTS.md`, server boundary)

#### Boundaries this feature must hold

- **FR-072**: Every server entry point this feature adds MUST validate its input, authenticate the caller, authorize the exact resource, run the origin check, and return a safe result. (§2, §6, `AGENTS.md` II, gate 3)
- **FR-073**: Notification rows MUST NOT be exposed through any read this feature does not own, and the user projection every endpoint reuses MUST stay the one entry R1 fixed — this feature MUST NOT widen it to carry a recipient's address into a response. The row's send-attempt count MUST NOT reach any DTO or response either: it is delivery state, not something a screen reads. (§5, *Read boundary*)
- **FR-074**: Every control this feature adds MUST come from the project's accessible component layer, MUST carry an accessible name and a visible focus indicator, and MUST be operable by keyboard alone. (§7, *Frontend rules*)
- **FR-075**: Nothing this feature adds MUST introduce a third-party dependency: the mail transport and the timer it shares are already in place. (`AGENTS.md` IV, gate 4)

### Out of Scope

- **Digests, batching and opt-out.** None in v1 by §3.6. Every notification is one immediate message and there is no preference anywhere that suppresses it.
- **An HTML mail body, a template layer or any mail styling.** Every message is plain text carrying the four facts FR-069 fixes. No source asks for more, and a template layer would be machinery with one caller.
- **Notifying on anything but the three types.** Status changes notify nobody and activity records notify nobody — the feed is a log, not a channel. No label, column, membership or profile event writes a row.
- **Home's unread stat card and its Mentions list.** Entry R12's. Both read the table this feature creates, under the same own-`user_id` rule, and Home writes nothing and cannot mark a notification read.
- **Live push, sockets and real-time collaboration.** Out of scope for v1 by §1. The unread count and the list refresh on render and on revalidation after a mutation, and on nothing else — no timer, no poll and no socket.
- **Any notification preference, mute or per-project subscription.** No field for one exists in the data model and no screen offers one.
- **Changing who may read a project, an issue or a comment.** Membership stays a write boundary; this feature adds the system's one row-level read rule and no second one.
- **Editing or deleting a notification by hand.** No screen and no mutator offers it; a row leaves only by cascade.
- **Reworking the mutators this feature reaches into.** The recipient computation is added to the existing issue-create, issue-update, comment-create, comment-edit and issue-move paths; their validation, authorization, activity writing and return shapes are left as the entries that own them delivered them.
- **A second timer, a job table or a delivery log.** The retry state lives on the notification row itself.
- **Search, filtering or grouping of the notifications list.** Search of any kind is out of scope for v1 by §1, and §3.6 describes one reverse-chronological list. Its 200-row bound is a cap, not a page control: nothing offers a way to reach the rows beyond it.

### Key Entities

- **Notification** — the record this feature adds: who it is for, who caused it, which of the three types it is, the one issue or project it attaches to, the comment behind it where there is one, when it was read, when it was emailed, and how many times its email has been attempted. That last count is an addition to §5's field list, held server-side and returned by no read; it starts at 0, counts every attempt including the immediate one, is incremented only once an attempt has returned, and stops the retries at 4. It is the only entity in the system with a row-level read rule.
- **Comment** — the source of `mention` and `comment` rows, and the target of the deep link. Owned by entry R7; this feature reads its body's mention tokens and its identifier, and adds nothing to it.
- **Issue** — the target of an `assignment` row, and of `mention` and `comment` rows posted on it. Its assignee field is the trigger the assignment rule follows. Owned by entry R6.
- **Project member** — the recipient list for a project comment, read as a list of rows rather than through the membership predicate, which is why an admin is not on it by default. Owned by entry R5.
- **User** — the recipient, the actor and the mail address. Read through the projections entry R1 fixed; deactivation excludes them from every recipient set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user sees the 200 most recent notifications addressed to them, and no notification addressed to anyone else, on 100% of reads — verified against the database rather than through the screen that renders it.
- **SC-002**: No request by any caller, through any route or mutator this feature adds, returns or alters a notification belonging to another user; an attempt is indistinguishable from one naming a row that does not exist.
- **SC-003**: Every one of the four assigning-or-commenting writes produces exactly the rows the rules require and no others, verified by a full census of the table before and after each write.
- **SC-004**: The actor holds zero rows across every path in this feature, including a self-mention and a self-assignment, on 100% of writes.
- **SC-005**: A deactivated user is written zero rows and sent zero messages across every path, on 100% of writes.
- **SC-006**: A person holds at most one notification per comment on 100% of writes, including when a mention and a comment recipient set both name them, and including two concurrent edits that add the same name.
- **SC-007**: A project comment reaches exactly the project's explicitly added members: an admin with no membership row there holds zero rows, on 100% of project comments.
- **SC-008**: A write that leaves an issue's assignee unchanged, and one that clears it, produces zero `assignment` rows — verified across issue creation, the issue rail and the board drop.
- **SC-009**: A comment edit produces rows only for names the saved body adds, zero `comment`-type rows, and zero changes to any row a removed mention had already produced, on 100% of edits.
- **SC-010**: A rolled-back change leaves zero notification rows behind and sends zero messages, on 100% of failures.
- **SC-011**: "Mark all read" clears every unread row the caller holds in one call and touches no other user's rows, on 100% of invocations, including when a foreign user identifier is supplied alongside it.
- **SC-012**: The sidebar's count equals the caller's total unread row count — not the number of unread rows the screen lists — on every authenticated screen, and reaches zero and disappears in the same interaction that "Mark all read" clears the rows, with no navigation and no reload in between.
- **SC-013**: A write whose mail host is unreachable still commits, and its response time is indistinguishable from the same write with mail disabled.
- **SC-014**: An unsent notification receives one immediate send and at most three sweep retries — its send-attempt count reading 1 after the immediate attempt and never passing 4 — with no attempt made before the row's age exceeds its current count × 15 minutes and none made after an hour from its creation, so the schedule is verifiable by clock rather than by how often the sweep runs. Across a process restart the count survives and the row resumes from it rather than starting over, and it appears in no response this feature returns.
- **SC-015**: Deleting a comment, an issue or a project leaves zero notifications pointing at anything deleted, and zero notifications belonging to anything else are touched.
- **SC-016**: Every control this feature adds is reachable and operable by keyboard alone, carries an accessible name, and conveys unread state by more than colour.
- **SC-017**: A mark-read write that fails during row activation blocks no navigation and raises no toast, on 100% of failures; the row is still unread afterwards and its next activation marks it read.

## Assumptions

### Defaults chosen because the source is silent

- **The list renders the 200 most recent rows the caller holds, with no page control.** §3.6 describes one reverse-chronological list and fixes no page size, where §3.4 fixes 50-row pages for the feeds explicitly. An unbounded read is not a safe reading of that silence — the table only grows and nothing prunes it — so the screen is bounded at the 200 most recent while staying the single list §3.6 describes, and no page control or infinite scroll is invented. Rows past the bound are not listed and not deleted (FR-022).
- **The unread count renders nothing at zero rather than a zero.** §3 gives the sidebar entry a count and no empty presentation; a badge reading zero would be state conveyed where there is none (FR-034).
- **The retry schedule is three retries spaced across the hour after the row is created, and eligibility is decided by the row's age.** `OT-OPS-002` fixes "up to three times over an hour" and no source fixes the interval or the sweep's period; spacing them evenly is the only reading under which three retries occupy an hour rather than the first minutes of it. A row is therefore due once its age exceeds its send-attempt count × 15 minutes — roughly 15, 30 and 45 minutes after creation — which keeps the spacing assertable by clock and independent of how often the shared timer fires (FR-067, FR-068).
- **The message is plain text, and its wording is not fixed.** §3.6 fixes one message per notification and its timing, not its subject line, its body or its format. It carries the actor, what happened, the target and the deep link — the same four things the row itself carries — as plain text, with no HTML alternative part and no template layer, because nothing in the sources asks for one and a second body would be a second thing to keep in step (FR-069).
- **A recipient deactivated after the row is written still receives it.** The exclusion in `OT-OPS-015` applies where the recipient set is computed. §4's cascades do not list deactivation, and §6 keeps a deactivated user's rows so reactivation restores prior access, so nothing withdraws a notice already written.
- **A duplicate message is preferred to a lost one.** No source asks for exactly-once delivery, and both the emailed stamp and the send-attempt count are written only after the send returns; a process that dies between the send and that write records neither, so the row is retried and may send twice. Incrementing before the attempt would trade that duplicate for a message lost with no record that it was never delivered, which is the worse failure here; the hour-long window and the four-attempt bound keep the duplication bounded (FR-066, FR-067).
- **A mark-read write that fails during row activation is silent.** §4 treats a rejected write with a rollback and a toast naming what failed, and this is the one place in this feature that departs from it. The user's intent was to open the target and that succeeded; the read stamp is a side effect they did not author, so a toast would interrupt a successful navigation with nothing to act on and no way to retry but the one the next activation already gives them (FR-025, SC-017).

### Reconciliations between the roadmap, the requirements index and the specification

- **The notification row carries a send-attempt count, which widens the field list §5 enumerates.** The widening is deliberate and is recorded here rather than assumed. §5 enumerates the row's key fields and `emailed_at` among them; `OT-OPS-002` then requires "up to three times", a bound that cannot be enforced without recording how many attempts have been made, because the alternative — deriving attempts from wall-clock alone — either re-sends on every sweep tick or stops sending after a restart. The counter counts every attempt, the immediate one included, so a stop condition of four attempts states the same bound `OT-OPS-002` states as three retries. It changes no behaviour §5 fixes, is exposed by no read endpoint and is carried by no DTO; it is the minimum the stated retry rule needs (FR-007, FR-067, FR-073).
- **The comment edit becomes transactional.** The roadmap's R7 row delivers `updateComment` and defers the mention diff here; `OT-DATA-009` then requires the rows to be written in the same transaction as the change that caused them. The edit therefore gains a transaction it does not have today, which changes nothing about its validation, its authorship rule or its result (FR-057).
- **`OT-OPS-016` is listed against the Board, the Issues and the Notifications capabilities in the requirements index, and deferred to this entry by the roadmap's R6 and R10 rows.** All three are right about their own subject: the writes belong to those entries and every row written belongs to this one, which is why the roadmap gives this entry a direct dependency on R10 rather than reaching it transitively.
- **`OT-AUTHZ-003` is also cited by entry R12.** The rule is established here with the table; R12 reads it under the same rule and this entry's requirements bind that read in advance.

### Inherited constraints, not decisions this specification makes

- The `comment` table, its mention tokens, the `#comment-<id>` anchor on every comment row, the feeds, the activity writer and the `createComment` / `updateComment` / `deleteComment` mutators are entry R7's. This feature adds recipient computation to two of them and the cascade arm to the third, and changes nothing else about any of them.
- The `issue` table, its assignee field, `createIssue`, `updateIssue` and `deleteIssue` are entry R6's; `moveIssue` is entry R10's; `project`, `project_member`, the membership predicate and `deleteProject` are entry R5's. This feature reads them and reaches into the named mutators only for the rows it owns.
- The actor on every request, the session, the data-model conventions, the length bounds, the mail transport, the server log and the single in-process timer are entry R1's. This feature adds a second sweep to that timer and no timer of its own.
- The shell, the sidebar's Notifications entry, the header contract with its one per-screen control slot, the per-screen skeletons, the toast conventions, the "This doesn't exist" convention and the disabled-with-inline-reason rule are entry R2's; this feature renders inside them.
- Interaction behaviour, focus management, keyboard support and ARIA semantics come from the project's accessible component layer, with the visual layer supplying appearance only.
- Everything this feature needs — the mail transport, the identifier generator, the database access layer — is already on the approved-dependency table; this feature installs nothing.

### Obligations this feature places on entries built before it

- **Five mutators gain a caller.** Issue creation, the issue-rail edit and the board drop each gain the assignment rule; comment creation gains the mention and comment sets; the comment edit gains the mention diff and a transaction. Each addition sits inside the transaction that mutator already runs, and none of them changes its validation, its authorization or the shape of its result.
- **Three deletes gain their notification arm**, which §4 already specifies each of them as reaching and which the roadmap's R5, R6 and R7 rows each defer here by name.
- **Nothing earlier is widened.** No table an earlier entry owns gains a column, no predicate changes meaning, and no earlier requirement is reinterpreted. Where an earlier entry landed narrower than its own requirements state, this feature follows the shape that exists and records the divergence here rather than altering a slice that has shipped.

### Downstream reach-back this specification must state

- **Entry R12 reads this table.** Home's unread stat card and its Mentions list both read notifications under `OT-AUTHZ-003`'s own-`user_id` rule, and Home writes nothing and cannot mark a notification read. Nothing in this feature may assume it is the only reader, and the read rule it establishes binds that reader too.

### Dependencies

**Cannot be built without** — this feature has no code path that works until each has landed:

- **R7** — the `comment` table, its mention tokens, the `#comment-<id>` anchor the deep link targets, and the `createComment`, `updateComment` and `deleteComment` mutators the recipient computation and the cascade attach to.
- **R6** — the `issue` table and its assignee field, and the `createIssue`, `updateIssue` and `deleteIssue` mutators. Without them there is no assignment to notify about and no issue for a notification to attach to.
- **R10** — `moveIssue`, the third of the three writes that set an issue's assignee. Without it one of the three assignment paths does not exist.
- **R5** — the `project` and `project_member` tables, the membership list a project comment's recipients are read from, and `deleteProject`.
- **R2 and R1**, transitively — the shell, the sidebar entry the count lands in, the header's control slot and the "This doesn't exist" convention; and the actor, the session, the conventions, the mail transport and the timer the retry sweep shares.

**Consumed but not blocking** — none.

**Building this feature before R10** is not a supported ordering: `OT-OPS-016` names three writes and the board drop is one of them, so a build without it would ship two thirds of one rule with nothing on screen to explain which third is missing.

**Dependency approval this feature triggers**: none.
