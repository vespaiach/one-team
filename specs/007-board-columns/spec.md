# Feature Specification: Board columns

**Feature Branch**: `claude/r9-feature-specifications-b58787`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R9**

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "create a feature specifications for roadmap entry R9, refer to @docs/ROADMAP.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R9** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An admin adds a column to shape the board (Priority: P1)

An admin opens a project's Columns section and adds a new lane to the board. It appears at the end of the board's order, ready to be named and coloured, carrying the one kind every added column carries: `open`.

**Why this priority**: Nothing else in this feature has anything to act on until a column can be added beyond the five entry R5 seeds. It is the smallest possible write this feature makes and the one every later story builds on.

**Independent Test**: Sign in as an admin on a project holding only its five seeded columns, add one, and confirm a sixth row exists at the end of the board order, of kind `open`, without touching any of the five that already existed.

**Acceptance Scenarios**:

1. **Given** an admin on a project's Columns section, **When** they add a column, **Then** exactly one new row is created, positioned after every column that already existed, of kind `open`.
2. **Given** a project already holding six columns, **When** an admin adds a seventh, **Then** none of the existing six changes its name, colour, kind or position.
3. **Given** an admin who adds a column, **When** the write succeeds, **Then** the new column carries the palette's accent colour by default and a name the admin can rename in place immediately, using the same click-to-edit control the rest of this feature establishes.
4. **Given** a signed-in member who is not an admin, **When** they look at the Columns section, **Then** no control to add a column is offered to them, rendered disabled with a reason rather than hidden, since the section itself is already visible to them.
5. **Given** an unauthenticated caller or a non-admin who calls the add endpoint directly, **When** the call is made, **Then** it is refused independently of whatever the client rendered.

---

### User Story 2 - An admin renames and recolours a column in place (Priority: P2)

An admin clicks a column's name or its colour dot and changes it on the spot — no modal, no separate form. A name that collides with another column in the same project, case-insensitively, is rejected with an inline error naming the column that already holds it.

**Why this priority**: A column just added carries a placeholder name and the accent colour; renaming and recolouring is how it becomes meaningful, and it is the interaction every admin uses most often once columns exist.

**Independent Test**: With one project holding two columns named "Backlog" and "Todo", rename a third to "backlog" (any casing) and confirm the write is refused with an inline error naming "Backlog"; then rename it to something unused and confirm it saves; then recolour it from the palette and confirm the new colour is one of the seven values.

**Acceptance Scenarios**:

1. **Given** an admin on the Columns section, **When** they click a column's name, **Then** it becomes an editable field in place, exactly as a project's own fields do elsewhere on this screen.
2. **Given** a field open for editing, **When** Escape is pressed, **Then** the previous name returns and nothing is written.
3. **Given** a changed name, **When** it is blurred or saved, **Then** exactly one `updateColumn` call is made carrying only the name.
4. **Given** a name that matches another column in the same project once both are folded to lower case, **When** it is submitted, **Then** an inline error on the field names the column that already holds it, and no suffix is applied.
5. **Given** an admin clicking a column's colour dot, **When** they pick a swatch, **Then** the colour saves as one of the seven palette values and no free colour entry is offered.
6. **Given** a rename or recolour that the server refuses, **When** the refusal arrives, **Then** the field reverts to its previous value and a message names what failed and why.
7. **Given** any signed-in user who is not an admin, **When** they look at a column's name or colour, **Then** it is visible and not clickable, carrying the same disabled treatment as every other admin-only control on this screen.
8. **Given** an admin editing a column's name, **When** they attempt to change its kind, **Then** no control on the row offers that — kind is never editable once a column exists.

---

### User Story 3 - An admin reorders columns by drag (Priority: P3)

An admin drags a column to a new position among its project's other columns. The board's own left-to-right order — what every grouping and every card composer reads — follows.

**Why this priority**: Reordering is the one column change with no other route to the same result and no inline substitute, but a board is usable with columns in whatever order they were added, so it ranks below the edits that make each column legible.

