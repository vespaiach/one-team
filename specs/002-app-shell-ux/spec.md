# Feature Specification: Application shell and cross-cutting UX

**Feature Branch**: `claude/roadmap-entry-r2-spec-c50ee4`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R2**

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "create feature specification for Roadmap Entry R2. Refer to docs/ROADMAP.md -> Entry R2, docs/product/requirements-index.md and docs/product/specifications.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R2** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

This entry builds a frame, not a feature. Nearly everything it frames belongs to a later entry, so the scenarios below are deliberately about the frame's own behaviour — what persists, what is hidden, what refuses — and not about the screens that will sit inside it.

## Clarifications

### Session 2026-08-30

- Q: Which roadmap entry should the spec name as the first place the disabled-control-with-inline-reason rule is actually implemented? → A: Entry R3, whose last-active-admin **Deactivate** control §3.9 already specifies as disabled with the reason inline.
- Q: Does the divergence between R2's roadmap *In* list and its testable surface get corrected in the roadmap, and in this branch? → A: Yes — `docs/ROADMAP.md` is amended under §5, in this branch, moving the rule into R2's *fixed here as rules, not implemented here* sentence.
- Q: Does this feature ship the sign-out control on the user chip? → A: Yes — entry R1 defers the control here by name and §6 requires signing out to exist. It is this feature's only write (FR-018).
- Q: Do sidebar entries render before the entries that own their screens are built? → A: Yes — the sidebar's shape is fixed from this feature onward, and an undelivered route answers with the not-found convention (FR-029).
- Q: What minimum page width does the frame assume before the page scrolls horizontally? → A: 1280px — the 262px sidebar plus a 1018px content region (FR-010).
- Q: When a member requests an admin-only route whose screen a later entry will deliver, do they get Forbidden or "This doesn't exist"? → A: Forbidden — the authenticated route group's guards ship with this feature, so a caller who fails the check is refused at the real URL and one who passes it gets the not-found convention until the screen lands (FR-029).
- Q: Should the spec state sign-out's server-side protections? → A: Yes — it is this feature's only mutating request, so FR-018 names the origin check, the cookie-derived session, and its quiet success on an already-ended session.
- Q: What does the header render on the Forbidden screen? → A: The full shell, with the title block naming the Forbidden screen itself and both the per-screen control slot and the New issue slot empty (FR-019).
- Q: Should the requirements this feature states but does not implement carry an inline marker? → A: Yes — FR-013, FR-023 and FR-032 to FR-035 each name the entry that implements them.
- Q: Which side of the viewport does the sidebar occupy? → A: The inline start, following the document direction resolved for the request; the 262px is a fixed width, not a fixed edge (FR-001).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every authenticated screen wears the same frame (Priority: P1)

A signed-in person moves around the application and the furniture never moves. A fixed 262px sidebar sits at the left of every authenticated screen; a header sits above the content with the screen's title, its one per-screen control and the New issue control pinned far right. Home is the single exception — sidebar, no header. Sign in and Change password are outside the frame altogether.

**Why this priority**: Every entry from R3 onward renders inside this frame and assumes it exists. Nothing else in R2 has value without it, and no later entry can start without it.

**Independent Test**: Sign in as any account and open the routes this feature delivers. The sidebar renders identically on each; `/home` renders it without a header; the sign-in and Change password screens render neither. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** a signed-in user on any authenticated screen, **When** the screen renders, **Then** a 262px sidebar occupies the inline start of the viewport and the content region fills the remainder.
2. **Given** a signed-in user, **When** they navigate from one authenticated screen to another, **Then** the sidebar's position, width and entries are unchanged.
3. **Given** a signed-in user, **When** they open `/home`, **Then** the sidebar renders and no header renders — no title block, no per-screen control, no New issue control.
4. **Given** a signed-in user on any authenticated screen other than Home, **When** the screen renders, **Then** the header renders with a title block, exactly one per-screen control slot and the New issue slot.
5. **Given** a screen that is not scoped to a project, **When** its header renders, **Then** the New issue slot renders no control.
6. **Given** a screen with no per-screen control of its own, **When** its header renders, **Then** the control slot renders nothing rather than a placeholder.
7. **Given** the sign-in screen, the reset request screen or the Change password screen, **When** it renders, **Then** neither the sidebar nor the header is present.
8. **Given** any viewport width, **When** an authenticated screen renders, **Then** the sidebar keeps its 262px width and the arrangement does not reflow, stack or collapse.
9. **Given** a window narrower than the layout's 1280px minimum, **When** an authenticated screen renders, **Then** nothing collapses or hides and the page scrolls horizontally instead.
10. **Given** a locale resolved as right-to-left, **When** an authenticated screen renders, **Then** the sidebar occupies the right edge and the content region the left, with nothing else about the frame changed.
11. **Given** a user arriving on an authenticated screen by keyboard, **When** they take the first focus step on the page, **Then** a bypass to the content region is what receives focus, and following it moves focus past the sidebar's entries.

---

### User Story 2 - The sidebar shows each person only the doors they can open (Priority: P2)

An admin's sidebar carries Accounts, Labels and the `+` that starts a new project. A member's sidebar carries none of them — they are absent, not present-and-greyed. Everyone gets Home, the project-list region, Notifications and their own chip at the foot, which names them the way the whole application names them: first and last name, one space.

**Why this priority**: The hide-rather-than-disable rule for admin navigation is fixed here and inherited by every later entry, and getting it wrong the other way — a disabled door — is the mistake the specification calls out by name. It also delivers the display-name rule that every later surface reuses.

