# Feature Specification: Home roll-up

**Feature Branch**: `claude/r11-feature-specs-973239`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R12**

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "create a feature specifications for roadmap entry R12, refer to @docs/ROADMAP.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R12** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

**A note on this entry's shape.** R12 is the roadmap's last entry and its only one with zero mutators: every requirement below is a read, a filter, or a formula, never a write. It depends on R7, R10, and R11 (§2). R11 now has a child spec — [`specs/007-notifications-and-email/`](../007-notifications-and-email/) — so this document cites it directly. **R7 and R10 still have no child spec** at the time this document is written; where this spec states what it needs from either, that is a forward contract those specs must satisfy when they are written, the same convention R11's own spec used for these same two entries.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A user opens Home and sees an accurate snapshot at a glance (Priority: P1)

Any signed-in user signs in, or navigates to `/home`, and sees a greeting addressed to them and three stat cards — how many issues are assigned to them, how many of those are due this week, and how many notifications sit unread — each reading the true count for their own account.

**Why this priority**: This is the page every session opens on. If the numbers on it are wrong, every other section on the page is read with the same suspicion, and the page fails at the one thing it exists to do — answer "what is mine" correctly and instantly.

**Independent Test**: Give one account four open issues assigned to it, two of them due within the next week, and three unread notifications, with no other data touching that account. Sign in and confirm the assigned-to-you card reads 4, due-this-week reads 2, and unread reads 3.

**Acceptance Scenarios**:

1. **Given** a signed-in user with issues assigned to them, **When** they open `/home`, **Then** the assigned-to-you stat card reads the count of their own open-kind issues, across every project, whether or not they are currently a member of it.
2. **Given** a signed-in user with unread notifications, **When** they open `/home`, **Then** the unread stat card matches the same count the sidebar's own unread badge shows.
3. **Given** an issue assigned to the viewer with a due date within the next seven days, including today, **When** `/home` renders, **Then** it counts toward the due-this-week card.
4. **Given** an issue assigned to the viewer with a due date already past, **When** `/home` renders, **Then** it also counts toward the due-this-week card, since overdue work is still due.
5. **Given** two different signed-in users open `/home` at the same moment, **When** each renders, **Then** each sees only their own counts, never the other's.
6. **Given** an issue is later moved into a `done`- or `canceled`-kind column, **When** the viewer it was assigned to next opens `/home`, **Then** it no longer counts toward either stat card.

---

### User Story 2 - A user sees their own open work and their projects' progress (Priority: P2)

Below the stat cards, the same user sees a list of the issues assigned to them and a list of the active projects they belong to, each carrying a progress figure, without navigating anywhere else.

**Why this priority**: The stat cards answer "how many"; this section answers "which ones" — the natural next question, and the reason a user opens Home instead of going straight to a project.

**Independent Test**: With three open issues assigned to the viewer across two different projects, and the viewer a member of one active and one archived project, open `/home` and confirm all three issues are listed, only the active project is listed, and its progress figure matches an independent count of that project's `done`-kind issues over its non-`canceled`-kind total.

**Acceptance Scenarios**:

1. **Given** the viewer holds open-kind issues assigned to them, **When** `/home` renders, **Then** Assigned to you lists every one of them, each identifiable by its key, title, and project.
2. **Given** the viewer is a member of an active project, **When** `/home` renders, **Then** Your projects lists it with its name, its status, and its progress figure.
3. **Given** the viewer is a member of an archived project, **When** `/home` renders, **Then** Your projects does not list it.
4. **Given** a project with no issues, or with every issue in a `canceled`-kind column, **When** its progress figure is computed, **Then** it reads 0%, never an error or an undefined value.
5. **Given** a project with ten issues, four of them in a `done`-kind column and two in a `canceled`-kind column, **When** its progress figure is computed, **Then** it reads 4 / (10 − 2) = 50%.
6. **Given** the viewer clicks an Assigned to you row, **When** the navigation completes, **Then** they land on that issue's own detail page.
7. **Given** an admin who holds no explicit `project_member` row anywhere, **When** they open `/home`, **Then** Your projects is empty for them, the same way every other membership list in the app treats an admin who was never added.

