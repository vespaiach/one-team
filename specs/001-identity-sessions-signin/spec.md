# Feature Specification: Identity, sessions and sign-in

**Feature Branch**: `claude/roadmap-r1-feature-spec-1b4e36`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R1**

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "create feature specification for Roadmap Entry R1 (Identity, sessions and sign-in). Refer to docs/ROADMAP.md -> Entry R1 and docs/product/specifications.md for all scope boundaries, in-scope requirements, and explicit exclusions."

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R1** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## Clarifications

### Session 2026-08-30

- Q: How long should a password-reset token stay valid after it is issued? → A: One hour
- Q: How should the installation determine its own public URL, used both to build the reset link and to check the origin of mutating requests? → A: One required operator-supplied environment value, `APP_URL`
- Q: When should a throttle refusal lift — when the oldest counted attempt ages out of the fifteen-minute window, or fifteen minutes after the failure that triggered the refusal? → A: When the oldest counted attempt ages out (rolling window)
- Q: When first-run seeding is refused because `ADMIN_PASSWORD` fails the policy, what should the installation do next? → A: Exit non-zero before serving any request
- Q: Should expired session rows and spent or expired reset tokens be removed, and if so how? → A: Swept by the same in-process interval timer
- Q: What maximum password length should every credential entry point accept, so an unbounded value cannot reach the hash function? → A: 128 characters
- Q: How should the per-IP throttle derive the caller's address when the installation sits behind a reverse proxy? → A: The connection's own peer address, unless the operator declares a proxy through `TRUST_PROXY`
- Q: In what units should a throttle refusal state its remaining time? → A: Seconds on the wire, whole minutes rounded up in what the caller reads
- Q: What accessibility conformance target should the screens this feature renders be held to? → A: WCAG 2.2 Level AA

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An account holder signs in and stays signed in (Priority: P1)

Someone who already has an account opens the installation, is sent to the sign-in screen, enters their email and password, and lands on Home. They stay signed in across browser restarts for thirty days of use without re-entering anything. Every request they make afterwards is answered as *them* — the server looks up who they are on each one, so nothing about their identity is stale.

**Why this priority**: Every slice after R1 needs an actor. Without this there is no signed-in user for the shell to frame, no `role` for an authorization predicate to read, and no session for a mutator to trust. It is the one story whose absence blocks all twelve roadmap entries.

**Independent Test**: Seed one account and its credential directly in the test database, then drive the sign-in screen: correct credentials produce a session and land on Home; a wrong password and an unknown address produce one identical message; a request to an authenticated route without a cookie redirects to `/signin`. No other story needs to exist.

**Acceptance Scenarios**:

1. **Given** an active account with a known password, **When** the holder submits that email and password, **Then** a session row is written, one opaque session cookie is set, and the browser lands on `/home`.
2. **Given** an active account, **When** the holder submits the correct email with a wrong password, **Then** the screen reads "That email and password don't match." and no session is created.
3. **Given** no account for an address, **When** anyone submits that address with any password, **Then** the screen shows that same message, word for word, and the response is otherwise indistinguishable from scenario 2.
4. **Given** an account whose `deactivated_at` is set, **When** the holder submits their correct email and password, **Then** the screen shows the deactivated message naming the operator-configured contact address, and no session is created.
5. **Given** an installation where the operator configured no contact address, **When** a deactivated holder signs in correctly, **Then** the message names no address and reads "Contact your One Team administrator."
6. **Given** a signed-in holder, **When** they make any request, **Then** their role and deactivation state are read from the database on that request rather than from the cookie.
7. **Given** a session last used twenty-nine days ago, **When** the holder makes a request, **Then** it succeeds and the expiry moves thirty days out from now.
8. **Given** a session last used thirty-one days ago, **When** the holder makes a request, **Then** they are redirected to `/signin`.
9. **Given** no session cookie, **When** a request reaches any authenticated route, **Then** it redirects to `/signin` and never renders the Forbidden screen.
10. **Given** a sign-in submission carrying an origin that is not the installation's own, **When** it reaches the server, **Then** it is refused.

---

### User Story 2 - An operator stands a new installation up (Priority: P2)

