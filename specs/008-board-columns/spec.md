# Feature Specification: Board columns

**Feature Branch**: `sdd/board-columns`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R9**

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "R9 — Board columns. Let an admin shape each project's columns without ever moving an issue."

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R9** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## Clarifications

### Session 2026-09-04

- Q: When one drag reorders a column, does the project's feed get one activity row for the column that moved, or one row for every column whose position in the list shifted? → A: One row, for the column the drag moved. [`docs/product/specifications.md`](../../docs/product/specifications.md) §5 (`activity`) states that "reordering several columns writes one row per column moved, which §3.8's five-minute collapsing folds into one line" — the row belongs to the column an admin moved, not to a column whose ordinal merely shifted beneath it.
- Q: Where more than one delete refusal applies to the same column, in what fixed order is the single shown reason chosen? → A: Holds issues, then the project's last column, then the project's last `canceled`-kind column, then the project's last `done`-kind column. Both [`docs/product/specifications.md`](../../docs/product/specifications.md) §4 *Deletes* and §3.8 enumerate the four restrictions in exactly that order.
- Q: May an admin add, rename, reorder or delete a column on an archived project? → A: Yes. [`docs/product/specifications.md`](../../docs/product/specifications.md) §3.8 *Status* states that archiving "is reversible, changes nothing else about the project, and is what unlocks Delete", and §4 *Nothing cascades* names no consequence of archiving for a project's columns.
- Q: Does deleting a column ask the admin to confirm before it is removed, or does it delete on the first press? → A: **Confirm once, naming the column** — decided by the team, not settled by a source. [`docs/product/specifications.md`](../../docs/product/specifications.md) is silent on a confirmation for `deleteColumn`; this follows the house pattern its §3.10 sets for a label delete and its §4 sets for a project delete.
- Q: On a `column_renamed` activity row, does `field` hold the column's name before the rename or after it? → A: **Before — the old name**, as it stood immediately prior to the rename, so a feed reader sees the column named as they last saw it. Decided by the team; §5's "that board column's own name" and `OT-DATA-019`'s "that column's frozen name" do not settle which of a rename's two names is meant.
- Q: When `moveColumn`'s own column, or the column a drag names as its target, is deleted by another admin between the render and the mutator's locked read, is that reported as an invalid target or as a missing row? → A: **A missing row — `not_found` for both cases** — decided by the team, not settled by a source. [`docs/product/specifications.md`](../../docs/product/specifications.md) is silent on a reorder whose subject column or drag target vanishes mid-flight; this follows FR-010's rule that a row nobody can find is reported as missing rather than as a refusal, and gives `moveColumn` the treatment `deleteColumn` already has for exactly that race. `invalid_target` is reserved for a target that **exists** but is not a legal destination — a column of another project — and never covers a column that is simply gone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An admin shapes a project's board by adding and renaming columns (Priority: P1)

An admin opens a project's details page, finds the Columns section that until now has only listed the five seeded rows, and changes it: a control at the foot of the list adds a new column, which appears last, named, of kind `open`. Clicking any column's name turns it into a field, so a rename happens where the name already stands. A name that collides with another column in the same project — whatever its casing — is refused inline, naming the column already holding it, rather than being quietly suffixed.

**Why this priority**: These are the two writes that make the Columns section something other than a list. Every other story in this feature operates on columns this one creates or on names it fixes, and until an admin can add a column at all, a project's board is exactly the five rows entry R5 seeded and nothing about it is shapeable. The uniqueness rule belongs here rather than in a story of its own because it is the one refusal both writes share.

**Independent Test**: Sign in as an admin against a project holding its five seeded columns, add a column named "Review" and confirm it exists last in board order with kind `open`; rename "Todo" to "Up next" in place and confirm the list shows the new name; attempt a rename to "backlog" and confirm the save is refused with an inline error naming the existing "Backlog" column and that nothing was written. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** an admin on a project holding its five seeded columns, **When** they add a column named "Review", **Then** exactly one column is created, it carries kind `open`, it sits last in board order, and the five existing columns are untouched.
2. **Given** an admin adding a column, **When** the form is open, **Then** it offers a name and nothing else — no kind control and no position control — because kind is fixed at creation as `open` and position is always last.
3. **Given** an admin on the Columns section, **When** they activate a column's name, **Then** it becomes an editable field in place, Escape reverts it unchanged, and a blur or ⌘-enter saves it with exactly one `updateColumn` call.
4. **Given** an admin renaming a column to a name another column in the same project already holds, **When** the save is attempted, **Then** it is refused with an inline error naming that existing column, no suffix is applied, and nothing is written.
5. **Given** an admin renaming a column to a name differing from another column's only in letter case — "backlog" against "Backlog" — **When** the save is attempted, **Then** it is refused on the same rule, because names are unique within a project when folded to lower case.
6. **Given** an admin renaming a column to a value differing from its own current name only in letter case — "Todo" to "todo" — **When** the save is attempted, **Then** it succeeds, because a column never collides with itself.
7. **Given** an admin adding a column whose name another column in the same project already holds, **When** the save is attempted, **Then** it is refused on the same rule and with the same inline error as a rename, because the constraint is on the pair and not on the mutator.
8. **Given** an admin adding or renaming a column, **When** they submit an empty or whitespace-only name, **Then** it is refused inline and nothing is written.
9. **Given** an admin adding or renaming a column, **When** they submit a name of exactly 200 characters, **Then** it is accepted; one character more is refused on the field with a message naming the bound, and the server refuses it independently of the client's check.
10. **Given** a column added or renamed on one project, **When** another project holding a column of the same name is read, **Then** it is unchanged — columns belong to a project and two projects need not agree.

---

### User Story 2 - An admin reorders the board by dragging a column (Priority: P2)

An admin drags a column in the Columns section to a new position in the list. The board order changes for that project and for nobody else's, and not one issue moves: every issue stays in the column it was already in, and every column keeps its name and its kind.

