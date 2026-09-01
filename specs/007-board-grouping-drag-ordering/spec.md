# Feature Specification: Board — grouping, drag and ordering

**Feature Branch**: `claude/r10-feature-specs-066984`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R10**

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "create a feature specifications for roadmap entry R10, refer to @docs/ROADMAP.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R10** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member drags a card into a different column (Priority: P1)

A project member picks up a card on the board and drops it into a different column. The card's status changes immediately, on screen, before the server confirms it.

**Why this priority**: This is the gesture the product exists for — the "Trello model" the roadmap names as the app's centre of gravity — and every other story on this screen is either a variant of it (dragging under a different grouping) or a way of getting a card onto the board to drag (the composer). Nothing else on this screen matters if this does not work.

**Independent Test**: As a member of a project with at least two columns and one issue, open the board, drag that issue's card from its current column into another, and confirm the card appears in the new column immediately, and that reloading the page shows it still there with the same neighbours.

**Acceptance Scenarios**:

1. **Given** a member viewing a project's board under Column grouping, **When** they drag a card from one column and drop it in another, **Then** the card appears in the new column immediately, and one `moveIssue` call writes that issue's `column_id` and `sort_order` together.
2. **Given** the same drag, **When** the server has not yet answered, **Then** the card is already shown in its new column — the change is not waiting on the response.
3. **Given** a member drags a card and drops it back in the exact position it started from, **When** the drop completes, **Then** no `moveIssue` call is made and nothing is written.
4. **Given** a member drags a card into a column that another admin deletes in the moment between pickup and drop, **When** the drop resolves, **Then** the write is refused, the card returns to its column of origin, and a message names what failed.
5. **Given** two members dragging two different cards on the same board at the same moment, **When** both drops resolve, **Then** both writes succeed and neither member is told to retry.
6. **Given** a member who has just dropped a card into a new column, **When** they look at that issue's activity feed, **Then** it carries one new row recording the column change, in the same form a rail edit would produce.

---

### User Story 2 - Any signed-in user reads a project's board (Priority: P2)

Any signed-in user — a member or not — opens a project's board and sees every column, every card in it, and the grouping control, without needing to be added to the project first.

**Why this priority**: Reading is the state most users are in on most boards, since membership only gates writing (§2); a board that cannot be read by everyone is a board that has broken the product's central access rule before its primary gesture is even reached.

**Independent Test**: As a signed-in user who is not a member of a project, open its board and confirm every column, every card and the grouping control render exactly as they would for a member, with no card, column or field hidden.

**Acceptance Scenarios**:

1. **Given** a signed-in non-member, **When** they open a project's board, **Then** every column and every card in it renders, identically in structure to what a member sees.
2. **Given** a project key matching no project, **When** a signed-in user opens that route, **Then** the page reads "This doesn't exist."
3. **Given** an unauthenticated caller, **When** they request a board route, **Then** they are redirected to `/signin` and never reach Forbidden.
4. **Given** a board with more cards than fit on screen, **When** a user scrolls a column, **Then** the cards in that column remain readable and correctly ordered.
5. **Given** a project with no issues at all, **When** any signed-in user opens its board, **Then** every column shows the single quiet empty-state line and nothing else.

---

### User Story 3 - A member regroups the board by Assignee or Priority and drags across lanes (Priority: P3)

A project member switches the board's grouping to Assignee or Priority and drags a card into a different lane, changing who owns it or how urgent it is — the same gesture as a column move, over a different field.

**Why this priority**: The board's single ordering rule and its cross-lane write only prove themselves once a second and third grouping exist; without this story, the drag mechanic built in Story 1 could just as easily have been column-specific code rather than the field-agnostic mutator the specification requires.

**Independent Test**: As a member, switch a project's board to Assignee grouping, drag a card from Unassigned into a teammate's lane, and confirm the card's assignee changes and it appears under that teammate; switch to Priority grouping and confirm the same card can be dragged into a different priority lane.

**Acceptance Scenarios**:

1. **Given** a member viewing a board under Assignee grouping, **When** they drag an unassigned card into a member's lane, **Then** that issue's assignee is set to that member and the card appears in that lane immediately.
2. **Given** a member viewing a board under Assignee grouping, **When** they drag an assigned card into the Unassigned lane, **Then** that issue's assignee is cleared.
3. **Given** a member viewing a board under Priority grouping, **When** they drag a card into a different priority lane, **Then** that issue's priority changes to the value that lane represents.
4. **Given** a board under Assignee grouping showing a lane for a user assigned an issue but no longer a project member, **When** a member drags a *different* card onto that lane, **Then** the drop is refused and the card returns to where it started.
5. **Given** a member reorders a card within its own lane under Assignee grouping, **When** they switch to Column grouping, **Then** that same card's relative position under Column grouping has also moved, matching the single project-wide order.
6. **Given** a member switches grouping from Column to Assignee and back, **When** each switch completes, **Then** every card that was on screen before the switch is still present after it.

---

### User Story 4 - A member creates an issue directly from the board (Priority: P4)

A project member types a title into a column's "Add a card" composer and presses Enter, or opens the chevron into the full Create issue page, without leaving the board.

**Why this priority**: It is the board's own entry point into issue creation — faster than navigating away for the common case of a bare title — and it is what makes the board a place people work *from*, rather than only a place they rearrange things created elsewhere.

**Independent Test**: As a member, use a column's inline composer to create an issue with a title alone, and confirm it appears at the foot of that column immediately with no page navigation; separately, use the chevron and confirm it opens Create issue with that column preselected.

**Acceptance Scenarios**:

1. **Given** a member on the board under Column grouping, **When** they type a title into a column's composer and press Enter, **Then** one issue is created in that column, placed last in the project's order, with no page navigation.
2. **Given** a member on the board under Assignee grouping, **When** they use a lane's composer, **Then** the created issue lands in the project's first column and carries that lane's assignee.
3. **Given** a member on the board under Priority grouping, **When** they use a lane's composer, **Then** the created issue lands in the project's first column and carries that lane's priority.
4. **Given** a member on the board, **When** they open a composer's chevron, **Then** Create issue opens with the same defaults the composer would have used, preselected.
5. **Given** a member submits a composer with only whitespace, **When** they press Enter, **Then** no issue is created and the field reports the missing title inline.
6. **Given** a non-member on the board, **When** they look at any column, **Then** its composer is visible, disabled, and its placeholder names the project they would need to join.

---

### User Story 5 - A non-member reads the board and understands the write boundary (Priority: P5)

A signed-in user who is not a member of the project opens its board, reads everything on it, and finds every control that would write something disabled with a reason naming the project.

**Why this priority**: Getting this wrong turns a readable, well-explained boundary into a board that looks broken for most users on most projects, the same risk entry R6 named for issue detail; it is last because the board is fully readable and its primary gesture fully provable without it.

**Independent Test**: As a signed-in non-member, open a project's board and confirm no card can be dragged, every composer is disabled with an inline reason, and the header's New issue control is disabled with the same reason.

**Acceptance Scenarios**:

1. **Given** a signed-in non-member, **When** they open a project's board, **Then** no card offers a drag affordance and every composer renders disabled with a reason naming the project.
2. **Given** a signed-in non-member, **When** they look at the header, **Then** the New issue control is visible, disabled, and carries the same reason.
3. **Given** a non-member, **When** they call `moveIssue` directly, bypassing the disabled drag handle, **Then** the server refuses it.
4. **Given** a member with the board open, **When** their membership is removed mid-session, **Then** their drag handles and composers become disabled on the next render, with no row removed.
5. **Given** an admin who holds no membership row in a project, **When** they open its board, **Then** every drag handle and composer is enabled, because `isMember` admits every admin.

### Edge Cases

