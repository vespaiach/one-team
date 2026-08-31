# Feature Specification: Accounts and invitations

**Feature Branch**: `claude/roadmap-entry-r3-spec-7b7dfd`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R3**

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "create feature specification for Roadmap Entry R3. Refer to docs/ROADMAP.md -> Entry R3, docs/product/requirements-index.md and docs/product/specifications.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R3** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## Clarifications

### Session 2026-08-30

- Q: Should entry R3 own the four cross-cutting UX conventions `OT-UX-005`, `-006`, `-016` and `-017`, or should ownership stay tied to whichever of R3 and R4 is built first? → A: R3 owns and first-implements all four unconditionally. Build order no longer decides it: R3 holds the first caller for each, entry R2 already settled the fifth deferred convention on R3 by that same first-caller reasoning, and entry R4's spec already consumes the four as their second caller. FR-054 to FR-059 stay in this feature whichever entry is built first.
- Q: Does that settlement get recorded in the roadmap and in entry R2, and in this branch? → A: Yes — under `docs/ROADMAP.md` §5 the roadmap is amended first, in this branch, and entry R2's spec and its `ux-conventions` contract are reconciled to it, so all three name R3 rather than a build order.
- Q: When the Invite form refuses an address that already has an account, what does §3.9's "a link to it" actually do, given §3.9 also states the Accounts tab is page state with nothing to link to? → A: An in-page control, not an anchor. It closes the Invite modal, discards the field, switches the page's tab state to Accounts and brings that account's row into view with a transient highlight. No URL, no history entry, nothing to bookmark (FR-008, FR-003).
- Q: When the refused address belongs to a deactivated account, does the inline error distinguish that from an active one? → A: Yes. FR-008 carries two refusals: an active account is named as already holding a login, a closed one is named as closed with **Reactivate** given as the remedy — the control that row already carries, and the one §3.9 says needs no re-invitation and no new token (FR-008a).
- Q: How is "at most one outstanding invitation per address" enforced when two admins invite the same address at the same moment? → A: By a partial unique index on the case-folded address covering unspent invitation rows only. The losing write fails on the constraint and `inviteUser` turns that conflict into FR-009's resend offer. The index is scoped to unspent rows so it states the live-offer invariant alone and does not depend on acceptance retaining its row (FR-009a).
- Q: How long is an accepted invitation's spent row kept? → A: Indefinitely — it is never swept. The row and its token digest are what let a used link answer "used" rather than "unknown", so bounding retention would bound FR-031 and make SC-004 conditional. Growth is one row per accepted invitation (FR-031a).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An admin offers someone a login (Priority: P1)

An admin opens Accounts, types a colleague's email address into the Invite form, and submits. The colleague is mailed a link good for seven days and one use. Until they take it, the invitation sits in a list showing who was invited, by whom, when, and when the offer runs out — with a way to send it again or withdraw it. The form refuses to make a mess: an address that already has an account, or one already invited, is named and the right remedy is offered before anything is written.

**Why this priority**: There is no public sign-up and only an admin may invite (§6), so this is the only way a second person joins an installation that first-run seeding left with exactly one admin. Every entry from R5 onward assumes a team larger than one.

**Independent Test**: Sign in as the seeded admin, invite a fresh address, and confirm one invitation appears carrying its issuer, its issue instant and an expiry seven days out, and that a link was mailed. Re-submit the same address and confirm the form offers resend instead. Submit the admin's own address and confirm the form names the existing account. Revoke and confirm the row goes.

**Acceptance Scenarios**:

1. **Given** an admin on the Invitations tab, **When** they submit an address that has neither an account nor an invitation, **Then** one invitation is created, a single-use link valid for seven days is mailed to that address, the modal closes, and the new invitation appears at the head of the list.
2. **Given** the Invite form, **When** a malformed address is entered and the field loses focus, **Then** an inline error names the problem, the submit control stays enabled, and nothing is written.
3. **Given** an address that already has an account, **When** it is entered and the field loses focus, **Then** an inline error names that account and offers a control that reaches its row on the Accounts tab, and no invitation is created.
4. **Given** an address that already holds an outstanding invitation, **When** it is entered and the field loses focus, **Then** an inline error says so and offers resend in place of a second invitation.
5. **Given** an address that already has an account under different casing, **When** it is entered, **Then** it is recognised as that same account — address comparison folds case.
6. **Given** the open Invite modal with text in the field, **When** Cancel or Escape is used, **Then** the modal closes, the field is discarded, and nothing is written.
7. **Given** an outstanding invitation, **When** Resend is used, **Then** a new link is mailed, the seven days restart from now, and the previously mailed link stops working.
8. **Given** an outstanding invitation, **When** Revoke is used, **Then** its token is invalidated at once and its row leaves the list.
9. **Given** an invitation past its seventh day, **When** the list renders, **Then** the row is still listed and marked expired, with Resend still offered.
10. **Given** no outstanding invitations, **When** the tab renders, **Then** one quiet line reads "No outstanding invitations" — no illustration and no empty-state marketing.
11. **Given** a signed-in member, **When** they call the invite, resend or revoke mutator directly, **Then** the server refuses it, whatever the client rendered.
12. **Given** a submitted invitation, **When** the write is outstanding, **Then** the submit control shows in-flight state, and on success a toast renders top-right, stacked with any other, and dismisses itself.
13. **Given** the Invitations tab before its data lands, **When** it renders, **Then** a skeleton matching the list's own layout stands in for it, and nothing shifts position when the data arrives.
14. **Given** a lost connection, **When** the invitation is submitted, **Then** one banner reports the connection, the write is refused with "Changes need a connection", and nothing is queued for later.
15. **Given** the inline error naming an existing account, **When** the control beside it is used, **Then** the Invite modal closes, the field is discarded, the Accounts tab becomes the selected tab, and that account's row is brought into view and transiently highlighted — with no URL change and no browser-history entry.
16. **Given** an address belonging to a deactivated account, **When** it is entered and the field loses focus, **Then** the inline error names the account as closed and offers Reactivate as the remedy rather than an invitation, and the control beside it reaches that account's row among the closed accounts.
17. **Given** two admins submitting the same fresh address at the same moment, **When** both writes reach the server, **Then** exactly one invitation row exists for that address, the losing caller is offered resend rather than shown an error, and no second link is mailed.