An operator deploys the box, sets `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment, and starts the app. It creates exactly one admin account. That admin signs in and is told, on every screen, that they are still using the seeded password. Nothing about this path can be used twice, and a weak seed password stops the installation loudly rather than quietly creating a bad account.

**Why this priority**: No other route creates the first account — there is no public sign-up and an invitation must be issued by an admin who does not yet exist. Second only to sign-in because the break-glass command (Story 5) is an alternative way in, so this is the convenient path rather than the only one.

**Independent Test**: Start against an empty database with a compliant `ADMIN_PASSWORD` and confirm exactly one admin row carrying `must_change_password`. Restart and confirm no second admin. Start against an empty database with a ten-character password and confirm the app names the rule that failed, writes nothing, and exits non-zero.

**Acceptance Scenarios**:

1. **Given** a database with no `user` rows and compliant environment values, **When** the app starts, **Then** exactly one admin account exists, carrying `must_change_password`.
2. **Given** a database with at least one `user` row, **When** the app starts, **Then** seeding is skipped and no row is created or changed, whatever the environment values say.
3. **Given** an empty database and an `ADMIN_PASSWORD` under twelve characters, **When** the app starts, **Then** seeding does not run, no row is written, the app reports that the value is too short, and the process exits non-zero without serving a request.
4. **Given** an empty database and an `ADMIN_PASSWORD` on the common-password blocklist, **When** the app starts, **Then** seeding does not run, no row is written, the app reports that the value is blocklisted, and the process exits non-zero without serving a request.
5. **Given** the seeded admin is signed in, **When** any authenticated screen renders, **Then** an advisory banner says the password must be changed, and every control on the screen still works.
6. **Given** the seeded admin, **When** they complete a password reset, **Then** `must_change_password` is cleared and the banner stops rendering.

---

### User Story 3 - Someone who forgot their password gets back in (Priority: P3)

A holder cannot remember their password. They ask for a reset link from the sign-in screen, receive one by mail, choose a new password on a full-page screen, and are returned to sign-in to enter it. Every session they had — on every device, including the one that asked — is gone.

**Why this priority**: The only self-service recovery in the product. Without it a forgotten password needs an operator with SSH access, which does not scale past the first week. Below bootstrap because an installation can run without it; above the throttle because it is a user-facing capability rather than a property.

**Independent Test**: Request a reset for a known address and for an unknown one, and confirm the two answers are identical. Follow the emailed link, set a compliant password, and confirm every prior session is dead and the new password signs in.

**Acceptance Scenarios**:

1. **Given** the reset request screen, **When** an address with an account is submitted, **Then** the screen reads "If that address has an account, a link is on the way" and a single-use link is mailed.
2. **Given** the reset request screen, **When** an address with no account is submitted, **Then** the screen shows that identical message and no mail is sent.
3. **Given** a valid reset link, **When** it is opened, **Then** a full-page screen renders outside the shell with New password and Confirm password, and no sidebar or header.
4. **Given** the reset screen, **When** the two fields differ, **Then** an inline error renders on Confirm password and nothing is written.
5. **Given** the reset screen, **When** a password under twelve characters or on the blocklist is entered, **Then** the field reports which rule failed and nothing is written.
6. **Given** a valid reset link and a compliant new password, **When** it is submitted, **Then** the password is updated, every session for that user is deleted, and the browser is redirected to `/signin` with a success message.
7. **Given** a reset link already used once, **When** it is opened again, **Then** the "already used" state renders and no password can be set.
8. **Given** a reset link past its lifetime, **When** it is opened, **Then** the "expired" state renders.
9. **Given** a token string that matches no reset token, **When** it is opened, **Then** the "unknown" state renders — distinct from expired and from used.
10. **Given** a holder signed in on two browsers who completes a reset from one, **When** the other browser makes its next request, **Then** it is redirected to `/signin`.

---

### User Story 4 - The installation resists credential guessing (Priority: P4)

An attacker tries passwords against one address, and separately sprays many addresses from one machine. Both are stopped for up to fifteen minutes and told how long is left. Restarting the box does not help them. Reset traffic cannot be used to lock a real user out of signing in, and failed sign-ins cannot block the reset that would fix them.

**Why this priority**: The product has one credential and four public routes; unlimited guessing against them is the whole attack surface. Below recovery because it hardens an existing capability rather than adding one.

**Independent Test**: Fail five sign-ins for one address and confirm the sixth is refused with a remaining time. Fail twenty from one IP across twenty different addresses and confirm the twenty-first is refused. Restart the app mid-lockout and confirm the lockout survives.

**Acceptance Scenarios**:

1. **Given** five failed sign-ins for one address inside fifteen minutes, **When** a sixth is attempted for that address, **Then** it is refused and the message states the remaining time.
2. **Given** twenty failed sign-ins from one IP address across any mix of addresses inside fifteen minutes, **When** a twenty-first is attempted from that IP, **Then** it is refused with the remaining time, whichever address it targets.
3. **Given** an address locked out of sign-in, **When** a reset is requested for it, **Then** the request is answered normally — the sign-in lockout does not block it.
4. **Given** five reset requests for one address inside fifteen minutes, **When** a sixth is requested, **Then** it is refused, and sign-in for that address still works.
5. **Given** four failed sign-ins for an address, **When** a correct sign-in follows, **Then** that address's sign-in attempt rows are cleared, its reset rows are not, and the originating IP's rows are not.
6. **Given** a lockout in force, **When** the installation is restarted, **Then** the lockout is still in force for the remainder of its window.
7. **Given** attempt rows older than fifteen minutes, **When** the sweep runs, **Then** those rows are removed and no live counter is affected.
8. **Given** an address that has never had an account, **When** resets are requested for it repeatedly, **Then** an attempt row is recorded every time and the throttle applies exactly as it does for a real address.

---

### User Story 5 - An operator administers accounts from the box (Priority: P5)

With no team-settings screen and role changes deliberately kept off the web, an operator with SSH access promotes an admin, sets a password, reopens a closed account, or closes one. The command refuses to leave the installation with no active admin, and never takes a password as an argument.

**Why this priority**: The total-lockout recovery and the only route to a role change in v1. Last because it is an operator escape hatch — every ordinary day runs without it — but it must exist before the first admin can be locked out.

**Independent Test**: Run the grant command against a fresh address and confirm an admin exists with the password typed at the prompt. Run it against an existing member and confirm promotion, a cleared deactivation and a cleared password flag. Run the deactivate command against the only active admin and confirm refusal.

**Acceptance Scenarios**:

1. **Given** an address with no account, **When** the grant command runs with that address and a name, **Then** an admin account is created with the password read from the terminal prompt.
2. **Given** an existing member account, **When** the grant command runs for its address, **Then** the account becomes an admin, its password is replaced, `deactivated_at` is cleared and `must_change_password` is cleared.
3. **Given** the grant command, **When** a password under twelve characters or on the blocklist is typed, **Then** the command refuses, names the rule that failed, and writes nothing.
4. **Given** the grant command, **When** a password is supplied as a command-line argument, **Then** it is not accepted as the password.
5. **Given** an active account, **When** the deactivate command runs for it, **Then** `deactivated_at` is set and every session row for that user is deleted, so its next request anywhere redirects to `/signin`.
6. **Given** exactly one active admin, **When** the deactivate command runs for that admin, **Then** it is refused and nothing is written.
7. **Given** exactly one active admin, **When** two deactivations for that account run concurrently, **Then** at most one can succeed and the installation is never left with zero active admins.
8. **Given** a deactivated account, **When** the grant command runs for its address, **Then** the account is reopened as an admin.

---

### Edge Cases

- **Address casing.** Two addresses differing only in case are the same account — sign-in, reset and the uniqueness rule all fold case.
- **Deactivated account, wrong password.** The credentials were not proved, so the generic "doesn't match" message renders — the deactivated message is reachable only by someone who holds the password, or account existence leaks through it.
- **A cookie with no session row** — revoked, swept, or forged — resolves to no actor and redirects, exactly as an absent cookie does.
- **A session whose user is deactivated between requests** stops working on the next request, not at the end of a window.
- **Two sign-ins racing the fifth failure** must not both slip through; the counter is durable and counted server-side.
- **A reset requested for a deactivated account** answers identically and mails nothing — sign-in is revoked, so a new password would grant nothing.
- **A reset completed while its own requesting browser is signed in** ends that session too; that browser returns to sign-in on its next action.
- **Two reset links outstanding for one address**: each is single-use, and using either ends every session, which includes invalidating nothing about the other — the other stays usable until it expires or is used.
- **Mail cannot be sent** (SMTP unconfigured or unreachable): the reset request answers with the same sentence, and the failure is recorded in the server log only.
- **The seeded admin never changes the password**: the banner renders forever and blocks nothing; the account works normally.
- **The environment names a seed admin whose address already has an account**: seeding is skipped by the "any user row exists" check before the address is ever considered.
- **A blocklisted password that meets the length rule** is refused for being blocklisted, and the message says which rule failed rather than restating the others.
- **A request arriving with no origin header** on a mutating route is refused like a foreign one.
- **The sweep and a live sign-in touching the attempt table at once** must not let the sweep remove a row inside the live window.

## Requirements *(mandatory)*

Each requirement cites the index ID it satisfies where one exists, or the specification section it restates. IDs in `OT-…` form are [`docs/product/requirements-index.md`](../../docs/product/requirements-index.md) rows; `§` references are the specification's own headings.

### Functional Requirements

#### Data model and read boundary

No user journey observes these directly — they are conventions every later entry inherits. Each is verified against the schema and against the queries that read it, not through a screen: a column's type, bound and constraint by inspecting the migration the change generates, and a projection or a read boundary by asserting on what a query returns and on the absence of any query that reaches the excluded tables.

- **FR-001**: Every table this feature introduces MUST use server-generated UUIDv7 primary keys, `text` with a `CHECK` constraint for enumerations rather than a database enum type, and a timezone-aware timestamp type for instants. (`OT-DATA-001`)
- **FR-002**: Every free-text column this feature introduces MUST be length-bounded by a `CHECK` constraint — 200 characters for names and handles, 10 000 for long free text. A column whose content is neither, such as a stored user agent, a URL or an encoded hash, MUST still carry a stated bound, and that bound MUST be recorded in the data model with the reason it falls outside the two buckets. No column may be left unbounded because neither bucket fits. (`OT-DATA-003`)
- **FR-003**: Every mutator this feature introduces MUST write `updated_at` explicitly through one shared helper; a database trigger MUST NOT be used for it. (`OT-DATA-002`)
- **FR-004**: `user` rows MUST be read through one shared `publicUser` projection (`id`, first name, last name, avatar URL, role, job title, deactivation instant), and the contact fields (email, Slack handle, phone, bio) MUST come from a separate `accountUser` projection reserved for the admin Accounts screen and for a user reading their own row. (`OT-DATA-005`)
- **FR-005**: The credential, session, reset-token and attempt-counter tables MUST NOT be reachable from any read endpoint. (`OT-DATA-006`)
- **FR-006**: An account address MUST be unique when folded to lower case. Folding MUST happen at the boundary, before the address is stored or looked up, using the runtime's Unicode-aware lower-casing, and the value stored MUST be the folded one — so the unique index folds a value that is already folded and the database and the application cannot disagree about two addresses being the same. (`OT-INV-016`)
- **FR-007**: No path MUST exist that deletes a `user` row; closing an account MUST be a deactivation instant and nothing else. (`OT-INV-017`)
- **FR-008**: The placeholder `setup_check` table inherited from the current tree MUST be removed together with its schema entry.
- **FR-009**: Identity, session and role state MUST live only in the database; no client-held copy of it MUST exist, and every read of it MUST be a query. (`OT-SCOPE-006`)
- **FR-059**: A uniqueness violation raised by a concurrent write of the same address MUST be caught and mapped to the outcome the caller's operation defines — "already seeded" for first-run seeding, "promote the existing account" for the grant command — and MUST NOT surface as an unhandled error or a stack trace. The constraint, not a prior read, is what makes the address unique.

#### Sign in

- **FR-010**: Authentication MUST rest on exactly one credential — an email address and a password — with sessions held as database rows behind an opaque cookie rather than as claims inside a signed token. (`OT-SEC-001`)
- **FR-011**: Exactly four routes MUST be reachable by an unauthenticated caller: sign-in, the reset request, the reset submission and invitation acceptance. This feature MUST deliver the first three and MUST open no other; invitation acceptance arrives with entry R3. (`OT-SEC-002`)
- **FR-012**: `/signin` MUST render outside the shell as a full-screen card carrying an email field, a password field, a "Sign in" control and a "Forgot password?" link, and nothing else. There MUST be no sign-up link and no "remember me" control. Every screen this feature renders MUST meet WCAG 2.2 Level AA. (§3.1, `OT-UX-001`, `OT-SEC-007`)
- **FR-013**: A wrong password and an unknown address MUST produce one identical message — "That email and password don't match." — with no other difference an unauthenticated caller can observe between the two responses. (`OT-SEC-011`)
- **FR-014**: Correct credentials for a deactivated account MUST produce their own message stating the account is closed and naming the operator-configured contact address; where the operator has configured none, the message MUST name no address and MUST read "Contact your One Team administrator." (§3.1, `OT-SEC-018`)
- **FR-015**: No route reachable by an unauthenticated caller MUST disclose any `user` record, or any field of one, to that caller. Sign-in and the reset request MUST read the rows they need in order to verify a credential or find a recipient; what they return MUST be confined to the fixed outcomes `FR-013`, `FR-014` and `FR-031` name, none of which carries a value read from a `user` row. (`OT-SEC-018`)
- **FR-016**: A successful sign-in MUST write one session row recording the user, the creation instant, the last-seen instant, the expiry, the user agent and the IP address. Wherever this feature records or counts an IP address, that address MUST be the connection's own peer address; a forwarded header MUST be read only where the operator has declared a proxy through `TRUST_PROXY`, and then only the last hop it names. (§6)
- **FR-017**: Sign-in MUST set exactly one opaque session identifier as a cookie marked `HttpOnly`, `Secure`, `SameSite=Lax` and `Path=/`, carrying no claims and no signature to verify. The session MUST expire thirty days after last use and MUST be refreshed on every use. (`OT-SEC-007`)
- **FR-018**: A successful sign-in MUST clear that address's sign-in attempt rows only — not its reset attempt rows, and not the originating IP address's rows. (`OT-SEC-017`)
- **FR-019**: A successful sign-in MUST land the caller on `/home`. (§3.2)
- **FR-060**: A caller who already holds a valid session MUST be able to reach `/signin` and sign in again. `/signin` MUST render its form rather than redirecting, and a successful sign-in MUST write a new session row and set a new cookie; the session the caller already held MUST NOT be reused, extended or deleted, and MUST expire or be swept on its own terms.
- **FR-061**: No limit MUST be placed on how many sessions one user holds at once. Each sign-in is its own row, which is what lets a completed reset or a deactivation end them all together (`FR-038`, `FR-054`).
- **FR-062**: An address that has an account but no credential row MUST be refused exactly as a wrong password is — the same message, the same attempt rows, and the same dummy verification, so its cost and its response are indistinguishable from any other rejection (`FR-013`).
- **FR-063**: An address longer than the 200-character bound, or a password longer than the 128-character bound, MUST be refused at every boundary that accepts one — sign-in, the reset request and the reset submission — before any database lookup, any hash, and any attempt row is written.

#### Actor resolution and request protection

- **FR-020**: Every request MUST resolve its actor by looking up the session row the cookie names and reading the user's role and deactivation instant from the database in the same query. Identity, role and membership MUST NOT be cached anywhere. (`OT-SEC-008`)
- **FR-021**: A cookie naming no session row, a session past its expiry, and a session whose user is deactivated MUST each resolve to no actor.
- **FR-022**: An unauthenticated request to an authenticated route MUST redirect to `/signin` and MUST NOT reach the Forbidden screen. (`OT-SEC-015`)
- **FR-023**: Every mutating request MUST be refused unless its stated origin is the installation's own; a CSRF token MUST NOT be used, and a missing origin MUST be treated as a foreign one. The installation's own origin MUST be the operator-supplied `APP_URL`, never a value taken from the request being checked. (`OT-SEC-009`)
- **FR-024**: Every mutator MUST validate its input and enforce its authorization on the server, deriving the subject from stored rows rather than from a client-supplied identifier. (`OT-AUTHZ-004`)
- **FR-025**: Responses to a caller MUST carry generic messages; database errors, stack traces and configuration MUST stay in the server log.
- **FR-064**: The installation MUST write a server-log line for each of exactly these events, and MUST introduce no others in this feature: a refused sign-in, a throttle refusal, a mail send failure, a refused first-run seed, and an unhandled server error. Each line MUST carry the event, the instant, and the address or IP address it concerned. This enumeration is what `SC-010` means by "any log line the installation produces"; no line MUST carry a password, a hash, a session token or a reset token.

#### Password policy and secret storage

- **FR-026**: A password MUST be at least twelve characters and at most 128, MUST carry no composition rules, and MUST be refused if it appears on a blocklist of at least the ten thousand most common passwords, carried as repository data rather than as a dependency and compared case-insensitively. The same policy MUST hold at every entry point that sets a credential, and the 128-character bound MUST also be enforced where a password is presented for verification, so no unbounded value reaches the hash function. (`OT-SEC-004`)
- **FR-027**: The policy MUST be enforced on the server at every such entry point whatever the client also checks, and a screen MUST report the failure per field on blur rather than as a wall of errors on submit. (`OT-UX-011`, `OT-SEC-019`)
- **FR-028**: Passwords MUST be stored as Argon2id hashes in a credential table separate from `user`, and MUST never appear in a response, in a cookie, or in a log. The cost parameters MUST be the OWASP Password Storage first recommended Argon2id profile — 19 MiB of memory, two iterations, one lane — set explicitly in one module rather than left to a library default, so a later change is one edit and every stored hash carries the parameters it was made with. (`OT-SEC-005`)
- **FR-029**: Session tokens and reset tokens MUST each be 32 bytes drawn from a cryptographically secure random source and stored as a SHA-256 digest, so nothing in the system compares two secrets and a leaked database yields no working credential. (`OT-SEC-006`)

#### Forgot password

- **FR-030**: `/reset` MUST render outside the shell carrying an email field and a "Send reset link" control, and nothing else. (§3.1)
- **FR-031**: A reset request MUST always answer "If that address has an account, a link is on the way", whether or not the address has an account. (`OT-SEC-011`)
- **FR-032**: A reset request MUST record one attempt row in the reset counter every time it is made, never only when the address is unknown. (`OT-SEC-017`)
- **FR-033**: A reset request MUST mail a single-use link only where the address belongs to an account that may sign in, and a mail failure MUST NOT change the answer the caller is given. The link MUST be an absolute URL built from the operator-supplied `APP_URL`, and MUST expire one hour after it is issued. (§3.1, `OT-SEC-011`)
- **FR-065**: The reset mail MUST be sent from an operator-supplied `MAIL_FROM` address. Where it is unset, no mail MUST be sent and the failure MUST be logged, and the answer the caller is given MUST be unchanged — the same behaviour as an unconfigured transport (`FR-033`).

#### Change password (screen 13)

- **FR-034**: `/reset?token=…` MUST render as a full page outside the shell — no sidebar, no header — carrying two required fields, New password and Confirm password. It MUST be reachable only through the emailed link. (§3, screen 13; `OT-UX-001`)
- **FR-035**: A mismatch between the two fields MUST render as an inline error on Confirm password and MUST write nothing.
- **FR-036**: An expired token, an already-used token and an unknown token MUST each render their own explanatory state, distinguishable from one another. (`OT-SEC-016`)
- **FR-037**: A reset token MUST be usable exactly once.
- **FR-038**: A completed reset MUST update the password, delete every session row for that user including the one that requested it, and redirect to `/signin` with a success message. (`OT-SEC-012`)
- **FR-066**: A reset submission whose token belongs to an account that may no longer sign in MUST be refused, MUST spend the token, MUST write no password, and MUST render the state an unknown token renders — naming the account's condition here would disclose it to whoever holds the link (`FR-015`).
- **FR-067**: A `token` parameter that is empty, or that is not the shape a token takes, MUST render the unknown-token state without a database lookup. It MUST NOT be treated as an absent token, so a link mangled in transit explains itself rather than silently showing the request form.

#### The three unauthenticated screens

These hold for `/signin`, `/reset` and `/reset?token=…` alike. R3's invitation-acceptance screen inherits them unchanged.

- **FR-079**: Each screen MUST set its own document title, MUST carry exactly one `<h1>` naming the screen, and MUST inherit the document language and direction the root layout resolves from the request. A screen MUST NOT rely on the card's visible text to name itself to a caller who cannot see it.
- **FR-080**: The screens MUST remain usable down to a viewport 1024 pixels wide. Below that width the layout is unsupported and MUST NOT be designed for, which is what "desktop only, no breakpoints" means in practice.
- **FR-081**: Where a submit is refused because a field is invalid, focus MUST move to the first invalid field. An error summary MUST NOT be rendered — the failure belongs on the field, per the per-field rule (`FR-027`).
- **FR-082**: An outcome that replaces or annotates the form as a whole — rejected, deactivated, throttled, a token state, the success banner — MUST be announced to assistive technology when it appears, not only rendered. A caller who cannot see the card MUST learn the submission's outcome without hunting for it.
- **FR-083**: Each screen MUST be completable using the keyboard alone, with focus order following the visual order of the card and every control reachable without a pointer.
- **FR-084**: A long address or a long message MUST wrap inside the card and MUST grow the card's height. It MUST NOT be truncated, MUST NOT overflow the card, and MUST NOT cause the page to scroll horizontally.
- **FR-085**: Validation MUST also run on submit for any field that was never blurred, so a value the browser filled without a blur is still checked before the request is made (`FR-027`).
- **FR-086**: These screens MUST carry no animation or transition, so there is no motion for a reduced-motion preference to reduce. Under a forced-colours or high-contrast setting they MUST remain operable, which the rule that state is never conveyed by colour alone already requires.
- **FR-087**: The reset-request screen MUST render its own throttled state. Reset requests are throttled under the same two limits in their own counter (`FR-040`), so a refusal is reachable there and MUST explain itself as it does on sign-in.

#### Throttle and sweep

- **FR-039**: Sign-in MUST be refused while five or more failures for one address, or independently twenty or more from one IP address across any addresses it targeted, fall inside the last fifteen minutes; the refusal MUST state the time remaining until the oldest counted attempt leaves that window, expressed to the caller as whole minutes rounded up, so a refusal in force never reads as no wait at all. (`OT-SEC-010`)
- **FR-040**: Reset requests MUST be throttled under the same two limits and the same window in their own counter, discriminated by flow, so reset traffic MUST NOT lock an address out of sign-in and failed sign-ins MUST NOT block the reset that would fix them. (`OT-SEC-017`)
- **FR-041**: A sign-in MUST record an attempt row only when it fails; a refused attempt MUST NOT record one, so a refusal cannot extend the window that produced it. (`OT-SEC-017`, §5)
- **FR-042**: Attempts MUST be counted over the last fifteen minutes for one flow, kind and subject taken together, where kind distinguishes an address from an IP address. (§5)
- **FR-043**: Attempt counters MUST be durable — restarting the installation MUST NOT reset any of them. (`OT-SEC-010`)
- **FR-044**: Attempt rows past the window, session rows past their expiry, and reset tokens that are spent or expired MUST be removed by a sweep run from one in-process interval timer, and that timer MUST be the installation's only one; a queue or external scheduler MUST NOT be used. Every row the sweep removes MUST already be dead, so no live behaviour changes when it runs. Entry R11 adds the notification-mail retry sweep to this same timer. (`OT-OPS-003`)
- **FR-068**: Where an address and its IP address are both inside their windows, the refusal MUST report the later of the two clearing instants, so a caller is never invited to retry while a limit that still holds would refuse them again.
- **FR-069**: The sweep MUST run every five minutes. The period MUST be shorter than the fifteen-minute attempt window, so the attempt table never holds more than a few windows' worth of rows, and MUST NOT be configurable.
- **FR-070**: A sweep that throws MUST have its failure caught and logged, and MUST NOT stop the timer; the next interval MUST run normally. A sweep is a cleanup, and losing one run costs nothing that the next does not recover.
- **FR-071**: On `SIGTERM` the timer MUST be cleared and a sweep already running MUST be allowed to finish. Each of the sweep's statements is atomic on its own, so a process ended mid-sweep MUST leave no partial state to repair.

#### First-run bootstrap

- **FR-045**: On a first deployment the installation MUST seed a single default admin from the operator-supplied `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment values. (§6)
- **FR-046**: `ADMIN_PASSWORD` MUST be held to the password policy; a non-compliant value MUST stop seeding, MUST write nothing, MUST make the app report which rule the value failed on standard error, and MUST stop the process with a non-zero exit status before any request is served. (`OT-SEC-019`)
- **FR-047**: Seeding MUST be skipped whenever any `user` row already exists, and that check MUST be the whole marker, so the path can neither run twice nor mint a second admin later. Where two processes start against the same empty database at once, the unique address index MUST make the second insert fail, and the process whose insert failed MUST treat that failure as "already seeded" and continue starting rather than exiting. (`OT-SEC-014`)
- **FR-048**: The seeded row MUST carry the must-change-password flag; every account created any other way MUST default to not carrying it. (§5, §6)
- **FR-049**: While that flag is set on the signed-in user, an advisory banner MUST state it on every authenticated screen, and MUST block nothing. This feature MUST deliver the banner; entry R2 places the slot that hosts it. (§6)
- **FR-050**: Completing a password reset MUST clear the flag, and so MUST the grant command. (§6)
- **FR-072**: Where the database cannot be reached at startup, the installation MUST report that it could not reach the database and MUST stop with a non-zero exit status before any request is served, exactly as a missing `APP_URL` does. A box that answers requests it cannot serve is worse than one that does not start.
- **FR-073**: An `ADMIN_EMAIL` that is not a valid address MUST be treated exactly as a non-compliant `ADMIN_PASSWORD` is: seeding MUST NOT run, nothing MUST be written, the failure MUST be named on standard error, and the process MUST stop with a non-zero exit status.