**Independent Test**: Sign in as an admin and as a member against the same installation and compare the two sidebars. Change one account's role and reload: the entries follow the role on the next render, with no sign-out in between.

**Acceptance Scenarios**:

1. **Given** a signed-in admin, **When** the sidebar renders, **Then** Accounts, Labels and the `+` beside the project-list region are present.
2. **Given** a signed-in member, **When** the sidebar renders, **Then** Accounts, Labels and the `+` are absent — none of them renders as a disabled control.
3. **Given** a signed-in member, **When** they request an admin-only route directly, **Then** the route refuses and the Forbidden screen renders inside the shell.
4. **Given** a member whose role is raised to admin, **When** their next screen renders, **Then** the admin entries are present, with no sign-out and no restart in between.
5. **Given** an admin whose role is lowered to member, **When** their next screen renders, **Then** the admin entries are gone and no row they authored has been removed.
6. **Given** any signed-in user, **When** the sidebar renders, **Then** Home, the project-list region, Notifications and their own chip are present regardless of role.
7. **Given** a signed-in user, **When** their chip renders, **Then** it shows their first and last name joined by a single space.
8. **Given** an installation with no projects, **When** the project-list region renders, **Then** it shows one quiet line and no illustration.
9. **Given** a user navigating by keyboard alone, **When** they move focus into the sidebar, **Then** focus travels through the entries in visual order, each carries a visible focus indicator, and the focused entry can be followed without a pointer.
10. **Given** any signed-in user, **When** the sidebar renders, **Then** it carries no team switcher and no control that changes which team is in view.
11. **Given** a signed-in user, **When** they use the sign-out control on their chip, **Then** their session ends and they are returned to the sign-in screen, and any later request to an authenticated route redirects there too.
12. **Given** the same person signed in on two browsers, **When** they sign out in one, **Then** the other stays signed in and its next request is still answered as them.

---

### User Story 3 - A refusal keeps the frame and explains itself (Priority: P3)

A signed-in person who reaches something they may not use is told so inside the application, not thrown out of it: the sidebar stays, one sentence explains, and Home is one click away. Someone who is not signed in at all never sees that screen — they are sent to sign in. And something that simply is not there says exactly that, without hinting at a hidden room.

**Why this priority**: Three of the four routes the sidebar points at are admin-only, so refusal is a state this frame reaches on its first day — the guards that produce it belong to the authenticated route group, which is this feature's, not to the screens behind them. Below the sidebar itself because a refusal has nothing to render in until the frame exists.

**Independent Test**: As a member, request an admin-only route and confirm the Forbidden screen renders inside the shell at the same URL. Sign out and request the same route: the response is the sign-in screen. Request a path no screen claims and confirm the wording says the thing does not exist.

**Acceptance Scenarios**:

1. **Given** a signed-in user who lacks a right, **When** they reach the route, **Then** the response carries 403 and the Forbidden screen renders inside the shell, showing that code, the sentence "You don't have access to this." and a link to Home.
2. **Given** that refusal, **When** the screen renders, **Then** the URL is the one that refused — no separate Forbidden path was navigated to.
3. **Given** a request carrying no session, **When** it reaches any authenticated route, **Then** it redirects to `/signin` and the Forbidden screen does not render.
4. **Given** a signed-in user whose session ends mid-visit, **When** they make their next request to an authenticated route, **Then** they are redirected to `/signin` rather than shown an empty frame or a refusal.
5. **Given** a signed-in user, **When** they request a path no screen claims, **Then** the response carries 404, the answer reads "This doesn't exist" and it says nothing about access — including where that path sits beneath an admin-only prefix.
6. **Given** a signed-in user, **When** they request a screen whose underlying record is absent, **Then** the same wording is used — the two cases are indistinguishable to the reader.
7. **Given** a stale tab whose sidebar still shows an entry the user's current role no longer permits, **When** they follow it, **Then** the route refuses; the hidden-or-shown state of the entry was never the enforcement.
8. **Given** a signed-in admin, **When** they request an admin-only route whose screen a later entry delivers, **Then** they pass its guard and the answer reads "This doesn't exist" rather than Forbidden.
9. **Given** the Forbidden screen, **When** it renders, **Then** the header renders with the screen's own title, an empty per-screen control slot and no New issue control.

---

### User Story 4 - The seeded admin is reminded on every screen, and blocked on none (Priority: P4)

The operator who stood the installation up signs in with the password they put in the environment. Every authenticated screen, Home included, tells them it still needs changing. Nothing on any of those screens is withheld while it says so.

**Why this priority**: It completes a capability R1 already built — R1 delivers the flag and the banner and states plainly that the slot which hosts it is R2's. Last because it is advisory: the installation is fully usable without it.

**Independent Test**: Sign in as an account carrying the must-change-password flag and confirm the notice renders on every authenticated screen, Home included, while every control on those screens stays operable. Clear the flag and confirm the notice stops rendering.

**Acceptance Scenarios**:

1. **Given** a signed-in user whose must-change-password flag is set, **When** any authenticated screen renders, **Then** the banner renders in the shell's banner slot.
2. **Given** that same user, **When** Home renders, **Then** the banner renders even though the header does not.
3. **Given** that same user, **When** the banner is rendering, **Then** every control on the screen remains operable and no navigation is withheld.
4. **Given** a signed-in user whose flag is not set, **When** any authenticated screen renders, **Then** no banner renders and the content region starts where it otherwise would.
5. **Given** the sign-in screen or the Change password screen, **When** it renders, **Then** it carries no banner slot at all.

---