**Independent Test**: With a project holding four columns in a known order, drag the last one to the front and confirm exactly one column's position changed, the other three are untouched, and the project's board order (read by grouping, by the card composer's column default, and by every other reader of column order) reflects the move.

**Acceptance Scenarios**:

1. **Given** an admin dragging a column to a new position, **When** the drop completes, **Then** one `moveColumn` call is made, touching exactly one column's position.
2. **Given** four columns in a known order, **When** one is dropped between two others, **Then** the moved column's new position falls between theirs and no other column's position is rewritten.
3. **Given** a reorder that the server refuses, **When** the refusal arrives, **Then** the column returns to its previous position and a message names what failed.
4. **Given** a non-admin, **When** they look at the Columns list, **Then** no drag affordance is offered to them.
5. **Given** two admins each dragging a different column at nearly the same moment, **When** both drops are served, **Then** each column lands where its own drop placed it and neither write is lost to the other, because each touches a different row.

---

### User Story 4 - An admin removes a column, refused wherever removing it would break the board (Priority: P4)

An admin deletes a column that is no longer needed. The deletion is refused, each with its own stated reason, if the column still holds issues, if it is the project's only column, if it is the project's last `canceled`-kind column, or if it is the project's last `done`-kind column.

**Why this priority**: Deletion is the column lifecycle's one irreversible act, and every one of its four refusals exists to protect an invariant a member or the product itself depends on, so it ranks last among the writes — a board that never deletes a column is still fully usable.

**Independent Test**: With a project holding one empty column beyond the required minimums, delete it and confirm it is gone and every other column is untouched; then attempt to delete a column still holding an issue, the project's last remaining column, its last `canceled`-kind column and its last `done`-kind column in turn, and confirm each attempt is refused with its own reason and nothing is removed.

**Acceptance Scenarios**:

1. **Given** an admin on an empty column that is neither the project's last column nor its last `canceled`- or `done`-kind column, **When** they delete it, **Then** it is removed and no other column, and no issue anywhere in the project, is touched.
2. **Given** a column holding at least one issue, **When** an admin attempts to delete it, **Then** the write is refused, naming that the column must be emptied first, and the column and its issues remain exactly as they were.
3. **Given** a project's only remaining column, **When** an admin attempts to delete it, **Then** the write is refused, naming that a project must always have a column, whether or not the column is empty.
4. **Given** a project's last `canceled`-kind column, **When** an admin attempts to delete it, **Then** the write is refused, naming that it is a member's only route to remove an issue.
5. **Given** a project's last `done`-kind column, **When** an admin attempts to delete it, **Then** the write is refused, naming that the project's progress could never leave zero without one.
6. **Given** any of the four refusals, **When** it is reached by a direct call that bypasses a disabled control, **Then** the server refuses it exactly as the UI already prevents it — the disabled state and the server check are independent lines of defence.
7. **Given** a column eligible for deletion, **When** an admin confirms the delete, **Then** the request waits for the server rather than removing the row optimistically, and the row disappears from the list only once the server confirms it.
8. **Given** a non-admin, **When** they look at any column's delete control, **Then** it is visible, disabled, and carries a reason, never hidden and never a dead button.

---

### User Story 5 - Every column change is recorded in the project's history (Priority: P5)

Adding, renaming, recolouring, reordering or deleting a column each leave a row in the project's activity feed, naming the actor, the column and what changed.

**Why this priority**: The record itself changes nothing about how the board behaves, so it ranks last, but every one of the other four stories is incomplete without it — a board whose column history vanishes on read is not the product the specification describes.

**Independent Test**: Perform one of each of the four writes above and open the project's activity feed; confirm five rows exist (one for the add already exercised by User Story 1 counts toward the same set), each naming the acting admin, the column's own name, and — for a rename, a recolour or a reorder — the transition the change made.

**Acceptance Scenarios**:

1. **Given** an admin who adds a column, **When** the write succeeds, **Then** one `column_added` activity row is written in the same transaction, naming the actor and the column.
2. **Given** an admin who renames a column, **When** the write succeeds, **Then** one `column_renamed` activity row is written in the same transaction, carrying the old and the new name.
3. **Given** an admin who recolours a column, **When** the write succeeds, **Then** one `column_recolored` activity row is written in the same transaction, carrying the old and the new palette colour name.
4. **Given** an admin who moves a column, **When** the write succeeds, **Then** one `column_reordered` activity row is written in the same transaction, naming in `to_value` the column it now immediately follows, or nothing when the column is now first.
5. **Given** an admin who deletes a column, **When** the write succeeds, **Then** one `column_deleted` activity row is written in the same transaction, naming the deleted column, and the row survives the column's own deletion — the activity table carries no reference to the column it describes.
6. **Given** a write to any of the five mutators that the server refuses, **When** the refusal happens, **Then** no activity row is written — the record only ever describes what actually happened.
7. **Given** an admin who drags three columns in quick succession, **When** the activity feed renders, **Then** the three `column_reordered` rows collapse into one line under the feed's existing five-minute same-actor collapsing rule, expandable to the three.

---

### Edge Cases

- **Two admins adding a column at the same moment** each succeed; both new columns append after everything that already existed at the moment each write ran, and their relative order between each other follows the order their writes were serialized in, not the order the clicks happened in.
- **Two admins racing to delete the project's last two `canceled`-kind columns** — deleting either one alone is legal, but deleting both leaves none, so exactly one succeeds and the other is refused naming the same last-`canceled`-kind reason it would have been refused for if it had been attempted second on a settled board.
- **An admin renames a column to the exact name it already has** — the write completes as a no-op with respect to the value, but no activity row is written and no `updated_at` changes, since nothing about the stored row differs.
- **A column's name is submitted at exactly the same value as another column, differing only in case** — refused by the uniqueness check, naming the existing holder, exactly as an all-lowercase or all-uppercase clash would be.
- **An issue is moved into a column between the moment its delete confirmation is shown and the moment the delete runs** — the delete is refused for holding an issue, evaluated fresh inside the delete's own transaction rather than from whatever the confirmation was shown against.
- **A column deleted while a rename or recolour of that same column is in flight** — the pending write is refused by the database rather than silently applied to a row that no longer exists.
- **A project with exactly one column** offers no delete affordance that can ever succeed on it — the last-column refusal always applies, and the control is disabled with that reason.
- **A project with exactly one `canceled`-kind column and one `done`-kind column, and three `open`-kind columns** allows every `open`-kind column to be deleted freely, down to none, since only the last column overall and the last of each of the other two kinds are protected.
- **Recolouring the project's last `canceled`-kind or `done`-kind column** is unaffected by the delete refusals — `kind` and colour are independent, and every refusal is about `kind` and emptiness, never about colour.
- **A drag that is released outside any valid drop target** leaves every column's position exactly as it was, with no `moveColumn` call made at all.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure and the write boundary

- **FR-001**: This feature introduces no new table. `board_column` — `project_id`, `name`, `colour`, `sort_order`, `kind` — and its constraints (a unique index on `(project_id, lower(name))`, `kind` fixed at creation from `open | done | canceled`) are entry R5's; this feature is the first and only caller of the mutators that write to it beyond project creation and project deletion's cascade. (`OT-INV-015`, `OT-INV-016`, §5)
- **FR-002**: Every write this feature makes to a `board_column` row MUST write `updated_at` explicitly through the shared `touched()` helper, following the convention entry R1 established for every table that carries one. (`OT-DATA-001`)
- **FR-003**: `createColumn`, `updateColumn`, `moveColumn` and `deleteColumn` MUST each require `isAdmin` and MUST NOT accept any weaker predicate — unlike this product's project- and issue-scoped mutators, none of the four is gated by project membership, matching the authorization matrix's own row for column edits. (`OT-AUTHZ-001`, §2)
- **FR-004**: The server check for each of the four mutators MUST be the enforcement, independent of whatever the client rendered as enabled or disabled; the client MAY run the same `isAdmin` predicate to disable its own controls. (§2)
- **FR-005**: Every action on the Columns section a non-admin cannot take — adding, renaming, recolouring, reordering, deleting — MUST render as a visible, disabled control carrying an inline reason. The section itself, and the read-only list it shows, remains visible to every signed-in user; only the controls that write are admin-gated. (`OT-UX-002`, §2)

#### Add a column

- **FR-006**: `createColumn` MUST take a project and append one new `board_column` row positioned after every column that already exists in that project at the moment the write runs, so no existing column's position changes. (§3.8)
- **FR-007**: A column created by `createColumn` MUST carry `kind = 'open'`; no caller of `createColumn` MUST be able to set any other kind. A column's kind, once set, follows FR-013. (§3.8)
- **FR-008**: A column created by `createColumn` MUST default to the palette's accent colour, the same default the palette fixes for every surface that requires a colour, and MUST carry a system-assigned name distinct from every other column in its project at that moment, immediately editable through the same in-place control FR-011 establishes. Uniqueness for that assigned name follows the same case-insensitive rule FR-011 enforces on every rename; it is not a case the uniqueness rule exempts. (`OT-DATA-013`, §3.8, §7)
- **FR-009**: `createColumn` writes MUST apply optimistically against the admin's own view, being the smallest write this feature makes, and MUST roll back with a message naming what failed when the server refuses the call. (`OT-UX-008`)

#### Rename and recolour a column

- **FR-010**: `updateColumn` MUST accept exactly two fields, name and colour, sent independently — one `updateColumn` call per field changed, exactly as a project's own in-place fields save (entry R5, §3.8). It MUST NOT accept `kind` or `project_id` on any path. (§3.8)
- **FR-011**: A column name submitted through `updateColumn` or `createColumn`'s own naming step MUST be checked for uniqueness within its project, case-insensitively, both as an inline affordance and, as the actual enforcement, by the database's existing unique index. A clash MUST render as an inline error naming the column that already holds the value; a silent suffix MUST NOT be applied. (`OT-UX-012`, `OT-INV-016`)
- **FR-012**: A colour submitted through `updateColumn` MUST be one of the seven palette values; free colour entry MUST NOT be accepted. (`OT-DATA-013`)
- **FR-013**: `updateColumn` MUST offer no path, under any field name or any caller, that changes a column's `kind` after creation. `done`- and `canceled`-kind columns therefore stay identifiable for the life of the project, and a delete refusal in FR-020 through FR-022 can never be defeated by relabelling a column's kind around it. (`OT-INV-015`)
- **FR-014**: A rename or recolour MUST activate in place — clicking the value turns it into a field, Escape reverts, a blur or save commits — applied optimistically and rolled back with a message naming what failed when the server refuses it, on the same terms entry R5 established for a project's own fields. (`OT-UX-008`, `OT-UX-009`, §3.8)
- **FR-015**: A call whose submitted value matches the column's stored value MUST write nothing — no row change, no `updated_at`, and, per FR-027, no activity row. (§5)

#### Reorder columns

- **FR-016**: `moveColumn` MUST take one column and write its new position among its project's other columns as a base-62 fractional index in `sort_order`, touching exactly the one row moved — the same ordering primitive `sort_order text COLLATE "C"` fixes for issue ordering, applied here to a project's own columns rather than to its issues. Every reader of a project's column order MUST sort by `(sort_order, id)`, admitting legal, unrepaired ties on the same terms as the issue order does. (`OT-DATA-001`, §3.3 by analogy)
- **FR-017**: `moveColumn` MUST NOT touch any column's `name`, `colour` or `kind`, and MUST NOT touch any issue — moving a column changes only where it sits among its project's other columns. (`OT-OPS-010`, §4)
- **FR-018**: Every surface that reads a project's column order — the Columns section's own list, the board's default column grouping (entry R10), and the create-issue and inline card-composer default of "the project's first column" (entry R6, entry R10) — MUST read the same `sort_order` this feature writes, so a reorder here is visible everywhere a column's position is read. (§3.3, §3.5, §3.8)
- **FR-019**: A `moveColumn` write MUST apply optimistically, being a drag of the same shape entry R5 and entry R6 already treat as a small local write, and MUST roll back to the column's previous position with a message naming what failed when the server refuses it. (`OT-UX-008`)

#### Delete a column

- **FR-020**: `deleteColumn` MUST be refused, naming that the column must be emptied first, when the column still holds at least one issue. This refusal MUST be backed by the database: `issue.column_id`'s existing foreign key to `board_column` MUST make the delete fail if an issue still references the column at the moment the statement runs, independent of whatever count the mutator itself read first. (`OT-INV-006`, §3.8, §4)
- **FR-021**: `deleteColumn` MUST be refused, naming that a project must always have a column, when the column is the last remaining row for its project. (`OT-INV-005`, §3.8)
- **FR-022**: `deleteColumn` MUST be refused, naming that it is a member's only route to remove an issue, when the column is `canceled`-kind and is the last `canceled`-kind row for its project. (`OT-INV-012`, §3.8, §2)
- **FR-023**: `deleteColumn` MUST be refused, naming that the project's progress could never leave zero without it, when the column is `done`-kind and is the last `done`-kind row for its project. (`OT-INV-014`, §3.8)
- **FR-024**: The last-column, last-`canceled`-kind and last-`done`-kind refusals MUST each be evaluated inside the delete's own transaction, against a count taken under a lock that serializes concurrent column deletes and adds for the same project, so that two deletes committing at once cannot together leave a project without a column, without a `canceled`-kind column, or without a `done`-kind column — a read of the column set followed by a write outside that read's transaction is not enforcement of these three invariants. (`OT-INV-005`, `OT-INV-012`, `OT-INV-014`, `AGENTS.md` → Drizzle ORM and PostgreSQL 18)
- **FR-025**: Each of the four refusals MUST state its own reason and MUST be independent of the other three — a column can be refused for more than one reason at once, and the message MUST name the reason that applies, not merely that the delete failed. (§3.8)
- **FR-026**: A delete eligible under all four checks MUST confirm once before writing, naming the column being removed, and MUST NOT proceed optimistically: the control shows in-flight state and the row leaves the list only once the server confirms the delete, on the same non-optimistic terms entry R5 and entry R6 already apply to a project's and an issue's own deletes. The delete MUST run in one transaction and MUST cascade to nothing else, having already been refused wherever a cascade would otherwise be needed. (`OT-OPS-010`, §3.8, §4)

#### Activity

- **FR-027**: Every call to `createColumn`, `updateColumn`, `moveColumn` or `deleteColumn` that writes MUST write exactly one activity row in the same database transaction as the change it describes, through the shared activity writer entry R7 establishes; a call refused for any reason MUST write none. (`OT-DATA-019`, §3.8)
- **FR-028**: A `column_added` row MUST carry the new column's name in `field` and no `from_value` or `to_value`. A `column_deleted` row MUST carry the deleted column's name in `field` and no `from_value` or `to_value`, and MUST be written before the column's own row is removed, since the activity table carries no foreign key to `board_column` and the row is the only place that name survives the deletion. (`OT-DATA-019`)
- **FR-029**: A `column_renamed` row MUST carry the column's own current name in `field` and the old and new names in `from_value` and `to_value`. A `column_recolored` row MUST carry the column's own current name in `field` and the old and new palette colour names — not their hex values — in `from_value` and `to_value`. (`OT-DATA-019`, §7)
- **FR-030**: A `column_reordered` row MUST carry the moved column's own name in `field` and, in `to_value`, the name of the column it now immediately follows, or nothing when the moved column is now first; it MUST carry no `from_value`. (`OT-DATA-019`)
- **FR-031**: None of the five activity types this feature writes MUST carry a reference to the `board_column` row itself — every value written is a frozen display string captured at write time, per the convention entry R7 fixes for every activity row this product writes. (`OT-DATA-019`, §5)
- **FR-032**: Several columns reordered in quick succession by the same admin MUST write one `column_reordered` row per column moved; the project's activity feed folds consecutive rows by the same actor within five minutes into one collapsible line, the same rule entry R7 applies to every other burst of activity. (§5, §3.8)

### Key Entities

- **Board column** (no change to its shape) — a lane belonging to one project, carrying a name unique within that project when folded to lower case, one of the seven palette colours, a position among its project's other columns, and a kind of `open`, `done` or `canceled` fixed for its lifetime. Entry R5 creates the table and seeds five rows per project; this feature is where an admin adds to, edits, reorders and removes from that set.
- **Activity** (no change to its shape) — entry R7's append-only log. This feature is a writer of five of its defined types — `column_added`, `column_renamed`, `column_recolored`, `column_reordered`, `column_deleted` — and reads none.

### Out of Scope

Deferred by the roadmap's R9 boundary, and named here so no scenario above is read as covering them:

- **The board's own rendering of columns as lists of cards, grouping, drag-to-move-a-card and the inline "Add a card" composer** — entry R10. This feature changes what columns exist and where they sit; it renders no card and moves no issue.
- **Everything about issues** — entry R6, already landed structurally: an issue's `column_id` and the composite foreign key that ties it to its own project's columns are R6's, and this feature's non-empty delete refusal depends on that foreign key without altering it.
- **The Columns section's read-only rendering for a signed-in user who is not an admin, and the section's placement on `/projects/:projectKey/details`** — entry R5, unchanged here. This feature adds admin-only controls to the section R5 already renders; it introduces no new route and no new screen.
- **Column-level comments or a per-column activity feed of its own** — none exists; every column event lands in the same project-wide feed entry R7 establishes, exactly as a project's own field edits do.
- **Any column attribute beyond name, colour, kind and position** — no description, no owner, no WIP limit. The specification gives a column four attributes and this feature adds none.
- **A per-column visibility or write rule finer than the project-wide `isAdmin` gate this feature applies to every one of its four mutators.**

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add a column and have it visible, positioned last, within one interaction and no page reload.
- **SC-002**: A column name colliding with an existing one in the same project is refused and named by the existing holder on 100% of attempts, whatever the casing, and a suffix is applied 0% of the time.
- **SC-003**: A rename, recolour or reorder that the server refuses is visibly reverted with a message naming the reason, within one round trip and with no page reload.
- **SC-004**: A column's position, once moved, is read identically by every surface that shows column order, verified by reading the Columns section immediately after a drag with no other action taken.
- **SC-005**: A non-empty column cannot be deleted through any route, including one that bypasses the disabled control, 100% of attempts.
- **SC-006**: A project's last column, its last `canceled`-kind column and its last `done`-kind column each cannot be deleted through any route, 100% of attempts, verified independently for each of the three conditions and under two concurrent delete attempts that would together violate one of them.
- **SC-007**: Every one of the four delete refusals is reported with the specific reason that applies, not a generic failure message, on 100% of refused attempts.
- **SC-008**: Every successful add, rename, recolour, reorder and delete produces exactly one activity row of the matching type, verified by counting rows before and after each write, with zero rows written for any refused call.
- **SC-009**: A non-admin sees every add, rename, recolour, reorder and delete control as visible and disabled with a reason, never hidden and never a dead button, on 100% of the Columns section's admin-only controls.
- **SC-010**: `createColumn`, `updateColumn`, `moveColumn` and `deleteColumn` each refuse a non-admin caller on 100% of calls that bypass the client entirely, naming the rule rather than disclosing anything about the stored row.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **"Add appends a column of kind open" creates the row immediately, with a system-assigned name and the palette's default colour, rather than opening a composer that collects a name first.** §3.8 lists add, drag-to-reorder, and inline rename/recolour as four parallel actions rather than describing add as a form; the column it produces is then named and coloured through the same in-place editing the rename and recolour actions already establish, so no second interaction pattern is introduced for the one moment a column has no name yet.
- **The system-assigned name given to a newly added column still obeys the case-insensitive uniqueness rule**, disambiguated however the implementation chooses (a counter, for instance) at the moment of creation, because `OT-INV-016`'s constraint does not carve out an exception for a system-generated value, and `OT-UX-012`'s "no silent suffix" rule governs a value a user typed and found rejected, not a default nobody typed at all.
- **Deleting an eligible column still confirms once**, on the same terms as every other destructive action in the product (project delete, issue delete, label delete), even though an eligible column is by definition empty and so there is nothing to count in that confirmation — it states which column is being removed and nothing more.
- **`createColumn` applies optimistically.** `OT-UX-008` names drag, status, assignee and in-place field edits as the product's small, locally-reversible writes; appending one row with server-assigned defaults is smaller than any of them and is the same shape as adding a project member, which entry R5 already treats as optimistic.
- **`deleteColumn` is not optimistic**, matching project delete and issue delete: it waits for the server after its confirmation, because a wrongly-optimistic removal of a column row would have to be reconstructed with a fresh position and a fresh identity if the server refused it, unlike a reverted field value.
- **Reversing this feature's migration is not applicable** — this feature adds no migration of its own; every table and constraint it writes through already exists from entry R5 (and, for the composite foreign key the non-empty refusal leans on, entry R6).

### Reconciliations between the roadmap and the specification

- **The per-column issue count entry R5 already renders reads zero for every column until entry R6 lands**, and continues to read correctly, without change, once this feature starts adding and deleting columns — the count is a read of `issue.column_id`, which this feature never touches directly.
- **This feature is the first and only caller, beyond project creation, of `board_column` writes.** Entry R5 seeds the initial five rows and entry R6 adds the table's second uniqueness guarantee for its own composite foreign key; neither entry offers a mutator that changes a column after it exists. This feature is that mutator layer in full.
- **Activity writing is not deferred here the way it was in entries R5 and R6.** Those two entries shipped their mutators before entry R7's writer existed and left activity writing for R7 to add later; this feature is built after R7 lands (§3, dependency graph) and so writes its own five activity types directly, through the writer R7 already establishes, rather than leaving a gap for a later entry to fill.

### Inherited constraints, not decisions this specification makes

- The `board_column` table, its five seeded rows, its `(project_id, lower(name))` uniqueness and its `kind` enumeration are entry R5's. This feature neither creates nor migrates that table.
- The composite uniqueness over `(project_id, id)` that backs `issue.column_id`'s foreign key, and the deferred-check declaration that lets a project delete remove columns and issues together, are entry R6's.
- The activity table's shape — one row per event, the frozen-string convention, the five-minute same-actor collapsing, and the shared writer this feature calls — are entry R7's.
- The palette's seven values and the accent default are fixed by §7 and restated here rather than chosen.
- The disabled-control-with-inline-reason convention, the toast conventions for a rolled-back write, and the shell that hosts `/projects/:projectKey/details` are entry R2's; this feature adds controls inside a screen entry R5 already renders within that shell.
- Cross-site request protection is §6's and applies to this feature's four mutators without them restating it.

### Dependencies

- **Roadmap position**: R9 depends directly on R5 (the `board_column` table, the project record and its screen), R6 (the composite foreign key `issue.column_id` leans on) and R7 (the activity writer this feature calls for all five of its event types), and transitively on R1, R2 and R3. R9 is independent of R8 and either may be built first once R7 lands; entry R10 is the one slice that consumes what this feature produces.
- **Consumed from earlier entries**: `isAdmin` and the actor resolved on every request (R1); the shell and the disabled-control convention (R2); `/projects/:projectKey/details` and its Columns section, rendered read-only, plus the `board_column` table and its existing uniqueness and kind constraints (R5); the composite foreign key tying an issue to a column of its own project (R6); the activity table and its shared writer (R7).
- **Downstream reach-back**: none. Unlike entries R5, R6 and R7, this feature is not itself extended by a later entry's roadmap scope — entry R10 reads what this feature writes but adds no field and no mutator to `board_column`.
