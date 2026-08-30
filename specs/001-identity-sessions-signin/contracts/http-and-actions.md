# Contract — HTTP surface and Server Actions

**Plan**: [`../plan.md`](../plan.md) · **Data model**: [`../data-model.md`](../data-model.md)

Everything an unauthenticated caller can reach. `OT-SEC-002` allows exactly four public routes; this
feature opens three and leaves invitation acceptance closed until R3.

Every entry point below validates its input on the server whatever the client also checked
(Principle II, `FR-024`, `FR-027`), and every mutating one calls `assertSameOrigin()` first
(`FR-023`, research B-5).

---

## `POST /api/auth/signin`

A Route Handler at `src/app/api/auth/signin/route.ts`. **The one mutation in the product that is not
a Server Action** — §6 pins it here so the throttle and the origin check sit in one place.

### Request

`Content-Type: application/json`

```jsonc
{ "email": "string", "password": "string" }
```

**Validation, in order.** Origin → shape → address form → throttle → credentials. A body that is not
an object, a missing field, a non-string, an address over 200 characters, one that is not an
address, or a password over 128 characters is refused before anything is read from the database.
The length bound holds on this verification path as well as where a credential is set, so no
unbounded value reaches Argon2id (`FR-026`).

### Response

Always `200` with a discriminated union, except the two refusals noted. The client renders the
variant; nothing about which variant was returned is expressed in the status line, so a caller
cannot distinguish outcomes without reading the body.

| Variant | Body | Effects |
| --- | --- | --- |
| `ok` | `{ "result": "ok" }` | one `session` row written; the session cookie set; that address's `('signin','email')` attempt rows cleared |
| `rejected` | `{ "result": "rejected" }` | one `('signin','email')` and one `('signin','ip')` attempt row written |
| `deactivated` | `{ "result": "deactivated", "contact": "string \| null" }` | no session; no attempt row — the credentials were proved |
| `throttled` | `{ "result": "throttled", "retryAfterSeconds": number }` | no credential check performed; the screen renders it as whole minutes rounded up (`FR-039`) |

**`rejected` covers a wrong password, an unknown address, and an account with no credential row, and
nothing distinguishes the three** (`FR-062`) — not
the body, not the status, not a header, and not the time taken: an unknown address still performs an
Argon2id verification against a fixed dummy hash so the two paths cost the same (`FR-013`,
`OT-SEC-011`, `SC-003`).

**`deactivated` is reachable only by a caller who proved the password.** Otherwise it is an
account-existence oracle (spec edge case). `contact` is `SUPPORT_EMAIL` from the environment, or
`null` when the operator configured none — never a value read from a `user` row (`FR-014`,
`FR-015`, `OT-SEC-018`).

### Refusals outside the union

| Condition | Status | Body |
| --- | --- | --- |
| `Origin` absent, or not the origin `APP_URL` names | `403` | `{ "error": "forbidden" }` |
| Body malformed or fields missing | `400` | `{ "error": "invalid_request" }` |

### The cookie

One cookie, set only on `ok`:

```text
one_team_session=<32 random bytes, base64url>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000[; Secure]
```

The name is `one_team_session`, fixed here rather than left to the implementation so the sign-in
handler, `loadActor()` and every later slice name the same string.

Opaque — no claims, nothing to verify (`FR-017`, `OT-SEC-007`). The stored value is its SHA-256
digest, so the database never holds a working credential. `Secure` is set in production; see
research B-7 for the development exception. There is no "remember me" control and no variant
without the 30-day sliding window.

### Never in the response, the cookie, or a log

A password, a hash, a session token, a reset token, a SQL string, a stack trace, or any
configuration value other than `SUPPORT_EMAIL` (`FR-025`, `FR-028`, `SC-010`).

---

## `GET /signin`

Renders the sign-in card (see [`auth-layout.md`](./auth-layout.md)). Reads nothing from the database,
and does **not** redirect a caller who already holds a valid session — it renders the form to them
like anyone else, and a successful post mints a second session rather than touching the first
(`FR-060`, `FR-061`).

