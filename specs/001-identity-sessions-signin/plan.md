# Implementation Plan: Identity, sessions and sign-in

**Branch**: `claude/speckit-plan-common-layout-f1e57d` | **Date**: 2026-08-29 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/001-identity-sessions-signin/spec.md`](./spec.md),
roadmap entry **R1**, and the planning directive *"create a common layout for those screens"* —
the three unauthenticated surfaces [`design-brief.md`](./design-brief.md) names.

## Summary

R1 stands the installation up and lets an account holder in: five tables, one credential, sessions as
database rows behind an opaque sliding cookie, `loadActor()` on every request, a durable two-axis
throttle, the forgotten-password loop, first-run seeding, and two operator commands. It is the one
slice whose absence blocks all twelve.

The technical approach is the specification's own, taken literally: hand-written authentication with
no auth library, sign-in as a route handler at `POST /api/auth/signin` so the throttle and the origin
check sit in one place, everything else as Server Actions, and one `instrumentation.ts` `register()`
carrying both the first-run seed and the installation's only interval timer.

**The planning directive is answered by a route group.** The three unauthenticated screens move under
`src/app/(auth)/` and share one Server-Component `layout.tsx` that owns the page background, the
centred card and the app mark; each page owns its heading, its form and its states. Three call sites
exist on day one, so Principle I's two-call-site rule is met by fact rather than by anticipation, and
`OT-UX-001`'s "outside the shell" becomes structural rather than a rule three pages must remember —
R2's `(app)` group lands as a sibling and neither can leak into the other. The layout rests on the
smallest token set that will carry eleven later slices: a neutral scale, thirteen semantic colour
tokens, and **no** type-scale, spacing or dark-mode tokens, because Tailwind v4's built-ins already
cover the first two and the third is not a requirement the specification states.

Full reasoning in [`research.md`](./research.md); the layout and token contract in
[`contracts/auth-layout.md`](./contracts/auth-layout.md).

## Technical Context

**Language/Version**: TypeScript 7.0.2, `strict`, target ES2017, `moduleResolution: bundler`. No
`any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 + `postgres` 3.4.9, Tailwind CSS v4 (configured
in CSS), Biome 2.4.2.

**Dependencies this feature installs** — all three are pre-recorded in AGENTS.md's approved table, so
gate 4 is satisfied without an amendment: `@node-rs/argon2` (Argon2id), `nodemailer` (reset mail over
operator SMTP), `uuidv7` (time-ordered primary keys). Nothing outside that table is added; in
particular the password blocklist is repository data, not a package (research B-9).

**Storage**: PostgreSQL 18 via Drizzle. Five new tables; the inherited `setup_check` placeholder is
dropped in the same migration (research C-10).

**Testing**: Vitest 4.1.11 in two projects — `node` for server code, `jsdom` +
`@testing-library/react` for components (research D-1). Persistence tests run against a real
PostgreSQL instance on a separate database named by `TEST_DATABASE_URL`; no mock stands in for a
constraint, a lock or a cascade (research D-2).

**Target Platform**: self-hosted on a single box, Node.js runtime, operator-supplied SMTP.
Desktop-only browser surface, no breakpoints.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The one latency-relevant
knob is the Argon2id cost, fixed at OWASP's first recommended profile (research B-10). `SC-001` and
`SC-009` are human-time criteria — under ten minutes from empty box to signed-in admin, under three
minutes for the forgotten-password loop — not throughput targets.

**Constraints**: no auth library and no JWT (`OT-SEC-001`) · no CSRF token (`OT-SEC-009`) · nothing
about identity cached anywhere (`OT-SEC-008`) · exactly one in-process interval timer, no queue and
no external scheduler (`OT-OPS-003`) · exactly three public routes opened, the fourth left closed
until R3 (`OT-SEC-002`) · no route sets a role (`OT-AUTHZ-011`) · no dependency outside AGENTS.md's
table (IV).

**Scale/Scope**: one installation, one team under twenty people. 58 functional requirements, 5 user
stories, 5 tables, 3 screens plus 1 unmounted component, 1 route handler, 2 Server Actions, 2 CLI
commands.

