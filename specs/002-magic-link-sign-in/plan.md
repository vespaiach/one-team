# Implementation Plan: Magic-link Sign-in

**Branch**: `002-magic-link-sign-in` (work stays on `colau/speckit-sdd-orchestrator-75b0f0`) | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md) | **Design**: [design.md](./design.md) (Frozen 2026-10-01)

**Input**: Feature specification from `specs/002-magic-link-sign-in/spec.md`; behavior from `docs/tracklite-spec.md` v0.7; constitution v1.8.0; RM-1 code on `main`.

**Status**: Planned. Owner questions Q1 to Q3 and analyze finding U1 were answered on 2026-10-01 (see "Resolved owner questions"); none is open and nothing blocks implementation. One follow-up raised by the Q2 answer is listed there; it does not affect RM-3.

## Summary

RM-3 closes the app to signed-out visitors and lets members sign in with an emailed single-use link. A setup command creates the first admin; `/sign-in` takes an email and always answers "Check your email", sending a 15-minute link only to active members, within per-email and per-IP hourly limits, with a request-ID replay record. The link opens a landing page whose Sign in button (never the page load) uses the link and starts a 30-day sliding session kept in an HttpOnly, SameSite=Lax cookie; a different signed-in member is asked to sign out first. Tokens are 256-bit random values stored only as SHA-256 hashes. A Next 16 Proxy guards every page with return-to; `apiRoute` rejects cross-site writes; one server-side permission layer answers `401`/`403`. `/my-issues` becomes the signed-in landing page in the extended app shell (initials avatar, full name, Sign out). Email goes through Resend's HTTP API in production and Mailpit's HTTP send API locally, both called with the built-in `fetch`, so no new package is needed (Q1). Details and alternatives: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24 LTS; scripts run through Node's type stripping (RM-1)

**Primary Dependencies**: `next` 16.3 (App Router, `src/proxy.ts`), `react` 19.3, `react-aria-components`, `postgres` (postgres.js), vendored Hairline (`src/components/ui/hairline`), Tailwind CSS 4; built-in `node:crypto`, `fetch`, `Intl.Segmenter`, `node:util` `parseArgs`. No new package. Queries use the approved postgres.js tagged SQL, section 12's postgres.js stack (owner answer Q2; section 12 updated 2026-10-01); local email uses Mailpit's HTTP send API through `fetch`, so no SMTP client (owner answer Q1).

**Storage**: PostgreSQL 18; one new migration `migrations/0001_magic_link_sign_in.sql` with `members`, `magic_links`, `sessions`, `sign_in_requests`, `sign_in_attempts` (data-model.md)

**Testing**: Vitest (unit tests in Node against the test database, their files run one at a time with `fileParallelism: false`, and `src/server/migrations.test.ts` restores the real schema in its `afterAll` (U1); component tests in jsdom) with React Testing Library; email calls stubbed with `vi.stubGlobal("fetch")`; no browser end-to-end tests (DEC-005). By hand, RM-3 does only a light per-slice check (quickstart.md section 10, tasks.md T086): NFR-003 timing, a quick check of the RM-3 screens in the current desktop Chrome, Firefox, Safari and Edge (NFR-006 per slice), and a keyboard-only and contrast spot check of the RM-3 screens; RM-14 owns the full NFR-006 browser pass and NFR-007 accessibility pass

**Target Platform**: Linux VPS in production (RM-2); macOS or Linux for local development with Mailpit; latest two desktop Chrome, Firefox, Safari, Edge (NFR-006)

**Project Type**: Web application (one Next.js project serving pages and `/api/…`)

**Performance Goals**: pages usable within 1.5 s (NFR-002, SC-009); API reads p95 < 300 ms, writes < 500 ms (NFR-003), except `POST /api/sign-in-links`, which is exempt from NFR-003's 500 ms because it includes the provider call (up to the 10 s timeout) and STD-6 needs the send result before answering (spec Assumptions); RM-3 checks NFR-003 by hand for `POST /api/sessions`, `DELETE /api/sessions/current` and the `/api` catch-all from the request log's durations (quickstart.md section 10, T086), and leaves the full-data NFR-002 to NFR-004 pass to RM-14; 95% of magic-link emails within 1 minute (NFR-008), sent synchronously during the request

