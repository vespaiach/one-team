# Phase 0 research — R1: identity, sessions and sign-in

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Design brief**: [`design-brief.md`](./design-brief.md)

Every entry below resolves something the specification, the roadmap or the design brief leaves
open. Each records the decision, why it was chosen, and what was rejected. Nothing here overrides
[`docs/product/specifications.md`](../../docs/product/specifications.md); where the source states a
value, this document restates it rather than deciding it.

Entries are grouped: **A** settles the shared layout and the visual foundation the design brief
asks for, **B** settles the transport and runtime shape, **C** settles persistence and concurrency,
**D** settles testing.

---

## A. The common layout and the visual foundation

### A-1. The three unauthenticated screens share one Next.js layout in a route group

**Decision.** Create `src/app/(auth)/layout.tsx` and move the three surfaces under it:

```text
src/app/(auth)/layout.tsx      the page background, the centred card, the app mark
src/app/(auth)/signin/page.tsx  /signin
src/app/(auth)/reset/page.tsx   /reset and /reset?token=…
```

The route group adds no URL segment, so the routes stay `/signin` and `/reset` exactly as
`OT-SEC-002` and §3 fix them. The layout owns the frame — page background, vertical and horizontal
centring, the card surface, its border, radius, padding and max-width, and the app mark above it.
Each page owns its own `<h1>`, its body and its states.

**Rationale.** Three surfaces exist on day one — sign-in, the reset request, and change password —
so Principle I's two-call-site rule is satisfied by fact rather than by anticipation. A route-group
layout is the framework's own mechanism for exactly this (`03-api-reference/03-file-conventions/route-groups.md`),
which makes it the Principle IV answer as well: no shared wrapper component is invented for
something the router already expresses. It also makes `OT-UX-001`'s "outside the shell" structural
rather than a convention each page must remember — when R2 adds `src/app/(app)/layout.tsx` for the
262px sidebar and header, the two groups are siblings and neither can leak into the other.

**Alternatives rejected.**