- **Two members drop different cards into the same slot** between the same two neighbours at the same moment: both writes succeed, the resulting tie is legal and never repaired.
- **A member drags a card into a column an admin deletes** in the interval between pickup and drop: the write is refused by the database's own foreign key, and the card reverts.
- **A card is dropped back onto its own assignee's lane** under Assignee grouping (a no-op reassignment): treated as a same-lane drop, writing only `sort_order`.
- **A card is dropped onto the lane of a user removed from the project** since the board was last loaded: refused — that lane still displays the card already assigned there, but accepts no new one.
- **A card is dropped onto the lane of a deactivated user**: refused, for the same reason.
- **A background re-query lands mid-drag**: the board underneath updates, the drag itself is undisturbed, and the drop resolves against the fresh neighbours rather than the stale ones.
- **A member's board tab regains focus after being backgrounded** for longer than 30 seconds: the board re-queries once, on focus, not once for every interval it missed.
- **A project with exactly one column**: Column grouping offers one lane, and every card in it can only be reordered, never moved across a column boundary — Assignee and Priority grouping stay fully cross-lane regardless.
- **A project with no members and no admin other than the viewer**: Assignee grouping's lanes are Unassigned plus the viewer alone.
- **A card reordered under Column grouping** changes its relative position under Assignee and Priority grouping too, since all three read the same single order — a stated consequence of one order per project, not a defect.
- **A composer's chevron used under Assignee or Priority grouping** opens Create issue with that lane's person or priority preselected and no column choice forced beyond the project's first.
- **A title pasted into the inline composer carrying line breaks** is accepted as one line with the breaks collapsed, the same rule Create issue's own title field already applies.
- **A drop that lands a card back in its starting lane** writes only `sort_order`, if it writes anything at all, and produces no activity row.
- **A card is dragged by a member whose membership is revoked** in the instant between pickup and drop: the server refuses the write when it arrives, and the client's optimistic placement rolls back with a reason.
- **An admin with no membership row drags a card**: allowed, because `isMember` admits every admin without a row to show for it.
- **A keyboard-only drag**: a card is picked up, moved between lanes, and dropped using only the keyboard, producing the identical single `moveIssue` call a pointer drop does.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure and the board route

- **FR-001**: The board MUST be a full page at `/projects/:projectKey`, distinct from `/projects/:projectKey/details` (entry R5), reached via the project header's Board tab and rendered inside the authenticated shell. (§3, screen table; §3.3)
- **FR-002**: The board MUST be readable by every signed-in user, whether or not they are a member of the project; moving a card and creating a card from the board MUST each require `isMember` of that project. (`OT-AUTHZ-002`, §2, §3)
- **FR-003**: A project key matching no project MUST read "This doesn't exist" rather than any access-denied wording; an unauthenticated caller MUST be redirected to `/signin` rather than shown Forbidden. (`OT-UX-004`, `OT-SEC-015`, §3.11)
- **FR-004**: The board MUST render inside the shell's desktop-only layout, with no responsive breakpoint. (`OT-SCOPE-004`)

#### Reading columns and cards

- **FR-005**: Under Column grouping — the default on first load — the board's lanes MUST be the project's own board columns, in their board order, each showing its name, its colour dot and a count of the cards currently in it. (§3.3)
- **FR-006**: A card MUST show its issue's key, its title, and — only when set — a priority glyph, its labels, its assignee's avatar, its due date and its comment count, and nothing else. (§3.3)
- **FR-007**: An empty lane MUST render as a single quiet line rather than an illustration or empty-state marketing, applying the convention entry R2 established. (`OT-UX-007`)
- **FR-008**: Clicking a card MUST open that issue's own detail page as a full page navigation, never a peek panel, so the URL stays shareable. (§3.3)

#### Grouping

- **FR-009**: The header's one per-screen control MUST let any signed-in user regroup the board by Column, Assignee or Priority. (§3.3, §3 The shell)
- **FR-010**: Under Assignee grouping the lanes MUST be, in order: an **Unassigned** lane first, then the project's members plus every admin (`OT-AUTHZ-007`), then any user still assigned an issue in this project but no longer a member of it (`OT-AUTHZ-015`) — each person listed as exactly one lane. (§3.3, §2)
- **FR-011**: Under Priority grouping the lanes MUST be the five priority values. (§3.3, §5)
- **FR-012**: Switching grouping MUST re-lay the same set of cards into the new lanes without adding, removing or reordering any card, and MUST itself write nothing. (§3.3)
- **FR-013**: An issue's lane MUST follow directly from its own stored `column_id`, `assignee_id` or `priority` under the grouping currently active, so switching grouping never leaves a card orphaned or duplicated. (§3.3)

#### Drag and `moveIssue`