### Edge Cases

- **A role change between render and click.** The sidebar a user is looking at was rendered under the role they held a moment ago. Following a now-forbidden entry is refused by the route, not by the sidebar; following a newly-permitted one that the stale sidebar does not show is reached by URL and answered normally.
- **A window narrower than the layout.** Nothing collapses and nothing hides. The frame keeps its arrangement and the page scrolls horizontally.
- **A user chip with no avatar set.** The avatar is an optional URL on the user record; the chip renders without one and the display name carries the identification.
- **A display name at the length bound.** Two 200-character names cannot widen or wrap the 262px sidebar; the chip truncates visually while the full name stays available to assistive technology.
- **A title block with nothing to add.** The context line is optional; a screen with no context renders the name alone rather than an empty second line.
- **A screen the sidebar links to that this feature does not deliver.** Its route answers with the not-found convention until the entry that owns it lands.
- **An unauthenticated caller reaching a route that would also have refused them.** The redirect wins: they never see Forbidden, so the screen never has to distinguish "signed out" from "not permitted".
- **Sign-out on a session that has already ended elsewhere.** The control still returns the person to the sign-in screen: there is nothing left to delete and nothing to report.
- **The banner on a screen outside the shell.** There is no slot there, so there is nothing to render and nothing to suppress.

## Requirements *(mandatory)*

### Functional Requirements

Each cites the requirement index ID it restates, or the specification section it narrows.

#### The frame

- **FR-001**: Every authenticated screen MUST render inside one persistent shell composed of a fixed 262px sidebar and a header. The sidebar MUST occupy the inline start of the viewport, following the document direction resolved for the request, so that 262px fixes its width and not its edge. (`OT-UX-001`, §3)
- **FR-002**: The shell MUST persist across navigation between authenticated screens: for a given actor the sidebar's position, width and entries MUST be unchanged from one screen to the next. Entries MAY differ between two renders only where FR-016's actor has changed; navigation alone MUST change nothing. The shell MUST have no pending state of its own — it renders on the server from an actor already resolved, so no part of the frame MUST ever render as loading. (§3)
- **FR-003**: `/home` MUST be the one authenticated route that renders the sidebar without the header — no title block, no per-screen control and no New issue control. (`OT-UX-001`, §3.2)
- **FR-004**: Sign in, the reset request and Change password MUST render outside the shell entirely — no sidebar and no header. (`OT-UX-001`, §3.1)
- **FR-005**: The sidebar MUST hold, in this order: the app mark, Home, the project-list region, Notifications, Accounts, Labels, and the signed-in user's chip at the foot. The sidebar MUST occupy the full height of the viewport, and the chip MUST be pinned to its bottom edge rather than following the entries above it in flow. When the entries exceed the height available — the project-list region is the one that grows, and entry R5 fills it — the project-list region MUST scroll within itself, leaving the app mark, Home, Notifications, Accounts, Labels and the chip in place. The page's own horizontal scrolling under FR-010 MUST NOT move the sidebar. (§3)
- **FR-006**: The sidebar MUST NOT carry a team switcher or any control that changes which team is in view. (§3, `OT-SCOPE-001`)
- **FR-007**: The header MUST carry a title block holding a name and an optional context line, exactly one per-screen control slot, and a New issue slot pinned to the far right. The control slot MUST hold at most one control and MUST render nothing — no placeholder and no second control — when a screen has none. Unlike the sidebar's 262px the header's height MUST NOT be fixed: it MUST be derived from its content, so that a title block with a context line is taller than one without. A name or context line too long for its width MUST truncate on one line under FR-017's rule rather than wrap or widen the header. (§3)
- **FR-008**: The New issue control MUST render only on a screen scoped to a project — board, issue detail and project details — because only those routes name the project it would create in. (§3, §3.5)
- **FR-009**: The content region MUST fill the remainder of the viewport beside the sidebar, and the shell MUST add no chrome beyond the sidebar, the header and the banner slot. This cap is a property of the shell and not of this feature's release: no later entry MUST add a fourth region to it. What entries R3 through R12 add — the project header's colour dot, tab pair and comment count among them — MUST render inside the content region or inside the header's existing slots. (§3)
- **FR-010**: The layout MUST target a desktop browser only: no responsive layout and no mobile breakpoint MUST ship, and the sidebar MUST NOT collapse, stack or hide at any viewport width. The frame MUST assume a minimum page width of 1280px — the 262px sidebar plus a 1018px content region — and a narrower window MUST scroll horizontally rather than reflow. (`OT-SCOPE-004`)

#### Role-aware navigation