#### Break-glass and user administration

- **FR-051**: A grant command MUST create or promote an admin by address, set a password, clear the deactivation instant and clear the must-change-password flag. (§6)
- **FR-052**: The grant command MUST read the password from the terminal and MUST NOT accept it as a command-line argument. (`OT-SEC-019`)
- **FR-053**: The grant command MUST hold the password to the policy and MUST refuse a non-compliant value, writing nothing. (`OT-SEC-019`)
- **FR-054**: A deactivate command MUST close an account by setting its deactivation instant and MUST delete every session row for that user, so reads and writes stop on that user's next request everywhere. (§6)
- **FR-055**: A role change MUST be reachable only from the command line; no screen this feature delivers MUST set a role, and none MUST exist elsewhere in v1. (`OT-AUTHZ-011`)
- **FR-056**: A demotion or a deactivation that would leave the installation with zero active admins MUST be refused, counting active admins under a row lock in the same transaction as the change, so two concurrent attempts cannot both succeed. (`OT-INV-013`)
- **FR-057**: Deactivation MUST retain the account's rows rather than deleting them, so a later reactivation restores what the account had. (§6, `OT-INV-017`)
- **FR-074**: Both operator commands MUST exit `0` on success, `1` on a refusal the operator can act on — a non-compliant password, an unknown address, the last active admin — and `2` on a usage error. Success MUST write one line to standard output and a refusal one line to standard error, so an operator can branch on the status without parsing the text.
- **FR-075**: An unrecognised flag MUST be a usage error: the command MUST refuse, MUST write nothing, and MUST exit `2`. A flag MUST NOT be silently ignored, so `--password=…` fails loudly rather than appearing to have been accepted (`FR-052`).
- **FR-076**: Where the terminal cannot suppress echo, the grant command MUST refuse to prompt and MUST exit non-zero rather than read a password that would be displayed and left on screen.
- **FR-077**: The grant command run against an address that is already an active admin MUST replace the password and clear the must-change-password flag, leaving the role and the deactivation instant as they already are. It MUST NOT be an error.
- **FR-078**: The deactivate command run against an address with no account MUST be refused, MUST write nothing, and MUST name the address it could not find.

