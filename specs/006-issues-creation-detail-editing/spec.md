# Feature Specification: Issues — creation, detail and editing

**Feature Branch**: `claude/r6-feature-specifications-e8c87e`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R6**

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "create feature specifications for roadmap entry R6. Refer to @docs/ROADMAP.md . Pull a PR after creating done"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R6** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## Clarifications

### Session 2026-08-30

- Q: Where on the issue detail page should the Delete control sit, who sees it, and does it ask for confirmation before destroying the issue? → A: In the issue rail beneath the four editable fields; admin-only; disabled with an inline reason for everyone else; confirms once before writing.
- Q: After an admin successfully deletes an issue, which screen should the browser land on? → A: The project's details page, `/projects/:projectKey/details`, which entry R5 already delivers.
- Q: What should the delete confirmation say — just the issue's identity, or the size of everything the cascade will destroy along with it? → A: Name the issue and state the size of what the cascade reaches, as a project (§3.8) and a label (§3.10) do; with nothing attached to an issue yet it confirms without a count, and each later entry adds its own as it attaches.
- Q: When someone types a title over 200 characters or a description over 10 000, what should happen? → A: An inline error on the field, on both write surfaces, naming the bound; nothing is truncated, no save is issued, and the server rejects an over-length value independently of the client's check.
- Q: Should this feature extract R5's markdown implementation into one shared renderer serving both descriptions, or ship a second implementation of its own? → A: Extract it into one shared renderer, moving R5's two surfaces onto it in the same change and adding no dependency; this is the second call site, so Principle I's precondition for extraction is met.
- Q: Is the markdown subset for issue descriptions identical to the one for project descriptions, or may the two diverge? → A: Identical — `OT-DATA-015` names both in one sentence; a divergence would need a specification amendment.
- Q: May the extraction change what R5's project-description surfaces render? → A: No. R5's own acceptance scenarios stand as the regression test; a genuine divergence from `OT-DATA-015` there is an R5 defect fixed as one.
- Q: Does either description field offer a markdown preview or a formatting toolbar? → A: Neither. The field shows raw source and the rendered form appears on save, on the create form and the issue page alike.
- Q: Must each `updateIssue` call run inside a single transaction, the way `createIssue` and `deleteIssue` already must? → A: Yes — one transaction per call, reading the stored row and writing within it, so a later entry's activity or notification row lands or fails with the change rather than restructuring the mutator to join one.
- Q: Should `updateIssue` accept only the fields being changed and work out which of those values actually differ from what is stored? → A: Yes — a partial set, unnamed fields untouched, and the changed-field determination made inside its own transaction; a call that changes nothing writes nothing.
- Q: Should this feature build extension points — hooks, events, a dispatch layer — for the four later entries? → A: No. The mutators stay direct and later entries edit them; Principle I extracts only at a second call site, and an unused seam is dead code under Principle VI.
- Q: When R8 and R11 add their arms to the delete cascade, do they attach at the database or by editing `deleteIssue`? → A: At the database — each declares its table's cascading reference to the issue, and `deleteIssue`'s own body does not change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member creates a unit of work (Priority: P1)

A project member presses **New issue** from any project-scoped screen, types a title, optionally sets a description, column, priority, assignee and due date, and presses Create. One issue comes into being carrying a permanent, shareable key — `WEB-142` — and the browser lands on that issue's own page.

**Why this priority**: An issue is the unit of work the whole product exists to track. Nothing in R7 through R12 has anything to attach to until an issue exists — comments, activity, labels, notifications and every card on the board all hang off one — and the project R5 delivers holds nothing until this story lands.

**Independent Test**: Sign in as a member of a project that holds no issues, open `/projects/:projectKey/issues/new`, submit a title alone, and confirm one issue exists carrying the project's key plus number 1, the project's first column, no priority, no assignee, no due date, and a sort position at the foot of the project's order. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** a member of a project with no issues, **When** they submit Create issue with a title alone, **Then** exactly one issue is created with number 1, the project's first column by board position, priority "No priority", no assignee and no due date, and the browser navigates to that issue's detail page.
2. **Given** a project already holding issues numbered 1 to 7, **When** a member creates another, **Then** it takes number 8, and no existing issue's number, column or position changes.
3. **Given** two members submitting Create issue in the same project at the same moment, **When** both writes land, **Then** each issue receives a distinct number and neither is refused.
4. **Given** a member on the Create issue form, **When** they submit a title of only whitespace, **Then** the form reports the missing title inline, the Create control stays enabled, and no issue is written.
5. **Given** a member who has filled the form, **When** they press Cancel, **Then** they return to where they came from and nothing is written.
6. **Given** a member who has pressed Create, **When** the server has not yet answered, **Then** the Create control shows in-flight state and no key is displayed anywhere until the server supplies the number.

---

### User Story 2 - Anyone opens an issue at a shareable URL (Priority: P2)

Any signed-in user opens an issue's page at its own address, reads the key, title, description and every field on the rail, and can hand that address to a colleague who sees exactly the same page.

**Why this priority**: A tracker whose issues cannot be linked to is a tracker nobody quotes in a conversation. Creation is worth nothing until the thing created can be opened, and everything R7 onward renders — the feed, the labels, the notification deep links — is rendered on this page.

**Independent Test**: With one issue in the database, open `/projects/:projectKey/issues/:issueNumber/details` as a signed-in non-member, and confirm the key is the page's first element, the title and description render, the rail shows column, priority, assignee and due date, and project, created-by and timestamps render as values rather than controls.

**Acceptance Scenarios**:

1. **Given** an existing issue, **When** any signed-in user opens its detail route, **Then** the page renders its key, title, description, and a rail carrying column, priority, assignee and due date, with project, created-by and timestamps shown as values.
2. **Given** an issue whose description holds bold, italic, inline code, a link, a bullet list, a numbered list and a heading, **When** the page renders, **Then** each construct renders as itself.
3. **Given** an issue whose description holds a table, an image, an embed or raw HTML, **When** the page renders, **Then** each renders as its own literal text and no markup is executed.
4. **Given** a project key that matches no project, or an issue number that matches no issue in that project, **When** a signed-in user opens the route, **Then** the page reads "This doesn't exist" and implies no hidden-access state.
5. **Given** issue number 7 in project `WEB` and issue number 7 in project `API`, **When** a user opens `/projects/WEB/issues/7/details`, **Then** they see the `WEB` issue and never the `API` one.
6. **Given** an unauthenticated caller, **When** they request an issue detail route, **Then** they are redirected to `/signin` and never reach the Forbidden screen.

---

### User Story 3 - A member changes every field on an issue (Priority: P3)

A project member clicks the title or the description and edits it where it stands, and changes column, priority, assignee or due date from the rail. Each change applies immediately and, if the server refuses it, reverts with a message saying why.

**Why this priority**: Editing an issue *is* the work. Without it an issue is a note nobody can correct, and the column control here is the only route to move an issue anywhere until the board lands in R10.

