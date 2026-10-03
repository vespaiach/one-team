# Quickstart: validating Magic-link Sign-in (RM-3)

Runnable checks that prove RM-3 works. Commands and settings: [contracts/commands.md](./contracts/commands.md); endpoints: [contracts/http-api.md](./contracts/http-api.md); routes and pieces: [contracts/ui-routes.md](./contracts/ui-routes.md); email: [contracts/email.md](./contracts/email.md); tables: [data-model.md](./data-model.md). There are no browser end-to-end tests (DEC-005): every `Verify: auto` example runs in `npm test`; the steps below are the by-hand checks.

## Prerequisites

- RM-1's setup done (Node 24, PostgreSQL 18, `tracklite_dev` and `tracklite_test`, `.env.local` with `DATABASE_URL` and `TEST_DATABASE_URL`).
- Mailpit running locally without auth options: `brew install mailpit && mailpit` (web UI and the HTTP send API the app calls on http://localhost:8025; its SMTP port is not used).
- In `.env.local`: `APP_URL=http://localhost:3000`, `EMAIL_FROM=tracklite@localhost`, `MAILPIT_HOST=localhost`, `MAILPIT_PORT=8025`.

## 1. Fresh install to signed in (User Stories 1 and 2, SC-001)

```sh
npm ci
npm run db:migrate
npm run setup -- --email owner@acme.com --name "Owner Name" --username Owner
npm run setup -- --email other@acme.com --name "Other" --username other
npm run dev
```

`npm run db:migrate` must run before `setup` (FR-001); against an unmigrated database `setup` prints the database error, exits 1 and creates nothing. Expected: the first `setup` prints `Created admin owner` and exits 0 (username stored lowercase); the second prints `Setup already done`, exits 1, and nothing changes. Open http://localhost:3000 → redirected to `/sign-in`. Enter `Owner@Acme.com` → "Check your email". In Mailpit (http://localhost:8025) open the message from "Tracklite", subject "Sign in to Tracklite", plain text with the full `http://localhost:3000/sign-in?token=…` link. Open it → "Sign in to Tracklite" with a Sign in button; reloading it changes nothing. Click Sign in → `/my-issues` inside the shell: "My issues" heading, "Nothing assigned to you", sidebar with "Tracklite", the current "My issues" link, "ON" avatar, "Owner Name" and Sign out. Target: under 5 minutes from `setup`.

Invalid setup input (checked before the existing-members check, so it gets the field lines on any database): `--name "   "` → `full name: Name required`; `--username a` → the username line; `--email nope` → the email line (the same email rule as the sign-in form); each exits 1 and creates nothing.

## 2. Return-to and protection (User Story 3, SC-007)

Signed out (private window): open `/project/WEB` → `/sign-in?next=%2Fproject%2FWEB`; request and use a link → lands on `/project/WEB` (Not found inside the shell until RM-5). Open the same link's flow from another browser → also lands on `/project/WEB` (REQ-005.4). `curl -i http://localhost:3000/api/anything` → `401` JSON. `curl -i -X DELETE http://localhost:3000/api/sessions/current` → `204`. `curl -i http://localhost:3000/api/sessions` and `curl -i -X OPTIONS http://localhost:3000/api/sign-in-links` → `401` JSON (not `405` or `204`), each with a request log line. Signed in: `/`, `/sign-in` and `/sign-in?next=/project/WEB` → `/my-issues`; `/sign-in?token=anything`, `/sign-in?token=` and `/sign-in?token=a&token=b` → landing page, no redirect. Signed out, a return-to with a query string (`/project/WEB/list?status=open`) comes back with the query intact.

## 3. Landing-page cases (REQ-005.2, REQ-005.5)

- Click Sign in on a used link → "This link has expired" with "Request a new link" → `/sign-in`.
- Open a fresh link in two tabs; Sign in in tab A → signed in; Sign in in tab B (its own `requestId`) → "This link has expired". Reloading a used link's page and clicking Sign in → the same.
- Replay (FR-012): sign in with a fresh link, then in devtools copy that `POST /api/sessions` request as cURL (it carries the page load's `requestId` and the token) and run it again without the cookie → `signedIn` with a `Set-Cookie: session=…` (what a retry after a lost answer gets). Run it again with the token changed → `expired` and no session cookie.
- Signed in as the owner, open a link requested for a second seeded member (`npm run db:seed` first) or `/sign-in?token=garbage` → "You're signed in as Owner Name. Sign out to use this sign-in link." with Sign out; Sign out → the same address now shows Sign in; for `garbage`, Sign in → "This link has expired".
- Open a second member's link in tab A while signed out; sign in as the owner in tab B; click Sign in in tab A → switches to the "You're signed in as Owner Name…" message, no toast, link still unused.

## 4. Sessions and sign-out (User Story 4)

Sign in in two browsers; Sign out in one → it lands on `/sign-in`; the other is still signed in. Copy the old cookie value into a request (`curl -H 'Cookie: session=<old>' http://localhost:3000/api/x`) → `401`. Lapse: in `psql tracklite_dev`, `update sessions set last_active_at = now() - interval '31 days'` → next page load goes to `/sign-in?next=…`, and back there after signing in.

## 5. Limits, failures, tokens and logs (User Story 5, SC-003, SC-005, SC-006)

- Request a link 6 times within an hour for the owner and for `stranger@x.com` → the 6th shows "Too many sign-in requests. Try again later." under the form, identical for both; no 6th email in Mailpit.
- Stop Mailpit and submit the owner's email → toast "We couldn't send the email. Try again.", email kept; no usable link row (`select count(*) from magic_links where used_at is null and expires_at > now()` unchanged).
- `select token_hash from magic_links` / `from sessions` → signed out, use a value as `?token=` or as the `session` cookie → "This link has expired" / `401`.
- Cross-site write: `curl -i -X DELETE -H 'Sec-Fetch-Site: cross-site' http://localhost:3000/api/sessions/current` → `403`.
- Browser devtools: the `session` cookie is HttpOnly, SameSite=Lax (Secure in production); `document.cookie` does not show it.
- Search the dev server output after these steps for `token=`, the cookie value and any link → no match; one `sign-in, member owner` line per sign-in.

## 6. Automated checks

```sh
npm run build && npm test && npm run lint && npm run typecheck
```

Expected: all exit 0. `npm test` covers every `Verify: auto` example listed in spec FR-032 (REQ-004.1 to REQ-004.3, REQ-005.1 to REQ-005.5, REQ-006.1, REQ-006.2, SEC-001.1, SEC-001.2, SEC-003.1, SEC-007.1, OPS-006.1), the `requestId` replay with a wrong token (no cookie), plus OPS-001.1/OPS-001.2, REQ-003.4 initials, the permission layer (User Story 6) and the design.md states as component tests.

## 7. Settings check (FR-029)

Remove `MAILPIT_HOST` from `.env.local` and run `npm run dev` → exits 1 with `Missing setting: MAILPIT_HOST`. With all local settings but no `RESEND_API_KEY`, `npm run build && npm start` → exits 1 with `Missing setting: RESEND_API_KEY`.

Malformed settings, one at a time with `npm run dev`, each → exit 1: `APP_URL=localhost:3000` or `APP_URL=http://localhost:3000/app` → `Invalid setting: APP_URL`; `MAILPIT_PORT=abc` or `MAILPIT_PORT=70000` → `Invalid setting: MAILPIT_PORT`; `EMAIL_FROM=tracklite` → `Invalid setting: EMAIL_FROM`. `npm run setup` and `npm run db:migrate` still run with these (they need only `DATABASE_URL`).

## 8. Page speed (SC-009, NFR-002)

By hand, broadband, warm cache: `/sign-in`, `/sign-in?token=…` and `/my-issues` are each usable within 1.5 s in the browser performance panel.

## 9. Phone width (design.md frames 3i, 3p, 3u, 3w)

By hand, in the browser's device toolbar at a phone width (for example 375 px), each works without sideways scrolling (section 3, NFR-006: works, not polished):

- 3i Sign-in phone: `/sign-in` signed out shows the heading, the empty email field and "Send sign-in link", all usable.
- 3p Landing phone: a magic link's `/sign-in?token=…` shows the heading and a usable Sign in button.
- 3u Shell phone: signed in, the sidebar, with "Tracklite", the "My issues" link, the member (initials avatar and full name) and Sign out, stacks above the main area; Sign out works.
- 3w My issues phone: `/my-issues` shows the "My issues" heading and "Nothing assigned to you" below the stacked sidebar.

3y (Not allowed, phone width) is not checked here: no RM-3 route renders `NotAllowed`, so its hand check is deferred to the first slice that renders it; in RM-3 the `NotAllowed` component test (tasks.md T076) covers the layout.

## 10. Per-slice timing, browser, keyboard and contrast spot check (NFR-003, NFR-006, NFR-007)

A light check for this slice only (tasks.md T086). The full NFR-006 browser pass (latest two versions of each desktop browser) and the full NFR-007 accessibility pass belong to RM-14.

- NFR-003 timing: with `npm run build && npm start` (production settings) or `npm run dev`, repeat each request about 20 times and read the `duration` in RM-1's request log lines: `POST /api/sessions` (Sign in on a fresh link and on a used one) and `DELETE /api/sessions/current` (Sign out) stay under 500 ms for at least 95% of them; `GET /api/anything` (the catch-all, signed in and signed out) under 300 ms, and a write to it under 500 ms. `POST /api/sign-in-links` is exempt (it waits for the email send, DEC-002).
- Browsers (NFR-006, per slice): in the current desktop Chrome, Firefox, Safari and Edge, request a link on `/sign-in` → "Check your email"; open it → the magic-link landing page; Sign in → `/my-issues` in the app shell; Sign out → `/sign-in`. Each screen looks as in design.md and each step works in every browser. Not allowed is skipped: no RM-3 page renders it (only its component test does).
- Keyboard only (no mouse): from `/sign-in`, Tab to the field, type the email, Enter → "Check your email" has focus; open the link, Tab to Sign in, Enter → `/my-issues`; Tab reaches "My issues" and then "Sign out" in the sidebar, Enter on Sign out → `/sign-in`. On the landing page's Link expired and Signed in as another member states, Tab reaches "Request a new link" and "Sign out". Focus is visible on every element reached, and nothing needs a pointer.
- Contrast: on `/sign-in` (form, field error, limit message), the landing page (Populated, Link expired, Signed in as another member), `/my-issues` in the shell and Not found, run the browser's built-in accessibility audit (for example Chrome Lighthouse's Accessibility category, or the devtools color picker's contrast ratio) → no text below WCAG 2.2 AA contrast.
