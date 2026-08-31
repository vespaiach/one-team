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

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure and the issue record

No user journey observes these directly. Each is verified against the schema and the queries that read it — a column's type, bound and constraint by inspecting the migration the change generates, and a constraint by asserting that the database itself refuses the violating write.

- **FR-001**: Every issue MUST belong to exactly one project, and no path MUST exist that creates one without a project. (`OT-INV-001`, `OT-SCOPE-002`)
- **FR-002**: Issues MUST be flat. No issue MUST reference another as parent or child, and no column expressing such a reference MUST exist. A team breaking work down uses a checklist in the description or separate issues in the same project. (`OT-SCOPE-003`, `OT-INV-003`, §3.4)
- **FR-003**: An issue MUST carry a project, a number, a title, a description, a column, a priority, an assignee, a due date, a creator and an ordering index — and no status field of its own; its column carries the semantics a status enum would. (§5)
- **FR-004**: An issue's priority MUST be exactly one of `none`, `low`, `medium`, `high` or `urgent`, defaulting to `none` and rendered as **No priority**, **Low**, **Medium**, **High**, **Urgent**. No sixth value MUST exist. (§3.5, §5)
- **FR-005**: An issue's column MUST be required and MUST always be a board column of the issue's own project, enforced by a composite foreign key on the project and column pair rather than by a mutator's own check alone. (`OT-INV-004`)
- **FR-006**: An issue's assignee and due date MUST each be optional and independently clearable. The due date MUST be a calendar date compared in the server's own timezone, so a date means the same day for every user on the installation. (`OT-DATA-004`, §3.5, §5)
- **FR-007**: An issue MUST NOT change project. `updateIssue` MUST offer no path that sets the project, and the project MUST render as a shown value rather than a control. (`OT-INV-002`, `OT-UX-010`)
- **FR-008**: The issue table MUST follow the data-model conventions entry R1 established — a server-generated UUIDv7 primary key, `text` with a `CHECK` for the priority enumeration, a date type for the due date and a timezone-aware type for instants, and a `CHECK` bounding the title at 200 characters and the description at 10 000. Every mutator MUST write `updated_at` explicitly through the shared helper. (`OT-DATA-001`, `OT-DATA-002`, `OT-DATA-003`)
- **FR-009**: An issue description MUST be stored as markdown source and MUST support only bold, italic, inline code, links, bullet and numbered lists, and headings. Tables, images and embeds MUST NOT be supported, and HTML MUST be escaped rather than rendered. This MUST be the same subset a project description takes — `OT-DATA-015` fixes one subset for both — so one implementation serves both and any divergence between them requires a specification amendment. (`OT-DATA-015`)
- **FR-010**: A link in a rendered description MUST carry an `http`, `https` or `mailto` scheme; a link with any other scheme MUST render as text. (`OT-DATA-015`, `AGENTS.md` → Architecture notes)
- **FR-011**: An issue's creator MUST be the actor who created it and MUST NOT be changed by any mutator; it MUST render as a shown value alongside the timestamps. (§3.4, §5, `OT-UX-010`)

#### The key and per-project numbering

- **FR-012**: An issue MUST be addressed as its project's key plus its own per-project number — `WEB-142`. Both parts MUST be permanent, and both MUST render read-only on the issue page. (§3.4, §5 *Keys*, `OT-UX-010`)
- **FR-013**: The number MUST be drawn from that project's issue-counter row under a row lock, inside the creating transaction, and MUST NOT touch the project row. (`OT-DATA-012`, `OT-INV-009`)
- **FR-014**: Issue numbers MUST be monotonic per project and MUST never be reused. Deleting an issue MUST NOT return its number to the counter. (`OT-INV-009`, `OT-DATA-012`)
- **FR-015**: The number MUST be assigned server-side and MUST be final the first time the client sees it. Creation MUST NOT be optimistic and MUST NOT display a provisional key. (§3.5, §5 *Keys*, `OT-UX-008`)
- **FR-016**: Two creations racing in one project MUST each receive a distinct number, and neither MUST be refused for the race. (`OT-DATA-012`, `OT-INV-009`)
- **FR-017**: An issue MUST be resolved from the pair of project key and issue number. A number that exists only in another project MUST NOT resolve under this project's key. (§3.4, §5 *Keys*)

#### Authorization and the write boundary

