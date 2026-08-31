# Implementation Plan: Projects — creation, record, membership and lifecycle

**Branch**: `claude/projects-membership-lifecycle-spec-0bb3b8` | **Date**: 2026-08-30 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from [`specs/005-projects-membership-lifecycle/spec.md`](./spec.md) and
roadmap entry **R5**, whose scope boundary this plan does not widen.

## Summary

R5 builds the container everything after it writes into. Four tables — `project`, `project_member`,
`board_column` seeded with its five rows, `issue_counter` — the `isMember` predicate and the write
boundary it draws, six mutators, two screens, and the two pieces R2 left for this entry: the sidebar's
project list and the project header. Entries R6 through R12 all consume it, and three of them reach
back into its mutators.

The technical approach is mostly the database's and the framework's, because both answer the harder
requirements better than application code would. **The invariants are constraints, not checks.** The
key's pattern and uniqueness, one counter row per project, the composite membership key, the
case-folded column-name uniqueness, the seven-value colour set, and the target-not-before-start rule
are all `CHECK`s, `UNIQUE`s and a composite primary key — so `SC-003`'s two concurrent creations, the
impossible duplicate membership row and `FR-028`'s two-concurrent-single-field-writes race are decided
by PostgreSQL rather than by a read the mutator hopes is still true. **The cascade is the database's
too**: `deleteProject` issues one `DELETE`, and `OT-DATA-008`'s "no moment where a row is gone and its
dependents are not" is a property of the transaction rather than a promise.

**Three decisions shape everything else.** The **markdown renderer is written here and produces React
nodes**, never an HTML string — which makes `OT-DATA-015`'s "HTML MUST be escaped" structural rather
than a rule someone has to remember, and keeps a parsing dependency out of a grammar smaller than its
own options object (IV). **`deleteProject` re-reads its own precondition under `FOR UPDATE`**, because
US4 scenario 9 requires the archived status observed inside the deleting transaction and not from the
read that rendered the screen. And **every page is a thin async wrapper over a synchronous
component**, because the framework's own testing guide states that Vitest cannot render async Server
Components and this repository has no E2E runner and cannot add one (IV) — so that constraint, not
taste, fixes the component boundaries that make change gate 1 reachable.

Full reasoning in [`research.md`](./research.md) — forty decisions, groups A–F. The tables in
[`data-model.md`](./data-model.md); the six mutators in [`contracts/mutators.md`](./contracts/mutators.md);
the two screens in [`contracts/create-project.md`](./contracts/create-project.md) and
[`contracts/project-details.md`](./contracts/project-details.md); the closed grammar in
[`contracts/markdown.md`](./contracts/markdown.md); what this entry adds to R2's frame in
[`contracts/shell-reach-back.md`](./contracts/shell-reach-back.md).

## Technical Context

**Precondition — entries R2 and R3 are not implemented yet.** The tree today holds `src/app`,
`src/db` and `src/features/auth`: R1 and nothing else. Every module R5 renders inside is R2's and
does not exist — the `(app)` route group and its layout, `AppShell`, `Sidebar`,
`ProjectListRegion`, `ScreenHeader`, the Forbidden screen, the "This doesn't exist" notice, the
guard-only `/projects/new` and `/projects/:projectKey/details` routes, and the
disabled-control-with-inline-reason convention. The accounts both pickers read are R3's. The toast
that names a rejected write is R3's or R4's, whichever is built first. This plan is complete and
`/speckit-tasks` can be run against it, but **implementation is blocked until R2 and R3 land**.
Nothing below assumes otherwise.

**Language/Version**: TypeScript 7.0.2, `strict`. No `any`, no non-null assertions, no `@ts-ignore`.

**Primary Dependencies**: Next.js 16.3.2 (App Router), React 19.2.8 with React Compiler enabled,
`react-aria-components` 1.20.0, `drizzle-orm` 0.45.2 over `postgres` 3.4.9, `uuidv7` 1.2.1,
Tailwind CSS v4 configured in CSS, Biome 2.4.2.

