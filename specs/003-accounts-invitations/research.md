# Phase 0 — Outline & research

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Roadmap**: [`../../docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R3**

Twenty-six decisions, grouped A–F. Each names what was chosen, why, and what was rejected. Nothing
here widens R3's scope boundary; where a decision reaches back into entry R1's delivered code it says
so, and [`plan.md`](./plan.md)'s *Complexity Tracking* records it a second time.

**What is already built.** Entry R1 is implemented and merged: `src/db/schema.ts` carries `user`,
`credential`, `session`, `reset_token` and `auth_attempt`; `src/features/auth/` carries the actor,
the guards, the crypto, the projections, the password policy, the mail transport, the throttle, the
sweep and first-run seeding. This feature consumes all of it. Entry **R2 is not built** — there is no
`src/app/(app)/`, no shell, no `forbidden.tsx` — which is the precondition [`plan.md`](./plan.md)
opens with.

---

## A. Persistence and concurrency

### A-1 · The `invite` table is this feature's only schema change

**Decision.** One new table, `invite`, added to `src/db/schema.ts`; one generated migration. No
column is added to `user`, `session` or `credential`.

**Rationale.** §5 names `invite` in its sixteen tables and then gives it no *Key fields* entry — the
one table in the list the specification leaves unshaped. The spec's *Key Entities* names what it must
carry: the address, the issuing admin, the issue instant, the expiry, whether it has been spent, and
the digest of its single-use token. Everything else the feature needs already exists.
`user.deactivated_at` carries closure (`FR-045`), `user.role` carries the role the roster shows
(`FR-037`), and `session` carries what deactivation deletes (`FR-045`).

**Alternatives considered.** *Reuse `reset_token` with a `kind` column.* It would put two unrelated
lifecycles in one table — a reset token belongs to an existing `user_id`, an invitation belongs to an
address with no user yet — and force `user_id` nullable, weakening a constraint that is currently
`NOT NULL`. *Store invitations on `user` as a pending row.* `OT-SEC-003` and `FR-035` say an account
comes into being at acceptance and at first-run seeding and nowhere else; a pending `user` row is an
account by another name, and it would appear in the roster, in `loadActor()`'s join and in the
`user_email_lower_idx` unique index.

### A-2 · `FR-009a` is a partial unique index over unspent rows

**Decision.**

```text
uniqueIndex("invite_email_lower_unspent_idx")
  .on(sql`lower(email)`)
  .where(sql`accepted_at is null`)
```

`inviteUser` catches PostgreSQL `23505` on that index and returns `FR-009`'s resend offer rather than
an error.

**Rationale.** The spec's edge case — two admins inviting one address close enough that neither read
sees the other — is exactly the read-then-write AGENTS.md rules out, and `FR-009a` now says so.
Scoping the index to `accepted_at is null` states the live-offer invariant and nothing more, so it
stays correct independently of `FR-031a`'s retention rule. A revoked row is deleted (`FR-021`) and so
never participates; an **expired but unspent** row does participate, which is correct: `FR-018` still
lists it and `FR-022` still offers resend, so it is outstanding and a second invitation for that
address must be refused.

`src/features/auth/server/bootstrap.ts` already carries the `23505` detection this needs
(`isUniqueViolation`, which unwraps `error.cause` because `postgres` wraps driver errors) — a second
call site, so it is promoted rather than copied (see F-2).

**Alternatives considered.** *A full `UNIQUE (lower(email))`.* Safe today, because an accepted
invitation implies an account and `FR-008` already refuses that address — but it welds the uniqueness
rule to the retention rule, so a later change to `FR-031a` would silently change what can be invited.
*An advisory lock on the address.* A lock where a constraint expresses the rule directly, and one
more thing to remember at every future call site.

### A-3 · Acceptance is one transaction, and the second acceptance loses on a constraint

**Decision.** `acceptInvitation` resolves the token, then in a single transaction:

1. `update invite set accepted_at = now where id = ? and accepted_at is null returning *` — zero rows
   means another tab won the race, and the caller gets the **used** state;
2. `insert into "user"` with `role = 'member'`, `must_change_password = false`;
3. `insert into credential` with the Argon2id hash;
4. `insert into session` through R1's `issueSession`, given the transaction as its executor (F-4).

The session cookie is set after the transaction commits. A `23505` on `user_email_lower_idx` refuses
the whole transaction and answers `FR-034`.

**Rationale.** Three requirements are concurrency claims and none of them survives a read-then-write.
`FR-031`'s single use is the conditional `where accepted_at is null` — the same shape R1 already uses
in `spendResetToken`. `FR-034` — one address can never yield two accounts — is the `user` table's
existing unique index, not a lookup before the insert; `SC-005` states it as a measurable outcome and
the edge case "opens the acceptance link twice in two tabs" is its test. Doing the four writes in one
transaction is what makes a failed session insert leave no orphan account.

**Alternatives considered.** *Read the invitation, then write.* Two tabs both read `accepted_at is
null` and both create an account for one address. *Check for an existing `user` before inserting.*
Same race, one table over.

### A-4 · Deactivation reuses R1's `withLastAdminGuard`, unchanged

**Decision.** `deactivateUser` calls `withLastAdminGuard(tx, targetUserId, apply)` from
`src/features/auth/server/admin-guard.ts`. No second mechanism is written, and that module is not
edited.

**Rationale.** It already does precisely what `FR-049` and invariant 13 require: it selects the active
admins `.for("update")`, so two concurrent deactivations serialise on the same rows, and throws
`LastAdminRefusal` when the target is the last one. The spec's own reconciliation says the lock is
shared rather than duplicated, and that sharing is what makes `OT-INV-013` hold across the CLI path
R1 delivered and the screen path this feature adds. `SC-008` is testable by calling the mutator
concurrently for two admins and asserting exactly one succeeds.

**Alternatives considered.** *A count check inside `deactivateUser`.* A read followed by a write, and
a second answer to a question the installation must answer once. *A database `CHECK`.* It cannot see
across rows.

### A-5 · Indexes: two, and no more

**Decision.** `invite_email_lower_unspent_idx` (A-2) and a unique index on `token_digest`. Nothing on
`invited_by`, nothing on `created_at`.

**Rationale.** AGENTS.md says to add indexes for known query patterns only. The two queries this
feature runs against `invite` are *by token digest* (acceptance) and *every unaccepted row, newest
first* (the list). The first is the unique index; the second is a full scan of a table whose row
count is bounded by the number of people ever invited to one installation — a team under twenty
(`OT-SCOPE-001`). `invited_by` is never filtered on: the list joins `user` to render the inviter's
name, and a join on a primary key needs no index on the referencing side for this cardinality. A
`user` row is never deleted (`OT-INV-017`), so there is no cascade scan to accelerate either.

### A-6 · Column shapes follow R1's conventions exactly

**Decision.** `id` UUIDv7 · `email text` with `char_length <= 200` · `invited_by uuid not null
references "user"(id) on delete cascade` · `token_digest text not null unique` with `char_length =
64` · `expires_at timestamptz not null` · `accepted_at timestamptz` · `created_at`, `updated_at`
`timestamptz not null`, both written through `touched()`.

**Rationale.** Every choice is copied from a sibling rather than decided here: `session` and
`reset_token` both carry `token_digest text ... char_length = 64`, `user` carries the 200-character
bound §5's conventions put on names and addresses, and §5 requires `updated_at` on any row a mutator
changes. `invite` is changed — resend rewrites `token_digest` and `expires_at` — so it carries one,
where `reset_token`, which is only ever spent, does not.

**On `on delete cascade`.** It matches `session` and `reset_token` and never fires: closure is
`deactivated_at`, not deletion, and the edge case requiring a deactivated inviter's name to keep
rendering is therefore satisfied by the absence of deletes, not by the FK rule.

---

## B. Tokens, mail and the four states

### B-1 · The four-state classification is extracted; the two queries are not

**Decision.** A new pure module, `src/features/auth/server/token-state.ts`:

```text
export type TokenState = "valid" | "used" | "expired" | "unknown"
export function classifyToken(row: { spentAt: Date | null; expiresAt: Date } | null, now: Date): TokenState
```

`resolveResetTokenState` is refactored to call it; `resolveInvitationState` calls it too. Each keeps
its own `select`, because they select from different tables.

**Rationale.** This is Principle I's second call site, arriving exactly as the principle describes.
What is shared is not the query but the **ordering rule** — used beats expired, absent beats both —
and §3.1 requires the two screens to behave identically ("the same convention as Accept invite").
Left duplicated, that ordering is two independent decisions that can drift, and the drift is
invisible: a token that is both spent and past its expiry would report differently on two screens the
specification says match. Extracting the pure part and leaving the queries separate avoids the
generic machinery Principle III warns against — no table type parameter, no dynamic dispatch, one
function over two plain fields.

**Alternatives considered.** *Duplicate the four-state logic in `invitations.ts`.* Cheapest diff, and
it is the drift above. *A generic `resolveTokenState(table, digestColumn, spentColumn)`.* Drizzle
table types do not unify without a type parameter and a cast; it would trade a real duplication for
indirection twelve entries read.

### B-2 · A revoked invitation renders **unknown**, and that is the row being gone

**Decision.** `revokeInvite` deletes the row. `resolveInvitationState` finds no row and returns
`unknown`. No `revoked` state and no fourth screen exist.

**Rationale.** `FR-021`, `FR-032` and the spec's assumption all say this, and §3.1 names three states
and no fourth. It falls out of the delete rather than being implemented: with no row there is nothing
to call revoked. The asymmetry against acceptance — which **retains** — is `FR-031`'s, and it is the
whole reason `used` is answerable at all.

### B-3 · Resend rewrites the row; the old link dies with its digest

**Decision.** `resendInvite` issues a new token through R1's `issueToken()` and updates
`token_digest`, `expires_at` and `updated_at` on the existing row, in one statement. No second row is
written.

**Rationale.** §3.9's "reissues the link and restarts the 7 days" is read as a new secret (the spec's
own assumption), and one row per address is what `FR-009a`'s index already enforces. Because the
digest is replaced rather than added to, the previously mailed token now matches nothing and resolves
to `unknown` — which is the state the spec's edge case names for a person holding the older link.
`FR-020`'s "exactly one live link at any moment" is therefore a property of the schema, not of a
cleanup step.

### B-4 · Retention is indefinite, and nothing sweeps `invite`

**Decision.** `FR-031a`. The spent row and its digest are kept for the life of the installation. R1's
in-process timer (`src/features/auth/server/sweep.ts`) is **not** extended; `invite` is not added to
its statements.

**Rationale.** The retained digest is the only thing that lets a used link answer `used` rather than
`unknown`, so any horizon would make `SC-004` conditional on a link's age. Growth is one row per
accepted invitation, bounded by the people ever to hold an account. The spec's *Out of Scope* already
refuses a retry sweep for invitation mail; refusing a retention sweep is the same reasoning about the
same timer.

### B-5 · The SMTP transport is promoted to `src/lib/mail.ts`; the two messages stay in their features

**Decision.** The transport, its two environment variables and its failure path move out of
`src/features/auth/server/mail.ts` into `src/lib/mail.ts`, exposing one function:

```text
export async function sendMail(message: { to: string; subject: string; text: string }): Promise<"sent" | "not_sent">
```

`auth/server/mail.ts` keeps `sendPasswordResetMail` and calls it; a new
`accounts/server/mail.ts` adds `sendInvitationMail` and calls it too.

**Rationale.** AGENTS.md: colocate with one feature, promote to `src/lib` **after a real second use**.
This is the real second use — the reset link and the invitation link are two messages over one
operator-supplied SMTP connection, and the roadmap records the transport as R1's, wired once. Leaving
it in `auth/` would have `features/accounts` import `features/auth/server/mail`, which is a
cross-feature reach for infrastructure rather than for behaviour.

### B-6 · `sendMail` returns an outcome, because `FR-017` has an audience and the reset does not

**Decision.** `sendMail` returns `"sent" | "not_sent"` and never throws. `sendPasswordResetMail`
ignores the outcome and logs, exactly as it does today. `sendInvitationMail` returns it, and
`inviteUser` carries it into its result so the screen can tell the admin.

**Rationale.** This is the one genuine behavioural difference between the two messages, and it is
required. `OT-SEC-011` forbids the reset flow from varying its answer with whether the address exists
— so a failure there must stay silent and go to the log. `FR-017` requires the opposite: the invite's
caller is the admin, there is nothing to conceal from them, and the invitation still stands with
Resend as the remedy. A shared transport that swallowed failures could not satisfy both.

**Alternatives considered.** *Throw on failure.* It would roll back the invitation, and `FR-017` says
the invitation stands. *A second transport for invitations.* Two places to configure one SMTP host.

---

## C. Routing and the server boundary

### C-1 · `/invite/accept` is the fourth public route, and `proxy.ts` must be told

**Decision.** A new route group member `src/app/(auth)/invite/accept/page.tsx`, and one edit to
`src/proxy.ts`'s matcher:

```text
"/((?!signin$|reset$|invite/accept$|api/auth/signin$|_next/static|_next/image|favicon.ico).*)"
```

**Rationale.** R1's proxy redirects every request without a session cookie, so without this edit the
new route is unreachable by the only people who need it and `FR-024` cannot pass. `OT-SEC-002` fixes
the reachable-by-a-stranger set at four; R1 opened three and R2's route-surface contract records that
the fourth stays shut until R3. This is R3 opening it, and the count is now closed — `FR-024` says no
fifth.

**The screen renders in R1's `(auth)` group**, whose layout is already the full-screen card outside
the shell that `FR-025` requires — no sidebar, no header, the same frame Sign in and Change password
use. Nothing about it is rebuilt.

**On `proxy.ts` not being authorization.** AGENTS.md is explicit, and this edit is consistent with it:
the matcher decides routing, and the page itself resolves the token and refuses on its own.

### C-2 · Every mutator is a Server Action; none is a route handler

**Decision.** Six Server Actions in one `"use server"` module,
`src/features/accounts/actions.ts`: `inviteUser`, `resendInvite`, `revokeInvite`,
`acceptInvitation`, `deactivateUser`, `reactivateUser`.

**Rationale.** AGENTS.md: Server Actions for this application's mutations, route handlers for public
APIs, webhooks, callbacks, feeds **and sign-in**, which the specification pins to
`POST /api/auth/signin` so the throttle and the origin check sit in one place. Acceptance is not that
exception: it carries no throttle, §6 names only sign-in, and `FR-024` opens a page rather than an
endpoint. One `"use server"` module is also the only shape a Client Component may import server
behaviour from, which the Invite modal and the roster's controls both need.

### C-3 · Each action asserts the origin, then the predicate, then derives its subject from the row

**Decision.** Every action begins `assertSameOrigin({ headers: await headers() })`. The five
admin-only actions then call `requireActor()` and check `role === "admin"`, re-read on every request
from the `user` row. Each then loads its subject — the invitation, or the account — **by the
identifier's stored row**, and refuses if it is absent.

**Rationale.** `FR-012`, `FR-043`, `FR-060`, `FR-061` and `FR-062`, and AGENTS.md's rule that every
Server Action is a public server entry point. `FR-062` — losing the admin role mid-session removes no
rows and the server refuses regardless of what the client shows — is satisfied structurally because
`loadActor()` reads `user.role` per request and caches nothing across them, which is R1's
`OT-SEC-008` behaviour rather than anything added here.

### C-4 · Writes are not optimistic, and each revalidates the screen

**Decision.** No `useOptimistic`. Each action ends with `revalidatePath("/settings/accounts")`, and
each control shows in-flight state from `useActionState`'s pending flag.

**Rationale.** `FR-059` says every write on this screen waits for the server and shows in-flight state
on its own control; the spec's assumption explains why — `OT-UX-008` makes small local gestures
optimistic, and every write here is either a create with a server-assigned expiry or an account-state
change behind a confirmation, neither of which is that gesture. `revalidatePath` is what makes the
list and the roster reflect a completed write without a client cache, which is the same rule
`FR-056` states for navigation.

### C-5 · `FR-046` needs a test, not code

**Decision.** No change to `src/app/api/auth/signin/route.ts`. The closed-account refusal is asserted
against R1's existing `{ result: "deactivated", contact }` response.

**Rationale.** R1 delivered §3.1's deactivated state, including `SUPPORT_EMAIL`. `FR-046` is a claim
about the whole system after this feature closes an account, and the honest way to hold it is an
end-to-end assertion — deactivate through this feature's mutator, then sign in and read the
deactivated result — not a second implementation. `SC-007` is the same shape.

---

## D. The screen

### D-1 · The tab is `Tabs` with `selectedKey` held in the page, never in the URL

**Decision.** React Aria's `Tabs`/`TabList`/`Tab`/`TabPanel` from `react-aria-components/Tabs`, with
`defaultSelectedKey="invitations"` and no router involvement.

**Rationale.** `FR-003` and §3.9 both say the tab is local page state, not a route, and that a reload
returns to Invitations — `defaultSelectedKey` is exactly that and nothing more. React Aria supplies
the roving-tabindex, arrow-key and `aria-controls` behaviour `FR-030`/`OT-UX-018` require.

### D-2 · `FR-008`'s "link" is a controlled `selectedKey` plus a highlighted row

**Decision.** The clarified behaviour is implemented by lifting `Tabs` to a controlled `selectedKey`
in the screen's one client component. The refusal's control sets `selectedKey` to `accounts`, closes
the modal, clears the field, and sets a `highlightedAccountId`; the roster's matching row calls
`scrollIntoView` and carries a transient marker that clears on a timer or on the next interaction.
No `href`, no `router.push`, no history entry.

**Rationale.** The clarification settled the *what*; this is the only shape that delivers it without
a route. §3.9 states in one paragraph both that the form "offers a link to it" and that the tab has
"nothing to link to", so an anchor cannot satisfy it — and `FR-003` would send a real navigation back
to Invitations. Because everything is state in one component, the whole behaviour is assertable in
jsdom with no router mock.

**Cost, recorded.** It forces the tab state up into a client component that owns both panels. That is
the one place in this feature where a component holds two concerns, and [`plan.md`](./plan.md) records
it under Principle I.

### D-3 · The Invite form is a modal, and its validation is per-field on blur

**Decision.** `DialogTrigger` + `Modal` + `Dialog` from `react-aria-components/Modal`, one
`TextField`, one submit `Button`. Validation runs on blur per field, in the `SignInForm` shape R1
already uses — local state, `validationBehavior="aria"`, `FieldError` bound to the field — with the
duplicate-address checks answered by the server and rendered the same way.

**Rationale.** `FR-005` (one field, a submit control, nothing else), `FR-006`/`OT-UX-011` (per field,
on blur, never a wall of errors on submit, and the submit control stays enabled), `FR-011` (Cancel or
Escape closes and discards — `Modal`'s own behaviour). `SignInForm` is the house pattern for
blur-validated fields and it is followed rather than reinvented.

**The duplicate checks are server answers.** `FR-008` names an existing account and `FR-009` offers
resend; neither is knowable on the client, and `OT-DATA-005` forbids shipping the roster to the
browser to make them knowable. So blur triggers a server lookup returning one of
`ok | malformed | has_account | has_invitation`, and the shape of `has_account` carries which account
and whether it is closed (`FR-008a`).

### D-4 · The two lists are semantic tables, hand-built, not React Aria `Table`

**Decision.** Plain `<table>` markup for the invitations list and the roster. React Aria's `Table` is
not used.

**Rationale.** `Table` exists for selection, sorting, resizing, drag and keyboard navigation across
cells; §3.9's lists have none of those. What they have is rows of text with one or two controls each,
and the controls are `Button`s that already carry React Aria's behaviour. Principle III and `FR-030`
agree here: React Aria supplies behaviour where there is behaviour to supply, and there is none in a
static list. `OT-UX-018` is satisfied by the controls, not by the container.

### D-5 · The last-admin control is disabled with its reason beside it, and the reason is computed on the server

**Decision.** The roster query returns `activeAdminCount`; the row renders `isDisabled` when the
account is the sole active admin, with the reason as text next to the control — never a tooltip,
never hidden. `deactivateUser` refuses the same case regardless.

**Rationale.** `FR-050` and `OT-UX-002`, and R2's `ux-conventions` contract, which assigns
disabled-with-inline-reason its first implementation here for exactly this control. `FR-061` is the
rule this pair illustrates: the client may run the predicate to disable, and the server check is the
enforcement.

### D-6 · Every async Server Component is a thin wrapper over a synchronous one

**Decision.** `page.tsx` awaits its queries and passes plain data to a synchronous component; every
assertion is made against the synchronous component or against the server module directly.

**Rationale.** Inherited from R2's research D-1: Vitest cannot render async Server Components, and
this repository has no E2E runner and cannot add one under Principle IV. That constraint, not taste,
fixes where the component boundaries fall — and it is what makes gate 1 reachable for a screen whose
data all arrives on the server.

---

## E. The four conventions R3 now owns

Settled by clarification: R3 implements `OT-UX-005`, `-006`, `-016` and `-017` whichever entry is
built first. R2's [`ux-conventions`](../002-app-shell-ux/contracts/ux-conventions.md) contract is
binding on the details, and its wording is quoted rather than paraphrased in
[`contracts/ux-conventions.md`](./contracts/ux-conventions.md).

### E-1 · Toasts use React Aria's toast region, which ships `UNSTABLE_`-prefixed in 1.20.0

**Decision.** Use `UNSTABLE_ToastRegion`, `UNSTABLE_ToastQueue`, `UNSTABLE_Toast` and
`UNSTABLE_ToastContent` from `react-aria-components/Toast`, and **pin `react-aria-components` to
`1.20.0` exactly** in `package.json`, replacing the `^1.20.0` range.

**Rationale.** R2's `FR-034` is explicit that toasts "MUST be announced to assistive technology, which
under `FR-030` means React Aria's toast region rather than a hand-rolled live region" — so the
component is required, not chosen. In 1.20.0 the toast module exports exist only behind the
`UNSTABLE_` prefix, which is the library's signal that the API may move in a minor release. Pinning
exactly is the same move R2 made for `next@16.3.2` when it adopted `authInterrupts`: the API cannot
move without a deliberate upgrade. Pinning a version is not adding a dependency, so gate 4 is
untouched.

**Alternatives considered.** *A hand-rolled `aria-live` region.* It contradicts `FR-034` and `FR-030`
by name, and would have to reproduce focus management, queueing and the timer that React Aria already
ships. *Wait for a stable toast API.* It would leave `OT-UX-016` unimplemented in the entry the team
has just settled it on.

### E-2 · The auto-dismiss is five seconds and every toast also carries a dismiss control

**Decision.** `UNSTABLE_ToastQueue` is constructed with a five-second timeout, and each toast renders
a close `Button`.

**Rationale.** R2's `FR-034` fixes both: "Auto-dismiss MUST be five seconds from the toast appearing,
and every toast MUST also carry a dismiss control, so the timer is never the only way out of one."
This feature's `FR-054` restates the rule more briefly; R2's is the binding text.

**Kinds.** Four — success, info, warning, error. R2 assigns success to a completed write and error to
a rejected one and leaves info and warning "to the implementing entry". This feature uses **warning**
for a created invitation whose mail did not go (`FR-017`), and uses **info** nowhere; a kind with no
caller is still part of the type, because `FR-054` fixes the set at four.

### E-3 · Skeletons go below the guard, per-screen, and are not `loading.tsx`

**Decision.** The Invitations panel and the roster each render their own skeleton, matching their own
table's row count and column widths, inside the page below `requireActor()` and the admin check. No
`loading.tsx` is added at `settings/accounts`.

**Rationale.** R2's route-surface contract states the reason and this feature inherits it verbatim: a
`403` or `404` is a real status only while the response has not begun streaming, so a `loading.tsx`
above the guard turns a refusal into a streamed `200`. `FR-055` and `OT-UX-005` require the skeleton
to match the layout it replaces with zero layout shift, which a shared spinner cannot do and which is
why the two panels have two skeletons rather than one.

### E-4 · Re-query on navigation is already true, and the mutators make it true after writes

**Decision.** Add no cache configuration. Rely on the client router cache's `dynamic` stale time of
`0`, and call `revalidatePath("/settings/accounts")` from every mutator.

**Rationale.** R2's research A-7 established that a page segment is refetched on every navigation
under the default, so `FR-056`/`OT-UX-006` needs no code for the navigation half — and adding a cache
setting to "make sure" would be the speculative configuration Principle III rejects. What it does need
is the write half: after a mutation the page must not render the pre-write payload, and
`revalidatePath` is the framework's own answer. US3 scenario 9 is the navigation assertion.

### E-5 · The connection banner watches transport failure, not server refusals

**Decision.** One client component at the shell-adjacent top of this screen, holding
`isOffline` state fed by `window`'s `online`/`offline` events **and** by any action call that rejects
before reaching the server. It renders R2's exact string, "Can't reach the server. Reconnecting.",
refuses writes with "Changes need a connection", queues nothing, and clears on the next request that
does reach the server.

**Rationale.** R2's `FR-035` fixes both strings as binding exactly as quoted and draws the line this
decision follows: a connection is lost when a request **fails to reach** the server — a transport
failure — whereas an error the server itself returned is a rejected write and takes a toast under
`FR-034`. Distinguishing them is the whole content of the requirement; `FR-057` and `FR-058` are the
two sides. "Reconnecting" obliges no retry cadence of its own, so no polling is written.

**Scope.** The banner is built for this screen because this is the first screen with writes. It is
not promoted to the shell: R2 owns the shell, and Principle I extracts at the second call site, which
is R4.

---

## F. Reach-back into entry R1

Four edits to delivered code. Each is a promotion or a parameter, none changes existing behaviour,
and all four are recorded again in [`plan.md`](./plan.md)'s *Complexity Tracking*.

| # | Edit | Why | Requirement |
| --- | --- | --- | --- |
| **F-1** | `token-state.ts` extracted; `resolveResetTokenState` refactored to use it | Principle I's second call site; the used-beats-expired ordering must not drift between two screens §3.1 says match | `FR-032`, B-1 |
| **F-2** | `isUniqueViolation` promoted out of `bootstrap.ts` into `src/db/unique-violation.ts` | Second call site — first-run seeding, now `inviteUser` and `acceptInvitation`. It unwraps `error.cause`, which a copy would get wrong | `FR-009a`, `FR-034`, A-2 |
| **F-3** | The SMTP transport promoted to `src/lib/mail.ts`; `sendMail` returns an outcome | Second message over one transport; `FR-017` needs the outcome that `OT-SEC-011` requires the reset to swallow | `FR-017`, B-5, B-6 |
| **F-4** | `issueSession` gains an optional executor, matching `deleteAllSessionsForUser`'s existing signature | Acceptance writes the session in the same transaction as the account, so a failure leaves no orphan account | `FR-028`, A-3 |
| **F-5** | `SESSION_COOKIE_OPTIONS` extracted in `sessions.ts` | The cookie's five options now have a second setter; two copies is how they drift | `FR-028` |

`src/proxy.ts`'s matcher (C-1) is a sixth edit but not a reach-back into behaviour — it is this
feature registering its own route.

---

## Testing constraints

- **Two Vitest projects, unchanged.** `server` (node, `*.test.ts`, real PostgreSQL via
  `globalSetup`, `fileParallelism: false`) and `ui` (jsdom, `*.test.tsx`).
- **`src/db/test-database.ts` gains `invite`** in `TRUNCATED_TABLES`, ahead of `user` in the list so
  the truncation order stays child-first. Without it every persistence test in this feature leaks
  rows into the next.
- **The three database-enforced rules are tested against real PostgreSQL, never a mock**: the partial
  unique index (A-2), the acceptance race on `user_email_lower_idx` (A-3), and the active-admin row
  lock (A-4). AGENTS.md requires it, and a mock cannot fail a constraint.
- **Concurrency tests need two connections.** `testDb` is one pool; a race test issues both writes
  through it with `Promise.allSettled` and asserts exactly one fulfils — the lock and the index both
  serialise at the database, so no second pool is needed.
- **No async Server Component is rendered by a test** (D-6).

---

## Assumptions carried forward

Three, none blocking, each a candidate for a later clarification.

1. **The transient highlight on the jumped-to row clears after a short interval or on the next
   interaction, whichever is first.** §3.9 does not describe the affordance at all — the clarification
   settled that the jump happens, not how long the marker stays. Anything persistent would look like
   selection, which this screen has none of.
2. **The Invite modal's blur lookup is a Server Function, not a query on every keystroke.** `FR-006`
   says "on blur", so the call site is fixed; that it is one call per blur rather than debounced typing
   follows from the wording and keeps the address out of the query string (`OT-DATA-005`).
3. **The mail-failure toast is warning, not error** (E-2). `FR-017` says the invitation stands and
   resend is the remedy, so the write succeeded — error would misreport it, and R2 reserves error for
   a rejected write.