- **FR-018**: `createIssue` and `updateIssue` MUST each require `isMember` of the issue's own project; `deleteIssue` MUST require `isAdmin`. (§2)
- **FR-019**: Every mutator this feature delivers MUST enforce its predicate on the server and MUST derive the project it checks from the stored row rather than from a client-supplied project identifier. The client MAY run the same predicates to disable controls; the server check MUST be the enforcement. (`OT-AUTHZ-004`, `OT-AUTHZ-005`)
- **FR-020**: A member MUST be able to edit **any** issue in their project, not only their own. No authorship check MUST exist on an issue. (§2)
- **FR-021**: Every signed-in user MUST be able to read every issue in every project. Membership MUST NOT be used as a visibility boundary anywhere in this feature. (`OT-AUTHZ-002`)
- **FR-022**: The assignee pool — on Create issue and on the rail alike — MUST be that project's membership rows **plus** every admin, with deactivated users excluded. (`OT-AUTHZ-007`)
- **FR-023**: An assigned non-member MUST be a supported state: they MUST see their issue, MUST be able to change nothing on it, and the page MUST explain why and name the project they would need to be added to. (`OT-AUTHZ-015`)
- **FR-024**: An assignee later removed from the project or deactivated MUST keep the assignment, and their display name MUST keep rendering wherever it already did. (`OT-AUTHZ-014`)
- **FR-025**: Losing write access mid-session MUST remove no rows; the affected controls MUST become disabled on the next render. (`OT-AUTHZ-012`)
- **FR-026**: Every action a user cannot take on these screens MUST render as a disabled control carrying an inline reason. A dead button MUST NOT be used and a tooltip alone MUST NOT be the explanation. (`OT-UX-002`)

#### Create issue

- **FR-027**: Create issue MUST be a full page at `/projects/:projectKey/issues/new`, not a modal. (§3.5, `OT-SCOPE-007`)
- **FR-028**: The header's **New issue** control MUST point at this page on every project-scoped screen that exists when this feature lands, and for a non-member it MUST render disabled with an inline reason naming the project — visible, never hidden. (`OT-UX-021`, §3, *The shell*)
- **FR-029**: A signed-in non-member who reaches `/projects/:projectKey/issues/new` by any route MUST get the Forbidden screen; an unauthenticated caller MUST be redirected to `/signin` and MUST NOT reach Forbidden. The disabled control and the Forbidden screen MUST be independent — neither MUST imply the other was skipped. (§3.5, §3.11, `OT-SEC-015`, `OT-UX-021`)
- **FR-030**: Title MUST be required and trimmed, MUST be the form's first and focused field, and MUST be the form's only required field. (§3.5)
- **FR-031**: Description MUST be optional and multi-line, MUST grow with its content, and MUST take the markdown subset FR-009 fixes. (§3.5)
- **FR-032**: Column MUST offer the project's own board columns and MUST default to the project's first column by board position. (§3.5, §3.8)
- **FR-033**: Priority MUST default to **No priority**. (§3.5)
- **FR-034**: Assignee MUST be optional, MUST draw from FR-022's pool, and MUST default to unassigned. (§3.5)
- **FR-035**: Due date MUST be optional. (§3.5)
- **FR-036**: The project MUST be fixed by the route and MUST NOT appear as a field on the form. (§3.5)
- **FR-037**: Validation MUST be per field and on blur. The Create control MUST stay enabled and report what is missing inline rather than going dead. A value exceeding FR-008's length bound MUST be reported the same way, as an inline error on the field naming the bound; it MUST NOT be truncated, capped at the keyboard or silently accepted, and the server MUST reject it independently of whatever the client checked. (`OT-UX-011`)
- **FR-038**: Creation MUST NOT be optimistic: the form MUST wait for the server and MUST show in-flight state on the Create control. (`OT-UX-008`, §3.5)
- **FR-039**: Create MUST run exactly one `createIssue` call, and that call MUST write the issue and draw its number in one transaction. On success it MUST navigate to the new issue's detail page; Cancel MUST return to where the user came from and MUST write nothing. (§3.5)
- **FR-040**: `createIssue` MUST write an ordering index after every existing issue in the same project, so a new issue sorts last under every grouping, and MUST touch no existing row. This MUST be the only ordering write in this feature. (`OT-DATA-018`)

#### Issue detail — reading