**Why this priority**: Order is the second half of "shape a project's columns", and it is the only column edit with a gesture rather than a field behind it. It ranks below Story 1 because a project whose columns cannot be reordered is still usable — the seeded order is a working board — while a project whose columns cannot be added or renamed is the fixed five rows R5 shipped.

**Independent Test**: As an admin on a project holding its five seeded columns, drag "Canceled" from last position to first and confirm the section, on reload, lists it first and the remaining four in their original relative order, that no issue changed column, and that repeating the drag onto the position the column already occupies writes nothing.

**Acceptance Scenarios**:

1. **Given** an admin on the Columns section, **When** they drag a column to a different position, **Then** exactly one `moveColumn` call runs, the board order reflects the drop, and every other column keeps its relative order.
2. **Given** a reorder that has just completed, **When** any issue in the project is read, **Then** it sits in exactly the column it sat in before, with the same kind and the same name.
3. **Given** an admin who drags a column and drops it on the position it already occupies, **When** the drop resolves, **Then** nothing is written and no activity row appears.
4. **Given** an admin using the keyboard rather than a pointer, **When** they move a column, **Then** the same reorder is reachable with a visible focus indicator and an accessible name on the control at every step.
5. **Given** a project whose columns have been reordered, **When** the same project's board order is read anywhere else it is shown, **Then** it agrees, because there is one board order per project and this section writes it.

---

### User Story 3 - An admin deletes an empty column, and meets four refusals that will not let a board become unusable (Priority: P3)

An admin removes a column a project no longer uses. Delete asks once, naming the column, before it removes anything. It is offered only where removing the column destroys nothing and leaves the board whole: the column must hold no issues, must not be the project's last, and — where it is the project's `done`- or `canceled`-kind column — must not be the last of that kind. Each refusal says which of the four it is, in its own words, rather than a single generic "can't delete this".

**Why this priority**: Deletion is the one column edit that can destroy something or corner a project, and the four refusals are the invariants this entry exists to enforce. It ranks below add, rename and reorder because a board with a column too many is workable and a board with no way to cancel an issue is not — which is exactly what the refusals prevent.

**Independent Test**: On a project holding its five seeded columns and one issue in "Todo", confirm Delete on "Todo" is refused for holding an issue; move that issue out and confirm Delete then asks for confirmation naming "Todo" and removes it only once that is accepted, writing nothing if it is dismissed; confirm Delete on "Done" is refused as the project's last `done`-kind column and Delete on "Canceled" as the last `canceled`-kind, each with its own reason; delete down to one remaining column and confirm Delete on it is refused as the project's last.

**Acceptance Scenarios**:

1. **Given** an admin on an empty column that is neither the project's last nor the last of a `done` or `canceled` kind, **When** they delete it and accept the confirmation, **Then** the column is removed and no issue in the project is moved, changed or destroyed.
2. **Given** a column holding one or more issues, **When** an admin attempts to delete it, **Then** the deletion is refused with a reason stating that the column still holds issues, and the issues are untouched.
3. **Given** a project holding exactly one column, **When** an admin attempts to delete it, **Then** the deletion is refused with a reason stating it is the project's last column.
4. **Given** a project holding exactly one `canceled`-kind column, **When** an admin attempts to delete it, **Then** the deletion is refused with a reason naming it as the project's only route to remove an issue.
5. **Given** a project holding exactly one `done`-kind column, **When** an admin attempts to delete it, **Then** the deletion is refused with a reason stating the project would have no way to count work done, and that kind cannot be reassigned to another column afterwards.
6. **Given** a project holding two `done`-kind columns, **When** an admin deletes one of them, **Then** it succeeds, because the restriction is on the last of a kind and not on the kind itself.
7. **Given** an admin who bypasses a disabled Delete control and calls the mutator directly on a column any of the four refusals covers, **When** the call reaches the server, **Then** it is refused independently of the control's state and nothing is written.
8. **Given** a column deleted successfully, **When** the project's remaining columns are read, **Then** their names, kinds and relative order are unchanged and no gap or renumbering is visible.
9. **Given** an admin who presses Delete on a deletable column, **When** the confirmation appears, **Then** it names that column, and dismissing or cancelling it runs no `deleteColumn` call, writes nothing and leaves the column and its activity feed untouched.

---

### User Story 4 - Everyone who is not an admin reads the columns and cannot change them (Priority: P4)

A member of the project, and a signed-in user who is not a member, both open the same project details page and see the same Columns section the admin does — every column, its kind, and how many issues it holds — with none of the four controls. The board they work on is legible to them; shaping it is not theirs to do.

**Why this priority**: This is the write boundary the whole entry sits behind, and it is a single predicate rather than a journey — but it is the one thing that must not be got wrong, since every mutator here is admin-only while every read here is open to anyone signed in. It ranks fourth because it has nothing to guard until the three writing stories exist.

**Independent Test**: With a project holding six columns, open its details page as a member and again as a signed-in non-member, and confirm both see all six with kinds and counts and neither is offered an add, rename, reorder or delete affordance; then call each of the four mutators directly as each user and confirm all eight calls are refused.

**Acceptance Scenarios**:

1. **Given** a signed-in user who is not an admin — member or not — **When** they open a project's details page, **Then** the Columns section renders every column in board order with its name, its kind and its issue count, exactly as it does for an admin.
2. **Given** that same user, **When** they look at the Columns section, **Then** no add control, no editable name, no drag affordance and no delete control is offered to them.
3. **Given** a non-admin who calls `createColumn`, `updateColumn`, `moveColumn` or `deleteColumn` directly, **When** the call reaches the server, **Then** it is refused, whatever the client rendered.
4. **Given** an admin whose role is revoked while they have the Columns section open, **When** the page next renders, **Then** the four controls are gone, and a write attempted from the stale page is refused by the server on its own account.
5. **Given** any signed-in user, **When** they read a project's columns, **Then** membership is never consulted for the read — columns are readable by everyone, exactly as the project they belong to is.
6. **Given** a project key that matches no project, **When** anyone opens its details route, **Then** it reads "This doesn't exist" and never implies a hidden-access state.