---

### User Story 2 - An invited person accepts and is inside (Priority: P2)

Someone receives the mailed link, opens it, sees the address they were invited at — shown, not editable — gives a first name, a last name and a password of their choosing, and submits. The account comes into being and they are signed in on the spot, with no second trip through the sign-in screen. If the link has already been used, has run out, or is not a link this installation issued, they are told which of the three happened.

**Why this priority**: The invitation is inert until it is taken; this is the half that actually creates the account. Below issuing only because an invitation can be created, listed, resent and revoked without it, and because acceptance can be tested against a seeded invitation.

**Independent Test**: Seed one live invitation, open its link, complete the form, and confirm a `user` row exists, a session is live, and the browser is inside the app. Open the same link again and confirm the "already used" state. Repeat with an invitation seeded past its expiry, and with a token string that matches nothing.

**Acceptance Scenarios**:

1. **Given** a live invitation link, **When** it is opened, **Then** a full-page screen renders outside the shell — no sidebar, no header — carrying first name, last name and one password field, with the invited address shown as a value rather than a control.
2. **Given** the acceptance form, **When** a compliant password and both names are submitted, **Then** a `user` row is created at that address, a session is written, the session cookie is set, and the browser lands on `/home`.
3. **Given** the acceptance form, **When** a password under twelve characters or on the common-password blocklist is submitted, **Then** the field reports which rule failed and no account is created.
4. **Given** an account created by acceptance, **When** its role is read, **Then** it is `member` — no field on this form and no control anywhere in the product sets a role.
5. **Given** a link that has already been accepted, **When** it is opened again, **Then** the "already used" state renders and no account can be created.
6. **Given** a link past its seventh day, **When** it is opened, **Then** the "expired" state renders — distinct from used.
7. **Given** a token string matching no invitation, **When** it is opened, **Then** the "unknown" state renders — distinct from both expired and used.
8. **Given** a revoked invitation, **When** its link is opened, **Then** the "unknown" state renders, because revoke dropped the row.
9. **Given** an invitation whose address acquired an account by another route after it was issued, **When** the link is accepted, **Then** acceptance is refused and no second account exists for that address.
10. **Given** an unauthenticated caller on the acceptance route, **When** the page renders, **Then** no `user` record is read or disclosed — the address shown comes from the invitation.
11. **Given** an accepted invitation, **When** the Invitations tab renders, **Then** that invitation is no longer listed.
12. **Given** an invitation accepted long ago, **When** its link is opened, **Then** the "already used" state still renders — no age causes a used link to fall back to the unknown state.

---

### User Story 3 - An admin sees who is on the team (Priority: P3)

An admin opens the Accounts tab and reads the whole team on one page: each person's avatar and name, their email, whether they are an admin or a member, when they joined, and how many projects they belong to. Closed accounts are there too, below the active ones, so nobody disappears.

**Why this priority**: The roster is the read surface the closing and reopening controls live on, and the only place in the product where one person can see another's email. Below acceptance because it has nothing to show until accounts exist.

**Independent Test**: Seed several accounts, some deactivated, and confirm the tab lists all of them, active before deactivated, each showing name, email, role, joined date and a project count.

**Acceptance Scenarios**:

1. **Given** a mix of active and closed accounts, **When** the Accounts tab renders, **Then** every account is listed, active accounts first and closed accounts after them.
2. **Given** any listed account, **When** its row renders, **Then** it shows an avatar and a display name formed as first and last name joined with a space, plus email, role, joined date and a project count.
3. **Given** an account created by acceptance, **When** its joined date renders, **Then** it is the instant the account came into being.
4. **Given** any account, **When** its project count renders, **Then** it counts that account's project-membership rows only, so an admin is counted only for projects they were added to explicitly — a figure that is zero for every account until entry R5 creates those rows.
5. **Given** any listed account, **When** its row renders, **Then** it carries exactly one control — Deactivate on an active account, Reactivate on a closed one — and no control that sets a role.
6. **Given** a signed-in member, **When** they open `/settings/accounts`, **Then** the Forbidden screen renders inside the shell.
7. **Given** an unauthenticated caller, **When** they request `/settings/accounts`, **Then** they are redirected to `/signin` and never reach the Forbidden screen.
8. **Given** an admin on the Accounts tab, **When** they reload the page, **Then** the Invitations tab is selected again — the tab is page state, not a route.
9. **Given** an admin who navigates away from this screen and back, **When** the roster renders again, **Then** its rows come from a fresh query and nothing renders from a client cache.

---

### User Story 4 - An admin closes an account, and later reopens it (Priority: P4)

Someone leaves the team. An admin closes their account: they are signed out everywhere at once, cannot sign in again, and drop out of every picker — while everything they wrote stays exactly where it was, under their name. The admin is told that before it happens, and asked once. Later the same person comes back, and one control reopens the account with everything it had. The installation refuses to close the last admin left standing, and says why on the control itself.

**Why this priority**: The only way to revoke access from a screen, and the counterweight to invitation — a team that can only grow is not a team that can be administered. Last because the roster it lives on must exist first, and because the break-glass command entry R1 delivers is an alternative route to the same outcome.