**Dependencies this feature installs**: **one, and it needs approval first.**
`@internationalized/date` is React Aria's own runtime dependency, already in the tree at 3.12.3, but
it is not declared in `package.json` and not in AGENTS.md's approved table — and
`react-aria-components` does not re-export it, so `DatePicker`'s value type is unreachable without
it. Gate 4 requires the approval recorded beforehand. Carried in *Complexity Tracking* with the
recommendation and the fallback; **no dependency is installed by this plan**.

`fractional-indexing` is *approved* and deliberately **not** installed: R5 writes five constant
`sort_order` values and never computes a key between two others, so the library has no computation to
do here. R9 installs it ([`research.md`](./research.md) A-4).

**Configuration this feature changes**: none. `next.config.ts`, `vitest.config.mts`, `biome.json`,
`drizzle.config.ts` and `postcss.config.mjs` are untouched.

**Storage**: PostgreSQL 18 via Drizzle. **Four new tables, one generated migration.**
`src/db/schema.ts` gains `project`, `project_member`, `board_column` and `issue_counter`; `drizzle/`
gains one generated migration and its snapshot, whose number is read off the generator rather than
assumed — `0000` and `0001` are R1's and R2, R3 or R4 may add their own first; `src/db/test-database.ts` gains the four names in
`TRUNCATED_TABLES`. `board_column.sort_order` needs `customType` because Drizzle's `text()` carries
no collation option and §5 pins `COLLATE "C"` ([`research.md`](./research.md) A-4b).

**Testing**: Vitest 4.1.11 in R1's two projects — `node` for the schema, the constraints, the six
mutators and the markdown parse; `jsdom` with `@testing-library/react` for every component and the
markdown render. Persistence tests run against the real PostgreSQL instance `TEST_DATABASE_URL`
names; three of them open two transactions at once. No async Server Component is rendered by a test
([`research.md`](./research.md) D-1, F-1, F-2).

**Target Platform**: self-hosted on a single box, Node.js runtime. Desktop browser only.

**Project Type**: web application — one Next.js project, no separate frontend and backend.

**Performance Goals**: none stated by the specification, and none invented. The sidebar adds one
query per authenticated request, over a table holding a handful of rows for a team under twenty. **No
index is created beyond the ones the constraints already build** — every query this feature issues is
served by a primary key or a unique index it needed anyway, and AGENTS.md allows indexes for known
query patterns only ([`research.md`](./research.md) A-9).

**Constraints**: membership is a write boundary and never a visibility one, so no read in this
feature is membership-scoped (`OT-AUTHZ-002`) · admins are implicit members, so no rule carries an
`|| isAdmin` branch (`OT-AUTHZ-001`) · membership **predicates** include admins, membership **lists**
do not (`OT-AUTHZ-006`) · the project for an `isMember` check is derived from the stored row, never
from a client-supplied id (`OT-AUTHZ-004`) · every colour is one of seven, with no free entry
(`OT-DATA-013`) · descriptions render a closed markdown subset with HTML escaped and no parsing
dependency (`OT-DATA-015`, IV) · `issue_counter` is unreachable from every read (`OT-DATA-006`) ·
`project.key` is immutable (`OT-INV-007`) and unique (`OT-INV-016`) · a project is archived before it
is deleted (`OT-INV-008`) · deletes are hard, cascading, and one transaction (`OT-DATA-007`,
`OT-DATA-008`) · archiving touches nothing else (`OT-OPS-010`) and both transitions are legal
(`OT-OPS-011`) · no dependency outside AGENTS.md's table (IV) · no component library (I, roadmap §1.1).

**Scale/Scope**: one installation, one team under twenty people. 56 functional requirements, 5 user
stories, 56 acceptance scenarios, 18 edge cases, 15 success criteria, 2 screens plus the shell's two
regions, 4 tables, 1 migration, 6 Server Actions and 1 authorizing read.

