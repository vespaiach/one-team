# Feature Specification: Profile

**Feature Branch**: `claude/roadmap-entry-r4-spec-e59732`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R4**

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "create feature specification for Roadmap Entry R4. Refer to docs/ROADMAP.md -> Entry R4, docs/product/requirements-index.md and docs/product/specifications.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R4** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A signed-in user maintains their own record (Priority: P1)

Someone signed in opens their profile from the user chip in the sidebar. Their avatar, names, job title, Slack handle, phone and bio are on the page as plain values. They click one, it becomes a field, they change it, and it saves the moment they leave the field — no edit mode, no form, no submit button. If the server refuses, the old value comes back and a message says why.

**Why this priority**: It is the entire feature. Every other story on this screen either protects this one or hangs off it, and a user who cannot correct their own name has no route to correcting it anywhere else in the product.

**Independent Test**: Sign in as any account, open `/profile`, and change each of the seven writable fields in turn. Confirm each save is one write of that field alone, that Escape abandons an edit untouched, and that a refused write restores the previous value with a message. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** a signed-in user on their profile, **When** they click their job title, **Then** it becomes an editable field carrying the current value.
2. **Given** a field being edited, **When** the user presses Escape, **Then** the previous value returns and nothing is written.
3. **Given** a field being edited with a changed value, **When** the field loses focus, **Then** the change is written and the field returns to a shown value.
4. **Given** a field being edited with a changed value, **When** the user presses ⌘-enter, **Then** the change is written without waiting for focus to move.
5. **Given** a user who edits their job title and then their phone, **When** both saves complete, **Then** exactly two writes were made, one per field, and neither carried the other's value.
6. **Given** an accepted edit, **When** it is made, **Then** the new value appears immediately and before the server has answered.
7. **Given** an edit the server refuses, **When** the refusal arrives, **Then** the displayed value returns to what the server holds and a message names what failed and why.
8. **Given** the first name field being edited, **When** it is left empty or as whitespace alone, **Then** an inline error renders on that field and nothing is written.
9. **Given** the last name field, **When** it is left empty, **Then** the same inline error behaviour holds.
10. **Given** the job title, Slack handle, phone or bio field, **When** it is emptied, **Then** the empty value saves and the field returns to its empty presentation.
11. **Given** a Slack handle or a phone number in any format, **When** it is saved, **Then** it is accepted as typed with no format rule applied.
12. **Given** a bio containing markdown syntax, **When** it is saved and shown again, **Then** the characters render exactly as typed and no markdown is interpreted.
13. **Given** a field edited to the value it already held, **When** it is saved, **Then** nothing is written.
14. **Given** a value longer than that field's bound, **When** it is submitted, **Then** the server refuses it and nothing is stored.
15. **Given** an avatar field, **When** an ordinary web link is saved, **Then** it is stored as typed with no attempt to fetch it.
16. **Given** an avatar field, **When** a value carrying any other scheme is submitted, **Then** it is refused with an inline error and nothing is stored.

---

### User Story 2 - The record is theirs alone (Priority: P2)

The profile is one person's own record and there is no way to reach anyone else's. An admin has no more access to it than a member. The screen serves whoever is signed in, and the write behind it works out whose row to touch from the session rather than from anything the browser sends.

**Why this priority**: It is the half of this entry's intent — "and nobody else's" — that a bug would silently break. It ranks below the editing journey only because a screen that cannot be used has nothing to protect.

**Independent Test**: Sign in as a member and as an admin in turn, and confirm each sees only their own record. Then issue the profile write naming a different user's identifier and confirm the caller's own row is what changes, or the write is refused, and the named row is untouched.

**Acceptance Scenarios**:

1. **Given** any signed-in user, **When** they open the profile route, **Then** the record shown is their own.
2. **Given** an admin, **When** they open the profile route, **Then** they see their own record and no control to reach another user's.
3. **Given** any signed-in user, **When** they look for a route to another user's profile anywhere in the product, **Then** none exists.
4. **Given** a profile write, **When** it carries an identifier for a different user, **Then** that user's row is unchanged.
5. **Given** a profile write, **When** it is made, **Then** the row it touches is the one the session resolves to.
6. **Given** no session, **When** the profile route is requested, **Then** the request redirects to sign-in and never reaches the Forbidden screen.
7. **Given** a user deactivated while signed in, **When** their browser next requests the profile route, **Then** it redirects to sign-in.