- **FR-041**: Issue detail MUST be a full page at `/projects/:projectKey/issues/:issueNumber/details`, deep-linkable and readable by any signed-in user, rendered inside the shell rather than as a peek panel. (§3.4, `OT-SCOPE-007`, `OT-AUTHZ-002`, `OT-UX-001`)
- **FR-042**: The page MUST be a main column plus a 262px meta rail. The key MUST be the page's first element and the copy-link target. (§3.4)
- **FR-043**: The main column MUST carry the key, the title and the description, in that order. (§3.4)
- **FR-044**: A description MUST render its markdown on read and MUST show its raw source while it is being edited. This feature is the subset's second call site, so the implementation entry R5 wrote for project descriptions MUST be extracted into a single shared renderer serving both, promoted out of R5's feature directory, adding no dependency. The extraction MUST NOT change what R5's surfaces render: R5's own description acceptance scenarios MUST pass unchanged and stand as its regression test, and a genuine divergence from `OT-DATA-015` in that implementation MUST be fixed as an R5 defect rather than absorbed here. Neither this page's editor nor the create form MUST offer a markdown preview or a formatting toolbar. (§3.4, §3.5, `OT-DATA-015`, Principle I)
- **FR-045**: The rail MUST show the issue's project, its creator and its timestamps as shown values rather than controls, following the same convention every immutable field in the app uses. (§3.4, `OT-UX-010`, `OT-INV-002`)
- **FR-046**: A project key matching no project, or an issue number matching no issue in that project, MUST read "This doesn't exist" and MUST NOT imply a hidden-access state. (`OT-UX-004`)
- **FR-047**: The page MUST render identically for every user in structure, and MUST differ only in which of its controls are enabled. (§3.4, §3.8, `OT-UX-002`)

#### Issue detail — in-place editing and the rail

- **FR-048**: Title and description MUST be edited in place: clicking the value MUST turn it into a field, Escape MUST revert, and a blur or ⌘-enter MUST save, with exactly one `updateIssue` call per field. No edit mode and no separate form MUST exist. (`OT-UX-009`, §3.4)
- **FR-049**: The title MUST be a single line, required and trimmed; the description MUST be a multi-line area that grows with its content. A value exceeding FR-008's length bound MUST keep the field open carrying an inline error naming the bound and MUST issue no save, so the two write surfaces refuse an over-length value the same way. (§3.4)
- **FR-050**: An in-place edit MUST apply optimistically and MUST roll back with a message naming what failed and why when the server refuses it. (`OT-UX-008`)
- **FR-051**: The rail MUST offer column, priority, assignee and due date as quick-change controls for members, each one `updateIssue` call applied optimistically, and MUST render each as a disabled control with an inline reason for a non-member. (§3.4, `OT-UX-008`, `OT-UX-002`)
- **FR-052**: The rail's column control MUST offer only board columns of the issue's own project. (`OT-INV-004`, §3.4)
- **FR-053**: Every column transition MUST be legal in both directions, with no terminal state, no guardrail and no confirmation on the transition itself. (`OT-OPS-011`, §4)
- **FR-054**: For a non-member the title and description MUST NOT be clickable and MUST carry the same disabled reason as the rail. (§3.4)
- **FR-055**: `updateIssue` MUST accept no path that changes the project, the number, the creator or the ordering index. (`OT-INV-002`, `OT-INV-009`, `OT-DATA-018`)

#### Delete

- **FR-056**: `deleteIssue` MUST require `isAdmin`, and MUST refuse a non-admin caller independently of whether the disabled control was bypassed. A member's route to remove an issue MUST be moving it into a `canceled`-kind column, which is reversible and keeps history. (§2, §4)
- **FR-057**: The delete MUST be hard and MUST cascade in the database. There MUST be no soft-delete marker on an issue; moving to a `canceled`-kind column MUST be the reversible path. (`OT-DATA-007`)
- **FR-058**: The delete MUST run in one server transaction and its response MUST carry the settled state, so no caller can observe a moment where the issue is gone and something it owned is not. (`OT-DATA-008`)
- **FR-059**: The cascade MUST reach every row that references the issue. In this feature nothing else references one, so the cascade removes the issue alone; each later entry MUST attach its own tables to the same cascade as they land. (§4)
- **FR-060**: A successful delete MUST navigate away from the deleted issue to that project's details page, `/projects/:projectKey/details`. The destination MUST be a route that exists when this feature lands, so the delete leaves no user on a page that has ceased to exist. (§4, §3.8)
- **FR-061**: The Delete control MUST sit in the issue rail, beneath the column, priority, assignee and due-date controls. For an admin it MUST be enabled; for every other user it MUST render visible and disabled carrying an inline reason, never hidden. It MUST confirm once before writing, and no path MUST exist that destroys an issue without that confirmation. (§2, §3.8, §3.10, `OT-UX-002`)
- **FR-062**: The confirmation MUST name the issue by its key and title and MUST state the size of what the cascade will destroy alongside it, following the convention a project delete (§3.8) and a label delete (§3.10) already use. Where the cascade reaches nothing, it MUST confirm the same way without a count. Each later entry that attaches rows to the cascade MUST add its own count to this confirmation. (§3.8, §3.10, §4)

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