**Independent Test**: Seed two admins and a member. Close the member's account and confirm their sessions are gone, their next request redirects to sign-in, their next sign-in is refused with the closed-account message, and their authored content is untouched. Reopen it and confirm sign-in works. Close one admin, then confirm the remaining admin's Deactivate control is disabled with its reason stated.

**Acceptance Scenarios**:

1. **Given** an active account, **When** an admin uses Deactivate, **Then** a confirmation is asked once and names what stays — memberships, assignments, comments and activity.
2. **Given** that confirmation, **When** it is accepted, **Then** the account is marked closed and every session row for it is deleted.
3. **Given** an account closed while it had a live session elsewhere, **When** that browser makes its next request, **Then** it is redirected to `/signin`.
4. **Given** a closed account, **When** its holder submits their correct email and password, **Then** sign-in is refused with the closed-account message rather than the generic one.
5. **Given** a closed account, **When** the content it authored is read anywhere in the product, **Then** it is unchanged and still renders under that person's name.
6. **Given** exactly one active admin, **When** the Accounts tab renders, **Then** that row's Deactivate control is disabled with the reason stated inline beside it, and is not hidden.
7. **Given** exactly one active admin, **When** a caller invokes the deactivation mutator for that account directly, **Then** the server refuses it and writes nothing.
8. **Given** exactly two active admins, **When** both are deactivated concurrently, **Then** at most one succeeds and the installation is never left with zero active admins.
9. **Given** a closed account, **When** an admin uses Reactivate and confirms, **Then** the account can sign in again with the memberships it already had, and no new link or invitation is issued.
10. **Given** any deactivation or reactivation, **When** the project and issue feeds are read, **Then** no activity record was written for it and nobody was notified.
11. **Given** any deactivation or reactivation, **When** the account is read afterwards, **Then** its current state is the only state recorded — no prior state and no acting admin is retained.
12. **Given** a signed-in member, **When** they call the deactivate or reactivate mutator directly, **Then** the server refuses it.
13. **Given** a deactivation the server refuses, **When** the refusal lands, **Then** the row returns to the state it held before, and a toast names what failed and why.

---

### Edge Cases

- **An admin closes their own account.** Permitted where they are not the last active admin — the only guard the source states is the admin count. Their own sessions go with everyone else's, so their next action returns them to sign-in.
- **An admin demoted from the command line mid-session** keeps every row they wrote; the screen's controls become disabled on the next render and the server refuses the mutators regardless of what the client shows.
- **An address invited twice in quick succession by two admins**: the second attempt must find the first and offer resend rather than write a second invitation for one address. Where the two are close enough that neither read sees the other, the unique index of FR-009a decides it and the loser is shown the same resend offer.
- **Revoke racing acceptance.** The row is dropped or spent, not both; the loser gets the state its outcome implies — "unknown" after a revoke, "already used" after an acceptance.
- **Resend racing acceptance.** Only one link can be live at a time, so the older link is dead the moment the newer is issued; a person holding the older one gets the "unknown" state.
- **An invitation for an address that is granted an account over SSH before acceptance** cannot create a second account — the address is unique when folded to lower case, and acceptance is refused.
- **A closed account holding an outstanding invitation** cannot exist: an invitation precedes an account, and an accepted invitation leaves the list.
- **Deactivate racing reactivate on one account.** Both serialise on that account's row, so the account ends in one of the two states. The sessions a deactivation deleted do not come back if a reactivation follows it — reopening restores access, and the holder signs in again.
- **Mail cannot be sent** — SMTP unconfigured or unreachable. The invitation still stands and the admin is told the mail did not go; Resend is the remedy, and no automatic retry exists for it.
- **A person opens the acceptance link twice in two tabs** and submits both: one account is created and the second submission gets the "already used" state.
- **A password compliant in one tab and not the other** is checked on the server at this entry point exactly as at every other, whatever the form allowed.
- **The connection drops with the Invite modal open**: the banner renders, the write is refused with "Changes need a connection", and nothing is queued for later.
- **The roster's project count while entry R5 is unbuilt** reads zero for every account, including admins — the figure is a membership count and there are no membership rows yet.
- **A deactivated user's name in the "invited by" column** still renders; content and attribution authored by a closed account survive it.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings.

### Functional Requirements

#### The Accounts screen

- **FR-001**: `/settings/accounts` MUST render as a full page inside the shell, and MUST be reachable only by an admin. (§3.9, `OT-SCOPE-007`)
- **FR-002**: A signed-in non-admin who reaches the route MUST get the Forbidden screen; an unauthenticated caller MUST be redirected to `/signin` and MUST NOT reach it. (§3.9, §3.11, `OT-SEC-015`)
- **FR-003**: The page MUST carry two tabs, **Invitations** then **Accounts**, with Invitations selected on arrival. The selected tab MUST be page state rather than a route, so there is nothing to link to and a reload returns to Invitations. (§3.9)
- **FR-003a**: The selected tab MUST change only when the reader selects one or when FR-008's control moves it; no write MUST change it. The surfaces that report a write's outcome — FR-054's toasts and FR-057's banner — MUST render at page level rather than inside a panel, so an outcome raised from one tab is seen while the other is selected. (§3.9, FR-054, FR-057)
- **FR-004**: This screen MUST be the only surface in the product that creates or closes an account; the remaining routes to either are first-run seeding and the command line, both delivered by entry R1. (§3.9, §6)

#### Issuing an invitation