---

### User Story 5 - Every column edit lands in the project's activity feed (Priority: P5)

Nobody has to remember to record a board change. The moment an admin adds, renames, reorders or deletes a column, a row is already sitting in that project's activity feed naming the actor and the column, worded so it still reads correctly years later — after the column has been renamed again, or deleted outright.

**Why this priority**: The specification requires it of every change on the project details screen, and it is the reason this entry depends on R7 rather than only on R5 and R6. It ranks last because it is silent infrastructure behind four writes that all work without it — but a board reshaped with no trace of who reshaped it would be read as a gap the first time anyone looked.

**Independent Test**: On a project with an empty feed, add a column, rename it, drag it one position, and delete it, then confirm four rows appear on that project's feed in that order, each naming the actor and the column by name, with the rename carrying both names and the reorder naming the column it now follows — and confirm all four still read correctly after the project's other columns are renamed.

**Acceptance Scenarios**:

1. **Given** an admin who adds a column, **When** the create succeeds, **Then** exactly one row appears on the project's feed naming the actor and the new column, carrying no from/to pair.
2. **Given** an admin who renames a column, **When** the save lands, **Then** one row appears carrying the old name in `from_value` and the new name in `to_value`, with `field` holding that same old name.
3. **Given** an admin who drags a column to a new position, **When** the drop lands, **Then** exactly one row appears, for the column the drag moved, naming the column it now follows — and naming nothing where it is now first, while a column whose ordinal merely shifted beneath it gets no row.
4. **Given** an admin who deletes a column, **When** the delete succeeds, **Then** one row appears naming the deleted column, and it keeps naming it after the column row itself is gone.
5. **Given** a column edit whose write is refused — a colliding rename, a refused delete — **When** the call returns, **Then** no activity row was written, because the row and the change land together or not at all.
6. **Given** four column edits by one admin inside five minutes, **When** the project's feed renders, **Then** they fold into one expandable line under the collapsing rule the feed already applies to every other change.
7. **Given** a column edit on a project, **When** any issue's feed in that project is read, **Then** it carries no row for it — a column edit is project history, not issue history.
8. **Given** a column renamed after an earlier row already named it, **When** that earlier row is re-read, **Then** it still shows the name as it stood when it was written.

---

### Edge Cases

- **A project holding exactly one column, which is also its only `done`-kind column and its only `canceled`-kind column** — three refusals apply at once. One reason is shown — that it is the project's last column, the highest of the three under FR-038's precedence — chosen by that precedence rather than by whichever check happens to run first, so the same column always explains itself the same way.
- **A column that is both non-empty and the project's last** — FR-038's precedence shows the emptiness reason, it being the one the admin can act on; both refusals hold, and the delete is refused either way.
- **An issue moved into a column between the emptiness check and the delete** — the delete is refused rather than removing a column that now holds work, because the check and the write happen inside one transaction rather than across two round trips.
- **Two admins each deleting one of a project's two remaining `done`-kind columns at the same moment** — one succeeds, the other is refused; the project never reaches zero `done`-kind columns by way of two concurrent reads that were each correct when taken.
- **Two admins renaming two different columns to the same new name at the same moment** — one succeeds, the other is refused by the uniqueness constraint on the pair rather than by a check that read a stale list.
- **A rename that only changes letter case on the column's own name** — accepted; the uniqueness rule excludes the row being written from its own comparison.
- **A name submitted with leading or trailing whitespace** — trimmed before it is measured against the 200-character bound and before it is compared for uniqueness, so " Todo " and "Todo" collide.
- **A column added to an archived project** — allowed. Archiving is reversible and changes nothing about a project but its status and the availability of Delete; no rule makes an archived project's board unshapeable.
- **A delete confirmation dismissed, cancelled or escaped** — nothing is written, no activity row appears, and focus returns to the Delete control it was raised from.
- **A drag dropped outside the list, or abandoned** — nothing is written.
- **A column deleted while another admin has the section open on a stale render** — their next action against it is refused as a missing row, not as a permission failure.
- **A project whose first column has been reordered away from first place** — the create-issue default follows board position rather than a remembered column, so it is whatever now sits first.
- **The very first column an admin adds to a project** — kind `open`, whatever kinds the project's existing columns carry; there is no path that creates a `done`- or `canceled`-kind column after project creation.

## Requirements *(mandatory)*

### Functional Requirements

#### Structure — the column record this feature writes rather than creates

- **FR-001**: This feature MUST create no table. `board_column` — its project reference, its name, its board position and its `kind` of `open`, `done` or `canceled` — is entry R5's, and the composite uniqueness over the project-and-column pair is entry R6's; this feature is the first caller that writes any of them after creation. (§5, R5, R6)
- **FR-002**: A column's `kind` MUST be fixed at creation and MUST NOT be changed by `updateColumn` or by any other path this feature delivers. No control that edits a kind MUST exist, and no mutator MUST accept a kind on any call but the create. (`OT-INV-015`, §3.8, §5)
- **FR-003**: A column added after project creation MUST always carry kind `open`. `createColumn` MUST NOT accept a caller-supplied kind, so `done` and `canceled` kinds exist only on the rows entry R5 seeds. (§3.8, §5)
- **FR-004**: Column names MUST be unique within a project when folded to lower case, enforced by the database constraint entry R5's table already carries rather than by a read-then-write check in a mutator. A name MUST be trimmed before it is compared and before it is measured against the 200-character bound every name in the product carries. (`OT-INV-016`, `OT-DATA-003`, §5)
- **FR-005**: A column MUST carry no colour and MUST be told apart by name alone. No mutator this feature delivers MUST accept a colour, no swatch MUST be rendered, and no `column_recolored` event MUST exist. (§7 *Palette*, §5)
- **FR-006**: `updated_at` MUST be written explicitly through the shared helper on every column write, and every mutator MUST follow the data-model conventions entry R1 established rather than restating them. (`OT-DATA-002`, `OT-DATA-001`)