- **FR-014**: `moveIssue` MUST require `isMember` of the issue's own project, derived server-side from the stored issue row, never from a client-supplied project identifier. (`OT-AUTHZ-004`, §2)
- **FR-015**: One drag-and-drop gesture MUST correspond to exactly one `moveIssue` call, made only once the card is dropped — never while it is merely being dragged over a lane. (§3.3)
- **FR-016**: `moveIssue` MUST touch exactly one issue row, and MUST NOT be able to change that issue's project, number, title, description, due date or creator. (`OT-INV-002`, `OT-DATA-017`)
- **FR-017**: A drop that leaves a card in its own lane under the active grouping MUST write only `sort_order`. A drop that moves a card into a different lane under the active grouping MUST write `sort_order` together with whichever single field that grouping represents — `column_id` under Column, `assignee_id` under Assignee, `priority` under Priority — in the same call. (§3.3, `OT-DATA-017`)
- **FR-018**: A cross-lane drop under Column grouping MUST set `column_id` to a board column of the issue's own project; the composite foreign key entry R6 already relies on for `updateIssue` MUST refuse a column that does not belong to the project or no longer exists. (`OT-INV-004`)
- **FR-019**: A cross-lane drop under Assignee grouping MUST set `assignee_id` to a member of the project or an admin, drawn from the same pool `updateIssue` already enforces, and MUST clear it when the target lane is Unassigned. A drop onto the lane of a person who is assigned an existing issue but is no longer in that pool — because they were removed from the project or deactivated — MUST be refused: that lane keeps rendering the card already assigned there, but accepts no new one, exactly as `updateIssue` already refuses such a person as a new assignee. (`OT-AUTHZ-007`, `OT-AUTHZ-015`, §2)
- **FR-020**: A cross-lane drop under Priority grouping MUST set `priority` to the one value that lane represents. (§3.3, §5)
- **FR-021**: A drop that changes nothing under the current grouping and nothing about position — for example a card picked up and dropped back at its own place — MUST issue no `moveIssue` call at all. (mirrors the no-op convention entry R6 established for in-place edits)
- **FR-022**: The drag gesture MUST be reachable by keyboard alone: a card MUST be focusable, MUST enter a move state from the keyboard without a pointer, MUST be relocated within and across lanes using the keyboard, and MUST be placed with a keyboard confirmation that produces the same single `moveIssue` call a pointer drop does. (`OT-UX-018`)

#### Ordering

- **FR-023**: The `sort_order` `moveIssue` writes MUST be a base-62 fractional index, positioning the issue between its two immediate neighbours at the drop point, and MUST NOT require any other row to be rewritten. (`OT-DATA-017`, §3.3)
- **FR-024**: Every ordered read of a project's issues, in any lane, under any grouping, MUST sort by `(sort_order, id)`; a tie on `sort_order` MUST be legal and MUST never be repaired by any mutator. (`OT-DATA-017`)
- **FR-025**: An issue MUST carry exactly one ordering position across the whole project, not one per lane. Reordering a card under one grouping MUST be visible as a changed relative position under every other grouping too — a stated consequence of the single order, not a defect to hide or correct. (§3.3)
- **FR-026**: `moveIssue` MUST be the only mutator, besides `createIssue`'s foot-of-order placement entry R6 already established, that writes `sort_order`. (`OT-DATA-018`, §3.3)

#### Creating from the board

- **FR-027**: Every column lane MUST carry an inline "Add a card" composer at its foot: typing a title and pressing Enter MUST create an issue in that column, calling the same `createIssue` mutator entry R6 delivers, unmodified. (§3.3)
- **FR-028**: Under Assignee or Priority grouping, where a lane represents no column, its composer MUST create the issue in the project's first column by board position and MUST set the assignee or priority that lane represents. (§3.3)
- **FR-029**: Each composer MUST offer a chevron (or Shift-Enter) that instead opens the full Create issue page (entry R6) with the same defaults its inline composer would have used — the lane's column, or the project's first column plus the lane's assignee or priority — preselected. (§3.3, §3.5)
- **FR-030**: For a non-member, every composer on the board MUST render visible and disabled, its placeholder carrying the reason in place of "Add a card" rather than a separate message, on every lane at once. (§3.3, `OT-UX-002`, `OT-UX-021`)
- **FR-031**: The board MUST be added to the set of project-scoped screens on which the shell header's **New issue** control points at Create issue, following the rule entry R6 established for project details, issue detail and Create issue itself: enabled for a member, and for a non-member visible, disabled and carrying a reason naming the project. (`OT-UX-021`, §3 The shell)
- **FR-032**: An issue created from the board — by either entry point — MUST take its ordering position at the foot of the project's single order, the same placement entry R6's `createIssue` already guarantees, so it appears last in whichever lane it lands. (`OT-DATA-018`, §3.3)

#### Authorization and the write boundary

