# Feature Specification: Projects — creation, record, membership and lifecycle

**Feature Branch**: `claude/roadmap-entry-r5-spec-56287d`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R5**

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "create feature specification for Roadmap Entry R5. Refer to docs/ROADMAP.md -> Entry R5, docs/product/requirements-index.md and docs/product/specifications.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R5** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## Clarifications

### Session 2026-08-30

- Q: When is a project's issue-counter row created, and what does it hold at creation? → A: Eagerly, in `createProject`'s transaction; the row holds the last issued number and is seeded at `0`, so the first issue drawn from it is number 1.
- Q: Should the database guarantee one issue-counter row per project, and how is that row keyed? → A: Yes — a UUIDv7 primary key with a unique constraint on the project reference, cascading on project delete, following the one-row-per-parent shape entry R1 established for `credential`.
- Q: Should the issue-counter table carry `created_at` and `updated_at`? → A: Neither. It is a machine row with no readable lifecycle, so the increment path stays a bare `UPDATE` and writes no timestamp.
- Q: Which entry owns the markdown renderer, given that the roadmap's §1.1 prose names R6 while its requirement table assigns `OT-DATA-015` to both R5 and R6? → A: R5. It is built first and ships the only rendering surface across the two entries, so it designs and implements the subset; roadmap §1.1 is corrected to say so, and R6 becomes the second caller that settles the shared shape.
- Q: May an admin remove a project's last remaining roster member? → A: Yes, with no guardrail and no confirmation. Every admin may write in the project whatever the roster holds, so an empty roster locks nobody out and no invariant protects the final row.
- Q: `OT-AUTHZ-013` requires a member removal to both revoke write access and be recorded in the project's activity, but activity does not exist until R7 — how is the requirement split? → A: R5 delivers the revocation half in full; the activity record is R7's, whose roadmap scope already names `member_removed` among the activity writing it adds to R5's mutators. No roadmap change is needed.
- Q: Should the delete confirmation enumerate a fixed set of entities, or count whatever the cascade reaches when it is shown? → A: Count what the cascade actually reaches at that moment — board columns and membership rows in this feature. Each later entry that attaches a table to the cascade extends the count rather than the sentence being rewritten.

### Session 2026-08-31

Resolved from the requirements-quality review in [`checklists/`](checklists/). Every question below was
open in this document; each answer is now carried by the requirement named beside it.

- Q: FR-012 requires a UUIDv7 primary key on every table this feature introduces, while FR-005 and §5 make a membership the pair of project and user — which governs? → A: §5 governs. `project_member` takes the composite key and is the only table that does; FR-012 now names the exception rather than being contradicted by FR-005.
- Q: FR-014 requires every mutator to derive its project from the stored row, but `createProject` has no stored row — how does the rule apply? → A: It does not. The rule is §2's, and §2 scopes it to `isMember` checks; `createProject` requires `isAdmin`, which is not project-scoped. FR-014 now says so, and additionally fixes the predicate inside the write's own transaction so a concurrent revocation cannot land between check and write.
- Q: Who may call the as-typed key-uniqueness check, which is a server entry point that names an existing project? → A: `isAdmin`, matching the screen that calls it. It carries no throttle of its own: it discloses to an admin only what the admin-only Create screen already shows.
- Q: FR-036 sends one field per call, so two concurrent updates can each read a legal row and together write an illegal pair of dates. Where is the date rule enforced? → A: In the database, as a table constraint. The mutator keeps its own check solely to name the offending field in the inline error; the constraint is the enforcement. A target equal to the start is legal.
- Q: What resolves two members editing the same field at once? → A: Last write wins. No version column exists on a project and no write is refused for having been preceded by another.
- Q: FR-036 says clicking the value opens the field — how does a keyboard user reach it? → A: The value is a control, not static text, so it carries an accessible name, a visible focus indicator and keyboard activation; focus returns to it when the field closes. Ctrl-enter saves where there is no ⌘ key. §7 delegates the rest to React Aria Components.
- Q: FR-021 requires a disabled control with a reason for every action a user cannot take, but the sidebar's `+` leads to an admin-only screen — disabled or hidden? → A: Hidden. §2 makes navigation the one exception to the disabled-with-reason rule, and FR-021 and FR-022 now carry it.
- Q: The sidebar orders projects by name and two projects may share a name, yet SC-013 requires every user to see the same order — what breaks the tie? → A: The project's key, which is unique and immutable, so the order is total. The name comparison is case-insensitive.
- Q: FR-052 says a successful delete navigates away — to where? And where does Cancel return to on a create form reached by direct URL? → A: Home in both cases, being the one destination that always resolves.
- Q: Does the create form render a description preview? → A: No. The field holds source; the rendered form is what project details shows on read.
- Q: Is a submitted key coerced to fit the pattern, or rejected? → A: Rejected. The field's uppercasing is a typing affordance; Principle II forbids the server silently coercing an input into conformance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An admin creates the container work lives in (Priority: P1)

An admin opens Create project from the sidebar, types a name, watches a key derive itself from that name, optionally sets a description, dates, a colour and a starting roster, and presses Create. One project comes into being, already carrying the five board columns a team expects and everything else a later slice needs to hang work on.

**Why this priority**: A project is the container every later entry writes into — issues, columns, comments, activity, labels applied to issues, notifications. Nothing in R6 through R12 has anywhere to live until a project exists, and no other route creates one.