- **FR-005**: An **Invite** control at the head of the Invitations tab MUST open a modal carrying one email field and a submit control, and nothing else. "Nothing else" fixes what the modal *offers*: no second field, no role control, no bulk affordance, no navigation. A field's own error output is not an addition to that composition, so FR-007 to FR-009's inline refusals and the remedy control FR-008 and FR-008a place beside them render inside this modal without contradicting it. (§3.9, FR-008)
- **FR-006**: The field MUST be validated per field and on blur rather than as a wall of errors on submit, and the submit control MUST stay enabled and report what is wrong inline rather than going dead. That prohibition is on validation state: no invalid field MUST disable the control. The in-flight state FR-059 requires answers a submission rather than a validation, and MUST stand only while that write is outstanding. (`OT-UX-011`, FR-059)
- **FR-007**: A malformed address MUST be refused inline. (§3.9)
- **FR-008**: An address that already has an account MUST be refused inline, naming that account and offering a control that reaches its row on the Accounts tab. That control MUST be in-page rather than a link to a URL — there is none to link to (FR-003) — and MUST close the Invite modal, discard the field, switch the selected tab to Accounts, and bring the row into view with a transient highlight, changing neither the URL nor the browser history. (§3.9, §3.12)
- **FR-008a**: The refusal MUST distinguish a deactivated account from an active one. An active account MUST be named as already holding a login; a closed account MUST be named as closed and MUST offer **Reactivate** as the remedy, that being the control its row carries and the one that restores access without a re-invitation or a new token. Neither refusal MUST create an invitation. (§3.9)
- **FR-008b**: The jump FR-008 describes MUST be perceivable without sight and without colour. It MUST move focus to the account's row, so a keyboard reader lands where a sighted one is looking; it MUST announce its outcome to assistive technology, naming the account whose row was reached, because the tab otherwise changes in silence; and the transient highlight MUST be carried by more than colour. Bringing the row into view MUST be a no-op where it is already in view, and the focus move, the announcement and the highlight MUST all happen whether or not any scrolling was needed. (§3.9, `OT-UX-018`)
- **FR-009**: An address that already holds an outstanding invitation MUST be refused inline and MUST offer resend in place of a second invitation. (§3.9)
- **FR-009a**: At most one unspent invitation MUST exist per case-folded address, enforced by a unique index over unspent invitation rows rather than by a read the mutator performs before writing. Two admins inviting one address concurrently MUST yield exactly one invitation row and one mailed link; the losing write MUST fail on that constraint and MUST be presented as FR-009's resend offer rather than as an error. The index MUST be scoped to unspent rows, so the invariant states the live offer alone and does not depend on acceptance retaining its row (FR-031). (§3.9)
- **FR-010**: Every address comparison this feature makes — against accounts and against invitations — MUST fold case, matching the uniqueness rule the account address already carries. (`OT-INV-016`)
- **FR-011**: Submitting MUST run one `inviteUser` call, close the modal and place the new invitation at the head of the list; Cancel or Escape MUST close the modal, discard the field and write nothing. A press outside the dialog MUST NOT close it, so a typed address is discarded only by an explicit act. (§3.9)
- **FR-012**: `inviteUser`, `resendInvite` and `revokeInvite` MUST each require `isAdmin`, enforced on the server whatever the client rendered; a member MUST NOT be able to invite. (§2, `OT-SEC-003`)
- **FR-013**: An invitation MUST mail a link that is single-use and valid for seven days. (`OT-SEC-003`, §6)
- **FR-013a**: The message MUST carry the installation it invites the reader to, the fact that an administrator issued the invitation, the link, and the instant the link runs out — and nothing further. It MUST NOT name the issuing admin, MUST NOT name any other account, and MUST NOT disclose the size or the composition of the team, because it reaches an address that may not belong to the person it was meant for. (§3.9, `OT-SEC-018`)
- **FR-014**: The invite token MUST be 32 random bytes stored as a SHA-256 digest, so no two secrets are ever compared. (`OT-SEC-006`)
- **FR-015**: Invite secrets MUST NOT be reachable from any read endpoint. (`OT-DATA-006`)
- **FR-016**: An invitation MUST grant a login and never project membership; no project-level invitation, pending membership or acceptance step for a project MUST exist. (§6, `OT-SCOPE-005`)
- **FR-017**: A mail failure MUST be reported to the issuing admin and MUST leave the invitation standing, with resend as the remedy. (§4, *Rejected write*)

#### The invitations list

- **FR-018**: The tab MUST list every invitation not yet accepted or revoked, newest first, each showing the address, who invited them, when it was sent and when it expires. Newest first MUST be a total order: where two invitations share a sent instant, a stable tiebreak MUST fix which precedes the other, so two renders of one data set never disagree. (§3.9)
- **FR-019**: Each listed invitation MUST carry **Resend** and **Revoke**. (§3.9)
- **FR-020**: `resendInvite` MUST reissue the link and restart the seven days; the previously mailed link MUST stop working, so an invitation has exactly one live link at any moment. (§3.9)
- **FR-020a**: Where a resend and an acceptance of one invitation reach the server together, exactly one MUST take effect on the row. An acceptance landing first MUST leave the invitation spent and MUST cause the resend to be refused with nothing written and no mail sent; a resend landing first MUST leave the holder of the superseded link in FR-032's unknown state. (§3.9, FR-020, FR-031)
- **FR-021**: `revokeInvite` MUST invalidate the token immediately and drop the row. (§3.9)
- **FR-021a**: An invitation MUST be dropped or spent and never both. `revokeInvite` MUST load the row and refuse where it has already been accepted, writing nothing, so revoke can never delete the spent row FR-031a retains; a revoke landing first MUST leave the acceptance in FR-032's unknown state. `revokeInvite` and `resendInvite` MUST each refuse where the row is not found. (§3.9, FR-021, FR-031a)
- **FR-022**: An expired invitation MUST stay listed, marked expired, with resend still offered. The marking MUST be carried by text on the row rather than by colour alone. (§3.9)
- **FR-023**: An empty list MUST be one quiet line reading "No outstanding invitations", with no illustration. (§3.9, `OT-UX-007`)