**Unknowns**: none outstanding. The specification's silences are settled in the spec's own
*Assumptions*, and seven questions were closed across three `/speckit-clarify` sessions. Research
adds three assumptions of its own ([`research.md`](./research.md), *Assumptions carried forward*):
`project_member`'s timestamps have no reader today, the Columns section's issue count is a literal
`0` until R6, and `ScreenHeader` gains one prop before R2 has another caller for it. None blocks
implementation. The one item that **does** need a decision before code is written is the dependency
in *Complexity Tracking*, and it is a governance approval rather than an unknown.

## Constitution Check

*GATE: passed before Phase 0, re-evaluated after Phase 1 design. Both evaluations below.*

Principles are hosted in [`AGENTS.md`](../../AGENTS.md);
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) holds governance and the
version record (v1.0.0).

| | Principle | Assessment | Post-design |
| --- | --- | --- | --- |
| **I** | Component-Driven Architecture | Each component owns one section of one screen. Two abstractions are extracted on day one and both have their second call site on day one too: `EditableField` has five (name, description, both dates, colour) and the palette swatches have two (the project's colour and the seeded columns'). Nothing is promoted to `src/components/shared` or `src/lib` — the markdown renderer stays inside the feature until R6 is its second caller, which the spec's *Dependencies* already records. | pass |
| **II** | Validated Input Boundaries | Seven server entry points — six mutators and one authorizing read — and each validates shape and then value before touching the database. Every predicate is checked against the **stored** row, never a client-supplied project, and the project-scoped one is checked **inside the transaction that writes** rather than before it, because a membership row read outside that transaction is a read followed by a write (`FR-014`, [`contracts/mutators.md`](./contracts/mutators.md)). `updateProject`'s five-key partial rejects an unknown key at runtime as well as at compile time, because a Server Action's argument arrives over the wire. Every mutator asserts the origin first, following R1. Returned results carry no SQL, no constraint name and no row. | pass |
| **III** | Straightforward Over Clever | No metaprogramming, no dynamic dispatch, no generic machinery. The cascade is three foreign keys rather than a delete orchestrator; the markdown grammar is a line classifier and an inline scanner rather than a pluggable pipeline; the key's ownership is one boolean rather than a value comparison. `integer` over `bigint` on the counter, and no library for five constant strings. | pass |
| **IV** | Built-In Features Over Third-Party Libraries | The renderer is hand-written and builds React nodes; the refusals, the redirect and the refresh are framework built-ins; `URL` does the scheme allowlist; React Aria supplies every control. `fractional-indexing` is approved and not installed, because this entry has nothing for it to compute. **One item is unresolved**: `@internationalized/date`, which `DatePicker` requires and which is in the tree transitively but not declared or approved. | pass, with one entry in Complexity Tracking |
| **V** | Intention-Revealing Code Without Comments | No comments in the diff. The three places a reader will want an explanation — why `project_member` has no `id`, why the counter has no timestamps, why `sort_order` needs a custom type — are answered by [`research.md`](./research.md) and [`data-model.md`](./data-model.md), not by annotation. | pass |
| **VI** | No Dead Code | Two things exist ahead of their reader and both are required by a functional requirement rather than anticipated: `board_column`'s case-folded unique index, which has no caller until R9's rename, and `project_member`'s timestamps, which `FR-012` requires and nothing reads. Both are declared below rather than left in the diff. The Columns section's `issueCount` is not in this category — the field is real and `0` is the true count until R6. | pass, with two entries in Complexity Tracking |
| **VII** | Test-First (NON-NEGOTIABLE) | All 56 acceptance scenarios are Red steps written before their implementation, and the decomposition exists to make them reachable: every constraint is asserted against real PostgreSQL, every mutator is a plain async function a test calls without a request, every screen assertion lands on a synchronous component, and the markdown grammar is a pure function. Four requirements are stated with no test **by the spec's own design** — `FR-051`'s and `FR-048`'s clauses binding later entries, and `OT-DATA-012`/`OT-INV-009`, which `FR-008` cites and R6 enforces; each is named in [`research.md`](./research.md) F-4, and gate 1 asks for no test this entry cannot write. | pass |

### Gates 1–8

