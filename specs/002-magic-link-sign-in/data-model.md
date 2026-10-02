# Data Model: Magic-link Sign-in (RM-3)

One new migration, `migrations/0001_magic_link_sign_in.sql` (the first file in `migrations/`, which this slice creates). It only adds tables, so the previous release's code keeps working (OPS-004). Every timestamp is `timestamptz` written in UTC (DATA-003); every time comparison uses the database's `now()` (research R14). Tokens are stored only as `sha256` hex hashes (SEC-003, research R4).

## members

A person with an account (section 8 Member). RM-3 creates rows only through the setup command (FR-001) and the seed script.

| Column | Type | Rules |
|--------|------|-------|
| `id` | `bigint generated always as identity` | primary key |
| `email` | `text not null` | stored trimmed as entered; unique index on `lower(email)`; valid by the one email rule, `isValidEmail` in `src/server/emailAddress.ts` (WHATWG `type="email"`, at most 254 characters after trimming; research R16), shared with the sign-in form |
| `full_name` | `text not null` | trimmed; 1 to 60 characters; blank or whitespace-only → "Name required"; over 60 characters after trimming → "Too long (max 60)" (REQ-003) |
| `username` | `text not null` | lowercased before validation and storage; `^[a-z0-9-]{2,20}$`; unique index on `lower(username)` |
| `role` | `text not null` | `check (role in ('admin', 'member'))` |
| `active` | `boolean not null default true` | false = deactivated (set by RM-4); an inactive member can't request, use a link or keep a session |
| `created_at` | `timestamptz not null default now()` | |

Never deleted (section 8). Validation lives once in `src/server/members.ts`.

## magic_links

A single-use sign-in link for one member (section 8 Magic link, REQ-004, REQ-005).

| Column | Type | Rules |
|--------|------|-------|
| `id` | `bigint generated always as identity` | primary key |
| `member_id` | `bigint not null references members(id)` | |
| `token_hash` | `text not null unique` | `sha256` of the 256-bit token sent in the email |
| `destination` | `text` | validated same-app path from `next` (research R8); null → `/my-issues` |
| `expires_at` | `timestamptz not null` | `now() + interval '15 minutes'` when created |
| `used_at` | `timestamptz` | set once, by the conditional update that signs in |
| `created_at` | `timestamptz not null default now()` | |

States: **unused** (`used_at` null, `expires_at > now()`) → **used** (`used_at` set) or **expired** (`expires_at <= now()`). Only the unused state with an active member can sign in; every other case answers `expired` (FR-013). Several unused links for one member coexist (REQ-004.3). The row is deleted when its email failed to send, including a 10 s timeout the provider still delivers later, so no usable link is left and that email's Sign in shows `expired` (FR-009, spec edge case). Deleting old used or expired rows is RM-14 (DATA-004); the sessions they started keep their rows with `magic_link_id` set to null (`on delete set null`).

## sessions

A member's signed-in state in one browser (section 8 Session, REQ-006).

| Column | Type | Rules |
|--------|------|-------|
| `id` | `bigint generated always as identity` | primary key |
| `member_id` | `bigint not null references members(id)` | index (RM-4 ends all of a member's sessions on deactivation) |
| `token_hash` | `text not null unique` | `sha256` of the token in the `session` cookie; replaced when a repeated `requestId` re-issues the token |
| `magic_link_id` | `bigint references magic_links(id) on delete set null` | the link that started it; set to null when RM-14 deletes that link (DATA-004), and the session stays valid; a repeated `requestId` is replayed only while this is not null and the submitted token hashes to this link's `token_hash`, and gets this link's destination (FR-012) |
| `request_id` | `uuid not null unique` | the browser's `requestId` from `POST /api/sessions`, made once per landing-page load (AGENTS.md, FR-012); stored plainly, so it is never enough on its own to get a session; a request that reuses it with a different valid, unused link violates this constraint, which is caught and answered `422` with nothing changed (research R12) |
| `created_at` | `timestamptz not null default now()` | |
| `last_active_at` | `timestamptz not null default now()` | updated by every authenticated request (FR-015) |
| `ended_at` | `timestamptz` | set by sign-out, by a new sign-in that replaces it in the same browser, or by a replay answered from a different session of the same member in that browser (below) |

Valid when `ended_at is null`, `last_active_at > now() - interval '30 days'` and the member is active (`validateSession` in `src/server/session.ts`, research R14).

Replay rule for `POST /api/sessions` (FR-012, research R12): answered from an existing session only when nobody is signed in on that browser or the signed-in member is the link's member (the signed-in-as-another check, FR-011, runs first, so a replay never replaces another member's session), that session is live, its `request_id` equals the request's `requestId`, its `magic_link_id` is not null, and `sha256(token)` equals `magic_links.token_hash` for that `magic_link_id`. When the browser's current session (necessarily the link's own member's) is a different row from the replayed one, the replay first sets that current session's `ended_at`, as the normal path does, then re-tokens the replayed session, so the browser keeps one live session (research R12 step 3). Otherwise the request takes the normal path (link lookup and the conditional update), and no cookie is issued from the earlier session: once the session's link has been deleted (`magic_link_id` null), a repeat finds no link and answers `expired`; a repeat with a different valid, unused link fails the insert on the unique `request_id`, which rolls back (no session, that link stays unused) and answers `422`. States: **live** → **ended** (sign-out, replaced) or **lapsed** (30 days without activity). Ended and lapsed rows are kept until RM-14 removes them (DATA-004).