---

### User Story 3 - Email and account role are facts, not fields (Priority: P3)

The user's email address and their account role are on the page because they are worth knowing. Neither can be changed here, and neither pretends it could: they render as values, the same way an issue's key or a project's key does elsewhere in the product.

**Why this priority**: It prevents the most likely wrong build of this screen — one where every attribute on the row becomes a field. It sits below the access boundary because getting it wrong is visible, not silent.

**Independent Test**: Open the profile and confirm the address and the role are shown, that neither responds to a click the way an editable field does, and that no sequence of interactions on this screen changes either one.

**Acceptance Scenarios**:

1. **Given** a signed-in user on their profile, **When** the page renders, **Then** their email address and account role are shown as values, not as controls.
2. **Given** the email value, **When** it is clicked, **Then** it does not become an editable field.
3. **Given** the account role value, **When** it is clicked, **Then** it does not become an editable field.
4. **Given** any interaction available on this screen, **When** it completes, **Then** neither the account role nor the email address has changed.
5. **Given** a member and an admin, **When** each opens their profile, **Then** the role shown is the one their row carries and the presentation is identical in both cases.

---

### User Story 4 - Changing a password without leaving the app (Priority: P4)

A signed-in user wants a new password. They press one link on their profile, type nothing, and are told to check their mail. The link they receive is the same one a forgotten password produces, lands on the same screen, and is held to the same policy and the same rate limit. Finishing it signs them out everywhere, including the browser they started from.

**Why this priority**: It is the only in-app route to a password change, but it delivers no mechanism of its own — every part of it exists already and this feature adds the door. Below the record itself because a user with no route here can still recover from the sign-in screen.

**Independent Test**: Press the link as a signed-in user and confirm mail is sent to that user's own address with no address typed and a confirming message shown. Follow the link, set a new password, and confirm the originating browser is signed out on its next action. Press the link six times inside the window and confirm the sixth is refused with the time remaining.

**Acceptance Scenarios**:

1. **Given** a signed-in user on their profile, **When** they press the change-password link, **Then** a reset link is mailed to their own address and no form is shown.
2. **Given** that press, **When** it succeeds, **Then** a message reads "Check your email for a link to reset your password."
3. **Given** that press, **When** it is made, **Then** the user is not asked to type an address.
4. **Given** the mailed link, **When** it is opened, **Then** it lands on the same change-password screen the forgotten-password flow reaches, outside the shell.
5. **Given** that screen, **When** a password below the policy is submitted, **Then** it is refused by the same policy that applies at every other entry point.
6. **Given** a completed change, **When** it succeeds, **Then** every session for that user ends, including the one that made the request.
7. **Given** the browser that made the request, **When** it takes its next action after the change completes, **Then** it is returned to the sign-in screen.
8. **Given** five change-password requests for one address inside the window, **When** a sixth is pressed, **Then** it is refused and the message states the time remaining.
9. **Given** an account still carrying the must-change-password flag, **When** its holder completes a change started from this link, **Then** the flag is cleared.
10. **Given** a signed-in user whose address is locked out of sign-in, **When** they press the change-password link, **Then** the request is answered normally.

---

### User Story 5 - A corrected name follows the user everywhere (Priority: P5)

Someone changes their first or last name. Everywhere the product writes a person's name, the new one appears from then on — the name is one value on one row, joined the same way in every place that renders it.

**Why this priority**: The rule matters across the whole product but has few surfaces to observe at this point in the roadmap, so it is verified narrowly here and inherited widely later.

**Independent Test**: Change the first name, then the last name, and confirm the profile itself and the sidebar's user chip both render the new pair joined with a single space on their next render, with no reload of the application needed beyond the screen's own re-query.

**Acceptance Scenarios**:

1. **Given** a user with a first and last name, **When** their display name is rendered anywhere, **Then** it is those two joined by a single space.
2. **Given** a changed first name, **When** each surface that renders a display name next renders, **Then** it shows the new name.
3. **Given** a changed last name, **When** the profile is revisited, **Then** the page queries the server again and shows the stored name rather than a remembered one.
4. **Given** a name changed to values with surrounding whitespace, **When** it is saved, **Then** the stored value is trimmed and the rendered display name carries exactly one space between the two parts.

---

### Edge Cases

- **A required field emptied and then abandoned.** Escape from an invalid edit restores the stored value; the field never persists an empty required name and never leaves the screen in an unsaveable state.
- **Two fields edited in quick succession** produce two independent writes; neither carries the other's value and a failure of one does not roll back the other.
- **A refused write while a second field is being edited** rolls back only its own field and leaves the in-progress edit alone.
- **The connection is lost mid-edit.** A banner appears, the write is refused with "Changes need a connection", and nothing is queued to be sent later.
- **A field at exactly its bound** saves; one character beyond it is refused by the server, whatever the browser allowed.
- **An avatar link that does not resolve, or does not point at an image**, is stored as given — the value is a link, and nothing fetches it to find out.
- **An avatar value carrying a script or inline-data scheme** is refused before storage, so the stored value can only ever be an ordinary web link.
- **A bio containing what looks like markdown, or what looks like HTML,** is stored and rendered as characters — this field has no markup of any kind.
- **A profile edit produces no activity record and no notification for anybody**, including the user making it: activity attaches only to a project or an issue, and there is no user-level feed to write to.
- **A rename does not rewrite history that has already been written.** Feed rows that froze a display name at write time keep the name they froze; mention tokens, which hold an identifier rather than a name, follow the rename. Neither surface exists until entry R7 — the consequence is named here, not built here.
- **An admin editing their own profile** follows exactly the same rules as a member editing theirs; the account role changes nothing about this screen except the value it displays.
- **Change password pressed twice in quick succession** sends two links; both are valid until one is used or they expire, and the rate limit is what stops a third and a fourth.
- **A change-password request that cannot be mailed** — the mail host is unconfigured or unreachable — is reported to the user in the same terms as any other failure on this screen, and the failure detail stays in the server log.
- **The seeded first admin** uses this link like anyone else; it is one of the two paths that clears the must-change-password flag.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings.

### Functional Requirements

#### The screen

- **FR-001**: A full-page screen MUST exist at `/profile`, rendered inside the persistent shell, reached from the sidebar's user chip. (§3.12, §3, `OT-SCOPE-007`, `OT-UX-001`)
- **FR-002**: The screen MUST show and edit the signed-in user's own record and no other. No route, control or parameter MUST exist anywhere in the product that shows or edits another user's record. (§3.12, roadmap **R4**)
- **FR-003**: The screen MUST read its own row through the shared `accountUser` projection — the public fields plus email, Slack handle, phone and bio — and MUST NOT select the user table directly. (`OT-DATA-005`)
- **FR-004**: Wherever this screen renders a user's display name, it MUST be their first and last name joined with a single space, the same rule that holds everywhere else in the app. (`OT-UX-019`)
- **FR-005**: An unauthenticated request to this route MUST redirect to sign-in and MUST NOT reach the Forbidden screen. (`OT-SEC-015`)

#### The record and its fields

- **FR-006**: Exactly seven fields MUST be writable here: avatar URL, first name, last name, job title, Slack handle, phone and bio. (§3.12)
- **FR-007**: First name and last name MUST be required and trimmed; a save leaving either empty MUST render an inline error on that field and MUST write nothing. (§3.12, `OT-UX-011`)
- **FR-008**: Job title, Slack handle and phone MUST be optional free text accepted as typed, with no format rule applied to a handle or a phone number. (§3.12)
- **FR-009**: Bio MUST be optional, multi-line, and grow with its content. It MUST be plain text with no markdown: stored as typed and rendered as characters, never parsed as markup. (§3.12, `OT-DATA-016`)
- **FR-010**: The avatar MUST be a URL text field. There MUST be no upload control, no file picker and no stored file. (§3.12, §1)
- **FR-011**: An avatar value MUST be refused unless it is a well-formed absolute link carrying an ordinary web scheme; a refusal MUST render as an inline error on the field and MUST store nothing. Nothing MUST fetch the link to validate it. (§3.12, Principle II)
- **FR-012**: Every value MUST be trimmed before it is measured against its rule and before it is stored.

