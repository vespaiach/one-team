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

---

### User Story 3 - A refusal keeps the frame and explains itself (Priority: P3)

A signed-in person who reaches something they may not use is told so inside the application, not thrown out of it: the sidebar stays, one sentence explains, and Home is one click away. Someone who is not signed in at all never sees that screen — they are sent to sign in. And something that simply is not there says exactly that, without hinting at a hidden room.

**Why this priority**: Three of the four routes the sidebar points at are admin-only, so refusal is a state this frame reaches on its first day — the guards that produce it belong to the authenticated route group, which is this feature's, not to the screens behind them. Below the sidebar itself because a refusal has nothing to render in until the frame exists.

**Independent Test**: As a member, request an admin-only route and confirm the Forbidden screen renders inside the shell at the same URL. Sign out and request the same route: the response is the sign-in screen. Request a path no screen claims and confirm the wording says the thing does not exist.

**Acceptance Scenarios**:

1. **Given** a signed-in user who lacks a right, **When** they reach the route, **Then** the Forbidden screen renders inside the shell, showing the error code, one sentence of explanation and a route back to Home.
2. **Given** that refusal, **When** the screen renders, **Then** the URL is the one that refused — no separate Forbidden path was navigated to.
3. **Given** a request carrying no session, **When** it reaches any authenticated route, **Then** it redirects to `/signin` and the Forbidden screen does not render.
4. **Given** a signed-in user whose session ends mid-visit, **When** they make their next request to an authenticated route, **Then** they are redirected to `/signin` rather than shown an empty frame or a refusal.
5. **Given** a signed-in user, **When** they request a path no screen claims, **Then** the answer reads "This doesn't exist" and says nothing about access.
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
- **FR-002**: The shell MUST persist across navigation between authenticated screens: the sidebar's position, width and entries MUST be unchanged from one screen to the next. (§3)
- **FR-003**: `/home` MUST be the one authenticated route that renders the sidebar without the header — no title block, no per-screen control and no New issue control. (`OT-UX-001`, §3.2)
- **FR-004**: Sign in, the reset request and Change password MUST render outside the shell entirely — no sidebar and no header. (`OT-UX-001`, §3.1)
- **FR-005**: The sidebar MUST hold, in this order: the app mark, Home, the project-list region, Notifications, Accounts, Labels, and the signed-in user's chip at the foot. (§3)
- **FR-006**: The sidebar MUST NOT carry a team switcher or any control that changes which team is in view. (§3, `OT-SCOPE-001`)
- **FR-007**: The header MUST carry a title block holding a name and an optional context line, exactly one per-screen control slot, and a New issue slot pinned to the far right. (§3)
- **FR-008**: The New issue control MUST render only on a screen scoped to a project — board, issue detail and project details — because only those routes name the project it would create in. (§3, §3.5)
- **FR-009**: The content region MUST fill the remainder of the viewport beside the sidebar, and the shell MUST add no chrome beyond the sidebar, the header and the banner slot. (§3)
- **FR-010**: The layout MUST target a desktop browser only: no responsive layout and no mobile breakpoint MUST ship, and the sidebar MUST NOT collapse, stack or hide at any viewport width. The frame MUST assume a minimum page width of 1280px — the 262px sidebar plus a 1018px content region — and a narrower window MUST scroll horizontally rather than reflow. (`OT-SCOPE-004`)

#### Role-aware navigation

- **FR-011**: Navigation leading to an admin-only screen MUST be hidden from a non-admin rather than rendered disabled — the sidebar's Accounts and Labels entries and the `+` beside the project-list region that opens Create project. (`OT-UX-003`)
- **FR-012**: Home, the project-list region, Notifications and the user chip MUST render for every signed-in user regardless of role. (§3)
- **FR-013**: Navigation leading to a member-only screen MUST render as a disabled control carrying an inline reason naming the project, and MUST NOT be hidden; the header's New issue control is that case. (`OT-UX-021`) *(Stated here; first implemented by entry R3.)*
- **FR-014**: Hiding or disabling navigation MUST NOT be the enforcement. Every route MUST perform its own authorization check on the server, and a caller who reaches it by deep link, bookmark or stale tab MUST be refused there. (`OT-AUTHZ-005`, `OT-UX-021`)
- **FR-015**: The client MAY evaluate the same authorization predicates to decide what to hide or disable, but that evaluation MUST be presentation only. (`OT-AUTHZ-005`)
- **FR-016**: A change to the signed-in user's role or project membership MUST take effect on the next render — entries appearing or disappearing, controls enabling or disabling — and MUST remove no rows. (`OT-AUTHZ-012`)
- **FR-017**: A user's display name MUST be their first and last name joined by a single space, everywhere in the application; the user chip is the first surface bound by this rule. (`OT-UX-019`)
- **FR-018**: The user chip MUST carry the sign-out control, which MUST end the caller's session through the session deletion entry R1 delivers and return them to `/signin`. It MUST be the application's only sign-out control. As this feature's only mutating request it MUST be refused unless its stated origin is the installation's own, MUST derive the session it ends from the request's own cookie rather than from anything the client sends, and MUST succeed without error when that session has already ended. (§6, §3, `OT-SEC-009`, `OT-AUTHZ-004`; deferred to this entry by R1)