- **FR-033**: The client MAY run the same membership check to decide which drag handles and composers are active; the server check inside `moveIssue` MUST be the enforcement, and MUST reject a call from a non-member independently of whether a disabled control was bypassed. (`OT-AUTHZ-005`, §2)
- **FR-034**: Losing project membership mid-session MUST disable the board's write affordances — drag and every composer — on the next render, without removing any row; gaining membership MUST enable them the same way, with no sign-out and no sign-in required. (`OT-AUTHZ-012`)
- **FR-035**: An admin MUST be able to move and create cards on every project's board whether or not they hold a membership row in it, because `isMember` admits every admin. (§2)

#### Concurrency, staleness and board drift

- **FR-036**: There MUST be no locking on a card and no live push of another user's change. Dragging MUST apply optimistically against the board already on screen, and the drop MUST NOT wait for the server before showing the card in its new place. (`OT-OPS-009`, `OT-UX-008`)
- **FR-037**: The last `moveIssue` call to reach the server MUST win outright over an earlier one touching the same card; neither MUST be refused for conflicting with the other, and neither caller MUST be told it lost. (`OT-OPS-009`, §3.3)
- **FR-038**: The board MUST re-query the server on window focus and, while it is the active tab, every 30 seconds. (`OT-OPS-008`)
- **FR-039**: A re-query landing while a drag is in progress on this client MUST update the board underneath the drag and MUST NOT cancel it; the drop, when it comes, MUST resolve against the neighbours the re-query just supplied rather than the ones the drag started with. (`OT-OPS-008`, §3.3, §4 *Board drift*)
- **FR-040**: A write `moveIssue` refuses — an assignee outside the pool, a column that no longer exists, or a caller who has lost membership — MUST roll the card back to its position before the drag, with a message naming what failed and why. (`OT-UX-008`, §4)
- **FR-041**: Every column transition and every lane transition under every grouping MUST be legal in both directions; none MUST be terminal, none MUST carry a guardrail, and none MUST ask for confirmation. (`OT-OPS-011`, §4)

#### Activity

- **FR-042**: A cross-lane drop that changes `column_id`, `assignee_id` or `priority` MUST write one `field_changed` activity row on the moved issue's own feed, through the writer entry R7 establishes, in the same transaction as the `moveIssue` write — the same event type and the same feed entry §3.4 already specifies for that field changing by any other route, so an issue's history reads identically whichever control changed it. (`OT-DATA-009`, §3.4)
- **FR-043**: A drop that changes only `sort_order` — a reorder within the card's current lane — MUST write no activity row: position is not one of the fields §3.4 lists as activity-triggering. (§3.4, §5)
- **FR-044**: `moveIssue`'s transaction MUST determine, before it commits, whether the call changed `assignee_id` and to whom, in a form a later entry can read without restructuring the mutator — mirroring the changed-field contract entry R6 built into `updateIssue` — so that entry R11's `assignment` notification, which `OT-OPS-016` requires of every write that sets that field to someone other than the actor, can be added to this mutator without rewriting it. (`OT-OPS-016`)

#### Loading, empty states and accessibility

- **FR-045**: The board MUST show a skeleton matching its column layout while its data loads, never a full-screen spinner, and data landing MUST NOT shift any lane already rendered. (`OT-UX-005`)
- **FR-046**: Revisiting the board MUST re-query the server; nothing MUST render from a client cache. (`OT-UX-006`)
- **FR-047**: No state on the board MUST be conveyed by colour alone: a column's colour, a priority's glyph and a disabled composer's reason MUST each carry a text or shape equivalent, and every disabled control's reason MUST be associated with it programmatically. (`OT-UX-018`, §7)
- **FR-048**: Every card, drag handle and composer MUST carry an accessible name and a visible focus indicator. (`OT-UX-018`)

### Out of Scope

Deferred by the roadmap's R10 boundary, and named here so no scenario above is read as covering them:

- **Board column creation, renaming, recolouring, reordering and deletion** — entry R9, already built before this one; this feature reads columns and changes none of them.
- **The team-wide label set's curation and the issue rail's label picker** — entry R8; this feature's card face shows labels R8 already lets a member apply, and creates none of its own.
- **The comment count's source data and the comment composer** — entry R7; this feature reads the count and writes no comment.
- **Every notification a card move or a board-created issue causes** — entry R11, which reaches back into `moveIssue` under `OT-OPS-016` to add `assignment` recipient computation.
- **The project's progress figure**, which reads `done`- and `canceled`-kind columns — entry R12 (Home).
- **Locking, live push and real-time collaboration of any kind** — out of scope for v1 entirely (§1).
- **Full issue editing beyond the four fields a drag can set** — title, description, labels, and the remaining rail controls stay entry R6's issue detail page; this feature's mutator only ever writes column, assignee, priority and position.
- **Deleting an issue from the board** — admin deletion stays on the issue detail page (entry R6); a member's equivalent is dragging a card into a `canceled`-kind column, which this feature already supports as an ordinary column transition.
- **The project header itself** — its colour dot, name and the Board / Details tab pair are entry R5's, rendered around this screen unchanged.

### Key Entities

- **Issue** — entry R6's unit of work. This feature reads and writes only four of its fields: `column_id`, `assignee_id`, `priority` and `sort_order`; every other field is read-only here.
- **Board column** — entry R9's lane under Column grouping, read here and changed nowhere.
- **Lane** — a grouping bucket this feature computes at render time from `column_id`, `assignee_id` or `priority`, depending on which grouping is active. Not a stored entity: nothing in the data model represents a lane directly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member moves a card from one column to another with a single drag gesture, and the change is visible the instant the card is dropped, before the server has answered.
- **SC-002**: Two members dragging different cards on the same board at the same moment both succeed; neither is blocked, retried, or told to resolve a conflict.
- **SC-003**: Reordering one card within a lane changes the stored position of exactly that one card; zero other issues are rewritten.
- **SC-004**: Regrouping the board — Column, Assignee or Priority, in any order of switching — always accounts for every card that was on screen before the switch: none is dropped, none is duplicated.
- **SC-005**: A card dropped between two specific neighbours stays between those same two neighbours after a full page reload.
- **SC-006**: Every disabled write control on a non-member's board — every composer, every drag handle, the header's New issue control — is visible and states, in words, why it cannot be used.
- **SC-007**: An issue created from the board's inline composer appears on the board, in the correct lane and at the foot of that lane's order, with no page navigation.
- **SC-008**: A board left open in a background tab reflects a card moved by someone else within 30 seconds of the tab regaining focus, with no manual refresh.
- **SC-009**: A background refresh landing while a card is mid-drag never interrupts, cancels or resets that drag.
- **SC-010**: A person no longer eligible to hold a new assignment — removed from the project, or deactivated — never receives a second card by drag; the first card already assigned to them is undisturbed.
- **SC-011**: No drag and no board-created issue ever changes an issue's project.
- **SC-012**: Every transition — any column to any other, any assignee to any other, any priority to any other — succeeds with no confirmation step and no state it cannot leave.
- **SC-013**: A cross-lane drop that changes an issue's column, assignee or priority produces exactly one new row in that issue's activity feed, matching what the same change would produce from the issue's own rail.
- **SC-014**: A drag that only reorders a card within its lane produces zero new activity rows.
- **SC-015**: Every card, composer and drag handle on the board is operable by keyboard alone, with a visible focus indicator throughout.
- **SC-016**: The board never shows a full-screen spinner, and no lane already on screen shifts position when data finishes loading.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **Priority lanes are ordered Urgent, High, Medium, Low, No priority.** The specification names the five values (§3.3, §5) without stating a lane order for the board specifically; this adopts the rank Create issue's own field already lists them in (§3.5). **If wrong**: a display-only reorder, touching no stored data.
- **Assignee lanes, after Unassigned, are ordered alphabetically by display name.** The specification fixes only that Unassigned comes first (§3.3); alphabetical-by-name matches how every other roster in the product is ordered. **If wrong**: a display-only reorder.
- **Where the fractional index is computed — client or server — is left to the implementation plan.** `OT-DATA-017` fixes the guarantee (a base-62 index between two neighbours, ties legal, one row touched) but not the computation site, and either site satisfies it identically from this specification's point of view.

### Reconciliations between the roadmap and the specification

