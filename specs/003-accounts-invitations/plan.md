# Implementation Plan: Accounts and invitations

**Branch**: `claude/accounts-invitations-spec-2af636` | **Date**: 2026-08-30 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/003-accounts-invitations/spec.md`](./spec.md) and roadmap
entry **R3**, whose scope boundary this plan does not widen.

## Summary

R3 populates the team. One admin-only screen at `/settings/accounts` with two tabs; one public route
at `/invite/accept`; one new table, `invite`; six Server Actions; and the four cross-cutting UX
conventions entry R2 stated and left to whichever entry had the first caller — which a clarification
in this branch settled on R3, unconditionally. Entry R5 depends on all of it.

Almost nothing here is invented, because entry R1 is built and already carries the parts. The token is
R1's `issueToken()` and its SHA-256 digest; the password policy, the blocklist and Argon2id are R1's;
the mail transport is R1's; the session and its cookie are R1's; the case-folding `parseEmail` is
R1's; and — the one that matters most — **the active-admin row lock is R1's `withLastAdminGuard`,
reused rather than reproduced**, which is what makes `OT-INV-013` hold across the CLI path and the
screen path at once. This feature adds an entry point to each, not a variant of it.

**Four decisions shape the rest.** `FR-009a`'s "one live offer per address" is a **partial unique
index** over unspent rows, not a check the mutator performs — the spec's own edge case is two admins
racing, which is the read-then-write AGENTS.md forbids, and scoping the index to `accepted_at is null`
states the live-offer invariant without depending on `FR-031a`'s retention rule. Acceptance is **one
transaction** whose three atomicity claims are each held by a constraint: the conditional spend, the
`user` address index, and the transaction itself. `FR-008`'s "link to it" is an **in-page control**,
not an anchor — §3.9 says in one paragraph both that the form offers a link and that the tab has
"nothing to link to", so nothing with an `href` can satisfy it. And toasts use React Aria's toast
region, which in `react-aria-components@1.20.0` ships only `UNSTABLE_`-prefixed, so the version is
**pinned exactly** rather than ranged — the same move R2 made for `next@16.3.2`.

Full reasoning in [`research.md`](./research.md) — twenty-six decisions, groups A–F. The table in
[`data-model.md`](./data-model.md), the boundary in
[`contracts/server-mutators.md`](./contracts/server-mutators.md), the link and its four states in
[`contracts/invitations.md`](./contracts/invitations.md), the two screens in
[`contracts/accounts-screen.md`](./contracts/accounts-screen.md), and what R3 now owns for every later
entry in [`contracts/ux-conventions.md`](./contracts/ux-conventions.md).

## Technical Context

**Precondition — entry R1 is built; entry R2 is not.** `src/db/schema.ts` carries `user`,
`credential`, `session`, `reset_token` and `auth_attempt`, and `src/features/auth/` carries the
actor, the guards, the crypto, the projections, the policy, the mail, the throttle, the sweep and
seeding. All of it is consumed here. But there is no `src/app/(app)/`, no shell, no `ScreenHeader`,
no `forbidden.tsx` — and `/settings/accounts` is a route **R2 creates** and this feature fills. This
plan is complete and `/speckit-tasks` can be run against it, but **implementation of the screen is
blocked until R2 lands**. Everything server-side — the table, the six mutators, the token states,
`/invite/accept` — is buildable today, which is where the task ordering starts.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, Drizzle ORM 0.45.2 over `postgres` 3.4.9, `@node-rs/argon2` 2.2.0,
`nodemailer` 9.0.6, `uuidv7` 1.2.1, Tailwind CSS v4 in CSS, Biome 2.4.2.

**Dependencies this feature installs**: **none.** Gate 4 is satisfied. Every library it touches is
already in AGENTS.md's approved table. `react-aria-components` moves from `^1.20.0` to `1.20.0` —
a version **pin**, not a package ([`research.md`](./research.md) E-1).

**Configuration this feature changes**: `src/proxy.ts`'s matcher gains `invite/accept$`, without
which R1's proxy redirects every stranger holding an invitation and `FR-024` cannot pass. No
`next.config.ts` change. **No new environment variable** — `SMTP_URL`, `MAIL_FROM` and `APP_URL` are
R1's and are reused as they stand.

**Storage**: PostgreSQL 18 via Drizzle. **One new table, `invite`; one generated migration; no change
to any existing table.** Two indexes: unique on `token_digest`, and a **partial unique** index on
`lower(email) WHERE accepted_at IS NULL`. `src/db/test-database.ts` gains `"invite"` to its
truncation list, ahead of `"user"`.

**Testing**: Vitest 4.1.11 in R1's two projects — `server` (node, `*.test.ts`, real PostgreSQL via
`globalSetup`, `fileParallelism: false`) and `ui` (jsdom + `@testing-library/react`, `*.test.tsx`).
Five concurrency rules run against the real instance `TEST_DATABASE_URL` names, because each is
enforced by a constraint or a row lock and a mock cannot fail one. No async Server Component is
rendered by a test ([`research.md`](./research.md) D-6, inherited from R2).

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The roster is one query
over a table bounded by one team; the invitations list is a full scan of a table bounded by the
people ever invited to one installation ([`research.md`](./research.md) A-5).

**Constraints**: an invitation grants a login and never membership (`FR-016`, `OT-SCOPE-005`) · no
screen sets a role, ever (`OT-AUTHZ-011`) · exactly four public routes after this one, and no fifth
(`OT-SEC-002`) · invite secrets unreachable from every read endpoint (`OT-DATA-006`) · `accountUser`
here and `publicUser` everywhere else (`OT-DATA-005`) · at least one admin always active, under a
lock shared with the CLI (`OT-INV-013`) · the project count is `0` until R5 (`OT-AUTHZ-006`) ·
nothing optimistic on this screen (`FR-059`) · no dependency outside AGENTS.md's table (IV).

**Scale/Scope**: one installation, one team under twenty people. 66 functional requirements, 4 user
stories, 51 acceptance scenarios, 13 edge cases, 11 success criteria, 2 screens across 2 routes, 9
components, 6 Server Actions and 1 Server Function, 1 new table.

**Unknowns**: none outstanding. Six questions were closed across two `/speckit-clarify` sessions —
four of them on the two source tensions this spec had reconciled without naming their mechanism.
Research adds three assumptions of its own ([`research.md`](./research.md), *Assumptions carried
forward*): how long the jumped-to row stays marked, that the blur check is one call per blur, and
that the mail-failure toast is warning rather than error. None blocks implementation.

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record.

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | Nine components, each with one concern, except `accounts-screen.tsx`, which holds the tab state **and** the highlighted row because `FR-008`'s in-page jump moves both at once — recorded below. Three extractions are made, and each is a genuine second call site rather than a guess: `classifyToken`, `isUniqueViolation`, the SMTP transport. Nothing is promoted on one use: the connection banner stays in this feature although it clearly belongs to the shell, because R4 is its second caller and R2 owns the shell. | pass, with two entries in Complexity Tracking |
| **II** | Validated Input Boundaries | Seven server entry points — six actions and one read. Every one asserts the origin, then the predicate, then loads its subject **from the stored row** rather than from what the caller claimed (`FR-060`). Addresses go through R1's `parseEmail`, passwords through R1's `assertPasswordPolicy` on the server whatever the form allowed (`FR-027`), and the token's shape is checked before the database is asked. The blur check is admin-only because it answers questions about the roster. | pass |
| **III** | Straightforward Over Clever | No metaprogramming, no dynamic dispatch, no generic machinery. `classifyToken` takes two plain fields rather than a table type parameter, which is the difference between the extraction being useful and being indirection. The two lists are plain `<table>` markup rather than React Aria's `Table`, because they have no selection, sorting, resizing or cell navigation to supply behaviour for. Two skeletons rather than one parameterised skeleton, because "matching this layout" is not shareable. | pass |
| **IV** | Built-In Features Over Third-Party Libraries | **No dependency is added.** Randomness and hashing are `node:crypto`, the transaction is Drizzle's, the constraint is PostgreSQL's, the interrupt-free refusals are plain returns, and every interactive control is React Aria's. The one entry worth naming is that the toast API is `UNSTABLE_`-prefixed at this version — a built-in of an approved library, but not a stable one — so the version is pinned exactly. Recorded below. | pass, with one entry in Complexity Tracking |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The four places a reader will want an explanation — why the invite index is partial, why acceptance discovers a collision through a constraint instead of a lookup, why `sendMail` returns an outcome the reset ignores, and why `FR-008`'s control has no `href` — are answered by [`research.md`](./research.md) and the contracts, not by annotation. | pass |
| **VI** | No Dead Code | Two things look like placeholders and are not: `projectCount` is a literal `0`, which is the figure the roadmap requires this screen to render until R5; and the toast type carries an `info` kind with no caller in this entry, because `FR-054` fixes the set at four. Both are declared below rather than discovered in the diff. Nothing is retained for future use. | pass, with two entries in Complexity Tracking |
| **VII** | Test-First (NON-NEGOTIABLE) | All 51 acceptance scenarios are Red steps written before their implementation, and **every functional requirement has a test** — unlike R2, which by its own design shipped six without one. Five of the scenarios are concurrency races that must run against real PostgreSQL, because each is enforced by a constraint or a row lock. `FR-046` is the one requirement satisfied by code this feature does not write; it is held by an end-to-end assertion against R1's existing deactivated response rather than by a second implementation ([`research.md`](./research.md) C-5). | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. The runner cannot render async Server Components, so every assertion lands on a synchronous component, a server module, or a database constraint |
| 2 | Minimal implementation, then refactor green | Scoped per task. No mutator does more than its predicate, its write and its revalidation; no component takes a prop its scenario does not require |
| 3 | Server-side validation at every touched boundary | Principle II row above. Seven entry points, seven preludes. The one new query parameter — `token` — is shape-checked before it reaches the database |
| 4 | No unapproved dependency | None installed. The `react-aria-components` change is `^1.20.0` → `1.20.0`, a pin on a package already in AGENTS.md's table |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above; the two apparent placeholders are declared, not hidden |
| 7 | Every changed line traces to a requirement | Each file in the structure below names the FR that puts it there. The five edits to R1's delivered code are listed separately and each names its principle |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not by itself evidence of gate 1 |

**Re-evaluation after Phase 1.** The design added no dependency, no shared abstraction without a
second call site, and no comment. Three things it *changed* beyond the feature's own files, each
recorded below: five edits reach back into entry R1's delivered code, all of them promotions or
optional parameters that leave existing behaviour identical; `src/proxy.ts`'s matcher gains the
fourth public route; and `package.json` pins `react-aria-components` exactly. One thing it
deliberately did **not** change: R1's `withLastAdminGuard` is used as it stands, because the sharing
is what `OT-INV-013` depends on.

## Project Structure

### Documentation (this feature)

```text
specs/003-accounts-invitations/
├── spec.md                     the feature specification
├── plan.md                     this file
├── research.md                 Phase 0 — 26 decisions, groups A–F
├── data-model.md               Phase 1 — the invite table, two lifecycles, four DTOs
├── quickstart.md               Phase 1 — ten runnable walkthroughs
├── contracts/
│   ├── server-mutators.md      the seven server entry points and their refusals
│   ├── invitations.md          the link, the four states, the mail
│   ├── accounts-screen.md      /settings/accounts and /invite/accept
│   └── ux-conventions.md       the four conventions R3 now owns, and what R4 inherits
├── checklists/
│   └── requirements.md         existing
└── tasks.md                    Phase 2 — not created by /speckit-plan
```

### Source code (repository root)

Every path below is created or edited by this feature, and each names why it exists.

```text
src/
├── db/
│   ├── schema.ts                            EDIT — the invite table, two indexes    FR-009a, FR-014
│   ├── unique-violation.ts                  NEW  — isUniqueViolation, promoted (F-2)
│   └── test-database.ts                     EDIT — "invite" in TRUNCATED_TABLES
├── lib/
│   └── mail.ts                              NEW  — the SMTP transport, promoted (F-3)     FR-017
├── proxy.ts                                 EDIT — the fourth public route               FR-024
├── app/
│   ├── (auth)/invite/accept/page.tsx        NEW  — resolve, then form or dead-link state
│   │                                              FR-024, FR-025, FR-026, FR-032, FR-033
│   └── (app)/settings/accounts/page.tsx     EDIT (R2's) — guard kept, body replaced
│                                                  FR-001, FR-002, FR-003
└── features/
    ├── auth/                                five reach-back edits, none behavioural
    │   ├── server/token-state.ts            NEW  — classifyToken, shared (F-1)            FR-032
    │   ├── server/reset-tokens.ts           EDIT — calls classifyToken (F-1)
    │   ├── server/bootstrap.ts              EDIT — imports the promoted helper (F-2)
    │   ├── server/mail.ts                   EDIT — composes only; transport moved (F-3)
    │   └── server/sessions.ts               EDIT — issueSession executor (F-4),
    │                                               SESSION_COOKIE_OPTIONS (F-5)     FR-028
    └── accounts/                            NEW feature
        ├── actions.ts                       "use server" — six mutators + the blur read
        │                                          FR-012, FR-043, FR-060…FR-063
        ├── server/invitations.ts            issue · resolve · resend · revoke · spend
        │                                          FR-013, FR-014, FR-020, FR-021, FR-031
        ├── server/accounts.ts               deactivate · reactivate, under R1's lock
        │                                          FR-045, FR-049, FR-051
        ├── server/roster.ts                 the two list queries + activeAdminCount
        │                                          FR-018, FR-036…FR-041, FR-050
        ├── server/mail.ts                   sendInvitationMail, returning its outcome     FR-017
        └── components/
            ├── accounts-screen.tsx          "use client" — tabs, selectedKey, highlight
            │                                      FR-003, FR-008
            ├── invite-modal.tsx             one field, blur validation, four refusals
            │                                      FR-005…FR-011, FR-008a
            ├── invitations-table.tsx        the list, Resend and Revoke, the empty line
            │                                      FR-018, FR-019, FR-022, FR-023
            ├── invitations-skeleton.tsx     matches the list's own layout                FR-055
            ├── roster-table.tsx             rows, the one control, the disabled reason
            │                                      FR-036…FR-042, FR-044, FR-050
            ├── roster-skeleton.tsx          matches the roster's own layout              FR-055
            ├── accept-invitation-form.tsx   the form and the three dead-link states
            │                                      FR-026, FR-027, FR-032
            ├── toast-region.tsx             "use client" — React Aria's toast region     FR-054
            └── connection-banner.tsx        "use client" — transport failure only        FR-057

drizzle/0002_*.sql                           NEW  — generated, inspected, committed
package.json                                 EDIT — react-aria-components pinned 1.20.0   FR-054
```

Untouched and named so: `src/features/auth/server/admin-guard.ts` (used as it stands — the sharing is
the point), `throttle.ts`, `sweep.ts`, `credentials.ts`, `password-policy.ts`, `crypto.ts`,
`projections.ts`, `actor.ts`, `input.ts`, `origin.ts`, `log.ts`; `src/app/api/auth/signin/route.ts`;
`next.config.ts`; `vitest.config.mts`; `src/app/globals.css`.

**Structure Decision.** AGENTS.md's rules, followed exactly. `src/app` holds routing and pages only —
`/invite/accept` joins R1's existing `(auth)` group, whose layout is already the full-screen card
outside the shell that `FR-025` requires, so nothing about that frame is rebuilt. All behaviour lives
under `src/features/accounts/`, with its server-only modules under `server/`. `src/lib/mail.ts` is the
one promotion, made because the SMTP transport now has a real second use — which is the promotion rule
verbatim, not an anticipation of one.

`src/features/accounts/actions.ts` is the only module a Client Component imports server behaviour
from, and it carries top-level `"use server"`. The four `"use client"` modules are the toast region,
the connection banner, the screen shell and the modal; the tables and skeletons below them are
synchronous components taking plain props, which is what makes gate 1 reachable for a screen whose
data all arrives on the server. No barrel file mixes server and client exports.

## Complexity Tracking

Five items where the design does not sit cleanly inside a principle. Each is recorded so a reviewer
meets it here rather than discovering it in the diff.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **Five edits reach back into entry R1's delivered code** — `token-state.ts` extracted and `reset-tokens.ts` refactored onto it; `isUniqueViolation` promoted out of `bootstrap.ts`; the SMTP transport promoted to `src/lib/mail.ts`; `issueSession` given an optional executor; `SESSION_COOKIE_OPTIONS` extracted (I, and gate 7's "adjacent code is left untouched") | Each is Principle I's second call site arriving exactly as the principle describes, and one is a correctness argument rather than a tidiness one: §3.1 requires Accept invite and Change password to resolve tokens by "the same convention", and **used-beats-expired living in two places is how that stops being true**. `isUniqueViolation` unwraps `error.cause` because the `postgres` driver wraps its errors — a detail a copy gets wrong silently. `issueSession`'s parameter matches `deleteAllSessionsForUser`'s existing signature exactly. | *Duplicate each in `features/accounts`.* It buys a smaller diff and pays with two token-ordering rules, two `23505` detectors of differing correctness, and two SMTP configurations for one operator-supplied host. *Leave the transport in `auth/` and import across features.* A feature reaching into another feature's `server/` for infrastructure is the coupling the structure rules exist to prevent; `src/lib` is where AGENTS.md says a real second use goes. |
| **`accounts-screen.tsx` holds two concerns** — the selected tab **and** the highlighted account row (I) | `FR-008`'s control, as clarified, moves both at once: it closes the modal, switches the tab and marks a row, with no URL and no history entry. Both pieces of state are read by both panels, so they cannot be split without lifting them somewhere that is the same component by another name. | *An `href` to `/settings/accounts`.* §3.9 says the tab is "local page state, not a route — there is nothing to link to", and `FR-003` sends a reload back to Invitations, so the link would never reach the row it promised. *A query parameter carrying the row.* It gives the tab a route, contradicting §3.9, and puts an account id in a URL. |
| **`projectCount` is a literal `0`** (VI — it reads as a placeholder) | `FR-040` requires the column to be **rendered**, and the roadmap says the roster "reads `project_member` rows and reads zero until then". `project_member` is entry R5's table. The figure is required output, and this feature's test asserts that zero — R5 replaces the expression with a subquery without changing the DTO or this screen's contract. | *Omit the column until R5.* `FR-037` lists it among what each row must show, and omitting it means R5 decides the roster's shape rather than inheriting it. *Create `project_member` here.* It is R5's table, and creating it empty to count nothing widens R3's boundary. |
| **`react-aria-components` is pinned exactly, and the toast API is `UNSTABLE_`-prefixed** (IV — a built-in of an approved library, but not a stable one) | R2's `FR-034` requires toasts be "announced to assistive technology, which under `FR-030` means React Aria's toast region rather than a hand-rolled live region" — the component is required by the requirement, not chosen. At 1.20.0 those exports exist only as `UNSTABLE_ToastRegion`, `UNSTABLE_ToastQueue`, `UNSTABLE_Toast` and `UNSTABLE_ToastContent`. Pinning exactly means the API cannot move under the feature without a deliberate upgrade — the same move R2 made for `next@16.3.2` and `authInterrupts`. | *A hand-rolled `aria-live` region.* Contradicts `FR-034` and `FR-030` by name, and would reimplement queueing, focus management and the timer React Aria ships. *Keep the caret range.* A minor release renaming or stabilising the export breaks the build of a convention eleven later entries inherit. |
| **The toast type carries an `info` kind with no caller in this entry** (VI) | `FR-054` and R2's `FR-034` fix the set at four — success, info, warning and error — and R2 explicitly leaves info and warning "to the implementing entry's" assignment. This entry assigns warning to `FR-017`'s ungone mail and finds no honest use for info; shipping three kinds would make R4 or R5 invent the fourth's appearance. | *Ship three kinds and add info when something needs it.* The convention exists so eleven entries do not each decide what a toast looks like; two-thirds of a convention is the drift it was written to prevent. |

**Not recorded as a violation:** the two `<table>` elements built by hand rather than with React
Aria's `Table`. `FR-030` and `OT-UX-018` require React Aria where there is interaction behaviour to
supply, and a static list of rows has none — its controls are `Button`s and they are React Aria's.
Reaching for `Table` would import selection, sorting, resizing and cell navigation to render text.

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 26 decisions, three assumptions carried forward, no unknown outstanding |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, five items in Complexity Tracking |
| 2 — Tasks | [`tasks.md`](./tasks.md) | not started — run `/speckit-tasks` |
| Implementation | — | server side buildable now; **the screen is blocked on entry R2**, which is specified and planned but not built |