#### Refusals, absences and empty surfaces

- **FR-019**: A signed-in caller who lacks a right MUST be shown the Forbidden screen rendered inside the shell — the error code, one sentence of explanation and a route back to Home — and MUST NOT be shown a full-screen takeover. The refusing route MUST render the full frame, with the header's title block naming the Forbidden screen itself rather than the screen that refused, and both the per-screen control slot and the New issue slot empty. (§3.11, FR-007)
- **FR-020**: Forbidden MUST NOT have a route of its own: it is a state the refusing route renders in place, leaving the requested URL unchanged. (§3, screen table)
- **FR-021**: An unauthenticated request to an authenticated route MUST redirect to `/signin` and MUST NOT reach the Forbidden screen. (`OT-SEC-015`)
- **FR-022**: A missing row and an unclaimed path MUST both read "This doesn't exist", and neither MUST imply a hidden-access state. (`OT-UX-004`)
- **FR-023**: Any action a user cannot take MUST render as a disabled control carrying an inline reason. A dead button MUST NOT be used, and a tooltip alone MUST NOT be the explanation. (`OT-UX-002`) *(Stated here; first implemented by entry R3.)*
- **FR-024**: An empty surface MUST be one quiet line, with no illustration and no empty-state marketing; the project-list region of an installation with no projects is this feature's first instance. (`OT-UX-007`)

FR-013 and FR-023 state a rule this feature has no caller for: every control it renders is either usable by everyone or hidden under `OT-UX-003`. Their first implementation is entry R3's last-active-admin **Deactivate** control, which §3.9 already specifies as disabled with the reason inline; entry R4 has no counterpart, so R3 owns it whichever of the two is built first. Change gate 1 therefore asks this feature for no test of them.

#### The must-change-password banner

- **FR-025**: The shell MUST carry one banner slot present on every authenticated screen, Home included, positioned so that a screen without a header still renders it. (§6)
- **FR-026**: While the signed-in user's must-change-password flag is set, that slot MUST render the advisory banner entry R1 delivers, and the banner MUST block nothing on the screen. (§6)
- **FR-027**: A screen rendered outside the shell MUST carry no banner slot. (§6, `OT-UX-001`)

#### The route surface

- **FR-028**: Every screen MUST be reachable at the route the specification's screen table assigns it, and those thirteen screens plus modals MUST be the whole surface; no route outside that table MUST answer. (`OT-SCOPE-007`)

The surface this feature fixes, with the entry that delivers each screen's content:

| Screen | Route | Frame | Content delivered by |
|---|---|---|---|
| Sign in (with the reset request and invite acceptance) | `/signin`, `/reset`, `/invite/accept` | outside the shell | R1, invite acceptance R3 |
| Change password | `/reset?token=…` | outside the shell | R1 |
| Home | `/home` | sidebar, no header | **R2** delivers the route; R12 its content |
| Board | `/projects/:projectKey` | full shell | R10 |
| Issue detail | `/projects/:projectKey/issues/:issueNumber/details` | full shell | R6 |
| Create issue | `/projects/:projectKey/issues/new` | full shell | R6 |
| Create project | `/projects/new` | full shell | R5 |
| Project details | `/projects/:projectKey/details` | full shell | R5 |
| Notifications | `/notifications` | full shell | R11 |
| Accounts | `/settings/accounts` | full shell | R3 |
| Labels | `/settings/labels` | full shell | R8 |
| Profile | `/profile` | full shell | R4 |
| Forbidden | no route of its own | full shell | **R2** |

Every **authenticated** route in that table is registered by this feature together with the authorization guard its Access column implies; the entry named delivers what renders once the guard has passed. The public rows are not this feature's: entry R1 owns `/signin` and `/reset`, and `/invite/accept` stays closed until entry R3 opens it as the fourth route `OT-SEC-002` allows — a public route has no guard to register, so leaving it shut makes no screen of this feature's untestable.

- **FR-029**: A sidebar entry MUST render from this feature onward whether or not the entry that owns its screen has been built. A route whose screen has not yet been delivered MUST still enforce its own authorization first: a caller who fails that check MUST be refused under FR-019, and a caller who passes it MUST get FR-022's not-found convention until the owning entry lands. (`OT-SCOPE-007`, `OT-AUTHZ-005`, FR-019, FR-022)

#### Component and interaction conventions

- **FR-030**: Interaction behaviour, focus management, keyboard support and ARIA semantics MUST come from React Aria Components, with the styling layer supplying appearance only. A hand-built component is permitted only where no suitable React Aria component exists, and MUST reproduce the same keyboard, focus and ARIA behaviour. (`OT-UX-018`)
- **FR-031**: The sidebar and the header MUST be operable by keyboard alone: focus MUST travel in visual order, every entry MUST carry a visible focus indicator, and every control MUST carry an accessible name. (`OT-UX-018`, §7)