#### Editing behaviour

- **FR-013**: Editing MUST be in place and MUST behave exactly as it does on every other surface that offers it: click the value to make it a field, Escape reverts, blur or ⌘-enter saves, one mutator call per field. There MUST be no edit mode, no separate form and no submit button. (`OT-UX-009`, §3.12)
- **FR-014**: A save MUST apply optimistically and MUST roll back on refusal, showing a message naming what failed and why. (`OT-UX-008`, `OT-UX-016`)
- **FR-015**: A rollback MUST restore the value the server holds and MUST affect only the field that failed.
- **FR-016**: A save of a value identical to the stored one MUST write nothing.
- **FR-017**: Validation MUST be reported per field as the field is left, never as a wall of errors on a submit, and no control on this screen MUST go dead in response to an invalid value. (`OT-UX-011`)

#### The write

- **FR-018**: One mutator, `updateOwnProfile`, MUST serve this screen. It MUST require only self: neither authorization predicate MUST gate it, and no check beyond "this is the caller's own row" MUST exist. (`OT-AUTHZ-001`, §2)
- **FR-019**: The row `updateOwnProfile` writes MUST be derived from the session server-side, never from a client-supplied user identifier. (`OT-AUTHZ-004`)
- **FR-020**: `updateOwnProfile` MUST validate every value it receives on the server — presence for the required fields, the trim, the length bound, and the avatar's scheme — whatever the browser also checked, and MUST reject rather than coerce or truncate a value that fails. (Principle II)
- **FR-021**: `updateOwnProfile` MUST write only the seven fields of FR-006. It MUST NOT write the account role, the email address, the must-change-password flag or the remembered feed filter.
- **FR-022**: `updateOwnProfile` MUST write `updated_at` explicitly through the shared helper. (`OT-DATA-002`)
- **FR-023**: A failed write MUST return a generic message to the caller; the underlying detail MUST stay in the server log.

#### Fields that are shown, not edited

- **FR-024**: The email address and the account role MUST render as shown values rather than as controls, the same convention an immutable field follows elsewhere in the product. (`OT-UX-010`, §3.12)
- **FR-025**: No path on this screen MUST set an account role; role changes stay outside the product's UI in v1. (`OT-AUTHZ-011`, §2, §6)

#### Change password

- **FR-026**: A change-password link MUST sit on this screen. Pressing it MUST send a reset link to the signed-in user's own address, asking for no address and showing no form. (§3.12)
- **FR-027**: This feature MUST introduce no password field and no password rule of its own. The only password it can lead to setting is set on the change-password screen, under the single policy that applies at every entry point — at least twelve characters, no composition rules, checked against the blocklist. (`OT-SEC-004`, §3.1)
- **FR-028**: The link MUST reuse the same request-and-token mechanism and the same rate limit as the forgotten-password request, in that request's own counter. That counter MUST stay separate from the sign-in counter, so an address locked out of sign-in can still request the change and a refused change cannot block a sign-in. A refused request MUST state the time remaining. (§3.12, §3.1, §6, `OT-SEC-017`)
- **FR-029**: A successful press MUST confirm with the message "Check your email for a link to reset your password." (§3.12)
- **FR-030**: A completed password change MUST end every session for that user, including the one that requested it; that browser MUST return to sign-in on its next action. (`OT-SEC-012`, §3.1)

#### Loading, staleness and connection

The rules below are fixed for the whole application by entry R2, which states them and writes no code for them because the shell has no writing or data-loading surface. Profile has both, so it MUST honour each. Entry R3's spec claims first-caller ownership of the four, so this screen is their second caller and consumes what R3 leaves rather than standing up a parallel implementation — and under Principle I the second call site is where a shared primitive is extracted, if one is warranted. Should R4 nonetheless be built first, it implements them for its own screen and extracts nothing.