---

### User Story 3 - A user catches up on mentions without leaving Home (Priority: P3)

The same user scrolls to a Mentions section and sees their five most recent `@mentions`, whether already read or not, without visiting the dedicated Notifications page.

**Why this priority**: It is one of the two sections that reads the notification table R11 delivers, and it is explicitly a convenience — a full read happens on `/notifications` — so it matters less than seeing one's own work but still delivers real value on its own.

**Independent Test**: Mention the viewer in six different comments across two projects, mark the oldest three read, and confirm Home's Mentions section shows exactly the five most recent, in order, both read and unread ones included, with the sixth-oldest omitted.

**Acceptance Scenarios**:

1. **Given** the viewer holds more than five `mention` notifications, **When** `/home` renders, **Then** Mentions shows exactly the five most recent, newest first.
2. **Given** a mention already marked read, **When** it is among the five most recent, **Then** it still appears, indistinguishable in eligibility from an unread one.
3. **Given** an unread mention among the five, **When** it renders, **Then** it carries the same unread dot the Notifications page gives it.
4. **Given** the viewer clicks a Mentions row that carries a `comment_id`, **When** the navigation completes, **Then** they land on the issue's or project's page at that comment's own anchor.
5. **Given** the viewer clicks a Mentions row, **When** the click is handled, **Then** the notification's read state is unchanged afterward — Home never calls the mutator that would mark it read.

---

### User Story 4 - A user sees a pulse of activity across the whole installation (Priority: P4)

The same user scrolls further and sees the twenty most recent activity rows from every project and every issue in the installation, not only the ones they belong to.

**Why this priority**: It is the one section on Home that is identical for every signed-in user regardless of membership, since everyone reads everything. It is last because it answers "what is everyone else doing," the least personal of Home's four questions.

**Independent Test**: As a user who is a member of no projects at all, open `/home` and confirm Recent activity still shows the twenty most recent rows from across the installation, identical to what a project admin sees at the same moment.

**Acceptance Scenarios**:

1. **Given** activity exists across several projects and issues, **When** `/home` renders, **Then** Recent activity shows the twenty most recent rows across all of them, newest first.
2. **Given** a row is a comment, **When** it appears in Recent activity, **Then** it is presented the same way a system-generated row is — one interleaved stream, not two.
3. **Given** the viewer belongs to none of the projects a row references, **When** `/home` renders, **Then** the row still appears, since activity is readable by everyone.
4. **Given** two different signed-in users open `/home` at the same moment, **When** each renders, **Then** both see the same twenty rows, unlike the stat cards and the two lists above them.

---

### User Story 5 - Home never has anything to break, write, or hide (Priority: P5)

A brand-new account with no assignments, no memberships, and no mentions opens Home and sees a coherent, quiet page rather than an error, a blank screen, or a hidden section — and nothing the page offers ever writes to the database.

**Why this priority**: Every prior story assumed data exists; this is what confirms the page holds together when it doesn't, and confirms the one invariant that makes Home safe to build last and touch nothing upstream: it never mutates anything.

**Independent Test**: Sign in as a freshly invited account with zero assignments, zero project memberships, and zero mentions, in an installation that otherwise has activity elsewhere. Confirm the greeting and stat cards render with zero counts, Assigned to you, Your projects, and Mentions each show one quiet line, and Recent activity still shows the installation's real rows.

**Acceptance Scenarios**:

1. **Given** a viewer with no issues assigned to them, **When** `/home` renders, **Then** Assigned to you shows one quiet line and the assigned-to-you and due-this-week cards both read zero.
2. **Given** a viewer who belongs to no active project, **When** `/home` renders, **Then** Your projects shows one quiet line.
3. **Given** a viewer with no `mention` notifications, **When** `/home` renders, **Then** Mentions shows one quiet line.
4. **Given** an installation with no activity anywhere yet, **When** `/home` renders, **Then** Recent activity shows one quiet line, the same convention every other empty surface in the app uses.
5. **Given** any control or row on `/home`, **When** it is inspected for what it does, **Then** every one of them either navigates or renders — none of them issues a write, and in particular clicking a Mentions row never calls `markNotificationRead`.
6. **Given** a user revisits `/home` after data has changed elsewhere, **When** they navigate back to it, **Then** the page re-queries the server rather than rendering anything from a client cache.

### Edge Cases

- **An issue assigned to the viewer in a project they have since been removed from** still appears in Assigned to you and still counts toward both stat cards — assignment survives a membership change, the same state R6 names an assigned non-member.
- **An issue qualifying for both the assigned-to-you and the due-this-week cards** is counted in both; the two cards measure overlapping sets by design; this is not double-counting to correct.
- **A mention whose comment or issue has since been deleted** never appears in Mentions, because the cascade R11 already runs removes the notification row before this feature's query ever sees it.
- **A user who is never assigned anything and belongs to nothing** still sees a fully populated Mentions section and a fully populated Recent activity section, since neither depends on assignment or membership.
- **An admin with no explicit `project_member` row** sees an empty Your projects section despite being able to write in every project, consistent with how every other membership list in the app already treats an admin who was never added.
- **A project moved from active to archived** disappears from Your projects on the viewer's next visit, without the project itself being touched by this feature.
- **A due date of exactly today** counts toward due-this-week; so does a due date several months in the past — both are "due," and neither is excluded for being early or late.
- **A `comment`-type activity row and a `field_changed` row from the same actor within five minutes** each still appear as their own row in Recent activity — the five-minute collapsing convention belongs to the issue's and project's own feeds and is not restated here for this cross-project roll-up.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure and access

- **FR-001**: `/home` MUST be reachable by any signed-in user and MUST render inside R2's shell without the header — no title block, no per-screen control, no New issue button — the one exception `OT-UX-001` names for the whole app. (§3.2, `OT-UX-001`)
- **FR-002**: This feature MUST introduce no mutator of any kind. Every control this feature renders MUST either navigate to another route or do nothing; none MUST issue a write. (§3.2, roadmap R12: "Home reads only, and cannot mark a notification read")
- **FR-003**: Sections drawn from data any signed-in user may already read — Assigned to you, Your projects, Recent activity — MUST apply no additional visibility restriction beyond the filters FR-009, FR-013, and FR-023 state; nothing on this page is hidden for a permission reason. (`OT-AUTHZ-002`)
- **FR-004**: Sections drawn from the `notification` table — the unread stat card and Mentions — MUST be scoped to the viewer's own `user_id`, following the one row-level read rule in the system. (`OT-AUTHZ-003`)

#### Stat cards

- **FR-005**: The assigned-to-you stat card MUST count the viewer's own issues that sit in an `open`-kind column, across every project, whether or not the viewer currently holds a membership row in it. (§3.2)
- **FR-006**: The due-this-week stat card MUST count the same set FR-005 defines, further filtered to a due date within the rolling seven-day window from today through six days ahead, inclusive, compared in the server's own timezone, and MUST also count any due date already in the past. An issue with no due date MUST NOT count toward this card. (§3.2, `OT-DATA-004`)
- **FR-007**: The unread stat card MUST count the viewer's own unread notification rows, using the identical read boundary and count [`specs/007-notifications-and-email/spec.md`](../007-notifications-and-email/spec.md) (FR-004, FR-037) already defines for the sidebar's own badge, so the two numbers never disagree. (§3.2, `OT-AUTHZ-003`)
- **FR-008**: The greeting MUST address the viewer using their own display name, following the app-wide display-name convention. (§3.2, `OT-UX-019`)

