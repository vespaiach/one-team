# Feature Specification: Home roll-up

**Feature Branch**: `sdd/r12-final`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R12**

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "R12 — Home roll-up. One read-only landing page answering 'what is mine, and what just happened'."

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R12** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

This is the last entry in the roadmap and the only one that adds no table, no column, no mutator and no migration. It reads what R5 through R11 already wrote and puts it on one page.

## Clarifications

### Session 2026-09-06

- Q: Which issues does the **due this week** card count — the current calendar week or a rolling seven days — and does an issue already past its due date count? → A: The seven calendar days beginning today, today through today plus six inclusive, in the server's configured timezone; an already-overdue issue does not count. §5 keeps "due this week" and overdue as two distinct notions, and no source fixes a week-start day, which a calendar week would need and which the browser-derived locale would make differ per viewer.
- Q: Does **Assigned to you** list every issue assigned to the viewer, including those in `done`- and `canceled`-kind columns, or open work only — and is the section bounded? → A: Every issue whose assignee is the viewer, whatever its column's kind, with no row bound. §3.2 states a bound where it wants one (Mentions 5, Recent activity 20) and states none here, and Home reads the `done` and `canceled` kinds for the progress figure alone (FR-020), never as a filter.
- Q: How does the progress percentage round, given that three of eight reads 38% but an incomplete project must never read 100%? → A: To the nearest whole number, halves up; a project with at least one counted issue not done renders 99% where rounding would otherwise reach 100%, so only an exactly complete project reads 100%.
- Q: Do the sections other than **Your projects** filter out archived projects? → A: No. The `status = 'active'` filter is **Your projects**' alone; **Assigned to you** and **Recent activity** apply no project-status filter, since archiving "changes nothing else about the project" (§3.8) and the sidebar lists archived projects alongside active ones.
- Q: A comment is both a `comment` row and a `comment`-type record in the activity log — does it occupy one row in **Recent activity** or two? → A: One. §3.4 defines a feed as one interleaved stream in which a comment appears once, carrying its body; twenty rows are twenty distinct events.
- Q: FR-038 and SC-011 promise nothing shifts position in 100% of loads, yet **Assigned to you** carries no row bound (FR-010) and **Your projects** none either, so a fixed-row skeleton cannot match the row count that lands — what exactly must not shift, and how many rows do those two skeletons reserve? → A: The promise binds geometry, not row count. Across the swap every element keeps its horizontal position, its own height and its section's frame, heading and row geometry; the fixed-height surfaces — the greeting and the three stat cards — never move at all, and **Mentions** and **Recent activity** reserve exactly the five and twenty rows §3.2 bounds them at, so neither resizes when it lands full. The two unbounded sections reserve three placeholder rows each, and any section whose real row count differs from the count it reserved may change height, so the only movement anywhere on the page is the vertical reflow of whatever sits below such a section. §4's Loading row asks for skeletons that "match the layout they replace", which is a claim about layout rather than cardinality, and every shipped skeleton over an unbounded list already reserves a fixed placeholder count — `RosterSkeleton` three, `FeedSkeleton` four, `NotificationsSkeleton` six — so three matches the nearest precedent, R3's roster.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Someone signs in and Home tells them what is theirs (Priority: P1)

A signed-in user lands on `/home` after signing in, or follows the sidebar's Home entry. Until now the content region under the sidebar was empty — entry R2 shipped the route and its headerless frame and left the content to this entry. It now greets them by name, shows three stat cards — how many issues are assigned to them, how many of those are due this week, how many notifications they have not read — and lists the issues assigned to them underneath.

**Why this priority**: This is the half of the page that answers "what is mine", and it is the landing page every sign-in arrives at. A user who never opens another screen still gets the answer the entry exists to give.