#### Deployment

- **FR-058**: The installation MUST run self-hosted on a single box, with the mail transport supplied by the operator. That transport MUST be an SMTP endpoint the installation can reach from the box and that will relay mail for the configured sender address; the installation MUST require nothing else of it. Because the reset link is a bearer credential that travels over that transport, whoever operates or can read it can complete a reset for any address it carries — the operator MUST therefore treat the mail path as part of the installation's trust boundary. The operator MUST also supply `APP_URL`, the installation's own public URL, and the app MUST refuse to start when it is absent or unparseable. (`OT-OPS-012`)

### Out of Scope

Deferred by the roadmap's R1 boundary, and named here so no scenario above is read as covering them:

- **Invitation acceptance and every route that issues an invitation** — entry R3. `OT-SEC-002`'s fourth public route stays closed until then, and `OT-SEC-003` and `OT-SEC-016`'s invite half belong to that entry.
- **The Profile screen and its "Change password" link** — entry R4. This feature delivers the request-and-token mechanism that link will reuse; it delivers no route to it.
- **`/home` itself, and the shell that hosts the must-change-password banner on every screen** — entry R2. This feature redirects to `/home` and delivers the banner; it renders neither the page nor the frame.
- **The notification-mail retry half of the interval timer** — entry R11. This feature delivers the timer and its sweep of attempt rows, expired sessions and spent tokens only.
- **The Accounts screen, its deactivate and reactivate controls, and its roster** — entry R3. Deactivation here is a command run on the box.
- **Project membership in any form** — entry R5. `isMember` has nothing to read until then, and this feature enforces `isAdmin` alone.
- **Sign-out as a control.** The session-deletion capability is delivered here; the user chip that would offer sign-out is entry R2's, so no sign-out control ships in this feature.
- **Backup, restore and log retention.** The installation runs on a box the operator owns and its state is one PostgreSQL database and one log stream. Both are the operator's to back up, restore and rotate by whatever means they already use; this feature states no requirement over either and delivers no tooling for them.