- **FR-011**: Navigation leading to an admin-only screen MUST be hidden from a non-admin rather than rendered disabled — the sidebar's Accounts and Labels entries and the `+` beside the project-list region that opens Create project. (`OT-UX-003`)
- **FR-012**: Home, the project-list region, Notifications and the user chip MUST render for every signed-in user regardless of role. (§3)
- **FR-013**: Navigation leading to a member-only screen MUST render as a disabled control carrying an inline reason naming the project, and MUST NOT be hidden; the header's New issue control is that case. The reason MUST follow §3.5's pattern — the capability, then the project by name, as in "Only project members can create issues in Website Redesign" — and MUST sit beside the control it explains rather than inside a tooltip. (`OT-UX-021`, §3.5) *(Stated here; first implemented by entry R3.)*
- **FR-014**: Hiding or disabling navigation MUST NOT be the enforcement. Every route MUST perform its own authorization check on the server, and a caller who reaches it by deep link, bookmark or stale tab MUST be refused there. (`OT-AUTHZ-005`, `OT-UX-021`)
- **FR-015**: The client MAY evaluate the same authorization predicates to decide what to hide or disable, but that evaluation MUST be presentation only. (`OT-AUTHZ-005`)
- **FR-016**: A change to the signed-in user's role or project membership MUST take effect on the next render — entries appearing or disappearing, controls enabling or disabling — and MUST remove no rows. A request's guard and its render MUST read one and the same actor, resolved once for that request, so a role change landing between them MUST NOT produce a screen guarded under one role and drawn under another; the change takes effect on the next request instead. (`OT-AUTHZ-012`, §6) *(The no-rows clause restates §2 and is unexercisable here: this feature owns no rows.)*
- **FR-017**: A user's display name MUST be their first and last name joined by a single space, everywhere in the application; the user chip is the first surface bound by this rule. "Everywhere" MUST include surfaces that are not screens — notification mail and stored activity strings among them — so that one person is named one way wherever they appear. Both parts are always present: §6 requires a first and last name at invite acceptance and `admin:grant` requires both, so no rendering rule for an absent or blank part is needed. Where the name is too long for the space it occupies it MUST truncate visually on one line, with the untruncated name remaining the control's accessible name; no character bound MUST be imposed beyond the 200 characters §5 already puts on each part. The chip's avatar MUST be optional in both directions — a user with no `avatar_url`, and one whose `avatar_url` fails to load, MUST both render the chip with the display name alone and no substitute image. (`OT-UX-019`, §3.12, §5)
- **FR-018**: The user chip MUST carry the sign-out control, which MUST end the caller's session through the session deletion entry R1 delivers and return them to `/signin`. It MUST be the application's only sign-out control. As this feature's only mutating request it MUST be refused unless its stated origin is the installation's own, MUST derive the session it ends from the request's own cookie rather than from anything the client sends, and MUST succeed without error when that session has already ended. It MUST delete exactly that one session row and MUST leave the same user's other sessions intact — signing out on one device MUST NOT sign them out on another. It MUST also clear the session cookie §6 defines on the response, so that the browser stops presenting a key to a row that no longer exists. A request whose stated origin is not the installation's own MUST be refused without deleting any row and MUST leave the caller signed in. (§6, §3, `OT-SEC-009`, `OT-AUTHZ-004`; deferred to this entry by R1)

#### Refusals, absences and empty surfaces

- **FR-019**: A signed-in caller who lacks a right MUST be shown the Forbidden screen rendered inside the shell — the error code, one sentence of explanation and a route back to Home — and MUST NOT be shown a full-screen takeover. The error code is **403**, which §3 gives the screen its name by. The sentence MUST read "You don't have access to this." and the route back MUST be a link to `/home` labelled Home, operable by keyboard under FR-031 like every other control this feature renders. The response MUST carry the 403 status, not a 200 with refusal text in it. The refusing route MUST render the full frame, with the header's title block naming the Forbidden screen itself rather than the screen that refused, and both the per-screen control slot and the New issue slot empty. (§3.11, §3, FR-007)
- **FR-020**: Forbidden MUST NOT have a route of its own: it is a state the refusing route renders in place, leaving the requested URL unchanged. (§3, screen table)
- **FR-021**: An unauthenticated request to an authenticated route MUST redirect to `/signin` and MUST NOT reach the Forbidden screen. A session that is present but expired MUST be treated exactly as no session at all — §6 resolves the cookie to a row on every request, and a row that has expired resolves to no actor. The redirect MUST carry no record of where the caller was going and MUST NOT accept one as a parameter: sign-in lands on `/home`, and no caller-supplied destination MUST ever be read back out of the URL. (`OT-SEC-015`, §6)
- **FR-022**: A missing row and an unclaimed path MUST both read "This doesn't exist", and neither MUST imply a hidden-access state. The wording is binding exactly as quoted, capitalisation and apostrophe included, and §4 forbids the alternative by name: never "you don't have access". The response MUST carry the 404 status. A route parameter that is syntactically invalid MUST answer the same way as one naming a record that is absent, so the two are indistinguishable to the reader. An unclaimed path MUST answer this way whatever prefix it sits under: `/settings/nothing-here` is not a route, so no guard is registered for it and none runs — FR-029's ordering governs registered routes only, and an unclaimed path under an admin-only prefix MUST NOT be refused as though it were one. (`OT-UX-004`, §4)
- **FR-023**: Any action a user cannot take MUST render as a disabled control carrying an inline reason. A dead button MUST NOT be used, and a tooltip alone MUST NOT be the explanation. Navigation is the one exception §2 states, and it is a narrow one: sidebar entries and links leading to an **admin-only** screen are hidden rather than disabled, because there is no control there to explain, only a door — and admin-only navigation is the whole of the exception. Everything else, navigation to a member-only screen included (FR-013), takes the disabled-with-reason treatment. Whether a user "cannot take" an action is decided by the two predicates §2 defines, `isAdmin` and `isMember` of the affected project, and by nothing else. (`OT-UX-002`, §2) *(Stated here; first implemented by entry R3.)*
- **FR-024**: An empty surface MUST be one quiet line, with no illustration and no empty-state marketing; the project-list region of an installation with no projects is this feature's first instance, and its line MUST read "No projects yet." The rule is general and binds every later entry's empty surface, each of which fixes its own one line the same way. (`OT-UX-007`, §4)