**Independent Test**: Sign in as a user holding issues assigned to them across more than one project, some due inside the week and some not, plus a spread of read and unread notifications, open `/home`, and confirm the greeting names them, each of the three cards carries the right number, and the issues assigned to them are listed. Sign in as a user with none of the three and confirm each surface says so in one line. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open `/home`, **Then** the greeting names them and the three stat cards render — assigned to you, due this week, unread — each carrying a number.
2. **Given** a user holding four issues assigned to them, **When** Home renders, **Then** the assigned card reads 4 and the **Assigned to you** section lists exactly those four issues, each naming its issue key, its title and the project it belongs to.
3. **Given** a user holding seven unread notifications, **When** Home renders, **Then** the unread card reads 7 — the same number the sidebar's Notifications entry carries.
4. **Given** a user holding four issues due today, in six days, in eight days and yesterday respectively, **When** Home renders, **Then** the due-this-week card reads 2 — the yesterday one is overdue, not due this week, and the eight-day one is outside the window.
5. **Given** a user holding an issue assigned to them in a `done`-kind column, **When** Home renders, **Then** it lists under **Assigned to you** and counts toward the assigned card.
6. **Given** a user with no issues assigned to them, **When** Home renders, **Then** the assigned card reads 0 and the **Assigned to you** section renders one quiet line rather than an illustration or a call to action.
7. **Given** a signed-in user, **When** Home renders, **Then** no header renders — no title block, no per-screen control, no New issue control — and the sidebar renders as it does everywhere else.

---

### User Story 2 - Your projects, with how far along each one is (Priority: P2)

The same user sees the projects they belong to, each with its name, its status and a progress figure — the share of its work that has been finished, with the work that was called off taken out of the reckoning rather than counted against it. A project that has no issues yet, or none outside its canceled columns, reads 0% rather than a blank, a dash or an arithmetic error.

**Why this priority**: This is the second half of "what is mine" and the only surface in the product that reads the `done` and `canceled` column kinds for a figure rather than for a rule. It depends on nothing story 1 delivers and can ship on its own.

**Independent Test**: Sign in as a member of several projects — one active with a mix of done, canceled and open issues, one active with no issues at all, one active whose every issue sits in a canceled column, and one archived — open `/home`, and confirm the section lists the active ones only, each with the right percentage, and that both zero-denominator projects read 0%.

**Acceptance Scenarios**:

1. **Given** a project with ten issues, three in a `done`-kind column and two in a `canceled`-kind column, **When** Home renders, **Then** that project's progress reads 38% — three of eight.
2. **Given** a project with no issues, **When** Home renders, **Then** its progress reads 0%, not a blank, a dash or an error.
3. **Given** a project whose every issue sits in a `canceled`-kind column, **When** Home renders, **Then** its progress reads 0%.
4. **Given** an archived project the viewer belongs to, **When** Home renders, **Then** it is absent from **Your projects**.
5. **Given** a project with two `done`-kind columns, **When** Home renders, **Then** issues in either of them count toward the numerator.
6. **Given** a project with two hundred counted issues of which one hundred and ninety-nine are done, **When** Home renders, **Then** progress reads 99%, not 100%.

---

### User Story 3 - The five most recent times somebody named you (Priority: P3)

A **Mentions** section lists the five most recent times somebody named the viewer in a comment, newest first, read and unread alike, unread rows carrying the same dot the Notifications screen gives them. Activating a row opens the issue or project it happened on, at the comment. Nothing on Home marks anything read: the row that was unread when they left is still unread when they come back, and the unread stat card above still counts it.

**Why this priority**: It is the smallest of the four sections and reads a table the unread card already reads, but it is the one surface that carries the row-level read rule, so it is worth proving on its own.

**Independent Test**: Sign in as a user holding seven `mention` notifications and a spread of `assignment` and `comment` ones, open `/home`, and confirm exactly the five newest `mention` rows render, newest first, read and unread together, with dots only on the unread ones; that activating one navigates without clearing its dot; and that a second user's mentions never appear.

**Acceptance Scenarios**:

1. **Given** a user holding seven `mention` notifications, **When** Home renders, **Then** the five most recent render, newest first, and the other two do not.
2. **Given** a user holding both read and unread `mention` notifications, **When** Home renders, **Then** both are listed and only the unread ones carry a dot.
3. **Given** a user holding `assignment` and `comment` notifications, **When** Home renders, **Then** none of them appear in **Mentions**.
4. **Given** an unread mention on Home, **When** the user activates its row and returns to Home, **Then** the row is still unread, still carries its dot, and the unread card's number is unchanged.
5. **Given** two signed-in users, **When** each opens Home, **Then** each sees only mentions addressed to themselves, and no request shape exists that returns another user's rows.

---

### User Story 4 - What just happened, everywhere (Priority: P4)