#### Authorization and the write boundary

- **FR-007**: `createColumn`, `updateColumn`, `moveColumn` and `deleteColumn` MUST each require `isAdmin`, and MUST require nothing else — project membership MUST NOT be a second condition, since an admin is an implicit member of every project and no rule here carries an `|| isAdmin` branch. The project's `status` MUST NOT be a second condition either: all four remain available on an archived project, archiving being reversible and changing nothing about a project but its status and the availability of Delete. (`OT-AUTHZ-001`, §2 *Write rules per mutator*, §3.8 *Status*, §4 *Nothing cascades*)
- **FR-008**: Every one of the four MUST resolve the project it acts on server-side — from the stored column row, or, where the call supplies a project key, from the stored project row that key is looked up against — and MUST re-authorize the caller against that resolved project on every call rather than carrying an earlier decision forward. A client-supplied internal project identifier MUST NOT be accepted or trusted by any of the four; a project key is a lookup input, resolved server-side and authorized after resolution, never an identifier taken on trust. (`OT-AUTHZ-004`)
- **FR-009**: Every signed-in user MUST be able to read every project's columns, their kinds and their issue counts. Membership MUST NOT be used as a visibility boundary anywhere in this feature. (`OT-AUTHZ-002`)
- **FR-010**: Each mutator MUST resolve the row its work needs first and MUST refuse a caller it cannot find that row for as a missing row rather than as a permission refusal, since every column is readable by every signed-in user. Only then MUST it evaluate `isAdmin`. Where a mutator locks the project's column set — `moveColumn` and `deleteColumn` — a row that was present at that resolve but is gone from that locked read MUST be reported the same way, as a missing row rather than as a permission refusal or as an invalid input: this covers `deleteColumn`'s subject column, `moveColumn`'s subject column, and the column a drag names as its target, any of which a concurrent admin may delete inside that window, and the client MUST render all three as the stale-render case the eleventh Edge Case fixes — the column reported as already gone and the section refreshed. A refusal naming an invalid target MUST be reserved for a target that exists but is not a legal destination, such as a column of another project, and MUST NOT be used for a target that is simply gone. (`OT-UX-004`, `OT-AUTHZ-005`; the vanished-column treatment per Clarifications 2026-09-04)
- **FR-011**: The client MAY run the same predicate to decide what to render; the server check MUST be the enforcement, and every mutator MUST refuse a call made from a page whose controls were rendered under a role the caller no longer holds. (`OT-AUTHZ-005`, `OT-AUTHZ-012`)
- **FR-012**: An admin who loses the role while the Columns section is open MUST have the four controls disappear on the next render, with no row removed and nothing else about the section changed. (`OT-AUTHZ-012`)

#### The Columns section on project details

- **FR-013**: This feature MUST add its controls to the Columns section entry R5 already renders on `/projects/:projectKey/details` and MUST NOT introduce a second screen, a modal-only surface or a settings page for columns. Column edits MUST live on project details and MUST NOT be offered on the board. (§3.3, §3.8, `OT-SCOPE-007`)
- **FR-014**: The section MUST list every column of the project in board order, each row showing the column's name, its kind and the number of issues currently in it. (§3.8, §3.3)
- **FR-015**: The issue count MUST be read live for each render rather than stored on the column row, and MUST be the count this feature's own emptiness refusal reads, so a row showing a non-zero count never offers a delete that would succeed. (§3.8, `OT-INV-006`)
- **FR-016**: For a signed-in user who is not an admin the section MUST render as a read-only list of the columns and their counts, offering no add control, no editable name, no drag affordance and no delete control. (§3.8)
- **FR-017**: The kind MUST render as a shown value rather than a control, for admins as well as everyone else, because no user of any role may change it. (`OT-UX-010`, `OT-INV-015`)
- **FR-018**: Every control this feature adds MUST come from React Aria Components, with Tailwind supplying the visual layer only, and each MUST carry an accessible name, a visible focus indicator and error text associated with the control it belongs to. No state or refusal MUST be conveyed by colour alone. (`OT-UX-018`, §7, `AGENTS.md` → React Aria Components)

#### `createColumn` — add

- **FR-019**: `createColumn` MUST accept a name and nothing else, and MUST write one column carrying that name, kind `open`, and a board position placing it last among the project's existing columns. (§3.8, §5)
- **FR-020**: The add control MUST validate per field and on blur, MUST keep its submit control enabled and MUST report a missing or invalid name inline rather than going dead. (`OT-UX-011`)
- **FR-021**: A name colliding with an existing column of the same project, case-insensitively, MUST be reported as an inline error naming that existing column. A suffix MUST NOT be applied and the write MUST NOT be retried under another name. (`OT-UX-012`, §3.8)
- **FR-022**: `createColumn` MUST NOT touch any existing column and MUST NOT touch any issue. (`OT-OPS-010`)

#### `updateColumn` — rename

- **FR-023**: `updateColumn`'s entire surface MUST be the column's name. It MUST accept no kind, no position, no project and no colour, so a rename is the only change it can make. (§5, `OT-INV-015`)
- **FR-024**: A rename MUST be edited in place with the gesture every other editable value in the product uses: activating the name turns it into a field, Escape reverts, a blur or ⌘-enter saves, and exactly one `updateColumn` call runs per rename. On a platform with no ⌘ key the same save MUST be bound to Ctrl-enter, and focus MUST return to the control when the field closes, whether it saved or reverted. A blur whose value is unchanged MUST make no call at all, and where a submitted name equal to the column's current name reaches the server all the same, `updateColumn` MUST report success having written nothing — no change to the column row, no `updated_at` touch and no activity row — so the outcome does not depend on which side noticed the value was unchanged. (`OT-UX-009`, §3.8)
- **FR-025**: A rename colliding with another column of the same project, case-insensitively, MUST be refused with an inline error naming that existing column — the same rule and the same wording FR-021 fixes for a create, since the constraint belongs to the pair rather than to either mutator. (`OT-UX-012`, `OT-INV-016`, §3.8)
- **FR-026**: The uniqueness comparison MUST exclude the row being renamed, so a change of letter case on a column's own name is accepted rather than read as a collision with itself. (`OT-INV-016`)
- **FR-027**: A rename MUST apply optimistically and MUST roll back with a message naming what failed and why when the server refuses it. That message MUST render inline on the name field, by the same path the uniqueness error of FR-025 takes, and MUST NOT be left to a generic fallback naming neither what failed nor why: **every** refusal `updateColumn` can return to a client — a colliding name and a caller refused as `forbidden` alike — MUST carry a message of its own, and the four are worded in [`contracts/screens.md`](./contracts/screens.md) → *`ColumnRow`'s rename*. It MUST touch no issue. (`OT-UX-008`, `OT-UX-012`, `OT-OPS-010`)