**Independent Test**: Sign in as an admin against a database holding accounts but no projects, open `/projects/new`, submit a name alone, and confirm one project exists with a derived key, the accent colour, `active` status, five columns in their fixed order and kinds, and its own issue counter. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** an admin on Create project, **When** they type "Website Redesign" into Name and touch nothing else, **Then** the key field shows `WR` and Create is submittable.
2. **Given** an admin on Create project, **When** they type "One Team Design Ops", **Then** the key field shows `OTDO`.
3. **Given** an admin who has typed a name and then edited the key by hand, **When** they change the name again, **Then** the key keeps the value they typed and stops following the name.
4. **Given** a name whose derived value does not match the key pattern — "3D Redesign" derives `3R` — **When** the name is entered, **Then** the key field is left empty and reports that a key is required.
5. **Given** a key already held by another project, **When** it is typed, **Then** an inline error on the key field names the project holding it, and no suffix is applied.
6. **Given** a valid form, **When** Create is pressed, **Then** the button shows in-flight state, the screen waits for the server rather than navigating optimistically, and on success the browser lands on the new project's board route.
7. **Given** a valid form, **When** the create succeeds, **Then** exactly five board columns exist for the project — Backlog, Todo, In Progress, Done, Canceled, in that order, with kinds `open`, `open`, `open`, `done`, `canceled` and colours grey, blue, amber, green, red.
8. **Given** a valid form, **When** the create succeeds, **Then** the project's status is `active` and its colour is the accent unless another palette swatch was chosen.
9. **Given** an admin who added three member chips, **When** the create succeeds, **Then** three membership rows exist, written in the same transaction as the project itself, and none of them is the creating admin.
10. **Given** an admin on Create project, **When** they open the member picker, **Then** deactivated accounts are absent from it, the creating admin is absent from it, and no route to invite a new person appears on it.
11. **Given** a target date earlier than the start date, **When** the target field is left, **Then** an inline error renders on the target field and nothing is submitted.
12. **Given** a form missing its name, **When** Create is pressed, **Then** the control stays enabled and reports the missing name inline rather than going dead.
13. **Given** a signed-in non-admin, **When** they reach `/projects/new` by any route, **Then** the Forbidden screen renders inside the shell and no project is created.
14. **Given** an unauthenticated caller, **When** they reach `/projects/new`, **Then** they are redirected to `/signin` and never see the Forbidden screen.
15. **Given** an admin on Create project, **When** they press Cancel, **Then** they return to where they came from and nothing is written.

---

### User Story 2 - Anyone reads a project's record, and its members change it (Priority: P2)

Any signed-in person can open a project's details and read everything about it. A member of that project clicks a value — the name, the description, a date, the colour — and it becomes a field they can change on the spot. A non-member sees the same page with the same controls, disabled, each carrying the reason. The key is shown as a value and can never be edited by anyone.

**Why this priority**: The record screen is where a project is maintained for the rest of its life, and it is the first surface in the product to establish the in-place editing convention and the optimistic-write convention that R6, R7 and R10 all reuse. It also draws the write boundary visibly, which is half of this entry's intent.

**Independent Test**: With one project and two accounts — one a member, one not — open `/projects/:projectKey/details` as each. Confirm both read the whole record; confirm the member's edits save, revert on Escape and roll back with a message when the server refuses; confirm the non-member's controls are disabled with a reason and that the server refuses their write independently of the disabled control.

**Acceptance Scenarios**:

1. **Given** any signed-in user, **When** they open a project's details, **Then** the whole record renders — key, name, description, status, dates, colour, columns and members — with no membership check on the read.
2. **Given** a project member on the details screen, **When** they click the name, **Then** it becomes an editable field in place, with no edit mode and no separate form.
3. **Given** a field open for editing, **When** Escape is pressed, **Then** the previous value returns and nothing is written.
4. **Given** a field open for editing with a changed value, **When** it is blurred or ⌘-enter is pressed, **Then** exactly one `updateProject` call is made for that field.
5. **Given** a member editing a field, **When** the save is made, **Then** the new value appears immediately and, if the server refuses it, the value reverts and a message names what failed and why.
6. **Given** any user on the details screen, **When** they look at the project key, **Then** it renders as a shown value rather than a control, and no route exists that changes it.
7. **Given** a project whose start date is set, **When** a member sets a target date earlier than it, **Then** the write is refused by the server as well as by the field, and the previous value stands.
8. **Given** a non-member on the details screen, **When** they look at any record field, **Then** it is visible, not clickable, and carries an inline reason naming the project they would need to be added to.
9. **Given** a member whose membership is removed while their screen is open, **When** the screen next renders, **Then** the record controls become disabled and nothing they previously wrote is removed.
10. **Given** a description holding markdown, **When** the details screen renders it, **Then** bold, italic, inline code, links, bullet and numbered lists and headings render, and nothing else does.
11. **Given** a description holding HTML, **When** it renders, **Then** the HTML is shown as text and is not interpreted.
12. **Given** a description open for editing, **When** it is in the field, **Then** the raw markdown source is shown rather than the rendered form.
13. **Given** a project key that matches no project, **When** the details route is opened, **Then** the screen reads that it does not exist and never implies a hidden-access state.

---

### User Story 3 - An admin decides who may write in a project (Priority: P3)

An admin opens the project's Members roster, adds someone who already has an account, and that person can write in the project on their next request — no invitation, no acceptance, nothing pending. Removing them takes their write access to that project away and nothing else: what they wrote and what they were given stays exactly where it was.

**Why this priority**: Membership is the product's only write boundary, and every mutator from R6 onward reads it. It ranks below the record screen only because a project is already writable by admins the moment it exists, so this story extends the boundary rather than creating one.

**Independent Test**: With one project and one non-admin account holding no membership, confirm the account cannot write to the project. Add them from the roster and confirm they can write on their next request with no sign-out. Remove them and confirm the write is refused again while every row they authored survives.

**Acceptance Scenarios**:

1. **Given** an admin on the Members section, **When** they open Add member, **Then** the picker lists accounts that exist, excludes deactivated accounts, and excludes people already on the roster.
2. **Given** a person with no account, **When** an admin looks for them in the picker, **Then** they are absent and the screen offers no way to invite from here.
3. **Given** an admin who adds a member, **When** that member makes their next request, **Then** they have write access to the project, with no acceptance step and no re-authentication.
4. **Given** an admin who removes a member, **When** that person makes their next request, **Then** their writes to that project are refused while every comment, assignment and activity row of theirs survives.
5. **Given** an admin who was never added explicitly, **When** the roster renders, **Then** they are absent from it, even though they may write in the project.
6. **Given** an admin who was added explicitly and later removed, **When** they write to the project, **Then** the write succeeds, because the predicate admits every admin whatever the roster says.
7. **Given** a project member on the details screen, **When** they look at the Members section, **Then** the roster is readable and its add and remove controls are disabled with an inline reason.
8. **Given** a member of the project who is deactivated, **When** the roster renders, **Then** their row is still present, because deactivation removes no membership.
9. **Given** a project whose last roster row is removed, **When** the removal completes, **Then** it succeeds and the project stays writable by every admin.
10. **Given** an admin adding a member, **When** the server refuses the write, **Then** the roster returns to its previous state and a message names what failed and why.

---

### User Story 4 - An admin retires a project (Priority: P4)

Work on a project finishes. An admin flips its status to archived, which changes nothing else about it — the issues, columns and memberships are all exactly as they were, and the switch flips back just as easily. Once archived, and only then, Delete is offered, and it says how much it will destroy before it does.

**Why this priority**: Archiving is the only lifecycle act a project has and it is what unlocks deletion, but a team can run for a long time without retiring anything. It ranks last of the four writing stories because nothing downstream depends on it.

**Independent Test**: With one project, flip its status both ways and confirm no other row changed. Confirm Delete is refused and disabled while the project is active, offered once archived, states the size of what it will remove, and leaves nothing behind when confirmed.

**Acceptance Scenarios**:

1. **Given** an admin on the details screen, **When** they flip Status to archived, **Then** the change applies immediately and rolls back with a message if the server refuses it.
2. **Given** an archived project, **When** an admin flips Status back to active, **Then** it succeeds — the transition is legal in both directions and asks for no confirmation.
3. **Given** a project with columns and members, **When** it is archived, **Then** no column, membership or issue is touched.
4. **Given** a project member who is not an admin, **When** they look at the Status switch, **Then** it shows the current state, is disabled, and carries its reason.
5. **Given** an active project, **When** an admin looks at Delete, **Then** it is disabled with a reason stating the project must be archived first, and the route refuses the call independently.
6. **Given** an archived project, **When** an admin presses Delete, **Then** a confirmation states the size of what will be destroyed before anything is written.
7. **Given** the confirmation is accepted, **When** the delete runs, **Then** the project, its board columns, its membership rows and its issue counter row all disappear together in one transaction, and no caller can observe a state where some are gone and others are not.
8. **Given** a delete that succeeds, **When** the response lands, **Then** it carries the settled state and the browser navigates away from the deleted project.
9. **Given** an admin who archives a project and another who deletes it concurrently, **When** both requests are served, **Then** the delete observes the archived status inside its own transaction rather than from an earlier read.
10. **Given** a deleted project, **When** its key is used for a new project, **Then** the key is available, because the delete is hard and leaves no reserved row behind.

---

### User Story 5 - Projects are findable and every project screen knows where it is (Priority: P5)

The sidebar lists every project the same way for everyone — alphabetically by name, active ones first and archived ones after them, dimmed. Every project-scoped screen carries the project's colour dot, its name, and the pair of tabs that move between its board and its details.

**Why this priority**: Without it the two screens above are reachable only by typing a URL. It ranks last because it adds no capability of its own — it is the way in to capabilities the four stories above already deliver.

**Independent Test**: With several projects of both statuses and mixed-case names, confirm the sidebar's order is identical for an admin, a member and a non-member, and that archived projects render after active ones and dimmed. Open project details and confirm the header carries the colour dot, the name and both tabs.

**Acceptance Scenarios**:

1. **Given** projects named "Zephyr", "atlas" and "Beacon", all active, **When** the sidebar renders, **Then** they appear in alphabetical order by name regardless of case.
2. **Given** an active project and an archived one, **When** the sidebar renders, **Then** every active project appears before every archived one, and archived entries are dimmed.
3. **Given** any two signed-in users, **When** each views the sidebar, **Then** both see the same projects in the same order — the list is not personalised and carries no user-controlled ordering.
4. **Given** a project renamed to sort differently, **When** the sidebar next renders, **Then** its position follows the new name with no other action.
5. **Given** a non-admin, **When** the sidebar renders, **Then** every project is listed, because membership is a write boundary and not a visibility one.
6. **Given** a signed-in user on project details, **When** the header renders, **Then** it carries the project's colour dot, its name, and the Board and Details tabs, with Details marked current.
7. **Given** a user on project details, **When** they press the Board tab, **Then** they are taken to the project's board route.
8. **Given** an installation with no projects, **When** the sidebar renders, **Then** the project region shows one quiet line rather than an illustration.

---

### Edge Cases