A **Recent activity** section answers the second half of the page's question: the twenty most recent things that happened anywhere in the installation, newest first, drawn from every project's feed and every issue's feed at once. Each row names who did it, what it was, and which issue or project it happened on, with a relative time.

**Why this priority**: It is the only cross-project view in the product and the reason the entry depends on R7 and R10 as well as R11. It is also the section a reader can most easily do without, so it ships last.

**Independent Test**: Seed activity and comments across several projects and issues, open `/home`, and confirm exactly twenty rows render, newest first, spanning more than one project, each naming its actor, what happened and where — and that a twenty-first, older row is absent with no page control offering it.

**Acceptance Scenarios**:

1. **Given** activity across three projects and several issues, **When** Home renders, **Then** the twenty most recent rows render newest first, regardless of which project or issue each came from.
2. **Given** more than twenty rows exist, **When** Home renders, **Then** exactly twenty render and no page control, "load more" or infinite scroll is offered.
3. **Given** an installation with no activity at all, **When** Home renders, **Then** the section renders one quiet line.
4. **Given** a row that happened on an issue, **When** it renders, **Then** it names that issue's key and its project, so the row is readable without the surrounding context an issue's own feed would have given it.
5. **Given** a user who is a member of no project, **When** Home renders, **Then** **Recent activity** still shows what happened everywhere — reading is not scoped by membership.

---

### User Story 5 - Home reads and never writes (Priority: P5)

Home offers no control that changes anything. It has no header and therefore no per-screen control; it has no composer, no toggle, no "mark all read" and no drag. It loads with skeletons that match the layout they replace, re-queries when it is revisited, and shows one quiet line wherever a surface is empty.

**Why this priority**: It is a property of the whole page rather than of any one section, and it is what makes the entry safe to build last. Every other story assumes it.

**Independent Test**: Open `/home`, exercise every element it renders, and confirm no request mutates anything; navigate away and back and confirm the page re-queries rather than rendering stale content; render it with each section empty and confirm each says so in one line.

**Acceptance Scenarios**:

1. **Given** Home rendered, **When** every element on the page is exercised, **Then** no mutation is issued and no row anywhere changes.
2. **Given** Home rendered, **When** the user navigates to another screen and back, **Then** the page re-queries the server and nothing renders from a client cache.
3. **Given** Home loading, **When** the data has not arrived, **Then** per-section skeletons matching the final layout render and no full-screen spinner is shown; when the data lands the greeting, the three stat cards, **Mentions** and **Recent activity** hold their positions and heights, and the only movement is the vertical reflow below **Assigned to you** or **Your projects** if that section's real row count differs from the three rows it reserved.
4. **Given** an unauthenticated request to `/home`, **When** it is made, **Then** it redirects to sign-in and renders no part of this page.

---

### Edge Cases

- **A user assigned an issue in a project they are not a member of** — the issue still lists under **Assigned to you**; §2 makes this a real, reachable state and reading is never scoped by membership. The project does not appear under **Your projects** unless they hold a membership row for it.
- **A project holding issues only in `done`-kind columns** — progress reads 100%: the numerator equals the denominator, and no rounding rule may turn that into 99%.
- **A project whose every issue is either done or canceled** — the canceled ones leave the denominator, so progress reads 100% rather than a share of the total.
- **A mention whose comment has since been deleted** — the notification went with it under R11's cascade, so it cannot appear here; **Mentions** never renders a row pointing at a comment that no longer exists.
- **A mention whose actor has since been deactivated** — the row survives and renders with that person's name; content authored by deactivated users survives (§2).
- **An activity row written by a deactivated user** — the same: **Recent activity** filters on nothing but recency.
- **Fewer than five mentions or fewer than twenty activity rows** — the section renders what exists, without padding and without an empty-row placeholder.
- **A tie in recency** — two rows sharing an instant must still order deterministically, so a reload does not shuffle them.
- **A user assigned a hundred issues** — **Assigned to you** lists all hundred and the assigned card reads 100. The bounds §3.2 gives belong to **Mentions** and **Recent activity**; this section has none.
- **A viewer holding no assigned issues, or a hundred of them** — **Assigned to you** reserved three placeholder rows either way, so the section shrinks to its one quiet line or grows to a hundred rows when the data lands, and the sections below it reflow vertically by that difference. Nothing moves horizontally, no row changes its own height, and the greeting and the three cards above are unaffected. **Your projects** behaves the same way.
- **An issue assigned to the viewer in an archived project** — it still lists under **Assigned to you**, and activity on it still reaches **Recent activity**. Only **Your projects** filters on project status.
- **A comment and the activity log's record of the same comment** — one row in **Recent activity**, not two.
- **An issue assigned to the viewer with no due date, and one whose due date has passed** — neither counts toward the due-this-week card; both still list under **Assigned to you**.
- **A user holding more unread notifications than the Notifications screen lists** — the unread card counts every unread row they hold, matching the sidebar rather than that screen's 200-row list bound.
- **The must-change-password banner** — it renders above Home's content like it does on every authenticated screen, and nothing on this page is withheld while it does.

