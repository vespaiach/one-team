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

### A-4. The neutral scale — eleven steps, warm, beside §7's grey rather than on it

**Decision.** An eleven-step warm neutral ramp. §7's `grey #8b909a` is **not** folded into it and stays
a content colour:

| Token | Value | | Token | Value | | Token | Value |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--color-neutral-50` | `#fbfaf9` | | `--color-neutral-400` | `#b3aeaa` | | `--color-neutral-800` | `#3a3735` |
| `--color-neutral-100` | `#f4f2f0` | | `--color-neutral-500` | `#8f8a86` | | `--color-neutral-900` | `#24211f` |
| `--color-neutral-200` | `#e8e5e2` | | `--color-neutral-600` | `#6e6a66` | | `--color-neutral-950` | `#151312` |
| `--color-neutral-300` | `#d7d3cf` | | `--color-neutral-700` | `#55514e` | | | |

Components never name a ramp step. They name a semantic token, and every semantic token points at a
ramp step rather than a hex — which is what keeps A-3 cheap to reverse:

| Token | Points at | Role |
| --- | --- | --- |
| `--color-page` | neutral-100 | the page behind the card |
| `--color-surface` | `#ffffff` | the card, and the inside of every field |
| `--color-surface-sunken` | neutral-50 | neutral message blocks — the token states |
| `--color-border` | neutral-300 | **decorative only** — card edge and dividers |
| `--color-border-control` | neutral-500 | **every field border, from rest** — anything a user aims at |
| `--color-border-strong` | neutral-900 | the 2px rule opening a section or a message block |
| `--color-text` | neutral-900 | headings, labels, field values |
| `--color-text-muted` | neutral-600 | the one quiet line per surface, helper text |
| `--color-text-placeholder` | neutral-600 | placeholders only |
| `--color-text-disabled` | neutral-400 | rare here — the submit never goes dead (`OT-UX-011`) |
| `--color-accent` / `-hover` / `-pressed` / `-text` | accent-500 / 600 / 700 / 700 | primary fill, hover, pressed, links, and the focus ring (A-8) |
| `--color-danger` / `-fill` / `-text` | red-500 / 100 / 700 | errored border, error ground, error ink |
| `--color-success` / `-fill` / `-text` | green-500 / 100 / 700 | the post-reset banner on `/signin` |
| `--color-advisory` / `-fill` / `-text` | amber-500 / 100 / 700 | the must-change-password banner |

**Contrast is asserted, not recorded.** `src/app/globals.test.ts` computes every pair below from
`globals.css` and fails the build gate if one drops under its threshold, so this table cannot drift
from the tokens:

| Pair | Ratio | Requirement |
| --- | --- | --- |
| `--color-text` on page / on surface | 14.33:1 / 16.00:1 | 4.5:1 |
| `--color-text-muted` on page / on surface | 4.80:1 / 5.36:1 | 4.5:1 |
| `--color-text-placeholder` on surface | 5.36:1 | 4.5:1 |
| `--color-accent-text` on surface | 9.06:1 | 4.5:1 |
| `--color-surface` on `--color-accent` | 5.37:1 | 4.5:1 |
| `--color-danger-text` on `--color-danger-fill` | 6.95:1 | 4.5:1 |
| `--color-success-text` on `--color-success-fill` | 5.27:1 | 4.5:1 |
| `--color-advisory-text` on `--color-advisory-fill` | 4.68:1 | 4.5:1 |
| `--color-border-control` on surface | 3.42:1 | 3:1 (1.4.11) |
| `--color-danger` on surface | 4.80:1 | 3:1 (1.4.11) |
| `--color-accent` on surface / on page | 5.37:1 / 4.81:1 | 3:1 (1.4.11) |

`--color-border` is absent from that list deliberately: at 1.49:1 on the card it is a rule, never a
boundary a user has to find. **The distinction lives in the two token names**, because that is the
only place it survives eleven later slices.