#### Accepting an invitation

- **FR-024**: `/invite/accept?token=…` MUST be reachable by an unauthenticated caller. With this route open, exactly four such routes exist — sign-in, the reset request, the reset submission and invitation acceptance — and no fifth MUST be opened. (`OT-SEC-002`)
- **FR-024a**: The token travels as a query parameter, as entry R1's reset link already does, and what bounds that exposure MUST be stated rather than assumed. The secret is single-use (FR-031), lives seven days (FR-013) and is held only as a digest (FR-014), so a copy recovered from a browser history resolves to FR-032's used or expired state once it has been taken or its seven days are up. The residual is the window before either: an unspent link inside its seven days works for whoever holds it, which is the same exposure entry R1 accepts for the reset link and the reason both are short-lived. The token MUST NOT be written to any server log, and the acceptance screen MUST NOT carry it into any outgoing reference. (§3.1, FR-014)
- **FR-024b**: The route MUST render whatever session the caller holds, as `/signin` does and for the same reason. Acceptance MUST write a new session row and set the cookie to it; a session the caller already held MUST NOT be reused or extended, and MUST NOT be deleted — it expires or is swept on its own terms, which is the rule entry R1 already fixes for a second sign-in. (§3.1, `OT-SEC-002`)
- **FR-025**: The screen MUST render outside the shell, as sign-in does — no sidebar and no header. (§3.1, `OT-UX-001`)
- **FR-026**: It MUST carry a first name, a last name and one password the user chooses, with the invited address shown as a value rather than a control. (§3.1, `OT-UX-010`)
- **FR-027**: The password MUST be held to the same policy as every other entry point — at least twelve characters, no composition rules, refused if on the common-password blocklist — enforced on the server whatever the client checks. (`OT-SEC-004`, `OT-SEC-019`)
- **FR-028**: Submitting MUST create the `user` row and sign the person straight in, writing a session and setting the session cookie entry R1 defines, landing them on `/home`. (§3.1, §3.2)
- **FR-028a**: While that write is outstanding the acceptance control MUST show in-flight state and MUST NOT take a second submission, so the one write in this feature that both creates an account and authenticates cannot be run twice by a second press. (§4, FR-059)
- **FR-029**: The created account MUST carry the `member` role. No screen this feature delivers MUST set a role, and role changes MUST stay reachable only from the command line. (`OT-AUTHZ-011`)
- **FR-030**: The created account MUST NOT carry the must-change-password flag, which is set only on the seeded first admin. (§5, §6)
- **FR-031**: Acceptance MUST spend the invitation so the link cannot be used a second time, and the invitation MUST be retained in that spent state rather than deleted, so a used link is distinguishable from an unknown one. (§3.1)
- **FR-031a**: A spent invitation MUST be retained indefinitely and MUST NOT be swept. Its row and its token digest are what answer "used" for that link, so no age at which a used link begins to render the unknown state MUST exist. (§3.1, FR-031)
- **FR-031b**: What a spent invitation retains MUST be no more than the account it created already holds — the address, the issuing admin and the two instants. No erasure path MUST exist for it, because no account is erased either (`OT-INV-017`), and the row discloses to an admin nothing the Accounts roster does not already show them. A revoked invitation retains nothing, its row having been dropped (FR-021). (§3.9, FR-031a)
- **FR-032**: An expired token, an already-used token and an unknown token MUST each render their own explanatory state, distinguishable from one another. A revoked invitation's token MUST render the unknown state, its row having been dropped. (`OT-SEC-016`, §3.9)
- **FR-033**: The route MUST NOT read or disclose any `user` record; the address it shows MUST come from the invitation. (`OT-SEC-018`)
- **FR-034**: Acceptance MUST be refused where the invited address has since acquired an account, so one address can never yield two accounts. The refusal MUST name that the address already has an account and MUST direct the person to sign in. That this discloses an account exists is not an enumeration leak and MUST NOT be treated as one: the person holds a token this installation issued for that very address, which is the same reasoning that lets entry R1 name a closed account to a caller who has proved its password — the disclosure is bounded by a secret rather than offered to anyone who asks, which is what `OT-SEC-011` forbids. (`OT-INV-016`, §3.1)
- **FR-035**: No route other than acceptance and first-run seeding MUST bring an account into being; there MUST be no public sign-up and no open registration form. (`OT-SEC-003`)

#### The accounts roster

- **FR-036**: The Accounts tab MUST list every account on the team, active accounts first and closed accounts after them. Ordering inside each group MUST be computed on the server under one fixed collation that does not vary with the reader's locale, so two admins reading the same roster see one order; where two accounts share a display name the tie MUST be broken by the address, which is unique. The roster MUST NOT need an empty state: an admin reading it is on it, and FR-049 keeps at least one active account on the installation at every moment. (§3.9, FR-049)
- **FR-037**: Each row MUST show an avatar and display name, the email, the account role, the joined date and a project count. (§3.9)
- **FR-038**: A display name MUST be the first and last name joined with a space, here as everywhere in the app. (`OT-UX-019`)
- **FR-039**: The email this roster shows MUST come from the `accountUser` projection, which only this screen and a user reading their own row may use; every other read of a `user` row MUST use the `publicUser` projection. (`OT-DATA-005`)
- **FR-040**: The project count MUST read project-membership rows only, so an admin is counted only for projects they were added to explicitly. Until entry R5 creates those rows it MUST report zero for every account. (`OT-AUTHZ-006`)
- **FR-041**: The joined date MUST be the instant the account came into being. (§3.9)
- **FR-042**: Each row MUST carry exactly one control — **Deactivate** on an active account, **Reactivate** on a closed one — and no control on this screen MUST set a role. (§3.9, `OT-AUTHZ-011`)