`?reset=done` renders the success banner a completed reset redirects to (`FR-038`). No other query
parameter is honoured — in particular, no error state is reachable through the URL.

---

## `GET /reset`

With no `token`, renders the reset-request card. With `token`, renders Change password (screen 13) in
one of four states — the token is looked up server-side and only the resulting `ResetTokenState`
reaches the client. **The token value is never echoed into the rendered HTML.**

**An empty or malformed `token` renders `unknown`, without a lookup** (`FR-067`). It is not treated as
an absent token, so `?token=` left over from a link mangled in transit explains itself rather than
silently showing the request form.

The reset-request card has its own **throttled** state (`FR-087`): resets count under the same two
limits in their own flow (`FR-040`), so `requestPasswordReset` can return `throttled` here exactly as
sign-in can.

---

## Server Actions

Both live in `src/features/auth/actions.ts`, a module with top-level `"use server"` — the only
module a Client Component in this feature imports server behaviour from (AGENTS.md).

Each is a public server entry point: origin check, then validation, then the work.

### `requestPasswordReset(prevState, formData)`

| | |
| --- | --- |
| Input | `email` |
| Returns | always `{ status: 'sent' }` — the same answer whether or not the address has an account (`FR-031`, `OT-SEC-011`), or `{ status: 'throttled', retryAfterSeconds }` |
| Always | writes one `('reset','email')` and one `('reset','ip')` attempt row, on every request without exception (`FR-032`) |
| Sometimes | mails a single-use link, only where the address belongs to an account that may sign in — an active account with a credential (`FR-033`) |
| Never | changes its answer because mail failed; the failure goes to the server log alone (spec edge case) |
| Never | mails to a deactivated account (spec assumption) |

The token is 32 random bytes; its SHA-256 digest is stored and its plaintext appears only in the
mail body. It expires one hour after it is issued, and the mailed link is an absolute URL built from
`APP_URL` (`FR-033`).

### `completePasswordReset(prevState, formData)`

| | |
| --- | --- |
| Input | `token`, `password`, `confirmPassword` |
| Returns | `{ status: 'mismatch' }` · `{ status: 'policy', failure: 'too_short' \| 'too_long' \| 'blocklisted' }` · `{ status: 'used' \| 'expired' \| 'unknown' }` · or redirects |
| Deactivated owner | the token is spent, no password is written, and `unknown` is returned — naming the account's condition would disclose it to whoever holds the link (`FR-066`, `FR-015`) |
| On success | redirects to `/signin?reset=done` |

**One transaction** does all of: spend the token (`UPDATE … WHERE used_at IS NULL`), write the new
hash to `credential`, clear `must_change_password`, and delete **every** `session` row for that user
— including the one that made the request (`FR-038`, `FR-050`, `OT-SEC-012`). Zero rows affected by
the token update rolls the whole thing back.

`mismatch` renders inline on Confirm password and writes nothing (`FR-035`). `policy` names the one
rule that failed rather than restating the others (spec edge case). The three token states are
distinguishable from one another and each offers the same route forward, back to `/reset`
(`FR-036`, `OT-SEC-016`).

---

## Password policy — the same at every entry point

`FR-026`, `FR-027`, `OT-SEC-004`, `OT-SEC-019`. One function, `assertPasswordPolicy()`, in
`src/features/auth/server/password-policy.ts`:

| Rule | Failure |
| --- | --- |
| At least 12 characters | `too_short` |
| At most 128 characters | `too_long` |
| Not on the common-password blocklist, compared case-insensitively | `blocklisted` |
| No composition rules — no required symbol, digit or case | — |

Enforced on the server at **every** entry point that sets a credential: `completePasswordReset`,
first-run seeding, and `admin:grant`. A screen may also check on blur, which is a UX affordance and
never the control.

---

## Routes this feature does **not** open

| Route | Owner |
| --- | --- |
| `/invite/accept` and every invitation-issuing route | R3 |
| A sign-out control | R2 — the capability ships here, the user chip that offers it does not |
| Any route that sets a `role` | nothing in v1; role changes are CLI-only (`FR-055`, `OT-AUTHZ-011`) |
| A sign-up route | nothing, ever (`OT-SEC-003`) |
