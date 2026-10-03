# Tracklite: Build plan

Milestones in build order for R1. Each milestone lists what to build, the spec IDs it must satisfy, and a "done when" line. Behaviour comes from `docs/tracklite-spec.md` (v0.9); the technical design is in `docs/tech-design.md`, referred to below by section number (§).

**Ground rules**
- A milestone is done when every `Verify: auto` example for its IDs has a passing test. Name each test after its example, such as `it("REQ-016.4: concurrent creates get distinct numbers")`, so `grep REQ-016` shows how a requirement is covered.
- `npm test`, `npm run lint` and `npm run typecheck` pass at the end of every milestone.
- If the spec turns out to be wrong or silent, fix the spec first (with a changelog line), then the code.

---

## M0 Foundation

- [ ] Drizzle schema for every table and enum (§2), and the first migration
- [ ] Test setup: a separate test database, a migrate-before-tests step, data factories, and a helper that moves timestamps into the past (§1.3)
- [ ] Config read from environment variables, checked at startup (§1.6)
- [ ] `apiRoute` wrapper (§1.2):
  - [ ] the same-site check for writes
  - [ ] `ApiError` → error body, and anything else → `500`
  - [ ] one log line per request, with no bodies or tokens
- [ ] Permission helpers `requireMember` and `requireAdmin`
- [ ] Catch-all for unknown `/api` paths (`401` signed out, `404` signed in); `GET /health`
- [ ] Browser shell (§1.7):
  - [ ] the catch-all page and `ClientApp` (rendered in the browser only)
  - [ ] the Redux store, the RTK Query `api` slice and its `baseQuery`
  - [ ] the router with lazily loaded routes
  - [ ] the `toast` slice
  - [ ] the 300 ms loading hook
  - [ ] the Not found page
  - [ ] `src/proxy.ts` setting the nonce-based Content Security Policy (§4.9)
  - [ ] the app shell with an empty sidebar

**Spec:** STD-1…4 mapping, STD-7, STD-9, SEC-004.1, SEC-006 (mechanism), SEC-007 (logger), SEC-010 (CSP), OPS-005 (`/health`)
**Done when:** `/health` returns `200`; `GET /api/anything` returns `401`; any page address loads the shell and shows sign-in.

## M1 Sign-in and account

- [ ] Argon2id hashing and the password rules (§4.1), and token helpers (§4.2)
- [ ] Sessions: the cookie, the 30-day sliding expiry, rewriting `last_active_at` at most hourly (§4.3)
- [ ] `POST /api/sessions`, `DELETE /api/sessions/current`, `GET /api/me`, plus the redirects in the browser
- [ ] SEC-001 limits for sign-in and reset requests (§4.5)
- [ ] `sendEmail()` with three implementations: Mailpit, in-memory and Resend (§1.5, §5.2); the reset email template
- [ ] Reset flow: `POST /api/password-reset-links`, `POST /api/password-reset-lookups` and `POST /api/password-resets` (§4.6)
- [ ] Return after sign-in limited to this app's pages (§1.7)
- [ ] Profile: `PATCH /api/me` and `PUT /api/me/password`
- [ ] Pages: sign in, forgot password, reset password, profile (§6.3)
- [ ] Setup command for the first admin (OPS-001)

**Spec:** REQ-003.3–4, REQ-006, REQ-047, REQ-048, REQ-049, REQ-050, SEC-001, SEC-003, SEC-008, SEC-009, STD-6 (reset), OPS-001
**Done when:** the first admin can be created, sign in, reset their password through Mailpit, and change it from the profile.

## M2 Members and invitations

- [ ] Invitation endpoints: create, resend, revoke, list, look up (§3.3); the invitation email template
- [ ] `POST /api/members` to accept an invitation, and the accept-invitation page (§6.3)
- [ ] `GET /api/members` and `PATCH /api/members/{username}`: role changes, deactivate and reactivate, and the last-admin guard with its row lock (§2.2)
- [ ] Members page (§6.3)

**Spec:** REQ-001, REQ-002, REQ-003, REQ-007, REQ-008, REQ-051, REQ-052, STD-2
**Done when:** the admin invites a second person, who joins through the Mailpit link; the admin can then deactivate and reactivate them.

## M3 Projects and labels

- [ ] Shared Markdown module: rendering, HTML shown as text, the link filter, mention parsing, text extraction (§4.7)
- [ ] Project endpoints, including the reserved-key table and the project delete cascade (§2.3, §2.7)
- [ ] Description saves with a version check, answering `409` on conflict (STD-8); project-description mentions written as `mentions` rows (§2.5)
- [ ] Unsaved-description prompt (REQ-035)
- [ ] The "This project is archived" check on every write inside an archived project
- [ ] Sidebar, New project dialog, project header, project details (description only for now), project settings, archived list (§6.2, §6.3)
- [ ] Label endpoints and the Labels page; the 8 colours and delete confirmation (§6.6)

**Spec:** REQ-009…015, REQ-012, REQ-021, REQ-046.2, DATA-002 (projects), SEC-002, DEC-001
**Done when:** an admin can create, rename, archive, unarchive and delete a project; any member can edit its description and manage its labels.