**Constraints**: no package without owner approval (IV); no comments in `src/` JS/TS (III); no dead code (II); tokens never in path segments or logs (SEC-007); secrets only in `.env.local` (OPS-006); timestamps `timestamptz` UTC; migrations additive (OPS-004); UI exactly as the Frozen design.md (V); NFR-009 budget under $20 a month

**Scale/Scope**: team under 15; 2 pages (`/sign-in` with two modes, `/my-issues`), app shell extended, Not found moved into the shell; 3 endpoints (each route file also answers every other method like the catch-all) plus the catch-all change; 5 tables; 1 setup command; seed script started

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Checked against constitution v1.8.0.

| Principle | Pre-design | Post-design | Notes |
|-----------|-----------|-------------|-------|
| I. Simplicity First | Pass | Pass | Direct SQL in a few `src/server` modules; no auth library, no ORM, no CSRF-token machinery (Fetch Metadata check in the existing wrapper), no job queue (the email is sent in the request). Two helpers are moved: `writeLine` → `src/server/log.ts` (now with two callers) and `NotFoundFocus` → `src/components/ui/HeadingFocus.tsx` (now used by Not found, My issues and Not allowed). The one email rule, `isValidEmail` in `src/server/emailAddress.ts`, has three callers (setup, the sign-in endpoint, the `EMAIL_FROM` check); `validateSession` has four (Proxy, `currentMember`, `requireMember`, `redeemSignInLink`). The Proxy's database check is chosen over Next's optimistic-cookie recommendation because it is the simpler single gate here (research R8). |
| II. No Dead Code | Pass (justified) | Pass (justified) | `src/app/page.tsx` is deleted (the Proxy always redirects `/`). `NotAllowed` is a shared component with its own test, covered by the `src/components/` exception. `requireAdmin` in `src/server/permissions.ts` is required by FR-021 / User Story 6 but has no caller until RM-4, and the exception does not cover `src/server/`: it is the one Complexity Tracking entry, accepted by the owner on 2026-10-01 (Q3), and ships with its unit tests. Nothing is exported for tests only: `validateProfile` (in `src/server/members.ts`) and `sameAppPath` (in `src/server/signIn.ts`) are private to their modules and tested through their callers (`createFirstAdmin`; `requestSignInLink` and `POST /api/sign-in-links`). Everything else added is used by RM-3 code. |
| III. No Code Comments | Pass | Pass | No comments in `src/` JS/TS; `scripts/` and the SQL migration are out of scope but need none. |
| IV. Dependency Approval | Pass | Pass | The plan uses only packages already in `package.json`: Q1 was answered (b), Mailpit's HTTP send API through `fetch` (no `nodemailer`), and Q2 keeps postgres.js (no `drizzle-orm`). No package is added. |
| V. UI Design Gate | Pass | Pass | design.md is Frozen (2026-10-01). Screens, states, copy, component map and focus rules are followed as recorded; contracts/ui-routes.md only places them in files. The magic-link email follows design.md's copy and plain-text format. No new screen, state or string. |

**Gate result**: PASS for all five principles (re-checked after the owner's answers, and again after the spec's checklist clarifications of 2026-10-01: replay bound to the token, one email rule, format checks, the catch-all convention update). No new package, screen, state or string; no new Principle II exception. Principle II passes with one justified violation, `requireAdmin`, accepted by the owner in Complexity Tracking. No other violation.

## Design notes carried into implementation

