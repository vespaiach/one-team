# UI Design: Magic-link Sign-in

**Branch**: `colau/speckit-sdd-orchestrator-75b0f0` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Roadmap entry**: RM-3: Magic-link sign-in

**Canvas**: [Tracklite.dc.html](https://claude.ai/design/p/7dc7082d-0aee-4b0b-ba4b-e287873f44f1?file=Tracklite.dc.html&via=share), page "RM-3 Magic-link sign-in", frames 3a to 3z, 3aa and 3ab | **Canvas version**: file version 1790877585873900, re-read 2026-10-01 after the six reworded rows (the share link carries no version number); every frame unchanged and still matching its row. Re-read again 2026-10-01 after the owner's avatar redraw (open question 19; the read returns no version number): the same 28 frames, every non-N/A row still mapped, no extra frame; the avatar in all nine frames 3q to 3y shows `--ink` initials on a `--surface-3` disc with a `--hairline-tertiary` rim, which the owner's revised answer to open question 19 now matches

**Status**: Frozen

**Last frozen**: 2026-10-01, re-frozen after open question 19 was revised by the owner to match the redrawn frames 3q to 3y: avatar initials in `--ink` #f6f0eb on a `--surface-3` #211a16 disc with a `--hairline-tertiary` rim, 15.18:1, replacing answer (a); color only, no behavior change. Rows changed: Component map, App shell signed-in member; open question 19; canvas notes. Frames 3q to 3y match. Earlier: re-frozen after the spec.md wording change: the Key Entity "Sign-in limit count" is renamed "Sign-in limit record", and an Assumption now says design.md reuses REQ-041.4's "Nothing assigned to you" for RM-3's My issues empty state, which this file already does (My issues Empty, Copy, Component map, open question 9). Rows changed: none; the canvas is unchanged. Earlier freeze, same day, re-frozen after the spec.md change to its Assumptions, which now also list sign-in limit records and sign-in request records among what RM-14 deletes 30 days after they stop being useful (DATA-004). Rows changed: none (the deletions happen long after the one-hour SEC-001 limit window and the 15-minute link expiry, and add no screen, state, copy, component or focus change); the canvas is unchanged. Earlier freeze, same day, re-frozen after the spec.md change: spec.md FR-012 now runs the "signed in as another member" check before the `requestId` replay check (a retry after a lost answer never replaces another member's session) and replays only while the first click's session is still live; a new edge case and FR-008 give a missing or empty `X-Forwarded-For` the shared per-IP key `unknown` (no UI change); FR-003 makes the setup command refuse a full name over 60 characters with "Too long (max 60)" (command-line output only in RM-3, no screen); the Session key entity gained fields (no UI change). Also fixes analyze finding I5 (a "Request a new link" click from a browser signed in as the link's own member lands on `/my-issues`, FR-023). Rows changed: Screens note on the setup command; Sign-in Limit reached (cause text only); Magic-link landing Link expired, Signed in as another member and Submit failed (cause text only); Keyboard and focus, Magic-link landing (focus after "Request a new link"); open question 18 (answer text only). No frame or copy changes. The component map names no file location for the Sign out button, so the move of `SignOutButton` to `src/components/layout/` changes no row here (file locations belong in plan.md). Earlier freeze, same day, re-frozen after the spec.md change to FR-012 (a replayed Sign in `requestId` is answered from the first session only while that session still has its magic link, otherwise "This link has expired"; a reused `requestId` with a different valid link answers `422`, which the landing page never sends, so it has no UI state) and FR-032 (REQ-003.4; the sign-in request record no longer stores the answer). Rows changed: Magic-link landing Link expired and Submit failed (cause text only). No frame or copy changes. Earlier freeze, same day, after the spec.md Clarifications of Session 2026-10-01 (CHK001, CHK021, CHK022, CHK033, CHK034, CHK035) changed Screens, Magic-link landing; Sign-in Field error; Magic-link landing Populated, Link expired, Signed in as another member, Submit failed, Not found; Keyboard and focus, Magic-link landing

**Authority**: `docs/tracklite-spec.md` decides behavior, permissions and copy. This file and the canvas decide layout only.

## Screens

| Screen | Kind | Route or host page | Signed in? | Spec rules |
|--------|------|--------------------|------------|------------|
| Sign-in | page | `/sign-in` without a token (API-004); a signed-out visit to any protected page redirects here, remembering that page (STD-1). Standalone, centred, no sidebar (open question 2) | No (a signed-in member is sent to `/my-issues`, FR-023) | REQ-004, SEC-001, STD-1, STD-3, STD-5, STD-6, STD-9, FR-005 to FR-009, FR-020, FR-023 |
| Magic-link landing | page | `/sign-in?token=…` (API-004), the link in the magic-link email; the token is in the query string, never a path segment (FR-010, SEC-007); it never redirects (FR-023). Shown whenever the `token` parameter is present, even empty or repeated (its first value is used, FR-023). Standalone, centred, no sidebar, in every state (open question 2) | No; also shown to a browser already signed in, as the link's member or as another member (FR-011, FR-012) | REQ-005, REQ-005.1 to REQ-005.5, STD-1, STD-5, STD-9, FR-011 to FR-014, FR-016, FR-023 |
| My issues | page | `/my-issues` (API-004), inside the app shell; the signed-in landing page | Yes | FR-024, F-007, REQ-041.4 (empty message), STD-1, STD-7 (content deferred to RM-11) |
| App shell | page frame (changed) | The frame around every signed-in page; adds the "My issues" sidebar link and, at the bottom of the sidebar, the signed-in member and Sign out | Yes | FR-016, FR-024, FR-025, REQ-003 (initials avatar), REQ-006 |
| Not allowed | page state | Any page a member's role may not use, shown inside the app shell; no RM-3 page reaches it (the first is `/settings/members`, RM-4); rendered by component tests | Yes | STD-2, SEC-006, FR-021, FR-022, spec User Story 6 scenario 4 |
| Magic-link email | email | Sent when an active member's email is entered on Sign-in | — | REQ-004, API-002, NFR-008, FR-006, FR-010, FR-030 |

`/` renders nothing of its own any more: a signed-in member is sent to `/my-issues` (FR-023), a signed-out visitor to `/sign-in` (STD-1). The Not found page (RM-1) is unchanged apart from the app shell around it, and now needs a session like every other page (FR-019). The toast (RM-1) is reused unchanged; its texts are recorded under each screen's Submit failed state. `/health` and the `/api/…` JSON answers have no layout. The setup command (OPS-001) is a command-line tool, not a screen; its refusals ("Setup already done", and per field, for example "Name required" or "Too long (max 60)" for the full name, FR-002, FR-003) are command-line output, not UI copy (the profile form that shows these as field errors is RM-4).

## State inventory

| Screen | State | Caused by | Canvas frame |
|--------|-------|-----------|--------------|
| Sign-in | Populated | REQ-004, FR-005: the heading, one email field and the send button, empty on arrival | 3a Sign-in |
| Sign-in | Check your email | REQ-004.1, REQ-004.2: "Check your email" replaces the form and does not repeat the entered email; identical for member and non-member emails (SC-003). Requesting again means reopening `/sign-in` | 3b Check your email |
| Sign-in | Limit reached | SEC-001, SEC-001.1, SEC-001.2, FR-008: the inline message "Too many sign-in requests. Try again later." under the form, the typed email kept, nothing sent; identical for member and non-member emails; shown until the form is submitted again. Requests with no `X-Forwarded-For` header, or an empty rightmost entry, share one per-IP limit under the key `unknown` and show the same message (FR-008, spec edge case); no other UI | 3c Limit reached |
| Sign-in | Loading | N/A: the page loads no data | — |
| Sign-in | Empty | N/A: a form, not a list | — |
| Sign-in | Load error | N/A: the page loads no data | — |
| Sign-in | Field error | STD-3, FR-003, FR-005, spec edge case: an email that, after whitespace at either end is trimmed, is empty, fails the WHATWG `<input type="email">` rule or is longer than 254 characters → "Enter a valid email address." under the email field, the typed text kept, nothing sent | 3d Field error |
| Sign-in | Saving | STD-5: the send button is disabled while the request is in flight | 3e Saving |
| Sign-in | Submit failed | STD-6, STD-9, FR-009: the email send failed → toast "We couldn't send the email. Try again." for 5 seconds, the typed email kept; a network or server error → toast "Couldn't save. Try again." (STD-9, DEC-006) | 3f Send failed; 3g Couldn't save |
| Sign-in | Conflict | N/A: no editor | — |
| Sign-in | Not allowed | N/A: the page needs no role; a cross-site request (`403`, FR-018) can't come from this page's own form | — |
| Sign-in | Not found | N/A: fixed address | — |
| Sign-in | Signed out | N/A: this page is where STD-1 sends a signed-out visitor; a signed-in member opening it without a token is redirected to `/my-issues` (FR-023), so nothing renders for them | — |
| Sign-in | Archived project | N/A: no project on this page | — |
| Sign-in | Deactivated member | N/A: a deactivated member's email gets the same "Check your email" with nothing sent (REQ-004, REQ-007.1; deactivation is RM-4); no distinct UI | — |
| Sign-in | Long content | An email of up to 254 characters scrolls inside the field; the field error, limit message and toasts wrap, never truncated; "Check your email" does not echo the email | 3h Long email |
| Sign-in | Phone width | Section 3, NFR-006: works, not polished | 3i Sign-in phone |
| Magic-link landing | Populated | REQ-005, REQ-005.3, FR-011: the heading and a Sign in button; opening the page does not use the link. When nobody is signed in, this is always what the page shows first, for every token (valid, unknown, malformed, empty, expired or used), including on the page the browser returns to after the REQ-005.5 Sign out (REQ-005.5, FR-011, FR-016, Clarifications 2026-10-01); opening the page reveals nothing about the token. Also shown, with no special case, when the browser is signed in as the link's own member; clicking then replaces that session (FR-011, FR-012) | 3j Landing |
| Magic-link landing | Link expired | REQ-005.2, FR-013: only after Sign in is clicked, never when the page opens (REQ-005.5, Clarifications 2026-10-01), with a link that is expired, used, unknown, malformed, empty or for an inactive member (including Sign in clicked in another tab or after a reload once the link was used, since each page load has its own `requestId`, FR-012; a retry from the same page load once the link it used has been deleted, RM-14, DATA-004, or once the session its first click started has ended, FR-012; and a link whose send timed out but was still delivered, deleted as a failed send, FR-009; spec edge cases) → "This link has expired" with "Request a new link", which leads to `/sign-in`; nobody is signed in by the click (a browser already signed in as the link's own member stays signed in, spec edge case, so "Request a new link" there lands on `/my-issues`, since a signed-in `/sign-in` redirects, FR-023). Applies when nobody is signed in or the link is the signed-in member's own; otherwise Signed in as another member shows (FR-013) | 3k Link expired |
| Magic-link landing | Signed in as another member | REQ-005.5, FR-011: "You're signed in as {full name}. Sign out to use this sign-in link." with a Sign out button, instead of the Sign in button; the link stays unused and the member stays signed in. Shown on opening for every token that isn't the signed-in member's own, including unknown and malformed ones, so the page reveals nothing about the token (open question 14). Also shown, replacing Populated without a page load and with no toast, when a Sign in click comes from a tab opened before that member signed in, including a retry from the same page load after a lost answer (this check runs before the `requestId` replay, FR-012); the link isn't used and the session isn't replaced (open question 15). Sign out ends that session and returns the browser to the same `/sign-in?token=…`, now showing Populated for every token; Link expired only after Sign in is clicked (FR-016, FR-013). The same, with no error, when that session had already ended elsewhere (for example signed out in another tab) before Sign out was clicked (REQ-005.5, FR-016, spec edge case "Signing out when already signed out"); and when, in a stale tab, the browser's session had meanwhile changed to a different member, Sign out ends whichever session the browser now has and returns to the same `/sign-in?token=…` (FR-016, spec edge case) | 3l Another member |
| Magic-link landing | Loading | N/A: nothing loads after the page opens; its state is known when it opens | — |
| Magic-link landing | Empty | N/A: no list | — |
| Magic-link landing | Load error | N/A: nothing loads after the page opens | — |
| Magic-link landing | Field error | N/A: no field | — |
| Magic-link landing | Saving | STD-5: the Sign in button, or the Sign out button in Signed in as another member, is disabled after the click until the answer arrives (the answer to Sign in is the destination page, Link expired, or Signed in as another member) | 3n Landing saving (Sign in disabled); 3aa Another member saving (Sign out disabled) |
| Magic-link landing | Submit failed | STD-9, DEC-006: a network or server error on Sign in or Sign out → toast "Couldn't save. Try again."; the button is enabled again, and after a failed Sign out the member is still signed in. Sign in clicked again from the same page load reuses that load's `requestId`, so when the server had used the link but its answer was lost, the retry gets the first answer and signs the member in while that session is still live and still has its magic link, and only when nobody is signed in on that browser or the signed-in member is the link's member (once the link has been deleted, RM-14, DATA-004, or that session has ended, the retry shows Link expired; when another member has signed in on that browser meanwhile, the retry shows Signed in as another member and that member's session is kept, FR-012); otherwise the retry is an ordinary Sign in (FR-012, spec edge cases). A Sign out whose session had already ended elsewhere is not a failure: no toast, the browser returns to the same `/sign-in?token=…` (FR-016, FR-019, DEC-002) | 3o Landing failed (after Sign in); 3ab Another member failed (after Sign out) |
| Magic-link landing | Conflict | N/A: no editor | — |
| Magic-link landing | Not allowed | N/A: the page needs no role; the cross-site `403` (FR-018) can't come from this page's own buttons | — |
| Magic-link landing | Not found | N/A: an unknown, malformed or empty token shows Populated on opening and Link expired after Sign in (FR-013, spec edge case), or Signed in as another member (FR-011), never Not found | — |
| Magic-link landing | Signed out | N/A: the page is open without a session (FR-019); signed out is its normal case (Populated) | — |
| Magic-link landing | Archived project | N/A: no project on this page | — |
| Magic-link landing | Deactivated member | FR-013, spec edge case: a link for a member who isn't active shows Link expired after Sign in (same frame as Link expired); RM-4 adds deactivation | 3k Link expired |
| Magic-link landing | Long content | The signed-in member's full name in "You're signed in as …" can be up to 60 characters (REQ-003): the message wraps, never truncated | 3m Another member long name |
| Magic-link landing | Phone width | Section 3, NFR-006: works, not polished; the link is usually opened in a phone's mail app | 3p Landing phone |
| My issues | Populated | N/A: issue groups and rows are RM-11 (REQ-041, REQ-042) | — |
| My issues | Empty | FR-024, REQ-041.4: the "My issues" heading and "Nothing assigned to you" | 3v My issues |
| My issues | Loading | N/A: the page loads no data in RM-3 (RM-11) | — |
| My issues | Load error | N/A: the page loads no data in RM-3 (RM-11) | — |
| My issues | Field error | N/A: no form | — |
| My issues | Saving | N/A: no form | — |
| My issues | Submit failed | N/A: no form | — |
| My issues | Conflict | N/A: no editor | — |
| My issues | Not allowed | N/A: every member may open their own My issues (section 7, REQ-041) | — |
| My issues | Not found | N/A: fixed address | — |
| My issues | Signed out | N/A: redirect to `/sign-in`, returning here after sign-in (STD-1, FR-020, REQ-006.2); nothing renders, the Sign-in frames apply | — |
| My issues | Archived project | N/A: archived projects' issues are hidden from My issues in RM-11 (REQ-013.2) | — |
| My issues | Deactivated member | N/A: no other member shown; a deactivated member can't be signed in (RM-4, REQ-007) | — |
| My issues | Long content | N/A: only fixed text in RM-3; long titles and project names are RM-11 (REQ-042.3) | — |
| My issues | Phone width | Section 3, NFR-006: works, not polished; the sidebar stacks above the main area | 3w My issues phone |
| App shell | Populated | FR-024, FR-025: sidebar with "Tracklite" (plain text), the "My issues" link (marked as the current page on `/my-issues`), and at the bottom the signed-in member (initials avatar and full name) with a Sign out button | 3q App shell |
| App shell | Loading | N/A: the signed-in member arrives with the page; no separate load | — |
| App shell | Empty | N/A: the sidebar always has the My issues link; the project list and its empty state are RM-5 (REQ-015) | — |
| App shell | Load error | N/A: nothing loads separately | — |
| App shell | Field error | N/A: no form | — |
| App shell | Saving | STD-5: Sign out is disabled after the click until the answer arrives | 3r Shell saving |
| App shell | Submit failed | STD-9, DEC-006: a network or server error on Sign out → toast "Couldn't save. Try again."; still signed in. A Sign out whose session had already ended elsewhere is not a failure: no toast, the browser goes to `/sign-in` (FR-016, FR-019, DEC-002) | 3s Shell failed |
| App shell | Conflict | N/A: no editor | — |
| App shell | Not allowed | N/A: RM-3 has no role-limited control in the shell; later slices hide theirs from the member's role (FR-022, STD-2); the Not allowed page is its own screen | — |
| App shell | Not found | N/A: shown by the Not found page inside the shell (RM-1) | — |
| App shell | Signed out | N/A: every page in the shell needs a session (FR-019); a signed-out visitor is redirected (STD-1); signing out sends the browser to `/sign-in` (FR-016), a standalone page without the shell, also with no error when the session had already ended elsewhere (FR-016, FR-019, spec edge case "Signing out when already signed out") | — |
| App shell | Archived project | N/A: no projects until RM-5 | — |
| App shell | Deactivated member | N/A: a deactivated member's sessions end (REQ-007, RM-4); no other member is shown | — |
| App shell | Long content | A full name of up to 60 characters (REQ-003) is cut off with "…" and shown in full on hover | 3t Shell long name |
| App shell | Phone width | Section 3, NFR-006: works, not polished; the sidebar, with the member and Sign out, stacks above the main area | 3u Shell phone |
| Not allowed | Populated | STD-2, FR-021, spec User Story 6 scenario 4: "You don't have permission to do that." as the heading instead of the page's content, with a "My issues" link as on Not found, inside the app shell | 3x Not allowed |
| Not allowed | Loading | N/A: static message, no data | — |
| Not allowed | Empty | N/A: static message, no list | — |
| Not allowed | Load error | N/A: static message, no data | — |
| Not allowed | Field error | N/A: no form | — |
| Not allowed | Saving | N/A: no form | — |
| Not allowed | Submit failed | N/A: a `403` on submit is the STD-9 toast (RM-1 Toast), not this page | — |
| Not allowed | Conflict | N/A: no editor | — |
| Not allowed | Not allowed | This screen is the state (STD-2) | 3x Not allowed |
| Not allowed | Not found | N/A: Not found is its own page (STD-4) | — |
| Not allowed | Signed out | N/A: a signed-out visitor is redirected to sign-in before any permission check (STD-1); the API answers `401`, not `403` | — |
| Not allowed | Archived project | N/A: no project on this page | — |
| Not allowed | Deactivated member | N/A: no member shown | — |
| Not allowed | Long content | N/A: fixed text only | — |
| Not allowed | Phone width | Section 3, NFR-006: works, not polished | 3y Not allowed phone |
| Magic-link email | Populated | REQ-004, FR-006, FR-010, FR-030: a short plain-text message with the sign-in link | 3z Magic-link email |
| Magic-link email | Loading | N/A: an email loads nothing | — |
| Magic-link email | Empty | N/A: always has content | — |
| Magic-link email | Load error | N/A: an email loads nothing | — |
| Magic-link email | Field error | N/A: no form | — |
| Magic-link email | Saving | N/A: no form | — |
| Magic-link email | Submit failed | N/A: a failed send is shown on Sign-in (STD-6); no email arrives | — |
| Magic-link email | Conflict | N/A: no editor | — |
| Magic-link email | Not allowed | N/A: sent only to active members (REQ-004) | — |
| Magic-link email | Not found | N/A: no address of its own | — |
| Magic-link email | Signed out | N/A: no session involved in reading an email | — |
| Magic-link email | Archived project | N/A: no project | — |
| Magic-link email | Deactivated member | N/A: never sent to a deactivated member (REQ-004, REQ-007.1) | — |
| Magic-link email | Long content | The link is long (token plus query string): shown whole, wrapping, never shortened | 3z Magic-link email |
| Magic-link email | Phone width | Section 3: phone mail apps; plain short text wraps | 3z Magic-link email |

The canvas is a visual reference for layout only; its markup and inline values are not copied into code or into this file. Every non-N/A row has a frame and none is partly drawn. Frames 3q to 3y draw the avatar as `--ink` on `--surface-3` with a `--hairline-tertiary` rim, matching the Component map and the revised answer to open question 19. No frame shows anything outside the inventory: the email shown in 3c to 3h is typed text kept after submitting (3a and 3i show the field empty on arrival, open question 17), and the initials in 3q to 3y ("ON") and 3t ("AB") follow REQ-003.4 (open question 18).

## Copy

| Screen | Element | Text | Source |
|--------|---------|------|--------|
| Sign-in | page heading | "Sign in to Tracklite" | design (approved, open question 12) |
| Sign-in | email field label | "Email" | design (approved, open question 12) |
| Sign-in | send button | "Send sign-in link" | design (approved, open question 12) |
| Sign-in | field error (empty or malformed email) | "Enter a valid email address." | design (approved, open question 12; STD-3 gives no string) |
| Sign-in | confirmation (replaces the form) | "Check your email" | REQ-004.1, REQ-004.2 |
| Sign-in | limit message (inline, under the form) | "Too many sign-in requests. Try again later." | SEC-001 |
| Sign-in | toast, email send failed | "We couldn't send the email. Try again." | STD-6 |
| Sign-in | toast, network or server error | "Couldn't save. Try again." | STD-9, DEC-006 |
| Sign-in | document title | "Sign in · Tracklite" | design |
| Magic-link landing | page heading | "Sign in to Tracklite" | design (approved, open question 12) |
| Magic-link landing | button | "Sign in" | REQ-005 |
| Magic-link landing | expired message | "This link has expired" | REQ-005.2 |
| Magic-link landing | button after expired, leads to `/sign-in` | "Request a new link" | design (approved, open question 12; REQ-005.2 gives "a button to request a new one", no label) |
| Magic-link landing | signed in as another member | "You're signed in as {full name}. Sign out to use this sign-in link." (example with the first admin: "You're signed in as Owner Name. Sign out to use this sign-in link.") | REQ-005.5, spec.md FR-011 (full name: REQ-005.5, REQ-002.3) |
| Magic-link landing | sign-out button | "Sign out" | REQ-005.5 |
| Magic-link landing | toast, network or server error | "Couldn't save. Try again." | STD-9, DEC-006 |
| Magic-link landing | document title | "Sign in · Tracklite" | design |
| My issues | page heading | "My issues" | F-007, FR-024 |
| My issues | empty message | "Nothing assigned to you" | REQ-041.4 |
| My issues | document title | "My issues · Tracklite" | design |
| App shell | product name (plain text) | "Tracklite" | spec section 1 |
| App shell | sidebar link | "My issues" | F-007 flow step 1, FR-024 |
| App shell | signed-in member | the member's full name (example "Owner Name") with their initials as the avatar (example "ON"; "AB" for "Alexandria Catherine Montgomery-Fitzwilliam van der Bergholt") | REQ-003 (avatar is initials), REQ-003.4 (initials rule), FR-025 |
| App shell | sign-out button | "Sign out" | REQ-005.5 (same label); REQ-006, FR-016 name the action |
| App shell | toast, network or server error on sign out | "Couldn't save. Try again." | STD-9, DEC-006 |
| Not allowed | message (page heading) | "You don't have permission to do that." | STD-2 |
| Not allowed | link | "My issues" | design, matching STD-4's Not found |
| Not allowed | document title | "Not allowed · Tracklite" | design |
| Magic-link email | sender name | "Tracklite" (sender address from server configuration, FR-029) | design (approved, open question 12) |
| Magic-link email | subject | "Sign in to Tracklite" | design (approved, open question 12) |
| Magic-link email | body, first line | "Use this link to sign in to Tracklite:" | design (approved, open question 12) |
| Magic-link email | body, link | the full magic-link address (`/sign-in?token=…` on the app's address), shown as written | REQ-004, API-004, FR-010 |
| Magic-link email | body, after the link | "The link expires in 15 minutes and works once." | design (approved, open question 12; restates REQ-004) |
| Magic-link email | body, last line | "If you didn't ask to sign in, you can ignore this email." | design (approved, open question 12) |

## Component map

Shared components already in the codebase (RM-1): the app shell (`src/components/layout/AppShell.tsx`), Toast, FieldError, EmptyState, Loading, LoadError, LocalTime, and the Not found page's heading pattern; vendored Hairline Button, ButtonLink and TextInput.

| Screen | Element | Component | Reuse / extend / new |
|--------|---------|-----------|----------------------|
| Sign-in | page layout (standalone, centred, no sidebar) | signed-out page layout | new (Hairline tokens) |
| Sign-in | "Sign in to Tracklite" | page heading | reuse (as on Not found) |
| Sign-in | email field | text field: Hairline TextInput, `type="email"` | reuse |
| Sign-in | "Enter a valid email address." | field error message: FieldError | reuse |
| Sign-in | "Send sign-in link" | button: Hairline Button, primary | reuse |
| Sign-in | form | form | new |
| Sign-in | "Check your email" | status message (heading-level text, announced), replacing the form | new |
| Sign-in | limit message | inline form message under the form (announced) | new (Hairline tokens) |
| Sign-in | send-failure and error toasts | toast: Toast | reuse |
| Magic-link landing | page layout | signed-out page layout (same as Sign-in) | new (shared with Sign-in) |
| Magic-link landing | "Sign in to Tracklite" | page heading | reuse |
| Magic-link landing | "Sign in" | button: Hairline Button, primary | reuse |
| Magic-link landing | "This link has expired" | status message | new (shared with Sign-in) |
| Magic-link landing | "Request a new link" | link styled as a button: Hairline ButtonLink, secondary | reuse |
| Magic-link landing | "You're signed in as …" | status message | new (shared with Sign-in) |
| Magic-link landing | "Sign out" | button: Hairline Button, secondary | reuse |
| Magic-link landing | error toast | toast: Toast | reuse |
| My issues | "My issues" | page heading | reuse |
| My issues | "Nothing assigned to you" | empty state: EmptyState | reuse |
| App shell | frame | app shell layout: AppShell | extend |
| App shell | "Tracklite" | product name, plain text | reuse (unchanged from RM-1) |
| App shell | "My issues" | sidebar navigation link, with a current-page mark | new |
| App shell | signed-in member, at the bottom of the sidebar | member display: initials avatar plus full name | new (Hairline tokens: initials in `--ink` on a `--surface-3` disc with a `--hairline-tertiary` rim, 15.18:1, open question 19) |
| App shell | "Sign out", beside or below the member | button: Hairline Button, tertiary | reuse |
| App shell | error toast | toast: Toast | reuse |
| Not allowed | message | page heading | reuse |
| Not allowed | "My issues" | link | reuse (as on Not found) |
| Magic-link email | message | plain-text email template (no HTML part) | new |

No icons are needed. No library beyond the approved Hairline components and React Aria Components is needed.

## Keyboard and focus

| Screen | Tab order | Initial focus | Focus after actions | Keyboard alternatives |
|--------|-----------|---------------|---------------------|-----------------------|
| Sign-in | Email field, then "Send sign-in link" | Email field | Enter in the field submits. Field error → the email field, text kept. Check your email → the "Check your email" message (focusable heading, announced); nothing else is focusable. Limit reached → the inline message is announced; focus stays on "Send sign-in link", enabled again, email kept. Toast → focus stays on the send button, enabled again (the toast never takes focus, RM-1) | — (no pointer-only action) |
| Magic-link landing | Populated: "Sign in". Link expired: "Request a new link". Signed in as another member: "Sign out" | Browser default (always a full page load, from the email or after the landing page's Sign out) | Sign in → the destination page loads (its own focus). Link expired → focus moves to "This link has expired" (focusable heading, announced), then Tab reaches "Request a new link". Sign in refused because another member signed in meanwhile (also on a retry after a lost answer, FR-012) → focus moves to the "You're signed in as …" message (focusable, announced), then Tab reaches "Sign out". "Request a new link" → Sign-in, email field; when the browser is signed in as the link's own member (Link expired after the link was used in another tab or before a reload), `/sign-in` redirects to `/my-issues` (FR-023), which takes its own focus (My issues row). Sign out → the same `/sign-in?token=…` loads showing Populated, also when the session had already ended elsewhere or changed to another member; browser default, "Sign in" is the first Tab stop. Toast → focus stays on the clicked button, enabled again | — |
| My issues | Sidebar first ("My issues" link, then "Sign out"), then the main area (nothing focusable in RM-3) | Browser default on a full load; on an in-app navigation, the "My issues" heading (as Not found does) | — | — |
| App shell | "My issues" link, then "Sign out" (the member display is not focusable; its full name shows on hover when cut off, and is read by screen readers in full) | Set by the page | Sign out → `/sign-in`, email field. Sign-out toast → focus stays on "Sign out". Following "My issues" → its heading | — |
| Not allowed | Sidebar, then the "My issues" link | Browser default on a full load; on an in-app navigation, the message heading (as Not found does) | Following "My issues" → its heading | — |
| Magic-link email | The link only (handled by the mail app) | — | — | — |

Focus is always visible on every focusable element (NFR-007). Messages that appear without a page load (Check your email, Limit reached, Link expired, Signed in as another member after a refused Sign in click, field error) are announced to screen readers.

## Deferred UI

| Slot | Screen | Filled by |
|------|--------|-----------|
| Issue groups and rows in the main area ("Nothing assigned to you" stays as the empty state) | My issues | RM-11 (REQ-041, REQ-042) |
| Profile entry point (edit own full name) from the signed-in member | App shell (sidebar bottom) | RM-4 (REQ-003.3) |
| Members settings link (`/settings/members`), admins only | App shell (sidebar) | RM-4 |
| Invitation landing page, including "You're signed in as {full name}. Sign out to accept this invitation." | — (its own page) | RM-4 (REQ-002, REQ-002.3) |
| Active project list ("Website · WEB"), with its empty state | App shell (sidebar, under the My issues link) | RM-5 (REQ-015) |
| Archived list | App shell | RM-5 (REQ-013) |
| New issue | App shell | RM-6 |

## Open questions

| # | Question | Behavior change? | Answer |
|---|----------|------------------|--------|
| 1 | API-004 listed no address for the magic-link landing page. Options: (a) `/sign-in/link?token=…`; (b) `/sign-in?token=…`, the same page in a second mode. | Yes: DEC candidate (page address in API-004, used in emails) | (b): API-004 now lists `/sign-in?token=…` (docs/tracklite-spec.md API-004; spec.md FR-010, FR-019, FR-023). `/sign-in?token=…` never redirects (FR-023) |
| 2 | Layout of the signed-out pages (Sign-in, Magic-link landing), including the landing page's "Signed in as another member" state: (a) standalone, centred, no sidebar; (b) inside the app shell. | No (layout only) | (a): standalone and centred, no sidebar, for every state of both pages (owner) |
| 3 | "Check your email": (a) replaces the form; (b) shows above the form. Should it repeat the entered email? | No (layout) | (a), and it does not repeat the entered email (owner) |
| 4 | The limit message: SEC-001 "shows" it, while STD-9 makes failures not tied to one field toasts. Options: (a) an inline message; (b) the STD-9 toast. | Yes: DEC candidate (whether the message persists or disappears) | (a): SEC-001 now says it "shows inline message" (docs/tracklite-spec.md SEC-001). Placed under the form, the typed email kept |
| 5 | Which name fills "You're signed in as Alex." (and REQ-002.3's invitation string): full name or username? | Yes: DEC candidate (spec copy) | Full name: REQ-002.3 and REQ-005.5 now mark the name as the full name (docs/tracklite-spec.md); spec.md FR-011 and Clarifications agree |
| 6 | Should REQ-005 gain spec.md's signed-in-browser behaviors and the "You're signed in as … Sign out to use this sign-in link." string? | Yes: DEC candidate | Yes: REQ-005.5 added (docs/tracklite-spec.md), with a Sign out button; the link stays unused and works after sign-out, and sign-out returns the browser to the same link. The link's own member signed in gets no special case: the Sign in button shows and clicking replaces the session (spec.md FR-011, FR-012, Clarifications) |
| 7 | Where the signed-in member and Sign out sit, and whether the landing page's "Signed in as another member" state has its own Sign out. | No for placement; returning to the link after sign-out was a DEC candidate | Signed-in member (initials avatar and full name) and a Sign out button at the bottom of the sidebar; the landing page's "Signed in as another member" state has its own Sign out button, which returns the browser to the same `/sign-in?token=…` (REQ-005.5, spec.md FR-016) (owner) |
| 8 | Sidebar product name "Tracklite": (a) plain text; (b) a link to `/`. | No (navigation only) | (a): plain text (owner) |
| 9 | My issues empty message in RM-3. | No (design copy) | "Nothing assigned to you" (REQ-041.4) (owner) |
| 10 | The Not allowed page: (a) the STD-2 message with a "My issues" link, as Not found has; (b) the message only. | No (navigation link only) | (a) (owner) |
| 11 | Magic-link email format: (a) plain text only; (b) plain text plus a minimal HTML part. | No (format only) | (a): plain text only (owner) |
| 12 | Approval of the design strings for Sign-in, the landing page and the email. | No (design copy) | Approved as final: "Sign in to Tracklite", "Email", "Send sign-in link", "Enter a valid email address.", "Request a new link"; sender "Tracklite", subject "Sign in to Tracklite", body "Use this link to sign in to Tracklite:" / link / "The link expires in 15 minutes and works once." / "If you didn't ask to sign in, you can ignore this email." (owner) |
| 13 | Errors when sending the link, clicking Sign in or signing out: (a) STD-9's "Couldn't save. Try again."; (b) new sign-in-specific strings. | Yes: DEC candidate if (b) | (a): STD-9's "Couldn't save. Try again." toast, no new strings (owner) |
| 14 | While another member (Alex) is signed in, which magic links show "You're signed in as … Sign out to use this sign-in link."? REQ-005.5 and FR-011 cover a link that belongs to a different member, but a link whose token is unknown or malformed belongs to no member (and an expired or used one still names its member). Options: (a) every token that isn't the signed-in member's own, including unknown and malformed ones, shows the sign-out message, so opening the page reveals nothing about the token (after sign-out, Sign in then shows Link expired); (b) unknown and malformed tokens show the Sign in button, and clicking it shows Link expired with Alex still signed in. Recommendation: (a). | Yes: DEC candidate (which state the page shows, and what opening a link reveals) | (a): every token that isn't the signed-in member's own, including unknown and malformed ones, shows the sign-out message, revealing nothing about the token; after sign-out the returned page shows the Sign in button for every token, and "This link has expired" only after Sign in is clicked (docs/tracklite-spec.md REQ-005.5; spec.md FR-011, FR-013, FR-016, Clarifications 2026-10-01). When nobody is signed in, the page always shows the Sign in button first for every token (Clarifications 2026-10-01) |
| 15 | FR-011 and the spec edge case say a Sign in click from a tab opened before Alex signed in must not use the link or replace Alex's session, but not what that tab then shows. Options: (a) the page switches to the "Signed in as another member" state, no toast; (b) the STD-9 toast "Couldn't save. Try again." and the page stays as it was. Recommendation: (a). | Yes: DEC candidate (what a refused Sign in click shows) | (a): the click doesn't use the link or replace the session, and the page switches to the "Signed in as another member" message and Sign out button, with no toast (docs/tracklite-spec.md REQ-005.5; spec.md FR-011, User Story 2 scenario 11, Clarifications 2026-10-01) |
| 16 | The landing page's Sign out is clicked after that session already ended elsewhere (for example signed out in another tab). FR-016 says this Sign out always returns the browser to the same `/sign-in?token=…`, but the edge case "Signing out when already signed out" says it "lands on `/sign-in` without an error". Options: (a) return to the same `/sign-in?token=…` (now Populated), no error; (b) go to `/sign-in`, no error. Recommendation: (a), so the member can still use the link. | Yes: behavior-changing, DEC candidate (where the browser goes) | (a): no error, and the browser returns to the same `/sign-in?token=…`, which shows the Sign in button, exactly as when the session was still active; every other Sign out made when already signed out still lands on `/sign-in` without an error (docs/tracklite-spec.md REQ-005.5; spec.md FR-016, edge case "Signing out when already signed out") |
| 17 | Sign-in frames 3a (Populated), 3c, 3e, 3f, 3g and 3i show "owner@example.com" already in the email field, while the inventory's Populated row says the field is empty on arrival (FR-005 gives one email field and no prefill). Options: (a) the email is sample typed text; redraw 3a and 3i with an empty field; (b) the field is prefilled on arrival. Recommendation: (a). | (a): No, canvas fix only. (b): Yes, behavior-changing, DEC candidate (prefilling the email) | (a): the email was sample typed text; the field is empty on arrival (owner). Frames 3a and 3i now show an empty field; 3c, 3e, 3f, 3g and 3h keep the typed email, as their rows require |
| 18 | Frame 3t shows the initials "AB" for "Alexandria Catherine Montgomery-Fitzwilliam van der Bergholt", i.e. the first letters of the first and last words. REQ-003 says only "The avatar is the member's initials" and gives no rule for names of one word or more than two words. Options: (a) first letter of the first and last words, uppercase (one-word names give one letter); (b) leave the rule to plan.md. Recommendation: raise (a) to the owner. | Yes, behavior-changing: DEC candidate for REQ-003 (the rule is reused by RM-6 cards, REQ-025, and comments, REQ-031) | (a), settled in the product spec: the initials are the first character of the first word and of the last word of the full name, whatever that character is, uppercased where uppercasing applies; a one-word name gives one character ("Alexandria Catherine Montgomery-Fitzwilliam van der Bergholt" → "AB", "Sam" → "S") (docs/tracklite-spec.md REQ-003.4; spec.md FR-025, Clarifications). The full name is trimmed at either end, must not be blank ("Name required") and is at most 60 characters ("Too long (max 60)") (docs/tracklite-spec.md REQ-003; spec.md FR-003). Frame 3t's "AB" matches |
| 19 | The sidebar avatar's initials (caption size, 12 px, `--earth-sand` #d9b09d on `--earth-rust` #8d4936, as built in `src/components/layout/AppShell.tsx`) measure 3.39:1, below the WCAG 2.2 AA 4.5:1 that NFR-007 requires for text this size; the owner decided the colors must change. Which Hairline token pair replaces it? WCAG 2.x contrast ratios, all from `src/components/ui/hairline/styles/tokens/colors.css`, the sidebar being `--surface-1` #15100e: (a) `--ink` #f6f0eb on `--earth-rust` #8d4936, 5.92:1, the same rust disc with off-white initials; (b) `--inverse-ink` #1a0f0a on `--earth-sand` #d9b09d, 9.54:1, inverted: a light sand disc with near-black initials (rust on sand is still 3.39:1, so the plain swap fails); (c) `--on-primary` #1a0d08 on `--primary` (`--earth-terracotta`) #dd7450, 6.05:1, Hairline's primary-button pair, a bright orange disc that reads like a button; (d) `--earth-sand` #d9b09d on `--surface-3` #211a16, 8.70:1, a neutral dark disc with sand initials, the rust-sand `--avatar-edge` rim kept. Not candidates: `--ink-muted` on rust, 4.39:1, fails. Recommendation: (a), the smallest change: it keeps the rust disc and the `--avatar-edge` rim and only moves the text to the body-text token. Frames showing the avatar, to redraw with the chosen pair: 3q App shell, 3r Shell saving, 3s Shell failed, 3t Shell long name, 3u Shell phone, 3v My issues, 3w My issues phone, 3x Not allowed, 3y Not allowed phone (the landing page's "Signed in as another member" frames 3l, 3m, 3aa and 3ab show no avatar). | No (color only; the initials rule, REQ-003.4, is unchanged) | Revised by the owner 2026-10-01 to match the redrawn frames 3q to 3y, replacing the earlier answer (a): initials in `--ink` #f6f0eb on a `--surface-3` #211a16 disc with a `--hairline-tertiary` #4b3d35 rim, 15.18:1 (WCAG 2.x, meets NFR-007's 4.5:1). Frames 3q to 3y already show this pair (owner) |

## Freeze checklist

- [x] Every screen in this slice's scope is listed, with a route or host page consistent with spec.md
- [x] Every screen has a row for every state in the checklist, or N/A with a reason
- [x] Every copy row quotes the spec exactly or is marked design
- [x] Every element has a component, marked reuse, extend or new
- [x] Every screen has its keyboard and focus row, with an alternative for each pointer-only action
- [x] Every deferred slot names its RM entry
- [x] Every open question is answered, and none changes behavior
- [x] The canvas is linked, every non-N/A state row has a frame, and no frame shows anything outside the inventory
- [x] Nothing adds a screen, control, state or string that changes behavior, or anything out of scope in spec section 3