## Requirements *(mandatory)*

### Functional Requirements

#### The page and its frame

- **FR-001**: `/home` MUST render the greeting, three stat cards, **Assigned to you**, **Your projects**, **Mentions** and **Recent activity**, in that order, inside the headerless frame entry R2 already delivers. (§3.2)
- **FR-002**: This feature MUST NOT add a header, a title block, a per-screen control or a New issue control to `/home`, and MUST NOT alter the shell R2 delivers. Home is `OT-UX-001`'s single exception and stays it. (`OT-UX-001`, §3.2)
- **FR-003**: `/home` MUST remain reachable by any signed-in user regardless of role or project membership, and MUST require no membership, no role and no state beyond a session. An unauthenticated request MUST redirect to sign-in as R2 already requires. (§3, screen table)
- **FR-004**: This feature MUST add no table, no column, no migration, no mutator and no Server Action. Every query it adds MUST be a read. (Roadmap R12, *Deferred*)

#### The greeting

- **FR-005**: The greeting MUST name the viewer using the same display-name rule the rest of the application uses — first name and last name, one space — resolved from the session on the server. (§3.12, R2)

#### The three stat cards

- **FR-006**: Three stat cards MUST render, in this order: assigned to you, due this week, unread. Each MUST carry a number and a label naming what it counts, and the number MUST NOT be conveyed by size, colour or position alone. (§3.2, `OT-UX-018`)
- **FR-007**: The **assigned to you** card MUST count exactly the issues **Assigned to you** lists under FR-010, so the card and the section beneath it can never disagree.
- **FR-008**: The **due this week** card MUST count the issues **Assigned to you** lists whose `due_date` falls in the seven calendar days beginning today — today through today plus six, both inclusive. An issue whose `due_date` is already past MUST NOT be counted; overdue is the separate notion §5 keeps distinct from "due this week". An issue carrying no `due_date` MUST NOT be counted. The comparison MUST run against calendar dates in the server's own configured timezone, never the browser's, so the number is the same for every viewer on the installation. (`OT-DATA-004`, §5)
- **FR-009**: The **unread** card MUST count every unread notification the viewer holds, scoped to their own `user_id`, and MUST NOT be bounded by the 200-row cap the Notifications screen puts on its list — so it reads the same number the sidebar's Notifications entry carries. (`OT-AUTHZ-003`, §3.6, R11)

#### Assigned to you

- **FR-010**: **Assigned to you** MUST list every issue whose assignee is the viewer, newest first, applying no completion filter and no row bound. An issue sitting in a `done`- or a `canceled`-kind column MUST list like any other, because Home reads those kinds for the progress figure alone (FR-020); and the section MUST NOT be truncated, because §3.2 states a bound where it wants one — Mentions at five, Recent activity at twenty — and states none here, while FR-007 ties this section's row count to the card above it. (§3.2)
- **FR-011**: Each row MUST name the issue's key (`WEB-142`), its title and the project it belongs to, since the section spans projects and a key alone does not say which board it is on. (§3.2, §5, *Keys*)
- **FR-012**: An issue assigned to the viewer MUST list here whether or not they are a member of its project — membership is a write boundary, never a visibility one. (`OT-AUTHZ-002`, §2)
- **FR-013**: Activating a row MUST open that issue's detail page and MUST change nothing.

#### Your projects and the progress figure