**Rationale.** The warm ramp clears 4.5:1 for muted text on the page background as well as on the
card, which the earlier cool ramp did not — its `#6b7079` reached only 4.36:1 there and forced a
written-down "surface-only" caveat that no token name carried. Keeping §7's grey out of the ramp is
the second half of the same idea: content grey is cool because someone *chose* it for a project or a
label, and a value someone chose must not read as chrome.

**Alternatives rejected.** *Folding §7's grey in as neutral-500.* It makes one system out of two at
the cost of every neutral surface inheriting a colour that means "a user picked this". *A single
`--color-border`.* One token has to serve both the decorative and the control case; the value that
passes 3:1 is heavier than a card edge wants, and the value that looks right fails — which is
exactly the failure the returned design shipped and `globals.test.ts` now catches.

**Supersedes** the ten-step cool ramp anchored on `#8b909a` with `--color-border-control` and
`--color-focus`, recorded here before the design returned.

### A-5. Type scale — six named steps in Archivo

**Decision.** Six tokens, one family, absolute line heights so every step lands on the 4px unit:

| Token | Size / line-height / weight | Used for |
| --- | --- | --- |
| `--text-micro` | 11 / 16 / 600 / +0.08em / caps | field labels |
| `--text-small` | 13 / 20 / 400 | inline field errors, helper text |
| `--text-body` | 15 / 24 / 400 | message blocks, the quiet line, links |
| `--text-control` | 16 / 24 / 500 | field values, button labels |
| `--text-title` | 22 / 28 / 600 / −0.01em | reserved — no R1 surface uses it |
| `--text-display` | 32 / 36 / 700 / −0.02em | the card heading |

**Rationale.** Principle IV prefers a built-in **where the built-in covers the need**. Tailwind v4's
default scale does not contain these values — not 11, 13, 15 or 22, and none of the absolute line
heights — so using it would mean either redrawing the type or writing arbitrary values at every call
site. Six tokens state the scale once.

**Consequence worth knowing.** Type and spacing are both absolute, so the surfaces respond to browser
zoom but not to a raised default font size. That follows from the design's own "line heights are
absolute so every step lands on the 4px unit", and it is a deliberate trade, not an oversight. WCAG
1.4.4 is met through zoom.

**Supersedes** the earlier decision to add no type tokens and use five steps of Tailwind's default.

### A-6. Spacing — the 4px unit, declared

**Decision.** `--spacing: 4px`. Everything structural lands on 8; 4 exists only for the gap between
a control and the text annotating it. The card's rhythm: 32 padding, 24 last field → submit and
message block → form, 20 between field groups, 8 label → field, 4 control → its inline error. 48 and
64 are reserved for R2's shell gutters and page sections.

**Rationale.** The value matches Tailwind v4's default 0.25rem at a default root size, so the
declaration buys no new capability — it fixes the unit as absolute, consistent with A-5's absolute
type, and puts it where the rest of the system is read from.

**Supersedes** the earlier decision to declare no spacing token.

### A-7. Card geometry and field treatment

**Decision.**

| | |
| --- | --- |
| Card max-width | `440px` (`--size-card`), form column 376px |
| Card | `--color-surface` fill, `1px --color-border`, **radius 0**, 32px padding, no shadow |
| Placement | horizontally centred; top edge at **12vh with a 96px floor**, **never vertically centred** |
| App mark | above the card, left-aligned to its edge — the two-tone `One`/`Team` lockup |
| Field | `44px` (`--size-field`), no fill of its own, `1px --color-border-control` **from rest**, radius 0, 16px inline padding, `--text-control` |
| Invalid field | border swaps to `--color-danger`; the message renders below in `--text-small --color-danger-text` |
| Button | `44px`, full card width, `--color-accent` fill, `--color-surface` label, radius 0, `--text-control` at 600, label flush left |

**Rationale.** Never vertically centring is the load-bearing half: these screens add and remove
message blocks between states, and a vertically centred card slides under the reader while they are
reading the error that just appeared. A 96px floor means a short window rises rather than clipping.
Radius 0 throughout is one fewer value to carry into eleven slices. The submit is the same height as
a field because size does not encode state here — `OT-UX-011` keeps it enabled at all times.

