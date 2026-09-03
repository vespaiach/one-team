# Feature Specification: Notifications and email

**Feature Branch**: `claude/r11-feature-specs-973239`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R11**

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "create a feature specifications for roadmap entry R11, refer to @docs/ROADMAP.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R11** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

**A note on build order.** R11 is not a self-contained slice: `OT-OPS-016` and the mention-diff rule attach recipient computation directly inside mutators four other entries own — `createIssue` and `updateIssue` (R6), `createComment` and `updateComment` (R7), `moveIssue` (R10) — and the notification arm of three delete cascades (R5's `deleteProject`, R6's `deleteIssue`, R7's `deleteComment`). R5 and R6 already carry child specs; **R7 and R10 do not exist yet** at the time this spec is written. Where this document states what R11 needs from R7 or R10, that is a forward contract those specs must satisfy when they are written, per the roadmap's own instruction (§3): "Any child spec for R5, R6, R7 or R10 must state that these later slices will touch its mutators and its deletes." It is not a description of code already in place.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A user is told when they're mentioned, assigned, or commented at (Priority: P1)

A project member writes a comment naming a colleague with `@`, or hands an issue to someone by setting its assignee, or comments on an issue someone owns or created. The named, assigned, or addressed person sees an unread indicator appear — a dot on the notification row, an updated count in the sidebar — without doing anything to ask for it.

**Why this priority**: This is the entire reason the feature exists. Every other story — reading the detail, clearing it, getting it by mail — has nothing to act on until a notification row exists. Nothing in R12 (Home's Mentions and unread stat card) has anything to read until this lands.

**Independent Test**: As user A, mention user B in a comment on an issue B does not own; as user A, assign an issue to user B; as user A, comment on an issue B is the assignee or creator of. Sign in as B and confirm three unread rows exist, the sidebar's unread count reads 3, and nothing appears for A.

**Acceptance Scenarios**:

1. **Given** a comment naming one user who is not its author, **When** the comment is posted, **Then** that user receives exactly one `mention` notification and the actor receives none.
2. **Given** `createIssue` or `updateIssue` sets an issue's assignee to someone other than the actor, **When** the write commits, **Then** the new assignee receives exactly one `assignment` notification.
3. **Given** a cross-lane drag under Assignee grouping moves a card to a new assignee, **When** the drop commits, **Then** the new assignee receives exactly one `assignment` notification, identically to a rail edit.
4. **Given** a comment posted on an issue, **When** the comment is not from the issue's assignee or creator, **Then** both the assignee and the creator each receive one `comment` notification, and the commenter receives none even if they are also the assignee or creator.
5. **Given** a comment posted on a project, **When** the comment is not from a listed `project_member`, **Then** every user holding a `project_member` row for that project receives one `comment` notification, and an admin who holds no membership row for that project receives none.
6. **Given** a user assigns an issue to themselves, **When** the write commits, **Then** no notification is written to anyone.
7. **Given** a write clears an assignee or leaves it unchanged, **When** the write commits, **Then** no `assignment` notification is written.

---

### User Story 2 - A user opens a notification and lands exactly where the event happened (Priority: P2)

A user with unread notifications opens `/notifications`, sees each row naming who did what and where, and clicks one. The browser takes them straight to the issue or project, scrolled to the comment when the notification is about one.

**Why this priority**: A list of unread dots that don't lead anywhere is not a notification feature. This is the second half of the value the first story creates — being told is only useful if it also gets you there.

**Independent Test**: With three unread notifications of different types on one account (a mention, an assignment, and a comment), open `/notifications` and confirm each row names the actor, the type in the specified wording, the target, and a relative time; click the comment-type row and confirm the browser lands on the issue's detail page scrolled to that comment's own row.

**Acceptance Scenarios**:

1. **Given** a `mention` notification, **When** it renders on `/notifications`, **Then** the row reads "mentioned you", names the actor, names the issue or project, and shows a relative time.
2. **Given** an `assignment` notification, **When** it renders, **Then** the row reads "assigned you" and names the issue.
3. **Given** a `comment` notification carrying a `comment_id`, **When** the user clicks it, **Then** the browser opens that issue's or project's page at the `#comment-<id>` anchor for that comment.
4. **Given** an `assignment` notification, which carries no `comment_id`, **When** the user clicks it, **Then** the browser opens the issue's page with no comment anchor.
5. **Given** an unread row, **When** the user clicks it, **Then** it is marked read as part of the same action and its dot is gone the next time the list renders.
6. **Given** a project-level `comment` notification, **When** the user clicks it, **Then** the browser opens that project's details page at the comment's anchor, not any issue.

---

### User Story 3 - A user clears their unread notifications (Priority: P3)

A user with several unread rows reads through them one at a time, or presses "Mark all read" once to clear everything outstanding without opening each row.

**Why this priority**: Read state is what makes the unread count and the dot meaningful; without a way to clear it, every session after the first opens to a growing, permanently-unread list.

**Independent Test**: With five unread notifications on one account, click one row and confirm only that row's dot clears and the sidebar count drops by one; then press "Mark all read" and confirm the remaining four clear in one action and the count reads zero.

**Acceptance Scenarios**:

1. **Given** one unread notification, **When** `markNotificationRead` is called for it, **Then** its `read_at` is set and it no longer counts toward the unread total.
2. **Given** several unread notifications belonging to the caller, **When** "Mark all read" is pressed, **Then** exactly one `markAllNotificationsRead` call runs and clears every one of the caller's own unread rows, never one call per row.
3. **Given** two users each holding unread notifications, **When** one presses "Mark all read", **Then** only their own rows are affected and the other user's unread rows and count are untouched.
4. **Given** a notification already marked read, **When** the user opens it again, **Then** nothing errors and its state is unchanged.
5. **Given** a caller with no unread notifications, **When** "Mark all read" is pressed, **Then** the call succeeds and changes nothing.

---

### User Story 4 - A user is emailed the same three events (Priority: P4)

The same mention, assignment, and comment events that produce an in-app row also produce one email each, sent after the action that caused them has fully committed, so a slow mail server never holds up the write that triggered it.

**Why this priority**: The specification treats in-app and email as one delivery with two channels, not two independent features, and mail is explicitly allowed to lag or fail without touching the in-app row's correctness. It follows the first three stories rather than gating them.

**Independent Test**: With a working SMTP configuration, mention a user in a comment and confirm one email arrives naming the same actor, type and target as the in-app row, sent after the comment's own transaction has committed rather than inside it.

**Acceptance Scenarios**:

1. **Given** a notification row is written, **When** its causing transaction commits, **Then** exactly one email is sent for it, never before the commit and never inside the same transaction.
2. **Given** a send succeeds, **When** it completes, **Then** the row's `emailed_at` is stamped.
3. **Given** a send fails, **When** the failure occurs, **Then** `emailed_at` stays null and the row is picked up by the retry sweep sharing R1's timer.
4. **Given** a row has failed three retries across one hour, **When** the sweep runs again, **Then** it is no longer retried, its in-app row is unchanged and still readable, and the email is abandoned.
5. **Given** SMTP is unreachable for an entire write, **When** the causing mutator runs, **Then** the write and its in-app notification row still succeed.

---

### User Story 5 - Editing or deleting content keeps notifications correct (Priority: P5)

A user edits a comment to add or remove `@mentions`, or an admin deletes a project, an issue, or a comment. Only the people newly named by an edit are notified, nobody is notified twice for the same comment, and nothing referencing deleted content is left behind.

**Why this priority**: Get this wrong and either people are spammed for an edit that renamed nobody, or a deleted issue leaves notification rows pointing at nothing — both of which are correctness bugs a user would notice immediately, but neither of which blocks the first four stories from being demonstrated.

**Independent Test**: Post a comment mentioning user A, then edit it to remove A and add user B; confirm B receives one `mention` row and A receives no withdrawal and no second row. Separately, delete an issue carrying an unread notification and confirm that notification is gone for its recipient.

**Acceptance Scenarios**:

1. **Given** an edited comment whose saved body names a user the previous body did not, **When** the edit is saved, **Then** that user receives exactly one `mention` row under the same exclusion rules as a new comment.
2. **Given** an edited comment whose saved body no longer names a user the previous body did, **When** the edit is saved, **Then** nothing is deleted or altered for that user's existing row.
3. **Given** a user already holding a `mention` row for a comment, **When** a later edit removes and then a still-later edit re-adds that same user, **Then** they receive no second row for that comment across the comment's whole life.
4. **Given** an edited comment, **When** the edit is saved, **Then** no `comment`-type row is written by the edit, whatever changed.
5. **Given** a project, an issue, or a comment carrying notification rows is deleted, **When** the delete's transaction commits, **Then** every notification row referencing it is gone for every affected recipient.
6. **Given** a comment is deleted, **When** its own cascade runs, **Then** only notifications carrying that comment's `comment_id` are removed; an unrelated `assignment` notification on the same issue survives.

### Edge Cases

- **A comment naming the same user twice in one save** writes that user one `mention` row, not two.
- **A user mentions themselves** — the actor-exclusion rule removes them from the recipient set before any row is written, so no row is ever attempted for them, and the `CHECK (user_id <> actor_id)` constraint is never the thing that stops it.
- **A cross-lane drag that drops a card back into its current assignee's lane**, or any reorder that leaves `assignee_id` unchanged, notifies nobody.
- **A drop into Unassigned** clears the assignee and notifies nobody, since there is no new assignee to tell.
- **A project comment from an admin who holds no `project_member` row for that project** notifies every listed member but not that admin, even though the admin could write the comment under `isMember`.
- **A mention naming a deactivated user** is excluded at write time, the same exclusion every picker in the app already applies.
- **A user deactivated after a notification row was already written** keeps that row; deactivation does not retroactively remove notifications already sent, in-app or by mail — it only stops new ones.
- **Deleting the issue, project, or comment a notification points at** removes that notification for every recipient, by the same cascade the owning entry's delete already runs; no stale row is ever left pointing at nothing.
- **A queued but not-yet-sent email whose target is deleted before the retry sweep runs** is never sent, because the row itself was removed by the cascade before the sweep could find it.
- **"Mark all read" run while a new notification for the same user is written concurrently** clears only the rows visible at the moment the statement runs; a row inserted after is unaffected and simply arrives unread, which is not a race to correct.
- **A `mention` and a `comment` reason coinciding on the same comment for the same person** produce one row, of type `mention`.
- **An assignee later removed from the project or deactivated** keeps any `assignment` notification already written; nothing about existing rows changes when eligibility later changes.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure and the notification record

- **FR-001**: A `notification` row MUST carry `user_id` (the recipient), `actor_id` (who caused it), `type` (exactly one of `mention`, `assignment`, `comment`), exactly one of `issue_id` or `project_id`, an optional `comment_id`, `read_at`, and `emailed_at`. No fourth type MUST exist, and status changes and activity records MUST notify nobody. (§3.6, §5, `OT-OPS-004`)
- **FR-002**: The pairing of `issue_id` / `project_id` MUST be enforced by a `CHECK` admitting exactly one, the same invariant a comment and an activity row already carry. (`OT-DATA-011`, `OT-INV-010`)
- **FR-003**: `CHECK (user_id <> actor_id)` MUST exist on the table, but MUST be a backstop only — the actor MUST already be excluded from the recipient set before any row is attempted, so this constraint is never the mechanism that stops a self-notification in ordinary operation. (`OT-OPS-005`)
- **FR-004**: A notification row MUST be readable only by the signed-in user named in its own `user_id`. This is the one row-level read rule in the whole system, and no other read anywhere in the product carries one. (`OT-AUTHZ-003`)
- **FR-005**: The table MUST follow the data-model conventions R1 established — a server-generated UUIDv7 primary key and the length and type conventions the rest of the schema uses. It carries no `updated_at` column: `read_at` and `emailed_at` are each set directly by the one operation that sets them, and no other field on a notification row is ever changed after it is written. (`AGENTS.md` → Drizzle ORM and PostgreSQL 18)

#### Recipient computation — mention

- **FR-006**: Every `@mention` token a saved comment body carries MUST produce, for each user it names, exactly one `mention` notification — on the comment's creation, and again on an edit for any user the edit newly names (FR-024). (§3.6)
- **FR-007**: The mention recipient set MUST be derived from the same tokens the comment body already stores (`@[<user_id>]`, `OT-DATA-014`), never re-parsed from rendered text or free-form `@name` matching. (§3.6, `OT-DATA-014`)

#### Recipient computation — assignment

- **FR-008**: `createIssue`, `updateIssue`, and `moveIssue` MUST each write one `assignment` notification whenever the call sets `issue.assignee_id` to a user other than the actor. This classification MUST be by the field that changed, not by which of the three mutators changed it, so the same visible event — being handed an issue — notifies identically whichever surface caused it. (§3.6, `OT-OPS-016`)
- **FR-009**: A call that leaves `assignee_id` unchanged, or that clears it, MUST write no `assignment` notification. Assigning an issue to oneself MUST be silent under the actor-exclusion rule (FR-013), not under a rule of its own. (§3.6, `OT-OPS-016`)
- **FR-010**: Each of the three mutators MUST determine whether `assignee_id` changed, and to what, from the same before/after comparison its own feature already performs for its write (`updateIssue`'s changed-field determination, `moveIssue`'s cross-lane grouping write) rather than a second, separate read. This feature MUST NOT require any of the three to add a query solely to serve this determination. (§3.6, `OT-OPS-016`)

#### Recipient computation — comment

- **FR-011**: A `comment` notification on an issue MUST go to that issue's assignee and its creator. A `comment` notification on a project MUST go to every user holding a `project_member` row for that project — a membership **list**, never the `isMember` predicate, so an admin receives one only where they were added to the project explicitly. (§3.6, `OT-OPS-014`)
- **FR-012**: `updateComment` MUST NOT write any `comment`-type row under any circumstance; the `comment` recipient set belongs to the comment's creation alone and is never revisited by an edit. (§3.6, `OT-OPS-013`)

#### Exclusions and one-row-per-comment precedence

- **FR-013**: The actor MUST be removed from every recipient set before any row is written, including a self-mention, self-assignment, or a comment the actor's own issue or project would otherwise route back to them. No user MUST ever be notified about their own action. (§3.6, `OT-OPS-004`, `OT-OPS-005`)
- **FR-014**: Every deactivated user MUST be removed from every recipient set before any row is written, so a closed account is neither written a notification row nor mailed. This applies at write time only; a row already written before a user's deactivation MUST NOT be retracted. (§3.6, `OT-OPS-015`)
- **FR-015**: One person MUST receive at most one row per comment. Where a `mention` reason and a `comment` reason would both apply to the same person for the same comment, exactly one row MUST be written, of type `mention`. (§3.6, `OT-OPS-006`)
- **FR-016**: A person already holding a row for a given comment MUST NOT receive a second one for that comment at any later point in the comment's life, including after a mention naming them is removed by one edit and then re-added by a later one. (§3.6, `OT-OPS-013`)

#### Delivery — writing the row

- **FR-017**: Every notification row MUST be written in the same database transaction as the change that caused it — the comment's creation or edit, the assignment-setting write, or the delete whose cascade reaches it. No notification row MUST be written outside the transaction of the event it describes. (`OT-DATA-009`)
- **FR-018**: Adding this recipient computation to `createIssue`, `updateIssue`, `moveIssue`, `createComment`, and `updateComment` MUST NOT introduce a second transaction into any of those mutators. Each write happens inside the transaction its owning feature already opens. (§5, `OT-DATA-008`, `OT-DATA-009`)

#### Delivery — email

- **FR-019**: The notification email MUST be sent only after the causing transaction has committed, never from inside it, so a slow or unreachable SMTP host can neither fail the write nor hold the request open. (§3.6, `OT-OPS-001`)
- **FR-020**: Exactly one email MUST be sent per notification row, immediately on the first attempt. Digests, batching, and an opt-out MUST NOT exist. (§3.6, `OT-OPS-007`)
- **FR-021**: A successful send MUST stamp `emailed_at`. A failed send MUST leave `emailed_at` null and MUST be retried by the sweep up to three times across one hour; after the third failed retry the row's in-app life MUST continue unchanged and the email MUST be abandoned — no fourth attempt, and no error surfaced to the recipient. (§3.6, `OT-OPS-002`)
- **FR-022**: The retry sweep MUST run on the single in-process interval timer entry R1 already starts for the `auth_attempt` sweep. No queue and no external scheduler MUST be introduced. (§7, `OT-OPS-003`)
- **FR-023**: An email's content MUST name the same actor, type, and target as the in-app row it corresponds to, so the two channels never disagree about what happened. (§3.6)

#### The mention diff on edit

- **FR-024**: `updateComment` MUST diff the mention set of the body being saved against the mention set of the body it replaces, and MUST write one `mention` row for each user named in the new set but not the old, under the same actor-exclusion, deactivation-exclusion, and one-row-per-comment rules as a new comment (FR-013 through FR-016). (`OT-OPS-013`)
- **FR-025**: A mention an edit removes MUST NOT delete, alter, or otherwise withdraw any row already written for it. Withdrawing a notification is not a cascade the specification lists, and this feature MUST NOT invent one. (`OT-OPS-013`)

#### Delete cascades

- **FR-026**: Deleting a project, an issue, or a comment MUST remove every notification row that references it, in the same transaction as the delete. This is the notification arm of the cascades §4 already names for `deleteProject`, `deleteIssue`, and `deleteComment`. (§4, `OT-DATA-008`)
- **FR-027**: Each cascade arm MUST attach at the database, as a foreign key from `notification.project_id`, `notification.issue_id`, or `notification.comment_id` to the row it references, declared to cascade on delete. `deleteProject`'s, `deleteIssue`'s, and `deleteComment`'s own bodies MUST NOT change to add this arm — the arm is a property of `notification`'s own table declaration, exactly as R6 fixed for `deleteIssue`'s other three arms. (§4, `AGENTS.md` → Drizzle ORM and PostgreSQL 18)
- **FR-028**: Deleting a comment MUST remove only the notification rows carrying that comment's `comment_id`. An `assignment` or a project-level `comment` notification on the same issue or project, which carries no reference to that comment, MUST survive. (§4)

#### The `/notifications` screen — reading

- **FR-029**: `/notifications` MUST be reachable only by the signed-in user reading their own rows, following FR-004's row-level rule; there is no view of another user's notifications anywhere in the product. (`OT-AUTHZ-003`, §3)
- **FR-030**: The list MUST render reverse-chronological, unread rows carrying a visible dot that is not the row's only unread signal — an unread row's difference from a read one MUST also be conveyed by something other than colour or the dot's presence alone, following the no-colour-only convention. (§3.6, `OT-UX-018`)
- **FR-031**: Each row MUST show the actor, the type in its specified wording — "mentioned you" for `mention`, "assigned you" for `assignment`, "commented" for `comment` — the issue or project the notification is about, and a relative time. (§3.6)

#### The `/notifications` screen — interaction

- **FR-032**: Clicking a row MUST navigate to the referenced issue or project. When the row carries a `comment_id`, the destination MUST be that route at the `#comment-<id>` anchor; when it does not (every `assignment` row, and a `mention` or `comment` row whose comment has since been deleted along with its notification per FR-026), the destination MUST be the plain issue or project route with no anchor. (§3.6)
- **FR-033**: Clicking a row MUST mark that row read as part of the same action, via `markNotificationRead`, so the dot is gone on the list's next render. (§3.6, §2)
- **FR-034**: "Mark all read" MUST sit in the header and MUST run exactly one `markAllNotificationsRead` call over the caller's own unread rows — never one call per row. The set it clears MUST be scoped server-side from the caller's own session, never from anything the client sends. (`OT-AUTHZ-016`, §3.6)
- **FR-035**: Both `markNotificationRead` and `markAllNotificationsRead` MUST require only that the caller is signed in, scoped to their own `user_id` alone; neither MUST accept nor need any other permission check. (§2, `OT-AUTHZ-016`)
- **FR-036**: Marking a notification read, individually or via "Mark all read," MUST be idempotent: reading an already-read row, or running "Mark all read" with nothing outstanding, MUST succeed and change nothing. (§2)

#### Sidebar unread count

- **FR-037**: The unread count entry R2 reserved beside Notifications in the sidebar MUST be populated by this feature, counting the signed-in user's own unread rows. (§3, The shell, `OT-AUTHZ-003`)
- **FR-038**: The count MUST update on the next render — the next time the server renders the shell, which any navigation or revalidation produces — and MUST NOT require a manual refresh beyond that. No live push or polling MUST be added to keep it current sooner than the next render, since real-time push is out of scope for the whole product. (`OT-UX-006`, `OT-SCOPE-005`)

### Out of Scope

Deferred by the roadmap's R11 boundary, and named here so no scenario above is read as covering them:

- **Digests, batching, and an opt-out mechanism** — none exist in v1, by explicit statement (`OT-OPS-007`). A user cannot mute a project, a type, or an actor.
- **Notifications for status changes or activity records** — activity is a log, not a channel, and generates no notification of any kind (`OT-OPS-004`).
- **Home's unread stat card, its Mentions section, and its Recent activity roll-up** — entry R12, which reads `notification` and both feeds but writes nothing. R11 delivers the table and the read boundary those sections rely on; it renders none of Home.
- **The `@mention` autocomplete UI and the comment composer itself** — entry R7. This feature consumes the mention tokens a saved comment body already carries; it does not render the composer or the popover that builds those tokens.
- **The activity feed, its rendering, and its own event types** — entry R7. Notifications and activity are separate tables serving separate purposes; this feature writes no activity row and reads none.
- **The board's drag mechanics, grouping, and `moveIssue`'s core write** — entry R10. This feature adds one recipient computation to that mutator; it does not build the drag, the grouping, or the fractional-index write itself.
- **`deleteProject`'s, `deleteIssue`'s, and `deleteComment`'s own cascades and confirmations** — entries R5, R6, and R7 respectively. This feature adds one database-level cascade arm to each; it does not change what those confirmations state or how those deletes otherwise behave, beyond each owning entry adding this arm's own count to its own confirmation, the same convention R6 already established for its cascade.
- **Rate limiting on notification-producing writes** — none is built, for the same reason R6 recorded for its own three mutators: every caller here is already authenticated and authorized, and abuse control, if it becomes real, is a change made deliberately across every mutator at once rather than one invented here for five of them.
- **A read receipt, delivery confirmation, or bounce-handling for email** — nodemailer hands off to the operator's SMTP host; this feature tracks only `emailed_at` as sent-or-not, per §3.6 and `OT-OPS-002`, and does nothing with a bounce.
- **Any new shell chrome beyond the unread count and the `/notifications` route** — the sidebar, the header, the toast conventions, the skeleton convention, and the "this doesn't exist" wording are R2's; this feature renders inside them and adds no new convention of its own.

### Key Entities

- **Notification** — one row per recipient per causing event: who it is for, who caused it, one of three types, exactly one target (an issue or a project), an optional comment it points at, and two independently-set timestamps for whether it has been read and whether it has been mailed. Never edited except to set those two timestamps; removed only by cascade from the issue, project, or comment it references.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every mention, every assignment, and every eligible comment produces exactly one notification for each eligible recipient, verified across all three mutators capable of producing an assignment notification and both mutators capable of producing a mention.
- **SC-002**: No user is ever notified about their own action — self-mention, self-assignment, or commenting on an issue or project they would otherwise be routed back to — 100% of the time.
- **SC-003**: A deactivated user receives zero new notifications, in-app or by mail, from the moment of deactivation onward, while any notification already sent to them beforehand remains intact.
- **SC-004**: Where a mention and a comment reason would both apply to the same person for the same comment, exactly one row is written, and it is always of type `mention`.
- **SC-005**: Clicking a notification lands the user on the exact comment when one exists, and on the issue or project's own page otherwise, on the first click, 100% of the time.
- **SC-006**: "Mark all read" clears every one of the caller's own unread rows in one action and changes zero rows belonging to any other user.
- **SC-007**: The sidebar's unread count matches the signed-in user's own count of unread rows on every screen render, with no count ever including another user's rows.
- **SC-008**: A successful email send is attempted after — never before or during — the transaction that wrote its notification row commits; a failed send is retried up to three times across one hour and then abandoned without altering the in-app row.
- **SC-009**: Editing a comment notifies only the users its saved body newly names; a mention removed and later re-added within the same comment's life never produces a second notification for the same person.
- **SC-010**: Deleting the issue, project, or comment a notification refers to removes that notification for every affected recipient, and no notification row is ever left referencing a deleted target.
- **SC-011**: No user can read, mark read, or otherwise act on another user's notification through any endpoint this feature exposes, verified by attempting each against another account's rows.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **Clicking a notification row marks it read as part of opening it**, rather than requiring a separate control per row. `markNotificationRead` needs a caller and the specification names no other trigger for a single-row read; a per-row "mark read" affordance beside "Mark all read" would be a second control the source never describes. **If wrong**: a small, additive change — a per-row control calling the same mutator — with no effect on `markAllNotificationsRead` or the recipient-computation requirements.
- **The email's content mirrors the in-app row** — actor, type, and target — rather than carrying a bespoke subject line or template the specification does not describe. §3.6 fixes the mechanics of sending (timing, retries, one message per notification) but not the wording. **If wrong**: a template change with no effect on any functional requirement above, since none of them constrain the email's exact copy.
- **The unread count and the notification list refresh only on the next render**, not by live push, consistent with the rest of the product having none (`OT-SCOPE-005`, `OT-OPS-009`'s board precedent). **If wrong**: a polling or push mechanism would need its own approval under Principle IV and its own roadmap entry, since none is scoped anywhere in v1.
- **`/notifications` paginates the same way both activity feeds already do** — the most recent rows first, more appended on scroll — rather than loading every notification a user has ever received in one query. §3.6 describes the list's ordering and content but not a page size; reusing the feed convention (`OT-UX-015`) keeps one pattern rather than inventing a second. **If wrong**: a page-size or infinite-scroll change with no effect on read boundary, recipient computation, or delivery — this is a rendering detail of one screen.

### Reconciliations between the roadmap and the specification

- **This feature reaches into mutators owned by four other entries, two of which have no child spec yet.** R5's `deleteProject` and R6's `createIssue`, `updateIssue`, and `deleteIssue` already carry specs this document can cite directly. R7's `createComment`, `updateComment`, and `deleteComment`, and R10's `moveIssue`, do not exist as specs yet — this document states what it needs from each as a forward contract (see *Dependencies* below), which the roadmap (§3) requires those future specs to acknowledge when they are written, not something this document can verify against code that does not exist.
- **`OT-OPS-016`'s three mutators are the complete set for assignment notifications.** The requirement names `createIssue`, `updateIssue`, and `moveIssue` explicitly (§3.6); this feature adds no fourth path, and if a later entry adds a new way to set `assignee_id`, extending this rule to it is that entry's amendment, not an automatic consequence of this spec.
- **The notification arm attaches at the database, mirroring R6's own decision for `deleteIssue`'s other three arms.** FR-027 states the same pattern R6 fixed: each later entry declares its own table's cascading reference rather than editing the deleting mutator's body. This keeps `deleteProject`, `deleteIssue`, and `deleteComment` unchanged by this feature's landing, exactly as R8's and R9's arms will also leave `deleteIssue` unchanged.
- **R11 depends directly on R10 for one reason only** — the cross-lane `moveIssue` write `OT-OPS-016` names — which is why the roadmap's dependency graph (§3) carries an `R10 → R11` edge even though the transitive reduction would otherwise let R7 reach R11 through R8 or R9 and then R10. This feature's own dependency section states that edge as a build requirement, not only a graph fact.

### Inherited constraints, not decisions this specification makes

- The shared in-process timer, `loadActor()`, and the deactivation flag notifications filter on are entry R1's; this feature adds one more job — the mail retry sweep — to a timer R1 already runs, and creates no second timer.
- The sidebar's Notifications entry and its unread-count slot are entry R2's; this feature populates the slot and builds no new shell chrome.
- `createIssue`, `updateIssue`, and `deleteIssue` are entry R6's; this feature edits the first two to add recipient computation and adds a cascade arm to the third's referenced table, without altering any acceptance scenario those specs already state.
- `deleteProject` is entry R5's; this feature adds a cascade arm to its referenced table without altering R5's own acceptance scenarios.
- The `@mention` token format (`@[<user_id>]`) and the comment table itself are conventions R7 will own; this feature depends on that format existing exactly as `OT-DATA-014` already fixes it, since it is a cross-cutting rule attributed at the data-model level rather than invented here.

### Obligations this feature places on entries built after it in this document but not yet specified

R7 and R10 do not have child specs at the time this document is written, so the obligations below are stated in the form their future authors need, the same way R6 stated obligations on R5's counter table before consuming it — except that here the entries themselves are unwritten, not merely silent on a detail.

- **R7's `createComment` must compute and write the `mention` and `comment` recipient sets FR-006 through FR-016 describe**, in the same transaction as the comment's own insert, using the mention tokens its own save already extracts. This feature does not write `createComment`'s insert; it specifies the recipient-computation code that insert's transaction must also run.
- **R7's `updateComment` must compute the mention diff FR-024 and FR-025 describe**, comparing the saved body's mention set against the body it replaces, inside the same transaction as its own update. `updateComment`'s own changed-field handling (however R7 designs it) must expose or compute this diff; this feature does not prescribe how R7 stores the prior body, only that the diff be available inside that transaction.
- **R7's `deleteComment` must leave a `comment_id` on its own row reachable for FK cascade** — meaning the comment's primary key must remain the value `notification.comment_id` references, so FR-026 through FR-028's cascade needs no code in `deleteComment` itself, only the schema-level reference FR-027 fixes.
- **R10's `moveIssue` must expose whether a cross-lane drop changed `assignee_id` and to what**, inside the same transaction as its own write, so FR-008 through FR-010's recipient computation can run without a second read. This feature does not prescribe `moveIssue`'s grouping logic, only that this one fact be available where the assignment write happens.
- **When R7's and R10's own child specs are written, each must state that this feature (R11) reaches back into the mutators named above**, per the roadmap's own instruction (§3). If either arrives in a materially different shape than assumed here — comments split across two tables, `moveIssue` computing its diff outside the write's own transaction — this feature follows the shape that exists and the divergence is recorded as an amendment to this document, the same policy R6 recorded for its own four contracts on R5.

### Dependencies

**Cannot be built without** — this feature has no code path that works until each has landed:

- **R1** — the shared in-process timer this feature's retry sweep joins, `loadActor()`'s resolution of the actor on every request, and the `deactivated_at` column every recipient set filters on.
- **R2** — the authenticated shell `/notifications` renders inside, the sidebar's Notifications entry and unread-count slot, the header's per-screen control slot "Mark all read" occupies, and the toast, skeleton, and "this doesn't exist" conventions this feature reuses without redefining.
- **R5** — `deleteProject`, whose cascade this feature attaches a notification arm to.
- **R6** — `createIssue`, `updateIssue`, and `deleteIssue`, into which this feature writes assignment recipient computation and a delete cascade arm respectively; and the issue record `assignee_id` lives on.
- **R7** — `createComment`, `updateComment`, `deleteComment`, the `comment` table, and the `@[<user_id>]` mention-token format `OT-DATA-014` fixes, none of which exist yet. This feature has no mention or issue-comment or project-comment notification path until R7 lands.
- **R10** — `moveIssue`, into which this feature writes the third assignment-notification path. This feature's assignment coverage is incomplete without it, and the roadmap's `R10 → R11` edge exists for exactly this reason.

**Consumed but not blocking**:

- **R3** and **R4** — this feature reads the `deactivated_at` flag R1's `user` table carries and excludes on it, but depends on no module either entry delivers; accounts existing or profiles being editable is not a precondition for a notification row to be written or read correctly.
- **R8** and **R9** — labels and column edits notify nobody (`OT-OPS-004`'s status-change silence extends to both), so neither is a dependency of this feature in either direction.

**Building this feature before R6, R7, or R10 land** is not a supported ordering: there is no `assignee_id` to notify on without R6, no comment or mention token to notify on without R7, and one of the three assignment-writing paths is simply absent without R10.

**Dependency approval this feature triggers**: none. `nodemailer` is already an approved dependency (`AGENTS.md` → Technology constraints) for exactly this purpose, and no new package is needed for recipient computation, the retry sweep, or the `/notifications` screen.

**Downstream reach-back**: R12 reads `notification` for Home's unread stat card, Mentions section, and Recent activity roll-up, writing nothing and adding no mutator; it is the one entry that consumes this feature's table without this feature needing to anticipate its shape beyond the read boundary FR-004 already fixes.