**Unknowns**: none outstanding. The design brief's six open decisions and its neutral-scale gap are
resolved in [`research.md`](./research.md) §A. `/speckit-clarify` settled nine more on 2026-08-30 —
the reset-token lifetime, `APP_URL`, the throttle's window model, the seeding-refusal exit, the
sweep's scope, the 128-character password bound, the `TRUST_PROXY` rule for deriving a caller's
address, the refusal's units and the WCAG 2.2 AA conformance target — each now carried by a
functional requirement rather than an assumption. The
specification's remaining silences stand as the Assumptions [`spec.md`](./spec.md) records; research
adds three of its own (research, *Assumptions carried forward*). None blocks implementation.

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md); [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
holds governance and the version record (v1.0.0).

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | The shared layout has three confirmed call sites on day one, so it is extracted from fact, not anticipation. `accountUser` is defined with no caller in this slice — justified below. No component library ships; `MustChangePasswordBanner` is one component, not a set. | pass, with one entry in Complexity Tracking |
| **II** | Validated Input Boundaries | Every entry point validates on the server: the sign-in JSON body, both Server Actions, both CLI commands, the `token` query parameter, the `Origin` header, the `X-Forwarded-For` value written to `session.ip_address` — read at all only under `TRUST_PROXY` (`FR-016`) — the presented password's 128-character bound on the verification path as well as where a credential is set (`FR-026`), and `APP_URL` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` at startup. Blur-time checks in the browser are a UX affordance and never the control (`FR-027`). | pass |
| **III** | Straightforward Over Clever | No metaprogramming, no dynamic dispatch, no generic machinery. The two non-obvious mechanisms — a transaction-scoped advisory lock and `SELECT … FOR UPDATE` on the admin set — are PostgreSQL built-ins chosen over a retry loop, and each is documented against the requirement that forces it (research C-5, C-7). | pass |
| **IV** | Built-In Features Over Third-Party Libraries | Three dependencies, all pre-approved in AGENTS.md's table. Everything else is a built-in: `node:crypto` for tokens and digests, `node:util`'s `parseArgs` and `node:readline` for the CLI, `setInterval` for the sweep, `instrumentation.ts` for startup, a route group for the layout, and Tailwind v4's own type and spacing scales instead of custom tokens. The blocklist is a data file. | pass |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The one place a directive was tempting — a per-file `@vitest-environment` docblock — is replaced by two Vitest projects in config (research D-1). | pass |
| **VI** | No Dead Code | `setup_check` and the create-next-app placeholder page are removed (`FR-008`, research B-6), as is the starter's `prefers-color-scheme` block and its Arial `body` override (research A-3, A-9). Two items are delivered here whose production caller arrives in R2 and R3 — see Complexity Tracking. | pass, with two entries in Complexity Tracking |
| **VII** | Test-First (NON-NEGOTIABLE) | Every one of the spec's 42 acceptance scenarios is a Red step written before its implementation and observed failing for the intended reason. The concurrency scenarios (`FR-056` scenario 7, the racing-fifth-failure edge case) and every constraint-enforced invariant run against a real PostgreSQL instance, because a mock cannot fail them. | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence a reviewer reads |
| 2 | Minimal implementation, then refactor green | Scoped per task; no task adds a capability its scenario does not require |
| 3 | Server-side validation at every touched boundary | Principle II row above — nine boundaries enumerated |
| 4 | No unapproved dependency | Three installed, all already in AGENTS.md's table; nothing else |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principle V and VI rows above; the two exceptions are declared, not hidden |
| 7 | Every changed line traces to a requirement | Each file in the structure below names the FR or roadmap clause that puts it there |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. Note `--passWithNoTests` means a green run is not by itself evidence of gate 1 |

**Re-evaluation after Phase 1.** The design added no dependency, no abstraction with a single call
site beyond the two declared, and no comment. The one thing the design *changed* is that `accountUser`
is now defined in this slice with no caller — recorded below rather than dropped, because the read
boundary is one of the conventions R1 exists to establish and defining half of it invites the other
half to be invented twice in R3 and R4.

## Project Structure

### Documentation (this feature)

```text
specs/001-identity-sessions-signin/
├── spec.md                     the feature specification
├── design-brief.md             the visual brief the layout work answers
├── plan.md                     this file
├── research.md                 Phase 0 — 34 decisions, grouped A–D
├── data-model.md               Phase 1 — five tables, projections, invariants, DTOs
├── quickstart.md               Phase 1 — ten runnable validation walkthroughs
├── contracts/
│   ├── auth-layout.md          the shared layout, its tokens and its interaction rules
│   ├── http-and-actions.md     POST /api/auth/signin, the two Server Actions, the password policy
│   ├── server-contracts.md     loadActor, origin, throttle, crypto, touched, projections, bootstrap
│   ├── cli-admin.md            admin:grant and admin:deactivate
│   └── environment.md          every operator-supplied value
├── checklists/
│   └── requirements.md         existing
└── tasks.md                    Phase 2 — created by /speckit-tasks, not by this command
```

### Source code (repository root)

Only `src/app` and `src/db` exist today. Every path below is created or edited by this feature, and
each names why it exists.

```text
src/
├── app/
│   ├── layout.tsx                          EDIT — drop the Arial override so Geist applies (A-9)
│   ├── globals.css                         EDIT — neutral scale + semantic tokens; delete the
│   │                                              starter dark block (A-3, A-4)
│   ├── page.tsx                            REPLACE — / redirects to /home (B-6)
│   ├── provider.tsx                        unchanged
│   ├── (auth)/
│   │   ├── layout.tsx                      THE COMMON LAYOUT — Server Component (A-1, A-2)
│   │   ├── signin/page.tsx                 /signin                       FR-012
│   │   └── reset/page.tsx                  /reset and /reset?token=…     FR-030, FR-034
│   └── api/auth/signin/route.ts            POST /api/auth/signin         FR-010, §6
├── features/auth/
│   ├── actions.ts                          "use server" — the two reset actions
│   ├── components/
│   │   ├── sign-in-form.tsx                client — four states + in-flight   FR-012…FR-019
│   │   ├── reset-request-form.tsx          client                              FR-030…FR-033
│   │   ├── change-password-form.tsx        client — mismatch, policy, 3 token states  FR-034…FR-038
│   │   └── must-change-password-banner.tsx delivered here, mounted by R2     FR-049
│   └── server/
│       ├── actor.ts                        loadActor / requireActor      FR-020…FR-022
│       ├── origin.ts                       assertSameOrigin              FR-023
│       ├── throttle.ts                     the two-axis durable counter  FR-039…FR-043
│       ├── crypto.ts                       Argon2id + 32-byte tokens     FR-028, FR-029
│       ├── password-policy.ts              one policy, every entry point FR-026, FR-027
│       ├── common-passwords.txt            repository data, not a package (B-9)
│       ├── projections.ts                  publicUser / accountUser      FR-004
│       ├── sessions.ts                     issue, refresh, delete-all    FR-016…FR-018, FR-038
│       ├── reset-tokens.ts                 issue, resolve state, spend   FR-036, FR-037
│       ├── admin-guard.ts                  the active-admin row lock     FR-056
│       ├── bootstrap.ts                    seed + the sweep timer        FR-044…FR-048
│       └── mail.ts                         the reset link over SMTP      FR-033, FR-058
├── db/
│   ├── schema.ts                           EDIT — five tables in, setup_check out  FR-001…FR-008
│   ├── touched.ts                          the one updated_at helper     FR-003
│   └── index.ts                            unchanged
├── instrumentation.ts                      register() — validate, seed, start the timer
└── proxy.ts                                fast unauthenticated redirect, NOT authorization (B-3)

scripts/
├── admin-grant.ts                          npm run admin:grant           FR-051…FR-053
└── admin-deactivate.ts                     npm run admin:deactivate      FR-054, FR-056

drizzle/                                    the generated migration + metadata, committed
vitest.config.ts                            EDIT — two projects, node and jsdom (D-1)
package.json                                EDIT — three deps, two admin scripts
```

**Structure Decision.** One Next.js project under `src/`, following AGENTS.md's structure rules
exactly: `src/app` holds routing, layouts, pages and route handlers **only**; all business behaviour
lives in `src/features/auth/`, with server-only code under its `server/` directory. Nothing is
promoted to `src/components/shared` or `src/lib` — Principle I requires a real second use, and this
is the first slice. `src/components/ui` is not created: the interaction primitives come from
`react-aria-components` directly, and wrapping them before a second consumer exists is the
speculative abstraction the roadmap's §1.1 explicitly warns R2 against.

`src/features/auth/actions.ts` is the only module a Client Component imports server behaviour from,
and it carries top-level `"use server"`. No barrel file mixes server and client exports.

## Complexity Tracking

Three items where the design does not sit cleanly inside a principle. Each is a consequence of the
roadmap's slicing, not of a choice made here; each is recorded so a reviewer meets it in the plan
rather than discovering it in the diff.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **`MustChangePasswordBanner` ships with no production caller** (VI) | `FR-049` and §6 place the flag, the banner and the seeding that sets the flag in R1, and place the shell slot that hosts it in R2. The banner is delivered with a component test asserting its content and that it offers no dismiss control. | *Defer the banner to R2.* It would split one requirement across two slices and leave R1's seeded admin with a flag nothing surfaces — the specification is explicit that R1 delivers the banner. *Mount it on `/signin`.* It is an advisory for **authenticated** screens; putting it on a public route would state an account's condition to an unauthenticated caller, which `OT-SEC-018` forbids outright. |
| **`accountUser` is defined with no caller** (I) | `FR-004` and `OT-DATA-005` make the two-projection read boundary one of the conventions R1 establishes for the whole product. Its callers are R3's Accounts screen and R4's Profile. | *Define only `publicUser` now.* The boundary's whole value is that it is one rule; shipping half of it means R3 and R4 each invent the contact-field projection, which is the drift `OT-DATA-005` exists to prevent. The alternative saves four lines and costs the convention. |
| **`user` gains five columns this slice never reads or writes** — `avatar_url`, `job_title`, `slack_handle`, `phone`, `bio`, plus `feed_filter` (VI, I) | §5 defines them as `user` key fields and R1 owns the table. Adding them later means a migration per slice against a table every slice depends on. | *Add each column with the slice that uses it.* Six migrations to reach the shape §5 already specifies, each one editing the product's most-depended-upon table. The columns are nullable and defaulted, so nothing depends on them being unused. |

**Not recorded as a violation:** the sign-in route handler's departure from "Server Actions for this
application's mutations". AGENTS.md names it as the single exception, and the specification pins it
(§6). It is the rule, not a deviation from it.

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — every unknown resolved, three assumptions carried forward |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, three items in Complexity Tracking |
| 2 — Tasks | `tasks.md` | **not created by this command** — run `/speckit-tasks` |