#### `moveColumn` — reorder

- **FR-028**: `moveColumn` MUST change a column's board position and nothing else — not its name, not its kind, not its project, and not any issue in it or in any other column. (`OT-OPS-010`, §4)
- **FR-029**: One drop MUST run exactly one `moveColumn` call, and the drop position MUST be the only ordering input — no numeric rank field and no sort control MUST be offered. (§3.3, §3.8)
- **FR-030**: A drop onto the position the column already occupies MUST write nothing at all, `updated_at` included. (§3.8)
- **FR-031**: Reordering MUST be driven by React Aria's drag-and-drop rather than a hand-written pointer implementation, and the same reorder MUST be reachable from the keyboard with the focus behaviour that component supplies. (§7, `OT-UX-018`)
- **FR-032**: A reorder MUST apply optimistically and MUST roll back with a message naming what failed and why when the server refuses it or the call fails without a reason code. A rollback MUST NOT be silent and MUST NOT be reported generically: each outcome `moveColumn` can return MUST carry a message of its own, worded in [`contracts/screens.md`](./contracts/screens.md) → *The reorder*. That message MUST render inline in the Columns section, on the list the drag acted on — the treatment this feature's other two refusals already have, a uniqueness error inline on its field and a delete refusal inline on its control — rather than as a toast, and MUST be reachable without moving focus out of the list, so the keyboard reorder path SC-013 requires meets it where the reorder happened. (`OT-UX-008`, `OT-UX-002`, `OT-UX-018`)
- **FR-033**: Board order MUST be one order per project, written to the column's ordering index, and every query that renders columns MUST read that same order, so the Columns section and every other surface showing a project's columns agree. That order MUST be `(sort_order, id)`: the ordering index first, the row identifier as the tie-break, on every query that reads columns and on the in-memory ordering `moveColumn` splices against. Ties are legal and MUST NOT be repaired, and two columns that come to share an ordering index MUST NOT be shown in a different order on two reads. This is the rule §3.3 already fixes for issues — "every ordered query sorts by `(sort_order, id)`, and since ids are UUIDv7 the tie-break is creation order" — applied to a project's columns. (§5, §3.3)

#### `deleteColumn` — the four refusals

- **FR-034**: `deleteColumn` MUST refuse a column that holds one or more issues, with a reason stating that the column still holds issues. A column holding work MUST be emptied by moving those issues elsewhere first, and no path MUST exist by which a column edit moves or destroys an issue. (`OT-INV-006`, `OT-OPS-010`, §3.8, §4)
- **FR-035**: `deleteColumn` MUST refuse the project's last column, with a reason stating that a project always has at least one column. (`OT-INV-005`, §3.8, §4)
- **FR-036**: `deleteColumn` MUST refuse the project's last `canceled`-kind column, with a reason naming it as a member's only route to remove an issue. (`OT-INV-012`, §2, §3.8, §4)
- **FR-037**: `deleteColumn` MUST refuse the project's last `done`-kind column, with a reason stating that the project's progress could never leave zero without one and that no later column could restore the kind, `kind` being fixed at creation. (`OT-INV-014`, `OT-INV-015`, §3.8, §4)
- **FR-038**: Each of the four refusals MUST state its own reason. A single generic refusal covering more than one of them MUST NOT be used. Where more than one refusal applies to the same column, exactly one reason MUST be shown, chosen by the fixed precedence — holds issues, then the project's last column, then the project's last `canceled`-kind column, then the project's last `done`-kind column, the order §4 *Deletes* and §3.8 both enumerate the restrictions in — rather than by evaluation order, so the same column always explains itself the same way. The four reasons MUST be worded once, in [`contracts/screens.md`](./contracts/screens.md) → *The four refusals, worded*, and both the disabled control's inline reason (FR-039) and the refusal `deleteColumn` returns to a bypassed call (FR-040) MUST read that one wording, so no implementation invents the copy and the two surfaces never word the same refusal differently. (§4, §3.8, `OT-UX-002`)
- **FR-039**: The Delete control MUST be offered to admins only, and for an admin on a column any refusal covers it MUST render visible and disabled with that refusal's reason inline, never hidden and never as a dead control. An enabled Delete MUST confirm once, naming the column, before `deleteColumn` runs, and a dismissed or cancelled confirmation MUST make no call and write nothing. That confirmation MUST be a dialog raised over the Columns section rather than a route or a second screen, so FR-013's prohibition — which bars a modal-only *surface* for columns, not a confirmation over the section — still holds. (`OT-UX-002`, §3.8; confirmation per Clarifications 2026-09-04)
- **FR-040**: The mutator MUST evaluate all four refusals server-side and MUST refuse independently of whether a disabled control was bypassed. (`OT-AUTHZ-005`, §2)
- **FR-041**: A permitted delete MUST remove the column row and MUST cascade to nothing, because a column that may be deleted is by definition empty and no other table references it. It MUST leave every other column's name, kind and relative order unchanged. (`OT-OPS-010`, §4)

#### Activity — the four column events