**Independent Test**: As a member, edit the title, the description, and each of the four rail fields on one issue, and confirm each is one save, each is visible before the server answers, and each reverts with a message when the server refuses.

**Acceptance Scenarios**:

1. **Given** a member on an issue page, **When** they click the title, change it and blur, **Then** exactly one save runs for the title, the new value is visible immediately, and no other field is written.
2. **Given** a member editing the title, **When** they press Escape, **Then** the field reverts to the saved value and nothing is written.
3. **Given** a member editing the description, **When** they press ⌘-enter, **Then** the edit saves, and the description returns to rendered markdown rather than raw source.
4. **Given** a member who has changed the assignee, **When** the server refuses the write, **Then** the rail reverts to the previous assignee and a message names what failed and why.
5. **Given** a member on the rail's column control, **When** they open it, **Then** it offers that project's own columns and no other project's.
6. **Given** an issue with an assignee and a due date, **When** a member clears either, **Then** the issue becomes unassigned or undated and the change persists.
7. **Given** a member on an issue page, **When** they look for a way to move the issue to another project, **Then** none is offered, and the project renders as a value rather than a control.

---

### User Story 4 - A non-member meets the write boundary and understands it (Priority: P4)

A signed-in user who is not a member of the project — including one who has been assigned an issue in it — opens the issue, reads everything, and finds every control disabled with a sentence naming the project they would need to be added to.

**Why this priority**: Everyone reads everything, so this is the state most users are in on most issues. Getting it wrong turns a readable product into one that looks broken; the assigned non-member in particular is a state the specification names explicitly.

**Independent Test**: As a signed-in non-member assigned an issue, open that issue and confirm every rail control and the title and description are disabled with an inline reason naming the project, that the header's New issue control is disabled with the same reason, and that the create route answers Forbidden.

**Acceptance Scenarios**:

1. **Given** a signed-in non-member, **When** they open an issue in a project they do not belong to, **Then** they can read every field, the title and description are not clickable, and every rail control is disabled with an inline reason naming the project.
2. **Given** a non-member who is the issue's assignee, **When** they open the issue, **Then** the page explains why they cannot change it and names the project they would need to be added to.
3. **Given** a non-member on any project-scoped screen, **When** the header renders, **Then** the New issue control is visible, disabled, and carries a reason naming the project — never hidden.
4. **Given** a non-member, **When** they reach `/projects/:projectKey/issues/new` by deep link, bookmark or stale tab, **Then** they get the Forbidden screen.
5. **Given** a member with the issue page open, **When** their membership is removed, **Then** no row they wrote is removed and their controls become disabled on the next render.
6. **Given** an admin who holds no membership row in the project, **When** they open an issue in it, **Then** every control is enabled, because the predicate admits every admin.

---

### User Story 5 - An admin destroys an issue, and a member cancels one instead (Priority: P5)

An admin deletes an issue outright and it is gone with everything that referenced it. A member, who cannot delete, moves it into a `canceled`-kind column instead — reversible, and it keeps its history.

**Why this priority**: It closes the issue's lifecycle, and it is the one place in this feature where the two roles diverge on a destructive act. It is last because an issue that cannot yet be deleted is still a usable issue.

**Independent Test**: As an admin, use the issue rail's Delete control, pass its confirmation, and confirm nothing that referenced the issue survives and the browser lands on that project's details page; as a member, confirm the same rail control is visible and disabled with its reason and that moving the issue into a `canceled`-kind column is available instead.

**Acceptance Scenarios**:

1. **Given** an admin on an issue page, **When** they press Delete in the rail and confirm once, **Then** the issue and everything that referenced it are gone together, and the browser lands on that project's details page.
2. **Given** a member on an issue page, **When** they look for a delete control, **Then** it is in the rail, visible, disabled and carrying its reason — never hidden.
3. **Given** a member who wants an issue out of the way, **When** they use the rail's column control, **Then** the project's `canceled`-kind column is offered like any other and the move is reversible.
4. **Given** a non-admin, **When** they call the delete path directly, bypassing the disabled control, **Then** the server refuses it.
5. **Given** a project whose highest issue number is 12 and whose issue 12 has been deleted, **When** a member creates a new issue, **Then** it takes number 13 and never 12.

### Edge Cases

- **An issue number that exists in a different project** does not resolve under this project's key — numbers are per project, and the pair is the address.
- **Two members creating issues in one project at the same moment** each receive a distinct number; the counter hands them out one at a time and neither creation is refused.
- **Deleting the highest-numbered issue in a project** frees nothing: the next number is still higher than every number ever issued in that project.
- **A project whose first column has been renamed or recoloured** still supplies the create form's default column — the default is the first board position, not a name.
- **A title of only whitespace** is refused, because the title is trimmed before it is required.
- **A blur on a field the user did not change** writes nothing.
- **Two members editing the same field at the same moment** resolve last-write-wins; neither write is rejected and neither client is told it lost.
- **An assignee removed from the project** keeps the assignment and their name keeps rendering; the assignee control no longer offers them.
- **A deactivated assignee** keeps the assignment and their name keeps rendering; the assignee control never offers them.
- **Clearing the assignee** is legal and leaves the issue unassigned; clearing the due date is legal and leaves it undated.
- **A due date in the past** is accepted — no rule refuses one, and overdue is a state the product reads elsewhere.
- **A description carrying an unsupported markdown construct** — a table, an image, an embed — renders as its own literal text rather than as the construct.
- **A link whose scheme is neither `http`, `https` nor `mailto`** renders as text rather than as a link.
- **Create issue opened for a project key that matches nothing** reads "This doesn't exist" rather than Forbidden — there is no project against which to run a membership check.
- **An issue sitting in the project's only `canceled`-kind column** can still be moved out of it; no transition is terminal and nothing pins an issue to a column.
- **A title or description past its length bound** is refused on the field with an inline error naming the bound, on the create form and the issue page alike; nothing is shortened and no save is issued.
- **An admin who is not on the project's roster** creates, edits and deletes issues in it, because `isMember` admits every admin.
- **An issue whose cascade reaches nothing** — every issue, while this feature is the newest one built — confirms without a count, naming only the issue itself.
- **A title of exactly 200 characters, or a description of exactly 10 000**, is accepted; one character more is refused. The bound is inclusive on both fields and on both write surfaces.
- **Text pasted into the title carrying line breaks** is accepted as one line with those breaks collapsed to spaces, rather than refused — a refusal would discard what the user pasted.
- **A description holding an unclosed emphasis run or an unterminated link** renders as the characters typed. Malformed markdown is not an error state and produces no message.
- **A project whose assignee pool is empty** — no members and no active admin other than the viewer — offers an assignee control that can only be left unassigned, not a hidden or absent one.
- **A project holding exactly one column** offers a column control with one option, which is already the issue's own; no transition is possible and none is refused.
- **A column deleted while a save moving an issue into it is in flight** has that save refused by the database and rolled back with its reason, not applied against a column that no longer exists.
- **A project whose issue-counter row is missing** refuses creation rather than creating the row, because a fresh counter could reissue a number that already exists.
- **Membership granted mid-session** enables the controls on the next render, exactly as removal disables them; neither requires signing out and in.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure and the issue record