### Key Entities

- **User** — a person who may sign in. Carries their names, address, avatar URL, account role (`admin` or `member`), the optional profile fields, a deactivation instant, a must-change-password flag and a remembered feed filter. The address is unique when folded to lower case. Never deleted. The password is not on this record.
- **Credential** — the Argon2id hash of one user's password, held apart from the user record so it is never selected into a response.
- **Session** — one live sign-in: the user it belongs to, when it was created, when it was last seen, when it expires, and the user agent and IP address it came from. Addressed by an opaque identifier whose digest is what is stored. Deleted by sign-out, by a completed reset, by deactivation, and by the sweep once it is past its expiry.
- **Reset token** — a single-use grant to set one user's password, stored as a digest, carrying an expiry one hour after issue and a record of whether it has been spent. Removed by the sweep once it is spent or expired.
- **Attempt** — the durable counter behind both throttles: which flow (sign-in or reset), which kind of subject (address or IP address), the subject itself, and when the attempt happened. Never read by any screen.
- **Actor** — not a table: the resolved answer to "who is making this request", produced fresh on every request from the session row and the user row behind it, and handed to every read and every mutator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can go from an empty box to a signed-in admin using only environment values and a start command — no SQL, no console and no extra tooling — and can do it in under ten minutes.
- **SC-002**: Starting the installation any number of times after the first creates no additional account: the admin count after N starts on a seeded database is exactly the count after the first.
- **SC-003**: A wrong password and an unknown address are indistinguishable to the caller — identical wording, identical outcome, and no field in either response that differs.
- **SC-004**: A holder who uses the product at least once every thirty days is never asked to sign in again; one who does not is asked exactly once on their next visit.
- **SC-005**: Five wrong passwords for one address block the sixth attempt until the earliest of the five leaves the fifteen-minute window, and twenty wrong passwords from one machine block the twenty-first on the same basis, in both cases with the remaining time stated.
- **SC-006**: Restarting the installation during a lockout removes none of it: the lockout still expires at the instant it originally would have.
- **SC-007**: A reset lockout never prevents a sign-in, and a sign-in lockout never prevents a reset request — verified in both directions.
- **SC-008**: A completed password reset ends 100% of that user's sessions, on every device, by the time the next request from any of them is answered.
- **SC-009**: A holder can complete the forgotten-password loop — request, open the link, set a password, sign in — in under three minutes, excluding mail delivery time.
- **SC-010**: No password and no usable token appears in any response body, any cookie value or any log line the installation produces.
- **SC-011**: An unauthenticated request to an authenticated route lands on the sign-in screen 100% of the time and on the Forbidden screen 0% of the time.
- **SC-012**: The installation can never be left with zero active admins, including under two concurrent attempts to close the last one.
- **SC-013**: Deactivating an account stops its reads and its writes by that account's next request, on every device it was signed in on.