#### Conventions fixed here, first implemented by the entry that has a surface for them

This feature performs exactly one write — sign-out (FR-018) — which ends the session and leaves the application, so it has no optimistic state to roll back, nothing to re-query and no skeleton to show. It therefore states these four rules and writes no code for them. Under change gate 1 no test is asked of this feature for them; each is implemented by the first entry that has a surface they apply to — R3 or R4, whichever is built first.

- **FR-032**: Loading MUST use per-screen skeletons matching the layout they replace. A full-screen spinner MUST NOT be used, and data landing MUST NOT shift the layout. (`OT-UX-005`) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*
- **FR-033**: A revisited screen MUST re-query the server, and nothing MUST render from a client cache. (`OT-UX-006`) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*
- **FR-034**: Toasts MUST be four kinds — success, info, warning and error — rendered top-right, stacked, and auto-dismissing. (`OT-UX-016`) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*
- **FR-035**: A lost connection MUST show one banner reading "Can't reach the server. Reconnecting." and MUST refuse writes with "Changes need a connection". Nothing MUST be queued for later. (`OT-UX-017`) *(Stated here; first implemented by entry R3 or R4, whichever is built first.)*

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
- **SC-012**: Every authenticated surface can be reached and operated using the keyboard alone, with the focused element visible at every step.
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

### Reconciliations between the roadmap and the specification

- **Disabled-control-with-inline-reason is fixed here and has no caller here.** The roadmap listed it under R2's *In*, but every control this feature renders is either usable by everyone or hidden from those who may not use it (`OT-UX-003`), and the one member-only control in the header contract — New issue — renders only on project-scoped screens, which arrive with R5 and R6. FR-013 and FR-023 state the rule; its first implementation is entry R3's last-active-admin **Deactivate** control (§3.9). `docs/ROADMAP.md` has been amended under §5 to move the rule out of R2's *In* list and into its *fixed here as rules, not implemented here* sentence, so the roadmap and this spec now agree. Under change gate 1 this feature is asked for no test it cannot write.
- **Four conventions are stated and not implemented** — toasts, per-screen skeletons, re-query on navigation and the connection-lost banner — because the shell loads no data and its one write, sign-out, leaves the application rather than re-rendering it. The roadmap says so plainly; each lands with R3 or R4, whichever is built first.
- **The user chip carries sign-out, and it is this feature's only write.** Entry R1 delivers session deletion and defers the control to this entry by name; §6 requires signing out to exist, and the chip is the only surface the specification gives it. FR-018 states it, and the roadmap's R2 row now names it. Because sign-out ends the session and leaves the application, it exercises none of FR-032 to FR-035 — there is no optimistic state to roll back and nothing to re-render.
- **The authenticated route group's guards ship here, ahead of the screens they protect.** The roadmap puts Forbidden §3.11 in R2 but defers every screen the sidebar links to, and in this feature every admin-only route is one of those deferred screens — so without the guards Forbidden would have no reachable caller and would ship untested, on a screen the roadmap lists as in scope. FR-029 resolves it by ordering the checks: authorization first, existence second. `docs/ROADMAP.md`'s R2 row has been amended to say so.
- **`/home` ships as a frame here and gains its content in R12.** The route exists in this entry so that `OT-UX-001`'s one exception is a rule about the shell rather than a rule about Home's content; until R12 the content region beneath the sidebar is empty.
- **The New issue slot has no occupant in this feature.** Its contract is fixed here and its first occupant arrives with R5's project details.
- **The project-list region reads nothing here.** R5 owns the data and the ordering, so until then the region shows the quiet line FR-024 requires — the only empty surface this feature can exercise.
- **`OT-SEC-015` is exercised here, not established here.** Entry R1 delivers the redirect; this feature owns the authenticated route group it protects and must not let Forbidden answer an unauthenticated caller.

### Inherited constraints, not decisions this specification makes

- React Aria Components and the styling layer are already recorded in the approved-dependency table in `AGENTS.md`; this feature adds no dependency.
- The actor, the sign-in redirect and the banner itself come from entry R1. This feature places the slot, reads the actor and renders neither from scratch.
- The root layout already resolves the locale on the server, sets the document language and direction from it, and hands it to the client provider; the shell composes beneath that, follows the direction it sets (FR-001), and does not re-resolve it.
- Authorization reduces to `isAdmin` and `isMember`. Project membership does not exist until entry R5, so every visibility rule this feature can exercise is the admin one, and `OT-UX-021`'s member-only case is stated rather than demonstrated.

### Dependencies

- **Roadmap position**: R2 depends on R1. Entries R3 through R12 all consume it.
- **Downstream reach-back**: R5 fills the project-list region and fixes its ordering (`OT-UX-020`) and gives the New issue slot its first occupant; R6 gives that control its target; R11 gives Notifications its unread count; R12 gives Home its content; the first of R3 or R4 to be built implements FR-032 to FR-035.
- **Operator-supplied**: nothing beyond what entry R1 already requires.