- **FR-014**: **Your projects** MUST list the viewer's projects with `status = 'active'` only. An archived project MUST NOT appear, whatever its progress. This is the page's only project-status filter: **Assigned to you** and **Recent activity** MUST NOT filter on project status, since archiving changes nothing else about a project and its rows stay readable. (§3.2, §3.8)
- **FR-015**: The section MUST read the viewer's `project_member` rows — a membership **list**, not the `isMember` predicate — so an admin sees only the projects they were added to explicitly, exactly as the roster on Accounts and the chips on Create project do. (§2)
- **FR-016**: Each row MUST carry the project's name, its status and its progress figure. (§3.2)
- **FR-017**: Progress MUST be computed as the count of the project's issues sitting in a `done`-kind column, divided by the project's total issue count minus the count sitting in a `canceled`-kind column. A project with more than one `done`-kind or `canceled`-kind column MUST count issues across all of them. (§3.2, §5)
- **FR-018**: When that denominator is zero — a project with no issues, or none outside its `canceled`-kind columns — progress MUST read 0%. It MUST NOT read blank, a dash, "n/a", or raise an error. (§3.2)
- **FR-019**: The figure MUST be rendered as a whole-number percentage, rounded to the nearest whole number with halves rounded up, so three of eight reads 38%. A project whose every counted issue is done MUST read 100%, and a project holding at least one counted issue that is not done MUST NOT read 100% — where rounding would otherwise reach it, the figure MUST read 99%.
- **FR-020**: This feature MUST read the `done` and `canceled` column kinds and MUST NOT enforce, restate or re-implement invariant 14. Guaranteeing that a project keeps a `done`-kind column is `deleteColumn`'s and stays entry R9's. (Roadmap R12; `OT-INV-014`)

#### Mentions

- **FR-021**: **Mentions** MUST list the five most recent `mention` notifications addressed to the viewer, newest first. `assignment` and `comment` notifications MUST NOT appear. (§3.2)
- **FR-022**: The section MUST read the `notification` table and MUST NOT re-derive its rows from mention tokens in comment bodies. The recipient set was computed and filtered once when the row was written — actor removed, deactivated users excluded, `mention` winning over `comment` — and deriving it a second time here would be a second implementation of the same rule. (§3.2, §3.6)
- **FR-023**: Rows MUST be listed read and unread alike, and an unread row MUST carry the same dot the Notifications screen gives it, with a text equivalent so the state is not conveyed by a dot alone. (§3.2, §3.6, `OT-UX-018`)
- **FR-024**: Each row MUST name the actor, the issue or project it happened on and a relative time, matching the Notifications screen's own row. (§3.6)
- **FR-025**: Activating a row MUST open that issue or project, at the comment where the row carries one, using the same `#comment-<id>` anchor the Notifications screen deep-links to. (§3.6, R7, R11)
- **FR-026**: Activating a row MUST NOT mark it read. Home writes nothing, so a row unread before the navigation MUST still be unread after it, and the unread card MUST be unchanged. Marking read stays a property of activating a row on the Notifications screen. (§3.2, R11)
- **FR-027**: The query MUST be scoped server-side to the viewer's own `user_id`, taken from the session and never from anything the client sends. No parameter, path or body value MUST be able to widen it to another user's rows. This is the system's one row-level read rule and Home is bound by it. (`OT-AUTHZ-003`, §5, *Read boundary*, `AGENTS.md` II, gate 3)

#### Recent activity

- **FR-028**: **Recent activity** MUST list the twenty most recent rows across every project feed and every issue feed in the installation, newest first. (§3.2, §3.8)
- **FR-029**: The section MUST draw from both feeds as those feeds are defined — one interleaved stream of activity rows and comment rows — rather than from the activity log alone. Each comment MUST occupy exactly one row: the log's own `comment`-type record of that same comment MUST NOT render as a second row, so twenty rows are twenty distinct events. (§3.4, §3.8)
- **FR-030**: Each row MUST name its actor, what happened, and the issue or project it happened on, with a relative time. Because the section spans projects, a row on an issue MUST name that issue's key and its project. (§3.2)
- **FR-031**: The section MUST NOT apply the five-minute collapsing an issue's or a project's own feed applies. Twenty rows MUST mean twenty rows, so the count is a property of the data rather than of what a given reader's collapsing produced. (§3.2, §3.4)
- **FR-032**: The section MUST NOT read or write `user.feed_filter` and MUST NOT offer a Comments only / All activity toggle. Home has no per-screen control, and the remembered choice belongs to the two feeds that own the toggle. (§3.2, `OT-UX-014`)
- **FR-033**: The section MUST offer no page control, no "load more" and no infinite scroll. A twenty-first row is simply not listed; it is not deleted and it is unaffected. (§3.2)
- **FR-034**: Rows MUST NOT be filtered by the viewer's membership: every signed-in user reads every project, issue, comment and activity row. (`OT-AUTHZ-002`, §2)