| # | Gate | How it is met |
| --- | --- | --- |
| 1 | A test written first and observed failing | Each task in `tasks.md` pairs one scenario with one implementation; the commit order is the evidence. The runner cannot render async Server Components, so every assertion is placed on a synchronous component, a pure function, or a server module called directly ([`research.md`](./research.md) D-1) |
| 2 | Minimal implementation, then refactor green | Scoped per task. No mutator does more than its own transaction; no component takes a prop its scenario does not require |
| 3 | Server-side validation at every touched boundary | Principle II row above. Seven entry points, each validating shape then value, each resolving its project from the stored row, each asserting origin first |
| 4 | No unapproved dependency | `fractional-indexing` is approved and not installed. **`@internationalized/date` needs an AGENTS.md amendment before `DatePicker` is written** — the one open item, in Complexity Tracking |
| 5 | `npm run style-check` clean | Run as part of `npm run verify` |
| 6 | No comments, no commented-out code, no dead code | Principles V and VI rows above; the two exceptions are declared, not hidden |
| 7 | Every changed line traces to a requirement | Each file in the structure below names the FR that puts it there |
| 8 | `npm test` passes with nothing failing or skipped | Run as part of `npm run verify`. `--passWithNoTests` means a green run is not by itself evidence of gate 1 |

**Re-evaluation after Phase 1.** The design added no abstraction without two same-day call sites, no
comment, and no dependency beyond the one already named. Three things it *changed*: the date ordering
rule became a table `CHECK` as well as a mutator check, because two concurrent single-field writes can
each read a legal row ([`research.md`](./research.md) A-6) — recorded because dual enforcement looks
like duplication until the race is named; `board_column.sort_order` needs a `customType`, because
Drizzle's `text()` has no collation option and §5 pins `COLLATE "C"` (A-4b); and `ScreenHeader` gains
one optional prop, which is a reach-back into R2's typed contract and is recorded below.

## Project Structure

### Documentation (this feature)

```text
specs/005-projects-membership-lifecycle/
├── spec.md                          the feature specification
├── plan.md                          this file
├── research.md                      Phase 0 — 40 decisions, grouped A–F
├── data-model.md                    Phase 1 — four tables, the reads, the DTOs, the writes
├── quickstart.md                    Phase 1 — twelve runnable walkthroughs
├── contracts/
│   ├── mutators.md                  the six Server Actions and the one authorizing read
│   ├── create-project.md            §3.7 — the form, the key's three rules, the picker
│   ├── project-details.md           §3.8 — the record, status, columns, members, delete
│   ├── markdown.md                  the closed grammar, the scheme allowlist, the escaping
│   └── shell-reach-back.md          the sidebar's list and the project header — what R2 left
├── checklists/
│   ├── requirements.md              the spec-quality gate
│   ├── authorization.md             the predicates, the entry points, the read boundary
│   ├── data-integrity.md            identity, bounds, concurrency, the cascade, the counter
│   ├── ux.md                        in-place editing, optimistic state, the two screens
│   └── markdown.md                  the closed grammar, link safety, escaping
└── tasks.md                         Phase 2 — not created by /speckit-plan
```

### Source code (repository root)

Every path below is created or edited by this feature, and each names why it exists.