No user journey observes these directly. Each is verified against the schema and the queries that read it — a column's type, bound and constraint by inspecting the migration the change generates, and a constraint by asserting that the database itself refuses the violating write.

- **FR-001**: Every issue MUST belong to exactly one project, and no path MUST exist that creates one without a project. (`OT-INV-001`, `OT-SCOPE-002`)
- **FR-002**: Issues MUST be flat. No issue MUST reference another as parent or child, and no column expressing such a reference MUST exist. A team breaking work down uses a checklist in the description or separate issues in the same project. (`OT-SCOPE-003`, `OT-INV-003`, §3.4)
- **FR-003**: An issue MUST carry a project, a number, a title, a description, a column, a priority, an assignee, a due date, a creator and an ordering index — and no status field of its own; its column carries the semantics a status enum would. (§5)
- **FR-004**: An issue's priority MUST be exactly one of `none`, `low`, `medium`, `high` or `urgent`, defaulting to `none` and rendered as **No priority**, **Low**, **Medium**, **High**, **Urgent**. No sixth value MUST exist. (§3.5, §5)
- **FR-005**: An issue's column MUST be required and MUST always be a board column of the issue's own project, enforced by a composite foreign key on the project and column pair rather than by a mutator's own check alone. That key requires the board-column table to carry a uniqueness guarantee over the same pair, which a primary key on the column alone does not supply; this feature MUST add that guarantee to entry R5's table, since R5 has no other use for it. The key MUST be declared so that its check is deferred to the end of the statement rather than raised immediately, so a project delete removing columns and issues in one statement cannot fail on an intermediate state. (`OT-INV-004`)
- **FR-006**: An issue's assignee and due date MUST each be optional and independently clearable. The due date MUST be a calendar date compared in the server's own timezone, so a date means the same day for every user on the installation. Every calendar date the date type admits MUST be accepted, past dates included; no rule MUST refuse a due date for being early, late or distant, and overdue MUST be a state other screens read rather than one this feature prevents. (`OT-DATA-004`, §3.5, §5)
- **FR-007**: An issue MUST NOT change project. `updateIssue` MUST offer no path that sets the project, and the project MUST render as a shown value rather than a control. (`OT-INV-002`, `OT-UX-010`)
- **FR-008**: The issue table MUST follow the data-model conventions entry R1 established — a server-generated UUIDv7 primary key, `text` with a `CHECK` for the priority enumeration, a date type for the due date and a timezone-aware type for instants, and a `CHECK` bounding the title at 200 characters and the description at 10 000. Both bounds MUST be inclusive — a value of exactly the bound is accepted and one character more is refused — MUST be counted the way the database's own `CHECK` counts, and MUST be applied to the value as it will be stored, so the title's bound is measured after FR-030's trim rather than before it. Every mutator MUST write `updated_at` explicitly through the shared helper. (`OT-DATA-001`, `OT-DATA-002`, `OT-DATA-003`)
- **FR-009**: An issue description MUST be stored as markdown source and MUST support only bold, italic, inline code, links, bullet and numbered lists, and headings. Tables, images and embeds MUST NOT be supported, and HTML MUST be escaped rather than rendered. The syntax MUST be exactly this and MUST admit no alternative spelling of any construct: `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, a heading as one to six `#` followed by a space, a bullet item as a line opening `- ` or `* `, and a numbered item as digits followed by `.` and a space. `_` MUST carry no meaning at all, so `created_at` and `snake_case` render whole. There MUST be no backslash escape, no bare-URL autolink, no nesting of one inline construct inside another, and no significance to indentation before a list marker. Anything the grammar does not match — an unclosed emphasis run, an unterminated link, a fence, a blockquote, a rule, a table, an image, an embed or any HTML — MUST render as the characters the author typed, never as an error and never as the construct it resembles. This MUST be the same subset a project description takes — `OT-DATA-015` fixes one subset for both — so one implementation serves both and any divergence between them requires a specification amendment. (`OT-DATA-015`)
- **FR-010**: A link in a rendered description MUST carry an `http`, `https` or `mailto` scheme; a link with any other scheme MUST render as text. (`OT-DATA-015`, `AGENTS.md` → Architecture notes)
- **FR-011**: An issue's creator MUST be the actor who created it and MUST NOT be changed by any mutator; it MUST render as a shown value alongside the timestamps. (§3.4, §5, `OT-UX-010`)

#### The key and per-project numbering

- **FR-012**: An issue MUST be addressed as its project's key plus its own per-project number — `WEB-142`. Both parts MUST be permanent, and both MUST render read-only on the issue page. (§3.4, §5 *Keys*, `OT-UX-010`)
- **FR-013**: The number MUST be drawn from that project's issue-counter row under a row lock, inside the creating transaction, and MUST NOT touch the project row. The lock MUST be held across both the read of the stored value and the write of its successor and MUST NOT be released between them, so a second draw for the same project waits rather than reading a value that is about to change. The row this feature reads MUST hold the highest number yet issued for its project, keyed by that project and created with it; the draw MUST advance that value and take the result. (`OT-DATA-012`, `OT-INV-009`)
- **FR-014**: Issue numbers MUST be monotonic per project and MUST never be reused. Deleting an issue MUST NOT return its number to the counter, and neither MUST a creation that draws a number and then fails: a gap in a project's numbers MUST NOT be treated as an error to correct. (`OT-INV-009`, `OT-DATA-012`)
- **FR-015**: The number MUST be assigned server-side and MUST be final the first time the client sees it. Creation MUST NOT be optimistic and MUST NOT display a provisional key. (§3.5, §5 *Keys*, `OT-UX-008`)
- **FR-016**: Two creations racing in one project MUST each receive a distinct number, and neither MUST be refused for the race. (`OT-DATA-012`, `OT-INV-009`)
- **FR-017**: An issue MUST be resolved from the pair of project key and issue number. A number that exists only in another project MUST NOT resolve under this project's key. (§3.4, §5 *Keys*)

#### Authorization and the write boundary