- **`moveIssue` writes activity for the fields it changes, reusing entry R7's writer, though the roadmap's R10 entry names no activity work and its "Depends on" column omits R7.** The specification (§3.4) lists column, priority and assignee changes among the events every issue's activity feed records, without excepting a change that arrived by drag rather than by the rail. Entry R9 already sets the precedent of a later slice writing its own activity through R7's writer without R7 itself changing, and R7 is always built before this feature regardless — the roadmap's own graph runs `R7 → R8 → R10` and `R7 → R9 → R10` — so the writer is available whichever of R8 or R9 landed second. Leaving drag-caused field changes silent would leave §3.4's own list unmet with no later entry scheduled to fill the gap: entry R11's reach-back into `moveIssue` (§3, R11's row) is scoped to notifications only, never activity. A reorder that changes only `sort_order` stays silent, because position is not one of the fields §3.4 names — this is a clean line, not a judgment call.
- **The card face's comment count and label chips are in scope, even though R7 is not named in this entry's "Depends on."** Both are read-only displays over tables R7 and R8 already created by the time this feature is built — R10's own listed dependency on R8 already requires R7 to have landed first. This mirrors how entry R6 treated R3: available by build order, not a dependency this feature would fail to build without.
- **R9 is treated as load-bearing, not merely convenient**, because Column grouping's lanes are that project's actual board columns, and only R9 lets those diverge from the five seeded defaults; this feature is tested against a project whose columns have been renamed, recoloured, added to or reordered, which requires R9 to exist even though the board's own read query needs only the `board_column` table entry R5 created.

### Inherited constraints, not decisions this specification makes

- The issue table's `sort_order`, `column_id`, `assignee_id` and `priority` columns, and the composite foreign key tying a column to its project, were created by entries R5 and R6; this feature adds no migration.
- The assignee pool — project members plus every admin, deactivated users excluded — and the rule that an existing assignment survives a person leaving that pool are entry R6's (`OT-AUTHZ-007`, `OT-AUTHZ-014`); this feature applies both to a new mutator rather than redefining them.
- The activity writer, the `field_changed` event type, and the write-activity-in-the-same-transaction convention are entry R7's; this feature is a caller, not the owner.
- The shell, the header's per-screen control slot, the New issue slot, the Forbidden screen, the "this doesn't exist" wording, and the skeleton, toast and empty-state conventions are entry R2's.

### Obligations this feature places on entries built before it

None. Every table, column, constraint, predicate and convention this feature reads or writes already exists in the shape entries R1, R2, R5, R6, R7, R8 and R9 left it; no earlier spec is asked to change anything for this one to land.

### Dependencies

Two kinds of dependency are distinguished: an entry this feature **cannot be built without**, and one whose work it consumes but whose absence would not stop it.

**Cannot be built without**:

- **R6** — the issue table and its `sort_order`, `column_id`, `assignee_id` and `priority` columns; the `createIssue` mutator the inline composer and its chevron call unmodified; the `updateIssue` assignee-pool and column-foreign-key rules `moveIssue` reuses; and the issue detail page a card click opens.
- **R8** — the label table and `issue_label` joins the card face reads; without it, every card's label slot would be permanently empty rather than genuinely optional.
- **R9** — a project's board columns as an admin has actually shaped them, beyond the five seeded defaults, and the activity-writer reuse pattern this feature follows.

**Consumed but not blocking**:

- **R7** — the comment table the card face's comment count reads, and the activity writer `moveIssue`'s field-changed rows reuse. Not named in the roadmap's own "Depends on" for this entry, but always built first regardless, since both R8 and R9 require it.
- **R5** — the project record, `isMember`, and the board columns' seeded defaults, reached transitively through R6 and R9.
- **R1, R2** — the actor, the shell, and the header's control slot, reached transitively through R6.

**Building this feature before R6, R8 or R9** is not a supported ordering and no requirement here anticipates it: there is no reduced board that renders without issues to place on it, without labels to (optionally) show, or without a project's columns as an admin has actually shaped them.

**Downstream reach-back**: R11 adds `assignment` recipient computation to `moveIssue` under `OT-OPS-016`, for a cross-lane drop under Assignee grouping that sets a new assignee; FR-044 fixes the changed-field contract that reach-back depends on. R12 reads this feature's ordered issues only indirectly, through the `done`- and `canceled`-kind columns it counts for the progress figure — it adds nothing to this feature's mutator.

**Dependency approval this feature triggers**: none. The fractional-index scheme uses the `fractional-indexing` library `AGENTS.md`'s approved table already lists for board ordering; the drag interaction comes from `react-aria-components`, already approved for interaction behaviour, focus management, keyboard support and ARIA semantics. Nothing here adds a package absent from that table.