- *An `AuthCard` component each page renders.* Same markup, but the "outside the shell" rule
  becomes a thing three pages must each remember to honour, and a fourth (R3's `/invite/accept`)
  can forget. The router already has the concept; wrapping it in a component adds indirection (III).
- *One layout for the whole app with a conditional shell.* A branch on the pathname inside a layout
  is the clever version of a directory (III), and layouts do not re-render on client-side
  navigation, so the branch would go stale.
- *No shared layout; each page centres its own card.* Duplicates the load-bearing visual decisions
  three times, which is where drift starts, and gives R3 nothing to join.

### A-2. The layout stays a Server Component; only the forms cross to the client

**Decision.** `(auth)/layout.tsx` imports nothing from `react-aria-components` and carries no
`"use client"`. Each page is a Server Component that renders one client form component
(`src/features/auth/components/…`) at the narrowest boundary.

**Rationale.** Every `react-aria-components` subpath export begins with `import 'client-only'`
(verified in `dist/types/exports/Form.d.ts` and `TextField.d.ts` at the pinned 1.20.0), so importing
one into the layout would pull the whole group's frame into the client module graph for no
interaction. The frame has none: it is a background, a box and a heading.

### A-3. Dark mode is **out** of v1

**Decision.** Delete the `@media (prefers-color-scheme: dark)` block that the Next.js starter left
in `src/app/globals.css`. Define one set of colour tokens. Do not add `data-theme`, a toggle, or a
second token value anywhere.

**Rationale.** The specification never mentions dark mode; §7 defines seven content colours and
nothing else. Under Principle IV and Principle III a second full token set is machinery justified by
no requirement present in the codebase today, and the design brief is explicit that the cost lands
on all eleven later slices. The block currently in `globals.css` is starter residue, not a decision
the team made — it is dead code under Principle VI.

**Reversibility.** Because every colour is consumed as a semantic token (A-4), adding dark mode
later means adding a second value per token in one file, not editing components. That is recorded
so the choice reads as deferred rather than foreclosed.

### A-4. The neutral scale — ten steps anchored on the palette's own grey

**Decision.** A ten-step neutral ramp whose 500 step **is** the specification's `grey #8b909a`, so
the neutral scale and the content palette are one system rather than two:

| Token | Value | | Token | Value |
| --- | --- | --- | --- | --- |
| `--color-neutral-50` | `#f7f8f9` | | `--color-neutral-500` | `#8b909a` |
| `--color-neutral-100` | `#eef0f2` | | `--color-neutral-600` | `#6b7079` |
| `--color-neutral-200` | `#e2e5e9` | | `--color-neutral-700` | `#4d525a` |
| `--color-neutral-300` | `#cdd2d8` | | `--color-neutral-800` | `#33373d` |
| `--color-neutral-400` | `#aab0b9` | | `--color-neutral-900` | `#1c1f23` |

Components never name a ramp step. They name a semantic token:

| Token | Value | Role |
| --- | --- | --- |
| `--color-page` | `neutral-100` `#eef0f2` | the page behind the card |
| `--color-surface` | `#ffffff` | the card, and every input fill |
| `--color-border` | `neutral-300` `#cdd2d8` | dividers and the card edge — decorative only |
| `--color-border-control` | `neutral-500` `#8b909a` | input and control boundaries |
| `--color-text` | `neutral-900` `#1c1f23` | body and headings |
| `--color-text-muted` | `neutral-600` `#6b7079` | secondary and helper text |
| `--color-text-disabled` | `neutral-400` `#aab0b9` | disabled control text |
| `--color-accent` | `#5b5bd6` | §7 accent — the default wherever a colour is required |
| `--color-accent-hover` | `#4a4ac4` | `data-hovered` on an accent-filled control |
| `--color-accent-pressed` | `#3f3fb0` | `data-pressed` |
| `--color-danger` | `#c8453c` | §7 red — error text and invalid borders |
| `--color-danger-surface` | `#fdf2f1` | the fill behind a message-level error |
| `--color-focus` | `#5b5bd6` | the focus ring (A-8) |

**Contrast, measured rather than assumed** (WCAG 2.1 ratios against `--color-surface` `#ffffff`):

| Pair | Ratio | Requirement | |
| --- | --- | --- | --- |
| `--color-text` on surface | 16.54:1 | 4.5:1 text | pass |
| `--color-text-muted` on surface | 4.98:1 | 4.5:1 text | pass |
| `--color-danger` on surface | 4.80:1 | 4.5:1 text | pass |
| `--color-accent` on surface | 5.37:1 | 4.5:1 text · 3:1 non-text | pass |
| `#ffffff` on `--color-accent` | 5.37:1 | 4.5:1 text | pass |
| `--color-border-control` on surface | 3.20:1 | 3:1 non-text (1.4.11) | pass |
| `--color-border` on surface | 1.52:1 | decorative only | **not a control boundary** |
| `--color-text` on **page** | 14.48:1 | 4.5:1 text | pass |
| `--color-text-muted` on **page** | 4.36:1 | 4.5:1 text | **fails** |
| `--color-danger` on **page** | 4.20:1 | 4.5:1 text | **fails** |

**Two tokens are surface-only, and their names do not say so — so the rule is written down here.**
`--color-text-muted` and `--color-danger` clear AA against `--color-surface` and miss it against
`--color-page`. Every text on these three screens sits inside the card, with exactly one exception:
the app mark, which sits on the page. **It uses `--color-text`** (14.48:1), not muted (A-7).
Anything a later slice renders directly on `--color-page` follows the same rule, or introduces a
`--color-text-muted-on-page` token at `neutral-700` (6.88:1) — the fix is a darker text token, never
a lighter page.

**Rationale.** Anchoring 500 on `#8b909a` means the one grey the specification already fixed is not
duplicated by a near-miss neighbour. The two-tier border token exists because `#cdd2d8` reads well
as a card edge but fails WCAG 1.4.11's 3:1 for anything a user has to aim at — writing that
distinction into the token names is what stops the failure recurring in eleven later slices.

**Alternatives rejected.** *A single `--color-border`.* One token would have to satisfy both the
decorative and the control case; the value that passes 3:1 is heavier than a card edge wants, and
the value that looks right fails. *A hue-neutral grey ramp.* It would sit slightly warm against the
violet accent, and would not contain the specification's own grey.

### A-5. Type scale — Tailwind v4's default, five steps of it, each with one job

**Decision.** Add **no** type tokens. Use Tailwind v4's built-in scale and fix which five steps the
product uses and what each is for:

| Step | Size / line-height | Used for |
| --- | --- | --- |
| `text-xs` | 12 / 16 | field error text, helper text |
| `text-sm` | 14 / 20 | field labels, secondary and muted lines |
| `text-base` | 16 / 24 | input values, body copy, button labels |
| `text-lg` | 18 / 28 | reserved for R2's header title block |
| `text-2xl` | 24 / 32 | the card heading (`<h1>`) |

**Rationale.** Principle IV — a built-in covers the need, so redeclaring identical values in
`@theme inline` would be a dependency on our own restatement. The decision the design brief actually
asks for is *how many steps and what they mean*, and that is what is fixed here.

### A-6. Spacing — Tailwind v4's default 0.25rem unit, on a rhythm of 4

**Decision.** Keep `--spacing: 0.25rem`. The card's rhythm: `p-8` (32px) card padding, `gap-5`
(20px) between fields, `gap-6` (24px) between sections, `gap-2` (8px) between a label, its input and
its error. Nothing on these screens uses an odd multiple.

**Rationale.** As A-5 — the built-in unit is already 4px; the decision worth recording is the rhythm
built on it, not the unit.

### A-7. Card geometry and field treatment

**Decision.**

| | |
| --- | --- |
| Card max-width | `400px` |
| Card | `--color-surface` fill, `1px --color-border`, `rounded-lg` (8px), `p-8`, no shadow |
| Placement | horizontally centred; vertically centred with `py-16` on the centring container, so a tall state scrolls rather than centring off-screen |
| App mark | above the card, `gap-6`, `text-sm --color-text` — **not** muted, which fails AA on the page background (A-4) |
| Field height | `40px` (`h-10`) |
| Input | `--color-surface` fill, `1px --color-border-control`, `rounded-md` (6px), `px-3`, `text-base` |
| Invalid input | border swaps to `--color-danger`; the message renders below in `text-xs --color-danger` |
| Button | `44px` (`h-11`), full width, `--color-accent` fill, `#ffffff` label, `rounded-md`, `text-base font-medium` |

**Rationale.** 400px holds a 16px input value and a label comfortably at the reading measure a
two-field form wants, and leaves the change-password screen's two fields plus a per-field policy
message unclipped. No shadow: §4's tone is "one quiet line per surface", and a border already
separates a white card from a `#eef0f2` page. The submit control is taller than a field because it
is the only primary action on the surface, not because size encodes state — `OT-UX-011` keeps it
enabled at all times.

**Invalid state is never colour alone.** `--color-danger` on the border is accompanied by the
message text and by React Aria's `aria-invalid` / `aria-describedby` wiring, per §7's frontend rules.

### A-8. Focus ring — one rule, driven by `data-focus-visible`

**Decision.** One declaration reused by every focusable element:
`outline: 2px solid var(--color-focus); outline-offset: 2px`, applied on `data-focus-visible` only,
never on `:focus`.

**Rationale.** `outline-offset` puts the ring outside the control with the card between them, so on
the accent-filled submit button the ring is measured against `--color-surface` (5.37:1) rather than
against the button's own accent fill, where it would be invisible. React Aria Components expose
`data-focus-visible` on every interactive primitive, so one Tailwind variant covers the product and
no component hand-rolls a focus style.

### A-9. The starter's font override is a bug and is deleted

**Decision.** Remove `body { font-family: Arial, Helvetica, sans-serif }` from `globals.css`, and
set the body font from the `--font-sans` token the root layout already wires to Geist.

**Rationale.** `src/app/layout.tsx` loads Geist Sans and Geist Mono through `next/font` and exposes
`--font-geist-sans`; `@theme inline` already maps `--font-sans` to it. The `body` rule then overrides
all of it with Arial, so the loaded fonts are downloaded and never used. This is starter residue on
the first surfaces the product renders.

### A-10. Copy the design brief lists as "still to be written"

**Decision.** Proposed wording, to be confirmed by the team. The three verbatim strings the
specification fixes are unchanged and are not repeated here.

| Surface | Text |
| --- | --- |
| Deactivated, contact configured | `This account is closed. Contact <SUPPORT_EMAIL>.` |
| Throttled | `Too many attempts. Try again in <n> minutes.` — `<n>` is the transport's `retryAfterSeconds` rounded **up** to whole minutes, so a live refusal never renders as zero (`FR-039`) |
| Expired token | `This link has expired. Reset links are good for one hour — request a new one.` |
| Used token | `This link has already been used. If you still need to change your password, request a new one.` |
| Unknown token | `This link isn't valid. Request a new one to change your password.` |
| `/signin` after a completed reset | `Your password has been changed. Sign in with it.` |
| Must-change-password banner | `You're still using the password this installation was set up with.` — and nothing more: R1 delivers no screen from which a signed-in user can change a password, so an instruction naming one would send the reader nowhere. R4's Profile adds the route, and amends this string when it does. |

**Rationale.** The three token states each name their own cause and each carry the same route
forward — back to `/reset` — which is what `OT-SEC-016` means by "distinguishable". The throttle
message states minutes rather than a live countdown: the value is computed server-side from
`auth_attempt` on each refused attempt, and a ticking client timer would be state the server does not
own. The deactivated message names the address and nothing else, so no `user` row is disclosed
(`OT-SEC-018`).

---

## B. Transport and runtime

### B-1. Sign-in posts from the client with `fetch`; the reset flows use Server Actions

**Decision.** The sign-in form is a Client Component that calls
`fetch('/api/auth/signin', { method: 'POST', … })` and renders the four states from the JSON reply,
then navigates to `/home` with `router.push` on success. `requestPasswordReset` and
`completePasswordReset` are Server Actions in a `"use server"` module, driven by `useActionState`.

**Rationale.** §6 pins sign-in to `POST /api/auth/signin` so the throttle and the origin check sit
in one place, and that is not the plan's to revisit. Given the route handler, the form needs a way to
render the rejected, deactivated and throttled states inline; `fetch` returns them as data.
A browser sends `Origin` on every `fetch` POST, so `FR-023`'s "a missing origin is a foreign one"
never misfires on our own form. The reset flows are ordinary mutations and take the Server Action
path AGENTS.md prescribes.

**Alternatives rejected.** *A native `<form action="/api/auth/signin" method="post">`.* The handler
could only answer with a redirect, so every state would have to travel in the query string —
`/signin?error=throttled&seconds=612` — which puts the message in history, in the referrer, and in
the server log, and gives §4's *Slow write* in-flight state nowhere to live.

### B-2. Actor resolution lives in a server-only module, not in a layout

**Decision.** `src/features/auth/server/actor.ts` exports `loadActor()` and `requireActor()`.
Every protected page, Server Action and route handler calls one of them. No layout performs an
authorization check.

**Rationale.** Next.js 16's own guidance is explicit that layouts do not re-render on client-side
navigation and do not control whether the rest of the route renders, so a check placed there is not
a check (`02-guides/authentication.md`, *Layouts and auth checks*). AGENTS.md says the same about
`proxy.ts`. Putting the check at the data boundary means `OT-SEC-008`'s "read `role` and
`deactivated_at` from Postgres on every request" is satisfied by construction, and R2 through R12
inherit one function rather than a convention.

**Caching.** `loadActor()` is wrapped in React's `cache()` so two callers in one render pass share
one query. That is per-request memoization inside a single render, not a cache of identity across
requests, so `OT-SEC-008` holds. This is recorded because the distinction is easy to get wrong.

### B-3. `proxy.ts` performs the unauthenticated redirect, and is not the authorization

**Decision.** `proxy.ts` matches everything except `/signin`, `/reset`, `/api/auth/signin`,
`/_next/*` and static assets, and redirects to `/signin` when the session cookie is absent.
It reads no database and makes no authorization decision; `requireActor()` repeats the check at the
server boundary and is what actually protects the route.

**Rationale.** `OT-SEC-015` wants an unauthenticated request to land on `/signin` rather than on
the Forbidden screen, and doing that at the edge avoids rendering a page to discard it. AGENTS.md
fixes the rule the other way round too: proxy is fast routing, never the authorization. A cookie
that names no session row still gets past proxy and is stopped by `requireActor()` — which is
exactly `FR-021`.

### B-4. First-run seeding and the interval timer run from `instrumentation.ts`

**Decision.** `src/instrumentation.ts` exports `register()`, guarded by
`process.env.NEXT_RUNTIME === 'nodejs'`, which dynamically imports one module that (1) validates the
environment, (2) seeds the first admin, and (3) starts the single `setInterval` sweep. A
module-level flag makes a second `register()` in one process a no-op. A failed validation — `APP_URL`
absent or unparseable, or `ADMIN_PASSWORD` outside the policy on an empty database — ends the process
with a non-zero exit status before any request is served (`FR-046`, `FR-058`).

**Rationale.** `register()` is the framework's own "run once when a server instance starts, before
it handles requests" hook (`03-api-reference/03-file-conventions/instrumentation.md`), which is what
§6's first-run bootstrap and `OT-OPS-003`'s single in-process timer both describe. It is a built-in,
so no scheduler dependency is proposed (IV). The runtime guard is required because `register()` runs
in every runtime and `@node-rs/argon2` and `postgres` are Node-only.

**Idempotence does not rest on the guard.** `FR-047` makes "any `user` row exists" the whole marker,
enforced inside the seeding transaction, so a second process, a restart or a dev-server reload
cannot mint a second admin whatever `register()` does.

**Timer lifetime.** The interval is `unref()`d so it never holds the process open, and is cleared on
`SIGTERM`. `FR-044` makes this the installation's only timer; R11 adds its mail retry to the same
callback rather than starting a second one.

### B-5. The origin check is one shared function used by every mutating entry point

**Decision.** `assertSameOrigin()` in `src/features/auth/server/origin.ts` compares the request's
`Origin` header against the origin `APP_URL` names. A missing or mismatched `Origin` is refused. The
sign-in route handler calls it; every Server Action calls it as its first statement.

**Rationale.** `OT-SEC-009` forbids a CSRF token and asks for `SameSite=Lax` plus an origin check on
**every** mutating request. Next.js applies its own origin check to Server Actions, but AGENTS.md
treats each Server Action as a public server entry point in its own right, and relying on a
framework internal to satisfy a stated requirement leaves nothing for a test to assert against.
One function, called explicitly, is both testable and Principle III.

**Deriving the expected origin from `x-forwarded-host` / `host` and `x-forwarded-proto` was rejected.**
Those headers travel with the request under test, so the check would compare a request against itself
and could never refuse anything — it would satisfy `FR-023`'s wording while enforcing nothing.
`APP_URL` is operator-supplied, is the same value the reset link is built from, and is validated at
startup (`FR-023`, `FR-033`, `FR-058`).

### B-6. `/` redirects to `/home`; the Next.js starter page is deleted

**Decision.** Replace `src/app/page.tsx`'s starter content with a redirect to `/home`.

**Rationale.** `FR-019` lands sign-in on `/home`, and `/` currently serves the create-next-app
placeholder — dead code under Principle VI on the same footing as the `setup_check` table `FR-008`
removes. Redirecting means an unauthenticated visitor to `/` is caught by proxy (B-3) and lands on
`/signin`, which is `SC-011` exercised end to end. Until R2 delivers `/home`, a signed-in visitor to
`/` gets a 404 there — visible, correct, and closed by the next slice.

### B-7. `Secure` on the session cookie, and local HTTP development

**Decision.** The cookie is always written with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure`
set from `process.env.NODE_ENV === 'production'`.

**Rationale.** `OT-SEC-007` fixes `Secure` for the deployed installation. A `Secure` cookie is
discarded by the browser over plain HTTP, so pinning it on unconditionally would make `npm run dev`
on `http://localhost` unable to sign in at all. The production value is the specified one; the
development exception is the narrowest thing that keeps the loop runnable, and it is tested.

### B-8. Per-field validation on blur, with the submit control always enabled

**Decision.** `<Form validationBehavior="aria">` from `react-aria-components/Form`, with each
`TextField` given a controlled `isInvalid` and a `<FieldError>`, set from an `onBlur` handler and
cleared on change. The submit `Button` never receives `isDisabled`.

**Rationale.** `OT-UX-011` requires per-field, on-blur validation, no wall of errors on submit, and a
control that stays enabled and reports what is missing inline. `validationBehavior` defaults to
`'native'` at the pinned 1.20.0 (verified in `dist/types/src/Form.d.ts`), which lets the browser
block submission and short-circuits that requirement; `'aria'` marks fields through ARIA and leaves
submission to us. `TextFieldProps` exposes a controlled `isInvalid`, so the blur-triggered state is
the component's own supported path rather than a workaround.

### B-9. The password blocklist is repository data, loaded once

**Decision.** A newline-delimited list of the ten thousand most common passwords at
`src/features/auth/server/common-passwords.txt`, read once at module load into a `Set<string>` and
compared case-insensitively against the trimmed candidate.

**Rationale.** `OT-SEC-004` names a blocklist and no dependency in AGENTS.md's approved table covers
one, so it is data rather than a package (IV). Ten thousand entries is roughly 80 KB and a `Set`
lookup is constant time; the file is server-only and never reaches the browser. The comparison folds
case because the policy is about the secret's guessability, not its typing.

### B-10. Argon2id parameters

**Decision.** `@node-rs/argon2` defaults for the algorithm, with explicit
`memoryCost: 19456` (19 MiB), `timeCost: 2`, `parallelism: 1` — the OWASP Password Storage
Cheat Sheet's first recommended Argon2id profile — recorded in one `hashPassword` / `verifyPassword`
module and nowhere else.

**Rationale.** The specification fixes Argon2id and says nothing about cost, and this is an
installation for a team under twenty people on a single box. The OWASP profile is the conservative
published default; keeping the parameters in one module means a later change is one edit and the
stored hash carries its own parameters, so existing credentials keep verifying.

---

## C. Persistence and concurrency

### C-1. `updated_at` exists on the tables that are edited, not on all five

**Decision.** `user` and `credential` carry `created_at` and `updated_at`, written through one
`touched()` helper. `session` carries `created_at`, `last_seen_at` and `expires_at`; `reset_token`
carries `created_at`, `expires_at` and `used_at`; `auth_attempt` carries `attempted_at` alone.

**Rationale.** §5 lists the fields of `session` and `auth_attempt` explicitly, and neither list
contains an `updated_at`. `FR-003` requires every mutator to write `updated_at` **through one shared
helper** rather than through a trigger; it is a rule about how the column is written, not a rule that
every table has one. Adding a redundant `updated_at` beside `last_seen_at` would give two columns one
meaning, which is the drift `OT-DATA-002` exists to prevent. Recorded here because the two readings
are both available from the text.

### C-2. Token digests are `text`, not `bytea`

**Decision.** `session.token_digest` and `reset_token.token_digest` are `text`, holding the
lowercase hex of a SHA-256 digest, `CHECK (char_length(…) = 64)`, `UNIQUE`.

**Rationale.** The lookup is an equality match on a unique index either way. Hex text keeps the value
readable in `db:studio` and in a migration without decoding, and keeps the Drizzle column type
ordinary. `OT-SEC-006`'s property — that nothing in the system compares two secrets — is a property
of hashing the presented token before the lookup, not of the storage type.

### C-3. `ip_address` and `user_agent` are bounded text, validated at the boundary

**Decision.** `session.ip_address` is `text NOT NULL CHECK (char_length(…) <= 45)`;
`session.user_agent` is `text CHECK (char_length(…) <= 1000)`. Both are normalized and truncated by
the sign-in handler before insert.

**Rationale.** 45 characters is the longest possible IPv6 textual form. A `inet` column would be
stricter but would fail the insert — and so fail the sign-in — whenever a proxy supplies an
`X-Forwarded-For` the parser rejects, turning a header problem into an outage. Bounding and
validating at the entry point is `Principle II` applied where the untrusted value arrives.
`user_agent` is not one of §5's named buckets, so 1000 is chosen: long enough for real strings,
short enough to bound the row. **Assumption, flagged for `/speckit-clarify`.**

**Which address is recorded.** The connection's own peer address, unless the operator has set
`TRUST_PROXY`, in which case the last hop of `X-Forwarded-For` is used instead — settled by
`/speckit-clarify` on 2026-08-30 and fixed by `FR-016`. The header is attacker-controlled on a
direct connection, so reading it unconditionally would let a caller present a fresh address on every
attempt and the twenty-per-IP limit would refuse nothing. Defaulting the other way costs an
installation actually behind a proxy nothing worse than every caller sharing one counter, which is
visible rather than silent. **Verify before implementing** that Next.js 16 exposes the peer address
to a Route Handler; `NextRequest.ip` existed in earlier versions and was removed, and this worktree
has no `node_modules` to check against. If it does not, the value has to come from the runtime
adapter, and that is a `/speckit-tasks` concern rather than a change to the rule.

### C-4. `user.avatar_url` is bounded at 2000

**Decision.** `text CHECK (char_length(avatar_url) <= 2000)`.

**Rationale.** `FR-002` and §5 bound names and handles at 200 and long free text at 10 000; a URL is
neither, and 200 is short enough that ordinary avatar URLs would be refused. 2000 is the
conventional practical URL bound. **Assumption, flagged for `/speckit-clarify`.**

### C-5. The throttle gate takes a transaction-scoped advisory lock per subject

**Decision.** The count-and-decide for one `(flow, kind, subject)` runs inside a transaction that
first takes `pg_advisory_xact_lock(hashtext(flow || ':' || kind || ':' || subject))`. Counting,
the refusal decision, and the failure row's insert all happen under that lock.

**Rationale.** The spec's edge case is explicit that two sign-ins racing the fifth failure must not
both slip through. Counting and then inserting is a read-then-write, which AGENTS.md says is not
protection. An advisory lock keyed on the subject serializes only the attempts that contend — two
different addresses never block each other — costs no table, and is a PostgreSQL built-in (IV).

**Alternatives rejected.** *`SERIALIZABLE` isolation.* Correct, but it turns a contended login into a
serialization failure the caller must retry, and the retry loop is more machinery than the lock.
*A unique counter row with `ON CONFLICT`.* Would need its own table and its own window arithmetic,
and `auth_attempt` is already the specified counter.

### C-6. The sweep is safe by predicate and needs no lock

**Decision.** Three deletes, run from the B-4 timer:

```sql
DELETE FROM auth_attempt WHERE attempted_at < now() - interval '15 minutes';
DELETE FROM session      WHERE expires_at  < now();
DELETE FROM reset_token  WHERE used_at IS NOT NULL OR expires_at < now();
```

**Rationale.** Each predicate can only match rows that are already dead — attempts outside every live
window, sessions that `FR-021` already resolves to no actor, and tokens that already render as used
or expired. So the spec's "the sweep must not remove a row inside the live window" holds without
coordinating with C-5's lock, and no caller can observe the difference between a swept row and an
unswept one. `FR-043`'s durability is a property of the rows, not of the sweep. `FR-044` requires the
session and token deletes to share this callback rather than start a second timer.

### C-7. The last-active-admin guard locks the admin row set

**Decision.** Inside one transaction:
`SELECT id FROM "user" WHERE role = 'admin' AND deactivated_at IS NULL FOR UPDATE`, then refuse if
the change would empty that set, then apply the change.

**Rationale.** `FR-056` and `OT-INV-013` require the count to be taken under a row lock in the same
transaction as the change. Two concurrent deactivations both lock the same set, so the second blocks,
re-reads after the first commits, and sees one admin left. This is the lock R3's `deactivateUser`
inherits, so it is written once here as a shared server function.

### C-8. A token that is both used and expired reports **used**

**Decision.** Check `used_at IS NOT NULL` before `expires_at < now()`.

**Rationale.** `OT-SEC-016` requires three distinguishable states and does not order them. "Used" is
the stronger fact — it says the grant was spent, and that a fresh link is needed for a different
reason than time passing. Recorded so the two screens cannot disagree.

### C-9. Indexes are added for the query patterns this feature actually runs

**Decision.**

| Index | Serves |
| --- | --- |
| `UNIQUE (lower(email))` on `user` | `FR-006`, sign-in and reset lookup |
| `UNIQUE (token_digest)` on `session` | actor resolution on every request |
| `(user_id)` on `session` | deleting every session for a user — reset, deactivation |
| `UNIQUE (token_digest)` on `reset_token` | opening a reset link |
| `(user_id)` on `reset_token` | cascade on deactivation |
| `(flow, kind, subject, attempted_at)` on `auth_attempt` | the windowed count |
| `(attempted_at)` on `auth_attempt` | the sweep |
| `(expires_at)` on `session` | the sweep |

**Rationale.** AGENTS.md: add indexes for known query patterns only, and PostgreSQL does not index
the referencing side of a foreign key. Each row above names the query it exists for; none is
speculative. `reset_token` gets no sweep index: its predicate is a disjunction that an index serves
poorly, and the table holds one short-lived row per reset request for a team under twenty people.

### C-11. `credential.password_hash` is bounded at 255

**Decision.** `text CHECK (char_length(password_hash) <= 255)`.

**Rationale.** `FR-002` leaves no free-text column unbounded, and a stored hash is neither a name nor
long free text. `@node-rs/argon2` writes the PHC string
`$argon2id$v=19$m=19456,t=2,p=1$<22-char salt>$<43-char hash>` — 96 characters at the B-10
parameters. 255 leaves room for a later parameter change without a migration while still bounding
the row. The column was unbounded until the requirements review found it; it is the fourth column
outside §5's two buckets, alongside C-2, C-3 and C-4.

---

### C-10. `setup_check` is dropped in the same migration that creates the five tables

**Decision.** One generated migration removes `setup_check` and creates `user`, `credential`,
`session`, `reset_token` and `auth_attempt`. The `drizzle/` output and its metadata are committed.

**Rationale.** `FR-008`. There is no shared environment yet, so no prior migration is being edited —
the constraint AGENTS.md places on migrations is about rerunning history, and this is the first real
one.

---

## D. Testing

### D-1. Vitest runs two projects: `node` for server code, `jsdom` for components

**Decision.** Replace the single `environment: 'jsdom'` in `vitest.config.ts` with
`test.projects`: a **server** project (`environment: 'node'`, matching `src/**/server/**/*.test.ts`,
`src/db/**`, `src/instrumentation*`) and a **ui** project (`environment: 'jsdom'`, matching
`**/*.test.tsx`).

**Rationale.** Database, hashing and timer code cannot run under jsdom, and component tests need it.
Vitest 4.1.11 ships `projects` (verified in the installed type definitions) and has dropped
`environmentMatchGlobs`. The alternative — a `@vitest-environment` docblock per file — is a
per-file annotation where a single config entry does the job, and reads as a comment under
Principle V even though the toolchain exception would cover it.

### D-2. Persistence tests run against a real PostgreSQL on a separate database

**Decision.** `TEST_DATABASE_URL` names a database used by the server project only. A setup file
runs the committed migrations against it once, and each test truncates the five tables it touches.
No mock stands in for the database in any test that asserts a constraint, a lock or a cascade.

**Rationale.** AGENTS.md is explicit, and half of this feature's guarantees — `FR-006`'s folded
uniqueness, `FR-056`'s lock, `FR-043`'s durability, the `CHECK` bounds — are enforced by PostgreSQL
and are invisible to a mock. Truncation rather than a transaction-per-test is required because C-5
and C-7 assert on **concurrent** transactions, which a wrapping transaction would serialize away.

### D-3. Time is injected, not mocked globally

**Decision.** The sliding expiry, the fifteen-minute window and the one-hour token lifetime read
`now` from an argument defaulted at the call site, so a test passes an instant instead of moving the
system clock.

**Rationale.** `SC-004`, `SC-005` and `FR-036` all need a test to sit at a specific instant, and the
throttle window is enforced in SQL with `now()` — faking the process clock would not move
PostgreSQL's. Passing the instant keeps the two in agreement and keeps the tests parallel-safe.

### D-4. The must-change-password banner is tested but has no production caller in R1

**Decision.** Ship `MustChangePasswordBanner` with a component test asserting its content and that it
renders no dismiss control. Render it from no page in this slice.

**Rationale.** `FR-049` requires this feature to deliver the banner and R2 to deliver the slot that
hosts it. This is carried into the plan's Complexity Tracking as the one Principle VI tension in the
feature rather than being resolved silently.

---

## Assumptions carried forward for `/speckit-clarify`

The specification's own silences, already recorded in [`spec.md`](./spec.md)'s Assumptions section,
stand unchanged, less the **one-hour reset-token lifetime**, which `/speckit-clarify` settled on
2026-08-30 and `FR-033` now fixes. This document adds three of its own:

1. **The seven strings in A-10**, which the design brief lists as unwritten and which this document
   proposes rather than discovers.

The bounds this document introduced — `user_agent` at 1000 (C-3), `avatar_url` at 2000 (C-4) and
`password_hash` at 255 (C-11) — are no longer carried here alone. `FR-002` now requires a column
outside §5's two buckets to state its own bound and its reason, and `spec.md`'s Assumptions record
all three values, so they are decisions rather than research residue.

The copy does not block implementation; it is text that can change without changing a structure.
