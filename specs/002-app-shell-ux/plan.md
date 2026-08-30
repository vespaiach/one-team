# Implementation Plan: Application shell and cross-cutting UX

**Branch**: `claude/roadmap-entry-r2-spec-c50ee4` | **Date**: 2026-08-30 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/002-app-shell-ux/spec.md`](./spec.md) and roadmap entry
**R2**, whose scope boundary this plan does not widen.

## Summary

R2 builds a frame, not a feature. One route group, `src/app/(app)/`, whose layout is a 262px sidebar,
a banner slot and a content region; a header each page composes for itself; the Forbidden screen and
the "This doesn't exist" wording; thirteen routes registered with the authorization guard §3's Access
column implies; and one write — the sign-out control R1 delivered the session deletion for. Eleven of
the twelve remaining entries render inside what this one produces.

The technical approach is mostly the framework's own, because Next.js 16 answers three of the
requirements directly and better than anything written by hand. `forbidden()` with a segment-level
`forbidden.tsx` gives `FR-019` and `FR-020` — inside the shell, at the URL that refused, with a real
`403` — through an interrupt a later route author cannot forget to `return`, at the cost of one
experimental config flag on an exactly pinned version. `notFound()` with two boundaries and one
shared notice gives `FR-022` its single wording. A route group gives `FR-004` structurally, exactly as
R1's `(auth)` group does from the other side.

**Three decisions shape everything else.** The header is composed by the **page**, not the layout,
because a layout cannot receive a per-screen title and because `FR-019` requires the refusing route
to show *Forbidden's* title rather than the refused screen's — a layout-owned header would show the
wrong one. Authorization runs in the **page**, never the layout, because R1's contract says a check
in a layout is not a check; the layout reads the same actor for presentation only, which is `FR-015`
in the spec's own words. And every async Server Component is a thin wrapper over a **synchronous**
component taking plain props, because the framework's own testing guide states that Vitest cannot
render async Server Components — and this repository has no E2E runner and cannot add one (IV), so
that constraint, not taste, fixes the component boundaries that make change gate 1 reachable.

Full reasoning in [`research.md`](./research.md) — twenty-four decisions, groups A–D. The frame in
[`contracts/app-shell.md`](./contracts/app-shell.md), the guards in
[`contracts/route-surface.md`](./contracts/route-surface.md), the one write in
[`contracts/sign-out.md`](./contracts/sign-out.md), and what R3–R12 inherit in
[`contracts/ux-conventions.md`](./contracts/ux-conventions.md).

## Technical Context

**Precondition — entry R1 is not implemented yet.** The tree today holds `src/app` and `src/db` and
nothing else; every module this feature consumes is R1's and does not exist: `loadActor()`,
`requireActor()`, `Actor`, `assertSameOrigin()`, the `session` table and its deletion,
`MustChangePasswordBanner`, `proxy.ts`, the token set in `globals.css`, and the two Vitest projects.
This plan is complete and `/speckit-tasks` can be run against it, but **implementation is blocked
until R1 lands**. Nothing below assumes otherwise.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, Tailwind CSS v4 configured in CSS, Biome 2.4.2.

**Dependencies this feature installs**: **none.** Gate 4 is satisfied trivially. The one library it
uses, `react-aria-components`, is already installed and already in AGENTS.md's approved table; links
come from `next/link`, a framework built-in (IV, [`research.md`](./research.md) B-4).

**Configuration this feature changes**: `next.config.ts` gains `experimental: { authInterrupts: true }`
— a flag, not a dependency — and `vitest.config.mts` gains the environment variable that flag sets at
runtime, without which every Forbidden test fails for the wrong reason
([`research.md`](./research.md) A-4, D-2).

**Storage**: PostgreSQL 18 via Drizzle. **No table, no column, no migration.** `src/db/schema.ts` is
untouched. The only database operation in the feature is sign-out deleting one `session` row.

**Testing**: Vitest 4.1.11 in R1's two projects — `node` for route guards and the one action, `jsdom`
with `@testing-library/react` for every component. The single persistence test runs against the real
PostgreSQL instance `TEST_DATABASE_URL` names. No async Server Component is rendered by a test; see
[`research.md`](./research.md) D-1 for what that costs and why the component boundaries follow it.

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The shell adds no query:
`loadActor()` is wrapped in React's `cache()`, so the layout and the page below it share the one
query the request needed anyway.

**Constraints**: no responsive layout and no breakpoint at any width, with 1280px as the minimum
before the page scrolls horizontally (`OT-SCOPE-004`) · exactly thirteen screens answer and nothing
else (`OT-SCOPE-007`) · no route outside the authenticated group is opened, so `OT-SEC-002`'s four
public routes stay three until R3 · admin navigation is hidden and never disabled (`OT-UX-003`),
while the member-only case is the opposite rule (`OT-UX-021`) · hiding is never the enforcement
(`OT-AUTHZ-005`) · nothing about identity is cached anywhere (`OT-SEC-008`) · no dependency outside
AGENTS.md's table (IV) · no component library (I, roadmap §1.1).

**Scale/Scope**: one installation, one team under twenty people. 35 functional requirements, 4 user
stories, 35 acceptance scenarios, 14 success criteria, 13 screens across 10 routes registered here, 8 components, 1 Server Action,
0 tables.

**Unknowns**: none outstanding. The specification's silences are settled in the spec's own
*Assumptions*, and ten questions were closed across two `/speckit-clarify` sessions. Research adds
three of its own ([`research.md`](./research.md), *Assumptions carried forward*): `/home` has no
heading until R12 supplies its content, the not-found screen renders no header, and the sidebar
scrolls internally when the project list outgrows it. None blocks implementation.

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | Eight components, each with one concern; the shell layout is split from `AppShell` because the async half cannot be tested, not because it was large. No shared primitive is extracted and `src/components/ui` is not created — the roadmap's §1.1 says R2 ships no component library. `NotFoundNotice` is the one component with two call sites, and both exist on day one. | pass, with one entry in Complexity Tracking |
| **II** | Validated Input Boundaries | Three server entry points, and each is checked. Every page calls `requireActor()` and then its own Access-column predicate — hiding a link is never the control (`FR-014`, `FR-015`). `signOut` asserts the origin first and derives its subject from the request's own cookie, never from an argument. The feature accepts no user-supplied value at all: no form field, no query parameter, no body — which is what makes gate 3 small here rather than absent. | pass |
| **III** | Straightforward Over Clever | No metaprogramming, no dynamic dispatch, no generic machinery. Direction is handled by DOM order under a flex row rather than logical-property utilities; horizontal scroll is a `min-width` rather than an overflow rule; the parallel-route header and the catch-all not-found route were both rejected as indirection twelve entries would pay for. | pass |
| **IV** | Built-In Features Over Third-Party Libraries | No dependency is added. Links are `next/link`, the refusals are `forbidden()` and `notFound()`, the frame is a route group, and the sign-out control is a form post — all built-ins. React Aria supplies the one control that is not a link, per `FR-030`. | pass |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The two places a reader will want an explanation — why the layout reads an actor it does not check, and why nine routes contain only a guard — are answered by the contracts, not by annotation. | pass |
| **VI** | No Dead Code | The nine guard-only routes are `FR-029`'s implementation, not placeholders, and each carries a test. The layout's no-actor branch is reachable and asserted. Three header props have no occupant in this entry and their absent behaviour is required and tested — declared below rather than hidden. | pass, with two entries in Complexity Tracking |
| **VII** | Test-First (NON-NEGOTIABLE) | All 35 acceptance scenarios are Red steps written before their implementation. Six functional requirements carry no test **by the spec's own design** — `FR-013`, `FR-023`, `FR-032`…`FR-035` — because this entry has no surface or caller for them; each says so inline, the roadmap records the same reconciliation, and gate 1 asks for no test the entry cannot write. The count is six and not eight because the route guards ship here, which is what gives `FR-019` and `FR-020` a reachable caller. | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. The runner cannot render async Server Components, so the decomposition puts every assertion in a synchronous component or a thrown interrupt ([`research.md`](./research.md) D-1) |
| 2 | Minimal implementation, then refactor green | Scoped per task. No route file does more than guard and interrupt; no component takes a prop its scenario does not require |
| 3 | Server-side validation at every touched boundary | Principle II row above. Every page checks the actor and its own predicate; `signOut` checks the origin and reads its subject from the cookie. The feature accepts no user-supplied value |
| 4 | No unapproved dependency | None installed. The two config changes are flags, not packages |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above; the two exceptions are declared, not hidden |
| 7 | Every changed line traces to a requirement | Each file in the structure below names the FR that puts it there |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not by itself evidence of gate 1 |

**Re-evaluation after Phase 1.** The design added no dependency, no shared abstraction beyond the one
with two same-day call sites, and no comment. Two things it *changed*: `Actor` gains `avatarUrl` and
`mustChangePassword`, which R1 defined it without and the spec's *Key Entities* requires — recorded
below because it is a reach-back into an inherited contract; and `experimental.authInterrupts` is
turned on, which is a deliberate adoption of an experimental framework API rather than an oversight,
also recorded below.

## Project Structure

### Documentation (this feature)

```text
specs/002-app-shell-ux/
├── spec.md                     the feature specification
├── plan.md                     this file
├── research.md                 Phase 0 — 24 decisions, grouped A–D
├── data-model.md               Phase 1 — no table; the actor read, the row deleted, the props passed
├── quickstart.md               Phase 1 — eleven runnable walkthroughs
├── contracts/
│   ├── app-shell.md            the frame, its tokens, its structure and its interaction rules
│   ├── route-surface.md        every route, its guard, its interrupt and the entry that fills it
│   ├── sign-out.md             the one Server Action and the one control
│   └── ux-conventions.md       what R3–R12 inherit, implemented and stated alike
├── checklists/
│   └── requirements.md         existing
└── tasks.md                    Phase 2 — created by /speckit-tasks, not by this command
```

### Source code (repository root)

Every path below is created or edited by this feature, and each names why it exists.

```text
src/
├── app/
│   ├── not-found.tsx                       NEW — unmatched URL, root layout only     FR-022
│   ├── globals.css                         EDIT — one token, --color-text-muted-on-page
│   └── (app)/
│       ├── layout.tsx                      THE SHELL — sidebar, banner slot, content
│       │                                        FR-001…FR-003, FR-009, FR-010, FR-025…FR-027
│       ├── forbidden.tsx                   §3.11 inside the shell        FR-019, FR-020
│       ├── not-found.tsx                   the same wording, in the shell            FR-022
│       ├── home/page.tsx                   /home — the headerless exception          FR-003
│       ├── profile/page.tsx                guard only, filled by R4                  FR-029
│       ├── notifications/page.tsx          guard only, filled by R11                 FR-029
│       ├── projects/
│       │   ├── new/page.tsx                admin guard, filled by R5      FR-019, FR-029
│       │   └── [projectKey]/
│       │       ├── page.tsx                guard only, filled by R10                 FR-029
│       │       ├── details/page.tsx        guard only, filled by R5                  FR-029
│       │       └── issues/
│       │           ├── new/page.tsx        guard only; the member half is R5's       FR-029
│       │           └── [issueNumber]/details/page.tsx   guard only, filled by R6     FR-029
│       └── settings/
│           ├── accounts/page.tsx           admin guard, filled by R3      FR-019, FR-029
│           └── labels/page.tsx             admin guard, filled by R8      FR-019, FR-029
├── features/
│   ├── shell/
│   │   ├── components/
│   │   │   ├── app-shell.tsx               the frame            FR-001, FR-002, FR-009, FR-010
│   │   │   ├── sidebar.tsx                 the entries    FR-005, FR-006, FR-011, FR-012, FR-031
│   │   │   ├── project-list-region.tsx     the quiet empty line                      FR-024
│   │   │   ├── user-chip.tsx               display name + avatar            FR-017, FR-018
│   │   │   ├── sign-out-control.tsx        "use client" — the one React Aria control FR-018
│   │   │   ├── screen-header.tsx           title block + two empty slots    FR-007, FR-008
│   │   │   ├── forbidden-notice.tsx        code, one sentence, route Home            FR-019
│   │   │   └── not-found-notice.tsx        one wording, two mounts                   FR-022
│   │   └── display-name.ts                 first + " " + last                        FR-017
│   └── auth/
│       ├── actions.ts                      EDIT (R1's) — add signOut                 FR-018
│       └── server/
│           ├── actor.ts                    EDIT (R1's) — Actor gains avatarUrl and
│           │                                             mustChangePassword   FR-017, FR-026
│           └── sessions.ts                 EDIT (R1's) — the single-session delete   FR-018

next.config.ts                              EDIT — experimental.authInterrupts        FR-019
vitest.config.mts                           EDIT — __NEXT_EXPERIMENTAL_AUTH_INTERRUPTS
```

Untouched and named so: `src/db/schema.ts`, `drizzle/`, `src/app/layout.tsx`, `src/app/page.tsx`,
`src/app/provider.tsx`, `src/app/(auth)/`, `proxy.ts`, `src/instrumentation.ts`, `package.json`.

**Structure Decision.** AGENTS.md's rules, followed exactly. `src/app` holds routing, layouts, pages
and the two interrupt files **only** — no domain module lives there. All behaviour lives under
`src/features/`, split between the new `shell/` feature and the three edits to R1's `auth/` feature,
which owns the session and therefore owns its deletion. Nothing is promoted to
`src/components/shared` or `src/lib`: `display-name.ts` has one call site today, and Principle I
extracts at the second — R3's roster or R4's profile makes that promotion.

`src/features/auth/actions.ts` remains the only module a Client Component imports server behaviour
from, and it carries top-level `"use server"`. `sign-out-control.tsx` is the feature's only
`"use client"` module — every React Aria export except twelve imports `client-only` and none carries
its own directive, so the boundary has to be drawn by the application, and this is the narrowest
place to draw it. No barrel file mixes server and client exports.

## Complexity Tracking

Four items where the design does not sit cleanly inside a principle. Each is recorded so a reviewer
meets it here rather than discovering it in the diff.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **Nine `page.tsx` files whose whole body is a guard and an interrupt** (VI) | `FR-029` and `SC-014` require every route to decide whether the caller may be there before reporting whether anything is there. Without them, all three admin-only routes answer nothing, Forbidden has no reachable caller, and `FR-019`, `FR-020` and four acceptance scenarios ship untested on a screen the roadmap lists inside R2. | *Register a route when its screen lands.* It is what the spec's own reconciliation rejected: it would make the six requirements without tests eight, two of them by accident. *Register the routes without guards.* Then a member gets "This doesn't exist" for Accounts, which is a different answer from the one `FR-019` requires and quietly teaches every later entry the wrong order. |
| **The header's three slots have no occupant in this feature** — `context`, `control`, `newIssue` (VI, I) | `FR-007` requires the header to carry a title block, exactly one per-screen control slot and a New issue slot; `FR-008` says the last renders only on a project-scoped screen, and this feature delivers none. What the feature implements and tests is the **absent** case: US1 scenarios 5 and 6 assert that each renders nothing rather than a placeholder. | *Add the props with R5.* The header contract is one of the things R2 exists to fix, and shipping two thirds of it means R5 and R6 each decide what an empty slot looks like — the drift `FR-007` exists to prevent. *Render the slots as always-empty markup.* A placeholder is what scenario 6 forbids by name. |
| **`Actor` gains two fields R1 defined it without** — `avatarUrl`, `mustChangePassword` (a reach-back into an inherited contract) | The spec's *Key Entities* names four things the shell reads from the actor, and R1's shape carries two of them. Both columns are on the `user` row `loadActor()` already joins, so this is two selected columns and no second query. | *A second query in the layout for the chip's fields.* Two round trips on every authenticated request to avoid two columns, and a second place answering "who is the actor" — which is the one question `OT-SEC-008` wants answered once. |
| **`experimental.authInterrupts` adopts an experimental framework API** (IV — a built-in, but not a stable one) | `forbidden()` is the framework's own answer to §3.11 and meets `FR-019` and `FR-020` more completely than a hand-written screen: inside the shell, at the URL that refused, with a real `403`, through an interrupt that cannot be forgotten. The flag is typed and schema-validated in this release, and `next` is pinned to `16.3.2` exactly, so the API cannot move without a deliberate upgrade. | *Return a `<ForbiddenScreen />` from the page.* It satisfies both requirements and forfeits the `403` status and the `noindex` tag, and it makes the refusal a value every future route author must remember to `return`. On a convention twelve entries inherit, an interrupt beats a return. |

**Not recorded as a violation:** the layout reading an actor it does not check. `FR-015` states that
rule in the spec's own words — the client may evaluate the same predicates for presentation, and the
server check is the enforcement — and every page below repeats the check that protects it.

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 24 decisions, three assumptions carried forward, no unknown outstanding |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, four items in Complexity Tracking |
| 2 — Tasks | `tasks.md` | **not created by this command** — run `/speckit-tasks` |
| Implementation | — | **blocked on entry R1**, which is specified and planned but not built |
