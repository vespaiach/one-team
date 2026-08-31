# Implementation Plan: Issues — creation, detail and editing

**Branch**: `claude/r6-feature-specifications-e8c87e` | **Date**: 2026-08-31 | **Spec**:
[`spec.md`](./spec.md)

**Input**: Feature specification from
[`specs/006-issues-creation-detail-editing/spec.md`](./spec.md) and roadmap entry **R6**, whose scope
boundary this plan does not widen.

## Summary

R6 builds the unit of work everything else in the product hangs off. One table, `issue`, addressed by
its project's key plus a per-project number drawn under a row lock — `WEB-142`, permanent and never
reused. Two full pages: Create issue at `/projects/:projectKey/issues/new`, and Issue detail at
`/projects/:projectKey/issues/:issueNumber/details` with its 262px rail. Three mutators —
`createIssue`, `updateIssue`, `deleteIssue`. And one module promoted out of R5: the markdown subset
`OT-DATA-015` fixes for issue and project descriptions alike, which arrives at its second call site
here and is therefore extracted here.

**Four decisions carry the design**, and each is forced by something outside the spec rather than
chosen for taste.

The composite foreign key `OT-INV-004` demands — an issue's column belongs to the issue's project —
requires a unique constraint PostgreSQL does not create implicitly, so this feature **alters R5's
`board_column`**. That key must be `NO ACTION` and never `RESTRICT`: `NO ACTION` defers its check to
the end of the statement, which is the only reason `deleteProject`'s cascade can remove columns and
issues in either order without raising. Neither fact is discoverable from the spec, and getting
either wrong breaks a delete two entries away with no failing test here to catch it.

`updateIssue`'s delta is **computed inside the transaction and not returned**. `FR-055` requires the
mutator to know which fields changed and what each changed from; Principle VI forbids code nothing
calls. Returning the delta would be a field shipped for R7 and R11 to read one day — the very
"extension point" the spec's *Out of Scope* refuses. So the delta stays live code with two present
consumers: it decides whether to write at all, and it is the `SET` list. R7 and R11 extend the
function at the line where it already exists.

And **the due date is a native `<input type="date">`**, not React Aria's `DatePicker`, because
driving `DatePicker` means importing `@internationalized/date` — a package absent from `AGENTS.md`'s
approved table, which gate 4 refuses. This is flagged for the team rather than settled quietly: R5
reaches the same fork first, and if the amendment is wanted it should be made once, before R5 is
built.

Full reasoning in [`research.md`](./research.md) — forty-three decisions, groups A–E. The three
mutators in [`contracts/mutators.md`](./contracts/mutators.md), the two screens in
[`contracts/screens.md`](./contracts/screens.md), the extracted subset in
[`contracts/markdown.md`](./contracts/markdown.md).

## Technical Context

**Precondition — entries R2 and R5 are not implemented yet.** The tree today holds R1: `src/app`,
`src/db`, `src/features/auth` and two migrations. Every module this feature consumes beyond R1 is
missing. From R2: the `(app)` route group and its shell, `forbidden()` and its screen, the "This
doesn't exist" notice, the header contract with its New issue slot, the toast conventions and the
disabled-control-with-inline-reason rule, and the two guard-only pages this feature fills. From R5:
the `project`, `project_member`, `board_column` and `issue_counter` tables, the `isMember` predicate,
the five seeded columns, `/projects/:projectKey/details`, and the markdown implementation `FR-044`
extracts. This plan is complete and `/speckit-tasks` can be run against it, but **implementation is
blocked until R2 and R5 land**. Nothing below assumes otherwise.

**R3 is not a precondition.** This feature excludes deactivated accounts from the assignee pool by
reading `user.deactivated_at`, a column R1's table already carries. It needs R3's screens for nothing.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over `postgres` 3.4.9, Tailwind CSS v4 configured
in CSS, Biome 2.4.2.

**Dependencies this feature installs**: **one** — `fractional-indexing`, for
`generateKeyBetween(highest, null)`, the foot-of-order append `OT-DATA-018` requires. It is already
in `AGENTS.md`'s approved-dependency table for exactly this purpose, so gate 4 is met by the record
that exists and no amendment is needed; it is simply not yet in `package.json`
([`research.md`](./research.md) A-9).

**Dependencies this feature deliberately does not install**: no markdown library — the subset is
hand-written, per roadmap §1.1 and `AGENTS.md` → Architecture notes
([`contracts/markdown.md`](./contracts/markdown.md)); and **not** `@internationalized/date`, which
React Aria's `DatePicker` would require and which the approved table does not list
([`research.md`](./research.md) D-7).