- **FR-018**: `createIssue` and `updateIssue` MUST each require `isMember` of the issue's own project; `deleteIssue` MUST require `isAdmin`. These MUST be the only three mutators this feature delivers. `isMember` MUST admit every admin without a membership row, so no rule this feature writes MUST carry its own admin branch, and an admin MUST reach every write on both screens in a project whose roster does not name them. (§2)
- **FR-019**: Every mutator this feature delivers MUST enforce its predicate on the server and MUST derive the project it checks from a row the server read, never from a client-supplied project identifier. For `updateIssue` and `deleteIssue` that row MUST be the stored issue; for `createIssue`, which has no stored issue, it MUST be the project resolved from the route's own key. Each MUST resolve that row first, refuse a caller it cannot find the row for as a missing row rather than as a refusal, and only then run its predicate — an issue's existence is not a fact membership hides, because `FR-021` makes every issue readable by every signed-in user. A caller with no session MUST be refused by every mutator independently of any route guard. The client MAY run the same predicates to disable controls; the server check MUST be the enforcement. (`OT-AUTHZ-004`, `OT-AUTHZ-005`)
- **FR-020**: A member MUST be able to edit **any** issue in their project, not only their own. No authorship check MUST exist on an issue. (§2)
- **FR-021**: Every signed-in user MUST be able to read every issue in every project. Membership MUST NOT be used as a visibility boundary anywhere in this feature. (`OT-AUTHZ-002`)
- **FR-022**: The assignee pool — on Create issue and on the rail alike — MUST be that project's membership rows **plus** every admin, with deactivated users excluded. This MUST be a server-enforced constraint and not only what the controls offer: `createIssue` and `updateIssue` MUST refuse an assignee outside the pool of the issue's own project, whatever the client sent. This is the one list in this feature that reads membership rows plus admins rather than running the `isMember` predicate. (`OT-AUTHZ-007`)
- **FR-023**: An assigned non-member MUST be a supported state: they MUST see their issue, MUST be able to change nothing on it, and the page MUST explain why and name the project they would need to be added to. That explanation MUST satisfy FR-026's requirements for a reason and MUST additionally be readable without operating any control, so the state is understood from the page as it first renders. (`OT-AUTHZ-015`)
- **FR-024**: An assignee later removed from the project or deactivated MUST keep the assignment, and their display name MUST keep rendering wherever it already did. This MUST hold for an assignment that already exists only: neither mutator MUST accept such a person as a **new** assignee, because FR-022's pool no longer contains them. (`OT-AUTHZ-014`)
- **FR-025**: Losing write access mid-session MUST remove no rows; the affected controls MUST become disabled on the next render — meaning the next time the server renders the screen, which any navigation to it or revalidation of it produces, and not the currently open page, which MUST NOT be required to detect the change on its own. Gaining write access mid-session MUST behave as the mirror: the controls become enabled on that same next render, with no sign-out and no sign-in. Neither transition MUST be enforced by the client; a write attempted from a stale page MUST be refused by the server under FR-019. (`OT-AUTHZ-012`)
- **FR-026**: Every action a user cannot take on these screens MUST render as a disabled control carrying an inline reason. A dead button MUST NOT be used and a tooltip alone MUST NOT be the explanation. Every such reason MUST name the capability the user lacks and the project it is scoped to, in that project's own name rather than its key — "Only project members can edit issues in Website Redesign" is the form §4 already fixes — and MUST be rendered as text rather than conveyed by styling. Nothing on either screen MUST be hidden for a permission reason: §2's hide-rather-than-disable rule covers admin-only navigation and nothing else, and neither screen carries navigation. (`OT-UX-002`)

#### Create issue

- **FR-027**: Create issue MUST be a full page at `/projects/:projectKey/issues/new`, not a modal. (§3.5, `OT-SCOPE-007`)
- **FR-028**: The header's **New issue** control MUST point at this page on every project-scoped screen that exists when this feature lands — project details, issue detail and create issue, and no other, the board being R10's — and for a non-member it MUST render disabled with an inline reason naming the project — visible, never hidden. (`OT-UX-021`, §3, *The shell*)
- **FR-029**: A signed-in non-member who reaches `/projects/:projectKey/issues/new` by any route MUST get the Forbidden screen; an unauthenticated caller MUST be redirected to `/signin` and MUST NOT reach Forbidden. The disabled control and the Forbidden screen MUST be independent — neither MUST imply the other was skipped. (§3.5, §3.11, `OT-SEC-015`, `OT-UX-021`)
- **FR-030**: Title MUST be required and trimmed, MUST be the form's first and focused field, and MUST be the form's only required field. (§3.5)
- **FR-031**: Description MUST be optional and multi-line, MUST grow with its content, and MUST take the markdown subset FR-009 fixes. (§3.5)
- **FR-032**: Column MUST offer the project's own board columns and MUST default to the project's first column by board position. (§3.5, §3.8)
- **FR-033**: Priority MUST default to **No priority**. (§3.5)
- **FR-034**: Assignee MUST be optional, MUST draw from FR-022's pool, and MUST default to unassigned. (§3.5)
- **FR-035**: Due date MUST be optional. (§3.5)
- **FR-036**: The project MUST be fixed by the route and MUST NOT appear as a field on the form. (§3.5)
- **FR-037**: Validation MUST be per field and on blur, and MUST run again on submit for every field, so a form submitted without any field having been blurred reports what is missing on the fields themselves rather than accepting the write or reporting nothing. The Create control MUST stay enabled and report what is missing inline rather than going dead. A value exceeding FR-008's length bound MUST be reported the same way, as an inline error on the field naming the bound; it MUST NOT be truncated, capped at the keyboard or silently accepted, and the server MUST reject it independently of whatever the client checked. (`OT-UX-011`)
- **FR-038**: Creation MUST NOT be optimistic: the form MUST wait for the server and MUST show in-flight state on the Create control. (`OT-UX-008`, §3.5)
- **FR-039**: Create MUST run exactly one `createIssue` call, and that call MUST write the issue and draw its number in one transaction. On success it MUST navigate to the new issue's detail page; Cancel MUST return to where the user came from and MUST write nothing. (§3.5)
- **FR-040**: `createIssue` MUST write an ordering index after every existing issue in the same project, so a new issue sorts last under every grouping, and MUST touch no existing row. Where the project holds no issue at all, it MUST write the first index of the same scheme rather than an empty or sentinel value, so the first issue and the hundredth are ordered by the same rule. This MUST be the only ordering write in this feature. (`OT-DATA-018`)

#### Issue detail — reading