#### Closing and reopening an account

- **FR-043**: `deactivateUser` and `reactivateUser` MUST each require `isAdmin`, enforced on the server. (§2)
- **FR-044**: Each MUST ask for confirmation once. Deactivation's MUST name what stays — memberships, assignments, comments and activity. Reactivation's MUST name what it restores — sign-in and picker eligibility, with the memberships the account already had — and MUST say that no new link and no invitation is issued. (§3.9, FR-047, FR-051)
- **FR-045**: Deactivation MUST record the account as closed and MUST delete every session row for it, so reads and writes stop on that account's next request everywhere, on every device. (`OT-SEC-013`, §6)
- **FR-045a**: An admin MUST be permitted to close their own account where they are not the last active admin, FR-049's active-admin count being the only guard the source states. Their own sessions go with every other, so the response to that write MUST return them to `/signin`, as every request they make afterwards does. (§3.9, FR-049)
- **FR-045b**: `deactivateUser` MUST refuse an account already closed and `reactivateUser` MUST refuse one already active, each writing nothing. Neither is a no-op: a row carries exactly one control (FR-042), so a call for the state the account already holds is a disagreement between client and server, and FR-061 makes the server the side that settles it. (§3.9, FR-042)
- **FR-046**: A closed account's next sign-in MUST be refused with the closed-account message rather than the generic one. (`OT-SEC-013`, §3.1)
- **FR-047**: Deactivation MUST remove nothing. Memberships, assignments, comments and activity MUST all survive, and the account's name MUST still render everywhere it already did. (`OT-SEC-013`, `OT-AUTHZ-014`)
- **FR-048**: A closed account MUST be excluded from every picker — project member, assignee and `@mention`. This feature delivers no picker; the exclusion takes effect in each as that picker lands, with entries R5, R6 and R7. (§3.9)
- **FR-049**: A deactivation that would leave the installation with no active admin MUST be refused, counting active admins under a row lock in the same transaction as the change, so two concurrent attempts cannot both succeed. (`OT-INV-013`)
- **FR-050**: On the last active admin's row, the Deactivate control MUST render disabled with its reason stated inline, and MUST NOT be hidden. The reason MUST read "The last active admin can't be deactivated." The control MUST stay reachable by keyboard and its reason MUST be associated with it programmatically, so the reason reaches a reader who never sees the text beside it; a tooltip MUST NOT be the only place it appears. (§3.9, `OT-UX-002`, `OT-UX-018`)
- **FR-051**: Reactivation MUST restore sign-in and picker eligibility with the memberships the account already had, and MUST issue no new invitation and no new token. (§3.9, §6)
- **FR-051a**: Where a deactivation and a reactivation of one account reach the server together, both MUST serialise on that account's row, so it is left in one of the two states and never between them. Sessions a deactivation deleted MUST NOT be restored by a reactivation that follows it: FR-051 restores access, not sign-ins, and the holder signs in again. (§3.9, FR-045, FR-051)
- **FR-052**: Neither deactivation nor reactivation MUST write an activity record or notify anyone, and neither MUST touch a project or a project membership. (§3.9)
- **FR-053**: The account's current state MUST be the only state recorded; no history of state changes and no acting admin MUST be retained in v1. (§3.9)

#### Cross-cutting UX conventions, first implemented here

Entry R2 fixes these four as rules and writes no code for them, having no writing or data-loading surface to exercise them; they land with the slice holding their first caller. This feature is that slice, and holds them whichever entry is built first — see *Assumptions → Reconciliations*. No user journey above is *about* them, but each is exercised by one and carries its acceptance scenarios there: story 1 scenarios 12 to 14 for the toast, the in-flight state, the skeleton and the connection banner; story 3 scenario 9 for re-query on return; story 4 scenario 13 for a rejected write.

- **FR-054**: Toasts MUST be four kinds — success, info, warning, error — rendered top-right, stacked and auto-dismissing. (`OT-UX-016`)
- **FR-055**: Loading MUST use per-screen skeletons matching the layout they replace; a full-screen spinner MUST NOT be used and data landing MUST NOT shift layout. (`OT-UX-005`)
- **FR-055a**: A screen read that fails MUST replace the panel it feeds with an explanatory state naming that the data could not be loaded and offering a retry. A failed read MUST NOT render as an empty list, and MUST NOT leave FR-055's skeleton standing indefinitely. (§4, FR-055)
- **FR-056**: A revisited screen MUST re-query the server; nothing MUST render from a client cache. (`OT-UX-006`)
- **FR-057**: A lost connection MUST show one banner and MUST refuse writes with "Changes need a connection"; nothing MUST be queued for later. (`OT-UX-017`)
- **FR-058**: A rejected write MUST roll back and raise a toast naming what failed and why. (§4)
- **FR-059**: Every write on this screen MUST wait for the server and show in-flight state on its own control rather than applying optimistically. (§4, *Slow write*)

#### Server boundary

- **FR-060**: Every mutator this feature adds MUST validate its input and enforce its predicate on the server, deriving the subject account or invitation from the stored row rather than from a client-supplied identifier. (`OT-AUTHZ-004`)
- **FR-061**: The client MAY run the same predicate to disable a control, but the server check MUST be the enforcement and the client check MUST NOT be. (`OT-AUTHZ-005`)
- **FR-062**: Losing the admin role mid-session MUST remove no rows; the screen's controls MUST become disabled on the next render and the server MUST refuse the mutators. (`OT-AUTHZ-012`)
- **FR-063**: Responses to a caller MUST carry generic messages; database errors, stack traces and configuration MUST stay in the server log.

### Out of Scope

