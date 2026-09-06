# Feature Specification: Board — grouping, drag and ordering

**Feature Branch**: `sdd/board-group-drag-order`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R10**

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "R10 — Board — grouping, drag and ordering. The Trello surface: the project's main screen and the app's centre of gravity."

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R10** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## Clarifications

### Session 2026-09-04

- Q: When a card is dropped, does the `moveIssue` call carry an ordering index the client computed, or the identifiers of the cards it was dropped between so the server computes the index itself? → A: **Neighbour identifiers and a placement, never a client-computed index** — the call names the issue, the target lane and the card it was dropped before or after (or the lane's head or foot), and the server reads those rows inside its own write and derives the fractional index from them. Entry R9 fixed exactly this shape for the sibling reorder, whose `moveColumn` takes `columnId`, `targetColumnId` and `placement` and no rank field ([`specs/008-board-columns/spec.md`](../008-board-columns/spec.md) FR-029, FR-053); `AGENTS.md` Principle II and change gate 3 forbid trusting a client-supplied value that decides where a row lands; and FR-055's requirement that a re-query landing mid-drag leave the drop resolving against the neighbours actually present is satisfiable only where the index is derived from those rows at write time.
- Q: Which distinct outcomes can `moveIssue` refuse with, and which one covers a drop whose index cannot be produced between its neighbours? → A: **Four — `not_found`, `invalid_target`, `forbidden`, and `no_index_available`** for FR-031's unproducible index, each carrying its own message rather than a shared generic one. FR-033, FR-034 and FR-035 already name the first three; FR-031's refusal was the one outcome left unnamed. Entry R9 settled both the `not_found`/`invalid_target` split for a vanished versus an illegal target and the rule that every outcome a reorder can return carries a message of its own ([`specs/008-board-columns/spec.md`](../008-board-columns/spec.md) FR-010, FR-032).
- Q: On the `field_changed` row a cross-lane drop writes, what does `field` hold, and what is written when the drop clears the assignee? → A: **The literal `column`, `priority` or `assignee`, with `from_value`/`to_value` as frozen display names rather than ids; a drop into Unassigned writes a null `to_value`, which the feed renders as the literal `"None"`.** Entry R7 fixed all three for `updateIssue`'s own rows ([`specs/007-comments-activity-feeds/spec.md`](../007-comments-activity-feeds/spec.md) FR-056, FR-007, FR-030), and a drop is the same change made by another gesture, so the board writes the shape that already exists rather than a second one.
- Q: In a lane that accepts no drop — a deactivated user still holding issues in this project — does the "Add a card" composer render? → A: **Yes, rendered and disabled with its reason inline, never hidden**, the same treatment the lane's refused drop already carries. `OT-UX-021`'s disabled-not-hidden rule covers every unusable control on this screen and reserves hiding for admin-only navigation (FR-052), and FR-037 excludes a deactivated user from the assignee pool a composer in that lane would have to write, so the control exists and refuses rather than disappearing.
- Q: Is the grouping choice carried in the board's URL, or held only as in-page state? → A: **In-page state only — no query parameter and no second route**, so one project's board has exactly one URL under all three groupings. FR-001 admits one board route and no second one, FR-015 makes the header control the only input to grouping, and FR-020 already fixes the choice as page state that resets to Column on each arrival; a shareable `?group=` variant is a board URL [`docs/product/specifications.md`](../../docs/product/specifications.md) never describes.

### Session 2026-09-05

- Q: In what order do the lanes within the third Assignee group — people still assigned an issue in this project but outside the assignee pool — render? → A: **The same ordering as the pool, `lower(last_name)` then `lower(first_name)`, applied to the third group as its own block after the pool and never interleaved with it.** `listAssigneePool` already orders people by exactly that expression ([`src/features/issues/server/issue-queries.ts`](../../src/features/issues/server/issue-queries.ts)), so the still-assigned-outside-pool read this feature adds produces the sequence with the same `ORDER BY` and entry R6's query is left untouched. It is also the only ordering the product has for people: [`docs/product/specifications.md`](../../docs/product/specifications.md) fixes an order for the sidebar's projects (§3, alphabetical by name), for Labels (§3.10, alphabetical) and for Accounts (§3.9, active first then deactivated), and none for a list of people by name. One rule across both groups keeps FR-021's "only the meaning of a lane differs" true of the lane sequence itself.
- Q: In an Assignee lane whose person is outside the assignee pool, what does the chevron beside that lane's disabled composer do for a member? → A: **The chevron renders disabled too, carrying the same inline reason as the composer beside it — for a member exactly as for a non-member — so the board never opens the Create issue page carrying an `assigneeId` outside the pool.** `OT-UX-021` names "the board's inline composer and its chevron" as one entry point that renders disabled with an inline reason rather than hidden ([`docs/product/requirements-index.md`](../../docs/product/requirements-index.md)), and the reason the fourth Clarification of 2026-09-04 disabled that lane's composer — FR-037 excludes the person from the pool the composer would have to write — holds identically for the preselection the chevron would have to carry (FR-048). Entry R6's form offers nowhere to show such a value either: [`src/features/issues/components/create-issue-form.tsx`](../../src/features/issues/components/create-issue-form.tsx) builds its Assignee `Select` from `listAssigneePool` plus **Unassigned** alone, so a `selectedKey` outside that collection has no item and renders indistinguishably from Unassigned, and this feature is not chartered to redesign that screen. The page's rule that a preselection the project does not admit is dropped and the form renders its own default (FR-048, research E-3) is unchanged and now covers only a hand-typed URL — nothing the board itself can emit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anyone signed in opens a project and reads its board (Priority: P1)

A signed-in user follows the sidebar's project entry, or the Board tab in the project header, to `/projects/:projectKey`. Until now that route answered "This doesn't exist". It now renders the project's board: the project's own columns in board order, each a list of the cards it holds, each card showing its key, its title, and whatever of priority, labels, assignee, due date and comment count is set on it. Clicking a card leaves the board for that issue's own page at a shareable URL. A column holding nothing says so in one quiet line.

**Why this priority**: This is the screen the roadmap calls the app's centre of gravity, and it is the destination of two navigation paths entries R2 and R5 already shipped pointing at a route that refuses. Every other story here operates on cards this one renders. Until the board renders at all, a project's issues are reachable only one deep link at a time.

**Independent Test**: Sign in against a project holding its five seeded columns and a handful of issues spread across them, open `/projects/:projectKey`, and confirm each column renders in board order with its name, its live issue count and its cards in `(sort_order, id)` order; that a card shows its key and title plus only the optional fields actually set on it; that an empty column shows one line rather than an illustration; and that clicking a card lands on that issue's detail page. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** a signed-in user and a project holding its five seeded columns, **When** they open `/projects/:projectKey`, **Then** the board renders those five columns in board order, each showing its name and the number of issues currently in it.
2. **Given** a project holding issues, **When** the board renders, **Then** each column lists exactly the issues whose column it is, ordered by `(sort_order, id)` and by nothing else.
3. **Given** an issue with a priority, labels, an assignee, a due date and comments, **When** its card renders, **Then** the card shows its key, its title, a priority glyph, its labels, its assignee's avatar, its due date and its comment count — and nothing else.
4. **Given** an issue with none of those optional fields set, **When** its card renders, **Then** the card shows its key and title alone, with no placeholder, no empty slot and no "unassigned" chip.
5. **Given** a label on a card, **When** it renders, **Then** it is told apart by its name alone and carries no colour swatch, as a project, a column and a label each do everywhere else in the product.
6. **Given** a column holding no issues, **When** the board renders, **Then** that column shows one quiet line and no illustration, and its composer still renders at its foot.
7. **Given** a user reading the board, **When** they activate a card, **Then** the issue opens as a full page at its own URL rather than as a peek panel over the board.
8. **Given** a board still loading, **When** it renders, **Then** it shows skeletons matching the column layout they replace, never a full-screen spinner, and the layout does not shift when the data lands.
9. **Given** a project key no project holds, **When** a signed-in user opens that route, **Then** they get the "This doesn't exist" treatment rather than a permission refusal, because every project is readable by every signed-in user.
10. **Given** an unauthenticated request to the board route, **When** it is made, **Then** it redirects to sign-in and never reaches the board or the Forbidden screen.
11. **Given** a project with more columns than fit the viewport, **When** the board renders, **Then** the board scrolls to reach them, with no responsive layout and no mobile breakpoint anywhere in this feature.
12. **Given** an archived project, **When** its board is opened, **Then** it renders exactly as an active project's does — archiving touches no issue and takes no write access from a member.

---

### User Story 2 - A member drags a card to move it between lanes and to reorder it within one (Priority: P2)

A member drags a card from one lane to another, or to a different position inside the lane it is already in. The card lands where it was dropped and stays there. One call reaches the server per drop, touching one row: the issue's ordering index, and — only when the drop crossed lanes — the one field the current grouping represents. The card moves the instant it is dropped rather than after the server answers, and on a refusal it goes back where it came from with a toast naming what failed and why.

**Why this priority**: Drag is the board's primary gesture and the reason the screen exists; §2 names editing an issue as the work itself and dragging a card as an update. It ranks below Story 1 because a board that renders is readable and usable through the issue rail entry R6 already ships, while a drag with nothing to drag onto is not a feature at all.

**Independent Test**: As a member, drag a card from Todo to In Progress and confirm exactly one issue row changed — its column and its ordering index — and no other issue's index moved; drag a card up two positions inside one column and confirm only its ordering index changed and its column did not; confirm the card renders in its new position before the server answers and returns to its origin with a toast if the call fails.

**Acceptance Scenarios**:

1. **Given** a member dragging a card into a different column, **When** they drop it, **Then** exactly one `moveIssue` call is made, exactly one issue row is written, and no other issue's ordering index is touched.
2. **Given** a member dropping a card between two cards, **When** the write lands, **Then** the moved issue's ordering index sorts strictly between its two new neighbours' indexes under the same ordering the board reads.
3. **Given** a member dropping a card at the head of a lane, **When** the write lands, **Then** its index sorts before every card in that lane; dropping at the foot places it after every card in that lane.
4. **Given** a member reordering a card inside the lane it is already in, **When** they drop it, **Then** only the ordering index is written and the field the grouping represents is left exactly as it was.
5. **Given** a member dragging a card, **When** they drop it back on the position it already occupies, **Then** nothing is written and no activity row is created.
6. **Given** a member dropping a card, **When** the move is applied, **Then** the card renders in its new position immediately, before the server has answered.
7. **Given** an optimistically applied drop, **When** the server refuses it, **Then** the card returns to the exact position it came from and a toast names what failed and why, naming the project where the refusal is a permission one.
8. **Given** two issues that come to hold the same ordering index, **When** the board renders them, **Then** both render, the tie is broken by id — which is creation order — and nothing repairs, rewrites or renormalizes either index.
9. **Given** a member dragging a card, **When** they complete the whole gesture with the keyboard alone, **Then** the same drop is made, with an accessible name on every drop target and a visible focus indicator throughout.
10. **Given** a member dragging a card, **When** they abandon the drag with Escape or drop it outside any lane, **Then** nothing is written and the card returns to where it started.
11. **Given** a card dropped into a `done`-kind or `canceled`-kind column, **When** the drop is made, **Then** it is accepted with no confirmation and no guardrail, and dragging it straight back out is accepted the same way — every transition is legal in both directions and no column is a terminal state.
12. **Given** a drop that would move an issue to a column of another project, **When** it reaches the server, **Then** it is refused: an issue's column always belongs to the issue's own project, and an issue never changes project.

---

### User Story 3 - Anyone regroups the board by Column, Assignee or Priority (Priority: P3)

The header's one per-screen control regroups the board. Under Column — the default — the lanes are the project's own columns. Under Priority they are the five priorities. Under Assignee they are the project's members plus every admin, plus anyone still assigned an issue here who is no longer a member, each listed once, with **Unassigned** first. The cards and the gesture are identical in all three; only what a lane means changes, and so does the field a cross-lane drop writes.

**Why this priority**: Grouping is what makes one board answer three questions, and it is the header control the shell contract already reserved a slot for. It ranks below Story 2 because Column grouping alone is a working Trello board, and because every other grouping reuses Story 2's drop machinery with a different field on the end of it.

**Independent Test**: On a board with issues across several columns, assignees and priorities, switch the grouping control to Assignee and confirm the lanes are the members-plus-admins set with Unassigned first and every still-assigned non-member present exactly once; drop a card into another person's lane and confirm the issue's assignee changed and its column did not; switch to Priority, drop a card into Urgent, and confirm the priority changed and neither the column nor the assignee did.

**Acceptance Scenarios**:

1. **Given** a user arriving at the board, **When** it first renders, **Then** it is grouped by Column, which is the default.
2. **Given** the grouping control, **When** it is opened, **Then** it offers exactly Column, Assignee and Priority, and the board carries no other sort or filter control of any kind.
3. **Given** Assignee grouping, **When** the lanes render, **Then** **Unassigned** is first, followed by the project's members plus every admin, plus anyone still assigned an issue in this project who is no longer a member, each person appearing exactly once.
4. **Given** Priority grouping, **When** the lanes render, **Then** there are exactly five — Urgent, High, Medium, Low, No priority, in that order — and every issue sits in the one its priority names.
5. **Given** Assignee grouping, **When** a member drops a card into another person's lane, **Then** exactly that issue's assignee is set to that person, its column and priority are untouched, and its ordering index is written once.
6. **Given** Assignee grouping, **When** a member drops a card into **Unassigned**, **Then** the issue's assignee is cleared and nothing else about the issue but its ordering index changes.
7. **Given** Priority grouping, **When** a member drops a card into another priority's lane, **Then** exactly that issue's priority is set to that value, its column and assignee are untouched, and its ordering index is written once.
8. **Given** any grouping, **When** a member reorders a card inside one lane, **Then** no field but the ordering index is written, whichever grouping is active.
9. **Given** an issue reordered under Column grouping, **When** the board is regrouped by Assignee, **Then** its relative position there has changed too, because an issue has one order across the whole project rather than one per lane, and the board does not hide this.
10. **Given** a user who switches grouping, **When** they leave the board and come back, **Then** it is grouped by Column again — the choice is page state, not a remembered preference, and no user record holds it.
11. **Given** a lane under any grouping, **When** it renders, **Then** it shows its name and the number of cards currently in it, exactly as a column does.
12. **Given** a lane whose person is excluded from the assignee pool — a deactivated user still holding issues here — **When** it renders, **Then** their cards render in it, it accepts no drop, and its composer renders disabled with the same reason inline rather than silently ignoring either gesture.

---

### User Story 4 - A member adds a card without leaving the board (Priority: P4)

An "Add a card" composer sits at the foot of every lane. A member clicks it, types a title, presses enter, and the issue exists — in that lane, at the foot of the project's order, directly above the composer that made it. Shift-enter, or the chevron beside the composer, opens the full Create issue page instead with the lane's meaning already preselected. For a non-member the composer renders in every lane all the same, disabled, its placeholder carrying the reason in place of "Add a card".

**Why this priority**: It is the fast path onto the board and the second entry point into issue creation, and it is where `OT-UX-021`'s disabled-not-hidden rule is exercised. It ranks below grouping because entry R6's Create issue page is a complete creation path already, and because the composer's behaviour under Assignee and Priority grouping is defined in terms of the lanes Story 3 establishes.

**Independent Test**: Under Column grouping, type a title into In Progress's composer and press enter; confirm one issue is created in that column, that it renders as the last card in the lane directly above the composer, and that no existing issue's ordering index changed. Press shift-enter instead and confirm the Create issue page opens with In Progress preselected. Sign in as a non-member and confirm the composer renders in every lane, disabled, with the reason naming the project in its placeholder.

**Acceptance Scenarios**:

1. **Given** a member on the board under Column grouping, **When** they type a title into a column's composer and press enter, **Then** one issue is created in that column with that title and no other field set, and the composer clears and stays ready for the next one.
2. **Given** an issue created from the composer, **When** the lane re-renders, **Then** it is the last card in that lane, directly above the composer that made it, and no existing issue's ordering index was written.
3. **Given** a member using the composer, **When** they submit an empty or whitespace-only title, **Then** nothing is created and the refusal is inline on the field.
4. **Given** a member using the composer, **When** they press shift-enter, or activate the chevron beside it, **Then** the full Create issue page opens with that lane's meaning preselected and the typed title carried across.
5. **Given** Assignee grouping, **When** a member adds a card in a person's lane, **Then** the issue lands in the project's first column by board order and carries that person as its assignee; in **Unassigned** it lands in the same column with no assignee.
6. **Given** Priority grouping, **When** a member adds a card in a priority's lane, **Then** the issue lands in the project's first column by board order and carries that priority.
7. **Given** Assignee or Priority grouping, **When** a member uses the chevron, **Then** the Create issue page opens preselecting the same column and the same assignee or priority the composer would have written.
8. **Given** a member submitting the composer, **When** the call is in flight, **Then** the control shows in-flight state and the card does not appear until the server answers — creation is not optimistic, because an issue's number is assigned server-side and its key cannot be rendered before it is known.
9. **Given** a non-member on the board, **When** it renders, **Then** the composer is present in every lane, disabled, its placeholder carrying the reason and naming the project, and it is never hidden.
10. **Given** a non-member, **When** they reach the Create issue route by deep link, bookmark or a tab whose membership lapsed, **Then** the route answers Forbidden independently of what the board rendered.
11. **Given** a member on an archived project, **When** they use the composer, **Then** it works exactly as on an active project.

---

### User Story 5 - The board keeps itself current, and the last drop to land wins (Priority: P5)

The board re-queries the server when the window regains focus and every thirty seconds while it is the active tab, so a card someone else moved appears without anyone navigating. If a re-query lands while a drag is in progress, the board updates underneath the drag: the drag is not cancelled, and the drop then resolves against the neighbours that are actually there. Two people moving the same card is not an error — the last write to reach the server wins outright, and the loser learns of it from the next re-query rather than from a rejected write.

**Why this priority**: It is what makes a shared board usable without live push, which §1 puts out of scope for v1. It ranks last among the write stories because every earlier one is correct without it — the board is merely stale — and because it is defined entirely in terms of the drops Story 2 delivers.

**Independent Test**: Open the board, move a card from a second session, and confirm the first board shows the move within thirty seconds without navigation, and immediately on refocusing the window. Begin a drag, let a re-query land mid-gesture, and confirm the drag survives it and the drop resolves against the refreshed neighbours. Issue two conflicting moves for one card and confirm the later one is the state that persists and that neither client was shown a rejection.

**Acceptance Scenarios**:

1. **Given** an open board that is the active tab, **When** thirty seconds pass, **Then** it re-queries the server and renders whatever it finds.
2. **Given** a board in a window that has lost focus, **When** the window regains focus, **Then** the board re-queries immediately.
3. **Given** a drag in progress, **When** a re-query lands, **Then** the drag continues, the board updates underneath it, and the drop resolves against the refreshed neighbours rather than the stale ones.
4. **Given** two members moving the same card to different places, **When** both calls reach the server, **Then** the later one is the state that persists, neither call is rejected for staleness, and no row is locked to prevent it.
5. **Given** a client whose board is stale, **When** it re-queries, **Then** it learns of the other move there and only there — never from a refusal to its own write.
6. **Given** an in-flight drop of the caller's own, **When** a re-query lands before the server answers, **Then** the optimistic position is not overwritten by the older data the re-query carries, and the settled state comes from the caller's own write.
7. **Given** a board being re-queried, **When** the data lands unchanged, **Then** nothing about the rendering shifts and no skeleton is shown for a refresh.
8. **Given** a board whose issue was deleted by an admin elsewhere, **When** the next re-query lands, **Then** the card is gone from the board with no error shown, and a drop already in flight for it is refused as a missing row rather than as a permission refusal.
9. **Given** a board whose column was deleted by an admin elsewhere, **When** the next re-query lands, **Then** the lane is gone under Column grouping and every remaining card is still in a lane.
10. **Given** a lost connection, **When** a drop is attempted, **Then** it is refused with the connection message, nothing is queued for later, and the card returns to where it came from.

---

### User Story 6 - A non-member reads the board and cannot change it (Priority: P6)

Everyone signed in reads every board. A user who is not a member of this project sees the same board with the same shape: the same lanes, the same cards, the same counts. What differs is the affordances — no card is draggable, every composer is disabled with its reason, and the header's New issue button carries the same reason. A user assigned an issue here without being a member is a real, supported state: they see their card and cannot move it, and the board tells them which project they would need to be added to.

**Why this priority**: It is a variation on the five stories above rather than a surface of its own, and none of them is blocked by it. It is last because the enforcement it describes is the server-side check every earlier story already requires, tested from the other side.

**Independent Test**: Sign in as a signed-in non-member of the project, open its board, and confirm the lanes, cards and counts are identical to a member's view; that no card can be dragged; that every composer is disabled with the reason naming the project; and that a `moveIssue` call issued directly is refused. Confirm an assigned non-member sees their own card and the project it belongs to named.

**Acceptance Scenarios**:

1. **Given** a signed-in non-member, **When** they open the board, **Then** every lane, card, count and empty-lane line is exactly what a member sees.
2. **Given** a signed-in non-member, **When** they attempt to drag a card, **Then** no drag begins and no call is made.
3. **Given** a signed-in non-member, **When** the board renders, **Then** every composer and every entry point to Create issue is disabled with an inline reason naming the project, and none of them is hidden.
4. **Given** a non-member who issues a `moveIssue` call directly, **When** it reaches the server, **Then** it is refused, whatever the board rendered.
5. **Given** a member whose membership is removed while their board is open, **When** the next render happens, **Then** the controls become disabled with their reason, no card leaves the board, and their in-flight drop is refused and rolled back.
6. **Given** an assigned non-member, **When** they open the board, **Then** their card renders, they cannot move it, and the board names the project they would need to be added to.
7. **Given** any signed-in user, **When** they read a board, **Then** nothing implies a hidden-access state, because every project is readable and a row that is missing genuinely does not exist.
8. **Given** an admin who holds no membership row for this project, **When** they open the board, **Then** they may drag, compose and move exactly as a member does, and under Assignee grouping they have a lane of their own.

---

### Edge Cases

- **A drop whose target lane vanished between the render and the write** — the column was deleted, or the person was removed and holds no issue here — is refused as a missing row rather than as a permission refusal or an invalid input, and the board refreshes rather than showing a rejection the user cannot act on.
- **A drop onto a column of another project**, reachable only by a call the board never makes, is refused as an invalid target: an issue's column belongs to its own project, and an issue never changes project.
- **A drop under Assignee grouping onto a person excluded from the assignee pool** — a deactivated user — is refused, and the lane renders as one that accepts no drop, with its composer disabled and carrying the same reason, rather than one that silently swallows either gesture.
- **A drop of an issue whose row was deleted mid-drag** is refused as a missing row, and the card is gone at the next re-query.
- **Two drops landing in the same instant** both succeed; the later write is the state that persists and neither is rejected.
- **Two issues holding the same ordering index** both render, ordered by id, and neither index is ever repaired — a tie is a legal state, not a defect to fix.
- **A drop between two neighbours whose indexes are adjacent to the precision the scheme allows** still produces an index that sorts between them, and if it cannot, the drop is refused rather than silently placed elsewhere or resolved by renumbering other rows.
- **A card dropped into the lane it is already in, at the position it already occupies**, writes nothing at all.
- **A re-query that lands mid-drag and removes the card being dragged** ends the drag without a write and without an error, because there is nothing left to drop.
- **A lane holding hundreds of cards** renders them all in `(sort_order, id)` order; there is no pagination on a lane and no "show more" control, since none is specified.
- **A project whose only column was just renamed elsewhere** re-renders with the new name at the next re-query; the name on a card's lane is read live, not frozen.
- **An issue whose assignee was deactivated** keeps its assignment and its card, and gains a lane under Assignee grouping that accepts no drop.
- **The composer submitted twice in quick succession** creates two issues, each at the foot of the project's order, and neither touches the other's index.
- **A window that never regains focus** still re-queries on the thirty-second interval only while the board is the active tab.

## Requirements *(mandatory)*

### Functional Requirements

#### The board route and the shell it renders inside

- **FR-001**: This feature MUST render the board at `/projects/:projectKey`, replacing the placeholder that answers "This doesn't exist" today. It MUST create no second board route and no board modal. (§3, screen 3, `OT-SCOPE-007`)
- **FR-002**: Every signed-in user MUST be able to read every project's board, its lanes, its cards and its counts. Membership MUST be a write boundary here and MUST NOT be used as a visibility one anywhere in this feature. (`OT-AUTHZ-002`)
- **FR-003**: An unauthenticated request to the board route MUST redirect to sign-in and MUST NOT reach the board or the Forbidden screen. A request naming a project key no project holds MUST get the "This doesn't exist" treatment, never a permission refusal. (`OT-UX-004`, `OT-AUTHZ-011`)
- **FR-004**: The board MUST render inside the shell entry R2 delivers, using the project header entry R5 delivers — the project's name, its comment count and the Board / Details tab pair — and MUST add nothing to that header but its one per-screen control. (§3 *The shell*, §3.8)
- **FR-005**: The grouping control MUST occupy the header's single per-screen control slot, and the header's **New issue** button MUST be left exactly as entries R2 and R6 deliver it. (§3 *The shell*)
- **FR-006**: The board MUST target a desktop browser only. No responsive layout and no mobile breakpoint MUST be shipped, and a board wider than the viewport MUST be reached by scrolling. (`OT-SCOPE-004`)
- **FR-007**: While the board's data is loading it MUST show skeletons matching the lane layout they replace, never a full-screen spinner, and the layout MUST NOT shift when the data lands. A re-query of an already-rendered board MUST NOT show a skeleton. (§4 *Loading*)
- **FR-008**: A lane holding no cards MUST show one quiet line and no illustration, and MUST still render its composer. (§3.3, §4 *Empty*)

#### The lane and the card face

- **FR-009**: Every lane MUST show its name and the number of cards currently in it, under every grouping. (§3.3)
- **FR-010**: A card MUST show the issue's key and title, and, only when set, a priority glyph, its labels, its assignee's avatar, its due date and its comment count. It MUST show nothing else, and MUST render no placeholder for an unset field. (§3.3)
- **FR-011**: Nothing on a card MUST carry a colour that identifies a project, a column or a label; those three are told apart by name alone, and no swatch MUST be rendered for any of them. (§7 *Palette*)
- **FR-012**: A card's key MUST be the project key and the issue's number as entry R6 renders it elsewhere, and MUST NOT be recomputed or reformatted here. (§5 *Keys*)
- **FR-013**: Activating a card MUST open that issue's detail page as a full page at its own URL, never as a peek panel over the board. (§3.3)
- **FR-014**: Every value on a card — a label's name, an assignee's display name, a column's name — MUST be read live for each render rather than frozen, so a rename elsewhere follows on the next re-query. (§3.10, §5)

#### Grouping

- **FR-015**: The board MUST offer exactly three groupings — Column, Assignee and Priority — and MUST default to Column. No sort control and no filter control MUST exist on this screen: drop position is the only ordering input. (§3.3)
- **FR-016**: Under Column grouping the lanes MUST be the project's own board columns in board order, and MUST be exactly the columns entry R9 maintains, read rather than edited. Column editing MUST NOT be offered on the board. (§3.3, §3.8)
- **FR-017**: Under Priority grouping the lanes MUST be the five priorities in the order Urgent, High, Medium, Low, No priority, and every issue MUST sit in the lane its own priority names. (§3.3, §3.5, §5)
- **FR-018**: Under Assignee grouping the lanes MUST be **Unassigned** first, then the project's `project_member` rows plus every admin with deactivated users excluded, then anyone still assigned an issue in this project who is not in that set — each person appearing exactly once. Both people groups MUST be ordered by `lower(last_name)`, then `lower(first_name)`, and the third group MUST render as its own block after the pool rather than interleaved with it. (§3.3, `OT-AUTHZ-007`, `OT-AUTHZ-015`; the third group's order per Clarifications 2026-09-05)
- **FR-019**: **Unassigned** MUST be ordered first under Assignee grouping, because assignee is optional and those cards must land somewhere. (§3.3)
- **FR-020**: The grouping choice MUST be page state and MUST NOT be persisted on the user record or anywhere else, so a revisit renders Column grouping again. It MUST NOT be carried in the URL either — no query parameter and no second route — so one project's board has exactly one URL under all three groupings. No field for it exists in the data model and this feature MUST NOT add one. (§4 *Stale after navigation*, §5; the URL question per Clarifications 2026-09-04)
- **FR-021**: The card face, the drag gesture and the composer MUST be identical under all three groupings. Only the meaning of a lane, and therefore the field a cross-lane drop writes, MUST differ. (§3.3)

