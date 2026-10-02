# Feature Specification: Magic-link Sign-in

**Feature Branch**: `colau/speckit-sdd-orchestrator-75b0f0`

**Created**: 2026-10-01

**Status**: Draft

**Input**: Parent roadmap: `ROADMAP.md` → entry **RM-3**. The first admin, created by the setup command, signs in with an emailed link and stays signed in. In scope: F-001 (REQ-004 to REQ-006), OPS-001, sign out, STD-1, STD-2 and SEC-006 (the one permission layer, with Admin and Member roles), SEC-001, SEC-003 (magic-link and session tokens), SEC-004, SEC-007.1; the email provider (DEC-003, API-002, NFR-008) and a failed send (STD-6); `/sign-in`, and `/my-issues` as an empty landing page; member initials (REQ-003.4). Deferred: invitations, profiles and deactivation (RM-4); SEC-004.1, which needs issues (RM-6); My issues content (RM-11).

**Parent**: `ROADMAP.md` → RM-3 (Magic-link sign-in), depends on RM-1. Behavior source: `docs/tracklite-spec.md` (F-001 REQ-003, REQ-003.4, REQ-004 to REQ-006, OPS-001, STD-1, STD-2, STD-6, STD-9, section 7, section 8 Member / Magic link / Session, SEC-001, SEC-003, SEC-004, SEC-006, SEC-007, API-002, API-004, DEC-002, DEC-003, DATA-004, NFR-008, NFR-009, OPS-006).

## Clarifications

### Session 2026-10-01