Deferred by the roadmap's R3 boundary, or excluded by the specification, and named here so no scenario above is read as covering them:

- **Role changes of any kind from a screen** — CLI-only in v1 (`OT-AUTHZ-011`). The roster shows a role and never edits one.
- **Project membership, the Add member picker, and adding an accepted user to a project** — entry R5. An invitation grants a login and nothing more; joining a project is a separate, later act by an admin on project details.
- **Project-level invitations** — out of scope for v1 entirely (`OT-SCOPE-005`), not deferred to a later entry.
- **A route to view another user's profile** — none exists (§3.12). The Accounts roster is the only place one person sees another's email, and entry R4 delivers the signed-in user's own record.
- **A team-settings screen** — out of scope (`OT-SCOPE-005`); this screen is what remains of it.
- **Deleting a user** — no such path exists; closure is the deactivation instant and nothing else (`OT-INV-017`).
- **Any audit trail of account state changes** — §3.9 states none is retained in v1.
- **The sidebar's Accounts entry that reaches this screen**, hidden for non-admins — entry R2 (`OT-UX-003`).
- **Notifying anyone of an invitation, an acceptance or a deactivation** — entry R11 delivers notifications, and its three types are `mention`, `assignment` and `comment` (`OT-OPS-004`).
- **Bulk invitation, address lists and import of any kind** — the form takes one address.
- **A retry sweep for invitation mail.** The in-process timer entry R1 delivers sweeps attempt rows, and entry R11 adds notification-mail retries to it; an invitation is mailed once and resent by hand.

### Key Entities

- **Invitation** — a standing offer of a login to one address, and afterwards the permanent record that the offer was taken. Carries the address, the admin who issued it, when it was issued, when it expires, whether it has been spent, and the digest of its single-use token. Exactly one live link at a time: reissuing replaces it. At most one unspent row exists per case-folded address, held by a unique index over unspent rows rather than by a check the mutator makes. Dropped by revoke; retained indefinitely after acceptance and never swept, so a spent link can be told from an unknown one however long ago it was used. Its secret is never reachable from a read endpoint.
- **Account** — entry R1's `user` record. This feature adds the second and last way one comes into being (acceptance, the first being first-run seeding) and the screen that closes and reopens one. Never deleted; closure is a deactivation instant. Its joined date is its creation instant.
- **Session** — entry R1's record of one live sign-in. This feature deletes every row for an account when that account is closed, and writes one when an invitation is accepted.
- **Project membership** — named only because the roster counts it. No such row exists until entry R5, so the count this feature renders is zero for every account.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can take a colleague from having no account to being signed in and reading, using only this screen and the colleague's inbox — no SQL, no SSH and no console — in under five minutes of admin time.
- **SC-002**: 100% of accounts on an installation originate from either an invitation an admin issued or the first-run seed; no sequence of requests to the four public routes creates one by any other means.
- **SC-003**: An invitation link stops working the moment it is used, revoked, resent, or seven days old — verified in all four cases.
- **SC-004**: A person landing on a dead link can tell which of the three things happened — used, expired, or not a link this installation issued — without asking an admin, at any age of link: no retention horizon exists past which a used link starts reporting itself as unknown.
- **SC-005**: One address yields at most one account, however many invitations were issued for it and however many acceptances are attempted at once.
- **SC-006**: An admin can answer, from one screen and without scrolling to a second, who is on the team, what role each holds, when each joined, and which addresses have been offered a login and not taken it.
- **SC-007**: Closing an account stops that person's reads and writes by their next request, on every device they were signed in on, while leaving 100% of the content they authored in place and still rendering under their name.
- **SC-008**: The installation can never be left with zero active admins, including when the last two are closed concurrently.
- **SC-009**: Reopening a closed account restores exactly what it had — the same role, the same memberships and the same access — with no new link, no re-invitation, and no step asked of the account holder beyond signing in with the password they already had.
- **SC-010**: An admin is told about a duplicate address — one that already has an account, or one already invited — before they submit, and is offered the remedy that fits, in 100% of both cases.
- **SC-011**: Every failed write on this screen leaves the screen truthful: the change is rolled back and a message names what failed and why.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **A resend issues a new secret, and the previously mailed link dies.** §3.9 says resend "reissues the link and restarts the 7 days"; reissue is read as a new token rather than a second mailing of the same one, so an invitation has exactly one live link at any moment. The alternative — resending the same secret with a later expiry — would leave the count of live links unbounded and is not what "reissues" says.
- **A revoked invitation's link renders the "unknown" state.** Revoke drops the row (§3.9), and §3.1 names three token states and no fourth; with no row there is nothing to call revoked.
- **Acceptance lands the new account holder on `/home`**, the destination sign-in uses (§3.2). §3.1 says acceptance "signs them straight in" without naming a page.
- **Acceptance retains the invitation, marked spent; only revoke deletes a row.** This is forced rather than chosen: telling a used link from an unknown one (§3.1) requires the row to survive acceptance. A retained spent row leaves the list, which shows only invitations "not yet accepted or revoked". Retention is indefinite (FR-031a): any sweep horizon would turn a used link into an unknown one past that age, which is the one distinction §3.1 asks this row to preserve.
- **An invited account is created as a `member`.** The invite form carries one field, an address (§3.9), and no UI may set a role (`OT-AUTHZ-011`).
- **The acceptance form carries one password field, not two.** §3.1 gives the New/Confirm pair to Change password and describes acceptance as "a password the user chooses".
- **A mail failure is surfaced to the issuing admin and leaves the invitation standing.** §3.9 is silent. The admin is the caller here, unlike the reset request whose answer must not vary with whether the address exists (`OT-SEC-011`), so there is nothing to conceal and Resend is the remedy already on the row.
- **Within each group the roster is ordered alphabetically by display name.** §3.9 fixes active before closed and states no order inside either group.
- **The invitations list is ordered newest first.** §3.9 has a new invitation appear "at the top of the list".
- **Revoke stays offered on an expired invitation**, alongside resend. §3.9 puts both controls beside each listed invitation and calls out resend on an expired row only to make clear that expiry removes no remedy.
- **Writes on this screen wait for the server rather than applying optimistically.** `OT-UX-008` makes small local gestures optimistic — drag, status, assignee, in-place field edits — and every write here is either a create with a server-assigned expiry or an account-state change gated by a confirmation, neither of which is that gesture.
- **The invitation token travels in the query string, and that is accepted rather than overlooked.** §3.1 gives the reset link the same shape and entry R1 built it that way, so a second convention here would be the drift, not the fix. What makes it acceptable is stated in FR-024a rather than left implicit: single use, seven days, digest-only storage, never logged, and never carried into an outgoing reference — so a copy recovered later from a history resolves to used or expired rather than to an account.
- **A press outside the Invite modal does not dismiss it.** §3.9 names Cancel and Escape and no third way out. Discarding a typed address is a deliberate act everywhere else on this screen, and a stray click is not one.
- **A redundant account-state change is refused rather than treated as a no-op.** §3.9 gives each row exactly one control, so a call for the state an account already holds did not come from the roster as rendered. `OT-AUTHZ-005` makes the server the enforcement, and a server that quietly accepts a write it was never offered is not enforcing anything.
- **An admin may close their own account** where they are not the last active one. The only guard the source states is the active-admin count (`OT-INV-013`), and the closure takes their own sessions with it.