## M4 Issues

- [ ] Issue create with numbering by row lock and `requestId` (§2.4, STD-5); New issue dialog (§6.3)
- [ ] `GET` and `PATCH /api/issues/{ID}`, one field per save; a status change puts the issue at the top of its new column (§3.4)
- [ ] Label picker that creates new labels, with the 10-label limit
- [ ] Description mentions, written as `mentions` rows (§2.5); the `@` suggestion list in the editor
- [ ] Issue delete (creator or admin)
- [ ] Issue page (§6.4) and canonical addresses (§6.1)

**Spec:** REQ-016…020, REQ-022, REQ-023, DATA-001 (descriptions), DATA-002 (issues)
**Done when:** a member can create, edit and delete issues from the issue page, and two members creating at once get different numbers.

## M5 Board

- [ ] **Spike first:** React Aria `GridList` drag and drop across 5 columns, including automatic scrolling near a column's edges (§6.5). If it falls short, record the fallback as a decision before building on it.
- [ ] `GET /api/projects/{KEY}/board`, with the 14-day window for Done and Canceled
- [ ] `PUT /api/issues/{ID}/position` with fractional keys (§2.4, §3.4)
- [ ] Optimistic moves with rollback and a toast (§1.7)
- [ ] Card layout, the **⋯** menu, the column **+** buttons

**Spec:** REQ-024…030, REQ-036.5, NFR-005
**Done when:** cards can be moved by mouse and by keyboard; a failed save puts the card back; the order survives a reload for every member.

## M6 List view

- [ ] `pg_trgm` indexes and the search query: every typed word must match, with `%` and `_` treated as plain characters (§2.4)
- [ ] `GET /api/projects/{KEY}/issues`: filters, sort, `offset` paging, unknown values ignored
- [ ] List page: filters and sort kept in the URL, search after a 300 ms pause, more rows loaded on scroll

**Spec:** REQ-036…040, NFR-004
**Done when:** every REQ-036…040 example passes, and a copied link reopens the same view.

## M7 Comments

- [ ] Comment endpoints for issues and projects, with `requestId` and a version check on edit
- [ ] Comment mentions, written as `mentions` rows
- [ ] Comment thread and box on the issue page and project details page; edit, delete, "(edited)"
- [ ] Unsent-comment guard: `useBlocker` plus `beforeunload`
- [ ] Time formatting (§6.7); scrolling to `#comment-{id}`

**Spec:** REQ-031…035, REQ-046.1, DATA-001, DATA-003
**Done when:** members can post, edit and delete comments on issues and projects, and mentions are highlighted.

## M8 My issues

- [ ] `GET /api/my-issues` and the page: grouped by status, sorted, with the 14-day window

**Spec:** REQ-041, REQ-042
**Done when:** sign-in lands on a correct My issues page.

## M9 Notifications

- [ ] Creating notifications in the same transaction as assignments and new mentions, joining an existing email or creating one (§2.6)
- [ ] Worker process: the polling loop, the drop checks, retries, shutting down cleanly on `SIGTERM` (§1.4)
- [ ] Notification templates, single and combined; excerpts (§5.3, spec §9)
- [ ] `POST /webhooks/email` with the signature check, marking notifications and invitations as bounced (§5.4)
- [ ] Cleanup job (DATA-004)

**Spec:** REQ-043, REQ-044, REQ-045, API-003, STD-6 (notifications), DATA-004
**Done when:** every REQ-043…045 example passes against the in-memory outbox, and a real assignment shows up in Mailpit about 2 minutes later.

## M10 Operations

- [ ] VPS: PostgreSQL, Caddy (TLS, HSTS, security headers, `X-Forwarded-For`, access log without `token`), systemd units for web and worker, journald set to keep 14 days (§1.1, §4.9)
- [ ] `/etc/tracklite/env` with secrets (OPS-006)
- [ ] Deploy command: migrate, then switch, keeping the previous release (OPS-002); rollback command (OPS-004)
- [ ] Daily backup at 03:00 UTC to storage off the VPS, keeping 14 copies (OPS-003)
- [ ] External uptime check on `/health` (OPS-005)
- [ ] Resend domain set-up: SPF, DKIM, DMARC, the webhook (§5.5)

**Spec:** SEC-005, OPS-002…006
**Done when:** a deploy from `main` and a rollback both work, and a backup has been restored into a scratch database.

## M11 Launch check

- [ ] Seed script for the NFR-001 test data (50 projects, 10,000 issues, 50,000 comments)
- [ ] Measure NFR-002…005 on that data, and fix anything over its target
- [ ] Manual checks: REQ-015.2, REQ-024.3, REQ-030.3, REQ-031.5, REQ-036.4, REQ-041.6, REQ-042.3
- [ ] Browsers (NFR-006); keyboard pass and axe contrast scan (NFR-007)
- [ ] Ops checks: SEC-005.1, OPS-001…005 examples run on the production VPS
- [ ] Confirm the team's headcount against spec §3's assumptions, and check the first month's bills against NFR-009

**Done when:** every box above is ticked. That's R1.