### Key Entities

- **Issue** — one unit of work inside exactly one project. Carries a per-project number that is permanent and never reused, a title, a markdown description, a board column of its own project, a priority, an optional assignee, an optional due date, its creator and one ordering index. Carries no status of its own, no parent, no child and no project it can move to.
- **Issue key** — the pair of the project's key and the issue's number, rendered as `WEB-142`. Not a stored field; both halves are permanent, so the pair is a stable address and the page's copy-link target.
- **Issue counter** — the per-project source of numbers, created with the project by entry R5 and destroyed with it. This feature draws from it under a row lock and never exposes it to a read endpoint.
- **Board column** — a lane belonging to one project, read here and changed nowhere. It is the issue's status, its create-form default is the project's first, and its `canceled` kind is a member's only route to remove an issue.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can go from a project with no issues to an issue open at its own shareable address by entering a title and accepting every default, in under one minute and with no step outside the create form.
- **SC-002**: Two issues in one project never hold the same number, verified under concurrent creation: every creation succeeds and every number is distinct.
- **SC-003**: A number is never reused — after the highest-numbered issue in a project is deleted, the next issue created takes a higher number, 100% of the time.
- **SC-004**: An issue's key is identical at every later point in its life to the value it was created with, by every route that can reach the issue.
- **SC-005**: Creating an issue places it last in its project's order and changes the position of zero existing issues.
- **SC-006**: A member's change to any of the six editable fields is visible within one interaction and, when the server refuses it, is reverted with a message naming the reason — with no page reload in either case.
- **SC-007**: A signed-in non-member can read every issue in every project and can change zero fields on any of them, through every route including one that bypasses a disabled control.
- **SC-008**: An assigned non-member is told on the issue itself which project they would need to be added to, 100% of the time.
- **SC-009**: An issue never changes project, by any route the product exposes.
- **SC-010**: Only an admin can destroy an issue; every project offers a member a `canceled`-kind column as the reversible alternative, on 100% of projects.
- **SC-011**: Deleting an issue leaves nothing behind that referenced it, and no caller ever observes a partially deleted issue.
- **SC-012**: Every control on issue detail that a given user may not use is visible, disabled and carries its reason — no control on the screen is dead, and none is hidden for a permission reason.
- **SC-013**: A description renders exactly the seven supported constructs; an unsupported construct and any HTML render as their own literal text 100% of the time, and no link with an unlisted scheme is ever clickable.
- **SC-014**: An issue address that matches nothing reads "This doesn't exist" and never suggests a hidden-access state.
- **SC-015**: A due date means the same calendar day for every user on the installation, whatever their own machine reports.
- **SC-016**: No value a user types is ever silently shortened. An over-length title or description is refused on the field with a message naming the bound, on both write surfaces, and the server refuses it too when the client's check is bypassed.
- **SC-017**: An issue description and a project description holding identical source render identically, because one implementation renders both, and every description scenario entry R5 wrote passes unchanged after the extraction.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **A save whose value is unchanged writes nothing.** `OT-UX-009` fixes one mutator call per field but does not say whether a blur on an untouched field is one of them. Writing an identical value would touch `updated_at` and, once R7 lands, write an activity row describing no change.
- **Concurrent edits to one issue resolve last-write-wins.** Locking and live push are out of scope (§1, `OT-SCOPE-005`), and §3.3 already fixes last-write-wins for the board's own write; nothing in the source suggests a different rule for the rail or for in-place editing.
- **A due date in the past is accepted.** No rule refuses one, and overdue is a state the product reads elsewhere (§3.2).
- **Create issue opened for a project key that matches nothing reads "This doesn't exist"** rather than Forbidden: a missing row is a missing row (`OT-UX-004`), and there is no project against which a membership check could run.
- **The rail's due-date and assignee controls clear as well as set.** Both fields are optional on the create form (§3.5), and a field that can be created empty must be returnable to empty.
- **`created_by` is the actor who ran `createIssue` and never changes.** §5 carries the column and §3.4 shows it among the immutable values; no path in the source sets it otherwise.

### Reconciliations between the roadmap and the specification