- Q: Which requests started by other sites carry the session cookie (SEC-004)? → A: It is sent on ordinary top-level link clicks from other sites (for example a magic link clicked in Gmail) and never on cross-site form posts or background requests; FR-018's same-site check still blocks every write from another site.
- Q: Must the time to answer a sign-in request hide whether the email belongs to a member? → A: No; the timing difference is accepted as a known limitation for a small invite-only team, with no minimum-response-time rule.
- Q: What happens when a member already signed in on a browser opens a new unused magic link for themselves there? → A: The Sign in button is skipped and they go straight to the link's destination; the link stays unused (it expires normally) and the current session is kept. (Superseded by the later answer below.)
- Q: Which requests count toward the SEC-001 limits (5 per email, 20 per IP address per hour), and when does a block lift? → A: Only requests that pass the limit check count; the block lifts one hour after the last allowed request.
- Q: Does the magic-link request carry a `requestId`, and how is a repeat handled? → A: Yes, a browser-generated `requestId` stored on the sign-in request record; a repeat with the same `requestId` gets the same answer, with no new email and no extra count toward the limits, for members and non-members alike.
- Q: When the first request with a requestId was refused by a limit, or its email failed to send, does a repeat with that requestId replay that same answer, or is it handled as a new request? And does submitting the form again after the "We couldn't send the email" toast send a new requestId? → A: Only an accepted request (the email was sent, or the non-member got the normal answer) is recorded and replayed for its requestId. A request refused by a limit or whose send failed is not recorded, so a repeat with the same requestId is evaluated as a new request. Every new form submission, including after the failure toast, gets a fresh requestId.
- Q: Does a sign-in request that passed the limit check but whose email failed to send still count toward the SEC-001 limits? → A: Yes. Every request that passes the limit check counts toward the per-email and per-IP limits, whether its send succeeds or fails. The count is kept separately from the `requestId` replay record, which holds only accepted requests. Refused requests still don't count.
- Q: Does the earlier answer stand, that a member already signed in on a browser who opens a new unused magic link for themselves skips the Sign in button, goes straight to the destination, and keeps the current session? → A: No, it is reversed. When the browser is signed in as the link's own member, the normal REQ-005 flow applies with no special case: the Sign in button shows, and clicking it uses the link and starts a new session that replaces the current one. Only a different signed-in member is asked to sign out first (REQ-005.5); that member's session is never silently replaced, and the link stays unused and still works after they sign out.
- Q: In the REQ-005.5 message "You're signed in as Alex. Sign out to use this sign-in link.", which name of the signed-in member is shown? → A: The signed-in member's full name, as REQ-002.3 now does for invitations.
- Q: Does FR-023's redirect of a signed-in member from `/sign-in` to `/my-issues` also apply when a magic link is opened? → A: No. The magic-link landing page is `/sign-in?token=…` (API-004), and the redirect applies only to plain `/sign-in` without a token. `/sign-in` with a token always shows the landing page: the sign-out message when a different member is signed in (REQ-005.5, FR-011), or the normal Sign in button for the link's own member (FR-012).
- Q: Where does the browser go when Alex, signed in, clicks Sign out on Sam's magic-link landing page (`/sign-in?token=…`, REQ-005.5)? → A: Alex's session ends and the browser returns to that same `/sign-in?token=…`, which now shows Sam's normal Sign in button. This is the one exception to FR-016's "send the browser to `/sign-in`"; Sign out everywhere else is unchanged.
- Q: While Alex is signed in, what does the landing page show for a magic-link token that isn't Alex's own: another member's, or an unknown or malformed one? → A: Every such token shows the same REQ-005.5 state, "You're signed in as <full name>. Sign out to use this sign-in link." with its Sign out button, so opening the page reveals nothing about the token. After Alex signs out, the browser returns to the same link (the FR-016 exception), which shows the Sign in button for every token; if the token is unknown, malformed, expired or used, "This link has expired" shows only after Sign in is clicked (FR-013).
- Q: When nobody is signed in, including on the page a member returns to after the REQ-005.5 Sign out, does the magic-link landing page ever show "This link has expired" as soon as it opens? → A: No. It always shows the Sign in button first, for every token (valid, unknown, malformed, expired or used); "This link has expired" appears only after Sign in is clicked (REQ-005.2, FR-011, FR-013).
- Q: What happens when Alex clicks Sign in in a tab opened before Alex signed in, which still shows the normal Sign in button for a link that isn't Alex's own? → A: The click doesn't use the link and doesn't replace Alex's session; the page switches to the REQ-005.5 "signed in as another member" state (the same message and Sign out button), with no toast.
- Q: When the Sign out button on the magic-link landing page (`/sign-in?token=…`, REQ-005.5) is clicked after that browser's session has already ended elsewhere (for example signed out in another tab), what happens? → A: There is no error, and the browser returns to the same `/sign-in?token=…`, which shows the Sign in button, exactly as when the session was still active. The general rule that signing out when already signed out lands on `/sign-in` without an error stays for every other Sign out.
- Q: Does the sign-out endpoint require a valid session (FR-019), answering `401` without one? → A: No. Sign-out is the third exception next to requesting and using a magic link: it succeeds with or without a valid session (idempotent), ends the session if there is one, clears the session cookie, and never answers `401`. FR-018's same-site check for writes still applies to it.
- Q: How are a member's avatar initials formed from their full name? → A: The first letter of the first word and the first letter of the last word, uppercased ("Alexandria Catherine Montgomery-Fitzwilliam van der Bergholt" → "AB"); a one-word name gives a single letter (REQ-003.4, FR-025). (Refined by the later answer below.)
- Q: How are surrounding whitespace in a full name, and a first character that isn't a Latin letter, handled? → A: The full name is trimmed of whitespace at either end and must not be blank after trimming (a whitespace-only name is invalid; REQ-003, FR-003). The initials use the first character of the first word and of the last word, whatever it is (punctuation, a digit or any script), uppercased where uppercasing applies: "(Contractor) Lee" → "(L", "3M Team" → "3T", "'Sam" → "'", "李 小龙" → "李小" (REQ-003.4, FR-025).
- Q: What does a blank or whitespace-only full name show? → A: The STD-3 field error "Name required", matching REQ-016.3's "Title required"; the setup command prints the same text and refuses (REQ-003, FR-003).
- Q: During an email-provider outage, only a member's email can get "We couldn't send the email. Try again.", so the toast can reveal membership. Is that acceptable? → A: Yes; like the timing difference, it is accepted as a known limitation for a small invite-only team.
- Q: Can replaying the Sign in click's `requestId` on its own get a session (the `requestId` is not stored as a hash)? → A: No. A repeat is answered from the session the first click started only when its `requestId` matches and the submitted token hashes to the stored token hash of that session's own magic link; any other request takes the normal path (FR-012). (Refined by the later answers below.)
- Q: Does a retried Sign in click on the magic-link landing page reuse its `requestId`, and what happens when the server used the link but its answer was lost? → A: The landing page makes one `requestId` per page load and reuses it when Sign in is retried after a failure toast, so a retry after a lost answer gets the first answer and signs the member in. A new page load (another tab, or a reload) makes a new `requestId`, so Sign in there after the link was used shows "This link has expired" (FR-012, edge cases).
- Q: What makes an email valid? → A: After whitespace at either end is trimmed, it follows the WHATWG rule for `<input type="email">` and is at most 254 characters; the setup command (FR-003) and the sign-in form (FR-005) share this one rule.
- Q: What happens when a start-up setting is present but malformed? → A: Settings are also checked for format at start-up (`APP_URL` an absolute `http` or `https` origin, `MAILPIT_PORT` an integer from 1 to 65535, `EMAIL_FROM` a valid email); a bad one makes the app server exit 1 with "Invalid setting: NAME" (FR-029).
- Q: Which client address does the SEC-001 per-IP limit use before RM-2's reverse proxy exists? → A: The rightmost `X-Forwarded-For` entry. RM-2's reverse proxy must append or overwrite that header; until RM-2 (no public deployment) the value can be set by the client, which is accepted.
- Q: Which return-to addresses are kept, and does the query string survive? → A: Any same-app path (FR-012), with its query string, is a valid return-to target, including `/api/…`, `/health` and `/sign-in…`; anything else goes to `/my-issues` (FR-012, FR-020).
- Q: May requesting a sign-in link answer statuses beyond DEC-002's STD-1 to STD-4 codes? → A: Yes; it may also answer `429` (a SEC-001 limit reached) and `503` (the email couldn't be sent, STD-6), recorded in DEC-002.
- Q: What happens when the email provider times out but still delivers the email? → A: The link was already deleted as a failed send (FR-009), so clicking its Sign in button shows "This link has expired" with "Request a new link"; accepted.
- Q: What does Sign out do in a stale landing-page tab after the browser's session changed to a different member? → A: It ends whichever session the browser now has, then reloads the same link, which shows the Sign in button; accepted.
- Q: What does `/sign-in` show when the `token` parameter is empty or repeated? → A: If the `token` parameter is present at all, the landing page shows, using its first value; an empty or malformed token shows "This link has expired" after Sign in is clicked, never a `422` (FR-023).
- Q: Does NFR-003's 500 ms write limit apply to requesting a magic link? → A: No; `POST /api/sign-in-links` is exempt because it includes the provider call, and STD-6 needs the send result before answering.
- Q: What happens when a Sign in request reuses a `requestId` already stored on a session but sends a different, valid, unused magic link? → A: The server answers `422`, creates no session and leaves that link unused; nothing reaches the error log. This is the one exception to FR-012's "any other request takes the normal path".
- Q: When RM-14 deletes used or expired magic links (DATA-004), what happens to the sessions they started, and to a repeat of such a session's `requestId`? → A: The sessions survive, with no link: the session's link reference becomes empty when its link is deleted. A repeat is answered from an earlier session only while that session still has its link and the submitted token hashes to that link's stored hash; once the link is gone, a repeat takes the normal path, finds no link and answers "This link has expired", with no cookie from the old session (FR-012).
- Q: In the Sign in request, which runs first: the "signed in as another member" check or the `requestId` replay check? (For example, Sam's first click used the link but its answer was lost, Alex then signed in on that browser, and Sam's tab retries.) → A: The "signed in as another member" check runs first. A repeat is answered from the earlier session only when nobody is signed in on that browser or the signed-in member is the link's member; otherwise the page shows "You're signed in as Alex. Sign out to use this sign-in link." and Alex's session is kept, so a replay never silently replaces another member's session (REQ-005.5, FR-011, FR-012).
- Q: Which per-IP key does SEC-001 use when `X-Forwarded-For` is missing, or its rightmost entry is empty? → A: The key is the rightmost `X-Forwarded-For` entry with whitespace at either end trimmed; when the header is missing or that trimmed entry is empty, the fixed key `unknown` is used, so all such requests share one 20-per-hour bucket (FR-008).
- Q: What does a full name over 60 characters after trimming show? → A: The STD-3 field error "Too long (max 60)", the spec's existing over-length pattern (REQ-012.2, REQ-022.2, REQ-031.3); the setup command prints it for the full name and refuses, as it does "Name required" (REQ-003, FR-003).