#### Assigned to you

- **FR-009**: Assigned to you MUST list every issue assigned to the viewer that sits in an `open`-kind column, across every project regardless of the viewer's current membership in it, with no page size limit. (§3.2)
- **FR-010**: Each row MUST carry enough identity to open the issue directly — at minimum its key, its title, and the project it belongs to. (§3.2, `OT-UX-010`)
- **FR-011**: Clicking a row MUST navigate to that issue's own detail page and MUST issue no write. (§3.2)
- **FR-012**: An empty Assigned to you section MUST render as one quiet line, following the app-wide empty-surface convention, never an illustration. (`OT-UX-007`)

#### Your projects

- **FR-013**: Your projects MUST list every project with `status = 'active'` for which the viewer holds a `project_member` row, reading that row the same way every other membership **list** in the app does — never the `isMember` predicate — so an admin appears in this list only where they were added explicitly. An archived project MUST NOT appear regardless of membership. (§3.2, `OT-AUTHZ-006`)
- **FR-014**: Each row MUST show the project's name, its status, and its progress figure. (§3.2)
- **FR-015**: A project's progress figure MUST be computed as the count of its issues sitting in a `done`-kind column divided by the count of its issues **not** sitting in a `canceled`-kind column. When that denominator is zero — a project with no issues, or none outside its `canceled`-kind columns — the figure MUST read 0% rather than an error or an undefined value. (§3.2)
- **FR-016**: The list MUST be ordered alphabetically by name, following the same convention the sidebar's own project list already uses. (`OT-UX-020`)
- **FR-017**: An empty Your projects section MUST render as one quiet line. (`OT-UX-007`)

#### Mentions

- **FR-018**: Mentions MUST show the viewer's five most recent `mention`-type notifications, newest first, whether read or unread. (§3.2)
- **FR-019**: Mentions MUST be read from the `notification` table directly — the same rows R11's recipient computation already wrote and filtered — and MUST NOT be re-derived by scanning `@[<user_id>]` tokens in `comment.body`, which would be a second, driftable implementation of the same rule and would bypass the table's own index. (§3.2, `OT-DATA-014`)
- **FR-020**: An unread row among the five MUST carry the same unread indicator the Notifications page gives it. (§3.2)
- **FR-021**: Clicking a Mentions row MUST navigate the same way a row on `/notifications` does — to the referenced issue or project, at the `#comment-<id>` anchor when the row carries one — but MUST NOT call `markNotificationRead` or otherwise change that row's read state. Reading it on Home MUST NOT be treated as reading it. (§3.2, roadmap R12)
- **FR-022**: An empty Mentions section MUST render as one quiet line. (`OT-UX-007`)

#### Recent activity

- **FR-023**: Recent activity MUST show the twenty most recent rows from the `activity` table across every project and every issue in the installation, newest first, with no filter by the viewer's own membership or assignment — this is the one section on Home that renders identically for every signed-in user at the same moment. (§3.2, `OT-AUTHZ-002`)
- **FR-024**: A `comment`-type activity row MUST appear in this stream on the same footing as a system-generated row, interleaved rather than separated, mirroring how each owning feed already presents its own rows. (§3.2, `OT-UX-013`)
- **FR-025**: Each row MUST carry the same actor, verb, and from → to information its owning issue or project feed already renders for it, sourced from the same frozen display strings the `activity` table stores rather than a second rendering rule invented for this page. (§5, `OT-DATA-010`)
- **FR-026**: An empty Recent activity section MUST render as one quiet line. (`OT-UX-007`)

#### Cross-cutting

- **FR-027**: `/home` MUST show a per-screen loading skeleton matching its own layout while its data loads, never a full-screen spinner, and data landing MUST NOT shift the layout. (`OT-UX-005`)
- **FR-028**: Revisiting `/home` MUST re-query the server; nothing on the page MUST render from a client cache. (`OT-UX-006`)
- **FR-029**: No state on this page MUST be conveyed by colour alone — the unread dot in Mentions MUST carry the same non-colour signal `OT-UX-018`'s convention already gives it wherever else it appears. (`OT-UX-018`)