- **A name that derives no key at all** — punctuation or digits only — leaves the key field empty and required, exactly as a derived value that fails the pattern does.
- **A name with more than eight words** derives a key truncated to eight characters; the truncation is silent because the field is still editable before submit.
- **A key that passes the as-typed uniqueness check and is taken before submit** is caught again on submit, and the inline error names the project that now holds it. The check is an affordance; the database constraint is the enforcement.
- **Two admins creating the same key concurrently**: exactly one succeeds and the other is told which project holds the key. Neither is given a suffixed key.
- **Case in a key** cannot collide, since the field is uppercased as typed and the pattern admits uppercase letters and digits only.
- **Two projects with the same name** are legal — only the key is unique — and the sidebar lists both.
- **Clearing a start date while a target date stands** is legal: the dates are independent and either, both or neither may be set.
- **Setting a start date later than an already-saved target date** is refused by the same rule that governs the create form, and the refusal comes from the server, not the field alone.
- **A member removed while their details screen is open** keeps every row they wrote; only their controls change, and only on the next render.
- **An admin explicitly on the roster and then removed** loses their roster row and keeps their write access, because the predicate admits every admin.
- **A project with an empty roster** stays fully writable by admins, so no invariant protects the last member and none is needed.
- **A deactivated member** keeps their membership row and their place on the roster, so reactivation restores the access they had; the Add member picker never offers them.
- **Adding someone already on the roster** is not offered by the picker, and a duplicate row cannot exist in any case — the pair of project and user is the identity of a membership.
- **Deleting an active project** is refused by the server whether or not the disabled control was bypassed.
- **A description carrying an unsupported markdown construct** — a table, an image, an embed — renders as its own literal text rather than as the construct.
- **A link whose scheme is neither http, https nor mailto** renders as text rather than as a link.
- **A project key that matches nothing** reads "This doesn't exist" and never suggests a hidden-access state, because everyone can read everything.
- **An archived project** is still readable, still editable by its members, and still listed — archiving is a lifecycle state, not a lock.
- **A member chosen on the create form who is deactivated before it is submitted** still becomes a membership row: deactivation removes nothing, the account still exists, and reactivation is expected to restore the access the row grants. The picker's exclusion keeps a deactivated account from being chosen, not from being kept.
- **A cascade that grows between the confirmation being shown and the delete running** still deletes. The count is what the confirmation said, not a condition the delete re-checks.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings. An ID the roadmap assigns to another entry is cited only where this feature is that rule's first or a material caller; citing it is not a claim on it.

### Functional Requirements

#### Structure and the project record

No user journey observes these directly. Each is verified against the schema and the queries that read it — a column's type, bound and constraint by inspecting the migration the change generates, and a constraint by asserting that the database itself refuses the violating write.

- **FR-001**: Structure MUST remain exactly two levels — issues live in projects. This feature MUST introduce no grouping above a project and nothing between a project and an issue. (`OT-SCOPE-002`)
- **FR-002**: A project MUST carry a key, a name, a description, a status, a start date, a target date and a colour. The key MUST match `^[A-Z][A-Z0-9]{0,7}$`, MUST be unique across the installation, and MUST be immutable after creation — no mutator MUST offer a path that changes it. The server MUST validate a submitted key against that pattern and reject one that fails it; it MUST NOT uppercase, truncate or otherwise coerce the value into conformance, because the field's uppercasing is a typing affordance and the pattern is the rule. (`OT-INV-007`, `OT-INV-016`, §5, Principle II)
- **FR-003**: A project's status MUST be exactly one of `active` or `archived`, defaulting to `active`. No third state MUST exist. (§5)
- **FR-004**: A project MUST carry no ordering field of its own; project order MUST be derived from name and status alone. (`OT-UX-020`, §5)
- **FR-005**: A membership MUST be the pair of one project and one user, identified by that pair and carrying no role of its own. Its presence MUST be the whole grant. (§5)
- **FR-006**: A board column MUST belong to exactly one project and carry a name, a colour, a board position and a kind of `open`, `done` or `canceled`, fixed at creation. Column names MUST be unique within a project when folded to lower case. (`OT-INV-016`, `OT-INV-015`, §5)
- **FR-007**: Creating a project MUST seed exactly five board columns in one fixed order — Backlog, Todo, In Progress, Done, Canceled — with kinds `open`, `open`, `open`, `done`, `canceled` and palette colours grey, blue, amber, green and red in that same order. (§3.3, §5, §7)
- **FR-008**: Creating a project MUST create exactly one issue-counter row for it, in the creating transaction, so every later issue number is drawn from a row that already exists. The row MUST hold the last number issued for its project and MUST be seeded at `0`, so the first issue drawn from it is number 1. One row per project MUST be enforced by the database, through a unique constraint on the row's project reference, so a second counter row cannot exist to hand out numbers the first has already issued. The row MUST carry neither `created_at` nor `updated_at`, so drawing a number writes no timestamp. That row MUST NOT be reachable from any read endpoint. (§5, `OT-DATA-006`, `OT-DATA-012`, `OT-INV-009`)
- **FR-009**: Every colour this feature sets — the project's, and each seeded column's — MUST be one of the seven palette values, with the accent as the default. Free colour entry and a per-surface palette MUST NOT exist. (`OT-DATA-013`)
- **FR-010**: A project description MUST be stored as markdown source and MUST support only bold, italic, inline code, links, bullet and numbered lists, and headings. Tables, images and embeds MUST NOT be supported, and HTML MUST be escaped rather than rendered. This feature MUST implement that subset itself — it is the rule's first caller — building the rendered output as structured elements rather than as an HTML string, and without adding a parsing dependency. (`OT-DATA-015`, Principle IV, `AGENTS.md` → Architecture notes)
- **FR-011**: A link in a rendered description MUST carry an `http`, `https` or `mailto` scheme; a link with any other scheme MUST render as text. (`OT-DATA-015`, `AGENTS.md` → Architecture notes)
- **FR-012**: Every table this feature introduces MUST follow the conventions entry R1 established — server-generated UUIDv7 primary keys except where §5 fixes a composite key instead, which for this feature is `project_member` and `project_member` alone, whose identity is the pair FR-005 defines, `text` with a `CHECK` for enumerations, a date type for calendar dates and a timezone-aware type for instants, and a `CHECK` bounding every free-text column at 200 characters for names and keys and 10 000 for descriptions, counted in characters and applied to the trimmed value, so a value is trimmed before it is measured and never truncated to fit. Every mutator MUST write `updated_at` explicitly through the shared helper on every table that carries one; the issue-counter table carries no `created_at` and no `updated_at`, and is this feature's only table outside that rule. (`OT-DATA-001`, `OT-DATA-002`, `OT-DATA-003`)

