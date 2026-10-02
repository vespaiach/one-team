# Contract: HTTP API for sign-in (RM-3)

Extends RM-1's convention (`specs/001-project-foundation/contracts/http-api.md`): JSON bodies, the `{ "error": { "message", "fields"? } }` shape, every handler wrapped by `apiRoute`, errors raised by throwing `ApiError`, no token in any path segment. Shapes are in [data-model.md](../data-model.md); reasons in [research.md](../research.md).

## Changes to the shared wrapper and convention

- **Cross-site writes (SEC-004, FR-018)**: `apiRoute` answers `403` `{ "error": { "message": "You don't have permission to do that." } }` to any `POST`, `PUT`, `PATCH` or `DELETE` whose `Sec-Fetch-Site` is present and not `same-origin`, or (header absent) whose `Origin` is present and differs from `APP_URL`'s origin. The handler does not run; nothing changes (research R10).
- **Session required (STD-1, FR-019, FR-020)**: every `/api/…` handler calls `requireMember(request)` first, except the three endpoints below (only their own method: `POST /api/sign-in-links`, `POST /api/sessions`, `DELETE /api/sessions/current`), and answers `401` `{ "error": { "message": "Not signed in" } }` without a valid `session` cookie. A request with an invalid cookie also gets `Set-Cookie` clearing it.
- **Not allowed (STD-2, FR-021)**: `requireAdmin(member)` answers `403` "You don't have permission to do that." No RM-3 endpoint uses it; it ships with its unit tests as the Complexity Tracking exception the owner accepted on 2026-10-01 (Q3), and RM-4 is its first caller.
- **Statuses added**: `429` (sign-in limit) and `503` (email send failed), only on `POST /api/sign-in-links`, as recorded in DEC-002 (docs/tracklite-spec.md section 12: requesting a sign-in link may also answer `429` when a SEC-001 limit is reached and `503` when the email couldn't be sent, STD-6). Raised with `ApiError` like the others; any other failure stays the wrapper's `500`.
- **Catch-all** `src/app/api/[[...path]]/route.ts`: now `401` when signed out, `404` as before when signed in. Its handler moves to `src/server/permissions.ts` as `unmatchedRoute` (wrapped in `apiRoute`: `requireMember(request)`, then `ApiError(404, "Not found")`), which the catch-all exports for all seven methods and the three sign-in route files export for every other method ("Other methods on the sign-in paths" below). AGENTS.md's catch-all sentence ("answers a JSON `404`") is amended to say this in the same change (plan.md outline step 10).

## `POST /api/sign-in-links` — request a magic link (no session needed)

Request:

```json
{ "email": "sam@acme.com", "requestId": "<uuid v4>", "next": "/project/WEB" }
```

`next` is optional (the page's `next` query parameter). Any same-app path is kept with its query string, including `/api/…`, `/health` and `/sign-in…`; anything else is replaced by nothing (destination `/my-issues`) (research R8).

| Case | Status | Body | Side effects |
|------|--------|------|--------------|
| Body not a JSON object (non-JSON, `null`, an array, a string…) | `422` | `{ "error": { "message": "Invalid input" } }` | none |
| `requestId` missing or not a UUID | `422` | `{ "error": { "message": "Invalid input" } }` | none |
| `requestId` already recorded (accepted before); the `email` and `next` sent with it are ignored, so even an invalid email gets this answer | `200` | `{ "outcome": "checkEmail" }` | none: no email, not counted |
| `email` missing or failing the one email rule (`isValidEmail`: trimmed, WHATWG `type="email"`, at most 254 characters; research R16) | `422` | `{ "error": { "message": "Invalid input", "fields": { "email": "Enter a valid email address." } } }` | none, not counted |
| Email key or client IP past its limit (research R11; the IP key is the trimmed rightmost `X-Forwarded-For` entry, or the fixed key `unknown` when the header is missing or that entry is empty, so all such requests share one 20-per-hour bucket) | `429` | `{ "error": { "message": "Too many sign-in requests. Try again later." } }` | none, not counted; identical for members and non-members |
| Not an active member's email | `200` | `{ "outcome": "checkEmail" }` | counted; `requestId` recorded; no email |
| Active member, email sent | `200` | `{ "outcome": "checkEmail" }` | counted; link created (expires in 15 min); email sent; `requestId` recorded |
| Active member, send failed | `503` | `{ "error": { "message": "We couldn't send the email. Try again." } }` | counted; link row deleted; `requestId` not recorded; error log line without address or link. A 10 s timeout is a failed send even if the provider still delivers the email: that link no longer exists, so its Sign in shows `expired` (spec edge case, accepted) |

The browser generates a new `requestId` for every form submission, including after a `503` toast (FR-005, FR-009). Checks run in the table's order (research R11): parse the JSON body (a body that is not a JSON object (non-JSON, `null`, an array, a string…) → `422` "Invalid input") → validate `requestId` → replay check → validate `email` → limit check → member lookup and send. The replay check runs before the email and limit checks, so a repeat of an accepted `requestId` gets `checkEmail` even when the email or IP is now past its limit (FR-008's one exception).

## `POST /api/sessions` — use a magic link (no session needed)

Handled by `redeemSignInLink` in `src/server/signIn.ts`.

Request:

```json
{ "token": "<first value of the token query parameter, possibly empty>", "requestId": "<uuid v4>" }
```

`requestId` is made once per landing-page load and reused for every Sign in click from that load, including a retry after the failure toast (FR-012). All outcomes are `200` except the two `422` rows; for the landing page any non-2xx answer means a network or server failure (the STD-9 toast). Steps run in this order (research R12): parse the JSON body (as `POST /api/sign-in-links` does; a body that is not a JSON object (non-JSON, `null`, an array, a string…) → `422` "Invalid input") → validate `requestId` → read the browser's session → link lookup and the signed-in-as-another check → replay check → the conditional update. The signed-in-as-another check runs before the replay check, so a replay is answered only when nobody is signed in or the signed-in member is the link's member; it never silently replaces another member's session (REQ-005.5, FR-011).

| Case | Body | Side effects |
|------|------|--------------|
| A member is signed in and the link is not theirs (another member's, unknown or malformed token) | `{ "outcome": "signedInAsOther", "fullName": "Alex Doe" }` | none: link unused, session unchanged (REQ-005.5); checked before the replay row, so it also answers a replay of another member's link |
| Replay (nobody signed in, or the signed-in member is the link's member): a live session (data-model.md's validity rule: `ended_at` null, `last_active_at` within 30 days, member active) was already created with this `requestId` **and** its `sessions.magic_link_id` is not null **and** `sha256(token)` equals the `token_hash` of that link | `{ "outcome": "signedIn", "destination": "<that link's destination or /my-issues>" }` | when the browser's current session is a different session (the same member's), it is ended first, as in the normal row; then that session gets a new token; `Set-Cookie`. A matching `requestId` with any other token, or for a session that is no longer live (ended, lapsed, or its member deactivated) or whose link was deleted (`magic_link_id` null, RM-14's DATA-004), is not a replay and takes the rows below (a deleted link matches nothing, like an unknown token): no cookie from the earlier session |
| `requestId` already stored on a session (live or not) and the token is a different valid, unused, unexpired link of an active member | `422` `{ "error": { "message": "Invalid input" } }` | none: the unique-key violation on `sessions.request_id` is caught, the transaction rolls back, no session is created, the link stays unused; `ApiError`, so nothing in the error log (FR-012's exception) |
| Link unknown, malformed, used, expired, or its member inactive (nobody signed in, or the link is the signed-in member's own) | `{ "outcome": "expired" }` | none; an existing session stays |
| Valid, unused, unexpired link of an active member | `{ "outcome": "signedIn", "destination": "<stored destination or /my-issues>" }` | link marked used; the browser's current session (the same member's) ended; new session; `Set-Cookie: session=…`; log "sign-in, member {username}" |
| Body not a JSON object (non-JSON, `null`, an array, a string…), or `requestId` missing or not a UUID | `422` `{ "error": { "message": "Invalid input" } }` | none |

A `token` that is empty, malformed, missing or not a string is never a `422`: it matches no link and is answered like an unknown token (`signedInAsOther` or `expired`, FR-023).

Two clicks for the same link in two tabs, or again after a reload (different `requestId`s): the first gets `signedIn`, the second `expired`. A retry from the same page load after the first answer was lost (same `requestId` and token) gets the replay row: `signedIn`.

## `DELETE /api/sessions/current` — sign out (no session needed)

No body. Always `204` (never `401`): ends whichever session this browser's cookie names if it is still live (`ended_at`), even when a stale tab showed a different member (the spec accepts this), and always answers `Set-Cookie: session=; Max-Age=0; …`. Other browsers' sessions continue (REQ-006). Cross-site requests get `403` and nothing changes (FR-018).

## Other methods on the sign-in paths

Next answers a method a route file does not export with its own `405` (no JSON body, outside `apiRoute`, no log line) and auto-implements `OPTIONS` (a `204` with an `Allow` header) and `HEAD` (from `GET`) (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, `auto-implement-methods.js`). So each of the three route files exports every method Next supports (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`): its own method as above, and every other one as the shared `unmatchedRoute` from `src/server/permissions.ts`, the same handler the catch-all uses. Those methods answer exactly as the catch-all does (STD-1, FR-019: none of them is one of the three exempt endpoints):

| Path | Own method | Every other method (`unmatchedRoute`) |
|------|------------|----------------------------------------|
| `/api/sign-in-links` | `POST` | signed out: `401` `{ "error": { "message": "Not signed in" } }` (plus the clearing `Set-Cookie` when the request carried an invalid `session` cookie); signed in: `404` `{ "error": { "message": "Not found" } }` |
| `/api/sessions` | `POST` | same |
| `/api/sessions/current` | `DELETE` | same |

Each goes through `apiRoute`, so it writes the one timing line, and a cross-site `PUT`, `PATCH`, `DELETE` or `POST` among them gets the wrapper's `403` before the handler runs (FR-018). No `405` and no Next-generated `OPTIONS` or `HEAD` answer is ever sent for these paths.

## Logging

Each endpoint writes RM-1's one timing line (method, path, status, duration; no query, body, headers or cookies). The sign-in and failed-send lines are in [data-model.md](../data-model.md). No token, link, cookie value or email address is ever logged (SEC-007, FR-027).