FR-013 and FR-023 state a rule this feature has no caller for: every control it renders is either usable by everyone or hidden under `OT-UX-003`. Their first implementation is entry R3's last-active-admin **Deactivate** control, which §3.9 already specifies as disabled with the reason inline; entry R4 has no counterpart, so R3 owns it whichever of the two is built first. Change gate 1 therefore asks this feature for no test of them.

#### The must-change-password banner

- **FR-025**: The shell MUST carry one banner slot present on every authenticated screen, Home included, positioned so that a screen without a header still renders it. The slot MUST sit at the top of the content region, above the header where there is one, so the vertical order of an authenticated screen is banner, then header, then content — and on Home, where FR-003 removes the header, banner then content. An empty slot MUST occupy no space: with no banner to render the content region MUST begin exactly where it would in a shell that had no slot at all. (§6)
- **FR-026**: While the signed-in user's must-change-password flag is set, that slot MUST render the advisory banner entry R1 delivers, and the banner MUST block nothing on the screen. (§6)
- **FR-027**: A screen rendered outside the shell MUST carry no banner slot. (§6, `OT-UX-001`)

#### The route surface

- **FR-028**: Every screen MUST be reachable at the route the specification's screen table assigns it, and those thirteen screens plus modals MUST be the whole surface; no route outside that table MUST answer. (`OT-SCOPE-007`)

The surface this feature fixes, with the entry that delivers each screen's content:

| Screen | Route | Access (§3) | Guard registered here | Frame | Content delivered by |
|---|---|---|---|---|---|
| Sign in (with the reset request and invite acceptance) | `/signin`, `/reset`, `/invite/accept` | public | none — a public route has no guard | outside the shell | R1, invite acceptance R3 |
| Change password | `/reset?token=…` | public | none — a public route has no guard | outside the shell | R1 |
| Home | `/home` | any signed-in user | signed in | sidebar, no header | **R2** delivers the route; R12 its content |
| Board | `/projects/:projectKey` | read all; write if member | signed in | full shell | R10 |
| Issue detail | `/projects/:projectKey/issues/:issueNumber/details` | read all; write if member | signed in | full shell | R6 |
| Create issue | `/projects/:projectKey/issues/new` | member | signed in; the member check lands with R5 | full shell | R6 |
| Create project | `/projects/new` | admin | signed in **and** admin | full shell | R5 |
| Project details | `/projects/:projectKey/details` | read all; members edit the record and comment; admin-only status, members, columns | signed in | full shell | R5 |
| Notifications | `/notifications` | own only | signed in; the row-level scope is R11's | full shell | R11 |
| Accounts | `/settings/accounts` | admin | signed in **and** admin | full shell | R3 |
| Labels | `/settings/labels` | admin | signed in **and** admin | full shell | R8 |
| Profile | `/profile` | own only | signed in | full shell | R4 |
| Forbidden | no route of its own | — | none — it is a state, not a route | full shell | **R2** |

Two things outside that table answer, and neither is a screen, so neither widens the surface FR-028 fixes. `/` answers with a redirect to `/home` and renders nothing — entry R1's, and the reason sign-in lands where FR-021 says it does. `POST /api/auth/signin` is the one mutation §6 pins to a route handler rather than a Server Action, so that the throttle and the origin check sit in one place; it is entry R1's too, and it serves the Sign in screen already in the table rather than a screen of its own. Both are named here because a test that enumerates only the authenticated route group can prove the group adds no URL segment but cannot prove that nothing outside the table answers, which is what FR-028 and SC-002 claim.

The three admin-only routes are `/projects/new`, `/settings/accounts` and `/settings/labels`, and they are the whole set SC-014 checks. `/projects/:projectKey/issues/new` is member-gated at the route (§3.5) but project membership does not exist until entry R5, so this feature registers its signed-in check and R5 adds the membership predicate to the same guard.

Every **authenticated** route in that table is registered by this feature together with the authorization guard its Access column implies; the entry named delivers what renders once the guard has passed. The public rows are not this feature's: entry R1 owns `/signin` and `/reset`, and `/invite/accept` stays closed until entry R3 opens it as the fourth route `OT-SEC-002` allows — a public route has no guard to register, so leaving it shut makes no screen of this feature's untestable.

- **FR-029**: A sidebar entry MUST render from this feature onward whether or not the entry that owns its screen has been built. A route whose screen has not yet been delivered MUST still enforce its own authorization first: a caller who fails that check MUST be refused under FR-019, and a caller who passes it MUST get FR-022's not-found convention until the owning entry lands. (`OT-SCOPE-007`, `OT-AUTHZ-005`, FR-019, FR-022)

#### Component and interaction conventions

- **FR-030**: Interaction behaviour, focus management, keyboard support and ARIA semantics MUST come from React Aria Components, with the styling layer supplying appearance only — those four responsibilities are the whole of the partition, and the styling layer implementing any of them is the violation. A hand-built component is permitted only where no suitable React Aria component exists, and §7 fixes that test: a component is unsuitable only where React Aria ships none for the pattern **or the pinned version does not ship one**, never where one exists and is inconvenient. A hand-built component MUST reproduce the same keyboard, focus and ARIA behaviour, and the entry that builds one MUST record which of the two conditions it met, in its own plan, where a reviewer of that entry will find it. (`OT-UX-018`, §7)
- **FR-031**: Every surface this feature renders — the sidebar, the header, the banner slot, the Forbidden screen and the not-found screen — MUST be operable by keyboard alone: focus MUST travel in visual order, every entry MUST carry a visible focus indicator, and every control MUST carry an accessible name. "Visual order" MUST follow the direction resolved for the request, so in a right-to-left locale it begins at the sidebar on the right (FR-001). The focus indicator MUST be distinguishable without relying on colour alone. The frame MUST expose its two parts as landmarks — the sidebar as a navigation region and the content region as the screen's main region — and the sidebar's navigation region MUST carry an accessible name of its own, so it stays distinguishable from any navigation a later entry adds. The screen's header is composed by the page inside the content region and MUST NOT be a landmark of its own. Because the sidebar repeats ahead of the content on every authenticated screen, the shell MUST offer a keyboard bypass to the content region as the first focusable thing on the page. (`OT-UX-018`, §7)