#### Authorization and the write boundary

- **FR-013**: Authorization MUST reduce to the two predicates the specification defines, with `isMember` admitting every admin implicitly, so no rule this feature writes carries its own admin branch. (`OT-AUTHZ-001`)
- **FR-014**: Every mutator this feature delivers MUST enforce its predicate on the server. Where that predicate is project-scoped, the mutator MUST derive the project it checks from the stored row rather than from a client-supplied project identifier; `createProject` has no stored row to derive from and requires `isAdmin`, which is not project-scoped. The project-scoped predicate MUST be evaluated inside the same transaction as the write it guards, so a membership revoked concurrently is either seen by the check or ordered after the write, never between them; a read of a membership row followed by a write outside that read's transaction is not enforcement. `isAdmin` MUST be checked before that transaction opens, because it is a property of the actor this request already resolved from the session row rather than a row the write races with. The client MAY run the same predicates to disable controls, but the server check MUST be the enforcement. (`OT-AUTHZ-004`, `OT-AUTHZ-005`)
- **FR-015**: `createProject`, `setProjectStatus`, `deleteProject`, `addProjectMember` and `removeProjectMember` MUST each require `isAdmin`. (§2)
- **FR-016**: `updateProject` MUST require `isMember` of the project it changes and MUST accept exactly five fields — name, description, start date, target date and colour. It MUST NOT accept the key, which is immutable, or the status, which has its own admin-only mutator. (§2, `OT-INV-007`)
- **FR-017**: Every signed-in user MUST be able to read every project, its columns and its roster. Membership MUST NOT be used as a visibility boundary anywhere in this feature. (`OT-AUTHZ-002`)
- **FR-018**: Every membership list this feature renders — the roster on project details and the member chips on Create project — MUST read membership rows only, so an admin appears in one only where they were added explicitly. (`OT-AUTHZ-006`)
- **FR-019**: Removing a project member MUST revoke that person's write access to that project and nothing else: their assignments, their comments, their activity rows and their ability to read the project MUST all survive. This feature MUST deliver the revocation half of that rule in full; its remaining half — recording the removal in the project's activity — is entry R7's, which cannot be satisfied before the activity table exists. (`OT-AUTHZ-013`)
- **FR-020**: Losing write access mid-session MUST remove no rows; the affected controls MUST become disabled on the next render, carrying the same inline reason FR-021 requires, and the server MUST refuse the write independently of the control's state. (`OT-AUTHZ-012`)
- **FR-021**: Every action a user cannot take on these screens MUST render as a disabled control carrying an inline reason. A dead button MUST NOT be used and a tooltip alone MUST NOT be the explanation. Navigation is §2's one exception and MUST be honoured here: a link or control whose only function is to reach an admin-only screen MUST be hidden from a non-admin rather than disabled, because there is no action there to explain. (`OT-UX-002`, §2)

#### Create project

- **FR-022**: Create project MUST be a full page at `/projects/new`, not a modal, reachable from the sidebar's `+` beside the project list (entry R2's control, consumed here), which MUST be hidden from a non-admin rather than rendered disabled, being navigation to an admin-only screen. This feature fills the route the `+` points at and does not render the `+`. (§3.7, §2, `OT-SCOPE-007`, `OT-UX-003`)
- **FR-023**: A signed-in non-admin who reaches `/projects/new` by any route MUST get the Forbidden screen; an unauthenticated caller MUST be redirected to `/signin` instead and MUST NOT reach Forbidden. (§3.7, §3.11, `OT-SEC-015`)
- **FR-024**: Name MUST be required and trimmed, and MUST be the form's first and focused field. (§3.7)
- **FR-025**: The key MUST derive from the name as the first character of each whitespace-separated word — no other separator MUST split a word, so `Re-Design` derives `R` — uppercased and truncated to eight characters, and MUST keep following the name until the user edits the key, after which the name MUST NOT touch it again. The field MUST uppercase as typed. A derived value that is empty or that fails the key pattern MUST leave the field empty and required. (§3.7)
- **FR-026**: The key MUST be checked for uniqueness against the server as it is typed and again on submit. A clash MUST render as an inline error on the field naming the project that holds the key; a suffix MUST NOT be applied silently. That check is a server entry point of its own and MUST require `isAdmin`, matching the screen that calls it, because its answer names an existing project. (`OT-UX-012`, `OT-INV-016`, `OT-AUTHZ-004`)
- **FR-027**: Description MUST be optional and multi-line, MUST grow with its content up to a maximum height and MUST scroll within itself beyond it, and MUST take the markdown subset FR-010 fixes. This form MUST offer no rendered preview: the field holds source, and the rendered form is what project details shows on read. (§3.7, §3.8)
- **FR-028**: Start date and target date MUST each be optional and independent of the other. Where both are set, the target MUST NOT precede the start; a target equal to the start MUST be legal. The violation MUST render as an inline error on the target field and MUST also be refused by `updateProject`, so the form is not the only place the rule holds. Because FR-036 sends one field per call, two concurrent updates can each read a legal row and together write an illegal one, so the rule MUST additionally be a table constraint the database itself enforces; the mutator's own check exists to name the offending field in the inline error, not to be the enforcement. (§3.7, §3.8)
- **FR-029**: Colour MUST be required, picked from palette swatches, and MUST default to the accent. (§3.7, `OT-DATA-013`)
- **FR-030**: Members MUST be optional and picked from accounts that already exist. The picker MUST exclude deactivated accounts, MUST exclude the creating admin, and MUST offer no path to invite someone who has no account. Each chosen person MUST become a membership row in the creating transaction. (§3.7, `OT-AUTHZ-006`)
- **FR-031**: Status and columns MUST NOT appear on this form. A project MUST be created `active`, and its columns MUST be the five seeded rows. (§3.7)
- **FR-032**: Validation MUST be per field and on blur. The Create control MUST stay enabled and report what is missing inline rather than going dead. (`OT-UX-011`)
- **FR-033**: Creation MUST NOT be optimistic: the form MUST wait for the server and MUST show in-flight state on the Create control. (`OT-UX-008`, §3.7)
- **FR-034**: Create MUST run exactly one `createProject` call, and that call MUST write the project, its five columns, its issue-counter row and its membership rows in one transaction. On success it MUST navigate to the new project's board route; Cancel MUST return to where the user came from — or to Home where the user arrived at the route directly and there is nowhere to return to — and MUST write nothing. (§3.7)