### Out of Scope

Deferred by the roadmap's R12 boundary, and named here so no scenario above is read as covering them:

- **Any write, on this page or reachable from it** — no mutator is built, `markNotificationRead` and `markAllNotificationsRead` included; clicking a Mentions row here never marks it read, unlike the same click on `/notifications`.
- **The `/notifications` page itself, its "Mark all read" control, and the sidebar's unread badge** — entry R11, which this feature reads from but does not modify. `specs/007-notifications-and-email/spec.md` owns all three.
- **The `@mention` composer, the comment feed, and the activity feed's own rendering, toggle, and pagination** — entry R7, which does not yet have a child spec. This feature reads the `activity` table R7 will deliver; it renders no composer and offers no Comments-only / All-activity toggle of its own.
- **The board, drag-and-drop, and `moveIssue`** — entry R10, which does not yet have a child spec. This feature reads `issue.column_id` and `board_column.kind`, both already fixed by R5's and R6's schema; it calls nothing R10 owns and renders no board.
- **Column editing and the `done`- / `canceled`-kind invariants' enforcement** — entry R9. This feature reads `board_column.kind` without enforcing `OT-INV-014` (a project always has at least one `done`-kind column), which stays `deleteColumn`'s.
- **Search, filtering, or sorting controls on any of Home's four lists** — none is described in the source; Assigned to you and Recent activity are fixed by recency or by the underlying query, Your projects is fixed alphabetically, and Mentions is fixed by recency.
- **A dedicated "view all" link off any section into a fuller list** — the source names no such control; a user who wants more opens the issue list, the project, or `/notifications` directly by existing navigation.

### Key Entities

This feature introduces no new table and no new mutator. It reads, without modifying:

- **Issue** (R6) — `assignee_id`, `due_date`, and `column_id`, filtered to the viewer for Assigned to you and both stat cards.
- **Project** and **Board column** (R5) — `status`, `name`, and `board_column.kind`, read for Your projects and its progress figure.
- **Project member** (R5) — the membership rows Your projects lists.
- **Notification** (R11, [`specs/007-notifications-and-email/`](../007-notifications-and-email/)) — read for the unread stat card and Mentions, through the read boundary that spec already fixes.
- **Activity** (R7, not yet specified) — read for Recent activity, across every project and issue without restriction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every one of Home's three stat cards matches an independent count of the viewer's own data, 100% of the time, for every signed-in account.
- **SC-002**: A project with no issues, or with every issue in a `canceled`-kind column, always shows exactly 0% progress, never an error or a blank figure.
- **SC-003**: Assigned to you and Your projects reflect only the viewer's own assignments and memberships; two accounts viewing Home at the same moment can see different content in these two sections and never see each other's.
- **SC-004**: Mentions shows exactly the five most recent `mention` notifications for the viewer, read and unread both counted toward eligibility, with never more than five shown.
- **SC-005**: Recent activity shows exactly the twenty most recent activity rows across the whole installation, identical for every signed-in user at the same moment regardless of their own memberships.
- **SC-006**: Clicking a Mentions row on Home never changes that notification's read state; only an action on `/notifications` does.
- **SC-007**: Home issues zero write requests under any interaction the page offers, verified across every control it renders.
- **SC-008**: Each of Home's four list sections renders exactly one quiet line, and no illustration, when it has nothing to show — verified independently for each of the four.
- **SC-009**: A change made elsewhere in the app — a new assignment, a project archived, a new mention, a new activity row — is reflected on Home the next time a user navigates to it, with no stale value surviving from an earlier visit.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **Assigned to you and Your projects carry no page-size cap**, unlike Mentions (five) and Recent activity (twenty), which the source states explicitly. The absence of a stated cap for the other two is read as deliberate: a team under twenty people keeps both bounded naturally, and the source names a limit everywhere it intends one. **If wrong**: a cap and a "view more" affordance would need to be added to two sections — an additive change with no effect on any other requirement above.
- **Assigned to you, and both stat cards derived from it, exclude issues in a `done`- or `canceled`-kind column.** The source calls the section "Assigned to you" without stating a status filter, but a widget answering "what needs my attention" that never drops completed work would only grow, which none of Home's other sections do. This reading is also what makes FR-005's and FR-015's figures tell two different, non-redundant stories about the same underlying data. **If wrong**: a one-line filter removal, with no effect on Your projects' progress formula, which already reads `done`- and `canceled`-kind columns independently and is unaffected either way.
- **"Due this week" is a rolling seven-day window — today through six days ahead, inclusive — rather than a calendar week with an unstated start day (Monday or Sunday).** The source never states a week-start convention anywhere in the product, and `OT-DATA-004` requires only that the comparison mean the same thing for everyone, which a rolling window in the server's own timezone already satisfies without inventing a locale-specific boundary. **If wrong**: a bounded change to one query's date range, with no effect on any other card or section.
- **Overdue issues count toward "due this week"** rather than being excluded as a separate, unbuilt "overdue" concept. R6's own specification notes that "overdue is a state the product reads elsewhere" without naming where; this card is the only place in the product that reads a due date in aggregate, making it the natural elsewhere. **If wrong**: a one-line date-range change, isolated to FR-006.
- **The greeting's exact wording is not fixed beyond addressing the viewer by display name** — the source names the section only as "greeting" with no copy. **If wrong**: a copy change with no functional consequence, since no acceptance scenario or success criterion above depends on its exact text.
- **Recent activity's rows reuse the same rendering shape the issue and project feeds already use** — actor, verb, from → to, relative time — rather than a second format invented for this roll-up. Reusing rather than reinventing keeps one presentation of an `activity` row rather than two that could drift, in the same spirit as Principle I's rule against speculative duplication. **If wrong**: a presentation-only change, with no effect on FR-023's row count or FR-024's interleaving requirement.

### Reconciliations between the roadmap and the specification

- **This is the only entry in the roadmap with zero mutators.** Every other child spec states write rules, transactions, and authorization on writes; this one has none, and its Requirements section is a set of read filters and one formula instead.
- **R12 can cite R11 directly, unlike R11's own citations of R7 and R10.** R11's child spec now exists at [`specs/007-notifications-and-email/`](../007-notifications-and-email/), so FR-007 and FR-019 above reference its actual functional requirements rather than stating a forward contract. R7 and R10 remain unspecified, so this document's obligations on them (below) follow the same forward-contract pattern R11's own spec used for these same two entries.
- **R12's dependency on R10 is not a call into any code R10 owns.** The roadmap lists R10 among R12's direct dependencies, but nothing in this feature invokes `moveIssue` or reads a table R10 itself defines — `issue.column_id` and `board_column.kind` are R5's and R6's schema. R10 is what lets an issue actually reach a `done`- or `canceled`-kind column through ordinary use (a drag), which is what makes FR-015's progress formula and its zero-denominator rule meaningfully exercised rather than only reachable through direct writes. The invariant guaranteeing at least one `done`- and one `canceled`-kind column per project (`OT-INV-014`) is R9's, reached transitively because R10 already depends on R9 directly.
- **R12 introduces no notification-marking behaviour of its own**, deliberately diverging from `/notifications`' click-to-read convention (R11's FR-033). The roadmap states this explicitly — "Home reads only, and cannot mark a notification read" — so FR-021 above is not an oversight relative to R11's own pattern but a stated boundary between the two screens.

### Inherited constraints, not decisions this specification makes