#### Conventions fixed here, first implemented by the entry that has a surface for them

This feature performs exactly one write — sign-out (FR-018) — which ends the session and leaves the application, so it has no optimistic state to roll back, nothing to re-query and no skeleton to show. It therefore states these four rules and writes no code for them. Under change gate 1 no test is asked of this feature for them; each is implemented by the first entry that has a surface they apply to — R3 or R4, whichever is built first, and R3 if the two are built concurrently. The four are independent: an entry implements each rule its surfaces exercise and leaves the rest, rather than owing all four at once.

Three obligations follow the rules to wherever they land. The entry that implements one MUST cite its requirement ID here, so the rule is traceable from that entry's spec back to this one. It MUST cover the rule with a test of its own — change gate 1 excuses this feature, which has no surface, not the entry that has one. And it MUST remove the inline deferral marker from the requirement below, so no marker outlives its truth. The same three apply to FR-013 and FR-023, whose first caller is entry R3.

- **FR-032**: Loading MUST use per-screen skeletons matching the layout they replace. A skeleton matches when it occupies the same regions, in the same number and at the same dimensions, as the content arriving into them — §4's own examples are board columns, the issue rail and feed rows. A full-screen spinner MUST NOT be used, and data landing MUST NOT shift the layout: the tolerance is zero, and any movement of already-painted content when data arrives is a violation. (`OT-UX-005`, §4) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*
- **FR-033**: A revisited screen MUST re-query the server, and nothing of that screen's own data MUST render from a client cache. The rule's subject is the screen, as §4's is: the shell is not screen data, and FR-002's frame persisting across navigation — including a sidebar drawn under an actor since changed (US3 s7) — is the framework behaviour this feature requires, not a cache this requirement forbids. (`OT-UX-006`, §4, FR-002) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*
- **FR-034**: Toasts MUST be four kinds — success, info, warning and error — rendered top-right, stacked, and auto-dismissing. They stack newest nearest the corner, and no limit on how many stand at once is fixed here. Auto-dismiss MUST be five seconds from the toast appearing, and every toast MUST also carry a dismiss control, so the timer is never the only way out of one. A completed write MUST use success and a rejected one MUST use error, which §4 already illustrates ("Only project members can edit issues in Website Redesign"); info and warning are the implementing entry's to assign. Toasts MUST be announced to assistive technology, which under FR-030 means React Aria's toast region rather than a hand-rolled live region. (`OT-UX-016`, §4, §7) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*
- **FR-035**: A lost connection MUST show one banner reading "Can't reach the server. Reconnecting." and MUST refuse writes with "Changes need a connection". Nothing MUST be queued for later. A connection counts as lost when a request fails to reach the server — a transport failure, not an error the server itself returned, which is a rejected write and takes a toast under FR-034. The banner MUST clear on the next request that does reach the server, and "Reconnecting" obliges no retry cadence of its own: the next request the application would make anyway is what clears it. Both strings are binding exactly as quoted. (`OT-UX-017`, §4) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*

### Out of Scope

Deferred by the roadmap's R2 boundary, and named here so no scenario above is read as covering them:

- **Home's content** — entry R12. This feature delivers `/home` as a route and proves the headerless exception; the greeting, the stat cards and the roll-up sections are R12's.
- **The project list's data and its ordering** — entry R5, which also owns `OT-UX-020` (alphabetical by name, active first, then archived and dimmed). This feature delivers the region and its empty line.
- **The Notifications unread count** — entry R11, which delivers the table it counts.
- **What the New issue control points at** — entry R6. This feature fixes the slot and the rule governing it.
- **Every screen the sidebar links to** — Accounts (R3), Profile (R4), Create project (R5), Labels (R8), Notifications (R11). Their *routes* and *guards* are not deferred: this feature registers both, and each entry fills in what renders once the guard has passed (FR-029).
- **The project header's colour dot, name, comment count and Board / Details tab pair** — entries R5 and R7. This feature's header contract covers the generic title block only.
- **The implementations of toasts, skeletons, re-query on navigation and the connection-lost banner** — the first of R3 or R4 to be built. The rules are FR-032 to FR-035.
- **The first implementation of disabled-control-with-inline-reason** — entry R3, whose last-active-admin **Deactivate** control §3.9 specifies as disabled with the reason inline. The rules are FR-013 and FR-023.
- **A shared component library.** Under Principle I a shared primitive is extracted at its second call site, so this feature builds the shell's own components and nothing speculative.
- **Any responsive or mobile layout** — out of scope for v1 entirely (`OT-SCOPE-004`), not deferred to a later entry.
- **Search, a command palette and a team switcher** — out of scope for v1 entirely (`OT-SCOPE-005`).

### Key Entities

This feature introduces no table and no persisted field. It composes what other entries own:

- **Actor** — entry R1's resolved answer to "who is making this request", produced fresh on every request. The shell reads exactly four things from it: the display name and avatar URL for the chip, the account role for navigation visibility, and the must-change-password flag for the banner slot.
- **Project-list entry** — what the sidebar's project-list region will show: a project's name, colour and status. Owned by entry R5, which also fixes the ordering. Reads nothing here.
- **Unread count** — the number beside Notifications, owned by entry R11. Renders nothing here.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every authenticated screen presents the same sidebar at the same width in the same position, and moving between any two of them changes nothing in the frame.
- **SC-002**: Home is the only authenticated screen without a header, and every other authenticated screen has one — verifiable by enumerating the routes.
- **SC-003**: The sign-in and Change password screens show no sidebar and no header, 100% of the time.
- **SC-004**: A non-admin sees zero admin-only navigation entries, and zero of them appear as disabled placeholders instead of being absent.
- **SC-005**: A role change reaches the person's navigation within one screen render — no sign-out, no cache to clear and no restart.
- **SC-006**: A signed-in user who is refused keeps the sidebar and reaches Home in one click, for 100% of refusals, and the URL they were refused at is still the one in the address bar.
- **SC-007**: An unauthenticated request to an authenticated route reaches the sign-in screen 100% of the time and the Forbidden screen 0% of the time.
- **SC-008**: A path no screen claims and a screen whose record is absent produce the same wording, so nothing in either answer suggests a hidden room.
- **SC-009**: A user carrying the must-change-password flag sees the notice on every authenticated screen including Home, and can still operate every control on those screens.
- **SC-010**: The same person's name appears identically — first name, one space, last name — everywhere this feature renders it.
- **SC-011**: The frame's arrangement is independent of viewport width: no width causes the sidebar to collapse, stack or hide, and a window under the 1280px minimum scrolls horizontally instead of reflowing.
- **SC-012**: Every surface this feature renders — sidebar, header, banner slot, Forbidden and not-found — can be reached and operated using the keyboard alone, with the focused element visible at every step, and the content region is reachable without tabbing through the sidebar. Screens later entries deliver are theirs to hold to the same rule.
- **SC-013**: A signed-in person can end their session from any authenticated screen in one action, and no request from that browser is answered as them afterwards.
- **SC-014**: Every admin-only route decides whether the caller may be there before it reports whether anything is there — checked against each admin-only route in the surface table, not only the ones whose screens exist yet.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **The minimum page width is 1280px, and a narrower window scrolls horizontally.** `OT-SCOPE-004` forbids a responsive layout and a breakpoint but does not say what a narrow window does. Settled in *Clarifications* and stated as FR-010. The board's own column strip still scrolls inside the content region, as a Kanban board normally does; that is entry R10's, not a reflow of the frame.
- **Sidebar entries render before the screens they point at exist.** The sidebar's shape is fixed from this entry onward rather than growing an item per release, and a route whose screen has not been delivered answers with the not-found convention — after its own authorization guard, which this feature registers with the route. Settled in *Clarifications* and stated as FR-029.
- **The app mark is presentational.** §3 lists it beside Home as a separate item, so Home is the sidebar's only route to `/home` and the mark is not a second control.
- **The title block's context line is optional**, and the per-screen control slot holds at most one control and renders nothing when a screen has none — no placeholder and no second control.
- **The banner slot sits at the top of the content region, above the header.** §6 requires the banner on every screen, and Home has no header to hang it from.
- **Forbidden preserves the URL that refused it.** The screen table gives Forbidden the route "any", so it is a state rendered in place rather than a redirect to a dedicated path; a refused deep link therefore stays copyable and re-openable once access is granted.
- **A chip with no avatar URL renders the name alone.** The avatar is an optional URL on the user record and nothing states a fallback image; inventing one would be a decision this feature has no basis for.
- **A long display name truncates visually inside the chip** rather than widening or wrapping the sidebar, while the accessible name carries it in full.
- **The accessibility target is WCAG 2.2 AA.** §7 fixes the mechanism — React Aria Components — but names no conformance level, and "operable by keyboard" (FR-031) is a criterion rather than a standard. AA is the level a self-hosted internal tool is ordinarily held to, and every rule this feature states already sits inside it.
- **The Forbidden sentence and the empty project-list line are fixed verbatim** (FR-019, FR-024). §3.11 asks for "one sentence" and §4 for "one quiet line" without supplying either, and leaving them free would have two entries write two different sentences for one screen. The wording is a default, not a quotation.
- **A toast auto-dismisses after five seconds** (FR-034). §4 requires auto-dismiss and fixes no duration; a number is needed for the rule to be implementable at all, and the dismiss control the same requirement adds means the choice binds nobody who wants longer.
- **The sidebar marks no entry as current.** §3's inventory of the shell lists the entries and no active state, and this feature adds none. An entry that wants one introduces it against its own screens.
- **The header's height is not fixed** (FR-007). The sidebar's 262px comes from §3; nothing there fixes a header height, and deriving it from content is what lets the optional context line change it.
- **The sign-in redirect carries no destination** (FR-021). §6 is silent, and a redirect parameter read back out of a URL is an open-redirect surface this feature has no requirement to open. A caller who is refused for want of a session lands on `/home` after signing in.
- **Nothing this feature does is recorded.** Neither a refusal nor a sign-out writes an audit row: §5's `activity` log is per project and per issue, and no table in it takes an authentication or authorization event. The absence is deliberate, not an omission.
- **An authenticated caller requesting `/signin` is entry R1's to answer.** This feature owns the authenticated route group and states nothing about the public screens beyond FR-004's rule that they render outside the shell.
- **No animation.** The frame neither transitions between screens nor animates its own parts, so this feature states no motion rule and needs no reduced-motion accommodation. An entry that introduces motion states both.