#### Reads, ordering and validation

- **FR-035**: Every count, list and figure on this page MUST be computed on the server from stored rows, and MUST NOT be assembled from anything the client sends. This page's route MUST declare no `params`, no `searchParams` and no body, and MUST therefore read no query, path or body value at all, so no client-supplied value can influence any count, list or figure. (`AGENTS.md` II, gate 3)
- **FR-036**: Every ordered section MUST order deterministically, so two reloads with no intervening write produce the same order. The three recency-ordered sections — **Assigned to you**, **Mentions** and **Recent activity** — MUST break a tie on the ordering instant by a stable secondary key; **Your projects** is not ordered by an instant and MUST merely order deterministically. (`OT-UX-006`)
- **FR-037**: No response this page produces MUST carry a `user` field outside the shared public projection, and no response MUST carry another user's notifications, SQL, stack traces or configuration. (§5, *Read boundary*)

#### Cross-cutting states

- **FR-038**: Each section MUST render its own skeleton while loading, matching the layout it replaces, and no full-screen spinner MUST be used. Matching the layout is a claim about geometry, not about row count: when a section's data lands, every element MUST keep its horizontal position and its own height, and the section MUST keep the frame, heading and per-row geometry its skeleton rendered. The greeting and the three stat cards are fixed-height and MUST NOT move at all; **Mentions** MUST reserve five placeholder rows and **Recent activity** twenty, the counts §3.2 bounds them at, and **Assigned to you** and **Your projects**, which carry no row bound (FR-010, FR-014), MUST each reserve three. A section whose real row count equals the count it reserved MUST NOT change height; a section holding fewer or more rows than it reserved MAY, and the only movement permitted anywhere on the page is the vertical reflow of content below such a section. (`OT-UX-005`, §4)
- **FR-039**: Home MUST re-query the server when it is revisited; nothing MUST render from a client cache. (`OT-UX-006`, §4)
- **FR-040**: Each of the four sections MUST render one quiet line when it is empty — no illustration, no empty-state marketing, no call to action. A stat card at zero MUST render the number 0 rather than an empty state. (`OT-UX-007`, §4)
- **FR-041**: Home MUST NOT poll, open a socket or refresh on a timer. New rows appear on the viewer's next navigation to the page. Periodic re-query is the board's alone. (§1, `OT-OPS-008`'s scope)
- **FR-042**: Every interactive element on the page — the issue rows, project rows, mention rows and activity rows that navigate — MUST carry an accessible name and a visible focus indicator, and MUST be reachable and operable by keyboard. (`OT-UX-017`, `OT-UX-019`)

#### Boundaries this feature must hold

- **FR-043**: This feature MUST NOT introduce a way to mark a notification read, individually or in bulk, from Home. (Roadmap R12, *Deferred*)
- **FR-044**: This feature MUST NOT alter any mutator, query or behaviour entries R5 through R11 delivered. Adding a purely additive export is not an alteration: the constraint binds existing mutators, queries and behaviour, not the introduction of new ones alongside them. A behaviour-preserving move is likewise not an alteration: relocating an existing function to a shared module and swapping a call site's import to its new path changes no mutator, query or behaviour, so the two `formatRelativeTime` import swaps in `src/features/activity/components/comment-row.tsx` and `src/features/notifications/components/notification-row.tsx` are permitted on the same footing as the additive export, provided the moved function's behaviour is unchanged, no test file of those entries is touched, and both components' existing suites stay green and unmodified. Every existing test suite MUST pass unmodified against this feature's diff, with one carve-out: `src/app/(app)/home/page.test.ts` is R2's frame test, not a query or mutator R5 through R11 delivered, and its `expect(result).toBeNull()` assertion inside the "renders no header" case over-asserts FR-002 in a way FR-001 cannot survive. That single assertion MUST be replaced with a real no-header assertion. No other R1 through R11 test moves. (Roadmap §3)
- **FR-045**: This feature MUST NOT introduce a third-party dependency; nothing it needs is absent from the approved table. (`AGENTS.md` IV, gate 4)

### Out of Scope

- **Any write at all.** Home reads and nothing else — no mutator, no Server Action, no form, no drag (FR-004).
- **Marking notifications read from Home** (FR-026, FR-043). That is the Notifications screen's, entry R11's.
- **A header on Home.** `OT-UX-001` makes Home the exception and entry R2 already fixed it (FR-002).
- **The Comments only / All activity toggle and `user.feed_filter`** (FR-032). Both belong to the two feeds entry R7 delivers.
- **Pagination, "load more" and infinite scroll** on any section (FR-033). The bounds §3.2 gives are the whole of it.
- **Archived projects** in **Your projects** (FR-014).
- **Enforcing invariant 14** (FR-020). Reading the kinds is not enforcing them.
- **Live push, sockets, polling and real-time collaboration** (FR-041). Out of scope for v1 by §1.
- **A route that shows another user's roll-up.** None exists and none is added (FR-027).

### Key Entities

This feature adds none. It reads, and only reads:

- **`notification`** — the viewer's own rows, for the unread count and for **Mentions**. The system's one row-level read rule applies (`OT-AUTHZ-003`).
- **`issue`** — for the assigned count, the due-this-week count and **Assigned to you**; its `due_date` for the window, its `assignee_id` for ownership.
- **`board_column`** — its `kind`, for the progress figure's numerator and its excluded set.
- **`project`** and **`project_member`** — for **Your projects**, active status only, membership as a list.
- **`activity`** and **`comment`** — the two row kinds the feeds interleave, for **Recent activity**.
- **`user`** — through the shared public projection only, for the greeting and for every actor name rendered.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user landing on Home can answer "what is assigned to me, how much is due this week, and how much have I not read" from the top of the page, without navigating anywhere.
- **SC-002**: The assigned card's number and the number of rows in **Assigned to you** are equal for every user and every data shape, verifiable by comparing the two.
- **SC-003**: The unread card and the sidebar's Notifications count show the same number on the same render, for every user, including one holding more than 200 notifications.
- **SC-004**: Every active project the viewer belongs to shows a progress figure between 0% and 100% inclusive, and no data shape produces a blank, a dash or an error — including a project with no issues and a project whose every issue is canceled, both of which read 0%. 100% appears only where every counted issue is done; a project one issue short reads 99%.
- **SC-005**: **Mentions** shows at most five rows, all of type `mention`, all addressed to the viewer, newest first, in 100% of renders.
- **SC-006**: A mention row activated from Home is still unread afterwards, and the unread card's number is unchanged — verifiable by reading the row before and after.
- **SC-007**: No request a client can construct returns a notification whose `user_id` is not the caller's, verifiable by attempting it as a second user.
- **SC-008**: **Recent activity** shows exactly twenty rows whenever twenty or more exist, spanning every project and issue in the installation, with no control offering a twenty-first.
- **SC-009**: Exercising every element on Home issues zero mutations and changes zero rows, verifiable by comparing the database before and after.
- **SC-010**: Every empty surface on Home renders exactly one line of text, in 100% of empty cases.
- **SC-011**: Home reaches its first meaningful paint with per-section skeletons and no full-screen spinner, in 100% of loads. In 100% of loads the greeting and the three stat cards occupy the same position before and after data lands, every element keeps its horizontal position and its own height, and every section whose real row count equals the count it reserved — five for **Mentions**, twenty for **Recent activity**, three for **Assigned to you** and for **Your projects** — keeps that reserved height. The only position change any load may produce is the vertical reflow of content below a section whose real row count differs from the count it reserved; for a viewer holding five mentions, twenty activity rows, exactly three assigned issues and three active projects, nothing on the page changes position at all.
- **SC-012**: Two consecutive renders of Home with no intervening write produce identical ordering in all four sections.
- **SC-013**: The due-this-week number is identical for two users in different browser timezones looking at the same data at the same moment, and counts exactly the issues whose due date falls in the seven days from today inclusive.
- **SC-014**: Every existing test in entries R1 through R11 passes unmodified against this feature's diff, except for the single `expect(result).toBeNull()` assertion in the "renders no header" case of `src/app/(app)/home/page.test.ts` — R2's frame test, not a query or mutator R5 through R11 delivered — which is replaced with a real no-header assertion. No other R1 through R11 test moves. A source file in entries R1 through R11 may be edited only where the edit preserves behaviour and leaves every test file of those entries untouched — the two `formatRelativeTime` import swaps FR-044 names — and that permission is measured the same way: those files' existing suites pass unmodified.

## Assumptions

### Defaults chosen because the source is silent

- **The greeting names the viewer and nothing else.** §3.2 says "greeting" and no more. It is rendered as the display name the whole application uses (FR-005); no time-of-day variation is introduced, because there is no source for one and it would need a second timezone decision beyond `OT-DATA-004`'s.
- **Each cross-project row names where it came from.** §3.2 fixes each section's contents but not its row shape. Because all four sections span projects, a row that named only an issue title or a column name would be unreadable; each names its project or issue key (FR-011, FR-030). This adds no data — every field is already on the row.
- **Progress renders as a whole-number percentage** (FR-019). §3.2 gives the formula and the string "0%", which fixes the unit and implies the rounding; the two endpoints are pinned so rounding cannot misreport a complete or an empty project.
- **Rows are ordered by their creation instant, ties broken by a stable key** (FR-036). §3.2 says "newest first" and "most recent" without naming the field; every table involved carries `created_at`, and only a deterministic tiebreak makes "the 20 most recent" a testable claim.
- **Mention rows carry the Notifications screen's row shape** (FR-024). §3.2 says Home lists the same rows with the same dot; reusing that shape rather than inventing a second one is what "the same" means.

### Reconciliations between the roadmap, the requirements index and the specification

- **The progress formula has no requirement ID, and that is not an omission.** The roadmap states it: the index extracts only rules spanning two or more capabilities, and the formula belongs to Home alone. It is specified here from §3.2 directly (FR-017, FR-018).
- **`OT-INV-014` is read here and enforced elsewhere.** The roadmap draws this line explicitly; FR-020 restates it so a reader does not mistake reading a column kind for guarding it.
- **"Your projects" reads membership rows, not the predicate** (FR-015). §2 draws that distinction and enumerates the two lists that read rows *plus* every admin — the assignee pool and the `@mention` priority group. Home's is not among them, so it reads rows only, and an admin who was never added to a project does not see it here.
- **"Every project and issue feed" means the interleaved streams, comments included** (FR-029). §3.4 defines a feed as one stream carrying comments and system records together, and §3.8 says Home's section "reads from both feeds". Reading the activity log alone would drop the comment rows those feeds carry.
- **The unread card follows the sidebar, not the Notifications list** (FR-009). Entry R11 bounds that screen's list at 200 rows while leaving the sidebar's count unbounded; Home's card is a count, so it follows the count.

### Inherited constraints, not decisions this specification makes

- Home's headerless frame, its route, its guard, the sidebar beside it and the must-change-password banner above it are entry R2's and are consumed unchanged.
- The `notification` table, its read rule, the unread dot and the `#comment-<id>` deep link are entry R11's.
- The `activity` and `comment` tables, both feeds and the comment anchor are entry R7's.
- `board_column.kind`, its seeded five rows and the guarantee that a `done`- and a `canceled`-kind column always exist are entries R5 and R9's.
- Test-first (VII) applies as it does everywhere: each acceptance scenario above is written and observed failing before the code that satisfies it exists.

### Obligations this feature places on entries built before it

None. This is the only entry in the roadmap that reaches back into no earlier one: it adds no column to a table another entry owns, no branch to a mutator another entry wrote, and no obligation on any entry still to come. There are no entries still to come.

### Dependencies

- **R7** — the `activity` and `comment` tables and both feeds, which **Recent activity** reads.
- **R10** — the board, whose `done`- and `canceled`-kind columns the progress figure reads and whose deferral of that figure this entry answers.
- **R11** — the `notification` table, which the unread card and **Mentions** read.
- **R2** — transitively, for `/home` itself, its guard and its headerless frame.
- **R5**, **R6** — transitively, for `project`, `project_member`, `board_column` and `issue`.