**Configuration this feature changes**: none. `next.config.ts` and `vitest.config.mts` are untouched.

**Storage**: PostgreSQL 18 via Drizzle. **One table added** (`issue`), **one altered** (R5's
`board_column`, gaining `UNIQUE (project_id, id)`), one read under a row lock (R5's `issue_counter`).
One migration, generated with `db:generate` and its SQL inspected before commit.

**Testing**: Vitest 4.1.11 in R1's two projects — `server` (node) for the schema constraints, the
three mutators, the queries, the input parsers and `parseMarkdown`; `ui` (jsdom,
`@testing-library/react`) for every component. Persistence tests run against the real PostgreSQL
instance `TEST_DATABASE_URL` names, on a separate database. No async Server Component is rendered by
a test ([`research.md`](./research.md) D-2, E-1).

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The two screens are two
queries each; the counter lock is held across one insert.

**Constraints**: membership is a write boundary and never a visibility one (`OT-AUTHZ-002`) · the
server check is the enforcement and the client's predicate is presentation (`OT-AUTHZ-005`) · no
value a user types is ever silently shortened (II, `SC-016`) · numbers are monotonic per project and
never reused (`OT-INV-009`) · an issue never changes project (`OT-INV-002`) · deletes are hard and
cascade in the database, in one transaction (`OT-DATA-007`, `-008`) · calendar dates are compared in
the server's timezone, so no instant is ever constructed (`OT-DATA-004`) · every disabled control
carries an inline reason and nothing is hidden for a permission reason (`OT-UX-002`) · desktop only,
no breakpoint (`OT-SCOPE-004`) · no dependency outside `AGENTS.md`'s table (IV) · no seam built for a
later entry (I, III, VI).

**Scale/Scope**: one installation, one team under twenty people. 68 functional requirements, 5 user
stories, 30 acceptance scenarios, 26 edge cases, 22 success criteria, 2 screens across 2 routes,
8 components, 3 Server Actions, 1 table added and 1 altered.

**Unknowns**: none outstanding. Twelve questions were closed across three `/speckit-clarify` sessions
and are recorded in the spec's *Clarifications*. Research adds three assumptions carried forward
([`research.md`](./research.md), *Assumptions carried forward*): `issue_counter`'s column name, the
completeness of R5's markdown implementation, and whether the team amends the dependency table for
`@internationalized/date`. None blocks implementation; each names the one place it would change.

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | Eight components, each with one concern. Exactly one abstraction is extracted, and both its call sites exist on the day it lands: `editable-text.tsx` serves title and description, whose behaviour `FR-048` makes identical. Exactly one module is promoted to `src/components/shared` — the markdown renderer, at its genuine second call site, which is what `FR-044` requires. Nothing else is extracted: the rail's four controls stay inline, the counter draw and the order append stay inside `createIssue`, and `src/components/ui` is still not created. | pass, with one entry in Complexity Tracking |
| **II** | Validated Input Boundaries | Three Server Actions, each a public server entry point, each validating on the server whatever the client checked. One parser per field, taking `unknown` and returning the narrowed value or `null` — never a coercion, never a truncation. Over-length is refused rather than capped, which `SC-016` states and II requires. Every predicate derives its project from the stored row, never from an argument. The `CHECK` constraints are the second line, not the first. | pass |
| **III** | Straightforward Over Clever | The counter is one `UPDATE … RETURNING` rather than a select-then-update. The markdown subset has no delimiter stack, no nesting and no escapes. The delta is a comparison, not a diffing framework. No hook registry, event bus or callback layer is built for the four entries that will edit these mutators — the spec's *Out of Scope* refuses it and this plan does not reintroduce it. | pass |
| **IV** | Built-In Features Over Third-Party Libraries | One dependency installed, `fractional-indexing`, already approved in the table for this purpose. No markdown library. No date library — the due date is the Web platform's own control, which is why `@internationalized/date` is not pulled in. React Aria supplies the three selects and the confirmation dialog, as `AGENTS.md` requires. | pass, with two entries in Complexity Tracking |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The three places a reader will want an explanation — why the composite key is `NO ACTION`, why `updateIssue` locks its row, and why the delta is not returned — are answered by [`research.md`](./research.md) A-4, B-5 and B-6 and by the mutator contract, not by annotation. | pass |
| **VI** | No Dead Code | The delta is the test of this principle in this feature, and it passes by being consumed where it is computed rather than exposed for a later entry. Nothing is returned that R6 does not read; nothing is built that R6 does not render. The confirmation's absent cascade count is an empty list read on every render, not a placeholder. | pass |
| **VII** | Test-First (NON-NEGOTIABLE) | All 30 acceptance scenarios are carried by a Red step written before its implementation. One test in the file is deliberately **not** a Red step and says so: `T088` asserts the member's cancellation route, whose behaviour `T065` already delivers, so it passes on first run — its Red step is `T058`, in US3, written before `T065` exists. Labelling it rather than filing it under a Red heading is what keeps gate 1's evidence readable. Every functional requirement has a test: the structural ones (`FR-001`…`FR-008`, `FR-057`) by asserting the database refuses the violating write or the table lacks the column — the method the spec's own preamble fixes — and the rest through a component, a mutator or a query. No requirement in this feature lacks a caller. | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. Pages are thin async wrappers over synchronous components, so every screen assertion is reachable by the runner ([`research.md`](./research.md) D-2) |
| 2 | Minimal implementation, then refactor green | Scoped per task. No mutator does more than its contract; no component takes a prop its scenario does not require |
| 3 | Server-side validation at every touched boundary | Principle II row above. Three actions, one parser per field, authorization before validation, project derived from the stored row ([`contracts/mutators.md`](./contracts/mutators.md)) |
| 4 | No unapproved dependency | One installed, `fractional-indexing`, already in `AGENTS.md`'s table. `@internationalized/date` is **not** installed precisely because it is not — the decision is recorded in Complexity Tracking rather than taken quietly |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above. The one thing a reviewer might read as dead — `updateIssue`'s delta — is consumed twice inside the transaction |
| 7 | Every changed line traces to a requirement | Each file in the structure below names the requirement that puts it there. The three edits to R5's and R2's work are named in Complexity Tracking |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not by itself evidence of gate 1 |

**Re-evaluation after Phase 1.** The design added no dependency beyond the approved one, no shared
abstraction without two present call sites, and no comment. Three things it *changed*, each recorded
below rather than left in the diff: a unique constraint added to R5's `board_column`; R5's markdown
implementation moved out of R5's feature directory with its two imports repointed; and R5's project
details screen edited to fill the New issue slot R2 built. All three are reach-backs into inherited
work, and all three are required by requirements this feature owns.

## Project Structure

### Documentation (this feature)

```text
specs/006-issues-creation-detail-editing/
├── spec.md                     the feature specification
├── plan.md                     this file
├── research.md                 Phase 0 — 43 decisions, groups A–E
├── data-model.md               Phase 1 — one table added, one altered, one read under a lock, one DTO
├── quickstart.md               Phase 1 — fifteen walkthroughs, and seven criteria a browser cannot show
├── contracts/
│   ├── mutators.md             createIssue, updateIssue, deleteIssue — and what four entries attach to
│   ├── screens.md              the two routes, their guards, their components and their controls
│   └── markdown.md             the closed grammar, its two guarantees, and the extraction
├── checklists/
│   ├── requirements.md         spec-quality gate — 16/16
│   ├── authz.md                authorization and the write boundary — 27/27
│   ├── data-integrity.md       numbering, transactions, the cascade — 29/29
│   ├── ux.md                   both screens' interaction and accessibility — 31/31
│   └── integration.md          the four reach-back entries and the three providers — 28/28
└── tasks.md                    Phase 2 — 100 tasks, one phase per user story
```

### Source code (repository root)

Every path below is created or edited by this feature, and each names why it exists.

```text
src/
├── db/
│   ├── schema.ts                           EDIT — the issue table; UNIQUE (project_id, id)
│   │                                              on R5's board_column      FR-001…FR-008, A-3
│   └── test-database.ts                    EDIT — "issue" into TRUNCATED_TABLES         E-3
├── app/(app)/projects/[projectKey]/issues/
│   ├── new/page.tsx                        FILL (R2's guard) — actor · project · isMember;
│   │                                              Suspense over the queries, skeleton below
│   │                                              the guard   FR-027, FR-029, FR-032…FR-036, FR-067
│   └── [issueNumber]/details/page.tsx      FILL (R2's guard) — actor · issue; same Suspense
│                                                  placement          FR-041, FR-046, FR-047, FR-067
├── components/shared/markdown/
│   ├── parse.ts                            MOVED from R5 — the closed grammar     FR-009, FR-010
│   └── markdown.tsx                        MOVED from R5 — blocks to React elements      FR-044
├── features/
│   ├── issues/
│   │   ├── actions.ts                      "use server" — the three entry points
│   │   ├── issue-key.ts                    project key + number → WEB-142               FR-012
│   │   ├── components/
│   │   │   ├── create-issue-form.tsx       "use client" — useActionState   FR-030…FR-039
│   │   │   ├── issue-detail.tsx            synchronous — main column + 262px rail
│   │   │   │                                                              FR-042, FR-043, FR-047
│   │   │   ├── copyable-key.tsx            "use client" — first element, copy target    FR-042
│   │   │   ├── editable-text.tsx           "use client" — title and description
│   │   │   │                                              FR-048…FR-050, FR-054
│   │   │   ├── issue-rail.tsx              "use client" — column, priority, assignee, due date
│   │   │   │                                              FR-045, FR-051, FR-052, FR-068
│   │   │   ├── issue-skeletons.tsx          synchronous — both screens' loading shapes    FR-067
│   │   │   ├── delete-issue-control.tsx    "use client" — control + confirmation  FR-061, FR-062
│   │   │   └── new-issue-control.tsx       "use client" — the header slot, all three
│   │   │                                                  project-scoped screens          FR-028
│   │   └── server/
│   │       ├── create-issue.ts             one transaction: draw, append, insert   FR-039, FR-040
│   │       ├── update-issue.ts             locked read, delta, changed columns only     FR-055
│   │       ├── delete-issue.ts             isAdmin, one transaction          FR-056…FR-059
│   │       ├── issue-queries.ts            the IssueView DTO, columns, assignee pool
│   │       │                                              FR-022, FR-045, OT-AUTHZ-007
│   │       └── input.ts                    one parser per field             FR-037, FR-049
│   └── projects/                           EDIT (R5's) — two touches:
│                                             · repoint two markdown imports            FR-044
│                                             · fill the header's New issue slot        FR-028

package.json                                EDIT — fractional-indexing                  FR-040
drizzle/0002_*.sql + meta                    NEW — generated, inspected, committed
```

Untouched and named so: `next.config.ts`, `vitest.config.mts`, `tsconfig.json`, `drizzle.config.ts`,
`src/app/layout.tsx`, `src/app/provider.tsx`, `src/app/globals.css`, `src/app/(auth)/`,
`src/features/auth/`, `proxy.ts`, `src/instrumentation.ts`.

**Structure Decision.** `AGENTS.md`'s rules, followed exactly. `src/app` holds two page files whose
whole body is `await params`, the guards, the queries and one synchronous component — no domain
module lives there. All behaviour is in `src/features/issues/`, with everything that touches the
database under its `server/` directory. `src/features/issues/actions.ts` carries the top-level
`"use server"` and is the only module a Client Component imports server behaviour from. No barrel
file mixes server and client exports.

Two things are promoted and nothing else is. The markdown module goes to
`src/components/shared/markdown/` because it has a real second use — two R5 surfaces and two R6
surfaces — which is the exact condition `AGENTS.md` sets. `editable-text.tsx` stays inside the
issues feature despite serving two call sites, because both are R6's; R5's project details has its
own in-place fields, and if the two prove identical the promotion happens then, with both callers
visible. `src/components/ui` is still not created: nothing here is a reusable accessible primitive
with two callers, and R2 and R5 made the same call.

**Skeletons go inside the page, under a `Suspense` boundary, not in a `loading.tsx`.** `FR-067`
requires the skeleton below each route's authorization decision, and a segment-level `loading.tsx`
sits *above* the page — it would turn a `403` or a `404` into a streamed `200`, which is the trap R2
recorded in its own route-surface contract. So each page runs its guards first and wraps only the
data-dependent subtree.

Two helpers deliberately do **not** get their own modules. The counter draw is one statement and the
order append is one call, each with exactly one caller, and both live inside `create-issue.ts`.
Extracting either would be a file created for symmetry, which is the "many trivial files" half of
Principle I's balance.

## Complexity Tracking

Five items where the design does not sit cleanly inside a principle, or reaches into work another
entry owns. Each is recorded so a reviewer meets it here rather than discovering it in the diff.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **`UNIQUE (project_id, id)` added to R5's `board_column`** (a reach-back into an inherited table) | `OT-INV-004` and `FR-005` require the issue-column pairing enforced by a composite foreign key rather than by a mutator's check. PostgreSQL requires that key's referenced column list to be covered by a unique constraint, and `id` being the primary key does not cover `(project_id, id)`. Without it the constraint cannot be declared at all. | *Let R5's plan add it.* R5 has no use for the constraint and no requirement pointing at it; it would be a line in R5's schema justified only by a document R5's author had to read. *Enforce the pairing in the mutators.* `FR-005` says "rather than by a mutator's own check alone", and `AGENTS.md` says a read followed by a write is not protection — two mutators today, `moveIssue` tomorrow, and the invariant depends on all three remembering. |
| **R5's markdown implementation is moved out of R5's feature directory and its two imports repointed** (a reach-back into an inherited module) | `FR-044` requires it in as many words: this feature is the subset's second call site, and Principle I extracts there. `SC-017` is the outcome — an issue and a project description holding identical source render identically because one implementation renders both. | *Ship a second implementation here.* Two copies of the HTML-escaping guarantee and the link-scheme allowlist, drifting independently, to render the same seven constructs. This is precisely what `FR-044` was written to prevent. *Have R5 place it in `src/components/shared` from the start.* Principle I extracts at the **second** call site so the first does not guess the shared shape; [`contracts/markdown.md`](./contracts/markdown.md) says so to R5's planner directly. |
| **R5's project details screen is edited to fill the header's New issue slot** (a reach-back into an inherited screen) | `FR-028` requires the control to point at this page on **every project-scoped screen that exists when this feature lands**, and to render disabled with a reason naming the project for a non-member (`OT-UX-021`). R2 built the slot and deferred its destination here; R5 renders the header. There is no third place the wiring could go. | *Wire only R6's own two screens.* The control would then work on the issue pages and do nothing on project details — a control that behaves differently on adjacent screens, which is the drift the header contract exists to prevent. *Let R5 wire it.* R5 cannot: the destination route does not exist until this feature builds it. |
| **`fractional-indexing` is installed here, for one function, by the entry that does not own ordering** (IV — approved, but R10 owns the scheme) | `OT-DATA-018` and `FR-040` require creation to write an index after every existing issue. The append is the increment-and-lengthen half of the scheme R10's inserts must agree with byte for byte. The package is already in `AGENTS.md`'s approved table for this purpose, so gate 4 is met by a record that predates this plan. | *Hand-write the append and let R10 install the package.* A second implementation of the subtle half of the scheme, which R10 must then either match as an undocumented convention or migrate every row away from. *Defer ordering entirely to R10.* `OT-DATA-018` is assigned to this entry, and an issue with no `sort_order` has no place in the order the board will read. |
| **The due date is a native `<input type="date">` rather than React Aria's `DatePicker`** (a departure from `AGENTS.md`'s React-Aria-first rule) | Driving `DatePicker` means constructing and parsing `DateValue`s from `@internationalized/date`, which `react-aria-components` pulls in transitively and which `AGENTS.md`'s approved table does not list. Gate 4 refuses a dependency whose approval was not recorded beforehand, and this plan cannot record an approval on the team's behalf. The native control is the platform's own — the browser supplies its keyboard, focus and ARIA behaviour — and its value is exactly the `YYYY-MM-DD` the `date` column stores, so `OT-DATA-004`'s timezone trap has no step to occur in. | *Import `@internationalized/date` anyway.* It is installed on disk, which makes it available and not approved; treating availability as approval is the habit gate 4 exists to break. *Amend the table in this plan.* An amendment needs team approval recorded beforehand, and R5 — which has two date fields — reaches this fork first. **Flagged, not decided**: if the team wants `DatePicker` across R5, R6 and R12, the amendment should be made once, before R5 is built, and this decision reverses to follow it. The plan is written so that reversal touches one component. |

**Not recorded as a violation:** `deleteIssue`'s transaction wrapping a single statement. It looks
redundant and is not — `OT-DATA-008` requires the response to carry the settled state, and R7's and
R11's cascade work joins this transaction rather than introducing it, which is the same reasoning
`FR-055` applies to `updateIssue`.

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 43 decisions in five groups, three assumptions carried forward, no unknown outstanding |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, five items in Complexity Tracking |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — 100 tasks across eight phases, every acceptance scenario carried by a Red step, and the one non-Red test labelled as such |
| Implementation | — | **blocked on entries R2 and R5**, both specified, R2 planned, neither built |