#### Project details — the record

- **FR-035**: Project details MUST be one screen at `/projects/:projectKey/details`, readable by any signed-in user, holding the record, the columns, the members and the delete control, with no separate settings screen. (§3.8, `OT-SCOPE-007`)
- **FR-036**: Name, description, start date, target date and colour MUST be edited in place: activating the value MUST turn it into a field, Escape MUST revert, and a blur or ⌘-enter MUST save, with exactly one `updateProject` call per field. The value a user may edit MUST therefore be a control rather than static text, so it carries an accessible name, a visible focus indicator and keyboard activation, and MUST NOT be reachable by pointer alone; on a platform with no ⌘ key the same save MUST be bound to Ctrl-enter. Focus MUST return to that control when the field closes, whether it saved or reverted. At most one field MUST be open at a time — opening a second MUST close the first through the blur that already saves it — and a blur whose value is unchanged MUST make no call at all. (`OT-UX-009`, §7, `AGENTS.md` → React Aria Components)
- **FR-037**: The project key MUST render as a shown value rather than a control, and the screen MUST state that it is immutable. (`OT-UX-010`, `OT-INV-007`)
- **FR-038**: An in-place edit MUST apply optimistically and MUST roll back with a message naming what failed and why when the server refuses it. Two members editing the same field concurrently MUST resolve last-write-wins: no version column exists on a project and no write MUST be refused for having been preceded by another, so the later write stands and the earlier author sees it on their next render. (`OT-UX-008`, §5)
- **FR-039**: A description MUST render its markdown on read and MUST show its raw source while it is being edited. (§3.4, §3.8, `OT-DATA-015`)
- **FR-040**: A project key matching no project MUST read "This doesn't exist" and MUST NOT imply a hidden-access state. (`OT-UX-004`)

#### Project details — status, columns, members and delete

- **FR-041**: Status MUST be a two-state switch offered to admins only, applied optimistically. Every other user MUST see the current state as a disabled control carrying its reason. (§3.8, `OT-UX-008`, `OT-UX-002`)
- **FR-042**: Both status transitions MUST be legal — `active` to `archived` and back — with no terminal state, no guardrail and no confirmation on the transition itself. (`OT-OPS-011`)
- **FR-043**: Archiving or reopening a project MUST touch nothing else: no column, no membership and, once they exist, no issue. (`OT-OPS-010`, §4)
- **FR-044**: The Columns section MUST render as a read-only list in board order showing each column's name, colour, kind and issue count. This feature MUST offer no control that adds, renames, recolours, reorders or deletes a column. (§3.8)
- **FR-045**: The Members section MUST render the roster with add and remove offered to admins only. The Add member picker MUST list accounts that already exist, MUST exclude deactivated accounts and MUST exclude people already on the roster. It MUST NOT exclude the acting admin, who may add themselves to a roster they are not on; that is a deliberate asymmetry with FR-030's create-form picker, where the creating admin is excluded because the project does not yet exist to be joined. There MUST be no project-level invitation, no pending membership and nothing to accept. Removing the roster's last remaining member MUST succeed without a guardrail or a confirmation, because every admin may write in the project whatever the roster holds. (§3.8, `OT-SCOPE-005`)
- **FR-046**: An added member MUST have write access to the project on their next request, without signing out or in. (§3.8)
- **FR-047**: Delete MUST be offered to admins only and MUST be available only while the project is `archived`. On an active project the control MUST be disabled with its reason, and the mutator MUST refuse the call independently of the control. The mutator MUST read the project's status inside its own transaction, under a row lock, rather than from an earlier read, so a project archived and deleted concurrently cannot be deleted on the strength of a status it no longer holds. (§3.8, `OT-INV-008`, §5 invariant 13)
- **FR-048**: Delete MUST confirm once before writing anything, and the confirmation MUST state the size of what it will destroy. That size MUST be the count of rows the cascade actually reaches when the confirmation is shown — in this feature its board columns and its membership rows. Each later entry that attaches a table to the cascade MUST extend the count rather than leave it understating what the delete removes. The count MUST be advisory: the delete MUST NOT be conditional on it, and a cascade that grew between the confirmation being shown and the delete running MUST still complete rather than be refused for disagreeing with a number. (§3.8)
- **FR-049**: The delete MUST be hard and MUST cascade in the database. There MUST be no soft-delete marker on a project; archiving MUST be the reversible path. (`OT-DATA-007`)
- **FR-050**: The delete MUST run in one server transaction and its response MUST carry the settled state, so no caller can observe a moment where the project is gone and something it owned is not. (`OT-DATA-008`)
- **FR-051**: The cascade MUST reach every row that references the project. In this feature that is its board columns, its membership rows and its issue-counter row; each later entry MUST attach its own tables to the same cascade as they land. (§4)
- **FR-052**: A successful delete MUST navigate away from the deleted project, to Home, because the route it was on no longer resolves. (§4)

#### Shell — the project list and the project header