```text
src/
├── db/
│   ├── schema.ts                           EDIT — project, project_member, board_column,
│   │                                              issue_counter, and the sort_order custom type
│   │                                              FR-002…FR-009, FR-012
│   └── test-database.ts                    EDIT — four names in TRUNCATED_TABLES
├── app/(app)/
│   ├── layout.tsx                          EDIT (R2's) — reads the sidebar's project list  FR-053
│   └── projects/
│       ├── new/page.tsx                    EDIT (R2's) — admin guard + the create form
│       │                                                            FR-022, FR-023, FR-034
│       └── [projectKey]/details/page.tsx   EDIT (R2's) — the details screen        FR-035, FR-040
└── features/
    ├── shell/components/
    │   ├── project-list-region.tsx         EDIT (R2's) — entries, order, dimming  FR-053…FR-055
    │   └── screen-header.tsx               EDIT (R2's) — one optional colorDot prop        FR-056
    └── projects/
        ├── actions.ts                      "use server" — six mutators + the key check   FR-015
        ├── key.ts                          deriveProjectKey, isValidProjectKey    FR-002, FR-025
        ├── palette.ts                      the seven values and their names       FR-009, OT-DATA-013
        ├── seed-columns.ts                 the five rows: name, kind, colour, sort_order  FR-007
        ├── markdown/
        │   ├── parse.ts                    source → blocks and inlines            FR-010
        │   └── render.tsx                  blocks and inlines → React nodes       FR-010, FR-011
        ├── server/
        │   ├── authorization.ts            isMember, and the two guards           FR-013, FR-014
        │   ├── queries.ts                  every read, through publicUser         FR-017, FR-018
        │   ├── create-project.ts           the 1 + 5 + 1 + n transaction          FR-034
        │   ├── update-project.ts           the five-field partial, the date rule  FR-016, FR-028
        │   ├── project-status.ts           the two-state flip                     FR-042, FR-043
        │   ├── delete-project.ts           FOR UPDATE, the archived check, the cascade
        │   │                                                            FR-047, FR-050, FR-051
        │   └── membership.ts               add and remove                         FR-019, FR-045
        └── components/
            ├── create-project-form.tsx     "use client" — useActionState          FR-032, FR-033
            ├── project-key-field.tsx       "use client" — derive, own, check      FR-025, FR-026
            ├── palette-field.tsx           "use client" — RadioGroup of swatches  FR-029
            ├── member-picker-field.tsx     "use client" — ComboBox + TagGroup     FR-030, FR-045
            ├── date-range-fields.tsx       "use client" — two DatePickers         FR-028
            ├── project-details-screen.tsx  synchronous — the five sections        FR-035
            ├── editable-field.tsx          "use client" — the in-place convention FR-036, FR-038
            ├── description-view.tsx        rendered markdown, raw source on edit  FR-039
            ├── status-switch.tsx           "use client" — admin only, optimistic  FR-041
            ├── columns-section.tsx         read-only list in board order          FR-044
            ├── members-section.tsx         roster + add and remove                FR-045
            ├── delete-project-control.tsx  "use client" — Dialog, count, confirm  FR-047, FR-048
            └── project-header.tsx          colour dot, name, Board/Details tabs   FR-056

drizzle/<next>_*.sql                        NEW — generated, inspected, committed with its snapshot
                                            (`0000` and `0001` are R1's; R2, R3 and R4 may add their
                                             own before this one, so the number is read off the
                                             generator, never assumed)
```

Untouched and named so: `next.config.ts`, `vitest.config.mts`, `biome.json`, `drizzle.config.ts`,
`src/app/layout.tsx`, `src/app/(auth)/`, `src/app/api/auth/signin/`, `src/proxy.ts`,
`src/instrumentation.ts`, `src/db/touched.ts`, `src/db/index.ts`, and every module under
`src/features/auth/` except the projection this feature imports.

**Structure Decision.** AGENTS.md's rules, followed exactly. `src/app` holds routing, layouts and
pages **only** — the three files there are a guard, a read and a render each, and no domain module
lives among them. All behaviour is under `src/features/projects/`, with everything server-only inside
its `server/` directory. Four modules sit outside `server/` deliberately: `actions.ts`, which carries
top-level `"use server"` and is the only module a Client Component imports server behaviour from;
`key.ts` and `palette.ts`, which the client evaluates on every keystroke and every swatch; and
`markdown/`, which renders in both. Nothing is promoted to `src/components/shared` or `src/lib`, and
`src/components/ui` is still not created — R2 ships no component library and R5 adds none. No barrel
file mixes server and client exports.

The two edits under `src/features/shell/` and the one under `src/app/(app)/layout.tsx` are reach-backs
into R2's modules. They are R2's own deferrals — the roadmap's R2 row defers "the project list's data
and its ordering (R5)" by name — and are contracted in
[`contracts/shell-reach-back.md`](./contracts/shell-reach-back.md).

## Complexity Tracking