## Assumptions

Reasonable defaults chosen where the source is silent, and reconciliations recorded where the roadmap and the specification meet. Each is a candidate for `/speckit-clarify`.

### Defaults chosen because the source is silent

- **The blocklist is a bundled list of common passwords, compared case-insensitively after trimming nothing.** The specification says "a blocklist of the common ones" without naming a source or a size. No dependency is approved for it, so it is repository data rather than a package. A list on the order of the ten thousand most common passwords is assumed.
- **A reset request for a deactivated account answers identically and mails nothing.** Sign-in is revoked for such an account, so a new password would grant nothing, and mailing the link would confirm the address exists to whoever asked.
- **The seed address is validated as an address and folded to lower case** before it is written, like every other address the system stores. The specification states the password rule for seeding and is silent on the address.
- **`SUPPORT_EMAIL` is the operator-configured contact the deactivated message names**, per the specification's own parenthetical; the fallback wording when it is unset is quoted verbatim from §3.1.
- **An outstanding reset token is not invalidated by another reset completing.** The specification makes each token single-use and makes a completed reset end every session; it says nothing about withdrawing a sibling token, so none is withdrawn.
- **Sign-in requires client-side scripting.** §6 pins sign-in to a route handler, and the form posts to it with `fetch` so the rejected, deactivated and throttled states can render inline (research B-1). With scripting disabled the form does not submit at all. A native form post would have to carry every state in the query string, which puts the message in history, in the referrer and in the server log — so the transport is kept and the constraint is accepted rather than worked around.
- **A caller locked out by the per-IP limit waits it out.** Twenty failures from one address inside fifteen minutes refuses everyone behind it, and no command is provided to clear a counter. The window is rolling and at most fifteen minutes, the installation is sized for a team under twenty (`FR-058`), and the reset flow counts separately (`FR-040`) — so the path back in stays open and the refusal expires on its own.
- **The box's clock is assumed to move forward.** Every window and every expiry in this feature is an instant compared against `now`. A clock set backwards extends live windows and live sessions by the size of the jump, and nothing detects or compensates for it. Keeping the box's time synchronised is the operator's, not the application's.
- **The installation runs as a single process.** `FR-044`'s "the installation's only timer" is a statement about one process: a second instance would start a second timer. The throttle does not share that premise — its counters are database rows taken under an advisory lock (`FR-043`), so it stays correct across however many processes read it.
- **The server timezone changes nothing in this feature.** Every value R1 stores is an instant, and application logic is UTC. `TZ` exists for the calendar-date comparisons later entries make; no requirement here reads it.
- **This feature's migration is the first real one.** There is no shared environment yet, so nothing here edits a migration that may already have run. From R2 onward the rule AGENTS.md states applies unchanged: add a migration, never edit one that shipped.
- **The three bounds that fall outside the two buckets are 1000, 2000 and 255.** A stored user agent is bounded at 1000 characters, an avatar URL at 2000, and an encoded Argon2id hash at 255. None is a name, a handle or long free text, so `FR-002` requires each to state its own bound and its reason; these are those values.
- **A completed reset always has somewhere to land.** `/signin` is delivered by this feature, so the redirect target `FR-038` names is never missing. No requirement is stated for a redirect whose destination cannot render, because within R1's boundary there is no such destination.