- **FR-041**: Issue detail MUST be a full page at `/projects/:projectKey/issues/:issueNumber/details`, deep-linkable and readable by any signed-in user, rendered inside the shell rather than as a peek panel. (§3.4, `OT-SCOPE-007`, `OT-AUTHZ-002`, `OT-UX-001`)
- **FR-042**: The page MUST be a main column plus a 262px meta rail. The key MUST be the page's first element in reading order — first in the document, and therefore first for a screen reader and for the keyboard as well as visually. It MUST be the copy-link target, and what it copies MUST be the issue's full address, the same one the browser shows, so that what is pasted opens the issue for whoever receives it. (§3.4)
- **FR-043**: The main column MUST carry the key, the title and the description, in that order. (§3.4)
- **FR-044**: A description MUST render its markdown on read and MUST show its raw source while it is being edited. This feature is the subset's second call site, so the implementation entry R5 wrote for project descriptions MUST be extracted into a single shared renderer serving both, promoted out of R5's feature directory into the shared location the repository reserves for code with a real second use, and referenced from there by both features rather than re-exported through either. It MUST add no dependency, meaning no package absent from `AGENTS.md`'s approved table — a package already present on disk because something else depends on it counts as added the moment this feature imports it directly. The extraction MUST NOT change what R5's surfaces render: R5's own description acceptance scenarios MUST pass unchanged and stand as its regression test, and a genuine divergence from `OT-DATA-015` in that implementation MUST be fixed as an R5 defect rather than absorbed here. An issue with no description MUST render nothing where the description would be rather than an empty box or a placeholder, and MUST be indistinguishable from one whose description is present but empty — the two MUST NOT be given different treatments, because a user cannot tell them apart either. Neither this page's editor nor the create form MUST offer a markdown preview or a formatting toolbar. (§3.4, §3.5, `OT-DATA-015`, Principle I)
- **FR-045**: The rail MUST show the issue's project, its creator and its timestamps as shown values rather than controls, following the same convention every immutable field in the app uses. (§3.4, `OT-UX-010`, `OT-INV-002`)
- **FR-046**: A project key matching no project, or an issue number matching no issue in that project, MUST read "This doesn't exist" and MUST NOT imply a hidden-access state. (`OT-UX-004`)
- **FR-047**: The page MUST render identically for every user in structure, and MUST differ only in which of its controls are enabled and in the reasons those controls carry. Identical in structure MUST mean that the same elements are present in the same order for every user: no element MUST be absent for one user and present for another, and no element MUST change its kind — a control for one user MUST NOT become plain text for another. (§3.4, §3.8, `OT-UX-002`)

#### Issue detail — in-place editing and the rail

- **FR-048**: Title and description MUST be edited in place: clicking the value MUST turn it into a field, Escape MUST revert, and a blur or ⌘-enter MUST save, with exactly one `updateIssue` call per field. No edit mode and no separate form MUST exist. The gesture MUST be reachable by keyboard alone: the value MUST be focusable and MUST enter edit mode from the keyboard without a pointer, and the save accelerator MUST be the platform's own command modifier with Enter, so a keyboard without a Command key uses Control and Enter. Focus MUST be placed in the field when edit mode opens, and MUST return to the value when the edit saves, reverts or is refused — it MUST NOT be lost to the document. (`OT-UX-009`, §3.4)
- **FR-049**: The title MUST be a single line, required and trimmed; the description MUST be a multi-line area that grows with its content up to the height at which the page itself scrolls, and MUST scroll within itself beyond that rather than growing without limit. Content pasted into the title MUST have its line breaks collapsed to single spaces and MUST be accepted as one line rather than refused, since a refusal would discard what the user pasted. A value exceeding FR-008's length bound MUST keep the field open carrying an inline error naming the bound and MUST issue no save, so the two write surfaces refuse an over-length value the same way. (§3.4)
- **FR-050**: An in-place edit MUST apply optimistically and MUST roll back with a message naming what failed and why when the server refuses it. That message MUST be a toast of the error kind, per the convention §4 fixes, and MUST NOT be the only signal — the rolled-back value MUST itself be visible. A refusal MUST read the same way whatever refused it, so a write the database rejects reaches the user in the product's own terms rather than in the database's. A **successful** write MUST raise no toast at all: the settled value is the confirmation, and a toast per field edit would make the common case the noisy one. (`OT-UX-008`, §4)
- **FR-051**: The rail MUST offer column, priority, assignee and due date as quick-change controls for members, each one `updateIssue` call applied optimistically, and MUST render each as a disabled control with an inline reason for a non-member. (§3.4, `OT-UX-008`, `OT-UX-002`)
- **FR-052**: The rail's column control MUST offer only board columns of the issue's own project. A save naming a column that has ceased to exist, or that belongs to another project, MUST be refused rather than applied — by the database under FR-005, not by the control's contents alone — and MUST roll back under FR-050 like any other refusal. (`OT-INV-004`, §3.4)
- **FR-053**: Every column transition MUST be legal in both directions, with no terminal state, no guardrail and no confirmation on the transition itself. (`OT-OPS-011`, §4)
- **FR-054**: For a non-member the title and description MUST NOT be clickable and MUST carry the same disabled reason as the rail. (§3.4)
- **FR-055**: `updateIssue` MUST accept no path that changes the project, the number, the creator or the ordering index. It MUST accept only the fields a caller is changing and MUST leave every field it is not given untouched. Each call MUST run in one transaction, and within that transaction it MUST determine which of the named fields differ from the stored row and what each differs from. That determination MUST be made against the values as stored, MUST be available at the point in the transaction where a later entry's activity or notification row would be written, and MUST NOT be returned to the caller — nothing in this feature reads it, and a value exposed only for a later entry to consume would be dead code. Its two uses here MUST be deciding whether to write at all and deciding which columns the write names. A call whose named values all match the stored row MUST write nothing, `updated_at` included. (`OT-INV-002`, `OT-INV-009`, `OT-DATA-018`, §5)

#### Delete

- **FR-056**: `deleteIssue` MUST require `isAdmin`, and MUST refuse a non-admin caller independently of whether the disabled control was bypassed. A member's route to remove an issue MUST be moving it into a `canceled`-kind column, which is reversible and keeps history. (§2, §4)
- **FR-057**: The delete MUST be hard and MUST cascade in the database. There MUST be no soft-delete marker on an issue; moving to a `canceled`-kind column MUST be the reversible path. (`OT-DATA-007`)
- **FR-058**: The delete MUST run in one database transaction and MUST NOT answer the caller until that transaction has committed, so the state the response describes is the state every later reader will find. No reader on any connection MUST be able to observe a moment in which the issue is gone and something that referenced it is not, nor the reverse. (`OT-DATA-008`)
- **FR-059**: The cascade MUST reach every row that references the issue. In this feature nothing else references one, so the cascade removes the issue alone. §4 names four arms and each belongs to exactly one later entry: comments and activity to R7, label joins to R8, notifications to R11. Each of those entries MUST attach its own arm by declaring its table's cascading reference to the issue at the database — the arm is a property of the referencing table's own declaration, not of this mutator — so `deleteIssue`'s own body does not change as arms are added. (§4)
- **FR-060**: A successful delete MUST navigate away from the deleted issue to that project's details page, `/projects/:projectKey/details`. The destination MUST be a route that exists when this feature lands, so the delete leaves no user on a page that has ceased to exist. (§4, §3.8)
- **FR-061**: The Delete control MUST sit in the issue rail, beneath the column, priority, assignee and due-date controls. For an admin it MUST be enabled; for every other user it MUST render visible and disabled carrying an inline reason, never hidden. It MUST confirm once before writing, and no path MUST exist that destroys an issue without that confirmation. That confirmation MUST take focus when it opens, MUST hold focus within itself while it is open, MUST be dismissible by Escape and by an explicit cancel, and MUST return focus to the Delete control when dismissed. It MUST NOT open with the destructive action focused. (§2, §3.8, §3.10, `OT-UX-002`)
- **FR-062**: The confirmation MUST name the issue by its key and title and MUST state the size of what the cascade will destroy alongside it, following the convention a project delete (§3.8) and a label delete (§3.10) already use. Where the cascade reaches nothing, it MUST confirm the same way without a count. Each later entry that attaches rows to the cascade MUST add its own count to this confirmation. (§3.8, §3.10, §4)