Four items where the design does not sit cleanly inside a principle, and one governance approval this
plan cannot grant itself. Each is recorded so a reviewer meets it here rather than in the diff.

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| **`@internationalized/date` must be declared and approved before `DatePicker` is written** (IV, gate 4) | `FR-028` needs two date fields, §7's React Aria first rule points at `DatePicker`, and `DatePicker`'s value is a `CalendarDate` that `react-aria-components` does not re-export. The package is already installed and already shipping as React Aria's own runtime dependency (3.12.3) — declaring it makes an existing transitive dependency explicit rather than adding weight. **Recommendation: add one row to AGENTS.md's approved table before implementation begins.** | *Rely on it transitively.* AGENTS.md names transitive-weight additions specifically, and an undeclared import breaks the moment React Aria changes its own dependency. *Build the date field by hand from `TextField`.* §7's rule exists to prevent exactly that where React Aria ships the component, and a hand-built date control has to reproduce React Aria's keyboard, focus and ARIA behaviour to be acceptable — far more code and risk than one table row. **If the team refuses the dependency, the fallback is the hand-built control and this plan's D-6 changes; nothing else does.** |
| **The date ordering rule is enforced twice** — a table `CHECK` and a mutator check (III, apparent duplication) | **`FR-028` now requires both layers by name**, so this is a requirement the plan implements rather than an inference it makes; the row stays because the duplication is still what a reviewer meets in the diff. `FR-036` sends one field per `updateProject` call, so two concurrent calls — one setting `start_date`, one setting `target_date` — can each read a legal row and together write an illegal one. AGENTS.md is explicit that a read followed by a write is not protection. The `CHECK` is the enforcement; the mutator check exists because `23514` carries no field name and `FR-028` requires an inline error on a named field. | *The mutator alone.* It leaves a real invariant to a race. *The constraint alone.* `FR-028` and the spec's edge cases both require the refusal to land on a named field with a reason, and a constraint violation has neither. |
| **`board_column`'s case-folded unique index has no caller in this entry** (VI) | `OT-INV-016` and §5 put `UNIQUE (project_id, lower(name))` on the table, and the table is created here. R5 seeds five names that cannot collide and offers no rename, so nothing exercises it until R9's inline rename. | *Add it with R9.* A unique index added to a populated table can fail on data the intervening entries wrote, and it would make `OT-INV-016` — an invariant the requirements index assigns to R5 — enforced nowhere for four entries. |
| **`project_member` carries `created_at` and `updated_at` that nothing reads** (VI) | `FR-012` requires R1's conventions on every table this feature introduces and names `issue_counter` as the **only** exception. R7's `member_added` activity row carries its own timestamp, so the membership row's may stay unread indefinitely. | *Drop them as the counter drops them.* `FR-012` says the counter is the only table outside the rule; widening that to two tables is a spec change, not a design choice. |
| **The Columns section's issue count is a literal `0`** (VI — arguably) | `FR-044` requires the count and `issue` does not exist until R6. The section renders the real shape and the true number. | *Omit the count until R6.* Then the Columns section ships in two different shapes and R6 decides what the first one looked like — the drift a read-only list defined by §3.8 exists to avoid. Recorded rather than treated as a violation, because a count of zero is not a placeholder. |

**Not recorded as a violation:** the roster reading `project_member` rows while `isMember` admits
every admin. That asymmetry is §2's own rule (`OT-AUTHZ-006`), stated in the specification before it
is a design here, and the two live in different modules so the import makes the distinction visible.

## Phase status

| Phase | Output | Status |
| --- | --- | --- |
| 0 — Outline & research | [`research.md`](./research.md) | complete — 40 decisions, three assumptions carried forward, no unknown outstanding |
| 1 — Design & contracts | [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md) | complete |
| Constitution re-check | this file | complete — pass, five items in Complexity Tracking, one of them a governance approval |
| 2 — Tasks | [`tasks.md`](./tasks.md) | complete — 89 tasks across 8 phases, MVP is T001–T036 |
| Cross-artifact analysis | [`tasks.md`](./tasks.md), this file, [`spec.md`](./spec.md) | complete — `/speckit-analyze`, 15 findings, all remediated |
| Implementation | — | **blocked on entries R2 and R3**, and on the dependency approval above |
