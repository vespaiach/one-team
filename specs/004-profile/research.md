# Phase 0 — Outline & research

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Parent**: [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R4**

Twenty-eight decisions. Group **A** is the screen and the one read behind it. Group **B** is in-place
editing and the single write, which is where most of this entry's difficulty sits. Group **C** is
validation and what actually reaches a column. Group **D** is the four cross-cutting UX conventions
`FR-031`–`FR-034`, which this entry either authors for itself or stands up once for the whole
application. Group **E** is the change-password link and how change gate 1 is met.

Every framework claim below was checked against `node_modules/next/dist/docs/` for the pinned
`16.3.2`, or against the shipped source of the pinned dependency, as AGENTS.md requires. The file is
named at each claim.

**Precondition.** Entry R1 is implemented — `loadActor()`, `requireActor()`, `accountUser`,
`touched()`, `assertSameOrigin()`, the reset token, the mail and the throttle are all in the tree.
Entry R2 is specified and planned but **not** implemented: `src/app/(app)/` does not exist. Every
decision below that edits an R2 file is written against R2's plan and contracts, not against code.

---

## A. The screen and the one read

### A-1. This entry fills R2's guard-only `/profile` route rather than creating a route

**Decision.** `src/app/(app)/profile/page.tsx` already exists in R2's plan as `requireActor()`
followed by `notFound()` ([R2 `route-surface.md`](../002-app-shell-ux/contracts/route-surface.md),
row *Profile · `/profile` · signed in · `notFound()` · R4*). This entry replaces the `notFound()`
body with the screen. The route, the group, the shell and the guard are inherited, not authored.

**Rationale.** `FR-001` places the screen inside the persistent shell at `/profile`, and `OT-UX-001`
makes that structural through R2's `(app)` group. `FR-005`'s unauthenticated redirect is
`requireActor()`, which R1 already implements as a `redirect("/signin")` — so `OT-SEC-015` is
satisfied by the guard this entry keeps rather than by anything it writes.

**Alternatives rejected.** *Register the route here.* It is already registered; a second registration
is a conflict, not a feature. *Skip `requireActor()` and rely on `proxy.ts`.* AGENTS.md is explicit —
`proxy.ts` is not authorization — and `proxy.ts` only checks that a cookie is *present*, so a stale
or revoked cookie would reach the page. This is also what makes `FR-030`'s "returns to sign-in on its
next action" true: after a completed reset the session row is gone, the cookie survives, `proxy.ts`
lets the request through and `requireActor()` is what refuses it.

### A-2. The record is read through `accountUser`, keyed by the actor's id — not from the actor

**Decision.** One query in `src/features/profile/server/queries.ts`, selecting the `accountUser`
projection from `user` where `user.id` equals `requireActor().id`. The actor supplies the identity
and nothing else.

**Rationale.** `FR-003` requires this screen to read through `accountUser` and forbids selecting the
user table directly, and `OT-DATA-005` names Profile as one of that projection's two callers. R1's
`Actor` carries four fields — `id`, `role`, `firstName`, `lastName` — and the screen needs eleven.
The projection already exists in `src/features/auth/server/projections.ts` and already carries
exactly what this screen shows: the seven writable fields, plus email and role shown but not edited,
plus `id` and `deactivatedAt`.

**Alternatives rejected.** *Widen `Actor` to carry the contact fields.* R2 already widens it by two
fields for the chip, and widening it further would put `email`, `phone` and `bio` on every
authenticated request in the application for the sake of one screen. `Actor` is the answer to *who is
making this request*, not a record. *Read the row inside the page without a projection.* `FR-003`
forbids it in the spec's own words.

### A-3. The row is mapped to a DTO before it leaves the server

**Decision.** `queries.ts` returns a `ProfileRecord` — a plain object of strings and nulls — not the
projection's result row.

**Rationale.** AGENTS.md: "never expose database rows as public API or UI models — define an explicit
DTO at the boundary." The projection is a Drizzle select shape; a component taking it would couple
the screen to the column names. The DTO also drops `deactivatedAt`, which `accountUser` carries and
this screen has no use for — an actor exists only for an account that is not deactivated (R1,
`loadActor()`), so the field is always `null` here.

### A-4. The page is a thin async wrapper over a synchronous screen component

**Decision.** `page.tsx` is `async`: it guards, queries, composes the header and renders
`<ProfileScreen record={…} />`. `ProfileScreen` is synchronous and takes plain props.

**Rationale.** The framework's own testing guide states that Vitest does not support async Server
Components and recommends E2E tests for them
(`01-app/02-guides/testing/vitest.md`). This repository has no E2E runner and cannot add one without
an approved dependency (IV). So every assertion this entry makes about rendering has to land on a
synchronous component, and the component boundary follows that constraint rather than taste. R2
reached the same conclusion for the same reason and this entry inherits the shape.

**Alternatives rejected.** *Put the layout in `page.tsx`.* Then `FR-024`, `FR-031` and every US3
scenario are unreachable by any test this repository can run, and gate 1 cannot be met for them.

### A-5. The skeleton sits below the guard, inside the page, not in `loading.tsx`

**Decision.** `page.tsx` guards first, then renders `<Suspense fallback={<ProfileSkeleton />}>`
around the component that awaits the query.

**Rationale.** R2's contract fixes this and gives the reason: "`FR-032`'s skeleton goes **below** the
route's authorization guard. A `loading.tsx` above it turns a `403` or `404` into a streamed `200`"
([R2 `ux-conventions.md`](../002-app-shell-ux/contracts/ux-conventions.md)). `loading.tsx` wraps the
whole segment including the guard, so the guard's redirect would be streamed inside a `200` response
that had already begun.

### A-6. The header is composed by this page

**Decision.** `page.tsx` renders R2's `<ScreenHeader name="Profile" />` as its first child, with no
context line, no per-screen control and no New issue slot.

**Rationale.** R2 fixed that the header is composed by the page rather than the layout, because a
layout cannot receive a per-screen title ([R2 `plan.md`](../002-app-shell-ux/plan.md), A-2). §3.12
gives this screen no per-screen control, and `FR-008` renders New issue only on project-scoped
screens, which this is not. The three absent slots are R2's tested behaviour, not this entry's.

---

## B. In-place editing and the one write

### B-1. `useOptimistic` plus `useTransition` is the whole of `FR-014` and `FR-015`

**Decision.** Each field holds its own `useOptimistic(storedValue)` and runs `updateOwnProfile`
inside a `startTransition`. The optimistic value renders; the transition ends; the value the server
holds renders.

**Rationale.** The framework guide describes exactly this pairing and the property this entry needs:
"When the transition ends and fresh data arrives, the optimistic value reverts to the new
server-rendered prop" (`01-app/02-guides/interactive-apps.md`). Read against `FR-014` and `FR-015`,
that single sentence delivers both halves at once — a refused write returns without revalidating, so
the prop is unchanged and the optimistic value falls back to precisely "the value the server holds",
which is `FR-015`'s wording. There is no hand-written rollback path to get wrong, and no second copy
of the stored value to drift.

**Alternatives rejected.** *`useState` plus a manual revert in a `catch`.* It reimplements what the
hook does and introduces a second source of truth for every field. *`useActionState`.* It is built
for a form's pending-and-result cycle; this screen has no form and no submit (`FR-013`), and it does
not give an optimistic value to render meanwhile.

### B-2. The action returns a typed refusal; it never throws for an expected failure

**Decision.** `updateOwnProfile` returns a discriminated union — accepted, unchanged, or a named
refusal — and reserves `throw` for genuine faults.

**Rationale.** Two reasons that point the same way. AGENTS.md: "Model expected failures as typed
results or domain errors. Reserve thrown errors for exceptional failures." And the framework's
behaviour makes the alternative actively wrong: "If the Server Function inside `useTransition`
throws, the error is forwarded to the nearest error boundary without a manual `try`/`catch`"
(`01-app/02-guides/interactive-apps.md`). A rejected avatar scheme is an inline error on a field
(`FR-011`); routing it to an error boundary would replace the screen.

### B-3. Rollback is per field because optimistic state is per field

**Decision.** No shared optimistic state across the seven fields.

**Rationale.** `FR-015` requires a rollback to affect only the field that failed, and the spec's edge
cases require a refused write to leave a second field's in-progress edit alone. With one
`useOptimistic` per field that is structural rather than a rule to be honoured. It also satisfies the
edge case "two fields edited in quick succession produce two independent writes; neither carries the
other's value" — each call carries one field name and one value.

**Worth naming.** The framework notes that "the client currently dispatches and awaits them one at a
time" for Server Functions (`01-app/01-getting-started/07-mutating-data.md`). Two rapid edits are
therefore serialized on the wire. They remain two independent writes with independent outcomes, which
is what US1 scenario 5 asserts; the spec claims independence, not concurrency.

### B-4. Success revalidates the path; refusal does not

**Decision.** On an accepted write, `updateOwnProfile` calls `revalidatePath("/profile")` before
returning. On a refusal it returns without revalidating.

**Rationale.** This is what makes B-1 work in both directions. Revalidating replaces the prop with
the newly stored value, so the optimistic value lands on an equal value and nothing flickers
(`01-app/01-getting-started/09-revalidating.md` — the documented shape is a Server Function calling
`revalidatePath('/profile')` after a mutation). Not revalidating on refusal leaves the prop at the
stored value, which is the rollback `FR-015` asks for. `SC-002` — the edit is present in a different
browser — is a property of the write, not of the cache, and holds either way.

### B-5. The unchanged-value check is part of the write statement, not a read before it

**Decision.** One `UPDATE`, whose `WHERE` pins the caller's own id **and** requires the target column
to be distinct from the incoming value, with `RETURNING` telling the action whether a row moved. Zero
rows returned means the value was already stored.

**Rationale.** `FR-016` requires a save of an identical value to write nothing, and `FR-022` requires
`updated_at` to move through `touched()` on every write — so a redundant write is not harmless, it is
a change with no cause. AGENTS.md's concurrency rule is the reason this is one statement and not two:
"A read followed by a write is not protection." `IS DISTINCT FROM` rather than `<>` because five of
the seven columns are nullable and `<>` is unknown against `NULL`, which would silently skip every
clear and every first set. The comparison is written as a parameterized `sql` fragment — localized,
typed and tested, as AGENTS.md requires of any raw SQL.

**Alternatives rejected.** *Select the row, compare in TypeScript, then update.* Two round trips, and
the compare-then-write window is exactly the shape the concurrency rule names. *Compare on the
client and skip the call.* The client's copy can be stale, and `FR-020` requires the server to
validate whatever the browser also checked.

### B-6. One mutator taking one field name and one value

**Decision.** `updateOwnProfile(field, value)`, where `field` is a string-literal union of the seven
writable names. Not seven actions, and not a partial-object patch.

**Rationale.** `FR-013` fixes "one mutator call per field" and `OT-UX-009` makes that the app-wide
convention; §3.12 names the single mutator by name. A patch object would let one call carry two
fields, which US1 scenario 5 asserts never happens, and it would make `FR-021`'s "writes only these
seven" a runtime check over an open shape instead of a closed type. Seven actions would put the
authorization, the origin check and the `updated_at` rule in seven places.

**Where the seven names live.** `src/features/profile/fields.ts` — the union, the label and the
length bound for each, as plain data with no server import, so the client and the server read the
same list. `FR-006`'s "exactly seven" is then one file to check.

### B-7. The value that is clicked is a React Aria `Button`, not a `div` with handlers

**Decision.** A shown field renders as a `Button` styled as text; pressing it swaps in a `TextField`.

**Rationale.** `OT-UX-018` and AGENTS.md both require interaction behaviour, focus management,
keyboard support and ARIA semantics to come from React Aria, with a hand-built component only where
React Aria ships no equivalent. There is no React Aria "editable text" component, but the two halves
of one are both present: `Button` for the affordance and `TextField` for the edit. AGENTS.md is
explicit that the remedy for a missing composite is not a `div` with a click handler and a
`role` — "Do not add roles or keyboard handlers to patch around an incorrectly composed component."
`Button` also brings `onPress`, the pressed and focus-visible data attributes the token set already
styles, and Enter/Space activation for free, which is half of `SC-012`.

### B-8. Escape, blur and ⌘-enter are three explicit behaviours on the field

**Decision.** `onKeyDown` distinguishes `Escape` (restore and leave, writing nothing) from
`Meta`/`Ctrl` + `Enter` (save and leave); `onBlur` saves. All three return the control to its shown
state.

**Rationale.** `FR-013` and `OT-UX-009` list exactly these three. React Aria's `TextField` does not
assign meaning to Escape or to ⌘-enter, so they are the application's to bind; `@react-aria/test-utils`
is not installed and adding it needs approval (IV), so the tests fire explicit keyboard events, which
AGENTS.md already prescribes.

**One ordering trap, recorded so it is not discovered in review.** Saving on blur and returning to a
shown state on Escape can race: Escape restores the value, and the blur that follows must not then
save the restored value as an edit. The Escape path clears the pending value before it releases
focus, so the blur handler finds nothing changed and `FR-016` makes it a no-op even if it fires.

---

## C. Validation, the avatar, and what reaches a column

### C-1. One parser module, mirroring R1's

**Decision.** `src/features/profile/server/input.ts`, shaped like R1's
`src/features/auth/server/input.ts`: small pure functions that take `unknown` and return a value or a
named refusal.

**Rationale.** `FR-020` and Principle II require the server to validate presence, the trim, the
length bound and the avatar's scheme whatever the browser checked, and to reject rather than coerce
or truncate. R1 already established the idiom in this repository, and following it keeps the two
readable side by side (III). The module is `server-only`; the *bounds* it enforces live in
`fields.ts` so the client can render the same limit without importing it.

### C-2. The avatar's scheme is checked with the `URL` parser, not a regular expression

**Decision.** `URL.canParse(value)` decides well-formedness, then `new URL(value).protocol` is
compared against exactly `http:` and `https:`.

**The comparison is case-insensitive without a second rule.** `URL` normalizes a scheme to lower
case as it parses, so `HTTPS://example.com` yields the protocol `https:` and is accepted. `FR-011`
states the property; the parser is what makes it true, and no `toLowerCase()` of our own is needed
in front of it.

**Rationale.** `FR-011` requires a well-formed absolute link and an allowlist of two schemes, and
Principle IV requires a built-in where one exists — `URL` is the Web platform's own parser and is
what "well-formed absolute link" means. `URL.canParse` is available on Node 20, which is what the
`Dockerfile` and `.github/workflows/ci.yml` both pin; `URL.parse`, which would return `null` instead
of needing a second parse, landed in Node 22.1 and is therefore not available here. Checking
`protocol` against a two-item allowlist rather than rejecting known-dangerous schemes is `FR-011`'s
explicit instruction, and it is what makes `javascript:` and `data:` refusals fall out rather than
being enumerated.

**Alternatives rejected.** *A regular expression.* It would be a second, worse URL parser, and every
scheme it failed to anticipate would be an allowed one. *`try { new URL(v) } catch`.* It works, but
exception-as-control-flow for an expected input failure is the shape B-2 rejects everywhere else in
this entry. *Fetching the link to confirm it is an image.* `FR-011` forbids it in one sentence, and
the spec's edge cases say a link that stops resolving keeps its stored value.

### C-3. Empty after trimming means `NULL`, and the scheme check does not run on it

**Decision.** Trim first. For the five optional fields, an empty result becomes `null`. The avatar's
scheme check runs only on a non-empty trimmed value.

**Rationale.** `FR-012` orders trimming before every rule, and `FR-012a` fixes both halves of this:
one representation of "unset", and an avatar that can be cleared once set. The ordering matters and
is easy to get backwards — running `FR-011` before the empty check would make the avatar the one
field on the screen that cannot be emptied, which is the contradiction the clarification session
caught. The five columns are already nullable in `src/db/schema.ts`, so `NULL` needs no migration
and matches every row this screen has never touched.

### C-4. The length bounds are stated in the parser as well as in the database

**Decision.** `fields.ts` carries 2000 for the avatar, 200 for first name, last name, job title,
Slack handle and phone, and 10000 for the bio — the same numbers `src/db/schema.ts` enforces as
`CHECK` constraints. The parser counts those numbers in **code points**, `[...value].length`, not in
UTF-16 code units.

**Rationale.** This is a deliberate duplication, and the two copies do different jobs. The `CHECK` is
the invariant: it holds against any writer, including a future one. The parser is the boundary
(Principle II): it produces the inline error `FR-017` requires on the field the user is editing,
instead of a constraint violation surfacing as a generic failure. Removing either one loses something
— without the `CHECK` the bound is only as good as the code path, and without the parser a
201-character job title is a 500.

**Two copies of a number are only as good as their unit.** PostgreSQL's `char_length` counts
characters, and JavaScript's `String.prototype.length` counts UTF-16 code units — the two disagree on
every character outside the Basic Multilingual Plane, an emoji among them. Counting `.length` would
let the parser accept a bio of 10000 code units that the `CHECK` then rejects as more than 10000
characters, which is exactly the constraint violation surfacing as a generic failure that this
duplication exists to prevent. `[...value].length` iterates code points and matches the column.
`FR-020` now fixes the unit so the two copies cannot drift apart on it. `FR-014`'s edge case names the behaviour directly: a value at
exactly its bound saves, one character beyond it is refused by the server whatever the browser
allowed.

### C-5. The browser checks nothing the server does not check again

**Decision.** The field may carry `maxLength` and mark the two names required for the immediate
affordance; the server re-derives every one of those answers.

**Rationale.** Principle II: "Client-side validation is a UX affordance, trivially bypassed, and
never a security control." `SC-010` states the property the tests must prove — a value carrying any
other scheme is refused before storage "whether it arrives from the screen or directly" — so the
avatar test calls the action directly, not through the component.

---

## D. The four cross-cutting conventions

The spec settled that these are not one kind of thing (`FR-031`–`FR-034`, and the *Reconciliations*
section). Two are per-screen work this entry authors for itself. Two are single app-wide instances
that live in R2's shell and that `docs/ROADMAP.md` assigns to **entry R3**, which holds their first
caller; this entry is their second caller, consumes both and builds neither. D-1, D-2 and D-5 are
therefore this entry's own decisions; D-3 and D-4 record the shape of what it calls into.

### D-1. The skeleton is written here, for this layout, and is not shared

**Decision.** `ProfileSkeleton` renders the same block structure `ProfileScreen` renders — the same
number of rows, at the same heights — and lives beside it.

**Rationale.** `FR-031` and `OT-UX-005` require a skeleton that matches the layout it replaces and
forbid layout shift when data lands. A skeleton that matched two different layouts would match
neither, so there is nothing here to inherit from R3 and nothing to extract for R5 (I). Holding the
two components in one directory is what makes "data landing must not shift the layout" reviewable:
the divergence is visible in one diff.

### D-2. Re-query on revisit is the framework's default, and this entry changes no cache setting

**Decision.** Nothing is configured. `FR-032` is met by the client cache's `dynamic` stale time,
which defaults to `0`.

**Rationale.** `01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md` gives the default
as "0 seconds (not cached)" for dynamic segments, and records that it changed from 30s in v15.0.0.
This page is dynamic — it reads `cookies()` through `loadActor()` — so its page segment is refetched
on every client navigation to it. R2's research reached the same reading and this entry adds no
setting either way.

**Carried forward as an assumption, not a silence.** The same file states that the setting "doesn't
change back/forward caching behavior to prevent layout shift and to prevent losing the browser scroll
position". A browser Back to `/profile` can therefore restore a remembered tree. This entry does not
fight that: the only writer of this record is this screen, so a restored tree can only be stale
against the same user's own edit in another tab, and `SC-002` — the edit is present when the user
next opens the screen — is about the stored row, which is unaffected. Recorded so a reviewer meets
it here.

### D-3. The message host is React Aria's Toast, built by entry R3 and consumed here

**Decision.** The host is `src/features/shell/components/message-host.tsx`, rendering
`UNSTABLE_ToastRegion` from `react-aria-components/Toast` and fed by one module-level
`UNSTABLE_ToastQueue` in `src/features/shell/messages.ts`, mounted once in R2's `(app)/layout.tsx`.
**Entry R3 builds and mounts it**, holding the first caller by `docs/ROADMAP.md`'s own attribution.
This entry is its second caller and raises a message by calling `messages.add(…)`. What follows is
recorded because R4 depends on the shape, not because R4 chooses it.

**Rationale.** AGENTS.md permits a hand-built component "only where React Aria ships no equivalent".
It ships one: the installed `react-aria-components@1.20.0` exports `UNSTABLE_Toast`,
`UNSTABLE_ToastList`, `UNSTABLE_ToastRegion`, `UNSTABLE_ToastContent` and `UNSTABLE_ToastQueue`
(`dist/types/exports/Toast.d.ts`). The queue carries the `timeout` that `FR-033`'s auto-dismiss
needs and the region carries the landmark and live-region semantics that a hand-built stack would
have to reproduce exactly and would get subtly wrong. A module-level queue is the library's own
pattern and means the raiser imports a value rather than reaching through a React context that the
shell would have to provide and every test would have to wrap.

**The cost, recorded.** These are `UNSTABLE_`-prefixed exports of an approved dependency, and
`package.json` carries `react-aria-components` as `^1.20.0`. The lockfile pins `1.20.0` exactly and
`npm ci` is what CI runs, so the exports cannot move without a deliberate `npm update`. This is an
adoption of an unstable API, not an unapproved dependency: gate 4 is untouched, and no version range
is edited by this entry — nor by this entry at all, since the adoption belongs to R3 and its
Complexity Tracking. Recorded here so a reader of this plan knows what `messages.add(…)` resolves to.

**Alternatives rejected.** *Hand-build the host.* It is what AGENTS.md permits only in the absence of
an equivalent, and the equivalent exists; reproducing its focus behaviour and its live-region
announcements is the work this rule exists to avoid. *Wait for a stable Toast.* Nothing in the
roadmap waits on it, and `FR-033` is required now.

### D-4. The connection banner is `navigator.onLine` and two window events

**Decision.** `src/features/shell/components/connection-banner.tsx` reads `navigator.onLine` and
subscribes to the `online` and `offline` events. It renders into R2's banner region, above the
content, so it stacks with the must-change-password banner rather than replacing it. Like the message
host, **entry R3 builds and mounts it**, once, in `(app)/layout.tsx`. This entry renders beneath it
and stands up none of it; only the refusal of D-5 is R4's own.

**Rationale.** `FR-034` requires one banner for the whole application. The Web platform answers this
directly, so Principle IV settles it without a library. Placing it in the same banner region is what
keeps `OT-UX-001`'s frame intact when both banners are showing — the must-change-password banner is
R1's component and R2's slot, and neither is modified.

### D-5. An offline write is refused before it is dispatched, and nothing is queued

**Decision.** A save attempted while offline returns the refusal "Changes need a connection" without
calling the action, and the field rolls back exactly as any other refusal does.

**Rationale.** `FR-034` requires the refusal wording and forbids queueing. Deciding it before the
dispatch rather than after a network error is what makes "nothing is queued" true by construction —
there is no in-flight request to retry and no pending state to hold. The rollback path is B-1's, so
offline is not a second failure mode with its own code.

---

## E. Change password, and meeting gate 1

### E-1. A second reset action, deriving the address from the session

**Decision.** `requestOwnPasswordReset()` is added to `src/features/auth/actions.ts` — the module
that already owns `requestPasswordReset` and `completePasswordReset`. It asserts the origin, resolves
the actor, reads that user's own email by id, runs the same `reset`-flow throttle, issues a token
through `issueResetToken` and mails it through `sendPasswordResetMail`.

**Rationale.** `FR-026` requires the press to ask for no address, and `FR-019`'s rule — the row is
derived from the session, never from a client-supplied identifier — applies to this action as much as
to the profile write. It lives in `auth` because `auth` owns the reset mechanism, the token and the
mail; the profile feature owns the link, not the flow. `FR-028`'s separate counter is satisfied by
passing `flow: "reset"` to the throttle that R1 already discriminates by flow (`OT-SEC-017`), so an
address locked out of sign-in can still press this link and a refused press cannot block a sign-in.

**Alternatives rejected.** *Call `requestPasswordReset` with the user's email in a `FormData`.* It
would put the address on the wire from the client, which is exactly what `FR-026` and `FR-019` rule
out, and it would make the screen's behaviour depend on a value the browser could change.

### E-2. The two reset actions are not refactored into one

**Decision.** `requestPasswordReset` is left untouched. The overlapping sequence — throttle, record,
issue, mail — is written out in both.

**Rationale.** This is the entry where Principle I would allow an extraction, and it is the wrong
one to make. The two flows differ in the order that matters: the anonymous flow counts the attempt
*before* it knows whether the address exists, because `OT-SEC-017` requires a row every time and
§3.1 requires the answer never to reveal whether an account exists; the authenticated flow already
knows the account exists and answers accordingly. A shared helper covering both would carry a flag
for which one it was in, which is an abstraction over a difference rather than a shared shape — the
thing Principle I forbids, and the same reasoning the spec applies to the two screens' write paths.

### E-3. `FR-027` is proved by two tests, neither of which asserts the password policy

**Decision.** A structural test over this feature's files asserting no password control exists on this
screen, and a test that the press produces the mail whose link lands on `/reset`.

**Rationale.** The clarification settled that this entry's obligation under `OT-SEC-004` is negative
and directional, and that a twelve-character test written here would exercise R1's code and
demonstrate nothing about this feature. R1 already carries that proof at
`src/features/auth/server/password-policy.test.ts`, so nothing is lost by not repeating it. The
structural test follows the idiom this repository already uses for exactly this kind of claim —
`src/features/auth/role-surface.test.ts` reads the files under `src/app` and asserts no file sets
`user.role`, which is `OT-AUTHZ-011`'s negative proved the same way. `FR-002` and `SC-004` get a
second test of the same shape: no route segment anywhere in `src/app` names another user's profile.

### E-4. What each Vitest project carries

**Decision.** `updateOwnProfile`, `requestOwnPasswordReset`, the parsers and the query go in the
`server` project against real PostgreSQL. Every component goes in the `ui` project under jsdom. No
test renders `page.tsx`.

**Rationale.** The two projects and their setup files already exist in `vitest.config.mts`, split by
file extension: `*.test.ts` runs in `node` with the database global setup, `*.test.tsx` runs in
jsdom. AGENTS.md requires persistence tests against a real instance because "invariants are enforced
by constraints and row locks, which a mock cannot verify" — which for this entry means the length
`CHECK`s of C-4 and the `IS DISTINCT FROM` write of B-5 are only actually proved against PostgreSQL.
`page.tsx` is excluded by A-4.

---

## Assumptions carried forward

Three, none of which blocks implementation. Each is a place where the sources are silent and the
answer chosen is recorded rather than hidden.

1. **A back/forward navigation may restore a remembered tree** (D-2). The framework declines to
   invalidate that cache by design, and this entry does not override it.
2. **The avatar's empty and failed-load presentation is a default, not a source requirement.** §3.12
   gives the field no empty presentation. The spec records the choice under *Assumptions → Defaults
   chosen because the source is silent* and fixes it in `FR-012b`: the display name alone, which is
   the same choice R2's user chip makes for the same column — so the two agree without either being
   extracted (I).
3. **No referrer posture is specified for the third-party image the avatar names.** The spec records
   this under *Assumptions → Defaults chosen because the source is silent* as recorded rather than
   settled, and non-blocking. This entry sets none, which is the browser's default; a deliberate
   posture is a product decision about what this installation discloses to an image host, not an
   implementation one.