- **FR-053**: The sidebar MUST list every project alphabetically by name with active projects first and archived projects after them, dimmed. The comparison MUST be case-insensitive, and because two projects may share a name the order MUST break the tie on the project's key, which is unique and immutable, so the order is total. The order MUST be identical for every user and MUST NOT be user-controlled. (`OT-UX-020`, `OT-INV-007`)
- **FR-054**: Every project in the sidebar MUST link to that project's board route, and its entry MUST carry the project's colour. A name too long for the sidebar's fixed width MUST be visually truncated with the whole name still available to assistive technology, never wrapped to a second line or allowed to widen the region. (§3, The shell)
- **FR-055**: An installation with no projects MUST show one quiet line in the sidebar's project region rather than an illustration (entry R2's line, consumed here; this feature adds the entries beside it and leaves the empty state untouched). (`OT-UX-007`)
- **FR-056**: Every project-scoped screen's header MUST carry the project's colour dot, its name, and the Board and Details tab pair, with the current tab marked. A name too long for the header MUST be visually truncated on the same terms as the sidebar's, and MUST NOT displace the tab pair. (§3, The shell; §3.8)

### Out of Scope

Deferred by the roadmap's R5 boundary, and named here so no scenario above is read as covering them:

- **Column editing in every form** — entry R9 delivers `createColumn`, `updateColumn`, `moveColumn` and `deleteColumn`, the delete refusals, the case-insensitive name clash and the per-column activity. This feature renders the Columns section as the read-only list §3.8 already defines and seeds the five default rows; it enforces `OT-INV-005`, `-006`, `-012` and `-014` nowhere, because they are `deleteColumn`'s and `deleteColumn` does not exist yet.
- **The Activity section on project details, the project header's comment count, and the activity records every change on this screen writes** — entry R7. This feature's mutators write no activity; R7 adds that writing to them in the same transaction as the change each describes, and with it the second half of `OT-AUTHZ-013`, which R7's own roadmap scope already names.
- **The `notification` arm of `deleteProject`'s §4 cascade** — entry R11, which lands with the notification table itself.
- **The board at `/projects/:projectKey`** — entry R10. The sidebar entry, the Board tab and the post-create navigation all point at that route; this feature fixes the destination and renders nothing at it.
- **Issues in every form** — entry R6. The issue-counter row is created here and drawn from there; the Columns section's issue count reads zero until R6 lands.
- **Project-level invitations, confidential or private projects, guest and read-only roles, and a team-settings screen** — out of scope for v1 entirely. (`OT-SCOPE-005`)
- **A project lead, a project role, or any per-project permission finer than membership** — the specification gives a project members and nothing else.
- **Any user-controlled project ordering.** The sidebar order is derived; there is no manual rank to set.
- **Issuing invitations and deactivating accounts** — entry R3, which this feature consumes: the Add member picker reads the accounts R3's Accounts screen administers.

### Key Entities

- **Project** — the container work lives in. Carries a permanent uppercase key unique across the installation, a name, a markdown description, a status of `active` or `archived`, an optional start and target date, and one palette colour. Never carries an ordering field, a lead, or a role.
- **Project membership** — a pair of one project and one user, carrying no role and no attribute of its own beyond the timestamps FR-012 requires of every table here. Its presence is the entire write grant; its absence is the entire refusal, except for admins, whom the predicate admits regardless.
- **Board column** — a lane belonging to one project, carrying a name unique within that project when folded to lower case, a palette colour, a board position and a kind of `open`, `done` or `canceled` fixed at creation. Five are seeded with every project. Read-only in this feature.
- **Issue counter** — the per-project source of issue numbers, created with the project and destroyed with it, holding the last number issued for that project and seeded at `0`. Exactly one exists per project, enforced by a unique constraint rather than by convention, and it carries no timestamps of its own. Never read by a screen; entry R6 draws from it under a row lock, incrementing it and returning the incremented value in one statement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can go from an empty installation to a project ready to hold work by entering a name and accepting every default, in under two minutes and with no step outside the create form.
- **SC-002**: Every project created carries exactly five columns in the fixed order, so 100% of new projects are usable without any further setup.
- **SC-003**: Two projects can never hold the same key, verified under two concurrent creations of the same key: exactly one succeeds and the other is told which project holds it.
- **SC-004**: A key derived from a name is never silently altered — a clash is always reported by name, and a suffix is applied 0% of the time.
- **SC-005**: A project's key is identical at every later point in its life to the value it was created with, by every route that can reach the project.
- **SC-006**: A member's edit to a project field is visible within one interaction and, when the server refuses it, is reverted with a message naming the reason — with no page reload in either case.
- **SC-007**: A person added to a project can write in it on their very next request, with no acceptance step, no re-authentication and no waiting period.
- **SC-008**: Removing a person from a project removes zero rows they authored or were assigned, on every surface that shows those rows.
- **SC-009**: Archiving or reopening a project changes zero rows other than the project's own status and its updated timestamp.
- **SC-010**: An active project cannot be deleted through any route, including one that bypasses the disabled control.
- **SC-011**: Deleting an archived project leaves nothing behind that referenced it, and no caller ever observes a partially deleted project.
- **SC-012**: A deleted project's key is immediately available to a new project, because nothing is retained.
- **SC-013**: Every signed-in user sees the same projects in the same order in the sidebar, whatever their role and whatever they are a member of.
- **SC-014**: A non-admin is refused the create-project route 100% of the time, and an unauthenticated caller reaches the sign-in screen rather than the Forbidden screen 100% of the time.
- **SC-015**: Every control on project details that a given user may not use is visible, disabled and carries its reason — no control on the screen is dead, and none is hidden for a permission reason.
- **SC-016**: Every mutator this feature delivers refuses a caller who fails its predicate, on 100% of calls that bypass the client entirely, and the refusal names the rule rather than disclosing anything about the stored row.
- **SC-017**: The database refuses a second column of the same name within one project whatever the casing, and refuses a second issue-counter row for a project, on every attempt — including two issued concurrently.
- **SC-018**: Every value that can be edited in place can be opened, changed, saved and reverted using the keyboard alone, with focus landing somewhere visible at each step and never lost to the document body.
- **SC-019**: A description renders exactly the seven constructs the subset admits and renders every other construct as its own text, and a link whose scheme is outside the allowlist renders as text on 100% of attempts, including schemes disguised by casing, leading whitespace or embedded control characters.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **Adding and removing a member applies optimistically and rolls back with a message.** `OT-UX-008` enumerates drag, status, assignee and in-place field edits as small local writes and create-issue and create-project as large ones; a roster toggle is named in neither list, and it is one row changed from one control, which is the small pattern.
- **A member of a project who is later deactivated stays on the roster.** §3.9 has deactivation remove nothing and retain memberships so reactivation restores prior access; the roster is the only place that retention is visible. The source does not say whether the row is marked, so it is not marked beyond the display convention every other surface already uses for a deactivated user.
- **The key's as-typed uniqueness check is an affordance, not the enforcement.** §3.7 requires the check "against the server as typed and again on submit"; the unique constraint (`OT-INV-016`) is what actually decides, so a check that passed and a submit that fails are a normal sequence rather than a defect.
- **A project name is not unique.** §5 puts a uniqueness constraint on `project.key` and none on `project.name`, so two projects may share a name and the sidebar lists both.
- **The as-typed key check carries no throttle of its own, and no debounce is fixed as a requirement.** §6's throttle counts sign-in and reset attempts, and nothing else. The check requires `isAdmin` (FR-026), so its answer discloses to an admin only what the admin-only screen calling it already shows; adding a counter for it would be the installation's third throttle guarding nothing. How often the field asks is a matter for the screen, not for this document.
- **A bounded field refuses input past its bound rather than accepting and rejecting it.** §5 bounds every free-text column and §3.7 asks for validation on blur; neither says which side of the keystroke the bound sits on. Refusing the keystroke is the one that never produces an error the user cannot see coming.
- **Rendering cost is not bounded, and no requirement caps it.** A description is at most 10 000 characters (FR-012), the grammar admits no nesting (FR-010), and the render runs on the server for one field on one screen. There is no input in that space whose cost is worth a requirement to bound.
- **Reversing this feature's migration is a drop, not a backfill.** The four tables it introduces do not exist before it and hold no data that predates it, so there is nothing to preserve on the way back and no down-migration to design.