#### Ordering

- **FR-022**: An issue MUST carry one ordering index across the whole project — a base-62 fractional index — and MUST NOT carry one index per lane. Every grouping MUST be that single sequence, filtered. (`OT-DATA-017`, §3.3)
- **FR-023**: Every ordered query the board makes MUST sort by `(sort_order, id)` and by nothing else, so the tie-break is creation order. (`OT-DATA-017`)
- **FR-024**: Ties MUST be legal. No path in this feature MUST detect, repair, renumber or rebalance ordering indexes, and a tie MUST NOT be treated as an error state. (`OT-DATA-017`)
- **FR-025**: Reordering under one grouping MUST also change relative position under the others, and the board MUST NOT hide or compensate for this. (§3.3)
- **FR-026**: `createIssue` MUST remain the only ordering write that does not originate from a drop, and MUST continue to place a new issue after every existing issue in the project without touching an existing row. This feature MUST add callers to it and MUST NOT change that behaviour. (`OT-DATA-018`, §3.3 *Creation*)
- **FR-027**: The ordering column MUST remain the `sort_order` field entry R6 already writes, under the collation the data-model conventions fix, and this feature MUST create no table and no new ordering column. (§5)

#### The `moveIssue` mutator

- **FR-028**: One drop MUST produce exactly one `moveIssue` call, and one `moveIssue` call MUST write exactly one issue row. No neighbouring row MUST be written by a drop. (`OT-DATA-017`, §3.3)
- **FR-029**: `moveIssue` MUST write `sort_order` on every accepted call, and MUST additionally write exactly one further field only on a cross-lane drop: `column_id` under Column grouping, `assignee_id` under Assignee grouping, `priority` under Priority grouping. It MUST write no other field. (§3.3)
- **FR-030**: A drop within one lane MUST write `sort_order` alone, and MUST leave the field the grouping represents exactly as it was. (§3.3)
- **FR-031**: A drop MUST name the issue, the target lane and the card it was dropped before or after — or the lane's head or foot — and MUST NOT carry an ordering index the client computed; `moveIssue` MUST read those neighbour rows inside its own write and derive the index itself, so a client-supplied `sort_order` is neither accepted nor trusted. The written index MUST sort strictly between the indexes of the drop's two new neighbours under `(sort_order, id)`; before every card in the lane for a head drop, and after every card in the lane for a foot drop. Where no index between two neighbours can be produced, the call MUST be refused as `no_index_available` rather than placing the card elsewhere or renumbering any other row. (`OT-DATA-017`, `AGENTS.md` → Principle II and change gate 3; the payload shape and the refusal name per Clarifications 2026-09-04)
- **FR-032**: A drop resolving to the position the card already occupies, with no field change, MUST write nothing and MUST create no activity row. (§3.3)
- **FR-033**: `moveIssue` MUST require `isMember` of the affected project, and the project MUST be derived server-side from the stored issue row rather than from any client-supplied project identifier. (`OT-AUTHZ-004`, §2 *Write rules per mutator*)
- **FR-034**: `moveIssue` MUST refuse a caller it cannot find the issue for as a missing row rather than as a permission refusal, since every issue is readable by every signed-in user; only then MUST it evaluate membership. A target that has vanished — a deleted column, or a person who is neither in the assignee pool nor still assigned here — MUST be reported the same way. (`OT-AUTHZ-005`, `OT-UX-004`)
- **FR-035**: `moveIssue` MUST refuse a target that exists but is not legal — a column belonging to another project — as an invalid target, distinctly from a missing row. (`OT-INV-004`, §5 invariant 4)
- **FR-036**: `moveIssue` MUST NOT change an issue's project under any grouping, and MUST accept no project field on any call. (§5 invariant 2)
- **FR-037**: `moveIssue` MUST accept only a priority the enumeration admits, and only an assignee drawn from the assignee pool — `project_member` rows plus every admin, deactivated users excluded — or no assignee at all for a drop into **Unassigned**, which MUST clear the field. Every one of these MUST be validated server-side on every call, whatever the board rendered. (`OT-AUTHZ-007`, `OT-DATA-003`, §5)
- **FR-038**: `moveIssue` MUST write `updated_at` explicitly through the shared helper, following the data-model conventions entry R1 established rather than restating them. (`OT-DATA-002`)
- **FR-039**: `moveIssue` MUST remain available on an archived project, exactly as `updateIssue` is: archiving touches no issue, and members keep write access. Project status MUST NOT be a condition on any call. (§4 *Nothing cascades*)
- **FR-040**: Every column-to-column transition MUST be legal in both directions, with no terminal state, no guardrail and no confirmation — including a drop into or out of a `done`-kind or `canceled`-kind column. (`OT-OPS-011`, §4)