#### Concurrency, transactions and refusals

- **FR-063**: Each mutator MUST run inside exactly one database transaction — one transaction in the database's own sense, not one logical operation spanning several. No isolation level is prescribed; what is required is the guarantee each transaction MUST provide. `createIssue`'s draw MUST serialize concurrent draws for one project, so two creations cannot read the same stored number. `updateIssue`'s read of the stored row and its write MUST be serialized against another `updateIssue` on the same issue, so two concurrent saves cannot each compute their change against the same prior value and report the same transition twice. (`OT-DATA-012`, `OT-DATA-008`, §5)
- **FR-064**: Two members editing the same field at the same moment MUST resolve last-write-wins: both writes MUST be accepted, neither MUST be refused for the conflict, neither caller MUST be told it lost, and the value that commits later MUST stand. No lock, version check or merge MUST be offered to the user, and no change MUST be discarded silently on the way to that outcome — the earlier write happened, and the later one replaced it. (§3.3, §4, `OT-SCOPE-005`)
- **FR-065**: A write the database refuses MUST reach the caller as the same kind of refusal as one a mutator refused: the change rolls back and a message names what failed in the product's own terms. No message returned to a client MUST carry SQL, a constraint or column name, a stack trace, or any configuration value; those MUST go to the server log instead. (§4, `AGENTS.md` → Next.js 16 and the server boundary)
- **FR-066**: `createIssue` MUST refuse when the project's issue-counter row is absent, and MUST NOT create one. The row is created with the project and destroyed with it, so its absence is a broken invariant rather than a state to repair — repairing it here would issue a number that may already have been issued. (`OT-DATA-012`, §5)

#### Loading, focus and accessibility

- **FR-067**: Applying the convention entry R2 fixes and does not implement, both screens MUST show a skeleton matching the layout it replaces while their data loads — the issue page its main column and rail, the create form its fields — rather than a full-screen spinner, and data landing MUST NOT shift the layout. The skeleton MUST sit below each route's authorization decision, so a refused or missing route answers as itself rather than as a loading screen. (`OT-UX-005`, §4)
- **FR-068**: Applying §7's rules to this feature's own controls, no state on either screen MUST be conveyed by colour alone: a column's colour, a priority's colour and every validation state MUST each carry a text or shape equivalent. Every disabled control's inline reason MUST be associated with its control programmatically, so it reaches assistive technology as that control's explanation rather than as loose adjacent text, and every control MUST carry an accessible name and a visible focus indicator. (`OT-UX-018`, `AGENTS.md` → React Aria Components)

### Out of Scope

Deferred by the roadmap's R6 boundary, and named here so no scenario above is read as covering them:

- **The Labels field on Create issue and the rail's label picker** — entry R8, which also delivers `addIssueLabel`, `removeIssueLabel`, the `label_added` / `label_removed` activity and the `issue_label` arm of this feature's delete cascade. This feature renders no label control anywhere.
- **The Activity section on issue detail** — entry R7: the feed, the comment composer and its `@mention` autocomplete, the Comments only / All activity toggle, the five-minute collapsing, the 50-row pages, and the `created` row §3.5 requires creation to write. This feature's mutators write no activity; R7 adds that writing to them in the same transaction as the change each describes.
- **Every notification `createIssue` or `updateIssue` causes, and the `notification` arm of `deleteIssue`'s §4 cascade** — entry R11, which lands with the notification table itself. Both mutators here set the assignee, so `OT-OPS-016` has R11 reach back into each.
- **Ordering semantics, drag and `moveIssue`** — entry R10. Creation writes its initial index at the foot of the project's order per `OT-DATA-018`, and nothing else in this feature touches ordering; `OT-DATA-017`'s fractional-index rules, the single-order-per-project consequence and the `(sort_order, id)` sort are R10's.
- **The board at `/projects/:projectKey`** — entry R10, with its columns of cards, the card face, grouping, the inline "Add a card" composer and the chevron that preselects a column on this feature's create form.
- **The project header's comment count** — entry R7. The header's colour dot, project name and Board / Details tab pair are R5's and are rendered around these screens unchanged.
- **Board column editing** — entry R9. This feature reads a project's columns and changes none of them, and enforces none of `deleteColumn`'s invariants.
- **Sub-issues, parent issues, file attachments, estimates and search of any kind** — out of scope for v1 entirely. (`OT-SCOPE-003`, `OT-SCOPE-005`)
- **Rate limiting and abuse control on these three mutators** — none is built. R1's throttle is scoped to the two authentication flows by §6, and every caller here is already authenticated and authorized against a project. If write-rate abuse becomes real it is a change to make deliberately, across every mutator at once, rather than one this feature invents for three of them.
- **Performance and responsiveness targets** — none are stated, and none are invented. The specification sets no latency, throughput or payload budget for any screen, and this feature adds none: what it fixes instead is that an in-place edit shows its result without waiting for the server (`SC-006`) and that creation waits and says so (`FR-038`), which are behavioural requirements rather than timing ones.
- **Extension points for the four later entries** — no hook registry, event dispatch or callback layer is built here. Principle I extracts a shared abstraction only once a pattern has two call sites, Principle III admits indirection only for a requirement present today, and an unused seam would be dead code under Principle VI. Those entries extend these mutators by editing them; FR-055's transaction and changed-field contract and FR-059's database cascade are what make that an extension rather than a rewrite.

### Key Entities