## sign_in_requests

The replay record for accepted magic-link requests (spec Key Entities, FR-005).

| Column | Type | Rules |
|--------|------|-------|
| `request_id` | `uuid primary key` | the browser-generated `requestId` |
| `created_at` | `timestamptz not null default now()` | |

Written only when a request is accepted (the email was sent, or the non-member got the normal answer). Every accepted request has the same answer, "Check your email", so the answer itself is not stored. A refused or failed request writes nothing here, so its `requestId` is evaluated as new if repeated. DATA-004 (docs/tracklite-spec.md, built in RM-14) deletes rows 30 days after they stop being useful, which is a day after they're made. That day only sets when cleanup happens and is not a replay limit: a repeat is answered "Check your email" for as long as the row exists (FR-005), and once the row is deleted a repeat is evaluated as new.

## sign_in_attempts

The SEC-001 limit count, kept separately from the replay record (spec Key Entities, FR-008).

| Column | Type | Rules |
|--------|------|-------|
| `id` | `bigint generated always as identity` | primary key |
| `email_key` | `text not null` | trimmed, lowercased email; index `(email_key, created_at)` |
| `ip` | `text not null` | client address: the rightmost `X-Forwarded-For` entry, trimmed, or the fixed key `unknown` when the header is missing or that entry is empty (research R11; trustworthy only once RM-2's reverse proxy appends or overwrites it); index `(ip, created_at)` |
| `created_at` | `timestamptz not null default now()` | |

One row per request that passed the limit check, whether its send then succeeded or failed. Not written for invalid input (`422`), refused requests (`429`) or repeats of an accepted `requestId`. Rows are needed for one hour; DATA-004 (docs/tracklite-spec.md, built in RM-14) deletes them 30 days after they stop being useful, which is an hour after they're made.

## Session cookie (browser)

`session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000` plus `Secure` when `NODE_ENV` is `production` (research R5). Cleared with `Max-Age=0` in three places: on sign-out, on a page request through the Proxy that presents an invalid value, and on an API `401` for a request that carried the cookie.

## Configuration (read at start-up, research R6 and R7)

| Setting | Needed in | Meaning |
|---------|-----------|---------|
| `DATABASE_URL` | both (RM-1) | development or production database |
| `TEST_DATABASE_URL` | tests (RM-1) | test database |
| `APP_URL` | both | the app's own address, an absolute `http` or `https` origin with no path, e.g. `http://localhost:3000`; used for the email link, the return-to origin check and the cross-site `Origin` check |
| `EMAIL_FROM` | both | sender address, a valid email by `isValidEmail`; the sender name is always "Tracklite" (design.md) |
| `RESEND_API_KEY` | production only | Resend API key (OPS-006) |
| `MAILPIT_HOST`, `MAILPIT_PORT` | local development only | host and web/API port of Mailpit's HTTP send API (default `localhost`, `8025`; the port an integer from 1 to 65535), called at `/api/v1/send` (owner answer Q1); Mailpit's SMTP port is not used |

A missing setting stops the app server with `Missing setting: NAME`, a malformed one with `Invalid setting: NAME` (FR-029, research R7). All live in the git-ignored `.env.local`; `.env.example` gains placeholders only (OPS-006).

## Member as seen by the app (server, in memory)

`{ id, fullName, username, role: "admin" | "member" }`, returned by session validation. `AppShell` receives `{ fullName }` and computes initials with `src/lib/initials.ts`; later slices read `role` to hide actions (FR-022).

## Log entries added (standard output, one JSON object per line)

| Event | Shape |
|-------|-------|
| Sign-in | `{ "time": "<ISO UTC>", "message": "sign-in, member <username>" }` |
| Failed magic-link send | `{ "time": "<ISO UTC>", "level": "error", "message": "magic-link email failed", "status": <number or "network"> }` |

Never a token, link, cookie value or email address (SEC-007).
