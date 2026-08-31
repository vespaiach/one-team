# Implementation Plan: Profile

**Branch**: `claude/specs-004-profile-summary-a4d748` | **Date**: 2026-08-30 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/004-profile/spec.md`](./spec.md) and roadmap entry
**R4**, whose scope boundary this plan does not widen.

## Summary

R4 is one screen, one read and one write. `/profile` — R2's guard-only route, filled — renders nine
values from the caller's own row: seven edited in place, two shown and never editable. Behind them
sits `updateOwnProfile`, a Server Action taking one field name and one value, requiring only self.
Beside them sits a link that presses R1's reset flow without asking for an address. **No table, no
column, no migration** — `FR-037` states that as a requirement, and a plan that generated one would
have left the boundary.

The technical approach is mostly React 19's and the framework's own, because the two hardest
requirements answer to hooks rather than to code. `useOptimistic` with `useTransition` gives `FR-014`
and `FR-015` together: the optimistic value reverts to the server-rendered prop when the transition
ends, so a refusal that returns without revalidating *is* the rollback, and it lands on precisely
"the value the server holds" — `FR-015`'s own wording — with no hand-written revert path to get
wrong. One `useOptimistic` per field makes `FR-015`'s "only the field that failed" structural rather
than a rule to remember. And `FR-032`'s re-query is the client cache's `dynamic` stale time of `0`,
which this entry gets by configuring nothing.

**Three decisions shape everything else.** The unchanged-value check of `FR-016` lives **inside the
write statement** — the `WHERE` pins the caller's id and requires the column to be `IS DISTINCT FROM`
the incoming value — because AGENTS.md's concurrency rule says a read followed by a write is not
protection, and because `<>` is unknown against `NULL`, which would silently skip every clear on five
nullable columns. The action **returns a typed refusal and never throws for an expected failure**,
because a Server Function that throws inside a transition goes to the nearest error boundary, and a
rejected avatar scheme is an inline error on a field, not a replaced screen. And the four
cross-cutting conventions **divide two and two**, on the roadmap's own attribution rather than on
build order: the skeleton and the re-query are per-screen work authored here, while the message host
and the connection banner are single instances entry R3 builds and mounts as the entry holding their
first caller — so this entry consumes both and builds neither.

Full reasoning in [`research.md`](./research.md) — twenty-eight decisions, groups A–E. The screen in
[`contracts/profile-screen.md`](./contracts/profile-screen.md), the write in
[`contracts/update-own-profile.md`](./contracts/update-own-profile.md), the link in
[`contracts/change-password-link.md`](./contracts/change-password-link.md), and the four conventions
in [`contracts/ux-conventions.md`](./contracts/ux-conventions.md).

## Technical Context

**Precondition — entry R1 is implemented; entry R2 is not.** R1 landed across seven phases and the
tree carries it: `loadActor()`, `requireActor()`, `Actor`, the `publicUser` and `accountUser`
projections, `touched()`, `assertSameOrigin()`, `issueResetToken()`, `sendPasswordResetMail()`,
`assertNotThrottled()` with its `flow` discriminator, `deleteAllSessionsForUser()`,
`assertPasswordPolicy()`, `proxy.ts`, the token set in `globals.css` and the two Vitest projects.
R2 has not: `src/app/(app)/` does not exist, so there is no shell, no `/profile` route to fill, no
`ScreenHeader` to compose and no banner region. This plan is complete and `/speckit-tasks` can be run
against it, but **implementation is blocked until R2 lands**. Every decision that edits an R2 file is
written against R2's plan and contracts, not against code.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, Drizzle ORM 0.45.2, Tailwind CSS v4 configured in CSS, Biome 2.4.2.

**Dependencies this feature installs**: **none.** Gate 4 is satisfied trivially. Every library it
touches is already in AGENTS.md's approved table. The avatar's URL check is the Web platform's `URL`,
and the optimistic write is React's own hook — two places a dependency would have been the obvious
reach and a built-in answered instead (IV).

**Configuration this feature changes**: **none.** `next.config.ts`, `vitest.config.mts`,
`drizzle.config.ts`, `biome.json`, `tsconfig.json` and `package.json` are all untouched — the version
range of `react-aria-components` included. The `UNSTABLE_` Toast exports behind the message host are
adopted by entry R3, not here; this entry calls the queue R3 stands up
([`research.md`](./research.md) D-3).

**Storage**: PostgreSQL 18 via Drizzle. **No table, no column, no migration** (`FR-037`).
`src/db/schema.ts` is untouched and `drizzle/` gains no file. The feature's only writes are one
`UPDATE` of one column of one `user` row, and — through R1's unchanged modules — one `auth_attempt`
row and one `reset_token` row per change-password press.

**Testing**: Vitest 4.1.11 in R1's two projects — `server` (node) for the action, the parsers and the
query, against the real PostgreSQL instance `TEST_DATABASE_URL` names; `ui` (jsdom, Testing Library)
for every component. No async Server Component is rendered by a test, because the framework's own
guide states Vitest does not support them and this repository has no E2E runner and cannot add one
(IV) — so `page.tsx` stays a thin wrapper and every assertion lands below it
([`research.md`](./research.md) A-4, E-4).

**Target Platform**: self-hosted on a single box, Node.js 20 runtime — which is why the avatar check
uses `URL.canParse`, available since 18.17, rather than `URL.parse`, which needs 22.1
([`research.md`](./research.md) C-2). Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The screen adds one query
per request and the write touches one row.

**Constraints**: no route, parameter or control anywhere in the product may reach another user's
record (`FR-002`, `SC-004`) · authorization is self only, with neither predicate gating the mutator
(`FR-018`, `OT-AUTHZ-001`) · the row is derived from the session, never from a client-supplied
identifier (`FR-019`, `OT-AUTHZ-004`) · the read goes through `accountUser` and never selects `user`
directly (`FR-003`, `OT-DATA-005`) · exactly seven fields are writable and `role`, `email`,
`must_change_password` and `feed_filter` are not among them (`FR-021`, `OT-AUTHZ-011`) · the bio is
plain text and is never parsed as markup (`FR-009`, `OT-DATA-016`) · the avatar's scheme is an
allowlist of two, never a denylist (`FR-011`) · no optional field is ever stored as an empty string
(`FR-012a`) · no activity row and no notification for anybody (`FR-036`, `SC-005`) · no password field
and no restatement of the password policy (`FR-027`, `OT-SEC-004`) · no new dependency (IV) · no
migration (`FR-037`).

**Scale/Scope**: one installation, one team under twenty people. 40 functional requirements, 5 user
stories, 42 acceptance scenarios, 16 edge cases, 12 success criteria, 9 modules created, 3 edited and 1
moved, 1 Server Action added here and 1 added to R1's module, 0 tables.

**Unknowns**: none outstanding. Four questions were closed across three `/speckit-clarify` sessions,
and the spec's *Assumptions* settles the rest. Research adds three of its own
([`research.md`](./research.md), *Assumptions carried forward*): a browser Back may restore a
remembered tree, the empty avatar renders the display name alone, and no referrer posture is set for
the third-party image. None blocks implementation.

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | Nine modules, each with one concern, all in `src/features/profile`, plus one rule promoted to `src/lib`. One in-place editing control serves all seven fields — seven call sites on day one, not a guess at a second. Nothing is promoted to `src/components/ui` or `src/lib` except `display-name.ts`, which R2 built with one caller and named this entry as its second. Two extractions were available and both were **declined**: a shared reset helper across the two request paths, and a shared write primitive with R3 — each would abstract over a difference rather than a shared shape. | pass, with two entries in Complexity Tracking |
| **II** | Validated Input Boundaries | Two server entry points, and each is checked. `updateOwnProfile` asserts the origin, derives the row from the session, rejects a field outside the seven, trims, then applies presence, the bound and the scheme — rejecting rather than coercing or truncating. `requestOwnPasswordReset` asserts the origin and reads its subject's address from the session-resolved row, never from an argument. The browser's own checks are affordances and are re-derived server-side, which `SC-010` makes explicit by requiring the avatar refusal to hold when the action is called directly. | pass |
| **III** | Straightforward Over Clever | No metaprogramming, no dynamic dispatch, no generic machinery. The seven fields are a table of plain data, not a schema builder. The unchanged check is one SQL predicate rather than a diffing layer. The one place cleverness was available — folding the two reset request paths together behind a flag — was rejected for a second readable function. | pass |
| **IV** | Built-In Features Over Third-Party Libraries | No dependency is added and no version range is edited. Two obvious reaches for a library are answered by built-ins: URL validation by the Web platform's `URL`, and optimistic state by React's own `useOptimistic`. The message host this screen raises into is React Aria's and is entry R3's to build. | pass |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The three places a reader will want an explanation — why the empty check runs before the scheme check, why the update carries `IS DISTINCT FROM`, and why the two reset actions are not one — are answered by the contracts, not by annotation. | pass |
| **VI** | No Dead Code | Every module has a caller in this entry. No field, refusal reason or component is added for a later entry. | pass |
| **VII** | Test-First (NON-NEGOTIABLE) | All 42 acceptance scenarios are Red steps written before their implementation, and every functional requirement carries at least one. Two are proved **negatively and structurally** rather than behaviourally — `FR-002`'s "no route exists" and `FR-027`'s "no control accepts a password" — in the idiom `src/features/auth/role-surface.test.ts` already established for `OT-AUTHZ-011`. `FR-027` deliberately does **not** re-assert the password policy: that test exists at `src/features/auth/server/password-policy.test.ts` and is R1's. | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. The runner cannot render async Server Components, so `page.tsx` stays a wrapper and every assertion lands on a synchronous component, a parser or the action ([`research.md`](./research.md) A-4, E-4) |
| 2 | Minimal implementation, then refactor green | Scoped per task. The action does one column; the field control does one field; no component takes a prop its scenario does not require |
| 3 | Server-side validation at every touched boundary | Principle II row above. Both server entry points check the origin, derive their subject from the session, and validate every value they receive |
| 4 | No unapproved dependency | None installed, and no version range edited |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above |
| 7 | Every changed line traces to a requirement | Each file in the structure below names the FR that puts it there |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not by itself evidence of gate 1 |

**Re-evaluation after Phase 1.** The design added no dependency, no configuration change, no
migration and no comment. One thing it *settled* rather than added: `display-name.ts` moves out of
`src/features/shell` at its second caller, which is a reach-back into an R2 file that R2's own plan
anticipates by name. It is recorded below rather than left for the diff.

## Project Structure

### Documentation (this feature)

```text
specs/004-profile/
├── spec.md                          the feature specification
├── plan.md                          this file
├── research.md                      Phase 0 — 28 decisions, groups A–E
├── data-model.md                    Phase 1 — no table; the row read, the column written, the DTO
├── quickstart.md                    Phase 1 — twelve runnable walkthroughs
├── contracts/
│   ├── profile-screen.md            the route, the nine values, in-place editing, the skeleton
│   ├── update-own-profile.md        the one mutator — order of operations, refusals, bounds
│   ├── change-password-link.md      the press, the second reset action, and OT-SEC-004's two proofs
│   └── ux-conventions.md            which of R2's four this entry authors and which it consumes
├── checklists/
│   └── requirements.md              existing
└── tasks.md                         Phase 2 — created by /speckit-tasks, not by this command
```

### Source code (repository root)

Every path below is created or edited by this feature, and each names why it exists.

```text
src/
├── app/
│   └── (app)/
│       └── profile/page.tsx                    EDIT (R2's) — guard, query, header, Suspense
│                                                    FR-001, FR-003, FR-005, FR-031
├── features/
│   ├── profile/
│   │   ├── actions.ts                          NEW — "use server"; updateOwnProfile
│   │   │                                            FR-018…FR-023
│   │   ├── fields.ts                           NEW — the seven names, labels and bounds
│   │   │                                            FR-006, FR-020
│   │   ├── server/
│   │   │   ├── queries.ts                      NEW — accountUser read → ProfileRecord
│   │   │   │                                        FR-003, OT-DATA-005
│   │   │   └── input.ts                        NEW — trim, presence, bound, avatar scheme
│   │   │                                            FR-007, FR-011, FR-012, FR-012a, FR-020
│   │   └── components/
│   │       ├── profile-screen.tsx              NEW — the nine values, in §3.12's order
│   │       │                                        FR-006, FR-024
│   │       ├── profile-skeleton.tsx            NEW — the same layout, unfilled           FR-031
│   │       ├── editable-field.tsx              NEW — "use client"; press, edit, Escape,
│   │       │                                        blur, ⌘-enter, optimistic save
│   │       │                                        FR-013…FR-017, FR-035
│   │       ├── shown-value.tsx                 NEW — email and role, not controls        FR-024
│   │       └── change-password-link.tsx        NEW — "use client"; the one press
│   │                                                FR-026, FR-028, FR-029
│   ├── shell/
│   │   └── components/
│   │       └── user-chip.tsx                   EDIT (R2's) — import the join rule from
│   │                                                its new address                      FR-004
│   └── auth/
│       └── actions.ts                          EDIT (R1's) — add requestOwnPasswordReset
│                                                    FR-026, FR-028
└── lib/
    └── display-name.ts                         MOVED from src/features/shell/ at its
                                                     second caller                       FR-004
```

Untouched and named so: `src/db/schema.ts`, `drizzle/`, `src/features/auth/server/` in its entirety,
`src/app/(auth)/`, `src/app/api/`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/provider.tsx`, `src/app/globals.css`,
`proxy.ts`, `next.config.ts`, `vitest.config.mts`, `package.json`.

**Structure Decision.** AGENTS.md's rules, followed exactly. `src/app` holds routing, layouts and
pages only — the two files it touches are R2's and gain no domain logic. All behaviour lives under
`src/features/`, split between the new `profile/` feature, one import fix in R2's `shell/` feature,
and one addition to R1's `auth/` feature which owns the reset mechanism. The message host and the
connection banner live in `shell/` too, but they are entry R3's to build and to mount; this entry
imports the queue and renders beneath the banner.

Server-only code sits under each feature's `server/` directory. `src/features/profile/actions.ts` is
the only module a Client Component imports server behaviour from in this feature, and it carries
top-level `"use server"`; `src/features/auth/actions.ts` already does. `fields.ts` deliberately
imports nothing server-only, so the client can render a field's label and bound without reaching
across the boundary. No barrel file mixes server and client exports.

**Test files are not listed above.** Each is colocated beside the module it covers and named by it —
`fields.test.ts` beside `fields.ts`, `editable-field.test.tsx` beside `editable-field.tsx`, and R2's
own `user-chip` test extended where the join rule's address changes. Two cover a tree rather than a
module and so has no neighbour: `src/features/profile/profile-surface.test.ts`, structural, in the idiom
`src/features/auth/role-surface.test.ts` established for `OT-AUTHZ-011`. [`tasks.md`](./tasks.md)
names every one.

Two modules carry `"use client"` — the field control and the change-password link. Each is the
narrowest boundary that makes its interaction work. R2
established why the application has to draw that boundary itself: React Aria's exports import
`client-only` without carrying their own `"use client"` directive, so a Server Component importing
one fails the build rather than the boundary being inferred.

## Complexity Tracking

Two items where the design does not sit cleanly inside a principle. Each is recorded so a reviewer
meets it here rather than discovering it in the diff. Two more were recorded while this entry still
built the message host and the connection banner; the roadmap gives both to entry R3, so they are
that entry's to justify and are no longer listed here.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **The length bounds are stated twice** — in `fields.ts` and as `CHECK` constraints in `src/db/schema.ts` (VI, III) | The two do different jobs. The `CHECK` is the invariant against any writer, present or future. The parser is the boundary Principle II requires, and it is what turns a 201-character job title into the inline error `FR-017` asks for instead of a constraint violation surfacing as a generic failure. `FR-014`'s edge case names the pair directly: at the bound it saves, one past it the **server** refuses, whatever the browser allowed. | *Parse only, and drop the `CHECK`s.* They are R1's and this entry writes no migration; removing them would also make the bound only as good as the code path. *Constrain only, and let the database refuse.* Then every over-long value is a 500 with no field to attach an error to, and `FR-020`'s "reject rather than coerce" becomes a stack trace. |
| **`display-name.ts` moves out of `src/features/shell` into `src/lib`** (a reach-back into an inherited module) | `FR-004` and `OT-UX-019` require the one join rule wherever a display name renders, and this screen is its second surface. R2's own plan names the moment: "`display-name.ts` has one call site today, and Principle I extracts at the second — R3's roster or R4's profile makes that promotion." Leaving it under `shell/` would have the profile feature import from another feature's internals. | *Copy the two-line rule into the profile feature.* Two implementations of "everywhere in the app" is the drift `OT-UX-019` exists to prevent. *Leave it where it is and import across features.* AGENTS.md promotes to `src/lib` at the real second use, which is exactly what this is. |

**Not recorded as a violation:** one editing control serving seven fields. Principle I extracts at the
second call site, and this has seven on the day it lands — all inside the feature that owns them.

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 28 decisions, three assumptions carried forward, no unknown outstanding |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, four items in Complexity Tracking |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — 47 tasks in 8 phases, one per user story |
| Implementation | — | **blocked on entry R2**, which is specified and planned but not built. Entry R1, the other dependency, has landed |