### Reconciliations between the roadmap and the specification

- **This feature implements the four cross-cutting UX conventions entry R2 fixed as rules, and does so unconditionally.** R2's boundary originally deferred toasts, per-screen skeletons, re-query on navigation and the connection-lost banner to whichever of R3 and R4 was built first. Ownership is settled on R3 rather than left to build order, on three grounds. R3 holds the first caller for each — a create, two account-state writes, a list load and a roster load — while R4's one write is an in-place field edit on a screen R2's conventions already frame. R2 itself broke the same tie the same way for the fifth deferred convention, disabled-control-with-inline-reason, assigning it to R3 because R3 has the caller and R4 has no counterpart. And R4's spec already consumes the four as their second caller, stating that FR-031 to FR-034 there are obligations on that screen rather than a claim on who authored them. `docs/ROADMAP.md` is amended under §5 and entry R2 is reconciled to it, so FR-054 to FR-059 stay in this feature whatever order the team builds in. Under Principle I each is implemented for its own first caller here; the shared primitive behind it is extracted when R4 lands as the second caller.
- **The "link to it" beside an already-registered address is an in-page control reaching that account's row on the Accounts tab.** §3.9 offers "a link to it" and, four sentences earlier, states that the tab is "local page state, not a route — there is nothing to link to"; §3.12 adds that no route exists to view or edit anyone else's profile. Both hold only if the affordance is not an anchor: the Accounts roster is the one surface in the product that shows another user's account, and it is reached by moving the page's own tab state rather than by navigating. FR-008 states the resulting behaviour so it is testable without a router.
- **`OT-SEC-013` is completed here.** Entry R1 delivered its session-deleting half through the `admin:deactivate` command; this feature delivers the screen mutator and states the membership retention, which has no rows to retain until entry R5.
- **`OT-SEC-016` is completed here.** Entry R1 delivered the three token states for Change password; this feature delivers them for Accept invite.
- **`OT-SEC-002`'s fourth public route opens here.** Entry R1 opened three and recorded that the fourth stays closed until R3.
- **`OT-AUTHZ-006` is satisfied here for the Accounts project count only.** The project-details roster and the Create-project member chips are entry R5's, and each will cite the same rule.
- **The active-admin lock is shared, not duplicated.** Entry R1 established it for `setUserRole` and `admin:deactivate`; this feature's `deactivateUser` uses the same mechanism rather than a second one, which is what makes `OT-INV-013` hold across both paths under concurrency.
- **The roster's project count renders zero for everyone until entry R5.** The roadmap states it "reads `project_member` rows and reads zero until then"; the column is present and its assertion in this feature's tests is that zero.

### Inherited constraints, not decisions this specification makes

- Entry R1's session record, session cookie, password policy, blocklist, token-digest convention and address folding are reused here rather than redefined; this feature adds an entry point to each, not a variant of it.
- Entry R2's shell hosts this screen, its Forbidden screen answers a non-admin, its sidebar carries the Accounts entry hidden for non-admins, and its display-name and disabled-with-inline-reason conventions apply here. R2 has no child spec yet, so this feature depends on the roadmap's statement of R2 rather than on a written design.
- The mail transport is the operator's own SMTP, wired up by entry R1.
- The persistence rules this feature relies on — the address uniqueness fold, the active-admin row lock and the session cascade — are database-enforced, so their tests run against a real PostgreSQL instance on a separate database, never a mock.
- This feature adds no dependency: mail, hashing and time-ordered keys are already in the approved table in `AGENTS.md`.

### Dependencies

- **Roadmap position**: R3 depends on R1 (identity, sessions, the password policy, the token conventions, the mail transport and the active-admin lock) and on R2 (the shell, Forbidden, the hidden admin navigation and the app-wide UX conventions). Entry R5 depends on R3.
- **Downstream reach-back into this feature**: none. Later entries consume what this feature establishes — R5's `project_member` rows give the roster's count real numbers, and R5, R6 and R7 each apply the closed-account exclusion as their own pickers land — but no later entry adds behaviour to a mutator delivered here.
- **Operator-supplied**: an SMTP host, without which invitations are created but not delivered.