### Reconciliations between the roadmap and the specification

- **This feature's deactivation command deletes sessions.** `OT-SEC-013` is attributed to entry R3, where the Accounts screen's `deactivateUser` lands, but §6 states plainly that deactivation deletes every session row, and the roadmap places `admin:deactivate` in R1. The command therefore follows §6; R3 owns the requirement's remaining half — the UI mutator and the membership retention that only matters once project membership exists (entry R5).
- **Sign-in redirects to `/home`, which entry R2 delivers.** §3.2 makes Home the landing page after sign-in and the roadmap defers the page itself. The redirect target is fixed here; what answers at that route is not this feature's.
- **The must-change-password banner ships here, its slot ships with entry R2.** This feature delivers the flag and the banner; the shell that carries it on every authenticated screen is R2's, so the banner has no host until R2 lands.
- **`isMember` is not exercised.** Every authorization this feature performs is `isAdmin` or "self"; project membership does not exist until entry R5, so `OT-AUTHZ-004` is satisfied here for the admin predicate only.

### Inherited constraints, not decisions this specification makes

- The Drizzle and PostgreSQL pipeline already on `main` — the database client, the Drizzle configuration and the generate/migrate commands — is built on rather than created.
- The specification pins sign-in's transport to a route handler at `POST /api/auth/signin` (§6) rather than leaving it to the plan, so that the throttle and the origin check sit in one place. It is the one mutation in the product that is not a server action.
- Argon2id hashing, the mail transport and time-ordered primary keys are covered by the approved-dependency table in `AGENTS.md`; this feature adds no dependency beyond it.
- The persistence rules this feature relies on — row locks, `CHECK` constraints and uniqueness — are database-enforced, so their tests run against a real PostgreSQL instance on a separate database, never a mock.

### Dependencies

- **Roadmap position**: R1 has no upstream entry. R2 through R12 all consume it.
- **Operator-supplied**: a PostgreSQL instance, an SMTP host, `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SUPPORT_EMAIL` (optional), `TRUST_PROXY` (optional) and the server timezone.
- **Downstream reach-back**: entry R11 adds the notification-mail retry sweep to the interval timer this feature delivers. Entry R3's `deactivateUser` shares the active-admin lock this feature establishes.