- The `/home` route, the shell it renders inside, the header's one stated exception for this route, and every cross-cutting convention this feature reuses — the skeleton, the quiet-line empty state, and re-query-on-revisit — are entry R2's.
- `issue.assignee_id`, `issue.due_date`, and `issue.column_id` are entry R6's schema; `project.status`, `project_member`, and `board_column.kind` are entry R5's. This feature reads all of them and changes none.
- The `notification` table, its read boundary, and the unread-count query are entry R11's, specified in full at [`specs/007-notifications-and-email/spec.md`](../007-notifications-and-email/spec.md).
- The display-name convention, `loadActor()`, and the deactivation flag are entry R1's.

### Obligations this feature places on entries built after it in this document but not yet specified

R7 and R10 do not have child specs at the time this document is written. The obligations below are stated in the form their future authors need, the same pattern R11's own spec used for these same two entries.

- **R7's `activity` table must be queryable across every project and issue at once**, without a per-project or per-issue filter baked into its own access pattern, so FR-023's cross-installation read is a plain query rather than a fan-out over every project. This feature does not prescribe how R7 stores or indexes the table, only that a query shaped this way be possible against it.
- **R7's activity rows must carry enough frozen, self-contained display information — actor, verb, `field`, `from_value`/`to_value` — to render on Home without a second query back to `comment`, `issue`, or `project`.** `OT-DATA-010` already requires this freezing for the owning feeds' own sake; FR-025 depends on that same guarantee holding for a row read here instead of there.
- **R10 owes this feature nothing directly** — no query, no exposed function, no shared code. The only obligation R10's eventual spec carries toward this one is acknowledging, per the roadmap's own instruction (§3), that R12 reads schema `board_column.kind` and `issue.column_id` govern, and that R10's own work (letting a card actually move between kinds) is what makes this feature's progress figure meaningfully exercised in normal use — not a code dependency, but worth stating so a future reader of R10's spec is not surprised to find R12 citing it.
- **When R7's and R10's own child specs are written, each should state that R12 reads the tables and invariants named above**, matching the roadmap's requirement that a later slice's reach-back be acknowledged by the entry it touches — here, a read dependency rather than an edit to a mutator, which is what distinguishes this obligation from the ones R11's own spec placed on the same two entries.

### Dependencies

**Cannot be built without** — this feature has no code path that works until each has landed:

- **R1** — `loadActor()`'s resolution of the actor on every request and the app-wide display-name convention the greeting uses.
- **R2** — the `/home` route itself, the shell it renders inside, the one stated exception to the header rule, and the skeleton, empty-line, and re-query conventions this feature reuses without redefining.
- **R5** — `project`, `project_member`, and `board_column`, whose `status`, membership rows, and `kind` values Your projects and its progress figure read.
- **R6** — `issue`, whose `assignee_id`, `due_date`, and `column_id` fields drive Assigned to you and both stat cards.
- **R7** — the `activity` table Recent activity reads, which does not exist yet. This feature has no Recent activity section until R7 lands.
- **R11** — the `notification` table and its read boundary, which the unread stat card and Mentions read. Specified in full at [`specs/007-notifications-and-email/spec.md`](../007-notifications-and-email/spec.md).

**Consumed but not blocking**:

- **R3** and **R4** — accounts existing and profiles being editable are not preconditions for these queries to run correctly; this feature reads no module either entry delivers.
- **R8** — labels curate a team-wide set and touch neither an issue's assignment, its due date, its column, nor any project's membership or status; nothing here reads a label.
- **R9** — column edits change a column's name, colour, or order, never its `kind`, which is fixed at creation by R5; this feature's progress figure is unaffected by anything R9 builds.
- **R10** — as the *Reconciliations* subsection above states, this is a completeness dependency exercised through ordinary use, not a code dependency this feature's own correctness relies on.

**Building this feature before R7 or R11 land** is not a supported ordering: there is no `activity` table to roll up and no `notification` table to read.

**Dependency approval this feature triggers**: none. This feature adds no package; every read it performs is an ordinary query against tables four other entries already define or will define.