- **FR-031**: While the record is loading, the screen MUST render a skeleton matching the layout it replaces, never a full-screen spinner, and data landing MUST NOT shift the layout. (`OT-UX-005`)
- **FR-032**: A revisit to this screen MUST re-query the server; nothing MUST render from a client cache. (`OT-UX-006`)
- **FR-033**: Messages raised by this screen MUST be one of the four kinds — success, info, warning, error — shown top-right, stacked, and auto-dismissing. (`OT-UX-016`)
- **FR-034**: A lost connection MUST raise one banner and MUST refuse writes with "Changes need a connection"; nothing MUST be queued for later. (`OT-UX-017`)
- **FR-035**: Interaction behaviour, focus management, keyboard support and ARIA semantics MUST come from the accessible component library the product standardises on, with the styling layer supplying appearance only; every field MUST carry an accessible name and its error text MUST be associated with it. (`OT-UX-018`)

#### What this feature does not record and does not add

- **FR-036**: Editing a profile MUST write no activity record and MUST notify nobody. There is no user-level feed: activity attaches only to a project or an issue. (§3.12, `OT-INV-010`, `OT-DATA-009`)
- **FR-037**: This feature MUST introduce no table, no column and no migration. Every field it reads or writes already exists on the user record.

### Out of Scope

Deferred by the roadmap's R4 boundary, or absent from the product entirely, and named here so no scenario above is read as covering them:

- **Any route to view or edit another user's profile** — none exists in v1, by §3.12, and none is created here. A person's name, avatar and job title still surface contextually elsewhere without a page of their own.
- **Editing the account role or the email address** — role changes stay CLI-only (§2, §6) and the address is the login credential. Both are shown here and neither is editable anywhere in the UI.
- **`user.feed_filter`** — entry R7. The column exists on the row this screen reads, the projection this screen uses does not carry it, and this feature offers no control for it.
- **The change-password screen itself, the reset token, the mail that carries it and the throttle behind it** — entry R1. This feature delivers the link, not the mechanism.
- **The sidebar user chip that links here, and the shell that frames the page** — entry R2.
- **Avatar upload and any file storage** — out of scope for v1 in every form (§1).
- **Deactivating or reactivating an account, and the Accounts roster that reads the same contact fields** — entry R3.
- **Any activity record or notification for a profile change** — there is none by §3.12, not by deferral. No later entry reaches back into `updateOwnProfile` to add one.

### Key Entities

- **User** — the person signed in, and the only record this screen touches. It carries the seven fields this feature writes (avatar URL, first name, last name, job title, Slack handle, phone, bio), the two it shows without editing (email address, account role), and several it neither shows nor writes. The record already exists in full: this feature introduces no attribute of its own.
- **Actor** — not a table: the resolved answer to "who is making this request", produced fresh on every request. It is the only input to whose record this screen serves and whose row the write touches.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can correct any one of the seven writable fields in under thirty seconds, without leaving the page, submitting a form, or reloading anything.
- **SC-002**: Every accepted edit is present when the same user next opens the screen in a different browser — 100% of accepted edits, with no reliance on the first browser staying open.
- **SC-003**: After a refused edit, the value on screen equals the value the server holds in 100% of cases; no refusal leaves an optimistic value standing.
- **SC-004**: There is no address, control or request in the product by which one user can see or change another user's record — verified as a member and as an admin, against a member's row and an admin's row.
- **SC-005**: 0% of profile edits produce an activity entry, a notification, or an email for anyone.
- **SC-006**: The account role and the email address cannot be changed from this screen by any sequence of interactions available on it.
- **SC-007**: A user can start a password change in one press without typing their address, and is told what happens next in the same interaction.
- **SC-008**: Completing that change ends 100% of that user's sessions, on every device including the one that started it, by that device's next action.
- **SC-009**: A corrected name replaces the previous one on every surface that renders a display name, on that surface's next render, with no application reload required.
- **SC-010**: 100% of avatar values the system stores are ordinary web links; a value carrying any other scheme is refused before storage in 100% of attempts, whether it arrives from the screen or directly.
- **SC-011**: Six change-password presses inside the rate-limit window result in five mails and one refusal that states the time remaining.
- **SC-012**: The whole screen — every edit, save, revert and the change-password link — can be completed by keyboard alone, with each error announced against the field it belongs to.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **The avatar accepts only an ordinary web link.** §3.12 calls the field "a URL text field" and says nothing about which URLs. The value is rendered as an image source, so a script or inline-data scheme would be an injection vector, and Principle II requires the boundary to validate rather than trust. The scheme allowlist the product already applies to markdown link targets is reused rather than invented. A value failing it is an inline error, the same as any other per-field failure.
- **Nothing fetches the avatar link.** Reachability, content type and image dimensions are not checked; a link that stops resolving later keeps its stored value. The specification asks for a pasted link, not a verified asset.
- **Trimming applies to all seven fields, not only the two names.** §3.12 marks first and last name "trimmed" and is silent on the rest. Trimming everything keeps a job title from storing a single space and makes the required-field rule and the length bound mean the same thing on every field.
- **Clearing an optional field is a save, not an error.** §3.12 marks four fields optional without saying they are once-only, so emptying one stores the empty value and the field returns to its empty presentation.
- **A save of an unchanged value writes nothing.** The specification fixes one mutator call per field on save; a write that changes no value would still move `updated_at`, which is a change with no cause.
- **A rate-limited change-password press is refused with the time remaining.** §3.12 fixes only the success message. §3.1 fixes the throttle itself and the convention that a refusal states how long is left, and applies it to the reset request this link makes. The caller here is signed in and asking about their own address, so no account-existence concern shapes the wording.
- **The press sends immediately, with no confirmation step.** §3.12 says one click sends a link and shows no form; a second "are you sure" would contradict that, and the act is reversible by ignoring the mail.