- **Issue** — one unit of work inside exactly one project. Carries a per-project number that is permanent and never reused, a title, a markdown description, a board column of its own project, a priority, an optional assignee, an optional due date, its creator and one ordering index. Carries no status of its own, no parent, no child and no project it can move to.
- **Issue key** — the pair of the project's key and the issue's number, rendered as `WEB-142`. Not a stored field; both halves are permanent, so the pair is a stable address and the page's copy-link target.
- **Issue counter** — the per-project source of numbers, created with the project by entry R5 and destroyed with it. This feature draws from it under a row lock and never exposes it to a read endpoint.
- **Board column** — a lane belonging to one project, read here and changed nowhere. It is the issue's status, its create-form default is the project's first, and its `canceled` kind is a member's only route to remove an issue.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can go from a project with no issues to an issue open at its own shareable address by entering a title and accepting every default, in under one minute and with no step outside the create form. The minute is measured from the create form rendering to the new issue's page rendering, for a member who has done it before, and it is a bound on the number of steps the flow demands rather than on how fast the server answers.
- **SC-002**: Two issues in one project never hold the same number, verified under concurrent creation: every creation succeeds and every number is distinct.
- **SC-003**: A number is never reused — after the highest-numbered issue in a project is deleted, the next issue created takes a higher number, 100% of the time.
- **SC-004**: An issue's key is identical at every later point in its life to the value it was created with, by every route that can reach the issue.
- **SC-005**: Creating an issue places it last in its project's order and changes the position of zero existing issues.
- **SC-006**: A member's change to any of the six editable fields is visible before the server has answered — not merely quickly, but without waiting on the response at all — and, when the server refuses it, is reverted with a message naming the reason. Neither outcome involves a page reload.
- **SC-007**: A signed-in non-member can read every issue in every project and can change zero fields on any of them. "Every route" is the four this feature exposes: the create page, the issue page, and each of the three mutators called directly — each refuses them, and each refusal is independent of whether the control that would have called it was disabled.
- **SC-008**: An assigned non-member is told on the issue itself which project they would need to be added to, 100% of the time.
- **SC-009**: An issue never changes project, by any route the product exposes.
- **SC-010**: Only an admin can destroy an issue; every project offers a member a `canceled`-kind column as the reversible alternative, on 100% of projects.
- **SC-011**: Deleting an issue leaves nothing behind that referenced it, and no reader on any connection — including one querying the database directly while the delete runs — ever observes a state in which the issue is gone and something that referenced it remains, or the reverse.
- **SC-012**: Every control on issue detail that a given user may not use is visible, disabled and carries its reason — no control on the screen is dead, and none is hidden for a permission reason.
- **SC-013**: A description renders exactly the seven supported constructs; an unsupported construct and any HTML render as their own literal text 100% of the time, and no link with an unlisted scheme is ever clickable.
- **SC-014**: An issue address that matches nothing reads "This doesn't exist" and never suggests a hidden-access state.
- **SC-015**: A due date means the same calendar day for every user on the installation, whatever their own machine reports.
- **SC-016**: No value a user types is ever silently shortened. An over-length title or description is refused on the field with a message naming the bound, on both write surfaces, and the server refuses it too when the client's check is bypassed.
- **SC-017**: An issue description and a project description holding identical source render identically, because one implementation renders both, and every description scenario entry R5 holds at the moment the extraction runs passes without being edited for it — the extraction's licence is to move the module, not to adjust the tests that prove it still behaves.
- **SC-018**: A save that names a field but changes nothing writes nothing at all, `updated_at` included, and a save that names one field leaves every other field on the issue untouched — both verifiable on this feature alone, before any later entry reaches back into these mutators.
- **SC-019**: Two members saving the same field at the same moment both succeed: neither write is refused, neither client is told it lost, and the value that commits later is the one every subsequent reader sees.
- **SC-020**: No message any client receives from this feature contains SQL, a constraint or column name, a stack trace or a configuration value — including when the refusal came from a database constraint rather than from a mutator's own check.
- **SC-021**: Neither screen ever shows a full-screen spinner, and data landing moves no element already on the page.
- **SC-022**: Every disabled control on either screen is reachable and understandable without sight and without a pointer: it carries an accessible name, its reason reaches assistive technology as that control's own explanation, and no state on either screen is distinguishable only by colour.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

Each names what is assumed, why, and what it would cost to be wrong.

- **A blur on a field the user did not change issues no call at all.** `OT-UX-009` fixes one mutator call per field but does not say whether a blur on an untouched field is one of them. The server half is no longer an assumption — FR-055 requires a call that changes nothing to write nothing — so what is assumed here is only that the client does not make the call in the first place. **If wrong**: a round trip per blur and, once R7 lands, nothing worse than that, because the server still writes nothing. This is the cheapest assumption in the list to be wrong about.
- **A due date in the past is accepted.** No rule refuses one, and overdue is a state the product reads elsewhere (§3.2). FR-006 now states the acceptance rather than assuming it; what remains assumed is that no later entry will want a validation rule here. **If wrong**: a validation rule is added to one parser, and existing past-dated issues become values the form would no longer accept — so the rule would have to be applied on write only, never on read.
- **Create issue opened for a project key that matches nothing reads "This doesn't exist"** rather than Forbidden: a missing row is a missing row (`OT-UX-004`), and there is no project against which a membership check could run. **If wrong**: nothing about the product changes except one screen's wording, because there is no reading under which a membership check could have run first.
- **The rail's due-date and assignee controls clear as well as set.** Both fields are optional on the create form (§3.5), and a field that can be created empty must be returnable to empty. **If wrong**: a field could be set once and never unset, which would make the create form's optionality a one-way door — the reason this default is drawn the way it is.
- **`created_by` is the actor who ran `createIssue` and never changes.** §5 carries the column and §3.4 shows it among the immutable values; no path in the source sets it otherwise. **If wrong**: the field becomes editable and `FR-045`'s shown-value treatment becomes a control, which is a change to §3.4 rather than to this feature.

### Reconciliations between the roadmap and the specification