### Reconciliations between the roadmap and the specification

- **Create navigates to the new project's board, which entry R10 delivers.** §3.7 fixes the destination and the roadmap defers the route. The destination is fixed here; what answers at it is not this feature's. The same holds for the sidebar's project links and the header's Board tab, so before R10 lands, project details is reached at its own route rather than through the board.
- **`OT-UX-008` is established here and cited later.** The roadmap's cross-cutting list attributes it to R5, and R4's Profile also edits in place. This feature fixes the convention for the whole product; R6 and R10 exercise it again without owning it.
- **The Columns section renders `kind` and an issue count for tables this feature does not fully populate.** Kind is set by the seed and fixed at creation (`OT-INV-015`), so the column is meaningful from day one; the count reads zero for every column until R6 lands.
- **Entries R7 and R11 will reach back into this feature's mutators and its delete.** R7 adds activity writing to `createProject`, `updateProject`, `setProjectStatus`, `addProjectMember` and `removeProjectMember`, in the same transaction as the change each describes, with `member_added` and `member_removed` carrying the member's display name frozen at write time. R11 adds the `notification` arm of `deleteProject`'s cascade. Both are stated here because the roadmap requires every R5, R6, R7 and R10 child spec to say so.

### Inherited constraints, not decisions this specification makes

- The data-model conventions — UUIDv7 keys, `text` with `CHECK` for enumerations, explicit `updated_at` through one helper, the length bounds, and the `publicUser` and `accountUser` projections — were established by entry R1 and are inherited rather than chosen here. The member picker and the roster read `publicUser`.
- The shell that hosts these screens, the Forbidden screen, the "this doesn't exist" convention, the toast conventions, the per-screen skeletons and the disabled-control-with-inline-reason convention are entry R2's; this feature renders inside them.
- The accounts the member picker offers are administered by entry R3; this feature creates no account and closes none.
- Membership is enforced by rules the database cannot express, so `isMember` is a server predicate; the uniqueness, cascade and pair-identity rules above are database-enforced, and their tests therefore run against a real PostgreSQL instance on a separate database rather than a mock.
- The palette's seven values and the five seeded columns' colours are fixed by §7 and restated here rather than chosen.
- Cross-site request protection is §6's — `SameSite=Lax` plus an origin check on every mutating request — and applies to this feature's mutators without them restating it.
- Nothing about identity or membership is cached anywhere (§6): the actor is resolved from the session row on every request and membership is read per mutation. That is what makes FR-046's "on their next request" true, and what makes FR-020's revocation take effect without a sign-out.
- "On the next render" (FR-020) means the next server round trip, because §4's *Stale after navigation* rule has a revisited screen re-query the server and render nothing from a client cache.
- The connection-lost banner, the failed-load treatment and the toast conventions these screens rely on are entry R2's cross-cutting states (§4), not this feature's to define.

### Dependencies

- **Roadmap position**: R5 depends on R2 (the shell, the Forbidden screen and the cross-cutting UX conventions) and R3 (the accounts its pickers read), and transitively on R1. Entries R6 through R12 all consume it.
- **Consumed from earlier entries**: the actor resolved on every request and the `isAdmin` predicate (R1); the sidebar's project-list region and its admin-only `+`, the header contract and the Forbidden screen (R2); the account roster the member picker reads (R3).
- **Downstream reach-back**: R7 adds activity writing to all five of this feature's writing mutators; R11 adds the `notification` arm of `deleteProject`'s cascade; R6, R9 and R10 attach issues, column edits and the board to the structures created here; R6 draws issue numbers from the counter row this feature creates, and is the markdown renderer's second call site, where whether it is promoted out of this feature is decided (I).