**The field border starts at `--color-border-control`.** The field carries no fill, so its border is
the only thing separating white from white, and WCAG 1.4.11 applies to it at 3:1. This costs the
returned design one affordance — the border can no longer darken to mark a field holding a value,
because it starts there — and rest, focus and invalid remain distinct without it.

**Invalid state is never colour alone.** `--color-danger` on the border is accompanied by the message
text and by React Aria's `aria-invalid` / `aria-describedby` wiring.

**Supersedes** the 400px card, `rounded-lg` / `rounded-md` radii, 40px field and vertical centring
recorded before the design returned.

### A-8. Focus ring — one rule, driven by `data-focus-visible`, drawn in the accent

**Decision.** One declaration reused by every focusable element:
`outline: 2px solid var(--color-accent); outline-offset: 2px`, applied on `data-focus-visible` only,
never on `:focus`. **There is no `--color-focus` token.**

**Rationale.** `outline-offset` puts the ring outside the control with the card between them, so on
the accent-filled submit the ring is measured against `--color-surface` (5.37:1) rather than against
the button's own fill; on the page it is 4.81:1. Both clear 3:1, and `globals.test.ts` asserts it.
A separate `--color-focus` would be a second semantic name that always resolves to `--color-accent`,
which is indirection with no requirement behind it today (Principle III); if the ring ever needs to
leave the accent, adding the token is one declaration.

**Supersedes** the `--color-focus` token named in earlier drafts of this document and of
`contracts/auth-layout.md`.

### A-9. Archivo replaces the starter's Geist, and its Arial override

**Decision.** Load **Archivo** through `next/font/google` into `--font-archivo`; `--font-sans` points
at it. `Geist`, `Geist_Mono` and the starter's `body { font-family: Arial… }` are all removed.

**Rationale.** The six steps in A-5 were drawn in Archivo, and its weights and tracking are what the
scale assumes. Geist was starter residue; `--font-geist-mono` was loaded on every request and
referenced by no token, which is dead code under Principle VI. `next/font/google` self-hosts the
files at build time, so there is no runtime request to Google, no layout shift, and no new dependency
under Principle IV.

### A-10. Copy the design brief listed as "still to be written"

**Decision.** The wording the design returned, with the throttle string corrected. The three verbatim
strings the specification fixes are unchanged and are not repeated here.

| Surface | Block | Text |
| --- | --- | --- |
| Deactivated, contact configured | Notice | `This account has been deactivated. Contact <SUPPORT_EMAIL>.` |
| Throttled | Error | `Too many attempts. Try again in <n> minutes.` — `<n>` is `retryAfterSeconds` rounded **up** to whole minutes, so a live refusal never renders as zero (`FR-039`) |
| Expired token | Notice | `This link has expired. Reset links last one hour.` |
| Used token | Notice | `This link has already been used. Your password was changed with it.` |
| Unknown token | Notice | `This link isn't one we recognise. Check the whole address came across from the email.` |
| `/signin` after a completed reset | Success | `Your password has been changed. Sign in with it now.` |
| Must-change-password banner | Advisory | `Your password is still the one set when this server was installed.` |

**Rationale.** Both deactivated variants open on the same sentence, so the two differ only in whether
an address follows and no `user` row is disclosed (`OT-SEC-018`). The three token states each name
their own cause and each carry the same route forward — a "Request a new link" control back to
`/reset` — which is what `OT-SEC-016` means by "distinguishable"; naming that route in the sentence
as well would say it twice.

**The throttle states minutes, not a countdown.** The design returned a ticking `mm:ss` timer. The
value is computed server-side from `auth_attempt` on each refused attempt, a client timer is state
the server does not own, and it reaches `00:00` while the refusal is still in force. `FR-039` is
explicit — "expressed to the caller as whole minutes rounded up" — and the specification wins.

**The banner carries no control.** The design returned a "Change it" link. R1 delivers no screen from
which a signed-in user can change a password, so the link resolves nowhere; R4's Profile adds the
route and amends this string when it does.

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