- **This feature is the markdown renderer's second call site, not its first, and is where it is extracted.** Roadmap §1.1 names R6 as where `OT-DATA-015` "bites first" and leaves the subset's design to this child spec; entry R5 shipped project descriptions on two surfaces and is built before this one, and recorded itself as the first caller. Both hold: R5 implemented the subset for its own single caller, and the design §1.1 defers here is settled here. Under Principle I a pattern is extracted once it appears at two call sites, and this is the second, so FR-044 makes the extraction a requirement of this feature rather than an option left to its plan. The dependency decision is untouched — the subset stays hand-written and no library is added (`AGENTS.md` → Technology constraints).
- **Ordering is written here but designed in R10.** `OT-DATA-018` is assigned to this entry and `OT-DATA-017` to R10. `createIssue` writes the foot-of-project index and touches no existing row; every other ordering write originates from a drop, which R10 delivers along with the fractional-index scheme, the one-order-per-project consequence and the `(sort_order, id)` sort.
- **Entries R7, R8, R10 and R11 will reach back into this feature's mutators and its delete.** R7 adds activity writing to `createIssue`, `updateIssue` and the events §3.4 lists, in the same transaction as the change each describes. R8 adds the label pickers to both screens, the per-label activity, and the `issue_label` arm of `deleteIssue`'s cascade. Each of those arms also adds its own count to the delete confirmation FR-062 fixes. R10 adds `moveIssue` alongside `updateIssue` as a second writer of column, assignee and priority. R11 adds `assignment` recipient computation to `createIssue` and `updateIssue` under `OT-OPS-016`, and the `notification` arm of `deleteIssue`'s cascade. `OT-OPS-016`'s gate is stated here rather than only cited, because it is the reason FR-055 fixes the changed-field contract at all: a row is written whenever a write sets `assignee_id` to somebody other than the actor, and none is written by a write that leaves the field unchanged or one that clears it — which is answerable only where the delta already exists, inside `updateIssue`'s transaction. This is stated here because the roadmap requires every R5, R6, R7 and R10 child spec to say so (§3). The shape those additions need is not left to the plan: FR-055 fixes `updateIssue`'s transaction and its changed-field contract, FR-059 fixes how a cascade arm attaches and which entry owns each of the four, and *Out of Scope* records that no seam is built for them in advance. Every acceptance scenario and success criterion in this specification must continue to hold after each of those entries lands: they extend these mutators and must not change what this feature promised, so a reach-back that breaks one of these scenarios is a defect in the reaching entry rather than a licence to amend this one.
- **The header's New issue control is R2's slot, and this feature is what it points at.** R2 delivered the slot and deferred its destination here; R5 renders the header on project details. This feature wires the control on every project-scoped screen that exists when it lands, which is a definite set of three: project details (R5's), and this feature's own issue detail and create issue. It delivers `OT-UX-021`'s disabled-with-reason for a non-member on each. R10 brings the board's own entry points — the inline composer and its chevron — under the same rule.
- **`OT-AUTHZ-015`'s explanation has only its issue half here.** The requirement names both the issue page and the board; the board's half arrives with R10.
- **`OT-UX-008` and `OT-UX-009` are established by R5 and exercised again here.** The roadmap's cross-cutting list attributes `OT-UX-008` to R5 and names R6 as a material caller; this feature owns neither convention and reuses both unchanged.
- **`OT-DATA-004` binds this feature through the due date alone.** Home's "due this week" is R12's; what is fixed here is that the stored date is a calendar date compared in the server's own timezone.

### Inherited constraints, not decisions this specification makes

- The data-model conventions — UUIDv7 keys, `text` with `CHECK` for enumerations, explicit `updated_at` through one helper, the length bounds, and the `publicUser` projection every user reference reads — were established by entry R1 and are inherited rather than chosen here.
- The shell that hosts these screens, the Forbidden screen, the "this doesn't exist" convention, the toast conventions, the per-screen skeletons and the disabled-control-with-inline-reason convention are entry R2's; this feature renders inside them.
- The accounts the assignee pool draws from are administered by entry R3; this feature creates no account and closes none, and reads the deactivation flag it must exclude on.
- The project, its membership rows, its board columns and its issue-counter row are entry R5's; this feature creates none of them and draws numbers from the counter R5's `createProject` wrote.
- The issue-counter row lock, the composite foreign key tying an issue's column to its project, the length and enumeration checks, and the delete cascade are enforced by the database rather than by application code, so their tests run against a real PostgreSQL instance on a separate database rather than a mock.

### Obligations this feature places on entries built before it

Four contracts this feature consumes are not fully fixed by the entries that own them. Each is stated here in the form its provider's author needs, so it is settled by reading two documents rather than by a failing migration. Entry R5's specification carries a pointer to this list.

- **The issue-counter row must hold the highest number yet issued for its project**, keyed by that project, created in the same transaction as the project and destroyed with it, and reachable from no read endpoint (§5, *Read boundary*). This feature advances it and takes the result (FR-013); it never creates one and refuses if one is missing (FR-066). Only its meaning is fixed here — the column's name is R5's to choose, and this feature follows it.
- **The board-column table must carry a uniqueness guarantee over the project-and-column pair**, which its own primary key does not supply. R5 has no use for it, so **this feature adds it** rather than asking R5 to (FR-005). It is named here only so R5's author is not surprised to find another entry altering their table.
- **The markdown implementation must live inside R5's own feature until this feature moves it.** R5 is the subset's first call site and Principle I extracts at the second, so R5 must not pre-place it in the shared location to save this feature the move — the shape a shared module needs is not knowable from one caller. This feature promotes it and repoints R5's two imports (FR-044).
- **Project details must render the header's New issue slot**, which R2 built and left without a destination. This feature supplies the destination and edits that screen to pass it (FR-028); R5 cannot, because the route does not exist until this feature builds it.

**If a contract arrives in a different shape than assumed** — the counter keyed differently, the markdown module split in two — this feature follows the shape that exists rather than changing it, and the divergence is recorded as an amendment here. None of the four is load-bearing enough to justify altering an entry that has already shipped.

### Dependencies

Two kinds of dependency are distinguished, because they were not before: an entry this feature **cannot be built without**, and one whose work it consumes but whose absence would not stop it. Conflating them made R3 look load-bearing when it is not.

**Cannot be built without** — this feature has no code path that works until each has landed:

- **R1** — the actor resolved on every request, the `isAdmin` predicate, the `user` row the assignee pool reads and the `deactivated_at` column it filters on, the data-model conventions, and the two test projects. `isAdmin` must admit exactly the admin role; the actor must be resolved from the session on the server, never from anything the client sends; and a deactivated account must resolve to **no actor at all**, so a session token issued before deactivation reaches none of these mutators and none of these screens.
- **R2** — the authenticated shell these two screens render inside, the header contract with its New issue slot, the Forbidden screen, the "This doesn't exist" wording, the skeleton convention FR-067 invokes, the toast conventions FR-050 invokes, and the two guard-only routes this feature fills.
- **R5** — the project record and its key, the `isMember` predicate, the board columns, the issue-counter row, `/projects/:projectKey/details` as FR-060's destination, the project header, and the markdown implementation FR-044 extracts. `isMember` must return true for **every admin, whether or not they hold a membership row**, so that no rule this feature writes carries its own admin branch (FR-018).

**Consumed but not blocking** — R3 populates the team by inviting accounts, and the roster it renders is where deactivation is administered. But this feature reads no R3 module: the flag it filters the assignee pool on is a column on R1's `user` table, and R1 seeds the first admin. R6 is buildable and testable with R3 unbuilt, and the roadmap's transitive edge through R5 is a product dependency rather than a build one. Where an earlier statement called R3 a dependency without that distinction, this is the correction.

**Building this feature before R2 or R5** is not a supported ordering and no requirement here anticipates it. There is no reduced version of these screens that renders without the shell, and no version of `createIssue` that runs without a project and a counter.

**Dependency approval this feature triggers**: the ordering index FR-040 writes belongs to a scheme R10 owns and is generated with the library `AGENTS.md`'s approved table already lists for it, so it needs no new approval — only installation. Nothing else here may add a package: the markdown subset is hand-written by roadmap §1.1's decision (FR-009, FR-044), and any control that would require a package absent from that table must be built from one that is present, or wait for an amendment recorded before it is installed.

**Downstream reach-back**: R7 adds activity writing to this feature's mutators; R8 adds the label controls and the `issue_label` arm of its delete cascade; R10 adds ordering, drag and `moveIssue` as a second writer of three of its fields; R11 adds `assignment` notifications to `createIssue` and `updateIssue` and the `notification` arm of its delete cascade.