## User Scenarios & Testing *(mandatory)*

The people served by this slice are the owner, who installs Tracklite and becomes its first admin, and every later member, who signs in the same way. After this slice the app is no longer open to anyone who can reach it: every page and API request except sign-in, sign-out, `/health` and the magic-link landing page (`/sign-in?token=…`, API-004) needs a session (FR-019).

### User Story 1 - Create the first admin (Priority: P1)

On a fresh install, the owner runs the setup command with an email, full name and username. The command creates that person as the first member, with the Admin role. On any install that already has members, the command refuses and changes nothing.

**Why this priority**: There is no invitation flow until RM-4, so without this command nobody can ever sign in.

**Independent Test**: Run the setup command against an empty database and check the admin exists; run it again and check it refuses with "Setup already done" and nothing changed.

**Acceptance Scenarios**:

1. **Given** a database with no members, **When** the owner runs the setup command with `owner@acme.com`, "Owner Name" and `owner`, **Then** an active member with the Admin role is created with that email, full name and username, and that person can then request a magic link (OPS-001.1).
2. **Given** a database that already has at least one member, **When** the setup command runs with valid input, **Then** it refuses with "Setup already done" and nothing changes (OPS-001.2).
3. **Given** an empty database, **When** the setup command runs with an invalid full name, username or email (outside the REQ-003 rules), **Then** it refuses, names the invalid value's field, and creates nothing.
4. **Given** an empty database, **When** the setup command runs with username `Owner`, **Then** it is stored as `owner` (REQ-003.1), and the email is compared ignoring capitals from then on.

---

### User Story 2 - Sign in with an emailed link (Priority: P1)

A member opens `/sign-in`, enters their email, and sees "Check your email". They receive a single-use link that expires after 15 minutes. Opening it shows a **Sign in** button; clicking it signs them in and takes them to the page they were trying to reach, or to My issues. Someone who enters an email that isn't an active member's sees exactly the same page, and no email is sent.

**Why this priority**: This is the slice's intent; every later feature needs a signed-in member.

**Independent Test**: With the first admin created, request a link for their email, open the link, click Sign in, and land on My issues signed in; request one for an unknown email and see the same message with no email sent.

**Acceptance Scenarios**:

1. **Given** `sam@acme.com` is an active member, **When** that email is entered on the sign-in page, **Then** a magic-link email is sent and the page shows "Check your email" (REQ-004.1).
2. **Given** `stranger@x.com` is not a member, **When** it is entered, **Then** no email is sent and the page shows the same "Check your email" (REQ-004.2).
3. **Given** Sam requested two links a minute apart, **When** Sam clicks the first one's Sign in button, **Then** Sam is signed in; each link works on its own until used or expired (REQ-004.3).
4. **Given** a magic link sent 10 minutes ago, **When** Sam opens it and clicks Sign in, **Then** Sam is signed in (REQ-005.1).
5. **Given** a magic link, **When** it is opened, **Then** a Sign in button shows and the link is not yet used; only clicking the button uses it. A mail scanner that opens the link first doesn't stop Sam from signing in with it afterwards (REQ-005, REQ-005.3).
6. **Given** a link sent more than 15 minutes ago, or already used, **When** the Sign in button is clicked, **Then** the page shows "This link has expired" with a button to request a new one, and nobody is signed in (REQ-005.2).
7. **Given** Sam requested the link on a laptop, **When** Sam opens it on another computer and clicks Sign in, **Then** Sam is signed in on that other computer (REQ-005.4).
8. **Given** Sam signs in, **When** the server logs the sign-in, **Then** the log records "sign-in, member sam" and never the token or the link (SEC-007.1).
9. **Given** the email `Sam@Acme.com` is entered while the member's email is `sam@acme.com`, **When** the link is requested, **Then** it is treated as Sam's email (emails are compared ignoring capitals).
10. **Given** Alex is signed in on a browser, **When** a magic link that isn't Alex's own is opened there (Sam's link, or one whose token is unknown or malformed), **Then** the page shows "You're signed in as Alex. Sign out to use this sign-in link.", naming Alex by full name, with a Sign out button, instead of the Sign in button, revealing nothing about the link; the link stays unused, and Alex stays signed in. When Alex clicks Sign out, Alex's session ends and the browser returns to the same `/sign-in?token=…`, which now shows the Sign in button; if the token is unknown, malformed, expired or used, "This link has expired" shows only after Sign in is clicked (REQ-005.5, as REQ-002.3 does for invitations).
11. **Given** a tab showing the Sign in button for Sam's link was opened before Alex signed in on that browser, **When** Alex clicks Sign in there, **Then** the link is not used, Alex's session is not replaced, and the page switches to "You're signed in as Alex. Sign out to use this sign-in link." with its Sign out button, with no toast (REQ-005.5).
12. **Given** Sam is signed in on a browser and has a new, unused magic link, **When** Sam opens it there and clicks Sign in, **Then** the Sign in button shows as usual (no special case); clicking it uses the link, starts a new session that replaces Sam's current one, and sends Sam to the link's destination (REQ-005).

---

### User Story 3 - Protected pages and return-to (Priority: P1)

Someone who isn't signed in and opens any page other than sign-in is sent to `/sign-in`; once signed in, they land on the page they originally asked for. An API request without a valid session answers `401`. After signing in, the member lands on `/my-issues`, which in this slice is an empty landing page inside the app shell.

**Why this priority**: Without STD-1, signing in protects nothing; without a landing page, a signed-in member has nowhere to go.

**Independent Test**: While signed out, open `/my-issues` and an unknown page address, call an `/api/…` endpoint; check redirects with return-to and the `401`. Sign in and check the return lands on the requested page.

**Acceptance Scenarios**:

1. **Given** nobody is signed in, **When** someone opens `/my-issues`, **Then** they are redirected to `/sign-in`, and after signing in they land on `/my-issues` (STD-1).
2. **Given** nobody is signed in, **When** someone opens a deep page address (for example `/project/WEB`), **Then** they are redirected to `/sign-in`; after signing in they are sent to `/project/WEB` (which shows Not found until RM-5 adds projects).
3. **Given** nobody is signed in, **When** an `/api/…` request other than requesting a magic link, using one, or signing out is sent, **Then** it answers `401` with the shared JSON error shape (STD-1, API-001); a sign-out request instead succeeds without an error and clears the session cookie (FR-019).
4. **Given** a member is signed in, **When** they open `/sign-in` without a token, or `/`, **Then** they are sent to `/my-issues`; opening a magic link (`/sign-in?token=…`, API-004) instead always shows the magic-link landing page (FR-011, FR-012, FR-023).
5. **Given** a signed-in member with no other content yet, **When** they open `/my-issues`, **Then** they see the app shell with a My issues heading and an empty landing state; RM-11 fills it with their issues.
6. **Given** a return-to address that points outside the app (another site), **When** sign-in completes, **Then** the member lands on My issues instead.

---

### User Story 4 - Stay signed in, and sign out (Priority: P2)

A member who uses the app at least once every 30 days stays signed in. A member away for more than 30 days is sent to sign-in. Signing out ends the session in that browser only; the member's sessions in other browsers continue.

**Why this priority**: Staying signed in is part of the slice's intent, but the first sign-in (Stories 1 to 3) is demonstrable without it.

**Independent Test**: Sign in, simulate activity over time and 31 days of inactivity; sign in in two browsers, sign out of one, check the other is still signed in.

**Acceptance Scenarios**:

1. **Given** Sam signed in and uses the app every day, **When** 40 days have passed since sign-in, **Then** Sam is still signed in, because each use restarts the 30 days (REQ-006.1).
2. **Given** Sam's last activity was 31 days ago, **When** Sam opens any page, **Then** Sam is sent to the sign-in page, and returns to that page after signing in (REQ-006.2, STD-1).
3. **Given** Sam is signed in on a laptop and a desktop, **When** Sam signs out on the laptop, **Then** the laptop is signed out and sent to `/sign-in`, and the desktop is still signed in (REQ-006).
4. **Given** Sam signed out, **When** the old session cookie value is sent again, **Then** it no longer works (`401` / redirect to sign-in).

---

### User Story 5 - Limits, failures and safe tokens (Priority: P2)

Sign-in requests are limited so nobody can flood inboxes or probe which emails are members. If the email service fails, the member is told to try again. Tokens can't be stolen from the database or the browser's scripts, and data-changing requests from other sites are refused.

**Why this priority**: These rules protect the sign-in flow and every later slice, but the happy path works without them.

**Independent Test**: Request a sixth link for one email within an hour; request 21 links from one IP address; make the email service fail; read stored token values from the database and try them; send a data-changing request marked as from another site.

**Acceptance Scenarios**:

1. **Given** Sam requested 5 links in the last hour, **When** Sam requests a 6th, **Then** the page shows "Too many sign-in requests. Try again later." and no email is sent (SEC-001.1).
2. **Given** `stranger@x.com` has been requested 5 times in the last hour, **When** it is requested a 6th time, **Then** the same limit message shows, so nobody can tell whether the email exists (SEC-001.2).
3. **Given** 20 sign-in requests came from one IP address in the last hour, for any mix of emails, **When** a 21st arrives from that address, **Then** the limit message shows and nothing is sent (SEC-001).
4. **Given** the email service fails when sending Sam's magic link, **When** Sam submits the sign-in form, **Then** Sam sees "We couldn't send the email. Try again." as a toast, the email field keeps what was typed (STD-6, STD-9), and the link that couldn't be sent can't be used.
5. **Given** someone reads every magic-link and session value stored in the database, **When** they use any of those values as a link or a session, **Then** none works (SEC-003.1).
6. **Given** a signed-in browser, **When** a page script tries to read the session, **Then** it can't; the session is sent only over HTTPS (outside local development), is sent when the member follows an ordinary link from another site (such as a magic link clicked in Gmail), and is never sent on form posts or background requests started by another site (SEC-004).
7. **Given** a data-changing request (such as requesting a magic link, using one, or signing out) that comes from another site, **When** it reaches the server, **Then** it is rejected with `403` and nothing changes (SEC-004).

---

### User Story 6 - One permission layer with two roles (Priority: P3)

Every request is checked on the server by one permission layer that knows who the member is and whether they are an Admin or a Member. Actions a member can't take are hidden; if reached anyway, the member sees "You don't have permission to do that." and the API answers `403`. This slice adds the layer and the two roles; the actions it guards arrive in later slices.

**Why this priority**: The layer must exist before RM-4 and RM-5 add admin-only actions, but this slice has no admin-only action of its own to demonstrate it on.

**Independent Test**: Unit tests call the layer with an Admin, a Member and no session against a rule that only admins pass, and check the allowed / `403` / `401` results and the STD-2 message.

**Acceptance Scenarios**:

1. **Given** a request with no valid session to any protected endpoint, **When** the layer checks it, **Then** the answer is `401` (STD-1).
2. **Given** a Member and an action section 7 allows only for Admins, **When** the layer checks it, **Then** the answer is `403` with "You don't have permission to do that." and nothing changes (STD-2, SEC-006).
3. **Given** an Admin and the same action, **When** the layer checks it, **Then** it is allowed.
4. **Given** a page reached by a member who isn't allowed to use it, **When** it shows, **Then** it shows "You don't have permission to do that." rather than the page's content (STD-2).

---

### Edge Cases

- Several valid links for one member: each works independently until it is used or expires (REQ-004.3); using one does not cancel the others.
- The Sign in button is clicked for the same link in two tabs, or again after reloading the page: each page load has its own `requestId`, so the first click signs in and the second shows "This link has expired" (single use, REQ-005.2), even though that browser is now signed in as the link's member. A retry from the same page load (Sign in clicked again after the failure toast, when the server used the link but its answer was lost) reuses that `requestId` and token, gets the first answer, and the member is signed in (FR-012).
- A magic link whose token is malformed, unknown or tampered with: when nobody is signed in on that browser, shows the Sign in button like any link, and clicking it shows "This link has expired" with the request-a-new-one button, the same as an expired link, revealing nothing more (FR-013). When a member is signed in, it shows the REQ-005.5 sign-out message instead, like any link that isn't theirs, and after they sign out the returned page shows the Sign in button, with "This link has expired" only after it is clicked (FR-011).
- A link is opened and its Sign in button clicked by a member who is no longer active (possible once RM-4 adds deactivation): no session is created; it shows "This link has expired". The active-member check is built here so RM-4 only has to set the flag.
- The sign-in form is submitted with an empty or malformed email (FR-003's email rule): field error next to the email (STD-3), nothing sent, and it counts toward neither limit.
- A sign-in request with no `X-Forwarded-For` header, or whose rightmost entry is empty after trimming: its IP key is the fixed value `unknown`, so all such requests share one 20-per-hour IP bucket (FR-008).
- Requests refused by a SEC-001 limit don't count toward it, so repeated refused attempts don't extend the block; requests for that email (or from that IP address) are allowed again one hour after the last allowed request (FR-008).
- The sign-in form is submitted again with the same `requestId` (for example a double click or a network retry) after the first was accepted (the email was sent, or the non-member got the normal answer): it gets the same answer as the first, no second email is sent, and it doesn't count again toward either limit, for member and non-member emails alike (FR-005).
- A repeat of a `requestId` whose first request was refused by a limit or whose send failed: that request was not recorded for its `requestId`, so the repeat is evaluated as a new request (FR-005), and counts toward the limits if it passes the check (FR-008).
- The form is submitted again after the "We couldn't send the email. Try again." toast: it is a new submission with a fresh `requestId`, handled as a new request (FR-005, FR-009). The failed request already counted toward both limits, so repeated failures can reach the limit (FR-008).
- The email service times out but still delivers the email: the link was already deleted as a failed send (FR-009), so clicking its Sign in button shows "This link has expired" with "Request a new link". Accepted.
- The email service fails for a non-member email: no email is attempted for a non-member, so they still see "Check your email" (REQ-004.2 takes precedence; only a real send can fail).
- A session cookie that is expired, unknown or ended by sign-out: treated as no session (STD-1); the browser's stale cookie is cleared.
- Signing out when already signed out (for example after signing out in another tab): lands on `/sign-in` without an error. The exception is the Sign out button on the magic-link landing page (REQ-005.5): it returns, without an error, to the same `/sign-in?token=…`, which shows the Sign in button, exactly as when the session was still active (FR-016).
- Sign out clicked in a stale landing-page tab after the browser's session changed to a different member (for example Alex signed out elsewhere, then Bob signed in): it ends whichever session the browser now has (Bob's), then reloads the same `/sign-in?token=…`, which shows the Sign in button (FR-016). Accepted.
- The setup command runs twice at the same moment on an empty database: at most one first admin is created; the other run refuses with "Setup already done".
- The return-to address is lost because the link is opened in another browser: the member still reaches the page originally asked for, because the destination travels with the magic link, not the browser (REQ-005.4).
- A magic link opened while a different member is already signed in on that browser: when Alex is signed in and opens Sam's magic link, the page asks Alex to sign out first, as REQ-002.3 does for invitations ("You're signed in as Alex. Sign out to use this sign-in link.", showing Alex's full name, REQ-005.5). The link is not used and Alex's session is never silently replaced. When Alex clicks Sign out there, Alex's session ends and the browser returns to the same `/sign-in?token=…`, which now shows Sam's Sign in button (FR-016); if Sam's link has meanwhile expired or been used, "This link has expired" shows only after Sign in is clicked; a valid link still works until it is used or expires.
- Sign in clicked in a tab opened before a different member signed in on that browser: when Alex signs in after the tab with Sam's Sign in button was opened, and then clicks Sign in there, the link is not used, Alex's session is not replaced, and the page switches to Alex's REQ-005.5 sign-out message with its Sign out button, with no toast (FR-011).
- A new, unused magic link opened by its own member who is already signed in on that browser: no special case; the Sign in button shows as usual, and clicking it uses the link, starts a new session that replaces the current one, and sends the member to the link's destination (FR-011, FR-012). The same holds when Sign in is clicked from a tab opened before the member signed in.

## Requirements *(mandatory)*

### Functional Requirements

**First admin (OPS-001)**

- **FR-001**: The system MUST provide a setup command that takes an email, full name and username and, only when no members exist, creates one active member with the Admin role from them (OPS-001). Running `npm run db:migrate` first is a precondition; on a database that hasn't been migrated, the command MUST exit 1 with the database error and create nothing.
- **FR-002**: The setup command MUST refuse with "Setup already done" and change nothing when its input is valid (FR-003) and any member already exists, including when two runs race (OPS-001.2).
- **FR-003**: The setup command MUST validate its input with the REQ-003 profile rules (full name 1 to 60 characters after whitespace at either end is trimmed, refused with "Name required" when blank or only whitespace and with "Too long (max 60)" when over 60 characters after trimming; username 2 to 20 lowercase letters, digits or hyphens, stored lowercase; a valid email: after whitespace at either end is trimmed, one that follows the WHATWG rule for `<input type="email">` and is at most 254 characters, the one rule shared with the sign-in form, FR-005) and refuse, naming the field, when any is invalid. The input MUST be validated before FR-002's check for existing members, so invalid input is refused with its field errors even when members exist.

**Members and roles**

- **FR-004**: The system MUST store each member with email, full name, username, role (Admin or Member), active or deactivated, and created at (section 8). Email and username MUST be unique ignoring capitals. This slice only creates members through FR-001.

**Requesting a magic link (REQ-004, SEC-001, STD-6)**

- **FR-005**: The system MUST provide a sign-in page at `/sign-in` with one email field. Submitting a valid email (FR-003's rule) MUST show "Check your email", whether or not the email belongs to an active member (REQ-004). Each magic-link request MUST carry a `requestId` generated by the browser, and every new form submission, including one after the FR-009 failure toast, MUST get a fresh `requestId`. Only an accepted request (the email was sent, or the non-member got the normal answer) is recorded with its `requestId` on the sign-in request record; a repeat of that `requestId` MUST get the same answer as the first, send no new email and not count again toward the FR-008 limits, for member and non-member emails alike (AGENTS.md). A repeat is matched on its `requestId` alone; the email and destination page sent with a repeat are ignored. A missing `requestId`, or one that isn't a UUID, MUST be answered with `422` and count toward neither limit. A request refused by a limit (FR-008) or whose send failed (FR-009) is not recorded, so a repeat of its `requestId` MUST be evaluated as a new request.
- **FR-006**: Only when the email (compared ignoring capitals) belongs to an active member MUST the system create a single-use magic link that expires 15 minutes after it is sent, and email it to that member (REQ-004, API-002).
- **FR-007**: Each magic link MUST work on its own until it is used or expires; requesting a new link MUST NOT cancel earlier ones (REQ-004.3).
- **FR-008**: The system MUST allow at most 5 magic-link requests per email address and 20 per IP address within an hour: for each email (or IP address), with `last` its latest counted request, requests are blocked while now is before `last` + 1 hour and at least 5 (or 20) counted requests fall in (`last` − 1 hour, `last`]. Every request that passes this limit check counts toward both limits, whether its email is sent or the send fails (FR-009); refused requests and repeats of an accepted request's `requestId` (FR-005) do not. This count is kept separately from the `requestId` replay record (FR-005). Past either limit it MUST show "Too many sign-in requests. Try again later." and send nothing, whether or not the email belongs to a member, until one hour after the last request that passed the check for that email (email limit) or from that IP address (IP limit) (SEC-001). The one exception is a repeat of an accepted request's `requestId`, which gets its first answer (FR-005).
- **FR-009**: If sending the magic-link email fails, the system MUST show "We couldn't send the email. Try again." as a toast, keep the typed email (STD-6, STD-9), and MUST NOT leave a usable link from the failed attempt. The failed request is not recorded for its `requestId` (FR-005) but still counts toward the FR-008 limits; submitting the form again sends a new request with a fresh `requestId`.
- **FR-010**: The magic-link email MUST carry the link to the magic-link landing page, `/sign-in?token=…` (API-004), built from the configured app address (`APP_URL`, FR-029) and never from the request's `Host` header, and MUST NOT put the token in a path segment (AGENTS.md, SEC-007). The destination page the member asked for (STD-1) is stored with the link, not put in the email's URL.

**Using a magic link (REQ-005)**

- **FR-011**: Opening a magic link MUST show a **Sign in** button and MUST NOT use up the link; only clicking the button uses it (REQ-005, REQ-005.3). This also holds, with no special case, when the link's own member is already signed in on that browser. A link's own member is the member a stored link was created for, whether or not that link has expired or been used; an unknown or malformed token has no member. When a member is signed in on that browser and the link isn't their own (another member's link, or a token that is unknown or malformed), the page MUST instead ask them to sign out first ("You're signed in as Alex. Sign out to use this sign-in link.", where "Alex" is the signed-in member's full name, with a Sign out button), as REQ-002.3 does for invitations (REQ-005.5), and MUST reveal nothing else about the token; it MUST NOT use the link or change that member's session. When that member clicks Sign in on a page opened before they signed in, the click MUST NOT use the link or replace their session, and the page MUST switch to that same message and Sign out button, with no toast. A valid link stays unused and still works after that member signs out. Clicking that Sign out button MUST end the signed-in member's session and return the browser to the same `/sign-in?token=…` (FR-016), which then shows the Sign in button for every token; when the token is unknown, malformed, expired or used, "This link has expired" with the request-a-new-one button shows only after Sign in is clicked (FR-013).
- **FR-012**: Clicking Sign in with a valid, unused, unexpired link for an active member MUST, when nobody is signed in on that browser or the signed-in member is the link's member, mark the link used, start a new session in that browser (replacing the current session in the latter case), and send the member to the destination page stored with the link (FR-010), or to `/my-issues` when there is none or it isn't a same-app path (REQ-005, STD-1). A same-app path starts with a single `/` (not `//` or `/\`), is at most 2,048 characters, and resolves against `APP_URL` to `APP_URL`'s origin; any such path is kept with its query string, including `/api/…`, `/health` and `/sign-in…`. When a member is signed in there and the link isn't their own, FR-011 applies (REQ-005.5). The Sign in click MUST carry a `requestId` generated by the browser: the landing page makes one per page load and reuses it when Sign in is retried after a failure toast. A repeat MUST be answered from the session the first click started (that browser is signed in to it and gets the first answer) only when its `requestId` matches, that session is still live, that session still has its magic link (a session outlives its link when RM-14 deletes the link, DATA-004), and the submitted token hashes to that link's stored token hash; once the link is gone, a repeat takes the normal path, matches no link and gets "This link has expired" (FR-013), never a cookie from the old session. The FR-011 check for a different signed-in member runs before this replay check: a repeat is answered from the earlier session only when nobody is signed in on that browser or the signed-in member is the link's member, so a replay never replaces another member's session (REQ-005.5). Any other request takes the normal path above, with one exception: a request whose `requestId` is already stored on a session but whose token is a different valid, unused link MUST be answered with `422`, create no session and leave that link unused, and MUST NOT write to the error log.
- **FR-013**: Clicking Sign in with a link that is expired, already used, unknown, malformed, or for a member who isn't active MUST show "This link has expired" with a button that leads to `/sign-in` to request a new one, and MUST NOT sign anyone in (REQ-005.2), except for a repeat that FR-012 answers from the session its first click started. This applies when nobody is signed in on that browser or the link is the signed-in member's own; otherwise FR-011 applies (REQ-005.5).
- **FR-014**: A magic link MUST work in any browser, not only the one that requested it (REQ-005.4).

**Sessions and sign-out (REQ-006, SEC-004)**

- **FR-015**: A session MUST last 30 days from the member's last activity; each authenticated request by the member MUST count as activity and restart the 30 days (REQ-006).
- **FR-016**: The system MUST let a signed-in member sign out from the app shell. Signing out MUST end that browser's session only and send the browser to `/sign-in`; the member's other sessions continue (REQ-006). Signing out when that browser's session has already ended MUST show no error and send the browser to `/sign-in`. The one exception is the Sign out button on the magic-link landing page (`/sign-in?token=…`, REQ-005.5, FR-011), which MUST instead return the browser to that same `/sign-in?token=…`, now showing the Sign in button for every token, also with no error when that browser's session has already ended elsewhere (for example signed out in another tab); when the token is unknown, malformed, expired or used, "This link has expired" shows only after Sign in is clicked (FR-011, FR-013).
- **FR-017**: The session MUST be kept in a cookie that page scripts can't read and that is sent only over HTTPS (local development excepted). Of the requests started by other sites, it MUST be sent on ordinary top-level link clicks (for example a magic link clicked in Gmail) and never on form posts or background requests (SEC-004); FR-018 still rejects every data-changing request from another site.
- **FR-018**: The system MUST reject with `403` and STD-2's message "You don't have permission to do that.", changing nothing, any data-changing request that comes from another site, including requesting a magic link, using one and signing out (SEC-004).

**Access control (STD-1, STD-2, SEC-006)**

- **FR-019**: Every page except `/sign-in` and the magic-link landing page (`/sign-in?token=…`, API-004), and every `/api/…` endpoint except requesting a magic link, using one, and signing out, MUST require a valid session. `/health` stays open (OPS-005). The sign-out endpoint MUST succeed with or without a valid session (idempotent): it ends the session if there is one, clears the session cookie, and never answers `401`; FR-018 still applies to it.
- **FR-020**: A page request without a valid session MUST redirect to `/sign-in`, remembering the requested page with its query string so the member returns to it after signing in (FR-012's same-app rule); an API request without one MUST answer `401` with the message "Not signed in", which is API-only and never shown in the UI (STD-1), except the endpoints FR-019 exempts (requesting a magic link, using one, and signing out).
- **FR-021**: The system MUST check permissions in one server-side layer used by every read and write, which knows the signed-in member and their role (Admin or Member) and answers `403` with "You don't have permission to do that." when the role may not take the action (STD-2, SEC-006, section 7).
- **FR-022**: The signed-in member's role MUST be available to every page, so the UI can hide actions the role can't take (STD-2). RM-3 has no role-restricted action, so no control is hidden in this slice.
- **FR-023**: A signed-in member who opens `/sign-in` without a token (with or without `next`; `next` is ignored when already signed in), or `/`, MUST be sent to `/my-issues`. `/sign-in` with a token (`/sign-in?token=…`, the magic-link landing page, API-004) MUST NOT redirect. If the `token` parameter is present at all, the landing page shows, using its first value; an empty or malformed token is handled like an unknown one (FR-011, FR-013), so "This link has expired" shows only after Sign in is clicked, never a `422`. The landing page shows the sign-out message for a different signed-in member (REQ-005.5, FR-011), or the normal Sign in button for the link's own member (FR-012).

**Landing page**

- **FR-024**: The system MUST provide `/my-issues` as the signed-in landing page, inside the app shell, showing a My issues heading and an empty landing state; its content is deferred to RM-11. The sidebar MUST link to it.
- **FR-025**: The app shell MUST show who is signed in (their name or initials) and the sign-out action. Initials MUST follow REQ-003.4: the first character of the first word and the first character of the last word of the full name, whatever that character is (a letter in any script, a digit or punctuation), uppercased where uppercasing applies; a one-word name gives a single character.

**Tokens and logs (SEC-003, SEC-007)**

- **FR-026**: Magic-link and session tokens MUST be created from at least 128 random bits, and only a hash of each MUST be stored (SEC-003).
- **FR-027**: The system MUST log a sign-in as "sign-in, member {username}" and MUST NOT write tokens, magic links, cookie values or email addresses to any log (SEC-007, SEC-007.1).

**Email provider (DEC-003, API-002, NFR-008, NFR-009)**

- **FR-028**: Magic-link emails MUST be sent through a transactional email provider chosen to meet DEC-003: an HTTP API and bounce webhooks, sending from the team's domain with SPF and DKIM, within the NFR-009 monthly budget. If no provider fits, the work MUST stop and ask the owner.
- **FR-029**: The provider's API key and sender settings MUST live only in the server configuration file, never in the repository (OPS-006). The app server (`next dev`, `next start`) MUST refuse to start without its required settings, naming the setting: `APP_URL` and `EMAIL_FROM` in both environments, plus `RESEND_API_KEY` outside local development or `MAILPIT_HOST` and `MAILPIT_PORT` in local development (FR-031). It MUST also check their format at start-up (`APP_URL` an absolute `http` or `https` origin, `MAILPIT_PORT` an integer from 1 to 65535, `EMAIL_FROM` a valid email by FR-003's rule) and exit 1 with "Invalid setting: NAME" for a bad one. This applies to the app server only; the setup command, `npm run db:seed` and `npm run db:migrate` need only `DATABASE_URL`.
- **FR-030**: The magic-link email MUST be plain and short enough to send immediately, so 95% arrive within 1 minute (NFR-008).
- **FR-031**: Local development MUST be able to complete a sign-in end to end. In local development every email the app sends MUST be delivered to a local mail catcher the developer runs (Mailpit), never to the real email provider, and the developer opens the magic link from there; the app refuses to start without the Mailpit settings (FR-029). Magic links MUST still never appear in logs (SEC-007).

**Quality**

- **FR-032**: Every `Verify: auto` example in scope (REQ-003.4, REQ-004.1 to REQ-004.3, REQ-005.1 to REQ-005.5, REQ-006.1, REQ-006.2, SEC-001.1, SEC-001.2, SEC-003.1, SEC-007.1, and OPS-006.1: a configured `RESEND_API_KEY` value never appears in the repository) MUST be covered by an automated unit or component test run through the project's test command (DEC-005); OPS-001.1 and OPS-001.2 are verified by running the command (Verify: ops) and also covered by unit tests.
- **FR-033**: This slice MUST add its data (members, and sessions where useful) to the NFR-001 seed script, starting it if it doesn't exist (ROADMAP rules).

### Key Entities

- **Member**: a person with an account: email, full name, username, role (Admin or Member), active or deactivated, created at. Email and username unique ignoring capitals; never deleted. Created here only by the setup command.
- **Magic link**: a one-time sign-in link for one member: hashed secret token, destination page, expires at (15 minutes after sending), used at.
- **Session**: a member's signed-in state in one browser: member, hashed secret token, the Sign in click's `requestId` (unique), the magic link that started it (empty once that link is deleted, DATA-004), last active at, ended at; ends 30 days after last activity, on sign-out, or when a new sign-in in the same browser replaces it.
- **Sign-in request record**: what a repeated `requestId` is answered from: the browser-generated `requestId` (unique), for each accepted magic-link request (the email was sent, or the non-member got the normal answer). Requests refused by a limit or whose send failed are not recorded here, so a repeat of their `requestId` is evaluated as a new request; repeats of an accepted request's `requestId` don't count again toward the limits.
- **Sign-in limit record**: what the SEC-001 limits count, kept separately from the sign-in request record: the email (normalised) and the IP address of each magic-link request that passed the limit check, whether its send succeeded or failed, with its time, kept at least one hour. Refused requests and repeats of an accepted request's `requestId` are not counted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh install, the owner goes from running the setup command to being signed in on My issues in under 5 minutes, following the documented steps alone (which run `npm run db:migrate` before the setup command).
- **SC-002**: 100% of the in-scope `Verify: auto` examples listed in FR-032 pass in the automated test run.
- **SC-003**: For a member email and a non-member email, the sign-in page's message, and its limit message, are identical in 10 out of 10 tries each.
- **SC-004**: 95% of magic-link emails arrive within 1 minute, per the provider's delivery logs (NFR-008), measured in production once RM-2 and the owner's Resend domain exist, and checked in RM-14. In RM-3, FR-030 is checked by the email contract test.
- **SC-005**: A search of the logs from the full test run and a manual sign-in finds zero tokens, magic links, session cookie values or email addresses, and finds the "sign-in, member {username}" line for each sign-in.
- **SC-006**: None of the token values stored in the database works as a link or session, in 100% of tries.
- **SC-007**: Signed out, 100% of the protected pages and API endpoints tried (`/`, `/my-issues`, `/project/WEB` as an unknown page, and `/api/anything` with every method) redirect to sign-in or answer `401` (requesting a magic link, using one, and signing out are not protected, FR-019); after signing in, the member lands on the page originally asked for.
- **SC-008**: Running cost added by the email provider keeps the whole app under $20 per month (NFR-009).
- **SC-009**: `/sign-in`, the magic-link landing page (`/sign-in?token=…`) and `/my-issues` are usable within 1.5 s of navigation on broadband with a warm cache (NFR-002).

## Assumptions

- RM-1 is done: the app shell, Not found page, shared field errors, toast, loading / empty / error states, API conventions, request logging, configuration file and `/health` exist and are reused here.
- RM-2 (production deploy, HTTPS) may not be done yet; the cookie's HTTPS-only rule applies outside local development, and local development over plain HTTP is the only exception.
- "Local development" (FR-017, FR-029, FR-031) is any `NODE_ENV` other than `production`: `next dev` and `npm test`. `npm run build && npm start` is production, even on a laptop.
- Sign-in is passwordless only; there are no passwords, social sign-in or public sign-up (section 3, F-001).
- Invitations, profile editing, deactivation, reactivation and promoting members are RM-4. The only member this slice can create is the first admin; the Admin/Member distinction and the "active" check are built now so RM-4 only adds the actions.
- SEC-004.1's example (a cross-site delete of `WEB-42`) needs issues and is checked in RM-6; the cross-site rejection itself is built and tested here on sign-in's own data-changing requests (requesting a link, using one, signing out).
- My issues content (REQ-041, REQ-042) is RM-11; here `/my-issues` is an empty landing page. For RM-3's empty state, `design.md` reuses REQ-041.4's "Nothing assigned to you".
- The destination page for STD-1 travels with the magic link so it survives opening the link in another browser (REQ-005.4); only same-app paths are honored: a string starting with a single `/` (not `//` or `/\`), at most 2,048 characters, with the same origin as `APP_URL` once resolved against it; anything else goes to `/my-issues` (FR-012).
- "Activity" for REQ-006 (FR-015's "authenticated request") is every page request, including the magic-link landing page, and every API request that validates the session; requesting a magic link does not count; the stored last-active time may be refreshed at a coarse interval (for example once a minute) without changing the 30-day rule.
- "Requests from other sites" (SEC-004, FR-017, FR-018) means requests started by a page on another site: an ordinary top-level link click, which carries the session cookie, or a form post or background request (made by that page's scripts, images or frames), which doesn't. Either way, FR-018 rejects any data-changing request from another site with `403`. A request is from another site when its `Sec-Fetch-Site` header is anything other than `same-origin` (so a sibling subdomain counts as another site) or, without that header, its `Origin` differs from the app's; a request with neither `Sec-Fetch-Site` nor `Origin` passes.
- The time to answer a sign-in request may differ between member and non-member emails, which could hint at which emails are members. This is accepted as a known limitation for a small invite-only team; no minimum response time is required. The page's messages stay identical (SC-003).
- During an email-provider outage the "We couldn't send the email. Try again." toast shows only for member emails, so it can reveal which emails are members. This is accepted as a known limitation for a small invite-only team, like the timing difference.
- The IP address used for SEC-001 is the rightmost `X-Forwarded-For` entry, trimmed; when the header is missing or that entry is empty, the fixed key `unknown` is used, so all such requests share one 20-per-hour bucket. RM-2's reverse proxy must append or overwrite that header; until RM-2 there is no public deployment, so a client being able to set the value is accepted.
- A failed send (STD-6) is retried by the member, not by the app; automatic retries apply only to notification emails (RM-13). A request whose send failed still counts toward the SEC-001 limits (FR-008), though it isn't recorded for its `requestId` (FR-005).
- The email provider is Resend, chosen during planning (DEC-003, research R2). Its free tier (3,000 emails a month and 100 a day, checked 2026-10-01) is the basis of SC-008; notification volume against the daily cap is a risk carried to RM-13. Bounce webhooks (API-003) are only needed for notifications (RM-13), but the provider must support them. Any new package the provider needs requires owner approval (Constitution IV); calling its HTTP API directly avoids one.
- Owner's production prerequisite, a dependency of FR-028 and SC-004: a Resend account, the sending domain with its SPF and DKIM records, and `RESEND_API_KEY` and `EMAIL_FROM` in the server's configuration file. Local development doesn't need it.
- `POST /api/sign-in-links` is exempt from NFR-003's 500 ms write limit, because it includes the provider call and STD-6 needs the send result before answering.
- Deleting used or expired magic links, ended sessions, sign-in limit records and sign-in request records 30 days after they stop being useful (DATA-004) is RM-14.
- The UI for `/sign-in`, "Check your email", the magic-link landing page, "This link has expired", the limit message, the send-failure toast, sign-out and `/my-issues` is recorded by `/speckit-design` before planning (Constitution V), including the magic-link email itself.