#### Drag, optimism and refusal

- **FR-041**: A drop MUST apply optimistically — the card MUST render in its new position before the server answers — and on a refusal MUST roll back to the exact position it came from with a toast naming what failed and why, naming the project where the refusal is a permission one. `moveIssue` MUST refuse with exactly one of four outcomes — `not_found` (FR-034), `invalid_target` (FR-035), `forbidden` (FR-033) and `no_index_available` (FR-031) — and each MUST carry a message of its own rather than a shared generic one. (`OT-UX-008`, §4 *Rejected write*; the outcome set per Clarifications 2026-09-04)
- **FR-042**: An abandoned drag — Escape, or a drop outside any lane — MUST write nothing and MUST return the card to its origin.
- **FR-043**: A drag MUST be completable with the keyboard alone. Every drop target MUST carry an accessible name, every control a visible focus indicator, and no state or error MUST be conveyed through colour alone. (§7 *Frontend rules*)
- **FR-044**: Interaction behaviour, focus management, keyboard support and ARIA semantics for the drag MUST come from React Aria's own drag and drop, which the stack already names for this board; Tailwind MUST supply the visual layer only. (§7)
- **FR-045**: A drop attempted with no connection MUST be refused with the connection message, MUST queue nothing for later, and MUST return the card to where it came from. (§4 *Connection lost*)