### Reconciliations between the roadmap and the specification

- **The cross-cutting write and load conventions reach this screen as their second caller.** Entry R2 states toasts, per-screen skeletons, re-query on navigation and the connection-lost banner as rules and deliberately writes no code for them, leaving each to the entry holding its first caller. That entry is R3, settled there rather than left to build order: `docs/ROADMAP.md` and entry R2 both name R3 outright, so Profile consumes the four rather than establishing them whichever entry is built first. Under Principle I the second call site is where a shared primitive is extracted — so this is the entry at which extracting one becomes legitimate, and FR-031 to FR-034 are obligations on the screen either way, not a claim on who authored them.
- **`OT-SEC-004` is satisfied by not being an entry point.** The roadmap assigns the password policy to this entry, but §3.12's change password is a link with no password field. This feature therefore introduces no policy of its own; it satisfies the requirement by routing to the one screen that enforces it, and by adding no second place where a password can be set.
- **`OT-SEC-012` is observed here and enforced in entry R1.** Ending every session on a completed reset is R1's mechanism. This feature is the second way into it, and the only one where the requesting browser is itself signed in — the case §3.1 calls out by name.
- **Profile is reached from a chip this feature does not build.** §3.12 places the entry point on the sidebar's user chip, which entry R2 delivers. This feature delivers the route and the screen behind it.
- **The screen renders inside the shell.** `OT-UX-001` is entry R2's and names Home as its one exception; Profile is an ordinary authenticated screen, so it takes the sidebar and the header. The change-password screen it links to is one of the two that render outside the shell entirely, and that screen is R1's.

### Inherited constraints, not decisions this specification makes

- The user record, its columns, their length bounds and the two read projections are entry R1's. This feature adds none of them and generates no migration.
- The persistent shell, the in-place editing convention, the disabled-control-with-inline-reason rule and the accessible-component-first rule are entry R2's conventions; this screen follows them rather than restating them as choices.
- The password policy, the blocklist, the reset token, the mail that carries it and the reset rate limit are entry R1's, unchanged and unextended here.
- Mutations in this product are server functions; the specification's one route-handler exception is sign-in (§6), which is not this feature's.

### Dependencies

- **Roadmap position**: R4 depends on entries R1 and R2. Nothing depends on R4 — it sits off the critical path and may be built in parallel with R3 or later.
- **Upstream from R1**: the user record and its `accountUser` projection, the resolved actor on every request, the reset request-and-token mechanism, its rate limit, and the must-change-password flag this link's completion clears.
- **Upstream from R2**: the shell, the user chip that links here, and the app-wide UX conventions this screen is the first to exercise.
- **Downstream reach-back**: none. No later entry adds behaviour to `updateOwnProfile`, because a profile edit writes no activity and causes no notification.