- **This feature is the markdown renderer's second call site, not its first, and is where it is extracted.** Roadmap §1.1 names R6 as where `OT-DATA-015` "bites first" and leaves the subset's design to this child spec; entry R5 shipped project descriptions on two surfaces and is built before this one, and recorded itself as the first caller. Both hold: R5 implemented the subset for its own single caller, and the design §1.1 defers here is settled here. Under Principle I a pattern is extracted once it appears at two call sites, and this is the second, so FR-044 makes the extraction a requirement of this feature rather than an option left to its plan. The dependency decision is untouched — the subset stays hand-written and no library is added (`AGENTS.md` → Technology constraints).
- **Ordering is written here but designed in R10.** `OT-DATA-018` is assigned to this entry and `OT-DATA-017` to R10. `createIssue` writes the foot-of-project index and touches no existing row; every other ordering write originates from a drop, which R10 delivers along with the fractional-index scheme, the one-order-per-project consequence and the `(sort_order, id)` sort.
- **Entries R7, R8, R10 and R11 will reach back into this feature's mutators and its delete.** R7 adds activity writing to `createIssue`, `updateIssue` and the events §3.4 lists, in the same transaction as the change each describes. R8 adds the label pickers to both screens, the per-label activity, and the `issue_label` arm of `deleteIssue`'s cascade. Each of those arms also adds its own count to the delete confirmation FR-062 fixes. R10 adds `moveIssue` alongside `updateIssue` as a second writer of column, assignee and priority. R11 adds `assignment` recipient computation to `createIssue` and `updateIssue` under `OT-OPS-016`, and the `notification` arm of `deleteIssue`'s cascade. This is stated here because the roadmap requires every R5, R6, R7 and R10 child spec to say so (§3).
- **The header's New issue control is R2's slot, and this feature is what it points at.** R2 delivered the slot and deferred its destination here; R5 renders the header on project details. This feature wires the control on every project-scoped screen that exists when it lands and delivers `OT-UX-021`'s disabled-with-reason for a non-member. R10 brings the board's own entry points — the inline composer and its chevron — under the same rule.
- **`OT-AUTHZ-015`'s explanation has only its issue half here.** The requirement names both the issue page and the board; the board's half arrives with R10.
- **`OT-UX-008` and `OT-UX-009` are established by R5 and exercised again here.** The roadmap's cross-cutting list attributes `OT-UX-008` to R5 and names R6 as a material caller; this feature owns neither convention and reuses both unchanged.
- **`OT-DATA-004` binds this feature through the due date alone.** Home's "due this week" is R12's; what is fixed here is that the stored date is a calendar date compared in the server's own timezone.

### Inherited constraints, not decisions this specification makes

- The data-model conventions — UUIDv7 keys, `text` with `CHECK` for enumerations, explicit `updated_at` through one helper, the length bounds, and the `publicUser` projection every user reference reads — were established by entry R1 and are inherited rather than chosen here.
- The shell that hosts these screens, the Forbidden screen, the "this doesn't exist" convention, the toast conventions, the per-screen skeletons and the disabled-control-with-inline-reason convention are entry R2's; this feature renders inside them.
- The accounts the assignee pool draws from are administered by entry R3; this feature creates no account and closes none, and reads the deactivation flag it must exclude on.
- The project, its membership rows, its board columns and its issue-counter row are entry R5's; this feature creates none of them and draws numbers from the counter R5's `createProject` wrote.
- The issue-counter row lock, the composite foreign key tying an issue's column to its project, the length and enumeration checks, and the delete cascade are enforced by the database rather than by application code, so their tests run against a real PostgreSQL instance on a separate database rather than a mock.

### Dependencies

- **Roadmap position**: R6 depends on R5 (the project, its membership, its columns and its issue counter), and transitively on R1, R2 and R3. Entries R7 through R12 all consume it.
- **Consumed from earlier entries**: the actor resolved on every request and the `isAdmin` predicate (R1); the shell, the header contract with its New issue slot, the Forbidden screen and the cross-cutting UX conventions (R2); the accounts and the deactivation state the assignee pool filters on (R3); the project record, the `isMember` predicate and the write boundary it draws, the board columns, the issue-counter row, the project header with its Board / Details tabs, and the markdown implementation R5 wrote for its own descriptions, which FR-044 extracts here (R5).
- **Downstream reach-back**: R7 adds activity writing to this feature's mutators; R8 adds the label controls and the `issue_label` arm of its delete cascade; R10 adds ordering, drag and `moveIssue` as a second writer of three of its fields; R11 adds `assignment` notifications to `createIssue` and `updateIssue` and the `notification` arm of its delete cascade.