#### The inline composer and the chevron

- **FR-046**: An "Add a card" composer MUST sit inline at the foot of every lane, under every grouping. It MUST take a title and nothing else, and enter MUST create the issue. (§3.3)
- **FR-047**: Under Column grouping the composer MUST create the issue in that column. Under Assignee or Priority grouping it MUST create the issue in the project's first column by board order, carrying the assignee or the priority its lane represents. (§3.3)
- **FR-048**: Shift-enter, and a chevron beside the composer, MUST open the full Create issue page entry R6 delivers, preselecting exactly what the composer would have written — that column, or the first column plus the lane's assignee or priority — and carrying across any title already typed. The page MUST pass a preselection to the form only where the project admits it — the column among its own, the assignee in the assignee pool, the priority one the enumeration accepts — and MUST drop anything else and render its own default rather than showing it; because the chevron never offers a value outside those sets, that drop can only ever answer a hand-typed URL. (§3.3, §3.5)
- **FR-049**: The composer MUST call the `createIssue` mutator entry R6 delivers, unchanged, so the new issue lands at the foot of the project's single order and therefore directly above the composer that made it, with no existing row touched. (`OT-DATA-018`, §3.3 *Creation*)
- **FR-050**: A composer submission MUST NOT be optimistic: it MUST show in-flight state on the control and MUST wait for the server, because the issue's number is assigned server-side under a row lock and its key cannot be rendered before it is known. (`OT-UX-008`, §3.5, §5 *Keys*)
- **FR-051**: A title MUST be required and trimmed; an empty or whitespace-only submission MUST be refused inline with nothing created, and the length bound every title in the product carries MUST be enforced on the server independently of the field. (§3.5, `OT-DATA-003`)
- **FR-052**: For a non-member the composer MUST render in every lane, disabled, its placeholder carrying the reason in place of "Add a card" and naming the project. It MUST NOT be hidden, and neither MUST the chevron — the hide-rather-than-disable rule covers admin-only navigation only. In a lane that accepts no drop — a deactivated user still holding issues here — the composer MUST render for a member too, disabled and carrying its reason inline, and so MUST the chevron beside it, because FR-037 excludes that person from the assignee pool the composer would have to write and from the preselection the chevron would have to carry. (`OT-UX-021`, §3.3, §3.8; the excluded lane's composer per Clarifications 2026-09-04, its chevron per Clarifications 2026-09-05)
- **FR-053**: The Create issue route MUST still answer Forbidden to a non-member who reaches it directly, independently of what the board rendered. The disabled control and the Forbidden screen MUST be independent, neither implying the other was skipped. (`OT-UX-021`, §3.5)

#### Freshness, drift and conflict

- **FR-054**: The board MUST re-query the server on window focus and every thirty seconds while it is the active tab. (`OT-OPS-008`, §4 *Board drift*)
- **FR-055**: A re-query landing mid-drag MUST update the board underneath the drag and MUST NOT cancel it; the drop MUST then resolve against the fresh neighbours rather than the stale ones. (`OT-OPS-008`)
- **FR-056**: A re-query MUST NOT overwrite the caller's own in-flight optimistic drop with older data; the settled state for that card MUST come from the caller's own write. (`OT-UX-008`, `OT-OPS-008`)
- **FR-057**: There MUST be no locking and no live push. The last `moveIssue` to reach the server MUST win outright, and a losing client MUST learn of staleness only from the periodic re-query, never from a rejected write. (`OT-OPS-009`, §1)
- **FR-058**: Nothing MUST render from a client cache on a revisit; a revisited board MUST re-query the server. (§4 *Stale after navigation*)
- **FR-059**: A re-query whose data is unchanged MUST cause no visible change and no layout shift.

#### Activity this feature writes

- **FR-060**: A cross-lane drop MUST write exactly one `field_changed` activity row on that issue's own feed, in the same database transaction as the move, through the writing function entry R7 established — `field` holding the literal value `column`, `priority` or `assignee` exactly as entry R7's `updateIssue` rows do, with the from and to values as frozen display strings, a column's or a person's **name** rather than an id, truncated to the bound every such value carries. A drop into **Unassigned** MUST write a null `to_value`, which the feed renders as the literal `"None"`. A drop that changes no field MUST write none. (§3.4, §5 `activity`, `OT-DATA-020`; the field values and the cleared-assignee case per Clarifications 2026-09-04)
- **FR-061**: A reorder within one lane MUST write no activity row: the ordering index is not among the scalars a `field_changed` row names, and card position is not part of an issue's history. (§3.4, §5 `activity`)
- **FR-062**: No card move MUST write a row to the **project's** feed. The project feed is about the project record itself and MUST NOT become a merge of its issues' feeds. (§3.8)
- **FR-063**: This feature MUST widen no enumeration and MUST add no activity type: `field_changed` already exists and already admits the column, priority and assignee scalars. (§5 `activity`)
- **FR-064**: An activity row, once written, MUST never be updated and MUST be deleted only by cascade from the issue it belongs to. This feature MUST deliver no path that edits or deletes one. (§5 invariant 11)

#### Authorization at the boundary, restated where this feature enforces it

- **FR-065**: The client MAY run the same predicates to decide what to render; the server check MUST be the enforcement, never the reverse, and every mutator MUST refuse a call made from a page whose controls were rendered under a membership the caller no longer holds. (`OT-AUTHZ-005`, `OT-AUTHZ-012`)
- **FR-066**: A member who loses membership while the board is open MUST have the drag and the composers become disabled with their reason on the next render, with no card removed and nothing else about the board changed; an in-flight drop MUST be refused and rolled back. (`OT-AUTHZ-012`, §2 *Consequences the UI must handle*)
- **FR-067**: An assigned non-member MUST be a supported state on this screen: their card renders, they cannot move it, and the board names the project they would need to be added to. (`OT-AUTHZ-015`)
- **FR-068**: An admin MUST be able to drag, compose and move on every project's board without holding a membership row, and MUST have a lane of their own under Assignee grouping. (§2)
- **FR-069**: The board MUST NOT imply a hidden-access state anywhere: a row that is missing genuinely does not exist. (§3.11)

### Out of Scope

- **Locking, live push and real-time collaboration.** Out of scope for v1 by §1. This feature ships no subscription, no socket and no lock; freshness comes from the re-query in FR-054 and from nothing else.
- **Every notification a move or a composed card causes.** Entry R11 owns the `notification` table and all three types. Under `OT-OPS-016` a cross-lane drop under Assignee grouping sets `issue.assignee_id` and must write one `assignment` row — R11 adds that to the `moveIssue` this feature delivers, and this feature writes no notification row of any kind.
- **The progress figure that reads `done`- and `canceled`-kind columns.** Entry R12's, on Home. This feature reads a column's `kind` for nothing at all.
- **Column editing.** Entry R9's, on project details. The board reads columns and never adds, renames, reorders or deletes one.
- **Label curation.** Entry R8's. The board renders a card's labels and offers no way to change them.
- **Any field edit that is not a drop.** The issue rail entry R6 delivers is the place a field is changed by hand; the board offers no inline field control on a card.
- **Deleting an issue from the board.** Entry R6's `deleteIssue`, admin-only, from the issue's own page. A member removes an issue by dragging it into a `canceled`-kind column.
- **A list view, a calendar view, search, filtering and a command palette.** All out of scope for v1 by §1, and the board carries no control for any of them.
- **Pagination inside a lane.** No source specifies one, so a lane renders every card it holds.
- **Sub-issues, attachments and issue hierarchy.** Out of scope for v1 by §1; issues are flat and a card references no other card.

### Key Entities

- **Issue** — the card. This feature writes three of its existing fields and only on a drop: its ordering index always, and its column, assignee or priority according to the grouping. It creates no field and no table.
- **Board column** — the lane under Column grouping. Read here, owned and edited by entry R9. Its `kind` is read by nothing in this feature.
- **Project member** — with every admin, the source of the assignee lanes and of the write boundary this board enforces.
- **Activity** — one `field_changed` row per cross-lane drop, on the issue's own feed, written through entry R7's writer in the move's own transaction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can move any card to any position in any lane, under all three groupings, from one screen and with no navigation.
- **SC-002**: Every drop writes exactly one issue row — verified by taking a full census of every issue's ordering index before and after each drop and finding exactly one changed.
- **SC-003**: A card dropped between two others sorts between them on 100% of drops, verified by re-reading the board's own ordering rather than by trusting the optimistic render.
- **SC-004**: A same-lane reorder changes no field but the ordering index, and a cross-lane drop changes that index and exactly one other field, on 100% of drops.
- **SC-005**: Ordering indexes are never repaired: after a hundred drops including deliberate ties, every index that was not itself the subject of a drop holds the value it started with, and tied cards still render in id order.
- **SC-006**: Regrouping the board renders the same cards in every grouping, with no card missing from every lane and no card in two lanes, including cards with no assignee and no priority.
- **SC-007**: Two conflicting moves of one card leave the later write's state in the database on 100% of attempts, with neither client shown a rejection.
- **SC-008**: A stale board reflects another session's move within thirty seconds without navigation, and immediately on regaining window focus.
- **SC-009**: A drag survives a re-query landing mid-gesture on 100% of attempts, and the resulting drop places the card relative to the neighbours that are present after the re-query.
- **SC-010**: A refused drop returns the card to the position it came from on 100% of refusals, and always with a toast naming what failed and why.
- **SC-011**: Only a member or an admin can move a card; every other caller is refused on 100% of attempts, including one issued without going through a control — while every signed-in user can read every board in full.
- **SC-012**: The board renders identically for a member and a non-member — same lanes, same cards, same counts — with only affordances differing, verified by comparing the two rendered structures.
- **SC-013**: A card created from a lane's composer is the last card in that lane on 100% of creations, and no existing issue's ordering index is written.
- **SC-014**: A cross-lane drop produces exactly one activity row on the issue's feed and none on the project's; a same-lane reorder produces none — verified against the database rather than through the feed that reads it.
- **SC-015**: Every drop and every composer submission is completable with the keyboard alone, and every control this feature adds carries an accessible name and a visible focus indicator.
- **SC-016**: No card, lane or label anywhere on the board carries a colour that identifies it, and every one of the three is distinguishable by name alone.

## Assumptions

### Defaults chosen because the source is silent

- **The grouping choice is page state and is not remembered.** §5 enumerates every field of every table and carries none for a board grouping, while it carries `feed_filter` explicitly for the activity toggle that *is* remembered. Persisting the grouping would mean adding a field the data model does not have. It therefore resets to Column, the stated default, on each arrival (FR-020).
- **Priority lanes are ordered Urgent, High, Medium, Low, No priority.** §3.3 says the lanes are "the five priorities" without fixing their order; §3.5 enumerates them in exactly this order for the Create issue form's Priority field, and the board follows the order the product already shows (FR-017).
- **Assignee lanes after Unassigned are ordered by `lower(last_name)`, then `lower(first_name)`.** §3.3 fixes only that Unassigned comes first and that each person appears once. That is `listAssigneePool`'s own ordering, the only ordering the product has for people, and it is reused here rather than re-sorted on the rendered display name, which reads "First Last" and so would order differently.
- **A lane whose person is outside the assignee pool accepts no drop.** §3.3 puts a still-assigned non-member in the lane set so their cards have somewhere to live, while `OT-AUTHZ-007` excludes deactivated users from the assignee pool that a drop would write into. Both hold: the lane renders so no card is homeless, and it refuses a drop rather than assigning someone the product excludes from every picker, carrying its reason inline as any unusable control does (FR-037, US3 scenario 12).
- **The composer's create waits for the server rather than applying optimistically.** `OT-UX-008` names create issue among the larger writes that wait, and §3.5 gives the reason — the number is server-assigned and cannot be known before the response. A card cannot render its key until then (FR-050).
- **A drop that cannot be given an index between its neighbours is refused.** `OT-DATA-017` forbids repairing ties and forbids touching more than one row, so neither renumbering nor silently placing the card elsewhere is available. Refusal is the only behaviour consistent with both, and it rolls back like any other refused drop (FR-031).
- **A vanished drop target is reported as a missing row.** The source is silent on a lane deleted between render and write. This follows the treatment entry R9 fixed for exactly that race on its own mutators, and keeps an invalid-target refusal for a target that exists but is not legal (FR-034, FR-035).

### Reconciliations between the roadmap, the requirements index and the specification

- **`moveIssue` writes activity, though the roadmap's R10 row neither includes it nor defers it.** §3.4 states that an issue's feed records its column, priority, assignee and due-date changes, and §5's `field_changed` names exactly those scalars. A drag is an update (§2), so a cross-lane drop is one of those changes; were it silent, the same change would be logged from the issue rail and unlogged from the board's primary gesture, with nothing on screen to explain which. The specification outranks the roadmap's silence, so this feature writes the row (FR-060). A pure reorder writes none: the ordering index is not among the scalars `field_changed` names (FR-061), and §3.8 keeps card churn off the project's feed (FR-062).
- **The requirements index lists `OT-OPS-016` under the Board capability; the roadmap's R10 requirement list does not.** Both are right about their own subject. The drop under Assignee grouping is one of the three writes `OT-OPS-016` names, which is why the roadmap gives entry R11 a direct dependency on this one — but the `notification` table and every row written to it are R11's, so this feature carries the requirement as a downstream obligation rather than as work of its own.
- **`OT-UX-008` is attributed to entry R5 as a cross-cutting rule and named again here.** The roadmap's cross-cutting note allows exactly this: a later row names one where it materially exercises it, and drag is the rule's headline example.

### Inherited constraints, not decisions this specification makes

- The `issue` table, its `sort_order` field, the `createIssue` mutator's foot-of-the-order write, the per-project number under a row lock, the issue detail page a card links to and the Create issue page the chevron opens are entry R6's. This feature creates none of them.
- The `board_column` table, its five seeded rows, its board order and its `kind` are entry R5's, with column editing entry R9's. The board reads them.
- The label set and a card's labels are entry R8's; the `project_member` rows and the `isMember` predicate are entry R5's; the actor on every request, the data-model conventions and the length bounds are entry R1's.
- The shell, the header contract with its single per-screen control slot, the Forbidden screen, the "This doesn't exist" convention, the toast conventions and the per-screen skeletons are entry R2's; this feature renders inside them.
- The `activity` table, its append-only rule, its `field_changed` type and the single writing function are entry R7's; this feature calls that function and widens nothing.
- Interaction behaviour, focus management, keyboard support and ARIA semantics come from React Aria Components with Tailwind as the visual layer only, and the drag uses React Aria's own drag and drop, which the stack already names for this board.
- The ordering scheme's library and the fractional index it produces are already on the approved-dependency table; this feature installs nothing.

### Obligations this feature places on entries built before it

- **None on a mutator.** This feature adds callers to entry R6's `createIssue` and reads entries R5, R8 and R9's tables; it alters no mutator any earlier entry delivered and widens no constraint.
- **Entry R7's writing function must accept the `field_changed` type and the column, priority and assignee scalars at the time it runs**, which its own requirements already state. If it arrives narrower, this feature follows the shape that exists and the divergence is recorded here rather than by altering an entry that has shipped.

### Downstream reach-back this specification must state

- **Entry R11 will reach into this feature's `moveIssue`.** Under `OT-OPS-016` every write that sets `issue.assignee_id` to somebody other than the actor writes one `assignment` notification, and a cross-lane drop under Assignee grouping is one of the three such writes the specification names. R11 adds that recipient computation to `moveIssue`, in the move's own transaction, and depends on this entry directly — the roadmap's dependency graph carries the edge for exactly this reason. A drop that leaves the assignee unchanged, and one into **Unassigned** which clears it, must notify nobody, so a reorder inside a person's lane stays silent.
- **Entry R12 reads `done`- and `canceled`-kind columns** for Home's progress figure. It reads them from entry R5's table, not from anything this feature builds, and this feature reads a column's `kind` for nothing at all.

### Dependencies

**Cannot be built without** — this feature has no code path that works until each has landed:

- **R6** — the `issue` table, its `sort_order` field, `createIssue`'s foot-of-the-order write, the issue detail page a card opens and the Create issue page the chevron opens. Without it there is no card, no index to move and no page to create into.
- **R8** — the label set a card's chips render. Without it a card renders every other field and no label.
- **R9** — the columns the board renders as lanes under its default grouping, and the guarantee that a project always has at least one column, at least one `done`-kind column and at least one `canceled`-kind column, so a board is never lane-less and a member always has a route to remove an issue.
- **R5, R7, R2 and R1**, transitively — the project record, membership and the `isMember` predicate; the `activity` table and its writing function; the shell, header and Forbidden screen; and the actor, conventions and bounds every write follows.

**Consumed but not blocking** — none.

**Building this feature before R6, R8 or R9** is not a supported ordering and no requirement here anticipates it. There is no reduced board that renders without issues, and no `moveIssue` whose grouping fields are meaningful without columns and an assignee pool to move between.

**Dependency approval this feature triggers**: none. React Aria Components and its drag and drop, and the fractional-indexing scheme the ordering index uses, are already on the approved-dependency table, and nothing else here may add a package.
