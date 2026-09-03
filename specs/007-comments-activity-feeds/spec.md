# Feature Specification: Comments and activity feeds

**Feature Branch**: `claude/r7-feature-specifications-c07340`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R7**

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "create a feature specifications for roadmap entry R7, refer to @docs/ROADMAP.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R7** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member posts a comment where anyone can read it (Priority: P1)

A member of a project types a plain-text message into the composer at the head of an issue's feed or a project's feed and posts it. The comment appears at the top of the stream immediately, carrying their name, avatar and the time, and every signed-in user — member or not — can read it the moment it lands.

**Why this priority**: A comment is the one piece of this feature a user writes directly, and it is what "people can talk in" (the roadmap's own words for this entry) means concretely. Nothing else here — the toggle, the collapsing, the mention autocomplete — has anything to operate on until a comment exists, and the `comment` and `activity` tables this story creates are what every other story in this feature, and R8 through R11 after it, is built on.

**Independent Test**: Sign in as a member of a project holding one issue and no comments, open that issue, post a plain-text comment from the composer, and confirm it renders at the top of the feed with the author's name and avatar and a relative time, that a second signed-in user — including a non-member — sees the identical comment on reload, and that the same sequence succeeds on that issue's project details page. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** a member of a project on an issue's feed, **When** they type a message and post it, **Then** exactly one comment is created, it renders at the top of the stream immediately, and it carries their name, their avatar and a relative time.
2. **Given** a member of a project on that project's own details feed, **When** they post a comment, **Then** it is created against the project rather than any issue, and renders at the top of that project's feed only.
3. **Given** a comment just posted, **When** any other signed-in user — including one who is not a member of the project — opens the same feed, **Then** they see the identical comment.
4. **Given** a member on either composer, **When** they submit an empty or whitespace-only message, **Then** nothing is posted and the composer reports the missing text inline.
5. **Given** a member on either composer, **When** they type a message of exactly 10 000 characters, **Then** it posts; one character more is refused on the field with an inline error naming the bound, and the server refuses it independently of the client's check.
6. **Given** a signed-in non-member on an issue or a project they do not belong to, **When** they look at the composer, **Then** it is visible, not editable, and carries an inline reason naming the project.
7. **Given** a member who bypasses the disabled composer and calls the write path directly on a project they do not belong to, **When** the call reaches the server, **Then** it is refused independently of the disabled control.
8. **Given** a comment posted on an issue, **When** the feed renders it, **Then** its row carries an `id` attribute of `comment-<id>` that a browser can navigate straight to.

---

### User Story 2 - Every change to a project or an issue writes its own history (Priority: P2)

Nobody has to remember to log anything. The moment a member creates a project, renames it, changes a date, adds or removes someone from its roster, archives or reopens it — or creates an issue, edits its title or description, moves it to another column, reassigns it, changes its priority or its due date — that action is already sitting in the feed, worded as a sentence, the instant the page that made the change finishes saving.

**Why this priority**: This is the "activity" half of the entry's name, and it is silent infrastructure rather than a control anyone operates directly — which is exactly why it ranks second rather than first: a feed with no comments in it is still a feed, but a feed that never records anything a member actually did would be read as broken the first time anyone looked. It is what makes R5's and R6's mutators, shipped before this feature existed, retroactively honest about their own history.

**Independent Test**: With a project holding no activity, rename it, add a member to it, archive it and reopen it, and confirm four rows appear on its feed in that order, each naming the actor and the change. Separately, create an issue, change its column and reassign it, and confirm three rows — one `created` and two `field_changed` — appear on that issue's own feed and nowhere else.

**Acceptance Scenarios**:

1. **Given** an admin who creates a project with two starting members, **When** the create succeeds, **Then** the project's feed opens with one `created` row and two `member_added` rows, one per member, all timestamped together.
2. **Given** a member who renames a project, **When** the save lands, **Then** one row appears naming the actor, the field and the old and new name.
3. **Given** an admin who archives a project and later reopens it, **When** each save lands, **Then** one row records the archive and a second, later row records the reopen, and neither carries a from/to pair.
4. **Given** an admin who removes a member from a project's roster, **When** the removal completes, **Then** one row names the actor and the removed member's display name, and that name keeps rendering even after the removed person is later deactivated.
5. **Given** a member who creates an issue with a priority and an assignee already set, **When** the create succeeds, **Then** the issue's feed carries exactly one `created` row and no `field_changed` row for either initial value.
6. **Given** a member who edits an issue's title and, moments later, drags it to a new column via its rail control, **When** each save lands, **Then** two separate rows appear, one naming the title's old and new value and one naming the column's old and new name.
7. **Given** a member who saves an issue edit that leaves every field's value identical to what is stored, **When** the call completes, **Then** no row is written, matching the mutator's own no-op rule.
8. **Given** an issue whose description is edited from a 500-character value to an 800-character one, **When** the row is written, **Then** its `from_value` and `to_value` are each truncated to 200 characters rather than holding the field in full.
9. **Given** a project's colour changed from grey to blue, **When** the row renders, **Then** it names the palette colours "grey" and "blue" rather than their hex values.
10. **Given** an issue's feed and its project's feed both open, **When** an issue is edited, **Then** the row appears on the issue's own feed only, never on the project's.

---

### User Story 3 - An author manages their own words; an admin removes anyone's (Priority: P3)

The person who wrote a comment can fix a typo or take it back entirely, at any time, whether or not they still belong to the project it was posted in. An admin can remove any comment that needs to go. Nobody else can touch either.

**Why this priority**: Editing and deleting extend what Story 1 already delivers rather than introducing a new surface, and a comment nobody can ever correct or retract is usable in the meantime — which is why this ranks below posting and below the automatic history that makes the feed worth reading at all.

**Independent Test**: As the author of a comment, edit its text and confirm the change is visible immediately; delete it and confirm it and only it disappears from the feed. As a different member, confirm no edit or delete control renders on someone else's comment. As an admin who authored nothing there, confirm a delete control renders on every comment and works.

**Acceptance Scenarios**:

1. **Given** the author of a comment, **When** they open it for editing, change the text and save, **Then** exactly one `updateComment` call runs, the new text renders immediately, and no new feed row is written — the comment row itself is the entry.
2. **Given** the author editing a comment, **When** they press Escape, **Then** the field reverts to the saved text and nothing is written.
3. **Given** any user who did not author a comment, including an admin, **When** they look at it, **Then** no edit control renders on it.
4. **Given** the author of a comment who has since been removed from the project it was posted in, **When** they open that comment, **Then** they can still edit and delete it, because authorship, not membership, governs both rights.
5. **Given** the author of a comment, **When** they delete it, **Then** the comment and its own feed row disappear together and every other row on that feed is untouched.
6. **Given** an admin who did not author a comment, **When** they delete it, **Then** it is removed the same way a self-delete removes it.
7. **Given** a member who is neither the author nor an admin, **When** they look at someone else's comment, **Then** no delete control renders on it, and a direct call to delete it is refused by the server.
8. **Given** an author who submits an edit reducing the comment to only whitespace, **When** they try to save, **Then** the save is refused inline and the comment keeps its previous text.

---

### User Story 4 - Someone is named in a comment, and finds themselves while typing (Priority: P4)

While composing a comment, a member types `@` followed by a few letters of a name, sees a ranked list of people appear, and picks one. The comment stores who was named and, whenever anyone reads it later — including after that person changes their own name — shows the name they currently go by.

**Why this priority**: A mention is a refinement of the same composer Story 1 already built, valuable but not load-bearing the way posting or the automatic history are — a comment that names someone by typing their name out is still a working comment.

**Independent Test**: On a project holding two members, one admin and one unrelated signed-in user, type `@` and a fragment of each person's name into the composer and confirm the members and the admin rank above the unrelated user and that a deactivated account never appears. Pick a suggestion, post the comment, rename that person, and confirm the comment now shows their new name.

**Acceptance Scenarios**:

1. **Given** a member typing `@` followed by letters in the composer, **When** the letters match more than one person, **Then** the list ranks that project's members and every admin above everyone else, and a deactivated account never appears regardless of match.
2. **Given** a member who picks a suggestion, **When** the comment is posted, **Then** the stored body carries a mention token for that person and the rendered comment shows their display name.
3. **Given** a posted comment naming someone by mention, **When** that person's first or last name is later changed, **Then** the comment's rendering of the mention updates to the new name without the comment itself being edited.
4. **Given** a member typing `@` with no letters following it, **When** the list opens, **Then** it offers every eligible person ranked the same way, rather than staying empty until a letter is typed.
5. **Given** a member on an issue whose project holds no other members, **When** they type `@`, **Then** the list still offers every admin and every other signed-in user, ranked with admins first.

---

### User Story 5 - A long history stays readable (Priority: P5)

On a project or an issue that has accumulated months of comments and changes, a reader can narrow the stream to comments only, watch a burst of quick edits by one person fold into a single expandable line, and keep scrolling without the page ever loading the whole history at once.

**Why this priority**: These are conveniences that matter once a feed is long, not conditions for a feed to work at all — a short feed reads fine without any of the three, which is why this ranks last, the same reasoning R6 gave for ranking its own lifecycle story last.

**Independent Test**: On a feed seeded with more than 50 rows including a run of five field changes by one actor inside one minute, confirm the run renders as one expandable line, confirm the Comments only toggle hides every non-comment row and that its state is remembered on the other feed too, and confirm scrolling to the foot of the loaded rows appends the next 50 without a full reload.

**Acceptance Scenarios**:

1. **Given** a feed holding five field-changed rows from the same actor inside one minute, **When** it renders, **Then** they collapse into one line reading that the actor made five changes, expandable to the individual rows.
2. **Given** two comments posted by the same actor two minutes apart, **When** the feed renders, **Then** they render as two separate rows, never collapsed into one.
3. **Given** a reader who switches a feed to Comments only, **When** they open a different feed — an issue's after switching a project's, or the reverse — **Then** it opens already filtered to Comments only, because the choice is remembered per user across both.
4. **Given** a feed holding 73 rows, **When** it first renders, **Then** the 50 most recent are loaded and scrolling to the foot appends the remaining 23 without navigating away from the page.
5. **Given** the Comments only filter active, **When** a reader scrolls to the foot of what is loaded, **Then** the next page still draws from all rows, filtered client-side to comments, so filtering never starves the page of rows to append.

### Edge Cases

- **A comment posted on an issue in a project the poster then leaves** stays exactly where it is; only their ability to comment again in that project changes, not what they already wrote.
- **Two members editing different comments on the same feed at the same moment** never interact — each `updateComment` targets one comment by id and touches nothing else.
- **A comment deleted by its author while an admin's delete request for the same comment is in flight** resolves to one delete succeeding and the other finding no row left to act on, reported as "this doesn't exist" rather than a second success.
- **A project or issue deleted while its feed is open** takes every comment and activity row on it down in the same cascade; nothing here reverses that or notices it beyond the parent's own delete already being one transaction.
- **A `field_changed` row whose new value is empty** — a due date or an assignee cleared — renders its `to_value` as the literal string `"None"`, per FR-030, rather than a blank cell.
- **A rename of a board column or a user does not rewrite history**: every frozen `from_value` and `to_value` already written keeps the name it was written with, even though a live mention token in a comment body would show the new one.
- **A member typing a mention for someone who is deactivated between the keystroke and the post** cannot select them — the list is re-read live and a deactivated account is never offered — but a mention token already stored for someone later deactivated keeps rendering their name.
- **An `updateProject` or `updateIssue` call that changes more than one field in a single request** — not exercised by either screen's own UI, which saves one field per call — still writes one `field_changed` row per field that differs from what was stored, because the activity writer reads the same changed-field set the mutator itself computes rather than assuming exactly one entry.
- **A comment body holding only an `@` mention and nothing else** is legal; the token itself is the entire trimmed content and posts like any other message.
- **Collapsing spans a page boundary**: a run of changes by one actor that continues across the 50-row page's edge collapses only within what is currently loaded and re-collapses correctly once the next page is appended, per FR-062.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure — the comment and activity tables

No user journey observes these directly. Each is verified against the schema and the queries that read it — a column's type, bound and constraint by inspecting the migration the change generates, and a constraint by asserting that the database itself refuses the violating write.

- **FR-001**: A `comment` table MUST exist, carrying an author, a plain-text body bounded at 10 000 characters, and exactly one of an issue reference or a project reference, enforced by a `CHECK` on the pair. Both references MUST cascade on delete of the row they point to. (`OT-DATA-011`, `OT-DATA-003`, `OT-INV-010`)
- **FR-002**: An `activity` table MUST exist, carrying an actor, a `type`, exactly one of an issue reference or a project reference enforced by a `CHECK` on the pair, a nullable `field`, nullable `from_value` and `to_value` bounded at 200 characters each, and a nullable `comment_id` reference used only by rows of type `comment`. Both the issue and project references MUST cascade on delete of the row they point to, and the `comment_id` reference MUST cascade on delete of the comment it points to. (`OT-DATA-011`, `OT-DATA-003`, `OT-INV-010`)
- **FR-003**: The `activity` table MUST carry no `updated_at` column and no mutator this feature delivers MUST update a row after it is written; the only way an activity row disappears MUST be the cascade from its own comment, or from the issue or project it belongs to. (`OT-AUTHZ-009`, `OT-INV-011`)
- **FR-004**: `activity.type` MUST be constrained by a `CHECK` naming exactly the values this feature writes — `created`, `field_changed`, `member_added`, `member_removed`, `archived`, `reopened`, `comment` — and no other. Entries R8 and R9 each widen this same `CHECK` with their own migration when they land, adding `label_added` / `label_removed` and the five `column_*` values respectively, following the pattern the specification itself names for this column: widening a `CHECK` is an ordinary transactional migration. This feature MUST NOT pre-declare a value no mutator it delivers ever writes. (§5, `AGENTS.md` → Drizzle ORM and PostgreSQL 18)
- **FR-005**: Both tables MUST follow the conventions entry R1 established — server-generated UUIDv7 primary keys, `text` with a `CHECK` for the `type` enumeration, a timezone-aware type for `created_at`, and every free-text column length-bounded by a `CHECK` as FR-001 and FR-002 state. `comment.updated_at` MUST be written explicitly through the shared `touched()` helper on every update; `activity` carries no such column to write. (`OT-DATA-001`, `OT-DATA-002`, `OT-DATA-003`)
- **FR-006**: `user` MUST gain a `feed_filter` column, `text` constrained to `comments` or `all`, defaulting to `all`, added to the existing table by this feature's migration — entry R1 created `user` without it and entry R4 named it as deferred here. Every existing row MUST take the default; no backfill beyond the column default MUST be performed. (§5, `OT-UX-014`)
- **FR-007**: `activity.from_value` and `activity.to_value` MUST hold display strings frozen at the moment the row is written and MUST NOT be re-resolved from the field's live value on read, so a later rename of a column, a user or a label leaves every row already written exactly as it read at the time. (`OT-DATA-010`)
- **FR-008**: A frozen `from_value` or `to_value` derived from a field whose own bound exceeds 200 characters — an issue or project description — MUST be truncated to 200 characters when the row is written, independently of the field's own 10 000-character bound. (`OT-DATA-010`)
- **FR-009**: A colour named in a `from_value` or `to_value` MUST be the palette name — "grey", "blue", "amber", "green", "red", "violet" or "accent" — never the hex value, matching the convention the specification fixes for a board column's own recolour event. (§5, `OT-DATA-013`)
- **FR-010**: `comment.body` MUST be plain text and MUST support no markdown, matching the same convention a profile bio takes. A mention token MUST be the one structured element the body may carry, in the form `@[<user_id>]`. (`OT-DATA-016`, `OT-DATA-014`)

#### The activity-writing primitive

- **FR-011**: This feature MUST deliver one internal function, callable only from within an already-open database transaction, that writes a single `activity` row from a type, a target (issue or project), an actor, and the optional field/from/to/comment values FR-002 defines. Every mutator this feature edits or delivers MUST write its activity rows through that one function rather than each assembling its own `INSERT`. It MUST accept any value FR-004's `CHECK` admits at the time it runs, so entries R8 and R9 call it directly for their own types once their migrations widen that `CHECK`, without editing this function. (Principle I)
- **FR-012**: Building one shared function here, before a second feature exists to call it, MUST NOT be read as speculative under Principle I: by the time this feature lands it already has no fewer than eight call sites of its own — `createComment` (FR-045), `createProject` (FR-050), `updateProject` (FR-051, one call per differing field), `setProjectStatus` (FR-052), `addProjectMember` and `removeProjectMember` (FR-053), `createIssue` (FR-055) and `updateIssue` (FR-056, one call per differing field) — so the precondition — a pattern proven at a real second caller — is met inside this feature alone, well past Principle I's two-call-site bar, before R8 or R9 are considered at all. (Principle I)
- **FR-013**: The function FR-011 defines MUST NOT itself open or commit a transaction, MUST NOT itself perform authorization, and MUST NOT itself compute which fields changed; every caller supplies an already-open transaction, has already authorized the write, and has already determined what to log. Its only responsibility MUST be inserting the one row it is given. (Principle III)

#### Authorization and the write boundary

- **FR-014**: Every signed-in user MUST be able to read every comment and every activity row on every project and every issue. Membership MUST NOT be used as a visibility boundary anywhere in this feature. (`OT-AUTHZ-002`)
- **FR-015**: `createComment` MUST require `isMember` of the affected project — for a comment on an issue, the project the stored issue belongs to; for a comment on a project, that project itself — derived server-side from the stored row, never from a client-supplied project identifier. (§2, `OT-AUTHZ-004`)
- **FR-016**: `updateComment` MUST require that the caller is the comment's own author, and MUST require nothing else — not current project membership, not `isAdmin`. `deleteComment` MUST require that the caller is the comment's own author **or** `isAdmin`, and likewise MUST NOT require current project membership. Nobody MUST be able to edit a comment they did not author, whatever role they hold. Authorship is fixed permanently at the comment's creation and MUST NOT be re-evaluated against membership at any later point — losing membership does not remove either right, and later re-joining the project MUST NOT change either right, since neither predicate ever reads current membership in the first place. (`OT-AUTHZ-008`)
- **FR-017**: Content authored by a user later removed from the project or deactivated MUST survive unchanged, and their display name MUST keep rendering on every comment and every activity row it already appeared on. (`OT-AUTHZ-014`)
- **FR-018**: No activity row MUST ever be editable or deletable by any mutator this feature delivers, admins included; its only removal MUST be the cascade FR-002 declares. (`OT-AUTHZ-009`, `OT-INV-011`)
- **FR-019**: Every mutator this feature delivers MUST resolve the row or rows its predicate needs first, refuse a caller it cannot find that row for as a missing row rather than as a refusal — since `OT-AUTHZ-002` and FR-014 make every comment and every activity row's parent readable by every signed-in user — and only then evaluate its predicate. The client MAY run the same predicates to disable controls; the server check MUST be the enforcement. (`OT-AUTHZ-005`, `OT-UX-004`)
- **FR-020**: A user who loses the write access a comment control depended on — losing project membership while composing, though never authorship of what they already wrote — MUST have that control become disabled on the next render, and the server MUST refuse a write attempted from a stale page independently of the control's state. (`OT-AUTHZ-012`)
- **FR-021**: Every composer and every edit or delete control this feature renders for a user who may not use it MUST render disabled with an inline reason naming the project, never as a dead control and never hidden. (`OT-UX-002`)

#### The mention token

- **FR-022**: A mention MUST be stored in `comment.body` as `@[<user_id>]` and MUST be rendered, on every read, as that user's current display name — first and last name joined with a space — resolved at read time rather than frozen, so a rename is reflected on every comment that already names them. This is the opposite rule from FR-007's frozen activity strings, and both MUST hold simultaneously without either implementation touching the other. (`OT-DATA-014`, `OT-UX-019`)
- **FR-023**: A rendered mention MUST be visually distinguishable from surrounding plain text. Resolving a mention token MUST NOT depend on the referenced user's `deactivated_at` value — a deactivated user's name keeps rendering wherever their mention already appears, matching FR-017. (`OT-AUTHZ-014`)
- **FR-024**: The autocomplete list a `@` keystroke opens MUST rank that issue's or project's own members and every admin first and every other signed-in user after, and MUST exclude every deactivated account regardless of rank, re-read live on each keystroke rather than cached from when the composer opened. (`OT-AUTHZ-007`)
- **FR-025**: The mention picker MUST be built from React Aria's `Popover` and `ListBox` rather than any other component, matching the one named exception the frontend rules carry for exactly this control. (§7, `OT-UX-018`)

#### The shared feed component

- **FR-026**: One feed component MUST render both an issue's Activity section (§3.4) and a project's Activity section (§3.8); this feature MUST NOT build two separate implementations. Building it as one component from its first commit MUST NOT be read as speculative under Principle I: both call sites are real and concurrent within this same feature, which is the precondition Principle I asks for, not an anticipated future one. (§1.1, Principle I)
- **FR-027**: The feed MUST render as one reverse-chronological stream interleaving comment rows and activity rows, newest first, with no tabs inside the stream and a composer fixed at its head. (`OT-UX-013`)
- **FR-028**: A comment row MUST show the author's avatar and display name, its live body with every mention token resolved per FR-022, and a relative time. It MUST carry an edit control when the viewer is its author and a delete control when the viewer is its author or an admin, and MUST carry neither control for anyone else. Every other row — every activity row — MUST render as fixed text with no edit or delete control for anyone, admins included. (`OT-UX-013`, §3.8)
- **FR-029**: Every comment row MUST carry an `id` attribute of the literal form `comment-<id>`, present in the rendered markup whether or not anything currently links to it, so a browser navigating to a URL carrying that fragment scrolls to the row natively with no additional script. (§3.6, roadmap R7 scope)
- **FR-030**: A `field_changed` row MUST render as one sentence naming the actor and the field that changed, and, where the type carries them, the frozen `from_value` and `to_value` — for example "Ana moved this from Todo to In Progress", the specification's own wording for a column change. A `to_value` or `from_value` that is null — a due date or an assignee cleared — MUST render as the literal string `"None"` rather than as a blank, since no other document fixes this wording and this feature is its first writer. A `created`, `archived`, `reopened`, `member_added` or `member_removed` row MUST render as one sentence naming the actor and, for the latter two, the frozen member name, with no from/to pair implied where the type carries none. (§3.4, §3.8, `OT-DATA-010`)
- **FR-031**: Consecutive rows of a non-`comment` type by the same actor collapse into one run, and one run MUST render as one expandable line reading the actor and the count, per the specification's own example ("Ana made 3 changes"). A row extends the current run when its timestamp is no more than five minutes — inclusive — after the immediately preceding row already in that run, not after the run's first row, so a steady drip of changes spaced under five minutes apart keeps chaining into one run indefinitely rather than being cut off five minutes after it started; a gap of more than five minutes since the preceding row starts a new run instead. A `comment` row MUST NOT collapse with any other row, comment or otherwise, whatever its timing — a message a person wrote stands on its own — and always ends whatever run precedes it without joining it. (`OT-UX-015`)
- **FR-032**: The feed MUST load its 50 most recent rows on open and MUST append the next 50 on scrolling to the foot of what is loaded, counting rows before FR-031's collapsing is applied, so the page size is a property of what is fetched rather than of what a given reader's collapsing happens to produce. (`OT-UX-015`)
- **FR-033**: The feed MUST offer a Comments only / All activity toggle. Comments only MUST show comment rows alone; All activity MUST show every row. The choice MUST persist in `user.feed_filter` and MUST apply to both an issue's feed and a project's feed for that user, so switching one switches the other on its next open. (`OT-UX-014`)
- **FR-034**: This feature MUST deliver one mutator, requiring only the caller's own identity — the same "requires only self" category §2 already places `updateOwnProfile` and `markNotificationRead` in — that sets the caller's `user.feed_filter`. It MUST be called whenever the toggle changes on either feed and MUST NOT be exposed as a Profile field, matching entry R4's deferral of this column to this feature. (§2, §5)
- **FR-035**: A non-member's composer MUST render in place, disabled, carrying an inline reason naming the project — never hidden — on both an issue's feed and a project's feed. (`OT-UX-002`, `OT-UX-021`)
- **FR-036**: The feed MUST NOT poll or re-query on any interval; a row written by another user's action appears to a given reader only on that reader's next navigation to or revalidation of the screen, matching `OT-UX-006`'s stale-after-navigation rule and the specification's scoping of periodic re-query to the board alone. (`OT-UX-006`, `OT-OPS-008`'s scope)
- **FR-037**: Posting a comment MUST apply optimistically — the new row appears before the server has answered — and MUST roll back if the server refuses it, removing the optimistic row and showing a toast whose text is the exact message the server's typed result returned (for example, the field-bound or authorization message FR-041 or FR-049 already fixes), never a generic fallback string invented on the client, matching the treatment every other small, local write in the product already takes. (`OT-UX-008`)
- **FR-038**: Every state on the feed a colour alone would otherwise convey — a comment's controls, a collapsed line's expand affordance — MUST carry a text or shape equivalent, and every control on the feed MUST carry an accessible name and a visible focus indicator. (`OT-UX-018`)

#### The comment composer

- **FR-039**: The composer MUST accept plain text only, MUST support the `@` mention gesture FR-024 defines, and MUST post on ⌘-enter, matching the save gesture every other in-place editor in the product already uses. (§3.4, §3.8)
- **FR-040**: A submitted body MUST be trimmed and MUST be required after trimming; an empty or whitespace-only submission MUST be refused inline and MUST issue no `createComment` call. (§3.4, §3.8)
- **FR-041**: A body exceeding 10 000 characters MUST be refused on the field with an inline error naming the bound; it MUST NOT be truncated, and the server MUST reject an over-length value independently of whatever the client checked. (`OT-DATA-003`)
- **FR-042**: The composer MUST grow with its content, matching the same convention a description or a bio field already takes. (§3.4, §3.8, §3.12)
- **FR-043**: An in-place comment edit MUST follow the same click-to-edit gesture the rest of the product uses: activating the body turns it into a field, Escape reverts, and ⌘-enter saves, with exactly one `updateComment` call per save. It MUST NOT open a separate modal or a separate page. (§3.4, §3.8, `OT-UX-009`'s pattern)
- **FR-044**: A comment delete MUST require one explicit confirming action beyond the press that starts it: pressing the delete control MUST swap it in place for an inline Confirm / Cancel pair rather than deleting immediately, and only a press of Confirm MUST call `deleteComment`; a press of Cancel, or moving focus away, MUST revert to the original delete control with nothing deleted. This MUST NOT open the modal-with-a-count convention the heavier admin deletes use, since a single comment's own removal reaches nothing beyond itself. (§4, Principle III)

#### `createComment`, `updateComment`, `deleteComment`

- **FR-045**: `createComment` MUST write the comment row and exactly one `activity` row of type `comment`, carrying that comment's id in `comment_id` and no `field`, `from_value` or `to_value`, in one database transaction, through the writer FR-011 defines. (`OT-DATA-009`, §5)
- **FR-046**: `createComment` MUST accept exactly one target — an issue id or a project id — and MUST derive the project its `isMember` check runs against from that target, per FR-015. (§2, `OT-INV-010`)
- **FR-047**: `updateComment` MUST accept only the comment's new body, MUST update `comment.body` and `updated_at` through the shared `touched()` helper, and MUST write no `activity` row — the comment row already is the feed's entry for it, read live on every render rather than snapshotted. (§2, §4)
- **FR-048**: `deleteComment` MUST hard-delete the comment row. Its own `activity` row of type `comment` MUST be removed by the database cascade FR-002 declares on `comment_id`, not by a second statement this mutator issues. (`OT-DATA-007`, §4)
- **FR-049**: Every field-bound and authorization rule this feature states for a comment MUST be enforced by the server independently of whatever the client's own copy of the same rule decided, per the general boundary `OT-AUTHZ-005` fixes for every mutator in the product. (`OT-AUTHZ-005`)

#### Activity writing added to entry R5's mutators

- **FR-050**: `createProject` MUST write, in the same transaction as the project and its seeded rows, one `created` activity row naming the actor, followed by one `member_added` activity row per membership row the same call writes — one per chip on the create form — each carrying that member's display name frozen at write time in `to_value`. No `field_changed` row MUST be written for any value set at creation; a value set at creation is not a change from a prior state. (`OT-DATA-009`, `OT-DATA-020`, §3.7)
- **FR-051**: `updateProject` MUST, within its own transaction and after determining which of its five fields differ from the stored row, write one `field_changed` activity row per differing field, each naming that field with the literal `field` value `name`, `description`, `start_date`, `target_date` or `colour` — matching the column it changed — and its frozen old and new display values per FR-007 through FR-009. A call whose named values all match the stored row MUST write no row, matching the mutator's own no-op behaviour. (`OT-DATA-009`, `OT-DATA-010`)
- **FR-052**: `setProjectStatus` MUST write one activity row of type `archived` when the transition sets `archived`, or `reopened` when it sets `active`, carrying no `field`, `from_value` or `to_value` — the type alone carries the transition. (`OT-DATA-009`, §5)
- **FR-053**: `addProjectMember` MUST write one `member_added` activity row per call, carrying the added member's display name frozen at write time in `to_value`. `removeProjectMember` MUST write one `member_removed` activity row per call, carrying the removed member's display name frozen at write time in `from_value`. Both MUST leave `field` unused, per the specification's own convention for these two types. (`OT-DATA-009`, `OT-DATA-020`, §5, `OT-AUTHZ-013`)
- **FR-054**: None of the four writes FR-050 through FR-053 add MUST alter what its mutator already returns to the caller, what row it already writes to `project` or `project_member`, or any acceptance scenario or success criterion entry R5's own specification states; each is an addition inside an existing transaction, not a rewrite of the mutator's prior behaviour. This MUST be verified by running entry R5's own existing test suite, unmodified, against this feature's diff and observing every test still pass — a new test covering this feature's own activity-row assertions is additive, never a replacement for or edit to R5's own tests. (Roadmap §3)

#### Activity writing added to entry R6's mutators

- **FR-055**: `createIssue` MUST write, in the same transaction as the issue itself, exactly one `created` activity row naming the actor. No `field_changed` row MUST be written for any optional value — column, priority, assignee or due date — set at creation. (`OT-DATA-009`, §3.5)
- **FR-056**: `updateIssue` MUST, within its own transaction and using the changed-field set it already computes for its own no-op rule, write one `field_changed` activity row per field among title, description, column, priority, assignee and due date that differs from the stored row, each naming that field with the literal `field` value `title`, `description`, `column`, `priority`, `assignee` or `due_date` — matching the column it changed — and its frozen old and new display values per FR-007 through FR-009 — a column or an assignee's `from_value`/`to_value` being that column's or that person's name, not an id. A call whose named values all match the stored row MUST write no row. (`OT-DATA-009`, `OT-DATA-010`, §3.4)
- **FR-057**: Neither addition MUST alter what its mutator already returns to the caller, what row it already writes to `issue`, or any acceptance scenario or success criterion entry R6's own specification states. This MUST be verified the same way FR-054 fixes for R5: entry R6's own existing test suite MUST still pass unmodified against this feature's diff. (Roadmap §3)
- **FR-058**: `deleteIssue`'s existing cascade MUST reach this feature's tables through the database references FR-001 and FR-002 declare — a comment's `issue_id` and an activity row's `issue_id` — rather than through any change to `deleteIssue`'s own body, matching the attachment convention entry R6 already fixed for every later entry's cascade arm. `deleteProject`'s cascade MUST reach `comment.project_id` and `activity.project_id` the same way. (§4, entry R6's FR-059)

#### The project header's comment count

- **FR-059**: Project details' header MUST show the count of comment rows attached to that project directly — `comment.project_id` equal to that project — read live on every render. It MUST NOT count comments attached to any issue inside the project, matching the specification's own distinction between a project's feed and a roll-up of its issues' feeds. (§3, The shell; §3.8)

#### Loading, focus and accessibility

- **FR-060**: The feed MUST show a skeleton matching its own layout while its first page loads, applying the convention entry R2 fixed and did not implement, rather than a full-screen spinner, and the skeleton MUST sit below the page's own authorization decision so a refused or missing route answers as itself. (`OT-UX-005`)
- **FR-061**: Every reason this feature attaches to a disabled composer or a disabled control MUST be associated with that control programmatically, so it reaches assistive technology as the control's own explanation. (`OT-UX-018`, `AGENTS.md` → React Aria Components)

#### Pagination and composer edge cases

- **FR-062**: Collapsing (FR-031) MUST be computed only over rows currently loaded on the client, never across a page boundary not yet fetched: a run in progress at the foot of the currently loaded rows MUST render as a run closed at whatever count is loaded so far, and MUST re-run the same collapsing computation over the combined row set once the next page is appended, extending that run — or starting a fresh one, if the gap or the actor differs — rather than leaving the boundary as two separate collapsed lines that a full re-collapse would have merged.
- **FR-063**: If the composer is submitted (⌘-enter) or cancelled (Escape) while the `@` mention picker (FR-024, FR-025) is open and showing suggestions, the first Escape MUST close the picker alone, leaving the composer's own text and cursor position untouched and requiring a second Escape to revert the field per FR-043; ⌘-enter MUST submit the composer's text exactly as typed, MUST NOT implicitly select whichever suggestion is currently highlighted, and MUST close the picker as a consequence of the submit rather than requiring it to be dismissed first.

### Out of Scope

Deferred by the roadmap's R7 boundary, and named here so no scenario above is read as covering them:

- **Every notification a comment, a mention or an edited mention causes**, including the `mention` rows an edit newly names — entry R11, which lands with the notification table itself and adds the diff logic `OT-OPS-013` requires to `updateComment`. This feature computes no recipient set and sends no mail.
- **The `notification` arm of `deleteComment`'s §4 cascade** — entry R11. This feature's `deleteComment` cascades this feature's own tables only.
- **Label activity — `label_added` and `label_removed`** — entry R8, which widens `activity.type`'s `CHECK` to add both values when it lands, per FR-004.
- **Column activity — the five `column_*` types** — entry R9, which widens the same `CHECK` and calls the writer FR-011 establishes; this feature writes none of the five and enforces none of `OT-INV-005`, `-006`, `-012` or `-014`, which stay `deleteColumn`'s.
- **Home's cross-project roll-up of Recent activity and Mentions** — entry R12, which reads both feeds' rows across every project rather than one feed at a time.
- **The board card's own comment count** — entry R10, which renders the card face.
- **Real-time push, live collaboration, or any polling refresh of a feed while it is open** — out of scope for v1 entirely; a feed re-queries only on navigation, per FR-036. (`OT-SCOPE-005`)
- **Rate limiting or abuse control on the three comment mutators** — none is built, matching R6's reasoning for its own three mutators: every caller here is already authenticated and authorized against a project, and R1's throttle stays scoped to the two authentication flows.
- **Performance and responsiveness targets** — none are stated, and none are invented; what this feature fixes instead is that a comment post shows its result without waiting for the server (FR-037) and that the feed paginates rather than loading its whole history at once (FR-032), which are behavioural requirements rather than timing ones.

### Key Entities

- **Comment** — one plain-text message attached to exactly one issue or one project, carrying its author, a body up to 10 000 characters that may hold `@[<user_id>]` mention tokens, and its own timestamps. Editable by its author alone; deletable by its author or any admin. Its own feed row is itself, read live rather than mirrored into a frozen record.
- **Activity row** — one append-only entry in the same feed as a project's or an issue's comments, naming an actor, a type, and, for types that carry one, a field and a from/to pair frozen as display strings at the moment it was written. Never edited after it is written; removed only when the comment, issue or project it belongs to is removed.
- **Mention token** — `@[<user_id>]` stored inside a comment's body, resolved to that user's current display name on every read, the one place in this feature where a name is read live rather than frozen.
- **Feed filter** — one per-user preference, `comments` or `all`, stored on `user` and shared by every feed that user opens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can post a comment and see it rendered — author, avatar, text and time — before the page does anything else, on both an issue's feed and a project's feed.
- **SC-002**: A comment posted by one user is visible to every other signed-in user, member or not, on their very next view of that feed — no comment is ever visible to its author alone.
- **SC-003**: Every write R5 or R6 already ships — creating, editing or deleting a project's record, its status or its roster; creating or editing an issue — produces exactly the activity rows this feature specifies for it, with zero rows produced for a call that changes nothing.
- **SC-004**: No activity row's `from_value` or `to_value` ever exceeds 200 characters, whatever the length of the field it was frozen from.
- **SC-005**: An activity row's wording never changes after it is written, even when the column, user or label it names is later renamed — verified by renaming each and re-reading a row written before the rename.
- **SC-006**: A mention's rendered name always matches the mentioned user's current display name, verified by renaming a mentioned user and re-reading a comment written before the rename — the opposite outcome from SC-005, and both hold at once.
- **SC-007**: Only a comment's author, or an admin, can ever change or remove it; every other caller is refused on 100% of attempts, including one that bypasses the disabled control entirely.
- **SC-008**: A feed holding more than 50 rows never loads more than 50 on first render, and scrolling to the foot of what is loaded always appends the next page without a full navigation.
- **SC-009**: The Comments only / All activity choice made on one feed is already in effect the next time that same user opens any feed, on the very first render, with no flash of the other state.
- **SC-010**: A run of same-actor, non-comment rows within five minutes of each other always collapses into one line; a comment is never folded into a collapsed line, whatever its timing relative to its neighbours.
- **SC-011**: Every control this feature renders that a given user may not use is visible, disabled, and carries a reason reachable by assistive technology — no control is dead and none is hidden for a permission reason other than the two navigation exceptions entry R2 already fixes.
- **SC-012**: A comment or a body exceeding its length bound is refused on the field with a message naming the bound, on 100% of attempts, and the server refuses it even when a client-side check is bypassed.
- **SC-013**: Deleting a project or an issue leaves no comment and no activity row behind that referenced it, verified against the database directly rather than only through the screens that read it.
- **SC-014**: A comment's own row disappears the moment it is deleted and no other row on the same feed changes.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

Each names what is assumed, why, and what it would cost to be wrong.

- **`activity.type`'s `CHECK` is widened incrementally by each entry that needs a new value, rather than declared complete by this feature.** The specification's §5 lists all fourteen values in one sentence describing the product's eventual schema, but entry R6 already established the precedent of a later entry altering an earlier entry's table only when it needs the capability (its own uniqueness constraint on `board_column`), and the same section notes that widening a `CHECK` is an ordinary migration. Declaring all fourteen now would leave five and two values this feature never writes sitting in the constraint with nothing behind them. **If wrong** — if the constraint was meant to be complete from this feature onward — R8 and R9 each still add nothing but a migration widening the same column; no code this feature writes changes.
- **`field_changed`'s `field` names the literal column being changed** — `title`, `description`, `column`, `priority`, `assignee`, `due_date` on an issue; `name`, `description`, `start_date`, `target_date`, `colour` on a project — rather than a grouped label such as "dates" for either date field. §5's own enumeration of field names groups the two project dates together in one parenthetical, but every date field is independently editable and independently changeable in one call, so a shared label would make one row ambiguous about which date it describes. **If wrong**: renaming the value stored in `field` for the two date fields, with no schema or behavioural change elsewhere.
- **A colour named in a `from_value` or `to_value` is the palette name, for a project exactly as the specification already fixes for a board column.** §5 states the column rule explicitly and groups "colour" with the other project fields in the same `field_changed` enumeration without restating the rule; reading the two as one convention avoids a project's colour history reading as a hex code nobody chose to type. **If wrong**: a rendering change only, since the raw hex is still recoverable from the palette table by name.
- **Editing a comment reuses the product's existing click-to-edit gesture rather than opening a distinct control.** The specification names an "edit" control on a comment row (§3.8) without describing its interaction, and every other editable field in the product already uses one convention (`OT-UX-009`); a second gesture invented for comments alone would be the only inconsistency of its kind. **If wrong**: a UI change only, with no effect on `updateComment`'s contract.
- **A comment delete confirms once, inline, without the count-and-modal convention the heavier admin deletes use.** §3.10's label delete and R6's issue delete both confirm with a size because their cascades reach other rows a user might not expect; a comment's own delete reaches only its own activity row, a cascade this feature's own author already sees in full on the screen. **If wrong**: a modal is a UI addition with no schema or mutator change behind it.
- **Five-minute collapsing applies to non-comment rows only.** §3.4 and §3.8 both illustrate collapsing with "Ana made 3 changes," a phrase that does not describe a message someone wrote; folding two comments into one line would hide text a reader came to read. **If wrong**: broadening FR-031 to include comments is a rendering change, not a data change — nothing about what is stored differs either way.
- **The 50-row page counts rows before collapsing, not after.** Counting post-collapse lines would make the page size depend on how bursty a given stretch of history happens to be, so two feeds with the same row count could load visibly different amounts of history. **If wrong**: a pagination-boundary change only.
- **No feed re-queries on an interval while open.** `OT-OPS-008`'s periodic re-query is stated for the board specifically, and the specification names no equivalent for either feed; building one here would be inventing a requirement the source does not state, and every write in this feature already applies optimistically for the writer's own view of it. **If wrong**: an additive UX change, not a correction to any mutator here.
- **No backfill of activity rows for a project or an issue that existed before this feature's migration runs.** The tables this feature introduces hold no data that predates them, matching R5's own recorded assumption about its own new tables; a project renamed under R5 alone simply has a feed that opens later than its own creation. **If wrong**: a one-time data migration, not a change to any mutator here.

### Reconciliations between the roadmap and the specification

- **This feature edits, rather than merely calls, seven mutators entries R5 and R6 already shipped.** The roadmap states plainly that "R7 adds activity writing to the project and issue mutators delivered in R5 and R6," and both child specs recorded the same reach-back in their own *Reconciliations* sections before this feature existed. FR-050 through FR-058 are the shape those additions take, fixed here rather than left to this feature's plan, and FR-054 and FR-057 are the guardrail that the reach-back is additive: nothing this feature does may change what R5's or R6's own acceptance scenarios and success criteria already promised.
- **One feed component is built for two call sites that exist inside this same feature, which is why Principle I does not treat it as speculative.** R6's markdown renderer waited for a second feature (R6 itself) to call R5's first implementation before it was extracted; this feature has no equivalent waiting period, because both the issue feed and the project feed are call sites this feature delivers at once. The roadmap's own §1.1 names this exact case as the reason R7, unlike R6's renderer, ships one component from its first commit.
- **The activity-writing primitive is likewise not speculative**, on the same principle applied to a narrower case: it is called from this feature's own three comment mutators and its seven edits into R5 and R6 before either R8 or R9 exist, which is a proven pattern at more than the two call sites Principle I asks for, entirely inside this feature.
- **`user.feed_filter` is a column this feature adds to a table entry R1 created and entry R4 read from without exposing.** R4's own specification named the column and deferred it here explicitly; this feature is where its default, its constraint and its one writer (FR-034) are fixed.

### Inherited constraints, not decisions this specification makes

- The data-model conventions — UUIDv7 keys, `text` with `CHECK` for enumerations, explicit `updated_at` through one helper, the length bounds, and the `publicUser` projection every user reference reads — were established by entry R1 and are inherited rather than chosen here.
- The shell that hosts these feeds, the Forbidden screen, the "this doesn't exist" convention, the toast conventions, the per-screen skeletons and the disabled-control-with-inline-reason convention are entry R2's; this feature renders inside them.
- The project and the issue each feed attaches to, their `isMember` predicates, and the display names every row and every mention reads are entries R5 and R6's; this feature creates neither a project nor an issue.
- The deactivation flag every mention list and every ranked group excludes on is entry R1's column, administered through entry R3's screen; this feature reads it and closes no account.
- `@` mention autocomplete is the one control in the product built outside React Aria's own component set, per the single named exception in `AGENTS.md` → React Aria Components, because a mention token lives inside `comment.body` in a way no description field's markdown ever does.
- The uniqueness, cascade and pair-identity rules this feature's own tables carry are enforced by the database rather than by application code, so their tests run against a real PostgreSQL instance on a separate database rather than a mock.

### Dependencies

- **Roadmap position**: R7 depends directly on R5 (the project mutators it edits and the project record its feed attaches to) and R6 (the issue mutators it edits and the issue record its feed attaches to), and transitively on R1 and R2. R3 is not a precondition beyond the `deactivated_at` column R1's own table already carries: this feature reads that flag to exclude deactivated accounts from every mention list and ranked group, but needs none of R3's own screens, so it does not carry the same blocking weight as R2. Entries R8 through R12 all consume what this feature delivers: R8 and R9 call the writer FR-011 establishes and widen `activity.type`'s `CHECK`; R10 reads the comment count this feature's table makes possible for its own card face; R11 reaches back into this feature's `createComment` and `updateComment` exactly as this feature reaches back into R5's and R6's; R12 reads both feeds' rows for its cross-project roll-up.
- **Consumed from earlier entries**: the actor resolved on every request and the `isAdmin` / `isMember` predicates (R1, R5, R6); the shell, the Forbidden screen and the cross-cutting UX conventions this feature's feed and composer reuse rather than redefine (R2); the deactivation flag every ranked list excludes on (R1, administered by R3); the project and issue records, their mutators, and the display names both already establish (R5, R6).
- **Downstream reach-back**: R8 adds the label-applied and label-removed activity types and calls this feature's writer for both; R9 adds the five column-lifecycle types the same way; R11 adds recipient computation to this feature's `createComment` and the mention diff to `updateComment`, and adds the `notification` arm to `deleteComment`'s cascade; R12 reads this feature's rows across every project for Home's roll-up rather than one feed at a time.