- **FR-042**: `activity.type`'s `CHECK` MUST be widened by this feature's own migration to admit exactly `column_added`, `column_renamed`, `column_reordered` and `column_deleted`, added to the values entry R7 declared. This feature MUST NOT declare a value no mutator it delivers ever writes. (§5, R7 FR-004, `AGENTS.md` → Drizzle ORM and PostgreSQL 18)
- **FR-043**: Every activity row this feature writes MUST go through the single writing function entry R7 delivers, called inside the mutator's own already-open transaction, rather than through an `INSERT` this feature assembles for itself. (Principle I, R7 FR-011)
- **FR-044**: Each row MUST attach to the project rather than to any issue, and MUST carry the acting admin. A column edit MUST appear on the project's feed and on no issue's feed. (§3.8, `OT-INV-010`)
- **FR-045**: `field` MUST hold the column's name frozen as a display string at the moment the row is written and never re-resolved on read, so a later rename or a deletion of the column leaves every row already written reading exactly as it did. On `column_added`, `column_reordered` and `column_deleted` that is the name the column carries as the row is written; on `column_renamed` it MUST be the name as it stood immediately before the rename, so a feed reader sees the column named as they last saw it. `field` on a rename row therefore repeats `from_value`, which is intended and not a defect. No row MUST carry a reference to the column itself. (`OT-DATA-019`, `OT-DATA-010`; the rename's name chosen per Clarifications 2026-09-04)
- **FR-046**: The value pair MUST carry a transition only where the change has one: `column_renamed` MUST hold the old name in `from_value` and the new name in `to_value`, the old name being the one `field` also carries under FR-045; `column_reordered` MUST hold in `to_value` the name of the column it now follows, null meaning it is now first; `column_added` and `column_deleted` MUST carry neither value. (`OT-DATA-019`, §5)
- **FR-047**: A reorder MUST write exactly one row, for the column the drag moved, rather than one row per column whose ordinal in the list shifted and rather than one row per column in the project. Several reorders in succession therefore write one row each, which the feed's five-minute collapsing folds into one line. (§5)
- **FR-048**: Every row MUST be written in the same transaction as the change it describes, so a refused write leaves no row behind and a written row always has its change behind it. No row this feature writes MUST ever be updated or deleted by any path but the cascade from the project it belongs to. (`OT-INV-011`, `OT-AUTHZ-009`, §5)

#### Concurrency, transactions and refusals

- **FR-049**: Each of the four mutators MUST run in one server transaction, and the response MUST carry the settled state. (`OT-DATA-008`)
- **FR-050**: `deleteColumn` MUST evaluate its four refusals inside its own transaction against rows it has locked, rather than against an earlier read, so two concurrent deletes cannot both succeed and leave a project with no column, no `canceled`-kind column or no `done`-kind column. A read followed by a write MUST NOT be treated as protection for any of the four. Every mutator in this feature that locks a project's column set — `moveColumn` and `deleteColumn` — MUST acquire those locks in one deterministic order: a fixed, total order over the project's column set, the same on every call and the same for both mutators, ordered by a key no mutator rewrites, so that no two column mutations issued concurrently against the same project can serialize in opposite orders and deadlock against each other; the ordering key itself is fixed by [`contracts/mutators.md`](./contracts/mutators.md) rather than here. (`OT-INV-005`, `OT-INV-006`, `OT-INV-012`, `OT-INV-014`, `AGENTS.md` → Drizzle ORM and PostgreSQL 18)
- **FR-051**: Uniqueness MUST be enforced by the database constraint rather than by a check the mutator performs before writing, so two concurrent writes claiming the same name cannot both succeed. The constraint's violation MUST be mapped at the server boundary to the inline error FR-021 and FR-025 describe, naming the existing column. (`OT-INV-016`, `OT-UX-012`)
- **FR-052**: Every refusal reaching a client MUST be a message naming what failed and why, and MUST NOT expose SQL, a constraint name, a stack trace or any server configuration. (`AGENTS.md` → Next.js 16 and the server boundary)

#### Server-side validation of every mutator input

- **FR-053**: Every input the four mutators accept MUST be validated on the server, at the Server Action boundary, before any query runs and before any of it reaches the database, and MUST be enumerated per input rather than left to a general rule. Beyond the name FR-004 already covers, that is `createColumn`'s `projectKey`, `updateColumn`'s and `deleteColumn`'s `columnId`, and `moveColumn`'s `columnId`, `targetColumnId` and `placement`. A TypeScript union is not runtime validation and MUST NOT be relied on as one: `placement` MUST be checked at runtime to be exactly `"before"` or `"after"`, and a value that is neither MUST be refused with an explicit error rather than defaulted, coerced, or treated as one of the two. An identifier MUST be refused unless it is a well-formed UUID, and a project key unless it is a well-formed project key, before either is passed to the database — a malformed identifier reaching a `uuid` column raises a type error whose escape across the boundary FR-052 forbids — and a malformed identifier MUST be reported as the missing row FR-010 already fixes, a value that can name no row naming none. No input MUST be silently coerced, truncated or partially accepted, and no mutator MUST reach its transaction on an input it has not validated. (`AGENTS.md` → Principle II and change gate 3, `OT-AUTHZ-004`)

### Out of Scope

Deferred by the roadmap's R9 boundary, or excluded by the specification itself, and named here so no scenario above is read as covering them:

- **The board's rendering of the result** — entry R10, which renders columns as lists of cards, the card face, the grouping control, card drag and `moveIssue`. This feature changes nothing on `/projects/:projectKey` and moves no card.
- **Any path that moves an issue.** Not deferred — it does not exist and must not. Emptying a column before deleting it is a member's or an admin's own act through the issue rail entry R6 ships, never something a column edit does on their behalf. (§4)
- **Editing a column's kind.** Not deferred — no such path exists at any point in the product, by `OT-INV-015`.
- **A column colour, a swatch or a `column_recolored` event.** Not deferred — §7 retires per-project, per-column and per-label colour outright; a column is told apart by name alone, exactly as entry R8 records for a label.
- **Notifications for any column event.** Not deferred — the three notification types are `mention`, `assignment` and `comment`, and no column edit produces any of them. Entry R11 reaches back into other entries' mutators and reaches into none of these four.
- **Home's progress figure**, which reads `done`- and `canceled`-kind columns — entry R12, which reads them without enforcing `OT-INV-014`, that being `deleteColumn`'s and staying here.
- **The five seeded columns and their fixed order and kinds** — entry R5, which writes them at project creation; this feature adds none of them and reseeds nothing.
- **The `board_column` table, its uniqueness constraint and the composite key an issue's column reference depends on** — entries R5 and R6; this feature writes those rows and creates none of the structure.
- **The activity feed itself** — its component, its reverse-chronological stream, its Comments only toggle, its five-minute collapsing and its pagination are entry R7's, and the rows this feature writes render inside them unchanged.
- **Per-project or per-column permissions** — none exists. Column edits are admin-only for every project, and there is no project-level role.
- **Performance and responsiveness targets** — none are stated and none are invented; what this feature fixes instead is that a rename and a reorder show their result without waiting for the server, and that a delete never runs against a stale emptiness read.

### Key Entities

- **Board column** — a lane belonging to exactly one project, carrying a name unique within that project when folded to lower case, a board position, and a kind of `open`, `done` or `canceled` fixed at the moment it is created. Five are seeded with every project; one added later is always `open`. It carries no colour and no status of its own. This feature is where every one of its fields but `kind` becomes writable.
- **Issue count** — not a stored field but the number of issues currently referencing a column, read for each render. It is what the Columns section shows per row and what the emptiness refusal reads, and the two must be the same number.
- **Column activity row** — one append-only entry on the project's feed for each column added, renamed, reordered or deleted, naming the actor and holding the column's name frozen as a display string — the pre-rename name on a rename row, the name at write time on the other three — plus a transition only where the change has one. It carries no reference to the column, so it survives that column's deletion intact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add a column, rename it, move it and remove it from one screen, with each change visible in the list without navigating away.
- **SC-002**: No column edit ever moves, changes or destroys an issue — verified by taking a full census of every issue's column before and after each of the four mutators and finding it identical.
- **SC-003**: A project always has at least one column, at least one `canceled`-kind column and at least one `done`-kind column, on 100% of delete attempts including two issued concurrently against the last two of a kind.
- **SC-004**: Every refused deletion states which of the four reasons applies, and the same column always produces the same reason — no refusal is ever reported as a generic failure.
- **SC-005**: A column holding issues is never deleted, including where an issue is moved into it after the control was rendered and before the delete is submitted.
- **SC-006**: A name clashing with an existing column, in any casing, is refused with an inline error naming that existing column on 100% of attempts, and no name is ever silently suffixed to make it fit.
- **SC-007**: A column's kind is the same value it was created with for the whole life of the column, verified against the database after every mutator this feature delivers has been exercised on it.
- **SC-008**: Every column added after project creation carries kind `open`, with no path in the product producing any other value after creation.
- **SC-009**: Only an admin can change a project's columns; every non-admin caller is refused on 100% of attempts, including one that bypasses a control entirely — while every signed-in user can read every column, its kind and its count.
- **SC-010**: The count shown beside a column and the reason its Delete control carries come from one and the same read on every render, so the control's enabled or disabled state always agrees with the count rendered beside it. That state describes the last render and is not a promise about the server: the emptiness refusal is re-evaluated inside the delete's own lock, which is authoritative and may still refuse an enabled Delete where an issue was moved into the column after that render (SC-005, third Edge Case).
- **SC-011**: Each of the four column edits produces exactly one activity row — a reorder one row for the column it moved — and a refused edit produces none — verified against the database rather than only through the feed that reads it.
- **SC-012**: An activity row's wording never changes after it is written, including after the column it names is renamed and after it is deleted outright.
- **SC-013**: A reorder is completable with the keyboard alone, and every control this feature adds carries an accessible name and a visible focus indicator.
- **SC-014**: No column is ever removed without a confirmation naming it first, and a dismissed confirmation leaves the column, its issues and the project's activity feed exactly as they were on 100% of attempts.
- **SC-015**: All four column edits succeed on an archived project exactly as they do on an active one, on 100% of attempts, no mutator consulting the project's `status` at any point (§3.8 *Status*, §4 *Nothing cascades*, third Clarification, FR-007).

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap, the requirements index and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

Each names what is assumed, why, and what it would cost to be wrong.

- **`from_value` on a `column_reordered` row is unused.** §5 names `to_value` alone for this type — the column it now follows — and says the pair carries a transition only where the change has one. **If wrong**: recording the column it previously followed is an additive change to one write path.
- **A rename and a reorder apply optimistically; an add and a delete wait for the server.** `OT-UX-008` names in-place field edits and drags as the optimistic cases and reserves the waiting treatment for writes that create or destroy; a delete additionally has four refusals a client cannot evaluate for itself. **If wrong**: a UI timing change with no mutator contract behind it.
- **No backfill and no reseeding.** Projects created before this feature keep exactly the columns they have; this feature writes no column it was not asked to write. **If wrong**: a one-time data migration, not a change to any mutator here.

### Reconciliations between the roadmap, the requirements index and the specification