### Reconciliations between the roadmap and the specification

- **Disabled-control-with-inline-reason is fixed here and has no caller here.** The roadmap listed it under R2's *In*, but every control this feature renders is either usable by everyone or hidden from those who may not use it (`OT-UX-003`), and the one member-only control in the header contract — New issue — renders only on project-scoped screens, which arrive with R5 and R6. FR-013 and FR-023 state the rule; its first implementation is entry R3's last-active-admin **Deactivate** control (§3.9). `docs/ROADMAP.md` has been amended under §5 to move the rule out of R2's *In* list and into its *fixed here as rules, not implemented here* sentence, so the roadmap and this spec now agree. Under change gate 1 this feature is asked for no test it cannot write.
- **Four conventions are stated and not implemented** — toasts, per-screen skeletons, re-query on navigation and the connection-lost banner — because the shell loads no data and its one write, sign-out, leaves the application rather than re-rendering it. The roadmap says so plainly; each lands with R3 or R4, whichever is built first.
- **The user chip carries sign-out, and it is this feature's only write.** Entry R1 delivers session deletion and defers the control to this entry by name; §6 requires signing out to exist, and the chip is the only surface the specification gives it. FR-018 states it, and the roadmap's R2 row now names it. Because sign-out ends the session and leaves the application, it exercises none of FR-032 to FR-035 — there is no optimistic state to roll back and nothing to re-render.
- **The authenticated route group's guards ship here, ahead of the screens they protect.** The roadmap puts Forbidden §3.11 in R2 but defers every screen the sidebar links to, and in this feature every admin-only route is one of those deferred screens — so without the guards Forbidden would have no reachable caller and would ship untested, on a screen the roadmap lists as in scope. FR-029 resolves it by ordering the checks: authorization first, existence second. `docs/ROADMAP.md`'s R2 row has been amended to say so.
- **`/home` ships as a frame here and gains its content in R12.** The route exists in this entry so that `OT-UX-001`'s one exception is a rule about the shell rather than a rule about Home's content; until R12 the content region beneath the sidebar is empty.
- **The New issue slot has no occupant in this feature.** Its contract is fixed here and its first occupant arrives with R5's project details.
- **The project-list region reads nothing here.** R5 owns the data and the ordering, so until then the region shows the quiet line FR-024 requires — the only empty surface this feature can exercise.
- **`OT-SEC-015` is exercised here, not established here.** Entry R1 delivers the redirect; this feature owns the authenticated route group it protects and must not let Forbidden answer an unauthenticated caller.
- **Sign-out ends one session, not every session that user holds.** §6 reads "Signing out, a password reset, or deactivation deletes the rows and takes effect immediately, everywhere, including other devices", which taken alone could be read as a global sign-out. Two things in §6 itself settle it the other way: that paragraph's subject is how quickly a revocation propagates — "a revoked session dies on its next request rather than at the end of some expiry window" — not how many rows it touches; and where §6 does mean every row it says so, in terms, for deactivation ("deletes every session row"). Sign-out gets no such phrase. FR-018 therefore ends the row the request's own cookie resolves to and leaves the rest, and "everywhere, including other devices" is read as the promise that the deletion is felt on the next request wherever it is presented. Should the product intend a global sign-out, this is the sentence to amend and FR-018 with it.

### Inherited constraints, not decisions this specification makes

- React Aria Components and the styling layer are already recorded in the approved-dependency table in `AGENTS.md`; this feature adds no dependency.
- The actor, the sign-in redirect and the banner itself come from entry R1. This feature places the slot, reads the actor and renders neither from scratch.
- The root layout already resolves the locale on the server, sets the document language and direction from it, and hands it to the client provider; the shell composes beneath that, follows the direction it sets (FR-001), and does not re-resolve it.
- Authorization reduces to `isAdmin` and `isMember`. Project membership does not exist until entry R5, so every visibility rule this feature can exercise is the admin one, and `OT-UX-021`'s member-only case is stated rather than demonstrated.

### What entries R3 through R12 inherit

Every rule below is fixed by this feature and binds every entry after it. They are collected here because a later entry's author reads that entry's spec, not this one, and a rule they never encounter is a rule they will re-decide.

| Rule | Where |
|---|---|
| The shell's three regions, and no fourth | FR-002, FR-009 |
| Header slots: title block, one control, New issue | FR-007, FR-008 |
| Admin-only navigation is hidden; everything else a user cannot do is disabled with its reason inline | FR-011, FR-013, FR-023 |
| Hiding and disabling are presentation; the route is the enforcement | FR-014, FR-015 |
| Display name is first and last name, one space, everywhere | FR-017 |
| Refusal is 403 inside the shell; absence is "This doesn't exist" at 404 | FR-019, FR-022 |
| Authorization decides before existence does | FR-029 |
| An empty surface is one quiet line | FR-024 |
| React Aria supplies behaviour; the styling layer supplies appearance | FR-030 |
| Keyboard operability, landmarks, focus visibility, accessible names | FR-031 |
| Skeletons, re-query on revisit, toasts, the connection banner | FR-032 – FR-035 |

### Dependencies

- **Roadmap position**: R2 depends on R1. Entries R3 through R12 all consume it.
- **Downstream reach-back**: R5 fills the project-list region and fixes its ordering (`OT-UX-020`) and gives the New issue slot its first occupant; R6 gives that control its target; R11 gives Notifications its unread count; R12 gives Home its content; the first of R3 or R4 to be built implements FR-032 to FR-035.
- **Operator-supplied**: nothing beyond what entry R1 already requires.