- **Single gate for pages**: `src/proxy.ts` validates the session against the database on every page request and owns all page redirects (contracts/ui-routes.md "Access rules"). Pages never repeat the redirect logic; they read the member with `currentMember()` for display. The `(app)` layout and Not found use `requireCurrentMember()`, whose redirect is only a fallback behind the Proxy.
- **One permission layer (FR-021)**: `src/server/permissions.ts` is the layer and the only place a role is checked (`requireMember`, `requireAdmin`). `src/proxy.ts` and `src/server/session.ts` (`currentMember`) only authenticate, through the same `validateSession` function in `session.ts` that `requireMember` calls. Later page-level role checks (pages that render `NotAllowed`) go through `permissions.ts` too (research R9).
- **One email rule (FR-003, FR-005)**: `src/server/emailAddress.ts` `isValidEmail`: trimmed, WHATWG `<input type="email">` rule, at most 254 characters; used by the setup command (through `members.ts`), `POST /api/sign-in-links` for the sign-in form's input, and the `EMAIL_FROM` start-up check (research R16).
- **Return-to** travels as `?next=` on `/sign-in`, is validated as a same-app path (any one, query string kept, including `/api/…`, `/health` and `/sign-in…`), and is stored on the magic link, never put in the email URL (research R8).
- **Answers that are page states** (`expired`, `signedInAsOther`, `checkEmail`) are `200` outcomes, so the landing page uses RM-1's `saveJson` unchanged; the sign-in form has its own small `fetch` because it must tell `429` (inline message) from `503` (send-failure toast) from other failures (STD-9 toast).
- **Same message for members and non-members** (SC-003): the `200` "Check your email" and the `429` limit answers have identical bodies either way; the only differences are response time and, during a provider outage, the `503` toast that only a member's email can get; both are accepted limitations (spec Clarifications and Assumptions).
- **Ordering inside `POST /api/sign-in-links`** is fixed (research R11): validate `requestId` → replay check (a repeat of an accepted `requestId` gets its first answer, whatever email it carries) → validate `email` → limit check and count (own committed transaction, advisory locks email then IP) → member lookup → create link → send → on failure delete the link → record `requestId` only on acceptance.
- **Single use under concurrency** comes from the conditional `UPDATE magic_links … WHERE used_at IS NULL AND expires_at > now() … RETURNING` (research R12).
- **Other methods on the sign-in paths**: Next would answer an unexported method with a bare `405` outside `apiRoute` and auto-implement `OPTIONS` and `HEAD`, so each of the three sign-in route files also exports every other method Next supports (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) as `unmatchedRoute` from `src/server/permissions.ts`, the catch-all's handler moved there: `401` "Not signed in" signed out, JSON `404` signed in, logged like every API request (contracts/http-api.md, research R9).
- **Ordering inside `POST /api/sessions`** is fixed (research R12): parse the JSON body (not JSON → `422` "Invalid input", as `POST /api/sign-in-links`) → validate `requestId` → read the browser's session → link lookup and the signed-in-as-another check → replay check, which needs the `requestId` to match a live session (valid by data-model.md's rule: `ended_at` null, active within 30 days, member active) **and** `sha256(token)` to equal that session's own magic link's `token_hash` (a `requestId` alone never re-issues a cookie; when the browser's current session is a different session of the same member, it is ended first, as on the normal path) → conditional update. The signed-in-as-another check runs before the replay check, so a replay is answered only when nobody is signed in or the signed-in member is the link's member, and never silently replaces another member's session (REQ-005.5, FR-011, FR-012). An empty, malformed or repeated `token` is never a `422` (FR-023).
- **`requestId` per landing-page load**: `MagicLinkLanding` makes one when the page loads and reuses it when Sign in is retried after the failure toast, so a retry after a lost answer signs the member in; a reload or another tab makes a new one and gets "This link has expired" once the link is used (FR-012, spec edge cases). The sign-in form instead makes a fresh one per submission (FR-005).
- **Start-up settings**: missing → `Missing setting: NAME`, malformed (`APP_URL` not an absolute `http`/`https` origin, `MAILPIT_PORT` outside 1 to 65535, `EMAIL_FROM` not a valid email) → `Invalid setting: NAME`, exit 1, app server only (research R7).
- **Landing page on open** never touches the link's state and never checks expiry, so mail scanners and curious visitors learn nothing (REQ-005.3, REQ-005.5).
- **Landing-page Sign out** reloads the same `/sign-in?token=…`; the shell's Sign out goes to `/sign-in`; both succeed when the session already ended elsewhere (`DELETE /api/sessions/current` always `204`). In a stale tab it ends whichever session the browser now has (accepted by the spec).
- **Client IP for SEC-001** is the rightmost `X-Forwarded-For` entry; it is trustworthy only once RM-2's reverse proxy appends or overwrites the header (RM-2 dependency, research R11).
- **Focus and announcements** follow design.md "Keyboard and focus": the email field first on `/sign-in`; "Check your email", "This link has expired" and the "You're signed in as …" message are focusable headings (`tabIndex={-1}`) focused when they appear without a page load and announced; the limit message is announced (`role="status"`) while focus stays on the send button; toasts never take focus (RM-1).
- **Hairline**: `TextInput` gets `type="email"`, `validationBehavior="aria"` (no native bubble; the server's `422` drives `FieldError`, linked by `aria-describedby`, field `aria-invalid`); `Button` primary/secondary/tertiary as in design.md's component map; "Request a new link" is Hairline `ButtonLink` secondary. Both are imported through `src/components/ui/hairline/index.ts`.
- **App shell**: full name truncated with "…" (`truncate`) and given `title` with the full name; avatar initials from `src/lib/initials.ts`; avatar edge uses Hairline's `avatar-edge` color token (`border-avatar-edge`, design.md component map).
- **Document titles** through `metadata`: "Sign in", "My issues" (template adds " · Tracklite"). The Not allowed title ("Not allowed · Tracklite") is set by the later page that renders `NotAllowed`.
- **Logs**: never pass tokens, links, cookie values or email addresses to `writeLogLine` (research R15). Tests capture stdout across a full sign-in and assert none appears (SC-005).
- **Production prerequisite (owner action)**: Resend account, sending domain with SPF and DKIM records, `RESEND_API_KEY` and `EMAIL_FROM` in the server config file (research R2). Not needed for local development or tests.

## Implementation outline

1. **Schema**: `migrations/0001_magic_link_sign_in.sql` (data-model.md).
2. **Server foundations**: `src/server/log.ts` (moved `writeLine`); `src/server/emailAddress.ts` (`isValidEmail`); `src/server/config.ts` `readAppSettings()` with presence and format checks; `src/instrumentation-node.ts` checks it; `src/server/tokens.ts` (`newToken`, `hashToken`); `src/server/api.ts` cross-site check; `.env.example` placeholders.
3. **Members and setup**: `src/server/members.ts` (profile validation, `findActiveMemberByEmail`, `createFirstAdmin` with the table lock); `scripts/setup.ts` and the `setup` npm script; `scripts/seed.ts` and the `db:seed` npm script.
4. **Sessions and permissions**: `src/server/session.ts` (cookie name and attributes, read token from a `Request`, `validateSession` (validate-and-touch), start, end, `currentMember`, `requireCurrentMember`); `src/server/permissions.ts` (`requireMember`, `requireAdmin` with its tests, accepted under Q3, and `unmatchedRoute`, the catch-all's handler moved here: `requireMember`, then the JSON `404`); the catch-all exports `unmatchedRoute` for all seven methods.
5. **Email**: `src/server/email.ts` (`sendEmail`: Resend's API in production, Mailpit's `POST /api/v1/send` on its web port locally, both through `fetch` with a 10 s timeout; Q1).
6. **Sign-in flow**: `src/server/signIn.ts` (`requestSignInLink`, `redeemSignInLink`, destination validation, limit rule, log line); routes `src/app/api/sign-in-links/route.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/current/route.ts`, each exporting its own method and `unmatchedRoute` for every other method Next supports.
7. **Pages**: `src/proxy.ts`; root layout without the shell; `src/app/(app)/layout.tsx`, `src/app/(app)/my-issues/page.tsx`; `src/app/sign-in/layout.tsx`, `src/app/sign-in/page.tsx`; `src/app/not-found.tsx` inside the shell; delete `src/app/page.tsx`.
8. **UI pieces**: `src/lib/initials.ts`; `src/features/auth/components/` `SignInForm`, `MagicLinkLanding` and `StatusMessage` (design.md's "status message", shared by both auth pages); `src/features/auth/services/sendSignInLinkRequest.ts`; `src/components/layout/SignOutButton.tsx` (shared by `AppShell` in the same folder and by `MagicLinkLanding`, which imports it from `src/components/layout`); `AppShell` extended; `src/components/ui/NotAllowed.tsx`; `src/app/NotFoundFocus.tsx` moved to `src/components/ui/HeadingFocus.tsx`, the shared heading-focus helper used by Not found, My issues and Not allowed (design.md "Keyboard and focus").
9. **Tests** beside each file (research R20): every FR-032 example by name, including OPS-006.1 by extending `src/server/env-files.test.ts` to conditionally git-grep the tracked files: when a `RESEND_API_KEY` value is configured, run the grep with `--quiet --fixed-strings` and expect no match (exit 1); when not configured (normal in local dev and npm test), skip that grep; in both cases, always assert that the committed `.env.example`'s `RESEND_API_KEY` is empty or a placeholder; component tests for every design.md state with a frame; Proxy redirects; cross-site `403`; log search; the `POST /api/sessions` replay: the same `requestId` and token after a lost answer → `signedIn`, and a stored `requestId` with a wrong token → no session cookie issued and no session re-tokened; `isValidEmail` and each start-up format check.
10. **Docs**: README setup steps (`npm run db:migrate` before `npm run setup`, Mailpit, new settings, `npm run db:seed`) and the scripts table. AGENTS.md: amend the catch-all sentence, which says unmatched `/api` paths answer a JSON `404`, to say the catch-all answers `401` when signed out and `404` when signed in; add `429` and `503` (sign-in link requests only, DEC-002) to the statuses raised with `ApiError`; state that `apiRoute` itself answers `403` to cross-site writes (`POST`, `PUT`, `PATCH`, `DELETE`) before the handler runs (FR-018, research R10); add one convention line: pages are protected by `src/proxy.ts`, and every `/api` handler except the three sign-in endpoints calls `requireMember` from `src/server/permissions.ts`; and amend the `requestId` sentence (sign-in-link `requestId`s are kept in `sign_in_requests`, a non-member's request has no row of its own, `POST /api/sessions` replays only when the token matches) and qualify its `(FR-013)` as `(specs/001-project-foundation FR-013)`; and add the project-wide rule: every `src/app/api/…/route.ts` exports each HTTP method Next supports for route handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`), and the ones it doesn't implement are `unmatchedRoute` from `src/server/permissions.ts`, so Next never answers a bare `405` or its own `OPTIONS` or `HEAD` outside `apiRoute`.

## Project Structure

### Documentation (this feature)

```text
specs/002-magic-link-sign-in/
├── spec.md
├── design.md            # Frozen UI design
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── http-api.md
│   ├── ui-routes.md
│   ├── commands.md
│   └── email.md
├── checklists/
│   ├── requirements.md
│   └── auth.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json                         # + "setup", "db:seed" scripts
.env.example                         # + APP_URL, EMAIL_FROM, RESEND_API_KEY, MAILPIT_HOST, MAILPIT_PORT (web/API port) placeholders
README.md                            # Mailpit and first-admin steps
migrations/
└── 0001_magic_link_sign_in.sql
scripts/
├── setup.ts                         # first-admin command (OPS-001)
└── seed.ts                          # NFR-001 seed script (started here)
src/
├── proxy.ts                         # page gate, redirects, return-to (+ proxy.test.ts)
├── instrumentation-node.ts          # + app settings check
├── app/
│   ├── layout.tsx                   # providers only, no AppShell
│   ├── not-found.tsx                # renders AppShell around RM-1 content; imports HeadingFocus
│   ├── NotFoundFocus.tsx            # moved to src/components/ui/HeadingFocus.tsx
│   ├── page.tsx                     # deleted
│   ├── (app)/
│   │   ├── layout.tsx               # member + AppShell
│   │   └── my-issues/page.tsx
│   ├── sign-in/
│   │   ├── layout.tsx               # standalone centred layout
│   │   └── page.tsx                 # form or landing page
│   └── api/
│       ├── [[...path]]/route.ts     # all seven methods = unmatchedRoute (requireMember, then 404)
│       ├── sign-in-links/route.ts   # POST; other methods = unmatchedRoute
│       └── sessions/
│           ├── route.ts             # POST; other methods = unmatchedRoute
│           └── current/route.ts     # DELETE; other methods = unmatchedRoute
├── components/
│   ├── layout/AppShell.tsx          # + My issues link, member display, Sign out
│   ├── layout/NavLink.tsx           # sidebar link with aria-current (+ NavLink.test.tsx)
│   ├── layout/SignOutButton.tsx     # shared by AppShell and MagicLinkLanding (+ SignOutButton.test.tsx)
│   ├── ui/HeadingFocus.tsx          # moved from src/app/NotFoundFocus.tsx; focuses a page heading after an in-app navigation; used by Not found, My issues, NotAllowed (+ HeadingFocus.test.tsx)
│   └── ui/NotAllowed.tsx            # uses HeadingFocus
├── features/auth/
│   ├── components/                  # SignInForm, MagicLinkLanding, StatusMessage (shared by both; + StatusMessage.test.tsx)
│   └── services/sendSignInLinkRequest.ts
├── lib/initials.ts
└── server/
    ├── api.ts                       # + cross-site check; log line via log.ts
    ├── log.ts
    ├── config.ts                    # + readAppSettings (presence and format checks)
    ├── emailAddress.ts              # isValidEmail, the one email rule
    ├── env-files.test.ts            # + OPS-006.1: conditional grep for RESEND_API_KEY, .env.example assertion
    ├── tokens.ts
    ├── members.ts
    ├── session.ts                   # validateSession, currentMember (authentication only)
    ├── permissions.ts               # FR-021's one permission layer; unmatchedRoute
    ├── email.ts
    └── signIn.ts
```

Every source file gets its `*.test.ts` / `*.test.tsx` beside it, except the composition-only layouts in `src/app` (AGENTS.md: `src/app` holds routes, layouts and composition only): `src/app/(app)/layout.tsx` (awaits `requireCurrentMember()` and renders `AppShell` with the member's full name) and `src/app/sign-in/layout.tsx` (a centred wrapper around its children), like RM-1's root `src/app/layout.tsx`, have no logic of their own; what they compose is tested in its own file (`requireCurrentMember` in `src/server/session.test.ts`, `AppShell` in `src/components/layout/AppShell.test.tsx`).

**Structure Decision**: The RM-1 single Next.js project and `AGENTS.md` layout: routes and composition in `src/app` (with an `(app)` route group for pages inside the shell), sign-in UI in `src/features/auth`, shared UI in `src/components` (including `SignOutButton`, used by both the app shell and the magic-link landing page), the initials rule in `src/lib`, all database, cookie, email and permission code in `src/server`, commands in `scripts/`, schema in `migrations/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `requireAdmin` in `src/server/permissions.ts` has no caller in RM-3 (Principle II); **accepted by the owner on 2026-10-01 (Q3)**, kept with its unit tests; RM-4 removes this entry by adding the first caller | FR-021 and User Story 6 require the one permission layer with Admin and Member roles in this slice, tested against an admin-only rule; RM-4 is its first caller | Deferring it to RM-4 would leave User Story 6 scenarios 2 and 3 and FR-021's `403` unbuilt in RM-3, which the spec does not allow without the owner changing scope |

## Resolved owner questions

Answered by the owner on 2026-10-01; the plan and its artifacts follow these answers.

- **Q1 (local email)**: How should local development deliver email to Mailpit: (a) `nodemailer` to SMTP port 1025, (b) Mailpit's HTTP send API through `fetch`, or (c) a hand-written SMTP client? **Answer: (b).** No package; `src/server/email.ts` sends local email with `fetch` to `POST http://{MAILPIT_HOST}:{MAILPIT_PORT}/api/v1/send`, like production's Resend call. `MAILPIT_PORT` is Mailpit's web/API port (default 8025); Mailpit's SMTP port is not used (research R3, contracts/email.md, quickstart.md).
- **Q2 (Drizzle ORM)**: Approve `drizzle-orm` for RM-3, or keep the approved postgres.js tagged queries? **Answer: keep postgres.js for RM-3; `drizzle-orm` is not added** (research R1).
- **Q3 (Constitution Principle II)**: Accept `requireAdmin` without a caller until RM-4, or defer the role check? **Answer: accepted** as the Complexity Tracking exception, owner-approved 2026-10-01; `requireAdmin` is kept with its tests (research R9).

- **U1 (test isolation for the setup tests)**: `/speckit-analyze` found that `createFirstAdmin` cannot both own its locked transaction and run inside a test's rolled-back transaction, and that parallel database test files could see each other's committed rows. **Answer (owner, 2026-10-01):** the `unit` Vitest project runs test files one at a time (`fileParallelism: false` in `vitest.config.ts`, T002), which stops RM-1's `src/server/migrations.test.ts` from dropping and recreating `public` while other database test files run, and that file's `afterAll` restores the real schema (drop `public`, recreate it, then `applyMigrations(sql, path.resolve("migrations"))`, T088), so files that run after it still find the RM-3 tables; the two together make database tests independent of file order; `createFirstAdmin(sql, input)` owns its transaction with the table lock and is never wrapped in a rolled-back transaction; the setup tests (T016) run against the test database and, before each test, delete and commit `sessions`, `magic_links`, `sign_in_requests` and `sign_in_attempts`, then `members`, so `members` is committed-empty; the race test calls `createFirstAdmin` at the same time on two separate connections and asserts exactly one admin exists and the other call reports `Setup already done` (research R20).

### Follow-up raised by an answer (resolved)

- From Q2: `docs/tracklite-spec.md` section 12 still names Drizzle ORM as part of the stack, and RM-1 (001 plan Q3) deferred its approval to RM-3, which now keeps postgres.js. Should section 12 be changed to postgres.js, or should `drizzle-orm` be asked for again in a later slice (which one)? RM-3 is not affected either way. **Resolved: section 12 changed to postgres.js (owner, 2026-10-01).**