- **Four `column_*` activity types, not five.** `requirements-index.md`'s `OT-DATA-019` names five, including `column_recolored`, and `OT-DATA-013` requires every column colour to be one of seven palette values. [`docs/product/specifications.md`](../../docs/product/specifications.md) §7 *Palette* states the opposite plainly — there is no per-project, per-column or per-label colour, and the three are told apart by name alone — and §5's own enumeration of `activity.type` lists exactly four `column_` values. The index is derived and not authoritative ([`docs/ROADMAP.md`](../../docs/ROADMAP.md) §1); the specification wins. This feature therefore delivers four types, `OT-DATA-013` is satisfied by a column that carries no colour at all rather than by a palette, and `updateColumn` has no colour path to authorize. Entry R7's spec resolved this identical conflict for `project` before this feature existed, and entry R8's resolved it for `label`.
- **The roadmap's R9 row, entry R7's *Out of Scope* and `OT-DATA-019` each say "five" where the specification says four.** Both forward references were written from the index's count. Nothing about either entry's own delivery changes: R7 established a writer that accepts whatever `activity.type`'s `CHECK` admits, and this feature widens that `CHECK` by four values rather than five. The roadmap's R9 scope boundary is otherwise restated here line for line.
- **This feature widens a table entry R7 shipped.** R7's own FR-004 anticipated exactly this and named R9 as one of the two entries that would do it, so the migration is a planned reach-back rather than an unannounced alteration. Entry R8 has landed and did **not** widen it: `activity_type_valid` admits exactly the seven values `drizzle/0006_lying_sugar_man.sql` created — `created`, `field_changed`, `member_added`, `member_removed`, `archived`, `reopened`, `comment` — and `src/features/labels/` writes no activity row of any type. This feature's migration therefore takes that list from seven values to eleven, with no second widening to compose with and no ordering between two migrations to reason about; the two `label_*` values R8's roadmap entry calls for were never implemented and are tracked outside this feature.
- **The Columns section is read-only for a non-admin rather than disabled-with-a-reason.** §2's general rule is that any action a user cannot take renders disabled with an inline reason, and §3.8 applies exactly that to the Status switch for members. For Columns, §3.8 is specific and says something different: "For everyone else this is a read-only list of the board's columns and their counts." The specific statement governs, and it matches what entry R5 already ships (its FR-044). The disabled-with-reason treatment still applies within this feature, to the Delete control an admin cannot use on a given column (FR-039), which is the only control here whose availability varies for a user who otherwise holds the right.
- **The per-column issue count entry R5 renders becomes load-bearing here.** R5 shipped it as a display value that read zero until R6 landed; this feature makes it the gate on `OT-INV-006`, which is why FR-015 requires the shown count and the refused count to be the same read.

### Inherited constraints, not decisions this specification makes

- The `board_column` table, its `UNIQUE (project_id, lower(name))` constraint, the five seeded rows and their fixed kinds are entry R5's; the composite uniqueness an issue's column reference depends on is entry R6's. This feature creates none of them.
- The data-model conventions — UUIDv7 keys, `text` with `CHECK` for enumerations, explicit `updated_at` through one helper, and the 200-character bound on every name — were established by entry R1.
- The shell hosting project details, the Forbidden screen, the "This doesn't exist" convention, the toast conventions and the per-screen skeletons are entry R2's; this feature renders inside them.
- Project details as one screen, its Columns section, the `isAdmin` and `isMember` predicates and the project record itself are entry R5's; the issues the count reads and the rail that moves them are entry R6's.
- The activity table, its `CHECK`, its append-only rule, the writing function, the feed component, the Comments only toggle, the five-minute collapsing and the 50-row pagination are entry R7's.
- Interaction behaviour, focus management, keyboard support and ARIA semantics come from React Aria Components, with Tailwind as the visual layer only; the drag this feature adds uses React Aria's own drag and drop, which the specification already names for the board.
- The uniqueness, cascade and locking rules this feature relies on are enforced by the database rather than by application code, so their tests run against a real PostgreSQL instance on a separate database rather than a mock.

### Obligations this feature places on entries built before it

- **Entry R7's `activity.type` `CHECK` must be widened by this feature's own migration**, not pre-declared by R7. R7's FR-004 already states this and names R9 as one of the two entries that widen it; it is repeated here so R7's author is not surprised to find another entry altering their table, and so the four values — and not five — are settled by reading two documents rather than by a failing migration.
- **Entry R7's writing function must accept any value the `CHECK` admits at the time it runs**, so this feature calls it directly for its four types without editing it. R7's FR-011 states this; if the function arrives narrower than that, this feature follows the shape that exists and the divergence is recorded here rather than by altering an entry that has shipped.

### Dependencies

**Cannot be built without** — this feature has no code path that works until each has landed:

- **R5** — the `board_column` table and its uniqueness constraint, the project record, the `isAdmin` predicate, and the Columns section on `/projects/:projectKey/details` that this feature adds its four controls to. Without it there is no row to write and no surface to write it from.
- **R6** — the issues the per-column count reads. Without them every column is empty, `OT-INV-006`'s refusal can never be reached, and the emptiness gate cannot be tested for the case it exists to catch.
- **R7** — the `activity` table, its `type` `CHECK` and the single writing function this feature's four events are written through. Without it the activity half of this entry's scope has nowhere to land.
- **R1 and R2**, transitively — the actor resolved on every request, the data-model conventions, and the shell and Forbidden screen the section renders inside.

**Consumed but not blocking** — none. Entry R8 is independent of this one and may be built in parallel, as the roadmap's §3 states; the two share only `activity.type`, and R8 landed widening **nothing** —
`activity_type_valid` still admits exactly the seven values `drizzle/0006_lying_sugar_man.sql` created,
this feature's migration is the only widening and takes that list from seven values to eleven, and the
two `label_*` values R8's roadmap entry calls for were never implemented and are tracked outside this
feature.

**Building this feature before R5, R6 or R7** is not a supported ordering and no requirement here anticipates it. There is no reduced version of the Columns section that renders without project details, and no version of `deleteColumn` whose emptiness refusal is meaningful without issues.

**Dependency approval this feature triggers**: none. React Aria Components and its drag and drop are already on the approved table, the ordering index reuses the scheme and library entry R10 owns and the table already lists, and nothing else here may add a package.

**Downstream reach-back**: R10 renders these columns as the board's lists and depends on this entry directly; R12 reads `done`- and `canceled`-kind columns for Home's progress figure without enforcing `OT-INV-014`, which stays `deleteColumn`'s. Entry R11 reaches into no mutator this feature delivers, because no column event produces a notification of any of the three types.
